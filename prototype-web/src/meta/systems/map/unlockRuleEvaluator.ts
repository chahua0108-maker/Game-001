import { longLoopConfig } from '../../../config/data/longLoopConfig';
import type { FeatureGateConfig, UnlockRuleConfig, UnlockTargetTableKey } from '../../../config/schema/definitions';
import { toCanonicalLongLoopId, type FeatureGateId, type UnlockRuleId } from '../../../config/schema/ids';

export interface UnlockRuleEvaluationProfile {
  readonly achievements: {
    readonly unlockedIds: readonly string[];
  };
  readonly featureGates: {
    readonly unlockedIds: readonly FeatureGateId[];
  };
}

interface UnlockRuleEvaluationOptions {
  readonly featureGateIds?: ReadonlySet<FeatureGateId>;
}

export function areUnlockRulesSatisfied(
  unlockRuleIds: readonly UnlockRuleId[] | undefined,
  profile: UnlockRuleEvaluationProfile,
  options: UnlockRuleEvaluationOptions = {}
): boolean {
  if (!unlockRuleIds || unlockRuleIds.length === 0) {
    return false;
  }

  return unlockRuleIds.every((ruleId) => {
    const rule = unlockRuleById(ruleId);
    return Boolean(rule && isUnlockRuleSatisfied(rule, profile, options));
  });
}

export function unlockRuleTargetIds(
  targetSystem: UnlockTargetTableKey,
  profile: UnlockRuleEvaluationProfile,
  options: UnlockRuleEvaluationOptions = {}
): readonly string[] {
  return longLoopConfig.unlockRules
    .filter((rule) => rule.targetSystem === targetSystem)
    .filter((rule) => isUnlockRuleSatisfied(rule, profile, options))
    .map((rule) => rule.targetId);
}

export function defaultAvailableFeatureGateIds(): readonly FeatureGateId[] {
  return longLoopConfig.featureGates
    .filter((gate) => gate.defaultState === 'available')
    .map((gate) => gate.id);
}

export function derivedFeatureGateIds(profile: UnlockRuleEvaluationProfile): readonly FeatureGateId[] {
  const featureGates: readonly FeatureGateConfig[] = longLoopConfig.featureGates;
  const featureGateIds = new Set<FeatureGateId>([
    ...defaultAvailableFeatureGateIds(),
    ...profile.featureGates.unlockedIds.map(toCanonicalLongLoopId)
  ]);

  let changed = true;
  while (changed) {
    changed = false;

    for (const gate of featureGates) {
      if (featureGateIds.has(gate.id) || !gate.unlockRuleIds) {
        continue;
      }

      if (areUnlockRulesSatisfied(gate.unlockRuleIds, profile, { featureGateIds })) {
        featureGateIds.add(gate.id);
        changed = true;
      }
    }
  }

  return [...featureGateIds];
}

function isUnlockRuleSatisfied(
  rule: UnlockRuleConfig,
  profile: UnlockRuleEvaluationProfile,
  options: UnlockRuleEvaluationOptions
): boolean {
  const achievementIds = new Set(profile.achievements.unlockedIds);
  const featureGateIds = options.featureGateIds ?? new Set(derivedFeatureGateIds(profile));

  return (
    (rule.requiresAchievements ?? []).every((achievementId) => achievementIds.has(achievementId)) &&
    (rule.requiresFeatureGates ?? []).every((featureGateId) => featureGateIds.has(featureGateId))
  );
}

function unlockRuleById(ruleId: UnlockRuleId): UnlockRuleConfig | undefined {
  return longLoopConfig.unlockRules.find((rule) => rule.id === ruleId);
}
