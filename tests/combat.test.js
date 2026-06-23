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
