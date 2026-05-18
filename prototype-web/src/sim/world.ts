import { enemies as enemyDefinitions } from '../data/enemies';
import { rewardCardPool, startingHand } from '../data/cards';
import type { ChainState, EnemyIntentSummary, EnemyState, WorldState } from './types';

export const ENEMY_COLUMNS = 5;
export const ENEMY_ROWS = 3;
export const MAX_ENEMY_FORMATION_SLOTS = ENEMY_COLUMNS * ENEMY_ROWS;

export function slotToZ(slot: number): number {
  const row = Math.floor(slot / ENEMY_COLUMNS);
  return -6 - row * 5;
}

export function slotToLane(slot: number): number {
  const column = slot % ENEMY_COLUMNS;
  return column - Math.floor(ENEMY_COLUMNS / 2);
}

export function createEnemy(serial: number, slot: number): EnemyState {
  const definition = enemyDefinitions[(serial - 1) % enemyDefinitions.length];

  return {
    id: `enemy-${serial}`,
    definitionId: definition.id,
    name: definition.name,
    hp: definition.hp,
    maxHp: definition.hp,
    slot,
    lane: slotToLane(slot),
    z: slotToZ(slot),
    speed: definition.speed,
    damage: definition.damage,
    xpReward: definition.xpReward,
    alive: true
  };
}

export function createInitialChainState(): ChainState {
  return {
    playedCosts: [],
    lastCost: null,
    nextExpectedCost: 0,
    multiplier: 1,
    broken: false,
    breakReason: null,
    repairedThisTurn: false
  };
}

export function createEmptyEnemyIntentSummary(): EnemyIntentSummary {
  return {
    totalDamage: 0,
    intentEnemyIds: []
  };
}

export function createInitialWorld(): WorldState {
  const enemyList = Array.from({ length: MAX_ENEMY_FORMATION_SLOTS }, (_, slot) => createEnemy(slot + 1, slot));

  return {
    tick: 0,
    round: 1,
    elapsedSeconds: 0,
    player: {
      id: 'player',
      hp: 60,
      maxHp: 60,
      energy: 3,
      maxEnergy: 3,
      combo: 0,
      lastPlayedCost: null,
      costChainMultiplier: 1,
      xp: 0,
      level: 1,
      deck: [...startingHand],
      hand: [],
      drawPile: [...startingHand],
      discardPile: []
    },
    chain: createInitialChainState(),
    enemies: Object.fromEntries(enemyList.map((enemy) => [enemy.id, enemy])),
    enemyIntents: {},
    enemyIntentSummary: createEmptyEnemyIntentSummary(),
    fsm: {
      gameFlow: 'Deal',
      characters: {
        player: 'Idle',
        ...Object.fromEntries(enemyList.map((enemy) => [enemy.id, 'Move' as const]))
      }
    },
    reward: {
      xpThreshold: 45,
      candidateCardPool: [...rewardCardPool],
      choices: [],
      pickCount: 3,
      pending: false,
      source: null
    },
    debug: {
      events: [],
      commands: [],
      failedConditions: [],
      ruleHits: [],
      trace: []
    },
    roundAttackEnemyIds: [],
    nextEnemySerial: enemyList.length + 1,
    maxEnemySlots: MAX_ENEMY_FORMATION_SLOTS,
    lastBurstTick: null
  };
}
