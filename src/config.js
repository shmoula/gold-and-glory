// src/config.js

export const CONFIG = {
  startingGold: 100,
  startingStats: { power: 5, guard: 5, speed: 5 },

  player: {
    maxHealth: 100,
  },

  weapon: {
    maxDurability: 30,
    durabilityLossPerFight: 3,
    repairCostPerPoint: 15,
    brokenDamageMultiplier: 0.5, // applied when durability <= 0
  },

  training: {
    baseCost: 80,
    scaling: 1.6,
    statPerLevel: 2, // each training level adds this to the stat
  },

  heal: {
    costPerInjury: 40,
  },

  arena: {
    taxRate: 0.2,
    bribedTaxRate: 0.05,
    bribeCost: 60,
  },

  sponsor: {
    unlockWins: 2,
    stipendPerFight: 30,
    objectiveBonus: 50,
    objective: 'Win without blocking',
  },

  gear: {
    shield: { id: 'shield', name: 'Shield', cost: 200, guardBonus: 3 },
    blade: { id: 'blade', name: 'Better Blade', cost: 350, powerBonus: 4 },
    charm: { id: 'charm', name: 'Lucky Charm', cost: 150, critWindowMult: 1.5 },
  },

  combat: {
    baseTimingWidth: 0.18, // half-width of the "hit" window as a fraction of the bar
    speedTimingBonus: 0.01, // added per point of effective speed
    timingTierRatios: { crit: 0.3, hit: 1.0, graze: 1.6 }, // multiples of window width
    timingMult: { miss: 0, graze: 0.5, hit: 1.0, crit: 2.0 },
    meterPeriodMs: { base: 1400, perTier: -60, min: 900 }, // one-way sweep duration in ms
    sweetCenter: { min: 0.35, max: 0.75 }, // sweet spot seeded per player turn
    pressAttack: { bonusMultiplier: 0.6 }, // extra damage on press, as a fraction
    actions: {
      strike: { baseDamage: 10 },
      heavy: { baseDamage: 22 },
      block: { damageReduction: 0.6 }, // fraction of incoming damage removed
      feint: { baseDamage: 6, nextHitBonus: 0.5 }, // sets up follow-up
    },
    enemyTierWeights: { miss: 0.15, graze: 0.3, hit: 0.4, crit: 0.15 },
  },

  opponents: [
    {
      id: 'brute',
      name: 'The Brute',
      tier: 'safe',
      health: 40,
      power: 4,
      guard: 2,
      speed: 3,
      purse: 50,
      deathRisk: 0,
    },
    {
      id: 'journeyman',
      name: 'The Journeyman',
      tier: 'standard',
      health: 70,
      power: 7,
      guard: 4,
      speed: 5,
      purse: 120,
      deathRisk: 0.05,
    },
    {
      id: 'veteran',
      name: 'The Veteran',
      tier: 'hard',
      health: 110,
      power: 11,
      guard: 7,
      speed: 7,
      purse: 280,
      deathRisk: 0.15,
    },
    {
      id: 'champion',
      name: 'The Champion',
      tier: 'death-match',
      health: 170,
      power: 16,
      guard: 10,
      speed: 10,
      purse: 700,
      deathRisk: 0.35,
    },
  ],

  // Snark asides (spec §6.8/§9): content, not markup. The parentheses are added by the
  // renderer. Each is <= 40 chars, contains no numbers, and never contradicts the mechanics
  // clause it sits beside. Gear keys must match the `gear` ids above.
  snark: {
    repair: 'It barely works',
    heal: 'We have leeches!',
    bribe: 'A donation, officially',
    charm: 'A sock?',
    blade: 'Slightly less blunt',
    shield: 'A big plate. For hiding',
    sponsorReward: 'He loves losers',
    // §6.6's ledger aside: the arena's cut lands with a stamp, and the player should feel it.
    tax: 'Ouch',
    taunt: "Time your hit! (Or don't!)",
    // §6.5 poster asides. `player` is your own card; the rest are keyed by opponent id, so a
    // new opponent fails tests/config.test.js until it is given one.
    player: 'Still upright, technically',
    brute: 'Mostly muscle, no plan',
    journeyman: 'Has done this before, sadly',
    veteran: 'Missing an ear. Not his own',
    champion: 'The crowd knows his name',
    // §6.9 log asides.
    logWhiff: 'The crowd studies its sandals',
    logPress: 'Bold. The guard was optional',
  },

  // Spec §6.14's endings gallery: one entry per terminal state game.js can write, so the keys
  // are `ended` values, not display names. The title is the card's heading (a locked card adds
  // its own "?"); the epitaph is a §6.8 aside — the renderer supplies the parentheses, so these
  // strings carry none, stay under 40 characters and state no number.
  //
  // `stamp` is §6.13's screen-level verdict: the modifier and the copy travel together, so no
  // screen can pair "YOU DIED" with the victory colour. It lives here rather than in a table
  // inside the renderer because a renderer-side table is a *second* list of these keys, and the
  // two drift silently — a fourth ending added below used to render a stampless gallery with
  // the whole suite green. Order matters too: the gallery is drawn in the order these keys are
  // declared. §9 sets the punctuation — a win earns its exclamation (retiring is a win you
  // chose, so it takes --victory with its own copy: "VICTORY!" is already spent on the result
  // screen), death gets neither irony nor softening.
  endings: {
    'win-circuit': {
      title: 'Champion of the Circuit',
      epitaph: "You got a belt. It doesn't fit.",
      stamp: { variant: 'victory', text: 'CHAMPION!' },
    },
    retired: {
      title: 'Retired Rich',
      epitaph: 'You have all the gold. And no friends.',
      stamp: { variant: 'victory', text: 'RETIRED RICH!' },
    },
    dead: {
      title: 'You Died',
      epitaph: 'The crowd loved it.',
      stamp: { variant: 'death', text: 'YOU DIED' },
    },
  },

  deathRecaps: [
    'Bled out while a sponsor banner unfurled overhead.',
    'Tripped on a discarded turnip, impaled on own blade.',
    'The crowd cheered. You did not get up.',
    'Officially ruled "an administrative oversight."',
  ],
};
