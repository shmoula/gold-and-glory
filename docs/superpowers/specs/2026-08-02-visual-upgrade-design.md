# Gold & Glory — Visual Upgrade: Design

**Date:** 2026-08-02
**Status:** Approved design — input to the implementation plan
**Inputs:** `2026-08-01-visual-phase-decisions.md` (locked directions),
`2026-08-02-asset-sourcing-manifest.md` (spike results, pinned candidates),
`2026-07-23-gold-and-glory-design-system.md` (the system this extends).

## 1. Goal & scope

Close the six gaps between the shipped system and the reference art (illustrated arena stage +
stone-brick frame, per-screen title plaques, iconography everywhere, character/scene art,
hand-drawn surface texture, fight-screen composition) without breaking a single law of the
design system. Three phases, each independently shippable:

1. **Structure** — every layout/DOM change, zero new art, fallbacks proven first.
2. **Stock** — pinned free assets integrated, credits written, textures applied.
3. **Hand-authored art** — house-style SVGs land piece by piece into working wells.

**Non-goals:** no combat/economy logic changes; no copy changes beyond what new components
require (plaque text comes from existing screen state); no new screens; no sound.

## 2. Architecture

### 2.1 Asset pipeline

- Committed files: `src/assets/icons/` (16 stock game-icons SVGs, stored as-downloaded,
  pristine), `src/assets/art/` (hand-authored SVGs), `src/assets/textures/` (wood PNG).
- All assets imported through Vite — hashed URLs, loud build failures on missing files.
- `CREDITS.md` at repo root carries every CC-BY attribution line; it is written/updated in the
  same commit that adds the files it credits. Provenance URLs live in the sourcing manifest.
- Stock files are never edited in place. In-house modifications (sock distressing, confetti
  recolor) are saved as new files in `src/assets/art/`, crediting the base in `CREDITS.md`.

### 2.2 Icon component

One `.icon` element rendering via CSS `mask-image` + `background-color: currentColor`. The
monochrome game-icons SVGs become paintable glyphs: parchment-tone on wood surfaces, ink on
parchment, blood token where flagged — recoloring never touches an SVG file. Icons are
decorative (`aria-hidden="true"`) everywhere; labels, numerals, and pips carry meaning.
Missing asset ⇒ the well's recessed treatment shows (the shop card's slot was the precedent; Phase 1
generalized it into `.icon-well`, design-system §6.18, and the `.shop-item__icon` class this line
originally named no longer exists) — the §10 zero-asset rule needs no new machinery.

### 2.3 House style recipe (hand-authored SVG)

Every hand-authored asset follows one recipe so all pieces share DNA regardless of when they
are drawn:

- Colors from `tokens.css` only; transparent background.
- Uniform ink outline: `--border-ink`, one stroke width across the whole pack — the value is
  chosen when the chicken (first asset) is drawn, then locked for everything after.
- Flat fills, at most one shade layer per shape.
- One low-opacity crayon-scribble hatch group for texture.
- Fixed geometry per §10: chicken 40×48 feet-down side view (flipped via `scaleX(-1)`),
  portraits 4:3.

### 2.4 Doc-first amendments

Each new component enters the design system doc as a §6 catalog addition before its code is
written: title plaque, stage/frame layers, commit-arrow button variant, `.icon`, ending
illustration well. The §6.0 closed-class index grows accordingly.

## 3. Phase 1 — Structure (zero new art)

### 3.1 Fight-screen recomposition (decision 2)

Center column top-to-bottom: title plaque → timing meter → action row → combat log. Wanted
posters flank left (player) and right (opponent). PRESS THE ATTACK becomes a large commit-blue
arrow button pinned bottom-right. DOM source order stays reading-order-clean (meter, actions,
log, press); placement is pure `grid-area`. At the narrow breakpoint the arrow returns to flow.
The grid test extends to the new areas at 640/900px.

### 3.2 Title plaque (new §6 component)

Parchment plaque (M2) with tape, carrying the screen's `h1`, overlapping the HUD beam's bottom
edge via negative margin. One component, four screens: FIGHT / RESULT / GAME OVER /
CURRENT WINS: N. Text comes from existing screen state.

### 3.3 Stage layering (new §6 component, structural half)

Z-layer skeleton for the whole viewport: stone body (M1) → backdrop well → brick-frame border →
screen content. Phase 1 ships the well empty (stone shows through) and the frame as a plain
stone-tone border placeholder. New `--z-*` tokens added to `tokens.css`.

### 3.4 Iconography wells (decision 3 + gap 3)

- HUD injuries cell becomes icon-well + numeral + pips (all three together, per decision 3).
- Purse, health, durability each get an icon well beside their label.
- Sink buttons, shop cards (well exists), training rows, and ledger rows get wells where
  missing. All empty in Phase 1; recessed wells read as intentional.

### 3.5 Freeze feedback, behavioral half (§6.4)

Whatever is missing of the freeze behavior completes here: 250ms cursor hold at `p`, struck-zone
2-frame flash, `MISS!/GRAZE!/HIT!/CRIT!` stamp pop. The ink cursor performs the full
choreography; only the chicken drop waits for Phase 3.

## 4. Phase 2 — Stock integration

### 4.1 Files + credits land together

The 16 primary icons, openclipart props (confetti, gold pile, banana peel, cactus, sock and
sandal bases), and the wood texture are committed with `CREDITS.md` in the same commit.
Alternates stay in the manifest only.

### 4.2 Icons fill the wells

Every Phase 1 well gets its pinned glyph via `.icon`. Nothing about meaning or §8 semantics
changes — the glyphs are decoration on top of already-complete labels.

### 4.3 Texture pass (both kinds, once)

- Wood PNG layers over the HUD beam gradient; the gradient remains as the no-asset fallback.
- Timing-meter gold-ramp zones get the crayon-scribble treatment (decision 1) as a small inline
  SVG hatch pattern — generated texture, but it belongs in this single texture pass.
- Every textured surface is re-verified against §3's contrast table. Failing text gets a
  darkening overlay or the texture is dropped; the texture is swappable, the floor is not.

### 4.4 Props take their places

- Death screen: distressed socks hang as banners, confetti scatters, sandal base marks the
  death blow (stand-in until Phase 3 redraws it Roman).
- Endings gallery: gold pile fills the Retired Rich illustration well (reads complete alone;
  Phase 3 composites the character on top).
- Banana peel: Game Over scene dressing (the reference's "tripped on the _same_ banana peel"
  vignette) — unconditional, so no game-state detection is needed.

## 5. Phase 3 — Hand-authored art

Ordered by leverage; each piece is one commit into a working well; the game ships at any cut:

1. **Rubber chicken** — calibrates the recipe at 40×48; completes §6.4 (drop + `scaleY(0.7)`
   squash onto the track joins the freeze choreography).
2. **Stone-brick frame** — placeholder border becomes cartoon masonry: SVG nine-slice
   border-image, colored ink-outlined blocks. One asset, all four screens.
3. **Arena backdrop** — one wide muted SVG scene (arena wall, arch shadows, crowd as repeating
   silhouette band); parchment UI stays loudest.
4. **Five portraits** — player (worried, plumed) + Brute / Journeyman / Veteran / Champion with
   escalating menace, 4:3, silhouette fallbacks stay wired.
5. **Endings & death dressing** — ill-fitting championship belt; retired-rich figure composited
   over the gold pile; death vignette; Roman sandal replacing the Phase 2 stand-in.
6. **Optional gags, explicitly cuttable** — leech (heal sink), winged boot (speed). Pinned
   substitutes are already correct if these are never drawn.

Per-piece acceptance: rendered at target size in the real screen, both breakpoints, and with
the file removed (UI must still read complete).

## 6. Testing, accessibility, acceptance

- **§8 floor re-proven per phase:** contrast re-verification on changed surfaces,
  reduced-motion pass (chicken drop, stamps, confetti all respect
  `prefers-reduced-motion`), 640/900px passes.
- **Tests:** grid test learns plaque/stage/arrow areas at both breakpoints; unit tests for
  `.icon` fallback behavior and plaque-renders-correct-`h1`-per-screen; existing suite passes
  untouched.
- **Zero-asset acceptance:** whole-pack asset-removal check at the end — every screen reads
  complete with `src/assets/` emptied.
- **Visual proof:** each phase closes with dev-server screenshots at both breakpoints compared
  against the reference images.
- **Weight budget:** total added payload under 300KB, hard. Wood PNG is resized/compressed to
  rendered size; it is the first cut if the budget fails.

## 7. Pinned assets & licenses

Primary picks, alternates, URLs, and per-file license notes: see
`2026-08-02-asset-sourcing-manifest.md`. Summary of obligations:

- **CC BY 3.0 (credits file):** all 16 game-icons.net icons (Lorc, Delapouite, Skoll, sbed,
  Willdabeast); "Handpainted Wood" texture (PamNawi).
- **CC0/PD (no obligation):** all openclipart props.
- Hand-authored fallback confirmed by the spike for: 5 portraits, arena backdrop, brick frame,
  rubber chicken (final), championship belt, Roman sandal (final).
