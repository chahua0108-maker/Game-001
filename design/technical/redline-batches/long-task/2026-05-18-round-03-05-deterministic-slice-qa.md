# 2026-05-18 Round 03-05：固定短切片 QA 设计

角色：第 3 轮专家 05，固定短切片 QA 设计师  
工作目录：`/Users/roc/Game-001`  
输出边界：只写测试设计，不改源码，不提交 git。  
目标：用 deterministic 5 回合验收替代旧 `redline-90s`，验证正确链、断链、修补、奖励、授权 payoff 的闭环，不恢复实时压力。

## 0. 结论

旧 `redline-90s` 不应该恢复。新的 P0 验收应是一条固定 5 回合短切片：

1. Round 1：正确 `0 -> 1 -> 2`，能减压并授予本回合终局授权。
2. Round 2：断链仍可出牌，但倍率、减压和授权明显变差。
3. Round 3：Wild / draw / mana 修补坏手，重新接回 `0 -> 1 -> 2`。
4. Reward Gate：3-5 回合内自然出现首奖，奖励回应刚经历的问题，并进入下一手可操作资源。
5. Round 4-5：用奖励或固定手牌完成授权 payoff，证明清场/救场来自链路和授权支付，不来自实时自动压力。

这不是 90 秒生存测试，也不是长随机 run。测试只允许使用固定手牌、固定敌人、固定 XP 阈值和显式玩家意图。

## 1. 禁止项

验收脚本不得依赖这些旧口径：

| 禁止项 | 原因 | 失败证据 |
| --- | --- | --- |
| `advance-time` 驱动伤害或清场 | 会把旧 realtime heartbeat 带回来 | 事件中出现用于核心伤害的 `TimeAdvanced` |
| `EnemyAdvanced` / `EnemyPressure` 作为主要压力 | 压力应来自回合末敌意图 | 断言通过依赖敌人自动推进 |
| `AutoAttack` | 玩家没有操作也造成核心结果 | 事件中出现 `AutoAttack` |
| 固定 60/90 秒 burst | payoff 会被包装成时间奖励，而不是卡牌链路结果 | 测试名或断言包含 60s/90s/burst timer |
| 随机发牌或随机敌人 | QA 结果不可复核 | 未显式设置 hand / drawPile / enemy hp / reward choices |

允许使用 fixture 直接设置手牌、抽牌堆、敌人 HP、XP 阈值和 reward choices。目标是验收机制因果，不是模拟完整随机局。

## 2. 固定脚本基线

建议测试名：

```text
redline-deterministic-slice.acceptance
```

建议固定输入：

| 项 | 固定值 |
| --- | --- |
| 初始资源 | `maxEnergy = 3`，每个玩家回合开始 `energy = 3` |
| 初始敌意图 | 以前排 active intent 为真相源，初始总意图约 `17` |
| 首奖阈值 | `xpThreshold = 10` 或等价测试 fixture，保证 3-5 回合内出现首奖 |
| 起始核心牌 | `debt_hook`、`redline_cut`、`row_cleave` |
| 修补牌 | `wild_mana_stitch`，可选补充 `pulse_draw` / `wild_gap_key` |
| payoff 牌 | `severance_burst` 或 `red_ledger_burst` |
| 2 费展开牌 | `row_cleave` 为基础授权段，`clearance_order` 只可作为 mini-payoff 对照 |

每回合需要记录统一 metrics：

```text
round
handBefore
playedCards
costSequence
multipliers
chainBreakReason
repairMethod
authorizationGranted
authorizationPaid
payoffArmed
payoffEnhanced
intentBeforeEndTurn
resolvedDamage
preventedIntentDamage
rewardResponseType
events
```

## 3. Round 1：正确链减压

### Given

- 游戏处于 `PlayerTurn`。
- 玩家手牌固定为：

```text
debt_hook, redline_cut, row_cleave
```

- 玩家 `energy = 3`。
- 前排敌人有 active intent，`intentBeforeEndTurn > 0`。
- payoff 不在手牌中，避免 Round 1 直接清场。

### When

玩家按顺序打出：

```text
debt_hook -> redline_cut -> row_cleave -> end-turn
```

### Then

- 三张牌均成功打出。
- `costSequence = [0, 1, 2]`。
- `effectMultiplier = [1, 2, 3]`。
- `row_cleave` 后产生本回合临时终局授权。
- 本回合没有 `PayoffTriggered` 和 `PayoffResolved`。
- End Turn 前的敌意图低于开局意图，End Turn 后玩家受到的伤害低于空过基线。
- 回合结束后临时授权清空，不跨回合保留。

### 应记录的事件

| 事件 | 必要字段 |
| --- | --- |
| `CardPlayed` | `cardId`、`printedCost`、`effectMultiplier`、`currentEnergyPaid`、`authorizationPaid = 0` |
| `ChainAdvanced` | `playedCost` 为 `0/1/2`，`multiplier` 为 `1/2/3`，`nextExpectedCost` 递增 |
| `AuthorizationGranted` | `tempAuthorizationMP = 3`、`authorizationRestriction = payoff-only`、`payoffArmed = true` |
| `EnemyIntentDeclared` | 当前 active intent 的真相源 |
| `TurnEnded` | `round = 1` |
| `EnemyIntentResolved` 或 `EnemyAttacked` | 结算伤害与 End Turn 前 preview 一致 |

## 4. Round 2：断链仍可打但亏

### Given

- 游戏进入下一次 `PlayerTurn`。
- 玩家手牌固定为：

```text
debt_hook, row_cleave, redline_cut
```

- 敌人仍有 active intent。
- 玩家拥有 3 MP，但没有本回合授权。

### When

玩家故意打错顺序：

```text
debt_hook -> row_cleave -> end-turn
```

### Then

- `debt_hook` 成功起链。
- `row_cleave` 仍可打出，不表现为硬禁牌。
- `row_cleave` 触发断链，`effectMultiplier = 1`。
- 不产生 `AuthorizationGranted`。
- 不产生 `PayoffTriggered` 和 `PayoffResolved`。
- End Turn 后剩余意图伤害明显高于 Round 1 正确链。
- 该回合的总收益低于正确链同牌序对照，建议不超过正确链收益的 70%。

### 应记录的事件

| 事件 | 必要字段 |
| --- | --- |
| `CardPlayed` | `debt_hook.effectMultiplier = 1`，`row_cleave.effectMultiplier = 1` |
| `ChainAdvanced` | `debt_hook.playedCost = 0` |
| `ChainBroken` | `expectedCost = 1`、`playedCost = 2`、`breakReason` 可读 |
| `TurnEnded` | round 推进 |
| `EnemyIntentResolved` 或 `EnemyAttacked` | `resolvedDamage >= Round 1 resolvedDamage` |

不应出现：

```text
AuthorizationGranted
PayoffTriggered
PayoffResolved
```

## 5. Round 3：坏手修补

### Given

- 玩家经历过一次断链后进入下一次 `PlayerTurn`。
- 手牌固定为：

```text
debt_hook, wild_mana_stitch, row_cleave
```

- 可选 draw fixture：抽牌堆顶部放一张 `redline_cut` 或 payoff，用于验证修补牌的抽牌反馈。
- 玩家 `energy = 3`。
- 敌人意图仍足以让玩家感到压力。

### When

玩家按修补路线打出：

```text
debt_hook -> wild_mana_stitch -> row_cleave
```

### Then

- `wild_mana_stitch` 按当前期望费用修补缺口，不视为普通 0 费断链。
- 事件记录修补了哪个费用段，最小应为 `repairedCost = 1`。
- `row_cleave` 作为 2 费展开段继续获得 x3 或等价授权链倍率。
- `row_cleave` 后产生 `AuthorizationGranted`。
- 如果修补牌带抽牌，抽到的牌必须在事件中可见。
- 如果修补牌带当前 MP 回补，结果只能影响本回合 `energy`，不能提高 `maxEnergy`。

### 应记录的事件

| 事件 | 必要字段 |
| --- | --- |
| `CardPlayed` | `wild_mana_stitch.cardId`、`effectMultiplier`、`printedCost` |
| `ChainRepaired` | `cardId = wild_mana_stitch`、`repairedCost = 1`、`nextExpectedCost = 2`、`multiplier` |
| `HandDealt` | 如触发抽牌，`cardIds` 包含被抽到的卡 |
| `ChainAdvanced` | `row_cleave.playedCost = 2`、`multiplier = 3` |
| `AuthorizationGranted` | 修补后的链也能授予 payoff-only 授权 |
| `CardPlayed` | 所有修补牌的 `authorizationPaid = 0` |

不应出现：

```text
ChainBroken on wild_mana_stitch
maxEnergy increase
```

## 6. Reward Gate：奖励回应问题

### Given

- 固定 5 回合脚本中，累计 XP 在 Round 3 或 Round 4 后达到首奖阈值。
- `reward.pending = true`。
- `reward.choices` 固定为三类问题各一张，例如：

```text
wild_gap_key        # 修补资源
severance_burst    # payoff 终结
blood_reclaim      # 路线桥接
```

### When

玩家选择与当前问题对应的奖励：

- 如果刚经历断链，选择 `wild_gap_key` 或 `wild_mana_stitch`。
- 如果已经能稳定完成 `0 -> 1 -> 2` 但缺终结，选择 `severance_burst`。
- 如果缺起手密度，选择 `blood_reclaim`。

P0 推荐固定选择：

```text
select-reward severance_burst
```

然后进入下一次 `PlayerTurn`。

### Then

- `RewardChoicesGenerated.choices` 必须覆盖 `repair-resource / payoff / route-bridge` 三类，不接受三个同质奖励。
- `RewardChosen` 记录选择的牌。
- `CardAddedToDeck` 发生在下一次可操作手牌之前。
- 非终局节点中，选择的奖励牌必须进入下一手或 next-hand guaranteed 槽位，不能只进入抽牌堆尾部等待随机抽到。
- 奖励只进入当前 run，不能改 `maxEnergy`，不能变成局外永久成长。
- `rewardResponseType` 必须能从选择或测试 fixture 中读出，建议值为 `repair-resource`、`payoff`、`route-bridge`。

### 应记录的事件

| 事件 | 必要字段 |
| --- | --- |
| `LevelUpReached` | `level`、`xpThreshold` |
| `RewardChoicesGenerated` | `choices.length = 3`，三类分支覆盖 |
| `RewardChosen` | `cardId` |
| `CardAddedToDeck` | `cardId`、`deckSize` |
| `HandDealt` | 非终局奖励后，`cardIds` 包含被选奖励或 next-hand guaranteed 证据 |
| `RoundStarted` | 选择奖励后进入下一回合 |

不应出现：

```text
play-card accepted during Reward
end-turn accepted during Reward
maxEnergy increase
```

## 7. Round 4：授权 payoff 清场

### Given

- 游戏处于 `PlayerTurn`。
- 玩家手牌固定为：

```text
debt_hook, redline_cut, row_cleave, severance_burst
```

- `severance_burst` 可以来自 Reward Gate，也可以由 fixture 固定注入；如果来自奖励，必须保留 Reward Gate 的事件证据。
- 敌人当前 active intent 足以造成明显伤害。
- 玩家基础 `energy = 3`，`maxEnergy = 3`。

### When

玩家按顺序打出：

```text
debt_hook -> redline_cut -> row_cleave -> severance_burst -> end-turn
```

### Then

- `0 -> 1 -> 2` 先授予 `tempAuthorizationMP = 3`。
- `severance_burst` 实际消费终局授权，不能只因为事件字段写了 armed。
- `CardPaymentRecorded.source = authorization` 或等价记录。
- `CardPlayed.authorizationPaid = 3`。
- `CardPlayed.payoffArmed = true`。
- `PayoffTriggered.enhanced = true`。
- `PayoffResolved.payoffArmed = true`。
- `PayoffResolved.preventedIntentDamage > 0`，且不大于 payoff 前 active intent。
- 如果目标是救场，End Turn 后玩家 HP 不下降；如果目标是清前排，`killCount` 或 `affectedEnemyIds` 必须证明 payoff 是主要清算来源。
- 用完后 `tempAuthorizationMP = 0`，本回合授权不能跨 Round 5。

### 应记录的事件

| 事件 | 必要字段 |
| --- | --- |
| `AuthorizationGranted` | 由 `row_cleave` 后产生，`tempAuthorizationMP = 3` |
| `CardPaymentRecorded` | `cardId = severance_burst`、`authorizationPaid = 3`、`source = authorization`、`payoffArmed = true` |
| `CardPlayed` | `effectMultiplier = 4`、`authorizationPaid = 3`、`payoffArmed = true` |
| `PayoffTriggered` | `chainLength >= 4`、`multiplier = 4`、`enhanced = true` |
| `PayoffResolved` | `affectedEnemyIds`、`killCount`、`preventedIntentDamage`、`intentDamageBefore`、`intentDamageAfter` |
| `EnemyIntentResolved` 或无伤 End Turn 证据 | payoff 后实际伤害与 prevented intent 对得上 |

不应出现：

```text
PayoffTriggered.enhanced = true with authorizationPaid = 0
PayoffResolved.payoffArmed = true with CardPaymentRecorded.authorizationPaid = 0
maxEnergy > 3
```

## 8. Round 5：奖励后续可操作

### Given

- Round 4 后如果触发第二次奖励，固定 choices 再次覆盖三类分支。
- 玩家选择一张修补或路线奖励，例如：

```text
wild_gap_key
```

- 进入 Round 5 后，手牌应包含刚选奖励或 next-hand guaranteed 证据。

### When

玩家在 Round 5 使用奖励牌参与链路：

```text
debt_hook -> wild_gap_key -> row_cleave
```

### Then

- 奖励不是只存在于历史记录，而是进入了可操作手牌。
- `wild_gap_key` 能作为修补或桥接资源参与链路。
- 如果这条链完成 `0 -> 1 -> 2`，应再次产生 `AuthorizationGranted`。
- Round 5 不要求再次打 payoff，避免把验收扩成长 run。
- 该回合结束后仍不能出现实时自动压力事件。

### 应记录的事件

| 事件 | 必要字段 |
| --- | --- |
| `RewardChosen` | `cardId = wild_gap_key` 或本轮固定奖励 |
| `CardAddedToDeck` | 奖励入当前 run deck |
| `HandDealt` | `cardIds` 包含所选奖励 |
| `CardPlayed` | 所选奖励被实际打出 |
| `ChainRepaired` 或 `ChainAdvanced` | 奖励牌对链路的作用明确 |
| `AuthorizationGranted` | 如果完成 `0 -> 1 -> 2`，再次授予 payoff-only 授权 |

## 9. 一条总体验收断言

固定 5 回合结束后，QA 只看这组高层结论：

| 目标 | 通过条件 |
| --- | --- |
| 正确链 | 至少一次 `0 -> 1 -> 2` 的 `ChainAdvanced` 序列，倍率到 x3，并产生 `AuthorizationGranted` |
| 断链 | 至少一次 `ChainBroken`，卡仍能打出，但无授权，减压低于正确链 |
| 修补 | 至少一次 `ChainRepaired` 或 draw/mana 修补证据，坏手重新接回 2 费展开段 |
| 奖励 | 3-5 回合内至少一次 `RewardChoicesGenerated -> RewardChosen -> CardAddedToDeck -> HandDealt`，且三类分支覆盖 |
| 授权 payoff | 至少一次 3 MP payoff 通过 `authorizationPaid > 0` 打出，并产生 `PayoffTriggered.enhanced = true` 与 `PayoffResolved.preventedIntentDamage > 0` |
| 非实时 | 核心结果不依赖 `TimeAdvanced`、`EnemyAdvanced`、`EnemyPressure`、`AutoAttack` |

## 10. 建议拆成的测试用例

如果实现 worker 不想写一个过长测试，建议拆成 4 个 deterministic 用例，但共享同一套 fixture：

1. `plays-correct-chain-and-records-authorization`
2. `records-broken-chain-without-locking-card-play`
3. `repairs-bad-hand-and-restores-authorization-route`
4. `runs-five-round-slice-through-reward-and-authorized-payoff`

第 4 个是最终替代 `redline-90s` 的验收入口。前 3 个用于失败定位，避免一个大脚本红了以后看不出断在哪。

## 11. 不验收的内容

本文件不要求实现这些内容：

- Playwright 真实 DOM QA。
- 移动端布局截图。
- 新卡牌实例、升级、消耗、保留、状态、诅咒。
- 通用效果解释器。
- 更复杂敌人意图。
- 完整随机 run、地图、商店、局外成长。
- 任何实时压力复活。

## 12. 交付口径

实现完成后，验收报告应给出一张短表：

| 回合 | 玩家动作 | 核心事件 | 意图变化 | 奖励/授权结果 |
| --- | --- | --- | --- | --- |
| 1 | 正确链 | `ChainAdvanced x3`、`AuthorizationGranted` | 降低 | 授权产生并清空 |
| 2 | 断链 | `ChainBroken` | 高伤害保留 | 无授权 |
| 3 | 修补 | `ChainRepaired`、`AuthorizationGranted` | 降低 | 坏手修回 |
| 4 | Reward + payoff | `RewardChosen`、`CardPaymentRecorded`、`PayoffResolved` | 大幅降低或清零 | 授权支付 |
| 5 | 奖励后续 | `CardAddedToDeck`、`HandDealt`、`CardPlayed` | 继续可控 | 奖励可操作 |

只要这张表成立，就可以把旧 `redline-90s-acceptance` 继续保留为 deprecated / skipped，不需要恢复旧实时测试。

STATUS: DONE  
路径：`/Users/roc/Game-001/design/technical/redline-batches/long-task/2026-05-18-round-03-05-deterministic-slice-qa.md`
