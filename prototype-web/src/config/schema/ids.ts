export type AchievementId = string;
export type ArcanaId = string;
export type BlacksmithServiceId = string;
export type CardId = string;
export type CollectionCategoryId = string;
export type CrawlerId = string;
export type FeatureGateId = string;
export type GemId = string;
export type MapNodeId = string;
export type PermanentUpgradeId = string;
export type RelicId = string;
export type ShopItemId = string;
export type StarterKitId = string;
export type UnlockBuildingEntryId = string;
export type UnlockRuleId = string;

export const CANONICAL_DISTRICT_IDS = {
  d1: 'D1'
} as const;

export const CANONICAL_MAP_NODE_IDS = {
  start: 'map.start',
  d1: 'map.d1',
  d2: 'map.d2',
  d3: 'map.d3',
  d4: 'map.d4',
  d5: 'map.d5',
  d6: 'map.d6',
  d7: 'map.d7',
  d8: 'map.d8',
  d9: 'map.d9',
  d10: 'map.d10',
  eliteFork: 'map.elite_fork',
  firstBoss: 'map.first_boss'
} as const;

export const CANONICAL_FEATURE_GATE_IDS = {
  mapBranching: 'map.branching',
  hubShop: 'hub.shop',
  hubBlacksmith: 'hub.blacksmith',
  blacksmithReroll: 'blacksmith.reroll'
} as const;

export const CANONICAL_STARTER_KIT_IDS = {
  defaultChain: 'starter.default_chain',
  stableChain: 'starter.stable_chain'
} as const;

export const LEGACY_LONG_LOOP_ID_ALIASES: Readonly<Record<string, string>> = {
  d1: CANONICAL_MAP_NODE_IDS.d1,
  d2: CANONICAL_MAP_NODE_IDS.d2,
  d3: CANONICAL_MAP_NODE_IDS.d3,
  d4: CANONICAL_MAP_NODE_IDS.d4,
  d5: CANONICAL_MAP_NODE_IDS.d5,
  d6: CANONICAL_MAP_NODE_IDS.d6,
  d7: CANONICAL_MAP_NODE_IDS.d7,
  d8: CANONICAL_MAP_NODE_IDS.d8,
  d9: CANONICAL_MAP_NODE_IDS.d9,
  d10: CANONICAL_MAP_NODE_IDS.d10,
  'feature.map_branching': CANONICAL_FEATURE_GATE_IDS.mapBranching,
  'feature.shop_inventory': CANONICAL_FEATURE_GATE_IDS.hubShop,
  'feature.blacksmith': CANONICAL_FEATURE_GATE_IDS.hubBlacksmith,
  'feature.blacksmith_reroll': CANONICAL_FEATURE_GATE_IDS.blacksmithReroll,
  default_chain: CANONICAL_STARTER_KIT_IDS.defaultChain,
  stable_chain: CANONICAL_STARTER_KIT_IDS.stableChain
};

export function toCanonicalLongLoopId(id: string): string {
  return LEGACY_LONG_LOOP_ID_ALIASES[id] ?? id;
}

export type LongLoopConfigId =
  | AchievementId
  | ArcanaId
  | BlacksmithServiceId
  | CardId
  | CollectionCategoryId
  | CrawlerId
  | FeatureGateId
  | GemId
  | MapNodeId
  | PermanentUpgradeId
  | RelicId
  | ShopItemId
  | StarterKitId
  | UnlockBuildingEntryId
  | UnlockRuleId;
