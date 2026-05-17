import { cards } from '../data/cards';
import { setCharacterState } from '../fsm/stateMachine';
import type { Rule } from './ruleSet';

export const redlineRules: Rule[] = [
  {
    id: 'card.damage.front-enemy',
    event: 'CardPlayed',
    filter: ({ event }) => event.type === 'CardPlayed' && cards[event.cardId].targets === 'front-enemy',
    conditions: [
      ({ world, event }) => {
        const targetId = event.type === 'CardPlayed' ? event.targetId : undefined;
        const target = targetId ? world.enemies[targetId] : undefined;
        return {
          ok: Boolean(target && target.alive),
          id: 'target-alive',
          reason: 'no alive front target'
        };
      }
    ],
    actions: [
      ({ world, event }) => {
        if (event.type !== 'CardPlayed' || !event.targetId) {
          return [];
        }
        const card = cards[event.cardId];
        const amount = card.damage * event.effectMultiplier;
        return [
          {
            type: 'DamageEnemy',
            traceId: event.traceId,
            sourceId: 'player',
            targetId: event.targetId,
            amount,
            cardId: card.id
          },
          {
            type: 'SetCombo',
            traceId: event.traceId,
            value: world.player.combo + 1,
            reason: `played ${card.comboNode}`
          }
        ];
      }
    ]
  },
  {
    id: 'card.clear-burst',
    event: 'CardPlayed',
    filter: ({ event }) => event.type === 'CardPlayed' && cards[event.cardId].targets === 'all-enemies',
    conditions: [],
    actions: [
      ({ world, event }) => {
        if (event.type !== 'CardPlayed') {
          return [];
        }
        const card = cards[event.cardId];
        const amount = card.damage * event.effectMultiplier;
        return [
          {
            type: 'ClearBurst',
            traceId: event.traceId,
            cardId: card.id
          },
          ...Object.values(world.enemies)
            .filter((enemy) => enemy.alive)
            .map((enemy) => ({
              type: 'DamageEnemy' as const,
              traceId: event.traceId,
              sourceId: 'player',
              targetId: enemy.id,
              amount,
              cardId: card.id
            })),
          {
            type: 'SetCombo',
            traceId: event.traceId,
            value: 0,
            reason: 'clear burst spent combo'
          }
        ];
      }
    ]
  },
  {
    id: 'card.damage.front-row',
    event: 'CardPlayed',
    filter: ({ event }) => event.type === 'CardPlayed' && cards[event.cardId].targets === 'front-row',
    conditions: [
      ({ world }) => ({
        ok: Object.values(world.enemies).some((enemy) => enemy.alive && enemy.slot >= 0 && enemy.slot < 5),
        id: 'target-alive',
        reason: 'no alive front-row targets'
      })
    ],
    actions: [
      ({ world, event }) => {
        if (event.type !== 'CardPlayed') {
          return [];
        }
        const card = cards[event.cardId];
        const amount = card.damage * event.effectMultiplier;
        return [
          ...Object.values(world.enemies)
            .filter((enemy) => enemy.alive && enemy.slot >= 0 && enemy.slot < 5)
            .map((enemy) => ({
              type: 'DamageEnemy' as const,
              traceId: event.traceId,
              sourceId: 'player',
              targetId: enemy.id,
              amount,
              cardId: card.id
            })),
          {
            type: 'SetCombo',
            traceId: event.traceId,
            value: world.player.combo + 1,
            reason: `played ${card.comboNode}`
          }
        ];
      }
    ]
  },
  {
    id: 'card.self.resource',
    event: 'CardPlayed',
    filter: ({ event }) => event.type === 'CardPlayed' && cards[event.cardId].targets === 'self',
    conditions: [],
    actions: [
      ({ event }) => {
        if (event.type !== 'CardPlayed') {
          return [];
        }
        const card = cards[event.cardId];
        const multiplier = event.effectMultiplier;
        return [
          ...(card.drawCards
            ? [
                {
                  type: 'DrawCards' as const,
                  traceId: event.traceId,
                  count: card.drawCards * multiplier,
                  reason: `played ${card.id}`
                }
              ]
            : [])
        ];
      }
    ]
  },
  {
    id: 'enemy.death.reward',
    event: 'EnemyKilled',
    conditions: [],
    actions: [
      ({ world, event }) => {
        if (event.type !== 'EnemyKilled') {
          return [];
        }
        const enemy = world.enemies[event.enemyId];
        return [
          {
            type: 'GainXp',
            traceId: event.traceId,
            amount: enemy.xpReward,
            sourceId: enemy.id,
            reason: `killed ${enemy.name}`
          },
          ...setCharacterState(world, event.enemyId, 'Dead', 'enemy killed', event.traceId),
          {
            type: 'CompactEnemySlots',
            traceId: event.traceId
          },
          {
            type: 'FillEnemySlots',
            traceId: event.traceId
          }
        ];
      }
    ]
  }
];
