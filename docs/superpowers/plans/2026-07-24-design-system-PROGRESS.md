# Design System Implementation — Progress / Handoff

**Plan:** `docs/superpowers/plans/2026-07-24-design-system-implementation.md`
**Spec:** `docs/superpowers/specs/2026-07-23-gold-and-glory-design-system.md`
**Branch:** `feat/design-system` (branched from `master` @ `385e732`)
**Method:** `superpowers:subagent-driven-development` — fresh implementer subagent per task,
then spec-compliance review, then code-quality review, then next task.

## Status

| Task                        | State                                   | Commit                                        |
| --------------------------- | --------------------------------------- | --------------------------------------------- |
| 1 — Fonts, tokens, base CSS | **done, reviewed, fixed, re-verified**  | `959ad35` + `eb1ea52`                         |
| 2 — `formatGold`            | **done, reviewed, fixed, re-verified**  | `2f9a10f` + `7528dc4`                         |
| 3 — HUD beam                | **done, both reviews passed**           | `b42f8b6` + `f0e3fb7` + `3595343`             |
| 4 — Button system + snark   | **done, both reviews passed**           | `5e42184` + `9b0f859`                         |
| 5 — Hub screen              | **done, both reviews passed**           | `16ffa9c` + `8a3cde7` + `741afd0` + `c80fd17` |
| 6 — Timing meter            | **done, both reviews passed**           | `078b8a1` + `616d6b3` + `b112433`             |
| 7 — Fight screen            | **done, both reviews passed**           | `fc5a1dd` + `982f36b` + `6205a85` + `aebe210` |
| 8 — Result screen + effects | **done, both reviews passed**           | `993ce07` + `8373bf3` + `959f9e5`             |
| 9 — Game Over               | **done, both reviews passed**           | `0330985` + `c2faac3` + `0d382e5`             |
| 10 — Verification pass      | **done; 15 open decisions handed back** | `a4ea0d1` … `52ae069`                         |

Baseline at handoff: **98 tests passing**, `npm run build` clean, fonts emit 3 assets
(Nunito 400/700 are the same variable file and Vite dedupes them — this is expected, not a bug).

## THE PLAN IS COMPLETE

**All ten tasks are closed.** Each feature task went through spec review + code-quality review + at
least one fix round + an independent re-review, and every fix assertion was mutation-verified twice
— once by the implementer, once independently by a reviewer.

Final state: **384 tests green**, `npm run build` clean, `src/styles/legacy.css` gone, no literal hex
outside `tokens.css`, and each font family shipping its real upstream OFL.

**What is left is not work — it is 15 decisions.** They are collected under **"Open decisions"** at
the end of this file, each with the conflict stated and a recommendation. One of them (item 24, a
non-terminating fight) is a genuine game-logic bug predating the design system; the rest are spec
reconciliations, asset-dependent visual features, and accessibility policy.

### Task 10 in summary

Its plan steps: Step 1 promoted every stray hex literal to a token; Step 1b lifted `.bar__num` to
§8's type floor; Steps 2 and 5 became `tests/a11y.test.js`, which audits reachability, tab order,
44px targets and Laws 2/3/4 from the sheets and the rendered markup; Step 3 pinned the
reduced-motion landing state; Step 4 resolved the §7 grids at 1280/900/640/375; Step 4b replaced the
unfilled OFL template with each family's real upstream license.

Then a **real browser pass** found two defects that the whole review chain and a 376-test suite had
missed, because jsdom has no layout engine:

- **every poster HP plate was collapsed.** `meter()` emits `<span class="bar">`, and a `span` is
  `display: inline`, so its `width` was ignored — the bar measured **5px** with its numeral spilling
  outside the poster. It worked in the HUD only because `.hud` is flex, which blockifies its
  children. Fixed with `display: block` on `.bar` (`41d525a`).
- **the ≤640 sticky commit bar was a floating chip.** It kept `justify-self: end`, so it measured
  **173px at left 170** on a 375px viewport and floated over the Gear Shop card with its border-top
  spanning a third of the screen. Fixed with `justify-self: stretch` (`2f28a0d`).

The lesson is recorded in the operational notes: **do a real browser pass before believing a layout
is done.**

- Task 3: `b42f8b6` → `f0e3fb7` (5 review fixes) → `3595343` (2 quality fixes).
- Task 4: `5e42184` → `9b0f859` (9 quality fixes).
- Task 5: `16ffa9c` → `8a3cde7` (file split + 2 quality fixes) → `741afd0` (7 fixes + the player
  poster) → `c80fd17` (mobile grid-area overlap fix).
- Task 6: `078b8a1` → `616d6b3` (4 correctness bugs) → `b112433` (7 polish fixes).
- Task 7: `fc5a1dd` → `982f36b` (3 spec gaps + 3 correctness bugs) → `6205a85` (5 structural
  fixes) → `aebe210` (HUD/poster health divergence).
- Task 8: `993ce07` → `8373bf3` (3 Important + 6 lesser fixes) → `959f9e5` (ledger announcer).
- Task 9: `0330985` → `c2faac3` (10 fixes) → `0d382e5` (§9 punctuation guard).

### What Task 9 leaves you

- **`src/styles/legacy.css` is deleted.** `#app`'s cap and `button:disabled { opacity }` moved into
  `base.css`. Proved safe with a cascade differ resolving every declared property for ~600 elements
  across nine screen states at six widths: the only behavioural change in the whole deletion is
  that 3 disabled buttons regained `cursor: not-allowed`, which the old `:where()` had shadowed.
  The plan's keep-list was wrong about the button-skin group, but harmlessly so — Game Over's
  restart button is now `.btn .btn--commit` and picks up its styling from the component layer.
- **Ending copy is derived, not hand-listed.** `config.endings` carries each ending's
  `stamp: {variant, text}`, and `render.js` derives the gallery order from `Object.keys`. Before
  this, adding a 4th ending rendered 2 of 4 cards with no stamp and **no test failing**.
- **`renderHud` takes an overridable `urgent`**, mirroring `poster()`. Game Over passes
  `urgent: false` so the 0/100 corpse beam does not pulse forever against §5's 400ms budget.
- **A derived Law 4 guard now exists** in `styles.test.js`: it reads the real paper/wood grounds
  out of the sheets and fails any rendered `.wordmark` that lacks such an ancestor. That is how the
  bare-wordmark-on-stone violation (1.55:1) was caught.
- **`main.js` was deliberately not split** (340 lines, sole owner of mutable `state`). Two
  reviewers agreed. If a seam is ever taken it should be `src/ui/announce.js` — `liveRegion` plus
  the two regions and their announce functions, data passed in, no `state` import.

### What Task 8 leaves you — read before writing the Game Over screen

**`src/ui/effects.js` is new** and owns every animation: `tickTo`, `runLedgerTheater`,
`spawnDeltaChip`, `spawnShortfallChip`, `purseShake`. It contains **no `requestAnimationFrame`** —
everything is timer-driven with an injectable `now`, values computed as `f(now() - t0)` and never
accumulated, and every animation returns a `finish()` that writes the target outright. That is what
makes it correct in a stalled tab, a zero-frame pane, or a skip. Keep it that way.

**Retain and retire animation handles.** `purseTicker` and `ledgerTheater` are module-scope in
`main.js` and retired at the top of `render()`. Discarding a `finish()` means timers writing to
detached nodes after navigation, and two animations racing one container — that was an Important
bug. If Task 9 adds a game-over ledger, retire it the same way.

**The live-region rule, learned the hard way.** The ledger went flood → silence → correct:

1. `aria-live` on `.ledger` let the counting theater fire ~30 utterances in 2.5s.
2. Moving it to a once-written `role="status"` line **inside `#app`** made it announce _nothing_ —
   `mount()` re-creates the node already-populated every render, and a live region inserted
   already-populated is silent.
3. Correct: `renderResult` emits **no** live region at all. It exports a string; `render()` writes
   it into a persistent region built by `liveRegion(id)` outside `#app`.

So: **never put a live region in rendered markup.** Export the string, announce from `render()`.

**`commerce()` detects rejection by object identity** (`const next = spend(state); if (next !== state)`),
not by comparing gold — `game.js` returns the identical object on refusal, so a gold comparison
would silently swallow a zero-cost or non-gold-changing spend.

**JS animation constants are now bound to their CSS tokens.** `styles.test.js` regexes the duration
out of `tokens.css` source and compares it to `BEAT_MS` / `CHIP_LIFE_MS` / `SHAKE_MS`, and asserts
those rules state no literal duration. Add a token, not a literal.

**`legacy.css` is down from 18 rules to 5.** Every removal was proved dead by mounting all six
phases, matching each selector against every rendered element, and resolving the cascade _per
declaration_ at six widths. **The plan's keep-list was wrong:** it directed deleting the button-skin
group, whose only match in the entire game is Game Over's restart button — deleting it would have
shipped that button unstyled. Task 9 deletes the file and moves `#app` / `button:disabled` into
`base.css`; re-verify the same way before removing anything, and check what Task 9's own markup
still depends on.

**One `MINUS` constant** is exported from `format.js` as a `−` escape. A source-walk test
asserts no `.js` or `.css` file in `src/` spells the glyph any other way — raw, JS escape, or CSS
`\2212`. Do not add a second copy.

### What Task 7 leaves you

Task 7 was marked **NOT COMPLIANT** on first review — the plan had omitted three spec requirements
outright. Assume the plan is incomplete for Tasks 8 and 9 too, and read the spec sections
themselves rather than trusting the plan's markup to be sufficient.

Things Task 8 will touch or depend on:

- **`logEntry()` / `logEntryText()` in `components.js`.** Log entries are now **data**
  (`{turn, kind, text, ...values}`) with `{who}{dmg}{taken}{gold}` slots, not pre-baked strings.
  Every value is escaped exactly once and substituted in a single pass, so a hostile name can
  neither inject nor mint a second placeholder. Verified against 6 payloads. Do not reintroduce
  string concatenation here.
- **Turn numbers are real.** `createCombat` seeds `turn: 1`, `pushEntry` stamps it, `enemyTurn`
  advances it, so a player action, its press and the reply all share one turn. The old code
  numbered log _lines_ and ran at roughly double the real turn count.
- **`playerHealth(state)` in `game.js` is the single read-side source of truth for player HP** —
  live combat figure during a bout, `state.health` between bouts. `renderHud` and both player
  posters go through it. Before this, the HUD read a stale field, so the health beam **never
  turned urgent during a fight**. Do not read `state.health` or `state.combat.player.health`
  directly in a renderer.
- **`poster()`'s `urgent` is an overridable default** (`urgent ?? derivation`). Tasks 8/9 render
  0-HP posters — pass `urgent: false` so a corpse's plate does not pulse forever.
- **Announcements are built, never rendered.** `liveRegion(id)` in `src/main.js` builds every
  live region: `.sr-only`, `aria-live="polite"`, `aria-atomic="true"`, appended to
  `document.body`. There are two — `#log-announcer` (combat exchanges) and `#ledger-announcer`
  (the result ledger, §8). **Separate on purpose:** both fire in the same tick when a fight ends
  (`endFight()` speaks the killing blow, then the result screen renders), and an `aria-atomic`
  region holds exactly one message, so sharing one would let the ledger overwrite the exchange
  that decided the bout before it was ever spoken. `renderResult` emits **no** live region: it
  exports `ledgerSummary(state, config)` as a string, and `render()` writes it once per result
  (guarded by `state.lastResult` identity, so a re-render of the screen already up is not
  re-spoken). Any future announcement belongs here too — see backlog item 26.
- **`#log-announcer`** is a persistent `.sr-only` live region appended to `document.body`, outside
  `#app`, so `mount()`'s wholesale `innerHTML` replacement cannot destroy it. It announces only the
  exchange that just happened, and `endFight()` calls it before `resolveFightOutcome` nulls
  `combat` — otherwise the killing blow is the one exchange never spoken.
- **`LOG_WINDOW` is gone.** The renderer emits the whole bout; CSS `max-height` + `overflow-y` plus
  the auto-scroll in `main.js`'s `render()` decide scrollback. Realistic worst case measured at
  254 entries / 29 KB / ~12 ms per mount.
- **`tests/grid-areas.test.js` now derives its screen list** by driving `mount()` over
  `Object.values(PHASE)`, and asserts variant parity both ways plus that a screen sizes as many
  rows as it names. Task 8's result screen is covered automatically — but it also means a layout
  mistake there fails this test rather than going unnoticed.

### What Task 6 leaves you

`src/ui/timing.js` holds all meter maths, pure and clock-injectable. `src/main.js` holds the
orchestration: the rAF sweep, the freeze, and the document-level key bindings.

Four correctness bugs were found _after_ the meter passed spec review — worth knowing, because
Task 7 touches the same fight screen:

1. **`meterZones` did not take `critWindowMult`.** With the Lucky Charm the drawn crit band was
   13.80% of the track while `resolveTiming`'s window was 20.70% — 6.9% of the track paid crit
   while painted as plain HIT, and the 150 g Charm changed **not one pixel** of the meter. The
   multiplier is now threaded through, and the guard test **derives** both sides (band from the
   rendered geometry, tier by bisecting `resolveTiming`) rather than restating a ratio, so it
   cannot rot into agreement with a future bug. Drawn == resolved at speed 5 and 11, charmed and
   not. **Spec §6.4's zone formulae still omit the multiplier — Task 10 must reconcile.**
2. The `canPress` re-render path did not re-seed the sweet spot, so a press turn reused the
   previous turn's zones.
3. `startMeter` never cancelled the outgoing rAF loop — four concurrent loops after four
   uncaptured turns, all stomping one shared `raf` handle.
4. Space was `preventDefault`ed unconditionally in FIGHT, so a keyboard user focused on
   Strike/Heavy/Block/Feint could not activate them. It now stands down over interactive elements.

Rules Task 7 inherits:

- **The Browser pane fires 0 rAF frames**, so the sweep cannot be observed there. Keep timing
  maths pure and clock-injectable; tests stub `requestAnimationFrame` to a no-op and assert zero
  frames painted. Do not add anything only a human can verify.
- Capture derives position from `performance.now() - t0`, never from a painted frame.
- `sweep` in `main.js` is deliberately not named `meter` — that name belongs to the bar helper.
- `combat.sweet` is seeded in `createCombat`, so there is no `?? 0.5` fallback to reintroduce.
- `poster()` still has **no `urgent` passthrough**. Task 7 wants one for the fight-screen posters.

### Architecture as it now stands — read before writing any UI code

`src/ui/render.js` was **split** in `8a3cde7`, while the component layer was frozen and provably
byte-identical. It is now three files:

- **`src/ui/components.js`** — `escapeHtml`, `shortfallAttr`, `snarkAside`, `btn`, `fillPct`,
  `meter`, `bar`, `poster`, `shopItem`, plus `URGENT_FRACTION` (0.33) and
  `REPAIR_URGENT_FRACTION` (0.5).
- **`src/ui/timing.js`** — `meterDistance`, `meterPosition`, `meterPeriod`. **Task 6 owns this file.**
- **`src/ui/render.js`** — screens only. It re-exports every moved symbol, so existing test
  imports still work. Do not re-add component helpers here.

Rules that later tasks must follow:

- **Route every commerce button through `btn()`** — never hand-roll `<button class="btn">`. It
  **throws** if `cost` is passed without a finite `gold`, which is what stops a call site silently
  rendering a full-price button as unaffordable.
- **Route every bar through `meter()`.** It clamps, keeps `aria-valuenow` inside its range, keeps
  the visible numeral in agreement with it, and **escapes its own label** — so a raw enemy name is
  safe to pass. `meter(..., { decorative: true })` drops `role`/`aria-*`/`bar__num` for purely
  ornamental bars.
- **Reuse the named constants** rather than re-introducing 0.33 / 0.5 / 50 literals.
- Every markup-generating refactor so far has been gated on proving **byte-identical output over a
  wide state matrix** (18k–24k states). Keep doing that; it is what has made the refactors safe.

### New guard rail: `tests/grid-areas.test.js`

Added in `c80fd17`. It parses all sheets in `@import` order, evaluates `@media` width features,
computes specificity plus source order, and asserts via jsdom that **no `.screen` child keeps a
named `grid-area` at a width where its container defines no matching `grid-template-areas`**.

This exists because the ≤640px block reset `grid-template-areas: none` while the five `.hub__*`
children kept their names — and an unmatched `grid-area` custom-ident does not fall back to
auto-placement, it collapses every named child into one implicit cell. The mobile hub was
overlapping, not stacking. Fixed with `.screen > * { grid-area: auto; }` in the same block.

**Tasks 7, 8 and 9 inherit that reset for free, but only if their `.screen--*` rules sit above the
≤640px block.** If you add a screen and this test fails, that ordering is why.

Other things a later task needs to know:

- `data-missing` is emitted on **both** the button and the `.btn__snark` span. Deliberate: spec
  §6.2's `::after` `attr()` resolves against the span, while the plan reserves the button copy for
  Task 7's click-rejection message. Nothing reads the button copy yet.
- `poster()` has **no `urgent` passthrough**, so a poster HP plate never flashes at low health the
  way the HUD bar does. §6.5 does not require it, but **Task 7 will want one** for the fight-screen
  posters — add it there.
- Renaming `.hub` → `.screen--hub` killed three more `legacy.css` rules: `:where(.hub .row)`, the
  `.hub` arm of the button-skin group, and `:where(.sponsor)` (jsdom: 0 matches each). **Task 8's
  trim list is bigger than the two entries originally recorded below.**

## Deferred backlog — STATUS MAP

This list accumulated across all nine feature tasks. **It has now been worked.** Read this header
before reading any item below, because most items are closed and the numbered text is left in place
only so old review reports still resolve.

**Closed — do not reopen.** Items **1, 2, 3, 5, 6, 7, 11, 12, 13, 14, 15, 19, 20, 22, 25, 29, 32.**
Commits: `a4ea0d1` (hex→tokens, `.bar__num`), `270126c` (disabled dim), `3947168` (commit face on the
type scale), `08fb8fa` (shortfall on snark-less buttons), `acb85bd` (seeded sweet spot, selector net),
`4fee4d5` (one `bannerStamp()`), `576f155` / `d2ac4e1` / `e6c01f0` / `a7b3da9` (spec §6.1 / §6.2 /
§6.4 / §5 / §6.9 / §6.12 reconciled to the shipped code), `52ae069` (spec §7's two stacking resets),
plus Task 9's `0330985` (items 7 and 25).

**Item 2 was never real.** `--ease-drop` _is_ defined as `steps(2, end)` in `tokens.css`, so the
prose and the token always agreed. Nothing to reconcile.

**Awaiting a human decision.** These are design, product or spec-policy calls, not patches, and no
agent should decide them unilaterally. They are collected with recommendations in the section
**"Open decisions"** at the end of this file: items **4, 8, 9, 10, 16, 17, 18, 21, 23, 24, 26/28,
27, 30, 31, 33**, plus items **34–37** (structural debt found by the final whole-branch review) and
the hub training row's 45px meter at 375px.

**A final whole-branch review then ran** — the one view no per-task review had. Verdict: **fit to
merge.** It checked every invariant this file states and found them holding branch-wide, with one
genuine defect: the rAF `sweep` was the only animation handle never retired, so ending a fight
without capturing the meter left the loop rescheduling itself forever against a detached node
(`7ec48b6`). It also found that **no state in the shared matrix had a populated combat log**, so
§6.9's four typographic channels were invisible to every markup-driven audit (`acab873`), and two
comments that stated things that were not true, including a _pasted_ U+25B8 under a comment claiming
it was an escape (`928998b`). Its remaining findings are items 34–37 below.

Original text follows.

**Task 8** trims `src/styles/legacy.css`: the `:where(.hud)` `margin-bottom` leak and the now-dead
`:where(.hud .gold)`. **Task 9** deletes the file and moves `#app` / `button:disabled` into
`base.css`. _(Both done; `legacy.css` no longer exists.)_

**Task 10 must reconcile:**

1. `.bar__num { font-size: 11px }` is below spec §8's type floor (Step 1b, already in the plan).
2. `components.css` urgency pulse uses `var(--ease-drop)`; spec §6.1 prose says `steps(2)`.
   Inherited verbatim from the plan's Task 3 Step 5.
3. Spec §6.2 hangs the unaffordable shortfall `::after` off the **optional** `.btn__snark` slot,
   so the three Train buttons — which have no snark aside — render no shortfall at all.
4. Spec §9 shows title-case button labels ("Repair Weapon"); the plan's call sites are
   sentence-case ("Repair weapon"). The plan was followed.
5. Buttons for no-op actions emit the native `disabled` attribute, so spec §6.2's
   `.btn[aria-disabled="true"]` dim rule never fires; dimming currently comes from `legacy.css`
   at opacity 0.4, not the spec's 0.45.
6. Spec §6.2's CSS block in `components.css` is **byte-exact** to the spec and so still contains a
   literal `#cdb98e` and a literal `21px` that bypass the token scale, plus an empty
   `.btn.is-unaffordable {}` rule. Fixing these in an earlier task would break verified byte-exact
   compliance — they are spec bugs, so reconcile spec and code together here.
7. `src/ui/render.js` still hand-formats a few `${...}g` strings instead of using `formatGold`
   (spec §2 says nothing formats money by hand).
8. `.sponsor-card` has no dog-eared folded-triangle pseudo-element (spec §6.10).
9. `.shop-item` has no icon well (spec §6.12).
10. `.poster__portrait` is a fixed `height: 104px`, not spec §6.5's fixed 4:3 well.
11. The §6.2 CSS block is **no longer byte-exact** to the spec fence: Task 5 merged the duplicated
    price-colour and shortfall-`::after` rules into selector lists shared with `.shop-item`. The
    **declarations are unchanged** — only two selectors gained a comma-mate. Verified by parsing
    both blocks: zero declaration diffs.
12. Spec §6.12's state table still lists `aria-disabled` for the Owned gear card, but the code
    deliberately omits it — the card is a role-less `<div>`, where assistive tech ignores the
    attribute, and the visible "✓ Owned" already conveys the state. (`btn()`'s inert `owned`
    state on a real `<button>` does still use it, correctly.)
13. **Spec §7's mobile recipe carries the grid-area overlap bug** described above — it resets
    `grid-template-areas` without resetting the children's `grid-area`. Additionally its ≤900px
    `.screen--result, .screen--gameover { grid-template-areas: none }` will overlap those screens'
    children once Tasks 8/9 add them. `tests/grid-areas.test.js` will catch it; reconcile the spec
    text with the working `.screen > * { grid-area: auto; }` fix.
14. One CSS rule is unguarded: no test matches CSS selectors against markup, so dropping the
    `.shop-item` arm of the merged shortfall selector survives mutation. Pre-existing, low value
    to fix on its own, but worth knowing the stylesheet has no selector-coverage net.
15. **Spec §6.4's zone formulae omit `critWindowMult`** while demanding the drawn zones match
    `resolveTiming`. The code now threads it through; the spec text has not been updated.
16. Spec §6.4's normative HTML mandates `role="application"` on the meter but shows **no
    `tabindex`**, which makes the role unreachable — §8 then requires focus-visible, a ≥44×44
    target ("the meter itself") and Enter-to-activate. `tabindex="0"` plus an Enter handler was
    added to satisfy §8. A re-reviewer noted **`role="button"` would read better** ("button", free
    activation semantics) and recommends it; changing the mandated role is a spec decision.
17. Spec §6.4's freeze also specifies a 250ms hold, chicken squash, zone flash and `.meter__stamp`;
    the plan shipped only the `is-captured` class and a colour change, so the freeze feedback was
    thinner than §6.4's "never skip it". **Two of the four have since shipped** (visual-upgrade
    Phase 1, Task 7): the struck-zone flash (`.meter__zone.is-flashing`) and the verdict stamp
    (`.meter__stamp`), both raised by `main.js` at the capture. Still outstanding: the chicken
    squash, omitted entirely for want of an asset and deferred to Phase 3 (§6.4 names the ink
    cursor as the functional fallback), and the **250ms hold**, which is still not implemented —
    there is no timer in `main.js` at all, so the verdict shows at the freeze and the action
    resolves on the player's next click rather than after a held beat.
18. `.meter__labels`, `.meter__taunt` and `is-captured` are not in spec §6.0's **closed class
    index** — though §6.4's own HTML fence uses `meter__labels`, so the index is internally
    inconsistent. Also §6.4 wants MISS/GRAZE/HIT/CRIT ticks aligned to zone edges; the plan's six
    evenly-spaced word spans never line up with a random centre, so the label row can mislead.
19. The seeded default sweet-spot value is unpinned — a test asserts only that it lands inside the
    band, so mutating the seed to 0.5 survives. Zero production impact: the default is re-seeded
    before it can ever render.

20. Spec §7's comment puts the fight's action grid inside `.commit-bar` when stacked; the plan's
    markup has no `commit-bar` on `.fight__actions`. The plan was followed. (§7's line is a
    comment, not a rule, and the hub already implements it.)
21. `fight__you|stage|foe|log|actions|grid` are not in spec §6.0's closed class index — the same
    shape as the already-accepted `hub__*` classes.
22. Spec §6.9 says at most **one entry** announced per turn, but `#log-announcer` joins the whole
    exchange (2 entries, 3 with a press) into one utterance. One _announcement_ per turn, but not
    one _entry_ — reconcile the code or the spec line.
23. **Two live regions now cover the same content:** `aria-live="polite"` remains on the
    `<ul class="log">` (§8 mandates it) alongside `#log-announcer`. On AT that speaks a
    freshly-inserted live region, the duplicate reading is now the entire bout.
24. **A non-terminating fight is reachable** — a player whose guard ≥ the enemy's max crit damage
    who blocks every turn never finishes (measured: 5000 exchanges, enemy still at 40 HP). This is
    a **game-logic bug that predates the design system**, but it now has no log cap in front of it:
    10,000 entries would mean ~1 MB of `innerHTML` re-parsed every turn. Fix the stall, not the log.
25. `renderGameOver` emits no HUD, so §6.1's "HUD persists showing the fatal state (0/100)" is
    unmet. **Task 9 territory** — flagged here so it is not lost.
26. **`banner-stamp`'s `role="status"` is a live region that cannot speak.** It is emitted inside
    `#app`, so `mount()` re-creates it on every render with "VICTORY!" already inside it — and a
    live region inserted already-populated announces nothing. Exactly the defect that put
    `#log-announcer` outside `#app`, and the one that made the ledger's in-card `role="status"`
    summary silent. Spec §8 mandates `role="status"` on the result stamps **explicitly**, so the
    markup was left as the spec demands rather than fixed under Task 8. Task 10 should reconcile
    the spec with the only arrangement that actually speaks: a persistent region outside `#app`,
    written after insertion (`liveRegion()` in `src/main.js`).

Carried out of Task 9's review-fix round. All are Task 10's, and none were touched by it.

27. **§6.13's giant Roman sandal** — a content image descending behind the death stamp — is not
    rendered. Same call as the §6.4 chicken: no asset exists, and spec §10 requires the UI to
    look complete with zero content assets present. Reconcile the spec text with the asset-free
    cover, or commission the asset.
28. **Backlog item 26 needs extending to game over.** It reasons about the _result_ stamps only,
    but `renderGameOver` now emits a `.banner-stamp` too, with no `role="status"` at all. The
    fix is the same persistent-region-outside-`#app` arrangement, and it should be decided once
    for both screens rather than twice.
29. **`.banner-stamp` is built two ways.** `renderResult` inlines its two variants with the copy
    written in the renderer; `renderGameOver` reads `{variant, text}` off `config.endings`. One
    `bannerStamp(variant, text)` helper plus the result screen's copy moved into `config` would
    leave the game with one spelling of a stamp and one home for stamp copy. (Task 9's fix round
    moved the game-over half; the result half is still inline.)
30. **`main.js` should stay whole.** 340 lines and the sole owner of the mutable `state`; a
    reviewer recommended leaving it. If a seam is ever taken it should be `src/ui/announce.js`
    (the `liveRegion` builders and the two announcers), not a phase-by-phase split.
31. **The M2 parchment quartet is copy-pasted into eight rules.** `.poster`, `.shop-item`,
    `.sponsor-card`, `.log`, `.ledger`, `.banner-stamp`, `.ending-card` and `.cause-of-death`
    each restate `background: var(--grad-paper)` + the ink border + a wobble radius +
    `--shadow-paper`. It is spec §6's own shape (each entry states its own block), so this is a
    spec-and-code decision, not a tidy-up.
32. **`button:disabled` in `base.css` sits a file away from §6.2's `.btn[aria-disabled]`** in
    `components.css`, and the two dim to different opacities (0.4 vs 0.45). This is deferred
    item 5 seen from the other side; reconcile them together.
33. **`.wordmark` fails §8's contrast floor even on parchment.** `--ink-soft` at `opacity: .7`
    over `--paper-3` (the darker gradient stop) is **2.80:1**, against a 4.5:1 floor — on the
    result screen as much as on game over. Task 9's fix round moved the game-over wordmark off
    the stone slot (1.54:1) and onto the cause card, which is Law 4, and added a Law-4 ground
    test; it did **not** raise the wordmark's own contrast, because doing so would restyle the
    already-reviewed result screen. Decide whether the wordmark is decorative branding (and say
    so in §8) or text (and drop the `opacity: .7`).

**Task 8's `legacy.css` trim list keeps growing.** Dead as of now: `:where(.hud .gold)`,
`:where(.hub .row)`, the `.hub` arm of the button-skin group, `:where(.sponsor)`,
`:where(.meter-sweet)`, `:where(.timing-meter)`, `:where(.combatants)`, `:where(.press)`,
`:where(.log)`, and the `.actions` arms of both `:where(.actions)` and the button-skin group.
Plus the `:where(.hud)` `margin-bottom` leak. Verify each is really dead before removing it —
jsdom `element.matches` over a mounted screen is how the earlier ones were confirmed.

## Dispatch pattern that actually works in this environment

Empirically, over ~10 subagent dispatches: **fresh agent + synchronous (`run_in_background: false`)
succeeded 5/5.** Background reviewers stalled twice on the 600s watchdog and resumed agents failed
twice (one stall, one API disconnect) — all four died having made **zero** edits, so nothing was
corrupted, but the time was lost. Prefer fresh synchronous dispatches with self-contained prompts
over resuming an agent via SendMessage.

Other prompt ingredients that measurably improved output quality:

- Tell the subagent to **read its own task section from the plan file** rather than pasting it in.
  Cheaper, and it closes the invisible-character corruption channel.
- Forbid browser/preview/dev-server tools explicitly, and say cascade questions are answerable
  analytically and selector questions via jsdom `element.matches` (jsdom won't resolve from `/tmp`,
  so scratch scripts must sit in the repo root and be deleted after).
- Ask reviewers to **mutation-test** the assertions they're reviewing. This is what caught both
  vacuous tests in Task 3 and the U+00A0 bug in Task 2; neither was visible by reading.
- Cap report length ("under 20 lines, don't paste diffs"). Uncapped reports were the single largest
  consumer of coordinator context.

## Plan amendments already made (do NOT revert these)

The plan was amended mid-flight after code review found defects **in the plan itself**. All are
committed. A fresh session must treat the amended plan as authoritative:

1. **Legacy CSS moved to `src/styles/legacy.css`, every selector `:where()`-wrapped.** The
   original plan kept legacy rules inline in `src/styles.css`, where
   `.hub button, .actions button, …` at specificity `(0,1,1)` beat `.btn` at `(0,1,0)` **regardless
   of import order** — Tasks 4–9 could never have restyled a single button. `:where()` zeroes
   specificity so every new component rule wins. Verified: all 7 rewritten selector pairs match
   an identical element set in jsdom, so the wrapping is specificity-only, not behavioural.
   Task 8 trims this file; Task 9 deletes it and moves `#app`/`button:disabled` into `base.css`.
2. **`#app` cap raised 720px → 1180px.** Spec §7 builds `230px 1fr 300px` grids inside `#app`;
   an id-specificity 720px ancestor cap would have silently crushed Tasks 5–7, and the `≤900px`
   breakpoint is viewport-based so it never fires to rescue a squeezed grid. 1180px matches
   `.screen`'s own max-width, so deleting the rule later is a no-op.
3. **Two-tone focus ring in `base.css`.** Plain `--color-focus` blue is **1.12:1 on `--stone-2`**
   (invisible) and also fails on wood (2.23:1) and paper (2.85:1). Added
   `box-shadow: 0 0 0 6px var(--bone-bright) !important` as a bone halo. The `!important` is
   deliberate — spec §8 is ship-blocking and a component's own `box-shadow` must not swallow it.
   Task 10's keyboard check now includes **stone** in the surface list.
4. **All 9 NBSPs in the plan rewritten as visible ` ` escapes** + an invisible-character
   warning + a codepoint-pinning test in Task 2. See the post-mortem below.
5. **New `tests/styles.test.js`** — asserts every `var(--x)` across the sheets resolves to a
   defined token. A misspelled custom property throws no error anywhere; it silently resolves to
   nothing. Mutation-verified non-vacuous. Reads the sheet list dynamically, so Task 9's deletion
   of `legacy.css` won't break it.
6. **New Task 10 Step 4b** — replace the vendored OFL 1.1 _template_ (its copyright line still
   reads `Copyright (c) <dates>, <Copyright Holder>`) with the three families' real upstream OFL
   files from `github.com/google/fonts`. Do not hand-write copyright lines.
7. **`scripts/fetch-fonts.mjs` hardened** — `res.ok` checks, `?.[1]` destructures, and a post-loop
   assertion that every declared filename was actually written (the realistic failure is Google
   collapsing `400;700` into one ranged block, which would silently skip a file and leave a stale
   one). Exposed as `npm run fonts`.

## Post-mortem: the U+00A0 bug (read this before relaying any code to a subagent)

Spec §2 requires the gold unit separator to be **U+00A0 non-breaking space**, so prices never
line-break between amount and unit. The first Task 2 implementation used an ASCII space in both
`format.js` and its tests — so the suite was **green while violating the spec**, and every price,
ledger row, and delta chip in the game would have inherited the defect.

Root cause was **not** the implementer. The coordinator pasted the plan's code blocks into the
subagent prompt, and the literal U+00A0 characters were normalised to plain spaces in transit. The
implementer copied faithfully from corrupted input. The same normalisation then broke the
coordinator's own `Edit` calls when trying to fix it.

**Rules adopted as a result:**

- Never rely on relaying literal invisible or lookalike characters (U+00A0, U+2212, U+2014).
  Write them as escapes in source, or generate them with a script.
- Prefer pointing subagents at the plan file to read their own task section over pasting it.
- Pin significant codepoints with assertions (`expect(s.codePointAt(0)).toBe(0x2212)`), never with
  a comparison against a pasted character — that comparison passes when both sides are wrong.

## Operational notes

- **Do not give reviewer subagents browser/preview tools for CSS cascade questions.** Two agents
  were killed by a 600s stall watchdog while trying to drive a browser. Cascade and specificity
  are answerable analytically, and selector matching is answerable with jsdom + `element.matches`.
- **Don't run a reviewer while editing the tree.** One stall was caused by a reviewer noticing
  concurrent edits and trying to reconcile them.
- Never dispatch two _implementers_ in parallel. An implementer + a read-only reviewer on disjoint
  files is fine.
- The Browser pane reports `visibilityState: "hidden"` and fires **0 rAF frames**, so the timing
  meter's sweep cannot be observed there. Not a regression — don't chase it. Re-confirmed at the end
  of Task 10: 0 frames in 400ms. **No automated check anywhere can show the sweep running.**
- **jsdom has no layout engine, and that blind spot is real.** Two defects survived every review and
  a 376-test suite because no assertion could measure a used width: every poster HP plate was
  collapsed to 5px with its numeral spilling outside the poster, and the ≤640 sticky commit bar
  rendered as a 173px chip floating over the card beneath it. **A real browser pass found both in
  minutes.** Do one before believing a layout is done.
- `.claude/` is intentionally untracked.

---

## Open decisions — need a human, not an agent

> **RESOLVED 2026-08-01.** Every decision below was made by the maintainer and is recorded,
> with its implementation contract, in `docs/superpowers/specs/2026-08-01-cleanup-decisions-design.md`
> (this cleanup) and `docs/superpowers/specs/2026-08-01-visual-phase-decisions.md` (the visual
> phase: items 17 and 27 resolve there as "commission the assets"). The text below is kept
> only so older review reports still resolve; do not work from it.

Everything else in this plan is done. These are the calls no agent should make alone. Each line is
the conflict, then a recommendation.

**Accessibility policy (one decision covers several items)**

- **33 + the systemic pattern.** Is text at `opacity: .7` decorative-and-exempt, or must it meet
  §8's 4.5:1? Measured: `.wordmark` `--ink-soft` @ .7 is **2.79:1** on `--paper-3`; locked ending
  cards are **4.19:1** (title) and **2.72:1** (snark); `is-owned` and disabled states sit lower.
  _Recommendation:_ exempt the wordmark as a logotype (WCAG 1.4.3 allows it) and raise the rest —
  the locked-card snark is real text a player is meant to read.
- **16.** §6.4 mandates `role="application"` on the meter; a reviewer preferred `role="button"`
  ("button" reads better, activation semantics are free). _Recommendation:_ switch to `button`, and
  amend §6.4 — `application` suppresses browse mode for a control whose only children are four
  presentational divs.
- **23.** Two live regions cover the same content: `aria-live` remains on `<ul class="log">`
  alongside `#log-announcer`. _Recommendation:_ drop it from the `<ul>` — it is inside `#app`, so
  it is re-created already-populated every render and cannot speak anyway.
- **26 + 28.** `banner-stamp`'s `role="status"` is the same mute-region defect, on both the result
  and game-over stamps. §8 mandates the role, so fixing it means moving the announcement out to a
  persistent region. _Recommendation:_ do that, reusing `liveRegion()`.
- **18 + 21.** `.meter__labels`, `.meter__taunt`, `is-captured`, `fight__*`, `result__*`,
  `gameover__*`, `is-hidden`, `is-shaking` are not in §6.0's **closed** class index — though §6.4's
  own fence already uses `meter__labels`, so the index is internally inconsistent.
  _Recommendation:_ add the families to §6.0; the index is stale, not the code.

**Visual features the spec asks for and the code does not have**

- **8** `.sponsor-card`'s dog-eared folded-triangle pseudo-element (§6.10). **9** `.shop-item`'s icon
  well (§6.12). **10** `.poster__portrait` is a fixed 104px, not §6.5's 4:3 well — this is why the
  portraits look letterboxed at desktop width. **17** §6.4's freeze extras: the zone flash and
  `.meter__stamp` shipped in visual-upgrade Phase 1 (Task 7), leaving the **250ms hold** (no timer
  in `main.js`) and the chicken squash, omitted entirely for want of an asset and deferred to
  Phase 3. **27** §6.13's giant Roman sandal behind the death stamp, likewise.
  _Recommendation:_ do **10** (it is a visible layout flaw, and cheap), then decide whether the
  asset-dependent ones are worth commissioning art for or should be cut from the spec.

**Copy and layout judgement**

- **4.** §9 shows title-case button labels ("Repair Weapon"); the code is sentence-case ("Repair
  weapon"). _Recommendation:_ pick one and make §9 and the call sites agree — it is pure style.
- **20.** §7's comment puts the fight's action grid inside `.commit-bar` when stacked; the markup
  does not. _Recommendation:_ drop the comment; the hub already covers the stacked-commit case.
- **The hub training row at 375px.** The `1fr` meter gets only **45px**, because the `auto` Train
  button takes max-content. No one-line fix: a `minmax()` floor would also require extending
  `fixedTrackPx()` in `tests/grid-areas.test.js`, which refuses `minmax(` by design. Mitigating —
  the meter is `decorative: true` and the real number sits in the label beside it ("Power 24"), so
  no information is lost. _Recommendation:_ leave it, or let the button shrink and accept a wrapped
  label.

**Structural debt**

- **30.** `main.js` should stay whole — 340 lines, sole owner of the mutable `state`. Two reviewers
  agreed. If a seam is ever taken, take `src/ui/announce.js`.
- **31.** The M2 parchment quartet (`--grad-paper` / `--border-ink` / `--shadow-paper` / radius) is
  copy-pasted into nine rules. _Recommendation:_ one `.parchment` class or a `@mixin`-style shared
  rule, once the §6.0 index question above is settled.
- **34. The page column is declared twice.** `#app` (`base.css:16`) and `.screen` (`screens.css:3`)
  both set `max-width: 1180px; margin: 0 auto; padding: var(--space-4)`. The gutter therefore doubles
  to 32px, `.screen`'s 1180 cap is **unreachable** (`#app`'s content box is 1148), and `base.css`'s
  comment that it "bounds nothing a screen renders" is untrue. The same 32px also makes
  `tests/grid-areas.test.js`'s overflow budget (`width - 2*SPACE_4`) too generous — latent, nothing
  exceeds it today. _Recommendation:_ keep the cap and padding in one place; `.screen` is the better
  home now that `legacy.css` is gone.
- **35. Shortfall copy is spelled twice, in two languages.** `components.css:92`'s
  `content: " (need " attr(data-missing) " more)"` and `effects.js:209`'s
  `${MINUS}need ${missing} more`. Only the JS half is pinned by a test, so the CSS half can drift
  silently. _Recommendation:_ one source, or a test that reads the CSS string.
- **36. Dead component states.** `btn()`'s `owned` branch and `variant: 'danger'` have **no call
  site** ("Bribed ✓" uses native `disabled`). `.btn.is-owned(:hover)`, `.btn--danger`,
  `.btn.is-disabled`, `.btn[aria-disabled="true"]` and `.poster--tilt-3` match nothing in the
  10-state matrix — so `styles.test.js:450` derives a live rule's opacity from a rule no rendered
  element ever matches. 16 tokens are unreferenced. _Recommendation:_ delete what the spec does not
  require and keep what it does, once decisions 18/21 settle §6.0.
- **37. The source split was never mirrored in the tests.** `components.js` and `timing.js` have no
  test file of their own; both are reached through `render.js`'s re-export barrel inside the
  1636-line `tests/render.test.js`. `tests/screens.test.js` (5 tests) also overlaps
  `render.test.js` / `main.test.js`. _Recommendation:_ optional; split if `render.test.js` grows.

**Game logic, not design**

- **24.** A **non-terminating fight** is reachable: a player whose guard ≥ the enemy's max crit
  damage who blocks every turn never finishes (measured 5000 exchanges, enemy still at 40 HP). This
  **predates the design system** and is the only item here that is a genuine bug rather than a
  reconciliation. _Recommendation:_ fix it first — add a damage floor or a turn cap. It also has no
  log cap in front of it now, so a stalled fight grows the DOM without bound.
