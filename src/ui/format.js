// src/ui/format.js — every gold amount in the UI goes through this. (Spec §2)
export function formatGold(n, { signed = false } = {}) {
  const abs = Math.abs(n).toLocaleString('en-US');
  const sign = n < 0 ? '−' : (signed && n > 0 ? '+' : '');
  return `${sign}${abs} G`;
}
