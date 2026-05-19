import { describe, expect, it } from 'vitest';

import { cards, rewardCardPool } from '../../data/cards';
import { rewardBranchesForCard } from '../../sim/rewardChoices';
import type { CardId } from '../../sim/types';

const round18Cards: CardId[] = ['ash_filter', 'toll_shunt', 'last_light_cache'];

describe('round 18 card content density contract', () => {
  it('adds original reward cards for pollution cleanup, bridge repair, and failure rescue', () => {
    expect(cards.ash_filter).toMatchObject({
      id: 'ash_filter',
      cardType: 'repair',
      cycleRole: 'draw-fixer',
      buildRole: 'draw-fixer',
      availability: 'reward',
      rewardBranches: ['repair-resource']
    });
    expect(cards.ash_filter.mechanicTags).toEqual(
      expect.arrayContaining(['repair', 'pollution', 'draw', 'exhaust', 'self', 'reward-rarity'])
    );
    expect(cards.ash_filter.keywords).toEqual(expect.arrayContaining(['净化', '污染', '抽牌', '消耗']));

    expect(cards.toll_shunt).toMatchObject({
      id: 'toll_shunt',
      cardType: 'repair',
      chainRole: 'repair',
      cycleRole: 'wild-fixer',
      buildRole: 'wild-fixer',
      availability: 'reward',
      rewardBranches: ['repair-resource', 'route-bridge'],
      utilities: ['wild']
    });
    expect(cards.toll_shunt.mechanicTags).toEqual(
      expect.arrayContaining(['repair', 'chain', 'front-enemy', 'reward-rarity'])
    );

    expect(cards.last_light_cache).toMatchObject({
      id: 'last_light_cache',
      cardType: 'skill',
      cycleRole: 'draw-fixer',
      buildRole: 'draw-fixer',
      availability: 'reward',
      rewardBranches: ['repair-resource'],
      lifecycle: {
        onTurnEnd: 'retain'
      }
    });
    expect(cards.last_light_cache.mechanicTags).toEqual(
      expect.arrayContaining(['skill', 'retain', 'draw', 'self', 'reward-rarity'])
    );
  });

  it('keeps round 18 cleanup and rescue cards inside current-run reward contracts', () => {
    for (const cardId of round18Cards) {
      const card = cards[cardId];
      expect(rewardCardPool, cardId).toContain(cardId);
      expect(card.rewardRarity, cardId).not.toBe('rare');
      expect(card.runUpgrade, cardId).toBeUndefined();
      expect(card.costModifier, cardId).toBeUndefined();
      expect(rewardBranchesForCard(card).has('repair-resource'), cardId).toBe(true);
    }

    expect(cards.ash_filter.energyGain).toBeUndefined();
    expect(cards.last_light_cache.energyGain).toBeUndefined();
    expect(cards.toll_shunt.energyGain).toBeUndefined();
    expect(cards.toll_shunt.rewardBranches).toContain('route-bridge');
  });
});
