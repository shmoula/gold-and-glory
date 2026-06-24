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

const TIER_ORDER = [TIMING.MISS, TIMING.GRAZE, TIMING.HIT, TIMING.CRIT];

export function upgradeTier(tier) {
  const i = TIER_ORDER.indexOf(tier);
  return TIER_ORDER[Math.min(i + 1, TIER_ORDER.length - 1)];
}

export function applyPress(combat, timing, config) {
  const next = cloneCombat(combat);
  const dmg = computeDamage({
    baseDamage: config.combat.actions.strike.baseDamage,
    power: next.player.power, guard: next.enemy.guard, timing,
    pressMultiplier: config.combat.pressAttack.bonusMultiplier,
    weaponBroken: next.player.weaponBroken, config,
  });
  next.enemy.health -= dmg;
  next.guardDropped = true;
  next.log.push(`You PRESS the attack (${timing}) for ${dmg} — but drop your guard!`);
  return next;
}

function rollEnemyTier(rng, config) {
  const w = config.combat.enemyTierWeights;
  const roll = rng();
  let acc = 0;
  for (const tier of TIER_ORDER) {
    acc += w[tier];
    if (roll < acc) return tier;
  }
  return TIMING.HIT;
}

export function enemyTurn(combat, rng, config) {
  const next = cloneCombat(combat);
  let tier = rollEnemyTier(rng, config);
  if (next.guardDropped) tier = upgradeTier(tier);

  let dmg = computeDamage({
    baseDamage: config.combat.actions.strike.baseDamage,
    power: next.enemy.power, guard: next.player.guard, timing: tier, config,
  });

  if (next.counterReady) {
    dmg = Math.round(dmg * (1 - config.combat.actions.block.damageReduction));
    next.counterReady = false;
    next.log.push(`Counter! You absorb the blow, taking ${dmg}.`);
  } else {
    next.log.push(`${next.enemy.name} strikes (${tier}) for ${dmg}.`);
  }

  next.player.health -= dmg;
  next.guardDropped = false;
  return next;
}

export function markPressable(combat, action, timing) {
  const damaging = (action === 'strike' || action === 'heavy' || action === 'feint');
  const landed = timing !== TIMING.MISS;
  return { ...combat, canPress: damaging && landed && combat.enemy.health > 0 };
}
