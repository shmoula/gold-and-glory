// tests/game.test.js
import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { createGameState } from '../src/state.js';
import {
  effectiveStats, trainStat, repairWeapon, healInjuries, buyGear, bribeOfficial,
} from '../src/game.js';
import { healCost } from '../src/economy.js';

describe('effectiveStats', () => {
  it('returns base stats with no training or gear', () => {
    const s = createGameState(1, CONFIG);
    const e = effectiveStats(s, CONFIG);
    expect(e.power).toBe(5);
    expect(e.guard).toBe(5);
    expect(e.speed).toBe(5);
    expect(e.critWindowMult).toBe(1);
  });

  it('adds training (statPerLevel) and gear bonuses', () => {
    const s = createGameState(1, CONFIG);
    s.trainingLevels.power = 2;     // +4 power
    s.gear = ['blade', 'shield', 'charm']; // +4 power, +3 guard, x1.5 crit window
    const e = effectiveStats(s, CONFIG);
    expect(e.power).toBe(5 + 4 + 4);
    expect(e.guard).toBe(5 + 3);
    expect(e.critWindowMult).toBe(1.5);
  });
});

describe('trainStat', () => {
  it('spends gold, raises the training level', () => {
    const s = createGameState(1, CONFIG); // 100g
    const next = trainStat(s, 'power', CONFIG);
    expect(next.gold).toBe(20); // 100 - 80
    expect(next.trainingLevels.power).toBe(1);
  });

  it('no-ops when unaffordable', () => {
    const s = createGameState(1, CONFIG);
    s.gold = 10;
    const next = trainStat(s, 'power', CONFIG);
    expect(next.gold).toBe(10);
    expect(next.trainingLevels.power).toBe(0);
  });
});

describe('repairWeapon', () => {
  it('restores durability and charges per missing point', () => {
    const s = createGameState(1, CONFIG);
    s.weaponDurability = 27; // 3 missing -> 45g
    s.gold = 100;
    const next = repairWeapon(s, CONFIG);
    expect(next.weaponDurability).toBe(30);
    expect(next.gold).toBe(55);
  });
});

describe('healInjuries', () => {
  it('clears injuries, restores health, charges per injury', () => {
    const s = createGameState(1, CONFIG);
    s.injuries = 2; s.health = 60; s.gold = 100;
    const next = healInjuries(s, CONFIG);
    expect(next.injuries).toBe(0);
    expect(next.health).toBe(100);
    expect(next.gold).toBe(20); // 100 - 80
  });
});

describe('buyGear', () => {
  it('adds gear and spends gold once', () => {
    const s = createGameState(1, CONFIG);
    s.gold = 400;
    const next = buyGear(s, 'shield', CONFIG);
    expect(next.gear).toContain('shield');
    expect(next.gold).toBe(200);
  });

  it('refuses to buy the same gear twice', () => {
    const s = createGameState(1, CONFIG);
    s.gold = 400; s.gear = ['shield'];
    const next = buyGear(s, 'shield', CONFIG);
    expect(next.gold).toBe(400);
  });
});

describe('bribeOfficial', () => {
  it('spends gold and flags the fight as bribed', () => {
    const s = createGameState(1, CONFIG); // 100g
    const next = bribeOfficial(s, CONFIG);
    expect(next.gold).toBe(40); // 100 - 60
    expect(next.bribedThisFight).toBe(true);
  });

  it('no-ops if already bribed this fight', () => {
    const s = createGameState(1, CONFIG);
    s.bribedThisFight = true;
    const next = bribeOfficial(s, CONFIG);
    expect(next.gold).toBe(100);
  });
});

import { PHASE } from '../src/state.js';
import { makeRng } from '../src/rng.js';
import { startFight, resolveFightOutcome, retire } from '../src/game.js';

describe('startFight', () => {
  it('moves to FIGHT and builds combat from effective stats + current health', () => {
    const s = createGameState(1, CONFIG);
    const next = startFight(s, CONFIG);
    expect(next.phase).toBe(PHASE.FIGHT);
    expect(next.combat.enemy.name).toBe('The Brute');
    expect(next.combat.player.health).toBe(100);
  });

  it('weapon counts as broken when durability is 0', () => {
    const s = createGameState(1, CONFIG);
    s.weaponDurability = 0;
    const next = startFight(s, CONFIG);
    expect(next.combat.player.weaponBroken).toBe(true);
  });
});

describe('resolveFightOutcome (win)', () => {
  it('pays net purse, loses durability, advances opponent, counts win', () => {
    let s = startFight(createGameState(1, CONFIG), CONFIG);
    s.combat.player.health = 80;
    const rng = makeRng(1);
    const next = resolveFightOutcome(s, true, rng, CONFIG);
    expect(next.phase).toBe(PHASE.RESULT);
    expect(next.wins).toBe(1);
    expect(next.currentOpponentIndex).toBe(1);
    expect(next.weaponDurability).toBe(27); // 30 - 3
    expect(next.health).toBe(80);
    // Brute purse 50, tax 20% = 10, net +40
    expect(next.gold).toBe(140);
    expect(next.lastResult.won).toBe(true);
    expect(next.lastResult.netGold).toBe(40);
  });

  it('unlocks the sponsor after the configured number of wins', () => {
    let s = createGameState(1, CONFIG);
    s.wins = 1;
    s = startFight(s, CONFIG);
    const next = resolveFightOutcome(s, true, makeRng(1), CONFIG);
    expect(next.wins).toBe(2);
    expect(next.sponsorUnlocked).toBe(true);
  });

  it('adds sponsor income once unlocked', () => {
    let s = createGameState(1, CONFIG);
    s.sponsorUnlocked = true;
    s = startFight(s, CONFIG); // Brute, did not block -> objective met
    const next = resolveFightOutcome(s, true, makeRng(1), CONFIG);
    // net purse 40 + sponsor (30 + 50 objective) = 120
    expect(next.lastResult.sponsorIncome).toBe(80);
    expect(next.gold).toBe(100 + 40 + 80);
  });

  it('wins the circuit when the last opponent falls', () => {
    let s = createGameState(1, CONFIG);
    s.currentOpponentIndex = 3; // Champion
    s = startFight(s, CONFIG);
    const next = resolveFightOutcome(s, true, makeRng(1), CONFIG);
    expect(next.phase).toBe(PHASE.GAMEOVER);
    expect(next.ended).toBe('win-circuit');
  });
});

describe('resolveFightOutcome (loss)', () => {
  it('adds an injury and reduces health on a survivable loss', () => {
    let s = createGameState(1, CONFIG);
    s.currentOpponentIndex = 1; // Journeyman, low death risk
    s = startFight(s, CONFIG);
    s.combat.player.health = 0;
    // seed chosen so the death roll does NOT trigger
    const next = resolveFightOutcome(s, false, makeRng(2), CONFIG);
    if (!next.lastResult.died) {
      expect(next.phase).toBe(PHASE.RESULT);
      expect(next.injuries).toBe(1);
      expect(next.lastResult.won).toBe(false);
    }
  });

  it('death roll ends the game with an absurd cause-of-death', () => {
    let s = createGameState(1, CONFIG);
    s.currentOpponentIndex = 3; // Champion, deathRisk 0.35
    s = startFight(s, CONFIG);
    s.combat.player.health = 0;
    // try seeds until the death roll fires (deterministic per seed)
    let next;
    for (let seed = 0; seed < 50; seed++) {
      next = resolveFightOutcome(s, false, makeRng(seed), CONFIG);
      if (next.lastResult.died) break;
    }
    expect(next.lastResult.died).toBe(true);
    expect(next.phase).toBe(PHASE.GAMEOVER);
    expect(next.ended).toBe('dead');
    expect(typeof next.lastResult.causeOfDeath).toBe('string');
  });
});

// Spec 6.5's "one health field" is a read-side fix: the HUD derives the live number from
// state.combat while a fight is running, and nothing writes damage back to state.health as it
// happens. These pin the ledger that a write-back would have broken - combat damage must reach
// state.health exactly once, at the end of the bout, and the money and healing economics must
// not move at all.
describe('combat damage reaches state.health exactly once', () => {
  it('leaves the persistent field untouched while the fight is running', () => {
    const s = startFight(createGameState(1, CONFIG), CONFIG);
    s.combat.player.health = 80;
    expect(s.health).toBe(100);
    expect(s.maxHealth).toBe(100);
  });

  it('writes the fight health back on a win without disturbing the ledger', () => {
    const s = startFight(createGameState(1, CONFIG), CONFIG);
    s.combat.player.health = 80;
    const next = resolveFightOutcome(s, true, makeRng(1), CONFIG);
    expect(next.health).toBe(s.combat.player.health); // once, not twice: 80, never 60
    expect(next.maxHealth).toBe(100);
    // Brute purse 50, tax 20% = 10, net +40 on a starting purse of 100.
    expect(next.gold).toBe(140);
    expect(next.lastResult.purse).toBe(50);
    expect(next.lastResult.tax).toBe(10);
    expect(next.lastResult.netGold).toBe(40);
    expect(next.lastResult.durabilityLost).toBe(3);
    expect(next.weaponDurability).toBe(27);
    expect(next.lastResult.injuriesGained).toBe(0);
    expect(next.injuries).toBe(0);
  });

  // The loss branch prices health off injuries, not off what was left in the fight, so an
  // overkilled fighter who survives still crawls out on the injury table.
  it('prices post-loss health off injuries, whatever the fight left', () => {
    let s = createGameState(1, CONFIG);
    s.currentOpponentIndex = 1; // Journeyman: seed 2 does not roll a death
    s = startFight(s, CONFIG);
    s.combat.player.health = -30;
    const next = resolveFightOutcome(s, false, makeRng(2), CONFIG);
    expect(next.lastResult.died).toBe(false);
    expect(next.injuries).toBe(1);
    expect(next.health).toBe(80); // maxHealth - 20 per injury, not -30 and not 0
    // Healing is priced per injury and refills to the cap, so the fix moves neither.
    expect(healCost(next.injuries, CONFIG)).toBe(healCost(1, CONFIG));
    const healed = healInjuries({ ...next, gold: 1000 }, CONFIG);
    expect(healed.health).toBe(next.maxHealth);
    expect(healed.gold).toBe(1000 - healCost(1, CONFIG));
  });
});

describe('retire', () => {
  it('ends the game as retired from the HUB', () => {
    const s = createGameState(1, CONFIG);
    const next = retire(s);
    expect(next.phase).toBe(PHASE.GAMEOVER);
    expect(next.ended).toBe('retired');
  });
});
