import { createDefaultProfile, DEFAULT_PROFILE_ID, DEFAULT_STAT_UPGRADE_BOUNDARY } from './createProfile';
import { CURRENT_PROFILE_VERSION, type LongLoopProfile } from './profileTypes';

type UnknownRecord = Record<string, unknown>;

const RAW_STAT_UPGRADE_TOKEN_DENYLIST = new Set(['attack', 'atk', 'hp', 'health']);
const RAW_STAT_UPGRADE_NORMALIZED_DENYLIST = new Set([
  'attack',
  'atk',
  'hp',
  'health',
  'maxhp',
  'maxhealth',
  'maxmp',
  'mp',
  'mana',
  'maxmana'
]);

export function migrateProfile(snapshot: unknown, profileId = DEFAULT_PROFILE_ID): LongLoopProfile {
  const source = isRecord(snapshot) ? snapshot : {};
  const profile = createDefaultProfile({ profileId: stringValue(source.profileId, profileId) });

  profile.wallet.softCurrency = numberValue(recordValue(source.wallet)?.softCurrency, profile.wallet.softCurrency);
  profile.wallet.metaGems = numberValue(recordValue(source.wallet)?.metaGems, profile.wallet.metaGems);

  const map = recordValue(source.map);
  profile.map.unlockedNodeIds = uniqueStrings(recordValue(map)?.unlockedNodeIds, profile.map.unlockedNodeIds, {
    preserveFallbackWhenEmpty: true
  });
  profile.map.completedNodeIds = uniqueStrings(recordValue(map)?.completedNodeIds, profile.map.completedNodeIds);
  profile.map.clearedDistrictIds = uniqueStrings(recordValue(map)?.clearedDistrictIds, profile.map.clearedDistrictIds);

  profile.achievements.unlockedIds = uniqueStrings(
    recordValue(source.achievements)?.unlockedIds,
    profile.achievements.unlockedIds
  );
  profile.shop.purchasedItemIds = uniqueStrings(recordValue(source.shop)?.purchasedItemIds, profile.shop.purchasedItemIds);

  const starter = recordValue(source.starter);
  profile.starter.selectedStarterKitId = stringValue(starter?.selectedStarterKitId, profile.starter.selectedStarterKitId);
  profile.starter.unlockedStarterKitIds = uniqueStrings(
    starter?.unlockedStarterKitIds,
    profile.starter.unlockedStarterKitIds
  );
  profile.starter.selectedCrawlerId = stringValue(starter?.selectedCrawlerId, profile.starter.selectedCrawlerId);
  profile.starter.unlockedCrawlerIds = uniqueStrings(starter?.unlockedCrawlerIds, profile.starter.unlockedCrawlerIds);

  const blacksmith = recordValue(source.blacksmith);
  profile.blacksmith.purchasedPermitIds = uniqueStrings(
    blacksmith?.purchasedPermitIds,
    profile.blacksmith.purchasedPermitIds
  );
  profile.blacksmith.unlockedServiceIds = uniqueStrings(
    blacksmith?.unlockedServiceIds,
    profile.blacksmith.unlockedServiceIds
  );

  const permanentUpgrades = recordValue(source.permanentUpgrades);
  profile.permanentUpgrades.upgradeRanks = upgradeRankRecord(permanentUpgrades?.upgradeRanks);
  profile.permanentUpgrades.statUpgradeBoundary = { ...DEFAULT_STAT_UPGRADE_BOUNDARY };

  const collection = recordValue(source.collection);
  profile.collection.seenIds = uniqueStrings(collection?.seenIds, profile.collection.seenIds);
  profile.collection.seenCategoryIds = uniqueStrings(collection?.seenCategoryIds, profile.collection.seenCategoryIds);

  const relicArcanaGem = recordValue(source.relicArcanaGem);
  profile.relicArcanaGem.unlockedRelicIds = uniqueStrings(
    relicArcanaGem?.unlockedRelicIds,
    profile.relicArcanaGem.unlockedRelicIds
  );
  profile.relicArcanaGem.unlockedArcanaIds = uniqueStrings(
    relicArcanaGem?.unlockedArcanaIds,
    profile.relicArcanaGem.unlockedArcanaIds
  );
  profile.relicArcanaGem.ownedGemIds = uniqueStrings(relicArcanaGem?.ownedGemIds, profile.relicArcanaGem.ownedGemIds);
  profile.relicArcanaGem.gemInventory = numberRecord(relicArcanaGem?.gemInventory);

  profile.featureGates.unlockedIds = uniqueStrings(
    recordValue(source.featureGates)?.unlockedIds,
    profile.featureGates.unlockedIds,
    { preserveFallbackWhenEmpty: true }
  );

  profile.runLocalPreview.cardEnhancements = [];

  profile.version = CURRENT_PROFILE_VERSION;
  return profile;
}

export function sanitizeProfileForSave(profile: LongLoopProfile): LongLoopProfile {
  return {
    ...profile,
    wallet: { ...profile.wallet },
    map: {
      unlockedNodeIds: [...profile.map.unlockedNodeIds],
      completedNodeIds: [...profile.map.completedNodeIds],
      clearedDistrictIds: [...profile.map.clearedDistrictIds]
    },
    achievements: {
      unlockedIds: [...profile.achievements.unlockedIds]
    },
    shop: {
      purchasedItemIds: [...profile.shop.purchasedItemIds]
    },
    starter: {
      selectedStarterKitId: profile.starter.selectedStarterKitId,
      unlockedStarterKitIds: [...profile.starter.unlockedStarterKitIds],
      selectedCrawlerId: profile.starter.selectedCrawlerId,
      unlockedCrawlerIds: [...profile.starter.unlockedCrawlerIds]
    },
    blacksmith: {
      purchasedPermitIds: [...profile.blacksmith.purchasedPermitIds],
      unlockedServiceIds: [...profile.blacksmith.unlockedServiceIds],
      runLocalServiceBoundary: 'card_level_socket_reroll_not_persisted'
    },
    permanentUpgrades: {
      upgradeRanks: upgradeRankRecord(profile.permanentUpgrades.upgradeRanks),
      statUpgradeBoundary: { ...DEFAULT_STAT_UPGRADE_BOUNDARY }
    },
    collection: {
      seenIds: [...profile.collection.seenIds],
      seenCategoryIds: [...profile.collection.seenCategoryIds]
    },
    relicArcanaGem: {
      unlockedRelicIds: [...profile.relicArcanaGem.unlockedRelicIds],
      unlockedArcanaIds: [...profile.relicArcanaGem.unlockedArcanaIds],
      ownedGemIds: [...profile.relicArcanaGem.ownedGemIds],
      gemInventory: { ...profile.relicArcanaGem.gemInventory },
      socketBoundary: 'run_local_not_persisted'
    },
    featureGates: {
      unlockedIds: [...profile.featureGates.unlockedIds]
    },
    runLocalPreview: {
      cardEnhancements: [],
      gemSocketBoundary: 'not_persisted',
      rerollResultBoundary: 'not_persisted'
    }
  };
}

function uniqueStrings(
  value: unknown,
  fallback: string[],
  options: { preserveFallbackWhenEmpty?: boolean } = {}
): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const strings = Array.from(new Set(value.filter((entry): entry is string => typeof entry === 'string')));
  return strings.length === 0 && options.preserveFallbackWhenEmpty ? [...fallback] : strings;
}

function numberRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number')
  );
}

function upgradeRankRecord(value: unknown): Record<string, number> {
  return Object.fromEntries(Object.entries(numberRecord(value)).filter(([id]) => !isRawStatUpgradeId(id)));
}

function isRawStatUpgradeId(id: string): boolean {
  const normalized = id.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (RAW_STAT_UPGRADE_NORMALIZED_DENYLIST.has(normalized)) {
    return true;
  }

  const tokens = id
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  if (tokens.some((token) => RAW_STAT_UPGRADE_TOKEN_DENYLIST.has(token))) {
    return true;
  }

  return (
    (tokens.includes('max') && (tokens.includes('mp') || tokens.includes('mana') || tokens.includes('hp'))) ||
    normalized.includes('maxhealth') ||
    normalized.includes('maxhp') ||
    normalized.includes('maxmp')
  );
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function recordValue(value: unknown): UnknownRecord | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
