# 2026-05-19 第17轮-09 集成风险审查：build plan 合流

角色：第17轮-09《集成风险审查专家》  
工作目录：`/Users/roc/Game-001`  
审查范围：第17轮 build plan 可能触碰的 `snapshot`、HUD、reward、route、card upgrade、旧测试与 QA 计分口径。  
源码处理：未改运行时代码。未回滚他人改动。本文为本轮新增审查报告。  
协作口径：其他 worker 会并行改不同范围；主线程合并时按本文 checklist 逐项收口。

## 0. 总结裁决

第17轮可以做 build plan，但不能把它做成第四套并行状态。当前主流程已经是：

```text
select-reward -> RouteSelect -> select-route -> PlayerTurn
```

第17轮的安全接法应该是“在现有 reward / route / cardUpgrades / snapshot 上增加玩家可读的解释层”，而不是新增独立推进逻辑。最危险的冲突不是文案，而是以下六类：

1. `GameSnapshot` 类型被多个 worker 同时扩展，HUD / QA / runtime 读到的 shape 不一致。
2. HUD 为兼容旧 snapshot 做防御读取，可能掩盖真实字段缺失，让 build plan 在假数据上通过。
3. reward 已吃 route context；如果 build plan 再单独按 route 偏置 reward，会形成双重偏置。
4. 升级奖励使用合成 `card-upgrade-choice:` id；build plan 若按普通 `CardId` 解读，会出现空卡、误加牌或错误历史。
5. 旧测试从 reward 直进下一战迁移到 route 后，容易用 helper 绕过真实 `RouteSelect` 流程。
6. QA `gateScore` 只能作门禁，不得被加进核心体验分或第17轮 80 -> 86 的分数证明。

结论：主线程应先定义 build plan 的唯一数据边界，再允许各 worker 合并 UI、reward、route 和测试改动。

## 1. 风险项

### R17-09-P0-01：snapshot 类型扩展冲突

当前基线：

- `WorldState` 已有 `route?: ShortRunRouteState`、`reward`、`cardUpgrades`。
- `GameSnapshot` 已导出 `route?: ShortRunRouteState`、`reward: RewardState`、`cardUpgrades: CardUpgradeState`。
- `buildSnapshot()` 会深拷贝 `route.pendingNodeChoices.nextBattleContext`、`cardUpgrades.choices`、`cardUpgrades.history`。

冲突方式：

- worker A 在 snapshot 上新增 `buildPlan`，worker B 在 HUD 内临时从 `reward/route/cardUpgrades` 推导 build plan，worker C 在 QA 脚本里 mock 旧 snapshot。最后会出现 runtime 没有 `buildPlan` 但 UI/QA 都显示通过。
- 若 `buildPlan` 直接引用 `world.route` 或 `world.cardUpgrades` 内部对象，snapshot 只读边界会被破坏。
- 若 `GameSnapshot.route` 从可选改成必选，旧 UI 单测里大量 `as unknown as GameSnapshot` mock 会在运行时缺字段。

红线：

- 第17轮如新增 `snapshot.buildPlan`，它必须是纯展示派生对象，不拥有推进权限。
- `buildPlan` 不得复制完整 `CardDefinition` 或完整 route state；只放稳定 id、label、reason、source、expiresAt。
- `GameSnapshot.route` 在过渡期继续可选；HUD 可以显示“暂无计划”，但不能构造假路线。

建议最小 shape：

```ts
interface BuildPlanSnapshot {
  currentProblemTags: string[];
  recommendedRewardChoiceIds: string[];
  routeReasonById: Record<string, string>;
  upgradeChoiceReasonById: Record<string, string>;
  source: 'snapshot-derived';
}
```

### R17-09-P0-02：HUD 防御读取会把缺字段伪装成成功

当前 HUD 已存在防御读取模式：

- `hudRunLayerState()` 对缺失 `snapshot.run` 使用 fallback node / round。
- `enemyIntentSummary()` 从 `snapshot.enemyIntentSummary` 读取总伤害。
- UI 测试里有“旧 snapshot 未接 run 时 fallback”的断言。

冲突方式：

- build plan 如果也采用 fallback，例如没有 `route` 时从 `reward.choices` 猜“补桥/补终结”，会重现第16轮之前的问题：玩家看到的是计划，runtime 没有计划状态。
- “HUD 防御读取”适合避免旧 mock 崩溃，不适合证明新功能成立。
- 如果 QA 只查 DOM 有“计划”字样，就会在缺真实 snapshot 字段时误判通过。

红线：

- build plan 的核心 UI 只允许从真实 `snapshot.route`、`snapshot.reward`、`snapshot.cardUpgrades` 或显式 `snapshot.buildPlan` 读取。
- fallback 文案只能是空态，例如“完成奖励后生成路线计划”；不能生成推荐、分支理由、升级理由。
- 测试必须至少有一个断言证明缺少真实字段时不显示推荐计划。

### R17-09-P0-03：reward 与 route 双重偏置

当前基线：

- `generateRewardChoices()` 已读取 `world.route?.nextBattleContext`。
- `rewardProgression` 会用 `routeContext.rewardBranchHint` 加 reward roles。
- `rewardResponsePickCount()` 支持 `rewardPickBonus`。

冲突方式：

- build plan worker 可能为了“让玩家感到路线影响奖励”，再次按 route branch 对 `reward.choices` 排序或过滤。
- route worker 可能在 `select-route` 时写入 `nextBattleContext`，reward worker 又在 reward generation 时额外追加 `problems`，两边叠加后某一类卡会被过度固定。
- UI worker 如果把“推荐奖励”排序应用到实际选择数组，会把展示解释变成第二套生成器。

红线：

- reward 实际候选只允许由一个入口生成：`generateRewardChoices()` / `buildRewardChoices()` 这条 runtime 路径。
- build plan 可以解释“为什么这些 reward 出现”，但不能在 HUD 层重排、过滤或替换 `snapshot.reward.choices`。
- route bias 与 problem bias 如要合并，必须在 `RewardResponseProfile` 一处合并，并用测试断言 pick count 和角色权重只应用一次。

主线程合并时要特别查：

```bash
rg -n "rewardBranchHint|rewardPickBonus|buildRewardChoices|reward\\.choices|sort\\(|filter\\(" prototype-web/src
```

### R17-09-P0-04：升级选择 id 不能当普通 CardId

当前基线：

- 升级奖励进入 `reward.choices` 时会编码成 `card-upgrade-choice:${choiceId}`。
- runtime `select-reward` 会先判断 `isCardUpgradeRewardChoiceId()`，再 `decodeCardUpgradeRewardChoiceId()`，最后调用 `applyCardUpgradeChoice()`。
- 普通奖励才会 `AddCardToDeck`；升级奖励不会加进 deck。

冲突方式：

- build plan 如果对所有 `reward.choices` 都执行 `cards[choiceId]`，升级项会空渲染。
- 如果 build plan 把升级 id 写进“推荐加牌”，玩家会以为选了新卡，但 runtime 实际是强化现有卡。
- 如果测试直接用 decoded `choice.id` 发 `select-reward`，会绕过正式合成 id 合同。

红线：

- build plan 的 reward choice 必须分三类：普通 card、upgrade reward、unknown/invalid。
- UI 显示升级项时必须从 `snapshot.cardUpgrades.choices` 用 decoded id 查 label / description / damageBonusPreview。
- `select-reward` intent 对升级奖励只能发送 encoded id，不能发送 decoded upgrade choice id。
- build plan history 记录选择时，应保留原始 `selectedCardId`，并额外展示 decoded upgrade label；不要把合成 id 写成卡牌名。

### R17-09-P1-01：旧测试迁移可能绕过 route 合同

当前基线：

- 旧流程中，选择 reward 后可能直接进入下一战。
- 第16轮后，选择 reward 应进入 `RouteSelect`；只有 `select-route` 后才补敌、推进 round、发下一手。

冲突方式：

- 旧 sim 测试为了快速进入下一手，手动调用 helper 或直接改 `world.fsm.gameFlow = 'PlayerTurn'`。
- UI 测试 mock 一个已经有 reward choices 的 snapshot，但没有 route pending，仍断言 build plan 成立。
- QA scenario 为了稳定性硬编码 route id，但没有断言 route history / nextBattleContext / reward history 一致。

红线：

- 迁移旧测试时，不能只改期望值；要走真实 intent：`select-reward` 后断言 `RouteSelect`，再 `select-route`。
- helper 可以用于纯函数单测，但集成测试不得跳过 runtime intent。
- build plan 测试必须覆盖一次完整闭环：奖励选择、路线选择、下一战 reward 被 route context 影响、升级选择能被解释。

### R17-09-P1-02：QA 不计分口径可能被稀释

当前基线：

- 第16轮汇总明确：QA 只作门禁，不计分。
- QA 报告字段已统一为 `gateScore`。
- 核心体验分是玩家体验 scorecard，不是自动化通过率。

冲突方式：

- 第17轮把 `qa:ui gateScore 20/20` 写成 “+2 分”。
- 主线程 synthesis 同时引用 “build plan 可理解性 + QA 全通过”，最后让 QA 看起来参与体验得分。
- 旧脚本或报告重新引入 `score` 字段，和 `gateScore` 混用。

红线：

- 第17轮分数只允许来自 build plan 是否让玩家读懂“补什么、为什么、下一战怎么验证”。
- `gateScore` 只能证明“不退化、可验收、可清理”，不能证明核心体验加分。
- 文档中出现 `score` 时必须区分 `coreScore` 与 `gateScore`。

主线程合并时要特别查：

```bash
rg -n "\\bscore\\b|gateScore|coreScore|QA 不计分|不计分" prototype-web scripts design/technical/redline-batches/long-task
```

## 2. 建议集成顺序

1. 先锁定 build plan 数据源：优先 snapshot 派生；如新增 `snapshot.buildPlan`，只做展示层，不推进 runtime。
2. 再接 HUD：Reward 面板显示普通卡 / 升级项；Route 面板显示路线理由；Build plan 只解释两者关系。
3. 再接 reward bias：确认 route context 只在 reward generation 入口应用一次。
4. 再迁移测试：旧测试必须经过 `RouteSelect`；升级 reward 必须使用 encoded id。
5. 最后跑 QA：QA 全通过后只写 gate，不把 gateScore 加进核心体验分。

## 3. 主线程集成 checklist

合并前逐项勾选：

- [ ] 没有 worker 新增第二套 reward 生成器；`reward.choices` 仍只由 runtime reward generation 写入。
- [ ] 没有 HUD 代码对 `snapshot.reward.choices` 做会改变真实选择顺序的 `sort/filter`。
- [ ] `GameSnapshot` 新字段若存在，已在 `buildSnapshot()` 深拷贝，旧 mock 缺字段时只显示空态。
- [ ] `snapshot.route` 缺失时，HUD 不展示路线推荐或 build plan 推荐。
- [ ] build plan 对 `card-upgrade-choice:` id 有专门分支，普通卡和升级项不会共用 `cards[id]`。
- [ ] 升级 reward 发出的 `select-reward` 使用 encoded id；decoded id 只用于查 `cardUpgrades.choices` 展示。
- [ ] `select-reward` 后仍进入 `RouteSelect`；`select-route` 是进入下一战的唯一入口。
- [ ] route 的 `rewardBranchHint` / `rewardPickBonus` 只应用一次；没有 UI 层二次偏置。
- [ ] 旧测试没有直接手改 `world.fsm.gameFlow`、`world.run.currentNode`、`world.route.nextBattleContext` 来绕过合同。
- [ ] 新增或迁移测试覆盖：普通奖励、升级奖励、路线选择、下一战 reward 受 route context 影响。
- [ ] QA 报告只使用 `gateScore`；第17轮 synthesis 不把 QA 分计入核心体验分。
- [ ] 文档中的第17轮加分理由只来自玩家可理解 build plan，不来自测试数量或脚本通过率。

## 4. 最小验收建议

主线程最终至少跑：

```bash
cd /Users/roc/Game-001/prototype-web
npm run check
QA_ROUND=round-17-main npm run qa:lifecycle
QA_ROUND=round-17-main npm run qa:similarity
QA_ROUND=round-17-main npm run qa:ui
```

验收解释：

- `npm run check` 证明类型、单测和 build 没有被并行改动打碎。
- 三个 QA 命令证明生命周期、相似度、UI 可读性没有退化。
- 这些结果只作为 gate；核心体验分仍由第17轮 build plan 的玩家可理解性单独评估。

## 5. 本轮结论

第17轮的正确目标是把“奖励、路线、升级”解释成一个玩家能复述的计划，不是把三者再做成新的 runtime 系统。主线程合并时优先守住三条线：

1. runtime 权威：reward 生成、route 推进、upgrade 应用各有唯一入口。
2. snapshot 权威：HUD 只解释真实 snapshot，不用 fallback 生成假计划。
3. 评分权威：QA 只作门禁，build plan 加分只来自玩家体验。
