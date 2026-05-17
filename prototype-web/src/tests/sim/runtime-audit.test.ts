import { describe, expect, it } from 'vitest';
import { tickWorld } from '../../sim/runtime';
import { createInitialWorld } from '../../sim/world';
import type { WorldState } from '../../sim/types';

function dealHand(world: WorldState): void {
  tickWorld(world, [
    {
      type: 'deal-hand',
      traceId: 'audit-deal'
    }
  ]);
}

function aliveSlots(world: WorldState): number[] {
  return Object.values(world.enemies)
    .filter((enemy) => enemy.alive)
    .sort((a, b) => a.slot - b.slot)
    .map((enemy) => enemy.slot);
}

describe('runtime rule audit gaps', () => {
  it.each(['blood_tithe', 'wild_mana_stitch'] as const)(
    'does not immediately redraw played 0-cost self draw card %s from an empty draw pile',
    (cardId) => {
      const world = createInitialWorld();
      dealHand(world);
      world.player.hand = [cardId];
      world.player.drawPile = [];
      world.player.discardPile = [];

      tickWorld(world, [
        {
          type: 'play-card',
          cardId,
          traceId: `audit-self-draw-${cardId}`
        }
      ]);

      expect(world.player.hand).toEqual([]);
      expect(world.player.discardPile).toEqual([cardId]);
      expect(
        world.debug.events.some(
          (event) => event.type === 'HandDealt' && event.traceId === `audit-self-draw-${cardId}`
        )
      ).toBe(false);

      tickWorld(world, [
        {
          type: 'end-turn',
          traceId: `audit-self-draw-end-${cardId}`
        }
      ]);

      expect(world.debug.events.some((event) => event.type === 'TurnEnded' && event.traceId === `audit-self-draw-end-${cardId}`)).toBe(
        true
      );
      expect(world.debug.failedConditions.some((condition) => condition.traceId === `audit-self-draw-end-${cardId}`)).toBe(
        false
      );
      expect(world.player.hand).toEqual([cardId]);
    }
  );

  it('rejects play-card intents that arrive after end-turn in the same tick batch', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.player.discardPile.push(...world.player.hand);
    world.player.hand = [];

    tickWorld(world, [
      {
        type: 'end-turn',
        traceId: 'audit-end-turn'
      },
      {
        type: 'play-card',
        cardId: 'redline_cut',
        targetId: 'enemy-1',
        traceId: 'audit-stale-card'
      }
    ]);

    expect(world.debug.events.some((event) => event.type === 'CardPlayed' && event.traceId === 'audit-stale-card')).toBe(
      false
    );
    expect(world.debug.failedConditions.some((condition) => condition.traceId === 'audit-stale-card')).toBe(true);
    expect(world.player.energy).toBe(world.player.maxEnergy);
  });

  it('keeps the front formation compact immediately after a front enemy is killed', () => {
    const world = createInitialWorld();
    dealHand(world);

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'redline_cut',
        targetId: 'enemy-1',
        traceId: 'audit-kill-front'
      },
      {
        type: 'play-card',
        cardId: 'debt_hook',
        targetId: 'enemy-1',
        traceId: 'audit-finish-front'
      }
    ]);

    expect(world.enemies['enemy-1'].alive).toBe(false);
    expect(aliveSlots(world)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(world.enemies['enemy-2'].slot).toBe(1);
    expect(world.enemies['enemy-6'].slot).toBe(0);
    expect(world.enemies['enemy-11'].slot).toBe(5);
    expect(world.enemies['enemy-16'].slot).toBe(10);
    expect(world.debug.events.some((event) => event.type === 'EnemiesRepositioned')).toBe(true);
  });

  it('refills the killed first-row slot from the same column instead of shifting the row sideways', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.enemies['enemy-2'].hp = 4;

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'debt_hook',
        targetId: 'enemy-2',
        traceId: 'audit-kill-column-2'
      }
    ]);

    expect(world.enemies['enemy-2'].alive).toBe(false);
    expect(aliveSlots(world)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(world.enemies['enemy-3'].slot).toBe(2);
    expect(world.enemies['enemy-6'].slot).toBe(5);
    expect(world.enemies['enemy-7'].slot).toBe(1);
    expect(world.enemies['enemy-12'].slot).toBe(6);
    expect(world.enemies['enemy-16'].slot).toBe(11);
    expect(world.nextEnemySerial).toBe(17);
  });
});
