import { describe, expect, it } from 'vitest';

import { cards } from '../../data/cards';
import { buildRewardChoices, rewardResponseRolesForCard } from '../../sim/rewardChoices';
import { rewardResponseRolesForProblems } from '../../sim/rewardProgression';
import type { RewardResponseProblem } from '../../sim/rewardProgression';
import type { CardId } from '../../sim/types';

function choices(candidateCardPool: CardId[], problems: RewardResponseProblem[]): CardId[] {
  return buildRewardChoices(candidateCardPool, 3, cards, { problems });
}

describe('redline reward response', () => {
  it('maps previous battle problems to response slots in player-readable priority order', () => {
    expect(rewardResponseRolesForProblems({ problems: ['polluted'] })).toEqual(['cleanse-pollution', 'retain']);
    expect(rewardResponseRolesForProblems({ problems: ['missing-payoff'] })).toEqual(['payoff']);
    expect(rewardResponseRolesForProblems({ problems: ['missing-bridge'] })).toEqual(['wild-bridge', 'low-cost-bridge']);
    expect(rewardResponseRolesForProblems({ problems: ['missing-resource'] })).toEqual([
      'authorization',
      'draw-resource'
    ]);
  });

  it('answers pollution pressure with cleanse or retain candidates before generic branch fill', () => {
    expect(
      choices(['severance_burst', 'burn_after_reading', 'guard_reserve', 'blood_tithe', 'spark_tap'], ['polluted'])
    ).toEqual(['burn_after_reading', 'guard_reserve', 'blood_tithe']);

    expect(choices(['severance_burst', 'guard_reserve', 'blood_tithe', 'spark_tap'], ['polluted'])).toEqual([
      'guard_reserve',
      'blood_tithe',
      'severance_burst'
    ]);
  });

  it('promotes payoff when the previous battle lacked a finisher', () => {
    expect(choices(['blood_tithe', 'spark_tap', 'severance_burst', 'wild_gap_key'], ['missing-payoff'])).toEqual([
      'severance_burst',
      'blood_tithe',
      'spark_tap'
    ]);
  });

  it('promotes wild and low-cost bridge cards when the previous battle lacked a bridge segment', () => {
    expect(
      choices(['severance_burst', 'blood_tithe', 'spark_tap', 'wild_gap_key', 'heartbeat_spark'], ['missing-bridge'])
    ).toEqual(['wild_gap_key', 'spark_tap', 'blood_tithe']);
  });

  it('promotes authorization and draw when the previous battle lacked resources', () => {
    expect(
      choices(['severance_burst', 'spark_tap', 'clearance_order', 'blood_tithe', 'pulse_draw'], ['missing-resource'])
    ).toEqual(['clearance_order', 'blood_tithe', 'pulse_draw']);
  });

  it('keeps default rewards branch-stable when no previous battle profile is supplied', () => {
    expect(buildRewardChoices(['blood_tithe', 'severance_burst', 'spark_tap'], 3, cards)).toEqual([
      'blood_tithe',
      'severance_burst',
      'spark_tap'
    ]);
  });

  it('classifies current cards into response roles without promoting reserve pollution as a reward answer', () => {
    expect(rewardResponseRolesForCard(cards.guard_reserve)).toContain('retain');
    expect(rewardResponseRolesForCard(cards.severance_burst)).toContain('payoff');
    expect(rewardResponseRolesForCard(cards.wild_gap_key)).toContain('wild-bridge');
    expect(rewardResponseRolesForCard(cards.spark_tap)).toContain('low-cost-bridge');
    expect(rewardResponseRolesForCard(cards.clearance_order)).toContain('authorization');
    expect(rewardResponseRolesForCard(cards.blood_tithe)).toContain('draw-resource');
    expect(rewardResponseRolesForCard(cards.static_overload)).not.toContain('cleanse-pollution');
    expect(rewardResponseRolesForCard(cards.static_overload)).not.toContain('retain');
  });
});
