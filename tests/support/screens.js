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
import { markPressable } from '../../src/combat.js';
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
// `is-unaffordable` skin and its shortfall aside.
const hubBroke = { ...hubFresh, gold: 0, injuries: 1, weaponDurability: 1 };

// Two fights, because the fight screen renders differently on the first bout: §6.4's taunt line
// is emitted only while `wins === 0`, so a matrix built on a veteran state never sees it.
const fightFirst = startFight(hubFresh, CONFIG);
const fight = startFight(hubRich, CONFIG);
// The press slot only exists after a landed damaging hit, and it is the fifth commit control.
const fightPress = { ...fight, combat: markPressable(fight.combat, 'strike', 'hit') };

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
  return Object.fromEntries(Object.entries(SCREEN_STATES).map(([name, state]) => {
    const host = doc.createElement('div');
    mount(host, state, CONFIG);
    return [name, host];
  }));
}
