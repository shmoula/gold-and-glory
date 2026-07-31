import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import {
  TIMING,
  timingWindowWidth,
  resolveTiming,
  computeDamage,
  createCombat,
  applyPlayerAction,
  isFightOver,
  fightWinner,
} from '../src/combat.js';
import { makeRng } from '../src/rng.js';
import { applyPress, enemyTurn, upgradeTier, markPressable } from '../src/combat.js';

describe('timingWindowWidth', () => {
  it('widens with speed', () => {
    const slow = timingWindowWidth(0, CONFIG);
    const fast = timingWindowWidth(10, CONFIG);
    expect(fast).toBeGreaterThan(slow);
    expect(slow).toBeCloseTo(0.18);
    expect(fast).toBeCloseTo(0.28); // 0.18 + 10*0.01
  });
});

describe('resolveTiming', () => {
  const w = 0.2; // window width for these cases
  it('returns crit for a dead-center click', () => {
    expect(resolveTiming(0.0, w, CONFIG)).toBe(TIMING.CRIT);
  });
  it('returns hit just outside the crit window', () => {
    // crit ratio 0.3 -> crit boundary 0.06; hit boundary 0.2
    expect(resolveTiming(0.1, w, CONFIG)).toBe(TIMING.HIT);
  });
  it('returns graze beyond the hit window', () => {
    // graze ratio 1.6 -> boundary 0.32
    expect(resolveTiming(0.25, w, CONFIG)).toBe(TIMING.GRAZE);
  });
  it('returns miss far from center', () => {
    expect(resolveTiming(0.5, w, CONFIG)).toBe(TIMING.MISS);
  });
  it('widens crit window with the charm multiplier', () => {
    // critWindowMult 1.5 pushes crit boundary 0.06 -> 0.09
    expect(resolveTiming(0.08, w, CONFIG, 1.5)).toBe(TIMING.CRIT);
    expect(resolveTiming(0.08, w, CONFIG, 1.0)).toBe(TIMING.HIT);
  });
});

describe('computeDamage', () => {
  const base = { baseDamage: 10, power: 5, guard: 2, config: CONFIG };

  it('is zero on a miss', () => {
    expect(computeDamage({ ...base, timing: TIMING.MISS })).toBe(0);
  });

  it('hit = (baseDamage + power) * 1.0 - guard', () => {
    // (10 + 5) * 1.0 - 2 = 13
    expect(computeDamage({ ...base, timing: TIMING.HIT })).toBe(13);
  });

  it('crit doubles before guard subtraction', () => {
    // (10 + 5) * 2.0 - 2 = 28
    expect(computeDamage({ ...base, timing: TIMING.CRIT })).toBe(28);
  });

  it('graze halves', () => {
    // (10 + 5) * 0.5 - 2 = 5.5 -> 6 (round)
    expect(computeDamage({ ...base, timing: TIMING.GRAZE })).toBe(6);
  });

  it('never goes below zero', () => {
    expect(
      computeDamage({ baseDamage: 1, power: 0, guard: 99, timing: TIMING.HIT, config: CONFIG })
    ).toBe(0);
  });

  it('applies the press-attack bonus multiplier', () => {
    // (10 + 5) * 1.0 * 1.6 - 2 = 22
    expect(computeDamage({ ...base, timing: TIMING.HIT, pressMultiplier: 1.6 })).toBe(22);
  });

  it('halves damage when the weapon is broken', () => {
    // ((10 + 5) * 1.0 * 0.5) - 2 = 5.5 -> 6
    expect(computeDamage({ ...base, timing: TIMING.HIT, weaponBroken: true })).toBe(6);
  });
});

describe('createCombat', () => {
  const playerStats = {
    health: 100,
    maxHealth: 100,
    power: 5,
    guard: 5,
    speed: 5,
    critWindowMult: 1,
    weaponBroken: false,
  };
  const opponent = CONFIG.opponents[0]; // Brute: hp 40, power 4, guard 2

  it('initializes both combatants and flags', () => {
    const c = createCombat(playerStats, opponent, CONFIG);
    expect(c.player.health).toBe(100);
    expect(c.enemy.health).toBe(40);
    expect(c.enemy.name).toBe('The Brute');
    expect(c.guardDropped).toBe(false);
    expect(c.counterReady).toBe(false);
    expect(c.blockedThisFight).toBe(false);
    expect(c.log).toEqual([]);
  });
});

describe('applyPlayerAction: strike', () => {
  const playerStats = {
    health: 100,
    maxHealth: 100,
    power: 5,
    guard: 5,
    speed: 5,
    critWindowMult: 1,
    weaponBroken: false,
  };
  const opponent = CONFIG.opponents[0]; // Brute: hp 40, power 4, guard 2

  it('damages the enemy on a hit and logs it', () => {
    const c = createCombat(playerStats, opponent, CONFIG);
    const next = applyPlayerAction(c, 'strike', TIMING.HIT, CONFIG);
    // (10 + 5)*1.0 - 2 = 13 -> enemy 40 - 13 = 27
    expect(next.enemy.health).toBe(27);
    expect(next.log.length).toBeGreaterThan(0);
  });

  it('does nothing to enemy health on a miss', () => {
    const c = createCombat(playerStats, opponent, CONFIG);
    const next = applyPlayerAction(c, 'strike', TIMING.MISS, CONFIG);
    expect(next.enemy.health).toBe(40);
  });
});

describe('applyPlayerAction: block', () => {
  const playerStats = {
    health: 100,
    maxHealth: 100,
    power: 5,
    guard: 5,
    speed: 5,
    critWindowMult: 1,
    weaponBroken: false,
  };
  const opponent = CONFIG.opponents[0]; // Brute: hp 40, power 4, guard 2

  it('sets counterReady and marks blockedThisFight', () => {
    const c = createCombat(playerStats, opponent, CONFIG);
    const next = applyPlayerAction(c, 'block', TIMING.HIT, CONFIG);
    expect(next.counterReady).toBe(true);
    expect(next.blockedThisFight).toBe(true);
  });
});

describe('applyPlayerAction: feint', () => {
  const playerStats = {
    health: 100,
    maxHealth: 100,
    power: 5,
    guard: 5,
    speed: 5,
    critWindowMult: 1,
    weaponBroken: false,
  };
  const opponent = CONFIG.opponents[0]; // Brute: hp 40, power 4, guard 2

  it('deals reduced damage and sets a follow-up bonus', () => {
    const c = createCombat(playerStats, opponent, CONFIG);
    const next = applyPlayerAction(c, 'feint', TIMING.HIT, CONFIG);
    // feint HIT = (6 + 5)*1.0 - 2 = 9 -> enemy 40 - 9 = 31
    expect(next.enemy.health).toBe(31);
    expect(next.pendingBonus).toBe(CONFIG.combat.actions.feint.nextHitBonus);
  });

  it('applies the follow-up bonus to the next strike, then clears it', () => {
    const c = createCombat(playerStats, opponent, CONFIG);
    const afterFeint = applyPlayerAction(c, 'feint', TIMING.HIT, CONFIG);
    const afterStrike = applyPlayerAction(afterFeint, 'strike', TIMING.HIT, CONFIG);
    // strike HIT with 1.5x feint bonus = (10 + 5)*1.0*1.5 - 2 = 20.5 -> 21
    expect(afterFeint.enemy.health - afterStrike.enemy.health).toBe(21);
    expect(afterStrike.pendingBonus).toBe(0);
  });
});

describe('isFightOver / fightWinner', () => {
  const playerStats = {
    health: 100,
    maxHealth: 100,
    power: 5,
    guard: 5,
    speed: 5,
    critWindowMult: 1,
    weaponBroken: false,
  };
  const opponent = CONFIG.opponents[0]; // Brute: hp 40, power 4, guard 2

  it('detects enemy defeat', () => {
    const c = createCombat(playerStats, { ...opponent, health: 5 }, CONFIG);
    const next = applyPlayerAction(c, 'heavy', TIMING.CRIT, CONFIG);
    expect(isFightOver(next)).toBe(true);
    expect(fightWinner(next)).toBe('player');
  });

  it('reports no winner while both stand', () => {
    const c = createCombat(playerStats, opponent, CONFIG);
    expect(isFightOver(c)).toBe(false);
    expect(fightWinner(c)).toBe(null);
  });
});

describe('upgradeTier', () => {
  it('bumps a tier up one step, capped at crit', () => {
    expect(upgradeTier(TIMING.MISS)).toBe(TIMING.GRAZE);
    expect(upgradeTier(TIMING.GRAZE)).toBe(TIMING.HIT);
    expect(upgradeTier(TIMING.HIT)).toBe(TIMING.CRIT);
    expect(upgradeTier(TIMING.CRIT)).toBe(TIMING.CRIT);
  });
});

describe('applyPress', () => {
  const playerStats = {
    health: 100,
    maxHealth: 100,
    power: 5,
    guard: 5,
    speed: 5,
    critWindowMult: 1,
    weaponBroken: false,
  };
  const opponent = CONFIG.opponents[0]; // Brute: hp 40, power 4, guard 2

  it('deals extra damage and drops guard', () => {
    const c = createCombat(playerStats, opponent, CONFIG);
    const afterHit = applyPlayerAction(c, 'strike', TIMING.HIT, CONFIG); // enemy 27
    const pressed = applyPress(afterHit, TIMING.HIT, CONFIG);
    expect(pressed.enemy.health).toBeLessThan(afterHit.enemy.health);
    expect(pressed.guardDropped).toBe(true);
  });

  it('hits harder than a normal strike (1.6x bonus)', () => {
    const c = createCombat(playerStats, opponent, CONFIG);
    // press HIT = (10 + 5) * 1.6 - 2 = 22, vs strike HIT = 13
    const pressed = applyPress(c, TIMING.HIT, CONFIG);
    expect(40 - pressed.enemy.health).toBe(22);
    const struck = applyPlayerAction(c, 'strike', TIMING.HIT, CONFIG);
    expect(40 - pressed.enemy.health).toBeGreaterThan(40 - struck.enemy.health);
  });

  it('does not carry a feint follow-up bonus past the press', () => {
    const c = createCombat(playerStats, opponent, CONFIG);
    const afterFeint = applyPlayerAction(c, 'feint', TIMING.HIT, CONFIG);
    expect(afterFeint.pendingBonus).toBe(CONFIG.combat.actions.feint.nextHitBonus);
    const pressed = applyPress(afterFeint, TIMING.HIT, CONFIG);
    expect(pressed.pendingBonus).toBe(0);
  });
});

describe('enemyTurn', () => {
  const playerStats = {
    health: 100,
    maxHealth: 100,
    power: 5,
    guard: 5,
    speed: 5,
    critWindowMult: 1,
    weaponBroken: false,
  };
  const opponent = CONFIG.opponents[0]; // Brute: hp 40, power 4, guard 2

  it('damages the player and clears guardDropped after acting', () => {
    const c = createCombat(playerStats, opponent, CONFIG);
    c.guardDropped = true;
    const rng = makeRng(1);
    const next = enemyTurn(c, rng, CONFIG);
    expect(next.player.health).toBeLessThanOrEqual(100);
    expect(next.guardDropped).toBe(false);
    expect(next.log.length).toBeGreaterThan(c.log.length);
  });

  it('reduces incoming damage when a counter is ready, then consumes it', () => {
    const base = createCombat(playerStats, CONFIG.opponents[2], CONFIG); // Veteran hits harder
    const guarded = { ...base, counterReady: true, player: { ...base.player } };
    const unguarded = { ...base, counterReady: false, player: { ...base.player } };
    const a = enemyTurn(guarded, makeRng(5), CONFIG);
    const b = enemyTurn(unguarded, makeRng(5), CONFIG);
    expect(100 - a.player.health).toBeLessThanOrEqual(100 - b.player.health);
    expect(a.counterReady).toBe(false);
  });
});

describe('markPressable', () => {
  const playerStats = {
    health: 100,
    maxHealth: 100,
    power: 5,
    guard: 5,
    speed: 5,
    critWindowMult: 1,
    weaponBroken: false,
  };
  const opponent = CONFIG.opponents[0]; // Brute: hp 40, power 4, guard 2

  it('offers a press after a damaging hit', () => {
    const c = createCombat(playerStats, opponent, CONFIG);
    const afterHit = applyPlayerAction(c, 'strike', TIMING.HIT, CONFIG);
    const flagged = markPressable(afterHit, 'strike', TIMING.HIT);
    expect(flagged.canPress).toBe(true);
  });

  it('does not offer a press after a miss', () => {
    const c = createCombat(playerStats, opponent, CONFIG);
    const afterMiss = applyPlayerAction(c, 'strike', TIMING.MISS, CONFIG);
    expect(markPressable(afterMiss, 'strike', TIMING.MISS).canPress).toBe(false);
  });

  it('does not offer a press after a block', () => {
    const c = createCombat(playerStats, opponent, CONFIG);
    const afterBlock = applyPlayerAction(c, 'block', TIMING.HIT, CONFIG);
    expect(markPressable(afterBlock, 'block', TIMING.HIT).canPress).toBe(false);
  });
});
