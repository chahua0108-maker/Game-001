import type { ShopItemConfig } from '../schema/definitions';

export const shopItems = [
  {
    id: 'shop.blood_vial',
    name: 'Blood Vial',
    price: 40,
    categoryId: 'category.services',
    requiresFeatureGateIds: ['feature.shop_inventory'],
    unlockRuleIds: ['unlock.shop.blood_vial']
  },
  {
    id: 'shop.ember_map',
    name: 'Ember Map',
    price: 75,
    categoryId: 'category.starter',
    requiresAchievementIds: ['achievement.completed_first_run'],
    unlockRuleIds: ['unlock.map.elite_route']
  },
  {
    id: 'shop.iron_token',
    name: 'Iron Token',
    price: 25,
    categoryId: 'category.starter'
  }
] as const satisfies readonly ShopItemConfig[];
