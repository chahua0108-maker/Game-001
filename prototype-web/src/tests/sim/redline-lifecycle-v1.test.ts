import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cards } from '../../data/cards';
import { tickWorld } from '../../sim/runtime';
import { createInitialWorld } from '../../sim/world';
import type { CardDefinition, CardId, GameEvent, WorldState } from '../../sim/types';

const lifecycleTestCards: Record<string, CardDefinition> = {
  lifecycle_exhaust_protocol: {
    id: 'lifecycle_exhaust_protocol',
    name: 'Lifecycle Exhaust Protocol',
    cost: 0,
    verb: 'exhaust',
    damage: 0,
    comboNode: 'reclaim',
    description: 'Reserve test card for lifecycle exhaust handling.',
    targets: 'self',
    cardType: 'skill',
    chainRole: 'starter',
    cycleRole: 'opener',
    buildRole: 'reserve-test',
    availability: 'reserve-test',
    rulesText: '消耗。',
    mobileEffect: '消耗',
    keywords: ['消耗'],
    detail: 'Played cards with exhaust must leave the deck loop and enter exhaustPile.'
  },
  lifecycle_retain_protocol: {
    id: 'lifecycle_retain_protocol',
    name: 'Lifecycle Retain Protocol',
    cost: 0,
    verb: 'retain',
    damage: 0,
    comboNode: 'reclaim',
    description: 'Reserve test card for lifecycle retain handling.',
    targets: 'self',
    cardType: 'skill',
    chainRole: 'starter',
    cycleRole: 'opener',
    buildRole: 'reserve-test',
    availability: 'reserve-test',
    rulesText: '保留。',
    mobileEffect: '保留',
    keywords: ['保留'],
    detail: 'Retained cards must survive turn cleanup and occupy one slot in the next hand.'
  },
  lifecycle_pollution_status: {
    id: 'lifecycle_pollution_status',
    name: 'Lifecycle Pollution Status',
    cost: 0,
    verb: 'pollute',
    damage: 0,
    comboNode: 'mark',
    description: 'Reserve test card for physical status and pollution cards.',
    targets: 'self',
    cardType: 'status',
    chainRole: 'starter',
    cycleRole: 'opener',
    buildRole: 'reserve-test',
    availability: 'reserve-test',
    rulesText: '状态。过载。',
    mobileEffect: '状态',
    keywords: ['状态', '过载'],
    countsForChain: false,
    detail: 'Status and pollution cards are physical cards in hand, discard, draw, and exhaust lifecycle zones.'
  }
};

type LifecyclePlayerState = WorldState['player'] & {
  exhaustPile: CardId[];
};

type LooseGameEvent = GameEvent | (Record<string, unknown> & { type: string; traceId: string });

function installLifecycleTestCards(): void {
  for (const [cardId, card] of Object.entries(lifecycleTestCards)) {
    cards[cardId] = card;
  }
}

function removeLifecycleTestCards(): void {
  for (const cardId of Object.keys(lifecycleTestCards)) {
    delete cards[cardId];
  }
}

function lifecyclePlayer(world: WorldState): LifecyclePlayerState {
  return world.player as LifecyclePlayerState;
}

function events(world: WorldState): LooseGameEvent[] {
  return world.debug.events as LooseGameEvent[];
}

function dealHand(world: WorldState, traceId = 'lifecycle-deal'): void {
  tickWorld(world, [{ type: 'deal-hand', traceId }]);
}

function endTurn(world: WorldState, traceId = 'lifecycle-end-turn'): void {
  tickWorld(world, [{ type: 'end-turn', traceId }]);
}

function playCard(world: WorldState, cardId: CardId, traceId: string, targetId?: string): void {
  tickWorld(world, [{ type: 'play-card', cardId, targetId, traceId }]);
}

function eventIndex(world: WorldState, traceId: string, eventType: string): number {
  return events(world).findIndex((event) => event.traceId === traceId && event.type === eventType);
}

beforeEach(() => {
  installLifecycleTestCards();
});

afterEach(() => {
  removeLifecycleTestCards();
});

describe('redline lifecycle v1 sim coverage', () => {
  it('moves exhausted cards into exhaustPile and never shuffles them back into the deck loop', () => {
    const world = createInitialWorld();
    dealHand(world, 'lifecycle-exhaust-open');
    world.player.hand = ['lifecycle_exhaust_protocol'];
    world.player.drawPile = [];
    world.player.discardPile = ['debt_hook', 'redline_cut', 'heartbeat_spark', 'row_cleave'];

    playCard(world, 'lifecycle_exhaust_protocol', 'lifecycle-exhaust-play');

    expect(world.player.hand).not.toContain('lifecycle_exhaust_protocol');
    expect(world.player.discardPile).not.toContain('lifecycle_exhaust_protocol');
    expect(lifecyclePlayer(world).exhaustPile).toEqual(['lifecycle_exhaust_protocol']);

    endTurn(world, 'lifecycle-exhaust-next-round');

    expect(world.player.hand).toEqual(['debt_hook', 'redline_cut', 'heartbeat_spark', 'row_cleave']);
    expect(world.player.drawPile).not.toContain('lifecycle_exhaust_protocol');
    expect(world.player.discardPile).not.toContain('lifecycle_exhaust_protocol');
    expect(lifecyclePlayer(world).exhaustPile).toEqual(['lifecycle_exhaust_protocol']);
  });

  it('retains retain cards at turn end and lets them occupy a next-turn hand slot', () => {
    const world = createInitialWorld();
    dealHand(world, 'lifecycle-retain-open');
    world.player.hand = ['lifecycle_retain_protocol', 'debt_hook', 'redline_cut', 'row_cleave'];
    world.player.drawPile = ['heartbeat_spark', 'blood_reclaim', 'verdict_mark', 'spark_tap'];
    world.player.discardPile = [];

    endTurn(world, 'lifecycle-retain-next-round');

    expect(world.round).toBe(2);
    expect(world.fsm.gameFlow).toBe('PlayerTurn');
    expect(world.player.hand).toEqual([
      'lifecycle_retain_protocol',
      'heartbeat_spark',
      'blood_reclaim',
      'verdict_mark'
    ]);
    expect(world.player.hand).toHaveLength(4);
    expect(world.player.drawPile).toEqual(['spark_tap']);
    expect(world.player.discardPile).not.toContain('lifecycle_retain_protocol');
  });

  it('treats status and pollution cards as physical cards that occupy hand slots and follow discard/draw lifecycle movement', () => {
    const world = createInitialWorld();
    world.player.drawPile = [
      'lifecycle_pollution_status',
      'debt_hook',
      'redline_cut',
      'heartbeat_spark',
      'row_cleave'
    ];
    world.player.discardPile = [];

    dealHand(world, 'lifecycle-status-open');

    expect(world.player.hand).toEqual([
      'lifecycle_pollution_status',
      'debt_hook',
      'redline_cut',
      'heartbeat_spark'
    ]);
    expect(world.player.hand).toHaveLength(4);
    expect(world.player.hand.filter((cardId) => cards[cardId]?.cardType !== 'status')).toHaveLength(3);

    endTurn(world, 'lifecycle-status-next-round');

    expect(world.player.discardPile).toEqual([]);
    expect(world.player.hand).toEqual([
      'row_cleave',
      'lifecycle_pollution_status',
      'debt_hook',
      'redline_cut'
    ]);
    expect(world.player.hand).toContain('lifecycle_pollution_status');
  });

  it('emits an event when discard is shuffled back into draw for a deal', () => {
    const world = createInitialWorld();
    world.player.drawPile = [];
    world.player.discardPile = ['debt_hook', 'redline_cut', 'heartbeat_spark'];

    dealHand(world, 'lifecycle-reshuffle-deal');

    const shuffleEvent = events(world).find(
      (event) => event.traceId === 'lifecycle-reshuffle-deal' && event.type === 'DiscardShuffledIntoDraw'
    );
    expect(shuffleEvent).toMatchObject({
      type: 'DiscardShuffledIntoDraw',
      traceId: 'lifecycle-reshuffle-deal',
      cardIds: ['debt_hook', 'redline_cut', 'heartbeat_spark']
    });
    expect(eventIndex(world, 'lifecycle-reshuffle-deal', 'DiscardShuffledIntoDraw')).toBeLessThan(
      eventIndex(world, 'lifecycle-reshuffle-deal', 'HandDealt')
    );
    expect(world.player.hand).toEqual(['debt_hook', 'redline_cut', 'heartbeat_spark']);
  });

  it('does not let status and pollution cards advance, repair, extend, or break the cost chain', () => {
    const world = createInitialWorld();
    dealHand(world, 'lifecycle-status-chain-open');
    world.player.hand = ['debt_hook', 'lifecycle_pollution_status', 'redline_cut', 'row_cleave'];
    world.player.drawPile = [];
    world.player.discardPile = [];
    world.player.energy = world.player.maxEnergy;

    playCard(world, 'debt_hook', 'lifecycle-status-chain-0', 'enemy-1');
    playCard(world, 'lifecycle_pollution_status', 'lifecycle-status-chain-status');
    playCard(world, 'redline_cut', 'lifecycle-status-chain-1', 'enemy-2');
    playCard(world, 'row_cleave', 'lifecycle-status-chain-2');

    expect(events(world)).toContainEqual(
      expect.objectContaining({
        type: 'CardPlayed',
        traceId: 'lifecycle-status-chain-status',
        cardId: 'lifecycle_pollution_status',
        effectMultiplier: 1,
        effectiveCost: 0,
        chainRepaired: false,
        chainExtended: false
      })
    );
    expect(events(world)).not.toContainEqual(
      expect.objectContaining({
        traceId: 'lifecycle-status-chain-status',
        type: 'ChainAdvanced'
      })
    );
    expect(events(world)).not.toContainEqual(
      expect.objectContaining({
        traceId: 'lifecycle-status-chain-status',
        type: 'ChainBroken'
      })
    );
    expect(events(world)).toContainEqual(
      expect.objectContaining({
        type: 'AuthorizationGranted',
        traceId: 'lifecycle-status-chain-2',
        cardId: 'row_cleave',
        tempAuthorizationMP: 3
      })
    );
  });

  it('keeps the existing reward selection and Wild repair path working while lifecycle zones exist', () => {
    const world = createInitialWorld();
    world.fsm.gameFlow = 'Reward';
    world.reward.pending = true;
    world.reward.source = 'level-up';
    world.reward.choices = ['wild_mana_stitch', 'severance_burst', 'spark_tap'];
    world.reward.candidateCardPool = ['wild_mana_stitch', 'severance_burst', 'spark_tap'];
    world.player.hand = ['debt_hook', 'redline_cut'];
    world.player.drawPile = ['row_cleave', 'heartbeat_spark', 'verdict_mark'];
    world.player.discardPile = [];

    tickWorld(world, [{ type: 'select-reward', cardId: 'wild_mana_stitch', traceId: 'lifecycle-reward-select' }]);
    const routeId = world.route?.pendingNodeChoices[0]?.id;
    if (routeId) {
      tickWorld(world, [{ type: 'select-route', routeId, traceId: 'lifecycle-route-select' }]);
    }

    expect(world.fsm.gameFlow).toBe('PlayerTurn');
    expect(world.run.currentNode).toBe(2);
    expect(world.player.deck).toContain('wild_mana_stitch');
    expect(world.player.hand).toContain('wild_mana_stitch');
    expect(world.player.hand).toHaveLength(4);
    expect(world.debug.failedConditions).not.toContainEqual(
      expect.objectContaining({ traceId: 'lifecycle-reward-select' })
    );

    world.player.hand = ['debt_hook', 'wild_mana_stitch', 'row_cleave', 'severance_burst'];
    world.player.drawPile = ['redline_cut'];
    world.player.discardPile = [];
    world.player.energy = world.player.maxEnergy;

    playCard(world, 'debt_hook', 'lifecycle-wild-open', 'enemy-1');
    playCard(world, 'wild_mana_stitch', 'lifecycle-wild-repair');
    playCard(world, 'row_cleave', 'lifecycle-wild-authorize');

    expect(events(world)).toContainEqual(
      expect.objectContaining({
        type: 'ChainRepaired',
        traceId: 'lifecycle-wild-repair',
        cardId: 'wild_mana_stitch',
        repairedCost: 1
      })
    );
    expect(events(world)).toContainEqual(
      expect.objectContaining({
        type: 'AuthorizationGranted',
        traceId: 'lifecycle-wild-authorize',
        cardId: 'row_cleave',
        tempAuthorizationMP: 3
      })
    );
    expect(world.player.hand).toContain('redline_cut');
  });
});
