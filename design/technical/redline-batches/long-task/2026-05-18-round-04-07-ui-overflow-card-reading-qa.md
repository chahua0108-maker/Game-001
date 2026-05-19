# 2026-05-18 Round 04 Expert 07：UI 文本超框与卡牌阅读 QA

身份：第 4 轮专家 07，UI 文本超框与卡牌阅读 QA  
工作目录：`/Users/roc/Game-001`  
审查范围：`prototype-web/src/style.css`、`prototype-web/src/ui/hud.ts`  
边界：只读源码；不修改 `style.css` / `hud.ts`；不提交 git。当前这两个源码文件已有并行 dirty 状态，本文按现状审查，不回滚、不覆盖。

## 0. 一句话结论

当前版本已经修掉了第一轮最高风险的两件事：移动端手牌从多行网格改成横向 rail，奖励面板增加了 viewport max-height 与内部滚动。但中文超框风险没有消失，只是从“整体布局被撑爆”转成了“关键短句被省略号、固定高度、隐藏层级吃掉”。

本轮必须守住的核心合同是：

```text
手牌按钮只承载短决策，不承载完整规则。
奖励卡只承载选择理由 + 短规则，不承载 detail。
状态条只承载当前回合必读状态，不承载 debug 或长解释。
移动端用横向手牌 rail 和详情层解决阅读，不允许靠增高卡牌解决中文文案。
browser QA 必须测真实 DOM rect、tap 流程、viewport 极限和截图证据，不能只看首屏截图。
```

## 1. 当前源码观察

### 1.1 已经变好的地方

| 区域 | 当前证据 | QA 判断 |
| --- | --- | --- |
| 奖励面板 | `style.css` 中 `.reward-panel` 有 `width: min(640px, calc(100vw - 32px))`、`max-height: calc(100dvh - 32px)`、`overflow: auto`。移动端继续压到 `calc(100dvh - 24px)`。 | 奖励弹层不再依赖 body 滚动，短屏可恢复。 |
| 移动奖励卡 | `<=980px` 下 `.reward-choices` 单列，`.reward-card em` 使用 2 行 clamp。 | 奖励说明不应无限撑高。后续只需保证 `rulesText` 真正短。 |
| 移动手牌 | `<=640px` 下 `.card-row` 改为 `display:flex; overflow-x:auto; scroll-snap-type:x proximity`，单卡 `flex: 0 0 min(232px, 78vw)`。 | 这是必须保留的 P0 布局合同：手牌数量增加时，rail 高度不随卡数增长。 |
| 小屏状态降权 | `<=640px` 下隐藏 `.xp-chip`、`.phase-chip`、`.pile-chip`、`.status-strip > button`，并隐藏 chip 的 `em` 详情行。 | 状态条进入“短 token”模式，避免三行状态条压住 director。 |
| 移动卡牌降权 | `<=640px` 下隐藏 `.card-effect` 和 `.card-payoff`。 | 当前移动卡牌可读性依赖 `card-meta`、`chain-preview`、`card-intent-preview`、支付状态，不能再把长效果塞回去。 |
| 点击防抖 | `hud.ts` 在 `pointerdown` 后抑制后续 click 500ms。 | browser QA 必须保留“单 tap 只出一个 intent”的断言。 |

### 1.2 仍有风险的地方

| 区域 | 当前证据 | 风险 |
| --- | --- | --- |
| 状态 chip | `authorization.label` 为 `终局授权 +0/+3`，`chainRouteLabel` 可变成 `MP0 -> MP1 -> MP2`，大量 `white-space: nowrap`。 | 390px 宽时能裁，但裁掉后可能看不懂授权/链路。移动端应继续使用短 token，而不是让自然语言进入 chip。 |
| director | 四格固定在左上，主句和解释都单行省略。 | 中文主语长一点就只剩省略号。director 应显示“下一步决策句”，不是完整解释。 |
| deal panel / End Turn | 可见按钮文本是 `结束回合 -N` 或 `结束回合`，完整说明主要在 `title` / `aria-label`。 | 移动端看不到 title，结束代价必须有可见短句，不应只靠 tooltip。 |
| run layer | `runLayer.rewardLabel` 可渲染 `最近奖励 ${recentReward}`。 | 奖励名如果变中文长名，会被省略；这是可接受降权信息，但不能成为唯一奖励记录入口。 |
| hand card title | `.card-button strong` 单行、`max-width: calc(100% - 28px)`、ellipsis。 | 长中文牌名/英文混排必然被裁。需要 `shortName` 或数据预算，不能靠缩字。 |
| card body | `.card-meta`、`.chain-preview`、`.card-intent-preview`、`.card-payoff`、`.card-effect` 全部单行省略。 | 决策信息必须排序：支付/授权/意图高于关键词和长效果。 |
| reward card title | `.reward-card strong` 当前没有 ellipsis / clamp。 | 长牌名会扩大行高并挤压 rulesText。需要稳定标题预算或 clamp 合同。 |
| combat feed | 桌面 `.combat-feed` 无 max-height，日志 li 不 clamp；移动端隐藏。 | 桌面日志长文案仍可能向下覆盖。它是低优先级信息，应有高度预算。 |
| debug panel | 桌面 `bottom:104px`，max-height 基于单行手牌假设。 | 手游 rail 后移动端隐藏没问题；桌面若未来手牌多行或卡高变化，debug 不能侵入手牌区域。 |

## 2. 必须保留的 CSS 合同

### 2.1 全局

| 合同 | 口径 |
| --- | --- |
| `body` 可继续 `overflow:hidden` | 前提是所有弹层自己负责 `max-height` 和 `overflow:auto`。奖励、详情、debug 不能依赖页面滚动救场。 |
| HUD 根层保持 `pointer-events:none` | 只有按钮、弹层、可交互 panel 开 `pointer-events:auto`，避免透明 HUD 区域吞掉游戏操作。 |
| 固定格式 UI 必须有稳定尺寸 | hand rail、status chip、reward panel、card button 不应因中文变长改变整体布局。 |
| 不用 viewport 字体缩放 | 不使用 `vw` 字号或动态缩小字体来掩盖超框；应靠短文案、分层和滚动。 |
| 所有 grid/flex 动态文本父级必须允许收缩 | 动态文本所在 flex/grid 子项要有 `min-width:0`，否则 ellipsis 不可靠。 |

### 2.2 状态条

| 合同 | 当前/建议口径 |
| --- | --- |
| 桌面状态条可单行，但不得突破 viewport | `.status-strip` 的 `max-width: calc(100vw - 304px)` 需要 browser rect 证明；中宽桌面也要测。 |
| `<=980px` 不允许自动排出第三行关键状态 | 目前 4 列网格，若未来恢复 XP/FSM/牌堆，需要显式隐藏或移入 drawer。 |
| `<=640px` 只显示核心短状态 | HP、MP、授权、链、意图可以保留；XP/FSM/牌堆/Restart 不回到首屏。 |
| chip 文案必须短 token 化 | `终局授权 +3` 在极窄屏可压成 `授权+3`；`MP0 -> MP1 -> MP2` 可压成 `0>1>2`。不要把完整解释放进 chip。 |
| title/aria 只能补充，不是移动端唯一说明 | 关键信息必须可见；移动端无 hover。 |

### 2.3 卡牌按钮

| 合同 | 口径 |
| --- | --- |
| 移动端保留横向 rail | `<=640px` 的 `.card-row { display:flex; overflow-x:auto; }` 是 P0，不能退回多行网格。 |
| 单卡高度不随文字增长 | 竖屏卡高 98-108px，横屏可更低；卡数增长只横向滚动。 |
| 手卡按钮不显示完整 `description/detail` | 手卡只显示短决策：费用、卡名/短名、角色目标、链路、意图/支付状态。 |
| `mobileEffect` 必须是短文本真相源 | `cardEffectLabel()` 已优先读取 `card.mobileEffect`；后续不要退回从长 description 截句。 |
| 支付状态优先级最高 | `.missing-cost` / `.authorization-cost` 不能被关键词、payoff 长句或效果行挤掉。空间不足时隐藏低优先级说明。 |
| 标题需要数据预算或短名 | 当前 `strong` 只单行省略。若中文卡名超过 8-12 字，应新增 `shortName` 或改数据，不用自动缩字。 |
| `card-payoff` 移动端继续隐藏或短 token 化 | 不能把 `终局授权：终结 x3 · 全场48` 这类长句放回 390px 卡面。 |
| 锁牌/断链必须可见且不误导 | `非起手 x1`、`断链 x1`、`缺 MP1` 等短句要表达“可打/不可打”的真实状态，不能只靠红色。 |

### 2.4 奖励面板

| 合同 | 口径 |
| --- | --- |
| `.reward-panel` 保留 viewport max-height + internal scroll | 不能删除 `max-height` / `overflow:auto`，因为 body 不滚动。 |
| 移动端奖励单列 | 三选一在移动端保持一列滚动；不要为了横向并排牺牲阅读。 |
| `reward-card em` 只显示短规则 | 当前移动端 2 行 clamp 适合 `rulesText`，不适合 `detail`。 |
| reward card 必须有选择理由 | 后续最好把 `补缺口 / 拿终结 / 补路线` 作为独立短行，不要让 `roleLabel · targetLabel` 承担全部决策。 |
| 长说明进入详情或图鉴 | 奖励卡 `title` 可以补充，但移动端不可依赖 title。 |

## 3. 必须保留的 DOM 合同

### 3.1 `hud.ts` 字符串模板边界

当前 HUD 用 `this.root.innerHTML = markup` 整块重绘。这个模式下，DOM 合同要比普通组件更硬：

| 合同 | 说明 |
| --- | --- |
| 动态文本节点 class 不能随意改名 | browser QA 会按 `.card-button`、`.card-meta`、`.chain-preview`、`.card-intent-preview`、`.missing-cost`、`.authorization-cost`、`.reward-card`、`.status-strip` 查 rect。 |
| 每个交互按钮必须保持 `data-*` 意图入口 | `data-card-id`、`data-reward-card-id`、`data-end-turn`、`data-deal`、`data-restart`、`data-target-enemy-id` 是 browser QA 和真实点击的锚点。 |
| 详情文本不进入手牌按钮 | `cardDetailText()` 只能用于 title、详情层、图鉴或 debug；不能进入 `.card-button` 主体。 |
| `rulesText` 不进入移动手牌主体 | `renderRewardChoice()` 可以用 `cardRulesText()`，手牌按钮应继续使用 `mobileEffect` / 动态 preview。 |
| 动态意图预览独立于卡牌数据 | `hudCardIntentPreview()` 是当前战斗态计算，不应写死到 `mobileEffect`。 |
| 支付/授权信息独立节点 | `.missing-cost` 和 `.authorization-cost` 必须保持单独节点，便于 QA 单独断言可见性。 |

### 3.2 推荐的未来卡面 DOM 分层

当前源码尚未拆到这些 class，但后续若要补详情和关键词，应按这个方向扩展，而不是把文本继续挤进现有行：

```html
<button class="card-button" data-card-id="...">
  <span class="card-cost">...</span>
  <span class="hotkey">#1</span>
  <strong class="card-title">短名</strong>
  <span class="card-meta">终结 · 全场</span>
  <span class="card-mobile-effect">全场16</span>
  <span class="chain-preview">接x3</span>
  <span class="card-intent-preview">意图17>0</span>
  <em class="authorization-cost">授权付</em>
  <span class="card-keywords">终结</span>
</button>
```

优先级：支付状态 > 当前链路 > 意图变化 > `mobileEffect` > 关键词 > 长规则。

## 4. 中文文本预算

| 字段 | 推荐上限 | 强制上限 | 超出处理 |
| --- | ---: | ---: | --- |
| 卡名 | 8-12 个中文等宽 | 14 个中文等宽 | 写 `shortName`，不要靠省略号当主方案。 |
| `mobileEffect` | 6-10 个中文等宽 | 12 个中文等宽 | 重写短句，例如 `修补 抽1`、`全场16`。 |
| `rulesText` | 18-28 个中文 | 2 句 / 2 行 | reward card clamp 到 2 行，完整说明进 detail。 |
| 支付状态 | 4-8 个中文等宽 | 10 个中文等宽 | `缺MP1`、`授权付`，不要写 `需MP/终局授权`。 |
| 链路短句 | 4-8 个中文等宽 | 10 个中文等宽 | `起x1`、`接x2`、`断x1`、`修补MP2`。 |
| 意图预览 | 6-12 个中文等宽 | 14 个中文等宽 | `意图17>12`，不要写完整句。 |
| reward reason | 3-5 个中文 | 6 个中文 | `补缺口`、`拿终结`、`补路线`。 |
| detail | 60-120 个中文 | 180 个中文 | 只进入详情 sheet / 图鉴 / debug。 |

## 5. Browser QA 脚本口径

### 5.1 启动与清理

必须保留这个操作口径：

```bash
cd /Users/roc/Game-001/prototype-web
npm run dev -- --host 127.0.0.1 --port 5174
```

如果 5174 被占用，使用 5175 或下一个空端口，并在 QA 记录里写清楚实际 URL。browser QA 结束后必须关闭本次打开的页面/浏览器，并停止本次启动的 dev server；否则记录为 `cleanup failure`。

### 5.2 浏览器参数

| 项 | 必须保留 |
| --- | --- |
| 渲染后端 | WebGL smoke 使用 Chromium + SwiftShader 或可见浏览器；不能接受 headless 黑屏截图。 |
| 截图证据 | 每个失败要有截图和 DOM rect JSON，不只写 pass/fail。 |
| Console | 收集 console error / pageerror；出现运行错误即失败。 |
| 视口 | 至少覆盖 `320x568`、`360x640`、`390x844`、`430x932`、`640x360`、`768x1024`、`980x720`、`1280x720`、`1366x768`。 |
| 证据落点 | 临时 browser 原始输出可放 `outputs/browser-qa/...`；可提交结论应汇总到 `design/technical/redline-batches/...`。 |

### 5.3 固定场景

browser QA 不能只打开首屏。至少要构造或操作到这些 HUD 状态：

| 场景 | 要检查的 UI |
| --- | --- |
| 初始 Deal | 状态条、deal panel、director、空手/待发牌说明。 |
| PlayerTurn 4 张手牌 | 费用、卡名、链路、意图预览、End Turn 后果。 |
| 6-8 张手牌极限 | `.card-row` 高度固定、横向滚动可达最后一张、不会覆盖 run-layer/enemy-peek。 |
| 正确链 `0 -> 1 -> 2` | chain chip / director / card preview 随步骤变化。 |
| 断链可打 | 红色/短文案表达“可打但断链”，不是误读成 disabled。 |
| 缺 MP / 授权支付 | `.missing-cost` / `.authorization-cost` 可见且落在按钮内。 |
| 奖励三选一 | `.reward-panel` 在 viewport 内，最后一张 reward 可见或可滚动到可见。 |
| 长文案极限 | 最长卡名、最长 `mobileEffect`、最长 `rulesText`、长敌人名、3 个 intent 来源。 |
| 移动目标选择 | 展开 `前排显影`，点 enemy-slot，再点单体牌，目标锁定可见。 |

### 5.4 DOM rect 断言

脚本必须对关键节点做矩形断言：

```text
node rect must be inside viewport:
.status-strip
.combat-director
.deal-panel
.target-panel
.enemy-peek
.run-layer-panel
.card-row
.reward-panel

node rect must be inside parent card:
.card-button strong
.card-button .card-meta
.card-button .chain-preview
.card-button .card-intent-preview
.card-button .missing-cost
.card-button .authorization-cost

text containers:
scrollWidth <= clientWidth for single-line short fields, unless the field is explicitly allowed to ellipsize as low-priority.
scrollHeight <= clientHeight for card buttons and reward cards, except panels with declared internal scrolling.
```

还要检查重叠：

```text
status-strip vs combat-director
combat-director vs deal-panel
run-layer-panel vs card-row
enemy-peek vs card-row
reward-panel vs viewport
debug-panel vs card-row on desktop
```

允许重叠只限明确的 modal/overlay 状态，例如 reward panel 盖住战场；不允许盖住可操作奖励按钮本身。

### 5.5 移动端真实 tap 断言

移动端 QA 必须从视觉 smoke 升级到真实 tap：

1. 在 `390x844` 上 tap `发牌`。
2. tap `Debt Hook -> Redline Cut -> Row Cleave`。
3. 每次 tap 后断言只产生一个玩家 intent，且手牌 rail 仍可横向滚动。
4. End Turn 前断言可见文本包含结束代价或安全状态。
5. tap End Turn，断言 HP 变化与预览口径一致。
6. 运行一次乱序：`Debt Hook -> Row Cleave`，断言 `Row Cleave` 可打但显示断链/非推荐，不应误判为 disabled。
7. 运行一次奖励选择，断言 reward button 单 tap 只选择一次，面板关闭或状态推进可见。

### 5.6 禁止恢复的旧 QA 口径

| 禁止项 | 原因 |
| --- | --- |
| 只跑 `redline-90s` 或固定 60/90 秒生存 | 当前有效方向是 deterministic short slice / Hyper-Turn，不是 realtime pressure。 |
| 用 `advance-time`、`AutoAttack`、`EnemyPressure` 证明核心体验 | 会把旧实时压力带回验收。 |
| 只截图不点牌 | 不能证明移动端连续出牌、单 tap、防抖、End Turn 和奖励选择。 |
| 只检查可见截图，不查 DOM rect | 省略号和 hidden overflow 会让截图看似干净，但关键状态可能已被裁。 |
| 用 `title` / hover 作为移动端通过证据 | 移动端用户看不到 hover tooltip。 |
| QA 后不清理浏览器和 dev server | 长任务多 agent 并行时会污染后续 worker。 |

## 6. 本轮 QA 判定清单

P0 通过条件：

- `<=640px` 保持横向手牌 rail，卡牌数量增加不增高手牌区。
- 320x568、390x844、640x360 下，`.card-button`、`.reward-panel`、`.status-strip` 没有 viewport 外关键内容。
- `.missing-cost` / `.authorization-cost` 出现时完全落在对应 `.card-button` 内。
- reward 面板在短屏可滚动，三张 reward 都能点到。
- End Turn 的后果不能只存在于 `title` / `aria-label`。
- 移动端真实 tap 能完成发牌、顺链、断链、目标选择、奖励选择，且单 tap 不重复触发。

P1 通过条件：

- 长中文卡名、长敌人名、中英混排、3 个 intent 来源不会破坏布局。
- `rulesText` 加长到 2 行仍不撑爆 reward card；完整 `detail` 不进入 hand/reward 主体。
- 桌面 debug/combat-feed 不覆盖手牌或 run-layer。
- browser QA 输出包含截图、rect JSON、操作步骤和 cleanup 记录。

## 7. 给后续实现 worker 的短结论

不要再通过“加一行说明”解决卡牌可读性。当前 HUD 的正确方向是结构化短文本 + 动态预览 + 详情层。实现 worker 若要动 `hud.ts` 或 `style.css`，先保护这四条：

1. 移动手牌 rail 不能退回多行网格。
2. `mobileEffect` / `rulesText` / `detail` 不混用。
3. 支付、授权、意图变化不能被省略号吃掉。
4. browser QA 必须用真实 tap 和 DOM rect 证明“不超框且能连续玩”。
