import type { RewardBranch, RunState } from './types';
import type { RunModifierId } from './runModifiers';

export type ShortRunRouteNodeKind = 'combat' | 'repair-cache' | 'elite-pressure';

export interface ShortRunNextBattleContext {
  sourceNode: number;
  targetNode: number;
  selectedRouteId: string;
  modifierId: RunModifierId;
  rewardBranchHint: RewardBranch;
  rewardPickBonus: number;
  label: string;
}

export interface ShortRunRoutePressureProfile {
  eliteRouteEntryDamage: number;
  eliteRouteAddsPollution: boolean;
}

export interface ShortRunRoutePressurePreview {
  entryDamage: number;
  addsPollution: boolean;
}

export interface ShortRunNodeCandidate {
  id: string;
  fromNode: number;
  toNode: number;
  kind: ShortRunRouteNodeKind;
  label: string;
  preview: string;
  routePressure?: ShortRunRoutePressurePreview;
  nextBattleContext: ShortRunNextBattleContext;
}

export interface ShortRunRouteHistoryEntry {
  fromNode: number;
  toNode: number;
  selectedRouteId: string;
  context: ShortRunNextBattleContext;
}

export interface ShortRunRouteState {
  pendingNodeChoices: readonly ShortRunNodeCandidate[];
  nextBattleContext: ShortRunNextBattleContext | null;
  history: readonly ShortRunRouteHistoryEntry[];
}

export interface ShortRunRouteResult {
  run: RunState;
  route: ShortRunRouteState;
}

export function createInitialShortRunRouteState(): ShortRunRouteState {
  return {
    pendingNodeChoices: [],
    nextBattleContext: null,
    history: []
  };
}

export function resetShortRunRouteForRestart(_route?: ShortRunRouteState): ShortRunRouteState {
  return createInitialShortRunRouteState();
}

function cloneRun(run: RunState): RunState {
  return {
    ...run,
    rewardHistory: run.rewardHistory.map((entry) => ({
      ...entry,
      choices: [...entry.choices]
    }))
  };
}

function cloneContext(context: ShortRunNextBattleContext): ShortRunNextBattleContext {
  return { ...context };
}

function cloneCandidate(candidate: ShortRunNodeCandidate): ShortRunNodeCandidate {
  return {
    ...candidate,
    routePressure: candidate.routePressure ? { ...candidate.routePressure } : undefined,
    nextBattleContext: cloneContext(candidate.nextBattleContext)
  };
}

function cloneRoute(route: ShortRunRouteState): ShortRunRouteState {
  return {
    pendingNodeChoices: route.pendingNodeChoices.map(cloneCandidate),
    nextBattleContext: route.nextBattleContext ? cloneContext(route.nextBattleContext) : null,
    history: route.history.map((entry) => ({
      ...entry,
      context: cloneContext(entry.context)
    }))
  };
}

function routePressureText(routePressure: ShortRunRoutePressurePreview | null): string {
  if (!routePressure) {
    return '';
  }

  const pollution = routePressure.addsPollution ? '污染' : '无污染';
  return routePressure.entryDamage > 0 ? ` · -${routePressure.entryDamage} HP / ${pollution}` : ` · ${pollution}`;
}

function buildCandidate(
  run: RunState,
  kind: ShortRunRouteNodeKind,
  label: string,
  modifierId: RunModifierId,
  rewardBranchHint: RewardBranch,
  rewardPickBonus: number,
  preview: string,
  routePressure: ShortRunRoutePressurePreview | null = null
): ShortRunNodeCandidate {
  const fromNode = run.currentNode;
  const toNode = fromNode + 1;
  const id = `run-${run.runNumber}-node-${fromNode}-to-${toNode}-${kind}`;

  return {
    id,
    fromNode,
    toNode,
    kind,
    label,
    preview: `${preview}${routePressureText(routePressure)}`,
    routePressure: routePressure ?? undefined,
    nextBattleContext: {
      sourceNode: fromNode,
      targetNode: toNode,
      selectedRouteId: id,
      modifierId,
      rewardBranchHint,
      rewardPickBonus,
      label
    }
  };
}

function buildNextNodeCandidates(run: RunState, pressureProfile?: ShortRunRoutePressureProfile): ShortRunNodeCandidate[] {
  const elitePressure =
    pressureProfile
      ? {
          entryDamage: pressureProfile.eliteRouteEntryDamage,
          addsPollution: pressureProfile.eliteRouteAddsPollution
        }
      : null;

  return [
    buildCandidate(
      run,
      'repair-cache',
      '维修补给岔路',
      'rewardRerollPlusOne',
      'repair-resource',
      1,
      '下一战奖励更偏修补/资源，并带 1 次奖励复核上下文。'
    ),
    buildCandidate(
      run,
      'elite-pressure',
      '高压债务岔路',
      'maxEnergyThisRunPlusOne',
      'payoff',
      0,
      '下一战临时信用额度 +1，更容易打出终结牌。',
      elitePressure
    )
  ];
}

export function completeCombatRouteNode(
  run: RunState,
  route: ShortRunRouteState = createInitialShortRunRouteState(),
  pressureProfile?: ShortRunRoutePressureProfile
): ShortRunRouteResult {
  const nextRun = cloneRun(run);
  const nextRoute = cloneRoute(route);

  if (nextRun.status !== 'in-progress') {
    return {
      run: nextRun,
      route: {
        ...nextRoute,
        pendingNodeChoices: []
      }
    };
  }

  if (nextRun.currentNode >= nextRun.maxNodes) {
    return {
      run: {
        ...nextRun,
        status: 'victory'
      },
      route: {
        ...nextRoute,
        pendingNodeChoices: [],
        nextBattleContext: null
      }
    };
  }

  return {
    run: nextRun,
    route: {
      ...nextRoute,
      pendingNodeChoices: buildNextNodeCandidates(nextRun, pressureProfile),
      nextBattleContext: null
    }
  };
}

export function selectShortRunRouteNode(
  run: RunState,
  route: ShortRunRouteState,
  candidateId: string
): ShortRunRouteResult {
  const selected = route.pendingNodeChoices.find((candidate) => candidate.id === candidateId);

  if (!selected) {
    throw new Error(`Unknown short-run route node candidate: ${candidateId}`);
  }

  const nextRun = {
    ...cloneRun(run),
    currentNode: selected.toNode
  };
  const context = cloneContext(selected.nextBattleContext);

  return {
    run: nextRun,
    route: {
      pendingNodeChoices: [],
      nextBattleContext: context,
      history: [
        ...route.history.map((entry) => ({
          ...entry,
          context: cloneContext(entry.context)
        })),
        {
          fromNode: selected.fromNode,
          toNode: selected.toNode,
          selectedRouteId: selected.id,
          context
        }
      ]
    }
  };
}
