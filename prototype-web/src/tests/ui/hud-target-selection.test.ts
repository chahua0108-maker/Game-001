import { describe, expect, it } from 'vitest';
import { canHudEndTurn, validHudSelectedTargetId } from '../../ui/hud';
import type { EnemySnapshot } from '../../sim/types';

const frontTarget: EnemySnapshot = {
  id: 'enemy-1',
  definitionId: 'debt_wisp',
  name: 'Debt Wisp',
  hp: 10,
  maxHp: 10,
  slot: 0,
  lane: -2,
  z: -6,
  alive: true
};

describe('HUD target selection', () => {
  it('keeps only living first-row selections valid', () => {
    const enemies: EnemySnapshot[] = [
      frontTarget,
      { ...frontTarget, id: 'enemy-2', slot: 5, alive: true },
      { ...frontTarget, id: 'enemy-3', slot: 2, alive: false }
    ];

    expect(validHudSelectedTargetId('enemy-1', enemies)).toBe('enemy-1');
    expect(validHudSelectedTargetId('enemy-2', enemies)).toBeNull();
    expect(validHudSelectedTargetId('enemy-3', enemies)).toBeNull();
    expect(validHudSelectedTargetId(null, enemies)).toBeNull();
  });
});

describe('HUD end turn action', () => {
  it('keeps end turn available throughout PlayerTurn', () => {
    expect(canHudEndTurn('PlayerTurn')).toBe(true);
    expect(canHudEndTurn('Deal')).toBe(false);
    expect(canHudEndTurn('EnemyAttack')).toBe(false);
    expect(canHudEndTurn('Reward')).toBe(false);
  });
});
