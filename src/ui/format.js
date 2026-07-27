// src/ui/format.js — every gold amount in the UI goes through this. (Spec §2)
export function formatGold(n, { signed = false } = {}) {
  const abs = Math.abs(n).toLocaleString('en-US');
  const sign = n < 0 ? '−' : (signed && n > 0 ? '+' : '');
  // Separator is U+00A0, written as an escape so it cannot be normalised to a plain
  // space in transit and so it stays visible to readers. Spec §2.
  return `${sign}${abs}\u00A0G`;
}
