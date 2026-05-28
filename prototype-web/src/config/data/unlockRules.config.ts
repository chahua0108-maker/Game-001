import type { UnlockRuleConfig } from '../schema/definitions';

export const unlockRules = [
  {
    id: 'unlock.map.elite_route',
    name: 'Elite Route Unlock',
    targetSystem: 'mapNodes',
    targetId: 'map.elite_fork',
    requiresAchievements: ['first_run_completed']
  },
  {
    id: 'unlock.shop.starter_stable_chain',
    name: 'Stable Chain Starter Unlock',
    targetSystem: 'shopItems',
    targetId: 'starter_stable_chain',
    requiresAchievements: ['chain_certified']
  },
  {
    id: 'unlock.feature.blacksmith',
    name: 'Blacksmith Feature Unlock',
    targetSystem: 'featureGates',
    targetId: 'feature.blacksmith',
    requiresAchievements: ['first_run_completed']
  },
  {
    id: 'unlock.feature.blacksmith_reroll',
    name: 'Blacksmith Reroll Feature Unlock',
    targetSystem: 'featureGates',
    targetId: 'feature.blacksmith_reroll',
    requiresAchievements: ['first_purchase']
  },
  {
    id: 'unlock.blacksmith.raise_level',
    name: 'Raise Level Service Unlock',
    targetSystem: 'blacksmithServices',
    targetId: 'blacksmith.raise_level',
    requiresFeatureGates: ['feature.blacksmith']
  },
  {
    id: 'unlock.blacksmith.red_socket',
    name: 'Red Socket Service Unlock',
    targetSystem: 'blacksmithServices',
    targetId: 'blacksmith.red_socket',
    requiresAchievements: ['clear_d1'],
    requiresFeatureGates: ['feature.blacksmith']
  },
  {
    id: 'unlock.blacksmith.reroll',
    name: 'Reroll Service Unlock',
    targetSystem: 'blacksmithServices',
    targetId: 'blacksmith.reroll',
    requiresAchievements: ['first_purchase'],
    requiresFeatureGates: ['feature.blacksmith_reroll']
  },
  {
    id: 'unlock.permanentUpgrade.blacksmith_reroll',
    name: 'Reroll Permanent Upgrade Unlock',
    targetSystem: 'permanentUpgrades',
    targetId: 'unlock_blacksmith_reroll_service',
    requiresAchievements: ['first_purchase']
  },
  {
    id: 'unlock.relic.ash_compass',
    name: 'Ash Compass Unlock',
    targetSystem: 'relics',
    targetId: 'relic.ash_compass',
    requiresAchievements: ['clear_d1']
  },
  {
    id: 'unlock.arcana.blood_pact',
    name: 'Blood Pact Unlock',
    targetSystem: 'arcana',
    targetId: 'arcana.blood_pact',
    requiresAchievements: ['chain_certified']
  },
  {
    id: 'unlock.crawler.iron_monk',
    name: 'Iron Monk Unlock',
    targetSystem: 'crawlers',
    targetId: 'crawler.iron_monk',
    requiresAchievements: ['clear_d1']
  },
  {
    id: 'unlock.building.blacksmith',
    name: 'Blacksmith Building Entry Unlock',
    targetSystem: 'unlockBuildingEntries',
    targetId: 'building.blacksmith',
    requiresFeatureGates: ['feature.blacksmith']
  }
] as const satisfies readonly UnlockRuleConfig[];
