# 2026-05-20 多局难度阶梯第3轮汇总：D3 First-Clear 断崖修正

## 1. 本轮目标

本轮继续 `air-loop` 长循环，不在上一轮提交后停止。

本轮假设：

```text
D1 / D2 已能自然通关后，下一块核心体验风险是 D3 从初级入口跳到中级入口时形成断崖。
```

目标是让保守玩家能自然 first-clear D3，同时 D3 仍明显比 D2 更紧。

## 2. 流程修正

本轮同时修正了流程问题：

- 发现上一轮错误：主线程把“每轮提交”误当成停点。
- 已派 AIRoc skill worker 修改 `core-experience-loop`，明确本地提交只是循环内部门禁，不是停止条件。
- `coreScore < targetScore` 且用户未暂停时，提交后必须立即开下一轮。

## 3. Spec 与审核

新增 spec：

- `design/framework/2026-05-20-redline-d3-first-clear-tuning-spec.zh.md`

框架程序专家两轮审核：

- 第一轮：`approve-with-changes`，只允许改 D3 的 `enemyDamageMultiplier`、`eliteRouteEntryDamage`、`eliteRouteAddsPollution`。
- RED 验证后发现第一版仍不能自然通关 D3。
- 第二轮：`approve-with-changes`，允许额外只改一个杠杆：`enemyHpMultiplier: 1.0 -> 0.88`。

明确未做：

- 不改 `nodeCount`，D3 仍为 6 节点。
- 不改 `rewardPickCount`，D3 仍为 3 奖励候选。
- 不扩 D4-D10。
- 不改活动 / run / 战斗 / 发牌 API。
- 不做永久进度。

## 4. 已落地

D3 当前数值：

| 字段 | 旧值 | 新值 |
| --- | ---: | ---: |
| `nodeCount` | 6 | 6 |
| `playerMaxHp` | 60 | 60 |
| `enemyHpMultiplier` | 1.0 | 0.88 |
| `enemyDamageMultiplier` | 1.0 | 0.85 |
| `rewardPickCount` | 3 | 3 |
| `eliteRouteEntryDamage` | 6 | 4 |
| `eliteRouteAddsPollution` | true | false |

测试新增：

- D3 elite route 不再是旧 `-6 HP / 污染` 断崖，而是 `-4 HP / 无污染`。
- D1 -> D2 -> D3 自然通关回归：保守玩家完整打通 D3。
- D3 测试断言仍为 6 节点、3 奖励候选、D3 通关 HP 大于 12 且低于 D2 通关 HP。

## 5. 验收结果

RED：

- 第一版前，D3 自然通关失败：`expected 'failure' to be 'victory'`。
- 新增 D3 elite route 测试先失败于仍显示 `-6 HP / 污染`。

GREEN：

- 聚焦 sim：`npm run test:sim -- redline-activity-difficulty.test.ts` 通过。
- 结果：`33 passed / 1 skipped` 文件，`182 passed / 2 skipped` 测试。

完整门禁在提交前另行运行。

## 6. 新阶段评分

QA、文档和专家数量不计入核心体验分。D3 玩家面对的 first-clear 曲线真实改善，因此本轮可以加分。

| 维度 | 权重 | 第2轮后 | 第3轮后 | 依据 |
| --- | ---: | ---: | ---: | --- |
| 多局活动结构 | 20 | 12 | 12 | 活动结构未扩。 |
| 新手通关曲线 | 20 | 14 | 16 | D1/D2 保持可通，D3 first-clear 也可自然完成。 |
| 难度分层清晰度 | 20 | 12 | 15 | D3 不再断崖，同时保留 6 节点和 3 选，仍区别于 D2。 |
| 原单局核心保留 | 20 | 20 | 20 | 战斗、奖励、路线、build plan 未回退。 |
| UI 可读性 | 10 | 7 | 7 | 本轮未改 UI，路线误选提示仍是风险。 |
| 版权与边界安全 | 10 | 10 | 10 | 无新增版权风险。 |
| **总分** | **100** | **75** | **80** | D3 first-clear 站住，但路线可读性和 D4-D10 仍未完成。 |

## 7. 下一轮建议

下一轮不应继续调 D3 基础数值，优先做路线可读性 / 误选保护：

- D1 / D2 的 repair-cache 应明确是安全推荐路，不要让玩家误以为它是即时回血。
- elite-pressure 应显示更强风险提示，尤其低血时要防误选。
- 顶部“下一战后果”不能只默认展示第一个路线候选。

若要批量新增路线节点或路线图结构，必须先写新的路线 spec 并做框架专家审核。
