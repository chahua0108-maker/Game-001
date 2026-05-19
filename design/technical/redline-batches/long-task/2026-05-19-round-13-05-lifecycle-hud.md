# 2026-05-19 Round 13-05：生命周期 v1 HUD 短 Token 与三视口验收

角色：第 13 轮专家 05，HUD 生命周期短 token 专家  
工作目录：`/Users/roc/Game-001`  
文件所有权：本文只写 `design/technical/redline-batches/long-task/2026-05-19-round-13-05-lifecycle-hud.md`  
边界：只写文档；不改源码、不改测试、不提交、不回滚或覆盖其他工作者修改。

## 0. 结论

生命周期 v1 进入 HUD 时，不能把“牌为什么离开手牌、去了哪里、之后是否会洗回来”写成卡牌按钮里的长解释。HUD 只显示短 token，完整因果放进 `title`、详情层、combat feed 或 debug。玩家首屏要读到的是：

```text
消耗：消 / 消+1 / 消耗区 1
保留：留 / 下手 / 留1
污染：污 / 污+2 / 污手1
洗回：洗回4 / 弃->抽4
牌区：抽3 弃5 消1 留1 污2
```

本轮推荐的 HUD 合同：

1. 卡牌按钮只承载“这张牌现在怎么影响本次出牌”：费用、角色、chain、压力、支付、生命周期短 token。禁止写生命周期长句。
2. 桌面可以显示完整牌区计数；移动端不把牌区常驻塞进顶部状态条，改由 director / feed / debug / transient chip 承担。
3. `360x640` 是硬准入；`390x844` 是主流复核；`1366x768` 是桌面信息完整性复核。不能因为 390 或桌面通过，就放宽 360。
4. 消耗、保留、状态/污染、洗回、牌区计数必须各有至少一个三视口镜头；不能只在 debug 里证明。
5. “无文字超框”不等于“信息合格”。卡名可以 ellipsis，生命周期主 token 不允许被 ellipsis 吃掉。

## 1. 当前锚点

当前 HUD 已经有短 token 基础，但生命周期 v1 还没有稳定显示合同：

| 当前事实 | HUD 含义 | v1 风险 |
|---|---|---|
| `PlayerState` 目前只有 `deck/hand/drawPile/discardPile`。 | status 牌堆显示为 `牌 deck/draw/discard/hand`，title 是英文 `Deck/Draw/Discard/Hand`。 | 新增 `exhaustPile/retainedCards` 后，原 `四数字` 会失真。 |
| `CardKeyword` 已有 `消耗/保留/状态/净化`。 | 词表允许生命周期概念进入卡牌。 | 如果直接显示完整 `rulesText/detail`，移动卡牌按钮会超框。 |
| `<=640px` 会隐藏 `.pile-chip`。 | 移动端当前不常驻显示牌堆。 | 生命周期 v1 不能依赖被隐藏的牌堆 chip 让玩家理解保留/消耗/污染。 |
| 移动卡牌按钮隐藏 `.card-effect` 和 `.card-payoff`。 | 关键读数必须在 card header/meta/chain/intent/payment 可见行。 | 生命周期 token 不能只放在被隐藏的效果行。 |
| reward panel 和 debug 已有滚动/折叠边界。 | 长说明已有可放位置。 | 不能为了省事把 debug event name 泄漏到玩家 HUD。 |

## 2. 生命周期 HUD 分层

### 2.1 每层职责

| HUD 层 | 生命周期 v1 应显示 | 禁止显示 |
|---|---|---|
| Status strip | HP、MP、授权、CHAIN、意图。桌面可追加一个紧凑牌区 chip。 | 移动端常驻完整牌区、长生命周期解释、raw event。 |
| Combat director | 当前回合的关键生命周期后果：`留1`、`污手1`、`洗回4`、`消耗区1`。 | 牌区长列表、完整牌名、规则句。 |
| Deal panel | 当前阶段按钮与风险，必要时短提示 `留1下手` / `污手1`。 | 两句以上教程、洗回原因长解释。 |
| Card button | 本卡的短生命周期 token：`消`、`留`、`污`、`净`。 | “打出后不会进入弃牌堆并在本场战斗移出抽弃循环”这类长句。 |
| Combat feed | 桌面最近事实：`消耗 Burst`、`保留 Guard`、`洗回4`、`污+2`。 | 移动关键读数、raw `CardMoved` / `DiscardPileShuffledIntoDrawPile`。 |
| Reward panel | 如果奖励牌带生命周期，短摘要先行：`MP1 · 消 · 前排`。 | 把消耗/保留写成完整规则段塞进按钮正文。 |
| Run layer | 当前 run/节点边界：污染是否临时、是否已清理。 | 把节点污染误写成永久诅咒或 meta 成长。 |
| Debug panel | raw reason、from/to zone、traceId、完整事件。 | 默认展开、移动端首屏可见、玩家 HUD 泄漏。 |

### 2.2 短 token 词表

生命周期 token 要稳定、短、可组合。推荐先采用中文短词，不引入英文缩写到玩家层。

| 机制 | 卡牌按钮 token | Director / feed token | 牌区计数 token | 不推荐 |
|---|---|---|---|---|
| 普通弃牌 | 不显示或 `弃` | `弃1` | `弃5` | `打出后进入弃牌堆` |
| 消耗 | `消` | `消耗+1` / `消耗区1` | `消1` | `移出抽弃循环`、`Exhaust` |
| 保留 | `留` | `留1下手` / `保留1` | `留1` | `回合结束后保留到下一手` |
| 状态牌 | `污` | `污手1` / `污+2` | `污2` | `状态/污染牌会占用抽牌位` |
| 净化状态 | `净` | `净化1` | `污-1` | `从所有牌区移除污染牌` |
| 洗回 | 不进卡牌按钮 | `洗回4` / `弃->抽4` | 临时提示 | `弃牌堆洗回抽牌堆并重新抽牌` |
| 节点清污染 | 不进卡牌按钮 | `清污2` | `污0` | `节点结束清理 node-scoped status cards` |

## 3. 卡牌按钮硬边界

卡牌按钮是生命周期 v1 最容易出问题的位置。它必须继续像战斗按钮，而不是说明书。

### 3.1 推荐字段顺序

```text
[卡名]                Burn Route...
[费用/角色/目标]       MP1 · 消 · 前排
[chain/倍率]           接x2 / 修3+ x4 / 断x1
[压力/牌区后果]        12->7 / 抽1仍-12 / 留
[支付状态]             可出 / 授权付 / 缺MP1
```

保留牌示例：

```text
Guard Hold
MP1 · 留 · 自身
接x2
仍-8
可出
```

污染牌示例：

```text
Ash Debt
MP0 · 污 · 自身
断x1
仍-12
可清
```

消耗终结牌示例：

```text
Severance...
MP3 · 消 · 全场
终结x4
17->0
授权付
```

### 3.2 明确禁止写入卡牌按钮的长句

以下内容不允许出现在 `.card-button` 的可见文本里：

| 禁止长句 | 应替换为 |
|---|---|
| `打出后不会进入弃牌堆，并在本场战斗移出抽弃循环。` | `消` |
| `回合结束后保留到下一手并占用下回合手牌位。` | `留` 或 `留1下手` 放 director |
| `这是一张污染状态牌，会占用手牌并在节点结束时清理。` | `污`，节点边界放详情/debug |
| `弃牌堆洗回抽牌堆，排除当前正在结算的牌。` | `洗回N` 放 feed/director |
| `当前牌区：牌库/抽牌堆/弃牌堆/手牌/消耗/保留/污染分别为...` | 桌面 pile chip 或 debug |
| `节点结束时将从手牌、抽牌堆、弃牌堆、消耗区、保留区清理污染牌。` | `清污N` 放 feed/run layer |

卡牌按钮可见文本的判断标准：

- 卡名允许被省略号截断。
- 生命周期 token 不允许被截断：`消`、`留`、`污`、`净` 必须完整可见。
- 不新增第 6 行；新增生命周期信息必须替换角色/效果摘要中的长词。
- 移动端 `.card-effect` / `.card-payoff` 被隐藏时，仍能读到生命周期 token。

## 4. 牌区计数合同

生命周期 v1 后，原 `牌 deck/draw/discard/hand` 四数字不够。HUD 需要区分“运行拥有的卡”和“当前抽弃循环中的卡”。

### 4.1 推荐计数口径

| 计数 | 含义 | 玩家层短 token |
|---|---|---|
| `drawPile.length` | 还能直接抽的牌 | `抽N` |
| `discardPile.length` | 会被洗回的牌 | `弃N` |
| `hand.length` | 当前手牌 | `手N` |
| `exhaustPile.length` | 本节点/本循环外的消耗牌 | `消N` |
| `retainedCards.length` | 下次发牌前先回手牌的保留牌 | `留N` |
| status count | 所有物理牌区中的污染牌数量 | `污N` |
| `deck.length` | run 拥有卡总数，不等于当前抽牌循环 | `总N` 或只进 tooltip |

### 4.2 三档显示

| 视口 | 常驻显示 | 交互/补充显示 | 禁止 |
|---|---|---|---|
| `1366x768` | status pile chip：`抽3 弃5 消1 留1`；如果宽度不足则 `牌 3/5/1/1`。 | title/debug 显示 `总/抽/弃/手/消/留/污` 全量。 | 在 status 写英文 `Draw/Discard/Exhaust/Retain` 长串。 |
| `390x844` | 不常驻完整牌区；director 可短暂显示 `抽3 弃5` 或 `留1下手`。 | reward/debug 关闭；必要时用可点详情面板。 | 恢复 `.pile-chip` 挤压 HP/MP/CHAIN/意图。 |
| `360x640` | 不常驻牌区；只在事件发生后短暂显示 `洗回4`、`留1`、`消1`、`污手1`。 | 牌区全量只能进暂停/详情/debug。 | 用 6 个数字塞进顶部状态条。 |

### 4.3 计数一致性

玩家层不需要看到每个数组名，但 QA 必须能证明计数没有说谎：

```text
可见抽N = drawPile.length
可见弃N = discardPile.length
可见消N = exhaustPile.length
可见留N = retainedCards.length
可见污N = hand/draw/discard/exhaust/retained 中 cardType=status 的总数
```

如果 status/pollution 在 v1 仍只存在测试牌，HUD 也必须按同一口径显示，不要写成“诅咒”或“永久污染”。

## 5. 机制显示合同

### 5.1 消耗

消耗的玩家问题是：“这张牌打完还会不会回来？”

HUD 显示：

- 卡牌按钮：角色/属性位显示 `消`，例如 `MP3 · 消 · 全场`。
- 打出后 director 或 feed：`消耗+1` 或 `消耗区1`。
- 桌面牌区 chip：`消1`。
- 移动端不常驻牌区时，打出后 1-2 秒内能看到 `消耗+1`。

禁止：

- 不在卡牌按钮写“不会进入弃牌堆”。
- 不把消耗写成永久移除，除非机制真的跨节点移除。
- 不让 `消1` 只存在 debug。

### 5.2 保留

保留的玩家问题是：“回合结束后它是否还在，是否占下一手？”

HUD 显示：

- 卡牌按钮：`留`，只表达该卡有保留属性。
- 回合末 director/deal panel：`留1下手`。
- 下一次发牌后：如果 retainedCards 回到 hand，deal panel 可短暂显示 `保留回手1`。
- 牌区计数：桌面 `留1`；移动只在回合末/发牌事件短暂出现。

禁止：

- 不在移动顶部常驻 `保留牌将在下回合先回到手牌并减少补抽数量`。
- 不让保留跨 reward 误读成永久收益。reward 选择/节点切换时应显示普通清理，不显示 `留1下手`。
- 不把 retainedCards 当成 hand 计数提前相加；`手N` 和 `留N` 要能区分。

### 5.3 状态 / 污染

污染的玩家问题是：“这张废牌占了我什么资源，怎么清掉？”

HUD 显示：

- 污染卡牌按钮：`MP0 · 污 · 自身` 或 `MP0 · 净 · 自身`。
- 抽到污染时：director/deal panel 显示 `污手1`。
- 被加入牌区时：feed 显示 `污+2`。
- 打出清理时：feed 显示 `清污1` 或 `污-1`。
- 节点结束清理：run layer/feed 显示 `清污N`，不说永久诅咒。

禁止：

- 不把 `status` 原始类型名显示给玩家。
- 不把节点污染写成 meta 诅咒。
- 不在 card button 写“状态/污染牌会占用抽牌位并在节点结束时清理”。
- 不让污染计数和 deck 总数混在一起导致 `总N` 被误解为永久卡组增加。

### 5.4 洗回

洗回的玩家问题是：“为什么弃牌堆突然变少，抽牌堆又有牌了？”

HUD 显示：

- 洗回不是单张卡属性，不进入 card button。
- 触发洗回时，desktop feed 显示 `洗回4` 或 `弃->抽4`。
- director 可短暂显示 `洗回4`，尤其移动端 feed 隐藏时。
- 如果当前牌因 `excludeFromReshuffle` 留在弃牌，debug 记录完整原因；玩家层不解释。

禁止：

- 不在卡牌按钮写洗回规则。
- 不在移动首屏显示 `DiscardPileShuffledIntoDrawPile`。
- 不承诺随机洗牌顺序；当前实现如果是 deterministic recycle，玩家文案只说 `洗回`，不写“随机洗牌”。

### 5.5 牌区计数

牌区计数的玩家问题是：“我还能抽几张？弃牌会不会回来？消耗/污染/保留各有多少？”

HUD 显示：

- 桌面常驻：`抽3 弃5 消1 留1`，如果有污染则追加 `污2` 或用 title 展示。
- 390/360 移动：不常驻完整计数；只在有变化时显示短事件。
- Debug：全量 `total/draw/discard/hand/exhaust/retained/status`。

禁止：

- 不把 6-7 个数字塞进 360 顶部状态条。
- 不用英文数组名作为玩家读数。
- 不让 `deck.length` 冒充“抽牌堆剩余”。

## 6. 三视口验收

三视口必须一起过。验收顺序建议先跑 `360x640`，再看 `390x844`，最后看桌面信息完整性。

### 6.1 视口定义

| 视口 | 用途 | 硬要求 |
|---|---|---|
| `360x640` | 最小移动硬准入。 | 无页面级横向滚动；feed/debug/pile chip 隐藏；生命周期主 token 完整可见。 |
| `390x844` | 主流手机复核。 | 卡牌 rail、reward panel、deal panel 不重叠；生命周期事件不依赖 debug。 |
| `1366x768` | 桌面信息完整性。 | 牌区计数、feed、debug 边界完整；raw token 只在 debug 展开后出现。 |

### 6.2 通用断言

| 类型 | 断言 |
|---|---|
| 页面尺寸 | `document.scrollingElement.scrollWidth <= window.innerWidth`。 |
| 玩家 HUD | status/director/deal/card/reward/run-layer 的 bounding box 不出 viewport。 |
| 文本 | 生命周期主 token `消/留/污/净/洗回N/消N/留N/污N` 不被 ellipsis 截断。 |
| 移动隐藏 | `360/390` 中 combat feed、debug、完整 pile chip 不可见。 |
| raw 泄漏 | debug 以外不得出现 `CardMoved`、`DiscardPileShuffledIntoDrawPile`、`exhaustPile`、`retainedCards`、`status-created`。 |
| 卡牌按钮 | 不出现超过 18 个中文字符或 32 个 ASCII 字符的生命周期句子。 |
| Reward | reward card 可以两行 clamp，但动作和数值必须在前半句。 |
| 牌区 | 桌面可见计数与 snapshot 一致；移动事件 token 与状态变化一致。 |

### 6.3 各视口通过口径

#### 360x640

- 顶部只保留 HP/MP/CHAIN/意图/授权等核心 chip，不恢复完整牌区 chip。
- 卡牌 rail 内每张牌至少可读：卡名或短名、费用/角色、chain 或生命周期 token、压力/支付状态。
- 消耗牌必须看到 `消`；保留牌必须看到 `留`；污染牌必须看到 `污` 或 `净`。
- 洗回发生时，移动端必须通过 director/deal panel/transient chip 看到 `洗回N`，不能依赖隐藏 feed。
- End Turn 附近显示 `留1下手` 时，不能挤掉 `结束-X`。

#### 390x844

- 可以比 360 多显示一行短提示，但不能恢复长说明。
- reward panel 内部滚动，生命周期奖励牌的 `消/留/污/净` 在 card header 或 small 摘要可见。
- 污染加入、清理、节点清理各有玩家可读 token，不进入 raw debug。
- 保留回手后，hand rail 不因 retained + drawn 导致按钮高度变化。

#### 1366x768

- status pile chip 可以显示 `抽/弃/消/留`，title/debug 显示全量。
- combat feed 显示生命周期事实：`消耗+1`、`保留1`、`污+2`、`洗回4`、`清污2`。
- debug 默认折叠；展开后 raw event 允许出现，但玩家区 raw 泄漏为 0。
- 桌面不能把完整生命周期说明塞回 card button；桌面宽也要守短 token。

## 7. UI 镜头清单

以下 15 个镜头用于生命周期 v1 HUD 验收。至少前 12 个应进入自动 QA 或人工截图；13-15 是上线前加严镜头。

| # | 镜头 | 视口 | 状态构造 | 必须看到 | 失败条件 |
|---:|---|---:|---|---|---|
| 1 | 360 初始基线 | `360x640` | 首屏未发牌 | HP/MP/CHAIN/意图；无 pile chip | 页面横向滚动；完整牌区挤进顶部。 |
| 2 | 390 初始基线 | `390x844` | 首屏未发牌 | status/director/deal panel 不重叠 | 390 通过但 360 没跑。 |
| 3 | 桌面牌区基线 | `1366x768` | 首屏未发牌 | `抽N 弃N 消0 留0` 或等价短计数 | status 显示英文长串或数组名。 |
| 4 | 360 消耗卡按钮 | `360x640` | 手牌有消耗终结牌 | 卡面 `消`、`终结xN`、`授权付` 或 `缺MPN` | 出现“不会进入弃牌堆”长句；`消` 被裁。 |
| 5 | 桌面消耗后计数 | `1366x768` | 打出消耗牌 | feed `消耗+1`；pile `消1`；弃牌不增加该牌 | 只能在 debug 看到消耗；feed raw event 泄漏。 |
| 6 | 360 保留回合末 | `360x640` | 手牌有保留牌，点结束回合 | card `留`；deal/director `留1下手`；按钮 `结束-X` 仍完整 | `留1下手` 挤掉结束按钮；出现长解释。 |
| 7 | 390 保留发牌 | `390x844` | 下一次 DealHand 前有 retainedCards | `保留回手1` 或 `留1`；hand rail 高度稳定 | 保留牌占位导致卡牌按钮重排/遮挡。 |
| 8 | 桌面保留计数 | `1366x768` | 回合末后、发牌前 | pile `留1`，hand 与 retained 分开 | 把 retained 算进 hand 但不显示 `留`。 |
| 9 | 360 污染入手 | `360x640` | 抽到污染状态牌 | card `污`；director/deal `污手1` | 显示 `status` 原始词；污染说明撑破按钮。 |
| 10 | 390 污染清理 | `390x844` | 打出/净化污染牌 | card `净` 或 `污`；事件 `清污1` / `污-1` | 玩家只能从 debug 知道污染减少。 |
| 11 | 桌面污染计数 | `1366x768` | 多区存在污染牌 | pile/title/debug 可核对 `污N`；feed `污+N` | `污N` 被并入总牌数误导为永久卡组。 |
| 12 | 360 洗回事件 | `360x640` | drawPile 空，discardPile 洗回 | director/transient `洗回N` 或 `弃->抽N` | 只在隐藏 feed 或 debug 出现洗回。 |
| 13 | 桌面洗回与排除 | `1366x768` | 抽牌卡触发洗回且排除当前源牌 | feed `洗回N`；debug 可看 kept/exclude | 玩家层写“随机洗牌”或 raw event 泄漏。 |
| 14 | 390 reward 生命周期牌 | `390x844` | reward 三选一含消耗/保留/污染相关牌 | reward small 前半含 `消/留/污/净` 与费用 | reward card 只有长 `em`，两行 clamp 后主机制不可见。 |
| 15 | 360 长组合压力 | `360x640` | 同屏最长卡名 + `延MP3x4` + `授权付` + `消/留/污` | 卡名可 ellipsis；机制 token 全完整 | 通过缩小字体解决，或任一主 token 只剩省略号。 |

## 8. 防文字超框规则

### 8.1 文案预算

| 节点 | 理想上限 | 最大容忍 | 说明 |
|---|---:|---:|---|
| 生命周期卡牌 token | 1-2 中文 | 3 中文 | `消`、`留`、`污`、`净`。 |
| 卡牌 meta 行 | 8-12 字 | 16 字 | `MP3 · 消 · 全场`。 |
| 卡牌 chain/压力行 | 4-10 字 | 12 字 | `终结x4`、`抽1仍-12`。 |
| 支付状态 | 3-5 字 | 6 字 | `授权付`、`缺MP2`。 |
| Director strong | 4-8 字 | 10 字 | `洗回4`、`留1下手`。 |
| Director em | 6-12 字 | 14 字 | `保留回手1`、`污手1`。 |
| Deal small | 10-14 字 | 18 字 | `留1下手 · 回合损8`。 |
| Pile chip | 10-18 字 | 24 字 | `抽3 弃5 消1 留1`。 |
| Combat feed | 18-28 字 | 34 字 | `洗回4 · 抽2 · 仍-8`。 |
| Reward small | 10-16 字 | 22 字 | `MP1 · 消 · 前排`。 |

### 8.2 布局约束

- 所有 flex/grid 文本子项必须允许 `min-width: 0`，否则 ellipsis 不会生效。
- 单行 token 使用 `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`，但只允许卡名和辅助说明被省略。
- 生命周期主 token 放在独立短字段，不和长牌名拼接。
- reward panel 可以内部滚动；card rail 可以横向滚动；document/body 不能横向滚动。
- 不用继续缩小字体掩盖文案膨胀。若 360 超框，先压词，再删低优先级信息。
- 不把 title 当成移动端唯一信息来源；触屏玩家可能看不到 hover title。

### 8.3 黑名单扫描

玩家 HUD 可见区应扫描并禁止这些词：

```text
CardMoved
DiscardPileShuffledIntoDrawPile
CardRetained
CardExhausted
StatusCardsPurged
exhaustPile
retainedCards
discardPile
drawPile
status-created
turn-end-retain
play-exhaust
```

允许位置：

- `.debug-panel[open]`
- 测试输出
- 文档
- dev-only trace

## 9. QA 口径

生命周期 v1 HUD 的验收不是只看截图美观，而是要同时过三类检查：

1. 语义检查：消耗、保留、污染、洗回、牌区计数都能在玩家层读到短 token。
2. 几何检查：三视口没有页面横向 overflow，HUD 元素不出 viewport。
3. 泄漏检查：raw runtime token 不进入玩家 HUD，长生命周期句不进入卡牌按钮。

建议后续 QA selector 至少覆盖：

```text
.status-strip
.combat-director
.deal-panel
.card-row
.card-button
.reward-panel
.reward-card
.combat-feed
.run-layer-main
.debug-panel
```

移动端重点断言：

- `.combat-feed` 不可见。
- `.debug-panel` 不可见。
- `.pile-chip` 不可见或不参与布局。
- `.card-button` 中 `消/留/污/净` 任一出现时必须完整可见。
- `洗回N` 发生后必须在 director/deal/transient 可见。

桌面重点断言：

- pile chip 的短计数与 snapshot 一致。
- feed 中生命周期事件是玩家短句。
- debug 默认闭合，展开后 raw token 不影响玩家区。

## 10. 下一步优先级

P0：

- 先定义集中式 lifecycle HUD token helper，禁止模板字符串临时拼长句。
- 把消耗/保留/污染/洗回/牌区计数加入三视口截图矩阵。
- 卡牌按钮增加长句黑名单，尤其检查“不会进入弃牌堆”“保留到下一手”“污染状态牌”。

P1：

- 桌面 pile chip 从四数字升级为 `抽/弃/消/留/污` 语义计数，title 放全量。
- 移动端给生命周期事件加 transient director token：`消耗+1`、`留1下手`、`污手1`、`洗回4`。
- reward 生命周期牌补短摘要，保证两行 clamp 前半句有动作和数值。

P2：

- 为状态/污染增加专门的详情层，解释节点结束清理，但默认不进战斗首屏。
- 如果未来支持真机 safe-area，底部 card rail 和顶部 status 要把 `env(safe-area-inset-*)` 纳入镜头。
- 如果以后支持英文 UI，生命周期 token 要重新设计，不能直接把 `exhaust/retain/pollution` 塞回卡牌按钮。

## 11. 本轮验收口径

本文只定义 HUD 生命周期 v1 的短 token、三视口验收和防超框边界，不声明当前实现已经通过。后续任何生命周期源码改动，只要涉及消耗、保留、污染、洗回或牌区计数，就必须回到这 15 个 UI 镜头中至少覆盖相关镜头，并优先证明 `360x640` 没有退化。
