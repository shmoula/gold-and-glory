# Visual Upgrade Phase 3 — Hand-Authored Art Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author and land every piece the sourcing spike proved un-sourceable — rubber chicken, stone-brick frame, arena backdrop, five portraits, endings/death art — in one house style, per `docs/superpowers/specs/2026-08-02-visual-upgrade-design.md` §5, while bringing the asset payload back under the 300KB hard budget.

**Architecture:** Every asset is a hand-written SVG in `src/assets/art/`, following the §2.3 house recipe (token colors only, one ink stroke width locked by the first asset, flat fills + one shade, one crayon-hatch group). Art plugs into wells and layers Phase 1/2 built: CSS `url()` keyed on `data-*` attributes (portraits, endings), `border-image` (frame), a background layer (backdrop), and one `<img>` (the chicken — the sole markup asset, §6.4's own spelling). Every fallback stays wired: silhouettes, solid frame border, stone body, bare ink cursor.

**Tech Stack:** Hand-written SVG (no editor cruft — a text editor IS the tool here), Vite 5, vitest (jsdom) rule-level tests, ESLint.

**Baseline at start:** Phase 2 landed on `main` (`9112bee`); suite + lint green; asset payload **272,116 bytes of the 300KB budget** — see the budget rebalance below.

**Rules that bind every task:**
- Doc-first: Task 1 amends the docs before any code/art lands (§10).
- **Per-task visual verification is NOT skippable.** Phase 1's retro records that batching visual checks to the end let two layout defects ride through a green jsdom suite. Art tasks are eyeball work by definition: every task here ends with its own dev-server look at true rendered size, and the task is not done until that look happened. No batching to Task 8.
- House recipe (§2.3): colors from `tokens.css` only; transparent background; ink outline `#2f2318` at the stroke width Task 2 locks; flat fills, ≤1 shade layer per shape; one low-opacity crayon-hatch group; per-asset byte caps below are HARD (the budget test is the arbiter).
- Ship-at-any-cut: tasks 2–7 are ordered by leverage (spec §5) and each is one self-contained commit into an already-working well. Stopping after any task leaves a shippable game.
- Run `npm test && npm run lint` before every commit. Mirror the phase convention: branch `feat/visual-upgrade-phase-3-art`.

**Budget rebalance (why some stock leaves in this phase):**

Committed payload is 272,116 bytes; the ceiling is 307,200 (300KB). Three Phase 2 stand-ins are both the heaviest files and the very slots Phase 3 redraws:

| Change | Bytes |
| --- | ---: |
| Current payload | 272,116 |
| DELETE `props/gold-pile.svg` (147,146 — over half the entire budget; §5.5 composites the retired figure over the pile anyway, so pile+figure become ONE authored piece) | −147,146 |
| DELETE `props/cactus.svg` (30,724 for a corner gag; redrawn in-house at ~3KB) | −30,724 |
| DELETE `props/sandal-base.svg` (11,347; §4.4 called it a stand-in until Phase 3 redraws it Roman) | −11,347 |
| Base after removals | 82,899 |
| ADD (hard caps): chicken 8K, frame 24K, backdrop 48K, portraits 5×12K, belt 8K, retired-rich 14K, vignette 12K, sandal 8K, cactus 3K, optional gags 6K | +191,000 max |
| **Projected ceiling-case total** | **≤ 273,899 ✓** |

Deletions happen in the task that lands each replacement (never earlier — ship-at-any-cut), with the matching `CREDITS.md` line pruned in the same commit (the manifest keeps historical provenance; CREDITS describes current files only).

**File structure (what changes where):**

| File | Responsibility in this plan |
| --- | --- |
| design-system doc + visual-upgrade spec + manifest | doc-first amendments (Task 1); stroke-width lock recorded (Task 2) |
| `src/assets/art/chicken.svg` … `art/winged-boot.svg` | the authored pack (Tasks 2–7) |
| `src/ui/render.js` | chicken `<img>` in `renderMeter` (T2); `portrait` keys at 4 poster call sites (T5); `data-achieved` on the game-over section (T6) |
| `src/ui/components.js` | `poster()` gains `portrait` opt (T5) |
| `src/main.js` | sweep direction flip for the chicken (T2) |
| `src/styles/components.css` | chicken + drop choreography (T2); portrait rules (T5); belt/retired-rich rules (T6); optional gag mask swaps (T7) |
| `src/styles/base.css` | frame `border-image` (T3); backdrop layer (T4) |
| `src/styles/screens.css` | vignette prop, sandal/cactus url swaps (T6) |
| `tests/assets.test.js` | generic sheet-url→file test (T2); mask-count edit if T7 runs |
| `tests/render.test.js`, `tests/main.test.js` | chicken/portrait/vignette assertions (T2, T5, T6) |

---

### Task 1: Doc-first amendments

**Files:**
- Modify: `docs/superpowers/specs/2026-07-23-gold-and-glory-design-system.md`
- Modify: `docs/superpowers/specs/2026-08-02-visual-upgrade-design.md`
- Modify: `docs/superpowers/specs/2026-08-02-asset-sourcing-manifest.md`

- [ ] **Step 1: §6.4 — chicken behavior details**

§6.4 already specifies the chicken (markup at its HTML fence, `.meter-chicken` CSS, 40×48 feet-down, `scaleX(-1)` facing, drop + `scaleY(0.7)` squash, ink-cursor fallback). Append what implementation adds:

```markdown
**Amendment (Phase 3):** facing is driven by a `.is-reversing` class main.js toggles on
`.meter-cursor` when the sweep direction turns; the flip is a `--flip: -1` custom property so
the drop keyframes (which override `transform`) preserve it. The landed pose after capture is
STATE (a static `transform` under `.meter.is-captured`), and `chicken-drop` is decoration that
ends where the state already is — the same pattern the stamp landed on, so reduced-motion's
1ms blanket yields an instantly-parked chicken, never a snap-back. Sweep motion itself remains
under reduced motion (§5's existing exception: it is the game mechanic); only the drop
choreography compresses.
```

- [ ] **Step 2: §6.5 — portrait art keys**

Append to §6.5 (Wanted poster):

```markdown
**Amendment (Phase 3, visual-upgrade §5.4):** `poster()` accepts a `portrait` key emitted as
`data-portrait` on `.poster__portrait`. Keys are the five character ids: `player`, `brute`,
`journeyman`, `veteran`, `champion`. CSS keyed on the attribute layers the 4:3 authored art
over the well's recession and hides the silhouette — an unkeyed or unmatched poster keeps the
§10 silhouette fallback untouched. Call sites: fight (both plates), hub (both plates), result
recap (the defeated opponent).
```

- [ ] **Step 3: §6.14 — death vignette + achieved key**

Append to §6.14:

```markdown
**Amendment (Phase 3, visual-upgrade §5.5):** the game-over section carries
`data-achieved="<ending>"` when the ending is known. The dressing layer gains
`.prop--vignette` — the both-tripped-on-the-same-banana-peel tableau — shown only under
`[data-achieved='dead']` (`display: none` otherwise): the vignette illustrates a death, not a
retirement. `.gameover__stamp` takes `position: relative; z-index: 2` so the verdict banner
always reads above the dressing layer. Ending-card art grows to `win-circuit` (the ill-fitting
championship belt) beside `retired` (now one authored figure-on-gold-pile illustration
replacing the Phase 2 stock pile).
```

In §6.0's closed class index, append: `prop--vignette, is-reversing`.

- [ ] **Step 4: §6.17 — frame and backdrop art**

Append to §6.17 (Stage layers):

```markdown
**Amendment (Phase 3, visual-upgrade §5.2/§5.3):** `.stage-frame` upgrades its placeholder
border to cartoon masonry via `border-image` (nine-slice SVG, ink-outlined blocks, token
fills); the solid `--stone-2` border stays declared beneath it as the runtime fallback.
`.stage-backdrop` gains the arena scene as a muted background layer (opacity ≈ 0.55) — the
parchment UI stays loudest, and an absent file leaves the stone body showing (§10).
```

- [ ] **Step 5: visual-upgrade spec — budget rebalance + recipe lock slot**

In `2026-08-02-visual-upgrade-design.md`:
1. Append to §5's intro: "Phase 3 also owns the budget rebalance: the Phase 2 stand-ins it redraws (`gold-pile.svg` 147KB, `cactus.svg` 31KB, `sandal-base.svg` 11KB) are deleted in the same commits that land their replacements — §4.4's 'composites the character on top' resolves as ONE authored illustration, not a layer over the 147KB stock file."
2. In §2.3, change the stroke-width bullet's ending from "…then locked for everything after." to "…then locked for everything after. **Locked value: (recorded by Phase 3 Task 2 when the chicken lands.)**"

- [ ] **Step 6: manifest notes**

In the manifest §4 table: mark gold-pile, cactus, and sandal rows "(replaced by hand-authored art in Phase 3; stock file removed)".

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/specs/
git commit -m "docs(design-system): phase 3 amendments — chicken choreography, portraits, vignette, frame art"
```

---

### Task 2: The rubber chicken (recipe-calibrating asset, §5.1)

**Files:**
- Create: `src/assets/art/chicken.svg` (≤ 8KB)
- Modify: `src/ui/render.js` (`renderMeter`, cursor line ~473)
- Modify: `src/main.js` (`startMeter`'s `step()` ~line 225)
- Modify: `src/styles/components.css` (meter block — `.meter-chicken` + drop)
- Modify: `docs/superpowers/specs/2026-08-02-visual-upgrade-design.md` (§2.3 lock)
- Modify: `tests/assets.test.js`, `tests/render.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/assets.test.js`:

```js
describe('sheet urls resolve (§2.1 — a moved/deleted asset must fail in CI, not on screen)', () => {
  it('every url(../assets/…) in every sheet points at a committed file', () => {
    for (const sheet of [
      'src/styles/base.css',
      'src/styles/components.css',
      'src/styles/screens.css',
      'src/styles/tokens.css',
    ]) {
      const css = readFileSync(sheet, 'utf8');
      for (const m of css.matchAll(/url\('\.\.\/assets\/([^']+)'\)/g)) {
        expect(existsSync(join('src/assets', m[1])), `${sheet} → assets/${m[1]}`).toBe(true);
      }
    }
  });
});
```

In `tests/render.test.js` (fight describe area):

```js
it('mounts the chicken on the cursor, decorative, with the ink line as fallback (§6.4)', () => {
  const html = fightHtml();
  expect(html).toMatch(/<div class="meter-cursor"><img class="meter-chicken" src="[^"]+" alt="" \/><\/div>/);
});
```

Run: `npx vitest run tests/render.test.js -t chicken` — Expected: FAIL (bare cursor div).

- [ ] **Step 2: Author `src/assets/art/chicken.svg`**

Hand-write the SVG (this task CALIBRATES the house recipe — every later asset inherits its choices):
- `viewBox="0 0 40 48"`, transparent background, drawn facing RIGHT (travel direction; CSS flips the return leg), feet at the bottom edge.
- Composition: classic limp rubber chicken — plump oval body, drooping neck curving forward/down, small dismayed head with round eye + open beak, two stubby wing bumps, two splayed orange feet planted on the baseline.
- Palette (tokens only): body `#d9a441` (`--gold`) with ONE shade layer `#b07f24` (`--gold-deep`) on the belly/underside; beak + feet `#b5402f` (`--blood`); eye `#2f2318` ink.
- Ink outline: `#2f2318`, **pick the stroke width here** (try 1.75–2.25 at this viewBox — it must survive 40×48 rendering AND read as the same pen at portrait scale) — every shape outlined, `stroke-linejoin="round"`.
- One crayon-hatch group: 3–4 short curved strokes on the body, `stroke="#2f2318" stroke-opacity=".12" stroke-width="1.5"`.
- Cap: 8KB. Legibility check at 100%: open the file, zoom the browser so it renders 40px wide — silhouette must read "rubber chicken", eye and beak must survive.

- [ ] **Step 3: Record the lock**

In the visual-upgrade spec §2.3, replace "(recorded by Phase 3 Task 2 when the chicken lands.)" with the actual value, e.g. "**Locked value: 2 units at a ~40-unit-wide viewBox — scale stroke width proportionally to each asset's viewBox so the rendered pen width matches.**" (state whatever Step 2 actually chose).

- [ ] **Step 4: Mount it (renderer + sweep direction + choreography)**

1. `src/ui/render.js` — add the import at the top with the other imports:

```js
import chickenUrl from '../assets/art/chicken.svg';
```

and in `renderMeter()` replace `<div class="meter-cursor"></div>` with §6.4's own markup:

```js
        <div class="meter-cursor"><img class="meter-chicken" src="${chickenUrl}" alt="" /></div>
```

2. `src/main.js` — in `startMeter()`, the `step()` closure learns direction (the chicken faces where it walks):

```js
  const cursor = bar.querySelector('.meter-cursor');
  let prevP = null;
  function step() {
    if (!sweep.running) return;
    const p = meterPosition(performance.now() - sweep.t0, sweep.period);
    // Face the travel direction (§6.4): the ping-pong sweep reverses, the chicken turns.
    if (prevP != null && p !== prevP) cursor.classList.toggle('is-reversing', p < prevP);
    prevP = p;
    paintCursor(bar, cursor, p);
    sweep.raf = requestAnimationFrame(step);
  }
```

3. `src/styles/components.css` — in the meter block (after `.meter.is-captured .meter-cursor`, ~line 612), add:

```css
/* §6.4's chicken. --flip carries facing through every state INCLUDING the drop keyframes
   (a keyframe's transform would otherwise discard the scaleX and un-flip the bird mid-fall).
   The captured pose is STATE, the drop is decoration ending where the state already is —
   the stamp's own lesson, so reduced-motion's 1ms blanket parks it instantly, no snap-back. */
.meter-chicken {
  --flip: 1;
  position: absolute;
  bottom: 100%;
  left: 50%;
  width: 40px;
  height: 48px;
  transform: translateX(-50%) scaleX(var(--flip));
  transform-origin: 50% 100%;
  pointer-events: none;
}
.meter-cursor.is-reversing .meter-chicken {
  --flip: -1;
}
.meter.is-captured .meter-chicken {
  transform: translate(-50%, 14px) scaleX(var(--flip));
  animation: chicken-drop var(--dur-stamp) var(--ease-drop);
}
@keyframes chicken-drop {
  0% {
    transform: translate(-50%, 0) scaleX(var(--flip));
  }
  70% {
    transform: translate(-50%, 14px) scaleX(var(--flip)) scaleY(0.7);
  }
  100% {
    transform: translate(-50%, 14px) scaleX(var(--flip));
  }
}
```

Also update the stale comment at components.css:572 (".meter-chicken is omitted: the asset does not exist yet") — the asset exists now; rewrite the comment to point here.

- [ ] **Step 5: Run the suite**

Run: `npm test && npm run lint`
Expected: PASS. `tests/main.test.js`'s meter suite drives `q('.meter-cursor')` and zone geometry — both untouched; the stubbed rAF means `step()` never runs in jsdom, so the direction toggle is exercised visually, not in the suite (the `--flip` mechanism is CSS, which the rule-level tests can see if styles.test.js pins meter declarations — update any pinned spelling).

- [ ] **Step 6: Visual verification (NOT skippable — this look calibrates the whole pack)**

`npm run dev`, enter a fight: chicken rides the cursor feet-down, flips at each end of the track, drops with a squash exactly onto the frozen position, verdict stamp pops ABOVE it without collision (the stamp sits at `top: -6px` over the track; the chicken occupies `bottom: 100%` — check they don't overlap at capture; if they do, nudge `.meter__stamp`'s `top` up). Reduced-motion emulation: sweep still sweeps, drop is instant, pose correct. 375px: chicken doesn't clip the frame.

- [ ] **Step 7: Commit**

```bash
git add src/assets/art/chicken.svg src/ui/render.js src/main.js src/styles/components.css tests/ docs/superpowers/specs/2026-08-02-visual-upgrade-design.md
git commit -m "feat(art): the rubber chicken rides the meter — house recipe calibrated"
```

---

### Task 3: Stone-brick frame (§5.2 — one asset, all four screens)

**Files:**
- Create: `src/assets/art/stone-frame.svg` (≤ 24KB)
- Modify: `src/styles/base.css` (`.stage-frame` rule, ~line 41)

- [ ] **Step 1: Author `src/assets/art/stone-frame.svg`**

A nine-slice frame tile:
- `viewBox="0 0 288 288"` with a **96px** slice geometry: four 96×96 corner blocks, 96-wide repeating edge strips, EMPTY center (the center slice is discarded by `border-image`; leave it blank — bytes are budget).
- Composition: a child's drawing of a stone archway — irregular rounded-rectangle blocks, 2–4 per corner and 2–3 per edge strip, mortar gaps showing the ink between blocks. Edge strips must tile seamlessly against themselves (`border-image-repeat: round`) and meet the corners cleanly: draw edge blocks so the strip's two ends are mirror-compatible.
- Palette: block fills cycling muted token mixes — `#93836d` (`--stone-2`) base plus blocks tinted with `#6b5638`, `#3f6b35`, `#3e6fae`, `#b98a3a`, `#9c3226` at `fill-opacity=".35"` OVER a stone-2 underblock (the reference's colored masonry, §2.3's tokens-only rule kept); ink outlines at the Task 2 locked pen width (scaled: this viewBox is ~7× the chicken's, so ~7× the stroke units for the same rendered pen).
- One crayon-hatch group across a few blocks, `stroke-opacity=".1"`.

- [ ] **Step 2: Upgrade `.stage-frame`**

In `src/styles/base.css`, extend the `.stage-frame` rule (the solid border DECLARATION STAYS — it is the runtime fallback and the width source):

```css
.stage-frame {
  position: fixed;
  inset: 0;
  z-index: var(--z-frame);
  pointer-events: none;
  border: var(--frame-w) solid var(--stone-2);
  /* §6.17 Phase 3 amendment: cartoon masonry over the placeholder. Slice matches the SVG's
     96px corner geometry; `round` keeps edge blocks whole. If the file is absent at runtime
     the solid border above simply shows — §10 costs nothing here. */
  border-image-source: url('../assets/art/stone-frame.svg');
  border-image-slice: 96;
  border-image-repeat: round;
}
```

- [ ] **Step 3: Run suite + visual verification (NOT skippable)**

Run: `npm test && npm run lint` — Expected: PASS (the new sheet-url test now covers this url).
`npm run dev`: all four screens framed in masonry at 1280px and 375px (8px `--frame-w` at ≤640 — blocks read small but intact; if they smear, thicken the mortar gaps in the SVG rather than the CSS). Corners meet edges without seams; the sticky commit bar still seats on the frame's inner edge; no interaction anywhere near the frame is blocked (`pointer-events: none` is on the element, verify by clicking a button adjacent to the frame).

- [ ] **Step 4: Commit**

```bash
git add src/assets/art/stone-frame.svg src/styles/base.css
git commit -m "feat(art): cartoon masonry frame via nine-slice border-image"
```

---

### Task 4: Arena backdrop (§5.3 — muted, parchment stays loudest)

**Files:**
- Create: `src/assets/art/arena-backdrop.svg` (≤ 48KB)
- Modify: `src/styles/base.css` (`.stage-backdrop` rule)

- [ ] **Step 1: Author `src/assets/art/arena-backdrop.svg`**

One wide scene, `viewBox="0 0 1600 900"`:
- Composition (background → foreground): sky band (`#f6ecd1` warmed with a `#d9a441` `fill-opacity=".15"` wash); distant arena wall arc with arch openings (`--stone-2` fills, ink outlines); a crowd band along the wall top — **define ONE 6–8 head silhouette group in `<defs>` and stamp it with `<use>` repeatedly** (`#443019` `--silhouette` at `fill-opacity=".7"`, slight per-use y-jitter) — bytes come from `<use>`, not from drawing a crowd; awning strips over a few arches (`#b5402f`/`#3e6fae` at low opacity); arena floor from `#d9c69a` up to nothing (the UI covers it).
- Ink outlines at the locked pen width (scaled to this viewBox); one hatch group on the wall.
- Whole-scene restraint: this sits BEHIND parchment at 55% opacity — low contrast internally, no saturated fills, nothing that strobes against the cards.

- [ ] **Step 2: Layer it into `.stage-backdrop`**

In `src/styles/base.css`, the `.stage-backdrop` rule gains its scene:

```css
.stage-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-backdrop);
  /* §6.17 Phase 3 amendment: the arena scene, muted — parchment UI stays loudest (§5.3).
     Absent file ⇒ transparent layer ⇒ the body's stone shows, as Phase 1 shipped it. */
  background: url('../assets/art/arena-backdrop.svg') center bottom / cover no-repeat;
  opacity: 0.55;
}
```

- [ ] **Step 3: Run suite + visual verification (NOT skippable)**

Run: `npm test && npm run lint` — Expected: PASS.
`npm run dev`, all four screens at 1280/768/375px: the scene reads as "an arena is back there" in a squint test; every parchment card, plank, and label reads EXACTLY as before (§3's contrast table is measured on the components' own surfaces, which the backdrop never touches — verify the page gutter areas where text sits directly on the stage: only the wordmark and nothing else should be there). Tune `opacity` 0.45–0.65 to taste; crowd band must not moiré at 375px.

- [ ] **Step 4: Commit**

```bash
git add src/assets/art/arena-backdrop.svg src/styles/base.css
git commit -m "feat(art): muted arena backdrop behind the parchment UI"
```

---

### Task 5: Five portraits (§5.4 — escalating menace, silhouettes stay wired)

**Files:**
- Create: `src/assets/art/portrait-player.svg`, `portrait-brute.svg`, `portrait-journeyman.svg`, `portrait-veteran.svg`, `portrait-champion.svg` (≤ 12KB each)
- Modify: `src/ui/components.js` (`poster()`)
- Modify: `src/ui/render.js` (4 call sites)
- Modify: `src/styles/components.css` (portrait rules, near `.poster__portrait`)
- Modify: `tests/render.test.js`

- [ ] **Step 1: Write the failing tests**

In `tests/render.test.js`:

```js
it('keys the fight posters for their portraits, player and foe (§5.4)', () => {
  const html = fightHtml();
  expect(html).toContain('data-portrait="player"');
  expect(html).toMatch(/data-portrait="(brute|journeyman|veteran|champion)"/);
});

it('keeps the silhouette fallback for unkeyed posters', () => {
  // endingCard mounts poster wells with no portrait key — they must stay bare.
  const html = gameoverHtml();
  expect(html).not.toContain('data-portrait=');
});
```

Run: `npx vitest run tests/render.test.js -t portrait` — Expected: FAIL.

- [ ] **Step 2: `poster()` gains the key**

In `src/ui/components.js`:

```js
export function poster({ name, sub = '', snark = '', hp = null, tilt = 1, urgent, portrait = '' }) {
```

and the portrait div becomes:

```js
    <div class="poster__portrait" aria-hidden="true"${portrait ? ` data-portrait="${escapeHtml(portrait)}"` : ''}><span class="poster__silhouette"></span></div>
```

In `src/ui/render.js`, add the keys at all four poster call sites:
- `renderFight`: the You plate gets `portrait: 'player'`; the foe plate gets `portrait: opponent.id`.
- `renderHub`: the You plate gets `portrait: 'player'`; the next-bout plate gets `portrait: opponent.id`.
- `renderResult`'s defeated-opponent poster: `portrait: foe?.id ?? ''` (it already resolves the opponent via `foeOf` — reuse that; an unresolvable foe stays silhouette, never throws).

- [ ] **Step 3: Author the five portraits**

Common geometry: `viewBox="0 0 120 90"` (4:3 per §2.3), bust-crop (head + shoulders), transparent background, ink outlines at the locked pen width (scaled ×3 vs the chicken's viewBox), one shade layer per face (`#b98a3a` `fill-opacity=".25"` under jaw/helmet), one hatch group each. Skin `#d9c69a`, leather/straps `#6b5638`, metal `#93836d`.

Escalation (§5.4 "escalating menace") and character:
1. **player** — worried is the brief: raised inner eyebrows, small frown, oversized crested helmet (`#b5402f` plume) slipping slightly; body language "why am I here".
2. **brute** (tier 1) — the reference's horned-helmet heavy: wide jaw, tiny eyes, two chipped horns, one missing tooth. Menace: low but bulky.
3. **journeyman** (tier 2) — leaner, competent, scarred cheek, plain helm, flat unimpressed stare.
4. **veteran** (tier 3) — grizzled: eye patch OR heavy brow scar, gray-flecked beard (`#93836d` strands), dented helm, slight grin — he's done this.
5. **champion** (tier 4) — most imposing: fills the frame edge-to-edge, full-face helm with narrow eye slit (`#241a11` void), gold laurels (`#d9a441`) on the helm, no visible face at all. Menace by absence.

Per-file legibility check: render at ~180px wide (poster size) AND ~120px (hub) — expressions must survive both.

- [ ] **Step 4: The CSS rules**

In `src/styles/components.css`, after the `.poster__silhouette` rules — first READ the landed `.poster__portrait` rule and copy its exact recession background as the second layer below (the stops here are §6.5's recipe; the landed rule wins if they differ):

```css
/* §6.5 Phase 3 amendment: authored portraits layer over the well's own recession; the
   silhouette hides only where art exists. Unkeyed/unmatched wells keep the §10 fallback. */
.poster__portrait[data-portrait='player'] {
  background-image:
    url('../assets/art/portrait-player.svg'),
    radial-gradient(circle at 50% 42%, var(--paper-4), var(--paper-5));
  background-size:
    contain,
    100% 100%;
  background-position: center;
  background-repeat: no-repeat;
}
.poster__portrait[data-portrait='player'] .poster__silhouette {
  display: none;
}
```

…and the same pair for `brute`, `journeyman`, `veteran`, `champion`, each pointing at its own file. (Five explicit pairs, like the fifteen glyph rules — the assets test's sheet-url check covers every file; a typo'd key shows a silhouette, not a hole.)

- [ ] **Step 5: Run suite + visual verification (NOT skippable)**

Run: `npm test && npm run lint` — Expected: PASS (render.test's poster assertions match on class names and labels, which are untouched; if any pins the exact `poster__portrait` div spelling, update it to allow the attribute).
`npm run dev`: hub shows worried-you beside next foe; fight shows both plates; result recap shows the defeated foe under the red X; game-over cards still show silhouettes. Advance tiers (win fights or temporarily set `currentOpponentIndex`) to eyeball all four opponents. Squint test: five reads as one family, menace ascends 1→4.

- [ ] **Step 6: Commit**

```bash
git add src/assets/art/portrait-*.svg src/ui/components.js src/ui/render.js src/styles/components.css tests/render.test.js
git commit -m "feat(art): five hand-authored portraits with escalating menace"
```

---

### Task 6: Endings & death dressing (§5.5) + budget rebalance

**Files:**
- Create: `src/assets/art/champion-belt.svg` (≤8KB), `art/retired-rich.svg` (≤14KB), `art/death-vignette.svg` (≤12KB), `art/sandal-roman.svg` (≤8KB), `art/cactus.svg` (≤3KB)
- Delete: `src/assets/props/gold-pile.svg`, `props/cactus.svg`, `props/sandal-base.svg`
- Modify: `src/ui/render.js` (`renderGameOver` section tag ~line 411 + props container)
- Modify: `src/styles/screens.css` (`.prop--sandal` ~line 263, `.prop--cactus`, `.prop--vignette`, `.gameover__stamp` ~line 200)
- Modify: `src/styles/components.css` (retired rule swap + win-circuit rule)
- Modify: `CREDITS.md`, `tests/render.test.js`

- [ ] **Step 1: Write the failing tests**

In `tests/render.test.js`:

```js
it('stamps the achieved ending onto the section and shows the death vignette only for deaths', () => {
  const dead = gameoverHtml(); // the existing dead-state fixture
  expect(dead).toMatch(/<section class="screen screen--gameover" data-achieved="dead">/);
  expect(dead).toContain('prop--vignette');
});
```

Run: `npx vitest run tests/render.test.js -t achieved` — Expected: FAIL.

- [ ] **Step 2: Author the five pieces**

All at the locked pen width (scaled per viewBox), tokens only, one hatch group each:
- **champion-belt.svg** (`viewBox="0 0 120 90"`, matches the card wells): comically oversized wrestling belt — huge `#d9a441` plate with a `#b5402f` crown emblem, `#6b5638` strap drooping off both sides of the frame ("It doesn't fit").
- **retired-rich.svg** (`viewBox="0 0 120 90"`): the reference's right-hand tease — small gladiator (player's worried face, reuse the Task 5 head shapes at smaller scale) sitting atop a mound of `#d9a441`/`#b07f24` coins (draw ~15 coin ellipses + mound silhouette, NOT hundreds — the 147KB stock pile is the cautionary tale here).
- **death-vignette.svg** (`viewBox="0 0 320 140"`): the both-tripped tableau — two collapsed gladiators (player crest + horned helm, X eyes), ONE banana peel between them, a few `#b5402f` splats, 3–4 confetti flecks.
- **sandal-roman.svg** (`viewBox="0 0 72 58"`, matches the landed `.prop--sandal` box): caligae this time — flat `#6b5638` sole, 3–4 leather cross-straps with ink gaps, worn edge nicks.
- **cactus.svg** (`viewBox="0 0 46 62"`): one pot-less desert cactus, two arms, `#3f6b35` fill, `#2f2318` spines as short strokes — a dozen paths, not the stock file's thirty kilobytes.

- [ ] **Step 3: Renderer — achieved key + vignette prop**

In `src/ui/render.js` `renderGameOver()`:
1. The section tag (line ~411) becomes:

```js
    <section class="screen screen--gameover"${achieved ? ` data-achieved="${escapeHtml(achieved)}"` : ''}>
```

2. In the `.gameover__props` container (Phase 2), add as FIRST child:

```js
        <i class="prop prop--vignette"></i>
```

- [ ] **Step 4: The CSS swaps and additions**

`src/styles/screens.css`:
1. `.prop--sandal` (~line 263): change the `background-image` url to `'../assets/art/sandal-roman.svg'`.
2. `.prop--cactus`: change its url to `'../assets/art/cactus.svg'`.
3. `.gameover__stamp` (~line 200): add `position: relative;` and `z-index: 2;` (the verdict banner reads above the dressing).
4. With the other `.prop--*` rules, add:

```css
/* §6.14 Phase 3 amendment: the death tableau. Hidden unless the run actually died —
   a retirement gets confetti and socks, not corpses. */
.prop--vignette {
  display: none;
  top: 34%;
  left: 50%;
  width: 340px;
  height: 150px;
  transform: translateX(-50%);
  background-image: url('../assets/art/death-vignette.svg');
}
.screen--gameover[data-achieved='dead'] .prop--vignette {
  display: block;
}
@media (max-width: 640px) {
  .prop--vignette {
    width: 240px;
  }
}
```

`src/styles/components.css`:
1. The Phase 2 retired rule: change its first `background-image` layer from `url('../assets/props/gold-pile.svg')` to `url('../assets/art/retired-rich.svg')`.
2. Add the belt beside it:

```css
.ending-card[data-ending='win-circuit'] .poster__portrait {
  background-image:
    url('../assets/art/champion-belt.svg'),
    radial-gradient(circle at 50% 42%, var(--paper-4), var(--paper-5));
  background-size:
    82% auto,
    100% 100%;
  background-position:
    center 60%,
    center;
  background-repeat: no-repeat;
}
.ending-card[data-ending='win-circuit'] .poster__portrait .poster__silhouette {
  display: none;
}
```

(Mirror the gradient stops from the landed retired rule, as Phase 2 did.)

- [ ] **Step 5: Delete the superseded stock + prune CREDITS (same commit)**

```bash
git rm src/assets/props/gold-pile.svg src/assets/props/cactus.svg src/assets/props/sandal-base.svg
```

In `CREDITS.md`, remove the "Pile of Golden Coins", "Cactus", and "feet in sandals" lines (the files are gone; the manifest keeps their provenance and the Task 1 note records the replacement).

- [ ] **Step 6: Run suite + budget + visual verification (NOT skippable)**

Run: `npm test && npm run lint` — Expected: PASS, including the sheet-url test (which is what proves no sheet still points at a deleted prop) and the budget test with real headroom restored. Record the new payload total (`du`-independent: the test prints nothing, so run the find/stat one-liner from the phase report if numbers are wanted).
`npm run dev`: die → vignette between the socks, banner above it, cause line clear of props; retire (10,000G or the dev shortcut) → NO vignette, gold-pile-with-figure on the retired card; belt on the win-circuit card (locked "?" state keeps the art tease); Roman sandal and slim cactus in the lower corners; 375px pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(art): endings and death dressing — belt, retired figure, vignette, Roman sandal"
```

---

### Task 7 (OPTIONAL — explicitly cuttable, §5.6): the two gag glyphs

Skip this task entirely unless the phase is ahead of schedule; nothing depends on it.

**Files:**
- Create: `src/assets/art/leech.svg`, `src/assets/art/winged-boot.svg` (≤3KB each)
- Modify: `src/styles/components.css` (two mask rules), `tests/assets.test.js`

- [ ] **Step 1: Author the pair**

`viewBox="0 0 34 34"` each (well-sized), SINGLE solid `#2f2318` silhouette paths — these are mask sources like the game-icons files, so only the alpha matters; no fills, no hatch: a plump segmented leech with a sucker mouth; the landed Boots icon's silhouette redrawn with two small wings at the ankle.

- [ ] **Step 2: Swap the mask rules**

In components.css, the `heal` and `speed` glyph rules change their two `mask-image` urls to `'../assets/art/leech.svg'` / `'../assets/art/winged-boot.svg'` (keep `sticking-plaster.svg` and `boots.svg` on disk and in CREDITS — they remain the documented substitutes and the registry test counts committed icons, not used ones).

- [ ] **Step 3: Fix the counting test + verify**

`tests/assets.test.js`'s glyph suite counts `mask-image: url('../assets/icons/…')` — broaden the regex to `\.\.\/assets\/(?:icons|art)\/` so the two art-dir masks count, keep the `size).toBe(15)` assertion (15 painted names, unchanged). Run `npm test`, then dev-server: leeches on the heal button, winged boot on training speed, both legible at 24–34px. Commit:

```bash
git add src/assets/art/leech.svg src/assets/art/winged-boot.svg src/styles/components.css tests/assets.test.js
git commit -m "feat(art): optional gag glyphs — leech heal, winged boot speed"
```

---

### Task 8: Phase acceptance — the full pack, proven

- [ ] **Step 1: Suite + lint + build**

Run: `npm test && npm run lint && npm run build` — all clean; the build resolves every asset url including the chicken's JS import.

- [ ] **Step 2: Budget, stated with numbers**

```bash
find src/assets/icons src/assets/props src/assets/art src/assets/textures -type f -exec stat -f "%z" {} \; | awk '{s+=$1} END {print "TOTAL BYTES:", s, "of 307200"}'
```

Expected: under 307,200 with the rebalance landed. Record the number in the phase report.

- [ ] **Step 3: Zero-asset acceptance (§6) — the whole visual phase's exit exam**

Stub every asset (Phase 2's method), including the new art:

```bash
find src/assets/icons src/assets/props src/assets/art -name '*.svg' \
  -exec sh -c 'printf "<svg xmlns=\"http://www.w3.org/2000/svg\"/>" > "$1"' _ {} \;
printf '\x89PNG\r\n\x1a\n' > src/assets/textures/wood-planks.jpg
```

`npm run dev` → every screen complete: ink cursor sweeps alone (chicken gone, meter fully playable — §6.4's fallback), solid stone frame, stone-body backdrop, silhouette portraits, empty wells, bare ending cards, undressed death screen. Then:

```bash
git checkout -- src/assets
npm test
```

- [ ] **Step 4: Reference pass with screenshots**

Dev server at 1280/768/375px, all four screens, against the four reference images — this is the LAST phase: the gap analysis's six distances (stage+frame, plaques, iconography, character art, texture, fight composition) should all now read as closed, adapted into the design system's laws. Reduced-motion pass: sweep on, drop/stamps/flash instant. Attach screenshots to the phase report; note any deliberate divergence from the references (laws win — decision 1).

- [ ] **Step 5: Close the loop in the docs**

- If a PROGRESS tracker lists items 17/27 (freeze feedback assets), mark them fully resolved — the chicken landed.
- Update `README.md`'s feature/screenshot section if it shows pre-upgrade imagery.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore(ui): phase 3 acceptance — budget, zero-asset exam, reference pass"
```

---

## Phase exit criteria (spec §5 + §6)

- The full §10 asset list exists in one visual family: chicken, frame, backdrop, 5 portraits, belt, retired figure, vignette, Roman sandal (+ optional gags).
- Every fallback still works with the pack stubbed out — the zero-asset exam is the phase's exit exam, not a formality.
- Payload under 300KB WITH the rebalance (the 147KB pile is gone).
- Suite + lint + build green; per-task visual checks actually happened per task.
- Reference comparison documented — this closes the visual upgrade; anything still open is a new decision, not a leftover.
