// src/ui/render.js - screens only. The shared vocabulary lives in ./components.js and the
// timing-meter math in ./timing.js; both are re-exported below so existing importers (and the
// render tests) keep their single entry point.
import { trainingCost, repairCost, healCost } from '../economy.js';
import { effectiveStats } from '../game.js';
import { timingWindowWidth } from '../combat.js';
import { formatGold } from './format.js';
import {
  URGENT_FRACTION, REPAIR_URGENT_FRACTION,
  escapeHtml, btn, meter, bar, poster, shopItem,
} from './components.js';
import { meterZones } from './timing.js';

export {
  URGENT_FRACTION, REPAIR_URGENT_FRACTION,
  escapeHtml, shortfallAttr, snarkAside, btn, fillPct, meter, bar, poster, shopItem,
} from './components.js';
export { meterDistance, meterPosition, meterPeriod, meterZones, sweetCenter } from './timing.js';

// Presentation constants (not game tuning — they belong to the HUD, not config.js).
// The pip row always reserves this many slots so it does not resize as injuries accrue.
const PIP_MIN_SLOTS = 5;
// Training meters need *a* full mark to draw against, but stats are uncapped by design.
// This is a display denominator only — it is never exposed to assistive tech as a real
// maximum (the training meter is presentational; the row label carries the true number).
const TRAIN_METER_CAP = 50;

export function renderHud(state, config) {
  const pipCount = Math.max(PIP_MIN_SLOTS, state.injuries);
  const pips = Array.from({ length: pipCount }, (_, i) =>
    `<i class="pip${i < state.injuries ? ' pip--filled' : ''}"></i>`).join('');
  return `
    <header class="hud">
      <span class="hud__purse"><i class="coin"></i>Gold: <span class="ticker" data-value="${state.gold}">${formatGold(state.gold)}</span></span>
      ${bar('Health', state.health, state.maxHealth, { urgent: state.health / state.maxHealth < URGENT_FRACTION })}
      ${bar('Durability', state.weaponDurability, config.weapon.maxDurability, { fillClass: ' bar__fill--dur' })}
      <span class="hud__stat"><span class="hud__label">Injuries</span>
        <span class="pips" role="img" aria-label="${state.injuries} ${state.injuries === 1 ? 'injury' : 'injuries'}">${pips}</span></span>
    </header>`;
}

export function renderHub(state, config) {
  const eff = effectiveStats(state, config);
  const missing = config.weapon.maxDurability - state.weaponDurability;
  const opponent = config.opponents[state.currentOpponentIndex];
  // One predicate for Heal: it is urgent exactly when it is not a no-op.
  const hurt = state.injuries > 0;

  // Spec §6.11: one label format per row, the meter beside it, the priced button at the end.
  // The meter is decorative: TRAIN_METER_CAP is a drawing denominator, not a real maximum.
  const trainRows = ['power', 'guard', 'speed'].map((stat) => {
    const cost = trainingCost(state.trainingLevels[stat], config);
    return `<div class="train-row">
      <span class="train-row__label">${stat[0].toUpperCase() + stat.slice(1)} ${eff[stat]}</span>
      ${meter(`${stat} training`, eff[stat], TRAIN_METER_CAP,
        { fillClass: ' bar__fill--dur', barClass: 'train-row__meter', decorative: true })}
      ${btn(`train-${stat}`, `Train +${config.training.statPerLevel}`, { cost, gold: state.gold })}
    </div>`;
  }).join('');

  const gearCards = Object.values(config.gear).map((g) => shopItem(g, {
    owned: state.gear.includes(g.id), gold: state.gold, snark: config.snark[g.id] ?? '',
  })).join('');

  const sponsorCard = state.sponsorUnlocked ? `<aside class="sponsor-card tape">
      <span class="sponsor-card__eyebrow">Sponsor</span>
      <h3 class="sponsor-card__name">Lord Biggus</h3>
      <p>Objective: ${escapeHtml(config.sponsor.objective)}</p>
      <p>Reward: <span class="amount amount--pos">${formatGold(config.sponsor.stipendPerFight + config.sponsor.objectiveBonus, { signed: true })}</span>
        <span class="snark">(${escapeHtml(config.snark.sponsorReward)})</span></p>
    </aside>` : '';

  return `
    ${renderHud(state, config)}
    <section class="screen screen--hub">
      <div class="hub__sinks">
        <h2>The Ludus</h2>
        <p>Wins: ${state.wins}</p>
        ${btn('repair', 'Repair weapon', { cost: repairCost(missing, config), gold: state.gold,
          snark: config.snark.repair,
          urgent: state.weaponDurability / config.weapon.maxDurability < REPAIR_URGENT_FRACTION,
          disabled: missing <= 0 })}
        ${btn('heal', `Heal ${state.injuries} injuries`, { cost: healCost(state.injuries, config),
          gold: state.gold, snark: config.snark.heal, urgent: hurt, disabled: !hurt })}
        ${state.bribedThisFight
          ? btn(null, 'Bribed ✓', { disabled: true })
          : btn('bribe', `Bribe official — tax ${config.arena.taxRate * 100}% → ${config.arena.bribedTaxRate * 100}%`,
              { cost: config.arena.bribeCost, gold: state.gold, snark: config.snark.bribe })}
      </div>
      <div class="hub__develop">
        <h2>Training</h2>
        ${trainRows}
        <h2>Gear shop</h2>
        <div class="hub__shop">${gearCards}</div>
        ${sponsorCard}
      </div>
      <div class="hub__fight">
        ${poster({ name: 'You', tilt: 1, hp: { value: state.health, max: state.maxHealth } })}
        <span class="hub__next-label">Next bout</span>
        ${poster({ name: opponent.name, tilt: 2,
          sub: `Tier: ${escapeHtml(opponent.tier)} · Purse: <span class="amount">${formatGold(opponent.purse)}</span>` })}
      </div>
      <div class="hub__retire">${btn('retire', 'Retire Rich', { variant: 'commit' })}</div>
      <div class="hub__commit commit-bar">${btn('next-fight', 'Next Fight ▸', { variant: 'commit' })}</div>
    </section>`;
}

export function renderResult(state, config) {
  const r = state.lastResult;
  const cls = r.won ? 'good' : 'danger';
  return `
    ${renderHud(state, config)}
    <section class="result ${cls}">
      <h2>${r.won ? 'VICTORY' : 'DEFEAT'} — ${escapeHtml(r.opponentName)}</h2>
      <p>${escapeHtml(r.commentary)}</p>
      ${r.won ? `<ul>
        <li>Purse: ${r.purse}g (tax ${r.tax}g)</li>
        ${r.sponsorIncome ? `<li>Sponsor: +${r.sponsorIncome}g</li>` : ''}
        <li><strong>Net: +${r.netGold}g</strong></li>
        <li>Weapon wear: -${r.durabilityLost} durability</li>
      </ul>` : `<ul>
        <li>Injuries gained: ${r.injuriesGained}</li>
        <li>Weapon wear: -${r.durabilityLost} durability</li>
      </ul>`}
      <button data-action="to-hub">Back to the Ludus</button>
    </section>`;
}

export function renderGameOver(state, config) {
  let body;
  if (state.ended === 'dead') {
    body = `<h2>YOU DIED</h2>
      <p class="cause">Cause of death: ${escapeHtml(state.lastResult.causeOfDeath)}</p>`;
  } else if (state.ended === 'win-circuit') {
    body = `<h2>CHAMPION OF THE CIRCUIT</h2>
      <p>You bribed, bled, and clawed your way to the top. Final purse: ${state.gold}g.</p>`;
  } else {
    body = `<h2>RETIRED RICH</h2>
      <p>You walked away with ${state.gold}g and all your limbs. Wise.</p>`;
  }
  return `
    <section class="gameover">
      ${body}
      <button data-action="restart">Fight again (new run)</button>
    </section>`;
}

// Spec §6.4: three nested bands drawn around this turn's sweet spot, weakest painted first so
// the bright crit band sits on top. Widths come from the *player's* window, so training Speed
// visibly widens the gold. The cursor is moved by main.js's rAF loop; nothing here animates.
function renderMeter(state, config) {
  const width = timingWindowWidth(effectiveStats(state, config).speed, config);
  const zones = meterZones(state.combat.sweet ?? 0.5, width, config);
  const pct = (x) => `${(x * 100).toFixed(2)}%`;
  const zone = (name) =>
    `<div class="meter__zone meter__zone--${name}" ` +
    `style="left:${pct(zones[name].start)};width:${pct(zones[name].size)}"></div>`;
  return `
      <div class="meter timing-meter" data-meter="1" role="application"
        aria-label="Timing meter \u2014 press Space or click to strike">
        ${zone('graze')}
        ${zone('hit')}
        ${zone('crit')}
        <div class="meter-cursor"></div>
      </div>
      <div class="meter__labels"><span>Miss</span><span>Graze</span><span>Hit</span><span>Crit</span><span>Graze</span><span>Miss</span></div>
      ${state.wins === 0 ? `<p class="meter__taunt snark">${escapeHtml(config.snark.taunt)}</p>` : ''}`;
}

export function renderFight(state, config) {
  const c = state.combat;
  const logHtml = c.log.slice(-6).map((l) => `<li>${escapeHtml(l)}</li>`).join('');
  return `
    ${renderHud(state, config)}
    <section class="fight">
      <div class="combatants">
        <div class="you">YOU<br/>${Math.max(0, c.player.health)}/${c.player.maxHealth}</div>
        <div class="them">${escapeHtml(c.enemy.name)}<br/>${Math.max(0, c.enemy.health)}/${c.enemy.maxHealth}</div>
      </div>
      ${renderMeter(state, config)}
      <p class="meter-hint">Click the meter, then choose your action.</p>
      <div class="actions">
        <button data-action="strike">Strike</button>
        <button data-action="heavy">Heavy</button>
        <button data-action="block">Block</button>
        <button data-action="feint">Feint</button>
      </div>
      ${c.canPress ? '<button data-action="press" class="press">PRESS THE ATTACK!</button>' : ''}
      <ul class="log">${logHtml}</ul>
    </section>`;
}
