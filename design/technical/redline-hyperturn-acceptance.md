# Redline Hyper-Turn Acceptance Contract

日期：2026-05-18

状态：当前唯一有效 Redline 验收合同。旧 `redline-90s-acceptance.md` 已 deprecated，只作为 realtime heartbeat 失败方向的历史证据保留。

## 方向裁决

`Redline Hyper-Turn Card Pressure Slice` 替代上一批 `Redline 90s realtime heartbeat`。

本合同验收的压迫来源是：

- 回合内高速打牌。
- `0 -> 1 -> 2` 或 `0 -> 1 -> payoff` 的费用升序链。
- 敌人意图和结束回合后果。
- 手牌缺口、断链、Wild/draw/mana/reorder 修补。
- chain 成立后的 payoff 清前排或救场。

本合同不再验收：

- 自动攻击作为核心战斗底盘。
- 敌人实时推进到压力线后扣血。
- 固定 60 秒 burst。
- 不操作也替玩家稳定清怪的实时脚本。

## 0-30 秒硬验收

| 项目 | 必须成立的体验结果 | 可接受证据 |
| --- | --- | --- |
| 3 秒内可操作 | 玩家进入战斗并拿到手牌。 | `HandDealt`、浏览器 smoke、HUD 首屏 |
| 第一手牌路线 | 起手或脚本第一手能读出 `0 -> 1 -> 2` 或 `0 -> 1 -> payoff`。 | 手牌费用序列、HUD chain preview |
| 正序收益高于乱序 | 按升序打牌的伤害、抽牌、清前排或 payoff 收益明显高于乱序。 | sim event 数值、trace、回放 |
| 敌人意图可读 | 结束回合前能读到敌人将造成的伤害，或等价地能预览本回合未处理的可观察后果。 | `EnemyIntent`/intent preview，或 end-turn 前后后果一致性测试 |

## 30-90 秒硬验收

| 项目 | 必须成立的体验结果 | 可接受证据 |
| --- | --- | --- |
| 3-5 个短回合 | 玩家在短时间内经历成功链、断链、修补、payoff。 | sim test、replay |
| 断链不是禁牌 | 断链收益下降，但玩家仍能出牌并承担较低收益。 | `CardPlayed` 成功但 multiplier/payoff 降低 |
| 修补件至少成功一次 | Wild / draw / mana / reorder 至少能把一次缺口接回来。 | 修补后继续打出下一段 chain |
| payoff 救场 | 第 3-5 回合内至少一次 payoff 因 chain 成立而清前排、准清场或避免高意图伤害。 | payoff 牌造成多目标击杀，或 end-turn 后避免预期伤害 |

## 5-8 分钟压缩验收

可以用固定 seed 压缩到 2 分钟以内，但逻辑必须来自构筑，而不是时间脚本：

```text
小 combo
  -> 敌人意图和 HP 压力增加
  -> 奖励或手牌拿到 Wild / draw / mana / reorder
  -> 修补断链并拉长回合
  -> payoff card 清前排或救场
  -> 奖励/结算回应这条构筑
```

## 测试合同

唯一新合同测试：

```text
prototype-web/src/tests/sim/redline-hyperturn-acceptance.test.ts
```

测试必须覆盖：

- 第一手牌/脚本能打出 `0 -> 1 -> 2` 或 `0 -> 1 -> payoff`。
- 正确顺序收益明显高于乱序。
- 结束回合前能读到敌人意图或等价的可观察后果。
- 断链收益下降但不完全禁止出牌。
- Wild/draw/mana/reorder 至少能修补一次断链。
- 3-5 回合内出现一次 payoff 清前排/救场。

## Worker 边界

- Contract/Test Worker：维护本文、`redline-hyperturn-acceptance.test.ts`、deprecated 标记和批次记录。
- Runtime Worker：让 runtime/data 公开符合本合同的 chain、intent、repair、payoff 行为，不通过改测试绕过体验指标。
- HUD Worker：把玩家主语改成 chain、enemy intent、payoff，不继续突出 realtime pressure/burst。
- QA Worker：运行 `npm test -- --run`、必要的 browser smoke，并保存失败证据。
