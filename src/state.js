// src/state.js

export const PHASE = { HUB: 'HUB', FIGHT: 'FIGHT', RESULT: 'RESULT', GAMEOVER: 'GAMEOVER' };

const ALLOWED = {
  HUB: ['FIGHT', 'GAMEOVER'],
  FIGHT: ['RESULT'],
  RESULT: ['HUB', 'GAMEOVER'],
  GAMEOVER: [],
};

export function createGameState(seed, config) {
  return {
    seed,
    phase: PHASE.HUB,
    gold: config.startingGold,
    health: config.player.maxHealth,
    maxHealth: config.player.maxHealth,
    injuries: 0,
    weaponDurability: config.weapon.maxDurability,
    baseStats: { ...config.startingStats },
    trainingLevels: { power: 0, guard: 0, speed: 0 },
    gear: [],
    wins: 0,
    currentOpponentIndex: 0,
    sponsorUnlocked: false,
    bribedThisFight: false,
    combat: null,
    lastResult: null,
    ended: null,
  };
}

export function transition(state, toPhase) {
  if (!ALLOWED[state.phase].includes(toPhase)) {
    throw new Error(`Illegal transition ${state.phase} -> ${toPhase}`);
  }
  return { ...state, phase: toPhase };
}
