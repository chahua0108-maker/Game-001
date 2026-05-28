import { longLoopConfig } from '../../../config/data/longLoopConfig';
import type { StarterKitConfig } from '../../../config/schema/definitions';
import { CANONICAL_STARTER_KIT_IDS, toCanonicalLongLoopId, type StarterKitId } from '../../../config/schema/ids';
import type { LongLoopProfile } from '../../profile/profileTypes';

export type StarterReadState = 'selected' | 'unlocked' | 'locked_preview';
export type StarterReadVisibility = 'available' | 'locked_preview';

export interface StarterRead {
  readonly id: StarterKitId;
  readonly name: string;
  readonly crawlerId: string;
  readonly shopItemIds: readonly string[];
  readonly state: StarterReadState;
  readonly visibility: StarterReadVisibility;
}

export function toCanonicalStarterKitId(starterKitId: StarterKitId): StarterKitId {
  return toCanonicalLongLoopId(starterKitId);
}

export function starterReads(profile: LongLoopProfile): StarterRead[] {
  const availableStarterIds = selectAvailableStarterKitIds(profile);
  const selectedStarterKitId = toCanonicalStarterKitId(profile.starter.selectedStarterKitId);

  return (longLoopConfig.starterKits as readonly StarterKitConfig[]).map((starter) => {
    const isAvailable = availableStarterIds.includes(starter.id);
    const isSelected = selectedStarterKitId === starter.id && isAvailable;

    return {
      id: starter.id,
      name: starter.name,
      crawlerId: starter.crawlerId,
      shopItemIds: [...starter.shopItemIds],
      state: isSelected ? 'selected' : isAvailable ? 'unlocked' : 'locked_preview',
      visibility: isAvailable ? 'available' : 'locked_preview'
    };
  });
}

export function selectAvailableStarterKitIds(profile: LongLoopProfile): StarterKitId[] {
  const starterIds = new Set<StarterKitId>();

  for (const starterId of profile.starter.unlockedStarterKitIds) {
    starterIds.add(toCanonicalStarterKitId(starterId));
  }

  for (const starter of longLoopConfig.starterKits as readonly StarterKitConfig[]) {
    if (starter.shopItemIds.some((shopItemId) => profile.shop.purchasedItemIds.includes(shopItemId))) {
      starterIds.add(starter.id);
    }
  }

  if (starterIds.size === 0) {
    starterIds.add(CANONICAL_STARTER_KIT_IDS.defaultChain);
  }

  return [...starterIds];
}
