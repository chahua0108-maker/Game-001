# Redline Batch 02 - Presentation HUD

> Deprecated: 这是被用户否决的 `Redline 90s realtime heartbeat` 方向批次记录。当前有效方向是 `redline-hyperturn-acceptance.md`；本文只保留为失败路径证据，不再作为 runtime、HUD、QA 的执行依据。

Date: 2026-05-18
Owner: Combat Presentation & HUD Director

## Scope

Allowed presentation files only:

- `prototype-web/src/ui/hud.ts`
- `prototype-web/src/style.css`
- `prototype-web/src/presentation/renderer/corridorRenderer.ts`

No runtime, sim, data, or test files were changed by this pass.

## Experience Hypotheses

1. The first HUD read should answer: what is threatening me, what can I do now, did I kill something, and am I near a clear.
2. Debug trace should remain available for development review but should no longer define the first screen.
3. Existing runtime events are enough to sell Redline combat beats: hit line, kill flash, burst shock, and enemies pressing forward.
4. On a 390x844 mobile viewport, the bottom card/action row must remain the primary operation surface.

## Patch Manifest

- `prototype-web/src/ui/hud.ts`
  - Adds a combat director HUD strip for current threat, available verbs, kill/streak count, and Burst/Clear status.
  - Uses only existing snapshot/debug event data: `EnemyKilled`, `lastBurstTick`, `player.combo`, hand costs, and enemy slots.
- `prototype-web/src/style.css`
  - Makes the new combat director the primary read while pushing debug trace into a low-priority collapsed panel.
  - Adds mobile breakpoints that keep the bottom card row clear and move status panels into the upper viewport.
- `prototype-web/src/presentation/renderer/corridorRenderer.ts`
  - Converts existing `DamageApplied`, `EnemyKilled`, `ClearBurstRequested`, and `EnemyAttacked` events into slash lines, kill flashes, burst corridor shock, and enemy advance pulses.

## QA Focus

- Desktop first viewport should read as a combat screen, not a debug table.
- Mobile 390x844 should keep bottom cards tappable and unobscured.
- Burst cards or `ClearBurstRequested` should produce a visible corridor shock without hiding enemy positions.
- Killing a front enemy should show a quick slash/flash and make the next enemy push forward perceptible.
