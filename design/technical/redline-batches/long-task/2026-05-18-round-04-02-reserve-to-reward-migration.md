# 2026-05-18 Round 04-02 Reserve 牌转正式奖励迁移设计

角色：第 4 轮专家 02，Reserve 牌转正式奖励迁移设计师  
工作目录：`/Users/roc/Game-001`  
范围：只读源码和前轮设计文档，评估 `blood_tithe`、`pulse_draw` 从 `reserve-test` 开放为 `reward` 的机制影响、奖励池位置、UI 文案和测试风险。  
边界：本文不修改源码，不提交 git。

## 0. 裁决

`blood_tithe` 和 `pulse_draw` 可以进入 P0 正式奖励迁移，但前提不是“把 availability 改成 reward 后追加到池尾”。安全迁移必须同时满足 4 件事：

1. 先锁住 reward 分支合同，让两张 self draw 修补牌稳定归入 `repair-resource`，不会因为 `availability: reward` 后被 `chainRole: starter/bridge` 推成纯 `route-bridge`。
2. 再把两张牌从 `reserve-test` 转成玩家可见的奖励牌。
3. 放在奖励池的修补后备位，而不是起始牌组、不是 payoff 位，也不是首轮 route 槽。
4. 同步最小 UI 文案和测试，尤其解释 `pulse_draw` 接在 0 费后实际会按倍率抽 2。

若 P0 实施预算不足，优先开放 `blood_tithe`，`pulse_draw` 可作为同批可选项；但如果开放 `pulse_draw`，测试必须覆盖倍率抽牌和 HUD 文案，否则推迟到 P1。

## 1. 当前源码事实

### 1.1 两张 reserve 牌

`prototype-web/src/data/cards.ts` 当前定义：

| 卡 | 当前状态 | 机制事实 | 设计含义 |
| --- | --- | --- | --- |
| `blood_tithe` | `0 MP / self / draw 1 / chainRole=starter / availability=reserve-test` | 0 费开链，自身抽 1，不造成伤害，不提高 Max MP。 | 适合做“手牌流动 / 找 1 或 2 费段”的低风险修补奖励。 |
| `pulse_draw` | `1 MP / self / draw 1 / chainRole=bridge / availability=reserve-test` | 接在 0 费后会以 `effectMultiplier=2` 结算，实际抽 2。 | 适合做“0 -> 抽牌桥接 -> 找 2 费或 payoff”的坏手修补奖励。 |

两张牌现在不是空概念。`runtime.test.ts` 已有 `pulse_draw` 接 0 费抽多张的覆盖，也有 `blood_tithe` 空抽牌堆时不把刚打出的自己立刻洗回来的覆盖；`redline-hyperturn-acceptance.test.ts` 已用 `debt_hook -> pulse_draw -> row_cleave` 验证抽牌桥接。

### 1.2 奖励选择器

`prototype-web/src/sim/rewardChoices.ts` 当前按固定优先级补齐三分支：

```text
repair-resource -> payoff -> route-bridge
```

当前 fallback 集合已经把 `blood_tithe` 和 `pulse_draw` 写进 `repair-resource`，但这是因为两张牌仍是 `availability: reserve-test`，route 推导被挡住。风险在于：一旦只把 `availability` 改为 `reward`，它们会因为 `chainRole: starter/bridge`、`cycleRole: draw-fixer` 或 `buildRole` 推导进入 `route-bridge`，而 `rewardBranchesForCard` 只在元数据推导为空时才走 fallback。

所以 P0 不能只改数据。必须先让 draw-fixer 修补牌在正式 reward 状态下仍稳定命中 `repair-resource`。

### 1.3 奖励入牌反馈

当前第 3 轮已把奖励节奏修到可用状态：

- `INITIAL_REWARD_XP_THRESHOLD = 12`，首奖能进入短 demo 窗口。
- 非终局 `select-reward` 会先 `AddCardToDeck`，再推进回合和 `DealHand`。
- `AddCardToDeck` 会把奖励牌放到 `drawPile` 顶部，因此选中的奖励牌会进入下一手。

这对 reserve 牌迁移是好事：`blood_tithe` / `pulse_draw` 一旦成为 reward，被选中后能立刻参与下一轮决策，不会延迟一轮才看到。

## 2. 机制影响

### 2.1 `blood_tithe`

正面影响：

- 0 MP self draw 能作为开链牌，不消耗当前 MP，适合救“有 1/2 费段但缺流动”的手牌。
- 不提供伤害、不返 MP、不 Wild，强度边界清楚，不会替代 `wild_mana_stitch` 的修补身份。
- 比纯 0 费攻击更明确地告诉玩家：奖励不只加伤害，也可以补稳定性。

风险：

- 因为没有伤害，它不能解决敌意图；UI 若把它表现成“减压牌”会误导。
- 若放进起始牌组，会让第一回合从“读意图并打出 0 -> 1 -> 2”变成“先抽牌找东西”，教学焦点变散。
- 0 费抽牌在奖励池里过早过密，会提高循环稳定性，但当前只有单张且不返费，P0 风险可控。

P0 结论：可以开放为 reward，定位为 `repair-resource` 后备。数值不改。

### 2.2 `pulse_draw`

正面影响：

- 它是当前最直接的“抽牌桥接”切片：`debt_hook -> pulse_draw -> row_cleave` 已能验证缺 2 时被抽回路线。
- 接在 0 费后抽牌被倍率放大为 2，确实能救“缺 2 / 缺 payoff”的坏手。
- 它牺牲 1 费伤害，和 `redline_cut`、`heartbeat_spark` 有清楚取舍：稳定性换即时减压。

风险：

- 卡面若只写“抽1”，而实战接链抽 2，会造成规则读法不一致。
- 如果被放到首轮 route 槽，玩家会把它理解成路线攻击桥，而不是修补牌；这会削弱三选一里的“补路线”清晰度。
- 它没有伤害，若奖励面板连续给 self draw，会让下一手变成找牌循环，敌意图压力反馈下降。

P0 结论：可以开放为 reward，但只在“分支合同 + 倍率文案 + 倍率测试”同批完成时开放。若只能做最小一张，`pulse_draw` 延后到 P1，先开 `blood_tithe`。

## 3. P0 可做

### 3.1 分支合同先行

P0 必须先解决分支漂移。可接受两种方案，二选一即可：

| 方案 | P0 判断 | 说明 |
| --- | --- | --- |
| A. 显式 reward 分支字段 | 更清楚，但需要扩 `CardDefinition` 类型和 `rewardBranchesForCard` 的优先级。 | `rewardBranches: ['repair-resource']` 应优先于自动推导，避免 starter/bridge 把它们推成 route。 |
| B. 扩展推导规则 | 改动较小，适合当前原型。 | `cardType === 'draw' && cycleRole === 'draw-fixer' && targets === 'self'` 应加入 `repair-resource`；是否兼任 route 由池顺序控制。 |

P0 推荐方案 B。理由是当前牌表已经用 `cardType/cycleRole/targets/utilities` 表达了修补身份，不需要为了两张牌立刻引入新字段。

### 3.2 卡牌状态迁移

P0 数据目标：

| 卡 | `buildRole` | `availability` | 数值 |
| --- | --- | --- | --- |
| `blood_tithe` | `draw-fixer` | `reward` | 不改，仍是 `0 MP / draw 1 / damage 0`。 |
| `pulse_draw` | `draw-fixer` | `reward` | 不改，仍是 `1 MP / draw 1 / damage 0`，但承认倍率抽牌。 |

不建议保留 `buildRole: reserve-test` 同时改 `availability: reward`。这会让数据读法互相打架：UI、测试和后续策划都会不清楚它到底是正式牌还是保留测试牌。

### 3.3 奖励池位置

P0 的池位置不是“首奖主角”，而是“修补后备”。建议把两张牌放在 `wild_gap_key` 之后、2 费 draw-fixer 之前：

```text
wild_mana_stitch
severance_burst
wild_gap_key
blood_tithe
pulse_draw
paper_shatter
lantern_captain
red_ledger_burst
spark_tap
blood_reclaim
heartbeat_spark
verdict_mark
clearance_order
```

这是一种最小迁移顺序，不是最终平衡顺序。它的目的：

- 首轮 repair 仍先看到 `wild_mana_stitch`，不突然把体验切成抽牌教学。
- 第二层 repair 是 `wild_gap_key`，玩家先理解 Wild 修补。
- `blood_tithe` / `pulse_draw` 作为 repair 后备，解决 Wild 被拿走后的修补枯竭。
- `paper_shatter` / `lantern_captain` 仍后置，避免同一批奖励全是 self draw。

如果 P0 同时愿意修正首轮 route 槽，可以把 `spark_tap` 前移到 `paper_shatter` 前。但这属于奖励池排序优化，不是 reserve 迁移必需项；默认放 P1，避免本批范围扩散。

### 3.4 UI 最小文案

P0 只改能避免误解的短文案，不做 HUD 大改。

| 卡 | Reward reason | `rulesText` 建议 | `mobileEffect` 建议 | Tooltip/detail 重点 |
| --- | --- | --- | --- | --- |
| `blood_tithe` | `补流动` | `抽1。开链找牌。` | `抽1开链` | 0 MP 找下一段；不造成伤害；不提高最大 MP。 |
| `pulse_draw` | `找2费` | `抽1。续链抽牌+。` | `抽1续链+` | 抽牌会受当前费用链倍率影响；接在 0 费后通常抽 2。 |

HUD 原则：

- self draw 牌不显示虚假的敌意图下降；继续使用或细化 `抽牌找解`。
- 移动端 reward card 只显示 `reason + name + rulesText`，不要把 `detail` 常驻塞进卡面。
- `pulse_draw` 的“抽1”必须和“续链抽牌+”同时出现，否则玩家会以为抽 2 是 bug。

## 4. P1 延后

以下不进入 P0：

1. 不把 `pulse_draw` 提升为首奖第一修补位。它的倍率抽牌强度需要更多实际样片，不应抢掉 Wild 修补的教学位置。
2. 不把两张牌做成 `route-bridge` 主轴。它们可以在概念上兼任路线稳定性，但 P0 reward reason 先按 `repair-resource` 表达。
3. 不重排整个 `rewardCardPool` 到最终形态。`spark_tap` 前移、`red_ledger_burst` 与 `severance_burst` 的顺序、`paper_shatter/lantern_captain` 去重都可以后续做。
4. 不改 `wild_mana_stitch` 的返 MP 规则。它确实偏万能，但这是修补牌数值批次，不应和 reserve 迁移混在一个实现批。
5. 不做动态奖励 reason 追踪上一回合问题，例如“你刚才缺 MP2，所以推荐 pulse_draw”。P1 可以做，P0 只要静态 reason 不误导。
6. 不做抽牌堆可视化、选择牌库顶、重排牌库等 UI。当前 `reorder` 仍只是标签，不能顺手扩系统。
7. 不把奖励牌变成局外永久解锁或永久起手牌。当前 run/meta 边界必须保持。

## 5. 为什么不进入起始牌组

`startingHand` 当前是：

```text
debt_hook
heartbeat_spark
redline_cut
row_cleave
```

它承担的是第一回合教学：读敌意图、选目标、打出 0/1/2 段、获得本回合 payoff 授权。`blood_tithe` 和 `pulse_draw` 不应进入起始牌组，原因如下：

1. 两张牌都是 self draw、0 伤害。放进起手会降低第一回合减压反馈，让玩家先学“抽牌找牌”，而不是先理解敌意图和费用链。
2. `pulse_draw` 的价值依赖已经打出 0 费后倍率抽牌。新玩家第一手看到它，容易把“抽 1 / 抽 2”的差异理解成不稳定规则。
3. 奖励循环需要一个可感知的前后差异：基础牌组先暴露问题，升级奖励再回应问题。若抽牌修补从起手就存在，奖励选择的价值会变弱。
4. 起始牌组是 run baseline，restart 后应回到干净状态；`blood_tithe` / `pulse_draw` 的身份是当前 run 内构筑奖励，不是默认身份或局外成长。
5. 第一手已经有 `debt_hook`、`heartbeat_spark`、`redline_cut`、`row_cleave`，能展示 0 -> 1 -> 2。此时加抽牌修补不是补缺口，而是增加教学噪音。

## 6. 测试风险与验收

### 6.1 P0 必补测试

| 测试方向 | 验收点 |
| --- | --- |
| 卡牌 taxonomy | `blood_tithe`、`pulse_draw` 不再是 `reserve-test`；`buildRole=draw-fixer`、`availability=reward` 均合法。 |
| 奖励池合法性 | `rewardCardPool` 不包含任何 `availability: reserve-test` 的牌。 |
| 分支矩阵 | 两张牌在 `availability=reward` 后仍命中 `repair-resource`；不会漂移成纯 `route-bridge`。 |
| 默认三选一 | P0 池顺序下仍覆盖 `repair-resource / payoff / route-bridge`，且不是简单取前三张。 |
| repair 后备 | 选走 `wild_mana_stitch` 和 `wild_gap_key` 后，后续 reward 仍能由 `blood_tithe` 或 `pulse_draw` 补 repair。 |
| `pulse_draw` 倍率 | `debt_hook -> pulse_draw` 时 `effectMultiplier=2`，抽牌数量符合当前设计认可。 |
| `blood_tithe` 空抽 | 空 drawPile/discardPile 时不会立刻把刚打出的 `blood_tithe` 洗回手牌。 |
| reward 下一手 | 选择 `blood_tithe` 或 `pulse_draw` 后，非终局路径下一手能看到所选奖励。 |
| run/meta 边界 | restart 后两张 reward 牌不留在基础 deck，不改变 `maxEnergy`。 |
| HUD self preview | 两张 self draw 不显示敌意图降低；显示 `抽牌找解` 或更具体的 `抽1找MPx`。 |

### 6.2 易碎点

- `reward-branching.test.ts` 当前 `REPAIR_OR_RESOURCE` 只列了 `wild_gap_key`、`wild_mana_stitch`、`blood_tithe`，若正式开放 `pulse_draw`，测试集合应补上它。
- `card-taxonomy.test.ts` 当前允许 `reserve-test`，但没有检查 reward 池不得含 reserve 牌。P0 应新增这个保护。
- `rewardBranchesForCard` 当前 fallback 不会在元数据推导非空时执行。若没有测试锁住，`availability` 改动会产生静默分支漂移。
- `pulse_draw` 的 UI 文案和真实抽牌数量不一致时，玩家会把倍率系统当成随机抽牌 bug。
- 如果池排序同时大改 payoff 和 route，失败时很难判断是 reserve 迁移的问题，还是奖励池平衡问题。P0 应限制排序范围。

## 7. 推荐落地顺序

1. 先写分支矩阵和 reward 池合法性测试，模拟 `blood_tithe` / `pulse_draw` 已是 reward 的状态。
2. 修改 reward 分支推导，让 self draw-fixer 稳定属于 `repair-resource`。
3. 修改两张牌的 `buildRole` / `availability`，不改数值。
4. 把两张牌插入 reward 池的修补后备位。
5. 改最小 UI 文案，尤其 `pulse_draw` 的 `续链抽牌+`。
6. 跑定向测试：`card-taxonomy`、`reward-branching`、`progression-reward-regression`、`run-layer-boundary`、`runtime` 或包含 draw-fixer 的定向用例。

## 8. 最终结论

P0 可做：

- `blood_tithe` 正式开放为 reward。
- `pulse_draw` 正式开放为 reward，但必须绑定倍率文案和测试。
- 两张牌定位为 `repair-resource` 后备，不进起始牌组。
- 数值不改，不给伤害、不返 MP、不做局外成长。

P1 延后：

- 全量 reward 池重排。
- `pulse_draw` 作为首奖核心修补。
- draw-fixer 双标签路线化。
- `wild_mana_stitch` 降档。
- 动态 reward reason 和抽牌堆可视化。

STATUS: DONE
