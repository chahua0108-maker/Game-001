import type {
  FeatureGateId,
  MapNodeId,
  ShopItemId,
  StarterKitId
} from '../../config/schema/ids';
import type { DistrictId, LongLoopProfile, ProfileMetaSnapshot, ProfileRunLocalPreview } from './profileTypes';

export function selectProfileMeta(profile: LongLoopProfile): ProfileMetaSnapshot {
  return {
    achievementIds: [...profile.achievements.unlockedIds],
    purchasedShopItemIds: [...profile.shop.purchasedItemIds],
    purchasedBlacksmithPermitIds: [...profile.blacksmith.purchasedPermitIds],
    selectedStarterKitId: profile.starter.selectedStarterKitId,
    selectedCrawlerId: profile.starter.selectedCrawlerId,
    featureGateIds: [...profile.featureGates.unlockedIds],
    seenCollectionIds: [...profile.collection.seenIds],
    completedMapNodeIds: [...profile.map.completedNodeIds],
    clearedDistrictIds: [...profile.map.clearedDistrictIds]
  };
}

export function selectFeatureGateIds(profile: LongLoopProfile): FeatureGateId[] {
  return [...profile.featureGates.unlockedIds];
}

export function selectPurchasedShopItemIds(profile: LongLoopProfile): ShopItemId[] {
  return [...profile.shop.purchasedItemIds];
}

export function selectSelectedStarterKitId(profile: LongLoopProfile): StarterKitId {
  return profile.starter.selectedStarterKitId;
}

export function selectMapProgress(profile: LongLoopProfile): {
  unlockedNodeIds: MapNodeId[];
  completedNodeIds: MapNodeId[];
  clearedDistrictIds: DistrictId[];
} {
  return {
    unlockedNodeIds: [...profile.map.unlockedNodeIds],
    completedNodeIds: [...profile.map.completedNodeIds],
    clearedDistrictIds: [...profile.map.clearedDistrictIds]
  };
}

export function selectRunLocalPreview(profile: LongLoopProfile): ProfileRunLocalPreview {
  return {
    cardEnhancements: profile.runLocalPreview.cardEnhancements.map((enhancement) => ({ ...enhancement })),
    gemSocketBoundary: profile.runLocalPreview.gemSocketBoundary,
    rerollResultBoundary: profile.runLocalPreview.rerollResultBoundary
  };
}
