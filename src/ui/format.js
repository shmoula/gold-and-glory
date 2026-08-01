// src/ui/format.js — every gold amount in the UI goes through this. (Spec §2)

// Spec §2's minus sign, U+2212, written as an escape and exported so it is spelled exactly once
// in the whole UI. A pasted U+2212 and an ASCII hyphen are the same picture in an editor and in
// a diff, so three modules each keeping their own copy was three chances to ship the wrong one
// with a green suite. Everything that needs the character imports this.
export const MINUS = '\u2212';

export function formatGold(n, { signed = false } = {}) {
  const abs = Math.abs(n).toLocaleString('en-US');
  const sign = n < 0 ? MINUS : signed && n > 0 ? '+' : '';
  // Separator is U+00A0, written as an escape so it cannot be normalised to a plain
  // space in transit and so it stays visible to readers. Spec §2.
  return `${sign}${abs}\u00A0G`;
}
