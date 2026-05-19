# 2026-05-18 Round 07 Expert 04：移动端 reorder QA

身份：第 7 轮专家 04，移动端 reorder QA  
工作目录：`/Users/roc/Game-001`  
本轮目标：设计第 7 轮实现“整备 / 置顶 / 找牌”后的移动端验收方案。  
工作边界：只新增本文档；不改源码、不打开浏览器、不提交 git。本文所有浏览器脚本均为后续 QA worker 的执行建议，不是本轮已执行结果。

## 0. 验收结论先行

第 7 轮如果把 `reorder` 从“整备/找牌”文案推进到真实运行时，移动端验收不能只看“抽到了目标牌”。必须同时证明：

1. `360x640` 极短屏下，奖励面板、置顶/找牌面板、手牌横滑 rail 不互相遮挡，页面本体不出现横向滚动。
2. `390x844` 常见手机屏下，玩家能连续完成：发牌 -> 出 0/1/2 链 -> 触发整备/置顶/找牌 -> 查看目标短反馈 -> 继续出牌或结束回合。
3. 手牌横滑 rail 仍是单行横向滚动，不因找牌后手牌增加、候选卡出现、日志增长而退回多行。
4. 奖励面板出现时，输入焦点由奖励面板接管；底部手牌、结束回合、置顶候选不能抢 tap。
5. 桌面日志可以帮助理解，但移动端不能依赖日志；移动端核心反馈必须在卡面短 token、状态 chip 或置顶面板内出现。
6. 后续实际浏览器 QA 必须关闭 page / context / browser / dev server；未清理干净不能记为通过。

## 1. 风险清单

### 1.1 P0 阻断风险

| 风险 | 触发条件 | 用户表现 | 阻断理由 | 验收重点 |
| --- | --- | --- | --- | --- |
| 页面横向滚动 | 置顶面板、奖励卡、手牌卡新增长文案或长英文 token | 360 宽下左右拖动整个页面，HUD 偏移 | `body` 本来不该靠页面滚动救场；横向滚动会让 tap 坐标和视觉状态错位 | `max(documentElement.scrollWidth, body.scrollWidth) <= viewportWidth + 1` |
| 手牌 rail 退化为多行 | 找牌 / 抽牌后手牌到 6-8 张，CSS 或新增容器改变 `.card-row` | 底部手牌区变高，压住 run layer / enemy peek / reward | 移动端 P0 布局合同是横滑 rail | `display:flex`，`overflow-x:auto/scroll`，高度不随卡数增长 |
| 置顶/找牌 UI 与奖励面板重叠 | 升级奖励同时触发，或出牌后立即进入 Reward | 两个弹层同时可点，玩家不知道选奖励还是置顶 | 输入层冲突会造成错选和状态推进错误 | Reward 态只允许 `.reward-panel` 接管；reorder pending 必须先完成或被取消 |
| 置顶候选被底部 rail 遮挡 | `360x640` 下候选面板居中或贴底 | 最后一张候选卡/确认按钮点不到 | 找牌流程无法完成 | 面板 `max-height` + 内部滚动，确认/关闭按钮可见可点 |
| 关闭按钮不可达 | 置顶面板或奖励面板内部滚动后 header 被滚走 | 玩家无法取消 / 关闭 pending UI | 移动端误触后无法恢复 | 关闭/取消/确认控件固定在面板可见区域，触控高度 >= 44px |
| 日志增长遮挡桌面右侧面板 | `CardTopdecked`、`DeckSearchMissed`、奖励选择、临时 MP 都追加长日志 | `.combat-feed` 盖住 `.run-layer-panel` 或底部手牌 | 桌面 QA 会误判运行态；长日志也暴露文案预算失控 | 日志行数、面板高度、遮挡 pair probe |
| 移动端只在日志里反馈置顶 | 手机隐藏 `.combat-feed` 后，玩家看不到“找到了什么” | 出牌后只看到手牌变化，不知道整备是否生效 | 机制反馈缺失 | 卡面/状态/置顶面板必须出现 `置顶`、`找终结`、`找路线`、`未找到` 等短反馈 |
| 浏览器或 dev server 泄漏 | Playwright 断言失败后未 finally 清理 | 后续 worker 复用旧页面、旧状态或端口占用 | 长任务多 agent 会互相污染 | 清理检查必须是 QA 记录的一部分 |

### 1.2 P1 高风险

| 风险 | 触发条件 | 影响 | 验收重点 |
| --- | --- | --- | --- |
| `390x844` 正常但 `360x640` 失败 | 只按常见手机调试，忽略短屏 | 小屏用户奖励/找牌不可用 | 360x640 是阻断准入，不是补充截图 |
| `.reward-card em` 两行截断吞掉核心收益 | 新奖励牌规则写成解释句 | 玩家不知道拿的是修补、终结还是整备 | 核心动作和数值必须在第一句前半 |
| `.card-intent-preview` 被省略号吞掉 | `抽3整备找终结并置顶` 过长 | 玩家看不到抽几张 / 找什么 | 移动卡面短句建议 `抽3找终结`、`置顶终结`、`未找到` |
| 置顶反馈和抽牌反馈顺序混乱 | 先 draw 后 topdeck，或日志顺序错误 | 玩家以为找牌没有影响下一抽 | DOM / 日志 / debug trace 顺序要一致：找牌 -> 置顶 -> 抽牌 |
| 找牌候选卡触控目标过小 | 候选卡复用桌面 card button，高度被压缩 | 误点或无法选择 | 候选卡、确认、取消 >= 44px |
| 横滑 rail 和候选面板手势冲突 | 置顶面板内也横向滑卡 | 页面误滚，候选无法选择 | pending 面板出现时，底部 hand rail 不应接收 pointer |
| `aria-live` 日志刷屏 | 连续 topdeck / draw / reward 日志 | 读屏或自动化快照噪声大 | 日志短化，关键状态有稳定 DOM token |

### 1.3 P2 可接受但需记录

| 风险 | 可接受条件 | 记录方式 |
| --- | --- | --- |
| 低优先级说明被 ellipsis | 核心动作、数值、目标已经在其他可见字段出现 | 记录被截断字段和替代信息位置 |
| 奖励面板在 `360x640` 需要内部滚动 | 最后一张奖励和确认 tap 可达，页面本体不滚 | 记录 `panel.scrollHeight > panel.clientHeight` |
| 桌面日志单条被裁成 1-2 行 | 首段仍能读出事件类型和目标牌 | 记录日志最大行数与示例 |
| 置顶候选只显示短名 | 完整牌名在详情层或 title，可见短名不重复混淆 | 记录短名映射 |

## 2. 移动端验收矩阵

| 视口 | 用途 | 必测状态 |
| --- | --- | --- |
| `360x640` | 极短屏阻断准入 | PlayerTurn 6-8 张手牌、置顶/找牌 pending、Reward 三选一、缺 MP/授权支付、日志桌面不测 |
| `390x844` | 常见手机主验收 | 完整操作链：发牌、出牌、整备置顶、继续抽牌、奖励选择、关闭 pending |
| `360x780` | 360 宽常规高度确认 | rail 横滑、奖励内部滚动、状态 chip 文案 |
| `430x932` | 宽手机回归 | 确认不是只对 360 做了过度压缩，阅读层级仍清楚 |
| `640x360` | 横屏压力 | 顶部状态、底部 rail、pending 面板高度预算 |
| `1280x720` / `1366x768` | 桌面日志与遮挡 | `.combat-feed`、`.run-layer-panel`、`.debug-panel`、`.card-row` 遮挡 |

准入顺序：先过 `360x640`，再看 `390x844`。390 通过不能抵消 360 失败。

## 3. 关键 UI 合同

### 3.1 手牌横滑 rail

- `<=640px` 下 `.card-row` 必须保持 `display:flex` 和横向滚动。
- 单张 `.card-button` 宽度稳定，不因 `置顶`、`找终结`、`未找到`、`抽3整备` 等短反馈改变 rail 高度。
- 6-8 张手牌时，第一张和最后一张都能通过横滑触达。
- pending reorder 面板打开时，底部 hand rail 不应抢 tap；如果设计允许背景可见，也必须不可操作。
- 手机卡面不承载完整规则，只承载短 token：
  - `抽3找终结`
  - `置顶终结`
  - `置顶路线`
  - `找牌未中`
  - `MP+1`
  - `授权付`

### 3.2 奖励面板

- `.reward-panel` 继续使用 viewport 内 `max-height` 和内部滚动，不允许页面本体滚动救场。
- `360x640` 下，奖励标题、第一张奖励至少可见；滚到底后最后一张奖励完整可点。
- Reward 态不应同时展示可操作的 reorder pending UI。若技术上仍保留 pending DOM，必须 `display:none`、`inert` 或 pointer 不可达。
- 奖励卡如果新增整备/置顶牌，规则行第一句必须先写动作和数值：
  - 通过：`抽1，找终结置顶。`
  - 通过：`抽1，找路线置顶。`
  - 失败：`整备你的下一轮战斗节奏，并从牌库中寻找合适路线。`

### 3.3 置顶 / 找牌 pending 面板

如果第 7 轮做“自动找牌并置顶”，可以没有 pending 面板，但必须有可见短反馈和可观测事件。

如果第 7 轮做“玩家选择候选牌置顶”，建议面板合同如下：

- 容器建议有稳定选择器：`.reorder-panel` 或 `[data-qa="reorder-panel"]`。
- 候选区建议有稳定选择器：`.reorder-candidates` 或 `[data-qa="reorder-candidates"]`。
- 候选卡建议有稳定选择器：`[data-qa="reorder-candidate"]`，并带 `data-card-id`。
- 确认按钮建议有：`[data-qa="reorder-confirm"]`。
- 取消/关闭按钮建议有：`[data-qa="reorder-cancel"]` 或 `[data-qa="panel-close"]`。
- `360x640` 下，候选卡可以纵向列表或单行横滑，但确认/取消必须始终可达。
- 候选卡不应复用底部 hand rail 的滚动容器，避免两个横向手势嵌套。

### 3.4 日志

- 移动端不能依赖 `.combat-feed` 传达核心机制，因为现有移动布局会隐藏或弱化日志。
- 桌面日志必须短句，不要把完整规则塞进一条：
  - 通过：`整备 Paper Route：置顶 Severance`
  - 通过：`找牌未中：照常抽3`
  - 通过：`出牌 Paper Route · x3 · 抽3`
  - 失败：`出牌 Paper Route 后从抽牌堆和弃牌堆中查找一张终结牌并移动到抽牌堆顶部然后继续抽三张`
- `.combat-feed` 不得覆盖 `.run-layer-panel`、`.debug-panel` 或 `.card-row`。

## 4. DOM probe 建议

下面脚本是后续浏览器 QA worker 的建议。每个 probe 都应在 `360x640`、`390x844` 执行；桌面日志 probe 只在桌面视口执行。

### 4.1 全局视口与遮挡 probe

```js
(() => {
  const failures = [];
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

  const visible = (el) => {
    if (!el) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') !== 0;
  };

  const intersects = (a, b) => {
    if (!a || !b || !visible(a) || !visible(b)) return false;
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return ar.left < br.right && ar.right > br.left && ar.top < br.bottom && ar.bottom > br.top;
  };

  const insideViewport = (name, el, { allowBottomOverflow = false } = {}) => {
    if (!el || !visible(el)) return;
    const r = rect(el);
    if (r.left < -1 || r.right > window.innerWidth + 1 || r.top < -1) {
      failures.push(`${name} outside viewport x/top ${JSON.stringify(r)}`);
    }
    if (!allowBottomOverflow && r.bottom > window.innerHeight + 1) {
      failures.push(`${name} outside viewport bottom ${JSON.stringify(r)}`);
    }
  };

  const horizontalLimit = Math.max(
    document.documentElement.scrollWidth,
    document.body.scrollWidth
  );
  if (horizontalLimit > window.innerWidth + 1) {
    failures.push(`page horizontal overflow: ${horizontalLimit} > ${window.innerWidth}`);
  }

  [
    ['status-strip', document.querySelector('.status-strip')],
    ['combat-director', document.querySelector('.combat-director')],
    ['deal-panel', document.querySelector('.deal-panel')],
    ['target-panel', document.querySelector('.target-panel')],
    ['run-layer-panel', document.querySelector('.run-layer-panel')],
    ['enemy-peek', document.querySelector('.enemy-peek')],
    ['card-row', document.querySelector('.card-row')],
    ['reward-panel', document.querySelector('.reward-panel')],
    ['reorder-panel', document.querySelector('[data-qa="reorder-panel"], .reorder-panel, [aria-label*="整备"], [aria-label*="找牌"], [aria-label*="置顶"]')]
  ].forEach(([name, el]) => insideViewport(name, el));

  [
    ['reward/reorder', '.reward-panel', '[data-qa="reorder-panel"], .reorder-panel'],
    ['reward/card-row', '.reward-panel', '.card-row'],
    ['reorder/card-row', '[data-qa="reorder-panel"], .reorder-panel', '.card-row'],
    ['run-layer/card-row', '.run-layer-panel', '.card-row'],
    ['enemy-peek/card-row', '.enemy-peek', '.card-row'],
    ['combat-feed/run-layer', '.combat-feed', '.run-layer-panel'],
    ['debug/card-row', '.debug-panel', '.card-row']
  ].forEach(([name, aSel, bSel]) => {
    const a = document.querySelector(aSel);
    const b = document.querySelector(bSel);
    if (intersects(a, b)) failures.push(`overlap ${name}`);
  });

  return {
    ok: failures.length === 0,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth
    },
    failures
  };
})();
```

### 4.2 手牌横滑 rail probe

```js
(() => {
  const failures = [];
  const row = document.querySelector('.card-row');
  if (!row) return { ok: false, failures: ['missing .card-row'] };

  const style = getComputedStyle(row);
  if (window.innerWidth <= 640) {
    if (style.display !== 'flex') failures.push(`mobile card-row display is ${style.display}, expected flex`);
    if (!['auto', 'scroll'].includes(style.overflowX)) failures.push(`mobile card-row overflow-x is ${style.overflowX}`);
    if (row.clientHeight > 116) failures.push(`mobile card-row too tall: ${row.clientHeight}`);
  }

  const cards = [...row.querySelectorAll('.card-button')];
  if (cards.length >= 6 && row.scrollWidth <= row.clientWidth + 1) {
    failures.push(`expected horizontal rail overflow for ${cards.length} cards, got ${row.scrollWidth} <= ${row.clientWidth}`);
  }

  const original = row.scrollLeft;
  row.scrollLeft = 0;
  const first = cards[0]?.getBoundingClientRect();
  if (first && first.right < row.getBoundingClientRect().left + 8) {
    failures.push('first card not reachable at scrollLeft 0');
  }
  row.scrollLeft = row.scrollWidth;
  const lastCard = cards[cards.length - 1];
  if (lastCard) {
    const rr = row.getBoundingClientRect();
    const lr = lastCard.getBoundingClientRect();
    if (lr.left > rr.right - 8 || lr.right < rr.left + 8) {
      failures.push('last card not reachable after horizontal scroll');
    }
  }
  row.scrollLeft = original;

  cards.forEach((card, index) => {
    const cardRect = card.getBoundingClientRect();
    ['strong', '.card-meta', '.chain-preview', '.card-intent-preview', '.missing-cost', '.authorization-cost'].forEach((selector) => {
      const node = card.querySelector(selector);
      if (!node) return;
      const nr = node.getBoundingClientRect();
      if (nr.left < cardRect.left - 1 || nr.right > cardRect.right + 1 || nr.top < cardRect.top - 1 || nr.bottom > cardRect.bottom + 1) {
        failures.push(`card ${index} ${selector} outside parent`);
      }
      if (node.scrollWidth > node.clientWidth + 1) {
        failures.push(`card ${index} ${selector} clipped horizontally: ${node.scrollWidth} > ${node.clientWidth}`);
      }
      if (node.scrollHeight > node.clientHeight + 1) {
        failures.push(`card ${index} ${selector} clipped vertically: ${node.scrollHeight} > ${node.clientHeight}`);
      }
    });
  });

  return {
    ok: failures.length === 0,
    cards: cards.length,
    row: {
      clientWidth: row.clientWidth,
      scrollWidth: row.scrollWidth,
      clientHeight: row.clientHeight,
      scrollLeft: row.scrollLeft
    },
    failures
  };
})();
```

### 4.3 奖励面板 probe

```js
(() => {
  const failures = [];
  const panel = document.querySelector('.reward-panel');
  if (!panel) return { ok: false, failures: ['missing .reward-panel'] };

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

  const pr = rect(panel);
  if (pr.left < 0 || pr.right > window.innerWidth || pr.top < 0 || pr.bottom > window.innerHeight) {
    failures.push(`reward panel outside viewport ${JSON.stringify(pr)}`);
  }
  if (window.innerWidth <= 390 && pr.left < 8) failures.push(`reward panel left margin too small: ${pr.left}`);
  if (window.innerWidth <= 390 && window.innerWidth - pr.right < 8) failures.push(`reward panel right margin too small: ${window.innerWidth - pr.right}`);

  const cards = [...panel.querySelectorAll('.reward-card')];
  if (cards.length !== 3) failures.push(`expected 3 reward cards, got ${cards.length}`);

  cards.forEach((card, index) => {
    const cr = rect(card);
    if (cr.left < pr.left - 1 || cr.right > pr.right + 1) failures.push(`reward card ${index} x overflow`);
    if (cr.height < 44) failures.push(`reward card ${index} touch target too small: ${cr.height}`);
    ['span', 'strong', 'small'].forEach((selector) => {
      const node = card.querySelector(selector);
      if (!node) return;
      if (node.scrollWidth > node.clientWidth + 1) {
        failures.push(`reward card ${index} ${selector} clipped: ${node.scrollWidth} > ${node.clientWidth}`);
      }
    });
    const rules = card.querySelector('em');
    if (rules && !/(抽|找|置顶|整备|修补|MP|授权|终结|路线|全场|前排|单体)/.test(rules.textContent || '')) {
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

  const reorderPanel = document.querySelector('[data-qa="reorder-panel"], .reorder-panel');
  if (reorderPanel) {
    const style = getComputedStyle(reorderPanel);
    if (style.display !== 'none' && style.visibility !== 'hidden') {
      failures.push('reward and reorder panels are both visible');
    }
  }

  return {
    ok: failures.length === 0,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    panel: pr,
    panelScroll: { clientHeight: panel.clientHeight, scrollHeight: panel.scrollHeight },
    failures
  };
})();
```

### 4.4 置顶 / 找牌 panel probe

如果实现是自动置顶、没有 pending UI，这个 probe 可以返回 `skipped: true`；但必须用事件 / 日志 / 手牌结果 probe 证明机制发生。

```js
(() => {
  const panel = document.querySelector('[data-qa="reorder-panel"], .reorder-panel, [aria-label*="整备"], [aria-label*="找牌"], [aria-label*="置顶"]');
  if (!panel) return { ok: true, skipped: true, reason: 'no visible reorder pending panel' };

  const failures = [];
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

  const pr = rect(panel);
  if (pr.left < 0 || pr.right > window.innerWidth || pr.top < 0 || pr.bottom > window.innerHeight) {
    failures.push(`reorder panel outside viewport ${JSON.stringify(pr)}`);
  }
  if (panel.scrollHeight > panel.clientHeight + 1 && getComputedStyle(panel).overflowY === 'visible') {
    failures.push('reorder panel needs internal vertical scroll but overflow-y is visible');
  }

  const candidates = [...panel.querySelectorAll('[data-qa="reorder-candidate"], .reorder-candidate, .reward-card, .card-button')];
  if (candidates.length === 0) failures.push('no reorder candidates found');
  candidates.forEach((candidate, index) => {
    const cr = rect(candidate);
    if (cr.height < 44) failures.push(`candidate ${index} touch target too small: ${cr.height}`);
    if (cr.left < pr.left - 1 || cr.right > pr.right + 1) failures.push(`candidate ${index} x overflow`);
    if (!/(抽|找|置顶|终结|路线|修补|MP|授权|伤害|护盾)/.test(candidate.textContent || '')) {
      failures.push(`candidate ${index} lacks readable action token: ${(candidate.textContent || '').trim()}`);
    }
  });

  const closeOrCancel = panel.querySelector('[data-qa="reorder-cancel"], [data-qa="panel-close"], button[aria-label*="关闭"], button[aria-label*="取消"], button');
  if (!closeOrCancel) {
    failures.push('missing close/cancel button');
  } else if (rect(closeOrCancel).height < 44) {
    failures.push(`close/cancel touch target too small: ${rect(closeOrCancel).height}`);
  }

  const confirm = panel.querySelector('[data-qa="reorder-confirm"], button[aria-label*="确认"], button[aria-label*="置顶"]');
  if (confirm && rect(confirm).height < 44) {
    failures.push(`confirm touch target too small: ${rect(confirm).height}`);
  }

  return {
    ok: failures.length === 0,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    panel: pr,
    candidates: candidates.length,
    failures
  };
})();
```

### 4.5 机制反馈 probe

这个 probe 不要求知道内部 runtime，只检查玩家是否能在移动端看到“整备 / 找牌 / 置顶”的短反馈。

```js
(() => {
  const failures = [];
  const visibleText = [
    ...document.querySelectorAll('.card-button, .status-strip, .combat-director, .deal-panel, [data-qa="reorder-panel"], .reorder-panel, .reward-panel')
  ]
    .filter((el) => {
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    })
    .map((el) => el.textContent || '')
    .join('\n');

  const hasReorderToken = /(整备|找牌|找终结|找路线|置顶|未找到)/.test(visibleText);
  const hasDrawToken = /抽\s*\d|抽\d/.test(visibleText);
  if (!hasReorderToken) failures.push('missing visible reorder/search/topdeck token');
  if (!hasDrawToken) failures.push('missing visible draw count token');

  if (/重排牌库|任意排序|浏览整个牌库/.test(visibleText)) {
    failures.push('visible text overpromises full deck reorder/search');
  }

  return {
    ok: failures.length === 0,
    visibleTextSample: visibleText.slice(0, 500),
    failures
  };
})();
```

### 4.6 桌面日志 probe

```js
(() => {
  const failures = [];
  const feed = document.querySelector('.combat-feed');
  const runLayer = document.querySelector('.run-layer-panel');
  const cardRow = document.querySelector('.card-row');
  if (!feed) return { ok: true, skipped: true, reason: 'no combat feed' };

  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  };
  const intersects = (a, b) => {
    if (!a || !b) return false;
    const ar = rect(a);
    const br = rect(b);
    return ar.left < br.right && ar.right > br.left && ar.top < br.bottom && ar.bottom > br.top;
  };

  if (runLayer && intersects(feed, runLayer)) failures.push('combat feed overlaps run-layer-panel');
  if (cardRow && intersects(feed, cardRow)) failures.push('combat feed overlaps card-row');

  [...feed.querySelectorAll('li')].forEach((item, index) => {
    const text = (item.textContent || '').trim();
    if (text.length > 42) failures.push(`log ${index} too long: ${text}`);
    if (/整备|置顶|找牌/.test(text) && !/(抽|置顶|未中|终结|路线|修补)/.test(text)) {
      failures.push(`log ${index} lacks result token: ${text}`);
    }
  });

  return {
    ok: failures.length === 0,
    feed: rect(feed),
    logCount: feed.querySelectorAll('li').length,
    failures
  };
})();
```

## 5. 手动脚本步骤

### 5.1 执行前纪律

1. 后续 QA worker 才能打开浏览器；本文档创建者不打开浏览器。
2. 记录本次 dev server 命令、端口、PID、测试 URL。
3. 每个视口保存一张截图或 probe JSON；失败时保存失败状态，不只写“失败”。
4. 使用 `try/finally` 管理浏览器和 dev server，结束后做端口清理检查。

### 5.2 `390x844` 主流程

1. 设置 viewport 为 `390x844`。
2. 进入游戏初始态，确认页面无横向滚动。
3. Tap 发牌，进入 PlayerTurn。
4. 检查 `.card-row` 是横滑 rail，首张卡可见，底部 rail 高度稳定。
5. 按 0 -> 1 -> 2 链出牌，使用会触发整备/找牌/置顶的 2 MP 卡。
6. 如果是自动置顶实现：
   - 确认出牌后出现 `找终结`、`找路线`、`置顶` 或 `未找到` 短反馈。
   - 确认下一次抽牌结果与置顶目标一致。
7. 如果是候选选择实现：
   - 确认 pending 面板出现，背景 hand rail 不可点。
   - 横滑或纵滚候选列表，选择一张候选。
   - Tap 确认，确认 pending 面板关闭。
   - 确认被选牌进入下一抽或手牌中，并有短反馈。
8. 继续操作到 Reward 态。
9. 检查 `.reward-panel` 单列、可滚、三张奖励可点。
10. 选择一张带整备/置顶语义的奖励，确认单 tap 只选择一次，面板关闭或进入下一状态。
11. 执行全局视口 probe、rail probe、奖励 probe、机制反馈 probe。

### 5.3 `360x640` 阻断流程

1. 设置 viewport 为 `360x640`。
2. 进入 PlayerTurn，制造或加载 6-8 张手牌状态。
3. 检查页面本体不能横向滚动。
4. 检查底部 `.card-row` 高度不超过 116px，最后一张卡可横滑触达。
5. 触发整备/置顶/找牌。
6. 如果有 pending 面板：
   - 面板完全在 viewport 内。
   - 候选、确认、取消的触控高度都不低于 44px。
   - 滚动面板到底后，最后一个候选和确认按钮可点。
   - 关闭/取消按钮不被滚走或不可达。
7. 如果无 pending 面板：
   - 必须在移动端可见区域看到 `置顶终结`、`置顶路线`、`找牌未中` 等短反馈。
8. 打开奖励面板，滚到底，确认最后一张奖励没有被底部 rail 或 viewport 裁掉。
9. 执行全局视口 probe、rail probe、奖励 probe、置顶 panel probe、机制反馈 probe。
10. 任何 P0 probe 失败，直接判定该实现不能合入。

### 5.4 桌面日志与遮挡流程

1. 设置 viewport 为 `1280x720`，另补 `1366x768`。
2. 连续出牌制造以下日志：普通出牌、整备置顶、找牌未中、奖励选择、临时 MP 或授权支付。
3. 检查 `.combat-feed` 没有覆盖 `.run-layer-panel`、`.debug-panel`、`.card-row`。
4. 日志短句必须能读出事件和结果，不能超过两行。
5. 执行桌面日志 probe 和全局视口 probe。

### 5.5 关闭浏览器纪律

后续实际执行时必须用类似流程：

```js
let server;
let browser;
let context;
let page;

try {
  server = await startDevServer({ preferredPort: 5174 });
  browser = await chromium.launch({ headless: false });
  context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await context.newPage();
  await page.goto(server.url);
  // run manual steps and probes
} finally {
  if (page) await page.close().catch(() => {});
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  if (server) await server.stop().catch(() => {});
  await assertNoOwnedBrowserOrServerProcesses();
}
```

清理要求：

- 关闭顺序：page -> context -> browser -> 本次启动的 dev server。
- 如果使用 trace viewer、截图预览或可视浏览器窗口，也必须关闭。
- 如果端口仍被本次 PID 占用，记录 `cleanup failure`，本轮 QA 不能标记通过。
- 不杀其他 worker 或用户已有进程；只清理本次启动并记录的 PID。

## 6. 通过 / 失败标准

### 6.1 通过标准

同时满足以下条件才算移动端 reorder QA 通过：

1. `360x640`、`390x844`、`360x780` 均无页面横向滚动。
2. `<=640px` 下 `.card-row` 保持横向 rail；6-8 张手牌时首尾可达，高度不随卡数显著增长。
3. 整备/置顶/找牌触发后，移动端可见区域有短反馈，且不依赖桌面日志。
4. 若存在 pending 置顶面板，候选、确认、取消均在 `360x640` 可达可点，触控高度 >= 44px。
5. Reward 态只有奖励面板接管输入；奖励面板可内部滚动到最后一张卡。
6. `.reward-card` 两行规则内可读出核心动作和数值。
7. 桌面 `.combat-feed` 不遮挡右侧 run/debug/hand 区，日志短句不扩张 HUD。
8. 置顶/找牌的运行结果可被观察：目标牌被置顶后进入下一抽，或明确显示 `未找到` 并照常抽牌。
9. QA 结束后浏览器、context、page、dev server 全部关闭，并有清理记录。

### 6.2 失败标准

出现以下任一项即失败：

1. `360x640` 出现页面横向滚动。
2. `.card-row` 在手机变成多行网格，或高度增长后遮挡其他关键 HUD。
3. 置顶/找牌 pending 面板与奖励面板同时可操作。
4. 置顶/找牌候选、确认、取消在 `360x640` 无法触达。
5. 移动端只能从日志理解整备结果。
6. 奖励面板最后一张奖励无法滚动到完整可点。
7. `.combat-feed` 桌面遮挡 `.run-layer-panel`、`.debug-panel` 或 `.card-row`。
8. 关键短 token 被裁掉，例如 `抽3`、`置顶终结`、`找牌未中`、`授权付`、`MP+1`。
9. 浏览器或 dev server 清理失败。

### 6.3 需要人工裁决的灰区

| 灰区 | 默认裁决 |
| --- | --- |
| `360x640` 下奖励面板需要内部滚动 | 可接受，只要最后一张和关闭/选择动作可达 |
| 候选卡短名被截断，但 `data-card-id` 和详情可查 | 不建议通过；移动端玩家仍需要可读短名 |
| 自动置顶没有 pending UI | 可接受，但必须有可见反馈和运行结果证据 |
| 找牌未中但没有解释原因 | P1，不阻断；至少要显示 `未找到`，不能静默失败 |
| 桌面日志被 ellipsis | 可接受，前半句必须保留事件和结果 |

## 7. 建议 QA 记录模板

```md
## Mobile Reorder QA Record

- Build / commit:
- Dev server:
- Browser:
- Viewports:
  - 360x640:
  - 390x844:
  - 360x780:
  - 1280x720:
- Reorder mode:
  - [ ] 自动置顶
  - [ ] 候选选择置顶
  - [ ] 未找到 fallback
- Probe results:
  - global viewport:
  - hand rail:
  - reward panel:
  - reorder panel:
  - visible feedback:
  - desktop log:
- Manual path:
  - 发牌:
  - 0/1/2 链:
  - 整备触发:
  - 置顶结果:
  - 奖励选择:
- Cleanup:
  - page closed:
  - context closed:
  - browser closed:
  - dev server stopped:
  - owned port clear:
- Final verdict:
```

## 8. 给第 7 轮实现方的短红线

- 手机上不要写“重排牌库”这种大承诺；实际如果只是找一张置顶，就写 `找终结置顶` 或 `找路线置顶`。
- 不要把完整规则塞进手牌按钮；手机主卡面只放短 token。
- 不要让 Reward 与 reorder pending 同时抢输入。
- 不要为了显示候选而破坏底部 hand rail 的单行横滑合同。
- 不要把桌面日志当作移动端机制说明来源。
- 不要留下浏览器、context 或 dev server 给下一个 worker。
