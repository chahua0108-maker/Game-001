import type { First3HoursUnlockMatrixEntry } from '../schema/definitions';

export const first3HoursUnlockMatrix = [
  {
    id: 'matrix.hour1.first_run',
    hour: 1,
    achievement: 'achievement.completed_first_run',
    unlockRuleIds: ['unlock.map.elite_route', 'unlock.feature.blacksmith']
  },
  {
    id: 'matrix.hour2.keep_goal',
    hour: 2,
    achievement: 'unchanged',
    unlockRuleIds: ['unlock.blacksmith.sharpen', 'unlock.crawler.iron_monk']
  },
  {
    id: 'matrix.hour3.no_required_achievement',
    hour: 3,
    achievement: 'none',
    unlockRuleIds: ['unlock.arcana.blood_pact', 'unlock.relic.ash_compass']
  }
] as const satisfies readonly First3HoursUnlockMatrixEntry[];
