// tests/styles.test.js — every var(--x) the sheets use must be a token they define, and every
// duration a JS animation restates must be the token the CSS animates on.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { BEAT_MS, CHIP_LIFE_MS, SHAKE_MS } from '../src/ui/effects.js';
import { mountAll } from './support/screens.js';

const SHEETS = ['src/styles.css', ...readdirSync('src/styles').map((f) => `src/styles/${f}`)];
const css = SHEETS.map((f) => readFileSync(f, 'utf8')).join('\n');

// Plan Task 10 Step 4b. The vendored woff2 files are redistributed font software, in git and in
// dist/, so the OFL requires the license to travel with them — and to *attribute* somebody. The
// file that used to sit here was the canonical OFL 1.1 template, whose copyright line is still
// the unfilled `Copyright (c) <dates>, <Copyright Holder>`: a license, naming no one. Derived
// from the `@font-face` rules rather than from a hand-kept list, so a fourth family cannot be
// vendored without its own upstream OFL.txt arriving beside it (scripts/fetch-fonts.mjs).
describe('font attribution (OFL)', () => {
  const faces = [...readFileSync('src/styles/tokens.css', 'utf8')
    .matchAll(/@font-face\s*\{[^}]*font-family:\s*'([^']+)'[^}]*url\('\.\.\/assets\/([^']+)'/g)];

  it('finds every declared face', () => {
    expect(faces.length).toBe(4);
  });

  it('ships each family its own upstream license, naming a real holder', () => {
    const families = new Set(faces.map((m) => m[1]));
    expect(families.size).toBe(3);
    for (const family of families) {
      const path = `src/assets/fonts/OFL-${family.replace(/\s+/g, '')}.txt`;
      const text = readFileSync(path, 'utf8');
      expect(text, `${path} is not OFL 1.1`).toContain('SIL OPEN FONT LICENSE Version 1.1');
      // The placeholder is the whole point of the step: its absence is what separates an
      // attribution from a template that merely looks like one.
      expect(text, `${path} still carries the template placeholder`)
        .not.toMatch(/<Copyright Holder>|<dates>/);
      expect(text, `${path} names no copyright holder`).toMatch(/^Copyright \S+/m);
    }
    // The template must be gone, not merely joined: leaving it means the tree still ships a
    // notice attributing nobody, and a reader has no way to tell which file governs.
    expect(existsSync('src/assets/fonts/OFL.txt')).toBe(false);
  });

  it('ships every font file the sheet asks the browser to load', () => {
    for (const [, , asset] of faces) expect(existsSync(`src/assets/${asset}`), asset).toBe(true);
  });
});

describe('css custom properties', () => {
  it('references only tokens that are defined', () => {
    const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
    expect([...used].filter((t) => !defined.has(t))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Spec §3 / §8 contrast. Every ratio in this project is a *hand-written claim* — in a token
// comment, in the spec's table, in a rule's justification — and a claim is exactly the kind of
// thing that rots when a hex is nudged. Nothing recomputed any of them until now, so
// `--bone-dim`'s annotation could have said any number at all and the suite would have agreed.
//
// This is the WCAG 2.x relative-luminance formula, which is what spec §3 says its table was
// computed with. Reproducing all fourteen of its published rows to two decimals is the evidence
// that this implementation is the same one the spec used — so a disagreement below is a real
// disagreement about a colour, not two formulas talking past each other.
const HEX = /^#[0-9a-fA-F]{6}$/;
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v8) => {
    const v = v8 / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
// Symmetric, so a claim never has to say which side is the text.
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const tokensCss = readFileSync('src/styles/tokens.css', 'utf8');
// Literal hexes only: a token defined as `var(--other)` is an alias and is followed through
// separately, so nothing here silently compares a string to itself.
const HEXES = Object.fromEntries([...tokensCss.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)]
  .map((m) => [m[1], m[2]]));
// Follow `--a: var(--b)` chains so a semantic token can be measured as the primitive it is.
function hexOf(token, seen = new Set()) {
  if (HEXES[token]) return HEXES[token];
  if (seen.has(token)) return null;
  seen.add(token);
  const alias = tokensCss.match(new RegExp(`${token}\\s*:\\s*var\\((--[\\w-]+)\\)`));
  return alias ? hexOf(alias[1], seen) : null;
}
const round2 = (x) => Math.round(x * 100) / 100;

describe('contrast claims are recomputed, not trusted (spec §3)', () => {
  // The spec's own table is the calibration. If this passes, `luminance` above *is* the
  // function §3 was written with, and every other assertion in this describe inherits that.
  const specTable = [...readFileSync('docs/superpowers/specs/2026-07-23-gold-and-glory-design-system.md', 'utf8')
    .matchAll(/^\|\s*`(--[\w-]+)`\s+on\s+`(--[\w-]+)`\s*\|\s*(\d+\.\d\d):1\s*\|/gm)];

  it('reproduces every row of spec §3\'s published table', () => {
    expect(specTable.length).toBe(14);
    const wrong = [];
    for (const [, fg, bg, claimed] of specTable) {
      const [a, b] = [hexOf(fg), hexOf(bg)];
      expect(a, `${fg} resolves to no hex`).toMatch(HEX);
      expect(b, `${bg} resolves to no hex`).toMatch(HEX);
      const actual = round2(contrast(a, b));
      if (actual !== Number(claimed)) wrong.push(`${fg} on ${bg}: spec says ${claimed}, is ${actual}`);
    }
    expect(wrong).toEqual([]);
  });

  // tokens.css states its own ratios inline. They are written in one machine-readable form,
  // `N.NN:1 vs --other`, against the token whose declaration the comment sits on — direction
  // free, because contrast is symmetric. Task 10 normalised the wording to this shape for
  // exactly this reason; a claim that cannot be parsed is a claim nobody checks.
  const claims = [];
  for (const line of tokensCss.split('\n')) {
    const decl = /^\s*(--[\w-]+)\s*:\s*#[0-9a-fA-F]{6}\s*;\s*\/\*(.*)$/.exec(line);
    if (!decl) continue;
    for (const m of decl[2].matchAll(/(\d+\.\d\d):1 vs (--[\w-]+)/g)) {
      claims.push({ token: decl[1], other: m[2], ratio: Number(m[1]) });
    }
  }

  it('found the annotations to check', () => {
    // Guards the vacuous pass: a broken regex yields zero claims and an empty `wrong` list.
    expect(claims.length).toBeGreaterThanOrEqual(13);
    expect(claims.map((c) => c.token)).toContain('--bone-dim');
  });

  it('recomputes every ratio a token comment claims', () => {
    const wrong = [];
    for (const { token, other, ratio } of claims) {
      const [a, b] = [hexOf(token), hexOf(other)];
      expect(b, `${other} resolves to no hex`).toMatch(HEX);
      const actual = round2(contrast(a, b));
      if (actual !== ratio) wrong.push(`${token} vs ${other}: comment says ${ratio}, is ${actual}`);
    }
    expect(wrong).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Step 2's arithmetic half. The two-tone focus ring is the one piece of §8 that cannot be
// checked by looking at a screenshot of a single surface: plain `--color-focus` blue is
// invisible on stone, and the bone halo in base.css is the only reason the ring survives there.
// Both halves are load-bearing on different grounds, so a reviewer "simplifying" either one
// silently breaks focus on some screen. This pins which half carries which surface.
describe('focus ring reads on every §8 surface', () => {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const focusRule = bare.match(/(?:^|\})\s*:focus-visible\s*\{[^}]*\}/m);
  // §8: "UI component boundaries >= 3:1 against adjacent fills." A focus ring is such a boundary.
  const FLOOR = 3;
  const ring = hexOf('--color-focus');
  const halo = hexOf('--bone-bright');
  // The four grounds spec §8 and the plan's focus-ring amendment name: the stone page, a
  // parchment card, a wood plank, and a commit banner. Derived through the semantic tokens, so
  // repointing `--surface-page` at a different stone re-measures rather than re-passes.
  const GROUNDS = {
    stone: hexOf('--surface-page'),
    paper: hexOf('--surface-paper'),
    wood: hexOf('--surface-wood'),
    blue: hexOf('--commit'),
  };

  it('resolves all four grounds and both halves of the ring', () => {
    expect(ring).toMatch(HEX);
    expect(halo).toMatch(HEX);
    for (const [name, hex] of Object.entries(GROUNDS)) expect(hex, name).toMatch(HEX);
  });

  it('carries a >= 3:1 edge on stone, paper, wood and blue', () => {
    const failed = [];
    for (const [name, ground] of Object.entries(GROUNDS)) {
      const best = Math.max(contrast(ring, ground), contrast(halo, ground));
      if (best < FLOOR) {
        failed.push(`${name}: ring ${round2(contrast(ring, ground))}, halo ${round2(contrast(halo, ground))}`);
      }
    }
    expect(failed).toEqual([]);
  });

  // The reason the halo exists, stated as an assertion rather than a comment: on stone the blue
  // is 1.12:1 and contributes nothing. If someone ever picks a focus blue that reads on stone by
  // itself this fails — which is the right moment to reconsider whether the halo is still needed,
  // rather than discovering the ring is invisible from a bug report.
  it('needs the halo on stone and the blue on paper - neither half is redundant', () => {
    expect(contrast(ring, GROUNDS.stone)).toBeLessThan(FLOOR);
    expect(contrast(halo, GROUNDS.stone)).toBeGreaterThanOrEqual(FLOOR);
    expect(contrast(halo, GROUNDS.paper)).toBeLessThan(FLOOR);
    expect(contrast(ring, GROUNDS.paper)).toBeGreaterThanOrEqual(FLOOR);
    // …and the two halves are distinguishable from each other, so the ring has an internal edge
    // whichever ground swallows one of them.
    expect(contrast(ring, halo)).toBeGreaterThanOrEqual(FLOOR);
  });

  it('states the halo once, as the sheets\' only !important box-shadow', () => {
    expect(focusRule, 'no bare :focus-visible rule').not.toBeNull();
    expect(focusRule[0]).toMatch(/outline:\s*3px solid var\(--color-focus\)/);
    expect(focusRule[0]).toMatch(/outline-offset:/);
    // The `!important` is what stops a component's own box-shadow (`.btn:active`,
    // `.btn.is-owned { box-shadow: none }`) from swallowing the halo. It only stops them while
    // it is the *only* important box-shadow in the cascade: a second one at higher specificity
    // would outrank it, and the ring would vanish on exactly those components.
    const important = bare.match(/box-shadow\s*:[^;}]*!\s*important/g) ?? [];
    expect(important.length, `!important box-shadows: ${important.join(' | ')}`).toBe(1);
    expect(important[0]).toContain('var(--bone-bright)');
  });

  // On a commit banner the blue ring would sit on its own colour (1.25:1), so §8 says the ring
  // turns bone there. It has to clear the floor against *both* gradient stops, since the button
  // is a gradient and the ring runs along all of it.
  it('turns bone on a commit banner, and clears both gradient stops', () => {
    const commitFocus = bare.match(/\.btn--commit:focus-visible\s*\{[^}]*\}/);
    expect(commitFocus, 'no .btn--commit:focus-visible rule').not.toBeNull();
    expect(commitFocus[0]).toMatch(/outline-color:\s*var\(--bone-bright\)/);
    for (const stop of ['--commit-hi', '--commit-lo']) {
      expect(round2(contrast(halo, hexOf(stop))), stop).toBeGreaterThanOrEqual(FLOOR);
    }
  });
});

// ---------------------------------------------------------------------------
// Step 3, the stylesheet half. effects.js's reduced-motion behaviour is already covered by
// tests/effects.test.js, but the JS and the CSS have to agree, and one place they did not:
// `chip-fall` ends at `opacity: 0` and runs `forwards`, so shortening it to 1ms does not stop
// the chip travelling — it *deletes* the chip a millisecond after it appears, while
// REDUCED_CHIP_LIFE_MS keeps an invisible node alive for 1.5s. The JS test passed and a
// reduced-motion player saw no money move at all.
describe('reduced motion (spec §5)', () => {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const block = bare.match(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/);

  it('has the blanket block spec §5 mandates', () => {
    expect(block, 'no prefers-reduced-motion block').not.toBeNull();
    expect(block[1]).toMatch(/animation-duration:\s*1ms\s*!important/);
    expect(block[1]).toMatch(/transition-duration:\s*1ms\s*!important/);
    // Not in spec §5's own snippet, and the thing that actually stops the pulses: `bar-urgent`
    // and `urgent-pulse` are `infinite`, so a 1ms duration alone would still restart them
    // forever. §8 says pulses stop.
    expect(block[1]).toMatch(/animation-iteration-count:\s*1\s*!important/);
  });

  it('leaves every infinite pulse to that iteration-count clamp', () => {
    const infinite = [...bare.matchAll(/([^{}]+)\{([^{}]*animation[^{}]*infinite[^{}]*)\}/g)]
      .map((m) => m[1].trim());
    // Vacuity guard: if the game ever stops pulsing, this test should be deleted, not passing.
    expect(infinite.length).toBeGreaterThan(0);
    expect(infinite).toContain('.btn.is-urgent');
  });

  // The general form of the delta-chip defect: a `forwards` animation whose last keyframe hides
  // the element is not slowed down by the blanket rule, it is *applied instantly and kept*. Any
  // such animation must be cancelled outright inside the reduced-motion block.
  it('cancels, rather than shortens, any forwards animation that ends hidden', () => {
    const vanishing = new Set();
    for (const [, name, body] of bare.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)) {
      const last = [...body.matchAll(/(to|100%)\s*\{([^{}]*)\}/g)].pop();
      if (last && /opacity:\s*0(\D|$)/.test(last[2])) vanishing.add(name);
    }
    expect(vanishing.size, 'no vanishing keyframes found - regex rotted?').toBeGreaterThan(0);
    const unguarded = [];
    for (const [, prelude, body] of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const anim = /animation\s*:\s*([^;}]+)/.exec(body);
      if (!anim || !/\bforwards\b/.test(anim[1])) continue;
      if (![...vanishing].some((n) => anim[1].includes(n))) continue;
      const sel = prelude.trim();
      // The reduced-motion block must switch this rule's animation off, not merely compress it.
      const cancelled = new RegExp(`\\${sel}\\s*\\{[^}]*animation:\\s*none`).test(block[1]);
      if (!cancelled) unguarded.push(sel);
    }
    expect(unguarded).toEqual([]);
  });

  // "…but the meter still sweeps." It sweeps because main.js writes `transform` from a rAF loop,
  // so no CSS timing function is in the path. The moment the cursor gains a CSS animation the
  // blanket 1ms rule freezes gameplay, and no unit test would notice.
  it('keeps the meter sweeping by leaving the cursor to JS', () => {
    const rules = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, prelude]) => /\.meter-cursor\b/.test(prelude));
    expect(rules.length).toBeGreaterThan(0);
    for (const [, prelude, body] of rules) {
      expect(body, `${prelude.trim()} animates the cursor in CSS`).not.toMatch(/animation\s*:/);
    }
    expect(readFileSync('src/main.js', 'utf8'), 'the sweep must be JS-driven')
      .toMatch(/requestAnimationFrame/);
  });
});

// ---------------------------------------------------------------------------
// Spec §8's last line: "All text >= --text-xs (12.5px); mechanics text >= --text-sm." This is
// the floor Step 1b enforced against §6.1's verbatim `font-size: 11px`, and nothing kept it
// enforced afterwards — the token could be lowered, or a new rule could restate a literal.
describe('type floor (spec §8)', () => {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const px = (token) => Number(/(\d+(?:\.\d+)?)px/.exec(tokensCss.match(new RegExp(`${token}\\s*:\\s*[^;]+`))[0])[1]);

  it('keeps --text-xs at or above 12.5px', () => {
    expect(px('--text-xs')).toBeGreaterThanOrEqual(12.5);
    expect(px('--text-sm')).toBeGreaterThanOrEqual(px('--text-xs'));
  });

  it('states no font size below the floor, as a token or as a literal', () => {
    const floor = px('--text-xs');
    const tooSmall = [];
    for (const [, prelude, body] of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (prelude.trim().startsWith('@')) continue;
      // `font-size: Npx` and the size slot of the `font:` shorthand both count.
      for (const [, size] of body.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/g)) {
        if (Number(size) < floor) tooSmall.push(`${prelude.trim()}: font-size ${size}px`);
      }
      for (const [, size] of body.matchAll(/font\s*:\s*[^;}]*?(\d+(?:\.\d+)?)px\s*[/ ]/g)) {
        if (Number(size) < floor) tooSmall.push(`${prelude.trim()}: font ${size}px`);
      }
      for (const [, token] of body.matchAll(/font-size\s*:\s*var\((--text-[\w-]+)\)/g)) {
        if (px(token) < floor) tooSmall.push(`${prelude.trim()}: ${token}`);
      }
    }
    expect(tooSmall).toEqual([]);
  });

  // Step 1b's own follow-up question, which its comment promises this file answers: the numeral
  // grew from 11px to 12.5px, so it has to still fit the narrowest track that carries one.
  // Both sides are read out of the sheets, so narrowing the bar or raising the token fails here.
  // The glyph advances are a stated assumption (Nunito tabular digits ~0.6em, solidus ~0.256em),
  // not a measurement - jsdom lays out nothing and nothing here parses the woff2.
  it('still fits "170/170" inside the narrowest numbered track', () => {
    const barRule = bare.match(/(?:^|\})\s*\.bar\s*\{([^}]*)\}/m)[1];
    const width = Number(/width:\s*(\d+(?:\.\d+)?)px/.exec(barRule)[1]);
    const border = Number(/border:\s*(\d+(?:\.\d+)?)px/.exec(barRule)[1]);
    const numRule = bare.match(/\.bar__num\s*\{([^}]*)\}/)[1];
    expect(numRule).toMatch(/font-size:\s*var\(--text-xs\)/);
    const track = width - 2 * border;
    const em = px('--text-xs');
    const widest = (6 * 0.6 + 0.256) * em; // "170/170" - six digits and a solidus
    expect(widest).toBeLessThan(track);
  });
});

// Spec §6.1/§6.5 — the bar track must be a block box.
//
// **Written at rule level on purpose.** The defect this guards is a used-width, and jsdom
// implements no layout: every element has a used width of 0 there, so a test that measured the
// collapse would pass identically before and after the fix. What is decidable from the sheets is
// the *rule* that makes the collapse impossible, and it is a necessary condition for the visual
// claim: `meter()` emits `.bar` as a `<span>` whose two children (`.bar__fill`, `.bar__num`) are
// both absolutely positioned, so the track has no in-flow content and its entire size comes from
// `width`/`height` — and neither applies to a non-replaced inline box (CSS2 §10.2). Without a
// block-level `display` the track collapsed to ~5px on every poster HP plate in the game
// (measured in a real browser at 900px) while looking correct in the HUD, because `.hud__stat`
// is `inline-flex` and `.train-row` is `grid` and both blockify their items. Each assertion below
// pins one link of that chain, so the test cannot rot into vacuity if the anatomy changes.
describe('the bar track is a block box (spec §6.1/§6.5)', () => {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // Values that make a box block-level (`inline-block` deliberately excluded: it would apply the
  // width but leave the track shrink-wrapping its line box in an inline formatting context).
  const BLOCK_LEVEL = ['block', 'flex', 'grid', 'flow-root'];
  // A selector whose *rightmost* compound carries `.bar` is one that targets a track.
  const TARGETS_A_BAR = /(^|[\s>+~])[^\s>+~]*\.bar(?![\w-])[^\s>+~]*$/;

  // Flat (selector, body) pairs. The sheets nest nothing but @media, whose prelude starts `@`.
  const RULES = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, prelude]) => !prelude.trim().startsWith('@'))
    .flatMap(([, prelude, body]) => prelude.split(',').map((sel) => [sel.trim(), body]));

  it('has the anatomy that makes the display load-bearing', () => {
    const barRule = bare.match(/(?:^|\})\s*\.bar\s*\{([^}]*)\}/m);
    expect(barRule, 'no `.bar` rule in the sheets').not.toBeNull();
    // The track is sized, not content-shaped - so `display` decides whether the size applies.
    expect(barRule[1]).toMatch(/(^|;)\s*width:/);
    expect(barRule[1]).toMatch(/(^|;)\s*height:/);
    // ...and nothing in it is in flow to give it a size instead.
    for (const child of ['.bar__fill', '.bar__num']) {
      const body = bare.match(new RegExp(`\\${child}\\s*\\{([^}]*)\\}`))[1];
      expect(body, `${child} must stay out of flow`).toMatch(/position:\s*absolute/);
    }
  });

  it('declares a block-level display on the track itself', () => {
    const declared = RULES
      .filter(([sel]) => TARGETS_A_BAR.test(sel))
      .flatMap(([sel, body]) => [...body.matchAll(/(^|;)\s*display:\s*([^;]+)/g)]
        .map((m) => [sel, m[2].trim()]));
    // At least one rule must state it, or `width: 108px` is silently ignored on any bar whose
    // parent is not a flex or grid container.
    expect(declared.length, '`.bar` declares no `display` - its width will not apply')
      .toBeGreaterThan(0);
    // ...and every such rule must keep it block-level, so a later override cannot re-collapse
    // the track. Allowlist, so an unrecognised value fails rather than slips through.
    expect(declared.filter(([, value]) => !BLOCK_LEVEL.includes(value))).toEqual([]);
  });
});

// Task 9 deleted `src/styles/legacy.css`. Two of its rules were still the only declaration of
// their kind anywhere in the game and were moved into base.css; nothing re-declares either, so
// a careless tidy-up would silently unbound every screen on a wide monitor and hand every dead
// button a live-looking pointer. Text-level, deliberately: this guards the *presence* of rules
// no rendered-markup test in the suite covers (there is no selector-coverage net — see the
// progress file's deferred item 14).
describe('rules inherited from the deleted legacy sheet', () => {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');

  it('has no legacy sheet left to import', () => {
    expect(SHEETS).not.toContain('src/styles/legacy.css');
    expect(readFileSync('src/styles.css', 'utf8')).not.toMatch(/legacy/);
  });

  it('still caps the #app column and dims natively disabled buttons', () => {
    const app = bare.match(/#app\s*\{[^}]*\}/g) ?? [];
    expect(app.length, 'exactly one #app rule').toBe(1);
    expect(app[0]).toMatch(/max-width:\s*1180px/);
    expect(app[0]).toMatch(/margin:\s*0 auto/);
    // Pinned to the token, not merely to the property's presence: `padding:` on its own is
    // satisfied by `padding: 0`, so the gutter could be mutated away with the suite still green.
    expect(app[0]).toMatch(/padding:\s*var\(--space-4\)/);
    const disabled = bare.match(/button:disabled\s*\{[^}]*\}/g) ?? [];
    expect(disabled.length, 'exactly one button:disabled rule').toBe(1);
    expect(disabled[0]).toMatch(/opacity:/);
    expect(disabled[0]).toMatch(/cursor:\s*not-allowed/);
  });

  // Two rules dim a dead button, and the game emits both: `btn({ disabled: true })` writes the
  // native attribute for a true no-op (nothing to repair) while `owned` writes `aria-disabled`.
  // They used to fade by different amounts (0.4 in the moved legacy rule, §6.2's 0.45 in the
  // component), so one Repair plank had two dim states. Derived from each other rather than
  // restated, so raising §6.2's number carries the native rule with it or fails here.
  it('dims a natively-disabled button by exactly as much as an aria-disabled one', () => {
    const opacityOf = (re, what) => {
      const rule = bare.match(re)?.[0];
      expect(rule, `no ${what} rule`).toBeTruthy();
      const value = rule.match(/opacity:\s*([\d.]+)/)?.[1];
      expect(value, `${what} declares no opacity`).toBeTruthy();
      return Number(value);
    };
    const native = opacityOf(/button:disabled\s*\{[^}]*\}/, 'button:disabled');
    const aria = opacityOf(/\.btn\[aria-disabled="true"\]\s*\{[^}]*\}/, '.btn[aria-disabled]');
    expect(native).toBe(aria);
  });
});

// --- Spec Law 4: "Text only sits on paper or wood. Never directly on stone." ---
// The wordmark is the case that broke it: `.wordmark` is `--ink-soft` at `opacity: .7`, which
// on `--surface-page` stone computes to 1.54:1 against §8's 4.5:1 floor. Neither half of the
// codebase can catch that alone — the sheet does not know where the markup puts the span, and
// jsdom resolves no cascade — so both are read here. The grounds are *derived* from the sheets
// (every plain-class rule that paints a paper or wood background), and every `.wordmark` any
// screen renders must have one of them as an ancestor. Deriving them is the point: a new card
// that grows its own parchment is accepted automatically, while a wordmark dropped straight
// onto the page fails no matter which screen drops it.
//
// It asserts a *ground*, not a contrast ratio, and that is deliberate. `--ink-soft` at .7 over
// parchment (`--paper-3`, the darker gradient stop) is 2.80:1 — the wordmark does not clear
// §8's 4.5:1 floor on paper either. Pinning 4.5 here would fail the shipped result screen as
// well, so it would be a claim this code does not make. Law 4 is the line this fix is about.
describe('Law 4 — text never sits on stone', () => {
  const PAPER_OR_WOOD = /background(-color|-image)?\s*:[^;]*var\(--(grad-paper|grad-wood[\w-]*|grad-commit|paper-\d|wood-\d|surface-paper|surface-wood)\)/;
  // Only the plain class-chain spelling: those are the material rules, and anything else
  // (pseudo-elements, `50%` keyframe stops, at-rule preludes) is not an element to stand on.
  const PLAIN_CLASS = /^\.[\w-]+(\.[\w-]+)*$/;
  const grounds = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, , body]) => PAPER_OR_WOOD.test(body))
    .flatMap(([, prelude]) => prelude.split(',').map((s) => s.trim()))
    .filter((s) => PLAIN_CLASS.test(s));
  const SCREENS = mountAll();

  it('derives the paper and wood grounds from the sheets', () => {
    // Guard against a vacuous pass: an empty ground list would make every element below fail,
    // but a regex that accidentally matched everything would make them all pass.
    expect(grounds.length).toBeGreaterThan(3);
    expect(grounds).toContain('.ledger');
    expect(grounds).not.toContain('.screen');
  });

  it('gives every rendered wordmark a paper or wood ancestor', () => {
    const orphans = [];
    let checked = 0;
    for (const [name, host] of Object.entries(SCREENS)) {
      const marks = [...host.querySelectorAll('.wordmark')];
      if (!marks.length) continue;
      for (const mark of marks) {
        checked += 1;
        if (!grounds.some((sel) => mark.closest(sel))) {
          orphans.push(`${name}: .${[...mark.parentElement.classList].join('.')}`);
        }
      }
    }
    expect(orphans).toEqual([]);
    // The result and both game-over states carry one each; a matrix that stopped rendering them
    // would make the loop above vacuously happy.
    expect(checked).toBe(4);
  });

  // The wordmark was only ever the *first* case. Law 4 is about all text, so this walks every
  // element in the matrix that owns a text node of its own and demands the same ground. It finds
  // more than the wordmark did — see WAIVED below — and each of those is a live §8 contrast
  // failure on the stone page, not a theoretical one:
  //
  //   `--ink` on `--stone-2`      4.15:1   hub h2 / "Wins: N" / training labels
  //   `--bone` on `--stone-2`     2.99:1   "Next bout", meter zone labels, meter taunt
  //   `--ink-soft` on `--stone-2` 1.89:1   the result screen's flavour line
  //
  // They are waived rather than fixed because fixing them means deciding what ground each screen
  // band stands on — a §7 layout decision on three already-reviewed screens, not a touch-up. And
  // it cannot be dodged by nudging `--surface-page`: ink wants a lighter stone and bone wants a
  // darker one, so no single value clears 4.5:1 for both (stone-1 4.87/2.55, stone-3 3.14/3.96).
  // Law 4 exists precisely because the page has no value that works, and the remedy is grounds.
  //
  // The waiver is a *closed list*, so it is the opposite of switching the check off: any new
  // ungrounded text fails here, and an entry that gets a ground fails too and must be removed.
  const WAIVED = [
    'div.hub__sinks > h2',      // "The Ludus", --ink 4.15:1 (clears 3:1 as large text, not Law 4)
    'div.hub__develop > h2',    // "Training" / "Gear shop", --ink 4.15:1
    'div.fight__log > h2',      // "Commentary", --ink 4.15:1
    'div.hub__sinks > p',       // hub "Wins: N", --ink 4.15:1
    'span.train-row__label',    // --ink 4.15:1
    'span.hub__next-label',     // --bone 2.99:1
    'div.meter__labels > span',  // --bone 2.99:1
    'p.meter__taunt.snark',     // --bone 2.99:1
    'p.snark.result__flavor',   // --ink-soft 1.89:1
  ];

  const describeEl = (el) => {
    const self = el.tagName.toLowerCase() + [...el.classList].map((c) => `.${c}`).join('');
    const parent = el.parentElement;
    // Bare `span`/`p` are ambiguous on their own, so an unclassed element is named by its parent.
    if (el.classList.length || !parent || !parent.classList.length) return self;
    return `${parent.tagName.toLowerCase()}${[...parent.classList].map((c) => `.${c}`).join('')} > ${self}`;
  };

  const ungrounded = () => {
    const found = new Map();
    for (const [name, host] of Object.entries(SCREENS)) {
      for (const el of host.querySelectorAll('*')) {
        const owns = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!owns || grounds.some((sel) => el.closest(sel))) continue;
        const key = describeEl(el);
        if (!found.has(key)) found.set(key, new Set());
        found.get(key).add(name);
      }
    }
    return found;
  };

  it('has no ungrounded text beyond the waived set', () => {
    const found = [...ungrounded().keys()].sort();
    expect(found.filter((k) => !WAIVED.includes(k))).toEqual([]);
  });

  it('keeps the waiver list honest - every entry still violates Law 4', () => {
    // Without this, a waiver outlives its violation and quietly stops guarding anything: the
    // list would grow monotonically and a future ground-fix would never be noticed.
    const found = new Set(ungrounded().keys());
    expect(WAIVED.filter((w) => !found.has(w))).toEqual([]);
  });
});

// --- Spec Law 2: "Gold means money." ---
// The gold hues are the one palette in this design with a semantic monopoly, and a monopoly is
// only checkable as a closed set. Both directions are pinned: every rule that paints gold *text*
// must be a money surface, and every non-money use of a gold token must be one the spec itself
// sanctions. A new `color: var(--gold-ink)` on a heading fails here; so does a gold fill nobody
// has argued for.
describe('Law 2 — gold appears only on money', () => {
  const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, prelude, body]) => ({ sel: prelude.trim(), body }))
    .filter((r) => !r.sel.startsWith('@') && r.sel !== ':root');
  // `--grad-coin` is a gold gradient under another name, so the coin cannot hide from Law 2.
  const GOLD = /var\(--(gold[\w-]*|grad-coin|color-money[\w-]*)\)/;

  it('paints gold text on money surfaces and nothing else', () => {
    const asText = rules.filter((r) => new RegExp(`(^|[^-])color\\s*:[^;]*${GOLD.source}`).test(r.body))
      .map((r) => r.sel);
    // Every one of these is a currency figure: the HUD purse, a price slot, a poster's fight
    // purse, the log's money clause, the ledger's closing balance, the final purse on game over.
    expect(asText.sort()).toEqual([
      '.btn__price', '.cause-of-death .amount', '.hud__purse',
      '.ledger__row--balance .amount', '.log .amount', '.poster__sub .amount',
    ]);
  });

  it('uses gold as a non-money fill only where the spec says to', () => {
    const asText = new RegExp(`(^|[^-])color\\s*:[^;]*${GOLD.source}`);
    const fills = rules.filter((r) => GOLD.test(r.body) && !asText.test(r.body)).map((r) => r.sel);
    // `.coin` reaches gold through `--grad-coin`, which is money iconography and squarely Law 2.
    // The other three are documented deviations, and naming them here is the point:
    //  - `.bar__fill--dur` is spec §6.1's own verbatim block. Durability is not money, so §6.1
    //    contradicts Law 2; the spec's CSS was followed (progress-file territory, not a bug).
    //  - the three `.meter__zone--*` bands are §6.4's monochromatic gold ramp, where brighter
    //    means closer to glory. Not money either, and argued for in components.css.
    //  - `urgent-pulse`'s 50% stop rings a nagging button in `--gold-deep`.
    expect(fills.sort()).toEqual([
      '.bar__fill--dur', '.coin', '.meter__zone--crit', '.meter__zone--graze',
      '.meter__zone--hit', '50%',
    ].sort());
  });
});

// --- Spec Law 3: "blue means commitment." ---
// Blue is reserved for irreversible choices and for focus. The sheet side is a closed set of
// selectors; tests/a11y.test.js checks the markup side (which buttons actually wear it).
describe('Law 3 — commit blue only on commit controls and focus rings', () => {
  const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, prelude, body]) => ({ sel: prelude.trim(), body }))
    .filter((r) => !r.sel.startsWith('@') && r.sel !== ':root');

  it('spends the commit palette on four selectors, all of them commit or focus', () => {
    const blue = rules
      .filter((r) => /var\(--(commit[\w-]*|grad-commit|color-focus)\)/.test(r.body))
      .map((r) => r.sel);
    expect(blue.sort()).toEqual([
      ':focus-visible', '.btn--commit', '.btn:focus-visible',
    ].sort());
    // …and the one remaining focus rule is the commit banner's, which overrides the ring to bone
    // rather than reaching for more blue. Named here so "three selectors" is not read as a gap.
    expect(css).toMatch(/\.btn--commit:focus-visible \{ outline-color: var\(--bone-bright\); \}/);
  });
});

// Spec §6.14 is normative about the locked card's treatment ("grayscale filter, 55% opacity"),
// and it is the only signal that separates the two endings you did not reach from the one you
// did. Text-level, deliberately: the sheet has no selector-coverage net (see the progress
// file's deferred item 14), so this guards the declarations' presence and their values.
describe('endings gallery (spec §6.14)', () => {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const ruleFor = (selector) => {
    const rule = bare.match(new RegExp(`\\${selector}\\s*\\{[^}]*\\}`));
    expect(rule, `no rule for ${selector}`).not.toBeNull();
    return rule[0];
  };

  it('greys out and fades the endings you did not reach', () => {
    const locked = ruleFor('.ending-card--locked');
    expect(locked).toMatch(/filter:\s*grayscale\(0\.8\)/);
    expect(locked).toMatch(/opacity:\s*0\.55/);
  });

  // The card owns its own transform and the slot only names the angle. A screen that overrode
  // `transform` outright would silently drop whatever else the component ever puts in it.
  it('lets the slot pick the tilt through a variable, not by overriding transform', () => {
    expect(ruleFor('.ending-card')).toMatch(/transform:\s*rotate\(var\(--card-tilt/);
    const screens = readFileSync('src/styles/screens.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(screens, 'a screen must not override a component transform')
      .not.toMatch(/\.ending-card\s*\{[^}]*transform:/);
    expect(screens).toMatch(/\.gameover__stamp\s*\{[^}]*--card-tilt:/);
    expect(screens).toMatch(/\.gameover__right\s*\{[^}]*--card-tilt:/);
  });
});

// Spec Law 6: one duration, one source. effects.js schedules the DOM work with a timer while the
// stylesheet fades, drops and shakes on its own clock, so a token edited on one side and not the
// other desynchronises the fade from the removal — silently, and only in a real browser. Read
// out of the token *source*: jsdom cannot resolve an imported custom property through
// getComputedStyle, so a runtime check here would compare two empty strings and always pass.
describe('animation durations (spec Law 6)', () => {
  const tokens = readFileSync('src/styles/tokens.css', 'utf8');
  const components = readFileSync('src/styles/components.css', 'utf8');
  const tokenMs = (name) => {
    const found = tokens.match(new RegExp(`${name}\\s*:\\s*(\\d+(?:\\.\\d+)?)ms`));
    expect(found, `${name} is not defined in tokens.css as a millisecond value`).not.toBeNull();
    return Number(found[1]);
  };

  it('binds each JS constant to the token its CSS counterpart animates on', () => {
    expect(BEAT_MS).toBe(tokenMs('--dur-tally'));
    expect(CHIP_LIFE_MS).toBe(tokenMs('--dur-chip'));
    expect(SHAKE_MS).toBe(tokenMs('--dur-shake'));
  });

  // …and each of those rules must actually reach for the token rather than restating the number,
  // which is how the purse shake came to hold a literal 300ms with nothing tying it to SHAKE_MS.
  it('states no duration literally in the rules those constants drive', () => {
    for (const [selector, token] of [
      ['.delta-chip', '--dur-chip'],
      ['.hud__purse.is-shaking', '--dur-shake'],
    ]) {
      const rule = components.match(new RegExp(`\\${selector}\\s*\\{[^}]*\\}`));
      expect(rule, `no rule for ${selector}`).not.toBeNull();
      expect(rule[0], selector).toContain(`var(${token})`);
      expect(rule[0], selector).not.toMatch(/\d+m?s\b/);
    }
  });
});
