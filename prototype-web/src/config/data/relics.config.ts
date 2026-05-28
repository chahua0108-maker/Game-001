import type { RelicConfig } from '../schema/definitions';

export const relics = [
  {
    id: 'relic.ash_compass',
    name: 'Ash Compass',
    rarity: 'uncommon',
    unlockRuleIds: ['unlock.relic.ash_compass']
  },
  {
    id: 'relic.blood_coin',
    name: 'Blood Coin',
    rarity: 'common'
  }
] as const satisfies readonly RelicConfig[];
