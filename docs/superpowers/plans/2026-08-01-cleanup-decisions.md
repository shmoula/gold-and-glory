# Cleanup: Resolve the 15 Open Decisions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land every decision recorded in `docs/superpowers/specs/2026-08-01-cleanup-decisions-design.md` — the damage floor, title-case labels, three visual spec gaps, the five-part a11y bundle, and the structural-debt resolutions — keeping the suite green throughout.

**Architecture:** No new modules. Pure-logic change in `src/combat.js` + `src/config.js`; markup/copy changes in `src/ui/render.js` + `src/ui/components.js`; CSS in `src/styles/*.css`; announcements in `src/main.js`. Every spec-facing change edits the living spec (`docs/superpowers/specs/2026-07-23-gold-and-glory-design-system.md`, "the spec" below) in the same commit as the code, so the two never disagree.

**Tech Stack:** Vanilla JS (ES modules), Vite, Vitest + jsdom. Run everything from the repo root. Branch: `feat/cleanup-decisions` (already exists, carries the design docs).

**Read first:** the design doc (path above). Its section numbers (§1–§6) are referenced per task. PROGRESS item numbers refer to `docs/superpowers/plans/2026-07-24-design-system-PROGRESS.md`.

**House rules that bind every task here** (from PROGRESS, hard-won):
- Never paste invisible/lookalike characters (U+00A0, U+2212, U+2014); write escapes (`−`) or reuse the exported `MINUS` from `src/ui/format.js`.
- jsdom has no layout engine — never claim a layout works without the Task 15 browser pass.
- Scratch scripts must sit in the **repo root** (jsdom/node won't resolve project imports from /tmp) and be deleted before committing.
- The Browser pane fires 0 rAF frames; do not try to watch the meter sweep there.

---

## File Structure (all existing files; no new source files)

| File | Changes in this plan |
| --- | --- |
| `src/config.js` | + `combat.minHitDamage` |
| `src/combat.js` | + `floorLandedDamage`, floor wired into `computeDamage` and `enemyTurn` |
| `src/ui/render.js` | labels, meter role, log `aria-live`, stamp/result helpers, `gameoverSummary`, `.parchment` classes |
| `src/ui/components.js` | icon well in `shopItem`, `bannerStamp` loses `status`, `.parchment` classes |
| `src/main.js` | `announceEnding()` for GAMEOVER |
| `src/styles/base.css` | `#app` loses the duplicate page column |
| `src/styles/components.css` | dog-ear, icon well, 4:3 portrait, contrast raises, `.parchment`, dead-rule pruning |
| `src/styles/tokens.css` | unreferenced tokens pruned |
| `tests/combat.test.js` | floor tests |
| `tests/styles.test.js` | contrast-blend tests, parchment gate, shortfall guard, Law-4 calibration update |
| `tests/render.test.js`, `tests/main.test.js`, `tests/a11y.test.js` | expectations updated per task |
| the spec (2026-07-23) | §1, §6.0, §6.2, §6.4, §6.9 note, §7 comment, §8 — edited beside their code |
| PROGRESS (2026-07-24) | open-decisions section marked resolved (Task 14) |

---

### Task 1: Damage floor (design §1, item 24)

**Files:**
- Modify: `src/config.js:47-62` (the `combat` block)
- Modify: `src/combat.js:19-34` (`computeDamage`), `src/combat.js:195-225` (`enemyTurn`)
- Test: `tests/combat.test.js`

- [ ] **Step 1: Write the failing tests**

In `tests/combat.test.js`, find the existing test at ~line 71-75 (`guard` zeroing a hit — it expects `.toBe(0)`) and REPLACE it, then add the three new tests beside it. The file already imports `computeDamage`, `createCombat`, `applyPlayerAction`, `enemyTurn`, `isFightOver`, `fightWinner`, `TIMING`, `CONFIG`, and `makeRng` — check the header and add any of these that are missing.

```js
it('a landed hit cannot be mitigated below the floor (item 24)', () => {
  expect(
    computeDamage({ baseDamage: 1, power: 0, guard: 99, timing: TIMING.HIT, config: CONFIG })
  ).toBe(CONFIG.combat.minHitDamage);
});

it('a miss still deals exactly 0', () => {
  expect(
    computeDamage({ baseDamage: 99, power: 99, guard: 0, timing: TIMING.MISS, config: CONFIG })
  ).toBe(0);
});

it('reads the floor from config, not a literal', () => {
  const config = { ...CONFIG, combat: { ...CONFIG.combat, minHitDamage: 3 } };
  expect(
    computeDamage({ baseDamage: 1, power: 0, guard: 99, timing: TIMING.HIT, config })
  ).toBe(3);
});

it('block cannot reduce a landed hit below the floor', () => {
  // rng() = 0.99 rolls the top tier (weights accumulate to crit at 1.0), so the enemy lands
  // a crit into a 999 guard: computeDamage floors it to 1, then block's 60% cut rounds it
  // back to 0 — the floor must be re-applied after the cut or the stall survives.
  const player = { health: 100, maxHealth: 100, power: 5, guard: 999, speed: 5,
    critWindowMult: 1, weaponBroken: false };
  let combat = createCombat(player, CONFIG.opponents[0], CONFIG);
  combat = applyPlayerAction(combat, 'block', TIMING.MISS, CONFIG);
  const before = combat.player.health;
  combat = enemyTurn(combat, () => 0.99, CONFIG);
  expect(before - combat.player.health).toBe(CONFIG.combat.minHitDamage);
});

it('a max-guard turtle cannot stall forever (the item-24 fight)', () => {
  const rng = makeRng(7);
  const player = { health: 100, maxHealth: 100, power: 5, guard: 999, speed: 5,
    critWindowMult: 1, weaponBroken: false };
  let combat = createCombat(player, CONFIG.opponents[0], CONFIG);
  let exchanges = 0;
  while (!isFightOver(combat) && exchanges < 2000) {
    combat = applyPlayerAction(combat, 'block', TIMING.MISS, CONFIG);
    if (!isFightOver(combat)) combat = enemyTurn(combat, rng, CONFIG);
    exchanges += 1;
  }
  expect(isFightOver(combat)).toBe(true);
  expect(fightWinner(combat)).toBe('enemy');
});
```

- [ ] **Step 2: Run and verify they fail**

Run: `npx vitest run tests/combat.test.js`
Expected: the five tests above FAIL (`minHitDamage` undefined → `Math.max(undefined, …)` is NaN, or damage 0); everything else passes.

- [ ] **Step 3: Add the config value**

In `src/config.js`, inside the `combat: {` block, directly under `timingMult`:

```js
    // Item 24 (design 2026-08-01 §1): a landed hit — graze, hit or crit — always deals at
    // least this much after ALL mitigation, both directions. What makes a max-guard turtle's
    // fight terminate instead of running forever.
    minHitDamage: 1,
```

- [ ] **Step 4: Implement the floor**

In `src/combat.js`, add below `resolveTiming` (after line 17):

```js
// Item 24: the single spelling of the damage floor. Applied at the END of each attack's
// damage pipeline — computeDamage's clamp AND enemyTurn's post-block cut — because a floor
// applied before Block's reduction is a floor Block undoes. A miss passes through untouched.
export function floorLandedDamage(dmg, timing, config) {
  if (timing === TIMING.MISS) return dmg;
  return Math.max(config.combat.minHitDamage, dmg);
}
```

In `computeDamage`, replace the final line `return Math.max(0, Math.round(dmg));` with:

```js
  return floorLandedDamage(Math.round(dmg), timing, config);
```

In `enemyTurn`, replace `dmg = Math.round(dmg * (1 - config.combat.actions.block.damageReduction));` with:

```js
    dmg = floorLandedDamage(
      Math.round(dmg * (1 - config.combat.actions.block.damageReduction)),
      tier,
      config
    );
```

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all green. If any *other* test fails, it encodes the old zero-out behavior — reconcile it against design §1 (a landed hit now pays ≥1), never by weakening the new tests.

- [ ] **Step 6: Commit**

```bash
git add src/config.js src/combat.js tests/combat.test.js
git commit -m "fix(combat): landed hits floor at config.combat.minHitDamage (item 24)"
```

---

### Task 2: Title-case button labels (design §2, item 4)

**Files:**
- Modify: `src/ui/render.js:136` (`Repair weapon`), `:143` (`Heal N injuries`), `:155` (`Bribe official — …`)

- [ ] **Step 1: Edit the three call sites**

In `src/ui/render.js` (current text shown; title-case the verb phrase, keep mechanical clauses sentence-case):

1. Line ~136: `btn('repair', 'Repair weapon', {` → `btn('repair', 'Repair Weapon', {`
2. Line ~143: change the heal label expression to:
   ```js
   btn('heal', `Heal ${state.injuries} ${state.injuries === 1 ? 'Injury' : 'Injuries'}`, {
   ```
3. Line ~155: `` `Bribe official — tax ${config.arena.taxRate * 100}% → ${config.arena.bribedTaxRate * 100}%`, `` → `` `Bribe Official — tax ${config.arena.taxRate * 100}% → ${config.arena.bribedTaxRate * 100}%`, ``

All other labels (`Retire Rich`, `Next Fight ▸`, `Return to Ludus`, `Press the Attack ▸` — "the" is correctly lowercase, `Fight Again ▸`, `Train +N`, `Bribed ✓`, `Strike/Heavy/Block/Feint`) already conform; do not touch them. §9 of the spec is already title case; no spec edit.

- [ ] **Step 2: Run the suite**

Run: `npm test`
Expected: green (a repo-wide grep for `'Repair weapon'` / `'Bribe official'` in `tests/` finds no assertions today; if one fails anyway, update its expectation string to the new casing).

- [ ] **Step 3: Commit**

```bash
git add src/ui/render.js
git commit -m "fix(ui): title-case button labels per spec §9 (item 4)"
```

---

### Task 3: Poster portrait is a true 4:3 well (design §3, item 10)

**Files:**
- Modify: `src/styles/components.css:243-261` (`.poster__portrait`, `.poster__silhouette`)

- [ ] **Step 1: Edit the two rules**

In `.poster__portrait`, replace `height: 104px;` with `aspect-ratio: 4 / 3;` — the rest of the rule is untouched. Replace `.poster__silhouette` entirely with (the well is taller now, so the fallback centers itself instead of hanging at a fixed offset):

```css
.poster__silhouette {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 54px;
  height: 60px;
  transform: translate(-50%, -50%);
  background: var(--silhouette);
  border-radius: 46% 46% 40% 40%;
}
```

- [ ] **Step 2: Run the suite**

Run: `npm test`
Expected: green. (`grep -n "104" tests/styles.test.js` — if any assertion pins the old height, update it to assert `aspect-ratio: 4 / 3` instead.)

- [ ] **Step 3: Commit**

```bash
git add src/styles/components.css
git commit -m "fix(ui): poster portrait is the 4:3 well spec §6.5 always specified (item 10)"
```

---

### Task 4: Sponsor card dog-ear (design §3, item 8)

**Files:**
- Modify: `src/styles/components.css:331-350` (the §6.10 block)

- [ ] **Step 1: Add the pseudo-element**

`.sponsor-card` already exists; add `position: relative;` to it, then add below the `.sponsor-card__name` rule:

```css
/* §6.10's dog-eared corner — the recurring comedy vehicle's recognition mark. One pseudo,
   three gradient stops: the page-tone corner "behind" the fold, the ink fold line, the
   darker flap. Decorative; pseudo-content is invisible to AT. */
.sponsor-card::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 26px;
  height: 26px;
  background: linear-gradient(
    to bottom left,
    var(--paper-3) 46%,
    var(--border-ink) 46% 54%,
    var(--paper-5) 54%
  );
  border-bottom-left-radius: 9px;
}
```

- [ ] **Step 2: Run the suite**

Run: `npm test`
Expected: green (the token-resolution test in `tests/styles.test.js` verifies the three `var()`s resolve). Exact pixel look is Task 15's browser pass.

- [ ] **Step 3: Commit**

```bash
git add src/styles/components.css
git commit -m "feat(ui): sponsor card dog-eared corner per spec §6.10 (item 8)"
```

---

### Task 5: Shop item icon well (design §3, item 9)

**Files:**
- Modify: `src/ui/components.js:172-190` (`shopItem`)
- Modify: `src/styles/components.css` (§6.12 block, ~line 300)

- [ ] **Step 1: Emit the well in both branches**

In `shopItem()`, add the well span as the first child in BOTH return values (owned and buyable). Owned branch becomes:

```js
    return `<div class="shop-item is-owned">
        <span class="shop-item__icon" aria-hidden="true"></span>
        <span class="shop-item__name">${escapeHtml(item.name)}</span>
        <span class="shop-item__owned">✓ Owned</span></div>`;
```

and the buyable branch's button gains the same `<span class="shop-item__icon" aria-hidden="true"></span>` line directly above its `shop-item__name` span.

- [ ] **Step 2: Style the well**

In `components.css`, below the `.shop-item__name` rule:

```css
/* §6.12's icon well: the portrait well's recession treatment, sized for an icon. Empty until
   the visual phase delivers icons (design 2026-08-01 §3) — an empty recessed well reads as an
   intentional slot, and §10's zero-asset rule holds. */
.shop-item__icon {
  width: 34px;
  height: 34px;
  background: radial-gradient(circle at 50% 42%, var(--paper-4), var(--paper-5));
  border: 2px solid var(--border-ink);
  border-radius: 8px 11px 9px 12px;
}
```

- [ ] **Step 3: Run the suite**

Run: `npm test`
Expected: green. If a `render.test.js` assertion indexes shop-card children positionally, update it for the new first child.

- [ ] **Step 4: Commit**

```bash
git add src/ui/components.js src/styles/components.css
git commit -m "feat(ui): shop item icon well per spec §6.12 (item 9)"
```

---

### Task 6: Contrast raises for locked/owned text + §8 policy (design §4a, item 33)

**Files:**
- Modify: `src/styles/components.css` (`.ending-card--locked` ~line 584, `.shop-item.is-owned` ~line 321, `.shop-item__owned` ~line 326)
- Modify: the spec, §8
- Test: `tests/styles.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/styles.test.js` (it already defines `css`, `hexOf`, `contrast`, `round2`):

```js
// Design 2026-08-01 §4a (item 33): text a player is meant to read clears 4.5:1 even inside a
// dimmed card. A card dimmed via `opacity` composites its text toward the ground per channel
// in gamma sRGB space (what browsers actually do): ch' = a*ch + (1-a)*bg. grayscale() is
// luminance-preserving (its matrix IS the luminance weights), so it barely moves the ratio
// and is ignored here.
describe('dimmed-card text still clears the §8 floor (design 2026-08-01 §4a)', () => {
  const blend = (fg, bg, a) => {
    const ch = (hex, i) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
    const mix = (i) => Math.round(a * ch(fg, i) + (1 - a) * ch(bg, i));
    return `#${[0, 1, 2].map((i) => mix(i).toString(16).padStart(2, '0')).join('')}`;
  };
  const opacityOf = (selector) => {
    const rule = css.match(new RegExp(`${reEscape(selector)}\\s*\\{([^}]*)\\}`));
    expect(rule, `no ${selector} rule`).not.toBeNull();
    const m = rule[1].match(/opacity:\s*([\d.]+)/);
    expect(m, `${selector} declares no opacity`).not.toBeNull();
    return Number(m[1]);
  };
  // Both paper stops: the card's gradient runs paper-1 -> paper-3, so text must read on the
  // darker end too, exactly as the wordmark measurements were taken.
  const GROUNDS = ['--paper-2', '--paper-3'];

  it('locked ending-card text (title and snark, both ink after the recolor)', () => {
    const a = opacityOf('.ending-card--locked');
    for (const g of GROUNDS) {
      const ratio = round2(contrast(blend(hexOf('--ink'), hexOf(g), a), hexOf(g)));
      expect(ratio, `ink @ ${a} on ${g}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('recolors the locked snark to full ink (ink-soft cannot clear the floor dimmed)', () => {
    expect(css).toMatch(
      /\.ending-card--locked\s+\.snark\s*\{[^}]*color:\s*var\(--color-text\)/
    );
  });

  it('owned shop-card text ("✓ Owned" and the name, ink after the recolor)', () => {
    const a = opacityOf('.shop-item.is-owned');
    for (const g of GROUNDS) {
      const ratio = round2(contrast(blend(hexOf('--ink'), hexOf(g), a), hexOf(g)));
      expect(ratio, `ink @ ${a} on ${g}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(css).toMatch(/\.shop-item__owned\s*\{[^}]*color:\s*var\(--color-text\)/);
  });
});
```

- [ ] **Step 2: Run and verify it fails**

Run: `npx vitest run tests/styles.test.js`
Expected: FAIL — ink at the current opacities (0.55 / 0.6) lands ≈3.4 / ≈3.9 on `--paper-2`, and the recolor rules don't exist yet.

- [ ] **Step 3: Edit the three rules**

In `components.css`:

```css
/* Was opacity .55: ink text under that composite measures ~3.4:1 on paper-2 — below §8's
   floor. .75 keeps the faded locked look and clears 4.5:1 on both paper stops (design
   2026-08-01 §4a); the grayscale is luminance-preserving, so it is not part of the math. */
.ending-card--locked {
  filter: grayscale(0.8);
  opacity: 0.75;
}
/* The epitaph is real text a player is meant to read (§4a): full ink, because --ink-soft
   composited at .75 is ~3.4:1. The grayscale washes the hue difference out anyway. */
.ending-card--locked .snark {
  color: var(--color-text);
}
```

and change `.shop-item.is-owned`'s `opacity: 0.6;` to `opacity: 0.75;` (keep its `filter` and `box-shadow` lines), and `.shop-item__owned`'s `color: var(--color-text-muted);` to `color: var(--color-text);`.

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: all green (the new tests pass; no existing test pins the old opacities — if one does, it encodes the pre-decision state; update it).

- [ ] **Step 5: Amend spec §8**

In the spec's §8 list, append two bullets:

```markdown
- `.wordmark` is a logotype and exempt from the text-contrast floor (WCAG 1.4.3 logotype
  exemption); its `opacity: .7` treatment stands. Every other piece of real text — including
  text inside a dimmed card (locked endings, owned gear) — meets 4.5:1 as composited.
- Natively `disabled` controls are inactive UI components and exempt from the contrast floor
  (WCAG 1.4.3); their 0.45 dim stands.
```

- [ ] **Step 6: Commit**

```bash
git add src/styles/components.css tests/styles.test.js docs/superpowers/specs/2026-07-23-gold-and-glory-design-system.md
git commit -m "fix(a11y): locked/owned card text clears 4.5:1; wordmark exempted as logotype (item 33)"
```

---

### Task 7: Meter role="button" (design §4b, item 16)

**Files:**
- Modify: `src/ui/render.js:401`
- Modify: the spec, §6.4 (HTML fence + a sentence)
- Test: `tests/render.test.js:1564-1568`

- [ ] **Step 1: Flip the test first**

At `tests/render.test.js:1564-1568`, the assertion reads `expect(meterTag(html)).toContain('role="application"')` under a comment about handing keys to the page. Replace comment + assertion:

```js
    // role="button" (design 2026-08-01 §4b, item 16): announced usefully ("button"),
    // activation semantics for free, and browse mode is not suppressed for a control whose
    // only children are presentational divs. tabindex stays — a div button is not natively
    // focusable.
    expect(meterTag(html)).toContain('role="button"');
    expect(meterTag(html)).toContain('tabindex="0"');
```

Run: `npx vitest run tests/render.test.js`
Expected: FAIL (markup still says application).

- [ ] **Step 2: Change the markup**

`src/ui/render.js:401`: `role="application"` → `role="button"`. Nothing else in the tag changes (`tabindex="0"`, `data-meter`, `aria-label` all stay; Enter/Space handling in `main.js` already exists).

- [ ] **Step 3: Run the suite**

Run: `npm test`
Expected: green. `tests/a11y.test.js:104` and `tests/main.test.js:414` mention `role="application"` in comments only — update the wording of both comments to say `role="button"` so they don't lie.

- [ ] **Step 4: Amend spec §6.4**

In the spec §6.4's HTML fence change `role="application"` to `role="button"`, and after the fence add: `role="button", not "application": announced usefully, free activation semantics, and browse mode stays available — "application" suppressed it for a control whose only children are presentational (decided 2026-08-01, item 16). The div still needs its tabindex.`

- [ ] **Step 5: Commit**

```bash
git add src/ui/render.js tests/render.test.js tests/a11y.test.js tests/main.test.js docs/superpowers/specs/2026-07-23-gold-and-glory-design-system.md
git commit -m "fix(a11y): timing meter is role=button, not application (item 16)"
```

---

### Task 8: Drop the log's duplicate aria-live (design §4c, item 23)

**Files:**
- Modify: `src/ui/render.js:452`
- Modify: the spec, §8
- Test: `tests/render.test.js:1451-1459`

- [ ] **Step 1: Flip the test first**

`tests/render.test.js:1451-1459` asserts the strip carries `aria-live="polite"`. Replace the comment and assertion:

```js
  // The strip carries NO aria-live (design 2026-08-01 §4c, item 23): inside #app it is
  // re-created already-populated every render, so it can never speak — while AT that does
  // voice fresh insertions would read the entire bout as a duplicate of #log-announcer.
  // The persistent #log-announcer region (src/main.js) is the one announcement channel.
    expect(strips[0].getAttribute('aria-live')).toBeNull();
```

Run: `npx vitest run tests/render.test.js` — expected: FAIL.

- [ ] **Step 2: Edit the markup**

`src/ui/render.js:452`: remove ` aria-live="polite"` from the `<ul class="log" …>` tag. `tabindex="0"` and `aria-label="Combat log"` stay (the focusable scroll region still needs its name).

- [ ] **Step 3: Run the suite**

Run: `npm test`
Expected: green. `tests/main.test.js:799` collects `[aria-live]` elements — if its census counts the strip, shrink the expectation accordingly.

- [ ] **Step 4: Amend spec §8**

In §8's "Dynamic announcements" line, replace `log aria-live="polite"` with: `combat log — announced by the persistent #log-announcer region only; the rendered strip carries no live region (§6.9)`.

- [ ] **Step 5: Commit**

```bash
git add src/ui/render.js tests/render.test.js tests/main.test.js docs/superpowers/specs/2026-07-23-gold-and-glory-design-system.md
git commit -m "fix(a11y): the log strip carries no aria-live; #log-announcer is the channel (item 23)"
```

---

### Task 9: Stamps announce via persistent regions (design §4d, items 26+28)

**Files:**
- Modify: `src/ui/components.js:253-259` (`bannerStamp`)
- Modify: `src/ui/render.js` (~273-276 `renderResult` stamp, ~260 `ledgerSummary`, ~360-385 game-over payload, new `gameoverSummary` export)
- Modify: `src/main.js` (announce the ending; reset flag in `newRun`)
- Modify: the spec, §8
- Test: `tests/main.test.js`, `tests/render.test.js`

- [ ] **Step 1: Simplify `bannerStamp`**

In `src/ui/components.js`, `bannerStamp` loses its `status` option — no call site will pass it, and a `role="status"` inserted already-populated is provably mute (items 26/28). New body:

```js
// One spelling of a banner stamp (spec §6.13). No role: a live region rendered inside #app
// arrives already-populated on every mount and announces nothing (items 26/28) — the stamp's
// text is announced by main.js through a persistent region instead (design 2026-08-01 §4d).
export function bannerStamp(variant, text) {
  return (
    `<p class="banner-stamp banner-stamp--${escapeHtml(variant)}">` + `${escapeHtml(text)}</p>`
  );
}
```

- [ ] **Step 2: One home for the result stamp, spoken and drawn**

In `src/ui/render.js`, above `ledgerSummary` add:

```js
// §6.13's result verdicts, spelled once for the drawn stamp AND the spoken announcement —
// two spellings of a stamp is how the drawn one and the spoken one drift (item 29's lesson).
const RESULT_STAMPS = {
  won: { variant: 'victory', text: 'VICTORY!' },
  lost: { variant: 'defeat', text: 'DEFEAT.' },
};
const resultStamp = (r) => (r.won ? RESULT_STAMPS.won : RESULT_STAMPS.lost);
```

In `renderResult` replace the `const banner = r.won ? bannerStamp('victory', 'VICTORY!', { status: true }) : bannerStamp('defeat', 'DEFEAT.', { status: true });` block (and its `§6.13 + §8` comment) with:

```js
  // §6.13: the screen-level stamp. Victory gets the exclamation, defeat the deadpan period
  // (§9). Drawn here; SPOKEN by ledgerSummary through the persistent region (design §4d).
  const stamp = resultStamp(r);
  const banner = bannerStamp(stamp.variant, stamp.text);
```

In `ledgerSummary`, prepend the stamp so the one utterance opens with the verdict:

```js
export function ledgerSummary(state, config) {
  return `${resultStamp(state.lastResult).text} ${ledgerLines(state, config)
    .map((l) => `${l.label}: ${l.text}`)
    .join('. ')}.`;
}
```

- [ ] **Step 3: The game-over twin**

In `src/ui/render.js`, the strings `renderGameOver` builds must be spoken from the same source. Extract the two payload label spellings as module consts above `endingCard` (they are currently inline at ~line 362-363):

```js
const CAUSE_LABEL = 'Cause of Death:';
const PURSE_LABEL = 'Final purse:';
```

Use them in `renderGameOver`'s `payload` template (`<strong>${CAUSE_LABEL}</strong> …` / `<strong>${PURSE_LABEL}</strong> …`), then add the exported speakable twin below `renderGameOver` (mirror of `ledgerSummary`'s contract: renderer exports a string, `main.js` owns the region):

```js
// The ending, spoken once (design 2026-08-01 §4d, items 26+28). Same persistent-region
// arrangement as the ledger: this is only a string; main.js writes it into #ledger-announcer,
// which is free on GAMEOVER (no ledger speaks there) — while the killing blow still goes to
// #log-announcer, exactly the fight-end split of responsibilities.
export function gameoverSummary(state, config) {
  const order = endingOrder(config);
  const achieved = order.includes(state.ended) ? state.ended : null;
  const stamp = achieved ? `${config.endings[achieved].stamp.text}. ` : '';
  const payload =
    achieved === 'dead'
      ? `${CAUSE_LABEL} ${state.lastResult?.causeOfDeath ?? UNRECORDED_CAUSE}`
      : `${PURSE_LABEL} ${formatGold(state.gold)}`;
  return `${stamp}${payload}`;
}
```

- [ ] **Step 4: Announce it from main.js**

In `src/main.js`: import `gameoverSummary` beside `ledgerSummary`; add module state + announcer beside `announcedResult`:

```js
// The ending spoken this run. A boolean, not an identity guard: `state.ended` is set once per
// run and never changes until newRun(), so "already spoken" is the only state to track.
let announcedEnding = false;
```

In `newRun()`, after `lastGold = null;` add `announcedEnding = false;`. In `render()`, beside the RESULT branch add:

```js
  if (state.phase === PHASE.GAMEOVER) announceEnding();
```

and below `announceLedger()` define:

```js
// The ending, spoken once per run through the ledger's region — which is free on GAMEOVER
// (no ledger renders there), while #log-announcer is busy with the killing blow in the same
// tick. See gameoverSummary in ui/render.js for why the renderer only exports the string.
function announceEnding() {
  if (announcedEnding) return;
  announcedEnding = true;
  ledgerAnnouncer.textContent = gameoverSummary(state, CONFIG);
}
```

- [ ] **Step 5: Update the tests**

Run: `npx vitest run tests/render.test.js tests/main.test.js` and reconcile:

- Any assertion that a result stamp carries `role="status"` now asserts the opposite. The hygiene checks at `tests/render.test.js:786-801` (result card emits no live region) should already pass — extend the querySelector list's coverage to `.banner-stamp[role]` if it doesn't already catch it:
  ```js
  expect(dom(resultOf(WIN)).querySelector('.banner-stamp[role]')).toBeNull();
  ```
- The ledger-announcement tests around `tests/main.test.js:557` gain a leading stamp — update expected strings to start with `VICTORY! ` / `DEFEAT. `.
- In the `#ledger-announcer` describe block of `tests/main.test.js`, add a game-over test using the same state-driving helpers the block already uses (clone the setup of the nearest game-over-reaching test in that file):
  ```js
  it('announces the ending once, stamp first, and not again on re-render (design §4d)', () => {
    // drive the harness to GAMEOVER with ended: 'dead' the same way the file's other
    // game-over tests do, then:
    const region = document.getElementById('ledger-announcer');
    expect(region.textContent).toMatch(/^YOU DIED\. Cause of Death:/);
    const spoken = region.textContent;
    // any re-render of the same screen (the file's helpers re-render on state writes):
    expect(region.textContent).toBe(spoken);
  });
  ```
- The live-region census at `tests/main.test.js:799` shrinks by every `[role="status"]` stamp it used to count.

Expected after reconciliation: `npm test` green.

- [ ] **Step 6: Amend spec §8**

Replace §8's `result stamps role="status"` with: `result and game-over stamps — announced once through the persistent #ledger-announcer region, written after insertion (a role="status" rendered inside #app arrives already-populated and is mute; decided 2026-08-01, items 26/28). The rendered .banner-stamp carries no role.`

- [ ] **Step 7: Commit**

```bash
git add src/ui/components.js src/ui/render.js src/main.js tests/render.test.js tests/main.test.js docs/superpowers/specs/2026-07-23-gold-and-glory-design-system.md
git commit -m "fix(a11y): stamps announce via persistent regions; mute role=status removed (items 26+28)"
```

---

### Task 10: One `.parchment` rule (design §5, item 31)

**Files:**
- Modify: `src/styles/components.css` (8 rules), `src/ui/components.js` (`poster`, `shopItem`, `bannerStamp`), `src/ui/render.js` (sponsor card, log, ledger, ending card, cause-of-death)
- Modify: the spec, §4 (M2) and §6.0
- Test: `tests/styles.test.js`

The M2 trio (`--grad-paper` fill, `var(--border-w) solid var(--border-ink)` border, `--shadow-paper`) is copy-pasted into exactly eight rules: `.poster`, `.shop-item`, `.sponsor-card`, `.log`, `.ledger`, `.banner-stamp`, `.ending-card`, `.cause-of-death`. Each keeps its own wobble radius, tilt, and padding.

- [ ] **Step 1: Write the failing gate test**

Append to `tests/styles.test.js`:

```js
// Item 31: the M2 trio is declared once. This is the refactor's safety gate — the trio must
// live on .parchment and NOWHERE else among the eight cards, and every rendered card must
// actually wear the class, or its paper silently vanishes.
describe('the parchment trio is declared once (design 2026-08-01 §5, item 31)', () => {
  const CARDS = ['.poster', '.shop-item', '.sponsor-card', '.log', '.ledger',
    '.banner-stamp', '.ending-card', '.cause-of-death'];
  const bodyOf = (sel) => {
    const m = css.match(new RegExp(`(^|,|\\})\\s*${reEscape(sel)}\\s*\\{([^}]*)\\}`, 'm'));
    expect(m, `no ${sel} rule`).not.toBeNull();
    return m[2];
  };

  it('declares the trio on .parchment', () => {
    const body = bodyOf('.parchment');
    expect(body).toMatch(/background:\s*var\(--grad-paper\)/);
    expect(body).toMatch(/border:\s*var\(--border-w\)\s+solid\s+var\(--border-ink\)/);
    expect(body).toMatch(/box-shadow:\s*var\(--shadow-paper\)/);
  });

  it('no card rule re-declares any leg of the trio', () => {
    for (const sel of CARDS) {
      const body = bodyOf(sel);
      expect(body, `${sel} re-declares background`).not.toMatch(/--grad-paper/);
      expect(body, `${sel} re-declares the ink border`).not.toMatch(/border:\s*var\(--border-w\)/);
      expect(body, `${sel} re-declares the paper shadow`).not.toMatch(/--shadow-paper/);
    }
  });

  it('every rendered card wears the class', () => {
    const missing = [];
    for (const [name, host] of Object.entries(MOUNTED)) {
      for (const sel of CARDS) {
        for (const el of host.querySelectorAll(sel)) {
          if (!el.classList.contains('parchment')) missing.push(`${name}: ${sel}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
```

Run: `npx vitest run tests/styles.test.js` — expected: FAIL (no `.parchment` rule).

- [ ] **Step 2: Add the rule, strip the eight**

At the top of `components.css` (above the §6.1 block):

```css
/* M2's shared treatment (design 2026-08-01 §5, item 31): every parchment card states this trio
   here, once. Each card keeps its OWN wobble radius, tilt and padding — variety is the point
   of the wobble tokens, so only the invariant part is shared. */
.parchment {
  background: var(--grad-paper);
  border: var(--border-w) solid var(--border-ink);
  box-shadow: var(--shadow-paper);
}
```

Then delete the `background: var(--grad-paper);`, `border: var(--border-w) solid var(--border-ink);` and `box-shadow: var(--shadow-paper);` lines from each of the eight rules named above — nothing else in them. (`.delta-chip` and the wood rules are NOT part of this; leave them.)

- [ ] **Step 3: Add the class in markup**

- `src/ui/components.js`: `poster()`'s `<article class="poster tape poster--tilt-…">` → `class="poster parchment tape poster--tilt-…"`; `shopItem()`'s two roots gain `parchment` (`class="shop-item parchment is-owned"` / `class="shop-item parchment${…is-unaffordable}"`); `bannerStamp()`'s `<p class="banner-stamp banner-stamp--…">` → `class="banner-stamp parchment banner-stamp--…"`.
- `src/ui/render.js`: add `parchment` to the sponsor card's root, the `<ul class="log" …>`, the `<section class="ledger tape">`, the `<article class="ending-card tape…">` in `endingCard`, and `<p class="cause-of-death">`.

- [ ] **Step 4: Fix the Law-4 calibration**

In `tests/styles.test.js`'s "Law 4" describe, the ground-derivation assertion `expect(grounds).toContain('.ledger')` now fails (the trio moved off `.ledger`). Change it to `expect(grounds).toContain('.parchment')` — the derivation itself picks the new rule up automatically because `.parchment` declares a paper background.

- [ ] **Step 5: Run the suite**

Run: `npm test`
Expected: green — including `grid-areas` and every markup test. If a class-list equality assertion in `render.test.js` breaks, add `'parchment'` to its expected list.

- [ ] **Step 6: Amend the spec**

- §4 M2: append `The invariant trio (paper fill, ink border, paper shadow) is carried by the shared .parchment class; each card states only its own wobble/tilt/padding (decided 2026-08-01, item 31).`
- §6.0 index: add `parchment` (full index reconciliation happens in Task 14).

- [ ] **Step 7: Commit**

```bash
git add src/styles/components.css src/ui/components.js src/ui/render.js tests/styles.test.js docs/superpowers/specs/2026-07-23-gold-and-glory-design-system.md
git commit -m "refactor(ui): one .parchment rule carries the M2 trio (item 31)"
```

---

### Task 11: The page column is declared once (design §5, item 34)

**Files:**
- Modify: `src/styles/base.css:16-25` (`#app`)
- Test: `tests/grid-areas.test.js` (comment/budget verification only)

- [ ] **Step 1: Edit `#app`**

Replace the `#app` rule and its comment with:

```css
/* The mount point. The page column — 1180px cap, centered, one --space-4 gutter — belongs to
   `.screen` (screens.css) alone; when #app also declared it, the gutter silently doubled to
   32px and `.screen`'s cap was unreachable (item 34, decided 2026-08-01). Anything mounted
   that is not a .screen (an error state) now spans the viewport — acceptable, and honest. */
#app {
  min-height: 100dvh;
}
```

- [ ] **Step 2: Run the suite**

Run: `npm test`
Expected: green. In `tests/grid-areas.test.js`, find the overflow-budget expression (search for `SPACE_4`): the budget `width − 2×SPACE_4` was previously *too generous* (real content sat behind a double gutter); it is now exact. Update any comment there that documents the doubling; the numbers themselves should not need to change.

- [ ] **Step 3: Commit**

```bash
git add src/styles/base.css tests/grid-areas.test.js
git commit -m "fix(ui): page column declared once, on .screen; gutter is an honest 16px (item 34)"
```

---

### Task 12: Shortfall copy guard (design §5, item 35)

**Files:**
- Test: `tests/styles.test.js`

- [ ] **Step 1: Write the test (it should pass immediately — it guards drift, not a defect)**

Append to `tests/styles.test.js`. It already imports from `effects.js`; extend that import with `spawnShortfallChip`, and add `import { MINUS } from '../src/ui/format.js';` if not present:

```js
// Item 35: the shortfall is worded in two places — §6.2's ::after (CSS) and the rejection
// chip (JS) — and only the JS half was test-pinned, so the CSS half could drift silently.
// This derives the wording FROM the stylesheet and demands the chip agree with it: change
// either side's copy alone and this fails.
describe('the shortfall is spelled once (design 2026-08-01 §5, item 35)', () => {
  it('the JS chip and the CSS ::after agree on the wording', () => {
    const m = css.match(/content:\s*'([^']*)'\s*attr\(data-missing\)\s*'([^']*)'/);
    expect(m, 'the §6.2 shortfall ::after is gone or restructured').not.toBeNull();
    // CSS says " (need X more)"; the chip says "−need X more": same words, chip drops the
    // parentheses and leads with the minus. Strip the CSS's parens to get the shared words.
    const lead = m[1].replace(/^\s*\(/, ''); // "need "
    const tail = m[2].replace(/\)\s*$/, ''); // " more"
    const purse = document.createElement('span');
    document.body.appendChild(purse);
    spawnShortfallChip(purse, '150 G');
    const chip = purse.querySelector('.delta-chip');
    expect(chip, 'spawnShortfallChip rendered no chip').not.toBeNull();
    expect(chip.textContent).toBe(`${MINUS}${lead}150 G${tail}`);
    purse.remove();
  });
});
```

- [ ] **Step 2: Run it, then mutation-check it**

Run: `npx vitest run tests/styles.test.js` — expected: PASS.
Mutation check (mandatory, this suite's convention): change `' more)'` to `' short)'` in `components.css`, re-run, expect FAIL; revert. Change the chip template's `need` in `src/ui/effects.js` to `want`, re-run, expect FAIL; revert.

- [ ] **Step 3: Commit**

```bash
git add tests/styles.test.js
git commit -m "test(ui): pin the CSS and JS shortfall wording to each other (item 35)"
```

---

### Task 13: Prune dead states and tokens (design §5, item 36)

**Files:**
- Modify: `src/styles/components.css`, `src/styles/tokens.css`
- Modify: the spec, §1 and §6.2
- Test: `tests/styles.test.js` (only if a pruned selector is referenced)

**Keep/delete line (from the design):** kept — `.btn--danger` (§6.2 variant), `btn()`'s `owned` branch and therefore `.btn.is-owned` + `.btn[aria-disabled="true"]`, and `.poster--tilt-3` (reachable through `poster()`'s public `tilt` param — the design's "if unreachable" condition resolves to *keep*; record that in the commit message). Deleted — `.btn.is-disabled` (no code path emits the class) and `.btn.is-owned:hover` (an inert control has no hover treatment).

- [ ] **Step 1: Prune the selectors**

In `components.css`:
- The rule `\.btn.is-disabled,\n.btn[aria-disabled='true'] {` loses its first selector — becomes `.btn[aria-disabled='true'] {`.
- Delete the `.btn.is-owned:hover { background: var(--grad-wood); }` rule entirely. Keep `.btn.is-owned`.

Run: `npx vitest run tests/styles.test.js` — the derivation at ~line 450 reads the disabled-dim rule; if it matches on the old two-selector prelude, update its regex to the single selector. Expected: green.

- [ ] **Step 2: Find the dead tokens with a fixpoint scan**

Create `scan-tokens.mjs` in the **repo root**:

```js
import { readFileSync } from 'node:fs';
const files = [
  'src/styles/tokens.css', 'src/styles/base.css', 'src/styles/components.css',
  'src/styles/screens.css', 'src/ui/components.js', 'src/ui/render.js', 'src/ui/effects.js',
  'src/ui/screens.js', 'src/ui/timing.js', 'src/ui/format.js', 'src/main.js',
];
const tokens = readFileSync('src/styles/tokens.css', 'utf8');
let defined = [...tokens.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]);
const blob = files.map((f) => readFileSync(f, 'utf8')).join('\n');
// Fixpoint: a token referenced only from another dead token's value is dead too, so strip
// dead definitions from the blob and rescan until nothing else falls out.
let scan = blob;
for (;;) {
  const dead = defined.filter((t) => !new RegExp(`var\\(${t}[),]`).test(
    scan.replace(new RegExp(`^\\s*${t}:.*$`, 'gm'), '')));
  if (!dead.length) break;
  for (const t of dead) scan = scan.replace(new RegExp(`^\\s*${t}:.*$`, 'gm'), '');
  defined = defined.filter((t) => !dead.includes(t));
  console.log('dead:', dead.join(', '));
}
```

Run: `node scan-tokens.mjs`
Expected: prints the dead-token list (PROGRESS counted 16; the exact list is whatever the scan says today).

- [ ] **Step 3: Delete, with the spec exception**

For each reported token: if the spec's **normative CSS fences** (§1's token block or any §6 component fence) still *use* it in a declaration — `grep` the spec for `var(--token-name)` — keep it and note why; otherwise delete its line from `src/styles/tokens.css` AND from the spec's §1 fence (the fence says copy-paste verbatim, so the two must stay byte-equal in spirit). Delete `scan-tokens.mjs`.

- [ ] **Step 4: Amend spec §6.2 and §6.0**

- In §6.2's CSS fence, the `.btn.is-disabled,` selector line goes (matching Step 1); the prose sentence about the two dead states keeps only native `disabled` + `aria-disabled`.
- In §6.0's index, remove `is-disabled` (full reconciliation is Task 14's).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: green — `tests/styles.test.js`'s "every var() resolves" test is the net that catches a token deleted while still referenced.

- [ ] **Step 6: Commit**

```bash
git add src/styles/components.css src/styles/tokens.css tests/styles.test.js docs/superpowers/specs/2026-07-23-gold-and-glory-design-system.md
git commit -m "refactor(ui): prune dead button states and unreferenced tokens; keep spec-mandated ones (item 36)"
```

---

### Task 14: Spec index, §7 comment, PROGRESS resolutions (design §4e, §5 item 20, §6)

**Files:**
- Modify: the spec, §6.0 and §7
- Modify: PROGRESS, "Open decisions" section

- [ ] **Step 1: Reconcile §6.0's closed index against reality**

Derive the real class inventory:

```bash
grep -ohE 'class="[^"]*"' src/ui/*.js src/main.js | tr -d '"' | sed 's/class=//' | tr ' `$' '\n' | grep -E '^[a-z][a-z0-9_-]*$' | sort -u
grep -ohE '^\.[a-z][a-zA-Z0-9_-]*' src/styles/*.css | sort -u
```

Add every real, missing name to §6.0's index (known missing today: `parchment`, `sr-only`, `is-captured`, `is-hidden`, `is-shaking`, `meter__labels`, `meter__taunt`, `poster__silhouette`, `poster--tilt-1/2/3`, `shop-item__icon`, `shop-item__name`, `shop-item__owned`, `sponsor-card__eyebrow`, `sponsor-card__name`, `train-row__label`, `delta-chip--pos`, `delta-chip--neg`, `result__cross`, `result__flavor`, plus the `hub__*`, `fight__*`, `result__*`, `gameover__*` layout families — list them by name, the index stays closed). Remove names the code genuinely never emits **and** the spec no longer mandates after Task 13 (`is-disabled`). Keep §6.15's `modal`/`modal__scrim` — the spec still specifies the modal even though no screen renders one yet; annotate them `(specified, not yet rendered)`.

- [ ] **Step 2: §7's stacked-commit comment (item 20)**

In the spec §7's ≤640 block, the comment reads `/* Hub's Next Fight and Fight's action grid live inside .commit-bar when stacked */`. The fight screen deliberately does not do this (item 20, decided: drop the claim). Change it to `/* Hub's Next Fight lives inside .commit-bar when stacked */`. If a prior reconciliation already removed it, this step is a no-op — verify and move on.

- [ ] **Step 3: Mark PROGRESS resolved**

In PROGRESS, directly under the `## Open decisions — need a human, not an agent` heading, insert:

```markdown
> **RESOLVED 2026-08-01.** Every decision below was made by the maintainer and is recorded,
> with its implementation contract, in `docs/superpowers/specs/2026-08-01-cleanup-decisions-design.md`
> (this cleanup) and `docs/superpowers/specs/2026-08-01-visual-phase-decisions.md` (the visual
> phase: items 17 and 27 resolve there as "commission the assets"). The text below is kept
> only so older review reports still resolve; do not work from it.
```

- [ ] **Step 4: Run the suite and commit**

Run: `npm test` — expected: green (doc-only task; the suite run is the no-regression check).

```bash
git add docs/superpowers/specs/2026-07-23-gold-and-glory-design-system.md docs/superpowers/plans/2026-07-24-design-system-PROGRESS.md
git commit -m "docs(spec): reconcile §6.0 index and §7 comment; mark open decisions resolved (items 18/20/21)"
```

---

### Task 15: Verification pass — the whole point of the browser step

**Files:** none (fix-forward commits only if defects surface)

- [ ] **Step 1: Full gates**

```bash
npm test && npm run lint && npm run format:check && npm run build
```
Expected: 392+ tests green (387 baseline + this plan's additions), zero lint/format complaints, clean build.

- [ ] **Step 2: Real browser pass (jsdom cannot see layout — PROGRESS's standing lesson)**

Start the dev server (`.claude/launch.json` name: `dev`, port 5199) and check at **1280, 900, 640, 375** widths:

- HUB: dog-eared sponsor corner (fold reads as a fold, not a smudge); icon wells on all three gear cards (recessed, intentional-looking); 4:3 portrait wells on both posters, silhouette centered; gutter visibly 16px (content wider than before, nothing overflows); an owned card's "✓ Owned" clearly readable.
- FIGHT: meter reachable by Tab (focus ring visible), Enter captures; log scrolls; nothing regressed from the label changes.
- RESULT (win a fight): stamp drawn as before (no visual change), ledger theater runs, whole-screen click skips it.
- GAMEOVER (die, or retire): locked ending cards' titles and epitaphs comfortably readable (the 0.75 change); stamps drawn; restart works.
- Reduced motion (macOS: System Settings → Accessibility → Display → Reduce motion): no pulsing, chips still legible.

Screen-reader spot check is out of scope for the pane; the announcement *strings* are covered by tests (Tasks 8–9).

- [ ] **Step 3: Fix-forward anything found, one commit per defect, then re-run Step 1.**

- [ ] **Step 4: Final commit if any docs changed during verification**

---

## Execution notes (for the coordinator)

- Dispatch pattern that works here (PROGRESS, measured): **fresh subagent + synchronous, self-contained prompt, pointed at its own task section in this file** — do not paste task text into prompts (the U+00A0 post-mortem). Forbid browser/preview tools for all tasks except Task 15. Cap reports at 20 lines.
- Tasks 1–2 are independent of everything; Tasks 3–5 touch `components.css` in different blocks but should run serially (never two implementers in parallel); Task 10 must run **after** 3–5 (it rewrites the same rules they touch); Task 13 after 10 (prune sees final CSS); Task 14 after 13 (index sees final classes); Task 15 last.
- Every task ends with the full suite green — no task hands the next one a red baseline.
