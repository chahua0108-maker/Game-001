import { describe, expect, it } from 'vitest';

import { createDefaultProfile } from '../../meta/profile/createProfile';
import { migrateProfile } from '../../meta/profile/profileMigrations';
import { loadProfile, PROFILE_STORAGE_KEY, saveProfile } from '../../meta/profile/profileStorage';
import {
  selectFeatureGateIds,
  selectMapProgress,
  selectProfileMeta,
  selectRunLocalPreview,
  selectSelectedStarterKitId
} from '../../meta/profile/profileSelectors';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class ThrowingStorage extends MemoryStorage {
  constructor(private readonly failureMode: 'getItem' | 'setItem') {
    super();
  }

  override getItem(key: string): string | null {
    if (this.failureMode === 'getItem') {
      throw new Error('getItem unavailable');
    }

    return super.getItem(key);
  }

  override setItem(key: string, value: string): void {
    if (this.failureMode === 'setItem') {
      throw new Error('setItem unavailable');
    }

    super.setItem(key, value);
  }
}

describe('long-loop profile persistence', () => {
  it('keeps meta progression across reload while dropping run-local card enhancements', () => {
    const storage = new MemoryStorage();
    const profile = createDefaultProfile({ profileId: 'profile-persistence-test' });

    profile.wallet.softCurrency = 160;
    profile.wallet.metaGems = 7;
    profile.achievements.unlockedIds.push('clear_d1', 'first_purchase');
    profile.shop.purchasedItemIds.push('starter_stable_chain');
    profile.blacksmith.purchasedPermitIds.push('blacksmith_raise_level_permit');
    profile.starter.selectedStarterKitId = 'stable_chain';
    profile.starter.unlockedStarterKitIds.push('stable_chain');
    profile.collection.seenIds.push('starter_stable_chain', 'relic.ash_compass');
    profile.featureGates.unlockedIds.push('feature.blacksmith');
    profile.map.completedNodeIds.push('map.start');
    profile.map.clearedDistrictIds.push('D1');
    profile.relicArcanaGem.unlockedRelicIds.push('relic.ash_compass');
    profile.relicArcanaGem.unlockedArcanaIds.push('arcana.blood_pact');
    profile.relicArcanaGem.ownedGemIds.push('gem.blood_ruby');
    profile.runLocalPreview.cardEnhancements.push({ cardId: 'slash', level: 2 });

    saveProfile(profile, { storage });
    const rawSavedProfile = JSON.parse(storage.getItem(PROFILE_STORAGE_KEY) ?? '{}');
    const reloadedProfile = loadProfile({ storage, profileId: profile.profileId });

    expect(rawSavedProfile.runLocalPreview.cardEnhancements).toEqual([]);
    expect(selectRunLocalPreview(reloadedProfile).cardEnhancements).toEqual([]);
    expect(selectProfileMeta(reloadedProfile)).toEqual({
      achievementIds: ['clear_d1', 'first_purchase'],
      purchasedShopItemIds: ['starter_stable_chain'],
      purchasedBlacksmithPermitIds: ['blacksmith_raise_level_permit'],
      selectedStarterKitId: 'stable_chain',
      selectedCrawlerId: 'crawler.blood_runner',
      featureGateIds: ['feature.map_branching', 'feature.shop_inventory', 'feature.blacksmith'],
      seenCollectionIds: ['starter_stable_chain', 'relic.ash_compass'],
      completedMapNodeIds: ['map.start'],
      clearedDistrictIds: ['D1']
    });
    expect(reloadedProfile.wallet.softCurrency).toBe(160);
    expect(reloadedProfile.wallet.metaGems).toBe(7);
    expect(reloadedProfile.relicArcanaGem.unlockedRelicIds).toEqual(['relic.ash_compass']);
    expect(reloadedProfile.relicArcanaGem.unlockedArcanaIds).toEqual(['arcana.blood_pact']);
    expect(reloadedProfile.relicArcanaGem.ownedGemIds).toEqual(['gem.blood_ruby']);
  });

  it('migrates an empty object into a valid current profile with explicit target-system boundaries', () => {
    const migrated = migrateProfile({});

    expect(migrated.version).toBe(1);
    expect(migrated.wallet.softCurrency).toBe(0);
    expect(migrated.map.unlockedNodeIds).toContain('map.start');
    expect(migrated.achievements.unlockedIds).toEqual([]);
    expect(migrated.shop.purchasedItemIds).toEqual([]);
    expect(migrated.starter.selectedStarterKitId).toBe('default_chain');
    expect(migrated.starter.selectedCrawlerId).toBe('crawler.blood_runner');
    expect(migrated.blacksmith.runLocalServiceBoundary).toBe('card_level_socket_reroll_not_persisted');
    expect(migrated.permanentUpgrades.statUpgradeBoundary).toEqual({
      attack: 'not_persisted',
      hp: 'not_persisted',
      maxMp: 'not_persisted'
    });
    expect(migrated.collection.seenIds).toEqual([]);
    expect(migrated.relicArcanaGem.socketBoundary).toBe('run_local_not_persisted');
    expect(migrated.featureGates.unlockedIds).toEqual(['feature.map_branching', 'feature.shop_inventory']);
    expect(migrated.runLocalPreview.cardEnhancements).toEqual([]);
  });

  it('provides stable selector snapshots for orchestrator and UI callers', () => {
    const profile = createDefaultProfile();

    profile.featureGates.unlockedIds.push('feature.blacksmith');
    profile.map.completedNodeIds.push('map.start');
    profile.map.clearedDistrictIds.push('D1');
    profile.runLocalPreview.cardEnhancements.push({ cardId: 'slash', level: 2 });

    expect(selectFeatureGateIds(profile)).toEqual(['feature.map_branching', 'feature.shop_inventory', 'feature.blacksmith']);
    expect(selectSelectedStarterKitId(profile)).toBe('default_chain');
    expect(selectMapProgress(profile)).toEqual({
      unlockedNodeIds: ['map.start'],
      completedNodeIds: ['map.start'],
      clearedDistrictIds: ['D1']
    });
    expect(selectRunLocalPreview(profile).cardEnhancements).toEqual([{ cardId: 'slash', level: 2 }]);
  });

  it('drops legacy run-local card enhancements when loading raw stored JSON', () => {
    const storage = new MemoryStorage();

    storage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({
        runLocalPreview: {
          cardEnhancements: [{ cardId: 'slash', level: 2 }]
        }
      })
    );

    expect(selectRunLocalPreview(loadProfile({ storage })).cardEnhancements).toEqual([]);
  });

  it('strips raw permanent stat upgrade ids during load and save', () => {
    const storage = new MemoryStorage();

    storage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({
        permanentUpgrades: {
          upgradeRanks: {
            attack: 4,
            hp: 3,
            max_mp: 2,
            'max mp': 2,
            maxmp: 2,
            'upgrade.max_health': 1,
            unlock_blacksmith_reroll_service: 1
          }
        }
      })
    );

    const loadedProfile = loadProfile({ storage });

    expect(loadedProfile.permanentUpgrades.upgradeRanks).toEqual({
      unlock_blacksmith_reroll_service: 1
    });

    loadedProfile.permanentUpgrades.upgradeRanks.attack = 9;
    loadedProfile.permanentUpgrades.upgradeRanks.unlock_stable_chain_choices = 1;
    saveProfile(loadedProfile, { storage });

    const savedProfile = JSON.parse(storage.getItem(PROFILE_STORAGE_KEY) ?? '{}');
    expect(savedProfile.permanentUpgrades.upgradeRanks).toEqual({
      unlock_blacksmith_reroll_service: 1,
      unlock_stable_chain_choices: 1
    });
  });

  it('falls back or no-ops when storage access throws', () => {
    expect(loadProfile({ storage: new ThrowingStorage('getItem') }).profileId).toBe('default');

    const profile = createDefaultProfile();

    expect(() => saveProfile(profile, { storage: new ThrowingStorage('setItem') })).not.toThrow();
  });

  it('preserves default-bearing map and feature gates when saved arrays are malformed', () => {
    const storage = new MemoryStorage();

    storage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({
        map: {
          unlockedNodeIds: [null, 7, {}]
        },
        featureGates: {
          unlockedIds: [false, 3, []]
        }
      })
    );

    const loadedProfile = loadProfile({ storage });

    expect(loadedProfile.map.unlockedNodeIds).toEqual(['map.start']);
    expect(loadedProfile.featureGates.unlockedIds).toEqual(['feature.map_branching', 'feature.shop_inventory']);
  });

  it('preserves default selected starter and crawler unlocks when saved arrays are malformed or empty', () => {
    const storage = new MemoryStorage();

    storage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({
        starter: {
          selectedStarterKitId: 'default_chain',
          unlockedStarterKitIds: [],
          selectedCrawlerId: 'crawler.blood_runner',
          unlockedCrawlerIds: [null, 9, {}]
        }
      })
    );

    const loadedProfile = loadProfile({ storage });

    expect(loadedProfile.starter.selectedStarterKitId).toBe('default_chain');
    expect(loadedProfile.starter.unlockedStarterKitIds).toContain('default_chain');
    expect(loadedProfile.starter.selectedCrawlerId).toBe('crawler.blood_runner');
    expect(loadedProfile.starter.unlockedCrawlerIds).toContain('crawler.blood_runner');
  });
});
