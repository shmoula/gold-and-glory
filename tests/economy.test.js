// tests/economy.test.js
import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import {
  trainingCost, repairCost, healCost, canAfford,
} from '../src/economy.js';
import {
  arenaTax, fightPayout, sponsorIncome,
} from '../src/economy.js';

describe('trainingCost', () => {
  it('costs base at level 0 and scales x1.6 per level', () => {
    expect(trainingCost(0, CONFIG)).toBe(80);
    expect(trainingCost(1, CONFIG)).toBe(128); // 80 * 1.6
    expect(trainingCost(2, CONFIG)).toBe(205); // 80 * 1.6^2 = 204.8 -> 205
  });
});

describe('repairCost', () => {
  it('charges per missing durability point', () => {
    expect(repairCost(3, CONFIG)).toBe(45);
    expect(repairCost(0, CONFIG)).toBe(0);
  });
});

describe('healCost', () => {
  it('charges per injury', () => {
    expect(healCost(2, CONFIG)).toBe(80);
    expect(healCost(0, CONFIG)).toBe(0);
  });
});

describe('canAfford', () => {
  it('is true when gold >= cost', () => {
    expect(canAfford(100, 80)).toBe(true);
    expect(canAfford(80, 80)).toBe(true);
    expect(canAfford(79, 80)).toBe(false);
  });
});

describe('arenaTax', () => {
  it('takes 20% normally and 5% when bribed', () => {
    expect(arenaTax(120, false, CONFIG)).toBe(24);
    expect(arenaTax(120, true, CONFIG)).toBe(6);
  });
});

describe('fightPayout', () => {
  it('is purse minus tax', () => {
    expect(fightPayout(120, false, CONFIG)).toBe(96);  // 120 - 24
    expect(fightPayout(120, true, CONFIG)).toBe(114);  // 120 - 6
  });
});

describe('sponsorIncome', () => {
  it('is stipend, plus objective bonus when met', () => {
    expect(sponsorIncome(false, CONFIG)).toBe(30);
    expect(sponsorIncome(true, CONFIG)).toBe(80); // 30 + 50
  });
});
