// src/ui/render.js
import { trainingCost, repairCost, healCost, canAfford } from '../economy.js';
import { effectiveStats } from '../game.js';

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function btn(action, label, cost, gold, extra = '') {
  const affordable = cost == null || canAfford(gold, cost);
  const costLabel = cost == null ? '' : ` (${cost}g)`;
  return `<button data-action="${action}"${extra}${affordable ? '' : ' disabled'}>${escapeHtml(label)}${costLabel}</button>`;
}

export function renderHud(state, config) {
  return `
    <div class="hud">
      <span class="gold">🪙 ${state.gold}g</span>
      <span>Health: ${Math.max(0, state.health)}/${state.maxHealth}</span>
      <span>Durability: ${state.weaponDurability}/${config.weapon.maxDurability}</span>
      <span>Injuries: ${state.injuries}</span>
    </div>`;
}

export function renderHub(state, config) {
  const eff = effectiveStats(state, config);
  const missing = config.weapon.maxDurability - state.weaponDurability;
  const opponent = config.opponents[state.currentOpponentIndex];

  const trainButtons = ['power', 'guard', 'speed']
    .map((stat) => {
      const cost = trainingCost(state.trainingLevels[stat], config);
      return btn(`train-${stat}`, `Train ${stat} → ${eff[stat]}`, cost, state.gold);
    })
    .join('');

  const gearButtons = Object.values(config.gear)
    .map((g) => {
      if (state.gear.includes(g.id)) return `<button disabled>${escapeHtml(g.name)} ✓</button>`;
      return btn(`buy-${g.id}`, g.name, g.cost, state.gold);
    })
    .join('');

  return `
    ${renderHud(state, config)}
    <section class="hub">
      <h2>The Ludus — Wins: ${state.wins}</h2>
      <div class="row">${trainButtons}</div>
      <div class="row">
        ${btn('repair', 'Repair weapon', repairCost(missing, config), state.gold, missing <= 0 ? ' data-noop="1"' : '')}
        ${btn('heal', `Heal ${state.injuries} injuries`, healCost(state.injuries, config), state.gold)}
        ${
          state.bribedThisFight
            ? '<button disabled>Bribed ✓</button>'
            : btn('bribe', 'Bribe official', config.arena.bribeCost, state.gold)
        }
      </div>
      <div class="row">${gearButtons}</div>
      ${state.sponsorUnlocked ? `<p class="sponsor">Sponsor active: +${config.sponsor.stipendPerFight}g/fight. Objective: ${escapeHtml(config.sponsor.objective)}</p>` : ''}
      <hr/>
      <p>Next up: <strong>${escapeHtml(opponent.name)}</strong> (${opponent.tier}) — purse ${opponent.purse}g</p>
      <button data-action="next-fight">⚔️ Next Fight</button>
      <button data-action="retire">🏛️ Retire rich (${state.gold}g)</button>
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
      ${
        r.won
          ? `<ul>
        <li>Purse: ${r.purse}g (tax ${r.tax}g)</li>
        ${r.sponsorIncome ? `<li>Sponsor: +${r.sponsorIncome}g</li>` : ''}
        <li><strong>Net: +${r.netGold}g</strong></li>
        <li>Weapon wear: -${r.durabilityLost} durability</li>
      </ul>`
          : `<ul>
        <li>Injuries gained: ${r.injuriesGained}</li>
        <li>Weapon wear: -${r.durabilityLost} durability</li>
      </ul>`
      }
      <button data-action="to-hub">Back to the Ludus</button>
    </section>`;
}

export function renderGameOver(state, _config) {
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
  const logHtml = c.log
    .slice(-6)
    .map((l) => `<li>${escapeHtml(l)}</li>`)
    .join('');
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
