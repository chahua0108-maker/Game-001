import { longLoopConfig } from '../../config/data/longLoopConfig';
import type { ShopItemConfig } from '../../config/schema/definitions';
import { CANONICAL_DISTRICT_IDS } from '../../config/schema/ids';
import type { ShopItemId } from '../../config/schema/ids';
import type { LongLoopProfile } from '../profile/profileTypes';
import { effectiveFeatureGateIds, featureGateIdsUnlockedAfterAchievements } from '../systems/map/featureGateSelectors';
import type { SettlementInput, SettlementSummary } from './orchestratorTypes';

type ShopEligibilityProfile = Pick<LongLoopProfile, 'achievements' | 'featureGates'>;

export function projectSettlement(profile: LongLoopProfile, input: SettlementInput): SettlementSummary {
  if (input.outcome === 'failed') {
    return {
      runId: input.runId,
      outcome: input.outcome,
      districtId: input.districtId,
      achievementIds: [],
      uiStateIds: ['settlement'],
      unlockedFeatureGateIds: [],
      visibleShopItemIds: visibleShopItemIds(profile),
      softCurrencyDelta: 0,
      metaGemDelta: 0
    };
  }

  const achievementIds = input.districtId === CANONICAL_DISTRICT_IDS.d1
    ? ['first_run_completed', 'clear_d1', 'chain_certified']
    : ['first_run_completed'];
  const unlockedFeatureGateIds = featureGateIdsUnlockedAfterAchievements(profile, achievementIds);

  return {
    runId: input.runId,
    outcome: input.outcome,
    districtId: input.districtId,
    achievementIds,
    uiStateIds: ['settlement', 'unlock_toast', 'blacksmith_available', 'shop_inventory'],
    unlockedFeatureGateIds,
    visibleShopItemIds: visibleShopItemIds({
      achievements: {
        unlockedIds: [...profile.achievements.unlockedIds, ...achievementIds]
      },
      featureGates: {
        unlockedIds: [...profile.featureGates.unlockedIds, ...unlockedFeatureGateIds]
      }
    }),
    softCurrencyDelta: 100,
    metaGemDelta: 1
  };
}

export function visibleShopItemIds(profile: ShopEligibilityProfile): readonly ShopItemId[] {
  const achievements = new Set(profile.achievements.unlockedIds);
  const featureGates = new Set(effectiveFeatureGateIds(profile));

  const shopItems: readonly ShopItemConfig[] = longLoopConfig.shopItems;

  return shopItems
    .filter((item) => (item.requiresAchievementIds ?? []).every((id) => achievements.has(id)))
    .filter((item) => (item.requiresFeatureGateIds ?? []).every((id) => featureGates.has(id)))
    .map((item) => item.id);
}
