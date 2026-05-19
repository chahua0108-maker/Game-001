# 第15轮-02 短 run 路线 / 节点系统工程报告

日期：2026-05-19  
角色：短 run 路线 / 节点系统工程师  
工作目录：`/Users/roc/Game-001`

## 目标

本轮只做纯 sim 路线切片，不接 HUD，不重写旧 runtime 奖励推进路径：

- 战斗节点完成后生成 2 个下一节点候选。
- 玩家选择一个候选后推进 `run.currentNode`。
- 被选路线为下一战挂一个小型 modifier / 奖励上下文。
- 不把 QA 当核心体验分，只为第 15 轮短 run 闭环补“路线选择”能力。

## 实现

新增 `prototype-web/src/sim/runRoute.ts`：

- `completeCombatRouteNode(run, route?)`
  - 当前 run 仍在进行且未到终点时，生成 2 个候选：
    - `repair-cache`：维修补给岔路，下一战上下文带 `rewardRerollPlusOne`、`repair-resource`、`rewardPickBonus: 1`。
    - `elite-pressure`：高压债务岔路，下一战上下文带 `maxEnergyThisRunPlusOne`、`payoff`。
  - 如果当前节点已经是 `maxNodes`，不再生成候选，直接返回 `victory`。

- `selectShortRunRouteNode(run, route, candidateId)`
  - 校验候选 id。
  - 返回推进后的 `RunState`，将 `currentNode` 从当前节点推进到候选 `toNode`。
  - 清空 pending 候选，并把所选路线的 `nextBattleContext` 挂到 route state。
  - 记录 route history，便于后续接 runtime / HUD 时回放选择来源。

实现保持纯函数风格，返回克隆后的 `RunState` / `ShortRunRouteState`，避免在多 agent 并行工作时意外污染旧 world/run 快照。

## 红线测试

新增 `prototype-web/src/tests/sim/redline-short-run-route.test.ts`，覆盖：

1. 战斗完成后稳定生成 2 个下一节点候选。
2. 选择候选后推进 `run.currentNode`，并携带下一战上下文。
3. 规划与选择不 mutate 原始 run / route。
4. 最终节点完成后进入 `victory`，不再生成路线。
5. 过期 / 错误候选 id 会抛错，且不推进 run。

## 改动文件

- `prototype-web/src/sim/runRoute.ts`
- `prototype-web/src/tests/sim/redline-short-run-route.test.ts`
- `design/technical/redline-batches/long-task/2026-05-19-round-15-02-run-route.md`

## 验证命令

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run src/tests/sim/redline-short-run-route.test.ts
npm test -- --run src/tests/sim/run-progression.test.ts src/tests/sim/run-modifiers.test.ts src/tests/sim/run-layer-boundary.test.ts src/tests/sim/redline-short-run-route.test.ts
npm run build
```

## 验证结果

- `npm test -- --run src/tests/sim/redline-short-run-route.test.ts`
  - 通过：`5 passed`
- `npm test -- --run src/tests/sim/run-progression.test.ts src/tests/sim/run-modifiers.test.ts src/tests/sim/run-layer-boundary.test.ts src/tests/sim/redline-short-run-route.test.ts`
  - 通过：`18 passed`
- `npm run build`
  - 未通过，失败点在既有文件：
    - `src/tests/sim/card-upgrade-gems.test.ts` 引用了 `../../sim/cardUpgrades` 中当前不存在的 `decodeCardUpgradeRewardChoiceId`
    - `src/tests/sim/card-upgrade-gems.test.ts` 引用了 `../../sim/cardUpgrades` 中当前不存在的 `isCardUpgradeRewardChoiceId`
  - 该失败不来自本轮新增的 `runRoute.ts` / `redline-short-run-route.test.ts`。

## 后续接线建议

下一轮如果要把它接成玩家可见闭环，建议顺序是：

1. 战斗结算不再直接只走奖励选择，而是在奖励后进入路线选择 pending。
2. HUD 展示两个路线候选，选择后再进入下一场战斗。
3. `nextBattleContext` 接入下一战 reward candidate bias / 小 modifier 预览，避免变成纯 UI 文字。
