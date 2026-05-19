# 2026-05-18 Round 07 汇总：真实整备暂缓，先压缩 HUD 信息架构

## 本轮目标

第 7 轮围绕“真实 reorder / 整备机制”与 HUD 信息架构展开。10 个新专家视角的共同结论是：当前还不应该直接落地完整 `SearchAndTopdeck`，否则会同时放大数值强度、运行时状态复杂度和移动端 UI 风险。本轮选择先把可见 HUD 词表压短，为第 8 轮可能的极窄整备样片留出空间。

## 10 个专家视角

| 序号 | 文件 | 关键结论 |
| --- | --- | --- |
| 01 | `2026-05-18-round-07-01-reorder-interaction-design.md` | 若做整备，应是轻量“看 K 取 N”整备条，不做大弹窗。 |
| 02 | `2026-05-18-round-07-02-reorder-runtime-contract.md` | `SearchAndTopdeck / DrawPileReordered / DeckSearchMissed` 合同可行，但需保护奖励、抽牌倍率、Wild 修补。 |
| 03 | `2026-05-18-round-07-03-hud-token-system.md` | 玩家可见层必须统一短 token：`授权+3`、`授权付`、`缺MP1`、`整备`、`抽N仍-X`。 |
| 04 | `2026-05-18-round-07-04-mobile-reorder-qa.md` | 360 宽小屏是硬门槛，手牌、奖励、日志都必须单行保护。 |
| 05 | `2026-05-18-round-07-05-reorder-balance.md` | 不建议两张 2 MP self draw 同时真找牌；最多只允许后续做 `paper_shatter` 极窄样片。 |
| 06 | `2026-05-18-round-07-06-reorder-test-contract.md` | 若后续实现真置顶，需要新增运行时合同、负例和 UI helper 文案预算测试。 |
| 07 | `2026-05-18-round-07-07-pressure-preserving-reorder.md` | 整备必须服务“下次抽牌规划”，不能变成即时答案按钮。 |
| 08 | `2026-05-18-round-07-08-implementation-slice.md` | 给出最小实现切片，但主线程裁决本轮不动运行时。 |
| 09 | `2026-05-18-round-07-09-competitor-reorder-mapping.md` | 竞品映射支持“先做受限顶牌”，不要直接做全牌堆 tutor。 |
| 10 | `2026-05-18-round-07-10-producer-synthesis.md` | 明确本轮只做 HUD 压缩，不做真实 reorder。 |

## 主线程裁决

本轮不落地完整找牌、置顶、重排运行时。理由：

- 当前 `blood_tithe / pulse_draw / payoff` 早期授权 payoff 率已经较高，完整找牌会把敌人意图从压力变成背景数值。
- 真实 reorder 至少需要候选区、命中/未命中、置顶结果、移动端确认和日志反馈，超过第 7 轮最小验收范围。
- 用户当前指出 UI 有大问题，所以先修可见层：固定高度卡牌里不再塞长机制句。

## 已落地改动

- `hudAuthorizationState` 从 `终局授权 +3` 压缩为 `授权+3`。
- 新增 `hudCardPaymentStatusToken`，把手牌支付状态统一为 `缺MP1 / 缺授权 / 授权付`。
- `hudCardRoleLabel` 压缩角色词：`整备/找牌 -> 整备`、`修补/抽牌 -> 修补`、`展开/清前排 -> 展开`。
- 卡牌目标压缩为 `默认BRU / 前排 / 全场 / 自身`，不再在卡牌按钮里显示长目标句。
- 链路预览压缩为 `起链x1 / 非起x1 / 接x2 / 断x1 / 修补MP1x2`。
- 终结预览压缩为 `授权就绪 / 终结未授权 / 授权终结xN / 未授权xN`。
- Director 和 deal panel 压缩为 `下张费用`、`敌意图`、`回合损N`、`结束-N`。
- `.combat-feed li`、`.missing-cost` 增加单行 ellipsis 保护，避免后续日志和支付角标超框。

## 验收结果

- `npm test -- --run src/tests/ui/hud-target-selection.test.ts`：14 passed。
- `npm test -- --run`：13 passed、1 skipped；113 passed、2 skipped。
- `npm run build`：通过；保留 Vite 500KB chunk warning。
- 浏览器验收：`1366x768`、`390x844`、`360x640` 三档视口均无 console error、无页面水平溢出、无未保护文字超框。
- 浏览器验收结束后已关闭脚本打开的 Chrome。

## 下一轮建议

第 8 轮可以进入“极窄整备样片”或“参数化平衡表”二选一。按本轮专家结论，若做真实机制，首刀只建议：

- 只打开 `paper_shatter`。
- 只在已完成或延续 `0 -> 1 -> 2` 后触发。
- 只搜 `drawPile`。
- 只找 1 张 payoff。
- 在 `DrawCards` 前置顶。
- 不搜索弃牌堆，不启用 `lantern_captain`，不做手动重排 UI。

STATUS: DONE
