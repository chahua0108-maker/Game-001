import { cards } from '../data/cards';
import { rewardBranchesForCard } from './rewardChoices';
import type {
  BuildPlan,
  BuildPlanIssue,
  BuildPlanIssueId,
  BuildPlanIssueLabel,
  CardDefinition,
  CardId,
  PlayerState,
  RunRewardHistoryEntry,
  WorldState
} from './types';

type BuildPlanIssueDraft = Omit<BuildPlanIssue, 'priority'> & {
  priorityAdjustment?: number;
};
type PlayerCardZone = Extract<
  keyof PlayerState,
  'deck' | 'hand' | 'drawPile' | 'discardPile' | 'exhaustPile' | 'retainedCards'
>;

const PLAYER_CARD_ZONES: readonly { key: PlayerCardZone; label: string }[] = [
  { key: 'hand', label: '手牌' },
  { key: 'drawPile', label: '抽牌堆' },
  { key: 'discardPile', label: '弃牌堆' },
  { key: 'retainedCards', label: '保留区' },
  { key: 'exhaustPile', label: '消耗区' },
  { key: 'deck', label: '牌组' }
];

const ISSUE_PRIORITY: Record<BuildPlanIssueId, number> = {
  'upgrade-key-card': 5,
  'clear-pollution': 10,
  'missing-bridge': 20,
  'missing-finisher': 30,
  'need-resource': 40
};

const LABEL_BY_ISSUE: Record<BuildPlanIssueId, BuildPlanIssueLabel> = {
  'missing-bridge': '缺桥',
  'missing-finisher': '缺终结',
  'clear-pollution': '清污染',
  'need-resource': '补资源',
  'upgrade-key-card': '强化关键牌'
};

export function createBuildPlan(world: WorldState): BuildPlan {
  const issues = [
    upgradeKeyCardIssue(world),
    clearPollutionIssue(world),
    missingBridgeIssue(world),
    missingFinisherIssue(world),
    needResourceIssue(world)
  ]
    .filter((issue): issue is BuildPlanIssueDraft => Boolean(issue))
    .map((issue) => {
      const { priorityAdjustment = 0, ...buildPlanIssue } = issue;
      return {
        ...buildPlanIssue,
        priority: ISSUE_PRIORITY[issue.id] + priorityAdjustment
      };
    })
    .sort((left, right) => left.priority - right.priority);

  return {
    summary: issues.length > 0 ? issues.map((issue) => issue.label).join(' / ') : '构筑路线稳定',
    issues
  };
}

function upgradeKeyCardIssue(world: WorldState): BuildPlanIssueDraft | null {
  if (!world.cardUpgrades.pending || world.cardUpgrades.choices.length === 0) {
    return null;
  }

  const rankedChoices = [...world.cardUpgrades.choices].sort((left, right) => {
    if (right.damageBonusPreview !== left.damageBonusPreview) {
      return right.damageBonusPreview - left.damageBonusPreview;
    }
    return cardDamage(right.targetCardId) - cardDamage(left.targetCardId);
  });
  const [bestChoice] = rankedChoices;

  if (!bestChoice) {
    return null;
  }

  const cardName = cardLabel(bestChoice.targetCardId);

  return issue('upgrade-key-card', {
    reason: `当前有局内强化可选，${cardName} 能直接提高关键伤害段。`,
    nextStep: `选择 ${bestChoice.label}，优先把稳定出手的伤害牌做成清怪锚点。`,
    evidence: [
      `强化选项 ${bestChoice.label}`,
      `预览伤害 +${bestChoice.damageBonusPreview}`,
      ...evolutionEvidence(world)
    ],
    recommendedCardIds: [bestChoice.targetCardId],
    recommendedUpgradeChoiceIds: [bestChoice.id]
  });
}

function clearPollutionIssue(world: WorldState): BuildPlanIssueDraft | null {
  const pollutionCount = allPlayerCards(world).filter(isPollutionBurden).length;

  if (pollutionCount === 0) {
    return null;
  }

  const recommendations = rewardChoices(world).filter((cardId) => {
    const card = cards[cardId];
    return Boolean(card && (card.id === 'silt_purge' || (card.cardType !== 'status' && cardHasTag(cardId, 'exhaust'))));
  });
  const cleanupTools = cleanupToolsInDeck(world);
  const hasCleanupPlan = cleanupTools.length > 0;
  const cleanupToolNames = cleanupTools.map(cardLabel).join(', ');

  return issue('clear-pollution', {
    reason: hasCleanupPlan
      ? `牌区里仍有 ${pollutionCount} 张污染状态牌，但已经拿到 ${cleanupToolNames}，现在重点是把清污工具打进关键回合。`
      : `牌组区域里有 ${pollutionCount} 张污染牌，坏手会挤掉 0-1-2 链和终结窗口。`,
    nextStep: hasCleanupPlan
      ? `下一战优先打出 ${cleanupToolNames}，让污染退出抽牌循环，再回头修费用链。`
      : '优先拿净化、抽牌或消耗工具，先把污染从关键回合里清出去。',
    evidence: [
      `污染牌数量 ${pollutionCount}`,
      ...pollutionZoneEvidence(world),
      ...(hasCleanupPlan ? [`已拿清污工具 ${cleanupToolNames}`] : []),
      ...rewardEvidence(world),
      ...evolutionEvidence(world)
    ],
    recommendedCardIds: recommendations,
    recommendedUpgradeChoiceIds: [],
    priorityAdjustment: pollutionPriorityAdjustment(pollutionCount, hasCleanupPlan)
  });
}

function missingBridgeIssue(world: WorldState): BuildPlanIssueDraft | null {
  const deckCards = deckCardsInDefinition(world);
  const requiredChainCount = densityRequirement(deckCards.length);
  const openerCount = deckCards.filter((card) => card.cost === 0 && countsForChain(card)).length;
  const connectorCount = deckCards.filter((card) => card.cost === 1 && countsForChain(card)).length;
  const routeSegmentCount = deckCards.filter((card) => card.cost === 2 && countsForChain(card)).length;

  if (
    openerCount >= requiredChainCount &&
    connectorCount >= requiredChainCount &&
    routeSegmentCount >= requiredChainCount
  ) {
    return null;
  }

  const recommendations = rewardChoices(world).filter((cardId) => {
    const card = cards[cardId];
    return Boolean(
      card &&
        (card.rewardBranches?.includes('route-bridge') ||
          card.cycleRole === 'connector' ||
          card.cycleRole === 'route-segment' ||
          card.cycleRole === 'wild-fixer')
    );
  });

  const recentReward = latestRewardPick(world);
  const recentRewardCard = recentReward ? cards[recentReward.selectedCardId] : null;
  const recentlyPickedBridge =
    recentRewardCard &&
    (recentRewardCard.rewardBranches?.includes('route-bridge') ||
      recentRewardCard.cycleRole === 'connector' ||
      recentRewardCard.cycleRole === 'route-segment' ||
      recentRewardCard.cycleRole === 'wild-fixer');

  return issue('missing-bridge', {
    reason: recentlyPickedBridge
      ? `刚补过 ${cardLabel(recentReward!.selectedCardId)}，但 ${deckCards.length} 张牌组仍未达到费用链密度：0费 ${openerCount}/${requiredChainCount}，1费 ${connectorCount}/${requiredChainCount}，2费 ${routeSegmentCount}/${requiredChainCount}。`
      : `当前 ${deckCards.length} 张牌组费用链密度不足：0费 ${openerCount}/${requiredChainCount}，1费 ${connectorCount}/${requiredChainCount}，2费 ${routeSegmentCount}/${requiredChainCount}。`,
    nextStep: recentlyPickedBridge
      ? '继续补缺失费用段或 wild 修补牌；如果同时出现 payoff，这是稳定桥牌和提前兑现之间的小分叉。'
      : '优先拿低费接链或 wild 修补牌；D2-D3 若同时出现终结牌，就是稳定桥牌 vs 高压兑现的分叉。',
    evidence: [
      `牌组张数 ${deckCards.length}`,
      `费用链密度阈值 ${requiredChainCount}`,
      `0费链牌 ${openerCount}/${requiredChainCount}`,
      `1费链牌 ${connectorCount}/${requiredChainCount}`,
      `2费链牌 ${routeSegmentCount}/${requiredChainCount}`,
      ...rewardForkEvidence(world),
      ...routeEvidence(world),
      ...rewardHistoryEvidence(world),
      ...upgradeHistoryEvidence(world)
    ],
    recommendedCardIds: recommendations,
    recommendedUpgradeChoiceIds: []
  });
}

function missingFinisherIssue(world: WorldState): BuildPlanIssueDraft | null {
  const deckCards = deckCardsInDefinition(world);
  const requiredFinisherCount = densityRequirement(deckCards.length);
  const finisherCount = deckCards.filter(isFinisher).length;

  if (finisherCount >= requiredFinisherCount) {
    return null;
  }

  const recommendations = rewardChoices(world).filter((cardId) => {
    const card = cards[cardId];
    return Boolean(card && (card.cardType === 'payoff' || card.rewardBranches?.includes('payoff')));
  });

  return issue('missing-finisher', {
    reason:
      finisherCount === 0
        ? '当前牌组能组织路线，但没有 3 MP payoff 终结牌来消费授权窗口。'
        : `当前 ${deckCards.length} 张牌组只有 ${finisherCount}/${requiredFinisherCount} 张终结牌，D2-D3 抽牌变厚后高压兑现不稳定。`,
    nextStep:
      finisherCount === 0
        ? '优先拿全场终结牌，让完成 0-1-2 后的授权能转化为清场。'
        : '如果桥牌已经能稳住节奏，可以提前拿 payoff；否则把它当作和稳定桥牌并列的高压兑现分叉。',
    evidence: [
      `牌组张数 ${deckCards.length}`,
      `终结密度阈值 ${requiredFinisherCount}`,
      `终结牌 ${finisherCount}/${requiredFinisherCount}`,
      ...rewardEvidence(world),
      ...rewardForkEvidence(world),
      ...evolutionEvidence(world)
    ],
    recommendedCardIds: recommendations,
    recommendedUpgradeChoiceIds: []
  });
}

function needResourceIssue(world: WorldState): BuildPlanIssueDraft | null {
  const deckCards = deckCardsInDefinition(world);
  const hasFinisher = deckCards.some(isFinisher);
  const requiredResourceCount = densityRequirement(deckCards.length);
  const resourceCount = deckCards.filter(isResourceFixer).length;

  if (!hasFinisher || resourceCount >= requiredResourceCount) {
    return null;
  }

  const recommendations = rewardChoices(world).filter((cardId) => {
    const card = cards[cardId];
    return Boolean(
      card &&
        (card.rewardBranches?.includes('repair-resource') ||
          card.drawCards ||
          card.energyGain ||
          card.utilities?.some((utility) => utility === 'draw' || utility === 'mana' || utility === 'wild'))
    );
  });

  return issue('need-resource', {
    reason:
      resourceCount === 0
        ? '牌组已有终结压力，但缺少抽牌、修补或返 MP 工具，容易摸不到终结或断在中段。'
        : `当前 ${deckCards.length} 张牌组只有 ${resourceCount}/${requiredResourceCount} 张抽牌、修补或返 MP 工具，厚牌组里还不足以支撑终结回合。`,
    nextStep: '补抽牌、wild 修补或返 MP 牌；和 payoff 同屏时形成“先稳桥牌/资源”或“提前高压兑现”的选择。',
    evidence: [
      `牌组张数 ${deckCards.length}`,
      `资源密度阈值 ${requiredResourceCount}`,
      `资源修正牌 ${resourceCount}/${requiredResourceCount}`,
      ...rewardEvidence(world),
      ...rewardForkEvidence(world),
      ...evolutionEvidence(world)
    ],
    recommendedCardIds: recommendations,
    recommendedUpgradeChoiceIds: []
  });
}

function issue(
  id: BuildPlanIssueId,
  data: Omit<BuildPlanIssueDraft, 'id' | 'label'>
): BuildPlanIssueDraft {
  return {
    id,
    label: LABEL_BY_ISSUE[id],
    ...data
  };
}

function allPlayerCards(world: WorldState): CardId[] {
  return [
    ...world.player.deck,
    ...world.player.hand,
    ...world.player.drawPile,
    ...world.player.discardPile,
    ...world.player.exhaustPile,
    ...world.player.retainedCards
  ];
}

function cleanupToolsInDeck(world: WorldState): CardId[] {
  return world.player.deck.filter((cardId) => {
    const card = cards[cardId];
    return Boolean(card && (card.id === 'silt_purge' || (card.cardType !== 'status' && cardHasTag(cardId, 'exhaust'))));
  });
}

function deckCardsInDefinition(world: WorldState): CardDefinition[] {
  return world.player.deck.map((cardId) => cards[cardId]).filter((card): card is CardDefinition => Boolean(card));
}

function rewardChoices(world: WorldState): CardId[] {
  if (!world.reward.pending) {
    return [];
  }
  return world.reward.choices.filter((cardId) => Boolean(cards[cardId]));
}

function rewardEvidence(world: WorldState): string[] {
  return rewardChoices(world).length > 0 ? [`奖励候选 ${rewardChoices(world).map(cardLabel).join(', ')}`] : [];
}

function rewardForkEvidence(world: WorldState): string[] {
  const choices = rewardChoices(world);
  if (choices.length === 0) {
    return [];
  }

  const used = new Set<CardId>();
  const drawChain = choices.find((cardId) => {
    const card = cards[cardId];
    return Boolean(
      card &&
        rewardBranchesForCard(card).has('route-bridge') &&
        (card.drawCards || card.utilities?.includes('draw') || card.buildRole === 'draw-fixer')
    );
  });
  if (drawChain) {
    used.add(drawChain);
  }

  const repair = choices.find((cardId) => {
    const card = cards[cardId];
    return Boolean(card && !used.has(cardId) && rewardBranchesForCard(card).has('repair-resource'));
  });
  if (repair) {
    used.add(repair);
  }

  const payoff = choices.find((cardId) => {
    const card = cards[cardId];
    return Boolean(card && !used.has(cardId) && rewardBranchesForCard(card).has('payoff'));
  });

  if (!drawChain || !repair || !payoff) {
    return [];
  }

  return [
    `奖励分叉 抽牌续链: ${displayCardLabel(drawChain)} / 修补保命: ${displayCardLabel(repair)} / 终结爆发: ${displayCardLabel(payoff)}`
  ];
}

function routeEvidence(world: WorldState): string[] {
  const pending = world.route?.pendingNodeChoices ?? [];
  const context = world.route?.nextBattleContext;
  return [
    ...routeHistoryEvidence(world),
    ...(context ? [`当前路线倾向 ${context.rewardBranchHint}`] : []),
    ...(pending.length > 0 ? [`路线候选 ${pending.map((candidate) => candidate.label).join(', ')}`] : [])
  ];
}

function evolutionEvidence(world: WorldState): string[] {
  return [...rewardHistoryEvidence(world), ...routeHistoryEvidence(world), ...upgradeHistoryEvidence(world)];
}

function rewardHistoryEvidence(world: WorldState): string[] {
  const latest = latestRewardPick(world);
  return latest ? [`最近奖励选择 ${cardLabel(latest.selectedCardId)}`] : [];
}

function routeHistoryEvidence(world: WorldState): string[] {
  const history = world.route?.history ?? [];
  const latest = history.length > 0 ? history[history.length - 1] : undefined;
  return latest ? [`上次路线 ${latest.context.label} -> ${latest.context.rewardBranchHint}`] : [];
}

function upgradeHistoryEvidence(world: WorldState): string[] {
  const history = world.cardUpgrades.history;
  const latest = history.length > 0 ? history[history.length - 1] : undefined;
  return latest ? [`最近强化 ${cardLabel(latest.cardId)} Lv${latest.level}`] : [];
}

function latestRewardPick(world: WorldState): RunRewardHistoryEntry | null {
  for (let index = world.run.rewardHistory.length - 1; index >= 0; index -= 1) {
    const entry = world.run.rewardHistory[index];
    if (entry.runNumber === world.run.runNumber) {
      return entry;
    }
  }

  return null;
}

function pollutionZoneEvidence(world: WorldState): string[] {
  const zoneCounts = PLAYER_CARD_ZONES.map(({ key, label }) => {
    const count = world.player[key].filter(isPollutionBurden).length;
    return { label, count };
  }).filter(({ count }) => count > 0);

  if (zoneCounts.length === 0) {
    return [];
  }

  return [`污染分布 ${zoneCounts.map(({ label, count }) => `${label} ${count}`).join(' / ')}`];
}

function pollutionPriorityAdjustment(pollutionCount: number, hasCleanupPlan: boolean): number {
  if (hasCleanupPlan && pollutionCount <= 1) {
    return 15;
  }

  if (hasCleanupPlan) {
    return 10;
  }

  return pollutionCount >= 2 ? -5 : 0;
}

function densityRequirement(deckSize: number): number {
  if (deckSize >= 15) {
    return 3;
  }

  if (deckSize >= 9) {
    return 2;
  }

  return 1;
}

function countsForChain(card: CardDefinition): boolean {
  return card.countsForChain !== false && card.cardType !== 'status' && card.buildRole !== 'reserve-test';
}

function isFinisher(card: CardDefinition): boolean {
  return card.cycleRole === 'finisher' || card.buildRole === 'payoff-finisher' || card.cardType === 'payoff';
}

function isResourceFixer(card: CardDefinition): boolean {
  return Boolean(
    card.drawCards ||
      card.energyGain ||
      card.cardType === 'repair' ||
      card.cardType === 'resource' ||
      card.chainRole === 'repair' ||
      card.utilities?.some((utility) => utility === 'draw' || utility === 'mana' || utility === 'wild') ||
      card.buildRole === 'draw-fixer' ||
      card.buildRole === 'wild-fixer'
  );
}

function isPollutionBurden(cardId: CardId): boolean {
  const card = cards[cardId];
  return Boolean(card && card.cardType === 'status' && card.mechanicTags?.includes('pollution'));
}

function cardHasTag(cardId: CardId, tag: NonNullable<CardDefinition['mechanicTags']>[number]): boolean {
  return Boolean(cards[cardId]?.mechanicTags?.includes(tag));
}

function cardDamage(cardId: CardId): number {
  return cards[cardId]?.damage ?? 0;
}

function cardLabel(cardId: CardId): string {
  return cards[cardId]?.name ?? cardId;
}

function displayCardLabel(cardId: CardId): string {
  const card = cards[cardId];
  return card?.displayName ?? card?.name ?? cardId;
}
