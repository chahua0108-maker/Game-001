import { describe, expect, it } from 'vitest';
import { cards, startingHand } from '../../data/cards';
import { createInitialActivityState, currentActivityLevel, resolveActivityLevelDefinition } from '../../sim/activity';
import { createBuildPlan } from '../../sim/buildPlan';
import { tickWorld } from '../../sim/runtime';
import { buildSnapshot } from '../../sim/snapshot';
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

function restartRun(world: WorldState, traceId: string): WorldState {
  return tickWorld(world, [
    {
      type: 'restart-run',
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

function winCurrentLevel(world: WorldState, traceId: string, cardId: CardId = 'severance_burst', choices: CardId[] = rewardChoices): void {
  forceFinalRewardReady(world, choices);
  selectReward(world, cardId, `${traceId}-reward`);
  expect(world.run.status).toBe('victory');
  expect(world.fsm.gameFlow).toBe('Settlement');
}

function continueToD4(tracePrefix: string): WorldState {
  let world = createInitialWorld(1, createInitialActivityState());
  winCurrentLevel(world, `${tracePrefix}-win-d1`);
  world = continueActivity(world, `${tracePrefix}-continue-d2`);
  winCurrentLevel(world, `${tracePrefix}-win-d2`, 'wild_gap_key', ['wild_gap_key', 'blood_reclaim', 'pulse_draw']);
  world = continueActivity(world, `${tracePrefix}-continue-d3`);
  winCurrentLevel(world, `${tracePrefix}-win-d3`, 'blood_reclaim', ['blood_reclaim', 'pulse_draw', 'wild_mana_stitch']);
  return continueActivity(world, `${tracePrefix}-continue-d4`);
}

function continueToD2(tracePrefix: string): WorldState {
  let world = createInitialWorld(1, createInitialActivityState());
  winCurrentLevel(world, `${tracePrefix}-win-d1`);
  return continueActivity(world, `${tracePrefix}-continue-d2`);
}

function continueToD3(tracePrefix: string): WorldState {
  let world = continueToD2(tracePrefix);
  winCurrentLevel(world, `${tracePrefix}-win-d2`, 'wild_gap_key', ['wild_gap_key', 'blood_reclaim', 'pulse_draw']);
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

function playerCardZoneCount(world: WorldState, cardId: CardId): number {
  return [
    ...world.player.deck,
    ...world.player.hand,
    ...world.player.drawPile,
    ...world.player.discardPile,
    ...world.player.exhaustPile,
    ...world.player.retainedCards
  ].filter((candidate) => candidate === cardId).length;
}

function bestTargetId(world: WorldState): string | undefined {
  return frontAliveEnemies(world)[0]?.id;
}

function defaultBrowserTargetId(world: WorldState): string | undefined {
  return Object.values(world.enemies)
    .filter((enemy) => enemy.alive && enemy.slot >= 0 && enemy.slot < 5)
    .sort((left, right) => {
      const intentDelta = (world.enemyIntents[right.id]?.amount ?? 0) - (world.enemyIntents[left.id]?.amount ?? 0);
      if (intentDelta !== 0) {
        return intentDelta;
      }

      return left.hp - right.hp || left.slot - right.slot;
    })[0]?.id;
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

function chooseBrowserConservativeCard(world: WorldState): CardId | null {
  return [...world.player.hand].find((cardId) => canPay(cardId, world)) ?? null;
}

function chooseReward(world: WorldState): CardId {
  const issueIds = createBuildPlan(world).issues.map((issue) => issue.id);
  if (issueIds.includes('clear-pollution')) {
    const cleanupChoice = ['silt_purge', 'ash_filter'].find((cardId) => world.reward.choices.includes(cardId));
    if (cleanupChoice) {
      return cleanupChoice;
    }
  }

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

function playBrowserConservativeRun(world: WorldState, tracePrefix: string, maxSteps = 420): WorldState {
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
      const cardId = chooseBrowserConservativeCard(world);
      if (!cardId) {
        tickWorld(world, [{ type: 'end-turn', traceId: `${tracePrefix}-end-${step}` }]);
        continue;
      }

      const card = cards[cardId];
      tickWorld(world, [
        {
          type: 'play-card',
          cardId,
          ...(card.targets === 'front-enemy' ? { targetId: defaultBrowserTargetId(world) } : {}),
          traceId: `${tracePrefix}-card-${step}-${cardId}`
        }
      ]);
      continue;
    }

    tickWorld(world, [{ type: 'advance-time', deltaSeconds: 0.016, traceId: `${tracePrefix}-tick-${step}` }]);
  }

  return world;
}

function playBrowserConservativeUntilFlow(
  world: WorldState,
  targetFlow: WorldState['fsm']['gameFlow'],
  tracePrefix: string,
  maxSteps = 420
): WorldState {
  for (let step = 0; step < maxSteps; step += 1) {
    if (world.fsm.gameFlow === targetFlow || world.fsm.gameFlow === 'Settlement') {
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
      return world;
    }

    if (world.fsm.gameFlow === 'PlayerTurn') {
      const cardId = chooseBrowserConservativeCard(world);
      if (!cardId) {
        tickWorld(world, [{ type: 'end-turn', traceId: `${tracePrefix}-end-${step}` }]);
        continue;
      }

      const card = cards[cardId];
      tickWorld(world, [
        {
          type: 'play-card',
          cardId,
          ...(card.targets === 'front-enemy' ? { targetId: defaultBrowserTargetId(world) } : {}),
          traceId: `${tracePrefix}-card-${step}-${cardId}`
        }
      ]);
      continue;
    }

    tickWorld(world, [{ type: 'advance-time', deltaSeconds: 0.016, traceId: `${tracePrefix}-tick-${step}` }]);
  }

  return world;
}

function hpRatio(world: WorldState): number {
  return world.player.hp / world.player.maxHp;
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
    expect(eliteRoute?.preview).toContain('-10 HP');
    expect(eliteRoute?.preview).toContain('污染');

    const hpBeforeRoute = world.player.hp;
    selectRouteByKind(world, 'elite-pressure', 'activity-d3-elite-route');

    expect(hpBeforeRoute - world.player.hp).toBe(10);
    expect(playerCardZoneCount(world, 'static_overload')).toBeGreaterThan(0);
    expect(world.debug.events).toContainEqual(
      expect.objectContaining({
        type: 'PressurePollutionAdded',
        cardId: 'static_overload'
      })
    );
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
    expect(d4Level.enemyHpMultiplier).toBe(0.45);
    expect(d4Level.enemyDamageMultiplier).toBe(0.25);
    expect(d4Level.rewardPickCount).toBe(3);
    expect(d4Level.eliteRouteAddsPollution).toBe(true);
    expect(d4Level.eliteRouteEntryDamage).toBeCloseTo(5);
    expect(world.run.maxNodes).toBe(6);
    expect(world.player.maxHp).toBe(72);
    expect(world.activity!.carryover.maxHp).toBe(72);
    expect(world.reward.pickCount).toBe(3);
    expect(initialD4Stats.filter((stats) => stats.maxHp === 5 && stats.damage === 1)).toHaveLength(5);
    expect(initialD4Stats.filter((stats) => stats.maxHp === 7 && stats.damage === 1)).toHaveLength(5);
    expect(initialD4Stats.filter((stats) => stats.maxHp === 10 && stats.damage === 1)).toHaveLength(5);

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

  it('continues victory from D1 to D2 and then D3 while inheriting activity deck growth', () => {
    let world = createInitialWorld(1, createInitialActivityState());

    winCurrentLevel(world, 'activity-win-d1');
    world = continueActivity(world, 'activity-continue-d2');
    expect(currentActivityLevel(world.activity!).id).toBe('d2');
    expect(world.activity?.completedLevelIds).toEqual(['d1']);
    expect(world.run.maxNodes).toBe(3);
    expect(world.run.rewardHistory).toEqual([]);
    expect(world.player.deck).toEqual([...startingHand, 'severance_burst']);
    expect(world.reward.candidateCardPool).not.toContain('severance_burst');

    winCurrentLevel(world, 'activity-win-d2', 'wild_gap_key', ['wild_gap_key', 'blood_reclaim', 'pulse_draw']);
    world = continueActivity(world, 'activity-continue-d3');
    expect(currentActivityLevel(world.activity!).id).toBe('d3');
    expect(world.activity?.completedLevelIds).toEqual(['d1', 'd2']);
    expect(world.run.maxNodes).toBe(6);
    expect(world.reward.pickCount).toBe(3);
    expect(world.run.rewardHistory).toEqual([]);
    expect(world.player.deck).toEqual([...startingHand, 'severance_burst', 'wild_gap_key']);
    expect(world.reward.candidateCardPool).not.toContain('wild_gap_key');
  });

  it.each([
    {
      branch: '抽牌续链',
      cardId: 'pulse_draw' as CardId,
      choices: ['pulse_draw', 'blood_tithe', 'severance_burst'] as CardId[]
    },
    {
      branch: '修补保命',
      cardId: 'blood_tithe' as CardId,
      choices: ['pulse_draw', 'blood_tithe', 'severance_burst'] as CardId[]
    },
    {
      branch: '终结爆发',
      cardId: 'severance_burst' as CardId,
      choices: ['pulse_draw', 'blood_tithe', 'severance_burst'] as CardId[]
    }
  ])('records the D3 $branch reward fork as deck growth, payoff evidence, and settlement summary', ({ cardId, choices }) => {
    const world = continueToD3(`activity-d3-fork-${cardId}`);
    world.player.deck = [
      'debt_hook',
      'redline_cut',
      'row_cleave',
      'severance_burst',
      'guard_reserve',
      'guard_reserve',
      'shield_reserve',
      'shield_reserve',
      'guard_reserve'
    ];
    const deckSizeBefore = world.player.deck.length;

    forceFinalRewardReady(world, choices);
    const planBeforePick = createBuildPlan(world);
    selectReward(world, cardId, `activity-d3-fork-${cardId}-reward`);

    expect(planBeforePick.issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining(['missing-bridge', 'missing-finisher', 'need-resource'])
    );
    expect(planBeforePick.issues.flatMap((issue) => issue.evidence)).toContain(
      '奖励分叉 抽牌续链: 脉冲抽牌 / 修补保命: 血税 / 终结爆发: 断账爆发'
    );
    expect(world.player.deck).toContain(cardId);
    expect(world.player.deck).toHaveLength(deckSizeBefore + 1);
    expect(world.run.rewardHistory[world.run.rewardHistory.length - 1]).toMatchObject({
      node: 6,
      selectedCardId: cardId,
      choices
    });
    expect(world.activitySettlementPreview).toMatchObject({
      currentLevelLabel: 'D3',
      completed: true,
      nextLevelId: 'd4'
    });
    expect(world.fsm.gameFlow).toBe('Settlement');
  });

  it('restarts the current difficulty from its activity entry snapshot without advancing activity', () => {
    let world = createInitialWorld(1, createInitialActivityState());
    world.run.status = 'failure';
    world.fsm.gameFlow = 'Settlement';

    world = restartCurrentLevel(world, 'activity-failure-restart');
    expect(currentActivityLevel(world.activity!).id).toBe('d1');
    expect(world.activity?.completedLevelIds).toEqual([]);

    forceRewardReady(world);
    selectReward(world, 'wild_gap_key', 'activity-midrun-reward');
    expect(world.run.currentNode).toBe(1);
    expect(world.player.deck).toContain('wild_gap_key');

    world = restartCurrentLevel(world, 'activity-midrun-restart');
    expect(currentActivityLevel(world.activity!).id).toBe('d1');
    expect(world.activity?.completedLevelIds).toEqual([]);
    expect(world.run.maxNodes).toBe(3);
    expect(world.player.deck).toEqual(startingHand);
    expect(world.player.deck).not.toContain('wild_gap_key');
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

  it('keeps activity progression scoped while carrying activity deck growth without new playable tiers', () => {
    let world = createInitialWorld(1, createInitialActivityState());
    expect(world.activity?.playableLevelIds).toEqual(['d1', 'd2', 'd3', 'd4']);
    expect(world.activity).not.toHaveProperty('routeCarryover');

    winCurrentLevel(world, 'activity-scope-win-d1');
    world = continueActivity(world, 'activity-scope-continue-d2');
    expect(currentActivityLevel(world.activity!).id).toBe('d2');
    expect(world.player.deck).toEqual([...startingHand, 'severance_burst']);
    expect((world.activity as unknown as { carryover?: { deck: CardId[] } }).carryover?.deck).toEqual([
      ...startingHand,
      'severance_burst'
    ]);
    expect(world.activity).not.toHaveProperty('routeCarryover');

    winCurrentLevel(world, 'activity-scope-win-d2', 'wild_gap_key', ['wild_gap_key', 'blood_reclaim', 'pulse_draw']);
    world = continueActivity(world, 'activity-scope-continue-d3');
    expect(currentActivityLevel(world.activity!).id).toBe('d3');
    expect(world.player.deck).toEqual([...startingHand, 'severance_burst', 'wild_gap_key']);
    expect(world.activity?.playableLevelIds).not.toContain('d5');
    expect(world.activity?.playableLevelIds).not.toContain('d10');
  });

  it('inherits deck, reward pool, base attributes, xp, and upgrades from D1 into D2 inside one activity', () => {
    let world = createInitialWorld(1, createInitialActivityState());
    world.player.hp = 17;
    world.activity!.carryover.maxEnergy = 4;
    world.player.maxEnergy = 4;
    world.player.energy = 4;
    world.player.xp = 13;
    world.player.level = 2;
    world.reward.xpThreshold = 24;

    forceFinalRewardReady(world, ['severance_burst', 'wild_gap_key', 'blood_reclaim']);
    selectReward(world, 'severance_burst', 'activity-carryover-d1-reward');
    expect(world.player.deck).toContain('severance_burst');
    expect(world.reward.candidateCardPool).not.toContain('severance_burst');

    world.cardUpgrades.enhancements.debt_hook = {
      cardId: 'debt_hook',
      level: 1,
      gemSlots: [{ color: 'red', gemId: null }]
    };
    world.cardUpgrades.history.push({
      tick: world.tick,
      traceId: 'activity-carryover-upgrade-history',
      cardId: 'debt_hook',
      choiceId: 'activity-carryover-upgrade:debt_hook:raise-level:0',
      choiceType: 'raise-level',
      level: 1,
      gemSlots: [{ color: 'red', gemId: null }]
    });
    world.cardUpgrades.choices = [
      {
        id: 'activity-carryover-pending:debt_hook:raise-level:0',
        type: 'raise-level',
        targetCardId: 'debt_hook',
        label: '债钩 +1',
        description: 'pending choice must not cross activity level boundary',
        damageBonusPreview: 2
      }
    ];
    world.cardUpgrades.pending = true;

    world = continueActivity(world, 'activity-carryover-continue-d2');

    expect(currentActivityLevel(world.activity!).id).toBe('d2');
    expect(world.player.deck).toEqual([...startingHand, 'severance_burst']);
    expect(world.player.drawPile).toEqual([...startingHand, 'severance_burst']);
    expect(world.player.hand).toEqual([]);
    expect(world.player.discardPile).toEqual([]);
    expect(world.player.exhaustPile).toEqual([]);
    expect(world.player.retainedCards).toEqual([]);
    expect(world.reward.candidateCardPool).not.toContain('severance_burst');
    expect(world.player.hp).toBe(72);
    expect(world.player.maxHp).toBe(72);
    expect(world.player.maxEnergy).toBe(4);
    expect(world.player.energy).toBe(4);
    expect(world.player.xp).toBe(13);
    expect(world.player.level).toBe(2);
    expect(world.reward.xpThreshold).toBe(24);
    expect(world.cardUpgrades.enhancements.debt_hook?.level).toBe(1);
    expect(world.cardUpgrades.history).toHaveLength(1);
    expect(world.cardUpgrades.choices).toEqual([]);
    expect(world.cardUpgrades.pending).toBe(false);
    expect(world.run.rewardHistory).toEqual([]);
    expect(world.route?.history).toEqual([]);
    expect(world.chain.playedCosts).toEqual([]);
    expect(world.player.tempAuthorizationMP).toBe(0);
    expect(world.player.authorizationRestriction).toBeNull();
    expect(world.player.payoffArmed).toBe(false);
  });

  it('keeps inherited D1 and D2 deck growth when continuing into D3', () => {
    let world = createInitialWorld(1, createInitialActivityState());

    forceFinalRewardReady(world, ['severance_burst', 'wild_gap_key', 'blood_reclaim']);
    selectReward(world, 'severance_burst', 'activity-carryover-d1');
    world = continueActivity(world, 'activity-carryover-d2');

    forceFinalRewardReady(world, ['wild_gap_key', 'blood_reclaim', 'pulse_draw']);
    selectReward(world, 'wild_gap_key', 'activity-carryover-d2-reward');
    world = continueActivity(world, 'activity-carryover-d3');

    expect(currentActivityLevel(world.activity!).id).toBe('d3');
    expect(world.player.deck).toEqual([...startingHand, 'severance_burst', 'wild_gap_key']);
    expect(world.reward.candidateCardPool).not.toContain('severance_burst');
    expect(world.reward.candidateCardPool).not.toContain('wild_gap_key');
  });

  it('restarts current activity level from the saved level-start carryover instead of failed mid-run rewards', () => {
    let world = createInitialWorld(1, createInitialActivityState());
    forceFinalRewardReady(world, ['severance_burst', 'wild_gap_key', 'blood_reclaim']);
    selectReward(world, 'severance_burst', 'activity-restart-boundary-d1');
    world = continueActivity(world, 'activity-restart-boundary-d2');

    forceRewardReady(world, ['wild_gap_key', 'blood_reclaim', 'pulse_draw']);
    selectReward(world, 'wild_gap_key', 'activity-restart-boundary-midrun-reward');
    expect(world.player.deck).toContain('wild_gap_key');
    world.player.xp = 99;
    world.player.level = 7;
    world.player.maxEnergy = 5;
    world.reward.candidateCardPool = ['pulse_draw'];
    world.cardUpgrades.enhancements.redline_cut = {
      cardId: 'redline_cut',
      level: 2,
      gemSlots: []
    };

    world = restartCurrentLevel(world, 'activity-restart-boundary-restart-d2');

    expect(currentActivityLevel(world.activity!).id).toBe('d2');
    expect(world.activity?.completedLevelIds).toEqual(['d1']);
    expect(world.player.deck).toEqual([...startingHand, 'severance_burst']);
    expect(world.player.deck).not.toContain('wild_gap_key');
    expect(world.reward.candidateCardPool).not.toContain('severance_burst');
    expect(world.reward.candidateCardPool).toContain('wild_gap_key');
    expect(world.player.xp).toBe(0);
    expect(world.player.level).toBe(1);
    expect(world.player.maxEnergy).toBe(3);
    expect(world.cardUpgrades.enhancements.redline_cut).toBeUndefined();
    expect(world.run.rewardHistory).toEqual([]);
    expect(world.route?.history).toEqual([]);
  });

  it('treats restart-run as the same current-level restart inside activity mode', () => {
    let world = createInitialWorld(1, createInitialActivityState());
    forceFinalRewardReady(world, ['severance_burst', 'wild_gap_key', 'blood_reclaim']);
    selectReward(world, 'severance_burst', 'activity-restart-run-boundary-d1');
    world = continueActivity(world, 'activity-restart-run-boundary-d2');

    forceRewardReady(world, ['wild_gap_key', 'blood_reclaim', 'pulse_draw']);
    selectReward(world, 'wild_gap_key', 'activity-restart-run-boundary-midrun-reward');
    expect(world.player.deck).toContain('wild_gap_key');

    world = restartRun(world, 'activity-restart-run-boundary-restart-d2');

    expect(currentActivityLevel(world.activity!).id).toBe('d2');
    expect(world.activity?.completedLevelIds).toEqual(['d1']);
    expect(world.player.deck).toEqual([...startingHand, 'severance_burst']);
    expect(world.player.deck).not.toContain('wild_gap_key');
  });

  it('deep-clones activity carryover into snapshots', () => {
    let world = createInitialWorld(1, createInitialActivityState());
    forceFinalRewardReady(world, ['severance_burst', 'wild_gap_key', 'blood_reclaim']);
    selectReward(world, 'severance_burst', 'activity-snapshot-carryover-d1');
    world.cardUpgrades.enhancements.debt_hook = {
      cardId: 'debt_hook',
      level: 1,
      gemSlots: [{ color: 'red', gemId: null }]
    };
    world = continueActivity(world, 'activity-snapshot-carryover-d2');

    const snapshot = buildSnapshot(world);
    snapshot.player.deck.push('wild_gap_key');
    snapshot.activity!.carryover.deck.push('wild_gap_key');
    snapshot.activity!.carryover.rewardCandidateCardPool.push('severance_burst');
    snapshot.activity!.carryover.cardUpgrades.enhancements.debt_hook!.gemSlots[0].gemId = 'crimson_chip';

    expect(world.player.deck).toEqual([...startingHand, 'severance_burst']);
    expect(world.activity!.carryover.deck).toEqual([...startingHand, 'severance_burst']);
    expect(world.activity!.carryover.rewardCandidateCardPool).not.toContain('severance_burst');
    expect(world.activity!.carryover.cardUpgrades.enhancements.debt_hook!.gemSlots[0].gemId).toBeNull();
  });

  it('keeps maxEnergyThisRunPlusOne scoped to the current small-run instead of activity carryover', () => {
    let world = createInitialWorld(1, createInitialActivityState());

    forceRewardReady(world, ['severance_burst', 'wild_gap_key', 'blood_reclaim']);
    selectReward(world, 'severance_burst', 'activity-temp-energy-reward');
    selectRouteByKind(world, 'elite-pressure', 'activity-temp-energy-route');
    expect(world.player.maxEnergy).toBe(4);
    expect(world.player.energy).toBe(4);

    winCurrentLevel(world, 'activity-temp-energy-win-d1', 'wild_gap_key', ['wild_gap_key', 'blood_reclaim', 'pulse_draw']);
    world = continueActivity(world, 'activity-temp-energy-continue-d2');

    expect(currentActivityLevel(world.activity!).id).toBe('d2');
    expect(world.activity!.carryover.maxEnergy).toBe(3);
    expect(world.player.maxEnergy).toBe(3);
    expect(world.player.energy).toBe(3);
  });

  it('accumulates activity reward history across completed small-runs', () => {
    let world = createInitialWorld(1, createInitialActivityState());

    winCurrentLevel(world, 'activity-history-win-d1', 'severance_burst', [
      'severance_burst',
      'wild_gap_key',
      'blood_reclaim'
    ]);
    world = continueActivity(world, 'activity-history-continue-d2');
    winCurrentLevel(world, 'activity-history-win-d2', 'wild_gap_key', ['wild_gap_key', 'blood_reclaim', 'pulse_draw']);
    world = continueActivity(world, 'activity-history-continue-d3');

    expect(world.activity!.carryover.activityRewardHistory.map((entry) => entry.selectedCardId)).toEqual([
      'severance_burst',
      'wild_gap_key'
    ]);
  });

  it('does not capture carryover when continue-activity is not a legal victory settlement action', () => {
    const cases: Array<{ name: string; mutate?: (world: WorldState) => void }> = [
      { name: 'non-settlement' },
      {
        name: 'non-victory-settlement',
        mutate: (world) => {
          world.fsm.gameFlow = 'Settlement';
          world.run.status = 'failure';
        }
      },
      {
        name: 'cannot-continue-preview',
        mutate: (world) => {
          world.fsm.gameFlow = 'Settlement';
          world.run.status = 'victory';
          world.activitySettlementPreview = {
            currentLevelId: 'd1',
            currentLevelLabel: 'D1',
            currentLevelTitle: '试营业清算',
            completed: true,
            nextLevelId: null,
            nextLevelLabel: null,
            canContinue: false
          };
        }
      }
    ];

    for (const testCase of cases) {
      const world = createInitialWorld(1, createInitialActivityState());
      testCase.mutate?.(world);
      const entryDeck = [...world.activity!.carryover.deck];
      world.player.deck.push('severance_burst');

      const continued = continueActivity(world, `activity-carryover-illegal-continue-${testCase.name}`);

      expect(continued).toBe(world);
      expect(world.activity!.currentLevelId).toBe('d1');
      expect(world.activity!.carryover.deck).toEqual(entryDeck);
    }
  });

  it('defines D2 as a three-node low-pressure bridge without changing D4 or adding new tiers', () => {
    const d2Level = resolveActivityLevelDefinition('d2');
    expect(d2Level.title).toBe('三节点桥接清算');
    expect(d2Level.nodeCount).toBe(3);
    expect(d2Level.playerMaxHp).toBe(68);
    expect(d2Level.enemyHpMultiplier).toBe(0.65);
    expect(d2Level.enemyDamageMultiplier).toBe(0.25);
    expect(d2Level.rewardPickCount).toBe(4);
    expect(d2Level.eliteRouteEntryDamage).toBe(3);
    expect(d2Level.eliteRouteAddsPollution).toBe(false);

    const d4Level = resolveActivityLevelDefinition('d4');
    expect(d4Level.nodeCount).toBe(6);
    expect(d4Level.playerMaxHp).toBe(60);
    expect(d4Level.enemyHpMultiplier).toBe(0.45);
    expect(d4Level.enemyDamageMultiplier).toBe(0.25);
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

    world = continueActivity(world, 'd1-natural-continue-d2');
    const d2Level = currentActivityLevel(world.activity!);
    expect(d2Level.id).toBe('d2');
    expect(d2Level.nodeCount).toBe(3);
    expect(d2Level.rewardPickCount).toBe(4);

    world = playConservativeRun(world, 'd2-natural');

    expect(world.fsm.gameFlow).toBe('Settlement');
    expect(world.run.status).toBe('victory');
    expect(world.run.currentNode).toBe(3);
    expect(world.player.hp).toBeGreaterThanOrEqual(18);
    expect(hpRatio(world)).toBeGreaterThanOrEqual(0.6);
    expect(hpRatio(world)).toBeLessThanOrEqual(0.8);
    expect(world.player.deck.length).toBeGreaterThan(startingHand.length);
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
    expect(world.run.currentNode).toBe(3);
    expect(world.player.hp).toBeGreaterThanOrEqual(18);
    const d2HpRatio = hpRatio(world);

    world = continueActivity(world, 'd2-natural-continue-d3');
    const d3Level = currentActivityLevel(world.activity!);
    expect(d3Level.id).toBe('d3');
    expect(d3Level.nodeCount).toBe(6);
    expect(d3Level.playerMaxHp).toBe(98);
    expect(d3Level.playerMaxHp).toBeLessThan(100);
    expect(d3Level.enemyHpMultiplier).toBe(0.45);
    expect(d3Level.enemyDamageMultiplier).toBe(0.45);
    expect(d3Level.rewardPickCount).toBe(3);
    expect(d3Level.eliteRouteEntryDamage).toBe(10);
    expect(d3Level.eliteRouteAddsPollution).toBe(true);
    expect(world.player.hp).toBe(98);
    expect(world.player.maxHp).toBe(98);

    world = playBrowserConservativeRun(world, 'd3-browser-conservative-first-clear', 420);

    expect(world.fsm.gameFlow).toBe('Settlement');
    expect(world.run.status).toBe('victory');
    expect(world.run.currentNode).toBe(6);
    expect(world.round).toBeGreaterThanOrEqual(18);
    expect(world.player.hp).toBeGreaterThanOrEqual(12);
    expect(hpRatio(world)).toBeLessThanOrEqual(0.7);
    expect(hpRatio(world)).toBeLessThan(d2HpRatio);
    expect(world.player.deck.length).toBeGreaterThan(startingHand.length);
    expect(world.run.rewardHistory.map((entry) => entry.node)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('lets a conservative player first-clear D4 after D1-D3 without forcing an elite route', () => {
    let world = createInitialWorld(1, createInitialActivityState());

    world = playConservativeRun(world, 'd4-first-clear-d1');
    expect(world.fsm.gameFlow).toBe('Settlement');
    expect(world.run.status).toBe('victory');

    world = continueActivity(world, 'd4-first-clear-continue-d2');
    world = playConservativeRun(world, 'd4-first-clear-d2');
    expect(world.fsm.gameFlow).toBe('Settlement');
    expect(world.run.status).toBe('victory');

    world = continueActivity(world, 'd4-first-clear-continue-d3');
    world = playBrowserConservativeRun(world, 'd4-first-clear-d3', 420);
    expect(world.fsm.gameFlow).toBe('Settlement');
    expect(world.run.status).toBe('victory');

    world = continueActivity(world, 'd4-first-clear-continue-d4');
    expect(currentActivityLevel(world.activity!).id).toBe('d4');
    expect(resolveActivityLevelDefinition('d4').enemyDamageMultiplier).toBe(0.25);

    world = playConservativeRun(world, 'd4-first-clear-conservative', 520);

    expect(world.fsm.gameFlow).toBe('Settlement');
    expect(world.run.status).toBe('victory');
    expect(world.run.currentNode).toBe(6);
    expect(world.player.hp).toBeGreaterThan(0);
    expect(world.run.pressure?.failureBoundaryNode).toBeNull();
  });
});
