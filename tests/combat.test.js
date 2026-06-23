import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { TIMING, timingWindowWidth, resolveTiming, computeDamage, createCombat, applyPlayerAction, isFightOver, fightWinner } from '../src/combat.js';

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
    expect(computeDamage({ baseDamage: 1, power: 0, guard: 99, timing: TIMING.HIT, config: CONFIG }))
      .toBe(0);
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
    health: 100, maxHealth: 100, power: 5, guard: 5, speed: 5,
    critWindowMult: 1, weaponBroken: false,
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
    health: 100, maxHealth: 100, power: 5, guard: 5, speed: 5,
    critWindowMult: 1, weaponBroken: false,
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
    health: 100, maxHealth: 100, power: 5, guard: 5, speed: 5,
    critWindowMult: 1, weaponBroken: false,
  };
  const opponent = CONFIG.opponents[0]; // Brute: hp 40, power 4, guard 2

  it('sets counterReady and marks blockedThisFight', () => {
    const c = createCombat(playerStats, opponent, CONFIG);
    const next = applyPlayerAction(c, 'block', TIMING.HIT, CONFIG);
    expect(next.counterReady).toBe(true);
    expect(next.blockedThisFight).toBe(true);
  });
});

describe('isFightOver / fightWinner', () => {
  const playerStats = {
    health: 100, maxHealth: 100, power: 5, guard: 5, speed: 5,
    critWindowMult: 1, weaponBroken: false,
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
