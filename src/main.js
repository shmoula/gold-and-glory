// src/main.js
import { CONFIG } from './config.js';
import { createGameState, transition, PHASE } from './state.js';
import { makeRng } from './rng.js';
import {
  effectiveStats, trainStat, repairWeapon, healInjuries, buyGear, bribeOfficial,
  startFight, resolveFightOutcome, retire,
} from './game.js';
import {
  resolveTiming, timingWindowWidth, applyPlayerAction, applyPress,
  enemyTurn, isFightOver, fightWinner, markPressable,
} from './combat.js';
import { meterDistance, meterPosition, meterPeriod, sweetCenter } from './ui/timing.js';
import { logEntryText } from './ui/components.js';
import { mount, wire } from './ui/screens.js';

const app = document.getElementById('app');

// Spec §6.9/§8: a turn must be announced politely, exactly once. The `aria-live` the fight
// screen puts on the strip cannot do it — mount() replaces #app wholesale, so that region is a
// brand-new node every render and assistive tech announces nothing at all. This one is built
// once, lives outside #app, and is never re-created, so writing to it is a genuine content
// change in a region the screen reader already knows about.
const announcer = document.createElement('div');
announcer.id = 'log-announcer';
announcer.className = 'sr-only';
announcer.setAttribute('aria-live', 'polite');
announcer.setAttribute('aria-atomic', 'true');
document.body.appendChild(announcer);
// How many log lines have already been spoken. One exchange pushes two entries (three with a
// press), so this speaks the turn that just happened rather than re-reading all eight rows.
let announced = 0;

let state;
let rng;
// The live sweep. Named `sweep`, not `meter`, because `meter()` is the mandated bar helper in
// ui/components.js and a module-scope shadow of it invites a call site to render a bar from this.
const sweep = { running: false, t0: 0, period: 0, sweet: 0, captured: null, raf: 0 };

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
  render();
}

function render() {
  mount(app, state, CONFIG);
  // Spec §6.9: the newest entry is appended at the bottom and auto-scrolled to. mount() has
  // just rebuilt the strip, so its scrollTop is 0 again and the tail is below the fold; the
  // renderer only emits strings, so the one line of DOM work belongs here.
  const log = app.querySelector('.log');
  if (log) log.scrollTop = log.scrollHeight;
  announceTurn();
  if (state.phase === PHASE.FIGHT) startMeter();
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

// --- Timing meter animation ---
function startMeter() {
  // Kill the outgoing loop before starting a new one. Every render during FIGHT lands here, so
  // without this each turn leaves another rAF chain alive; they all share this one mutable
  // sweep object and stomp sweep.raf, leaving captureMeter's cancel able to reach only the
  // last writer while the rest keep stepping.
  cancelAnimationFrame(sweep.raf);
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
  function step() {
    if (!sweep.running) return;
    paintCursor(bar, cursor, meterPosition(performance.now() - sweep.t0, sweep.period));
    sweep.raf = requestAnimationFrame(step);
  }
  sweep.raf = requestAnimationFrame(step);
}

function captureMeter() {
  // The freeze: once the sweep stops, later time must not leak into the captured position.
  if (!sweep.running) return;
  sweep.running = false;
  cancelAnimationFrame(sweep.raf);
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
function doPlayerAction(action) {
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
    return;
  }
  enemyResponds();
}

function doPress() {
  const timing = currentTiming();
  let combat = applyPress(state.combat, timing, CONFIG);
  combat = { ...combat, canPress: false };
  state = { ...state, combat };
  if (isFightOver(state.combat)) return endFight();
  enemyResponds();
}

function enemyResponds() {
  const combat = enemyTurn(state.combat, rng, CONFIG);
  // A fresh sweet spot for the turn we are handing back to the player, so timing has to be
  // re-read every turn instead of memorised once. Seeded from the run's rng, so replays match.
  state = { ...state, combat: { ...combat, sweet: seedSweet() } };
  if (isFightOver(state.combat)) return endFight();
  render();
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
const handlers = {
  'train-power': () => { state = trainStat(state, 'power', CONFIG); render(); },
  'train-guard': () => { state = trainStat(state, 'guard', CONFIG); render(); },
  'train-speed': () => { state = trainStat(state, 'speed', CONFIG); render(); },
  repair: () => { state = repairWeapon(state, CONFIG); render(); },
  heal: () => { state = healInjuries(state, CONFIG); render(); },
  'buy-shield': () => { state = buyGear(state, 'shield', CONFIG); render(); },
  'buy-blade': () => { state = buyGear(state, 'blade', CONFIG); render(); },
  'buy-charm': () => { state = buyGear(state, 'charm', CONFIG); render(); },
  bribe: () => { state = bribeOfficial(state, CONFIG); render(); },
  'next-fight': () => {
    state = startFight(state, CONFIG);
    state = { ...state, combat: { ...state.combat, sweet: seedSweet() } };
    render();
  },
  retire: () => { state = retire(state); render(); },
  strike: () => doPlayerAction('strike'),
  heavy: () => doPlayerAction('heavy'),
  block: () => doPlayerAction('block'),
  feint: () => doPlayerAction('feint'),
  press: () => doPress(),
  'to-hub': () => { state = transition(state, PHASE.HUB); render(); },
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
  if (state.phase !== PHASE.FIGHT || e.repeat) return;
  const run = KEYS[e.key];
  if (!run) return;
  if (e.key === METER_KEY && inInteractive(e.target)) return;
  e.preventDefault();
  run();
});

newRun();
