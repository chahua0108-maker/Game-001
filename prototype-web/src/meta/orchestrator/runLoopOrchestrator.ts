import { longLoopConfig } from '../../config/data/longLoopConfig';
import type { ShopItemConfig } from '../../config/schema/definitions';
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

const blacksmithPermitServiceIds: Record<string, string> = {
  blacksmith_raise_level_permit: 'blacksmith.raise_level',
  blacksmith_red_socket_permit: 'blacksmith.red_socket',
  blacksmith_reroll_permit: 'blacksmith.reroll'
};

interface ProfileStoreLike {
  getSnapshot(): LongLoopProfile;
  setSnapshot(profile: LongLoopProfile): void;
}

export function createLongLoopState(profile: LongLoopProfile): LongLoopState {
  const cleanProfile = cloneProfile(profile);

  return {
    profile: cleanProfile,
    phase: 'hub_review',
    nextRunPreview: createRunStartSnapshot(cleanProfile),
    phaseEvents: clonePhaseEvents(cleanProfile.orchestrator.phaseEvents),
    settlementAppliedRunIds: [...cleanProfile.orchestrator.settledRunIds],
    runSequence: cleanProfile.orchestrator.nextRunSequence
  };
}

export function advanceLongLoop(state: LongLoopState, event: LongLoopEvent): LongLoopState {
  switch (event.type) {
    case 'start_run': {
      if (state.currentRun?.status === 'active') {
        return state;
      }

      const runSequence = Math.max(1, state.runSequence);
      const profile = cloneProfile(state.profile);
      const currentRun: RunLoopRunState = {
        id: `run-${runSequence}`,
        districtId: event.districtId,
        starterKitId: event.starterKitId,
        status: 'active',
        runLocalEnhancementIds: []
      };
      const phaseEvents = appendPhaseEvent(state.phaseEvents, { type: p0RunStartedEvent(event.districtId), runId: currentRun.id });

      profile.orchestrator.nextRunSequence = runSequence + 1;
      profile.orchestrator.phaseEvents = clonePhaseEvents(phaseEvents);

      return {
        ...state,
        profile,
        phase: 'running',
        currentRun,
        settlementSummary: undefined,
        runSequence: runSequence + 1,
        phaseEvents
      };
    }

    case 'settle_run': {
      if (!isActiveMatchingRun(state.currentRun, event) || state.settlementAppliedRunIds.includes(event.runId)) {
        return state;
      }

      const summary = projectSettlement(state.profile, event);
      const nextSettlementAppliedRunIds = appendUnique(state.settlementAppliedRunIds, event.runId);
      const phaseEvents = appendPhaseEvent(
        state.phaseEvents,
        { type: p0RunSettledEvent(event.districtId), runId: event.runId },
        { type: 'p0.settlement.shown', runId: event.runId }
      );
      const profile = applySettlementRewards(state.profile, summary, {
        phaseEvents,
        settlementAppliedRunIds: nextSettlementAppliedRunIds,
        runSequence: state.runSequence
      });

      return {
        ...state,
        profile,
        phase: 'settlement_review',
        currentRun: undefined,
        settlementSummary: summary,
        nextRunPreview: createRunStartSnapshot(profile, { districtId: event.districtId }),
        settlementAppliedRunIds: nextSettlementAppliedRunIds,
        phaseEvents
      };
    }

    case 'purchase_shop_item': {
      const shopItem = shopItemById(event.itemId);
      if (
        state.phase !== 'settlement_review' ||
        !shopItem ||
        state.profile.shop.purchasedItemIds.includes(event.itemId) ||
        !visibleShopItemIds(state.profile).includes(event.itemId) ||
        state.profile.wallet.softCurrency < shopItem.price
      ) {
        return state;
      }

      const profile = cloneProfile(state.profile);
      profile.wallet.softCurrency -= shopItem.price;
      profile.shop.purchasedItemIds = appendUnique(profile.shop.purchasedItemIds, event.itemId);
      profile.achievements.unlockedIds = appendUnique(profile.achievements.unlockedIds, 'first_purchase');

      if (event.itemId === 'starter_stable_chain') {
        profile.starter.unlockedStarterKitIds = appendUnique(profile.starter.unlockedStarterKitIds, 'stable_chain');
        profile.collection.seenIds = appendUnique(profile.collection.seenIds, event.itemId);
      }

      applyBlacksmithPermitPurchase(profile, event.itemId);

      const nextRunPreview = createRunStartSnapshot(profile, { districtId: state.nextRunPreview.districtId });
      const phaseEvents = appendPhaseEvent(
        state.phaseEvents,
        { type: 'p0.shop.item-purchased', itemId: event.itemId },
        { type: 'p0.next-run-preview.changed', itemId: event.itemId }
      );
      profile.orchestrator.phaseEvents = clonePhaseEvents(phaseEvents);

      return {
        ...state,
        profile,
        nextRunPreview,
        phaseEvents
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
      const reloaded = createLongLoopState(profile);
      const phaseEvents = appendPhaseEvent(reloaded.phaseEvents, { type: 'p0.profile-meta.reloaded' });
      const reloadedProfile = cloneProfile(reloaded.profile);
      reloadedProfile.orchestrator.phaseEvents = clonePhaseEvents(phaseEvents);

      return {
        ...reloaded,
        profile: reloadedProfile,
        phaseEvents
      };
    }
  }
}

export function createLongLoopOrchestrator(options: { readonly profileStore: ProfileStoreLike }): LongLoopOrchestrator {
  let state = createLongLoopState(options.profileStore.getSnapshot());

  if (state.phaseEvents.length > 0) {
    state = {
      ...state,
      phaseEvents: appendPhaseEvent(state.phaseEvents, { type: 'p0.profile-meta.reloaded' })
    };
    const profile = cloneProfile(state.profile);
    profile.orchestrator.phaseEvents = clonePhaseEvents(state.phaseEvents);
    state = {
      ...state,
      profile
    };
    options.profileStore.setSnapshot(state.profile);
  }

  function commit(nextState: LongLoopState): void {
    state = nextState;
    options.profileStore.setSnapshot(state.profile);
  }

  return {
    startRun(input) {
      commit(advanceLongLoop(state, { type: 'start_run', ...input }));
      return cloneRunState(state.currentRun as RunLoopRunState);
    },
    settleRun(input) {
      const before = state;
      commit(advanceLongLoop(state, { type: 'settle_run', ...input }));
      if (state === before) {
        throw new Error(`Cannot settle inactive run ${input.runId}`);
      }

      return cloneSettlementSummary(state.settlementSummary as SettlementSummary);
    },
    getShopState(): ShopStateSnapshot {
      return {
        visibleItemIds: visibleShopItemIds(state.profile),
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
      return state.currentRun ? cloneRunState(state.currentRun) : undefined;
    },
    getPhaseEvents() {
      return clonePhaseEvents(state.phaseEvents);
    }
  };
}

function applySettlementRewards(
  profile: LongLoopProfile,
  summary: SettlementSummary,
  orchestratorMeta: {
    readonly phaseEvents: readonly LongLoopPhaseEvent[];
    readonly settlementAppliedRunIds: readonly string[];
    readonly runSequence: number;
  }
): LongLoopProfile {
  const nextProfile = cloneProfile(profile);

  nextProfile.wallet.softCurrency += summary.softCurrencyDelta;
  nextProfile.wallet.metaGems += summary.metaGemDelta;
  nextProfile.achievements.unlockedIds = appendUnique(nextProfile.achievements.unlockedIds, ...summary.achievementIds);
  nextProfile.featureGates.unlockedIds = appendUnique(nextProfile.featureGates.unlockedIds, ...summary.unlockedFeatureGateIds);

  if (summary.outcome === 'district_cleared') {
    nextProfile.map.completedNodeIds = appendUnique(nextProfile.map.completedNodeIds, 'map.start');
    nextProfile.map.clearedDistrictIds = appendUnique(nextProfile.map.clearedDistrictIds, summary.districtId);
  }

  nextProfile.orchestrator.settledRunIds = [...orchestratorMeta.settlementAppliedRunIds];
  nextProfile.orchestrator.nextRunSequence = Math.max(1, orchestratorMeta.runSequence);
  nextProfile.orchestrator.phaseEvents = clonePhaseEvents(orchestratorMeta.phaseEvents);

  return nextProfile;
}

function cloneProfile(profile: LongLoopProfile): LongLoopProfile {
  return structuredClone(profile) as LongLoopProfile;
}

function cloneRunState(runState: RunLoopRunState): RunLoopRunState {
  return {
    ...runState,
    runLocalEnhancementIds: [...runState.runLocalEnhancementIds]
  };
}

function cloneSettlementSummary(summary: SettlementSummary): SettlementSummary {
  return {
    ...summary,
    achievementIds: [...summary.achievementIds],
    uiStateIds: [...summary.uiStateIds],
    unlockedFeatureGateIds: [...summary.unlockedFeatureGateIds],
    visibleShopItemIds: [...summary.visibleShopItemIds]
  };
}

function clonePhaseEvents(events: readonly LongLoopPhaseEvent[]): LongLoopPhaseEvent[] {
  return events.map((event) => ({ ...event }));
}

function appendUnique<T>(values: readonly T[], ...nextValues: readonly T[]): T[] {
  return [...new Set([...values, ...nextValues])];
}

function shopItemById(itemId: string): ShopItemConfig | undefined {
  return (longLoopConfig.shopItems as readonly ShopItemConfig[]).find((item) => item.id === itemId);
}

function applyBlacksmithPermitPurchase(profile: LongLoopProfile, itemId: string): void {
  const serviceId = blacksmithPermitServiceIds[itemId];
  if (!serviceId) {
    return;
  }

  profile.blacksmith.purchasedPermitIds = appendUnique(profile.blacksmith.purchasedPermitIds, itemId);
  profile.blacksmith.unlockedServiceIds = appendUnique(profile.blacksmith.unlockedServiceIds, serviceId);
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

function isActiveMatchingRun(currentRun: RunLoopRunState | undefined, event: Extract<LongLoopEvent, { type: 'settle_run' }>): boolean {
  return Boolean(
    currentRun &&
      currentRun.status === 'active' &&
      currentRun.id === event.runId &&
      currentRun.districtId === event.districtId
  );
}
