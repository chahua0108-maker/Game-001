# Redline 当前卡牌与机制盘点 03

日期：2026-05-18
范围：只读当前代码与指定设计文档，盘点已存在的卡牌、字段、事件、资源、链路、payoff、敌意图与奖励机制。

读取依据：

- `prototype-web/src/data/cards.ts`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/eca/redlineRules.ts`
- `prototype-web/src/sim/world.ts`
- `prototype-web/src/data/enemies.ts`
- `design/technical/redline-batches/2026-05-18-attribute-system-synthesis.zh.md`

## 一句话结论

当前 Redline 已经实现了一个可运行的 P0 资源链路：基础 `maxEnergy = 3`，通过 `0 -> 1 -> 2` 费用链获得本回合 `tempAuthorizationMP +3`，该授权只允许支付 `cost = 3` 且 `comboNode = burst` 的 payoff。它已经不是“最大 MP 成长”模型，而是“正确链路解锁终局授权”的模型。

主要含混点有三个：

1. `comboNode = burst` 同时用于 2 费前排清场段和 3 费全场 payoff，导致“burst 是路线节点还是终结牌类型”不够清楚。
2. `utilities: ['reorder']` 目前只有标签和描述，没有运行时重排效果。
3. Wild 修补按代码逻辑会把 wild 牌视为当前 expected cost，但没有独立 `repairReserve` 或 `GapRepaired` 事件，和设计文档里的“修补储备 / repair source”还没有完全对齐。

## CardDefinition 字段

当前卡牌字段来自 `CardDefinition`：

| 字段 | 类型 / 当前值域 | 当前用途 |
| --- | --- | --- |
| `id` | `CardId` | 卡牌主键，也用于手牌、牌库、弃牌堆、奖励池。 |
| `name` | `string` | UI 展示名。 |
| `cost` | `number` | 支付当前 MP 或临时授权；同时作为费用链的节点值。 |
| `verb` | `string` | 中文动作词，主要是展示语义。 |
| `damage` | `number` | 基础伤害。ECA 里会乘以 `effectMultiplier`。 |
| `comboNode` | `hook/cut/spark/mark/reclaim/burst` | 当前用于链路描述、payoff 授权判定、combo 文案。 |
| `description` | `string` | 卡牌说明。当前很多机制边界只写在 description 中。 |
| `targets` | `front-enemy/front-row/all-enemies/self` | 决定 ECA 规则分流：单体、前排、全场、自身资源。 |
| `drawCards?` | `number` | self 牌触发 `DrawCards`，实际抽牌数会乘以链路倍率。 |
| `energyGain?` | `number` | self 牌触发 `GainEnergy`，当前不乘倍率。 |
| `utilities?` | `wild/draw/mana/reorder[]` | 标签。`wild` 参与费用链修补；`draw/mana/reorder` 多数用于表达和 UI 语义。 |

字段边界：

- 没有显式 `rarity`、`cardType`、`route`、`tags`、`payoffType`、`rewardRole`、`exhaust`、`block`、`status`、`intentInteraction`。
- 卡牌是否是 payoff 目前由 `cost === 3 && comboNode === 'burst'` 推导，不是独立字段。
- 卡牌是否是修补牌目前由 `utilities.includes('wild')` 推导，不是独立字段。
- 卡牌是否重排目前只靠 `utilities: ['reorder']` 与描述表达，没有运行时命令。

## 当前所有卡牌分类

### 起手牌

`startingHand` 当前固定为：

| 卡牌 | 角色 |
| --- | --- |
| `debt_hook` | 0 MP 起手，前排单体伤害，打开链。 |
| `heartbeat_spark` | 1 MP 承接，前排单体伤害。 |
| `redline_cut` | 1 MP 承接，前排单体高伤害。 |
| `row_cleave` | 2 MP 前排段，完成 `0 -> 1 -> 2` 后触发授权。 |

这意味着默认起手手牌中没有 3 费 payoff。第一回合可打出授权，但未必有 payoff 可消耗。

### 奖励池

`rewardCardPool` 当前包含 11 张：

`wild_mana_stitch`、`severance_burst`、`wild_gap_key`、`paper_shatter`、`lantern_captain`、`red_ledger_burst`、`spark_tap`、`blood_reclaim`、`heartbeat_spark`、`verdict_mark`、`clearance_order`。

不在奖励池但在卡表中的卡牌：

- `debt_hook`
- `blood_tithe`
- `redline_cut`
- `row_cleave`
- `pulse_draw`

含混处：这些不在奖励池的牌是否是“基础牌 / 教学牌 / 暂未开放牌”没有字段标注，只能从 `startingHand` 和 `rewardCardPool` 推断。

## 每张卡牌盘点

| 卡牌 | cost | target | comboNode | utilities | 当前归类 | 运行时效果 |
| --- | ---: | --- | --- | --- | --- | --- |
| `debt_hook` | 0 | `front-enemy` | `hook` | 无 | 起手 0 费单体启动 | 对前排单体造成 `4 * multiplier` 伤害，推进费用链。 |
| `blood_reclaim` | 0 | `front-enemy` | `reclaim` | 无 | 奖励 0 费补链攻击 | 对前排单体造成 `3 * multiplier` 伤害，作为 0 费链路入口。 |
| `blood_tithe` | 0 | `self` | `reclaim` | `draw` | 0 费抽牌支援，暂不在奖励池 | 抽 `1 * multiplier` 张，不造成伤害。 |
| `spark_tap` | 0 | `front-enemy` | `spark` | 无 | 奖励 0 费 Spark 起手 | 对前排单体造成 `2 * multiplier` 伤害。 |
| `redline_cut` | 1 | `front-enemy` | `cut` | 无 | 起手 1 费承接攻击 | 对前排单体造成 `9 * multiplier` 伤害。 |
| `heartbeat_spark` | 1 | `front-enemy` | `spark` | 无 | 起手/奖励 1 费承接攻击 | 对前排单体造成 `6 * multiplier` 伤害。 |
| `verdict_mark` | 1 | `front-enemy` | `mark` | 无 | 奖励 1 费 Mark 承接 | 对前排单体造成 `5 * multiplier` 伤害。 |
| `pulse_draw` | 1 | `self` | `spark` | `draw` | 1 费抽牌承接，暂不在奖励池 | 抽 `1 * multiplier` 张。 |
| `row_cleave` | 2 | `front-row` | `cut` | 无 | 起手 2 费授权段 | 对第一排所有敌人造成 `5 * multiplier` 伤害；若此前为 0、1，则触发临时授权。 |
| `clearance_order` | 2 | `front-row` | `burst` | 无 | 奖励 2 费清场/授权段 | 对第一排所有敌人造成 `7 * multiplier` 伤害；也能作为 2 费完成授权链。 |
| `paper_shatter` | 2 | `self` | `mark` | `draw`,`reorder` | 奖励 2 费支援段 | 抽 `1 * multiplier` 张；`reorder` 暂无运行时效果。 |
| `severance_burst` | 3 | `all-enemies` | `burst` | 无 | 奖励 3 费全场 payoff | 对所有存活敌人造成 `16 * multiplier` 伤害，触发 payoff 结算。 |
| `red_ledger_burst` | 3 | `all-enemies` | `burst` | 无 | 奖励 3 费全场 payoff | 对所有存活敌人造成 `12 * multiplier` 伤害，触发 payoff 结算。 |
| `wild_mana_stitch` | 0 | `self` | `reclaim` | `wild`,`draw`,`mana` | 奖励 Wild/修补/返费 | 抽 `1 * multiplier` 张，获得 1 当前 MP；若非首张且链未断，按 expected cost 修补链。 |
| `wild_gap_key` | 1 | `front-enemy` | `hook` | `wild` | 奖励 Wild/修补攻击 | 对前排单体造成 `1 * multiplier` 伤害；若非首张且链未断，按 expected cost 修补链。 |
| `lantern_captain` | 2 | `self` | `mark` | `draw`,`reorder` | 奖励 2 费角色/支援段 | 抽 `1 * multiplier` 张；`reorder` 暂无运行时效果。 |

## 费用与资源机制

### 当前 MP 与最大 MP

- 初始 `energy = 3`，`maxEnergy = 3`。
- 每次发牌进入玩家回合时，`energy` 重置为 `maxEnergy`。
- 当前代码没有任何卡牌或奖励提高 `maxEnergy`。
- `GainEnergy` 只增加当前 `energy`，不会提高后续回合上限。

### 临时授权 MP

已实现：

- `tempAuthorizationMP` 初始为 0。
- 完成未断裂的 `0 -> 1 -> 2` 链后，获得 `tempAuthorizationMP += 3`。
- 同时设置 `authorizationRestriction = 'payoff-only'`、记录 `lastAuthorizationReason` 与 `lastAuthorizationSourceCardId`，并置 `payoffArmed = true`。
- 授权只允许支付 `cost === 3 && comboNode === 'burst'` 的牌。
- 授权被支付后会扣除 `tempAuthorizationMP`；归零时清空 restriction。
- 离开 `PlayerTurn` 时会重置费用链和授权，因此未用授权不会跨回合保留。

和设计文档对齐处：

- 已符合“基础 maxMP = 3，不做最大 MP 成长”。
- 已符合“完成 `0 -> 1 -> 2` 后，本回合获得临时授权 +3”。
- 已符合“授权只支付 3 费 payoff”。

未完全对齐处：

- 设计文档提到授权也可考虑“只支付下一张 expected cost”，当前代码没有该路径。
- 设计文档提到 `repairReserve`，当前没有该字段。
- 设计文档建议 `GapRepaired` / repair source，当前只有 `ChainRepaired`，没有单独 amount/source 字段。

## 费用链路与倍率

当前链路状态：

| 字段 | 含义 |
| --- | --- |
| `playedCosts` | 本回合链路中记录的费用序列。 |
| `lastCost` | 上一张链路费用。 |
| `nextExpectedCost` | 下一张期望费用，初始为 0。 |
| `multiplier` | 效果倍率。首张为 1，连续接上后递增。 |
| `broken` | 链是否已断。 |
| `breakReason` | 断链原因。 |
| `repairedThisTurn` | 本回合是否用 Wild 修补过。 |

链路规则：

- 第一张必须按 `playedCost === 0` 才算接链。
- 后续必须按 `playedCost === nextExpectedCost` 才算接链。
- 接链成功后 `multiplier` 增加：首张 1，第二张 2，第三张 3，以此类推。
- 任意不符合 expected cost 的牌会触发 `ChainBroken`，链路标记为 broken，倍率回到 1。
- Wild 牌在“已有链路且当前链未断”时，不使用自身 printed cost，而是当作 `expectedCost` 参与链路，触发 `ChainRepaired`。

含混处：

- Wild 牌“修补”的支付成本仍按 printed cost 支付；只是链路记录用 expected cost。这个行为对玩家文案要说清楚，否则容易被理解为免费补缺口。
- `wild_mana_stitch` 是 0 费 Wild，如果在期望 1 或 2 时使用，它按 expected cost 接链，但支付仍是 0，并且还 `GainEnergy +1`。这是强修补/返费效果，当前没有代价字段。
- `SetCombo` 的 `combo` 满 3 会被置 0，但费用链的 `multiplier` 和授权才是核心机制。`combo` 与 `chain.multiplier` 的关系没有在字段名上区分清楚。

## Payoff 机制

当前 payoff 判定有两层：

1. 授权支付判定：`cost === 3 && comboNode === 'burst'`。
2. ECA 全场结算判定：`targets === 'all-enemies'`。

实际 3 费 payoff：

- `severance_burst`
- `red_ledger_burst`

payoff 事件：

- 出牌后若 `comboNode === 'burst'`，会发出 `PayoffTriggered`。
- 全场牌命中 `card.clear-burst` 规则后，会发出 `ClearBurstRequested` 和 `PayoffResolved`。
- `PayoffResolved` 会记录 `payoffArmed`、`affectedEnemyIds`、`killCount`、`preventedIntentDamage`、`intentDamageBefore`、`intentDamageAfter`。

含混处：

- `clearance_order` 是 2 费、`comboNode = burst`、`targets = front-row`。它会触发 `PayoffTriggered`，但不会触发 `card.clear-burst` 的全场 payoff 结算，也不能用授权支付。它更像“2 费 burst 路线段”，不是 3 费 payoff。
- `PayoffTriggered.enhanced` 当前由 `multiplier >= 3` 推导；`payoffArmed` 由授权支付状态决定。两者可能被玩家混淆：一个是链路倍率增强，一个是授权武装。
- 设计文档说“断链 payoff 仍可出，但是 unarmed，收益低”。当前代码允许普通 3 MP 支付 3 费 burst，但未 armed 的伤害公式没有降档；收益低主要来自倍率通常较低，而不是专门的 unarmed penalty。

## 目标、伤害与 self 资源

当前 ECA 规则按 `targets` 分流：

| target | 规则 | 效果 |
| --- | --- | --- |
| `front-enemy` | `card.damage.front-enemy` | 需要目标存活且在前排，对单体造成 `damage * effectMultiplier`。 |
| `front-row` | `card.damage.front-row` | 需要前排存在敌人，对 slot 0-4 的存活敌人造成 `damage * effectMultiplier`。 |
| `all-enemies` | `card.clear-burst` | 对所有存活敌人造成 `damage * effectMultiplier`，并结算 payoff。 |
| `self` | `card.self.resource` | 触发抽牌和/或当前 MP 增加。 |

资源牌细节：

- `drawCards` 会乘 `effectMultiplier`，所以顺链 self 抽牌会被倍率放大。
- `energyGain` 不乘倍率，当前始终按卡牌字段原值增加。
- `reorder` 当前没有命令实现。

## 敌意图机制

当前敌意图已实现为回合开始快照：

- 发牌时先快照当前前排敌人，随后生成 `EnemyIntentDeclared`。
- 只有快照中的前排存活敌人会在回合结束攻击。
- 意图字段包括 `enemyId`、`kind: 'attack'`、`amount`、`slot`、`description`、`willRefill`。
- `enemyIntentSummary` 汇总 `totalDamage` 与 `intentEnemyIds`。
- 杀死敌人后会刷新意图，因此 payoff 的 `preventedIntentDamage` 可以通过清掉有意图的敌人体现。
- 回合结束时逐个执行 `EnemyAttack`，并记录 `EnemyIntentResolved`。

敌人基础数据：

| 敌人 | hp | damage | xpReward |
| --- | ---: | ---: | ---: |
| `debt_wisp` | 10 | 2 | 1 |
| `redline_brute` | 22 | 5 | 2 |
| `pulse_collector` | 16 | 3 | 2 |

含混处：

- 敌意图现在只有 attack 类型，没有 buff、debuff、spawn、shield、move 等意图类型。
- `EnemyPressure`、`AutoAttack`、`DamageRequested` 这些事件类型存在于类型定义中，但当前指定运行时链路没有看到对应主路径触发。
- `willRefill` 固定为 true，更像 UI 说明，还不是一套可变敌行动系统。

## 奖励机制

当前奖励流程：

1. 敌人死亡触发 `EnemyKilled`。
2. ECA 规则 `enemy.death.reward` 发出 `GainXp`，数值来自敌人 `xpReward`。
3. XP 达到 `reward.xpThreshold` 且当前没有 pending reward 时，玩家升级，进入 `Reward` 状态。
4. 奖励选择由 `candidateCardPool.filter(exists).slice(0, pickCount)` 生成，当前 `pickCount = 3`。
5. 选择奖励后：
   - 记录 `RewardChosen`；
   - 清空奖励状态；
   - 丢弃当前手牌；
   - 压缩并补满敌人；
   - 推进回合并重新发牌；
   - 将选择卡加入 `deck` 和 `drawPile`；
   - 从 `candidateCardPool` 移除该卡。

初始奖励状态：

- `xpThreshold = 45`
- `level = 1`
- `pickCount = 3`
- `candidateCardPool = rewardCardPool`

含混处：

- 奖励三选一不是随机池，而是按 `rewardCardPool` 顺序取前 3 个仍存在的卡。
- `AddCardToDeck` 在重新发牌之后执行，因此刚选的奖励卡会进入 draw pile，但不会进入“刚发出的那手牌”。
- 设计文档提出 P1 奖励分支：资源 / 修补 / payoff，但当前奖励池没有显式分支字段，只有卡牌顺序。
- 没有 `Max MP +1` 奖励、遗物、属性面板或长期成长。

## 机制事件清单

### 输入意图

- `advance-time`
- `deal-hand`
- `play-card`
- `end-turn`
- `select-reward`
- `restart-run`

### 卡牌与链路事件

- `IntentReceived`
- `HandDealt`
- `CardPlayed`
- `CardPaymentRecorded`
- `ChainAdvanced`
- `ChainBroken`
- `ChainRepaired`
- `AuthorizationGranted`
- `PayoffTriggered`
- `ClearBurstRequested`
- `PayoffResolved`

### 敌人与战斗事件

- `EnemyIntentDeclared`
- `EnemyIntentResolved`
- `EnemyAttacked`
- `EnemyAdvanced`
- `EnemyPressure`
- `AutoAttack`
- `DamageRequested`
- `DamageApplied`
- `EnemyKilled`
- `EnemiesRepositioned`

其中 `EnemyPressure`、`AutoAttack`、`DamageRequested` 在类型中存在，但本次指定读取路径中未见核心流程触发。

### 进度与奖励事件

- `XpGained`
- `LevelUpReached`
- `RewardChoicesGenerated`
- `RewardChosen`
- `CardAddedToDeck`

### 回合与流程事件

- `TimeAdvanced`
- `TurnEnded`
- `RoundStarted`

## 当前分类含混处汇总

| 含混点 | 现状 | 风险 |
| --- | --- | --- |
| 2 费 `burst` 与 3 费 payoff 混用 | `clearance_order` 是 2 费 front-row + burst；3 费 payoff 也是 burst。 | `PayoffTriggered` 会覆盖非 3 费全场牌，玩家和 QA 难区分路线段与终结牌。 |
| `combo` 与 `chain` 双系统 | `combo` 由 ECA SetCombo 维护；真正授权由 `chain.playedCosts` 与 `multiplier` 决定。 | UI/文案若叫“combo”，可能误导玩家以为 combo 计数才是授权来源。 |
| `reorder` 只有标签 | `paper_shatter`、`lantern_captain` 标记 reorder，但没有运行时命令。 | 奖励牌描述承诺“重排路线”，实际只抽牌。 |
| Wild 修补没有独立资源字段 | Wild 用 expected cost 接链，只有 `ChainRepaired`。 | 设计文档中的 `repairReserve`、`GapRepaired`、repair source 尚未可观测。 |
| self 抽牌乘倍率但返费不乘 | `DrawCards` 使用 `drawCards * multiplier`；`GainEnergy` 不乘。 | 可能是设计选择，也可能是遗漏；需要明确资源牌倍率规则。 |
| unarmed payoff 没有专门降收益 | 3 MP 可普通支付，`payoffArmed=false` 会记录，但伤害不直接衰减。 | 设计上说“unarmed 收益低”，当前主要靠链路倍率间接体现。 |
| 奖励池分类靠顺序 | 三选一直接 slice 前 3。 | 不能保证资源 / 修补 / payoff 三分支，也不利于后续平衡。 |
| 基础牌和暂未开放牌无字段 | `blood_tithe`、`pulse_draw` 在卡表中但不在起手或奖励池。 | 内容状态不清：是禁用、储备、测试牌还是遗漏。 |

## 建议下一步只做定义澄清

不建议在当前盘点文档里直接改实现。下一步如果要继续，应先补一份最小命名合同：

- 明确 `comboNode` 是路线节点，还是包含 payoff 类型。
- 增加或文档化 `cardRole`: starter / bridge / support / repair / payoff / reward-only。
- 明确 `burst` 是否只保留给 3 费终结，2 费清场是否改为 `clearance` 或其他节点。
- 明确 `reorder` 暂未实现，或补对应事件/命令设计。
- 明确 self 牌的倍率规则：抽牌是否应乘倍率，返费是否应乘倍率。
- 将奖励池按资源、修补、payoff、路线补件分组，避免三选一只由数组顺序决定。
