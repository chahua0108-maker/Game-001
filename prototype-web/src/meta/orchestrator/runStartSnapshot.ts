import type { DistrictId, LongLoopProfile } from '../profile/profileTypes';
import type { NextRunSnapshot } from './orchestratorTypes';

const DEFAULT_DISTRICT_ID: DistrictId = 'D1';
const DEFAULT_STARTER_KIT_ID = 'default_chain';
const STABLE_CHAIN_STARTER_KIT_ID = 'stable_chain';
const STABLE_CHAIN_SHOP_ITEM_ID = 'starter_stable_chain';

export function createRunStartSnapshot(
  profile: LongLoopProfile,
  options: { readonly districtId?: DistrictId } = {}
): NextRunSnapshot {
  const starterKitIds = new Set(profile.starter.unlockedStarterKitIds);

  if (profile.shop.purchasedItemIds.includes(STABLE_CHAIN_SHOP_ITEM_ID)) {
    starterKitIds.add(STABLE_CHAIN_STARTER_KIT_ID);
  }

  if (starterKitIds.size === 0) {
    starterKitIds.add(DEFAULT_STARTER_KIT_ID);
  }

  return {
    districtId: options.districtId ?? DEFAULT_DISTRICT_ID,
    selectedStarterKitId: profile.starter.selectedStarterKitId,
    starterKitIds: [...starterKitIds],
    purchasedShopItemIds: [...profile.shop.purchasedItemIds],
    featureGateIds: [...profile.featureGates.unlockedIds],
    runLocalEnhancementIds: []
  };
}
