import { describe, expect, it } from 'vitest';
import { startingHand } from '../../data/cards';
import { buildSnapshot } from '../../sim/snapshot';
import { tickWorld } from '../../sim/runtime';
import { createInitialWorld } from '../../sim/world';
import type { CardId, WorldState } from '../../sim/types';

type ObservedRunStatus = 'in-progress' | 'victory' | 'failure';

interface ObservedRewardHistoryEntry {
  node: number;
  selectedCardId: CardId;
  choices: CardId[];
  source: 'level-up' | null;
}

interface ObservedRunState {
  runNumber: number;
  currentNode: number;
  maxNodes: number;
  status: ObservedRunStatus;
  rewardHistory: ObservedRewardHistoryEntry[];
}

const rewardChoices: CardId[] = ['wild_mana_stitch', 'severance_burst', 'blood_reclaim'];

function observedRun(world: WorldState): ObservedRunState | undefined {
  return (world as WorldState & { run?: ObservedRunState }).run;
}

function forceRewardReady(world: WorldState, choices: CardId[] = rewardChoices): void {
  world.fsm.gameFlow = 'Reward';
  world.reward = {
    ...world.reward,
    choices: [...choices],
    candidateCardPool: [...choices],
    pending: true,
    source: 'level-up'
  };
}

function setRunMaxNodes(world: WorldState, maxNodes: number): void {
  const run = observedRun(world);
  if (run) {
    run.maxNodes = maxNodes;
  }
}

function selectReward(world: WorldState, cardId: CardId, traceId = `run-select-${cardId}`): WorldState {
  const next = tickWorld(world, [
    {
      type: 'select-reward',
      cardId,
      traceId
    }
  ]);
  const routeId = next.route?.pendingNodeChoices[0]?.id;
  return routeId
    ? tickWorld(next, [
        {
          type: 'select-route',
          routeId,
          traceId: `${traceId}-route`
        }
      ])
    : next;
}

function restartRun(world: WorldState): WorldState {
  return tickWorld(world, [
    {
      type: 'restart-run',
      traceId: 'run-restart'
    }
  ]);
}

describe('run progression shell', () => {
  it('starts with a minimal in-progress run state', () => {
    const world = createInitialWorld();

    expect(observedRun(world)).toEqual({
      runNumber: 1,
      currentNode: 1,
      maxNodes: 3,
      status: 'in-progress',
      rewardHistory: []
    });
  });

  it('exposes run state through the public snapshot for HUD and QA', () => {
    const world = createInitialWorld();
    forceRewardReady(world);

    selectReward(world, 'wild_mana_stitch', 'run-snapshot-select');

    const snapshot = buildSnapshot(world);

    expect(snapshot.run).toMatchObject({
      runNumber: 1,
      currentNode: 2,
      maxNodes: 3,
      status: 'in-progress'
    });
    expect(snapshot.run.rewardHistory).toEqual([
      expect.objectContaining({
        selectedCardId: 'wild_mana_stitch',
        choices: rewardChoices
      })
    ]);

    snapshot.run.rewardHistory[0].choices.push('severance_burst');

    expect(world.run.rewardHistory[0].choices).toEqual(rewardChoices);
  });

  it('records selected rewards as run history and advances to the next node', () => {
    const world = createInitialWorld();
    forceRewardReady(world);

    selectReward(world, 'severance_burst', 'run-select-node-1');

    expect(observedRun(world)).toMatchObject({
      runNumber: 1,
      currentNode: 2,
      maxNodes: 3,
      status: 'in-progress'
    });
    expect(observedRun(world)?.rewardHistory).toEqual([
      expect.objectContaining({
        node: 1,
        selectedCardId: 'severance_burst',
        choices: rewardChoices,
        source: 'level-up'
      })
    ]);
    expect(world.player.deck).toContain('severance_burst');
    expect(world.fsm.gameFlow).toBe('PlayerTurn');
  });

  it('enters settlement when the short run target is reached', () => {
    const world = createInitialWorld();
    setRunMaxNodes(world, 1);
    forceRewardReady(world);

    selectReward(world, 'wild_mana_stitch', 'run-select-final-node');

    expect(observedRun(world)).toMatchObject({
      currentNode: 1,
      maxNodes: 1,
      status: 'victory'
    });
    expect(observedRun(world)?.rewardHistory).toHaveLength(1);
    expect(world.fsm.gameFlow).toBe('Settlement');
  });

  it('restarts with a fresh run and does not retain run deck rewards as meta growth', () => {
    const world = createInitialWorld();
    forceRewardReady(world);
    selectReward(world, 'severance_burst', 'run-select-before-restart');

    const completedRunNumber = observedRun(world)?.runNumber;
    const restarted = restartRun(world);

    expect(restarted.player.deck).toEqual(startingHand);
    expect(restarted.player.deck).not.toContain('severance_burst');
    expect(observedRun(restarted)).toEqual({
      runNumber: (completedRunNumber ?? 0) + 1,
      currentNode: 1,
      maxNodes: 3,
      status: 'in-progress',
      rewardHistory: []
    });
  });
});
