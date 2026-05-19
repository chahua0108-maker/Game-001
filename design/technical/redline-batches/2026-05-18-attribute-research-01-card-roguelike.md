# Redline Attribute Research 01 - Card Roguelike Resource Systems

日期：2026-05-18  
方向：传统卡牌 roguelike / deckbuilder  
范围：只做竞品机制调研和 Redline 设计启发，不改代码。

## 1. 调研对象和资料来源

本轮重点看资源上限、回合启动资源、临时资源和成长代价之间的关系。Redline 当前上下文来自本仓库已有文档：`2026-05-18-batch-h1-card-chain-design.md` 指出当前 `maxEnergy = 3` 时自然 `0 + 1 + 2 + 3` 不可达；`2026-05-18-expert-lens-05-balance-progression.md` 也指出当前 3 MP 只稳定支撑 `0 -> 1 -> 2`，3 费 payoff 需要可解释的资源规则。

资料来源：

- Slay the Spire: [Energy](https://slay-the-spire.fandom.com/wiki/Energy), [Combat Mechanics](https://slay-the-spire.fandom.com/wiki/Combat_Mechanics), [Ice Cream](https://slay-the-spire.fandom.com/wiki/Ice_Cream), [Chemical X](https://slay-the-spire.fandom.com/wiki/Chemical_X)
- Monster Train: [Ember](https://monster-train.fandom.com/wiki/Ember), [Battle](https://monster-train.fandom.com/wiki/Battle), [Artifacts](https://monster-train.fandom.com/wiki/Artifacts), [Merchants](https://monster-train.fandom.com/wiki/Merchants)
- Wildfrost: [Getting Started](https://wildfrostwiki.com/Getting_Started), [Bells](https://wildfrostwiki.com/Bells), [Crowns](https://wildfrostwiki.com/Crowns)
- Dicey Dungeons: [Warrior](https://diceydungeons.fandom.com/wiki/Warrior), [Robot](https://diceydungeons.fandom.com/wiki/Robot), [Equipment](https://diceydungeons.fandom.com/wiki/Equipment), [Duplicate](https://diceydungeons.fandom.com/wiki/Duplicate)
- Roguebook: [Talents](https://roguebook.fandom.com/wiki/Talents), [Gems](https://roguebook.fandom.com/wiki/Gems), [Treasures JP Wiki](https://gamers.wariichi.com/roguebook/wiki/treasures/), [GameSpew review](https://www.gamespew.com/2021/06/roguebook-review/), [Geek to Geek overview](https://geektogeekmedia.com/geekery/roguebook-a-roguelike-deckbuilding-videogame/), [Steam page](https://store.steampowered.com/app/1076200/Roguebook/)

## 2. 竞品机制摘要

### Slay the Spire

1. 基础回合结构是抽 5 张、获得 3 点 Energy；未用完的 Energy 通常在回合结束后流失。
2. 长期 Energy 增长主要来自 Boss Relic，但几乎都带硬代价：不能休息、开箱给诅咒、不能获得金币、敌人加力量、看不到意图、卡牌奖励少选项等。
3. 资源提升不只等于最大能量：`Ice Cream` 把未用 Energy 延后到下回合，改变的是跨回合预算；`Chemical X` 让 X 费牌按额外投入结算，改变的是高费牌解释方式。
4. 临时能量常由卡牌条件触发，例如弃牌、杀敌、退出姿态、抽到特定状态、消耗牌等；这些把资源和打法绑定，而不是给静态数值。
5. 最值得参考的是“资源奖励必须有行为代价”：玩家拿到更高回合预算的同时，也改变路线风险和后续构筑压力。

### Monster Train

1. 基础 Ember 是每回合恢复的出牌资源，起始 3 点；牌可给临时 Ember，也可给本场战斗后续回合的 Ember。
2. 大 Boss 后的 Major Enhancement 把成长拆成三选一：每回合 +1 Ember、每回合 +1 Draw、每层 +1 Capacity；这是资源上限、抽牌、场面容量之间的同级选择。
3. 抽牌基础为每回合 5 张，手牌上限为 10；Champion 起手在手牌，Banner Unit 有优先抽机制，保证构筑核心不会完全随机失联。
4. 商店升级能稳定提供 `Emberstone: -1 Ember`，说明“降低成本”是另一种提升实际资源上限的方式。
5. 它的关键启发不是火车三层，而是把“更能打长回合”和“更能铺场/更能找牌”做成互斥成长。

### Wildfrost

1. Wildfrost 基本没有传统 MP/Energy；资源核心是每回合通常只能打 1 张牌，以及是否愿意花一回合敲 Redraw Bell。
2. 起手抽 6 张；Redraw Bell 若 4 回合不用会充能，之后可免费重抽。Sun Bell of the Bell 把充能计数从 4 降到 3，等于提升循环速度。
3. Sun Bell of Hands 让每次抽手牌从 6 变 7；Sun Bell of Fellowship 增加同伴限制和 Charm 限制；Sun Bell of Charge 让战斗开始时 Redraw Bell 已充能。
4. Crown 可以让卡牌随 Leader 在战斗开始时部署，先于开局抽牌；这是一种“回合 0 启动资源”，不是传统抽牌或 MP。
5. 最值得参考的是：即使没有能量，也可以通过“每回合行动数、起手部署、重抽频率、手牌数量”制造资源成长。

### Dicey Dungeons

1. Dicey Dungeons 的“能量”不是点数，而是每回合可用骰子数量、骰子点数和装备槽要求。
2. Warrior 等角色通过升级提高骰子数量，例：Warrior 从 2 骰成长到 5 骰；这相当于最大行动资源的成长，但表现为更多骰子而不是更多 mana。
3. Robot 用 CPU 上限替代骰子数量：计算骰子会推进 CPU，正好命中上限得 Jackpot，超过则本回合装备消失到下回合；上限从 9 成长到 15。
4. 装备可复制、拆分、翻转、重掷骰子，例如 Duplicate、Counterfeit、Bumpblade、Hall of Mirrors 等；这些是“临时资源生成”，但必须占装备槽或满足骰子点数。
5. 它的启发是“最大资源可以是风险边界”：上限越高，玩家可操作空间越大，但也需要管理爆掉、空转、槽位不足。

### Roguebook

1. Roguebook 是较传统的能量/抽牌式 deckbuilder：每回合有限 Energy，卡牌有 Energy cost；回合抽牌、敌人意图和双英雄站位共同决定出牌路线。
2. 它鼓励变厚牌组：每加入起始 10 张之外的 4 张牌，就能解锁一层 Talent 三选一，用 Talent 抵消一致性下降。
3. Talent 里有多种资源触发：开战 +1 Energy 并抽牌、无手牌时抽牌、激怒时 +1 Energy 并抽牌、每回合首次打 2 费以上牌返 1 Energy 等。
4. Gem 和 Treasure 会把资源写进具体牌或全局条件：卡牌可有最多 2 个 Gem socket；宝物里存在跨回合蓄能、每回合额外抽牌、杀敌给能量和抽牌、Faeria Orb 逐级提高战斗回合能量等。
5. 最值得参考的是“构筑变厚也能成为成长条件”，但这只适合中长期 roguelike，不适合 Redline 当前 3-5 回合样片直接照搬。

## 3. 资源/属性维度表

| 游戏 | 最大能量/魔法 | 当前能量 | 临时能量 | 抽牌 | 手牌上限 | 回合启动资源 | 成长来源 | 代价 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Slay the Spire | 基础 3 Energy；Relic、Power、特定机制可增加每回合获得量 | 每回合获得，通常回合末清空 | 卡牌、药水、姿态、击杀、弃牌、消耗等触发 | 基础抽 5；大量卡牌/Relic 额外抽 | 通常 10 | 抽 5 + 3 Energy + 起始 Relic/Power | Boss Relic、卡牌升级、Power、普通/稀有 Relic | +1 Energy 常绑定强负面，如不能休息/金币/药水、敌人更强、看不到意图 |
| Monster Train | 基础 3 Ember；+1 Ember、+1 Draw、+1 Capacity 是同级成长选项 | 每回合恢复；默认不强调跨回合保留 | Pyre Chomper、Engine Upgrade、Artifact 等给临时或战斗内持续 Ember | 基础抽 5；Artifact/Enhancement/牌增加 | 10 | 起手 Champion、每回合抽牌、Banner Unit 优先抽 | Major Enhancement、Artifact、商店 -1 费、容量成长 | 资源成长互斥：拿 Ember 就少拿 Draw/Capacity；商店升级占金币和升级槽 |
| Wildfrost | 无传统 MP；上限更像“每回合 1 次行动 + 重抽/起手/同伴容量” | 每回合通常打 1 张牌；Redraw Bell 可花回合重抽 | 特定 Bell、Charm、Crown、关键词能突破节奏 | 起手/重抽 6；Sun Bell 可变 7 或更快重抽 | 不作为核心资源公开竞争 | 领袖、Crown 牌先部署、起手 6 张、Redraw Bell 计数 | Boss 后 Sun Bell/Charm/Crown、商店 Crown、挑战 Bell | 资源提升常和另一个奖励互斥；手动重抽消耗回合；Cursed/Storm Bell 带负面规则 |
| Dicey Dungeons | 无 MP；骰子数量或 Robot CPU 是上限 | 每回合骰子/CPU 预算，装备槽消耗骰子 | Duplicate、Split、Bump、Hall of Mirrors、Jackpot 等 | 非传统抽牌，核心是装备负载和可用骰子 | 不适用，受装备栏和槽要求限制 | 每回合掷/计算骰子；角色技能可改骰 | 升级给额外骰子/CPU、装备、升级装备 | 点数随机、槽位要求、Countdown、Robot 爆 CPU 后装备消失 |
| Roguebook | 每回合 Energy 池；Faeria Orb、Talent、Treasure 可提高启动或持续 Energy | 每回合刷新使用；有宝物支持跨回合蓄能 | Talent/宝物/卡牌条件给 Energy 或降费 | 每回合抽牌；Talent/Treasure/Gem 提升抽牌和找牌 | 本轮未确认硬上限，资料重点在抽牌和能量 | 双英雄卡组、抽牌、起始宝物/Talent/Gem | 加卡解锁 Talent、Gem socket、Treasure、Faeria Orb | 牌组变厚降低一致性；部分资源触发绑定站位、激怒、杀敌、弃牌、费用门槛或 HP 代价 |

## 4. 对 Redline 的启发：如何让 MP 上限提升成为机制

### 4.1 把 MP 上限做成“路线许可”，不是奖励数值

Redline 当前最强特征是费用链：`0 -> 1 -> 2`。因此 MP 上限提升应该奖励玩家“证明自己能打出正确链”，而不是在升级界面点一个 `+1 MP`。

建议定义一个可见属性：`Redline Permit / 额度许可`。

- 每次在战斗中完成 `0 -> 1 -> 2`，获得 1 层临时许可。
- 每层许可让下一回合 `maxMP +1`，上限可叠到 6。
- 如果本回合断链、空过或未打出 Expand 2，则失去 1 层临时许可。
- Reward 中可以出现永久许可，但必须带代价，例如敌人本回合意图 +1、奖励少一项、起手塞 1 张 Debt。

这样 Turn 1 完成链后，Turn 2 看到 4 MP；持续打好链后，Turn 4 才自然抵达 6 MP，支撑 `0 + 1 + 2 + 3`。玩家会理解：不是系统白送大招，是我把额度“跑出来”的。

### 4.2 把 +MP、+Draw、+Hand、+Start 部署做成互斥成长

Monster Train 的价值在于把 `+1 Ember`、`+1 Draw`、`+1 Capacity`摆到同一层。Redline 可以做成首个资源三选一：

| 选项 | 机制 | 适合玩家 | 代价 |
| --- | --- | --- | --- |
| `信用额度` | `maxMP +1`，但只在完成过一次链后生效 | 想更快打 3 费 payoff | 敌方意图 +1 或起手 Debt |
| `审计抽样` | 每回合首个正确链抽 1 | 手缺口多、想修链 | 不提高 MP，仍需低费牌 |
| `预批准` | 每场战斗第一张 0 费 starter 自动入手/保留 | 想稳定开链 | 后续奖励少一个高费候选 |

核心不是让玩家永远选 MP，而是让 MP 和“能否找到下一张牌”竞争。

### 4.3 引入“蓄能上限”，让不出牌也是资源动作

参考 Ice Cream、Monster Train 的 Ember 保留类 Artifact、Roguebook 的跨回合蓄能宝物，Redline 可以把未用 MP 存入 `Capacitor`：

- 基础：回合末最多保存 1 点未用 MP。
- 成长：`Capacitor Limit +1`，提高可保存 MP 上限。
- 代价：保存 MP 的回合不能触发最高倍率 payoff，或敌人下回合提前补位。
- 好处：玩家在断链手牌里有事可做，可以选择“少打、蓄能、下回合爆发”。

这比直接给 6 MP 更有决策，因为玩家要在当前减伤和未来大招之间取舍。

### 4.4 用条件触发资源，而不是静态加点

可直接转成 Redline 卡牌/Relic 语法：

- `打出第三张牌：抽 1`，对应 Monster Train Winged Steel 的节奏。
- `击杀本回合攻击者：+1 MP`，把资源和取消敌人意图绑定。
- `按 0 -> 1 -> 2 连续出牌：下一张 3 费牌费用 -2`，让 payoff 被“武装”而不是被白送。
- `回合结束时手牌为空：下回合 maxMP +1`，把 Roguebook 的空手触发变成 Redline 的长回合奖励。
- `未受伤完成回合：电容上限 +1，本战斗有效`，把防守成功变成资源成长。

### 4.5 让 MP 上限服务 Redline 的敌意图体验

当前 Redline 的卖点是“费用链清算敌人的意图伤害”。因此 MP 上限增长的反馈不应该只是“多打牌”，而应显示：

- 本回合因 `Permit +1` 多打出的牌取消了多少 intent。
- 如果没有 `Permit`，3 费 payoff 显示 `未授权：无法 armed`。
- `maxMP` 面板展示来源：`基础 3 + 连链许可 2 + 电容 1 = 6`。
- Reward 预览显示代价：`信用额度：下回合 +1 maxMP / 敌方意图 +2`。

## 5. 不建议照搬的点

1. 不建议照搬 Slay the Spire 的 Boss Energy Relic 池。Redline 当前还在 3-5 回合样片阶段，过早塞“不能休息/不能得金币/卡奖励少选项”会变成玩家无法感知的长期惩罚。
2. 不建议照搬 Snecko Eye 类随机费用。Redline 的核心是费用顺序可读，随机费用会破坏 `0 -> 1 -> 2 -> 3` 的学习合同。
3. 不建议照搬 Monster Train 的三层 Capacity。Redline 可以学“容量和能量同级竞争”，但不要把火车楼层结构硬塞到当前前排/意图战斗里。
4. 不建议照搬 Wildfrost 的无费用一回合一牌。它会把 Redline 的 MP 链路价值抹掉；可借鉴的是起手部署、重抽频率和行动数上限。
5. 不建议照搬 Dicey Dungeons 的骰子随机作为核心资源。骰子很适合独立游戏，但 Redline 当前需要玩家稳定理解牌序、倍率和敌意图，不适合再加一层点数随机。
6. 不建议照搬 Roguebook 的“加卡解锁 Talent”到短 demo。当前 Redline 需要立刻看到奖励改变下一回合，牌组变厚成长会把反馈推远。
7. 不建议把 MP 上限直接加到 6 而没有来源。那会解决 payoff 成本问题，但会让玩家失去“我通过机制把大招打出来”的感觉。

## 6. 下一轮最小原型建议

只做设计合同和小型数据脚本即可，不需要扩完整 roguelike 成长。

### 原型 A：连链许可

规则：

- 初始 `maxMP = 3`。
- 每次完整打出 `0 -> 1 -> 2`，下回合获得 `Permit +1`。
- `Permit` 只影响 `maxMP`，最多叠 3 层。
- 断链或回合没有完成 `0 -> 1 -> 2`，下回合少 1 层 Permit。
- HUD 显示：`MP 5 = Base 3 + Permit 2`。

验收：

- Turn 1 成功链后，Turn 2 是 4 MP。
- 连续三回合成功链后，Turn 4 是 6 MP，可自然打出 `0 + 1 + 2 + 3`。
- 断链后 Turn 5 掉回 5 MP 或更低。

### 原型 B：资源三选一

第一次 Reward 不给普通卡，先给资源升级三选一：

| 奖励 | 效果 | 代价 |
| --- | --- | --- |
| `信用额度` | Permit 上限 +1 | 敌方意图总量 +2 |
| `审计抽样` | 每回合第一条正确链抽 1 | 不增加 MP |
| `备用电容` | 回合末最多保存 1 MP | 保存 MP 的回合无法 armed 3 费 payoff |

验收：

- 选择 `信用额度` 的玩家更快打出 3 费 payoff，但承受更高敌意图。
- 选择 `审计抽样` 的玩家更容易修链，但仍受 3 MP 限制。
- 选择 `备用电容` 的玩家可以在坏手牌回合蓄能，下一回合爆发。

### 原型 C：Payoff 授权显示

3 费 payoff 不再只看当前 MP，而看 `armed` 来源：

- `unarmed`: 只做低伤害压血。
- `armed by chain`: 本回合已打 `0 -> 1 -> 2`。
- `armed by permit`: 当前 `maxMP >= 6` 且本回合链未断。
- `armed by capacitor`: 本回合使用了保存 MP，且链路完整。

验收：

- HUD 能解释为什么 payoff 是 `UNARMED` 或 `ARMED`。
- 3 费牌首打不会清场。
- 玩家通过 Permit 或 Capacitor 打出的 payoff 会明确显示取消了多少敌意图。

最小结论：Redline 的 MP 上限应该是“连链信用额度 + 资源三选一 + 可见代价”的组合，而不是升级表里的裸数值。这样能把最大魔法值从属性变成玩法。
