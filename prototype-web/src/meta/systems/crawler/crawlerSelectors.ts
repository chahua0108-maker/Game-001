import { longLoopConfig } from '../../../config/data/longLoopConfig';
import type { CrawlerConfig } from '../../../config/schema/definitions';
import type { CrawlerId, StarterKitId } from '../../../config/schema/ids';
import type { LongLoopProfile } from '../../profile/profileTypes';
import { selectAvailableStarterKitIds } from '../starter/starterSelectors';

export type CrawlerReadState = 'selected' | 'unlocked' | 'locked_preview';
export type CrawlerReadVisibility = 'available' | 'locked_preview';

export interface CrawlerRead {
  readonly id: CrawlerId;
  readonly name: string;
  readonly starterKitId: StarterKitId;
  readonly state: CrawlerReadState;
  readonly visibility: CrawlerReadVisibility;
}

export function crawlerReads(profile: LongLoopProfile): CrawlerRead[] {
  const availableStarterKitIds = selectAvailableStarterKitIds(profile);
  const unlockedCrawlerIds = new Set(profile.starter.unlockedCrawlerIds);

  return (longLoopConfig.crawlers as readonly CrawlerConfig[]).map((crawler) => {
    const isAvailable = unlockedCrawlerIds.has(crawler.id) || availableStarterKitIds.includes(crawler.starterKitId);
    const isSelected = profile.starter.selectedCrawlerId === crawler.id && isAvailable;

    return {
      id: crawler.id,
      name: crawler.name,
      starterKitId: crawler.starterKitId,
      state: isSelected ? 'selected' : isAvailable ? 'unlocked' : 'locked_preview',
      visibility: isAvailable ? 'available' : 'locked_preview'
    };
  });
}
