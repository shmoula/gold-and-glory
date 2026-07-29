// tests/format.test.js
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { formatGold, MINUS } from '../src/ui/format.js';

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

// Spec §2's minus sign was spelled three times over: a local const in ui/effects.js, another in
// ui/render.js, and a pasted glyph inside formatGold itself. Three chances for one of them to
// drift into a hyphen with a green suite, since a pasted U+2212 and a U+002D are the same
// picture. There is now one, exported from here.
describe('MINUS', () => {
  it('is the sign formatGold itself writes, pinned by codepoint', () => {
    expect(MINUS).toHaveLength(1);
    expect(MINUS.codePointAt(0)).toBe(0x2212); // never compared against a pasted character
    expect(formatGold(-5).startsWith(MINUS)).toBe(true);
    expect(formatGold(-5, { signed: true }).startsWith(MINUS)).toBe(true);
  });

  // Source-level, because a second copy that happens to be correct today is invisible to every
  // behavioural test — which is exactly how three of them accumulated.
  it('is the only place in src/ that spells the character out', () => {
    const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
    // The glyph itself, or the escape sequence that produces it.
    const spelled = /\u2212|\\u2212/;
    const offenders = walk('src')
      .filter((f) => f.endsWith('.js') && f !== 'src/ui/format.js')
      .filter((f) => spelled.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
