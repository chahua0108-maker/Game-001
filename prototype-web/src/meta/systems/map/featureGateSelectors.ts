import { longLoopConfig } from '../../../config/data/longLoopConfig';
import type { FeatureGateId } from '../../../config/schema/ids';
import type { LongLoopProfile } from '../../profile/profileTypes';
import { derivedFeatureGateIds, type UnlockRuleEvaluationProfile } from './unlockRuleEvaluator';

export type FeatureGateReadState = 'unlocked' | 'locked';

export interface FeatureGateRead {
  readonly id: FeatureGateId;
  readonly name: string;
  readonly state: FeatureGateReadState;
}

export function featureGateReads(profile: LongLoopProfile): readonly FeatureGateRead[] {
  const unlockedIds = new Set(effectiveFeatureGateIds(profile));

  return longLoopConfig.featureGates.map((gate) => ({
    id: gate.id,
    name: gate.name,
    state: unlockedIds.has(gate.id) ? 'unlocked' : 'locked'
  }));
}

export function isFeatureGateUnlocked(profile: LongLoopProfile, featureGateId: FeatureGateId): boolean {
  return effectiveFeatureGateIds(profile).includes(featureGateId);
}

export function effectiveFeatureGateIds(profile: UnlockRuleEvaluationProfile): readonly FeatureGateId[] {
  return derivedFeatureGateIds(profile);
}

export function featureGateIdsUnlockedAfterAchievements(
  profile: LongLoopProfile,
  achievementIds: readonly string[]
): readonly FeatureGateId[] {
  const before = new Set(effectiveFeatureGateIds(profile));
  const after = effectiveFeatureGateIds({
    ...profile,
    achievements: {
      unlockedIds: [...profile.achievements.unlockedIds, ...achievementIds]
    }
  });

  return after.filter((featureGateId) => !before.has(featureGateId));
}
