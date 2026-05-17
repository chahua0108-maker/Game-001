import './style.css';
import { bindKeyboard, nextTraceId } from './input/keyboard';
import { CorridorRenderer } from './presentation/renderer/corridorRenderer';
import { buildSnapshot } from './sim/snapshot';
import { tickWorld } from './sim/runtime';
import { createInitialWorld } from './sim/world';
import { Hud } from './ui/hud';
import type { Intent } from './sim/types';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const hudRoot = document.querySelector<HTMLElement>('#hud');

if (!canvas || !hudRoot) {
  throw new Error('Missing app roots');
}

let world = createInitialWorld();
const pendingIntents: Intent[] = [];
const renderer = new CorridorRenderer(canvas);
const hud = new Hud(hudRoot, (intent) => pendingIntents.push(intent));

bindKeyboard(() => world.player.hand, (intent) => pendingIntents.push(intent));

let lastTime = performance.now();

function frame(now: number): void {
  const deltaSeconds = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  pendingIntents.push({
    type: 'advance-time',
    deltaSeconds,
    traceId: nextTraceId('tick')
  });

  world = tickWorld(world, pendingIntents.splice(0));
  const snapshot = buildSnapshot(world);
  renderer.render(snapshot);
  hud.render(snapshot);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
