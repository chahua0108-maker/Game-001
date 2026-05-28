import type { FeatureGateConfig } from '../schema/definitions';

export const featureGates = [
  {
    id: 'feature.map_branching',
    name: 'Map Branching',
    defaultState: 'available'
  },
  {
    id: 'feature.shop_inventory',
    name: 'Shop Inventory',
    defaultState: 'available'
  },
  {
    id: 'feature.blacksmith',
    name: 'Blacksmith',
    defaultState: 'locked',
    unlockRuleIds: ['unlock.feature.blacksmith']
  },
  {
    id: 'feature.blacksmith_reroll',
    name: 'Blacksmith Reroll',
    defaultState: 'locked',
    unlockRuleIds: ['unlock.feature.blacksmith_reroll']
  }
] as const satisfies readonly FeatureGateConfig[];
