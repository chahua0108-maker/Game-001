import { describe, expect, it } from 'vitest';
import { startingHand } from '../../data/cards';
import { tickWorld } from '../../sim/runtime';
import { createInitialWorld } from '../../sim/world';
import type { CardId, Intent, WorldState } from '../../sim/types';

const BASE_MAX_ENERGY = 3;
const BASE_ENEMY_COUNT = 15;

type WorldWithForeignMeta = WorldState & {
  metaProgression?: {
    maxEnergyBonus: number;
    startingDeckAdds: CardId[];
  };
};

function selectReward(world: WorldState, cardId: CardId, traceId: string): WorldState {
  const next = tickWorld(world, [
    {
      type: 'select-reward',
      cardId,
      traceId
    } satisfies Intent
  ]);
  const routeId = next.route?.pendingNodeChoices[0]?.id;
  return routeId
    ? tickWorld(next, [
        {
          type: 'select-route',
          routeId,
          traceId: `${traceId}-route`
        } satisfies Intent
      ])
    : next;
}

function playCard(world: WorldState, cardId: CardId, traceId: string, targetId?: string): WorldState {
  return tickWorld(world, [
    {
      type: 'play-card',
      cardId,
      targetId,
      traceId
    } satisfies Intent
  ]);
}

function restartRun(world: WorldState, traceId: string): WorldState {
  return tickWorld(world, [
    {
      type: 'restart-run',
      traceId
    } satisfies Intent
  ]);
}

function aliveEnemyCount(world: WorldState): number {
  return Object.values(world.enemies).filter((enemy) => enemy.alive).length;
}

function expectFreshRunBoundary(world: WorldState): void {
  expect(world.round).toBe(1);
  expect(world.fsm.gameFlow).toBe('Deal');
  expect(world.player.hp).toBe(world.player.maxHp);
  expect(world.player.energy).toBe(BASE_MAX_ENERGY);
  expect(world.player.maxEnergy).toBe(BASE_MAX_ENERGY);
  expect(world.player.xp).toBe(0);
  expect(world.player.level).toBe(1);
  expect(world.player.deck).toEqual(startingHand);
  expect(world.player.hand).toEqual([]);
  expect(world.player.drawPile).toEqual(startingHand);
  expect(world.player.discardPile).toEqual([]);
  expect(world.player.tempAuthorizationMP).toBe(0);
  expect(world.player.authorizationRestriction).toBeNull();
  expect(world.player.payoffArmed).toBe(false);
  expect(world.chain.playedCosts).toEqual([]);
  expect(world.chain.nextExpectedCost).toBe(0);
  expect(world.reward.pending).toBe(false);
  expect(world.reward.choices).toEqual([]);
  expect(aliveEnemyCount(world)).toBe(BASE_ENEMY_COUNT);
}

function putWorldInPendingRewardState(world: WorldState, choices: CardId[]): void {
  world.fsm.gameFlow = 'Reward';
  world.round = 4;
  world.player.energy = 0;
  world.player.maxEnergy = BASE_MAX_ENERGY;
  world.player.xp = 45;
  world.player.level = 2;
  world.player.deck = [...startingHand];
  world.player.hand = ['debt_hook', 'redline_cut'];
  world.player.drawPile = [];
  world.player.discardPile = ['heartbeat_spark'];
  world.player.tempAuthorizationMP = 3;
  world.player.authorizationRestriction = 'payoff-only';
  world.player.payoffArmed = true;
  world.chain.playedCosts = [0, 1, 2];
  world.chain.lastCost = 2;
  world.chain.nextExpectedCost = 3;
  world.chain.multiplier = 3;
  world.reward = {
    ...world.reward,
    pending: true,
    source: 'level-up',
    choices: [...choices],
    candidateCardPool: [...choices],
    pickCount: choices.length
  };
}

describe('four-layer run boundary', () => {
  it('starts with explicit meta/run/encounter/deal-cycle boundaries', () => {
    const world = createInitialWorld();

    expectFreshRunBoundary(world);
  });

  it('expires deal-cycle authorization without mutating current-run rewards or future meta', () => {
    const world = createInitialWorld();
    tickWorld(world, [
      {
        type: 'deal-hand',
        traceId: 'boundary-deal-cycle-start'
      }
    ]);
    world.player.hand = ['debt_hook', 'redline_cut', 'row_cleave'];

    playCard(world, 'debt_hook', 'boundary-cycle-0', 'enemy-1');
    playCard(world, 'redline_cut', 'boundary-cycle-1', 'enemy-2');
    playCard(world, 'row_cleave', 'boundary-cycle-2');

    expect(world.player.tempAuthorizationMP).toBe(3);
    expect(world.player.authorizationRestriction).toBe('payoff-only');
    expect(world.player.maxEnergy).toBe(BASE_MAX_ENERGY);
    expect(world.run.currentNode).toBe(1);
    expect(world.run.rewardHistory).toEqual([]);

    tickWorld(world, [
      {
        type: 'end-turn',
        traceId: 'boundary-cycle-end'
      }
    ]);

    expect(world.round).toBe(2);
    expect(world.player.tempAuthorizationMP).toBe(0);
    expect(world.player.authorizationRestriction).toBeNull();
    expect(world.player.payoffArmed).toBe(false);
    expect(world.player.maxEnergy).toBe(BASE_MAX_ENERGY);
    expect(world.run.currentNode).toBe(1);
    expect(world.run.rewardHistory).toEqual([]);
  });

  it('does not let out-of-reward selection mutate current run deck or max energy', () => {
    const world = createInitialWorld();

    selectReward(world, 'severance_burst', 'boundary-reward-outside-state');

    expect(world.player.maxEnergy).toBe(BASE_MAX_ENERGY);
    expect(world.player.deck).toEqual(startingHand);
    expect(world.reward.pending).toBe(false);
    expect(world.debug.failedConditions).toContainEqual(
      expect.objectContaining({
        traceId: 'boundary-reward-outside-state',
        conditionId: 'reward-state'
      })
    );
  });

  it('adds card rewards only to the current run, then restart-run returns to baseline', () => {
    const world = createInitialWorld();
    putWorldInPendingRewardState(world, ['severance_burst', 'wild_gap_key', 'red_ledger_burst']);

    selectReward(world, 'severance_burst', 'boundary-reward-select');

    expect(world.fsm.gameFlow).toBe('PlayerTurn');
    expect(world.player.maxEnergy).toBe(BASE_MAX_ENERGY);
    expect(world.player.deck).toEqual([...startingHand, 'severance_burst']);
    expect(world.player.hand).toContain('severance_burst');
    expect(world.player.drawPile).not.toContain('severance_burst');
    expect(world.player.tempAuthorizationMP).toBe(0);
    expect(world.player.authorizationRestriction).toBeNull();
    expect(world.player.payoffArmed).toBe(false);
    expect(world.reward.pending).toBe(false);
    expect(world.reward.choices).toEqual([]);

    const restarted = restartRun(world, 'boundary-restart-run');

    expect(restarted).not.toBe(world);
    expectFreshRunBoundary(restarted);
    expect(restarted.player.deck).not.toContain('severance_burst');
  });

  it('does not consume foreign meta progression as implicit maxEnergy or deck changes', () => {
    const world: WorldWithForeignMeta = createInitialWorld();
    world.metaProgression = {
      maxEnergyBonus: 6,
      startingDeckAdds: ['severance_burst', 'wild_gap_key']
    };

    tickWorld(world, [
      {
        type: 'deal-hand',
        traceId: 'boundary-foreign-meta-deal'
      }
    ]);

    expect(world.player.maxEnergy).toBe(BASE_MAX_ENERGY);
    expect(world.player.energy).toBe(BASE_MAX_ENERGY);
    expect(world.player.deck).toEqual(startingHand);
    expect(world.player.hand).toEqual(startingHand);
    expect(world.player.drawPile).not.toContain('severance_burst');
    expect(world.player.drawPile).not.toContain('wild_gap_key');
  });
});
