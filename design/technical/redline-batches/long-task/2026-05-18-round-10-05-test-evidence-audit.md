# 2026-05-18 第 10 轮专家 05：测试/构建/验收证据审计

角色：第 10 轮专家 05，测试/构建/验收证据审计  
工作目录：`/Users/roc/Game-001`  
边界：只写本文档；不改源码、不提交、不回滚、不覆盖其他工作者修改。  
审计对象：`prototype-web/package.json`、`prototype-web/scripts/qa-ui.mjs`、`prototype-web/src/tests/**`、`outputs/browser-qa/round-09/qa-ui-result.json`、第 9 轮相关设计/汇总文档。

## 0. 总结裁决

第 9 轮形成了一条可交付的窄验收链：`Vitest 机制合同 -> build/check -> qa:ui 真实浏览器三视口 -> 结构化 JSON -> cleanup 残留检查`。这条链足够证明当前最小目标：

```text
paper_shatter -> PayoffTopdecked -> HandDealt -> HUD 可见“整备：顶终结” -> 三档视口无 console error / 页面横向溢出 / 关键文本超框 -> QA 启动的浏览器与 Vite server 被关闭
```

但它还不足以作为完整 demo 或完整移动回归的最终证据链。主要缺口是：`qa:ui` 没有保存截图或视频；没有覆盖奖励三选一往返；没有证明真实玩家通过 UI 自然拿到 `paper_shatter`；没有记录本轮主线程的全量 fresh rerun 输出；浏览器依赖仍来自外部 Playwright/gstack 路径，不是 repo 自带依赖。

因此本轮建议主线程把它判为：**第 9 轮自动化验收链基本成立，可以作为第 10 轮收敛基础；最终交付前必须再跑一次命令链，并补一份最终运行记录。**

## 1. 证据镜头

| # | 证据来源 | 覆盖内容 | 缺口 | 优先级 |
| ---: | --- | --- | --- | --- |
| 1 | `prototype-web/package.json` scripts | 已有 `dev:qa`、`check`、`test:sim`、`test:ui`、`qa:ui`；命令入口从手工 Vite 参数收敛成可复跑脚本。 | `check` 不包含 `qa:ui`，浏览器验收仍需主线程单独执行；没有 `test:browser`/`e2e` repo-owned Playwright 体系。 | P0 |
| 2 | `prototype-web/package-lock.json` 与 `package.json` dependencies | 依赖面保持轻量；未把 Playwright 写进项目依赖，符合第 9 轮“不引入 lockfile churn”的裁决。 | `qa:ui` 依赖 `/Users/roc/.codex/worktrees/9487/gstack/node_modules/playwright/index.mjs` 或环境变量，其他机器/新工作区复跑风险高。 | P1 |
| 3 | `prototype-web/scripts/qa-ui.mjs` server 启动逻辑 | 自动从 `QA_PORT` 或 5174 起找可用端口，启动 Vite，并记录 `server.url`、`owned`、`pid`、`port`、`preferredPort`。 | 复用 `QA_BASE_URL` 时不会停止外部 server；这是合理行为，但最终报告必须标明 server ownership，不能误读为脚本全量 cleanup。 | P1 |
| 4 | `prototype-web/scripts/qa-ui.mjs` viewports | 固定覆盖 `1366x768`、`390x844`、`360x640`，与第 9 轮移动矩阵的三档硬门槛一致。 | 未覆盖第 9 轮早期建议的 `320x568`、`1024x768`、横屏等扩展视口；当前只够最小验收，不够泛化移动适配结论。 | P2 |
| 5 | `prototype-web/scripts/qa-ui.mjs` DOM probe selector 与规则 | 检查 page-level horizontal overflow、核心 selector 文本 overflow、raw debug token 泄漏，并允许 `.card-row` 作为合法横向 rail、`.reward-panel` 作为合法内部滚动面板。 | 当前结果样本没有 reward panel 场景，`.reward-panel` 规则存在但未被本次 JSON 证明；overlap/hit-test 覆盖也弱于第 9 轮早期文档理想形态。 | P1 |
| 6 | `prototype-web/scripts/qa-ui.mjs` browser 内动态 import harness | 通过 Vite 动态 import `world/runtime/snapshot/Hud`，构造确定性 `paper_shatter` 顶终结 HUD 快照，不污染正式入口。 | 这是测试注入式场景，不证明玩家从自然奖励/抽牌路径到达该状态；应在文档中标为 deterministic harness，而非完整玩家流程。 | P1 |
| 7 | `prototype-web/src/tests/sim/redline-paper-shatter-topdeck.test.ts` | 机制层覆盖 `drawPile` only topdeck、事件顺序、miss、source card 排除、`lantern_captain` 不触发、授权支付与 payoff 结算。 | 这是 Node/Vitest 合同，不覆盖 CSS、移动端可见性、点击遮挡；必须和 `qa:ui` JSON 一起读。 | P0 |
| 8 | `prototype-web/src/tests/ui/hud-target-selection.test.ts` | HUD helper 层覆盖目标选择、End Turn 可用性、授权支付 token、卡牌角色短 token、意图预览、run/meta 文案边界。 | UI 单测仍是 helper 级别，不渲染真实 DOM/CSS；不能替代浏览器截图和溢出证据。 | P1 |
| 9 | `outputs/browser-qa/round-09/qa-ui-result.json` 顶层状态 | `status: pass`；`startedAt/finishedAt` 存在；`server.owned: true`；输出路径写入 `outputs/browser-qa/round-09/qa-ui-result.json`。 | JSON 是上一轮产物，不是本轮 fresh rerun；主线程最终交付前应重新跑并确认时间戳更新。 | P0 |
| 10 | `qa-ui-result.json` desktop 结果 | desktop `1366x768` 下 `consoleErrorCount: 0`、`horizontalOverflowDetected: false`、`textOverflowCount: 0`、`paperScenarioReached: true`、`topdeckEvidenceVisible: true`、`endTurnStillUsable: true`。 | desktop `acceptedCount: 3` 少于移动端，可能只是命中较少 allowlist；不是问题，但报告没有截图可供人工确认视觉密度。 | P1 |
| 11 | `qa-ui-result.json` mobile-390 结果 | `390x844` 下同样 0 console/overflow/text failure，且 `paperEvidence.hand[0] === severance_burst`，`feedText` 包含 `整备：顶终结`。 | 卡牌 row 样本中后两张卡 `x` 超出 viewport，但被识别为 rail 内元素；这符合当前规则，但仍需要截图证明手牌横向滚动体验可接受。 | P1 |
| 12 | `qa-ui-result.json` mobile-360 结果 | `360x640` 硬门槛通过：0 console/overflow/text failure，顶终结链路可见，End Turn 可用。 | 只证明 paper topdeck 快照；没有证明奖励面板、自然 End Turn 前后、真实触控误触、低端安卓性能。 | P0 |
| 13 | `qa-ui-result.json` paperEvidence | 三视口均记录 `PayoffTopdecked` tick 4、`sourceCardId: paper_shatter`、`cardId: severance_burst`、`fromIndex: 1`、`toIndex: 0`、`searchedCount: 2`，且 `topdeckIndex < handDealtIndex`。 | 事件证据强，但玩家可见证据主要是 `feedText`；移动端如果未来隐藏 `.combat-feed`，必须确保 Director/状态 token 接管。 | P0 |
| 14 | `qa-ui-result.json` cleanup | `pageClose/contextClose/browserClose/serverStop` 均 `ok: true`；`residualCheck.pidAlive: false`、`portListening: false`；`cleanup.status: pass`。 | 未记录 browser process residual 的额外独立字段；但对本脚本启动的 page/context/browser/server 已足够。 | P0 |
| 15 | `design/technical/redline-batches/long-task/2026-05-18-round-09-synthesis.zh.md` | 第 9 轮汇总把脚本、命令、结果、cleanup、下一轮交接写清楚；和 JSON 事实基本一致。 | 汇总声明 `npm run check`、`npm run qa:ui` 等已通过，但本审计未重新执行这些命令；最终交付应以 fresh rerun 为准。 | P0 |
| 16 | `design/technical/redline-batches/long-task/2026-05-18-round-09-04-mobile-regression-matrix.md` | 明确完整移动回归需要 baseline combat、chain/end turn、reward round trip、current mechanic、截图和 JSON。 | 当前 `qa:ui` 只覆盖 current mechanic 的确定性镜头，没有完成完整矩阵；不能把它包装成全移动回归通过。 | P0 |
| 17 | `design/technical/redline-batches/long-task/2026-05-18-round-09-06-browser-cleanup-audit.md` | cleanup 被定义为硬门槛；当前 JSON 已落实 page/context/browser/server close 与 PID/port 残留检查。 | 信号中断处理没有在 JSON 中被证明；若主线程担心长跑稳定性，后续再加 signal handler 证据。 | P2 |
| 18 | `design/technical/redline-batches/long-task/2026-05-18-round-09-10-producer-synthesis.md` | 制作人裁决是“窄、专用、可重复”的 paper_shatter 浏览器验收，不做 QA 平台、截图基线、CI 工程化；当前实现符合这个范围。 | 该文档要求失败时保留截图路径；当前通过场景没有截图，失败证据是否足够仍依赖未来失败输出。 | P1 |

## 2. 验收链充分性判断

### 2.1 已经充分的部分

- 机制合同充分：`redline-paper-shatter-topdeck.test.ts` 已覆盖 `paper_shatter` 的关键 runtime 边界。
- 浏览器最小验收充分：`qa:ui` 三视口都输出结构化 pass，并证明 `整备：顶终结` 在真实 HUD DOM 中可见。
- cleanup 证据充分：第 9 轮 JSON 明确证明脚本启动的 page/context/browser/server 被关闭，PID 与端口无残留。
- 命令入口充分：`package.json` 已经把主线程需要的 test/build/QA 命令整理为脚本。

### 2.2 仍不充分的部分

- 不足以证明完整移动回归：缺 baseline combat、奖励三选一、奖励返回下一轮、End Turn 前后截图。
- 不足以证明完整玩家路径：`paper_shatter` 场景由 browser harness 注入，不是从自然奖励/抽牌循环跑出来。
- 不足以证明视觉可交付：JSON 有 DOM metrics，但没有截图、视频或 trace；人工审阅无法直接看 HUD 是否“舒服”。
- 不足以证明跨环境可复跑：Playwright 未进入项目依赖，依赖本机 gstack 或 `PLAYWRIGHT_MODULE`。
- 不足以证明本轮最新状态：审计读取的是已有 JSON；最终主线程必须重新跑一遍命令链。

## 3. 最终主线程应跑的命令

在最终交付前，主线程应在一个干净终端顺序执行：

```bash
cd /Users/roc/Game-001/prototype-web
node --check scripts/qa-ui.mjs
npm run test:sim -- src/tests/sim/redline-paper-shatter-topdeck.test.ts
npm run test:ui
npm run check
npm run qa:ui
```

执行后必须检查：

```bash
cd /Users/roc/Game-001
node -e "const r=require('./outputs/browser-qa/round-09/qa-ui-result.json'); console.log(JSON.stringify({status:r.status, finishedAt:r.finishedAt, viewports:r.results.map(x=>x.viewport.name), cleanup:r.cleanup?.status}, null, 2))"
```

如果 `npm run qa:ui` 报 Playwright 不可用，再用本机外部 Playwright 路径显式运行：

```bash
cd /Users/roc/Game-001/prototype-web
PLAYWRIGHT_MODULE=/Users/roc/.codex/worktrees/9487/gstack/node_modules/playwright/index.mjs npm run qa:ui
```

通过条件：

- `node --check` 退出 0。
- `test:sim` 退出 0，且 `redline-paper-shatter-topdeck.test.ts` 没有失败。
- `test:ui` 退出 0。
- `check` 退出 0；Vite chunk warning 可记录但不阻断。
- `qa:ui` 退出 0，并刷新 `outputs/browser-qa/round-09/qa-ui-result.json`。
- JSON 中 `status === "pass"`。
- 三个 viewport 都存在：`desktop`、`mobile-390`、`mobile-360`。
- 每个 viewport 的 `consoleErrorCount === 0`、`horizontalOverflowDetected === false`、`textOverflowCount === 0`、`paperScenarioReached === true`、`topdeckEvidenceVisible === true`、`endTurnStillUsable === true`。
- `cleanup.status === "pass"`、`pidAlive === false`、`portListening === false`。

## 4. 建议主线程最终记录口径

可交付结论建议写成：

```text
第 9 轮 qa:ui 已把 paper_shatter 顶终结 HUD 样片固化为可重复浏览器验收。
它覆盖三档视口、DOM 溢出、console error、玩家可见短 token、End Turn 可用性和 cleanup。
它是窄验收链，不是完整移动回归或完整玩家路径证明。
最终交付前已重新执行 node --check / test:sim / test:ui / check / qa:ui，并以最新 JSON 时间戳为准。
```

如果主线程要宣称“完整 demo 已验收”，还需要另补：

- 三视口截图或视频：初始战斗、出牌后、奖励面板、奖励选择后下一轮、paper_shatter 结果、End Turn 前后。
- 奖励 round trip JSON：选择奖励一次、退出 reward state、下一轮能看到奖励进入 run/deck/hand。
- 可点击中心点或真实 tap 证据：尤其是移动端 End Turn、reward card、hand rail。
- 外部依赖说明：当前 `qa:ui` 使用外部 Playwright；若交给他人复跑，要提供 `PLAYWRIGHT_MODULE` 或后续 repo-owned Playwright 方案。

## 5. 状态

STATUS: DONE
