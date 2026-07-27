// src/ui/render.js
import { trainingCost, repairCost, healCost, canAfford } from '../economy.js';
import { effectiveStats } from '../game.js';
import { formatGold } from './format.js';

// Presentation constants (not game tuning — they belong to the HUD, not config.js).
// The pip row always reserves this many slots so it does not resize as injuries accrue.
const PIP_MIN_SLOTS = 5;
// Below this fraction of max, a bar turns urgent. Shared so the fight HP bar reads the same.
const URGENT_FRACTION = 0.33;

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Commerce button per spec §6.2: [label] [price slot] [snark slot?].
// variant: '' (plank) | 'commit' (irreversible) | 'danger'.
// Unaffordable is NOT disabled — the button stays clickable and the action layer rejects it,
// so the game tells you you are broke instead of hiding the option. `disabled` is reserved
// for true no-ops (nothing to repair, nothing to heal, already bribed).
function btn(action, label, { cost = null, gold = 0, variant = '', snark = '',
  urgent = false, disabled = false } = {}) {
  const classes = ['btn'];
  if (variant) classes.push(`btn--${variant}`);
  if (urgent) classes.push('is-urgent');
  let attrs = '';
  let missing = '';
  if (cost != null && !canAfford(gold, cost)) {
    classes.push('is-unaffordable');
    // The shortfall lives on the button (the click handler reads it) and is mirrored onto
    // the snark span, because spec §6.2's `.btn__snark::after { content: … attr(data-missing) … }`
    // resolves attr() against the pseudo-element's own originating element, not the button.
    missing = ` data-missing="${escapeHtml(formatGold(cost - gold))}"`;
    attrs += missing;
  }
  if (disabled) attrs += ' disabled';
  const price = cost != null ? `<span class="btn__price">${formatGold(cost)}</span>` : '';
  const aside = snark ? `<span class="btn__snark snark"${missing}>(${escapeHtml(snark)})</span>` : '';
  return `<button data-action="${action}" class="${classes.join(' ')}"${attrs}>` +
    `${escapeHtml(label)}${price}${aside}</button>`;
}

function bar(label, value, max, { fillClass = '', urgent = false } = {}) {
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  // role="meter" is invalid ARIA when valuenow falls outside [valuemin, valuemax], and the
  // visible numeral must match it or sighted and screen-reader users read different numbers.
  const now = Math.min(max, Math.max(0, value));
  return `<span class="hud__stat"><span class="hud__label">${label}</span>
    <span class="bar${urgent ? ' is-urgent' : ''}" role="meter" aria-label="${label}"
      aria-valuenow="${now}" aria-valuemin="0" aria-valuemax="${max}">
      <span class="bar__fill${fillClass}" style="width:${pct}%"></span>
      <span class="bar__num">${now}/${max}</span>
    </span></span>`;
}

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

  const trainButtons = ['power', 'guard', 'speed'].map((stat) => {
    const cost = trainingCost(state.trainingLevels[stat], config);
    return btn(`train-${stat}`, `Train ${stat} → ${eff[stat]}`, { cost, gold: state.gold });
  }).join('');

  const gearButtons = Object.values(config.gear).map((g) => {
    if (state.gear.includes(g.id)) {
      return `<button class="btn is-owned" aria-disabled="true">✓ ${escapeHtml(g.name)} — OWNED</button>`;
    }
    return btn(`buy-${g.id}`, g.name, { cost: g.cost, gold: state.gold, snark: config.snark[g.id] ?? '' });
  }).join('');

  return `
    ${renderHud(state, config)}
    <section class="hub">
      <h2>The Ludus — Wins: ${state.wins}</h2>
      <div class="row">${trainButtons}</div>
      <div class="row">
        ${btn('repair', 'Repair weapon', { cost: repairCost(missing, config), gold: state.gold,
          snark: config.snark.repair, urgent: state.weaponDurability / config.weapon.maxDurability < 0.5,
          disabled: missing <= 0 })}
        ${btn('heal', `Heal ${state.injuries} injuries`, { cost: healCost(state.injuries, config),
          gold: state.gold, snark: config.snark.heal, urgent: state.injuries >= 1,
          disabled: state.injuries === 0 })}
        ${state.bribedThisFight
          ? '<button class="btn" disabled>Bribed ✓</button>'
          : btn('bribe', `Bribe official — tax ${config.arena.taxRate * 100}% → ${config.arena.bribedTaxRate * 100}%`,
              { cost: config.arena.bribeCost, gold: state.gold, snark: config.snark.bribe })}
      </div>
      <div class="row">${gearButtons}</div>
      ${state.sponsorUnlocked ? `<p class="sponsor">Sponsor active: +${config.sponsor.stipendPerFight}g/fight. Objective: ${escapeHtml(config.sponsor.objective)}</p>` : ''}
      <hr/>
      <p>Next up: <strong>${escapeHtml(opponent.name)}</strong> (${opponent.tier}) — purse ${formatGold(opponent.purse)}</p>
      ${btn('next-fight', 'Next Fight ▸', { variant: 'commit' })}
      ${btn('retire', 'Retire Rich', { cost: null, variant: 'commit' })}
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

export function meterDistance(clickPos, sweetSpot) {
  return Math.abs(clickPos - sweetSpot);
}

// Cursor position on the [0,1] track as a triangle wave over elapsed time,
// so the sweep speed is independent of display refresh rate.
export function meterPosition(elapsedMs, periodMs) {
  const phase = (elapsedMs / periodMs) % 2;
  return phase < 1 ? phase : 2 - phase;
}

// One-way sweep duration for the given opponent tier.
export function meterPeriod(tierIndex, config) {
  const { base, perTier, min } = config.combat.meterPeriodMs;
  return Math.max(min, base + perTier * tierIndex);
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
      <div class="timing-meter" data-meter="1">
        <div class="meter-sweet"></div>
        <div class="meter-cursor"></div>
      </div>
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
