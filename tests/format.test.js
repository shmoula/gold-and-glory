// tests/format.test.js
import { describe, it, expect } from 'vitest';
import { formatGold } from '../src/ui/format.js';

describe('formatGold', () => {
  it('formats with thousands separators and the G unit', () => {
    expect(formatGold(2450)).toBe('2,450\u00A0G');
    expect(formatGold(0)).toBe('0\u00A0G');
    expect(formatGold(1234567)).toBe('1,234,567\u00A0G');
  });

  it('signed mode uses + and U+2212 minus', () => {
    expect(formatGold(600, { signed: true })).toBe('+600\u00A0G');
    expect(formatGold(-90, { signed: true })).toBe('−90\u00A0G');
    expect(formatGold(0, { signed: true })).toBe('0\u00A0G');
  });

  it('unsigned mode renders negatives with U+2212 too', () => {
    expect(formatGold(-40)).toBe('−40\u00A0G');
  });

  // Both glyphs spec §2 mandates are invisible or near-invisible in an editor, so pin
  // them by codepoint — an assertion against a pasted character cannot catch a swap.
  it('pins the two significant codepoints', () => {
    expect([...formatGold(5)].map((c) => c.codePointAt(0))).toContain(0x00a0); // NBSP, not U+0020
    expect(formatGold(-5).codePointAt(0)).toBe(0x2212);                        // minus, not U+002D
  });
});
