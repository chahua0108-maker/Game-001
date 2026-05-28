import { CANONICAL_DISTRICT_IDS } from '../../config/schema/ids';
import type { DistrictId, LongLoopProfile } from '../profile/profileTypes';
import { selectAvailableStarterKitIds, toCanonicalStarterKitId } from '../systems/starter/starterSelectors';
import { createRunStartStarterPayload } from './applyStarterToRunSnapshot';
import type { NextRunSnapshot } from './orchestratorTypes';

const DEFAULT_DISTRICT_ID: DistrictId = CANONICAL_DISTRICT_IDS.d1;

export function createRunStartSnapshot(
  profile: LongLoopProfile,
  options: { readonly districtId?: DistrictId } = {}
): NextRunSnapshot {
  const snapshot = {
    districtId: options.districtId ?? DEFAULT_DISTRICT_ID,
    selectedStarterKitId: toCanonicalStarterKitId(profile.starter.selectedStarterKitId),
    starterKitIds: selectAvailableStarterKitIds(profile),
    purchasedShopItemIds: [...profile.shop.purchasedItemIds],
    featureGateIds: [...profile.featureGates.unlockedIds],
    runLocalEnhancementIds: []
  };

  return {
    ...snapshot,
    starterPayload: createRunStartStarterPayload(snapshot)
  };
}
