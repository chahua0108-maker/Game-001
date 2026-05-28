import type { MapNodeConfig } from '../schema/definitions';

export const mapNodes = [
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
