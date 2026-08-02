# Visual Upgrade Phase 1 — Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land every structural/layout change of the visual upgrade with zero new art — stage layers, title plaques, icon wells, fight recomposition, freeze feedback — per `docs/superpowers/specs/2026-08-02-visual-upgrade-design.md` §3.

**Architecture:** Vanilla JS + Vite. Renderers in `src/ui/*.js` emit HTML strings mounted into `#app`; styles split across `src/styles/{tokens,base,components,screens}.css`; vitest + jsdom test suite with rule-level CSS checks. Every new element ships as an *empty well with a structural fallback* — Phase 2/3 fill them without touching layout again.

**Tech Stack:** Vite 5, vitest (jsdom), ESLint, no framework.

**Rules that bind every task:**
- The design-system doc is the law: Task 1 amends it FIRST (its own §10: "extend the document first, then the code").
- DOM source order = reading order = tab order. Grid areas move pixels, never order.
- New elements that are decorative carry `aria-hidden="true"`.
- Run `npm test` (vitest run) and `npm run lint` before every commit. All commits go on `main`.

**File structure (what changes where):**

| File | Responsibility in this plan |
| --- | --- |
| `docs/superpowers/specs/2026-07-23-gold-and-glory-design-system.md` | §6 catalog additions + token additions (Task 1) |
| `src/styles/tokens.css` | new `--z-*`, `--frame-w` tokens (Tasks 2, 3) |
| `index.html` | stage layer divs before `#app` (Task 2) |
| `src/styles/base.css` | stage layer CSS, body/frame padding (Task 2) |
| `src/ui/components.js` | `titlePlaque()`, `iconWell()`, `bar()`/`btn()` well opts, arrow variant (Tasks 3–6) |
| `src/ui/render.js` | plaques on 4 screens, HUD injuries group, hub/ledger wells, fight recomposition (Tasks 3–6) |
| `src/styles/components.css` | `.title-plaque`, `.icon-well`, `.hud__count`, `.btn--arrow`, `.meter__stamp`, `.is-flashing`, train-row column (Tasks 3–7) |
| `src/styles/screens.css` | fight grid (desktop + 900px), `.fight__press`, commit-bar frame offset (Tasks 2, 6) |
| `src/main.js` | freeze feedback in `captureMeter()` (Task 7) |
| `tests/stage.test.js` | NEW — stage layer assertions (Task 2) |
| `tests/render.test.js`, `tests/styles.test.js`, `tests/main.test.js` | updated + new assertions (Tasks 3–7) |

---

### Task 1: Design-system doc amendments (doc-first)

**Files:**
- Modify: `docs/superpowers/specs/2026-07-23-gold-and-glory-design-system.md`

- [ ] **Step 1: Add new classes to the §6.0 closed class index**

In the §6.0 backtick list (starts `hud, hud__purse, ...`), append to the final line (before the closing backtick), keeping alphabetical-ish grouping loose — the list is comma-separated prose, position is not semantic:

```
title-plaque, stage-backdrop, stage-frame, icon-well, icon-well--sm, hud__count,
btn--arrow, fight__press, is-flashing
```

(`meter__stamp` and `meter-chicken` are already in the index — §6.4 specified them; Task 7 implements the stamp.)

- [ ] **Step 2: Append new catalog sections after §6.15**

Add these sections verbatim after §6.15 (Modal):

```markdown
### 6.16 Title plaque (`.title-plaque`)

Per-screen parchment plaque carrying the screen's `h1`, overlapping the HUD beam's bottom edge
(visual-upgrade design §3.2). M2 parchment + tape, `width: max-content`, centered, negative top
margin, `z-index: var(--z-plaque)` (one step above the beam), tilt `--tilt-3`. Text comes from
existing screen state; CSS uppercases it (`text-transform`), the string stays sentence-case in
JS. One component, four screens: Fight / Result / Game over / Current wins: N. The `h1` is the
screen's only `h1`.

### 6.17 Stage layers (`.stage-backdrop`, `.stage-frame`)

Viewport-fixed decorative layers wrapping every screen (visual-upgrade design §3.3):
stone body (M1) → `.stage-backdrop` (`--z-backdrop`) → `.stage-frame` (`--z-frame`,
`pointer-events: none`) → screen content. Both `aria-hidden="true"`, both static in
`index.html` — they are not re-rendered. Empty backdrop = the body's stone shows through
(§10 zero-asset rule). Phase 1 frame is a plain `--stone-2` border of width `--frame-w`
(14px, 8px ≤640px); Phase 3 replaces it with cartoon-masonry `border-image`. The body gains
`padding: var(--frame-w)` so content never sits under the border; interactive layers
(`--z-hud` and up) stay above the frame.

### 6.18 Icon well (`.icon-well`)

The generic empty-slot treatment, generalized from §6.12's `.shop-item__icon` (which now also
carries the class): recessed paper radial, ink border, wobble radius. 34px default,
24px as `.icon-well--sm` (HUD). Always `aria-hidden="true"` with a `data-icon="<name>"` hook —
Phase 2 paints the named glyph via CSS mask; until then the recessed well reads as an
intentional slot. Never carries meaning: the adjacent label/numeral does.
```

- [ ] **Step 3: Amend §6.1 (HUD beam) — injuries cell**

At the end of the §6.1 section text (after its CSS block), add:

```markdown
**Amendment (visual-upgrade design §3.4, decision 3):** each stat gains a leading
`.icon-well .icon-well--sm` (`data-icon`: `health`, `durability`, `injuries`; the purse keeps
its existing `.coin`). The injuries cell shows icon + numeral + pips together: a `.hud__count`
numeral (body 700, `--bone`) sits between label and pips. The `role="img"` +
"N injuries" `aria-label` moves to a wrapper spanning numeral + pips; both children are
`aria-hidden` so the count is announced exactly once.
```

- [ ] **Step 4: Amend §6.2 (Buttons) — arrow variant**

At the end of §6.2, add:

```markdown
**Amendment (visual-upgrade design §3.1):** `.btn--arrow`, a modifier stacked on
`.btn--commit` for the fight screen's PRESS THE ATTACK: display face at `--text-commit`, an
ink-outlined triangular right end drawn with a `::after` border-triangle (the focus ring stays
on the rectangular button box — no `clip-path`, which would clip the §8 ring). Buttons may also
carry a leading `.icon-well` (sinks) emitted by `btn({ icon })`.
```

- [ ] **Step 5: Amend §7 (fight layout)**

After the existing `.screen--fight` block in §7's text, add:

```markdown
**Amendment (visual-upgrade design §3.1, decision 2):** the fight grid becomes

    'hud  hud     hud'
    'you  stage   foe'
    'you  actions foe'
    'log  log     press'

DOM order: you, stage, foe, actions, log, press — interactive flow stays meter → actions →
log → press. `.fight__press` holds the PRESS THE ATTACK arrow bottom-right; at ≤900px areas
stack `'you stage' / 'foe stage' / 'actions actions' / 'log log' / 'press press'`; at ≤640px
the standard area reset returns everything to source-order flow.
```

- [ ] **Step 6: Add tokens to §1's documented set**

In §1 (Design Tokens), where the z-scale is described (`--z-hud: 10` etc.), note the additions:

```markdown
Additions (visual-upgrade design §3.3): `--z-backdrop: -1`, `--z-frame: 5`,
`--z-plaque: 11`, `--frame-w: 14px` (8px at ≤640px).
```

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/specs/2026-07-23-gold-and-glory-design-system.md
git commit -m "docs(design-system): catalog title plaque, stage layers, icon wells, arrow button"
```

---

### Task 2: Stage layers (backdrop well + frame placeholder)

**Files:**
- Modify: `src/styles/tokens.css` (z-scale block, ~line 138)
- Modify: `index.html`
- Modify: `src/styles/base.css`
- Modify: `src/styles/screens.css` (≤640px `.commit-bar` block, ~line 280)
- Create: `tests/stage.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/stage.test.js`:

```js
// tests/stage.test.js — stage layers (design-system §6.17). Static markup in index.html, so
// this is a file-text check like tests/grid-areas.test.js's sheet reads: jsdom never loads
// index.html, and the layers are deliberately outside #app (mount() must never wipe them).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('src/styles/base.css', 'utf8');
const tokens = readFileSync('src/styles/tokens.css', 'utf8');

describe('stage layers', () => {
  it('declares both decorative layers before the app mount, aria-hidden', () => {
    const backdrop = html.indexOf('<div class="stage-backdrop" aria-hidden="true"></div>');
    const frame = html.indexOf('<div class="stage-frame" aria-hidden="true"></div>');
    const app = html.indexOf('id="app"');
    expect(backdrop).toBeGreaterThan(-1);
    expect(frame).toBeGreaterThan(backdrop);
    expect(app).toBeGreaterThan(frame);
  });

  it('keeps the frame out of the input path and below interactive layers', () => {
    expect(css).toMatch(/\.stage-frame\s*{[^}]*pointer-events:\s*none/);
    expect(css).toMatch(/\.stage-frame\s*{[^}]*z-index:\s*var\(--z-frame\)/);
    expect(tokens).toMatch(/--z-frame:\s*5\b/);
    expect(tokens).toMatch(/--z-backdrop:\s*-1\b/);
    expect(tokens).toMatch(/--frame-w:\s*14px/);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/stage.test.js`
Expected: FAIL — both tests (markup and tokens not present yet).

- [ ] **Step 3: Add tokens**

In `src/styles/tokens.css`, extend the existing z-scale block (`--z-hud: 10; --z-chip: 20; --z-modal: 30;`):

```css
  --z-backdrop: -1; /* stage backdrop well — behind everything (§6.17) */
  --z-frame: 5; /* stone frame — above content chrome, below every interactive layer */
  --frame-w: 14px; /* stone frame width; 8px ≤640px (overridden in base.css) */
```

- [ ] **Step 4: Add the layers to index.html**

In `index.html`, replace:

```html
  <body>
    <main id="app"></main>
```

with:

```html
  <body>
    <div class="stage-backdrop" aria-hidden="true"></div>
    <div class="stage-frame" aria-hidden="true"></div>
    <main id="app"></main>
```

- [ ] **Step 5: Style the layers in base.css**

In `src/styles/base.css`, add `padding: var(--frame-w);` to the existing `body` rule, change the `#app` rule's `min-height` to `calc(100dvh - 2 * var(--frame-w))` (body padding would otherwise force a permanent scrollbar), and append after the `#app` rule:

```css
/* Stage layers (§6.17): fixed decorative wells around every screen. The backdrop is empty in
   Phase 1 — the body's stone (M1) IS its zero-asset fallback (§10). The frame is a placeholder
   stone border until Phase 3's cartoon masonry border-image; pointer-events: none keeps it out
   of the input path, and --z-frame sits below --z-hud so nothing interactive is ever covered. */
.stage-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-backdrop);
}
.stage-frame {
  position: fixed;
  inset: 0;
  z-index: var(--z-frame);
  pointer-events: none;
  border: var(--frame-w) solid var(--stone-2);
}
@media (max-width: 640px) {
  :root {
    --frame-w: 8px;
  }
}
```

- [ ] **Step 6: Seat the sticky commit bar on the frame's inner edge**

In `src/styles/screens.css`, in the ≤640px `.commit-bar` rule, change `bottom: 0;` to:

```css
    bottom: var(--frame-w);
```

(Otherwise the sticky bar rests under the frame's bottom border.)

- [ ] **Step 7: Run tests**

Run: `npx vitest run tests/stage.test.js && npm test`
Expected: stage tests PASS; full suite PASS (no existing test reads index.html markup).

- [ ] **Step 8: Visual sanity check**

Run: `npm run dev` — verify: stone border around the viewport at desktop and ~375px width, no horizontal scrollbar, no permanent vertical scrollbar on the hub, HUD beam fully visible inside the frame.

- [ ] **Step 9: Commit**

```bash
git add index.html src/styles/tokens.css src/styles/base.css src/styles/screens.css tests/stage.test.js
git commit -m "feat(ui): stage layers — backdrop well and placeholder stone frame"
```

---

### Task 3: Title plaque on all four screens

**Files:**
- Modify: `src/ui/components.js` (after `bannerStamp`, ~line 260)
- Modify: `src/ui/render.js` (`renderHub` ~line 130, `renderResult` ~line 274, `renderGameOver` ~line 352, `renderFight` ~line 457)
- Modify: `src/styles/tokens.css` (z-scale block)
- Modify: `src/styles/components.css` (append)
- Modify: `tests/render.test.js` (hub "Wins: 2" assertion, ~line 1553)
- Modify: `tests/styles.test.js` (contrast selector list entry `div.hub__sinks > p`, ~line 662)

- [ ] **Step 1: Write the failing tests**

In `tests/render.test.js`, add a new describe block (near the other cross-screen blocks):

```js
describe('title plaques (§6.16)', () => {
  const plaqueText = (html) => {
    const m = html.match(/<div class="title-plaque parchment tape"><h1>([^<]*)<\/h1><\/div>/);
    return m && m[1];
  };

  it('gives every screen exactly one h1, inside the plaque', () => {
    const s = createGameState();
    for (const html of [renderHub(s, CONFIG), fightHtml(), resultHtml(), gameoverHtml()]) {
      expect((html.match(/<h1[\s>]/g) || []).length).toBe(1);
      expect(plaqueText(html)).toBeTruthy();
    }
  });

  it('titles the hub with the win count and the other screens with their names', () => {
    const s = createGameState();
    s.wins = 2;
    expect(plaqueText(renderHub(s, CONFIG))).toBe('Current wins: 2');
    expect(plaqueText(fightHtml())).toBe('Fight');
    expect(plaqueText(resultHtml())).toBe('Result');
    expect(plaqueText(gameoverHtml())).toBe('Game over');
  });
});
```

Use the file's existing helpers for building fight/result/gameover state (`render.test.js` already renders all four screens — reuse its fixtures; if it has no shared helpers, build states the way its existing fight/result/gameover describes do and inline `fightHtml()`/`resultHtml()`/`gameoverHtml()` as small local functions following those examples).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/render.test.js -t "title plaques"`
Expected: FAIL — no `<h1>` in any screen yet.

- [ ] **Step 3: Add the component**

In `src/ui/components.js`, after `bannerStamp()`:

```js
// Title plaque (spec §6.16): the screen's h1 on a parchment plate that overlaps the HUD beam.
// Sentence-case in, CSS uppercases — §9 keeps shouting a presentation concern.
export function titlePlaque(text) {
  return `<div class="title-plaque parchment tape"><h1>${escapeHtml(text)}</h1></div>`;
}
```

- [ ] **Step 4: Mount it on all four screens**

In `src/ui/render.js`:

1. Import `titlePlaque` alongside the other component imports.
2. `renderHub`: after `${renderHud(state, config)}` add `${titlePlaque(`Current wins: ${state.wins}`)}`, and delete the line `<p>Wins: ${state.wins}</p>` from `.hub__sinks` (the plaque now states it; two spellings drift).
3. `renderFight`: after `${renderHud(state, config)}` add `${titlePlaque('Fight')}`.
4. `renderResult`: after its `${renderHud(...)}` add `${titlePlaque('Result')}`.
5. `renderGameOver`: after its `${renderHud(...)}` add `${titlePlaque('Game over')}`.

- [ ] **Step 5: Style it**

In `src/styles/tokens.css` z-scale block, add:

```css
  --z-plaque: 11; /* title plaque — one step above the beam it overlaps (§6.16) */
```

In `src/styles/components.css`, append:

```css
/* ---- 6.16 Title plaque ---- */
.title-plaque {
  position: relative;
  z-index: var(--z-plaque);
  width: max-content;
  max-width: 80%;
  margin: calc(-1 * var(--space-3)) auto var(--space-2);
  padding: var(--space-1) var(--space-5);
  transform: rotate(var(--tilt-3));
  text-align: center;
}
.title-plaque h1 {
  font-size: var(--text-xl);
  text-transform: uppercase;
  color: var(--ink);
}
```

(`.parchment` supplies the paper material + border + shadow; `.tape` the tape strips — same recipe as `.sponsor-card`.)

- [ ] **Step 6: Update the two stale assertions**

- `tests/render.test.js` ~line 1553: the hub test asserting `expect(you).toContain('Wins: 2')` — the win count no longer lives in `.hub__sinks`. Point the assertion at the plaque: `expect(html).toContain('Current wins: 2')` (adjust the variable to whatever that test names the full hub render).
- `tests/styles.test.js` ~line 662: remove the `'div.hub__sinks > p', // hub "Wins: N", --ink 4.15:1` entry from the contrast selector list (the element is gone). The plaque's ink-on-paper pair (12.42:1) is already covered by the list's parchment entries; if the test fails because every listed selector must exist, add `'.title-plaque h1'` in the paper-surface group instead.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS. If `tests/a11y.test.js` asserts anything about heading order, the new h1-before-h2 structure satisfies WCAG heading hierarchy — fix any assertion that hard-codes "first heading is h2" to expect the plaque h1.

- [ ] **Step 8: Commit**

```bash
git add src/ui/components.js src/ui/render.js src/styles/tokens.css src/styles/components.css tests/render.test.js tests/styles.test.js
git commit -m "feat(ui): per-screen title plaques overlapping the HUD beam"
```

---

### Task 4: HUD icon wells + injuries numeral

**Files:**
- Modify: `src/ui/components.js` (`bar()` ~line 160)
- Modify: `src/ui/render.js` (`renderHud` ~line 76)
- Modify: `src/styles/components.css` (icon well near `.shop-item__icon` ~line 327; `.hud__count` near the HUD rules)
- Modify: `src/ui/components.js` (`shopItem` — add shared class)
- Test: `tests/render.test.js`

- [ ] **Step 1: Write the failing tests**

In `tests/render.test.js`, next to the existing HUD tests (~line 107):

```js
it('gives each HUD stat an empty icon well with a data-icon hook (§6.18)', () => {
  const s = createGameState();
  const html = renderHud(s, CONFIG);
  for (const name of ['health', 'durability', 'injuries']) {
    expect(html).toContain(
      `<span class="icon-well icon-well--sm" aria-hidden="true" data-icon="${name}"></span>`
    );
  }
});

it('shows the injuries numeral beside the pips, announced exactly once (decision 3)', () => {
  const s = createGameState();
  s.injuries = 3;
  const html = renderHud(s, CONFIG);
  expect(html).toContain('<span class="hud__count" aria-hidden="true">3</span>');
  // one announcement: the wrapper's aria-label, with pips hidden beneath it
  expect(html).toContain('aria-label="3 injuries"');
  expect(html).toMatch(/<span class="pips" aria-hidden="true">/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/render.test.js -t "icon well"`
Expected: FAIL — wells not rendered.

- [ ] **Step 3: Implement**

In `src/ui/components.js`:

1. Add above `btn()`:

```js
// The generic empty slot (spec §6.18): decorative, named for Phase 2's CSS mask hook. The
// well never carries meaning — the label/numeral next to it does.
export function iconWell(name, { small = false } = {}) {
  return `<span class="icon-well${small ? ' icon-well--sm' : ''}" aria-hidden="true" data-icon="${name}"></span>`;
}
```

2. In `bar()`, accept and emit a well:

```js
export function bar(label, value, max, opts = {}) {
  const well = opts.well ? iconWell(opts.well, { small: true }) : '';
  // Escaped here as well as in meter(): the `.hud__label` span is a second sink for the same
  // string, so the "every call site passes it raw" contract only holds if both are escaped.
  return `<span class="hud__stat">${well}<span class="hud__label">${escapeHtml(label)}</span>
    ${meter(label, value, max, opts)}</span>`;
}
```

(`meter()` ignores unknown opts, so passing `opts` through unchanged is safe.)

3. In `shopItem()` (both branches), change `class="shop-item__icon"` to `class="shop-item__icon icon-well"` and add `data-icon="${item.id}"` — the shop well becomes an instance of the generic treatment with its Phase 2 hook.

In `src/ui/render.js` `renderHud()`:

```js
return `
    <header class="hud">
      <span class="hud__purse"><i class="coin"></i>Gold: <span class="ticker" data-value="${state.gold}">${formatGold(state.gold)}</span></span>
      ${bar('Health', hp.value, hp.max, { well: 'health', urgent: urgent ?? hp.value / hp.max < URGENT_FRACTION })}
      ${bar('Durability', state.weaponDurability, config.weapon.maxDurability, { well: 'durability', fillClass: ' bar__fill--dur' })}
      <span class="hud__stat">${iconWell('injuries', { small: true })}<span class="hud__label">Injuries</span>
        <span role="img" aria-label="${state.injuries} ${state.injuries === 1 ? 'injury' : 'injuries'}"><span class="hud__count" aria-hidden="true">${state.injuries}</span><span class="pips" aria-hidden="true">${pips}</span></span></span>
    </header>`;
```

(Import `iconWell` in render.js. The `role="img"` + label moves from `.pips` to the wrapper so numeral + pips announce once; the singular/plural tests at render.test.js ~line 173 keep passing because the label string is unchanged.)

In `src/styles/components.css`:

1. Replace the `.shop-item__icon` rule with the generalized well (same treatment, one owner — keep it at the same spot; §6.12's comment moves with it):

```css
/* §6.18's icon well — the portrait well's recession treatment, sized for an icon. Generalized
   from §6.12's shop slot: empty until Phase 2 delivers icons, and an empty recessed well reads
   as an intentional slot, so §10's zero-asset rule holds. data-icon is Phase 2's mask hook. */
.icon-well {
  flex: none;
  width: 34px;
  height: 34px;
  background: radial-gradient(circle at 50% 42%, var(--paper-4), var(--paper-5));
  border: 2px solid var(--border-ink);
  border-radius: 8px 11px 9px 12px;
}
.icon-well--sm {
  width: 24px;
  height: 24px;
  border-radius: 6px 8px 7px 9px;
}
```

(Delete the old `.shop-item__icon` size/background declarations — the class stays in the markup for §6.12's layout selectors, but the treatment now comes from `.icon-well`. If other rules target `.shop-item__icon` for layout, leave them.)

2. Near the HUD rules, add:

```css
.hud__count {
  font-weight: 700;
  font-size: var(--text-sm);
  color: var(--bone);
  margin-right: var(--space-1);
}
```

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS — the pip-count tests (render.test.js ~107–133) and singular/plural aria tests (~173) are unaffected by construction; if any test asserted the old `class="pips" role="img"` adjacency, update it to the wrapper form shown above.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components.js src/ui/render.js src/styles/components.css tests/render.test.js
git commit -m "feat(ui): HUD icon wells and injuries icon+numeral+pips group"
```

---

### Task 5: Icon wells — sinks, training, ledger

**Files:**
- Modify: `src/ui/components.js` (`btn()` ~line 71)
- Modify: `src/ui/render.js` (`renderHub` train/sink rows ~lines 95–158; `ledgerRow` ~line 184; `ledgerLines` ~line 221)
- Modify: `src/styles/components.css` (`.train-row` ~line 289)
- Test: `tests/render.test.js`

- [ ] **Step 1: Write the failing tests**

In `tests/render.test.js` (hub/ledger describe areas):

```js
it('gives sinks, training rows and money ledger rows their icon wells (§6.18)', () => {
  const s = createGameState();
  const hub = renderHub(s, CONFIG);
  for (const name of ['repair', 'heal', 'bribe', 'power', 'guard', 'speed']) {
    expect(hub).toContain(`data-icon="${name}"`);
  }
  const result = resultHtml(); // same fixture helper as the plaque tests
  for (const name of ['purse', 'tax', 'sponsor']) {
    expect(result).toContain(`data-icon="${name}"`);
  }
});
```

(For the `sponsor` well the result fixture must have `sponsorIncome > 0` — reuse/extend the fixture the existing sponsor-row ledger test uses.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/render.test.js -t "icon wells"`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `src/ui/components.js` `btn()`:

1. Add `icon = ''` to the destructured options.
2. Change the return to emit a leading well inside the button:

```js
  const well = icon ? iconWell(icon) : '';
  return (
    `<button${actionAttr} class="${classes.join(' ')}"${attrs}>` +
    `${well}${escapeHtml(label)}${priceSlot}${snarkAside(snark, missingAttr, missingAmount)}</button>`
  );
```

In `src/ui/render.js`:

1. Sinks — add to each `btn()` opts in `renderHub`: `icon: 'repair'`, `icon: 'heal'`, `icon: 'bribe'` (the bribed-out `btn(null, 'Bribed ✓', ...)` branch gets `icon: 'bribe'` too — the slot shouldn't vanish when spent).
2. Training rows — in the `trainRows` template, prepend a well and give the row its name:

```js
      return `<div class="train-row">
      ${iconWell(stat)}
      <span class="train-row__label">${stat[0].toUpperCase() + stat.slice(1)} ${eff[stat]}</span>
      ...
```

3. Ledger — `ledgerRow` accepts `icon` and emits it before the label:

```js
function ledgerRow({ label, text, value = null, unit = null, tone = '', cls = '', snark = '', icon = '' }) {
  const data = unit && Number.isFinite(value) ? ` data-value="${value}" data-unit="${unit}"` : '';
  const aside = snark ? ` <span class="snark">(${escapeHtml(snark)})</span>` : '';
  const well = icon ? iconWell(icon, { small: true }) : '';
  return `<div class="ledger__row is-hidden${cls}">
            <dt>${well}${escapeHtml(label)}${aside}</dt>
            <dd class="amount${tone}"${data}>${text}</dd>
          </div>`;
}
```

4. In `ledgerLines`, name the money rows: `moneyRow('Purse', r.purse, { icon: 'purse' })`, the tax row gets `icon: 'tax'` added to its existing opts, the sponsor row `icon: 'sponsor'`. Net gold / tallies / balance stay well-less (sums, not sources).

In `src/styles/components.css`, `.train-row` gains the icon column:

```css
.train-row {
  display: grid;
  grid-template-columns: 34px 90px 1fr auto;
  align-items: center;
  gap: var(--space-3);
  margin: var(--space-2) 0;
}
```

Also make ledger `dt`s lay out their well inline — next to the existing ledger dt/row rules add:

```css
.ledger__row dt {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
```

(Check the existing `.ledger__row` rule first: if `dt` already has a display/gap treatment, fold the well into it instead of adding a second rule.)

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS. Watch two spots: (a) `tests/a11y.test.js` ~line 251 asserts the Press label — unaffected here; (b) any ledger test matching `<dt>Label` exactly — the well now precedes the label text; update such matchers to allow the well span.

- [ ] **Step 5: Visual sanity check**

`npm run dev` — hub: every sink button and training row shows a recessed empty well; result screen (win a fight): purse/tax/sponsor rows show small wells; nothing overflows at 375px.

- [ ] **Step 6: Commit**

```bash
git add src/ui/components.js src/ui/render.js src/styles/components.css tests/render.test.js
git commit -m "feat(ui): icon wells for sinks, training rows and ledger money rows"
```

---

### Task 6: Fight recomposition + commit arrow

**Files:**
- Modify: `src/ui/render.js` (`renderFight` ~line 457)
- Modify: `src/ui/components.js` (`btn()` — arrow modifier)
- Modify: `src/styles/screens.css` (`.screen--fight` ~line 67 and its 900px block ~line 218)
- Modify: `src/styles/components.css` (append `.btn--arrow`)
- Modify: `tests/render.test.js` (press-placement test ~lines 1569–1587)

- [ ] **Step 1: Write the failing tests**

In `tests/render.test.js`:

```js
it('composes the fight center column meter → actions → log → press (decision 2)', () => {
  const html = fightHtml({ canPress: true });
  const order = ['fight__stage', 'fight__actions', 'fight__log', 'fight__press'].map((c) =>
    html.indexOf(c)
  );
  expect(order.every((i) => i > -1)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
});

it('renders Press the Attack as an arrow commit button in its own area, only when pressable', () => {
  const pressable = fightHtml({ canPress: true });
  expect(pressable).toMatch(/fight__press[^>]*>\s*<button[^>]*class="btn btn--commit btn--arrow"/);
  const idle = fightHtml({ canPress: false });
  expect(idle).toContain('fight__press');
  expect(idle).not.toContain('data-action="press"');
});
```

(`fightHtml({ canPress })` — build fight state the way the existing press test at ~1569 does; that test's old assertion that press lives inside `fight__actions` gets **replaced** by these two.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/render.test.js -t "fight"`
Expected: FAIL — no `fight__press`, press renders inside actions.

- [ ] **Step 3: Recompose renderFight**

In `src/ui/render.js`, reorder the section children to: you, stage, foe, actions (2×2 grid only), log, press:

```js
  return `
    ${renderHud(state, config)}
    ${titlePlaque('Fight')}
    <section class="screen screen--fight">
      <div class="fight__you">${poster({
        name: 'You',
        tilt: 1,
        hp: playerHealth(state),
        sub: playerSub(state),
        snark: config.snark.player,
      })}</div>
      <div class="fight__stage">${renderMeter(state, config)}</div>
      <div class="fight__foe">${poster({
        name: c.enemy.name,
        tilt: 2,
        hp: { value: c.enemy.health, max: c.enemy.maxHealth },
        sub: opponentSub(opponent),
        snark: config.snark[opponent.id] ?? '',
      })}</div>
      <div class="fight__actions">
        <div class="fight__grid">
          ${btn('strike', 'Strike')}
          ${btn('heavy', 'Heavy')}
          ${btn('block', 'Block')}
          ${btn('feint', 'Feint')}
        </div>
      </div>
      <div class="fight__log"><h2>Commentary</h2><ul class="log parchment" tabindex="0" aria-label="Combat log">${logHtml}</ul></div>
      <div class="fight__press">${c.canPress ? btn('press', 'Press the Attack ▸', { variant: 'commit', arrow: true }) : ''}</div>
    </section>`;
```

(Interactive flow: meter → strike/heavy/block/feint → log → press. The label string is untouched — `tests/a11y.test.js` ~251 keeps passing.)

- [ ] **Step 4: Arrow modifier in btn()**

In `src/ui/components.js` `btn()`, add `arrow = false` to the options and after the variant line:

```js
  if (arrow) classes.push('btn--arrow');
```

- [ ] **Step 5: Grids and arrow CSS**

In `src/styles/screens.css`, replace the `.screen--fight` base rule's rows/areas:

```css
.screen--fight {
  grid-template-columns: 260px 1fr 300px;
  grid-template-rows: auto auto 1fr auto;
  grid-template-areas:
    'hud  hud     hud'
    'you  stage   foe'
    'you  actions foe'
    'log  log     press';
}
```

Add with the other `.fight__*` area rules:

```css
.fight__press {
  grid-area: press;
  justify-self: end;
  align-self: end;
}
```

Replace the 900px `.screen--fight` block's areas (comment updates with it — area order tracks the new DOM order: you, stage, foe, actions, log, press):

```css
  .screen--fight {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: none;
    grid-template-areas: 'hud hud' 'you stage' 'foe stage' 'actions actions' 'log log' 'press press';
  }
```

(≤640px needs nothing: the existing `.screen > *` reset returns all children — including `.fight__press` — to source-order flow.)

In `src/styles/components.css`, append after the `.btn--commit` rules:

```css
/* §6.2 amendment: the fight screen's PRESS THE ATTACK. A commit button with a display face
   and an ink-outlined triangular right end. The triangle is ::after, NOT clip-path on the
   button: the §8 focus ring must stay on the rectangular box. */
.btn--arrow {
  position: relative;
  font-family: var(--font-display);
  font-size: var(--text-commit);
  letter-spacing: 0.04em;
  margin-right: 22px; /* room the ::after triangle occupies beside the box */
}
.btn--arrow::after {
  content: '';
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  border-top: 24px solid transparent;
  border-bottom: 24px solid transparent;
  border-left: 22px solid var(--commit);
}
```

- [ ] **Step 6: Run the suite**

Run: `npm test`
Expected: PASS. `tests/grid-areas.test.js` re-derives areas from the sheets at every breakpoint — it validates `press` automatically; if it fails it is pointing at a real area/DOM mismatch, fix the CSS, not the test. `tests/main.test.js` drives the press by `[data-action="press"]`, which still exists — its tests pass unchanged.

- [ ] **Step 7: Visual verification**

`npm run dev`, start a fight: desktop — posters flank, meter above actions above log, arrow bottom-right (land a hit to see it); 900px — posters stack left beside the meter, bands below; 375px — single column, press in flow after the log. Keyboard: Tab order = meter → strike → heavy → block → feint → log → press.

- [ ] **Step 8: Commit**

```bash
git add src/ui/render.js src/ui/components.js src/styles/screens.css src/styles/components.css tests/render.test.js
git commit -m "feat(ui): fight recomposition — center column flow and press arrow (decision 2)"
```

---

### Task 7: Freeze feedback — verdict stamp + zone flash (§6.4 behavioral half)

**Files:**
- Modify: `src/main.js` (`captureMeter()` ~line 233)
- Modify: `src/styles/components.css` (meter block, after `.meter.is-captured .meter-cursor` ~line 422)
- Test: `tests/main.test.js`

- [ ] **Step 1: Write the failing tests**

In `tests/main.test.js`, new describe after "capture and freeze":

```js
describe('freeze feedback (§6.4 steps 2–3)', () => {
  it('pops the verdict stamp at the frozen cursor and flashes the struck zone', () => {
    enterFight();
    captureAt(renderedCenter()); // dead centre → crit
    const stamp = q('.meter__stamp');
    expect(stamp).not.toBeNull();
    expect(stamp.textContent).toBe('CRIT!');
    expect(stamp.getAttribute('aria-hidden')).toBe('true');
    expect(q('.meter__zone--crit').classList.contains('is-flashing')).toBe(true);
  });

  it('stamps MISS! with no zone flash when captured far from the sweet spot', () => {
    enterFight();
    captureAt((renderedCenter() + 0.5) % 1); // opposite side of the track
    expect(q('.meter__stamp').textContent).toBe('MISS!');
    expect(q('.is-flashing')).toBeNull(); // a miss struck no zone
  });

  it('clears the stamp with the next render', () => {
    enterFight();
    captureAt(renderedCenter());
    act('1'); // resolve the action → re-render
    expect(q('.meter__stamp')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/main.test.js -t "freeze feedback"`
Expected: FAIL — no `.meter__stamp` rendered.

- [ ] **Step 3: Implement in captureMeter()**

In `src/main.js`, at the end of `captureMeter()` (after `bar.classList.add('is-captured')`):

```js
  // §6.4 steps 2–3, the behavioral half: the freeze is how players calibrate their timing,
  // so the verdict shows AT the freeze, not after the action resolves. currentTiming() reads
  // the same captured position the resolver will read, so the stamp can never disagree with
  // the log line that follows. aria-hidden: announceTurn speaks the verdict; the stamp is
  // the visual channel. The chicken drop (asset half) joins in Phase 3.
  const verdict = currentTiming();
  const zone = bar.querySelector(`.meter__zone--${verdict}`);
  if (zone) zone.classList.add('is-flashing');
  const stamp = document.createElement('span');
  stamp.className = 'meter__stamp';
  stamp.setAttribute('aria-hidden', 'true');
  stamp.textContent = `${verdict.toUpperCase()}!`;
  stamp.style.left = `${(sweep.captured * 100).toFixed(2)}%`;
  bar.appendChild(stamp);
```

(No cleanup code needed: every action re-renders the fight via `mount()`, which rebuilds the meter without the stamp — the third test proves it.)

- [ ] **Step 4: Style stamp + flash**

In `src/styles/components.css`, after the `.meter.is-captured .meter-cursor` rule:

```css
/* §6.4 step 3: the verdict pops at the frozen cursor. Reuses §6.13's stamp-in scale; ends
   visible, so the reduced-motion 1ms blanket (base.css) resolves it to "appears instantly". */
.meter__stamp {
  position: absolute;
  top: -6px;
  transform: translate(-50%, -100%);
  font-family: var(--font-display);
  font-size: var(--text-lg);
  color: var(--bone);
  text-shadow:
    -1px 1px 0 var(--ink),
    1px 1px 0 var(--ink);
  animation: stamp-in 180ms cubic-bezier(0.2, 1.4, 0.4, 1) both;
  pointer-events: none;
  white-space: nowrap;
}
/* §6.4 step 3's 2-frame opacity blink on the struck zone. Ends at full opacity — same
   reduced-motion reasoning as the stamp. */
.meter__zone.is-flashing {
  animation: zone-flash 240ms steps(2, jump-none) both;
}
@keyframes zone-flash {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.25;
  }
}
```

(`stamp-in` already exists at components.css ~line 578 for `.banner-stamp` — reuse it; if its scale range looks wrong at meter size, tune the stamp's own `font-size`, not the shared keyframes. The `.meter` rule already establishes the positioning context for its absolute zones.)

- [ ] **Step 5: Run the suite**

Run: `npm test`
Expected: PASS, including `tests/styles.test.js`'s reduced-motion generalization — both new animations end visible, so the 1ms blanket is legal for them (see base.css comment about forwards-animations that end hidden).

- [ ] **Step 6: Visual verification**

`npm run dev`, fight, click the meter: cursor freezes, struck zone blinks twice, verdict pops above the cursor in display type; with OS reduced-motion on, verdict appears without animation. Verify at 375px the stamp near track edges doesn't overflow the viewport (it may clip into the frame padding — acceptable; if it escapes the viewport, add `.meter { overflow: visible }` is NOT the fix, clamp the left position in captureMeter with `Math.min(Math.max(sweep.captured, 0.06), 0.94)` for the stamp only).

- [ ] **Step 7: Commit**

```bash
git add src/main.js src/styles/components.css tests/main.test.js
git commit -m "feat(ui): freeze verdict stamp and struck-zone flash (spec 6.4 steps 2-3)"
```

---

### Task 8: Phase acceptance — §8 floor, breakpoints, proof

**Files:** none new — verification only, fixes where found.

- [ ] **Step 1: Full suite + lint**

Run: `npm test && npm run lint`
Expected: both clean.

- [ ] **Step 2: Zero-asset check (trivially true, state it)**

Phase 1 added no assets — confirm `src/assets/` contains only the pre-existing `fonts/` directory: `ls src/assets/`. Every new element (wells, backdrop, frame) renders complete while empty by construction.

- [ ] **Step 3: Contrast spot-check**

The phase introduced no new color pairs except `.hud__count` (`--bone` on wood ≥ 10.06:1 per tokens.css) and plaque text (`--ink` on paper, 12.42:1). Confirm `tests/styles.test.js` passes — it owns the contrast table.

- [ ] **Step 4: Breakpoint + reduced-motion pass with screenshots**

With the dev server running, capture and inspect: hub + fight + result + gameover at 1280px and 375px, fight at 768px (the 900px grid), one fight capture with reduced-motion emulated. Verify against the reference images: plaque overlaps beam, frame reads as a border, fight column order matches, arrow bottom-right. Attach the screenshots to the phase report.

- [ ] **Step 5: Update PROGRESS/docs if the repo tracks one**

Check `git grep -l "PROGRESS"` — if a progress tracker lists items 17/27 (freeze feedback), mark the behavioral half done, chicken pending Phase 3.

- [ ] **Step 6: Final commit (only if step 4/5 produced fixes)**

```bash
git add -A
git commit -m "chore(ui): phase 1 acceptance fixes"
```

---

## Phase exit criteria (from the spec §3 + §6)

- All four screens carry plaque + stage layers; fight matches decision 2's composition.
- Every icon slot the spec names exists as an empty `data-icon` well.
- Freeze choreography complete minus the chicken sprite.
- Suite green, lint clean, no contrast regression, both breakpoints verified with screenshots.
- Phase 2 (stock integration) plan gets written against THIS landed code.
