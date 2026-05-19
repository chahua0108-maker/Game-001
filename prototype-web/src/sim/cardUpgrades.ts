import { cards } from '../data/cards';
import type {
  CardEnhancement,
  CardGemColor,
  CardGemId,
  CardId,
  CardUpgradeChoice,
  CardUpgradeChoiceType,
  CardUpgradeState,
  GameEvent,
  TraceId,
  WorldState
} from './types';

const DEFAULT_DAMAGE_PER_LEVEL = 2;
const DEFAULT_MAX_LEVEL = 2;
const DEFAULT_MAX_GEM_SLOTS = 2;
const DEFAULT_GEM_COLORS: CardGemColor[] = ['red'];
const CARD_UPGRADE_REWARD_PREFIX = 'card-upgrade-choice:';

const gemDamageBonus: Record<CardGemId, number> = {
  crimson_chip: 3,
  tempo_lens: 0,
  ledger_seal: 0
};

type VisibleCardUpgradeChoice = CardUpgradeChoice & {
  preview: string;
  reason: string;
  buildPlanReason: string;
};

export function createInitialCardUpgradeState(): CardUpgradeState {
  return {
    enhancements: {},
    choices: [],
    pending: false,
    history: []
  };
}

function isUpgradeableCard(cardId: CardId): boolean {
  const card = cards[cardId];
  return Boolean(card && card.damage > 0 && card.cardType !== 'status');
}

function upgradeConfig(cardId: CardId) {
  const card = cards[cardId];
  return {
    maxLevel: card?.runUpgrade?.maxLevel ?? DEFAULT_MAX_LEVEL,
    damagePerLevel: card?.runUpgrade?.damagePerLevel ?? DEFAULT_DAMAGE_PER_LEVEL,
    maxGemSlots: card?.runUpgrade?.maxGemSlots ?? DEFAULT_MAX_GEM_SLOTS,
    allowedGemColors: card?.runUpgrade?.allowedGemColors ?? DEFAULT_GEM_COLORS
  };
}

function cloneGemSlots(enhancement: CardEnhancement): CardEnhancement['gemSlots'] {
  return enhancement.gemSlots.map((slot) => ({ ...slot }));
}

function ensureEnhancement(state: CardUpgradeState, cardId: CardId): CardEnhancement {
  const existing = state.enhancements[cardId];
  if (existing) {
    return existing;
  }

  const created: CardEnhancement = {
    cardId,
    level: 0,
    gemSlots: []
  };
  state.enhancements[cardId] = created;
  return created;
}

function readEnhancement(state: CardUpgradeState, cardId: CardId): CardEnhancement {
  return (
    state.enhancements[cardId] ?? {
      cardId,
      level: 0,
      gemSlots: []
    }
  );
}

function choiceId(traceId: TraceId, cardId: CardId, type: CardUpgradeChoiceType, suffix = '0'): string {
  return `${traceId}:${cardId}:${type}:${suffix}`;
}

function damagePreviewText(currentDamage: number, nextDamage: number): string {
  return `${currentDamage} -> ${nextDamage} damage this run`;
}

function buildVisibleUpgradeChoice(
  choice: CardUpgradeChoice,
  currentDamage: number,
  nextDamage: number
): VisibleCardUpgradeChoice {
  if (choice.type === 'raise-level') {
    return {
      ...choice,
      preview: damagePreviewText(currentDamage, nextDamage),
      reason: `upgrade ${choice.targetCardId} because it is already in deck and gains +${choice.damageBonusPreview} repeatable damage`,
      buildPlanReason: `Make ${choice.targetCardId} a stronger repeatable front-target damage card for the current run.`
    };
  }

  if (choice.type === 'add-gem-slot') {
    return {
      ...choice,
      preview: `opens ${choice.gemColor ?? 'red'} gem slot; damage unchanged until socketed`,
      reason: `prepare ${choice.targetCardId} for a ${choice.gemColor ?? 'red'} damage gem because it has no empty slot yet`,
      buildPlanReason: `Prepare ${choice.targetCardId} for a later socketed gem instead of taking immediate damage.`
    };
  }

  return {
    ...choice,
    preview: damagePreviewText(currentDamage, nextDamage),
    reason: `socket ${choice.gemId ?? 'gem'} into ${choice.targetCardId} because an empty ${choice.gemColor ?? 'red'} slot is available for +${choice.damageBonusPreview} damage`,
    buildPlanReason: `Turn ${choice.targetCardId} into the current run damage carry by using the prepared ${choice.gemColor ?? 'red'} slot.`
  };
}

export function isCardUpgradeRewardChoiceId(cardId: CardId): boolean {
  return cardId.startsWith(CARD_UPGRADE_REWARD_PREFIX);
}

export function encodeCardUpgradeRewardChoiceId(choiceIdToEncode: string): CardId {
  return `${CARD_UPGRADE_REWARD_PREFIX}${choiceIdToEncode}`;
}

export function decodeCardUpgradeRewardChoiceId(cardId: CardId): string {
  return isCardUpgradeRewardChoiceId(cardId) ? cardId.slice(CARD_UPGRADE_REWARD_PREFIX.length) : cardId;
}

export function getCardDamageBonus(state: CardUpgradeState, cardId: CardId): number {
  const enhancement = state.enhancements[cardId];
  if (!enhancement) {
    return 0;
  }

  const config = upgradeConfig(cardId);
  const levelBonus = enhancement.level * config.damagePerLevel;
  const gemBonus = enhancement.gemSlots.reduce((total, slot) => total + (slot.gemId ? gemDamageBonus[slot.gemId] : 0), 0);
  return levelBonus + gemBonus;
}

export function getCardModifiedDamage(world: WorldState, cardId: CardId): number {
  const card = cards[cardId];
  return Math.max(0, (card?.damage ?? 0) + getCardDamageBonus(world.cardUpgrades, cardId));
}

function createCardUpgradeChoices(world: WorldState, targetCardId: CardId, traceId: TraceId): CardUpgradeChoice[] {
  const choices: CardUpgradeChoice[] = [];
  const card = cards[targetCardId];

  if (!card || !isUpgradeableCard(targetCardId) || !world.player.deck.includes(targetCardId)) {
    return [];
  }

  const enhancement = readEnhancement(world.cardUpgrades, targetCardId);
  const config = upgradeConfig(targetCardId);
  const currentDamage = Math.max(0, (card.damage ?? 0) + getCardDamageBonus(world.cardUpgrades, targetCardId));

  if (enhancement.level < config.maxLevel) {
    choices.push(
      buildVisibleUpgradeChoice(
        {
          id: choiceId(traceId, targetCardId, 'raise-level'),
          type: 'raise-level',
          targetCardId,
          label: `${card.name} +1`,
          description: `本次冒险内基础伤害 +${config.damagePerLevel}。`,
          damageBonusPreview: config.damagePerLevel
        },
        currentDamage,
        currentDamage + config.damagePerLevel
      )
    );
  }

  if (enhancement.gemSlots.length < config.maxGemSlots) {
    const gemColor = config.allowedGemColors[0] ?? 'red';
    choices.push(
      buildVisibleUpgradeChoice(
        {
          id: choiceId(traceId, targetCardId, 'add-gem-slot', String(enhancement.gemSlots.length)),
          type: 'add-gem-slot',
          targetCardId,
          label: `${card.name} 开槽`,
          description: '新增 1 个本局宝石槽。',
          gemColor,
          damageBonusPreview: 0
        },
        currentDamage,
        currentDamage
      )
    );
  }

  const emptySlotIndex = enhancement.gemSlots.findIndex((slot) => slot.gemId === null && slot.color === 'red');
  if (emptySlotIndex >= 0) {
    choices.push(
      buildVisibleUpgradeChoice(
        {
          id: choiceId(traceId, targetCardId, 'socket-gem', String(emptySlotIndex)),
          type: 'socket-gem',
          targetCardId,
          label: `${card.name} 镶嵌赤片`,
          description: `红槽镶嵌 Crimson Chip，本次冒险内基础伤害 +${gemDamageBonus.crimson_chip}。`,
          gemColor: 'red',
          gemId: 'crimson_chip',
          damageBonusPreview: gemDamageBonus.crimson_chip
        },
        currentDamage,
        currentDamage + gemDamageBonus.crimson_chip
      )
    );
  }

  return choices;
}

function publishCardUpgradeChoices(world: WorldState, targetCardId: CardId, traceId: TraceId, choices: CardUpgradeChoice[]): void {
  world.cardUpgrades.choices = choices;
  world.cardUpgrades.pending = choices.length > 0;
  world.debug.events.push({
    type: 'CardUpgradeChoicesGenerated',
    traceId,
    tick: world.tick,
    targetCardId,
    choices: choices.map((choice) => ({ ...choice }))
  });
}

export function buildCardUpgradeChoices(world: WorldState, targetCardId: CardId, traceId: TraceId): CardUpgradeChoice[] {
  const choices = createCardUpgradeChoices(world, targetCardId, traceId);

  if (choices.length === 0) {
    world.cardUpgrades.choices = [];
    world.cardUpgrades.pending = false;
    return [];
  }

  publishCardUpgradeChoices(world, targetCardId, traceId, choices);

  return choices;
}

export function buildCardUpgradeRewardChoiceIds(world: WorldState, traceId: TraceId, pickCount: number): CardId[] {
  if (pickCount <= 0) {
    world.cardUpgrades.choices = [];
    world.cardUpgrades.pending = false;
    return [];
  }

  const rewardChoices: CardUpgradeChoice[] = [];
  const visited = new Set<CardId>();

  for (const cardId of world.player.deck) {
    if (visited.has(cardId)) {
      continue;
    }
    visited.add(cardId);

    const [nextChoice] = createCardUpgradeChoices(world, cardId, traceId);
    if (nextChoice) {
      rewardChoices.push(nextChoice);
    }
    if (rewardChoices.length >= pickCount) {
      break;
    }
  }

  world.cardUpgrades.choices = rewardChoices;
  world.cardUpgrades.pending = rewardChoices.length > 0;
  if (rewardChoices.length > 0) {
    world.debug.events.push({
      type: 'CardUpgradeChoicesGenerated',
      traceId,
      tick: world.tick,
      targetCardId: rewardChoices[0].targetCardId,
      choices: rewardChoices.map((choice) => ({ ...choice }))
    });
  }

  return rewardChoices.map((choice) => encodeCardUpgradeRewardChoiceId(choice.id));
}

export function clearCardUpgradeChoices(world: WorldState): void {
  world.cardUpgrades.choices = [];
  world.cardUpgrades.pending = false;
}

export function applyCardUpgradeChoice(world: WorldState, choiceIdToApply: string, traceId: TraceId): GameEvent | null {
  const choice = world.cardUpgrades.choices.find((candidate) => candidate.id === choiceIdToApply);
  if (!choice) {
    world.debug.failedConditions.push({
      tick: world.tick,
      traceId,
      ruleId: 'card-upgrade.apply',
      conditionId: 'upgrade-choice',
      reason: `${choiceIdToApply} is not a pending card upgrade choice`
    });
    return null;
  }

  const enhancement = ensureEnhancement(world.cardUpgrades, choice.targetCardId);
  const config = upgradeConfig(choice.targetCardId);

  if (choice.type === 'raise-level') {
    enhancement.level = Math.min(config.maxLevel, enhancement.level + 1);
  }

  if (choice.type === 'add-gem-slot') {
    enhancement.gemSlots.push({ color: choice.gemColor ?? 'red', gemId: null });
  }

  if (choice.type === 'socket-gem') {
    const slot = enhancement.gemSlots.find((candidate) => candidate.color === choice.gemColor && candidate.gemId === null);
    if (slot && choice.gemId) {
      slot.gemId = choice.gemId;
    }
  }

  world.cardUpgrades.history.push({
    tick: world.tick,
    traceId,
    cardId: choice.targetCardId,
    choiceId: choice.id,
    choiceType: choice.type,
    level: enhancement.level,
    gemSlots: cloneGemSlots(enhancement)
  });
  world.cardUpgrades.choices = [];
  world.cardUpgrades.pending = false;

  const event: GameEvent = {
    type: 'CardUpgradeApplied',
    traceId,
    tick: world.tick,
    cardId: choice.targetCardId,
    choiceId: choice.id,
    choiceType: choice.type,
    level: enhancement.level,
    gemSlots: cloneGemSlots(enhancement),
    damageBonus: getCardDamageBonus(world.cardUpgrades, choice.targetCardId)
  };
  world.debug.events.push(event);
  return event;
}
