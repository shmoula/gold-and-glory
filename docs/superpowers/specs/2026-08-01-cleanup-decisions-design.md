# Gold & Glory — Cleanup: Resolve the 15 Open Decisions

**Date:** 2026-08-01
**Status:** Approved design → ready for implementation plan
**Depends on:** `docs/superpowers/specs/2026-07-23-gold-and-glory-design-system.md` (the living
design-system spec, hereafter "the spec"), and the open-decisions section of
`docs/superpowers/plans/2026-07-24-design-system-PROGRESS.md` (hereafter "PROGRESS"), whose item
numbers are used throughout.
**Baseline:** `main` @ `47eed37`, 387 tests green, `npm run build` clean.

## Purpose

The design-system plan closed with 15 decisions "awaiting a human." The human has now decided all
of them (session of 2026-08-01). This document records each decision and specifies the resulting
changes. Everything here is either a decision made today or the mechanical fallout of one; nothing
visual-phase (backdrop, frame, plaques, icons, character art, fight-screen recomposition, injuries
HUD change) is in scope — those decisions live in `2026-08-01-visual-phase-decisions.md`.

## Decisions record

| PROGRESS item(s)  | Decision                                                                     |
| ----------------- | ---------------------------------------------------------------------------- |
| 24                | Fix via **damage floor** (`minHitDamage: 1`), not a turn cap                  |
| 33 + pattern      | Wordmark = logotype, WCAG-exempt; **raise all other sub-4.5:1 real text**     |
| 16                | Meter `role="application"` → **`role="button"`**                              |
| 23                | **Drop** the duplicate `aria-live` from the log `<ul>`                        |
| 26 + 28           | Stamps announce via **persistent live region**; `role="status"` leaves markup |
| 18 + 21           | **Add missing class families to §6.0** — the index is stale, not the code     |
| 8, 9, 10          | **Do all three**: dog-ear, shop icon wells, 4:3 portrait well                 |
| 4                 | **Title case** button labels                                                  |
| 20                | Drop §7's stacked-commit comment (verify; no-op if already reconciled)        |
| 30                | `main.js` stays whole — **no action**                                         |
| 31                | Collapse the M2 parchment quartet into **one `.parchment` rule**              |
| 34                | Declare the page column **once, on `.screen`**; `#app` loses its duplicate    |
| 35                | Add a **guard test** comparing the CSS shortfall string to the JS constant    |
| 36                | **Prune** dead states/tokens, except what the reconciled spec still mandates  |
| 37                | Test-file split — **no action**                                               |
| Hub row @ 375px   | **Leave it** (meter is decorative; the numeral carries the value)             |
| 17, 27            | Deferred to visual phase (assets exist there; see the visual-phase record)    |

## 1. Combat damage floor (item 24)

**Problem.** A player whose guard ≥ the enemy's max crit damage who blocks every turn never
finishes a fight (measured: 5,000 exchanges). The combat log now has no cap in front of it, so the
stall also grows the DOM without bound.

**Change.** New tuning value `config.combat.minHitDamage: 1`. A **landed** attack — one that
resolves to graze, hit, or crit — deals at least `minHitDamage` after **all** mitigation, for both
combatants. A miss still deals 0.

**Placement.** `computeDamage()` (`src/combat.js:19`) is the shared damage pipe and already
early-returns 0 on miss; but Block's `damageReduction` is applied *after* `computeDamage` in
`enemyTurn`, so a floor inside `computeDamage` alone would be undone — a blocked landed hit must
pay the floor too, or the stall survives. **Mechanism: one exported helper**
(`floorLandedDamage(dmg, timing, config)` — returns `dmg` on miss, `Math.max(config.combat.minHitDamage, dmg)`
otherwise). `computeDamage`'s final clamp uses it, and `enemyTurn`'s post-block reduction passes
through it again. The rule is spelled once; both paths are tested.

**Gameplay consequence (accepted).** Max-guard turtling is globally weakened, not just in the
stall case: blocking still mitigates but can no longer zero out a landed hit indefinitely. Worst
case a 100-HP fighter absorbs ~100 floored exchanges — long, but terminating.

**Tests.** (a) The measured stall scenario (guard ≥ enemy max crit, block every turn) terminates
within a bounded exchange count; (b) a blocked landed hit deals exactly the floor when mitigation
would have zeroed it; (c) a miss still deals 0; (d) the floor value is read from config, not
hardcoded (mutate config, observe the change).

## 2. Title-case button labels (item 4)

Spec §9 and the reference art both use title case; the shipped call sites are sentence case. The
call-site strings in `src/ui/render.js` change: `Repair weapon` → `Repair Weapon`,
`Heal N injuries` → `Heal N Injuries`. Mechanical clauses embedded in a label keep sentence case —
`Bribe Official — tax 20% → 5%` title-cases the verb phrase only. Already-conforming labels
(`Retire Rich`, `Next Fight`, `Return to Ludus`, `Press the Attack` — "the" correctly lowercase,
`Fight Again`, `Strike/Heavy/Block/Feint`, `Train +N`, `Bribed ✓`) do not change. Test
expectations follow. §9 is already title case, so the spec does not change.

## 3. The three cheap visual spec gaps (items 8, 9, 10)

- **§6.10 dog-ear (item 8).** `.sponsor-card` gains its folded-triangle corner as a
  pseudo-element: paper-tone triangle over an ink fold line, tokens only, no new class. This is
  the recurring comedy vehicle's recognition mark.
- **§6.12 icon well (item 9).** `.shop-item` gains the leading icon well: a fixed-size square
  well, `--paper-4`→`--paper-5` ground (same recession treatment as the portrait well), ink
  border, **empty until the visual phase delivers icons**. An empty recessed well reads as
  intentional; §10's zero-asset rule is preserved. The well is `aria-hidden` (decorative).
- **§6.5 portrait aspect (item 10).** `.poster__portrait` drops `height: 104px` for
  `aspect-ratio: 4 / 3`, becoming the true 4:3 well §6.5 always specified. Silhouette fallback
  stays centered. This removes the letterboxed look at desktop widths.

All three are what the spec already says; no spec edits needed. `tests/grid-areas.test.js` and the
styles tests must stay green; a browser pass confirms the well proportions at all four widths.

## 4. Accessibility bundle (items 33, 16, 23, 26/28, 18/21)

### 4a. Contrast policy (33 + the systemic pattern)

§8 gains one sentence: `.wordmark` is a **logotype** and exempt from the text-contrast floor per
WCAG 1.4.3; its `opacity: .7` stays. Everything else that is *real text a player is meant to read*
must measure ≥ 4.5:1 against its actual ground:

- `.ending-card--locked` title (today 4.19:1) and snark (2.72:1): raise via opacity/recolor while
  keeping the grayscale locked look.
- `.is-owned` card's "✓ Owned" line: same floor.
- Natively `disabled` buttons stay dimmed as-is — WCAG exempts inactive controls, and §8 says so
  explicitly to close the question.

Where the ground is computable (flat or a known gradient stop), a styles test asserts the
measured ratio; the review-time contrast math already exists to crib from.

### 4b. Meter role (16)

§6.4's normative HTML and the markup change `role="application"` → `role="button"`
(`tabindex="0"` stays; Enter/Space activation already works). "Button" is announced usefully,
activation semantics come free, and browse mode is no longer suppressed for a control whose only
children are presentational. `tests/a11y.test.js` expectations follow.

### 4c. Log live-region duplicate (23)

The `aria-live="polite"` comes **off** the `<ul class="log">`: it sits inside `#app`, is
re-created already-populated on every render, and therefore cannot speak — while on AT that does
speak fresh insertions, it double-announces the entire bout alongside `#log-announcer`. §8's line
"log `aria-live="polite"`" is amended to name `#log-announcer` (the persistent region) as the
announcement channel instead.

### 4d. Stamp announcements (26 + 28)

`role="status"` leaves the `.banner-stamp` markup on both screens — it is provably mute there
(a live region inserted already-populated announces nothing). Instead, stamp text is announced
**exactly once** via the established persistent-region pattern (`liveRegion()` in `src/main.js`,
outside `#app`, written after insertion, guarded against re-announcement on re-render):

- **Result:** the stamp text ("VICTORY!" / "DEFEAT.") is prepended to the existing ledger
  announcement (`#ledger-announcer`) — one utterance, stamp first.
- **Game over:** the ending stamp text plus the cause-of-death line are written to
  `#ledger-announcer`. This mirrors the fight-end arrangement exactly: the killing-blow exchange
  goes to `#log-announcer`, the outcome summary to `#ledger-announcer`, and the two never share a
  region because both fire in the same tick. No ledger speaks on GAMEOVER, so there is no
  collision and no third region to build. The invariants stay: *persistent, outside `#app`,
  written post-insertion, spoken once* (guarded by `state.lastResult` identity like the result
  ledger).

§8's "result stamps `role="status"`" line is rewritten to describe this announced-not-rendered
arrangement, mirroring what §6.9 already learned for the log.

### 4e. §6.0 index (18 + 21)

The closed class index gains the families the code already uses: `meter__labels`, `meter__taunt`,
`is-captured`, `fight__*`, `result__*`, `gameover__*`, `hub__*`, `is-hidden`, `is-shaking`, plus
`parchment` (from §5 below). The index stays closed — it just stops being stale.

## 5. Structural debt (items 31, 34, 35, 36; 30 and 37 no-action)

- **`.parchment` (31).** One shared rule carries the M2 quartet (`--grad-paper` fill, ink border,
  a wobble radius, `--shadow-paper`); the nine copy-pasted rules (`.poster`, `.shop-item`,
  `.sponsor-card`, `.log`, `.ledger`, `.banner-stamp`, `.ending-card`, `.cause-of-death`, modal)
  keep only their per-component differences (which wobble, which tilt). Spec §6's M2 description
  gains the class; §6.0 indexes it. Markup adds the class next to the existing component class.
  The refactor is gated the way every markup refactor here has been: byte-identical rendered
  output is impossible (class lists change), so instead the styles test asserts the resolved
  declarations for each of the nine components are unchanged at the four audit widths.
- **Page column declared once (34).** `#app` (`base.css`) loses `max-width`/`margin`/`padding`;
  `.screen` keeps them. The gutter becomes an honest 16px and `.screen`'s 1180px cap becomes
  reachable. `tests/grid-areas.test.js`'s overflow budget is re-derived from the single remaining
  source so it tightens rather than staying doubly generous.
- **Shortfall copy guard (35).** A test parses `components.css`, extracts the
  `content: " (need " attr(data-missing) " more)"` string parts, and asserts they agree with the
  JS constant used by `spawnShortfallChip` (`effects.js`). Neither side can drift silently again.
  (Chosen over refactoring to a single source: CSS `content` cannot read a JS constant, and
  generating CSS from JS is machinery this codebase deliberately avoids.)
- **Prune dead states and tokens (36).** The keep/delete line is drawn by **reachability through
  kept code paths**, not by the current render matrix alone. Kept: `.btn--danger` (§6.2 defines
  the variant; one line), `btn()`'s `owned` branch (§6.12 mandates inert buttons distinct from
  owned cards), and therefore the CSS that branch can emit — `.btn.is-owned` and
  `.btn[aria-disabled="true"]`. Deleted: rules no kept code path can ever emit —
  `.btn.is-disabled` (nothing sets the class), the `.btn.is-owned:hover` arm (an inert control
  has no hover treatment per §6.12), `.poster--tilt-3` if unreachable from `poster()`, and the 16
  unreferenced tokens **except** any the spec's own normative CSS blocks still name. Every
  deletion is proved dead the way `legacy.css` deletions were: jsdom `element.matches` over the
  mounted state matrix, plus a source-walk for the class emitters.
- **Item 20 (verify-only).** PROGRESS lists item 20 both as closed and as open; if §7's
  "action grid inside `.commit-bar`" comment still stands in the spec, drop it — the hub already
  implements the stacked-commit case and the fight screen deliberately does not. No code change.

## 6. Documentation changes

- Spec amendments (§6.0 index, §6.4 role, §6.9/§8 announcement channels, §8 logotype exemption +
  inactive-control note, M2 `.parchment`, §7 comment removal) are edited **into the living spec**
  — it remains the single source of truth for the design system.
- PROGRESS's "Open decisions" section gets a header line pointing here and each item marked with
  its resolution, so stale review reports still resolve.
- This document is the decisions record; the implementation plan derives from it.

## Testing & verification

- The 387-test suite stays green throughout; new tests as specified per section.
- New floors: damage-floor tests (§1), contrast assertions (§4a), shortfall-copy guard (§5),
  parchment-refactor declaration-equality gate (§5).
- Updated: copy expectations (§2), a11y role/live-region expectations (§4b–d), grid-area overflow
  budget (§5).
- Per the operational lesson in PROGRESS: **a real browser pass at 1280/900/640/375 before
  claiming done** — jsdom cannot see used widths, and both historical escapes were layout.

## Out of scope (visual phase — next spec)

Backdrop/arena art, stone-brick frame, screen title plaques, all iconography, portraits, the
chicken and §6.4's freeze theatrics (item 17), the sandal (item 27), fight-screen recomposition,
injuries HUD change, hand-drawn textures, and the asset-sourcing spike. The directions already
decided for that phase are recorded separately in `2026-08-01-visual-phase-decisions.md`.
