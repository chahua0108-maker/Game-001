import type { ArcanaConfig } from '../schema/definitions';

export const arcana = [
  {
    id: 'arcana.blood_pact',
    name: 'Blood Pact',
    suit: 'blood',
    unlockRuleIds: ['unlock.arcana.blood_pact']
  },
  {
    id: 'arcana.iron_oath',
    name: 'Iron Oath',
    suit: 'iron'
  }
] as const satisfies readonly ArcanaConfig[];
