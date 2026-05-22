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
  hudBuildPlanState,
  hudEventFeedbackLabel,
  hudPressureTimelineState,
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
  name: '债雾',
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
  name: '红线蛮兵',
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
      label: '临时授权3',
      detail: '本回合临时授权，只支付 3费终结牌'
    });
    expect(hudAuthorizationState(snapshotWithEnergy(0))).toMatchObject({
      amount: 0,
      active: false,
      label: '授权0'
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
    expect(payment.costLabel).toContain('临时授权3');
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
    expect(hudCardVisibleRoleLabel(cards.static_overload)).toBe('状态 · 污染');
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

    expect(hudEventFeedbackLabel(movedToExhaust)).toBe('消耗 静电过载 · 打出');
    expect(hudEventFeedbackLabel(retained)).toBe('留1下手 · 守备保留');
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
      label: '蛮兵 意图 7->2'
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
      label: '延展 MP 3 x4',
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
  it('reads optional build plan tokens and reasons defensively', () => {
    expect(hudBuildPlanState({} as unknown as GameSnapshot)).toEqual({
      token: '常规',
      reason: '无构筑预览',
      active: false
    });

    const planState = hudBuildPlanState({
      buildPlan: {
        selectedModifiers: [{ id: 'maxEnergyThisRunPlusOne', label: '信用额度' }],
        derived: {
          maxEnergyDeltaThisRun: 1
        },
        explanations: ['Max MP preview becomes 4 for this run only.']
      }
    } as unknown as GameSnapshot);

    expect(planState).toEqual({
      token: 'MP+1',
      reason: '最大MP 预览变为 4，仅本run。',
      active: true
    });
  });

  it('renders build plan token and reason without requiring runtime snapshot support', () => {
    const root = {
      innerHTML: '',
      addEventListener: () => undefined
    } as unknown as HTMLElement;
    const hud = new Hud(root, () => undefined);

    hud.render({
      tick: 1,
      round: 1,
      elapsedSeconds: 0,
      player: {
        hp: 30,
        maxHp: 30,
        energy: 3,
        maxEnergy: 3,
        tempAuthorizationMP: 0,
        lastPlayedCost: null,
        costChainMultiplier: 1,
        xp: 0,
        level: 1,
        deck: ['debt_hook'],
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
      fsm: { gameFlow: 'Deal', characters: {} },
      reward: { pending: false, choices: [], xpThreshold: 12 },
      cardUpgrades: { enhancements: {}, choices: [], pending: false, history: [] },
      debug: { events: [], commands: [], failedConditions: [], ruleHits: [], trace: [] },
      lastBurstTick: null,
      buildPlan: {
        selectedModifiers: [{ id: 'rewardRerollPlusOne', label: '复核机会' }],
        derived: { rewardRerollDelta: 1 },
        explanations: ['Reward reroll preview gains 1 reroll for this run only.']
      }
    } as unknown as GameSnapshot);

    expect(root.innerHTML).toContain('build-plan-chip active');
    expect(root.innerHTML).toContain('复核+1');
    expect(root.innerHTML).toContain('奖励复核 预览获得 1 次复核，仅本run。');
  });

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
    expect(runState.rewardLabel).toBe('已拿 断账爆发');
    expect(runState.routeLabel).toBe('路线记录 1');
    expect(runState.pressureLabel).toBe('上压 已清算');
    expect(runState.buildProblemLabel).toBe('构筑 稳定');
    expect(runState.nextTitle).toBe('下一战后果');
    expect(runState.nextState).toBe('带入 断账爆发');
    expect(runState.nextDetail).toBe('活动继承牌组');
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
    expect(runState.routeLabel).toBe('路线候选 点火');
    expect(runState.pressureLabel).toBe('上压 已清算');
    expect(runState.buildProblemLabel).toBe('构筑 稳定');
    expect(runState.nextState).toBe('选1入组');
    expect(runState.nextDetail).toBe('牌组3 · 活动继承牌组');
  });

  it('falls back defensively before snapshot.run is wired into the runtime snapshot', () => {
    const runState = hudRunLayerState({
      round: 4,
      debug: {
        events: [{ type: 'RewardChosen', cardId: 'wild_gap_key', traceId: 'reward-test', tick: 12 }]
      }
    } as unknown as GameSnapshot);

    expect(runState.nodeLabel).toBe('节点? R4');
    expect(runState.rewardLabel).toBe('已拿 缺口钥匙');
    expect(runState.routeLabel).toBe('路线记录 1');
    expect(runState.pressureLabel).toBe('上压 首战');
    expect(runState.nextDetail).toBe('活动继承牌组');
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
        riskToken: '推荐/安全',
        costToken: '无HP代价',
        pollutionToken: '无污染',
        tone: 'safe',
        disabled: false,
        disabledReason: null,
        preview: '下一战奖励更偏修补/资源，并带 1 次奖励复核上下文。',
        responseHint: null
      },
      {
        id: 'run-1-node-1-to-2-elite-pressure',
        label: '高压债务岔路',
        nodeLabel: '1->2',
        modifierToken: 'MP+1',
        rewardToken: '偏终结',
        riskToken: '高风险/贪心',
        costToken: 'HP代价',
        pollutionToken: '污染风险低',
        tone: 'risk',
        disabled: false,
        disabledReason: null,
        preview: '下一战临时信用额度 +1，更容易打出终结牌。',
        responseHint: null
      }
    ]);

    const runState = hudRunLayerState(snapshot);
    expect(runState.routeLabel).toBe('路线候选 2');
    expect(runState.pressureLabel).toBe('上压 首战');
    expect(runState.nextState).toBe('选路线');
    expect(runState.nextDetail).toContain('安全');
    expect(runState.nextDetail).toContain('下战修补');
    expect(runState.nextDetail).toContain('非即时回血');
    expect(runState.nextDetail).toContain('高风险');
    expect(runState.nextDetail).toContain('MP+1');
  });

  it('keeps long pressure, build, and route consequence copy in compact HUD lanes', () => {
    const veryLongLabel =
      '连续节点压力报告-上一节点因污染和高额债务叠加导致玩家必须改变构筑方向否则会在移动端撑破显示区域';
    const veryLongReason =
      '当前构筑问题说明非常非常长，需要在状态芯片和run layer里保持可截断，不能把右侧面板或移动端底部信息条撑出视口。';
    const veryLongPreview =
      '下一战路线后果说明非常非常长，并且包含多个状态：奖励更偏修补、临时复核、敌人压力更高、仍然只作用于本run。';
    const snapshot = {
      tick: 1,
      round: 4,
      elapsedSeconds: 0,
      player: {
        hp: 21,
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
        currentNode: 3,
        maxNodes: 5,
        rewardHistory: [{ cardId: 'spark_tap' }],
        previousNodePressure: {
          label: veryLongLabel
        },
        route: {
          pendingNodeChoices: [
            {
              id: 'long-route-repair',
              fromNode: 3,
              toNode: 4,
              label: `${veryLongLabel}-route`,
              preview: veryLongPreview,
              nextBattleContext: {
                modifierId: 'rewardRerollPlusOne',
                rewardBranchHint: 'repair-resource'
              }
            },
            {
              id: 'long-route-payoff',
              fromNode: 3,
              toNode: 4,
              label: `${veryLongLabel}-payoff`,
              preview: veryLongPreview,
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
      buildPlan: {
        summary: '缺桥 / 缺终结 / 清污染 / 补资源',
        issues: [
          {
            id: 'missing-bridge',
            label: '缺桥',
            reason: veryLongReason,
            nextStep: veryLongReason,
            priority: 20,
            evidence: [veryLongReason],
            recommendedCardIds: [],
            recommendedUpgradeChoiceIds: []
          }
        ]
      },
      cardUpgrades: { enhancements: {}, choices: [], pending: false, history: [] },
      debug: { events: [], commands: [], failedConditions: [], ruleHits: [], trace: [] },
      lastBurstTick: null
    } as unknown as GameSnapshot;

    const pressure = hudPressureTimelineState(snapshot);
    expect(pressure.previousPressureLabel).toMatch(/^上压 .+…$/);
    expect(pressure.previousPressureLabel.length).toBeLessThanOrEqual(18);
    expect(pressure.buildProblemLabel).toBe('构筑 缺桥');
    expect(pressure.nextRouteConsequenceLabel).toBe(
      '安全下战修补/复核+1/非即时回血 | 高风险MP+1/HP代价/污染风险低'
    );

    const root = {
      innerHTML: '',
      addEventListener: () => undefined
    } as unknown as HTMLElement;
    const hud = new Hud(root, () => undefined);
    hud.render(snapshot);

    expect(root.innerHTML).toContain('run-layer-main');
    expect(root.innerHTML).toContain('run-layer-meta');
    expect(root.innerHTML.match(/class="route-choice"/g)).toHaveLength(2);
    expect(root.innerHTML).toContain('复核+1 · 偏修补');
    expect(root.innerHTML).toContain('MP+1 · 偏终结');
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

  it('blocks lethal elite-pressure route selection while keeping repair-cache selectable', () => {
    const listeners: Partial<Record<string, (event: Event) => void>> = {};
    const root = {
      innerHTML: '',
      addEventListener: (type: string, listener: EventListener) => {
        listeners[type] = listener as (event: Event) => void;
      }
    } as unknown as HTMLElement;
    const intents: unknown[] = [];
    const hud = new Hud(root, (intent) => intents.push(intent));
    const repairRouteId = 'run-1-node-1-to-2-repair-cache';
    const eliteRouteId = 'run-1-node-1-to-2-elite-pressure';

    hud.render({
      tick: 1,
      round: 3,
      elapsedSeconds: 0,
      player: {
        hp: 2,
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
      fsm: { gameFlow: 'RouteSelect', characters: {} },
      run: {
        currentNode: 1,
        maxNodes: 3,
        rewardHistory: [],
        route: {
          pendingNodeChoices: [
            {
              id: repairRouteId,
              fromNode: 1,
              toNode: 2,
              kind: 'repair-cache',
              label: '维修补给岔路',
              preview: '下一战奖励更偏修补/资源，并带 1 次奖励复核上下文。',
              routePressure: { entryDamage: 0, addsPollution: false },
              nextBattleContext: {
                modifierId: 'rewardRerollPlusOne',
                rewardBranchHint: 'repair-resource'
              }
            },
            {
              id: eliteRouteId,
              fromNode: 1,
              toNode: 2,
              kind: 'elite-pressure',
              label: '高压债务岔路',
              preview: '下一战临时信用额度 +1，更容易打出终结牌。',
              routePressure: { entryDamage: 2, addsPollution: true },
              nextBattleContext: {
                modifierId: 'maxEnergyThisRunPlusOne',
                rewardBranchHint: 'payoff'
              }
            }
          ]
        }
      },
      reward: {
        pending: false,
        choices: [],
        xpThreshold: 12
      },
      cardUpgrades: { enhancements: {}, choices: [], pending: false, history: [] },
      debug: { events: [], commands: [], failedConditions: [], ruleHits: [], trace: [] },
      lastBurstTick: null
    } as unknown as GameSnapshot);

    const eliteButtonMarkup = root.innerHTML.match(
      /<button[^>]+data-route-choice-id="run-1-node-1-to-2-elite-pressure"[\s\S]*?<\/button>/
    )?.[0];

    expect(root.innerHTML).toContain('路线选择');
    expect(root.innerHTML).not.toContain('RouteSelect');
    expect.soft(eliteButtonMarkup).toMatch(/HP不足|会阵亡|不可选/);

    listeners.pointerdown?.({
      type: 'pointerdown',
      target: { closest: () => ({ disabled: false, dataset: { routeChoiceId: eliteRouteId }, matches: () => false }) },
      preventDefault: () => undefined,
      stopPropagation: () => undefined
    } as unknown as Event);

    expect
      .soft(
        intents
          .filter((intent): intent is { type: string; routeId: string } => {
            return typeof intent === 'object' && intent !== null && 'type' in intent && 'routeId' in intent;
          })
          .map((intent) => intent.routeId)
      )
      .not.toContain(eliteRouteId);

    listeners.pointerdown?.({
      type: 'pointerdown',
      target: { closest: () => ({ disabled: false, dataset: { routeChoiceId: repairRouteId }, matches: () => false }) },
      preventDefault: () => undefined,
      stopPropagation: () => undefined
    } as unknown as Event);

    expect(intents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'select-route',
          routeId: repairRouteId
        })
      ])
    );
  });

  it('keeps non-lethal elite-pressure route selection available', () => {
    const listeners: Partial<Record<string, (event: Event) => void>> = {};
    const root = {
      innerHTML: '',
      addEventListener: (type: string, listener: EventListener) => {
        listeners[type] = listener as (event: Event) => void;
      }
    } as unknown as HTMLElement;
    const intents: unknown[] = [];
    const hud = new Hud(root, (intent) => intents.push(intent));
    const eliteRouteId = 'run-1-node-1-to-2-elite-pressure';

    hud.render({
      tick: 1,
      round: 3,
      elapsedSeconds: 0,
      player: {
        hp: 10,
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
      fsm: { gameFlow: 'RouteSelect', characters: {} },
      run: {
        currentNode: 1,
        maxNodes: 3,
        rewardHistory: [],
        route: {
          pendingNodeChoices: [
            {
              id: eliteRouteId,
              fromNode: 1,
              toNode: 2,
              kind: 'elite-pressure',
              label: '高压债务岔路',
              preview: '下一战临时信用额度 +1，更容易打出终结牌。',
              routePressure: { entryDamage: 2, addsPollution: true },
              nextBattleContext: {
                modifierId: 'maxEnergyThisRunPlusOne',
                rewardBranchHint: 'payoff'
              }
            }
          ]
        }
      },
      reward: {
        pending: false,
        choices: [],
        xpThreshold: 12
      },
      cardUpgrades: { enhancements: {}, choices: [], pending: false, history: [] },
      debug: { events: [], commands: [], failedConditions: [], ruleHits: [], trace: [] },
      lastBurstTick: null
    } as unknown as GameSnapshot);

    listeners.pointerdown?.({
      type: 'pointerdown',
      target: { closest: () => ({ disabled: false, dataset: { routeChoiceId: eliteRouteId }, matches: () => false }) },
      preventDefault: () => undefined,
      stopPropagation: () => undefined
    } as unknown as Event);

    expect(intents).toEqual([
      expect.objectContaining({
        type: 'select-route',
        routeId: eliteRouteId
      })
    ]);
  });

  it('labels safe and greedy route choices and compares both routes in the top summary', () => {
    const root = {
      innerHTML: '',
      addEventListener: () => undefined
    } as unknown as HTMLElement;
    const hud = new Hud(root, () => undefined);

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
      fsm: { gameFlow: 'RouteSelect', characters: {} },
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
              preview: '下一战奖励更偏修补/资源，并带 1 次奖励复核上下文。 · 无污染',
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
              preview: '下一战临时信用额度 +1，更容易打出终结牌。 · -2 HP / 污染',
              nextBattleContext: {
                modifierId: 'maxEnergyThisRunPlusOne',
                rewardBranchHint: 'payoff'
              }
            }
          ]
        }
      },
      reward: {
        pending: false,
        choices: [],
        xpThreshold: 12
      },
      cardUpgrades: { enhancements: {}, choices: [], pending: false, history: [] },
      debug: { events: [], commands: [], failedConditions: [], ruleHits: [], trace: [] },
      lastBurstTick: null
    } as unknown as GameSnapshot);

    const repairButton = root.innerHTML.match(
      /<button[^>]+data-route-choice-id="run-1-node-1-to-2-repair-cache"[\s\S]*?<\/button>/
    )?.[0];
    const eliteButton = root.innerHTML.match(
      /<button[^>]+data-route-choice-id="run-1-node-1-to-2-elite-pressure"[\s\S]*?<\/button>/
    )?.[0];
    const routeSummary = root.innerHTML.match(/<section class="run-layer-panel"[\s\S]*?<\/section>/)?.[0];

    expect.soft(repairButton).toMatch(/安全|推荐/);
    expect.soft(repairButton).toContain('下战修补');
    expect.soft(repairButton).toContain('非即时回血');
    expect.soft(eliteButton).toMatch(/风险|贪心/);
    expect.soft(eliteButton).toContain('-2 HP / 污染');
    expect.soft(eliteButton).toContain('污染进弃牌堆');
    expect.soft(root.innerHTML).toContain('污染=不接链状态牌');
    expect.soft(root.innerHTML).toContain('抽到会挤掉 0-1-2');
    expect.soft(root.innerHTML).toContain('应对：清污染/净化抽牌/打出状态消耗');
    expect.soft(routeSummary).toMatch(/下战修补\/复核\+1\/非即时回血[\s\S]*高风险MP\+1\/-2 HP\/\+污染/);
  });

  it('shows activity difficulty and route pressure cost in the run layer', () => {
    const snapshot = {
      round: 1,
      run: {
        currentNode: 1,
        maxNodes: 3,
        rewardHistory: []
      },
      activity: {
        id: 'redline-core-activity-01',
        title: '红线清算局 第一套闯关',
        totalDifficultyTiers: 10,
        playableLevelIds: ['d1', 'd2', 'd3'],
        currentLevelId: 'd1',
        completedLevelIds: []
      },
      route: {
        pendingNodeChoices: [
          {
            id: 'run-1-node-1-to-2-elite-pressure',
            fromNode: 1,
            toNode: 2,
            label: '高压债务岔路',
            preview: '下一战临时信用额度 +1，更容易打出终结牌。 · -2 HP / 无污染',
            nextBattleContext: {
              modifierId: 'maxEnergyThisRunPlusOne',
              rewardBranchHint: 'payoff'
            }
          }
        ]
      },
      debug: { events: [] }
    } as unknown as GameSnapshot;

    expect(hudRunLayerState(snapshot).title).toBe('D1 初级试营业');
    expect(hudRunLayerState(snapshot).campaignLabel).toBe('D1-D3 连续三局 · 活动继承牌组/XP/升级');
    expect(hudRunLayerState(snapshot).difficultyBandLabel).toBe('初级 · 3节点');
    expect(hudRouteChoicesState(snapshot)[0]).toMatchObject({
      modifierToken: 'MP+1',
      rewardToken: '偏终结',
      preview: expect.stringContaining('-2 HP / 无污染')
    });
  });

  it('shows D2 and D3 activity titles in the run layer', () => {
    const baseSnapshot = {
      round: 1,
      player: {
        deck: ['debt_hook', 'redline_cut', 'row_cleave', 'severance_burst']
      },
      run: {
        currentNode: 1,
        maxNodes: 3,
        rewardHistory: []
      },
      activity: {
        id: 'redline-core-activity-01',
        title: '红线清算局 第一套闯关',
        totalDifficultyTiers: 10,
        playableLevelIds: ['d1', 'd2', 'd3'],
        completedLevelIds: []
      },
      debug: { events: [] }
    };

    const d2State = hudRunLayerState({
      ...baseSnapshot,
      run: { ...baseSnapshot.run, maxNodes: 4 },
      activity: { ...baseSnapshot.activity, currentLevelId: 'd2', completedLevelIds: ['d1'] }
    } as unknown as GameSnapshot);
    const d3State = hudRunLayerState({
      ...baseSnapshot,
      run: { ...baseSnapshot.run, maxNodes: 6 },
      activity: { ...baseSnapshot.activity, currentLevelId: 'd3', completedLevelIds: ['d1', 'd2'] }
    } as unknown as GameSnapshot);

    expect(d2State.title).toBe('D2 低压清算');
    expect(d2State.campaignLabel).toBe('D1-D3 连续三局 · 活动继承牌组/XP/升级');
    expect(d2State.difficultyBandLabel).toBe('低压 · 4节点');
    expect(d2State.nextDetail).toBe('牌组4 · 活动继承牌组');
    expect(d2State.nextDetail).not.toContain('仅本run');
    expect(d3State.title).toBe('D3 中级入口');
    expect(d3State.difficultyBandLabel).toBe('中级 · 6节点');
    expect(d3State.nextDetail).toBe('牌组4 · 活动继承牌组');
    expect(d3State.nextDetail).not.toContain('仅本run');
  });

  it('shows D4 as the pollution first-look activity level', () => {
    const snapshot = {
      round: 4,
      run: {
        currentNode: 1,
        maxNodes: 6,
        rewardHistory: []
      },
      player: {
        hp: 30,
        maxHp: 30,
        energy: 3,
        maxEnergy: 3,
        tempAuthorizationMP: 0,
        lastPlayedCost: null,
        costChainMultiplier: 1,
        xp: 0,
        level: 1,
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
      fsm: { gameFlow: 'Deal', characters: {} },
      reward: { pending: false, choices: [], xpThreshold: 12 },
      cardUpgrades: { enhancements: {}, choices: [], pending: false, history: [] },
      activity: {
        id: 'redline-core-activity-01',
        title: '红线清算局 第一套闯关',
        totalDifficultyTiers: 10,
        playableLevelIds: ['d1', 'd2', 'd3', 'd4'],
        currentLevelId: 'd4',
        completedLevelIds: ['d1', 'd2', 'd3']
      },
      debug: { events: [], commands: [], failedConditions: [], ruleHits: [], trace: [] },
      lastBurstTick: null
    } as unknown as GameSnapshot;

    expect(hudRunLayerState(snapshot).title).toBe('D4 污染首秀清算');
    expect(hudRunLayerState(snapshot).nodeLabel).toBe('节点 1/6');
    const root = {
      innerHTML: '',
      addEventListener: () => undefined
    } as unknown as HTMLElement;
    new Hud(root, () => undefined).render(snapshot);
    expect(root.innerHTML).toContain('污染=不接链状态牌');
    expect(root.innerHTML).toContain('抽到会挤掉 0-1-2');
    expect(root.innerHTML).toContain('用清污染/净化抽牌或打出消耗处理');
  });

  it('splits victory continue and failure retry settlement actions into distinct intents', () => {
    const listeners: Partial<Record<string, (event: Event) => void>> = {};
    const root = {
      innerHTML: '',
      addEventListener: (type: string, listener: EventListener) => {
        listeners[type] = listener as (event: Event) => void;
      }
    } as unknown as HTMLElement;
    const intents: unknown[] = [];
    const hud = new Hud(root, (intent) => intents.push(intent));
    const baseSettlement = {
      tick: 1,
      round: 4,
      elapsedSeconds: 0,
      player: {
        hp: 30,
        maxHp: 72,
        energy: 0,
        maxEnergy: 3,
        tempAuthorizationMP: 0,
        lastPlayedCost: null,
        costChainMultiplier: 1,
        xp: 12,
        level: 2,
        deck: ['debt_hook'],
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
      fsm: { gameFlow: 'Settlement', characters: {} },
      reward: { pending: false, choices: [], xpThreshold: 12 },
      cardUpgrades: { enhancements: {}, choices: [], pending: false, history: [] },
      debug: { events: [], commands: [], failedConditions: [], ruleHits: [], trace: [] },
      lastBurstTick: null,
      activity: {
        id: 'redline-core-activity-01',
        title: '红线清算局 第一套闯关',
        totalDifficultyTiers: 10,
        playableLevelIds: ['d1', 'd2', 'd3'],
        currentLevelId: 'd1',
        completedLevelIds: []
      }
    };

    hud.render({
      ...baseSettlement,
      player: {
        ...baseSettlement.player,
        deck: ['debt_hook', 'redline_cut', 'row_cleave', 'wild_gap_key', 'severance_burst', 'spark_tap', 'blood_tithe']
      },
      run: {
        runNumber: 1,
        currentNode: 3,
        maxNodes: 3,
        status: 'victory',
        rewardHistory: [{ cardId: 'wild_gap_key' }, { cardId: 'severance_burst' }, { cardId: 'spark_tap' }]
      },
      activitySettlementPreview: {
        currentLevelId: 'd1',
        currentLevelLabel: 'D1',
        currentLevelTitle: '试营业清算',
        completed: true,
        nextLevelId: 'd2',
        nextLevelLabel: 'D2',
        canContinue: true
      }
    } as unknown as GameSnapshot);

    expect(root.innerHTML).toContain('进入 D2');
    listeners.pointerdown?.({
      type: 'pointerdown',
      target: { closest: () => ({ disabled: false, dataset: {}, matches: (selector: string) => selector === '[data-continue-activity]' }) },
      preventDefault: () => undefined,
      stopPropagation: () => undefined
    } as unknown as Event);

    const retryListeners: Partial<Record<string, (event: Event) => void>> = {};
    const retryRoot = {
      innerHTML: '',
      addEventListener: (type: string, listener: EventListener) => {
        retryListeners[type] = listener as (event: Event) => void;
      }
    } as unknown as HTMLElement;
    const retryHud = new Hud(retryRoot, (intent) => intents.push(intent));

    retryHud.render({
      ...baseSettlement,
      run: { runNumber: 1, currentNode: 2, maxNodes: 3, status: 'failure', rewardHistory: [] },
      activitySettlementPreview: {
        currentLevelId: 'd1',
        currentLevelLabel: 'D1',
        currentLevelTitle: '试营业清算',
        completed: false,
        nextLevelId: null,
        nextLevelLabel: null,
        canContinue: false
      }
    } as unknown as GameSnapshot);

    expect(retryRoot.innerHTML).toContain('重试 D1');
    retryListeners.pointerdown?.({
      type: 'pointerdown',
      target: {
        closest: () => ({
          disabled: false,
          dataset: {},
          matches: (selector: string) => selector.includes('data-restart-current-level')
        })
      },
      preventDefault: () => undefined,
      stopPropagation: () => undefined
    } as unknown as Event);

    expect(intents).toEqual([
      expect.objectContaining({ type: 'continue-activity' }),
      expect.objectContaining({ type: 'restart-current-level' })
    ]);
  });

  it('explains D1-D3 settlement progression without changing playable tier flow', () => {
    const root = {
      innerHTML: '',
      addEventListener: () => undefined
    } as unknown as HTMLElement;
    const hud = new Hud(root, () => undefined);
    const baseSettlement = {
      tick: 1,
      round: 4,
      elapsedSeconds: 0,
      player: {
        hp: 30,
        maxHp: 72,
        energy: 0,
        maxEnergy: 3,
        tempAuthorizationMP: 0,
        lastPlayedCost: null,
        costChainMultiplier: 1,
        xp: 12,
        level: 2,
        deck: ['debt_hook'],
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
      fsm: { gameFlow: 'Settlement', characters: {} },
      reward: { pending: false, choices: [], xpThreshold: 12 },
      cardUpgrades: { enhancements: {}, choices: [], pending: false, history: [] },
      debug: { events: [], commands: [], failedConditions: [], ruleHits: [], trace: [] },
      lastBurstTick: null
    };

    hud.render({
      ...baseSettlement,
      player: {
        ...baseSettlement.player,
        deck: ['debt_hook', 'redline_cut', 'row_cleave', 'wild_gap_key', 'severance_burst', 'spark_tap', 'blood_tithe']
      },
      run: {
        runNumber: 1,
        currentNode: 3,
        maxNodes: 3,
        status: 'victory',
        rewardHistory: [{ cardId: 'wild_gap_key' }, { cardId: 'severance_burst' }, { cardId: 'spark_tap' }]
      },
      activity: {
        id: 'redline-core-activity-01',
        title: '红线清算局 第一套闯关',
        totalDifficultyTiers: 10,
        playableLevelIds: ['d1', 'd2', 'd3', 'd4'],
        currentLevelId: 'd1',
        completedLevelIds: []
      },
      activitySettlementPreview: {
        currentLevelId: 'd1',
        currentLevelLabel: 'D1',
        currentLevelTitle: '试营业清算',
        completed: true,
        nextLevelId: 'd2',
        nextLevelLabel: 'D2',
        canContinue: true
      }
    } as unknown as GameSnapshot);
    expect(root.innerHTML).toContain('进入 D2');
    expect(root.innerHTML).toContain('本局新增3张 / 牌组 4->7 / 下局继承');
    expect(root.innerHTML).toContain('继承 D1 牌组与基础属性');
    expect(root.innerHTML).toContain('保留牌组/XP/升级');
    expect(root.innerHTML).toContain('重置手牌/战场/路线');

    hud.render({
      ...baseSettlement,
      run: { runNumber: 2, currentNode: 3, maxNodes: 3, status: 'victory', rewardHistory: [] },
      activity: {
        id: 'redline-core-activity-01',
        title: '红线清算局 第一套闯关',
        totalDifficultyTiers: 10,
        playableLevelIds: ['d1', 'd2', 'd3', 'd4'],
        currentLevelId: 'd2',
        completedLevelIds: ['d1']
      },
      activitySettlementPreview: {
        currentLevelId: 'd2',
        currentLevelLabel: 'D2',
        currentLevelTitle: '低压过渡',
        completed: true,
        nextLevelId: 'd3',
        nextLevelLabel: 'D3',
        canContinue: true
      }
    } as unknown as GameSnapshot);
    expect(root.innerHTML).toContain('进入 D3');
    expect(root.innerHTML).toContain('继承 D1-D2 构筑');
    expect(root.innerHTML).toContain('保留牌组/XP/升级');
    expect(root.innerHTML).toContain('重置手牌/战场/路线');

    hud.render({
      ...baseSettlement,
      run: { runNumber: 2, currentNode: 6, maxNodes: 6, status: 'victory', rewardHistory: [] },
      activity: {
        id: 'redline-core-activity-01',
        title: '红线清算局 第一套闯关',
        totalDifficultyTiers: 10,
        playableLevelIds: ['d1', 'd2', 'd3', 'd4'],
        currentLevelId: 'd3',
        completedLevelIds: ['d1', 'd2']
      },
      activitySettlementPreview: {
        currentLevelId: 'd3',
        currentLevelLabel: 'D3',
        currentLevelTitle: '中级清算入口',
        completed: true,
        nextLevelId: 'd4',
        nextLevelLabel: 'D4',
        canContinue: true
      }
    } as unknown as GameSnapshot);
    expect(root.innerHTML).toContain('核心三局已打通');
    expect(root.innerHTML).toContain('进入 D4 前说明');
    expect(root.innerHTML).toContain('污染是不接链状态牌');
    expect(root.innerHTML).toContain('抽到会挤掉 0-1-2');
    expect(root.innerHTML).toContain('用清污染/净化抽牌或打出消耗处理');
    expect(root.innerHTML).toContain('进入 D4');
  });
});
