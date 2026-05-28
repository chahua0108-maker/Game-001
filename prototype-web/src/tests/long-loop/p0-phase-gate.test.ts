import { describe, expect, it } from 'vitest';

import { createLongLoopOrchestrator } from '../../meta/orchestrator/longLoopOrchestrator';
import { createProfileStore } from '../../meta/profile/profileStore';
import { expectedP0PhaseEvents, p0CanonicalIds, phaseEventTypes } from './testFixtures';

describe('P0 long-loop phase gate', () => {
  it('proves D1 settlement, shop purchase, next-run change, and reload boundary', () => {
    const profileStore = createProfileStore({ profileId: 'p0-contract-profile' });
    const orchestrator = createLongLoopOrchestrator({ profileStore });

    const run = orchestrator.startRun({
      districtId: p0CanonicalIds.districtD1,
      starterKitId: p0CanonicalIds.starterKitDefaultChain
    });

    expect(run.districtId).toBe(p0CanonicalIds.districtD1);

    const settlement = orchestrator.settleRun({
      runId: run.id,
      outcome: 'district_cleared',
      districtId: p0CanonicalIds.districtD1
    });

    expect(settlement.achievementIds).toEqual(expect.arrayContaining([p0CanonicalIds.achievementClearD1]));
    expect(settlement.uiStateIds).toEqual(
      expect.arrayContaining([
        p0CanonicalIds.uiSettlement,
        p0CanonicalIds.uiUnlockToast,
        p0CanonicalIds.uiBlacksmithAvailable,
        p0CanonicalIds.uiShopInventory
      ])
    );

    const shop = orchestrator.getShopState();
    expect(shop.visibleItemIds).toContain(p0CanonicalIds.p0ShopItem);

    const previewBeforePurchase = orchestrator.previewNextRun({ districtId: p0CanonicalIds.districtD1 });
    const purchase = orchestrator.purchaseShopItem({ itemId: p0CanonicalIds.p0ShopItem });

    expect(purchase.itemId).toBe(p0CanonicalIds.p0ShopItem);
    expect(purchase.achievementIds).toContain(p0CanonicalIds.achievementFirstPurchase);

    const previewAfterPurchase = orchestrator.previewNextRun({ districtId: p0CanonicalIds.districtD1 });
    expect(previewAfterPurchase).not.toEqual(previewBeforePurchase);
    expect(previewAfterPurchase.starterKitIds).toContain(p0CanonicalIds.starterKitStableChain);

    orchestrator.applyRunLocalBlacksmithEnhancement({
      runId: run.id,
      enhancementId: p0CanonicalIds.runLocalBlacksmithEnhancement
    });

    const persistedProfile = profileStore.exportSnapshot();
    const reloadedProfileStore = createProfileStore({ snapshot: persistedProfile });
    const reloadedOrchestrator = createLongLoopOrchestrator({ profileStore: reloadedProfileStore });

    expect(reloadedOrchestrator.getProfileMeta().purchasedShopItemIds).toContain(p0CanonicalIds.p0ShopItem);
    expect(reloadedOrchestrator.getProfileMeta().achievementIds).toEqual(
      expect.arrayContaining([p0CanonicalIds.achievementClearD1, p0CanonicalIds.achievementFirstPurchase])
    );
    expect(reloadedOrchestrator.getCurrentRunState()).toBeUndefined();
    expect(reloadedOrchestrator.previewNextRun({ districtId: p0CanonicalIds.districtD1 }).runLocalEnhancementIds).not.toContain(
      p0CanonicalIds.runLocalBlacksmithEnhancement
    );

    expect(phaseEventTypes(reloadedOrchestrator.getPhaseEvents())).toEqual(expect.arrayContaining([...expectedP0PhaseEvents]));
  });
});
