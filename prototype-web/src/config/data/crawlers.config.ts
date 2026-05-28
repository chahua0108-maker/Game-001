import type { CrawlerConfig } from '../schema/definitions';

export const crawlers = [
  {
    id: 'crawler.blood_runner',
    name: 'Blood Runner',
    starterKitId: 'starter.blood_runner'
  },
  {
    id: 'crawler.iron_monk',
    name: 'Iron Monk',
    starterKitId: 'starter.iron_monk',
    unlockRuleIds: ['unlock.crawler.iron_monk']
  }
] as const satisfies readonly CrawlerConfig[];
