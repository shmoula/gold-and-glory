// src/game.js
import { trainingCost, repairCost, healCost, canAfford } from './economy.js';

export function effectiveStats(state, config) {
  const lvl = state.trainingLevels;
  const per = config.training.statPerLevel;
  const stats = {
    power: state.baseStats.power + lvl.power * per,
    guard: state.baseStats.guard + lvl.guard * per,
    speed: state.baseStats.speed + lvl.speed * per,
    critWindowMult: 1,
  };
  for (const id of state.gear) {
    const g = config.gear[id];
    if (!g) continue;
    if (g.powerBonus) stats.power += g.powerBonus;
    if (g.guardBonus) stats.guard += g.guardBonus;
    if (g.critWindowMult) stats.critWindowMult = g.critWindowMult;
  }
  return stats;
}

export function trainStat(state, stat, config) {
  const cost = trainingCost(state.trainingLevels[stat], config);
  if (!canAfford(state.gold, cost)) return state;
  return {
    ...state,
    gold: state.gold - cost,
    trainingLevels: { ...state.trainingLevels, [stat]: state.trainingLevels[stat] + 1 },
  };
}

export function repairWeapon(state, config) {
  const missing = config.weapon.maxDurability - state.weaponDurability;
  if (missing <= 0) return state;
  const cost = repairCost(missing, config);
  if (!canAfford(state.gold, cost)) return state;
  return { ...state, gold: state.gold - cost, weaponDurability: config.weapon.maxDurability };
}

export function healInjuries(state, config) {
  if (state.injuries <= 0) return state;
  const cost = healCost(state.injuries, config);
  if (!canAfford(state.gold, cost)) return state;
  return { ...state, gold: state.gold - cost, injuries: 0, health: state.maxHealth };
}

export function buyGear(state, gearId, config) {
  const g = config.gear[gearId];
  if (!g || state.gear.includes(gearId)) return state;
  if (!canAfford(state.gold, g.cost)) return state;
  return { ...state, gold: state.gold - g.cost, gear: [...state.gear, gearId] };
}

export function bribeOfficial(state, config) {
  if (state.bribedThisFight) return state;
  if (!canAfford(state.gold, config.arena.bribeCost)) return state;
  return { ...state, gold: state.gold - config.arena.bribeCost, bribedThisFight: true };
}
