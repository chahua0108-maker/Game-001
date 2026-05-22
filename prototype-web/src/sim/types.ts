import type { ShortRunRouteState } from './runRoute';

export type TraceId = string;
export type EntityId = string;
export type CardId = string;
export type CardZone = 'deck' | 'hand' | 'drawPile' | 'discardPile' | 'exhaustPile' | 'retainedCards';
export type CardGemColor = 'red' | 'blue' | 'gold';
export type CardGemId = 'crimson_chip' | 'tempo_lens' | 'ledger_seal';
export type CardUpgradeChoiceType = 'raise-level' | 'add-gem-slot' | 'socket-gem';

export type GameFlowState =
  | 'Boot'
  | 'Deal'
  | 'PlayerTurn'
  | 'EnemyAttack'
  | 'EnemyRefill'
  | 'Reward'
  | 'RouteSelect'
  | 'Settlement';
export type CharacterState = 'Idle' | 'Move' | 'Cast' | 'HitStun' | 'Dead';
export type RunStatus = 'in-progress' | 'victory' | 'failure';
export type CardUtility = 'wild' | 'draw' | 'mana' | 'reorder';
export type CardType = 'attack' | 'skill' | 'resource' | 'draw' | 'repair' | 'payoff' | 'status';
export type CardChainRole = 'starter' | 'bridge' | 'expand' | 'repair' | 'payoff';
export type CardCycleRole = 'opener' | 'connector' | 'route-segment' | 'draw-fixer' | 'wild-fixer' | 'finisher';
export type CardBuildRole = 'basic-chain' | 'reward-chain' | 'draw-fixer' | 'wild-fixer' | 'payoff-finisher' | 'reserve-test';
export type CardAvailability = 'starting' | 'reward' | 'starting-and-reward' | 'reserve-test';
export type CardPlayLifecycle = 'discard' | 'exhaust';
export type CardTurnEndLifecycle = 'discard' | 'retain';
export type RewardBranch = 'repair-resource' | 'payoff' | 'route-bridge';
export type ActivityLevelId = 'd1' | 'd2' | 'd3' | 'd4';
export type ActivityDifficultyBand = 'beginner' | 'intermediate' | 'advanced';
export type BuildPlanIssueId =
  | 'missing-bridge'
  | 'missing-finisher'
  | 'clear-pollution'
  | 'need-resource'
  | 'upgrade-key-card';
export type BuildPlanIssueLabel = '缺桥' | '缺终结' | '清污染' | '补资源' | '强化关键牌';
export type CardRewardRarity = 'starter' | 'common' | 'uncommon' | 'rare' | 'status' | 'test';
export type CardMechanicTag =
  | 'attack'
  | 'skill'
  | 'status'
  | 'pollution'
  | 'exhaust'
  | 'retain'
  | 'draw'
  | 'cost-change'
  | 'shield'
  | 'chain'
  | 'authorization'
  | 'payoff'
  | 'repair'
  | 'resource'
  | 'reorder'
  | 'topdeck'
  | 'reward-rarity'
  | 'front-enemy'
  | 'front-row'
  | 'all-enemies'
  | 'self';
export type EnergyGainCondition = 'chain-repaired';
export type CardKeyword =
  | '开链'
  | '接链'
  | '修补'
  | '终结'
  | '授权'
  | '意图'
  | '护栏'
  | '抽牌'
  | '返MP'
  | '消耗'
  | '保留'
  | '状态'
  | '污染'
  | '过载'
  | '净化'
  | '打断'
  | '护盾'
  | '降费'
  | '费用变化'
  | '整备';

export interface CardCostModifier {
  scope: 'next-card-this-turn' | 'self-while-retained' | 'turn';
  amount: number;
  appliesTo?: CardType | CardType[];
}

export interface CardDefinition {
  id: CardId;
  name: string;
  displayName?: string;
  shortName?: string;
  hudRoleLabel?: string;
  cost: number;
  verb: string;
  damage: number;
  comboNode: 'hook' | 'cut' | 'spark' | 'mark' | 'reclaim' | 'burst';
  description: string;
  targets: 'front-enemy' | 'front-row' | 'all-enemies' | 'self';
  cardType: CardType;
  chainRole: CardChainRole;
  cycleRole: CardCycleRole;
  buildRole: CardBuildRole;
  availability: CardAvailability;
  rulesText: string;
  mobileEffect: string;
  keywords: CardKeyword[];
  detail: string;
  mechanicTags?: CardMechanicTag[];
  rewardRarity?: CardRewardRarity;
  rewardBranches?: RewardBranch[];
  drawCards?: number;
  energyGain?: number;
  energyGainCondition?: EnergyGainCondition;
  utilities?: CardUtility[];
  preDrawTopdeckPayoff?: boolean;
  countsForChain?: boolean;
  shield?: number;
  costModifier?: CardCostModifier;
  lifecycle?: {
    onPlay?: CardPlayLifecycle;
    onTurnEnd?: CardTurnEndLifecycle;
  };
  runUpgrade?: {
    maxLevel: number;
    damagePerLevel: number;
    maxGemSlots: number;
    allowedGemColors: CardGemColor[];
  };
}

export interface CardGemSlot {
  color: CardGemColor;
  gemId: CardGemId | null;
}

export interface CardEnhancement {
  cardId: CardId;
  level: number;
  gemSlots: CardGemSlot[];
}

export interface CardUpgradeChoice {
  id: string;
  type: CardUpgradeChoiceType;
  targetCardId: CardId;
  label: string;
  description: string;
  gemColor?: CardGemColor;
  gemId?: CardGemId;
  damageBonusPreview: number;
}

export interface CardUpgradeHistoryEntry {
  tick: number;
  traceId: TraceId;
  cardId: CardId;
  choiceId: string;
  choiceType: CardUpgradeChoiceType;
  level: number;
  gemSlots: CardGemSlot[];
}

export interface CardUpgradeState {
  enhancements: Partial<Record<CardId, CardEnhancement>>;
  choices: CardUpgradeChoice[];
  pending: boolean;
  history: CardUpgradeHistoryEntry[];
}

export interface BuildPlanIssue {
  id: BuildPlanIssueId;
  label: BuildPlanIssueLabel;
  reason: string;
  nextStep: string;
  priority: number;
  evidence: string[];
  recommendedCardIds: CardId[];
  recommendedUpgradeChoiceIds: string[];
}

export interface BuildPlan {
  summary: string;
  issues: BuildPlanIssue[];
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

export interface ActivityLevelDefinition {
  id: ActivityLevelId;
  label: 'D1' | 'D2' | 'D3' | 'D4';
  title: string;
  difficultyTier: number;
  band: ActivityDifficultyBand;
  nodeCount: number;
  playerMaxHp: number;
  enemyHpMultiplier: number;
  enemyDamageMultiplier: number;
  rewardPickCount: number;
  eliteRouteEntryDamage: number;
  eliteRouteAddsPollution: boolean;
}

export interface ActivityCarryoverState {
  deck: CardId[];
  rewardCandidateCardPool: CardId[];
  maxHp: number;
  nextRunStartHp: number;
  maxEnergy: number;
  xp: number;
  level: number;
  xpThreshold: number;
  cardUpgrades: CardUpgradeState;
  activityRewardHistory: RunRewardHistoryEntry[];
}

export interface ActivityState {
  id: 'redline-core-activity-01';
  title: string;
  totalDifficultyTiers: 10;
  playableLevelIds: ActivityLevelId[];
  currentLevelId: ActivityLevelId;
  completedLevelIds: ActivityLevelId[];
  carryover: ActivityCarryoverState;
}

export interface ActivitySettlementPreview {
  currentLevelId: ActivityLevelId;
  currentLevelLabel: string;
  currentLevelTitle: string;
  completed: boolean;
  nextLevelId: ActivityLevelId | null;
  nextLevelLabel: string | null;
  canContinue: boolean;
}

export interface PlayerState {
  id: EntityId;
  // Encounter life totals. Future profile/run bonuses must derive these before combat starts.
  hp: number;
  maxHp: number;
  // Deal-cycle resources. These reset on deal/turn boundaries and are not meta progression.
  energy: number;
  maxEnergy: number;
  tempAuthorizationMP: number;
  authorizationRestriction: 'payoff-only' | null;
  lastAuthorizationReason: string | null;
  lastAuthorizationSourceCardId: CardId | null;
  payoffArmed: boolean;
  combo: number;
  lastPlayedCost: number | null;
  costChainMultiplier: number;
  // Current-run progression. These are not account/profile level fields.
  xp: number;
  level: number;
  // Current-run deck plus current deal-cycle zones. Restarting the run must rebuild them from the run start rules.
  deck: CardId[];
  hand: CardId[];
  drawPile: CardId[];
  discardPile: CardId[];
  exhaustPile: CardId[];
  retainedCards: CardId[];
}

export interface ChainState {
  playedCosts: number[];
  lastCost: number | null;
  nextExpectedCost: number;
  multiplier: number;
  broken: boolean;
  breakReason: string | null;
  repairedThisTurn: boolean;
  extendedThisTurn: boolean;
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

export interface RunRewardHistoryEntry {
  runNumber: number;
  node: number;
  selectedCardId: CardId;
  choices: CardId[];
  source: RewardState['source'];
  tick: number;
  traceId: TraceId;
  round: number;
  level: number;
}

export type RunRouteRiskLevel = 'none' | 'low' | 'high';

export type RuntimeRouteKind = 'repair-cache' | 'elite-pressure';

export interface RunNodePressureRecord {
  node: number;
  tick: number;
  traceId: TraceId;
  incomingRouteId: string | null;
  incomingRouteKind: RuntimeRouteKind | null;
  incomingRouteRisk: RunRouteRiskLevel;
  selectedRouteId: string | null;
  selectedRouteKind: RuntimeRouteKind | null;
  selectedRouteRisk: RunRouteRiskLevel | null;
  damageTaken: number;
  pollutionAdded: number;
  pollutionCardsActive: number;
  hpAfter: number;
  maxEnergyAfter: number;
  buildPlanSummary: string;
  buildPlanIssueIds: BuildPlanIssueId[];
  failureBoundary: boolean;
}

export interface PendingRoutePressure {
  routeId: string;
  routeKind: RuntimeRouteKind;
  riskLevel: RunRouteRiskLevel;
  targetNode: number;
  damageOnEntry: number;
  pollutionCardId: CardId | null;
}

export interface RunPressureState {
  records: RunNodePressureRecord[];
  lastRecordedEventIndex: number;
  totalDamageTaken: number;
  totalPollutionAdded: number;
  activePollutionCards: number;
  failureBoundaryNode: number | null;
  pendingRoutePressure: PendingRoutePressure | null;
}

export interface RunState {
  runNumber: number;
  currentNode: number;
  maxNodes: number;
  // Current-run reward history only. Do not read this as account/meta unlock history.
  rewardHistory: RunRewardHistoryEntry[];
  status: RunStatus;
  // Current-run runtime pressure only. Restarting a run creates a fresh RunState and drops this history.
  pressure?: RunPressureState;
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
  // Encounter clock/state.
  tick: number;
  round: number;
  elapsedSeconds: number;
  player: PlayerState;
  // Deal-cycle chain state. It expires before leaving the player turn/deal cycle.
  chain: ChainState;
  // Encounter entities and intent snapshot.
  enemies: Record<EntityId, EnemyState>;
  enemyIntents: Record<EntityId, EnemyIntent>;
  enemyIntentSummary: EnemyIntentSummary;
  fsm: FsmState;
  // Current adventure/run state. Account/meta progression is intentionally absent from P0.
  run: RunState;
  // Prototype-session activity progress only. This is not account/meta progression.
  activity?: ActivityState;
  activitySettlementPreview?: ActivitySettlementPreview | null;
  route?: ShortRunRouteState;
  reward: RewardState;
  cardUpgrades: CardUpgradeState;
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
      type: 'select-route';
      routeId: string;
      traceId: TraceId;
    }
  | {
      type: 'restart-run';
      traceId: TraceId;
    }
  | {
      type: 'restart-current-level';
      traceId: TraceId;
    }
  | {
      type: 'continue-activity';
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
      type: 'CardMoved';
      traceId: TraceId;
      tick: number;
      cardId: CardId;
      from: CardZone;
      to: CardZone;
      fromZone: CardZone;
      toZone: CardZone;
      reason: string;
    }
  | {
      type: 'PressurePollutionAdded';
      traceId: TraceId;
      tick: number;
      cardId: CardId;
      toZone: CardZone;
      damageTaken: number;
      reason: string;
    }
  | {
      type: 'CardDrawn';
      traceId: TraceId;
      tick: number;
      cardId: CardId;
      drawIndex: number;
      remainingDrawPileCount: number;
    }
  | {
      type: 'CardExhausted';
      traceId: TraceId;
      tick: number;
      cardId: CardId;
      reason: string;
      exhaustPileSize: number;
    }
  | {
      type: 'CardRetained';
      traceId: TraceId;
      tick: number;
      cardId: CardId;
      reason: string;
      retainedCardsCount: number;
    }
  | {
      type: 'DiscardPileShuffledIntoDrawPile';
      traceId: TraceId;
      tick: number;
      cardIds: CardId[];
      keptCardIds: CardId[];
      drawPileCount: number;
      discardPileCount: number;
    }
  | {
      type: 'DiscardShuffledIntoDraw';
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
      effectiveCost: number;
      printedCost: number;
      currentEnergyPaid: number;
      authorizationPaid: number;
      payoffArmed: boolean;
      chainRepaired: boolean;
      repairedCost?: number;
      chainExtended: boolean;
      extendedCost?: number;
    }
  | {
      type: 'AuthorizationGranted';
      traceId: TraceId;
      tick: number;
      cardId: CardId;
      tempAuthorizationMP: number;
      authorizationRestriction: 'payoff-only';
      reason: string;
      payoffArmed: boolean;
    }
  | {
      type: 'CardPaymentRecorded';
      traceId: TraceId;
      tick: number;
      cardId: CardId;
      printedCost: number;
      currentEnergyPaid: number;
      authorizationPaid: number;
      source: 'current-energy' | 'authorization' | 'mixed';
      payoffArmed: boolean;
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
      type: 'ChainExtended';
      traceId: TraceId;
      tick: number;
      cardId: CardId;
      extendedCost: number;
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
      type: 'PayoffResolved';
      traceId: TraceId;
      tick: number;
      cardId: CardId;
      payoffArmed: boolean;
      affectedEnemyIds: EntityId[];
      killCount: number;
      preventedIntentDamage: number;
      intentDamageBefore: number;
      intentDamageAfter: number;
    }
  | {
      type: 'PayoffTopdecked';
      traceId: TraceId;
      tick: number;
      sourceCardId: CardId;
      cardId: CardId;
      fromIndex: number;
      toIndex: 0;
      searchedCount: number;
    }
  | {
      type: 'PayoffTopdeckMissed';
      traceId: TraceId;
      tick: number;
      sourceCardId: CardId;
      searchedCount: number;
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
      type: 'RouteChoicesGenerated';
      traceId: TraceId;
      tick: number;
      routeIds: string[];
    }
  | {
      type: 'RouteChosen';
      traceId: TraceId;
      tick: number;
      routeId: string;
      fromNode: number;
      toNode: number;
    }
  | {
      type: 'RoutePressureApplied';
      traceId: TraceId;
      tick: number;
      routeId: string;
      routeKind: RuntimeRouteKind;
      riskLevel: RunRouteRiskLevel;
      targetNode: number;
      amount: number;
      remainingHp: number;
      pollutionCardId: CardId | null;
    }
  | {
      type: 'CardAddedToDeck';
      traceId: TraceId;
      tick: number;
      cardId: CardId;
      deckSize: number;
    }
  | {
      type: 'CardUpgradeChoicesGenerated';
      traceId: TraceId;
      tick: number;
      targetCardId: CardId;
      choices: CardUpgradeChoice[];
    }
  | {
      type: 'CardUpgradeApplied';
      traceId: TraceId;
      tick: number;
      cardId: CardId;
      choiceId: string;
      choiceType: CardUpgradeChoiceType;
      level: number;
      gemSlots: CardGemSlot[];
      damageBonus: number;
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
      authorizationAmount?: number;
      payoffArmed?: boolean;
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
      type: 'AddPressurePollution';
      traceId: TraceId;
      cardId: CardId;
      damageTaken: number;
      reason: string;
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
      type: 'TopdeckPayoffFromDrawPile';
      traceId: TraceId;
      sourceCardId: CardId;
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
    }
  | {
      type: 'ResolvePayoff';
      traceId: TraceId;
      cardId: CardId;
      payoffArmed: boolean;
      affectedEnemyIds: EntityId[];
      intentDamageBefore: number;
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
  run: RunState;
  route?: ShortRunRouteState;
  activity?: ActivityState;
  activitySettlementPreview?: ActivitySettlementPreview | null;
  buildPlan: BuildPlan;
  reward: RewardState;
  cardUpgrades: CardUpgradeState;
  debug: DebugState;
  lastBurstTick: number | null;
}
