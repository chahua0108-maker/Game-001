import { describe, expect, it } from 'vitest';
import { tickWorld } from '../../sim/runtime';
import { createInitialWorld } from '../../sim/world';
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

function selectReward(world: WorldState, cardId: CardId, traceId: string): WorldState {
  return tickWorld(world, [
    {
      type: 'select-reward',
      cardId,
      traceId
    }
  ]);
}

function selectRoute(world: WorldState, routeId: string, traceId: string): WorldState {
  return tickWorld(world, [
    {
      type: 'select-route',
      routeId,
      traceId
    }
  ]);
}

describe('redline route runtime flow', () => {
  it('waits for player route selection after reward, then advances node and deals the next battle', () => {
    const world = createInitialWorld();
    forceRewardReady(world);

    selectReward(world, 'wild_mana_stitch', 'route-flow-select-reward');

    expect(world.run.currentNode).toBe(1);
    expect(world.fsm.gameFlow).toBe('RouteSelect');
    expect(world.reward.pending).toBe(false);
    expect(world.player.deck).toContain('wild_mana_stitch');
    expect(world.route!.pendingNodeChoices).toHaveLength(2);
    expect(world.route!.nextBattleContext).toBeNull();

    const selectedRoute = world.route!.pendingNodeChoices[0];

    selectRoute(world, selectedRoute.id, 'route-flow-select-route');

    expect(world.run.currentNode).toBe(2);
    expect(world.fsm.gameFlow).toBe('PlayerTurn');
    expect(world.route!.pendingNodeChoices).toEqual([]);
    expect(world.route!.nextBattleContext).toEqual(selectedRoute.nextBattleContext);
    expect(world.route!.history).toEqual([
      {
        fromNode: 1,
        toNode: 2,
        selectedRouteId: selectedRoute.id,
        context: selectedRoute.nextBattleContext
      }
    ]);
    expect(world.round).toBe(2);
    expect(world.player.hand).toHaveLength(4);
    expect(world.debug.events.some((event) => event.type === 'HandDealt' && event.traceId === 'route-flow-select-route')).toBe(
      true
    );
  });

  it('applies selected nextBattleContext before dealing the next battle hand', () => {
    const world = createInitialWorld();
    forceRewardReady(world);

    selectReward(world, 'severance_burst', 'route-flow-context-reward');

    const maxEnergyRoute = world.route!.pendingNodeChoices.find(
      (candidate) => candidate.nextBattleContext.modifierId === 'maxEnergyThisRunPlusOne'
    );

    expect(maxEnergyRoute).toBeDefined();

    selectRoute(world, maxEnergyRoute!.id, 'route-flow-context-route');

    expect(world.route!.nextBattleContext).toEqual(maxEnergyRoute!.nextBattleContext);
    expect(world.player.maxEnergy).toBe(4);
    expect(world.player.energy).toBe(4);
    expect(world.player.hand).toHaveLength(4);
  });
});
