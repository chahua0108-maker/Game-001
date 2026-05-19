# 2026-05-18 Round 08-03：paper_shatter 极窄置顶数值护栏

角色：第 8 轮专家 03，Balance Probability Analyst  
工作目录：`/Users/roc/Game-001`  
边界：只新增本文档；不修改源码、不提交 git、不回滚或覆盖其他工作者改动。  
问题：从坏手率、授权 payoff 率、敌人意图压力评估 `paper_shatter` 极窄置顶是否可上线，并给出 P0/P1/P2 参数、上线/不上线裁决、必须保留的失败率。

## 0. 裁决

`paper_shatter` 极窄置顶可以进入 **条件性 P0 上线**，但只允许作为一张牌的受限样片，不允许顺手扩成完整 `SearchAndTopdeck` 系统。

P0 上线条件：

- 只启用 `paper_shatter`。
- 只在本次出牌合法延续并完成 `0 -> 1 -> 2` 授权链时触发。
- 只搜索 `drawPile`。
- 只找 1 张 3 MP / all-enemies / burst payoff：`severance_burst` 或 `red_ledger_burst`。
- 只在 `DrawCards` 前把命中的 payoff 移到 `drawPile[0]`，不额外抽牌。
- 不搜索 `discardPile`，不搜索 `hand`，不从全牌库生成或复制牌。
- 不启用 `lantern_captain` 的真实置顶。
- 每回合最多触发 1 次 topdeck。
- miss 必须是可见结果，不允许静默补偿。

一句话判断：

```text
可以上线 P0 极窄 paper_shatter；
不上线完整 SearchAndTopdeck；
不上线 lantern_captain；
不上线 discardPile / full-deck tutor。
```

## 1. 当前数值基线

当前已知基线：

- 手牌 4 张，默认 `maxEnergy = 3`。
- 起始牌组 `debt_hook / heartbeat_spark / redline_cut / row_cleave` 能稳定教学 `0 -> 1 -> 2`。
- 完成未断裂 `0 -> 1 -> 2` 后获得 `tempAuthorizationMP += 3`，限制为 `payoff-only`。
- payoff 集合是 3 MP / all-enemies / burst：`severance_burst`、`red_ledger_burst`。
- `blood_tithe / pulse_draw` 已经让抽牌修补成立。
- `paper_shatter` 是 2 MP self draw，接在 `0 -> 1` 后按倍率抽 3，本身不造成伤害、不降低敌人意图。
- 初始前排总意图约 17 点。

第 6-7 轮已经给出的概率区间可以作为护栏：

| 牌库状态 | 链路坏手 | 授权 payoff 率 | 读法 |
| --- | ---: | ---: | --- |
| `blood_tithe + pulse_draw` | 约 7%-25% | 0% | 能修链，但没有终结，敌意图仍压着玩家。 |
| `blood_tithe + payoff` | 约 25%-30% | 约 50%-55% | 有爆点，但会错过授权窗口。 |
| `blood_tithe + pulse_draw + payoff` | 约 20%-25% | 约 65%-70% | 已经稳定，仍保留承压找解空间。 |
| `paper_shatter` drawPile-only payoff topdeck | 约 20%-30% | 约 72%-78% | 多一部分授权后清压，仍可接受。 |
| `paper_shatter` 搜 drawPile + discardPile | 约 15%-25% | 约 78%-85% | 压力开始变薄。 |
| 两张 2 MP self draw 都可 tutor | 约 5%-20% | 约 85%-95% | 不应 P0。 |

关键判断：`paper_shatter` 置顶不主要降低“缺 0 / 缺 1”的链路坏手，它主要删除“完成授权但没有 payoff”的失败。这个失败不能被删干净。

## 2. 三条风险线

### 2.1 坏手率

P0 不需要把坏手率继续压低。当前 draw repair 已经让多数坏手可修，极窄 topdeck 只应修一小段授权后空窗。

必须保留的失败：

| 失败类型 | P0 是否保留 | 目标失败率 |
| --- | --- | ---: |
| 缺 0 起手 | 保留 | 8%-15%，进入奖励后仍应出现。 |
| 缺 1 承接 | 保留 | 5%-10%，不由 `paper_shatter` 修。 |
| 完成授权但 drawPile 没有 payoff | 保留 | 8%-15%。 |
| payoff 已在弃牌堆或已被消耗 | 保留 | 100% 保留 miss，不从 discard 找回。 |
| self draw 后没有直接解压 | 保留 | 至少 15%-25% 的相关回合。 |

如果 P0 置顶后整体硬坏手长期低于 8%，说明 `paper_shatter`、Wild、draw repair 的密度叠加过强，应优先关小 topdeck，而不是继续调敌人血量。

### 2.2 授权 payoff 率

P0 目标不是“玩家完成授权就必然清场”，而是“玩家偶尔能用整备把授权转成爆点”。

建议区间：

| 阶段 | 健康区间 | 警戒线 | 处理 |
| --- | ---: | ---: | --- |
| 首奖前 | 0%-20% | >30% | payoff 太早，检查奖励顺序或固定脚本。 |
| 1-2 张奖励后 | 55%-75% | >78% | P0 上限附近，只允许 `paper_shatter` 单卡。 |
| `paper_shatter` P0 后早期 | 72%-78% | >80% | 不准再接 `lantern_captain` 或 discard search。 |
| 3 张奖励后 | 75%-85% | >85% | 进入过稳区，需要保留 miss 或削搜索范围。 |
| 两张 topdeck 牌后 | 不建议 P0 | >88% | 延后到 P2，并同步提高代价。 |

上线硬线：

```text
P0 实测授权 payoff 率 <= 78%：可上线。
P0 实测授权 payoff 率 79%-82%：只可灰度/样片，不进默认奖励前段。
P0 实测授权 payoff 率 > 82%：不上线，先收窄触发条件或降低抽牌倍率。
```

### 2.3 敌人意图压力

敌人意图必须继续是失败压力，不是等待 payoff 清屏的背景数字。

P0 必须满足：

- `paper_shatter` 本身造成 0 伤害。
- `paper_shatter` 打出后，若没有同回合打出 payoff，本回合敌人意图不应下降。
- miss 时必须让玩家看到“整备失败 / 未找到终结 / 意图仍为 X”。
- 至少保留一条固定切片：玩家完成 `0 -> 1 -> paper_shatter`，但 drawPile 没有 payoff，结束回合仍承受高意图。

压力护栏：

| 指标 | P0 下限 |
| --- | ---: |
| `paper_shatter` 相关回合中，miss 后仍吃意图的比例 | 15%-25% |
| 初始 17 点意图在无 payoff 情况下被 self draw 直接降低 | 必须 0 |
| 连续 3 回合都通过 topdeck 转 payoff 清压 | 不应成为常态，目标 <10% |
| 玩家空过或错链的死亡压力 | 必须保留，不能靠 topdeck 追平 |

## 3. P0 参数

P0 是可上线的最窄版本：

| 参数 | P0 值 |
| --- | --- |
| 生效牌 | `paper_shatter` only |
| 触发时机 | `CardPlayed(paper_shatter)` 后、`DrawCards` 前 |
| 链路条件 | 本次出牌有效完成或延续到完整 `0 -> 1 -> 2`，且 `chain.broken === false` |
| 支付条件 | 正常支付 2 MP；不能用 payoff-only 授权支付 `paper_shatter` |
| 搜索区域 | `drawPile` only |
| 搜索目标 | 第一张 3 MP / all-enemies / burst payoff |
| 命中行为 | 从原位置移到 `drawPile[0]` |
| miss 行为 | 发 miss 事件；继续按原本抽牌结算 |
| 抽牌数量 | 不变，仍为 `drawCards * effectMultiplier` |
| 每回合次数 | 最多 1 次 |
| 排除 | 不包含 source card，不复制卡，不从 discard/hand/search-all 找牌 |
| HUD 文案 | 成功：`置顶终结`；失败：`未找到终结`；不能写“重排牌库” |

P0 必须保留的失败率：

| 失败 | 下限 |
| --- | ---: |
| 链路硬坏手 | >= 8%-10% |
| 授权后无 payoff | >= 8%-12% |
| self draw 后仍未解压 | >= 15%-25% |
| `paper_shatter` miss | >= 10%-15% |

P0 不允许用敌人削弱来掩盖 topdeck 过强。如果 P0 后敌意图感觉变弱，先回收 `paper_shatter`，不要先加怪。

## 4. P1 参数

P1 只在 P0 数据稳定后考虑，目标是让整备从“单卡样片”变成“小机制”，但仍不做完整 tutor。

允许项：

| 参数 | P1 值 |
| --- | --- |
| `paper_shatter` | 保持 P0，不扩大到 discard |
| `lantern_captain` | 可进入 route-only 验证 |
| route 目标 | 只找非 payoff 的路线段或 repair 段 |
| 搜索范围 | drawPile 前 4-5 张，或 drawPile-only 全域二选一；不能同时扩 search 和扩目标 |
| payoff 率上限 | 不因 `lantern_captain` 超过 80% |
| 下一手链路坏手改善 | 只允许降低 3-6pp |
| UI | 仍是自动 topdeck，不上手动选择 UI |

P1 必须继续保留：

- `lantern_captain` 不找 payoff。
- route topdeck 不保证同回合继续打出。
- route 置顶不能挤掉原本前 3 张里的 payoff，除非明确记录并接受 payoff miss。
- 两张 topdeck 牌不能在同一回合连续触发。

P1 上线硬线：

```text
如果加入 lantern 后早期授权 payoff 率 > 80%，不上线。
如果链路硬坏手 < 8%，不上线。
如果 self draw 后仍未解压的回合 < 15%，不上线。
```

## 5. P2 参数

P2 才讨论完整 `SearchAndTopdeck` 或更接近卡牌游戏的整备系统。

P2 可以研究但不建议默认上线：

| 功能 | P2 边界 |
| --- | --- |
| 搜 `discardPile` | 需要提高代价，或只允许一次性消耗资源。 |
| 玩家手动选择候选 | 需要移动端确认 UI、取消流程、超时/关闭处理。 |
| 两张牌都启用真实 search | 必须职责不同：`paper_shatter = payoff`，`lantern_captain = route`。 |
| route 查询包含 repair | 可以试，但不能同时包含 payoff。 |
| 全牌库 tutor | 默认不建议；除非同步削抽牌数、提高费用或限制每场次数。 |

P2 目标上限：

| 指标 | 上限 |
| --- | ---: |
| 早期授权 payoff 率 | <= 80% |
| 3 张奖励后授权 payoff 率 | <= 85% |
| 链路硬坏手 | >= 8%-10% |
| topdeck miss | >= 10% |
| self draw 后仍未解压 | >= 15% |

超过这些线，整备会从“坏手修补”变成“保底答案”，不适合当前 Redline 的敌意图压力模型。

## 6. 上线 / 不上线清单

### 可以上线

```text
paper_shatter:
  trigger = after CardPlayed before DrawCards
  condition = completed unbroken 0 -> 1 -> 2
  search = drawPile only
  target = first payoff
  move = target to drawPile[0]
  draw = unchanged
  miss = visible event + no compensation
```

上线理由：

- 不降低缺 0 / 缺 1 的链路坏手。
- 只修授权后无 payoff 的一小层失败。
- self draw 本身不降敌意图。
- drawPile-only 仍保留 miss、弃牌区失败和牌区生命周期。

### 不上线

```text
paper_shatter + discardPile search
paper_shatter + hand/full-deck tutor
paper_shatter + extra draw
paper_shatter + damage
paper_shatter + duplicated payoff creation
lantern_captain 同批找 payoff
两张 2 MP self draw 同时真实 topdeck
miss 后自动抽补偿牌
```

不上线理由：

- 会把授权 payoff 率推过 80%-85%。
- 会删除“完成授权但没终结”的核心失败。
- 会让 2 MP self draw 压过 2 MP 攻击段。
- 会削弱 17 点敌意图的倒计时压力。

## 7. 需要保留的失败切片

P0 验收必须至少保留以下失败：

### 切片 A：缺起手失败

```text
hand = pulse_draw / paper_shatter / severance_burst / filler
drawPile = route cards
期望：没有 0 费起手，不能凭 paper_shatter 或 payoff 自动启动。
```

### 切片 B：授权后 miss

```text
hand = debt_hook / redline_cut / paper_shatter / filler
drawPile = no payoff
discardPile = severance_burst
期望：paper_shatter miss；不从 discardPile 找回；抽牌照常；敌意图仍保留。
```

### 切片 C：置顶成功但仍需玩家兑现

```text
hand = debt_hook / redline_cut / paper_shatter / filler
drawPile = filler / severance_burst / filler
期望：severance_burst 被移到 drawPile[0] 并被抽入手；只有玩家同回合打出 payoff 才降低意图。
```

### 切片 D：同回合次数限制

```text
hand = debt_hook / redline_cut / paper_shatter / paper_shatter
drawPile = severance_burst / red_ledger_burst
期望：本回合最多一次 topdeck；第二次不重复保底。
```

### 切片 E：敌压保留

```text
初始意图约 17。
paper_shatter 成功或失败前，本身造成 0 伤害。
若没有打出 payoff，End Turn 后仍按剩余敌意图结算。
```

## 8. 最终结论

`paper_shatter` 极窄置顶可以上线，但它必须是一个有失败率的整备样片，而不是保底 tutor。

最终 P0 裁决：

```text
上线：paper_shatter drawPile-only payoff topdeck。
不上线：lantern_captain、discardPile search、full-deck tutor、extra draw、miss compensation。
保留：>=8%-10% 链路硬坏手、>=8%-12% 授权后无 payoff、>=10%-15% paper_shatter miss、>=15%-25% self draw 后仍未解压。
```

只要实测越过以下任一红线，就应回收 P0：

- 早期授权 payoff 率 > 82%。
- 链路硬坏手 < 8%。
- `paper_shatter` miss < 10%。
- self draw 后仍未解压回合 < 15%。
- 敌人 17 点意图不再迫使玩家做取舍。

STATUS: DONE
