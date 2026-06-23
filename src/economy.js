// src/economy.js

export function trainingCost(level, config) {
  return Math.round(config.training.baseCost * Math.pow(config.training.scaling, level));
}

export function repairCost(missingDurability, config) {
  return missingDurability * config.weapon.repairCostPerPoint;
}

export function healCost(injuries, config) {
  return injuries * config.heal.costPerInjury;
}

export function canAfford(gold, cost) {
  return gold >= cost;
}

export function arenaTax(purse, bribed, config) {
  const rate = bribed ? config.arena.bribedTaxRate : config.arena.taxRate;
  return Math.round(purse * rate);
}

export function fightPayout(purse, bribed, config) {
  return purse - arenaTax(purse, bribed, config);
}

export function sponsorIncome(objectiveMet, config) {
  return config.sponsor.stipendPerFight + (objectiveMet ? config.sponsor.objectiveBonus : 0);
}
