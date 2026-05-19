import { describe, expect, it } from 'vitest';
import { cards } from '../../data/cards';
import { tickWorld } from '../../sim/runtime';
import { createInitialWorld } from '../../sim/world';
import type { CardId, Command, GameEvent, WorldState } from '../../sim/types';

function dealOpeningHand(world: WorldState): void {
  tickWorld(world, [
    {
      type: 'advance-time',
      deltaSeconds: 0.016,
      traceId: 'paper-topdeck-deal'
    }
  ]);
}

function prepareHand(world: WorldState, hand: CardId[], drawPile: CardId[], discardPile: CardId[] = [], energy = 3): void {
  dealOpeningHand(world);
  world.player.hand = [...hand];
  world.player.drawPile = [...drawPile];
  world.player.discardPile = [...discardPile];
  world.player.maxEnergy = 3;
  world.player.energy = energy;
}

function keepEnemiesAlive(world: WorldState): void {
  Object.values(world.enemies).forEach((enemy) => {
    enemy.hp = 50;
    enemy.maxHp = 50;
  });
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

function eventIndex(world: WorldState, traceId: string, type: GameEvent['type']): number {
  return world.debug.events.findIndex((event) => event.traceId === traceId && event.type === type);
}

function commandIndex(world: WorldState, traceId: string, type: Command['type']): number {
  return world.debug.commands.findIndex((command) => command.traceId === traceId && command.type === type);
}

describe('paper_shatter payoff topdeck contract', () => {
  it('topdecks the first drawPile payoff before paper_shatter draws', () => {
    const world = createInitialWorld();
    prepareHand(world, ['paper_shatter'], ['spark_tap', 'severance_burst', 'wild_gap_key']);

    playCard(world, 'paper_shatter', 'paper-topdeck-hit');

    expect(cards.paper_shatter.preDrawTopdeckPayoff).toBe(true);
    expect(eventOf(world, 'paper-topdeck-hit', 'CardPlayed')).toMatchObject({
      cardId: 'paper_shatter'
    });
    expect(eventOf(world, 'paper-topdeck-hit', 'PayoffTopdecked')).toMatchObject({
      sourceCardId: 'paper_shatter',
      cardId: 'severance_burst',
      fromIndex: 1,
      toIndex: 0,
      searchedCount: 2
    });
    expect(commandIndex(world, 'paper-topdeck-hit', 'TopdeckPayoffFromDrawPile')).toBeLessThan(
      commandIndex(world, 'paper-topdeck-hit', 'DrawCards')
    );
    expect(eventIndex(world, 'paper-topdeck-hit', 'PayoffTopdecked')).toBeLessThan(
      eventIndex(world, 'paper-topdeck-hit', 'HandDealt')
    );
    expect(eventOf(world, 'paper-topdeck-hit', 'HandDealt')?.cardIds[0]).toBe('severance_burst');
    expect(world.player.hand).toContain('severance_burst');
    expect(world.player.hand).not.toContain('paper_shatter');
    expect(world.player.drawPile).toEqual(['spark_tap', 'wild_gap_key']);
  });

  it('uses drawPile order instead of scoring payoff candidates', () => {
    const world = createInitialWorld();
    prepareHand(world, ['paper_shatter'], ['red_ledger_burst', 'spark_tap', 'severance_burst']);

    playCard(world, 'paper_shatter', 'paper-topdeck-order');

    expect(eventOf(world, 'paper-topdeck-order', 'PayoffTopdecked')).toMatchObject({
      cardId: 'red_ledger_burst',
      fromIndex: 0,
      searchedCount: 1
    });
    expect(eventOf(world, 'paper-topdeck-order', 'HandDealt')?.cardIds[0]).toBe('red_ledger_burst');
    expect(world.player.drawPile).toEqual(['spark_tap', 'severance_burst']);
    expect(eventsOf(world, 'paper-topdeck-order', 'PayoffTopdecked')).toHaveLength(1);
  });

  it('misses cleanly when drawPile has no payoff and still draws normally', () => {
    const world = createInitialWorld();
    prepareHand(world, ['paper_shatter'], ['spark_tap', 'wild_gap_key'], ['severance_burst']);

    playCard(world, 'paper_shatter', 'paper-topdeck-miss');

    expect(eventOf(world, 'paper-topdeck-miss', 'PayoffTopdecked')).toBeUndefined();
    expect(eventOf(world, 'paper-topdeck-miss', 'PayoffTopdeckMissed')).toMatchObject({
      sourceCardId: 'paper_shatter',
      searchedCount: 2
    });
    expect(eventOf(world, 'paper-topdeck-miss', 'HandDealt')?.cardIds).toEqual(['spark_tap']);
    expect(world.player.hand).toEqual(['spark_tap']);
    expect(world.player.discardPile).toEqual(expect.arrayContaining(['paper_shatter', 'severance_burst']));
  });

  it('does not enable lantern_captain or search the discard pile', () => {
    const world = createInitialWorld();
    prepareHand(world, ['lantern_captain'], ['spark_tap', 'severance_burst', 'wild_gap_key']);

    playCard(world, 'lantern_captain', 'lantern-no-topdeck');

    expect(cards.lantern_captain.preDrawTopdeckPayoff).toBeUndefined();
    expect(commandIndex(world, 'lantern-no-topdeck', 'TopdeckPayoffFromDrawPile')).toBe(-1);
    expect(eventOf(world, 'lantern-no-topdeck', 'PayoffTopdecked')).toBeUndefined();
    expect(eventOf(world, 'lantern-no-topdeck', 'HandDealt')?.cardIds).toEqual(['spark_tap']);
    expect(world.player.drawPile).toEqual(['severance_burst', 'wild_gap_key']);
  });

  it('excludes the source card id when searching the draw pile', () => {
    const world = createInitialWorld();
    prepareHand(world, ['paper_shatter'], ['paper_shatter', 'severance_burst', 'red_ledger_burst']);

    playCard(world, 'paper_shatter', 'paper-topdeck-exclude-source');

    expect(eventOf(world, 'paper-topdeck-exclude-source', 'PayoffTopdecked')).toMatchObject({
      cardId: 'severance_burst',
      fromIndex: 1
    });
    expect(eventOf(world, 'paper-topdeck-exclude-source', 'HandDealt')?.cardIds).toEqual(['severance_burst']);
    expect(world.player.hand).not.toContain('paper_shatter');
    expect(world.player.drawPile).toEqual(['paper_shatter', 'red_ledger_burst']);
  });

  it('keeps authorization and payoff payment contracts intact after topdecking a finisher', () => {
    const world = createInitialWorld();
    prepareHand(world, ['debt_hook', 'redline_cut', 'paper_shatter'], ['severance_burst']);
    keepEnemiesAlive(world);
    const intentBefore = world.enemyIntentSummary.totalDamage;

    playCard(world, 'debt_hook', 'paper-auth-0', 'enemy-1');
    playCard(world, 'redline_cut', 'paper-auth-1', 'enemy-2');
    playCard(world, 'paper_shatter', 'paper-auth-2');

    expect(eventOf(world, 'paper-auth-2', 'PayoffTopdecked')).toMatchObject({
      cardId: 'severance_burst'
    });
    expect(eventOf(world, 'paper-auth-2', 'HandDealt')?.cardIds).toContain('severance_burst');
    expect(world.player.tempAuthorizationMP).toBe(3);
    expect(world.player.payoffArmed).toBe(true);

    playCard(world, 'severance_burst', 'paper-auth-payoff');

    expect(eventOf(world, 'paper-auth-payoff', 'CardPaymentRecorded')).toMatchObject({
      authorizationPaid: 3,
      source: 'authorization'
    });
    expect(eventOf(world, 'paper-auth-payoff', 'PayoffResolved')).toMatchObject({
      payoffArmed: true,
      intentDamageBefore: intentBefore,
      intentDamageAfter: 0
    });
  });
});
