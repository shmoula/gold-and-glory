// tests/game.test.js
import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { createGameState } from '../src/state.js';
import {
  effectiveStats, trainStat, repairWeapon, healInjuries, buyGear, bribeOfficial,
} from '../src/game.js';

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
