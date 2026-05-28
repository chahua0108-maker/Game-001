import type {
  AchievementId,
  ArcanaId,
  BlacksmithServiceId,
  CrawlerId,
  FeatureGateId,
  GemId,
  MapNodeId,
  PermanentUpgradeId,
  RelicId,
  ShopItemId,
  StarterKitId
} from '../../config/schema/ids';

export const CURRENT_PROFILE_VERSION = 1;

export type ProfileVersion = typeof CURRENT_PROFILE_VERSION;
export type DistrictId = string;
export type CardId = string;
export type ProfilePersistenceBoundary = 'not_persisted';

export interface ProfileWallet {
  softCurrency: number;
  metaGems: number;
}

export interface ProfileMapProgress {
  unlockedNodeIds: MapNodeId[];
  completedNodeIds: MapNodeId[];
  clearedDistrictIds: DistrictId[];
}

export interface ProfileAchievements {
  unlockedIds: AchievementId[];
}

export interface ProfileShop {
  purchasedItemIds: ShopItemId[];
}

export interface ProfileStarter {
  selectedStarterKitId: StarterKitId;
  unlockedStarterKitIds: StarterKitId[];
  selectedCrawlerId: CrawlerId;
  unlockedCrawlerIds: CrawlerId[];
}

export interface ProfileBlacksmithPermits {
  purchasedPermitIds: ShopItemId[];
  unlockedServiceIds: BlacksmithServiceId[];
  runLocalServiceBoundary: 'card_level_socket_reroll_not_persisted';
}

export interface ProfilePermanentUpgradeBoundary {
  attack: ProfilePersistenceBoundary;
  hp: ProfilePersistenceBoundary;
  maxMp: ProfilePersistenceBoundary;
}

export interface ProfilePermanentUpgrades {
  upgradeRanks: Partial<Record<PermanentUpgradeId, number>>;
  statUpgradeBoundary: ProfilePermanentUpgradeBoundary;
}

export interface ProfileCollection {
  seenIds: string[];
  seenCategoryIds: string[];
}

export interface ProfileRelicArcanaGem {
  unlockedRelicIds: RelicId[];
  unlockedArcanaIds: ArcanaId[];
  ownedGemIds: GemId[];
  gemInventory: Partial<Record<GemId, number>>;
  socketBoundary: 'run_local_not_persisted';
}

export interface ProfileFeatureGates {
  unlockedIds: FeatureGateId[];
}

export interface ProfileRunLocalCardEnhancement {
  cardId: CardId;
  level: number;
}

export interface ProfileRunLocalPreview {
  cardEnhancements: ProfileRunLocalCardEnhancement[];
  gemSocketBoundary: 'not_persisted';
  rerollResultBoundary: 'not_persisted';
}

export interface ProfileOrchestratorPhaseEvent {
  type: string;
  runId?: string;
  itemId?: string;
}

export interface ProfileOrchestratorMeta {
  settledRunIds: string[];
  nextRunSequence: number;
  phaseEvents: ProfileOrchestratorPhaseEvent[];
}

export interface LongLoopProfile {
  version: ProfileVersion;
  profileId: string;
  wallet: ProfileWallet;
  map: ProfileMapProgress;
  achievements: ProfileAchievements;
  shop: ProfileShop;
  starter: ProfileStarter;
  blacksmith: ProfileBlacksmithPermits;
  permanentUpgrades: ProfilePermanentUpgrades;
  collection: ProfileCollection;
  relicArcanaGem: ProfileRelicArcanaGem;
  featureGates: ProfileFeatureGates;
  runLocalPreview: ProfileRunLocalPreview;
  orchestrator: ProfileOrchestratorMeta;
}

export interface CreateProfileOptions {
  profileId?: string;
}

export interface ProfileStorageOptions {
  storage?: Storage;
  storageKey?: string;
  profileId?: string;
}

export interface ProfileMetaSnapshot {
  achievementIds: AchievementId[];
  purchasedShopItemIds: ShopItemId[];
  purchasedBlacksmithPermitIds: ShopItemId[];
  selectedStarterKitId: StarterKitId;
  selectedCrawlerId: CrawlerId;
  featureGateIds: FeatureGateId[];
  seenCollectionIds: string[];
  completedMapNodeIds: MapNodeId[];
  clearedDistrictIds: DistrictId[];
}
