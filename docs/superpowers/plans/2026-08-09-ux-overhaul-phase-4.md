# UX/Interaction Overhaul (Phase 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 2026-08-09 UX overhaul design: always-visible CTAs, compact mobile HUD, core-verb-first fight layout, honest meter legend, turn sequencing with hit feedback, onboarding overlay, retire confirmation, focus continuity, grounded disabled states.

**Architecture:** All changes stay inside the existing three layers — render-to-string (`src/ui/render.js`, `src/ui/components.js`), timer-based DOM effects (`src/ui/effects.js`), orchestration (`src/main.js`) — plus the three stylesheets that own each surface. The pure core (`config/combat/economy/game/state`) is untouched.

**Tech Stack:** Vanilla JS + Vite, Vitest + jsdom. Run `npx vitest run <file>` per task; full `npm test` + `npm run lint` at the end.

**Spec:** `docs/superpowers/specs/2026-08-09-ux-overhaul-design.md`

**Ground rules for every task:** tokens only (no new hex/px colour literals outside rgba-ink shadows, which the sheets already use); motion ≤400ms/beat; reduced motion via the existing `reducedMotion()` seam and the base.css blanket; update the test suite in the same commit as the behaviour it pins. The suite is highly self-checking (styles.test.js parses the sheets; grid-areas.test.js resolves the cascade) — after each task run the named suites AND `npm test`; fix any cross-suite assertion the change legitimately invalidates, in the spirit the assertion documents.

---

### Task 1: Grounded disabled states (D9a)

**Files:**

- Modify: `src/styles/base.css` (the `button:disabled` rule, ~line 84)
- Modify: `src/styles/components.css` (`.btn[aria-disabled='true']`, ~line 257; `.btn.is-owned`, ~line 288)
- Test: `tests/styles.test.js` (the opacity-parity test around lines 504–530)

- [ ] **Step 1:** Replace the transparency dimming with opaque ink dimming. In `base.css`:

```css
/* A dead plank stays a plank: fully opaque, dimmed by ink rather than by transparency,
   because the fixed arena backdrop otherwise bleeds through a 45%-opacity button and the
   control reads as a rendering glitch (phase 4 audit). --bone-dim on --wood-4 is 6.43:1. */
button:disabled {
  cursor: not-allowed;
  background: var(--wood-4);
  color: var(--bone-dim);
  box-shadow: none;
}
```

In `components.css`, give the aria-disabled and owned planks the identical treatment (they are the same "dead plank" state, per the old opacity-parity test's reasoning):

```css
.btn[aria-disabled='true'] {
  cursor: not-allowed;
  background: var(--wood-4);
  color: var(--bone-dim);
  box-shadow: none;
}
```

```css
.btn.is-owned {
  cursor: default;
  background: var(--wood-4);
  color: var(--bone-dim);
  box-shadow: none;
}
```

- [ ] **Step 2:** Update `tests/styles.test.js`: the test that held `button:disabled` and `.btn[aria-disabled="true"]` to the same _opacity_ now holds them to the same _ground treatment_ — assert both rules declare `background: var(--wood-4)`, `color: var(--bone-dim)`, and declare **no** `opacity`. Keep the test's original intent comment, updated.

- [ ] **Step 3:** Run `npx vitest run tests/styles.test.js tests/a11y.test.js` — expect PASS. Then `npm test` — fix only assertions that pinned the old opacity treatment.

- [ ] **Step 4:** Verify in browser: hub with 0 injuries/full durability — Repair/Heal read as solid dimmed planks, backdrop no longer bleeds through.

- [ ] **Step 5:** Commit: `fix(ui): ground disabled planks opaquely so the backdrop cannot bleed through`

### Task 2: Honest meter legend + Space hint (D4, D8-part)

**Files:**

- Modify: `src/ui/render.js` (`renderMeter`, the `.meter__labels` line)
- Modify: `src/styles/components.css` (delete `.meter__labels`, add `.meter__legend` + `.legend__chip` + `.key-hint`)
- Test: `tests/render.test.js`, `tests/styles.test.js` (waiver list entry `div.meter__labels > span`, ~line 664)

- [ ] **Step 1:** In `renderMeter`, replace the labels row with a legend that states the zone→verdict mapping (true at every seeded position) instead of implying fixed positions:

```js
return `
      ${state.wins === 0 ? `<p class="meter__taunt snark">${escapeHtml(config.snark.taunt)}</p>` : ''}
      <div class="meter" data-meter="1" tabindex="0" role="button"
        aria-label="Timing meter — press Space or click to strike">
        ${zone('graze')}
        ${zone('hit')}
        ${zone('crit')}
        <div class="meter-cursor"><img class="meter-chicken" src="${chickenUrl}" alt="" /></div>
      </div>
      <div class="meter__legend" aria-hidden="true">
        <span class="legend__item"><i class="legend__chip legend__chip--graze"></i>Graze</span>
        <span class="legend__item"><i class="legend__chip legend__chip--hit"></i>Hit</span>
        <span class="legend__item"><i class="legend__chip legend__chip--crit"></i>Crit</span>
        <span class="legend__item legend__item--miss">elsewhere: miss</span>
        <kbd class="key-hint">Space</kbd>
      </div>`;
```

(`aria-hidden`: the meter's own aria-label names the key, and the log speaks every verdict — the legend is the sighted user's colour-ramp key, redundant to AT.)

- [ ] **Step 2:** In `components.css`, delete the `.meter__labels` rule and add (same file section):

```css
/* Phase 4: the legend states the ramp (brighter gold = better), which is true at every
   seeded zone position — the old fixed six-label row implied positions the zones do not
   keep. aria-hidden markup: the meter's aria-label and the spoken log carry the mapping. */
.meter__legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: var(--space-2) var(--space-3);
  padding-top: var(--space-1);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--bone);
  text-shadow: 0 1px 0 rgba(31, 22, 12, 0.8);
}
.legend__item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}
.legend__chip {
  width: 13px;
  height: 13px;
  border: 1.5px solid var(--border-ink);
  border-radius: 4px 6px 5px 6px;
}
.legend__chip--graze {
  background: var(--gold-mid);
}
.legend__chip--hit {
  background: var(--gold);
}
.legend__chip--crit {
  background: var(--gold-hi);
  border-inline: 2px solid var(--border-ink);
}

/* Phase 4 (D8): visible keyboard affordances. aria-hidden at every call site — labels and
   aria-labels already name the mechanisms; the chip is the sighted shortcut key. Hidden where
   there is no keyboard to hint at. */
.key-hint {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: 700;
  line-height: 1;
  padding: 2px 5px;
  border: 1.5px solid var(--border-ink);
  border-radius: 4px 6px 5px 6px;
  background: var(--paper-2);
  color: var(--ink);
  box-shadow: 0 1.5px 0 rgba(31, 22, 12, 0.5);
}
@media (pointer: coarse) {
  .key-hint {
    display: none;
  }
}
```

- [ ] **Step 3:** Update tests: in `tests/render.test.js` replace any `.meter__labels` assertions with: legend present, `aria-hidden="true"`, contains the three chips and the miss item; in `tests/styles.test.js` update the contrast-waiver entry `'div.meter__labels > span'` to the legend's selector (same waiver rationale: decorative bone-on-stone).

- [ ] **Step 4:** `npx vitest run tests/render.test.js tests/styles.test.js` → PASS; browser-verify the legend under the meter.

- [ ] **Step 5:** Commit: `feat(ui): replace positional meter labels with an honest zone legend + Space hint`

### Task 3: Fight screen core-verb-first DOM order (D3a)

**Files:**

- Modify: `src/ui/render.js` (`renderFight` child order)
- Modify: `src/styles/screens.css` (`.screen--fight` base + ≤900px grids)
- Test: `tests/render.test.js` (the two order tests ~lines 1891–1959), `tests/grid-areas.test.js` (runs as-is; it checks area consistency)

- [ ] **Step 1:** In `renderFight`, reorder the section children to **stage, actions, you, foe, log, press** (HUD and plaque unchanged). Update the long child-order comment to state the new §7 reading order and why (the meter is the turn's first required act, so it is the first tab stop).

- [ ] **Step 2:** In `screens.css`, keep the desktop grid pixel-identical (areas move blocks; order of declarations already irrelevant) and restack the ≤900px grid in the new source order:

```css
.screen--fight {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: none;
  grid-template-areas: 'hud hud' 'stage stage' 'actions actions' 'you foe' 'log log' 'press press';
}
```

- [ ] **Step 3:** Update `tests/render.test.js` expected arrays:

```js
expect(areas).toEqual([
  'fight__stage',
  'fight__actions',
  'fight__you',
  'fight__foe',
  'fight__log',
  'fight__press',
]);
```

```js
expect(stops).toEqual(['meter', 'strike', 'heavy', 'block', 'feint', 'log', 'press']);
```

(the stops order is unchanged — meter and actions simply stop being _after_ the posters in the DOM), and in the "wraps each grid area" test flip the second index assertion to `expect(html.indexOf('data-meter')).toBeLessThan(html.indexOf('fight__foe'))` — still true — plus `expect(html.indexOf('fight__actions')).toBeLessThan(html.indexOf('fight__you'))`.

- [ ] **Step 4:** `npx vitest run tests/render.test.js tests/grid-areas.test.js tests/a11y.test.js` → PASS. Browser-verify desktop fight looks unchanged; at 375px the meter + actions now precede the posters.

- [ ] **Step 5:** Commit: `feat(ui): lead the fight screen with the meter and actions (reading = tab = mobile visual order)`

### Task 4: Compact fight posters ≤900px, mascot/chicken fixes (D3b–d)

**Files:**

- Modify: `src/styles/screens.css` (fight-scoped poster variant)
- Modify: `src/styles/components.css` (`.train-row::before` mobile, taunt/chicken clearance)

- [ ] **Step 1:** Add to `screens.css` (after the ≤900px fight grid):

```css
/* Phase 4 (D3): in a fight at tablet/phone widths the poster is a status strip, not a pin-up —
   portrait beside name/HP so the meter and actions own the fold. Hub and result posters keep
   the full treatment; this variant is fight-screen layout, so it lives here. */
@media (max-width: 900px) {
  .screen--fight .poster {
    display: grid;
    grid-template-columns: 56px 1fr;
    column-gap: var(--space-3);
    align-items: center;
    padding: var(--space-2) var(--space-3);
  }
  .screen--fight .poster__name {
    grid-column: 2;
    margin: 0;
    font-size: var(--text-xl);
    text-align: left;
  }
  .screen--fight .poster__portrait {
    grid-column: 1;
    grid-row: 1 / span 2;
    aspect-ratio: 1 / 1;
    margin: 0;
  }
  .screen--fight .poster .bar {
    grid-column: 2;
    margin-top: var(--space-1);
  }
  .screen--fight .poster__sub,
  .screen--fight .poster .snark {
    grid-column: 1 / -1;
  }
}
@media (max-width: 640px) {
  .screen--fight .poster__sub,
  .screen--fight .poster .snark {
    display: none;
  }
}
```

- [ ] **Step 2:** In `components.css`: hide the decorative training mascots at ≤640px (they collide with the Train buttons there; the icon wells remain):

```css
@media (max-width: 640px) {
  .train-row::before {
    display: none;
  }
}
```

and reserve the chicken's lane so the sweep never runs through the taunt copy:

```css
/* The chicken rides 48px above the track (.meter-chicken bottom: 100%); without a reserved
   lane the taunt line sits inside its flight path at narrow widths. */
.fight__stage .meter {
  margin-top: 52px;
}
.meter__taunt {
  margin-bottom: 0;
}
```

- [ ] **Step 3:** `npm test` → PASS (CSS-only; styles.test.js parses new rules). Browser-verify at 375×812: meter + 4 actions + both fighter strips fit roughly one screen; no sprite collisions.

- [ ] **Step 4:** Commit: `feat(ui): compact fight posters on small screens; fix mascot and chicken collisions`

### Task 5: Compact mobile HUD (D2)

**Files:**

- Modify: `src/styles/components.css` (§6.1 block, mobile amendment)

- [ ] **Step 1:** Append to the §6.1 HUD section:

```css
/* Phase 4 (D2): ≤640px the beam was a ~470px column of one stat per row — half the viewport
   spent before the screen began. Two-up grid, label row above its own bar, tight gaps:
   the same four stats in ≲120px. Nothing leaves the accessibility tree. */
@media (max-width: 640px) {
  .hud {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2) var(--space-4);
    padding: var(--space-2) var(--space-3);
  }
  .hud__stat {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: var(--space-2);
    align-items: center;
  }
  .hud__stat .bar {
    grid-column: 1 / -1;
    width: 100%;
  }
}
```

- [ ] **Step 2:** `npm test` → PASS. Browser-verify at 375×812 (hub + fight): HUD ≤ ~130px tall, numerals legible.

- [ ] **Step 3:** Commit: `feat(ui): compact two-up mobile HUD`

### Task 6: Commit bar always on screen + result hierarchy (D1, D9c)

**Files:**

- Modify: `src/styles/screens.css` (`.commit-bar` ≤640px block → all-widths fixed footer; result recap rules; short-viewport portrait cap)
- Test: `tests/grid-areas.test.js` / `tests/styles.test.js` (whichever pins the mobile commit-bar treatment — update to pin the new invariant: the commit bar is viewport-fixed at every width)

- [ ] **Step 1:** Replace the ≤640px `.commit-bar` rule with an all-widths fixed footer (sticky cannot escape a grid area that is itself below the fold — the audit's core finding — so the bar is taken out of flow entirely and the screen reserves its height):

```css
/* Phase 4 (D1): the primary CTA is a fixed footer at every width. Sticky could not do this
   job: a sticky element cannot leave its containing block, and the commit row's grid area is
   exactly the below-the-fold strip the audit caught. The screen pads its own bottom by the
   bar's reserved height so no content hides beneath it. */
.commit-bar {
  position: fixed;
  bottom: var(--frame-w);
  left: var(--frame-w);
  right: var(--frame-w);
  z-index: var(--z-hud);
  text-align: center;
  padding: var(--space-2) var(--space-4);
  background: var(--grad-wood);
  border-top: var(--border-w) solid var(--border-ink);
}
.screen {
  padding-bottom: calc(76px + var(--space-4));
}
```

(the second declaration merges into the existing `.screen` rule — add the padding-bottom there, keeping the existing `padding` shorthand as `padding: var(--space-4) var(--space-4) calc(76px + var(--space-4));`). Delete the now-dead ≤640px `.commit-bar` block and its `justify-self` reset notes; `.hub__commit::before` (the gladiators) stays.

- [ ] **Step 2:** Result screen hierarchy — verdict first, corpse second:

```css
.result__recap {
  grid-area: recap;
  position: relative;
  text-align: center;
}
.result__recap .banner-stamp {
  font-size: var(--text-4xl);
}
.result__recap .poster {
  max-width: 340px;
  margin: 0 auto;
}
.result__cross {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: min(340px, 100%);
  transform: translateX(-50%);
  pointer-events: none;
}
```

- [ ] **Step 3:** Short-desktop cap so hub/fight lean toward the fold:

```css
@media (max-height: 780px) and (min-width: 641px) {
  .poster__portrait {
    max-height: 150px;
  }
}
```

(`background-size: contain` keeps every portrait intact at the reduced height.)

- [ ] **Step 4:** Update whichever assertions pinned the old ≤640px sticky/stretch treatment (grid-areas.test.js's commit-bar check and any styles.test.js mate) to pin the new invariant: `.commit-bar` declares `position: fixed` unconditionally, and `.screen` reserves bottom padding.

- [ ] **Step 5:** `npm test` → PASS. Browser-verify at 1280×720: Next Fight / Return to Ludus / Fight Again visible without scrolling on hub, result, gameover; at 375×812 unchanged footer behaviour; VICTORY! stamp now dominates the result recap.

- [ ] **Step 6:** Commit: `feat(ui): fixed commit footer at every width; verdict-first result recap`

### Task 7: Empty-log line + damage-taken glyph fix (D9b, D5c)

**Files:**

- Modify: `src/ui/render.js` (`renderFight` log strip)
- Modify: `src/ui/components.js` (SKINS.html.taken)
- Modify: `src/styles/components.css` (§6.9 block)
- Test: `tests/render.test.js`

- [ ] **Step 1:** In `renderFight`, render a placeholder when the log is empty:

```js
const EMPTY_LOG = '<li class="log__entry log__entry--empty"><em>The crowd gathers…</em></li>';
const logHtml = c.log.length ? c.log.map(logEntry).join('') : EMPTY_LOG;
```

(hoist `EMPTY_LOG` to module scope beside the other presentation constants, with a comment: a blank parchment strip reads as a rendering failure, and §6.9's strip is the player's record — an empty record still deserves a line.)

- [ ] **Step 2:** In `components.js`, mark the damage-taken glyph so it cannot scan as a multiplication sign:

```js
    taken: (v) =>
      `<span class="log__glyph" aria-hidden="true">${SWORD}</span>${NBSP}${Number(v)}`,
```

and in `components.css` §6.9:

```css
/* Damage taken: the sword glyph is a channel marker, not arithmetic — inked apart from the
   number so "⚔ 9" cannot scan as "× 9" (phase 4 audit). */
.log__entry .log__glyph {
  color: var(--blood-ink);
  font-size: 0.9em;
}
```

- [ ] **Step 3:** Tests in `tests/render.test.js`: empty combat log renders exactly one `.log__entry--empty`; a non-empty log renders none; the taken skin emits `class="log__glyph"` with `aria-hidden`.

- [ ] **Step 4:** `npx vitest run tests/render.test.js` → PASS; `npm test` → PASS.

- [ ] **Step 5:** Commit: `fix(ui): placeholder line for the empty log; distinguish the damage-taken glyph`

### Task 8: Hit feedback primitives (D5b)

**Files:**

- Modify: `src/ui/effects.js` (add `HIT_FLASH_MS`, `ENEMY_BEAT_MS`, `hitFlash`, `spawnDamageChip`)
- Modify: `src/styles/components.css` (poster tilt var refactor, `.is-hit`, `.damage-chip`)
- Modify: `src/styles/base.css` (reduced-motion carve-out gains `.damage-chip`)
- Test: `tests/effects.test.js`

- [ ] **Step 1:** Refactor poster tilt to a custom property so an animation can compose with it (an animated `transform` would otherwise discard the tilt — the chicken's own `--flip` lesson):

```css
.poster--tilt-1 {
  --poster-tilt: var(--tilt-1);
}
.poster--tilt-2 {
  --poster-tilt: var(--tilt-2);
}
.poster--tilt-3 {
  --poster-tilt: var(--tilt-3);
}
.poster {
  border-radius: var(--wobble-1);
  padding: var(--space-4);
  transform: rotate(var(--poster-tilt, 0deg));
}
```

- [ ] **Step 2:** Add the hit treatment (blood tint on the portrait's own overlay — `.poster`'s ::before/::after are the tape strips, so the overlay lives on the portrait):

```css
/* Phase 4 (D5): the struck fighter's card jolts and its portrait flashes blood for one
   --dur-shake. State class is applied/removed by ui/effects.js on its own timer. */
.poster.is-hit {
  animation: poster-hit var(--dur-shake) steps(3, end);
}
@keyframes poster-hit {
  33% {
    transform: translateX(-4px) rotate(var(--poster-tilt, 0deg));
  }
  66% {
    transform: translateX(4px) rotate(var(--poster-tilt, 0deg));
  }
}
.poster__portrait::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--blood);
  opacity: 0;
  pointer-events: none;
}
.poster.is-hit .poster__portrait::after {
  animation: hit-tint var(--dur-shake) var(--ease-drop);
}
@keyframes hit-tint {
  0%,
  66% {
    opacity: 0.25;
  }
  100% {
    opacity: 0;
  }
}

/* The floating damage figure — the delta chip's pattern, seated on the hurt poster. */
.damage-chip {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  z-index: var(--z-chip);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  font-size: var(--text-lg);
  color: var(--blood-ink);
  padding: 1px 8px;
  background: var(--grad-paper);
  border: 2px solid var(--border-ink);
  border-radius: var(--wobble-bar);
  white-space: nowrap;
  animation: chip-fall var(--dur-chip) steps(4, end) forwards;
}
```

and in `base.css`'s reduced-motion block extend the carve-out (the generalised styles test will demand this):

```css
.delta-chip,
.damage-chip {
  animation: none !important;
}
```

- [ ] **Step 3:** In `effects.js` add (beside the existing constants and chip machinery, reusing `chipTimers`/`dropChip`):

```js
// Phase 4 (D5): the presentation beat between the player's render and the enemy's reply.
// Pacing only — outcomes are computed by the same pure calls in the same order.
export const ENEMY_BEAT_MS = 550;
// --dur-shake's consumer for the struck poster, same contract as purseShake.
export const HIT_FLASH_MS = 300;

const hitTimers = new WeakMap();
// Jolt + blood tint on the struck fighter's card (spec phase-4 D5). Class on, class off,
// restart-safe — purseShake's exact shape, for the same reasons.
export function hitFlash(poster) {
  if (!poster || reducedMotion()) return;
  clearTimeout(hitTimers.get(poster));
  poster.classList.remove('is-hit');
  void poster.offsetWidth;
  poster.classList.add('is-hit');
  hitTimers.set(
    poster,
    setTimeout(() => poster.classList.remove('is-hit'), HIT_FLASH_MS)
  );
}

// The floating damage figure on whichever fighter lost health between two renders.
// `amount` is the health lost (positive). Zero/absent damage spawns nothing — a blocked
// no-damage exchange is silence, not a "−0".
export function spawnDamageChip(poster, amount, { lifeMs = CHIP_LIFE_MS } = {}) {
  if (!poster || !(amount > 0)) return null;
  const chip = document.createElement('span');
  chip.className = 'damage-chip';
  chip.textContent = `${MINUS}${amount}`;
  poster.appendChild(chip);
  chipTimers.set(
    chip,
    setTimeout(() => dropChip(chip), reducedMotion() ? REDUCED_CHIP_LIFE_MS : lifeMs)
  );
  return chip;
}
```

- [ ] **Step 4:** Tests in `tests/effects.test.js` (same fake-timer style as `purseShake`'s): `hitFlash` adds then removes `.is-hit` after `HIT_FLASH_MS`; is a no-op under reduced motion; restarts cleanly when called twice. `spawnDamageChip` mounts `.damage-chip` with `−N` text; removes it after `CHIP_LIFE_MS` (`REDUCED_CHIP_LIFE_MS` reduced); spawns nothing for `0`/negative/absent poster.

- [ ] **Step 5:** `npx vitest run tests/effects.test.js tests/styles.test.js` → PASS; `npm test` → PASS.

- [ ] **Step 6:** Commit: `feat(ui): hit-flash and damage-chip feedback primitives`

### Task 9: Turn sequencing + input guard (D5a)

**Files:**

- Modify: `src/main.js` (`doPlayerAction`, `doPress`, `enemyResponds`, `newRun`, keydown handler, `render`)
- Test: `tests/main.test.js`

- [ ] **Step 1:** In `main.js` import the new primitives and add the guard state:

```js
import {
  runLedgerTheater,
  spawnDeltaChip,
  spawnShortfallChip,
  purseShake,
  tickTo,
  hitFlash,
  spawnDamageChip,
  reducedMotion,
  ENEMY_BEAT_MS,
} from './ui/effects.js';
```

```js
// Phase 4 (D5): the exchange lands in two renders — the player's, then the enemy's one beat
// later — so the reply reads as an event instead of a simultaneous ledger update. `resolving`
// is the guard between them: the pure core still runs the same calls in the same order, so a
// click smuggled into the beat would not corrupt anything, but it *would* act on a turn the
// player has not seen yet.
let resolving = false;
let enemyTimer = 0;
```

- [ ] **Step 2:** Sequence the exchange. `doPlayerAction` becomes:

```js
function doPlayerAction(action) {
  if (resolving) return;
  const foeBefore = state.combat.enemy.health;
  const timing = currentTiming();
  let combat = applyPlayerAction(state.combat, action, timing, CONFIG);
  combat = markPressable(combat, action, timing);
  state = { ...state, combat };

  if (isFightOver(state.combat)) return endFight();
  if (state.combat.canPress) {
    state = { ...state, combat: { ...state.combat, sweet: seedSweet() } };
    render();
    strikeFeedback(foeBefore);
    return;
  }
  render();
  strikeFeedback(foeBefore);
  scheduleEnemy();
}
```

with the two helpers:

```js
// Feedback on the fighter who just lost health, read at the render seam — the renderer is
// handed one state and no history, exactly the moveTheMoney arrangement.
function strikeFeedback(foeBefore) {
  const lost = foeBefore - state.combat.enemy.health;
  const foe = app.querySelector('.fight__foe .poster');
  if (lost > 0 && foe) {
    hitFlash(foe);
    spawnDamageChip(foe, lost);
  }
}

function scheduleEnemy() {
  resolving = true;
  // The waiting beat: the meter does not sweep (render() skips startMeter while resolving)
  // and the actions are dead planks, so the pause reads as the foe's wind-up.
  for (const b of app.querySelectorAll('.fight__grid .btn')) b.disabled = true;
  enemyTimer = setTimeout(
    () => {
      resolving = false;
      enemyResponds();
    },
    reducedMotion() ? 0 : ENEMY_BEAT_MS
  );
}
```

`doPress` gets the same shape (guard at the top; on the not-over path `render(); strikeFeedback(foeBefore); scheduleEnemy();` — capturing `const foeBefore = state.combat.enemy.health;` before `applyPress`). `enemyResponds` reads the player's health before the enemy turn and lands the feedback after its render:

```js
function enemyResponds() {
  const mineBefore = playerHealth(state).value;
  const combat = enemyTurn(state.combat, rng, CONFIG);
  state = { ...state, combat: { ...combat, sweet: seedSweet() } };
  if (isFightOver(state.combat)) return endFight();
  render();
  const lost = mineBefore - playerHealth(state).value;
  const you = app.querySelector('.fight__you .poster');
  if (lost > 0 && you) {
    hitFlash(you);
    spawnDamageChip(you, lost);
  }
}
```

(`playerHealth` is already imported? It is not — add `import { playerHealth } from './game.js';` to the existing game.js import list.) In `render()`, change the meter start line to `if (state.phase === PHASE.FIGHT && !resolving) startMeter();`. In `newRun()`, add `clearTimeout(enemyTimer); resolving = false;`. In the document keydown handler add `if (resolving) return;` before the lookup. In `captureMeter`, the `sweep.running` guard already covers the beat (the sweep never started).

- [ ] **Step 3:** Tests in `tests/main.test.js` (the file's own fake-clock idiom): an action renders the player's log line immediately but the enemy's reply only after `ENEMY_BEAT_MS`; keys 1–4 and Space are dead during the beat; under reduced motion the reply lands on the 0ms timer; a press-the-attack offer does not schedule the enemy (unchanged behaviour); the struck poster carries `.is-hit` and a `.damage-chip` after the reply.

- [ ] **Step 4:** `npx vitest run tests/main.test.js` → PASS; `npm test` → PASS. Browser-verify a fight: your hit lands, foe flinches with a −N; a beat later the reply arrives with your own flinch.

- [ ] **Step 5:** Commit: `feat(ui): sequence the exchange — enemy replies one beat later with hit feedback`

### Task 10: Focus continuity across renders (D8b)

**Files:**

- Modify: `src/main.js` (`render`)
- Test: `tests/main.test.js`

- [ ] **Step 1:** In `render()`, capture before `mount()` and restore after the phase-specific work:

```js
// Phase 4 (D8): mount() replaces #app wholesale, which drops focus to <body> on every
// action — a keyboard user had to re-tab to the meter each exchange. Remember what was
// focused by its stable hook (data-action / the meter), and restore it in the new tree.
const active = document.activeElement;
const focusKey =
  active && app.contains(active)
    ? active.hasAttribute('data-meter')
      ? 'meter'
      : active.getAttribute('data-action')
    : null;
```

and at the end of `render()`:

```js
restoreFocus(focusKey);
```

```js
function restoreFocus(key) {
  if (!key) return;
  const el =
    key === 'meter'
      ? app.querySelector('[data-meter]')
      : app.querySelector(`[data-action="${key}"]:not([disabled])`);
  // A fight keeps the player on the meter when their old control is gone (an action button
  // during the enemy beat, a press offer that resolved) — the meter is the next required act.
  const target = el ?? (state.phase === PHASE.FIGHT ? app.querySelector('[data-meter]') : null);
  target?.focus({ preventScroll: true });
}
```

- [ ] **Step 2:** Tests in `tests/main.test.js`: focus the meter, resolve a turn via keyboard → focus is on the new meter node after the re-render; focus a hub Train button, click it → focus is on the same `data-action` button in the new tree; nothing focused → focus stays on `<body>` (no focus stealing).

- [ ] **Step 3:** `npx vitest run tests/main.test.js` → PASS; `npm test` → PASS.

- [ ] **Step 4:** Commit: `feat(a11y): restore focus across re-renders`

### Task 11: Retire confirmation (D7)

**Files:**

- Modify: `src/main.js` (retire handler; rename the `game.js` import to `retireRun` to free the handler name)
- Test: `tests/main.test.js`

- [ ] **Step 1:** Rename the import (`retire as retireRun`) and replace the handler:

```js
// Phase 4 (D7): the one-click run-ender arms first. DOM-only state — any other action
// re-renders the hub and thereby disarms, which is correct: any other action is itself a "no".
const RETIRE_DISARM_MS = 2500;
let retireTimer = 0;
```

```js
  retire: (el) => {
    if (!el.classList.contains('is-armed')) {
      el.classList.add('is-armed', 'btn--danger');
      el.textContent = 'Sure? Retiring ends the run';
      announcer.textContent = 'Press again to retire and end the run.';
      retireTimer = setTimeout(() => render(), RETIRE_DISARM_MS);
      return;
    }
    clearTimeout(retireTimer);
    state = retireRun(state);
    render();
  },
```

(`newRun()` also clears `retireTimer`.)

- [ ] **Step 2:** Tests in `tests/main.test.js`: first activation arms (class + copy + polite announcement) and does NOT change phase; second activation within the window reaches GAMEOVER with `ended: 'retired'`; after `RETIRE_DISARM_MS` the button re-renders disarmed; arming then doing anything else disarms.

- [ ] **Step 3:** `npx vitest run tests/main.test.js` → PASS; `npm test` → PASS.

- [ ] **Step 4:** Commit: `feat(ui): two-step retire confirmation`

### Task 12: Onboarding overlay (D6)

**Files:**

- Modify: `src/main.js` (overlay builder, called once at boot)
- Modify: `src/styles/components.css` (`.intro-scrim` / `.intro`)
- Test: `tests/main.test.js`, `tests/a11y.test.js`

- [ ] **Step 1:** In `main.js`, after `newRun()` at the bottom, build the overlay the way the live regions are built — outside `#app`, once per page load (Fight Again's `newRun()` never re-creates it):

```js
// Phase 4 (D6): the one-time intro. Outside #app like the live regions, so renderers and the
// state machine stay untouched; per page load, not per run — Fight Again skips it.
function showIntro() {
  const scrim = document.createElement('div');
  scrim.className = 'intro-scrim';
  scrim.innerHTML = `
    <section class="intro parchment tape" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <h1 id="intro-title">Gold &amp; Glory</h1>
      <p class="snark intro__premise">(Death or glory, and a small administrative fee.)</p>
      <ol class="intro__steps">
        <li>Watch the chicken sweep the meter.</li>
        <li>Click, tap or press <kbd class="key-hint">Space</kbd> to freeze it — land on the gold.</li>
        <li>Pick an action: <b>Strike</b>, <b>Heavy</b>, <b>Block</b> or <b>Feint</b>.</li>
      </ol>
      <p class="snark">(Win purses. The arena taxes them. Everything else costs gold.)</p>
      <button class="btn btn--commit" data-intro-start>Enter the Arena ▸</button>
    </section>`;
  document.body.appendChild(scrim);
  const start = scrim.querySelector('[data-intro-start]');
  const onKey = (e) => {
    if (e.key === 'Escape') return close();
    // One focusable control: the dialog's whole tab ring is the Start button.
    if (e.key === 'Tab') {
      e.preventDefault();
      start.focus();
    }
  };
  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    scrim.remove();
    app.querySelector('[data-action="next-fight"]')?.focus({ preventScroll: true });
  };
  start.addEventListener('click', close);
  // Capture phase: the fight-keys listener also lives on the document, and the dialog must
  // answer first (the game is HUB-phased under the intro, so nothing contests it today —
  // capture keeps that true if boot flow ever changes).
  document.addEventListener('keydown', onKey, true);
  start.focus();
}
showIntro();
```

Note the kbd copy reads "Click, tap or press Space" so the sentence survives `@media (pointer: coarse)` hiding the chip.

- [ ] **Step 2:** CSS in `components.css`:

```css
/* Phase 4 (D6): the one-time intro. Scrim at --z-modal; the card is ordinary parchment. */
.intro-scrim {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: rgba(31, 22, 12, 0.55);
}
.intro {
  max-width: 34rem;
  padding: var(--space-5);
  border-radius: var(--wobble-1);
  transform: rotate(var(--tilt-3));
  animation: stamp-in var(--dur-stamp) var(--ease-drop);
}
.intro h1 {
  font-size: var(--text-3xl);
  text-align: center;
}
.intro__premise {
  text-align: center;
}
.intro__steps {
  margin: var(--space-4) 0;
  padding-left: 1.5em;
  display: grid;
  gap: var(--space-2);
}
.intro .btn--commit {
  display: block;
  margin: var(--space-4) auto 0;
}
```

- [ ] **Step 3:** Tests: `tests/main.test.js` — overlay present after module load with `role="dialog"`, `aria-modal`, focus on Start; click Start → overlay gone, focus on Next Fight; Escape closes; Fight Again after a run does NOT resurrect it. `tests/a11y.test.js` — dialog is labelled by its `<h1>`; the kbd chip is inside real copy, not the only channel. Existing main.test.js cases that assume a pristine document may need the overlay dismissed in their setup — add one `beforeEach` line where required (`document.querySelector('[data-intro-start]')?.click()`).

- [ ] **Step 4:** `npx vitest run tests/main.test.js tests/a11y.test.js` → PASS; `npm test` → PASS. Browser-verify: overlay on load, teaches the loop, dismisses to the hub, does not return after Fight Again.

- [ ] **Step 5:** Commit: `feat(ui): one-time onboarding overlay teaching the meter-then-action loop`

### Task 13: Keyboard hints on the fight actions (D8a)

**Files:**

- Modify: `src/ui/components.js` (`btn()` gains `keyHint`)
- Modify: `src/ui/render.js` (`renderFight` action buttons pass hints)
- Test: `tests/render.test.js`, `tests/a11y.test.js`

- [ ] **Step 1:** In `btn()`'s options add `keyHint = ''`, and in the returned markup append after the label (before the price slot):

```js
const kbd = keyHint ? `<kbd class="key-hint" aria-hidden="true">${escapeHtml(keyHint)}</kbd>` : '';
```

```js
return (
  `<button${actionAttr} class="${classes.join(' ')}"${attrs}>` +
  `${well}${escapeHtml(label)}${kbd}${priceSlot}${snarkAside(snark, missingAttr, missingAmount)}</button>`
);
```

- [ ] **Step 2:** In `renderFight`:

```js
          ${btn('strike', 'Strike', { keyHint: '1' })}
          ${btn('heavy', 'Heavy', { keyHint: '2' })}
          ${btn('block', 'Block', { keyHint: '3' })}
          ${btn('feint', 'Feint', { keyHint: '4' })}
```

- [ ] **Step 3:** Tests: each fight action button contains an `aria-hidden` `.key-hint` with its digit; a hint-less `btn()` emits no `<kbd>`; a11y — the hint never appears inside the accessible name (the digits are hidden).

- [ ] **Step 4:** `npx vitest run tests/render.test.js tests/a11y.test.js` → PASS; `npm test` → PASS.

- [ ] **Step 5:** Commit: `feat(ui): visible key hints on the fight actions`

### Task 14: Full verification

- [ ] **Step 1:** `npm test` → all suites PASS. `npm run lint` → clean. `npm run format:check` → clean (run `npm run format` if not).
- [ ] **Step 2:** Browser pass at 1280×720: intro → hub (CTA visible, disabled planks grounded) → fight (legend, key hints, sequenced exchange with flashes and −N chips, focus restored to the meter) → result (big stamp, capped poster, visible CTA) → retire arm/confirm → gameover → Fight Again (no intro).
- [ ] **Step 3:** Browser pass at 375×812: HUD ≤ ~130px; meter + actions above the fold; compact fighter strips; fixed footer CTA; no sprite collisions.
- [ ] **Step 4:** Amend the spec's D1 wording (sticky → fixed footer) with a one-line note citing the containing-block reason. Commit any fixups: `chore(ui): phase 4 verification fixups`.
