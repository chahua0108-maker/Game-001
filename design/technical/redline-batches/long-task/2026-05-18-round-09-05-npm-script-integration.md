# 2026-05-18 Round 09 Expert 05: NPM Script Integration Engineer

Role: Round 09 Expert 05, NPM Script Integration Engineer  
Workdir: `/Users/roc/Game-001`  
Scope: review `prototype-web/package.json` and dependency shape; recommend npm script integration for build, unit tests, and browser QA.  
Boundary: documentation only; do not edit source, do not commit, do not rollback.

## 0. Current Package Surface

`prototype-web/package.json` currently exposes only the basic Vite/Vitest loop:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "three": "^0.164.1"
  },
  "devDependencies": {
    "@types/three": "^0.164.1",
    "typescript": "^5.4.5",
    "vite": "^5.2.11",
    "vitest": "^1.6.0"
  }
}
```

Installed package reality is compatible with the lockfile but newer after resolution:

```text
three 0.164.1
@types/three 0.164.1
typescript 5.9.3
vite 5.4.21
vitest 1.6.1
```

The package lock does not contain `playwright`, `@playwright/test`, `jsdom`, or `happy-dom` as project-installed dependencies. `vitest` lists optional DOM environments, but this project is configured with `environment: 'node'` and `include: ['src/tests/**/*.test.ts']`.

## 1. Decision

Recommend adding a small set of npm scripts, but do not add Playwright to project dependencies yet.

Use project npm scripts for stable repo-owned contracts:

- `check`: one command for CI-like local validation.
- `test:sim`: fast runtime/simulation tests.
- `test:ui`: existing UI unit tests under Vitest, not browser automation.
- `dev:qa`: stable localhost server command for browser workers.
- optional `build:strict`: alias only if later docs want a name that separates TypeScript/Vite build from generic `build`.

Use external gstack Playwright/browser tooling for exploratory and long-task browser QA until the browser acceptance flow is stable enough to live in the repo.

Do not make `npm test` launch browsers. Keep `npm test` deterministic, fast, and dependency-light.

## 2. Minimal Script Patch Recommended Later

When the implementation owner is allowed to edit `package.json`, the minimal patch should be:

```json
{
  "scripts": {
    "dev": "vite",
    "dev:qa": "vite --host 127.0.0.1 --port 5174",
    "build": "tsc && vite build",
    "check": "npm run test && npm run build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:sim": "vitest run src/tests/sim",
    "test:ui": "vitest run src/tests/ui"
  }
}
```

Rationale:

| Script | Keep/Add | Reason |
| --- | --- | --- |
| `dev` | Keep | Default developer server remains standard Vite. |
| `dev:qa` | Add | Browser workers need a stable host/port without remembering flags. Existing QA docs already use `127.0.0.1:5174`. |
| `build` | Keep | Current `tsc && vite build` is the right full production gate. |
| `check` | Add | Long-task implementers need one command for "unit contracts plus build". |
| `test` | Keep | Do not break existing docs that call `npm test` or `npm run test -- ...`. |
| `test:watch` | Keep | Useful for local iteration and already present. |
| `test:sim` | Add | Most redline contracts are simulation/runtime tests; this gives workers a narrow command. |
| `test:ui` | Add | Keeps Vitest UI/HUD tests distinct from browser QA. |

Do not add `test:browser` yet. That name implies repo-owned Playwright tests and should not exist until there is a committed script under `prototype-web/scripts/` or `prototype-web/e2e/`.

## 3. Browser QA Integration Recommendation

### 3.1 Near-term: external gstack runner

Use external gstack browser/QA for Round 09 browser acceptance because:

- the project has no Playwright dependency today;
- long-task docs already require screenshots, DOM rect JSON, console error capture, and cleanup records;
- adding `@playwright/test` would add package-lock churn and browser install assumptions before the browser route is stable;
- gstack browse is already available outside the project and can drive Vite via `npm run dev:qa` once that script exists.

Recommended execution shape after `dev:qa` is added:

```bash
cd /Users/roc/Game-001/prototype-web
npm run dev:qa
```

Then a QA worker can drive the running app with external browser tooling and write evidence to:

```text
outputs/browser-qa/round-09/
```

Committed conclusions should still land in:

```text
design/technical/redline-batches/long-task/
```

The npm package should not depend on gstack. gstack is an agent-side harness, not app runtime or app test infrastructure.

### 3.2 Later: project-owned Playwright

Add project-owned Playwright only when all of these are true:

1. There is a stable deterministic QA fixture or seed path for reward/combat states.
2. The browser route is expected to run repeatedly by non-gstack agents or humans.
3. The repository wants CI or pre-merge browser acceptance, not only exploratory screenshots.
4. The test script can clean up its own Vite server, contexts, pages, screenshots, traces, and temporary artifacts.

When those conditions are met, add:

```bash
cd /Users/roc/Game-001/prototype-web
npm install -D @playwright/test
npx playwright install chromium
```

Then add a repo-owned script surface:

```json
{
  "scripts": {
    "test:browser": "playwright test",
    "test:browser:ui": "playwright test --ui",
    "test:browser:headed": "playwright test --headed"
  }
}
```

Suggested paths:

```text
prototype-web/playwright.config.ts
prototype-web/e2e/redline-mobile-overflow.spec.ts
prototype-web/e2e/redline-reward-prep-route.spec.ts
prototype-web/e2e/fixtures/redlineWorld.ts
```

Do not put browser specs under `src/tests/`; that directory is already Vitest-owned and configured for Node tests.

## 4. Script Path Policy

The clean split should be:

| Concern | Path | Runner |
| --- | --- | --- |
| Pure sim/runtime contracts | `prototype-web/src/tests/sim/*.test.ts` | `vitest` / `npm run test:sim` |
| Lightweight HUD/unit contracts | `prototype-web/src/tests/ui/*.test.ts` | `vitest` / `npm run test:ui` |
| Manual or gstack browser probes | `outputs/browser-qa/...` for raw evidence, summarized into `design/technical/...` | external gstack browser |
| Future committed browser specs | `prototype-web/e2e/*.spec.ts` | `@playwright/test` / `npm run test:browser` |
| Future browser helpers | `prototype-web/e2e/fixtures/*.ts` | imported by Playwright specs |

Avoid `prototype-web/scripts/browser-qa/*.mjs` unless the project intentionally wants custom Playwright or Puppeteer scripts without the Playwright test runner. If browser QA becomes permanent, `e2e/` plus `playwright.config.ts` is easier to maintain and clearer to future agents.

## 5. Dependency Recommendation

Current dependencies should remain unchanged for Round 09 script cleanup:

- Runtime dependency: keep only `three`.
- Dev dependencies: keep `typescript`, `vite`, `vitest`, `@types/three`.
- Do not add `jsdom` or `happy-dom` unless a Vitest test genuinely needs DOM APIs. Current UI tests appear to be source-level/HUD contract tests under Node, so adding a DOM environment now would be premature.
- Do not add `@playwright/test` just to satisfy manual browser QA docs. Add it only with committed `e2e/` specs.

This keeps install cost low and avoids mixing agent harness dependencies with the playable web prototype.

## 6. CI / Worker Command Contract

For implementation workers, the recommended command contract after scripts are added is:

```bash
cd /Users/roc/Game-001/prototype-web
npm run test:sim -- src/tests/sim/redline-paper-shatter-topdeck.test.ts
npm run test:ui
npm run check
```

For browser QA workers:

```bash
cd /Users/roc/Game-001/prototype-web
npm run dev:qa
```

Then drive the browser externally and record:

- actual URL and port;
- viewport list;
- screenshots;
- DOM rect JSON;
- console/page errors;
- cleanup status for page, context, browser, and dev server.

The browser pass should be marked failed if cleanup is incomplete, even when screenshots look correct.

## 7. Risks If Scripts Are Not Added

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Each worker hand-types Vite flags | Port drift and inconsistent QA records | Add `dev:qa`. |
| Browser QA gets confused with `npm test` | Slow or flaky validation loop | Keep browsers out of `npm test`. |
| External gstack becomes an implicit app dependency | New agents may try to install gstack into the package | Document gstack as external harness only. |
| Playwright is added before fixtures stabilize | Lockfile churn, browser binary setup, fragile specs | Delay `@playwright/test` until `e2e/` routes are deterministic. |
| Sim and UI tests remain one undifferentiated bucket | Workers run too much or too little | Add `test:sim` and `test:ui`. |

## 8. Final Recommendation

For the next allowed source/package edit, add only these package scripts:

```text
dev:qa
check
test:sim
test:ui
```

Do not add dependencies in that same change. Keep browser automation external via gstack for this round. Revisit `@playwright/test` only after the project has stable browser fixtures and wants committed `prototype-web/e2e/` specs.

STATUS: DONE
