# 2026-05-18 Round 03-07 奖励三分支卡池策划

角色：第 3 轮专家 07，奖励三分支卡池策划  
工作目录：`/Users/roc/Game-001`  
范围：只读审查 `rewardBranchesForCard` 与当前 `rewardCardPool`；本文不修改源码、不提交 git。

## 0. 结论

当前 `buildRewardChoices` 已经不是旧的“奖励池前 3 张”逻辑，而是按固定优先级各取一个分支：

```text
repair-resource -> payoff -> route-bridge
```

所以结构方向正确，首轮默认三选一能覆盖三类。但当前卡池还有两个问题：

1. 第一张 `route-bridge` 实际会落到 `paper_shatter`，它是 2 费抽牌 / 整备支援，不是最直观的 0/1/2 路线桥接。
2. `blood_tithe` 与 `pulse_draw` 已经在 fallback 分支集合里被当成 `repair-resource`，但它们不在 `rewardCardPool`，且卡牌自身仍是 `availability: reserve-test`。

建议：应把 `blood_tithe` 和 `pulse_draw` 纳入奖励池，但不要简单追加到末尾。它们需要同步从 `reserve-test` 转成玩家可见奖励牌，并修正分支合同，否则会出现“奖励池里有 reserve-test 牌”或“改了 availability 后分支从 repair 变成 route”的隐性问题。

## 1. 当前代码事实

### 1.1 分支识别规则

`rewardBranchesForCard(card)` 先读元数据和字段推导：

- `cardType / chainRole / cycleRole / buildRole / utilities / energyGain`
- 兼容未知字段：`rewardBranch`、`rewardBranches`、`rewardRole`、`rewardTags` 等
- 若元数据推导结果非空，就直接返回，不再走 fallback
- 只有元数据推导为空时，才使用硬编码 fallback 集合

当前 fallback 中：

```text
repair-resource: wild_mana_stitch, wild_gap_key, blood_tithe, pulse_draw
payoff: severance_burst, red_ledger_burst
route-bridge: blood_reclaim, spark_tap, redline_cut, heartbeat_spark, verdict_mark, row_cleave, clearance_order, paper_shatter, lantern_captain
```

关键风险：`blood_tithe` / `pulse_draw` 现在因为 `availability = reserve-test`，不会通过 route metadata，只靠 fallback 归到 `repair-resource`。如果后续只把 `availability` 改成 `reward`，它们会因为 `chainRole: starter / bridge` 先被识别为 `route-bridge`，fallback 反而不会生效。

### 1.2 当前奖励池实际首轮三选一

当前 `rewardCardPool`：

```text
wild_mana_stitch
severance_burst
wild_gap_key
paper_shatter
lantern_captain
red_ledger_burst
spark_tap
blood_reclaim
heartbeat_spark
verdict_mark
clearance_order
```

按当前算法，首轮默认选择会是：

| 槽位 | 分支 | 当前命中 | 判断 |
| --- | --- | --- | --- |
| A | 修补 / 资源 | `wild_mana_stitch` | 正确，0 费、Wild、抽 1、当前 MP +1，是最清楚的修补答案。 |
| B | payoff | `severance_burst` | 正确，但在未授权 payoff 降档前，数值风险偏高。 |
| C | 路线桥接 | `paper_shatter` | 分支覆盖成立，但语义偏“找牌 / 整备”，不够像直观的路线桥。 |

所以当前不是“覆盖失败”，而是“第三槽的语义不够准”。如果玩家期待的是修补缺口、拿终结、补路线三种清晰答案，route 槽应该优先给 0/1/2 的可打段，而不是先给 2 费自抽支援。

## 2. 卡池建议

### 2.1 分支职责

| 分支 | 应解决的问题 | 首选牌型 |
| --- | --- | --- |
| `repair-resource` | 本回合或下回合断链、缺牌、缺当前 MP。 | Wild、返 MP、0/1 费抽牌。 |
| `payoff` | 已经能做 0 -> 1 -> 2，需要消费授权。 | 3 费 burst 终结。 |
| `route-bridge` | 牌组缺 0 / 1 / 2 某一段，导致路线密度不足。 | 低费攻击段、1 费承接、2 费授权段。 |

### 2.2 是否纳入 `blood_tithe`

建议纳入，优先级中高。

理由：

- 它是 0 费 self 抽牌，能在坏手时先开链，再找 1/2 费段。
- 它不提供 Wild，也不返 MP，所以不会抢 `wild_mana_stitch` 的最强修补位置。
- 它能填补 repair 分支在两张 Wild 被选走后的后续供给。
- 作为奖励牌时，它比纯攻击 0 费更明确地承担“修补手牌资源”的职责。

纳入条件：

- `availability` 需要从 `reserve-test` 改为 `reward`。
- 分支合同需要显式保证它仍属于 `repair-resource`，不能因为 `chainRole: starter` 被单独归到 `route-bridge`。
- 卡面或 HUD 要承认它是“抽牌开链”，不是伤害牌。

建议分支：`repair-resource` 为主，可选兼任 `route-bridge`，但不能只归 route。

### 2.3 是否纳入 `pulse_draw`

建议纳入，但优先级低于 `blood_tithe`，并且要带测试门槛。

理由：

- 它是 1 费 self 抽牌，接在 0 费后会在当前倍率下抽 2，确实能把“缺 2 / 缺 payoff”的坏手救回来。
- 它会牺牲本次 1 费伤害，因此玩家选择它时有明确代价。
- 它能作为 repair 分支的后备，也能作为 route bridge 的 1 费承接变体。

风险：

- 当前抽牌会乘 `effectMultiplier`，`pulse_draw` 接在 0 费后抽 2，不是文案上的抽 1。
- 如果它过早进入首轮三选一，可能让抽牌修补强过具体路线选择。
- 如果只改 `availability`，它会优先被识别成 `route-bridge`，而不是 repair。

建议分支：`repair-resource + route-bridge` 双标签最合理；如果短期只能单标签，先放 `repair-resource`，因为 route 槽应优先留给直接费用段。

## 3. 推荐排序

### 3.1 立即可执行的排序目标

由于当前选择器按分支找“池中第一张命中的牌”，排序应服务三个目标：

1. 首轮三选一清楚：修补、payoff、路线。
2. 玩家连续选走某一类后，下一次仍有同类后备。
3. 2 费抽牌支援不要抢第一张路线桥接位。

### 3.2 推荐池顺序

如果同时开放 `blood_tithe` / `pulse_draw` 并修正分支合同，推荐顺序：

```text
wild_mana_stitch
red_ledger_burst
spark_tap
wild_gap_key
severance_burst
verdict_mark
blood_tithe
pulse_draw
blood_reclaim
clearance_order
paper_shatter
lantern_captain
heartbeat_spark
```

说明：

| 排序段 | 卡牌 | 目的 |
| --- | --- | --- |
| 1-3 | `wild_mana_stitch` / `red_ledger_burst` / `spark_tap` | 首轮明确给修补、较温和 payoff、0 费路线入口。 |
| 4-6 | `wild_gap_key` / `severance_burst` / `verdict_mark` | 第二层后备：Wild 修补、高上限 payoff、1 费路线承接。 |
| 7-8 | `blood_tithe` / `pulse_draw` | 抽牌修补后备，保证 Wild 被拿走后 repair 分支不枯竭。 |
| 9-10 | `blood_reclaim` / `clearance_order` | 继续补 0 费入口与 2 费授权段。 |
| 11-13 | `paper_shatter` / `lantern_captain` / `heartbeat_spark` | 牌序支援与重复承接后置，避免抢首轮路线位。 |

`red_ledger_burst` 放在 `severance_burst` 前，是因为当前未授权 payoff 仍偏强；如果后续完成 armed / unarmed payoff 分档，可以把 `severance_burst` 调回首个 payoff。

### 3.3 不建议的做法

不建议只做：

```text
rewardCardPool.push('blood_tithe', 'pulse_draw')
```

原因：

- 追加到末尾不会改变首轮三选一，坏手修补的可见性仍然低。
- `availability: reserve-test` 会和奖励池语义冲突。
- 一旦把 availability 改成 reward，当前分支推导可能让它们变成 route，而不是 repair。

## 4. 分支合同建议

为了让卡池稳定，不应长期依赖 fallback 硬编码。建议后续二选一：

### 方案 A：显式 reward 分支字段

为卡牌定义增加可测试字段：

```text
rewardBranches: ['repair-resource']
rewardBranches: ['repair-resource', 'route-bridge']
```

然后 `rewardBranchesForCard` 优先读取该字段。这样 `blood_tithe` / `pulse_draw` 可以表达双职责，不被 `availability` 或 `chainRole` 的副作用改变。

### 方案 B：扩展现有推导规则

如果不想新增字段，则需要让抽牌修补更稳定：

```text
card.cardType === 'draw' && card.cycleRole === 'draw-fixer' -> repair-resource
```

同时 route 推导仍可保留。这样 `blood_tithe` / `pulse_draw` 改成 reward 后，能自然命中 repair。

方案 A 更清楚，方案 B 改动更小。无论选哪种，都要加测试锁住。

## 5. 测试建议

本次只读验证已跑：

```text
npm test -- reward-branching.test.ts card-taxonomy.test.ts progression-reward-regression.test.ts run-progression.test.ts
```

结果：

```text
4 个测试文件通过，11 个测试用例通过。
```

后续应补以下测试：

| 测试 | 验收点 |
| --- | --- |
| reward 分支矩阵测试 | 每张 `rewardCardPool` 牌至少命中一个分支；`blood_tithe` / `pulse_draw` 命中预期分支；奖励池不得包含 `availability: reserve-test`。 |
| 默认三选一排序测试 | 推荐池顺序下，首轮 choices 应为 `repair-resource + payoff + route-bridge`，且 route 槽不是 `paper_shatter` / `lantern_captain` 这种后置支援牌。 |
| repair 分支耗尽测试 | 连续选走 `wild_mana_stitch` 和 `wild_gap_key` 后，下一次奖励仍能由 `blood_tithe` 或 `pulse_draw` 补上 repair 分支。 |
| availability 回归测试 | 把 `blood_tithe` / `pulse_draw` 从 `reserve-test` 转为 `reward` 后，分支不会从 repair 意外漂移成纯 route。 |
| `pulse_draw` 倍率测试 | `0 -> pulse_draw` 时当前会抽 2；需要明确这是设计认可，还是后续改成支援牌不吃倍率。 |
| 坏手修补场景测试 | 强制手牌缺 2 或缺 payoff，使用 `blood_tithe` / `pulse_draw` 后能抽到桥接或 payoff，且不改变 `maxEnergy`。 |

## 6. 最小落地顺序

1. 先锁 reward 分支合同：新增显式字段或扩展 draw-fixer 推导。
2. 再把 `blood_tithe`、`pulse_draw` 改为玩家可见奖励牌。
3. 调整 `rewardCardPool` 顺序，让首轮 route 槽先出现 `spark_tap` 或其他直接费用段。
4. 跑排序、分支矩阵、坏手修补和 `pulse_draw` 倍率测试。
5. 如果未授权 payoff 仍未降档，暂时让 `red_ledger_burst` 排在 `severance_burst` 前；完成 payoff 分档后再决定是否换回。

## 7. 最终裁决

`blood_tithe`：应该进奖励池，定位为 0 费抽牌修补 / 开链找牌，优先作为 repair-resource 后备。  
`pulse_draw`：应该进奖励池，但要晚于 `blood_tithe`，并用测试确认倍率抽 2 是否可接受。  
当前 `rewardBranchesForCard`：结构可用，但需要显式合同防止 `availability` 调整后分支漂移。  
当前 `rewardCardPool`：三类覆盖成立，但排序应把第一张 route 从 `paper_shatter` 前移到更直接的费用段。

STATUS: DONE
