import { describe, expect, it } from 'vitest';
import {
  completeCombatRouteNode,
  createInitialShortRunRouteState,
  selectShortRunRouteNode
} from '../../sim/runRoute';
import { createInitialRunState } from '../../sim/world';

describe('redline short-run route node selection', () => {
  it('generates two next-node candidates after a combat node is completed', () => {
    const run = createInitialRunState();
    const result = completeCombatRouteNode(run);

    expect(result.run.currentNode).toBe(1);
    expect(result.route.pendingNodeChoices).toHaveLength(2);
    expect(result.route.pendingNodeChoices.map((candidate) => candidate.toNode)).toEqual([2, 2]);
    expect(result.route.pendingNodeChoices.map((candidate) => candidate.kind)).toEqual([
      'repair-cache',
      'elite-pressure'
    ]);
    expect(result.route.pendingNodeChoices.map((candidate) => candidate.nextBattleContext.modifierId)).toEqual([
      'rewardRerollPlusOne',
      'maxEnergyThisRunPlusOne'
    ]);
  });

  it('selects one candidate, advances run.currentNode, and carries next-battle context', () => {
    const run = createInitialRunState();
    const planned = completeCombatRouteNode(run);
    const repairRoute = planned.route.pendingNodeChoices[0];

    const selected = selectShortRunRouteNode(planned.run, planned.route, repairRoute.id);

    expect(selected.run.currentNode).toBe(2);
    expect(selected.run.status).toBe('in-progress');
    expect(selected.route.pendingNodeChoices).toEqual([]);
    expect(selected.route.nextBattleContext).toEqual({
      sourceNode: 1,
      targetNode: 2,
      selectedRouteId: repairRoute.id,
      modifierId: 'rewardRerollPlusOne',
      rewardBranchHint: 'repair-resource',
      rewardPickBonus: 1,
      label: '维修补给岔路'
    });
    expect(selected.route.history).toEqual([
      {
        fromNode: 1,
        toNode: 2,
        selectedRouteId: repairRoute.id,
        context: selected.route.nextBattleContext
      }
    ]);
  });

  it('does not mutate the original run or route snapshots while planning and selecting', () => {
    const run = createInitialRunState();
    const initialRoute = createInitialShortRunRouteState();

    const planned = completeCombatRouteNode(run, initialRoute);
    const selected = selectShortRunRouteNode(planned.run, planned.route, planned.route.pendingNodeChoices[1].id);

    expect(run.currentNode).toBe(1);
    expect(initialRoute.pendingNodeChoices).toEqual([]);
    expect(planned.run.currentNode).toBe(1);
    expect(planned.route.pendingNodeChoices).toHaveLength(2);
    expect(selected.run.currentNode).toBe(2);
  });

  it('marks victory instead of generating another branch after the final combat node', () => {
    const run = {
      ...createInitialRunState(),
      currentNode: 3,
      maxNodes: 3
    };

    const result = completeCombatRouteNode(run);

    expect(result.run.status).toBe('victory');
    expect(result.run.currentNode).toBe(3);
    expect(result.route.pendingNodeChoices).toEqual([]);
    expect(result.route.nextBattleContext).toBeNull();
  });

  it('rejects stale candidate ids without advancing the run', () => {
    const run = createInitialRunState();
    const planned = completeCombatRouteNode(run);

    expect(() => selectShortRunRouteNode(planned.run, planned.route, 'missing-route')).toThrow(
      'Unknown short-run route node candidate: missing-route'
    );
    expect(planned.run.currentNode).toBe(1);
  });
});
