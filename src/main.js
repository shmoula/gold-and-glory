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
import { mount, wire } from './ui/screens.js';

const app = document.getElementById('app');

let state;
let rng;
let meter = { running: false, pos: 0, t0: 0, period: 0, sweet: 0.5, captured: null, raf: 0 };

function newRun() {
  const seed = Math.floor(Math.random() * 1e9);
  state = createGameState(seed, CONFIG);
  rng = makeRng(seed);
  render();
}

function render() {
  mount(app, state, CONFIG);
  if (state.phase === PHASE.FIGHT) startMeter();
}

// --- Timing meter animation ---
function startMeter() {
  const bar = app.querySelector('[data-meter]');
  if (!bar) return;
  meter.running = true;
  meter.pos = 0;
  meter.t0 = performance.now();
  meter.period = meterPeriod(state.currentOpponentIndex, CONFIG);
  // The zones are drawn from this same field (renderFight), so the bright band and the
  // resolver can never disagree about where the sweet spot is this turn.
  meter.sweet = state.combat.sweet ?? 0.5;
  meter.captured = null;
  bar.addEventListener('click', captureMeter, { once: false });

  const cursor = bar.querySelector('.meter-cursor');
  function step() {
    if (!meter.running) return;
    meter.pos = meterPosition(performance.now() - meter.t0, meter.period);
    cursor.style.transform = `translateX(${meter.pos * bar.clientWidth}px)`;
    meter.raf = requestAnimationFrame(step);
  }
  meter.raf = requestAnimationFrame(step);
}

function captureMeter() {
  // The freeze: once the sweep stops, later time must not leak into the captured position.
  if (!meter.running) return;
  meter.running = false;
  cancelAnimationFrame(meter.raf);
  // Spec §6.4 step 1: derive p from the capture timestamp, never from the last painted
  // frame. Reading back meter.pos throws away the click's sub-frame timing, and returns 0
  // outright in any environment that paints no frames.
  meter.captured = meterPosition(performance.now() - meter.t0, meter.period);
  meter.pos = meter.captured;
  const bar = app.querySelector('[data-meter]');
  if (bar) bar.classList.add('is-captured'); // cursor stays put — the freeze IS the feedback
}

// The run's seeded generator drives the sweet spot, so a replayed seed replays the same fight.
function seedSweet() {
  return sweetCenter(rng(), CONFIG);
}

function currentTiming() {
  // If the player never clicked the meter, treat it as a miss.
  if (meter.captured == null) return 'miss';
  const eff = effectiveStats(state, CONFIG);
  const width = timingWindowWidth(eff.speed, CONFIG);
  const dist = meterDistance(meter.captured, meter.sweet);
  return resolveTiming(dist, width, CONFIG, eff.critWindowMult);
}

// --- Combat turn flow ---
function doPlayerAction(action) {
  const timing = currentTiming();
  let combat = applyPlayerAction(state.combat, action, timing, CONFIG);
  combat = markPressable(combat, action, timing);
  state = { ...state, combat };

  if (isFightOver(state.combat)) return endFight();
  if (state.combat.canPress) { render(); return; } // offer press before enemy acts
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
const KEYS = { ' ': 'meter', 1: 'strike', 2: 'heavy', 3: 'block', 4: 'feint' };
document.addEventListener('keydown', (e) => {
  if (state.phase !== PHASE.FIGHT || e.repeat) return;
  const k = KEYS[e.key];
  if (!k) return;
  e.preventDefault();
  if (k === 'meter') captureMeter();
  else handlers[k]?.();
});

newRun();
