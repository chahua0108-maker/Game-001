# 2026-05-18 Round 08 Expert 09: Mobile Playtest Scenario Designer

Role: Round 08 Expert 09, Mobile Playtest Scenario Designer  
Workdir: `/Users/roc/Game-001`  
Scope: design the manual and automated browser acceptance route after Round 08 implementation lands.  
Boundary: documentation only; do not edit source, do not commit, do not rollback, do not open a browser from this task.

## 0. Acceptance Intent

Round 08 acceptance is not a generic smoke test. It must prove the narrow `paper_shatter` preparation slice works as a player-facing browser flow:

1. A reward route can give the player `paper_shatter`.
2. After taking the reward, a later combat can put `paper_shatter` into the playable run deck or hand.
3. Playing the intended chain into `paper_shatter` triggers preparation, not only a decorative `reorder` label.
4. The preparation result is readable through short tokens and does not break small mobile layouts.
5. Browser QA cleans up every page, tab, local URL, dev server, and long-running process it opens.

Required viewports:

| Tier | Viewport | Purpose |
| --- | --- | --- |
| Desktop | `1366x768` or wider | Full information density, debug/log visibility, reward selection confidence. |
| Mobile primary | `390x844` | iPhone-like tall mobile pass with thumb-scale controls. |
| Mobile hard gate | `360x640` | Small Android short-height pass; text fitting and cleanup gate. |

## 1. Round 08 Specific Pass Conditions

The browser pass is accepted only if all of these can be evidenced:

| ID | Required result | Evidence |
| --- | --- | --- |
| R8-01 | Reward UI shows `paper_shatter` / `Paper Route` as a selectable reward at least once. | Reward screenshot plus trace/log note. |
| R8-02 | Selecting `paper_shatter` closes the reward state and the next combat/run state can actually use the card. | Before/after screenshots or event trace including `RewardChosen`. |
| R8-03 | `paper_shatter` is played after a valid `0 -> 1 -> 2` or equivalent intended chain route, not as a random first card. | Turn sequence screenshots and action log. |
| R8-04 | Playing `paper_shatter` triggers visible preparation behavior. Expected player tokens are short: `整备`, `整备3张`, `顶终结`, `下抽终结`, `整备无牌`, or `跳过整备`. | Screenshot of card state, Director/log, and trace note. |
| R8-05 | Preparation affects the next draw or next playable route in a way the player can inspect. If no valid payoff exists, the UI must show a miss such as `整备无牌`. | Pre/post draw pile or next-hand evidence; player-facing screenshot first, trace second. |
| R8-06 | Combat log uses short wording and does not overflow its desktop container. | Desktop log screenshot. |
| R8-07 | Reward cards, card buttons, Director, and End Turn controls do not overflow or overlap on `390x844` and `360x640`. | Screenshots for each mobile viewport. |
| R8-08 | A single tap plays one intended card on both mobile sizes; no double-fire, missed tap, or hidden overlay interception. | Tap notes and trace event count. |
| R8-09 | End Turn preview and resolution still work after reward and preparation flow. | Pre/post End Turn screenshots. |
| R8-10 | Every browser page/tab/local URL and every QA-started server/process is closed at the end. | Cleanup field in metrics plus final process/page note. |

If the implementation does not yet expose a deterministic way to force `paper_shatter` into the reward choices, the pass may use a seeded run, a documented QA command, or a prearranged fixture. It must not silently mutate runtime state from DevTools and then claim that the player flow passed.

## 2. Manual Route A: Desktop Reward Into Preparation

Viewport: `1366x768`.

Goal: establish the full reward-to-preparation loop with the least mobile layout pressure, then reuse the same sequence on mobile.

Steps:

1. Start a fresh run and capture the initial combat state.
2. Play a normal chain route until the run reaches a reward state. Prefer a route that keeps the next reward need obvious: missing payoff, missing route bridge, or missing draw fixer.
3. On the reward screen, select `Paper Route` / `paper_shatter`.
4. Confirm the reward state exits and the selected card is represented in the current run deck or next combat pool.
5. Reach a combat state where `paper_shatter` is visible in hand. If it is not drawn naturally, continue normal turns; if a QA fixture is used, record the fixture name.
6. Play a valid chain into `paper_shatter`. Preferred route is a visible `0 -> 1 -> 2` setup, then `Paper Route` as the 2-cost preparation segment if implementation rules allow it.
7. Capture the moment immediately after `paper_shatter` resolves.
8. Verify one of the player-facing outcomes:
   - success: `整备3张` followed by `顶终结` or `下抽终结`;
   - miss: `整备无牌`;
   - skip: `跳过整备`, only if the UI intentionally exposes skip.
9. Draw or advance to the next relevant decision and verify the preparation result changes the next draw/route, or the miss/skip remains honest.
10. Press End Turn once and verify preview/resolution still match after the reward and preparation path.
11. Record cleanup after closing all browser artifacts and stopping the dev server.

Desktop fail examples:

- Reward can show `paper_shatter`, but selecting it does not add it to the run.
- `paper_shatter` still only says `整备` with no event, result, or next-draw effect.
- Combat log prints a long deck manipulation sentence instead of short tokens.
- End Turn works before reward but breaks after `paper_shatter`.

## 3. Manual Route B: 390x844 Primary Mobile Pass

Viewport: `390x844`.

Goal: verify the same route is playable by touch and readable without desktop-only log dependency.

Steps:

1. Capture initial mobile combat.
2. Confirm persistent read order: HP, MP/resource, chain state, enemy intent, and End Turn consequence must be visible or reachable without hover.
3. Reach or fixture the reward state and capture the reward screen.
4. Confirm reward card text fits:
   - role token should be short, such as `整备 · 自身`;
   - summary should show `MP2` and `抽1/3` or equivalent;
   - rules text should fit two lines without losing the action and value.
5. Tap `Paper Route` once. Verify only one reward selection event is recorded.
6. Continue to a combat where `Paper Route` is visible in hand.
7. Tap through the chain route one card at a time. After each tap, record whether the intended card fired once.
8. Tap `Paper Route` and capture the immediate result.
9. Verify mobile-visible preparation feedback:
   - card role says `整备`, not `整备/找牌`;
   - Director or equivalent status can show `整备3张`, `下抽终结`, `整备无牌`, or `跳过整备`;
   - the result is not available only in a hidden desktop combat log.
10. Confirm no card button, reward card, Director tile, End Turn button, or status chip overlaps or pushes outside the viewport.
11. Press End Turn and verify the preview/resolution path remains understandable after preparation.
12. Close all browser artifacts and stop all QA-started processes.

390x844 hard failures:

- A tap on `Paper Route` selects a different control or fires twice.
- `整备` result exists only in debug text that is hidden or too small on mobile.
- Reward text ellipsizes away the cost, draw count, or preparation meaning.
- End Turn is covered by the hand row or mobile safe area.

## 4. Manual Route C: 360x640 Hard Gate

Viewport: `360x640`.

Goal: prove the implementation survives the smallest required mobile viewport. This pass can be shorter than the `390x844` pass, but it cannot skip the key reward and preparation states.

Minimum sequence:

1. Capture initial combat.
2. Capture reward state with `Paper Route` visible.
3. Select `Paper Route` with one tap.
4. Capture a combat state where `Paper Route` is visible in hand.
5. Play the chain into `Paper Route`.
6. Capture preparation result.
7. Capture End Turn preview and one resolved post-End-Turn state.
8. Record cleanup.

360x640 text gates:

| Surface | Must fit | Fails if |
| --- | --- | --- |
| Reward title | `Paper Route` or approved short name | Name overlaps cost/role. |
| Reward role | `整备 · 自身` or shorter | Uses slash chain like `整备/找牌`. |
| Reward summary | Cost plus draw/prep value | Cost or draw count disappears. |
| Card role | `整备` | More than one role phrase wraps. |
| Card preview | `抽3`, `抽3仍-X`, or equivalent | Critical value hidden by ellipsis. |
| Director/result | `整备3张`, `下抽终结`, `整备无牌`, or `跳过整备` | Full sentence wraps over adjacent UI. |
| End Turn | Consequence before activation | Button is partly offscreen or ambiguous. |

If `360x640` passes mechanically but the tester cannot tell whether preparation succeeded, classify as `implementation bug`, not polish.

## 5. Automated Browser Route

The automated route should be a browser-worker script, not part of this design task. It should use real UI clicks wherever possible and record screenshots at the same decision points as the manual pass.

Suggested automation structure:

```text
for viewport in [desktop-1366x768, mobile-390x844, mobile-360x640]:
  open app
  collect console errors
  screenshot initial combat
  reach reward state through player route or documented fixture
  assert reward options include paper_shatter / Paper Route
  screenshot reward
  click Paper Route once
  assert RewardChosen event count == 1
  assert reward state closes
  reach hand containing Paper Route through player route or documented fixture
  screenshot hand
  click valid chain cards one by one
  assert each click emits one card play event
  click Paper Route
  assert preparation event/result is present
  assert visible token matches short-token allowlist
  screenshot preparation result
  click End Turn
  assert preview/resolution remain consistent
  assert no horizontal overflow and no key element bounding box exceeds viewport
  close page/context
stop dev server
write cleanup status
```

Recommended screenshot names:

| Viewport | Required files |
| --- | --- |
| Desktop | `desktop-r8-initial.png`, `desktop-r8-reward-paper-route.png`, `desktop-r8-paper-hand.png`, `desktop-r8-prep-result.png`, `desktop-r8-end-turn-after-prep.png` |
| 390x844 | `mobile-390x844-r8-initial.png`, `mobile-390x844-r8-reward-paper-route.png`, `mobile-390x844-r8-paper-hand.png`, `mobile-390x844-r8-prep-result.png`, `mobile-390x844-r8-end-turn-after-prep.png` |
| 360x640 | `mobile-360x640-r8-initial.png`, `mobile-360x640-r8-reward-paper-route.png`, `mobile-360x640-r8-paper-hand.png`, `mobile-360x640-r8-prep-result.png`, `mobile-360x640-r8-end-turn-after-prep.png` |

Suggested machine-readable fields:

```json
{
  "viewport": "390x844",
  "paperRewardVisible": true,
  "paperRewardSelectedOnce": true,
  "paperAvailableAfterReward": true,
  "paperPlayedAfterValidChain": true,
  "preparationTriggered": true,
  "preparationVisibleToken": "下抽终结",
  "preparationAffectedNextDraw": true,
  "combatLogShortWording": true,
  "textOverflowDetected": false,
  "horizontalOverflowDetected": false,
  "singleTapMisfireCount": 0,
  "endTurnAfterPrepConsistent": true,
  "consoleErrorCount": 0,
  "cleanupClosedPages": true,
  "cleanupStoppedProcesses": true
}
```

## 6. Short Token Allowlist

Browser acceptance should treat the following as the preferred visible vocabulary:

| Concept | Allowed player-facing tokens |
| --- | --- |
| Card role | `整备` |
| Pending/prep count | `整备3张`, `整备2张`, `整备1张` |
| Success payoff | `顶终结`, `下抽终结`, `整备成功` |
| Success route | `顶路线`, `下抽路线` |
| Miss | `整备无牌`, `无整备` |
| Skip | `跳过整备`, `整备跳过` |
| Draw | `抽1`, `抽3`, `抽1/3`, `抽3仍-X` |
| Reward role | `整备 · 自身` |

Disallowed in fixed-width mobile surfaces:

- `整备/找牌`
- `查看牌库顶部3张并选择顺序`
- `已将 Severance Burst 放到 drawPile 顶部`
- `抽3并整备寻找终结牌`
- any long sentence that makes cost, draw count, End Turn consequence, or preparation result disappear.

## 7. Evidence Notes For Later Worker

Store raw browser evidence under the ignored QA output directory, then write a short committed summary if requested by the main thread.

Preferred raw directory:

```text
/Users/roc/Game-001/outputs/browser-qa/redline-round-08-paper-shatter/2026-05-18/
```

The browser worker should record:

- exact app URL and dev server port;
- seed or fixture name, if used;
- viewport and device scale factor;
- screenshot filenames;
- console error summary;
- event trace excerpt for `RewardChosen`, `CardPlayed`, and preparation result;
- one-line human note: "Could a mobile player understand why `Paper Route` mattered?";
- cleanup status.

## 8. Cleanup Gate

Cleanup is part of acceptance, not an afterthought.

Before the browser worker reports pass, it must verify:

1. All QA-opened pages, tabs, contexts, and local URLs are closed.
2. All QA-started dev servers, preview servers, Playwright sessions, and long-running processes are stopped.
3. No browser process is left alive solely because of this QA pass.
4. Cleanup status is written into the metrics file.
5. Any cleanup failure is classified as `scope drift`.

If the browser cannot be closed automatically, the run is at most `partial`, even if gameplay evidence passed.

## 9. Final Gate

Round 08 mobile playtest acceptance is `PASS` only when:

- desktop, `390x844`, and `360x640` all capture reward -> `paper_shatter` -> preparation -> End Turn;
- `paper_shatter` preparation is visible through short player-facing tokens;
- mobile input proves single-tap behavior;
- text and controls fit without horizontal overflow or critical ellipsis;
- cleanup is confirmed.

Anything less should be reported as `partial` with the first missing evidence item named explicitly.

STATUS: DONE
