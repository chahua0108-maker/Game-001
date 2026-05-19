# 2026-05-18 Round 06-08 数值与概率分析：draw repair 后 Wild/reorder 风险

角色：第 6 轮专家 08，数值与概率分析师  
工作目录：`/Users/roc/Game-001`  
边界：只读当前源码与既有 long-task 文档；本文只新增本分析文档，不修改源码、不提交 git。

## 0. 结论

开放 `blood_tithe / pulse_draw` 本身没有把坏手率压到失控。按当前 4 张起始牌库、4 张手牌、3 MP、12 XP 首奖节奏估算：

- 单拿 `blood_tithe` 后，缺 2 的自然坏手约 20%-25%，但 `blood_tithe` 能把这个缺口抽回来，硬坏手接近 0。
- 单拿 `pulse_draw` 后，自然成链约 60%，可修补成链约 75%-80%，仍有约 20%-25% 的“缺 0 起手”硬坏手。
- 同时拿到 `blood_tithe + pulse_draw` 后，随机 6 牌模型下自然成链约 61%，可修补成链约 93%，硬坏手约 7%。这已经很稳定，但仍不是完全无压。

真正危险的是继续增强 Wild，尤其是当前 `wild_mana_stitch`。在 `blood_tithe + pulse_draw` 之后再加入 `wild_mana_stitch`，小模拟里可修补成链约 97%，硬坏手约 3%。如果再给 `reorder` 做“从牌堆任意找关键牌”的强实现，坏手体验会从“承压找解”变成“系统几乎总会给答案”。

P0 裁决：draw repair 已开放后，不应再增强 Wild/reorder。只允许保留当前 `blood_tithe / pulse_draw` 数值，并把 `wild_mana_stitch` 返 MP 改成条件触发或继续后置；`reorder` P0 只保留文案/标签，不实现强找牌。

## 1. 当前源码简化模型

### 1.1 牌组与资源

当前源码基线：

- `startingHand = [debt_hook, heartbeat_spark, redline_cut, row_cleave]`。
- `HAND_SIZE = 4`。
- `player.maxEnergy = 3`，每回合发牌时回到 3 MP。
- 完成 `0 -> 1 -> 2` 后给 `tempAuthorizationMP += 3`，且 `authorizationRestriction = payoff-only`。
- payoff 只定义为 `3 MP / all-enemies / burst`：`severance_burst` 与 `red_ledger_burst`。
- `blood_tithe` 已是 `reward`，`0 MP / self / draw 1 / damage 0`。
- `pulse_draw` 已是 `reward`，`1 MP / self / draw 1 / damage 0`；接在 0 后按倍率实际抽 2。
- `paper_shatter / lantern_captain` 带 `reorder` 标签，但当前 runtime 没有真实重排选择。
- `wild_gap_key` 是 `1 MP / damage 1 / wild`。
- `wild_mana_stitch` 是 `0 MP / wild / draw 1 / current MP +1`，当前返 MP 不是条件触发。

### 1.2 奖励节奏

当前 `LEVEL_XP_THRESHOLDS = [0, 12, 24, 42, 72, 110]`，首奖阈值 12 XP。按前序数值分析，玩家通常在第 2-3 回合触发首奖。

当前默认 `rewardCardPool` 首奖为：

```text
blood_tithe / severance_burst / spark_tap
```

如果玩家先选 `blood_tithe`，下一次 repair 槽会推到 `pulse_draw`；如果再往后拿 repair，才逐步接近 Wild 修补牌。这个顺序对压力是有利的，因为最万能的 `wild_mana_stitch` 被放到了后面。

### 1.3 敌人压力

初始前排 5 个敌人的总意图约 17：

```text
Debt Wisp 2 + Redline Brute 5 + Pulse Collector 3 + Debt Wisp 2 + Redline Brute 5 = 17
```

抽牌修补牌本身不造成伤害，不直接降低 `enemyIntentSummary.totalDamage`。因此它们的平衡前提是：抽牌只是在 17 点左右的压力下找答案；若后续没有击杀、完成授权或打出 payoff，结束回合仍要吃伤害。

## 2. 简化概率估算

我使用的估算模型：

- 把牌库视为随机排列，前 4 张为手牌，剩余为抽牌堆。
- 统计三类指标：
  - 自然成链：手牌直接有 `0 / 1 / 2`。
  - 可修补成链：允许按当前 draw/wild 规则在本回合完成 `0 -> 1 -> 2`。
  - 授权 payoff：完成授权后同回合能打出 3 MP payoff。
- 这不是 runtime 随机性声明；当前 demo 仍有很多确定性发牌。它只是用于判断“卡池密度变高后，坏手被压低到什么程度”。

| 牌库状态 | 自然成链 | 可修补成链 | 硬坏手 | 授权 payoff |
| --- | ---: | ---: | ---: | ---: |
| 起始牌库 `0/1/1/2` | 100% | 100% | 0% | 0% |
| `+ blood_tithe` | 约 80% | 约 100% | 约 0% | 0% |
| `+ pulse_draw` | 约 60% | 约 80% | 约 20% | 0% |
| `+ blood_tithe + pulse_draw` | 约 61% | 约 93% | 约 7% | 0% |
| `+ blood_tithe + payoff` | 约 53% | 约 73% | 约 27% | 约 54% |
| `+ blood_tithe + pulse_draw + payoff` | 约 43% | 约 77% | 约 23% | 约 70% |
| `+ blood_tithe + pulse_draw + wild_gap_key` | 约 46% | 约 86% | 约 14% | 0% |
| `+ blood_tithe + pulse_draw + wild_mana_stitch` | 约 52% | 约 97% | 约 3% | 0% |

读法：

1. `blood_tithe` 很稳，但它主要修“缺 2 且牌堆能抽到 2”的情况；因为 0 费、无伤害，压力仍来自后续是否兑现。
2. `pulse_draw` 更健康，因为它必须先有 0 费起手，仍保留“缺 0 起手”的硬坏手。
3. `blood_tithe + pulse_draw` 已经足够让抽牌修补层成立，硬坏手约 7% 是可以接受的 P0 稳定性。
4. `wild_mana_stitch` 一加入，硬坏手会被压到约 3%，且它还返 MP。这个强度接近“早期万能保险”，不应再增强。

## 3. 风险判断

### 3.1 坏手风险

P0 需要保留两类坏手：

- 起手缺 0：`pulse_draw / 1 / 2 / payoff` 这类手牌不能被 1 MP draw 自动救回来。
- 抽牌没兑现：`blood_tithe` 或 `pulse_draw` 找到了牌，但没有足够 MP、没有 2 费段、没有 payoff，结束回合仍吃意图。

如果所有 repair 都能启动、补缺口、抽牌、返 MP，坏手就只剩“玩家看错牌”的 UI 问题，而不是卡牌机制问题。

### 3.2 断链风险

当前断链惩罚主要是倍率回到 1，并且无法触发 `0 -> 1 -> 2` 授权。这个惩罚必须继续存在。

危险点：

- `wild_mana_stitch` 当前作为 0 费 Wild，在空链时也能按 0 费启动；这会增加 0 费入口密度。
- 它在修补时还能抽牌和返 MP，使“缺 1”不再是代价，而是收益。
- 如果允许多次 Wild 修补都触发返 MP，断链压力会进一步下降。

P0 不应让 Wild 同时承担“起手、修补、抽牌、返费、找 payoff”五个职责。

### 3.3 过强修补风险

过强修补的实际表现不是玩家不再受伤，而是敌意图失去威胁感：

- 玩家看到 17 点意图，但知道抽牌和 Wild 总能补齐链。
- 3 MP 约束被 `wild_mana_stitch` 的当前 MP +1 稀释。
- 2 MP `reorder` 如果变成强 tutor，`paper_shatter / lantern_captain` 会从“支援牌”变成“找终结按钮”。
- 早期 `blood_tithe + pulse_draw + payoff` 已能把授权 payoff 率推到约 70%；再加 Wild/reorder，容易越过 80%。

早期 payoff 太稳定会让敌人压力从“本回合后果”变成“等待玩家清屏的背景数值”。

## 4. P0 推荐数值

### 4.1 保持 draw repair 当前值

| 卡 | P0 数值 | 理由 |
| --- | --- | --- |
| `blood_tithe` | `0 MP / draw 1 / damage 0 / no energyGain / reward only` | 可把缺 2 的坏手拉回，但不直接减压。 |
| `pulse_draw` | `1 MP / draw 1 / damage 0 / no energyGain / reward only`，接 0 后实际抽 2 | 需要先有 0 起手，仍保留硬坏手。 |

不要把两张牌加入 `startingHand`，不要加伤害，不要返 MP，不要给 Wild。

### 4.2 Wild 不再增强

| 卡 | P0 建议 |
| --- | --- |
| `wild_gap_key` | 保持 `1 MP / damage 1 / wild / no draw / no energyGain`。若必须增强触感，上限只到 `damage 2`，且不能和 `wild_mana_stitch` 条件返 MP、reorder 同批。 |
| `wild_mana_stitch` | 不再增强；建议后续改为“只有真实 `ChainRepaired` 时才 `current MP +1`”，且每回合最多触发一次返 MP。若不改条件，就继续放在 reward 池后段。 |

`wild_mana_stitch` 当前已经是最高风险牌。P0 不应给它额外 draw、额外 reorder、额外伤害或更早奖励位置。

### 4.3 Reorder 暂不做强运行时

当前 `reorder` 只作为 `utilities` 和 HUD 文案存在，P0 建议保持这个边界。

如果必须实现，最低限度只能是：

```text
查看/调整抽牌堆顶 2 张，不额外抽，不从全牌堆搜索，不从弃牌堆搜索。
```

不建议 P0 做：

```text
从抽牌堆任意选择 1 张加入手牌
抽 3 后任意重排剩余牌堆
从弃牌堆找 2 费段或 payoff
```

原因是 2 MP 支援牌在正确接链时已经会按倍率抽 3。再给强 tutor，会把“找终结”变成高确定性动作。

### 4.4 目标区间

建议用以下区间判断后续调参是否越界：

| 指标 | P0 目标 |
| --- | ---: |
| 首奖前硬坏手 | 0%，因为起手教学固定 `0/1/1/2` |
| 单张 draw repair 后硬坏手 | 0%-25%，取决于选 `blood_tithe` 还是 `pulse_draw` |
| 两张 draw repair 后硬坏手 | 5%-15% |
| 两张 draw repair + Wild 后硬坏手 | 不应低于 5%，低于 5% 说明修补过密 |
| 早期 `draw repair + payoff` 授权 payoff 率 | 50%-75% |
| 早期三张奖励后授权 payoff 率 | 不应长期高于 80% |
| self draw 打出当下的意图下降 | 必须是 0 |

## 5. 需要的测试与小模拟

### 5.1 小模拟

建议新增一个非产品脚本或 Vitest 内部 helper，枚举/采样以下牌库：

```text
starting
starting + blood_tithe
starting + pulse_draw
starting + blood_tithe + pulse_draw
starting + blood_tithe + pulse_draw + severance_burst
starting + blood_tithe + pulse_draw + wild_gap_key
starting + blood_tithe + pulse_draw + wild_mana_stitch
starting + blood_tithe + pulse_draw + severance_burst + paper_shatter
```

每个牌库统计：

- 自然成链率。
- 可修补成链率。
- 硬坏手率。
- 授权 payoff 率。
- self draw 后未解决意图的平均值。

这个模拟不需要接 UI，也不需要随机种子进入产品逻辑；它只用于数值回归，避免后续改 Wild/reorder 时无意把硬坏手压到 0。

### 5.2 Vitest 合同

建议补以下合同测试：

1. `blood_tithe / pulse_draw` 不改变 `maxEnergy`，不直接降低 `enemyIntentSummary.totalDamage`。
2. `pulse_draw` 在无 0 起手时不能凭空完成 `0 -> 1 -> 2`。
3. `debt_hook -> pulse_draw` 可以抽 2 找 2 费段，但如果牌堆没有 2，结束回合压力仍保留。
4. `wild_mana_stitch` 如果后续改条件返 MP，必须覆盖：
   - 空链打出不返 MP。
   - 真实修补 `expectedCost` 时返 MP。
   - 断链后不返 MP。
   - 同回合第二次 Wild 不重复返 MP。
5. `paper_shatter / lantern_captain` 当前不能产生真实 reorder 事件；若未来实现，测试必须证明它不是全牌堆 tutor。

### 5.3 压力切片

需要两个固定体验切片：

```text
切片 A：draw repair 成功但不清压
hand = debt_hook / pulse_draw / filler / filler
drawPile = row_cleave
期望：能完成 0 -> 1 -> 2，但 self draw 本身不降意图；若没有 payoff，结束回合仍有剩余伤害。
```

```text
切片 B：Wild 过强警戒
hand = debt_hook / wild_mana_stitch / row_cleave / severance_burst
期望：记录它是否同时完成修补、抽牌、返 MP、授权 payoff；若这条路线过稳，应先削条件返 MP，而不是增强其他修补。
```

## 6. 最终裁决

开放 draw repair 后，`blood_tithe / pulse_draw` 的稳定性处在可接受范围；它们让坏手变成“可修补”，但没有直接清掉敌意图。

不应在同一阶段继续增强 Wild/reorder。尤其 `wild_mana_stitch` 当前已经把硬坏手率压到接近 3% 的风险区间；如果再给强 reorder 或更多返 MP，敌人压力会被牌库稳定性吞掉。第 6 轮 P0 应该先锁住数值护栏和模拟指标，再考虑是否做 Wild 条件返 MP的小补丁。

STATUS: DONE

路径：`/Users/roc/Game-001/design/technical/redline-batches/long-task/2026-05-18-round-06-08-balance-probability.md`
