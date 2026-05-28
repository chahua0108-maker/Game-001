import type { FeatureGateConfig } from '../schema/definitions';
import { CANONICAL_FEATURE_GATE_IDS } from '../schema/ids';

export const featureGates = [
  {
    id: CANONICAL_FEATURE_GATE_IDS.mapBranching,
    name: 'Map Branching',
    defaultState: 'available'
  },
  {
    id: CANONICAL_FEATURE_GATE_IDS.hubShop,
    name: 'Shop Inventory',
    defaultState: 'available'
  },
  {
    id: CANONICAL_FEATURE_GATE_IDS.hubBlacksmith,
    name: 'Blacksmith',
    defaultState: 'locked',
    unlockRuleIds: ['unlock.hub.blacksmith']
  },
  {
    id: CANONICAL_FEATURE_GATE_IDS.blacksmithReroll,
    name: 'Blacksmith Reroll',
    defaultState: 'locked',
    unlockRuleIds: ['unlock.blacksmith.reroll_gate']
  }
] as const satisfies readonly FeatureGateConfig[];
