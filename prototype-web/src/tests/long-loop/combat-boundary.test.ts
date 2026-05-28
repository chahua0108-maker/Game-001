import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ts from 'typescript';
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
  const sourceFile = ts.createSourceFile('runtime-import-scan.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const specifiers: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }

    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [moduleSpecifier] = node.arguments;

      if (
        moduleSpecifier &&
        (ts.isStringLiteral(moduleSpecifier) || ts.isNoSubstitutionTemplateLiteral(moduleSpecifier))
      ) {
        specifiers.push(moduleSpecifier.text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return specifiers;
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
      const profile = import(\`../../meta/profile/templateStore\`);
    `;

    expect(importSpecifiers(source)).toEqual(
      expect.arrayContaining([
        '../../meta/profile/profileStore',
        '../meta/systems/shop/register',
        '../../meta/systems/achievements',
        '../../meta/orchestrator/longLoopOrchestrator',
        '../../meta/profile/templateStore'
      ])
    );
  });

  it('ignores forbidden import text inside comments and strings', () => {
    const source = `
      // import { createProfileStore } from '../../meta/profile/profileStore';
      /* import '../meta/systems/shop/register'; */

      const commentedDynamicImport = "await import('../../meta/systems/achievements')";
      const example = "import('../../meta/orchestrator/longLoopOrchestrator')";
    `;

    expect(importSpecifiers(source)).toEqual([]);
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
