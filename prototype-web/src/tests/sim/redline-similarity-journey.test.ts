import { describe, expect, it } from 'vitest';
import { tickWorld } from '../../sim/runtime';
import { createInitialWorld } from '../../sim/world';
import type { CardId, GameEvent, Intent, WorldState } from '../../sim/types';

function dealOpeningHand(world: WorldState): void {
  tickWorld(world, [
    {
      type: 'advance-time',
      deltaSeconds: 0.016,
      traceId: 'similarity-opening-deal'
    }
  ]);
}

function playCard(world: WorldState, cardId: CardId, traceId: string, targetId?: string): void {
  tickWorld(world, [
    {
      type: 'play-card',
      cardId,
      targetId,
      traceId
    }
  ]);
}

function endTurn(world: WorldState, traceId: string): void {
  tickWorld(world, [
    {
      type: 'end-turn',
      traceId
    }
  ]);
}

function selectReward(world: WorldState, cardId: CardId, traceId: string): void {
  tickWorld(world, [
    {
      type: 'select-reward',
      cardId,
      traceId
    } satisfies Intent
  ]);
  const routeId = world.route?.pendingNodeChoices[0]?.id;
  if (routeId) {
    tickWorld(world, [
      {
        type: 'select-route',
        routeId,
        traceId: `${traceId}-route`
      } satisfies Intent
    ]);
  }
}

function eventOf<T extends GameEvent['type']>(
  world: WorldState,
  traceId: string,
  type: T
): Extract<GameEvent, { type: T }> | undefined {
  return world.debug.events.find(
    (event): event is Extract<GameEvent, { type: T }> => event.traceId === traceId && event.type === type
  );
}

function eventsOf<T extends GameEvent['type']>(
  world: WorldState,
  traceId: string,
  type: T
): Extract<GameEvent, { type: T }>[] {
  return world.debug.events.filter(
    (event): event is Extract<GameEvent, { type: T }> => event.traceId === traceId && event.type === type
  );
}

function frontRowEnemyIds(world: WorldState): string[] {
  return Object.values(world.enemies)
    .filter((enemy) => enemy.alive && enemy.slot >= 0 && enemy.slot < 5)
    .sort((left, right) => left.slot - right.slot)
    .map((enemy) => enemy.id);
}

function currentIntentDamagePreview(world: WorldState): number {
  if (world.enemyIntentSummary.totalDamage > 0) {
    return world.enemyIntentSummary.totalDamage;
  }

  const attackerIds = world.roundAttackEnemyIds.length > 0 ? world.roundAttackEnemyIds : frontRowEnemyIds(world);
  return attackerIds
    .map((enemyId) => world.enemies[enemyId])
    .filter((enemy): enemy is NonNullable<typeof enemy> => Boolean(enemy?.alive && enemy.slot >= 0 && enemy.slot < 5))
    .reduce((total, enemy) => total + enemy.damage, 0);
}

function stageSimilarityBurstTurn(world: WorldState): void {
  world.player.hand = ['debt_hook', 'redline_cut', 'row_cleave', 'wild_gap_key', 'severance_burst'];
  world.player.drawPile = [];
  world.player.discardPile = [];
  world.player.maxEnergy = 4;
  world.player.energy = 4;
  world.reward.xpThreshold = 1;
  world.reward.candidateCardPool = ['wild_gap_key', 'severance_burst', 'spark_tap'];
  world.reward.pickCount = 3;

  for (const enemy of Object.values(world.enemies)) {
    if (!enemy.alive) {
      continue;
    }
    enemy.hp = 50;
    enemy.maxHp = 50;
  }
}

describe('redline similarity journey sim', () => {
  it('runs a deterministic pressure -> chain -> wild extension -> payoff -> reward loop journey', () => {
    const world = createInitialWorld();

    dealOpeningHand(world);

    const pressureIntent = currentIntentDamagePreview(world);
    const hpBeforePressure = world.player.hp;

    endTurn(world, 'similarity-pressure-end');

    expect(pressureIntent).toBeGreaterThan(0);
    expect(world.round).toBe(2);
    expect(world.player.hp).toBe(hpBeforePressure - pressureIntent);
    expect(eventsOf(world, 'similarity-pressure-end', 'EnemyAttacked').length).toBeGreaterThan(0);

    stageSimilarityBurstTurn(world);

    const intentBeforePayoff = currentIntentDamagePreview(world);

    playCard(world, 'debt_hook', 'similarity-basic-0', 'enemy-1');
    playCard(world, 'redline_cut', 'similarity-basic-1', 'enemy-2');
    playCard(world, 'row_cleave', 'similarity-basic-2');

    expect(eventOf(world, 'similarity-basic-0', 'CardPlayed')).toMatchObject({
      cardId: 'debt_hook',
      effectiveCost: 0,
      effectMultiplier: 1
    });
    expect(eventOf(world, 'similarity-basic-1', 'CardPlayed')).toMatchObject({
      cardId: 'redline_cut',
      effectiveCost: 1,
      effectMultiplier: 2
    });
    expect(eventOf(world, 'similarity-basic-2', 'CardPlayed')).toMatchObject({
      cardId: 'row_cleave',
      effectiveCost: 2,
      effectMultiplier: 3,
      payoffArmed: false
    });
    expect(eventOf(world, 'similarity-basic-2', 'AuthorizationGranted')).toMatchObject({
      cardId: 'row_cleave',
      tempAuthorizationMP: 3,
      payoffArmed: true
    });

    playCard(world, 'wild_gap_key', 'similarity-wild-mp3-extension', 'enemy-3');

    expect(eventOf(world, 'similarity-wild-mp3-extension', 'CardPlayed')).toMatchObject({
      cardId: 'wild_gap_key',
      printedCost: 1,
      currentEnergyPaid: 1,
      effectiveCost: 3,
      effectMultiplier: 4,
      chainRepaired: false,
      chainExtended: true,
      extendedCost: 3
    });
    expect(eventOf(world, 'similarity-wild-mp3-extension', 'ChainExtended')).toMatchObject({
      cardId: 'wild_gap_key',
      extendedCost: 3,
      multiplier: 4
    });

    playCard(world, 'severance_burst', 'similarity-payoff-continues');

    expect(intentBeforePayoff).toBeGreaterThan(0);
    expect(eventOf(world, 'similarity-payoff-continues', 'CardPaymentRecorded')).toMatchObject({
      cardId: 'severance_burst',
      source: 'authorization',
      authorizationPaid: 3,
      payoffArmed: true
    });
    expect(eventOf(world, 'similarity-payoff-continues', 'CardPlayed')).toMatchObject({
      cardId: 'severance_burst',
      effectMultiplier: 5,
      authorizationPaid: 3,
      payoffArmed: true
    });
    expect(eventOf(world, 'similarity-payoff-continues', 'PayoffTriggered')).toMatchObject({
      cardId: 'severance_burst',
      chainLength: 5,
      multiplier: 5,
      enhanced: true
    });
    expect(eventOf(world, 'similarity-payoff-continues', 'PayoffResolved')).toMatchObject({
      cardId: 'severance_burst',
      payoffArmed: true,
      intentDamageBefore: intentBeforePayoff,
      intentDamageAfter: 0,
      preventedIntentDamage: intentBeforePayoff
    });
    expect(eventOf(world, 'similarity-payoff-continues', 'RewardChoicesGenerated')).toMatchObject({
      choices: ['wild_gap_key', 'severance_burst', 'spark_tap']
    });
    expect(world.fsm.gameFlow).toBe('Reward');

    selectReward(world, 'wild_gap_key', 'similarity-select-wild-gap-key');

    expect(eventOf(world, 'similarity-select-wild-gap-key', 'RewardChosen')).toMatchObject({
      cardId: 'wild_gap_key'
    });
    expect(eventOf(world, 'similarity-select-wild-gap-key', 'CardAddedToDeck')).toMatchObject({
      cardId: 'wild_gap_key'
    });
    expect(world.round).toBe(3);
    expect(world.run.currentNode).toBe(2);
    expect(world.fsm.gameFlow).toBe('PlayerTurn');
    expect(world.reward.pending).toBe(false);
    expect(world.player.deck).toContain('wild_gap_key');
    expect(world.player.hand).toContain('wild_gap_key');

    playCard(world, 'debt_hook', 'similarity-next-loop-0', frontRowEnemyIds(world)[0]);
    playCard(world, 'wild_gap_key', 'similarity-next-loop-reward-card', frontRowEnemyIds(world)[0]);
    playCard(world, 'row_cleave', 'similarity-next-loop-2');

    expect(eventOf(world, 'similarity-next-loop-reward-card', 'CardPlayed')).toMatchObject({
      cardId: 'wild_gap_key',
      effectiveCost: 1,
      effectMultiplier: 2,
      chainRepaired: true,
      repairedCost: 1
    });
    expect(eventOf(world, 'similarity-next-loop-reward-card', 'ChainRepaired')).toMatchObject({
      cardId: 'wild_gap_key',
      repairedCost: 1,
      multiplier: 2
    });
    expect(eventOf(world, 'similarity-next-loop-2', 'AuthorizationGranted')).toMatchObject({
      cardId: 'row_cleave',
      tempAuthorizationMP: 3,
      payoffArmed: true
    });
  });
});
