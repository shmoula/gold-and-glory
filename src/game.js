// src/game.js
import {
  trainingCost,
  repairCost,
  healCost,
  canAfford,
  fightPayout,
  arenaTax,
  sponsorIncome,
} from './economy.js';
import { PHASE, transition } from './state.js';
import { createCombat } from './combat.js';
import { rngChance, rngInt } from './rng.js';

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

export function startFight(state, config) {
  const opponent = config.opponents[state.currentOpponentIndex];
  const eff = effectiveStats(state, config);
  const playerStats = {
    health: state.health,
    maxHealth: state.maxHealth,
    power: eff.power,
    guard: eff.guard,
    speed: eff.speed,
    critWindowMult: eff.critWindowMult,
    weaponBroken: state.weaponDurability <= 0,
  };
  const combat = createCombat(playerStats, opponent, config);
  return { ...transition(state, PHASE.FIGHT), combat };
}

export function resolveFightOutcome(state, won, rng, config) {
  const opponent = config.opponents[state.currentOpponentIndex];
  const isLast = state.currentOpponentIndex === config.opponents.length - 1;

  if (won) {
    const tax = arenaTax(opponent.purse, state.bribedThisFight, config);
    const net = fightPayout(opponent.purse, state.bribedThisFight, config);
    const newWins = state.wins + 1;
    const sponsorActive = state.sponsorUnlocked;
    const objectiveMet = !state.combat.blockedThisFight; // "win without blocking"
    const sponsor = sponsorActive ? sponsorIncome(objectiveMet, config) : 0;
    const durabilityLost = Math.min(config.weapon.durabilityLossPerFight, state.weaponDurability);

    const result = {
      won: true,
      died: false,
      opponentName: opponent.name,
      purse: opponent.purse,
      tax,
      sponsorIncome: sponsor,
      netGold: net + sponsor,
      durabilityLost,
      injuriesGained: 0,
      causeOfDeath: null,
      commentary: `${opponent.name} falls. The crowd wants more.`,
    };

    const base = {
      ...state,
      gold: state.gold + net + sponsor,
      weaponDurability: state.weaponDurability - durabilityLost,
      health: state.combat.player.health,
      wins: newWins,
      sponsorUnlocked: state.sponsorUnlocked || newWins >= config.sponsor.unlockWins,
      currentOpponentIndex: isLast ? state.currentOpponentIndex : state.currentOpponentIndex + 1,
      bribedThisFight: false,
      combat: null,
      lastResult: result,
    };

    if (isLast) {
      return {
        ...transition(base, PHASE.RESULT),
        phase: PHASE.GAMEOVER,
        ended: 'win-circuit',
        lastResult: result,
      };
    }
    return { ...transition(base, PHASE.RESULT), lastResult: result };
  }

  // loss
  const died = rngChance(rng, opponent.deathRisk);
  const durabilityLost = Math.min(config.weapon.durabilityLossPerFight, state.weaponDurability);
  const cause = died ? config.deathRecaps[rngInt(rng, 0, config.deathRecaps.length - 1)] : null;

  const result = {
    won: false,
    died,
    opponentName: opponent.name,
    purse: 0,
    tax: 0,
    sponsorIncome: 0,
    netGold: 0,
    durabilityLost,
    injuriesGained: died ? 0 : 1,
    causeOfDeath: cause,
    commentary: died
      ? `And that's the end of that gladiator.`
      : `You crawl out of the arena, poorer and bleeding.`,
  };

  const base = {
    ...state,
    weaponDurability: state.weaponDurability - durabilityLost,
    injuries: died ? state.injuries : state.injuries + 1,
    health: died ? 0 : Math.max(1, state.maxHealth - 20 * (state.injuries + 1)),
    bribedThisFight: false,
    combat: null,
    lastResult: result,
  };

  if (died) {
    return {
      ...transition(base, PHASE.RESULT),
      phase: PHASE.GAMEOVER,
      ended: 'dead',
      lastResult: result,
    };
  }
  return { ...transition(base, PHASE.RESULT), lastResult: result };
}

export function retire(state) {
  return { ...transition(state, PHASE.GAMEOVER), ended: 'retired' };
}
