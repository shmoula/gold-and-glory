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
  baseDamage,
  power,
  guard,
  timing,
  pressMultiplier = 1,
  weaponBroken = false,
  config,
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
    canPress: false, // set by markPressable after a landed player hit
    pendingBonus: 0, // follow-up bonus from a feint, applied to next attack
    // This turn's timing sweet spot (spec §6.4). Re-seeded from the run's rng before every
    // player turn; born at the centre of the configured band so the field always holds a
    // number. Without it both the renderer and the rAF loop need their own `?? 0.5` fallback,
    // and two independently-written fallbacks are one edit away from disagreeing about where
    // the bright band is.
    sweet: (config.combat.sweetCenter.min + config.combat.sweetCenter.max) / 2,
    // The exchange being fought, and the number spec §6.9's log stamps on every entry it
    // pushes. It advances once the enemy has answered, so a turn is one exchange — player
    // action, an optional press, and the reply — however many lines that prints. Numbering by
    // log length instead ran the displayed counter at roughly double the real turn.
    turn: 1,
    log: [],
  };
}

// One log entry, spec §6.9. `text` is a template written here and only here; every value that
// could carry content (a fighter's name) is passed separately so the renderer can escape it
// once. Placeholders: {who} a name, {dmg} damage dealt, {taken} damage suffered, {gold} money.
// `kind` is 'attack' or 'status' — §6.9 sets status clauses (block, counter, feint) in italics.
function pushEntry(combat, kind, text, values = {}) {
  combat.log.push({ turn: combat.turn, kind, text, ...values });
}

// Returns a NEW combat state (does not mutate the input).
export function applyPlayerAction(combat, action, timing, config) {
  const next = cloneCombat(combat);
  const def = config.combat.actions[action];

  if (action === 'block') {
    next.counterReady = true;
    next.blockedThisFight = true;
    pushEntry(next, 'status', 'You raise your guard, ready to counter.');
    return next;
  }

  if (action === 'feint') {
    next.pendingBonus = def.nextHitBonus;
    const dmg = computeDamage({
      baseDamage: def.baseDamage,
      power: next.player.power,
      guard: next.enemy.guard,
      timing,
      weaponBroken: next.player.weaponBroken,
      config,
    });
    next.enemy.health -= dmg;
    pushEntry(next, 'status', `You feint (${timing}) for {dmg}, baiting their guard.`, { dmg });
    return next;
  }

  // strike / heavy
  const pressMultiplier = 1 + (combat.pendingBonus || 0);
  const dmg = computeDamage({
    baseDamage: def.baseDamage,
    power: next.player.power,
    guard: next.enemy.guard,
    timing,
    pressMultiplier,
    weaponBroken: next.player.weaponBroken,
    config,
  });
  next.enemy.health -= dmg;
  next.pendingBonus = 0;
  // A swing that lands for nothing gets the §6.9 aside; a swing that hurts speaks for itself.
  pushEntry(next, 'attack', `You ${action} (${timing}) for {dmg} damage.`,
    { dmg, ...(dmg === 0 ? { snark: config.snark.logWhiff } : {}) });
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
  // bonusMultiplier is extra damage on top of a normal hit: 0.6 -> 1.6x.
  const dmg = computeDamage({
    baseDamage: config.combat.actions.strike.baseDamage,
    power: next.player.power,
    guard: next.enemy.guard,
    timing,
    pressMultiplier: 1 + config.combat.pressAttack.bonusMultiplier,
    weaponBroken: next.player.weaponBroken,
    config,
  });
  next.enemy.health -= dmg;
  next.pendingBonus = 0;
  next.guardDropped = true;
  // \u2014 EM DASH written as an escape: this project has already shipped one bug from a
  // pasted lookalike character (see the U+00A0 post-mortem).
  pushEntry(next, 'attack', `You PRESS the attack (${timing}) for {dmg} \u2014 but drop your guard!`,
    { dmg, snark: config.snark.logPress });
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
    power: next.enemy.power,
    guard: next.player.guard,
    timing: tier,
    config,
  });

  if (next.counterReady) {
    dmg = Math.round(dmg * (1 - config.combat.actions.block.damageReduction));
    next.counterReady = false;
    pushEntry(next, 'status', 'Counter! You absorb the blow, taking {taken}.', { taken: dmg });
  } else {
    // The name is a value, not part of the template: the renderer escapes it exactly once.
    pushEntry(next, 'attack', `{who} strikes (${tier}) for {taken}.`,
      { who: next.enemy.name, taken: dmg });
  }

  next.player.health -= dmg;
  next.guardDropped = false;
  // The exchange is over: the next action the player takes opens a new turn (spec §6.9).
  next.turn += 1;
  return next;
}

export function markPressable(combat, action, timing) {
  const damaging = action === 'strike' || action === 'heavy' || action === 'feint';
  const landed = timing !== TIMING.MISS;
  return { ...combat, canPress: damaging && landed && combat.enemy.health > 0 };
}
