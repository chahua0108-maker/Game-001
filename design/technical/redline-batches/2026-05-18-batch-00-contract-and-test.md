# 2026-05-18 Batch 00/01 - Contract and Test

> Deprecated: 这是被用户否决的 `Redline 90s realtime heartbeat` 方向批次记录。当前有效方向是 `redline-hyperturn-acceptance.md`；本文只保留为失败路径证据，不再作为 runtime、HUD、QA 的执行依据。

角色：Contract/Test Worker

写入范围：

- `design/technical/redline-90s-acceptance.md`
- `design/technical/redline-batches/2026-05-18-batch-00-contract-and-test.md`
- `prototype-web/src/tests/sim/redline-90s-acceptance.test.ts`

## 输入

- 用户裁决：不同意冻结底盘；不要把 `5x3`、回合制、当前卡牌循环写成不可改。
- 冻结目标：Redline 90 秒爽感切片。
- 核心假设：实时心跳 + 自动/半自动攻击 + 手动卡牌加速，能在 90 秒内产生怪潮压力、连续击杀、一次救场爆发。
- 现有 sim 公共 API：`createInitialWorld()`、`tickWorld(world, intents)`。

## 输出

- 新增唯一验收合同：`design/technical/redline-90s-acceptance.md`。
- 新增批次记录：`design/technical/redline-batches/2026-05-18-batch-00-contract-and-test.md`。
- 新增 sim 层合同测试：`prototype-web/src/tests/sim/redline-90s-acceptance.test.ts`。

## 验收标准

体验硬标准：

- 3 秒内可操作。
- 10 秒内首杀。
- 30 秒内至少 6 次击杀反馈。
- 不操作时敌人能推进并造成压力。
- 60-90 秒内出现一次清场或准清场。
- HUD 默认不能让 15 槽 debug 表格压过主战斗。
- `390x844` 移动端主操作无遮挡。

技术硬标准：

- `npm test`。
- `npm run build`。
- 桌面 browser smoke。
- 移动 browser smoke。
- trace/replay 证据。

## 已知当前缺口

本批次只落合同与测试，不修改 runtime。当前 `redline-90s-acceptance.test.ts` 失败属于预期红灯。

已跑命令：

```bash
npm test -- src/tests/sim/redline-90s-acceptance.test.ts
npm test
npm run build
```

结果：

- `npm test -- src/tests/sim/redline-90s-acceptance.test.ts`：失败，2 个 acceptance 测试红灯。
- `npm test`：失败，6 个 test files 中 5 个通过；46 个测试中 44 个通过，只有新增 acceptance 文件的 2 个测试失败。
- `npm run build`：通过。Vite 输出 chunk size warning，非本批次阻断项。

失败暴露的缺口：

- 30 秒内只有 2 次击杀反馈，未达到至少 6 次。
- 60-90 秒内没有 `ClearBurstRequested`，没有清场或准清场窗口，最低当前威胁仍为 15。
- 15 秒不操作窗口内，最近敌人没有向玩家推进，玩家没有受到伤害。

## 后续 Worker 接口

Runtime Worker 最小任务：

- 让 `advance-time` 成为真实战斗心跳，而不是只更新时间和开局发牌。
- 增加自动或半自动攻击事件，并让它能在 10 秒内制造首杀、30 秒内累计至少 6 次击杀反馈。
- 增加敌人随时间推进与不操作压力，至少能在 no-input acceptance test 中体现逼近和伤害/危险。
- 增加 60-90 秒可复核的清场或准清场窗口，并写入 trace/replay 事件。
- 不要通过降低测试标准、硬编码测试 trace、或继续依赖回合结束按钮来绕过合同。

HUD Worker 最小任务：

- 默认隐藏或折叠 15 槽 debug 表格，主战斗层优先。
- 验证 `390x844` 下手牌、目标、生命/资源、爆发入口无遮挡。

QA Worker 最小任务：

- 在 Runtime/HUD Worker 完成后跑 `npm test`、`npm run build`。
- 跑桌面和 `390x844` 移动 browser smoke。
- 保存能复核 90 秒合同的 trace/replay 证据。

## Patch Manifest

| 文件 | 绑定体验假设 |
| --- | --- |
| `design/technical/redline-90s-acceptance.md` | 冻结 Redline 90 秒爽感目标，而不是冻结当前底盘。 |
| `design/technical/redline-batches/2026-05-18-batch-00-contract-and-test.md` | 将 Batch 00/01 的输入、输出、红灯、worker 接口持久化，避免后续 worker 改错职责范围。 |
| `prototype-web/src/tests/sim/redline-90s-acceptance.test.ts` | 用 sim 合同测试表达 3 秒可操作、10 秒首杀、30 秒击杀、不操作压力、60-90 秒救场爆发。 |
