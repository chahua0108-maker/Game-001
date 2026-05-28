import { longLoopConfig } from '../../../config/data/longLoopConfig';
import type { FeatureGateId } from '../../../config/schema/ids';
import type { LongLoopProfile } from '../../profile/profileTypes';

export type FeatureGateReadState = 'unlocked' | 'locked';

export interface FeatureGateRead {
  readonly id: FeatureGateId;
  readonly name: string;
  readonly state: FeatureGateReadState;
}

export function featureGateReads(profile: LongLoopProfile): readonly FeatureGateRead[] {
  const unlockedIds = new Set(profile.featureGates.unlockedIds);

  return longLoopConfig.featureGates.map((gate) => ({
    id: gate.id,
    name: gate.name,
    state: gate.defaultState === 'available' || unlockedIds.has(gate.id) ? 'unlocked' : 'locked'
  }));
}

export function isFeatureGateUnlocked(profile: LongLoopProfile, featureGateId: FeatureGateId): boolean {
  return featureGateReads(profile).some((gate) => gate.id === featureGateId && gate.state === 'unlocked');
}
