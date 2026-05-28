import type { AchievementConfig } from '../schema/definitions';

export const achievements = [
  {
    id: 'first_run_completed',
    name: 'Completed First Run',
    condition: 'Finish any crawler run once.'
  },
  {
    id: 'clear_d1',
    name: 'Clear D1',
    condition: 'Clear the first district route.'
  },
  {
    id: 'chain_certified',
    name: 'Chain Certified',
    condition: 'Complete a run with a certified stable chain.'
  },
  {
    id: 'first_purchase',
    name: 'First Purchase',
    condition: 'Buy any P0 permit from the shop.'
  },
  {
    id: 'clear_d2',
    name: 'Clear D2',
    condition: 'Clear the second district route during the P1/P2 map loop.'
  },
  {
    id: 'build_survived_d3',
    name: 'Build Survived D3',
    condition: 'Use a purchased service or starter and survive the D3 loop.'
  }
] as const satisfies readonly AchievementConfig[];
