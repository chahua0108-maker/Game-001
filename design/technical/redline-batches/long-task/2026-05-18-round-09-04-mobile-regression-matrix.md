# 2026-05-18 Round 09 Expert 04: Mobile Regression Matrix Lead

Role: Round 09 Expert 04, Mobile Regression Matrix Lead  
Workdir: `/Users/roc/Game-001`  
Boundary: documentation only; do not edit source, do not commit, do not rollback.  
Goal: define the desktop / `390x844` / `360x640` acceptance matrix, required flows, failure thresholds, and screenshot / JSON evidence retention rules for mobile regression.

## 0. Regression Intent

This matrix is the browser acceptance contract for the current redline prototype, not a generic visual pass. A run passes only if the same player-facing loop remains playable and readable across all required viewports:

1. Start or resume a clean combat state.
2. Read HP, MP, chain state, enemy intent, Director guidance, hand state, and End Turn consequence.
3. Play a normal `0 -> 1 -> 2` or documented valid route.
4. Exercise at least one reward choice.
5. Return to combat and verify the selected reward or run-state change is visible.
6. Exercise the newest round mechanic under review, such as preparation / topdeck, reward progression, authorization, repair, or pressure feedback.
7. Press End Turn once after the mechanic has resolved.
8. Close every browser page, local URL, tab, context, and QA-started server or process.

If a deterministic fixture is needed, the report must name it. DevTools-only state mutation is not acceptable evidence unless the run is explicitly classified as a debug-only failure reproduction.

## 1. Required Viewports

| Tier | Viewport | Gate type | Purpose | Pass meaning |
| --- | --- | --- | --- | --- |
| Desktop | `1366x768` minimum | Baseline gate | Full HUD density, combat log, debug/run panels, reward selection, event visibility. | Confirms the feature works without mobile compression hiding errors. |
| Mobile primary | `390x844` | Product gate | iPhone-like tall layout, thumb-scale taps, mobile-visible feedback, reward panel scroll. | Confirms the flow is genuinely playable by touch. |
| Mobile hard gate | `360x640` | Release blocker | Small Android short-height pressure, narrow copy budget, safe-area and rail pressure. | Confirms the feature survives the smallest required acceptance size. |

Optional extra captures such as `1280x720`, `360x780`, or device emulation can be kept, but they do not replace the three required tiers above.

## 2. Acceptance Matrix

| Area | Desktop `1366x768` | Mobile `390x844` | Mobile `360x640` | Blocker threshold |
| --- | --- | --- | --- | --- |
| Page bounds | No horizontal page overflow; main HUD panels inside viewport. | No horizontal page overflow; fixed HUD does not hide critical controls. | `max(documentElement.scrollWidth, body.scrollWidth) <= 361`. | Any body/page horizontal overflow on mobile. |
| Status strip | HP, MP, chain, intent, and authorization are readable without covering combat feed. | Core chips visible; details may be shortened but not lost. | Only short chips; XP/FSM/deck/restart must not return to first screen if previously hidden. | Chip text exits its pill or hides HP/MP/intent. |
| Director | Four desktop cells readable with short values. | At least current instruction/result readable without hover. | Short result token readable; no full sentence wrapping over adjacent UI. | Mechanic result exists only in hidden desktop log. |
| Hand rail | Desktop hand remains stable with normal card count; pressure count does not cover debug/run panels. | Horizontal rail remains scrollable; one tap fires one card. | Card button text stays within the card; rail remains reachable. | Card plays twice, wrong card fires, or End Turn is covered. |
| Card text | Role, cost, chain preview, intent preview, and payment state readable. | `.card-effect` may be hidden, but core effect must remain visible elsewhere. | Name/meta/preview/payment cannot rely on ellipsis for critical values. | Cost, draw count, authorization, preparation, or repair meaning disappears. |
| Reward flow | Reward choices visible; selected choice recorded; reward state exits. | Reward cards are single-column or otherwise touch-safe; last reward reachable. | Reward panel may internally scroll; page body must not scroll as the workaround. | Reward card cannot be selected or selected reward is not represented after exit. |
| New mechanic | Event, visible result, and next-state effect are evident. | Same result is visible in mobile-facing UI, not only logs. | Short-token version survives the small viewport. | Mechanic triggers internally but no player-readable result is visible. |
| End Turn | Preview and resolved state match after new mechanic. | Button is at least 44px tall and not overlapped. | Consequence text remains understandable before tap. | End Turn hidden, offscreen, ambiguous, or inconsistent after mechanic. |
| Logs/debug | Combat feed does not overlap run/debug/card row. | Hidden logs are allowed only if mobile has replacement feedback. | Hidden logs are expected; no required evidence may be mobile-log-only. | Desktop log overflows, or mobile acceptance depends on hidden log text. |
| Cleanup | All pages and QA-started processes closed. | Same. | Same. | Any dangling local page, browser context, dev server, or test process. |

## 3. Required Flow Set

Each full regression run must execute the same flow set for all three viewports. If time forces a reduced pass, `360x640` may use the shorter hard-gate sequence in section 3.4, but the report must mark it as reduced.

### 3.1 Flow A: Baseline Combat

Purpose: prove the current combat HUD is intact before testing the new mechanic.

Steps:

1. Open the app at the target viewport.
2. Start a fresh run or documented deterministic seed.
3. Capture initial combat.
4. Verify HP, MP, chain state, enemy intent, Director, hand, and End Turn preview.
5. Play one valid card.
6. Verify exactly one card-play event and one visible state update.
7. Capture the post-play state.

Required evidence: screenshot, JSON state summary, console error count.

### 3.2 Flow B: Chain And End Turn

Purpose: prove the ordinary `0 -> 1 -> 2` or equivalent route is still playable.

Steps:

1. From a player turn, play a valid chain route one card at a time.
2. After every tap/click, verify the intended card fired once.
3. Confirm MP and chain previews remain readable.
4. Capture the final pre-End-Turn state.
5. Press End Turn once.
6. Capture the resolved state.

Required evidence: screenshot before End Turn, screenshot after End Turn, event-count JSON.

### 3.3 Flow C: Reward Round Trip

Purpose: prove reward selection remains touch-safe and changes the run.

Steps:

1. Reach reward state through player route, seed, or named fixture.
2. Capture reward panel with all available choices.
3. Select one reward once.
4. Verify exactly one reward selection event.
5. Verify reward state exits.
6. Verify the selected card/modifier/progression is visible in the next combat, run deck, run panel, or equivalent player-facing surface.
7. Capture the next combat state.

Required evidence: reward screenshot, next-combat screenshot, selected reward id/name in JSON.

### 3.4 Flow D: Current Mechanic Under Review

Purpose: prove the newest implementation slice is accepted by behavior, not just by layout.

The run must include at least one current redline mechanic. Pick the one matching the implementation under test:

| Mechanic | Minimum visible evidence | Common failure |
| --- | --- | --- |
| Preparation / topdeck | `整备`, `整备3张`, `顶终结`, `下抽终结`, `整备无牌`, or approved short token plus next draw/route effect. | Result exists only in combat log or debug state. |
| Reward progression | Reward is offered, selected once, then represented in later combat/run state. | Reward closes but no later player-facing proof exists. |
| Authorization | `授权+N`, `授权付`, or `缺授权` visible at the payment moment. | Full rule text replaces short payment state and clips. |
| Repair / Wild | `修补`, `不断链`, `修补接xN`, `MP+1`, or equivalent short token visible while route remains legal. | Card appears playable but player cannot tell what was repaired. |
| Pressure / End Turn consequence | Pre-End-Turn consequence and post-End-Turn result match. | Preview says safe while resolution damages unexpectedly, or vice versa. |

### 3.5 Reduced `360x640` Hard-Gate Sequence

This reduced route is allowed only after desktop and `390x844` have completed the full flow set:

1. Initial combat screenshot.
2. One valid card play with event count.
3. Reward state screenshot.
4. Reward selected once.
5. Next combat screenshot showing selected reward/run change.
6. Current mechanic result screenshot.
7. End Turn preview and resolved screenshot.
8. Cleanup JSON.

If any of these are unavailable, the hard gate fails.

## 4. Failure Thresholds

### 4.1 P0 Blockers

Any P0 fails the entire regression run:

- Any required viewport is skipped.
- Any mobile viewport has body/page horizontal overflow.
- A required control is offscreen, overlapped, untappable, or under a transparent overlay.
- A single tap/click fires the wrong card, fires twice, or selects two rewards.
- Reward selection cannot be completed or cannot be proven in later state.
- Current mechanic has no player-readable visible feedback on mobile.
- End Turn is hidden, ambiguous, or behaviorally inconsistent after the mechanic.
- Console errors include uncaught exceptions, failed app boot, or repeated runtime state errors.
- Screenshot evidence is missing for a required state.
- JSON evidence lacks viewport, route, pass/fail, or cleanup fields.
- QA leaves a browser page/context/local URL/dev server/process running.

### 4.2 P1 Failures

P1 requires fix before accepting the specific slice, unless explicitly waived by the producer with a follow-up ticket:

- Text fits only by ellipsis while hiding cost, draw count, authorization, preparation, repair, or End Turn consequence.
- Desktop combat feed overlaps run/debug/card panels.
- Mobile feedback is technically present but too small or clipped to identify success versus miss.
- Reward panel is scrollable but the selected reward cannot be reached by normal touch scroll.
- `390x844` passes but `360x640` needs a non-player debug shortcut to reach the same state.
- The automated route uses DevTools mutation without labeling the run as debug-only.

### 4.3 P2 Issues

P2 does not block the matrix if P0/P1 are clean, but must be recorded:

- Minor copy inconsistency between desktop and mobile short tokens.
- Desktop-only debug fields wrap harmlessly outside player-critical surfaces.
- Optional extra viewport fails while the required three pass.
- Screenshot naming is imperfect but JSON links the files unambiguously.

## 5. DOM Probe Contract

Run equivalent probes after every required state capture. The report should store the returned object in the JSON evidence.

```js
(() => {
  const failures = [];
  const visible = (el) => {
    if (!el) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || '1') !== 0;
  };
  const pageWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  if (pageWidth > window.innerWidth + 1) {
    failures.push(`page horizontal overflow ${pageWidth} > ${window.innerWidth}`);
  }
  [
    ['status-strip', '.status-strip'],
    ['combat-director', '.combat-director'],
    ['deal-panel', '.deal-panel'],
    ['target-panel', '.target-panel'],
    ['run-layer-panel', '.run-layer-panel'],
    ['combat-feed', '.combat-feed'],
    ['reward-panel', '.reward-panel'],
    ['card-row', '.card-row']
  ].forEach(([name, selector]) => {
    const el = document.querySelector(selector);
    if (!visible(el)) return;
    const r = el.getBoundingClientRect();
    if (r.left < -1 || r.right > window.innerWidth + 1 || r.top < -1 || r.bottom > window.innerHeight + 1) {
      failures.push(`${name} outside viewport`);
    }
  });
  [
    '.combat-director strong',
    '.combat-director em',
    '.card-button strong',
    '.card-button .card-meta',
    '.card-button .chain-preview',
    '.card-button .card-intent-preview',
    '.card-button .missing-cost',
    '.card-button .authorization-cost',
    '.reward-card span',
    '.reward-card small',
    '.reward-card em',
    '.deal-panel small',
    '.deal-panel button',
    '.status-chip strong',
    '.status-chip span',
    '.combat-feed li'
  ].forEach((selector) => {
    document.querySelectorAll(selector).forEach((node, index) => {
      if (!visible(node)) return;
      if (node.scrollWidth > node.clientWidth + 1) {
        failures.push(`${selector}[${index}] horizontal clip: ${node.textContent.trim()}`);
      }
      if (node.scrollHeight > node.clientHeight + 1 && selector !== '.reward-card em') {
        failures.push(`${selector}[${index}] vertical clip: ${node.textContent.trim()}`);
      }
    });
  });
  return {
    ok: failures.length === 0,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    pageWidth,
    failureCount: failures.length,
    failures
  };
})();
```

## 6. Screenshot Evidence Rules

Store screenshots under a run-specific artifact folder. Recommended folder:

```text
artifacts/mobile-regression/YYYY-MM-DD-HHMM-round-09/
```

Required naming pattern:

```text
{viewport-slug}-{sequence}-{state}.png
```

Required files per viewport:

| Sequence | Desktop example | 390 example | 360 example |
| --- | --- | --- | --- |
| Initial combat | `desktop-1366x768-01-initial-combat.png` | `mobile-390x844-01-initial-combat.png` | `mobile-360x640-01-initial-combat.png` |
| Post first play | `desktop-1366x768-02-post-first-play.png` | `mobile-390x844-02-post-first-play.png` | `mobile-360x640-02-post-first-play.png` |
| Pre End Turn | `desktop-1366x768-03-pre-end-turn.png` | `mobile-390x844-03-pre-end-turn.png` | `mobile-360x640-03-pre-end-turn.png` |
| Post End Turn | `desktop-1366x768-04-post-end-turn.png` | `mobile-390x844-04-post-end-turn.png` | `mobile-360x640-04-post-end-turn.png` |
| Reward panel | `desktop-1366x768-05-reward-panel.png` | `mobile-390x844-05-reward-panel.png` | `mobile-360x640-05-reward-panel.png` |
| Reward return | `desktop-1366x768-06-reward-return.png` | `mobile-390x844-06-reward-return.png` | `mobile-360x640-06-reward-return.png` |
| Mechanic result | `desktop-1366x768-07-mechanic-result.png` | `mobile-390x844-07-mechanic-result.png` | `mobile-360x640-07-mechanic-result.png` |

Retention rules:

- Keep raw screenshots even if the run fails.
- Do not overwrite a failed run with a later passing run; create a new timestamped folder.
- Keep viewport dimensions in filenames and JSON.
- If a screenshot is intentionally skipped because the state is unreachable, store the failure reason in JSON and classify the run as failed.
- Cropped screenshots are not sufficient for required evidence; keep full viewport captures.

## 7. JSON Evidence Contract

Write one summary JSON per run:

```text
artifacts/mobile-regression/YYYY-MM-DD-HHMM-round-09/mobile-regression-summary.json
```

Minimum schema:

```json
{
  "runId": "2026-05-18-0904-mobile-regression",
  "startedAt": "ISO-8601 timestamp",
  "endedAt": "ISO-8601 timestamp",
  "appUrl": "http://localhost:PORT",
  "gitHead": "optional sha",
  "fixtureOrSeed": "name or null",
  "overallStatus": "pass | fail",
  "viewports": [
    {
      "tier": "desktop",
      "viewport": "1366x768",
      "status": "pass | fail",
      "flowsCompleted": ["baseline-combat", "chain-end-turn", "reward-round-trip", "current-mechanic"],
      "screenshots": [
        "desktop-1366x768-01-initial-combat.png"
      ],
      "eventCounts": {
        "cardPlayed": 0,
        "rewardChosen": 0,
        "endTurn": 0
      },
      "mechanicEvidence": {
        "mechanic": "preparation | reward-progression | authorization | repair | pressure | other",
        "visibleToken": "string or null",
        "playerReadable": true,
        "nextStateEffectVisible": true
      },
      "layoutProbe": {
        "ok": true,
        "pageWidth": 1366,
        "failureCount": 0,
        "failures": []
      },
      "console": {
        "errorCount": 0,
        "errors": []
      },
      "tapIntegrity": {
        "singleTapMisfireCount": 0,
        "doubleFireCount": 0,
        "wrongTargetCount": 0
      }
    }
  ],
  "cleanup": {
    "closedPages": true,
    "closedContexts": true,
    "stoppedDevServer": true,
    "danglingProcessCount": 0,
    "notes": ""
  },
  "failures": []
}
```

Pass rules for JSON:

- `overallStatus` can be `pass` only when every required viewport has `status: "pass"`.
- Each viewport must include at least the four required flow names unless it is a labeled reduced `360x640` hard-gate run.
- `mechanicEvidence.playerReadable` must be `true` for every viewport.
- `cleanup.closedPages`, `cleanup.closedContexts`, and `cleanup.stoppedDevServer` must all be `true`.
- `failures` must include every P0/P1/P2 issue with viewport, state, screenshot, and probe output when available.

## 8. Report Template

The final QA report should include this compact table before detailed notes:

| Viewport | Status | Required flows | Layout probe | Tap integrity | Mechanic visible | End Turn | Cleanup |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `1366x768` | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL |
| `390x844` | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL |
| `360x640` | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL |

Verdict language:

- `PASS`: all three viewports pass all P0/P1 gates and cleanup is clean.
- `FAIL - P0`: at least one release-blocking failure.
- `FAIL - P1`: behavior is reachable, but acceptance quality is not sufficient.
- `PASS WITH P2 NOTES`: only non-blocking issues remain and evidence is complete.

STATUS: DONE
