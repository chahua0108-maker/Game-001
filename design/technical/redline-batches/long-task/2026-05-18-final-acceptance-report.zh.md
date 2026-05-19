# 2026-05-18 最终验收报告：Redline 核心循环 Demo

## 验收结论

当前版本通过第 10 轮主线程最终验收，可以作为工程内核心循环 demo 冻结。它通过了机制测试、UI helper 测试、全量 check、生产构建和真实浏览器三视口 QA。

验收边界：通过的是当前短切片，不是完整 roguelike 卡牌游戏、完整 1:1 机制复刻、完整移动端产品或完整 QA 平台。

## 验收命令

工作目录：`/Users/roc/Game-001/prototype-web`

```bash
node --check scripts/qa-ui.mjs
npm run test:sim -- src/tests/sim/redline-paper-shatter-topdeck.test.ts
npm run test:ui
npm run check
npm run qa:ui
```

## 命令结果

| 命令 | 结果 |
| --- | --- |
| `node --check scripts/qa-ui.mjs` | 通过 |
| `npm run test:sim -- src/tests/sim/redline-paper-shatter-topdeck.test.ts` | 104 passed、2 skipped |
| `npm run test:ui` | 14 passed |
| `npm run check` | 118 passed、2 skipped，build 成功 |
| `npm run qa:ui` | `status: pass` |

已知非阻塞项：

- `npm run build` 仍有 Vite chunk size warning：主 JS 约 545KB，超过 500KB 提示线。
- 该 warning 不阻塞当前 P0 demo，但后续正式化时应拆分或调整构建策略。

## 浏览器 UI 验收

最新 `qa:ui` 输出文件：

`/Users/roc/Game-001/outputs/browser-qa/round-09/qa-ui-result.json`

最新结果：

- `finishedAt: 2026-05-18T17:19:58.657Z`
- `desktop 1366x768`：通过。
- `mobile-390 390x844`：通过。
- `mobile-360 360x640`：通过。
- 三档视口均无 console error。
- 三档视口均无页面水平溢出。
- 三档视口均无未保护文本溢出。
- 三档视口均到达 `paper_shatter` 顶终结场景。
- 三档视口均可见 `整备：顶终结`。
- 三档视口 End Turn 仍可用。

浏览器清理：

- page close：ok，3 个 page 已关闭。
- context close：ok，3 个 context 已关闭。
- browser close：ok。
- dev server stop：ok，本次脚本拥有的 `127.0.0.1:5174` 已停止。
- 残留检查：`pidAlive: false`、`portListening: false`。

## 机制合同验收

| 合同 | 当前状态 |
| --- | --- |
| 奖励分支 | `rewardBranches` 显式化，避免从卡牌文案或标签漂移推断。 |
| 奖励反馈 | 非终局奖励进入牌组并影响下一手。 |
| Wild 修补 | 只有 `chain-repaired` 成功时才返当前 MP。 |
| 授权支付 | 授权只用于 payoff 终结，不是永久 MP。 |
| `paper_shatter` | 抽牌前只从 `drawPile` 找第一张 payoff 置顶。 |
| miss 行为 | 未找到 payoff 时不改牌区，抽牌照常。 |
| `lantern_captain` | 当前不启用真实整备。 |
| UI 短 token | `授权+3`、`缺MP1`、`授权付`、`整备：顶终结` 已纳入验收。 |

## 发布风险

P0 阻塞：无。

P1 风险：

- 当前成功样片证据强，失败样片和选择分叉证据仍不足。
- `qa:ui` 是窄浏览器验收，不等于完整移动回归。
- Playwright 依赖来自本机可用环境或 `PLAYWRIGHT_MODULE` fallback，尚未进入 repo 自带依赖。
- 当前 git 工作树仍 dirty，且 `main` 已 ahead 2；后续提交应拆分。

P2 债务：

- 完整牌区生命周期、消耗、保留、状态牌、卡实例、升级、删牌、遗物、路线节点仍未做。
- 美术、动画、音效、正式教程和公开试玩包装未做。
- Vite chunk warning 未处理。

## 最终裁决

当前 demo 可以进入冻结和玩家复测。下一步不应继续加卡或扩整备，而应让真实玩家连续打 3-5 局，记录是否能读懂敌意图、缺 MP、授权付、Wild 修补、奖励进入下一手和 `paper_shatter` 顶终结。如果复测确认爽点成立，再从一个最小机制方向进入下一阶段。

