import { CANONICAL_DISTRICT_IDS, CANONICAL_MAP_NODE_IDS } from '../../config/schema/ids';
import { selectProfileMeta } from '../profile/profileSelectors';
import type { LongLoopProfile } from '../profile/profileTypes';
import { purchaseShopItem as purchaseShopItemTransaction } from '../systems/shop/shopFacade';
import type { ShopPurchaseEffect, ShopPurchaseFailureReason as ShopFacadePurchaseFailureReason } from '../systems/shop/shopFacade';
import { createRunStartStarterPayload } from './applyStarterToRunSnapshot';
import { createRunStartSnapshot } from './runStartSnapshot';
import { projectSettlement, visibleShopItemIds } from './settlementProjection';
import type {
  LongLoopEvent,
  BlacksmithEnhancementFailureReason,
  LongLoopOrchestrator,
  LongLoopPhaseEvent,
  LongLoopState,
  NextRunSnapshot,
  RunLoopRunState,
  SettlementSummary,
  ShopPurchaseFailureReason,
  ShopPurchaseResult,
  ShopStateSnapshot
} from './orchestratorTypes';

const blacksmithEnhancementRequirements: Record<string, { readonly permitId: string; readonly serviceId: string }> = {
  blacksmith_raise_level: {
    permitId: 'blacksmith_raise_level_permit',
    serviceId: 'blacksmith.raise_level'
  },
  blacksmith_red_socket: {
    permitId: 'blacksmith_red_socket_permit',
    serviceId: 'blacksmith.red_socket'
  },
  blacksmith_reroll: {
    permitId: 'blacksmith_reroll_permit',
    serviceId: 'blacksmith.reroll'
  }
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
      const starterPayload = createRunStartStarterPayload({
        selectedStarterKitId: event.starterKitId,
        starterKitIds: state.nextRunPreview.starterKitIds
      });
      const currentRun: RunLoopRunState = {
        id: `run-${runSequence}`,
        districtId: event.districtId,
        starterKitId: event.starterKitId,
        status: 'active',
        starterPayload,
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
      if (state.phase !== 'settlement_review') {
        return state;
      }

      const purchaseResult = purchaseShopItemTransaction(state.profile, event.itemId);
      if (!purchaseResult.ok) {
        return state;
      }

      const profile = consumeShopPurchaseEffects(purchaseResult.profile, purchaseResult.effects);
      profile.achievements.unlockedIds = appendUnique(profile.achievements.unlockedIds, 'first_purchase');

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
        phaseEvents,
        lastShopPurchase: {
          ok: true,
          itemId: purchaseResult.purchase.itemId,
          achievementIds: ['first_purchase'].filter((id) => !state.profile.achievements.unlockedIds.includes(id)),
          purchase: { ...purchaseResult.purchase },
          effects: cloneShopPurchaseEffects(purchaseResult.effects)
        }
      };
    }

    case 'apply_run_local_blacksmith_enhancement': {
      const currentRun = state.currentRun;
      if (!currentRun || blacksmithEnhancementRejectionReason(state, event)) {
        return state;
      }

      const application = applyBlacksmithEnhancement(state.profile, event.enhancementId);

      return {
        ...state,
        profile: application.profile,
        currentRun: {
          ...currentRun,
          runLocalEnhancementIds: appendUnique(currentRun.runLocalEnhancementIds, event.enhancementId)
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
      if (state.phase !== 'settlement_review') {
        return {
          ok: false,
          itemId: input.itemId,
          reason: 'not_settlement_review'
        };
      }

      const beforeState = state;
      commit(advanceLongLoop(state, { type: 'purchase_shop_item', itemId: input.itemId }));
      if (state !== beforeState && state.lastShopPurchase?.itemId === input.itemId) {
        return cloneShopPurchaseResult(state.lastShopPurchase);
      }

      const rejectedPurchase = purchaseShopItemTransaction(beforeState.profile, input.itemId);
      const reason = rejectedPurchase.ok ? 'unknown_item' : mapShopFacadeFailureReason(rejectedPurchase.reason);

      return {
        ok: false,
        itemId: input.itemId,
        reason
      };
    },
    applyRunLocalBlacksmithEnhancement(input) {
      const rejectionReason = blacksmithEnhancementRejectionReason(state, {
        type: 'apply_run_local_blacksmith_enhancement',
        runId: input.runId,
        enhancementId: input.enhancementId
      });
      if (rejectionReason) {
        return {
          ok: false,
          enhancementId: input.enhancementId,
          reason: rejectionReason
        };
      }

      const beforePermitIds = state.profile.blacksmith.purchasedPermitIds;
      commit(
        advanceLongLoop(state, {
          type: 'apply_run_local_blacksmith_enhancement',
          runId: input.runId,
          enhancementId: input.enhancementId
        })
      );
      const consumedPermitId = beforePermitIds.find((id) => !state.profile.blacksmith.purchasedPermitIds.includes(id));

      return {
        ok: true,
        enhancementId: input.enhancementId,
        ...(consumedPermitId ? { consumedPermitId } : {})
      };
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
    nextProfile.map.completedNodeIds = appendUnique(nextProfile.map.completedNodeIds, mapNodeIdForDistrict(summary.districtId));
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
    starterPayload: {
      ...runState.starterPayload,
      availableStarterKitIds: [...runState.starterPayload.availableStarterKitIds],
      grantedCardIds: [...runState.starterPayload.grantedCardIds],
      starterCardIds: [...runState.starterPayload.starterCardIds]
    },
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

function consumeShopPurchaseEffects(profile: LongLoopProfile, effects: readonly ShopPurchaseEffect[]): LongLoopProfile {
  const nextProfile = cloneProfile(profile);

  for (const effect of effects) {
    switch (effect.type) {
      case 'GrantBlacksmithPermit':
        nextProfile.blacksmith.purchasedPermitIds = appendUnique(
          nextProfile.blacksmith.purchasedPermitIds,
          effect.sourceShopItemId
        );
        break;
      case 'UnlockStarterPreview':
        nextProfile.starter.unlockedStarterKitIds = appendUnique(nextProfile.starter.unlockedStarterKitIds, effect.starterKitId);
        nextProfile.collection.seenIds = appendUnique(nextProfile.collection.seenIds, effect.sourceShopItemId);
        break;
    }
  }

  return nextProfile;
}

function cloneShopPurchaseResult(
  result: Extract<ShopPurchaseResult, { readonly ok: true }>
): Extract<ShopPurchaseResult, { readonly ok: true }> {
  return {
    ok: true,
    itemId: result.itemId,
    achievementIds: [...result.achievementIds],
    purchase: { ...result.purchase },
    effects: cloneShopPurchaseEffects(result.effects)
  };
}

function cloneShopPurchaseEffects(effects: readonly ShopPurchaseEffect[]): ShopPurchaseEffect[] {
  return effects.map((effect) => ({ ...effect }));
}

function mapShopFacadeFailureReason(reason: ShopFacadePurchaseFailureReason): ShopPurchaseFailureReason {
  return reason === 'locked' ? 'not_visible' : reason;
}

function blacksmithEnhancementRejectionReason(
  state: LongLoopState,
  event: Extract<LongLoopEvent, { type: 'apply_run_local_blacksmith_enhancement' }>
): BlacksmithEnhancementFailureReason | undefined {
  if (!state.currentRun || state.currentRun.id !== event.runId) {
    return 'invalid_run';
  }

  const requirement = blacksmithEnhancementRequirements[event.enhancementId];
  if (!requirement) {
    return 'unknown_enhancement';
  }

  if (
    state.profile.blacksmith.purchasedPermitIds.includes(requirement.permitId) ||
    state.profile.blacksmith.unlockedServiceIds.includes(requirement.serviceId)
  ) {
    return undefined;
  }

  return 'missing_permit_or_service';
}

function applyBlacksmithEnhancement(
  profile: LongLoopProfile,
  enhancementId: string
): { readonly profile: LongLoopProfile; readonly consumedPermitId?: string } {
  const requirement = blacksmithEnhancementRequirements[enhancementId];
  const nextProfile = cloneProfile(profile);

  if (!requirement || nextProfile.blacksmith.unlockedServiceIds.includes(requirement.serviceId)) {
    return { profile: nextProfile };
  }

  if (nextProfile.blacksmith.purchasedPermitIds.includes(requirement.permitId)) {
    nextProfile.blacksmith.purchasedPermitIds = nextProfile.blacksmith.purchasedPermitIds.filter((id) => id !== requirement.permitId);
    return {
      profile: nextProfile,
      consumedPermitId: requirement.permitId
    };
  }

  return { profile: nextProfile };
}

function appendPhaseEvent(
  events: readonly LongLoopPhaseEvent[],
  ...nextEvents: readonly LongLoopPhaseEvent[]
): readonly LongLoopPhaseEvent[] {
  return [...events, ...nextEvents];
}

function p0RunStartedEvent(districtId: string): string {
  return districtId === CANONICAL_DISTRICT_IDS.d1 ? 'p0.d1.started' : 'run.started';
}

function p0RunSettledEvent(districtId: string): string {
  return districtId === CANONICAL_DISTRICT_IDS.d1 ? 'p0.d1.settled' : 'run.settled';
}

function mapNodeIdForDistrict(districtId: string): string {
  return districtId === CANONICAL_DISTRICT_IDS.d1 ? CANONICAL_MAP_NODE_IDS.d1 : `map.${districtId.toLowerCase()}`;
}

function isActiveMatchingRun(currentRun: RunLoopRunState | undefined, event: Extract<LongLoopEvent, { type: 'settle_run' }>): boolean {
  return Boolean(
    currentRun &&
      currentRun.status === 'active' &&
      currentRun.id === event.runId &&
      currentRun.districtId === event.districtId
  );
}
