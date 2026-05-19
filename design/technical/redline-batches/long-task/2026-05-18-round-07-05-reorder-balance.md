# 2026-05-18 Round 07-05：reorder 数值与坏手率分析

角色：第 7 轮专家 05，reorder 数值与坏手率分析师  
工作目录：`/Users/roc/Game-001`  
边界：只新增本文档，不改源码，不提交 git。  
问题：估算 `paper_shatter / lantern_captain` 从“抽 3 找牌文案”变成真实 `SearchAndTopdeck` 或抽前置顶后，对坏手率、授权 payoff 率和敌人压力的影响，并给主线程本轮是否落地的数值裁决。

## 0. 结论

不建议本轮把 `paper_shatter` 和 `lantern_captain` 两张一起做成真实全牌堆 `SearchAndTopdeck`。

数值上，当前 `blood_tithe / pulse_draw / payoff` 早期模型已经把授权 payoff 率推到约 65%-70%，硬坏手约 20%-25%。如果再让 2 MP self draw 在完成 `0 -> 1 -> 2` 后稳定把 payoff 顶到牌堆顶，早期 payoff 会进入 75%-85% 区间；若允许搜索弃牌堆、两张都启用、或 `lantern_captain` 也能间接找 payoff，则会逼近 85%-90% 以上。这个区间会把敌人意图从“本回合倒计时压力”压成“等待玩家抽到清屏按钮”的背景数字。

本轮裁决：

- **不落地完整 SearchAndTopdeck。**
- 如果主线程必须要一个 reorder 真机制样片，只做 **P0 极窄版 `paper_shatter`**：只在已接成 `0 -> 1 -> 2` 时触发，只搜索 `drawPile`，只找 1 张 payoff，只在 `DrawCards` 前置顶，不搜 `discardPile`，不做 `lantern_captain`。
- `lantern_captain` 本轮继续保留为文案 / 标签，或只进入 P1 数值验证，不进入本轮实现。

## 1. 简化模型

### 1.1 当前事实

当前 Redline 关键约束：

- 手牌 4 张，基础 `maxEnergy = 3`。
- 起始牌组是 `debt_hook / heartbeat_spark / redline_cut / row_cleave`。
- 正确完成 `0 -> 1 -> 2` 后，本回合获得 `tempAuthorizationMP += 3`，只允许支付 3 MP 全场 burst payoff。
- `blood_tithe` 是 `0 MP / draw 1 / damage 0`。
- `pulse_draw` 是 `1 MP / draw 1 / damage 0`，接在 0 后实际抽 2。
- `paper_shatter` 是 `2 MP / draw 1 / reorder tag`，接在 0 -> 1 后实际抽 3，文案偏“找终结”。
- `lantern_captain` 是 `2 MP / draw 1 / reorder tag`，接在 0 -> 1 后实际抽 3，文案偏“找路线”。
- self draw 本身不造成伤害，不降低 `enemyIntentSummary.totalDamage`。
- 初始前排敌人意图约 17 点。

第 6 轮已经确认：`reorder` 当前没有真实运行时命令；只有 `utilities: ['reorder']`、HUD 文案和测试说明。第 6 轮实际落地的是 Wild 条件返 MP，不是 reorder。

### 1.2 本文指标

本文把“坏手”拆成两层：

| 指标 | 定义 | 受 reorder 影响 |
| --- | --- | --- |
| 链路坏手 | 本回合无法完成 `0 -> 1 -> 2` 授权 | 影响很小，因为 search 发生在打出 2 MP 后 |
| 授权后坏手 | 已完成授权，但没有 payoff 可打 | 影响很大，`paper_shatter` 可直接修这层 |
| 敌人压力 | 打出 self draw 后，本回合仍有多少敌意图需要处理 | 只有打出 payoff 后才明显下降 |

估算使用 4 手牌随机模型，不声明当前 runtime 有随机洗牌。它只是为了比较“当前抽 3”和“抽前置顶 / SearchAndTopdeck”的强度差。

### 1.3 核心公式

当 `paper_shatter` 作为 2 MP 段打出时，它已经完成授权。此时它从“抽 3”升级为“先找 payoff 置顶再抽 3”的增益近似是：

```text
payoff 率增量
≈ P(手里有 0 + 1 + paper，且 payoff 不在手)
  × (1 - 当前抽 3 自然命中 payoff 的概率)
```

如果打出 `paper_shatter` 后剩余可抽区是 R 张：

```text
当前抽 3 命中 payoff ≈ min(3, R) / R
SearchAndTopdeck 命中 payoff = 100%
```

所以：

| 打出后可抽区 R | 当前抽 3 命中 | 置顶命中 | 条件增益 |
| ---: | ---: | ---: | ---: |
| 4 | 75% | 100% | +25pp |
| 5 | 60% | 100% | +40pp |
| 6 | 50% | 100% | +50pp |
| 8 | 37.5% | 100% | +62.5pp |

这说明它的强度会随牌组变厚而上升。早期 8-9 张牌时还只是小幅增强；进入 10-12 张牌后，它会从“抽牌找牌”变成稳定 tutor。

## 2. 数值估算

### 2.1 当前基线

沿用第 6 轮概率文档的早期模型：

| 牌库状态 | 链路坏手 | 授权 payoff 率 | 压力读法 |
| --- | ---: | ---: | --- |
| `blood_tithe + pulse_draw` | 约 7%-25%，取决于是否已有 payoff | 0% | 能成链但没有终结，敌意图仍压着玩家 |
| `blood_tithe + payoff` | 约 25%-30% | 约 50%-55% | payoff 有爽点，但还会错过授权窗口 |
| `blood_tithe + pulse_draw + payoff` | 约 20%-25% | 约 65%-70% | 已经很稳定，但仍有承压找解空间 |

这个基线是健康的：玩家会经常看到“我能抽牌修补，但 self draw 本身不降意图”。敌意图还是真压力。

### 2.2 只把 `paper_shatter` 做成 payoff 置顶

在 8-9 张早期牌库里，`paper_shatter` 路线大致带来：

| 方案 | 链路坏手变化 | 授权 payoff 率变化 | 敌人压力变化 |
| --- | ---: | ---: | --- |
| 当前抽 3，无定向 search | 基本不变，约 20%-30% | 约 68%-72% | 抽 3 可能找不到 payoff，仍会吃意图 |
| `paper_shatter` drawPile-only 置顶 payoff | 基本不变 | 约 72%-78% | 多一部分回合直接清压，仍可接受 |
| `paper_shatter` 搜 drawPile + discardPile | 基本不变 | 约 78%-85% | 授权后失败明显减少，压力开始变薄 |
| `paper_shatter` 全牌堆 / 弃牌堆 tutor | 基本不变 | 约 85%+ | 高意图经常被稳定转成 payoff，过强 |

关键点：`paper_shatter` 不太降低“缺 0 / 缺 1”的坏手，因为它是 2 MP 牌，必须已经有起手和承接才能发挥。它真正压低的是“完成授权但没有 payoff”的坏手。

### 2.3 同时启用 `lantern_captain`

`lantern_captain` 的风险比 `paper_shatter` 更隐蔽。

如果它只“找路线”，它在同回合的价值其实偏低：打出 2 MP 后已经完成授权，再抽路线牌通常没有 MP 继续打。它更像给下一手铺路。

但如果实现成抽前置顶，它会出现两个问题：

1. **找路线会挤占抽 3 的 payoff 槽。** 如果 payoff 原本在前 3 张，而路线牌在第 4 张，强行把路线顶到第一张，反而可能让 payoff 掉出本次抽 3。
2. **如果 route 查询包含 payoff 或 repair，强度会漂移。** 玩家会把它当成第二张 `paper_shatter`，两张 2 MP self draw 都变成“授权后找答案”。

估算：

| 方案 | 链路坏手 | 授权 payoff 率 | 风险 |
| --- | ---: | ---: | --- |
| `paper_shatter` 真找 payoff，`lantern_captain` 保持文案 | 约 20%-30% | 约 72%-78% | 可控 |
| 两张都 drawPile-only，各自找 payoff / route | 约 18%-28% | 约 75%-82% | 边界开始危险 |
| 两张都可搜弃牌堆 | 约 10%-20% | 约 82%-90% | 过稳 |
| 两张都可全区找目标，且 route 可命中 payoff/repair | 约 5%-15% | 约 88%-95% | 不应 P0 |

因此，`lantern_captain` 不适合本轮和 `paper_shatter` 一起落地。它应该等 `paper_shatter` 的真实命中率、miss 率、玩家压力反馈跑出来后再做。

## 3. 过强风险

### 3.1 它会把“授权后没终结”的失败删除掉

当前最有价值的压力之一是：

```text
我完成了 0 -> 1 -> 2
但 payoff 不在手
所以我只是获得了机会，不是必然清场
```

`paper_shatter` 如果稳定找 payoff，这层失败会被大幅删除。玩家会从“我在 17 点意图下赌找解”变成“只要我走到 2 MP self draw，就等于拿到终结按钮”。

### 3.2 它让 2 MP self draw 压过 2 MP 攻击段

`row_cleave / clearance_order` 是正常 2 MP 段：它们直接打前排、完成授权、降低意图。

`paper_shatter / lantern_captain` 是 2 MP self draw：它们本应牺牲即时伤害，换取找牌空间。

如果 self draw 同时能稳定找 payoff，它会变成：

```text
完成授权 + 找终结 + 抽 3 + 不承担手牌随机风险
```

这会让无伤害支援段比攻击段更像最优 2 MP 段。

### 3.3 搜弃牌堆会让错过窗口不再是代价

drawPile-only 至少还有一个约束：payoff 如果已经被打出或被弃掉，本次不一定能再找回来。

如果允许搜 `discardPile`，很多失败都会被改写为“晚一点也能找回来”。这会稀释当前 run 的牌区生命周期，也会让 self draw 的 miss 率过低。

### 3.4 敌人压力会被 payoff 率吞掉

self draw 打出当下不降意图，这是好的压力语言。但 SearchAndTopdeck 的结果如果经常是同回合 payoff，玩家会形成新预期：

```text
敌意图很高
-> 我只要找 paper / lantern
-> 置顶 payoff
-> 授权支付
-> 清掉压力
```

早期 payoff 率如果长期高于 80%，敌人意图就不再像“倒计时”，而像“等待被清算的数值”。

## 4. P0 / P1 / P2 数值建议

### P0：本轮最多只做极窄 `paper_shatter`

建议数值边界：

| 项 | P0 建议 |
| --- | --- |
| 生效牌 | 只允许 `paper_shatter` |
| 生效条件 | 必须是本次出牌完成或延续到 `0 -> 1 -> 2`；断链不触发 search |
| 搜索区域 | 只搜 `drawPile`，不搜 `discardPile`，不搜 `hand` |
| 目标 | 只找 1 张 payoff：`severance_burst / red_ledger_burst` |
| 抽牌 | 仍按现有 `drawCards * effectMultiplier`，不额外抽 |
| 每回合次数 | 每回合最多 1 次 topdeck |
| 目标 payoff 率 | 早期不超过 75%-78% |
| 链路坏手 | 不要求下降；仍保留约 20%+ 的缺 0 / 缺 1 压力 |
| 敌压 | self draw 后若未打出 payoff，HUD / 日志仍必须显示意图未解决 |

P0 的价值是证明“整备真的影响下一抽”，不是让 `paper_shatter` 成为稳定清场按钮。

### P1：`lantern_captain` 延后到 route-only 验证

建议数值边界：

| 项 | P1 建议 |
| --- | --- |
| 生效牌 | `lantern_captain` |
| 目标 | 只找 route，不找 payoff；route 不应包含 3 MP burst |
| 搜索区域 | drawPile-only；可以先限制前 4-5 张，而不是全 drawPile |
| 定位 | 下一手路线稳定，而不是同回合终结 |
| 目标坏手率 | 只允许把下一手链路坏手降低 3-6pp |
| 目标 payoff 率 | 不应因为 lantern 单卡超过 80% |

`lantern_captain` 需要单独验证“找路线不会误伤 payoff 抽取”。否则它可能比 `paper_shatter` 更难调。

### P2：完整 SearchAndTopdeck / 弃牌堆检索

以下都应放到 P2 或更晚：

| 功能 | 建议 |
| --- | --- |
| 搜 `discardPile` | 延后；需要牌区生命周期和 miss 率回归 |
| 两张牌都启用真实 search | 延后；先看 `paper_shatter` 单卡数据 |
| route 查询包含 repair / payoff | 不建议 P0/P1 |
| 玩家选择候选牌 | 延后；需要 UI 状态、移动端验证和取消流程 |
| 搜全牌堆任意目标 | 不建议，除非同步削抽牌数或提高代价 |

P2 目标区间：

| 指标 | 上限 |
| --- | ---: |
| 早期授权 payoff 率 | 不超过 80% |
| 三张奖励后授权 payoff 率 | 不超过 85% |
| 链路硬坏手 | 不低于 8%-10% |
| self draw 后仍未解压的回合 | 至少保留 15%-25% |

低于这些压力线，玩家就会把整备牌视为保底系统，而不是风险选择。

## 5. 是否建议本轮实现

**主裁决：不建议本轮实现完整 reorder。**

本轮如果目标是稳住数值和敌压，最好继续保留 `paper_shatter / lantern_captain` 为文案和奖励池后置牌，先补一份小模拟 / 合同测试设计，确认目标区间。

**条件性例外：**

如果主线程认为第 7 轮必须展示“reorder 不只是标签”，可以只落一个极窄 P0 切口：

```text
paper_shatter:
  已完成 0 -> 1 -> 2 时
  从 drawPile 找第一张 payoff
  置顶
  然后正常抽 3
```

但这个例外必须同时满足：

1. 不接 `lantern_captain`。
2. 不搜弃牌堆。
3. 不提前奖励池位置。
4. 不增加抽牌数。
5. 验收里必须统计 miss：至少有一条切片证明 `paper_shatter` 没找到 payoff 时，敌意图仍然保留。

最终给主线程的数值裁决是：

```text
本轮不落完整 SearchAndTopdeck。
最多只落 paper_shatter 的 drawPile-only payoff topdeck 样片。
lantern_captain 与 discardPile search 延后。
```

STATUS: DONE

路径：`/Users/roc/Game-001/design/technical/redline-batches/long-task/2026-05-18-round-07-05-reorder-balance.md`
