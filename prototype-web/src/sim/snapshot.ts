import type { GameSnapshot, WorldState } from './types';

export function buildSnapshot(world: WorldState): GameSnapshot {
  return {
    tick: world.tick,
    round: world.round,
    elapsedSeconds: world.elapsedSeconds,
    player: {
      ...world.player,
      hand: [...world.player.hand],
      drawPile: [...world.player.drawPile],
      discardPile: [...world.player.discardPile]
    },
    chain: {
      ...world.chain,
      playedCosts: [...world.chain.playedCosts]
    },
    enemies: Object.values(world.enemies).map((enemy) => ({ ...enemy })),
    enemyIntents: Object.values(world.enemyIntents).map((intent) => ({ ...intent })),
    enemyIntentSummary: {
      totalDamage: world.enemyIntentSummary.totalDamage,
      intentEnemyIds: [...world.enemyIntentSummary.intentEnemyIds]
    },
    fsm: {
      gameFlow: world.fsm.gameFlow,
      characters: { ...world.fsm.characters }
    },
    reward: {
      ...world.reward,
      candidateCardPool: [...world.reward.candidateCardPool],
      choices: [...world.reward.choices]
    },
    debug: {
      events: [...world.debug.events],
      commands: [...world.debug.commands],
      failedConditions: [...world.debug.failedConditions],
      ruleHits: [...world.debug.ruleHits],
      trace: [...world.debug.trace]
    },
    lastBurstTick: world.lastBurstTick
  };
}
