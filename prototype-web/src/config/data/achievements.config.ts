import type { AchievementConfig } from '../schema/definitions';

export const achievements = [
  {
    id: 'achievement.completed_first_run',
    name: 'Completed First Run',
    condition: 'Finish any crawler run once.'
  },
  {
    id: 'achievement.cleared_first_boss',
    name: 'Cleared First Boss',
    condition: 'Defeat the first route boss.'
  },
  {
    id: 'achievement.bought_first_upgrade',
    name: 'Bought First Upgrade',
    condition: 'Buy any permanent upgrade.'
  }
] as const satisfies readonly AchievementConfig[];
