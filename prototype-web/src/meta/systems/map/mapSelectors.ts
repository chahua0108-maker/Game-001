import { longLoopConfig } from '../../../config/data/longLoopConfig';
import type { MapNodeConfig } from '../../../config/schema/definitions';
import { CANONICAL_MAP_NODE_IDS } from '../../../config/schema/ids';
import type { MapNodeId } from '../../../config/schema/ids';
import type { LongLoopProfile } from '../../profile/profileTypes';
import { areUnlockRulesSatisfied } from './unlockRuleEvaluator';

export type LongLoopPhaseName = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
export type MapNodeReadState = 'playable' | 'condition-visible' | 'locked-preview';

export interface MapNodeRead {
  readonly id: MapNodeId;
  readonly name: string;
  readonly tier: number;
  readonly nodeType: MapNodeConfig['nodeType'];
  readonly state: MapNodeReadState;
  readonly stageGoalPressure: MapNodeConfig['stageGoalPressure'] | null;
}

export function mapNodeReads(profile: LongLoopProfile, phase: LongLoopPhaseName): readonly MapNodeRead[] {
  const mapNodes: readonly MapNodeConfig[] = longLoopConfig.mapNodes;

  return mapNodes
    .filter((node) => isStageNode(node))
    .sort((left, right) => left.tier - right.tier)
    .map((node) => ({
      id: node.id,
      name: node.name,
      tier: node.tier,
      nodeType: node.nodeType,
      state: mapNodeState(node, profile, phase),
      stageGoalPressure: node.stageGoalPressure ?? null
    }));
}

export function playableMapNodeIds(profile: LongLoopProfile, phase: LongLoopPhaseName): readonly MapNodeId[] {
  return mapNodeReads(profile, phase)
    .filter((node) => node.state === 'playable')
    .map((node) => node.id);
}

function mapNodeState(node: MapNodeConfig, profile: LongLoopProfile, phase: LongLoopPhaseName): MapNodeReadState {
  if (node.id === CANONICAL_MAP_NODE_IDS.d1) {
    return 'playable';
  }

  if (isBackHalfNode(node) && phase !== 'P3' && phase !== 'P4') {
    return 'locked-preview';
  }

  if (!areUnlockRulesSatisfied(node.unlockRuleIds, profile)) {
    return 'locked-preview';
  }

  if (profile.map.unlockedNodeIds.includes(node.id) || profile.map.completedNodeIds.includes(node.id)) {
    return 'playable';
  }

  return 'condition-visible';
}

function isStageNode(node: MapNodeConfig): boolean {
  return /^map\.d\d+$/.test(node.id);
}

function isBackHalfNode(node: MapNodeConfig): boolean {
  return /^map\.d(?:[5-9]|10)$/.test(node.id);
}
