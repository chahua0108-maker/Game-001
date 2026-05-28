import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const forbiddenRuntimeImports = [
  '../../meta/profile',
  '../meta/profile',
  'meta/profile',
  '../../meta/systems/shop',
  '../meta/systems/shop',
  'meta/systems/shop',
  '../../meta/systems/achievements',
  '../meta/systems/achievements',
  'meta/systems/achievements',
  '../../meta/orchestrator',
  '../meta/orchestrator',
  'meta/orchestrator'
] as const;

function runtimeSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, '../../sim/runtime.ts'), 'utf8');
}

function importSpecifiers(source: string): readonly string[] {
  const fromImports = Array.from(source.matchAll(/\bimport(?:\s+type)?[\s\S]*?\sfrom\s+['"]([^'"]+)['"]/g), (match) => match[1]);
  const sideEffectImports = Array.from(source.matchAll(/\bimport\s+['"]([^'"]+)['"]/g), (match) => match[1]);
  const dynamicImports = Array.from(source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g), (match) => match[1]);

  return [...fromImports, ...sideEffectImports, ...dynamicImports];
}

describe('combat runtime boundary', () => {
  it('scans static, side-effect, and dynamic import specifiers', () => {
    const source = `
      import { createProfileStore } from '../../meta/profile/profileStore';
      import '../meta/systems/shop/register';

      const achievements = await import('../../meta/systems/achievements');
      const orchestrator = import(
        '../../meta/orchestrator/longLoopOrchestrator'
      );
    `;

    expect(importSpecifiers(source)).toEqual(
      expect.arrayContaining([
        '../../meta/profile/profileStore',
        '../meta/systems/shop/register',
        '../../meta/systems/achievements',
        '../../meta/orchestrator/longLoopOrchestrator'
      ])
    );
  });

  it('does not import meta profile, shop, achievements, or orchestrator systems', () => {
    const runtimeImports = importSpecifiers(runtimeSource());

    for (const forbiddenImport of forbiddenRuntimeImports) {
      expect(runtimeImports, `runtime.ts must not import ${forbiddenImport}`).not.toContain(forbiddenImport);
    }

    for (const runtimeImport of runtimeImports) {
      expect(runtimeImport, `runtime.ts import ${runtimeImport} crosses the combat/meta boundary`).not.toMatch(
        /(?:^|\/)meta\/(?:profile|systems\/shop|systems\/achievements|orchestrator)(?:\/|$)/
      );
    }
  });
});
