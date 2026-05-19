import { describe, expect, it } from 'vitest';
import { cards } from '../../data/cards';
import { tickWorld } from '../../sim/runtime';
import { createInitialWorld } from '../../sim/world';
import type { WorldState } from '../../sim/types';

function dealHand(world: WorldState): void {
  tickWorld(world, [
    {
      type: 'deal-hand',
      traceId: 'regression-deal'
    }
  ]);
}

function endTurn(world: WorldState): void {
  tickWorld(world, [
    {
      type: 'end-turn',
      traceId: 'regression-end-turn'
    }
  ]);
}

function playCard(world: WorldState, cardId: string, targetId?: string): void {
  tickWorld(world, [
    {
      type: 'play-card',
      cardId,
      targetId,
      traceId: `regression-play-${cardId}`
    }
  ]);
}

function aliveEnemies(world: WorldState) {
  return Object.values(world.enemies)
    .filter((enemy) => enemy.alive)
    .sort((a, b) => a.slot - b.slot);
}

describe('core loop regression coverage', () => {
  it('refills a fully cleared five-slot front row from the queue before spawning replacements', () => {
    const world = createInitialWorld();
    dealHand(world);
    for (const enemyId of ['enemy-1', 'enemy-2', 'enemy-3', 'enemy-4', 'enemy-5']) {
      world.enemies[enemyId].alive = false;
    }
    world.player.hand = [];

    endTurn(world);

    expect(world.round).toBe(2);
    expect(world.fsm.gameFlow).toBe('PlayerTurn');
    expect(world.player.hp).toBe(60);
    expect(aliveEnemies(world).map((enemy) => enemy.slot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(world.enemies['enemy-6'].slot).toBe(0);
    expect(world.enemies['enemy-10'].slot).toBe(4);
    expect(world.enemies['enemy-11'].slot).toBe(5);
    expect(world.enemies['enemy-15'].slot).toBe(9);
    expect(world.enemies['enemy-16'].slot).toBe(10);
    expect(world.enemies['enemy-20'].slot).toBe(14);
    expect(world.nextEnemySerial).toBe(21);
    expect(world.debug.events.filter((event) => event.type === 'EnemyAttacked')).toHaveLength(0);
    expect(world.debug.events.some((event) => event.type === 'EnemiesRepositioned')).toBe(true);
  });

  it('auto-deals the next round through the draw pile and keeps discard state explicit', () => {
    const world = createInitialWorld();
    dealHand(world);
    const dealtCards = [...world.player.hand];
    world.player.discardPile.push(...world.player.hand);
    world.player.hand = [];

    endTurn(world);

    const handDealtEvents = world.debug.events.filter((event) => event.type === 'HandDealt');
    expect(world.round).toBe(2);
    expect(world.fsm.gameFlow).toBe('PlayerTurn');
    expect(world.player.hand).toHaveLength(4);
    expect(world.player.hand).toEqual(dealtCards);
    expect(world.player.discardPile).toEqual([]);
    expect(world.player.energy).toBe(world.player.maxEnergy);
    expect(handDealtEvents).toHaveLength(2);
    expect(handDealtEvents[handDealtEvents.length - 1]).toMatchObject({
      traceId: 'regression-end-turn',
      cardIds: world.player.hand
    });
  });

  it('allows targeting any living first-row enemy without shifting other columns', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.enemies['enemy-2'].hp = 4;

    playCard(world, 'debt_hook', 'enemy-2');

    expect(world.enemies['enemy-2'].alive).toBe(false);
    expect(world.enemies['enemy-3'].slot).toBe(2);
    expect(world.enemies['enemy-7'].slot).toBe(1);
    expect(world.enemies['enemy-12'].slot).toBe(6);
    expect(world.enemies['enemy-16'].slot).toBe(11);
    expect(world.player.energy).toBe(world.player.maxEnergy);
    expect(world.player.hand).not.toContain('debt_hook');
    expect(world.debug.events.some((event) => event.type === 'CardPlayed')).toBe(true);
    expect(world.debug.failedConditions.some((condition) => condition.conditionId === 'front-target')).toBe(false);
  });

  it('auto-targets the highest current first-row intent when no target is supplied', () => {
    const world = createInitialWorld();
    dealHand(world);

    playCard(world, 'debt_hook');

    expect(world.enemies['enemy-1'].hp).toBe(world.enemies['enemy-1'].maxHp);
    expect(world.enemies['enemy-2'].hp).toBe(world.enemies['enemy-2'].maxHp - cards.debt_hook.damage);
    expect(world.enemies['enemy-6'].hp).toBe(world.enemies['enemy-6'].maxHp);
    expect(world.player.energy).toBe(world.player.maxEnergy);
    expect(world.player.hand).not.toContain('debt_hook');
    expect(
      world.debug.events.some(
        (event) => event.type === 'CardPlayed' && event.cardId === 'debt_hook' && event.targetId === 'enemy-2'
      )
    ).toBe(true);
    expect(world.debug.failedConditions.some((condition) => condition.conditionId === 'front-target')).toBe(false);
  });
});
