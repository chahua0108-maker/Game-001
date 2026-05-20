import { cards } from '../data/cards';
import { nextTraceId } from '../input/keyboard';
import { ENEMY_COLUMNS } from '../sim/world';
import type { CardDefinition, EnemySnapshot, GameEvent, GameSnapshot, Intent } from '../sim/types';

export function validHudSelectedTargetId(
  targetId: string | null | undefined,
  enemies: EnemySnapshot[] | null | undefined
): string | null {
  if (!enemies || !targetId) {
    return null;
  }

  const target = enemies.find((enemy) => enemy.id === targetId);
  return target?.alive && target.slot >= 0 && target.slot < ENEMY_COLUMNS ? target.id : null;
}

export function canHudEndTurn(gameFlow: GameSnapshot['fsm']['gameFlow']): boolean {
  return gameFlow === 'PlayerTurn';
}

export type HudAuthorizationState = {
  amount: number;
  label: string;
  detail: string;
  active: boolean;
};

export type HudRunLayerState = {
  title: string;
  nodeLabel: string;
  pressureLabel: string;
  rewardLabel: string;
  routeLabel: string;
  buildProblemLabel: string;
  nextTitle: string;
  nextState: string;
  nextDetail: string;
  routeChoices: HudRouteChoiceRead[];
};

export type HudPressureTimelineState = {
  previousPressureLabel: string;
  buildProblemLabel: string;
  nextRouteConsequenceLabel: string;
  active: boolean;
};

export type HudRouteChoiceRead = {
  id: string;
  label: string;
  nodeLabel: string;
  modifierToken: string;
  rewardToken: string;
  preview: string;
};

export type HudCardPaymentRead = {
  playable: boolean;
  usesAuthorization: boolean;
  missingMP: number;
  reason: string;
  costLabel: string;
};

export type HudCardPaymentStatusToken = {
  label: string;
  className: 'missing-cost' | 'authorization-cost';
};

export type HudCardChainRead = {
  label: string;
  multiplier: number;
  breaksChain: boolean;
  className: string;
};

export type HudBuildPlanState = {
  token: string;
  reason: string;
  active: boolean;
};

type AuthorizationSnapshot = GameSnapshot & {
  tempAuthorizationMP?: number;
  authorization?: { tempAuthorizationMP?: number };
  player: GameSnapshot['player'] & {
    tempAuthorizationMP?: number;
    authorizationMP?: number;
    authorization?: { tempAuthorizationMP?: number };
  };
};

type HudCardMetadata = {
  cardType?: string;
  chainRole?: string;
  buildRole?: string;
  roleLabel?: string;
};

type HudRunSnapshot = GameSnapshot & {
  run?: unknown;
  activity?: unknown;
  activitySettlementPreview?: unknown;
  route?: unknown;
  shortRunRoute?: unknown;
  buildPlan?: unknown;
  runModifierPlan?: unknown;
  modifierPlan?: unknown;
};

type RunRecord = Record<string, unknown>;

export function hudAuthorizationState(snapshot: GameSnapshot): HudAuthorizationState {
  const source = snapshot as AuthorizationSnapshot;
  const candidates = [
    source.player.tempAuthorizationMP,
    source.player.authorizationMP,
    source.player.authorization?.tempAuthorizationMP,
    source.tempAuthorizationMP,
    source.authorization?.tempAuthorizationMP
  ];
  const amount = Math.max(0, candidates.find((value): value is number => typeof value === 'number' && Number.isFinite(value)) ?? 0);

  return {
    amount,
    active: amount > 0,
    label: amount > 0 ? `授权+${amount}` : '授权+0',
    detail: amount > 0 ? '本回合临时授权，只支付 3费终结牌' : '完成 0->1->2 后，本回合临时支付 3费终结牌'
  };
}

export function hudRunLayerState(snapshot: GameSnapshot): HudRunLayerState {
  const run = toRunRecord((snapshot as HudRunSnapshot).run);
  const activity = toRunRecord((snapshot as HudRunSnapshot).activity);
  const currentNode = run
    ? nodeNumber(run.currentNode, run.node, run.encounter, run.currentEncounter) ??
      indexedNumber(run.currentNodeIndex, run.nodeIndex, run.encounterIndex, run.currentEncounterIndex)
    : null;
  const maxNode = run
    ? firstNumber(
        run.maxNode,
        run.maxNodes,
        run.nodeCount,
        run.totalNodes,
        run.maxEncounter,
        run.maxEncounters,
        run.encounterCount,
        run.totalEncounters,
        run.finalNode,
        run.lastNode
      )
    : null;
  const rewardHistory = run
    ? firstArray(run.rewardHistory, run.rewards, run.rewardsClaimed, run.rewardPicks, run.chosenRewards, run.rewardLog)
    : [];
  const pendingChoices = snapshot.reward?.pending ? snapshot.reward.choices ?? [] : [];
  const debugRewards = snapshot.debug?.events?.filter((event) => event.type === 'RewardChosen') ?? [];
  const recentReward =
    readableRewardLabel(
      run ? firstValue(run.recentReward, run.lastReward, run.latestReward, rewardHistory[rewardHistory.length - 1]) : undefined
    ) ?? readableRewardLabel(debugRewards[debugRewards.length - 1]);
  const recordedRewardCount = run ? firstNumber(run.rewardHistoryCount, run.rewardCount, run.rewardsClaimedCount) : null;
  const rewardCount = rewardHistory.length || recordedRewardCount || debugRewards.length;
  const fallbackRound = typeof snapshot.round === 'number' && Number.isFinite(snapshot.round) ? snapshot.round : 1;
  const deckCount = Array.isArray(snapshot.player?.deck) ? snapshot.player.deck.length : null;
  const routeChoices = hudRouteChoicesState(snapshot);
  const pressureTimeline = hudPressureTimelineState(snapshot);
  const activityLevelLabel = activityLevelHudLabel(firstString(activity?.currentLevelId));

  return {
    title: activityLevelLabel ?? '本次清算',
    nodeLabel:
      currentNode !== null && maxNode !== null
        ? `节点 ${currentNode}/${maxNode}`
        : currentNode !== null
          ? `节点 ${currentNode}/?`
          : `节点? R${fallbackRound}`,
    pressureLabel: pressureTimeline.previousPressureLabel,
    rewardLabel:
      pendingChoices.length > 0
        ? `奖励候选 ${rewardCandidateTokens(pendingChoices).join('/')}`
        : recentReward
          ? `已拿 ${recentReward}`
          : `奖励 ${rewardCount}`,
    routeLabel:
      routeChoices.length > 0
        ? `路线候选 ${routeChoices.length}`
        : pendingChoices.length > 0
        ? rewardRouteCandidateLabel(pendingChoices)
        : recentReward
          ? `路线记录 ${rewardCount}`
          : '路线候选 待奖励',
    buildProblemLabel: pressureTimeline.buildProblemLabel,
    nextTitle: '下一战后果',
    nextState:
      routeChoices.length > 0
        ? '选路线'
        : pendingChoices.length > 0
        ? '选1入组'
        : recentReward
          ? `带入 ${recentReward}`
          : '继承当前牌组',
    nextDetail:
      routeChoices.length > 0
        ? pressureTimeline.nextRouteConsequenceLabel
        : deckCount === null
          ? '仅本run'
          : `牌组${deckCount} · 仅本run`,
    routeChoices
  };
}

function activityLevelHudLabel(levelId: string | null): string | null {
  if (levelId === 'd1') {
    return 'D1 试营业清算';
  }
  if (levelId === 'd2') {
    return 'D2 低压追账';
  }
  if (levelId === 'd3') {
    return 'D3 中级入口';
  }
  return null;
}

export function hudPressureTimelineState(snapshot: GameSnapshot): HudPressureTimelineState {
  const source = snapshot as HudRunSnapshot;
  const run = toRunRecord(source.run);
  const route = toRunRecord(firstValue(source.route, source.shortRunRoute, run?.route, run?.shortRunRoute, run));
  const routeChoices = hudRouteChoicesState(snapshot);
  const lastHistory = lastItem(firstArray(route?.history));
  const context = toRunRecord(route?.nextBattleContext) ?? toRunRecord(toRunRecord(lastHistory)?.context);
  const selectedConsequence =
    context && firstString(context.modifierId, context.rewardBranchHint)
      ? `${routeModifierToken(firstString(context.modifierId))}/${routeRewardToken(firstString(context.rewardBranchHint))}`
      : null;
  const buildPlan = hudBuildPlanState(snapshot);

  return {
    previousPressureLabel: compactHudText(previousNodePressureLabel(snapshot), 18),
    buildProblemLabel: compactHudText(`构筑 ${buildPlan.token === '常规' ? '稳定' : buildPlan.token}`, 18),
    nextRouteConsequenceLabel:
      routeChoices.length > 0
        ? `${routeChoices[0].modifierToken}/${routeChoices[0].rewardToken}`
        : selectedConsequence ?? '沿用当前牌组',
    active: buildPlan.active || routeChoices.length > 0 || Boolean(selectedConsequence)
  };
}

function previousNodePressureLabel(snapshot: GameSnapshot): string {
  const source = snapshot as HudRunSnapshot;
  const run = toRunRecord(source.run);
  const route = toRunRecord(firstValue(source.route, source.shortRunRoute, run?.route, run?.shortRunRoute, run));
  const explicitPressure = toRunRecord(
    firstValue(
      run?.previousNodePressure,
      run?.lastNodePressure,
      run?.latestPressure,
      lastItem(firstArray(run?.pressureTimeline, run?.nodePressures, route?.pressureTimeline, route?.nodePressures))
    )
  );
  const explicitLabel = explicitPressure ? pressureRecordLabel(explicitPressure) : null;
  if (explicitLabel) {
    return explicitLabel.startsWith('上压') ? explicitLabel : `上压 ${explicitLabel}`;
  }

  const historyCount = firstArray(run?.rewardHistory, run?.rewards, run?.rewardLog).length;
  const currentNode =
    run
      ? nodeNumber(run.currentNode, run.node, run.encounter, run.currentEncounter) ??
        indexedNumber(run.currentNodeIndex, run.nodeIndex, run.encounterIndex, run.currentEncounterIndex)
      : null;
  if ((currentNode ?? 1) <= 1 && historyCount === 0) {
    return '上压 首战';
  }

  const hp = firstNumber(snapshot.player?.hp);
  const maxHp = firstNumber(snapshot.player?.maxHp);
  if (hp !== null && maxHp !== null) {
    const missingHp = Math.max(0, Math.round(maxHp - hp));
    return missingHp > 0 ? `上压 损${missingHp}` : '上压 无损';
  }

  return '上压 已清算';
}

function pressureRecordLabel(record: RunRecord): string | null {
  const direct = firstString(record.label, record.pressureLabel, record.summary, record.state);
  if (direct) {
    return direct;
  }

  const damage = firstNumber(record.damageTaken, record.hpLost, record.healthLost, record.loss);
  if (damage !== null && damage > 0) {
    return `损${Math.round(damage)}`;
  }

  const pressure = firstNumber(record.pressure, record.score, record.threat, record.intentDamage);
  if (pressure !== null) {
    return pressure > 0 ? `压${Math.round(pressure)}` : '无损';
  }

  return null;
}

export function hudRouteChoicesState(snapshot: GameSnapshot): HudRouteChoiceRead[] {
  const source = snapshot as HudRunSnapshot;
  const run = toRunRecord(source.run);
  const route = toRunRecord(firstValue(source.route, source.shortRunRoute, run?.route, run?.shortRunRoute, run));
  const candidates = firstArray(
    route?.pendingNodeChoices,
    route?.pendingChoices,
    route?.routeChoices,
    route?.choices,
    run?.pendingNodeChoices
  );

  return candidates
    .map((candidate) => routeChoiceRead(candidate))
    .filter((choice): choice is HudRouteChoiceRead => Boolean(choice))
    .slice(0, 2);
}

export function hudBuildPlanState(snapshot: GameSnapshot): HudBuildPlanState {
  const source = snapshot as HudRunSnapshot;
  const run = toRunRecord(source.run);
  const plan = toRunRecord(
    firstValue(source.buildPlan, source.runModifierPlan, source.modifierPlan, run?.buildPlan, run?.runModifierPlan, run?.modifierPlan)
  );

  if (!plan) {
    return {
      token: '常规',
      reason: '无构筑预览',
      active: false
    };
  }

  const derived = toRunRecord(plan.derived) ?? plan;
  const issues = firstArray(plan.issues, plan.problems, plan.gaps)
    .map((issue) => toRunRecord(issue))
    .filter((issue): issue is RunRecord => Boolean(issue));
  const primaryIssue = issues[0];
  const issueToken = primaryIssue
    ? firstString(primaryIssue.label, primaryIssue.token, primaryIssue.id)
    : null;
  const selectedModifiers = firstArray(plan.selectedModifiers, plan.modifiers, plan.selected, plan.drafts);
  const selectedToken = selectedModifiers.map((modifier) => buildModifierToken(modifier)).find((token) => token !== null);
  const maxEnergyDelta = firstNumber(derived.maxEnergyDeltaThisRun, derived.maxEnergyDelta, derived.maxEnergyThisRunDelta);
  const rewardRerollDelta = firstNumber(derived.rewardRerollDelta, derived.rewardRerollsDelta, derived.rerollDelta);
  const startingDeckAdditions = firstArray(derived.startingDeckAdditions, derived.deckAdditions, plan.startingDeckAdditions);
  const token =
    issueToken ??
    selectedToken ??
    (maxEnergyDelta && maxEnergyDelta > 0
      ? `MP+${maxEnergyDelta}`
      : rewardRerollDelta && rewardRerollDelta > 0
        ? `复核+${rewardRerollDelta}`
        : startingDeckAdditions.length > 0
          ? '修补牌'
          : '常规');
  const explanations = firstArray(plan.explanations, plan.reasons, plan.reasonLog);
  const reason =
    firstString(
      primaryIssue?.reason,
      primaryIssue?.nextStep,
      plan.reason,
      plan.summary,
      explanations[0],
      selectedModifiers.map((modifier) => buildModifierReason(modifier)).find(Boolean)
    ) ??
    (token === '常规' ? '无构筑预览' : '本run构筑预览');

  return {
    token,
    reason,
    active: token !== '常规' || issues.length > 0
  };
}

function buildModifierToken(value: unknown): string | null {
  if (typeof value === 'string') {
    return modifierIdToken(value);
  }

  const record = toRunRecord(value);
  if (!record) {
    return null;
  }

  const id = firstString(record.id, record.modifierId);
  return modifierIdToken(id) ?? firstString(record.token, record.shortToken, record.label);
}

function buildModifierReason(value: unknown): string | null {
  if (typeof value === 'string') {
    return null;
  }

  const record = toRunRecord(value);
  return record ? firstString(record.reason, record.summary, record.description, record.label) : null;
}

function modifierIdToken(id: string | null): string | null {
  if (id === 'maxEnergyThisRunPlusOne') {
    return 'MP+1';
  }

  if (id === 'rewardRerollPlusOne') {
    return '复核+1';
  }

  if (id === 'startingRepairCard') {
    return '修补牌';
  }

  return null;
}

function routeChoiceRead(value: unknown): HudRouteChoiceRead | null {
  const record = toRunRecord(value);
  if (!record) {
    return null;
  }

  const context = toRunRecord(record.nextBattleContext) ?? toRunRecord(record.context);
  const id = firstString(record.id, record.routeId, record.selectedRouteId, context?.selectedRouteId);
  if (!id) {
    return null;
  }

  const fromNode = firstNumber(record.fromNode, context?.sourceNode);
  const toNode = firstNumber(record.toNode, context?.targetNode);
  const label = firstString(record.label, context?.label, record.kind) ?? '下一路线';
  const modifierId = firstString(record.modifierId, context?.modifierId);
  const rewardBranch = firstString(record.rewardBranchHint, context?.rewardBranchHint);
  const preview = firstString(record.preview, context?.preview, record.description) ?? `${label} · 下一战`;

  return {
    id,
    label,
    nodeLabel: fromNode !== null && toNode !== null ? `${fromNode}->${toNode}` : '下一节点',
    modifierToken: routeModifierToken(modifierId),
    rewardToken: routeRewardToken(rewardBranch),
    preview,
  };
}

function firstString(...values: unknown[]): string | null {
  const value = values.find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0);
  return value ?? null;
}

function routeModifierToken(modifierId: string | null): string {
  if (modifierId === 'rewardRerollPlusOne') {
    return '复核+1';
  }

  if (modifierId === 'maxEnergyThisRunPlusOne') {
    return 'MP+1';
  }

  if (modifierId === 'startingRepairCard') {
    return '修补牌';
  }

  return modifierId ?? '无modifier';
}

function routeRewardToken(rewardBranch: string | null): string {
  if (rewardBranch === 'repair-resource') {
    return '偏修补';
  }

  if (rewardBranch === 'payoff') {
    return '偏终结';
  }

  if (rewardBranch === 'route-bridge') {
    return '偏路线';
  }

  return rewardBranch ?? '奖励常规';
}

function toRunRecord(value: unknown): RunRecord | null {
  return value && typeof value === 'object' ? (value as RunRecord) : null;
}

function firstValue(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null);
}

function firstNumber(...values: unknown[]): number | null {
  const value = values.find((candidate): candidate is number => typeof candidate === 'number' && Number.isFinite(candidate));
  return value ?? null;
}

function indexedNumber(...values: unknown[]): number | null {
  const value = firstNumber(...values);
  return value === null ? null : value + 1;
}

function nodeNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    const record = toRunRecord(value);
    if (!record) {
      continue;
    }

    const direct = firstNumber(record.currentNode, record.node, record.encounter, record.currentEncounter);
    if (direct !== null) {
      return direct;
    }

    const indexed = indexedNumber(record.currentNodeIndex, record.nodeIndex, record.encounterIndex, record.currentEncounterIndex, record.index);
    if (indexed !== null) {
      return indexed;
    }
  }

  return null;
}

function firstArray(...values: unknown[]): unknown[] {
  return values.find((candidate): candidate is unknown[] => Array.isArray(candidate)) ?? [];
}

function lastItem(values: unknown[]): unknown {
  return values.length > 0 ? values[values.length - 1] : undefined;
}

function compactHudText(value: string, maxLength: number): string {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length <= maxLength ? cleaned : `${cleaned.slice(0, Math.max(1, maxLength - 1))}…`;
}

function readableRewardLabel(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return cards[value]?.name ?? value;
  }

  if (typeof value !== 'object') {
    return null;
  }

  const record = value as RunRecord;
  const cardId = typeof record.cardId === 'string' ? record.cardId : typeof record.id === 'string' ? record.id : null;
  if (cardId) {
    return cards[cardId]?.name ?? cardId;
  }

  const label = typeof record.name === 'string' ? record.name : typeof record.label === 'string' ? record.label : null;
  return label;
}

function rewardCandidateTokens(cardIds: string[]): string[] {
  const tokens = cardIds.map((cardId) => rewardCandidateToken(cardId));
  return Array.from(new Set(tokens)).slice(0, 3);
}

function rewardCandidateToken(cardId: string): string {
  const card = cards[cardId];
  const branches = card?.rewardBranches ?? [];
  if (branches.includes('repair-resource')) {
    return '修补';
  }

  if (branches.includes('payoff')) {
    return '终结';
  }

  if (branches.includes('route-bridge')) {
    return '路线';
  }

  if (card?.comboNode === 'burst' || card?.targets === 'all-enemies') {
    return '终结';
  }

  if (card?.utilities?.some((utility) => utility === 'wild' || utility === 'reorder')) {
    return '修补';
  }

  return '战术';
}

function rewardRouteCandidateLabel(cardIds: string[]): string {
  const routeCards = cardIds
    .filter((cardId) => {
      const card = cards[cardId];
      return Boolean(
        card?.rewardBranches?.includes('route-bridge') ||
          card?.cycleRole === 'route-segment' ||
          card?.buildRole === 'reward-chain' ||
          card?.utilities?.includes('reorder')
      );
    })
    .map((cardId) => cards[cardId]?.name ?? cardId);

  if (routeCards.length === 0) {
    return '路线候选 0';
  }

  return routeCards.length === 1 ? `路线候选 ${routeCards[0]}` : `路线候选 ${routeCards.length}`;
}

export function isHudAuthorizationPayoffCard(card: CardDefinition): boolean {
  return card.cost === 3 && card.comboNode === 'burst' && card.targets === 'all-enemies';
}

export function hudCardChainRead(card: CardDefinition, snapshot: GameSnapshot): HudCardChainRead {
  const hasEnergy = hudCardPaymentRead(card, snapshot).playable;
  const isPlayerTurn = snapshot.fsm.gameFlow === 'PlayerTurn';
  const currentMultiplier = Math.max(snapshot.player.costChainMultiplier ?? 1, snapshot.chain.multiplier ?? 1);

  if (snapshot.player.lastPlayedCost === null) {
    const startsChain = card.cost === 0;
    return {
      label: startsChain ? '起链x1' : '非起x1',
      multiplier: 1,
      breaksChain: false,
      className: isPlayerTurn && hasEnergy && startsChain ? 'chain-match' : ''
    };
  }

  const isWildRepair =
    Boolean(card.utilities?.includes('wild')) &&
    snapshot.chain.playedCosts.length > 0 &&
    !snapshot.chain.broken &&
    snapshot.chain.nextExpectedCost > 0 &&
    snapshot.chain.nextExpectedCost < 3;
  if (isWildRepair) {
    const multiplier = currentMultiplier + 1;
    return {
      label: `修补MP${snapshot.chain.nextExpectedCost}x${multiplier}`,
      multiplier,
      breaksChain: false,
      className: isPlayerTurn && hasEnergy ? 'chain-match' : ''
    };
  }

  const isWildExtension =
    card.id === 'wild_gap_key' &&
    snapshot.chain.playedCosts.length > 0 &&
    !snapshot.chain.broken &&
    snapshot.chain.nextExpectedCost === 3;
  if (isWildExtension) {
    const multiplier = currentMultiplier + 1;
    return {
      label: `延MP3x${multiplier}`,
      multiplier,
      breaksChain: false,
      className: isPlayerTurn && hasEnergy ? 'chain-match' : ''
    };
  }

  const continuesAfterWildExtension =
    isHudAuthorizationPayoffCard(card) &&
    snapshot.chain.extendedThisTurn &&
    snapshot.chain.lastCost === card.cost &&
    snapshot.chain.nextExpectedCost === card.cost + 1;
  const continues = card.cost === snapshot.player.lastPlayedCost + 1 || continuesAfterWildExtension;
  const multiplier = continues ? currentMultiplier + 1 : 1;
  return {
    label: continuesAfterWildExtension ? `续燃x${multiplier}` : continues ? `接x${multiplier}` : '断x1',
    multiplier,
    breaksChain: !continues,
    className: isPlayerTurn && hasEnergy ? (continues ? 'chain-match' : 'chain-break-risk') : ''
  };
}

export function hudCardRoleLabel(card: CardDefinition): string {
  const utilities = new Set(card.utilities ?? []);
  const metadata = card as CardDefinition & HudCardMetadata;

  if (card.id === 'clearance_order') {
    return '展开';
  }

  if (metadata.roleLabel) {
    return metadata.roleLabel;
  }

  if (
    metadata.cardType === 'payoff' ||
    metadata.chainRole === 'payoff' ||
    isHudAuthorizationPayoffCard(card) ||
    (card.cost >= 3 && card.targets === 'all-enemies')
  ) {
    return '终结';
  }

  if (utilities.has('reorder')) {
    return '整备';
  }

  if (metadata.cardType === 'repair' || metadata.chainRole === 'repair' || utilities.has('wild') || card.energyGain) {
    return '修补';
  }

  if (metadata.chainRole === 'starter') {
    return '开链';
  }

  if (metadata.chainRole === 'bridge') {
    return '承接';
  }

  if (metadata.chainRole === 'expand') {
    return '展开';
  }

  if (utilities.has('draw') || card.drawCards) {
    return '抽牌';
  }

  if (card.cost === 0) {
    return '开链';
  }

  if (card.cost === 1) {
    return '承接';
  }

  if (card.cost === 2) {
    return '展开';
  }

  return card.targets === 'all-enemies' ? '终结' : '战术';
}

export function hudCardLifecycleToken(card: CardDefinition): string | null {
  if (card.keywords?.includes('净化')) {
    return '净';
  }

  if (card.cardType === 'status' || card.keywords?.includes('状态') || card.keywords?.includes('过载')) {
    return '污';
  }

  if (card.lifecycle?.onPlay === 'exhaust' || card.keywords?.includes('消耗')) {
    return '消';
  }

  if (card.lifecycle?.onTurnEnd === 'retain' || card.keywords?.includes('保留')) {
    return '留';
  }

  return null;
}

export function hudCardVisibleRoleLabel(card: CardDefinition): string {
  const lifecycle = hudCardLifecycleToken(card);
  return lifecycle ? `${hudCardRoleLabel(card)} · ${lifecycle}` : hudCardRoleLabel(card);
}

export function hudCardPlayDestinationLabel(card: CardDefinition): string {
  return card.lifecycle?.onPlay === 'exhaust' || card.keywords?.includes('消耗') ? '消耗' : '弃牌';
}

export function hudCardTurnEndDestinationLabel(card: CardDefinition): string {
  return card.lifecycle?.onTurnEnd === 'retain' || card.keywords?.includes('保留') ? '保留' : '弃牌';
}

function cardName(cardId: string): string {
  return cards[cardId]?.name ?? cardId;
}

function cardMoveReasonLabel(reason: string): string {
  if (reason === 'played') {
    return '打出';
  }

  if (reason === 'turn ended') {
    return '回合末';
  }

  if (reason === 'reward selected') {
    return '奖励后';
  }

  if (reason === 'deal hand') {
    return '发牌';
  }

  if (reason === 'draw') {
    return '抽牌';
  }

  return reason;
}

export function hudEventFeedbackLabel(event: GameEvent): string | null {
  if (event.type === 'CardMoved') {
    const name = cardName(event.cardId);
    const reason = cardMoveReasonLabel(event.reason);

    if (event.from === 'drawPile' && event.to === 'hand') {
      return `抽到 ${name}`;
    }

    if (event.from === 'retainedCards' && event.to === 'hand') {
      return `保留回手 ${name}`;
    }

    if (event.from === 'hand' && event.to === 'discardPile') {
      return `弃 ${name} · ${reason}`;
    }

    if (event.from === 'hand' && event.to === 'exhaustPile') {
      return `消耗 ${name} · ${reason}`;
    }

    if (event.from === 'hand' && event.to === 'retainedCards') {
      return `保留 ${name} · ${reason}`;
    }
  }

  if (event.type === 'CardDrawn') {
    return `抽牌 ${cardName(event.cardId)} · 抽堆${event.remainingDrawPileCount}`;
  }

  if (event.type === 'CardExhausted') {
    return `消耗区 ${event.exhaustPileSize} · ${cardName(event.cardId)}`;
  }

  if (event.type === 'CardRetained') {
    return `留${event.retainedCardsCount}下手 · ${cardName(event.cardId)}`;
  }

  if (event.type === 'DiscardPileShuffledIntoDrawPile') {
    const kept = event.keptCardIds.length > 0 ? ` · 留弃${event.keptCardIds.length}` : '';
    return `弃->抽 ${event.cardIds.length}张${kept}`;
  }

  if (event.type === 'DiscardShuffledIntoDraw') {
    return `洗回 ${event.cardIds.length}张`;
  }

  return null;
}

export function hudCardPaymentRead(
  card: CardDefinition,
  snapshot: GameSnapshot
): HudCardPaymentRead {
  const authorization = hudAuthorizationState(snapshot);
  const baseEnergy = Math.max(0, snapshot.player.energy);
  const missingMP = Math.max(0, card.cost - baseEnergy);
  const canUseAuthorization = isHudAuthorizationPayoffCard(card) && authorization.active && baseEnergy + authorization.amount >= card.cost;
  const playable = missingMP === 0 || canUseAuthorization;

  if (playable) {
    return {
      playable,
      usesAuthorization: missingMP > 0 && canUseAuthorization,
      missingMP: 0,
      reason: missingMP > 0 ? `授权支付：${card.name}` : `出牌：${card.name}`,
      costLabel: missingMP > 0 ? `MP ${card.cost} · ${authorization.label}` : `MP ${card.cost}`
    };
  }

  return {
    playable,
    usesAuthorization: false,
    missingMP,
    reason: isHudAuthorizationPayoffCard(card) ? `缺MP或授权：差 ${missingMP}` : `MP不足：差 ${missingMP}`,
    costLabel: `MP ${card.cost}`
  };
}

export function hudCardPaymentStatusToken(card: CardDefinition, snapshot: GameSnapshot): HudCardPaymentStatusToken | null {
  if (snapshot.fsm.gameFlow !== 'PlayerTurn') {
    return null;
  }

  const payment = hudCardPaymentRead(card, snapshot);
  if (!payment.playable && payment.missingMP > 0) {
    return {
      label: isHudAuthorizationPayoffCard(card) ? '缺授权' : `缺MP${payment.missingMP}`,
      className: 'missing-cost'
    };
  }

  if (payment.usesAuthorization) {
    return { label: '授权付', className: 'authorization-cost' };
  }

  return null;
}

function enemyIntentAmount(snapshot: GameSnapshot, enemyId: string): number {
  return snapshot.enemyIntents.find((intent) => intent.enemyId === enemyId)?.amount ?? 0;
}

function frontRowEnemies(snapshot: GameSnapshot): EnemySnapshot[] {
  return snapshot.enemies
    .filter((enemy) => enemy.alive && enemy.slot >= 0 && enemy.slot < ENEMY_COLUMNS)
    .sort((left, right) => left.slot - right.slot);
}

function enemyShortLabel(enemy: EnemySnapshot): string {
  if (enemy.definitionId === 'redline_brute') {
    return 'BRU';
  }

  if (enemy.definitionId === 'pulse_collector') {
    return 'COL';
  }

  return 'WSP';
}

export function defaultHudFrontTargetId(snapshot: GameSnapshot): string | null {
  return (
    frontRowEnemies(snapshot).sort((left, right) => {
      const intentDelta = enemyIntentAmount(snapshot, right.id) - enemyIntentAmount(snapshot, left.id);
      if (intentDelta !== 0) {
        return intentDelta;
      }

      const hpDelta = left.hp - right.hp;
      return hpDelta !== 0 ? hpDelta : left.slot - right.slot;
    })[0]?.id ?? null
  );
}

export function hudCardIntentPreview(
  card: CardDefinition,
  snapshot: GameSnapshot,
  selectedTargetId: string | null = null,
  multiplier = 1
): { label: string; before: number; after: number; prevented: number; targetId: string | null } {
  const before =
    snapshot.enemyIntentSummary.totalDamage ||
    snapshot.enemyIntents.reduce((total, intent) => total + intent.amount, 0);

  if (before <= 0) {
    return { label: '无当前意图', before, after: before, prevented: 0, targetId: null };
  }

  if (card.damage <= 0) {
    const drawCount = card.drawCards ? card.drawCards * multiplier : 0;
    const unresolved = before > 0 ? `仍-${before}` : '不降意图';
    const utilityLabel = drawCount > 0 ? `抽${drawCount}${unresolved}` : card.energyGain ? `返MP${unresolved}` : '不降意图';
    return { label: utilityLabel, before, after: before, prevented: 0, targetId: null };
  }

  const damage = card.damage * multiplier;
  const targetId =
    card.targets === 'front-enemy'
      ? validHudSelectedTargetId(selectedTargetId, snapshot.enemies) ?? defaultHudFrontTargetId(snapshot)
      : null;
  const affectedEnemies =
    card.targets === 'front-enemy'
      ? frontRowEnemies(snapshot).filter((enemy) => enemy.id === targetId)
      : card.targets === 'front-row'
        ? frontRowEnemies(snapshot)
        : card.targets === 'all-enemies'
          ? snapshot.enemies.filter((enemy) => enemy.alive)
          : [];

  if (affectedEnemies.length === 0) {
    return { label: '无有效目标', before, after: before, prevented: 0, targetId };
  }

  const prevented = affectedEnemies.reduce((total, enemy) => {
    if (enemy.hp > damage) {
      return total;
    }

    return total + enemyIntentAmount(snapshot, enemy.id);
  }, 0);
  const after = Math.max(0, before - prevented);

  if (prevented <= 0) {
    return { label: `仍-${before}`, before, after, prevented, targetId };
  }

  const target = affectedEnemies[0];
  const prefix = card.targets === 'front-enemy' && target ? `${enemyShortLabel(target)} ` : '';
  return { label: `${prefix}意图 ${before}->${after}`, before, after, prevented, targetId };
}

export class Hud {
  private snapshot: GameSnapshot | null = null;
  private lastMarkup = '';
  private suppressClickUntil = 0;
  private lastAttackKey: string | null = null;
  private playerHitFlashUntil = 0;
  private selectedTargetId: string | null = null;
  private enemyInfoVisible = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly onIntent: (intent: Intent) => void
  ) {
    this.root.addEventListener('pointerdown', (event) => this.handleActivation(event), { capture: true });
    this.root.addEventListener('click', (event) => this.handleActivation(event), { capture: true });
  }

  private handleActivation(event: Event): void {
    const now = performance.now();
    if (event.type === 'click' && now < this.suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLButtonElement>('button');
    if (!button || button.disabled) {
      return;
    }

    const targetEnemyId = button.dataset.targetEnemyId;
    if (targetEnemyId) {
      event.preventDefault();
      if (event.type === 'pointerdown') {
        this.suppressClickUntil = now + 500;
      }
      event.stopPropagation();
      this.selectedTargetId = this.selectedTargetId === targetEnemyId ? null : targetEnemyId;
      if (this.snapshot) {
        this.render(this.snapshot);
      }
      return;
    }

    if (button.matches('[data-enemy-toggle]')) {
      event.preventDefault();
      if (event.type === 'pointerdown') {
        this.suppressClickUntil = now + 500;
      }
      event.stopPropagation();
      this.enemyInfoVisible = !this.enemyInfoVisible;
      if (this.snapshot) {
        this.render(this.snapshot);
      }
      return;
    }

    const action = this.intentForButton(button);
    if (!action) {
      return;
    }

    event.preventDefault();
    if (event.type === 'pointerdown') {
      this.suppressClickUntil = now + 500;
    }
    event.stopPropagation();
    this.onIntent(action.intent);
  }

  private intentForButton(button: HTMLButtonElement): { key: string; intent: Intent } | null {
    const routeChoiceId = button.dataset.routeChoiceId;
    if (routeChoiceId) {
      return {
        key: `select-route:${routeChoiceId}`,
        intent: { type: 'select-route', routeId: routeChoiceId, traceId: nextTraceId('route') } as Intent
      };
    }

    const rewardCardId = button.dataset.rewardCardId;
    if (rewardCardId) {
      return {
        key: `select-reward:${rewardCardId}`,
        intent: { type: 'select-reward', cardId: rewardCardId, traceId: nextTraceId('reward') }
      };
    }

    const cardId = button.dataset.cardId;
    if (cardId) {
      const card = cards[cardId];
      const selectedTargetId =
        card?.targets === 'front-enemy'
          ? this.validSelectedTargetIdFor(button.dataset.selectedTargetId ?? this.selectedTargetId)
          : null;
      return {
        key: `play-card:${cardId}`,
        intent: {
          type: 'play-card',
          cardId,
          ...(selectedTargetId ? { targetId: selectedTargetId } : {}),
          traceId: nextTraceId('pointer')
        }
      };
    }

    if (button.matches('[data-continue-activity]')) {
      return {
        key: 'continue-activity',
        intent: { type: 'continue-activity', traceId: nextTraceId('continue') }
      };
    }

    if (button.matches('[data-restart], [data-restart-current-level]')) {
      return {
        key: 'restart-current-level',
        intent: { type: 'restart-current-level', traceId: nextTraceId('restart') }
      };
    }

    if (button.matches('[data-deal]')) {
      return {
        key: 'deal-hand',
        intent: { type: 'deal-hand', traceId: nextTraceId('deal') }
      };
    }

    if (button.matches('[data-end-turn]')) {
      return {
        key: 'end-turn',
        intent: { type: 'end-turn', traceId: nextTraceId('end-turn') }
      };
    }

    return null;
  }

  render(snapshot: GameSnapshot): void {
    this.snapshot = snapshot;
    const attackEvents = snapshot.debug.events.filter((event) => event.type === 'EnemyAttacked');
    const latestAttack = attackEvents[attackEvents.length - 1];
    if (latestAttack) {
      const attackKey = `${latestAttack.traceId}:${latestAttack.tick}:${latestAttack.enemyId}:${latestAttack.remainingHp}`;
      if (attackKey !== this.lastAttackKey) {
        this.lastAttackKey = attackKey;
        this.playerHitFlashUntil = performance.now() + 620;
      }
    }
    const playerHitClass = performance.now() < this.playerHitFlashUntil ? 'player-hit' : '';
    this.selectedTargetId = this.validSelectedTargetId(snapshot);
    const selectedTarget = this.selectedTargetId
      ? snapshot.enemies.find((enemy) => enemy.id === this.selectedTargetId) ?? null
      : null;
    const defaultTargetId = defaultHudFrontTargetId(snapshot);
    const defaultTarget = defaultTargetId ? snapshot.enemies.find((enemy) => enemy.id === defaultTargetId) ?? null : null;
    const combatLabels = snapshot.debug.events
      .map((event) => ({ event, label: this.combatEventLabel(event, snapshot) }))
      .filter((entry): entry is { event: GameEvent; label: string } => Boolean(entry.label));
    let latestCombat = combatLabels.slice(-2).reverse();
    const priorityLog = [...combatLabels]
      .reverse()
      .find((entry) => entry.event.type === 'PayoffTopdecked' || entry.event.type === 'PayoffTopdeckMissed');
    if (priorityLog && !latestCombat.some((entry) => entry.label === priorityLog.label)) {
      latestCombat = [priorityLog, ...latestCombat.slice(0, 1)];
    }
    const latestCombatLabels = latestCombat.map((entry) => entry.label);
    const latestTrace = snapshot.debug.trace
      .filter((trace) => !trace.traceId.startsWith('tick-') && trace.label !== 'TimeAdvanced')
      .slice(-12)
      .reverse();
    const latestFailed = snapshot.debug.failedConditions.slice(-4).reverse();
    const latestRules = snapshot.debug.ruleHits.slice(-5).reverse();
    const latestCommands = snapshot.debug.commands.slice(-5).reverse();
    const isPlayerTurn = snapshot.fsm.gameFlow === 'PlayerTurn';
    const isDeal = snapshot.fsm.gameFlow === 'Deal';
    const isSettlement = snapshot.fsm.gameFlow === 'Settlement';
    const activity = toRunRecord((snapshot as HudRunSnapshot).activity);
    const activityPreview = toRunRecord((snapshot as HudRunSnapshot).activitySettlementPreview);
    const activityLevelLabel = activityLevelHudLabel(firstString(activity?.currentLevelId)) ?? '本局';
    const nextLevelLabel = firstString(activityPreview?.nextLevelLabel);
    const settlementWon = isSettlement && snapshot.run?.status === 'victory';
    const settlementAction = settlementWon && nextLevelLabel
      ? {
          attr: 'data-continue-activity',
          label: `进入 ${nextLevelLabel}`,
          aria: `进入下一难度 ${nextLevelLabel}`
        }
      : {
          attr: 'data-restart-current-level',
          label: `重试 ${activityLevelLabel.split(' ')[0] ?? '本局'}`,
          aria: `重试当前难度 ${activityLevelLabel}`
        };
    const hpFill = Math.max(0, Math.min(100, (snapshot.player.hp / snapshot.player.maxHp) * 100));
    const energyFill = Math.max(0, Math.min(100, (snapshot.player.energy / snapshot.player.maxEnergy) * 100));
    const energyText = Number.isInteger(snapshot.player.energy) ? snapshot.player.energy.toFixed(0) : snapshot.player.energy.toFixed(1);
    const authorization = hudAuthorizationState(snapshot);
    const runLayer = hudRunLayerState(snapshot);
    const buildPlan = hudBuildPlanState(snapshot);
    const routeChoiceMarkup = this.renderRouteChoices(runLayer.routeChoices);
    const chainStarted = snapshot.player.lastPlayedCost !== null;
    const nextChainCost = chainStarted ? snapshot.player.lastPlayedCost! + 1 : 0;
    const nextChainMultiplier = chainStarted ? snapshot.player.costChainMultiplier + 1 : 1;
    const chainRouteLabel = this.chainRouteLabel(snapshot);
    const chainHint = chainStarted ? `下MP${nextChainCost} x${nextChainMultiplier}` : 'MP0起链';
    const frontEnemySlots = Array.from({ length: ENEMY_COLUMNS }, (_, slot) =>
      snapshot.enemies.find((enemy) => enemy.alive && enemy.slot === slot)
    );
    const livingFrontEnemies = frontEnemySlots.filter(Boolean).length;
    const flowLabel =
      snapshot.fsm.gameFlow === 'Deal'
        ? '回合开始'
        : snapshot.fsm.gameFlow === 'PlayerTurn'
          ? '玩家出牌'
          : snapshot.fsm.gameFlow === 'EnemyAttack'
            ? '怪物攻击'
        : snapshot.fsm.gameFlow === 'EnemyRefill'
          ? '怪物补位'
          : snapshot.fsm.gameFlow === 'Reward'
            ? '升级奖励'
          : snapshot.fsm.gameFlow === 'Settlement'
            ? '游戏结束'
            : snapshot.fsm.gameFlow;
    const activeEnemies = snapshot.enemies.filter((enemy) => enemy.alive);
    const frontThreatEnemies = activeEnemies.filter((enemy) => enemy.slot >= 0 && enemy.slot < ENEMY_COLUMNS);
    const priorityThreat = [...frontThreatEnemies].sort((left, right) => left.hp - right.hp)[0];
    const enemyIntent = this.enemyIntentSummary(snapshot);
    const unresolvedIntentLabel =
      enemyIntent.totalDamage > 0
        ? `回合损${enemyIntent.totalDamage}`
        : activeEnemies.length > 0
          ? '结束回合安全'
          : '清场安全';
    const playableCount = snapshot.player.hand.filter((cardId) => {
      const card = cards[cardId];
      return isPlayerTurn && hudCardPaymentRead(card, snapshot).playable;
    }).length;
    const playableVerbs = Array.from(
      new Set(
        snapshot.player.hand
          .filter((cardId) => isPlayerTurn && hudCardPaymentRead(cards[cardId], snapshot).playable)
          .map((cardId) => cards[cardId].verb)
      )
    ).slice(0, 4);
    const burstCardsReady = snapshot.player.hand.some((cardId) => {
      const card = cards[cardId];
      return isPlayerTurn && card.targets === 'all-enemies' && hudCardPaymentRead(card, snapshot).playable;
    });
    const burstRecentlyFired = snapshot.lastBurstTick !== null && snapshot.tick - snapshot.lastBurstTick <= 8;
    const nearClear = activeEnemies.length > 0 && activeEnemies.length <= 3;
    const directorState = burstRecentlyFired
      ? 'burst-fired'
      : burstCardsReady
        ? 'burst-ready'
        : nearClear
          ? 'near-clear'
          : '';
    const threatLabel =
      frontThreatEnemies.length > 0
        ? `${frontThreatEnemies.length} 前排压线`
        : activeEnemies.length > 0
          ? `${activeEnemies.length} 后排压上`
          : '清场窗口';
    const threatDetail = priorityThreat
      ? `${priorityThreat.name} HP ${priorityThreat.hp}/${priorityThreat.maxHp}`
      : activeEnemies.length > 0
        ? '下一波正在补位'
        : '回收节奏，准备下一轮';
    const actionLabel = isPlayerTurn
      ? playableCount > 0
        ? `${playableCount} 可打 · ${playableVerbs.join(' / ')}`
        : '无可打牌'
      : flowLabel;
    const payoffPreview = this.payoffPreviewLabel(snapshot);
    const deckLoopLabel = `总 ${snapshot.player.deck.length} · 抽 ${snapshot.player.drawPile.length} · 弃 ${snapshot.player.discardPile.length} · 手 ${snapshot.player.hand.length} · 消 ${snapshot.player.exhaustPile.length} · 留 ${snapshot.player.retainedCards.length}`;
    const compactDeckLoopLabel = `抽${snapshot.player.drawPile.length} 弃${snapshot.player.discardPile.length} 消${snapshot.player.exhaustPile.length} 留${snapshot.player.retainedCards.length}`;
    const canEndTurn = canHudEndTurn(snapshot.fsm.gameFlow);
    const endTurnTitle = isPlayerTurn ? `结束当前玩家回合；${unresolvedIntentLabel}` : '当前不是玩家出牌阶段';
    const endTurnLabel = enemyIntent.totalDamage > 0 ? `结束-${enemyIntent.totalDamage}` : '结束回合';
    const emptyHandText = isDeal
        ? '回合开始，先发牌。'
      : isSettlement
        ? settlementWon
          ? '本关完成，进入下一难度。'
          : '你已阵亡，点击重试。'
        : snapshot.fsm.gameFlow === 'Reward'
        ? '升级奖励选择中。'
        : isPlayerTurn
        ? '手牌已空，点击结束回合。'
        : '等待回合阶段结算。';

    const markup = `
      <section class="status-strip" aria-label="status">
        <div class="resource-chip hp-chip ${playerHitClass}" style="--fill: ${hpFill}%">
          <span class="resource-head">
            <strong>HP</strong>
            <em>${snapshot.player.hp.toFixed(0)} / ${snapshot.player.maxHp}</em>
          </span>
          <span class="resource-meter" aria-hidden="true"><i></i></span>
        </div>
        <div class="resource-chip mp-chip" style="--fill: ${energyFill}%">
          <span class="resource-head">
            <strong>MP</strong>
            <em>${energyText} / ${snapshot.player.maxEnergy}</em>
          </span>
          <span class="resource-meter" aria-hidden="true"><i></i></span>
        </div>
        <div class="status-chip authorization-chip ${authorization.active ? 'active' : ''}" title="${authorization.detail}">
          <strong>${authorization.label}</strong>
          <span>${authorization.active ? '本回合' : '待解锁'}</span>
          <em>${authorization.active ? '只付3费终结牌' : '0->1->2'}</em>
        </div>
        <div class="status-chip xp-chip">
          <strong>LV ${snapshot.player.level}</strong>
          <span>XP ${snapshot.player.xp} / ${snapshot.reward.xpThreshold}</span>
        </div>
        <div class="status-chip chain-chip ${chainStarted ? 'active' : ''}">
          <strong>CHAIN</strong>
          <span>${chainRouteLabel}</span>
          <em>${chainHint}</em>
        </div>
        <div class="status-chip build-plan-chip ${buildPlan.active ? 'active' : ''}" title="${buildPlan.reason}">
          <strong>构筑</strong>
          <span>${buildPlan.token}</span>
          <em>${buildPlan.reason}</em>
        </div>
        <div class="status-chip intent-chip ${enemyIntent.totalDamage > 0 ? 'danger' : ''}">
          <strong>意图</strong>
          <span>${enemyIntent.totalDamage > 0 ? `-${enemyIntent.totalDamage} HP` : '安全'}</span>
          <em>${enemyIntent.detail}</em>
        </div>
        <div class="status-chip phase-chip">
          <strong>FSM</strong>
          <span>R${snapshot.round} ${flowLabel}</span>
        </div>
        <div class="status-chip pile-chip" title="${deckLoopLabel}">
          <strong>牌堆</strong>
          <span>抽${snapshot.player.drawPile.length} 弃${snapshot.player.discardPile.length} 消${snapshot.player.exhaustPile.length} 留${snapshot.player.retainedCards.length}</span>
          <em>抽/弃/消/留</em>
        </div>
        <button type="button" data-restart-current-level>重试</button>
      </section>

      <section class="combat-director chain-director ${directorState}" aria-label="hyper turn chain director">
        <div class="director-cell director-chain">
          <span>本回合链路</span>
          <strong>${chainRouteLabel}</strong>
          <em>${chainHint}</em>
        </div>
        <div class="director-cell director-action">
          <span>下张费用</span>
          <strong>${chainStarted ? `MP${nextChainCost}` : 'MP0'}</strong>
          <em>${actionLabel}</em>
        </div>
        <div class="director-cell director-intent">
          <span>敌意图</span>
          <strong>${enemyIntent.totalDamage > 0 ? `回合损${enemyIntent.totalDamage}` : threatLabel}</strong>
          <em>${enemyIntent.detail || threatDetail}</em>
        </div>
        <div class="director-cell director-payoff">
          <span>终结</span>
          <strong>${payoffPreview.title}</strong>
          <em>${payoffPreview.detail}</em>
        </div>
      </section>

      <section class="deal-panel" aria-label="deal cards">
        <div>
          <span>回合 ${snapshot.round}</span>
          <strong>${flowLabel}</strong>
          <small>${
            isDeal
              ? '按 D 或点击发牌'
                : isSettlement
                  ? '本局已结束'
              : snapshot.fsm.gameFlow === 'Reward'
                ? compactDeckLoopLabel
              : isPlayerTurn
                ? `${unresolvedIntentLabel} · 可出牌 ${playableCount}`
                : '怪物正在结算'
          }</small>
        </div>
        ${
          isDeal
            ? '<button type="button" data-deal aria-label="发牌进入玩家出牌阶段">发牌</button>'
            : isSettlement
              ? `<button type="button" ${settlementAction.attr} aria-label="${settlementAction.aria}">${settlementAction.label}</button>`
            : `<button type="button" data-end-turn aria-label="${endTurnTitle}" title="${endTurnTitle}" ${canEndTurn ? '' : 'disabled'}>${endTurnLabel}</button>`
        }
      </section>

      <section class="target-panel ${selectedTarget ? 'target-locked' : 'target-random'}" aria-label="target selection">
        <strong>目标</strong>
        <span>${selectedTarget ? enemyShortLabel(selectedTarget) : defaultTarget ? `默认${enemyShortLabel(defaultTarget)}` : '无前排'}</span>
      </section>

      <section class="run-layer-panel" aria-label="run layer">
        <div class="run-layer-main">
          <span>${runLayer.title}</span>
          <strong>${runLayer.nodeLabel}</strong>
          <em>${runLayer.pressureLabel}</em>
          <small>${runLayer.buildProblemLabel}</small>
        </div>
        <div class="run-layer-meta" aria-label="next encounter carryover">
          <span>${runLayer.nextTitle}</span>
          <strong>${runLayer.nextState}</strong>
          <em>${runLayer.nextDetail}</em>
        </div>
      </section>

      <section class="enemy-peek ${this.enemyInfoVisible ? 'enemy-info-visible' : ''}" aria-label="front enemy target controls">
        <button
          type="button"
          class="enemy-peek-toggle"
          data-enemy-toggle
          aria-expanded="${this.enemyInfoVisible}"
          title="${this.enemyInfoVisible ? '隐藏前排怪物信息' : '显示第一排怪物信息与目标按钮'}"
        >
          ${this.enemyInfoVisible ? '隐藏前排' : `前排显影 ${livingFrontEnemies}`}
        </button>
        ${
          this.enemyInfoVisible
            ? `<div class="enemy-slot-strip" aria-label="front enemy slots">
                ${frontEnemySlots.map((enemy, index) => this.renderEnemySlot(enemy, index)).join('')}
              </div>`
            : ''
        }
      </section>

      <section class="combat-feed" aria-label="combat feed" aria-live="polite">
        <header>
          <strong>战斗信息</strong>
          <span>${isDeal ? '待发牌' : flowLabel}</span>
        </header>
        <ol>
          ${
            latestCombatLabels.length > 0
              ? latestCombatLabels.map((label) => `<li>${label}</li>`).join('')
              : '<li>回合开始，点击发牌。</li>'
          }
        </ol>
      </section>

      ${
        isSettlement
          ? `<section class="game-over-panel" aria-label="game over">
              <span>${settlementWon ? 'Clear' : 'Game Over'}</span>
              <strong>${settlementWon ? `${activityLevelLabel} 完成` : '你已阵亡'}</strong>
              <small>回合 ${snapshot.round} · ${settlementWon ? settlementAction.label : '敌群突破防线'}</small>
              <button type="button" ${settlementAction.attr}>${settlementAction.label}</button>
            </section>`
          : ''
      }

      ${
        snapshot.fsm.gameFlow === 'Reward'
          ? `<section class="reward-panel" aria-label="level reward">
              <header>
                <span>Level ${snapshot.player.level} · ${runLayer.nodeLabel}</span>
                <strong>选择一张新牌加入牌组</strong>
                <small>${runLayer.rewardLabel} · ${runLayer.routeLabel} · ${runLayer.nextState}</small>
              </header>
              <div class="reward-choices">
                ${snapshot.reward.choices.map((cardId) => this.renderRewardChoice(cardId)).join('')}
              </div>
              ${routeChoiceMarkup}
            </section>`
          : ''
      }

      ${
        snapshot.fsm.gameFlow === 'RouteSelect' && routeChoiceMarkup
          ? `<section class="reward-panel route-panel" aria-label="next route selection">
              <header>
                <span>${runLayer.nodeLabel}</span>
                <strong>选择下一战路线</strong>
                <small>${runLayer.rewardLabel} · ${runLayer.routeLabel} · ${runLayer.nextDetail}</small>
              </header>
              ${routeChoiceMarkup}
            </section>`
          : ''
      }

      <section class="card-row" aria-label="cards">
        ${
          isSettlement
            ? `<div class="empty-hand game-ended">${emptyHandText}</div>`
            : snapshot.player.hand.length === 0
            ? `<div class="empty-hand">${emptyHandText}</div>`
            : snapshot.player.hand
                .map((cardId, index) => {
                  const card = cards[cardId];
                  const payment = hudCardPaymentRead(card, snapshot);
                  const disabled = !isPlayerTurn || !payment.playable;
                  const reason = disabled
                    ? !isPlayerTurn
                      ? '当前不是玩家出牌阶段，不能出牌'
                      : payment.reason
                    : payment.reason;
                  const targetLabel = this.targetLabel(card.targets);
                  const roleLabel = hudCardVisibleRoleLabel(card);
                  const chainRead = this.cardChainRead(card, snapshot);
                  const effectLabel = this.cardEffectLabel(card, chainRead.multiplier);
                  const costLabel = payment.costLabel;
                  const chainPreview = chainRead.label;
                  const payoffLabel = this.cardPayoffLabel(card, chainRead.multiplier, snapshot);
                  const intentPreview = hudCardIntentPreview(card, snapshot, selectedTarget?.id ?? null, chainRead.multiplier);
                  const activeTargetLabel =
                    card.targets === 'front-enemy' && selectedTarget
                      ? `目标${enemyShortLabel(selectedTarget)}`
                      : card.targets === 'front-enemy' && defaultTarget
                        ? `默认${enemyShortLabel(defaultTarget)}`
                        : targetLabel;
                  const selectedTargetAttr =
                    card.targets === 'front-enemy' && selectedTarget ? `data-selected-target-id="${selectedTarget.id}"` : '';
                  const tooltip = `${reason}。${roleLabel} · ${chainPreview} · ${costLabel} · ${effectLabel} · ${intentPreview.label}${payoffLabel ? ` · ${payoffLabel}` : ''}。${authorization.detail}。${this.cardDetailText(card)}`;
                  const paymentStatus = hudCardPaymentStatusToken(card, snapshot);
                  const missingText = paymentStatus ? `<em class="${paymentStatus.className}">${paymentStatus.label}</em>` : '';
                  return `
                    <button class="card-button ${card.targets === 'all-enemies' ? 'burst-card' : ''} ${chainRead.className} ${
                      payment.usesAuthorization ? 'authorization-payable' : ''
                    } ${
                      disabled && isPlayerTurn ? 'locked-card' : ''
                    }" type="button" data-card-id="${card.id}" ${selectedTargetAttr} aria-label="${reason}" title="${tooltip}" ${
                      disabled ? 'disabled' : ''
                    }>
                      <span class="card-cost"><small>MP</small><b>${card.cost}</b></span>
                      <span class="hotkey">#${index + 1}</span>
                      <strong>${card.name}</strong>
                      <span class="card-meta"><b>${roleLabel}</b> · ${activeTargetLabel}</span>
                      <span class="chain-preview ${chainRead.breaksChain ? 'breaks-chain' : ''}">${chainPreview}</span>
                      <span class="card-intent-preview">${intentPreview.label}</span>
                      ${payoffLabel ? `<span class="card-payoff">${payoffLabel}</span>` : ''}
                      <small class="card-effect">${costLabel} · ${effectLabel}</small>
                      ${missingText}
                    </button>
                  `;
                })
                .join('')
        }
      </section>

      <details class="debug-panel" aria-label="debug trace">
        <summary>
          <strong>Debug Trace</strong>
          <span>round ${snapshot.round}</span>
        </summary>
        <dl>
          <dt>Rules</dt>
          <dd>${latestRules.map((rule) => `${rule.ruleId}:${rule.passed ? 'ok' : 'fail'}`).join('<br>') || 'none'}</dd>
          <dt>Failed Conditions</dt>
          <dd>${latestFailed.map((item) => `${item.conditionId}: ${item.reason}`).join('<br>') || 'none'}</dd>
          <dt>Commands</dt>
          <dd>${latestCommands.map((command) => command.type).join('<br>') || 'none'}</dd>
          <dt>Trace</dt>
          <dd>${latestTrace.map((trace) => `${trace.traceId} · ${trace.label}`).join('<br>') || 'none'}</dd>
        </dl>
      </details>
    `;
    if (markup !== this.lastMarkup) {
      this.root.innerHTML = markup;
      this.lastMarkup = markup;
    }
  }

  private renderEnemySlot(enemy: EnemySnapshot | undefined, index: number): string {
    const row = Math.floor(index / ENEMY_COLUMNS) + 1;
    const column = (index % ENEMY_COLUMNS) + 1;
    const rowClass = index < ENEMY_COLUMNS ? 'front-row' : 'queue-row';
    const slotLabel = `${row}-${column}`;
    const isFrontSlot = index < ENEMY_COLUMNS;

    if (!enemy) {
      return `<div class="enemy-slot empty ${rowClass}"><span class="slot-id">${slotLabel}</span><strong>空槽</strong><small>补位中</small></div>`;
    }

    const type = this.enemyTypeMeta(enemy.definitionId);
    const intent = this.snapshot?.enemyIntents.find((item) => item.enemyId === enemy.id);
    const intentLabel = isFrontSlot ? (intent ? `本回合 -${intent.amount}` : '下轮') : '后排';
    const selectedClass = this.selectedTargetId === enemy.id ? 'target-selected' : '';
    const targetAttrs = isFrontSlot
      ? `type="button" data-target-enemy-id="${enemy.id}" aria-pressed="${this.selectedTargetId === enemy.id}" title="选择 ${enemy.name} 作为单体牌目标"`
      : '';
    const tag = isFrontSlot ? 'button' : 'div';
    return `
      <${tag} class="enemy-slot occupied ${rowClass} ${type.className} ${isFrontSlot ? 'targetable' : ''} ${selectedClass}" ${targetAttrs}>
        <span class="slot-id">${slotLabel}</span>
        <span class="type-badge">${type.label}</span>
        <strong>${enemy.name}</strong>
        <small>${enemy.hp}/${enemy.maxHp}</small>
        <small class="enemy-intent-badge">${intentLabel}</small>
      </${tag}>
    `;
  }

  private renderRewardChoice(cardId: string): string {
    const card = cards[cardId];
    if (!card) {
      return '';
    }

    const targetLabel = this.targetLabel(card.targets);
    const roleLabel = hudCardVisibleRoleLabel(card);
    const effectLabel = this.cardEffectLabel(card);
    const costLabel = this.cardCostLabel(card);
    return `
      <button class="reward-card ${card.targets === 'front-row' ? 'row-card' : ''}" type="button" data-reward-card-id="${card.id}" title="${costLabel} · ${effectLabel}。${this.cardDetailText(card)}">
        <span>${roleLabel} · ${targetLabel}</span>
        <strong>${card.name}</strong>
        <small>${costLabel} · ${effectLabel}</small>
        <em>${this.cardRulesText(card)}</em>
      </button>
    `;
  }

  private renderRouteChoices(routeChoices: HudRouteChoiceRead[]): string {
    if (routeChoices.length === 0) {
      return '';
    }

    return `
      <div class="route-choices" aria-label="next route selection">
        ${routeChoices
          .map(
            (choice) => `
              <button
                class="route-choice"
                type="button"
                data-route-choice-id="${choice.id}"
                title="${choice.label} · ${choice.nodeLabel} · ${choice.modifierToken} · ${choice.rewardToken}。${choice.preview}"
              >
                <span>${choice.nodeLabel}</span>
                <strong>${choice.label}</strong>
                <small>${choice.modifierToken} · ${choice.rewardToken}</small>
                <em>${choice.preview}</em>
              </button>
            `
          )
          .join('')}
      </div>
    `;
  }

  private cardCostLabel(card: CardDefinition): string {
    return `MP ${card.cost}`;
  }

  private cardChainRead(
    card: CardDefinition,
    snapshot: GameSnapshot
  ): HudCardChainRead {
    return hudCardChainRead(card, snapshot);
  }

  private chainRouteLabel(snapshot: GameSnapshot): string {
    const lastCost = snapshot.player.lastPlayedCost;
    if (lastCost === null) {
      return '0?';
    }

    const chainLength = Math.max(1, snapshot.player.costChainMultiplier);
    const firstCost = Math.max(0, lastCost - chainLength + 1);
    const costs = Array.from({ length: chainLength }, (_, index) => `${firstCost + index}`);
    return costs.join('>');
  }

  private enemyIntentSummary(snapshot: GameSnapshot): { totalDamage: number; detail: string } {
    const intentIds =
      snapshot.enemyIntentSummary.intentEnemyIds.length > 0
        ? snapshot.enemyIntentSummary.intentEnemyIds
        : snapshot.enemyIntents.map((intent) => intent.enemyId);
    const intentLabels = intentIds
      .map((enemyId) => {
        const intent = snapshot.enemyIntents.find((item) => item.enemyId === enemyId);
        if (!intent) {
          return null;
        }
        const enemy = snapshot.enemies.find((item) => item.id === enemyId);
        return `${enemy?.name ?? enemyId} ${intent.amount}`;
      })
      .filter((label): label is string => Boolean(label));
    const detail =
      intentLabels.length > 0
        ? intentLabels.slice(0, 2).join(' / ') + (intentLabels.length > 2 ? ` / +${intentLabels.length - 2}` : '')
        : '无前排攻击';
    return { totalDamage: snapshot.enemyIntentSummary.totalDamage, detail };
  }

  private payoffPreviewLabel(snapshot: GameSnapshot): { title: string; detail: string } {
    const candidates = snapshot.player.hand
      .map((cardId) => cards[cardId])
      .filter((card): card is CardDefinition => Boolean(card))
      .filter((card) => this.isPayoffCard(card) && hudCardPaymentRead(card, snapshot).playable)
      .map((card) => ({ card, chain: this.cardChainRead(card, snapshot) }))
      .sort((left, right) => right.chain.multiplier - left.chain.multiplier || right.card.damage - left.card.damage);

    const best = candidates[0];
    if (!best) {
      const authorization = hudAuthorizationState(snapshot);
      return authorization.active
        ? { title: '授权就绪', detail: `${authorization.label} · 等终结` }
        : { title: '终结未授权', detail: '先0>1>2' };
    }

    return {
      title: `${best.card.name} x${best.chain.multiplier}`,
      detail: this.cardPayoffLabel(best.card, best.chain.multiplier, snapshot) || this.cardEffectLabel(best.card, best.chain.multiplier)
    };
  }

  private cardPayoffLabel(card: CardDefinition, multiplier: number, snapshot: GameSnapshot): string {
    if (!this.isPayoffCard(card)) {
      return '';
    }

    if (card.damage <= 0 && !card.drawCards) {
      return '';
    }

    const damage = card.damage > 0 ? `${this.damageScopeLabel(card.targets)} ${card.damage * multiplier}` : '';
    const draw = card.drawCards ? `抽${card.drawCards}` : '';
    const parts = [damage, draw].filter(Boolean);
    const authorization = hudAuthorizationState(snapshot);
    if (isHudAuthorizationPayoffCard(card) && authorization.active) {
      return [`授权终结x${multiplier}`, ...parts].join(' · ');
    }

    if (isHudAuthorizationPayoffCard(card)) {
      return [`未授权x${multiplier}`, ...parts].join(' · ');
    }

    return [`终结x${multiplier}`, ...parts].join(' · ');
  }

  private isPayoffCard(card: CardDefinition): boolean {
    return isHudAuthorizationPayoffCard(card) || card.targets === 'all-enemies';
  }

  private cardEffectLabel(card: CardDefinition, multiplier = 1): string {
    if (card.drawCards && multiplier > 1) {
      const drawLabel = `抽${card.drawCards * multiplier}`;
      if (card.energyGain && card.energyGainCondition === 'chain-repaired') {
        return `${drawLabel} MP+${card.energyGain}`;
      }
      return card.utilities?.includes('reorder') ? `${drawLabel} 整备` : drawLabel;
    }

    if (card.mobileEffect) {
      return card.mobileEffect;
    }

    const effects: string[] = [];

    if (card.damage > 0) {
      effects.push(`${this.damageScopeLabel(card.targets)} ${card.damage}伤害`);
    }

    if (card.drawCards) {
      effects.push(`抽${card.drawCards}`);
    }

    if (card.energyGain) {
      effects.push(card.energyGainCondition === 'chain-repaired' ? `修补MP+${card.energyGain}` : `MP+${card.energyGain}`);
    }

    return effects.length > 0 ? effects.join(' · ') : this.targetLabel(card.targets);
  }

  private visibleCardDescription(description: string): string {
    const cleaned = description.trim();
    return (
      cleaned
        .replace(/payoff/gi, '终结牌')
        .replace(/重排路线/g, '整备找牌')
        .replace(/重排/g, '整备')
        .replace(/不提供永久 MP 成长/g, '只影响本回合链路')
        .replace(/不会提高后续回合 MP 上限/g, '不会保留到后续回合')
        .replace(/不代表永久 MP 成长/g, '不会保留到局外')
        .replace(/不是 Max MP \+1/g, '不会保留到后续回合') || '按费用顺序出牌可提高连锁倍率。'
    );
  }

  private cardRulesText(card: CardDefinition): string {
    return card.rulesText || this.cardEffectLabel(card);
  }

  private cardDetailText(card: CardDefinition): string {
    return card.detail || this.visibleCardDescription(card.description);
  }

  private damageScopeLabel(targets: CardDefinition['targets']): string {
    if (targets === 'front-row') {
      return '前排';
    }

    if (targets === 'all-enemies') {
      return '全场';
    }

    return '单体';
  }

  private targetLabel(targets: string): string {
    if (targets === 'front-row') {
      return '前排';
    }

    if (targets === 'all-enemies') {
      return '全场';
    }

    if (targets === 'self') {
      return '自身';
    }

    return '默认';
  }

  private validSelectedTargetId(snapshot = this.snapshot): string | null {
    return this.validSelectedTargetIdFor(this.selectedTargetId, snapshot);
  }

  private validSelectedTargetIdFor(targetId: string | null | undefined, snapshot = this.snapshot): string | null {
    return validHudSelectedTargetId(targetId, snapshot?.enemies);
  }

  private enemyTypeMeta(definitionId: string): { label: string; className: string } {
    if (definitionId === 'redline_brute') {
      return { label: 'BRU', className: 'enemy-type-brute' };
    }

    if (definitionId === 'pulse_collector') {
      return { label: 'COL', className: 'enemy-type-collector' };
    }

    return { label: 'WSP', className: 'enemy-type-wisp' };
  }

  private combatEventLabel(event: GameEvent, snapshot: GameSnapshot): string | null {
    const lifecycleLabel = hudEventFeedbackLabel(event);
    if (lifecycleLabel) {
      return lifecycleLabel;
    }

    if (event.type === 'HandDealt') {
      return `发牌 ${event.cardIds.length} 张，进入出牌`;
    }

    if (event.type === 'CardPlayed') {
      const card = cards[event.cardId];
      const destinationLabel = card ? ` -> ${hudCardPlayDestinationLabel(card)}` : '';
      const drawCount = card?.drawCards ? card.drawCards * event.effectMultiplier : 0;
      const repairLabel = event.chainRepaired && event.repairedCost !== undefined ? ` · 修补MP${event.repairedCost}` : '';
      const extensionLabel = event.chainExtended && event.extendedCost !== undefined ? ` · 延MP${event.extendedCost}` : '';
      const energyLabel =
        card?.energyGain && card.energyGainCondition === 'chain-repaired' && event.chainRepaired
          ? ` · MP+${card.energyGain}`
          : '';
      return `出牌 ${card?.name ?? event.cardId}${destinationLabel} · x${event.effectMultiplier}${repairLabel}${extensionLabel}${drawCount > 0 ? ` · 抽${drawCount}` : ''}${energyLabel}`;
    }

    if (event.type === 'ChainExtended') {
      return `延链MP${event.extendedCost} x${event.multiplier}`;
    }

    if (event.type === 'PayoffTopdecked') {
      return '整备：顶终结';
    }

    if (event.type === 'PayoffTopdeckMissed') {
      return '整备无牌';
    }

    if (event.type === 'TurnEnded') {
      return `结束回合 ${event.round}，前排反击`;
    }

    if (event.type === 'EnemyAttacked') {
      const enemy = snapshot.enemies.find((item) => item.id === event.enemyId);
      return `${enemy?.name ?? event.enemyId} 攻击 -${event.amount} HP`;
    }

    if (event.type === 'DamageApplied') {
      const enemy = snapshot.enemies.find((item) => item.id === event.targetId);
      return `命中 ${enemy?.name ?? event.targetId} -${event.amount}，剩 ${event.remainingHp}`;
    }

    if (event.type === 'EnemyKilled') {
      const enemy = snapshot.enemies.find((item) => item.id === event.enemyId);
      return `击杀 ${enemy?.name ?? event.enemyId}，后排压上`;
    }

    if (event.type === 'XpGained') {
      return `经验 +${event.amount}，当前 ${event.totalXp}`;
    }

    if (event.type === 'LevelUpReached') {
      return `升级到 LV ${event.level}，选择奖励`;
    }

    if (event.type === 'RewardChosen') {
      return `获得新牌 ${cards[event.cardId]?.name ?? event.cardId}`;
    }

    if (event.type === 'EnemiesRepositioned') {
      return '敌群补位完成，后排压上';
    }

    if (event.type === 'RoundStarted') {
      return `回合 ${event.round} 开始`;
    }

    if (event.type === 'ClearBurstRequested') {
      return '全场处刑触发';
    }

    return null;
  }

  getSnapshot(): GameSnapshot | null {
    return this.snapshot;
  }
}
