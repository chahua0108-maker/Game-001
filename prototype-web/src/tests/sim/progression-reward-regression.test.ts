import { describe, expect, it } from 'vitest';
import { startingHand } from '../../data/cards';
import { tickWorld } from '../../sim/runtime';
import { createInitialWorld } from '../../sim/world';
import { INITIAL_REWARD_XP_THRESHOLD } from '../../sim/rewardProgression';
import type { CardId, Intent, WorldState } from '../../sim/types';

type RewardProgressionWorld = WorldState & {
  player: WorldState['player'] & {
    xp: number;
    level: number;
    deck: CardId[];
  };
  reward: {
    xpThreshold: number;
    candidateCardPool: CardId[];
    choices: CardId[];
    pickCount: number;
  };
};

function dealHand(world: WorldState): void {
  tickWorld(world, [
    {
      type: 'deal-hand',
      traceId: 'progression-deal'
    }
  ]);
}

function playCard(world: WorldState, cardId: CardId, targetId: string): void {
  tickWorld(world, [
    {
      type: 'play-card',
      cardId,
      targetId,
      traceId: `progression-play-${cardId}`
    }
  ]);
}

function selectReward(world: WorldState, cardId: CardId): void {
  tickWorld(world, [
    {
      type: 'select-reward',
      cardId,
      traceId: `progression-select-${cardId}`
    } as unknown as Intent
  ]);
  const routeId = world.route?.pendingNodeChoices[0]?.id;
  if (routeId) {
    tickWorld(world, [
      {
        type: 'select-route',
        routeId,
        traceId: `progression-select-${cardId}-route`
      } satisfies Intent
    ]);
  }
}

function stagePendingReward(world: WorldState, selectedCardId: CardId, currentNode = 1, maxNodes = 3): void {
  world.fsm.gameFlow = 'Reward';
  world.run.currentNode = currentNode;
  world.run.maxNodes = maxNodes;
  world.reward.pending = true;
  world.reward.source = 'level-up';
  world.reward.choices = [selectedCardId, 'severance_burst', 'spark_tap'];
  world.reward.candidateCardPool = [selectedCardId, 'severance_burst', 'spark_tap'];
  world.reward.pickCount = 3;
  world.player.hand = ['debt_hook', 'redline_cut'];
  world.player.drawPile = ['row_cleave', 'heartbeat_spark', 'verdict_mark', 'blood_reclaim'];
  world.player.discardPile = [];
  world.player.energy = 0;
  world.player.tempAuthorizationMP = 3;
  world.player.authorizationRestriction = 'payoff-only';
  world.player.payoffArmed = true;
}

describe('XP and reward progression regression coverage', () => {
  it('starts the first reward cadence inside the short demo window', () => {
    const world = createInitialWorld();

    expect(world.reward.xpThreshold).toBe(INITIAL_REWARD_XP_THRESHOLD);
    expect(world.reward.xpThreshold).toBe(12);
  });

  it('grants XP on kill, offers card rewards at the threshold, adds the selected card to the deck, and resumes the next round', () => {
    const world = createInitialWorld();
    const progressionWorld = world as RewardProgressionWorld;
    const rewardPool: CardId[] = ['heartbeat_spark', 'verdict_mark', 'blood_reclaim'];
    progressionWorld.player.xp = 0;
    progressionWorld.player.level = 1;
    progressionWorld.player.deck = [...startingHand];
    progressionWorld.reward = {
      xpThreshold: 1,
      candidateCardPool: rewardPool,
      choices: [],
      pickCount: 3,
      pending: false,
      source: null
    };
    world.enemies['enemy-1'].hp = 4;
    dealHand(world);

    playCard(world, 'debt_hook', 'enemy-1');

    expect(world.debug.events.filter((event) => event.type === 'EnemyKilled' && event.enemyId === 'enemy-1')).toHaveLength(1);
    expect(progressionWorld.player.xp).toBe(1);
    expect(progressionWorld.player.level).toBe(2);
    expect(world.fsm.gameFlow).toBe('Reward');
    expect(progressionWorld.reward.choices).toHaveLength(3);
    expect(new Set(progressionWorld.reward.choices).size).toBe(progressionWorld.reward.choices.length);
    expect(progressionWorld.reward.choices.every((cardId) => rewardPool.includes(cardId))).toBe(true);

    const selectedCard = progressionWorld.reward.choices[0];
    selectReward(world, selectedCard);

    expect(progressionWorld.player.deck.filter((cardId) => cardId === selectedCard)).toHaveLength(2);
    expect(world.player.hand).toContain(selectedCard);
    expect(world.player.drawPile).not.toContain(selectedCard);
    expect(world.round).toBe(2);
    expect(world.fsm.gameFlow).toBe('PlayerTurn');
    expect(world.player.hand).toHaveLength(4);
    expect(world.reward.xpThreshold).toBeGreaterThan(progressionWorld.player.xp);
  });

  it.each(['blood_tithe', 'pulse_draw'] as CardId[])(
    'adds opened draw repair reward %s to the next hand in non-terminal nodes',
    (selectedCard) => {
      const world = createInitialWorld();
      stagePendingReward(world, selectedCard, 1, 3);

      selectReward(world, selectedCard);

      expect(world.fsm.gameFlow).toBe('PlayerTurn');
      expect(world.run.status).toBe('in-progress');
      expect(world.run.currentNode).toBe(2);
      expect(world.round).toBe(2);
      expect(world.player.deck).toContain(selectedCard);
      expect(world.player.hand).toContain(selectedCard);
      expect(world.player.hand).toHaveLength(4);
      expect(world.player.drawPile).not.toContain(selectedCard);
      expect(world.player.energy).toBe(world.player.maxEnergy);
      expect(world.player.tempAuthorizationMP).toBe(0);
      expect(world.player.authorizationRestriction).toBeNull();
      expect(world.player.payoffArmed).toBe(false);
      expect(world.reward.pending).toBe(false);
      expect(world.debug.events).toContainEqual(
        expect.objectContaining({
          type: 'HandDealt',
          traceId: `progression-select-${selectedCard}-route`,
          cardIds: expect.arrayContaining([selectedCard])
        })
      );
    }
  );

  it.each(['blood_tithe', 'pulse_draw'] as CardId[])(
    'settles terminal reward %s without dealing another hand',
    (selectedCard) => {
      const world = createInitialWorld();
      stagePendingReward(world, selectedCard, 3, 3);

      selectReward(world, selectedCard);

      expect(world.fsm.gameFlow).toBe('Settlement');
      expect(world.run.status).toBe('victory');
      expect(world.run.currentNode).toBe(3);
      expect(world.round).toBe(1);
      expect(world.player.deck).toContain(selectedCard);
      expect(world.player.hand).toEqual([]);
      expect(world.debug.events).not.toContainEqual(
        expect.objectContaining({
          type: 'HandDealt',
          traceId: `progression-select-${selectedCard}`
        })
      );

      playCard(world, 'debt_hook', 'enemy-1');

      expect(
        world.debug.failedConditions.some(
          (condition) =>
            condition.traceId === 'progression-play-debt_hook' &&
            condition.conditionId === 'player-turn'
        )
      ).toBe(true);
    }
  );
});
