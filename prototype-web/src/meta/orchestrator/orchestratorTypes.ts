import type { AchievementId, CardId, FeatureGateId, ShopItemId, StarterKitId } from '../../config/schema/ids';
import type { DistrictId, LongLoopProfile, ProfileMetaSnapshot } from '../profile/profileTypes';
import type { ShopPurchaseEffect, ShopCurrencyId } from '../systems/shop/shopFacade';

export type LongLoopPhase = 'hub_review' | 'running' | 'settlement_review';
export type RunOutcome = 'district_cleared' | 'failed';
export type RunStatus = 'active' | 'settled';

export interface RunStartInput {
  readonly districtId: DistrictId;
  readonly starterKitId: StarterKitId;
}

export interface RunLoopRunState extends RunStartInput {
  readonly id: string;
  readonly status: RunStatus;
  readonly starterPayload: RunStartStarterPayload;
  readonly runLocalEnhancementIds: readonly string[];
}

export interface RunStartStarterPayload {
  readonly selectedStarterKitId: StarterKitId;
  readonly availableStarterKitIds: readonly StarterKitId[];
  readonly deckModifierId: string;
  readonly grantedCardIds: readonly CardId[];
  readonly starterCardIds: readonly CardId[];
  readonly deckMutationBoundary: 'adapter_payload_only';
}

export interface NextRunSnapshot {
  readonly districtId: DistrictId;
  readonly selectedStarterKitId: StarterKitId;
  readonly starterKitIds: readonly StarterKitId[];
  readonly starterPayload: RunStartStarterPayload;
  readonly purchasedShopItemIds: readonly ShopItemId[];
  readonly featureGateIds: readonly FeatureGateId[];
  readonly runLocalEnhancementIds: readonly string[];
}

export interface SettlementInput {
  readonly runId: string;
  readonly outcome: RunOutcome;
  readonly districtId: DistrictId;
}

export interface SettlementSummary {
  readonly runId: string;
  readonly outcome: RunOutcome;
  readonly districtId: DistrictId;
  readonly achievementIds: readonly AchievementId[];
  readonly uiStateIds: readonly string[];
  readonly unlockedFeatureGateIds: readonly FeatureGateId[];
  readonly visibleShopItemIds: readonly ShopItemId[];
  readonly softCurrencyDelta: number;
  readonly metaGemDelta: number;
}

export interface ShopStateSnapshot {
  readonly visibleItemIds: readonly ShopItemId[];
  readonly purchasedItemIds: readonly ShopItemId[];
}

export interface LongLoopPhaseEvent {
  readonly type: string;
  readonly runId?: string;
  readonly itemId?: ShopItemId;
}

export type ShopPurchaseFailureReason =
  | 'not_settlement_review'
  | 'unknown_item'
  | 'already_purchased'
  | 'not_visible'
  | 'insufficient_currency';

export type ShopPurchaseResult =
  | {
      readonly ok: true;
      readonly itemId: ShopItemId;
      readonly achievementIds: readonly AchievementId[];
      readonly purchase: {
        readonly itemId: ShopItemId;
        readonly currencyId: ShopCurrencyId;
        readonly price: number;
      };
      readonly effects: readonly ShopPurchaseEffect[];
    }
  | {
      readonly ok: false;
      readonly itemId: ShopItemId;
      readonly reason: ShopPurchaseFailureReason;
    };

export type BlacksmithEnhancementFailureReason = 'invalid_run' | 'unknown_enhancement' | 'missing_permit_or_service';

export type BlacksmithEnhancementResult =
  | {
      readonly ok: true;
      readonly enhancementId: string;
      readonly consumedPermitId?: ShopItemId;
    }
  | {
      readonly ok: false;
      readonly enhancementId: string;
      readonly reason: BlacksmithEnhancementFailureReason;
    };

export interface LongLoopState {
  readonly profile: LongLoopProfile;
  readonly phase: LongLoopPhase;
  readonly currentRun?: RunLoopRunState;
  readonly settlementSummary?: SettlementSummary;
  readonly nextRunPreview: NextRunSnapshot;
  readonly phaseEvents: readonly LongLoopPhaseEvent[];
  readonly settlementAppliedRunIds: readonly string[];
  readonly runSequence: number;
  readonly lastShopPurchase?: Extract<ShopPurchaseResult, { readonly ok: true }>;
}

export type LongLoopEvent =
  | ({ readonly type: 'start_run' } & RunStartInput)
  | ({ readonly type: 'settle_run' } & SettlementInput)
  | { readonly type: 'purchase_shop_item'; readonly itemId: ShopItemId }
  | { readonly type: 'apply_run_local_blacksmith_enhancement'; readonly runId: string; readonly enhancementId: string }
  | { readonly type: 'reload_profile'; readonly profile: LongLoopProfile };

export interface LongLoopOrchestrator {
  startRun(input: RunStartInput): RunLoopRunState;
  settleRun(input: SettlementInput): SettlementSummary;
  getShopState(): ShopStateSnapshot;
  previewNextRun(input?: { readonly districtId?: DistrictId }): NextRunSnapshot;
  purchaseShopItem(input: { readonly itemId: ShopItemId }): ShopPurchaseResult;
  applyRunLocalBlacksmithEnhancement(input: { readonly runId: string; readonly enhancementId: string }): BlacksmithEnhancementResult;
  getProfileMeta(): ProfileMetaSnapshot;
  getCurrentRunState(): RunLoopRunState | undefined;
  getPhaseEvents(): readonly LongLoopPhaseEvent[];
}
