import { describe, expect, it } from 'vitest';
import { cards } from '../../data/cards';
import {
  canHudEndTurn,
  defaultHudFrontTargetId,
  hudAuthorizationState,
  hudCardIntentPreview,
  hudCardChainRead,
  hudCardLifecycleToken,
  hudCardPaymentStatusToken,
  hudCardRoleLabel,
  hudCardPaymentRead,
  hudCardPlayDestinationLabel,
  hudCardTurnEndDestinationLabel,
  hudCardVisibleRoleLabel,
  hudEventFeedbackLabel,
  Hud,
  hudRouteChoicesState,
  hudRunLayerState,
  isHudAuthorizationPayoffCard,
  validHudSelectedTargetId
} from '../../ui/hud';
import type { EnemySnapshot, GameEvent, GameSnapshot } from '../../sim/types';

const frontTarget: EnemySnapshot = {
  id: 'enemy-1',
  definitionId: 'debt_wisp',
  name: 'Debt Wisp',
  hp: 10,
  maxHp: 10,
  slot: 0,
  lane: -2,
  z: -6,
  alive: true
};

const bruteTarget: EnemySnapshot = {
  id: 'enemy-2',
  definitionId: 'redline_brute',
  name: 'Redline Brute',
  hp: 18,
  maxHp: 22,
  slot: 1,
  lane: -1,
  z: -6,
  alive: true
};

describe('HUD target selection', () => {
  it('keeps only living first-row selections valid', () => {
    const enemies: EnemySnapshot[] = [
      frontTarget,
      { ...frontTarget, id: 'enemy-2', slot: 5, alive: true },
      { ...frontTarget, id: 'enemy-3', slot: 2, alive: false }
    ];

    expect(validHudSelectedTargetId('enemy-1', enemies)).toBe('enemy-1');
    expect(validHudSelectedTargetId('enemy-2', enemies)).toBeNull();
    expect(validHudSelectedTargetId('enemy-3', enemies)).toBeNull();
    expect(validHudSelectedTargetId(null, enemies)).toBeNull();
  });
});

describe('HUD end turn action', () => {
  it('keeps end turn available throughout PlayerTurn', () => {
    expect(canHudEndTurn('PlayerTurn')).toBe(true);
    expect(canHudEndTurn('Deal')).toBe(false);
    expect(canHudEndTurn('EnemyAttack')).toBe(false);
    expect(canHudEndTurn('Reward')).toBe(false);
  });
});

function snapshotWithEnergy(energy: number, tempAuthorizationMP = 0): GameSnapshot {
  return {
    fsm: { gameFlow: 'PlayerTurn' },
    player: {
      energy,
      tempAuthorizationMP
    }
  } as unknown as GameSnapshot;
}

describe('HUD authorization payment helpers', () => {
  it('reads temporary authorization defensively from the player snapshot', () => {
    expect(hudAuthorizationState(snapshotWithEnergy(0, 3))).toMatchObject({
      amount: 3,
      active: true,
      label: '授权+3',
      detail: '本回合临时授权，只支付 3费终结牌'
    });
    expect(hudAuthorizationState(snapshotWithEnergy(0))).toMatchObject({
      amount: 0,
      active: false,
      label: '授权+0'
    });
  });

  it('allows 3-cost burst payoff cards to be paid by authorization without showing missing MP', () => {
    const card = cards.severance_burst;
    const payment = hudCardPaymentRead(card, snapshotWithEnergy(0, 3));

    expect(isHudAuthorizationPayoffCard(card)).toBe(true);
    expect(payment.playable).toBe(true);
    expect(payment.usesAuthorization).toBe(true);
    expect(payment.missingMP).toBe(0);
    expect(payment.reason).toContain('授权支付');
    expect(payment.costLabel).toContain('授权+3');
    expect(hudCardPaymentStatusToken(card, snapshotWithEnergy(0, 3))).toEqual({
      label: '授权付',
      className: 'authorization-cost'
    });
  });

  it('keeps unauthorized 3-cost burst payoff cards locked with an authorization hint', () => {
    const payment = hudCardPaymentRead(cards.severance_burst, snapshotWithEnergy(0));

    expect(payment.playable).toBe(false);
    expect(payment.usesAuthorization).toBe(false);
    expect(payment.reason).toContain('缺MP或授权');
    expect(hudCardPaymentStatusToken(cards.severance_burst, snapshotWithEnergy(0))).toEqual({
      label: '缺授权',
      className: 'missing-cost'
    });
  });

  it('does not let authorization pay non-payoff cards', () => {
    const payment = hudCardPaymentRead(cards.row_cleave, snapshotWithEnergy(0, 3));

    expect(isHudAuthorizationPayoffCard(cards.row_cleave)).toBe(false);
    expect(payment.playable).toBe(false);
    expect(payment.reason).toContain('MP不足');
    expect(hudCardPaymentStatusToken(cards.row_cleave, snapshotWithEnergy(0, 3))).toEqual({
      label: '缺MP2',
      className: 'missing-cost'
    });
  });
});

describe('HUD card role labels', () => {
  it('labels the 2-cost clearance order as setup instead of a finisher payoff', () => {
    expect(hudCardRoleLabel(cards.clearance_order)).toBe('展开');
  });

  it('keeps reorder labels as compact preparation tokens until real topdeck is implemented', () => {
    expect(hudCardRoleLabel(cards.paper_shatter)).toBe('整备');
    expect(hudCardRoleLabel(cards.lantern_captain)).toBe('整备');
  });

  it('infers common hand roles from cost and utilities', () => {
    expect(hudCardRoleLabel(cards.debt_hook)).toBe('开链');
    expect(hudCardRoleLabel(cards.redline_cut)).toBe('承接');
    expect(hudCardRoleLabel(cards.wild_mana_stitch)).toBe('修补');
    expect(hudCardRoleLabel(cards.severance_burst)).toBe('终结');
  });
});

describe('HUD card lifecycle feedback labels', () => {
  it('keeps lifecycle text as compact visible tokens on cards', () => {
    expect(hudCardLifecycleToken(cards.static_overload)).toBe('污');
    expect(hudCardLifecycleToken(cards.guard_reserve)).toBe('留');
    expect(hudCardVisibleRoleLabel(cards.static_overload)).toBe('开链 · 污');
    expect(hudCardVisibleRoleLabel(cards.guard_reserve)).toBe('承接 · 留');
    expect(hudCardVisibleRoleLabel(cards.severance_burst)).toBe('终结');
  });

  it('maps play and turn-end destinations without exposing raw zone names', () => {
    expect(hudCardPlayDestinationLabel(cards.static_overload)).toBe('消耗');
    expect(hudCardPlayDestinationLabel(cards.debt_hook)).toBe('弃牌');
    expect(hudCardTurnEndDestinationLabel(cards.guard_reserve)).toBe('保留');
    expect(hudCardTurnEndDestinationLabel(cards.debt_hook)).toBe('弃牌');
  });

  it('translates physical card movement events into short player-facing facts', () => {
    const movedToExhaust: GameEvent = {
      type: 'CardMoved',
      traceId: 'ui-life',
      tick: 4,
      cardId: 'static_overload',
      from: 'hand',
      to: 'exhaustPile',
      fromZone: 'hand',
      toZone: 'exhaustPile',
      reason: 'played'
    };
    const retained: GameEvent = {
      type: 'CardRetained',
      traceId: 'ui-life',
      tick: 5,
      cardId: 'guard_reserve',
      reason: 'turn ended',
      retainedCardsCount: 1
    };
    const shuffled: GameEvent = {
      type: 'DiscardPileShuffledIntoDrawPile',
      traceId: 'ui-life',
      tick: 6,
      cardIds: ['debt_hook', 'redline_cut'],
      keptCardIds: ['guard_reserve'],
      drawPileCount: 2,
      discardPileCount: 1
    };

    expect(hudEventFeedbackLabel(movedToExhaust)).toBe('消耗 Static Overload · 打出');
    expect(hudEventFeedbackLabel(retained)).toBe('留1下手 · Guard Reserve');
    expect(hudEventFeedbackLabel(shuffled)).toBe('弃->抽 2张 · 留弃1');
  });
});

describe('HUD card intent previews', () => {
  function intentSnapshot(): GameSnapshot {
    return {
      fsm: { gameFlow: 'PlayerTurn' },
      player: {
        energy: 2,
        tempAuthorizationMP: 0
      },
      enemies: [frontTarget, bruteTarget],
      enemyIntents: [
        {
          enemyId: frontTarget.id,
          kind: 'attack',
          amount: 2,
          slot: frontTarget.slot,
          description: 'attack',
          willRefill: true
        },
        {
          enemyId: bruteTarget.id,
          kind: 'attack',
          amount: 5,
          slot: bruteTarget.slot,
          description: 'attack',
          willRefill: true
        }
      ],
      enemyIntentSummary: {
        totalDamage: 7,
        intentEnemyIds: [frontTarget.id, bruteTarget.id]
      }
    } as unknown as GameSnapshot;
  }

  it('defaults single-target card previews to the highest current front-row intent', () => {
    const snapshot = intentSnapshot();
    const preview = hudCardIntentPreview(cards.redline_cut, snapshot, null, 2);

    expect(defaultHudFrontTargetId(snapshot)).toBe(bruteTarget.id);
    expect(preview).toMatchObject({
      before: 7,
      after: 2,
      prevented: 5,
      targetId: bruteTarget.id,
      label: 'BRU 意图 7->2'
    });
  });

  it('keeps self cards framed as repair instead of promising intent reduction', () => {
    const preview = hudCardIntentPreview(cards.pulse_draw, intentSnapshot(), null, 1);

    expect(preview).toMatchObject({
      before: 7,
      after: 7,
      prevented: 0,
      label: '抽1仍-7'
    });
  });

  it('shows draw repair multiplier without implying pressure reduction', () => {
    const pulsePreview = hudCardIntentPreview(cards.pulse_draw, intentSnapshot(), null, 2);
    const paperPreview = hudCardIntentPreview(cards.paper_shatter, intentSnapshot(), null, 3);

    expect(pulsePreview).toMatchObject({
      before: 7,
      after: 7,
      prevented: 0,
      label: '抽2仍-7'
    });
    expect(paperPreview).toMatchObject({
      before: 7,
      after: 7,
      prevented: 0,
      label: '抽3仍-7'
    });
  });
});

describe('HUD chain extension reads', () => {
  function chainSnapshot(overrides: Partial<GameSnapshot['chain']> = {}): GameSnapshot {
    return {
      fsm: { gameFlow: 'PlayerTurn' },
      player: {
        energy: 1,
        tempAuthorizationMP: 3,
        lastPlayedCost: 2,
        costChainMultiplier: 3
      },
      chain: {
        playedCosts: [0, 1, 2],
        lastCost: 2,
        nextExpectedCost: 3,
        multiplier: 3,
        broken: false,
        breakReason: null,
        repairedThisTurn: false,
        extendedThisTurn: false,
        ...overrides
      }
    } as unknown as GameSnapshot;
  }

  it('shows wild gap key as a controlled MP3 extension instead of a broken chain', () => {
    expect(hudCardChainRead(cards.wild_gap_key, chainSnapshot())).toMatchObject({
      label: '延MP3x4',
      multiplier: 4,
      breaksChain: false,
      className: 'chain-match'
    });
  });

  it('keeps wild mana stitch out of the MP3 extension lane', () => {
    expect(hudCardChainRead(cards.wild_mana_stitch, chainSnapshot())).toMatchObject({
      label: '断x1',
      multiplier: 1,
      breaksChain: true
    });
  });

  it('shows payoff as a continuation after a wild MP3 extension', () => {
    expect(
      hudCardChainRead(
        cards.severance_burst,
        chainSnapshot({
          playedCosts: [0, 1, 2, 3],
          lastCost: 3,
          nextExpectedCost: 4,
          multiplier: 4,
          extendedThisTurn: true
        })
      )
    ).toMatchObject({
      label: '续燃x5',
      multiplier: 5,
      breaksChain: false
    });
  });
});

describe('HUD run and meta layer labels', () => {
  it('reads current run progress and recent reward without presenting meta growth as a permanent upgrade', () => {
    const runState = hudRunLayerState({
      round: 3,
      run: {
        currentNode: 2,
        maxNodes: 7,
        rewardHistory: [{ cardId: 'severance_burst' }]
      },
      debug: { events: [] }
    } as unknown as GameSnapshot);
    const visibleCopy = Object.values(runState).join(' / ');

    expect(runState.title).toBe('本次清算');
    expect(runState.nodeLabel).toBe('节点 2/7');
    expect(runState.rewardLabel).toBe('已拿 Severance Burst');
    expect(runState.routeLabel).toBe('路线记录 1');
    expect(runState.nextTitle).toBe('下一战');
    expect(runState.nextState).toBe('带入 Severance Burst');
    expect(runState.nextDetail).toBe('仅本run');
    expect(visibleCopy).not.toContain('最大 MP +3');
    expect(visibleCopy).not.toContain('永久升级');
    expect(visibleCopy).not.toContain('永久');
  });

  it('surfaces reward and route candidates plus next-fight carryover while reward selection is pending', () => {
    const runState = hudRunLayerState({
      round: 3,
      player: {
        deck: ['debt_hook', 'redline_cut', 'row_cleave']
      },
      run: {
        currentNode: 2,
        maxNodes: 7,
        rewardHistory: []
      },
      reward: {
        pending: true,
        choices: ['blood_tithe', 'severance_burst', 'spark_tap']
      },
      debug: { events: [] }
    } as unknown as GameSnapshot);

    expect(runState.nodeLabel).toBe('节点 2/7');
    expect(runState.rewardLabel).toBe('奖励候选 修补/终结/路线');
    expect(runState.routeLabel).toBe('路线候选 Spark Tap');
    expect(runState.nextState).toBe('选1入组');
    expect(runState.nextDetail).toBe('牌组3 · 仅本run');
  });

  it('falls back defensively before snapshot.run is wired into the runtime snapshot', () => {
    const runState = hudRunLayerState({
      round: 4,
      debug: {
        events: [{ type: 'RewardChosen', cardId: 'wild_gap_key', traceId: 'reward-test', tick: 12 }]
      }
    } as unknown as GameSnapshot);

    expect(runState.nodeLabel).toBe('节点? R4');
    expect(runState.rewardLabel).toBe('已拿 Wild Gap Key');
    expect(runState.routeLabel).toBe('路线记录 1');
    expect(runState.nextDetail).toBe('仅本run');
  });

  it('reads two pending route buttons as compact next-fight modifier and reward tendency tokens', () => {
    const snapshot = {
      round: 3,
      run: {
        currentNode: 1,
        maxNodes: 3,
        rewardHistory: [],
        route: {
          pendingNodeChoices: [
            {
              id: 'run-1-node-1-to-2-repair-cache',
              fromNode: 1,
              toNode: 2,
              label: '维修补给岔路',
              preview: '下一战奖励更偏修补/资源，并带 1 次奖励复核上下文。',
              nextBattleContext: {
                modifierId: 'rewardRerollPlusOne',
                rewardBranchHint: 'repair-resource'
              }
            },
            {
              id: 'run-1-node-1-to-2-elite-pressure',
              fromNode: 1,
              toNode: 2,
              label: '高压债务岔路',
              preview: '下一战临时信用额度 +1，更容易打出终结牌。',
              nextBattleContext: {
                modifierId: 'maxEnergyThisRunPlusOne',
                rewardBranchHint: 'payoff'
              }
            }
          ]
        }
      },
      debug: { events: [] }
    } as unknown as GameSnapshot;

    expect(hudRouteChoicesState(snapshot)).toEqual([
      {
        id: 'run-1-node-1-to-2-repair-cache',
        label: '维修补给岔路',
        nodeLabel: '1->2',
        modifierToken: '复核+1',
        rewardToken: '偏修补',
        preview: '下一战奖励更偏修补/资源，并带 1 次奖励复核上下文。'
      },
      {
        id: 'run-1-node-1-to-2-elite-pressure',
        label: '高压债务岔路',
        nodeLabel: '1->2',
        modifierToken: 'MP+1',
        rewardToken: '偏终结',
        preview: '下一战临时信用额度 +1，更容易打出终结牌。'
      }
    ]);

    const runState = hudRunLayerState(snapshot);
    expect(runState.routeLabel).toBe('路线候选 2');
    expect(runState.nextState).toBe('选路线');
    expect(runState.nextDetail).toBe('复核+1/偏修补');
  });

  it('renders route controls after reward choices and emits a select-route intent when clicked', () => {
    const listeners: Partial<Record<string, (event: Event) => void>> = {};
    const root = {
      innerHTML: '',
      addEventListener: (type: string, listener: EventListener) => {
        listeners[type] = listener as (event: Event) => void;
      }
    } as unknown as HTMLElement;
    const intents: unknown[] = [];
    const hud = new Hud(root, (intent) => intents.push(intent));
    const routeChoiceId = 'run-1-node-1-to-2-repair-cache';

    hud.render({
      tick: 1,
      round: 3,
      elapsedSeconds: 0,
      player: {
        hp: 30,
        maxHp: 30,
        energy: 0,
        maxEnergy: 3,
        tempAuthorizationMP: 0,
        lastPlayedCost: null,
        costChainMultiplier: 1,
        xp: 12,
        level: 2,
        deck: ['debt_hook', 'redline_cut', 'row_cleave'],
        hand: [],
        drawPile: [],
        discardPile: [],
        exhaustPile: [],
        retainedCards: []
      },
      chain: {
        playedCosts: [],
        lastCost: null,
        nextExpectedCost: 0,
        multiplier: 1,
        broken: false,
        breakReason: null,
        repairedThisTurn: false,
        extendedThisTurn: false
      },
      enemies: [],
      enemyIntents: [],
      enemyIntentSummary: { totalDamage: 0, intentEnemyIds: [] },
      fsm: { gameFlow: 'Reward', characters: {} },
      run: {
        currentNode: 1,
        maxNodes: 3,
        rewardHistory: [],
        route: {
          pendingNodeChoices: [
            {
              id: routeChoiceId,
              fromNode: 1,
              toNode: 2,
              label: '维修补给岔路',
              preview: '下一战奖励更偏修补/资源。',
              nextBattleContext: {
                modifierId: 'rewardRerollPlusOne',
                rewardBranchHint: 'repair-resource'
              }
            },
            {
              id: 'run-1-node-1-to-2-elite-pressure',
              fromNode: 1,
              toNode: 2,
              label: '高压债务岔路',
              preview: '下一战临时信用额度 +1。',
              nextBattleContext: {
                modifierId: 'maxEnergyThisRunPlusOne',
                rewardBranchHint: 'payoff'
              }
            }
          ]
        }
      },
      reward: {
        pending: true,
        choices: ['blood_tithe', 'severance_burst', 'spark_tap'],
        xpThreshold: 12
      },
      cardUpgrades: { enhancements: {}, choices: [], pending: false, history: [] },
      debug: { events: [], commands: [], failedConditions: [], ruleHits: [], trace: [] },
      lastBurstTick: null
    } as unknown as GameSnapshot);

    expect(root.innerHTML.match(/class="route-choice"/g)).toHaveLength(2);
    expect(root.innerHTML).toContain('复核+1 · 偏修补');
    expect(root.innerHTML).toContain('MP+1 · 偏终结');

    const button = {
      disabled: false,
      dataset: { routeChoiceId },
      matches: () => false
    };
    const event = {
      type: 'pointerdown',
      target: { closest: () => button },
      preventDefault: () => undefined,
      stopPropagation: () => undefined
    } as unknown as Event;

    listeners.pointerdown?.(event);

    expect(intents).toEqual([
      expect.objectContaining({
        type: 'select-route',
        routeId: routeChoiceId
      })
    ]);
  });
});
