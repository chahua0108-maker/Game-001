# Batch H1 Contract/Test Patch Manifest

日期：2026-05-18

角色：Contract & Acceptance Test Producer

## 目标

把 Redline 验收合同从失败的 `90s realtime heartbeat` 切到 `Hyper-Turn Card Pressure Slice`。

## 修改范围

- 新增 `design/technical/redline-hyperturn-acceptance.md`。
- 标记 `design/technical/redline-90s-acceptance.md` 为 deprecated。
- 新增 `prototype-web/src/tests/sim/redline-hyperturn-acceptance.test.ts`。
- 降级 `prototype-web/src/tests/sim/redline-90s-acceptance.test.ts` 为 skipped/deprecated。

## 新合同断言

- 第一手牌/脚本必须能打出 `0 -> 1 -> 2` 或 `0 -> 1 -> payoff`。
- 正确顺序的收益必须明显高于乱序。
- 结束回合前必须能读到敌人意图或等价的可观察后果。
- 断链必须降低收益，但不能完全禁止出牌。
- Wild/draw/mana/reorder 至少能修补一次断链。
- 3-5 回合内必须出现一次 payoff 清前排/救场。

## Deprecated 内容

旧 90 秒合同和测试不再作为阻塞项，不再要求：

- 自动攻击 trace。
- 敌人实时推进。
- 不操作实时扣血。
- 60-90 秒固定 burst。

## 预期交接

- Runtime Worker：补齐或重构 chain/intent/repair/payoff 的公开行为。
- HUD Worker：把 HUD 主语改为 chain、enemy intent、payoff。
- QA Worker：继续跑完整测试和浏览器 smoke，记录哪些红灯来自 runtime 尚未交付。
