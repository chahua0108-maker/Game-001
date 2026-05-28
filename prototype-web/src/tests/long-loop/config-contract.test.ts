import { describe, expect, it } from 'vitest';

import { longLoopConfig } from '../../config/data/longLoopConfig';
import { createLongLoopConfigQueries } from '../../config/query/longLoopQueries';
import type { LongLoopTableKey } from '../../config/schema/definitions';
import { validateLongLoopConfig } from '../../config/validation/validateLongLoopConfig';

const expectedTableKeys = [
  'achievements',
  'arcana',
  'blacksmithServices',
  'collectionCategories',
  'crawlers',
  'featureGates',
  'first3HoursUnlockMatrix',
  'gems',
  'mapNodes',
  'permanentUpgrades',
  'relics',
  'shopItems',
  'starterKits',
  'unlockBuildingEntries',
  'unlockRules'
] as const satisfies readonly LongLoopTableKey[];

describe('long-loop config contract', () => {
  it('keeps every target-state system backed by an independent config table', () => {
    const result = validateLongLoopConfig(longLoopConfig);

    expect(result.errors).toEqual([]);
    expect(Object.keys(result.tableCounts).sort()).toEqual(expectedTableKeys);

    for (const key of expectedTableKeys) {
      expect(result.tableCounts[key], key).toBeGreaterThan(0);
    }
  });

  it('rejects explanation text in first 3 hours matrix achievement cells', () => {
    const result = validateLongLoopConfig({
      ...longLoopConfig,
      first3HoursUnlockMatrix: [
        {
          ...longLoopConfig.first3HoursUnlockMatrix[0],
          achievement: 'completed first run'
        }
      ]
    });

    expect(result.errors).toContain(
      'first3HoursUnlockMatrix[0].achievement must be an achievement id, none, or unchanged'
    );
  });

  it('rejects invalid achievement ids in first 3 hours matrix achievement cells', () => {
    const result = validateLongLoopConfig({
      ...longLoopConfig,
      first3HoursUnlockMatrix: [
        {
          ...longLoopConfig.first3HoursUnlockMatrix[0],
          achievement: 'achievement.missing'
        }
      ]
    });

    expect(result.errors).toContain(
      'first3HoursUnlockMatrix[0].achievement must be an achievement id, none, or unchanged'
    );
  });

  it('rejects shop items that reference missing feature gates, achievements, or unlock rules', () => {
    const result = validateLongLoopConfig({
      ...longLoopConfig,
      shopItems: [
        {
          ...longLoopConfig.shopItems[0],
          requiresFeatureGateIds: ['feature.missing'],
          requiresAchievementIds: ['achievement.missing'],
          unlockRuleIds: ['unlock.missing']
        }
      ]
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        'shopItems[0].requiresFeatureGateIds[0] references missing feature gate feature.missing',
        'shopItems[0].requiresAchievementIds[0] references missing achievement achievement.missing',
        'shopItems[0].unlockRuleIds[0] references missing unlock rule unlock.missing'
      ])
    );
  });

  it('rejects a missing or empty independent config table', () => {
    const result = validateLongLoopConfig({
      ...longLoopConfig,
      relics: []
    });

    expect(result.errors).toContain('relics must have its own non-empty config table');
  });

  it('exposes read-only query services for every long-loop table', () => {
    const queries = createLongLoopConfigQueries(longLoopConfig);

    expect(queries.mapNodes.all().length).toBe(longLoopConfig.mapNodes.length);
    expect(queries.featureGates.all().length).toBe(longLoopConfig.featureGates.length);
    expect(queries.shopItems.all().length).toBe(longLoopConfig.shopItems.length);
    expect(queries.achievements.all().length).toBe(longLoopConfig.achievements.length);
    expect(queries.unlockRules.all().length).toBe(longLoopConfig.unlockRules.length);
    expect(queries.crawlers.all().length).toBe(longLoopConfig.crawlers.length);
    expect(queries.starterKits.all().length).toBe(longLoopConfig.starterKits.length);
    expect(queries.blacksmithServices.all().length).toBe(longLoopConfig.blacksmithServices.length);
    expect(queries.permanentUpgrades.all().length).toBe(longLoopConfig.permanentUpgrades.length);
    expect(queries.relics.all().length).toBe(longLoopConfig.relics.length);
    expect(queries.arcana.all().length).toBe(longLoopConfig.arcana.length);
    expect(queries.gems.all().length).toBe(longLoopConfig.gems.length);
    expect(queries.collectionCategories.all().length).toBe(longLoopConfig.collectionCategories.length);
    expect(queries.unlockBuildingEntries.all().length).toBe(longLoopConfig.unlockBuildingEntries.length);

    expect(queries.achievements.byId(longLoopConfig.achievements[0].id)).toEqual(longLoopConfig.achievements[0]);
    expect(queries.achievements.byId('achievement.missing')).toBeUndefined();
  });
});
