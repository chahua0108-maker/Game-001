# 2026-05-19 第15轮-03 奖励构筑回应工程师

角色：第15轮-03《奖励构筑回应工程师》  
工作目录：`/Users/roc/Game-001`  
口径：QA 不计入分数；不回滚其他 agent 改动；尽量不碰 runtime。

## 目标

让奖励候选具备“回应上一战问题”的纯规则入口：

- 被污染：优先给清污，其次给保留相关选择。
- 缺终结：优先给 payoff。
- 缺桥：优先给 Wild / 低费桥。
- 缺资源：优先给授权段 / 抽牌资源。

本轮没有修改 `runtime.ts`。现有 runtime 继续按默认三分支生成奖励；新能力通过 `buildRewardChoices(..., responseProfile)` 作为可接入入口，避免抢其他 agent 的运行时改动面。

## 改动文件

| 文件 | 改动 |
| --- | --- |
| `prototype-web/src/sim/rewardProgression.ts` | 新增 `RewardResponseProblem`、`RewardResponseRole`、`RewardResponseProfile`，并提供 `rewardResponseRolesForProblems()` 把上一战问题映射到响应槽。 |
| `prototype-web/src/sim/rewardChoices.ts` | 新增 `rewardResponseRolesForCard()`，并让 `buildRewardChoices()` 可选接收 `responseProfile`；没有 profile 时保持原三分支逻辑。 |
| `prototype-web/src/tests/sim/redline-reward-response.test.ts` | 新增 7 条 sim 红线测试，覆盖污染、缺终结、缺桥、缺资源、默认奖励稳定和当前卡牌响应分类。 |
| `design/technical/redline-batches/long-task/2026-05-19-round-15-03-reward-response.md` | 本交付记录。 |

## 设计要点

`RewardResponseProblem` 是上一战问题，不等同于奖励分支：

- `polluted` -> `cleanse-pollution`、`retain`
- `missing-payoff` -> `payoff`
- `missing-bridge` -> `wild-bridge`、`low-cost-bridge`
- `missing-resource` -> `authorization`、`draw-resource`

`rewardResponseRolesForCard()` 从现有卡牌字段读响应角色：

- `净化`、消耗/清污定位 -> `cleanse-pollution`
- `保留`、`retain` 生命周期 -> `retain`
- `rewardBranches: ['payoff']` -> `payoff`
- Wild / repair -> `wild-bridge`
- 低费 route bridge -> `low-cost-bridge`
- 非 payoff 的授权段 -> `authorization`
- 抽牌 / 返 MP -> `draw-resource`

特别处理：payoff 牌本身虽然带 `authorization` 标签，但它不是“缺资源”的授权解决方案；缺资源时优先 `clearance_order` 这类授权段，再给 `blood_tithe / pulse_draw` 这类抽牌资源。

## 验证

在 `prototype-web` 下执行：

| 命令 | 结果 |
| --- | --- |
| `npm test -- --run src/tests/sim/redline-reward-response.test.ts` | 通过，1 file / 7 tests passed。 |
| `npm run build` | 通过，`tsc && vite build` 成功；仅保留 Vite chunk > 500KB 警告。 |

补充观察：

- 试跑 `npm test -- --run src/tests/sim/redline-reward-response.test.ts src/tests/sim/reward-branching.test.ts` 时，`redline-reward-response` 通过，但既有 `reward-branching.test.ts` 有 2 条失败。
- 失败原因是当前卡池已有其他 agent 新增的 `silt_purge`，它位于 `rewardCardPool` 中并声明 `rewardBranches: ['repair-resource']`，导致旧测试仍期待 `pulse_draw / wild_gap_key` 的顺序不再匹配实际卡池。
- 本轮没有修改 `prototype-web/src/data/cards.ts` 或旧测试，避免覆盖他人卡池改动。

## 后续接入点

如果后续要让实战奖励自动读上一战问题，只需要在 runtime 生成 reward 时构造 `RewardResponseProfile` 并传给：

```ts
buildRewardChoices(world.reward.candidateCardPool, world.reward.pickCount, cards, responseProfile)
```

本轮先把候选排序能力和测试合同落好，没有把上一战诊断状态写进 `WorldState`。
