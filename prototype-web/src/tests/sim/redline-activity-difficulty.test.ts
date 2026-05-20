import { describe, expect, it } from 'vitest';
import { cards, startingHand } from '../../data/cards';
import { createInitialActivityState, currentActivityLevel, resolveActivityLevelDefinition } from '../../sim/activity';
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

function continueToD4(tracePrefix: string): WorldState {
  let world = createInitialWorld(1, createInitialActivityState());
  winCurrentLevel(world, `${tracePrefix}-win-d1`);
  world = continueActivity(world, `${tracePrefix}-continue-d2`);
  winCurrentLevel(world, `${tracePrefix}-win-d2`);
  world = continueActivity(world, `${tracePrefix}-continue-d3`);
  winCurrentLevel(world, `${tracePrefix}-win-d3`);
  return continueActivity(world, `${tracePrefix}-continue-d4`);
}

function continueToD2(tracePrefix: string): WorldState {
  let world = createInitialWorld(1, createInitialActivityState());
  winCurrentLevel(world, `${tracePrefix}-win-d1`);
  return continueActivity(world, `${tracePrefix}-continue-d2`);
}

function continueToD3(tracePrefix: string): WorldState {
  let world = continueToD2(tracePrefix);
  winCurrentLevel(world, `${tracePrefix}-win-d2`);
  return continueActivity(world, `${tracePrefix}-continue-d3`);
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
    expect(world.activity?.playableLevelIds).toEqual(['d1', 'd2', 'd3', 'd4']);
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
    const world = continueToD3('activity-d3-route');

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

  it('keeps D2 elite routes as a light pressure step between D1 and D3', () => {
    const world = continueToD2('activity-d2-route');
    forceRewardReady(world);
    selectReward(world, 'severance_burst', 'activity-d2-route-reward');

    const eliteRoute = world.route?.pendingNodeChoices.find((candidate) => candidate.kind === 'elite-pressure');
    expect(eliteRoute?.preview).toContain('-3 HP');
    expect(eliteRoute?.preview).toContain('无污染');

    const hpBeforeRoute = world.player.hp;
    selectRouteByKind(world, 'elite-pressure', 'activity-d2-elite-route');

    expect(hpBeforeRoute - world.player.hp).toBe(3);
    expect(world.player.discardPile).not.toContain('static_overload');
    expect(world.run.pressure?.totalPollutionAdded ?? 0).toBe(0);
  });

  it('rejects direct lethal elite route intents across D1-D3 instead of relying only on HUD disabled buttons', () => {
    const levels = [
      { tracePrefix: 'activity-d1-lethal-guard', createWorld: () => createInitialWorld(1, createInitialActivityState()) },
      { tracePrefix: 'activity-d2-lethal-guard', createWorld: () => continueToD2('activity-d2-lethal-setup') },
      { tracePrefix: 'activity-d3-lethal-guard', createWorld: () => continueToD3('activity-d3-lethal-setup') }
    ];

    for (const level of levels) {
      const world = level.createWorld();
      forceRewardReady(world);
      selectReward(world, 'severance_burst', `${level.tracePrefix}-reward`);
      const eliteRoute = world.route?.pendingNodeChoices.find((candidate) => candidate.kind === 'elite-pressure');
      expect(eliteRoute).toBeDefined();

      const nodeBefore = world.run.currentNode;
      const hpBefore = eliteRoute!.routePressure?.entryDamage ?? 1;
      world.player.hp = hpBefore;
      tickWorld(world, [{ type: 'select-route', routeId: eliteRoute!.id, traceId: `${level.tracePrefix}-select` }]);

      expect(world.fsm.gameFlow).toBe('RouteSelect');
      expect(world.run.currentNode).toBe(nodeBefore);
      expect(world.player.hp).toBe(hpBefore);
      expect(world.run.status).toBe('in-progress');
      expect(world.debug.failedConditions).toContainEqual(
        expect.objectContaining({
          ruleId: 'intent.select-route',
          conditionId: 'route-pressure-lethal'
        })
      );
    }
  });

  it('continues victory from D3 to playable D4 with six nodes, three rewards, and elite pollution pressure', () => {
    const world = continueToD4('activity-d4-entry');
    const d4Level = currentActivityLevel(world.activity!);
    const initialD4Stats = sortedEnemyStats(world);

    expect(d4Level.id).toBe('d4');
    expect(d4Level.nodeCount).toBe(6);
    expect(d4Level.playerMaxHp).toBe(60);
    expect(d4Level.enemyHpMultiplier).toBe(0.95);
    expect(d4Level.enemyDamageMultiplier).toBe(0.9);
    expect(d4Level.rewardPickCount).toBe(3);
    expect(d4Level.eliteRouteAddsPollution).toBe(true);
    expect(d4Level.eliteRouteEntryDamage).toBeCloseTo(5);
    expect(world.run.maxNodes).toBe(6);
    expect(world.player.maxHp).toBe(60);
    expect(world.reward.pickCount).toBe(3);
    expect(initialD4Stats.filter((stats) => stats.maxHp === 10 && stats.damage === 2)).toHaveLength(5);
    expect(initialD4Stats.filter((stats) => stats.maxHp === 15 && stats.damage === 3)).toHaveLength(5);
    expect(initialD4Stats.filter((stats) => stats.maxHp === 21 && stats.damage === 5)).toHaveLength(5);

    tickWorld(world, [{ type: 'deal-hand', traceId: 'activity-d4-refill-deal' }]);
    world.enemies['enemy-1'].alive = false;
    tickWorld(world, [{ type: 'end-turn', traceId: 'activity-d4-refill-end-turn' }]);

    expect(sortedEnemyStats(world)).toEqual(initialD4Stats);
  });

  it('keeps D4 as the final playable level without leaking D5-D10 into runtime flow', () => {
    const world = continueToD4('activity-d4-final');

    expect(world.activity?.playableLevelIds).toEqual(['d1', 'd2', 'd3', 'd4']);
    expect(world.activity?.playableLevelIds).not.toContain('d5');
    expect(world.activity?.playableLevelIds).not.toContain('d10');

    winCurrentLevel(world, 'activity-win-d4-final');
    expect(world.activitySettlementPreview?.canContinue).toBe(false);
    expect(world.activitySettlementPreview?.nextLevelId).toBeNull();

    const continued = continueActivity(world, 'activity-d4-no-d5');
    expect(continued).toBe(world);
    expect(currentActivityLevel(continued.activity!).id).toBe('d4');
    expect(continued.fsm.gameFlow).toBe('Settlement');
    expect(continued.run.status).toBe('victory');
  });

  it('adds visible pollution pressure when choosing a D4 elite route', () => {
    const world = continueToD4('activity-d4-elite-pollution');
    forceRewardReady(world);
    selectReward(world, 'severance_burst', 'activity-d4-elite-route-reward');

    const eliteRoute = world.route?.pendingNodeChoices.find((candidate) => candidate.kind === 'elite-pressure');
    expect(eliteRoute?.preview).toContain('-5 HP');
    expect(eliteRoute?.preview).toContain('污染');

    const staticOverloadBefore = world.player.discardPile.filter((cardId) => cardId === 'static_overload').length;
    const pollutionBefore = world.run.pressure?.totalPollutionAdded ?? 0;
    selectRouteByKind(world, 'elite-pressure', 'activity-d4-elite-route');
    const staticOverloadAfter = world.player.discardPile.filter((cardId) => cardId === 'static_overload').length;
    const pollutionAfter = world.run.pressure?.totalPollutionAdded ?? 0;

    expect(staticOverloadAfter > staticOverloadBefore || pollutionAfter > pollutionBefore).toBe(true);
  });

  it('continues victory from D1 to D2 and then D3 while keeping run rewards non-permanent', () => {
    let world = createInitialWorld(1, createInitialActivityState());

    winCurrentLevel(world, 'activity-win-d1');
    world = continueActivity(world, 'activity-continue-d2');
    expect(currentActivityLevel(world.activity!).id).toBe('d2');
    expect(world.activity?.completedLevelIds).toEqual(['d1']);
    expect(world.run.maxNodes).toBe(4);
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

  it('scales D2 and D3 refill enemies through their current activity difficulty path', () => {
    const worlds = [continueToD2('activity-d2-refill'), continueToD3('activity-d3-refill')];

    for (const world of worlds) {
      const initialStats = sortedEnemyStats(world);
      tickWorld(world, [{ type: 'deal-hand', traceId: `${currentActivityLevel(world.activity!).id}-refill-deal` }]);
      world.enemies['enemy-1'].alive = false;
      tickWorld(world, [{ type: 'end-turn', traceId: `${currentActivityLevel(world.activity!).id}-refill-end-turn` }]);

      expect(sortedEnemyStats(world)).toEqual(initialStats);
    }
  });

  it('keeps activity progression scoped without adding carryover deck growth or new playable tiers', () => {
    let world = createInitialWorld(1, createInitialActivityState());
    expect(world.activity?.playableLevelIds).toEqual(['d1', 'd2', 'd3', 'd4']);
    expect(world.activity).not.toHaveProperty('carryoverToken');
    expect(world.activity).not.toHaveProperty('routeCarryover');

    winCurrentLevel(world, 'activity-scope-win-d1');
    world = continueActivity(world, 'activity-scope-continue-d2');
    expect(currentActivityLevel(world.activity!).id).toBe('d2');
    expect(world.player.deck).toEqual(startingHand);
    expect(world.player.deck).not.toContain('severance_burst');
    expect(world.activity).not.toHaveProperty('carryoverToken');
    expect(world.activity).not.toHaveProperty('routeCarryover');

    winCurrentLevel(world, 'activity-scope-win-d2');
    world = continueActivity(world, 'activity-scope-continue-d3');
    expect(currentActivityLevel(world.activity!).id).toBe('d3');
    expect(world.player.deck).toEqual(startingHand);
    expect(world.player.deck).not.toContain('severance_burst');
    expect(world.activity?.playableLevelIds).not.toContain('d5');
    expect(world.activity?.playableLevelIds).not.toContain('d10');
  });

  it('defines D2 as a four-node low-pressure bridge without changing D4 or adding new tiers', () => {
    const d2Level = resolveActivityLevelDefinition('d2');
    expect(d2Level.title).toBe('低压过渡');
    expect(d2Level.nodeCount).toBe(4);
    expect(d2Level.playerMaxHp).toBe(68);
    expect(d2Level.enemyHpMultiplier).toBe(0.86);
    expect(d2Level.enemyDamageMultiplier).toBe(0.58);
    expect(d2Level.rewardPickCount).toBe(4);
    expect(d2Level.eliteRouteEntryDamage).toBe(3);
    expect(d2Level.eliteRouteAddsPollution).toBe(false);

    const d4Level = resolveActivityLevelDefinition('d4');
    expect(d4Level.nodeCount).toBe(6);
    expect(d4Level.playerMaxHp).toBe(60);
    expect(d4Level.enemyHpMultiplier).toBe(0.95);
    expect(d4Level.enemyDamageMultiplier).toBe(0.9);
    expect(d4Level.rewardPickCount).toBe(3);
    expect(d4Level.eliteRouteEntryDamage).toBe(5);
    expect(d4Level.eliteRouteAddsPollution).toBe(true);
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
    const d1ClearHp = world.player.hp;

    world = continueActivity(world, 'd1-natural-continue-d2');
    const d2Level = currentActivityLevel(world.activity!);
    expect(d2Level.id).toBe('d2');
    expect(d2Level.nodeCount).toBe(4);
    expect(d2Level.rewardPickCount).toBe(4);

    world = playConservativeRun(world, 'd2-natural');

    expect(world.fsm.gameFlow).toBe('Settlement');
    expect(world.run.status).toBe('victory');
    expect(world.run.currentNode).toBe(4);
    expect(world.player.hp).toBeGreaterThan(35);
    expect(world.player.hp).toBeLessThan(d1ClearHp);
    expect(world.run.rewardHistory.map((entry) => entry.node)).toEqual([1, 2, 3, 4]);
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
    expect(world.run.currentNode).toBe(4);
    expect(world.player.hp).toBeGreaterThan(35);
    const d2ClearHp = world.player.hp;

    world = continueActivity(world, 'd2-natural-continue-d3');
    const d3Level = currentActivityLevel(world.activity!);
    expect(d3Level.id).toBe('d3');
    expect(d3Level.nodeCount).toBe(6);
    expect(d3Level.playerMaxHp).toBe(62);
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
