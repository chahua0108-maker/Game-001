# Redline Attribute Research 03 - Mana and Action Economy

日期：2026-05-18
Worker：CRPG / 战术卡牌法力与行动经济专家
范围：只写调研文档，不改 runtime / data / test / HUD。

## 1. 调研对象和资料来源

本轮只抽象资源经济，不展开完整规则史。

| 对象 | 本轮关注机制 | 主要来源 |
| --- | --- | --- |
| Magic: The Gathering | 土地作为长期资源上限、法力池短暂存在、额外/替代费用、费用修正 | [Magic Comprehensive Rules 2026 PDF](https://media.wizards.com/2026/downloads/MagicCompRules%2020260227.pdf)；规则 106.4 说明法力进入 mana pool 并在步骤/阶段结束时清空，规则 305.2 说明通常每回合只能打出一张地 |
| Hearthstone | 每回合增长到 10、临时水晶、费用折扣、Overload、Fatigue | [Hearthstone Wiki - Mana](https://hearthstone.fandom.com/wiki/Mana)、[Mana cost](https://hearthstone.fandom.com/wiki/Mana_cost)、[Overload](https://hearthstone.fandom.com/wiki/Overload)、[Fatigue](https://hearthstone.fandom.com/wiki/Fatigue) |
| Legends of Runeterra | 每回合解锁法力宝石、最多 3 点 spell mana 留存、法术优先消耗保留资源 | [Riot Support - Let's Talk About Mana](https://support-legendsofruneterra.riotgames.com/hc/en-us/articles/360035562074-Let-s-Talk-About-Mana) |
| Into the Breach | 机甲行动的机会成本、移动/武器互斥、反应堆核心作为可重分配升级能量 | [Into the Breach Wiki - How to Play](https://intothebreach.fandom.com/wiki/How_To_Play_Guide_For_Into_The_Breach)、[Mechs](https://intothebreach.fandom.com/wiki/Mechs)、[Reactor Core](https://intothebreach.fandom.com/wiki/Reactor_Core) |
| XCOM 2 | 每单位 2 action points、蓝移/黄移、攻击/装填/警戒等行动竞争 | [XCOM 2 Manual - Action Points and Actions](https://feralinteractive.com/en/manuals/xcom2/latest/steam/) |
| Gloomhaven | 两张牌形成两行动、弃牌/失去牌/休息/疲劳、强行动透支未来行动数 | [Gloomhaven Rule Book searchable copy](https://github.com/m-ender/gloomhaven-rules)，该整理声明文本来自官方规则书 |

## 2. 法力/行动点机制类型

### 每回合增长

- Hearthstone 和 LoR 都用“每回合自动多 1 点可用上限”的模型，让玩家天然经历费用曲线。
- XCOM 的行动点不是增长，而是每回合刷新到固定 2 点；变化来自行动类型、技能和位置后果。
- Redline 当前短切片更像 XCOM/战术卡牌：`maxEnergy = 3` 足够教 `0 -> 1 -> 2`，但无法自然支持 `0 -> 1 -> 2 -> 3`。如果直接每回合 +1，核心体验会变成等回合，而不是修链。

### 上限增长

- MTG 的土地不是“免费升级”，而是要从手牌中打出、占 deck slot，并受每回合一次土地动作限制；这让上限增长和抽到可用牌之间存在张力。
- Hearthstone 的永久 Mana Crystal 最终到 10，但临时水晶和永久水晶明确分离。
- Into the Breach 的 Reactor Core 是长期升级能量，但要在移动、血量、武器、被动之间分配，而且可以重分配；它不是单纯“行动点 +1”。
- Gloomhaven 的角色升级给更强卡，但场景内 hand limit 不会因此无限扩大；成长提高牌质，不直接取消疲劳压力。

### 临时资源

- Hearthstone 的 The Coin / Innervate 类资源只提高本回合可用 mana，不提高最大 mana，并且通常先于永久资源被花掉。
- Redline 最适合把“临时授权”做成独立字段，而不是悄悄改 `maxMP`：例如 `tempAuth = 1` 表示本回合下一张牌可额外支付 1 MP 或越过一次费用缺口，回合结束清空。

### 保留资源

- LoR 的核心启发是 unused mana 不完全浪费，但只最多保留 3 点，并且只能支付 spell。这让“少打一点”变成有意义的准备，而不是无条件亏。
- MTG 默认不保留 mana；只有特定卡破坏这个规则。这说明“保留资源”一旦存在，应当是明确的构筑身份或卡牌效果。
- Redline 可以保留少量“修补储备”，但它应只能支付 Wild / repair / payoff 条件，而不是变成通用 MP 池。

### 费用折扣

- MTG 和 Hearthstone 都允许费用修正，但它们都强调“最终支付成本”和“原始费用/牌面费用”不是同一个概念。
- Hearthstone 的费用最低按 0 支付，不会因为折到负数而倒赚 mana。这个边界对 Redline 很重要：折扣只应让牌更容易打，不应天然返费。
- 对 Redline 来说，费用折扣最好是显式的链路奖励：`下一张 payoff -1`、`本回合第一张 2 费视为 1 费承接`，而不是全局静态减费。

### 透支

- Hearthstone Overload 是典型“现在获得更强 tempo，下一回合锁 mana”。它的好处是代价清楚、跨回合可预告；坏处是如果界面不清楚，玩家会觉得下回合被偷走了行动。
- Gloomhaven 的 loss card 和弃牌防伤害也是透支：你现在解决危险，但永久缩短后续可行动回合数。
- Redline 可以做“红线透支”：本回合临时 +1 或允许一次超额支付，下回合锁 1 MP；如果本回合 payoff 成功清算，则部分或全部抵消锁定。

### 蓄力

- LoR 的 spell mana 是最干净的蓄力：上一回合少花，下一回合以受限形态释放。
- Into the Breach 的 Reactor Core 是战前/战间蓄力：拿到核心后决定给哪台机甲和哪项升级，形成长期路线。
- Gloomhaven 的 persistent bonus 用卡牌占用/失去作为蓄力成本，强但占未来资源。
- Redline 的蓄力不应是“等 3 回合拿 6 MP”，而应是“保留一个清算授权 / 修补储备 / 债务可抵扣”，服务 3-5 回合的连锁样片。

## 3. 玩家决策影响：为什么上限提升不是纯变强

上限提升只有在同时满足“有牌可花、花得出、花了值得、花后不亏节奏”时才是强。否则它会制造新的决策成本。

1. 更高上限会要求更高牌质和抽牌密度。Hearthstone 到 10 mana 后，如果手牌全是低影响牌，满水晶也只是空转；MTG 抽太多土地会 flood，抽不到土地会 screw。
2. 上限增长可能牺牲当前 tempo。MTG 打 ramp 或 Hearthstone 打空水晶成长牌，通常是在当前回合少做事，换未来更高天花板。
3. 保留资源通常有类型限制。LoR 的 spell mana 不能随便召单位；这让“留 3 点”不是无脑，而是要求手里有合适法术。
4. 透支会把现在的强度变成未来的缺口。Overload 强在当回合，但会让下一回合动作变少；Gloomhaven loss card 能救场，但会缩短整场耐力。
5. 行动点增加会暴露更多风险。XCOM 多走一步可能进敌人视野、丢掩体或错过警戒；Into the Breach 多移动不等于多解题，武器方向、推位和建筑风险才是核心。
6. 永久上限提升会抬高平衡基准。Redline 如果轻易把基础 MP 从 3 升到 6，`0 -> 1 -> 2 -> 3` 会从“构筑出来的长回合”变成“正常费用曲线”，链路修补就失去存在感。

结论：上限提升不能作为普通奖励泛发。它必须附带限制：回合内、类型限制、下回合锁定、需要击杀/避免意图伤害触发、或只能支付特定链段。

## 4. 对 Redline 的启发

### MP 上限

建议保留基础 `maxMP = 3` 作为第一切片的清晰框架。它天然支持 `0 -> 1 -> 2`，也自然暴露 `3` 费 payoff 的问题：玩家必须通过临时授权、返费或修补才能到达终结。

不要把下一轮目标改成“永久 6 MP”。更好的模型是：

- 常态：3 MP，完成 `0 -> 1 -> 2`。
- 临时：本回合拿到 `+1/+2` 授权或一次折扣。
- 清算：armed payoff 成功后返还 1 MP 或抵扣债务。
- 成长：少量稀有奖励提高 `maxMP`，但必须配合更高敌意图和更大牌堆，不作为首个 demo 规则。

### 临时授权

把 Hearthstone temporary mana 和 Redline 主题结合，做成“授权”而不是“水晶”：

```text
1 临时授权：本回合可多支付 1 MP；优先消耗，回合结束清空。
清算授权：只能支付 payoff 或 Wild 修补，不可支付普通伤害牌。
紧急授权：现在多 1 MP，下回合锁 1 MP，除非本回合 preventedIntentDamage >= 6。
```

UI 上应显示为 `MP 1/3 + AUTH 1`，不要直接显示 `MP 2/4`。这样玩家知道这是一次性资源，不会误以为上限永久提高。

### 缺口修补

LoR spell mana 的限制性保留，适合转成 Redline 的“缺口修补储备”：

- `repairReserve` 上限 2 或 3。
- 只能用于补 `nextExpectedCost`，不能支付任意牌。
- 使用后应有 trace：`GapRepaired expected=2 paidBy=repairReserve amount=1`。
- 修补牌本身要有代价：低伤害、少抽牌、消耗储备、或制造下回合锁定。

这能避免 Wild 变成万能免费牌。Wild 的核心不是“省 MP”，而是“把本来断掉的费用序列接回去”。

### 清算链 rebate

费用返还不应是打出某牌就自动发生，否则会制造无限循环。建议只在 payoff 真正清算危险时返还：

```text
rebate 条件：
- chainArmed = true；
- payoff 命中本回合有 intent 的敌人；
- killCount >= 1 或 preventedIntentDamage >= 4；
- 本回合 rebate 总量最多 1 或 2。
```

返还形式优先级：

1. 先抵扣 `nextTurnLockedMP`，让“透支成功清算”像审计通过。
2. 再给 `tempAuth +1`，只允许继续接一张非 payoff 牌。
3. 最后才考虑直接 `currentMP +1`。

这样清算链的爽感来自“我用长链把债务清掉了”，而不是“我随便返费继续刷”。

### 过载 / 疲劳的 Redline 版本

Redline 可以同时保留两个负资源，但都要轻量：

- `lockedMPNextTurn`：本回合透支产生，下回合开局扣可用 MP。适合高压救场。
- `auditFatigue`：当玩家抽空牌堆、连续透支、或反复用同一修补件时累积，表现为 HP 损失、敌意图上升或 reward 污染。

不要在第一轮做完整疲劳系统。先只做一个最小验收：`Emergency Authorization` 让玩家本回合打出 3 费 payoff；若 payoff 没有清算，下一回合 `max available MP = 2/3`。

## 5. 不建议照搬的点

1. 不建议照搬 Hearthstone 的自动涨到 10 mana。Redline 的卖点不是等到高费回合，而是在 3 MP 框架内把断链修成爆发。
2. 不建议照搬 MTG 的土地系统。土地能制造深度，但也会带来 mana screw/flood；短 demo 不应让玩家先学资源牌和颜色约束。
3. 不建议照搬 LoR 的完整双 mana UI。可以借鉴“最多保留 3 点、类型受限”，但 Redline 首屏不应多出一个独立复杂资源条。
4. 不建议照搬 XCOM 的小队 AP。Redline 是手牌链路，不是多单位轮流行动；可以借鉴“行动点刷新”和“行动类型机会成本”，不要把每张牌都变成单位动作。
5. 不建议照搬 Gloomhaven 的完整休息/失去牌疲劳。它适合长场景桌游，不适合 3-5 回合 hyper-turn 切片。
6. 不建议引入隐藏负费用。Hearthstone 里负 hidden cost 有成熟规则支持；Redline 当前 UI 和测试不应承担这种复杂度。任何折扣都按 0 封底，且不可因支付成本为负而返费。
7. 不建议把“MP 上限 +1”作为通用奖励。它会迅速吞掉 Wild、draw、reorder、rebate 的存在感，让所有问题变成堆高费牌。

## 6. 下一轮最小原型建议

目标不是建立完整资源系统，而是回答一个窄问题：

> 在基础 3 MP 下，玩家能否通过一次临时授权、一次缺口修补、一次清算返费，理解并打出 `0 -> 1 -> 2 -> 3` 的救场长链？

### 最小规则

| 字段 | 初始值 | 规则 |
| --- | ---: | --- |
| `maxMP` | 3 | 每回合恢复到 3，不自然增长 |
| `tempAuth` | 0 | 本回合临时支付池，优先消耗，回合结束清空 |
| `repairReserve` | 0 | 上限 2，只能支付 `nextExpectedCost` 缺口 |
| `lockedMPNextTurn` | 0 | 透支产生，下回合开局减少可用 MP |
| `rebateThisTurn` | 0 | 上限 1，只有 armed payoff 清算危险后获得 |

### 5 回合脚本

1. 第 1 回合：给 `0/1/2/2`，3 MP 正常打出 `0 -> 1 -> 2`，证明基础链。
2. 第 2 回合：给缺口手牌，例如 `0/2/3/support`，玩家能乱打但收益明显下降，证明断链不是禁牌。
3. 第 3 回合：给 `Wild Mana Stitch` 或 `Gap Key`，产生 `repairReserve +1` 或按 `nextExpectedCost` 修补一次，证明缺口可修。
4. 第 4 回合：给 `Emergency Authorization +1` 和 3 费 payoff，让玩家在 3 MP 基础上通过授权打出 `0 -> 1 -> 2 -> 3`；如果 payoff 清前排或避免高意图伤害，触发 `rebate` 抵扣下回合锁定。
5. 第 5 回合：展示清算结果。如果上一回合成功，玩家正常 3 MP；如果失败，玩家 `lockedMPNextTurn = 1`，只能以 2 MP 开局，证明透支代价真实。

### 最小验收事件

下一轮 sim / QA 只需要记录这些字段，不需要先做大 UI：

```text
TurnStarted: currentMP, maxMP, tempAuth, repairReserve, lockedMPNextTurn
CardPlayed: cardId, printedCost, paidMP, paidTempAuth, paidRepairReserve
ChainAdvanced: playedCosts, nextExpectedCost, multiplier
GapRepaired: expectedCost, source, amount
OverdraftTaken: amount, lockedMPNextTurn
PayoffResolved: chainArmed, affectedEnemyIds, killCount, preventedIntentDamage
RebateGranted: amount, reason, appliedTo
TurnEnded: remainingMP, unusedConvertedOrLost, enemyIntentDamageResolved
```

### 最小卡牌原型

- `Wild Mana Stitch`：0 费，低收益；如果 chain 已开始，补当前 `nextExpectedCost` 的 1 点缺口，或给 `repairReserve +1`。
- `Clearance Advance`：1 费支援；本回合 `tempAuth +1`，但下回合 `lockedMPNextTurn +1`。
- `Red Ledger Rebate`：2 费展开；如果本回合已达 x2，下一张 payoff 支付 `-1`，不低于 0。
- `Severance Burst`：3 费 payoff；unarmed 只打低额前排，armed 后清算本回合有 intent 的前排，并按上面条件给 rebate。

最小原型的成功标准：玩家在 3-5 回合内明确看到三件事：资源不够、资源被修、透支有代价但清算能抵债。这比单纯把 MP 上限调高更接近 Redline 的“缺口修补 -> 清算链”核心。
