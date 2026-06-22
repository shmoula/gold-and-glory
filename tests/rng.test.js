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
