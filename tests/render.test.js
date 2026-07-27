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
    s.health = 32; // 0.32 of 100 \u2014 below the third
    expect(renderHud(s, CONFIG)).toContain('is-urgent');
    s.health = 33; // 0.33 is not < 0.33
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
