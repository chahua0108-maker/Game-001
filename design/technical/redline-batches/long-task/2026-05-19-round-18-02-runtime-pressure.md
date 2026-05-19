# Round 18-02 Runtime Pressure Slice

## 目标

本轮只落一个最小 Runtime 切片：连续选择奖励和路线后，`WorldState.run.pressure` 能记录每个节点的承压结果，并让高压路线真实影响下一节点的 HP、污染牌和 build plan。

## 已实现

- 在 `RunState` 增加可选的 `pressure` 局内状态，不进入局外成长，也不写入 profile/meta。
- `select-reward` 仍然是节点结算入口：在奖励选择合法后记录当前节点的压力快照，然后继续原有 `planRouteAfterReward -> RouteSelect` 合同。
- `select-route` 仍然是进入下一节点入口：先保留原有 route history 和 `applyNextBattleContext`，再根据路线写入 `pendingRoutePressure`。
- `elite-pressure` 现在会在进入下一节点时造成 6 HP 压力，并尝试加入 1 张 `static_overload` 污染牌；已有污染牌时不会重复堆无限污染牌。
- `repair-cache` 作为低风险路线记录到 pressure，但不额外扣 HP。
- Max MP 仍使用 `Math.max(maxEnergy, 4)`，重复高压路线不会把上限无限叠加。

## 核心体验价值

之前 reward/route 更像离散菜单：玩家选择高压路线主要得到 `+1 Max MP`，风险在状态里不够可见。现在连续 3 个节点后可以从 runtime 直接读到：

- 上一节点是否吃过路线压力。
- 该压力造成了多少 HP 损耗。
- 是否带入了污染状态牌。
- build plan 是否因此转向 `clear-pollution`。
- 玩家上一节点选的是低风险还是高风险路线。

这让“连续 3-5 节点 run 的路线风险”从文案变成可测状态，后续 UI、评分和 QA 可以直接消费 `run.pressure.records`。

## 风险

- `elite-pressure` 的 6 HP 是最小可测数值，不代表最终平衡；它只是让风险真实进入 Runtime。
- 当前污染去重只避免 `static_overload` 在活动牌区重复堆叠；如果未来有多种污染牌，需要升级为污染预算或污染强度模型。
- build plan 的污染识别仍沿用现有 `createBuildPlan`，本轮没有改 buildPlan 规则，避免扩大写集。
- 路线文案还没有同步表现“高压路线会扣 HP/污染”，需要 UI/文案专家后续接上。

## 验证

- `npm test -- --run src/tests/sim/redline-round-18-pressure-runtime.test.ts`
- `npm test -- --run src/tests/sim/redline-route-runtime-flow.test.ts src/tests/sim/redline-round-17-balance.test.ts src/tests/sim/redline-short-run-completion.test.ts src/tests/sim/redline-pressure-balance.test.ts`
