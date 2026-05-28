import type {
  AchievementConfig,
  ArcanaConfig,
  BlacksmithServiceConfig,
  CollectionCategoryConfig,
  CrawlerConfig,
  FeatureGateConfig,
  GemConfig,
  LongLoopConfig,
  MapNodeConfig,
  PermanentUpgradeConfig,
  RelicConfig,
  ShopItemConfig,
  StarterKitConfig,
  UnlockBuildingEntryConfig,
  UnlockRuleConfig
} from '../schema/definitions';

interface IdEntry {
  readonly id: string;
}

export interface ReadonlyTableQuery<TEntry extends IdEntry> {
  all(): readonly TEntry[];
  byId(id: string): TEntry | undefined;
}

export interface LongLoopConfigQueries {
  readonly achievements: ReadonlyTableQuery<AchievementConfig>;
  readonly arcana: ReadonlyTableQuery<ArcanaConfig>;
  readonly blacksmithServices: ReadonlyTableQuery<BlacksmithServiceConfig>;
  readonly collectionCategories: ReadonlyTableQuery<CollectionCategoryConfig>;
  readonly crawlers: ReadonlyTableQuery<CrawlerConfig>;
  readonly featureGates: ReadonlyTableQuery<FeatureGateConfig>;
  readonly gems: ReadonlyTableQuery<GemConfig>;
  readonly mapNodes: ReadonlyTableQuery<MapNodeConfig>;
  readonly permanentUpgrades: ReadonlyTableQuery<PermanentUpgradeConfig>;
  readonly relics: ReadonlyTableQuery<RelicConfig>;
  readonly shopItems: ReadonlyTableQuery<ShopItemConfig>;
  readonly starterKits: ReadonlyTableQuery<StarterKitConfig>;
  readonly unlockBuildingEntries: ReadonlyTableQuery<UnlockBuildingEntryConfig>;
  readonly unlockRules: ReadonlyTableQuery<UnlockRuleConfig>;
}

export function createLongLoopConfigQueries(config: LongLoopConfig): LongLoopConfigQueries {
  return {
    achievements: createTableQuery(config.achievements),
    arcana: createTableQuery(config.arcana),
    blacksmithServices: createTableQuery(config.blacksmithServices),
    collectionCategories: createTableQuery(config.collectionCategories),
    crawlers: createTableQuery(config.crawlers),
    featureGates: createTableQuery(config.featureGates),
    gems: createTableQuery(config.gems),
    mapNodes: createTableQuery(config.mapNodes),
    permanentUpgrades: createTableQuery(config.permanentUpgrades),
    relics: createTableQuery(config.relics),
    shopItems: createTableQuery(config.shopItems),
    starterKits: createTableQuery(config.starterKits),
    unlockBuildingEntries: createTableQuery(config.unlockBuildingEntries),
    unlockRules: createTableQuery(config.unlockRules)
  };
}

function createTableQuery<TEntry extends IdEntry>(entries: readonly TEntry[]): ReadonlyTableQuery<TEntry> {
  const allEntries = Object.freeze([...entries]);
  const byId = new Map(allEntries.map((entry) => [entry.id, entry]));

  return {
    all: () => allEntries,
    byId: (id: string) => byId.get(id)
  };
}
