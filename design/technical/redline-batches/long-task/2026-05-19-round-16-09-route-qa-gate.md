# 2026-05-19 Round 16-09：浏览器 route-flow QA 门禁维护

角色：第 16 轮-09《浏览器门禁维护专家》  
工作目录：`/Users/roc/Game-001`  
范围：只维护浏览器 QA 门禁；QA 不计入核心分，只作通过/阻断信号。

## 结论

本轮没有新增独立 `qa:route-flow` script，而是扩展了现有 `qa:similarity`。

原因：

- 当前浏览器 QA 已经负责相似度/机制切片、移动端视口、raw token、overflow、console、cleanup 等门禁。
- 奖励后路线按钮属于同一段“奖励 -> 路线 -> 下一战”的短 run 交互链路，直接并入 `qa:similarity` 可以避免新脚本只重复启动浏览器和 Vite。
- `package.json` 保持不变，仍使用 `npm run qa:similarity`。

## 实现内容

修改文件：

- `prototype-web/scripts/qa-similarity.mjs`

新增 `exerciseRewardRouteButtons(page)`，覆盖：

- 构造奖励态：`Reward` + route-bridge 奖励候选。
- 验证 route-bridge 奖励按钮可见、可点击。
- 点击 `Pulse Draw` 奖励后，验证：
  - `select-reward` intent 发出。
  - `RewardChosen` 事件记录。
  - 奖励 pending 清空。
  - 新卡加入 deck。
  - 进入 `RouteSelect` 后应出现路线按钮。
- 若路线按钮出现，继续点击并要求：
  - `select-route` intent 带正确 route id。
  - `RouteChosen` 事件记录。
  - run 节点推进到 2。
  - 流程进入下一战 `PlayerTurn`。

新增/扩展报告字段：

- `result.routeFlow`
- `assertions.routeRewardButtonVisible`
- `assertions.routeCandidateLabelVisible`
- `assertions.routeRewardButtonClickable`
- `assertions.routeRewardSelectionResolved`
- `assertions.routeChoiceButtonVisible`
- `assertions.routeChoiceButtonClickable`
- `assertions.routeSelectionResolved`
- `assertions.routeFlowContinuesRun`
- `gates.rewardRouteFlow`
- `gateScore.breakdown.rewardRouteFlow`

同时补强 `cleanup.browserClose`：

- 保留 graceful close 结果。
- 记录 browser pid。
- 若 `browser.close()` 超时，保留 forced kill 兜底字段。
- cleanup 现在固定包含 page/context/browser/server/residual 检查字段。

## 当前门禁结果

已执行：

```bash
node --check prototype-web/scripts/qa-similarity.mjs
QA_ROUND=round-16-09 npm run qa:similarity
```

结果：

- `node --check`：通过。
- `qa:similarity`：失败，属于新增 route-flow 门禁拦截。
- `cleanup.status`：`pass`。
- `gates.browserCleanup`：`pass`。
- `gates.rewardRouteFlow`：`fail`。

输出文件：

- `prototype-web/outputs/browser-qa/round-16-09/qa-similarity-result.json`

关键失败信号：

```json
{
  "routeRewardButtonVisible": true,
  "routeRewardButtonClickable": true,
  "routeRewardSelectionResolved": true,
  "routeChoiceButtonVisible": false,
  "routeChoiceButtonClickable": false,
  "routeSelectionResolved": false,
  "routeFlowContinuesRun": false,
  "fsmAfter": "RouteSelect"
}
```

## 发现的问题

门禁证明：奖励按钮本身可以点击，奖励也能进入 `RouteSelect`；但进入 `RouteSelect` 后，浏览器 HUD 没有渲染可点击的路线按钮。

当前证据指向两个实现风险，但本轮按权限不修改 `prototype-web/src`：

- `buildSnapshot(world)` 没有把 `world.route` 拷进 `GameSnapshot`，导致 HUD 的 `hudRouteChoicesState(snapshot)` 读不到 `pendingNodeChoices`。
- `Hud.intentForButton()` 里路线按钮 intent 使用了 `routeChoiceId`，而 runtime 的 `select-route` intent 类型要求 `routeId`。即使按钮渲染出来，后续也可能被 runtime 判为无效路线选择。

## 未修改范围

- 未修改 `prototype-web/src/**`。
- 未修改核心 runtime、HUD、snapshot、sim 测试。
- 未修改 `package.json`。
- 未新增 `qa:route-flow` 命令。

## 后续修复建议

下一轮实现修复时应优先：

1. 在 `buildSnapshot(world)` 中带出 `route`，并深拷 `pendingNodeChoices/history/nextBattleContext`。
2. 将 HUD 路线按钮 intent 字段从 `routeChoiceId` 对齐为 runtime 需要的 `routeId`。
3. 修复后重跑：

```bash
QA_ROUND=round-16-09 npm run qa:similarity
```

验收目标：

- `gates.rewardRouteFlow = pass`
- `cleanup.status = pass`
- `status = pass`
