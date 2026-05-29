import { describe, expect, it } from 'vitest';

import { longLoopConfig } from '../../config/data/longLoopConfig';
import { createDefaultProfile } from '../../meta/profile/createProfile';
import { createProfileStore } from '../../meta/profile/profileStore';
import { loadProfile, PROFILE_STORAGE_KEY, saveProfile } from '../../meta/profile/profileStorage';
import { selectProfileMeta } from '../../meta/profile/profileSelectors';
import { advanceLongLoop, createLongLoopOrchestrator, createLongLoopState } from '../../meta/orchestrator/runLoopOrchestrator';
import { p0CanonicalIds } from './testFixtures';

const blacksmithRaiseLevelPermitId = 'blacksmith_raise_level_permit';
const blacksmithRedSocketPermitId = 'blacksmith_red_socket_permit';
const blacksmithRaiseLevelServiceId = 'blacksmith.raise_level';

function shopItemPrice(itemId: string): number {
  const item = longLoopConfig.shopItems.find((entry) => entry.id === itemId);
  if (!item) {
    throw new Error(`Missing shop item ${itemId}`);
  }

  return item.price;
}

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('P0 run-loop orchestrator reducer', () => {
  it('settles D1 victory into hub review and projects a changed next run after first purchase', () => {
    let state = createLongLoopState(createDefaultProfile({ profileId: 'orchestrator-p0' }));
    const firstPreview = state.nextRunPreview;

    state = advanceLongLoop(state, {
      type: 'start_run',
      districtId: p0CanonicalIds.districtD1,
      starterKitId: p0CanonicalIds.starterKitDefaultChain
    });

    expect(state.currentRun?.districtId).toBe(p0CanonicalIds.districtD1);

    state = advanceLongLoop(state, {
      type: 'settle_run',
      runId: state.currentRun?.id ?? '',
      districtId: p0CanonicalIds.districtD1,
      outcome: 'district_cleared'
    });

    expect(state.phase).toBe('settlement_review');
    expect(state.settlementSummary?.achievementIds).toEqual(expect.arrayContaining([p0CanonicalIds.achievementClearD1]));
    expect(state.settlementSummary?.uiStateIds).toEqual(
      expect.arrayContaining([p0CanonicalIds.uiSettlement, p0CanonicalIds.uiBlacksmithAvailable])
    );
    expect(state.profile.map.completedNodeIds).toContain(p0CanonicalIds.mapD1);
    expect(state.profile.map.completedNodeIds).not.toContain(p0CanonicalIds.districtD1);
    expect(state.profile.map.completedNodeIds).not.toContain(p0CanonicalIds.mapStart);

    state = advanceLongLoop(state, {
      type: 'purchase_shop_item',
      itemId: p0CanonicalIds.p0ShopItem
    });

    expect(state.profile.shop.purchasedItemIds).toContain(p0CanonicalIds.p0ShopItem);
    expect(state.profile.achievements.unlockedIds).toContain(p0CanonicalIds.achievementFirstPurchase);
    expect(state.profile.starter.selectedStarterKitId).toBe(p0CanonicalIds.starterKitStableChain);
    expect(state.profile.starter.unlockedCrawlerIds).toContain('crawler.iron_monk');
    expect(state.profile.starter.selectedCrawlerId).toBe('crawler.iron_monk');
    expect(state.nextRunPreview).not.toEqual(firstPreview);
    expect(state.nextRunPreview.selectedStarterKitId).toBe(p0CanonicalIds.starterKitStableChain);
    expect(state.nextRunPreview.starterPayload.deckModifierId).toBe('starter.stable_chain.deck');
    expect(state.nextRunPreview.starterKitIds).toContain(p0CanonicalIds.starterKitStableChain);
  });

  it('blocks fresh-profile purchase of stable chain until the item is visible', () => {
    const state = createLongLoopState(createDefaultProfile({ profileId: 'orchestrator-p0-blocked-purchase' }));

    const blockedPurchase = advanceLongLoop(state, {
      type: 'purchase_shop_item',
      itemId: p0CanonicalIds.p0ShopItem
    });

    expect(blockedPurchase.profile.wallet).toEqual(state.profile.wallet);
    expect(blockedPurchase.profile.achievements.unlockedIds).toEqual([]);
    expect(blockedPurchase.profile.shop.purchasedItemIds).toEqual([]);
    expect(blockedPurchase.profile.starter.unlockedStarterKitIds).toEqual([p0CanonicalIds.starterKitDefaultChain]);
    expect(blockedPurchase.nextRunPreview.starterKitIds).not.toContain(p0CanonicalIds.starterKitStableChain);
  });

  it('blocks visible purchases when soft currency is insufficient without mutating profile', () => {
    const profile = createDefaultProfile({ profileId: 'orchestrator-p0-insufficient-currency' });
    profile.achievements.unlockedIds.push('chain_certified');
    const state = {
      ...createLongLoopState(profile),
      phase: 'settlement_review' as const
    };
    const beforeProfile = structuredClone(state.profile);

    const blockedPurchase = advanceLongLoop(state, {
      type: 'purchase_shop_item',
      itemId: p0CanonicalIds.p0ShopItem
    });

    expect(blockedPurchase.profile).toEqual(beforeProfile);
  });

  it('blocks fresh-profile purchase of blacksmith permits until feature gates are unlocked', () => {
    let state = createLongLoopState(createDefaultProfile({ profileId: 'orchestrator-p0-blocked-blacksmith' }));

    state = advanceLongLoop(state, {
      type: 'purchase_shop_item',
      itemId: blacksmithRaiseLevelPermitId
    });
    state = advanceLongLoop(state, {
      type: 'purchase_shop_item',
      itemId: blacksmithRedSocketPermitId
    });

    expect(state.profile.shop.purchasedItemIds).toEqual([]);
    expect(state.profile.achievements.unlockedIds).toEqual([]);
    expect(state.profile.featureGates.unlockedIds).not.toContain(p0CanonicalIds.featureBlacksmith);
  });

  it('allows blacksmith permit purchase during settlement review after D1 unlocks blacksmith', () => {
    let state = createLongLoopState(createDefaultProfile({ profileId: 'orchestrator-p0-blacksmith-purchase' }));

    state = advanceLongLoop(state, {
      type: 'start_run',
      districtId: p0CanonicalIds.districtD1,
      starterKitId: p0CanonicalIds.starterKitDefaultChain
    });
    state = advanceLongLoop(state, {
      type: 'settle_run',
      runId: state.currentRun?.id ?? '',
      districtId: p0CanonicalIds.districtD1,
      outcome: 'district_cleared'
    });

    expect(state.phase).toBe('settlement_review');
    expect(state.settlementSummary?.visibleShopItemIds).toContain(blacksmithRaiseLevelPermitId);

    state = advanceLongLoop(state, {
      type: 'purchase_shop_item',
      itemId: blacksmithRaiseLevelPermitId
    });

    expect(state.profile.shop.purchasedItemIds).toContain(blacksmithRaiseLevelPermitId);
    expect(state.profile.achievements.unlockedIds).toContain(p0CanonicalIds.achievementFirstPurchase);
    expect(state.profile.wallet.softCurrency).toBe(100 - shopItemPrice(blacksmithRaiseLevelPermitId));
  });

  it('persists blacksmith permit stock without promoting shop permits into permanent services', () => {
    const profileStore = createProfileStore({ profileId: 'orchestrator-p0-blacksmith-reload' });
    let state = createLongLoopState(profileStore.getSnapshot());

    state = advanceLongLoop(state, {
      type: 'start_run',
      districtId: p0CanonicalIds.districtD1,
      starterKitId: p0CanonicalIds.starterKitDefaultChain
    });
    state = advanceLongLoop(state, {
      type: 'settle_run',
      runId: state.currentRun?.id ?? '',
      districtId: p0CanonicalIds.districtD1,
      outcome: 'district_cleared'
    });
    state = advanceLongLoop(state, {
      type: 'purchase_shop_item',
      itemId: blacksmithRaiseLevelPermitId
    });
    profileStore.setSnapshot(state.profile);

    expect(state.profile.wallet.softCurrency).toBe(100 - shopItemPrice(blacksmithRaiseLevelPermitId));
    expect(state.profile.blacksmith.purchasedPermitIds).toContain(blacksmithRaiseLevelPermitId);
    expect(state.profile.blacksmith.unlockedServiceIds).not.toContain(blacksmithRaiseLevelServiceId);
    expect(selectProfileMeta(state.profile).purchasedBlacksmithPermitIds).toContain(blacksmithRaiseLevelPermitId);

    const reloadedProfile = createProfileStore({ snapshot: profileStore.exportSnapshot() }).getSnapshot();
    expect(reloadedProfile.blacksmith.purchasedPermitIds).toContain(blacksmithRaiseLevelPermitId);
    expect(reloadedProfile.blacksmith.unlockedServiceIds).not.toContain(blacksmithRaiseLevelServiceId);
    expect(selectProfileMeta(reloadedProfile).purchasedBlacksmithPermitIds).toContain(blacksmithRaiseLevelPermitId);
  });

  it('deducts starter purchase price once and keeps next-run preview behavior', () => {
    let state = createLongLoopState(createDefaultProfile({ profileId: 'orchestrator-p0-starter-price' }));

    state = advanceLongLoop(state, {
      type: 'start_run',
      districtId: p0CanonicalIds.districtD1,
      starterKitId: p0CanonicalIds.starterKitDefaultChain
    });
    state = advanceLongLoop(state, {
      type: 'settle_run',
      runId: state.currentRun?.id ?? '',
      districtId: p0CanonicalIds.districtD1,
      outcome: 'district_cleared'
    });

    const settledCurrency = state.profile.wallet.softCurrency;
    state = advanceLongLoop(state, {
      type: 'purchase_shop_item',
      itemId: p0CanonicalIds.p0ShopItem
    });
    const currencyAfterFirstPurchase = state.profile.wallet.softCurrency;
    state = advanceLongLoop(state, {
      type: 'purchase_shop_item',
      itemId: p0CanonicalIds.p0ShopItem
    });

    expect(currencyAfterFirstPurchase).toBe(settledCurrency - shopItemPrice(p0CanonicalIds.p0ShopItem));
    expect(state.profile.wallet.softCurrency).toBe(currencyAfterFirstPurchase);
    expect(state.profile.shop.purchasedItemIds.filter((id) => id === p0CanonicalIds.p0ShopItem)).toHaveLength(1);
    expect(state.profile.starter.selectedStarterKitId).toBe(p0CanonicalIds.starterKitStableChain);
    expect(state.profile.starter.unlockedCrawlerIds).toContain('crawler.iron_monk');
    expect(state.profile.starter.selectedCrawlerId).toBe('crawler.iron_monk');
    expect(state.nextRunPreview.selectedStarterKitId).toBe(p0CanonicalIds.starterKitStableChain);
    expect(state.nextRunPreview.starterPayload.deckModifierId).toBe('starter.stable_chain.deck');
    expect(state.nextRunPreview.starterKitIds).toContain(p0CanonicalIds.starterKitStableChain);
  });

  it('blocks purchase while a run is active even when an item would otherwise be visible', () => {
    const profile = createDefaultProfile({ profileId: 'orchestrator-p0-running-purchase' });
    profile.featureGates.unlockedIds.push(p0CanonicalIds.featureBlacksmith);
    let state = createLongLoopState(profile);

    state = advanceLongLoop(state, {
      type: 'start_run',
      districtId: p0CanonicalIds.districtD1,
      starterKitId: p0CanonicalIds.starterKitDefaultChain
    });
    state = advanceLongLoop(state, {
      type: 'purchase_shop_item',
      itemId: blacksmithRaiseLevelPermitId
    });

    expect(state.phase).toBe('running');
    expect(state.profile.shop.purchasedItemIds).toEqual([]);
    expect(state.profile.achievements.unlockedIds).toEqual([]);
  });

  it('does not replace an active run or advance sequence when startRun is called twice', () => {
    let state = createLongLoopState(createDefaultProfile({ profileId: 'orchestrator-p0-double-start' }));

    state = advanceLongLoop(state, {
      type: 'start_run',
      districtId: p0CanonicalIds.districtD1,
      starterKitId: p0CanonicalIds.starterKitDefaultChain
    });
    const activeRun = state.currentRun;
    const nextRunSequence = state.profile.orchestrator.nextRunSequence;

    state = advanceLongLoop(state, {
      type: 'start_run',
      districtId: p0CanonicalIds.districtD1,
      starterKitId: p0CanonicalIds.starterKitStableChain
    });

    expect(state.currentRun).toEqual(activeRun);
    expect(state.profile.orchestrator.nextRunSequence).toBe(nextRunSequence);
    expect(state.runSequence).toBe(nextRunSequence);
  });

  it('blocks run-local blacksmith enhancement before the matching permit or service is unlocked', () => {
    let state = createLongLoopState(createDefaultProfile({ profileId: 'orchestrator-p0-run-local-blocked' }));

    state = advanceLongLoop(state, {
      type: 'start_run',
      districtId: p0CanonicalIds.districtD1,
      starterKitId: p0CanonicalIds.starterKitDefaultChain
    });
    state = advanceLongLoop(state, {
      type: 'apply_run_local_blacksmith_enhancement',
      runId: state.currentRun?.id ?? '',
      enhancementId: p0CanonicalIds.runLocalBlacksmithEnhancement
    });

    expect(state.currentRun?.runLocalEnhancementIds).not.toContain(p0CanonicalIds.runLocalBlacksmithEnhancement);
    expect(state.nextRunPreview.runLocalEnhancementIds).not.toContain(p0CanonicalIds.runLocalBlacksmithEnhancement);
    expect(state.profile.runLocalPreview.cardEnhancements).toEqual([]);
  });

  it('consumes a purchased blacksmith permit after one run-local enhancement and blocks repeat use', () => {
    let state = createLongLoopState(createDefaultProfile({ profileId: 'orchestrator-p0-run-local-permitted' }));

    state = advanceLongLoop(state, {
      type: 'start_run',
      districtId: p0CanonicalIds.districtD1,
      starterKitId: p0CanonicalIds.starterKitDefaultChain
    });
    state = advanceLongLoop(state, {
      type: 'settle_run',
      runId: state.currentRun?.id ?? '',
      districtId: p0CanonicalIds.districtD1,
      outcome: 'district_cleared'
    });
    state = advanceLongLoop(state, {
      type: 'purchase_shop_item',
      itemId: blacksmithRaiseLevelPermitId
    });
    state = advanceLongLoop(state, {
      type: 'start_run',
      districtId: p0CanonicalIds.districtD1,
      starterKitId: p0CanonicalIds.starterKitDefaultChain
    });
    state = advanceLongLoop(state, {
      type: 'apply_run_local_blacksmith_enhancement',
      runId: state.currentRun?.id ?? '',
      enhancementId: p0CanonicalIds.runLocalBlacksmithEnhancement
    });

    expect(state.currentRun?.runLocalEnhancementIds).toContain(p0CanonicalIds.runLocalBlacksmithEnhancement);
    expect(state.profile.blacksmith.purchasedPermitIds).not.toContain(blacksmithRaiseLevelPermitId);
    expect(state.profile.runLocalPreview.cardEnhancements).toEqual([]);

    state = advanceLongLoop(state, {
      type: 'start_run',
      districtId: p0CanonicalIds.districtD1,
      starterKitId: p0CanonicalIds.starterKitDefaultChain
    });
    state = advanceLongLoop(state, {
      type: 'settle_run',
      runId: state.currentRun?.id ?? '',
      districtId: p0CanonicalIds.districtD1,
      outcome: 'district_cleared'
    });
    state = advanceLongLoop(state, {
      type: 'start_run',
      districtId: p0CanonicalIds.districtD1,
      starterKitId: p0CanonicalIds.starterKitDefaultChain
    });
    state = advanceLongLoop(state, {
      type: 'apply_run_local_blacksmith_enhancement',
      runId: state.currentRun?.id ?? '',
      enhancementId: p0CanonicalIds.runLocalBlacksmithEnhancement
    });

    expect(state.currentRun?.runLocalEnhancementIds).not.toContain(p0CanonicalIds.runLocalBlacksmithEnhancement);
    expect(state.profile.blacksmith.purchasedPermitIds).not.toContain(blacksmithRaiseLevelPermitId);
    expect(state.profile.runLocalPreview.cardEnhancements).toEqual([]);
  });

  it('keeps permanent blacksmith service unlocks valid without permit stock', () => {
    const profile = createDefaultProfile({ profileId: 'orchestrator-p0-run-local-service-unlock' });
    profile.blacksmith.unlockedServiceIds.push(blacksmithRaiseLevelServiceId);
    let state = createLongLoopState(profile);

    state = advanceLongLoop(state, {
      type: 'start_run',
      districtId: p0CanonicalIds.districtD1,
      starterKitId: p0CanonicalIds.starterKitDefaultChain
    });
    state = advanceLongLoop(state, {
      type: 'apply_run_local_blacksmith_enhancement',
      runId: state.currentRun?.id ?? '',
      enhancementId: p0CanonicalIds.runLocalBlacksmithEnhancement
    });

    expect(state.currentRun?.runLocalEnhancementIds).toContain(p0CanonicalIds.runLocalBlacksmithEnhancement);
    expect(state.profile.blacksmith.purchasedPermitIds).toEqual([]);

    state = advanceLongLoop(state, {
      type: 'settle_run',
      runId: state.currentRun?.id ?? '',
      districtId: p0CanonicalIds.districtD1,
      outcome: 'district_cleared'
    });
    state = advanceLongLoop(state, {
      type: 'start_run',
      districtId: p0CanonicalIds.districtD1,
      starterKitId: p0CanonicalIds.starterKitDefaultChain
    });
    state = advanceLongLoop(state, {
      type: 'apply_run_local_blacksmith_enhancement',
      runId: state.currentRun?.id ?? '',
      enhancementId: p0CanonicalIds.runLocalBlacksmithEnhancement
    });

    expect(state.currentRun?.runLocalEnhancementIds).toContain(p0CanonicalIds.runLocalBlacksmithEnhancement);
    expect(state.profile.blacksmith.unlockedServiceIds).toContain(blacksmithRaiseLevelServiceId);
  });

  it('returns explicit public shop purchase results for success and rejected commands', () => {
    const profileStore = createProfileStore({ profileId: 'orchestrator-p0-purchase-results' });
    const orchestrator = createLongLoopOrchestrator({ profileStore });

    expect(orchestrator.purchaseShopItem({ itemId: p0CanonicalIds.p0ShopItem })).toMatchObject({
      ok: false,
      itemId: p0CanonicalIds.p0ShopItem
    });

    const run = orchestrator.startRun({
      districtId: p0CanonicalIds.districtD1,
      starterKitId: p0CanonicalIds.starterKitDefaultChain
    });
    orchestrator.settleRun({
      runId: run.id,
      districtId: p0CanonicalIds.districtD1,
      outcome: 'district_cleared'
    });

    expect(orchestrator.purchaseShopItem({ itemId: 'blacksmith_reroll_permit' })).toEqual({
      ok: false,
      itemId: 'blacksmith_reroll_permit',
      reason: 'not_visible'
    });

    const success = orchestrator.purchaseShopItem({ itemId: blacksmithRaiseLevelPermitId });
    expect(success).toMatchObject({
      ok: true,
      itemId: blacksmithRaiseLevelPermitId,
      purchase: {
        itemId: blacksmithRaiseLevelPermitId,
        currencyId: 'settlement_reputation',
        price: shopItemPrice(blacksmithRaiseLevelPermitId)
      },
      effects: [
        {
          type: 'GrantBlacksmithPermit',
          permitId: 'raise-level',
          sourceShopItemId: blacksmithRaiseLevelPermitId
        }
      ]
    });
    if (!success.ok) {
      throw new Error(`Expected blacksmith permit purchase to succeed, got ${success.reason}`);
    }
    expect(success.achievementIds).toContain(p0CanonicalIds.achievementFirstPurchase);

    expect(orchestrator.purchaseShopItem({ itemId: blacksmithRaiseLevelPermitId })).toEqual({
      ok: false,
      itemId: blacksmithRaiseLevelPermitId,
      reason: 'already_purchased'
    });
    expect(orchestrator.purchaseShopItem({ itemId: blacksmithRedSocketPermitId })).toEqual({
      ok: false,
      itemId: blacksmithRedSocketPermitId,
      reason: 'insufficient_currency'
    });
  });

  it('does not grant settlement rewards without an active matching run', () => {
    let state = createLongLoopState(createDefaultProfile({ profileId: 'orchestrator-p0-invalid-settle' }));

    state = advanceLongLoop(state, {
      type: 'settle_run',
      runId: 'foreign-run',
      districtId: p0CanonicalIds.districtD1,
      outcome: 'district_cleared'
    });

    expect(state.profile.wallet.softCurrency).toBe(0);
    expect(state.profile.wallet.metaGems).toBe(0);
    expect(state.profile.achievements.unlockedIds).not.toContain(p0CanonicalIds.achievementClearD1);

    state = advanceLongLoop(state, {
      type: 'start_run',
      districtId: p0CanonicalIds.districtD1,
      starterKitId: p0CanonicalIds.starterKitDefaultChain
    });
    state = advanceLongLoop(state, {
      type: 'settle_run',
      runId: 'foreign-run',
      districtId: p0CanonicalIds.districtD1,
      outcome: 'district_cleared'
    });

    expect(state.currentRun?.id).toBe('run-1');
    expect(state.profile.wallet.softCurrency).toBe(0);
    expect(state.profile.achievements.unlockedIds).not.toContain(p0CanonicalIds.achievementClearD1);
  });

  it('does not duplicate settlement rewards across export, load, and recreate state', () => {
    let state = createLongLoopState(createDefaultProfile({ profileId: 'orchestrator-p0-idempotent' }));

    state = advanceLongLoop(state, {
      type: 'start_run',
      districtId: p0CanonicalIds.districtD1,
      starterKitId: p0CanonicalIds.starterKitDefaultChain
    });
    const settledRunId = state.currentRun?.id ?? '';
    state = advanceLongLoop(state, {
      type: 'settle_run',
      runId: settledRunId,
      districtId: p0CanonicalIds.districtD1,
      outcome: 'district_cleared'
    });

    const settledProfile = state.profile;
    const reloadedState = createLongLoopState(settledProfile);
    const duplicateSettlement = advanceLongLoop(reloadedState, {
      type: 'settle_run',
      runId: settledRunId,
      districtId: p0CanonicalIds.districtD1,
      outcome: 'district_cleared'
    });

    expect(duplicateSettlement.profile.wallet.softCurrency).toBe(settledProfile.wallet.softCurrency);
    expect(duplicateSettlement.profile.wallet.metaGems).toBe(settledProfile.wallet.metaGems);
    expect(duplicateSettlement.profile.achievements.unlockedIds).toEqual(settledProfile.achievements.unlockedIds);
  });

  it('starts a monotonic next run after reload instead of reusing a settled run id', () => {
    let state = createLongLoopState(createDefaultProfile({ profileId: 'orchestrator-p0-monotonic' }));

    state = advanceLongLoop(state, {
      type: 'start_run',
      districtId: p0CanonicalIds.districtD1,
      starterKitId: p0CanonicalIds.starterKitDefaultChain
    });
    const settledRunId = state.currentRun?.id ?? '';
    state = advanceLongLoop(state, {
      type: 'settle_run',
      runId: settledRunId,
      districtId: p0CanonicalIds.districtD1,
      outcome: 'district_cleared'
    });

    const reloadedState = createLongLoopState(state.profile);
    const nextRunState = advanceLongLoop(reloadedState, {
      type: 'start_run',
      districtId: p0CanonicalIds.districtD1,
      starterKitId: p0CanonicalIds.starterKitDefaultChain
    });

    expect(nextRunState.currentRun?.id).not.toBe(settledRunId);
    expect(nextRunState.currentRun?.id).toBe('run-2');
  });

  it('exports a profileStorage-compatible profile without undeclared side channels', () => {
    const storage = new MemoryStorage();
    const profileStore = createProfileStore({ profileId: 'orchestrator-p0-compatible-store' });
    let state = createLongLoopState(profileStore.getSnapshot());

    state = advanceLongLoop(state, {
      type: 'start_run',
      districtId: p0CanonicalIds.districtD1,
      starterKitId: p0CanonicalIds.starterKitDefaultChain
    });
    state = advanceLongLoop(state, {
      type: 'settle_run',
      runId: state.currentRun?.id ?? '',
      districtId: p0CanonicalIds.districtD1,
      outcome: 'district_cleared'
    });
    profileStore.setSnapshot(state.profile);

    const exportedProfile = profileStore.exportSnapshot();
    expect(Object.keys(exportedProfile)).not.toContain('__longLoopPhaseEvents');

    saveProfile(exportedProfile, { storage });
    const rawSavedProfile = JSON.parse(storage.getItem(PROFILE_STORAGE_KEY) ?? '{}');
    expect(Object.keys(rawSavedProfile)).not.toContain('__longLoopPhaseEvents');
    expect(loadProfile({ storage }).orchestrator.settledRunIds).toContain('run-1');
  });
});
