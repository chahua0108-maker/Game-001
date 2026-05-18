# Redline Hyper-Turn Batch H2 - Combat VFX

Date: 2026-05-18
Owner: Combat VFX & Feedback Engineer

## Scope

Allowed files touched:

- `prototype-web/src/presentation/renderer/corridorRenderer.ts`
- `design/technical/redline-batches/2026-05-18-batch-h2-combat-vfx.md`

No runtime, sim, data, HUD, CSS, or tests were changed.

## Retained Feedback

- Redline slash lines remain the primary hit read.
- Kill/payoff flash remains on enemy death and uses the existing death burst.
- Clear burst still uses the corridor shock wave, camera compression, light pulse, and all-enemy slash sweep.
- Enemy slot interpolation remains as positional state readability, but no longer creates a main VFX beat by itself.

## Deprecated Trigger Semantics

These events are now ignored by renderer VFX dispatch and should not be used as core combat feedback triggers:

- `AutoAttack`
- `EnemyAdvanced`
- `EnemyPressure`
- `EnemyAttacked`

The old presentation problem was that attack cadence and time heartbeat could make the screen feel active even when the player had not advanced a card chain. Hyper-Turn combat should read from player-resolution semantics first.

## Current Trigger Semantics

Current runtime events are mapped as follows:

| Event | VFX role |
| --- | --- |
| `CardPlayed` | Starts card-chain pulse on the target, front row, all enemies, or a small global self-card pulse. |
| `DamageApplied` | Draws the Redline slash when damage is tied to a card or matching card trace. |
| `EnemyKilled` | Marks payoff/killing flash and emits a heavier slash when tied to a card trace. |
| `ClearBurstRequested` | Triggers the retained clear shock wave and all-enemy execution sweep. |

Because current runtime emits `DamageApplied` before `CardPlayed` on the same trace, the renderer first indexes `CardPlayed` events by `traceId` and then applies damage/kill VFX through that card context.

## Future Runtime Hook Point

`corridorRenderer.ts` now has one centralized future hook section for:

- `ChainAdvanced`
- `PayoffTriggered`
- `EnemyIntentResolved`

When Runtime worker adds those events, they should connect there instead of reviving the old heartbeat/auto-attack dispatch path.

## Patch Manifest

- `prototype-web/src/presentation/renderer/corridorRenderer.ts`
  - Removed old `EnemyAttacked` presentation dispatch and `seenAttackEvents`.
  - Added card trace indexing so damage and kills resolve as card-chain feedback.
  - Added `chainStartedAt`, `payoffStartedAt`, and `intentStartedAt` mesh pulses.
  - Kept slash lines, kill flashes, and clear burst shock while changing the trigger source.
  - Explicitly ignores old `AutoAttack`, `EnemyAdvanced`, `EnemyPressure`, and `EnemyAttacked` events for VFX.
- `design/technical/redline-batches/2026-05-18-batch-h2-combat-vfx.md`
  - Records retained feedback, deprecated old semantics, current event mapping, and future hook points.
