import type { CardId, RewardBranch } from './types';

export const LEVEL_XP_THRESHOLDS = [0, 12, 24, 42, 72, 110] as const;
export const INITIAL_REWARD_XP_THRESHOLD = LEVEL_XP_THRESHOLDS[1];

export type RewardResponseProblem = 'polluted' | 'missing-payoff' | 'missing-bridge' | 'missing-resource';
export type RewardResponseRole =
  | 'cleanse-pollution'
  | 'retain'
  | 'payoff'
  | 'wild-bridge'
  | 'low-cost-bridge'
  | 'authorization'
  | 'draw-resource';

export interface RewardPreferenceInput {
  responseRoles?: RewardResponseRole[];
  rewardBranchHints?: RewardBranch[];
  preferredCardIds?: CardId[];
  upgradeTargetCardIds?: CardId[];
}

export interface RewardRouteContext {
  selectedRouteId?: string;
  modifierId?: string;
  rewardBranchHint?: RewardBranch;
  rewardPickBonus?: number;
  label?: string;
  preferences?: RewardPreferenceInput;
}

export interface RewardBuildPlanPreference extends RewardPreferenceInput {
  problems?: RewardResponseProblem[];
  label?: string;
}

export interface RewardResponseProfile {
  problems: RewardResponseProblem[];
  routeContext?: RewardRouteContext | null;
  buildPlan?: RewardBuildPlanPreference | null;
}

const RESPONSE_ROLES_BY_PROBLEM: Record<RewardResponseProblem, RewardResponseRole[]> = {
  polluted: ['cleanse-pollution', 'retain'],
  'missing-payoff': ['payoff'],
  'missing-bridge': ['wild-bridge', 'low-cost-bridge'],
  'missing-resource': ['authorization', 'draw-resource']
};

const RESPONSE_ROLES_BY_ROUTE_BRANCH: Record<RewardBranch, RewardResponseRole[]> = {
  'repair-resource': ['draw-resource', 'wild-bridge'],
  payoff: ['payoff', 'authorization'],
  'route-bridge': ['low-cost-bridge', 'wild-bridge']
};

export function nextLevelXp(level: number): number {
  return (
    LEVEL_XP_THRESHOLDS[level] ??
    LEVEL_XP_THRESHOLDS[LEVEL_XP_THRESHOLDS.length - 1] + (level - (LEVEL_XP_THRESHOLDS.length - 1)) * 50
  );
}

export function rewardResponseRolesForProblems(profile?: RewardResponseProfile): RewardResponseRole[] {
  if (!profile || (profile.problems.length === 0 && !profile.routeContext && !profile.buildPlan)) {
    return [];
  }

  const roles: RewardResponseRole[] = [];
  const seen = new Set<RewardResponseRole>();
  const addRoles = (nextRoles: RewardResponseRole[]): void => {
    for (const role of nextRoles) {
      if (!seen.has(role)) {
        roles.push(role);
        seen.add(role);
      }
    }
  };

  addRoles(profile.buildPlan?.responseRoles ?? []);

  for (const problem of profile.buildPlan?.problems ?? []) {
    addRoles(RESPONSE_ROLES_BY_PROBLEM[problem]);
  }

  for (const problem of profile.problems) {
    addRoles(RESPONSE_ROLES_BY_PROBLEM[problem]);
  }

  addRoles(profile.routeContext?.preferences?.responseRoles ?? []);

  for (const branchHint of profile.buildPlan?.rewardBranchHints ?? []) {
    addRoles(RESPONSE_ROLES_BY_ROUTE_BRANCH[branchHint]);
  }

  for (const branchHint of profile.routeContext?.preferences?.rewardBranchHints ?? []) {
    addRoles(RESPONSE_ROLES_BY_ROUTE_BRANCH[branchHint]);
  }

  if (profile.routeContext?.rewardBranchHint) {
    addRoles(RESPONSE_ROLES_BY_ROUTE_BRANCH[profile.routeContext.rewardBranchHint]);
  }

  return roles;
}

export function rewardResponsePickCount(basePickCount: number, profile?: RewardResponseProfile): number {
  return Math.max(0, basePickCount + Math.max(0, profile?.routeContext?.rewardPickBonus ?? 0));
}

export function rewardResponsePreferredCardIds(profile?: RewardResponseProfile): CardId[] {
  if (!profile) {
    return [];
  }

  const preferredCardIds: CardId[] = [];
  const seen = new Set<CardId>();
  const addCardIds = (cardIds: readonly CardId[] | undefined): void => {
    for (const cardId of cardIds ?? []) {
      if (!seen.has(cardId)) {
        preferredCardIds.push(cardId);
        seen.add(cardId);
      }
    }
  };

  addCardIds(profile.buildPlan?.preferredCardIds);
  addCardIds(profile.buildPlan?.upgradeTargetCardIds);
  addCardIds(profile.routeContext?.preferences?.preferredCardIds);
  addCardIds(profile.routeContext?.preferences?.upgradeTargetCardIds);

  return preferredCardIds;
}
