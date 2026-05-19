# 2026-05-19 第18轮-05：奖励回应与牌池经济设计师

角色：奖励回应与牌池经济设计师  
工作目录：`/Users/roc/Game-001`  
写集：`rewardProgression.ts`、`rewardChoices.ts`、`redline-round-18-reward-pressure.test.ts`、本文档。

## 0. 结论

本轮把奖励回应从“按 role 列表连续拿第一个匹配”收紧为“组合压力下按问题槽轮转”：

- 单一压力保持第15-17轮既有合同，例如污染仍可先给净化/保留，缺资源仍可先给授权/抽牌。
- 组合压力进入 balanced path：污染、缺终结、缺桥、缺资源各先占一个回应槽，避免同一类问题连续吃掉前两三个奖励位。
- build plan 与 route 给出同类资源提示时，不再把它当成额外权重重复叠加；补位会优先补 payoff / resource / bridge 的缺口。
- 当资源与桥压力同时存在时，桥位优先找真正的 `route-bridge` 主定位，避免 Wild/repair 牌同时冒充资源修复和桥修复。

## 1. 实现

### `prototype-web/src/sim/rewardProgression.ts`

新增压力层抽象：

- `RewardResponsePressure = pollution | payoff | bridge | resource`
- `rewardResponsePressureSignals(profile)`
- `rewardResponsePressuresForProfile(profile)`

它们不会替代旧的 `rewardResponseRolesForProblems()`，只在 `rewardChoices` 需要判断“是否组合压力/重复压力”时使用。

### `prototype-web/src/sim/rewardChoices.ts`

新增组合压力排序：

1. 先保留 preferred / upgrade target 的最高优先级。
2. 如果 profile 只有单一压力，继续走旧 role + branch 流程。
3. 如果 profile 有多类压力，或同一压力被 build plan / route 重复提示，则：
   - 每类压力先取一个明确回应候选；
   - 后续补位按当前压力覆盖数量选择缺口；
   - fallback 顺序为 payoff -> resource -> bridge -> pollution；
   - 同时存在 resource + bridge 时，bridge 槽优先选择主定位为 `route-bridge` 的牌。

## 2. 新增测试

新增：

- `prototype-web/src/tests/sim/redline-round-18-reward-pressure.test.ts`

覆盖三类压力组合：

1. `polluted + missing-payoff`：只先给一个污染清理槽，然后立刻补终结牌，不让保留牌挤掉 payoff。
2. `missing-bridge + route payoff`：桥修复和路线终结交错出现，不把前两个槽都花在桥牌上。
3. `missing-resource + repeated repair-resource hints`：build plan 与 route 的资源提示不双重加权，4 张选择仍覆盖 `route-bridge / payoff / repair-resource`。

## 3. 验证

已通过：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run src/tests/sim/redline-round-18-reward-pressure.test.ts
npm test -- --run src/tests/sim/redline-reward-response.test.ts src/tests/sim/redline-reward-route-response.test.ts src/tests/sim/redline-reward-build-plan.test.ts src/tests/sim/reward-branching.test.ts src/tests/sim/redline-round-17-balance.test.ts src/tests/sim/redline-round-18-reward-pressure.test.ts
```

结果：

- 第18轮新增测试：3 tests passed。
- 奖励相关回归：6 files / 26 tests passed。

额外尝试：

```bash
npm test -- --run src/tests/sim
npm run build
```

当前全量 sim 有 1 个外部失败：`redline-progression-card-system.test.ts` 仍期望 Wild 牌只有 `wild_gap_key` / `wild_mana_stitch`，但当前并行工作树里的 `cards.ts` 已出现 `toll_shunt` Wild。  
当前 build 也有外部失败：`redline-round-18-balance.test.ts` 使用了 `node:fs`、`node:path`、`process` 和 `Array.prototype.at()`，但当前 tsconfig / types 环境没有对应声明。

这两个失败都不在本轮写集内，本轮未修改卡牌数据、tsconfig 或 round-18 balance 测试。
