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
