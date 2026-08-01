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

  it('a landed hit cannot be mitigated below the floor (item 24)', () => {
    expect(
      computeDamage({ baseDamage: 1, power: 0, guard: 99, timing: TIMING.HIT, config: CONFIG })
    ).toBe(CONFIG.combat.minHitDamage);
  });

  it('a miss still deals exactly 0', () => {
    expect(
      computeDamage({ baseDamage: 99, power: 99, guard: 0, timing: TIMING.MISS, config: CONFIG })
    ).toBe(0);
  });

  it('reads the floor from config, not a literal', () => {
    const config = { ...CONFIG, combat: { ...CONFIG.combat, minHitDamage: 3 } };
    expect(computeDamage({ baseDamage: 1, power: 0, guard: 99, timing: TIMING.HIT, config })).toBe(
      3
    );
  });

  it('block cannot reduce a landed hit below the floor', () => {
    // rng() = 0.99 rolls the top tier (weights accumulate to crit at 1.0), so the enemy lands
    // a crit into a 999 guard: computeDamage floors it to 1, then block's 60% cut rounds it
    // back to 0 — the floor must be re-applied after the cut or the stall survives.
    const player = {
      health: 100,
      maxHealth: 100,
      power: 5,
      guard: 999,
      speed: 5,
      critWindowMult: 1,
      weaponBroken: false,
    };
    let combat = createCombat(player, CONFIG.opponents[0], CONFIG);
    combat = applyPlayerAction(combat, 'block', TIMING.MISS, CONFIG);
    const before = combat.player.health;
    combat = enemyTurn(combat, () => 0.99, CONFIG);
    expect(before - combat.player.health).toBe(CONFIG.combat.minHitDamage);
  });

  it('a max-guard turtle cannot stall forever (the item-24 fight)', () => {
    const rng = makeRng(7);
    const player = {
      health: 100,
      maxHealth: 100,
      power: 5,
      guard: 999,
      speed: 5,
      critWindowMult: 1,
      weaponBroken: false,
    };
    let combat = createCombat(player, CONFIG.opponents[0], CONFIG);
    let exchanges = 0;
    while (!isFightOver(combat) && exchanges < 2000) {
      combat = applyPlayerAction(combat, 'block', TIMING.MISS, CONFIG);
      if (!isFightOver(combat)) combat = enemyTurn(combat, rng, CONFIG);
      exchanges += 1;
    }
    expect(isFightOver(combat)).toBe(true);
    expect(fightWinner(combat)).toBe('enemy');
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

  // Backlog item 19. The seed exists so neither the renderer nor the rAF loop needs its own
  // `?? 0.5` fallback, and until now nothing pinned its value: main.js re-seeds before the
  // first player turn, so mutating this to a hardcoded 0.5 — outside the *centre* of the band
  // though still inside it — changed no pixel any test looked at. Derived from the config band
  // rather than restated as 0.55, so retuning the band carries the default with it.
  it('is born at the centre of the configured sweet-spot band (§6.4)', () => {
    const { min, max } = CONFIG.combat.sweetCenter;
    const c = createCombat(playerStats, opponent, CONFIG);
    expect(c.sweet).toBeCloseTo((min + max) / 2, 10);
    expect(c.sweet).toBeGreaterThan(min);
    expect(c.sweet).toBeLessThan(max);
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

// Spec §6.9: the log shows turn numbers, not line numbers. One exchange pushes two entries
// (the player's action and the enemy's answer) or three with a press, so numbering by entry
// index ran the displayed turn counter at roughly double the real one.
describe('combat log turn stamps (spec §6.9)', () => {
  const playerStats = {
    health: 100,
    maxHealth: 100,
    power: 5,
    guard: 5,
    speed: 5,
    critWindowMult: 1,
    weaponBroken: false,
  };
  const opponent = CONFIG.opponents[3]; // Champion: 170 hp, so a long fight has room to run
  const fresh = () => createCombat(playerStats, opponent, CONFIG);
  const turns = (c) => c.log.map((e) => e.turn);

  it('starts a fight on turn 1 with an empty log', () => {
    const c = fresh();
    expect(c.log).toEqual([]);
    expect(c.turn).toBe(1);
  });

  it('stamps the player action and the enemy answer with the same turn', () => {
    let c = applyPlayerAction(fresh(), 'strike', TIMING.HIT, CONFIG);
    expect(turns(c)).toEqual([1]);
    c = enemyTurn(c, makeRng(1), CONFIG);
    expect(c.log).toHaveLength(2);
    expect(turns(c)).toEqual([1, 1]); // two entries, one turn — this is the bug
    expect(c.turn).toBe(2); // …and the next exchange is turn 2
    c = applyPlayerAction(c, 'strike', TIMING.HIT, CONFIG);
    expect(turns(c)).toEqual([1, 1, 2]);
  });

  // Under eight entries the window shows the whole fight, so the first stamp must be T1 —
  // an off-by-one in the turn source is invisible in a windowed log but not here.
  it('numbers a short fight from one, with no gaps', () => {
    let c = fresh();
    for (let i = 0; i < 3; i += 1) {
      c = applyPlayerAction(c, 'strike', TIMING.GRAZE, CONFIG);
      c = enemyTurn(c, makeRng(i + 1), CONFIG);
    }
    expect(c.log).toHaveLength(6);
    expect(turns(c)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('keeps a press inside the exchange it presses', () => {
    let c = applyPlayerAction(fresh(), 'strike', TIMING.HIT, CONFIG);
    c = applyPress(c, TIMING.HIT, CONFIG); // no enemy answer between the two
    c = enemyTurn(c, makeRng(2), CONFIG);
    expect(c.log).toHaveLength(3);
    expect(turns(c)).toEqual([1, 1, 1]);
    expect(c.turn).toBe(2);
  });

  // The whole point: the highest turn number is the number of exchanges fought, never the
  // number of lines printed. Entry-index numbering put this at 20.
  it('counts exchanges, not lines, over a long fight', () => {
    let c = fresh();
    const EXCHANGES = 10;
    for (let i = 0; i < EXCHANGES; i += 1) {
      c = applyPlayerAction(c, 'feint', TIMING.GRAZE, CONFIG);
      c = enemyTurn(c, makeRng(i + 1), CONFIG);
    }
    expect(c.log.length).toBeGreaterThan(EXCHANGES); // more lines than turns…
    expect(Math.max(...turns(c))).toBe(EXCHANGES); // …but the count is of exchanges
    expect(c.turn).toBe(EXCHANGES + 1);
  });
});
