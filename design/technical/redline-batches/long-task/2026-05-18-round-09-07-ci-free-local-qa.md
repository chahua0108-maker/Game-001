# 2026-05-18 Round 09-07: CI-Free Local QA Designer

Role: Round 09 Expert 07, CI-Free Local QA Designer  
Workdir: `/Users/roc/Game-001`  
Scope: design a local-only long-task acceptance command sequence for `prototype-web`: test, build, dev server health check, browser QA, and fast failure triage.  
Boundary: documentation only; do not edit source, do not commit, do not rollback.

## 0. Intent

This QA route assumes there is no CI gate and no permanent browser test runner in the repo. Acceptance must therefore be reproducible from a clean local shell and must leave enough evidence for the main thread to decide whether a long-task slice is shippable, blocked by implementation, or missing evidence.

The current available project scripts are:

```bash
cd /Users/roc/Game-001/prototype-web
npm run test
npm run build
npm run dev -- --host 127.0.0.1 --port 5174
```

There is no repo script for Playwright or e2e at this point. Browser QA should be treated as a manual or browser-worker pass against the Vite dev server, not as an assumed package command.

## 1. Local Gate Sequence

Run the gates in this order. Do not skip ahead after a failure; later gates often produce misleading noise when an earlier contract is already broken.

```bash
cd /Users/roc/Game-001/prototype-web

# 1. Mechanic and helper regression gate.
npm run test

# 2. TypeScript and production bundle gate.
npm run build

# 3. Local app server gate. Keep this terminal open until browser QA is complete.
npm run dev -- --host 127.0.0.1 --port 5174
```

In a second terminal:

```bash
# 4. Confirm the dev server is reachable before opening browser QA.
curl -I http://127.0.0.1:5174/

# Optional deeper static asset check after build.
ls -lah dist
```

Expected `curl` result: HTTP 200 or Vite-compatible success response. A refused connection means the browser pass is invalid; fix server startup first.

## 2. Test Gate

Command:

```bash
cd /Users/roc/Game-001/prototype-web
npm run test
```

Pass condition:

- Vitest exits with code 0.
- Known skipped tests are explicitly visible and not silently counted as coverage.
- Failures are tied to a specific simulation, data contract, or HUD helper test file.

Fast triage:

| Symptom | First place to inspect | Likely owner |
| --- | --- | --- |
| `runtime.test.ts` or `runtime-audit.test.ts` fails | command/event ordering, energy, draw, enemy slot lifecycle | runtime |
| `redline-hyperturn-acceptance.test.ts` fails | 0-1-2 chain, authorization, payoff pressure | core loop contract |
| `redline-paper-shatter-topdeck.test.ts` fails | topdeck/preparation event evidence and reward flow | reorder/preparation runtime |
| `reward-branching` or `progression` fails | reward candidates, run deck mutation, node advance | progression layer |
| `hud-target-selection.test.ts` fails | pure HUD helper copy/state mapping, not CSS | UI helper |

If only one focused test is failing, reproduce it directly:

```bash
npm run test -- src/tests/sim/redline-paper-shatter-topdeck.test.ts
npm run test -- src/tests/ui/hud-target-selection.test.ts
```

Do not classify a browser-visible defect as fixed only because Node Vitest passes. Current Vitest does not compute CSS layout, viewport overflow, hit testing, canvas/WebGL visibility, or touch behavior.

## 3. Build Gate

Command:

```bash
cd /Users/roc/Game-001/prototype-web
npm run build
```

Pass condition:

- `tsc` exits cleanly.
- `vite build` exits cleanly.
- `dist/` is regenerated and contains `index.html` plus built assets.

Fast triage:

| Symptom | First question | Quick locator |
| --- | --- | --- |
| TypeScript error | Is the failure in runtime types, card data, or UI snapshot assumptions? | Read the first TS error, not the final cascade. |
| Vite import error | Did a file move or extension mismatch happen? | Check the unresolved import path from the first Vite error. |
| Build passes but browser is blank | Build gate is insufficient; move to dev server console and screenshot evidence. | Browser console plus page screenshot. |

If `npm run test` passes but `npm run build` fails, treat the build failure as release-blocking. The likely gap is an untested type surface or import path, not gameplay logic.

## 4. Dev Server Gate

Command:

```bash
cd /Users/roc/Game-001/prototype-web
npm run dev -- --host 127.0.0.1 --port 5174
```

Health check:

```bash
curl -I http://127.0.0.1:5174/
```

Pass condition:

- Vite reports the local URL.
- `curl` reaches the server.
- Browser opens `http://127.0.0.1:5174/`, not a stale file URL or a different port.
- The QA owner records the exact port used.

Fast triage:

| Symptom | Action |
| --- | --- |
| Port 5174 already in use | Use `--port 5175` and record the substituted URL in the QA evidence. |
| Server starts but `curl` fails | Check whether Vite bound to a different host/port. |
| Browser shows stale behavior | Hard refresh, confirm URL port, and verify the dev server terminal received the request. |
| Server terminal prints compile error | Browser QA is blocked; fix compile/runtime import first. |

Cleanup requirement: stop the dev server after QA with `Ctrl-C`. If the process was backgrounded by a worker, record how it was stopped.

## 5. Browser QA Gate

Browser QA is required because the project has real UI risk: mobile overflow, hidden combat feed, fixed/absolute panels, touch misfires, and gameplay evidence that cannot be trusted from Node tests alone.

Required viewports:

| Tier | Viewport | Purpose |
| --- | --- | --- |
| Desktop | `1366x768` | Full HUD, combat log, reward and debug readability. |
| Mobile primary | `390x844` | Main touch pass and card/reward readability. |
| Mobile hard gate | `360x640` | Small-screen overflow and control reachability. |

Minimum route for each viewport:

1. Open `http://127.0.0.1:5174/`.
2. Confirm the first actionable combat or deal state is visible.
3. Capture an initial screenshot.
4. Use real UI controls to deal/play/select/end turn; do not mutate hidden state from DevTools and call it a pass.
5. Reach a reward or preparation/topdeck state if the slice under test depends on it.
6. Capture the key before/after screenshots.
7. Record console errors.
8. Run overflow and hit-test probes when a browser worker is available.
9. Close every opened page/tab/local URL.
10. Stop any QA-started dev server.

Evidence naming convention:

```text
outputs/browser-qa/local-ci-free/YYYY-MM-DD/
  desktop-1366x768-initial.png
  desktop-1366x768-key-state.png
  mobile-390x844-initial.png
  mobile-390x844-key-state.png
  mobile-360x640-initial.png
  mobile-360x640-key-state.png
  console-summary.txt
  qa-notes.md
```

The evidence directory is a recommendation for the QA worker. This design task does not create it.

## 6. Browser Probe Checklist

Use these checks manually or through a browser worker.

Functional checks:

- Page reaches an actionable state without debug setup.
- One click or tap maps to one intended action.
- End Turn remains visible and clickable after card/reward/preparation flows.
- Reward selection closes the reward state and mutates the current run only.
- Preparation/topdeck feedback is visible to the player, not only hidden in debug.

Layout checks:

- No horizontal page overflow: `document.documentElement.scrollWidth <= window.innerWidth + 1`.
- Key panels stay inside the viewport: status strip, director, reward panel, card row, target panel.
- Clickable controls are not covered: `document.elementFromPoint(centerX, centerY)` resolves to the intended button or a child.
- Critical text is not clipped: card names, cost/role, reward summary, Director result token, End Turn consequence.
- Mobile does not depend on desktop-only combat feed for the main result.

Console checks:

- No uncaught exception.
- No asset 404 that affects visible UI.
- No repeated warning loop that floods the console during normal play.

## 7. Failure Classification

Use one primary class per failure.

| Class | Meaning | Example |
| --- | --- | --- |
| test failure | Node regression gate failed before browser QA. | `redline-paper-shatter-topdeck.test.ts` assertion fails. |
| build failure | TypeScript or Vite cannot produce a bundle. | Missing export, wrong import path, type mismatch. |
| server failure | Local app cannot be served reliably. | Port conflict, compile error in dev server, unreachable URL. |
| browser implementation bug | App loads, but agreed behavior is broken. | Reward does not add card; tap fires twice; End Turn is covered. |
| browser layout bug | Behavior may work, but UI is unreadable or clipped. | Mobile card row hides critical cost or Director result. |
| evidence missing | The claim has no screenshot, console note, or trace. | "Looks fine" without viewport proof. |
| acceptance conflict | The intended rule is disputed across docs/tests. | Test expects no preparation event while design requires one. |

## 8. Fast Locator Flow

When a failure happens, locate it by gate, not by guessing from symptoms.

```text
npm run test fails
  -> inspect failing test file and first assertion
  -> classify runtime/data/HUD-helper
  -> do not run browser QA as acceptance evidence yet

npm run build fails
  -> inspect first TypeScript or Vite error
  -> check whether tests missed a type/import surface
  -> browser QA is blocked

dev server fails
  -> confirm port, host, compile output, curl result
  -> browser screenshots are invalid until local URL is reachable

browser loads but interaction fails
  -> reproduce in desktop first
  -> then reproduce in 390x844 and 360x640
  -> collect screenshot, console, exact click/tap sequence

browser works on desktop but fails on mobile
  -> run overflow probe
  -> run hit-test center probe on visible controls
  -> inspect CSS/layout ownership before touching runtime

mechanic works in test but not browser
  -> inspect UI-to-intent mapping and snapshot fields
  -> verify the browser is not on a stale port
  -> compare visible state with event/debug evidence
```

## 9. Acceptance Definition

A long-task slice is locally accepted only when all of the following are true:

- `npm run test` passes or skipped tests are explicitly acknowledged as outside this slice.
- `npm run build` passes.
- Vite dev server is reachable through the recorded local URL.
- Desktop, `390x844`, and `360x640` browser passes have screenshots or notes for the key state.
- Console errors are recorded, even if the count is zero.
- Every failure is assigned one class from this document.
- Browser pages/tabs/local URLs are closed.
- The QA-started dev server is stopped.

STATUS: DONE
