import type { First3HoursUnlockMatrixEntry } from '../schema/definitions';

export const first3HoursUnlockMatrix = [
  {
    trigger: 'run_completed',
    mapNode: 'map.start',
    featureGate: 'feature.shop_inventory',
    achievement: 'first_run_completed',
    uiState: 'unlock_toast',
    nextGoal: 'buy_first_permit',
    visibility: 'unlocked',
    unlockRuleIds: ['unlock.map.elite_route', 'unlock.feature.blacksmith', 'unlock.shop.starter_stable_chain']
  },
  {
    trigger: 'district_clear',
    mapNode: 'map.elite_fork',
    featureGate: 'feature.blacksmith',
    achievement: 'clear_d1',
    uiState: 'blacksmith_available',
    nextGoal: 'certify_stable_chain',
    visibility: 'condition_visible',
    unlockRuleIds: ['unlock.blacksmith.raise_level', 'unlock.blacksmith.red_socket', 'unlock.crawler.iron_monk']
  },
  {
    trigger: 'chain_certified',
    mapNode: 'unchanged',
    featureGate: 'feature.blacksmith_reroll',
    achievement: 'chain_certified',
    uiState: 'reroll_hint',
    nextGoal: 'make_first_purchase',
    visibility: 'hinted',
    unlockRuleIds: ['unlock.feature.blacksmith_reroll', 'unlock.arcana.blood_pact', 'unlock.relic.ash_compass']
  }
] as const satisfies readonly First3HoursUnlockMatrixEntry[];
