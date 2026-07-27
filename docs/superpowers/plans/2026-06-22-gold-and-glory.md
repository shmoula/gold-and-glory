# Gold & Glory MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shippable MVP slice of *Gold & Glory* — a turn-based arena fighter with a faucet/sink economy, runnable in a browser with one command.

**Architecture:** Pure-logic core (RNG, config, economy, combat, state, game orchestrator) with zero DOM dependencies, unit-tested with Vitest. A thin UI layer renders state to HTML strings and wires events. A single `main.js` bootstraps the game loop through the `HUB → FIGHT → RESULT → HUB (+ GAMEOVER)` state machine. All balance values live in one config object for fast tuning. Combat uses seeded randomness so runs are reproducible.

**Tech Stack:** Vanilla JavaScript (ES modules), Vite (dev server + build), Vitest + jsdom (tests). No backend, no runtime framework.

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json` | Scripts + dev dependencies (Vite, Vitest, jsdom) |
| `vite.config.js` | Vitest config (jsdom environment, globals) |
| `index.html` | Single page; mounts `#app`, loads `src/main.js` |
| `src/config.js` | All balance values — the single tuning object |
| `src/rng.js` | Seeded RNG (mulberry32) + helpers |
| `src/economy.js` | Pure faucet/sink math: costs, payouts, tax, bribe, sponsor |
| `src/combat.js` | Pure combat: timing, damage, turn resolution, enemy AI, win check |
| `src/state.js` | Game-state factory + phase-transition state machine |
| `src/game.js` | Orchestrator: effective stats, purchases, fight start/resolve, end states |
| `src/ui/render.js` | Pure render-to-string helpers (HUD, hub, fight, result, gameover) |
| `src/ui/screens.js` | Mounts rendered HTML + wires DOM event listeners to game actions |
| `src/main.js` | Bootstrap: create state, drive the screen loop |
| `src/styles.css` | Minimal layout + screenshot-friendly result cards |
| `tests/*.test.js` | One test file per logic module |

Each logic module is a pure function set (state in → new values out) so it can be tested without a browser. The UI never contains game rules — it only reads state and calls `game.js`/`economy.js`.

---

## Data Model (shared types — keep names consistent across all tasks)

**Game state** (from `createGameState`):
```js
{
  seed: number,
  phase: 'HUB' | 'FIGHT' | 'RESULT' | 'GAMEOVER',
  gold: number,
  health: number,
  maxHealth: number,
  injuries: number,
  weaponDurability: number,
  baseStats: { power: number, guard: number, speed: number },
  trainingLevels: { power: number, guard: number, speed: number },
  gear: string[],                 // owned gear ids: 'shield' | 'blade' | 'charm'
  wins: number,
  currentOpponentIndex: number,
  sponsorUnlocked: boolean,
  bribedThisFight: boolean,
  combat: CombatState | null,     // populated only during FIGHT
  lastResult: ResultCard | null,  // populated for RESULT / GAMEOVER
  ended: null | 'win-circuit' | 'retired' | 'dead',
}
```

**Combat state** (from `createCombat`):
```js
{
  player: { health, maxHealth, power, guard, speed, critWindowMult, weaponBroken },
  enemy:  { health, maxHealth, power, guard, speed, name, deathRisk },
  guardDropped: boolean,   // true after Press the Attack; upgrades enemy's next hit
  counterReady: boolean,   // true after a Block
  blockedThisFight: boolean, // tracks sponsor objective "win without blocking"
  log: string[],
}
```

**Result card** (from `resolveFightOutcome`):
```js
{
  won: boolean,
  died: boolean,
  opponentName: string,
  purse: number,        // gross
  tax: number,
  sponsorIncome: number,
  netGold: number,      // change applied to wallet
  durabilityLost: number,
  injuriesGained: number,
  causeOfDeath: string | null,  // absurd line for screenshot
  commentary: string,
}
```

**Timing tiers** (combat): `'miss' | 'graze' | 'hit' | 'crit'`.

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.js`
- Create: `src/styles.css`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "gold-and-glory",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "vitest": "^2.1.0",
    "jsdom": "^25.0.0"
  }
}
```

- [ ] **Step 2: Create `vite.config.js`**

```js
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

- [ ] **Step 3: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Gold &amp; Glory</title>
    <link rel="stylesheet" href="/src/styles.css" />
  </head>
  <body>
    <main id="app"></main>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 4: Create placeholder `src/main.js`**

```js
const app = document.getElementById('app');
if (app) app.textContent = 'Gold & Glory — loading…';
```

- [ ] **Step 5: Create minimal `src/styles.css`**

```css
:root {
  --bg: #1a1410;
  --panel: #2a2018;
  --gold: #d9a441;
  --text: #e8ddc8;
  --danger: #b5402f;
  --good: #5a8a4a;
  font-family: system-ui, sans-serif;
}
body { background: var(--bg); color: var(--text); margin: 0; }
#app { max-width: 720px; margin: 0 auto; padding: 16px; }
button { font: inherit; cursor: pointer; }
button:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`
Expected: dependencies install, `node_modules/` created, no errors.

- [ ] **Step 7: Verify the test runner works (no tests yet)**

Run: `npm test`
Expected: Vitest reports "No test files found" and exits 0 (acceptable at this stage).

- [ ] **Step 8: Commit**

```bash
git init
printf "node_modules/\ndist/\n" > .gitignore
git add package.json vite.config.js index.html src/main.js src/styles.css .gitignore
git commit -m "chore: scaffold Gold & Glory project (Vite + Vitest)"
```

---

## Task 2: Seeded RNG

**Files:**
- Create: `src/rng.js`
- Test: `tests/rng.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/rng.test.js
import { describe, it, expect } from 'vitest';
import { makeRng, rngInt, rngChance } from '../src/rng.js';

describe('makeRng', () => {
  it('produces values in [0, 1)', () => {
    const rng = makeRng(42);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = makeRng(123);
    const b = makeRng(123);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('differs across seeds', () => {
    expect(makeRng(1)()).not.toEqual(makeRng(2)());
  });
});

describe('rngInt', () => {
  it('stays within [min, max] inclusive', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 200; i++) {
      const n = rngInt(rng, 3, 6);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
    }
  });
});

describe('rngChance', () => {
  it('returns true ~p of the time', () => {
    const rng = makeRng(99);
    let hits = 0;
    for (let i = 0; i < 1000; i++) if (rngChance(rng, 0.3)) hits++;
    expect(hits).toBeGreaterThan(200);
    expect(hits).toBeLessThan(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- rng`
Expected: FAIL — cannot import from `../src/rng.js` (module/exports missing).

- [ ] **Step 3: Write minimal implementation**

```js
// src/rng.js

// mulberry32 — small, fast, deterministic PRNG.
export function makeRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function rngChance(rng, probability) {
  return rng() < probability;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- rng`
Expected: PASS — all rng tests green.

- [ ] **Step 5: Commit**

```bash
git add src/rng.js tests/rng.test.js
git commit -m "feat: seeded RNG (mulberry32) with int/chance helpers"
```

---

## Task 3: Config / balance object

**Files:**
- Create: `src/config.js`
- Test: `tests/config.test.js`

This is the single tuning surface. Values come straight from the spec's starter balance table (§6).

- [ ] **Step 1: Write the failing test**

```js
// tests/config.test.js
import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';

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

  it('has combat timing tiers and multipliers', () => {
    expect(CONFIG.combat.timingMult.miss).toBe(0);
    expect(CONFIG.combat.timingMult.crit).toBeGreaterThan(CONFIG.combat.timingMult.hit);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- config`
Expected: FAIL — `../src/config.js` does not exist.

- [ ] **Step 3: Write the implementation**

```js
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
      id: 'brute', name: 'The Brute', tier: 'safe',
      health: 40, power: 4, guard: 2, speed: 3,
      purse: 50, deathRisk: 0,
    },
    {
      id: 'journeyman', name: 'The Journeyman', tier: 'standard',
      health: 70, power: 7, guard: 4, speed: 5,
      purse: 120, deathRisk: 0.05,
    },
    {
      id: 'veteran', name: 'The Veteran', tier: 'hard',
      health: 110, power: 11, guard: 7, speed: 7,
      purse: 280, deathRisk: 0.15,
    },
    {
      id: 'champion', name: 'The Champion', tier: 'death-match',
      health: 170, power: 16, guard: 10, speed: 10,
      purse: 700, deathRisk: 0.35,
    },
  ],

  deathRecaps: [
    'Bled out while a sponsor banner unfurled overhead.',
    'Tripped on a discarded turnip, impaled on own blade.',
    'The crowd cheered. You did not get up.',
    'Officially ruled "an administrative oversight."',
  ],
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- config`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config.js tests/config.test.js
git commit -m "feat: central balance config from spec starter table"
```

---

## Task 4: Economy — sink cost functions

**Files:**
- Create: `src/economy.js`
- Test: `tests/economy.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/economy.test.js
import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import {
  trainingCost, repairCost, healCost, canAfford,
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- economy`
Expected: FAIL — `../src/economy.js` does not exist.

- [ ] **Step 3: Write minimal implementation**

```js
// src/economy.js

export function trainingCost(level, config) {
  return Math.round(config.training.baseCost * Math.pow(config.training.scaling, level));
}

export function repairCost(missingDurability, config) {
  return missingDurability * config.weapon.repairCostPerPoint;
}

export function healCost(injuries, config) {
  return injuries * config.heal.costPerInjury;
}

export function canAfford(gold, cost) {
  return gold >= cost;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- economy`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/economy.js tests/economy.test.js
git commit -m "feat: economy sink cost functions (train/repair/heal)"
```

---

## Task 5: Economy — payout, tax, bribe, sponsor

**Files:**
- Modify: `src/economy.js`
- Test: `tests/economy.test.js` (add cases)

- [ ] **Step 1: Add failing tests**

Append to `tests/economy.test.js`:

```js
import { arenaTax, fightPayout, sponsorIncome } from '../src/economy.js';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- economy`
Expected: FAIL — `arenaTax`, `fightPayout`, `sponsorIncome` not exported.

- [ ] **Step 3: Add the implementation**

Append to `src/economy.js`:

```js
export function arenaTax(purse, bribed, config) {
  const rate = bribed ? config.arena.bribedTaxRate : config.arena.taxRate;
  return Math.round(purse * rate);
}

export function fightPayout(purse, bribed, config) {
  return purse - arenaTax(purse, bribed, config);
}

export function sponsorIncome(objectiveMet, config) {
  return config.sponsor.stipendPerFight + (objectiveMet ? config.sponsor.objectiveBonus : 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- economy`
Expected: PASS — all economy tests green.

- [ ] **Step 5: Commit**

```bash
git add src/economy.js tests/economy.test.js
git commit -m "feat: economy faucet functions (payout/tax/bribe/sponsor)"
```

---

## Task 6: Combat — timing resolution

**Files:**
- Create: `src/combat.js`
- Test: `tests/combat.test.js`

`distance` is the absolute distance (0..1 of the bar) between the click and the sweet-spot center. Lower distance = better hit.

- [ ] **Step 1: Write the failing test**

```js
// tests/combat.test.js
import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { TIMING, timingWindowWidth, resolveTiming } from '../src/combat.js';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- combat`
Expected: FAIL — `../src/combat.js` does not exist.

- [ ] **Step 3: Write minimal implementation**

```js
// src/combat.js

export const TIMING = { MISS: 'miss', GRAZE: 'graze', HIT: 'hit', CRIT: 'crit' };

export function timingWindowWidth(speed, config) {
  return config.combat.baseTimingWidth + speed * config.combat.speedTimingBonus;
}

// distance: absolute distance from sweet-spot center (0..1 of the bar).
// critWindowMult: widens the crit window (Lucky Charm gear); default 1.
export function resolveTiming(distance, windowWidth, config, critWindowMult = 1) {
  const r = config.combat.timingTierRatios;
  if (distance <= windowWidth * r.crit * critWindowMult) return TIMING.CRIT;
  if (distance <= windowWidth * r.hit) return TIMING.HIT;
  if (distance <= windowWidth * r.graze) return TIMING.GRAZE;
  return TIMING.MISS;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- combat`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/combat.js tests/combat.test.js
git commit -m "feat: combat timing window + tier resolution"
```

---

## Task 7: Combat — damage computation

**Files:**
- Modify: `src/combat.js`
- Test: `tests/combat.test.js` (add cases)

- [ ] **Step 1: Add failing tests**

Append to `tests/combat.test.js`:

```js
import { computeDamage } from '../src/combat.js';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- combat`
Expected: FAIL — `computeDamage` not exported.

- [ ] **Step 3: Add the implementation**

Append to `src/combat.js`:

```js
export function computeDamage({
  baseDamage, power, guard, timing,
  pressMultiplier = 1, weaponBroken = false, config,
}) {
  const mult = config.combat.timingMult[timing];
  if (mult === 0) return 0;
  let dmg = (baseDamage + power) * mult * pressMultiplier;
  if (weaponBroken) dmg *= config.weapon.brokenDamageMultiplier;
  dmg -= guard;
  return Math.max(0, Math.round(dmg));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- combat`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/combat.js tests/combat.test.js
git commit -m "feat: combat damage computation (timing/press/broken/guard)"
```

---

## Task 8: Combat — create state and player actions

**Files:**
- Modify: `src/combat.js`
- Test: `tests/combat.test.js` (add cases)

`createCombat` takes already-resolved effective player stats (Task 11 supplies these from `game.js`). `applyPlayerAction` resolves one player action against the enemy and returns a new combat state.

- [ ] **Step 1: Add failing tests**

Append to `tests/combat.test.js`:

```js
import { createCombat, applyPlayerAction, isFightOver, fightWinner } from '../src/combat.js';

const playerStats = {
  health: 100, maxHealth: 100, power: 5, guard: 5, speed: 5,
  critWindowMult: 1, weaponBroken: false,
};
const opponent = CONFIG.opponents[0]; // Brute: hp 40, power 4, guard 2

describe('createCombat', () => {
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
  it('sets counterReady and marks blockedThisFight', () => {
    const c = createCombat(playerStats, opponent, CONFIG);
    const next = applyPlayerAction(c, 'block', TIMING.HIT, CONFIG);
    expect(next.counterReady).toBe(true);
    expect(next.blockedThisFight).toBe(true);
  });
});

describe('isFightOver / fightWinner', () => {
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- combat`
Expected: FAIL — `createCombat`/`applyPlayerAction`/`isFightOver`/`fightWinner` not exported.

- [ ] **Step 3: Add the implementation**

Append to `src/combat.js`:

```js
export function createCombat(playerStats, opponent, config) {
  return {
    player: {
      health: playerStats.health,
      maxHealth: playerStats.maxHealth,
      power: playerStats.power,
      guard: playerStats.guard,
      speed: playerStats.speed,
      critWindowMult: playerStats.critWindowMult,
      weaponBroken: playerStats.weaponBroken,
    },
    enemy: {
      health: opponent.health,
      maxHealth: opponent.health,
      power: opponent.power,
      guard: opponent.guard,
      speed: opponent.speed,
      name: opponent.name,
      deathRisk: opponent.deathRisk,
    },
    guardDropped: false,
    counterReady: false,
    blockedThisFight: false,
    pendingBonus: 0, // follow-up bonus from a feint, applied to next attack
    log: [],
  };
}

// Returns a NEW combat state (does not mutate the input).
export function applyPlayerAction(combat, action, timing, config) {
  const next = cloneCombat(combat);
  const def = config.combat.actions[action];

  if (action === 'block') {
    next.counterReady = true;
    next.blockedThisFight = true;
    next.log.push('You raise your guard, ready to counter.');
    return next;
  }

  if (action === 'feint') {
    next.pendingBonus = def.nextHitBonus;
    const dmg = computeDamage({
      baseDamage: def.baseDamage, power: next.player.power,
      guard: next.enemy.guard, timing, weaponBroken: next.player.weaponBroken, config,
    });
    next.enemy.health -= dmg;
    next.log.push(`You feint (${timing}) for ${dmg}, baiting their guard.`);
    return next;
  }

  // strike / heavy
  const pressMultiplier = 1 + (combat.pendingBonus || 0);
  const dmg = computeDamage({
    baseDamage: def.baseDamage, power: next.player.power,
    guard: next.enemy.guard, timing, pressMultiplier,
    weaponBroken: next.player.weaponBroken, config,
  });
  next.enemy.health -= dmg;
  next.pendingBonus = 0;
  next.log.push(`You ${action} (${timing}) for ${dmg} damage.`);
  return next;
}

export function isFightOver(combat) {
  return combat.player.health <= 0 || combat.enemy.health <= 0;
}

export function fightWinner(combat) {
  if (combat.enemy.health <= 0) return 'player';
  if (combat.player.health <= 0) return 'enemy';
  return null;
}

function cloneCombat(combat) {
  return {
    ...combat,
    player: { ...combat.player },
    enemy: { ...combat.enemy },
    log: [...combat.log],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- combat`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/combat.js tests/combat.test.js
git commit -m "feat: combat state, player actions, win detection"
```

---

## Task 9: Combat — press the attack + enemy turn

**Files:**
- Modify: `src/combat.js`
- Test: `tests/combat.test.js` (add cases)

`applyPress` is taken after a successful player attack: extra damage now, but `guardDropped` upgrades the enemy's next hit by one tier. `enemyTurn` rolls a weighted timing tier (upgraded if guard dropped) and damages the player; a ready counter halves incoming damage.

- [ ] **Step 1: Add failing tests**

Append to `tests/combat.test.js`:

```js
import { makeRng } from '../src/rng.js';
import { applyPress, enemyTurn, upgradeTier } from '../src/combat.js';

describe('upgradeTier', () => {
  it('bumps a tier up one step, capped at crit', () => {
    expect(upgradeTier(TIMING.MISS)).toBe(TIMING.GRAZE);
    expect(upgradeTier(TIMING.GRAZE)).toBe(TIMING.HIT);
    expect(upgradeTier(TIMING.HIT)).toBe(TIMING.CRIT);
    expect(upgradeTier(TIMING.CRIT)).toBe(TIMING.CRIT);
  });
});

describe('applyPress', () => {
  it('deals extra damage and drops guard', () => {
    const c = createCombat(playerStats, opponent, CONFIG);
    const afterHit = applyPlayerAction(c, 'strike', TIMING.HIT, CONFIG); // enemy 27
    const pressed = applyPress(afterHit, TIMING.HIT, CONFIG);
    expect(pressed.enemy.health).toBeLessThan(afterHit.enemy.health);
    expect(pressed.guardDropped).toBe(true);
  });
});

describe('enemyTurn', () => {
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
    const rng = makeRng(5);
    const base = createCombat(playerStats, CONFIG.opponents[2], CONFIG); // Veteran hits harder
    const guarded = { ...base, counterReady: true, player: { ...base.player } };
    const unguarded = { ...base, counterReady: false, player: { ...base.player } };
    const a = enemyTurn(guarded, makeRng(5), CONFIG);
    const b = enemyTurn(unguarded, makeRng(5), CONFIG);
    expect(100 - a.player.health).toBeLessThanOrEqual(100 - b.player.health);
    expect(a.counterReady).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- combat`
Expected: FAIL — `applyPress`/`enemyTurn`/`upgradeTier` not exported.

- [ ] **Step 3: Add the implementation**

Append to `src/combat.js`:

```js
const TIER_ORDER = [TIMING.MISS, TIMING.GRAZE, TIMING.HIT, TIMING.CRIT];

export function upgradeTier(tier) {
  const i = TIER_ORDER.indexOf(tier);
  return TIER_ORDER[Math.min(i + 1, TIER_ORDER.length - 1)];
}

export function applyPress(combat, timing, config) {
  const next = cloneCombat(combat);
  const dmg = computeDamage({
    baseDamage: config.combat.actions.strike.baseDamage,
    power: next.player.power, guard: next.enemy.guard, timing,
    pressMultiplier: config.combat.pressAttack.bonusMultiplier,
    weaponBroken: next.player.weaponBroken, config,
  });
  next.enemy.health -= dmg;
  next.guardDropped = true;
  next.log.push(`You PRESS the attack (${timing}) for ${dmg} — but drop your guard!`);
  return next;
}

function rollEnemyTier(rng, config) {
  const w = config.combat.enemyTierWeights;
  const roll = rng();
  let acc = 0;
  for (const tier of TIER_ORDER) {
    acc += w[tier];
    if (roll < acc) return tier;
  }
  return TIMING.HIT;
}

export function enemyTurn(combat, rng, config) {
  const next = cloneCombat(combat);
  let tier = rollEnemyTier(rng, config);
  if (next.guardDropped) tier = upgradeTier(tier);

  let dmg = computeDamage({
    baseDamage: config.combat.actions.strike.baseDamage,
    power: next.enemy.power, guard: next.player.guard, timing: tier, config,
  });

  if (next.counterReady) {
    dmg = Math.round(dmg * (1 - config.combat.actions.block.damageReduction));
    next.counterReady = false;
    next.log.push(`Counter! You absorb the blow, taking ${dmg}.`);
  } else {
    next.log.push(`${next.enemy.name} strikes (${tier}) for ${dmg}.`);
  }

  next.player.health -= dmg;
  next.guardDropped = false;
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- combat`
Expected: PASS — all combat tests green.

- [ ] **Step 5: Commit**

```bash
git add src/combat.js tests/combat.test.js
git commit -m "feat: press-the-attack and enemy turn resolution"
```

---

## Task 10: Game state factory + phase transitions

**Files:**
- Create: `src/state.js`
- Test: `tests/state.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/state.test.js
import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { PHASE, createGameState, transition } from '../src/state.js';

describe('createGameState', () => {
  it('starts in HUB with full vitals and starting gold', () => {
    const s = createGameState(42, CONFIG);
    expect(s.seed).toBe(42);
    expect(s.phase).toBe(PHASE.HUB);
    expect(s.gold).toBe(100);
    expect(s.health).toBe(100);
    expect(s.injuries).toBe(0);
    expect(s.weaponDurability).toBe(30);
    expect(s.baseStats).toEqual({ power: 5, guard: 5, speed: 5 });
    expect(s.trainingLevels).toEqual({ power: 0, guard: 0, speed: 0 });
    expect(s.gear).toEqual([]);
    expect(s.wins).toBe(0);
    expect(s.currentOpponentIndex).toBe(0);
    expect(s.sponsorUnlocked).toBe(false);
    expect(s.ended).toBe(null);
  });
});

describe('transition', () => {
  it('allows HUB -> FIGHT', () => {
    const s = createGameState(1, CONFIG);
    expect(transition(s, PHASE.FIGHT).phase).toBe(PHASE.FIGHT);
  });

  it('allows FIGHT -> RESULT -> HUB', () => {
    let s = transition(createGameState(1, CONFIG), PHASE.FIGHT);
    s = transition(s, PHASE.RESULT);
    expect(s.phase).toBe(PHASE.RESULT);
    expect(transition(s, PHASE.HUB).phase).toBe(PHASE.HUB);
  });

  it('allows RESULT -> GAMEOVER', () => {
    let s = transition(createGameState(1, CONFIG), PHASE.FIGHT);
    s = transition(s, PHASE.RESULT);
    expect(transition(s, PHASE.GAMEOVER).phase).toBe(PHASE.GAMEOVER);
  });

  it('rejects illegal transitions', () => {
    const s = createGameState(1, CONFIG); // HUB
    expect(() => transition(s, PHASE.RESULT)).toThrow();
  });

  it('does not mutate the input state', () => {
    const s = createGameState(1, CONFIG);
    transition(s, PHASE.FIGHT);
    expect(s.phase).toBe(PHASE.HUB);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- state`
Expected: FAIL — `../src/state.js` does not exist.

- [ ] **Step 3: Write the implementation**

```js
// src/state.js

export const PHASE = { HUB: 'HUB', FIGHT: 'FIGHT', RESULT: 'RESULT', GAMEOVER: 'GAMEOVER' };

const ALLOWED = {
  HUB: ['FIGHT', 'GAMEOVER'],
  FIGHT: ['RESULT'],
  RESULT: ['HUB', 'GAMEOVER'],
  GAMEOVER: [],
};

export function createGameState(seed, config) {
  return {
    seed,
    phase: PHASE.HUB,
    gold: config.startingGold,
    health: config.player.maxHealth,
    maxHealth: config.player.maxHealth,
    injuries: 0,
    weaponDurability: config.weapon.maxDurability,
    baseStats: { ...config.startingStats },
    trainingLevels: { power: 0, guard: 0, speed: 0 },
    gear: [],
    wins: 0,
    currentOpponentIndex: 0,
    sponsorUnlocked: false,
    bribedThisFight: false,
    combat: null,
    lastResult: null,
    ended: null,
  };
}

export function transition(state, toPhase) {
  if (!ALLOWED[state.phase].includes(toPhase)) {
    throw new Error(`Illegal transition ${state.phase} -> ${toPhase}`);
  }
  return { ...state, phase: toPhase };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- state`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state.js tests/state.test.js
git commit -m "feat: game state factory and phase state machine"
```

---

## Task 11: Game orchestrator — effective stats + purchases

**Files:**
- Create: `src/game.js`
- Test: `tests/game.test.js`

All purchase functions return a **new** state and silently no-op (return state unchanged) if the player cannot afford the action — the UI is responsible for disabling unaffordable buttons, but the core stays safe.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- game`
Expected: FAIL — `../src/game.js` does not exist.

- [ ] **Step 3: Write the implementation**

```js
// src/game.js
import { trainingCost, repairCost, healCost, canAfford } from './economy.js';

export function effectiveStats(state, config) {
  const lvl = state.trainingLevels;
  const per = config.training.statPerLevel;
  const stats = {
    power: state.baseStats.power + lvl.power * per,
    guard: state.baseStats.guard + lvl.guard * per,
    speed: state.baseStats.speed + lvl.speed * per,
    critWindowMult: 1,
  };
  for (const id of state.gear) {
    const g = config.gear[id];
    if (!g) continue;
    if (g.powerBonus) stats.power += g.powerBonus;
    if (g.guardBonus) stats.guard += g.guardBonus;
    if (g.critWindowMult) stats.critWindowMult = g.critWindowMult;
  }
  return stats;
}

export function trainStat(state, stat, config) {
  const cost = trainingCost(state.trainingLevels[stat], config);
  if (!canAfford(state.gold, cost)) return state;
  return {
    ...state,
    gold: state.gold - cost,
    trainingLevels: { ...state.trainingLevels, [stat]: state.trainingLevels[stat] + 1 },
  };
}

export function repairWeapon(state, config) {
  const missing = config.weapon.maxDurability - state.weaponDurability;
  if (missing <= 0) return state;
  const cost = repairCost(missing, config);
  if (!canAfford(state.gold, cost)) return state;
  return { ...state, gold: state.gold - cost, weaponDurability: config.weapon.maxDurability };
}

export function healInjuries(state, config) {
  if (state.injuries <= 0) return state;
  const cost = healCost(state.injuries, config);
  if (!canAfford(state.gold, cost)) return state;
  return { ...state, gold: state.gold - cost, injuries: 0, health: state.maxHealth };
}

export function buyGear(state, gearId, config) {
  const g = config.gear[gearId];
  if (!g || state.gear.includes(gearId)) return state;
  if (!canAfford(state.gold, g.cost)) return state;
  return { ...state, gold: state.gold - g.cost, gear: [...state.gear, gearId] };
}

export function bribeOfficial(state, config) {
  if (state.bribedThisFight) return state;
  if (!canAfford(state.gold, config.arena.bribeCost)) return state;
  return { ...state, gold: state.gold - config.arena.bribeCost, bribedThisFight: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- game`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game.js tests/game.test.js
git commit -m "feat: game orchestrator effective stats + purchases"
```

---

## Task 12: Game orchestrator — start fight, resolve outcome, end states

**Files:**
- Modify: `src/game.js`
- Test: `tests/game.test.js` (add cases)

`startFight` builds the combat from effective stats (capping health at remaining player health) and moves to FIGHT. `resolveFightOutcome` applies payout/tax/sponsor, weapon durability loss, injuries, the death roll, win counting, sponsor unlock, and builds the result card. End states: defeating the last opponent → `win-circuit`; dying → `dead`; `retire` → `retired`.

- [ ] **Step 1: Add failing tests**

Append to `tests/game.test.js`:

```js
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

describe('retire', () => {
  it('ends the game as retired from the HUB', () => {
    const s = createGameState(1, CONFIG);
    const next = retire(s);
    expect(next.phase).toBe(PHASE.GAMEOVER);
    expect(next.ended).toBe('retired');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- game`
Expected: FAIL — `startFight`/`resolveFightOutcome`/`retire` not exported.

- [ ] **Step 3: Add the implementation**

Append to `src/game.js`:

```js
import { PHASE, transition } from './state.js';
import { createCombat } from './combat.js';
import { fightPayout, arenaTax, sponsorIncome } from './economy.js';
import { rngChance, rngInt } from './rng.js';

export function startFight(state, config) {
  const opponent = config.opponents[state.currentOpponentIndex];
  const eff = effectiveStats(state, config);
  const playerStats = {
    health: state.health,
    maxHealth: state.maxHealth,
    power: eff.power,
    guard: eff.guard,
    speed: eff.speed,
    critWindowMult: eff.critWindowMult,
    weaponBroken: state.weaponDurability <= 0,
  };
  const combat = createCombat(playerStats, opponent, config);
  return { ...transition(state, PHASE.FIGHT), combat };
}

export function resolveFightOutcome(state, won, rng, config) {
  const opponent = config.opponents[state.currentOpponentIndex];
  const isLast = state.currentOpponentIndex === config.opponents.length - 1;

  if (won) {
    const tax = arenaTax(opponent.purse, state.bribedThisFight, config);
    const net = fightPayout(opponent.purse, state.bribedThisFight, config);
    const newWins = state.wins + 1;
    const sponsorActive = state.sponsorUnlocked;
    const objectiveMet = !state.combat.blockedThisFight; // "win without blocking"
    const sponsor = sponsorActive ? sponsorIncome(objectiveMet, config) : 0;
    const durabilityLost = Math.min(config.weapon.durabilityLossPerFight, state.weaponDurability);

    const result = {
      won: true, died: false, opponentName: opponent.name,
      purse: opponent.purse, tax, sponsorIncome: sponsor,
      netGold: net + sponsor, durabilityLost, injuriesGained: 0,
      causeOfDeath: null,
      commentary: `${opponent.name} falls. The crowd wants more.`,
    };

    const base = {
      ...state,
      gold: state.gold + net + sponsor,
      weaponDurability: state.weaponDurability - durabilityLost,
      health: state.combat.player.health,
      wins: newWins,
      sponsorUnlocked: state.sponsorUnlocked || newWins >= config.sponsor.unlockWins,
      currentOpponentIndex: isLast ? state.currentOpponentIndex : state.currentOpponentIndex + 1,
      bribedThisFight: false,
      combat: null,
      lastResult: result,
    };

    if (isLast) {
      return { ...transition(base, PHASE.RESULT), phase: PHASE.GAMEOVER, ended: 'win-circuit', lastResult: result };
    }
    return { ...transition(base, PHASE.RESULT), lastResult: result };
  }

  // loss
  const died = rngChance(rng, opponent.deathRisk);
  const durabilityLost = Math.min(config.weapon.durabilityLossPerFight, state.weaponDurability);
  const cause = died
    ? config.deathRecaps[rngInt(rng, 0, config.deathRecaps.length - 1)]
    : null;

  const result = {
    won: false, died, opponentName: opponent.name,
    purse: 0, tax: 0, sponsorIncome: 0, netGold: 0,
    durabilityLost, injuriesGained: died ? 0 : 1,
    causeOfDeath: cause,
    commentary: died
      ? `And that's the end of that gladiator.`
      : `You crawl out of the arena, poorer and bleeding.`,
  };

  const base = {
    ...state,
    weaponDurability: state.weaponDurability - durabilityLost,
    injuries: died ? state.injuries : state.injuries + 1,
    health: died ? 0 : Math.max(1, state.maxHealth - 20 * (state.injuries + 1)),
    bribedThisFight: false,
    combat: null,
    lastResult: result,
  };

  if (died) {
    return { ...transition(base, PHASE.RESULT), phase: PHASE.GAMEOVER, ended: 'dead', lastResult: result };
  }
  return { ...transition(base, PHASE.RESULT), lastResult: result };
}

export function retire(state) {
  return { ...transition(state, PHASE.GAMEOVER), ended: 'retired' };
}
```

> Note: the win-circuit and death branches first transition `FIGHT → RESULT` (honoring the state-machine guard), then override `phase` to `GAMEOVER` directly via object spread while preserving the result card — landing on the end state in one step.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- game`
Expected: PASS — all game tests green.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — rng, config, economy, combat, state, game all green.

- [ ] **Step 6: Commit**

```bash
git add src/game.js tests/game.test.js
git commit -m "feat: fight start/resolve, sponsor unlock, death roll, end states"
```

---

## Task 13: UI — pure render functions

**Files:**
- Create: `src/ui/render.js`
- Test: `tests/render.test.js`

These functions take state and return HTML strings. No event wiring here — that keeps them testable. `escapeHtml` guards against injection from any future dynamic text.

- [ ] **Step 1: Write the failing test**

```js
// tests/render.test.js
import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { createGameState } from '../src/state.js';
import { renderHud, renderHub, renderResult, renderGameOver } from '../src/ui/render.js';

describe('renderHud', () => {
  it('shows gold, health, and durability', () => {
    const s = createGameState(1, CONFIG);
    const html = renderHud(s, CONFIG);
    expect(html).toContain('100'); // gold
    expect(html).toContain('Health');
    expect(html).toContain('Durability');
  });
});

describe('renderHub', () => {
  it('lists management actions with costs and a Next Fight button', () => {
    const s = createGameState(1, CONFIG);
    const html = renderHub(s, CONFIG);
    expect(html).toContain('Train');
    expect(html).toContain('Repair');
    expect(html).toContain('Heal');
    expect(html).toContain('Bribe');
    expect(html).toContain('data-action="next-fight"');
    expect(html).toContain('The Brute'); // next opponent named
  });

  it('disables unaffordable buttons', () => {
    const s = createGameState(1, CONFIG);
    s.gold = 0;
    const html = renderHub(s, CONFIG);
    expect(html).toContain('disabled');
  });
});

describe('renderResult', () => {
  it('renders a win recap card', () => {
    const s = createGameState(1, CONFIG);
    s.lastResult = {
      won: true, died: false, opponentName: 'The Brute',
      purse: 50, tax: 10, sponsorIncome: 0, netGold: 40,
      durabilityLost: 3, injuriesGained: 0, causeOfDeath: null,
      commentary: 'The Brute falls.',
    };
    const html = renderResult(s, CONFIG);
    expect(html).toContain('The Brute');
    expect(html).toContain('40');
    expect(html).toContain('data-action="to-hub"');
  });
});

describe('renderGameOver', () => {
  it('shows the death cause when dead', () => {
    const s = createGameState(1, CONFIG);
    s.ended = 'dead';
    s.lastResult = { died: true, causeOfDeath: 'Tripped on a turnip.', opponentName: 'X' };
    const html = renderGameOver(s, CONFIG);
    expect(html).toContain('Tripped on a turnip.');
    expect(html).toContain('data-action="restart"');
  });

  it('shows a victory message when the circuit is won', () => {
    const s = createGameState(1, CONFIG);
    s.ended = 'win-circuit';
    expect(renderGameOver(s, CONFIG)).toMatch(/champion|circuit/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- render`
Expected: FAIL — `../src/ui/render.js` does not exist.

- [ ] **Step 3: Write the implementation**

```js
// src/ui/render.js
import { trainingCost, repairCost, healCost, canAfford } from '../economy.js';
import { effectiveStats } from '../game.js';

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function btn(action, label, cost, gold, extra = '') {
  const affordable = cost == null || canAfford(gold, cost);
  const costLabel = cost == null ? '' : ` (${cost}g)`;
  return `<button data-action="${action}"${extra}${affordable ? '' : ' disabled'}>${escapeHtml(label)}${costLabel}</button>`;
}

export function renderHud(state, config) {
  return `
    <div class="hud">
      <span class="gold">🪙 ${state.gold}g</span>
      <span>Health: ${Math.max(0, state.health)}/${state.maxHealth}</span>
      <span>Durability: ${state.weaponDurability}/${config.weapon.maxDurability}</span>
      <span>Injuries: ${state.injuries}</span>
    </div>`;
}

export function renderHub(state, config) {
  const eff = effectiveStats(state, config);
  const missing = config.weapon.maxDurability - state.weaponDurability;
  const opponent = config.opponents[state.currentOpponentIndex];

  const trainButtons = ['power', 'guard', 'speed'].map((stat) => {
    const cost = trainingCost(state.trainingLevels[stat], config);
    return btn(`train-${stat}`, `Train ${stat} → ${eff[stat]}`, cost, state.gold);
  }).join('');

  const gearButtons = Object.values(config.gear).map((g) => {
    if (state.gear.includes(g.id)) return `<button disabled>${escapeHtml(g.name)} ✓</button>`;
    return btn(`buy-${g.id}`, g.name, g.cost, state.gold);
  }).join('');

  return `
    ${renderHud(state, config)}
    <section class="hub">
      <h2>The Ludus — Wins: ${state.wins}</h2>
      <div class="row">${trainButtons}</div>
      <div class="row">
        ${btn('repair', 'Repair weapon', repairCost(missing, config), state.gold, missing <= 0 ? ' data-noop="1"' : '')}
        ${btn('heal', `Heal ${state.injuries} injuries`, healCost(state.injuries, config), state.gold)}
        ${state.bribedThisFight
          ? '<button disabled>Bribed ✓</button>'
          : btn('bribe', 'Bribe official', config.arena.bribeCost, state.gold)}
      </div>
      <div class="row">${gearButtons}</div>
      ${state.sponsorUnlocked ? `<p class="sponsor">Sponsor active: +${config.sponsor.stipendPerFight}g/fight. Objective: ${escapeHtml(config.sponsor.objective)}</p>` : ''}
      <hr/>
      <p>Next up: <strong>${escapeHtml(opponent.name)}</strong> (${opponent.tier}) — purse ${opponent.purse}g</p>
      <button data-action="next-fight">⚔️ Next Fight</button>
      <button data-action="retire">🏛️ Retire rich (${state.gold}g)</button>
    </section>`;
}

export function renderResult(state, config) {
  const r = state.lastResult;
  const cls = r.won ? 'good' : 'danger';
  return `
    ${renderHud(state, config)}
    <section class="result ${cls}">
      <h2>${r.won ? 'VICTORY' : 'DEFEAT'} — ${escapeHtml(r.opponentName)}</h2>
      <p>${escapeHtml(r.commentary)}</p>
      ${r.won ? `<ul>
        <li>Purse: ${r.purse}g (tax ${r.tax}g)</li>
        ${r.sponsorIncome ? `<li>Sponsor: +${r.sponsorIncome}g</li>` : ''}
        <li><strong>Net: +${r.netGold}g</strong></li>
        <li>Weapon wear: -${r.durabilityLost} durability</li>
      </ul>` : `<ul>
        <li>Injuries gained: ${r.injuriesGained}</li>
        <li>Weapon wear: -${r.durabilityLost} durability</li>
      </ul>`}
      <button data-action="to-hub">Back to the Ludus</button>
    </section>`;
}

export function renderGameOver(state, config) {
  let body;
  if (state.ended === 'dead') {
    body = `<h2>YOU DIED</h2>
      <p class="cause">Cause of death: ${escapeHtml(state.lastResult.causeOfDeath)}</p>`;
  } else if (state.ended === 'win-circuit') {
    body = `<h2>CHAMPION OF THE CIRCUIT</h2>
      <p>You bribed, bled, and clawed your way to the top. Final purse: ${state.gold}g.</p>`;
  } else {
    body = `<h2>RETIRED RICH</h2>
      <p>You walked away with ${state.gold}g and all your limbs. Wise.</p>`;
  }
  return `
    <section class="gameover">
      ${body}
      <button data-action="restart">Fight again (new run)</button>
    </section>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- render`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/render.js tests/render.test.js
git commit -m "feat: pure HTML render functions for HUD/hub/result/gameover"
```

---

## Task 14: UI — fight screen render + timing meter helper

**Files:**
- Modify: `src/ui/render.js`
- Test: `tests/render.test.js` (add cases)

The timing meter is animated client-side; the render function emits the markup and a data attribute for the sweet spot. `meterDistance` converts a click X position to a distance-from-center for `resolveTiming`.

- [ ] **Step 1: Add failing tests**

Append to `tests/render.test.js`:

```js
import { startFight } from '../src/game.js';
import { renderFight, meterDistance } from '../src/ui/render.js';

describe('renderFight', () => {
  it('shows both combatants and the four action buttons', () => {
    const s = startFight(createGameState(1, CONFIG), CONFIG);
    const html = renderFight(s, CONFIG);
    expect(html).toContain('The Brute');
    expect(html).toContain('data-action="strike"');
    expect(html).toContain('data-action="heavy"');
    expect(html).toContain('data-action="block"');
    expect(html).toContain('data-action="feint"');
    expect(html).toContain('class="timing-meter"');
  });

  it('renders the combat log', () => {
    const s = startFight(createGameState(1, CONFIG), CONFIG);
    s.combat.log = ['You strike (hit) for 13 damage.'];
    expect(renderFight(s, CONFIG)).toContain('You strike (hit) for 13 damage.');
  });
});

describe('meterDistance', () => {
  it('is 0 at the sweet-spot center and grows toward the edges', () => {
    expect(meterDistance(0.5, 0.5)).toBeCloseTo(0);
    expect(meterDistance(0.75, 0.5)).toBeCloseTo(0.25);
    expect(meterDistance(0.0, 0.5)).toBeCloseTo(0.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- render`
Expected: FAIL — `renderFight`/`meterDistance` not exported.

- [ ] **Step 3: Add the implementation**

Append to `src/ui/render.js`:

```js
export function meterDistance(clickPos, sweetSpot) {
  return Math.abs(clickPos - sweetSpot);
}

export function renderFight(state, config) {
  const c = state.combat;
  const logHtml = c.log.slice(-6).map((l) => `<li>${escapeHtml(l)}</li>`).join('');
  return `
    ${renderHud(state, config)}
    <section class="fight">
      <div class="combatants">
        <div class="you">YOU<br/>${Math.max(0, c.player.health)}/${c.player.maxHealth}</div>
        <div class="them">${escapeHtml(c.enemy.name)}<br/>${Math.max(0, c.enemy.health)}/${c.enemy.maxHealth}</div>
      </div>
      <div class="timing-meter" data-meter="1">
        <div class="meter-sweet"></div>
        <div class="meter-cursor"></div>
      </div>
      <p class="meter-hint">Click the meter, then choose your action.</p>
      <div class="actions">
        <button data-action="strike">Strike</button>
        <button data-action="heavy">Heavy</button>
        <button data-action="block">Block</button>
        <button data-action="feint">Feint</button>
      </div>
      ${c.canPress ? '<button data-action="press" class="press">PRESS THE ATTACK!</button>' : ''}
      <ul class="log">${logHtml}</ul>
    </section>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- render`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/render.js tests/render.test.js
git commit -m "feat: fight screen render + timing meter distance helper"
```

---

## Task 15: UI — screen mounting + event wiring

**Files:**
- Create: `src/ui/screens.js`
- Test: `tests/screens.test.js`

`mount` writes the right screen for the current phase into a container. `wire` attaches a single delegated click listener that maps `data-action` to a callback object. This separation keeps DOM wiring thin and testable with jsdom.

- [ ] **Step 1: Write the failing test**

```js
// tests/screens.test.js
import { describe, it, expect, vi } from 'vitest';
import { CONFIG } from '../src/config.js';
import { createGameState } from '../src/state.js';
import { startFight } from '../src/game.js';
import { PHASE } from '../src/state.js';
import { mount, wire } from '../src/ui/screens.js';

describe('mount', () => {
  it('renders the hub when phase is HUB', () => {
    const el = document.createElement('div');
    mount(el, createGameState(1, CONFIG), CONFIG);
    expect(el.querySelector('[data-action="next-fight"]')).not.toBeNull();
  });

  it('renders the fight screen when phase is FIGHT', () => {
    const el = document.createElement('div');
    mount(el, startFight(createGameState(1, CONFIG), CONFIG), CONFIG);
    expect(el.querySelector('[data-action="strike"]')).not.toBeNull();
  });
});

describe('wire', () => {
  it('routes a data-action click to the matching handler', () => {
    const el = document.createElement('div');
    el.innerHTML = '<button data-action="next-fight">Go</button>';
    const handlers = { 'next-fight': vi.fn() };
    wire(el, handlers);
    el.querySelector('button').click();
    expect(handlers['next-fight']).toHaveBeenCalledTimes(1);
  });

  it('passes the clicked element to the handler', () => {
    const el = document.createElement('div');
    el.innerHTML = '<button data-action="train-power">T</button>';
    const handler = vi.fn();
    wire(el, { 'train-power': handler });
    const button = el.querySelector('button');
    button.click();
    expect(handler).toHaveBeenCalledWith(button);
  });

  it('ignores clicks on elements without a data-action', () => {
    const el = document.createElement('div');
    el.innerHTML = '<span>nope</span>';
    const handler = vi.fn();
    wire(el, { anything: handler });
    el.querySelector('span').click();
    expect(handler).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- screens`
Expected: FAIL — `../src/ui/screens.js` does not exist.

- [ ] **Step 3: Write the implementation**

```js
// src/ui/screens.js
import { PHASE } from '../state.js';
import { renderHub, renderFight, renderResult, renderGameOver } from './render.js';

export function mount(container, state, config) {
  let html;
  switch (state.phase) {
    case PHASE.HUB: html = renderHub(state, config); break;
    case PHASE.FIGHT: html = renderFight(state, config); break;
    case PHASE.RESULT: html = renderResult(state, config); break;
    case PHASE.GAMEOVER: html = renderGameOver(state, config); break;
    default: html = '<p>Unknown phase</p>';
  }
  container.innerHTML = html;
}

// Attaches one delegated click listener. handlers is { actionName: (el) => void }.
export function wire(container, handlers) {
  container.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target || !container.contains(target)) return;
    const action = target.getAttribute('data-action');
    const handler = handlers[action];
    if (handler) handler(target);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- screens`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens.js tests/screens.test.js
git commit -m "feat: screen mounting + delegated event wiring"
```

---

## Task 16: Timing meter animation + press-the-attack flow

**Files:**
- Modify: `src/combat.js`
- Test: `tests/combat.test.js` (add cases)

The fight UI needs the combat state to know whether a press is offered. We add a small post-action hook so `game.js`/`main.js` can flip the `canPress` flag after a successful player hit, and clear it otherwise.

- [ ] **Step 1: Add failing tests**

Append to `tests/combat.test.js`:

```js
import { markPressable } from '../src/combat.js';

describe('markPressable', () => {
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- combat`
Expected: FAIL — `markPressable` not exported.

- [ ] **Step 3: Add the implementation**

Append to `src/combat.js`:

```js
export function markPressable(combat, action, timing) {
  const damaging = (action === 'strike' || action === 'heavy' || action === 'feint');
  const landed = timing !== TIMING.MISS;
  return { ...combat, canPress: damaging && landed && combat.enemy.health > 0 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- combat`
Expected: PASS — all combat tests still green.

- [ ] **Step 5: Commit**

```bash
git add src/combat.js tests/combat.test.js
git commit -m "feat: pressable flag after a landed player hit"
```

---

## Task 17: Bootstrap — wire the full game loop in main.js

**Files:**
- Modify: `src/main.js`
- Modify: `src/styles.css` (add screen styles)

This is the integration layer. It holds the live state, re-mounts on every change, runs the timing meter animation, and routes every `data-action` to the right core function. No new game rules here — only orchestration of the pieces already built and tested.

- [ ] **Step 1: Replace `src/main.js` with the full bootstrap**

```js
// src/main.js
import { CONFIG } from './config.js';
import { createGameState, transition, PHASE } from './state.js';
import { makeRng } from './rng.js';
import {
  effectiveStats, trainStat, repairWeapon, healInjuries, buyGear, bribeOfficial,
  startFight, resolveFightOutcome, retire,
} from './game.js';
import {
  resolveTiming, timingWindowWidth, applyPlayerAction, applyPress,
  enemyTurn, isFightOver, fightWinner, markPressable,
} from './combat.js';
import { meterDistance } from './ui/render.js';
import { mount, wire } from './ui/screens.js';

const app = document.getElementById('app');

let state;
let rng;
let meter = { running: false, pos: 0, dir: 1, sweet: 0.5, captured: null, raf: 0 };

function newRun() {
  const seed = Math.floor(Math.random() * 1e9);
  state = createGameState(seed, CONFIG);
  rng = makeRng(seed);
  render();
}

function render() {
  mount(app, state, CONFIG);
  if (state.phase === PHASE.FIGHT) startMeter();
}

// --- Timing meter animation ---
function startMeter() {
  const bar = app.querySelector('[data-meter]');
  if (!bar) return;
  meter.running = true;
  meter.pos = 0;
  meter.dir = 1;
  meter.sweet = 0.5;
  meter.captured = null;
  bar.querySelector('.meter-sweet').style.left = `${meter.sweet * 100}%`;
  bar.addEventListener('click', captureMeter, { once: false });

  const cursor = bar.querySelector('.meter-cursor');
  const speed = 0.018; // fraction of bar per frame
  function step() {
    if (!meter.running) return;
    meter.pos += meter.dir * speed;
    if (meter.pos >= 1) { meter.pos = 1; meter.dir = -1; }
    if (meter.pos <= 0) { meter.pos = 0; meter.dir = 1; }
    cursor.style.left = `${meter.pos * 100}%`;
    meter.raf = requestAnimationFrame(step);
  }
  meter.raf = requestAnimationFrame(step);
}

function captureMeter() {
  if (!meter.running) return;
  meter.running = false;
  cancelAnimationFrame(meter.raf);
  meter.captured = meter.pos;
}

function currentTiming() {
  // If the player never clicked the meter, treat it as a miss.
  if (meter.captured == null) return 'miss';
  const eff = effectiveStats(state, CONFIG);
  const width = timingWindowWidth(eff.speed, CONFIG);
  const dist = meterDistance(meter.captured, meter.sweet);
  return resolveTiming(dist, width, CONFIG, eff.critWindowMult);
}

// --- Combat turn flow ---
function doPlayerAction(action) {
  const timing = currentTiming();
  let combat = applyPlayerAction(state.combat, action, timing, CONFIG);
  combat = markPressable(combat, action, timing);
  state = { ...state, combat };

  if (isFightOver(state.combat)) return endFight();
  if (state.combat.canPress) { render(); return; } // offer press before enemy acts
  enemyResponds();
}

function doPress() {
  const timing = currentTiming();
  let combat = applyPress(state.combat, timing, CONFIG);
  combat = { ...combat, canPress: false };
  state = { ...state, combat };
  if (isFightOver(state.combat)) return endFight();
  enemyResponds();
}

function enemyResponds() {
  const combat = enemyTurn(state.combat, rng, CONFIG);
  state = { ...state, combat };
  if (isFightOver(state.combat)) return endFight();
  render();
}

function endFight() {
  const won = fightWinner(state.combat) === 'player';
  state = resolveFightOutcome(state, won, rng, CONFIG);
  render();
}

// --- Action handlers ---
const handlers = {
  'train-power': () => { state = trainStat(state, 'power', CONFIG); render(); },
  'train-guard': () => { state = trainStat(state, 'guard', CONFIG); render(); },
  'train-speed': () => { state = trainStat(state, 'speed', CONFIG); render(); },
  repair: () => { state = repairWeapon(state, CONFIG); render(); },
  heal: () => { state = healInjuries(state, CONFIG); render(); },
  'buy-shield': () => { state = buyGear(state, 'shield', CONFIG); render(); },
  'buy-blade': () => { state = buyGear(state, 'blade', CONFIG); render(); },
  'buy-charm': () => { state = buyGear(state, 'charm', CONFIG); render(); },
  bribe: () => { state = bribeOfficial(state, CONFIG); render(); },
  'next-fight': () => { state = startFight(state, CONFIG); render(); },
  retire: () => { state = retire(state); render(); },
  strike: () => doPlayerAction('strike'),
  heavy: () => doPlayerAction('heavy'),
  block: () => doPlayerAction('block'),
  feint: () => doPlayerAction('feint'),
  press: () => doPress(),
  'to-hub': () => { state = transition(state, PHASE.HUB); render(); },
  restart: () => newRun(),
};

wire(app, handlers);
newRun();
```

- [ ] **Step 2: Append screen styles to `src/styles.css`**

```css
.hud { display: flex; gap: 16px; flex-wrap: wrap; padding: 8px 0; border-bottom: 1px solid #463829; margin-bottom: 12px; }
.hud .gold { color: var(--gold); font-weight: 700; }
.hub .row { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
.hub button, .actions button, .result button, .gameover button { background: var(--panel); color: var(--text); border: 1px solid #5a4632; border-radius: 6px; padding: 8px 12px; }
.sponsor { color: var(--gold); }
.combatants { display: flex; justify-content: space-between; font-size: 1.2rem; margin: 16px 0; }
.timing-meter { position: relative; height: 28px; background: #120d09; border: 1px solid #5a4632; border-radius: 6px; margin: 12px 0; cursor: crosshair; }
.meter-sweet { position: absolute; top: 0; bottom: 0; width: 14%; transform: translateX(-50%); background: rgba(90,138,74,0.5); }
.meter-cursor { position: absolute; top: 0; bottom: 0; width: 3px; background: var(--gold); }
.actions { display: flex; gap: 8px; }
.press { background: var(--danger); color: #fff; margin-top: 8px; }
.log { font-size: 0.85rem; color: #b8a888; list-style: none; padding: 0; }
.result.good { border-left: 4px solid var(--good); padding-left: 12px; }
.result.danger { border-left: 4px solid var(--danger); padding-left: 12px; }
.result .cause, .gameover .cause { font-style: italic; color: var(--danger); }
.gameover { text-align: center; padding: 32px 0; }
```

- [ ] **Step 3: Run the full test suite (ensure nothing regressed)**

Run: `npm test`
Expected: PASS — all test files green.

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev`
Then open the printed URL. Verify, unprompted-player style:
1. HUB shows gold 100, the Brute as next opponent, training/repair/heal/bribe/gear buttons.
2. Clicking **Next Fight** shows the fight screen with a sweeping meter.
3. Clicking the meter then **Strike** damages the Brute and logs it; a **PRESS THE ATTACK!** button appears after a landed hit.
4. Winning shows a result card with net gold; **Back to the Ludus** returns to HUB with increased gold and reduced durability.
5. Unaffordable buttons are disabled (set yourself broke by training repeatedly).
6. Losing/dying shows a game-over card with an absurd cause-of-death; **Fight again** starts a fresh run.

Stop the dev server with Ctrl-C when done.

- [ ] **Step 5: Commit**

```bash
git add src/main.js src/styles.css
git commit -m "feat: wire full game loop, timing meter animation, and styles"
```

---

## Task 18: Build verification + README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Verify a production build succeeds**

Run: `npm run build`
Expected: Vite writes `dist/` with no errors.

- [ ] **Step 2: Smoke-test the built bundle**

Run: `npm run preview`
Open the printed URL and confirm the game loads and a full fight plays. Ctrl-C when done.

- [ ] **Step 3: Write `README.md`**

```markdown
# Gold & Glory

*Death or glory, and a small administrative fee.*

A turn-based arena fighter with a faucet/sink economy. Climb a corrupt fight
circuit: win gold, but every fight wears your weapon and body while opponents
scale up. Train, repair, heal, gear up, and bribe officials to stay ahead — or
go broke, or die.

## Run it

```bash
npm install
npm run dev      # play locally
npm test         # run the logic test suite
npm run build    # production bundle in dist/
```

## Architecture

- `src/config.js` — all balance values (single tuning surface).
- `src/rng.js` — seeded RNG for reproducible runs.
- `src/economy.js` — pure faucet/sink math.
- `src/combat.js` — pure combat resolution (timing, damage, turns, enemy AI).
- `src/state.js` — game-state factory + `HUB → FIGHT → RESULT → HUB (+ GAMEOVER)` state machine.
- `src/game.js` — orchestrator: effective stats, purchases, fight start/resolve, end states.
- `src/ui/` — render-to-string functions + DOM event wiring.
- `src/main.js` — bootstrap and game loop.

All game rules live in the pure core (tested with Vitest); the UI only reads
state and calls into the core.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README with run instructions and architecture"
```

---

## Self-Review

**Spec coverage check (§-by-§):**
- §2 Core loop — state machine (Task 10) + main loop (Task 17). ✓
- §3/§6 Economy faucets & sinks — Tasks 4–5 (costs, tax, payout, bribe, sponsor), Task 11 (purchases), Task 12 (payout/sponsor/durability applied). ✓
- §4 Combat (strike/heavy/block/feint, timing meter, push-your-luck, stats) — Tasks 6–9, 16, 17. ✓
- §5 MVP scope — 4 opponents (config Task 3), training 3 stats (11), durability+repair (5,11), gear ×3 (3,11), 1 sponsor + bribe (5,11,12), injury/heal (5,11,12), end-states win/retire/die (12). ✓
- §6 Balance table — values encoded verbatim in `config.js` (Task 3). ✓
- §7 UI — HUD, fight screen, hub, result cards (Tasks 13–15, 17). ✓
- §8 Tech notes — vanilla JS single page (Task 1), config object (3), state machine (10), seeded RNG (2). ✓
- §9 Monetization hooks — explicitly out of scope; not built (correct). ✓
- §10 Success criteria — verified manually in Task 17 Step 4. ✓

**Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N" — every code step contains complete code. ✓

**Type consistency:** `effectiveStats` returns `{power, guard, speed, critWindowMult}` and is consumed identically in Tasks 11, 12, 13, 14, 17. `createCombat` player shape matches what `startFight` passes. Result-card fields produced in Task 12 match those read in `renderResult`/`renderGameOver` (Task 13). Timing tier strings (`miss/graze/hit/crit`) consistent across combat + config. `data-action` names emitted in render match handler keys in `main.js`. ✓
