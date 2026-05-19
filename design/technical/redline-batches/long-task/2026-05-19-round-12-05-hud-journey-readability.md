# 2026-05-19 Round 12-05：HUD / 移动端可读性与旅程复测边界

角色：第 12 轮专家 05，HUD/移动端可读性专家  
文件所有权：`design/technical/redline-batches/long-task/2026-05-19-round-12-05-hud-journey-readability.md`  
审查范围：`prototype-web/src/ui/hud.ts`、`prototype-web/src/style.css` 当前短 token 体系、360/390 移动端 HUD 边界、3-5 回合复测旅程、生命周期 v1 HUD 显示边界。  
执行限制：本轮只写文档，未改源码，未运行会写入 `outputs/` 的浏览器 QA。

## 0. 结论

当前 HUD 已经从“完整规则句”转向“短 token + tooltip/debug/detail 承载长说明”，并且移动端有一套现实可用的防溢出结构：`<=640px` 隐藏 XP/FSM/牌堆/重开按钮，隐藏 combat feed 和 debug，手牌变横向 rail，奖励面板内部滚动，卡牌按钮隐藏 `.card-effect` / `.card-payoff`。

但这套体系仍然依赖分散在 `hud.ts` 模板字符串里的局部约定，不是稳定的生命周期 v1 合同。v1 必须把“玩家首屏可见 HUD 只放短 token”写成硬边界：状态条、director、deal panel、card button、reward card、combat feed 各自有 token 长度预算；完整规则、英文长牌名、runtime/debug 事件名只允许进 tooltip、详情层或 debug 折叠区。

第 12 轮后续验收应以 `360x640` 为硬准入，`390x844` 只是主流机型复核，不得作为放宽依据。3 回合 smoke 要能覆盖发牌、链路/终结、奖励；5 回合 full journey 要额外覆盖奖励后下一手、debug 展开边界、run/meta 生命周期边界。

## 1. 当前源码事实

### 1.1 已存在的短 token

`hud.ts` 里已经有以下可保留的玩家短 token：

| 位置 | 当前 token | 依据 | 评价 |
|---|---|---|---|
| 授权状态 | `授权+N` / `授权+0` | `hudAuthorizationState()` | 可保留；detail 很长，只应在 title/tooltip。 |
| 支付状态 | `授权付` / `缺授权` / `缺MPN` | `hudCardPaymentStatusToken()` | 移动端卡面关键 token，必须完整可见。 |
| 链路状态 | `起链x1`、`非起x1`、`修补MPNxN`、`延MP3xN`、`续燃xN`、`接xN`、`断x1` | `hudCardChainRead()` | 方向正确；360 上 `修补MP2x3` 已接近上限，未来可考虑 `修MP2x3`。 |
| 压力读数 | `抽N仍-X`、`返MP仍-X`、`仍-X`、`意图 A->B` | `hudCardIntentPreview()` | 卡牌按钮必须保留，不能被隐藏行替代。 |
| 整备日志 | `整备：顶终结`、`整备无牌` | `combatEventLabel()` | 正确，不能回退到 `PayoffTopdecked` / `drawPile`。 |
| 延链日志 | `延链MP3 xN` | `combatEventLabel()` | 可读，但 feed 中建议统一成 `延MP3xN`。 |

### 1.2 当前防溢出结构

当前 CSS 的可读性基础是：

- `body` 使用 `overflow: hidden`，所以页面不能靠 body 横向/纵向滚动兜底。
- HUD、canvas 都是 fixed 全屏层，HUD 默认 `pointer-events: none`，只有按钮/面板恢复交互。
- 桌面状态条 `max-width: calc(100vw - 304px)`，右侧保留 feed/run/debug 区域。
- `<=980px` 后状态条改 4 列网格，combat feed 和 debug 直接 `display: none`。
- `<=640px` 后 XP/FSM/牌堆/Restart 隐藏，链路/意图/授权 chip 隐藏 `em` 说明，只保留主 token。
- `<=640px` 后 `.card-row` 是横向 rail，`.card-button` 固定 `flex: 0 0 min(232px, 78vw)`，高度 98px。
- 移动卡牌隐藏 `.card-effect` 和 `.card-payoff`，所以关键结果不能只放这两行。
- `.reward-panel` 用 `max-height: calc(100dvh - 32px)` / `24px` 与 `overflow: auto`，移动端 reward card 单列，`em` 两行 clamp。
- `.combat-feed li`、`.director-cell strong/em`、`.deal-panel small`、卡牌多数子字段已有 ellipsis。

### 1.3 仍然脆弱的节点

| 风险 | 当前表现 | v1 边界 |
|---|---|---|
| Director payoff title | `payoffPreviewLabel()` 会输出 `${best.card.name} xN`，例如 `Severance Burst x4`。 | Director 不应依赖完整英文牌名；用 `终结x4` / `Burst x4` / `授权终结`。 |
| Combat feed | `CardPlayed` / `RewardChosen` 仍输出完整牌名，敌人事件也可能输出完整 enemy name。 | feed 是桌面叙事位，主 token 必须在前 8-10 个可见字符内，完整名可省略或短名化。 |
| Run layer reward | `最近奖励 ${card.name}` 可能塞进移动底部 run-layer 单行。 | 移动端使用短名或 `奖励+1`；长名留 title/detail。 |
| Card button 垂直裁切 | `.card-button` 自身 `overflow: hidden`，移动还隐藏 payoff/effect。 | “无几何 overflow”不等于信息完整；授权、缺费、仍-X、接链 token 必须在可见行。 |
| Reward card 规则 | `rulesText` 有长度测试，但 reward `em` 两行 clamp 后仍可能先显示修饰词、后隐藏数值。 | reward `em` 前半句必须包含动作和数值；`small` 必须给短摘要。 |
| Debug 泄漏 | debug panel 桌面存在 raw rule/trace/command；移动 CSS 隐藏。当前 QA selector 主要扫玩家 HUD，debug 展开边界仍要单独定义。 | raw token 只允许出现在 `.debug-panel[open]` 内；status/card/director/feed/reward/run-layer 中为 P0 泄漏。 |
| Safe area | 移动底部 rail 只用 `bottom: 8px`，未接入 `env(safe-area-inset-bottom)`。 | 生命周期 v1 若面向真机浏览器，要给底部 rail 和顶部 status 加 safe-area padding。 |

## 2. 3-5 回合复测设计

### 2.1 三回合 smoke

三回合 smoke 是每次 HUD 文案或 CSS 改动后的最低门槛，必须同时跑 `360x640` 和 `390x844`。

| 回合 | 场景 | 必看 HUD | 通过口径 |
|---|---|---|---|
| 回合 1 | 初始 -> 发牌 -> 第一手可出牌 | status、director、deal panel、card row | 页面无横向 overflow；`HP/MP/授权/CHAIN/意图` 可读；`发牌` / `结束-X` 按钮不超框。 |
| 回合 2 | 0->1->2 链路、Wild 修补或延 MP3、终结授权 | card button、director、combat feed 桌面 | `接xN`、`修补MPNxN` / `延MP3xN`、`授权付`、`仍-X` 全部可见；移动不依赖 feed。 |
| 回合 3 | 击杀/升级 -> reward panel -> 选择奖励 | reward panel、reward card、run layer | reward panel 在 viewport 内部滚动；reward card 是可点按钮；不显示 `candidateCardPool` / `RewardChosen` raw token。 |

### 2.2 五回合 full journey

五回合 full journey 用来验证生命周期 v1，不要求每次小改都跑，但凡新增卡牌、reward pool、run progression、debug 文案、director 文案，必须跑。

| 回合 | 场景 | 新增验证 |
|---|---|---|
| 回合 1 | 初始发牌与普通出牌 | 基线布局、card rail、End Turn 可用性。 |
| 回合 2 | 压力回合：无可打牌/缺 MP/缺授权 | `缺MPN`、`缺授权`、`结束-X` 不被裁掉；错误反馈不弹长 toast。 |
| 回合 3 | 爆发回合：0->1->2->Wild MP3->payoff | `CHAIN 0>1>2`、`延MP3x4`、`续燃x5`、`授权付`、`终结xN` 同屏可扫。 |
| 回合 4 | Reward：三选一并进入下一手 | reward 全池长文案抽样，移动单列内部滚动，选择后 run-layer 不宣称永久成长。 |
| 回合 5 | Debug/生命周期边界 | 桌面 debug 关闭/展开各扫一次；移动 feed/debug 仍隐藏；玩家 HUD 不出现 raw event/id。 |

## 3. UI 镜头清单

以下 14 个镜头是第 12 轮后续复测和生命周期 v1 的推荐镜头。至少前 10 个必须纳入自动 QA 或人工截图验收；11-14 是 v1 前的加严镜头。

| # | 镜头 | 视口 | 状态构造 | 必看 selector / 文本 | 失败条件 |
|---|---|---:|---|---|---|
| 1 | 360 初始 HUD | `360x640` | 首屏未发牌 | `.status-strip`、`.combat-director`、`.deal-panel`；`HP`、`MP`、`授权+0`、`0?`、`发牌` | 任一元素超 viewport；status 换成两行挤压；feed/debug 可见。 |
| 2 | 390 初始 HUD | `390x844` | 首屏未发牌 | 同上；director 四格完整可见 | 390 通过但 360 不通过不能算通过。 |
| 3 | 360 发牌后 card rail | `360x640` | 发牌后 5-6 张手牌 | `.card-row` 横向 rail；`.card-button strong/meta/chain/intent/payment` | body 横向滚动；rail 外元素超框；卡牌按钮文字溢出且无 ellipsis。 |
| 4 | 390 普通链路 | `390x844` | 打出 0、1，准备 2 | `起链x1`、`接x2`、`下MP2`、`仍-X` | chain/intent 只剩省略号或被隐藏；director 与 deal panel 重叠。 |
| 5 | 360 Wild 修补 | `360x640` | 缺中间费用，Wild 可修补 | `修补MP1x2` 或 `修补MP2x3`、`缺MPN` / `授权付` | `修补`、费用数字、倍率任一不可见；支付 token 被卡牌底部裁掉。 |
| 6 | 390 Wild MP3 延链 | `390x844` | 0->1->2 后 `wild_gap_key` | `延MP3x4`、feed 桌面为 `延链MP3 x4`，移动从卡牌/director 读懂 | 移动只能从隐藏 feed 得知延链结果。 |
| 7 | 360 授权终结牌 | `360x640` | 授权 active，0 MP，3费终结可出 | `授权付`、`终结`、`仍-X` 或 `意图 A->B` | `.card-effect` 隐藏后没有其它位置表达授权/压力。 |
| 8 | 390 End Turn 压力按钮 | `390x844` | 仍有敌意图 | `.deal-panel button` 显示 `结束-X`；small 显示 `回合损X · 可出牌 N` | 按钮不可点、超框，或只显示长 title 而按钮文本无风险读数。 |
| 9 | 桌面 director | `1366x768` | payoff 可用或授权就绪 | `.combat-director` 四格；`0>1>2`、`MP3`、`回合损X`、`终结xN` | director 显示完整规则句；`Severance Burst xN` 在 360/390 方案中被沿用。 |
| 10 | 桌面 combat feed | `1366x768` | 出牌、整备、击杀、奖励 | `.combat-feed li`：`出牌 ... xN`、`整备：顶终结`、`击杀 ...` | `PayoffTopdecked`、`drawPile`、`ChainExtended`、`candidateCardPool` 等 raw token 出现在 feed。 |
| 11 | 390 reward panel | `390x844` | reward 三选一 | `.reward-panel`、`.reward-card strong/small/em`；每张卡动作和数值在前两行 | panel 出 viewport；最后一张 reward 不能滚到可点；`em` 两行只有氛围词没有数值。 |
| 12 | 360 reward 长文案池 | `360x640` | 强制出现最长英文牌名、整备、Wild、payoff | `Wild Mana Stitch`、`Severance Burst`、`MP2 · 抽1/3整` 类摘要 | reward card 依赖完整 `detail` 才能理解；按钮文本超出卡宽。 |
| 13 | 桌面 debug 边界 | `1366x768` | debug closed 与 open 各一次 | raw token 只允许在 `.debug-panel[open] dd`；其它玩家 HUD selector 为 0 泄漏 | debug 默认展开；raw token 进入 status/card/director/feed/reward/run-layer。 |
| 14 | 360 lifecycle / meta 边界 | `360x640` | reward 后下一手，run history 有最近奖励 | `.run-layer-main` 显示当前 run，不显示永久成长；feed/debug 隐藏 | `永久升级`、`最大MP+`、`meta growth` 在未开放 meta 时进入移动 HUD。 |

## 4. 生命周期 v1 HUD 显示边界

### 4.1 层级职责

| HUD 层 | v1 职责 | 禁止承载 |
|---|---|---|
| Status strip | HP、MP、授权、CHAIN、当前意图。移动端最多 4 个 chip。 | XP、FSM、牌堆明细、长授权说明、完整规则。 |
| Combat director | 本回合链路、下一费用、当前风险、终结窗口。 | 完整牌名、完整规则句、debug event/id。 |
| Deal panel | 当前阶段和唯一主按钮；按钮文本承担风险读数。 | 两句以上教程、reward 解释、debug 状态。 |
| Card button | 牌名、角色/目标、接链/断链、压力变化、支付状态。 | 超过 5 个可见信息行；完整 `detail`；生命周期/meta 说明。 |
| Combat feed | 桌面最近 2 条玩家可读战斗结果。 | 移动关键读数、raw runtime token、长牌组列表。 |
| Reward panel | 奖励选择与短规则摘要；可覆盖战场但必须内部滚动。 | 永久成长承诺、未开放 meta、debug 候选池。 |
| Run layer | 当前 run 节点、最近奖励、meta 是否开放。 | 把当前 run 卡牌奖励说成永久升级。 |
| Debug panel | 桌面折叠调试数据。 | 移动首屏、玩家关键读数、默认展开。 |

### 4.2 长度预算

以 `360x640` 为准，不通过缩小字体解决；先压 token，再调整布局。

| 节点 | 理想上限 | 最大容忍 | 示例 |
|---|---:|---:|---|
| `.status-chip strong` | 2-6 字 | 8 字 | `CHAIN`、`意图`、`授权+3` |
| `.status-chip span` | 4-8 字 | 10 字 | `0>1>2`、`-17 HP` |
| `.director-cell strong` | 4-8 中文 / 10 ASCII | 12 ASCII | `回合损17`、`MP3`、`终结x4` |
| `.director-cell em` | 6-10 中文 | 14 中文 | `2可打 · 抽/斩`、`先0>1>2` |
| `.deal-panel small` | 10-14 中文 | 18 中文 | `回合损17 · 可出牌 2` |
| `.deal-panel button` | 2-6 中文 | 8 中文 | `发牌`、`结束-17`、`重新开始` |
| `.card-button strong` | 英文 14 / 中文 8 | 英文 22 / 中文 12 | `Severance...` 可 ellipsis，机制 token 不可。 |
| `.chain-preview` | 4-8 字 | 10 字 | `接x3`、`延MP3x4` |
| `.card-intent-preview` | 4-10 字 | 12 字 | `抽3仍-17`、`BRU 意图 7->2` |
| `.authorization-cost` / `.missing-cost` | 3-5 字 | 6 字 | `授权付`、`缺MP2` |
| `.reward-card small` | 10-16 字 | 22 字 | `MP2 · 抽1/3整` |
| `.reward-card em` | 24-28 字，两行内 | 36 字 | `抽1；接链抽3。整备牌顶。` |
| `.combat-feed li` | 18-28 字 | 34 字 | `出牌 Paper · x3 · 抽3 · 整备` |

### 4.3 允许的溢出与不允许的溢出

允许：

- `.card-row` 在移动端作为横向 rail 内部滚动，但 document/body 不能横向滚动。
- `.reward-panel` 垂直内部滚动，前提是 panel 自身在 viewport 内，最后一张 reward 可滚到可点。
- `.combat-feed li`、`.director-cell strong/em`、`.deal-panel small` 等单行 ellipsis，但被裁后仍要保留主语义 token。
- `.debug-panel[open] dd` 裁切或滚动 raw debug value。

不允许：

- 页面级 `scrollWidth > clientWidth`。
- 任何玩家首屏 HUD 元素横向出 viewport。
- 移动端显示 `.combat-feed` 或 `.debug-panel`。
- 关键语义只存在于 hidden 的 `.card-effect` / `.card-payoff`。
- raw runtime token 出现在 status、card、director、feed、reward、run-layer。
- 用继续缩小字体掩盖文案膨胀。

## 5. 复测实现建议

后续如果要把本轮边界落进自动 QA，建议在现有 `prototype-web/scripts/qa-ui.mjs` 上扩展，而不是把探针逻辑塞进运行时 HUD：

1. 保留当前 `desktop`、`mobile-390`、`mobile-360` 三档视口。
2. 增加 5 回合 full journey 构造态：缺授权、Wild MP3 延链、reward 后下一手、debug open。
3. selectors 增加 `.debug-panel`、`.debug-panel[open] dd`、`.run-layer-main`、`.run-layer-main em`。
4. raw token 检查分区：debug 内允许，debug 外 fail。
5. 对 `.card-button` 加语义断言：移动端每张可见卡至少要能读到 name/meta、chain、intent、payment 四类中的前三类；授权/缺费卡必须读到 payment。
6. 对 `.reward-card em` 加前半句检查：两行 clamp 后必须包含动作词和数字之一，例如 `抽`、`伤害`、`整备`、`授权`、`MP`、`xN`、`仍-X`。
7. 加 `safe-area` 真机预备检查：移动端 card rail bottom 与 status top 不应压到浏览器安全区。

## 6. 下一步优先级

P0：

- 将 360/390 的 3 回合 smoke 作为 HUD 文案改动的必跑项。
- 补 debug 泄漏边界：raw token 只允许在 `.debug-panel[open]` 内。
- 补 card button 语义完整性检查，避免 `overflow:hidden` 掩盖关键 token 被裁。

P1：

- 给 director、feed、run-layer 引入短名/短事件 helper，停止直接输出完整英文牌名。
- 把 reward 全池长文案纳入 360/390 镜头，而不是只测当前抽到的三张。
- 为 `360x640` 建立最长组合用例：`Severance Burst` + `延MP3x4` + `续燃x5` + `授权付` + `抽3仍-17`。

P2：

- 移动端加入 `env(safe-area-inset-*)` 预算。
- 如果未来增加 lifecycle/meta 面板，默认仍折叠，不进入战斗首屏。
- 如果增加本地化英文/中文双语，必须重新收紧 token 上限，不能沿用当前中文短 token 的空间预算。

## 7. 本轮验收口径

本轮文档结论不是“当前 UI 已完全通过生命周期 v1”，而是定义了下一阶段应该如何复测和约束。当前实现方向正确，但 v1 还缺三个硬门槛：跨 3-5 回合旅程、debug 泄漏分区、卡牌按钮语义完整性。只要后续新增机制或奖励卡，必须回到 `360x640` 先验收，再看 `390x844` 和桌面。
