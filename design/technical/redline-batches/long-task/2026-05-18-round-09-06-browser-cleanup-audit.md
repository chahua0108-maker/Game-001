# 2026-05-18 Round 09 Expert 06: Browser Cleanup Auditor

Role: Browser Cleanup Auditor  
Workdir: `/Users/roc/Game-001`  
Scope: audit and specify cleanup requirements for later browser acceptance scripts.  
Boundary: documentation only; do not edit source, do not commit, do not rollback, do not open a browser from this task.

## 0. Verdict

Browser cleanup must be promoted from "after test hygiene" to a hard acceptance gate.

For the user's requirement "验收后关闭网页", a browser QA run is not `PASS` until the script proves all resources it opened were closed:

1. `page.close()` attempted for every QA-created page.
2. `context.close()` attempted for every QA-created context.
3. `browser.close()` attempted for the QA-launched browser instance.
4. The dev/preview server started by the QA script is stopped.
5. The chosen port and known PID are no longer alive.
6. The final metrics file records cleanup status.

Gameplay evidence can only make the run `functional-pass-cleanup-fail` if cleanup fails. It cannot be a clean pass.

## 1. Current Cleanup Contract From Existing Redlines

Existing Round 06 to Round 08 QA docs already establish the core discipline:

| Existing direction | Cleanup implication |
| --- | --- |
| Browser QA must close page / context / browser / dev server. | Cleanup is part of the acceptance result, not an optional postscript. |
| Scripts should use `try/finally`. | Every assertion failure must still flow through teardown. |
| QA records must include `page closed / context closed / browser closed / dev server stopped`. | Cleanup must be machine-readable and reviewable. |
| If a browser cannot be closed automatically, the run is at most `partial`. | Later workers must not mark gameplay success as full pass when cleanup fails. |
| Long-task workers run in parallel. | Leaked pages, servers, or ports can contaminate other agents' evidence. |

Round 09 should turn this into one reusable rule: every browser acceptance script owns a resource ledger, and teardown closes that ledger in reverse dependency order.

## 2. Required Script Shape

Use one top-level owner for the browser run. Do not scatter `launch`, `newContext`, `newPage`, and server start calls across helpers without returning cleanup handles.

Recommended control flow:

```ts
const cleanup = createCleanupLedger();
let result: BrowserQaResult = { status: "started", cleanup: {} };

try {
  const server = await startQaServer({ preferredPort: 5174 });
  cleanup.addServer(server);

  const browser = await chromium.launch({ headless: false });
  cleanup.addBrowser(browser);

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  cleanup.addContext(context);

  const page = await context.newPage();
  cleanup.addPage(page);

  await page.goto(server.url, { waitUntil: "networkidle", timeout: 15_000 });

  result = await runAcceptanceRoute({ page, server });
} catch (error) {
  result.status = "failed-before-cleanup";
  result.error = serializeError(error);
} finally {
  result.cleanup = await cleanup.closeAll({
    timeoutMs: 10_000,
    verifyPortClosed: true,
    verifyPidClosed: true,
  });

  result.status = classifyFinalStatus(result.status, result.cleanup);
  await writeQaMetrics(result);
}
```

Important details:

- `cleanup.add*` should happen immediately after each resource is created.
- Helpers may create pages or contexts only if they register them in the same ledger.
- Cleanup must run after success, assertion failure, timeout, screenshot failure, or navigation failure.
- The metrics write should happen after cleanup so the final status cannot omit teardown evidence.

## 3. Close Order

Close resources in dependency order from narrowest to broadest:

1. Page
2. Context
3. Browser
4. Trace viewer or auxiliary Playwright process, if started
5. Dev server / preview server
6. Port and process verification

Reasoning:

- Closing the page first stops most in-page timers, WebSocket loops, event listeners, and pending screenshots.
- Closing the context next clears storage/session state and all pages created inside it.
- Closing the browser next releases the process tree controlled by Playwright.
- Stopping the dev server last keeps the app reachable while page/context close hooks resolve.
- Verification must happen after all close attempts, otherwise the script may report a false residual process.

Recommended implementation pattern:

```ts
async function closeAll(ledger: CleanupLedger): Promise<CleanupReport> {
  const report: CleanupReport = {};

  report.pages = await closeMany("page", ledger.pages, (page) => page.close());
  report.contexts = await closeMany("context", ledger.contexts, (context) => context.close());
  report.browsers = await closeMany("browser", ledger.browsers, (browser) => browser.close());
  report.servers = await closeMany("server", ledger.servers, (server) => server.stop());
  report.residuals = await checkResiduals(ledger);

  return report;
}
```

Each close attempt should be isolated. One failed `page.close()` must not skip `browser.close()` or `server.stop()`.

## 4. Timeout Policy

Cleanup needs its own timeout budget. Do not let a stuck close call hang the whole long-task worker.

| Operation | Recommended timeout | Failure action |
| --- | ---: | --- |
| `page.close()` | 2s per page | Record failure, continue to context close. |
| `context.close()` | 3s per context | Record failure, continue to browser close. |
| `browser.close()` | 5s | Record failure, attempt process-tree termination if the browser was launched by this script. |
| Dev server graceful stop | 5s | Escalate to `SIGTERM`, then verify PID/port. |
| Dev server forced stop | 3s after `SIGTERM` | Escalate to `SIGKILL` only for the PID started by this script. |
| Residual check | 3s | Record exact PID/port evidence. |

Use a timeout wrapper:

```ts
async function withTimeout<T>(label: string, timeoutMs: number, fn: () => Promise<T>): Promise<T> {
  return await Promise.race([
    fn(),
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}
```

Hard rule: never kill broad process names like `node`, `vite`, `Chrome`, or `chromium` globally. Only stop the PID tree the QA script started and recorded.

## 5. Server Ownership

The QA script must distinguish three cases:

| Case | Allowed action |
| --- | --- |
| Script starts a new dev server. | It owns the PID and must stop it. |
| Script reuses an already-running server by explicit user instruction. | It must not stop that server, but must record `serverOwned: false`. |
| Preferred port is occupied by an unknown process. | Use the next free port or fail early; do not kill the unknown process. |

Recommended server record:

```json
{
  "serverOwned": true,
  "command": "npm run dev -- --host 127.0.0.1 --port 5174",
  "cwd": "/Users/roc/Game-001/prototype-web",
  "pid": 12345,
  "url": "http://127.0.0.1:5174",
  "port": 5174
}
```

If the port was already occupied:

```json
{
  "preferredPort": 5174,
  "actualPort": 5175,
  "preferredPortOccupied": true,
  "preferredPortOwnerAction": "left untouched"
}
```

## 6. Residual Checks

After teardown, the script should run local checks and write the result into metrics. This is not about hunting every browser on the user's machine; it is about proving the QA-owned resources are gone.

Minimum checks:

| Check | Expected pass condition |
| --- | --- |
| Known server PID | PID no longer exists, unless `serverOwned: false`. |
| Known server port | No listener on the QA-owned port. |
| Browser process handle | Playwright reports disconnected / closed. |
| Page list | `context.pages()` is empty before or during context close, or context close succeeds. |
| Output metrics | `cleanup.status` is not missing. |

Suggested shell-level evidence for later worker logs:

```bash
lsof -nP -iTCP:5174 -sTCP:LISTEN
ps -p "$SERVER_PID" -o pid=,ppid=,command=
```

For process-tree verification, record the root PID created by the script. If using Node's `child_process.spawn`, start the server with a clear handle and stop that handle, not a name search.

## 7. Metrics Schema

Every browser acceptance output should include a cleanup block:

```json
{
  "cleanup": {
    "status": "pass",
    "pageClose": { "attempted": true, "ok": true, "count": 1 },
    "contextClose": { "attempted": true, "ok": true, "count": 1 },
    "browserClose": { "attempted": true, "ok": true },
    "serverStop": { "attempted": true, "ok": true, "owned": true, "pid": 12345, "port": 5174 },
    "residualCheck": {
      "pidAlive": false,
      "portListening": false,
      "qaBrowserResidual": false
    },
    "errors": []
  }
}
```

Allowed cleanup statuses:

| Status | Meaning |
| --- | --- |
| `pass` | All owned resources closed and residual checks passed. |
| `partial` | Close calls ran, but at least one non-owned or unverifiable artifact remains. |
| `fail` | Owned page/context/browser/server remains alive, or cleanup block could not be written. |

Final acceptance mapping:

| Gameplay result | Cleanup result | Final status |
| --- | --- | --- |
| pass | pass | `PASS` |
| pass | partial | `PARTIAL: cleanup unverifiable` |
| pass | fail | `FAIL: gameplay passed but cleanup failed` |
| fail | pass | `FAIL: gameplay failed, cleanup passed` |
| fail | fail | `FAIL: gameplay and cleanup failed` |

## 8. Signal Handling

Long browser QA scripts should install signal handlers so a user stop, test timeout, or orchestration abort still closes resources.

Recommended behavior:

```ts
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  await cleanup.closeAll({ reason: signal, timeoutMs: 10_000 });
  process.exit(signal === "SIGINT" ? 130 : 143);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
```

Do not install handlers that call `process.exit()` before async cleanup has a chance to run.

## 9. Anti-Patterns To Reject

| Anti-pattern | Risk |
| --- | --- |
| `await runAcceptance(); await browser.close();` without `finally` | Any assertion failure skips cleanup. |
| Closing only `browser`, not `page` and `context` | Loses fine-grained evidence; can leave context artifacts until forced browser exit. |
| Killing `node` / `vite` by process name | Can terminate unrelated agents or user work. |
| Reusing port `5174` without checking ownership | Later results may point at an old app build. |
| Reporting screenshots but no cleanup metrics | User cannot verify "验收后关闭网页". |
| Leaving headed Chrome open for manual inspection | Violates the explicit close-after-acceptance requirement. |
| Treating cleanup failure as warning | Pollutes later long-task workers and makes evidence unreliable. |

## 10. Recommended Acceptance Checklist

Before a later browser worker reports completion, it should answer these in the output file:

- Did the script create a cleanup ledger before launching browser resources?
- Were all pages, contexts, browsers, and servers registered immediately after creation?
- Did every failure path run `finally`?
- Was the close order `page -> context -> browser -> server`?
- Did every close operation have a bounded timeout?
- Was the dev server PID recorded?
- Was the chosen port recorded?
- Did the residual check prove the owned PID and port are gone?
- Does the metrics JSON include `cleanup.status`?
- If cleanup did not pass, did the final result downgrade from `PASS`?

## 11. Minimal Standard For Round 09 Follow-Up Scripts

Any Round 09 browser acceptance script should implement the following minimum:

```ts
try {
  await runBrowserAcceptance();
} finally {
  await closePages();
  await closeContexts();
  await closeBrowsers();
  await stopOwnedServers();
  await verifyNoOwnedResiduals();
  await writeCleanupMetrics();
}
```

This is the minimum shape, not the whole implementation. The production version should use a ledger, per-step timeout wrappers, isolated close errors, and final status downgrading.

## 12. Final Recommendation

Add one shared browser QA cleanup helper when implementation work begins. Every future Playwright or browser-worker script should import that helper instead of hand-writing teardown. The helper should own:

- resource registration;
- reverse-order close;
- per-resource timeout;
- server PID/port tracking;
- signal-triggered teardown;
- residual checks;
- metrics serialization;
- final status downgrade when cleanup fails.

Until that helper exists, reviewers should reject any browser acceptance script that does not visibly use `try/finally` and does not write cleanup metrics.

STATUS: DONE
