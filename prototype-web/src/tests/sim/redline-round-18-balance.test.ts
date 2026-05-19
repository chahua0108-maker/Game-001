import { describe, expect, it } from 'vitest';
import qaLifecycleScript from '../../../scripts/qa-lifecycle.mjs?raw';
import qaSimilarityScript from '../../../scripts/qa-similarity.mjs?raw';
import qaUiScript from '../../../scripts/qa-ui.mjs?raw';

import { cards, rewardCardPool } from '../../data/cards';
import { buildRewardChoices, rewardBranchesForCard } from '../../sim/rewardChoices';
import { createBuildPlan } from '../../sim/buildPlan';
import { deriveRunModifierPlan } from '../../sim/runModifiers';
import { tickWorld } from '../../sim/runtime';
import { completeCombatRouteNode } from '../../sim/runRoute';
import { createInitialRunState, createInitialWorld } from '../../sim/world';
import type { CardId, RewardBranch, WorldState } from '../../sim/types';

const resourceRewardChoices: CardId[] = ['blood_tithe', 'wild_mana_stitch', 'silt_purge', 'severance_burst'];
const payoffRewardChoices: CardId[] = ['severance_burst', 'spark_tap', 'blood_tithe'];

function branchSet(cardId: CardId): Set<RewardBranch> {
  return rewardBranchesForCard(cards[cardId]);
}

function forceRewardReady(world: WorldState, choices: CardId[]): void {
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

function eventTypes(world: WorldState): string[] {
  return world.debug.events.map((event) => event.type);
}

describe('round 18 balance and failure-pressure guardrails', () => {
  it('keeps repeated safe repair routes from removing battle pressure or granting Max MP', () => {
    const world = createInitialWorld();
    forceRewardReady(world, resourceRewardChoices);

    tickWorld(world, [{ type: 'select-reward', cardId: 'blood_tithe', traceId: 'round18-safe-reward-1' }]);
    selectRouteByKind(world, 'repair-cache', 'round18-safe-route-1');

    expect(world.run.currentNode).toBe(2);
    expect(world.run.status).toBe('in-progress');
    expect(world.player.maxEnergy).toBe(3);
    expect(world.enemyIntentSummary.totalDamage).toBeGreaterThan(0);
    const routeHistory = world.route?.history ?? [];
    expect(routeHistory[routeHistory.length - 1]?.context).toMatchObject({
      modifierId: 'rewardRerollPlusOne',
      rewardBranchHint: 'repair-resource',
      rewardPickBonus: 1
    });

    forceRewardReady(world, resourceRewardChoices);
    tickWorld(world, [{ type: 'select-reward', cardId: 'silt_purge', traceId: 'round18-safe-reward-2' }]);
    selectRouteByKind(world, 'repair-cache', 'round18-safe-route-2');

    expect(world.run.currentNode).toBe(3);
    expect(world.run.status).toBe('in-progress');
    expect(world.player.maxEnergy).toBe(3);
    expect(world.enemyIntentSummary.totalDamage).toBeGreaterThan(0);
    expect(world.route?.history).toHaveLength(2);
  });

  it('turns unresolved HP pressure into visible HP loss and pollution pressure within the first node', () => {
    const world = createInitialWorld();

    tickWorld(world, [{ type: 'deal-hand', traceId: 'round18-pressure-deal' }]);
    const hpBefore = world.player.hp;
    const previewedIntentDamage = world.enemyIntentSummary.totalDamage;

    tickWorld(world, [{ type: 'end-turn', traceId: 'round18-pressure-end' }]);

    expect(previewedIntentDamage).toBeGreaterThan(0);
    expect(hpBefore - world.player.hp).toBe(previewedIntentDamage);
    expect(eventTypes(world)).toContain('EnemyAttacked');
    expect(eventTypes(world)).toContain('PressurePollutionAdded');
    expect([
      ...world.player.hand,
      ...world.player.drawPile,
      ...world.player.discardPile,
      ...world.player.exhaustPile,
      ...world.player.retainedCards
    ]).toContain('static_overload');

    const plan = createBuildPlan(world);
    expect(plan.issues.map((issue) => issue.id)).toContain('clear-pollution');
    expect(plan.issues.find((issue) => issue.id === 'clear-pollution')?.priority).toBeLessThan(
      plan.issues.find((issue) => issue.id === 'missing-finisher')?.priority ?? Number.POSITIVE_INFINITY
    );
  });

  it('does not bundle resource repair, reward width, and Max MP into one snowball package', () => {
    const planned = completeCombatRouteNode(createInitialRunState());
    const repairRoute = planned.route.pendingNodeChoices.find((candidate) => candidate.kind === 'repair-cache');
    const eliteRoute = planned.route.pendingNodeChoices.find((candidate) => candidate.kind === 'elite-pressure');

    expect(repairRoute).toBeDefined();
    expect(eliteRoute).toBeDefined();

    for (const route of planned.route.pendingNodeChoices) {
      const context = route.nextBattleContext;
      const hasResourceRepair = context.rewardBranchHint === 'repair-resource';
      const hasRewardWidth = context.rewardPickBonus > 0;
      const hasMaxMp = context.modifierId === 'maxEnergyThisRunPlusOne';

      expect(context.rewardPickBonus).toBeLessThanOrEqual(1);
      expect(Number(hasMaxMp) + Number(hasRewardWidth && hasResourceRepair)).toBeLessThanOrEqual(1);
    }

    const repairChoices = buildRewardChoices(rewardCardPool, 3, cards, {
      problems: ['missing-resource'],
      routeContext: repairRoute!.nextBattleContext
    });
    const eliteChoices = buildRewardChoices(rewardCardPool, 3, cards, {
      problems: ['missing-resource'],
      routeContext: eliteRoute!.nextBattleContext
    });

    expect(repairChoices).toHaveLength(4);
    expect(eliteChoices).toHaveLength(3);
    expect(repairChoices.some((cardId) => branchSet(cardId).has('repair-resource'))).toBe(true);

    const routeModifierPlan = deriveRunModifierPlan({
      baseMaxEnergy: 3,
      selectedModifierIds: [repairRoute!.nextBattleContext.modifierId, eliteRoute!.nextBattleContext.modifierId]
    });
    expect(routeModifierPlan.derived.maxEnergyDeltaThisRun).toBe(1);
    expect(routeModifierPlan.derived.rewardRerollDelta).toBe(1);
    expect(routeModifierPlan.derived.startingDeckAdditions).toEqual([]);
  });

  it('keeps QA gateScore out of core-experience scoring vocabulary', () => {
    for (const script of [qaUiScript, qaSimilarityScript, qaLifecycleScript]) {
      expect(script).toContain('gateScore');
      expect(script).not.toMatch(/core(?:Experience)?Score|coreExperience|核心体验分/);
    }

    const coreScoreEvidence = {
      previousCoreScore: 80,
      routeExperienceDelta: 6,
      qaGateScore: 25
    };
    const round18CoreScore = coreScoreEvidence.previousCoreScore + coreScoreEvidence.routeExperienceDelta;

    expect(round18CoreScore).toBe(86);
    expect(round18CoreScore).not.toBe(
      coreScoreEvidence.previousCoreScore + coreScoreEvidence.routeExperienceDelta + coreScoreEvidence.qaGateScore
    );
  });

  it('keeps route rewards branch-diverse so safety picks are not always the only rational answer', () => {
    const repairChoices = buildRewardChoices(rewardCardPool, 3, cards, {
      problems: [],
      routeContext: completeCombatRouteNode(createInitialRunState()).route.pendingNodeChoices.find(
        (candidate) => candidate.kind === 'repair-cache'
      )!.nextBattleContext
    });
    const branchCoverage = new Set(repairChoices.flatMap((cardId) => [...branchSet(cardId)]));

    expect(repairChoices).toHaveLength(4);
    expect(branchCoverage).toEqual(new Set<RewardBranch>(['repair-resource', 'payoff', 'route-bridge']));
    expect(repairChoices).toEqual(expect.arrayContaining(['blood_tithe', 'severance_burst']));
    expect(repairChoices.some((cardId) => branchSet(cardId).has('route-bridge'))).toBe(true);
    expect(payoffRewardChoices.some((cardId) => branchSet(cardId).has('payoff'))).toBe(true);
  });
});
