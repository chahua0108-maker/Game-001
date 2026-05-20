import { describe, expect, it } from 'vitest';
import { cards, startingHand } from '../../data/cards';
import { createInitialActivityState, currentActivityLevel } from '../../sim/activity';
import { tickWorld } from '../../sim/runtime';
import { createInitialWorld } from '../../sim/world';
import type { CardId, Intent, WorldState } from '../../sim/types';

const rewardChoices: CardId[] = ['severance_burst', 'wild_gap_key', 'blood_reclaim'];
const conservativeRewardPriority: CardId[] = [
  'severance_burst',
  'wild_gap_key',
  'blood_reclaim',
  'pulse_draw',
  'wild_mana_stitch',
  'spark_tap',
  'clearance_order'
];

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

function frontAliveEnemies(world: WorldState) {
  return Object.values(world.enemies)
    .filter((enemy) => enemy.alive && enemy.slot >= 0 && enemy.slot < 5)
    .sort((left, right) => left.hp - right.hp || right.damage - left.damage || left.slot - right.slot);
}

function bestTargetId(world: WorldState): string | undefined {
  return frontAliveEnemies(world)[0]?.id;
}

function canPay(cardId: CardId, world: WorldState): boolean {
  const card = cards[cardId];
  const authorization =
    card?.targets === 'all-enemies' && card.cost === 3 && world.player.authorizationRestriction === 'payoff-only'
      ? world.player.tempAuthorizationMP
      : 0;
  return Boolean(card && world.player.energy + authorization >= card.cost);
}

function playableCardPriority(cardId: CardId, world: WorldState): number {
  const card = cards[cardId];
  if (!card || !canPay(cardId, world)) {
    return 999;
  }
  if (card.targets === 'all-enemies' && world.player.tempAuthorizationMP > 0) {
    return 0;
  }
  const expected = world.chain.nextExpectedCost;
  if (card.cost === expected) {
    return 10 + card.cost;
  }
  if (card.utilities?.includes('wild') && expected > 0 && expected <= 3) {
    return 20 + card.cost;
  }
  return 50 + card.cost;
}

function choosePlayableCard(world: WorldState): CardId | null {
  return [...world.player.hand]
    .filter((cardId) => canPay(cardId, world))
    .sort((left, right) => playableCardPriority(left, world) - playableCardPriority(right, world))[0] ?? null;
}

function chooseReward(world: WorldState): CardId {
  return conservativeRewardPriority.find((cardId) => world.reward.choices.includes(cardId)) ?? world.reward.choices[0];
}

function playConservativeRun(world: WorldState, tracePrefix: string, maxSteps = 160): WorldState {
  for (let step = 0; step < maxSteps; step += 1) {
    if (world.fsm.gameFlow === 'Settlement') {
      return world;
    }

    if (world.fsm.gameFlow === 'Deal') {
      tickWorld(world, [{ type: 'deal-hand', traceId: `${tracePrefix}-deal-${step}` }]);
      continue;
    }

    if (world.fsm.gameFlow === 'Reward') {
      tickWorld(world, [{ type: 'select-reward', cardId: chooseReward(world), traceId: `${tracePrefix}-reward-${step}` }]);
      continue;
    }

    if (world.fsm.gameFlow === 'RouteSelect') {
      const routeId =
        world.route?.pendingNodeChoices.find((candidate) => candidate.kind === 'repair-cache')?.id ??
        world.route?.pendingNodeChoices[0]?.id;
      expect(routeId).toBeDefined();
      tickWorld(world, [{ type: 'select-route', routeId: routeId!, traceId: `${tracePrefix}-route-${step}` }]);
      continue;
    }

    if (world.fsm.gameFlow === 'PlayerTurn') {
      const cardId = choosePlayableCard(world);
      if (!cardId) {
        tickWorld(world, [{ type: 'end-turn', traceId: `${tracePrefix}-end-${step}` }]);
        continue;
      }

      const card = cards[cardId];
      tickWorld(world, [
        {
          type: 'play-card',
          cardId,
          ...(card.targets === 'front-enemy' ? { targetId: bestTargetId(world) } : {}),
          traceId: `${tracePrefix}-card-${step}-${cardId}`
        }
      ]);
      continue;
    }

    tickWorld(world, [{ type: 'advance-time', deltaSeconds: 0.016, traceId: `${tracePrefix}-tick-${step}` }]);
  }

  return world;
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

  it('keeps D3 elite routes below the old first-clear cliff while preserving route visibility', () => {
    let world = createInitialWorld(1, createInitialActivityState());
    winCurrentLevel(world, 'activity-d3-route-win-d1');
    world = continueActivity(world, 'activity-d3-route-continue-d2');
    winCurrentLevel(world, 'activity-d3-route-win-d2');
    world = continueActivity(world, 'activity-d3-route-continue-d3');

    forceRewardReady(world);
    selectReward(world, 'severance_burst', 'activity-d3-route-reward');

    const eliteRoute = world.route?.pendingNodeChoices.find((candidate) => candidate.kind === 'elite-pressure');
    expect(eliteRoute?.preview).toContain('-4 HP');
    expect(eliteRoute?.preview).toContain('无污染');

    const hpBeforeRoute = world.player.hp;
    selectRouteByKind(world, 'elite-pressure', 'activity-d3-elite-route');

    expect(hpBeforeRoute - world.player.hp).toBe(4);
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

  it('lets a conservative player naturally clear D1 without forced rewards or forced settlement', () => {
    const world = createInitialWorld(1, createInitialActivityState());

    playConservativeRun(world, 'd1-natural');

    expect(world.fsm.gameFlow).toBe('Settlement');
    expect(world.run.status).toBe('victory');
    expect(world.run.currentNode).toBe(3);
    expect(world.player.hp).toBeGreaterThan(24);
    expect(world.run.rewardHistory.map((entry) => entry.node)).toEqual([1, 2, 3]);
  });

  it('lets a conservative player naturally clear D1 then continue and clear D2', () => {
    let world = createInitialWorld(1, createInitialActivityState());

    world = playConservativeRun(world, 'd1-before-d2-natural');
    expect(world.fsm.gameFlow).toBe('Settlement');
    expect(world.run.status).toBe('victory');

    world = continueActivity(world, 'd1-natural-continue-d2');
    expect(currentActivityLevel(world.activity!).id).toBe('d2');

    world = playConservativeRun(world, 'd2-natural');

    expect(world.fsm.gameFlow).toBe('Settlement');
    expect(world.run.status).toBe('victory');
    expect(world.run.currentNode).toBe(3);
    expect(world.player.hp).toBeGreaterThan(24);
    expect(world.run.rewardHistory.map((entry) => entry.node)).toEqual([1, 2, 3]);
  });

  it('lets a conservative player naturally clear D1 then D2 then first-clear D3', () => {
    let world = createInitialWorld(1, createInitialActivityState());

    world = playConservativeRun(world, 'd1-before-d3-natural');
    expect(world.fsm.gameFlow).toBe('Settlement');
    expect(world.run.status).toBe('victory');

    world = continueActivity(world, 'd1-natural-continue-d2-before-d3');
    expect(currentActivityLevel(world.activity!).id).toBe('d2');

    world = playConservativeRun(world, 'd2-before-d3-natural');
    expect(world.fsm.gameFlow).toBe('Settlement');
    expect(world.run.status).toBe('victory');
    const d2ClearHp = world.player.hp;

    world = continueActivity(world, 'd2-natural-continue-d3');
    const d3Level = currentActivityLevel(world.activity!);
    expect(d3Level.id).toBe('d3');
    expect(d3Level.nodeCount).toBe(6);
    expect(d3Level.enemyHpMultiplier).toBe(0.88);
    expect(d3Level.rewardPickCount).toBe(3);

    world = playConservativeRun(world, 'd3-natural-first-clear', 320);

    expect(world.fsm.gameFlow).toBe('Settlement');
    expect(world.run.status).toBe('victory');
    expect(world.run.currentNode).toBe(6);
    expect(world.player.hp).toBeGreaterThan(12);
    expect(world.player.hp).toBeLessThan(d2ClearHp);
    expect(world.run.rewardHistory.map((entry) => entry.node)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
