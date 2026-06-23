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

export function createCombat(playerStats, opponent, config) {
  return {
    player: {
      health: playerStats.health,
      maxHealth: playerStats.maxHealth,
      power: playerStats.power,
      guard: playerStats.guard,
      speed: playerStats.speed,
      critWindowMult: playerStats.critWindowMult,
      weaponBroken: playerStats.weaponBroken,
    },
    enemy: {
      health: opponent.health,
      maxHealth: opponent.health,
      power: opponent.power,
      guard: opponent.guard,
      speed: opponent.speed,
      name: opponent.name,
      deathRisk: opponent.deathRisk,
    },
    guardDropped: false,
    counterReady: false,
    blockedThisFight: false,
    pendingBonus: 0, // follow-up bonus from a feint, applied to next attack
    log: [],
  };
}

// Returns a NEW combat state (does not mutate the input).
export function applyPlayerAction(combat, action, timing, config) {
  const next = cloneCombat(combat);
  const def = config.combat.actions[action];

  if (action === 'block') {
    next.counterReady = true;
    next.blockedThisFight = true;
    next.log.push('You raise your guard, ready to counter.');
    return next;
  }

  if (action === 'feint') {
    next.pendingBonus = def.nextHitBonus;
    const dmg = computeDamage({
      baseDamage: def.baseDamage, power: next.player.power,
      guard: next.enemy.guard, timing, weaponBroken: next.player.weaponBroken, config,
    });
    next.enemy.health -= dmg;
    next.log.push(`You feint (${timing}) for ${dmg}, baiting their guard.`);
    return next;
  }

  // strike / heavy
  const pressMultiplier = 1 + (combat.pendingBonus || 0);
  const dmg = computeDamage({
    baseDamage: def.baseDamage, power: next.player.power,
    guard: next.enemy.guard, timing, pressMultiplier,
    weaponBroken: next.player.weaponBroken, config,
  });
  next.enemy.health -= dmg;
  next.pendingBonus = 0;
  next.log.push(`You ${action} (${timing}) for ${dmg} damage.`);
  return next;
}

export function isFightOver(combat) {
  return combat.player.health <= 0 || combat.enemy.health <= 0;
}

export function fightWinner(combat) {
  if (combat.enemy.health <= 0) return 'player';
  if (combat.player.health <= 0) return 'enemy';
  return null;
}

function cloneCombat(combat) {
  return {
    ...combat,
    player: { ...combat.player },
    enemy: { ...combat.enemy },
    log: [...combat.log],
  };
}
