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

const canonicalP0AchievementIds = ['chain_certified', 'clear_d1', 'first_purchase', 'first_run_completed'];
const lockedP0ShopItemIds = [
  'blacksmith_raise_level_permit',
  'blacksmith_red_socket_permit',
  'blacksmith_reroll_permit',
  'starter_stable_chain'
];
const rawPermanentUpgradeTokens = ['hp', 'health', 'attack', 'max_mp', 'max mp', 'mp'];
const requiredMatrixFields = ['trigger', 'mapNode', 'featureGate', 'achievement', 'uiState', 'nextGoal', 'visibility'];

type ValidatorInput = Parameters<typeof validateLongLoopConfig>[0];

function asValidatorInput(config: unknown): ValidatorInput {
  return config as ValidatorInput;
}

function shouldPrintTableCounts(): boolean {
  const maybeProcess = globalThis as typeof globalThis & {
    readonly process?: { readonly env?: Record<string, string | undefined> };
  };

  return maybeProcess.process?.env?.LONG_LOOP_CONFIG_PRINT_COUNTS === '1';
}

describe('long-loop config contract', () => {
  it('keeps every target-state system backed by an independent config table', () => {
    const result = validateLongLoopConfig(longLoopConfig);

    expect(result.errors).toEqual([]);
    expect(Object.keys(result.tableCounts).sort()).toEqual(expectedTableKeys);

    for (const key of expectedTableKeys) {
      expect(result.tableCounts[key], key).toBeGreaterThan(0);
    }

    if (shouldPrintTableCounts()) {
      console.log(`Long-loop config table counts: ${JSON.stringify(result.tableCounts)}`);
    }
  });

  it('uses the approved first 3 hours unlock matrix fixed fields', () => {
    expect(Object.keys(longLoopConfig.first3HoursUnlockMatrix[0])).toEqual(
      expect.arrayContaining(requiredMatrixFields)
    );

    for (const field of requiredMatrixFields) {
      const { [field]: _removedField, ...entryWithoutField } = asValidatorInput(
        longLoopConfig.first3HoursUnlockMatrix[0]
      ) as Record<string, unknown>;
      const result = validateLongLoopConfig(asValidatorInput({
        ...longLoopConfig,
        first3HoursUnlockMatrix: [entryWithoutField]
      }));

      expect(result.errors).toContain(`first3HoursUnlockMatrix[0].${field} is required`);
    }
  });

  it('uses the canonical P0 achievement ids from the approved plan', () => {
    expect(longLoopConfig.achievements.map((achievement) => achievement.id).sort()).toEqual(canonicalP0AchievementIds);
  });

  it('uses the locked P0 shop and starter ids from the approved plan', () => {
    expect(longLoopConfig.shopItems.map((item) => item.id).sort()).toEqual(lockedP0ShopItemIds);
    expect(longLoopConfig.starterKits.map((kit) => kit.id).sort()).toEqual(['default_chain', 'stable_chain']);
  });

  it('does not define raw HP, attack, or max MP permanent upgrades', () => {
    for (const upgrade of longLoopConfig.permanentUpgrades) {
      const searchable = `${upgrade.id} ${upgrade.name} ${upgrade.effectType}`.toLowerCase();

      for (const token of rawPermanentUpgradeTokens) {
        expect(searchable, upgrade.id).not.toContain(token);
      }
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

  it('rejects shop items without a required category id', () => {
    const { categoryId: _categoryId, ...shopItemWithoutCategory } = longLoopConfig.shopItems[0];
    const result = validateLongLoopConfig(asValidatorInput({
      ...longLoopConfig,
      shopItems: [shopItemWithoutCategory]
    }));

    expect(result.errors).toContain('shopItems[0].categoryId is required');
  });

  it('rejects starter kits without a required crawler id', () => {
    const { crawlerId: _crawlerId, ...starterKitWithoutCrawler } = longLoopConfig.starterKits[0];
    const result = validateLongLoopConfig(asValidatorInput({
      ...longLoopConfig,
      starterKits: [starterKitWithoutCrawler]
    }));

    expect(result.errors).toContain('starterKits[0].crawlerId is required');
  });

  it('rejects crawlers that reference a missing starter kit', () => {
    const result = validateLongLoopConfig({
      ...longLoopConfig,
      crawlers: [
        {
          ...longLoopConfig.crawlers[0],
          starterKitId: 'starter.missing'
        }
      ]
    });

    expect(result.errors).toContain('crawlers[0].starterKitId references missing starter kit starter.missing');
  });

  it('rejects missing or non-array first 3 hours matrix unlock rule ids without throwing', () => {
    const { unlockRuleIds: _unlockRuleIds, ...matrixEntryWithoutRules } = longLoopConfig.first3HoursUnlockMatrix[0];
    const missingResult = validateLongLoopConfig(asValidatorInput({
      ...longLoopConfig,
      first3HoursUnlockMatrix: [matrixEntryWithoutRules]
    }));

    expect(missingResult.errors).toContain('first3HoursUnlockMatrix[0].unlockRuleIds must be a non-empty array');
    expect(() =>
      validateLongLoopConfig(asValidatorInput({
        ...longLoopConfig,
        first3HoursUnlockMatrix: [
          {
            ...longLoopConfig.first3HoursUnlockMatrix[0],
            unlockRuleIds: 'unlock.map.elite_route'
          }
        ]
      }))
    ).not.toThrow();

    const malformedResult = validateLongLoopConfig(asValidatorInput({
      ...longLoopConfig,
      first3HoursUnlockMatrix: [
        {
          ...longLoopConfig.first3HoursUnlockMatrix[0],
          unlockRuleIds: 'unlock.map.elite_route'
        }
      ]
    }));

    expect(malformedResult.errors).toContain('first3HoursUnlockMatrix[0].unlockRuleIds must be a non-empty array');
  });

  it('rejects unlock building entries without a required unlock rule id', () => {
    const { unlockRuleId: _unlockRuleId, ...entryWithoutRule } = longLoopConfig.unlockBuildingEntries[0];
    const result = validateLongLoopConfig(asValidatorInput({
      ...longLoopConfig,
      unlockBuildingEntries: [entryWithoutRule]
    }));

    expect(result.errors).toContain('unlockBuildingEntries[0].unlockRuleId is required');
  });

  it('does not throw on malformed array-like reference fields', () => {
    const malformedConfig = {
      ...longLoopConfig,
      shopItems: [
        {
          ...longLoopConfig.shopItems[0],
          requiresFeatureGateIds: { 0: 'feature.shop_inventory', length: 1 },
          requiresAchievementIds: 'achievement.completed_first_run',
          unlockRuleIds: 42
        }
      ],
      starterKits: [
        {
          ...longLoopConfig.starterKits[0],
          shopItemIds: { 0: 'shop.blood_vial', length: 1 }
        }
      ]
    };

    expect(() => validateLongLoopConfig(asValidatorInput(malformedConfig))).not.toThrow();

    const result = validateLongLoopConfig(asValidatorInput(malformedConfig));
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'shopItems[0].requiresFeatureGateIds must be an array',
        'shopItems[0].requiresAchievementIds must be an array',
        'shopItems[0].unlockRuleIds must be an array',
        'starterKits[0].shopItemIds must be a non-empty array'
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
