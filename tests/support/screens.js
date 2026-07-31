// tests/support/screens.js — the state matrix the Task 10 verification checks are driven from.
//
// Both tests/styles.test.js (spec §0 Laws over rendered markup) and tests/a11y.test.js (spec §8
// keyboard floor) need every screen in every state that renders a *different set of controls or
// amounts*, and a matrix maintained twice drifts. One list, one owner.
//
// Built through the real transitions wherever a transition can reach the state, so an illegal
// one throws here rather than producing a screen the game cannot get to. Two states are assembled
// from fields instead: `hubRich` because reaching it legitimately means simulating a dozen bouts,
// and neither of those touches a field the renderers read differently from a played-in one.
import { CONFIG } from '../../src/config.js';
import { createGameState, PHASE } from '../../src/state.js';
import { startFight, resolveFightOutcome, retire } from '../../src/game.js';
import { applyPlayerAction, applyPress, enemyTurn, markPressable } from '../../src/combat.js';
import { makeRng } from '../../src/rng.js';
import { mount } from '../../src/ui/screens.js';

const hubFresh = createGameState(1, CONFIG);

// Everything the hub can offer at once: the sponsor notice, an affordable gear row, a weapon
// worth repairing and injuries worth healing — so Repair and Heal render as live controls rather
// than the native-`disabled` no-ops a fresh run shows.
const hubRich = {
  ...hubFresh,
  gold: 5000,
  wins: 3,
  sponsorUnlocked: true,
  injuries: 2,
  health: 60,
  weaponDurability: 4,
  gear: ['shield'],
  currentOpponentIndex: 2,
};

// The other end of the same screen: nothing is affordable, so every commerce surface renders its
// `is-unaffordable` skin and its shortfall aside. Health follows the between-bouts invariant
// `maxHealth - 20 * injuries` (see hubVeteran below), so one injury pairs with 80, not the full
// bar hubFresh carries — no unreachable HUD combination is invented here.
const hubBroke = { ...hubFresh, gold: 0, injuries: 1, health: 80, weaponDurability: 1 };

// Two fights, because the fight screen renders differently on the first bout: §6.4's taunt line
// is emitted only while `wins === 0`, so a matrix built on a veteran state never sees it.
const fightFirst = startFight(hubFresh, CONFIG);
const fight = startFight(hubRich, CONFIG);
// The press slot only exists after a landed damaging hit, and it is the fifth commit control.
const fightPress = { ...fight, combat: markPressable(fight.combat, 'strike', 'hit') };

// A bout already four exchanges deep, and the only state in this matrix whose combat log is not
// empty. `createCombat` seeds `log: []` and `markPressable` pushes nothing, so before this every
// markup-driven guard in the suite — the Law 2/4 audits, the §8 walks, the grid checks — saw the
// strip as a bare `<ul class="log">`: `.log__entry`, `.log__turn`, `.log__entry b`,
// `.log__entry em`, `.log .amount` and the snark aside were reachable only through logEntry()'s
// own unit tests, which render no screen and stand on no ground.
//
// Played through the real turn flow, including main.js's own `canPress: false` after a press, so
// every entry below is one the game really pushes and no unreachable combination is invented.
// A fresh veteran rather than `hubRich`: health is bound to injuries between bouts
// (`maxHealth - 20 * injuries`), so hubRich's 60 does not survive four answered exchanges, and a
// log this long belongs to a fighter who has been winning.
const hubVeteran = {
  ...hubFresh,
  gold: 900,
  wins: 3,
  sponsorUnlocked: true,
  currentOpponentIndex: 2,
};
const veteranBout = startFight(hubVeteran, CONFIG);

function playedOut() {
  let c = veteranBout.combat;
  // Seed 3 leaves both fighters comfortably alive (41/100 and 41/110) and above §6.1's urgent
  // fraction, so the strip is what this state adds and nothing else changes underneath it. Scoped
  // to this call, not module-level, so a second caller cannot shift the documented draw sequence.
  const battleRng = makeRng(3);
  // The three moves main.js makes, spelled the way main.js spells them.
  const acts = (action, timing) => {
    c = markPressable(applyPlayerAction(c, action, timing, CONFIG), action, timing);
  };
  const presses = (timing) => {
    c = { ...applyPress(c, timing, CONFIG), canPress: false };
  };
  const answers = () => {
    c = enemyTurn(c, battleRng, CONFIG);
  };

  acts('strike', 'miss');
  answers(); // a whiff, so §6.9's snark aside fires, then a blow taken
  acts('block', 'hit');
  answers(); // two italic status clauses: the guard and the counter
  acts('feint', 'graze');
  presses('hit');
  answers(); // the feint's status clause, then a press
  acts('heavy', 'crit');
  presses('graze');
  answers(); // the bold blood-ink damage figure
  return c;
}

// §6.9's fourth typographic channel is money ("money = `--gold-ink`"), and `combat.js` emits no
// `{gold}` clause anywhere — the placeholder is part of logEntry()'s contract and `.log .amount`
// is one of Law 2's six sanctioned gold-text selectors, but nothing in the game fills the slot.
// So this one entry is a stand-in rather than a replay: without it the gold arm of the log stays
// outside every markup-driven guard, exactly the gap this state exists to close. Delete it the
// day combat.js pushes a real money clause, and put the real clause in the sequence above.
const MONEY_ENTRY = {
  turn: 5,
  kind: 'attack',
  text: 'A patron tosses {gold} into the sand.',
  gold: 45,
};
const fightLogged = (() => {
  const combat = playedOut();
  return { ...veteranBout, combat: { ...combat, log: [...combat.log, MONEY_ENTRY] } };
})();

const resultWin = resolveFightOutcome(fight, true, makeRng(1), CONFIG);
// A survived loss: the ledger's expense-heavy variant, and the one that gains an injury.
const resultLoss = resolveFightOutcome(startFight(hubFresh, CONFIG), false, makeRng(1), CONFIG);
// A fatal loss. `rngChance` is `rng() < deathRisk`, so a generator pinned at 0 dies against any
// opponent with a non-zero risk — the Brute's is 0, hence the tier-2 start.
const dead = resolveFightOutcome(startFight(hubRich, CONFIG), false, () => 0, CONFIG);

export const SCREEN_STATES = {
  'hub (fresh run)': hubFresh,
  'hub (everything unlocked)': hubRich,
  'hub (broke)': hubBroke,
  'fight (first bout)': fightFirst,
  fight,
  'fight (press offered)': fightPress,
  'fight (log four exchanges deep)': fightLogged,
  'result (victory)': resultWin,
  'result (survived loss)': resultLoss,
  'gameover (retired)': retire(hubFresh),
  'gameover (died)': dead,
};

// Sanity the matrix asserts on itself: every phase must appear, or a screen is going unchecked.
export const PHASES_COVERED = new Set(Object.values(SCREEN_STATES).map((s) => s.phase));
export const ALL_PHASES = Object.values(PHASE);

// name -> a detached element with the screen mounted inside it.
export function mountAll(doc = document) {
  return Object.fromEntries(
    Object.entries(SCREEN_STATES).map(([name, state]) => {
      const host = doc.createElement('div');
      mount(host, state, CONFIG);
      return [name, host];
    })
  );
}
