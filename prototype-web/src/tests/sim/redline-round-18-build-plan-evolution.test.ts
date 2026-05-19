import { describe, expect, it } from 'vitest';

import { createBuildPlan } from '../../sim/buildPlan';
import { completeCombatRouteNode, selectShortRunRouteNode } from '../../sim/runRoute';
import { createInitialWorld } from '../../sim/world';
import type { CardId, WorldState } from '../../sim/types';

function withDeck(deck: CardId[]): WorldState {
  const world = createInitialWorld();
  world.player.deck = [...deck];
  world.player.hand = [];
  world.player.drawPile = [];
  world.player.discardPile = [];
  world.player.exhaustPile = [];
  world.player.retainedCards = [];
  return world;
}

function stageReward(world: WorldState, choices: CardId[]): void {
  world.reward.pending = true;
  world.reward.source = 'level-up';
  world.reward.choices = [...choices];
  world.reward.candidateCardPool = [...choices];
}

function recordRewardPick(world: WorldState, selectedCardId: CardId): void {
  world.run.rewardHistory.push({
    runNumber: world.run.runNumber,
    node: world.run.currentNode,
    selectedCardId,
    choices: [...world.reward.choices],
    source: world.reward.source,
    tick: world.tick,
    traceId: `round18-reward-${selectedCardId}`,
    round: world.round,
    level: world.player.level
  });
  world.player.deck.push(selectedCardId);
  world.reward.pending = false;
}

function selectRouteKind(world: WorldState, kind: 'repair-cache' | 'elite-pressure'): void {
  const planned = completeCombatRouteNode(world.run, world.route);
  const route = planned.route.pendingNodeChoices.find((candidate) => candidate.kind === kind);
  expect(route).toBeDefined();

  const selected = selectShortRunRouteNode(planned.run, planned.route, route!.id);
  world.run = selected.run;
  world.route = selected.route;
}

describe('round 18 build plan evolution', () => {
  it('moves from bridge diagnosis to resource diagnosis after the player patches the missing 2-cost segment', () => {
    const world = withDeck(['debt_hook', 'redline_cut', 'severance_burst']);
    stageReward(world, ['clearance_order', 'blood_tithe', 'spark_tap']);

    const beforeTop = createBuildPlan(world).issues[0];
    expect(beforeTop.id).toBe('missing-bridge');

    recordRewardPick(world, 'clearance_order');
    selectRouteKind(world, 'repair-cache');
    stageReward(world, ['blood_tithe', 'wild_mana_stitch', 'severance_burst']);

    const afterTop = createBuildPlan(world).issues[0];

    expect(afterTop.id).toBe('need-resource');
    expect(afterTop.id).not.toBe(beforeTop.id);
    expect(afterTop.evidence).not.toEqual(beforeTop.evidence);
    expect(afterTop.evidence).toEqual(
      expect.arrayContaining(['最近奖励选择 Clearance Order', '上次路线 维修补给岔路 -> repair-resource'])
    );
  });

  it('demotes pollution cleanup after taking Silt Purge so an unresolved bridge gap becomes the next priority', () => {
    const world = withDeck(['debt_hook', 'severance_burst']);
    world.player.discardPile = ['static_overload'];
    stageReward(world, ['silt_purge', 'heartbeat_spark', 'wild_gap_key']);

    const beforeTop = createBuildPlan(world).issues[0];
    expect(beforeTop.id).toBe('clear-pollution');

    recordRewardPick(world, 'silt_purge');
    selectRouteKind(world, 'repair-cache');
    stageReward(world, ['heartbeat_spark', 'wild_gap_key', 'blood_tithe']);

    const afterPlan = createBuildPlan(world);
    const afterTop = afterPlan.issues[0];
    const pollutionIssue = afterPlan.issues.find((issue) => issue.id === 'clear-pollution');

    expect(afterTop.id).toBe('missing-bridge');
    expect(afterTop.id).not.toBe(beforeTop.id);
    expect(pollutionIssue).toBeDefined();
    expect(pollutionIssue!.priority).toBeGreaterThan(afterTop.priority);
    expect(pollutionIssue!.evidence).not.toEqual(beforeTop.evidence);
    expect(pollutionIssue!.evidence).toEqual(
      expect.arrayContaining(['污染分布 弃牌堆 1', '已拿清污工具 Silt Purge'])
    );
  });
});
