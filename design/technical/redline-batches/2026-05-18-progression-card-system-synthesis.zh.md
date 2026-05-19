# Redline 体验层级、卡牌类型与当前机制总汇

日期：2026-05-18

目标：把“局外成长属性 / 单次冒险 / 单局战斗 / 单次循环发牌”四个体验层级拆清楚，同时盘点 Redline 当前已有卡牌类型、卡牌种类和所有核心机制，作为下一轮开发和验收的共同合同。

## 一句话结论

Redline 当前 P0 不应该继续往“完整局外成长”或“完整卡牌生态”扩。当前最该验证的是：

```text
玩家在一手牌里读懂敌意图 -> 按 0 -> 1 -> 2 接上清算链 -> 用 Wild / 抽牌 / 当前 MP 修补坏手牌 -> 获得本回合终局授权 -> 打出 armed payoff 清掉可见压力。
```

所以，P0 主战场是 **单次循环发牌** 和 **单局战斗**。  
单次冒险只需要轻量奖励感；局外成长只保留概念入口，不进入当前 demo 主验收。

## 资料来源

### 本仓库专家文档

- `2026-05-18-progression-layer-research-01.md`：局外成长 / run / 战斗 / 回合层级。
- `2026-05-18-card-type-taxonomy-research-02.md`：卡牌类型与机制 taxonomy。
- `2026-05-18-current-card-mechanics-inventory-03.md`：当前 16 张卡与 runtime 机制盘点。
- `2026-05-18-experience-boundary-review-04.md`：PM 体验边界和命名裁决。
- `2026-05-18-system-model-boundary-05.md`：最小数据模型边界。

### 公开竞品资料

- Slay the Spire 卡牌类型：Attack / Skill / Power / Status / Curse。来源：https://slay-the-spire.fandom.com/wiki/Cards
- Monster Train 卡牌与 run 内升级：卡牌是战斗主要交互，可在 run 中收集和升级，并区分 Unit / Spell 等类型。来源：https://monster-train.fandom.com/wiki/Cards
- Monster Train 官方定位：roguelike deck-building，强调卡牌、神器、卡牌升级和每次 run 策略差异。来源：https://www.themonstertrain.com/
- Hades Mirror of Night：局外资源购买永久能力，是 meta progression 的典型样例。来源：https://hades.fandom.com/wiki/Mirror_of_Night
- Vampire Survivors 官方 wiki：局内武器、被动、进化与局外 PowerUps / 解锁是不同层级。来源：https://vampire.survivors.wiki/
- Vampire Survivors Evolution：武器与被动满足条件后通过宝箱进化，适合作为“单次冒险内 build 成形”的参照。来源：https://vampire.survivors.wiki/w/Evolution
- Balatro Wiki：Jokers / Tarot / Planet / Spectral / Vouchers 等类型分别承担长期被动、一次性修改、手牌等级和 run 内规则变化。来源：https://balatrowiki.org/

## 四层体验边界

| 层级 | 推荐中文名 | 生命周期 | 玩家要回答的问题 | Redline 当前优先级 |
| --- | --- | --- | --- | --- |
| 局外成长属性 | 局外授权 / 账号成长 | 多次 run 之间保留 | “我下次开局长期变强在哪里？” | P2：只定义，不实现 |
| 单次冒险 | 本次清算 / run | 从开局到失败或通关 | “这次 build 正在成为什么路线？” | P1：轻量 3 场遭遇或奖励框架 |
| 单局战斗 | 当前遭遇 | 一场战斗内 | “这场如何活下来并拿奖励？” | P0：当前 demo 主容器 |
| 单次循环发牌 | 本回合 / 本手牌 | 发牌到结束回合 | “这一手先打哪张、缺口怎么补、何时 payoff？” | P0：最小爽点 |

### P0 验收什么

- 玩家看见当前 MP、手牌、敌人意图和结束回合后果。
- 玩家能按 `0 -> 1 -> 2` 完成清算链。
- 链路成立后获得本回合 `tempAuthorizationMP +3`。
- 临时授权只支付 `cost = 3` 且 `comboNode = burst` 的 payoff。
- Wild、抽牌、当前 MP 返还能修补坏手牌，但不改变永久最大 MP。
- payoff 的收益来自“链路倍率 + armed 授权 + 清掉敌意图”，而不是默认数值膨胀。

### P0 不验收什么

- 永久 `Max MP +1`。
- 账号等级、局外天赋、永久卡牌强化。
- 随机地图、完整商店、完整事件池。
- 完整诅咒经济、单位站场、复杂能力牌。
- 大而全的卡牌类型系统。

## 卡牌类型框架

Redline 不应只用一个 `type = attack` 解决问题。卡牌至少需要从四个角度被理解：

| 维度 | 问题 | 建议字段 |
| --- | --- | --- |
| 顶层类型 | 这张牌是什么规则大类？ | `cardType` |
| 链路角色 | 它在 `0 -> 1 -> 2 -> payoff` 中站哪一段？ | `chainRole` |
| 发牌循环角色 | 它抽到时是开链、找牌、修补、污染还是终结？ | `cycleRole` |
| 构筑角色 | 它为什么值得进 deck？ | `buildRole` |

P0 可以先不立刻改字段，但设计、奖励池和 HUD 文案要先按这个框架说话。

## 推荐分期

| 阶段 | 应纳入的卡牌类型 | 目的 |
| --- | --- | --- |
| P0 | 攻击牌、技能牌、资源牌、抽牌牌、修补牌、payoff 牌、状态牌 | 验证一手牌压力、断链修补、临时授权和清场 payoff |
| P1 | 能力牌、诅咒牌、轻量法术包装、run 内奖励牌 | 支持 run 内构筑路线和风险收益 |
| P2 | 单位牌、角色牌、事件牌、局外成长牌池 | 支持完整生态、站场、职业、地图和长期留存 |

### P0 类型定义

| 类型 | Redline 作用 | 典型行为 |
| --- | --- | --- |
| 攻击牌 | 处理前排压力，建立链路 | 单体 / 前排 / 全场伤害 |
| 技能牌 | 修补、抽牌、标记、降低风险 | 不以直接伤害为主 |
| 资源牌 | 产生当前 MP、临时授权或限制性资源 | 当前回合有效，不能误叫成长 |
| 抽牌牌 | 找下一环或找 payoff | 抽 1、过滤、检索 |
| 修补牌 | Wild、补 expected cost、救坏手牌 | 让缺 1 / 缺 2 不直接死局 |
| payoff 牌 | 条件大结算 | 完成链后高收益清场或取消意图 |
| 状态牌 | 战斗内污染手牌 | 敌人或代价塞入，通常不跨 run |

### P1 / P2 类型边界

| 类型 | 为什么不放 P0 |
| --- | --- |
| 能力牌 | 会引入战斗内持久规则，容易把 P0 从“手牌链路”拉成“被动堆叠”。 |
| 诅咒牌 | 需要跨战斗或奖励代价系统支撑；P0 若要坏牌，先用状态牌。 |
| 法术牌 | 作为顶层类型过于模糊；造成伤害就是攻击，抽牌修补就是技能。 |
| 单位牌 | 会引入站场、承伤、AI、死亡触发，改变核心体验。 |
| 角色牌 | 应定义开局身份和初始 deck，不应进入普通手牌循环。 |
| 事件牌 | 属于 run 地图或遭遇选择，不属于 P0 战斗手牌层。 |

## 当前 16 张卡牌归类

当前代码中的卡牌定义来自 `prototype-web/src/data/cards.ts`。

| 卡牌 | cost | 当前 target / node | 推荐 P0 类型 | 链路角色 | 机制备注 |
| --- | ---: | --- | --- | --- | --- |
| `debt_hook` | 0 | `front-enemy` / `hook` | 攻击牌 | starter | 起手 0 费开链。 |
| `blood_reclaim` | 0 | `front-enemy` / `reclaim` | 攻击牌 | starter | 奖励池 0 费补链。 |
| `blood_tithe` | 0 | `self` / `reclaim` | 抽牌牌 | starter / draw-fixer | 抽 1，当前不在奖励池。 |
| `spark_tap` | 0 | `front-enemy` / `spark` | 攻击牌 | starter | 奖励池 0 费 Spark 起手。 |
| `redline_cut` | 1 | `front-enemy` / `cut` | 攻击牌 | bridge | 起手 1 费承接。 |
| `heartbeat_spark` | 1 | `front-enemy` / `spark` | 攻击牌 | bridge | 起手/奖励 1 费承接。 |
| `verdict_mark` | 1 | `front-enemy` / `mark` | 攻击牌 / 标记技能 | bridge | 目前只有伤害，没有独立 mark 机制。 |
| `pulse_draw` | 1 | `self` / `spark` | 抽牌牌 | bridge / draw-fixer | 抽 1，当前不在奖励池。 |
| `row_cleave` | 2 | `front-row` / `cut` | 攻击牌 | expand | 起手 2 费授权段。 |
| `clearance_order` | 2 | `front-row` / `burst` | 攻击牌 / 路线段 | expand | 2 费 burst 路线段，不是 3 费 payoff。 |
| `paper_shatter` | 2 | `self` / `mark` | 抽牌牌 / 支援牌 | expand / draw-fixer | 抽 1；`reorder` 目前没有 runtime。 |
| `severance_burst` | 3 | `all-enemies` / `burst` | payoff 牌 | payoff | 3 费全场终结。 |
| `red_ledger_burst` | 3 | `all-enemies` / `burst` | payoff 牌 | payoff | 3 费全场终结。 |
| `wild_mana_stitch` | 0 | `self` / `reclaim` | 修补牌 / 资源牌 / 抽牌牌 | repair | Wild、抽 1、当前 MP +1；不是 Max MP 成长。 |
| `wild_gap_key` | 1 | `front-enemy` / `hook` | 修补牌 / 攻击牌 | repair | Wild 低伤害补位。 |
| `lantern_captain` | 2 | `self` / `mark` | 抽牌牌 / 角色风味支援 | expand / draw-fixer | 抽 1；`reorder` 目前没有 runtime。 |

## 当前卡牌池状态

### 起手牌

```text
debt_hook
heartbeat_spark
redline_cut
row_cleave
```

这组牌保证第一手能看见 `0 -> 1 -> 2` 的教学链，但默认没有 3 费 payoff，所以第一回合可以获得授权，却未必能立刻消费授权。

### 奖励池

```text
wild_mana_stitch
severance_burst
wild_gap_key
paper_shatter
lantern_captain
red_ledger_burst
spark_tap
blood_reclaim
heartbeat_spark
verdict_mark
clearance_order
```

当前奖励三选一是从 `rewardCardPool` 顺序取前 3 个可用项，不是随机，也没有显式保证“资源 / 修补 / payoff”三类分支。

### 不在奖励池的卡

```text
debt_hook
blood_tithe
redline_cut
row_cleave
pulse_draw
```

这些牌目前更像基础牌、教学牌或暂未开放测试牌，但代码没有字段标注其内容状态。

## 当前已实现机制清单

### 资源机制

| 机制 | 当前实现 | 边界 |
| --- | --- | --- |
| 当前 MP | `energy`，开回合重置为 `maxEnergy` | 本回合资源 |
| 最大 MP | `maxEnergy = 3` | 当前没有任何卡永久提高它 |
| 当前 MP 返还 | `energyGain`，如 `wild_mana_stitch +1` | 只影响当前回合 |
| 临时授权 MP | `tempAuthorizationMP` | 完成链后本回合获得 |
| 授权限制 | `authorizationRestriction = 'payoff-only'` | 只支付 3 费 burst payoff |

关键裁决：P0 中任何 `energyGain`、`tempAuthorizationMP` 都不能叫“成长”或“最大 MP 提升”。

### 清算链机制

| 字段 | 含义 |
| --- | --- |
| `playedCosts` | 当前回合链路费用序列 |
| `lastCost` | 上一张链路费用 |
| `nextExpectedCost` | 下一张期望费用 |
| `multiplier` | 当前效果倍率 |
| `broken` | 当前链是否断裂 |
| `breakReason` | 断链原因 |
| `repairedThisTurn` | 本回合是否用 Wild 修补 |

当前规则：

- 第一张按 `playedCost = 0` 才算开链。
- 后续按 `nextExpectedCost` 才算接链。
- 接链后倍率递增。
- 不符合 expected cost 会断链，倍率回到 1。
- Wild 在链未断时按 expected cost 记录链路，但支付仍按印刷 cost。

### 授权与 payoff 机制

当前 P0 已经完成的核心规则：

```text
基础 maxEnergy = 3
完成 0 -> 1 -> 2
获得 tempAuthorizationMP +3
授权只支付 cost = 3 && comboNode = burst
支付后触发 armed payoff 的清场与意图收益
回合结束清空未使用授权
```

当前真实 3 费 payoff：

- `severance_burst`
- `red_ledger_burst`

需要澄清的点：

- `clearance_order` 是 2 费 `comboNode = burst`，更像路线段，不应被玩家理解为 3 费 payoff。
- `PayoffTriggered` 与 `PayoffResolved` 不完全等价。前者可能被 2 费 burst 触发，后者才对应全场 payoff 结算。
- unarmed payoff 目前可用普通 3 MP 打出，低收益主要来自倍率不足，而不是单独伤害惩罚。

### 目标与伤害机制

| target | 当前效果 |
| --- | --- |
| `front-enemy` | 对指定前排单体造成 `damage * multiplier`。 |
| `front-row` | 对前排 slot 0-4 存活敌人造成 `damage * multiplier`。 |
| `all-enemies` | 对所有存活敌人造成 `damage * multiplier`，并走 payoff 结算。 |
| `self` | 触发抽牌、当前 MP 增加等自身资源效果。 |

当前 self 牌规则：

- `drawCards` 会乘 chain multiplier。
- `energyGain` 不乘 multiplier。
- `reorder` 只是标签和描述，还没有运行时效果。

### 敌人意图机制

当前敌意图已经能支持 P0 体验：

- 发牌时快照当前前排敌人。
- 玩家回合可见每个攻击敌人的 `kind / amount / slot / description`。
- `enemyIntentSummary.totalDamage` 汇总结束回合伤害。
- 清掉有意图的敌人后，可以通过 payoff 记录 prevented intent damage。
- 当前敌意图只有 attack，没有 buff、debuff、spawn、shield、move。

当前敌人定义：

| 敌人 | HP | 攻击 | XP |
| --- | ---: | ---: | ---: |
| `debt_wisp` | 10 | 2 | 1 |
| `redline_brute` | 22 | 5 | 2 |
| `pulse_collector` | 16 | 3 | 2 |

### 奖励机制

当前流程：

1. 敌人死亡获得 XP。
2. XP 达到阈值时进入 `Reward`。
3. 生成 3 个候选卡牌。
4. 选择后加入 deck / draw pile。
5. 清空奖励状态、进入下一轮发牌。

当前限制：

- `xpThreshold = 45`。
- 候选项不是随机，而是从奖励池顺序 `slice(0, 3)`。
- 没有显式奖励类型字段。
- 没有遗物、商店、局外解锁、Max MP +1 奖励。

## 最小数据模型边界

| 层级 | 应拥有的字段 | 不应拥有的字段 |
| --- | --- | --- |
| `CardDefinition` | `id/name/cost/verb/damage/comboNode/targets/drawCards/energyGain/utilities/description` | 是否已解锁、当前支付方式、是否 armed、run 内强化 |
| `TurnState / DealLoopState` | hand、draw pile、discard pile、current MP、temp authorization、chain、enemy intents | 账号等级、永久卡池、地图路线 |
| `BattleState` | tick、round、FSM、敌人实例、玩家当前 HP、debug trace | 账号永久成长、静态 card catalog |
| `RunState` | deck、XP、level、reward pool、reward choices、reward history | 当前回合 chain、敌人 HP、永久解锁 |
| `AccountProfile` | permanent unlocks、meta currency、settings、profile stats | P0 当前不进入 demo |

P0 可以不立刻拆代码结构，但文档、字段命名和后续 worker 任务必须按这个边界说话。

## 当前主要含混点

| 含混点 | 现状 | 影响 | 建议 |
| --- | --- | --- | --- |
| `comboNode = burst` 同时代表 2 费路线段和 3 费终结 | `clearance_order` 与 3 费 payoff 都是 burst | 玩家和 QA 难区分路线段 / 终结牌 | 增加 `payoffType` 或 `chainRole`，避免只靠 `comboNode` 推断 |
| `reorder` 无运行时 | 两张 self 牌描述重排，但只抽牌 | 卡牌承诺和实际效果不一致 | P0 要么隐藏文案，要么补最小重排机制 |
| Wild 修补没有独立资源字段 | 只有 `ChainRepaired` | 难解释 repair source、repair amount | P1 增加 `repairReserve` 或 `GapRepaired` 事件 |
| 奖励池靠顺序 | 三选一不是类型分支 | 奖励体验不可控 | 按 resource / repair / payoff / route 分组 |
| self 抽牌乘倍率，返费不乘 | 代码已这样实现 | 可能被误解为 bug | 在规则文案中显式说明 |
| unarmed payoff 没有专门降收益 | 普通 3 MP 可支付 3 费 payoff | “未武装低收益”不够可见 | 后续补 unarmed 伤害降档或 HUD 警告 |
| 基础牌 / 未开放牌无字段 | 只能靠起手和奖励池推断 | 内容状态不清 | 加 `availability` 或文档表维护 |

## 下一轮开发建议

### 先做

1. 给现有 16 张卡补设计层分类表：`cardType / chainRole / cycleRole / buildRole`。
2. HUD 文案统一使用“本回合授权”“当前 MP”“终局授权”，避免“成长”“升级”“最大 MP 提升”混用。
3. 把 `clearance_order` 从“payoff”认知中摘出来，明确它是 2 费展开段。
4. 处理 `reorder`：如果 P0 不做，就从卡面文案中降级；如果要做，就补可验收的最小效果。
5. 奖励池改成至少三类可控分支：修补 / payoff / 路线补件。

### 暂缓

1. 永久 Max MP 成长。
2. 完整局外成长面板。
3. 单位牌、角色牌、事件牌。
4. 大量诅咒牌。
5. 完整随机地图与商店。

## 验收口径

下一轮开发结束时，建议用这 4 条验收：

1. 玩家能在 3 秒内从 HUD 看懂当前意图伤害、当前 MP、下一张期望 cost。
2. 玩家能通过 `0 -> 1 -> 2` 获得本回合 `payoff-only` 终局授权。
3. 玩家能看懂 Wild / draw / mana 是“本回合修补”，不是“局外成长”。
4. 奖励三选一至少能表达“修补稳定性 / payoff 天花板 / 路线补件”三种方向。

如果这 4 条没有成立，不要继续扩局外成长、单位牌或完整 run 地图。
