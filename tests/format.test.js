// tests/format.test.js
import { describe, it, expect } from 'vitest';
import { formatGold } from '../src/ui/format.js';

describe('formatGold', () => {
  it('formats with thousands separators and the G unit', () => {
    expect(formatGold(2450)).toBe('2,450 G');
    expect(formatGold(0)).toBe('0 G');
    expect(formatGold(1234567)).toBe('1,234,567 G');
  });

  it('signed mode uses + and U+2212 minus', () => {
    expect(formatGold(600, { signed: true })).toBe('+600 G');
    expect(formatGold(-90, { signed: true })).toBe('−90 G');
    expect(formatGold(0, { signed: true })).toBe('0 G');
  });

  it('unsigned mode renders negatives with U+2212 too', () => {
    expect(formatGold(-40)).toBe('−40 G');
  });
});
