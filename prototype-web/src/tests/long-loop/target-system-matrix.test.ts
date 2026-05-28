import { describe, expect, it } from 'vitest';

import { acceptanceMatrix } from '../../meta/orchestrator/acceptanceMatrix';
import { createDefaultProfile } from '../../meta/profile/createProfile';
import {
  missingRequiredMatrixEvidenceFields,
  requiredMatrixEvidenceFields,
  requiredTargetConfigSources,
  requiredTargetSystems,
  type AcceptanceMatrixRow
} from './testFixtures';

describe('long-loop target-system acceptance matrix', () => {
  it('covers every human-readable target system from the implementation plan', () => {
    const coveredSystems = new Set(acceptanceMatrix.map((row: AcceptanceMatrixRow) => row.system ?? row.targetSystem));

    expect([...coveredSystems].sort()).toEqual([...requiredTargetSystems].sort());
  });

  it('requires durable evidence fields for every target-system row', () => {
    for (const row of acceptanceMatrix as readonly AcceptanceMatrixRow[]) {
      expect(
        missingRequiredMatrixEvidenceFields(row),
        `${row.system ?? row.targetSystem} must define ${requiredMatrixEvidenceFields.join(', ')}`
      ).toEqual([]);
    }
  });

  it('keeps target config table coverage as evidence rather than replacing the target-system matrix', () => {
    const configSources = new Set(acceptanceMatrix.flatMap((row) => toEvidenceList(row.configSource)));

    for (const configSource of requiredTargetConfigSources) {
      expect(configSources.has(configSource), `${configSource} must appear in matrix configSource evidence`).toBe(true);
    }
  });

  it('only cites profileFields that exist on the default long-loop profile schema', () => {
    const defaultProfile = createDefaultProfile();
    const missingProfileFields = acceptanceMatrix.flatMap((row) =>
      row.profileFields
        .filter((profileField) => !profilePathExists(defaultProfile, profileField))
        .map((profileField) => `${row.system}: ${profileField}`)
    );

    expect(missingProfileFields).toEqual([]);
  });
});

function toEvidenceList(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => toEvidenceList(entry));
  }

  return typeof value === 'string' ? [value] : [];
}

function profilePathExists(profile: unknown, profileField: string): boolean {
  let current: unknown = profile;

  for (const segment of profileField.split('.')) {
    if (!isRecord(current) || !(segment in current)) {
      return false;
    }

    current = current[segment];
  }

  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
