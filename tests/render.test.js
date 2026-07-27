// tests/render.test.js
import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { createGameState } from '../src/state.js';
import {
  renderHud, renderHub, renderResult, renderGameOver, renderFight,
  meterDistance, meterPosition, meterPeriod,
} from '../src/ui/render.js';
import { startFight } from '../src/game.js';

describe('renderHud', () => {
  it('shows gold, health, and durability', () => {
    const s = createGameState(1, CONFIG);
    const html = renderHud(s, CONFIG);
    expect(html).toContain('100'); // gold
    expect(html).toContain('Health');
    expect(html).toContain('Durability');
  });

  it('renders bars with fill widths and injury pips', () => {
    const s = createGameState(1, CONFIG);
    s.health = 65; s.injuries = 3; s.weaponDurability = 15;
    const html = renderHud(s, CONFIG);
    expect(html).toContain('class="hud"');
    expect(html).toContain('width:65%');                       // health fill
    expect(html).toContain('width:50%');                       // durability 15/30
    expect((html.match(/pip pip--filled/g) || []).length).toBe(3);
    expect((html.match(/class="pip[" ]/g) || []).length).toBe(5); // 5 slots at 3 injuries
    expect(html).toContain('65/100');
  });

  it('renders max(injuries, 5) pip slots once injuries pass five', () => {
    const s = createGameState(1, CONFIG);
    s.injuries = 7;
    const html = renderHud(s, CONFIG);
    expect((html.match(/class="pip[" ]/g) || []).length).toBe(7);
    expect((html.match(/pip pip--filled/g) || []).length).toBe(7);
  });

  it('fills the leading pips, not the trailing ones', () => {
    const s = createGameState(1, CONFIG);
    s.injuries = 2;
    const pips = renderHud(s, CONFIG).match(/<i class="pip[^"]*"><\/i>/g);
    expect(pips.map((p) => p.includes('pip--filled')))
      .toEqual([true, true, false, false, false]);
  });

  it('marks the health bar urgent strictly below a third, not at it', () => {
    const s = createGameState(1, CONFIG);
    // Derived from maxHealth so the pair stays astride the threshold if that value changes:
    // atThreshold is the smallest health with health/maxHealth >= 0.33.
    const atThreshold = Math.ceil(s.maxHealth * 0.33);
    s.health = atThreshold - 1;
    expect(renderHud(s, CONFIG)).toContain('is-urgent');
    s.health = atThreshold;
    expect(renderHud(s, CONFIG)).not.toContain('is-urgent');
  });

  it('leaves a healthy bar unmarked', () => {
    const s = createGameState(1, CONFIG);
    s.health = s.maxHealth;
    expect(renderHud(s, CONFIG)).not.toContain('is-urgent');
  });

  it('clamps an over-max bar to 100% and to a valid aria-valuenow', () => {
    const s = createGameState(1, CONFIG);
    s.health = 65;
    s.weaponDurability = CONFIG.weapon.maxDurability + 12; // 42/30
    const html = renderHud(s, CONFIG);
    expect(html).toContain('width:100%');
    expect(html).not.toMatch(/width:1[1-9]\d%/);
    expect(html).toContain(`aria-valuenow="${CONFIG.weapon.maxDurability}"`);
    expect(html).not.toContain('aria-valuenow="42"');
  });

  it('shows the clamped numeral, so the visible text matches aria-valuenow', () => {
    const s = createGameState(1, CONFIG);
    const max = CONFIG.weapon.maxDurability;
    s.weaponDurability = max + 12;
    const html = renderHud(s, CONFIG);
    expect(html).toContain(`${max}/${max}`);
    expect(html).not.toContain(`${max + 12}/${max}`);
  });

  it('uses a singular aria-label for exactly one injury', () => {
    const s = createGameState(1, CONFIG);
    s.injuries = 1;
    expect(renderHud(s, CONFIG)).toContain('aria-label="1 injury"');
    s.injuries = 2;
    expect(renderHud(s, CONFIG)).toContain('aria-label="2 injuries"');
  });

  it('formats gold through formatGold and exposes the raw value on the ticker', () => {
    const s = createGameState(1, CONFIG);
    s.gold = 2450;
    const html = renderHud(s, CONFIG);
    expect(html).toContain('2,450\u00A0G');
    expect(html).toContain('data-value="2450"');
    expect(html).not.toContain('data-gold');
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

  it('marks unaffordable buttons instead of disabling them', () => {
    const s = createGameState(1, CONFIG);
    s.gold = 0;
    const html = renderHub(s, CONFIG);
    expect(html).toContain('is-unaffordable');
    expect(html).toContain('data-missing=');
  });

  it('puts prices in the price slot, not in parentheses', () => {
    const s = createGameState(1, CONFIG);
    const html = renderHub(s, CONFIG);
    expect(html).toContain('btn__price');
    expect(html).not.toMatch(/\(\d+g\)/);
  });

  it('flags urgent sinks from state thresholds', () => {
    const s = createGameState(1, CONFIG);
    s.weaponDurability = 10; // < 50% of 30
    s.injuries = 2;
    const html = renderHub(s, CONFIG);
    expect((html.match(/is-urgent/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('carries the formatted shortfall in data-missing', () => {
    const s = createGameState(1, CONFIG);
    s.gold = 25; // Lucky Charm costs 150 → 125 short
    const html = renderHub(s, CONFIG);
    // U+00A0 written as an escape (spec §2); pasting the literal hides regressions.
    expect(html).toContain(`data-missing="125\u00A0G"`);
    expect(html.match(/data-missing="125(.)G"/)[1].codePointAt(0)).toBe(0x00a0);
    // Mirrored onto the snark span: spec §6.2 renders the shortfall via
    // .btn__snark::after { content: … attr(data-missing) … }, and attr() resolves against
    // the pseudo-element own originating element, not the enclosing button.
    expect(html).toMatch(/class="btn__snark snark" data-missing="125\u00A0G"/);
  });

  it('keeps true no-ops disabled rather than unaffordable', () => {
    const s = createGameState(1, CONFIG);
    s.gold = 100000;
    s.weaponDurability = CONFIG.weapon.maxDurability; // nothing to repair
    s.injuries = 0;                                   // nothing to heal
    const html = renderHub(s, CONFIG);
    expect(html).toMatch(/data-action="repair"[^>]*disabled/);
    expect(html).toMatch(/data-action="heal"[^>]*disabled/);
    expect(html).not.toContain('is-unaffordable');
  });

  it('renders snark asides from the config table, parenthesized by the markup', () => {
    const s = createGameState(1, CONFIG);
    s.injuries = 1;
    const html = renderHub(s, CONFIG);
    expect(html).toContain('class="btn__snark snark"');
    expect(html).toContain(`(${CONFIG.snark.heal})`);
  });

  it('gives irreversible choices the commit variant', () => {
    const s = createGameState(1, CONFIG);
    const html = renderHub(s, CONFIG);
    expect(html).toMatch(/data-action="next-fight"[^>]*btn--commit/);
    expect(html).toMatch(/data-action="retire"[^>]*btn--commit/);
  });

  it('renders owned gear as an owned plank with no buy action', () => {
    const s = createGameState(1, CONFIG);
    s.gear = ['shield'];
    const html = renderHub(s, CONFIG);
    expect(html).toContain('is-owned');
    expect(html).not.toContain('data-action="buy-shield"');
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

describe('meterPosition', () => {
  it('sweeps 0 → 1 over one period and back down (triangle wave)', () => {
    expect(meterPosition(0, 1400)).toBeCloseTo(0);
    expect(meterPosition(700, 1400)).toBeCloseTo(0.5);
    expect(meterPosition(1400, 1400)).toBeCloseTo(1);
    expect(meterPosition(2100, 1400)).toBeCloseTo(0.5);
    expect(meterPosition(2800, 1400)).toBeCloseTo(0);
  });

  it('mirrors around the turn point — the return sweep retraces the outbound one', () => {
    for (const dt of [100, 333, 700, 1250]) {
      expect(meterPosition(1400 - dt, 1400)).toBeCloseTo(meterPosition(1400 + dt, 1400));
    }
  });

  it('stays within [0,1] and keeps ping-ponging across many periods', () => {
    for (const t of [0, 350, 1401, 3500, 140000, 987654]) {
      const p = meterPosition(t, 1400);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
    expect(meterPosition(1400 * 10, 1400)).toBeCloseTo(0); // even sweeps end at the start
    expect(meterPosition(1400 * 11, 1400)).toBeCloseTo(1); // odd sweeps end at the far edge
  });
});

describe('meterPeriod', () => {
  it('starts at the base sweep duration and speeds up per opponent tier', () => {
    expect(meterPeriod(0, CONFIG)).toBe(CONFIG.combat.meterPeriodMs.base);
    expect(meterPeriod(1, CONFIG)).toBe(
      CONFIG.combat.meterPeriodMs.base + CONFIG.combat.meterPeriodMs.perTier,
    );
  });

  it('never drops below the configured minimum', () => {
    expect(meterPeriod(100, CONFIG)).toBe(CONFIG.combat.meterPeriodMs.min);
  });
});
