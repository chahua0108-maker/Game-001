import {
  longLoopTableKeys,
  type LongLoopConfig,
  type LongLoopTableCounts,
  type LongLoopTableKey,
  type UnlockTargetTableKey
} from '../schema/definitions';

export interface LongLoopConfigValidationResult {
  readonly errors: readonly string[];
  readonly tableCounts: LongLoopTableCounts;
}

type ConfigRecord = Partial<LongLoopConfig> & Record<string, unknown>;
type IdEntry = { readonly id: string };

const unlockTargetTableKeys: readonly UnlockTargetTableKey[] = [
  'achievements',
  'arcana',
  'blacksmithServices',
  'collectionCategories',
  'crawlers',
  'featureGates',
  'gems',
  'mapNodes',
  'permanentUpgrades',
  'relics',
  'shopItems',
  'starterKits',
  'unlockBuildingEntries'
];

const specialMatrixAchievementValues = new Set(['none', 'unchanged']);

export function validateLongLoopConfig(config: ConfigRecord): LongLoopConfigValidationResult {
  const errors: string[] = [];
  const tableCounts = createTableCounts(config);

  for (const key of longLoopTableKeys) {
    if (tableCounts[key] === 0) {
      errors.push(`${key} must have its own non-empty config table`);
    }
  }

  const idSets = createIdSets(config);
  validateDuplicateIds(config, errors);
  validateMatrix(config, idSets, errors);
  validateShopItems(config, idSets, errors);
  validateStarterKits(config, idSets, errors);
  validateUnlockRules(config, idSets, tableCounts, errors);
  validateUnlockBuildingEntries(config, idSets, tableCounts, errors);
  validateUnlockRuleRefs(config, idSets, errors);

  return {
    errors,
    tableCounts
  };
}

function createTableCounts(config: ConfigRecord): LongLoopTableCounts {
  return longLoopTableKeys.reduce((counts, key) => {
    counts[key] = getTable(config, key).length;
    return counts;
  }, {} as LongLoopTableCounts);
}

function createIdSets(config: ConfigRecord): Record<LongLoopTableKey, ReadonlySet<string>> {
  return longLoopTableKeys.reduce((sets, key) => {
    sets[key] = new Set(getTable(config, key).map((entry) => entry.id));
    return sets;
  }, {} as Record<LongLoopTableKey, ReadonlySet<string>>);
}

function getTable(config: ConfigRecord, key: LongLoopTableKey): readonly IdEntry[] {
  const table = config[key];
  return Array.isArray(table) ? (table as readonly IdEntry[]) : [];
}

function validateDuplicateIds(config: ConfigRecord, errors: string[]): void {
  for (const key of longLoopTableKeys) {
    const seen = new Set<string>();
    getTable(config, key).forEach((entry, index) => {
      if (!entry.id) {
        errors.push(`${key}[${index}].id is required`);
        return;
      }
      if (seen.has(entry.id)) {
        errors.push(`${key}[${index}].id duplicates ${entry.id}`);
      }
      seen.add(entry.id);
    });
  }
}

function validateMatrix(
  config: ConfigRecord,
  idSets: Record<LongLoopTableKey, ReadonlySet<string>>,
  errors: string[]
): void {
  const matrix = getTable(config, 'first3HoursUnlockMatrix') as readonly {
    readonly achievement?: string;
    readonly unlockRuleIds?: readonly string[];
  }[];

  matrix.forEach((entry, index) => {
    const achievement = entry.achievement;
    if (
      typeof achievement !== 'string' ||
      (!specialMatrixAchievementValues.has(achievement) && !idSets.achievements.has(achievement))
    ) {
      errors.push(`first3HoursUnlockMatrix[${index}].achievement must be an achievement id, none, or unchanged`);
    }

    validateReferences(
      entry.unlockRuleIds,
      idSets.unlockRules,
      `first3HoursUnlockMatrix[${index}].unlockRuleIds`,
      'unlock rule',
      errors,
      { required: true, nonEmpty: true }
    );
  });
}

function validateShopItems(
  config: ConfigRecord,
  idSets: Record<LongLoopTableKey, ReadonlySet<string>>,
  errors: string[]
): void {
  const shopItems = getTable(config, 'shopItems') as readonly {
    readonly categoryId?: string;
    readonly requiresFeatureGateIds?: readonly string[];
    readonly requiresAchievementIds?: readonly string[];
    readonly unlockRuleIds?: readonly string[];
  }[];

  shopItems.forEach((item, index) => {
    if (!validateRequiredString(item.categoryId, `shopItems[${index}].categoryId`, errors)) {
      return;
    }
    if (!idSets.collectionCategories.has(item.categoryId)) {
      errors.push(`shopItems[${index}].categoryId references missing collection category ${item.categoryId}`);
    }
    validateReferences(
      item.requiresFeatureGateIds,
      idSets.featureGates,
      `shopItems[${index}].requiresFeatureGateIds`,
      'feature gate',
      errors
    );
    validateReferences(
      item.requiresAchievementIds,
      idSets.achievements,
      `shopItems[${index}].requiresAchievementIds`,
      'achievement',
      errors
    );
    validateReferences(item.unlockRuleIds, idSets.unlockRules, `shopItems[${index}].unlockRuleIds`, 'unlock rule', errors);
  });
}

function validateStarterKits(
  config: ConfigRecord,
  idSets: Record<LongLoopTableKey, ReadonlySet<string>>,
  errors: string[]
): void {
  const starterKits = getTable(config, 'starterKits') as readonly {
    readonly crawlerId?: string;
    readonly shopItemIds?: readonly string[];
  }[];

  starterKits.forEach((kit, index) => {
    if (!validateRequiredString(kit.crawlerId, `starterKits[${index}].crawlerId`, errors)) {
      return;
    }
    if (!idSets.crawlers.has(kit.crawlerId)) {
      errors.push(`starterKits[${index}].crawlerId references missing crawler ${kit.crawlerId}`);
    }
    validateReferences(kit.shopItemIds, idSets.shopItems, `starterKits[${index}].shopItemIds`, 'shop item', errors, {
      required: true,
      nonEmpty: true
    });
  });
}

function validateUnlockRules(
  config: ConfigRecord,
  idSets: Record<LongLoopTableKey, ReadonlySet<string>>,
  tableCounts: LongLoopTableCounts,
  errors: string[]
): void {
  const unlockRules = getTable(config, 'unlockRules') as readonly {
    readonly targetSystem?: string;
    readonly targetId?: string;
    readonly requiresAchievements?: readonly string[];
    readonly requiresFeatureGates?: readonly string[];
  }[];

  unlockRules.forEach((rule, index) => {
    validateTarget(`unlockRules[${index}]`, rule.targetSystem, rule.targetId, idSets, tableCounts, errors);
    validateReferences(
      rule.requiresAchievements,
      idSets.achievements,
      `unlockRules[${index}].requiresAchievements`,
      'achievement',
      errors
    );
    validateReferences(
      rule.requiresFeatureGates,
      idSets.featureGates,
      `unlockRules[${index}].requiresFeatureGates`,
      'feature gate',
      errors
    );
  });
}

function validateUnlockBuildingEntries(
  config: ConfigRecord,
  idSets: Record<LongLoopTableKey, ReadonlySet<string>>,
  tableCounts: LongLoopTableCounts,
  errors: string[]
): void {
  const entries = getTable(config, 'unlockBuildingEntries') as readonly {
    readonly targetSystem?: string;
    readonly targetId?: string;
    readonly unlockRuleId?: string;
  }[];

  entries.forEach((entry, index) => {
    validateTarget(`unlockBuildingEntries[${index}]`, entry.targetSystem, entry.targetId, idSets, tableCounts, errors);
    if (!validateRequiredString(entry.unlockRuleId, `unlockBuildingEntries[${index}].unlockRuleId`, errors)) {
      return;
    }
    if (!idSets.unlockRules.has(entry.unlockRuleId)) {
      errors.push(`unlockBuildingEntries[${index}].unlockRuleId references missing unlock rule ${entry.unlockRuleId}`);
    }
  });
}

function validateUnlockRuleRefs(
  config: ConfigRecord,
  idSets: Record<LongLoopTableKey, ReadonlySet<string>>,
  errors: string[]
): void {
  for (const key of [
    'mapNodes',
    'featureGates',
    'crawlers',
    'blacksmithServices',
    'permanentUpgrades',
    'relics',
    'arcana'
  ] as const) {
    const table = getTable(config, key) as readonly { readonly unlockRuleIds?: readonly string[] }[];
    table.forEach((entry, index) => {
      validateReferences(entry.unlockRuleIds, idSets.unlockRules, `${key}[${index}].unlockRuleIds`, 'unlock rule', errors);
    });
  }
}

function validateTarget(
  path: string,
  targetSystem: string | undefined,
  targetId: string | undefined,
  idSets: Record<LongLoopTableKey, ReadonlySet<string>>,
  tableCounts: LongLoopTableCounts,
  errors: string[]
): void {
  if (!targetSystem || !isUnlockTargetTableKey(targetSystem)) {
    errors.push(`${path}.targetSystem must be a target-state config table`);
    return;
  }

  if (tableCounts[targetSystem] === 0) {
    errors.push(`${path}.targetSystem ${targetSystem} does not have its own config table`);
    return;
  }

  if (!targetId || !idSets[targetSystem].has(targetId)) {
    errors.push(`${path}.targetId references missing ${targetSystem} entry ${targetId ?? ''}`.trim());
  }
}

function validateReferences(
  refs: unknown,
  validIds: ReadonlySet<string>,
  path: string,
  label: string,
  errors: string[],
  options: { readonly required?: boolean; readonly nonEmpty?: boolean } = {}
): void {
  if (refs === undefined || refs === null) {
    if (options.required) {
      errors.push(`${path} must be a non-empty array`);
    }
    return;
  }

  if (!Array.isArray(refs)) {
    errors.push(`${path} must be ${options.required || options.nonEmpty ? 'a non-empty array' : 'an array'}`);
    return;
  }

  if (options.nonEmpty && refs.length === 0) {
    errors.push(`${path} must be a non-empty array`);
    return;
  }

  refs.forEach((ref, index) => {
    if (!validIds.has(ref)) {
      errors.push(`${path}[${index}] references missing ${label} ${ref}`);
    }
  });
}

function validateRequiredString(value: unknown, path: string, errors: string[]): value is string {
  if (typeof value !== 'string' || value.length === 0) {
    errors.push(`${path} is required`);
    return false;
  }
  return true;
}

function isUnlockTargetTableKey(value: string): value is UnlockTargetTableKey {
  return unlockTargetTableKeys.includes(value as UnlockTargetTableKey);
}
