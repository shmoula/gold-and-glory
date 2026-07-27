# Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "Taped to the Arena Wall" design system (spec: `docs/superpowers/specs/2026-07-23-gold-and-glory-design-system.md`) across all four screens of the existing vanilla-JS game.

**Architecture:** CSS is rebuilt as four token-driven files imported by the existing `src/styles.css` entry (legacy rules kept temporarily so the app stays playable at every commit). Screen markup in `src/ui/render.js` is rewritten component-by-component, TDD'd via the existing string-assertion test style. New pure helpers (`formatGold`, `meterZones`) are unit-tested; DOM effects (ledger theater, delta chips) live in a new `src/ui/effects.js` tested with jsdom + fake timers.

**Tech Stack:** Vanilla JS (ES modules), Vite 5, Vitest 2 + jsdom, pure CSS custom properties. No new runtime dependencies.

**Read first:** the spec (path above) — especially §0 Laws, §1 tokens, §6 catalog. The spec is the source of truth for all values; this plan is the order of operations.

**Already done (do not redo):** commit `385e732` fixed the meter to timestamp-based sweep (`meterPosition`, `meterPeriod` in `src/ui/render.js`, `meterPeriodMs` in config, cursor via `transform`).

**Explicitly out of scope (YAGNI):** §6.15 Modal (no current flow opens one), snark asides inside combat-log entries (log entries stay plain strings; rendering supports styling them later), the sandal/chicken/portrait *image assets* (structural slots + fallbacks only — the UI must look complete without them, per spec §10).

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `scripts/fetch-fonts.mjs` | create | One-shot vendoring of the 4 woff2 files |
| `src/assets/fonts/*.woff2` | create (4) | Self-hosted Bangers/Nunito/Patrick Hand |
| `src/styles.css` | rewrite | Entry: `@import` the five sheets, nothing else |
| `src/styles/tokens.css` | create | Spec §1 verbatim + `@font-face` (§2) |
| `src/styles/base.css` | create | Reset, stone page, type defaults, `.snark`/`.tape`/`.amount`, focus, reduced-motion |
| `src/styles/components.css` | create | Spec §6 catalog, appended to task-by-task |
| `src/styles/screens.css` | create | Spec §7 grids + breakpoints |
| `src/styles/legacy.css` | create → delete | Zero-specificity holdover rules for not-yet-rewritten screens; trimmed in Task 8, deleted in Task 9 |
| `tests/styles.test.js` | create | Every `var(--x)` in the sheets resolves to a token |
| `src/ui/format.js` | create | `formatGold` — the only money formatter |
| `src/ui/effects.js` | create | Ticker, delta chips, purse shake, ledger theater |
| `src/ui/render.js` | modify | All screen/component templates; `meterZones` |
| `src/main.js` | modify | Sweet-spot seeding, freeze visuals, keyboard, effects wiring |
| `src/config.js` | modify | `sweetCenter`, snark string tables, ending epitaphs |
| `tests/format.test.js` | create | formatGold |
| `tests/effects.test.js` | create | Theater/ticker with fake timers |
| `tests/render.test.js` | modify | New markup assertions (some existing assertions updated) |

---

### Task 1: Fonts, tokens, base — the ground everything stands on

**Files:**
- Create: `scripts/fetch-fonts.mjs`, `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/components.css` (empty header comment), `src/styles/screens.css` (empty header comment)
- Modify: `src/styles.css`

- [ ] **Step 1: Commit the docs** (spec + this plan + lockfile are untracked)

```bash
git add docs/ package-lock.json
git commit -m "docs: design system spec and implementation plan"
```

- [ ] **Step 2: Create `scripts/fetch-fonts.mjs`**

```js
// scripts/fetch-fonts.mjs — vendor latin woff2 subsets from Google Fonts (all OFL).
// Run once: node scripts/fetch-fonts.mjs
import { mkdir, writeFile } from 'node:fs/promises';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FAMILIES = [
  { spec: 'Bangers', out: { 400: 'Bangers-400.woff2' } },
  { spec: 'Nunito:wght@400;700', out: { 400: 'Nunito-400.woff2', 700: 'Nunito-700.woff2' } },
  { spec: 'Patrick+Hand', out: { 400: 'PatrickHand-400.woff2' } },
];

const get = async (url, init) => {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res;
};

await mkdir('src/assets/fonts', { recursive: true });
const written = [];
for (const { spec, out } of FAMILIES) {
  const css = await (await get(`https://fonts.googleapis.com/css2?family=${spec}&display=swap`, { headers: { 'User-Agent': UA } })).text();
  for (const m of css.matchAll(/\/\* (\w[\w-]*) \*\/\s*@font-face\s*\{([^}]*)\}/g)) {
    if (m[1] !== 'latin') continue;
    const weight = m[2].match(/font-weight:\s*(\d+)/)?.[1];
    const url = m[2].match(/url\((https:\/\/[^)]+\.woff2)\)/)?.[1];
    if (!weight || !url || !out[weight]) continue;
    const buf = Buffer.from(await (await get(url)).arrayBuffer());
    await writeFile(`src/assets/fonts/${out[weight]}`, buf);
    written.push(out[weight]);
    console.log(`fetched ${out[weight]} (${(buf.length / 1024) | 0} KB)`);
  }
}

// Every declared file must land — a silent miss means Google changed the css2 response
// shape (e.g. collapsed 400+700 into one ranged block) and the regex needs updating.
const expected = FAMILIES.flatMap(({ out }) => Object.values(out));
const missing = expected.filter((f) => !written.includes(f));
if (missing.length) throw new Error(`never written: ${missing.join(', ')}`);

// The OFL requires the license travel with redistributed font software, and these
// woff2 files are redistributed in both git and dist/.
const ofl = await (await get('https://openfontlicense.org/documents/OFL.txt')).text();
await writeFile('src/assets/fonts/OFL.txt', ofl);
console.log(`fetched OFL.txt (${(ofl.length / 1024) | 0} KB)`);
```

Add to `package.json` scripts so the script is discoverable and always runs from the repo root
(it uses relative paths): `"fonts": "node scripts/fetch-fonts.mjs"`.

- [ ] **Step 3: Run it**

Run: `node scripts/fetch-fonts.mjs`
Expected: four `fetched … KB` lines; `ls src/assets/fonts` shows 4 files (~105 KB total).

- [ ] **Step 4: Create `src/styles/tokens.css`**

Content = the `@font-face` block from spec **§2** (4 rules, paths `../assets/fonts/…`) followed by the complete `:root { … }` block from spec **§1** — copy both **verbatim** from `docs/superpowers/specs/2026-07-23-gold-and-glory-design-system.md`. Do not retype values.

- [ ] **Step 5: Verify the copy**

```bash
grep -c "^  --" src/styles/tokens.css   # expect ≥ 80 custom properties
grep -n "gold-ink: #7d5714\|moss-ink: #3f6b35\|blood-ink: #9c3226" src/styles/tokens.css  # the 3 contrast-tuned values must be present
grep -c "@font-face" src/styles/tokens.css  # expect 4
```

- [ ] **Step 6: Create `src/styles/base.css`**

```css
/* base.css — reset, materials M1 + M4/M5 shared pieces, typography, a11y */
*, *::before, *::after { box-sizing: border-box; }
body {
  margin: 0;
  background:
    radial-gradient(140% 120% at 50% 100%, rgba(31, 22, 12, 0.38), transparent 60%),
    var(--surface-page);
  color: var(--color-text);
  font: 400 var(--text-md)/var(--leading-body) var(--font-body);
  min-height: 100dvh;
}
#app { min-height: 100dvh; }
h1, h2, h3 { font: 400 var(--text-xl)/var(--leading-display) var(--font-display);
  letter-spacing: 0.03em; margin: 0; }
button { font: inherit; cursor: pointer; }

/* Two-tone focus ring: the blue reads on paper, the bone halo reads on stone and
   wood (blue-on-stone is 1.12:1 — invisible). Spec §8 is ship-blocking, so the
   halo is !important: a component's own box-shadow must never swallow it. */
:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 3px;
  box-shadow: 0 0 0 6px var(--bone-bright) !important; }

.snark { font-family: var(--font-snark); font-size: var(--text-sm);
  font-weight: 400; color: var(--color-text-muted); }
.amount { font-weight: 700; font-variant-numeric: tabular-nums; }
.amount--pos { color: var(--color-income); }
.amount--neg { color: var(--color-expense); }

.tape { position: relative; }
.tape::before, .tape::after { content: ""; position: absolute; width: 64px; height: 20px;
  background: rgba(235, 224, 192, 0.9); border: 1px solid rgba(31, 22, 12, 0.25); top: -10px; }
.tape::before { left: 12%; transform: rotate(-5deg); }
.tape::after { right: 12%; transform: rotate(4deg); }

.wordmark { font-family: var(--font-display); font-size: var(--text-sm);
  letter-spacing: 0.12em; color: var(--color-text-muted); opacity: 0.7; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
  .meter-cursor { transition: none !important; }
}
```

(`animation-iteration-count: 1` is deliberately stronger than spec §5's literal block: without it
the infinite `bar-urgent` / `urgent-pulse` loops from §6.1/§6.2 would keep cycling at 1ms.)

- [ ] **Step 7: Create empty catalog files, the legacy sheet, and rewrite the entry**

`src/styles/components.css` and `src/styles/screens.css` each start as a one-line header comment (`/* components.css — spec §6 catalog */`, `/* screens.css — spec §7 grids */`).

**Every legacy selector is wrapped in `:where(…)`, which zeroes its specificity.** This is load-bearing, not cosmetic: `.hub button` at `(0,1,1)` would otherwise outrank `.btn` at `(0,1,0)` no matter what order the sheets are imported in, and Tasks 3–9 would render plank buttons that still look like the old parchment ones. With `:where()` at `(0,0,0)`, every new component rule wins automatically and the legacy sheet only styles what nothing else claims yet.

`src/styles/legacy.css`:

```css
/* ============================================================
   legacy.css — holdover rules for screens not yet rewritten.
   Every selector is :where()-wrapped so specificity is 0 and any
   real rule in components.css / screens.css beats it.
   Trimmed to .gameover/.cause in Task 8; DELETED in Task 9
   (along with its @import in styles.css).
   ============================================================ */
:where(#app) { max-width: 1180px; margin: 0 auto; padding: var(--space-4); }
:where(button:disabled) { opacity: 0.4; cursor: not-allowed; }
:where(.hud) { display: flex; gap: 16px; flex-wrap: wrap; padding: 8px 0; border-bottom: 1px solid #463829; margin-bottom: 12px; }
:where(.hud .gold) { color: var(--gold); font-weight: 700; }
:where(.hub .row) { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
:where(.hub, .actions, .result, .gameover) :where(button) { background: var(--paper-3); color: var(--ink); border: 1px solid #5a4632; border-radius: 6px; padding: 8px 12px; }
:where(.sponsor) { color: var(--gold-ink); }
:where(.combatants) { display: flex; justify-content: space-between; font-size: 1.2rem; margin: 16px 0; }
:where(.timing-meter) { position: relative; height: 28px; background: var(--track); border: 1px solid #5a4632; border-radius: 6px; margin: 12px 0; cursor: crosshair; }
:where(.meter-sweet) { position: absolute; top: 0; bottom: 0; width: 14%; transform: translateX(-50%); background: rgba(90,138,74,0.5); }
:where(.meter-cursor) { position: absolute; top: 0; bottom: 0; width: 3px; background: var(--gold); }
:where(.actions) { display: flex; gap: 8px; }
:where(.press) { background: var(--blood); color: #fff; margin-top: 8px; }
:where(.log) { font-size: 0.85rem; color: var(--ink-soft); list-style: none; padding: 0; }
:where(.result.good) { border-left: 4px solid var(--moss); padding-left: 12px; }
:where(.result.danger) { border-left: 4px solid var(--blood); padding-left: 12px; }
:where(.result .cause, .gameover .cause) { font-style: italic; color: var(--blood-ink); }
:where(.gameover) { text-align: center; padding: 32px 0; }
```

Note the `#app` max-width: **1180px, not the old 720px.** Spec §7 builds `230px 1fr 300px` desktop grids inside `#app`; a 720px ancestor cap would squeeze every new screen in Tasks 5–7 while the `≤900px` breakpoint (viewport-based, not container-based) never fires to rescue it. 1180px matches `.screen`'s own max-width, so the two agree and the eventual deletion is a no-op.

Replace `src/styles.css` with:

```css
/* Entry point — index.html links this file. Order matters. */
@import './styles/tokens.css';
@import './styles/base.css';
@import './styles/components.css';
@import './styles/screens.css';
@import './styles/legacy.css';
```

(Note: legacy rules already reference the new tokens — the old dark palette is gone from this commit onward.)

- [ ] **Step 7b: Add `tests/styles.test.js` — the typo guard**

Nine more tasks append token-heavy CSS to these sheets, and a misspelled custom property
(`var(--color-expence)`) throws no error anywhere — it just silently resolves to nothing, which is
exactly the failure class that survives both code review and visual smoke. One cheap test guards
every remaining commit:

```js
// tests/styles.test.js — every var(--x) the sheets use must be a token they define.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

const SHEETS = ['src/styles.css', ...readdirSync('src/styles').map((f) => `src/styles/${f}`)];
const css = SHEETS.map((f) => readFileSync(f, 'utf8')).join('\n');

describe('css custom properties', () => {
  it('references only tokens that are defined', () => {
    const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
    expect([...used].filter((t) => !defined.has(t))).toEqual([]);
  });
});
```

- [ ] **Step 8: Verify suite and build still green**

Run: `npx vitest run` → all existing tests PASS (93 + the new styles test).
Run: `npm run build` → build succeeds; output CSS bundle contains `Bangers` (grep `dist/assets/*.css`).

- [ ] **Step 9: Visual smoke**

Run: `npm run dev`, open the game. Expected: stone-brown page, parchment-ish legacy panels, playable end-to-end. Fonts won't show yet (no component uses them besides h2) — that's fine.

- [ ] **Step 10: Commit**

```bash
git add scripts/fetch-fonts.mjs src/assets/fonts src/styles.css src/styles
git commit -m "feat(ui): vendor fonts, add design tokens, base styles, and CSS entry structure"
```

---

### Task 2: `formatGold` — the only money formatter

**Files:**
- Create: `src/ui/format.js`, `tests/format.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// tests/format.test.js
import { describe, it, expect } from 'vitest';
import { formatGold } from '../src/ui/format.js';

describe('formatGold', () => {
  it('formats with thousands separators and the G unit', () => {
    expect(formatGold(2450)).toBe('2,450\u00A0G');
    expect(formatGold(0)).toBe('0\u00A0G');
    expect(formatGold(1234567)).toBe('1,234,567\u00A0G');
  });

  it('signed mode uses + and U+2212 minus', () => {
    expect(formatGold(600, { signed: true })).toBe('+600\u00A0G');
    expect(formatGold(-90, { signed: true })).toBe('−90\u00A0G');
    expect(formatGold(0, { signed: true })).toBe('0\u00A0G');
  });

  it('unsigned mode renders negatives with U+2212 too', () => {
    expect(formatGold(-40)).toBe('−40\u00A0G');
  });

  // Both glyphs spec 2 mandates are invisible or near-invisible in an editor, so pin
  // them by codepoint - an assertion against a pasted character cannot catch a swap.
  it('pins the two significant codepoints', () => {
    expect([...formatGold(5)].map((c) => c.codePointAt(0))).toContain(0x00a0); // NBSP, not U+0020
    expect(formatGold(-5).codePointAt(0)).toBe(0x2212);                        // minus, not U+002D
  });
});
```

> **Invisible-character warning.** The separator before `G` is U+00A0 NON-BREAKING SPACE, written
> throughout this plan as the escape `\u00A0` **deliberately**. Write the escape, never a literal
> character: a literal NBSP copied through a chat prompt, terminal, or clipboard silently
> normalises to a plain space, and since the test and the implementation would both be wrong the
> suite goes green anyway. This is not hypothetical - it happened on the first attempt at this
> task. The codepoint test above is what actually guarantees both glyphs.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/format.test.js`
Expected: FAIL — `Cannot find module '../src/ui/format.js'`

- [ ] **Step 3: Implement**

```js
// src/ui/format.js — every gold amount in the UI goes through this. (Spec §2)
export function formatGold(n, { signed = false } = {}) {
  const abs = Math.abs(n).toLocaleString('en-US');
  const sign = n < 0 ? '−' : (signed && n > 0 ? '+' : '');
  return `${sign}${abs}\u00A0G`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/format.test.js` → PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/format.js tests/format.test.js
git commit -m "feat(ui): formatGold money formatter (tabular-ready, U+2212 negatives)"
```

---

### Task 3: HUD beam — purse, bars, injury pips

**Files:**
- Modify: `src/ui/render.js` (replace `renderHud`), `tests/render.test.js` (extend `renderHud` block)
- Modify: `src/styles/components.css` (append)

Existing tests assert `toContain('Health')` / `toContain('Durability')` — keep those exact
label strings in markup; uppercase comes from CSS `text-transform`, so old tests stay green.

- [ ] **Step 1: Add failing tests** (append inside `describe('renderHud')` in `tests/render.test.js`)

```js
  it('renders bars with fill widths and injury pips', () => {
    const s = createGameState(1, CONFIG);
    s.health = 65; s.injuries = 3; s.weaponDurability = 15;
    const html = renderHud(s, CONFIG);
    expect(html).toContain('class="hud"');
    expect(html).toContain('width:65%');                       // health fill
    expect(html).toContain('width:50%');                       // durability 15/30
    expect((html.match(/pip pip--filled/g) || []).length).toBe(3);
    expect((html.match(/class="pip[" ]/g) || []).length).toBe(5); // 5 slots at 3 injuries
    expect(html).toContain('65/100');
  });

  it('marks the health bar urgent below a third', () => {
    const s = createGameState(1, CONFIG);
    s.health = 30;
    expect(renderHud(s, CONFIG)).toContain('is-urgent');
  });

  it('formats gold through formatGold', () => {
    const s = createGameState(1, CONFIG);
    s.gold = 2450;
    expect(renderHud(s, CONFIG)).toContain('2,450\u00A0G');
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/render.test.js` → 3 new FAIL, old PASS.

- [ ] **Step 3: Replace `renderHud` in `src/ui/render.js`**

Add import at top: `import { formatGold } from './format.js';`

```js
function bar(label, value, max, { fillClass = '', urgent = false } = {}) {
  const pct = Math.max(0, Math.round((value / max) * 100));
  return `<span class="hud__stat"><span class="hud__label">${label}</span>
    <span class="bar${urgent ? ' is-urgent' : ''}" role="meter" aria-label="${label}"
      aria-valuenow="${Math.max(0, value)}" aria-valuemin="0" aria-valuemax="${max}">
      <span class="bar__fill${fillClass}" style="width:${pct}%"></span>
      <span class="bar__num">${Math.max(0, value)}/${max}</span>
    </span></span>`;
}

export function renderHud(state, config) {
  const pipCount = Math.max(5, state.injuries);
  const pips = Array.from({ length: pipCount }, (_, i) =>
    `<i class="pip${i < state.injuries ? ' pip--filled' : ''}"></i>`).join('');
  return `
    <header class="hud">
      <span class="hud__purse"><i class="coin"></i>Gold: <span class="ticker" data-gold="${state.gold}">${formatGold(state.gold)}</span></span>
      ${bar('Health', state.health, state.maxHealth, { urgent: state.health / state.maxHealth < 0.33 })}
      ${bar('Durability', state.weaponDurability, config.weapon.maxDurability, { fillClass: ' bar__fill--dur' })}
      <span class="hud__stat"><span class="hud__label">Injuries</span>
        <span class="pips" role="img" aria-label="${state.injuries} injuries">${pips}</span></span>
    </header>`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run` → all PASS (the whole suite, not just render — `renderHub` etc. embed the HUD).

- [ ] **Step 5: Append HUD CSS to `src/styles/components.css`**

Copy the complete `.hud` / `.coin` / `.bar` / `.pip` block from spec **§6.1** verbatim, then add:

```css
.hud__label { letter-spacing: 0.06em; text-transform: uppercase; }
.hud__stat { display: inline-flex; align-items: center; gap: var(--space-2); }
.hud__purse .ticker { font-variant-numeric: tabular-nums; }
.bar.is-urgent .bar__fill { animation: bar-urgent 900ms var(--ease-drop) infinite; }
@keyframes bar-urgent { 50% { opacity: 0.55; } }
```

- [ ] **Step 6: Visual smoke + commit**

`npm run dev` — HUD is now a wooden beam with bars and pips on every screen.

```bash
git add src/ui/render.js tests/render.test.js src/styles/components.css
git commit -m "feat(ui): HUD beam with stat bars, injury pips, and formatted purse"
```

---

### Task 4: Button system + snark tables in config

**Files:**
- Modify: `src/config.js` (add `snark` table), `src/ui/render.js` (replace `btn` helper), `tests/render.test.js`, `src/styles/components.css` (append)

Behavior change (spec §6.2): unaffordable buttons are **no longer `disabled`** — they render
`.is-unaffordable`, stay clickable, and the click is rejected (purse shake wired in Task 7).
True no-ops (nothing to repair/heal, already bribed, owned gear) stay `disabled`/`aria-disabled`.

- [ ] **Step 1: Update + add tests**

In `tests/render.test.js`, **replace** the existing `'disables unaffordable buttons'` test with:

```js
  it('marks unaffordable buttons instead of disabling them', () => {
    const s = createGameState(1, CONFIG);
    s.gold = 0;
    const html = renderHub(s, CONFIG);
    expect(html).toContain('is-unaffordable');
    expect(html).toContain('data-missing=');
  });

  it('puts prices in the price slot, not in parentheses', () => {
    const s = createGameState(1, CONFIG);
    const html = renderHub(s, CONFIG);
    expect(html).toContain('btn__price');
    expect(html).not.toMatch(/\(\d+g\)/);
  });

  it('flags urgent sinks from state thresholds', () => {
    const s = createGameState(1, CONFIG);
    s.weaponDurability = 10; // < 50% of 30
    s.injuries = 2;
    const html = renderHub(s, CONFIG);
    expect((html.match(/is-urgent/g) || []).length).toBeGreaterThanOrEqual(2);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/render.test.js` → new tests FAIL.

- [ ] **Step 3: Add the snark table to `src/config.js`** (before `deathRecaps`)

```js
  snark: {
    repair: 'It barely works',
    heal: 'We have leeches!',
    bribe: 'A donation, officially',
    charm: 'A sock?',
    blade: 'Slightly less blunt',
    shield: 'A big plate. For hiding',
    sponsorReward: 'He loves losers',
    taunt: "Time your hit! (Or don't!)",
  },
```

- [ ] **Step 4: Replace the `btn` helper in `src/ui/render.js`**

```js
// Commerce button per spec §6.2: [label] [price slot] [snark slot?]
// variant: '' (plank) | 'commit' | 'danger'
function btn(action, label, { cost = null, gold = 0, variant = '', snark = '',
  urgent = false, disabled = false } = {}) {
  const classes = ['btn'];
  if (variant) classes.push(`btn--${variant}`);
  if (urgent) classes.push('is-urgent');
  let attrs = '';
  const unaffordable = cost != null && !canAfford(gold, cost);
  if (unaffordable) {
    classes.push('is-unaffordable');
    attrs += ` data-missing="${escapeHtml(formatGold(cost - gold))}"`;
  }
  if (disabled) attrs += ' disabled';
  const price = cost != null ? `<span class="btn__price">${formatGold(cost)}</span>` : '';
  const aside = snark ? `<span class="btn__snark snark">(${escapeHtml(snark)})</span>` : '';
  return `<button data-action="${action}" class="${classes.join(' ')}"${attrs}>` +
    `${escapeHtml(label)}${price}${aside}</button>`;
}
```

Keep the old `btn(action, label, cost, gold, extra)` call sites compiling by updating them in
this same step — `renderHub`'s full rewrite happens in Task 5; for now convert existing calls
mechanically, e.g.:

```js
    return btn(`train-${stat}`, `Train ${stat} → ${eff[stat]}`, { cost, gold: state.gold });
    // repair:
    ${btn('repair', 'Repair weapon', { cost: repairCost(missing, config), gold: state.gold,
      snark: config.snark.repair, urgent: state.weaponDurability / config.weapon.maxDurability < 0.5,
      disabled: missing <= 0 })}
    // heal:
    ${btn('heal', `Heal ${state.injuries} injuries`, { cost: healCost(state.injuries, config),
      gold: state.gold, snark: config.snark.heal, urgent: state.injuries >= 1,
      disabled: state.injuries === 0 })}
    // bribe (tax preview is mechanics → in the label, not the snark slot):
    ${state.bribedThisFight ? '<button class="btn" disabled>Bribed ✓</button>'
      : btn('bribe', `Bribe official — tax ${config.arena.taxRate * 100}% → ${config.arena.bribedTaxRate * 100}%`,
          { cost: config.arena.bribeCost, gold: state.gold, snark: config.snark.bribe })}
    // gear (owned state gets structure, not just disabling — full card comes in Task 5):
    if (state.gear.includes(g.id)) return `<button class="btn is-owned" aria-disabled="true">✓ ${escapeHtml(g.name)} — OWNED</button>`;
    return btn(`buy-${g.id}`, g.name, { cost: g.cost, gold: state.gold, snark: config.snark[g.id] ?? '' });
    // next-fight / retire become commit variants:
    ${btn('next-fight', 'Next Fight ▸', { variant: 'commit' })}
    ${btn('retire', `Retire Rich`, { cost: null, variant: 'commit' })}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run` → all PASS (including updated assertions).

- [ ] **Step 6: Append button CSS to `src/styles/components.css`**

Copy the complete `.btn` block from spec **§6.2** verbatim (base, `--commit`, `--danger`,
`is-disabled`, `is-unaffordable`, `is-urgent`, `@keyframes urgent-pulse`), plus:

```css
.btn.is-owned { opacity: 0.6; cursor: default; box-shadow: none; }
.btn.is-owned:hover { background: var(--grad-wood); }
```

- [ ] **Step 7: Visual smoke + commit**

`npm run dev` — hub buttons are wooden planks with gold prices; Next Fight is a blue banner in Bangers.

```bash
git add src/config.js src/ui/render.js tests/render.test.js src/styles/components.css
git commit -m "feat(ui): button system with price slots, snark asides, and state triad"
```

---

### Task 5: Hub screen — posters, cards, layout grid

**Files:**
- Modify: `src/ui/render.js` (add `poster` helper, rewrite `renderHub`), `tests/render.test.js`
- Modify: `src/styles/components.css`, `src/styles/screens.css` (append)

- [ ] **Step 1: Add failing tests**

```js
describe('renderHub layout', () => {
  it('renders the screen grid with sinks, development, and fight areas', () => {
    const s = createGameState(1, CONFIG);
    const html = renderHub(s, CONFIG);
    expect(html).toContain('screen--hub');
    expect(html).toContain('hub__sinks');
    expect(html).toContain('hub__develop');
    expect(html).toContain('hub__fight');
  });

  it('names the next opponent exactly once', () => {
    const s = createGameState(1, CONFIG);
    const html = renderHub(s, CONFIG);
    expect((html.match(/The Brute/g) || []).length).toBe(1);
  });

  it('shows the sponsor card only when unlocked', () => {
    const s = createGameState(1, CONFIG);
    expect(renderHub(s, CONFIG)).not.toContain('sponsor-card');
    s.sponsorUnlocked = true;
    expect(renderHub(s, CONFIG)).toContain('sponsor-card');
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/render.test.js`

- [ ] **Step 3: Add the `poster` helper to `src/ui/render.js`**

```js
// Wanted poster (spec §6.5). hp: {value, max} | null. tilt: 1|2|3.
export function poster({ name, sub = '', snark = '', hp = null, tilt = 1 }) {
  const hpBar = hp ? `<span class="bar" role="meter" aria-label="${escapeHtml(name)} health"
      aria-valuenow="${Math.max(0, hp.value)}" aria-valuemax="${hp.max}">
      <span class="bar__fill" style="width:${Math.max(0, Math.round((hp.value / hp.max) * 100))}%"></span>
      <span class="bar__num">${Math.max(0, hp.value)}/${hp.max}</span></span>` : '';
  return `<article class="poster tape poster--tilt-${tilt}">
    <h3 class="poster__name">${escapeHtml(name)}</h3>
    <div class="poster__portrait" aria-hidden="true"><span class="poster__silhouette"></span></div>
    ${hpBar}
    ${sub ? `<p class="poster__sub">${sub}</p>` : ''}
    ${snark ? `<span class="snark">(${escapeHtml(snark)})</span>` : ''}
  </article>`;
}
```

- [ ] **Step 4: Rewrite `renderHub`**

```js
export function renderHub(state, config) {
  const eff = effectiveStats(state, config);
  const missing = config.weapon.maxDurability - state.weaponDurability;
  const opponent = config.opponents[state.currentOpponentIndex];

  const trainRows = ['power', 'guard', 'speed'].map((stat) => {
    const cost = trainingCost(state.trainingLevels[stat], config);
    const cap = 50; // display cap for the meter only; stats are uncapped
    return `<div class="train-row">
      <span class="train-row__label">${stat[0].toUpperCase() + stat.slice(1)} ${eff[stat]}</span>
      <span class="bar train-row__meter"><span class="bar__fill bar__fill--dur"
        style="width:${Math.min(100, Math.round((eff[stat] / cap) * 100))}%"></span></span>
      ${btn(`train-${stat}`, `Train +${config.training.statPerLevel}`, { cost, gold: state.gold })}
    </div>`;
  }).join('');

  const gearCards = Object.values(config.gear).map((g) => {
    if (state.gear.includes(g.id)) {
      return `<div class="shop-item is-owned" aria-disabled="true">
        <span class="shop-item__name">${escapeHtml(g.name)}</span>
        <span class="shop-item__owned">✓ Owned</span></div>`;
    }
    const unaffordable = !canAfford(state.gold, g.cost);
    return `<button data-action="buy-${g.id}" class="shop-item${unaffordable ? ' is-unaffordable' : ''}"
      ${unaffordable ? ` data-missing="${escapeHtml(formatGold(g.cost - state.gold))}"` : ''}>
      <span class="shop-item__name">${escapeHtml(g.name)}</span>
      <span class="btn__price">${formatGold(g.cost)}</span>
      <span class="snark">(${escapeHtml(config.snark[g.id] ?? '')})</span></button>`;
  }).join('');

  const sponsorCard = state.sponsorUnlocked ? `<aside class="sponsor-card tape">
      <span class="sponsor-card__eyebrow">Sponsor</span>
      <h3 class="sponsor-card__name">Lord Biggus</h3>
      <p>Objective: ${escapeHtml(config.sponsor.objective)}</p>
      <p>Reward: <span class="amount amount--pos">${formatGold(config.sponsor.stipendPerFight + config.sponsor.objectiveBonus, { signed: true })}</span>
        <span class="snark">(${escapeHtml(config.snark.sponsorReward)})</span></p>
    </aside>` : '';

  return `
    ${renderHud(state, config)}
    <section class="screen screen--hub">
      <div class="hub__sinks">
        <h2>The Ludus</h2>
        <p>Wins: ${state.wins}</p>
        ${btn('repair', 'Repair weapon', { cost: repairCost(missing, config), gold: state.gold,
          snark: config.snark.repair,
          urgent: state.weaponDurability / config.weapon.maxDurability < 0.5,
          disabled: missing <= 0 })}
        ${btn('heal', `Heal ${state.injuries} injuries`, { cost: healCost(state.injuries, config),
          gold: state.gold, snark: config.snark.heal, urgent: state.injuries >= 1,
          disabled: state.injuries === 0 })}
        ${state.bribedThisFight ? '<button class="btn" disabled>Bribed ✓</button>'
          : btn('bribe', `Bribe official — tax ${config.arena.taxRate * 100}% → ${config.arena.bribedTaxRate * 100}%`,
              { cost: config.arena.bribeCost, gold: state.gold, snark: config.snark.bribe })}
      </div>
      <div class="hub__develop">
        <h2>Training</h2>
        ${trainRows}
        <h2>Gear shop</h2>
        <div class="hub__shop">${gearCards}</div>
        ${sponsorCard}
      </div>
      <div class="hub__fight">
        <span class="hub__next-label">Next bout</span>
        ${poster({ name: opponent.name, tilt: 2,
          sub: `Tier: ${escapeHtml(opponent.tier)} · Purse: <span class="amount">${formatGold(opponent.purse)}</span>` })}
      </div>
      <div class="hub__retire">${btn('retire', 'Retire Rich', { variant: 'commit' })}</div>
      <div class="hub__commit commit-bar">${btn('next-fight', 'Next Fight ▸', { variant: 'commit' })}</div>
    </section>`;
}
```

(Existing tests keep passing: `Train`, `Repair`, `Heal`, `Bribe`, `data-action="next-fight"`,
`The Brute` all still present — the opponent name now appears exactly once.)

- [ ] **Step 5: Run to verify pass** — `npx vitest run` → all PASS.

- [ ] **Step 6: Append CSS**

To `components.css`, copy spec §6.5 poster CSS pattern and add the hub cards:

```css
.poster { background: var(--grad-paper); border: var(--border-w) solid var(--border-ink);
  border-radius: var(--wobble-1); padding: var(--space-4); box-shadow: var(--shadow-paper); }
.poster--tilt-1 { transform: rotate(var(--tilt-1)); }
.poster--tilt-2 { transform: rotate(var(--tilt-2)); }
.poster--tilt-3 { transform: rotate(var(--tilt-3)); }
.poster__name { font-size: var(--text-2xl); text-align: center; margin-bottom: var(--space-3); }
.poster__portrait { position: relative; height: 104px; margin: 0 var(--space-1);
  background: radial-gradient(circle at 50% 42%, var(--paper-4), #c9b384);
  border: 2px solid var(--border-ink); border-radius: 10px 13px 11px 14px; overflow: hidden; }
.poster__silhouette { position: absolute; left: 50%; top: 30px; width: 54px; height: 60px;
  transform: translateX(-50%); background: #443019; border-radius: 46% 46% 40% 40%; }
.poster__sub { font-size: var(--text-sm); font-weight: 700; text-align: center;
  margin: var(--space-2) 0 0; }
.poster .bar { width: 100%; margin-top: var(--space-2); }
.poster .snark { display: block; text-align: center; }

.train-row { display: grid; grid-template-columns: 90px 1fr auto; align-items: center;
  gap: var(--space-3); margin: var(--space-2) 0; }
.train-row__label { font-weight: 700; font-size: var(--text-sm); }
.train-row__meter { width: 100%; }

.hub__shop { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
.shop-item { display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
  background: var(--grad-paper); border: var(--border-w) solid var(--border-ink);
  border-radius: var(--wobble-3); padding: var(--space-3); text-align: left;
  box-shadow: var(--shadow-paper); font: inherit; }
.shop-item:not(.is-owned):hover { transform: translateY(-2px); }
.shop-item__name { font-weight: 700; }
.shop-item.is-unaffordable .btn__price { color: var(--blood-hi); }
.shop-item.is-owned { opacity: 0.6; filter: grayscale(0.6); box-shadow: none; }
.shop-item__owned { font-weight: 700; color: var(--color-text-muted); }

.sponsor-card { background: var(--grad-paper); border: var(--border-w) solid var(--border-ink);
  border-radius: var(--wobble-2); padding: var(--space-3) var(--space-4);
  box-shadow: var(--shadow-paper); transform: rotate(var(--tilt-3)); margin-top: var(--space-4); }
.sponsor-card__eyebrow { font-size: var(--text-xs); font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-text-muted); }
.sponsor-card__name { font-size: var(--text-xl); }
.hub__next-label { font-family: var(--font-display); font-size: var(--text-lg);
  letter-spacing: 0.05em; color: var(--bone); text-shadow: 0 1.5px 0 rgba(31,22,12,0.8); }
```

To `screens.css`, copy the `.screen` base + `.screen--hub` grid from spec **§7** verbatim,
mapping areas to classes:

```css
.hub__sinks { grid-area: sinks; } .hub__develop { grid-area: develop; }
.hub__fight { grid-area: fight; } .hub__retire { grid-area: retire; }
.hub__commit { grid-area: commit; justify-self: end; }
```

Also add the two `@media` blocks from spec §7 now (hub rules only; fight/result rules join in
their tasks).

- [ ] **Step 7: Visual smoke + commit**

`npm run dev` — hub is the three-column layout: sinks left, training/shop center, wanted poster right, blue commits bottom.

```bash
git add src/ui/render.js tests/render.test.js src/styles/components.css src/styles/screens.css
git commit -m "feat(ui): hub screen with sink rail, training rows, shop cards, and wanted poster"
```

---

### Task 6: Timing meter — zones, per-turn sweet spot, freeze, keyboard

**Files:**
- Modify: `src/config.js` (add `sweetCenter`), `src/ui/render.js` (add `meterZones`, rewrite meter markup in `renderFight` — full fight rewrite is Task 7; this task touches only the meter block), `src/main.js`, `tests/render.test.js`
- Modify: `src/styles/components.css`

- [ ] **Step 1: Write failing tests for `meterZones`**

```js
import { meterZones } from '../src/ui/render.js'; // add to existing import

describe('meterZones', () => {
  const zones = meterZones(0.5, 0.18, CONFIG); // center, width, config
  it('nests crit inside hit inside graze around the center', () => {
    expect(zones.crit.start).toBeCloseTo(0.5 - 0.18 * 0.3);
    expect(zones.crit.size).toBeCloseTo(2 * 0.18 * 0.3);
    expect(zones.hit.start).toBeCloseTo(0.5 - 0.18 * 1.0);
    expect(zones.graze.size).toBeCloseTo(2 * 0.18 * 1.6);
  });
  it('clamps zones to the track', () => {
    const edge = meterZones(0.05, 0.18, CONFIG);
    expect(edge.graze.start).toBe(0);
    expect(edge.graze.start + edge.graze.size).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/render.test.js`

- [ ] **Step 3: Implement `meterZones` + new meter markup in `src/ui/render.js`**

```js
// Zone edges for the meter, matching resolveTiming's nested-window logic (spec §6.4).
export function meterZones(center, windowWidth, config) {
  const r = config.combat.timingTierRatios;
  const zone = (mult) => {
    const start = Math.max(0, center - windowWidth * mult);
    const end = Math.min(1, center + windowWidth * mult);
    return { start, size: end - start };
  };
  return { crit: zone(r.crit), hit: zone(r.hit), graze: zone(r.graze) };
}
```

In `renderFight`, replace the `timing-meter` div with (leave the rest of the template alone
for now — the fight template also needs `state` fields already in scope):

```js
  const eff = effectiveStats(state, config);
  const width = timingWindowWidth(eff.speed, config); // add: import { timingWindowWidth } from '../combat.js';
  const zones = meterZones(state.combat.sweet ?? 0.5, width, config);
  const pct = (x) => `${(x * 100).toFixed(2)}%`;
  const meterHtml = `
    <div class="meter" data-meter="1" role="application"
      aria-label="Timing meter — press Space or click to strike">
      <div class="meter__zone meter__zone--graze" style="left:${pct(zones.graze.start)};width:${pct(zones.graze.size)}"></div>
      <div class="meter__zone meter__zone--hit" style="left:${pct(zones.hit.start)};width:${pct(zones.hit.size)}"></div>
      <div class="meter__zone meter__zone--crit" style="left:${pct(zones.crit.start)};width:${pct(zones.crit.size)}"></div>
      <div class="meter-cursor"></div>
    </div>
    <div class="meter__labels"><span>Miss</span><span>Graze</span><span>Hit</span><span>Crit</span><span>Graze</span><span>Miss</span></div>
    ${state.wins === 0 ? `<p class="meter__taunt snark">${escapeHtml(config.snark.taunt)}</p>` : ''}`;
```

(Keep the old `timing-meter` class on the wrapper too — `class="meter timing-meter"` — until
Task 7 updates the fight test that asserts `class="timing-meter"`, then drop it. Note this
explicitly so it isn't forgotten: **Task 7 Step 1 updates that assertion and Step 3 removes
the legacy class.**)

- [ ] **Step 4: Add `sweetCenter` to `src/config.js`** (inside `combat`)

```js
    sweetCenter: { min: 0.35, max: 0.75 }, // sweet spot seeded per player turn
```

- [ ] **Step 5: Seed the sweet spot + freeze + keyboard in `src/main.js`**

In `startFight` handler flow the sweet spot must live in combat state so `renderFight` can
read it. Change the `'next-fight'` handler and `enemyResponds`/`doPlayerAction` re-renders to
seed before each player turn:

```js
function seedSweet() {
  const { min, max } = CONFIG.combat.sweetCenter;
  return min + rng() * (max - min); // rng is the seeded generator — runs stay deterministic
}
// in the 'next-fight' handler:
'next-fight': () => { state = startFight(state, CONFIG); state.combat = { ...state.combat, sweet: seedSweet() }; render(); },
// at the top of enemyResponds(), after enemyTurn(...):
state = { ...state, combat: { ...combat, sweet: seedSweet() } };
```

In `startMeter()`: replace `meter.sweet = 0.5;` with `meter.sweet = state.combat.sweet ?? 0.5;`
and delete the `.meter-sweet` positioning line (zones are rendered now). Update the freeze:

```js
function captureMeter() {
  if (!meter.running) return;
  meter.running = false;
  cancelAnimationFrame(meter.raf);
  meter.captured = meter.pos;
  const bar = app.querySelector('[data-meter]');
  if (bar) bar.classList.add('is-captured'); // cursor stays put — the freeze IS the feedback
}
```

Add keyboard support (once, next to `wire(app, handlers)`):

```js
const KEYS = { ' ': 'meter', 1: 'strike', 2: 'heavy', 3: 'block', 4: 'feint' };
document.addEventListener('keydown', (e) => {
  if (state.phase !== PHASE.FIGHT || e.repeat) return;
  const k = KEYS[e.key];
  if (!k) return;
  e.preventDefault();
  if (k === 'meter') captureMeter();
  else handlers[k]?.();
});
```

- [ ] **Step 6: Run the suite** — `npx vitest run` → all PASS.

- [ ] **Step 7: Append meter CSS to `src/styles/components.css`**

Copy the `.meter` block from spec **§6.4** verbatim (track, zones, gold-ramp colors, crit
notches + glow, cursor), then add:

```css
.meter.is-captured .meter-cursor { background: var(--blood); width: 4px; }
.meter__labels { display: flex; justify-content: space-between;
  font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--bone); text-shadow: 0 1px 0 rgba(31,22,12,0.8);
  padding: 2px var(--space-1) 0; }
.meter__taunt { text-align: center; font-size: var(--text-md); color: var(--bone);
  text-shadow: 0 1px 0 rgba(31,22,12,0.8); }
```

(The chicken cursor is a content asset — the ink cursor line is the specced fallback and ships
now; when `chicken.svg` exists, add `<img class="meter-chicken" src="…" alt="">` inside
`.meter-cursor` with the CSS from spec §6.4. Track this as a follow-up, not part of this plan.)

- [ ] **Step 8: Manual verification**

`npm run dev` → start a fight. Verify: gold zones visible with the bright crit band; sweet
spot moves between turns; Space captures; cursor freezes red where captured; 1–4 fire actions;
zone widths visibly grow after training Speed (train, then fight again).

- [ ] **Step 9: Commit**

```bash
git add src/config.js src/ui/render.js src/main.js tests/render.test.js src/styles/components.css
git commit -m "feat(ui): meter zones, seeded sweet spot, freeze-on-capture, keyboard controls"
```

---

### Task 7: Fight screen layout + combat log

**Files:**
- Modify: `src/ui/render.js` (rewrite `renderFight` around the Task-6 meter block), `tests/render.test.js`
- Modify: `src/styles/components.css`, `src/styles/screens.css`

- [ ] **Step 1: Update tests**

In the existing `renderFight` test, change `expect(html).toContain('class="timing-meter"')` to
`expect(html).toContain('data-meter')`. Add:

```js
  it('renders posters for both fighters and turn-numbered log entries', () => {
    const s = startFight(createGameState(1, CONFIG), CONFIG);
    s.combat.log = ['You strike (hit) for 13 damage.', 'The Brute hits back.'];
    const html = renderFight(s, CONFIG);
    expect((html.match(/class="poster tape/g) || []).length).toBe(2);
    expect(html).toContain('log__turn');
    expect(html).toContain('screen--fight');
  });

  it('renders Press the Attack as a commit banner only when pressable', () => {
    const s = startFight(createGameState(1, CONFIG), CONFIG);
    expect(renderFight(s, CONFIG)).not.toContain('data-action="press"');
    s.combat.canPress = true;
    const html = renderFight(s, CONFIG);
    expect(html).toContain('data-action="press"');
    expect(html).toContain('btn--commit');
  });
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/render.test.js`

- [ ] **Step 3: Rewrite `renderFight`**

```js
export function renderFight(state, config) {
  const c = state.combat;
  const logHtml = c.log.slice(-8).map((l, i, arr) => {
    const turn = c.log.length - arr.length + i + 1;
    return `<li class="log__entry"><span class="log__turn">T${turn}</span> ${escapeHtml(l)}</li>`;
  }).join('');
  // … meterHtml exactly as built in Task 6 (drop the legacy `timing-meter` class now) …
  return `
    ${renderHud(state, config)}
    <section class="screen screen--fight">
      <div class="fight__you">${poster({ name: 'You', tilt: 1,
        hp: { value: c.player.health, max: c.player.maxHealth } })}</div>
      <div class="fight__stage">${meterHtml}</div>
      <div class="fight__foe">${poster({ name: c.enemy.name, tilt: 2,
        hp: { value: c.enemy.health, max: c.enemy.maxHealth } })}</div>
      <div class="fight__log"><h2>Commentary</h2><ul class="log" aria-live="polite">${logHtml}</ul></div>
      <div class="fight__actions">
        ${c.canPress ? btn('press', 'Press the Attack ▸', { variant: 'commit' }) : ''}
        <div class="fight__grid">
          ${btn('strike', 'Strike')}
          ${btn('heavy', 'Heavy')}
          ${btn('block', 'Block')}
          ${btn('feint', 'Feint')}
        </div>
      </div>
    </section>`;
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run` → all PASS.

- [ ] **Step 5: Append CSS**

`components.css`:

```css
.log { list-style: none; margin: 0; padding: var(--space-3);
  background: var(--grad-paper); border: var(--border-w) solid var(--border-ink);
  border-radius: var(--wobble-2); box-shadow: var(--shadow-paper);
  max-height: 160px; overflow-y: auto; font-size: var(--text-sm); }
.log__entry { padding: 2px 0; border-bottom: 1.5px dashed rgba(47, 35, 24, 0.25); }
.log__entry:last-child { border-bottom: none; }
.log__turn { font-weight: 700; color: var(--color-text-muted); font-variant-numeric: tabular-nums;
  margin-right: var(--space-1); }
.fight__grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
.fight__actions { display: flex; flex-direction: column; gap: var(--space-3); align-items: stretch; }
```

`screens.css`: copy `.screen--fight` grid from spec **§7** verbatim, plus:

```css
.fight__you { grid-area: you; } .fight__stage { grid-area: stage; align-self: center; }
.fight__foe { grid-area: foe; } .fight__log { grid-area: log; }
.fight__actions { grid-area: actions; }
```

and the fight rules inside the existing `@media (max-width: 900px)` block.

- [ ] **Step 6: Manual verification + commit**

`npm run dev` — fight: posters flank the center meter, log bottom-left parchment, actions 2×2
bottom-right, Press the Attack appears as a blue banner after a landed hit.

```bash
git add src/ui/render.js tests/render.test.js src/styles/components.css src/styles/screens.css
git commit -m "feat(ui): fight screen layout with flanking posters, parchment log, action grid"
```

---

### Task 8: Result screen — ledger, theater, delta chips, purse ticker

**Files:**
- Create: `src/ui/effects.js`, `tests/effects.test.js`
- Modify: `src/ui/render.js` (rewrite `renderResult`), `src/main.js`, `tests/render.test.js`
- Modify: `src/styles/components.css`, `src/styles/screens.css`, `src/styles.css` (delete LEGACY block)

- [ ] **Step 1: Write failing effects tests**

```js
// tests/effects.test.js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { runLedgerTheater, spawnDeltaChip } from '../src/ui/effects.js';

afterEach(() => vi.useRealTimers());

describe('runLedgerTheater', () => {
  it('reveals rows one beat at a time', () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    el.innerHTML = `<div class="ledger">
      <div class="ledger__row is-hidden"></div>
      <div class="ledger__row is-hidden"></div>
      <div class="ledger__row is-hidden"></div></div>`;
    runLedgerTheater(el, { beatMs: 350 });
    expect(el.querySelectorAll('.is-hidden').length).toBe(3);
    vi.advanceTimersByTime(350);
    expect(el.querySelectorAll('.is-hidden').length).toBe(2);
    vi.advanceTimersByTime(700);
    expect(el.querySelectorAll('.is-hidden').length).toBe(0);
  });

  it('a click skips straight to the final state', () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    el.innerHTML = `<div class="ledger"><div class="ledger__row is-hidden"></div>
      <div class="ledger__row is-hidden"></div></div>`;
    runLedgerTheater(el, { beatMs: 350 });
    el.click();
    expect(el.querySelectorAll('.is-hidden').length).toBe(0);
  });
});

describe('spawnDeltaChip', () => {
  it('renders a signed amount and removes itself after its lifetime', () => {
    vi.useFakeTimers();
    const host = document.createElement('div');
    spawnDeltaChip(host, -90, { lifeMs: 900 });
    const chip = host.querySelector('.delta-chip');
    expect(chip.textContent).toContain('−90');
    expect(chip.className).toContain('delta-chip--neg');
    vi.advanceTimersByTime(900);
    expect(host.querySelector('.delta-chip')).toBeNull();
  });

  it('caps visible chips at two', () => {
    vi.useFakeTimers();
    const host = document.createElement('div');
    spawnDeltaChip(host, 10); spawnDeltaChip(host, 20); spawnDeltaChip(host, 30);
    expect(host.querySelectorAll('.delta-chip').length).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/effects.test.js` → FAIL (module not found).

- [ ] **Step 3: Implement `src/ui/effects.js`**

```js
// src/ui/effects.js — money theater (spec §6.6–6.7). DOM-only; no game state in here.
import { formatGold } from './format.js';

const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Reveal .ledger__row.is-hidden rows one per beat; any click completes instantly.
export function runLedgerTheater(container, { beatMs = 350 } = {}) {
  const rows = [...container.querySelectorAll('.ledger__row.is-hidden')];
  if (reducedMotion()) { rows.forEach((r) => r.classList.remove('is-hidden')); return; }
  const timers = rows.map((row, i) =>
    setTimeout(() => row.classList.remove('is-hidden'), beatMs * (i + 1)));
  container.addEventListener('click', () => {
    timers.forEach(clearTimeout);
    rows.forEach((r) => r.classList.remove('is-hidden'));
  }, { once: true });
}

// Floating +/− chip near the purse. Max 2 visible; oldest evicted.
export function spawnDeltaChip(host, amount, { lifeMs = 900 } = {}) {
  const chips = host.querySelectorAll('.delta-chip');
  if (chips.length >= 2) chips[0].remove();
  const chip = document.createElement('span');
  chip.className = `delta-chip ${amount < 0 ? 'delta-chip--neg' : 'delta-chip--pos'}`;
  chip.textContent = formatGold(amount, { signed: true });
  host.appendChild(chip);
  setTimeout(() => chip.remove(), reducedMotion() ? 1500 : lifeMs);
  return chip;
}

// 3-frame rejection shake for the purse (spec §6.7).
export function purseShake(hudPurse) {
  if (!hudPurse || reducedMotion()) return;
  hudPurse.classList.remove('is-shaking'); // restart if mid-shake
  void hudPurse.offsetWidth;
  hudPurse.classList.add('is-shaking');
  setTimeout(() => hudPurse.classList.remove('is-shaking'), 300);
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run tests/effects.test.js` → PASS.

- [ ] **Step 5: Rewrite `renderResult`** (+ update its test expectations for the new strings)

Update the existing `renderResult` test: keep `toContain('The Brute')`, `toContain('40')`,
`toContain('data-action="to-hub"')`; add `expect(html).toContain('ledger')` and
`expect(html).toContain('New balance')`.

```js
export function renderResult(state, config) {
  const r = state.lastResult;
  const row = (label, amount, { cls = '', snark = '', hidden = true } = {}) =>
    `<div class="ledger__row${hidden ? ' is-hidden' : ''}${cls}">
      <dt>${label}${snark ? ` <span class="snark">(${escapeHtml(snark)})</span>` : ''}</dt>
      <dd class="amount${amount > 0 ? ' amount--pos' : amount < 0 ? ' amount--neg' : ''}">${formatGold(amount, { signed: true })}</dd>
    </div>`;
  const winRows = r.won ? [
    row('Purse', r.purse),
    row(`Tax`, -r.tax, { snark: 'Ouch!' }),
    r.sponsorIncome ? row('Sponsor', r.sponsorIncome, { snark: config.snark.sponsorReward }) : '',
    row('Net gold', r.netGold, { cls: ' ledger__row--net' }),
  ] : [
    row('Purse', 0),
    row('Injuries gained', 0 - 0, { snark: '' }) // structure only; see loss block below
  ];
  const lossList = `<div class="ledger__row is-hidden"><dt>Injuries gained</dt>
      <dd class="amount">${r.injuriesGained}</dd></div>
    <div class="ledger__row is-hidden"><dt>Weapon wear</dt>
      <dd class="amount amount--neg">−${r.durabilityLost} durability</dd></div>`;
  return `
    ${renderHud(state, config)}
    <section class="screen screen--result">
      <div class="result__recap">
        <p class="banner-stamp ${r.won ? 'banner-stamp--victory' : 'banner-stamp--defeat'}">${r.won ? 'VICTORY!' : 'DEFEAT.'}</p>
        ${poster({ name: r.opponentName, tilt: 2 })}
        ${r.won ? '<div class="result__cross" aria-hidden="true"></div>' : ''}
        <p class="snark result__flavor">${escapeHtml(r.commentary)}</p>
      </div>
      <div class="result__ledger">
        <dl class="ledger tape">
          <h2>The ledger</h2>
          ${r.won ? winRows.join('') : lossList}
          <div class="ledger__row ledger__row--balance is-hidden"><dt>New balance</dt>
            <dd class="amount">${formatGold(state.gold)}</dd></div>
          <span class="wordmark">GOLD &amp; GLORY</span>
        </dl>
      </div>
      <div class="result__cta commit-bar">${btn('to-hub', `Return to Ludus · ${formatGold(state.gold)}`, { variant: 'commit' })}</div>
    </section>`;
}
```

**Self-check while implementing:** the loss branch above must render `r.injuriesGained`
(plain, muted when 0 — zero is never red) and weapon wear; delete the placeholder `winRows`
second-element hack shown for brevity and write the loss rows only in `lossList`. Run the
result test for both won/lost fixtures.

- [ ] **Step 6: Wire effects in `src/main.js`**

```js
import { runLedgerTheater, spawnDeltaChip, purseShake } from './ui/effects.js';

// render() gains gold-delta detection + theater:
let lastGold = null;
function render() {
  const prevGold = lastGold;
  mount(app, state, CONFIG);
  if (state.phase === PHASE.FIGHT) startMeter();
  if (state.phase === PHASE.RESULT) runLedgerTheater(app.querySelector('.result__ledger'));
  const purse = app.querySelector('.hud__purse');
  if (purse && prevGold != null && state.gold !== prevGold) {
    spawnDeltaChip(purse, state.gold - prevGold);
  }
  lastGold = state.gold;
}

// Unaffordable click rejection: wrap the delegated handler table once —
// in wire()'s handlers, before dispatch, screens.js stays untouched; instead
// add to each commerce handler a guard, e.g.:
repair: () => {
  const before = state.gold;
  state = repairWeapon(state, CONFIG);
  if (state.gold === before) { purseShake(app.querySelector('.hud__purse')); return; }
  render();
},
// Apply the same before/after-gold guard pattern to: train-*, heal, buy-*, bribe.
```

- [ ] **Step 7: Append CSS + delete the LEGACY block from `src/styles.css`**

`components.css` — copy the `.ledger` block from spec **§6.6** verbatim, then add:

```css
.ledger__row.is-hidden { visibility: hidden; }
.banner-stamp { font-family: var(--font-display); font-size: var(--text-3xl);
  line-height: 1; margin: 0 0 var(--space-3); transform: rotate(var(--tilt-3));
  animation: stamp-in var(--dur-stamp) var(--ease-drop); display: inline-block; }
.banner-stamp--victory { color: var(--moss-ink); }
.banner-stamp--defeat { color: var(--blood-ink); }
.banner-stamp--death { color: var(--blood); font-size: var(--text-4xl); }
@keyframes stamp-in { from { transform: scale(1.5) rotate(var(--tilt-3)); } }
.result__recap { position: relative; }
.result__cross { position: absolute; inset: 0; pointer-events: none; }
.result__cross::before, .result__cross::after { content: ""; position: absolute;
  left: 10%; right: 10%; top: 45%; height: 12px; background: var(--blood);
  border-radius: 6px; opacity: 0.85; }
.result__cross::before { transform: rotate(18deg); }
.result__cross::after { transform: rotate(-18deg); }
.delta-chip { position: absolute; top: 100%; left: var(--space-2);
  font-weight: 700; font-variant-numeric: tabular-nums; font-size: var(--text-sm);
  padding: 1px 6px; background: var(--grad-paper); border: 2px solid var(--border-ink);
  border-radius: var(--wobble-bar); z-index: var(--z-chip);
  animation: chip-fall var(--dur-chip) steps(4, end) forwards; }
.delta-chip--pos { color: var(--color-income); }
.delta-chip--neg { color: var(--color-expense); }
@keyframes chip-fall { to { transform: translateY(14px); opacity: 0; } }
.hud__purse { position: relative; }
.hud__purse.is-shaking { animation: purse-shake 300ms steps(3, end); }
@keyframes purse-shake { 33% { transform: translateX(-3px); } 66% { transform: translateX(3px); } }
```

`screens.css` — `.screen--result` grid from spec §7 + area classes
(`.result__recap { grid-area: recap; }` etc.).

`src/styles/legacy.css` — **trim it to the two rules GAMEOVER still needs**
(`:where(.gameover)` and `:where(.result .cause, .gameover .cause)`), plus `:where(#app)` and
`:where(button:disabled)` which still apply everywhere. Delete every other rule — hub, fight, and
result all use new markup now. The file and its `@import` go away entirely in Task 9.

- [ ] **Step 8: Run everything**

Run: `npx vitest run` → all PASS. `npm run dev` → win a fight: banner stamps in, rows tally
one beat apart, click skips, purse chip fires on return to hub, unaffordable clicks shake the purse.

- [ ] **Step 9: Commit**

```bash
git add src/ui/effects.js tests/effects.test.js src/ui/render.js src/main.js tests/render.test.js src/styles
git commit -m "feat(ui): ledger theater, delta chips, purse shake, result screen"
```

---

### Task 9: Game Over — endings gallery, cause of death, final cleanup

**Files:**
- Modify: `src/config.js` (ending epitaphs), `src/ui/render.js` (rewrite `renderGameOver`), `tests/render.test.js`
- Modify: `src/styles/components.css`, `src/styles/screens.css`, `src/styles.css` (delete last legacy lines)

- [ ] **Step 1: Add failing tests**

```js
  it('renders three ending cards with the achieved one unlocked', () => {
    const s = createGameState(1, CONFIG);
    s.ended = 'dead';
    s.lastResult = { died: true, causeOfDeath: 'Tripped on a turnip.', opponentName: 'X' };
    const html = renderGameOver(s, CONFIG);
    expect((html.match(/ending-card/g) || []).length).toBeGreaterThanOrEqual(3);
    expect((html.match(/ending-card--locked/g) || []).length).toBe(2);
    expect(html).toContain('banner-stamp--death');
  });
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/render.test.js`

- [ ] **Step 3: Add epitaphs to `src/config.js`** (after `snark`)

```js
  endings: {
    'win-circuit': { title: 'Champion of the Circuit', epitaph: 'You got a belt. It doesn’t fit.' },
    retired: { title: 'Retired Rich', epitaph: 'You have all the gold. And no friends.' },
    dead: { title: 'You Died', epitaph: 'The crowd loved it.' },
  },
```

(Verified: `src/game.js` sets `ended` to exactly `'dead'`, `'win-circuit'`, and `'retired'` —
the keys above match.)

- [ ] **Step 4: Rewrite `renderGameOver`**

```js
export function renderGameOver(state, config) {
  const e = config.endings;
  const card = (key, extra = '') => {
    const locked = state.ended !== key;
    return `<article class="ending-card tape${locked ? ' ending-card--locked' : ''}"
      ${locked ? 'aria-disabled="true"' : ''}>
      <h3 class="poster__name">${escapeHtml(e[key].title)}${locked ? '?' : ''}</h3>
      <div class="poster__portrait" aria-hidden="true"><span class="poster__silhouette"></span></div>
      <span class="snark">(${escapeHtml(e[key].epitaph)})</span>${extra}
    </article>`;
  };
  const stampText = state.ended === 'dead' ? 'YOU DIED'
    : state.ended === 'win-circuit' ? 'CHAMPION!' : 'RETIRED RICH';
  const cause = state.ended === 'dead'
    ? `<p class="cause-of-death"><strong>Cause of death:</strong> ${escapeHtml(state.lastResult.causeOfDeath)}</p>`
    : `<p class="cause-of-death">Final purse: <span class="amount">${formatGold(state.gold)}</span></p>`;
  return `
    ${renderHud(state, config)}
    <section class="screen screen--gameover">
      <div class="gameover__left">${card('win-circuit')}</div>
      <div class="gameover__stamp">
        <p class="banner-stamp banner-stamp--${state.ended === 'dead' ? 'death' : 'victory'}">${stampText}</p>
        ${cause}
        <span class="wordmark">GOLD &amp; GLORY</span>
      </div>
      <div class="gameover__right">${card('retired')}</div>
      <div class="gameover__cta commit-bar">${btn('restart', 'Fight Again ▸', { variant: 'commit' })}</div>
    </section>`;
}
```

**Note:** the achieved ending renders as the *center stamp*, so the two side cards are always
the *other* two endings. When `state.ended === 'dead'`, sides = champion + retired (both
locked). When champion or retired, swap the achieved one out of the side slots: side cards are
`['win-circuit', 'retired', 'dead'].filter(k => k !== state.ended)` — implement with that
filter, first card left, second card right, rather than hardcoding as sketched above. Existing
tests (`/champion|circuit/i`, cause-of-death string, `data-action="restart"`) must still pass.

- [ ] **Step 5: Run to verify pass** — `npx vitest run` → all PASS.

- [ ] **Step 6: CSS + final legacy cleanup**

`components.css`:

```css
.ending-card { background: var(--grad-paper); border: var(--border-w) solid var(--border-ink);
  border-radius: var(--wobble-1); padding: var(--space-4); box-shadow: var(--shadow-paper);
  text-align: center; }
.ending-card--locked { filter: grayscale(0.8); opacity: 0.55; }
.cause-of-death { font-size: var(--text-lg); max-width: 40ch; margin: var(--space-3) auto; }
.gameover__stamp { text-align: center; }
```

`screens.css`: `.screen--gameover` grid from spec §7 + area classes.

Final legacy removal: **delete `src/styles/legacy.css` and its `@import` from `src/styles.css`.**
`#app`'s width cap and `button:disabled` styling now have to live somewhere permanent — move both
into `base.css` (`#app { min-height: 100dvh; }` already lives there; add `max-width: 1180px;
margin: 0 auto; padding: var(--space-4);` and a real `.btn.is-disabled` per spec §6.2 if Task 4
did not already add it). Then `src/styles.css` is imports only, four lines.

- [ ] **Step 7: Commit**

```bash
git add src/config.js src/ui/render.js tests/render.test.js src/styles
git commit -m "feat(ui): game over endings gallery with locked epitaphs and death stamp"
```

---

### Task 10: Verification pass (spec §8 floor + §0 laws)

**Files:** touch-ups only where checks fail.

- [ ] **Step 1: Full suite + build**

Run: `npx vitest run` → PASS. `npm run build` → success.
`grep -rn "#[0-9a-fA-F]\{6\}" src/styles/components.css src/styles/screens.css` → only
occurrences permitted are inside `tokens.css`-defined values; fix any stray literal by
promoting it to a token or reusing an existing one. (Two intentional exceptions documented in
this plan: `#c9b384` portrait gradient stop and `#443019` silhouette — promote both to tokens
`--paper-5` and `--silhouette` in `tokens.css` during this step.)

- [ ] **Step 2: Keyboard-only run-through**

Play one full loop (hub → fight → result → hub) using only Tab/Enter/Space/1–4. Every control
reachable, focus ring visible on **stone, paper, wood, and blue** surfaces (stone is the one that
plain blue fails at 1.12:1 — the bone halo from `base.css` is what carries it; confirm no component
`box-shadow` has swallowed the halo).

- [ ] **Step 3: Reduced-motion pass**

Enable "Reduce Motion" in OS settings (or emulate via DevTools rendering tab): ledger appears
pre-tallied, no chip travel, no pulses; the meter still sweeps.

- [ ] **Step 4: Responsive pass**

DevTools at 1280 / 900 / 640 / 375 wide: no horizontal scroll; at ≤640 the commit bar is
sticky-bottom; posters stack; HUD wraps without clipping.

- [ ] **Step 4b: Font attribution**

`src/assets/fonts/OFL.txt` (vendored in Task 1) is the canonical OFL 1.1 **template** — its copyright
line still reads `Copyright (c) <dates>, <Copyright Holder>`. That satisfies "the license accompanies
the software" but attributes nobody. Replace it with the three families' actual upstream OFL files
(fetch from each family's directory in `github.com/google/fonts`, e.g. `ofl/bangers/OFL.txt`) as
`OFL-Bangers.txt`, `OFL-Nunito.txt`, `OFL-PatrickHand.txt`, and extend `scripts/fetch-fonts.mjs` to
pull them so it stays reproducible. Do not hand-write copyright lines from memory.

- [ ] **Step 5: Laws audit (spec §0)**

Visually check: gold hue appears only on money · every red/green amount has a sign · blue
appears only on Next Fight / Press the Attack / Retire Rich / Fight Again / Return to Ludus /
focus rings · no text sits directly on stone.

- [ ] **Step 6: Final commit**

```bash
git add -A src
git commit -m "chore(ui): accessibility, reduced-motion, and responsive verification fixes"
```

---

## Self-Review (performed while writing)

- **Spec coverage:** §1→T1, §2→T1/T2, §3→(tokens+laws audit T10), §4→T1/T5, §5→T1 base +
  per-component keyframes, §6.1→T3, §6.2→T4, §6.3→T5, §6.4→T6, §6.5→T5, §6.6→T8, §6.7→T8,
  §6.8→T4 (class) + base.css, §6.9→T7, §6.10→T5, §6.11→T5, §6.12→T5, §6.13→T8/T9, §6.14→T9,
  §6.15→out of scope (declared), §7→T5/T7/T8/T9, §8→T10, §9→config strings T4/T9, §10 order
  followed. Gap check: chicken/sandal assets intentionally deferred (spec §10 allows —
  fallbacks are the shipped state).
- **Placeholder scan:** meter markup in T7 references T6's `meterHtml` construction by design
  (same file, same function, sequential tasks); all other code is complete inline.
- **Type consistency:** `btn(action, label, opts)` signature identical in T4–T9 call sites;
  `poster({name, sub, snark, hp, tilt})` consistent T5/T7/T8/T9; `formatGold(n, {signed})`
  consistent everywhere; `meterZones(center, windowWidth, config)` matches its test.
