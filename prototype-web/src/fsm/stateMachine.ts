import type { CharacterState, Command, EntityId, GameFlowState, TraceId, WorldState } from '../sim/types';

export function setGameFlowState(
  world: WorldState,
  state: GameFlowState,
  reason: string,
  traceId: TraceId
): Command[] {
  if (world.fsm.gameFlow === state) {
    return [];
  }

  return [
    {
      type: 'SetGameFlowState',
      traceId,
      state,
      reason
    }
  ];
}

export function setCharacterState(
  world: WorldState,
  entityId: EntityId,
  state: CharacterState,
  reason: string,
  traceId: TraceId
): Command[] {
  if (world.fsm.characters[entityId] === state) {
    return [];
  }

  return [
    {
      type: 'SetCharacterState',
      traceId,
      entityId,
      state,
      reason
    }
  ];
}
