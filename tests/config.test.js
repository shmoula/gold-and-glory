import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';

// Derived, never hand-listed: a fourth gear item must fail these until it has snark,
// because the hub renders `config.snark[g.id] ?? ''`, which swallows a missing entry.
const GEAR_KEYS = Object.keys(CONFIG.gear);
const BUTTON_SNARK_KEYS = ['repair', 'heal', 'bribe', ...GEAR_KEYS];

describe('CONFIG', () => {
  it('has starting wallet and player vitals', () => {
    expect(CONFIG.startingGold).toBe(100);
    expect(CONFIG.player.maxHealth).toBe(100);
    expect(CONFIG.startingStats).toEqual({ power: 5, guard: 5, speed: 5 });
  });

  it('has weapon durability + repair settings', () => {
    expect(CONFIG.weapon.maxDurability).toBe(30);
    expect(CONFIG.weapon.durabilityLossPerFight).toBe(3);
    expect(CONFIG.weapon.repairCostPerPoint).toBe(15);
    expect(CONFIG.weapon.brokenDamageMultiplier).toBeLessThan(1);
  });

  it('has training, heal, arena, sponsor economy values', () => {
    expect(CONFIG.training.baseCost).toBe(80);
    expect(CONFIG.training.scaling).toBeCloseTo(1.6);
    expect(CONFIG.heal.costPerInjury).toBe(40);
    expect(CONFIG.arena.taxRate).toBeCloseTo(0.2);
    expect(CONFIG.arena.bribedTaxRate).toBeCloseTo(0.05);
    expect(CONFIG.arena.bribeCost).toBe(60);
    expect(CONFIG.sponsor.unlockWins).toBe(2);
    expect(CONFIG.sponsor.stipendPerFight).toBe(30);
    expect(CONFIG.sponsor.objectiveBonus).toBe(50);
  });

  it('has 3 gear items with costs from the spec', () => {
    expect(CONFIG.gear.shield.cost).toBe(200);
    expect(CONFIG.gear.blade.cost).toBe(350);
    expect(CONFIG.gear.charm.cost).toBe(150);
  });

  it('has 4 escalating opponents with purses from the spec', () => {
    expect(CONFIG.opponents).toHaveLength(4);
    expect(CONFIG.opponents.map((o) => o.purse)).toEqual([50, 120, 280, 700]);
    expect(CONFIG.opponents.map((o) => o.tier)).toEqual([
      'safe', 'standard', 'hard', 'death-match',
    ]);
  });

  it('has a snark aside for every sink the hub renders', () => {
    expect(GEAR_KEYS.length).toBeGreaterThan(0); // guard against a vacuous loop
    for (const key of BUTTON_SNARK_KEYS) {
      expect(typeof CONFIG.snark[key], `${key} needs a snark aside`).toBe('string');
      expect(CONFIG.snark[key]?.length ?? 0, `${key} snark must not be empty`)
        .toBeGreaterThan(0);
    }
  });

  it('keeps snark asides inside the §6.8 grammar', () => {
    for (const [key, aside] of Object.entries(CONFIG.snark)) {
      expect(aside.length, `${key} aside must be <= 40 chars`).toBeLessThanOrEqual(40);
      expect(aside, `${key} aside must not contain numbers`).not.toMatch(/\d/);
    }
    // Button asides are wrapped in parentheses by the renderer, so the strings must not
    // carry their own. (`taunt` is a standalone hint, not a button aside — exempt.)
    for (const key of BUTTON_SNARK_KEYS) {
      expect(CONFIG.snark[key], `${key} aside must not be parenthesized`).not.toMatch(/[()]/);
    }
  });

  it('has combat timing tiers and multipliers', () => {
    expect(CONFIG.combat.timingMult.miss).toBe(0);
    expect(CONFIG.combat.timingMult.crit).toBeGreaterThan(CONFIG.combat.timingMult.hit);
  });

  it('has meter sweep durations per the design-system spec (§6.4)', () => {
    expect(CONFIG.combat.meterPeriodMs).toEqual({ base: 1400, perTier: -60, min: 900 });
  });
});
