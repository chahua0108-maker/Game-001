import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { CANONICAL_STARTER_KIT_IDS } from '../src/config/schema/ids';
import { createLongLoopOrchestrator } from '../src/meta/orchestrator/longLoopOrchestrator';
import { createDefaultProfile } from '../src/meta/profile/createProfile';
import { createProfileStore } from '../src/meta/profile/profileStore';
import { loadProfile, PROFILE_STORAGE_KEY, saveProfile } from '../src/meta/profile/profileStorage';
import type { LongLoopProfile } from '../src/meta/profile/profileTypes';
import { expectedP0PhaseEvents, p0CanonicalIds } from '../src/tests/long-loop/testFixtures';

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

  dump(): Record<string, string> {
    return Object.fromEntries(this.values.entries());
  }
}

interface EvidenceStep {
  readonly name: string;
  readonly status: 'pass' | 'failed';
  readonly detail: unknown;
}

describe('P0 long-loop QA evidence', () => {
  it('writes mandatory evidence for run start, settlement, shop purchase, next-run preview, reload, second run, and profile dump', async () => {
    const outputDir = process.env.QA_LONG_LOOP_OUTPUT_DIR ?? path.resolve('outputs/long-loop/p0-latest');
    const evidenceFile = process.env.QA_LONG_LOOP_EVIDENCE_FILE ?? path.join(outputDir, 'p0-long-loop-evidence.json');
    const profileStorageFile =
      process.env.QA_LONG_LOOP_PROFILE_STORAGE_FILE ?? path.join(outputDir, 'profile-storage.json');
    const profileDumpFile = process.env.QA_LONG_LOOP_PROFILE_DUMP_FILE ?? path.join(outputDir, 'profile-dump.json');
    const expectedStableStarterCardIds = ['debt_hook', 'wild_gap_key', 'severance_burst'];
    const expectedEvidenceStepCount = 7;
    await mkdir(outputDir, { recursive: true });
    const steps: EvidenceStep[] = [];

    try {
      const storage = new MemoryStorage();
      const profile = createDefaultProfile({ profileId: 'p0-qa-evidence-profile' });
      profile.starter.selectedStarterKitId = CANONICAL_STARTER_KIT_IDS.defaultChain;
      profile.starter.unlockedStarterKitIds = [CANONICAL_STARTER_KIT_IDS.defaultChain];
      const profileStore = createProfileStore({ snapshot: profile });
      const orchestrator = createLongLoopOrchestrator({ profileStore });

      const run = orchestrator.startRun({
        districtId: p0CanonicalIds.districtD1,
        starterKitId: CANONICAL_STARTER_KIT_IDS.defaultChain
      });
    steps.push({
      name: 'run_start',
      status: run.districtId === p0CanonicalIds.districtD1 ? 'pass' : 'failed',
      detail: run
    });

    const settlement = orchestrator.settleRun({
      runId: run.id,
      outcome: 'district_cleared',
      districtId: p0CanonicalIds.districtD1
    });
    steps.push({
      name: 'settlement',
      status:
        settlement.achievementIds.includes(p0CanonicalIds.achievementClearD1) &&
        settlement.uiStateIds.includes(p0CanonicalIds.uiSettlement) &&
        settlement.uiStateIds.includes(p0CanonicalIds.uiShopInventory)
          ? 'pass'
          : 'failed',
      detail: settlement
    });

    const shopBeforePurchase = orchestrator.getShopState();
    const previewBeforePurchase = orchestrator.previewNextRun({ districtId: p0CanonicalIds.districtD1 });
    const purchase = orchestrator.purchaseShopItem({ itemId: p0CanonicalIds.p0ShopItem });
    const previewAfterPurchase = orchestrator.previewNextRun({ districtId: p0CanonicalIds.districtD1 });
    steps.push({
      name: 'shop_purchase',
      status:
        purchase.ok &&
        purchase.achievementIds.includes(p0CanonicalIds.achievementFirstPurchase) &&
        orchestrator.getShopState().purchasedItemIds.includes(p0CanonicalIds.p0ShopItem)
          ? 'pass'
          : 'failed',
      detail: {
        shopBeforePurchase,
        purchase,
        shopAfterPurchase: orchestrator.getShopState()
      }
    });
    steps.push({
      name: 'next_run_preview',
      status:
        previewAfterPurchase.starterKitIds.includes(CANONICAL_STARTER_KIT_IDS.stableChain) &&
        JSON.stringify(previewAfterPurchase) !== JSON.stringify(previewBeforePurchase)
          ? 'pass'
          : 'failed',
      detail: {
        before: previewBeforePurchase,
        after: previewAfterPurchase
      }
    });

    saveProfile(profileStore.getSnapshot(), { storage });
    const rawProfile = storage.getItem(PROFILE_STORAGE_KEY);
    const loadedProfile = loadProfile({ storage, profileId: 'p0-qa-evidence-profile' });
    const reloadedProfileStore = createProfileStore({ snapshot: loadedProfile });
    const reloadedOrchestrator = createLongLoopOrchestrator({ profileStore: reloadedProfileStore });
    const reloadedMeta = reloadedOrchestrator.getProfileMeta();
    const reloadedPhaseEvents = reloadedOrchestrator.getPhaseEvents();
    const persistedReloadProfile = saveProfile(reloadedProfileStore.getSnapshot(), { storage });

    steps.push({
      name: 'reload_via_storage',
      status:
        Boolean(rawProfile) &&
        reloadedMeta.purchasedShopItemIds.includes(p0CanonicalIds.p0ShopItem) &&
        reloadedMeta.achievementIds.includes(p0CanonicalIds.achievementClearD1) &&
        reloadedMeta.achievementIds.includes(p0CanonicalIds.achievementFirstPurchase) &&
        reloadedOrchestrator.getCurrentRunState() === undefined &&
        expectedP0PhaseEvents.every((eventType) => reloadedPhaseEvents.some((event) => event.type === eventType))
          ? 'pass'
          : 'failed',
      detail: {
        storageKey: PROFILE_STORAGE_KEY,
        rawProfileBytes: rawProfile?.length ?? 0,
        reloadedMeta,
        reloadedCurrentRun: reloadedOrchestrator.getCurrentRunState() ?? null,
        reloadedPhaseEvents
      }
    });

    const secondRunPreview = reloadedOrchestrator.previewNextRun({ districtId: p0CanonicalIds.districtD1 });
    const secondRun = reloadedOrchestrator.startRun({
      districtId: p0CanonicalIds.districtD1,
      starterKitId: secondRunPreview.selectedStarterKitId
    });
    const secondRunPhaseEvents = reloadedOrchestrator.getPhaseEvents();
    const secondRunProfile = saveProfile(reloadedProfileStore.getSnapshot(), { storage });
    steps.push({
      name: 'second_run_after_reload',
      status:
        secondRun.id === 'run-2' &&
        secondRun.starterKitId === CANONICAL_STARTER_KIT_IDS.stableChain &&
        secondRun.starterPayload.selectedStarterKitId === CANONICAL_STARTER_KIT_IDS.stableChain &&
        secondRun.starterPayload.deckModifierId === 'starter.stable_chain.deck' &&
        JSON.stringify(secondRun.starterPayload.starterCardIds) === JSON.stringify(expectedStableStarterCardIds) &&
        secondRunPhaseEvents.some((event) => event.type === 'p0.d1.started' && event.runId === 'run-2') &&
        secondRunProfile.orchestrator.nextRunSequence === 3 &&
        secondRunProfile.starter.selectedStarterKitId === CANONICAL_STARTER_KIT_IDS.stableChain
          ? 'pass'
          : 'failed',
      detail: {
        preview: secondRunPreview,
        run: secondRun,
        nextRunSequence: secondRunProfile.orchestrator.nextRunSequence,
        selectedStarterKitId: secondRunProfile.starter.selectedStarterKitId,
        selectedCrawlerId: secondRunProfile.starter.selectedCrawlerId,
        phaseEvents: secondRunPhaseEvents
      }
    });

    const profileDump = buildProfileDump(secondRunProfile, {
      storageKey: PROFILE_STORAGE_KEY,
      evidenceFile,
      profileStorageFile,
      source: 'qa-long-loop.evidence.test.ts'
    });
    steps.push({
      name: 'profile_dump',
      status:
        profileDump.profile.profileId === 'p0-qa-evidence-profile' &&
        profileDump.profile.shop.purchasedItemIds.includes(p0CanonicalIds.p0ShopItem) &&
        profileDump.profile.starter.unlockedCrawlerIds.includes(profileDump.profile.starter.selectedCrawlerId) &&
        profileDump.profile.orchestrator.phaseEvents.some((event) => event.type === 'p0.profile-meta.reloaded')
          ? 'pass'
          : 'failed',
      detail: profileDump.summary
    });

    const assertions = {
      runStarted: steps.find((step) => step.name === 'run_start')?.status === 'pass',
      settlementShown: steps.find((step) => step.name === 'settlement')?.status === 'pass',
      shopPurchasePersisted: steps.find((step) => step.name === 'shop_purchase')?.status === 'pass',
      nextRunPreviewChanged: steps.find((step) => step.name === 'next_run_preview')?.status === 'pass',
      reloadViaStorage: steps.find((step) => step.name === 'reload_via_storage')?.status === 'pass',
      secondRunAfterReload: steps.find((step) => step.name === 'second_run_after_reload')?.status === 'pass',
      profileDumpReady: steps.find((step) => step.name === 'profile_dump')?.status === 'pass'
    };
    const gateScore = {
      passed: Object.values(assertions).filter(Boolean).length,
      total: Object.values(assertions).length
    };
    const status = steps.every((step) => step.status === 'pass') ? 'pass' : 'failed';
    const evidence = {
      name: 'p0-long-loop-evidence',
      status,
      generatedAt: new Date().toISOString(),
      evidenceSource: {
        type: 'vitest-node-orchestrator',
        appCodeExercised: [
          'src/meta/orchestrator/runLoopOrchestrator.ts',
          'src/meta/profile/profileStore.ts',
          'src/meta/profile/profileStorage.ts'
        ],
        browserAutomation: false,
        limitation:
          'This proof runs the app long-loop orchestrator and profile storage path in Vitest/Node MemoryStorage. It is QA proof, not DOM/browser rendering proof.'
      },
      browserProof: {
        status: 'not-run',
        reason:
          'prototype-web/package.json does not declare Playwright. Existing browser QA scripts rely on optional external Playwright; this P0 proof uses the lighter existing Vitest harness.'
      },
      storage: {
        key: PROFILE_STORAGE_KEY,
        file: profileStorageFile,
        rawProfileBytes: rawProfile?.length ?? 0
      },
      profileDump: {
        file: profileDumpFile,
        summary: profileDump.summary
      },
      assertions,
      gateScore,
      steps
    };

    await writeFile(
      profileStorageFile,
      `${JSON.stringify(
        {
          storageKey: PROFILE_STORAGE_KEY,
          source: evidence.evidenceSource,
          generatedAt: evidence.generatedAt,
          rawValue: storage.getItem(PROFILE_STORAGE_KEY),
          parsedProfile: secondRunProfile,
          storageDump: storage.dump()
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    await writeFile(profileDumpFile, `${JSON.stringify(profileDump, null, 2)}\n`, 'utf8');
    await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

      expect(status).toBe('pass');
      expect(assertions).toEqual({
        runStarted: true,
        settlementShown: true,
        shopPurchasePersisted: true,
        nextRunPreviewChanged: true,
        reloadViaStorage: true,
        secondRunAfterReload: true,
        profileDumpReady: true
      });
    } catch (error) {
      await writeFile(
        evidenceFile,
        `${JSON.stringify(
          {
            name: 'p0-long-loop-evidence',
            status: 'failed',
            generatedAt: new Date().toISOString(),
            evidenceSource: {
              type: 'vitest-node-orchestrator',
              appCodeExercised: [
                'src/meta/orchestrator/runLoopOrchestrator.ts',
                'src/meta/profile/profileStore.ts',
                'src/meta/profile/profileStorage.ts'
              ],
              browserAutomation: false,
              limitation:
                'This proof runs the app long-loop orchestrator and profile storage path in Vitest/Node MemoryStorage. It is QA proof, not DOM/browser rendering proof.'
            },
            browserProof: {
              status: 'not-run',
              reason:
                'prototype-web/package.json does not declare Playwright. Existing browser QA scripts rely on optional external Playwright; this P0 proof uses the lighter existing Vitest harness.'
            },
            steps,
            gateScore: {
              passed: steps.filter((step) => step.status === 'pass').length,
              total: expectedEvidenceStepCount
            },
            error: serializeError(error)
          },
          null,
          2
        )}\n`,
        'utf8'
      );
      throw error;
    }
  });
});

function buildProfileDump(
  profile: LongLoopProfile,
  options: { readonly storageKey: string; readonly evidenceFile: string; readonly profileStorageFile: string; readonly source: string }
) {
  return {
    name: 'p0-profile-dump',
    generatedAt: new Date().toISOString(),
    source: options.source,
    storageKey: options.storageKey,
    evidenceFile: options.evidenceFile,
    profileStorageFile: options.profileStorageFile,
    summary: {
      profileId: profile.profileId,
      version: profile.version,
      softCurrency: profile.wallet.softCurrency,
      metaGems: profile.wallet.metaGems,
      achievementIds: profile.achievements.unlockedIds,
      purchasedShopItemIds: profile.shop.purchasedItemIds,
      unlockedStarterKitIds: profile.starter.unlockedStarterKitIds,
      selectedStarterKitId: profile.starter.selectedStarterKitId,
      unlockedCrawlerIds: profile.starter.unlockedCrawlerIds,
      selectedCrawlerId: profile.starter.selectedCrawlerId,
      featureGateIds: profile.featureGates.unlockedIds,
      completedMapNodeIds: profile.map.completedNodeIds,
      clearedDistrictIds: profile.map.clearedDistrictIds,
      phaseEventTypes: profile.orchestrator.phaseEvents.map((event) => event.type),
      nextRunSequence: profile.orchestrator.nextRunSequence
    },
    profile
  };
}

function serializeError(error: unknown): { readonly message: string; readonly stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {})
    };
  }

  return {
    message: String(error)
  };
}
