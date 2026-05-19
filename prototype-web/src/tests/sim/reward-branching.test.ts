import { describe, expect, it } from 'vitest';
import { cards, rewardCardPool } from '../../data/cards';
import { buildRewardChoices, rewardBranchesForCard } from '../../sim/rewardChoices';
import { tickWorld } from '../../sim/runtime';
import { createInitialWorld } from '../../sim/world';
import type { CardDefinition, CardId, GameEvent, RewardBranch, WorldState } from '../../sim/types';

function branches(cardId: CardId): Set<RewardBranch> {
  return rewardBranchesForCard(cards[cardId]);
}

function dealHand(world: WorldState): void {
  tickWorld(world, [{ type: 'deal-hand', traceId: 'reward-branching-deal' }]);
}

type RewardChoicesGeneratedEvent = Extract<GameEvent, { type: 'RewardChoicesGenerated' }>;

function triggerReward(world: WorldState): RewardChoicesGeneratedEvent {
  world.enemies['enemy-1'].hp = 4;
  tickWorld(world, [{ type: 'play-card', cardId: 'debt_hook', targetId: 'enemy-1', traceId: 'reward-branching-kill' }]);

  for (let index = world.debug.events.length - 1; index >= 0; index -= 1) {
    const event = world.debug.events[index];
    if (event.type === 'RewardChoicesGenerated') {
      return event;
    }
  }

  throw new Error('expected RewardChoicesGenerated event');
}

describe('reward branching', () => {
  it('generates reward choices across repair/resource, payoff, and route/bridge instead of taking the first three pool cards', () => {
    const world = createInitialWorld();
    const candidatePool: CardId[] = ['wild_gap_key', 'wild_mana_stitch', 'blood_tithe', 'severance_burst', 'paper_shatter'];
    world.reward.xpThreshold = 1;
    world.reward.candidateCardPool = candidatePool;
    world.reward.pickCount = 3;
    dealHand(world);

    const event = triggerReward(world);
    const choices = event.choices;

    expect(choices).toEqual(world.reward.choices);
    expect(choices).toHaveLength(3);
    expect(choices).not.toEqual(candidatePool.slice(0, 3));
    expect(choices.some((cardId) => branches(cardId).has('repair-resource'))).toBe(true);
    expect(choices.some((cardId) => branches(cardId).has('payoff'))).toBe(true);
    expect(choices.some((cardId) => branches(cardId).has('route-bridge'))).toBe(true);
  });

  it('keeps explicit reward branch contracts ahead of role and availability heuristics', () => {
    const openedBloodTithe: CardDefinition = {
      ...cards.blood_tithe,
      availability: 'reward',
      chainRole: 'bridge',
      cycleRole: 'connector',
      buildRole: 'reward-chain'
    };
    const openedPulseDraw: CardDefinition = {
      ...cards.pulse_draw,
      availability: 'reward',
      chainRole: 'bridge',
      cycleRole: 'connector',
      buildRole: 'reward-chain'
    };

    expect([...rewardBranchesForCard(openedBloodTithe)]).toEqual(['repair-resource']);
    expect([...rewardBranchesForCard(openedPulseDraw)]).toEqual(['repair-resource', 'route-bridge']);
    expect(rewardBranchesForCard(openedBloodTithe).has('payoff')).toBe(false);
    expect(rewardBranchesForCard(openedPulseDraw).has('payoff')).toBe(false);
  });

  it('keeps the default reward pool split across repair, payoff, and route branches', () => {
    const choices = buildRewardChoices(rewardCardPool, 3, cards);

    expect(choices).toEqual(['blood_tithe', 'severance_burst', 'spark_tap']);
    expect(branches(choices[0]).has('repair-resource')).toBe(true);
    expect(branches(choices[1]).has('payoff')).toBe(true);
    expect(branches(choices[2]).has('route-bridge')).toBe(true);
  });

  it('promotes Pulse Draw as the next repair branch when Blood Tithe has already been claimed', () => {
    const choices = buildRewardChoices(
      rewardCardPool.filter((cardId) => cardId !== 'blood_tithe'),
      3,
      cards
    );

    expect(choices).toEqual(['pulse_draw', 'severance_burst', 'spark_tap']);
  });

  it('falls through to wild repair only after opened draw repair cards are unavailable', () => {
    const choices = buildRewardChoices(
      rewardCardPool.filter((cardId) => cardId !== 'blood_tithe' && cardId !== 'pulse_draw'),
      3,
      cards
    );

    expect(choices).toEqual(['wild_gap_key', 'severance_burst', 'spark_tap']);
  });
});
