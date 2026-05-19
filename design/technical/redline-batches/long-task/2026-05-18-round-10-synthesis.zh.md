# 2026-05-18 第 10 轮汇总：收敛与可交付 Demo

## 结论

第 10 轮裁决为：不再扩机制，不再改 UI，不再追加 QA 平台。当前版本可以作为“工程内可交付核心循环 demo”进入冻结验收与玩家复测，但不能宣称完整 1:1 卡牌系统已经做完。

当前已经成立的是短切片：

- 敌人意图制造本回合压力。
- 0 -> 1 -> 2 费用链制造出牌顺序与断链后果。
- 临时授权把成功接链转成 3 费终结窗口。
- Wild 修补只在真实修补成功时返当前 MP。
- 奖励牌进入下一手，能验证单局成长反馈。
- `paper_shatter` 只从 `drawPile` 置顶第一张 payoff，形成受限整备样片。
- `qa:ui` 已覆盖桌面、390 移动、360 小屏的 UI 防溢出、顶终结 HUD 和 cleanup。

当前还没有成立的是完整卡牌游戏底座：

- 统一牌区移动事件。
- 消耗、保留、状态牌的真实生命周期。
- 通用触发器和声明式效果列表。
- 卡实例、升级、删牌、遗物、路线节点、局外成长。
- 完整 reorder / tutor / discard search。

## 第 10 轮 10 个专家视角

| 专家 | 输出 | 最高结论 |
| --- | --- | --- |
| 01 最终 Demo 制作人 | `2026-05-18-round-10-01-final-demo-producer.md` | 当前可作为工程内核心循环 demo 通过，不建议第 10 轮继续改代码。 |
| 02 机制复刻审计 | `2026-05-18-round-10-02-mechanic-replication-audit.md` | 样片闭环成立，但完整 1:1 机制结构还缺牌区生命周期、触发、效果、实例等底座。 |
| 03 核心循环体验 | `2026-05-18-round-10-03-core-loop-feel-review.md` | 成功样片证据充分，失败样片和选择分叉证据仍不足，下一阶段要复测玩家是否真的在解局。 |
| 04 UI 溢出 QA | `2026-05-18-round-10-04-ui-overflow-final-qa.md` | 不因 UI 文字超框阻塞发布；三档视口 0 console error、0 横溢、0 文本溢出。 |
| 05 测试证据审计 | `2026-05-18-round-10-05-test-evidence-audit.md` | 当前有窄验收链，但最终交付需主线程 fresh rerun 并记录命令结果。 |
| 06 文档汇总编辑 | `2026-05-18-round-10-06-docs-synthesis-editor.md` | 最终应落玩家玩法说明和验收报告，且明确边界与未落地风险。 |
| 07 风险分诊 | `2026-05-18-round-10-07-risk-backlog-triage.md` | 第 10 轮必须停止扩机制，冻结完整 reorder、`lantern_captain`、discard search、局外成长。 |
| 08 Git/发布准备 | `2026-05-18-round-10-08-release-readiness-git-audit.md` | 不建议一次性提交全部 dirty worktree，后续应按文档、sim、UI、QA 脚本分批提交。 |
| 09 玩家说明 | `2026-05-18-round-10-09-player-facing-explainer.md` | 玩家读法应围绕敌意图、MP、接链、修补、授权终结、整备和奖励修正下一手。 |
| 10 总制作人 | `2026-05-18-round-10-10-producer-synthesis.md` | 该改最终文档、验收口径、风险和下一阶段路线；不该改源码、测试、卡牌或 QA 平台。 |

## 主线程最终验收

工作目录：`/Users/roc/Game-001/prototype-web`

已运行：

```bash
node --check scripts/qa-ui.mjs
npm run test:sim -- src/tests/sim/redline-paper-shatter-topdeck.test.ts
npm run test:ui
npm run check
npm run qa:ui
```

结果：

- `node --check scripts/qa-ui.mjs`：通过。
- `npm run test:sim -- src/tests/sim/redline-paper-shatter-topdeck.test.ts`：13 个 sim 测试文件通过、1 个跳过；104 passed、2 skipped。
- `npm run test:ui`：1 个 UI 测试文件通过；14 passed。
- `npm run check`：14 个测试文件通过、1 个跳过；118 passed、2 skipped；`tsc && vite build` 成功。
- 构建保留 Vite 500KB chunk warning，记录为非阻塞性能债。
- `npm run qa:ui`：`status: pass`，`finishedAt: 2026-05-18T17:19:58.657Z`。

`qa:ui` 最新证据：

- `desktop`、`mobile-390`、`mobile-360` 均存在。
- 三档视口均 `consoleErrorCount: 0`。
- 三档视口均 `horizontalOverflowDetected: false`。
- 三档视口均 `textOverflowCount: 0`。
- 三档视口均 `paperScenarioReached: true`。
- 三档视口均 `topdeckEvidenceVisible: true`。
- 三档视口均 `endTurnStillUsable: true`。
- 顶终结短 token 为 `整备：顶终结`。
- cleanup 为 `pass`：page/context/browser/server 均关闭，`pidAlive: false`，`portListening: false`。

浏览器验收后网页已关闭，没有遗留本次 QA 启动的 browser 或 dev server。

## 第 10 轮不做的事项

- 不开放完整 reorder / scry / tutor。
- 不让 `lantern_captain` 触发真实找牌。
- 不搜索 `discardPile`。
- 不做手动重排 UI。
- 不新增卡牌池、敌人池或数值重平衡。
- 不做消耗、保留、状态牌、卡实例、升级、遗物。
- 不接账号存档、永久 Max MP、永久货币或局外成长。
- 不把 `qa:ui` 升级成截图基线平台、跨浏览器矩阵或 CI 系统。

## 下一阶段最小路线

1. 冻结当前样片并做 3-5 局玩家复测。
2. 优先记录失败镜头：断链、抽牌未找解、授权就绪但无终结、有终结但缺授权。
3. 若要继续机制复刻，先补统一牌区移动、消耗、保留、状态牌生命周期，不要先堆新牌。
4. 若要继续整备方向，只能单独开 `lantern_captain` route-only 小切片，不和 payoff search 或 discard search 混在一起。
5. 后续提交应按文档、sim/runtime、卡牌规则、HUD/UI、QA 脚本拆分，不建议一次性全量提交。

