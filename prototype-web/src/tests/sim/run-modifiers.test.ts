import { describe, expect, it } from 'vitest';
import {
  RUN_MODIFIER_DRAFTS,
  deriveRunModifierPlan,
  type RunModifierPreviewInput
} from '../../sim/runModifiers';

describe('run modifier data-layer preview', () => {
  it('returns an explainable run-only plan without mutating the preview input', () => {
    const input: RunModifierPreviewInput = {
      baseMaxEnergy: 3,
      baseRewardRerolls: 0,
      startingDeck: ['debt_hook'],
      selectedModifierIds: ['maxEnergyThisRunPlusOne', 'rewardRerollPlusOne', 'startingRepairCard']
    };
    const before = JSON.parse(JSON.stringify(input));

    const plan = deriveRunModifierPlan(input);

    expect(input).toEqual(before);
    expect(plan.lifecycle).toBe('current-run');
    expect(plan.boundary).toBe('settlement-growth');
    expect(plan.runtimeIntegration).toBe('preview-only');
    expect(plan.exclusions).toEqual(
      expect.arrayContaining(['not-meta-progression', 'not-turn-payoff-authorization', 'not-runtime-applied'])
    );
    expect(plan.derived).toMatchObject({
      baseMaxEnergy: 3,
      maxEnergyThisRun: 4,
      maxEnergyDeltaThisRun: 1,
      rewardRerolls: 1,
      rewardRerollDelta: 1,
      startingDeckAdditions: ['wild_mana_stitch']
    });
    expect(plan.explanations).toEqual(
      expect.arrayContaining([
        'Max MP preview becomes 4 for this run only.',
        'Reward reroll preview gains 1 reroll for this run only.',
        'Starting repair card preview adds wild_mana_stitch for this run only.'
      ])
    );
  });

  it('does not change maxEnergy by default when no modifier is selected', () => {
    const plan = deriveRunModifierPlan({
      baseMaxEnergy: 3,
      baseRewardRerolls: 0,
      startingDeck: ['debt_hook']
    });

    expect(plan.selectedModifiers).toEqual([]);
    expect(plan.derived.baseMaxEnergy).toBe(3);
    expect(plan.derived.maxEnergyThisRun).toBe(3);
    expect(plan.derived.maxEnergyDeltaThisRun).toBe(0);
    expect(plan.derived.rewardRerolls).toBe(0);
    expect(plan.derived.startingDeckAdditions).toEqual([]);
    expect(plan.explanations).toContain('No run modifier selected; base maxEnergy remains unchanged.');
  });

  it('defines every draft modifier as current-run settlement growth, not meta growth or payoff authorization', () => {
    expect(RUN_MODIFIER_DRAFTS.map((modifier) => modifier.id)).toEqual([
      'maxEnergyThisRunPlusOne',
      'rewardRerollPlusOne',
      'startingRepairCard'
    ]);

    for (const modifier of RUN_MODIFIER_DRAFTS) {
      expect(modifier.lifecycle).toBe('current-run');
      expect(modifier.boundary).toBe('settlement-growth');
      expect(modifier.runtimeIntegration).toBe('preview-only');
      expect(modifier.exclusions).toEqual(
        expect.arrayContaining(['not-meta-progression', 'not-turn-payoff-authorization', 'not-runtime-applied'])
      );
    }
  });
});
