# Redline Attribute Design - MP Growth Adaptation

日期：2026-05-18
角色：Redline 属性系统设计转译
范围：设计文档。未改 runtime、卡牌数据、测试、HUD 或浏览器验收。

## 1. 当前 Redline 属性问题

Redline Hyper-Turn 当前的属性底盘已经能证明 `0 -> 1 -> 2`，但还不能自然证明 `0 -> 1 -> 2 -> 3 payoff`。核心原因不是缺一张牌，而是 MP、最大 MP、清算链、修补和 payoff 武装值还没有形成同一套公开属性框架。

当前问题可以拆成 6 点：

1. `maxEnergy = 3` 只够支付 `0 + 1 + 2`。如果继续要求 3 费 payoff 接在完整链后，必须有玩家可见的资源提升规则；不能只在测试里把 `maxEnergy` 手动改成 6。
2. 当前 MP 只是“本回合燃料”，不是“清算授权”。`GainEnergy` 能让当前 MP 增加，但没有解释这是返还、临时授权、透支，还是最大 MP 成长。
3. Wild / draw / mana 已经有雏形，但语义混在卡牌描述和 `utilities` 里。玩家看不到“我用哪种方式修补了链路”，QA 也难复盘修补来源。
4. `ChainState` 已有 `playedCosts`、`nextExpectedCost`、`multiplier`、`broken`、`repairedThisTurn`，但还缺“清算链长度”和“修补次数”作为 demo 指标。现在更像倍率记录，不像玩家决策记录。
5. payoff 只有 `enhanced: true/false` 的二值表达。未武装 payoff 仍可能靠基础全场伤害抢走爽点，武装 payoff 也缺少 `killCount`、`preventedIntentDamage` 这类可验收后果。
6. 敌意图、HP、MP 和奖励还没有合成一条闭环。下一轮固定 5 回合 demo 需要证明：玩家用资源和链路减少本回合意图伤害，然后奖励回应这个构筑问题。

因此，下一轮属性设计不应先扩卡，而应先裁决：MP 的增长到底是持久上限成长、回合内临时授权，还是透支换收益。

## 2. 可引入属性：当前 MP、最大 MP、临时授权 MP、清算链长度、修补次数、payoff 武装值、敌意图抗压、抽牌/保留

| 属性 | 定义 | Redline 用途 | 当前接点 | UI / 验收口径 |
| --- | --- | --- | --- | --- |
| 当前 MP | 本回合还能支付的普通资源。回合开始时刷新到最大 MP。 | 决定当前能否出牌，维持 `0 -> 1 -> 2` 的基本节奏。 | `player.energy`。`SpendEnergy` 扣除，`GainEnergy` 增加。 | 显示为 `MP 2 / 3`；QA 记录每张牌前后的 MP。 |
| 最大 MP | 每回合普通 MP 的刷新上限。它代表稳定授权，不应被隐藏脚本临时篡改。 | 决定一回合天然能承载多长链。若要自然支付 `0+1+2+3`，需要最高 6。 | `player.maxEnergy`，当前固定 3。 | 若提升，必须有事件、奖励或 UI 标记解释来源；不得只在测试夹具里设 6。 |
| 临时授权 MP | 本回合临时扩出的额外 MP 上限和可用点数，结束回合清空。可限制只能支付下一张 expected cost 或 payoff。 | 让完整链在 3 MP 起点下接上 3 费 payoff，同时保持“我延长了这一回合”的可读性。 | 当前 `wild_mana_stitch.energyGain = 1` 类似临时补能，但不是独立属性。 | 显示为额外授权槽，例如 `MP 0 / 3 + AUTH 3`；QA 记录 `authorizedMpGained`、`authorizedMpSpent`、`expiresAtEndTurn`。 |
| 清算链长度 | 本回合连续按 expected cost 成功推进的步数，Wild 可按 expected cost 计入。 | 控制倍率、payoff 武装、奖励回应和推荐下一步。 | `world.chain.playedCosts.length` 和 `world.chain.multiplier`。 | 显示 `清算链 0 -> 1 -> 2`、`Next MP3`、`x4`；QA 记录每回合最大链长。 |
| 修补次数 | 本回合或本场通过 Wild、draw、mana、reorder 把断口接回来的次数。 | 证明坏手牌不是死局，也让奖励能回应“我需要稳定性”。 | 只有 `repairedThisTurn: boolean`；draw/mana 修补没有统一计数。 | 记录 `repairCount` 和 `repairMethods`，例如 `wild + mana`、`draw found MP2`。 |
| payoff 武装值 | payoff 的准备程度。建议从二值改成 0-3 档：0 未武装，1 预热，2 武装，3 过载授权。 | 防止 3 费全场牌 x1 就太强；把清场强反馈绑定到链路和授权。 | `PayoffTriggered.enhanced` 当前只表达 `multiplier >= 3`。 | 卡牌显示 `未武装 / 已武装 / 过载清算`；QA 记录 `payoffArmedValue`、击杀数、意图减少量。 |
| 敌意图抗压 | 玩家当前能承受或抵消敌意图的能力。它可以是派生指标，不一定是新战斗护盾。 | 把“资源选择”转译成“结束回合少掉多少 HP”，证明 chain/payoff 有救场意义。 | `enemyIntentSummary.totalDamage` 和 end-turn `EnemyIntentResolved`。 | 显示 `未清算反噬 12`、`本轮预计降低 7`；QA 记录 `intentBeforeEndTurn`、`resolvedDamage`、`hpSavedEstimate`。 |
| 抽牌 / 保留 | 抽牌用于找下一段费用或 payoff；保留用于把关键牌留到下一回合。 | 抽牌是短局修补，保留是中期构筑稳定性。下一轮 demo 先用抽牌，保留可作为后续属性。 | `drawCards` 已存在；`reorder` 只有标签；`retain` 尚不存在。 | 抽牌记录来源和目标；保留若未实现，不写进 5 回合验收承诺。 |

推荐把这些属性按优先级分层：

- P0：当前 MP、临时授权 MP、清算链长度、payoff 武装值、敌意图抗压。
- P1：修补次数、抽牌来源。
- P2：最大 MP 持久成长、保留。

这能避免下一轮为了“完整属性系统”过度扩张。固定 5 回合 demo 只需要证明 P0 和一部分 P1。

## 3. 3 种最大 MP 提升机制方案

### 方案 A：清算授权等级，持久提升最大 MP

| 项 | 设计 |
| --- | --- |
| 触发条件 | 本回合完成一次有效 `0 -> 1 -> 2` 清算链，并且减少至少一部分本回合敌意图；或在奖励中选择“授权升级”。下一回合 `max MP +1`，本场封顶。 |
| 收益 | 给玩家明确成长感：我证明了清算流程，所以机构给我更高授权。它也能和奖励系统自然结合。 |
| 代价 | 提升发生在下一回合，不立即修复当前手牌。若要从 3 提到能自然支付 `0+1+2+3` 的 6，需要多次升级，5 回合 demo 会显得拖。 |
| UI 表示 | MP 条上出现永久授权槽：`MP 4 / 4`，并弹出 `清算授权 +1`。奖励卡可写 `最大 MP +1`。 |
| 风险 | 成功者更成功，断链玩家更缺资源；如果提升过快，3 费 payoff 会变成普通大牌。如果为了 demo 一次给到 6，又会像隐藏脚本加资源。 |

适配判断：适合后续 roguelite 成长，但不适合作为下一轮固定 5 回合 demo 的唯一解。它太像长期进度，不能干净解释“这一回合为什么突然能接 payoff”。

### 方案 B：回合内临时授权上限，完整链后支付 payoff

| 项 | 设计 |
| --- | --- |
| 触发条件 | 本回合清算链无断裂地达到 `0 -> 1 -> 2`，或通过 Wild 修补后达到 `lastCost = 2`、`chainLength >= 3`。立即获得 `临时授权 MP +3`，只在本回合存在，优先只能支付下一张 `MP3 payoff`。 |
| 收益 | 起始 `max MP = 3` 不变，但玩家能看见“完整链授权了终局清算”。这正好解释 `0+1+2` 后为什么还能打 3 费 payoff。 |
| 代价 | 授权必须由正确链路触发；断链不触发。若 payoff 不打或被打断，授权在结束回合清空。可限制每回合只触发一次。 |
| UI 表示 | 普通 MP 槽归零后，出现白色或青色临时槽：`MP 0 / 3 + 临时授权 3`；payoff 卡显示 `已武装：可用授权支付`。End Turn 区显示 `授权未使用将清空`。 |
| 风险 | 如果文案不好，会被理解成免费返费。若授权 MP 可以支付任意牌，会鼓励乱打大牌。因此必须绑定 expected cost 或 payoff，并在 QA 中记录授权来源。 |

适配判断：这是下一轮最小实现的推荐方案。它解决 3 MP 与 3 费 payoff 的矛盾，同时不要求改成长期 6 MP 经济。

### 方案 C：红线透支，以敌意图或 HP 换临时最大 MP

| 项 | 设计 |
| --- | --- |
| 触发条件 | 玩家在 MP 不足但当前牌能继续链或触发 payoff 时，主动选择“临时授权”。每透支 1 点，获得 `临时最大 MP +1` 和 `当前 MP +1`，每回合封顶 2-3 点。 |
| 收益 | 给坏手牌和高压局一个主动救场按钮：我可以借支资源，但要承担反噬。它也能把 Redline 的主题做实：越线清算有代价。 |
| 代价 | 透支转化为结束回合额外敌意图、立即 HP 损失，或下一回合最大 MP 锁定 -1。代价必须在按钮上写清。 |
| UI 表示 | 红色额外 MP 槽和反噬标记：`透支 +2，提交回合反噬 +4`。End Turn 预览必须把透支代价算进去。 |
| 风险 | 决策复杂度高，移动端多一个危险按钮；玩家可能把它当成最优解反复透支，削弱 chain 和 reward 的意义。需要强上限和清晰失败后果。 |

适配判断：适合后续增加高压选择，但不建议放进下一轮最小 demo。它会把验收重点从“清算链成立”拉到“借资源是否划算”。

## 4. 推荐一个最小实现方案，用于下一轮固定 5 回合 demo

推荐采用方案 B：回合内临时授权上限。

最小规则如下：

1. 普通最大 MP 暂时保持 `3`。不要为了 payoff 把默认玩家最大 MP 改成 6。
2. 当本回合清算链达到 `0 -> 1 -> 2`，且链未断，触发 `终局授权 +3`。
3. 如果链路中使用 Wild 修补，只要修补后仍按 expected cost 达到 `lastCost = 2`、`chainLength >= 3`，也触发授权，但记录 `repairCount >= 1`。
4. `终局授权 +3` 只在本回合存在，优先只能支付 `cost = 3` 且 `comboNode = burst` 的 payoff。若不打 payoff，结束回合清空。
5. payoff 武装值按下面规则计算：
   - `0`：未武装。没有有效链，或第一张就打 payoff。
   - `1`：预热。链长 2，但还没到 `lastCost = 2`。
   - `2`：武装。链长至少 3，最后有效费用为 2。
   - `3`：过载授权。武装后使用临时授权支付 3 费 payoff。
6. payoff 只有在武装值 2 或 3 时才获得清场/准清场语义。武装值 0 的 payoff 可以打，但只能低收益压血，不能承担 demo 的主清场。

固定 5 回合脚本建议：

| 回合 | 目标体验 | 属性重点 |
| --- | --- | --- |
| Turn 1 | 教学成功链：`0 -> 1 -> 2` 降低前排意图。 | `current MP 3 -> 0`，`chainLength = 3`，不强行 payoff。 |
| Turn 2 | 断链或贪 payoff 失败：3 费牌可见但未武装收益低。 | `payoffArmedValue = 0`，`chainBreakReason` 可读，End Turn 后果可见。 |
| Turn 3 | Wild / draw / mana 修补一次坏手牌。 | `repairCount = 1`，`repairMethod = wild/draw/mana`，继续到有效链。 |
| Turn 4 | 完整链触发 `终局授权 +3`，3 费 payoff 过载清算。 | `tempAuthorizedMp = 3`，`payoffArmedValue = 3`，记录击杀和 `hpSavedEstimate`。 |
| Turn 5 | 奖励回应构筑：repair / extension / payoff 三选一。 | 奖励不必再引入持久 max MP，先证明它回应前 4 回合的问题。 |

这个方案的好处是边界清楚：

- 最大 MP 成长的长期系统先不做。
- 当前 demo 只证明“正确链路给临时授权，临时授权支付 payoff”。
- 断链仍可出牌，但不会拿到授权。
- Wild 修补不是白送强度，它的价值是把玩家重新送回授权条件。
- HUD 和 QA 都能用同一组字段解释结果。

## 5. 验收方式

下一轮验收不应只看“牌能不能打出”，而要证明属性因果链成立。

### Sim / Runtime 验收

1. 默认初始世界仍是普通 `max MP = 3`。任何测试如果要验证 `0 -> 1 -> 2 -> 3 payoff`，必须通过临时授权、奖励或明确机制获得资源，不能直接把 `maxEnergy` 隐式设成 6 当作玩家体验。
2. 固定脚本打出 `0 -> 1 -> 2` 后，应产生可记录的 `tempAuthorizedMp +3` 或等价事件，并且只在本回合有效。
3. 断链路线应没有临时授权；payoff 可打但 `payoffArmedValue = 0` 或 `enhanced = false`，收益明显低于武装路线。
4. Wild / draw / mana 至少一次把坏手牌接回有效链，并记录 `repairCount`、`repairMethod`、`chainLengthAfterRepair`。
5. 武装 payoff 必须记录后果：至少包含击杀数、受影响敌人、敌意图减少或 `hpSavedEstimate` 的等价数据。

### HUD / 玩家可读性验收

1. 玩家首屏能读出当前 MP、最大 MP、下一段 expected cost 和 End Turn 敌意图。
2. 临时授权出现时，必须和普通 MP 分开显示，例如 `MP 0 / 3 + 临时授权 3`。
3. payoff 卡在同一张牌面上能区分 `未武装`、`已武装`、`过载清算`。
4. End Turn 预览必须使用同一份敌意图真相源，不因补位敌人重新计算出让玩家困惑的伤害。
5. 移动端 390x844 至少能完成一次：正序链、断链、修补、授权 payoff、End Turn。

### QA 摘要字段

每回合记录：

- `round`
- `startingMp`
- `maxMp`
- `tempAuthorizedMpGained`
- `tempAuthorizedMpSpent`
- `cardsPlayed`
- `costSequence`
- `multipliers`
- `chainLength`
- `chainBreakReason`
- `repairCount`
- `repairMethod`
- `payoffArmedValue`
- `intentBeforeEndTurn`
- `resolvedDamage`
- `hpSavedEstimate`
- `rewardResponseType`

通过标准是一条 3-5 回合证据链能用这些字段说清楚：

```text
我按费用建立清算链
  -> 链路给了临时授权
  -> 临时授权支付 payoff
  -> payoff 减少敌意图或清前排
  -> 奖励回应我是缺修补、缺延长，还是缺终结
```

如果证据链只能说明“测试里有 6 MP，所以 payoff 打出来了”，则不算通过 Redline Hyper-Turn 的属性验收。
