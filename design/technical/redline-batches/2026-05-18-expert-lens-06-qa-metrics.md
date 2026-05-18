# 2026-05-18 Expert Lens 06: QA / Metrics / Acceptance

本轮身份：Game-001 的 QA/指标/验收专家组 worker。

本轮边界：只阅读指定合同、测试和已有 QA 产物；未打开网页，未启动 dev server，未运行浏览器，未改代码。

依据文件：

- `design/technical/redline-hyperturn-acceptance.md`
- `prototype-web/src/tests/sim/redline-hyperturn-acceptance.test.ts`
- `prototype-web/src/tests/sim/redline-90s-acceptance.test.ts`
- `prototype-web/src/tests/sim/runtime.test.ts`
- `outputs/browser-qa/redline-hyperturn/2026-05-18/README.md`
- `outputs/browser-qa/redline-hyperturn/2026-05-18/metrics-template.json`

## 16. Playtest QA Lead

### 当前判断

Hyper-Turn 的 sim 合同已经能描述一条可验收的 3-5 回合路径，但现有浏览器 smoke 还不能证明整条手工体验已经成立。桌面证据只跑到 2 回合，覆盖了起手可操作、正序 chain、payoff 和一次 End Turn 结果；强制断链、修补、奖励响应没有跑。移动端目前是视觉 smoke，未覆盖单次点击、End Turn 结算和 3-5 回合连续操作。

因此当前判断是：sim 层可作为下一轮手工验收脚本的骨架；浏览器/实机层还处于 partial，不应标成 3-5 回合完整通过。

### 10 个镜头观察

1. 开场镜头：`advance-time 0.016` 可以自动发牌进入 `PlayerTurn`，并产生 `HandDealt`，满足 3 秒内可操作的合同方向。
2. 起手路线镜头：验收测试要求手牌费用存在 `0 -> 1 -> 2` 或 `0 -> 1 -> payoff`，不是随机看到牌就算通过。
3. 正序收益镜头：`debt_hook -> redline_cut -> row_cleave` 会让 `row_cleave` 到 `effectMultiplier: 3`，且总伤害高于乱序 1.5 倍以上。
4. 乱序对照镜头：`row_cleave -> debt_hook -> redline_cut` 仍能出牌，但 `row_cleave` 只有 `effectMultiplier: 1`，这符合“断链降收益，不禁牌”的方向。
5. 敌人意图镜头：结束回合前可以计算当前前排伤害预览，End Turn 后 `EnemyAttacked` 总伤害与预览一致。
6. 断链可读镜头：runtime 测试已有 `ChainBroken` 和 `breakReason: expected MP 1, played MP 2`，但桌面 smoke 没有强制跑这个分支。
7. 修补镜头：sim 测试覆盖 `pulse_draw` 抽到缺口牌并继续进 `row_cleave`；runtime 另有 `wild_mana_stitch` 作为 draw/mana wild 修补，但浏览器 smoke 没抽到修补牌。
8. payoff 救场镜头：验收测试在第 4 回合手动构造 `debt_hook -> redline_cut -> clearance_order`，要求 5 个前排击杀且 End Turn 后 HP 不下降。
9. 移动端镜头：已有 390x844 截图证明初始 chain、意图、费用、End Turn 可读，但没有单指点击、连续出牌、End Turn 结算证据。
10. 清理镜头：已有 QA README 记录上次 smoke 关闭了浏览器 tab、dev server 和临时 Chrome 进程；本轮没有打开网页或服务，不产生新的清理项。

### 最大风险

最大风险是“sim 可通过”和“玩家 3-5 回合真的感觉到决策压力”之间仍有缺口。尤其是断链、修补、奖励响应都可能在单测里成立，但在 UI 上不够显眼、抽不到、点不到，或者玩家看不懂为什么 payoff 是救场。

### 下一轮最小改动

下一轮 QA 不需要扩大范围，先只做一条固定 seed 的 3-5 回合手工脚本：第 1 回合打正序 chain，第 2 回合故意断链，第 3 回合用 draw 或 wild 修补，第 3-5 回合触发一次 payoff 清前排或避免高意图伤害，并记录奖励/结算是否回应这条构筑。

### 验收方式

验收记录必须同时包含桌面和移动端两条路径。每条路径至少记录：回合数、起手费用序列、每张牌的费用和倍率、断链原因、修补来源、payoff 结果、End Turn 预览伤害、End Turn 实际 HP 变化、是否关闭页面和服务。桌面必须完整 3-5 回合；移动端至少要覆盖单 tap 出牌、End Turn、一次 chain 或断链。

## 17. Gameplay Telemetry Analyst

### 当前判断

现有 `metrics-template.json` 已经能证明 smoke 做过哪些事情，但还不足以证明体验有效。它记录了桌面 chain/payoff/End Turn 的观察，也明确留下了 `chainBreak`、`repair`、`rewardResponse` 和移动端交互的空洞。下一轮指标重点不应回到 30/60/90 秒击杀数，而应证明玩家行为、chain 状态、敌人意图和 payoff 后果之间存在因果关系。

### 10 个镜头观察

1. 废弃指标镜头：`oldRealtimeMetricsDeprecated` 明确把自动攻击、不操作掉血、60 秒 burst、定时击杀数全部标为非通过条件。
2. 覆盖缺口镜头：桌面 `turnsPlayed` 是 2，移动端 `turnsPlayed` 是 0，距离合同要求的 3-5 短回合还有差距。
3. chain 成功镜头：桌面 metrics 有 `MP0 -> MP1` 和 `Next MP2 -> x3` 证据，但还缺完整 `0 -> 1 -> 2/payoff` 的逐事件导出。
4. payoff 镜头：桌面记录了 `Row Cleave x3` 和 `Payoff x3: 前排群攻 15`，但没有结构化记录击杀数、意图减少量和 HP 避免量。
5. End Turn 镜头：桌面记录 HP 从 60 到 47，说明预览与结算可观察，但更好的指标应拆成 `intentBefore`、`intentAfterKills`、`resolvedDamage`。
6. 断链镜头：`chainBreak.observed` 仍是 `null`，下一轮必须有一条 `ChainBroken` 事件和对应 `breakReason`。
7. 修补镜头：`repair.observed` 仍是 `null`，下一轮必须区分 draw 修补、wild 修补、mana 修补或 reorder 修补，不能只写“修补成功”。
8. 奖励响应镜头：`rewardResponse` 仍是 `null`，这会让 5-8 分钟压缩验收里的“奖励/结算回应构筑”没有证据。
9. 移动交互镜头：移动端只有视觉通过，`singleTapIntegrity` 和 End Turn 结算都是 `not_run`，不能证明移动端输入不会误触或漏触。
10. 事件源镜头：sim/runtime 已有 `HandDealt`、`CardPlayed`、`ChainBroken`、`PayoffTriggered`、`EnemyIntentResolved`、`EnemyKilled` 等事件，足够构成体验指标表。

### 最大风险

最大风险是指标继续停留在“截图可读”和“单测通过”，没有量化出玩家决策是否真的改变结果。Hyper-Turn 的核心不是时间压力，而是玩家在回合内用顺序、断链、修补、payoff 改变敌人意图和 HP 损失；指标必须直接证明这条因果链。

### 下一轮最小改动

先不要新建复杂仪表盘，只扩展现有 metrics 模板的一次手工记录字段：每回合 `cardsPlayed`、`costSequence`、`multipliers`、`chainBreakReason`、`repairMethod`、`payoffEnhanced`、`frontRowKills`、`intentBeforeEndTurn`、`resolvedDamage`、`hpSavedEstimate`、`rewardResponseType`。

### 验收方式

下一轮通过标准应是一个 JSON 加一份 README 同时成立：JSON 里没有本应覆盖的 `null`，README 能用 3-5 行逐回合叙述解释“玩家做了什么 -> chain 怎么变 -> 敌人意图怎么变 -> payoff/End Turn 结果是什么”。任何只给截图、只给击杀数、只给 90 秒时间线的证据都不能算 Hyper-Turn 指标验收。

## 18. Regression/Test Architect

### 当前判断

防止回到 realtime 旧方向的测试合同已经有关键护栏：新合同声明旧 `redline-90s` deprecated；旧 90s 测试被 `describe.skip`；runtime 有专门测试保证 `advance-time` 只作为时钟/发牌输入，不产生 `EnemyAdvanced`、`EnemyPressure`、`AutoAttack`、`EnemyAttacked` 或 `ClearBurstRequested`。这组护栏方向正确，但还需要让 CI/验收报告明确“哪些测试必须跑、哪些旧文件只作历史证据”，否则旧 90s 文件仍可能被误读为待恢复目标。

### 10 个镜头观察

1. 合同入口镜头：`redline-hyperturn-acceptance.md` 写明这是当前唯一有效 Redline 验收合同。
2. 旧方向隔离镜头：`redline-90s-acceptance.test.ts` 使用 `describe.skip`，且名称标成 Deprecated realtime heartbeat。
3. 旧指标排除镜头：旧 90s 测试里的 `AutoAttack`、`EnemyAdvanced`、`EnemyPressure`、`ClearBurst` 只应作为历史失败方向证据，不应重新成为通过目标。
4. 时间输入护栏镜头：runtime 测试断言 PlayerTurn 里的 `advance-time` 不改变玩家 HP、敌人 HP、能量或 gameFlow。
5. realtime 事件护栏镜头：同一个 runtime 测试断言 `advance-time` 不产生 `EnemyAdvanced`、`EnemyPressure`、`AutoAttack`、`EnemyAttacked`、`ClearBurstRequested`。
6. 回合结算镜头：敌人攻击只在 `end-turn` 结算中发生，且有前排攻击权、补位敌人本回合不攻击、下回合才获得攻击权等测试。
7. chain 状态镜头：runtime 覆盖 cost jump 重置、跨回合重置、当前 chain state、next expected cost 和 break reason。
8. 修补护栏镜头：runtime 覆盖 `wild_mana_stitch` 保留缺口链、增加能量、抽牌，并继续到 `effectMultiplier: 3`。
9. payoff 护栏镜头：runtime 覆盖有序 payoff 触发 `PayoffTriggered enhanced: true`，无序 payoff 仍能出但 `enhanced: false`。
10. UI 回归缺口镜头：现有单测能防 runtime 回到 realtime，但不能防 HUD 把 realtime pressure、burst 或 debug trace 又做成主视觉。

### 最大风险

最大风险是回归护栏主要在 sim/runtime 层，UI 和 QA 文档层仍可能复用旧语言或旧指标。只要 README、HUD 或指标模板重新把“自动攻击、无操作掉血、60 秒 burst、定时击杀数”写成成功标准，测试通过也会把团队带回旧方向。

### 下一轮最小改动

把“Hyper-Turn 必跑测试”和“Realtime 旧测试只作 deprecated 证据”写进下一轮 QA README 顶部，并在验收命令旁加一句预期：`redline-hyperturn-acceptance.test.ts` 与 `runtime.test.ts` 必须跑；`redline-90s-acceptance.test.ts` 保持 skipped/deprecated，不作为通过条件。

### 验收方式

回归验收分两层：第一层跑 sim/runtime 测试，确认 Hyper-Turn 合同和 `advance-time` 非 realtime 护栏通过；第二层审查 QA 产物，确认指标没有使用旧 90s pass criteria。若浏览器验收被打开，收尾必须记录页面、dev server、临时浏览器进程全部关闭。

## 优先级建议

1. P0：下一轮只验一条固定 seed 的 3-5 回合完整桌面路径，把 chain 成功、断链、修补、payoff、End Turn、奖励响应一次录全。
2. P0：补移动端真实交互，不再只用视觉截图；至少证明单 tap 出牌、End Turn 和一次 chain/断链不出错。
3. P1：把 `metrics-template.json` 的 `chainBreak`、`repair`、`rewardResponse`、移动端交互空洞补成结构化事件证据。
4. P1：QA README 明确列出必跑 Hyper-Turn 测试和 deprecated 旧 90s 测试边界，避免指标口径回滚。
5. P2：所有后续浏览器验收都保留清理记录，尤其是页面关闭、dev server 停止和临时浏览器进程确认。
