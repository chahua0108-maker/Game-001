# 2026-05-18 Round 01-07 数值与压力曲线分析

角色：第 1 轮专家 07，数值与压力曲线分析师  
范围：只读审查当前卡牌费用、授权/最大授权、敌人伤害、奖励、runModifiers、ECA payoff。  
源码边界：未修改源码。本文件只提出参数与验收建议。

## 1. 当前资源 / 伤害 / 奖励数值速读

### 资源与回合

- 玩家初始 `HP = 60`，`maxEnergy = 3`，每次发牌时当前 `energy` 回满到 3。
- 手牌数 `HAND_SIZE = 4`，起始牌组也是 4 张：`debt_hook`、`heartbeat_spark`、`redline_cut`、`row_cleave`。第一回合等于固定教学手牌，不是随机抽牌压力。
- 基础最大 MP 当前不成长。完成未断裂的 `0 -> 1 -> 2` 后，获得 `tempAuthorizationMP += 3`，限制为 `payoff-only`，只允许支付 `cost = 3` 且 `targets = all-enemies` 且 `comboNode = burst` 的终结牌。
- 临时授权离开 `PlayerTurn` 会清空。它是本回合授权，不是最大 MP 成长。
- `runModifiers` 目前是 `preview-only`：`maxEnergyThisRunPlusOne`、`rewardRerollPlusOne`、`startingRepairCard` 都不会实际接入战斗 runtime。

### 卡牌伤害与费用

| 段位 | 当前牌 | 速读 |
| --- | --- | --- |
| 0 MP | `debt_hook` 4 单体；`blood_reclaim` 3 单体；`spark_tap` 2 单体；`blood_tithe` 抽 1 | 起链成本低，主要是打开倍率，不负责解决压力。 |
| 1 MP | `redline_cut` 9 单体；`heartbeat_spark` 6 单体；`verdict_mark` 5 单体；`pulse_draw` 抽 1 | `redline_cut` 在 x2 时为 18，是当前最强桥牌。 |
| 2 MP | `row_cleave` 5 前排；`clearance_order` 7 前排；`paper_shatter` / `lantern_captain` 抽 1 | 正确链路下 `row_cleave` x3 = 前排 15，`clearance_order` x3 = 前排 21。2 费段已经接近 mini-payoff。 |
| 3 MP | `severance_burst` 16 全场；`red_ledger_burst` 12 全场 | 未武装 x1 也过强：`severance_burst` 能直接杀 10 HP 与 16 HP 敌型，约清当前阵型 10/15。 |

倍率规则很直接：费用链首张 x1，第二张 x2，第三张 x3，第四张 x4。ECA 伤害统一按 `card.damage * effectMultiplier`，多目标牌没有额外衰减。

典型第一回合 `debt_hook -> redline_cut -> row_cleave`：

- `debt_hook` x1 打 4。
- `redline_cut` x2 打 18。
- `row_cleave` x3 对前排全体打 15。
- 对初始前排 `[10, 22, 16, 10, 22]`，通常会杀 3 个左右，剩下约 1 HP collector 与 7 HP brute，敌意图约从 17 降到 8。

典型 `clearance_order` 替换 `row_cleave`：

- x3 前排 21，基本是前排准清场，只对未被单点补过的 22 HP brute 留 1。

### 敌人与伤害

敌人定义循环铺满 15 格：

| 敌人 | HP | 伤害 | XP | 备注 |
| --- | ---: | ---: | ---: | --- |
| `debt_wisp` | 10 | 2 | 1 | 低血低压。 |
| `redline_brute` | 22 | 5 | 2 | 高血高压，是当前优先目标。 |
| `pulse_collector` | 16 | 3 | 2 | 中血中压。 |

初始前排为 `wisp / brute / collector / wisp / brute`，结束回合总意图是 `2 + 5 + 3 + 2 + 5 = 17`。玩家不处理压力时，60 HP 大约第 4 次结束回合死亡。

注意：`speed`、`z`、`EnemyPressure`、`AutoAttack`、`AdvanceEnemy` 类型存在，但当前主路径没有实时推进压力。`advance-time` 只负责时钟和开局自动发牌，测试还明确断言不会触发实时伤害。

### 奖励与成长

- 敌人 XP 为 1/2/2 循环。整屏 15 个敌人大约 25 XP。
- 初始 `reward.xpThreshold = 45`，明显高于一整屏敌人的总 XP；3-5 回合 demo 基本不会自然看到奖励。
- runtime 内部的 `LEVEL_XP_THRESHOLDS = [0, 18, 42, 78, 125, 185]`，但初始世界没有用 18，而是写死 45。第一次升级后会把下一阈值设成 42，存在阈值回退风险。
- 当前奖励选择已经按分支取样，优先覆盖 `repair-resource / payoff / route-bridge`。默认池大概率给出 `wild_mana_stitch`、`severance_burst`、`paper_shatter` 这一类结构。
- 选择奖励后，runtime 先推进并发下一手，再把奖励牌加入 deck / drawPile。因此奖励不会进入刚刚发出的下一手牌，反馈会延迟。

### ECA payoff

- `front-enemy`、`front-row`、`all-enemies` 都直接吃链路倍率。
- `self` 资源牌的 `drawCards` 会乘倍率，`energyGain` 不乘倍率。
- 3 费全场牌会触发 `ClearBurst` 和 `ResolvePayoff`，并记录 `preventedIntentDamage`。
- 当前没有“未武装 payoff 降收益”规则。`payoffArmed = false` 只被记录，不会改变伤害公式。

## 2. 压力不足或错位的原因

### 原因 A：压力只在 End Turn 爆发，`advance-time` 不制造战斗压力

主循环每帧都推 `advance-time`，但 runtime 现在刻意让它没有实时战斗副作用。这对于卡牌游戏可以成立，但当前表现层和旧 90 秒验收里还残留“实时心跳压力”的影子。结果是：玩家只要不点 End Turn，就没有生命压力；压力从“持续逼迫决策”变成“按钮结算惩罚”。

建议不要马上恢复 realtime 伤害。更像卡牌游戏的做法是承认它是回合制意图压力：把所有压力都清楚地压在 `敌意图 -> 结束回合后果 -> 本回合如何减少意图` 上。

### 原因 B：低段链路已经能救场，但 3 费未武装 payoff 抢走核心

`0 -> 1 -> 2` 的数值其实是健康的：正确链能杀 2-4 个前排，减少约一半意图，但不会自动全清。问题在 3 费全场牌：

- `severance_burst` x1 就能杀 wisp 和 collector。
- `red_ledger_burst` x1 至少清 wisp，并大量压低 collector。
- armed x4 时两张牌都严重过杀。

这会让玩家学到“抽到 3 费全场牌就解决”，而不是“先处理资源链，再把 payoff 武装起来”。

### 原因 C：奖励来得太晚，不能承担资源压力修复

45 XP 阈值让奖励不参与 3-5 回合体验。当前短切片里，玩家看不到“我压力没处理好，所以选修补/抽牌/终结”的卡牌成长闭环。奖励系统存在，但它的位置在压力曲线之外。

### 原因 D：runModifiers 是好概念，但当前不会改变压力曲线

`maxEnergyThisRunPlusOne`、`rewardRerollPlusOne`、`startingRepairCard` 都是 preview-only。它们能描述未来单局成长，但当前没有一个会改变真实手牌、MP、奖励或敌人压力。压力曲线因此只有初始 3 MP + 本回合临时授权，缺少“单局内资源逐步松动 / 敌人逐步收紧”的对抗。

### 原因 E：起手太像费用排序题

固定 `0/1/1/2` 第一手很好教学，但它几乎不制造抽牌风险。玩家压力不是来自“我这手牌是否能修好”，而是来自“我是否按 0、1、2 顺序点”。这更像规则考试，不像卡牌游戏的资源压力。

### 原因 F：敌人压力没有随轮次、节点或敌型意图分化

当前敌人只有攻击意图，且初始前排总伤害固定 17。清场后补位敌人不会当回合攻击，这是正确的意图语义，但也意味着压力主要来自第一排静态 HP/伤害表，没有节点压力、精英压力、debuff 压力或奖励后反压。

## 3. 建议的 3 条压力曲线

### 曲线 1：回合制敌意图压力曲线

目标：把 Redline 明确做成卡牌游戏式“看见后果，然后用资源减少后果”。

建议节奏：

| 阶段 | 目标压力 | 玩家问题 |
| --- | --- | --- |
| Turn 1 | 初始意图 17，正确链后剩 7-10 | 我是否先按 `0 -> 1 -> 2` 解决本回合伤害？ |
| Turn 2 | 断链或缺段后意图仍有 12-17 | 我是打低倍率保命，还是留资源找修补？ |
| Turn 3 | 出现 repair/draw，意图维持 15-20 | 我能否用 Wild/抽牌把坏手牌接回链？ |
| Turn 4 | 高压窗口，意图 18-24 | 我能否 armed payoff，阻止一次明显失败？ |
| Turn 5 | 奖励回应刚才问题 | 我选修补、路线还是 payoff 来改变后续压力？ |

这条曲线的核心指标不是击杀数，而是 `intentBeforeEndTurn - resolvedDamage`。卡牌强度要服务于“少掉多少 HP”，而不是单纯清多少怪。

### 曲线 2：资源授权压力曲线

目标：让 3 MP 不是“限制玩家”，而是“迫使玩家证明链路，然后获得本回合授权”。

建议节奏：

- 基础 `maxEnergy` 保持 3，不用永久 6 MP 解释 `0 -> 1 -> 2 -> 3`。
- `0 -> 1 -> 2` 成功后给 `tempAuthorizationMP = 3`，只支付 3 费 payoff。
- 未武装 payoff 可以打，但必须低收益，不能全屏清怪。
- armed payoff 必须明显降低敌意图或清除高压目标。
- `maxEnergyThisRun +1` 只作为 P1 单局 modifier，在奖励或节点结算后出现，不参与 P0 payoff 合法性解释。

这条曲线让资源压力变成三问：是否起链、是否接到 2、是否把授权用在正确 payoff 上。

### 曲线 3：奖励 / 牌组修补压力曲线

目标：让奖励在压力曲线中出现，而不是在 demo 之外出现。

建议节奏：

- 首奖阈值改到 8-12 XP，使 3-5 回合内自然触发。
- 奖励三选一固定覆盖：修补资源、payoff、路线桥接。
- 奖励牌应在下一回合或下一次 draw 可见，避免“选了但没有影响”。
- 第二次奖励阈值必须大于当前 XP，不能出现 45 后退到 42 的节奏反常。
- run modifier 如果接入，应只从奖励/节点结算来，形成“敌人变紧，玩家资源也微松”的单局曲线。

这条曲线负责让玩家感到：压力不是一次性数值墙，而是牌组和资源逐渐回应问题。

## 4. 最小可测参数改动

以下是建议参数探针，不要求一次全改。优先做 A/B 小测试。

### Probe A：压低未武装全场 payoff

目的：避免 3 费全场牌 x1 抢走链路价值。

最小参数：

- `severance_burst.damage`: `16 -> 8`
- `red_ledger_burst.damage`: `12 -> 6 或 7`
- `row_cleave.damage`: 暂时保持 5
- `clearance_order.damage`: 暂时保持 7

预期：

- 未武装 `severance_burst` x1 不应击杀 10 HP wisp。
- armed x4 仍可造成 32 / 24-28 全场伤害，足够作为真正终结。
- 2 费 `clearance_order` 保持 mini-payoff 地位，负责前排准清场。

### Probe B：把首奖放进 3-5 回合窗口

目的：让奖励参与压力曲线。

最小参数：

- `reward.xpThreshold`: `45 -> 10 或 12`
- `LEVEL_XP_THRESHOLDS`: 建议改成单调表，例如 `[0, 10, 24, 45, 72, 110]`

预期：

- 正确链路清两轮前排后能自然触发首奖。
- 首奖后下一阈值必须大于当前 XP。
- 奖励仍保持 `repair-resource / payoff / route-bridge` 三分支。

### Probe C：轻微提高中型敌压力，而不是直接砍玩家 HP

目的：让正确链救场更有意义，同时避免空过过早死亡。

最小参数：

- `pulse_collector.damage`: `3 -> 4`
- `debt_wisp.damage`: 暂时保持 2
- `redline_brute.damage`: 暂时保持 5

初始前排总意图从 17 变为 18，空过仍大约第 4 次结束回合死亡；正确链后通常剩 9 左右，差异更清楚。

如果 Probe A 后压力反而过高，先不要动敌人伤害，优先用奖励阈值和修补牌可见性调节。

### Probe D：把 reward 反馈延迟列为参数风险

这一步可能需要实现顺序调整，但测试目标可以先定：

- 选择奖励后，下一手或下一次 draw 必须看到被选牌。
- 如果暂时不改发牌顺序，至少固定下一次 draw pile 顶部为奖励牌。

目的不是增强玩家，而是让奖励成为压力曲线的一部分。

## 5. 验收指标

### 核心压力指标

- 空过压力：默认世界连续结束回合，不出牌，3 次后玩家 HP 应在 6-15 区间，4 次内应失败或接近失败。
- 正确链救场：`0 -> 1 -> 2` 后，本回合 `enemyIntentSummary.totalDamage` 应从 17/18 降到 7-10。
- 断链惩罚：乱序同等张数的总伤害应低于正确链 70%，且不能获得 `AuthorizationGranted`。
- HP 保存：正确链结束回合相对空过至少保存 7 HP；armed payoff 至少保存 12 HP 或清除全部当前意图。

### payoff 指标

- 未武装 3 费全场牌 x1 不应清掉大多数阵型；建议击杀数 0-2，`preventedIntentDamage <= 5`。
- armed payoff 应明显变强；建议击杀数 >= 5 或 `preventedIntentDamage >= 12`。
- `payoffArmed=false` 与 `payoffArmed=true` 必须在伤害后果上可区分，不能只是事件字段不同。

### 奖励指标

- 默认阈值下，3-5 回合内至少自然触发一次 Reward。
- 首奖后下一阈值必须大于当前 XP。
- 奖励三选一必须覆盖修补资源、payoff、路线桥接三类。
- 选择奖励后，下一回合或下一次 draw 必须能看到该牌进入可操作资源。

### run modifier 指标

- preview-only 状态下，任何 modifier 都不得改变真实 `player.maxEnergy`、手牌或支付规则。
- 若后续接入 runtime，modifier 只能由奖励/节点结算触发，重开 run 后清空。
- `maxEnergyThisRunPlusOne` 不能被用来解释 P0 的本回合 3 费 payoff；P0 payoff 仍应由临时授权解释。

### 可观测性指标

- 每个验收回合记录：`costSequence`、`multipliers`、`chainBreakReason`、`tempAuthorizationMP`、`payoffArmed`、`intentBeforeEndTurn`、`resolvedDamage`、`preventedIntentDamage`、`rewardChoices`。
- HUD 和测试都以 `enemyIntentSummary` 作为敌意图真相源，不能由各自重新按当前前排估算。
- `advance-time` 若继续无战斗副作用，验收文案必须叫“回合制意图压力”，不要再用 90 秒实时压力作为成功标准。

## 结论

当前压力不是完全不足，而是位置错了：基础前排意图已经有杀伤，正确 `0 -> 1 -> 2` 也能救场；真正破坏卡牌压力曲线的是未武装 3 费全场牌过强、奖励太晚、run modifier 不接入，以及第一手过于固定。

下一步最小方向：先削弱未武装 payoff、把首奖放进 3-5 回合、用敌意图减少量验收正确链。这样 Redline 会更像卡牌游戏里的资源压力，而不是一个费用排序题加一次全屏清场。
