# 2026-05-18 Round 06 Expert 07：移动端与文字超框 QA

身份：第 6 轮专家 07，移动端与文字超框 QA  
工作目录：`/Users/roc/Game-001`  
本轮主题：修补牌 / 抽牌 / 临时资源 / 重排的 1:1 卡牌机制复刻  
工作边界：只新增本文档；不改源码、不打开浏览器、不提交 git。当前 `prototype-web/src/style.css`、`prototype-web/src/ui/hud.ts`、`prototype-web/src/data/cards.ts` 在工作树中已有并行改动，本文按现状只读审查，不回滚、不覆盖。

## 0. 结论

如果后续新增 `Wild`、`reorder`、临时 MP / 临时授权反馈，最容易超框的不是奖励大面板本身，而是这些短行：

1. 手牌按钮的 `.card-meta`、`.card-intent-preview`、`.missing-cost`、`.authorization-cost`。
2. 奖励卡的 `small` 摘要行和 `em` 规则行。
3. 桌面 `.combat-feed li`。
4. 小屏状态条的 `.authorization-chip` / `.chain-chip` / `.intent-chip`。
5. `.deal-panel small` 与 End Turn 按钮。

本轮红线：新增机制反馈必须用短 token，不把完整规则、英文 ID、长解释塞进手牌按钮或状态 chip。移动端只允许玩家直接看到“现在能不能打、打了抽几张、临时 MP 是否到账、是否修补链路”，完整说明进入 `detail` / tooltip / 未来详情层。

## 1. 当前 CSS 关键事实

### 1.1 全局与 HUD 层

| 位置 | 当前事实 | QA 含义 |
| --- | --- | --- |
| `style.css:14-18` | `body` 固定 `min-width: 320px`，并且 `overflow: hidden`。 | 页面本体不能靠滚动救场；任何弹层都必须自带 `max-height` 和内部滚动。 |
| `style.css:41-44` | `#hud` 覆盖全屏，`pointer-events: none`。 | 只有按钮 / 面板自己开启点击；新增反馈不能创建透明遮挡层吞 tap。 |
| `style.css:46-56` | `.status-strip` 桌面左上，`max-width: calc(100vw - 304px)`。 | 桌面状态条和右侧日志 / run panel 共享宽度预算，长 chip 会挤爆。 |
| `style.css:1298-1327` | `<=980px` 状态条改 4 列 grid，deal panel 固定到 `top:214px`。 | 平板 / 中宽屏开始进入紧凑 HUD；新增状态 chip 不能让状态条排第三行。 |
| `style.css:1430-1466` | `<=640px` 隐藏 XP / FSM / 牌堆 / Restart，并隐藏 chip 的 `em` 详情。 | 手机首屏只保留短状态；临时资源解释不能依赖 `em`。 |

### 1.2 状态条、director、deal panel

| 位置 | 当前事实 | 新机制风险 |
| --- | --- | --- |
| `style.css:120-123` | HP / MP 资源头 `white-space: nowrap`。 | `当前MP+1（本回合）` 这类长反馈会挤资源 chip。 |
| `style.css:225-255` | `.authorization-chip` 两列，`strong/span` nowrap，`em` ellipsis。 | `终局授权 +3` 已经偏长；如果写成“本回合临时授权支付3费终结牌”会不可读。 |
| `style.css:333-386` | `.combat-director` 四格；`strong/em` 都是单行 ellipsis。 | 适合“接 x2 / 抽2找解”，不适合完整规则说明。 |
| `style.css:470-520` | `.deal-panel small` `max-width:188px`，移动端 150px；按钮 nowrap。 | `结束回合 -12，敌人前排反击` 会挤压按钮；只写 `意图-12` / `安全`。 |

### 1.3 手牌按钮

| 位置 | 当前事实 | 新机制风险 |
| --- | --- | --- |
| `style.css:973-989` | 桌面手牌 6 列 grid；`.card-button` 固定 102px 高并 `overflow:hidden`。 | 任何新增行都会被裁；不能通过增高按钮解决。 |
| `style.css:1095-1131` | 卡名、meta、chain、intent、payoff、effect 都是单行 ellipsis。 | “看起来没超出”可能只是关键字被省略号吃掉。 |
| `style.css:1172-1193` | `.missing-cost` 与 `.authorization-cost` 独立显示，但授权文案仍 nowrap。 | `终局授权支付` 在 360px 单卡中偏长，建议短化为 `授权付`。 |
| `style.css:1560-1577` | `<=640px` `.card-row` 是横向 rail，单卡 `min(232px, 78vw)`，高 98px。 | 这是 P0 合同：手牌数量增加只能横向滚，不允许回到多行。 |
| `style.css:1584-1587` | `<=640px` 隐藏 `.card-effect` 和 `.card-payoff`。 | 抽牌数、临时 MP 到账、修补结果必须进入仍可见的 `.card-intent-preview` / 短支付状态。 |

### 1.4 奖励面板与日志

| 位置 | 当前事实 | 新机制风险 |
| --- | --- | --- |
| `style.css:848-861` | `.reward-panel` 宽 `min(640px, 100vw - 32px)`，`max-height: calc(100dvh - 32px)`，`overflow:auto`。 | 面板整体已有恢复能力；风险转移到卡内短行是否可读。 |
| `style.css:885-942` | 奖励三列；`small` 单行 ellipsis，`em` 桌面不限行。 | 桌面长 `rulesText` 会撑高卡片；移动端会被 clamp。 |
| `style.css:1390-1413` | `<=980px` 奖励单列，`reward-card em` 2 行 clamp。 | 规则行必须“核心动词 + 数值”先出现，不能把限制写在第三行。 |
| `style.css:792-827` | `.combat-feed` 桌面宽 244px，无 max-height，`li` 未 clamp。 | `出牌 Wild Mana Stitch · 倍率 x3 · 抽3 · 当前MP+1` 会向下增长并覆盖右侧面板。 |
| `style.css:1248-1258` | debug panel 桌面 `bottom:104px`，移动端隐藏。 | 桌面 8 张手牌或日志增长时，需要检查 debug 与 card row 不重叠。 |

## 2. 新增 Wild / reorder / 临时 MP 反馈的超框热点

### 2.1 手牌按钮

| 节点 | 最容易出问题的新增文案 | 通过口径 |
| --- | --- | --- |
| `.card-meta` | `修补/抽牌 · 默认最高意图 WSP`、`整备/找牌 · 自身`。 | `roleLabel` 控制在 2-5 字；目标用 `自身 / 前排 / 全场 / 默认BRU`，不要自然语言。 |
| `.card-intent-preview` | `抽3并整备寻找终结牌`、`当前MP+1继续找解`。 | 写 `抽3找解`、`MP+1找解`、`整备抽3`。 |
| `.chain-preview` | `修补缺失费用节点，保持0>1>2`。 | 写 `修补接x2`、`不断链`、`断x1`。 |
| `.missing-cost` | `需MP/终局授权`。 | 写 `缺MP1`、`缺授权`。 |
| `.authorization-cost` | `终局授权支付`。 | 写 `授权付`，完整说明放 `title` / 详情层。 |
| `.card-effect` | `MP 0 · 修补缺口，抽1，当前MP+1`。 | 桌面可写 `MP0 · 抽1 MP+1`；手机会隐藏，不能承载核心信息。 |

### 2.2 奖励卡

奖励卡当前四段是：

1. `span`: `${roleLabel} · ${targetLabel}`
2. `strong`: `${card.name}`
3. `small`: `MP ${card.cost} · ${effectLabel}`
4. `em`: `card.rulesText || effectLabel`

风险判断：

- `span` 不能写 `Wild/修补/临时资源/重排 · 自身`，建议 `修补 · 自身`、`整备 · 自身`。
- `strong` 可以显示正式牌名，但移动端需要 `shortName` 预案；英文长名如 `Wild Mana Stitch` 在 360px 还能显示，但中文长名更容易挤压摘要行。
- `small` 单行省略，不能成为唯一说明；核心收益必须同时出现在 `em` 的前半句。
- `em` 移动端 2 行 clamp；`当前MP+1，只在本回合生效，不提高最大MP` 应改为 `抽1，当前MP+1。本回合。`

### 2.3 日志

桌面日志现在会渲染：

```text
出牌 ${card.name} · 倍率 x${effectMultiplier} · 抽${drawCount}
获得新牌 ${card.name}
```

新增反馈后不要把所有机制都写进同一条日志。建议：

| 事件 | 推荐短句 | 禁止短句 |
| --- | --- | --- |
| Wild 修补出牌 | `出牌 Wild Mana · x1 · 抽1 MP+1` | `出牌 Wild Mana Stitch · 修补费用缺口 · 抽1 · 当前MP+1` |
| reorder 出牌 | `出牌 Paper Route · x3 · 抽3整备` | `出牌 Paper Route · 倍率 x3 · 抽3并重排牌库寻找终结` |
| 临时授权到账 | `授权+3 本回合` | `完成0->1->2后获得本回合临时支付3费终结牌授权` |
| 奖励选择 | `获得 Wild Mana` | `获得新牌 Wild Mana Stitch 并加入后续抽牌循环` |

### 2.4 面板

| 面板 | 风险 | 验收重点 |
| --- | --- | --- |
| `.status-strip` | 临时资源说明进入 `.authorization-chip` 或 MP chip，手机只剩 4 列短状态。 | `终局授权 +3` 可见；小屏建议 `授权+3`。不得出现横向页面滚动。 |
| `.deal-panel` | End Turn 后果和可出牌数拼接过长。 | `small` 不承载完整规则；按钮保持 44px 触控高度。 |
| `.combat-director` | 四格都单行省略，长中文只剩省略号。 | 主句必须是短决策，例如 `抽2找解`、`MP+1找解`。 |
| `.run-layer-panel` | `最近奖励 ${recentReward}` 会被长牌名吃掉。 | 这是低优先级信息，可省略；不能作为唯一奖励记录入口。 |
| `.reward-panel` | 面板可滚，但卡内核心收益可能被 `small` 省略或 `em` clamp。 | 滚到底最后一张可点；2 行规则仍读得出核心动作和数值。 |

## 3. 新增文案长度预算

以 360px 作为准入基准，390px 只用于确认，不作为放宽依据。

| 字段 / 节点 | 360 推荐 | 390 推荐 | 桌面推荐 | 强制上限 | 超出处理 |
| --- | ---: | ---: | ---: | ---: | --- |
| `card.name` / `.card-button strong` | 中文 8 字 / 英文 14 字符 | 中文 10 字 / 英文 18 字符 | 中文 14 字 / 英文 24 字符 | 中文 14 字 | 增加 `shortName` 或改名，不靠缩字。 |
| `roleLabel` / `.card-meta b` | 2-4 字 | 2-5 字 | 2-6 字 | 6 字 | `修补`、`抽牌`、`整备`、`终结`，不要 `修补/抽牌/返MP`。 |
| `targetLabel` | 2-5 字 | 2-6 字 | 2-8 字 | 8 字 | `自身`、`前排`、`全场`、`默认BRU`。 |
| `.chain-preview` | 4-8 字 | 4-10 字 | 4-12 字 | 12 字 | `接x2`、`修补接x2`、`断x1`。 |
| `.card-intent-preview` | 6-10 字 | 6-12 字 | 6-14 字 | 14 字 | `抽2找解`、`抽3整备`、`MP+1找解`。 |
| `.missing-cost` | 4-6 字 | 4-8 字 | 4-10 字 | 10 字 | `缺MP1`、`缺授权`。 |
| `.authorization-cost` | 3-5 字 | 3-6 字 | 3-8 字 | 8 字 | `授权付`。 |
| `.reward-card span` | 8-10 字含分隔 | 10-12 字 | 12-16 字 | 16 字 | `修补 · 自身`，不写完整机制串。 |
| `.reward-card small` | 12-16 字 | 14-18 字 | 18-24 字 | 24 字 | `MP0 · 抽1 MP+1`。核心收益不能只在这里。 |
| `.reward-card em` / `rulesText` | 24 字内 | 28 字内 | 36 字内 | 2 行 | 核心动词和数值放第一句。 |
| `.combat-feed li` | 移动端隐藏 | 移动端隐藏 | 24-32 字 | 32 字 | 缩短牌名、去掉“倍率”二字，用 `xN`。 |
| `.deal-panel small` | 10-12 字 | 12-14 字 | 14-18 字 | 18 字 | `意图-12 · 可打3`。 |

推荐词表：

| 概念 | 手机可见短词 | 完整解释放置 |
| --- | --- | --- |
| Wild / 修补 | `修补`、`不断链`、`修补接x2` | `detail` / tooltip / 未来详情层 |
| reorder / 重排 | `整备`、`找牌`、`抽3整备` | `rulesText` 第一句后半或详情层 |
| 当前 MP +1 | `MP+1`、`临时+1` | 详情层说明“本回合，不提高最大MP” |
| 临时授权 | `授权+3`、`授权付` | status chip title / 详情层 |
| 抽牌倍率 | `抽2`、`抽3`、`抽2找解` | 日志可补 `x2 · 抽2` |

## 4. 桌面 / 390 / 360 小屏验收清单

### 4.1 桌面：`1366x768` 与 `1280x720`

- [ ] `document.documentElement.scrollWidth <= window.innerWidth + 1`。
- [ ] `.status-strip`、`.combat-director`、`.deal-panel`、`.target-panel`、`.run-layer-panel`、`.enemy-peek`、`.combat-feed`、`.card-row` 都在 viewport 内。
- [ ] `.status-strip` 不压到 `.combat-feed`；`.combat-feed` 不向下覆盖 `.run-layer-panel`。
- [ ] 6 张手牌时 `.card-row` 单行稳定；8 张手牌压力场景下，如果桌面仍变双行，`.debug-panel` 和 `.run-layer-panel` 不得遮住卡牌。
- [ ] `.combat-feed li` 出现 Wild / reorder / 临时 MP 日志时，单条不换成三行以上；若发生 ellipsis，核心动作仍在前半句。
- [ ] `.card-button` 内 `.missing-cost` / `.authorization-cost` 出现时，rect 完全落在对应按钮内。
- [ ] Reward 态三张 `.reward-card` 高度可以不同，但 `.reward-panel` 不超出 viewport，最后一张卡可点击。

### 4.2 390 小屏：`390x844`

- [ ] `.card-row` 的 computed `display` 是 `flex`，`overflow-x` 为 `auto` 或 `scroll`；不能退回多行 grid。
- [ ] `.card-button` 宽度约 `min(232px, 78vw)`，高度约 98px；新增文字不改变 rail 高度。
- [ ] `.card-effect` / `.card-payoff` 在手机仍隐藏；抽牌数、整备、临时 MP 到账必须出现在 `.card-intent-preview` 或短支付状态。
- [ ] 连续 6-8 张手牌时，首张和末张都能通过横向滚动触达。
- [ ] `.authorization-chip` 可读，不出现 `终局授权 +3` 以外的长解释；如空间不足，应显示 `授权+3`。
- [ ] `.deal-panel button` 不低于 44px 触控高度；按钮文案不换行，不压缩说明区。
- [ ] `.reward-panel` 左右至少留 12px 安全边距；三张奖励卡单列，最后一张能通过面板内部滚动触达。
- [ ] 奖励 `rulesText` 两行内能读出动作、对象、数值，例如 `抽1，当前MP+1。本回合。`

### 4.3 360 小屏：`360x780` 与压力 `360x640`

- [ ] 页面无横向滚动：`max(documentElement.scrollWidth, body.scrollWidth) <= 361`。
- [ ] `.status-strip` 仍然只保留核心短 chip；XP / FSM / 牌堆 / Restart 不回到首屏。
- [ ] `.chain-chip span`、`.intent-chip span`、`.authorization-chip span` 不把文字顶出 chip。
- [ ] `.card-button strong`、`.card-meta`、`.chain-preview`、`.card-intent-preview`、`.missing-cost`、`.authorization-cost` 的 rect 全部在按钮内。
- [ ] `Wild Mana Stitch`、`Paper Route`、`Lantern Captain`、`Wild Gap Key` 同屏时，卡牌按钮不因英文长名导致核心状态不可见。
- [ ] `MP+1` / `抽3整备` / `授权付` 三类反馈至少各出现一次，并且不依赖 hover title。
- [ ] `.reward-card small` 即使被省略，`.reward-card em` 前两行仍能读出核心收益。
- [ ] `360x640` 下允许 `.reward-panel` 内部滚动；不允许页面本体滚动，也不允许最后一张 reward 被底部 card rail 挡住。

## 5. 浏览器验收脚本检查点设计

本轮不打开浏览器。下面是给后续 browser QA worker 的检查点，不是本轮执行结果。

### 5.1 必测状态

| 状态 | 目的 |
| --- | --- |
| Deal 初始态 | 检查状态条、director、deal panel、空手提示。 |
| PlayerTurn 基础手牌 | 检查 0/1/2 链路和 End Turn 后果。 |
| Wild / 临时 MP 手牌 | 至少包含 `wild_mana_stitch`，断言 `MP+1` / `修补` 不超框。 |
| reorder 手牌 | 至少包含 `paper_shatter` 或 `lantern_captain`，断言 `抽3整备` / `整备` 不超框。 |
| 缺 MP 与授权支付 | 同时覆盖 `.missing-cost` 和 `.authorization-cost`。 |
| Reward 三选一 | 包含一张修补牌、一张终结牌、一张整备 / 路线牌。 |
| 桌面日志压力 | 连续出牌后出现 Wild、reorder、奖励选择日志。 |

### 5.2 通用 DOM rect probe

在每个 viewport 和每个状态后执行。返回 `ok: true` 才算该状态通过。

```js
(() => {
  const failures = [];
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
    docScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth
  };

  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return {
      left: Math.round(r.left),
      right: Math.round(r.right),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      width: Math.round(r.width),
      height: Math.round(r.height)
    };
  };

  const insideViewport = (name, el) => {
    if (!el) return;
    const r = rect(el);
    if (r.left < -1 || r.top < -1 || r.right > window.innerWidth + 1 || r.bottom > window.innerHeight + 1) {
      failures.push(`${name} outside viewport ${JSON.stringify(r)}`);
    }
  };

  const intersects = (a, b) => {
    if (!a || !b) return false;
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return ar.left < br.right && ar.right > br.left && ar.top < br.bottom && ar.bottom > br.top;
  };

  const criticalTextFits = (name, node) => {
    if (!node) return;
    const r = rect(node);
    if (r.width <= 0 || r.height <= 0) failures.push(`${name} has empty rect ${JSON.stringify(r)}`);
    if (node.scrollWidth > node.clientWidth + 1) failures.push(`${name} clipped horizontally: ${node.scrollWidth} > ${node.clientWidth}`);
    if (node.scrollHeight > node.clientHeight + 1) failures.push(`${name} clipped vertically: ${node.scrollHeight} > ${node.clientHeight}`);
  };

  const requiredViewportNodes = [
    ['status-strip', document.querySelector('.status-strip')],
    ['combat-director', document.querySelector('.combat-director')],
    ['deal-panel', document.querySelector('.deal-panel')],
    ['target-panel', document.querySelector('.target-panel')],
    ['run-layer-panel', document.querySelector('.run-layer-panel')],
    ['enemy-peek', document.querySelector('.enemy-peek')],
    ['card-row', document.querySelector('.card-row')]
  ];
  requiredViewportNodes.forEach(([name, el]) => insideViewport(name, el));
  insideViewport('reward-panel', document.querySelector('.reward-panel'));
  insideViewport('combat-feed', document.querySelector('.combat-feed'));
  insideViewport('debug-panel', document.querySelector('.debug-panel'));

  const horizontalLimit = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  if (horizontalLimit > window.innerWidth + 1) {
    failures.push(`page horizontal overflow: ${horizontalLimit} > ${window.innerWidth}`);
  }

  document.querySelectorAll('.card-button').forEach((card, index) => {
    const cardRect = rect(card);
    if (card.scrollHeight > card.clientHeight + 1) {
      failures.push(`card ${index} content clipped vertically: ${card.scrollHeight} > ${card.clientHeight}`);
    }
    ['strong', '.card-meta', '.chain-preview', '.card-intent-preview', '.missing-cost', '.authorization-cost'].forEach((selector) => {
      const node = card.querySelector(selector);
      if (!node) return;
      const nodeRect = rect(node);
      if (
        nodeRect.left < cardRect.left - 1 ||
        nodeRect.right > cardRect.right + 1 ||
        nodeRect.top < cardRect.top - 1 ||
        nodeRect.bottom > cardRect.bottom + 1
      ) {
        failures.push(`card ${index} ${selector} outside parent ${JSON.stringify(nodeRect)} parent ${JSON.stringify(cardRect)}`);
      }
      criticalTextFits(`card ${index} ${selector}`, node);
    });
  });

  const row = document.querySelector('.card-row');
  if (window.innerWidth <= 640 && row) {
    const style = getComputedStyle(row);
    if (style.display !== 'flex') failures.push(`mobile card-row display is ${style.display}, expected flex`);
    if (!['auto', 'scroll'].includes(style.overflowX)) failures.push(`mobile card-row overflow-x is ${style.overflowX}`);
    if (row.clientHeight > 116) failures.push(`mobile card-row too tall: ${row.clientHeight}`);
    const cards = [...row.querySelectorAll('.card-button')];
    const original = row.scrollLeft;
    row.scrollLeft = row.scrollWidth;
    const last = cards[cards.length - 1];
    if (last && !intersects(row, last)) failures.push('last card is not reachable after horizontal scroll');
    row.scrollLeft = original;
  }

  const pairs = [
    ['status/director', '.status-strip', '.combat-director'],
    ['director/deal', '.combat-director', '.deal-panel'],
    ['run-layer/card-row', '.run-layer-panel', '.card-row'],
    ['enemy-peek/card-row', '.enemy-peek', '.card-row'],
    ['combat-feed/run-layer', '.combat-feed', '.run-layer-panel'],
    ['debug/card-row', '.debug-panel', '.card-row']
  ];
  pairs.forEach(([name, left, right]) => {
    const a = document.querySelector(left);
    const b = document.querySelector(right);
    if (a && b && getComputedStyle(a).display !== 'none' && getComputedStyle(b).display !== 'none' && intersects(a, b)) {
      failures.push(`overlap ${name}`);
    }
  });

  return { ok: failures.length === 0, viewport, failures };
})();
```

说明：这个 probe 对关键短行使用严格 `scrollWidth <= clientWidth`。如果实现上刻意允许低优先级字段 ellipsis，应把那些字段移出 `criticalTextFits`，但支付、授权、抽牌数、临时 MP 反馈不能降级。

### 5.3 Reward panel probe

进入 Reward 态后执行。

```js
(() => {
  const failures = [];
  const panel = document.querySelector('.reward-panel');
  const cards = [...document.querySelectorAll('.reward-card')];
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return {
      left: Math.round(r.left),
      right: Math.round(r.right),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      width: Math.round(r.width),
      height: Math.round(r.height)
    };
  };

  if (!panel) return { ok: false, failures: ['missing .reward-panel'] };
  const panelRect = rect(panel);
  if (panelRect.left < 0 || panelRect.right > window.innerWidth || panelRect.top < 0 || panelRect.bottom > window.innerHeight) {
    failures.push(`reward panel outside viewport ${JSON.stringify(panelRect)}`);
  }
  if (cards.length !== 3) failures.push(`expected 3 reward cards, got ${cards.length}`);

  cards.forEach((card, index) => {
    const cardRect = rect(card);
    if (cardRect.left < panelRect.left - 1 || cardRect.right > panelRect.right + 1) {
      failures.push(`reward card ${index} x overflow ${JSON.stringify(cardRect)}`);
    }
    if (cardRect.height < 44) failures.push(`reward card ${index} touch target too small ${cardRect.height}`);
    ['span', 'strong', 'small'].forEach((selector) => {
      const node = card.querySelector(selector);
      if (node && node.scrollWidth > node.clientWidth + 1) {
        failures.push(`reward card ${index} ${selector} clipped ${node.scrollWidth} > ${node.clientWidth}`);
      }
    });
    const rules = card.querySelector('em');
    if (rules && rules.textContent && !/(抽|MP|授权|修补|整备|全场|前排|单体)/.test(rules.textContent)) {
      failures.push(`reward card ${index} rules lacks core action token: ${rules.textContent}`);
    }
  });

  const original = panel.scrollTop;
  panel.scrollTop = panel.scrollHeight;
  const last = cards[cards.length - 1];
  if (last && rect(last).bottom > rect(panel).bottom + 1) {
    failures.push('last reward card unreachable after panel scroll');
  }
  panel.scrollTop = original;

  return {
    ok: failures.length === 0,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    panel: panelRect,
    cards: cards.map(rect),
    panelScroll: { clientHeight: panel.clientHeight, scrollHeight: panel.scrollHeight },
    failures
  };
})();
```

### 5.4 真实 tap 检查点

后续 browser QA 不能只截图，至少要在 `390x844` 和 `360x780` 各跑一次：

1. Tap `发牌`，断言只进入一次 PlayerTurn，不产生重复 intent。
2. Tap 0 费起手，再 tap 1 费 draw / repair，再 tap 2 费 reorder，断言 `.card-intent-preview` 变成短反馈，例如 `抽2找解`、`抽3整备`。
3. Tap `wild_mana_stitch`，断言 MP chip 或卡牌短反馈出现 `MP+1` / `临时+1`，并且不提高 Max MP 文案不进入手机主卡面。
4. 制造缺 MP，断言 `.missing-cost` 是 `缺MPN` 级短句，且在按钮内。
5. 制造 `0 -> 1 -> 2` 授权，断言 `.authorization-cost` 是 `授权付` 级短句，且在按钮内。
6. 展开奖励面板，选择修补 / 整备奖励，断言 reward 单 tap 只选择一次，面板关闭或状态推进可见。
7. 桌面补跑日志压力，断言 Wild / reorder / 临时 MP 事件不让 `.combat-feed` 覆盖 `.run-layer-panel`。

## 6. 结束后关闭浏览器的验收纪律

后续实际执行 browser QA 时必须记录清理结果。最低纪律：

1. 启动 dev server 时保存 PID 和 URL；如果 `5174` 被占用，使用下一个端口并写入 QA 记录。
2. browser 脚本必须使用 `try/finally`，无论断言成功或失败都执行清理。
3. 清理顺序：关闭 page -> 关闭 context -> 关闭 browser -> 停止本次启动的 dev server。
4. 清理后检查端口是否仍被本次进程占用；如果未关闭，记录 `cleanup failure`，不能把本轮 QA 记为通过。
5. 不允许把浏览器窗口、context、trace viewer 或 dev server 留给下一个 worker；长任务多 agent 并行时这会污染后续验收。

推荐伪代码：

```js
let server;
let browser;
let context;
let page;

try {
  server = await startDevServer({ port: 5174 });
  browser = await chromium.launch({ headless: false });
  context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await context.newPage();
  await page.goto(server.url);
  // run viewport/state probes here
} finally {
  if (page) await page.close().catch(() => {});
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  if (server) await server.stop().catch(() => {});
}
```

## 7. 给实现 worker 的短结论

- `Wild / 修补`、`reorder / 整备`、`临时MP` 都必须进入短 token 体系。
- 手机手牌主卡面只显示费用、短名、角色、链路、抽牌 / MP / 授权结果；完整规则不进入按钮。
- 奖励卡可以展示两行规则，但核心动作和数值必须在第一句。
- 日志是桌面辅助信息，不是移动端说明来源；日志也要短化，避免右侧 HUD 覆盖。
- Browser QA 必须同时证明“不超框”和“真实 tap 可连续操作”，并在结束后关闭浏览器和 dev server。
