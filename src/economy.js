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
