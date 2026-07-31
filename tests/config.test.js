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

// §9's stamp punctuation, one entry per §6.13 variant: a win earns its exclamation
// ("VICTORY!"), a defeat takes a deadpan period ("DEFEAT."), and death gets neither irony nor
// softening ("YOU DIED"). The mark each variant owns is the whole rule, so it is a table rather
// than a branch — and the table doubles as the allowlist of variants, so the two cannot drift.
const STAMP_MARK = { victory: '!', defeat: '.', death: '' };

// The §9 guard for one stamp, factored out so the same code runs over `CONFIG.endings` and over
// the fixtures below. `endings` carries no defeat ending today, so read over config alone the
// defeat rule is never exercised — which is exactly how this guard came to demand that "DEFEAT."
// give up its period, an assertion that would have failed the first spec-correct defeat added.
function checkStamp(key, ending) {
  expect(ending.stamp, `${key} needs a §6.13 stamp`).toBeTruthy();
  const { variant, text } = ending.stamp;
  expect(Object.keys(STAMP_MARK), `${key} stamp variant`).toContain(variant);
  // `?? ''` so that an unknown variant is rejected by the line above and reported as a bad
  // variant — not swallowed into an `undefined` inside the punctuation message below.
  const mark = STAMP_MARK[variant] ?? '';
  // The words alone: display case, no terminal mark. Then the text must be exactly those words
  // plus this variant's mark — which rejects a missing mark, a borrowed one, and a doubled one.
  const body = String(text).replace(/[!.?]+$/, '');
  expect(body, `${key} stamp copy must be display-case words`).toMatch(/^[A-Z][A-Z' ]*[A-Z]$/);
  expect(text, `${key}: §9 punctuates a ${variant} stamp "${body}${mark}"`).toBe(`${body}${mark}`);
}

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
      'safe',
      'standard',
      'hard',
      'death-match',
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
    for (const [key, ending] of entries) checkStamp(key, ending);
  });

  // …and the guard is run over fixtures as well as over config, because config can only exercise
  // the variants it happens to use. `endings` has no defeat entry, so the accepted/rejected pairs
  // below are the only thing holding `defeat` to its period until one is added.
  it('accepts each variant punctuated as §9 writes it', () => {
    for (const stamp of [
      { variant: 'victory', text: 'VICTORY!' }, // §9's own three examples…
      { variant: 'defeat', text: 'DEFEAT.' },
      { variant: 'death', text: 'YOU DIED' },
      { variant: 'victory', text: 'CHAMPION!' }, // …and copy that is not the example
      { variant: 'defeat', text: "THE LION'S SHARE." },
      { variant: 'death', text: 'CARRIED OUT' },
    ]) {
      expect(() => checkStamp(stamp.variant, { stamp }), `${stamp.text} is §9-correct`)
        .not.toThrow();
    }
  });

  it('rejects a stamp wearing the wrong terminal mark', () => {
    for (const stamp of [
      { variant: 'victory', text: 'VICTORY' }, // no mark where §9 demands one
      { variant: 'defeat', text: 'DEFEAT' },
      { variant: 'victory', text: 'VICTORY.' }, // the mark another variant owns
      { variant: 'defeat', text: 'DEFEAT!' },
      { variant: 'death', text: 'YOU DIED!' }, // irony and softening, both barred
      { variant: 'death', text: 'YOU DIED.' },
      { variant: 'defeat', text: 'DEFEAT?' }, // a mark §9 gives nobody
      { variant: 'defeat', text: 'DEFEAT!.' }, // and no smuggling one in ahead of the right one
      { variant: 'triumph', text: 'TRIUMPH' }, // a variant §6.13 has no stamp for
      { variant: 'defeat', text: 'Defeat.' }, // display case is not optional
    ]) {
      expect(() => checkStamp(stamp.variant, { stamp }), `${stamp.variant}/${stamp.text}`)
        .toThrow();
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
