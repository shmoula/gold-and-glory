import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { createGameState } from '../src/state.js';
import { startFight, resolveFightOutcome, retire } from '../src/game.js';

// Derived, never hand-listed: a fourth gear item must fail these until it has snark,
// because the hub renders `config.snark[g.id] ?? ''`, which swallows a missing entry.
const GEAR_KEYS = Object.keys(CONFIG.gear);
const BUTTON_SNARK_KEYS = ['repair', 'heal', 'bribe', ...GEAR_KEYS];
// Same rule for the §6.5 poster asides: a fifth opponent must fail until it has one, because
// the fight screen reads `config.snark[opponent.id]` and an empty aside renders as "()".
const OPPONENT_KEYS = CONFIG.opponents.map((o) => o.id);
const POSTER_SNARK_KEYS = ['player', ...OPPONENT_KEYS];

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

  it('has a snark aside for every combatant poster the fight screen renders', () => {
    expect(OPPONENT_KEYS.length).toBeGreaterThan(0); // guard against a vacuous loop
    for (const key of POSTER_SNARK_KEYS) {
      expect(typeof CONFIG.snark[key], `${key} needs a poster aside`).toBe('string');
      expect(CONFIG.snark[key]?.length ?? 0, `${key} aside must not be empty`)
        .toBeGreaterThan(0);
    }
  });

  // The ledger reads `config.snark.tax` for the arena-cut line (spec §6.6/§6.8: snark is
  // content, not markup). A missing entry renders the row with no aside at all, silently.
  it('has a snark aside for the ledger lines that carry one', () => {
    for (const key of ['tax', 'sponsorReward']) {
      expect(typeof CONFIG.snark[key], `${key} needs a ledger aside`).toBe('string');
      expect(CONFIG.snark[key].length, `${key} aside must not be empty`).toBeGreaterThan(0);
      expect(CONFIG.snark[key], `${key} aside must not be parenthesized`).not.toMatch(/[()]/);
    }
  });

  it('keeps snark asides inside the §6.8 grammar', () => {
    for (const [key, aside] of Object.entries(CONFIG.snark)) {
      expect(aside.length, `${key} aside must be <= 40 chars`).toBeLessThanOrEqual(40);
      expect(aside, `${key} aside must not contain numbers`).not.toMatch(/\d/);
    }
    // Button and poster asides are wrapped in parentheses by the renderer, so the strings must
    // not carry their own. (`taunt` is a standalone hint, not an aside — exempt.)
    for (const key of [...BUTTON_SNARK_KEYS, ...POSTER_SNARK_KEYS]) {
      expect(CONFIG.snark[key], `${key} aside must not be parenthesized`).not.toMatch(/[()]/);
    }
  });

  // Spec §6.14's gallery renders one card per ending, keyed by the `ended` value game.js
  // writes. The keys are *derived by ending the game three ways*, never hand-listed: a renamed
  // terminal state must fail here rather than render a card titled `undefined`.
  it('has an ending for every terminal state the game can reach (§6.14)', () => {
    const start = createGameState(1, CONFIG);
    const champion = { ...start, currentOpponentIndex: 3 }; // deathRisk 0.35, last of the card
    const ALWAYS = () => 0; // rngChance(0.35) fires; rngInt picks the first death recap
    const reached = [
      retire(start).ended,
      resolveFightOutcome(startFight(champion, CONFIG), true, ALWAYS, CONFIG).ended,
      resolveFightOutcome(startFight(champion, CONFIG), false, ALWAYS, CONFIG).ended,
    ];
    expect(new Set(reached).size, 'three distinct endings').toBe(3);
    expect(Object.keys(CONFIG.endings).sort()).toEqual([...reached].sort());
    for (const key of reached) {
      expect(CONFIG.endings[key].title.length, `${key} needs a title`).toBeGreaterThan(0);
      expect(CONFIG.endings[key].epitaph.length, `${key} needs an epitaph`).toBeGreaterThan(0);
    }
  });

  // §6.13's stamp copy travels *with the ending*, in config, not in a hand-listed table inside
  // the renderer: a table the renderer keeps to itself is a second list of the same keys, and a
  // fourth ending added to `endings` alone used to render a stampless screen with no test
  // noticing. §9 sets the punctuation, so it is asserted per variant rather than per key —
  // a win earns its exclamation, death gets neither irony nor softening.
  it('gives every ending its §6.13 stamp copy, punctuated per §9', () => {
    const entries = Object.entries(CONFIG.endings);
    expect(entries.length).toBeGreaterThan(0); // guard against a vacuous loop
    for (const [key, ending] of entries) {
      expect(ending.stamp, `${key} needs a §6.13 stamp`).toBeTruthy();
      expect(['victory', 'defeat', 'death'], `${key} stamp variant`)
        .toContain(ending.stamp.variant);
      expect(ending.stamp.text, `${key} stamp copy`).toMatch(/^[A-Z][A-Z' ]*[A-Z]!?$/);
      if (ending.stamp.variant === 'victory') {
        expect(ending.stamp.text, `${key}: §9 gives victory an exclamation`).toMatch(/!$/);
      } else {
        expect(ending.stamp.text, `${key}: §9 gives death no softening`).not.toMatch(/[!.?]$/);
      }
    }
  });

  // The epitaph is a §6.8 aside like any other: the renderer adds the parentheses, so the
  // string must not carry its own, and an aside never states a number.
  it('keeps ending epitaphs inside the §6.8 aside grammar', () => {
    const entries = Object.entries(CONFIG.endings);
    expect(entries.length).toBeGreaterThan(0); // guard against a vacuous loop
    for (const [key, ending] of entries) {
      expect(ending.epitaph.length, `${key} epitaph must be <= 40 chars`).toBeLessThanOrEqual(40);
      expect(ending.epitaph, `${key} epitaph must not contain numbers`).not.toMatch(/\d/);
      expect(ending.epitaph, `${key} epitaph must not be parenthesized`).not.toMatch(/[()]/);
    }
  });

  it('has combat timing tiers and multipliers', () => {
    expect(CONFIG.combat.timingMult.miss).toBe(0);
    expect(CONFIG.combat.timingMult.crit).toBeGreaterThan(CONFIG.combat.timingMult.hit);
  });

  it('has meter sweep durations per the design-system spec (§6.4)', () => {
    expect(CONFIG.combat.meterPeriodMs).toEqual({ base: 1400, perTier: -60, min: 900 });
  });

  it('has a per-turn sweet-spot band inside the track (§6.4)', () => {
    expect(CONFIG.combat.sweetCenter).toEqual({ min: 0.35, max: 0.75 });
    // A band that touched an edge would seed a sweet spot the cursor only crosses once
    // per sweep instead of twice, halving the window on that turn.
    expect(CONFIG.combat.sweetCenter.min).toBeGreaterThan(0);
    expect(CONFIG.combat.sweetCenter.max).toBeLessThan(1);
  });
});
