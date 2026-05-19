# 2026-05-18 Round 03-04 修补牌数值复核

角色：第 3 轮专家 04，修补牌数值设计师  
工作目录：`/Users/roc/Game-001`  
范围：只复核 `blood_tithe`、`pulse_draw`、`wild_mana_stitch`、`wild_gap_key`、`paper_shatter`、`lantern_captain` 是否能承担坏手修补。  
源码边界：未修改源码。本文只提出 P0 牌池、数值、UI 文案和验收建议。

## 1. 一句话结论

P0 应开放 `blood_tithe` 和 `pulse_draw`，但只放进奖励 / 固定脚本修补池，不进起始牌组。当前 6 张修补牌已经覆盖三类坏手修补：0 费找牌、1 费续链找 2、Wild 补缺口、2 费找 payoff；问题不是缺牌，而是 `wild_mana_stitch` 过于万能、`paper_shatter / lantern_captain` 文案承诺了运行时还没有的重排。

P0 最小裁决：

- 开放 reserve-test：`blood_tithe`、`pulse_draw` 改为玩家可见的奖励候选。
- 首奖修补优先级：`pulse_draw` > `wild_gap_key` > `blood_tithe` > 调弱后的 `wild_mana_stitch`。
- `paper_shatter` 和 `lantern_captain` 不要同时作为首批默认修补选项；P0 只保留一个 2 费找 payoff 支援位。
- 数值只做微调：`wild_mana_stitch` 降低万能性，`wild_gap_key` 略提可感知伤害，其余先不动。

## 2. 当前事实基线

| 项 | 当前状态 | 设计含义 |
| --- | --- | --- |
| 起始牌组 | `debt_hook`、`heartbeat_spark`、`redline_cut`、`row_cleave` | 教学链清楚，但没有抽牌修补。 |
| `blood_tithe` | `0 MP / self / draw 1 / reserve-test` | 适合做 0 费找牌 opener，但现在玩家看不到。 |
| `pulse_draw` | `1 MP / self / draw 1 / reserve-test` | 已能承担 `0 -> pulse_draw -> 2` 的坏手桥接，但现在不进奖励池。 |
| Wild 规则 | 链已开始时，Wild 按当前 `nextExpectedCost` 计入链，并发 `ChainRepaired` | 机制方向正确，能清楚表达“补缺口”。 |
| 抽牌规则 | self draw 会按 `effectMultiplier` 放大 | 卡面写“抽1”，实际接在 0 后可能抽 2，接在 0-1 后可能抽 3。 |
| 当前 MP 规则 | `energyGain` 不吃倍率 | `wild_mana_stitch` 的返 MP 是固定 +1，不是 x2/x3。 |
| `paper_shatter / lantern_captain` | `utilities` 含 `reorder`，但测试明确不产生 reorder 事件 | UI 不能承诺“重排”，只能说“找牌 / 整备”。 |

## 3. 单卡复核

| 卡 | 能否承担坏手修补 | 当前问题 | P0 裁决 |
| --- | --- | --- | --- |
| `blood_tithe` | 能，负责“没有好 opener 或需要 0 费流动”的坏手。0 MP 不伤害，抽 1，作为低风险开链。 | 现在是 `reserve-test`，奖励池不可见；没有伤害，若放进起手会让首回合压力处理变慢。 | 开放为奖励候选，不进起始牌组。数值保持 `0 MP / 抽1 / 0伤害`。 |
| `pulse_draw` | 能，是 P0 最该开放的坏手修补牌。接在 0 后按当前规则可抽到下一段并保持 x2。 | 卡面若只写抽 1，会和实际倍率抽牌不一致；没有伤害，必须靠后续 2 费段兑现。 | 开放为早期奖励候选，修补优先级最高。数值保持 `1 MP / 抽1 / 0伤害`，但 UI 要说明续链抽牌会变强。 |
| `wild_mana_stitch` | 能，而且太能。它可 0 费补缺口、抽牌、返 MP；接在 0-1 后还能补 2、抽多张、给授权。 | 0 成本 + Wild + 抽牌倍率 + 返 MP 叠在一起，会变成“永远选它”，压掉 `pulse_draw` 和 `wild_gap_key` 的存在感。 | 继续保留为修补牌，但 P0 需降万能性。若只能做数据改动，建议先 `energyGain 1 -> 0`；若能做条件效果，则只在真实 `ChainRepaired` 时返 1 当前 MP。 |
| `wild_gap_key` | 能，是最干净的 Wild 修补：支付牌面 1 MP，低伤害，按缺口费用接链。 | `damage = 1` 反馈太弱，玩家可能感觉“花 1 费只为了日志”。 | 作为 P0 主 Wild 修补牌进入早期池。建议 `damage 1 -> 2`，仍低于正常 1 费攻击。 |
| `paper_shatter` | 部分能。它不修 0/1 缺口，但能在 `0 -> 1 -> 2` 位置找 payoff，承担“我完成授权但缺终结”的修补。 | 2 MP self draw 在正确链下会抽多张，强度足；`reorder` 暂无运行时，名字 `Paper Route` 也不像“打碎 / 整备”。 | P0 可保留一个 2 费找 payoff 位。数值不动，文案避免承诺重排。 |
| `lantern_captain` | 部分能，功能与 `paper_shatter` 几乎重复，更多像角色 / 支援风味牌。 | 同为 `2 MP / self / draw 1 / reorder tag`，若和 `paper_shatter` 同时出现，会让奖励选择像重复项。 | P0 不建议和 `paper_shatter` 同池同批展示。保留为替换皮肤或后续角色支援牌。 |

## 4. P0 建议卡池

### 4.1 起始牌组

保持不变：

```text
debt_hook
heartbeat_spark
redline_cut
row_cleave
```

理由：起手仍应先教会 `0 -> 1 -> 2` 和敌意图减压。把 `blood_tithe` 或 `pulse_draw` 塞进起手，会让第一回合从“我打掉压力”变成“我先抽牌找东西”，教学焦点变散。

### 4.2 P0 奖励候选池

建议按功能桶理解，而不是只按当前数组顺序：

| 桶 | P0 推荐牌 | 暂缓 / 限制 |
| --- | --- | --- |
| 修补 / 资源 | `pulse_draw`、`wild_gap_key`、`blood_tithe`、调弱后的 `wild_mana_stitch` | 未调弱的 `wild_mana_stitch` 不应作为首奖默认第一修补。 |
| payoff | `severance_burst`、`red_ledger_burst` | 保持 3 MP payoff，不用新增大牌解决坏手。 |
| 路线桥接 | `blood_reclaim`、`clearance_order`、`paper_shatter` | `lantern_captain` 先不和 `paper_shatter` 同时出现。 |

首奖推荐三选一模板：

```text
pulse_draw / severance_burst / blood_reclaim
```

第二批或固定坏手脚本可换成：

```text
wild_gap_key / red_ledger_burst / paper_shatter
```

如果必须展示 `wild_mana_stitch`，建议在已经确认玩家理解 `pulse_draw` 和 `wild_gap_key` 后出现，或者先执行数值降档。

## 5. 数值微调建议

| 卡 | 当前数值 | P0 建议 | 原因 |
| --- | ---: | ---: | --- |
| `blood_tithe` | `cost 0 / draw 1 / damage 0` | 不改 | 它是稳定性牌，不该同时提供伤害。 |
| `pulse_draw` | `cost 1 / draw 1 / damage 0` | 不改 | 接链后抽牌已被倍率放大，数值足够。 |
| `wild_mana_stitch` | `cost 0 / draw 1 / energyGain 1` | 首选：返 MP 只在 `ChainRepaired` 时触发；数据兜底：`energyGain 1 -> 0` | 防止 0 费万能牌同时补链、补手、补 MP。 |
| `wild_gap_key` | `cost 1 / damage 1` | `damage 2` | 让玩家看见它确实做了事，但仍明显弱于 `redline_cut`。 |
| `paper_shatter` | `cost 2 / draw 1` | 不改 | 正确链下抽牌会变强，主要问题是文案不是数值。 |
| `lantern_captain` | `cost 2 / draw 1` | 不改，但从首批默认池暂缓 | 与 `paper_shatter` 重复，P0 不需要两个同构 2 费自抽。 |

P0 不建议：

- 不给 `blood_tithe` 加伤害。
- 不给 `pulse_draw` 加返 MP。
- 不把 `wild_gap_key` 改成 0 费。
- 不同时开放两个 2 费 `reorder` 文案牌来假装路线丰富。

## 6. UI 文案建议

卡面只写即时规则，解释放进关键词 tooltip。当前最大 UI 风险是“抽 1”和实际倍率抽牌不一致，以及“整备 / reorder”被误读成真实重排。

| 卡 | 卡面主文案 | mobileEffect | tooltip / detail 方向 |
| --- | --- | --- | --- |
| `blood_tithe` | `抽1。开链。` | `抽1` | 0 MP 找下一段；不提高最大 MP。 |
| `pulse_draw` | `抽1。续链时抽牌变强。` | `抽1 续链+` | 抽牌受当前链倍率影响。 |
| `wild_mana_stitch` | `修补缺口。抽1。` | `修补 抽1` | 修补：视为当前缺口费用；返 MP 若保留，必须写“修补成功：当前 MP+1”。 |
| `wild_gap_key` | `造成2。修补缺口。` | `修补2` | 支付牌面 1 MP，但按缺口费用续链。 |
| `paper_shatter` | `抽1。找终结。` | `抽1 找终结` | “整备”只表示找牌；除非实现 reorder，不写重排。 |
| `lantern_captain` | `抽1。队长支援。` | `抽1 支援` | 作为角色支援风味，不和 Paper Route 同时教。 |

关键词 tooltip 建议：

```text
修补：这张牌视为当前缺口费用，保持费用链不断。
续链：按 0 -> 1 -> 2 顺序出牌时，倍率提高。
授权：完成 0 -> 1 -> 2 后，本回合获得 3 点 payoff-only MP。
整备：抽牌找下一段；当前版本不重排抽牌堆。
```

## 7. 验收

### 7.1 静态验收

- `blood_tithe`、`pulse_draw` 不再是玩家不可见的 reserve-test 死牌；至少能通过奖励或固定测试手牌出现。
- `startingHand` 仍保持 4 张教学牌，不把抽牌修补塞进第一手基础教学。
- P0 默认奖励三选一必须覆盖：1 张修补 / 资源、1 张 payoff、1 张路线桥接。
- 同一次奖励面板不同时出现 `paper_shatter` 和 `lantern_captain` 两张同构 2 费自抽。

### 7.2 Sim 路线验收

固定脚本至少覆盖以下路线：

```text
debt_hook -> pulse_draw -> row_cleave
```

预期：

- `pulse_draw` 成功抽到 2 费段。
- `pulse_draw.effectMultiplier = 2`。
- `row_cleave.effectMultiplier = 3`。
- 后续产生 `AuthorizationGranted`。

```text
debt_hook -> wild_gap_key -> row_cleave
```

预期：

- `wild_gap_key` 产生 `ChainRepaired`，`repairedCost = 1`。
- 总伤害低于 `debt_hook -> redline_cut -> row_cleave`，但链不断。
- 玩家能理解这是稳定性路线，不是最高伤害路线。

```text
debt_hook -> redline_cut -> paper_shatter -> severance_burst
```

预期：

- `paper_shatter` 能找出 payoff 或修补牌。
- payoff 若被打出，必须消费授权或明确记录 armed 来源。
- 不产生 `reorder` command/event，除非后续真的实现重排。

```text
debt_hook -> wild_mana_stitch -> row_cleave
```

预期：

- 修补成立，但不能同时表现为免费补链、抽多张、返 MP 的无脑最优解。
- 如果保留返 MP，验收必须证明返 MP 只来自修补成功，不是任意打出都给。

### 7.3 数值验收

- 正确攻击链仍然比修补链有更高即时减压。
- 修补链至少一次把坏手牌接回 `0 -> 1 -> 2`，并让玩家进入 payoff 决策。
- 未调弱的 `wild_mana_stitch` 如果在固定脚本中导致手牌暴涨或 MP 过剩，应视为未通过。
- `wild_gap_key damage = 2` 后仍不能替代正常 1 费攻击：接在 0 后不应单独击杀健康 10 HP 敌人。
- 3-5 回合固定样片内至少出现一次：断链风险、修补成功、payoff 授权、奖励回应。

### 7.4 UI 验收

- 卡面中文主效果在移动端不超过两行。
- `pulse_draw`、`paper_shatter` 的实际抽牌数量若被倍率放大，HUD 或日志必须能解释“续链抽牌变强”。
- `paper_shatter / lantern_captain` 在未实现重排前，不出现“重排抽牌堆”“选择牌库顶”等承诺。
- 修补成功时显示具体缺口，例如 `修补 1 MP` 或 `修补 2 MP`，不能只闪一个泛化 `Wild` 标签。

## 8. 最小交付清单

1. 开放 `blood_tithe`、`pulse_draw` 到 P0 奖励 / 固定脚本池。
2. 首奖修补位优先给 `pulse_draw`，不要默认先给未调弱的 `wild_mana_stitch`。
3. `wild_gap_key damage 1 -> 2`。
4. `wild_mana_stitch` 返 MP 改为修补成功条件；做不到条件效果时先移除 `energyGain`。
5. P0 默认只保留 `paper_shatter` 或 `lantern_captain` 之一作为 2 费找 payoff 支援。
6. UI 文案明确：抽牌会受续链倍率影响；整备暂不等于运行时重排。

STATUS: DONE  
路径：`/Users/roc/Game-001/design/technical/redline-batches/long-task/2026-05-18-round-03-04-repair-card-tuning.md`
