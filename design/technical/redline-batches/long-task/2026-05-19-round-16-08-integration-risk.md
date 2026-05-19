# 2026-05-19 第16轮-08 route runtime/UI 集成风险审查

角色：第16轮-08《集成风险审查专家》  
工作目录：`/Users/roc/Game-001`  
审查范围：route runtime/UI 接入与 `reward`、`cardUpgrades`、run boundaries 的冲突  
源码处理：未改运行时代码。未回滚他人改动。本文为本轮新增审查报告。  
验证口径：可以运行只读测试 / `rg`；不做实现修复。

## 0. 总结裁决

当前不是“route 已经安全接进 runtime/UI”，而是“route 纯函数、reward runtime、HUD run layer 三套东西并列存在”。定向测试通过，但通过结果只能说明各模块自己的合同还在：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run src/tests/sim/redline-short-run-route.test.ts src/tests/sim/run-layer-boundary.test.ts src/tests/sim/card-upgrade-gems.test.ts src/tests/sim/reward-branching.test.ts
```

结果：4 个测试文件通过，18 个测试通过。

主要风险排序：

1. `run.currentNode` 现在仍由 `select-reward` 直接推进；`runRoute` 也有自己的 `selectShortRunRouteNode()` 推进逻辑。第16轮如果把 route 接进 runtime，极易出现双推进、跳节点、或绕过路线选择。
2. HUD 的“路线候选 / 下一战”并没有读取 route state，只是从 reward choices 推断。它会把奖励三选一误包装成路线选择，造成 UI 语义先行、runtime 不存在的错觉。
3. `cardUpgrades` 作为 reward choice 时使用合成 id，HUD `renderRewardChoice()` 只认 `cards[cardId]`，升级奖励会渲染为空；这会让 runtime 可选但 UI 不可见。
4. route 的 `rewardBranchHint` / `rewardPickBonus` 尚未进入 `buildRewardChoices()`；如果 UI 先展示“维修补给岔路会影响下一战奖励”，当前 runtime 其实不会兑现。

结论：第16轮应该先收敛 route state 的唯一入口，再接 UI。不要在现有 `select-reward -> advanceRunAfterReward -> dealIntoPlayerTurn` 路径上直接叠 route UI。

## 1. 当前证据

### 1.1 route 仍是纯函数切片，没有 runtime 状态

- `prototype-web/src/sim/runRoute.ts:33` 定义了 `ShortRunRouteState`，包含 `pendingNodeChoices`、`nextBattleContext`、`history`。
- `prototype-web/src/sim/runRoute.ts:139` 的 `completeCombatRouteNode()` 只返回克隆后的 `run/route`。
- `prototype-web/src/sim/runRoute.ts:180` 的 `selectShortRunRouteNode()` 只返回克隆后的 `run/route`，不会写入 `WorldState`。
- `prototype-web/src/sim/types.ts:275` 的 `WorldState` 仍只有 `run`、`reward`、`cardUpgrades`，没有 route 字段。
- `prototype-web/src/sim/snapshot.ts:30` 只输出 `run`，没有输出 route state。

这说明 route 还没有进入正式 runtime/snapshot 合同。

### 1.2 runtime 仍由 reward selection 推进 run 节点

- `prototype-web/src/sim/runtime.ts:790` 将击杀 XP 触发的奖励写为 `reward.source = 'level-up'`。
- `prototype-web/src/sim/runtime.ts:586` 的 `advanceRunAfterReward()` 直接推进 `world.run.currentNode += 1`。
- `prototype-web/src/sim/runtime.ts:1315` 在任何有效 `select-reward` 后记录 reward。
- `prototype-web/src/sim/runtime.ts:1316` 随即调用 `advanceRunAfterReward()`。
- `prototype-web/src/sim/runtime.ts:1339` 到 `1345` 在未完成 run 时加牌、补敌、推进 round、直接发下一手。

这条路径没有等待 route choice，也没有 route pending 状态。

### 1.3 HUD route 文案来自 reward 推断，不来自 route state

- `prototype-web/src/ui/hud.ts:101` 的 `hudRunLayerState()` 只读取 `snapshot.run`、`snapshot.reward`、`snapshot.debug`。
- `prototype-web/src/ui/hud.ts:149` 到 `154` 在 reward pending 时显示 `rewardRouteCandidateLabel(pendingChoices)`；没有 route 候选。
- `prototype-web/src/ui/hud.ts:155` 到 `162` 的“下一战 / 选1入组 / 牌组N · 仅本run”也是从 reward pending 和 deck count 推断。
- `prototype-web/src/tests/ui/hud-target-selection.test.ts:371` 的 UI 测试也是用 reward choices 断言“路线候选 Spark Tap”，不是用 route state。

这会把“奖励候选中有 route-bridge 卡”误表达为“路线候选已经接入”。

## 2. 阻断 / 高风险项

### R16-08-P0-01：`select-reward` 与 `selectShortRunRouteNode` 都能推进 `run.currentNode`，接线时会双推进

证据：

- reward 路径：`prototype-web/src/sim/runtime.ts:586`、`prototype-web/src/sim/runtime.ts:592`、`prototype-web/src/sim/runtime.ts:1316`。
- route 路径：`prototype-web/src/sim/runRoute.ts:191` 到 `194`。
- route 测试明确断言选择候选后 `currentNode` 从 1 变 2：`prototype-web/src/tests/sim/redline-short-run-route.test.ts:27` 到 `34`。

风险：

- 如果第16轮在 reward 之后调用 `completeCombatRouteNode()`，再在路线选择时调用 `selectShortRunRouteNode()`，节点可能从 1 经 reward 到 2，再经 route 到 3。
- 如果为了避免双推进而不调用 route select，则 `nextBattleContext` 永远不会被正式记录，route UI 只是文字。
- 当前胜利判断也在 reward 路径上执行；route 接入后最终节点可能在“选奖励”时结算，而不是在“完成路线节点”时结算。

红线：

- `run.currentNode` 必须只有一个权威推进入口。
- 推荐状态机顺序：`CombatComplete -> RewardPending -> RoutePending -> NextCombat`。只有 `RoutePending` 的有效选择推进节点；`level-up` reward 不直接推进节点。
- 如果 P0 暂时不做 route pending，则不要在 HUD 写“路线候选”，只能写“奖励中的路线牌”。

### R16-08-P0-02：HUD 目前没有真实 route choice，玩家会以为 reward choice 就是路线选择

证据：

- `hudRunLayerState()` 使用 `pendingChoices = snapshot.reward?.pending ? snapshot.reward.choices : []`：`prototype-web/src/ui/hud.ts:124`。
- `routeLabel` 在 pending reward 时直接由 `rewardRouteCandidateLabel(pendingChoices)` 生成：`prototype-web/src/ui/hud.ts:149` 到 `151`。
- Reward 面板标题仍写“选择一张新牌加入牌组”：`prototype-web/src/ui/hud.ts:1083`，但 small 又显示 `routeLabel` 和 `nextState`：`prototype-web/src/ui/hud.ts:1084`。

风险：

- 玩家看到的是“路线候选 Spark Tap”，实际点击的是“拿 Spark Tap 入当前 run deck”。
- route runtime 后续接入时会出现交互债：同一个 reward card button 到底是选牌、选路线、还是两者都做。
- QA 如果只看 UI 文案，会误判 route runtime 已闭环。

红线：

- reward panel 只负责 reward：加牌 / 升级。
- route panel 只负责 route：两个节点候选、route preview、nextBattleContext。
- 在 `WorldState` 没有 route 字段前，HUD 不应把 reward choices 标成 route choices。

### R16-08-P0-03：card upgrade reward 使用合成 id，HUD 会把升级选项渲染为空

证据：

- `buildCardUpgradeRewardChoiceIds()` 返回 `card-upgrade-choice:` 前缀的合成 `CardId`：`prototype-web/src/sim/cardUpgrades.ts:88`、`prototype-web/src/sim/cardUpgrades.ts:191` 到 `225`。
- runtime 会把这些合成 id 混进 `world.reward.choices`：`prototype-web/src/sim/runtime.ts:560` 到 `569`。
- `select-reward` 能识别并应用这些合成 id：`prototype-web/src/sim/runtime.ts:1299` 到 `1302`。
- HUD 的 `renderRewardChoice()` 直接 `const card = cards[cardId]`，找不到就返回空字符串：`prototype-web/src/ui/hud.ts:1205` 到 `1209`。

风险：

- 第 2 节点后，runtime 可能生成升级 reward；测试层可以直接选择合成 id，但真实 UI 里按钮为空。
- 用户会看到三选一少一项或布局留空，且无法通过正常点击选择 upgrade。
- 如果 route UI 再把 reward choices 用作 route 候选，会进一步隐藏“升级不是路线”的边界。

红线：

- Reward UI 必须先分流：普通 card reward 用 `cards[cardId]`，upgrade reward 用 `snapshot.cardUpgrades.choices` 解码渲染。
- 升级 reward 的文案必须写“本次冒险内”，不得写成永久强化。
- 不要把 upgrade choice 纳入 route candidate 推断。

### R16-08-P0-04：route nextBattleContext 没有被 reward/runtime 消费，UI 承诺无法兑现

证据：

- route context 包含 `modifierId`、`rewardBranchHint`、`rewardPickBonus`：`prototype-web/src/sim/runRoute.ts:6` 到 `13`。
- 两个候选分别承诺修补奖励偏向和临时信用额度：`prototype-web/src/sim/runRoute.ts:116` 到 `135`。
- reward 生成只调用 `buildRewardChoices(world.reward.candidateCardPool, cardRewardPickCount, cards)`：`prototype-web/src/sim/runtime.ts:560` 到 `562`。
- `buildRewardChoices()` 的第四个参数虽然支持 `responseProfile`，但 runtime 没有传 route context。

风险：

- `repair-cache` 的 `rewardPickBonus: 1` 不会提高 pick count。
- `rewardBranchHint: repair-resource` 不会改变下一次 reward 排序。
- `maxEnergyThisRunPlusOne` 如果未来直接写 `player.maxEnergy`，会再次撞上第15轮红线：本回合授权、当前 run Max MP、局外成长三者混淆。

红线：

- route context 必须有明确生效点：下一场 combat start、下一次 reward generation、或纯 preview。
- 在 modifier 未正式 runtime-applied 前，UI 只能写“预览”，不能写“下一战已获得”。

## 3. 中风险项

### R16-08-P1-01：`RewardState.source` 仍只有 `level-up`，无法表达 node-clear / route-clear

证据：

- `RewardState.source` 类型为 `'level-up' | null`：`prototype-web/src/sim/types.ts:217` 到 `224`。
- `recordRunReward()` 会把 source 写进 run history：`prototype-web/src/sim/runtime.ts:572` 到 `583`。

风险：

- 接 route 后至少需要区分 `level-up`、`node-clear`、`route-choice` 或 `combat-clear`。
- 现在所有 reward 都被记录成 level-up，导致 run history 无法说明“这次选择是升级、节点奖励还是路线后奖励”。

建议：

- 最小扩展：`RewardState.source = 'level-up' | 'node-clear' | 'route-clear' | null`。
- 只有节点 / route 清算来源允许推进 run 节点；纯 level-up 不推进。

### R16-08-P1-02：`cardUpgrades` helper 仍可绕过 reward 阶段直接应用

证据：

- `buildCardUpgradeChoices()` 只检查卡存在、可升级、在 deck 中：`prototype-web/src/sim/cardUpgrades.ts:113` 到 `118`。
- `applyCardUpgradeChoice()` 只检查 pending choice id，随后直接写 enhancement：`prototype-web/src/sim/cardUpgrades.ts:177` 到 `188`、`prototype-web/src/sim/cardUpgrades.ts:227` 以后。
- `card-upgrade-gems.test.ts` 仍直接调用 helper 验证升级效果：`prototype-web/src/tests/sim/card-upgrade-gems.test.ts:70` 到 `95`。

风险：

- 目前 reward 路径中的升级选择有 `Reward` 阶段门禁，但 helper 仍可被 UI 或其他 worker 在 `PlayerTurn` 里调用。
- route UI 如果把“下一战强化”做成按钮时直接调用 helper，会把 current-run growth 变成战斗内即时 buff。

建议：

- 正式 UI 只能发 intent，不能直接调 helper。
- helper 名称或注释应标记为 test/runtime-internal。
- 最终应由 command/event 流统一产出 `CardUpgradeApplied`。

### R16-08-P1-03：HUD 仍有过度兼容字段读取，未来 route/meta 字段可能被误读

证据：

- `hudAuthorizationState()` 会从 `player.tempAuthorizationMP`、`player.authorizationMP`、`player.authorization.tempAuthorizationMP`、顶层 `tempAuthorizationMP`、顶层 `authorization.tempAuthorizationMP` 多处读取：`prototype-web/src/ui/hud.ts:82` 到 `91`。

风险：

- 如果 route 或 meta 后续也出现 `authorization` 字段，HUD 可能把非单轮资源显示成“本回合临时授权”。

建议：

- 收窄为只读 `snapshot.player.tempAuthorizationMP`。
- route / meta 字段必须使用不同命名，例如 `routeModifierPreview`、`runDerivedStats`。

## 4. 当前安全点

- route 纯函数不 mutate 原始 run/route，测试已覆盖：`prototype-web/src/tests/sim/redline-short-run-route.test.ts:56` 到 `67`。
- 非 reward 状态下 `select-reward` 不会改 deck / maxEnergy，测试已覆盖：`prototype-web/src/tests/sim/run-layer-boundary.test.ts:144` 到 `157`。
- reward 加牌仍只进入当前 run，restart 会清空，测试已覆盖：`prototype-web/src/tests/sim/run-layer-boundary.test.ts:160` 到 `181`。
- card upgrade restart 后清空，定向测试通过。

这些安全点不代表 route 已集成，只代表已有边界测试还没有被破坏。

## 5. 建议收口顺序

1. 先把 route state 纳入 `WorldState` / `GameSnapshot`，例如 `world.route`，并新增 `GameFlowState = 'RouteChoice'` 或等价 pending 状态。
2. 拆 `select-reward` 的职责：reward selection 只处理加牌 / 升级 / 清 reward；不要直接推进 `run.currentNode`。
3. 新增 `select-route-node` intent，由它唯一推进 `run.currentNode` 并写入 `route.history`。
4. HUD 分两个面板：Reward 面板渲染 card/upgrade choices；Route 面板渲染 route node choices。
5. route modifier 接入前保持 preview-only；接入时明确生效点，不要中途修改当前 `PlayerTurn`。

## 6. 红线清单

- 不允许 reward selection 和 route selection 同时推进 `run.currentNode`。
- 不允许把 reward card choices 直接叫 route choices。
- 不允许 upgrade reward 使用 `cards[cardId]` 渲染；必须走 `cardUpgrades.choices`。
- 不允许 route preview 文案承诺 runtime 尚未应用的 `rewardPickBonus`、`rewardBranchHint` 或 `maxEnergyThisRunPlusOne`。
- 不允许 UI 直接调用 `buildCardUpgradeChoices()` / `applyCardUpgradeChoice()` 作为正式交互入口。

## 7. 本轮结论

第16轮 route runtime/UI 接入前，必须先决定“节点推进归谁管”。当前最小安全方案是：保留 reward 当前行为但移除 HUD 的 route 语义；或者正式接入 route state，并把 `run.currentNode` 推进从 `select-reward` 移到 `select-route-node`。两者不能混用。
