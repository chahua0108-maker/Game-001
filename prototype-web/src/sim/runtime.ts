import { cards } from '../data/cards';
import { setCharacterState, setGameFlowState } from '../fsm/stateMachine';
import { evaluateRules } from '../eca/ruleSet';
import { redlineRules } from '../eca/redlineRules';
import {
  continueActivityAfterVictory,
  createActivitySettlementPreview,
  currentActivityLevel
} from './activity';
import {
  applyCardUpgradeChoice,
  buildCardUpgradeRewardChoiceIds,
  clearCardUpgradeChoices,
  decodeCardUpgradeRewardChoiceId,
  isCardUpgradeRewardChoiceId
} from './cardUpgrades';
import { createBuildPlan } from './buildPlan';
import { buildRewardChoices } from './rewardChoices';
import { nextLevelXp, type RewardBuildPlanPreference, type RewardResponseProblem } from './rewardProgression';
import {
  completeCombatRouteNode,
  createInitialShortRunRouteState,
  selectShortRunRouteNode
} from './runRoute';
import { ENEMY_COLUMNS, ENEMY_ROWS, createEnemy, createInitialChainState, createInitialWorld, slotToLane, slotToZ } from './world';
import type { ShortRunNodeCandidate } from './runRoute';
import type { ShortRunRoutePressureProfile } from './runRoute';
import type {
  BuildPlanIssueId,
  CardDefinition,
  CardId,
  CardZone,
  Command,
  EntityId,
  GameEvent,
  Intent,
  PendingRoutePressure,
  RewardBranch,
  RunPressureState,
  RunRouteRiskLevel,
  RuntimeRouteKind,
  TraceEntry,
  TraceId,
  WorldState
} from './types';

const DEBUG_LIMIT = 2000;
const HAND_SIZE = 4;
const ENEMY_PRESSURE_Z = -3.2;
const PRESSURE_POLLUTION_CARD_ID: CardId = 'static_overload';
const ELITE_ROUTE_ENTRY_DAMAGE = 6;

function pushTrace(world: WorldState, entry: TraceEntry): void {
  world.debug.trace.push(entry);
  world.debug.trace = world.debug.trace.slice(-DEBUG_LIMIT);
}

function pushEvent(world: WorldState, event: GameEvent): void {
  world.debug.events.push(event);
  world.debug.events = world.debug.events.slice(-DEBUG_LIMIT);
  pushTrace(world, {
    tick: world.tick,
    traceId: event.traceId,
    kind: 'event',
    label: event.type
  });
}

function pushCommand(world: WorldState, command: Command): void {
  world.debug.commands.push(command);
  world.debug.commands = world.debug.commands.slice(-DEBUG_LIMIT);
  pushTrace(world, {
    tick: world.tick,
    traceId: command.traceId,
    kind: 'command',
    label: command.type
  });
}

function createEventFromIntent(world: WorldState, intent: Intent): GameEvent[] {
  const base: GameEvent = {
    type: 'IntentReceived',
    tick: world.tick,
    traceId: intent.traceId,
    intentType: intent.type
  };

  if (intent.type === 'advance-time') {
    return [
      base,
      {
        type: 'TimeAdvanced',
        tick: world.tick,
        traceId: intent.traceId,
        deltaSeconds: intent.deltaSeconds
      }
    ];
  }

  if (intent.type === 'play-card') {
    return [base];
  }

  return [base];
}

function defaultFrontRowEnemyId(world: WorldState): EntityId | undefined {
  return frontRowAliveEnemies(world)
    .sort((left, right) => {
      const intentDelta = (world.enemyIntents[right.id]?.amount ?? 0) - (world.enemyIntents[left.id]?.amount ?? 0);
      if (intentDelta !== 0) {
        return intentDelta;
      }

      const hpDelta = left.hp - right.hp;
      return hpDelta !== 0 ? hpDelta : left.slot - right.slot;
    })[0]?.id;
}

function activeAliveEnemies(world: WorldState) {
  return Object.values(world.enemies)
    .filter((enemy) => enemy.alive && enemy.slot >= 0 && enemy.slot < world.maxEnemySlots)
    .sort((a, b) => a.slot - b.slot);
}

function frontRowAliveEnemies(world: WorldState) {
  return activeAliveEnemies(world).filter((enemy) => enemy.slot < ENEMY_COLUMNS);
}

function snapshotRoundAttackEnemies(world: WorldState): void {
  world.roundAttackEnemyIds = frontRowAliveEnemies(world).map((enemy) => enemy.id);
}

function roundAttackEligibleEnemies(world: WorldState) {
  return world.roundAttackEnemyIds
    .map((enemyId) => world.enemies[enemyId])
    .filter((enemy): enemy is NonNullable<typeof enemy> => Boolean(enemy?.alive && enemy.slot >= 0 && enemy.slot < ENEMY_COLUMNS));
}

function refreshEnemyIntents(world: WorldState, traceId?: TraceId, emitEvents = false): GameEvent[] {
  const nextIntents = Object.fromEntries(
    roundAttackEligibleEnemies(world).map((enemy) => [
      enemy.id,
      {
        enemyId: enemy.id,
        kind: 'attack' as const,
        amount: enemy.damage,
        slot: enemy.slot,
        description: `End turn: deal ${enemy.damage} HP damage`,
        willRefill: true
      }
    ])
  );

  world.enemyIntents = nextIntents;
  world.enemyIntentSummary = {
    totalDamage: Object.values(nextIntents).reduce((total, intent) => total + intent.amount, 0),
    intentEnemyIds: Object.keys(nextIntents)
  };

  if (!emitEvents || !traceId) {
    return [];
  }

  return Object.values(nextIntents).map((intent) => ({
    type: 'EnemyIntentDeclared',
    tick: world.tick,
    traceId,
    intent
  }));
}

function enemyColumn(enemy: { slot: number }): number {
  return enemy.slot % ENEMY_COLUMNS;
}

function columnSlot(column: number, row: number): number {
  return row * ENEMY_COLUMNS + column;
}

function setEnemySlot(enemy: ReturnType<typeof activeAliveEnemies>[number], slot: number): void {
  enemy.slot = slot;
  enemy.lane = slotToLane(slot);
  enemy.z = slotToZ(slot);
}

function splitDiscardForReshuffle(discardPile: CardId[], excludeFromReshuffle: CardId[]): { reshuffle: CardId[]; kept: CardId[] } {
  const reshuffle = [...discardPile];
  const kept: CardId[] = [];

  for (const cardId of excludeFromReshuffle) {
    const index = reshuffle.lastIndexOf(cardId);
    if (index >= 0) {
      kept.unshift(...reshuffle.splice(index, 1));
    }
  }

  return { reshuffle, kept };
}

function createCardMovedEvent(
  world: WorldState,
  traceId: TraceId,
  cardId: CardId,
  from: CardZone,
  to: CardZone,
  reason: string
): GameEvent {
  return {
    type: 'CardMoved',
    tick: world.tick,
    traceId,
    cardId,
    from,
    to,
    fromZone: from,
    toZone: to,
    reason
  };
}

function createCardDrawnEvent(world: WorldState, traceId: TraceId, cardId: CardId, drawIndex: number): GameEvent {
  return {
    type: 'CardDrawn',
    tick: world.tick,
    traceId,
    cardId,
    drawIndex,
    remainingDrawPileCount: world.player.drawPile.length
  };
}

function moveHandCardToZone(
  world: WorldState,
  traceId: TraceId,
  cardId: CardId,
  to: 'discardPile' | 'exhaustPile' | 'retainedCards',
  reason: string
): GameEvent[] {
  const index = world.player.hand.indexOf(cardId);
  if (index < 0) {
    return [];
  }

  world.player.hand.splice(index, 1);
  world.player[to].push(cardId);

  const events: GameEvent[] = [createCardMovedEvent(world, traceId, cardId, 'hand', to, reason)];

  if (to === 'exhaustPile') {
    events.push({
      type: 'CardExhausted',
      tick: world.tick,
      traceId,
      cardId,
      reason,
      exhaustPileSize: world.player.exhaustPile.length
    });
  }

  if (to === 'retainedCards') {
    events.push({
      type: 'CardRetained',
      tick: world.tick,
      traceId,
      cardId,
      reason,
      retainedCardsCount: world.player.retainedCards.length
    });
  }

  return events;
}

function playedCardDestination(cardId: CardId): 'discardPile' | 'exhaustPile' {
  const card = cards[cardId];
  return card?.lifecycle?.onPlay === 'exhaust' || card?.keywords?.includes('消耗') ? 'exhaustPile' : 'discardPile';
}

function endTurnCardDestination(cardId: CardId): 'discardPile' | 'retainedCards' {
  const card = cards[cardId];
  return card?.lifecycle?.onTurnEnd === 'retain' || card?.keywords?.includes('保留') ? 'retainedCards' : 'discardPile';
}

function discardHand(world: WorldState, traceId: TraceId, reason: string): GameEvent[] {
  const handCards = [...world.player.hand];
  const events: GameEvent[] = [];

  for (const cardId of handCards) {
    const destination = reason === 'turn ended' ? endTurnCardDestination(cardId) : 'discardPile';
    events.push(...moveHandCardToZone(world, traceId, cardId, destination, reason));
  }

  return events;
}

function releaseRetainedCardsForDeal(world: WorldState, traceId: TraceId): { cardIds: CardId[]; events: GameEvent[] } {
  const cardIds = [...world.player.retainedCards];
  world.player.retainedCards = [];

  return {
    cardIds,
    events: cardIds.map((cardId) => createCardMovedEvent(world, traceId, cardId, 'retainedCards', 'hand', 'deal hand'))
  };
}

function drawCardsFromDeck(
  world: WorldState,
  count: number,
  traceId: TraceId,
  excludeFromReshuffle: CardId[] = []
): { drawn: CardId[]; events: GameEvent[] } {
  const drawn: CardId[] = [];
  const events: GameEvent[] = [];

  while (drawn.length < count) {
    if (world.player.drawPile.length === 0) {
      if (world.player.discardPile.length === 0) {
        break;
      }
      const nextPiles = splitDiscardForReshuffle(world.player.discardPile, excludeFromReshuffle);
      if (nextPiles.reshuffle.length === 0) {
        world.player.discardPile = nextPiles.kept;
        break;
      }
      world.player.drawPile = nextPiles.reshuffle;
      world.player.discardPile = nextPiles.kept;
      events.push({
        type: 'DiscardPileShuffledIntoDrawPile',
        tick: world.tick,
        traceId,
        cardIds: [...nextPiles.reshuffle],
        keptCardIds: [...nextPiles.kept],
        drawPileCount: world.player.drawPile.length,
        discardPileCount: world.player.discardPile.length
      });
      events.push({
        type: 'DiscardShuffledIntoDraw',
        tick: world.tick,
        traceId,
        cardIds: [...nextPiles.reshuffle]
      });
    }

    const cardId = world.player.drawPile.shift();
    if (cardId) {
      drawn.push(cardId);
      events.push(createCardMovedEvent(world, traceId, cardId, 'drawPile', 'hand', 'draw'));
      events.push(createCardDrawnEvent(world, traceId, cardId, drawn.length - 1));
    }
  }

  return { drawn, events };
}

function topdeckPayoffFromDrawPile(
  world: WorldState,
  sourceCardId: CardId
): { cardId: CardId; fromIndex: number; searchedCount: number } | null {
  for (let index = 0; index < world.player.drawPile.length; index += 1) {
    const cardId = world.player.drawPile[index];
    const card = cards[cardId];
    if (cardId === sourceCardId || !card || !isPayoffFinisher(card)) {
      continue;
    }

    const [topdecked] = world.player.drawPile.splice(index, 1);
    world.player.drawPile.unshift(topdecked);
    return { cardId: topdecked, fromIndex: index, searchedCount: index + 1 };
  }

  return null;
}

function resetCostChain(world: WorldState): void {
  world.player.lastPlayedCost = null;
  world.player.costChainMultiplier = 1;
  world.player.tempAuthorizationMP = 0;
  world.player.authorizationRestriction = null;
  world.player.lastAuthorizationReason = null;
  world.player.lastAuthorizationSourceCardId = null;
  world.player.payoffArmed = false;
  world.chain = createInitialChainState();
}

function mirrorChainToPlayer(world: WorldState): void {
  world.player.lastPlayedCost = world.chain.lastCost;
  world.player.costChainMultiplier = world.chain.multiplier;
}

function advanceCostChain(
  world: WorldState,
  card: CardDefinition,
  traceId: TraceId
): {
  multiplier: number;
  effectiveCost: number;
  chainRepaired: boolean;
  repairedCost?: number;
  chainExtended: boolean;
  extendedCost?: number;
  events: GameEvent[];
} {
  if (card.cardType === 'status' || card.countsForChain === false) {
    return {
      multiplier: 1,
      effectiveCost: card.cost,
      chainRepaired: false,
      chainExtended: false,
      events: []
    };
  }

  const isWild = card.utilities?.includes('wild') ?? false;
  const expectedCost = world.chain.nextExpectedCost;
  const canRepairWithWild =
    isWild &&
    world.chain.playedCosts.length > 0 &&
    !world.chain.broken &&
    expectedCost > 0 &&
    expectedCost < 3;
  const canExtendWithWildGap =
    card.id === 'wild_gap_key' && world.chain.playedCosts.length > 0 && !world.chain.broken && expectedCost === 3;
  const playedCost = canRepairWithWild || canExtendWithWildGap ? expectedCost : card.cost;
  const continuesAfterWildExtension =
    isPayoffFinisher(card) &&
    world.chain.extendedThisTurn === true &&
    world.chain.lastCost === card.cost &&
    world.chain.nextExpectedCost === card.cost + 1;
  const continues =
    world.chain.playedCosts.length === 0 ? playedCost === 0 : playedCost === expectedCost || continuesAfterWildExtension;
  const events: GameEvent[] = [];

  if (!continues) {
    const breakReason = `expected MP ${expectedCost}, played MP ${card.cost}`;
    world.chain.playedCosts.push(card.cost);
    world.chain.lastCost = card.cost;
    world.chain.nextExpectedCost = card.cost + 1;
    world.chain.multiplier = 1;
    world.chain.broken = true;
    world.chain.breakReason = breakReason;
    world.chain.extendedThisTurn = false;
    mirrorChainToPlayer(world);
    events.push({
      type: 'ChainBroken',
      tick: world.tick,
      traceId,
      cardId: card.id,
      expectedCost,
      playedCost: card.cost,
      breakReason
    });
    return { multiplier: 1, effectiveCost: card.cost, chainRepaired: false, chainExtended: false, events };
  }

  if (continuesAfterWildExtension) {
    world.chain.extendedThisTurn = false;
  }

  const multiplier = world.chain.playedCosts.length === 0 ? 1 : world.chain.multiplier + 1;
  world.chain.playedCosts.push(playedCost);
  world.chain.lastCost = playedCost;
  world.chain.nextExpectedCost = playedCost + 1;
  world.chain.multiplier = multiplier;
  mirrorChainToPlayer(world);

  events.push({
    type: 'ChainAdvanced',
    tick: world.tick,
    traceId,
    cardId: card.id,
    playedCost,
    nextExpectedCost: world.chain.nextExpectedCost,
    multiplier
  });

  const chainRepaired = canRepairWithWild;
  const repairedCost = chainRepaired ? playedCost : undefined;
  const chainExtended = canExtendWithWildGap;
  const extendedCost = chainExtended ? playedCost : undefined;

  if (chainRepaired) {
    world.chain.repairedThisTurn = true;
    events.push({
      type: 'ChainRepaired',
      tick: world.tick,
      traceId,
      cardId: card.id,
      repairedCost: playedCost,
      nextExpectedCost: world.chain.nextExpectedCost,
      multiplier
    });
  }

  if (chainExtended) {
    world.chain.extendedThisTurn = true;
    events.push({
      type: 'ChainExtended',
      tick: world.tick,
      traceId,
      cardId: card.id,
      extendedCost: playedCost,
      nextExpectedCost: world.chain.nextExpectedCost,
      multiplier
    });
  }

  if (isAuthorizationChain(world.chain)) {
    const reason = chainRepaired ? 'wild repaired chain to 0 -> 1 -> 2' : 'completed 0 -> 1 -> 2';
    world.player.tempAuthorizationMP += 3;
    world.player.authorizationRestriction = 'payoff-only';
    world.player.lastAuthorizationReason = reason;
    world.player.lastAuthorizationSourceCardId = card.id;
    world.player.payoffArmed = world.player.tempAuthorizationMP > 0;
    events.push({
      type: 'AuthorizationGranted',
      tick: world.tick,
      traceId,
      cardId: card.id,
      tempAuthorizationMP: world.player.tempAuthorizationMP,
      authorizationRestriction: 'payoff-only',
      reason,
      payoffArmed: world.player.payoffArmed
    });
  }

  return { multiplier, effectiveCost: playedCost, chainRepaired, repairedCost, chainExtended, extendedCost, events };
}

function canUseAuthorizationForCard(world: WorldState, card: CardDefinition): boolean {
  return (
    world.player.tempAuthorizationMP > 0 &&
    world.player.authorizationRestriction === 'payoff-only' &&
    isPayoffFinisher(card)
  );
}

function paymentSource(currentEnergyPaid: number, authorizationPaid: number): 'current-energy' | 'authorization' | 'mixed' {
  if (authorizationPaid === 0) {
    return 'current-energy';
  }
  return currentEnergyPaid === 0 ? 'authorization' : 'mixed';
}

function isAuthorizationChain(chain: WorldState['chain']): boolean {
  return (
    !chain.broken &&
    chain.playedCosts.length === 3 &&
    chain.playedCosts[0] === 0 &&
    chain.playedCosts[1] === 1 &&
    chain.playedCosts[2] === 2
  );
}

function isPayoffFinisher(card: CardDefinition): boolean {
  return card.cost === 3 && card.targets === 'all-enemies' && card.comboNode === 'burst';
}

function hasActivePressurePollution(world: WorldState, cardId: CardId): boolean {
  return (
    world.player.hand.includes(cardId) ||
    world.player.drawPile.includes(cardId) ||
    world.player.discardPile.includes(cardId) ||
    world.player.retainedCards.includes(cardId)
  );
}

function hasCardPlayedSinceLastDeal(world: WorldState): boolean {
  for (let index = world.debug.events.length - 1; index >= 0; index -= 1) {
    const event = world.debug.events[index];
    if (event.type === 'HandDealt') {
      return false;
    }
    if (event.type === 'CardPlayed') {
      return true;
    }
  }

  return false;
}

function shouldAddPressurePollution(world: WorldState, damageTaken: number): boolean {
  return (
    damageTaken > 0 &&
    !hasCardPlayedSinceLastDeal(world) &&
    world.player.drawPile.length === 0 &&
    world.player.discardPile.length >= HAND_SIZE - 1
  );
}

function ensureRunPressureState(world: WorldState): RunPressureState {
  if (!world.run.pressure) {
    world.run.pressure = {
      records: [],
      lastRecordedEventIndex: 0,
      totalDamageTaken: 0,
      totalPollutionAdded: 0,
      activePollutionCards: 0,
      failureBoundaryNode: null,
      pendingRoutePressure: null
    };
  }

  return world.run.pressure;
}

function runtimeRouteKind(kind: ShortRunNodeCandidate['kind']): RuntimeRouteKind | null {
  return kind === 'repair-cache' || kind === 'elite-pressure' ? kind : null;
}

function riskLevelForRouteKind(kind: RuntimeRouteKind): RunRouteRiskLevel {
  return kind === 'elite-pressure' ? 'high' : 'low';
}

function createPendingRoutePressure(candidate: ShortRunNodeCandidate): PendingRoutePressure | null {
  const routeKind = runtimeRouteKind(candidate.kind);
  if (!routeKind) {
    return null;
  }

  const activityRoutePressure = candidate.routePressure;
  const damageOnEntry =
    routeKind === 'elite-pressure'
      ? activityRoutePressure?.entryDamage ?? ELITE_ROUTE_ENTRY_DAMAGE
      : activityRoutePressure?.entryDamage ?? 0;
  const pollutionCardId =
    routeKind === 'elite-pressure'
      ? activityRoutePressure?.addsPollution === false
        ? null
        : PRESSURE_POLLUTION_CARD_ID
      : null;

  return {
    routeId: candidate.id,
    routeKind,
    riskLevel: riskLevelForRouteKind(routeKind),
    targetNode: candidate.toNode,
    damageOnEntry,
    pollutionCardId
  };
}

function playerCardZones(world: WorldState): CardId[] {
  return [
    ...world.player.deck,
    ...world.player.hand,
    ...world.player.drawPile,
    ...world.player.discardPile,
    ...world.player.exhaustPile,
    ...world.player.retainedCards
  ];
}

function activePressurePollutionCount(world: WorldState): number {
  return playerCardZones(world).filter((cardId) => {
    const card = cards[cardId];
    return Boolean(card && card.cardType === 'status' && card.mechanicTags?.includes('pollution'));
  }).length;
}

function pressureTotalsFromRecords(records: RunPressureState['records']): Pick<RunPressureState, 'totalDamageTaken' | 'totalPollutionAdded'> {
  return {
    totalDamageTaken: records.reduce((total, record) => total + record.damageTaken, 0),
    totalPollutionAdded: records.reduce((total, record) => total + record.pollutionAdded, 0)
  };
}

function recordNodePressure(world: WorldState, traceId: TraceId): void {
  const pressure = ensureRunPressureState(world);
  const eventsSinceLastRecord = world.debug.events.slice(pressure.lastRecordedEventIndex);
  const incomingRoute =
    pressure.pendingRoutePressure?.targetNode === world.run.currentNode ? pressure.pendingRoutePressure : null;
  const buildPlan = createBuildPlan(world);
  const damageTaken = eventsSinceLastRecord.reduce((total, event) => {
    if (event.type === 'EnemyAttacked') {
      return total + event.amount;
    }
    if (event.type === 'RoutePressureApplied') {
      return total + event.amount;
    }
    return total;
  }, 0);
  const pollutionAdded = eventsSinceLastRecord.filter((event) => event.type === 'PressurePollutionAdded').length;
  const failureBoundary = world.run.status === 'failure' || world.player.hp <= 0;

  pressure.records.push({
    node: world.run.currentNode,
    tick: world.tick,
    traceId,
    incomingRouteId: incomingRoute?.routeId ?? null,
    incomingRouteKind: incomingRoute?.routeKind ?? null,
    incomingRouteRisk: incomingRoute?.riskLevel ?? 'none',
    selectedRouteId: null,
    selectedRouteKind: null,
    selectedRouteRisk: null,
    damageTaken,
    pollutionAdded,
    pollutionCardsActive: activePressurePollutionCount(world),
    hpAfter: world.player.hp,
    maxEnergyAfter: world.player.maxEnergy,
    buildPlanSummary: buildPlan.summary,
    buildPlanIssueIds: buildPlan.issues.map((issue) => issue.id),
    failureBoundary
  });

  pressure.lastRecordedEventIndex = world.debug.events.length;
  const totals = pressureTotalsFromRecords(pressure.records);
  pressure.totalDamageTaken = totals.totalDamageTaken;
  pressure.totalPollutionAdded = totals.totalPollutionAdded;
  pressure.activePollutionCards = activePressurePollutionCount(world);
  if (failureBoundary && pressure.failureBoundaryNode === null) {
    pressure.failureBoundaryNode = world.run.currentNode;
  }
}

function annotateLastNodePressureRoute(world: WorldState, selectedRoute: ShortRunNodeCandidate): void {
  const pressure = ensureRunPressureState(world);
  const routeKind = runtimeRouteKind(selectedRoute.kind);
  if (!routeKind) {
    return;
  }

  for (let index = pressure.records.length - 1; index >= 0; index -= 1) {
    const record = pressure.records[index];
    if (record.node === selectedRoute.fromNode) {
      pressure.records[index] = {
        ...record,
        selectedRouteId: selectedRoute.id,
        selectedRouteKind: routeKind,
        selectedRouteRisk: riskLevelForRouteKind(routeKind)
      };
      return;
    }
  }
}

function applyRoutePressureOnEntry(
  world: WorldState,
  selectedRoute: ShortRunNodeCandidate,
  traceId: TraceId
): { events: GameEvent[]; failed: boolean } {
  const pressure = ensureRunPressureState(world);
  const pendingPressure = createPendingRoutePressure(selectedRoute);
  pressure.pendingRoutePressure = pendingPressure;

  if (!pendingPressure || pendingPressure.damageOnEntry <= 0) {
    pressure.activePollutionCards = activePressurePollutionCount(world);
    return { events: [], failed: false };
  }

  world.player.hp = Math.max(0, world.player.hp - pendingPressure.damageOnEntry);
  const events: GameEvent[] = [
    {
      type: 'RoutePressureApplied',
      tick: world.tick,
      traceId,
      routeId: pendingPressure.routeId,
      routeKind: pendingPressure.routeKind,
      riskLevel: pendingPressure.riskLevel,
      targetNode: pendingPressure.targetNode,
      amount: pendingPressure.damageOnEntry,
      remainingHp: world.player.hp,
      pollutionCardId: pendingPressure.pollutionCardId
    }
  ];

  if (world.player.hp <= 0) {
    markRunFailed(world);
    pressure.failureBoundaryNode = pendingPressure.targetNode;
    events.push(
      ...setGameFlowState(world, 'Settlement', 'route pressure exceeded player HP', traceId).flatMap((command) =>
        applyCommand(world, command)
      )
    );
    return { events, failed: true };
  }

  if (pendingPressure.pollutionCardId) {
    events.push(
      ...applyCommand(world, {
        type: 'AddPressurePollution',
        traceId,
        cardId: pendingPressure.pollutionCardId,
        damageTaken: pendingPressure.damageOnEntry,
        reason: 'elite route pressure contaminated next node'
      })
    );
  }

  pressure.activePollutionCards = activePressurePollutionCount(world);
  return { events, failed: false };
}

const REWARD_PROBLEM_BY_BUILD_PLAN_ISSUE: Partial<Record<BuildPlanIssueId, RewardResponseProblem>> = {
  'clear-pollution': 'polluted',
  'missing-bridge': 'missing-bridge',
  'missing-finisher': 'missing-payoff',
  'need-resource': 'missing-resource'
};

const REWARD_BRANCH_BY_BUILD_PLAN_ISSUE: Partial<Record<BuildPlanIssueId, RewardBranch>> = {
  'clear-pollution': 'repair-resource',
  'missing-bridge': 'route-bridge',
  'missing-finisher': 'payoff',
  'need-resource': 'repair-resource'
};

function rewardBuildPlanPreference(world: WorldState): RewardBuildPlanPreference | null {
  const plan = createBuildPlan(world);
  if (plan.issues.length === 0) {
    return null;
  }

  const problems = new Set<RewardResponseProblem>();
  const rewardBranchHints = new Set<RewardBranch>();
  const preferredCardIds = new Set<CardId>();
  const upgradeTargetCardIds = new Set<CardId>();

  for (const issue of plan.issues) {
    const problem = REWARD_PROBLEM_BY_BUILD_PLAN_ISSUE[issue.id];
    if (problem) {
      problems.add(problem);
    }

    const branch = REWARD_BRANCH_BY_BUILD_PLAN_ISSUE[issue.id];
    if (branch) {
      rewardBranchHints.add(branch);
    }

    issue.recommendedCardIds.forEach((cardId) => preferredCardIds.add(cardId));
    issue.recommendedUpgradeChoiceIds.forEach((choiceId) => {
      const [, targetCardId] = choiceId.split(':');
      if (targetCardId) {
        upgradeTargetCardIds.add(targetCardId);
      }
    });
  }

  return {
    label: plan.summary,
    problems: [...problems],
    rewardBranchHints: [...rewardBranchHints],
    preferredCardIds: [...preferredCardIds],
    upgradeTargetCardIds: [...upgradeTargetCardIds]
  };
}

function generateRewardChoices(world: WorldState, traceId: TraceId): CardId[] {
  const cardRewardPickCount = world.run.currentNode > 1 ? Math.max(0, world.reward.pickCount - 1) : world.reward.pickCount;
  const routeContext = world.route?.nextBattleContext ?? null;
  const buildPlan = rewardBuildPlanPreference(world);
  const responseProfile = routeContext || buildPlan ? { problems: [], routeContext, buildPlan } : undefined;
  const cardChoices = buildRewardChoices(world.reward.candidateCardPool, cardRewardPickCount, cards, responseProfile);
  if (world.run.currentNode <= 1 || cardChoices.length >= world.reward.pickCount) {
    clearCardUpgradeChoices(world);
    return cardChoices;
  }

  const upgradeChoices = buildCardUpgradeRewardChoiceIds(world, traceId, world.reward.pickCount - cardChoices.length);
  return [...cardChoices, ...upgradeChoices].slice(0, world.reward.pickCount);
}

function recordRunReward(world: WorldState, cardId: CardId, traceId: TraceId): void {
  world.run.rewardHistory.push({
    runNumber: world.run.runNumber,
    node: world.run.currentNode,
    selectedCardId: cardId,
    choices: [...world.reward.choices],
    source: world.reward.source,
    tick: world.tick,
    traceId,
    round: world.round,
    level: world.player.level
  });
}

function ensureRouteState(world: WorldState): NonNullable<WorldState['route']> {
  if (!world.route) {
    world.route = createInitialShortRunRouteState();
  }

  return world.route;
}

function planRouteAfterReward(world: WorldState): boolean {
  const planned = completeCombatRouteNode(world.run, ensureRouteState(world), routePressureProfileForWorld(world));
  world.run = planned.run;
  world.route = planned.route;
  return planned.run.status === 'victory';
}

function routePressureProfileForWorld(world: WorldState): ShortRunRoutePressureProfile | undefined {
  if (!world.activity) {
    return undefined;
  }

  const level = currentActivityLevel(world.activity);
  return {
    eliteRouteEntryDamage: level.eliteRouteEntryDamage,
    eliteRouteAddsPollution: level.eliteRouteAddsPollution
  };
}

function applyNextBattleContext(world: WorldState): void {
  const context = ensureRouteState(world).nextBattleContext;
  if (!context) {
    return;
  }

  if (context.modifierId === 'maxEnergyThisRunPlusOne') {
    world.player.maxEnergy = Math.max(world.player.maxEnergy, 4);
  }
}

function markRunFailed(world: WorldState): void {
  if (world.run.status === 'in-progress') {
    world.run.status = 'failure';
  }
}

function refreshActivitySettlementPreview(world: WorldState): void {
  if (!world.activity) {
    world.activitySettlementPreview = null;
    return;
  }

  world.activitySettlementPreview = createActivitySettlementPreview(world.activity, world.run.status);
}

function validatePlayCard(world: WorldState, intent: Extract<Intent, { type: 'play-card' }>): Command[] {
  const card = cards[intent.cardId];
  const commands: Command[] = [];

  if (!card) {
    world.debug.failedConditions.push({
      tick: world.tick,
      traceId: intent.traceId,
      ruleId: 'intent.play-card',
      conditionId: 'card-exists',
      reason: `unknown card ${intent.cardId}`
    });
    return [];
  }

  if (world.fsm.gameFlow !== 'PlayerTurn') {
    world.debug.failedConditions.push({
      tick: world.tick,
      traceId: intent.traceId,
      ruleId: 'intent.play-card',
      conditionId: 'player-turn',
      reason: 'cards can only be played during player turn'
    });
    return [];
  }

  if (!world.player.hand.includes(card.id)) {
    world.debug.failedConditions.push({
      tick: world.tick,
      traceId: intent.traceId,
      ruleId: 'intent.play-card',
      conditionId: 'card-in-hand',
      reason: `${card.id} is not in hand`
    });
    return [];
  }

  const canUseAuthorization = canUseAuthorizationForCard(world, card);
  const availablePayment = world.player.energy + (canUseAuthorization ? world.player.tempAuthorizationMP : 0);
  if (availablePayment < card.cost) {
    world.debug.failedConditions.push({
      tick: world.tick,
      traceId: intent.traceId,
      ruleId: 'intent.play-card',
      conditionId: 'enough-energy',
      reason: `need ${card.cost} energy`
    });
    return [];
  }

  const currentEnergyPaid = Math.min(world.player.energy, card.cost);
  const authorizationPaid = card.cost - currentEnergyPaid;

  if (card.targets === 'front-enemy') {
    const target = intent.targetId ? world.enemies[intent.targetId] : undefined;
    if (!target?.alive) {
      world.debug.failedConditions.push({
        tick: world.tick,
        traceId: intent.traceId,
        ruleId: 'intent.play-card',
        conditionId: 'target-alive',
        reason: 'no alive front target'
      });
      return [];
    }
    if (target.slot < 0 || target.slot >= ENEMY_COLUMNS) {
      world.debug.failedConditions.push({
        tick: world.tick,
        traceId: intent.traceId,
        ruleId: 'intent.play-card',
        conditionId: 'front-target',
        reason: 'front-enemy cards can only target first-row enemies'
      });
      return [];
    }
  }

  if (card.targets === 'front-row' && frontRowAliveEnemies(world).length === 0) {
    world.debug.failedConditions.push({
      tick: world.tick,
      traceId: intent.traceId,
      ruleId: 'intent.play-card',
      conditionId: 'target-alive',
      reason: 'no alive front-row targets'
    });
    return [];
  }

  if (card.targets === 'all-enemies' && !Object.values(world.enemies).some((enemy) => enemy.alive)) {
    world.debug.failedConditions.push({
      tick: world.tick,
      traceId: intent.traceId,
      ruleId: 'intent.play-card',
      conditionId: 'target-alive',
      reason: 'no alive targets'
    });
    return [];
  }

  commands.push({
    type: 'SpendEnergy',
    traceId: intent.traceId,
    amount: currentEnergyPaid,
    authorizationAmount: authorizationPaid,
    payoffArmed: canUseAuthorization && world.player.payoffArmed,
    cardId: card.id
  });

  commands.push({
    type: 'DiscardPlayedCard',
    traceId: intent.traceId,
    cardId: card.id
  });

  commands.push(...setCharacterState(world, 'player', 'Cast', `played ${card.id}`, intent.traceId));
  return commands;
}

function dealIntoPlayerTurn(world: WorldState, traceId: TraceId, reason: string): GameEvent[] {
  const events = applyCommand(world, {
    type: 'DealHand',
    traceId,
    count: HAND_SIZE
  });

  for (const command of setGameFlowState(world, 'PlayerTurn', reason, traceId)) {
    events.push(...applyCommand(world, command));
  }

  return events;
}

function applyCommand(world: WorldState, command: Command): GameEvent[] {
  pushCommand(world, command);

  switch (command.type) {
    case 'DealHand': {
      snapshotRoundAttackEnemies(world);
      const intentEvents = refreshEnemyIntents(world, command.traceId, true);
      const retained = releaseRetainedCardsForDeal(world, command.traceId);
      const drawCount = Math.max(0, command.count - retained.cardIds.length);
      const drawResult = drawCardsFromDeck(world, drawCount, command.traceId);
      const dealtCards = [...retained.cardIds, ...drawResult.drawn];
      resetCostChain(world);
      world.player.hand = dealtCards;
      world.player.energy = world.player.maxEnergy;
      return [
        ...retained.events,
        ...drawResult.events,
        {
          type: 'HandDealt',
          tick: world.tick,
          traceId: command.traceId,
          cardIds: [...dealtCards]
        },
        ...intentEvents
      ];
    }
    case 'DiscardHand':
      return discardHand(world, command.traceId, command.reason);
    case 'SpendEnergy':
      world.player.energy = Math.max(0, world.player.energy - command.amount);
      if (command.authorizationAmount && command.authorizationAmount > 0) {
        world.player.tempAuthorizationMP = Math.max(0, world.player.tempAuthorizationMP - command.authorizationAmount);
        world.player.payoffArmed = world.player.tempAuthorizationMP > 0;
        if (world.player.tempAuthorizationMP === 0) {
          world.player.authorizationRestriction = null;
        }
      }
      return [];
    case 'DiscardPlayedCard': {
      return moveHandCardToZone(world, command.traceId, command.cardId, playedCardDestination(command.cardId), 'played');
    }
    case 'GainXp': {
      world.player.xp += command.amount;
      const xpEvent: GameEvent = {
        type: 'XpGained',
        tick: world.tick,
        traceId: command.traceId,
        amount: command.amount,
        sourceId: command.sourceId,
        totalXp: world.player.xp
      };

      if (world.player.xp < world.reward.xpThreshold || world.reward.pending) {
        return [xpEvent];
      }

      world.player.level += 1;
      world.reward.pending = true;
      world.reward.source = 'level-up';
      world.reward.choices = generateRewardChoices(world, command.traceId);
      const levelEvent: GameEvent = {
        type: 'LevelUpReached',
        tick: world.tick,
        traceId: command.traceId,
        level: world.player.level,
        xpThreshold: world.reward.xpThreshold
      };
      const choicesEvent: GameEvent = {
        type: 'RewardChoicesGenerated',
        tick: world.tick,
        traceId: command.traceId,
        choices: [...world.reward.choices]
      };
      world.reward.xpThreshold = nextLevelXp(world.player.level);
      return [
        xpEvent,
        levelEvent,
        choicesEvent,
        ...setGameFlowState(world, 'Reward', 'level-up reward ready', command.traceId).flatMap((next) =>
          applyCommand(world, next)
        )
      ];
    }
    case 'AddCardToDeck': {
      world.player.deck.push(command.cardId);
      world.player.drawPile.unshift(command.cardId);
      world.reward.candidateCardPool = world.reward.candidateCardPool.filter((cardId) => cardId !== command.cardId);
      return [
        {
          type: 'CardAddedToDeck',
          tick: world.tick,
          traceId: command.traceId,
          cardId: command.cardId,
          deckSize: world.player.deck.length
        }
      ];
    }
    case 'AddPressurePollution': {
      if (!cards[command.cardId] || hasActivePressurePollution(world, command.cardId)) {
        return [];
      }

      world.player.discardPile.push(command.cardId);
      return [
        {
          type: 'PressurePollutionAdded',
          tick: world.tick,
          traceId: command.traceId,
          cardId: command.cardId,
          toZone: 'discardPile',
          damageTaken: command.damageTaken,
          reason: command.reason
        }
      ];
    }
    case 'ClearRewardChoices':
      world.reward.choices = [];
      world.reward.pending = false;
      world.reward.source = null;
      clearCardUpgradeChoices(world);
      return [];
    case 'DrawCards': {
      const drawResult = drawCardsFromDeck(world, command.count, command.traceId, command.excludeFromReshuffle);
      world.player.hand.push(...drawResult.drawn);
      return drawResult.drawn.length > 0
        ? [
            ...drawResult.events,
            {
              type: 'HandDealt',
              tick: world.tick,
              traceId: command.traceId,
              cardIds: drawResult.drawn
            }
          ]
        : drawResult.events;
    }
    case 'TopdeckPayoffFromDrawPile': {
      const result = topdeckPayoffFromDrawPile(world, command.sourceCardId);
      if (!result) {
        return [
          {
            type: 'PayoffTopdeckMissed',
            tick: world.tick,
            traceId: command.traceId,
            sourceCardId: command.sourceCardId,
            searchedCount: world.player.drawPile.length
          }
        ];
      }

      return [
        {
          type: 'PayoffTopdecked',
          tick: world.tick,
          traceId: command.traceId,
          sourceCardId: command.sourceCardId,
          cardId: result.cardId,
          fromIndex: result.fromIndex,
          toIndex: 0,
          searchedCount: result.searchedCount
        }
      ];
    }
    case 'GainEnergy':
      world.player.energy += command.amount;
      return [];
    case 'DamageEnemy': {
      const enemy = world.enemies[command.targetId];
      if (!enemy || !enemy.alive) {
        return [];
      }
      enemy.hp = Math.max(0, enemy.hp - command.amount);
      const damageEvent: GameEvent = {
        type: 'DamageApplied',
        tick: world.tick,
        traceId: command.traceId,
        sourceId: command.sourceId,
        targetId: command.targetId,
        amount: command.amount,
        remainingHp: enemy.hp,
        cardId: command.cardId
      };

      if (enemy.hp <= 0) {
        enemy.alive = false;
        refreshEnemyIntents(world);
        return [
          damageEvent,
          {
            type: 'EnemyKilled',
            tick: world.tick,
            traceId: command.traceId,
            enemyId: enemy.id,
            cardId: command.cardId
          }
        ];
      }

      return [damageEvent];
    }
    case 'AdvanceEnemy': {
      const enemy = world.enemies[command.enemyId];
      if (enemy?.alive) {
        const fromZ = enemy.z;
        enemy.z = Math.min(ENEMY_PRESSURE_Z, enemy.z + command.deltaZ);
        return [
          {
            type: 'EnemyAdvanced',
            tick: world.tick,
            traceId: command.traceId,
            enemyId: enemy.id,
            fromZ,
            toZ: enemy.z,
            deltaZ: enemy.z - fromZ
          }
        ];
      }
      return [];
    }
    case 'EnemyAttack': {
      const enemy = world.enemies[command.enemyId];
      if (!enemy?.alive) {
        return [];
      }
      const amount = command.amount ?? enemy.damage;
      world.player.hp = Math.max(0, world.player.hp - amount);
      const attackEvent: GameEvent = {
        type: 'EnemyAttacked',
        tick: world.tick,
        traceId: command.traceId,
        enemyId: enemy.id,
        amount,
        remainingHp: world.player.hp
      };
      if (world.player.hp <= 0) {
        markRunFailed(world);
        return [
          attackEvent,
          ...setGameFlowState(world, 'Settlement', 'player died', command.traceId).flatMap((next) =>
            applyCommand(world, next)
          )
        ];
      }
      return [attackEvent];
    }
    case 'CompactEnemySlots': {
      const active = activeAliveEnemies(world);
      for (let column = 0; column < ENEMY_COLUMNS; column += 1) {
        active
          .filter((enemy) => enemyColumn(enemy) === column)
          .forEach((enemy, row) => setEnemySlot(enemy, columnSlot(column, row)));
      }
      refreshEnemyIntents(world);
      return [];
    }
    case 'FillEnemySlots': {
      const activityLevel = world.activity ? currentActivityLevel(world.activity) : null;
      for (let column = 0; column < ENEMY_COLUMNS; column += 1) {
        const columnActive = activeAliveEnemies(world).filter((enemy) => enemyColumn(enemy) === column);
        for (let row = columnActive.length; row < ENEMY_ROWS; row += 1) {
          const enemy = createEnemy(world.nextEnemySerial, columnSlot(column, row), activityLevel);
          world.nextEnemySerial += 1;
          world.enemies[enemy.id] = enemy;
          world.fsm.characters[enemy.id] = 'Move';
        }
      }
      const active = activeAliveEnemies(world);
      refreshEnemyIntents(world);
      return [
        {
          type: 'EnemiesRepositioned',
          tick: world.tick,
          traceId: command.traceId,
          activeEnemyIds: active.map((enemy) => enemy.id)
        }
      ];
    }
    case 'AdvanceRound':
      world.round += 1;
      return [
        {
          type: 'RoundStarted',
          tick: world.tick,
          traceId: command.traceId,
          round: world.round
        }
      ];
    case 'DamagePlayer':
      world.player.hp = Math.max(0, world.player.hp - command.amount);
      if (world.player.hp <= 0) {
        markRunFailed(world);
        return [
          ...setGameFlowState(world, 'Settlement', 'player died', command.traceId).flatMap((next) => applyCommand(world, next))
        ];
      }
      return [];
    case 'SetCharacterState':
      world.fsm.characters[command.entityId] = command.state;
      pushTrace(world, {
        tick: world.tick,
        traceId: command.traceId,
        kind: 'fsm',
        label: `${command.entityId} -> ${command.state}: ${command.reason}`
      });
      return [];
    case 'SetGameFlowState':
      world.fsm.gameFlow = command.state;
      if (command.state !== 'PlayerTurn') {
        resetCostChain(world);
      }
      if (command.state === 'Settlement') {
        refreshActivitySettlementPreview(world);
      }
      pushTrace(world, {
        tick: world.tick,
        traceId: command.traceId,
        kind: 'fsm',
        label: `gameFlow -> ${command.state}: ${command.reason}`
      });
      return [];
    case 'SetCombo':
      world.player.combo = Math.max(0, command.value);
      if (world.player.combo >= 3) {
        world.player.combo = 0;
      }
      return [];
    case 'ClearBurst':
      world.lastBurstTick = world.tick;
      return [
        {
          type: 'ClearBurstRequested',
          tick: world.tick,
          traceId: command.traceId,
          cardId: command.cardId
        }
      ];
    case 'ResolvePayoff': {
      const intentDamageAfter = command.affectedEnemyIds.reduce(
        (total, enemyId) => total + (world.enemyIntents[enemyId]?.amount ?? 0),
        0
      );
      const killCount = command.affectedEnemyIds.filter((enemyId) => world.enemies[enemyId]?.alive === false).length;
      return [
        {
          type: 'PayoffResolved',
          tick: world.tick,
          traceId: command.traceId,
          cardId: command.cardId,
          payoffArmed: command.payoffArmed,
          affectedEnemyIds: [...command.affectedEnemyIds],
          killCount,
          preventedIntentDamage: Math.max(0, command.intentDamageBefore - intentDamageAfter),
          intentDamageBefore: command.intentDamageBefore,
          intentDamageAfter
        }
      ];
    }
  }
}

function resetCastState(world: WorldState, traceId: TraceId): Command[] {
  if (world.fsm.characters.player !== 'Cast') {
    return [];
  }

  return [
    {
      type: 'SetCharacterState',
      traceId,
      entityId: 'player',
      state: 'Idle',
      reason: 'cast resolved'
    }
  ];
}

function processEventQueue(world: WorldState, queue: GameEvent[]): void {
  while (queue.length > 0) {
    const event = queue.shift();
    if (!event) {
      break;
    }

    pushEvent(world, event);

    for (const result of evaluateRules(redlineRules, world, event)) {
      world.debug.ruleHits.push(result.hit);
      world.debug.ruleHits = world.debug.ruleHits.slice(-DEBUG_LIMIT);
      pushTrace(world, {
        tick: world.tick,
        traceId: event.traceId,
        kind: 'rule',
        label: `${result.hit.ruleId}: ${result.hit.passed ? 'passed' : 'failed'}`
      });

      for (const failed of result.failedConditions) {
        world.debug.failedConditions.push(failed);
        world.debug.failedConditions = world.debug.failedConditions.slice(-DEBUG_LIMIT);
        pushTrace(world, {
          tick: world.tick,
          traceId: failed.traceId,
          kind: 'condition',
          label: `${failed.conditionId}: ${failed.reason}`
        });
      }

      for (const command of result.commands) {
        const resolvedCommand =
          command.type === 'DrawCards' && event.type === 'CardPlayed'
            ? { ...command, excludeFromReshuffle: [event.cardId] }
            : command;
        queue.push(...applyCommand(world, resolvedCommand));
      }
    }
  }
}

function recordStaleIntentAfterTurnEnd(world: WorldState, intent: Intent): void {
  for (const event of createEventFromIntent(world, intent)) {
    pushEvent(world, event);
  }

  world.debug.failedConditions.push({
    tick: world.tick,
    traceId: intent.traceId,
    ruleId: `intent.${intent.type}`,
    conditionId: 'stale-intent-after-turn-end',
    reason: 'player input arrived after this tick already ended the turn'
  });
  world.debug.failedConditions = world.debug.failedConditions.slice(-DEBUG_LIMIT);
  pushTrace(world, {
    tick: world.tick,
    traceId: intent.traceId,
    kind: 'condition',
    label: 'stale-intent-after-turn-end: player input arrived after this tick already ended the turn'
  });
}

function isPlayerIntent(intent: Intent): boolean {
  return intent.type === 'deal-hand' || intent.type === 'play-card' || intent.type === 'end-turn' || intent.type === 'select-route';
}

function restartCurrentLevelWorld(current: WorldState): WorldState {
  return createInitialWorld(current.run.runNumber + 1, current.activity);
}

function continueActivityWorld(current: WorldState): WorldState {
  if (!current.activity || current.run.status !== 'victory' || current.fsm.gameFlow !== 'Settlement') {
    return current;
  }

  return createInitialWorld(current.run.runNumber + 1, continueActivityAfterVictory(current.activity));
}

export function tickWorld(current: WorldState, intents: Intent[]): WorldState {
  if (intents.some((intent) => intent.type === 'continue-activity')) {
    return continueActivityWorld(current);
  }

  if (intents.some((intent) => intent.type === 'restart-run' || intent.type === 'restart-current-level')) {
    return restartCurrentLevelWorld(current);
  }

  const world = current;
  world.tick += 1;
  let playerInputClosed = false;

  for (const intent of intents) {
    if (playerInputClosed && isPlayerIntent(intent)) {
      recordStaleIntentAfterTurnEnd(world, intent);
      continue;
    }

    const queue: GameEvent[] = [];
    queue.push(...createEventFromIntent(world, intent));

    if (intent.type === 'deal-hand') {
      if (world.fsm.gameFlow !== 'Deal') {
        world.debug.failedConditions.push({
          tick: world.tick,
          traceId: intent.traceId,
          ruleId: 'intent.deal-hand',
          conditionId: 'deal-state',
          reason: 'cards are dealt only at round start'
        });
      } else {
        queue.push(...dealIntoPlayerTurn(world, intent.traceId, 'hand dealt'));
      }
    }

    if (intent.type === 'advance-time') {
      world.elapsedSeconds += intent.deltaSeconds;
      if (world.fsm.gameFlow === 'Deal') {
        queue.push(...dealIntoPlayerTurn(world, intent.traceId, 'round start auto deal'));
      }
    }

    if (intent.type === 'play-card') {
      const card = cards[intent.cardId];
      const targetId = card?.targets === 'front-enemy' ? intent.targetId ?? defaultFrontRowEnemyId(world) : intent.targetId;
      intent.targetId = targetId;
      const playCommands = validatePlayCard(world, intent);
      if (playCommands.length > 0) {
        const spendCommand = playCommands.find((command) => command.type === 'SpendEnergy');
        const printedCost = card.cost;
        const currentEnergyPaid = spendCommand?.type === 'SpendEnergy' ? spendCommand.amount : 0;
        const authorizationPaid = spendCommand?.type === 'SpendEnergy' ? spendCommand.authorizationAmount ?? 0 : 0;
        const wasPayoffArmed = spendCommand?.type === 'SpendEnergy' ? spendCommand.payoffArmed ?? false : false;
        for (const command of playCommands) {
          queue.push(...applyCommand(world, command));
        }
        const chainResult =
          card.cardType === 'status'
            ? {
                multiplier: 1,
                effectiveCost: card.cost,
                chainRepaired: false,
                chainExtended: false,
                events: []
              }
            : advanceCostChain(world, card, intent.traceId);
        if (spendCommand?.type === 'SpendEnergy' && authorizationPaid > 0) {
          queue.push({
            type: 'CardPaymentRecorded',
            tick: world.tick,
            traceId: intent.traceId,
            cardId: intent.cardId,
            printedCost,
            currentEnergyPaid,
            authorizationPaid,
            source: paymentSource(currentEnergyPaid, authorizationPaid),
            payoffArmed: wasPayoffArmed
          });
        }
        queue.push(...chainResult.events);
        const cardPlayedEvent = {
          type: 'CardPlayed',
          tick: world.tick,
          traceId: intent.traceId,
          cardId: intent.cardId,
          targetId: intent.targetId,
          effectMultiplier: chainResult.multiplier,
          effectiveCost: chainResult.effectiveCost,
          printedCost,
          currentEnergyPaid,
          authorizationPaid,
          payoffArmed: wasPayoffArmed,
          chainRepaired: chainResult.chainRepaired,
          repairedCost: chainResult.repairedCost,
          chainExtended: chainResult.chainExtended,
          extendedCost: chainResult.extendedCost
        } as const;
        queue.push(cardPlayedEvent);
        if (isPayoffFinisher(card)) {
          queue.push({
            type: 'PayoffTriggered',
            tick: world.tick,
            traceId: intent.traceId,
            cardId: intent.cardId,
            chainLength: world.chain.playedCosts.length,
            multiplier: chainResult.multiplier,
            enhanced: chainResult.multiplier >= 3
          });
        }
      }
    }

    if (intent.type === 'select-reward') {
      if (world.fsm.gameFlow !== 'Reward' || !world.reward.pending) {
        world.debug.failedConditions.push({
          tick: world.tick,
          traceId: intent.traceId,
          ruleId: 'intent.select-reward',
          conditionId: 'reward-state',
          reason: 'reward can be selected only while a level-up reward is pending'
        });
      } else if (!world.reward.choices.includes(intent.cardId)) {
        world.debug.failedConditions.push({
          tick: world.tick,
          traceId: intent.traceId,
          ruleId: 'intent.select-reward',
          conditionId: 'reward-choice',
          reason: `${intent.cardId} is not a pending reward choice`
        });
      } else {
        const isUpgradeReward = isCardUpgradeRewardChoiceId(intent.cardId);
        const appliedUpgrade = isUpgradeReward
          ? applyCardUpgradeChoice(world, decodeCardUpgradeRewardChoiceId(intent.cardId), intent.traceId)
          : null;
        if (isUpgradeReward && !appliedUpgrade) {
          world.debug.failedConditions.push({
            tick: world.tick,
            traceId: intent.traceId,
            ruleId: 'intent.select-reward',
            conditionId: 'reward-upgrade-choice',
            reason: `${intent.cardId} did not resolve to a pending card upgrade choice`
          });
          processEventQueue(world, queue);
          continue;
        }

        recordNodePressure(world, intent.traceId);
        recordRunReward(world, intent.cardId, intent.traceId);
        const runCompleted = planRouteAfterReward(world);
        queue.push({
          type: 'RewardChosen',
          tick: world.tick,
          traceId: intent.traceId,
          cardId: intent.cardId
        });
        queue.push(...applyCommand(world, { type: 'ClearRewardChoices', traceId: intent.traceId }));
        queue.push(...applyCommand(world, { type: 'DiscardHand', traceId: intent.traceId, reason: 'reward selected' }));
        if (runCompleted) {
          if (!isUpgradeReward) {
            queue.push(...applyCommand(world, { type: 'AddCardToDeck', traceId: intent.traceId, cardId: intent.cardId }));
          }
          queue.push(
            ...setGameFlowState(world, 'Settlement', 'run completed', intent.traceId).flatMap((next) =>
              applyCommand(world, next)
            )
          );
        } else {
          if (!isUpgradeReward) {
            queue.push(...applyCommand(world, { type: 'AddCardToDeck', traceId: intent.traceId, cardId: intent.cardId }));
          }
          queue.push({
            type: 'RouteChoicesGenerated',
            tick: world.tick,
            traceId: intent.traceId,
            routeIds: ensureRouteState(world).pendingNodeChoices.map((candidate) => candidate.id)
          });
          queue.push(
            ...setGameFlowState(world, 'RouteSelect', 'route choice pending', intent.traceId).flatMap((next) =>
              applyCommand(world, next)
            )
          );
        }
      }
    }

    if (intent.type === 'select-route') {
      const route = ensureRouteState(world);
      if (world.fsm.gameFlow !== 'RouteSelect' || route.pendingNodeChoices.length === 0) {
        world.debug.failedConditions.push({
          tick: world.tick,
          traceId: intent.traceId,
          ruleId: 'intent.select-route',
          conditionId: 'route-state',
          reason: 'route can be selected only while next-node route choices are pending'
        });
      } else {
        const selectedRoute = route.pendingNodeChoices.find((candidate) => candidate.id === intent.routeId);
        if (!selectedRoute) {
          world.debug.failedConditions.push({
            tick: world.tick,
            traceId: intent.traceId,
            ruleId: 'intent.select-route',
            conditionId: 'route-choice',
            reason: `${intent.routeId} is not a pending route choice`
          });
        } else {
          annotateLastNodePressureRoute(world, selectedRoute);
          const selected = selectShortRunRouteNode(world.run, route, intent.routeId);
          world.run = selected.run;
          world.route = selected.route;
          applyNextBattleContext(world);
          const routePressure = applyRoutePressureOnEntry(world, selectedRoute, intent.traceId);
          queue.push({
            type: 'RouteChosen',
            tick: world.tick,
            traceId: intent.traceId,
            routeId: intent.routeId,
            fromNode: selectedRoute.fromNode,
            toNode: selectedRoute.toNode
          });
          queue.push(...routePressure.events);
          if (!routePressure.failed) {
            queue.push(...applyCommand(world, { type: 'CompactEnemySlots', traceId: intent.traceId }));
            queue.push(...applyCommand(world, { type: 'FillEnemySlots', traceId: intent.traceId }));
            queue.push(...applyCommand(world, { type: 'AdvanceRound', traceId: intent.traceId }));
            queue.push(...dealIntoPlayerTurn(world, intent.traceId, 'route selected'));
          }
        }
      }
    }

    if (intent.type === 'end-turn') {
      if (world.fsm.gameFlow !== 'PlayerTurn') {
        world.debug.failedConditions.push({
          tick: world.tick,
          traceId: intent.traceId,
          ruleId: 'intent.end-turn',
          conditionId: 'player-turn',
          reason: 'turn can end only during player turn'
        });
      } else {
        queue.push({
          type: 'TurnEnded',
          tick: world.tick,
          traceId: intent.traceId,
          round: world.round
        });
        for (const command of setGameFlowState(world, 'EnemyAttack', 'player ended turn', intent.traceId)) {
          queue.push(...applyCommand(world, command));
        }
        queue.push(
          ...applyCommand(world, {
            type: 'DiscardHand',
            traceId: intent.traceId,
            reason: 'turn ended'
          })
        );
        const hpBeforeEnemyAttacks = world.player.hp;
        for (const enemy of roundAttackEligibleEnemies(world)) {
          if (world.player.hp <= 0) {
            break;
          }
          const enemyIntent = world.enemyIntents[enemy.id];
          queue.push(
            ...applyCommand(world, {
              type: 'EnemyAttack',
              traceId: intent.traceId,
              enemyId: enemy.id
            })
          );
          queue.push({
            type: 'EnemyIntentResolved',
            tick: world.tick,
            traceId: intent.traceId,
            enemyId: enemy.id,
            amount: enemyIntent?.amount ?? enemy.damage,
            remainingHp: world.player.hp
          });
        }
        const damageTaken = hpBeforeEnemyAttacks - world.player.hp;
        if (world.player.hp > 0) {
          if (shouldAddPressurePollution(world, damageTaken)) {
            queue.push(
              ...applyCommand(world, {
                type: 'AddPressurePollution',
                traceId: intent.traceId,
                cardId: PRESSURE_POLLUTION_CARD_ID,
                damageTaken,
                reason: 'unresolved enemy intent damaged player'
              })
            );
          }
          for (const command of setGameFlowState(world, 'EnemyRefill', 'enemy attacks resolved', intent.traceId)) {
            queue.push(...applyCommand(world, command));
          }
          queue.push(...applyCommand(world, { type: 'CompactEnemySlots', traceId: intent.traceId }));
          queue.push(...applyCommand(world, { type: 'FillEnemySlots', traceId: intent.traceId }));
          queue.push(...applyCommand(world, { type: 'AdvanceRound', traceId: intent.traceId }));
          queue.push(...dealIntoPlayerTurn(world, intent.traceId, 'next round dealt'));
        }
        playerInputClosed = true;
      }
    }

    processEventQueue(world, queue);
  }

  for (const command of resetCastState(world, intents[0]?.traceId ?? `tick-${world.tick}`)) {
    applyCommand(world, command);
  }

  return world;
}
