import { describe, expect, it } from 'vitest';
import { tickWorld } from '../../sim/runtime';
import { createInitialWorld } from '../../sim/world';
import type { GameEvent, WorldState } from '../../sim/types';

type TimedEvent = {
  elapsedSeconds: number;
  event: GameEvent;
};

function tickAndCollect(world: WorldState, elapsedSeconds: number, timedEvents: TimedEvent[]): void {
  tickWorld(world, [
    {
      type: 'advance-time',
      deltaSeconds: 1,
      traceId: `acceptance-heartbeat-${elapsedSeconds}`
    }
  ]);
  collectCurrentTickEvents(world, elapsedSeconds, timedEvents);
}

function collectCurrentTickEvents(world: WorldState, elapsedSeconds: number, timedEvents: TimedEvent[]): void {
  for (const event of world.debug.events.filter((item) => item.tick === world.tick)) {
    timedEvents.push({ elapsedSeconds, event });
  }
}

function firstFrontThreatId(world: WorldState): string | undefined {
  return Object.values(world.enemies)
    .filter((enemy) => enemy.alive && enemy.slot >= 0)
    .sort((a, b) => a.slot - b.slot)[0]?.id;
}

function activeThreatCount(world: WorldState): number {
  return Object.values(world.enemies).filter((enemy) => enemy.alive && enemy.slot >= 0 && enemy.slot < world.maxEnemySlots).length;
}

function nearestThreatZ(world: WorldState): number {
  return Math.max(...Object.values(world.enemies).filter((enemy) => enemy.alive).map((enemy) => enemy.z));
}

function playAccelerationCard(
  world: WorldState,
  elapsedSeconds: number,
  timedEvents: TimedEvent[],
  cardId: string
): void {
  if (world.fsm.gameFlow !== 'PlayerTurn' || !world.player.hand.includes(cardId)) {
    return;
  }

  tickWorld(world, [
    {
      type: 'play-card',
      cardId,
      targetId: firstFrontThreatId(world),
      traceId: `acceptance-manual-${elapsedSeconds}-${cardId}`
    }
  ]);
  collectCurrentTickEvents(world, elapsedSeconds, timedEvents);
}

function runNinetySecondSlice(): { world: WorldState; timedEvents: TimedEvent[]; activeThreatSamples: number[] } {
  const world = createInitialWorld();
  const timedEvents: TimedEvent[] = [];
  const activeThreatSamples: number[] = [];
  const manualAccelerationPlan: Record<number, string[]> = {
    2: ['debt_hook'],
    3: ['redline_cut'],
    4: ['row_cleave'],
    65: ['severance_burst', 'red_ledger_burst']
  };

  for (let second = 1; second <= 90; second += 1) {
    tickAndCollect(world, second, timedEvents);

    for (const cardId of manualAccelerationPlan[second] ?? []) {
      playAccelerationCard(world, second, timedEvents, cardId);
    }

    activeThreatSamples.push(activeThreatCount(world));
  }

  return { world, timedEvents, activeThreatSamples };
}

function killEvents(timedEvents: TimedEvent[]): TimedEvent[] {
  return timedEvents.filter(({ event }) => event.type === 'EnemyKilled');
}

function maxKillsInOneSecond(timedEvents: TimedEvent[], startSecond: number, endSecond: number): number {
  const killsBySecond = new Map<number, number>();

  for (const { elapsedSeconds, event } of timedEvents) {
    if (event.type !== 'EnemyKilled' || elapsedSeconds < startSecond || elapsedSeconds > endSecond) {
      continue;
    }
    killsBySecond.set(elapsedSeconds, (killsBySecond.get(elapsedSeconds) ?? 0) + 1);
  }

  return Math.max(0, ...killsBySecond.values());
}

describe.skip('Deprecated Redline 90s realtime heartbeat acceptance contract', () => {
  it('keeps the player operable, produces early kills, and creates a late clear window inside 90 seconds', () => {
    const { world, timedEvents, activeThreatSamples } = runNinetySecondSlice();
    const kills = killEvents(timedEvents);
    const firstOperableSecond = timedEvents.find(({ event }) => event.type === 'HandDealt')?.elapsedSeconds;
    const firstKillSecond = kills[0]?.elapsedSeconds;
    const killsByThirtySeconds = kills.filter(({ elapsedSeconds }) => elapsedSeconds <= 30).length;
    const burstEventsInClearWindow = timedEvents.filter(
      ({ elapsedSeconds, event }) => elapsedSeconds >= 60 && elapsedSeconds <= 90 && event.type === 'ClearBurstRequested'
    );
    const largestClearWindowKillBurst = maxKillsInOneSecond(timedEvents, 60, 90);
    const lowestThreatCountInClearWindow = Math.min(...activeThreatSamples.slice(59));
    const traceLabels = new Set(world.debug.trace.map((entry) => entry.label));
    const clearOrNearClearObserved =
      largestClearWindowKillBurst >= 5 || (burstEventsInClearWindow.length > 0 && lowestThreatCountInClearWindow <= 3);

    const failures = [
      firstOperableSecond === undefined || firstOperableSecond > 3
        ? `expected operable hand/input by 3s, got ${firstOperableSecond ?? 'never'}`
        : null,
      firstKillSecond === undefined || firstKillSecond > 10
        ? `expected first kill by 10s, got ${firstKillSecond ?? 'never'}`
        : null,
      killsByThirtySeconds < 6 ? `expected at least 6 kill feedback events by 30s, got ${killsByThirtySeconds}` : null,
      !clearOrNearClearObserved
        ? `expected one clear or near-clear event between 60-90s, got max ${largestClearWindowKillBurst} kills/s, ${burstEventsInClearWindow.length} burst trace events, lowest active threats ${lowestThreatCountInClearWindow}`
        : null,
      !traceLabels.has('AutoAttack') ? 'expected AutoAttack trace evidence for heartbeat combat' : null,
      !traceLabels.has('EnemyAdvanced') ? 'expected EnemyAdvanced trace evidence for enemy movement' : null,
      !traceLabels.has('EnemyPressure') ? 'expected EnemyPressure trace evidence for time pressure' : null,
      !traceLabels.has('ClearBurst') && !traceLabels.has('ClearBurstRequested')
        ? 'expected ClearBurst trace evidence for the 60-90s burst window'
        : null,
      world.debug.trace.length === 0 ? 'expected trace evidence to be recorded for replay/debug review' : null
    ].filter((failure): failure is string => Boolean(failure));

    expect(failures).toEqual([]);
  });

  it('advances enemies and creates pressure when the player does not interact', () => {
    const world = createInitialWorld();
    const timedEvents: TimedEvent[] = [];
    const initialNearestThreatZ = nearestThreatZ(world);
    const initialPlayerHp = world.player.hp;

    for (let second = 1; second <= 15; second += 1) {
      tickAndCollect(world, second, timedEvents);
    }

    const pressureEvents = timedEvents.filter(({ event }) => event.type === 'EnemyAttacked');
    const nearestThreatMovedTowardPlayer = nearestThreatZ(world) > initialNearestThreatZ;
    const playerTookDamage = world.player.hp < initialPlayerHp;

    expect({
      nearestThreatMovedTowardPlayer,
      playerTookDamage,
      pressureEventCount: pressureEvents.length
    }).toMatchObject({
      nearestThreatMovedTowardPlayer: true,
      playerTookDamage: true
    });
  });
});
