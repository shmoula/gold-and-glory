// src/combat.js

export const TIMING = { MISS: 'miss', GRAZE: 'graze', HIT: 'hit', CRIT: 'crit' };

export function timingWindowWidth(speed, config) {
  return config.combat.baseTimingWidth + speed * config.combat.speedTimingBonus;
}

// distance: absolute distance from sweet-spot center (0..1 of the bar).
// critWindowMult: widens the crit window (Lucky Charm gear); default 1.
export function resolveTiming(distance, windowWidth, config, critWindowMult = 1) {
  const r = config.combat.timingTierRatios;
  if (distance <= windowWidth * r.crit * critWindowMult) return TIMING.CRIT;
  if (distance <= windowWidth * r.hit) return TIMING.HIT;
  if (distance <= windowWidth * r.graze) return TIMING.GRAZE;
  return TIMING.MISS;
}
