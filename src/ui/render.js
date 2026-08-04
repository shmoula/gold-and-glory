// src/ui/render.js - screens only. The shared vocabulary lives in ./components.js and the
// timing-meter math in ./timing.js; both are re-exported below so existing importers (and the
// render tests) keep their single entry point.
import { trainingCost, repairCost, healCost } from '../economy.js';
import { effectiveStats, playerHealth } from '../game.js';
import { timingWindowWidth } from '../combat.js';
import { formatGold, MINUS } from './format.js';
import {
  URGENT_FRACTION,
  REPAIR_URGENT_FRACTION,
  escapeHtml,
  btn,
  meter,
  bar,
  poster,
  shopItem,
  logEntry,
  bannerStamp,
  titlePlaque,
  iconWell,
} from './components.js';
import { meterZones } from './timing.js';

export {
  URGENT_FRACTION,
  REPAIR_URGENT_FRACTION,
  escapeHtml,
  shortfallAttr,
  snarkAside,
  btn,
  fillPct,
  meter,
  bar,
  poster,
  shopItem,
  logEntry,
  logEntryText,
  bannerStamp,
  titlePlaque,
  iconWell,
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

// `urgent` is an overridable default, exactly as `poster()`'s is: supply `false` and the beam
// stops flashing. Spec §5 caps every motion at 400ms, but `bar-urgent` is an `infinite` pulse,
// so a screen that is the end of the run would throb at 0/100 for as long as it is up. An alarm
// is only an alarm while there is something to do about it.
export function renderHud(state, config, { urgent } = {}) {
  // Spec 6.5: the beam and the player poster read the same field. During a fight that field is
  // the live combat one, so the beam falls with the fighter - and, crucially, its URGENT_FRACTION
  // flash fires on the one screen where being nearly dead is actionable. Reading `state.health`
  // here showed a full beam beside a wounded poster and could never flash mid-fight.
  const hp = playerHealth(state);
  const pipCount = Math.max(PIP_MIN_SLOTS, state.injuries);
  const pips = Array.from(
    { length: pipCount },
    (_, i) => `<i class="pip${i < state.injuries ? ' pip--filled' : ''}"></i>`
  ).join('');
  return `
    <header class="hud">
      <span class="hud__purse"><i class="coin"></i>Gold: <span class="ticker" data-value="${state.gold}">${formatGold(state.gold)}</span></span>
      ${bar('Health', hp.value, hp.max, { icon: 'health', urgent: urgent ?? hp.value / hp.max < URGENT_FRACTION })}
      ${bar('Durability', state.weaponDurability, config.weapon.maxDurability, { icon: 'durability', fillClass: ' bar__fill--dur' })}
      <span class="hud__stat">${iconWell('injuries', { small: true })}<span class="hud__label">Injuries</span>
        <span role="img" aria-label="${state.injuries} ${state.injuries === 1 ? 'injury' : 'injuries'}"><span class="hud__count" aria-hidden="true">${state.injuries}</span><span class="pips" aria-hidden="true">${pips}</span></span></span>
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
  const trainRows = ['power', 'guard', 'speed']
    .map((stat) => {
      const cost = trainingCost(state.trainingLevels[stat], config);
      return `<div class="train-row">
      ${iconWell(stat)}
      <span class="train-row__label">${stat[0].toUpperCase() + stat.slice(1)} ${eff[stat]}</span>
      ${meter(`${stat} training`, eff[stat], TRAIN_METER_CAP, {
        fillClass: ' bar__fill--dur',
        barClass: 'train-row__meter',
        decorative: true,
      })}
      ${btn(`train-${stat}`, `Train +${config.training.statPerLevel}`, { cost, gold: state.gold })}
    </div>`;
    })
    .join('');

  const gearCards = Object.values(config.gear)
    .map((g) =>
      shopItem(g, {
        owned: state.gear.includes(g.id),
        gold: state.gold,
        snark: config.snark[g.id] ?? '',
      })
    )
    .join('');

  const sponsorCard = state.sponsorUnlocked
    ? `<aside class="sponsor-card parchment tape">
      <span class="sponsor-card__eyebrow">Sponsor</span>
      <h3 class="sponsor-card__name">Lord Biggus</h3>
      <p>Objective: ${escapeHtml(config.sponsor.objective)}</p>
      <p>Reward: <span class="amount amount--pos">${formatGold(config.sponsor.stipendPerFight + config.sponsor.objectiveBonus, { signed: true })}</span>
        <span class="snark">(${escapeHtml(config.snark.sponsorReward)})</span></p>
    </aside>`
    : '';

  return `
    ${renderHud(state, config)}
    ${titlePlaque(`Current wins: ${state.wins}`)}
    <section class="screen screen--hub">
      <div class="hub__sinks">
        <h2>The Ludus</h2>
        ${btn('repair', 'Repair Weapon', {
          cost: repairCost(missing, config),
          gold: state.gold,
          snark: config.snark.repair,
          urgent: state.weaponDurability / config.weapon.maxDurability < REPAIR_URGENT_FRACTION,
          disabled: missing <= 0,
          icon: 'repair',
        })}
        ${btn('heal', `Heal ${state.injuries} ${state.injuries === 1 ? 'Injury' : 'Injuries'}`, {
          cost: healCost(state.injuries, config),
          gold: state.gold,
          snark: config.snark.heal,
          urgent: hurt,
          disabled: !hurt,
          icon: 'heal',
        })}
        ${
          // The bribe well names the action, not its remaining availability this fight: the
          // spent state stays an inert plank ("Bribed ✓"), but the slot must not vanish with it.
          state.bribedThisFight
            ? btn(null, 'Bribed ✓', { disabled: true, icon: 'bribe' })
            : btn(
                'bribe',
                `Bribe Official — tax ${config.arena.taxRate * 100}% → ${config.arena.bribedTaxRate * 100}%`,
                {
                  cost: config.arena.bribeCost,
                  gold: state.gold,
                  snark: config.snark.bribe,
                  icon: 'bribe',
                }
              )
        }
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
// Every line is described as data first and rendered twice — once as the visible row, once into
// the sr-only summary below — so the announcement and the page can never state different
// numbers. The `dd` carries `data-value` + `data-unit` for the money lines: ui/effects.js counts
// those from zero as the row lands (§6.6's "money rows count from 0 to value over the beat"),
// and the unit names the formatter, so the counter's last write is by construction the same
// string the server already rendered. A line with no unit is not money and does not count.
function ledgerRow({
  label,
  text,
  value = null,
  unit = null,
  tone = '',
  cls = '',
  snark = '',
  icon = '',
}) {
  const data = unit && Number.isFinite(value) ? ` data-value="${value}" data-unit="${unit}"` : '';
  const aside = snark ? ` <span class="snark">(${escapeHtml(snark)})</span>` : '';
  // §6.18: a small well naming the line's *source* (purse, tax, sponsor). Sums and tallies (net
  // gold, injuries, wear, balance) pass no `icon` and stay well-less — they are not a source.
  const well = icon ? iconWell(icon, { small: true }) : '';
  return `<div class="ledger__row is-hidden${cls}">
            <dt>${well}${escapeHtml(label)}${aside}</dt>
            <dd class="amount${tone}"${data}>${text}</dd>
          </div>`;
}

// A money line. Always signed (§3: the sign is the channel that survives grayscale), green for
// income, red for expense — and muted at zero, because §6.6 is explicit that a zero line is
// never red. "Injuries gained: 0" is good news.
const moneyRow = (label, amount, opts = {}) => ({
  label,
  text: formatGold(amount, { signed: true }),
  value: amount,
  unit: 'gold-signed',
  tone: amount > 0 ? ' amount--pos' : amount < 0 ? ' amount--neg' : '',
  ...opts,
});

// A line that counts something that is not gold — injuries, durability. Never gold-coloured
// (Law 2 reserves the gold hues for currency), and red only when there is something to regret.
const tallyRow = (label, count, text) => ({
  label,
  text,
  tone: count > 0 ? ' amount--neg' : '',
});

// The bout being reported, by name rather than by index: resolveFightOutcome has already
// advanced currentOpponentIndex past it. Absent (a fixture, a renamed opponent) means no
// tier/purse line rather than a broken one.
const foeOf = (state, config) =>
  config.opponents.find((o) => o.name === state.lastResult.opponentName) ?? null;

// The ledger as data, one array, described once. Both the visible rows and the spoken summary
// are derived from it, so the two can never state different numbers.
function ledgerLines(state, config) {
  const r = state.lastResult;
  // The same seven lines win or lose, so the ledger reads as one document and a defeat is
  // priced in the same units as a victory (§6.6: "the same ledger with expense-heavy rows").
  // The tax label states no rate: the result carries the amount, not the rate that produced
  // it, and a rate re-derived from a rounded amount would be a number that lies (Law 1).
  return [
    moneyRow('Purse', r.purse, { icon: 'purse' }),
    moneyRow('Arena tax', -r.tax, { snark: config.snark.tax, icon: 'tax' }),
    r.sponsorIncome
      ? moneyRow('Sponsor', r.sponsorIncome, { snark: config.snark.sponsorReward, icon: 'sponsor' })
      : null,
    moneyRow('Net gold', r.netGold, { cls: ' ledger__row--net' }),
    tallyRow('Injuries gained', r.injuriesGained, `${r.injuriesGained}`),
    tallyRow('Weapon wear', r.durabilityLost, `${MINUS}${r.durabilityLost} durability`),
    {
      label: 'New balance',
      text: formatGold(state.gold),
      value: state.gold,
      unit: 'gold',
      cls: ' ledger__row--balance',
    },
  ].filter(Boolean);
}

// §8 wants the ledger announced politely. The announcement cannot live on the visible card:
// §6.6's theater rewrites every money cell about six times as it counts, and inside a live
// region each write is its own utterance — roughly thirty of them over 2.5s, so a screen reader
// hears the counting and never hears the ledger. `aria-hidden` on the counting cells would
// silence the flood but also take the amounts out of the accessibility tree, leaving a
// browse-mode reader a column of labels with no numbers.
//
// It cannot be a once-written `role="status"` line inside the card either: mount() replaces
// #app wholesale, so such a line is a brand-new node on every render carrying its text already
// inside it, and a live region inserted already-populated announces nothing at all — the same
// defect that put #log-announcer outside #app in the first place (see src/main.js).
//
// §6.13's result verdicts, spelled once for the drawn stamp AND the spoken announcement —
// two spellings of a stamp is how the drawn one and the spoken one drift (item 29's lesson).
const RESULT_STAMPS = {
  won: { variant: 'victory', text: 'VICTORY!' },
  lost: { variant: 'defeat', text: 'DEFEAT.' },
};
const resultStamp = (r) => (r.won ? RESULT_STAMPS.won : RESULT_STAMPS.lost);

// So the renderer's job ends at the *string*: this states every line the card states, in the
// card's own words, and main.js writes it into a region that already exists.
export function ledgerSummary(state, config) {
  return `${resultStamp(state.lastResult).text} ${ledgerLines(state, config)
    .map((l) => `${l.label}: ${l.text}`)
    .join('. ')}.`;
}

export function renderResult(state, config) {
  const r = state.lastResult;
  const foe = foeOf(state, config);
  const rows = ledgerLines(state, config).map(ledgerRow).join('');

  // §6.13: the screen-level stamp. Victory gets the exclamation, defeat the deadpan period
  // (§9). Drawn here; SPOKEN by ledgerSummary through the persistent region (design §4d).
  const stamp = resultStamp(r);
  const banner = bannerStamp(stamp.variant, stamp.text);

  return `
    ${renderHud(state, config)}
    ${titlePlaque('Result')}
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
        <section class="ledger parchment tape">
          <h2>The ledger</h2>
          <dl>${rows}</dl>
          <span class="wordmark">GOLD &amp; GLORY</span>
        </section>
      </div>
      <div class="result__cta commit-bar">${btn('to-hub', 'Return to Ludus', {
        variant: 'commit',
        price: state.gold,
      })}</div>
    </section>`;
}

// ---- Game over (spec §6.13 / §6.14 / §7) ----
// The gallery order is `config.endings`'s own key order, so the endings, their copy, their
// stamps and the order they hang in are one list with one owner. A renderer-side order (or a
// renderer-side stamp table) is a second list of the same keys, and the two drift in silence:
// a fourth ending added to the config alone used to render two cards of four, no stamp, and
// never appear — with nothing in the suite failing.
const endingOrder = (config) => Object.keys(config.endings);

// The cause line when a death arrived with no recorded result. renderGameOver is on the one
// path that deliberately refuses to throw inside mount() (see below), so it must not throw
// here either — and printing "undefined" as a cause of death is worse than saying nothing.
const UNRECORDED_CAUSE = 'Unrecorded.';

// §6.14's payload lead-ins, spelled once so `renderGameOver`'s markup and `gameoverSummary`'s
// spoken string state the same words for the same fact (mirrors resultStamp's reasoning above).
const CAUSE_LABEL = 'Cause of Death:';
const PURSE_LABEL = 'Final purse:';

// One ending's card. Locked cards are info cards, never buttons (§6.14) — `aria-disabled` on an
// <article> is what the spec asks for, and there is nothing here to focus or activate.
// `.poster__name`/`.poster__portrait` are reused rather than invented: §6.0's class index is
// closed and names no `ending-card__*` parts. The portrait well shows the silhouette fallback,
// which spec §10 requires to look complete with zero content assets present.
function endingCard(key, config, achieved) {
  const ending = config.endings[key];
  const locked = key !== achieved;
  return `<article class="ending-card parchment tape${locked ? ' ending-card--locked' : ''}"${
    locked ? ' aria-disabled="true"' : ''
  }>
        <h3 class="poster__name">${escapeHtml(ending.title)}${locked ? '?' : ''}</h3>
        <div class="poster__portrait" aria-hidden="true"><span class="poster__silhouette"></span></div>
        <span class="snark">(${escapeHtml(ending.epitaph)})</span>
      </article>`;
}

export function renderGameOver(state, config) {
  // Every route into GAMEOVER sets one of the declared endings (game.js: resolveFightOutcome,
  // retire), but the renderer refuses to index config.endings with whatever it is handed: an
  // unknown value leaves the centre cell empty and every card locked, rather than throwing
  // inside mount() and taking the whole screen down with it.
  const order = endingOrder(config);
  const achieved = order.includes(state.ended) ? state.ended : null;
  // The achieved ending is lifted out into the centre cell and the rest flank it, split down
  // the middle — so the side slots are never hardcoded, never show the ending you just got, and
  // never quietly drop the ones that do not fit two named variables.
  const others = order.filter((key) => key !== achieved);
  const half = Math.ceil(others.length / 2);
  const gallery = (keys) => keys.map((key) => endingCard(key, config, achieved)).join('');
  const stamp = achieved ? config.endings[achieved].stamp : null;
  // §6.14's screenshot payload. Death states the cause; every surviving ending states what the
  // run was worth — through formatGold, because nothing formats money by hand (§2). It branches
  // on `achieved`, not on the raw `state.ended`, so the whole screen tells one story: an ending
  // the config does not know is not half-recognised into a cause of death under a locked
  // gallery with no stamp.
  const payload =
    achieved === 'dead'
      ? `<strong>${CAUSE_LABEL}</strong> ${escapeHtml(state.lastResult?.causeOfDeath ?? UNRECORDED_CAUSE)}`
      : `<strong>${PURSE_LABEL}</strong> <span class="amount">${formatGold(state.gold)}</span>`;
  // §6.1: "On GAMEOVER the HUD persists showing the fatal state (0/100) — deliberate
  // storytelling." It reads the same playerHealth() selector as every other screen, so the
  // corpse's beam states the number the fight left behind rather than a fresh one — but not
  // urgently: §5 caps motion at 400ms and `bar-urgent` is infinite, so a 0/100 beam would pulse
  // for as long as the screen is up. Same reasoning as the result screen's `urgent: false`
  // poster plate: the run is over, and an alarm that points at nothing is noise.
  return `
    ${renderHud(state, config, { urgent: false })}
    ${titlePlaque('Game over')}
    <section class="screen screen--gameover">
      <div class="gameover__left">${gallery(others.slice(0, half))}</div>
      <div class="gameover__stamp">
        ${stamp ? bannerStamp(stamp.variant, stamp.text) : ''}
        ${achieved ? endingCard(achieved, config, achieved) : ''}
      </div>
      <div class="gameover__right">${gallery(others.slice(half))}</div>
      <div class="gameover__cause">
        <p class="cause-of-death parchment">${payload}
          <span class="wordmark">GOLD &amp; GLORY</span></p>
      </div>
      <div class="gameover__cta commit-bar">${btn('restart', 'Fight Again ▸', { variant: 'commit' })}</div>
    </section>`;
}

// The ending, spoken once (design 2026-08-01 §4d, items 26+28). Same persistent-region
// arrangement as the ledger: this is only a string; main.js writes it into #ledger-announcer,
// which is free on GAMEOVER (no ledger speaks there) — while the killing blow still goes to
// #log-announcer, exactly the fight-end split of responsibilities.
export function gameoverSummary(state, config) {
  const order = endingOrder(config);
  const achieved = order.includes(state.ended) ? state.ended : null;
  // The separator is a sentence break, not decoration: the stamp and the payload are two
  // statements, and a screen reader needs the pause between them. §6.13's victory stamps
  // already carry their own exclamation (`CHAMPION!`), so adding a period there would speak
  // "CHAMPION! ." — supply one only for the stamps that end bare (`YOU DIED`).
  const stampText = achieved ? config.endings[achieved].stamp.text : '';
  const stamp = stampText ? `${stampText}${/[.!?]$/.test(stampText) ? '' : '.'} ` : '';
  const payload =
    achieved === 'dead'
      ? `${CAUSE_LABEL} ${state.lastResult?.causeOfDeath ?? UNRECORDED_CAUSE}`
      : `${PURSE_LABEL} ${formatGold(state.gold)}`;
  return `${stamp}${payload}`;
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
      <div class="meter" data-meter="1" tabindex="0" role="button"
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
// The strip holds no interactive elements, so `tabindex="0"` (below) puts the scroll container
// itself in the tab ring — WCAG 2.1.1: a keyboard user must be able to scroll to older entries,
// which Firefox and Safari otherwise leave unreachable without a pointer. It carries an
// `aria-label` for the same reason the meter does: a focusable region needs a name.
export function renderFight(state, config) {
  const c = state.combat;
  // The bout being fought is still the current one: resolveFightOutcome advances the index
  // only after the fight is over, so the poster bills the right tier, purse and aside.
  const opponent = config.opponents[state.currentOpponentIndex];
  const logHtml = c.log.map(logEntry).join('');
  // Both plates come from poster(), so each fighter's health is clamped, ARIA-valid and flashes
  // at the shared urgency threshold — the fight screen states no number by hand.
  //
  // Child order is the §7-amendment reading order — you, stage, foe, actions, log, press — and
  // therefore the tab order: meter → the four actions → log (it is `tabindex="0"`) → press. The
  // grid areas in screens.css move these blocks around the screen at each breakpoint; they never
  // reorder them. `.fight__press` is emitted whether or not the offer stands, so the grid always
  // has the child its `press` area is written for — but the empty div reserves no *space* (it is
  // 0×0). Nothing jumps when the offer appears because of where the area sits, not because the
  // slot holds the room: on desktop `log log press` is sized by the much taller `.fight__log`
  // beside it, and at ≤900px the press band is the last row, with nothing below it to push down.
  // Shorten the log past the button's height and the desktop row *will* grow when a press is
  // offered.
  return `
    ${renderHud(state, config)}
    ${titlePlaque('Fight')}
    <section class="screen screen--fight">
      <div class="fight__you">${poster({
        name: 'You',
        tilt: 1,
        hp: playerHealth(state),
        sub: playerSub(state),
        snark: config.snark.player,
      })}</div>
      <div class="fight__stage">${renderMeter(state, config)}</div>
      <div class="fight__foe">${poster({
        name: c.enemy.name,
        tilt: 2,
        hp: { value: c.enemy.health, max: c.enemy.maxHealth },
        sub: opponentSub(opponent),
        snark: config.snark[opponent.id] ?? '',
      })}</div>
      <div class="fight__actions">
        <div class="fight__grid">
          ${btn('strike', 'Strike')}
          ${btn('heavy', 'Heavy')}
          ${btn('block', 'Block')}
          ${btn('feint', 'Feint')}
        </div>
      </div>
      <div class="fight__log"><h2>Commentary</h2><ul class="log parchment" tabindex="0" aria-label="Combat log">${logHtml}</ul></div>
      <div class="fight__press">${c.canPress ? btn('press', 'Press the Attack ▸', { variant: 'commit', arrow: true }) : ''}</div>
    </section>`;
}
