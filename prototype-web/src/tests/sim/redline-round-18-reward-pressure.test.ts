import { describe, expect, it } from 'vitest';

import { cards } from '../../data/cards';
import { buildRewardChoices, rewardBranchesForCard } from '../../sim/rewardChoices';
import type { RewardResponseProfile } from '../../sim/rewardProgression';
import type { CardId, RewardBranch } from '../../sim/types';

function choices(candidateCardPool: CardId[], profile: RewardResponseProfile, pickCount = 3): CardId[] {
  return buildRewardChoices(candidateCardPool, pickCount, cards, profile);
}

function branchesForChoices(cardIds: CardId[]): Set<RewardBranch> {
  const branches = new Set<RewardBranch>();
  for (const cardId of cardIds) {
    for (const branch of rewardBranchesForCard(cards[cardId])) {
      branches.add(branch);
    }
  }
  return branches;
}

describe('round 18 reward pressure response ordering', () => {
  it('answers pollution and finisher pressure with one cleanup slot before payoff, not two cleanup slots', () => {
    expect(
      choices(['guard_reserve', 'silt_purge', 'severance_burst', 'red_ledger_burst', 'blood_tithe', 'spark_tap'], {
        problems: [],
        buildPlan: {
          problems: ['polluted', 'missing-payoff']
        }
      })
    ).toEqual(['silt_purge', 'severance_burst', 'blood_tithe']);
  });

  it('interleaves bridge repair and route payoff pressure instead of spending both first slots on bridges', () => {
    expect(
      choices(['blood_tithe', 'spark_tap', 'wild_gap_key', 'severance_burst', 'clearance_order'], {
        problems: [],
        buildPlan: {
          problems: ['missing-bridge']
        },
        routeContext: {
          selectedRouteId: 'round-18-elite-payoff-check',
          rewardBranchHint: 'payoff'
        }
      })
    ).toEqual(['wild_gap_key', 'severance_burst', 'blood_tithe']);
  });

  it('does not double-count repeated resource pressure from build plan and route hints', () => {
    const result = choices(
      ['clearance_order', 'blood_tithe', 'pulse_draw', 'wild_gap_key', 'severance_burst', 'spark_tap'],
      {
        problems: [],
        buildPlan: {
          problems: ['missing-resource'],
          rewardBranchHints: ['repair-resource']
        },
        routeContext: {
          selectedRouteId: 'round-18-repair-cache-repeat',
          rewardBranchHint: 'repair-resource'
        }
      },
      4
    );

    expect(result).toEqual(['clearance_order', 'severance_burst', 'spark_tap', 'blood_tithe']);
    expect(branchesForChoices(result)).toEqual(new Set<RewardBranch>(['route-bridge', 'payoff', 'repair-resource']));
  });
});
