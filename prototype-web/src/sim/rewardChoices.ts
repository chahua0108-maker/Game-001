import type { CardDefinition, CardId, RewardBranch } from './types';
import {
  rewardResponsePickCount,
  rewardResponsePressuresForProfile,
  rewardResponsePressureSignals,
  rewardResponsePreferredCardIds,
  rewardResponseRolesForProblems,
  type RewardResponsePressure,
  type RewardResponseProfile,
  type RewardResponseRole
} from './rewardProgression';

type CardCatalog = Record<CardId, CardDefinition | undefined>;
type CardWithRewardMetadata = CardDefinition & {
  rewardBranch?: RewardBranch | RewardBranch[];
  rewardCategory?: string | string[];
  rewardCategories?: string[];
  rewardRole?: RewardBranch | RewardBranch[];
  rewardRoles?: RewardBranch[];
  rewardTags?: RewardBranch[];
  archetype?: string | string[];
  categories?: string[];
  role?: string | string[];
  tags?: string[];
};

const BRANCH_PRIORITY: RewardBranch[] = ['repair-resource', 'payoff', 'route-bridge'];
const BALANCED_FALLBACK_PRESSURE_PRIORITY: RewardResponsePressure[] = ['payoff', 'resource', 'bridge', 'pollution'];
const RESPONSE_ROLES_BY_PRESSURE: Record<RewardResponsePressure, RewardResponseRole[]> = {
  pollution: ['cleanse-pollution', 'retain'],
  payoff: ['payoff'],
  bridge: ['wild-bridge', 'low-cost-bridge'],
  resource: ['authorization', 'draw-resource']
};
const BRANCH_BY_PRESSURE: Partial<Record<RewardResponsePressure, RewardBranch>> = {
  payoff: 'payoff',
  bridge: 'route-bridge',
  resource: 'repair-resource'
};
const BRANCH_ALIASES: Record<string, RewardBranch> = {
  'repair-resource': 'repair-resource',
  repair: 'repair-resource',
  resource: 'repair-resource',
  payoff: 'payoff',
  finisher: 'payoff',
  'route-bridge': 'route-bridge',
  bridge: 'route-bridge',
  route: 'route-bridge'
};

const REPAIR_RESOURCE_CARD_IDS = new Set<CardId>(['wild_mana_stitch', 'wild_gap_key', 'blood_tithe', 'pulse_draw']);
const PAYOFF_CARD_IDS = new Set<CardId>(['severance_burst', 'red_ledger_burst']);
const ROUTE_BRIDGE_CARD_IDS = new Set<CardId>([
  'blood_reclaim',
  'spark_tap',
  'redline_cut',
  'heartbeat_spark',
  'verdict_mark',
  'row_cleave',
  'clearance_order',
  'paper_shatter',
  'lantern_captain'
]);
const CLEANSE_CARD_IDS = new Set<CardId>(['burn_after_reading', 'silt_purge', 'ash_filter']);
const CARD_UPGRADE_REWARD_PREFIX = 'card-upgrade-choice:';

function addBranch(branches: Set<RewardBranch>, branch: unknown): void {
  if (typeof branch !== 'string') {
    return;
  }

  const normalized = BRANCH_ALIASES[branch.trim().toLowerCase().replace(/_/g, '-')];
  if (normalized) {
    branches.add(normalized);
  }
}

function addBranchValue(branches: Set<RewardBranch>, value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => addBranch(branches, entry));
    return;
  }

  addBranch(branches, value);
}

function branchesFromMetadata(card: CardDefinition): Set<RewardBranch> {
  const branches = new Set<RewardBranch>();
  const metadata = card as CardWithRewardMetadata;

  addBranchValue(branches, metadata.rewardBranch);
  addBranchValue(branches, metadata.rewardCategory);
  addBranchValue(branches, metadata.rewardCategories);
  addBranchValue(branches, metadata.rewardRole);
  addBranchValue(branches, metadata.rewardRoles);
  addBranchValue(branches, metadata.rewardTags);
  addBranchValue(branches, metadata.archetype);
  addBranchValue(branches, metadata.categories);
  addBranchValue(branches, metadata.role);
  addBranchValue(branches, metadata.tags);

  if (card.cardType === 'payoff' || card.chainRole === 'payoff' || card.cycleRole === 'finisher' || card.buildRole === 'payoff-finisher') {
    branches.add('payoff');
  }

  if (
    card.cardType === 'repair' ||
    card.cardType === 'resource' ||
    card.chainRole === 'repair' ||
    card.cycleRole === 'wild-fixer' ||
    card.buildRole === 'wild-fixer' ||
    card.utilities?.includes('wild') ||
    card.utilities?.includes('mana') ||
    Boolean(card.energyGain)
  ) {
    branches.add('repair-resource');
  }

  const canOfferAsRouteBridge = card.availability !== 'reserve-test';
  if (
    canOfferAsRouteBridge &&
    (card.chainRole === 'starter' ||
      card.chainRole === 'bridge' ||
      card.chainRole === 'expand' ||
      card.cycleRole === 'opener' ||
      card.cycleRole === 'connector' ||
      card.cycleRole === 'route-segment' ||
      card.buildRole === 'basic-chain' ||
      card.buildRole === 'reward-chain' ||
      card.buildRole === 'draw-fixer')
  ) {
    branches.add('route-bridge');
  }

  return branches;
}

function branchesFromExplicitContract(card: CardDefinition): Set<RewardBranch> {
  const branches = new Set<RewardBranch>();
  addBranchValue(branches, card.rewardBranches);
  return branches;
}

function fallbackBranches(cardId: CardId): Set<RewardBranch> {
  const branches = new Set<RewardBranch>();

  if (REPAIR_RESOURCE_CARD_IDS.has(cardId)) {
    branches.add('repair-resource');
  }
  if (PAYOFF_CARD_IDS.has(cardId)) {
    branches.add('payoff');
  }
  if (ROUTE_BRIDGE_CARD_IDS.has(cardId)) {
    branches.add('route-bridge');
  }

  return branches;
}

export function rewardBranchesForCard(card: CardDefinition): Set<RewardBranch> {
  const explicitBranches = branchesFromExplicitContract(card);
  if (explicitBranches.size > 0) {
    return explicitBranches;
  }

  const metadataBranches = branchesFromMetadata(card);
  return metadataBranches.size > 0 ? metadataBranches : fallbackBranches(card.id);
}

export function rewardResponseRolesForCard(card: CardDefinition): Set<RewardResponseRole> {
  const roles = new Set<RewardResponseRole>();
  const branches = rewardBranchesForCard(card);
  const keywords = new Set(card.keywords);
  const mechanicTags = new Set(card.mechanicTags ?? []);
  const utilities = new Set(card.utilities ?? []);

  if (CLEANSE_CARD_IDS.has(card.id) || keywords.has('净化')) {
    roles.add('cleanse-pollution');
  }

  if (keywords.has('保留') || mechanicTags.has('retain') || card.lifecycle?.onTurnEnd === 'retain') {
    roles.add('retain');
  }

  if (branches.has('payoff')) {
    roles.add('payoff');
  }

  if (utilities.has('wild') || card.cardType === 'repair' || card.chainRole === 'repair') {
    roles.add('wild-bridge');
  }

  if (branches.has('route-bridge') && card.cost <= 1) {
    roles.add('low-cost-bridge');
  }

  if (!branches.has('payoff') && (mechanicTags.has('authorization') || keywords.has('授权'))) {
    roles.add('authorization');
  }

  if (utilities.has('draw') || utilities.has('mana') || card.drawCards || card.energyGain) {
    roles.add('draw-resource');
  }

  return roles;
}

function matchesPreferredCardId(candidateCardId: CardId, preferredCardId: CardId): boolean {
  if (candidateCardId === preferredCardId) {
    return true;
  }

  return (
    candidateCardId.startsWith(CARD_UPGRADE_REWARD_PREFIX) &&
    candidateCardId.includes(`:${preferredCardId}:`)
  );
}

type RewardCandidate = {
  id: CardId;
  card: CardDefinition | undefined;
};

function shouldUseBalancedPressureChoices(responseProfile?: RewardResponseProfile): boolean {
  const pressureSignals = rewardResponsePressureSignals(responseProfile);
  const pressures = rewardResponsePressuresForProfile(responseProfile);
  return pressures.length > 1 || pressureSignals.length > pressures.length;
}

function cardMatchesPressure(card: CardDefinition, pressure: RewardResponsePressure): boolean {
  const roles = rewardResponseRolesForCard(card);
  if (RESPONSE_ROLES_BY_PRESSURE[pressure].some((role) => roles.has(role))) {
    return true;
  }

  const branch = BRANCH_BY_PRESSURE[pressure];
  return Boolean(branch && rewardBranchesForCard(card).has(branch));
}

function primaryFallbackPressure(card: CardDefinition): RewardResponsePressure | null {
  const branches = rewardBranchesForCard(card);
  const roles = rewardResponseRolesForCard(card);

  if (branches.has('payoff') || roles.has('payoff')) {
    return 'payoff';
  }
  if (branches.has('repair-resource')) {
    return 'resource';
  }
  if (branches.has('route-bridge')) {
    return 'bridge';
  }
  if (roles.has('authorization') || roles.has('draw-resource')) {
    return 'resource';
  }
  if (roles.has('wild-bridge') || roles.has('low-cost-bridge')) {
    return 'bridge';
  }
  if (roles.has('cleanse-pollution') || roles.has('retain')) {
    return 'pollution';
  }
  return null;
}

function findExplicitPressureCandidate(
  candidates: RewardCandidate[],
  chosen: Set<CardId>,
  pressure: RewardResponsePressure
): RewardCandidate | undefined {
  for (const role of RESPONSE_ROLES_BY_PRESSURE[pressure]) {
    const candidate = candidates.find(
      ({ card, id }) => card && !chosen.has(id) && rewardResponseRolesForCard(card).has(role)
    );
    if (candidate) {
      return candidate;
    }
  }

  const branch = BRANCH_BY_PRESSURE[pressure];
  if (!branch) {
    return undefined;
  }

  return candidates.find(({ card, id }) => card && !chosen.has(id) && rewardBranchesForCard(card).has(branch));
}

function findFallbackPressureCandidate(
  candidates: RewardCandidate[],
  chosen: Set<CardId>,
  pressure: RewardResponsePressure
): RewardCandidate | undefined {
  const branch = BRANCH_BY_PRESSURE[pressure];
  const branchCandidate =
    branch &&
    candidates.find(
      ({ card, id }) =>
        card && !chosen.has(id) && primaryFallbackPressure(card) === pressure && rewardBranchesForCard(card).has(branch)
    );
  if (branchCandidate) {
    return branchCandidate;
  }

  const primaryCandidate = candidates.find(
    ({ card, id }) => card && !chosen.has(id) && primaryFallbackPressure(card) === pressure
  );
  if (primaryCandidate) {
    return primaryCandidate;
  }

  return candidates.find(({ card, id }) => card && !chosen.has(id) && cardMatchesPressure(card, pressure));
}

function fallbackPressuresByNeed(pressureCounts: Map<RewardResponsePressure, number>): RewardResponsePressure[] {
  return [...BALANCED_FALLBACK_PRESSURE_PRIORITY].sort(
    (left, right) =>
      (pressureCounts.get(left) ?? 0) - (pressureCounts.get(right) ?? 0) ||
      BALANCED_FALLBACK_PRESSURE_PRIORITY.indexOf(left) - BALANCED_FALLBACK_PRESSURE_PRIORITY.indexOf(right)
  );
}

function appendBalancedPressureChoices(
  candidates: RewardCandidate[],
  choices: CardId[],
  chosen: Set<CardId>,
  effectivePickCount: number,
  responseProfile?: RewardResponseProfile
): void {
  const pressures = rewardResponsePressuresForProfile(responseProfile);
  const pressureCounts = new Map<RewardResponsePressure, number>();
  const hasResourceAndBridgePressure = pressures.includes('resource') && pressures.includes('bridge');

  const appendCandidate = (candidate: RewardCandidate, pressure: RewardResponsePressure): void => {
    choices.push(candidate.id);
    chosen.add(candidate.id);
    pressureCounts.set(pressure, (pressureCounts.get(pressure) ?? 0) + 1);
  };

  for (const pressure of pressures) {
    if (choices.length >= effectivePickCount) {
      return;
    }

    const candidate =
      hasResourceAndBridgePressure && pressure === 'bridge'
        ? findFallbackPressureCandidate(candidates, chosen, pressure) ?? findExplicitPressureCandidate(candidates, chosen, pressure)
        : findExplicitPressureCandidate(candidates, chosen, pressure);
    if (candidate) {
      appendCandidate(candidate, pressure);
    }
  }

  while (choices.length < effectivePickCount) {
    let appended = false;
    for (const pressure of fallbackPressuresByNeed(pressureCounts)) {
      const candidate = findFallbackPressureCandidate(candidates, chosen, pressure);
      if (candidate) {
        appendCandidate(candidate, pressure);
        appended = true;
        break;
      }
    }

    if (!appended) {
      break;
    }
  }
}

export function buildRewardChoices(
  candidateCardPool: CardId[],
  pickCount: number,
  catalog: CardCatalog,
  responseProfile?: RewardResponseProfile
): CardId[] {
  const effectivePickCount = rewardResponsePickCount(pickCount, responseProfile);
  if (effectivePickCount <= 0) {
    return [];
  }

  const candidates = candidateCardPool.map((cardId) => ({
    id: cardId,
    card: catalog[cardId]
  }));
  const choices: CardId[] = [];
  const chosen = new Set<CardId>();

  for (const preferredCardId of rewardResponsePreferredCardIds(responseProfile)) {
    if (choices.length >= effectivePickCount) {
      break;
    }

    const candidate = candidates.find(
      (nextCandidate) => !chosen.has(nextCandidate.id) && matchesPreferredCardId(nextCandidate.id, preferredCardId)
    );
    if (candidate) {
      choices.push(candidate.id);
      chosen.add(candidate.id);
    }
  }

  if (shouldUseBalancedPressureChoices(responseProfile)) {
    appendBalancedPressureChoices(candidates, choices, chosen, effectivePickCount, responseProfile);
  } else {
    for (const responseRole of rewardResponseRolesForProblems(responseProfile)) {
      if (choices.length >= effectivePickCount) {
        break;
      }

      const candidate = candidates.find(
        ({ card, id }) => card && !chosen.has(id) && rewardResponseRolesForCard(card).has(responseRole)
      );
      if (candidate) {
        choices.push(candidate.id);
        chosen.add(candidate.id);
      }
    }
  }

  for (const branch of BRANCH_PRIORITY) {
    if (choices.length >= effectivePickCount) {
      break;
    }

    const candidate = candidates.find(
      ({ card, id }) => card && !chosen.has(id) && rewardBranchesForCard(card).has(branch)
    );
    if (candidate) {
      choices.push(candidate.id);
      chosen.add(candidate.id);
    }
  }

  for (const { card, id } of candidates) {
    if (choices.length >= effectivePickCount) {
      break;
    }
    if (card && !chosen.has(id)) {
      choices.push(id);
      chosen.add(id);
    }
  }

  return choices;
}
