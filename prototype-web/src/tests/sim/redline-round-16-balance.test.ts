import { describe, expect, it } from 'vitest';

import { cards } from '../../data/cards';
import { tickWorld } from '../../sim/runtime';
import { completeCombatRouteNode } from '../../sim/runRoute';
import { createInitialRunState, createInitialWorld } from '../../sim/world';
import type { CardId, WorldState } from '../../sim/types';

const rewardChoices: CardId[] = ['wild_mana_stitch', 'severance_burst', 'blood_reclaim'];

function forceRewardReady(world: WorldState): void {
  world.fsm.gameFlow = 'Reward';
  world.reward = {
    ...world.reward,
    choices: [...rewardChoices],
    candidateCardPool: [...rewardChoices],
    pending: true,
    source: 'level-up'
  };
}

describe('round 16 balance guardrails for short-run content', () => {
  it('keeps round 15 reward cards inside short-run damage and upgrade bands', () => {
    expect(cards.silt_purge).toMatchObject({
      cost: 0,
      damage: 0,
      drawCards: 1,
      lifecycle: { onPlay: 'exhaust' }
    });
    expect(cards.cinder_crossing).toMatchObject({
      cost: 0,
      damage: 2
    });
    expect(cards.fuse_needle).toMatchObject({
      cost: 1,
      damage: 7,
      runUpgrade: {
        maxLevel: 2,
        damagePerLevel: 2
      }
    });
    expect(cards.signal_relay).toMatchObject({
      cost: 2,
      damage: 6,
      targets: 'front-row',
      runUpgrade: {
        maxLevel: 2,
        damagePerLevel: 2
      }
    });
    expect(cards.crimson_receipt).toMatchObject({
      cost: 1,
      damage: 8,
      targets: 'front-enemy',
      runUpgrade: {
        maxLevel: 2,
        damagePerLevel: 2
      }
    });

    const maxCrimsonLevelDamage =
      cards.crimson_receipt.damage +
      cards.crimson_receipt.runUpgrade!.maxLevel * cards.crimson_receipt.runUpgrade!.damagePerLevel;
    expect(maxCrimsonLevelDamage).toBeLessThan(cards.severance_burst.damage);
    expect(maxCrimsonLevelDamage).toBeLessThanOrEqual(12);
  });

  it('keeps route candidates as single small levers instead of stacked economy bundles', () => {
    const planned = completeCombatRouteNode(createInitialRunState());

    expect(planned.route.pendingNodeChoices).toHaveLength(2);

    for (const candidate of planned.route.pendingNodeChoices) {
      const context = candidate.nextBattleContext;
      const hasEnergyLever = context.modifierId === 'maxEnergyThisRunPlusOne';
      const hasRewardPickLever = context.rewardPickBonus > 0;

      expect(context.targetNode).toBe(context.sourceNode + 1);
      expect(context.rewardPickBonus).toBeLessThanOrEqual(1);
      expect(Number(hasEnergyLever) + Number(hasRewardPickLever)).toBeLessThanOrEqual(1);
    }
  });

  it('caps repeated elite-pressure route selections at one max-energy bump for the short run', () => {
    const runtimeWorld = createInitialWorld();
    forceRewardReady(runtimeWorld);
    tickWorld(runtimeWorld, [{ type: 'select-reward', cardId: 'wild_mana_stitch', traceId: 'balance-reward-1' }]);
    const firstElite = runtimeWorld.route!.pendingNodeChoices.find((candidate) => candidate.kind === 'elite-pressure')!;
    tickWorld(runtimeWorld, [{ type: 'select-route', routeId: firstElite.id, traceId: 'balance-route-1' }]);

    expect(runtimeWorld.player.maxEnergy).toBe(4);

    forceRewardReady(runtimeWorld);
    tickWorld(runtimeWorld, [{ type: 'select-reward', cardId: 'blood_reclaim', traceId: 'balance-reward-2' }]);
    const secondElite = runtimeWorld.route!.pendingNodeChoices.find((candidate) => candidate.kind === 'elite-pressure')!;
    tickWorld(runtimeWorld, [{ type: 'select-route', routeId: secondElite.id, traceId: 'balance-route-2' }]);

    expect(runtimeWorld.player.maxEnergy).toBe(4);
  });
});
