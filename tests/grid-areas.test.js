// tests/grid-areas.test.js
//
// jsdom does no layout, so nothing here can observe grid items overlapping. What jsdom *can*
// do is match selectors, so this is a rule-level consistency check over the stylesheet text:
// resolve the cascade for `grid-area` and `grid-template-areas` at every breakpoint the sheets
// themselves declare, and fail if a `.screen` child still names an area that its container no
// longer defines at that width.
//
// Why that is worth a test: CSS Grid §8.3 says an unmatched `<custom-ident>` in `grid-area`
// falls back to `1 <ident>`, and when no line carries the name, *all* implicit lines are
// assumed to. So the mistake is silent - no parse error, no console warning - and every
// affected child lands in the same implicit cell and paints on top of the others.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { createGameState, PHASE } from '../src/state.js';
import { startFight, resolveFightOutcome, retire } from '../src/game.js';
import { makeRng } from '../src/rng.js';
import { mount } from '../src/ui/screens.js';

// Cascade order = the entry point's @import order, then anything not imported yet.
const ENTRY = 'src/styles.css';
const entryText = readFileSync(ENTRY, 'utf8');
const imported = [...entryText.matchAll(/@import\s+['"]\.\/(.+?)['"]/g)].map((m) => `src/${m[1]}`);
const extra = readdirSync('src/styles')
  .map((f) => `src/styles/${f}`)
  .filter((f) => !imported.includes(f));
const SHEETS = [ENTRY, ...imported, ...extra];

// --- tiny CSS reader: flat rules, each tagged with its @media stack and source order ---
function parseRules(text, sheet, out) {
  const src = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const media = [];
  let buf = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '{') {
      const prelude = buf.trim();
      buf = '';
      if (prelude.startsWith('@')) { media.push(prelude); continue; }
      let depth = 1;
      let body = '';
      i++;
      while (i < src.length) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}' && --depth === 0) break;
        body += src[i];
        i++;
      }
      out.push({
        sheet,
        selectors: prelude.split(',').map((s) => s.trim()).filter(Boolean),
        decls: readDecls(body),
        media: [...media],
        order: out.length,
      });
    } else if (c === '}') { media.pop(); buf = ''; } else buf += c;
  }
}

function readDecls(body) {
  return body.split(';').map((d) => d.trim()).filter(Boolean).flatMap((d) => {
    const i = d.indexOf(':');
    if (i < 0) return [];
    let value = d.slice(i + 1).trim();
    const important = /!\s*important$/i.test(value);
    if (important) value = value.replace(/!\s*important$/i, '').trim();
    return [{ prop: d.slice(0, i).trim().toLowerCase(), value, important }];
  });
}

const RULES = [];
for (const f of SHEETS) parseRules(readFileSync(f, 'utf8'), f, RULES);

// --- media evaluation: width features only; anything else is treated as not active ---
const WIDTH_FEATURE = /\((max|min)-width:\s*(\d+)px\)/g;
function mediaActive(stack, width) {
  return stack.every((q) => {
    const feats = [...q.matchAll(WIDTH_FEATURE)];
    const bare = q.replace(/^@media/, '').replace(WIDTH_FEATURE, '').replace(/\band\b|\s|,/g, '');
    if (bare !== '' || feats.length === 0) return false; // e.g. prefers-reduced-motion
    return feats.every(([, kind, px]) => (kind === 'max' ? width <= +px : width >= +px));
  });
}

// Every declared breakpoint edge, from both sides, plus a wide desktop.
const WIDTHS = [...new Set(
  [1280, ...[...RULES.flatMap((r) => r.media).join(' ').matchAll(WIDTH_FEATURE)]
    .flatMap(([, kind, px]) => (kind === 'max' ? [+px, +px + 1] : [+px, +px - 1]))],
)].sort((a, b) => b - a);

// --- specificity: deliberately narrow. Selector forms it cannot score correctly throw. ---
function specificity(sel) {
  if (/:(where|is|not|has)\(/.test(sel)) {
    throw new Error(`grid-areas.test.js cannot score "${sel}" - extend specificity() first`);
  }
  const flat = sel.replace(/\s*[>+~]\s*/g, ' ');
  const ids = (flat.match(/#[\w-]+/g) || []).length;
  const classes = (flat.match(/\.[\w-]+|\[[^\]]*\]|:{1}(?!:)[\w-]+/g) || []).length;
  const types = (flat.match(/(^|\s)[a-zA-Z][\w-]*/g) || []).length;
  return [ids, classes, types];
}
const beats = (a, b) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};

function winner(el, prop, width) {
  let best = null;
  for (const rule of RULES) {
    if (!mediaActive(rule.media, width)) continue;
    const decl = [...rule.decls].reverse().find((d) => d.prop === prop);
    if (!decl) continue;
    for (const sel of rule.selectors) {
      if (!el.matches(sel)) continue;
      const key = [decl.important ? 1 : 0, ...specificity(sel), rule.order];
      if (!best || beats(key, best.key)) best = { key, value: decl.value };
    }
  }
  return best ? best.value : null;
}

// --- value readers ---
const areaNames = (value) => new Set(
  value ? [...value.matchAll(/"([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((n) => n && n !== '.') : [],
);

// Only the single-custom-ident spelling of `grid-area` names an area. Anything else that
// carries an ident is refused rather than silently passed.
function namedArea(value) {
  if (!value || value === 'auto' || value === 'initial' || value === 'unset') return null;
  if (/^-?\d/.test(value) || /\bspan\b/.test(value)) return null;
  if (value.includes('/')) {
    if (/[a-zA-Z]/.test(value.replace(/\bspan\b|\bauto\b/g, ''))) {
      throw new Error(`grid-areas.test.js cannot read "grid-area: ${value}" - extend namedArea()`);
    }
    return null;
  }
  return /^[\w-]+$/.test(value) ? value : null;
}

// A child selector has to be synthesizable as an element. Simple class compounds only.
function makeChild(doc, sel) {
  const m = /^((?:\.[\w-]+)+)$/.exec(sel);
  if (!m) throw new Error(`grid-areas.test.js cannot synthesize "${sel}" - extend makeChild()`);
  const el = doc.createElement('div');
  el.className = sel.split('.').filter(Boolean).join(' ');
  return el;
}

const VARIANTS = ['screen', ...new Set([...RULES.flatMap((r) => r.selectors).join(' ')
  .matchAll(/\.(screen--[\w-]+)/g)].map((m) => m[1]))];

function container(variant) {
  const el = document.createElement('section');
  el.className = variant === 'screen' ? 'screen' : `screen ${variant}`;
  document.body.appendChild(el);
  return el;
}

// areasOf[variant][width] = Set of area names that variant's grid actually defines there.
const areasOf = Object.fromEntries(VARIANTS.map((v) => {
  const el = container(v);
  const byWidth = Object.fromEntries(WIDTHS.map((w) => [w, areaNames(winner(el, 'grid-template-areas', w))]));
  el.remove();
  return [v, byWidth];
}));

// Every (selector, area name) pair any rule in the sheets asks for.
const CLAIMS = [];
for (const rule of RULES) {
  const decl = [...rule.decls].reverse().find((d) => d.prop === 'grid-area');
  if (!decl) continue;
  const area = namedArea(decl.value);
  if (!area) continue;
  for (const sel of rule.selectors) if (!CLAIMS.some((c) => c.sel === sel && c.area === area)) CLAIMS.push({ sel, area });
}

// One representative state per phase, so the markup walk below can be driven off `PHASE`
// rather than a hand-kept list of renderers. Built through the real transitions, so an
// illegal one throws here instead of producing a screen the game can never reach.
const HUB_STATE = createGameState(1, CONFIG);
const STATES = {
  [PHASE.HUB]: HUB_STATE,
  [PHASE.FIGHT]: startFight(HUB_STATE, CONFIG),
  [PHASE.RESULT]: resolveFightOutcome(startFight(HUB_STATE, CONFIG), true, makeRng(1), CONFIG),
  [PHASE.GAMEOVER]: retire(HUB_STATE),
};

describe('screen grid areas', () => {
  it('has a state for every phase mount() can be handed', () => {
    expect(Object.keys(STATES).sort()).toEqual(Object.values(PHASE).sort());
  });

  it('has claims to check and breakpoints to check them at', () => {
    expect(CLAIMS.length).toBeGreaterThan(0);
    expect(WIDTHS.length).toBeGreaterThan(1);
  });

  it('never places a named area no .screen variant defines', () => {
    const orphans = CLAIMS.filter(({ area }) => !VARIANTS.some((v) => WIDTHS.some((w) => areasOf[v][w].has(area))));
    expect(orphans).toEqual([]);
  });

  // The real assertion. For each child that belongs to a screen variant (that variant names
  // its area at some width), the child must not still resolve to that name at a width where
  // the variant has dropped its areas - otherwise CSS Grid §8.3 collapses the children.
  it('drops child grid-areas at every breakpoint that drops grid-template-areas', () => {
    const broken = [];
    for (const { sel, area } of CLAIMS) {
      for (const variant of VARIANTS) {
        if (!WIDTHS.some((w) => areasOf[variant][w].has(area))) continue; // not this screen's child
        const parent = container(variant);
        const child = makeChild(document, sel);
        parent.appendChild(child);
        for (const width of WIDTHS) {
          const resolved = namedArea(winner(child, 'grid-area', width));
          if (resolved && !areasOf[variant][width].has(resolved)) {
            broken.push(`${width}px: .${variant} > ${sel} keeps "grid-area: ${resolved}" but .${variant} defines no such area`);
          }
        }
        parent.remove();
      }
    }
    expect(broken).toEqual([]);
  });

  // Spec §7 makes ≤900px a real breakpoint, not a free pass. A desktop grid left undeclared
  // there keeps all of its columns on a tablet, and nothing else in this file notices: the
  // areas are still defined, so every child still resolves. Rule-level, because jsdom lays
  // nothing out. A screen that genuinely wants one layout everywhere can drop its areas at 900
  // (as spec §7 does for result/gameover) and satisfy this.
  it('recomposes every screen variant at the ≤900px compact breakpoint', () => {
    const stuck = [];
    for (const variant of VARIANTS.filter((v) => v !== 'screen')) {
      const el = container(variant);
      const wide = winner(el, 'grid-template-areas', 1280);
      if (wide && winner(el, 'grid-template-areas', 900) === wide) stuck.push(variant);
      el.remove();
    }
    expect(stuck).toEqual([]);
  });

  // A breakpoint that re-lays a screen must re-lay its rows too. `grid-template-areas` and
  // `grid-template-rows` are separate properties, so a media query that swaps a 3-row desktop
  // grid for a 5-row stacked one inherits the desktop's row list — and the `1fr` meant for
  // the stage lands on whatever row 2 happens to be now. It is silent while `.screen` is
  // auto-height (there is no free space to misallocate), which is exactly why it needs a test
  // rather than an eye: it only becomes visible once some later screen has a definite height.
  it('sizes as many rows as it names at every breakpoint', () => {
    const mismatched = [];
    for (const variant of VARIANTS) {
      const el = container(variant);
      for (const width of WIDTHS) {
        const areas = winner(el, 'grid-template-areas', width);
        const rows = winner(el, 'grid-template-rows', width);
        if (!rows || rows === 'none' || !areas || areas === 'none') continue;
        const named = [...areas.matchAll(/"[^"]*"/g)].length;
        const tracks = rows.trim().split(/\s+/).length;
        if (named !== tracks) {
          mismatched.push(`${width}px: .${variant} names ${named} area rows but sizes ${tracks} (${rows})`);
        }
      }
      el.remove();
    }
    expect(mismatched).toEqual([]);
  });

  // Everything above reads rules only, so a wrapper the renderer emits but the sheet never
  // places is invisible to it: the child falls into auto-placement and the grid it was written
  // for quietly ignores it. This walks the real markup instead - every direct child of a
  // rendered `.screen` must resolve to an area its own variant defines, at every width where
  // that variant still has areas. (Below that, the ≤640px reset stacks them, which the test
  // above owns.)
  it('places every direct child the screens actually render', () => {
    const misplaced = [];
    let checked = 0;
    const seen = [];
    // Derived from PHASE, not hand-listed: `mount()` is the single door every screen goes
    // through, so a phase whose renderer is promoted to a `.screen` (Tasks 8/9) is picked up
    // here the day it lands. A hand-maintained array would have let it walk straight past
    // this guard while `checked > 0` stayed happily true.
    for (const phase of Object.values(PHASE)) {
      const host = document.createElement('div');
      mount(host, STATES[phase], CONFIG);
      document.body.appendChild(host);
      const section = host.querySelector('.screen');
      // Not yet a §7 grid screen (result/gameover until Tasks 8/9). Nothing to place.
      if (!section) { host.remove(); continue; }
      const variant = [...section.classList].find((c) => c.startsWith('screen--'));
      expect(variant, `${phase} renders a .screen with no --variant`).toBeDefined();
      seen.push(variant);
      for (const child of section.children) {
        for (const width of WIDTHS) {
          if (areasOf[variant][width].size === 0) continue; // stacked here, not placed
          const area = namedArea(winner(child, 'grid-area', width));
          checked += 1;
          if (!area || !areasOf[variant][width].has(area)) {
            misplaced.push(`${width}px: .${variant} > .${[...child.classList].join('.')} → ${area}`);
          }
        }
      }
      host.remove();
    }
    expect(misplaced).toEqual([]);
    expect(checked).toBeGreaterThan(0);
    // `checked > 0` on its own is satisfied by the hub alone, so it would not notice a new
    // screen slipping past. Assert the wiring in both directions instead: every `.screen--*`
    // the sheets lay out must be one some phase actually mounts, and every variant a phase
    // mounts must be one the sheets lay out. Task 8/9 cannot land half of either.
    expect(seen.sort()).toEqual(VARIANTS.filter((v) => v !== 'screen').sort());
  });

  // grid-area has longhand spellings this checker does not read. If one ever appears with a
  // custom-ident, fail loudly rather than let it slip past the check above.
  it('uses no grid placement longhand the checker cannot see', () => {
    const longhand = /grid-(row|column)(-start|-end)?\s*:\s*([^;}]+)/g;
    const offenders = [];
    for (const f of SHEETS) {
      const text = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const [, , , value] of text.matchAll(longhand)) {
        const stripped = value.replace(/\bspan\b|\bauto\b|\binitial\b|\bunset\b/g, '');
        if (/[a-zA-Z]/.test(stripped)) offenders.push(`${f}: ${value.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
