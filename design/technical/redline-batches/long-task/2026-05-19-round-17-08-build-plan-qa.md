# Round 17-08 Build Plan QA Gate

负责人：浏览器 QA 门禁工程师

范围：

- 只改 `prototype-web/scripts/qa-similarity.mjs`。
- 不改 `prototype-web/src` 运行时代码。
- 保留既有 cleanup、三视口、reward -> route -> next battle、overflow、raw token、console error 检查。

## Gate 目标

第 17 轮的核心风险不是路线 runtime 是否能推进，而是玩家是否能在关键节点看懂自己的构筑计划。`qa:similarity` 需要在既有 reward/route flow 上新增一个可见性门禁：

1. 奖励选择前：至少看到一个 build plan token，例如 `奖励候选`、`路线候选`、`Pulse Draw`、`选1入组`。
2. 奖励选择后 / 路线选择中：至少看到一个 route build plan token，例如 `选择下一战路线`、`路线候选`、`MP+1`、`修补牌`、`偏修补`、`偏终结`、`偏路线`。
3. 路线选择后 / 下一战：至少看到一个 carryover build plan token，例如 `已拿 Pulse Draw`、`路线记录 1`、`带入 Pulse Draw`、`牌组`。
4. 以上三阶段在 `1366x768`、`390x844`、`360x640` 都不能有 build plan 文本或 surface 横向溢出。

## 实现点

`exerciseRewardRouteButtons(page)` 继续作为单一浏览器流：

- 初始渲染 `Reward` 状态，记录 `reward-pre` 文本与 build plan layout。
- 点击 `pulse_draw` reward，进入 `RouteSelect`，记录 `route-post` 文本与 route choice layout。
- 点击首个 route choice，进入下一战 `PlayerTurn`，记录 `next-battle` 文本与 carryover layout。

新增 JSON 字段：

- `routeFlow.buildPlan.rewardPre`
- `routeFlow.buildPlan.routePost`
- `routeFlow.buildPlan.nextBattle`
- `routeFlow.buildPlanLayoutFailures`
- `assertions.buildPlanRewardPreTokenVisible`
- `assertions.buildPlanRoutePostTokenVisible`
- `assertions.buildPlanNextBattleTokenVisible`
- `assertions.buildPlanNoOverflow`
- `gates.buildPlanVisibility`

## Pass / Fail

Pass 条件：

- 三个 build plan 阶段都至少命中一个 token。
- `buildPlanLayoutFailures.length === 0`。
- 既有 `rewardRouteFlow`、`noHorizontalOverflow`、`noTextOverflow`、`browserCleanup` 等 gate 不回退。

Fail 条件：

- 任一阶段没有命中 token。
- `.run-layer-panel`、`.reward-panel`、`.route-choice` 或相关文本在任一视口横向超出 viewport。
- cleanup 失败，即使功能断言通过也不能记为 pass。

## 验证命令

```bash
cd /Users/roc/Game-001/prototype-web
node --check scripts/qa-similarity.mjs
QA_ROUND=round-17-08-build-plan npm run qa:similarity
```

输出文件：

```text
/Users/roc/Game-001/prototype-web/outputs/browser-qa/round-17-08-build-plan/qa-similarity-result.json
```
