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

export function computeDamage({
  baseDamage, power, guard, timing,
  pressMultiplier = 1, weaponBroken = false, config,
}) {
  const mult = config.combat.timingMult[timing];
  if (mult === 0) return 0;
  let dmg = (baseDamage + power) * mult * pressMultiplier;
  if (weaponBroken) dmg *= config.weapon.brokenDamageMultiplier;
  dmg -= guard;
  return Math.max(0, Math.round(dmg));
}
