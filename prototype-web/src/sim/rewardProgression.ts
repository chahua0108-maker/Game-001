import type { RewardBranch } from './types';

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

export interface RewardRouteContext {
  selectedRouteId?: string;
  modifierId?: string;
  rewardBranchHint?: RewardBranch;
  rewardPickBonus?: number;
  label?: string;
}

export interface RewardResponseProfile {
  problems: RewardResponseProblem[];
  routeContext?: RewardRouteContext | null;
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
  if (!profile || (profile.problems.length === 0 && !profile.routeContext)) {
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

  for (const problem of profile.problems) {
    addRoles(RESPONSE_ROLES_BY_PROBLEM[problem]);
  }

  if (profile.routeContext?.rewardBranchHint) {
    addRoles(RESPONSE_ROLES_BY_ROUTE_BRANCH[profile.routeContext.rewardBranchHint]);
  }

  return roles;
}

export function rewardResponsePickCount(basePickCount: number, profile?: RewardResponseProfile): number {
  return Math.max(0, basePickCount + Math.max(0, profile?.routeContext?.rewardPickBonus ?? 0));
}
