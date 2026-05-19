import { describe, expect, it } from 'vitest';

import { cards, rewardCardPool } from '../../data/cards';
import { buildCardUpgradeChoices, getCardDamageBonus } from '../../sim/cardUpgrades';
import { buildRewardChoices, rewardBranchesForCard } from '../../sim/rewardChoices';
import { tickWorld } from '../../sim/runtime';
import { completeCombatRouteNode } from '../../sim/runRoute';
import { deriveRunModifierPlan } from '../../sim/runModifiers';
import { createInitialRunState, createInitialWorld } from '../../sim/world';
import type { CardId, RewardBranch, WorldState } from '../../sim/types';

const baseRewardChoices: CardId[] = ['blood_tithe', 'severance_burst', 'spark_tap'];

function branchSet(cardId: CardId): Set<RewardBranch> {
  return rewardBranchesForCard(cards[cardId]);
}

function forceRewardReady(world: WorldState, choices: CardId[] = baseRewardChoices): void {
  world.fsm.gameFlow = 'Reward';
  world.reward = {
    ...world.reward,
    choices: [...choices],
    candidateCardPool: [...choices],
    pending: true,
    source: 'level-up'
  };
}

function selectRouteByKind(world: WorldState, kind: 'repair-cache' | 'elite-pressure', traceId: string): void {
  const routeId = world.route?.pendingNodeChoices.find((candidate) => candidate.kind === kind)?.id;
  expect(routeId).toBeDefined();
  tickWorld(world, [{ type: 'select-route', routeId: routeId!, traceId }]);
}

describe('round 17 balance guardrails for build-plan stacking', () => {
  it('keeps route reward width narrow and branch-diverse instead of making one route always optimal', () => {
    const planned = completeCombatRouteNode(createInitialRunState());
    const repairRoute = planned.route.pendingNodeChoices.find((candidate) => candidate.kind === 'repair-cache');
    const eliteRoute = planned.route.pendingNodeChoices.find((candidate) => candidate.kind === 'elite-pressure');

    expect(repairRoute).toBeDefined();
    expect(eliteRoute).toBeDefined();
    expect(repairRoute!.nextBattleContext.rewardPickBonus).toBe(1);
    expect(eliteRoute!.nextBattleContext.rewardPickBonus).toBe(0);

    const repairChoices = buildRewardChoices(rewardCardPool, 3, cards, {
      problems: [],
      routeContext: repairRoute!.nextBattleContext
    });
    const eliteChoices = buildRewardChoices(rewardCardPool, 3, cards, {
      problems: [],
      routeContext: eliteRoute!.nextBattleContext
    });

    expect(repairChoices).toHaveLength(4);
    expect(eliteChoices).toHaveLength(3);
    expect(repairChoices.length - eliteChoices.length).toBe(1);
    expect(new Set(repairChoices).size).toBe(repairChoices.length);
    expect(repairChoices.some((cardId) => branchSet(cardId).has('repair-resource'))).toBe(true);
    expect(repairChoices.some((cardId) => branchSet(cardId).has('payoff'))).toBe(true);
    expect(repairChoices.some((cardId) => branchSet(cardId).has('route-bridge'))).toBe(true);
  });

  it('caps maxEnergy plans at one current-run bump even when the player repeats the elite route', () => {
    const preview = deriveRunModifierPlan({
      baseMaxEnergy: 3,
      selectedModifierIds: ['maxEnergyThisRunPlusOne', 'maxEnergyThisRunPlusOne']
    });

    expect(preview.selectedModifiers.map((modifier) => modifier.id)).toEqual(['maxEnergyThisRunPlusOne']);
    expect(preview.derived.maxEnergyThisRun).toBe(4);
    expect(preview.derived.maxEnergyDeltaThisRun).toBe(1);

    const world = createInitialWorld();
    forceRewardReady(world);
    tickWorld(world, [{ type: 'select-reward', cardId: 'severance_burst', traceId: 'round17-energy-reward-1' }]);
    selectRouteByKind(world, 'elite-pressure', 'round17-energy-route-1');
    expect(world.player.maxEnergy).toBe(4);

    forceRewardReady(world);
    tickWorld(world, [{ type: 'select-reward', cardId: 'spark_tap', traceId: 'round17-energy-reward-2' }]);
    selectRouteByKind(world, 'elite-pressure', 'round17-energy-route-2');
    expect(world.player.maxEnergy).toBe(4);
    expect(world.player.energy).toBe(4);
  });

  it('keeps upgrade rewards incremental and below payoff identity as a single-pick benefit', () => {
    const world = createInitialWorld();
    const choices = buildCardUpgradeChoices(world, 'redline_cut', 'round17-upgrade-offer');

    expect(choices.map((choice) => choice.type)).toEqual(['raise-level', 'add-gem-slot']);

    for (const choice of choices) {
      expect(choice.damageBonusPreview).toBeLessThanOrEqual(3);
    }

    const raiseLevel = choices.find((choice) => choice.type === 'raise-level');
    expect(raiseLevel).toBeDefined();
    expect(raiseLevel!.damageBonusPreview).toBe(cards.redline_cut.runUpgrade!.damagePerLevel);
    expect(cards.redline_cut.damage + raiseLevel!.damageBonusPreview).toBeLessThan(cards.severance_burst.damage);

    world.cardUpgrades.enhancements.redline_cut = {
      cardId: 'redline_cut',
      level: cards.redline_cut.runUpgrade!.maxLevel,
      gemSlots: []
    };

    const cappedChoices = buildCardUpgradeChoices(world, 'redline_cut', 'round17-upgrade-capped');
    expect(cappedChoices.some((choice) => choice.type === 'raise-level')).toBe(false);
    expect(getCardDamageBonus(world.cardUpgrades, 'redline_cut')).toBe(4);
  });

  it('does not stack reward width, maxEnergy, and upgrade slot into one no-brainer route package', () => {
    const planned = completeCombatRouteNode(createInitialRunState());

    for (const route of planned.route.pendingNodeChoices) {
      const context = route.nextBattleContext;
      const hasRewardWidth = context.rewardPickBonus > 0;
      const hasMaxEnergy = context.modifierId === 'maxEnergyThisRunPlusOne';
      const hasUpgradeSlot = context.modifierId === 'startingRepairCard';

      expect(context.rewardPickBonus).toBeLessThanOrEqual(1);
      expect(Number(hasRewardWidth) + Number(hasMaxEnergy) + Number(hasUpgradeSlot)).toBeLessThanOrEqual(1);
    }
  });
});
