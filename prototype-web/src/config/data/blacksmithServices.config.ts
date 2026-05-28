import type { BlacksmithServiceConfig } from '../schema/definitions';

export const blacksmithServices = [
  {
    id: 'blacksmith.raise_level',
    name: 'Raise Level',
    serviceType: 'upgrade',
    price: 60,
    unlockRuleIds: ['unlock.blacksmith.raise_level']
  },
  {
    id: 'blacksmith.red_socket',
    name: 'Red Socket',
    serviceType: 'forge',
    price: 90,
    unlockRuleIds: ['unlock.blacksmith.red_socket']
  },
  {
    id: 'blacksmith.reroll',
    name: 'Reroll',
    serviceType: 'reroll',
    price: 120,
    unlockRuleIds: ['unlock.blacksmith.reroll']
  }
] as const satisfies readonly BlacksmithServiceConfig[];
