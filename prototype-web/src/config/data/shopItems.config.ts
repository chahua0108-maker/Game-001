import type { ShopItemConfig } from '../schema/definitions';

export const shopItems = [
  {
    id: 'starter_stable_chain',
    name: 'Stable Chain Starter',
    price: 80,
    categoryId: 'category.starter',
    requiresAchievementIds: ['chain_certified'],
    unlockRuleIds: ['unlock.shop.starter_stable_chain']
  },
  {
    id: 'blacksmith_raise_level_permit',
    name: 'Blacksmith Raise Level Permit',
    price: 60,
    categoryId: 'category.services',
    requiresFeatureGateIds: ['feature.blacksmith'],
    unlockRuleIds: ['unlock.blacksmith.raise_level']
  },
  {
    id: 'blacksmith_red_socket_permit',
    name: 'Blacksmith Red Socket Permit',
    price: 90,
    categoryId: 'category.services',
    requiresFeatureGateIds: ['feature.blacksmith'],
    unlockRuleIds: ['unlock.blacksmith.red_socket']
  },
  {
    id: 'blacksmith_reroll_permit',
    name: 'Blacksmith Reroll Permit',
    price: 120,
    categoryId: 'category.services',
    requiresFeatureGateIds: ['feature.blacksmith_reroll'],
    requiresAchievementIds: ['first_purchase'],
    unlockRuleIds: ['unlock.blacksmith.reroll']
  }
] as const satisfies readonly ShopItemConfig[];
