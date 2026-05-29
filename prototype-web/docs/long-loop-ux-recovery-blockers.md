# Vampire Long-loop UX Recovery Blocker Board

## Recovery Result - 2026-05-29 02:13 HKT

Status: pass.

- Fresh load now opens a player-facing Expedition Hub instead of combat-first debug UI.
- The browser path covers Hub -> D1 Brief -> D1 Run -> Settlement -> Shop -> Buy Stable Chain -> Next Run Preview -> browser reload -> second D1 run with Stable Chain.
- Buying Stable Chain now gives an immediate, compact payoff card: reputation delta, new deck, crawler swap, starter swap, and Start Next D1 are visible in the 360x640 first screen.
- Reloaded Hub now shows the saved next goal ribbon: D2 scouted, Shop open, banked currency, and "Test Stable Chain, then branch".
- The second D1 run renders from the actual active run state, with structured proof attributes for run id, starter kit id, deck modifier id, and starter cards.
- Browser QA now verifies localStorage after second D1: `nextRunSequence === 3`, `starter.stable_chain`, `crawler.iron_monk`, unlocked Iron Monk, and `p0.d1.started` for `run-2`.

Final evidence:

- Browser proof: `prototype-web/outputs/long-loop/browser-p0-latest/browser-proof.json`
- Node evidence: `prototype-web/outputs/long-loop/browser-p0-latest/p0-long-loop-evidence.json`
- Profile dump: `prototype-web/outputs/long-loop/browser-p0-latest/profile-dump.json`
- Key screenshot: `prototype-web/outputs/long-loop/browser-p0-latest/mobile-360/06-next-run-preview-after-buy.png`
- Key screenshot: `prototype-web/outputs/long-loop/browser-p0-latest/mobile-360/08-second-d1-run-after-reload.png`

Verified commands:

- `npm run qa:long-loop`: pass, 3/3 browser gates, 7/7 Node evidence gates, 8 screenshots per viewport across desktop, mobile-390, and mobile-360.
- `npm run validate:long-loop-config`: pass, 21 config-contract tests passed.
- `npm run check`: pass, 45 test files passed, 331 tests passed, 2 skipped, production build passed with the existing Vite chunk-size warning.

## Local State Check

- Main repo: `/Users/roc/Game-001`, branch `main`, latest checked commit `61b940b docs: add vampire long-loop handoffs and plan`, status `main...origin/main [ahead 15]`.
- Implementation worktree: `/Users/roc/Game-001/.worktrees/vampire-long-loop-p0`, branch `codex/vampire-long-loop-p0`, latest checked commit `df5444e feat: add vampire long-loop p0 systems`.
- Current worktree was clean at recovery start. This differs from the handoff, which expected many dirty Task 6/7/UI bridge files.
- Dev server: `http://127.0.0.1:5174/`, PID `37004`, still running.

## Baseline Failure Evidence

Browser baseline on `http://127.0.0.1:5174/` confirms the handoff failure:

- Fresh load is combat-first: visible canvas, HUD, card row, enemy lane, and combat actions render before any meta shell.
- Long-loop UI is a right-side panel, not a player hub.
- Visible DOM includes banned debug/internal terms: `Long-loop P0`, `QA profile`, `orchestrator-backed`, `profileStorage`, raw ids, phase/event copy, and visible shop ids.
- Current UI test asserts the failure state as success by checking debug strings and raw ids.
- Current `qa:long-loop` is supporting Node/Vitest evidence only; it is not browser proof.

## Hard Blockers

1. Default entry is still combat-first. P0 must start in a Hub/meta shell.
2. `src/ui/longLoopPanel.ts` is a failed debug bridge and must not be polished as the product direction.
3. There is no player-visible state machine for `Hub -> D1 Brief -> D1 Run -> Settlement -> Shop -> Purchase -> Next Run Preview -> Reloaded Hub`.
4. Settlement is a string message, not a reward/unlock decision screen.
5. Map, Shop, Crawler/Starter, and Next Run Preview expose backend reads instead of player consequences and unlock reasons.
6. The test gate rewards debug leakage instead of forbidding it.
7. Browser proof is missing for desktop and mobile.

## Required Player-facing IA

### Hub / Meta Shell

- Default first screen.
- Shows wallet, selected crawler, selected starter, D1 entry, map progress, shop prompt, and next-run preview.
- Combat is entered from Hub, not booted as the first visible product surface.

### Map

- Shows D1-D10 progression as a readable district board.
- D1 is playable.
- D2-D4 show understandable unlock conditions.
- D5-D10 are locked previews that build desire.
- Copy explains what the district is and how to unlock it; no raw config ids.

### D1 Brief / Run

- D1 Brief explains expected reward, current starter deck, and current crawler.
- Existing combat runtime may be used after the player starts D1.
- A browser-testable completion action can exist for P0, but it must read as player-facing prototype flow, not debug settlement plumbing.

### Settlement

- Shows D1 clear result, `+100` reputation, `+1` gem, unlocked features, visible shop/map/crawler changes, and next choices.
- Player can continue to Hub or Shop.

### Shop

- Shows player-language item cards with price, affordability, locked reason, purchased state, wallet change, and next-run impact.
- Stable Chain purchase must clearly say it affects the next run.

### Crawler / Starter

- Shows available and locked choices, deck identity, unlock reason, selected loadout impact, and next-run availability.

### Next Run Preview

- Shows selected district, selected crawler/starter, starting deck changes, purchased effects, and what changed since the last run.
- Reloading the page must preserve the purchase and progression and return to a player-facing Hub state.

## Visible Text Ban List

The player-visible DOM, screenshots, and positive UI assertions must not contain:

- `Long-loop P0`
- `QA profile`
- `orchestrator`
- `orchestrator-backed`
- `profileStorage`
- `phaseEvents`
- `Visible shop ids`
- `visibleItemIds`
- `raw ids`
- `facade`
- `MemoryStorage`
- `adapter_payload_only`
- `unlockRuleIds`
- `featureGateIds`
- `starterPayload`
- `selectedStarterKitId`
- `purchasedShopItemIds`
- `map.`
- `crawler.`
- `starter.`
- `hub.`
- `unlock.`
- `starter_stable_chain`
- `blacksmith_raise_level_permit`
- `blacksmith_red_socket_permit`
- `blacksmith_reroll_permit`
- `Settle D1`
- `Reload Profile`

## Browser Proof Gate

Target URL: `http://127.0.0.1:5174/`.

Required path:

1. Fresh load lands on Hub/meta shell.
2. Hub shows D1 entry and next-run preview.
3. Player opens D1 brief and starts D1.
4. P0 flow reaches or simulates a D1 clear and transitions to Settlement.
5. Settlement shows rewards and unlocks.
6. Player enters Shop.
7. Player buys Stable Chain Starter.
8. Wallet decreases and purchase becomes owned.
9. Next Run Preview shows Stable Chain impact.
10. Browser reload returns to Hub with purchase, currency, D1 clear, and next-run changes preserved.

Required viewports:

- Desktop: `1366x768`
- Mobile: `390x844`
- Mobile minimum: `360x640`

Required screenshots per viewport:

- `01-hub`
- `02-d1-brief-or-run`
- `03-settlement`
- `04-shop-before-buy`
- `05-next-run-preview-after-buy`
- `06-after-browser-reload`

Fail if any viewport has horizontal overflow, clipped primary CTA, inaccessible shop purchase, hidden next-run preview, framework overlay, console error, page error, or banned visible text.

## Test Gate Changes Required

- Replace `src/tests/ui/long-loop-panel.test.ts`; it currently asserts the debug anti-pattern.
- Add or upgrade a real browser proof script such as `scripts/qa-long-loop-browser.mjs`.
- Make `npm run qa:long-loop` fail if browser proof is absent or `browserProof.status` is `not-run`.
- Keep `npm run validate:long-loop-config`, `npm run test -- src/tests/long-loop --run`, and `npm run check` as supporting gates, not product acceptance.

## Worker Ownership Plan

### UI Shell Worker

- Owns `src/main.ts`, the new meta shell entry, and combat visibility/transition boundaries.
- Must make Hub the first screen and stop appending the failed right-side debug panel as the product UI.

### Settlement / Flow Worker

- Owns the player state machine and D1 completion path.
- Must expose `Hub -> D1 Brief -> D1 Run -> Settlement -> Hub/Shop` without debug language.

### Shop / Map / Crawler UI Worker

- Owns player-facing Map, Shop, Crawler/Starter, and Next Run Preview surfaces.
- Uses existing selectors/facades/orchestrator outputs but maps them to player language.

### Browser QA Worker

- Owns real browser proof, screenshot collection, console/page-error capture, banned text scan, and viewport matrix.

### Test Gate Worker

- Owns unit/UI test replacement and `qa:long-loop` fail-closed behavior.

### Design Reviewer

- Read-only after implementation. Reviews whether the result reads like a game hub, not an admin/debug panel.

## Pass Condition

P0 recovery passes only when all are true:

- Browser proof passes on all required viewports.
- No banned text appears in visible DOM.
- Fresh load is Hub/meta shell.
- The full P0 path is player-understandable and reload-persistent.
- `npm run validate:long-loop-config` passes.
- `npm run test -- src/tests/long-loop --run` passes.
- `npm run check` passes.
- Five independent senior indie-player reviews average at least 95/100.
- No reviewer marks a hard blocker.
