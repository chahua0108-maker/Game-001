# 2026-05-20 多局难度阶梯第6轮汇总：D4 污染首秀可玩切片

## 1. 本轮目标

本轮回到用户最初要求的“10 档难度体系”，但不一次性铺满 D4-D10。

本轮假设：

```text
先把 D4 做成污染首秀可玩切片，D5-D10 留在 spec backlog，能扩展多局层次而不重新制造断崖。
```

## 2. Spec 与审核

新增 spec：

- `design/framework/2026-05-20-redline-d4-d10-difficulty-ladder-spec.zh.md`

框架程序专家结论：`approve-with-changes`。

允许范围：

- `ActivityLevelId` 只扩到 D4。
- `REDLINE_ACTIVITY_LEVELS` 只新增 D4。
- `playableLevelIds` 只扩为 D1-D4。
- D5-D10 只能留在文档表格 / backlog。
- D4 胜利后无 D5，`continue-activity` 必须 no-op，不能误重开 D4。

明确未做：

- 不把 D5-D10 加入类型或运行时。
- 不改奖励系统、路线系统、XP 全局阈值。
- 不做永久进度。
- 不新增选关 UI。

提交前复核结论：`approve-with-issues`，核心实现可过；指出 D4 数值断言不完整。已补测试覆盖 D4 `playerMaxHp`、`enemyHpMultiplier`、`enemyDamageMultiplier`、初始敌人倍率和补位敌人倍率路径。

## 3. 已落地

D4 当前定义：

| 字段 | 值 |
| --- | ---: |
| `title` | 污染首秀清算 |
| `nodeCount` | 6 |
| `playerMaxHp` | 60 |
| `enemyHpMultiplier` | 0.95 |
| `enemyDamageMultiplier` | 0.9 |
| `rewardPickCount` | 3 |
| `eliteRouteEntryDamage` | 5 |
| `eliteRouteAddsPollution` | true |

活动推进：

- D3 胜利后 `continue-activity` 进入 D4。
- D4 victory settlement 没有 D5。
- D4 后直接收到 `continue-activity` 会保持当前 settlement world，不误重开 D4。

## 4. 测试

RED：

- 初始 `playableLevelIds` 缺 D4。
- D3 胜利后仍停在 D3。
- D4 elite route 实际仍是 D3 的 `-4 HP / 无污染`。

GREEN：

- `npm run test:sim -- redline-activity-difficulty.test.ts` 通过。
- 结果：`33 passed / 1 skipped` 文件，`185 passed / 2 skipped` 测试。
- `npm run test:ui -- hud-target-selection.test.ts` 通过，`32 passed`。

完整门禁：

- `npm run check` 通过，`217 passed / 2 skipped`，build 通过；仅保留既有 Vite chunk size warning。
- `QA_ROUND=d4-pollution-first-look QA_PORT=5186 npm run qa:ui` 通过，`gateScore 20/20`，三档 viewport 无 console error、无横向溢出、无文字溢出。
- 浏览器与服务清理通过：`pidAlive=false`，`portListening=false`。

## 5. 新阶段评分

QA、文档和专家数量不计入核心体验分。D4 作为可玩污染首秀扩展了多局层次，因此本轮可以加分。

| 维度 | 权重 | 第5轮后 | 第6轮后 | 依据 |
| --- | ---: | ---: | ---: | --- |
| 多局活动结构 | 20 | 12 | 15 | 可玩链路从 D1-D3 扩为 D1-D4，且终点安全。 |
| 新手通关曲线 | 20 | 17 | 17 | D1-D3 first-clear 未回退；D4 first-clear 留作下一轮。 |
| 难度分层清晰度 | 20 | 17 | 18 | D4 成为污染首秀，而不是继续堆纯伤害。 |
| 原单局核心保留 | 20 | 20 | 20 | 战斗、奖励、路线、污染语义未重写。 |
| UI 可读性 | 10 | 10 | 10 | D4 沿用已有风险/cost/致死保护 HUD。 |
| 版权与边界安全 | 10 | 10 | 10 | 无新增版权风险。 |
| **总分** | **100** | **86** | **90** | 达到当前长循环的可停止线，但 D4 first-clear 和 D5-D10 仍是后续。 |

## 6. 停止判断

本轮后多局核心体验分达到 `90 / 100`。按当前 air-loop 纪律，达到停止线后不继续自动扩张 D5-D10。

下一步只应进入以下之一：

- D4 first-clear 实测 / 回归。
- D5-D10 spec 复审后再开新目标。
- 真实玩家测试。
- 文档交接或归档。
