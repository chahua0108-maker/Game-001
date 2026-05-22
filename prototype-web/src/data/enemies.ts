import type { EnemyDefinition } from '../sim/types';

export const enemies: EnemyDefinition[] = [
  {
    id: 'debt_wisp',
    name: '债雾',
    hp: 10,
    speed: 2.2,
    damage: 2,
    xpReward: 1,
    lane: -1,
    z: -18
  },
  {
    id: 'redline_brute',
    name: '红线蛮兵',
    hp: 22,
    speed: 1.2,
    damage: 5,
    xpReward: 2,
    lane: 0,
    z: -24
  },
  {
    id: 'pulse_collector',
    name: '脉冲收集者',
    hp: 16,
    speed: 1.6,
    damage: 3,
    xpReward: 2,
    lane: 1,
    z: -30
  }
];
