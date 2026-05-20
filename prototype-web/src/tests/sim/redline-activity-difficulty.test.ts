import { describe, expect, it } from 'vitest';
import { startingHand } from '../../data/cards';
import { createInitialActivityState, currentActivityLevel } from '../../sim/activity';
import { tickWorld } from '../../sim/runtime';
import { createInitialWorld } from '../../sim/world';
import type { CardId, Intent, WorldState } from '../../sim/types';

const rewardChoices: CardId[] = ['severance_burst', 'wild_gap_key', 'blood_reclaim'];

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

function forceFinalRewardReady(world: WorldState, choices: CardId[] = rewardChoices): void {
  world.run.currentNode = world.run.maxNodes;
  forceRewardReady(world, choices);
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

function restartCurrentLevel(world: WorldState, traceId: string): WorldState {
  return tickWorld(world, [
    {
      type: 'restart-current-level',
      traceId
    } satisfies Intent
  ]);
}

function continueActivity(world: WorldState, traceId: string): WorldState {
  return tickWorld(world, [
    {
      type: 'continue-activity',
      traceId
    } satisfies Intent
  ]);
}

function winCurrentLevel(world: WorldState, traceId: string): void {
  forceFinalRewardReady(world);
  selectReward(world, 'severance_burst', `${traceId}-reward`);
  expect(world.run.status).toBe('victory');
  expect(world.fsm.gameFlow).toBe('Settlement');
}

function enemyStats(world: WorldState): Array<{ hp: number; maxHp: number; damage: number }> {
  return Object.values(world.enemies)
    .filter((enemy) => enemy.alive)
    .map((enemy) => ({
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      damage: enemy.damage
    }));
}

function sortedEnemyStats(world: WorldState): Array<{ hp: number; maxHp: number; damage: number }> {
  return enemyStats(world).sort((left, right) => left.maxHp - right.maxHp || left.damage - right.damage);
}

describe('redline activity difficulty ladder', () => {
  it('starts activity mode at D1 as a 3-node beginner level inside a 10-tier ladder', () => {
    const world = createInitialWorld(1, createInitialActivityState());

    expect(world.activity?.totalDifficultyTiers).toBe(10);
    expect(world.activity?.playableLevelIds).toEqual(['d1', 'd2', 'd3']);
    expect(currentActivityLevel(world.activity!).id).toBe('d1');
    expect(currentActivityLevel(world.activity!).difficultyTier).toBe(1);
    expect(currentActivityLevel(world.activity!).band).toBe('beginner');
    expect(world.run.maxNodes).toBe(3);
    expect(world.reward.pickCount).toBe(4);
    expect(world.player.maxHp).toBe(72);
    expect(world.player.deck).toEqual(startingHand);
    expect(enemyStats(world)).toContainEqual({ hp: 8, maxHp: 8, damage: 1 });
  });

  it('makes D1 elite routes forgiving and visible instead of applying the old 6 HP plus pollution spike', () => {
    const world = createInitialWorld(1, createInitialActivityState());
    forceRewardReady(world);
    selectReward(world, 'severance_burst', 'activity-d1-reward');

    const eliteRoute = world.route?.pendingNodeChoices.find((candidate) => candidate.kind === 'elite-pressure');
    expect(eliteRoute?.preview).toContain('-2 HP');
    expect(eliteRoute?.preview).toContain('无污染');

    const hpBeforeRoute = world.player.hp;
    selectRouteByKind(world, 'elite-pressure', 'activity-d1-elite-route');

    expect(hpBeforeRoute - world.player.hp).toBe(2);
    expect(world.player.discardPile).not.toContain('static_overload');
    expect(world.run.pressure?.totalPollutionAdded ?? 0).toBe(0);
  });

  it('continues victory from D1 to D2 and then D3 while keeping run rewards non-permanent', () => {
    let world = createInitialWorld(1, createInitialActivityState());

    winCurrentLevel(world, 'activity-win-d1');
    world = continueActivity(world, 'activity-continue-d2');
    expect(currentActivityLevel(world.activity!).id).toBe('d2');
    expect(world.activity?.completedLevelIds).toEqual(['d1']);
    expect(world.run.maxNodes).toBe(3);
    expect(world.player.deck).toEqual(startingHand);
    expect(world.player.deck).not.toContain('severance_burst');

    winCurrentLevel(world, 'activity-win-d2');
    world = continueActivity(world, 'activity-continue-d3');
    expect(currentActivityLevel(world.activity!).id).toBe('d3');
    expect(world.activity?.completedLevelIds).toEqual(['d1', 'd2']);
    expect(world.run.maxNodes).toBe(6);
    expect(world.reward.pickCount).toBe(3);
    expect(world.player.deck).toEqual(startingHand);
  });

  it('restarts the current difficulty after failure or mid-run restart without advancing activity', () => {
    let world = createInitialWorld(1, createInitialActivityState());
    world.run.status = 'failure';
    world.fsm.gameFlow = 'Settlement';

    world = restartCurrentLevel(world, 'activity-failure-restart');
    expect(currentActivityLevel(world.activity!).id).toBe('d1');
    expect(world.activity?.completedLevelIds).toEqual([]);

    forceRewardReady(world);
    selectReward(world, 'wild_gap_key', 'activity-midrun-reward');
    expect(world.run.currentNode).toBe(1);

    world = restartCurrentLevel(world, 'activity-midrun-restart');
    expect(currentActivityLevel(world.activity!).id).toBe('d1');
    expect(world.activity?.completedLevelIds).toEqual([]);
    expect(world.run.maxNodes).toBe(3);
  });

  it('scales refill enemies through the same activity difficulty path as initial enemies', () => {
    const world = createInitialWorld(1, createInitialActivityState());
    const initialStats = sortedEnemyStats(world);

    tickWorld(world, [{ type: 'deal-hand', traceId: 'activity-refill-deal' }]);
    world.enemies['enemy-1'].alive = false;
    tickWorld(world, [{ type: 'end-turn', traceId: 'activity-refill-end-turn' }]);

    expect(sortedEnemyStats(world)).toEqual(initialStats);
  });
});
