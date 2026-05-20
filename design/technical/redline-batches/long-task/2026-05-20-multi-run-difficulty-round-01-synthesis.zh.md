# 2026-05-20 多局难度阶梯第1轮汇总：D1-D3 活动框架

## 1. 本轮目标

本轮不是继续第 18 轮后的单局堆系统，而是开启新阶段：把 Redline 从单局核心体验扩成“第一套闯关活动”的多局核心体验。

核心假设：

```text
先落 D1-D3，就能让玩家看到新手可通关 -> 初级轻压力 -> 中级入口的难度阶梯。
```

旧阶段单局核心体验仍记为 `95 / 100`。新阶段多局难度基线为 `42 / 100`，本轮目标约 `75 / 100`。

## 2. 审核流程

- 先写 spec：`design/framework/2026-05-20-redline-multi-run-difficulty-framework-spec.zh.md`。
- 框架程序专家初审结论：`approve-with-changes`，要求拆分 `restart-run` 与继续下一关、补敌人倍率全路径、明确活动层非永久边界、HUD 显示路线代价。
- spec 合入修改后，框架程序专家复核结论：`approve`，Implementation Go。
- 实现按 TDD 进行：先写失败测试，再补最小实现。

## 3. 已落地

- 新增 `ActivityState` / `ActivityLevelDefinition`，活动名为“红线清算局 第一套闯关”。
- D1-D3 数据驱动：
  - D1：3 节点，HP 72，敌人 HP x0.8，敌人伤害 x0.45，奖励候选 4，高压路线 `-2 HP / 无污染`。
  - D2：3 节点，HP 66，敌人 HP x0.9，敌人伤害 x0.7，奖励候选 4，高压路线 `-3 HP / 无污染`。
  - D3：6 节点，HP 60，回到当前高压单局入口版，高压路线 `-6 HP / 污染`。
- Web 默认入口改为活动模式，首屏显示 D1。
- 活动动作拆分：
  - `restart-current-level`：失败或主动重试当前难度。
  - `continue-activity`：胜利结算后进入下一 playable 难度。
  - `restart-run` 保留为旧兼容别名，不作为活动 HUD 主动作。
- 初始敌人和补位敌人都走同一活动倍率函数，取整规则为 `Math.max(1, Math.round(base * multiplier))`。
- HUD 显示活动难度、结算按钮和路线代价，不再把胜利后的继续动作写成 Restart。

## 4. 验收结果

- RED 测试先失败于缺少 `sim/activity`，确认测试覆盖新框架缺口。
- 聚焦 sim：`npm run test:sim -- redline-activity-difficulty.test.ts` 通过，实际覆盖全部 sim 文件：`178 passed / 2 skipped`。
- 聚焦 UI：`npm run test:ui -- hud-target-selection.test.ts` 通过，`28 passed`。
- 完整门禁：`npm run check` 通过，`206 passed / 2 skipped`，build 通过；仅保留 Vite chunk size warning。
- 浏览器 QA：`QA_ROUND=multi-run-difficulty-d1 QA_PORT=5179 npm run qa:ui` 通过，`gateScore 20 / 20`，三视口无 console error、无横向溢出、无文本溢出，清理 `pidAlive=false`、`portListening=false`。
- 本地临时页面验收：5182 临时服务显示 `D1 试营业清算 / 节点 1/3 / 牌组4 · 仅本run`，无控制台错误；服务已关闭。

## 5. 新阶段评分

QA 只作门禁，不计入核心体验分。

| 维度 | 权重 | 本轮前 | 本轮后 | 依据 |
| --- | ---: | ---: | ---: | --- |
| 多局活动结构 | 20 | 0 | 12 | 已有活动状态、D1-D3、胜利继续和失败重试。 |
| 新手通关曲线 | 20 | 4 | 14 | D1 改成 3 节点、72 HP、低敌伤、4 奖励候选，高压路线无污染。 |
| 难度分层清晰度 | 20 | 4 | 12 | D1/D2/D3 的节点数、敌人倍率、路线代价和奖励宽度已分层。 |
| 原单局核心保留 | 20 | 20 | 20 | 战斗、奖励、路线、build plan、污染压力测试未回退。 |
| UI 可读性 | 10 | 4 | 7 | HUD 显示 D1 和路线代价，结算动作拆分；仍可继续打磨玩家复盘语言。 |
| 版权与边界安全 | 10 | 10 | 10 | 只对齐机制结构，不复制竞品表达。 |
| **总分** | **100** | **42** | **75** | 达成本轮目标。 |

## 6. 后续建议

下一轮不要急着铺 D4-D10。优先做真实玩家复测：

- D1 是否能让玩家第一次完整通关。
- D2 是否比 D1 明显有压力，但不突然劝退。
- D3 的 6 节点是否过陡，如果过陡，再把 D3 调成 4-5 节点过渡。
- 结算后的“进入 D2 / 重试 D1”是否足够清楚。
