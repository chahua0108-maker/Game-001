# 2026-05-19 第16轮汇总：路线选择接入主流程

## 1. 本轮目标

第 16 轮只做一个核心切片：把第 15 轮的路线 sim 接入真实 runtime 和 HUD，让玩家在奖励后进入 `RouteSelect`，选择路线后再进入下一战。

官方核心体验分从 `72 / 100` 提升到 `80 / 100`。QA 只作门禁，不计分。

## 2. 已落地

- Runtime 主合同改为 `select-reward -> RouteSelect -> select-route -> PlayerTurn`。
- `WorldState` / `GameSnapshot` 带出 `route`，HUD 能读取 `pendingNodeChoices`。
- `RouteSelect` 状态渲染独立路线选择面板，路线按钮发出 `select-route` + `routeId`。
- 选择路线后写入 `RouteChosen`、推进 `run.currentNode`、记录 route history、带入 `nextBattleContext`。
- `maxEnergyThisRunPlusOne` 在下一战生效，并封顶到 4，避免重复路线滚雪球。
- 路线的 `rewardBranchHint` / `rewardPickBonus` 能进入下一次奖励生成。
- 旧回归测试全部迁移到新路线合同，保留原有牌组、手牌、轮次、重开边界断言。

## 3. 验收结果

- `npm run check`：`169 passed / 2 skipped`，build 通过；仅保留 Vite chunk size warning。
- `QA_ROUND=round-16-main npm run qa:lifecycle`：通过，`gateScore 20 / 20`。
- `QA_ROUND=round-16-main npm run qa:similarity`：通过，`gateScore 25 / 25`，`rewardRouteFlow=pass`。
- `QA_ROUND=round-16-main npm run qa:ui`：通过，`gateScore 20 / 20`。
- 三个浏览器 QA 都完成 page/context/browser/server 清理，`pidAlive=false`、`portListening=false`。

## 4. 关键修复

QA 初次拦截到真实问题：奖励后 runtime 已进入 `RouteSelect`，但 HUD 没有渲染路线按钮。主线程修复：

- `snapshot.ts` 深拷贝 `world.route`。
- `types.ts` 给 `GameSnapshot` 增加 `route`。
- `hud.ts` 把路线 intent 字段从 `routeChoiceId` 改成 runtime 消费的 `routeId`。
- `hud.ts` 在 `RouteSelect` 下显示独立路线面板。

## 5. 下一轮缺口

第 16 轮还不能停，距离 `95 / 100` 还差 `15` 分。

第 17 轮建议只做“构筑计划可理解性”：把路线、奖励回应、升级奖励合成玩家看得懂的 build plan，让玩家知道自己是在补桥、补终结、清污染、堆某张关键牌，且这个选择能在 3-5 节点 run 中被复测。
