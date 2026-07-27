// src/ui/render.js
import { trainingCost, repairCost, healCost, canAfford } from '../economy.js';
import { effectiveStats } from '../game.js';
import { formatGold } from './format.js';

// Presentation constants (not game tuning — they belong to the HUD, not config.js).
// The pip row always reserves this many slots so it does not resize as injuries accrue.
const PIP_MIN_SLOTS = 5;
// Below this fraction of max, a bar turns urgent. Shared so the fight HP bar reads the same.
const URGENT_FRACTION = 0.33;
// Deliberately NOT the same number as URGENT_FRACTION: spec §6.2 pulses the *Repair button*
// at durability < 50% so you are nagged to fix the weapon well before the durability *bar*
// (§6.1, URGENT_FRACTION) starts flashing. Two different affordances, two thresholds.
const REPAIR_URGENT_FRACTION = 0.5;
// Training meters need *a* full mark to draw against, but stats are uncapped by design.
// This is a display denominator only — it is never exposed to assistive tech as a real
// maximum (the training meter is presentational; the row label carries the true number).
const TRAIN_METER_CAP = 50;

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// The shortfall attribute, spec §6.2/§6.12. Empty string when the purse covers the cost, so
// callers can concatenate it unconditionally. Shared by `.btn` and the `.shop-item` card so
// the two commerce surfaces can never disagree about what "unaffordable" means or how the
// gap is spelled (formatGold is the only money formatter — spec §2).
function shortfallAttr(cost, gold) {
  return canAfford(gold, cost) ? '' : ` data-missing="${escapeHtml(formatGold(cost - gold))}"`;
}

// The optional snark aside. `missing` is a shortfallAttr() result: spec §6.2 renders the gap
// via `.btn__snark::after { content: … attr(data-missing) … }`, and attr() resolves against
// the pseudo-element's own originating element — so the span, not just the enclosing control,
// has to carry it.
function snarkAside(snark, missing = '') {
  return snark ? `<span class="btn__snark snark"${missing}>(${escapeHtml(snark)})</span>` : '';
}

// Commerce button per spec §6.2: [label] [price slot] [snark slot?].
// variant: '' (plank) | 'commit' (irreversible) | 'danger'.
// `action` is optional: buttons that are not clickable at all (owned gear, already bribed) still
// need the .btn skin, so they come through here instead of being hand-rolled per screen.
// Unaffordable is NOT disabled — the button stays clickable and the action layer rejects it,
// so the game tells you you are broke instead of hiding the option. The two dead states are
// `disabled` (native; a true no-op such as nothing to repair) and `owned` (inert plank for an
// already-taken option — aria-disabled so it is announced, not focus-trapped out of the tab order).
// Exported so the guard below can be exercised directly; screens use the render* wrappers.
export function btn(action, label, { cost = null, gold, variant = '', snark = '',
  urgent = false, disabled = false, owned = false } = {}) {
  // `gold` deliberately has no default. With one, a priced call site that forgot to pass it
  // would render a full-price button as unaffordable — wrong pixels, no error, green suite.
  if (cost != null && !Number.isFinite(gold)) {
    throw new TypeError(`btn(${JSON.stringify(action)}): a priced button needs \`gold\`, got ${gold}`);
  }
  const classes = ['btn'];
  if (variant) classes.push(`btn--${variant}`);
  if (urgent) classes.push('is-urgent');
  if (owned) classes.push('is-owned');
  let attrs = '';
  // Written twice on purpose — see snarkAside(). The button's copy is where spec §6.2 puts the
  // shortfall, reserved for Task 7's click-rejection message; no code consumes it yet, so do
  // not infer a reader from its presence.
  const missingAttr = cost != null ? shortfallAttr(cost, gold) : '';
  if (missingAttr) {
    classes.push('is-unaffordable');
    attrs += missingAttr;
  }
  if (owned) attrs += ' aria-disabled="true"';
  if (disabled) attrs += ' disabled';
  const actionAttr = action ? ` data-action="${action}"` : '';
  const price = cost != null ? `<span class="btn__price">${formatGold(cost)}</span>` : '';
  return `<button${actionAttr} class="${classes.join(' ')}"${attrs}>` +
    `${escapeHtml(label)}${price}${snarkAside(snark, missingAttr)}</button>`;
}

// Fill width as a whole percent, clamped to the track. Shared with the purely decorative
// training meter, which has no role and therefore no aria values to keep in step.
function fillPct(value, max) {
  return Math.min(100, Math.max(0, Math.round((value / max) * 100)));
}

// One clamped, ARIA-correct meter. Mounted bare inside a poster's HP plate (spec §6.5) and
// wrapped with a label by bar() for the HUD beam (spec §6.1) — a second hand-rolled copy is
// how the two drift apart.
function meter(label, value, max, { fillClass = '', urgent = false } = {}) {
  // role="meter" is invalid ARIA when valuenow falls outside [valuemin, valuemax], and the
  // visible numeral must match it or sighted and screen-reader users read different numbers.
  const now = Math.min(max, Math.max(0, value));
  return `<span class="bar${urgent ? ' is-urgent' : ''}" role="meter" aria-label="${label}"
      aria-valuenow="${now}" aria-valuemin="0" aria-valuemax="${max}">
      <span class="bar__fill${fillClass}" style="width:${fillPct(value, max)}%"></span>
      <span class="bar__num">${now}/${max}</span>
    </span>`;
}

function bar(label, value, max, opts) {
  return `<span class="hud__stat"><span class="hud__label">${label}</span>
    ${meter(label, value, max, opts)}</span>`;
}

// Wanted poster (spec §6.5): name, portrait well, one optional HP plate, sub line, snark.
// `sub` is markup — call sites embed `.amount` spans in it — so it is deliberately not
// escaped; everything else here is. hp: {value, max} | null. tilt: 1|2|3, and neighbouring
// posters must never share a tilt token.
export function poster({ name, sub = '', snark = '', hp = null, tilt = 1 }) {
  const hpBar = hp ? meter(`${escapeHtml(name)} health`, hp.value, hp.max) : '';
  return `<article class="poster tape poster--tilt-${tilt}">
    <h3 class="poster__name">${escapeHtml(name)}</h3>
    <div class="poster__portrait" aria-hidden="true"><span class="poster__silhouette"></span></div>
    ${hpBar}
    ${sub ? `<p class="poster__sub">${sub}</p>` : ''}
    ${snark ? `<span class="snark">(${escapeHtml(snark)})</span>` : ''}
  </article>`;
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
  // One predicate for Heal: it is urgent exactly when it is not a no-op.
  const hurt = state.injuries > 0;

  // Spec §6.11: one label format per row, the meter beside it, the priced button at the end.
  const trainRows = ['power', 'guard', 'speed'].map((stat) => {
    const cost = trainingCost(state.trainingLevels[stat], config);
    return `<div class="train-row">
      <span class="train-row__label">${stat[0].toUpperCase() + stat.slice(1)} ${eff[stat]}</span>
      <span class="bar train-row__meter"><span class="bar__fill bar__fill--dur"
        style="width:${fillPct(eff[stat], TRAIN_METER_CAP)}%"></span></span>
      ${btn(`train-${stat}`, `Train +${config.training.statPerLevel}`, { cost, gold: state.gold })}
    </div>`;
  }).join('');

  // Spec §6.12 state triad. Gear leaves the `.btn` plank behind here: an owned card is inert
  // structure (no action, price row replaced), not a dimmed button.
  const gearCards = Object.values(config.gear).map((g) => {
    if (state.gear.includes(g.id)) {
      return `<div class="shop-item is-owned" aria-disabled="true">
        <span class="shop-item__name">${escapeHtml(g.name)}</span>
        <span class="shop-item__owned">✓ Owned</span></div>`;
    }
    const missingAttr = shortfallAttr(g.cost, state.gold);
    return `<button data-action="buy-${g.id}" class="shop-item${missingAttr ? ' is-unaffordable' : ''}"${missingAttr}>
      <span class="shop-item__name">${escapeHtml(g.name)}</span>
      <span class="btn__price">${formatGold(g.cost)}</span>
      ${snarkAside(config.snark[g.id] ?? '', missingAttr)}</button>`;
  }).join('');

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
