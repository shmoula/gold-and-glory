// src/ui/render.js - screens only. The shared vocabulary lives in ./components.js and the
// timing-meter math in ./timing.js; both are re-exported below so existing importers (and the
// render tests) keep their single entry point.
import { trainingCost, repairCost, healCost } from '../economy.js';
import { effectiveStats, playerHealth } from '../game.js';
import { timingWindowWidth } from '../combat.js';
import { formatGold } from './format.js';
import {
  URGENT_FRACTION, REPAIR_URGENT_FRACTION,
  escapeHtml, btn, meter, bar, poster, shopItem, logEntry,
} from './components.js';
import { meterZones } from './timing.js';

export {
  URGENT_FRACTION, REPAIR_URGENT_FRACTION,
  escapeHtml, shortfallAttr, snarkAside, btn, fillPct, meter, bar, poster, shopItem,
  logEntry, logEntryText,
} from './components.js';
export { meterDistance, meterPosition, meterPeriod, meterZones, sweetCenter } from './timing.js';

// Presentation constants (not game tuning — they belong to the HUD, not config.js).
// The pip row always reserves this many slots so it does not resize as injuries accrue.
const PIP_MIN_SLOTS = 5;
// Training meters need *a* full mark to draw against, but stats are uncapped by design.
// This is a display denominator only — it is never exposed to assistive tech as a real
// maximum (the training meter is presentational; the row label carries the true number).
const TRAIN_METER_CAP = 50;

// Spec §6.5's poster sub line: "tier · fight purse", the amount in gold ink. It is markup, so
// it is written once here rather than at each call site — the hub and the fight screen bill
// the same bout and must not drift. The separator is escaped (· MIDDLE DOT) rather than
// pasted: an invisible-lookalike character has already cost this project one bug (see the
// U+00A0 post-mortem in the progress file).
const MIDDOT = '\u00b7';
const opponentSub = (opponent) =>
  `Tier: ${escapeHtml(opponent.tier)} ${MIDDOT} ` +
  `Purse: <span class="amount">${formatGold(opponent.purse)}</span>`;
// The player's card bills their record and their purse — the same two facts, about them.
const playerSub = (state) =>
  `Wins: ${state.wins} ${MIDDOT} Purse: <span class="amount">${formatGold(state.gold)}</span>`;

export function renderHud(state, config) {
  // Spec 6.5: the beam and the player poster read the same field. During a fight that field is
  // the live combat one, so the beam falls with the fighter - and, crucially, its URGENT_FRACTION
  // flash fires on the one screen where being nearly dead is actionable. Reading `state.health`
  // here showed a full beam beside a wounded poster and could never flash mid-fight.
  const hp = playerHealth(state);
  const pipCount = Math.max(PIP_MIN_SLOTS, state.injuries);
  const pips = Array.from({ length: pipCount }, (_, i) =>
    `<i class="pip${i < state.injuries ? ' pip--filled' : ''}"></i>`).join('');
  return `
    <header class="hud">
      <span class="hud__purse"><i class="coin"></i>Gold: <span class="ticker" data-value="${state.gold}">${formatGold(state.gold)}</span></span>
      ${bar('Health', hp.value, hp.max, { urgent: hp.value / hp.max < URGENT_FRACTION })}
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
        ${poster({ name: 'You', tilt: 1, hp: playerHealth(state) })}
        <span class="hub__next-label">Next bout</span>
        ${poster({ name: opponent.name, tilt: 2, sub: opponentSub(opponent) })}
      </div>
      <div class="hub__retire">${btn('retire', 'Retire Rich', { variant: 'commit' })}</div>
      <div class="hub__commit commit-bar">${btn('next-fight', 'Next Fight ▸', { variant: 'commit' })}</div>
    </section>`;
}

// ---- The ledger (spec §6.6) ----
// U+2212 MINUS SIGN, written as an escape. Spec §2 mandates it over the ASCII hyphen, and the
// two are indistinguishable in review — the same reason MIDDOT above is not pasted either.
const MINUS = '\u2212';

// One row builder for every line, so no line can state its amount a different way. The `dd`
// carries `data-value` + `data-unit` for the money lines: ui/effects.js counts those from zero
// as the row lands (§6.6's "money rows count from 0 to value over the beat"), and the unit
// names the formatter, so the counter's last write is by construction the same string the
// server already rendered. A line with no unit is not money and does not count.
function ledgerRow(label, { text, value = null, unit = null, tone = '', cls = '', snark = '' }) {
  const data = unit && Number.isFinite(value) ? ` data-value="${value}" data-unit="${unit}"` : '';
  const aside = snark ? ` <span class="snark">(${escapeHtml(snark)})</span>` : '';
  return `<div class="ledger__row is-hidden${cls}">
            <dt>${escapeHtml(label)}${aside}</dt>
            <dd class="amount${tone}"${data}>${text}</dd>
          </div>`;
}

// A money line. Always signed (§3: the sign is the channel that survives grayscale), green for
// income, red for expense — and muted at zero, because §6.6 is explicit that a zero line is
// never red. "Injuries gained: 0" is good news.
const moneyRow = (label, amount, opts = {}) => ledgerRow(label, {
  text: formatGold(amount, { signed: true }),
  value: amount,
  unit: 'gold-signed',
  tone: amount > 0 ? ' amount--pos' : (amount < 0 ? ' amount--neg' : ''),
  ...opts,
});

// A line that counts something that is not gold — injuries, durability. Never gold-coloured
// (Law 2 reserves the gold hues for currency), and red only when there is something to regret.
const tallyRow = (label, count, text) => ledgerRow(label, {
  text, tone: count > 0 ? ' amount--neg' : '',
});

export function renderResult(state, config) {
  const r = state.lastResult;
  // By name, not by index: resolveFightOutcome has already advanced currentOpponentIndex past
  // the bout being reported. Absent (a fixture, a renamed opponent) means no tier/purse line
  // rather than a broken one.
  const foe = config.opponents.find((o) => o.name === r.opponentName) ?? null;

  // The same seven lines win or lose, so the ledger reads as one document and a defeat is
  // priced in the same units as a victory (§6.6: "the same ledger with expense-heavy rows").
  // The tax label states no rate: the result carries the amount, not the rate that produced
  // it, and a rate re-derived from a rounded amount would be a number that lies (Law 1).
  const rows = [
    moneyRow('Purse', r.purse),
    moneyRow('Arena tax', -r.tax, { snark: config.snark.tax }),
    r.sponsorIncome
      ? moneyRow('Sponsor', r.sponsorIncome, { snark: config.snark.sponsorReward })
      : '',
    moneyRow('Net gold', r.netGold, { cls: ' ledger__row--net' }),
    tallyRow('Injuries gained', r.injuriesGained, `${r.injuriesGained}`),
    tallyRow('Weapon wear', r.durabilityLost, `${MINUS}${r.durabilityLost} durability`),
    ledgerRow('New balance', {
      text: formatGold(state.gold), value: state.gold, unit: 'gold',
      cls: ' ledger__row--balance',
    }),
  ].join('');

  // §6.13 + §8: the screen-level stamp, announced as a status. Victory gets the exclamation,
  // defeat the deadpan period (§9) — death never reaches this screen, it goes to GAMEOVER.
  const banner = r.won
    ? '<p class="banner-stamp banner-stamp--victory" role="status">VICTORY!</p>'
    : '<p class="banner-stamp banner-stamp--defeat" role="status">DEFEAT.</p>';

  return `
    ${renderHud(state, config)}
    <section class="screen screen--result">
      <div class="result__recap">
        ${banner}
        ${poster({
          name: r.opponentName,
          tilt: 2,
          // Only a beaten opponent gets a plate, and it reads zero: the result carries no
          // figure for a foe who is still standing, and inventing one would be a number that
          // lies. `urgent: false` because a corpse's plate must not pulse forever.
          hp: r.won && foe ? { value: 0, max: foe.health } : null,
          urgent: false,
          sub: foe ? opponentSub(foe) : '',
          snark: foe ? (config.snark[foe.id] ?? '') : '',
        })}
        ${r.won ? '<div class="result__cross" aria-hidden="true"></div>' : ''}
        <p class="snark result__flavor">${escapeHtml(r.commentary)}</p>
      </div>
      <div class="result__ledger">
        <section class="ledger tape" aria-live="polite">
          <h2>The ledger</h2>
          <dl>${rows}</dl>
          <span class="wordmark">GOLD &amp; GLORY</span>
        </section>
      </div>
      <div class="result__cta commit-bar">${btn('to-hub', 'Return to Ludus',
        { variant: 'commit', price: state.gold })}</div>
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
  const eff = effectiveStats(state, config);
  const width = timingWindowWidth(eff.speed, config);
  const zones = meterZones(state.combat.sweet, width, config, eff.critWindowMult);
  const pct = (x) => `${(x * 100).toFixed(2)}%`;
  const zone = (name) =>
    `<div class="meter__zone meter__zone--${name}" ` +
    `style="left:${pct(zones[name].start)};width:${pct(zones[name].size)}"></div>`;
  // Spec 6.4 puts the first-fight taunt above the track.
  return `
      ${state.wins === 0 ? `<p class="meter__taunt snark">${escapeHtml(config.snark.taunt)}</p>` : ''}
      <div class="meter" data-meter="1" tabindex="0" role="application"
        aria-label="Timing meter \u2014 press Space or click to strike">
        ${zone('graze')}
        ${zone('hit')}
        ${zone('crit')}
        <div class="meter-cursor"></div>
      </div>
      <div class="meter__labels"><span>Miss</span><span>Graze</span><span>Hit</span><span>Crit</span><span>Graze</span><span>Miss</span></div>`;
}

// Spec §6.9: the strip is a fixed-height parchment scroller — `max-height: ~160px` plus
// `overflow-y: auto`, newest appended at the bottom and auto-scrolled to (main.js does the
// scroll; the renderer only emits strings). That CSS is the *only* truncation. The renderer
// used to also `slice(-8)`, which made two mechanisms clip the same history independently:
// at `--text-sm` the 160px strip shows about six entries, so entries 7 and 8 were reachable
// by scrolling and everything older was **discarded**, not scrolled past. The spec names the
// scroller and never names an entry count, and the scroller is the mechanism the auto-scroll
// was built for — the newest line is always in view and the strip is the player's full record
// of the bout. A fight is tens of entries, so rendering all of them costs nothing.
// Each entry still carries its own turn stamp from combat.js, so the number counts exchanges
// rather than lines — an exchange pushes two entries, or three with a press.
export function renderFight(state, config) {
  const c = state.combat;
  // The bout being fought is still the current one: resolveFightOutcome advances the index
  // only after the fight is over, so the poster bills the right tier, purse and aside.
  const opponent = config.opponents[state.currentOpponentIndex];
  const logHtml = c.log.map(logEntry).join('');
  // Both plates come from poster(), so each fighter's health is clamped, ARIA-valid and flashes
  // at the shared urgency threshold — the fight screen states no number by hand.
  return `
    ${renderHud(state, config)}
    <section class="screen screen--fight">
      <div class="fight__you">${poster({ name: 'You', tilt: 1,
        hp: playerHealth(state),
        sub: playerSub(state), snark: config.snark.player })}</div>
      <div class="fight__stage">${renderMeter(state, config)}</div>
      <div class="fight__foe">${poster({ name: c.enemy.name, tilt: 2,
        hp: { value: c.enemy.health, max: c.enemy.maxHealth },
        sub: opponentSub(opponent), snark: config.snark[opponent.id] ?? '' })}</div>
      <div class="fight__log"><h2>Commentary</h2><ul class="log" aria-live="polite">${logHtml}</ul></div>
      <div class="fight__actions">
        ${c.canPress ? btn('press', 'Press the Attack ▸', { variant: 'commit' }) : ''}
        <div class="fight__grid">
          ${btn('strike', 'Strike')}
          ${btn('heavy', 'Heavy')}
          ${btn('block', 'Block')}
          ${btn('feint', 'Feint')}
        </div>
      </div>
    </section>`;
}
