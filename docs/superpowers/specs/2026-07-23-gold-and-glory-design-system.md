# Gold & Glory — Design System & Component Specification

**Date:** 2026-07-23
**Status:** Approved direction → code-ready spec
**Art direction:** "Taped to the Arena Wall" — hand-drawn cartoon slapstick (Asterix / Monty Python register), played completely deadpan.
**Consumers:** downstream developer agents implementing CSS/HTML/JS for the existing vanilla-JS + Vite build (`src/ui/render.js` renders HTML template strings; `src/ui/screens.js` mounts + delegates events).

---

## 0. The Laws (read before writing any code)

These override everything else in this document if a conflict is found.

1. **The interface is deadpan.** Content is absurd; behavior is serious. Numbers never lie,
   never animate in ways that obscure their value, and are never sacrificed to a joke.
   Snark is confined to the snark slot (§6.8) and never contradicts mechanics.
2. **Gold means money.** The gold hues are used exclusively for currency values, prices,
   the purse, and money-adjacent iconography. Never for decorative headings or generic emphasis.
3. **Red means loss, green means gain, blue means commitment.** Damage/costs/danger are blood-red;
   income/healing are moss-green; irreversible choices (Next Fight, Press the Attack, Retire Rich)
   are commit-blue banners. Every red/green money value also carries a `+`/`−` sign — color is
   never the only channel.
4. **Text only sits on paper or wood.** Never directly on stone or illustration
   (measured: bone-on-stone is 2.99:1 — an automatic contrast failure).
5. **Tokens only.** Component CSS may reference only `var(--*)` custom properties from §1.
   A literal hex color or px padding inside a component rule is a spec violation.
   The class catalog (§6.0) is closed: implement exactly these classes; do not invent new ones
   without adding them to this document first.
6. **All balance/tuning values live in `src/config.js`** (per GDD §8), including timing-meter
   geometry. CSS receives them as inline custom properties; it never hardcodes them.

---

## 1. Design Tokens — `src/styles/tokens.css`

Copy-paste verbatim. Tier 1 = primitives, Tier 2 = semantic, Tier 3 lives in component sections.

```css
:root {
  /* ============ TIER 1 — PRIMITIVES ============ */

  /* Paper (parchment) */
  --paper-1: #f6ecd1; /* highlight edge */
  --paper-2: #f3e7c8; /* base */
  --paper-3: #e6d6ae; /* shade */
  --paper-4: #d9c69a; /* deep / portrait wells */
  --paper-5: #c9b384; /* deepest — the portrait well's outer gradient stop (§6.5) */

  /* Wood (planks, HUD beam) */
  --wood-2: #6b4a2a;
  --wood-3: #5f4227;
  --wood-4: #46301b;

  /* Stone (page background only — never behind text) */
  --stone-2: #93836d;

  /* Ink & bone */
  --ink: #2f2318; /* borders, text on paper. 12.42:1 vs --paper-2 */
  --ink-soft: #6b5638; /* muted/snark text on paper — 5.67:1 vs --paper-2 */
  --bone: #f2e7cd; /* text on wood/dark — 10.06:1 vs --wood-4 */
  --bone-bright: #fdf6e4; /* text on commit blue — 4.76:1 vs --commit */
  --bone-dim: #cdb98e; /* snark aside on a wood button — 4.76:1 vs --wood-3, 6.43:1 vs --wood-4 */
  --track: #241a11; /* bar/meter track wells */

  /* Illustration fills — never text, never a ground for text (Law 4) */
  --silhouette: #443019; /* the figure in a portrait well (§6.5) */

  /* Gold — money only (Law 2) */
  --gold-hi: #f4cf7a;
  --gold: #d9a441; /* 5.50:1 vs --wood-4 on dark wood. NEVER as text on paper: 1.83:1 vs --paper-2 */
  --gold-deep: #b07f24; /* fills/borders only */
  --gold-mid: #b98a3a; /* the meter's GRAZE band — the ramp step between --gold-deep and
                            --gold (§6.4). Fills only, never text. */
  --gold-ink: #7d5714; /* money TEXT on paper — 5.26:1 vs --paper-2 */

  /* Blood — damage, costs, danger */
  --blood-hi: #c85541;
  --blood: #b5402f; /* large/bold text on paper: 4.57:1 vs --paper-2; button fill */
  --blood-ink: #9c3226; /* small text on paper — 5.89:1 vs --paper-2 */

  /* Moss — income, healing */
  --moss-ink: #3f6b35; /* text on paper — 5.07:1 vs --paper-2 */

  /* Commit blue — irreversible choices, focus */
  --commit-hi: #4d7fc0;
  --commit: #3e6fae;
  --commit-lo: #2d5487; /* 7.14:1 vs --bone-bright */

  /* Spacing — 4px base scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;

  /* Typography */
  --font-display: 'Bangers', 'Arial Black', sans-serif;
  --font-body: 'Nunito', system-ui, sans-serif;
  --font-snark: 'Patrick Hand', 'Comic Sans MS', cursive;
  --text-xs: 12.5px; /* captions, log snark */
  --text-sm: 14px; /* HUD labels, log */
  --text-md: 16px; /* body, buttons */
  --text-lg: 19px; /* prices, emphasized rows */
  --text-commit: 21px; /* the commit button's display face (§6.2) — a step of its own, between
                         --text-lg and --text-xl. Spec §6.2's block spelled it as a literal;
                         Law 5 allows a component only tokens, so the scale states it here. */
  --text-xl: 24px; /* section headings (display) */
  --text-2xl: 32px; /* poster names (display) */
  --text-3xl: 44px; /* screen banners: VICTORY! (display) */
  --text-4xl: 64px; /* YOU DIED (display) */
  --leading-display: 1.05;
  --leading-body: 1.5;

  /* Hand-drawn wobble radii — vary per component so nothing looks stamped */
  --wobble-1: 255px 18px 225px 18px / 18px 225px 18px 255px;
  --wobble-2: 18px 225px 18px 255px / 255px 18px 225px 18px;
  --wobble-3: 160px 22px 190px 24px / 22px 190px 24px 160px;
  --wobble-bar: 6px 9px 6px 8px; /* subtle, for meters/bars */

  /* Tilt — siblings must alternate tilt tokens (never two identical neighbors) */
  --tilt-1: -1.4deg;
  --tilt-2: 0.8deg;
  --tilt-3: -0.6deg;

  /* Borders & shadows — hard offsets, zero blur = paper-cutout look */
  --border-w: 2.5px;
  --frame-w: 14px; /* stone frame width; 8px ≤640px (overridden in base.css) */
  --shadow-paper: 4px 6px 0 rgba(31, 22, 12, 0.35);
  --shadow-plank: 0 3.5px 0 rgba(31, 22, 12, 0.5);
  --shadow-plank-pressed: 0 1px 0 rgba(31, 22, 12, 0.5);

  /* Gradients */
  --grad-paper: linear-gradient(178deg, var(--paper-1), var(--paper-3));
  --grad-wood: linear-gradient(var(--wood-3), var(--wood-4));
  --grad-wood-hover: linear-gradient(var(--wood-2), var(--wood-3));
  --grad-commit: linear-gradient(var(--commit-hi), var(--commit-lo));
  --grad-coin: radial-gradient(
    circle at 35% 30%,
    var(--gold-hi),
    var(--gold) 55%,
    var(--gold-deep)
  );

  /* Motion — paper-puppet: stepped, snappy, pivoted (see §5) */
  --dur-stamp: 240ms; /* stamps, chicken drop */
  --dur-tally: 350ms; /* per ledger line */
  --dur-chip: 900ms; /* delta chip lifetime */
  --dur-shake: 300ms; /* §6.7's 3-frame rejection shake */
  --ease-drop: steps(2, end);

  /* Z-scale (paper layering) — ascending, so the stack reads in paint order */
  --z-backdrop: -1; /* stage backdrop well — behind everything (§6.17) */
  --z-frame: 5; /* stone frame (§6.17). NOT "below the interactive layers": --z-hud has exactly
    one consumer in the whole sheet set (.commit-bar, ≤640px), so every other control is
    non-positioned in-flow content and paints *below* this. What keeps content clear of the frame
    is the body's padding: var(--frame-w), not this number — see §6.17's Phase 3 constraint */
  --z-hud: 10;
  --z-plaque: 11; /* title plaque (§6.16) — .hud is plain non-positioned flow, so the plaque
    only needs a stacking context of its own to paint over it; the negative top margin
    (components.css) is what makes the two actually overlap, not this number against --z-hud */
  --z-chip: 20;
  --z-modal: 30;

  /* ============ TIER 2 — SEMANTIC ============ */
  --color-text: var(--ink);
  --color-text-muted: var(--ink-soft);
  --color-text-inverse: var(--bone);
  --color-money: var(--gold-ink); /* money text on paper */
  --color-money-on-dark: var(--gold); /* money text on wood */
  --color-income: var(--moss-ink);
  --color-expense: var(--blood-ink);
  --color-focus: var(--commit-hi);
  --surface-page: var(--stone-2);
  --surface-paper: var(--paper-2);
  --surface-wood: var(--wood-4);
  --border-ink: var(--ink);
}
```

Additions: `--z-backdrop: -1`, `--z-frame: 5` and `--frame-w: 14px` (8px at ≤640px) from
visual-upgrade design §3.3 (stage layers); `--z-plaque: 11` from §3.2 (the title plaque) — a
different component, hence the separate citation. §6.16 and §6.17 are the catalog entries.

**No dark mode.** The game commits to one lit arena; there is no theme switch. (Deliberate, not an omission.)

---

## 2. Typography

| Role    | Face         | Weight    | Usage                                                            | Never                          |
| ------- | ------------ | --------- | ---------------------------------------------------------------- | ------------------------------ |
| Display | Bangers      | 400       | Banners, screen titles, commit CTAs, result stamps, poster names | Body copy, anything below 19px |
| Body    | Nunito       | 400 / 700 | All UI text, prices, stats, combat log, plank buttons            | —                              |
| Snark   | Patrick Hand | 400       | `.snark` slot only                                               | Mechanics, numbers, labels     |

Rules:

- All money and stat figures: `font-variant-numeric: tabular-nums;` (verified: Nunito digits are
  uniform-width — 480/480/480 for repeated 1/8/0 — so ledgers and tickers align for free).
- Display face gets `letter-spacing: 0.03em` at ≥32px sizes; body labels in uppercase get `0.06em`.
- Negative amounts use U+2212 minus (`−90 G`), thousands separator comma, unit ` G` with
  non-breaking space. Provide one `formatGold(n, {signed})` helper in JS; nothing formats money by hand.

**Font acquisition (implementation step):** self-host, do not link CDNs at runtime.
Download latin woff2 subsets (all OFL-licensed) via the Google Fonts css2 API for:
`Bangers` (400, ~16 KB), `Nunito:wght@400;700` (~76 KB), `Patrick Hand` (400, ~13 KB) —
~105 KB total. Place under `src/assets/fonts/` and declare:

```css
/* in tokens.css, above :root */
@font-face {
  font-family: 'Bangers';
  src: url('../assets/fonts/Bangers-400.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: 'Nunito';
  src: url('../assets/fonts/Nunito-400.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: 'Nunito';
  src: url('../assets/fonts/Nunito-700.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}
@font-face {
  font-family: 'Patrick Hand';
  src: url('../assets/fonts/PatrickHand-400.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
```

---

## 3. Color Usage & Verified Contrast

Every pair below was computed (WCAG 2.x relative luminance). Do not substitute values.

| Foreground on background         | Ratio   | Verdict / rule                                                   |
| -------------------------------- | ------- | ---------------------------------------------------------------- |
| `--ink` on `--paper-2`           | 12.42:1 | Body text on paper                                               |
| `--ink-soft` on `--paper-2`      | 5.67:1  | Muted + snark on paper                                           |
| `--gold-ink` on `--paper-2`      | 5.26:1  | **The only gold allowed as text on paper**                       |
| `--gold` on `--paper-2`          | 1.83:1  | FAIL — display gold is fills/dark-bg only                        |
| `--blood` on `--paper-2`         | 4.57:1  | Large/bold damage text on paper                                  |
| `--blood-ink` on `--paper-2`     | 5.89:1  | Small expense text on paper                                      |
| `--moss-ink` on `--paper-2`      | 5.07:1  | Income/heal text on paper (an earlier flat green failed at 4.02) |
| `--bone` on `--wood-4`           | 10.06:1 | Button/HUD text on wood                                          |
| `--gold` on `--wood-4`           | 5.50:1  | HUD purse                                                        |
| `--bone-dim` on `--wood-3`       | 4.76:1  | Snark aside on a wood button (§6.8)                              |
| `--bone-dim` on `--wood-4`       | 6.43:1  | Same aside, against the plank's dark stop                        |
| `--bone-bright` on `--commit`    | 4.76:1  | Commit banner text (display size)                                |
| `--bone-bright` on `--commit-lo` | 7.14:1  | Commit banner text, small                                        |
| `--ink` on `--gold`              | 6.79:1  | Gold badges/coins                                                |
| `--bone` on `--track`            | 13.88:1 | Numbers inside bars                                              |
| `--bone` on `--stone-2`          | 2.99:1  | FAIL — this is why Law 4 exists                                  |

Colorblind redundancy (mandatory): money deltas always carry `+`/`−`; damage log lines carry the
sword glyph, healing the drop glyph; meter zones are labeled and notched (§6.4); owned vs
unaffordable shop states differ by _structure_, not hue (§6.12).

---

## 4. Materials (the five treatments — nothing else)

**M1 — Stone page.** `body` background: flat `--surface-page` + radial vignette
(`radial-gradient(140% 120% at 50% 100%, rgba(31,22,12,.38), transparent 60%)`). An optional
illustrated arena backdrop image may sit behind screens, but must be covered by a
`rgba(47,35,24,0.5)` scrim wherever panels are absent. No text on this layer, ever.

**M2 — Parchment panel.** `--grad-paper` fill, `var(--border-w) solid var(--border-ink)`,
one `--wobble-*` radius, `--shadow-paper`, one `--tilt-*`. Used for: posters, ledger, log,
sponsor notice, shop cards, endings, modals. The invariant trio (paper fill, ink border, paper
shadow) is carried by the shared .parchment class; each card states only its own wobble/tilt/
padding (decided 2026-08-01, item 31).

**M3 — Wood plank.** `--grad-wood` fill, ink border, small wobble radius (`10px 14px 9px 15px`
family), `--shadow-plank`. Used for: HUD beam, ordinary buttons.

**M4 — Tape.** Pseudo-elements on `.tape`: two 64×20px strips, `rgba(235,224,192,0.9)`,
1px `rgba(31,22,12,0.25)` border, top corners, rotations −5°/+4°.

**M5 — Ink.** Everything is outlined: `--border-w` ink borders, dashed ink dividers
(`1.5px dashed rgba(47,35,24,0.25)`), hard offset shadows. No blur anywhere except meter glow.

---

## 5. Motion — "paper puppet"

Everything moves like a Gilliam cutout: few frames, hard stops, pivot from an edge.

- **Timing functions:** `--ease-drop` (2 frames) is the only named easing token; the purse-shake
  reuses a 3-frame step function directly (`steps(3, end)`, §6.7) rather than through a token.
  Smooth easing is reserved for exactly two things: the meter sweep (linear, it's gameplay) and
  bar width transitions (150ms ease-out, they're data).
- **Transforms only** (`translate`, `rotate`, `scale`); never animate layout properties.
- **Pivots:** cards animate with `transform-origin` at a taped corner; stamps scale from center.
- **Budget:** UI state change is instant — no transition property, a hard cut, per the
  cutout look above; theatrical beats (stamp, chicken drop) ≤ `--dur-stamp`; nothing except
  the ledger sequence exceeds 400ms total.
- **`prefers-reduced-motion: reduce`:** all `steps()` animations become instant state changes;
  delta chips appear/disappear without travel; ledger lines appear pre-tallied with a single
  fade; the meter sweep remains (it is the game mechanic), but screen shake and chicken
  flourish are removed.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important; /* an infinite pulse at 1ms is a strobe */
    transition-duration: 1ms !important;
  }
  .meter-cursor {
    transition: none !important;
  } /* sweep stays JS-driven */
  /* Shortening is not the same as cancelling. `chip-fall` ends at `opacity: 0` and runs
     `forwards`, so at 1ms it applies its final keyframe immediately and keeps it — the chip is
     hidden a millisecond after it is spawned, and "appears/disappears without travel" above
     becomes "never appears". Any `forwards` animation whose last keyframe hides the element has
     to be cancelled outright here; the JS timer still removes the node. */
  .delta-chip {
    animation: none !important;
  }
}
```

---

## 6. Component Catalog

### 6.0 Closed class index

`hud, hud__purse, hud__stat, hud__label, coin, bar, bar__fill, bar__fill--dur, bar__num,
pips, pip, pip--filled, btn, btn--commit, btn--danger, btn__price, btn__snark,
is-unaffordable, is-owned, is-urgent, meter, meter__zone, meter__zone--graze, meter__zone--hit,
meter__zone--crit, meter__labels, meter__taunt, meter-cursor, meter-chicken, meter__stamp,
poster, poster__name, poster__portrait, poster__sub, poster__silhouette, poster--tilt-1,
poster--tilt-2, poster--tilt-3, tape, parchment, snark, ledger, ledger__banner, ledger__row,
ledger__row--net, ledger__row--balance, amount, amount--pos, amount--neg, delta-chip,
delta-chip--pos, delta-chip--neg, ticker, log, log__entry, log__turn, sponsor-card,
sponsor-card__eyebrow, sponsor-card__name, train-row, train-row__meter, train-row__label,
shop-item, shop-item__name, shop-item__owned, banner-stamp,
banner-stamp--victory, banner-stamp--defeat, banner-stamp--death, ending-card,
ending-card--locked, cause-of-death, modal, modal__scrim, wordmark, sr-only, is-hidden,
is-captured, is-shaking, screen, screen--hub, screen--fight, screen--result,
screen--gameover, commit-bar, hub__sinks, hub__develop, hub__fight, hub__retire,
hub__commit, hub__next-label, fight__you, fight__stage, fight__foe, fight__log,
fight__actions, result__recap, result__ledger, result__cta, result__cross, result__flavor,
gameover__left, gameover__stamp, gameover__right, gameover__cause, gameover__cta,
title-plaque, stage-backdrop, stage-frame, icon-well, icon-well--sm, hud__count,
btn--arrow, fight__press, is-flashing`

`modal` and `modal__scrim` (§6.15) are specified, not yet rendered — no screen mounts a modal
today, but the spec still calls for one (death-match clause confirm).

**Amendment (visual-upgrade Phase 1 follow-up):** `shop-item__icon` is struck from the index. It
was kept "for §6.12's layout selectors" that were never written — zero rules in `src/styles/`
matched it, so the shop well's whole treatment already came from `.icon-well` — while `shopItem()`
hand-rolled a second copy of the well's markup behind it. §6.12's icon column is now an
`.icon-well` (§6.18) and nothing else: `shopItem()` calls `iconWell(item.id)` like every other
welled surface, so no one surface can quietly diverge from the rest.

### 6.1 HUD beam (persistent, all screens)

Wood plank strip pinned top, `grid-area: hud`, `z-index: var(--z-hud)`.
Contents in order: purse, Health bar, Durability bar, Injuries pips.

```html
<header class="hud">
  <span class="hud__purse"
    ><i class="coin"></i>GOLD: <span class="ticker" data-value="2450">2,450</span></span
  >
  <span class="hud__stat"
    ><span class="hud__label">HEALTH</span>
    <span
      class="bar"
      role="meter"
      aria-label="Health"
      aria-valuenow="65"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <span class="bar__fill" style="width:65%"></span><span class="bar__num">65/100</span>
    </span></span
  >
  <span class="hud__stat"
    ><span class="hud__label">DURABILITY</span>
    <span class="bar"
      ><span class="bar__fill bar__fill--dur" style="width:58%"></span
      ><span class="bar__num">58/100</span></span
    ></span
  >
  <span class="hud__stat"
    ><span class="hud__label">INJURIES</span>
    <span class="pips" role="img" aria-label="3 injuries">
      <i class="pip pip--filled"></i><i class="pip pip--filled"></i><i class="pip pip--filled"></i
      ><i class="pip"></i><i class="pip"></i> </span
  ></span>
</header>
```

```css
.hud {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-wrap: wrap;
  background: linear-gradient(var(--wood-3), var(--wood-4));
  border: var(--border-w) solid var(--border-ink);
  border-radius: 10px 14px 9px 15px;
  padding: var(--space-2) var(--space-4);
  box-shadow: var(--shadow-plank);
  color: var(--color-text-inverse);
  font-family: var(--font-body);
  font-weight: 700;
  font-size: var(--text-sm);
}
/* `position: relative` is §6.7's delta-chip anchor: the chip is spawned into the purse and
   positioned against it. `text-transform` is why the markup above may spell the label in
   sentence case. */
.hud__purse {
  color: var(--color-money-on-dark);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-variant-numeric: tabular-nums;
  text-transform: uppercase;
  position: relative;
}
.coin {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  display: inline-block;
  background: var(--grad-coin);
  border: 1.5px solid var(--border-ink);
}
/* `display: block` is load-bearing: the track is a <span> whose two children are both
   absolutely positioned, so it carries no in-flow content and its whole size comes from
   `width`/`height` — neither of which applies to a non-replaced inline box (CSS2 §10.2). It
   only ever looked right inside `.hud__stat` (inline-flex) and the training row (grid), both
   of which blockify their items; a poster is plain block flow, and every poster HP plate
   collapsed to ~5px without this. */
.bar {
  display: block;
  position: relative;
  width: 108px;
  height: 16px;
  background: var(--track);
  border: 2px solid var(--border-ink);
  border-radius: var(--wobble-bar);
  overflow: hidden;
}
.bar__fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--blood);
  transition: width 150ms ease-out;
}
.bar__fill--dur {
  background: var(--gold-deep);
}
/* The numeral is `--text-xs`, not 11px: §8's floor ("all text >= --text-xs") is ship-blocking
   and wins over an earlier draft of this block. It still fits — the narrowest numbered track is
   this bar's own 104px padding box, and the widest string a bar renders ("170/170") is 48.2px
   of Nunito tabular digits at 12.5px. */
.bar__num {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: var(--text-xs);
  color: var(--bone);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 0 rgba(31, 22, 12, 0.9);
}
.pips {
  display: inline-flex;
  gap: 3px;
}
.pip {
  width: 11px;
  height: 14px;
  border: 1.5px solid var(--border-ink);
  border-radius: 50% 50% 50% 50% / 62% 62% 38% 38%;
  background: var(--track);
}
.pip--filled {
  background: var(--blood);
}
```

Rules:

- Health fill is `--blood` at all values; below 33% add `.is-urgent` on the `.bar` → 900ms
  opacity pulse on the fill (steps(2)).
- Pips render `max(injuries, 5)` slots; each filled pip = one 40 G debt (GDD heal cost).
- On GAMEOVER the HUD persists showing the fatal state (0/100) — deliberate storytelling.
- Purse ticker + delta chips: §6.7.

**Amendment (visual-upgrade design §3.4, decision 3):** each stat gains a leading
`.icon-well .icon-well--sm` (`data-icon`: `health`, `durability`, `injuries`; the purse keeps
its existing `.coin`). The injuries cell shows icon + numeral + pips together: a `.hud__count`
numeral (body 700, `--bone`) sits between label and pips. The `role="img"` +
"N injuries" `aria-label` moves to a wrapper spanning numeral + pips; both children are
`aria-hidden` so the count is announced exactly once.

### 6.2 Buttons

Three variants. All: `min-height 44px`, `font-family var(--font-body) 700` (plank/danger) or
`var(--font-display)` (commit), `cursor: pointer`, and:

```css
.btn {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-3);
  font: 700 var(--text-md)/1.2 var(--font-body);
  color: var(--color-text-inverse);
  background: var(--grad-wood);
  border: var(--border-w) solid var(--border-ink);
  border-radius: 9px 13px 8px 14px;
  padding: var(--space-3) var(--space-4);
  box-shadow: var(--shadow-plank);
  min-height: 44px;
}
.btn:hover {
  background: var(--grad-wood-hover);
}
.btn:active {
  transform: translateY(2.5px);
  box-shadow: var(--shadow-plank-pressed);
}
.btn:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 3px;
}
.btn__price {
  color: var(--color-money-on-dark);
  font-variant-numeric: tabular-nums;
  font-size: var(--text-lg);
}
.btn__snark {
  font-family: var(--font-snark);
  font-weight: 400;
  font-size: var(--text-sm);
  color: var(--bone-dim);
}

.btn--commit {
  font: 400 var(--text-commit)/1 var(--font-display);
  letter-spacing: 0.05em;
  color: var(--bone-bright);
  background: var(--grad-commit);
  border-radius: var(--wobble-1);
  padding: var(--space-2) var(--space-5);
  text-shadow: 0 1.5px 0 rgba(20, 30, 50, 0.55);
}
.btn--commit:focus-visible {
  outline-color: var(--bone-bright);
}

.btn--danger {
  background: linear-gradient(var(--blood-hi), var(--blood));
}

.btn[aria-disabled='true'] {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}
/* `.is-unaffordable` stays full-strength EXCEPT the price — which is prose, not a rule: an
   empty rule declares nothing. The `.shop-item` comma-mates are §6.12 asking for the same
   treatment on the gear card, which is not a `.btn` and which the selector above never reached. */
.btn.is-unaffordable .btn__price,
.shop-item.is-unaffordable .btn__price {
  color: var(--blood-hi);
}
.btn.is-unaffordable .btn__snark::after,
.shop-item.is-unaffordable .btn__snark::after {
  content: ' (need ' attr(data-missing) ' more)';
}
.btn.is-urgent {
  animation: urgent-pulse 1.2s var(--ease-drop) infinite;
}
@keyframes urgent-pulse {
  50% {
    box-shadow:
      var(--shadow-plank),
      0 0 0 3px var(--gold-deep);
  }
}
```

Anatomy rule: every commerce button is `[label] [price slot] [snark slot?]` — the price is
first-class, right of the label, never in parentheses.

Semantics:

- `.btn--commit` (blue banner + display face) **only** for irreversible commitments:
  Next Fight, Press the Attack, Retire Rich, Fight Again, Return to Ludus.
- `.is-unaffordable`: button remains enabled-looking but click is rejected with a purse-shake
  (§6.7) — the game _tells_ you you're broke rather than hiding the option. `data-missing`
  carries the formatted shortfall, on the control **and** on its `.btn__snark` span, because
  `attr()` resolves against the pseudo-element's own originating element. The snark slot is
  optional copy but not an optional _slot_: a priced control with no aside (the Train buttons)
  still emits an empty one, or the shortfall it carries has nowhere to render.
- A true no-op — nothing to repair, nobody to heal — is not "unaffordable": it emits the native
  `disabled` attribute, which the rule above deliberately does not match. `button:disabled` in
  base.css dims it to the same 0.45, and only that one number dims a dead button.
- `.is-urgent` (state-driven glow): applied by JS when durability < 50% (Repair) or
  injuries ≥ 1 (Heal).
- Keyboard: hub actions get `accesskey`-free numeric hints; fight actions bind 1–4, Space = strike
  (see §6.4), Enter activates focused control.

**Amendment (visual-upgrade design §3.1):** `.btn--arrow`, a modifier stacked on
`.btn--commit` for the fight screen's PRESS THE ATTACK: the commit banner's display face at
`--text-commit`, `letter-spacing: 0.04em`, plus a triangular right end. The end is an
absolutely-positioned `::after` seated in an equal `margin-right`, painted with `--grad-commit`
and pointed by `clip-path`; its
`inset-block` is negative `--border-w`, so the triangle is exactly as tall as the button's
border box **at any height** — the button grows when its label wraps and the arrow grows with
it. Selector is `.btn--commit.btn--arrow`, both rules, so the sheet enforces the modifier's
own rule: an arrow is always a commit banner, never a blue end on some other plank.

The `letter-spacing` is a deliberate override of `.btn--commit`'s `0.05em`, not a stray value:
this is the one commit banner whose label runs up against a hard diagonal rather than ending in
the plank's own padding, and the extra 0.01em of trailing space read as a gap between the last
letter and the point. One step tighter, on the arrow only.

Two things this technique is deliberately careful about. **`left: 100%` resolves against the
padding box**, so the offset is `calc(100% + var(--border-w))` — without the step out, the
triangle starts inside the button and paints over its right ink border. And **the `clip-path`
is on the pseudo-element, never on `.btn--arrow` itself**: an outline is painted outside the
border box of the element it belongs to, so clipping the _button_ would cut off §8's focus
ring, while clipping a child pseudo-element cannot reach it. (An earlier draft of this
amendment prescribed a `::after` border-triangle to avoid `clip-path` altogether; that
conflated the two, and a border-triangle's half-heights are two literals that silently stop
matching the moment the button is not 44px tall.)

**Deferred to Phase 2/3: the arrow has no ink outline.** Every other cartoon edge in this
system carries one, and this end does not — a clipped box cannot take a border along the
diagonal, and Phase 1 ships zero new art. It wants either an SVG/`border-image` end or a
second, larger clipped pseudo-element in `--border-ink` behind the first; both are asset- or
paint-layer work, not structure.

Buttons may also carry a leading `.icon-well` (sinks) emitted by `btn({ icon })`.

### 6.3 Stat bars & training meters

`.bar` (§6.1) is reused at width 180px in training rows (`.train-row__meter`). Label format is
unified everywhere: `Power 24/50`, button label `Train +5`, price in the price slot. One format,
three rows (Power / Guard / Speed).

### 6.4 Timing meter (the core verb)

**Geometry — adopt the schema that already exists in `src/config.js` and is consumed by
`combat.js` (`timingWindowWidth`, `resolveTiming`) and its tests. Do not invent a parallel one:**

```js
// existing keys (tuning values may change; shape must not)
baseTimingWidth: 0.18,   // half-width of the HIT window, fraction of the bar
speedTimingBonus: 0.01,  // added to width per point of effective Speed
timingTierRatios: { crit: 0.3, hit: 1.0, graze: 1.6 }, // window sizes as multiples of width
timingMult: { miss: 0, graze: 0.5, hit: 1.0, crit: 2.0 },
// ADD for this spec:
meterPeriodMs: { base: 1400, perTier: -60, min: 900 }, // one-way sweep duration
sweetCenter: { min: 0.35, max: 0.75 },                 // seeded per player turn
```

With `W = baseTimingWidth + speedTimingBonus × effectiveSpeed`, per-turn center `c`, and the
player's `critWindowMult` (1 by default, raised by the Lucky Charm), zones are nested windows
(matching `resolveTiming`):

```
|p − c| ≤ W × ratios.crit × critWindowMult  → CRIT
|p − c| ≤ W × ratios.hit                    → HIT
|p − c| ≤ W × ratios.graze                  → GRAZE
otherwise                                   → MISS
```

Speed widens every window (readable risk: training Speed visibly widens the bright zones).

**`critWindowMult` is part of the geometry, not a resolution-time bonus.** `resolveTiming` is
the authority on what a click pays, and the drawn crit band must be the same number: with the
Charm equipped and the multiplier left out of the drawing, 6.9% of the track paid crit while
painted as plain HIT, and a 150 G purchase changed not one pixel of the meter. The guard test
derives the band from the rendered geometry and the tier by bisecting `resolveTiming`, so
"drawn == resolved" is checked rather than restated.

**Math for the cursor (implement exactly):** track is normalized `[0,1]`. Position derives
from timestamps — never from per-frame increments and never read back from the DOM:

```
phase = ((now - t0) / T) % 2
p     = phase < 1 ? phase : 2 - phase          // triangle wave, ping-pong
```

⚠ The current `src/main.js` loop does `pos += dir × speed` per rAF frame, which makes the
sweep frame-rate dependent (twice as fast on a 120 Hz display). Replacing it with the
timestamp formula above is a **required** fix, not a refactor preference.

**Rendering contract:** JS computes zone edges per turn and sets inline custom properties on
`.meter` (`--graze-start`, `--graze-size`, `--hit-start`, `--hit-size`, `--crit-start`,
`--crit-size`, as percentages). Zones are absolutely-positioned `.meter__zone` divs. The cursor
is one element moved via `transform: translateX()` in a `requestAnimationFrame` loop.

```html
<div class="meter" role="button" aria-label="Timing meter — press Space or click to strike">
  <div
    class="meter__zone meter__zone--graze"
    style="left:var(--graze-start);width:var(--graze-size)"
  ></div>
  <div
    class="meter__zone meter__zone--hit"
    style="left:var(--hit-start);width:var(--hit-size)"
  ></div>
  <div
    class="meter__zone meter__zone--crit"
    style="left:var(--crit-start);width:var(--crit-size)"
  ></div>
  <div class="meter-cursor"><img class="meter-chicken" src="…/chicken.svg" alt="" /></div>
</div>
<div class="meter__labels"><!-- MISS · GRAZE · HIT · CRIT ticks, aligned to zone edges --></div>
```

`role="button", not "application"`: announced usefully, free activation semantics, and browse
mode stays available — "application" suppressed it for a control whose only children are
presentational (decided 2026-08-01, item 16). The div still needs its tabindex.

```css
.meter {
  position: relative;
  height: 48px;
  background: var(--track);
  border: var(--border-w) solid var(--border-ink);
  border-radius: var(--wobble-bar);
  cursor: crosshair;
}
.meter__zone {
  position: absolute;
  top: 0;
  bottom: 0;
}
.meter__zone--graze {
  background: #b98a3a;
}
.meter__zone--hit {
  background: var(--gold);
}
.meter__zone--crit {
  background: var(--gold-hi);
  border-inline: 2px solid var(--border-ink); /* notches: not color-only */
  box-shadow: 0 0 12px rgba(244, 207, 122, 0.8);
} /* the one permitted glow */
.meter-cursor {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--ink);
  will-change: transform;
}
.meter-chicken {
  position: absolute;
  bottom: 100%;
  left: 50%;
  width: 40px;
  height: 48px;
  transform: translateX(-50%);
}
```

Zone color logic: a monochromatic gold ramp — _the brighter, the closer to glory_ — plus ink
notches on the crit window and text labels/ticks below the track, so the hierarchy survives
grayscale and every CVD type.

**Interaction (implement exactly):**

1. Click anywhere on `.meter` or press **Space** → capture `performance.now()`, compute `p`,
   resolve zone.
2. **Freeze:** cancel the rAF loop; cursor stays at `p` for 250ms. The chicken drops
   (`--ease-drop`, squash `scaleY(0.7)`) onto the track.
3. Flash the struck zone (2-frame opacity blink) and pop a `.meter__stamp` label at `p`:
   `MISS! / GRAZE! / HIT! / CRIT!` in `--font-display`, stamp-scale animation (§5).
4. Resolve combat, write log entry, resume sweep next player turn.
   The freeze is not decoration: it is how players calibrate their timing. Never skip it.

Chicken asset: `chicken.svg` (or transparent PNG), 40×48, feet-down, facing travel direction via
`scaleX(-1)` flip. Fallback if asset missing: the ink cursor line alone is fully functional.
First-fight-only helper line "Time your hit! (Or don't!)" above the meter; it never appears again
after one completed fight (tutorial decay).

**Amendment (visual-upgrade Phase 1, Task 8):** tutorial decay starts one beat earlier — the
taunt goes **hidden on capture**, not merely on the next fight. The hint tells the player to time
their hit, and it is spent the moment they do. It also has to go: the taunt occupies the line
directly above the track, which is exactly where step 3's `.meter__stamp` pops, so a capture
anywhere near centre printed the verdict through the hint's glyphs. Hidden with `visibility`, so
the line keeps its box and nothing below it shifts when the stamp arrives. CSS-only, state-scoped
(`.fight__stage:has(.meter.is-captured)`) — no new class, and the markup is unchanged.

### 6.5 Wanted poster (combatant card)

Parchment M2 + tape M4, `--tilt-1` (player) / `--tilt-2` (opponent) — neighbors never share tilt.
Anatomy top-to-bottom: `.poster__name` (display, 27px, centered), `.poster__portrait`
(fixed 4:3 well, `--paper-4` ground, `<img>` content asset with silhouette fallback),
`.poster__sub` (tier · fight purse with `--gold-ink` amount), `.snark` line.
HP plate for fight screen: one `.bar` (width 100%) mounted _below_ the portrait — exactly one
per poster. Player poster and HUD may both show HP; they must read from the same state field.

### 6.6 The Ledger (result breakdown)

Parchment M2, `--tilt-2`. This card is co-primary with the result banner — it IS the product.

```html
<section class="ledger tape" aria-live="polite">
  <p class="ledger__banner">VICTORY!</p>
  <p class="snark">He tripped on a banana peel. Victory by default!</p>
  <dl>
    <div class="ledger__row">
      <dt>Purse</dt>
      <dd class="amount amount--pos">+600 G</dd>
    </div>
    <div class="ledger__row">
      <dt>Arena tax <span class="snark">(Ouch!)</span></dt>
      <dd class="amount amount--neg">−90 G</dd>
    </div>
    <div class="ledger__row">
      <dt>Sponsor bonus <span class="snark">(He loves losers)</span></dt>
      <dd class="amount amount--pos">+150 G</dd>
    </div>
    <div class="ledger__row ledger__row--net">
      <dt>Net gold</dt>
      <dd class="amount amount--pos">+660 G</dd>
    </div>
    <div class="ledger__row ledger__row--balance">
      <dt>New balance</dt>
      <dd class="amount">3,110 G</dd>
    </div>
  </dl>
</section>
```

```css
.ledger__banner {
  font: 400 var(--text-3xl)/1 var(--font-display);
  color: var(--blood);
  margin: 0;
}
.ledger__row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-4);
  padding: var(--space-1) 0;
  border-bottom: 1.5px dashed rgba(47, 35, 24, 0.25);
}
.ledger__row--net {
  border-top: var(--border-w) solid var(--border-ink);
  margin-top: var(--space-2);
}
.amount {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.amount--pos {
  color: var(--color-income);
}
.amount--neg {
  color: var(--color-expense);
}
.ledger__row--balance .amount {
  color: var(--color-money);
  font-size: var(--text-lg);
}
```

**Ledger theater (sequence, exact):** rows start `visibility: hidden`; reveal one per
`--dur-tally` beat, top to bottom. Money rows count from 0 to value over the beat
(tabular digits prevent wobble). The tax row lands with a stamp animation on its amount
(scale 1.4→1.0, `--ease-drop`) — the player must _feel_ the cut, every fight. Banner and
snark line appear first with the stamp treatment. Total sequence ≤ 2.5s; a click anywhere
skips to the final state (never trap the player in theater). Reduced motion: single fade,
pre-tallied.

Rules: zero-value lines render muted ink, never red ("Injuries gained: 0" is good news).
The result CTA is `.btn--commit` with the resulting balance in its price slot:
`Return to Ludus · 3,110 G`. Defeat-without-death uses the same ledger with
`banner-stamp--defeat` ("DEFEAT." — deadpan period, no exclamation) and expense-heavy rows.
A small `.wordmark` ("GOLD & GLORY") sits in the card's bottom corner — every screenshot
carries the brand.

**Amendment (visual-upgrade Phase 1, Task 5):** the money rows gain §6.18 icon wells, which
changes the `dt`'s structure — the HTML above now reads
`<dt><span class="icon-well icon-well--sm" aria-hidden="true" data-icon="purse"></span>Purse</dt>`
on the welled rows. Four rules follow from that:

- **`.ledger__row dt` is a flex container** (`display: flex; align-items: baseline`), so the well
  sits _beside_ the label instead of stacking above it — a `dt` is otherwise a plain block.
- **Only the three _source_ money rows carry a well** — Purse (`data-icon="purse"`), Arena tax
  (`tax`), Sponsor (`sponsor`). The sums and tallies (Net gold, Injuries gained, Weapon wear, New
  balance) stay bare, deliberately: they are totals, not sources, so the well marks where money
  comes from rather than decorating every line.
- **The well takes `align-self: center`**, plus its own `margin-right: var(--space-2)` for
  spacing. It has to opt out of the row's baseline alignment because an empty box has no real
  baseline: left on `baseline` (or with the `dt` re-centering its children), the flex `dt`
  exported a _synthesized_ one, which desynced each welled row's label from its own `dd` amount
  and from every well-less row on the same card — measured ~6.5px out of line, now clustered
  within ~1.15px. `margin-right` rather than `gap`, so the spacing does not also open up between
  the label and the trailing `.snark`.
- **The `.snark` aside is separated by `margin-left: var(--space-1)`**, not by the template's
  literal space. Flexing the `dt` turns the bare label into an anonymous flex item, and a flex
  item's leading/trailing whitespace is trimmed — which silently ate that space and rendered
  "Arena tax(Ouch)". Scoped to `.ledger__row dt`, the only context where the trimming happens.

**The tax row is labelled `Arena tax`, with no rate.** The HTML above spelled it `Tax (15%)`; the
shipped copy drops the parenthetical deliberately, and the fence has been corrected to match. Three
reasons, in order of weight:

- `arenaTax()` is `Math.round(purse * rate)`, so the printed amount is **rounded** — a rate beside
  it would claim a precision the row does not carry. A 601 G purse at the shipped 20% shows −120 G,
  and 20% of 601 is 120.2. Law 1: numbers never lie.
- The rate is **not one number**. `config.arena` carries `taxRate` and `bribedTaxRate`, and §6.2's
  Bribe button swaps between them mid-run; a rate baked into the label would have to be kept in
  step with the state that chose it, by hand, on the one card that exists to be trusted.
- `15%` was never the shipped rate anyway (`config.arena.taxRate` is `0.2`) — a rate in this
  document is a second source for a balance value Law 6 puts in `config.js` alone. The Bribe
  button states the rates, from config; the ledger row states what was taken.

### 6.7 DeltaChip & Ticker (money always moves)

- **`.ticker`** — the purse number. On change, count toward the new value over ≤ 600ms
  (steps of whole gold; tabular digits). Never blocks input.
- **`.delta-chip`** — spawned absolutely near the purse on every gold change:
  `+600 G` (`--gold` on wood) or `−90 G` (`--blood-hi`). Rises/falls 14px and fades over
  `--dur-chip` with `steps(4)`. Consolidate same-sign changes within 300ms into one chip.
  Max 2 visible; older chips are removed early. `z-index: var(--z-chip)`.
- **Purse shake** — rejected purchase (unaffordable): HUD purse does a 3-frame ±3px
  horizontal shake and the shortfall chip `−need 150 more` appears. No modal, no beep.

### 6.8 Snark slot (`.snark`)

`font-family: var(--font-snark); font-size: var(--text-sm)` (never below `--text-xs`);
color `--ink-soft` on paper, `--bone-dim` on wood. Grammar: **`[mechanical truth] (aside)`** —
the aside is optional, ≤ 40 characters, always parenthesized, and never contradicts or
obscures the mechanics it accompanies. Asides may mock the player, the opponent, or the
economy; they never lie about numbers. All snark strings live in `config.js` string tables
(they are content, not markup).

### 6.9 Combat log

Parchment strip, max-height ~160px, `overflow-y: auto`, newest entry appended at bottom and
auto-scrolled. Entry format: `.log__turn` ("T4") + mechanics clause (body, 14px) + optional
`.snark`. Turn numbers, not fake timestamps. Damage dealt = `--blood-ink` bold value; damage
taken = plain ink with sword glyph; money = `--gold-ink`; status (stagger, feint) = italic body.
Announced politely, **≤ 1 utterance per turn** — not ≤ 1 entry: an exchange pushes two entries
(three with a press), and speaking only one of them tells a screen-reader player either what they
dealt or what they took, never both. One turn is one announcement carrying the whole exchange.
The announcement does **not** come from the strip itself: `mount()` replaces `#app` wholesale, a
live region inserted already-populated announces nothing, and the counting/streaming rewrites
inside one would each be their own utterance. Announce from a persistent `.sr-only`
`aria-live="polite"` region outside `#app`, written after insertion.

### 6.10 Sponsor notice

Parchment card, `--tilt-3`, distinct dog-eared corner (a folded-triangle pseudo-element) so the
recurring comedy vehicle is instantly recognizable. Anatomy: "SPONSOR:" eyebrow (uppercase body,
0.06em), sponsor name (display, 24px), objective as mechanics line, reward in price format
(`+200 G` income green) + snark. Objectives must reference real mechanics/verbs from
`config.js` (e.g. "Feint 3 times", "Win in under 10 rounds") — never phantom verbs.

### 6.11 Training row

`grid: [icon 24px] [label+meter 1fr] [.btn with price slot]`. One label format:
`Power 24/50` / `Train +5` / price `200 G`. Escalating cost comes from config; after a purchase
the row's meter fill transitions (150ms) and a delta chip fires.

**Amendment (visual-upgrade design):** the icon column widens to 34px, carrying a
default-size `.icon-well` per §6.18 rather than a bare 24px icon. Shipped columns are
`34px 90px 1fr auto` (well · label · meter · button) with a `--space-3` gap.

**And the well takes its room out of the meter, so ≤640px needs its own columns.** With the fixed
90px label, the new 34px well and two 12px gaps, the `1fr` meter measured **~15px at 375px** — down
from ~61px before the well, and no longer readable as a meter at all. So inside screens.css's own
≤640px breakpoint:

```css
@media (max-width: 640px) {
  .train-row {
    grid-template-columns: 34px auto 1fr auto;
    gap: var(--space-2);
  }
}
```

The label column sizes to its own content instead of holding a fixed 90px, and the gap drops one
step. The meter gets its width back with no markup change and no named-area change — the row is a
plain four-column grid, not part of §7's area maps. (This is a different problem from the one
recorded against the training row in the older progress notes, where the `auto` Train button takes
max-content; that one is still open and is why the meter is `decorative: true` with the real number
in the label beside it.)

### 6.12 Shop item card — the state triad

Parchment mini-card (M2, no tape), anatomy: icon well, name (body 700), price slot, snark slot.
Three mutually exclusive states — structural, not just tonal:

| State        | Class              | Treatment                                                                                               |
| ------------ | ------------------ | ------------------------------------------------------------------------------------------------------- |
| Available    | —                  | Full color; price in `--gold-ink`; hover lifts (`translateY(-2px)`)                                     |
| Unaffordable | `.is-unaffordable` | Full color; price in `--blood-hi`; shortfall snark; click → purse shake                                 |
| Owned        | `.is-owned`        | Desaturated to ~60% opacity; price row **replaced** by ink checkmark + "OWNED"; no hover; not a control |

Never render unaffordable and owned with the same visual weight (this was the mockup's bug).

An owned card is a `<div>`, not a disabled button: there is nothing to click, so it carries no
action and no `aria-disabled` — the attribute is ignored on a role-less element, and the visible
"✓ Owned" already states the case. (An inert _button_ — an option already taken, such as
`Bribed ✓` — is different: it stays a `<button>` and does use `aria-disabled`, so it is announced
rather than dropped out of the tab order.)

### 6.13 Banner stamps (`.banner-stamp`)

Screen-level result titles, display face, stamped on entry (§5): `--victory` ("VICTORY!",
`--moss-ink`), `--defeat` ("DEFEAT.", `--blood-ink`), `--death` ("YOU DIED",
`--blood`, `--text-4xl`). Rendered as a tilted parchment ribbon with ink border; entrance =
scale 1.5→1.0, 2 frames, with one ±2° rotation settle frame. On death, the **giant Roman
sandal** (content image asset, ~40% viewport height) descends behind the stamp using
`--ease-drop`; reduced-motion: it's simply present.

### 6.14 Endings gallery card (`.ending-card`)

GAMEOVER shows all three endings; the achieved one center and full-color, the other two
`--locked`: grayscale filter, 55% opacity, tape intact, and a mocking snark epitaph
("Champion? You got a belt. It doesn't fit."). Locked cards are `aria-disabled` info cards —
not buttons. Below the trio: `.cause-of-death` — body 700 lead-in ("Cause of Death:") +
the absurd line at `--text-lg`, the screenshot payload, with `.wordmark` in frame.
`Fight Again` is the lone `.btn--commit`.

### 6.15 Modal (generic, e.g. death-match clause confirm)

`.modal__scrim`: `rgba(31,22,12,0.6)` full-screen, `z-index: var(--z-modal)`.
`.modal`: parchment M2 + tape, max-width 420px, centered, stamp entrance. Focus is trapped;
`Escape` = cancel; confirm button is `.btn--commit`, cancel is plain `.btn`. Confirm/cancel
order fixed: cancel left, commit right, on every modal.

### 6.16 Title plaque (`.title-plaque`)

Per-screen parchment plaque carrying the screen's `h1`, overlapping the HUD beam's bottom edge
(visual-upgrade design §3.2). M2 parchment + tape, `width: max-content`, centered, negative top
margin, `position: relative` + `z-index: var(--z-plaque)`, tilt `--tilt-3`. Text comes from
existing screen state; CSS uppercases it (`text-transform`), the string stays sentence-case in
JS. One component, four screens: Hub (Current wins: N) / Fight / Result / Game over. The `h1`
is the screen's only `h1`.

The overlap itself is the negative margin's doing, and the plaque paints _over_ the beam because
it is positioned at all: positioned, z-indexed content paints above non-positioned in-flow
content, and `.hud` is exactly that — no `position`, no `z-index` of its own. `--z-plaque`'s
value is not being weighed against `--z-hud`; nothing but `.commit-bar` (≤640px) consumes that
token.

### 6.17 Stage layers (`.stage-backdrop`, `.stage-frame`)

Viewport-fixed decorative layers wrapping every screen (visual-upgrade design §3.3):
stone body (M1) → `.stage-backdrop` (`--z-backdrop`) → `.stage-frame` (`--z-frame`,
`pointer-events: none`) → screen content. Both `aria-hidden="true"`, both static in
`index.html` — they are not re-rendered. Empty backdrop = the body's stone shows through
(§10 zero-asset rule). Phase 1 frame is a plain `--stone-2` border of width `--frame-w`
(14px, 8px ≤640px); Phase 3 replaces it with cartoon-masonry `border-image`. The body gains
`padding: var(--frame-w)` so content never sits under the border.

**Content clears the frame by offset, not by z-order — and nothing interactive is stacked above
it.** Regular content is non-positioned (`z-index: auto`), and `--z-hud` has exactly one consumer
in the whole sheet set: `.commit-bar`, inside screens.css's ≤640px block. So every button, meter
and card on every screen paints _below_ `.stage-frame` at `--z-frame: 5`. (An earlier draft of this
section claimed "interactive layers (`--z-hud` and up) stay above the frame". They do not, because
almost nothing consumes `--z-hud`.)

**Constraint on Phase 3 (stated here so it is not rediscovered).** That ordering is harmless today
for one reason only: a plain `border` paints strictly inside the border box, so the frame's ink
occupies exactly the ring the body's `padding: var(--frame-w)` has already vacated — it has nothing
to cover. A cartoon-masonry `border-image` is not so constrained: `border-image-outset` pushes the
slice _outward_ (off-screen here, harmless), but any inward overhang — an oversized slice, a
`border-image-width` above the border width, a stone that bulges past its ring — **will paint over
the controls beneath it**, and being `pointer-events: none` it will do so while leaving them
clickable: a button visibly buried under a rock that still takes the click. So Phase 3 must do one
of three things, deliberately:

1. keep the masonry strictly inside its ring and widen `--frame-w` to buy the room, or
2. give the frame a negative `z-index` band of its own below the content, or
3. stack the content above it — which means finding real consumers for `--z-hud`, i.e. positioning
   every interactive layer, not just the ≤640px commit bar.

Whichever is chosen, the body-padding offset stops being the whole mechanism the moment the frame's
paint can reach inward, and this section is where that has to be re-stated.

### 6.18 Icon well (`.icon-well`)

The generic empty-slot treatment, generalized from §6.12's shop slot (which is now an instance of
it and nothing more — see §6.0's amendment): recessed paper radial, ink border, wobble radius. 34px
default, 24px as `.icon-well--sm` — the two cramped contexts: the HUD beam's stats (§6.1) and the
ledger's source money rows (§6.6). Always `aria-hidden="true"` with a `data-icon="<name>"` hook —
Phase 2 paints the named glyph via CSS mask; until then the recessed well reads as an
intentional slot. Never carries meaning: the adjacent label/numeral does.

Emitted by one function, `iconWell(name, { small })` in `src/ui/components.js`. Nothing hand-rolls
the markup — that is what keeps an element or attribute added here from reaching four surfaces and
missing a fifth.

**Amendment (visual-upgrade Phase 1 follow-up) — the `data-icon` registry.** Phase 1 ships 15 names
across five surfaces, and they share **one flat namespace**: `data-icon` is the only key, there is
no per-surface prefix, so Phase 2's mask selectors (`[data-icon='health']`) hit every well with
that name wherever it sits. The shipped set:

| Surface                           | Names                              | Size    |
| --------------------------------- | ---------------------------------- | ------- |
| HUD beam stats (§6.1)             | `health`, `durability`, `injuries` | `--sm`  |
| Training rows (§6.11)             | `power`, `guard`, `speed`          | default |
| Hub sinks, `btn({ icon })` (§6.2) | `repair`, `heal`, `bribe`          | default |
| Ledger source rows (§6.6)         | `purse`, `tax`, `sponsor`          | `--sm`  |
| Gear cards (§6.12)                | `shield`, `blade`, `charm`         | default |

Two things follow, and Phase 2 has to plan for both.

- **The namespace is not closed.** The first four rows are literals in `render.js`; the gear row is
  `item.id` straight out of `config.gear`, so adding a fifth piece of gear mints a sixteenth
  `data-icon` name with no code change and no spec edit. A Phase 2 glyph table keyed by name must
  therefore either be driven from `config.gear` or fail loudly on an unmapped id — a silent miss
  renders as an empty well, which is indistinguishable from Phase 1's intended state.
- **Names overlap across surfaces, deliberately.** `health` is the HUD's, and a Phase 2 poster or
  ledger well naming `health` would get the same glyph — which is right. But note the collision
  risk the flat namespace carries: a gear id or a future sink that happens to be spelled like an
  existing name silently inherits that glyph rather than getting its own. The registry above is the
  list to check a new name against.

`data-icon` names the glyph and only the glyph: size travels on `.icon-well--sm`, and no well
encodes a state at all. The 15 names above are every value it takes today.

---

## 7. Screen Layouts — `src/styles/screens.css`

Desktop-first. Base design width 1280; content max-width 1180px centered.
Breakpoints: `≤ 900px` (compact), `≤ 640px` (stacked mobile).

```css
.screen {
  display: grid;
  gap: var(--space-4);
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--space-4);
}

/* HUB — spend left→right, commit bottom-right */
.screen--hub {
  grid-template-columns: 230px 1fr 300px;
  grid-template-areas:
    'hud     hud     hud'
    'sinks   develop fight'
    'retire  retire  commit';
}
/* sinks: Repair/Heal/Bribe stack · develop: Training rows + Gear Shop grid + Sponsor
   fight: YOU poster + NEXT BOUT poster (once!) · retire: Retire Rich · commit: Next Fight */

/* FIGHT — posters flank, meter center-stage, log left / actions right */
/* SUPERSEDED — three things, not two: this rule's `grid-template-areas`, its
   `grid-template-rows`, and the slot legend under the closing brace. The amendment further down
   carries all three. Do not copy-paste this block: its three row tracks under a four-row area
   map is exactly the mismatch tests/grid-areas.test.js fails on. */
.screen--fight {
  grid-template-columns: 260px 1fr 300px;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    'hud  hud    hud'
    'you  stage  foe'
    'log  log    actions';
}
/* stage: taunt line + .meter + labels · actions: Press-the-Attack slot above 2×2 action grid */

/* RESULT — recap and ledger co-primary */
.screen--result {
  grid-template-columns: 1.1fr 1fr;
  grid-template-areas:
    'hud    hud'
    'recap  ledger'
    'cta    cta';
}
/* recap: banner-stamp + defeated-opponent poster with CSS red-X overlay (two rotated
   --blood bars, ::before/::after) · cta: centered .btn--commit */

/* GAMEOVER */
.screen--gameover {
  grid-template-columns: 1fr 1.2fr 1fr;
  grid-template-areas:
    'hud   hud    hud'
    'endL  stamp  endR'
    'cause cause  cause'
    'cta   cta    cta';
}

@media (max-width: 900px) {
  /* Area order at every breakpoint must follow the renderers' DOM order — hub: sinks, develop,
     fight; fight: you, stage, foe, log, actions — so visual order matches reading and tab order
     (§8, WCAG 1.3.2/2.4.3). `grid-template-areas` moves the eye, not the tab focus, so a grid
     that paints these out of source order silently splits the two. */
  .screen--hub {
    grid-template-columns: 1fr 1fr;
    grid-template-areas: 'hud hud' 'sinks develop' 'fight fight' 'retire commit';
  }
  .screen--fight {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: none;
    grid-template-areas: 'hud hud' 'you stage' 'foe stage' 'log log' 'actions actions';
  }
  /* Name the stack — do NOT use `grid-template-areas: none` here. See the note below. */
  .screen--result {
    grid-template-columns: 1fr;
    grid-template-areas: 'hud' 'recap' 'ledger' 'cta';
  }
  .screen--gameover {
    grid-template-columns: 1fr;
    grid-template-areas: 'hud' 'stamp' 'endL' 'endR' 'cause' 'cta';
  }
}
@media (max-width: 640px) {
  .screen {
    grid-template-columns: 1fr;
    grid-template-areas: none;
  }
  /* Both resets below are load-bearing. Neither is optional. */
  .screen > * {
    grid-area: auto;
  }
  .commit-bar {
    position: sticky;
    bottom: 0;
    z-index: var(--z-hud);
    justify-self: stretch;
    text-align: center;
    padding: var(--space-2);
    background: var(--grad-wood);
    border-top: var(--border-w) solid var(--border-ink);
  }
  /* Hub's Next Fight lives inside .commit-bar when stacked */
}
```

**Amendment (visual-upgrade design §3.1, decision 2):** the fight grid becomes

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

**Four row tracks, not three** — the superseded block's `auto 1fr auto` is one short of this area
map, and a screen that names more rows than it sizes is a `tests/grid-areas.test.js` failure. The
`1fr` is the third row (`you actions foe`), so the posters' second half absorbs the slack and the
`log`/`press` row stays content-sized at the bottom.

DOM order: you, stage, foe, actions, log, press — interactive flow stays meter → actions →
log → press. `.fight__press` holds the PRESS THE ATTACK arrow bottom-right; at ≤900px the areas
stack, with `grid-template-rows: none`:

    'hud     hud'
    'you     stage'
    'foe     stage'
    'actions actions'
    'log     log'
    'press   press'

(The `'hud hud'` row is not optional at either breakpoint: the beam renders as a sibling above the
`.screen` section, and the row is reserved for it — every other screen's area map carries the same
first row.) At ≤640px the standard area reset returns everything to source-order flow.

Slot legend, replacing the one under the superseded block above — stage: taunt line, `.meter`
and labels · actions: the 2×2 action grid, nothing else · press: the §6.2 commit arrow, seated
`justify-self: end; align-self: end` in its own area. That alignment is deliberately **not**
undone by the ≤640px reset (which neutralises `justify-self` for `.commit-bar` only), so the
stacked arrow stays right-aligned in flow rather than going full-bleed: it is a commit arrow,
not a commit bar.

**Two resets that a stacked grid cannot do without.** Dropping `grid-template-areas` does _not_
return named children to auto-placement: per CSS Grid §8.3 an unmatched `<custom-ident>` in
`grid-area` resolves to `1 <ident>`, and when no line carries that name every named child lands in
the same implicit cell — so the children **overlap** instead of stacking. `.screen > * { grid-area:
auto; }` is what actually stacks them, and it must sit in the same block. For the same reason the
≤900 result/gameover rules **name** their stacks rather than setting `areas: none`.

Second, a sticky footer must be told to fill its column. `.hub__commit` sets `justify-self: end` and
`.result__cta` / `.gameover__cta` set `center`; a grid item aligned `end` or `center` is
content-sized, so without `justify-self: stretch` the bar renders as a content-width chip floating
over whatever sits beneath it, with its `border-top` spanning a fraction of the screen.
`text-align: center` then keeps the button centred inside the full-width bar.

`tests/grid-areas.test.js` enforces both: it resolves the cascade at each breakpoint and fails if any
`.screen` child keeps a named `grid-area` where its container defines no matching
`grid-template-areas`, if a screen names more rows than it sizes, or if a sticky commit bar is left
content-sized. New screens inherit the resets for free **only if their `.screen--*` rules sit above
the ≤640 block.**

The `!important` once carried on `grid-template-columns` here is unnecessary — that rule already
beats the `.screen--*` rules on source order at equal specificity — and it blocked any screen that
wanted a non-`1fr` mobile grid.

Source order = reading order = tab order: HUD → content columns left-to-right → commit CTA last.
The "NEXT BOUT" opponent appears exactly once per screen.

---

## 8. Accessibility floor (ship-blocking)

- Contrast per §3 table; UI component boundaries ≥ 3:1 against adjacent fills.
- Focus: every interactive element shows `:focus-visible` outline (3px `--color-focus`,
  `--bone-bright` on blue). Tab order follows source order.
- Targets ≥ 44×44px (all `.btn`, shop cards, the meter itself).
- Keyboard parity: Space = strike, 1–4 = fight actions, Enter = activate, Escape = close modal.
- Color never sole channel: signs, glyphs, notches, labels as specified per component.
- `prefers-reduced-motion` per §5. No UI screen shake, ever (world-layer only, if ever added).
- Dynamic announcements: ledger `aria-live="polite"`, combat log — announced by the
  persistent #log-announcer region only; the rendered strip carries no live region (§6.9),
  result and game-over stamps — announced once through the persistent `#ledger-announcer`
  region, written after insertion (a `role="status"` rendered inside #app arrives
  already-populated and is mute; decided 2026-08-01, items 26/28). The rendered `.banner-stamp`
  carries no role.
- All text ≥ `--text-xs` (12.5px); mechanics text ≥ `--text-sm`.
- `.wordmark` is a logotype and exempt from the text-contrast floor (WCAG 1.4.3 logotype
  exemption); its `opacity: .7` treatment stands. Every other piece of real text — including
  text inside a dimmed card (locked endings, owned gear) — meets 4.5:1 as composited.
- Natively `disabled` controls are inactive UI components and exempt from the contrast floor
  (WCAG 1.4.3); their 0.45 dim stands.

---

## 9. Copy rules (for string tables in `config.js`)

- Voice: a bored arena official and a commentator who has seen too much. Deadpan, present tense.
- Snark grammar per §6.8. Mechanics clauses never contain jokes; asides never contain numbers.
- Titles: victory gets an exclamation ("VICTORY!"); defeat gets a period ("DEFEAT.");
  death gets neither irony nor softening ("YOU DIED").
- Cause-of-death lines: one sentence, concrete, absurd, ≤ 90 characters
  ("Decanted by a crude axe."). They are the screenshot payload — write ten, rotate randomly.
- Button labels are verbs ("Repair Weapon", "Bribe Official"); prices live in the price slot,
  never inside the label string.

---

## 10. File architecture & implementation order

Replace `src/styles.css` with an entry file that imports, in order:

```
src/styles/tokens.css      ← §1 + @font-face (§2)
src/styles/base.css        ← reset, body/stone background (M1), typography defaults,
                              .snark, .tape, .amount, focus rules, reduced-motion block
src/styles/components.css  ← §6 catalog, in catalog order
src/styles/screens.css     ← §7 grids
```

Suggested build order for implementing agents (each step independently verifiable):

1. tokens + base + fonts (visual smoke test: stone page, parchment swatch)
2. HUD beam + bars + pips (bind to existing state)
3. Buttons (all states) + hub layout + shop/training/sponsor cards
4. Timing meter: keep `combat.js` resolution logic and config schema as-is; add the two new
   config keys (§6.4); rewrite the `main.js` cursor loop to the timestamp formula
   (fixes the frame-rate dependency); switch cursor to `transform: translateX`; add zone
   rendering, per-turn sweet center, chicken, freeze-on-click; then fight layout + log
5. Ledger + theater + delta chips/ticker + result layout
6. Banner stamps, endings gallery, sandal, gameover layout
7. A11y pass against §8, reduced-motion pass, 640/900px passes

Content assets required (AI-generated to match mockups, transparent backgrounds, swappable):
`chicken.svg|png` (40×48), player portrait, 4 opponent portraits (4:3), sandal (death blow),
3 ending illustrations. **The UI must be fully functional and complete-looking with zero of
these assets present** (silhouette fallbacks in portrait wells; ink cursor line without chicken).

---

_Spec ends. Anything not specified here is not part of the system — extend the document first,
then the code._
