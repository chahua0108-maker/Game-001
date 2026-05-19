# 2026-05-18 Round 05-09：玩家体验与压迫感设计评估

角色：第 5 轮专家 09，玩家体验与压迫感设计师  
工作目录：`/Users/roc/Game-001`  
边界：只读源码和既有设计文档；本文只新增体验评估，不修改源码，不提交 git。  
任务：评估开放抽牌修补牌是否会削弱敌意图压力，以及如何让抽牌修补仍然服务卡牌游戏的压迫感。

## 0. 一句话结论

可以开放 `blood_tithe` / `pulse_draw`，但它们必须被设计成“承压找路线”的牌，而不是“免费把坏手变好”的牌。

抽牌修补不会天然削弱敌意图压力。真正会削弱压力的是三件事：

1. 抽牌后 HUD 没告诉玩家“当前敌意图仍然还在”。
2. 抽牌修补过于高频，导致每个坏手都能被无痛修回。
3. 抽牌修补同时返 MP、补 Wild、放大抽牌，变成比攻击链和 payoff 更稳定的最优解。

正确方向是：**敌意图先作为倒计时压力存在，抽牌修补只提供寻找答案的机会；如果玩家没有把抽到的牌转化为击杀、打断、授权或 payoff，结束回合仍然照样吃伤害。**

## 1. 当前事实基线

### 1.1 两张待开放牌的身份

当前 `prototype-web/src/data/cards.ts` 中：

- `blood_tithe`：`0 MP / self / draw 1 / damage 0 / reserve-test`，显式 `rewardBranches: ['repair-resource']`。
- `pulse_draw`：`1 MP / self / draw 1 / damage 0 / reserve-test`，显式 `rewardBranches: ['repair-resource', 'route-bridge']`。
- 两者还没有进入 `rewardCardPool`。

这说明第 4 轮已经把“未来可开放的分支合同”预埋好了，但产品上还没有让玩家看到。

### 1.2 敌意图压力已经足够承担短切片

当前敌人基础压力：

- `Debt Wisp`：2 伤害。
- `Redline Brute`：5 伤害。
- `Pulse Collector`：3 伤害。
- 初始 5 个前排按当前默认序列通常形成 `2 + 5 + 3 + 2 + 5 = 17` 总意图。

`DealHand` 时会快照本回合攻击者并生成 `enemyIntentSummary`；结束回合后按本回合攻击快照结算。这个方向符合 Hyper-Turn 合同：压力来自“结束回合后果”，不是实时扣血。

### 1.3 抽牌修补当前不直接降意图

`card.self.resource` 对 self 牌只生成：

```text
DrawCards.count = card.drawCards * effectMultiplier
GainEnergy.amount = card.energyGain
```

所以 `blood_tithe` / `pulse_draw` 本身不会杀敌、不会取消意图、不会降低 `enemyIntentSummary`。这其实是好事：它们天然适合做“我先冒险找解”的承压动作。

当前 UI 风险在于 `hudCardIntentPreview` 对无伤害抽牌牌只显示 `抽牌找解`，没有同时强调：

```text
本张牌不降意图；当前仍会吃 -X HP。
```

如果不修这个表达，玩家会误以为“抽牌”本身就是减压。

## 2. 是否会削弱敌意图压力

### 2.1 会削弱的开放方式

以下开放方式会把敌意图压力打薄：

1. **进起始牌组。** 第一回合本来应该教玩家读 `0 -> 1 -> 2` 和前排意图。如果起手就塞 `blood_tithe` / `pulse_draw`，玩家第一印象会变成“先抽更多牌”，而不是“用正确链处理当前压力”。
2. **默认首奖总是未调弱 `wild_mana_stitch`。** 它现在是 0 费、Wild、抽 1、返 MP 的叠加体；如果再和开放抽牌修补一起高频出现，坏手会失去尖锐感。
3. **奖励池同时堆太多 self draw。** `blood_tithe`、`pulse_draw`、`paper_shatter`、`lantern_captain` 如果频繁同屏或同手，玩家会觉得系统一直在补偿他，而不是敌人在压迫他。
4. **HUD 只讲“抽牌找解”。** 如果卡牌按钮没有显示实际未解决意图，抽牌会在感知上替代攻击、防御和 payoff，敌意图从“当前后果”退化成背景数字。
5. **抽牌成功后不给代价。** 如果抽到修补牌后立刻无脑完成链、无脑 payoff、无脑清场，玩家只记得“抽牌救我”，不记得“我在 17 点意图下赌了一次路线”。

### 2.2 不会削弱的开放方式

以下开放方式反而会加强卡牌压迫感：

1. `blood_tithe` / `pulse_draw` 只作为奖励或固定短切片出现，不进入第一手教学牌组。
2. 抽牌修补牌本身不直接降低敌意图，必须通过后续攻击、2 费段、Wild 修补或 payoff 才能兑现。
3. 每次打出 self draw 时，HUD 同时显示“抽几张”和“意图仍多少”。
4. 奖励选择保留三分支压力：修补、payoff、路线。玩家选择修补是在买稳定性，不是在免费拿最优解。
5. 抽牌修补服务一个明确坏手：缺 1、缺 2、缺 payoff。它不是泛化资源牌。

结论：开放不是问题，**无痛开放**才是问题。

## 3. 推荐体验裁决

### 3.1 开放顺序

P0 推荐先开放 `pulse_draw`，`blood_tithe` 作为后备或第二个 repair-resource 选项。

理由：

- `pulse_draw` 是 1 费承接牌，必须先有 0 费开链，天然要求玩家按压力路线行动。
- 正确接在 0 后，它能以 x2 抽牌寻找 2 费段或 payoff；这正好服务“敌意图压着我，我需要继续链路”的体验。
- 它没有伤害。如果抽不到答案，敌意图仍然留在场上，失败后果清楚。
- `blood_tithe` 是 0 费 opener，风险更低，压力感也更弱。它适合作为 Wild 被拿走后的 repair-resource 后备，而不是第一个教学修补牌。

### 3.2 奖励池出现方式

推荐首奖模板仍保持：

```text
修补 / payoff / 路线
```

如果开放抽牌修补，首奖或早期奖励可采用：

```text
pulse_draw / red_ledger_burst / spark_tap
```

或在 Wild 被拿走后：

```text
blood_tithe / severance_burst / clearance_order
```

不推荐早期默认给：

```text
wild_mana_stitch / pulse_draw / paper_shatter
```

这会让奖励面板变成“全是找解”，玩家不会感到自己在高压下做路线选择。

### 3.3 回合内表达

抽牌修补牌必须承担三个短句：

```text
我缺什么。
我抽几张找什么。
当前意图还剩多少。
```

推荐 HUD 短文案：

| 局面 | `blood_tithe` | `pulse_draw` |
| --- | --- | --- |
| 无链开手 | `抽1找MP1 · 仍-X` | `非起手 抽1 · 仍-X` |
| `0 -> pulse_draw` | 不适用 | `接x2 抽2找MP2 · 仍-X` |
| 断链打出 | `断x1 抽1 · 仍-X` | `断x1 抽1 · 仍-X` |
| 抽到答案后 | `找到了MP1` | `找到了MP2/终结` |
| 未抽到答案 | `没找到，意图仍-X` | `没找到，意图仍-X` |

移动端如果空间不够，至少保留：

```text
抽2找MP2
仍-17
```

“仍-17”比“抽牌找解”更能维持敌意图压力。

### 3.4 与 payoff 的关系

抽牌修补不应该直接制造爽点，爽点必须来自后续兑现：

```text
高意图
  -> 抽牌修补找段
  -> 完成 0 -> 1 -> 2
  -> 授权 3 MP payoff
  -> 清掉 active intent
```

也就是说，`pulse_draw` 的体验目标不是“我抽了很多牌”，而是：

```text
我在 -17 HP 的压力下，用一张无伤害牌赌到了 2 费段，然后把本回合救回来。
```

如果最后没有清掉意图，玩家应该明确知道失败原因：

```text
抽到了牌，但没有兑现成击杀 / 授权 / payoff，所以结束回合仍吃伤害。
```

## 4. 压迫感护栏

### 4.1 起手护栏

- `startingHand` 不加入 `blood_tithe` / `pulse_draw`。
- 第一回合仍以攻击链和敌意图教学为主。
- 抽牌修补应从首奖、第二回合固定切片或后续奖励进入。

### 4.2 密度护栏

3-5 回合体验样片内，建议同一手牌最多出现 1 张 self draw fixer。若同时出现 2 张，必须有一个明确代价：

- 没有足够 MP 全打完。
- 打完后仍没有直接降意图。
- 缺 payoff 或缺 2 费段，不能无脑闭环。

奖励面板同屏不要同时把 `blood_tithe`、`pulse_draw`、`paper_shatter`、`lantern_captain` 都当作核心选择展示。最多一张作为修补位，一张作为路线位；否则奖励会像“系统发答案”。

### 4.3 数值护栏

- `blood_tithe` 不加伤害，不返 MP。
- `pulse_draw` 不加伤害，不返 MP。
- `wild_mana_stitch` 若继续保留返 MP，必须只在真实 `ChainRepaired` 时返；否则它会和抽牌修补一起压掉压力。
- `pulse_draw` 正确接链抽 2 已经足够，不需要额外补偿。
- 抽牌修补后的最佳路线可以比错误路线稳定，但即时减压必须低于纯攻击链。

### 4.4 意图护栏

抽牌修补牌打出后，除非后续抽到的牌被打出并造成击杀 / payoff，否则：

- `enemyIntentSummary.totalDamage` 不下降。
- 结束回合按钮显示的伤害不下降。
- 前排 active intent 标记不消失。
- 战斗日志不应暗示“已解决压力”。

这条是体验底线：抽牌只能找解，不能替解。

## 5. 推荐固定体验切片

### 5.1 Turn 1：建立压力语言

手牌：

```text
debt_hook / redline_cut / row_cleave / heartbeat_spark
```

敌意图：

```text
17
```

目标：

- 玩家学会 `0 -> 1 -> 2`。
- 正确链能明显降低意图，但不需要把压力完全清零。
- 玩家知道 End Turn 会扣多少 HP。

### 5.2 Turn 2：开放 `pulse_draw` 的承压修补

手牌示例：

```text
debt_hook / pulse_draw / severance_burst / filler
drawPile 顶：row_cleave 或 clearance_order
```

敌意图：

```text
12-17
```

正确路线：

```text
debt_hook -> pulse_draw
```

玩家看到：

```text
接x2 抽2找MP2
意图仍-12/17
```

如果抽到 2 费段：

```text
继续 row_cleave / clearance_order
获得授权
再决定是否 payoff
```

如果没有抽到：

```text
End Turn 仍按当前意图扣血
```

这就是抽牌修补服务压迫感的核心：它给机会，不给免死。

### 5.3 Turn 3-5：奖励回应构筑

奖励面板出现：

```text
pulse_draw 或 blood_tithe / payoff / route
```

体验目标：

- 选择 `pulse_draw`：下一手更容易补链，但当前局面仍要面对意图。
- 选择 payoff：上限更高，但如果没有链路会卡手或未授权低收益。
- 选择 route：即时路线更稳，但不解决坏手流动。

玩家必须感到这是一个压力下的选择，而不是系统问他“要不要更舒服”。

## 6. 体验验收

### 6.1 核心体验验收

1. 发牌后 3 秒内，玩家不用看 debug，就能回答：结束回合会掉多少 HP。
2. 打出 `blood_tithe` / `pulse_draw` 后，玩家仍能看到未解决意图没有下降。
3. 正确使用 `pulse_draw` 的回合，玩家能说出“我抽牌是为了找 2 费段 / 终结牌”，而不是只说“抽更多牌”。
4. 如果抽牌没有找到答案，结束回合扣血必须和抽牌前预览一致。
5. 如果抽牌找到了答案，真正降低意图的必须是后续攻击、授权段或 payoff，而不是 draw card 自身。
6. 选择抽牌修补奖励后，下一手更稳定，但不会提高 `maxEnergy`，也不会自动清掉本回合压力。
7. 3-5 回合内至少出现一次“高意图 -> 抽牌修补 -> 兑现 payoff / 失败吃伤害”的完整分叉。

### 6.2 HUD 验收

- Self draw 牌不能只显示 `抽牌找解`。
- `pulse_draw` 正确接链时必须显示 `抽2` 或 `抽2找MP2`。
- `blood_tithe` 必须保持 `抽1`，不要暗示倍率爆发。
- 任意 self draw 牌旁边必须能看到 `仍-X`、`意图仍-X` 或等价未解决意图提示。
- 移动端 390x844 与 360x640 下，`抽2找MP2`、`仍-17`、`断x1抽1` 不应互相遮挡。
- 战斗日志应区分“请求抽 N”和“实际抽到 M”，牌堆不足时不能让玩家以为系统少给牌。

### 6.3 Sim / 回放验收

建议体验回放或测试记录以下字段：

```text
intentBeforeDrawRepair
cardId
effectMultiplier
drawRequested
drawActual
intentAfterDrawRepair
intentAfterFollowupAttack
intentAfterPayoff
hpLostOnEndTurn
```

通过标准：

- `blood_tithe` / `pulse_draw` 单独打出后，`intentAfterDrawRepair === intentBeforeDrawRepair`。
- `debt_hook -> pulse_draw` 时，`pulse_draw.effectMultiplier === 2`，请求抽 2。
- `pulse_draw` 找到 2 费段并完成后，后续 `row_cleave / clearance_order` 才能降低意图或授予 payoff。
- 未找到答案时，`hpLostOnEndTurn` 等于结束回合前显示的未解决意图。
- 选择 `blood_tithe` / `pulse_draw` 奖励后，下一手能看到该牌，但 run restart 后不保留为局外成长。

### 6.4 奖励体验验收

- 默认三选一仍覆盖 `repair-resource / payoff / route-bridge`。
- 如果修补槽是 `pulse_draw`，路线槽应优先给可直接处理压力的攻击路线，不要再给一个同构 self draw。
- 如果修补槽是 `blood_tithe`，文案应表达“低风险找 1 费段”，不要包装成强救场。
- 玩家选择修补牌后，下一回合必须面对明确敌意图；不能让奖励选择变成无压安全屋。
- 5 回合样片内，选择修补路线的玩家应比不选修补路线少一次断链，但不应比正确攻击/payoff 路线更快清空全部压力。

## 7. P0 裁决

1. 开放 `pulse_draw` 是合理的，而且应该优先于 `blood_tithe` 进入早期奖励验证。
2. `blood_tithe` 可以开放，但更适合作为后备 repair-resource，不进入第一手教学，也不应成为首奖默认最强修补。
3. 开放两张牌前，必须把 HUD 从 `抽牌找解` 改成“抽几张 + 意图仍多少”的承压表达。
4. 不要把开放抽牌修补和未调弱 `wild_mana_stitch` 同时推到早期默认最优位；否则坏手压力会被过度修平。
5. 抽牌修补体验通过的标准不是“玩家抽到了更多牌”，而是“玩家在敌意图压力下获得一次找解机会，并且后果仍由后续卡牌兑现或失败承担”。

STATUS: DONE
