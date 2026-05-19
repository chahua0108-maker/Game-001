# 2026-05-19 第18轮-06：卡牌内容密度 / 原创机制边界

工作目录：`/Users/roc/Game-001`  
角色：卡牌内容密度设计师 / 原创机制边界  
写入范围：`prototype-web/src/data/cards.ts`、`prototype-web/src/tests/sim/redline-round-18-card-content.test.ts`、本记录

## 1. 目标

第18轮的缺口是连续 3-5 节点内，玩家在污染、缺桥、缺资源或坏手救场时缺少足够多的可选牌。此轮只补最小内容密度，不改 runtime、reward 逻辑或 HUD。

## 2. 新增原创奖励牌

| 卡牌 | 定位 | 合同字段 | 奖励池 |
| --- | --- | --- | --- |
| `ash_filter` | 清污染 / 解堵 | `cardType: repair`、`cycleRole: draw-fixer`、`pollution`、`exhaust`、抽 1 后消耗 | 是 |
| `toll_shunt` | 补桥 / 修补费用缺口 | `cardType: repair`、`chainRole: repair`、`utilities: ['wild']`、`rewardBranches: ['repair-resource', 'route-bridge']` | 是 |
| `last_light_cache` | 失败救场 / 坏手保留 | `cardType: skill`、`cycleRole: draw-fixer`、抽 1、回合末保留 | 是 |

## 3. 边界

- 命名、文案、机制组合均为项目内原创表达，不沿用竞品卡名、原文或美术表达。
- 三张牌均使用已有数据合同：`drawCards`、`utilities: ['wild']`、`lifecycle.onPlay: exhaust`、`lifecycle.onTurnEnd: retain`、`rewardBranches`。
- 没有新增永久资源、最大 MP、账号层、局外成长或新运行时能力。
- `ash_filter` 和 `last_light_cache` 不带 `energyGain`；`toll_shunt` 只修补费用链，不提高最大 MP。
- 新卡追加到 `rewardCardPool` 末尾，避免改变已有默认奖励排序测试。

## 4. 测试

新增 `prototype-web/src/tests/sim/redline-round-18-card-content.test.ts`：

- 验证三张新卡拥有正确 `cardType`、`mechanicTags`、`rewardBranches`、`cycleRole` / `buildRole`。
- 验证三张牌都进入正式奖励池。
- 验证清污染和救场牌不携带 `energyGain`、`runUpgrade`、`costModifier` 等会被误读为局外成长或永久资源的字段。

## 5. 验证记录

红灯：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run src/tests/sim/redline-round-18-card-content.test.ts
```

结果：失败，原因是 `ash_filter` 等第18轮新卡尚不存在。

绿灯：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run src/tests/sim/redline-round-18-card-content.test.ts
npm test -- --run src/tests/sim/redline-round-18-card-content.test.ts src/tests/sim/card-taxonomy.test.ts src/tests/sim/reward-branching.test.ts src/tests/sim/redline-reward-build-plan.test.ts src/tests/sim/redline-build-plan.test.ts
```

结果：

- 新增测试：2 passed。
- 相关 sim 测试：5 files / 26 tests passed。
