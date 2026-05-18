import { describe, expect, it } from 'vitest';
import { cards } from '../../data/cards';
import { tickWorld } from '../../sim/runtime';
import { createInitialWorld } from '../../sim/world';
import type { CardId, GameEvent, WorldState } from '../../sim/types';

function dealOpeningHand(world: WorldState): void {
  tickWorld(world, [
    {
      type: 'advance-time',
      deltaSeconds: 0.016,
      traceId: 'hyperturn-auto-deal'
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

function frontRowEnemies(world: WorldState) {
  return Object.values(world.enemies)
    .filter((enemy) => enemy.alive && enemy.slot >= 0 && enemy.slot < 5)
    .sort((a, b) => a.slot - b.slot);
}

function totalDamageForTrace(world: WorldState, traceIds: string[]): number {
  const allowed = new Set(traceIds);
  return world.debug.events
    .filter(
      (event): event is Extract<GameEvent, { type: 'DamageApplied' }> =>
        event.type === 'DamageApplied' && allowed.has(event.traceId)
    )
    .reduce((total, event) => total + event.amount, 0);
}

function playedCard(world: WorldState, traceId: string): Extract<GameEvent, { type: 'CardPlayed' }> | undefined {
  return world.debug.events.find(
    (event): event is Extract<GameEvent, { type: 'CardPlayed' }> =>
      event.type === 'CardPlayed' && event.traceId === traceId
  );
}

function handCosts(world: WorldState): number[] {
  return world.player.hand.map((cardId) => cards[cardId].cost);
}

function hasOpeningRoute(costs: number[]): boolean {
  const hasCost = (cost: number) => costs.includes(cost);
  return (hasCost(0) && hasCost(1) && hasCost(2)) || (hasCost(0) && hasCost(1) && costs.some((cost) => cost >= 2));
}

function currentIntentDamagePreview(world: WorldState): number {
  const attackers = world.roundAttackEnemyIds.length > 0 ? world.roundAttackEnemyIds : frontRowEnemies(world).map((enemy) => enemy.id);
  return attackers
    .map((enemyId) => world.enemies[enemyId])
    .filter((enemy): enemy is NonNullable<typeof enemy> => Boolean(enemy?.alive && enemy.slot >= 0 && enemy.slot < 5))
    .reduce((total, enemy) => total + enemy.damage, 0);
}

describe('Redline Hyper-Turn acceptance contract', () => {
  it('deals an opening hand that can express a 0 -> 1 -> 2 or 0 -> 1 -> payoff route', () => {
    const world = createInitialWorld();

    dealOpeningHand(world);

    expect(world.fsm.gameFlow).toBe('PlayerTurn');
    expect(world.debug.events.some((event) => event.type === 'HandDealt')).toBe(true);
    expect(hasOpeningRoute(handCosts(world))).toBe(true);
  });

  it('makes correctly ordered chain play materially stronger than scrambled play', () => {
    const ordered = createInitialWorld();
    dealOpeningHand(ordered);
    ordered.player.hand = ['debt_hook', 'redline_cut', 'row_cleave'];
    frontRowEnemies(ordered).forEach((enemy) => {
      enemy.hp = 100;
      enemy.maxHp = 100;
    });

    playCard(ordered, 'debt_hook', 'ordered-0', 'enemy-1');
    playCard(ordered, 'redline_cut', 'ordered-1', 'enemy-2');
    playCard(ordered, 'row_cleave', 'ordered-2');

    const scrambled = createInitialWorld();
    dealOpeningHand(scrambled);
    scrambled.player.hand = ['row_cleave', 'debt_hook', 'redline_cut'];
    frontRowEnemies(scrambled).forEach((enemy) => {
      enemy.hp = 100;
      enemy.maxHp = 100;
    });

    playCard(scrambled, 'row_cleave', 'scrambled-2');
    playCard(scrambled, 'debt_hook', 'scrambled-0', 'enemy-1');
    playCard(scrambled, 'redline_cut', 'scrambled-1', 'enemy-2');

    const orderedDamage = totalDamageForTrace(ordered, ['ordered-0', 'ordered-1', 'ordered-2']);
    const scrambledDamage = totalDamageForTrace(scrambled, ['scrambled-2', 'scrambled-0', 'scrambled-1']);

    expect(playedCard(ordered, 'ordered-2')).toMatchObject({ effectMultiplier: 3 });
    expect(playedCard(scrambled, 'scrambled-2')).toMatchObject({ effectMultiplier: 1 });
    expect(orderedDamage).toBeGreaterThan(scrambledDamage * 1.5);
  });

  it('exposes enemy intent or an equivalent end-turn consequence before the player commits', () => {
    const world = createInitialWorld();
    dealOpeningHand(world);

    const previewDamage = currentIntentDamagePreview(world);
    const hpBeforeEndTurn = world.player.hp;

    expect(previewDamage).toBeGreaterThan(0);

    endTurn(world, 'intent-preview-end-turn');

    const resolvedDamage = hpBeforeEndTurn - world.player.hp;
    const attackDamage = world.debug.events
      .filter(
        (event): event is Extract<GameEvent, { type: 'EnemyAttacked' }> =>
          event.type === 'EnemyAttacked' && event.traceId === 'intent-preview-end-turn'
      )
      .reduce((total, event) => total + event.amount, 0);

    expect(attackDamage).toBe(previewDamage);
    expect(resolvedDamage).toBe(previewDamage);
  });

  it('lets a broken chain still play cards, but at reduced payoff', () => {
    const ordered = createInitialWorld();
    dealOpeningHand(ordered);
    ordered.player.hand = ['debt_hook', 'redline_cut', 'row_cleave'];
    frontRowEnemies(ordered).forEach((enemy) => {
      enemy.hp = 100;
      enemy.maxHp = 100;
    });

    playCard(ordered, 'debt_hook', 'break-control-0', 'enemy-1');
    playCard(ordered, 'redline_cut', 'break-control-1', 'enemy-2');
    playCard(ordered, 'row_cleave', 'break-control-2');

    const broken = createInitialWorld();
    dealOpeningHand(broken);
    broken.player.hand = ['debt_hook', 'row_cleave'];
    frontRowEnemies(broken).forEach((enemy) => {
      enemy.hp = 100;
      enemy.maxHp = 100;
    });

    playCard(broken, 'debt_hook', 'broken-0', 'enemy-1');
    playCard(broken, 'row_cleave', 'broken-2');

    expect(playedCard(broken, 'broken-2')).toMatchObject({ effectMultiplier: 1 });
    expect(totalDamageForTrace(broken, ['broken-2'])).toBeGreaterThan(0);
    expect(totalDamageForTrace(broken, ['broken-2'])).toBeLessThan(totalDamageForTrace(ordered, ['break-control-2']));
  });

  it('uses draw repair to bridge one missing chain segment and continue into payoff', () => {
    const world = createInitialWorld();
    dealOpeningHand(world);
    world.player.hand = ['debt_hook', 'pulse_draw'];
    world.player.drawPile = ['row_cleave'];
    frontRowEnemies(world).forEach((enemy) => {
      enemy.hp = 100;
      enemy.maxHp = 100;
    });

    playCard(world, 'debt_hook', 'repair-0', 'enemy-1');
    playCard(world, 'pulse_draw', 'repair-draw');
    playCard(world, 'row_cleave', 'repair-2');

    expect(
      world.debug.events.some(
        (event) => event.type === 'HandDealt' && event.traceId === 'repair-draw' && event.cardIds.includes('row_cleave')
      )
    ).toBe(true);
    expect(playedCard(world, 'repair-draw')).toMatchObject({ effectMultiplier: 2 });
    expect(playedCard(world, 'repair-2')).toMatchObject({ effectMultiplier: 3 });
  });

  it('produces one chain-backed payoff rescue within turns 3-5', () => {
    const world = createInitialWorld();
    dealOpeningHand(world);

    endTurn(world, 'setup-round-1');
    endTurn(world, 'setup-round-2');
    endTurn(world, 'setup-round-3');

    expect(world.round).toBe(4);
    expect(world.player.hp).toBeLessThanOrEqual(15);

    world.player.hand = ['debt_hook', 'redline_cut', 'clearance_order'];
    world.player.energy = 3;
    frontRowEnemies(world).forEach((enemy) => {
      enemy.hp = 21;
      enemy.maxHp = Math.max(enemy.maxHp, 21);
    });

    const intentBeforePayoff = currentIntentDamagePreview(world);
    const hpBeforePayoffTurnEnd = world.player.hp;

    playCard(world, 'debt_hook', 'rescue-0', 'enemy-1');
    playCard(world, 'redline_cut', 'rescue-1', 'enemy-2');
    playCard(world, 'clearance_order', 'rescue-payoff');

    const payoffKills = world.debug.events.filter(
      (event) => event.type === 'EnemyKilled' && event.traceId === 'rescue-payoff' && event.cardId === 'clearance_order'
    );

    endTurn(world, 'rescue-end-turn');

    expect(intentBeforePayoff).toBeGreaterThan(0);
    expect(playedCard(world, 'rescue-payoff')).toMatchObject({ effectMultiplier: 3 });
    expect(payoffKills).toHaveLength(5);
    expect(world.player.hp).toBe(hpBeforePayoffTurnEnd);
  });
});
