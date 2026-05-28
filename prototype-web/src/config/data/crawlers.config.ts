import type { CrawlerConfig } from '../schema/definitions';
import { CANONICAL_STARTER_KIT_IDS } from '../schema/ids';

export const crawlers = [
  {
    id: 'crawler.blood_runner',
    name: 'Blood Runner',
    starterKitId: CANONICAL_STARTER_KIT_IDS.defaultChain
  },
  {
    id: 'crawler.iron_monk',
    name: 'Iron Monk',
    starterKitId: CANONICAL_STARTER_KIT_IDS.stableChain,
    unlockRuleIds: ['unlock.crawler.iron_monk']
  }
] as const satisfies readonly CrawlerConfig[];
