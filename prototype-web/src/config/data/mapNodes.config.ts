import type { MapNodeConfig } from '../schema/definitions';

export const mapNodes = [
  {
    id: 'd1',
    name: 'D1 Redline Gate',
    tier: 1,
    nodeType: 'combat',
    stageGoalPressure: 'mini_boss_marker',
    p0PreviewState: 'playable'
  },
  {
    id: 'd2',
    name: 'D2 Branching Hall',
    tier: 2,
    nodeType: 'combat',
    unlockRuleIds: ['unlock.map.d2'],
    p0PreviewState: 'condition_visible'
  },
  {
    id: 'd3',
    name: 'D3 Service Test',
    tier: 3,
    nodeType: 'elite',
    unlockRuleIds: ['unlock.map.d3'],
    p0PreviewState: 'locked_preview'
  },
  {
    id: 'd4',
    name: 'D4 Pollution First Look',
    tier: 4,
    nodeType: 'pressure',
    unlockRuleIds: ['unlock.map.d4'],
    stageGoalPressure: 'pollution_preview',
    p0PreviewState: 'locked_preview'
  },
  {
    id: 'd5',
    name: 'D5 Backlog Preview',
    tier: 5,
    nodeType: 'combat',
    p0PreviewState: 'locked_preview'
  },
  {
    id: 'd6',
    name: 'D6 Backlog Preview',
    tier: 6,
    nodeType: 'combat',
    p0PreviewState: 'locked_preview'
  },
  {
    id: 'd7',
    name: 'D7 Backlog Preview',
    tier: 7,
    nodeType: 'elite',
    p0PreviewState: 'locked_preview'
  },
  {
    id: 'd8',
    name: 'D8 Backlog Preview',
    tier: 8,
    nodeType: 'combat',
    p0PreviewState: 'locked_preview'
  },
  {
    id: 'd9',
    name: 'D9 Reaper Pressure Preview',
    tier: 9,
    nodeType: 'pressure',
    stageGoalPressure: 'reaper_preview',
    p0PreviewState: 'locked_preview'
  },
  {
    id: 'd10',
    name: 'D10 Final Boss Preview',
    tier: 10,
    nodeType: 'boss',
    stageGoalPressure: 'boss_marker',
    p0PreviewState: 'locked_preview'
  },
  {
    id: 'map.start',
    name: 'Caravan Start',
    tier: 0,
    nodeType: 'start'
  },
  {
    id: 'map.elite_fork',
    name: 'Elite Fork',
    tier: 2,
    nodeType: 'elite',
    unlockRuleIds: ['unlock.map.elite_route']
  },
  {
    id: 'map.first_boss',
    name: 'First Boss',
    tier: 3,
    nodeType: 'boss'
  }
] as const satisfies readonly MapNodeConfig[];
