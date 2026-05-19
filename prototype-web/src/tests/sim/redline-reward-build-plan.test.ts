import { describe, expect, it } from 'vitest';

import { cards } from '../../data/cards';
import { buildRewardChoices } from '../../sim/rewardChoices';
import type { RewardResponseProfile } from '../../sim/rewardProgression';
import type { CardId } from '../../sim/types';

function choices(candidateCardPool: CardId[], profile: RewardResponseProfile): CardId[] {
  return buildRewardChoices(candidateCardPool, 3, cards, profile);
}

describe('redline reward build plan ordering', () => {
  it('uses build plan bridge pressure before default branch fill', () => {
    expect(
      choices(['severance_burst', 'blood_tithe', 'fuse_needle', 'spark_tap'], {
        problems: [],
        buildPlan: {
          problems: ['missing-bridge']
        }
      })
    ).toEqual(['fuse_needle', 'blood_tithe', 'severance_burst']);
  });

  it('uses route context payoff pressure when the route needs a finisher', () => {
    expect(
      choices(['blood_tithe', 'spark_tap', 'red_ledger_burst', 'pulse_draw'], {
        problems: [],
        routeContext: {
          selectedRouteId: 'route-payoff-check',
          preferences: {
            responseRoles: ['payoff']
          }
        }
      })
    ).toEqual(['red_ledger_burst', 'blood_tithe', 'spark_tap']);
  });

  it('uses build plan pollution cleanup pressure before resource and payoff fill', () => {
    expect(
      choices(['severance_burst', 'blood_tithe', 'silt_purge', 'spark_tap'], {
        problems: [],
        buildPlan: {
          problems: ['polluted']
        }
      })
    ).toEqual(['silt_purge', 'blood_tithe', 'severance_burst']);
  });

  it('uses build plan resource pressure as authorization then draw', () => {
    expect(
      choices(['severance_burst', 'blood_tithe', 'clearance_order', 'pulse_draw'], {
        problems: [],
        buildPlan: {
          problems: ['missing-resource']
        }
      })
    ).toEqual(['clearance_order', 'blood_tithe', 'pulse_draw']);
  });

  it('keeps key-card upgrade candidates ahead of ordinary card rewards when the build plan asks for them', () => {
    const redlineCutUpgrade = 'card-upgrade-choice:route-reward:redline_cut:raise-level:0';

    expect(
      choices([redlineCutUpgrade, 'severance_burst', 'blood_tithe', 'spark_tap'], {
        problems: [],
        buildPlan: {
          upgradeTargetCardIds: ['redline_cut']
        }
      })
    ).toEqual([redlineCutUpgrade, 'blood_tithe', 'severance_burst']);
  });
});
