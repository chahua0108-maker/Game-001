import type { PermanentUpgradeConfig } from '../schema/definitions';

export const permanentUpgrades = [
  {
    id: 'upgrade.max_health',
    name: 'Max Health',
    maxRank: 5,
    gemCost: 20,
    unlockRuleIds: ['unlock.permanentUpgrade.max_health']
  },
  {
    id: 'upgrade.starting_gold',
    name: 'Starting Gold',
    maxRank: 3,
    gemCost: 15
  }
] as const satisfies readonly PermanentUpgradeConfig[];
