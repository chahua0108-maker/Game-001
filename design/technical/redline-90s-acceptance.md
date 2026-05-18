# Redline 90s Acceptance Contract

> Deprecated: 本合同已于 2026-05-18 被 `redline-hyperturn-acceptance.md` 替代。保留本文只用于说明上一批 `Redline 90s realtime heartbeat` 方向的失败验收标准，不再作为当前 Redline 工作的阻塞合同。

日期：2026-05-18

本文曾是 Redline 90 秒爽感切片的验收合同。当前唯一有效合同是 `redline-hyperturn-acceptance.md`；新方向不再验实时心跳、自动攻击、实时扣血或固定 60 秒 burst，而验回合内高速卡牌、费用升序链、敌人意图、断链修补和 payoff 救场。

以下内容仅作为 deprecated 历史记录。

## 核心假设

Redline 90 秒切片要验证的是：

- 实时心跳持续推进战斗。
- 自动或半自动攻击提供基础清怪动词。
- 手动卡牌用于加速节奏、修正危险、制造爆发。
- 90 秒内必须看到怪潮压力、连续击杀、一次清场或准清场救场。

## 硬验收标准

| 时间窗 | 必须成立的体验结果 | 验收证据 |
| --- | --- | --- |
| 0-3 秒 | 玩家可操作：已进入战斗心跳，能出牌、触发自动攻击，或看到明确可交互主操作。 | browser smoke、trace、sim test |
| 0-10 秒 | 出现首杀。首杀必须有 `EnemyKilled` 等价反馈，而不只是扣血。 | sim event、HUD/renderer反馈 |
| 0-30 秒 | 至少 6 次击杀反馈。击杀反馈可以来自自动攻击、卡牌、连锁、溢出或爆发。 | sim acceptance test |
| 不操作窗口 | 玩家不操作时敌人仍会推进并造成压力；压力可以是逼近、攻击、持续伤害或明确危险状态。 | sim no-input test、browser smoke |
| 60-90 秒 | 出现一次清场或准清场。准清场定义为一次爆发窗口内显著降低当前威胁，能让玩家从濒危状态恢复。 | trace/replay、sim event |

## HUD 与移动端验收

- HUD 默认不能让 15 槽 debug 表格压过主战斗。若仍保留 15 槽信息，必须默认折叠、降级到 debug 面板，或只显示当前威胁摘要。
- 桌面端主视线应优先看到走廊、敌人推进、击杀和爆发反馈。
- `390x844` 移动端主操作无遮挡：手牌、目标、爆发按钮、生命/资源状态不能互相覆盖，也不能被 debug 表格遮挡。
- Debug trace 可以存在，但默认不能成为玩家第一视觉层。

## 技术验收

完成该切片前，必须提供以下证据：

- `npm test` 通过，且包含 `prototype-web/src/tests/sim/redline-90s-acceptance.test.ts`。
- `npm run build` 通过。
- 桌面 browser smoke：能启动、进入战斗、30 秒内观察到连续击杀反馈。
- 移动 browser smoke：`390x844` 下主操作无遮挡，HUD 不遮住主战斗。
- browser smoke cleanup：如果验收或测试过程中打开网页、本地 URL、dev server 或浏览器 tab，完成后必须关闭对应网页/页面，并停止对应 dev server 或长期运行进程，避免网页残留。
- trace/replay 证据：至少一段 90 秒或压缩 replay，能复核首杀、30 秒击杀数、无操作压力、60-90 秒清场窗口。

## 当前测试草案

`prototype-web/src/tests/sim/redline-90s-acceptance.test.ts` 是合同测试草案。它只使用当前公共 sim API：`createInitialWorld()`、`tickWorld(world, intents)` 和可观察 debug events。

该测试允许在当前 runtime 下先失败。失败不是 Contract/Test Worker 要修的 runtime 问题，而是后续 Runtime Worker 的最小任务入口。

当前预期红灯：

- 30 秒内击杀反馈不足。
- 60-90 秒没有清场或准清场窗口。
- 玩家不操作时敌人不会推进，也不会造成压力。

## Worker 边界

- Contract/Test Worker：维护本文、批次记录、acceptance test 草案。
- Runtime Worker：让 sim 通过 90 秒合同，不通过改测试绕过体验指标。
- HUD Worker：让默认 HUD 和 `390x844` 移动端满足主战斗无遮挡。
- QA Worker：跑 `npm test`、`npm run build`、桌面/移动 browser smoke，并保存 trace/replay 证据。
