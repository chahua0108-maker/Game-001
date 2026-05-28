import { describe, expect, it } from 'vitest';

import { createDefaultProfile } from '../../meta/profile/createProfile';
import {
  featureGateIdsUnlockedAfterAchievements,
  featureGateReads,
  isFeatureGateUnlocked
} from '../../meta/systems/map/featureGateSelectors';
import { mapNodeReads, playableMapNodeIds } from '../../meta/systems/map/mapSelectors';

describe('map feature gates', () => {
  it('keeps D1 playable and D5-D10 locked during P0', () => {
    const profile = createDefaultProfile();
    const reads = mapNodeReads(profile, 'P0');

    expect(reads.find((node) => node.id === 'map.d1')?.state).toBe('playable');
    expect(reads.find((node) => node.id === 'map.d5')?.state).toBe('locked-preview');
    expect(reads.find((node) => node.id === 'map.d10')?.state).toBe('locked-preview');
    expect(playableMapNodeIds(profile, 'P0')).toEqual(['map.d1']);
  });

  it('shows D2 as condition-visible after clear_d1 without making D5-D10 playable', () => {
    const profile = createDefaultProfile();
    profile.achievements.unlockedIds.push('clear_d1');
    const reads = mapNodeReads(profile, 'P0');

    expect(reads.find((node) => node.id === 'map.d2')?.state).toBe('condition-visible');
    expect(reads.filter((node) => ['map.d5', 'map.d6', 'map.d7', 'map.d8', 'map.d9', 'map.d10'].includes(node.id)).map((node) => node.state)).toEqual([
      'locked-preview',
      'locked-preview',
      'locked-preview',
      'locked-preview',
      'locked-preview',
      'locked-preview'
    ]);
  });

  it('keeps D4 pollution and D5-D10 as preview contracts before P3', () => {
    const profile = createDefaultProfile();
    profile.achievements.unlockedIds.push('clear_d1', 'clear_d2', 'build_survived_d3');
    const reads = mapNodeReads(profile, 'P2');

    expect(reads.find((node) => node.id === 'map.d4')?.state).toBe('condition-visible');
    expect(reads.find((node) => node.id === 'map.d4')?.stageGoalPressure).toBe('pollution_preview');
    expect(reads.find((node) => node.id === 'map.d9')?.stageGoalPressure).toBe('reaper_preview');
    expect(reads.find((node) => node.id === 'map.d10')?.state).toBe('locked-preview');
  });

  it('keeps D5-D10 locked in P3 when only profile map unlocks are forged without explicit extension rules', () => {
    const profile = createDefaultProfile();
    profile.map.unlockedNodeIds.push('map.d5', 'map.d6', 'map.d7', 'map.d8', 'map.d9', 'map.d10');
    const reads = mapNodeReads(profile, 'P3');

    expect(reads.filter((node) => ['map.d5', 'map.d6', 'map.d7', 'map.d8', 'map.d9', 'map.d10'].includes(node.id)).map((node) => node.state)).toEqual([
      'locked-preview',
      'locked-preview',
      'locked-preview',
      'locked-preview',
      'locked-preview',
      'locked-preview'
    ]);
    expect(playableMapNodeIds(profile, 'P3')).toEqual(['map.d1']);
  });

  it('reads feature gates from config defaults and profile unlocks', () => {
    const profile = createDefaultProfile();

    expect(isFeatureGateUnlocked(profile, 'hub.shop')).toBe(true);
    expect(isFeatureGateUnlocked(profile, 'hub.blacksmith')).toBe(false);

    profile.featureGates.unlockedIds.push('hub.blacksmith');
    expect(featureGateReads(profile).find((gate) => gate.id === 'hub.blacksmith')?.state).toBe('unlocked');
  });

  it('derives blacksmith feature gate unlocks from config unlock rules and awarded achievements', () => {
    const profile = createDefaultProfile();

    expect(featureGateIdsUnlockedAfterAchievements(profile, ['first_run_completed'])).toEqual(['hub.blacksmith']);

    profile.achievements.unlockedIds.push('first_run_completed');
    expect(isFeatureGateUnlocked(profile, 'hub.blacksmith')).toBe(true);
  });
});
