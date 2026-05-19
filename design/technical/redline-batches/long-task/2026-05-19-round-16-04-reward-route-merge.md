# Round 16-04 Reward Route Merge

## 目标

把短 run 路线选择产生的 `nextBattleContext` 合并进下一次奖励响应：

- `repair-cache` / `repair-resource`：下一次奖励优先给修复、抽牌、资源型答案，并吃 `rewardPickBonus`。
- `elite-pressure` / `payoff`：下一次奖励优先给终结 payoff，其次给授权/+MP 路线资源。

## 实现范围

- `prototype-web/src/sim/rewardProgression.ts`
  - 新增 `RewardRouteContext`，用结构性类型接收路线模块的 `ShortRunNextBattleContext` 子集，避免 reward 层直接依赖 runRoute。
  - `RewardResponseProfile` 增加可选 `routeContext`。
  - `rewardResponseRolesForProblems` 现在会把 `routeContext.rewardBranchHint` 翻译成奖励响应角色：
    - `repair-resource` -> `draw-resource`, `wild-bridge`
    - `payoff` -> `payoff`, `authorization`
    - `route-bridge` -> `low-cost-bridge`, `wild-bridge`
  - 新增 `rewardResponsePickCount(basePickCount, profile)`，把 `rewardPickBonus` 合并到本次奖励可见宽度。

- `prototype-web/src/sim/rewardChoices.ts`
  - `buildRewardChoices` 使用 `rewardResponsePickCount` 得出有效 pick 数。
  - 既有 problem response 仍然优先进入 role slot，之后按原有 branch priority 填充。

- `prototype-web/src/tests/sim/redline-reward-route-response.test.ts`
  - 覆盖 `repair-cache`：`blood_tithe`、`wild_gap_key` 前置，且 `3 + rewardPickBonus(1)` 变成 4 个选择。
  - 覆盖 `elite-pressure`：`severance_burst` payoff 前置，`clearance_order` 作为授权/+MP 路线资源紧随其后。

## 验证

已执行：

```bash
npm test -- --run src/tests/sim/redline-reward-route-response.test.ts src/tests/sim/redline-reward-response.test.ts src/tests/sim/reward-branching.test.ts
```

结果：3 个测试文件、14 个测试全部通过。

## 后续接线提示

本轮完成的是 reward 侧的合流入口。后续 runtime/路线 agent 只需要在生成下一次奖励时，把已选择路线保存的 `nextBattleContext` 作为 `RewardResponseProfile.routeContext` 传入 `buildRewardChoices`，即可让路线选择真正影响下一次奖励候选。
