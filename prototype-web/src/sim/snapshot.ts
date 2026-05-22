import { createBuildPlan } from './buildPlan';
import { cloneActivityState } from './activity';
import type { GameSnapshot, WorldState } from './types';

function snapshotRoute(world: WorldState): GameSnapshot['route'] {
  if (!world.route) {
    return undefined;
  }

  return {
    pendingNodeChoices: world.route.pendingNodeChoices.map((candidate) => ({
      ...candidate,
      routePressure: candidate.routePressure ? { ...candidate.routePressure } : undefined,
      nextBattleContext: { ...candidate.nextBattleContext }
    })),
    nextBattleContext: world.route.nextBattleContext ? { ...world.route.nextBattleContext } : null,
    history: world.route.history.map((entry) => ({
      ...entry,
      context: { ...entry.context }
    }))
  };
}

export function buildSnapshot(world: WorldState): GameSnapshot {
  return {
    tick: world.tick,
    round: world.round,
    elapsedSeconds: world.elapsedSeconds,
    player: {
      ...world.player,
      deck: [...world.player.deck],
      hand: [...world.player.hand],
      drawPile: [...world.player.drawPile],
      discardPile: [...world.player.discardPile],
      exhaustPile: [...world.player.exhaustPile],
      retainedCards: [...world.player.retainedCards]
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
    run: {
      ...world.run,
      rewardHistory: world.run.rewardHistory.map((entry) => ({
        ...entry,
        choices: [...entry.choices]
      }))
    },
    activity: world.activity ? cloneActivityState(world.activity) : undefined,
    activitySettlementPreview: world.activitySettlementPreview ? { ...world.activitySettlementPreview } : null,
    route: snapshotRoute(world),
    buildPlan: createBuildPlan(world),
    reward: {
      ...world.reward,
      candidateCardPool: [...world.reward.candidateCardPool],
      choices: [...world.reward.choices]
    },
    cardUpgrades: {
      enhancements: Object.fromEntries(
        Object.entries(world.cardUpgrades.enhancements).map(([cardId, enhancement]) => [
          cardId,
          enhancement
            ? {
                ...enhancement,
                gemSlots: enhancement.gemSlots.map((slot) => ({ ...slot }))
              }
            : enhancement
        ])
      ),
      choices: world.cardUpgrades.choices.map((choice) => ({ ...choice })),
      pending: world.cardUpgrades.pending,
      history: world.cardUpgrades.history.map((entry) => ({
        ...entry,
        gemSlots: entry.gemSlots.map((slot) => ({ ...slot }))
      }))
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
