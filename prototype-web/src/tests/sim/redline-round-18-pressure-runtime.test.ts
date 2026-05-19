import { describe, expect, it } from 'vitest';

import { tickWorld } from '../../sim/runtime';
import { createInitialWorld } from '../../sim/world';
import type { CardId, Intent, WorldState } from '../../sim/types';

const baseChoices: CardId[] = ['severance_burst', 'wild_gap_key', 'blood_reclaim'];

function forceRewardReady(world: WorldState, choices: CardId[] = baseChoices): void {
  world.fsm.gameFlow = 'Reward';
  world.reward = {
    ...world.reward,
    choices: [...choices],
    candidateCardPool: [...choices],
    pending: true,
    source: 'level-up'
  };
}

function selectReward(world: WorldState, cardId: CardId, traceId: string): void {
  tickWorld(world, [
    {
      type: 'select-reward',
      cardId,
      traceId
    } satisfies Intent
  ]);
}

function selectRouteByKind(world: WorldState, kind: 'repair-cache' | 'elite-pressure', traceId: string): void {
  const routeId = world.route?.pendingNodeChoices.find((candidate) => candidate.kind === kind)?.id;
  expect(routeId).toBeDefined();
  tickWorld(world, [
    {
      type: 'select-route',
      routeId: routeId!,
      traceId
    } satisfies Intent
  ]);
}

describe('round 18 continuous node pressure runtime', () => {
  it('records pressure, pollution, route risk, and build-plan drift across a 3-node reward-route chain', () => {
    const world = createInitialWorld();
    world.run.maxNodes = 4;

    forceRewardReady(world);
    selectReward(world, 'severance_burst', 'round18-node1-reward');

    expect(world.run.pressure?.records).toContainEqual(
      expect.objectContaining({
        node: 1,
        damageTaken: 0,
        pollutionAdded: 0,
        pollutionCardsActive: 0,
        failureBoundary: false,
        selectedRouteKind: null
      })
    );

    selectRouteByKind(world, 'elite-pressure', 'round18-node1-elite-route');

    expect(world.player.hp).toBe(54);
    expect(world.player.maxEnergy).toBe(4);
    expect(world.player.energy).toBe(4);
    const lastNode1Record = world.run.pressure?.records[world.run.pressure.records.length - 1];
    expect(lastNode1Record).toMatchObject({
      node: 1,
      selectedRouteKind: 'elite-pressure',
      selectedRouteRisk: 'high'
    });

    forceRewardReady(world, ['silt_purge', 'wild_gap_key', 'blood_reclaim']);
    selectReward(world, 'wild_gap_key', 'round18-node2-reward');

    expect(world.run.pressure?.records).toContainEqual(
      expect.objectContaining({
        node: 2,
        incomingRouteKind: 'elite-pressure',
        incomingRouteRisk: 'high',
        damageTaken: 6,
        pollutionAdded: 1,
        pollutionCardsActive: 1,
        failureBoundary: false,
        buildPlanIssueIds: expect.arrayContaining(['clear-pollution'])
      })
    );

    selectRouteByKind(world, 'repair-cache', 'round18-node2-repair-route');
    expect(world.player.hp).toBe(54);
    expect(world.player.maxEnergy).toBe(4);

    forceRewardReady(world, ['blood_reclaim', 'silt_purge', 'spark_tap']);
    selectReward(world, 'blood_reclaim', 'round18-node3-reward');

    expect(world.run.pressure?.records).toContainEqual(
      expect.objectContaining({
        node: 3,
        incomingRouteKind: 'repair-cache',
        incomingRouteRisk: 'low',
        damageTaken: 0,
        pollutionCardsActive: 1,
        buildPlanIssueIds: expect.arrayContaining(['clear-pollution'])
      })
    );

    selectRouteByKind(world, 'elite-pressure', 'round18-node3-elite-route');

    expect(world.player.hp).toBe(48);
    expect(world.player.maxEnergy).toBe(4);
    expect(world.run.pressure).toMatchObject({
      totalDamageTaken: 6,
      totalPollutionAdded: 1,
      activePollutionCards: 1,
      failureBoundaryNode: null
    });
  });
});
