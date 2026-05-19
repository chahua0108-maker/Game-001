# Redline 属性系统竞品调研汇总

日期：2026-05-18
范围：汇总属性系统竞品调研、法力/行动经济调研、Redline 适配方案和制作 scope 评审。

## 一句话结论

下一轮不要先做完整“最大 MP 成长系统”。P0 应该做的是“本回合临时授权 / 返费 / 修补储备”这类可见资源机制，用来解释为什么玩家在基础 3 MP 下能通过正确链路打出 3 费 payoff。

`Max MP +1` 可以放到 P1，作为奖励三选一里的 extension 选项验证，但不能用它解决 P0 的 3 费 payoff 合法性。

## 竞品共同规律

### 1. 资源上限不是裸数值，而是路线权限

竞品里的资源成长通常不是“数值越大越好”，而是解锁新路线：

- `Slay the Spire` 的能量通常每回合刷新，额外能量经常来自遗物、卡牌、姿态或条件触发，并且强能量遗物常带代价。
- `Monster Train` 把 Ember、Draw、Capacity 摆成同级选择，玩家拿了一个方向就少拿另一个方向。
- `Hearthstone` 每回合增长法力水晶，玩家自然经历费用曲线；但这适合长费用曲线游戏，不适合 Redline 现在的 3-5 回合样片。
- `Legends of Runeterra` 的 spell mana 只保留未用法力的一部分，且用途受限，说明“保留资源”应有边界。
- `Vampire Survivors` / `Halls of Torment` 这类 survivor 游戏更像属性海，但核心仍是 build 路线：冷却、范围、数量、持续、拾取、槽位、进化钥匙互相锁定。

对 Redline 的翻译是：最大 MP 不是“升级给更多点数”，而是“我获得了更长清算程序的授权”。

### 2. 真正有趣的是当前资源、临时资源、上限资源分层

竞品资源系统常把三件事分开：

- 当前可用资源：本回合能不能出这张牌；
- 临时资源：本回合爆发，结束后清空或带来代价；
- 最大资源：以后每回合稳定增长，但通常需要更长局或更高风险。

Redline 现在最大的问题是把“当前 MP / 最大 MP / 返费 / 授权 / payoff 武装”混在一起。下一轮应把它们拆开：

- `currentMP`：普通出牌资源；
- `maxMP`：默认保持 3；
- `tempAuthorizationMP`：本回合临时授权，只支付 payoff 或 expected cost；
- `repairReserve`：只用于补缺口，不支付任意牌；
- `lockedMPNextTurn`：透支的下回合代价，P0 可先不做或只做测试草案。

### 3. 竞品的代价设计很重要

直接给资源会让所有 build 都先拿资源。竞品通常通过代价、槽位、互斥选择或类型限制来避免这个问题：

- 能量成长可能牺牲休息、金币、药水、意图可见性或敌人强度；
- 资源三选一会让玩家在“多打牌 / 多抽牌 / 多场面容量”之间选；
- 保留资源通常只能支付某类牌；
- 透支本回合强，下回合弱；
- 进化要求玩家提前拿配方钥匙。

Redline 的代价也应该围绕“未清算反噬”和“链路稳定性”：

- 透支授权：本回合能打 payoff，下回合锁 1 MP；
- 信用额度：最大 MP +1，但敌方意图 +2；
- 修补储备：可救一次断链，但 payoff 基础伤害下降；
- 清算返费：只有 armed payoff 真正减少意图后才返。

## 对 Redline 的建议

### P0：不要做最大 MP 成长，做“临时授权 MP”

推荐 P0 规则：

1. 基础 `maxMP = 3` 不变。
2. 玩家完成有效 `0 -> 1 -> 2` 清算链后，获得本回合 `临时授权 +3`。
3. 临时授权只允许支付 `cost = 3` 且 `comboNode = burst` 的 payoff，或只支付下一张 expected cost。
4. 断链路线不触发授权；payoff 仍可出，但是 unarmed，收益低。
5. Wild/draw/mana 修补如果把链路接回 `lastCost = 2`，也可以触发授权，但必须记录 repair source。

玩家看到的不是“系统突然给了 6 MP”，而是：

```text
 完成 0 -> 1 -> 2
+ 获得终局授权 +3
+ 使用授权支付 3 费清算牌
+ armed payoff 取消敌人意图
```

### P1：把 `Max MP +1` 做成奖励分支，而不是默认成长

当 P0 跑通后，可以在第一次奖励三选一里加入一个 extension 选项：

| 奖励 | 作用 | 代价 / 限制 |
| --- | --- | --- |
| `信用额度` | 下回合 `Max MP +1`，demo 上限固定 4 | 只能出现一次，不解决 Turn 4 payoff 合法性 |
| `证据续链` | 每回合第一次跳过费用仍算接链，但倍率少升一级 | 偏修补路线 |
| `终局印章` | 正确接链积 charge，3 charge 后下一张 payoff armed | 偏 payoff 路线 |

这样玩家能理解三条成长路线：

- 多资源；
- 稳定修补；
- 更早武装 payoff。

### P2：完整最大 MP 属性系统以后再做

完整系统会自然引出等级曲线、叠加上限、敌人缩放、属性面板、长期奖励、存档和多来源资源。现在做会污染固定 5 回合 demo。

P2 进入条件应该是：

- P0 证明临时授权能解释 `0 -> 1 -> 2 -> 3`；
- P1 证明 `Max MP +1` 作为一次性奖励能被玩家理解；
- QA 能证明玩家不是只记住“MP 越高越好”，而是能复述“为什么 payoff 变强”。

## 推荐固定 5 回合属性脚本

| 回合 | 目标体验 | 属性重点 |
| --- | --- | --- |
| Turn 1 | 正常 `0 -> 1 -> 2`，降低敌意图 | `maxMP = 3`，不引入最大 MP 成长 |
| Turn 2 | 让玩家看到乱序或未 armed payoff 的低收益 | `payoffArmed = false` |
| Turn 3 | 给 Wild/draw/mana 修补坏手牌 | `repairMethod` 可见 |
| Turn 4 | 完整链触发临时授权，支付 3 费 payoff | `tempAuthorizationMP +3`，`payoffArmed = true` |
| Turn 5 | 奖励回应构筑：资源 / 修补 / payoff 三选一 | P1 可出现 `Max MP +1` |

## 最小事件和 QA 字段

建议下一轮合同先定义这些事件/字段：

```text
TurnStarted: currentMP, maxMP, tempAuthorizationMP, repairReserve
CardPlayed: printedCost, paidCurrentMP, paidAuthorizationMP, paidRepairReserve
ChainAdvanced: playedCosts, nextExpectedCost, multiplier
GapRepaired: expectedCost, source, amount
PayoffResolved: armed, affectedEnemyIds, killCount, preventedIntentDamage
AuthorizationGranted: amount, reason, spendRestriction, expiresAt
TurnEnded: remainingMP, resolvedDamage, lockedMPNextTurn
RewardOffered: resourceOption, repairOption, payoffOption
```

最关键的是：不要再用“测试里把 MP 改到 6”证明 payoff 合法。所有资源来源都必须可见、可记录、可在 HUD 上解释。

## 明确不建议

- 不要把 Hearthstone 式每回合自然涨到 10 mana 照搬进 Redline。
- 不要照搬 MTG 土地系统，会把短 demo 复杂化成资源牌学习。
- 不要先做 survivor-like 的属性海。
- 不要让 `+1 max MP` 成为所有奖励里的无脑最优。
- 不要让 unarmed 3 费全场牌过强。
- 不要在 P0 做属性面板、等级曲线、遗物池、局外成长。
- 不要把临时授权写成普通 MP 增加，否则玩家会误读为最大 MP 成长。

## 下一轮可执行结论

如果只选一个方向：做“终局授权”。

最小规则：

```text
基础 maxMP = 3
完成 0 -> 1 -> 2 后，本回合获得 tempAuthorizationMP +3
tempAuthorizationMP 只支付 3 费 payoff
断链不授权
修补成功后可授权，但要记录 repair source
payoff armed 后必须记录 preventedIntentDamage
```

这比直接做最大 MP 成长更适合当前阶段，因为它解决的是 demo 的核心问题：玩家为什么能在 3 MP 底盘下，通过正确链路打出一次清算终结。

## 资料来源

- Slay the Spire Energy / relic resource patterns: https://slay-the-spire.fandom.com/wiki/Energy
- Monster Train Ember / battle resource patterns: https://monster-train.fandom.com/wiki/Ember
- Wildfrost Bells / action economy references: https://wildfrostwiki.com/Bells
- Hearthstone Mana: https://hearthstone.wiki.gg/wiki/Mana
- Legends of Runeterra mana official support: https://support-legendsofruneterra.riotgames.com/hc/en-us/articles/360035562074-Let-s-Talk-About-Mana
- Magic: The Gathering rules and mana basics: https://magic.wizards.com/rules
- Vampire Survivors player stats / powerups: https://vampire-survivors.fandom.com/wiki/Player_stats
- Halls of Torment Traits / Steam feature summary: https://hot.fandom.com/wiki/Trait and https://store.steampowered.com/app/2218750/Halls_of_Torment/

