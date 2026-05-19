# 2026-05-18 Round 09-08：可重复浏览器 QA 脚本最小实现切片

角色：第 9 轮专家 08，Implementation Slice Engineer  
工作目录：`/Users/roc/Game-001`  
边界：本文只新增实现切片文档，不改源码、不提交 git、不回滚他人改动。

## 0. 目标裁决

本切片只为主线程提供一个最小、可重复、可在本地和后续 CI 中复跑的浏览器 QA 入口。

一句话目标：给 `prototype-web` 增加 Playwright 浏览器 smoke/layout 脚本，用真实 Chromium 验证 HUD 可见、关键按钮可点、无横向溢出、桌面和移动视口下不会被浮层遮挡。

本切片不追求完整视觉回归，不做截图基线管理，不改 gameplay 规则，不修 CSS 问题。第一版允许测试先暴露现有移动端 `Restart` 被 `.deal-panel` 覆盖的问题；是否修 CSS 应交给后续 HUD responsive worker。

## 1. 当前事实

- `prototype-web/package.json` 当前只有 `dev`、`build`、`test`、`test:watch`。
- `prototype-web/vite.config.ts` 的 Vitest 环境是 `node`，只覆盖 `src/tests/**/*.test.ts`。
- 当前没有 `@playwright/test`、`playwright.config.ts`、`test:e2e` 或浏览器 QA 脚本。
- 现有浏览器 QA 证据主要落在 `outputs/browser-qa/**`，该类原始证据适合本地保留，但不应作为唯一可复跑入口。
- `design/technical/role-input-browser-qa.md` 已记录真实浏览器问题：390x844 下 `Restart` 中心点会命中 `.deal-panel`，说明必须有 DOM/CSS 层验收。

## 2. 最小切片范围

第一版只做两个 Playwright spec：

1. `hud-layout.spec.ts`
   - 启动页面。
   - 覆盖桌面 `1366x768`、移动 `390x844`，可选加 `360x640`。
   - 断言页面非空、HUD 存在、关键面板在 viewport 内、没有横向滚动。
   - 断言关键按钮中心点没有被非预期元素遮挡。

2. `hud-interaction.spec.ts`
   - 用真实点击跑最短交互链：进入页面、确认玩家回合、点击一张可用手牌、点击结束回合或键盘 `E`。
   - 目标只验证 DOM 事件、按钮状态、HUD 重绘和 runtime intent 能串起来。
   - 不在 e2e 里复测具体伤害、抽牌、奖励分支数值；这些继续留给 Vitest。

## 3. 必须触碰文件

### 3.1 `prototype-web/package.json`

新增 dev dependency：

```json
"@playwright/test": "^1.x"
```

新增脚本：

```json
"test:e2e": "playwright test",
"test:e2e:headed": "playwright test --headed",
"test:all": "npm run test && npm run test:e2e"
```

说明：

- 不替换现有 `test`。
- 不把 `npm run build` 塞进 `test:all` 第一版，避免把浏览器 QA 切片扩大成发布门禁。

### 3.2 `prototype-web/package-lock.json`

由 `npm install -D @playwright/test` 自动更新。

说明：

- 不手写 lockfile。
- 如果主线程不希望立刻安装浏览器二进制，先只安装包；运行前再执行 `npx playwright install chromium`。

### 3.3 `prototype-web/playwright.config.ts`

新增最小配置：

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } }
  ]
});
```

前置要求：`package.json` 需要补 `"preview": "vite preview"`，否则 `webServer.command` 无法运行。若不想新增 `preview` 脚本，则命令改为 `npx vite preview --host 127.0.0.1 --port 4173`。

### 3.4 `prototype-web/src/tests/e2e/hud-layout.spec.ts`

最小断言建议：

- `await page.goto('/')`
- `#hud` 可见。
- `body` / `documentElement` 不产生横向滚动：`scrollWidth <= innerWidth + 1`。
- 检查 `.status-strip`、`.deal-panel`、`.card-row` 在 viewport 内。
- 对 `button:visible` 做中心点命中检查：
  - 取 `boundingBox()`。
  - 用 `document.elementFromPoint(centerX, centerY)`。
  - 命中自身或自身子元素才算通过。
- 对移动端 `Restart` 可先写成已知失败保护，二选一：
  - 严格断言并让测试红灯，推动后续 CSS 修复。
  - `test.fixme(project.name === 'chromium-mobile', 'Restart is currently covered by .deal-panel on 390x844')`，先让脚本可并入。

推荐主线程选择严格断言。如果目标是新增可重复 QA，红灯比静默跳过更有价值。

### 3.5 `prototype-web/src/tests/e2e/hud-interaction.spec.ts`

最小交互建议：

- 打开 `/`。
- 等待 `#hud`。
- 找到第一个 enabled card button，真实 `click()`。
- 断言手牌按钮数量或 HUD 文本发生变化。
- 点击 `结束回合` 或按 `E`。
- 断言页面仍可交互，没有 console error。

需要监听：

```ts
const errors: string[] = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (error) => errors.push(error.message));
```

测试结束断言 `errors` 为空。若 Three/WebGL 在 headless 环境有已知噪音，必须按具体消息白名单过滤，不能笼统忽略所有 error。

## 4. 不许触碰文件

本切片不许触碰：

- `prototype-web/src/sim/**`
- `prototype-web/src/eca/**`
- `prototype-web/src/data/**`
- `prototype-web/src/ui/**`
- `prototype-web/src/presentation/**`
- `prototype-web/src/style.css`
- `prototype-web/index.html`
- `prototype-web/vite.config.ts`
- `prototype-web/tsconfig*.json`
- `design/technical/redline-batches/long-task/*.md` 中除本文件外的其他专家文档
- `outputs/browser-qa/**`

尤其不要在本切片里顺手修 `Restart` 移动端遮挡。浏览器 QA 脚本的价值是先稳定复现问题；修复应另开 HUD/CSS 切片。

## 5. 推荐 patch 顺序

1. 在 `prototype-web/package.json` 增加 `preview`、`test:e2e`、`test:e2e:headed`、`test:all`。
2. 执行 `npm install -D @playwright/test`，只接受 `package-lock.json` 的依赖更新。
3. 新增 `prototype-web/playwright.config.ts`，先只配置 Chromium desktop/mobile。
4. 新增 `prototype-web/src/tests/e2e/hud-layout.spec.ts`，先跑到能复现当前布局事实。
5. 新增 `prototype-web/src/tests/e2e/hud-interaction.spec.ts`，只覆盖一条最短真实点击路径。
6. 若 Playwright 报浏览器未安装，再执行 `npx playwright install chromium`；不要把所有浏览器一次性装入本切片。
7. 如果测试红在移动 `Restart` 遮挡，记录为预期发现，不在本切片修 CSS。

## 6. 验证顺序

在 `/Users/roc/Game-001/prototype-web` 下执行：

```bash
npm run test
```

目的：确认新增 e2e 依赖没有破坏现有 Vitest。

```bash
npm run build
```

目的：确认 TypeScript、Vite build 和新增 Playwright config 不冲突。

```bash
npm run test:e2e -- --project=chromium-desktop
```

目的：先确认桌面路径稳定，避免移动已知问题干扰首个脚本落地。

```bash
npm run test:e2e -- --project=chromium-mobile
```

目的：复现移动视口问题；若红灯，错误信息必须能指出被遮挡元素和目标按钮。

```bash
npm run test:e2e
```

目的：确认完整浏览器 QA 入口可复跑。

最后可选：

```bash
npm run test:all
```

目的：给主线程一个单命令组合验收入口。

## 7. 通过标准

- `npm run test` 仍通过，或只失败于进入本切片前已存在且已记录的测试红灯。
- `npm run build` 通过。
- `npm run test:e2e -- --project=chromium-desktop` 通过。
- `npm run test:e2e -- --project=chromium-mobile` 至少能稳定运行并产出可定位错误；若移动端因 `Restart` 遮挡失败，失败消息必须包含目标按钮、命中元素、viewport。
- Playwright HTML report、trace、失败截图只作为本地 artifact，不纳入源码提交，除非主线程另行要求。

## 8. 风险和护栏

| 风险 | 表现 | 护栏 |
| --- | --- | --- |
| e2e 测试变成机制测试 | 断言具体伤害、抽牌、奖励随机结果 | e2e 只测 DOM 可见、可点、无 console error；机制留给 Vitest |
| 依赖安装扩大范围 | 一次安装 Chromium/Firefox/WebKit 或改 CI | 第一版只跑 Chromium，CI 后续再接 |
| 测试为了通过而跳过移动问题 | `test.skip` 掩盖 `Restart` 遮挡 | 首选严格红灯；若必须合入，使用 `fixme` 并写明原因 |
| 顺手修 UI | 同一 patch 同时改 CSS/HUD | 本切片只新增 QA 能力，修复另开切片 |
| 端口冲突 | 本地已有 4173 服务 | Playwright `reuseExistingServer` 只在非 CI 启用；冲突时手动停旧服务再跑 |

## 9. 交付给主线程的最小 commit 范围

建议一个 commit 只包含：

- `prototype-web/package.json`
- `prototype-web/package-lock.json`
- `prototype-web/playwright.config.ts`
- `prototype-web/src/tests/e2e/hud-layout.spec.ts`
- `prototype-web/src/tests/e2e/hud-interaction.spec.ts`

不包含：

- CSS/HUD 修复。
- 原始截图目录。
- Playwright report 目录。
- 设计文档追加，除非主线程要求把本切片随提交带上。

STATUS: DONE
