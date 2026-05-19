import { describe, expect, it } from 'vitest';
import { cards } from '../../data/cards';
import { tickWorld } from '../../sim/runtime';
import { buildSnapshot } from '../../sim/snapshot';
import { createInitialWorld } from '../../sim/world';
import type { GameEvent, WorldState } from '../../sim/types';

function dealHand(world: WorldState): void {
  tickWorld(world, [
    {
      type: 'deal-hand',
      traceId: 'test-deal'
    }
  ]);
}

function endTurn(world: WorldState): void {
  tickWorld(world, [
    {
      type: 'end-turn',
      traceId: 'test-end-turn'
    }
  ]);
}

function aliveEnemies(world: WorldState) {
  return Object.values(world.enemies)
    .filter((enemy) => enemy.alive)
    .sort((a, b) => a.slot - b.slot);
}

function playedCardEvent(world: WorldState, traceId: string): Extract<GameEvent, { type: 'CardPlayed' }> | undefined {
  return world.debug.events.find(
    (event): event is Extract<GameEvent, { type: 'CardPlayed' }> =>
      event.type === 'CardPlayed' && event.traceId === traceId
  );
}

function enemyAttackEvents(world: WorldState, traceId: string): Extract<GameEvent, { type: 'EnemyAttacked' }>[] {
  return world.debug.events.filter(
    (event): event is Extract<GameEvent, { type: 'EnemyAttacked' }> =>
      event.type === 'EnemyAttacked' && event.traceId === traceId
  );
}

describe('redline prototype runtime', () => {
  it('starts a run in deal state with a full five-column enemy formation queue', () => {
    const world = createInitialWorld();

    expect(world.round).toBe(1);
    expect(world.fsm.gameFlow).toBe('Deal');
    expect(world.player.hand).toEqual([]);
    expect(world.player.drawPile).toContain('redline_cut');
    expect(aliveEnemies(world)).toHaveLength(15);
    expect(aliveEnemies(world).map((enemy) => enemy.slot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(aliveEnemies(world).slice(0, 5).map((enemy) => enemy.z)).toEqual([-6, -6, -6, -6, -6]);
    expect(aliveEnemies(world).slice(0, 5).map((enemy) => enemy.lane)).toEqual([-2, -1, 0, 1, 2]);
  });

  it('deals cards into player turn', () => {
    const world = createInitialWorld();

    dealHand(world);

    expect(world.fsm.gameFlow).toBe('PlayerTurn');
    expect(world.player.energy).toBe(world.player.maxEnergy);
    expect(world.player.hand.some((cardId) => cards[cardId].targets === 'front-row')).toBe(true);
    expect(world.player.hand).toContain('redline_cut');
    expect(world.debug.events.some((event) => event.type === 'HandDealt')).toBe(true);
  });

  it('auto-deals the opening hand on the first round-start tick', () => {
    const world = createInitialWorld();

    tickWorld(world, [
      {
        type: 'advance-time',
        deltaSeconds: 0.016,
        traceId: 'test-auto-deal'
      }
    ]);

    expect(world.fsm.gameFlow).toBe('PlayerTurn');
    expect(world.player.hand).toHaveLength(4);
    expect(world.player.hand).not.toContain('severance_burst');
    expect(world.player.energy).toBe(world.player.maxEnergy);
    expect(world.debug.events.some((event) => event.type === 'HandDealt' && event.traceId === 'test-auto-deal')).toBe(true);
  });

  it('does not play a card before the hand is dealt', () => {
    const world = createInitialWorld();

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'redline_cut',
        traceId: 'test-starting-hand'
      }
    ]);

    expect(world.player.energy).toBe(3);
    expect(world.debug.events.some((event) => event.type === 'CardPlayed')).toBe(false);
    expect(world.debug.failedConditions.some((condition) => condition.conditionId === 'player-turn')).toBe(true);
  });

  it('plays a damage card without removing a living target from its slot', () => {
    const world = createInitialWorld();
    const targetId = 'enemy-1';
    dealHand(world);

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'debt_hook',
        targetId,
        traceId: 'test-card'
      }
    ]);

    expect(world.enemies[targetId].hp).toBe(world.enemies[targetId].maxHp - cards.debt_hook.damage);
    expect(world.enemies[targetId].alive).toBe(true);
    expect(world.enemies[targetId].slot).toBe(0);
    expect(world.player.energy).toBe(3);
    expect(world.player.hand).not.toContain('debt_hook');
    expect(world.player.discardPile).toContain('debt_hook');
    expect(world.debug.events.some((event) => event.type === 'CardPlayed')).toBe(true);
    expect(world.fsm.characters.player).toBe('Idle');
  });

  it('plays a front-row cleave that damages every first-row enemy', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.player.hand = ['row_cleave'];

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'row_cleave',
        traceId: 'test-row-cleave'
      }
    ]);

    expect(world.enemies['enemy-1'].hp).toBe(world.enemies['enemy-1'].maxHp - cards.row_cleave.damage);
    expect(world.enemies['enemy-2'].hp).toBe(world.enemies['enemy-2'].maxHp - cards.row_cleave.damage);
    expect(world.enemies['enemy-3'].hp).toBe(world.enemies['enemy-3'].maxHp - cards.row_cleave.damage);
    expect(world.enemies['enemy-4'].hp).toBe(world.enemies['enemy-4'].maxHp - cards.row_cleave.damage);
    expect(world.enemies['enemy-5'].hp).toBe(world.enemies['enemy-5'].maxHp - cards.row_cleave.damage);
    expect(world.enemies['enemy-6'].hp).toBe(world.enemies['enemy-6'].maxHp);
    expect(world.player.energy).toBe(world.player.maxEnergy - cards.row_cleave.cost);
    expect(world.debug.events.filter((event) => event.type === 'DamageApplied' && event.cardId === 'row_cleave')).toHaveLength(5);
  });

  it('amplifies a 1-cost draw card after a 0-cost card continues the cost chain', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.player.hand = ['debt_hook', 'pulse_draw'];
    world.player.drawPile = ['redline_cut', 'heartbeat_spark', 'verdict_mark'];

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'debt_hook',
        targetId: 'enemy-1',
        traceId: 'test-chain-zero'
      }
    ]);
    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'pulse_draw',
        traceId: 'test-chain-draw'
      }
    ]);

    const drawEvent = world.debug.events.find(
      (event) => event.type === 'HandDealt' && event.traceId === 'test-chain-draw'
    );
    const pulseEvent = world.debug.events.find(
      (event) => event.type === 'CardPlayed' && event.traceId === 'test-chain-draw'
    );
    const expectedDrawCount = (cards.pulse_draw.drawCards ?? 0) * 2;
    const expectedDrawnCards = ['redline_cut', 'heartbeat_spark', 'verdict_mark'].slice(0, expectedDrawCount);
    expect(pulseEvent).toMatchObject({ type: 'CardPlayed', effectMultiplier: 2 });
    expect(drawEvent).toMatchObject({ type: 'HandDealt', cardIds: expectedDrawnCards });
    expect(world.player.hand).toEqual(expectedDrawnCards);
  });

  it('does not immediately reshuffle and redraw a just-played 0-cost self draw card from an empty draw pile', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.player.hand = ['blood_tithe'];
    world.player.drawPile = [];
    world.player.discardPile = [];
    world.player.energy = 0;

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'blood_tithe',
        traceId: 'test-empty-self-draw'
      }
    ]);

    expect(world.player.hand).not.toContain('blood_tithe');
    expect(world.player.hand).toEqual([]);
    expect(world.player.discardPile).toContain('blood_tithe');
    expect(world.debug.events.some((event) => event.type === 'CardPlayed' && event.traceId === 'test-empty-self-draw')).toBe(true);

    endTurn(world);

    expect(world.round).toBe(2);
    expect(world.debug.failedConditions.some((condition) => condition.traceId === 'test-end-turn')).toBe(false);
  });

  it('amplifies a 1-cost damage card after a 0-cost starter', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.player.hand = ['debt_hook', 'redline_cut'];

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'debt_hook',
        targetId: 'enemy-1',
        traceId: 'test-damage-chain-zero'
      }
    ]);
    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'redline_cut',
        targetId: 'enemy-2',
        traceId: 'test-damage-chain-one'
      }
    ]);

    const damageEvent = world.debug.events.find(
      (event) => event.type === 'DamageApplied' && event.traceId === 'test-damage-chain-one'
    );
    expect(playedCardEvent(world, 'test-damage-chain-one')).toMatchObject({ effectMultiplier: 2 });
    expect(damageEvent).toMatchObject({ type: 'DamageApplied', amount: cards.redline_cut.damage * 2 });
  });

  it('stacks a 0 to 1 to 2 chain and applies the multiplier to every front-row target', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.player.hand = ['debt_hook', 'redline_cut', 'row_cleave'];
    for (const enemy of Object.values(world.enemies).filter((item) => item.slot < 5)) {
      enemy.hp = 50;
      enemy.maxHp = 50;
    }

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'debt_hook',
        targetId: 'enemy-1',
        traceId: 'test-chain-0'
      }
    ]);
    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'redline_cut',
        targetId: 'enemy-2',
        traceId: 'test-chain-1'
      }
    ]);
    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'row_cleave',
        traceId: 'test-chain-2'
      }
    ]);

    const rowDamageEvents = world.debug.events.filter(
      (event) => event.type === 'DamageApplied' && event.traceId === 'test-chain-2'
    );
    expect(playedCardEvent(world, 'test-chain-2')).toMatchObject({ effectMultiplier: 3 });
    expect(rowDamageEvents).toHaveLength(5);
    expect(rowDamageEvents.every((event) => event.type === 'DamageApplied' && event.amount === cards.row_cleave.damage * 3)).toBe(
      true
    );
  });

  it('resets the cost chain on cost jumps and between turns', () => {
    const jumpWorld = createInitialWorld();
    dealHand(jumpWorld);
    jumpWorld.player.hand = ['debt_hook', 'row_cleave'];

    tickWorld(jumpWorld, [
      {
        type: 'play-card',
        cardId: 'debt_hook',
        targetId: 'enemy-1',
        traceId: 'test-jump-0'
      }
    ]);
    tickWorld(jumpWorld, [
      {
        type: 'play-card',
        cardId: 'row_cleave',
        traceId: 'test-jump-2'
      }
    ]);

    expect(playedCardEvent(jumpWorld, 'test-jump-2')).toMatchObject({ effectMultiplier: 1 });

    const turnWorld = createInitialWorld();
    dealHand(turnWorld);
    turnWorld.player.hand = ['debt_hook'];
    tickWorld(turnWorld, [
      {
        type: 'play-card',
        cardId: 'debt_hook',
        targetId: 'enemy-1',
        traceId: 'test-turn-chain-0'
      }
    ]);
    endTurn(turnWorld);
    turnWorld.player.hand = ['redline_cut'];
    tickWorld(turnWorld, [
      {
        type: 'play-card',
        cardId: 'redline_cut',
        targetId: 'enemy-2',
        traceId: 'test-turn-chain-1'
      }
    ]);

    expect(playedCardEvent(turnWorld, 'test-turn-chain-1')).toMatchObject({ effectMultiplier: 1 });
  });

  it('exposes current chain state, next expected cost, and break reason', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.player.hand = ['debt_hook', 'row_cleave'];

    expect(world.chain).toMatchObject({
      playedCosts: [],
      lastCost: null,
      nextExpectedCost: 0,
      multiplier: 1,
      broken: false
    });

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'debt_hook',
        targetId: 'enemy-1',
        traceId: 'test-chain-state-0'
      }
    ]);

    expect(world.chain).toMatchObject({
      playedCosts: [0],
      lastCost: 0,
      nextExpectedCost: 1,
      multiplier: 1,
      broken: false
    });

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'row_cleave',
        traceId: 'test-chain-state-break'
      }
    ]);

    expect(world.chain).toMatchObject({
      playedCosts: [0, 2],
      lastCost: 2,
      nextExpectedCost: 3,
      multiplier: 1,
      broken: true,
      breakReason: 'expected MP 1, played MP 2'
    });
    expect(
      world.debug.events.some((event) => event.type === 'ChainBroken' && event.traceId === 'test-chain-state-break')
    ).toBe(true);
  });

  it('uses Wild Mana Stitch as a draw/mana wild repair that preserves a missing chain step', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.player.hand = ['debt_hook', 'wild_mana_stitch', 'row_cleave'];
    world.player.drawPile = ['redline_cut'];

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'debt_hook',
        targetId: 'enemy-1',
        traceId: 'test-wild-chain-0'
      }
    ]);
    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'wild_mana_stitch',
        traceId: 'test-wild-repair'
      }
    ]);

    expect(world.chain).toMatchObject({
      playedCosts: [0, 1],
      lastCost: 1,
      nextExpectedCost: 2,
      multiplier: 2,
      broken: false,
      repairedThisTurn: true
    });
    expect(playedCardEvent(world, 'test-wild-repair')).toMatchObject({
      effectiveCost: 1,
      chainRepaired: true,
      repairedCost: 1
    });
    expect(
      world.debug.commands.some((command) => command.type === 'GainEnergy' && command.traceId === 'test-wild-repair')
    ).toBe(true);
    expect(world.player.hand).toContain('redline_cut');
    expect(world.player.energy).toBe(4);

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'row_cleave',
        traceId: 'test-wild-chain-2'
      }
    ]);

    expect(playedCardEvent(world, 'test-wild-chain-2')).toMatchObject({ effectMultiplier: 3 });
  });

  it('does not refund MP when Wild Mana Stitch opens a chain instead of repairing one', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.player.hand = ['wild_mana_stitch'];
    world.player.drawPile = ['debt_hook'];

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'wild_mana_stitch',
        traceId: 'test-wild-opener'
      }
    ]);

    expect(playedCardEvent(world, 'test-wild-opener')).toMatchObject({
      effectiveCost: 0,
      chainRepaired: false,
      repairedCost: undefined
    });
    expect(world.debug.events.some((event) => event.type === 'ChainRepaired' && event.traceId === 'test-wild-opener')).toBe(
      false
    );
    expect(
      world.debug.commands.some((command) => command.type === 'GainEnergy' && command.traceId === 'test-wild-opener')
    ).toBe(false);
    expect(world.player.energy).toBe(3);
    expect(world.player.maxEnergy).toBe(3);
    expect(world.player.hand).toContain('debt_hook');
  });

  it('keeps Wild from repairing an already broken chain or refunding MP', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.player.hand = ['debt_hook', 'row_cleave', 'wild_mana_stitch'];
    world.player.drawPile = ['redline_cut'];

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'debt_hook',
        targetId: 'enemy-1',
        traceId: 'test-wild-broken-0'
      }
    ]);
    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'row_cleave',
        traceId: 'test-wild-broken-2'
      }
    ]);
    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'wild_mana_stitch',
        traceId: 'test-wild-broken-repair'
      }
    ]);

    expect(world.chain.broken).toBe(true);
    expect(playedCardEvent(world, 'test-wild-broken-repair')).toMatchObject({
      effectiveCost: 0,
      chainRepaired: false,
      repairedCost: undefined
    });
    expect(
      world.debug.events.some((event) => event.type === 'ChainRepaired' && event.traceId === 'test-wild-broken-repair')
    ).toBe(false);
    expect(
      world.debug.commands.some((command) => command.type === 'GainEnergy' && command.traceId === 'test-wild-broken-repair')
    ).toBe(false);
    expect(
      world.debug.events.some((event) => event.type === 'AuthorizationGranted' && event.traceId === 'test-wild-broken-repair')
    ).toBe(false);
  });

  it('lets Wild Gap Key pay its printed cost while repairing the effective chain cost', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.player.hand = ['debt_hook', 'redline_cut', 'wild_gap_key'];
    Object.values(world.enemies).forEach((enemy) => {
      enemy.hp = 50;
      enemy.maxHp = 50;
    });

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'debt_hook',
        targetId: 'enemy-1',
        traceId: 'test-wild-gap-0'
      }
    ]);
    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'redline_cut',
        targetId: 'enemy-2',
        traceId: 'test-wild-gap-1'
      }
    ]);
    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'wild_gap_key',
        targetId: 'enemy-3',
        traceId: 'test-wild-gap-repair-2'
      }
    ]);

    expect(playedCardEvent(world, 'test-wild-gap-repair-2')).toMatchObject({
      printedCost: 1,
      currentEnergyPaid: 1,
      effectiveCost: 2,
      effectMultiplier: 3,
      chainRepaired: true,
      repairedCost: 2
    });
    expect(world.debug.events).toContainEqual(
      expect.objectContaining({
        type: 'ChainRepaired',
        traceId: 'test-wild-gap-repair-2',
        repairedCost: 2,
        nextExpectedCost: 3
      })
    );
    expect(
      world.debug.events.some((event) => event.type === 'AuthorizationGranted' && event.traceId === 'test-wild-gap-repair-2')
    ).toBe(true);
    expect(world.player.maxEnergy).toBe(3);
  });

  it('amplifies payoff cards at the tail of a chain while unordered payoff remains low value', () => {
    const chained = createInitialWorld();
    dealHand(chained);
    chained.player.maxEnergy = 6;
    chained.player.energy = 6;
    chained.player.hand = ['debt_hook', 'redline_cut', 'row_cleave', 'severance_burst'];
    for (const enemy of Object.values(chained.enemies)) {
      enemy.hp = 200;
      enemy.maxHp = 200;
    }

    tickWorld(chained, [
      {
        type: 'play-card',
        cardId: 'debt_hook',
        targetId: 'enemy-1',
        traceId: 'test-payoff-0'
      }
    ]);
    tickWorld(chained, [
      {
        type: 'play-card',
        cardId: 'redline_cut',
        targetId: 'enemy-2',
        traceId: 'test-payoff-1'
      }
    ]);
    tickWorld(chained, [
      {
        type: 'play-card',
        cardId: 'row_cleave',
        traceId: 'test-payoff-2'
      }
    ]);
    tickWorld(chained, [
      {
        type: 'play-card',
        cardId: 'severance_burst',
        traceId: 'test-payoff-3'
      }
    ]);

    const chainedPayoffDamage = chained.debug.events.filter(
      (event): event is Extract<GameEvent, { type: 'DamageApplied' }> =>
        event.type === 'DamageApplied' && event.traceId === 'test-payoff-3'
    );
    expect(playedCardEvent(chained, 'test-payoff-3')).toMatchObject({ effectMultiplier: 4 });
    expect(chained.debug.events).toContainEqual(
      expect.objectContaining({
        type: 'PayoffTriggered',
        traceId: 'test-payoff-3',
        cardId: 'severance_burst',
        chainLength: 4,
        enhanced: true
      })
    );
    expect(chainedPayoffDamage.every((event) => event.amount === cards.severance_burst.damage * 4)).toBe(true);

    const unordered = createInitialWorld();
    dealHand(unordered);
    unordered.player.hand = ['severance_burst'];
    unordered.player.energy = 3;

    tickWorld(unordered, [
      {
        type: 'play-card',
        cardId: 'severance_burst',
        traceId: 'test-payoff-unordered'
      }
    ]);

    const unorderedPayoffDamage = unordered.debug.events.filter(
      (event): event is Extract<GameEvent, { type: 'DamageApplied' }> =>
        event.type === 'DamageApplied' && event.traceId === 'test-payoff-unordered'
    );
    expect(playedCardEvent(unordered, 'test-payoff-unordered')).toMatchObject({ effectMultiplier: 1 });
    expect(unordered.debug.events).toContainEqual(
      expect.objectContaining({
        type: 'PayoffTriggered',
        traceId: 'test-payoff-unordered',
        cardId: 'severance_burst',
        chainLength: 1,
        enhanced: false
      })
    );
    expect(unorderedPayoffDamage.every((event) => event.amount === cards.severance_burst.damage)).toBe(true);
  });

  it('does not let failed plays mutate the current cost chain', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.player.hand = ['debt_hook', 'redline_cut'];

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'debt_hook',
        targetId: 'enemy-1',
        traceId: 'test-failed-chain-0'
      }
    ]);
    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'redline_cut',
        targetId: 'enemy-6',
        traceId: 'test-failed-chain-invalid'
      }
    ]);
    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'redline_cut',
        targetId: 'enemy-2',
        traceId: 'test-failed-chain-1'
      }
    ]);

    expect(playedCardEvent(world, 'test-failed-chain-invalid')).toBeUndefined();
    expect(playedCardEvent(world, 'test-failed-chain-1')).toMatchObject({ effectMultiplier: 2 });
  });

  it('keeps hand-dealt event card ids immutable after cards are played', () => {
    const world = createInitialWorld();
    dealHand(world);
    const handDealt = world.debug.events.find((event) => event.type === 'HandDealt');
    const dealtCards = [...world.player.hand];

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'debt_hook',
        targetId: 'enemy-1',
        traceId: 'test-event-immutability'
      }
    ]);

    expect(world.player.hand).toHaveLength(3);
    expect(handDealt).toMatchObject({
      type: 'HandDealt',
      cardIds: dealtCards
    });
  });

  it('does not spend the same hand card twice in one tick', () => {
    const world = createInitialWorld();
    dealHand(world);

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'redline_cut',
        targetId: 'enemy-1',
        traceId: 'test-double-1'
      },
      {
        type: 'play-card',
        cardId: 'redline_cut',
        targetId: 'enemy-1',
        traceId: 'test-double-2'
      }
    ]);

    expect(world.enemies['enemy-1'].hp).toBe(world.enemies['enemy-1'].maxHp - cards.redline_cut.damage);
    expect(world.player.energy).toBe(world.player.maxEnergy - cards.redline_cut.cost);
    expect(world.player.discardPile.filter((cardId) => cardId === 'redline_cut')).toHaveLength(1);
    expect(world.debug.failedConditions.some((condition) => condition.conditionId === 'card-in-hand')).toBe(true);
  });

  it('does not spend energy or discard when the requested target is already dead', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.enemies['enemy-1'].alive = false;

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'redline_cut',
        targetId: 'enemy-1',
        traceId: 'test-dead-target'
      }
    ]);

    expect(world.player.energy).toBe(3);
    expect(world.player.hand).toContain('redline_cut');
    expect(world.player.discardPile).not.toContain('redline_cut');
    expect(world.debug.events.some((event) => event.type === 'CardPlayed' && event.traceId === 'test-dead-target')).toBe(false);
    expect(world.debug.failedConditions.some((condition) => condition.conditionId === 'target-alive')).toBe(true);
  });

  it('does not spend energy or discard when a front-enemy card targets the back queue', () => {
    const world = createInitialWorld();
    dealHand(world);

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'redline_cut',
        targetId: 'enemy-6',
        traceId: 'test-back-target'
      }
    ]);

    expect(world.enemies['enemy-6'].hp).toBe(world.enemies['enemy-6'].maxHp);
    expect(world.player.energy).toBe(3);
    expect(world.player.hand).toContain('redline_cut');
    expect(world.player.discardPile).not.toContain('redline_cut');
    expect(world.debug.events.some((event) => event.type === 'CardPlayed' && event.traceId === 'test-back-target')).toBe(false);
    expect(world.debug.failedConditions.some((condition) => condition.conditionId === 'front-target')).toBe(true);
  });

  it('plays the 3-cost finisher with only energy and no extra resource gate', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.player.hand = ['severance_burst'];

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'severance_burst',
        traceId: 'test-burst-fail'
      }
    ]);

    expect(world.lastBurstTick).toBe(world.tick);
    expect(world.player.energy).toBe(0);
    expect(world.player.hand).not.toContain('severance_burst');
    expect(world.debug.events.filter((event) => event.type === 'DamageApplied' && event.cardId === 'severance_burst')).toHaveLength(
      15
    );
  });

  it('kills enemies only when hp reaches zero and rewards once', () => {
    const world = createInitialWorld();
    dealHand(world);
    const startingXp = world.player.xp;

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'redline_cut',
        targetId: 'enemy-1',
        traceId: 'test-kill-1'
      }
    ]);
    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'debt_hook',
        targetId: 'enemy-1',
        traceId: 'test-kill-2'
      }
    ]);

    expect(world.enemies['enemy-1'].alive).toBe(false);
    expect(world.enemies['enemy-1'].slot).toBe(0);
    expect(world.player.xp).toBe(startingXp + world.enemies['enemy-1'].xpReward);
    expect(world.debug.events.filter((event) => event.type === 'EnemyKilled' && event.enemyId === 'enemy-1')).toHaveLength(1);
    expect(world.fsm.characters['enemy-1']).toBe('Dead');
  });

  it('keeps advance-time as clock/deal input without realtime combat side effects', () => {
    const world = createInitialWorld();
    dealHand(world);

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'redline_cut',
        targetId: 'enemy-1',
        traceId: 'test-time-card'
      }
    ]);

    const hpAfterCard = world.player.hp;
    const enemyHpAfterCard = world.enemies['enemy-1'].hp;

    tickWorld(world, [
      {
        type: 'advance-time',
        deltaSeconds: 8,
        traceId: 'test-time'
      }
    ]);

    expect(world.player.hp).toBe(hpAfterCard);
    expect(world.enemies['enemy-1'].hp).toBe(enemyHpAfterCard);
    expect(world.player.energy).toBe(2);
    expect(world.fsm.gameFlow).toBe('PlayerTurn');
    expect(world.debug.events.some((event) => event.traceId === 'test-time' && event.type === 'TimeAdvanced')).toBe(true);
    expect(world.debug.events.some((event) => event.traceId === 'test-time' && event.type === 'EnemyAdvanced')).toBe(false);
    expect(world.debug.events.some((event) => event.traceId === 'test-time' && event.type === 'EnemyPressure')).toBe(false);
    expect(world.debug.events.some((event) => event.traceId === 'test-time' && event.type === 'AutoAttack')).toBe(false);
    expect(world.debug.events.some((event) => event.traceId === 'test-time' && event.type === 'EnemyAttacked')).toBe(false);
    expect(world.debug.events.some((event) => event.traceId === 'test-time' && event.type === 'ClearBurstRequested')).toBe(
      false
    );
  });

  it('ends turn, resolves one attack per living enemy, refills slots, and auto-deals next round', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.enemies['enemy-1'].alive = false;
    world.player.discardPile.push(...world.player.hand);
    world.player.hand = [];

    endTurn(world);

    expect(world.round).toBe(2);
    expect(world.fsm.gameFlow).toBe('PlayerTurn');
    expect(world.player.hp).toBe(45);
    expect(world.player.hand).toHaveLength(4);
    expect(aliveEnemies(world)).toHaveLength(15);
    expect(aliveEnemies(world).map((enemy) => enemy.slot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(world.enemies['enemy-2'].slot).toBe(1);
    expect(world.enemies['enemy-6'].slot).toBe(0);
    expect(world.enemies['enemy-11'].slot).toBe(5);
    expect(world.enemies['enemy-16'].slot).toBe(10);
    expect(world.nextEnemySerial).toBe(17);
    expect(world.debug.events.some((event) => event.type === 'EnemyAttacked')).toBe(true);
    expect(world.debug.events.some((event) => event.type === 'EnemiesRepositioned')).toBe(true);
    expect(world.debug.events.some((event) => event.type === 'RoundStarted' && event.round === 2)).toBe(true);
  });

  it('allows manual end turn when the player has no energy and no cards', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.player.energy = 0;
    world.player.discardPile.push(...world.player.hand);
    world.player.hand = [];

    endTurn(world);

    expect(world.round).toBe(2);
    expect(world.fsm.gameFlow).toBe('PlayerTurn');
    expect(world.player.hp).toBe(43);
    expect(world.player.energy).toBe(world.player.maxEnergy);
    expect(world.player.hand).toHaveLength(4);
    expect(world.debug.events.filter((event) => event.type === 'EnemyAttacked')).toHaveLength(5);
    expect(world.debug.events.some((event) => event.type === 'EnemiesRepositioned')).toBe(true);
  });

  it('allows manual end turn while hand cards are payable and resolves current round attack rights', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.enemies['enemy-1'].hp = cards.debt_hook.damage;
    world.enemies['enemy-2'].damage = 1;
    world.enemies['enemy-3'].damage = 1;
    world.enemies['enemy-4'].damage = 1;
    world.enemies['enemy-5'].damage = 1;
    world.enemies['enemy-6'].damage = 50;

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'debt_hook',
        targetId: 'enemy-1',
        traceId: 'test-payable-end-kill-front'
      }
    ]);
    expect(world.player.hand.some((cardId) => cards[cardId].cost <= world.player.energy)).toBe(true);
    expect(world.enemies['enemy-6'].slot).toBe(0);

    endTurn(world);

    const attackers = enemyAttackEvents(world, 'test-end-turn').map((event) => event.enemyId);
    expect(world.round).toBe(2);
    expect(world.fsm.gameFlow).toBe('PlayerTurn');
    expect(attackers).toEqual(['enemy-2', 'enemy-3', 'enemy-4', 'enemy-5']);
    expect(world.player.hp).toBe(56);
    expect(world.debug.events.some((event) => event.type === 'TurnEnded')).toBe(true);
    expect(world.debug.failedConditions.some((condition) => condition.conditionId === 'turn-end-condition')).toBe(false);
  });

  it('allows manual end turn when hand cards are not payable', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.player.energy = 0;
    world.player.hand = ['row_cleave'];
    world.player.drawPile = ['debt_hook', 'redline_cut', 'heartbeat_spark', 'pulse_draw'];

    endTurn(world);

    expect(world.round).toBe(2);
    expect(world.fsm.gameFlow).toBe('PlayerTurn');
    expect(world.player.energy).toBe(world.player.maxEnergy);
    expect(world.player.hand).toHaveLength(4);
  });

  it('only front-row enemies attack before the queue advances', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.enemies['enemy-6'].damage = 99;
    world.player.hand = [];

    endTurn(world);

    expect(world.player.hp).toBe(43);
    expect(world.debug.events.filter((event) => event.type === 'EnemyAttacked')).toHaveLength(5);
  });

  it('does not let an enemy refilled into the front row during the player turn attack this turn', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.enemies['enemy-1'].hp = cards.debt_hook.damage;
    world.enemies['enemy-2'].damage = 1;
    world.enemies['enemy-3'].damage = 1;
    world.enemies['enemy-4'].damage = 1;
    world.enemies['enemy-5'].damage = 1;
    world.enemies['enemy-6'].damage = 50;

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'debt_hook',
        targetId: 'enemy-1',
        traceId: 'test-refill-kill-front'
      }
    ]);
    expect(world.enemies['enemy-1'].alive).toBe(false);
    expect(world.enemies['enemy-6'].slot).toBe(0);
    world.player.hand = [];

    endTurn(world);

    const attackers = enemyAttackEvents(world, 'test-end-turn').map((event) => event.enemyId);
    expect(attackers).toEqual(['enemy-2', 'enemy-3', 'enemy-4', 'enemy-5']);
    expect(world.player.hp).toBe(56);
  });

  it('gives a refilled front-row enemy attack rights at the next round start', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.enemies['enemy-1'].hp = cards.debt_hook.damage;
    for (const enemyId of ['enemy-2', 'enemy-3', 'enemy-4', 'enemy-5']) {
      world.enemies[enemyId].damage = 0;
    }
    world.enemies['enemy-6'].damage = 7;

    tickWorld(world, [
      {
        type: 'play-card',
        cardId: 'debt_hook',
        targetId: 'enemy-1',
        traceId: 'test-next-round-rights-kill'
      }
    ]);
    world.player.hand = [];
    endTurn(world);
    expect(world.round).toBe(2);
    expect(world.enemies['enemy-6'].slot).toBe(0);

    world.player.hand = [];
    endTurn(world);

    const nextRoundAttackers = enemyAttackEvents(world, 'test-end-turn').map((event) => event.enemyId);
    expect(nextRoundAttackers).toContain('enemy-6');
    expect(world.player.hp).toBe(53);
  });

  it('keeps attack rights for enemies that started the turn in the front row and survived', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.enemies['enemy-1'].damage = 6;
    for (const enemyId of ['enemy-2', 'enemy-3', 'enemy-4', 'enemy-5']) {
      world.enemies[enemyId].damage = 0;
    }
    world.player.hand = [];

    endTurn(world);

    expect(world.debug.events.some((event) => event.type === 'EnemyAttacked' && event.enemyId === 'enemy-1')).toBe(true);
    expect(world.player.hp).toBe(54);
  });

  it('stops enemy attack resolution when the player dies', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.player.hp = 1;
    world.player.hand = [];

    endTurn(world);

    expect(world.player.hp).toBe(0);
    expect(world.fsm.gameFlow).toBe('Settlement');
    expect(world.round).toBe(1);
    expect(world.player.hand).toEqual([]);
    expect(world.debug.events.filter((event) => event.type === 'EnemyAttacked')).toHaveLength(1);
    expect(world.debug.events.some((event) => event.type === 'EnemiesRepositioned')).toBe(false);
  });

  it('keeps the run ended after death until restart', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.player.hp = 1;
    world.player.hand = [];

    endTurn(world);
    tickWorld(world, [
      {
        type: 'advance-time',
        deltaSeconds: 1,
        traceId: 'test-dead-time'
      },
      {
        type: 'end-turn',
        traceId: 'test-dead-end-turn'
      },
      {
        type: 'play-card',
        cardId: 'debt_hook',
        traceId: 'test-dead-play-card'
      }
    ]);

    expect(world.player.hp).toBe(0);
    expect(world.fsm.gameFlow).toBe('Settlement');
    expect(world.round).toBe(1);
    expect(world.player.hand).toEqual([]);
    expect(world.debug.events.some((event) => event.type === 'HandDealt' && event.traceId === 'test-dead-time')).toBe(false);
    expect(world.debug.events.some((event) => event.type === 'CardPlayed' && event.traceId === 'test-dead-play-card')).toBe(false);
    expect(world.debug.failedConditions.some((condition) => condition.traceId === 'test-dead-end-turn')).toBe(true);
  });

  it('compacts gaps from front and second row before spawning new back-row enemies', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.enemies['enemy-1'].alive = false;
    world.enemies['enemy-7'].alive = false;
    world.player.hand = [];

    endTurn(world);

    expect(aliveEnemies(world).map((enemy) => enemy.slot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(world.enemies['enemy-2'].slot).toBe(1);
    expect(world.enemies['enemy-6'].slot).toBe(0);
    expect(world.enemies['enemy-11'].slot).toBe(5);
    expect(world.enemies['enemy-12'].slot).toBe(6);
    expect(world.enemies['enemy-16'].slot).toBe(10);
    expect(world.enemies['enemy-17'].slot).toBe(11);
    expect(world.nextEnemySerial).toBe(18);
  });

  it('rejects ending turn outside player turn', () => {
    const world = createInitialWorld();

    endTurn(world);

    expect(world.round).toBe(1);
    expect(world.fsm.gameFlow).toBe('Deal');
    expect(world.player.hp).toBe(60);
    expect(world.debug.failedConditions.some((condition) => condition.conditionId === 'player-turn')).toBe(true);
  });

  it('draws four-card hands through draw pile and discard reshuffle without clearing discard early', () => {
    const world = createInitialWorld();
    dealHand(world);
    world.player.hand = [];
    world.player.drawPile = ['row_cleave'];
    world.player.discardPile = ['debt_hook', 'redline_cut', 'heartbeat_spark'];

    endTurn(world);

    expect(world.player.hand).toEqual(['row_cleave', 'debt_hook', 'redline_cut', 'heartbeat_spark']);
    expect(world.player.drawPile).toEqual([]);
    expect(world.player.discardPile).toEqual([]);
  });

  it('declares readable enemy intents for current front attackers and resolves them on end turn', () => {
    const world = createInitialWorld();
    dealHand(world);
    const snapshot = buildSnapshot(world);

    expect(world.enemyIntentSummary).toMatchObject({
      totalDamage: 17,
      intentEnemyIds: ['enemy-1', 'enemy-2', 'enemy-3', 'enemy-4', 'enemy-5']
    });
    expect(world.enemyIntents['enemy-1']).toMatchObject({
      enemyId: 'enemy-1',
      kind: 'attack',
      amount: 2,
      description: 'End turn: deal 2 HP damage'
    });
    expect(snapshot.enemyIntentSummary.totalDamage).toBe(17);
    expect(snapshot.enemyIntents).toHaveLength(5);

    endTurn(world);

    expect(
      world.debug.events.filter((event) => event.type === 'EnemyIntentResolved' && event.traceId === 'test-end-turn')
    ).toHaveLength(5);
  });
});
