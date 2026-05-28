import type { StarterKitConfig } from '../schema/definitions';

export const starterKits = [
  {
    id: 'starter.blood_runner',
    name: 'Blood Runner Kit',
    crawlerId: 'crawler.blood_runner',
    shopItemIds: ['shop.blood_vial']
  },
  {
    id: 'starter.iron_monk',
    name: 'Iron Monk Kit',
    crawlerId: 'crawler.iron_monk',
    shopItemIds: ['shop.iron_token']
  }
] as const satisfies readonly StarterKitConfig[];
