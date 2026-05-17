import { cards } from '../data/cards';
import { setCharacterState, setGameFlowState } from '../fsm/stateMachine';
import { evaluateRules } from '../eca/ruleSet';
import { redlineRules } from '../eca/redlineRules';
import { ENEMY_COLUMNS, ENEMY_ROWS, createEnemy, createInitialWorld, slotToLane, slotToZ } from './world';
import type { CardId, Command, EntityId, GameEvent, Intent, TraceEntry, TraceId, WorldState } from './types';

const DEBUG_LIMIT = 80;
const HAND_SIZE = 4;
const LEVEL_XP_THRESHOLDS = [0, 18, 42, 78, 125, 185];

function pushTrace(world: WorldState, entry: TraceEntry): void {
  world.debug.trace.push(entry);
  world.debug.trace = world.debug.trace.slice(-DEBUG_LIMIT);
}

function pushEvent(world: WorldState, event: GameEvent): void {
  world.debug.events.push(event);
  world.debug.events = world.debug.events.slice(-DEBUG_LIMIT);
  pushTrace(world, {
    tick: world.tick,
    traceId: event.traceId,
    kind: 'event',
    label: event.type
  });
}

function pushCommand(world: WorldState, command: Command): void {
  world.debug.commands.push(command);
  world.debug.commands = world.debug.commands.slice(-DEBUG_LIMIT);
  pushTrace(world, {
    tick: world.tick,
    traceId: command.traceId,
    kind: 'command',
    label: command.type
  });
}

function createEventFromIntent(world: WorldState, intent: Intent): GameEvent[] {
  const base: GameEvent = {
    type: 'IntentReceived',
    tick: world.tick,
    traceId: intent.traceId,
    intentType: intent.type
  };

  if (intent.type === 'advance-time') {
    return [
      base,
      {
        type: 'TimeAdvanced',
        tick: world.tick,
        traceId: intent.traceId,
        deltaSeconds: intent.deltaSeconds
      }
    ];
  }

  if (intent.type === 'play-card') {
    return [base];
  }

  return [base];
}

function randomFrontRowEnemyId(world: WorldState): EntityId | undefined {
  const enemies = frontRowAliveEnemies(world);
  if (enemies.length === 0) {
    return undefined;
  }

  const index = Math.min(enemies.length - 1, Math.floor(Math.random() * enemies.length));
  return enemies[index].id;
}

function activeAliveEnemies(world: WorldState) {
  return Object.values(world.enemies)
    .filter((enemy) => enemy.alive && enemy.slot >= 0 && enemy.slot < world.maxEnemySlots)
    .sort((a, b) => a.slot - b.slot);
}

function frontRowAliveEnemies(world: WorldState) {
  return activeAliveEnemies(world).filter((enemy) => enemy.slot < ENEMY_COLUMNS);
}

function snapshotRoundAttackEnemies(world: WorldState): void {
  world.roundAttackEnemyIds = frontRowAliveEnemies(world).map((enemy) => enemy.id);
}

function roundAttackEligibleEnemies(world: WorldState) {
  return world.roundAttackEnemyIds
    .map((enemyId) => world.enemies[enemyId])
    .filter((enemy): enemy is NonNullable<typeof enemy> => Boolean(enemy?.alive && enemy.slot >= 0 && enemy.slot < ENEMY_COLUMNS));
}

function enemyColumn(enemy: { slot: number }): number {
  return enemy.slot % ENEMY_COLUMNS;
}

function columnSlot(column: number, row: number): number {
  return row * ENEMY_COLUMNS + column;
}

function setEnemySlot(enemy: ReturnType<typeof activeAliveEnemies>[number], slot: number): void {
  enemy.slot = slot;
  enemy.lane = slotToLane(slot);
  enemy.z = slotToZ(slot);
}

function nextLevelXp(level: number): number {
  return LEVEL_XP_THRESHOLDS[level] ?? LEVEL_XP_THRESHOLDS[LEVEL_XP_THRESHOLDS.length - 1] + (level - 5) * 75;
}

function splitDiscardForReshuffle(discardPile: CardId[], excludeFromReshuffle: CardId[]): { reshuffle: CardId[]; kept: CardId[] } {
  const reshuffle = [...discardPile];
  const kept: CardId[] = [];

  for (const cardId of excludeFromReshuffle) {
    const index = reshuffle.lastIndexOf(cardId);
    if (index >= 0) {
      kept.unshift(...reshuffle.splice(index, 1));
    }
  }

  return { reshuffle, kept };
}

function drawCardsFromDeck(world: WorldState, count: number, excludeFromReshuffle: CardId[] = []): CardId[] {
  const drawn: CardId[] = [];

  while (drawn.length < count) {
    if (world.player.drawPile.length === 0) {
      if (world.player.discardPile.length === 0) {
        break;
      }
      const nextPiles = splitDiscardForReshuffle(world.player.discardPile, excludeFromReshuffle);
      if (nextPiles.reshuffle.length === 0) {
        world.player.discardPile = nextPiles.kept;
        break;
      }
      world.player.drawPile = nextPiles.reshuffle;
      world.player.discardPile = nextPiles.kept;
    }

    const cardId = world.player.drawPile.shift();
    if (cardId) {
      drawn.push(cardId);
    }
  }

  return drawn;
}

function resetCostChain(world: WorldState): void {
  world.player.lastPlayedCost = null;
  world.player.costChainMultiplier = 1;
}

function advanceCostChain(world: WorldState, cost: number): number {
  const continues = world.player.lastPlayedCost !== null && cost === world.player.lastPlayedCost + 1;
  const multiplier = continues ? world.player.costChainMultiplier + 1 : 1;
  world.player.lastPlayedCost = cost;
  world.player.costChainMultiplier = multiplier;
  return multiplier;
}

function generateRewardChoices(world: WorldState): CardId[] {
  return world.reward.candidateCardPool.filter((cardId) => cards[cardId]).slice(0, world.reward.pickCount);
}

function validatePlayCard(world: WorldState, intent: Extract<Intent, { type: 'play-card' }>): Command[] {
  const card = cards[intent.cardId];
  const commands: Command[] = [];

  if (!card) {
    world.debug.failedConditions.push({
      tick: world.tick,
      traceId: intent.traceId,
      ruleId: 'intent.play-card',
      conditionId: 'card-exists',
      reason: `unknown card ${intent.cardId}`
    });
    return [];
  }

  if (world.fsm.gameFlow !== 'PlayerTurn') {
    world.debug.failedConditions.push({
      tick: world.tick,
      traceId: intent.traceId,
      ruleId: 'intent.play-card',
      conditionId: 'player-turn',
      reason: 'cards can only be played during player turn'
    });
    return [];
  }

  if (!world.player.hand.includes(card.id)) {
    world.debug.failedConditions.push({
      tick: world.tick,
      traceId: intent.traceId,
      ruleId: 'intent.play-card',
      conditionId: 'card-in-hand',
      reason: `${card.id} is not in hand`
    });
    return [];
  }

  if (world.player.energy < card.cost) {
    world.debug.failedConditions.push({
      tick: world.tick,
      traceId: intent.traceId,
      ruleId: 'intent.play-card',
      conditionId: 'enough-energy',
      reason: `need ${card.cost} energy`
    });
    return [];
  }

  if (card.targets === 'front-enemy') {
    const target = intent.targetId ? world.enemies[intent.targetId] : undefined;
    if (!target?.alive) {
      world.debug.failedConditions.push({
        tick: world.tick,
        traceId: intent.traceId,
        ruleId: 'intent.play-card',
        conditionId: 'target-alive',
        reason: 'no alive front target'
      });
      return [];
    }
    if (target.slot < 0 || target.slot >= ENEMY_COLUMNS) {
      world.debug.failedConditions.push({
        tick: world.tick,
        traceId: intent.traceId,
        ruleId: 'intent.play-card',
        conditionId: 'front-target',
        reason: 'front-enemy cards can only target first-row enemies'
      });
      return [];
    }
  }

  if (card.targets === 'front-row' && frontRowAliveEnemies(world).length === 0) {
    world.debug.failedConditions.push({
      tick: world.tick,
      traceId: intent.traceId,
      ruleId: 'intent.play-card',
      conditionId: 'target-alive',
      reason: 'no alive front-row targets'
    });
    return [];
  }

  if (card.targets === 'all-enemies' && !Object.values(world.enemies).some((enemy) => enemy.alive)) {
    world.debug.failedConditions.push({
      tick: world.tick,
      traceId: intent.traceId,
      ruleId: 'intent.play-card',
      conditionId: 'target-alive',
      reason: 'no alive targets'
    });
    return [];
  }

  commands.push({
    type: 'SpendEnergy',
    traceId: intent.traceId,
    amount: card.cost,
    cardId: card.id
  });

  commands.push({
    type: 'DiscardPlayedCard',
    traceId: intent.traceId,
    cardId: card.id
  });

  commands.push(...setCharacterState(world, 'player', 'Cast', `played ${card.id}`, intent.traceId));
  return commands;
}

function dealIntoPlayerTurn(world: WorldState, traceId: TraceId, reason: string): GameEvent[] {
  const events = applyCommand(world, {
    type: 'DealHand',
    traceId,
    count: HAND_SIZE
  });

  for (const command of setGameFlowState(world, 'PlayerTurn', reason, traceId)) {
    events.push(...applyCommand(world, command));
  }

  return events;
}

function applyCommand(world: WorldState, command: Command): GameEvent[] {
  pushCommand(world, command);

  switch (command.type) {
    case 'DealHand': {
      snapshotRoundAttackEnemies(world);
      const dealtCards = drawCardsFromDeck(world, command.count);
      resetCostChain(world);
      world.player.hand = dealtCards;
      world.player.energy = world.player.maxEnergy;
      return [
        {
          type: 'HandDealt',
          tick: world.tick,
          traceId: command.traceId,
          cardIds: [...dealtCards]
        }
      ];
    }
    case 'DiscardHand':
      world.player.discardPile.push(...world.player.hand);
      world.player.hand = [];
      return [];
    case 'SpendEnergy':
      world.player.energy = Math.max(0, world.player.energy - command.amount);
      return [];
    case 'DiscardPlayedCard': {
      const index = world.player.hand.indexOf(command.cardId);
      if (index >= 0) {
        world.player.hand.splice(index, 1);
        world.player.discardPile.push(command.cardId);
      }
      return [];
    }
    case 'GainXp': {
      world.player.xp += command.amount;
      const xpEvent: GameEvent = {
        type: 'XpGained',
        tick: world.tick,
        traceId: command.traceId,
        amount: command.amount,
        sourceId: command.sourceId,
        totalXp: world.player.xp
      };

      if (world.player.xp < world.reward.xpThreshold || world.reward.pending) {
        return [xpEvent];
      }

      world.player.level += 1;
      world.reward.pending = true;
      world.reward.source = 'level-up';
      world.reward.choices = generateRewardChoices(world);
      const levelEvent: GameEvent = {
        type: 'LevelUpReached',
        tick: world.tick,
        traceId: command.traceId,
        level: world.player.level,
        xpThreshold: world.reward.xpThreshold
      };
      const choicesEvent: GameEvent = {
        type: 'RewardChoicesGenerated',
        tick: world.tick,
        traceId: command.traceId,
        choices: [...world.reward.choices]
      };
      world.reward.xpThreshold = nextLevelXp(world.player.level);
      return [
        xpEvent,
        levelEvent,
        choicesEvent,
        ...setGameFlowState(world, 'Reward', 'level-up reward ready', command.traceId).flatMap((next) =>
          applyCommand(world, next)
        )
      ];
    }
    case 'AddCardToDeck': {
      world.player.deck.push(command.cardId);
      world.player.drawPile.push(command.cardId);
      world.reward.candidateCardPool = world.reward.candidateCardPool.filter((cardId) => cardId !== command.cardId);
      return [
        {
          type: 'CardAddedToDeck',
          tick: world.tick,
          traceId: command.traceId,
          cardId: command.cardId,
          deckSize: world.player.deck.length
        }
      ];
    }
    case 'ClearRewardChoices':
      world.reward.choices = [];
      world.reward.pending = false;
      world.reward.source = null;
      return [];
    case 'DrawCards': {
      const drawn = drawCardsFromDeck(world, command.count, command.excludeFromReshuffle);
      world.player.hand.push(...drawn);
      return drawn.length > 0
        ? [
            {
              type: 'HandDealt',
              tick: world.tick,
              traceId: command.traceId,
              cardIds: drawn
            }
          ]
        : [];
    }
    case 'DamageEnemy': {
      const enemy = world.enemies[command.targetId];
      if (!enemy || !enemy.alive) {
        return [];
      }
      enemy.hp = Math.max(0, enemy.hp - command.amount);
      const damageEvent: GameEvent = {
        type: 'DamageApplied',
        tick: world.tick,
        traceId: command.traceId,
        sourceId: command.sourceId,
        targetId: command.targetId,
        amount: command.amount,
        remainingHp: enemy.hp,
        cardId: command.cardId
      };

      if (enemy.hp <= 0) {
        enemy.alive = false;
        return [
          damageEvent,
          {
            type: 'EnemyKilled',
            tick: world.tick,
            traceId: command.traceId,
            enemyId: enemy.id,
            cardId: command.cardId
          }
        ];
      }

      return [damageEvent];
    }
    case 'AdvanceEnemy': {
      const enemy = world.enemies[command.enemyId];
      if (enemy?.alive) {
        enemy.z = Math.min(-1.3, enemy.z + command.deltaZ);
      }
      return [];
    }
    case 'EnemyAttack': {
      const enemy = world.enemies[command.enemyId];
      if (!enemy?.alive) {
        return [];
      }
      world.player.hp = Math.max(0, world.player.hp - enemy.damage);
      const attackEvent: GameEvent = {
        type: 'EnemyAttacked',
        tick: world.tick,
        traceId: command.traceId,
        enemyId: enemy.id,
        amount: enemy.damage,
        remainingHp: world.player.hp
      };
      if (world.player.hp <= 0) {
        return [
          attackEvent,
          ...setGameFlowState(world, 'Settlement', 'player died', command.traceId).flatMap((next) =>
            applyCommand(world, next)
          )
        ];
      }
      return [attackEvent];
    }
    case 'CompactEnemySlots': {
      const active = activeAliveEnemies(world);
      for (let column = 0; column < ENEMY_COLUMNS; column += 1) {
        active
          .filter((enemy) => enemyColumn(enemy) === column)
          .forEach((enemy, row) => setEnemySlot(enemy, columnSlot(column, row)));
      }
      return [];
    }
    case 'FillEnemySlots': {
      for (let column = 0; column < ENEMY_COLUMNS; column += 1) {
        const columnActive = activeAliveEnemies(world).filter((enemy) => enemyColumn(enemy) === column);
        for (let row = columnActive.length; row < ENEMY_ROWS; row += 1) {
          const enemy = createEnemy(world.nextEnemySerial, columnSlot(column, row));
          world.nextEnemySerial += 1;
          world.enemies[enemy.id] = enemy;
          world.fsm.characters[enemy.id] = 'Move';
        }
      }
      const active = activeAliveEnemies(world);
      return [
        {
          type: 'EnemiesRepositioned',
          tick: world.tick,
          traceId: command.traceId,
          activeEnemyIds: active.map((enemy) => enemy.id)
        }
      ];
    }
    case 'AdvanceRound':
      world.round += 1;
      return [
        {
          type: 'RoundStarted',
          tick: world.tick,
          traceId: command.traceId,
          round: world.round
        }
      ];
    case 'DamagePlayer':
      world.player.hp = Math.max(0, world.player.hp - command.amount);
      if (world.enemies[command.sourceId]?.alive) {
        world.enemies[command.sourceId].z = -12;
      }
      if (world.player.hp <= 0) {
        return [
          ...setGameFlowState(world, 'Settlement', 'player died', command.traceId).flatMap((next) => applyCommand(world, next))
        ];
      }
      return [];
    case 'SetCharacterState':
      world.fsm.characters[command.entityId] = command.state;
      pushTrace(world, {
        tick: world.tick,
        traceId: command.traceId,
        kind: 'fsm',
        label: `${command.entityId} -> ${command.state}: ${command.reason}`
      });
      return [];
    case 'SetGameFlowState':
      world.fsm.gameFlow = command.state;
      if (command.state !== 'PlayerTurn') {
        resetCostChain(world);
      }
      pushTrace(world, {
        tick: world.tick,
        traceId: command.traceId,
        kind: 'fsm',
        label: `gameFlow -> ${command.state}: ${command.reason}`
      });
      return [];
    case 'SetCombo':
      world.player.combo = Math.max(0, command.value);
      if (world.player.combo >= 3) {
        world.player.combo = 0;
      }
      return [];
    case 'ClearBurst':
      world.lastBurstTick = world.tick;
      return [
        {
          type: 'ClearBurstRequested',
          tick: world.tick,
          traceId: command.traceId,
          cardId: command.cardId
        }
      ];
  }
}

function resetCastState(world: WorldState, traceId: TraceId): Command[] {
  if (world.fsm.characters.player !== 'Cast') {
    return [];
  }

  return [
    {
      type: 'SetCharacterState',
      traceId,
      entityId: 'player',
      state: 'Idle',
      reason: 'cast resolved'
    }
  ];
}

function processEventQueue(world: WorldState, queue: GameEvent[]): void {
  while (queue.length > 0) {
    const event = queue.shift();
    if (!event) {
      break;
    }

    pushEvent(world, event);

    for (const result of evaluateRules(redlineRules, world, event)) {
      world.debug.ruleHits.push(result.hit);
      world.debug.ruleHits = world.debug.ruleHits.slice(-DEBUG_LIMIT);
      pushTrace(world, {
        tick: world.tick,
        traceId: event.traceId,
        kind: 'rule',
        label: `${result.hit.ruleId}: ${result.hit.passed ? 'passed' : 'failed'}`
      });

      for (const failed of result.failedConditions) {
        world.debug.failedConditions.push(failed);
        world.debug.failedConditions = world.debug.failedConditions.slice(-DEBUG_LIMIT);
        pushTrace(world, {
          tick: world.tick,
          traceId: failed.traceId,
          kind: 'condition',
          label: `${failed.conditionId}: ${failed.reason}`
        });
      }

      for (const command of result.commands) {
        const resolvedCommand =
          command.type === 'DrawCards' && event.type === 'CardPlayed'
            ? { ...command, excludeFromReshuffle: [event.cardId] }
            : command;
        queue.push(...applyCommand(world, resolvedCommand));
      }
    }
  }
}

function recordStaleIntentAfterTurnEnd(world: WorldState, intent: Intent): void {
  for (const event of createEventFromIntent(world, intent)) {
    pushEvent(world, event);
  }

  world.debug.failedConditions.push({
    tick: world.tick,
    traceId: intent.traceId,
    ruleId: `intent.${intent.type}`,
    conditionId: 'stale-intent-after-turn-end',
    reason: 'player input arrived after this tick already ended the turn'
  });
  world.debug.failedConditions = world.debug.failedConditions.slice(-DEBUG_LIMIT);
  pushTrace(world, {
    tick: world.tick,
    traceId: intent.traceId,
    kind: 'condition',
    label: 'stale-intent-after-turn-end: player input arrived after this tick already ended the turn'
  });
}

function isPlayerIntent(intent: Intent): boolean {
  return intent.type === 'deal-hand' || intent.type === 'play-card' || intent.type === 'end-turn';
}

export function tickWorld(current: WorldState, intents: Intent[]): WorldState {
  if (intents.some((intent) => intent.type === 'restart-run')) {
    return createInitialWorld();
  }

  const world = current;
  world.tick += 1;
  let playerInputClosed = false;

  for (const intent of intents) {
    if (playerInputClosed && isPlayerIntent(intent)) {
      recordStaleIntentAfterTurnEnd(world, intent);
      continue;
    }

    const queue: GameEvent[] = [];
    queue.push(...createEventFromIntent(world, intent));

    if (intent.type === 'deal-hand') {
      if (world.fsm.gameFlow !== 'Deal') {
        world.debug.failedConditions.push({
          tick: world.tick,
          traceId: intent.traceId,
          ruleId: 'intent.deal-hand',
          conditionId: 'deal-state',
          reason: 'cards are dealt only at round start'
        });
      } else {
        queue.push(...dealIntoPlayerTurn(world, intent.traceId, 'hand dealt'));
      }
    }

    if (intent.type === 'advance-time') {
      world.elapsedSeconds += intent.deltaSeconds;
      if (world.fsm.gameFlow === 'Deal') {
        queue.push(...dealIntoPlayerTurn(world, intent.traceId, 'round start auto deal'));
      }
    }

    if (intent.type === 'play-card') {
      const card = cards[intent.cardId];
      const targetId = card?.targets === 'front-enemy' ? intent.targetId ?? randomFrontRowEnemyId(world) : intent.targetId;
      intent.targetId = targetId;
      const playCommands = validatePlayCard(world, intent);
      if (playCommands.length > 0) {
        for (const command of playCommands) {
          queue.push(...applyCommand(world, command));
        }
        const effectMultiplier = advanceCostChain(world, card.cost);
        queue.push({
          type: 'CardPlayed',
          tick: world.tick,
          traceId: intent.traceId,
          cardId: intent.cardId,
          targetId: intent.targetId,
          effectMultiplier
        });
      }
    }

    if (intent.type === 'select-reward') {
      if (world.fsm.gameFlow !== 'Reward' || !world.reward.pending) {
        world.debug.failedConditions.push({
          tick: world.tick,
          traceId: intent.traceId,
          ruleId: 'intent.select-reward',
          conditionId: 'reward-state',
          reason: 'reward can be selected only while a level-up reward is pending'
        });
      } else if (!world.reward.choices.includes(intent.cardId)) {
        world.debug.failedConditions.push({
          tick: world.tick,
          traceId: intent.traceId,
          ruleId: 'intent.select-reward',
          conditionId: 'reward-choice',
          reason: `${intent.cardId} is not a pending reward choice`
        });
      } else {
        queue.push({
          type: 'RewardChosen',
          tick: world.tick,
          traceId: intent.traceId,
          cardId: intent.cardId
        });
        queue.push(...applyCommand(world, { type: 'ClearRewardChoices', traceId: intent.traceId }));
        queue.push(...applyCommand(world, { type: 'DiscardHand', traceId: intent.traceId, reason: 'reward selected' }));
        queue.push(...applyCommand(world, { type: 'CompactEnemySlots', traceId: intent.traceId }));
        queue.push(...applyCommand(world, { type: 'FillEnemySlots', traceId: intent.traceId }));
        queue.push(...applyCommand(world, { type: 'AdvanceRound', traceId: intent.traceId }));
        queue.push(...dealIntoPlayerTurn(world, intent.traceId, 'reward selected'));
        queue.push(...applyCommand(world, { type: 'AddCardToDeck', traceId: intent.traceId, cardId: intent.cardId }));
      }
    }

    if (intent.type === 'end-turn') {
      if (world.fsm.gameFlow !== 'PlayerTurn') {
        world.debug.failedConditions.push({
          tick: world.tick,
          traceId: intent.traceId,
          ruleId: 'intent.end-turn',
          conditionId: 'player-turn',
          reason: 'turn can end only during player turn'
        });
      } else {
        queue.push({
          type: 'TurnEnded',
          tick: world.tick,
          traceId: intent.traceId,
          round: world.round
        });
        for (const command of setGameFlowState(world, 'EnemyAttack', 'player ended turn', intent.traceId)) {
          queue.push(...applyCommand(world, command));
        }
        queue.push(
          ...applyCommand(world, {
            type: 'DiscardHand',
            traceId: intent.traceId,
            reason: 'turn ended'
          })
        );
        for (const enemy of roundAttackEligibleEnemies(world)) {
          if (world.player.hp <= 0) {
            break;
          }
          queue.push(
            ...applyCommand(world, {
              type: 'EnemyAttack',
              traceId: intent.traceId,
              enemyId: enemy.id
            })
          );
        }
        if (world.player.hp > 0) {
          for (const command of setGameFlowState(world, 'EnemyRefill', 'enemy attacks resolved', intent.traceId)) {
            queue.push(...applyCommand(world, command));
          }
          queue.push(...applyCommand(world, { type: 'CompactEnemySlots', traceId: intent.traceId }));
          queue.push(...applyCommand(world, { type: 'FillEnemySlots', traceId: intent.traceId }));
          queue.push(...applyCommand(world, { type: 'AdvanceRound', traceId: intent.traceId }));
          queue.push(...dealIntoPlayerTurn(world, intent.traceId, 'next round dealt'));
        }
        playerInputClosed = true;
      }
    }

    processEventQueue(world, queue);
  }

  for (const command of resetCastState(world, intents[0]?.traceId ?? `tick-${world.tick}`)) {
    applyCommand(world, command);
  }

  return world;
}
