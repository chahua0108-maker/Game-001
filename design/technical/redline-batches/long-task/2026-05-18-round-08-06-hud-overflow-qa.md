# 2026-05-18 Round 08-06：HUD Overflow QA Specialist

角色：第 8 轮专家 06，HUD Overflow QA Specialist  
工作目录：`/Users/roc/Game-001`  
边界：只新增本文档；不改源码、不提交、不回滚、不打开浏览器。  
目标：审查第 7 轮 HUD 短 token 后，如果新增 `CardTopdecked` / `DeckSearchMissed` 日志，哪些 UI 节点最可能超框；给出 DOM probe、移动端手测脚本、必须关闭浏览器的验收纪律。

## 0. 结论

第 7 轮已经把多数玩家可见 token 压短：`授权+N`、`授权付`、`缺授权`、`整备`、`修补` 等现在比旧 slash 词稳定。若第 8 轮只新增 `CardTopdecked` / `DeckSearchMissed` 的 combat log 分支，最高风险不在卡牌角色标签，而在这些节点：

| 优先级 | 节点 | 为什么最可能超框 | 阻断标准 |
| --- | --- | --- | --- |
| P0 | `.combat-feed li` | 新日志天然想写完整牌名、来源区、偏好、命中结果；桌面宽度约 244px。 | 单条日志不能横向撑破；不能覆盖 `.run-layer-panel`、`.debug-panel`、`.card-row`。 |
| P0 | `.combat-feed header span` | 若把“最近整备命中/未命中”塞进 header，和行内日志同时增长。 | header 只能保留短状态，不承载目标牌全名。 |
| P0 | `.combat-director .director-cell strong/em` | 移动端日志隐藏，后续实现者可能把 `CardTopdecked` 结果转移到 Director；四格/两格单行 ellipsis 容量很小。 | 不允许出现 `已将 Severance Burst 置于牌顶` 这类完整句。 |
| P1 | `.card-intent-preview` | 移动端不能依赖日志，容易把 `置顶终结 / 未找到终结` 塞回卡面压力行。 | 卡面仍只表达打出前价值：`抽3仍-12`、`抽1整`、`不降压`；结果不回写到手牌。 |
| P1 | `.card-effect` | 桌面可见、移动端可能隐藏；如果写 `抽3并搜索终结牌置于牌顶` 会溢出。 | 桌面最多 `MP2 · 抽3整`，移动端不得依赖此字段。 |
| P1 | `.reward-card small/em` | 新奖励牌若说明真实整备，最容易把规则写成长句。 | 第一句必须在两行内读到动作和数值。 |
| P2 | `.status-strip` / `.status-chip` | 不应放 reorder 结果；一旦新增 chip，会挤压 HP/MP/链路/意图。 | `CardTopdecked` / `DeckSearchMissed` 不进入状态条。 |

核心 QA 口径：新增事件可以进入桌面日志，但移动端必须有短 token 替代位；所有位置都测 `scrollWidth <= clientWidth + 1`，不能只凭截图目测。

## 1. 当前事实

只读审查得到的当前事实：

- `hudCardRoleLabel()` 对 `utilities.has('reorder')` 返回 `整备`，不是旧的 `整备/找牌`。
- `hudAuthorizationState()` 已返回 `授权+N`，支付状态为 `授权付` / `缺授权`。
- `.combat-feed li` 当前已有 `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`。
- 移动端 CSS 会隐藏 `.combat-feed` 和 `.debug-panel`。
- `combatEventLabel()` 当前还没有 `CardTopdecked` / `DeckSearchMissed` 分支。
- 第 7 轮实现切片建议的日志文案是 `整备：{CardName} 置于牌顶` 和 `整备未找到{终结/路线/修补}`，其中成功分支若使用英文全名，仍可能超出桌面日志预算。

## 2. 新日志文案预算

建议把新增日志分成“玩家可读短句”和“debug/title 详情”。

| 事件 | 桌面日志推荐 | 桌面日志上限 | 禁止写法 |
| --- | --- | --- | --- |
| `CardTopdecked` 命中 payoff | `整备：顶终结` | 7 中文字以内，或 18 英文字符以内 | `整备：Severance Burst 置于牌顶` |
| `CardTopdecked` 命中 route | `整备：顶路线` | 同上 | `整备：Lantern Captain 找到路线牌并置顶` |
| `CardTopdecked` 命中 repair | `整备：顶修补` | 同上 | `从 discardPile 找到 Wild Mana Stitch` |
| `DeckSearchMissed` payoff | `整备未中终结` | 7 中文字以内 | `整备未找到任何可用终结牌` |
| `DeckSearchMissed` route | `整备未中路线` | 7 中文字以内 | `牌库和弃牌堆都没有 route-bridge` |
| 来源区详情 | `title` / debug | 不进可见短行 | `from drawPile / discardPile` 直接可见 |

如果必须展示具体牌名，先做 `shortCardName()`，例如 `Burst`、`Ledger`、`Wild`、`Paper`。不要在 combat feed 的常驻行里使用完整英文名。

## 3. 最可能超框节点细查

### 3.1 `.combat-feed li`

这是新增 `CardTopdecked` / `DeckSearchMissed` 的第一落点。虽然当前 CSS 已有 ellipsis，但 QA 不能只接受“被省略也行”。如果一句日志被截到只剩 `整备：Sever...`，玩家仍然不知道是命中、未中还是来源。

必须检查：

- 每条 `li` 的 `scrollWidth <= clientWidth + 1`，否则算“被裁切”，哪怕 CSS 没撑破布局。
- `li.textContent.length` 不应靠 ellipsis 消化长句。
- `ol` 行数增长后不覆盖右侧 run/debug 区域。
- `aria-live="polite"` 不因连续日志刷出长句噪声。

### 3.2 `.combat-director strong/em`

移动端隐藏 combat feed 后，后续 worker 很可能想把整备结果塞进 Director。这个方向可以接受，但必须使用分类结果，不使用完整牌名。

通过：

- `strong: 下抽终结`
- `em: 整备成功`
- `strong: 无整备`
- `em: 照常抽牌`

失败：

- `strong: Severance Burst`
- `em: 已从弃牌堆置于牌顶`
- `strong: DeckSearchMissed`

### 3.3 `.card-intent-preview`

这行是出牌前预览，不是结果日志。若 `CardTopdecked` 后把结果回写到当前手牌，容易和“抽N仍-X”争抢宽度。

准则：

- 打出前：`抽3仍-12` / `抽1整` / `不降压`。
- 打出后：结果只去日志、Director 或 future toast。
- 不允许：`抽3找终结置顶仍-12`。

### 3.4 `.reward-card small/em`

奖励三选一如果新展示整备牌，`small` 和 `em` 是第二高风险点。移动端 `em` 两行内必须先读到动作。

通过：

- `small: MP2 · 抽1整`
- `em: 抽1；接链抽3。整备牌顶。`

失败：

- `em: 打出后搜索抽牌堆和弃牌堆中的终结牌并移动到抽牌堆顶部。`

## 4. DOM Probe

以下脚本给后续浏览器 QA worker 使用。本轮未执行浏览器。

### 4.1 全局 overflow 与遮挡

```js
(() => {
  const failures = [];
  const visible = (el) => {
    if (!el) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || '1') !== 0;
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
  const intersects = (a, b) => {
    if (!visible(a) || !visible(b)) return false;
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return ar.left < br.right && ar.right > br.left && ar.top < br.bottom && ar.bottom > br.top;
  };
  const pageWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  if (pageWidth > window.innerWidth + 1) {
    failures.push(`page horizontal overflow ${pageWidth} > ${window.innerWidth}`);
  }
  [
    ['status-strip', document.querySelector('.status-strip')],
    ['combat-director', document.querySelector('.combat-director')],
    ['combat-feed', document.querySelector('.combat-feed')],
    ['run-layer-panel', document.querySelector('.run-layer-panel')],
    ['debug-panel', document.querySelector('.debug-panel')],
    ['card-row', document.querySelector('.card-row')],
    ['reward-panel', document.querySelector('.reward-panel')]
  ].forEach(([name, el]) => {
    if (!visible(el)) return;
    const r = rect(el);
    if (r.left < -1 || r.right > window.innerWidth + 1 || r.top < -1 || r.bottom > window.innerHeight + 1) {
      failures.push(`${name} outside viewport ${JSON.stringify(r)}`);
    }
  });
  [
    ['combat-feed/run-layer', '.combat-feed', '.run-layer-panel'],
    ['combat-feed/debug', '.combat-feed', '.debug-panel'],
    ['combat-feed/card-row', '.combat-feed', '.card-row'],
    ['reward/card-row', '.reward-panel', '.card-row'],
    ['director/status', '.combat-director', '.status-strip']
  ].forEach(([name, aSel, bSel]) => {
    if (intersects(document.querySelector(aSel), document.querySelector(bSel))) {
      failures.push(`overlap ${name}`);
    }
  });
  return {
    ok: failures.length === 0,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    pageWidth,
    failures
  };
})();
```

### 4.2 文本节点裁切

```js
(() => {
  const failures = [];
  const selectors = [
    '.combat-feed header span',
    '.combat-feed li',
    '.combat-director strong',
    '.combat-director em',
    '.card-button strong',
    '.card-button .card-meta',
    '.card-button .chain-preview',
    '.card-button .card-intent-preview',
    '.card-button .card-effect',
    '.card-button .missing-cost',
    '.card-button .authorization-cost',
    '.reward-card small',
    '.reward-card em',
    '.status-chip strong',
    '.status-chip span'
  ];
  const isVisible = (node) => {
    const s = getComputedStyle(node);
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || '1') !== 0;
  };
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node, index) => {
      if (!isVisible(node)) return;
      if (node.scrollWidth > node.clientWidth + 1) {
        failures.push(`${selector}[${index}] horizontal clip ${node.scrollWidth} > ${node.clientWidth}: "${node.textContent.trim()}"`);
      }
      if (node.scrollHeight > node.clientHeight + 1 && selector !== '.reward-card em') {
        failures.push(`${selector}[${index}] vertical clip ${node.scrollHeight} > ${node.clientHeight}: "${node.textContent.trim()}"`);
      }
    });
  });
  return { ok: failures.length === 0, failures };
})();
```

### 4.3 新事件日志专项

```js
(() => {
  const failures = [];
  const lines = [...document.querySelectorAll('.combat-feed li')].filter((li) => {
    const text = li.textContent.trim();
    return /整备|置顶|未中|未找到|Topdeck|DeckSearch|CardTopdecked/.test(text);
  });
  lines.forEach((li, index) => {
    const text = li.textContent.trim();
    if (text.length > 18 && /[A-Za-z]/.test(text)) {
      failures.push(`reorder log ${index} likely too long with English name: "${text}"`);
    }
    if (text.length > 10 && !/[A-Za-z]/.test(text)) {
      failures.push(`reorder log ${index} likely too long Chinese token: "${text}"`);
    }
    if (/drawPile|discardPile|SearchAndTopdeck|DeckSearchMissed|CardTopdecked/.test(text)) {
      failures.push(`debug term leaked into visible log ${index}: "${text}"`);
    }
    if (li.scrollWidth > li.clientWidth + 1) {
      failures.push(`reorder log ${index} clipped ${li.scrollWidth} > ${li.clientWidth}: "${text}"`);
    }
  });
  return { ok: failures.length === 0, checked: lines.length, failures };
})();
```

### 4.4 移动端日志隐藏后的替代反馈

```js
(() => {
  const failures = [];
  const feed = document.querySelector('.combat-feed');
  const feedVisible = feed && getComputedStyle(feed).display !== 'none';
  const visibleText = [...document.querySelectorAll('body *')]
    .filter((el) => {
      const s = getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || '1') !== 0;
    })
    .map((el) => el.textContent.trim())
    .join('\n');
  if (window.innerWidth <= 640 && !feedVisible) {
    if (!/(下抽终结|下抽路线|整备成功|整备未中|无整备|照常抽牌|顶终结|顶路线)/.test(visibleText)) {
      failures.push('mobile combat-feed hidden but no visible reorder result token found');
    }
  }
  return { ok: failures.length === 0, feedVisible: Boolean(feedVisible), failures };
})();
```

## 5. 移动端手测脚本

后续 QA worker 执行；本轮不打开浏览器。

### 5.1 视口矩阵

必须按这个顺序测：

1. `360x640`：硬准入。任何横向页面滚动、按钮不可达、奖励/手牌遮挡都阻断。
2. `390x844`：主流手机完整链路。
3. `430x932`：宽手机确认没有过度压缩。
4. `640x360`：横屏压力。
5. `1366x768`：桌面 combat feed / run layer / debug 遮挡。

### 5.2 手测步骤

1. 进入战斗，等待首轮发牌。
2. 记录首屏：状态条、Director、目标面板、手牌 rail 是否都在 viewport 内。
3. 横滑手牌 rail 到最右，再回到最左，确认第一张和最后一张可触达。
4. 打出 0/1/2 链直到能触发 `paper_shatter` 或等价整备牌。
5. 触发成功命中路径：期望出现 `CardTopdecked` 或等价日志；桌面看 combat feed，移动端看 Director/短反馈。
6. 触发未命中路径：期望出现 `DeckSearchMissed` 或等价日志；移动端必须读到 `整备未中` / `无整备` / `照常抽牌` 之一。
7. 若出现奖励三选一，滚动奖励面板到底，确认最后一张奖励可点，底部 hand rail 不抢 tap。
8. 回到 PlayerTurn，确认手牌 rail 高度没有因为新增日志或反馈变高。
9. 在每个视口执行 4.1、4.2、4.3；移动视口额外执行 4.4。

### 5.3 记录格式

```text
Viewport:
Path: topdeck hit / search missed / reward overlap / normal draw
Visible token:
DOM probes:
  global overflow:
  text clipping:
  reorder log:
  mobile replacement:
Manual result:
Blocking issues:
Cleanup result:
```

## 6. 浏览器关闭纪律

后续任何实际浏览器 QA 必须遵守：

1. Playwright / browser QA 必须使用 `try/finally`。
2. `finally` 中必须依次关闭 `page`、`context`、`browser`。
3. 如果启动了 dev server，必须记录 PID，并在结束时停止。
4. 失败也必须清理；未清理不能写“通过”。
5. QA 记录必须包含 cleanup 结果：`page closed / context closed / browser closed / dev server stopped`。
6. 长任务多 worker 环境下，不允许复用不明来源的旧页面、旧 context、旧端口状态作为验收依据。

推荐骨架：

```js
let browser;
let context;
let page;
let server;
try {
  // start server if needed
  // browser = await chromium.launch(...)
  // context = await browser.newContext({ viewport: { width: 360, height: 640 } })
  // page = await context.newPage()
  // run probes
} finally {
  if (page) await page.close().catch(() => {});
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  if (server) server.kill('SIGTERM');
}
```

## 7. 验收裁决

必须通过：

- `CardTopdecked` / `DeckSearchMissed` 可见文案不泄漏 debug 类型名。
- 桌面 `.combat-feed li` 不被裁切到丢失事件语义。
- `.combat-feed` 不覆盖 `.run-layer-panel`、`.debug-panel`、`.card-row`。
- 移动端隐藏 combat feed 时，仍有 `下抽终结` / `整备未中` / `无整备` 等短反馈。
- `.card-button` 内 `strong`、`.card-meta`、`.chain-preview`、`.card-intent-preview` 不因新增整备结果回写而超框。
- 奖励卡第一句在移动端两行内读到动作和数值。
- 浏览器、context、page、dev server 全部关闭后才允许记录验收通过。

建议阻断：

- 可见文案出现 `SearchAndTopdeck`、`CardTopdecked`、`DeckSearchMissed`、`drawPile`、`discardPile`。
- `360x640` 有页面横向滚动。
- 移动端只能从隐藏的 `.combat-feed` 理解整备结果。
- 任何 QA 报告没有 cleanup 记录。

STATUS: DONE
