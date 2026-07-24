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
import { meterDistance, meterPosition, meterPeriod } from './ui/render.js';
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
  meter.sweet = 0.5;
  meter.captured = null;
  bar.querySelector('.meter-sweet').style.left = `${meter.sweet * 100}%`;
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
  if (!meter.running) return;
  meter.running = false;
  cancelAnimationFrame(meter.raf);
  meter.captured = meter.pos;
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
  state = { ...state, combat };
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
  'next-fight': () => { state = startFight(state, CONFIG); render(); },
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
newRun();
