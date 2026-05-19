import { describe, expect, it } from 'vitest';
import { startingHand } from '../../data/cards';
import {
  completeCombatRouteNode,
  createInitialShortRunRouteState,
  resetShortRunRouteForRestart,
  selectShortRunRouteNode
} from '../../sim/runRoute';
import { tickWorld } from '../../sim/runtime';
import { createInitialWorld } from '../../sim/world';
import type { CardId, Intent, WorldState } from '../../sim/types';

function selectReward(world: WorldState, cardId: CardId, traceId: string): WorldState {
  return tickWorld(world, [
    {
      type: 'select-reward',
      cardId,
      traceId
    } satisfies Intent
  ]);
}

function restartRun(world: WorldState, traceId: string): WorldState {
  return tickWorld(world, [
    {
      type: 'restart-run',
      traceId
    } satisfies Intent
  ]);
}

function putFinalNodeRewardPending(world: WorldState, choices: CardId[]): void {
  world.fsm.gameFlow = 'Reward';
  world.run.currentNode = world.run.maxNodes;
  world.reward = {
    ...world.reward,
    pending: true,
    source: 'level-up',
    choices: [...choices],
    candidateCardPool: [...choices],
    pickCount: choices.length
  };
}

describe('redline short-run completion and failure boundaries', () => {
  it('moves the final node reward selection into Settlement/victory', () => {
    const world = createInitialWorld();
    putFinalNodeRewardPending(world, ['severance_burst', 'wild_gap_key', 'spark_tap']);

    selectReward(world, 'severance_burst', 'short-run-final-reward');

    expect(world.fsm.gameFlow).toBe('Settlement');
    expect(world.run.status).toBe('victory');
    expect(world.run.currentNode).toBe(3);
    expect(world.reward.pending).toBe(false);
    expect(world.reward.choices).toEqual([]);
    expect(world.player.deck).toContain('severance_burst');
    expect(world.run.rewardHistory).toContainEqual(
      expect.objectContaining({
        node: 3,
        selectedCardId: 'severance_burst',
        traceId: 'short-run-final-reward'
      })
    );
  });

  it('moves HP zero into Settlement/failure before refill or next deal', () => {
    const world = createInitialWorld();
    world.fsm.gameFlow = 'PlayerTurn';
    world.player.hp = 1;
    world.roundAttackEnemyIds = ['enemy-1'];
    world.enemyIntents = {
      'enemy-1': {
        enemyId: 'enemy-1',
        kind: 'attack',
        amount: 99,
        slot: 0,
        description: 'lethal test hit',
        willRefill: true
      }
    };
    world.enemyIntentSummary = {
      totalDamage: 99,
      intentEnemyIds: ['enemy-1']
    };

    tickWorld(world, [
      {
        type: 'end-turn',
        traceId: 'short-run-lethal-end-turn'
      } satisfies Intent
    ]);

    expect(world.player.hp).toBe(0);
    expect(world.fsm.gameFlow).toBe('Settlement');
    expect(world.run.status).toBe('failure');
    expect(world.round).toBe(1);
    expect(world.debug.events).toContainEqual(
      expect.objectContaining({
        type: 'EnemyAttacked',
        traceId: 'short-run-lethal-end-turn',
        remainingHp: 0
      })
    );
  });

  it('restart-run clears current-run route, upgrades, rewards, and reward-added deck cards', () => {
    const world = createInitialWorld();
    world.run.currentNode = 2;
    world.run.rewardHistory.push({
      runNumber: 1,
      node: 2,
      selectedCardId: 'wild_gap_key',
      choices: ['wild_gap_key', 'severance_burst', 'spark_tap'],
      source: 'level-up',
      tick: 7,
      traceId: 'short-run-prior-reward',
      round: 2,
      level: 2
    });
    world.player.deck = [...startingHand, 'wild_gap_key'];
    world.reward.pending = true;
    world.reward.choices = ['severance_burst', 'wild_gap_key', 'spark_tap'];
    world.cardUpgrades.enhancements.debt_hook = {
      cardId: 'debt_hook',
      level: 1,
      gemSlots: [{ color: 'red', gemId: 'crimson_chip' }]
    };
    world.cardUpgrades.history.push({
      tick: 8,
      traceId: 'short-run-upgrade',
      cardId: 'debt_hook',
      choiceId: 'short-run-upgrade:debt_hook:raise-level:0',
      choiceType: 'raise-level',
      level: 1,
      gemSlots: [{ color: 'red', gemId: 'crimson_chip' }]
    });

    const planned = completeCombatRouteNode(world.run, createInitialShortRunRouteState());
    const selectedRoute = selectShortRunRouteNode(planned.run, planned.route, planned.route.pendingNodeChoices[0].id);
    expect(selectedRoute.route.history).toHaveLength(1);

    const restarted = restartRun(world, 'short-run-restart');
    const restartedRoute = resetShortRunRouteForRestart(selectedRoute.route);

    expect(restarted).not.toBe(world);
    expect(restarted.run.runNumber).toBe(2);
    expect(restarted.run.currentNode).toBe(1);
    expect(restarted.run.status).toBe('in-progress');
    expect(restarted.run.rewardHistory).toEqual([]);
    expect(restarted.player.deck).toEqual(startingHand);
    expect(restarted.reward.pending).toBe(false);
    expect(restarted.reward.choices).toEqual([]);
    expect(restarted.cardUpgrades.enhancements).toEqual({});
    expect(restarted.cardUpgrades.history).toEqual([]);
    expect(restartedRoute).toEqual(createInitialShortRunRouteState());
  });
});
