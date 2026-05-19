import { describe, expect, it } from 'vitest';
import { cards, startingHand } from '../../data/cards';
import { tickWorld } from '../../sim/runtime';
import { createInitialWorld } from '../../sim/world';
import type { CardId, GameEvent, Intent, WorldState } from '../../sim/types';

function dealOpeningHand(world: WorldState): void {
  tickWorld(world, [
    {
      type: 'advance-time',
      deltaSeconds: 0.016,
      traceId: 'redline-card-system-deal'
    }
  ]);
}

function prepareHand(world: WorldState, hand: CardId[], energy = 3): void {
  dealOpeningHand(world);
  world.player.hand = [...hand];
  world.player.drawPile = [];
  world.player.discardPile = [];
  world.player.maxEnergy = 3;
  world.player.energy = energy;
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

function restartRun(world: WorldState): WorldState {
  return tickWorld(world, [
    {
      type: 'restart-run',
      traceId: 'redline-card-system-restart'
    }
  ]);
}

function playedCard(world: WorldState, traceId: string): Extract<GameEvent, { type: 'CardPlayed' }> | undefined {
  return world.debug.events.find(
    (event): event is Extract<GameEvent, { type: 'CardPlayed' }> =>
      event.type === 'CardPlayed' && event.traceId === traceId
  );
}

function paymentRecorded(
  world: WorldState,
  traceId: string
): Extract<GameEvent, { type: 'CardPaymentRecorded' }> | undefined {
  return world.debug.events.find(
    (event): event is Extract<GameEvent, { type: 'CardPaymentRecorded' }> =>
      event.type === 'CardPaymentRecorded' && event.traceId === traceId
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

function frontRowEnemies(world: WorldState) {
  return Object.values(world.enemies).filter((enemy) => enemy.alive && enemy.slot >= 0 && enemy.slot < 5);
}

function keepEnemiesAliveThroughSetup(world: WorldState): void {
  Object.values(world.enemies).forEach((enemy) => {
    enemy.hp = 50;
    enemy.maxHp = 50;
  });
}

function commandOrEventMentions(world: WorldState, traceId: string, term: string): boolean {
  const needle = term.toLowerCase();
  const commands = world.debug.commands.filter((command) => command.traceId === traceId);
  const events = world.debug.events.filter((event) => event.traceId === traceId);
  return [...commands, ...events].some((entry) => JSON.stringify(entry).toLowerCase().includes(needle));
}

describe('Redline progression/card system QA contract', () => {
  it('keeps P0 authorization as turn-scoped resource, never permanent Max MP growth', () => {
    const world = createInitialWorld();
    prepareHand(world, ['debt_hook', 'redline_cut', 'row_cleave']);
    keepEnemiesAliveThroughSetup(world);

    playCard(world, 'debt_hook', 'scope-chain-0', 'enemy-1');
    playCard(world, 'redline_cut', 'scope-chain-1', 'enemy-2');
    playCard(world, 'row_cleave', 'scope-chain-2');

    expect(world.player.maxEnergy).toBe(3);
    expect(world.player.tempAuthorizationMP).toBe(3);
    expect(world.player.authorizationRestriction).toBe('payoff-only');
    expect(world.player.payoffArmed).toBe(true);
    expect(
      world.debug.events.some((event) => event.type === 'AuthorizationGranted' && event.traceId === 'scope-chain-2')
    ).toBe(true);

    endTurn(world, 'scope-end-turn');

    expect(world.round).toBe(2);
    expect(world.player.maxEnergy).toBe(3);
    expect(world.player.energy).toBe(3);
    expect(world.player.tempAuthorizationMP).toBe(0);
    expect(world.player.authorizationRestriction).toBeNull();
    expect(world.player.payoffArmed).toBe(false);
    expect(world.chain.playedCosts).toEqual([]);
  });

  it('keeps card rewards inside the current run and clears them on restart instead of treating them as meta growth', () => {
    const world = createInitialWorld();
    prepareHand(world, ['debt_hook']);
    world.player.deck = [...startingHand];
    world.player.xp = 0;
    world.player.level = 1;
    world.reward = {
      ...world.reward,
      xpThreshold: 1,
      candidateCardPool: ['wild_mana_stitch', 'severance_burst', 'wild_gap_key'],
      choices: [],
      pending: false,
      source: null
    };
    world.enemies['enemy-1'].hp = cards.debt_hook.damage;

    playCard(world, 'debt_hook', 'reward-kill', 'enemy-1');

    expect(world.fsm.gameFlow).toBe('Reward');
    expect(world.player.level).toBe(2);
    expect(world.reward.choices).toEqual(['wild_mana_stitch', 'severance_burst', 'wild_gap_key']);
    expect(world.player.maxEnergy).toBe(3);

    selectReward(world, 'severance_burst', 'reward-select-payoff');

    expect(world.fsm.gameFlow).toBe('PlayerTurn');
    expect(world.player.deck.filter((cardId) => cardId === 'severance_burst')).toHaveLength(1);
    expect(world.player.hand).toContain('severance_burst');
    expect(world.player.drawPile).not.toContain('severance_burst');
    expect(world.player.maxEnergy).toBe(3);
    expect(world.reward.pending).toBe(false);
    expect(world.reward.source).toBeNull();

    const restarted = restartRun(world);

    expect(restarted.player.deck).toEqual(startingHand);
    expect(restarted.player.deck).not.toContain('severance_burst');
    expect(restarted.player.xp).toBe(0);
    expect(restarted.player.level).toBe(1);
    expect(restarted.player.maxEnergy).toBe(3);
  });

  it('defines the current terminal payoff set as only 3-cost all-enemies burst cards', () => {
    const terminalPayoffIds = Object.values(cards)
      .filter((card) => card.cost === 3 && card.targets === 'all-enemies' && card.comboNode === 'burst')
      .map((card) => card.id)
      .sort();

    expect(terminalPayoffIds).toEqual(['red_ledger_burst', 'severance_burst']);
    expect(cards.clearance_order).toMatchObject({
      cost: 2,
      comboNode: 'burst',
      targets: 'front-row'
    });
    expect(Object.values(cards).filter((card) => card.targets === 'all-enemies').map((card) => card.id).sort()).toEqual(
      terminalPayoffIds
    );
  });

  it('lets authorization pay terminal payoff cards but not 2-cost burst route segments', () => {
    const routeSegment = createInitialWorld();
    prepareHand(routeSegment, ['clearance_order'], 0);
    routeSegment.player.tempAuthorizationMP = 3;
    routeSegment.player.authorizationRestriction = 'payoff-only';
    routeSegment.player.payoffArmed = true;

    playCard(routeSegment, 'clearance_order', 'auth-route-segment');

    expect(playedCard(routeSegment, 'auth-route-segment')).toBeUndefined();
    expect(failedCondition(routeSegment, 'auth-route-segment', 'enough-energy')).toBe(true);
    expect(payoffResolved(routeSegment, 'auth-route-segment')).toBeUndefined();

    const terminalPayoff = createInitialWorld();
    prepareHand(terminalPayoff, ['severance_burst'], 0);
    terminalPayoff.player.tempAuthorizationMP = 3;
    terminalPayoff.player.authorizationRestriction = 'payoff-only';
    terminalPayoff.player.payoffArmed = true;

    playCard(terminalPayoff, 'severance_burst', 'auth-terminal-payoff');

    expect(playedCard(terminalPayoff, 'auth-terminal-payoff')).toMatchObject({
      cardId: 'severance_burst',
      currentEnergyPaid: 0,
      authorizationPaid: 3,
      payoffArmed: true
    });
    expect(paymentRecorded(terminalPayoff, 'auth-terminal-payoff')).toMatchObject({
      source: 'authorization',
      authorizationPaid: 3
    });
    expect(payoffResolved(terminalPayoff, 'auth-terminal-payoff')).toMatchObject({
      cardId: 'severance_burst',
      payoffArmed: true
    });
  });

  it('treats Wild as repair, then lets an armed payoff clear visible enemy intent', () => {
    const world = createInitialWorld();
    prepareHand(world, ['debt_hook', 'wild_mana_stitch', 'row_cleave', 'severance_burst']);
    keepEnemiesAliveThroughSetup(world);
    const intentBefore = world.enemyIntentSummary.totalDamage;

    playCard(world, 'debt_hook', 'core-chain-0', 'enemy-1');
    playCard(world, 'wild_mana_stitch', 'core-wild-repair');
    playCard(world, 'row_cleave', 'core-chain-2');
    playCard(world, 'severance_burst', 'core-armed-payoff');

    expect(intentBefore).toBeGreaterThan(0);
    expect(world.debug.events).toContainEqual(
      expect.objectContaining({
        type: 'ChainRepaired',
        traceId: 'core-wild-repair',
        repairedCost: 1,
        nextExpectedCost: 2
      })
    );
    expect(playedCard(world, 'core-wild-repair')).toMatchObject({
      effectiveCost: 1,
      chainRepaired: true,
      repairedCost: 1
    });
    expect(
      world.debug.commands.some((command) => command.type === 'GainEnergy' && command.traceId === 'core-wild-repair')
    ).toBe(true);
    expect(world.player.maxEnergy).toBe(3);
    expect(
      world.debug.events.some((event) => event.type === 'AuthorizationGranted' && event.traceId === 'core-chain-2')
    ).toBe(true);
    expect(playedCard(world, 'core-armed-payoff')).toMatchObject({
      cardId: 'severance_burst',
      effectMultiplier: 4,
      payoffArmed: true
    });
    expect(paymentRecorded(world, 'core-armed-payoff')?.authorizationPaid ?? 0).toBeGreaterThan(0);
    expect(payoffResolved(world, 'core-armed-payoff')).toMatchObject({
      payoffArmed: true,
      intentDamageBefore: intentBefore,
      intentDamageAfter: 0,
      preventedIntentDamage: intentBefore
    });
  });

  it.each(['lantern_captain'] as const)(
    'keeps %s as self draw support without enabling the paper_shatter topdeck sample',
    (cardId) => {
      const world = createInitialWorld();
      prepareHand(world, [cardId]);
      world.player.drawPile = ['severance_burst', 'wild_gap_key'];
      world.player.discardPile = [];

      playCard(world, cardId, `self-draw-${cardId}`);

      expect(cards[cardId].targets).toBe('self');
      expect(cards[cardId].utilities).toContain('reorder');
      expect(world.player.hand).toEqual(['severance_burst']);
      expect(world.player.drawPile).toEqual(['wild_gap_key']);
      expect(commandOrEventMentions(world, `self-draw-${cardId}`, 'topdeck')).toBe(false);
      expect(commandOrEventMentions(world, `self-draw-${cardId}`, 'reorder')).toBe(false);
    }
  );

  it('keeps the current Wild card set limited to repair-role cards', () => {
    const wildIds = Object.values(cards)
      .filter((card) => card.utilities?.includes('wild'))
      .map((card) => card.id)
      .sort();

    expect(wildIds).toEqual(['wild_gap_key', 'wild_mana_stitch']);
    expect(wildIds.every((cardId) => cards[cardId].description.includes('修补'))).toBe(true);
    expect(frontRowEnemies(createInitialWorld())).toHaveLength(5);
  });
});
