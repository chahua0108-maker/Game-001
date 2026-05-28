import {
  CURRENT_PROFILE_VERSION,
  type CreateProfileOptions,
  type LongLoopProfile,
  type ProfilePermanentUpgradeBoundary
} from './profileTypes';

export const DEFAULT_PROFILE_ID = 'default';

export const DEFAULT_STAT_UPGRADE_BOUNDARY: ProfilePermanentUpgradeBoundary = {
  attack: 'not_persisted',
  hp: 'not_persisted',
  maxMp: 'not_persisted'
};

export function createDefaultProfile(options: CreateProfileOptions = {}): LongLoopProfile {
  return {
    version: CURRENT_PROFILE_VERSION,
    profileId: options.profileId ?? DEFAULT_PROFILE_ID,
    wallet: {
      softCurrency: 0,
      metaGems: 0
    },
    map: {
      unlockedNodeIds: ['map.start'],
      completedNodeIds: [],
      clearedDistrictIds: []
    },
    achievements: {
      unlockedIds: []
    },
    shop: {
      purchasedItemIds: []
    },
    starter: {
      selectedStarterKitId: 'default_chain',
      unlockedStarterKitIds: ['default_chain'],
      selectedCrawlerId: 'crawler.blood_runner',
      unlockedCrawlerIds: ['crawler.blood_runner']
    },
    blacksmith: {
      purchasedPermitIds: [],
      unlockedServiceIds: [],
      runLocalServiceBoundary: 'card_level_socket_reroll_not_persisted'
    },
    permanentUpgrades: {
      upgradeRanks: {},
      statUpgradeBoundary: { ...DEFAULT_STAT_UPGRADE_BOUNDARY }
    },
    collection: {
      seenIds: [],
      seenCategoryIds: []
    },
    relicArcanaGem: {
      unlockedRelicIds: [],
      unlockedArcanaIds: [],
      ownedGemIds: [],
      gemInventory: {},
      socketBoundary: 'run_local_not_persisted'
    },
    featureGates: {
      unlockedIds: ['feature.map_branching', 'feature.shop_inventory']
    },
    runLocalPreview: {
      cardEnhancements: [],
      gemSocketBoundary: 'not_persisted',
      rerollResultBoundary: 'not_persisted'
    }
  };
}
