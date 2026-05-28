import { longLoopConfig } from '../../config/data/longLoopConfig';
import type { StarterKitId } from '../../config/schema/ids';
import type { StarterKitConfig } from '../../config/schema/definitions';
import { toCanonicalStarterKitId } from '../systems/starter/starterSelectors';
import type { RunStartStarterPayload } from './orchestratorTypes';

interface RunStartStarterPayloadInput {
  readonly selectedStarterKitId: StarterKitId;
  readonly starterKitIds: readonly StarterKitId[];
}

export function createRunStartStarterPayload(snapshot: RunStartStarterPayloadInput): RunStartStarterPayload {
  const selectedStarterKitId = toCanonicalStarterKitId(snapshot.selectedStarterKitId);
  const starterKit = starterKitById(selectedStarterKitId);
  if (!starterKit) {
    throw new Error(`Missing starter kit config ${selectedStarterKitId}`);
  }
  const starterCardIds = [...starterKit.runStartDeckModifier.starterCardIds];

  return {
    selectedStarterKitId,
    availableStarterKitIds: snapshot.starterKitIds.map((starterKitId) => toCanonicalStarterKitId(starterKitId)),
    deckModifierId: starterKit.runStartDeckModifier.id,
    grantedCardIds: [...starterCardIds],
    starterCardIds,
    deckMutationBoundary: 'adapter_payload_only'
  };
}

function starterKitById(starterKitId: StarterKitId): StarterKitConfig | undefined {
  return longLoopConfig.starterKits.find((starterKit) => starterKit.id === starterKitId);
}
