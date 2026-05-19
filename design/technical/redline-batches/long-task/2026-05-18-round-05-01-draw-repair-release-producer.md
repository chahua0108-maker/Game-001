# 2026-05-18 Round 05-01 抽牌修补牌开放制作人

角色：第 5 轮专家 01，抽牌修补牌开放制作人  
工作目录：`/Users/roc/Game-001`  
范围：只读源码、第 3/4 轮 long-task 文档；本文只新增本裁决文档，不修改源码，不提交 git。

## 0. 唯一落地建议

本轮应同时开放 `blood_tithe` 和 `pulse_draw`，不采用只开一张。

唯一落地口径：

```text
blood_tithe: reserve-test -> reward
pulse_draw: reserve-test -> reward
定位：抽牌修补后备，不进起始牌组，不抢首奖 route 槽，不改数值。
```

这不是“扩大完整卡牌系统”的批次，而是第 4 轮 `rewardBranches` 显式合同之后的玩家可见内容批次。第 4 轮已经把两张牌的未来分支身份锁住：`blood_tithe` 是 `repair-resource`，`pulse_draw` 是 `repair-resource + route-bridge`。现在继续只开一张，会留下一个半成品修补层：只开 `blood_tithe` 没有 1 MP 抽牌桥接；只开 `pulse_draw` 又缺少低风险 0 MP 开链找牌。两张一起开，但放在后备位，风险更清楚、测试也更完整。

## 1. 当前事实基线

### 1.1 源码事实

- `prototype-web/src/data/cards.ts` 中，`blood_tithe` 当前是 `0 MP / self / draw 1 / availability: reserve-test / rewardBranches: ['repair-resource']`。
- `pulse_draw` 当前是 `1 MP / self / draw 1 / availability: reserve-test / rewardBranches: ['repair-resource', 'route-bridge']`。
- 当前 `rewardCardPool` 不包含这两张牌。
- `prototype-web/src/sim/types.ts` 已有 `RewardBranch`，`CardDefinition` 已有可选 `rewardBranches`。
- `prototype-web/src/sim/rewardChoices.ts` 已优先读取显式 `rewardBranches`，所以两张牌开放为 `reward` 后不再依赖 `availability` 或 `chainRole` 推导。
- `card-taxonomy.test.ts` 已有“reward pool 不含 reserve-test”的保护，并断言两张 reserve 牌的 `rewardBranches`。
- `reward-branching.test.ts` 已覆盖：把 `blood_tithe` / `pulse_draw` 克隆成 `availability: reward` 后，显式分支仍优先于角色和可见性推导。
- `redlineRules.ts` 的 self resource 规则会按 `drawCards * effectMultiplier` 触发抽牌，因此 `pulse_draw` 接在 0 MP 后实际请求抽 2。
- `redline-hyperturn-acceptance.test.ts` 已有 `debt_hook -> pulse_draw -> row_cleave` 的抽牌桥接切片。

### 1.2 第 3/4 轮结论

- 第 3 轮裁决：当轮不开放 `blood_tithe / pulse_draw`，先落奖励节奏和“奖励进入下一手”。
- 第 4 轮裁决：当轮不开放两张牌，先落 `rewardBranches` 显式合同，防止开放后分支漂移。
- 第 4 轮后进入第 5 轮的问题就是：是否把两张抽牌修补牌从 `reserve-test` 开放为玩家可见 `reward`。

第 5 轮的前置条件已经满足：奖励节奏可用，分支合同已显式化，测试已有基础护栏。剩下的核心风险不是“能不能开”，而是“开了以后不要让 `pulse_draw` 的双分支和倍率抽牌误导玩家”。

## 2. 为什么两张都开

### 2.1 `blood_tithe` 的职责

`blood_tithe` 是低风险开放牌：

- 0 MP self draw，适合做开链找 1/2 MP 段。
- 不伤害、不返 MP、不 Wild，不会压掉 `wild_mana_stitch` 或 `wild_gap_key` 的修补身份。
- 真实抽牌通常就是 x1 抽 1，UI 解释成本低。
- 作为奖励牌能明确告诉玩家：奖励不只是更高伤害，也可以补手牌流动。

只开它的问题是：本轮会缺少“0 -> 1 MP 抽牌桥接 -> 找 2 MP”的可见奖励闭环。

### 2.2 `pulse_draw` 的职责

`pulse_draw` 是本轮真正需要制作人裁决的风险牌：

- 它能承担 `debt_hook -> pulse_draw -> row_cleave` 的坏手桥接。
- 它牺牲 1 MP 伤害，换取抽牌稳定性，和 `redline_cut / heartbeat_spark` 有清楚取舍。
- 它接在 0 MP 后会因为倍率请求抽 2，这是强度和 UX 风险的来源。

结论是：这个风险应该本轮解决，而不是继续留在 reserve。只要不把它放到首奖 route 槽，并把 `抽1` 与当前态 `抽2` 的展示锁住，它就是合格的 reward 后备牌。

## 3. 落地规格

### 3.1 卡牌数据

本轮只做身份迁移，不改数值：

| 卡 | `buildRole` | `availability` | `rewardBranches` | 数值 |
| --- | --- | --- | --- | --- |
| `blood_tithe` | `draw-fixer` | `reward` | `['repair-resource']` | 保持 `cost 0 / damage 0 / drawCards 1` |
| `pulse_draw` | `draw-fixer` | `reward` | `['repair-resource', 'route-bridge']` | 保持 `cost 1 / damage 0 / drawCards 1` |

不保留 `buildRole: reserve-test` 搭配 `availability: reward` 的混合状态。开放后它们就是正式抽牌修补奖励牌。

### 3.2 奖励池顺序

开放两张牌时必须同步给出明确卡池位置，否则 `pulse_draw` 的双分支可能抢走首奖 route 槽。建议本轮采用以下顺序：

```ts
export const rewardCardPool: string[] = [
  'wild_gap_key',
  'red_ledger_burst',
  'spark_tap',
  'wild_mana_stitch',
  'severance_burst',
  'verdict_mark',
  'blood_tithe',
  'pulse_draw',
  'blood_reclaim',
  'clearance_order',
  'paper_shatter',
  'lantern_captain',
  'heartbeat_spark'
];
```

这个顺序的目的：

- 首奖仍是清楚的三分支：`wild_gap_key / red_ledger_burst / spark_tap`。
- `blood_tithe` 和 `pulse_draw` 不抢首奖主角，只在 Wild 修补被选走后接上 repair 后备。
- `pulse_draw` 虽然有 `route-bridge`，但排在 `spark_tap / verdict_mark / blood_reclaim / clearance_order` 之后，不作为第一眼路线牌。
- `paper_shatter / lantern_captain` 后置，避免首轮 route 变成 2 MP self draw 支援。

### 3.3 文案与 HUD 下限

`blood_tithe` 可保持短文案为 `抽1。开链找牌。` 或收短为 `抽1。开链。`。

`pulse_draw` 必须让玩家知道正确接链时会抽 2。最低要求：

- 卡面规则：`抽1。接链抽2。` 或等价短句。
- 移动短效：`抽1续链+` 或由 HUD 当前态直接显示 `抽2找MP2`。
- Tooltip/detail：说明“基础抽 1；接在 0 MP 后当前倍率 x2，所以请求抽 2。牌堆不足时只抽到可用牌。”

不要把这件事写成长教学句塞进卡面。动态 HUD 或日志应优先显示当前真实请求/实际入手，例如 `接x2 抽2`、`x2 抽到2`。

## 4. 风险

| 风险 | 影响 | 处理 |
| --- | --- | --- |
| `pulse_draw` 卡面写抽 1，但正确接链实际抽 2 | 玩家会以为抽牌随机或卡面欺骗。 | 本轮开放必须绑定 `pulse_draw` 倍率文案和测试；正确接链时可见 `抽2`。 |
| 两张 self draw 都是 0 伤害 | 奖励池抽牌密度提高后，玩家可能牺牲敌意图减压。 | 两张只做后备，不进起手，不抢首奖；不加伤害、不返 MP。 |
| `pulse_draw` 双分支抢 route | 首奖 route 可能变成“抽牌找解”，不再是直接路线入口。 | 用上面的 `rewardCardPool` 顺序保证首奖 route 是 `spark_tap`。 |
| `wild_mana_stitch` 仍然过强 | 第二层修补可能仍被它压成自动选择。 | 本轮不解决数值；只通过排序让第一眼修补先看 `wild_gap_key`，`wild_mana_stitch` 留作后备。 |
| 打开两张后 reward pool 从 11 张变 13 张 | 后续奖励节奏和分支耗尽路径改变。 | 用定向测试锁默认三选一、Wild 被移除后的 repair 后备、restart 后清空。 |
| 当前工作树有并行未提交改动 | 实现时容易覆盖其他 agent 的卡牌、HUD、测试改动。 | 实现批次只局部改 `cards.ts`、必要 HUD 文案和相关测试；不重写现有模块。 |

## 5. 测试要求

本轮实现必须补或更新以下测试；否则不应合入开放代码。

### 5.1 静态合同

- `rewardCardPool` 包含 `blood_tithe` 和 `pulse_draw`。
- `rewardCardPool` 内没有任何 `availability: reserve-test`。
- `cards.blood_tithe.availability === 'reward'`。
- `cards.pulse_draw.availability === 'reward'`。
- 两张牌 `buildRole === 'draw-fixer'`。
- 两张牌仍是 `targets: 'self'`、`cardType: 'draw'`、`drawCards: 1`、`damage: 0`。
- `blood_tithe` 分支精确包含 `repair-resource`，不包含 `payoff`。
- `pulse_draw` 分支包含 `repair-resource`，可以同时包含 `route-bridge`，不包含 `payoff`。

### 5.2 奖励选择

- 默认 `buildRewardChoices(rewardCardPool, 3, cards)` 精确得到：

```text
wild_gap_key
red_ledger_burst
spark_tap
```

- 三张分别命中 `repair-resource / payoff / route-bridge`。
- 移除 `wild_gap_key` 后，下一次仍有 `wild_mana_stitch` 作为 repair。
- 同时移除 `wild_gap_key` 和 `wild_mana_stitch` 后，下一次 repair 应由 `blood_tithe` 或 `pulse_draw` 补上，优先 `blood_tithe`。
- `pulse_draw` 不应成为默认第一张 route offer。

### 5.3 运行时与 run/meta 边界

- 选择 `blood_tithe` 后，非终局 reward 流程把它加入当前 run deck，并进入下一手可操作资源。
- 选择 `pulse_draw` 后，同样进入下一手。
- 两张牌都不改变 `maxEnergy`，restart 后都不残留在基础 deck。
- `blood_tithe` 首张出牌时 `effectMultiplier = 1`，请求 `DrawCards.count = 1`。
- `blood_tithe` 在空 draw/discard 时不会立刻抽回刚打出的自己。
- `debt_hook -> pulse_draw` 时 `pulse_draw.effectMultiplier = 2`，请求 `DrawCards.count = 2`，实际 `HandDealt.cardIds.length <= 2`。
- `debt_hook -> pulse_draw -> row_cleave` 仍能让 `row_cleave.effectMultiplier = 3`。

### 5.4 HUD / 文案

如果本轮改 HUD：

- 正确接链时 `pulse_draw` 可见 `抽2` 或 `抽2找MP2`，不能只显示 `抽1` / `抽牌找解`。
- 断链时 `pulse_draw` 回到 `抽1`，不沿用上一次倍率。
- self draw 牌不显示虚假的敌意图下降。
- 移动端 360x640 与 390x844 下，`抽2找MP2`、`抽1开链` 等短句不重叠、不超框。

建议定向命令：

```bash
cd prototype-web
npm test -- src/tests/sim/card-taxonomy.test.ts src/tests/sim/reward-branching.test.ts src/tests/sim/progression-reward-regression.test.ts src/tests/sim/run-layer-boundary.test.ts src/tests/sim/redline-hyperturn-acceptance.test.ts src/tests/sim/runtime-audit.test.ts
npm test -- --run
```

若改 HUD 或卡面渲染，再跑相关 UI 测试，并做桌面/移动浏览器截图复核。

## 6. 本轮不做项

- 不把 `blood_tithe` 或 `pulse_draw` 加入 `startingHand`。
- 不只改 `availability` 而保留 `buildRole: reserve-test`。
- 不给 `blood_tithe` 加伤害、返 MP、Wild 或 payoff 身份。
- 不给 `pulse_draw` 加伤害、返 MP、Wild 或首奖主角待遇。
- 不把 `pulse_draw` 作为第一张 route offer。
- 不重做完整奖励权重、reroll、seen history 或动态推荐系统。
- 不改 `wild_mana_stitch` 条件返 MP。
- 不改 `wild_gap_key` 伤害。
- 不实现 `reorder`、选择牌库顶、抽牌堆可视化。
- 不做消耗、保留、状态、诅咒、CardInstance、升级、触发器或遗物系统。
- 不做局外永久解锁、永久 Max MP、账号存档或 meta progression。
- 不做 HUD/CSS 大改；只允许为 `pulse_draw` 倍率抽牌做必要短文案和不超框验证。

## 7. 制作人最终裁决

第 5 轮应该把 `blood_tithe` 和 `pulse_draw` 两张一起从 `reserve-test` 开放为 `reward`。两张牌解决的是同一层抽牌修补体验：`blood_tithe` 负责 0 MP 开链找牌，`pulse_draw` 负责 1 MP 接链找 2 MP / payoff。第 4 轮已完成分支合同，本轮继续只开一张会让抽牌修补层残缺。

但开放必须是“受控开放”：两张都只做 reward 后备，不进起手，不改数值，不抢首奖 route；`pulse_draw` 的倍率抽牌必须用文案和测试讲清楚。

STATUS: DONE
