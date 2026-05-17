import type { CardDefinition } from '../sim/types';

export const cards: Record<string, CardDefinition> = {
  debt_hook: {
    id: 'debt_hook',
    name: 'Debt Hook',
    cost: 0,
    verb: '拉',
    damage: 4,
    comboNode: 'hook',
    targets: 'front-enemy',
    description: '0 mana 启动牌。低伤害拉前排，稳定打开 0->1->2 连锁。'
  },
  blood_reclaim: {
    id: 'blood_reclaim',
    name: 'Blood Reclaim',
    cost: 0,
    verb: '回收',
    damage: 3,
    comboNode: 'reclaim',
    targets: 'front-enemy',
    description: '0 mana 路线牌。轻伤害补链，适合接 1 mana 攻击或抽牌。'
  },
  blood_tithe: {
    id: 'blood_tithe',
    name: 'Blood Tithe',
    cost: 0,
    verb: '献血',
    damage: 0,
    comboNode: 'reclaim',
    targets: 'self',
    drawCards: 1,
    description: '0 mana 自身牌。抽 1 张，用手牌流动来打开升序费用链。'
  },
  spark_tap: {
    id: 'spark_tap',
    name: 'Spark Tap',
    cost: 0,
    verb: '点火',
    damage: 2,
    comboNode: 'spark',
    targets: 'front-enemy',
    description: '0 mana 点火牌。低伤害前排补链，给 Spark 路线起手。'
  },
  redline_cut: {
    id: 'redline_cut',
    name: 'Redline Cut',
    cost: 1,
    verb: '切',
    damage: 9,
    comboNode: 'cut',
    targets: 'front-enemy',
    description: '1 mana 承接牌。对最前方敌人造成 9 点基础伤害。'
  },
  heartbeat_spark: {
    id: 'heartbeat_spark',
    name: 'Heartbeat Spark',
    cost: 1,
    verb: '爆',
    damage: 6,
    comboNode: 'spark',
    targets: 'front-enemy',
    description: '1 mana Spark 承接。中低伤害，偏向保持连锁节奏。'
  },
  verdict_mark: {
    id: 'verdict_mark',
    name: 'Verdict Mark',
    cost: 1,
    verb: '印',
    damage: 5,
    comboNode: 'mark',
    targets: 'front-enemy',
    description: '1 mana Mark 路线牌。轻伤害标记前排，方便后续清场。'
  },
  pulse_draw: {
    id: 'pulse_draw',
    name: 'Pulse Draw',
    cost: 1,
    verb: '充能',
    damage: 0,
    comboNode: 'spark',
    targets: 'self',
    drawCards: 1,
    description: '1 mana 抽牌承接。抽 1 张，牺牲伤害换路线稳定性。'
  },
  row_cleave: {
    id: 'row_cleave',
    name: 'Row Cleave',
    cost: 2,
    verb: '横扫',
    damage: 5,
    comboNode: 'cut',
    targets: 'front-row',
    description: '2 mana 展开牌。对第一排所有敌人造成 5 点基础伤害。'
  },
  clearance_order: {
    id: 'clearance_order',
    name: 'Clearance Order',
    cost: 2,
    verb: '清算',
    damage: 7,
    comboNode: 'burst',
    targets: 'front-row',
    description: '2 mana 清场路线。对第一排所有敌人造成 7 点基础伤害。'
  },
  paper_shatter: {
    id: 'paper_shatter',
    name: 'Paper Route',
    cost: 2,
    verb: '整备',
    damage: 0,
    comboNode: 'mark',
    targets: 'self',
    drawCards: 1,
    description: '2 mana 路线牌。抽 1 张，偏向支援和找终结。'
  },
  severance_burst: {
    id: 'severance_burst',
    name: 'Severance Burst',
    cost: 3,
    verb: '处刑',
    damage: 16,
    comboNode: 'burst',
    targets: 'all-enemies',
    description: '3 mana 终结牌。对全场敌人造成 16 点基础伤害，只从奖励池进入。'
  },
  red_ledger_burst: {
    id: 'red_ledger_burst',
    name: 'Red Ledger Burst',
    cost: 3,
    verb: '爆破',
    damage: 12,
    comboNode: 'burst',
    targets: 'all-enemies',
    description: '3 mana 清场终结。对全场敌人造成 12 点基础伤害。'
  },
  wild_mana_stitch: {
    id: 'wild_mana_stitch',
    name: 'Wild Mana Stitch',
    cost: 0,
    verb: '缝合',
    damage: 0,
    comboNode: 'reclaim',
    targets: 'self',
    drawCards: 1,
    description: 'Wild/补链近似。0 mana self 抽 1 张，用来修补断开的费用链。'
  },
  wild_gap_key: {
    id: 'wild_gap_key',
    name: 'Wild Gap Key',
    cost: 1,
    verb: '补位',
    damage: 1,
    comboNode: 'hook',
    targets: 'front-enemy',
    description: 'Wild/补链近似。1 mana 低伤害补位，保持连锁不断。'
  },
  lantern_captain: {
    id: 'lantern_captain',
    name: 'Lantern Captain',
    cost: 2,
    verb: '号令',
    damage: 0,
    comboNode: 'mark',
    targets: 'self',
    drawCards: 1,
    description: '角色卡风味近似。2 mana self 抽 1 张，代表队长支援和路线修正。'
  }
};

export const startingHand: string[] = [
  'debt_hook',
  'heartbeat_spark',
  'redline_cut',
  'row_cleave'
];

export const rewardCardPool: string[] = [
  'wild_mana_stitch',
  'lantern_captain',
  'severance_burst',
  'wild_gap_key',
  'red_ledger_burst',
  'paper_shatter',
  'spark_tap',
  'blood_reclaim',
  'heartbeat_spark',
  'verdict_mark',
  'clearance_order'
];
