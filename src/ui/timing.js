// src/ui/timing.js - pure math for the fight timing meter (spec §6.6 / plan Task 6).
// No DOM, no markup: the sweep is driven by rAF in main.js and drawn by the fight screen.

export function meterDistance(clickPos, sweetSpot) {
  return Math.abs(clickPos - sweetSpot);
}

// Cursor position on the [0,1] track as a triangle wave over elapsed time,
// so the sweep speed is independent of display refresh rate.
export function meterPosition(elapsedMs, periodMs) {
  const phase = (elapsedMs / periodMs) % 2;
  return phase < 1 ? phase : 2 - phase;
}

// One-way sweep duration for the given opponent tier.
export function meterPeriod(tierIndex, config) {
  const { base, perTier, min } = config.combat.meterPeriodMs;
  return Math.max(min, base + perTier * tierIndex);
}

// Zone edges for the meter, matching resolveTiming's nested-window logic (spec §6.4).
// Each band is [center - width*ratio, center + width*ratio] trimmed to the track, so the
// drawn edge and the resolver's switch point are the same number — draw them from anything
// else and the bar shows gold where the fight logs a miss.
// `critWindowMult` (the Lucky Charm) widens the crit test in resolveTiming, so it has to widen
// the drawn crit band by the same factor. Otherwise the charm pays 2.0x over a slice of track
// that paints as plain HIT, and 150g of gear changes nothing the player can see. resolveTiming
// is the authority; spec §6.4's zone formulae omit the multiplier and are wrong (Task 10).
export function meterZones(center, windowWidth, config, critWindowMult = 1) {
  const r = config.combat.timingTierRatios;
  const zone = (mult) => {
    const start = Math.max(0, center - windowWidth * mult);
    const end = Math.min(1, center + windowWidth * mult);
    return { start, size: end - start };
  };
  return { crit: zone(r.crit * critWindowMult), hit: zone(r.hit), graze: zone(r.graze) };
}

// The per-turn sweet spot: a [0,1) roll mapped onto config's band. Kept pure and fed the
// run's seeded rng by main.js, so a replayed seed replays the same sweet spots — and so the
// seeding is testable without touching the generator.
export function sweetCenter(roll, config) {
  const { min, max } = config.combat.sweetCenter;
  return min + roll * (max - min);
}
