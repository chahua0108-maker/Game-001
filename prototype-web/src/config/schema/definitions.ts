import type {
  AchievementId,
  ArcanaId,
  BlacksmithServiceId,
  CollectionCategoryId,
  CrawlerId,
  FeatureGateId,
  GemId,
  MapNodeId,
  PermanentUpgradeId,
  RelicId,
  ShopItemId,
  StarterKitId,
  UnlockBuildingEntryId,
  UnlockRuleId
} from './ids';

export const longLoopTableKeys = [
  'achievements',
  'arcana',
  'blacksmithServices',
  'collectionCategories',
  'crawlers',
  'featureGates',
  'first3HoursUnlockMatrix',
  'gems',
  'mapNodes',
  'permanentUpgrades',
  'relics',
  'shopItems',
  'starterKits',
  'unlockBuildingEntries',
  'unlockRules'
] as const;

export type LongLoopTableKey = (typeof longLoopTableKeys)[number];

export type UnlockTargetTableKey =
  | 'achievements'
  | 'arcana'
  | 'blacksmithServices'
  | 'collectionCategories'
  | 'crawlers'
  | 'featureGates'
  | 'gems'
  | 'mapNodes'
  | 'permanentUpgrades'
  | 'relics'
  | 'shopItems'
  | 'starterKits'
  | 'unlockBuildingEntries';

export interface NamedConfigEntry<TId extends string> {
  readonly id: TId;
  readonly name: string;
}

export interface MapNodeConfig extends NamedConfigEntry<MapNodeId> {
  readonly tier: 0 | 1 | 2 | 3;
  readonly nodeType: 'start' | 'combat' | 'elite' | 'shop' | 'event' | 'boss';
  readonly unlockRuleIds?: readonly UnlockRuleId[];
}

export interface FeatureGateConfig extends NamedConfigEntry<FeatureGateId> {
  readonly defaultState: 'locked' | 'available';
  readonly unlockRuleIds?: readonly UnlockRuleId[];
}

export interface ShopItemConfig extends NamedConfigEntry<ShopItemId> {
  readonly price: number;
  readonly categoryId: CollectionCategoryId;
  readonly requiresFeatureGateIds?: readonly FeatureGateId[];
  readonly requiresAchievementIds?: readonly AchievementId[];
  readonly unlockRuleIds?: readonly UnlockRuleId[];
}

export interface AchievementConfig extends NamedConfigEntry<AchievementId> {
  readonly condition: string;
}

export interface First3HoursUnlockMatrixEntry {
  readonly trigger: string;
  readonly mapNode: MapNodeId | 'none' | 'unchanged';
  readonly featureGate: FeatureGateId | 'none' | 'unchanged';
  readonly achievement: AchievementId | 'none' | 'unchanged';
  readonly uiState: string;
  readonly nextGoal: string;
  readonly visibility: 'hidden' | 'hinted' | 'condition_visible' | 'unlocked';
  readonly unlockRuleIds: readonly UnlockRuleId[];
}

export interface UnlockRuleConfig extends NamedConfigEntry<UnlockRuleId> {
  readonly targetSystem: UnlockTargetTableKey;
  readonly targetId: string;
  readonly requiresAchievements?: readonly AchievementId[];
  readonly requiresFeatureGates?: readonly FeatureGateId[];
}

export interface CrawlerConfig extends NamedConfigEntry<CrawlerId> {
  readonly starterKitId: StarterKitId;
  readonly unlockRuleIds?: readonly UnlockRuleId[];
}

export interface StarterKitConfig extends NamedConfigEntry<StarterKitId> {
  readonly crawlerId: CrawlerId;
  readonly shopItemIds: readonly ShopItemId[];
}

export interface BlacksmithServiceConfig extends NamedConfigEntry<BlacksmithServiceId> {
  readonly serviceType: 'upgrade' | 'reroll' | 'forge';
  readonly price: number;
  readonly unlockRuleIds?: readonly UnlockRuleId[];
}

export interface PermanentUpgradeConfig extends NamedConfigEntry<PermanentUpgradeId> {
  readonly effectType: 'choice_space' | 'service_unlock' | 'permit_stock';
  readonly maxRank: number;
  readonly gemCost: number;
  readonly unlockRuleIds?: readonly UnlockRuleId[];
}

export interface RelicConfig extends NamedConfigEntry<RelicId> {
  readonly rarity: 'common' | 'uncommon' | 'rare';
  readonly unlockRuleIds?: readonly UnlockRuleId[];
}

export interface ArcanaConfig extends NamedConfigEntry<ArcanaId> {
  readonly suit: 'blood' | 'ash' | 'iron';
  readonly unlockRuleIds?: readonly UnlockRuleId[];
}

export interface GemConfig extends NamedConfigEntry<GemId> {
  readonly gemType: 'run' | 'meta';
  readonly value: number;
}

export interface CollectionCategoryConfig extends NamedConfigEntry<CollectionCategoryId> {
  readonly sortOrder: number;
}

export interface UnlockBuildingEntryConfig extends NamedConfigEntry<UnlockBuildingEntryId> {
  readonly targetSystem: UnlockTargetTableKey;
  readonly targetId: string;
  readonly unlockRuleId: UnlockRuleId;
}

export interface LongLoopConfig {
  readonly achievements: readonly AchievementConfig[];
  readonly arcana: readonly ArcanaConfig[];
  readonly blacksmithServices: readonly BlacksmithServiceConfig[];
  readonly collectionCategories: readonly CollectionCategoryConfig[];
  readonly crawlers: readonly CrawlerConfig[];
  readonly featureGates: readonly FeatureGateConfig[];
  readonly first3HoursUnlockMatrix: readonly First3HoursUnlockMatrixEntry[];
  readonly gems: readonly GemConfig[];
  readonly mapNodes: readonly MapNodeConfig[];
  readonly permanentUpgrades: readonly PermanentUpgradeConfig[];
  readonly relics: readonly RelicConfig[];
  readonly shopItems: readonly ShopItemConfig[];
  readonly starterKits: readonly StarterKitConfig[];
  readonly unlockBuildingEntries: readonly UnlockBuildingEntryConfig[];
  readonly unlockRules: readonly UnlockRuleConfig[];
}

export type LongLoopTableCounts = Record<LongLoopTableKey, number>;
