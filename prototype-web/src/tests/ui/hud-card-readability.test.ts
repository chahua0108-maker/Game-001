import { describe, expect, it } from 'vitest';
import { BASE_HAND_SIZE } from '../../sim/constants';
import type { CardId, GameSnapshot } from '../../sim/types';
import {
  Hud,
  hudBuildGapState,
  hudCardChainRoleLabel,
  hudCardDisplayName,
  hudCardMobileEffectLabel,
  hudCardPaymentVisualState,
  hudCardSecondaryRoleLabel,
  hudCardShortName,
  hudCardTypeMark,
  hudCardTypeLabel,
  hudRewardBranchLabel
} from '../../ui/hud';
import { cards } from '../../data/cards';

function rootStub(): HTMLElement {
  return {
    innerHTML: '',
    addEventListener: () => undefined
  } as unknown as HTMLElement;
}

function snapshot(overrides: any = {}): GameSnapshot {
  const base = {
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
      deck: ['debt_hook', 'redline_cut', 'row_cleave', 'wild_gap_key', 'severance_burst'],
      hand: ['debt_hook', 'redline_cut', 'row_cleave'],
      drawPile: ['wild_gap_key'],
      discardPile: ['heartbeat_spark'],
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
    fsm: { gameFlow: 'PlayerTurn', characters: {} },
    reward: { pending: false, choices: [], xpThreshold: 12 },
    cardUpgrades: { enhancements: {}, choices: [], pending: false, history: [] },
    debug: { events: [], commands: [], failedConditions: [], ruleHits: [], trace: [] },
    lastBurstTick: null,
    run: { runNumber: 1, currentNode: 1, maxNodes: 3, status: 'in-progress', rewardHistory: [] }
  } as unknown as GameSnapshot;

  return {
    ...base,
    ...overrides,
    player: { ...base.player, ...overrides.player },
    chain: { ...base.chain, ...overrides.chain },
    fsm: { ...base.fsm, ...overrides.fsm },
    reward: { ...base.reward, ...overrides.reward },
    debug: { ...base.debug, ...overrides.debug }
  } as GameSnapshot;
}

function renderHud(input: GameSnapshot): string {
  const root = rootStub();
  new Hud(root, () => undefined).render(input);
  return root.innerHTML;
}

function cardMarkup(html: string, cardId: CardId): string {
  const match = html.match(new RegExp(`<button class="card-button[\\s\\S]*?data-card-id="${cardId}"[\\s\\S]*?<\\/button>`));
  return match?.[0] ?? '';
}

function rewardCardMarkup(html: string, cardId: CardId): string {
  const match = html.match(new RegExp(`<button[\\s\\S]*?class="reward-card[\\s\\S]*?data-reward-card-id="${cardId}"[\\s\\S]*?<\\/button>`));
  return match?.[0] ?? '';
}

describe('HUD card readability P0', () => {
  it('uses the shared base hand size in the pile chip while keeping pile zone labels visible', () => {
    const html = renderHud(
      snapshot({
        player: {
          hand: ['debt_hook', 'redline_cut', 'row_cleave'],
          drawPile: ['wild_gap_key'],
          discardPile: ['heartbeat_spark', 'row_cleave'],
          exhaustPile: [],
          retainedCards: []
        } as unknown as GameSnapshot['player']
      })
    );

    expect(html).toContain(`手3/${BASE_HAND_SIZE}`);
    expect(html).toContain('抽1 弃2');
    expect(html).toContain('消0 留0 总5');
    expect(html).toContain(`data-base-hand-size="${BASE_HAND_SIZE}"`);
  });

  it('renders Chinese card titles without exposing English names to player-facing markup', () => {
    const html = renderHud(snapshot({ player: { hand: ['debt_hook', 'redline_cut', 'row_cleave'] } as GameSnapshot['player'] }));

    expect(cardMarkup(html, 'debt_hook')).toContain('<strong>债钩</strong>');
    expect(cardMarkup(html, 'redline_cut')).toContain('<strong>切割</strong>');
    expect(cardMarkup(html, 'row_cleave')).toContain('<strong>横扫</strong>');
    expect(cardMarkup(html, 'debt_hook')).not.toContain('Debt Hook');
    expect(cardMarkup(html, 'redline_cut')).not.toContain('Redline Cut');
    expect(html).not.toContain('英文名');
  });

  it('exports stable display labels for cards, types, chain roles and reward branches', () => {
    expect(hudCardDisplayName(cards.debt_hook)).toBe('债钩');
    expect(hudCardShortName(cards.redline_cut)).toBe('切割');
    expect(hudCardTypeLabel(cards.debt_hook)).toBe('攻击');
    expect(hudCardChainRoleLabel(cards.debt_hook)).toBe('开链');
    expect(hudCardChainRoleLabel(cards.static_overload)).toBe('不接链');
    expect(hudCardSecondaryRoleLabel(cards.wild_gap_key)).toBe('补缺口');
    expect(hudCardSecondaryRoleLabel(cards.severance_burst)).toBe('MP/授权');
    expect(hudCardSecondaryRoleLabel(cards.clearance_order)).toBe('2费展开');
    expect(hudCardTypeMark(cards.debt_hook)).toBe('攻');
    expect(hudCardTypeMark(cards.wild_gap_key)).toBe('修');
    expect(hudCardTypeMark(cards.severance_burst)).toBe('终');
    expect(hudRewardBranchLabel('repair-resource')).toBe('修补');
  });

  it('adds stable card semantic attributes and classes to hand cards', () => {
    const html = renderHud(
      snapshot({
        player: {
          hand: ['debt_hook', 'wild_gap_key', 'static_overload']
        } as GameSnapshot['player']
      })
    );

    expect(cardMarkup(html, 'debt_hook')).toContain('data-card-type="attack"');
    expect(cardMarkup(html, 'debt_hook')).toContain('data-chain-role="starter"');
    expect(cardMarkup(html, 'wild_gap_key')).toContain('data-card-type="repair"');
    expect(cardMarkup(html, 'wild_gap_key')).toContain('data-chain-role="repair"');
    expect(cardMarkup(html, 'static_overload')).toContain('data-card-type="status"');
    expect(cardMarkup(html, 'static_overload')).toContain('card-type-status');
  });

  it('derives the five MP box visual states without changing payment rules', () => {
    expect(hudCardPaymentVisualState(cards.debt_hook, snapshot({ player: { energy: 3, hand: ['debt_hook'] } as GameSnapshot['player'] }))).toBe(
      'normal-payable'
    );
    expect(
      hudCardPaymentVisualState(
        cards.severance_burst,
        snapshot({ player: { energy: 0, tempAuthorizationMP: 3, hand: ['severance_burst'] } as GameSnapshot['player'] })
      )
    ).toBe('authorization-payable');
    expect(hudCardPaymentVisualState(cards.row_cleave, snapshot({ player: { energy: 0, hand: ['row_cleave'] } as GameSnapshot['player'] }))).toBe(
      'missing-mp'
    );
    expect(
      hudCardPaymentVisualState(
        cards.row_cleave,
        snapshot({
          player: { energy: 2, lastPlayedCost: 0, costChainMultiplier: 1, hand: ['row_cleave'] } as GameSnapshot['player'],
          chain: { playedCosts: [0], lastCost: 0, nextExpectedCost: 1, multiplier: 1 } as GameSnapshot['chain']
        })
      )
    ).toBe('chain-break-playable');
    expect(
      hudCardPaymentVisualState(
        cards.debt_hook,
        snapshot({ fsm: { gameFlow: 'Deal', characters: {} }, player: { energy: 3, hand: ['debt_hook'] } as GameSnapshot['player'] })
      )
    ).toBe('not-playable');
  });

  it('renders MP box state attributes and short dynamic labels on cards', () => {
    const authorized = cardMarkup(
      renderHud(snapshot({ player: { energy: 0, tempAuthorizationMP: 3, hand: ['severance_burst'] } as GameSnapshot['player'] })),
      'severance_burst'
    );
    const missing = cardMarkup(renderHud(snapshot({ player: { energy: 0, hand: ['row_cleave'] } as GameSnapshot['player'] })), 'row_cleave');
    const breakPlayable = cardMarkup(
      renderHud(
        snapshot({
          player: { energy: 2, lastPlayedCost: 0, costChainMultiplier: 1, hand: ['row_cleave'] } as GameSnapshot['player'],
          chain: { playedCosts: [0], lastCost: 0, nextExpectedCost: 1, multiplier: 1 } as GameSnapshot['chain']
        })
      ),
      'row_cleave'
    );
    const deal = cardMarkup(
      renderHud(snapshot({ fsm: { gameFlow: 'Deal', characters: {} }, player: { hand: ['debt_hook'] } as GameSnapshot['player'] })),
      'debt_hook'
    );

    expect(authorized).toContain('data-payment-state="authorization-payable"');
    expect(authorized).toContain('payment-state-authorization-payable');
    expect(authorized).toContain('授权付');
    expect(missing).toContain('data-payment-state="missing-mp"');
    expect(missing).toContain('缺MP2');
    expect(breakPlayable).toContain('data-payment-state="chain-break-playable"');
    expect(breakPlayable).toContain('断链可打');
    expect(deal).toContain('data-payment-state="not-playable"');
    expect(deal).toContain('不可打');
  });

  it('shows visible card priority and target facts on the card face', () => {
    const html = renderHud(
      snapshot({
        player: {
          energy: 3,
          hand: ['debt_hook', 'redline_cut', 'row_cleave']
        } as GameSnapshot['player'],
        enemies: [
          {
            id: 'enemy-1',
            definitionId: 'debt_wisp',
            name: 'Debt Wisp',
            hp: 10,
            maxHp: 10,
            slot: 0,
            lane: -2,
            z: -6,
            alive: true
          },
          {
            id: 'enemy-2',
            definitionId: 'redline_brute',
            name: 'Redline Brute',
            hp: 18,
            maxHp: 18,
            slot: 1,
            lane: -1,
            z: -6,
            alive: true
          }
        ],
        enemyIntents: [
          { enemyId: 'enemy-1', kind: 'attack', amount: 2, slot: 0, description: 'attack', willRefill: true },
          { enemyId: 'enemy-2', kind: 'attack', amount: 5, slot: 1, description: 'attack', willRefill: true }
        ],
        enemyIntentSummary: { totalDamage: 7, intentEnemyIds: ['enemy-1', 'enemy-2'] }
      })
    );

    expect(cardMarkup(html, 'debt_hook')).toContain('推荐：接链');
    expect(cardMarkup(html, 'debt_hook')).toContain('目标：蛮兵 18/18');
    expect(cardMarkup(html, 'redline_cut')).toContain('风险：断链可打');
    expect(cardMarkup(html, 'redline_cut')).toContain('未减伤7');
  });

  it('surfaces authorization segment and payoff authorization labels', () => {
    const segment = cardMarkup(renderHud(snapshot({ player: { energy: 3, hand: ['row_cleave'] } as GameSnapshot['player'] })), 'row_cleave');
    const authorized = cardMarkup(
      renderHud(snapshot({ player: { energy: 0, tempAuthorizationMP: 3, hand: ['severance_burst'] } as GameSnapshot['player'] })),
      'severance_burst'
    );
    const unauthorized = cardMarkup(
      renderHud(snapshot({ player: { energy: 0, tempAuthorizationMP: 0, hand: ['severance_burst'] } as GameSnapshot['player'] })),
      'severance_burst'
    );
    const naturalMp = cardMarkup(
      renderHud(snapshot({ player: { energy: 3, tempAuthorizationMP: 0, hand: ['severance_burst'] } as GameSnapshot['player'] })),
      'severance_burst'
    );

    expect(segment).toContain('接链后授权3');
    expect(authorized).toContain('授权可付');
    expect(authorized).toContain('全场 16');
    expect(unauthorized).toContain('需MP或授权');
    expect(naturalMp).toContain('MP可付');
    expect(naturalMp).not.toContain('未授权');
  });

  it('turns an open authorization window without payoff into a closed-loop decision prompt', () => {
    const html = renderHud(
      snapshot({
        player: {
          energy: 0,
          tempAuthorizationMP: 3,
          hand: ['debt_hook', 'redline_cut']
        } as GameSnapshot['player']
      })
    );

    expect(html).toContain('授权已开');
    expect(html).toContain('等终结牌；奖励优先拿终结');
  });

  it('prioritizes direct payoff copy when a finisher is already playable', () => {
    const html = renderHud(
      snapshot({
        player: {
          energy: 3,
          tempAuthorizationMP: 0,
          hand: ['severance_burst', 'debt_hook']
        } as GameSnapshot['player']
      })
    );

    expect(html).toContain('现在可直接处刑');
    expect(html).toContain('走0>1>2开授权');
    expect(html).toContain('可能先清场/拿奖励');
    expect(html).toContain('终结可打');
    expect(html).not.toContain('先打MP0');
  });

  it('renders reward cards with default readable information and hides empty reward shells', () => {
    const rewardHtml = renderHud(
      snapshot({
        fsm: { gameFlow: 'Reward', characters: {} },
        reward: { pending: true, choices: ['severance_burst', 'wild_gap_key'], xpThreshold: 12 },
        player: {
          hand: [],
          deck: ['debt_hook', 'redline_cut', 'row_cleave', 'wild_gap_key']
        } as unknown as GameSnapshot['player']
      })
    );
    const emptyHtml = renderHud(
      snapshot({
        fsm: { gameFlow: 'Reward', characters: {} },
        reward: { pending: false, choices: [], xpThreshold: 12 },
        player: { hand: [] } as unknown as GameSnapshot['player']
      })
    );

    expect(rewardHtml).toContain('class="reward-card card-type-payoff chain-role-payoff');
    expect(rewardHtml).toContain('data-card-type="payoff"');
    expect(rewardHtml).toContain('data-chain-role="payoff"');
    expect(rewardHtml).toContain('data-reward-branch="payoff"');
    expect(rewardHtml).toContain('<strong>断账爆发</strong>');
    expect(rewardHtml).toContain('终结 · MP/授权');
    expect(rewardHtml).toContain('class="card-type-mark" aria-label="终结">终</b>');
    expect(rewardHtml).toContain('缺终结，优先拿终结牌');
    expect(rewardHtml).toContain('选择后加入继承牌组，后续活动继续可抽到');
    expect(rewardCardMarkup(rewardHtml, 'severance_burst')).not.toContain('已加入继承牌组，后续活动继续可抽到');
    expect(rewardCardMarkup(rewardHtml, 'wild_gap_key')).not.toContain('已加入继承牌组，后续活动继续可抽到');
    expect(emptyHtml).not.toContain('reward-panel');
  });

  it('keeps lifecycle and non-chain status facts visible on hand cards', () => {
    const html = renderHud(
      snapshot({
        player: {
          hand: ['static_overload', 'last_light_cache', 'silt_purge']
        } as GameSnapshot['player']
      })
    );

    const status = cardMarkup(html, 'static_overload');
    const retained = cardMarkup(html, 'last_light_cache');
    const purified = cardMarkup(html, 'silt_purge');

    expect(status).toContain('<span class="card-meta"><b class="card-type-mark" aria-label="状态">状</b> 状态 · 污染/不接链</span>');
    expect(status).toContain('<span class="chain-preview ">不接链</span>');
    expect(status).not.toContain('状态</b> · 开链');
    expect(status).toContain('状态 · 污染');
    expect(retained).toContain('留');
    expect(purified).toContain('净');
    expect(purified).toContain('清污染');
  });

  it('uses player-facing chain and authorization copy on first hand cards', () => {
    const html = renderHud(
      snapshot({
        player: {
          energy: 3,
          hand: ['row_cleave', 'clearance_order']
        } as GameSnapshot['player']
      })
    );

    expect(cardMarkup(html, 'row_cleave')).toContain('等待0费起链');
    expect(cardMarkup(html, 'clearance_order')).toContain('接链后授权3');
    expect(html).not.toContain('非起x1');
    expect(html).not.toContain('给授权 +3');
  });

  it('highlights the 2-cost authorization segment and warns against breaking the authorization window', () => {
    const html = renderHud(
      snapshot({
        player: {
          energy: 3,
          lastPlayedCost: 1,
          costChainMultiplier: 2,
          hand: ['redline_cut', 'row_cleave']
        } as GameSnapshot['player'],
        chain: {
          playedCosts: [0, 1],
          lastCost: 1,
          nextExpectedCost: 2,
          multiplier: 2,
          broken: false,
          breakReason: null,
          repairedThisTurn: false,
          extendedThisTurn: false
        } as GameSnapshot['chain']
      })
    );

    expect(cardMarkup(html, 'row_cleave')).toContain('2费展开 · 接链后授权3');
    expect(cardMarkup(html, 'redline_cut')).toContain('断授权窗/少2费');
  });

  it('keeps a compact mobile effect line available for every hand card', () => {
    const html = renderHud(
      snapshot({
        player: {
          hand: ['debt_hook', 'row_cleave', 'blood_tithe', 'silt_purge']
        } as GameSnapshot['player']
      })
    );

    expect(hudCardMobileEffectLabel(cards.debt_hook)).toBe('单体4');
    expect(hudCardMobileEffectLabel({ ...cards.debt_hook, mobileEffect: '单体4单体4' })).toBe('单体4');
    expect(hudCardMobileEffectLabel(cards.row_cleave)).toBe('前排5');
    expect(hudCardMobileEffectLabel(cards.blood_tithe)).toBe('抽1');
    expect(hudCardMobileEffectLabel(cards.silt_purge)).toBe('净化抽1');
    expect(cardMarkup(html, 'debt_hook')).toContain('class="mobile-effect">单体4</span>');
    expect(cardMarkup(html, 'row_cleave')).toContain('class="mobile-effect">前排5</span>');
    expect(cardMarkup(html, 'blood_tithe')).toContain('class="mobile-effect">抽1</span>');
    expect(cardMarkup(html, 'silt_purge')).toContain('class="mobile-effect">净化抽1</span>');
    expect(cardMarkup(html, 'debt_hook')).not.toContain('单体4单体4');
  });

  it('keeps opened debug records player-facing when internal traces are present', () => {
    const html = renderHud(
      snapshot({
        debug: {
          events: [],
          commands: [{ type: 'internal command' }, { type: 'select-route' }] as unknown as GameSnapshot['debug']['commands'],
          failedConditions: [
            { conditionId: 'RouteSelect', reason: 'SetGameFlowStateDealHand blocked by pointer' },
            { conditionId: 'raw.unmapped.Condition', reason: 'SomeInternalState -> Idle' }
          ] as GameSnapshot['debug']['failedConditions'],
          ruleHits: [
            { ruleId: 'SetGameFlowStateDealHand', passed: false },
            { ruleId: 'card.damage.front-enemy', passed: true },
            { ruleId: 'raw.unmapped.RuleId', passed: true }
          ] as GameSnapshot['debug']['ruleHits'],
          trace: [
            { tick: 1, traceId: 'pointer-1', kind: 'command', label: 'SetGameFlowStateDealHand' },
            { tick: 2, traceId: 'route-1', kind: 'fsm', label: 'RouteSelect' },
            { tick: 3, traceId: 'cast-1', kind: 'fsm', label: 'player -> Idle: cast resolved' },
            { tick: 4, traceId: 'raw-1', kind: 'fsm', label: 'SomeInternalState -> Idle' }
          ]
        }
      })
    );

    expect(html).toContain('进入发牌');
    expect(html).toContain('路线选择');
    expect(html).toContain('单体伤害触发');
    expect(html).toContain('玩家出牌结算');
    expect(html).toContain('最近战况');
    expect(html).toContain('结算明细');
    expect(html).toContain('效果');
    expect(html).toContain('未触发');
    expect(html).toContain('最近操作');
    expect(html).not.toContain('SetGameFlowStateDealHand');
    expect(html).not.toContain('RouteSelect');
    expect(html).not.toContain('调试记录');
    expect(html).not.toContain('pointer');
    expect(html).not.toContain('pointer-1');
    expect(html).not.toContain('route-1');
    expect(html).not.toContain('card.damage.front-enemy');
    expect(html).not.toContain('raw.unmapped');
    expect(html).not.toContain('SomeInternalState');
    expect(html).not.toContain('玩家 -> 待机');
    expect(html).not.toContain('internal command');
    expect(html).not.toContain('规则</dt>');
    expect(html).not.toContain('指令</dt>');
    expect(html).not.toContain('记录</dt>');
  });

  it('uses player-facing deal, finisher decision and enemy text in mobile-critical HUD copy', () => {
    const dealHtml = renderHud(
      snapshot({
        fsm: { gameFlow: 'Deal', characters: {} },
        enemies: [
          {
            id: 'enemy-1',
            definitionId: 'debt_wisp',
            name: 'Debt Wisp',
            hp: 10,
            maxHp: 10,
            slot: 0,
            lane: -2,
            z: -6,
            alive: true
          },
          {
            id: 'enemy-2',
            definitionId: 'redline_brute',
            name: 'Redline Brute',
            hp: 22,
            maxHp: 22,
            slot: 1,
            lane: -1,
            z: -6,
            alive: true
          }
        ],
        enemyIntents: [
          { enemyId: 'enemy-1', kind: 'attack', amount: 2, slot: 0, description: 'attack', willRefill: true },
          { enemyId: 'enemy-2', kind: 'attack', amount: 5, slot: 1, description: 'attack', willRefill: true }
        ],
        enemyIntentSummary: { totalDamage: 7, intentEnemyIds: ['enemy-1', 'enemy-2'] }
      })
    );
    const payoffHtml = renderHud(
      snapshot({
        player: {
          energy: 3,
          tempAuthorizationMP: 0,
          hand: ['severance_burst', 'debt_hook']
        } as GameSnapshot['player']
      })
    );
    const chainHtml = renderHud(
      snapshot({
        player: {
          energy: 3,
          tempAuthorizationMP: 0,
          hand: ['debt_hook', 'redline_cut', 'row_cleave']
        } as GameSnapshot['player']
      })
    );

    expect(dealHtml).toContain('点击发牌');
    expect(dealHtml).not.toContain('按 D');
    expect(dealHtml).toContain('债雾 2 / 红线蛮兵 5');
    expect(dealHtml).not.toContain('Debt Wisp');
    expect(dealHtml).not.toContain('Redline Brute');
    expect(payoffHtml).toContain('class="finisher-decision-bar direct"');
    expect(payoffHtml).toContain('直接处刑');
    expect(payoffHtml).toContain('走0>1>2开授权');
    expect(chainHtml).toContain('class="finisher-decision-bar chain-open"');
    expect(chainHtml).toContain('走链路开授权');
  });

  it('adds a non-blocking hand rail hint near the card row', () => {
    const html = renderHud(
      snapshot({
        player: {
          hand: ['debt_hook', 'redline_cut', 'row_cleave', 'wild_gap_key', 'static_overload', 'last_light_cache', 'silt_purge', 'severance_burst']
        } as GameSnapshot['player']
      })
    );

    expect(html).toContain('class="card-rail-hint"');
    expect(html).toContain(`手牌 8/${BASE_HAND_SIZE} 可横滑`);
    expect(html).toContain('还有7张');
  });

  it('derives deck role gap tokens without touching build rules', () => {
    const input = snapshot({
      player: {
        deck: ['debt_hook', 'redline_cut', 'static_overload'],
        hand: ['debt_hook']
      } as GameSnapshot['player']
    });
    const state = hudBuildGapState(input);
    const html = renderHud(input);

    expect(state.tokens.map((token) => token.label)).toEqual(['开链x1', '承接x1', '展开x0', '终结x0', '修补x0', '污染x1']);
    expect(state.primaryGap?.role).toBe('expand');
    expect(html).toContain('class="build-gap-bar');
    expect(html).toContain('data-build-gap-role="expand"');
    expect(html).toContain('展开x0');
    expect(html).toContain('终结x0');
    expect(html).toContain('修补x0');
  });
});
