import { describe, expect, it } from 'vitest';

import { createDefaultProfile } from '../../meta/profile/createProfile';
import { createProfileStore } from '../../meta/profile/profileStore';
import { loadProfile, PROFILE_STORAGE_KEY, saveProfile } from '../../meta/profile/profileStorage';
import { advanceLongLoop, createLongLoopState } from '../../meta/orchestrator/runLoopOrchestrator';
import { p0CanonicalIds } from './testFixtures';

const blacksmithRaiseLevelPermitId = 'blacksmith_raise_level_permit';
const blacksmithRedSocketPermitId = 'blacksmith_red_socket_permit';

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

    state = advanceLongLoop(state, {
      type: 'purchase_shop_item',
      itemId: p0CanonicalIds.p0ShopItem
    });

    expect(state.profile.shop.purchasedItemIds).toContain(p0CanonicalIds.p0ShopItem);
    expect(state.profile.achievements.unlockedIds).toContain(p0CanonicalIds.achievementFirstPurchase);
    expect(state.nextRunPreview).not.toEqual(firstPreview);
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

  it('keeps blacksmith enhancements run-local instead of writing them to profile', () => {
    let state = createLongLoopState(createDefaultProfile({ profileId: 'orchestrator-p0-run-local' }));

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
    expect(state.profile.runLocalPreview.cardEnhancements).toEqual([]);
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
