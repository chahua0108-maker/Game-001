# 2026-05-18 Round 05-02 rewardCardPool P0 排序平衡

角色：第 5 轮专家 02，奖励池排序平衡师  
工作目录：`/Users/roc/Game-001`  
范围：只读当前源码和第 4 轮文档；本文只提出 `rewardCardPool` P0 顺序，不修改源码、不提交 git。  
前提：第 4 轮 `rewardBranches` 显式合同已存在，`buildRewardChoices` 按 `repair-resource -> payoff -> route-bridge` 依次从 `candidateCardPool` 中选择每个分支的第一张牌。

## 0. 裁决

P0 推荐分两档：

1. 如果本批只允许重排当前 11 张：采用“首奖清楚、二奖不断供”的 11 张顺序。
2. 如果本批同时开放 `blood_tithe` / `pulse_draw`：首奖仍保持同一组三类选择，把两张抽牌修补牌放到第二层以后的 repair 后备位，避免 self draw 抢首奖或抢 route 槽。

核心判断：首奖不应该暴露 `paper_shatter` / `lantern_captain` 这种 2 MP self draw 支援，也不应该让未降档的 `wild_mana_stitch` 成为第一修补答案。首奖应读成：

```text
修补缺口 / 拿温和终结 / 补路线入口
```

## 1. 只重排当前 11 张

### 1.1 推荐数组

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

### 1.2 首奖结果

`buildRewardChoices(rewardCardPool, 3, cards)` 应稳定得到：

```text
wild_gap_key / red_ledger_burst / spark_tap
```

| 槽位 | 分支 | 命中卡 | 平衡理由 |
| --- | --- | --- | --- |
| 1 | `repair-resource` | `wild_gap_key` | 第一眼就是“修补费用缺口”，比 `wild_mana_stitch` 更适合教学。 |
| 2 | `payoff` | `red_ledger_burst` | 12 点全场终结，比 `severance_burst` 温和，不把首奖变成纯数值题。 |
| 3 | `route-bridge` | `spark_tap` | 0 MP 路线入口，明确补开链密度，不让 2 MP self draw 抢 route 首槽。 |

### 1.3 第二奖不断供

第一奖三选一中无论选哪张，第二次奖励仍能覆盖三分支：

| 第一奖选择 | 被移除分支 | 第二奖应生成 | 判断 |
| --- | --- | --- | --- |
| `wild_gap_key` | repair | `wild_mana_stitch / red_ledger_burst / spark_tap` | 不断供，但 repair 只剩最后一张；第三次连续拿 repair 会枯竭。 |
| `red_ledger_burst` | payoff | `wild_gap_key / severance_burst / spark_tap` | payoff 还有高上限后备。 |
| `spark_tap` | route | `wild_gap_key / red_ledger_burst / verdict_mark` | route 从 0 MP 入口切到 1 MP 承接，语义仍清楚。 |

11 张版本的边界：它只能保证首奖和第二奖不枯竭。若玩家连续两次都拿 repair，第三次奖励不再能保证 `repair-resource`，因为当前正式 repair 只有 `wild_gap_key` 与 `wild_mana_stitch`。

## 2. 开放 blood_tithe / pulse_draw 后

### 2.1 推荐数组

```ts
export const rewardCardPool: string[] = [
  'wild_gap_key',
  'red_ledger_burst',
  'spark_tap',
  'blood_tithe',
  'severance_burst',
  'verdict_mark',
  'pulse_draw',
  'wild_mana_stitch',
  'blood_reclaim',
  'clearance_order',
  'paper_shatter',
  'lantern_captain',
  'heartbeat_spark'
];
```

### 2.2 首奖结果

开放两张抽牌修补牌后，首奖仍应保持：

```text
wild_gap_key / red_ledger_burst / spark_tap
```

| 槽位 | 分支 | 命中卡 | 平衡理由 |
| --- | --- | --- | --- |
| 1 | `repair-resource` | `wild_gap_key` | 先教 Wild 修补，不把首奖切成 self draw 教学。 |
| 2 | `payoff` | `red_ledger_burst` | 保持温和 payoff 入口。 |
| 3 | `route-bridge` | `spark_tap` | 保持最直观 route 入口。 |

`blood_tithe` 放在第 4 位，目的是让玩家第一次选走 `wild_gap_key` 后，第二奖立刻看到低风险手牌流动。`pulse_draw` 放在 `verdict_mark` 后面，目的是防止它因为兼具 `route-bridge` 而抢走第二层 route 槽；当 repair 分支需要它时，选择器会先按 `repair-resource` 拿到它。

### 2.3 第二奖不断供

第一奖三选一中无论选哪张，第二次奖励仍能覆盖三分支：

| 第一奖选择 | 被移除分支 | 第二奖应生成 | 判断 |
| --- | --- | --- | --- |
| `wild_gap_key` | repair | `blood_tithe / red_ledger_burst / spark_tap` | repair 从 Wild 切到抽牌修补，仍不断供。 |
| `red_ledger_burst` | payoff | `wild_gap_key / severance_burst / spark_tap` | payoff 正常切到高上限后备。 |
| `spark_tap` | route | `wild_gap_key / red_ledger_burst / verdict_mark` | route 正常切到 1 MP 承接；`pulse_draw` 不抢 route 槽。 |

开放版的额外价值：如果玩家前两次都拿 repair，后续仍有 `pulse_draw` 与 `wild_mana_stitch` 作为 repair 后备；11 张版本做不到这一点。

```text
连续拿 repair 的后备链：
wild_gap_key -> blood_tithe -> pulse_draw -> wild_mana_stitch
```

这个顺序故意把未降档的 `wild_mana_stitch` 放到更后面。它当前同时有 Wild、抽牌和当前 MP +1，太早出现会压掉 `blood_tithe` / `pulse_draw` 的存在感；除非同批把 `wild_mana_stitch` 改成“真实修补成功才返 MP”，否则不建议放回第二 repair 位。

## 3. 排序原则

1. 第一 repair 用 `wild_gap_key`，不是 `wild_mana_stitch`：首奖需要教学清楚，而不是给最万能答案。
2. 第一 payoff 用 `red_ledger_burst`，不是 `severance_burst`：首奖 payoff 应是入口，不是最大数值。
3. 第一 route 用 `spark_tap`，不是 `paper_shatter` / `lantern_captain`：首奖 route 应补路线入口，不应补 2 MP self draw 支援。
4. `heartbeat_spark` 后置：它已经在起手中出现，首奖不需要奖励玩家一张熟悉的基础承接牌。
5. 开放版中 `pulse_draw` 必须排在至少一个直接 route 后面，避免它在 repair 未被它占用时抢 route 槽。

## 4. 验收断言

只重排 11 张时：

```text
buildRewardChoices(pool11, 3, cards)
=> wild_gap_key / red_ledger_burst / spark_tap

without wild_gap_key
=> wild_mana_stitch / red_ledger_burst / spark_tap

without red_ledger_burst
=> wild_gap_key / severance_burst / spark_tap

without spark_tap
=> wild_gap_key / red_ledger_burst / verdict_mark
```

开放 `blood_tithe` / `pulse_draw` 后：

```text
buildRewardChoices(pool13, 3, cards)
=> wild_gap_key / red_ledger_burst / spark_tap

without wild_gap_key
=> blood_tithe / red_ledger_burst / spark_tap

without red_ledger_burst
=> wild_gap_key / severance_burst / spark_tap

without spark_tap
=> wild_gap_key / red_ledger_burst / verdict_mark
```

测试不应只断言 `choices.length === 3`，必须断言三张分别命中：

```text
repair-resource / payoff / route-bridge
```

## 5. 不进入本批

- 不改 `wild_mana_stitch` 数值。
- 不改 `wild_gap_key` 伤害。
- 不改 `pulse_draw` 抽牌倍率规则。
- 不让 `blood_tithe` / `pulse_draw` 进入起始牌组。
- 不让 `paper_shatter` / `lantern_captain` 在首奖 route 槽出现。
- 不实现权重、随机、seen history、动态推荐 reason。

STATUS: DONE
