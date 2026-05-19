import { describe, expect, it } from 'vitest';

import { cards, rewardCardPool } from '../../data/cards';
import type { CardKeyword, CardMechanicTag, CardRewardRarity, RewardBranch } from '../../sim/types';

const expectedCardType = ['attack', 'skill', 'resource', 'draw', 'repair', 'payoff', 'status'];
const expectedChainRole = ['starter', 'bridge', 'expand', 'repair', 'payoff'];
const expectedCycleRole = ['opener', 'connector', 'route-segment', 'draw-fixer', 'wild-fixer', 'finisher'];
const expectedBuildRole = ['basic-chain', 'reward-chain', 'draw-fixer', 'wild-fixer', 'payoff-finisher', 'reserve-test'];
const expectedAvailability = ['starting', 'reward', 'starting-and-reward', 'reserve-test'];
const expectedRewardBranches: RewardBranch[] = ['repair-resource', 'payoff', 'route-bridge'];
const expectedRewardRarities: CardRewardRarity[] = ['starter', 'common', 'uncommon', 'rare', 'status', 'test'];
const expectedMechanicTags: CardMechanicTag[] = [
  'attack',
  'skill',
  'status',
  'pollution',
  'exhaust',
  'retain',
  'draw',
  'cost-change',
  'shield',
  'chain',
  'authorization',
  'payoff',
  'repair',
  'resource',
  'reorder',
  'topdeck',
  'reward-rarity',
  'front-enemy',
  'front-row',
  'all-enemies',
  'self'
];
const expectedKeywords: CardKeyword[] = [
  '开链',
  '接链',
  '修补',
  '终结',
  '授权',
  '意图',
  '护栏',
  '抽牌',
  '返MP',
  '消耗',
  '保留',
  '状态',
  '污染',
  '过载',
  '净化',
  '打断',
  '护盾',
  '降费',
  '费用变化',
  '整备'
];

describe('card taxonomy data contract', () => {
  it('keeps the reward card pool backed by real card definitions', () => {
    const missingRewardCards = rewardCardPool.filter((cardId) => !cards[cardId]);
    const reservedRewardCards = rewardCardPool.filter((cardId) => cards[cardId]?.availability === 'reserve-test');

    expect(missingRewardCards).toEqual([]);
    expect(reservedRewardCards).toEqual([]);
    expect(rewardCardPool).toContain('blood_tithe');
    expect(rewardCardPool).toContain('pulse_draw');
    expect(cards.blood_tithe.availability).toBe('reward');
    expect(cards.pulse_draw.availability).toBe('reward');
  });

  it('keeps every reward pool card backed by explicit reward branch contracts', () => {
    for (const cardId of rewardCardPool) {
      const card = cards[cardId];
      expect(card.rewardBranches?.length, cardId).toBeGreaterThan(0);
      expect(new Set(card.rewardBranches).size, cardId).toBe(card.rewardBranches?.length);

      for (const branch of card.rewardBranches ?? []) {
        expect(expectedRewardBranches, `${cardId}:${branch}`).toContain(branch);
      }
    }

    expect(cards.blood_tithe.rewardBranches).toEqual(['repair-resource']);
    expect(cards.pulse_draw.rewardBranches).toEqual(['repair-resource', 'route-bridge']);
  });

  it('keeps the short-run reward pool dense across cleanup, bridge, route, and upgrade hooks', () => {
    const cleanupCards = rewardCardPool.filter((cardId) => {
      const card = cards[cardId];
      return card.keywords.includes('净化') && card.mechanicTags?.includes('pollution');
    });
    const lowFeeBridgeCards = rewardCardPool.filter((cardId) => {
      const card = cards[cardId];
      return card.cost <= 1 && card.rewardBranches?.includes('route-bridge') && card.chainRole !== 'payoff';
    });
    const routeRewardCards = rewardCardPool.filter((cardId) => {
      const card = cards[cardId];
      return card.rewardBranches?.includes('route-bridge') && card.chainRole === 'expand';
    });
    const upgradeHookCards = rewardCardPool.filter((cardId) => {
      const card = cards[cardId];
      return card.damage > 0 && card.runUpgrade && card.availability !== 'reserve-test';
    });

    expect(cleanupCards).toEqual(expect.arrayContaining(['silt_purge']));
    expect(lowFeeBridgeCards).toEqual(expect.arrayContaining(['fuse_needle', 'cinder_crossing']));
    expect(routeRewardCards).toEqual(expect.arrayContaining(['signal_relay']));
    expect(upgradeHookCards).toEqual(expect.arrayContaining(['fuse_needle', 'signal_relay', 'crimson_receipt']));
  });

  it('classifies every current card across the Redline taxonomy axes', () => {
    for (const card of Object.values(cards)) {
      expect(card.cardType, card.id).toBeDefined();
      expect(card.chainRole, card.id).toBeDefined();
      expect(card.cycleRole, card.id).toBeDefined();
      expect(card.buildRole, card.id).toBeDefined();
      expect(card.availability, card.id).toBeDefined();

      expect(expectedCardType, card.id).toContain(card.cardType);
      expect(expectedChainRole, card.id).toContain(card.chainRole);
      expect(expectedCycleRole, card.id).toContain(card.cycleRole);
      expect(expectedBuildRole, card.id).toContain(card.buildRole);
      expect(expectedAvailability, card.id).toContain(card.availability);
    }
  });

  it('keeps every card backed by short rules text, mobile effect text, keywords, and detail copy', () => {
    for (const card of Object.values(cards)) {
      expect(card.rulesText, card.id).toBeTruthy();
      expect(card.mobileEffect, card.id).toBeTruthy();
      expect(card.detail, card.id).toBeTruthy();
      expect(card.keywords.length, card.id).toBeGreaterThan(0);

      expect(card.mobileEffect.length, card.id).toBeLessThanOrEqual(12);
      expect(card.rulesText.length, card.id).toBeLessThanOrEqual(28);
      expect(card.detail.length, card.id).toBeLessThanOrEqual(80);

      for (const keyword of card.keywords) {
        expect(expectedKeywords, `${card.id}:${keyword}`).toContain(keyword);
      }
    }
  });

  it('keeps every current card indexed by mechanism tags and reward rarity', () => {
    for (const card of Object.values(cards)) {
      expect(card.rewardRarity, card.id).toBeDefined();
      expect(expectedRewardRarities, card.id).toContain(card.rewardRarity);
      expect(card.mechanicTags?.length, card.id).toBeGreaterThan(0);
      expect(card.mechanicTags, card.id).toContain('reward-rarity');

      for (const tag of card.mechanicTags ?? []) {
        expect(expectedMechanicTags, `${card.id}:${tag}`).toContain(tag);
      }
    }

    expect(cards.static_overload.mechanicTags).toEqual(
      expect.arrayContaining(['status', 'pollution', 'exhaust'])
    );
    expect(cards.guard_reserve.mechanicTags).toContain('retain');
    expect(cards.shield_reserve.mechanicTags).toContain('shield');
    expect(cards.ledger_discount.mechanicTags).toContain('cost-change');
    expect(cards.burn_after_reading.mechanicTags).toEqual(
      expect.arrayContaining(['skill', 'draw', 'exhaust'])
    );
  });

  it('reserves payoff roles for 3 MP all-enemies burst finishers', () => {
    const payoffRoleCards = Object.values(cards).filter(
      (card) =>
        card.cardType === 'payoff' ||
        card.chainRole === 'payoff' ||
        card.cycleRole === 'finisher' ||
        card.buildRole === 'payoff-finisher'
    );

    expect(payoffRoleCards.map((card) => card.id).sort()).toEqual(['red_ledger_burst', 'severance_burst']);

    for (const card of payoffRoleCards) {
      expect(card.cost, card.id).toBe(3);
      expect(card.comboNode, card.id).toBe('burst');
      expect(card.targets, card.id).toBe('all-enemies');
    }

    expect(cards.clearance_order.cost).toBe(2);
    expect(cards.clearance_order.chainRole).toBe('expand');
    expect(cards.clearance_order.cycleRole).toBe('route-segment');
    expect(cards.clearance_order.cardType).not.toBe('payoff');
  });

  it('opens draw repair cards as reward-safe repair pieces without damage pressure promises', () => {
    expect(cards.blood_tithe.buildRole).toBe('draw-fixer');
    expect(cards.pulse_draw.buildRole).toBe('draw-fixer');
    expect(cards.blood_tithe.damage).toBe(0);
    expect(cards.pulse_draw.damage).toBe(0);
    expect(cards.blood_tithe.drawCards).toBe(1);
    expect(cards.pulse_draw.drawCards).toBe(1);
    expect(cards.blood_tithe.rewardBranches).toEqual(['repair-resource']);
    expect(cards.pulse_draw.rewardBranches).toEqual(['repair-resource', 'route-bridge']);
  });

  it('keeps Wild Mana Stitch resource gain gated behind real chain repair', () => {
    expect(cards.wild_mana_stitch.utilities).toEqual(['wild', 'draw', 'mana']);
    expect(cards.wild_mana_stitch.energyGain).toBe(1);
    expect(cards.wild_mana_stitch.energyGainCondition).toBe('chain-repaired');
    expect(cards.wild_mana_stitch.detail).toContain('最大MP');
  });
});
