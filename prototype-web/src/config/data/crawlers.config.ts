import type { CrawlerConfig } from '../schema/definitions';

export const crawlers = [
  {
    id: 'crawler.blood_runner',
    name: 'Blood Runner',
    starterKitId: 'default_chain'
  },
  {
    id: 'crawler.iron_monk',
    name: 'Iron Monk',
    starterKitId: 'stable_chain',
    unlockRuleIds: ['unlock.crawler.iron_monk']
  }
] as const satisfies readonly CrawlerConfig[];
