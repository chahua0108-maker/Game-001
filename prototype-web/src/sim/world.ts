import { enemies as enemyDefinitions } from '../data/enemies';
import { rewardCardPool, startingHand } from '../data/cards';
import { cloneActivityCarryover, cloneActivityState, currentActivityLevel, scaleEnemyForActivityLevel } from './activity';
import { createInitialCardUpgradeState } from './cardUpgrades';
import { INITIAL_REWARD_XP_THRESHOLD } from './rewardProgression';
import { createInitialShortRunRouteState } from './runRoute';
import type { ActivityLevelDefinition, ActivityState, ChainState, EnemyIntentSummary, EnemyState, RunState, WorldState } from './types';

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

export function createEnemy(serial: number, slot: number, activityLevel?: ActivityLevelDefinition | null): EnemyState {
  const definition = enemyDefinitions[(serial - 1) % enemyDefinitions.length];

  const enemy = {
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

  return activityLevel ? scaleEnemyForActivityLevel(enemy, activityLevel) : enemy;
}

export function createInitialChainState(): ChainState {
  return {
    playedCosts: [],
    lastCost: null,
    nextExpectedCost: 0,
    multiplier: 1,
    broken: false,
    breakReason: null,
    repairedThisTurn: false,
    extendedThisTurn: false
  };
}

export function createEmptyEnemyIntentSummary(): EnemyIntentSummary {
  return {
    totalDamage: 0,
    intentEnemyIds: []
  };
}

export function createInitialRunState(runNumber = 1, maxNodes = 3): RunState {
  return {
    runNumber,
    currentNode: 1,
    maxNodes,
    rewardHistory: [],
    status: 'in-progress'
  };
}

export function createInitialWorld(runNumber = 1, activity?: ActivityState): WorldState {
  const activityState = activity ? cloneActivityState(activity) : undefined;
  const activityLevel = activityState ? currentActivityLevel(activityState) : null;
  const activityCarryover = activityState?.carryover ? cloneActivityCarryover(activityState.carryover) : null;
  const playerMaxHp = Math.max(activityCarryover?.maxHp ?? 0, activityLevel?.playerMaxHp ?? 60);
  const carryoverStartsFullHp = activityCarryover ? activityCarryover.nextRunStartHp >= activityCarryover.maxHp : false;
  const playerStartHp = carryoverStartsFullHp
    ? playerMaxHp
    : Math.max(1, Math.min(activityCarryover?.nextRunStartHp ?? playerMaxHp, playerMaxHp));
  const playerMaxEnergy = activityCarryover?.maxEnergy ?? 3;
  const playerDeck = activityCarryover?.deck ?? startingHand;
  const rewardCandidateCardPool = activityCarryover?.rewardCandidateCardPool ?? rewardCardPool;
  const cardUpgrades = activityCarryover?.cardUpgrades ?? createInitialCardUpgradeState();
  const rewardPickCount = activityLevel?.rewardPickCount ?? 3;
  const enemyList = Array.from({ length: MAX_ENEMY_FORMATION_SLOTS }, (_, slot) =>
    createEnemy(slot + 1, slot, activityLevel)
  );

  return {
    tick: 0,
    round: 1,
    elapsedSeconds: 0,
    player: {
      id: 'player',
      hp: playerStartHp,
      maxHp: playerMaxHp,
      energy: playerMaxEnergy,
      maxEnergy: playerMaxEnergy,
      tempAuthorizationMP: 0,
      authorizationRestriction: null,
      lastAuthorizationReason: null,
      lastAuthorizationSourceCardId: null,
      payoffArmed: false,
      combo: 0,
      lastPlayedCost: null,
      costChainMultiplier: 1,
      xp: activityCarryover?.xp ?? 0,
      level: activityCarryover?.level ?? 1,
      deck: [...playerDeck],
      hand: [],
      drawPile: [...playerDeck],
      discardPile: [],
      exhaustPile: [],
      retainedCards: []
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
    run: createInitialRunState(runNumber, activityLevel?.nodeCount ?? 3),
    activity: activityState,
    activitySettlementPreview: null,
    route: createInitialShortRunRouteState(),
    reward: {
      xpThreshold: activityCarryover?.xpThreshold ?? INITIAL_REWARD_XP_THRESHOLD,
      candidateCardPool: [...rewardCandidateCardPool],
      choices: [],
      pickCount: rewardPickCount,
      pending: false,
      source: null
    },
    cardUpgrades,
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
