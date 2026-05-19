import { cards } from '../data/cards';
import type {
  BuildPlan,
  BuildPlanIssue,
  BuildPlanIssueId,
  BuildPlanIssueLabel,
  CardDefinition,
  CardId,
  WorldState
} from './types';

type BuildPlanIssueDraft = Omit<BuildPlanIssue, 'priority'>;

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
    .map((issue) => ({
      ...issue,
      priority: ISSUE_PRIORITY[issue.id]
    }))
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
    evidence: [`强化选项 ${bestChoice.label}`, `预览伤害 +${bestChoice.damageBonusPreview}`],
    recommendedCardIds: [bestChoice.targetCardId],
    recommendedUpgradeChoiceIds: [bestChoice.id]
  });
}

function clearPollutionIssue(world: WorldState): BuildPlanIssueDraft | null {
  const pollutionCount = allPlayerCards(world).filter((cardId) => cardHasTag(cardId, 'pollution')).length;

  if (pollutionCount === 0) {
    return null;
  }

  const recommendations = rewardChoices(world).filter((cardId) => {
    const card = cards[cardId];
    return Boolean(card && (card.id === 'silt_purge' || (card.cardType !== 'status' && cardHasTag(cardId, 'exhaust'))));
  });

  return issue('clear-pollution', {
    reason: `牌组区域里有 ${pollutionCount} 张污染牌，坏手会挤掉 0-1-2 链和终结窗口。`,
    nextStep: '优先拿净化、抽牌或消耗工具，先把污染从关键回合里清出去。',
    evidence: [`污染牌数量 ${pollutionCount}`, ...rewardEvidence(world)],
    recommendedCardIds: recommendations,
    recommendedUpgradeChoiceIds: []
  });
}

function missingBridgeIssue(world: WorldState): BuildPlanIssueDraft | null {
  const deckCards = deckCardsInDefinition(world);
  const openerCount = deckCards.filter((card) => card.cost === 0 && countsForChain(card)).length;
  const connectorCount = deckCards.filter((card) => card.cost === 1 && countsForChain(card)).length;
  const routeSegmentCount = deckCards.filter((card) => card.cost === 2 && countsForChain(card)).length;

  if (openerCount > 0 && connectorCount > 0 && routeSegmentCount > 0) {
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

  return issue('missing-bridge', {
    reason: `当前牌组费用链密度不足：0费 ${openerCount}，1费 ${connectorCount}，2费 ${routeSegmentCount}。`,
    nextStep: '优先拿低费接链或 wild 修补牌，让 0-1-2 授权链稳定成型。',
    evidence: [`0费链牌 ${openerCount}`, `1费链牌 ${connectorCount}`, `2费链牌 ${routeSegmentCount}`, ...routeEvidence(world)],
    recommendedCardIds: recommendations,
    recommendedUpgradeChoiceIds: []
  });
}

function missingFinisherIssue(world: WorldState): BuildPlanIssueDraft | null {
  const hasFinisher = deckCardsInDefinition(world).some(
    (card) => card.cycleRole === 'finisher' || card.buildRole === 'payoff-finisher' || card.cardType === 'payoff'
  );

  if (hasFinisher) {
    return null;
  }

  const recommendations = rewardChoices(world).filter((cardId) => {
    const card = cards[cardId];
    return Boolean(card && (card.cardType === 'payoff' || card.rewardBranches?.includes('payoff')));
  });

  return issue('missing-finisher', {
    reason: '当前牌组能组织路线，但没有 3 MP payoff 终结牌来消费授权窗口。',
    nextStep: '优先拿全场终结牌，让完成 0-1-2 后的授权能转化为清场。',
    evidence: ['终结牌 0', ...rewardEvidence(world)],
    recommendedCardIds: recommendations,
    recommendedUpgradeChoiceIds: []
  });
}

function needResourceIssue(world: WorldState): BuildPlanIssueDraft | null {
  const deckCards = deckCardsInDefinition(world);
  const hasFinisher = deckCards.some((card) => card.cardType === 'payoff' || card.cycleRole === 'finisher');
  const resourceCount = deckCards.filter(
    (card) =>
      card.drawCards ||
      card.energyGain ||
      card.utilities?.some((utility) => utility === 'draw' || utility === 'mana' || utility === 'wild') ||
      card.buildRole === 'draw-fixer' ||
      card.buildRole === 'wild-fixer'
  ).length;

  if (!hasFinisher || resourceCount > 0) {
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
    reason: '牌组已有终结压力，但缺少抽牌、修补或返 MP 工具，容易摸不到终结或断在中段。',
    nextStep: '补抽牌、wild 修补或返 MP 牌，让终结牌更常出现在授权回合。',
    evidence: [`资源修正牌 ${resourceCount}`, ...rewardEvidence(world)],
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

function routeEvidence(world: WorldState): string[] {
  const pending = world.route?.pendingNodeChoices ?? [];
  const context = world.route?.nextBattleContext;
  return [
    ...(context ? [`当前路线倾向 ${context.rewardBranchHint}`] : []),
    ...(pending.length > 0 ? [`路线候选 ${pending.map((candidate) => candidate.label).join(', ')}`] : [])
  ];
}

function countsForChain(card: CardDefinition): boolean {
  return card.countsForChain !== false && card.cardType !== 'status';
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
