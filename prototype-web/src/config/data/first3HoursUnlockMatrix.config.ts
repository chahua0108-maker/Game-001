import type { First3HoursUnlockMatrixEntry } from '../schema/definitions';
import { CANONICAL_FEATURE_GATE_IDS, CANONICAL_MAP_NODE_IDS } from '../schema/ids';

export const first3HoursUnlockMatrix = [
  {
    trigger: 'run_completed',
    mapNode: CANONICAL_MAP_NODE_IDS.start,
    featureGate: CANONICAL_FEATURE_GATE_IDS.hubShop,
    achievement: 'first_run_completed',
    uiState: 'unlock_toast',
    nextGoal: 'buy_first_permit',
    visibility: 'unlocked',
    unlockRuleIds: ['unlock.map.elite_route', 'unlock.hub.blacksmith', 'unlock.shop.starter_stable_chain']
  },
  {
    trigger: 'district_clear',
    mapNode: CANONICAL_MAP_NODE_IDS.eliteFork,
    featureGate: CANONICAL_FEATURE_GATE_IDS.hubBlacksmith,
    achievement: 'clear_d1',
    uiState: 'blacksmith_available',
    nextGoal: 'certify_stable_chain',
    visibility: 'condition_visible',
    unlockRuleIds: ['unlock.blacksmith.raise_level', 'unlock.blacksmith.red_socket', 'unlock.crawler.iron_monk']
  },
  {
    trigger: 'chain_certified',
    mapNode: 'unchanged',
    featureGate: CANONICAL_FEATURE_GATE_IDS.blacksmithReroll,
    achievement: 'chain_certified',
    uiState: 'reroll_hint',
    nextGoal: 'make_first_purchase',
    visibility: 'hinted',
    unlockRuleIds: ['unlock.blacksmith.reroll_gate', 'unlock.arcana.blood_pact', 'unlock.relic.ash_compass']
  }
] as const satisfies readonly First3HoursUnlockMatrixEntry[];
