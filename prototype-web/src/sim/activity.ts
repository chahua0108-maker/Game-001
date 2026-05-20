import type {
  ActivityLevelDefinition,
  ActivityLevelId,
  ActivitySettlementPreview,
  ActivityState,
  EnemyState,
  RunStatus
} from './types';

export const REDLINE_ACTIVITY_LEVELS: readonly ActivityLevelDefinition[] = [
  {
    id: 'd1',
    label: 'D1',
    title: '试营业清算',
    difficultyTier: 1,
    band: 'beginner',
    nodeCount: 3,
    playerMaxHp: 72,
    enemyHpMultiplier: 0.8,
    enemyDamageMultiplier: 0.45,
    rewardPickCount: 4,
    eliteRouteEntryDamage: 2,
    eliteRouteAddsPollution: false
  },
  {
    id: 'd2',
    label: 'D2',
    title: '低压追账',
    difficultyTier: 2,
    band: 'beginner',
    nodeCount: 3,
    playerMaxHp: 66,
    enemyHpMultiplier: 0.9,
    enemyDamageMultiplier: 0.7,
    rewardPickCount: 4,
    eliteRouteEntryDamage: 3,
    eliteRouteAddsPollution: false
  },
  {
    id: 'd3',
    label: 'D3',
    title: '中级清算入口',
    difficultyTier: 3,
    band: 'intermediate',
    nodeCount: 6,
    playerMaxHp: 60,
    enemyHpMultiplier: 1,
    enemyDamageMultiplier: 1,
    rewardPickCount: 3,
    eliteRouteEntryDamage: 6,
    eliteRouteAddsPollution: true
  }
] as const;

const LEVEL_BY_ID = new Map<ActivityLevelId, ActivityLevelDefinition>(
  REDLINE_ACTIVITY_LEVELS.map((level) => [level.id, level])
);

export function createInitialActivityState(): ActivityState {
  return {
    id: 'redline-core-activity-01',
    title: '红线清算局 第一套闯关',
    totalDifficultyTiers: 10,
    playableLevelIds: REDLINE_ACTIVITY_LEVELS.map((level) => level.id),
    currentLevelId: 'd1',
    completedLevelIds: []
  };
}

export function cloneActivityState(activity: ActivityState): ActivityState {
  return {
    ...activity,
    playableLevelIds: [...activity.playableLevelIds],
    completedLevelIds: [...activity.completedLevelIds]
  };
}

export function currentActivityLevel(activity: ActivityState): ActivityLevelDefinition {
  return resolveActivityLevelDefinition(activity.currentLevelId);
}

export function resolveActivityLevelDefinition(levelId: ActivityLevelId): ActivityLevelDefinition {
  const level = LEVEL_BY_ID.get(levelId);
  if (!level) {
    throw new Error(`Unknown activity level: ${levelId}`);
  }
  return level;
}

export function nextActivityLevelId(activity: ActivityState): ActivityLevelId | null {
  const currentIndex = activity.playableLevelIds.indexOf(activity.currentLevelId);
  return activity.playableLevelIds[currentIndex + 1] ?? null;
}

export function createActivitySettlementPreview(
  activity: ActivityState,
  runStatus: RunStatus
): ActivitySettlementPreview {
  const currentLevel = currentActivityLevel(activity);
  const nextLevelId = runStatus === 'victory' ? nextActivityLevelId(activity) : null;
  const nextLevel = nextLevelId ? resolveActivityLevelDefinition(nextLevelId) : null;

  return {
    currentLevelId: activity.currentLevelId,
    currentLevelLabel: currentLevel.label,
    currentLevelTitle: currentLevel.title,
    completed: runStatus === 'victory',
    nextLevelId,
    nextLevelLabel: nextLevel?.label ?? null,
    canContinue: Boolean(nextLevelId)
  };
}

export function continueActivityAfterVictory(activity: ActivityState): ActivityState {
  const nextActivity = cloneActivityState(activity);
  if (!nextActivity.completedLevelIds.includes(nextActivity.currentLevelId)) {
    nextActivity.completedLevelIds.push(nextActivity.currentLevelId);
  }

  const nextLevelId = nextActivityLevelId(nextActivity);
  if (nextLevelId) {
    nextActivity.currentLevelId = nextLevelId;
  }

  return nextActivity;
}

export function scaledActivityValue(baseValue: number, multiplier: number): number {
  return Math.max(1, Math.round(baseValue * multiplier));
}

export function scaleEnemyForActivityLevel(enemy: EnemyState, level: ActivityLevelDefinition): EnemyState {
  const hp = scaledActivityValue(enemy.maxHp, level.enemyHpMultiplier);
  const damage = scaledActivityValue(enemy.damage, level.enemyDamageMultiplier);
  return {
    ...enemy,
    hp,
    maxHp: hp,
    damage
  };
}
