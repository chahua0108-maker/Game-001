import { describe, expect, it } from 'vitest';

import { cards } from '../../data/cards';
import { buildRewardChoices } from '../../sim/rewardChoices';
import { rewardResponsePickCount, rewardResponseRolesForProblems } from '../../sim/rewardProgression';
import type { RewardRouteContext } from '../../sim/rewardProgression';

const repairCacheContext: RewardRouteContext = {
  selectedRouteId: 'run-1-node-1-to-2-repair-cache',
  modifierId: 'rewardRerollPlusOne',
  rewardBranchHint: 'repair-resource',
  rewardPickBonus: 1,
  label: '维修补给岔路'
};

const elitePressureContext: RewardRouteContext = {
  selectedRouteId: 'run-1-node-1-to-2-elite-pressure',
  modifierId: 'maxEnergyThisRunPlusOne',
  rewardBranchHint: 'payoff',
  rewardPickBonus: 0,
  label: '高压债务岔路'
};

describe('redline reward route response merge', () => {
  it('merges repair-cache route context into the next reward as repair/resource bias and bonus choice width', () => {
    expect(rewardResponseRolesForProblems({ problems: [], routeContext: repairCacheContext })).toEqual([
      'draw-resource',
      'wild-bridge'
    ]);
    expect(rewardResponsePickCount(3, { problems: [], routeContext: repairCacheContext })).toBe(4);
    expect(
      buildRewardChoices(
        ['severance_burst', 'spark_tap', 'blood_tithe', 'wild_gap_key', 'paper_shatter'],
        3,
        cards,
        { problems: [], routeContext: repairCacheContext }
      )
    ).toEqual(['blood_tithe', 'wild_gap_key', 'severance_burst', 'spark_tap']);
  });

  it('merges elite-pressure route context into the next reward as payoff or +MP authorization pressure', () => {
    expect(rewardResponseRolesForProblems({ problems: [], routeContext: elitePressureContext })).toEqual([
      'payoff',
      'authorization'
    ]);
    expect(rewardResponsePickCount(3, { problems: [], routeContext: elitePressureContext })).toBe(3);
    expect(
      buildRewardChoices(
        ['blood_tithe', 'spark_tap', 'clearance_order', 'severance_burst', 'pulse_draw'],
        3,
        cards,
        { problems: [], routeContext: elitePressureContext }
      )
    ).toEqual(['severance_burst', 'clearance_order', 'blood_tithe']);
  });
});
