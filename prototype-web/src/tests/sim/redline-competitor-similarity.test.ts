import { describe, expect, it } from 'vitest';
import { tickWorld } from '../../sim/runtime';
import { createInitialWorld } from '../../sim/world';
import type { CardId, GameEvent, WorldState } from '../../sim/types';

function dealOpeningHand(world: WorldState): void {
  tickWorld(world, [
    {
      type: 'advance-time',
      deltaSeconds: 0.016,
      traceId: 'competitor-auto-deal'
    }
  ]);
}

function prepareHand(world: WorldState, hand: CardId[]): void {
  dealOpeningHand(world);
  world.player.maxEnergy = 3;
  world.player.energy = 3;
  world.player.hand = [...hand];
  world.player.drawPile = [];
  world.player.discardPile = [];
  for (const enemy of Object.values(world.enemies)) {
    enemy.hp = 200;
    enemy.maxHp = 200;
  }
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

function playedCard(world: WorldState, traceId: string): Extract<GameEvent, { type: 'CardPlayed' }> | undefined {
  return world.debug.events.find(
    (event): event is Extract<GameEvent, { type: 'CardPlayed' }> =>
      event.type === 'CardPlayed' && event.traceId === traceId
  );
}

function chainRepaired(world: WorldState, traceId: string): Extract<GameEvent, { type: 'ChainRepaired' }> | undefined {
  return world.debug.events.find(
    (event): event is Extract<GameEvent, { type: 'ChainRepaired' }> =>
      event.type === 'ChainRepaired' && event.traceId === traceId
  );
}

function chainExtended(world: WorldState, traceId: string): (GameEvent & Record<string, unknown>) | undefined {
  return world.debug.events.find(
    (event): event is GameEvent & Record<string, unknown> =>
      (event as { type: string }).type === 'ChainExtended' && event.traceId === traceId
  );
}

function payoffTriggered(world: WorldState, traceId: string): Extract<GameEvent, { type: 'PayoffTriggered' }> | undefined {
  return world.debug.events.find(
    (event): event is Extract<GameEvent, { type: 'PayoffTriggered' }> =>
      event.type === 'PayoffTriggered' && event.traceId === traceId
  );
}

describe('redline competitor similarity stack extension', () => {
  it('lets Wild Gap Key extend 0->1->2 at effective cost 3 while paying its printed cost', () => {
    const world = createInitialWorld();
    prepareHand(world, ['debt_hook', 'redline_cut', 'row_cleave', 'wild_gap_key']);
    world.player.maxEnergy = 4;
    world.player.energy = 4;

    playCard(world, 'debt_hook', 'wild-extend-0', 'enemy-1');
    playCard(world, 'redline_cut', 'wild-extend-1', 'enemy-2');
    playCard(world, 'row_cleave', 'wild-extend-2');
    playCard(world, 'wild_gap_key', 'wild-extend-3', 'enemy-3');

    expect(world.debug.events).toContainEqual(
      expect.objectContaining({
        type: 'AuthorizationGranted',
        traceId: 'wild-extend-2'
      })
    );
    expect(playedCard(world, 'wild-extend-3')).toMatchObject({
      printedCost: 1,
      currentEnergyPaid: 1,
      effectiveCost: 3,
      effectMultiplier: 4,
      chainRepaired: false,
      repairedCost: undefined,
      chainExtended: true,
      extendedCost: 3
    });
    expect(chainRepaired(world, 'wild-extend-3')).toBeUndefined();
    expect(chainExtended(world, 'wild-extend-3')).toMatchObject({
      extendedCost: 3,
      multiplier: 4
    });
  });

  it('keeps Wild Mana Stitch from repairing expected cost 3', () => {
    const world = createInitialWorld();
    prepareHand(world, ['debt_hook', 'redline_cut', 'row_cleave', 'wild_mana_stitch']);

    playCard(world, 'debt_hook', 'stitch-no-3-0', 'enemy-1');
    playCard(world, 'redline_cut', 'stitch-no-3-1', 'enemy-2');
    playCard(world, 'row_cleave', 'stitch-no-3-2');
    playCard(world, 'wild_mana_stitch', 'stitch-no-3');

    expect(world.chain.broken).toBe(true);
    expect(playedCard(world, 'stitch-no-3')).toMatchObject({
      effectiveCost: 0,
      effectMultiplier: 1,
      chainRepaired: false,
      repairedCost: undefined,
      chainExtended: false,
      extendedCost: undefined
    });
    expect(chainRepaired(world, 'stitch-no-3')).toBeUndefined();
    expect(chainExtended(world, 'stitch-no-3')).toBeUndefined();
  });

  it('does not let Wild Gap Key repair after the chain is already broken', () => {
    const world = createInitialWorld();
    prepareHand(world, ['debt_hook', 'row_cleave', 'wild_gap_key']);

    playCard(world, 'debt_hook', 'gap-broken-0', 'enemy-1');
    playCard(world, 'row_cleave', 'gap-broken-2');
    playCard(world, 'wild_gap_key', 'gap-broken-repair', 'enemy-2');

    expect(world.chain.broken).toBe(true);
    expect(playedCard(world, 'gap-broken-repair')).toMatchObject({
      effectiveCost: 1,
      chainRepaired: false,
      repairedCost: undefined,
      chainExtended: false,
      extendedCost: undefined
    });
    expect(chainRepaired(world, 'gap-broken-repair')).toBeUndefined();
    expect(chainExtended(world, 'gap-broken-repair')).toBeUndefined();
  });

  it('does not require current MP equal to the repaired effective cost', () => {
    const world = createInitialWorld();
    prepareHand(world, ['debt_hook', 'redline_cut', 'row_cleave', 'wild_gap_key']);
    world.player.maxEnergy = 4;
    world.player.energy = 4;

    playCard(world, 'debt_hook', 'wild-printed-0', 'enemy-1');
    playCard(world, 'redline_cut', 'wild-printed-1', 'enemy-2');
    playCard(world, 'row_cleave', 'wild-printed-2');

    expect(world.player.energy).toBe(1);

    playCard(world, 'wild_gap_key', 'wild-printed-3', 'enemy-3');

    expect(
      world.debug.failedConditions.some(
        (condition) => condition.traceId === 'wild-printed-3' && condition.conditionId === 'enough-energy'
      )
    ).toBe(false);
    expect(playedCard(world, 'wild-printed-3')).toMatchObject({
      printedCost: 1,
      currentEnergyPaid: 1,
      effectiveCost: 3,
      chainRepaired: false,
      chainExtended: true,
      extendedCost: 3
    });
  });

  it('keeps payoff value from degrading on a 0->1->2->wild gap->3 path', () => {
    const world = createInitialWorld();
    prepareHand(world, ['debt_hook', 'redline_cut', 'row_cleave', 'wild_gap_key', 'severance_burst']);
    world.player.maxEnergy = 4;
    world.player.energy = 4;

    playCard(world, 'debt_hook', 'payoff-wild-0', 'enemy-1');
    playCard(world, 'redline_cut', 'payoff-wild-1', 'enemy-2');
    playCard(world, 'row_cleave', 'payoff-wild-2');
    playCard(world, 'wild_gap_key', 'payoff-wild-extension', 'enemy-3');
    playCard(world, 'severance_burst', 'payoff-after-wild');

    expect(playedCard(world, 'payoff-wild-extension')).toMatchObject({
      effectiveCost: 3,
      effectMultiplier: 4,
      chainRepaired: false,
      chainExtended: true,
      extendedCost: 3
    });
    expect(playedCard(world, 'payoff-after-wild')?.effectMultiplier ?? 0).toBeGreaterThanOrEqual(4);
    expect(payoffTriggered(world, 'payoff-after-wild')).toMatchObject({
      cardId: 'severance_burst',
      enhanced: true
    });
  });
});
