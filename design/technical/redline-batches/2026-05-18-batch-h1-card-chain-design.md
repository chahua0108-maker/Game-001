# Redline Batch H1 - Card Chain Design

Date: 2026-05-18
Role: Card Chain Designer
Scope: design handoff only. No runtime, HUD, VFX, data, or test code changed.

## Design Intent

`Redline Hyper-Turn Card Pressure Slice` should prove that pressure comes from fast turn-based card sequencing, not automatic combat. The player should read one hand, see a cost chain, choose whether to preserve or repair that chain, then watch a payoff card convert the chain into a front-row clear or near clear.

Primary five-turn arc:

```text
Turn 1: successful 0 -> 1 -> 2 chain
Turn 2: broken chain shows danger
Turn 3: Wild / draw / mana repairs the missing link
Turn 4: long chain feeds a 3-cost payoff and clears the front row
Turn 5: reward responds to the route the player just built
```

Important constraint for Runtime: with the current `maxEnergy = 3`, a natural `0 + 1 + 2 + 3` payoff chain is impossible because it costs 6 total MP. The slice needs either scripted higher MP on payoff turns, mana gain/refund from extension cards, or a chain rebate rule. Without one of those, 3-cost payoff cards cannot demonstrate the intended hyper-turn climax.

## Existing Cards Reclassified By Chain Role

| Chain role | Existing cards | Job in the hand | Keep / adjust note |
| --- | --- | --- | --- |
| 0-cost starter | `debt_hook`, `blood_reclaim`, `spark_tap` | Opens the turn at x1 without spending MP, lets the next 1-cost card become x2. | These should be visually tagged as `START 0`. They are not meant to be strong alone. |
| 0-cost starter plus draw | `blood_tithe` | Opens the chain while finding the missing bridge or payoff. | Treat as starter first, extension second. HUD should show `START 0` and `DRAW +1`. |
| 1-cost bridge | `redline_cut`, `heartbeat_spark`, `verdict_mark` | Converts the starter into real damage and sets up the 2-cost expansion. | These are the main "correct next card" after a 0-cost starter. |
| 1-cost bridge plus draw | `pulse_draw` | Preserves the 1-cost step when the hand lacks enough damage or needs a draw. | Needs a mana rule or rebate to become a true extension; otherwise it competes with damage for scarce MP. |
| 2-cost expansion | `row_cleave`, `clearance_order` | Turns a successful 0 -> 1 chain into front-row pressure. | These should preview multiplied front-row damage, not only base damage. |
| 2-cost draw / support extension | `paper_shatter` / `Paper Route`, `lantern_captain` | Lets a turn keep moving after the bridge and searches for payoff or repair tools. | Needs `manaGain`, cost rebate, or higher scripted MP to avoid ending the turn immediately. |
| 3-cost payoff | `severance_burst`, `red_ledger_burst` | Converts a built chain into all-enemy / front-row clear power. | Should be weak if played first, strong if played after 2-cost expansion or chain length >= 3. |
| Wild repair | `wild_mana_stitch`, `wild_gap_key` | Fills a missing cost step or preserves chain after an awkward draw. | Needs explicit Wild semantics. Current data only approximates Wild through cost and draw. |
| Draw / Mana extension | `blood_tithe`, `pulse_draw`, `paper_shatter`, `lantern_captain`, `wild_mana_stitch` | Extends the turn by finding the next card and/or paying for it. | Runtime must distinguish draw-only from mana-extension so HUD can promise only what rules support. |

## Five-Turn Fixed Experience Script

This script is a design seed for Contract, Runtime, HUD, VFX, and QA. It can be implemented as deterministic opening hands and deterministic reward choices; it does not require final random-run balance.

### Turn 1 - Successful Chain

| Field | Script |
| --- | --- |
| Hand example | `debt_hook` 0, `redline_cut` 1, `row_cleave` 2, `heartbeat_spark` 1 |
| Enemy intent | Front row shows small but readable damage: left Wisp 2, center Brute 5, right Collector 3. End Turn preview: `unblocked intent: 10 HP`. |
| Correct route | `debt_hook` -> `redline_cut` -> `row_cleave`. The player sees x1, x2, x3 and front-row HP drops enough to kill or nearly kill weak enemies. |
| Out-of-order cost | Playing `row_cleave` first spends 2 MP at x1, leaves only 1 MP, and cannot reach the same front-row clear. Playing both 1-cost cards in a row breaks the chain back to x1. |
| Required feeling | "I found the obvious line and the game rewarded the order." |

### Turn 2 - Broken Chain And Consequence

| Field | Script |
| --- | --- |
| Hand example | `red_ledger_burst` 3, `pulse_draw` 1, `clearance_order` 2, `verdict_mark` 1 |
| Enemy intent | Reinforced front row: Brute 5 plus two Wisps 2 each. End Turn preview: `unblocked intent: 9 HP`; one back-row enemy shows `refill next front slot`. |
| Correct route | There is no full 0 -> 1 -> 2 -> 3 route. Best route is `pulse_draw` or `verdict_mark` -> `clearance_order`, then accept that the payoff cannot be funded yet. |
| Out-of-order cost | Playing `red_ledger_burst` first is the taught mistake: it fires at x1, consumes all MP, fails to clear the front row, and the player eats visible intent damage. |
| Required feeling | "The 3-cost card is tempting, but it is not a free win. Payoff before setup is bad." |

### Turn 3 - Wild / Draw / Mana Repair

| Field | Script |
| --- | --- |
| Hand example | `blood_tithe` 0, `wild_gap_key` 1, `paper_shatter` 2, `severance_burst` 3, plus scripted draw target `wild_mana_stitch` or `row_cleave` |
| Enemy intent | High but survivable: total preview `12 HP`; one front enemy is low enough that a repaired chain can stop most damage. |
| Correct route | `blood_tithe` opens and draws, `wild_gap_key` bridges the missing 1-cost role, `paper_shatter` expands and draws. If the Runtime supports mana gain/rebate, the drawn repair card keeps the turn alive. |
| Out-of-order cost | Playing `severance_burst` before repair repeats Turn 2's failure. Playing `paper_shatter` before the Wild bridge breaks the chain and produces only support value. |
| Required feeling | "The hand looked broken, but the repair tools gave me a route." |

### Turn 4 - Payoff Clears The Front Row

| Field | Script |
| --- | --- |
| Hand example | `spark_tap` 0, `heartbeat_spark` 1, `clearance_order` 2, `severance_burst` 3, `pulse_draw` 1 |
| Enemy intent | Front row threatens lethal or near lethal: preview `15+ HP`. Back row shows refill intent, so partial damage is not enough. |
| Correct route | `spark_tap` -> `heartbeat_spark` -> `clearance_order` -> `severance_burst`. The payoff sees chain length >= 3 or last cost 2, upgrades to front-row/all-enemy clear, and cancels most intent. |
| Out-of-order cost | `severance_burst` first should be visibly weaker: x1 base damage, no clear upgrade, no "payoff armed" badge, and End Turn preview remains dangerous. |
| Required feeling | "The big card is big because I built the turn, not because the clock handed me a burst." |

### Turn 5 - Reward Responds To The Build

| Field | Script |
| --- | --- |
| Reward choices | One Wild repair (`wild_mana_stitch` or `wild_gap_key`), one draw/mana extension (`pulse_draw`, `paper_shatter`, or `lantern_captain`), one payoff (`red_ledger_burst` or `severance_burst`). |
| Enemy intent | New wave preview is readable but not immediately lethal; the reward screen should preserve memory of the previous clear. |
| Correct route | If the player struggled on Turn 2, pick Wild. If Turn 4 lacked enough MP, pick draw/mana. If repair already exists, pick payoff. |
| Out-of-order cost | Picking a second payoff without repair should be presented as greed: more ceiling, worse consistency. |
| Required feeling | "The reward answers what just happened in my chain." |

## Card-By-Card HUD Tags

Each card should show four compact labels: `cost`, `role`, `chain preview`, and `effect`. The role label is the missing player-facing contract.

| Card | Required role tag | Secondary tag | Chain preview text |
| --- | --- | --- | --- |
| `debt_hook` | `START 0` | `PULL / SINGLE` | If no prior card: `open x1`; if played after an existing chain: `restart chain`. |
| `blood_reclaim` | `START 0` | `SINGLE` | Same as `debt_hook`; emphasize stable opener. |
| `blood_tithe` | `START 0` | `DRAW +1` | `open x1, find bridge`. |
| `spark_tap` | `START 0` | `SPARK / SINGLE` | `open Spark line`. |
| `redline_cut` | `BRIDGE 1` | `SINGLE DMG` | After 0: `continue x2`; otherwise `start x1`. |
| `heartbeat_spark` | `BRIDGE 1` | `SPARK` | After 0: `continue x2`; after 1: `break x1`. |
| `verdict_mark` | `BRIDGE 1` | `MARK` | After 0: `continue x2`; otherwise warn if it breaks. |
| `pulse_draw` | `BRIDGE 1` | `DRAW +1` | `continue x2, find 2`. If mana gain exists, show `+MP` too. |
| `row_cleave` | `EXPAND 2` | `FRONT ROW` | After 1: `continue x3`; otherwise `break x1`. |
| `clearance_order` | `EXPAND 2` | `FRONT ROW` | After 1: `continue x3`; if front kill preview exists, show `intent reduced`. |
| `paper_shatter` / `Paper Route` | `EXTEND 2` | `DRAW +1` | After 1: `continue x3, find payoff`. If mana gain exists, show `+MP`. |
| `lantern_captain` | `EXTEND 2` | `DRAW +1 / SUPPORT` | After 1: `continue x3`; tag as consistency, not damage. |
| `severance_burst` | `PAYOFF 3` | `ALL ENEMIES` | After 2 or chain length >= 3: `armed x4 clear`; otherwise `unarmed x1`. |
| `red_ledger_burst` | `PAYOFF 3` | `ALL ENEMIES` | Same as `severance_burst`; if unarmed, show danger color. |
| `wild_mana_stitch` | `WILD REPAIR` | `DRAW +1` | `fills missing step`; if no chain gap, `open/extend safely`. |
| `wild_gap_key` | `WILD REPAIR` | `LOW DMG` | `counts as expected cost`; if used off-route, `repair spent`. |

HUD should avoid long rules text on cards. Put detailed text in tooltip or expanded card inspect; the first read should be the role tag and whether it continues or breaks the current chain.

## Runtime Worker Minimum Data And Rule Needs

Runtime does not need a large redesign to satisfy this card-chain slice, but it does need explicit chain data rather than inferred card descriptions.

Minimum card data additions or equivalents:

| Data | Why Runtime needs it |
| --- | --- |
| `chainRole`: `starter`, `bridge`, `expand`, `payoff`, `wild`, `draw`, `mana` | Lets HUD and tests classify the card without parsing descriptions. |
| `wildCostMode` or `countsAsCost` | Lets `wild_gap_key` and `wild_mana_stitch` fill the expected cost instead of being normal 0/1-cost cards only. |
| `manaGain` or `costRefund` | Required for any 0 -> 1 -> 2 -> 3 payoff chain under current 3 MP economy. |
| `payoffRequires`: last cost 2 and/or chain length >= 3 | Prevents `severance_burst` and `red_ledger_burst` from being equally good when played first. |
| `payoffUpgrade`: front-row clear, all-enemy damage, overflow, draw, or heal | Makes payoff result inspectable by tests and visible to HUD/VFX. |
| `scriptedOpeningHands` for rounds 1-5 | Prevents first-slice proof from depending on random draw order. |
| `scriptedRewardChoices` for Turn 5 | Ensures reward responds with Wild / extension / payoff choices. |

Minimum rule outputs:

| Rule output | Consumer |
| --- | --- |
| `ChainState`: played costs, expected next cost, multiplier, chain length, broken flag, break reason | HUD card previews, QA trace, acceptance tests. |
| `CardPlayed.effectMultiplier` remains visible, but should be accompanied by chain status | Runtime/HUD can explain why the multiplier was x1/x2/x3/x4. |
| `EnemyIntent`: per front enemy damage/effect plus total End Turn damage | HUD End Turn preview and Turn 2/4 pressure proof. |
| `PayoffTriggered`: card id, armed/unarmed, upgrade applied, enemies affected, prevented intent damage | VFX burst, HUD feedback, QA evidence. |
| `TurnResult`: damage taken, intent cancelled, cards played, chain max length, payoff state | Replay trace and reward-response logic. |

Minimum behavioral rules:

1. A normal card continues the chain only when its cost equals expected next cost.
2. A Wild card can count as the expected next cost once, with lower base damage or no damage.
3. Draw cards must draw before the route is judged dead, so they can reveal a repair or payoff.
4. Mana extension must be explicit. Do not silently let 3-cost payoff fire after 0+1+2 unless a visible rule paid for it.
5. Payoff cards played unarmed still resolve, but with clearly lower damage and no clear upgrade.
6. End Turn resolves visible enemy intent, not hidden realtime pressure.

## HUD Worker Minimum Display Needs

Global HUD:

- Show current chain as compact text: `CHAIN 0 -> 1 -> ?`, `Next: MP2`, `x3`.
- Show End Turn preview near the button: `Intent: -12 HP if unresolved`.
- Highlight cards that continue the chain; danger-color cards that break it.
- Payoff cards should have two states: `UNARMED` and `ARMED`.
- Reward cards should use the same role tags as hand cards.

Per-card required labels:

| Label | Example | Notes |
| --- | --- | --- |
| Cost | `MP 2` | Keep visible on every card. |
| Role | `EXPAND 2` | This is more important than flavor verb. |
| Chain preview | `continue x3` or `break x1` | Must update after every card. |
| Target/effect | `front row 5`, `draw +1`, `all enemies 16` | Use multiplied preview when available. |
| Payoff state | `armed clear` or `unarmed` | Only for 3-cost payoff cards. |
| Repair state | `fills MP2` or `repair spent` | Only for Wild cards. |
| Intent impact | `prevents 5 intent` / `front clear` | Only when target preview is reliable. |

## Patch Manifest

| File | Binding purpose |
| --- | --- |
| `design/technical/redline-batches/2026-05-18-batch-h1-card-chain-design.md` | Defines the hyper-turn card chain roles, five-turn scripted experience, Runtime minimum data/rules, and HUD role labels for card-chain implementation workers. |
