# 2026-05-18 Round 04 Expert 05：抽牌倍率与卡面真实反馈 UX

身份：第 4 轮专家 05，抽牌倍率与卡面真实反馈 UX 设计师  
工作目录：`/Users/roc/Game-001`  
边界：只读源码与既有设计文档；不修改源码，不提交 git。  
审查范围：`drawCards` / `effectMultiplier` / card UI，重点卡为 `blood_tithe`、`pulse_draw`、`paper_shatter`。

## 1. 一句话结论

当前运行时事实是：自身抽牌牌的请求抽牌数 = `card.drawCards * CardPlayed.effectMultiplier`。这三张牌的 `drawCards` 都是 1，所以正确链路下分别是：

| 卡 | 正确链路位置 | 倍率 | 请求抽牌 | 玩家应看到的短反馈 |
| --- | --- | ---: | ---: | --- |
| `blood_tithe` | 起手 `MP0` | x1 | 1 | `起x1 抽1` / `抽1找MP1` |
| `pulse_draw` | `MP0 -> MP1` 的 1 费承接 | x2 | 2 | `接x2 抽2` / `抽2找MP2` |
| `paper_shatter` | `MP0 -> MP1 -> MP2` 的 2 费展开 | x3 | 3 | `接x3 抽3` / `抽3找终结` |

风险不是数值错误，而是卡面现在静态写 `抽1`，HUD 只分开显示 `接链 x2/x3` 和 `抽牌找解`，没有把两者合成“当前实际抽几张”。玩家会觉得自己莫名多抽，或者认为卡面欺骗。

## 2. 源码事实基线

### 2.1 三张牌的基础定义

- `blood_tithe`：`cost: 0`、`targets: self`、`chainRole: starter`、`drawCards: 1`、`rulesText: 抽1。开链找牌。`、`mobileEffect: 抽1`。来源：`prototype-web/src/data/cards.ts:42-60`
- `pulse_draw`：`cost: 1`、`targets: self`、`chainRole: bridge`、`drawCards: 1`、`rulesText: 抽1。接链找2费。`、`mobileEffect: 抽1`。来源：`prototype-web/src/data/cards.ts:139-158`
- `paper_shatter`：显示名 `Paper Route`，`cost: 2`、`targets: self`、`chainRole: expand`、`drawCards: 1`、`utilities: ['draw', 'reorder']`、`rulesText: 抽1。整备找终结。`。来源：`prototype-web/src/data/cards.ts:198-216`

### 2.2 倍率如何进入抽牌

`CardPlayed` 先由 `advanceCostChain` 写入 `effectMultiplier`，连续费用链从首张 x1 开始，每正确接下一段加 1；断链回到 x1。来源：`prototype-web/src/sim/runtime.ts:204-252`、`prototype-web/src/sim/runtime.ts:930-955`

ECA 的 self resource 规则把抽牌命令写成：

```text
DrawCards.count = card.drawCards * event.effectMultiplier
```

来源：`prototype-web/src/eca/redlineRules.ts:150-164`

### 2.3 “实际抽到”不是总等于请求数

`drawCardsFromDeck` 会从 `drawPile.shift()` 抽到请求数量为止；抽牌堆空时从弃牌堆续抽；若抽牌堆和可重洗弃牌都不够，会少抽。来源：`prototype-web/src/sim/runtime.ts:162-184`

另外，抽牌命令由 `CardPlayed` 触发时，会把刚打出的牌加入 `excludeFromReshuffle`，避免空牌堆时立刻把自己洗回并抽回来。来源：`prototype-web/src/sim/runtime.ts:520-524`、`prototype-web/src/sim/runtime.ts:841-846`

因此 UX 文案要区分：

```text
请求抽牌：抽N
实际入手：抽到N，或牌堆不足时抽到M
```

卡面可以预览 `抽N`，战斗日志/HUD 结算应显示真实 `抽到M`。

## 3. 三张牌在连锁下到底抽几张

### 3.1 `blood_tithe`

`blood_tithe` 是 0 费起手抽牌。它只有在费用链还没开始时能正确开链：

| 局面 | 链路结果 | `effectMultiplier` | 请求抽牌 |
| --- | --- | ---: | ---: |
| 第一张打出 `blood_tithe` | 起链 | x1 | 1 |
| 已打出 0 费后再打 `blood_tithe` | 期望 1，打了 0，断链 | x1 | 1 |
| 已打出 0->1 后再打 `blood_tithe` | 期望 2，打了 0，断链 | x1 | 1 |

结论：它不应该被包装成“倍率抽牌牌”。它是稳定开链和找 1 费段的牌，真实表达应是 `抽1找MP1`。如果 HUD 显示 `起链 x1`，旁边再显示 `抽1` 就足够。

### 3.2 `pulse_draw`

`pulse_draw` 是 1 费承接抽牌。它只有接在 0 费后才吃到 x2：

| 局面 | 链路结果 | `effectMultiplier` | 请求抽牌 |
| --- | --- | ---: | ---: |
| 第一张打出 `pulse_draw` | 非 0 起手，断链/非起手 | x1 | 1 |
| `MP0 -> pulse_draw` | 正确接链 | x2 | 2 |
| `MP0 -> MP1 -> pulse_draw` | 期望 2，打了 1，断链 | x1 | 1 |

测试已覆盖 `debt_hook -> pulse_draw` 后 `pulse_draw.effectMultiplier = 2`，并按 `drawCards * 2` 抽牌。来源：`prototype-web/src/tests/sim/runtime.test.ts:160-185`

结论：`pulse_draw` 的卡面静态可保留基础 `抽1`，但 HUD 当前态必须显示 `接x2 抽2` 或 `抽2找MP2`。只写 `抽1。接链找2费。` 不够真实。

### 3.3 `paper_shatter`

`paper_shatter` 是 2 费展开抽牌。它接在完整 `0 -> 1` 后会 x3：

| 局面 | 链路结果 | `effectMultiplier` | 请求抽牌 |
| --- | --- | ---: | ---: |
| 第一张打出 `paper_shatter` | 非 0 起手，断链/非起手 | x1 | 1 |
| `MP0 -> paper_shatter` | 期望 1，打了 2，断链 | x1 | 1 |
| `MP0 -> MP1 -> paper_shatter` | 正确接链 | x3 | 3 |
| `MP0 -> MP1 -> MP2 -> paper_shatter` | 期望 3，打了 2，断链 | x1 | 1 |

现有测试确认 `paper_shatter / lantern_captain` 只是 self draw support：虽然有 `reorder` 标签，但不会产生 reorder command/event。来源：`prototype-web/src/tests/sim/redline-progression-card-system.test.ts:276-292`

结论：`paper_shatter` 正确链下不是“抽1整备”，而是“抽3找终结”。可见文案不能承诺重排；`整备` 若保留，只能作为风味词，不可让玩家理解成选择牌库顶或重排抽牌堆。

## 4. 当前 HUD 表达问题

当前手牌按钮会同时渲染：

- `chain-preview`：`起链 x1`、`接链 x2`、`断链 x1`。来源：`prototype-web/src/ui/hud.ts:943-967`
- `card-intent-preview`：无伤害抽牌牌统一显示 `抽牌找解`。来源：`prototype-web/src/ui/hud.ts:328-346`
- `card-effect`：来自 `mobileEffect`，所以仍是基础 `抽1` 或 `抽1 整备`。来源：`prototype-web/src/ui/hud.ts:822-858`、`prototype-web/src/ui/hud.ts:1054-1068`
- 战斗日志只写 `出牌 X · 倍率 xN`，不写本次抽了几张。来源：`prototype-web/src/ui/hud.ts:1144-1149`

这会造成三个 UX 缺口：

1. 玩家要自己把 `接链 x2` 和 `抽1` 相乘，才知道 `pulse_draw` 实际抽 2。
2. 移动端会隐藏 `.card-effect` 和 `.card-payoff`，更依赖 `chain-preview` / `card-intent-preview`；如果 `card-intent-preview` 仍是泛化 `抽牌找解`，小屏完全看不到抽牌数量变化。
3. `paper_shatter` 的 `整备` 容易被读成真实 reorder，但 runtime 当前没有 reorder 行为。

## 5. 推荐短文本合同

### 5.1 卡面静态文案

静态文案只表达基础规则和用途，不直接承诺所有动态倍率。

| 卡 | `rulesText` 建议 | `mobileEffect` 建议 | 说明 |
| --- | --- | --- | --- |
| `blood_tithe` | `抽1。开链。` | `抽1` | 保持最短；不要写倍率。 |
| `pulse_draw` | `抽1。接链抽2。` | `抽1` | 规则短文案点明正确链下会变成抽 2。 |
| `paper_shatter` | `抽1。接链抽3。` | `抽1找终结` | 不写重排；`找终结` 比 `整备` 更真实。 |

如果未来加 `shortName`，移动端中文短名建议：

| 卡 | 短名 |
| --- | --- |
| `blood_tithe` | `献血` |
| `pulse_draw` | `脉冲` |
| `paper_shatter` | `纸路` 或 `找终结` |

### 5.2 HUD 当前态文案

当前态文案应使用 `chainRead.multiplier` 计算实际请求抽牌数：

```text
drawPreview = card.drawCards * chainRead.multiplier
```

推荐显示：

| 当前态 | `blood_tithe` | `pulse_draw` | `paper_shatter` |
| --- | --- | --- | --- |
| 正确接链 | `起x1 抽1` | `接x2 抽2` | `接x3 抽3` |
| 找下一段 | `抽1找MP1` | `抽2找MP2` | `抽3找终结` |
| 断链 | `断x1 抽1` | `断x1 抽1` | `断x1 抽1` |
| 牌堆不足结算 | `抽到0/1` | `抽到0-2` | `抽到0-3` |

`card-intent-preview` 对抽牌牌不应继续泛化为 `抽牌找解`。更好的移动短句是：

```text
抽1找MP1
抽2找MP2
抽3找终结
```

这些都在 6 个中文等宽字符左右，适合 98px 高的移动手牌卡。

### 5.3 战斗日志 / HUD 结算反馈

建议把 `HandDealt` 用途拆清：

| 事件来源 | 当前风险 | 建议短文案 |
| --- | --- | --- |
| 回合发牌 | `发牌 N 张，进入出牌` 可以保留 | `发牌N` |
| 出牌触发抽牌 | 仍叫 `HandDealt`，玩家不知是抽牌效果 | `抽到N` |
| 倍率抽牌 | 只显示 `倍率 xN`，没说抽牌数 | `x2 抽到2` / `x3 抽到3` |
| 牌堆不足 | 没有解释为什么少抽 | `牌堆空 抽到1` |

不要把长句塞进卡面。长解释放 tooltip/detail：

```text
基础抽1；当前接链 x2，所以抽2。
牌堆不足时只抽到可用牌。
```

## 6. 避免中文超框的具体规则

当前 `.card-button` 固定高 98px、`overflow: hidden`，文本节点多为单行省略。移动端单卡 `min(232px, 78vw)`，且 `.card-effect` / `.card-payoff` 会隐藏。来源：`prototype-web/src/style.css:984-1003`、`prototype-web/src/style.css:1095-1131`、`prototype-web/src/style.css:1571-1588`

因此本轮建议用 token 而不是句子：

| 类型 | 推荐 | 避免 |
| --- | --- | --- |
| 链路 | `起x1`、`接x2`、`断x1` | `接链后本次效果倍率提升到 x2` |
| 抽牌 | `抽2`、`抽3` | `续链时抽牌变强` |
| 找牌目标 | `找MP2`、`找终结` | `帮助继续寻找2费段或终结牌` |
| 牌堆不足 | `抽到1`、`牌堆空` | `由于抽牌堆和弃牌堆不足，本次没有抽满` |
| reorder 边界 | `找牌` | `重排抽牌堆`、`选择牌库顶` |
| 授权支付 | `授权付` | `终局授权支付` |

移动端单张卡建议最多显示两条动态信息：

```text
接x2
抽2找MP2
```

或：

```text
接x3
抽3找终结
```

不要同时显示 `接链 x3 + 抽牌找解 + MP 2 · 抽1找终结 + 终局授权可用`。这会在 98px 高卡面内互相挤压，最后依赖省略号裁掉关键事实。

## 7. P0 裁决

1. `blood_tithe`：卡面保持 `抽1`，HUD 显示 `抽1找MP1`。它不是倍率爆抽牌，不需要额外强调连锁抽牌。
2. `pulse_draw`：HUD 必须在正确接链时显示 `抽2`。推荐移动短句 `抽2找MP2`，桌面 tooltip 写 `基础抽1；接链x2，所以抽2`。
3. `paper_shatter`：HUD 必须在 `0->1->2` 位置显示 `抽3`。推荐移动短句 `抽3找终结`。可见文案不写 `重排`。
4. 当前日志应补一条实际入手反馈：`x2 抽到2`、`x3 抽到3`，牌堆不足时显示 `抽到M`，不要只显示倍率。
5. 中文短文本上限：动态卡面单行 6-8 字；超过就拆到 tooltip/detail，不在 `.card-button` 主体显示。

## 8. 验收建议

### 8.1 Sim 验收

- `blood_tithe` 首张出牌：`CardPlayed.effectMultiplier = 1`，请求 `DrawCards.count = 1`。
- `debt_hook -> pulse_draw`：`pulse_draw.effectMultiplier = 2`，请求 `DrawCards.count = 2`，实际 `HandDealt.cardIds.length <= 2`。
- `debt_hook -> redline_cut -> paper_shatter`：`paper_shatter.effectMultiplier = 3`，请求 `DrawCards.count = 3`，实际 `HandDealt.cardIds.length <= 3`。
- `paper_shatter` 不产生任何 reorder command/event；除非 runtime 真实现重排，否则 UI 不出现“重排抽牌堆”。

### 8.2 HUD 文案验收

- 移动端 `pulse_draw` 正确接链时可见 `抽2`，不能只看到 `抽1` 或 `抽牌找解`。
- 移动端 `paper_shatter` 正确接链时可见 `抽3` 或 `抽3找终结`。
- 断链时三张牌都回到 `抽1`，HUD 不继续显示上一次倍率。
- 牌堆不足时日志显示真实 `抽到M`，而不是只显示理论 `抽N`。
- 390x844 与 360x640 下，`抽2找MP2`、`抽3找终结`、`断x1抽1` 不触发按钮内文字重叠。

STATUS: DONE
