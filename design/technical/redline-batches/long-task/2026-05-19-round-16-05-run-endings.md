# 2026-05-19 Round 16-05 短 run 胜败边界工程记录

负责人：第16轮-05《短run胜败边界工程师》

## 范围

- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/sim/runRoute.ts`
- `prototype-web/src/tests/sim/redline-short-run-completion.test.ts`

本轮只锁定 3 节点短 run 的结束边界，不重排奖励池、不改 UI、不回滚其它 agent 的并行改动。

## 已落地行为

1. 最终节点奖励选择后，当前 run 进入 `status: 'victory'`，FSM 进入 `Settlement`。
2. 敌人攻击或伤害命令把玩家 HP 打到 0 时，当前 run 进入 `status: 'failure'`，FSM 进入 `Settlement`，不会继续补怪、推进回合或发下一手。
3. `restart-run` 返回新的初始 world，并递增 `runNumber`；当前 run 内的路线进度、奖励历史、奖励候选、升级状态和奖励加入的 deck 卡不会带入新 run。
4. `runRoute.ts` 增加 `resetShortRunRouteForRestart()`，用于外部持有的短 run 路线状态在 restart 时显式清空：
   - `pendingNodeChoices: []`
   - `nextBattleContext: null`
   - `history: []`

## 测试覆盖

新增 `redline-short-run-completion.test.ts` 三个用例：

- `moves the final node reward selection into Settlement/victory`
- `moves HP zero into Settlement/failure before refill or next deal`
- `restart-run clears current-run route, upgrades, rewards, and reward-added deck cards`

## 验证命令

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- src/tests/sim/redline-short-run-completion.test.ts
npm test -- src/tests/sim/redline-short-run-route.test.ts src/tests/sim/run-layer-boundary.test.ts src/tests/sim/card-upgrade-gems.test.ts
```

结果：

- `redline-short-run-completion.test.ts`：3 tests passed
- 相邻回归：3 files / 13 tests passed

## 注意

`runtime.ts` 在本轮开始前已经包含大量未提交并行改动；本轮只在 restart 路径上抽出 `restartRunWorld()`，并通过新增测试确认它重建初始 world。未处理全量 git diff 中其它 agent 的修改。
