# 2026-05-18 第 10 轮专家 06：文档汇总编辑与交付说明结构

## 任务定位

本文件只提出最终中文交付文档的结构，不改代码。第 10 轮应把前 9 轮的机制、UI、验收与风险收束成玩家能读、开发能接、验收能跑的中文文档包。

建议最终落地 2 份主文档：

1. `design/technical/redline-batches/long-task/2026-05-18-final-demo-playbook.zh.md`
   - 面向玩家、制作人、后续设计专家。
   - 说明当前 demo 到底怎么玩、核心乐趣是什么、哪些机制已经可玩、哪些只是边界声明。
2. `design/technical/redline-batches/long-task/2026-05-18-final-acceptance-report.zh.md`
   - 面向工程、QA、主线程交付。
   - 汇总已落地改动、机制合同、验收命令、UI 硬约束、未落地风险和下一阶段路线。

如果只允许先落一份最终文档，优先合并为：

- `design/technical/redline-batches/long-task/2026-05-18-final-demo-delivery.zh.md`

## 编辑总原则

- 不再继续扩机制；第 10 轮的目标是收敛、校对、建立最终可交付口径。
- 所有玩法说明必须以当前已落地行为为准，不能把 deferred / future / 文案标签写成已实现功能。
- 机制合同要区分“已实现 runtime 行为”“仅数据/文案存在”“下一阶段建议”。
- UI 说明必须保留控制计划硬约束：桌面和移动端均不允许文字超框、按钮挤压、浮层遮挡核心操作区。
- 验收报告必须写清命令、工作目录、通过标准、已知 warning 和浏览器/server cleanup。

## 最终文档镜头清单

| 镜头 | 优先级 | 建议章节名 | 目的 | 必须写入的内容 | 证据来源 |
| --- | --- | --- | --- | --- | --- |
| 01 | P0 | 一句话 demo 定义 | 让读者立刻知道当前版本是什么 | “敌人意图压力 + 0>1>2 费用链 + 奖励入下一手 + 受限整备置顶”的卡牌战斗 demo | 控制计划、Round 05-09 汇总 |
| 02 | P0 | 玩家玩法说明 | 面向玩家解释怎么玩 | 读敌意图、选默认目标、用 MP 费用链接牌、用授权/修补/抽牌降低回合损失、奖励后下一手立即验证 | Round 01、03、05、06 |
| 03 | P0 | 当前核心循环 | 固化当前 demo 的最小闭环 | 出牌阶段、敌人意图、手牌决策、结束回合承压、奖励三选一、奖励进入下一手、继续战斗 | Round 01-05 |
| 04 | P0 | 机制合同总表 | 防止后续误解已实现范围 | `rewardBranches` 显式分支、`rulesText/mobileEffect/keywords/detail` 四层文案、Wild 条件返 MP、`paper_shatter` 顶 payoff | Round 02、04、06、08 |
| 05 | P0 | 已落地改动索引 | 给主线程和后续 worker 快速检索 | 按 01-09 轮列出每轮已落地内容、测试口径和是否涉及 UI | 控制计划当前进度、各轮 synthesis |
| 06 | P0 | 验收命令 | 让交付可复跑 | 在 `prototype-web/` 下运行 `npm run check`、`npm run qa:ui`；可拆分 `npm test -- --run`、`npm run build`、`npm run test:ui` | package scripts、Round 09 |
| 07 | P0 | UI 硬约束 | 保护移动端和小屏可读性 | 三档视口 `1366x768`、`390x844`、`360x640`；0 console error、0 horizontal overflow、0 text overflow；手牌 rail 允许横向滚动但不算页面横溢 | 控制计划、Round 09 QA JSON |
| 08 | P1 | 验收结果摘要 | 交付时可直接引用 | 第 9 轮 `qa-ui-result.json` 为 pass；三档均 `paperScenarioReached/topdeckEvidenceVisible/endTurnStillUsable=true`；cleanup 全通过 | `outputs/browser-qa/round-09/qa-ui-result.json` |
| 09 | P1 | 未落地风险 | 明确不要误卖 | 完整 reorder/tutor、弃牌堆搜索、`lantern_captain` 真实整备、CardInstance 升级/保留/消耗、删牌、路线节点、局外成长都未完成 | Round 03-09 |
| 10 | P1 | 设计边界与版权边界 | 避免复刻越界 | 只复刻机制结构、反馈节奏、资源压力、卡组成长和战斗决策；不复制第三方卡名、原文、美术和素材 | 控制计划 |
| 11 | P1 | 下一阶段路线 | 给后续任务排序 | 先补最终文档和验收；再做真实整备二期；再做 reward/deck 成长；最后才做局外成长和内容扩展 | Round 05-09 |
| 12 | P2 | 术语表与短 token 表 | 降低中文阅读成本 | `授权+3`、`缺MP1`、`授权付`、`整备`、`整备：顶终结`、`抽N仍-X`、`修补MPx`、`回合损N` | Round 06-09 |

## 可执行大纲：最终中文玩法说明

建议文件名：`2026-05-18-final-demo-playbook.zh.md`

### P0 章节

1. 标题与版本范围
   - 写明这是 2026-05-18 第 10 轮收敛版。
   - 写明基于 long-task 第 01-09 轮 synthesis 和第 09 轮 QA 结果。

2. 当前 demo 一句话
   - 当前 demo 是一个围绕敌人意图、费用链、奖励入手和受限整备的中文卡牌战斗切片。

3. 玩家怎么玩
   - 看敌人本回合意图和 `回合损N`。
   - 看手牌费用和链路 `0>1>2`。
   - 用开链、接链、终结、授权、修补、抽牌和整备压低损失。
   - 奖励三选一后，奖励牌进入下一手，而不是只停在牌堆里。

4. 一局的核心循环
   - 发牌。
   - 判断敌意图压力。
   - 出牌形成费用链。
   - 结算伤害、防御、抽牌、授权、修补。
   - 结束回合承受剩余意图。
   - 达到奖励阈值后选牌。
   - 奖励影响下一手。

5. 当前可玩机制
   - 默认目标对齐最高敌意图。
   - 首奖 12 XP。
   - 奖励牌可进入下一手。
   - `blood_tithe / pulse_draw` 已进入奖励池。
   - Wild 修补只有成功修补链路时才触发当前 MP 返还。
   - `paper_shatter` 可以在抽牌前从 `drawPile` 置顶第一张 payoff。

### P1 章节

6. 卡牌读法
   - 卡面只看短决策。
   - 详细规则以 `detail` / 文档为准。
   - 中文短 token 只表达即时决策，不承载全部规则。

7. 当前不会做什么
   - 不做完整牌库搜索。
   - 不搜索弃牌堆。
   - 不启用 `lantern_captain` 的真实整备。
   - 不做删牌、升级、路线节点和局外成长。

8. 给玩家的验收目标
   - 能在 3-5 回合内遇到奖励。
   - 能看懂敌意图和结束回合损失。
   - 能通过奖励牌验证下一手变化。
   - 能看到 `paper_shatter` 的 `整备：顶终结` 反馈。

## 可执行大纲：最终验收报告

建议文件名：`2026-05-18-final-acceptance-report.zh.md`

### P0 章节

1. 验收结论
   - 当前第 09 轮浏览器 UI 验收状态为 pass。
   - 第 10 轮如最终交付，应复跑 `npm run check` 和 `npm run qa:ui` 后更新结论。

2. 工作目录与命令

```bash
cd /Users/roc/Game-001/prototype-web
npm run check
npm run qa:ui
```

可拆分命令：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run
npm run build
npm run test:ui
npm run qa:ui
```

3. 机制合同验收
   - 奖励分支使用显式 `rewardBranches`。
   - 非终局奖励进入下一手。
   - Wild 返 MP 依赖 `chain-repaired`。
   - `paper_shatter` 的 `PayoffTopdecked` 必须早于 `HandDealt`。
   - 未命中整备不改牌区，抽牌照常。

4. UI 验收
   - 三档视口：`1366x768`、`390x844`、`360x640`。
   - console error 为 0。
   - 页面水平溢出为 0。
   - 未保护文字超框为 0。
   - End Turn 仍可用。
   - 浏览器、context、page、server 必须关闭。

5. 已知非阻塞项
   - `npm run build` 保留既有 Vite 500KB chunk warning。
   - 该 warning 不是第 10 轮交付阻塞项，但应记录为后续构建优化事项。

### P1 章节

6. 轮次索引
   - 01：默认目标、意图预览、移动端防溢出。
   - 02：卡牌四层文案合同。
   - 03：首奖 12 XP、奖励进入下一手。
   - 04：`rewardBranches` 显式合同。
   - 05：开放 `blood_tithe / pulse_draw`，HUD 抽牌倍率。
   - 06：Wild 修补合同与条件返 MP。
   - 07：HUD 短 token 体系。
   - 08：`paper_shatter` 极窄整备置顶样片。
   - 09：`qa:ui` 浏览器验收自动化。
   - 10：文档收敛、交付说明、最终验收报告。

7. 未落地风险登记
   - 完整 reorder/tutor 会扩大 UI、数值和状态复杂度。
   - CardInstance、升级、保留、消耗会触及更大数据迁移。
   - 局外成长可能污染 demo 判断，应继续后置。
   - 奖励池继续扩张前需要继续锁 reward pool 可见性和分支稳定性。

8. 下一阶段路线
   - P0：补最终玩法说明与验收报告，复跑验收命令。
   - P1：做 `paper_shatter` 整备二期，但仍限制在 drawPile-only 或明确的候选区。
   - P1：补奖励池、删牌、升级的最小合同，不做大规模内容膨胀。
   - P2：建立局外档案、解锁和记录层，但不得影响当前 demo 的战斗判断。

## 最终交付优先级

| 优先级 | 交付项 | 完成标准 |
| --- | --- | --- |
| P0 | 最终中文玩法说明 | 玩家能不读代码理解当前 demo 怎么玩、玩点在哪里、哪些机制已实现 |
| P0 | 最终验收报告 | 工程能按命令复跑，并能判断 pass/fail |
| P0 | 轮次索引 | 后续 worker 能从 01-09 轮快速定位证据 |
| P0 | UI 硬约束 | 小屏、移动端、浏览器 cleanup 成为明确交付门槛 |
| P1 | 未落地风险表 | 不把未完成系统包装成已交付 |
| P1 | 下一阶段路线 | 后续开发顺序从风险最低、验收最清楚的事项开始 |
| P2 | 术语表 | 提升中文阅读体验，但不能替代机制合同 |

## 建议最终口径

第 10 轮最终文档应把当前 demo 定义为“可验收的核心循环切片”，而不是完整游戏。当前最强证据是第 09 轮自动化 QA：三档视口通过、`paper_shatter` 顶终结链路可复现、End Turn 可用、浏览器和 server cleanup 完成。最终交付不要再扩机制；先把玩法说明、合同边界和验收报告写清楚，再进入下一阶段。

STATUS: DONE
