# Redline 90s Batch 03 QA Plan

> Deprecated: 这是被用户否决的 `Redline 90s realtime heartbeat` 方向批次记录。当前有效方向是 `redline-hyperturn-acceptance.md`；本文只保留为失败路径证据，不再作为 runtime、HUD、QA 的执行依据。

Date: 2026-05-18
Role: QA Lead / Playtest & Evidence Lead
Scope: verification framework only. Runtime, HUD, VFX, and contract code may be edited by other workers; this plan does not change those files.

## QA Intent

This batch is not accepted because tests pass. It is accepted only if a fresh 90 second playtest produces evidence that the player can read the battlefield, kill quickly, feel pressure, reach or clearly approach a burst moment, and understand the trace when something fails.

Primary question: does the first 90 seconds feel like a playable Redline combat loop instead of a debug cockpit?

## Evidence Directory

Use:

- `/Users/roc/Game-001/outputs/browser-qa/redline-90s/2026-05-18/README.md`
- `/Users/roc/Game-001/outputs/browser-qa/redline-90s/2026-05-18/metrics-template.json`

Expected browser-worker additions after implementation lands:

- `desktop-initial.png`
- `desktop-30s.png`
- `desktop-90s.png`
- `mobile-390x844-initial.png`
- `mobile-390x844-30s.png`
- `mobile-390x844-90s.png`
- optional `desktop-trace.json`, `mobile-390x844-trace.json`, and console logs when available

## Desktop Smoke Checklist

Viewport: 1280x720 or 1440x900.

Pass requires every required item below to be checked from player-facing evidence, not only DOM or unit tests.

| ID | Required check | Evidence | Fail class if broken |
| --- | --- | --- | --- |
| D-01 | Page reaches an actionable combat state without manual debug setup. | initial screenshot and timestamp | implementation bug |
| D-02 | First attack input produces exactly one visible card/action result. | before/after screenshot or trace event pair | implementation bug |
| D-03 | First kill occurs inside the 90 second window; record exact time. | `firstKillTimeMs` plus screenshot/trace | hypothesis failed if no bug |
| D-04 | By 30 seconds, kill count is high enough to imply momentum, not one-off damage. | `killsAt30s` and combat feed/trace | hypothesis failed |
| D-05 | Some pressure is visible: HP loss, enemy attack, front row threat, warning, or forced decision. | screenshot plus `pressureObserved` note | hypothesis failed |
| D-06 | Burst is either triggered or visibly being built toward with readable preconditions. | `burst.triggered` or `burst.nearMissReason` | acceptance conflict or hypothesis failed |
| D-07 | HUD does not dominate the playfield; battlefield remains the primary read. | annotated screenshot and `hud.obstruction` | implementation bug |
| D-08 | Trace/debug information is readable enough to diagnose a bad result without replacing the combat view. | trace screenshot or exported event sample | evidence missing |
| D-09 | Restart/end-turn/main card controls are clickable and not covered by overlays. | click result notes | implementation bug |
| D-10 | No console error, blank WebGL scene, or frozen state occurs during the pass. | console summary and final screenshot | implementation bug |
| D-11 | After evidence capture, close every opened page/tab/local URL and stop the dev server or any long-running process started for this QA pass. | cleanup note with process/page status | scope drift |

Desktop acceptance note: a pass with no pressure is not a pass. If the player can calmly inspect UI for 90 seconds without threat or payoff, classify as `hypothesis failed`.

## Mobile Smoke Checklist

Viewport: 390x844.

This pass is stricter on obstruction because the previous mobile issue was a real control overlap, not cosmetic polish.

| ID | Required check | Evidence | Fail class if broken |
| --- | --- | --- | --- |
| M-01 | Page reaches an actionable combat state at 390x844 without horizontal-only layout assumptions. | initial screenshot | implementation bug |
| M-02 | Primary card/action control can be tapped once without double-fire or miss. | tap coordinates and before/after state | implementation bug |
| M-03 | End turn and restart are both reachable or intentionally unavailable with clear product rationale. | element hit result and screenshot | implementation bug or acceptance conflict |
| M-04 | HUD does not cover the current target, card row, HP/pressure read, or burst state. | screenshot with obstruction rating | implementation bug |
| M-05 | First kill time is captured in the same way as desktop. | `firstKillTimeMs` | evidence missing |
| M-06 | 30 second kill count is captured. | `killsAt30s` | evidence missing |
| M-07 | Pressure is visible without relying on tiny debug text. | note and screenshot | hypothesis failed |
| M-08 | Burst triggered, or the build-up is clear enough to explain why it did not trigger. | burst fields | hypothesis failed or acceptance conflict |
| M-09 | Trace/debug can be opened/read without making the playable surface unusable. | trace readability note | implementation bug |
| M-10 | Text fits within buttons/cards; no unreadable truncation of critical combat labels. | screenshot and note | implementation bug |
| M-11 | After evidence capture, close every opened page/tab/local URL and stop the dev server or any long-running process started for this QA pass. | cleanup note with process/page status | scope drift |

Mobile acceptance note: if the combat technically works but the HUD hides the target or buttons, mark `implementation bug`, not visual polish.

## 90 Second Metrics

Each 90 second run must record:

- `firstKillTimeMs`: first enemy death time from page-ready or first actionable state. If no kill, set null and explain.
- `killsAt30s`: total kills by 30000 ms.
- `killsAt90s`: total kills by 90000 ms.
- `pressureObserved`: whether the player was under visible threat. Include evidence type: HP loss, enemy attack animation, proximity, warning, forced end-turn, or other.
- `burst.triggered`: whether Severance Burst or equivalent clear/big payoff happened.
- `burst.firstTriggerTimeMs`: time if triggered.
- `burst.nearMissReason`: if not triggered, record whether the blocker was shard count, energy, card draw, target rules, unclear HUD, or bug.
- `hud.obstruction`: desktop/mobile obstruction rating and what it covered.
- `trace.readability`: whether a player/QA worker can connect input -> rule -> damage/kill/reward from trace.
- `trace.lastReadableEvent`: last event that can be understood without source-code inspection.
- `inputIntegrity`: whether single tap/click maps to one action.
- `consoleErrors`: count and key message snippets.
- `screenshots`: exact filenames captured.

## Failure Categories

Use one primary class per failure; add secondary notes if needed.

| Category | Meaning | Example |
| --- | --- | --- |
| implementation bug | The agreed behavior should work, but code/UI/rendering/input fails. | mobile restart is covered; one click plays two cards; WebGL blank screen |
| acceptance conflict | Two acceptance sources disagree or the intended product rule is unresolved. | tests expect linear refill while design expects column refill |
| hypothesis failed | Implementation may be correct, but the 90 second experience is not fun/readable/pressured enough. | no visible pressure by 90s; burst never matters |
| evidence missing | A claim cannot be verified from screenshots, trace, metrics, or logs. | "felt good" with no kill count or timestamp |
| scope drift | A worker changed behavior outside the batch goal or outside their allowed file ownership. | HUD worker rewrites runtime rules; QA edits gameplay code |

## Commands For Main Thread Or Browser Worker

Do not run these until code changes land and a browser worker is assigned.

```bash
cd /Users/roc/Game-001/prototype-web
npm run test -- src/tests/sim/redline-90s-acceptance.test.ts
npm run test
npm run build
npm run dev -- --host 127.0.0.1 --port 5174
```

Browser worker pass, after the dev server is already running:

```bash
# Desktop smoke target
open http://127.0.0.1:5174/

# Required viewports for automation or manual capture
# desktop: 1280x720 or 1440x900
# mobile: 390x844
```

Suggested Playwright/browser actions:

1. Capture initial screenshot after the page reaches an actionable combat state.
2. Play normally for 30 seconds using visible controls, not hidden state injection.
3. Record kill count, pressure state, burst state, HUD obstruction, trace readability.
4. Capture a 30 second screenshot.
5. Continue to 90 seconds or until a blocking failure occurs.
6. Capture final screenshot, console errors, and trace/exported event sample if available.
7. Fill `/Users/roc/Game-001/outputs/browser-qa/redline-90s/2026-05-18/metrics-template.json`.
8. Close every opened browser page/tab/local URL and stop the dev server or any long-running process started for the pass.

## QA Gate

Batch 03 is QA-pass only when:

- desktop and 390x844 smoke checklists are completed;
- the metrics JSON is filled for both runs;
- every failure has one of the five categories above;
- screenshots or traces exist for each pass/fail claim;
- the cleanup step confirms no QA-opened page, tab, local URL, dev server, or long-running process was left behind;
- no worker has used QA evidence to silently redefine the acceptance target.
