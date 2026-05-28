import type { PermanentUpgradeConfig } from '../schema/definitions';

export const permanentUpgrades = [
  {
    id: 'unlock_blacksmith_reroll_service',
    name: 'Unlock Blacksmith Reroll Service',
    effectType: 'service_unlock',
    maxRank: 1,
    gemCost: 30,
    unlockRuleIds: ['unlock.permanentUpgrade.blacksmith_reroll']
  },
  {
    id: 'unlock_stable_chain_choices',
    name: 'Unlock Stable Chain Choices',
    effectType: 'choice_space',
    maxRank: 1,
    gemCost: 25,
    unlockRuleIds: ['unlock.shop.starter_stable_chain']
  }
] as const satisfies readonly PermanentUpgradeConfig[];
