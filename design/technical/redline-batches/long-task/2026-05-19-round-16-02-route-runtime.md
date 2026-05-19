# Round 16-02 Route Runtime

## Scope

- Agent: 第16轮-02《runtime路线意图工程师》
- Workdir: `/Users/roc/Game-001`
- Code scope:
  - `prototype-web/src/sim/types.ts`
  - `prototype-web/src/sim/runtime.ts`
  - `prototype-web/src/sim/runRoute.ts`
  - `prototype-web/src/tests/sim/redline-route-runtime-flow.test.ts`

## Runtime Change

本轮把短局路线从纯 helper 接入 runtime intent flow：

1. `select-reward` 不再直接推进 `run.currentNode` 并发下一战。
2. 奖励选择成功后，runtime 记录 reward history、清空 reward pending、把卡牌奖励加入当前 run deck，然后生成 `world.route.pendingNodeChoices`。
3. flow state 进入 `RouteSelect`，等待玩家路线选择。
4. 新增 `select-route` intent。玩家选择 pending route 后：
   - 调用 `selectShortRunRouteNode` 推进 `run.currentNode`。
   - 写入 `world.route.nextBattleContext` 和 route history。
   - 应用下一战上下文中的 runtime carryover。目前 `maxEnergyThisRunPlusOne` 会在下一战发牌前提升 `player.maxEnergy`。
   - compact/fill 敌人、推进 round、进入下一战 `PlayerTurn` 并发牌。
5. final node reward 仍直接进入 `Settlement`，不会生成路线选择。

## Test Coverage

新增测试：`prototype-web/src/tests/sim/redline-route-runtime-flow.test.ts`

覆盖的合同：

- reward pending 下触发 `select-reward` 后：
  - `run.currentNode` 保持在当前节点。
  - `fsm.gameFlow` 进入 `RouteSelect`。
  - `reward.pending` 清空。
  - 当前 run deck 收到奖励卡。
  - `world.route.pendingNodeChoices` 生成。
- 触发 `select-route` 后：
  - `run.currentNode` 推进到下一节点。
  - `world.route.nextBattleContext` 等于所选 route 的 context。
  - 选择 `maxEnergyThisRunPlusOne` route 时，下一战发牌前 `player.maxEnergy/player.energy` 提升到 4。
  - route history 记录 from/to/selectedRouteId/context。
  - 进入 `PlayerTurn`。
  - round 推进并发下一战手牌。

## Verification

通过：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run src/tests/sim/redline-route-runtime-flow.test.ts
npm test -- --run src/tests/sim/redline-route-runtime-flow.test.ts src/tests/sim/redline-short-run-route.test.ts
npm test -- --run src/tests/sim/redline-route-runtime-flow.test.ts src/tests/sim/redline-short-run-route.test.ts src/tests/sim/redline-round-16-balance.test.ts
npm run build
```

已知相邻旧断言冲突：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run src/tests/sim/redline-short-run-route.test.ts src/tests/sim/run-progression.test.ts
```

结果：`redline-short-run-route.test.ts` 通过；`run-progression.test.ts` 有 2 个失败。失败原因是旧测试仍期待 `select-reward` 立刻把 `currentNode` 从 1 推进到 2，而本轮合同改为 `select-reward -> RouteSelect`，`select-route` 才推进节点。

## Notes

- 本轮没有回滚其他 agent 的并行改动。
- `world.route` 采用 runtime lazy init，避免修改 `world.ts` 初始化写集；首次 reward/route intent 会创建 route state。
- `runRoute.ts` 的既有 route helper 合同保持不变，并由既有测试继续覆盖。
