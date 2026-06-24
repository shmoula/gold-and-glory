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
