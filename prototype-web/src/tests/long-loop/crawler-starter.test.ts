import { describe, expect, it } from 'vitest';

import { CANONICAL_STARTER_KIT_IDS } from '../../config/schema/ids';
import { createRunStartStarterPayload } from '../../meta/orchestrator/applyStarterToRunSnapshot';
import { advanceLongLoop } from '../../meta/orchestrator/runLoopOrchestrator';
import { createRunStartSnapshot } from '../../meta/orchestrator/runStartSnapshot';
import { createDefaultProfile } from '../../meta/profile/createProfile';
import { loadProfile, PROFILE_STORAGE_KEY, saveProfile } from '../../meta/profile/profileStorage';
import { crawlerReads } from '../../meta/systems/crawler/crawlerSelectors';
import { starterReads } from '../../meta/systems/starter/starterSelectors';

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

describe('crawler and starter build', () => {
  const defaultStarterKitId = CANONICAL_STARTER_KIT_IDS.defaultChain;
  const stableStarterKitId = CANONICAL_STARTER_KIT_IDS.stableChain;

  it('shows the default crawler as selected and a locked crawler preview', () => {
    const profile = createDefaultProfile();

    expect(crawlerReads(profile)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'crawler.blood_runner',
          starterKitId: defaultStarterKitId,
          state: 'selected',
          visibility: 'available'
        }),
        expect.objectContaining({
          id: 'crawler.iron_monk',
          starterKitId: stableStarterKitId,
          state: 'locked_preview',
          visibility: 'locked_preview'
        })
      ])
    );
  });

  it('shows a default starter and unlocks stable chain after purchase', () => {
    const profile = createDefaultProfile();

    expect(starterReads(profile).find((starter) => starter.id === defaultStarterKitId)?.state).toBe('selected');

    profile.shop.purchasedItemIds.push('starter_stable_chain');
    profile.starter.selectedStarterKitId = stableStarterKitId;

    expect(starterReads(profile).find((starter) => starter.id === stableStarterKitId)?.state).toBe('selected');
  });

  it('projects purchased stable chain through next-run snapshot without combat deck mutation', () => {
    const profile = createDefaultProfile();

    const beforePurchase = createRunStartSnapshot(profile);
    profile.shop.purchasedItemIds.push('starter_stable_chain');
    profile.starter.unlockedStarterKitIds.push(stableStarterKitId);
    const afterPurchase = createRunStartSnapshot(profile);
    profile.starter.selectedStarterKitId = stableStarterKitId;
    const stableChainPreview = createRunStartSnapshot(profile);
    const defaultPayload = createRunStartStarterPayload(afterPurchase);
    const stableChainPayload = createRunStartStarterPayload(stableChainPreview);

    expect(beforePurchase.starterKitIds).toEqual([defaultStarterKitId]);
    expect(afterPurchase.starterKitIds).toEqual([defaultStarterKitId, stableStarterKitId]);
    expect(defaultPayload).toEqual({
      selectedStarterKitId: defaultStarterKitId,
      availableStarterKitIds: [defaultStarterKitId, stableStarterKitId],
      deckModifierId: 'starter.default_chain.deck',
      grantedCardIds: expect.any(Array),
      starterCardIds: expect.any(Array),
      deckMutationBoundary: 'adapter_payload_only'
    });
    expect(defaultPayload.starterCardIds.length).toBeGreaterThan(0);
    expect(defaultPayload.grantedCardIds).toEqual(defaultPayload.starterCardIds);
    expect(stableChainPayload).toMatchObject({
      selectedStarterKitId: stableStarterKitId,
      availableStarterKitIds: [defaultStarterKitId, stableStarterKitId],
      deckModifierId: 'starter.stable_chain.deck'
    });
    expect(stableChainPayload.starterCardIds.length).toBeGreaterThan(0);
    expect(stableChainPayload.starterCardIds).not.toEqual(defaultPayload.starterCardIds);
  });

  it('saves the selected starter payload on active run start without mutating combat deck', () => {
    const profile = createDefaultProfile();
    profile.shop.purchasedItemIds.push('starter_stable_chain');
    profile.starter.unlockedStarterKitIds.push(stableStarterKitId);
    profile.starter.selectedStarterKitId = stableStarterKitId;
    const preview = createRunStartSnapshot(profile);
    const expectedPayload = createRunStartStarterPayload(preview);

    const state = advanceLongLoop(
      {
        profile,
        phase: 'hub_review',
        nextRunPreview: preview,
        phaseEvents: [],
        settlementAppliedRunIds: [],
        runSequence: 1
      },
      {
        type: 'start_run',
        districtId: 'D1',
        starterKitId: stableStarterKitId
      }
    );

    expect(state.currentRun).toMatchObject({
      starterKitId: stableStarterKitId,
      starterPayload: expectedPayload
    });
    expect(profile.runLocalPreview.cardEnhancements).toEqual([]);
  });

  it('keeps selected starter after reload through profile storage selectors', () => {
    const storage = new MemoryStorage();
    const profile = createDefaultProfile({ profileId: 'crawler-starter-reload' });

    profile.shop.purchasedItemIds.push('starter_stable_chain');
    profile.starter.unlockedStarterKitIds.push(stableStarterKitId);
    profile.starter.selectedStarterKitId = stableStarterKitId;

    saveProfile(profile, { storage });
    const rawSavedProfile = JSON.parse(storage.getItem(PROFILE_STORAGE_KEY) ?? '{}');
    const reloadedProfile = loadProfile({ storage, profileId: profile.profileId });

    expect(rawSavedProfile.starter.selectedStarterKitId).toBe(stableStarterKitId);
    expect(starterReads(reloadedProfile).find((starter) => starter.id === stableStarterKitId)?.state).toBe('selected');
  });
});
