# 2026-05-19 第14轮-03：卡牌内容复刻 / 机制覆盖审查

工作目录：`/Users/roc/Game-001`  
角色：卡牌内容复刻 / 机制覆盖专家  
目标：按“1:1 机制复刻”口径审查 `cards.ts` 与机制支持，优先补齐卡牌类型、关键词、机制标签与奖励稀有度，不扩运行时大逻辑。

## 0. 本轮裁决

本轮做的是内容数据合同补齐，不是新运行时系统。

现有 `prototype-web/src/data/cards.ts` 已经能表达攻击、抽牌、修补、payoff、状态、消耗、保留和奖励分支，但缺少一层稳定的“机制索引”字段，导致后续 UI、QA、平衡和相似度审查只能从 `cardType / chainRole / keywords / description` 里反推。第 14 轮-03 已补上：

- `mechanicTags`：卡牌机制标签，覆盖攻击、技能、状态、污染、消耗、保留、抽牌、费用变化、护盾、连锁、授权、payoff、修补、资源、整备 / 置顶、目标形态。
- `rewardRarity`：奖励稀有度 / 池位标记，覆盖 starter、common、uncommon、rare、status、test。
- `shield` 与 `costModifier`：只作为内容合同字段，暂不接承伤或支付运行时。
- reserve-test 样本牌：补齐护盾、费用变化、抽牌+消耗组合样本，不进入正式 `rewardCardPool`。

关键边界：`rewardCardPool` 没有加入未运行时化的护盾 / 降费牌，避免玩家拿到“卡面有承诺但运行时不结算”的正式奖励。

## 1. 审查结果

| 机制项 | 当前状态 | 本轮处理 |
| --- | --- | --- |
| 攻击 | 已有 `attack`、单体 / 前排 / 全场目标 | 给所有攻击牌补 `mechanicTags` 与 `rewardRarity` |
| 技能 | 只有 `guard_reserve` 等后备表达 | 新增技能样本 `shield_reserve`、`burn_after_reading` |
| 状态 | 已有 `static_overload` | 补 `污染` 关键词、`pollution/status/exhaust` 标签 |
| 污染 | 运行时已有物理状态牌方向 | 明确数据层 `pollution` 标签和 `status` 稀有度 |
| 消耗 | 已有 lifecycle `onPlay: exhaust` | 补抽牌+消耗组合样本 `burn_after_reading` |
| 保留 | 已有 lifecycle `onTurnEnd: retain` | 给 `guard_reserve` 补 `retain` 标签和 test 稀有度 |
| 抽牌 | 已有 `drawCards` / `utilities: ['draw']` | 给抽牌牌补 `draw/self/reorder/topdeck` 标签 |
| 费用变化 | 缺内容字段 | 新增 `CardCostModifier` 和 `ledger_discount` 样本 |
| 护盾 | 缺内容字段 | 新增 `shield?: number` 和 `shield_reserve` 样本 |
| 连锁 | 已有 `chainRole/cycleRole` | 补统一 `chain` 标签，便于 UI/QA 不再反推 |
| 奖励稀有度 | 缺显式字段 | 给所有当前卡补 `rewardRarity` |

## 2. 新增 / 调整的数据合同

`prototype-web/src/sim/types.ts` 新增：

```ts
export type CardRewardRarity = 'starter' | 'common' | 'uncommon' | 'rare' | 'status' | 'test';
export type CardMechanicTag = ...;

export interface CardCostModifier {
  scope: 'next-card-this-turn' | 'self-while-retained' | 'turn';
  amount: number;
  appliesTo?: CardType | CardType[];
}
```

`CardDefinition` 新增可选字段：

```ts
mechanicTags?: CardMechanicTag[];
rewardRarity?: CardRewardRarity;
shield?: number;
costModifier?: CardCostModifier;
countsForChain?: boolean;
```

`countsForChain?: boolean` 是为了匹配当前 `static_overload` 已经使用的字段，避免状态 / 污染牌是否参与链路继续靠口头约定。

## 3. 新增 reserve-test 样本牌

### 3.1 `shield_reserve`

用途：补技能 / 护盾覆盖。

核心字段：

- `cardType: 'skill'`
- `shield: 6`
- `keywords: ['护盾', '护栏', '接链']`
- `mechanicTags: ['skill', 'shield', 'chain', 'self', 'reward-rarity']`
- `availability: 'reserve-test'`
- `rewardRarity: 'test'`

边界：它不进奖励池，不接承伤运行时，只提供内容层覆盖样本。

### 3.2 `ledger_discount`

用途：补资源 / 费用变化覆盖。

核心字段：

- `cardType: 'resource'`
- `costModifier: { scope: 'next-card-this-turn', amount: -1 }`
- `keywords: ['费用变化', '降费', '接链']`
- `mechanicTags: ['resource', 'cost-change', 'chain', 'self', 'reward-rarity']`
- `availability: 'reserve-test'`
- `rewardRarity: 'test'`

边界：它不改当前支付逻辑，不进奖励池。

### 3.3 `burn_after_reading`

用途：补技能 / 抽牌 / 消耗组合覆盖。

核心字段：

- `cardType: 'skill'`
- `drawCards: 2`
- `utilities: ['draw']`
- `lifecycle.onPlay: 'exhaust'`
- `keywords: ['抽牌', '消耗', '开链']`
- `mechanicTags: ['skill', 'draw', 'exhaust', 'chain', 'self', 'reward-rarity']`
- `availability: 'reserve-test'`

边界：不进入正式奖励池，避免 0 MP 抽 2 消耗影响当前平衡。

## 4. 正式奖励池边界

本轮没有把新增 reserve-test 样本加入 `rewardCardPool`。

原因：

- 护盾没有接入承伤 / 敌意图减免运行时。
- 费用变化没有接入支付计算。
- 0 MP 抽 2 消耗会显著改变当前 3-5 回合样片节奏。

当前正式奖励池仍只保留已运行时化或已有测试覆盖的路线：

- repair-resource：`blood_tithe`、`pulse_draw`、`wild_gap_key`、`wild_mana_stitch`
- route-bridge：`spark_tap`、`blood_reclaim`、`heartbeat_spark`、`verdict_mark`、`clearance_order`、`paper_shatter`、`lantern_captain`
- payoff：`severance_burst`、`red_ledger_burst`

## 5. 测试与验证

已执行：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run src/tests/sim/card-taxonomy.test.ts
npm run build
```

结果：

- `card-taxonomy.test.ts`：8 个测试通过。
- `npm run build`：`tsc && vite build` 通过。
- Vite 仍有 chunk size warning，这是既有打包体积提示，不影响本轮类型 / 数据合同验证。

## 6. 改动文件

- `prototype-web/src/data/cards.ts`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/tests/sim/card-taxonomy.test.ts`
- `design/technical/redline-batches/long-task/2026-05-19-round-14-03-card-content-parity.md`

## 7. 后续建议

下一刀如果要把 reserve-test 提升为正式 reward，顺序应该是：

1. 先接 `shield` 到敌意图 / 伤害结算，再开放 `shield_reserve` 或其正式版本。
2. 再接 `costModifier` 到支付预览、支付事件和断链判断，再开放降费牌。
3. 最后评估 `burn_after_reading` 是否会把 0 段和抽牌稳定性抬得过高，再决定是否进入 reward pool。

不要在同一刀里同时开放护盾、降费和强抽牌消耗牌，否则当前 `0 -> 1 -> 2 / Wild / payoff` 样片的可解释性会被新机制淹没。
