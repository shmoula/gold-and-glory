# Design System Implementation — Progress / Handoff

**Plan:** `docs/superpowers/plans/2026-07-24-design-system-implementation.md`
**Spec:** `docs/superpowers/specs/2026-07-23-gold-and-glory-design-system.md`
**Branch:** `feat/design-system` (branched from `master` @ `385e732`)
**Method:** `superpowers:subagent-driven-development` — fresh implementer subagent per task,
then spec-compliance review, then code-quality review, then next task.

## Status

| Task | State | Commit |
|---|---|---|
| 1 — Fonts, tokens, base CSS | **done, reviewed, fixed, re-verified** | `959ad35` + `eb1ea52` |
| 2 — `formatGold` | **done, reviewed, fixed, re-verified** | `2f9a10f` + `7528dc4` |
| 3 — HUD beam | **done, both reviews passed** | `b42f8b6` + `f0e3fb7` + `3595343` |
| 4 — Button system + snark | **done, both reviews passed** | `5e42184` + `9b0f859` |
| 5 — Hub screen | **done, both reviews passed** | `16ffa9c` + `8a3cde7` + `741afd0` + `c80fd17` |
| 6 — Timing meter | **done, both reviews passed** | `078b8a1` + `616d6b3` + `b112433` |
| 7 — Fight screen | pending | — |
| 8 — Result screen + effects | pending | — |
| 9 — Game Over | pending | — |
| 10 — Verification pass | pending | — |

Baseline at handoff: **98 tests passing**, `npm run build` clean, fonts emit 3 assets
(Nunito 400/700 are the same variable file and Vite dedupes them — this is expected, not a bug).

## RESUME HERE — Task 7 (Fight screen layout + combat log)

Tasks 3, 4, 5 and 6 are **fully closed**, each with spec review + code-quality review + at least
one fix round + an independent re-review. Suite is **183 tests green**, build clean. Every fix
assertion was mutation-verified twice — once by the implementer, once independently by a reviewer.

- Task 3: `b42f8b6` → `f0e3fb7` (5 review fixes) → `3595343` (2 quality fixes).
- Task 4: `5e42184` → `9b0f859` (9 quality fixes).
- Task 5: `16ffa9c` → `8a3cde7` (file split + 2 quality fixes) → `741afd0` (7 fixes + the player
  poster) → `c80fd17` (mobile grid-area overlap fix).
- Task 6: `078b8a1` → `616d6b3` (4 correctness bugs) → `b112433` (7 polish fixes).

### What Task 6 leaves you

`src/ui/timing.js` holds all meter maths, pure and clock-injectable. `src/main.js` holds the
orchestration: the rAF sweep, the freeze, and the document-level key bindings.

Four correctness bugs were found *after* the meter passed spec review — worth knowing, because
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

## Deferred backlog — do NOT re-report these as new findings

Carried out of Tasks 3 and 4. Each is a plan/spec contradiction or a later task's remit.

**Task 8** trims `src/styles/legacy.css`: the `:where(.hud)` `margin-bottom` leak and the now-dead
`:where(.hud .gold)`. **Task 9** deletes the file and moves `#app` / `button:disabled` into
`base.css`.

**Task 10** must reconcile:
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
    the plan shipped only the `is-captured` class and a colour change, so the freeze feedback is
    thinner than §6.4's "never skip it". The chicken is omitted entirely (no asset); §6.4 names the
    ink cursor as the functional fallback.
18. `.meter__labels`, `.meter__taunt` and `is-captured` are not in spec §6.0's **closed class
    index** — though §6.4's own HTML fence uses `meter__labels`, so the index is internally
    inconsistent. Also §6.4 wants MISS/GRAZE/HIT/CRIT ticks aligned to zone edges; the plan's six
    evenly-spaced word spans never line up with a random centre, so the label row can mislead.
19. The seeded default sweet-spot value is unpinned — a test asserts only that it lands inside the
    band, so mutating the seed to 0.5 survives. Zero production impact: the default is re-seeded
    before it can ever render.

**Task 8's `legacy.css` trim list has grown again:** `:where(.meter-sweet)` is now dead too, since
Task 6 deleted its markup.

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
6. **New Task 10 Step 4b** — replace the vendored OFL 1.1 *template* (its copyright line still
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
- Never dispatch two *implementers* in parallel. An implementer + a read-only reviewer on disjoint
  files is fine.
- The Browser pane reports `visibilityState: "hidden"` and fires **0 rAF frames**, so the timing
  meter's sweep cannot be observed there. Not a regression — don't chase it.
- `.claude/` is intentionally untracked.
