# 2026-05-18 Round 09-02：DOM Overflow Probe Engineer

角色：第 9 轮专家 02，DOM Overflow Probe Engineer  
工作目录：`/Users/roc/Game-001`  
边界：只新增本文档；不改源码、不提交、不回滚、不打开浏览器。  
目标：设计 DOM probe 规则，区分真文字超框、ellipsis 可接受、手牌横向 rail 可接受、reward-panel 可滚动；给出 selector 白名单/黑名单和 JSON 输出结构。

## 0. 结论

第 9 轮的 DOM overflow probe 不能继续使用单一规则 `scrollWidth > clientWidth => fail`。当前 HUD 已经有三类有意设计的溢出：

| 类型 | 代表 selector | 裁决 |
| --- | --- | --- |
| 真文字超框 | `.card-button .missing-cost`、`.authorization-cost`、`.card-intent-preview`、`.reward-card strong` | 阻断，必须改文案或布局。 |
| 可接受 ellipsis | `.combat-feed li`、`.debug-panel dd`、低优先级 run/meta 文本 | 允许，但必须记录为 `accepted-ellipsis`，且不能丢失关键语义。 |
| 可接受横向 rail | `.card-row` | 允许 `scrollWidth > clientWidth`，但只限容器自身；子卡必须在 rail 内可达。 |
| 可接受内部滚动 panel | `.reward-panel` | 允许 `scrollHeight > clientHeight`，但 panel 自身必须在 viewport 内，最后一个 reward 可滚动到可点。 |

最终输出应是结构化 JSON，而不是只返回字符串数组。每个 finding 必须带 `selector`、`category`、`severity`、`ruleId`、rect、scroll metrics、文本摘要和接受/失败原因，便于后续自动回归和人工阅读。

## 1. Probe 分类模型

### 1.1 Finding category

```ts
type OverflowCategory =
  | 'fail-text-horizontal-overflow'
  | 'fail-text-vertical-overflow'
  | 'fail-viewport-overflow'
  | 'fail-overlap'
  | 'fail-hidden-critical-text'
  | 'accepted-ellipsis'
  | 'accepted-horizontal-rail'
  | 'accepted-scroll-panel'
  | 'accepted-hidden-low-priority'
  | 'info';
```

### 1.2 Severity

| severity | 用途 |
| --- | --- |
| `blocker` | 360/390/desktop 中任一核心操作不可读、不可点、页面横向滚动、关键节点出 viewport。 |
| `major` | 关键短句被裁切，但暂不影响点击；例如意图预览、支付状态、reward 标题被截断。 |
| `minor` | 低优先级信息被 ellipsis 接管；必须记录，但不阻断。 |
| `info` | 合法滚动或合法隐藏的证据。 |

### 1.3 核心判定顺序

每个节点按这个顺序裁决：

1. 不可见节点先检查是否在“允许隐藏”名单；否则关键节点隐藏为 `fail-hidden-critical-text`。
2. 容器 rect 超出 viewport 且不是明确 overlay 状态，报 `fail-viewport-overflow`。
3. selector 命中横向 rail 白名单，按 rail 规则检查，不按文本超框报错。
4. selector 命中内部滚动 panel 白名单，按 panel 规则检查，不按垂直超框报错。
5. selector 命中 ellipsis 白名单，允许单行裁切，但检查关键语义 token。
6. 其余文本节点只要 `scrollWidth > clientWidth + 1` 或 `scrollHeight > clientHeight + 1` 就报 fail。
7. 最后执行 overlap 规则，避免两个合法节点互相盖住。

## 2. Selector 白名单

### 2.1 Ellipsis 可接受白名单

这些节点允许被 CSS `text-overflow: ellipsis` 接管，但 probe 要记录 `accepted-ellipsis`。如果文本包含黑名单里的 debug 词，仍然失败。

| selector | 允许条件 | 不允许条件 |
| --- | --- | --- |
| `.combat-feed li` | 桌面低优先级日志；短 token 仍能看出命中/未中/伤害/抽牌。 | 关键事件只剩英文截断、出现 `CardTopdecked` / `DeckSearchMissed` / `drawPile`。 |
| `.combat-feed header span` | 只显示 feed 摘要或短状态。 | 放入完整牌名、来源区或规则句。 |
| `.run-layer-panel .run-layer-meta` | meta/placeholder 可降权。 | 唯一奖励记录或唯一状态原因被裁掉。 |
| `.debug-panel header span` | debug 摘要可裁切。 | 不适用；debug 不能成为玩家必读信息。 |
| `.debug-panel dd` | debug value 可裁切。 | 可见玩家 UI 泄漏 raw debug。 |
| `.status-chip span` | 小屏隐藏/裁切详情行可接受。 | `strong` 主 token 不可读。 |
| `.enemy-slot small` | 敌人意图 badge 的辅助说明可裁切。 | intent 数值或可选中状态不可读。 |

建议输出示例：

```json
{
  "category": "accepted-ellipsis",
  "severity": "minor",
  "ruleId": "ELLIPSIS_COMBAT_FEED_LOW_PRIORITY",
  "selector": ".combat-feed li",
  "reason": "desktop combat feed is allowed to ellipsize low-priority history"
}
```

### 2.2 横向 rail 白名单

只允许这些容器自身横向滚动：

| selector | 允许条件 | 必查项 |
| --- | --- | --- |
| `.card-row` | `overflow-x` 为 `auto` 或 `scroll`，`scrollWidth > clientWidth` 可接受。 | 容器 rect 在 viewport 内；高度稳定；第一张和最后一张 `.card-button` 可滚到可见；不制造 page-level 横向滚动。 |

禁止把 `.card-button`、`.reward-choices`、`.status-strip`、`.combat-director` 临时加入横向 rail 白名单。手牌 rail 是交互模式，不是通用逃生口。

Rail pass 条件：

```text
document.documentElement.scrollWidth <= window.innerWidth + 1
.card-row rect inside viewport
getComputedStyle(.card-row).overflowX in ['auto', 'scroll']
.card-row.scrollWidth >= .card-row.clientWidth
each .card-button offset range is within .card-row scrollable range
.card-row height does not exceed configured viewport budget
```

### 2.3 内部滚动 panel 白名单

这些容器允许垂直滚动：

| selector | 允许条件 | 必查项 |
| --- | --- | --- |
| `.reward-panel` | `overflow-y` 或 `overflow` 为 `auto` / `scroll`；`scrollHeight > clientHeight` 可接受。 | panel rect 在 viewport 内；header 不把 choices 挤出；最后一个 `.reward-card` 可滚到可点。 |
| `.debug-panel[open]` | 桌面 debug 可内部滚动或折叠。 | 不能覆盖 `.card-row`；移动端应隐藏。 |

Reward panel pass 条件：

```text
.reward-panel rect inside viewport with 1px tolerance
computed overflowY in ['auto', 'scroll'] or overflow in ['auto', 'scroll']
.reward-choices exists
last .reward-card can be brought into visible panel viewport
no page-level horizontal overflow
```

### 2.4 允许隐藏白名单

| selector | 允许场景 |
| --- | --- |
| `.combat-feed` | `window.innerWidth <= 640`，移动端隐藏日志。 |
| `.debug-panel` | `window.innerWidth <= 980` 或移动端。 |
| `.xp-chip`、`.phase-chip`、`.pile-chip` | 小屏降权隐藏。 |
| `.card-payoff`、`.card-effect` | `window.innerWidth <= 640` 下卡面降权。 |

隐藏白名单不是信息丢失白名单。若隐藏的是唯一能解释 `paper_shatter` 整备命中/未中的节点，必须另找可见短 token；否则报 `fail-hidden-critical-text`。

## 3. Selector 黑名单

### 3.1 不允许超框的关键文本

这些 selector 只要可见且出现 `scrollWidth > clientWidth + 1`，默认就是失败；不能用 ellipsis 盖过去。

| selector | 失败原因 |
| --- | --- |
| `.card-button strong` | 卡名/短名是玩家选择入口。若全名太长，应提供 short name。 |
| `.card-button .card-meta` | 角色和目标信息是出牌判断。 |
| `.card-button .chain-preview` | 链路接续/断链必须可读。 |
| `.card-button .card-intent-preview` | 意图变化是当前回合核心反馈。 |
| `.card-button .missing-cost` | 缺 MP/不可支付原因必须可见。 |
| `.card-button .authorization-cost` | 授权支付状态必须可见。 |
| `.card-button .card-cost` | 费用不可被裁切。 |
| `.status-chip strong` | 状态主 token 必须可读。 |
| `.combat-director strong` | 移动端可能承担日志替代反馈。 |
| `.combat-director em` | 解释短句必须可读；不能写完整规则。 |
| `.reward-card strong` | 奖励标题是三选一入口。 |
| `.reward-card small` | 费用/短规则必须可读。 |
| `.reward-card em` | 可两行 clamp，但不能被无意义截断到缺动作/数值。 |
| `.deal-panel button` | 发牌/结束回合主操作不可裁切。 |
| `.target-panel button`、`.enemy-slot.targetable` | 目标选择不可裁切到无法判断。 |

### 3.2 可见文本内容黑名单

任何玩家可见文本出现以下 token，直接报 `fail-hidden-critical-text` 或 `fail-text-horizontal-overflow`，即使没有几何超框：

```text
CardTopdecked
DeckSearchMissed
PayoffTopdecked
PayoffTopdeckMissed
SearchAndTopdeck
TopdeckPayoffFromDrawPile
drawPile
discardPile
rewardCardPool
candidateCardPool
undefined
NaN
[object Object]
```

### 3.3 不允许作为 overflow 逃生口的 selector

这些容器不能新增横向滚动来掩盖布局问题：

```text
body
#app
.status-strip
.combat-director
.deal-panel
.target-panel
.enemy-peek
.run-layer-panel
.combat-feed
.reward-choices
.card-button
.reward-card
```

如果这些节点 `scrollWidth > clientWidth + 1`，必须归到真实问题，不能归到 rail。

## 4. Probe 规则设计

### 4.1 Page-level overflow

规则 ID：`PAGE_HORIZONTAL_OVERFLOW`

```js
const pageWidth = Math.max(
  document.documentElement.scrollWidth,
  document.body?.scrollWidth || 0
);
if (pageWidth > window.innerWidth + 1) fail();
```

任何 viewport 下出现页面级横向滚动都是 blocker。`.card-row` 横向 rail 不能把 body 撑宽。

### 4.2 Viewport containment

核心容器必须在 viewport 内：

```text
.status-strip
.combat-director
.deal-panel
.target-panel
.enemy-peek
.run-layer-panel
.combat-feed
.card-row
.reward-panel
.debug-panel[open]
```

例外：

- `.reward-panel` 是 modal overlay，可覆盖战场，但自身不能出 viewport。
- `.combat-feed` 和 `.debug-panel` 在移动端隐藏时不检查 rect。
- `.card-row` 可有内部横向 scroll，但 rect 不能超 viewport。

### 4.3 Text overflow

对每个文本节点输出：

```text
horizontalOverflow = scrollWidth > clientWidth + 1
verticalOverflow = scrollHeight > clientHeight + 1
lineClampDetected = -webkit-line-clamp exists or display is -webkit-box
ellipsisDetected = textOverflow == 'ellipsis' and overflow != 'visible'
```

裁决：

- 命中黑名单 selector：任何 overflow 都 fail。
- 命中 ellipsis 白名单：记录 `accepted-ellipsis`；再检查语义 token。
- `.reward-card em` 可垂直 clamp，但必须包含动作和数值，例如 `抽`、`伤害`、`整备`、`授权`、`MP`、数字之一；否则报 `fail-hidden-critical-text`。

### 4.4 Rail probe

规则 ID：`CARD_ROW_HORIZONTAL_RAIL`

检查 `.card-row`：

1. 可见时 rect 在 viewport 内。
2. `overflow-x` 是 `auto` 或 `scroll`。
3. `document.documentElement.scrollWidth <= window.innerWidth + 1`。
4. 每个 `.card-button` 的 `offsetLeft + offsetWidth` 不超过 `.card-row.scrollWidth + 1`。
5. 暂存当前 `scrollLeft`，依次滚到 `0` 和 `scrollWidth`，确认第一张/最后一张的 rect 与 row viewport 相交。
6. 恢复原 `scrollLeft`。

输出应同时包含：

```json
{
  "category": "accepted-horizontal-rail",
  "ruleId": "CARD_ROW_HORIZONTAL_RAIL",
  "selector": ".card-row",
  "metrics": {
    "clientWidth": 360,
    "scrollWidth": 1016,
    "childCount": 4,
    "firstReachable": true,
    "lastReachable": true
  }
}
```

### 4.5 Reward panel scroll probe

规则 ID：`REWARD_PANEL_INTERNAL_SCROLL`

检查 `.reward-panel`：

1. panel 可见时 rect 在 viewport 内。
2. `overflow-y` 或 `overflow` 是 `auto` / `scroll`。
3. 若 `scrollHeight > clientHeight + 1`，归类为 `accepted-scroll-panel`，不是 failure。
4. 暂存 `scrollTop`，滚到底，确认最后一个 `.reward-card` 的 bottom 不超过 panel bottom。
5. 最后一个 `.reward-card` 的中心点不能被 `.card-row` 或其它固定 UI 截获。
6. 恢复原 `scrollTop`。

如果 reward panel 出现 page-level horizontal overflow，即使内部垂直滚动合法，也要额外报 `PAGE_HORIZONTAL_OVERFLOW`。

### 4.6 Overlap probe

默认不允许重叠：

```text
.status-strip vs .combat-director
.combat-director vs .deal-panel
.combat-director vs .target-panel
.run-layer-panel vs .card-row
.enemy-peek vs .card-row
.combat-feed vs .run-layer-panel
.combat-feed vs .debug-panel
.combat-feed vs .card-row
.debug-panel[open] vs .card-row
```

允许重叠：

- `.reward-panel` 可覆盖战场、手牌、日志，因为它是 modal overlay。
- 但 `.reward-panel` 内部按钮必须可点，且不被其它 fixed 元素抢占 pointer。

## 5. JSON 输出结构

### 5.1 顶层 schema

```json
{
  "schemaVersion": "dom-overflow-probe/v1",
  "status": "fail",
  "summary": {
    "viewport": { "width": 360, "height": 640, "deviceScaleFactor": 1 },
    "url": "http://127.0.0.1:5174/",
    "scenario": "paper_shatter_hit_reward_panel",
    "checkedAt": "2026-05-18T00:00:00.000Z",
    "counts": {
      "blocker": 1,
      "major": 0,
      "minor": 3,
      "info": 2,
      "accepted": 4
    },
    "page": {
      "innerWidth": 360,
      "innerHeight": 640,
      "documentScrollWidth": 360,
      "bodyScrollWidth": 360,
      "horizontalOverflow": false
    }
  },
  "findings": [],
  "nodes": [],
  "whitelistsApplied": [],
  "blacklistsTriggered": [],
  "cleanup": {
    "pageClosed": true,
    "contextClosed": true,
    "browserClosed": true,
    "devServerStopped": true
  }
}
```

`status` 只允许：

```text
pass
fail
needs-review
probe-error
```

### 5.2 Finding schema

```json
{
  "id": "360x640-001",
  "category": "fail-text-horizontal-overflow",
  "severity": "blocker",
  "ruleId": "CRITICAL_TEXT_NO_HORIZONTAL_CLIP",
  "selector": ".card-button .authorization-cost",
  "nodeIndex": 2,
  "text": {
    "raw": "终局授权支付完成",
    "trimmed": "终局授权支付完成",
    "length": 8,
    "preview": "终局授权支付完成"
  },
  "rect": {
    "left": 218,
    "top": 561,
    "right": 300,
    "bottom": 579,
    "width": 82,
    "height": 18
  },
  "metrics": {
    "clientWidth": 46,
    "scrollWidth": 82,
    "clientHeight": 18,
    "scrollHeight": 18
  },
  "style": {
    "display": "block",
    "visibility": "visible",
    "overflowX": "hidden",
    "overflowY": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "lineClamp": null
  },
  "allowance": null,
  "reason": "authorization payment state is critical and cannot rely on ellipsis",
  "suggestedAction": "shorten visible token to 授权付 or increase card payment slot budget"
}
```

### 5.3 Node evidence schema

`nodes` 记录被检查过的关键节点，便于复核不是只报失败：

```json
{
  "selector": ".card-row",
  "nodeIndex": 0,
  "visible": true,
  "role": "horizontal-rail",
  "rect": { "left": 0, "top": 526, "right": 360, "bottom": 640, "width": 360, "height": 114 },
  "metrics": { "clientWidth": 360, "scrollWidth": 1016, "clientHeight": 114, "scrollHeight": 114 },
  "computed": { "overflowX": "auto", "overflowY": "hidden" },
  "result": "accepted-horizontal-rail"
}
```

### 5.4 Whitelist evidence schema

```json
{
  "ruleId": "CARD_ROW_HORIZONTAL_RAIL",
  "selector": ".card-row",
  "category": "accepted-horizontal-rail",
  "reason": "mobile hand is intentionally a horizontal rail",
  "conditions": {
    "viewportContained": true,
    "pageHorizontalOverflow": false,
    "overflowX": "auto",
    "firstReachable": true,
    "lastReachable": true
  }
}
```

### 5.5 Blacklist evidence schema

```json
{
  "ruleId": "VISIBLE_DEBUG_TOKEN_BLACKLIST",
  "selector": ".combat-feed li",
  "token": "DeckSearchMissed",
  "category": "fail-hidden-critical-text",
  "severity": "major",
  "textPreview": "DeckSearchMissed payoff from drawPile",
  "reason": "raw runtime/debug token leaked into player-visible HUD"
}
```

## 6. Minimal probe pseudocode

```js
const config = {
  criticalTextSelectors: [
    '.card-button strong',
    '.card-button .card-meta',
    '.card-button .chain-preview',
    '.card-button .card-intent-preview',
    '.card-button .missing-cost',
    '.card-button .authorization-cost',
    '.card-button .card-cost',
    '.status-chip strong',
    '.combat-director strong',
    '.combat-director em',
    '.reward-card strong',
    '.reward-card small',
    '.reward-card em',
    '.deal-panel button',
    '.target-panel button',
    '.enemy-slot.targetable'
  ],
  ellipsisAllowedSelectors: [
    '.combat-feed li',
    '.combat-feed header span',
    '.run-layer-panel .run-layer-meta',
    '.debug-panel header span',
    '.debug-panel dd',
    '.status-chip span',
    '.enemy-slot small'
  ],
  horizontalRailSelectors: ['.card-row'],
  scrollPanelSelectors: ['.reward-panel', '.debug-panel[open]'],
  visibleTextBlacklist: [
    'CardTopdecked',
    'DeckSearchMissed',
    'PayoffTopdecked',
    'PayoffTopdeckMissed',
    'SearchAndTopdeck',
    'TopdeckPayoffFromDrawPile',
    'drawPile',
    'discardPile',
    'rewardCardPool',
    'candidateCardPool',
    'undefined',
    'NaN',
    '[object Object]'
  ]
};
```

Probe 入口应返回完整 JSON：

```js
(() => {
  const result = createEmptyResult();
  collectPageMetrics(result);
  checkVisibleDebugTokens(result);
  checkViewportContainment(result);
  checkHorizontalRails(result);
  checkScrollPanels(result);
  checkTextNodes(result);
  checkOverlaps(result);
  finalizeStatus(result);
  return result;
})();
```

## 7. Pass / Fail 裁决

### 7.1 必须 fail

- `documentElement.scrollWidth > window.innerWidth + 1`。
- 任何 critical text selector 出现横向或垂直裁切。
- 可见文本泄漏 debug/runtime token。
- `.card-row` 以外的核心容器产生横向滚动。
- `.reward-panel` 出 viewport，或最后一张 reward 无法滚到可点。
- 移动端 `.combat-feed` 隐藏后，没有任何可见短 token 表达整备命中/未中。
- `.run-layer-panel`、`.enemy-peek`、`.debug-panel` 覆盖 `.card-row` 的可操作区域。

### 7.2 可以 pass 但必须记录

- `.combat-feed li` 被 ellipsis 裁切，但仍保留短事件语义。
- `.debug-panel dd` 裁切 debug value。
- `.status-chip span` 在小屏被隐藏或裁切，前提是 `strong` 主 token 可读。
- `.card-row` 横向滚动。
- `.reward-panel` 垂直内部滚动。

### 7.3 需要人工复核

- `.reward-card em` 两行 clamp 后仍有动作词，但数值不明显。
- `.combat-feed li` 是英文短牌名，长度低于阈值但语义可能不清。
- `.combat-director em` 没有几何超框，但文本超过 12 个中文等宽。
- overlap 面积小于 4px，但发生在可点击节点边缘。

## 8. 推荐验收矩阵

| viewport | 必跑场景 | 重点 |
| --- | --- | --- |
| `360x640` | 初始手牌、`paper_shatter` 命中、未命中、奖励三选一 | 页面横向 overflow、hand rail、reward scroll。 |
| `390x844` | 完整 reward -> next hand -> End Turn | 主流移动端可读性。 |
| `640x360` | 横屏短高 | reward panel 和 card row 抢高度。 |
| `1366x768` | 桌面 combat feed + debug open | feed/debug/run-layer/card-row overlap。 |

每个场景输出一个 JSON 文件；批量汇总只读取 JSON 的 `status` 和 `findings`，不要重新解释截图。

## 9. 实施边界

本轮只定义 probe 规则，不落源码。后续实现时建议放在浏览器 QA 脚本侧，而不是运行时 HUD 代码里。运行时只负责稳定 class 和短文案；probe 负责检查 DOM rect、scroll metrics、可见文本黑名单、白名单裁决和 JSON 证据。

STATUS: DONE
