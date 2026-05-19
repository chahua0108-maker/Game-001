# 2026-05-18 Round 09-03：Paper Topdeck Browser Snapshot Harness

角色：第 9 轮专家 03，Paper Topdeck Scenario Harness Engineer  
工作目录：`/Users/roc/Game-001`  
边界：只新增本文档；不改源码、不提交 git、不回滚他人改动。  

## 0. 目标

设计一个浏览器内 Vite harness，用动态 `import()` 直接加载现有 sim、snapshot、HUD 模块，构造一条确定性的：

```text
paper_shatter -> PayoffTopdecked -> HandDealt
```

HUD 快照路径。

这个 harness 不依赖随机奖励、不依赖 run reward 三选一、不依赖人工抽到 `paper_shatter`。它只验证一个可复现镜头：

- `paper_shatter` 打出前，手牌里已经有 `paper_shatter`。
- `drawPile` 里有一张非顶部 3 MP payoff，例如 `severance_burst`。
- 打出后同 trace 先出现 `PayoffTopdecked`，再出现 `HandDealt`。
- HUD combat feed 显示短日志 `整备：顶终结`。
- 卡牌按钮在桌面和移动端都不横向超框、不覆盖其他 HUD 区域。

## 1. 为什么用浏览器动态 import

Vitest 已经能证明 runtime 合同，但它不证明 HUD DOM 真正渲染后的文本预算。这里需要浏览器快照，原因是：

1. `combatEventLabel()` 是 HUD 私有渲染路径，最终文本只在 DOM 中暴露。
2. `.card-button`、`.combat-feed li`、移动端媒体查询的真实宽度只能在浏览器布局后测。
3. Vite dev server 能原样提供 TypeScript ESM 模块，浏览器侧可以用 `await import('/src/...')` 拿到 `createInitialWorld`、`tickWorld`、`buildSnapshot`、`Hud`，不需要新增测试入口或污染生产 main。

推荐形态是独立 harness HTML，而不是改 `src/main.ts`：

```text
prototype-web/harness/paper-topdeck.html
```

后续实现如果坚持“不新增源码外入口”，也可以用 Playwright 打开 `/` 后在 `page.evaluate()` 里动态 import 同样模块，并在临时 DOM root 上挂载 HUD。两种方式的合同一致。

## 2. 动态 import 模块清单

浏览器脚本只需要这些模块：

```js
const [{ createInitialWorld }, { tickWorld }, { buildSnapshot }, { Hud }] = await Promise.all([
  import('/src/sim/world.ts'),
  import('/src/sim/runtime.ts'),
  import('/src/sim/snapshot.ts'),
  import('/src/ui/hud.ts')
]);
```

可选读取：

```js
const { cards } = await import('/src/data/cards.ts');
```

用途只限断言 `cards.paper_shatter.preDrawTopdeckPayoff === true` 或输出 debug；不要从奖励池里抽卡。

## 3. 确定性 world 构造

核心是绕开奖励与随机性，直接设置玩家区域：

```js
function preparePaperTopdeckWorld(createInitialWorld) {
  const world = createInitialWorld();

  world.fsm.gameFlow = 'PlayerTurn';
  world.player.energy = 3;
  world.player.hand = ['paper_shatter'];
  world.player.drawPile = ['spark_tap', 'severance_burst', 'wild_gap_key'];
  world.player.discardPile = [];
  world.player.deck = ['paper_shatter', 'spark_tap', 'severance_burst', 'wild_gap_key'];

  world.reward.pending = false;
  world.reward.choices = [];

  return world;
}
```

注意点：

- `drawPile[0]` 故意不是 payoff，证明 `PayoffTopdecked.fromIndex === 1` 后再抽入手。
- 不设置 `reward.choices`，避免 harness 被误解为奖励验证。
- 不需要等待 `DealHand`，否则初始发牌会引入额外 `HandDealt`，干扰同 trace 断言。
- 如果 UI 需要敌人意图读数，可以保留 `createInitialWorld()` 默认敌人；本镜头不要求击杀或终结支付。

## 4. 驱动顺序

harness 用一次 `tickWorld()` 触发出牌：

```js
const traceId = 'harness-paper-topdeck-hit';
world = tickWorld(world, [
  {
    type: 'play-card',
    cardId: 'paper_shatter',
    traceId
  }
]);
```

然后构造 HUD：

```js
const root = document.querySelector('#hud-harness-root');
const hud = new Hud(root, () => {});
hud.render(buildSnapshot(world));
```

建议页面最小结构：

```html
<main id="paper-topdeck-harness">
  <div id="hud-harness-root"></div>
</main>
```

如果 HUD 样式依赖原 app 根节点尺寸，harness 页面应复用 `src/style.css`，并给 root 一个稳定 viewport 容器，例如：

```css
#paper-topdeck-harness {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
```

## 5. 事件合同断言

浏览器脚本必须先验证事件流，再验 UI：

```js
function eventIndex(world, traceId, type) {
  return world.debug.events.findIndex((event) => event.traceId === traceId && event.type === type);
}

const topdeck = world.debug.events.find((event) => event.traceId === traceId && event.type === 'PayoffTopdecked');
const handDealt = world.debug.events.find((event) => event.traceId === traceId && event.type === 'HandDealt');

assert(topdeck?.sourceCardId === 'paper_shatter');
assert(topdeck?.cardId === 'severance_burst');
assert(topdeck?.fromIndex === 1);
assert(eventIndex(world, traceId, 'PayoffTopdecked') < eventIndex(world, traceId, 'HandDealt'));
assert(handDealt?.cardIds?.[0] === 'severance_burst');
```

失败口径：

- 找不到 `PayoffTopdecked`：runtime 没有触发置顶，HUD 快照无效。
- 找不到 `HandDealt`：抽牌没有完成，HUD 快照无效。
- `PayoffTopdecked` 晚于 `HandDealt`：事件合同错误，不能用最终手牌反推“先置顶”。
- `HandDealt.cardIds[0] !== 'severance_burst'`：没有验证到顶终结路径。

## 6. HUD 文本验收

渲染后必须查询 combat feed：

```js
const feedLines = [...document.querySelectorAll('.combat-feed li')].map((node) => node.textContent.trim());
assert(feedLines.includes('整备：顶终结'));
```

不建议验完整日志顺序，因为 HUD 可能截取最近事件；但必须至少包含：

- `整备：顶终结`
- 一条 `发牌 N 张，进入出牌`，其中 `N >= 1`

如果后续 HUD 改为移动端隐藏 `.combat-feed`，桌面 viewport 仍要验 `.combat-feed li`；移动端可以额外验 `.combat-director` 或未来 toast，但不能把桌面日志验收取消。

## 7. 卡牌按钮不超框

本镜头打出 `paper_shatter` 后，手牌应至少包含 `severance_burst`。卡牌按钮检查不只看 `paper_shatter`，还要看新抽到的 payoff 是否因为授权、payoff、意图预览文本组合而超框。

建议 probe：

```js
function textClipProbe() {
  const selectors = [
    '.combat-feed li',
    '.card-button strong',
    '.card-button .card-meta',
    '.card-button .chain-preview',
    '.card-button .card-intent-preview',
    '.card-button .card-payoff',
    '.card-button .card-effect',
    '.card-button .missing-cost',
    '.card-button .authorization-cost'
  ];

  const failures = [];
  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((node, index) => {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      if (node.scrollWidth > node.clientWidth + 1) {
        failures.push(`${selector}[${index}] horizontal clip ${node.scrollWidth} > ${node.clientWidth}: ${node.textContent.trim()}`);
      }
      if (node.scrollHeight > node.clientHeight + 1) {
        failures.push(`${selector}[${index}] vertical clip ${node.scrollHeight} > ${node.clientHeight}: ${node.textContent.trim()}`);
      }
    });
  }
  return failures;
}
```

通过标准：

- `.combat-feed li` 中的 `整备：顶终结` 不被裁切。
- 每个可见 `.card-button` 的 `strong`、`.card-meta`、`.chain-preview`、`.card-intent-preview`、`.card-effect` 不裁切。
- `.card-button` 没有撑出 `.card-row`，页面没有横向滚动。
- `paper_shatter` 打出后的 payoff 按钮如果带 `授权付` 或 `缺授权`，该 token 也不能超框。

## 8. 布局不遮挡

全局 layout probe：

```js
function layoutProbe() {
  const failures = [];
  const pageWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);

  if (pageWidth > window.innerWidth + 1) {
    failures.push(`page horizontal overflow ${pageWidth} > ${window.innerWidth}`);
  }

  const pairs = [
    ['combat-feed/card-row', '.combat-feed', '.card-row'],
    ['combat-feed/debug', '.combat-feed', '.debug-panel'],
    ['combat-feed/run-layer', '.combat-feed', '.run-layer-panel'],
    ['status/card-row', '.status-strip', '.card-row']
  ];

  for (const [name, leftSelector, rightSelector] of pairs) {
    const left = document.querySelector(leftSelector);
    const right = document.querySelector(rightSelector);
    if (!left || !right) continue;
    const leftStyle = getComputedStyle(left);
    const rightStyle = getComputedStyle(right);
    if (leftStyle.display === 'none' || rightStyle.display === 'none') continue;

    const a = left.getBoundingClientRect();
    const b = right.getBoundingClientRect();
    const intersects = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    if (intersects) failures.push(`overlap ${name}`);
  }

  return failures;
}
```

至少跑两个 viewport：

```text
Desktop: 1280x720
Mobile: 390x844
```

桌面重点是 `.combat-feed li` 与 `.card-row`。移动端重点是 `.card-button` 文本与页面横向 overflow；如果 `.combat-feed` 被 CSS 隐藏，移动端不要求 feed 可见，但仍要求卡牌按钮不超框。

## 9. Playwright 验收脚本形状

后续可用 Playwright 做一次端到端快照：

```ts
test('paper_shatter topdeck HUD snapshot stays readable', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/harness/paper-topdeck.html');

  const result = await page.evaluate(async () => window.__paperTopdeckHarnessResult);
  expect(result.events.ok).toBe(true);
  expect(result.text.feedLines).toContain('整备：顶终结');
  expect(result.text.failures).toEqual([]);
  expect(result.layout.failures).toEqual([]);
});
```

如果不新增 HTML 文件，则 `page.goto('/')` 后：

```ts
await page.evaluate(async () => {
  document.body.innerHTML = '<main id="paper-topdeck-harness"><div id="hud-harness-root"></div></main>';
  // dynamic import same modules, construct world, render HUD, return probe result
});
```

这个版本适合临时 QA，不适合长期回归，因为它覆盖了生产 DOM。

## 10. 不做的事

- 不通过奖励选择拿 `paper_shatter`。
- 不依赖 `Math.random()` 或 reward pool 顺序。
- 不验证 `lantern_captain`。
- 不搜索 `discardPile`。
- 不把 `PayoffTopdecked.cardId` 的英文全名写进常驻 combat feed。
- 不为了让 probe 通过而接受 ellipsis 裁掉关键 token；`整备：顶终结` 必须完整可读。

## 11. 最小结果对象

harness 可以把结果挂到 window，方便 Playwright 或手动 console 读取：

```js
window.__paperTopdeckHarnessResult = {
  events: {
    ok: true,
    traceId,
    topdeck,
    handDealt
  },
  text: {
    feedLines,
    failures: textClipProbe()
  },
  layout: {
    failures: layoutProbe()
  }
};
```

通过标准是：

```text
events.ok === true
feedLines includes '整备：顶终结'
text.failures.length === 0
layout.failures.length === 0
```

STATUS: DONE
