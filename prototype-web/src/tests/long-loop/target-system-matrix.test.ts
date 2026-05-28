import { describe, expect, it } from 'vitest';

import { acceptanceMatrix } from '../../meta/orchestrator/acceptanceMatrix';
import {
  missingRequiredMatrixEvidenceFields,
  requiredMatrixEvidenceFields,
  requiredTargetSystems,
  type AcceptanceMatrixRow
} from './testFixtures';

describe('long-loop target-system acceptance matrix', () => {
  it('covers every P2 target system instead of only the P0 playable slice', () => {
    const coveredSystems = new Set(acceptanceMatrix.map((row: AcceptanceMatrixRow) => row.targetSystem));

    expect([...coveredSystems].sort()).toEqual([...requiredTargetSystems].sort());
  });

  it('requires durable evidence fields for every target-system row', () => {
    for (const row of acceptanceMatrix as readonly AcceptanceMatrixRow[]) {
      expect(
        missingRequiredMatrixEvidenceFields(row),
        `${row.targetSystem} must define ${requiredMatrixEvidenceFields.join(', ')}`
      ).toEqual([]);
    }
  });
});
