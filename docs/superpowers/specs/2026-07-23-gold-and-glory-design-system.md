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
  --paper-1: #f6ecd1;   /* highlight edge */
  --paper-2: #f3e7c8;   /* base */
  --paper-3: #e6d6ae;   /* shade */
  --paper-4: #d9c69a;   /* deep / portrait wells */

  /* Wood (planks, HUD beam) */
  --wood-1: #7a5533;
  --wood-2: #6b4a2a;
  --wood-3: #5f4227;
  --wood-4: #46301b;

  /* Stone (page background only — never behind text) */
  --stone-1: #a08f77;
  --stone-2: #93836d;
  --stone-3: #7e6f5b;

  /* Ink & bone */
  --ink: #2f2318;        /* borders, text on paper */
  --ink-soft: #6b5638;   /* muted/snark text on paper — 5.67:1 on paper-2 */
  --bone: #f2e7cd;       /* text on wood/dark — 10.06:1 on wood-4 */
  --bone-bright: #fdf6e4;/* text on commit blue — 4.76:1 on commit */
  --track: #241a11;      /* bar/meter track wells */

  /* Gold — money only (Law 2) */
  --gold-hi: #f4cf7a;
  --gold: #d9a441;       /* on dark wood: 5.50:1. NEVER as text on paper (1.83:1) */
  --gold-deep: #b07f24;  /* fills/borders only */
  --gold-ink: #7d5714;   /* money TEXT on paper — 5.26:1 */

  /* Blood — damage, costs, danger */
  --blood-hi: #c85541;
  --blood: #b5402f;      /* large/bold text on paper: 4.57:1; button fill */
  --blood-ink: #9c3226;  /* small text on paper — 5.89:1 */

  /* Moss — income, healing */
  --moss: #4a7c3f;       /* fills only (4.02:1 — fails as small text) */
  --moss-ink: #3f6b35;   /* text on paper — 5.07:1 */

  /* Commit blue — irreversible choices, focus */
  --commit-hi: #4d7fc0;
  --commit: #3e6fae;
  --commit-lo: #2d5487;  /* bone-bright on this: 7.14:1 */

  /* Spacing — 4px base scale */
  --space-1: 4px;  --space-2: 8px;   --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px;  --space-7: 48px; --space-8: 64px;

  /* Typography */
  --font-display: 'Bangers', 'Arial Black', sans-serif;
  --font-body: 'Nunito', system-ui, sans-serif;
  --font-snark: 'Patrick Hand', 'Comic Sans MS', cursive;
  --text-xs: 12.5px;  /* captions, log snark */
  --text-sm: 14px;    /* HUD labels, log */
  --text-md: 16px;    /* body, buttons */
  --text-lg: 19px;    /* prices, emphasized rows */
  --text-xl: 24px;    /* section headings (display) */
  --text-2xl: 32px;   /* poster names (display) */
  --text-3xl: 44px;   /* screen banners: VICTORY! (display) */
  --text-4xl: 64px;   /* YOU DIED (display) */
  --leading-display: 1.05;
  --leading-body: 1.5;

  /* Hand-drawn wobble radii — vary per component so nothing looks stamped */
  --wobble-1: 255px 18px 225px 18px / 18px 225px 18px 255px;
  --wobble-2: 18px 225px 18px 255px / 255px 18px 225px 18px;
  --wobble-3: 160px 22px 190px 24px / 22px 190px 24px 160px;
  --wobble-bar: 6px 9px 6px 8px;   /* subtle, for meters/bars */

  /* Tilt — siblings must alternate tilt tokens (never two identical neighbors) */
  --tilt-1: -1.4deg;
  --tilt-2: 0.8deg;
  --tilt-3: -0.6deg;

  /* Borders & shadows — hard offsets, zero blur = paper-cutout look */
  --border-w: 2.5px;
  --shadow-paper: 4px 6px 0 rgba(31, 22, 12, 0.35);
  --shadow-plank: 0 3.5px 0 rgba(31, 22, 12, 0.5);
  --shadow-plank-pressed: 0 1px 0 rgba(31, 22, 12, 0.5);

  /* Gradients */
  --grad-paper: linear-gradient(178deg, var(--paper-1), var(--paper-3));
  --grad-wood: linear-gradient(var(--wood-3), var(--wood-4));
  --grad-wood-hover: linear-gradient(var(--wood-2), var(--wood-3));
  --grad-commit: linear-gradient(var(--commit-hi), var(--commit-lo));
  --grad-coin: radial-gradient(circle at 35% 30%, var(--gold-hi), var(--gold) 55%, var(--gold-deep));

  /* Motion — paper-puppet: stepped, snappy, pivoted (see §5) */
  --dur-snap: 180ms;    /* UI state changes */
  --dur-stamp: 240ms;   /* stamps, chicken drop */
  --dur-tally: 350ms;   /* per ledger line */
  --dur-chip: 900ms;    /* delta chip lifetime */
  --ease-snap: steps(3, end);
  --ease-drop: steps(2, end);

  /* Z-scale (paper layering) */
  --z-hud: 10;
  --z-chip: 20;
  --z-modal: 30;

  /* ============ TIER 2 — SEMANTIC ============ */
  --color-text: var(--ink);
  --color-text-muted: var(--ink-soft);
  --color-text-inverse: var(--bone);
  --color-money: var(--gold-ink);          /* money text on paper */
  --color-money-on-dark: var(--gold);      /* money text on wood */
  --color-income: var(--moss-ink);
  --color-expense: var(--blood-ink);
  --color-damage: var(--blood);
  --color-heal: var(--moss-ink);
  --color-focus: var(--commit-hi);
  --surface-page: var(--stone-2);
  --surface-paper: var(--paper-2);
  --surface-wood: var(--wood-4);
  --border-ink: var(--ink);
}
```

**No dark mode.** The game commits to one lit arena; there is no theme switch. (Deliberate, not an omission.)

---

## 2. Typography

| Role | Face | Weight | Usage | Never |
|---|---|---|---|---|
| Display | Bangers | 400 | Banners, screen titles, commit CTAs, result stamps, poster names | Body copy, anything below 19px |
| Body | Nunito | 400 / 700 | All UI text, prices, stats, combat log, plank buttons | — |
| Snark | Patrick Hand | 400 | `.snark` slot only | Mechanics, numbers, labels |

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
@font-face { font-family: 'Bangers';      src: url('../assets/fonts/Bangers-400.woff2') format('woff2');      font-weight: 400; font-display: swap; }
@font-face { font-family: 'Nunito';       src: url('../assets/fonts/Nunito-400.woff2') format('woff2');       font-weight: 400; font-display: swap; }
@font-face { font-family: 'Nunito';       src: url('../assets/fonts/Nunito-700.woff2') format('woff2');       font-weight: 700; font-display: swap; }
@font-face { font-family: 'Patrick Hand'; src: url('../assets/fonts/PatrickHand-400.woff2') format('woff2');  font-weight: 400; font-display: swap; }
```

---

## 3. Color Usage & Verified Contrast

Every pair below was computed (WCAG 2.x relative luminance). Do not substitute values.

| Foreground on background | Ratio | Verdict / rule |
|---|---|---|
| `--ink` on `--paper-2` | 12.42:1 | Body text on paper |
| `--ink-soft` on `--paper-2` | 5.67:1 | Muted + snark on paper |
| `--gold-ink` on `--paper-2` | 5.26:1 | **The only gold allowed as text on paper** |
| `--gold` on `--paper-2` | 1.83:1 | FAIL — display gold is fills/dark-bg only |
| `--blood` on `--paper-2` | 4.57:1 | Large/bold damage text on paper |
| `--blood-ink` on `--paper-2` | 5.89:1 | Small expense text on paper |
| `--moss-ink` on `--paper-2` | 5.07:1 | Income/heal text on paper (`--moss` fails at 4.02) |
| `--bone` on `--wood-4` | 10.06:1 | Button/HUD text on wood |
| `--gold` on `--wood-4` | 5.50:1 | HUD purse |
| `--bone-bright` on `--commit` | 4.76:1 | Commit banner text (display size) |
| `--bone-bright` on `--commit-lo` | 7.14:1 | Commit banner text, small |
| `--ink` on `--gold` | 6.79:1 | Gold badges/coins |
| `--bone` on `--track` | 13.88:1 | Numbers inside bars |
| `--bone` on `--stone-2` | 2.99:1 | FAIL — this is why Law 4 exists |

Colorblind redundancy (mandatory): money deltas always carry `+`/`−`; damage log lines carry the
sword glyph, healing the drop glyph; meter zones are labeled and notched (§6.4); owned vs
unaffordable shop states differ by *structure*, not hue (§6.12).

---

## 4. Materials (the five treatments — nothing else)

**M1 — Stone page.** `body` background: flat `--surface-page` + radial vignette
(`radial-gradient(140% 120% at 50% 100%, rgba(31,22,12,.38), transparent 60%)`). An optional
illustrated arena backdrop image may sit behind screens, but must be covered by a
`rgba(47,35,24,0.5)` scrim wherever panels are absent. No text on this layer, ever.

**M2 — Parchment panel.** `--grad-paper` fill, `var(--border-w) solid var(--border-ink)`,
one `--wobble-*` radius, `--shadow-paper`, one `--tilt-*`. Used for: posters, ledger, log,
sponsor notice, shop cards, endings, modals.

**M3 — Wood plank.** `--grad-wood` fill, ink border, small wobble radius (`10px 14px 9px 15px`
family), `--shadow-plank`. Used for: HUD beam, ordinary buttons.

**M4 — Tape.** Pseudo-elements on `.tape`: two 64×20px strips, `rgba(235,224,192,0.9)`,
1px `rgba(31,22,12,0.25)` border, top corners, rotations −5°/+4°.

**M5 — Ink.** Everything is outlined: `--border-w` ink borders, dashed ink dividers
(`1.5px dashed rgba(47,35,24,0.25)`), hard offset shadows. No blur anywhere except meter glow.

---

## 5. Motion — "paper puppet"

Everything moves like a Gilliam cutout: few frames, hard stops, pivot from an edge.

- **Timing functions:** only `--ease-snap` (3 frames) and `--ease-drop` (2 frames). Smooth easing
  is reserved for exactly two things: the meter sweep (linear, it's gameplay) and bar width
  transitions (150ms ease-out, they're data).
- **Transforms only** (`translate`, `rotate`, `scale`); never animate layout properties.
- **Pivots:** cards animate with `transform-origin` at a taped corner; stamps scale from center.
- **Budget:** UI state change ≤ `--dur-snap`; theatrical beats (stamp, chicken drop) ≤ `--dur-stamp`;
  nothing except the ledger sequence exceeds 400ms total.
- **`prefers-reduced-motion: reduce`:** all `steps()` animations become instant state changes;
  delta chips appear/disappear without travel; ledger lines appear pre-tallied with a single
  fade; the meter sweep remains (it is the game mechanic), but screen shake and chicken
  flourish are removed.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 1ms !important; transition-duration: 1ms !important; }
  .meter-cursor { transition: none !important; } /* sweep stays JS-driven */
}
```

---

## 6. Component Catalog

### 6.0 Closed class index

`hud, hud__purse, hud__stat, hud__label, coin, bar, bar__fill, bar__fill--dur, bar__num,
pips, pip, pip--filled, btn, btn--commit, btn--danger, btn__price, btn__snark, is-disabled,
is-unaffordable, is-owned, is-urgent, meter, meter__zone, meter__zone--graze, meter__zone--hit,
meter__zone--crit, meter__label, meter__tick, meter-cursor, meter-chicken, meter__stamp,
poster, poster__name, poster__portrait, poster__sub, tape, snark, ledger, ledger__banner,
ledger__row, ledger__row--net, ledger__row--balance, amount, amount--pos, amount--neg,
delta-chip, ticker, log, log__entry, log__turn, sponsor-card, train-row, train-row__meter,
shop-item, banner-stamp, banner-stamp--victory, banner-stamp--defeat, banner-stamp--death,
ending-card, ending-card--locked, cause-of-death, modal, modal__scrim, wordmark,
screen, screen--hub, screen--fight, screen--result, screen--gameover, commit-bar`

### 6.1 HUD beam (persistent, all screens)

Wood plank strip pinned top, `grid-area: hud`, `z-index: var(--z-hud)`.
Contents in order: purse, Health bar, Durability bar, Injuries pips.

```html
<header class="hud">
  <span class="hud__purse"><i class="coin"></i>GOLD: <span class="ticker" data-value="2450">2,450</span></span>
  <span class="hud__stat"><span class="hud__label">HEALTH</span>
    <span class="bar" role="meter" aria-label="Health" aria-valuenow="65" aria-valuemax="100">
      <span class="bar__fill" style="width:65%"></span><span class="bar__num">65/100</span>
    </span></span>
  <span class="hud__stat"><span class="hud__label">DURABILITY</span>
    <span class="bar"><span class="bar__fill bar__fill--dur" style="width:58%"></span><span class="bar__num">58/100</span></span></span>
  <span class="hud__stat"><span class="hud__label">INJURIES</span>
    <span class="pips" aria-label="3 injuries">
      <i class="pip pip--filled"></i><i class="pip pip--filled"></i><i class="pip pip--filled"></i><i class="pip"></i><i class="pip"></i>
    </span></span>
</header>
```

```css
.hud {
  display: flex; align-items: center; gap: var(--space-5); flex-wrap: wrap;
  background: linear-gradient(var(--wood-3), var(--wood-4));
  border: var(--border-w) solid var(--border-ink); border-radius: 10px 14px 9px 15px;
  padding: var(--space-2) var(--space-4);
  box-shadow: var(--shadow-plank);
  color: var(--color-text-inverse);
  font-family: var(--font-body); font-weight: 700; font-size: var(--text-sm);
}
.hud__purse { color: var(--color-money-on-dark); display: inline-flex; align-items: center;
  gap: var(--space-2); font-variant-numeric: tabular-nums; }
.coin { width: 15px; height: 15px; border-radius: 50%; display: inline-block;
  background: var(--grad-coin); border: 1.5px solid var(--border-ink); }
.bar { position: relative; width: 108px; height: 16px; background: var(--track);
  border: 2px solid var(--border-ink); border-radius: var(--wobble-bar); overflow: hidden; }
.bar__fill { position: absolute; inset: 0 auto 0 0; background: var(--blood);
  transition: width 150ms ease-out; }
.bar__fill--dur { background: var(--gold-deep); }
.bar__num { position: absolute; inset: 0; display: grid; place-items: center;
  font-size: 11px; color: var(--bone); font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 0 rgba(31,22,12,0.9); }
.pips { display: inline-flex; gap: 3px; }
.pip { width: 11px; height: 14px; border: 1.5px solid var(--border-ink);
  border-radius: 50% 50% 50% 50% / 62% 62% 38% 38%; background: var(--track); }
.pip--filled { background: var(--blood); }
```

Rules:
- Health fill is `--blood` at all values; below 33% add `.is-urgent` on the `.bar` → 900ms
  opacity pulse on the fill (steps(2)).
- Pips render `max(injuries, 5)` slots; each filled pip = one 40 G debt (GDD heal cost).
- On GAMEOVER the HUD persists showing the fatal state (0/100) — deliberate storytelling.
- Purse ticker + delta chips: §6.7.

### 6.2 Buttons

Three variants. All: `min-height 44px`, `font-family var(--font-body) 700` (plank/danger) or
`var(--font-display)` (commit), `cursor: pointer`, and:

```css
.btn { display: inline-flex; align-items: baseline; gap: var(--space-3);
  font: 700 var(--text-md)/1.2 var(--font-body); color: var(--color-text-inverse);
  background: var(--grad-wood); border: var(--border-w) solid var(--border-ink);
  border-radius: 9px 13px 8px 14px; padding: var(--space-3) var(--space-4);
  box-shadow: var(--shadow-plank); min-height: 44px; }
.btn:hover { background: var(--grad-wood-hover); }
.btn:active { transform: translateY(2.5px); box-shadow: var(--shadow-plank-pressed); }
.btn:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 3px; }
.btn__price { color: var(--color-money-on-dark); font-variant-numeric: tabular-nums; font-size: var(--text-lg); }
.btn__snark { font-family: var(--font-snark); font-weight: 400; font-size: var(--text-sm); color: #cdb98e; }

.btn--commit { font: 400 21px/1 var(--font-display); letter-spacing: 0.05em;
  color: var(--bone-bright); background: var(--grad-commit); border-radius: var(--wobble-1);
  padding: var(--space-2) var(--space-5); text-shadow: 0 1.5px 0 rgba(20,30,50,0.55); }
.btn--commit:focus-visible { outline-color: var(--bone-bright); }

.btn--danger { background: linear-gradient(var(--blood-hi), var(--blood)); }

.btn.is-disabled, .btn[aria-disabled="true"] { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
.btn.is-unaffordable { /* stays full-strength EXCEPT the price */ }
.btn.is-unaffordable .btn__price { color: var(--blood-hi); }
.btn.is-unaffordable .btn__snark::after { content: " (need " attr(data-missing) " more)"; }
.btn.is-urgent { animation: urgent-pulse 1.2s var(--ease-drop) infinite; }
@keyframes urgent-pulse { 50% { box-shadow: var(--shadow-plank), 0 0 0 3px var(--gold-deep); } }
```

Anatomy rule: every commerce button is `[label] [price slot] [snark slot?]` — the price is
first-class, right of the label, never in parentheses.

Semantics:
- `.btn--commit` (blue banner + display face) **only** for irreversible commitments:
  Next Fight, Press the Attack, Retire Rich, Fight Again, Return to Ludus.
- `.is-unaffordable`: button remains enabled-looking but click is rejected with a purse-shake
  (§6.7) — the game *tells* you you're broke rather than hiding the option. `data-missing`
  carries the formatted shortfall.
- `.is-urgent` (state-driven glow): applied by JS when durability < 50% (Repair) or
  injuries ≥ 1 (Heal).
- Keyboard: hub actions get `accesskey`-free numeric hints; fight actions bind 1–4, Space = strike
  (see §6.4), Enter activates focused control.

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

With `W = baseTimingWidth + speedTimingBonus × effectiveSpeed` and per-turn center `c`,
zones are nested windows (matching `resolveTiming`):

```
|p − c| ≤ W × ratios.crit    → CRIT
|p − c| ≤ W × ratios.hit     → HIT
|p − c| ≤ W × ratios.graze   → GRAZE
otherwise                    → MISS
```

Speed widens every window (readable risk: training Speed visibly widens the bright zones).

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
<div class="meter" role="application" aria-label="Timing meter — press Space or click to strike">
  <div class="meter__zone meter__zone--graze" style="left:var(--graze-start);width:var(--graze-size)"></div>
  <div class="meter__zone meter__zone--hit"   style="left:var(--hit-start);width:var(--hit-size)"></div>
  <div class="meter__zone meter__zone--crit"  style="left:var(--crit-start);width:var(--crit-size)"></div>
  <div class="meter-cursor"><img class="meter-chicken" src="…/chicken.svg" alt=""></div>
</div>
<div class="meter__labels"><!-- MISS · GRAZE · HIT · CRIT ticks, aligned to zone edges --></div>
```

```css
.meter { position: relative; height: 48px; background: var(--track);
  border: var(--border-w) solid var(--border-ink); border-radius: var(--wobble-bar);
  cursor: crosshair; }
.meter__zone { position: absolute; top: 0; bottom: 0; }
.meter__zone--graze { background: #b98a3a; }
.meter__zone--hit   { background: var(--gold); }
.meter__zone--crit  { background: var(--gold-hi);
  border-inline: 2px solid var(--border-ink);            /* notches: not color-only */
  box-shadow: 0 0 12px rgba(244, 207, 122, 0.8); }       /* the one permitted glow */
.meter-cursor { position: absolute; top: 0; bottom: 0; width: 3px;
  background: var(--ink); will-change: transform; }
.meter-chicken { position: absolute; bottom: 100%; left: 50%; width: 40px; height: 48px;
  transform: translateX(-50%); }
```

Zone color logic: a monochromatic gold ramp — *the brighter, the closer to glory* — plus ink
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

### 6.5 Wanted poster (combatant card)

Parchment M2 + tape M4, `--tilt-1` (player) / `--tilt-2` (opponent) — neighbors never share tilt.
Anatomy top-to-bottom: `.poster__name` (display, 27px, centered), `.poster__portrait`
(fixed 4:3 well, `--paper-4` ground, `<img>` content asset with silhouette fallback),
`.poster__sub` (tier · fight purse with `--gold-ink` amount), `.snark` line.
HP plate for fight screen: one `.bar` (width 100%) mounted *below* the portrait — exactly one
per poster. Player poster and HUD may both show HP; they must read from the same state field.

### 6.6 The Ledger (result breakdown)

Parchment M2, `--tilt-2`. This card is co-primary with the result banner — it IS the product.

```html
<section class="ledger tape" aria-live="polite">
  <p class="ledger__banner">VICTORY!</p>
  <p class="snark">He tripped on a banana peel. Victory by default!</p>
  <dl>
    <div class="ledger__row"><dt>Purse</dt><dd class="amount amount--pos">+600 G</dd></div>
    <div class="ledger__row"><dt>Tax (15%) <span class="snark">(Ouch!)</span></dt><dd class="amount amount--neg">−90 G</dd></div>
    <div class="ledger__row"><dt>Sponsor bonus <span class="snark">(He loves losers)</span></dt><dd class="amount amount--pos">+150 G</dd></div>
    <div class="ledger__row ledger__row--net"><dt>Net gold</dt><dd class="amount amount--pos">+660 G</dd></div>
    <div class="ledger__row ledger__row--balance"><dt>New balance</dt><dd class="amount">3,110 G</dd></div>
  </dl>
</section>
```

```css
.ledger__banner { font: 400 var(--text-3xl)/1 var(--font-display); color: var(--blood); margin: 0; }
.ledger__row { display: flex; justify-content: space-between; align-items: baseline;
  gap: var(--space-4); padding: var(--space-1) 0;
  border-bottom: 1.5px dashed rgba(47, 35, 24, 0.25); }
.ledger__row--net { border-top: var(--border-w) solid var(--border-ink); margin-top: var(--space-2); }
.amount { font-weight: 700; font-variant-numeric: tabular-nums; }
.amount--pos { color: var(--color-income); }
.amount--neg { color: var(--color-expense); }
.ledger__row--balance .amount { color: var(--color-money); font-size: var(--text-lg); }
```

**Ledger theater (sequence, exact):** rows start `visibility: hidden`; reveal one per
`--dur-tally` beat, top to bottom. Money rows count from 0 to value over the beat
(tabular digits prevent wobble). The tax row lands with a stamp animation on its amount
(scale 1.4→1.0, `--ease-drop`) — the player must *feel* the cut, every fight. Banner and
snark line appear first with the stamp treatment. Total sequence ≤ 2.5s; a click anywhere
skips to the final state (never trap the player in theater). Reduced motion: single fade,
pre-tallied.

Rules: zero-value lines render muted ink, never red ("Injuries gained: 0" is good news).
The result CTA is `.btn--commit` with the resulting balance in its price slot:
`Return to Ludus · 3,110 G`. Defeat-without-death uses the same ledger with
`banner-stamp--defeat` ("DEFEAT." — deadpan period, no exclamation) and expense-heavy rows.
A small `.wordmark` ("GOLD & GLORY") sits in the card's bottom corner — every screenshot
carries the brand.

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
color `--ink-soft` on paper, `#cdb98e` on wood. Grammar: **`[mechanical truth] (aside)`** —
the aside is optional, ≤ 40 characters, always parenthesized, and never contradicts or
obscures the mechanics it accompanies. Asides may mock the player, the opponent, or the
economy; they never lie about numbers. All snark strings live in `config.js` string tables
(they are content, not markup).

### 6.9 Combat log

Parchment strip, max-height ~160px, `overflow-y: auto`, newest entry appended at bottom and
auto-scrolled. Entry format: `.log__turn` ("T4") + mechanics clause (body, 14px) + optional
`.snark`. Turn numbers, not fake timestamps. Damage dealt = `--blood-ink` bold value; damage
taken = plain ink with sword glyph; money = `--gold-ink`; status (stagger, feint) = italic body.
`aria-live="polite"` on the container, ≤ 1 entry announced per turn.

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

### 6.12 Shop item card — the state triad

Parchment mini-card (M2, no tape), anatomy: icon well, name (body 700), price slot, snark slot.
Three mutually exclusive states — structural, not just tonal:

| State | Class | Treatment |
|---|---|---|
| Available | — | Full color; price in `--gold-ink`; hover lifts (`translateY(-2px)`) |
| Unaffordable | `.is-unaffordable` | Full color; price in `--blood-hi`; shortfall snark; click → purse shake |
| Owned | `.is-owned` | Desaturated to ~60% opacity; price row **replaced** by ink checkmark + "OWNED"; no hover; `aria-disabled` |

Never render unaffordable and owned with the same visual weight (this was the mockup's bug).

### 6.13 Banner stamps (`.banner-stamp`)

Screen-level result titles, display face, stamped on entry (§5): `--victory` ("VICTORY!",
`--moss` fill paper banner), `--defeat` ("DEFEAT.", `--blood-ink`), `--death` ("YOU DIED",
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

---

## 7. Screen Layouts — `src/styles/screens.css`

Desktop-first. Base design width 1280; content max-width 1180px centered.
Breakpoints: `≤ 900px` (compact), `≤ 640px` (stacked mobile).

```css
.screen { display: grid; gap: var(--space-4); max-width: 1180px;
  margin: 0 auto; padding: var(--space-4); }

/* HUB — spend left→right, commit bottom-right */
.screen--hub {
  grid-template-columns: 230px 1fr 300px;
  grid-template-areas:
    "hud     hud     hud"
    "sinks   develop fight"
    "retire  retire  commit";
}
/* sinks: Repair/Heal/Bribe stack · develop: Training rows + Gear Shop grid + Sponsor
   fight: YOU poster + NEXT BOUT poster (once!) · retire: Retire Rich · commit: Next Fight */

/* FIGHT — posters flank, meter center-stage, log left / actions right */
.screen--fight {
  grid-template-columns: 260px 1fr 300px;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "hud  hud    hud"
    "you  stage  foe"
    "log  log    actions";
}
/* stage: taunt line + .meter + labels · actions: Press-the-Attack slot above 2×2 action grid */

/* RESULT — recap and ledger co-primary */
.screen--result {
  grid-template-columns: 1.1fr 1fr;
  grid-template-areas:
    "hud    hud"
    "recap  ledger"
    "cta    cta";
}
/* recap: banner-stamp + defeated-opponent poster with CSS red-X overlay (two rotated
   --blood bars, ::before/::after) · cta: centered .btn--commit */

/* GAMEOVER */
.screen--gameover {
  grid-template-columns: 1fr 1.2fr 1fr;
  grid-template-areas:
    "hud   hud    hud"
    "endL  stamp  endR"
    "cause cause  cause"
    "cta   cta    cta";
}

@media (max-width: 900px) {
  .screen--hub { grid-template-columns: 1fr 1fr;
    grid-template-areas: "hud hud" "sinks fight" "develop develop" "retire commit"; }
  .screen--fight { grid-template-columns: 1fr 1fr;
    grid-template-areas: "hud hud" "you foe" "stage stage" "actions actions" "log log"; }
  .screen--result, .screen--gameover { grid-template-columns: 1fr;
    grid-template-areas: none; } /* natural stacking order via source order */
}
@media (max-width: 640px) {
  .screen { grid-template-columns: 1fr !important; }
  .commit-bar { position: sticky; bottom: 0; z-index: var(--z-hud);
    padding: var(--space-2); background: var(--grad-wood);
    border-top: var(--border-w) solid var(--border-ink); }
  /* Hub's Next Fight and Fight's action grid live inside .commit-bar when stacked */
}
```

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
- Dynamic announcements: ledger `aria-live="polite"`, log `aria-live="polite"`,
  result stamps `role="status"`.
- All text ≥ `--text-xs` (12.5px); mechanics text ≥ `--text-sm`.

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

*Spec ends. Anything not specified here is not part of the system — extend the document first,
then the code.*
