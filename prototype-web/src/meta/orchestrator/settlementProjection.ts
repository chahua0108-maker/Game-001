import type { LongLoopProfile } from '../profile/profileTypes';
import type { SettlementInput, SettlementSummary } from './orchestratorTypes';

export function projectSettlement(profile: LongLoopProfile, input: SettlementInput): SettlementSummary {
  if (input.outcome === 'failed') {
    return {
      runId: input.runId,
      outcome: input.outcome,
      districtId: input.districtId,
      achievementIds: [],
      uiStateIds: ['settlement'],
      unlockedFeatureGateIds: [],
      visibleShopItemIds: visibleShopItemIds(profile.achievements.unlockedIds),
      softCurrencyDelta: 0,
      metaGemDelta: 0
    };
  }

  const achievementIds = input.districtId === 'D1'
    ? ['first_run_completed', 'clear_d1', 'chain_certified']
    : ['first_run_completed'];

  return {
    runId: input.runId,
    outcome: input.outcome,
    districtId: input.districtId,
    achievementIds,
    uiStateIds: ['settlement', 'unlock_toast', 'blacksmith_available', 'shop_inventory'],
    unlockedFeatureGateIds: ['feature.blacksmith'],
    visibleShopItemIds: visibleShopItemIds([...profile.achievements.unlockedIds, ...achievementIds]),
    softCurrencyDelta: 100,
    metaGemDelta: 1
  };
}

export function visibleShopItemIds(achievementIds: readonly string[]): readonly string[] {
  const achievements = new Set(achievementIds);
  const visibleIds = ['blacksmith_raise_level_permit', 'blacksmith_red_socket_permit'];

  if (achievements.has('chain_certified')) {
    visibleIds.push('starter_stable_chain');
  }

  if (achievements.has('first_purchase')) {
    visibleIds.push('blacksmith_reroll_permit');
  }

  return visibleIds;
}
