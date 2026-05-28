import { describe, expect, it } from 'vitest';

import { createDefaultProfile } from '../../meta/profile/createProfile';
import { advanceLongLoop, createLongLoopState } from '../../meta/orchestrator/runLoopOrchestrator';
import { p0CanonicalIds } from './testFixtures';

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
});
