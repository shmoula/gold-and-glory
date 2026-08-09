# UX/Interaction Overhaul (Phase 4) — Design

Date: 2026-08-09
Status: approved (session ran in full agent mode; the commissioning prompt authorized
autonomous execution, and its constraints stand in for the clarifying-question loop —
each decision below cites the constraint it answers).

## 1. Why

A full UX/UI audit (live play at 1280×720 and 375×812, plus a source read of every UI
module) found the project's polish fundamentals already strong — tokens, documented
contrast, reduced motion, seeded determinism. The failures are screen-level ergonomics,
onboarding, and game feel:

1. **The core verb is off-screen.** On mobile the timing meter sits ~700px down and the
   action buttons ~1170px down, under a ~470px HUD and a full-size YOU poster. On a
   1280×720 desktop every screen is ~900px tall, so Next Fight / Return to Ludus /
   Fight Again all render below the fold; the sticky `.commit-bar` only exists ≤640px.
2. **The two-step combat interaction is never taught.** Freeze the meter, then pick an
   action. Nothing says so; clicking Strike cold resolves as a silent miss. There is no
   title or intro of any kind.
3. **Retire Rich ends the run in one click.** No confirmation on the most destructive
   control in the game.
4. **No hit feedback.** The enemy's reply resolves in the same render as the player's
   action: no beat, no flash, no damage numbers. The ⚔ glyph in "for ⚔ 9" reads as "× 9".
5. **Keyboard support is invisible and focus is lost every turn.** Space/Enter/1–4 are
   wired but unhinted, and `mount()`'s wholesale innerHTML replacement drops focus to
   `<body>` after every action.

Plus polish deficiencies: disabled sinks go 45%-transparent over the busy fixed backdrop
and read as broken; the static MISS/GRAZE/HIT/CRIT label row never matches the
randomized zones above it; the mobile HUD wastes ~45% of the viewport; training mascots
collide with Train buttons at narrow widths; the result screen's beaten poster dwarfs
the verdict stamp; the commentary strip renders empty before the first exchange.

## 2. Scope guardrails

- **No gameplay or balance changes.** `config.js`, `combat.js`, `economy.js`,
  `game.js`, `state.js` are untouched. Turn _sequencing_ is presentation pacing and
  lives in `main.js`; every outcome is computed exactly as today, in the same order,
  from the same RNG draws.
- **No audio.** A prior spec decision (2026-08-02) and unchanged here; the feedback
  pillar is satisfied visually.
- Motion stays ≤400ms per beat (§5), reduced motion honored via the existing
  `reducedMotion()` seam, colors are tokens only (Law 5), and the vitest suite stays
  green — tests are extended alongside every renderer/DOM change.

## 3. Decisions (with alternatives considered)

### D1. Primary CTA always on screen

`.commit-bar` becomes a viewport-fixed footer at **all** widths (today: ≤640px sticky
only), keeping the existing wood-ground footer treatment; `.screen` reserves the
footer's height in its own bottom padding. (Implementation note: _fixed_, not the
sticky first drafted here — a sticky element cannot leave its containing block, and
the commit row's grid area is exactly the below-the-fold strip the audit caught.)
A `@media (max-height: 780px)` block caps `.poster__portrait` height on short desktop
viewports so screens shrink toward the fold rather than past it.
_Rejected:_ compressing every screen into 100dvh (fights the hand-drawn scale, large
test churn); viewport-height grids with inner scroll panes (a rewrite).

### D2. Compact mobile HUD

≤640px the `.hud` beam becomes a two-column grid (`Gold | Health` / `Durability |
Injuries`) with `--space-2`/`--space-3` gaps and reduced padding. Target ≤120px tall
(from ~470px). Bars keep their 108px tracks and numerals; nothing is dropped from
the accessibility tree.

### D3. Fight screen: core verb first

- `renderFight` child order becomes **stage → actions → you → foe → log → press**.
  DOM order stays == reading order == tab order (the repo's §8 rule), and the meter
  becomes the _first_ interactive element — an improvement, since it is the turn's
  first required act. Desktop `grid-template-areas` continue to seat posters on the
  flanks; the ≤900px and ≤640px grids stack in the new source order, so meter and
  actions sit above the fold on mobile.
- ≤900px, fight-screen posters render as **compact strips** (CSS-only variant scoped
  `.screen--fight .poster`): portrait shrinks to a ~56px square beside the name/HP
  plate; sub line and snark hide at ≤640px. Hub and result posters are unaffected.
- The training mascots' `right: 140px` hover position collides with buttons at narrow
  widths → hide the mascots ≤640px (they are decoration; the icon wells remain).
- The chicken overlapping the taunt at 375px: give `.meter__taunt` clearance
  (margin/padding) so the sweep never runs through the copy.

### D4. Honest meter legend

Delete the static six-label row (it implies fixed zone positions; zones are seeded per
turn). Replace with a **swatch legend**: three small ramp chips — Graze, Hit, Crit —
in the zones' own fills plus the ink-notch treatment on the crit chip, and the words
"anywhere else: miss". The legend states the _mapping_ (brighter gold = better), which
is true at every zone position. A `<kbd>Space</kbd>` hint joins the legend line
(hidden for coarse pointers, `aria-hidden` — the meter's aria-label already names the
key).
_Rejected:_ dynamically positioning labels under the live zones (jitters every turn,
collides at narrow widths).

### D5. Turn sequencing + hit feedback

- `main.js` splits the exchange into two renders: the player's action renders
  immediately (foe HP drops, log line lands); the enemy's reply is applied after one
  beat (`ENEMY_BEAT_MS = 550`, `0` under reduced motion) and renders with feedback.
  Input is guarded during the beat (the delegated click handler and the document
  keydown handler both consult one `resolving` flag). Outcomes are unchanged: the same
  pure functions run in the same order with the same RNG.
- New `effects.js` helpers (timer-based, no rAF, per that file's own rules):
  `hitFlash(poster)` — a ≤300ms blood-tint flash + 3-frame shake on the struck
  poster's card; `spawnDamageChip(poster, amount)` — a floating "−N" chip reusing the
  delta-chip pattern, spawned on whichever fighter lost health between renders
  (computed in `main.js` at the render seam, the same way `moveTheMoney` diffs gold).
- The ⚔ "damage taken" glyph gets an explicit `.log__hit` span styling (small, inked,
  spaced) so it cannot scan as a multiplication sign; the accessible text is unchanged.

### D6. Onboarding overlay

A one-time intro overlay on first page load (not per restart — `newRun()` via the
Fight Again button skips it): parchment card over a dimmed scrim at `--z-modal`,
containing the wordmark title, the one-line premise, a three-step "how to fight"
(watch the sweep → Space/click to freeze → pick an action), and a single
`btn--commit` Start button. Built by `main.js` **outside `#app`** exactly like the
live regions, so renderers and the state machine are untouched. `role="dialog"`,
`aria-modal="true"`, focus moves to Start on open and to the hub on dismiss; Escape
also dismisses. Reduced motion: no entrance animation.
_Rejected:_ a real TITLE phase in `state.js` (touches the pure core for a
presentation concern); an inline hub banner (fails the "teach before the first
fight" requirement — the meter needs explaining before the player ever sees it).

### D7. Retire confirmation

Two-step arm/confirm on the same button, DOM-only in `main.js`: first activation
swaps the plank to an armed state ("Sure? Retiring ends the run") with `btn--danger`
skin; a second activation within 2.5s retires; the timer disarms it back. The arm is
announced through the existing polite region. A re-render (any other action)
naturally resets the armed state — acceptable, since any other action is itself a
"no".

### D8. Keyboard visibility + focus continuity

- Fight action buttons carry `<kbd class="key-hint">1</kbd>`–`4` (aria-hidden — the
  handlers, not the hints, are the mechanism; labels already name the actions).
  Hidden under `@media (pointer: coarse)`.
- After every `mount()`, `main.js` restores focus: if the previously-focused element
  carried a `data-action` that exists in the new DOM, focus it
  (`preventScroll: true`); else during FIGHT focus the meter. No behavior change for
  mouse users; keyboard users stop being dropped to `<body>` every turn.

### D9. Grounded disabled states, empty-log line, result hierarchy

- `button:disabled` and `.btn[aria-disabled='true']` keep a **fully opaque** plank:
  solid `--wood-4` ground, `--bone-dim` text, no shadow, `not-allowed` cursor —
  dimmed by ink, not by transparency, so the fixed backdrop can never bleed through.
  (`--bone-dim` on `--wood-4` is 6.43:1, documented in tokens.css.)
  `tests/styles.test.js`'s opacity-parity assertion is updated to hold the two dead
  states to the same _treatment_ rather than the same opacity literal.
- An empty combat log renders one placeholder entry ("The crowd gathers…", snark
  register, no turn stamp) so the strip never reads as a broken blank card.
- Result screen: the recap column caps the beaten poster at ~340px and centers it;
  the banner stamp takes `--text-4xl` on this screen and sits centered above the
  poster — verdict first, corpse second.

## 4. Architecture notes

- Everything stays in the existing three layers: render-to-string
  (`ui/render.js`/`ui/components.js`), DOM effects (`ui/effects.js`), orchestration
  (`main.js`). No new files except this spec and its plan.
- New presentation constants live beside their kin: beat length in `effects.js`
  (exported, mirrored by a token only if CSS needs it), overlay markup in `main.js`.
- CSS changes land in the file that owns the surface: `base.css` (disabled buttons,
  overlay scrim), `components.css` (poster strip variant, legend, key hints, hit
  flash), `screens.css` (sticky commit bar, HUD grid, short-viewport caps, fight grid
  order).

## 5. Testing

- **render.test.js / screens.test.js**: new DOM order of `renderFight`; legend markup
  replaces the label row; empty-log placeholder; kbd hints present and aria-hidden.
- **effects.test.js**: `hitFlash` and `spawnDamageChip` (fake timers, reduced-motion
  branches), input-guard behavior around the enemy beat.
- **main.test.js**: two-render sequencing (player render, then enemy render after the
  beat; single render under reduced motion); focus restoration; retire arm/confirm;
  overlay shown once and not after restart.
- **a11y.test.js**: overlay dialog semantics; hints aria-hidden; disabled treatment
  keeps text contrast ≥4.5:1.
- **styles.test.js / grid-areas.test.js**: updated for the sticky commit bar at all
  widths, the new fight area order, and the disabled-state treatment.
- Manual: browser-pane verification at 1280×720 and 375×812 — meter + actions above
  the fold on mobile; CTA visible on every screen; feedback beat legible.

## 6. Out of scope

Audio, persistence/save-slots, seed-entry UI, difficulty options, any balance or
combat-math change, canvas rendering, additional endings or content.
