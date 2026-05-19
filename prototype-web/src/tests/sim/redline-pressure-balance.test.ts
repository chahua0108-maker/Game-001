import { describe, expect, it } from 'vitest';
import { tickWorld } from '../../sim/runtime';
import { createInitialWorld } from '../../sim/world';
import type { CardId, GameEvent, WorldState } from '../../sim/types';

function dealOpeningHand(world: WorldState): void {
  tickWorld(world, [{ type: 'deal-hand', traceId: 'pressure-deal' }]);
}

function playCard(world: WorldState, cardId: CardId, traceId: string): void {
  tickWorld(world, [{ type: 'play-card', cardId, traceId }]);
}

function endTurn(world: WorldState, traceId = 'pressure-end-turn'): void {
  tickWorld(world, [{ type: 'end-turn', traceId }]);
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

describe('round 14 pressure balance slice', () => {
  it('keeps pollution status cards from advancing the cost chain or granting authorization', () => {
    const world = createInitialWorld();
    dealOpeningHand(world);
    world.player.hand = ['static_overload', 'redline_cut', 'row_cleave'];
    world.player.energy = world.player.maxEnergy;

    playCard(world, 'static_overload', 'pressure-status-play');

    expect(world.player.exhaustPile).toEqual(['static_overload']);
    expect(world.chain.playedCosts).toEqual([]);
    expect(world.chain.nextExpectedCost).toBe(0);
    expect(world.player.tempAuthorizationMP).toBe(0);
    expect(eventsOf(world, 'pressure-status-play', 'ChainAdvanced')).toHaveLength(0);
    expect(eventsOf(world, 'pressure-status-play', 'AuthorizationGranted')).toHaveLength(0);
    expect(eventsOf(world, 'pressure-status-play', 'CardPlayed')).toContainEqual(
      expect.objectContaining({
        cardId: 'static_overload',
        effectMultiplier: 1,
        effectiveCost: 0
      })
    );
  });

  it('turns unresolved enemy intent damage into one pollution card that can squeeze the next hand', () => {
    const world = createInitialWorld();
    dealOpeningHand(world);
    const hpBefore = world.player.hp;
    const intentBefore = world.enemyIntentSummary.totalDamage;
    world.player.hand = [];
    world.player.drawPile = [];
    world.player.discardPile = ['debt_hook', 'redline_cut', 'heartbeat_spark'];

    endTurn(world);

    expect(intentBefore).toBeGreaterThan(0);
    expect(world.player.hp).toBe(hpBefore - intentBefore);
    expect(eventsOf(world, 'pressure-end-turn', 'PressurePollutionAdded')).toContainEqual(
      expect.objectContaining({
        cardId: 'static_overload',
        damageTaken: intentBefore,
        toZone: 'discardPile'
      })
    );
    expect(world.player.hand).toContain('static_overload');
    expect(world.player.hand.filter((cardId) => cardId !== 'static_overload')).toHaveLength(3);
  });
});
