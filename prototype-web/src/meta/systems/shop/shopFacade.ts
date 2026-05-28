import type { ShopItemId, StarterKitId } from '../../../config/schema/ids';
import type { LongLoopProfile } from '../../profile/profileTypes';
import { selectShopItemRead, shopItemById } from './shopSelectors';

export type ShopCurrencyId = 'settlement_reputation';
export type BlacksmithPermitId = 'raise-level' | 'red-socket' | 'reroll';

export type ShopPurchaseEffect =
  | {
      readonly type: 'GrantBlacksmithPermit';
      readonly permitId: BlacksmithPermitId;
      readonly sourceShopItemId: ShopItemId;
    }
  | {
      readonly type: 'UnlockStarterPreview';
      readonly starterKitId: StarterKitId;
      readonly sourceShopItemId: ShopItemId;
    };

export type ShopPurchaseFailureReason = 'unknown_item' | 'locked' | 'insufficient_currency' | 'already_purchased';

export type ShopPurchaseResult =
  | {
      readonly ok: true;
      readonly profile: LongLoopProfile;
      readonly purchase: {
        readonly itemId: ShopItemId;
        readonly currencyId: ShopCurrencyId;
        readonly price: number;
      };
      readonly effects: readonly ShopPurchaseEffect[];
    }
  | {
      readonly ok: false;
      readonly reason: ShopPurchaseFailureReason;
      readonly profile: LongLoopProfile;
    };

const purchaseEffectsByItemId: Readonly<Record<ShopItemId, readonly ShopPurchaseEffect[]>> = {
  starter_stable_chain: [
    {
      type: 'UnlockStarterPreview',
      starterKitId: 'starter.stable_chain',
      sourceShopItemId: 'starter_stable_chain'
    }
  ],
  blacksmith_raise_level_permit: [
    {
      type: 'GrantBlacksmithPermit',
      permitId: 'raise-level',
      sourceShopItemId: 'blacksmith_raise_level_permit'
    }
  ],
  blacksmith_red_socket_permit: [
    {
      type: 'GrantBlacksmithPermit',
      permitId: 'red-socket',
      sourceShopItemId: 'blacksmith_red_socket_permit'
    }
  ],
  blacksmith_reroll_permit: [
    {
      type: 'GrantBlacksmithPermit',
      permitId: 'reroll',
      sourceShopItemId: 'blacksmith_reroll_permit'
    }
  ]
};

export function purchaseShopItem(profile: LongLoopProfile, itemId: ShopItemId): ShopPurchaseResult {
  const item = shopItemById(itemId);
  if (!item) {
    return rejectPurchase(profile, 'unknown_item');
  }

  if (profile.shop.purchasedItemIds.includes(itemId)) {
    return rejectPurchase(profile, 'already_purchased');
  }

  const read = selectShopItemRead(profile, itemId);
  if (!read?.isVisible) {
    return rejectPurchase(profile, 'locked');
  }

  if (profile.wallet.softCurrency < item.price) {
    return rejectPurchase(profile, 'insufficient_currency');
  }

  const nextProfile = structuredClone(profile);
  nextProfile.wallet.softCurrency -= item.price;
  nextProfile.shop.purchasedItemIds = [...nextProfile.shop.purchasedItemIds, itemId];

  return {
    ok: true,
    profile: nextProfile,
    purchase: {
      itemId,
      currencyId: 'settlement_reputation',
      price: item.price
    },
    effects: purchaseEffectsByItemId[itemId] ?? []
  };
}

function rejectPurchase(
  profile: LongLoopProfile,
  reason: ShopPurchaseFailureReason
): Extract<ShopPurchaseResult, { readonly ok: false }> {
  return {
    ok: false,
    reason,
    profile
  };
}
