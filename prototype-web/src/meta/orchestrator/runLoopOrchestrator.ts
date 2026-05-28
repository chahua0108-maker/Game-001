import { selectProfileMeta } from '../profile/profileSelectors';
import type { LongLoopProfile } from '../profile/profileTypes';
import { createRunStartSnapshot } from './runStartSnapshot';
import { projectSettlement, visibleShopItemIds } from './settlementProjection';
import type {
  LongLoopEvent,
  LongLoopOrchestrator,
  LongLoopPhaseEvent,
  LongLoopState,
  NextRunSnapshot,
  RunLoopRunState,
  SettlementSummary,
  ShopStateSnapshot
} from './orchestratorTypes';

interface ProfileStoreLike {
  getSnapshot(): LongLoopProfile;
  setSnapshot(profile: LongLoopProfile): void;
  getPhaseEvents?(): readonly LongLoopPhaseEvent[];
  setPhaseEvents?(events: readonly LongLoopPhaseEvent[]): void;
}

export function createLongLoopState(profile: LongLoopProfile): LongLoopState {
  const cleanProfile = cloneProfile(profile);

  return {
    profile: cleanProfile,
    phase: 'hub_review',
    nextRunPreview: createRunStartSnapshot(cleanProfile),
    phaseEvents: [],
    settlementAppliedRunIds: [],
    runSequence: 0
  };
}

export function advanceLongLoop(state: LongLoopState, event: LongLoopEvent): LongLoopState {
  switch (event.type) {
    case 'start_run': {
      const runSequence = state.runSequence + 1;
      const currentRun: RunLoopRunState = {
        id: `run-${runSequence}`,
        districtId: event.districtId,
        starterKitId: event.starterKitId,
        status: 'active',
        runLocalEnhancementIds: []
      };

      return {
        ...state,
        phase: 'running',
        currentRun,
        settlementSummary: undefined,
        runSequence,
        phaseEvents: appendPhaseEvent(state.phaseEvents, { type: p0RunStartedEvent(event.districtId), runId: currentRun.id })
      };
    }

    case 'settle_run': {
      if (state.settlementAppliedRunIds.includes(event.runId)) {
        return state;
      }

      const summary = projectSettlement(state.profile, event);
      const profile = applySettlementRewards(state.profile, summary);

      return {
        ...state,
        profile,
        phase: 'settlement_review',
        currentRun: undefined,
        settlementSummary: summary,
        nextRunPreview: createRunStartSnapshot(profile, { districtId: event.districtId }),
        settlementAppliedRunIds: [...state.settlementAppliedRunIds, event.runId],
        phaseEvents: appendPhaseEvent(
          state.phaseEvents,
          { type: p0RunSettledEvent(event.districtId), runId: event.runId },
          { type: 'p0.settlement.shown', runId: event.runId }
        )
      };
    }

    case 'purchase_shop_item': {
      if (state.profile.shop.purchasedItemIds.includes(event.itemId)) {
        return state;
      }

      const profile = cloneProfile(state.profile);
      profile.shop.purchasedItemIds = appendUnique(profile.shop.purchasedItemIds, event.itemId);
      profile.achievements.unlockedIds = appendUnique(profile.achievements.unlockedIds, 'first_purchase');

      if (event.itemId === 'starter_stable_chain') {
        profile.starter.unlockedStarterKitIds = appendUnique(profile.starter.unlockedStarterKitIds, 'stable_chain');
        profile.collection.seenIds = appendUnique(profile.collection.seenIds, event.itemId);
      }

      const nextRunPreview = createRunStartSnapshot(profile, { districtId: state.nextRunPreview.districtId });

      return {
        ...state,
        profile,
        nextRunPreview,
        phaseEvents: appendPhaseEvent(
          state.phaseEvents,
          { type: 'p0.shop.item-purchased', itemId: event.itemId },
          { type: 'p0.next-run-preview.changed', itemId: event.itemId }
        )
      };
    }

    case 'apply_run_local_blacksmith_enhancement': {
      if (!state.currentRun || state.currentRun.id !== event.runId) {
        return state;
      }

      return {
        ...state,
        currentRun: {
          ...state.currentRun,
          runLocalEnhancementIds: appendUnique(state.currentRun.runLocalEnhancementIds, event.enhancementId)
        }
      };
    }

    case 'reload_profile': {
      const profile = cloneProfile(event.profile);

      return {
        ...createLongLoopState(profile),
        phaseEvents: appendPhaseEvent(state.phaseEvents, { type: 'p0.profile-meta.reloaded' })
      };
    }
  }
}

export function createLongLoopOrchestrator(options: { readonly profileStore: ProfileStoreLike }): LongLoopOrchestrator {
  let state = createLongLoopState(options.profileStore.getSnapshot());
  const storedPhaseEvents = options.profileStore.getPhaseEvents?.() ?? [];

  if (storedPhaseEvents.length > 0) {
    state = {
      ...state,
      phaseEvents: appendPhaseEvent(storedPhaseEvents, { type: 'p0.profile-meta.reloaded' })
    };
    options.profileStore.setPhaseEvents?.(state.phaseEvents);
  }

  function commit(nextState: LongLoopState): void {
    state = nextState;
    options.profileStore.setSnapshot(state.profile);
    options.profileStore.setPhaseEvents?.(state.phaseEvents);
  }

  return {
    startRun(input) {
      commit(advanceLongLoop(state, { type: 'start_run', ...input }));
      return state.currentRun as RunLoopRunState;
    },
    settleRun(input) {
      commit(advanceLongLoop(state, { type: 'settle_run', ...input }));
      return state.settlementSummary as SettlementSummary;
    },
    getShopState(): ShopStateSnapshot {
      return {
        visibleItemIds: visibleShopItemIds(state.profile.achievements.unlockedIds),
        purchasedItemIds: [...state.profile.shop.purchasedItemIds]
      };
    },
    previewNextRun(input = {}): NextRunSnapshot {
      return createRunStartSnapshot(state.profile, input);
    },
    purchaseShopItem(input) {
      const before = state.profile.achievements.unlockedIds;
      commit(advanceLongLoop(state, { type: 'purchase_shop_item', itemId: input.itemId }));
      const addedAchievementIds = state.profile.achievements.unlockedIds.filter((id) => !before.includes(id));

      return {
        itemId: input.itemId,
        achievementIds: addedAchievementIds
      };
    },
    applyRunLocalBlacksmithEnhancement(input) {
      state = advanceLongLoop(state, {
        type: 'apply_run_local_blacksmith_enhancement',
        runId: input.runId,
        enhancementId: input.enhancementId
      });
    },
    getProfileMeta() {
      return selectProfileMeta(state.profile);
    },
    getCurrentRunState() {
      return state.currentRun;
    },
    getPhaseEvents() {
      return state.phaseEvents;
    }
  };
}

function applySettlementRewards(profile: LongLoopProfile, summary: SettlementSummary): LongLoopProfile {
  const nextProfile = cloneProfile(profile);

  nextProfile.wallet.softCurrency += summary.softCurrencyDelta;
  nextProfile.wallet.metaGems += summary.metaGemDelta;
  nextProfile.achievements.unlockedIds = appendUnique(nextProfile.achievements.unlockedIds, ...summary.achievementIds);
  nextProfile.featureGates.unlockedIds = appendUnique(nextProfile.featureGates.unlockedIds, ...summary.unlockedFeatureGateIds);

  if (summary.outcome === 'district_cleared') {
    nextProfile.map.completedNodeIds = appendUnique(nextProfile.map.completedNodeIds, 'map.start');
    nextProfile.map.clearedDistrictIds = appendUnique(nextProfile.map.clearedDistrictIds, summary.districtId);
  }

  return nextProfile;
}

function cloneProfile(profile: LongLoopProfile): LongLoopProfile {
  return structuredClone(profile) as LongLoopProfile;
}

function appendUnique<T>(values: readonly T[], ...nextValues: readonly T[]): T[] {
  return [...new Set([...values, ...nextValues])];
}

function appendPhaseEvent(
  events: readonly LongLoopPhaseEvent[],
  ...nextEvents: readonly LongLoopPhaseEvent[]
): readonly LongLoopPhaseEvent[] {
  return [...events, ...nextEvents];
}

function p0RunStartedEvent(districtId: string): string {
  return districtId === 'D1' ? 'p0.d1.started' : 'run.started';
}

function p0RunSettledEvent(districtId: string): string {
  return districtId === 'D1' ? 'p0.d1.settled' : 'run.settled';
}
