import type { UnlockBuildingEntryConfig } from '../schema/definitions';

export const unlockBuildingEntries = [
  {
    id: 'building.blacksmith',
    name: 'Blacksmith',
    targetSystem: 'blacksmithServices',
    targetId: 'blacksmith.raise_level',
    unlockRuleId: 'unlock.building.blacksmith'
  },
  {
    id: 'building.collection',
    name: 'Collection',
    targetSystem: 'collectionCategories',
    targetId: 'category.relics',
    unlockRuleId: 'unlock.relic.ash_compass'
  }
] as const satisfies readonly UnlockBuildingEntryConfig[];
