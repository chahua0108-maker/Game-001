import { describe, expect, it } from 'vitest';
import { startingHand } from '../../data/cards';
import { tickWorld } from '../../sim/runtime';
import { createInitialWorld } from '../../sim/world';
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
}

describe('XP and reward progression regression coverage', () => {
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
    expect(world.player.drawPile).toContain(selectedCard);
    expect(world.round).toBe(2);
    expect(world.fsm.gameFlow).toBe('PlayerTurn');
    expect(world.player.hand).toHaveLength(4);
  });
});
