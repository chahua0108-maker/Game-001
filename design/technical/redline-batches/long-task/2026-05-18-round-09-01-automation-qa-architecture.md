# 2026-05-18 Round 09-01：Automation QA Architecture

角色：第 9 轮专家 01，Automation QA Architect  
工作目录：`/Users/roc/Game-001`  
边界：只新增本文档；不改源码、不提交、不回滚。  
目标：审查当前 Vite/Vitest/Playwright 可用性，设计一个可重复的 UI overflow + `paper_shatter` topdeck 浏览器验收方案，说明脚本入口、输出、失败格式、浏览器关闭纪律。

## 0. 结论

当前仓库已经具备稳定的 Vite + Vitest 机制回归层，但还没有落地 Playwright 自动化入口。

本轮建议把第 9 轮自动化验收拆成两层：

1. 保留 Vitest 作为机制合同层：继续用 `npm test` 锁 `paper_shatter` 的 `drawPile` only topdeck、事件顺序、授权支付和非触发卡边界。
2. 新增 Playwright 作为真实浏览器验收层：用固定 viewport + DOM probe + deterministic in-browser setup，自动检查 UI overflow、文本裁切、可点击中心点遮挡，以及 `paper_shatter -> PayoffTopdecked -> HandDealt` 在 HUD 中的短日志表现。

Playwright 层不应复测所有机制数值；它的职责是证明真实 DOM/CSS/媒体查询/字体渲染下，玩家能看见、点到、读懂，并且自动化脚本不会遗留浏览器进程。

## 1. 当前可用性审查

### 1.1 Vite

当前入口：

```text
prototype-web/package.json
prototype-web/vite.config.ts
prototype-web/index.html
prototype-web/src/main.ts
```

可用事实：

- `npm run dev` 会启动 Vite。
- `npm run build` 已作为现有脚本存在，构建链路是 `tsc && vite build`。
- UI 挂载点是 `#hud`，画布是 `#game-canvas`。
- HUD 大量依赖真实 CSS：`position: fixed/absolute`、`max-width: calc(...)`、移动端 media query、`overflow: hidden`、`text-overflow: ellipsis`。

判断：

- Vite 足够支撑 Playwright 的 `webServer`。
- Playwright 不应直接打开 `index.html` 文件；必须通过 Vite dev server 或 preview server，否则模块加载、资源路径和真实运行时环境不一致。

### 1.2 Vitest

当前脚本：

```json
{
  "test": "vitest run",
  "test:watch": "vitest"
}
```

当前配置：

```ts
test: {
  environment: 'node',
  include: ['src/tests/**/*.test.ts']
}
```

本轮只读执行结果：

```text
npm test
Test Files  14 passed | 1 skipped (15)
Tests       118 passed | 2 skipped (120)
```

对 `paper_shatter` 已有覆盖：

```text
prototype-web/src/tests/sim/redline-paper-shatter-topdeck.test.ts
```

该文件已经覆盖：

- `paper_shatter` 打出后先执行 `TopdeckPayoffFromDrawPile`，再 `DrawCards`。
- 命中时发出 `PayoffTopdecked`。
- 未命中时发出 `PayoffTopdeckMissed`，并照常抽牌。
- 只按 `drawPile` 当前顺序找第一张 payoff，不按强度重排。
- 不启用 `lantern_captain`。
- 排除 source card id。
- 授权支付与 payoff 结算不回归。

判断：

- 机制合同已经适合留在 Vitest。
- Vitest 当前是 `node` 环境，不适合承担 CSS overflow、真实按钮遮挡、移动端布局、浏览器关闭纪律。

### 1.3 Playwright

当前事实：

- `prototype-web/package.json` 没有 `@playwright/test`。
- 当前没有 `playwright.config.*`。
- 当前没有 `test:e2e`、`test:ui-overflow`、`test:paper-topdeck-browser` 等脚本。

判断：

- Playwright 自动化层尚未可用。
- 第 9 轮如果要落地自动化，应先新增依赖、配置、测试目录和脚本入口；本专家文档只给设计，不改源码。

## 2. 自动化分层

### 2.1 机制层：Vitest 保持现状

建议命令：

```bash
cd /Users/roc/Game-001/prototype-web
npm test
```

建议定位：

- 每次实现 `paper_shatter`、ECA、runtime、card data、snapshot 变更时必跑。
- 失败时输出保留 Vitest 原始 stdout。
- 不加入浏览器截图、DOM probe 或 CSS 断言。

### 2.2 浏览器层：Playwright 新增

建议目录：

```text
prototype-web/src/tests/e2e/
  ui-overflow.spec.ts
  paper-shatter-topdeck-browser.spec.ts
  helpers/
    layoutProbe.ts
    browserDiscipline.ts
    deterministicWorld.ts
```

如果团队更希望 e2e 与源码分离，也可以放：

```text
prototype-web/tests/e2e/
```

但本仓库现有测试都在 `src/tests/**`，为降低认知成本，首版建议放在 `src/tests/e2e/**`，并通过 Playwright 的 `testDir` 明确只收 e2e spec。

## 3. 建议脚本入口

### 3.1 package scripts

建议后续新增：

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:ui-overflow": "playwright test src/tests/e2e/ui-overflow.spec.ts",
    "test:e2e:paper-topdeck": "playwright test src/tests/e2e/paper-shatter-topdeck-browser.spec.ts",
    "test:acceptance": "npm run test && npm run test:e2e"
  }
}
```

脚本语义：

| 脚本 | 目的 | 阻断级别 |
| --- | --- | --- |
| `npm test` | 机制合同回归 | P0 |
| `npm run test:e2e:ui-overflow` | 真实浏览器 UI overflow 验收 | P0 |
| `npm run test:e2e:paper-topdeck` | `paper_shatter` topdeck HUD 浏览器验收 | P0 |
| `npm run test:e2e` | 全部浏览器验收 | P0 |
| `npm run test:acceptance` | 提交前总入口 | P0 |

### 3.2 Playwright config

建议配置重点：

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/playwright/results.json' }],
    ['html', { outputFolder: 'test-results/playwright/html', open: 'never' }]
  ],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
    { name: 'chromium-tablet-tight', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } } },
    { name: 'chromium-mobile-390', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
    { name: 'chromium-mobile-360', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 640 } } },
    { name: 'chromium-mobile-320', use: { ...devices['Pixel 5'], viewport: { width: 320, height: 568 } } }
  ]
});
```

关键取舍：

- `workers: 1`：首版优先稳定和浏览器关闭纪律，避免多个 Vite session 与全局 runtime 状态互相干扰。
- `fullyParallel: false`：UI 验收有 deterministic setup 和截图输出，首版不要并行抢 artifact。
- `reuseExistingServer: !CI`：本地开发可复用，CI 必须干净启动。
- `open: 'never'`：测试失败不能自动弹出 HTML report，避免误以为浏览器未关闭。

## 4. UI Overflow 验收方案

### 4.1 Viewport 矩阵

必须覆盖：

| Viewport | 目的 |
| --- | --- |
| `1366x768` | 默认桌面 HUD，右上 combat feed、右侧 debug/run 区和底部手牌同时存在。 |
| `1024x768` | 命中 `max-width: 980px` 附近的断点风险。 |
| `390x844` | 常见移动端竖屏，combat feed/debug 隐藏。 |
| `360x640` | 第 8 轮已明确要继续跑的窄屏验收。 |
| `320x568` | `body min-width: 320px` 的硬边界。 |

### 4.2 场景矩阵

`ui-overflow.spec.ts` 首版至少覆盖：

1. Boot：页面加载后 `#hud`、`#game-canvas` 存在，无 console error。
2. Deal：发牌面板可见，状态条不超 viewport。
3. PlayerTurn：点击发牌后，手牌、目标面板、combat director、run layer 都在 viewport 内。
4. Enemy Peek：展开前排目标槽，5 个 targetable slot 不横向撑破。
5. Reward：通过测试 hook 或 deterministic setup 进入奖励三选，`.reward-panel` 不遮挡必须操作区域，reward 文本不破框。
6. GameOver：如已有 deterministic 入口，可覆盖死亡面板居中和重启按钮可点；否则放 P1。

### 4.3 DOM probe 断言

全局断言：

```js
document.documentElement.scrollWidth <= window.innerWidth + 1
document.body.scrollWidth <= window.innerWidth + 1
```

面板 viewport 断言：

```text
#hud
.status-strip
.deal-panel
.target-panel
.combat-director
.combat-feed
.run-layer-panel
.enemy-peek
.enemy-slot-strip
.reward-panel
.game-over-panel
.card-row
```

文本裁切断言：

```text
.combat-feed header span
.combat-feed li
.combat-director strong
.combat-director em
.card-button strong
.card-button .card-meta
.card-button .chain-preview
.card-button .card-intent-preview
.card-button .card-payoff
.card-button .card-effect
.card-button .missing-cost
.card-button .authorization-cost
.reward-card strong
.reward-card small
.reward-card em
.status-chip strong
.status-chip span
```

默认规则：

```text
scrollWidth <= clientWidth + 1
scrollHeight <= clientHeight + 1
```

例外规则：

- `.reward-card em` 在移动端允许 line clamp，但必须检查 `-webkit-line-clamp` 存在且 `clientHeight` 至少能容纳两行。
- `.card-row` 如果产品明确允许横向 rail，不能把 rail 自身当成 page overflow；但当前 CSS 是 grid，不应出现页面级横向滚动。
- `.combat-feed li` 虽然有 ellipsis，但 `paper_shatter` 短日志不应依靠 ellipsis；`整备：顶终结` 和 `整备无牌` 必须完整显示。

### 4.4 点击遮挡断言

对所有可见可用按钮执行：

```js
const box = element.getBoundingClientRect();
const x = box.left + box.width / 2;
const y = box.top + box.height / 2;
const top = document.elementFromPoint(x, y);
```

通过条件：

- `top === element`
- 或 `element.contains(top)`

失败时记录：

```json
{
  "type": "click-obstructed",
  "selector": ".card-button[data-card-id=\"paper_shatter\"]",
  "viewport": "360x640",
  "rect": { "left": 10, "top": 520, "width": 102, "height": 102 },
  "topElement": ".reward-panel",
  "text": "Paper Shatter"
}
```

## 5. `paper_shatter` Topdeck 浏览器验收方案

### 5.1 浏览器验收只锁玩家可见合同

Vitest 已经锁机制：

```text
CardPlayed(paper_shatter)
-> PayoffTopdecked / PayoffTopdeckMissed
-> HandDealt
```

浏览器层只需要证明：

- 玩家能在真实 HUD 中打出 `paper_shatter`。
- 成功命中后 combat feed 显示短日志 `整备：顶终结`。
- 未命中后 combat feed 显示短日志 `整备无牌`。
- 成功/未命中日志不造成 `.combat-feed li` 或移动端替代节点超框。
- 移动端隐藏 `.combat-feed` 时，页面不能因此丢失主要操作路径或出现布局挤压。

### 5.2 Deterministic setup

首选方案：增加测试专用 bootstrap hook，只在 `import.meta.env.MODE === 'test'` 或 `window.__REDLINE_TEST__ === true` 时开放。

建议全局测试 API：

```ts
window.__REDLINE_TEST__ = {
  setWorldState(partialWorld),
  dispatch(commands),
  snapshot(),
  events(),
  close()
}
```

最小能力：

- 设置 `player.hand`。
- 设置 `player.drawPile`。
- 设置 `player.discardPile`。
- 设置 `player.energy` / `maxEnergy`。
- 设置敌人 HP，避免测试中提前结束战斗。
- 触发 `tickWorld` 或等价 UI dispatch。
- 读取最后 N 个 debug events。

备选方案：通过 UI 连续操作达到状态。

不推荐把浏览器测试写成纯随机操作，因为 `paper_shatter` topdeck 是特定牌序合同，必须 deterministic。

### 5.3 成功场景

Setup：

```text
hand: ['paper_shatter']
drawPile: ['spark_tap', 'severance_burst', 'wild_gap_key']
discardPile: []
energy: 3
```

Action：

```text
点击 paper_shatter 卡牌按钮
```

Expected debug events：

```text
CardPlayed(paper_shatter)
PayoffTopdecked(cardId: severance_burst, fromIndex: 1, toIndex: 0)
HandDealt(cardIds[0]: severance_burst)
```

Expected HUD：

```text
.combat-feed li 包含 "整备：顶终结"
.combat-feed li 不包含 "Severance Burst 置于牌顶"
.combat-feed li 不包含 "drawPile"
```

Overflow gate：

```text
allTextProbe.ok === true
allPanelProbe.ok === true
```

### 5.4 未命中场景

Setup：

```text
hand: ['paper_shatter']
drawPile: ['spark_tap', 'wild_gap_key']
discardPile: ['severance_burst']
energy: 3
```

Action：

```text
点击 paper_shatter 卡牌按钮
```

Expected debug events：

```text
CardPlayed(paper_shatter)
PayoffTopdeckMissed(searchedCount: 2)
HandDealt(cardIds[0]: spark_tap)
```

Expected HUD：

```text
.combat-feed li 包含 "整备无牌"
.combat-feed li 不包含 "discardPile"
.combat-feed li 不包含 "Severance Burst"
```

Overflow gate：

```text
allTextProbe.ok === true
allPanelProbe.ok === true
```

### 5.5 移动端专项

在 `390x844`、`360x640`、`320x568` 下：

- `.combat-feed` 预期 `display: none`，不能要求日志可见。
- 仍要执行成功/未命中 action，确保没有页面级 overflow。
- `.combat-director`、`.card-row`、`.status-strip`、`.target-panel`、`.run-layer-panel` 不能互相覆盖。
- 如果未来要把 topdeck 结果放进移动端替代节点，只允许短 token：`顶终结`、`无整备`、`照常抽`。

## 6. 输出规范

### 6.1 目录

建议所有 Playwright artifact 固定落到：

```text
prototype-web/test-results/playwright/
  results.json
  html/
  screenshots/
  traces/
  videos/
  overflow/
    latest.json
    latest.md
```

`test-results/` 应进入 `.gitignore`。如果需要沉淀一次人工验收截图，再复制精选图片到 `design/technical/screenshots/`，不要让自动输出直接污染设计目录。

### 6.2 成功输出

成功时 stdout 最少包含：

```text
UI overflow acceptance: PASS
paper_shatter topdeck browser acceptance: PASS
viewports: 1366x768, 1024x768, 390x844, 360x640, 320x568
browser discipline: all pages/contexts/browsers closed
```

`overflow/latest.json` 建议格式：

```json
{
  "ok": true,
  "generatedAt": "2026-05-18T00:00:00.000Z",
  "app": "game-001-redline-prototype",
  "scenarios": [
    {
      "name": "paper-topdeck-hit",
      "viewport": "1366x768",
      "consoleErrors": 0,
      "pageOverflow": false,
      "textFailures": [],
      "panelFailures": [],
      "clickFailures": []
    }
  ]
}
```

### 6.3 失败输出

失败格式必须机器可读、也能直接贴进 long-task 文档。

建议单个 failure：

```json
{
  "type": "text-overflow",
  "severity": "P0",
  "scenario": "paper-topdeck-hit",
  "viewport": "360x640",
  "selector": ".combat-director strong",
  "index": 2,
  "text": "Severance Burst 置于牌顶",
  "metrics": {
    "scrollWidth": 126,
    "clientWidth": 82,
    "scrollHeight": 18,
    "clientHeight": 18
  },
  "rect": {
    "left": 200,
    "top": 92,
    "width": 82,
    "height": 18
  },
  "screenshot": "test-results/playwright/screenshots/paper-topdeck-hit-360x640.png",
  "trace": "test-results/playwright/traces/paper-topdeck-hit-360x640.zip"
}
```

失败分类：

| type | 含义 | 默认严重度 |
| --- | --- | --- |
| `page-horizontal-overflow` | 页面宽度超过 viewport | P0 |
| `panel-outside-viewport` | 关键面板出屏 | P0 |
| `text-overflow` | 关键文本容器横向/纵向裁切 | P0 |
| `click-obstructed` | 可用按钮中心点被其他层遮挡 | P0 |
| `missing-event` | 浏览器场景未产生预期 debug event | P0 |
| `wrong-event-order` | `PayoffTopdecked` 没有早于 `HandDealt` | P0 |
| `forbidden-visible-copy` | HUD 出现禁止长文案，如完整英文牌名 + 置顶长句 | P1 |
| `console-error` | 页面 console error | P1，若影响操作升 P0 |
| `browser-leak` | 测试结束仍有脚本创建的 browser/context/page 未关闭 | P0 |

`latest.md` 建议摘要：

```md
# Playwright Acceptance Result

STATUS: FAILED

| Scenario | Viewport | Type | Selector | Evidence |
| --- | --- | --- | --- | --- |
| paper-topdeck-hit | 360x640 | text-overflow | .combat-director strong[2] | 126 > 82 |

Artifacts:
- results.json
- html/index.html
- traces/paper-topdeck-hit-360x640.zip
- screenshots/paper-topdeck-hit-360x640.png
```

## 7. 浏览器关闭纪律

### 7.1 原则

所有由测试脚本创建的 browser、context、page 必须由测试脚本关闭。测试不能依赖操作者手动关浏览器。

推荐纪律：

- 优先使用 Playwright test runner 的 `page` fixture，不手动 `chromium.launch()`。
- 如果必须手动 launch，必须用 `try/finally`：

```ts
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    // test body
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
```

- 禁止在测试中使用 `page.pause()`、`headed: true`、`--debug` 作为默认入口。
- HTML report 不能自动打开：`open: 'never'`。
- 本地排查需要 headed 时，只通过临时命令执行：

```bash
npx playwright test --headed --project=chromium-desktop
```

不能把 headed 写进默认配置。

### 7.2 afterEach / afterAll 检查

建议在 helper 中维护脚本手动创建的资源 registry：

```ts
const resources = {
  contexts: new Set<BrowserContext>(),
  pages: new Set<Page>()
};
```

`afterEach`：

```text
1. 收集失败 artifact。
2. 关闭测试创建的 page。
3. 关闭测试创建的 context。
4. 断言 registry 为空。
```

`afterAll`：

```text
1. 确认没有额外 browser server。
2. 确认没有遗留 context/page。
3. 写入 browser discipline summary。
```

### 7.3 失败时的关闭顺序

失败也必须关闭浏览器，但要先保留证据：

```text
capture screenshot
capture DOM probe JSON
capture trace/video by Playwright setting
close page
close context
let runner close browser
write summary
```

不要为了保留现场而让浏览器挂着。现场应由 trace、screenshot、DOM JSON 保留。

## 8. 落地顺序

建议后续 worker 按这个顺序落地：

1. 新增 `@playwright/test`、`playwright.config.ts`、`test:e2e` 脚本。
2. 先写只打开页面的 smoke spec，验证 Vite webServer、console error、浏览器自动关闭。
3. 抽出 `layoutProbe.ts`，覆盖 page overflow、panel viewport、text overflow、click obstruction。
4. 写 `ui-overflow.spec.ts`，先跑 Boot / Deal / PlayerTurn / Enemy Peek。
5. 增加 deterministic test hook，暴露最小 world setup。
6. 写 `paper-shatter-topdeck-browser.spec.ts` 的命中和未命中场景。
7. 加 `overflow/latest.json` 与 `latest.md` 输出。
8. 最后再考虑 screenshot baseline；首版不要把视觉基线作为 P0，避免样式微调造成高噪声。

## 9. 阻断标准

以下任一出现即浏览器验收失败：

- 任意 viewport 出现页面级横向 overflow。
- 关键面板出 viewport。
- 可用按钮中心点被其他可见元素遮挡。
- `paper_shatter` 命中场景没有产生 `PayoffTopdecked`。
- `paper_shatter` 未命中场景没有产生 `PayoffTopdeckMissed`。
- `PayoffTopdecked` 晚于 `HandDealt`。
- 桌面 HUD 没有显示 `整备：顶终结` 或 `整备无牌`。
- 桌面 HUD 为 topdeck 结果显示完整长句，导致文本裁切或可读性下降。
- 测试失败后没有输出 screenshot/trace/DOM JSON 中至少两类证据。
- 测试结束仍有脚本创建的 page/context/browser 未关闭。

## 10. 本轮裁决

第 9 轮自动化 QA 不需要重做机制测试设计；机制层已经有 `redline-paper-shatter-topdeck.test.ts`。真正缺口是 Playwright 自动化入口、真实 CSS overflow probe、deterministic 浏览器 setup、标准化失败输出和浏览器关闭纪律。

推荐把首个可交付目标定义为：

```text
npm run test:e2e:ui-overflow
npm run test:e2e:paper-topdeck
```

两条命令都必须：

- 自动启动 Vite。
- 自动关闭浏览器。
- 在失败时输出 `test-results/playwright/overflow/latest.json`。
- 只用短日志验收 `paper_shatter` topdeck 的玩家可见反馈。

STATUS: DONE
