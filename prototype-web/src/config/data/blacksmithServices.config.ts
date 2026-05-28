import type { BlacksmithServiceConfig } from '../schema/definitions';

export const blacksmithServices = [
  {
    id: 'blacksmith.sharpen',
    name: 'Sharpen',
    serviceType: 'upgrade',
    price: 60,
    unlockRuleIds: ['unlock.blacksmith.sharpen']
  },
  {
    id: 'blacksmith.reforge',
    name: 'Reforge',
    serviceType: 'reroll',
    price: 90,
    unlockRuleIds: ['unlock.blacksmith.sharpen']
  }
] as const satisfies readonly BlacksmithServiceConfig[];
