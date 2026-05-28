import { longLoopConfig } from '../../../config/data/longLoopConfig';
import type { ShopItemConfig } from '../../../config/schema/definitions';
import { CANONICAL_FEATURE_GATE_IDS, type ShopItemId } from '../../../config/schema/ids';
import type { LongLoopProfile } from '../../profile/profileTypes';
import { effectiveFeatureGateIds } from '../map/featureGateSelectors';
import { areUnlockRulesSatisfied } from '../map/unlockRuleEvaluator';

export type ShopItemReadState = 'available' | 'locked' | 'purchased';

export interface ShopItemRead {
  readonly id: ShopItemId;
  readonly name: string;
  readonly price: number;
  readonly categoryId: string;
  readonly state: ShopItemReadState;
  readonly isVisible: boolean;
}

export function selectShopItemReads(profile: LongLoopProfile): readonly ShopItemRead[] {
  return shopItems().map((item) => toShopItemRead(profile, item));
}

export function selectVisibleShopItemIds(profile: LongLoopProfile): readonly ShopItemId[] {
  return selectShopItemReads(profile)
    .filter((read) => read.isVisible)
    .map((read) => read.id);
}

export function selectShopItemRead(profile: LongLoopProfile, itemId: ShopItemId): ShopItemRead | undefined {
  const item = shopItemById(itemId);
  if (!item) {
    return undefined;
  }

  return toShopItemRead(profile, item);
}

export function isShopItemVisible(profile: LongLoopProfile, itemId: ShopItemId): boolean {
  return selectShopItemRead(profile, itemId)?.isVisible ?? false;
}

export function shopItemById(itemId: ShopItemId): ShopItemConfig | undefined {
  return shopItems().find((item) => item.id === itemId);
}

function toShopItemRead(profile: LongLoopProfile, item: ShopItemConfig): ShopItemRead {
  const isVisible = isItemEligible(profile, item);
  const state = profile.shop.purchasedItemIds.includes(item.id) ? 'purchased' : isVisible ? 'available' : 'locked';

  return {
    id: item.id,
    name: item.name,
    price: item.price,
    categoryId: item.categoryId,
    state,
    isVisible
  };
}

function isItemEligible(profile: LongLoopProfile, item: ShopItemConfig): boolean {
  const achievementIds = new Set(profile.achievements.unlockedIds);
  const featureGateIds = new Set(effectiveFeatureGateIds(profile));

  return (
    featureGateIds.has(CANONICAL_FEATURE_GATE_IDS.hubShop) &&
    (item.requiresAchievementIds ?? []).every((achievementId) => achievementIds.has(achievementId)) &&
    (item.requiresFeatureGateIds ?? []).every((featureGateId) => featureGateIds.has(featureGateId)) &&
    areItemUnlockRulesSatisfied(profile, item, featureGateIds)
  );
}

function areItemUnlockRulesSatisfied(
  profile: LongLoopProfile,
  item: ShopItemConfig,
  featureGateIds: ReadonlySet<string>
): boolean {
  if (!item.unlockRuleIds || item.unlockRuleIds.length === 0) {
    return true;
  }

  return areUnlockRulesSatisfied(item.unlockRuleIds, profile, { featureGateIds });
}

function shopItems(): readonly ShopItemConfig[] {
  return longLoopConfig.shopItems as readonly ShopItemConfig[];
}
