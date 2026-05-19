# 2026-05-18 Round 09 汇总：浏览器 UI 验收自动化

## 本轮目标

第 9 轮不再扩展卡牌机制，而是把第 7-8 轮反复手跑的浏览器验收固化为可重复命令。目标是保护两个核心风险：

- UI 文案不能超框，尤其是小屏、授权支付、整备日志和手牌横向 rail。
- `paper_shatter -> PayoffTopdecked -> HandDealt -> 整备：顶终结` 的关键链路必须能在真实浏览器 HUD 中复现。

## 10 个专家视角

| 序号 | 文件 | 关键结论 |
| --- | --- | --- |
| 01 | `2026-05-18-round-09-01-automation-qa-architecture.md` | 保留 Vitest 做机制合同，新增窄浏览器脚本做真实 DOM/CSS 验收。 |
| 02 | `2026-05-18-round-09-02-dom-overflow-probe.md` | DOM probe 需要区分真实超框、ellipsis、手牌 rail、reward panel 内部滚动。 |
| 03 | `2026-05-18-round-09-03-paper-topdeck-harness.md` | 用 Vite 动态 import 构造确定性 `paper_shatter` 顶终结 HUD 快照。 |
| 04 | `2026-05-18-round-09-04-mobile-regression-matrix.md` | 固定 `1366x768`、`390x844`、`360x640` 三档验收矩阵。 |
| 05 | `2026-05-18-round-09-05-npm-script-integration.md` | 不引入 Playwright 依赖，先用外部 gstack Playwright；新增轻量 npm 脚本即可。 |
| 06 | `2026-05-18-round-09-06-browser-cleanup-audit.md` | 浏览器关闭和 server 停止必须成为验收硬门槛。 |
| 07 | `2026-05-18-round-09-07-ci-free-local-qa.md` | 本地无 CI 命令序列：test、build、dev server、browser QA。 |
| 08 | `2026-05-18-round-09-08-implementation-slice.md` | 实现切片限定为一个脚本、少量 package script、JSON 输出。 |
| 09 | `2026-05-18-round-09-09-ux-acceptance-criteria.md` | UX 验收重点是核心压迫读数、短 token、授权/整备反馈、移动端手牌 rail。 |
| 10 | `2026-05-18-round-09-10-producer-synthesis.md` | 制作人裁决：做窄验收脚本，不做 QA 平台和截图基线系统。 |

## 已落地内容

- 新增 `prototype-web/scripts/qa-ui.mjs`。
- 新增 npm scripts：
  - `dev:qa`
  - `check`
  - `test:sim`
  - `test:ui`
  - `qa:ui`
- `qa:ui` 会：
  - 自动选择 `5174` 起始的可用端口并启动 Vite。
  - 使用外部 gstack Playwright，不改 `package-lock.json`。
  - 覆盖 `1366x768`、`390x844`、`360x640`。
  - 检查 console error、页面水平溢出、关键文本超框。
  - 在浏览器内动态 import sim/runtime/snapshot/HUD，构造 `paper_shatter` 顶终结确定性场景。
  - 验证 `PayoffTopdecked` 早于 `HandDealt`，并且 HUD 可见 `整备：顶终结`。
  - 验证 End Turn 仍可用。
  - 在 `finally` 关闭 page、context、browser 和脚本启动的 Vite server。
  - 输出 JSON 到 `outputs/browser-qa/round-09/qa-ui-result.json`。

## 验收结果

- `node --check scripts/qa-ui.mjs`：通过。
- `npm run test:sim -- src/tests/sim/redline-paper-shatter-topdeck.test.ts`：13 个 sim 文件通过，104 passed、2 skipped。
- `npm run test:ui`：14 passed。
- `npm run qa:ui`：通过。
  - `desktop 1366x768`：0 console error，0 horizontal overflow，0 text overflow。
  - `mobile-390 390x844`：0 console error，0 horizontal overflow，0 text overflow。
  - `mobile-360 360x640`：0 console error，0 horizontal overflow，0 text overflow。
  - 三档均 `paperScenarioReached: true`、`topdeckEvidenceVisible: true`、`endTurnStillUsable: true`。
  - cleanup：page/context/browser/server 全部关闭，PID 不存活，5174 端口无监听。
- `npm run check`：通过；118 passed、2 skipped；build 通过，保留 Vite 500KB chunk warning。

## 第 10 轮交接

第 10 轮应进入收敛，而不是继续扩机制：

- 读取 `qa-ui-result.json` 和前 9 轮 synthesis。
- 修正文档中仍然过时的验收口径。
- 生成最终中文 demo 说明、机制边界和可交付验收报告。
- 可选做一次最终 `npm run check && npm run qa:ui`。

STATUS: DONE
