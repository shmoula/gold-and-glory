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
| 5 — Hub screen | pending | — |
| 6 — Timing meter | pending | — |
| 7 — Fight screen | pending | — |
| 8 — Result screen + effects | pending | — |
| 9 — Game Over | pending | — |
| 10 — Verification pass | pending | — |

Baseline at handoff: **98 tests passing**, `npm run build` clean, fonts emit 3 assets
(Nunito 400/700 are the same variable file and Vite dedupes them — this is expected, not a bug).

## RESUME HERE — Task 5 (Hub screen: posters, cards, layout grid)

Tasks 3 and 4 are **fully closed**, each with spec review + code-quality review + a fix round +
an independent re-review. Suite is **122 tests green**, build clean. Every fix assertion was
mutation-verified twice — once by the implementer, once independently by a reviewer.

- Task 3: `b42f8b6` → `f0e3fb7` (5 review fixes) → `3595343` (2 quality fixes).
- Task 4: `5e42184` → `9b0f859` (9 quality fixes).

Notable Task 4 outcomes a later task may need to know:
- `btn()` in `src/ui/render.js` is now the single button factory: options object, optional
  `action`, an inert `owned` state, and named `URGENT_FRACTION` / `REPAIR_URGENT_FRACTION`
  constants. It **throws** if `cost` is passed without a finite `gold`, so Tasks 5/7/8 call sites
  cannot silently render a full-price button as unaffordable. `btn` is exported for that guard's
  test. Route every new commerce button through it rather than hand-rolling `<button class="btn">`.
- `data-missing` is emitted on **both** the button and the `.btn__snark` span. This is deliberate:
  spec §6.2's `::after` `attr()` resolves against the span, while the plan reserves the button copy
  for Task 7's click-rejection message. Nothing reads the button copy yet.
- `renderHub` markup was proven **byte-identical** across the Task 4 refactor over a 1176-state
  matrix, so the spec sign-off on the old markup still holds.

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
