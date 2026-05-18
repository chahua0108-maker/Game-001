# Redline Hyper-Turn Batch H3 QA Plan

Date: 2026-05-18
Role: QA Lead / Playtest Evidence Engineer
Scope: QA evidence framework only. Do not edit runtime, HUD, renderer, card data, or acceptance tests from this batch.

## QA Intent

This hyper-turn QA pass replaces the previous realtime 90s acceptance lens.

The first question is no longer "does combat keep damaging things while the player waits?" The first question is:

> Can the player read a fast turn-based card chain, predict enemy intent, press End Turn with understood consequences, and feel a card-built payoff within 3-5 turns?

Pass/fail must come from player-facing evidence: screenshots, short notes, trace excerpts, metrics JSON, and manual playtest observations. DOM-only checks or green unit tests are not enough.

## Evidence Directory

Use:

- `/Users/roc/Game-001/outputs/browser-qa/redline-hyperturn/2026-05-18/README.md`
- `/Users/roc/Game-001/outputs/browser-qa/redline-hyperturn/2026-05-18/metrics-template.json`

Expected later browser-worker artifacts:

- `desktop-initial.png`
- `desktop-turn-1-chain.png`
- `desktop-turn-2-break.png`
- `desktop-turn-3-repair.png`
- `desktop-turn-4-payoff.png`
- `mobile-390x844-initial.png`
- `mobile-390x844-turn-1-chain.png`
- `mobile-390x844-turn-3-repair.png`
- `mobile-390x844-payoff.png`
- optional `desktop-trace.json`, `mobile-390x844-trace.json`, and console logs

## Desktop Smoke Checklist

Viewport: 1280x720 or 1440x900.

Pass requires each required item to be judged from player-facing evidence, not only source inspection.

| ID | Required check | Evidence | Fail class if broken |
| --- | --- | --- | --- |
| D-01 | Page reaches an actionable hyper-turn combat state with visible hand, HP/MP or equivalent resources, chain state, enemy line, and End Turn control. | initial screenshot and timestamp | implementation bug |
| D-02 | Chain display is readable before the first card: current chain, next expected cost, and whether a card can continue or break the chain. | screenshot or trace note | implementation bug |
| D-03 | At least one enemy intent is visible before End Turn, including expected damage or other consequence. | enemy intent screenshot | implementation bug |
| D-04 | Card cost is readable at normal desktop distance; cost cannot be visually weaker than hotkeys, debug labels, or flavor text. | screenshot and cost readability note | implementation bug |
| D-05 | Playing a valid sequence advances the chain and visibly improves the result compared with random play. | before/after screenshots or trace pair | hypothesis failed |
| D-06 | Playing or hovering/selecting a non-matching card makes the break risk legible before or immediately after the action. | screenshot or note | implementation bug |
| D-07 | End Turn preview states the consequence of unresolved intent before the player confirms or clicks. | End Turn screenshot | implementation bug |
| D-08 | After End Turn, the consequence resolves consistently with the preview: HP loss, enemy action, position shift, status, or other declared effect. | pre/post End Turn evidence | implementation bug |
| D-09 | A repair tool such as Wild, draw, mana, reorder, or copy can be identified by role, not only by raw text. | card screenshot and note | hypothesis failed |
| D-10 | A payoff card communicates why it is stronger after the chain: multiplier, area, overflow, draw, heal, or clear effect. | payoff screenshot or trace | hypothesis failed |
| D-11 | Debug trace does not dominate the combat read; if present, it supports diagnosis after the player read is checked. | screenshot and obstruction note | implementation bug |
| D-12 | No console error, blank render, frozen turn state, or unrecoverable input lock occurs during the smoke pass. | console summary and final screenshot | implementation bug |
| D-13 | If QA opened a page, local URL, browser tab, or dev server, all opened pages/tabs are closed and all QA-started long-running processes are stopped. | cleanup field in metrics JSON | scope drift |

Desktop pass note: a technically clickable screen fails if chain, intent, End Turn consequence, or card cost cannot be read without source-code context.

## Mobile Smoke Checklist

Viewport: 390x844.

The mobile pass is stricter on visual priority. The player must be able to make hyper-turn decisions with thumb-scale controls and compressed information.

| ID | Required check | Evidence | Fail class if broken |
| --- | --- | --- | --- |
| M-01 | Page reaches an actionable combat state at 390x844 without horizontal-only layout assumptions. | initial screenshot | implementation bug |
| M-02 | Top or persistent combat read prioritizes HP, MP/resource, chain state, and enemy intent; debug/secondary panels are folded or visually subordinate. | screenshot | implementation bug |
| M-03 | Chain state remains readable at 390px width: current chain, next expected cost, and break state do not wrap into unreadable fragments. | screenshot and note | implementation bug |
| M-04 | Enemy intent is readable without relying on tiny debug text or hidden hover-only UI. | intent screenshot | implementation bug |
| M-05 | End Turn button is reachable and its consequence preview is visible before activation. | screenshot and tap note | implementation bug |
| M-06 | After tapping End Turn, resolved damage/effect matches the preview closely enough for player responsibility. | before/after screenshot or trace | implementation bug |
| M-07 | Card cost is readable on every playable card; cost cannot be clipped by hand layout, safe area, or action buttons. | hand screenshot | implementation bug |
| M-08 | A single tap plays one intended card; no double-fire, missed tap, or covered control. | tap result note | implementation bug |
| M-09 | Valid chain, break, repair, and payoff states can be observed across the manual run without UI overlap blocking the card row or enemy row. | turn sequence screenshots | implementation bug |
| M-10 | Text inside card/action buttons fits; critical combat labels are not ellipsized beyond meaning. | screenshot and note | implementation bug |
| M-11 | If QA opened a page, local URL, browser tab, or dev server, all opened pages/tabs are closed and all QA-started long-running processes are stopped. | cleanup field in metrics JSON | scope drift |

Mobile pass note: if the mechanics work but the player cannot read cost, intent, chain, or End Turn consequence at 390x844, classify as `implementation bug`, not polish.

## 3-5 Turn Manual Playtest Metrics

Each desktop and mobile run should cover 3-5 turns. Stop early only for a blocking failure and record the turn where it happened.

Required metrics:

- `successfulChain`: whether the run includes at least one intentional valid chain such as `0 -> 1 -> 2` or `0 -> 1 -> payoff`.
- `chainBreak`: whether the run exposes at least one break or near-break, including the cause: wrong cost, missing bridge, insufficient resource, target issue, or unclear UI.
- `repair`: whether Wild, draw, mana, reorder, copy, or equivalent repair lets the player continue or recover a chain.
- `payoff`: whether a high-cost or finisher card becomes visibly stronger because the chain was built first.
- `rewardResponse`: whether post-combat or between-turn reward text/options respond to the run's need: bridge, draw, mana, finisher, survivability, or chain stability.
- `endTurnConsequence`: whether unresolved enemy intent is previewed and then resolved in a way the player can verify.
- `readabilityNotes`: freeform notes for chain display, card cost, enemy intent, and mobile obstruction.

Recommended sequence:

1. Turn 1: establish a successful chain and record the visible benefit.
2. Turn 2: create or observe a broken chain, bad draw, or resource gap.
3. Turn 3: repair the gap with Wild, draw, mana, reorder, or copy.
4. Turn 4: trigger or nearly trigger a payoff card and record why it did or did not matter.
5. Turn 5 if available: record whether reward/next-turn options respond to the previous problem.

## Deprecated Realtime Metrics

The following old realtime indicators are explicitly not pass conditions for hyper-turn QA:

- automatic attacks killing enemies without card decisions;
- no-input damage, realtime pressure-line damage, or background attrition;
- fixed 60 second burst, timed clear, or scripted `red_ledger_burst`;
- 30/60/90 second kill-count targets that ignore turn quality;
- "player survived while waiting" as evidence of pressure.

These may appear in legacy traces, but they must not be used to claim the hyper-turn direction passes.

## Failure Categories

Use one primary category per failure.

| Category | Meaning | Example |
| --- | --- | --- |
| implementation bug | The intended hyper-turn behavior is defined, but UI, input, sim, or render output does not show it correctly. | End Turn preview says 8 damage but HP changes by 3 |
| acceptance conflict | Two docs/tests/workers disagree on the intended rule. | QA expects turn intent while a runtime test still asserts realtime no-input damage |
| hypothesis failed | The system may work, but the experience does not create readable hyper-turn pressure. | payoff exists but feels unrelated to chain building |
| evidence missing | The claim cannot be checked from screenshots, trace, metrics, or notes. | "costs are readable" with no hand screenshot |
| scope drift | QA or another worker changes files outside their ownership or leaves test infrastructure running. | QA edits HUD code or leaves dev server alive |

## Cleanup Hard Constraint

This batch does not require opening a webpage. If a later QA pass does open a webpage, local URL, browser tab, dev server, preview server, Playwright session, or other long-running process, cleanup is mandatory:

- close every QA-opened page/tab/local URL;
- stop every QA-started dev server or long-running process;
- record cleanup status in `metrics-template.json`;
- record any leftover process/page as a failure under `scope drift`.

## Commands For Later Browser Worker

Do not run these from this framework-only batch unless assigned to browser verification after implementation lands.

```bash
cd /Users/roc/Game-001/prototype-web
npm run test
npm run build
npm run dev -- --host 127.0.0.1 --port 5174
```

Browser-worker pass, after the dev server is already running:

```bash
# Desktop smoke target
open http://127.0.0.1:5174/

# Required viewports
# desktop: 1280x720 or 1440x900
# mobile: 390x844
```

Suggested browser actions:

1. Capture initial desktop and mobile screenshots.
2. Play 3-5 turns normally using visible controls, not hidden state injection.
3. Record successful chain, break, repair, payoff, reward response, and End Turn consequence.
4. Capture representative screenshots for desktop and 390x844.
5. Fill `/Users/roc/Game-001/outputs/browser-qa/redline-hyperturn/2026-05-18/metrics-template.json`.
6. Close every opened page/tab/local URL and stop the dev server or any long-running process started for the pass.

## QA Gate

Hyper-turn QA passes only when:

- desktop and 390x844 smoke checklists are completed;
- metrics JSON is filled and parseable;
- the 3-5 turn run contains evidence for successful chain, break, repair, payoff, reward response, and End Turn consequence, or explicitly records why each missing item failed;
- old realtime indicators are not used as pass conditions;
- every failure is categorized;
- cleanup confirms no QA-opened page, tab, local URL, dev server, or long-running process was left behind.
