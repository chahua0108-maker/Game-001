import type { UnlockRuleConfig } from '../schema/definitions';

export const unlockRules = [
  {
    id: 'unlock.map.elite_route',
    name: 'Elite Route Unlock',
    targetSystem: 'mapNodes',
    targetId: 'map.elite_fork',
    requiresAchievements: ['achievement.completed_first_run']
  },
  {
    id: 'unlock.shop.blood_vial',
    name: 'Blood Vial Shop Unlock',
    targetSystem: 'shopItems',
    targetId: 'shop.blood_vial',
    requiresFeatureGates: ['feature.shop_inventory']
  },
  {
    id: 'unlock.feature.blacksmith',
    name: 'Blacksmith Feature Unlock',
    targetSystem: 'featureGates',
    targetId: 'feature.blacksmith',
    requiresAchievements: ['achievement.completed_first_run']
  },
  {
    id: 'unlock.blacksmith.sharpen',
    name: 'Sharpen Service Unlock',
    targetSystem: 'blacksmithServices',
    targetId: 'blacksmith.sharpen',
    requiresFeatureGates: ['feature.blacksmith']
  },
  {
    id: 'unlock.relic.ash_compass',
    name: 'Ash Compass Unlock',
    targetSystem: 'relics',
    targetId: 'relic.ash_compass',
    requiresAchievements: ['achievement.cleared_first_boss']
  },
  {
    id: 'unlock.arcana.blood_pact',
    name: 'Blood Pact Unlock',
    targetSystem: 'arcana',
    targetId: 'arcana.blood_pact',
    requiresAchievements: ['achievement.completed_first_run']
  },
  {
    id: 'unlock.crawler.iron_monk',
    name: 'Iron Monk Unlock',
    targetSystem: 'crawlers',
    targetId: 'crawler.iron_monk',
    requiresAchievements: ['achievement.completed_first_run']
  },
  {
    id: 'unlock.permanentUpgrade.max_health',
    name: 'Max Health Upgrade Unlock',
    targetSystem: 'permanentUpgrades',
    targetId: 'upgrade.max_health',
    requiresAchievements: ['achievement.bought_first_upgrade']
  },
  {
    id: 'unlock.building.blacksmith',
    name: 'Blacksmith Building Entry Unlock',
    targetSystem: 'unlockBuildingEntries',
    targetId: 'building.blacksmith',
    requiresFeatureGates: ['feature.blacksmith']
  }
] as const satisfies readonly UnlockRuleConfig[];
