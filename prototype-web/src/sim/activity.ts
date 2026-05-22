import { rewardCardPool, startingHand } from '../data/cards';
import { createInitialCardUpgradeState } from './cardUpgrades';
import { INITIAL_REWARD_XP_THRESHOLD } from './rewardProgression';
import type {
  ActivityCarryoverState,
  ActivityLevelDefinition,
  ActivityLevelId,
  ActivitySettlementPreview,
  ActivityState,
  CardUpgradeState,
  EnemyState,
  RunRewardHistoryEntry,
  RunStatus,
  WorldState
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
    title: '三节点桥接清算',
    difficultyTier: 2,
    band: 'beginner',
    nodeCount: 3,
    playerMaxHp: 68,
    enemyHpMultiplier: 0.65,
    enemyDamageMultiplier: 0.25,
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
    playerMaxHp: 98,
    enemyHpMultiplier: 0.45,
    enemyDamageMultiplier: 0.45,
    rewardPickCount: 3,
    eliteRouteEntryDamage: 10,
    eliteRouteAddsPollution: true
  },
  {
    id: 'd4',
    label: 'D4',
    title: '污染首秀清算',
    difficultyTier: 4,
    band: 'intermediate',
    nodeCount: 6,
    playerMaxHp: 60,
    enemyHpMultiplier: 0.45,
    enemyDamageMultiplier: 0.25,
    rewardPickCount: 3,
    eliteRouteEntryDamage: 5,
    eliteRouteAddsPollution: true
  }
] as const;

const LEVEL_BY_ID = new Map<ActivityLevelId, ActivityLevelDefinition>(
  REDLINE_ACTIVITY_LEVELS.map((level) => [level.id, level])
);

function cloneCardUpgradeState(cardUpgrades: CardUpgradeState): CardUpgradeState {
  return {
    enhancements: Object.fromEntries(
      Object.entries(cardUpgrades.enhancements).map(([cardId, enhancement]) => [
        cardId,
        enhancement
          ? {
              ...enhancement,
              gemSlots: enhancement.gemSlots.map((slot) => ({ ...slot }))
            }
          : enhancement
      ])
    ),
    choices: cardUpgrades.choices.map((choice) => ({ ...choice })),
    pending: cardUpgrades.pending,
    history: cardUpgrades.history.map((entry) => ({
      ...entry,
      gemSlots: entry.gemSlots.map((slot) => ({ ...slot }))
    }))
  };
}

function cloneRewardHistory(history: readonly RunRewardHistoryEntry[]): RunRewardHistoryEntry[] {
  return history.map((entry) => ({
    ...entry,
    choices: [...entry.choices]
  }));
}

export function createInitialActivityCarryover(maxHp = REDLINE_ACTIVITY_LEVELS[0].playerMaxHp): ActivityCarryoverState {
  return {
    deck: [...startingHand],
    rewardCandidateCardPool: [...rewardCardPool],
    maxHp,
    nextRunStartHp: maxHp,
    maxEnergy: 3,
    xp: 0,
    level: 1,
    xpThreshold: INITIAL_REWARD_XP_THRESHOLD,
    cardUpgrades: createInitialCardUpgradeState(),
    activityRewardHistory: []
  };
}

export function cloneActivityCarryover(carryover: ActivityCarryoverState): ActivityCarryoverState {
  return {
    deck: [...carryover.deck],
    rewardCandidateCardPool: [...carryover.rewardCandidateCardPool],
    maxHp: carryover.maxHp,
    nextRunStartHp: carryover.nextRunStartHp,
    maxEnergy: carryover.maxEnergy,
    xp: carryover.xp,
    level: carryover.level,
    xpThreshold: carryover.xpThreshold,
    cardUpgrades: cloneCardUpgradeState(carryover.cardUpgrades),
    activityRewardHistory: cloneRewardHistory(carryover.activityRewardHistory)
  };
}

export function createInitialActivityState(): ActivityState {
  const initialLevel = REDLINE_ACTIVITY_LEVELS[0];
  return {
    id: 'redline-core-activity-01',
    title: '红线清算局 第一套闯关',
    totalDifficultyTiers: 10,
    playableLevelIds: REDLINE_ACTIVITY_LEVELS.map((level) => level.id),
    currentLevelId: 'd1',
    completedLevelIds: [],
    carryover: createInitialActivityCarryover(initialLevel.playerMaxHp)
  };
}

export function cloneActivityState(activity: ActivityState): ActivityState {
  return {
    ...activity,
    playableLevelIds: [...activity.playableLevelIds],
    completedLevelIds: [...activity.completedLevelIds],
    carryover: activity.carryover
      ? cloneActivityCarryover(activity.carryover)
      : createInitialActivityCarryover(resolveActivityLevelDefinition(activity.currentLevelId).playerMaxHp)
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

export function captureActivityCarryoverFromWorld(world: WorldState): ActivityCarryoverState {
  const priorHistory = world.activity?.carryover.activityRewardHistory ?? [];
  const priorCarryoverMaxHp = world.activity?.carryover.maxHp ?? world.player.maxHp;
  const priorCarryoverMaxEnergy = world.activity?.carryover.maxEnergy ?? world.player.maxEnergy;
  const levelMaxHp = world.activity ? currentActivityLevel(world.activity).playerMaxHp : world.player.maxHp;
  const earnedMaxHp = world.player.maxHp > levelMaxHp ? world.player.maxHp : priorCarryoverMaxHp;

  return {
    deck: [...world.player.deck],
    rewardCandidateCardPool: [...world.reward.candidateCardPool],
    maxHp: earnedMaxHp,
    nextRunStartHp: earnedMaxHp,
    maxEnergy: priorCarryoverMaxEnergy,
    xp: world.player.xp,
    level: world.player.level,
    xpThreshold: world.reward.xpThreshold,
    cardUpgrades: {
      ...cloneCardUpgradeState(world.cardUpgrades),
      choices: [],
      pending: false
    },
    activityRewardHistory: [...cloneRewardHistory(priorHistory), ...cloneRewardHistory(world.run.rewardHistory)]
  };
}

export function continueActivityAfterVictory(activity: ActivityState, carryover: ActivityCarryoverState): ActivityState {
  const nextActivity = cloneActivityState(activity);
  if (!nextActivity.completedLevelIds.includes(nextActivity.currentLevelId)) {
    nextActivity.completedLevelIds.push(nextActivity.currentLevelId);
  }

  const nextLevelId = nextActivityLevelId(nextActivity);
  if (nextLevelId) {
    nextActivity.currentLevelId = nextLevelId;
  }

  nextActivity.carryover = cloneActivityCarryover(carryover);
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
