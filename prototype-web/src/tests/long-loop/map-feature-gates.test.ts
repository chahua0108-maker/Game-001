import { describe, expect, it } from 'vitest';

import { createDefaultProfile } from '../../meta/profile/createProfile';
import { featureGateReads, isFeatureGateUnlocked } from '../../meta/systems/map/featureGateSelectors';
import { mapNodeReads, playableMapNodeIds } from '../../meta/systems/map/mapSelectors';

describe('map feature gates', () => {
  it('keeps D1 playable and D5-D10 locked during P0', () => {
    const profile = createDefaultProfile();
    const reads = mapNodeReads(profile, 'P0');

    expect(reads.find((node) => node.id === 'd1')?.state).toBe('playable');
    expect(reads.find((node) => node.id === 'd5')?.state).toBe('locked-preview');
    expect(reads.find((node) => node.id === 'd10')?.state).toBe('locked-preview');
    expect(playableMapNodeIds(profile, 'P0')).toEqual(['d1']);
  });

  it('shows D2 as condition-visible after clear_d1 without making D5-D10 playable', () => {
    const profile = createDefaultProfile();
    profile.achievements.unlockedIds.push('clear_d1');
    const reads = mapNodeReads(profile, 'P0');

    expect(reads.find((node) => node.id === 'd2')?.state).toBe('condition-visible');
    expect(reads.filter((node) => ['d5', 'd6', 'd7', 'd8', 'd9', 'd10'].includes(node.id)).map((node) => node.state)).toEqual([
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

    expect(reads.find((node) => node.id === 'd4')?.state).toBe('condition-visible');
    expect(reads.find((node) => node.id === 'd4')?.stageGoalPressure).toBe('pollution_preview');
    expect(reads.find((node) => node.id === 'd9')?.stageGoalPressure).toBe('reaper_preview');
    expect(reads.find((node) => node.id === 'd10')?.state).toBe('locked-preview');
  });

  it('reads feature gates from config defaults and profile unlocks', () => {
    const profile = createDefaultProfile();

    expect(isFeatureGateUnlocked(profile, 'feature.shop_inventory')).toBe(true);
    expect(isFeatureGateUnlocked(profile, 'feature.blacksmith')).toBe(false);

    profile.featureGates.unlockedIds.push('feature.blacksmith');
    expect(featureGateReads(profile).find((gate) => gate.id === 'feature.blacksmith')?.state).toBe('unlocked');
  });
});
