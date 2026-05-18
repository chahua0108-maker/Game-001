export type TraceId = string;
export type EntityId = string;
export type CardId = string;

export type GameFlowState = 'Boot' | 'Deal' | 'PlayerTurn' | 'EnemyAttack' | 'EnemyRefill' | 'Reward' | 'Settlement';
export type CharacterState = 'Idle' | 'Move' | 'Cast' | 'HitStun' | 'Dead';
export type CardUtility = 'wild' | 'draw' | 'mana' | 'reorder';

export interface CardDefinition {
  id: CardId;
  name: string;
  cost: number;
  verb: string;
  damage: number;
  comboNode: 'hook' | 'cut' | 'spark' | 'mark' | 'reclaim' | 'burst';
  description: string;
  targets: 'front-enemy' | 'front-row' | 'all-enemies' | 'self';
  drawCards?: number;
  energyGain?: number;
  utilities?: CardUtility[];
}

export interface EnemyDefinition {
  id: string;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  xpReward: number;
  lane: number;
  z: number;
}

export interface PlayerState {
  id: EntityId;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  combo: number;
  lastPlayedCost: number | null;
  costChainMultiplier: number;
  xp: number;
  level: number;
  deck: CardId[];
  hand: CardId[];
  drawPile: CardId[];
  discardPile: CardId[];
}

export interface ChainState {
  playedCosts: number[];
  lastCost: number | null;
  nextExpectedCost: number;
  multiplier: number;
  broken: boolean;
  breakReason: string | null;
  repairedThisTurn: boolean;
}

export interface EnemyIntent {
  enemyId: EntityId;
  kind: 'attack';
  amount: number;
  slot: number;
  description: string;
  willRefill: boolean;
}

export interface EnemyIntentSummary {
  totalDamage: number;
  intentEnemyIds: EntityId[];
}

export interface RewardState {
  xpThreshold: number;
  candidateCardPool: CardId[];
  choices: CardId[];
  pickCount: number;
  pending: boolean;
  source: 'level-up' | null;
}

export interface EnemyState {
  id: EntityId;
  definitionId: string;
  name: string;
  hp: number;
  maxHp: number;
  slot: number;
  lane: number;
  z: number;
  speed: number;
  damage: number;
  xpReward: number;
  alive: boolean;
}

export interface FsmState {
  gameFlow: GameFlowState;
  characters: Record<EntityId, CharacterState>;
}

export interface DebugState {
  events: GameEvent[];
  commands: Command[];
  failedConditions: FailedCondition[];
  ruleHits: RuleHit[];
  trace: TraceEntry[];
}

export interface WorldState {
  tick: number;
  round: number;
  elapsedSeconds: number;
  player: PlayerState;
  chain: ChainState;
  enemies: Record<EntityId, EnemyState>;
  enemyIntents: Record<EntityId, EnemyIntent>;
  enemyIntentSummary: EnemyIntentSummary;
  fsm: FsmState;
  reward: RewardState;
  debug: DebugState;
  roundAttackEnemyIds: EntityId[];
  nextEnemySerial: number;
  maxEnemySlots: number;
  lastBurstTick: number | null;
}

export type Intent =
  | {
      type: 'advance-time';
      deltaSeconds: number;
      traceId: TraceId;
    }
  | {
      type: 'deal-hand';
      traceId: TraceId;
    }
  | {
      type: 'play-card';
      cardId: CardId;
      targetId?: EntityId;
      traceId: TraceId;
    }
  | {
      type: 'end-turn';
      traceId: TraceId;
    }
  | {
      type: 'select-reward';
      cardId: CardId;
      traceId: TraceId;
    }
  | {
      type: 'restart-run';
      traceId: TraceId;
    };

export type GameEvent =
  | {
      type: 'IntentReceived';
      traceId: TraceId;
      tick: number;
      intentType: Intent['type'];
    }
  | {
      type: 'TimeAdvanced';
      traceId: TraceId;
      tick: number;
      deltaSeconds: number;
    }
  | {
      type: 'EnemyAdvanced';
      traceId: TraceId;
      tick: number;
      enemyId: EntityId;
      fromZ: number;
      toZ: number;
      deltaZ: number;
    }
  | {
      type: 'EnemyPressure';
      traceId: TraceId;
      tick: number;
      enemyId: EntityId;
      z: number;
      amount: number;
    }
  | {
      type: 'AutoAttack';
      traceId: TraceId;
      tick: number;
      targetId: EntityId;
      amount: number;
      cadenceSeconds: number;
    }
  | {
      type: 'HandDealt';
      traceId: TraceId;
      tick: number;
      cardIds: CardId[];
    }
  | {
      type: 'TurnEnded';
      traceId: TraceId;
      tick: number;
      round: number;
    }
  | {
      type: 'EnemyAttacked';
      traceId: TraceId;
      tick: number;
      enemyId: EntityId;
      amount: number;
      remainingHp: number;
    }
  | {
      type: 'EnemiesRepositioned';
      traceId: TraceId;
      tick: number;
      activeEnemyIds: EntityId[];
    }
  | {
      type: 'RoundStarted';
      traceId: TraceId;
      tick: number;
      round: number;
    }
  | {
      type: 'CardPlayed';
      traceId: TraceId;
      tick: number;
      cardId: CardId;
      targetId?: EntityId;
      effectMultiplier: number;
    }
  | {
      type: 'ChainAdvanced';
      traceId: TraceId;
      tick: number;
      cardId: CardId;
      playedCost: number;
      nextExpectedCost: number;
      multiplier: number;
    }
  | {
      type: 'ChainBroken';
      traceId: TraceId;
      tick: number;
      cardId: CardId;
      expectedCost: number;
      playedCost: number;
      breakReason: string;
    }
  | {
      type: 'ChainRepaired';
      traceId: TraceId;
      tick: number;
      cardId: CardId;
      repairedCost: number;
      nextExpectedCost: number;
      multiplier: number;
    }
  | {
      type: 'PayoffTriggered';
      traceId: TraceId;
      tick: number;
      cardId: CardId;
      chainLength: number;
      multiplier: number;
      enhanced: boolean;
    }
  | {
      type: 'EnemyIntentDeclared';
      traceId: TraceId;
      tick: number;
      intent: EnemyIntent;
    }
  | {
      type: 'EnemyIntentResolved';
      traceId: TraceId;
      tick: number;
      enemyId: EntityId;
      amount: number;
      remainingHp: number;
    }
  | {
      type: 'DamageRequested';
      traceId: TraceId;
      tick: number;
      sourceId: EntityId;
      targetId: EntityId;
      amount: number;
      cardId?: CardId;
    }
  | {
      type: 'DamageApplied';
      traceId: TraceId;
      tick: number;
      sourceId: EntityId;
      targetId: EntityId;
      amount: number;
      remainingHp: number;
      cardId?: CardId;
    }
  | {
      type: 'EnemyKilled';
      traceId: TraceId;
      tick: number;
      enemyId: EntityId;
      cardId?: CardId;
    }
  | {
      type: 'XpGained';
      traceId: TraceId;
      tick: number;
      amount: number;
      sourceId: EntityId;
      totalXp: number;
    }
  | {
      type: 'LevelUpReached';
      traceId: TraceId;
      tick: number;
      level: number;
      xpThreshold: number;
    }
  | {
      type: 'RewardChoicesGenerated';
      traceId: TraceId;
      tick: number;
      choices: CardId[];
    }
  | {
      type: 'RewardChosen';
      traceId: TraceId;
      tick: number;
      cardId: CardId;
    }
  | {
      type: 'CardAddedToDeck';
      traceId: TraceId;
      tick: number;
      cardId: CardId;
      deckSize: number;
    }
  | {
      type: 'ClearBurstRequested';
      traceId: TraceId;
      tick: number;
      cardId: CardId;
    };

export type Command =
  | {
      type: 'DealHand';
      traceId: TraceId;
      count: number;
    }
  | {
      type: 'SpendEnergy';
      traceId: TraceId;
      amount: number;
      cardId: CardId;
    }
  | {
      type: 'DiscardPlayedCard';
      traceId: TraceId;
      cardId: CardId;
    }
  | {
      type: 'DiscardHand';
      traceId: TraceId;
      reason: string;
    }
  | {
      type: 'EnemyAttack';
      traceId: TraceId;
      enemyId: EntityId;
      amount?: number;
    }
  | {
      type: 'CompactEnemySlots';
      traceId: TraceId;
    }
  | {
      type: 'FillEnemySlots';
      traceId: TraceId;
    }
  | {
      type: 'AdvanceRound';
      traceId: TraceId;
    }
  | {
      type: 'GainXp';
      traceId: TraceId;
      amount: number;
      sourceId: EntityId;
      reason: string;
    }
  | {
      type: 'AddCardToDeck';
      traceId: TraceId;
      cardId: CardId;
    }
  | {
      type: 'ClearRewardChoices';
      traceId: TraceId;
    }
  | {
      type: 'DrawCards';
      traceId: TraceId;
      count: number;
      reason: string;
      excludeFromReshuffle?: CardId[];
    }
  | {
      type: 'GainEnergy';
      traceId: TraceId;
      amount: number;
      reason: string;
    }
  | {
      type: 'DamageEnemy';
      traceId: TraceId;
      sourceId: EntityId;
      targetId: EntityId;
      amount: number;
      cardId?: CardId;
    }
  | {
      type: 'AdvanceEnemy';
      traceId: TraceId;
      enemyId: EntityId;
      deltaZ: number;
    }
  | {
      type: 'DamagePlayer';
      traceId: TraceId;
      amount: number;
      sourceId: EntityId;
    }
  | {
      type: 'SetCharacterState';
      traceId: TraceId;
      entityId: EntityId;
      state: CharacterState;
      reason: string;
    }
  | {
      type: 'SetGameFlowState';
      traceId: TraceId;
      state: GameFlowState;
      reason: string;
    }
  | {
      type: 'SetCombo';
      traceId: TraceId;
      value: number;
      reason: string;
    }
  | {
      type: 'ClearBurst';
      traceId: TraceId;
      cardId: CardId;
    };

export interface FailedCondition {
  tick: number;
  traceId: TraceId;
  ruleId: string;
  conditionId: string;
  reason: string;
}

export interface RuleHit {
  tick: number;
  traceId: TraceId;
  ruleId: string;
  eventType: GameEvent['type'];
  passed: boolean;
}

export interface TraceEntry {
  tick: number;
  traceId: TraceId;
  kind: 'event' | 'rule' | 'condition' | 'command' | 'fsm';
  label: string;
}

export interface EnemySnapshot {
  id: EntityId;
  definitionId: string;
  name: string;
  hp: number;
  maxHp: number;
  slot: number;
  lane: number;
  z: number;
  alive: boolean;
}

export interface GameSnapshot {
  tick: number;
  round: number;
  elapsedSeconds: number;
  player: PlayerState;
  chain: ChainState;
  enemies: EnemySnapshot[];
  enemyIntents: EnemyIntent[];
  enemyIntentSummary: EnemyIntentSummary;
  fsm: FsmState;
  reward: RewardState;
  debug: DebugState;
  lastBurstTick: number | null;
}
