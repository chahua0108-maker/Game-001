# 2026-05-18 Round 04-03 奖励池排序与三选一体验制作人

角色：第 4 轮专家 03，奖励池排序与三选一体验制作人  
工作目录：`/Users/roc/Game-001`  
范围：只读审查当前 `rewardCardPool`、`buildRewardChoices` 与前三轮文档；本文不修改源码、不提交 git。

## 0. 结论

当前 `buildRewardChoices` 的方向是对的：它不是直接取 `rewardCardPool` 前 3 张，而是按固定分支顺序各取第一张可用牌：

```text
repair-resource -> payoff -> route-bridge
```

问题在排序体验。当前首奖实际会变成：

```text
wild_mana_stitch / severance_burst / paper_shatter
```

它虽然覆盖修补、终结、路线三类，但第三张 `paper_shatter` 更像 2 费找牌支援，不像玩家第一眼能读懂的“路线桥接”。同时 `wild_mana_stitch` 未降档时过于万能，容易让首奖三选一变成单选题。

P0 主推荐：只重排当前 11 张 `rewardCardPool`，不在这个排序批次里顺手开放 `blood_tithe` / `pulse_draw`。这样能保证首奖是清楚的：

```text
修补：wild_gap_key
终结：red_ledger_burst
路线：spark_tap
```

并保证在当前 12 / 24 / 42 XP 的短 demo 节奏里，第二次奖励不会因为玩家第一次选择某一分支而立刻断供。

## 1. 当前代码事实

### 1.1 选择器事实

`prototype-web/src/sim/rewardChoices.ts` 的关键行为：

- 分支优先级固定为 `repair-resource`、`payoff`、`route-bridge`。
- 每个分支从 `candidateCardPool` 顺序里找第一张命中的牌。
- 分支取完后，如果还没达到 `pickCount`，才按候选池顺序补齐。
- `rewardBranchesForCard` 目前主要从 `cardType`、`chainRole`、`cycleRole`、`buildRole`、`utilities`、`energyGain` 推导分支。

`prototype-web/src/sim/runtime.ts` 的奖励入池行为：

- 玩家选择奖励后，`AddCardToDeck` 会把所选牌加入 `deck`，并 `unshift` 到 `drawPile` 顶部。
- 同时，所选牌会从 `world.reward.candidateCardPool` 移除。
- 未被选择的另外两张奖励牌不会移除，后续仍可继续出现。

因此排序不只是决定首奖，还决定“玩家选走某一分支后，下一张同分支后备是谁”。

### 1.2 当前池分支结构

当前 `rewardCardPool` 共 11 张：

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

按当前推导，P0 可用分支大致是：

| 分支 | 当前可用牌 | 问题 |
| --- | --- | --- |
| 修补 / 资源 | `wild_mana_stitch`、`wild_gap_key` | 只有 2 张；够支撑首奖和第二奖，不够支撑玩家连续三次都拿修补。 |
| 终结 / payoff | `severance_burst`、`red_ledger_burst` | 只有 2 张；短 demo 足够，长期三节点不够。 |
| 路线 / bridge | `paper_shatter`、`lantern_captain`、`spark_tap`、`blood_reclaim`、`heartbeat_spark`、`verdict_mark`、`clearance_order` | 数量足，但当前排序让 2 费找牌支援抢了首个路线槽。 |

结论：P0 只靠排序可以修正首奖体验和第二奖续航；如果要求整个 run 内连续三次选择同一分支仍然三类齐全，当前卡量不足，必须扩池或限制奖励暴露次数。

## 2. P0 推荐数组

推荐把当前 `rewardCardPool` 调整为：

```ts
export const rewardCardPool: string[] = [
  'wild_gap_key',
  'red_ledger_burst',
  'spark_tap',
  'wild_mana_stitch',
  'severance_burst',
  'verdict_mark',
  'blood_reclaim',
  'clearance_order',
  'paper_shatter',
  'lantern_captain',
  'heartbeat_spark'
];
```

### 2.1 首奖结果

按当前 `buildRewardChoices`，首奖应稳定生成：

| 槽位 | 分支 | 推荐命中 | 体验理由 |
| --- | --- | --- | --- |
| A | 修补 / 资源 | `wild_gap_key` | 卡面直接写“修补费用缺口”，比未降档的 `wild_mana_stitch` 更适合作为第一眼的修补教学。 |
| B | 终结 / payoff | `red_ledger_burst` | 仍是 3 MP 全场终结，但数值低于 `severance_burst`，首奖不至于直接变成最高伤害答案。 |
| C | 路线 / bridge | `spark_tap` | 0 费路线入口，玩家能立刻理解“补一张开链 / 路线牌”，比 `paper_shatter` 更直观。 |

### 2.2 第二层后备

如果玩家第一次选择某一分支，下一次奖励仍能维持三类：

| 第一次选择 | 被移除 | 下一次三选一应为 | 续航判断 |
| --- | --- | --- | --- |
| `wild_gap_key` | 修补 1 | `wild_mana_stitch / red_ledger_burst / spark_tap` | 修补仍有后备，但这是最后一张当前修补牌。 |
| `red_ledger_burst` | 终结 1 | `wild_gap_key / severance_burst / spark_tap` | 终结仍有高上限后备。 |
| `spark_tap` | 路线 1 | `wild_gap_key / red_ledger_burst / verdict_mark` | 路线从 0 费入口切到 1 费承接，路线语义仍清楚。 |

这正好匹配第 3 轮综合结论：首奖 12 XP，二奖 24 XP，第三奖 42 XP 多半在短 demo 外。P0 要保证的是首奖清楚、第二奖不枯竭，而不是现在就假装 11 张牌能支撑完整长期构筑。

## 3. 排序原因

### 3.1 `wild_gap_key` 放在 `wild_mana_stitch` 前

`wild_mana_stitch` 当前是 0 费、修补、抽牌、当前 MP +1，且抽牌还会受链倍率影响。它作为第一张修补牌太容易压过另外两个选项。

`wild_gap_key` 虽然当前伤害只有 1，但职责更干净：花 1 MP 修补缺口，告诉玩家“这张是为了不断链，不是为了最高伤害”。所以 P0 首奖修补位先给 `wild_gap_key`，把 `wild_mana_stitch` 放到第二层作为强后备。

### 3.2 `red_ledger_burst` 放在 `severance_burst` 前

前三轮多次指出未武装 payoff 偏强。首奖终结位如果直接给 `severance_burst`，玩家容易把奖励理解成“拿最大清场数值”，而不是理解 0 -> 1 -> 2 授权后的终结消费。

`red_ledger_burst` 仍然是 payoff，但伤害更温和，更适合作为首奖里的“终结路线入口”。`severance_burst` 留给第二层高上限选择。

### 3.3 `spark_tap` 抢回首个 route 槽

当前排序下，route 槽先命中 `paper_shatter`。它的功能是 2 费抽牌 / 找终结，适合作为后段支援，但不适合作为首奖三选一里的“路线”代表。

`spark_tap` 是 0 费攻击开链，能直接补路线密度。玩家下一手看到它时，能自然尝试：

```text
spark_tap -> 1 MP 承接 -> 2 MP 授权段
```

这比“抽 1 / 整备找牌”更符合首奖 route 的教学职责。

### 3.4 `paper_shatter`、`lantern_captain` 后置

这两张都是 2 费 self 抽牌，并带有 `reorder` 语义标签，但当前运行时并没有真实重排。它们可以留在池里作为后续找 payoff 的支援牌，但不应抢首奖路线位，也不应连续出现在前两层让奖励看起来重复。

## 4. 不建议的 P0 做法

### 4.1 不建议只把 `spark_tap` 插到当前第三位

如果只做：

```text
wild_mana_stitch
severance_burst
spark_tap
...
```

首奖会变成强修补、强终结、路线入口，三张都偏强，玩家更可能只按数值选，不按问题选。

### 4.2 不建议在同一批次直接追加 `blood_tithe` / `pulse_draw`

第 3 轮文档倾向开放这两张修补牌，但它们现在仍是 `availability: reserve-test`。更关键的是，当前 `rewardBranchesForCard` 如果只把它们改成 `reward`，它们可能因为 `chainRole: starter / bridge` 被推导为 route，而不是稳定的 repair。

所以开放它们必须和以下合同同批落地：

```text
显式 rewardBranches 字段
或 draw-fixer -> repair-resource 的稳定推导规则
以及 reserve-test 不进入正式 rewardCardPool 的测试
```

在没有这个合同前，P0 排序先用当前 11 张牌完成首奖体验，不把 reserve 牌混进主数组。

### 4.3 不建议把 `heartbeat_spark` 前置

`heartbeat_spark` 已在起始牌组中出现，虽然 `availability` 是 `starting-and-reward`，但首奖 route 不应先奖励玩家一张已经熟悉的基础 1 费承接。它适合放在尾部作为稳定重复件，而不是作为路线首选。

## 5. 风险

| 风险 | 影响 | 处理 |
| --- | --- | --- |
| `wild_gap_key` 当前反馈偏弱 | 首奖修补位可能显得不如另外两张有吸引力。 | 接受为 P0 教学取舍；后续可按第 3 轮建议把伤害从 1 调到 2。 |
| `wild_mana_stitch` 仍然过强 | 第二层修补出现时可能成为自动选项。 | 不在本排序批次改数值；把它从首奖后移，减少首奖单选化。 |
| payoff 只有 2 张 | 玩家若连续两次拿终结，第三次奖励无法继续保证 payoff 槽。 | P0 短 demo 第三奖阈值 42，通常在 3-5 回合外；若要三节点全覆盖，必须新增第三张 payoff 或限制第三次奖励展示。 |
| repair 只有 2 张 | 玩家若连续两次拿修补，第三次奖励无法继续保证 repair 槽。 | 同上；若第 4 轮要扩修补池，应先落 `blood_tithe` / `pulse_draw` 的分支合同。 |
| `paper_shatter` / `lantern_captain` 文案承诺重排 | 玩家可能以为“整备”已经有真实 reorder。 | 两张后置；验收时要求移动端文案不承诺未实现的重排。 |
| 未选奖励会重复出现 | 玩家第一次没选的 payoff / route 可能第二次仍出现。 | 这是当前 `candidateCardPool` 规则的自然结果，P0 可接受；后续若要减少重复，需要 seen history 或权重系统。 |

## 6. 验收

### 6.1 静态验收

- `rewardCardPool` 仍只包含当前 11 张正式奖励 / starting-and-reward 牌，不包含 `availability: reserve-test`。
- `rewardCardPool` 内每个 id 都存在于 `cards`。
- 首个 repair 候选是 `wild_gap_key`。
- 首个 payoff 候选是 `red_ledger_burst`。
- 首个 route 候选是 `spark_tap`，不是 `paper_shatter` 或 `lantern_captain`。

### 6.2 选择器验收

用推荐数组调用：

```text
buildRewardChoices(rewardCardPool, 3, cards)
```

应得到：

```text
wild_gap_key
red_ledger_burst
spark_tap
```

并且三张分别命中：

```text
repair-resource
payoff
route-bridge
```

### 6.3 后续不枯竭验收

在当前 P0 短 demo 范围内，至少验证三条移除路径：

```text
移除 wild_gap_key 后：下一次 choices 仍包含 repair / payoff / route
移除 red_ledger_burst 后：下一次 choices 仍包含 repair / payoff / route
移除 spark_tap 后：下一次 choices 仍包含 repair / payoff / route
```

推荐具体断言：

```text
without wild_gap_key -> wild_mana_stitch / red_ledger_burst / spark_tap
without red_ledger_burst -> wild_gap_key / severance_burst / spark_tap
without spark_tap -> wild_gap_key / red_ledger_burst / verdict_mark
```

### 6.4 体验验收

- 首奖三张卡的玩家读法必须分别是：修补缺口、拿终结、补路线入口。
- 选择任意首奖后，该牌进入下一手，玩家能立刻围绕它做下一次出牌决策。
- 首奖 route 卡不能是 2 费找牌支援；2 费找 payoff 支援只能在后续层出现。
- 同一次奖励面板不应同时出现 `paper_shatter` 和 `lantern_captain` 两张同构 2 费自抽支援牌。

## 7. 第 4 轮后的扩展条件

如果产品目标从“P0 3-5 回合样片”升级为“完整三节点 run 中任意连续选择同一分支也不枯竭”，只重排当前池不够。届时需要至少满足：

1. 修补池开放 `blood_tithe` / `pulse_draw`，并用显式合同保证它们命中 `repair-resource`。
2. payoff 池新增第三张低 / 中强度终结牌，或降低自然第三奖暴露概率。
3. `rewardCardPool` 从纯顺序数组升级到带 `branch / tier / weight / seenHistory` 的奖励规格。

本轮 P0 不建议提前做这些系统化扩展。先把首奖三选一做清楚，让第二次奖励不断供。

STATUS: DONE
