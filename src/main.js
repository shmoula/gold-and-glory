// src/main.js
import { CONFIG } from './config.js';
import { createGameState, transition, PHASE } from './state.js';
import { makeRng } from './rng.js';
import {
  effectiveStats,
  playerHealth,
  trainStat,
  repairWeapon,
  healInjuries,
  buyGear,
  bribeOfficial,
  startFight,
  resolveFightOutcome,
  // Freed for the handler table: `handlers.retire` arms and confirms (phase 4 D7), and the
  // pure state transition keeps its own name there.
  retire as retireRun,
} from './game.js';
import {
  resolveTiming,
  timingWindowWidth,
  applyPlayerAction,
  applyPress,
  enemyTurn,
  isFightOver,
  fightWinner,
  markPressable,
} from './combat.js';
import { meterDistance, meterPosition, meterPeriod, sweetCenter } from './ui/timing.js';
import { logEntryText } from './ui/components.js';
import { ledgerSummary, gameoverSummary } from './ui/render.js';
import {
  runLedgerTheater,
  spawnDeltaChip,
  spawnShortfallChip,
  purseShake,
  tickTo,
  hitFlash,
  spawnDamageChip,
  reducedMotion,
  ENEMY_BEAT_MS,
} from './ui/effects.js';
import { mount, wire } from './ui/screens.js';

const app = document.getElementById('app');

// Spec §8: a dynamic announcement must be spoken politely, exactly once. Nothing a renderer
// emits can do it — mount() replaces #app wholesale, so any live region inside a screen is a
// brand-new node every render, arriving with its text already inside it, and assistive tech
// announces nothing at all. A region built once here, outside #app and never re-created, turns
// each write into a genuine content change in a region the screen reader already knows about.
// Every announcement in this file goes through one of these; none is ever emitted as markup.
function liveRegion(id) {
  const el = document.createElement('div');
  el.id = id;
  el.className = 'sr-only';
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  document.body.appendChild(el);
  return el;
}
const announcer = liveRegion('log-announcer');
// Spec §8 wants the ledger announced too, and it needs a region of its own rather than a share
// of the one above. Both fire in the same tick when a fight ends — endFight() speaks the killing
// blow, then the result screen renders — and an `aria-atomic` region only ever holds one message,
// so the ledger would overwrite the exchange that decided the bout before it was ever spoken.
// Two regions means two queued utterances instead of one clobbered pair.
const ledgerAnnouncer = liveRegion('ledger-announcer');
// How many log lines have already been spoken. One exchange pushes two entries (three with a
// press), so this speaks the turn that just happened rather than re-reading all eight rows.
let announced = 0;
// The result already announced, held by identity. Every bout produces a fresh `lastResult`
// object, so this re-arms itself for the next ledger while making a re-render of the screen
// already up — a spend, a superseding render — not news worth speaking twice.
let announcedResult = null;
// The ending spoken this run. A boolean, not an identity guard: `state.ended` is set once per
// run and never changes until newRun(), so "already spoken" is the only state to track.
let announcedEnding = false;

let state;
let rng;
// The purse as it stood before the current render. Spec §6.7 wants money *seen* to move, and
// the only place that knows both the old number and the new one is the seam between two
// renders — the renderer is handed one state and no history. `null` means "no previous render
// to compare against", which is why a fresh run opens without a chip firing at its own purse.
let lastGold = null;
// The count still running against the last render's (now detached) purse. Finished before a
// new one starts, so two tickers can never write to one number.
let purseTicker = () => {};
// The ledger sequence still running against the last render's (now detached) rows, retained for
// exactly the same reason as `purseTicker` above: its timers outlive the DOM they were aimed at.
// Discarding it left a superseded theater counting rows nothing can see, and let two theaters
// run at once. Retired at the top of render(), before anything can replace what it writes to.
let ledgerTheater = () => {};
// The live sweep. Named `sweep`, not `meter`, because `meter()` is the mandated bar helper in
// ui/components.js and a module-scope shadow of it invites a call site to render a bar from this.
const sweep = { running: false, t0: 0, period: 0, sweet: 0, captured: null, raf: 0 };
// Phase 4 (D5): the exchange lands in two renders — the player's, then the enemy's one beat
// later — so the reply reads as an event instead of a simultaneous ledger update. `resolving`
// is the guard between them: the pure core still runs the same calls in the same order, so a
// click smuggled into the beat could not corrupt anything, but it *would* act on a turn the
// player has not seen yet. Checked by the action handlers and the document keydown; render()
// also skips startMeter() while it stands, so the waiting beat reads as the foe's wind-up.
let resolving = false;
let enemyTimer = 0;
// Phase 4 (D7): the one-click run-ender arms first. DOM-only state — any other action
// re-renders the hub and thereby disarms, which is correct: any other action is itself a
// "no". The window is generous enough to read the new copy, short enough that a plank armed
// by a stray click does not lie in wait across the whole visit.
const RETIRE_DISARM_MS = 2500;
let retireTimer = 0;

// The cursor is the only thing that moves, and it moves the same way from the rAF loop and from
// the freeze, so both go through here — otherwise the frozen cursor sits at the last painted
// frame while the fight resolves a position up to a frame away from it.
function paintCursor(bar, cursor, p) {
  cursor.style.transform = `translateX(${p * bar.clientWidth}px)`;
}

function newRun() {
  const seed = Math.floor(Math.random() * 1e9);
  state = createGameState(seed, CONFIG);
  rng = makeRng(seed);
  // A new run is not a transaction: the old run's purse must not spawn a chip against it.
  lastGold = null;
  announcedEnding = false;
  // Nor is it mid-exchange: a beat scheduled by the old run must not land in the new one.
  clearTimeout(enemyTimer);
  resolving = false;
  // An armed retire from the old run has nothing left to disarm.
  clearTimeout(retireTimer);
  render();
}

function render() {
  const previousGold = lastGold;
  // Phase 4 (D8): mount() replaces #app wholesale, which dropped focus to <body> on every
  // action — a keyboard user had to re-tab to the meter each exchange. Remember what was
  // focused by its stable hook (data-action / the meter) and restore it in the new tree.
  const active = document.activeElement;
  const focusKey =
    active && app.contains(active)
      ? active.hasAttribute('data-meter')
        ? 'meter'
        : active.getAttribute('data-action')
      : null;
  // Retire the outgoing theater before its rows are replaced: finishing it writes every posted
  // figure one last time and clears the timers that would otherwise keep counting on detached
  // rows. Cheap and idempotent when there was no theater running.
  ledgerTheater();
  ledgerTheater = () => {};
  // The third animation handle, retired on the same seam and for the same reason. A bout that
  // ends with the meter never captured leaves the sweep still running, and mount() below is
  // about to detach the bar it paints: without this the loop reschedules itself forever on the
  // result or game-over screen, and only the *next* startMeter() would ever reach it. FIGHT
  // renders start it again a few lines down, so stopping it unconditionally costs nothing.
  stopSweep();
  mount(app, state, CONFIG);
  lastGold = state.gold;
  // Spec §6.9: the newest entry is appended at the bottom and auto-scrolled to. mount() has
  // just rebuilt the strip, so its scrollTop is 0 again and the tail is below the fold; the
  // renderer only emits strings, so the one line of DOM work belongs here.
  const log = app.querySelector('.log');
  if (log) log.scrollTop = log.scrollHeight;
  moveTheMoney(previousGold);
  announceTurn();
  if (state.phase === PHASE.FIGHT && !resolving) startMeter();
  // Spec §6.6: the ledger tallies itself one beat at a time, and a click anywhere on the
  // screen — not just on the card — skips to the final state. The renderer emits the rows
  // already hidden and already carrying their final values, so a run with no JS theater at
  // all (or a reduced-motion one) still reads a complete, correct ledger.
  if (state.phase === PHASE.RESULT) {
    announceLedger();
    ledgerTheater = runLedgerTheater(app.querySelector('.screen--result'));
  }
  if (state.phase === PHASE.GAMEOVER) announceEnding();
  restoreFocus(focusKey);
}

// The tail of render(): put focus back where the player had it, in the tree that replaced the
// one it was in. Nothing focused inside #app means nothing to restore — a mouse user's focus
// on <body> is never stolen. A fight falls back to the meter when the old control is gone (an
// action plank during the enemy beat, a press offer that resolved): the meter is the next
// required act. preventScroll, because a restore is not a navigation.
function restoreFocus(key) {
  if (!key) return;
  const el =
    key === 'meter'
      ? app.querySelector('[data-meter]')
      : app.querySelector(`[data-action="${key}"]:not([disabled])`);
  const target = el ?? (state.phase === PHASE.FIGHT ? app.querySelector('[data-meter]') : null);
  target?.focus({ preventScroll: true });
}

// Spec §6.7: every gold change is announced by the purse itself — the number counts toward its
// new value and a signed chip falls beside it. Both are pure DOM work over two numbers, so
// they live here rather than in a renderer that is handed only the current state.
function moveTheMoney(previousGold) {
  // Retire the outgoing count first, whatever this render turns out to be: mount() has already
  // detached the node it was writing to. This used to sit below the guard, so a render that
  // moved no gold left it counting into nothing.
  purseTicker();
  purseTicker = () => {};
  // Every screen carries the beam now, GAMEOVER included (§6.1), so the purse that fattens on
  // the winning blow of the last bout counts up on the ending screen like any other. The guard
  // stays: a screen without a HUD must not take the ticker down with it.
  const purse = app.querySelector('.hud__purse');
  if (!purse || previousGold == null || previousGold === state.gold) return;
  purseTicker = tickTo(purse.querySelector('.ticker'), previousGold, state.gold);
  spawnDeltaChip(purse, state.gold - previousGold);
}

// Speak the lines pushed since the last announcement — one exchange's worth. The count follows
// the log's own length, so the result screen (which has no combat at all) resets it and the
// next fight starts announcing from its own first line.
function announceTurn() {
  const log = state.combat?.log ?? [];
  const fresh = log.slice(announced);
  announced = log.length;
  if (fresh.length) announcer.textContent = fresh.map(logEntryText).join(' ');
}

// The ledger, spoken once per result. The renderer hands over the string and nothing else: the
// region it lands in was built before the screen existed and is never re-created, which is the
// only arrangement assistive tech treats as a content change (see the note on ledgerSummary).
function announceLedger() {
  const result = state.lastResult;
  if (!result || result === announcedResult) return;
  announcedResult = result;
  ledgerAnnouncer.textContent = ledgerSummary(state, CONFIG);
}

// The ending, spoken once per run through the ledger's region — which is free on GAMEOVER
// (no ledger renders there), while #log-announcer is busy with the killing blow in the same
// tick. See gameoverSummary in ui/render.js for why the renderer only exports the string.
function announceEnding() {
  if (announcedEnding) return;
  announcedEnding = true;
  ledgerAnnouncer.textContent = gameoverSummary(state, CONFIG);
}

// --- Timing meter animation ---
// The one way the loop is retired. `running` is what stops a step already in flight from
// rescheduling; the cancel is what takes the frame that is already queued. Clearing only one of
// them leaves either an orphan frame or a chain that revives itself, which is why both live here
// rather than being spelled out at each of the three call sites.
function stopSweep() {
  sweep.running = false;
  cancelAnimationFrame(sweep.raf);
}

function startMeter() {
  // Kill the outgoing loop before starting a new one. Every render during FIGHT lands here, so
  // without this each turn leaves another rAF chain alive; they all share this one mutable
  // sweep object and stomp sweep.raf, leaving captureMeter's cancel able to reach only the
  // last writer while the rest keep stepping.
  stopSweep();
  const bar = app.querySelector('[data-meter]');
  if (!bar) return;
  sweep.running = true;
  sweep.t0 = performance.now();
  sweep.period = meterPeriod(state.currentOpponentIndex, CONFIG);
  // The zones are drawn from this same field (renderFight), so the bright band and the
  // resolver can never disagree about where the sweet spot is this turn.
  sweep.sweet = state.combat.sweet;
  sweep.captured = null;
  bar.addEventListener('click', captureMeter, { once: false });
  // Spec §8: the meter is a keyboard target in its own right. Space is claimed document-wide,
  // but a focused meter must also answer Enter, the generic activation key.
  bar.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.repeat) return;
    e.preventDefault();
    captureMeter();
  });

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
  sweep.raf = requestAnimationFrame(step);
}

// Where the verdict stamp is *drawn*, which is not always where the strike *landed*. The stamp
// is a run of display type centred on the captured position, and `stamp-in` opens it at 1.5×:
// measured at 375px (a 16px .screen gutter each side), an unclamped
// `MISS!` captured at track position 0 opens 1.2px off the left edge and `GRAZE!` at position 1
// runs 8.1px past the right, clipping a glyph for the opening beats. Transforms create no
// scrollable overflow, so nothing else would ever report this.
//
// The clamp is presentational and belongs to the stamp ALONE. Never apply it to `.meter-cursor`:
// the frozen cursor is the player's only readout of the position the game actually judged, and a
// cursor that lied about the last 6% of the track would break the calibration the freeze exists
// for. A centre capture is untouched — the sweet spot band lives at 0.35–0.75.
const STAMP_EDGE = 0.06;
const stampPosition = (p) => Math.min(Math.max(p, STAMP_EDGE), 1 - STAMP_EDGE);

function captureMeter() {
  // The freeze: once the sweep stops, later time must not leak into the captured position.
  if (!sweep.running) return;
  stopSweep();
  // Spec §6.4 step 1: derive p from the capture timestamp, never from the last painted
  // frame. Reading back the last painted position throws away the click's sub-frame timing,
  // and returns 0 outright in any environment that paints no frames.
  sweep.captured = meterPosition(performance.now() - sweep.t0, sweep.period);
  const bar = app.querySelector('[data-meter]');
  if (!bar) return;
  // Park the cursor on the position that actually resolved, not on the last frame painted
  // before the click. The freeze IS the feedback, so it has to show what the game judged.
  const cursor = bar.querySelector('.meter-cursor');
  if (cursor) paintCursor(bar, cursor, sweep.captured);
  bar.classList.add('is-captured');
  // Spec §6.4 steps 2–3, the behavioral half: the freeze is how players calibrate their timing,
  // so the verdict shows AT the freeze, not after the action resolves. currentTiming() reads the
  // same captured position the resolver will read, so the stamp can never disagree with the log
  // line that follows. A miss lands outside every band and therefore flashes nothing — the
  // absence IS the reading. aria-hidden: announceTurn speaks the verdict; the stamp is the
  // visual channel. The chicken drop (§6.4's asset half) joins in Phase 3.
  // No cleanup: every action re-renders the fight through mount(), which rebuilds the meter
  // without a stamp and without the flash class.
  const verdict = currentTiming();
  const zone = bar.querySelector(`.meter__zone--${verdict}`);
  if (zone) zone.classList.add('is-flashing');
  const stamp = document.createElement('span');
  stamp.className = 'meter__stamp';
  stamp.setAttribute('aria-hidden', 'true');
  stamp.textContent = `${verdict.toUpperCase()}!`;
  stamp.style.left = `${(stampPosition(sweep.captured) * 100).toFixed(2)}%`;
  bar.appendChild(stamp);
}

// The run's seeded generator drives the sweet spot, so a replayed seed replays the same fight.
function seedSweet() {
  return sweetCenter(rng(), CONFIG);
}

function currentTiming() {
  // If the player never clicked the meter, treat it as a miss.
  if (sweep.captured == null) return 'miss';
  const eff = effectiveStats(state, CONFIG);
  const width = timingWindowWidth(eff.speed, CONFIG);
  const dist = meterDistance(sweep.captured, sweep.sweet);
  return resolveTiming(dist, width, CONFIG, eff.critWindowMult);
}

// --- Combat turn flow ---
// Feedback on the fighter who just lost health, read at the render seam — the renderer is
// handed one state and no history, so the diff lives here, exactly the moveTheMoney
// arrangement. Called after render(), so the poster it decorates is the freshly mounted one.
function strikeFeedback(lost, posterSel) {
  if (!(lost > 0)) return;
  const poster = app.querySelector(`${posterSel} .poster`);
  if (!poster) return;
  hitFlash(poster);
  spawnDamageChip(poster, lost);
}

// The waiting beat (phase 4 D5): the player's render is up, the enemy replies after
// ENEMY_BEAT_MS. The meter is not sweeping (render() skipped startMeter under `resolving`)
// and the four actions are dead planks, so the pause reads as the foe's wind-up rather than
// an unresponsive screen. Reduced motion collapses the beat to the next tick — one render
// per state like every other reduced animation, but through the same code path.
function scheduleEnemy() {
  for (const b of app.querySelectorAll('.fight__grid .btn')) b.disabled = true;
  enemyTimer = setTimeout(
    () => {
      resolving = false;
      enemyResponds();
    },
    reducedMotion() ? 0 : ENEMY_BEAT_MS
  );
}

function doPlayerAction(action) {
  if (resolving) return;
  const foeBefore = state.combat.enemy.health;
  const timing = currentTiming();
  let combat = applyPlayerAction(state.combat, action, timing, CONFIG);
  combat = markPressable(combat, action, timing);
  state = { ...state, combat };

  if (isFightOver(state.combat)) return endFight();
  if (state.combat.canPress) {
    // Offer the press before the enemy acts, but re-seed first. This is the one re-render
    // that skips enemyResponds, and without its own seed the press turn would reuse the
    // previous turn's sweet spot: identical zones, memorised timing, free crit.
    state = { ...state, combat: { ...state.combat, sweet: seedSweet() } };
    render();
    strikeFeedback(foeBefore - state.combat.enemy.health, '.fight__foe');
    return;
  }
  resolving = true;
  render();
  strikeFeedback(foeBefore - state.combat.enemy.health, '.fight__foe');
  scheduleEnemy();
}

function doPress() {
  if (resolving) return;
  const foeBefore = state.combat.enemy.health;
  const timing = currentTiming();
  let combat = applyPress(state.combat, timing, CONFIG);
  combat = { ...combat, canPress: false };
  state = { ...state, combat };
  if (isFightOver(state.combat)) return endFight();
  resolving = true;
  render();
  strikeFeedback(foeBefore - state.combat.enemy.health, '.fight__foe');
  scheduleEnemy();
}

function enemyResponds() {
  const mineBefore = playerHealth(state).value;
  const combat = enemyTurn(state.combat, rng, CONFIG);
  // A fresh sweet spot for the turn we are handing back to the player, so timing has to be
  // re-read every turn instead of memorised once. Seeded from the run's rng, so replays match.
  state = { ...state, combat: { ...combat, sweet: seedSweet() } };
  if (isFightOver(state.combat)) return endFight();
  render();
  strikeFeedback(mineBefore - playerHealth(state).value, '.fight__you');
}

function endFight() {
  const won = fightWinner(state.combat) === 'player';
  // Speak the killing blow while the log still exists: resolveFightOutcome clears `combat`,
  // so by the time the result screen renders there is nothing left to announce and the
  // exchange that decided the fight would be the one exchange never read out.
  announceTurn();
  state = resolveFightOutcome(state, won, rng, CONFIG);
  render();
}

// --- Action handlers ---
// Spec §6.2 keeps an unaffordable button enabled and clickable — "the game *tells* you you're
// broke rather than hiding the option" — so every commerce action goes through here and the
// rejection is spoken by the purse (§6.7): a 3-frame shake plus the shortfall the button is
// already carrying in `data-missing`. Without this, the one thing a player can do while broke
// produces no feedback whatsoever, because the state is identical and nothing re-renders.
// Refusal is detected by identity, not by an unchanged purse: game.js returns the *same* state
// object when it declines, and a spend that moves the model without moving gold (a zero-cost
// action, a non-monetary one) would otherwise be applied to the model and never drawn.
const commerce = (spend) => (el) => {
  const next = spend(state);
  if (next !== state) {
    state = next;
    render();
    return;
  }
  const purse = app.querySelector('.hud__purse');
  purseShake(purse);
  const missing = el?.getAttribute('data-missing');
  if (purse && missing) spawnShortfallChip(purse, missing);
};

const handlers = {
  'train-power': commerce((s) => trainStat(s, 'power', CONFIG)),
  'train-guard': commerce((s) => trainStat(s, 'guard', CONFIG)),
  'train-speed': commerce((s) => trainStat(s, 'speed', CONFIG)),
  repair: commerce((s) => repairWeapon(s, CONFIG)),
  heal: commerce((s) => healInjuries(s, CONFIG)),
  'buy-shield': commerce((s) => buyGear(s, 'shield', CONFIG)),
  'buy-blade': commerce((s) => buyGear(s, 'blade', CONFIG)),
  'buy-charm': commerce((s) => buyGear(s, 'charm', CONFIG)),
  bribe: commerce((s) => bribeOfficial(s, CONFIG)),
  'next-fight': () => {
    state = startFight(state, CONFIG);
    state = { ...state, combat: { ...state.combat, sweet: seedSweet() } };
    render();
  },
  // Two-step retire (phase 4 D7): the audit ended a run with one stray click on what is the
  // most destructive control in the game. First activation arms the plank in place — danger
  // skin, plain question — and speaks it politely; the second within the window retires. The
  // disarm is a plain render(): the renderer redraws the button from state, which knows
  // nothing of the arm, so the plank reverts by construction.
  retire: (el) => {
    if (!el.classList.contains('is-armed')) {
      el.classList.add('is-armed', 'btn--danger');
      el.textContent = 'Sure? Retiring ends the run';
      announcer.textContent = 'Press again to retire and end the run.';
      clearTimeout(retireTimer);
      retireTimer = setTimeout(() => render(), RETIRE_DISARM_MS);
      return;
    }
    clearTimeout(retireTimer);
    state = retireRun(state);
    render();
  },
  strike: () => doPlayerAction('strike'),
  heavy: () => doPlayerAction('heavy'),
  block: () => doPlayerAction('block'),
  feint: () => doPlayerAction('feint'),
  press: () => doPress(),
  'to-hub': () => {
    state = transition(state, PHASE.HUB);
    render();
  },
  restart: () => newRun(),
};

wire(app, handlers);

// Keyboard parity, spec §8: Space works the meter, 1-4 pick the action. Bound once, on the
// document, because the fight markup is replaced wholesale on every render.
const METER_KEY = ' ';
// Null-prototype: the lookup is keyed by an untrusted `event.key`, and a plain literal would
// answer 'constructor' or 'toString' with an inherited function this then calls.
const KEYS = Object.assign(Object.create(null), {
  [METER_KEY]: captureMeter,
  1: handlers.strike,
  2: handlers.heavy,
  3: handlers.block,
  4: handlers.feint,
});
// Space is also a focused button's own activation key. Claiming it for the meter regardless of
// focus leaves a keyboard user parked on Strike unable to strike, which fails spec §8's floor,
// so when focus is on something that answers to Space, the meter stands down. The digits are
// not contested by any control the fight screen renders, so they keep their binding.
const INTERACTIVE = 'button, a[href], input, select, textarea, [contenteditable="true"]';
const inInteractive = (target) =>
  typeof target?.closest === 'function' && target.closest(INTERACTIVE) !== null;

document.addEventListener('keydown', (e) => {
  // The enemy's beat is nobody's turn (phase 4 D5): the same guard the click handlers apply.
  if (state.phase !== PHASE.FIGHT || e.repeat || resolving) return;
  const run = KEYS[e.key];
  if (!run) return;
  if (e.key === METER_KEY && inInteractive(e.target)) return;
  e.preventDefault();
  run();
});

newRun();

// Phase 4 (D6): the one-time intro. Outside #app like the live regions, so renderers and the
// state machine stay untouched; once per page load, not per run — Fight Again's newRun()
// never re-creates it. The audit's finding: the game dropped a new player into a dense hub
// with 100 G and no framing, and nothing ever explained the two-step combat interaction
// (freeze the meter, then pick an action) — clicking Strike cold resolves as a silent miss.
function showIntro() {
  const scrim = document.createElement('div');
  scrim.className = 'intro-scrim';
  scrim.innerHTML = `
    <section class="intro parchment tape" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <h1 id="intro-title">Gold &amp; Glory</h1>
      <p class="snark intro__premise">(Death or glory, and a small administrative fee.)</p>
      <ol class="intro__steps">
        <li>Watch the chicken sweep the meter.</li>
        <li>Click, tap or press <kbd class="key-hint">Space</kbd> to freeze it &mdash; land on the gold.</li>
        <li>Pick an action: <b>Strike</b>, <b>Heavy</b>, <b>Block</b> or <b>Feint</b>.</li>
      </ol>
      <p class="snark">(Win purses. The arena taxes them. Everything else costs gold.)</p>
      <button class="btn btn--commit" data-intro-start>Enter the Arena ▸</button>
    </section>`;
  document.body.appendChild(scrim);
  const start = scrim.querySelector('[data-intro-start]');
  const onKey = (e) => {
    if (e.key === 'Escape') return close();
    // One focusable control: the dialog's whole tab ring is the Start button.
    if (e.key === 'Tab') {
      e.preventDefault();
      start.focus();
    }
  };
  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    scrim.remove();
    app.querySelector('[data-action="next-fight"]')?.focus({ preventScroll: true });
  };
  start.addEventListener('click', close);
  // Capture phase: the fight-keys listener above also lives on the document, and the dialog
  // must answer first. The game is HUB-phased under the intro so nothing contests it today —
  // capture keeps that true if the boot flow ever changes.
  document.addEventListener('keydown', onKey, true);
  start.focus();
}
showIntro();
