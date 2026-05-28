import type { StarterKitConfig } from '../schema/definitions';

export const starterKits = [
  {
    id: 'default_chain',
    name: 'Default Chain',
    crawlerId: 'crawler.blood_runner',
    shopItemIds: ['blacksmith_raise_level_permit']
  },
  {
    id: 'stable_chain',
    name: 'Stable Chain',
    crawlerId: 'crawler.iron_monk',
    shopItemIds: ['starter_stable_chain', 'blacksmith_reroll_permit']
  }
] as const satisfies readonly StarterKitConfig[];
