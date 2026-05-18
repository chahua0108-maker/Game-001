# Redline Batch H2 - HUD UX Hyper-Turn Card Chain

Date: 2026-05-18
Owner: HUD/UX Design Implementation

## Scope

Allowed files edited:

- `prototype-web/src/ui/hud.ts`
- `prototype-web/src/style.css`
- `design/technical/redline-batches/2026-05-18-batch-h2-hud-ux.md`

No runtime, sim, data, renderer, or test files were changed by this pass.

## Intent

Move the visible UI subject away from realtime pressure / burst heat and toward hyper-turn card-chain decisions:

- current turn chain route
- next expected MP cost
- readable enemy intent
- payoff preview before playing a card

The HUD stays compact. This pass does not turn the prototype into a slow card-table layout.

## Patch Manifest

- `prototype-web/src/ui/hud.ts`
  - Imports enemy definitions read-only to infer front-row intent damage because `EnemySnapshot` does not yet expose damage.
  - Replaces the combat director content with chain route, next expected MP, enemy intent, and payoff preview.
  - Adds a top-level enemy intent chip and End Turn consequence text.
  - Promotes card MP cost to the first visual element and demotes hotkeys.
  - Adds chain-match and chain-break card states from existing `lastPlayedCost`, `costChainMultiplier`, hand, and energy.
  - Adds payoff labels using current inferred multiplier and existing card damage/draw metadata.
  - Keeps debug trace as collapsed `details`.
- `prototype-web/src/style.css`
  - Adds intent chip styling and danger state.
  - Adds compact chain/payoff director styling.
  - Adds card cost badges, chain continuation glow, and break-risk warning.
  - Keeps 390x844 mobile top HUD to HP, MP, CHAIN, and enemy intent by hiding LV/FSM/pile/restart in the top strip.

## Runtime Data Fallbacks

Runtime has not yet provided dedicated `EnemyIntent`, `ChainState`, or `PayoffRule` snapshot fields. This pass therefore derives UI from existing state:

- chain state: `snapshot.player.lastPlayedCost` and `snapshot.player.costChainMultiplier`
- next expected cost: `lastPlayedCost + 1`, or MP0 when no chain has started
- playable / break-risk cards: `snapshot.player.hand`, card cost, current energy, and player-turn FSM
- enemy intent damage: alive front-row enemy snapshots plus read-only enemy definitions
- payoff preview: card `comboNode`, cost, target scope, damage, draw, and inferred chain multiplier

Follow-up contract points for Runtime worker:

- expose `snapshot.chain.playedCosts`, `snapshot.chain.nextExpectedCost`, and `snapshot.chain.breakReason`
- expose `snapshot.enemyIntents` with damage and special consequences instead of requiring HUD to map definitions
- expose `snapshot.payoffPreviewByCardId` once payoff rules diverge from simple damage multiplier
- expose resolved target/kill preview if target selection becomes deterministic

## Acceptance Notes

- Card MP cost is visually dominant; hotkey is secondary.
- Continuation cards are highlighted when they match the next expected MP cost.
- Break-risk cards are still playable but warn that the chain drops to x1.
- Payoff cards show projected payoff value with the inferred multiplier.
- End Turn surface shows unresolved damage near the button.
- Debug trace remains available but is not a first-screen subject.
