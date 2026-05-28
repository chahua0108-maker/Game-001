import { describe, expect, it } from 'vitest';

import { CANONICAL_FEATURE_GATE_IDS } from '../../config/schema/ids';
import { createDefaultProfile } from '../../meta/profile/createProfile';
import { purchaseShopItem } from '../../meta/systems/shop/shopFacade';
import { selectShopItemRead, selectVisibleShopItemIds } from '../../meta/systems/shop/shopSelectors';

const stableStarterItemId = 'starter_stable_chain';
const raiseLevelPermitItemId = 'blacksmith_raise_level_permit';
const rerollPermitItemId = 'blacksmith_reroll_permit';

function profileWithUnlockedD1Shop() {
  const profile = createDefaultProfile({ profileId: 'shop-facade-d1' });
  profile.wallet.softCurrency = 200;
  profile.achievements.unlockedIds.push('first_run_completed', 'clear_d1', 'chain_certified');
  profile.featureGates.unlockedIds.push(CANONICAL_FEATURE_GATE_IDS.hubBlacksmith);
  return profile;
}

describe('shop facade', () => {
  it('purchases a visible blacksmith permit as a transaction effect without mutating blacksmith stock', () => {
    const profile = profileWithUnlockedD1Shop();
    const beforeProfile = structuredClone(profile);

    const result = purchaseShopItem(profile, raiseLevelPermitItemId);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(`Expected purchase to succeed, got ${result.reason}`);
    }

    expect(profile).toEqual(beforeProfile);
    expect(result.profile).not.toBe(profile);
    expect(result.profile.wallet.softCurrency).toBe(140);
    expect(result.profile.shop.purchasedItemIds).toEqual([raiseLevelPermitItemId]);
    expect(result.profile.blacksmith.purchasedPermitIds).toEqual([]);
    expect(result.profile.blacksmith.unlockedServiceIds).toEqual([]);
    expect(result.profile.runLocalPreview.cardEnhancements).toEqual([]);
    expect(result.purchase).toEqual({
      itemId: raiseLevelPermitItemId,
      currencyId: 'settlement_reputation',
      price: 60
    });
    expect(result.effects).toEqual([
      {
        type: 'GrantBlacksmithPermit',
        permitId: 'raise-level',
        sourceShopItemId: raiseLevelPermitItemId
      }
    ]);
  });

  it('fails locked or not-visible purchases without changing the profile', () => {
    const profile = createDefaultProfile({ profileId: 'shop-facade-locked' });
    profile.wallet.softCurrency = 200;
    const beforeProfile = structuredClone(profile);

    expect(selectVisibleShopItemIds(profile)).not.toContain(stableStarterItemId);
    expect(selectShopItemRead(profile, stableStarterItemId)?.state).toBe('locked');

    const result = purchaseShopItem(profile, stableStarterItemId);

    expect(result).toEqual({
      ok: false,
      reason: 'locked',
      profile
    });
    expect(profile).toEqual(beforeProfile);
    expect(result.profile).toEqual(beforeProfile);
  });

  it('fails visible purchases with insufficient currency without changing the profile', () => {
    const profile = profileWithUnlockedD1Shop();
    profile.wallet.softCurrency = 59;
    const beforeProfile = structuredClone(profile);

    expect(selectVisibleShopItemIds(profile)).toContain(raiseLevelPermitItemId);

    const result = purchaseShopItem(profile, raiseLevelPermitItemId);

    expect(result).toEqual({
      ok: false,
      reason: 'insufficient_currency',
      profile
    });
    expect(profile).toEqual(beforeProfile);
    expect(result.profile).toEqual(beforeProfile);
  });

  it('fails duplicate purchases without changing the profile', () => {
    const profile = profileWithUnlockedD1Shop();
    profile.shop.purchasedItemIds.push(raiseLevelPermitItemId);
    const beforeProfile = structuredClone(profile);

    const result = purchaseShopItem(profile, raiseLevelPermitItemId);

    expect(result).toEqual({
      ok: false,
      reason: 'already_purchased',
      profile
    });
    expect(profile).toEqual(beforeProfile);
    expect(result.profile).toEqual(beforeProfile);
  });

  it('fails unknown purchases without changing the profile', () => {
    const profile = profileWithUnlockedD1Shop();
    const beforeProfile = structuredClone(profile);

    const result = purchaseShopItem(profile, 'shop.unknown');

    expect(result).toEqual({
      ok: false,
      reason: 'unknown_item',
      profile
    });
    expect(profile).toEqual(beforeProfile);
    expect(result.profile).toEqual(beforeProfile);
  });

  it('records starter purchases without directly unlocking or selecting the starter kit', () => {
    const profile = profileWithUnlockedD1Shop();
    const beforeProfile = structuredClone(profile);

    const result = purchaseShopItem(profile, stableStarterItemId);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(`Expected purchase to succeed, got ${result.reason}`);
    }

    expect(profile).toEqual(beforeProfile);
    expect(result.profile.wallet.softCurrency).toBe(120);
    expect(result.profile.shop.purchasedItemIds).toEqual([stableStarterItemId]);
    expect(result.profile.starter.unlockedStarterKitIds).toEqual(['starter.default_chain']);
    expect(result.profile.starter.selectedStarterKitId).toBe('starter.default_chain');
    expect(result.effects).toEqual([
      {
        type: 'UnlockStarterPreview',
        starterKitId: 'starter.stable_chain',
        sourceShopItemId: stableStarterItemId
      }
    ]);
  });

  it('keeps cross-system state unchanged when buying the reroll permit', () => {
    const profile = profileWithUnlockedD1Shop();
    profile.achievements.unlockedIds.push('first_purchase');
    profile.featureGates.unlockedIds.push(CANONICAL_FEATURE_GATE_IDS.blacksmithReroll);
    const beforeProfile = structuredClone(profile);

    const result = purchaseShopItem(profile, rerollPermitItemId);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(`Expected purchase to succeed, got ${result.reason}`);
    }

    expect(result.profile.blacksmith).toEqual(beforeProfile.blacksmith);
    expect(result.profile.starter).toEqual(beforeProfile.starter);
    expect(result.profile.map).toEqual(beforeProfile.map);
    expect(result.profile.achievements).toEqual(beforeProfile.achievements);
    expect(result.profile.runLocalPreview).toEqual(beforeProfile.runLocalPreview);
    expect(result.effects).toEqual([
      {
        type: 'GrantBlacksmithPermit',
        permitId: 'reroll',
        sourceShopItemId: rerollPermitItemId
      }
    ]);
  });
});
