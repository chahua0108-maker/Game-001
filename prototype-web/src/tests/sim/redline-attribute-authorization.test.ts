import { describe, expect, it } from 'vitest';
import { tickWorld } from '../../sim/runtime';
import { createInitialWorld } from '../../sim/world';
import type { CardId, GameEvent, WorldState } from '../../sim/types';

type DebugEvent = GameEvent & Record<string, unknown>;
type DebugRecord = Record<string, unknown>;

function dealOpeningHand(world: WorldState): void {
  tickWorld(world, [
    {
      type: 'advance-time',
      deltaSeconds: 0.016,
      traceId: 'attribute-auto-deal'
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

function currentIntentDamagePreview(world: WorldState): number {
  return world.enemyIntentSummary.totalDamage;
}

function playedCard(world: WorldState, traceId: string): Extract<GameEvent, { type: 'CardPlayed' }> | undefined {
  return world.debug.events.find(
    (event): event is Extract<GameEvent, { type: 'CardPlayed' }> =>
      event.type === 'CardPlayed' && event.traceId === traceId
  );
}

function payoffTriggered(world: WorldState, traceId: string): Extract<GameEvent, { type: 'PayoffTriggered' }> | undefined {
  return world.debug.events.find(
    (event): event is Extract<GameEvent, { type: 'PayoffTriggered' }> =>
      event.type === 'PayoffTriggered' && event.traceId === traceId
  );
}

function payoffResolved(world: WorldState, traceId: string): Extract<GameEvent, { type: 'PayoffResolved' }> | undefined {
  return world.debug.events.find(
    (event): event is Extract<GameEvent, { type: 'PayoffResolved' }> =>
      event.type === 'PayoffResolved' && event.traceId === traceId
  );
}

function failedCondition(world: WorldState, traceId: string, conditionId: string): boolean {
  return world.debug.failedConditions.some(
    (condition) => condition.traceId === traceId && condition.conditionId === conditionId
  );
}

function eventText(event: DebugEvent): string {
  return JSON.stringify(event);
}

function authorizationGrantEvents(world: WorldState): DebugEvent[] {
  return world.debug.events.filter((event): event is DebugEvent => {
    const type = event.type.toLowerCase();
    const text = eventText(event as DebugEvent).toLowerCase();
    return (
      type.includes('authorization') ||
      type.includes('authorisation') ||
      text.includes('tempauthorizationmp') ||
      text.includes('temp_authorization_mp')
    );
  });
}

function paymentEvents(world: WorldState, traceId: string): DebugEvent[] {
  return world.debug.events.filter((event): event is DebugEvent => {
    const text = eventText(event as DebugEvent).toLowerCase();
    return (
      event.traceId === traceId &&
      (event.type.toLowerCase().includes('payment') ||
        text.includes('tempauthorization') ||
        text.includes('temp_authorization') ||
        text.includes('"source"'))
    );
  });
}

function preventedIntentDamageEvidence(world: WorldState, traceId: string): DebugEvent[] {
  return world.debug.events.filter((event): event is DebugEvent => {
    const type = event.type.toLowerCase();
    const text = eventText(event as DebugEvent).toLowerCase();
    return (
      event.traceId === traceId &&
      ((type.includes('prevent') && type.includes('intent')) ||
        text.includes('preventedintentdamage') ||
        text.includes('prevented_intent_damage') ||
        text.includes('intentdamageprevented') ||
        text.includes('intent_damage_prevented'))
    );
  });
}

function activeTempAuthorizationMP(world: WorldState): number {
  const player = world.player as unknown as DebugRecord;
  const chain = world.chain as unknown as DebugRecord;
  const worldRecord = world as unknown as DebugRecord;
  const candidates = [
    player.tempAuthorizationMP,
    player.tempAuthorizedMP,
    chain.tempAuthorizationMP,
    chain.tempAuthorizedMP,
    worldRecord.tempAuthorizationMP,
    worldRecord.tempAuthorizedMP
  ];
  return candidates.find((value): value is number => typeof value === 'number') ?? 0;
}

function playAuthorizedZeroOneTwo(world: WorldState): void {
  playCard(world, 'debt_hook', 'auth-chain-0', 'enemy-1');
  playCard(world, 'redline_cut', 'auth-chain-1', 'enemy-2');
  playCard(world, 'row_cleave', 'auth-chain-2');
}

describe('Redline P0 temp MP authorization acceptance contract', () => {
  it('plays 0 -> 1 -> 2 -> 3 burst through temp authorization while maxEnergy remains 3', () => {
    const world = createInitialWorld();
    prepareHand(world, ['debt_hook', 'redline_cut', 'row_cleave', 'severance_burst']);

    playAuthorizedZeroOneTwo(world);
    playCard(world, 'severance_burst', 'auth-payoff-3');

    expect(world.player.maxEnergy).toBe(3);
    expect(world.player.energy).toBeLessThanOrEqual(3);
    expect(failedCondition(world, 'auth-payoff-3', 'enough-energy')).toBe(false);
    expect(playedCard(world, 'auth-payoff-3')).toMatchObject({
      cardId: 'severance_burst',
      effectMultiplier: 4
    });
    expect(payoffTriggered(world, 'auth-payoff-3')).toMatchObject({
      cardId: 'severance_burst',
      enhanced: true
    });
  });

  it('does not grant temp authorization to an incomplete chain; ordinary 3 MP can still play unarmed', () => {
    const unauthorized = createInitialWorld();
    prepareHand(unauthorized, ['debt_hook', 'row_cleave', 'severance_burst']);

    playCard(unauthorized, 'debt_hook', 'broken-chain-0', 'enemy-1');
    playCard(unauthorized, 'row_cleave', 'broken-chain-2');
    playCard(unauthorized, 'severance_burst', 'broken-chain-payoff');

    expect(playedCard(unauthorized, 'broken-chain-payoff')).toBeUndefined();
    expect(failedCondition(unauthorized, 'broken-chain-payoff', 'enough-energy')).toBe(true);
    expect(authorizationGrantEvents(unauthorized)).toHaveLength(0);

    const ordinary = createInitialWorld();
    prepareHand(ordinary, ['severance_burst']);
    ordinary.player.energy = 3;

    playCard(ordinary, 'severance_burst', 'ordinary-unarmed-payoff');

    expect(playedCard(ordinary, 'ordinary-unarmed-payoff')).toMatchObject({
      cardId: 'severance_burst',
      effectMultiplier: 1,
      authorizationPaid: 0,
      payoffArmed: false
    });
    expect(payoffTriggered(ordinary, 'ordinary-unarmed-payoff')).toMatchObject({
      cardId: 'severance_burst',
      enhanced: false
    });
    expect(payoffResolved(ordinary, 'ordinary-unarmed-payoff')).toMatchObject({
      cardId: 'severance_burst',
      payoffArmed: false
    });
  });

  it('treats clearance_order as the 2 MP authorization segment, not a payoff finisher', () => {
    const world = createInitialWorld();
    prepareHand(world, ['debt_hook', 'redline_cut', 'clearance_order', 'severance_burst']);

    playCard(world, 'debt_hook', 'segment-0', 'enemy-1');
    playCard(world, 'redline_cut', 'segment-1', 'enemy-2');
    playCard(world, 'clearance_order', 'segment-2');

    expect(playedCard(world, 'segment-2')).toMatchObject({
      cardId: 'clearance_order',
      effectMultiplier: 3,
      authorizationPaid: 0,
      payoffArmed: false
    });
    expect(authorizationGrantEvents(world).length).toBeGreaterThan(0);
    expect(activeTempAuthorizationMP(world)).toBeGreaterThanOrEqual(3);
    expect(payoffTriggered(world, 'segment-2')).toBeUndefined();
    expect(payoffResolved(world, 'segment-2')).toBeUndefined();
  });

  it('does not grant authorization after a chain has already broken, even if later costs reach 1 -> 2', () => {
    const world = createInitialWorld();
    prepareHand(world, ['debt_hook', 'blood_reclaim', 'redline_cut', 'row_cleave', 'severance_burst']);

    playCard(world, 'debt_hook', 'broken-prefix-0', 'enemy-1');
    playCard(world, 'blood_reclaim', 'broken-prefix-extra-0', 'enemy-2');
    playCard(world, 'redline_cut', 'broken-prefix-1', 'enemy-3');
    playCard(world, 'row_cleave', 'broken-prefix-2');
    playCard(world, 'severance_burst', 'broken-prefix-payoff');

    expect(world.chain.broken).toBe(true);
    expect(authorizationGrantEvents(world)).toHaveLength(0);
    expect(playedCard(world, 'broken-prefix-payoff')).toBeUndefined();
    expect(failedCondition(world, 'broken-prefix-payoff', 'enough-energy')).toBe(true);
  });

  it('grants authorization after wild repair connects 0 -> expected 1 -> 2', () => {
    const world = createInitialWorld();
    prepareHand(world, ['debt_hook', 'wild_mana_stitch', 'row_cleave', 'red_ledger_burst']);

    playCard(world, 'debt_hook', 'wild-auth-chain-0', 'enemy-1');
    playCard(world, 'wild_mana_stitch', 'wild-auth-repair');
    playCard(world, 'row_cleave', 'wild-auth-chain-2');
    playCard(world, 'red_ledger_burst', 'wild-auth-payoff-3');

    expect(world.debug.events).toContainEqual(
      expect.objectContaining({
        type: 'ChainRepaired',
        traceId: 'wild-auth-repair',
        repairedCost: 1,
        nextExpectedCost: 2
      })
    );
    expect(authorizationGrantEvents(world).length).toBeGreaterThan(0);
    expect(playedCard(world, 'wild-auth-payoff-3')).toMatchObject({
      cardId: 'red_ledger_burst',
      effectMultiplier: 4
    });
    expect(payoffTriggered(world, 'wild-auth-payoff-3')).toMatchObject({
      cardId: 'red_ledger_burst',
      enhanced: true
    });
  });

  it('clears unused authorization at end turn and does not carry it into the next round', () => {
    const world = createInitialWorld();
    prepareHand(world, ['debt_hook', 'redline_cut', 'row_cleave']);

    playAuthorizedZeroOneTwo(world);

    expect(authorizationGrantEvents(world).length).toBeGreaterThan(0);
    expect(activeTempAuthorizationMP(world)).toBeGreaterThanOrEqual(3);

    endTurn(world, 'authorization-expire-end-turn');

    expect(world.round).toBe(2);
    expect(activeTempAuthorizationMP(world)).toBe(0);

    world.player.hand = ['severance_burst'];
    world.player.energy = 3;

    playCard(world, 'severance_burst', 'severance-next-round-ordinary');

    expect(playedCard(world, 'severance-next-round-ordinary')).toMatchObject({
      cardId: 'severance_burst',
      effectMultiplier: 1
    });
    expect(paymentEvents(world, 'severance-next-round-ordinary')).toHaveLength(0);
  });

  it('records authorization grant, payment source, armed payoff, and prevented intent damage evidence', () => {
    const world = createInitialWorld();
    prepareHand(world, ['debt_hook', 'redline_cut', 'row_cleave', 'severance_burst']);
    const intentBeforePayoff = currentIntentDamagePreview(world);
    const hpBeforeEndTurn = world.player.hp;

    playAuthorizedZeroOneTwo(world);
    playCard(world, 'severance_burst', 'evidence-payoff-3');

    const authorizationEvents = authorizationGrantEvents(world);
    const paymentEvidence = paymentEvents(world, 'evidence-payoff-3');
    const armedPayoff = payoffTriggered(world, 'evidence-payoff-3');
    const resolvedPayoff = payoffResolved(world, 'evidence-payoff-3');

    endTurn(world, 'evidence-end-turn');

    const actualIntentDamage = hpBeforeEndTurn - world.player.hp;
    const preventedEvidence = preventedIntentDamageEvidence(world, 'evidence-payoff-3');
    const preventedOrReducedByState = actualIntentDamage < intentBeforePayoff;

    expect(intentBeforePayoff).toBeGreaterThan(0);
    expect(authorizationEvents.length).toBeGreaterThan(0);
    expect(paymentEvidence.length).toBeGreaterThan(0);
    expect(paymentEvidence).toContainEqual(
      expect.objectContaining({
        type: 'CardPaymentRecorded',
        source: 'authorization',
        authorizationPaid: 3,
        payoffArmed: true
      })
    );
    expect(playedCard(world, 'evidence-payoff-3')).toMatchObject({
      authorizationPaid: 3,
      payoffArmed: true
    });
    expect(armedPayoff).toMatchObject({
      cardId: 'severance_burst',
      enhanced: true
    });
    expect(resolvedPayoff).toMatchObject({
      cardId: 'severance_burst',
      payoffArmed: true
    });
    expect(resolvedPayoff?.preventedIntentDamage).toBeGreaterThan(0);
    expect(resolvedPayoff?.preventedIntentDamage).toBeLessThanOrEqual(intentBeforePayoff);
    expect(preventedEvidence.length > 0 || preventedOrReducedByState).toBe(true);
  });
});
