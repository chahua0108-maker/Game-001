# Redline Hyper-Turn 30 专家视角汇总建议

日期：2026-05-18
基线提交：`331a53a Add Redline expert lens review set`
范围：汇总 `2026-05-18-expert-lens-01` 到 `10` 的 30 个专家视角。

## 一句话结论

下一轮不要继续扩卡、扩敌人、扩系统。最应该做的是一条固定 3-5 回合样片，把“费用链成立 -> 敌意图下降 -> 坏手牌被修补 -> armed payoff 清场 -> 奖励回应构筑”做成可读、可测、可录屏的闭环。

这不是继续追求大系统完整度，而是把 demo 的核心卖点钉死：

> 我用回合内卡牌链路清算敌人的意图伤害。

## 跨组共识

### 1. 当前链路能跑，但还像排序题

现有 `0 -> 1 -> 2` 已经成立，第一回合教学是可用的。但 30 个视角里反复出现同一个风险：玩家可能只是在按费用排序，而不是做真正的卡牌决策。

下一步必须让同一费用段出现选择：

- 1 费：伤害桥接 vs 抽牌延长；
- 2 费：前排压制 vs mini-payoff；
- Wild：现在修补 vs 留给更大缺口；
- payoff：未 armed 可打但弱，armed 后才是清场爆点。

### 2. 3 费 payoff 和 3 MP 经济冲突，必须先裁决

当前 `maxEnergy = 3` 天然只能支持 `0 + 1 + 2`。如果要自然打出 `0 + 1 + 2 + 3`，必须给一个可见的资源规则。

建议只选一种方案，不要让不同 worker 各自假设：

- 推荐：可见 mana gain / refund，让玩家理解“我延长了这一回合”；
- 备选：chain rebate；
- 不推荐：测试脚本暗中把 MP 改到 6，因为玩家体验无法解释。

### 3. 敌人意图必须有唯一真相源

敌意图组、HUD 组、QA 组和架构组都指向同一个问题：HUD 不应该根据“当前前排”自己重算伤害，而应统一消费 `snapshot.enemyIntents` / `snapshot.enemyIntentSummary`。

必须明确区分三类敌人：

- 本回合攻击者：结束回合会造成伤害；
- 当前可打前排：玩家现在可以打；
- 补位/下轮敌人：已经顶上来，但本回合不攻击。

否则玩家会看到“我清了前排，但伤害好像没变”，payoff 救场会失去可信度。

### 4. payoff 需要 armed / unarmed 两档

数值组和战斗组都认为 3 费全场牌当前未 armed 时过强。`severance_burst` 这类牌如果 x1 就能清掉大量敌人，费用链就会变成装饰。

下一轮应定义：

- unarmed payoff：可以出，但只做低收益、有限目标或压血；
- armed payoff：满足 chain length / multiplier / last cost 条件后，才触发清场、救场和强反馈；
- 结算事件需要带出 `killCount`、`affectedEnemyIds`、`preventedIntentDamage` 或等价字段。

### 5. HUD 下一步不是加面板，而是给推荐动作

HUD 已经有 chain、intent、payoff、End Turn、目标、手牌，但信息面板太多。下一轮最小改动是加一条“推荐下一步”：

- `先打 MP0：Debt Hook`
- `接 MP1：Redline Cut，可到 x2`
- `现在打 Row Cleave：前排群攻 15`
- `无可打牌，结束会受 17`

同时清理文案歧义：

- `MP0?` -> `从 MP0 开始` 或 `未起链`
- `将受 17 伤害` -> `结束会受 17`
- `非起手 x1` -> `可打，断链 x1`
- 玩家首屏不应看到 `FSM` 这类开发词作为主信息。

### 6. 移动端还没有通过，只是视觉可读

390x844 截图证明当前首屏可读，但还没有证明真实 tap 流程成立。下一轮移动端必须验：

- 单 tap 只触发一次；
- 连续出牌不会因手牌重排点错；
- End Turn 可达且后果可见；
- 目标选择按钮足够大；
- 至少完成一次 chain 或断链。

### 7. 奖励系统要服务 3-5 回合 demo

默认 `xpThreshold = 45` 对当前短切片太慢。专家共识是：首个奖励应该在 3-5 回合内自然出现，并且奖励三选一要回应玩家刚经历的问题。

建议首奖阈值调到 8-12 XP，并保证奖励卡进入下一回合或下一次 draw 时可见。三选一保持：

- 修补；
- 延长；
- payoff。

### 8. VFX 要分 4 档，而不是继续叠亮度

现有表现方向正确，但普通命中、击杀、payoff、清场都靠类似的 slash / glow 强弱区分，长期会糊。

下一轮只需要定义 4 档：

- 出牌确认；
- 普通命中；
- 击杀处决；
- 清场终结。

再补一个 presentation-only 的 hit stop 语法，不改 sim tick。

### 9. 技术上先补边界，不要大重构

架构组不建议马上重写 runtime，但建议抽两个小边界：

- `resolvePlayCardIntent(world, intent)`：目标解析、失败条件、初始 commands，不反写 intent；
- `runEndTurnSequence(world, traceId)`：TurnEnded、EnemyAttack、EnemyRefill、AdvanceRound、DealHand 的固定流程。

同时建立 card/enemy catalog 校验和测试 fixture，防止继续用手工改 world 内部状态扩测试。

### 10. QA 需要从“可截图”升级为“可复现体验”

下一轮验收不应该回到 30/60/90 秒击杀数。应该记录每回合：

- `costSequence`
- `multipliers`
- `chainBreakReason`
- `repairMethod`
- `payoffEnhanced`
- `intentBeforeEndTurn`
- `resolvedDamage`
- `hpSavedEstimate`
- `rewardResponseType`

原始 browser QA 仍可留在 ignored `outputs/browser-qa/`，但需要在 `design/technical/redline-batches/` 写一份可提交的 QA 摘要。

## 下一轮建议批次

### Batch A：固定 5 回合合同

只写合同、测试草案和数据脚本，不改 UI。

必须裁决：

- 3 费 payoff 的合法资源规则；
- 5 回合固定手牌、敌意图、奖励；
- armed / unarmed payoff 条件；
- 奖励首次触发阈值；
- intent 真相源。

验收输出：

- 一份 `fixed-seed-hyperturn-contract.md`；
- 一份 sim acceptance；
- 一份 QA metrics 字段定义。

### Batch B：Runtime 最小闭环

目标不是重构，而是让固定合同可跑。

最小实现：

- enemy intent summary 只用 snapshot 真相；
- 补位敌人标记为下轮攻击；
- payoff armed / unarmed 分支；
- `preventedIntentDamage` 或等价 TurnResult；
- reward 阈值和奖励进入下一手；
- 不恢复 realtime 自动攻击、实时扣血、固定 60 秒 burst。

### Batch C：HUD 和移动端决策线

目标是让玩家知道下一步点什么。

最小实现：

- 推荐下一步；
- 每张牌显示打出后的 intent 变化；
- active intent 敌人显示本回合伤害；
- 补位敌人显示下轮；
- 移动端 End Turn 靠近操作区；
- 手牌出牌后避免突然重排。

### Batch D：反馈层级

只做表现，不改玩法。

最小实现：

- 普通命中、击杀、armed payoff、全局清场四档反馈；
- 轻量 hit stop；
- audio cue manifest，可以先无素材；
- 多目标事件去重，避免清场时噪音堆叠。

### Batch E：真实 QA 和交付摘要

目标是证明不是单测绿，而是玩家路径成立。

必须跑：

- desktop 3-5 回合；
- 390x844 真实 tap；
- sim tests；
- build；
- QA cleanup；
- bundle size 摘要；
- 提交内 QA 摘要。

## 明确停做项

下一轮不要做这些事：

- 不扩大量新卡；
- 不扩大量新敌人；
- 不做长随机 run；
- 不重新引入自动攻击、no-input damage、realtime pressure-line；
- 不用固定 60 秒 burst 包装 payoff；
- 不把 3 费全场牌做成 x1 也很强；
- 不把关键后果放在 hover/title/Debug Trace 里；
- 不让 HUD 继续自行重算 enemy intent；
- 不先追求低模美术换皮或生成新图。

## 最小成功标准

下一轮成功，不是“又多做了很多系统”，而是能提供一条可复核证据链：

1. 玩家首屏知道先打哪张。
2. 正确链能显著降低本回合意图伤害。
3. 断链仍可打，但结果明显变差。
4. Wild/draw/mana 至少一次把坏手牌修回来。
5. armed payoff 清前排或显著避免伤害。
6. 奖励回应刚才的构筑问题。
7. 桌面和 390x844 都能跑过同一套核心路径。

如果只允许选择一个下一步，我建议先做 Batch A：固定 5 回合合同。没有这个，继续派 worker 实现很容易再次分叉。

