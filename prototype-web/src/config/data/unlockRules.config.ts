import type { UnlockRuleConfig } from '../schema/definitions';
import { CANONICAL_FEATURE_GATE_IDS, CANONICAL_MAP_NODE_IDS } from '../schema/ids';

export const unlockRules = [
  {
    id: 'unlock.map.d2',
    name: 'D2 Unlock',
    targetSystem: 'mapNodes',
    targetId: CANONICAL_MAP_NODE_IDS.d2,
    requiresAchievements: ['clear_d1']
  },
  {
    id: 'unlock.map.d3',
    name: 'D3 Unlock',
    targetSystem: 'mapNodes',
    targetId: CANONICAL_MAP_NODE_IDS.d3,
    requiresAchievements: ['clear_d2']
  },
  {
    id: 'unlock.map.d4',
    name: 'D4 Pollution Preview Unlock',
    targetSystem: 'mapNodes',
    targetId: CANONICAL_MAP_NODE_IDS.d4,
    requiresAchievements: ['build_survived_d3']
  },
  {
    id: 'unlock.map.elite_route',
    name: 'Elite Route Unlock',
    targetSystem: 'mapNodes',
    targetId: CANONICAL_MAP_NODE_IDS.eliteFork,
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
    id: 'unlock.hub.blacksmith',
    name: 'Blacksmith Feature Unlock',
    targetSystem: 'featureGates',
    targetId: CANONICAL_FEATURE_GATE_IDS.hubBlacksmith,
    requiresAchievements: ['first_run_completed']
  },
  {
    id: 'unlock.blacksmith.reroll_gate',
    name: 'Blacksmith Reroll Feature Unlock',
    targetSystem: 'featureGates',
    targetId: CANONICAL_FEATURE_GATE_IDS.blacksmithReroll,
    requiresAchievements: ['first_purchase']
  },
  {
    id: 'unlock.blacksmith.raise_level',
    name: 'Raise Level Service Unlock',
    targetSystem: 'blacksmithServices',
    targetId: 'blacksmith.raise_level',
    requiresFeatureGates: [CANONICAL_FEATURE_GATE_IDS.hubBlacksmith]
  },
  {
    id: 'unlock.blacksmith.red_socket',
    name: 'Red Socket Service Unlock',
    targetSystem: 'blacksmithServices',
    targetId: 'blacksmith.red_socket',
    requiresAchievements: ['clear_d1'],
    requiresFeatureGates: [CANONICAL_FEATURE_GATE_IDS.hubBlacksmith]
  },
  {
    id: 'unlock.blacksmith.reroll',
    name: 'Reroll Service Unlock',
    targetSystem: 'blacksmithServices',
    targetId: 'blacksmith.reroll',
    requiresAchievements: ['first_purchase'],
    requiresFeatureGates: [CANONICAL_FEATURE_GATE_IDS.blacksmithReroll]
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
    requiresFeatureGates: [CANONICAL_FEATURE_GATE_IDS.hubBlacksmith]
  }
] as const satisfies readonly UnlockRuleConfig[];
