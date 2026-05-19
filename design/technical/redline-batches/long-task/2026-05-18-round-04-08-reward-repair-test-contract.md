# 2026-05-18 Round 04-08 奖励与修补测试合同

角色：第 4 轮专家 08，奖励与修补测试合同工程师  
工作目录：`/Users/roc/Game-001`  
输出边界：只读源码和既有设计文档；本文只新增测试合同文档，不修改源码，不提交 git。  

## 0. 结论

如果本轮开放 `blood_tithe` / `pulse_draw`，同时调整 `rewardBranches` 与 `rewardCardPool`，Vitest 必须先锁住 5 个合同面：

1. `rewardCardPool` 只能包含玩家可见奖励牌，不能混入 `availability: reserve-test`。
2. `blood_tithe` / `pulse_draw` 开放后仍必须命中 `repair-resource`，不能因为 `chainRole: starter/bridge` 漂移成纯 `route-bridge`。
3. 默认奖励三选一必须稳定呈现 `repair-resource -> payoff -> route-bridge`，且 route 槽优先直接费用段，不被 2 费 self draw 支援牌抢走。
4. 两张新开放抽牌修补牌被选中后，必须进入当前 run 的下一手可操作资源，不改变 `maxEnergy`，restart 后清空。
5. 两张牌在坏手脚本中必须真的修补体验：`blood_tithe` 找 1 费段，`pulse_draw` 找 2 费段 / payoff，且事件可观测。

以下合同都使用 Vitest node 环境，不需要 Playwright、DOM 或随机局模拟。

## 1. 当前源码事实

当前 `prototype-web/src/data/cards.ts` 中：

- `blood_tithe`：`cost = 0`，`targets = self`，`cardType = draw`，`chainRole = starter`，`cycleRole = draw-fixer`，`availability = reserve-test`，`drawCards = 1`。
- `pulse_draw`：`cost = 1`，`targets = self`，`cardType = draw`，`chainRole = bridge`，`cycleRole = draw-fixer`，`availability = reserve-test`，`drawCards = 1`。
- `rewardCardPool` 当前不包含这两张牌。

当前 `prototype-web/src/sim/rewardChoices.ts` 中：

- 分支优先级是 `repair-resource -> payoff -> route-bridge`。
- fallback 已把 `blood_tithe` / `pulse_draw` 放进 `repair-resource`。
- 但 `rewardBranchesForCard` 会先读字段推导；如果只把 `availability` 改成 `reward`，它们可能因为 `chainRole` 命中 `route-bridge`，不再走 fallback。

所以测试必须防止“开放卡牌”与“分支语义”脱节。

## 2. P0 合同一：奖励池可见性与内容状态

测试文件：`prototype-web/src/tests/sim/card-taxonomy.test.ts`

### 修改既有测试

测试名称：`keeps the reward card pool backed by real player-facing card definitions`

Given：

- `rewardCardPool` 已经纳入本轮开放后的正式奖励池。
- `blood_tithe` 与 `pulse_draw` 如果出现在 `rewardCardPool`，其卡牌定义也必须同步开放。

When：

- 遍历 `rewardCardPool`，从 `cards` 查找每个 `cardId`。
- 收集缺失定义和 `availability === 'reserve-test'` 的奖励池卡牌。

Then：

- `missingRewardCards` 等于 `[]`。
- `reservedRewardCards` 等于 `[]`。
- `rewardCardPool` 包含 `blood_tithe` 与 `pulse_draw`。
- `cards.blood_tithe.availability` 是 `reward` 或 `starting-and-reward`，P0 推荐 `reward`。
- `cards.pulse_draw.availability` 是 `reward` 或 `starting-and-reward`，P0 推荐 `reward`。
- `rewardCardPool` 不包含 `debt_hook`、`redline_cut`、`row_cleave` 这类仍由起手教学承担的基础牌。

### 新增测试

测试名称：`keeps opened draw repair rewards classified as draw-fixers, not payoff or basic attack`

Given：

- `cards.blood_tithe` 与 `cards.pulse_draw` 已从 `reserve-test` 开放。

When：

- 读取两张牌的 `cardType`、`targets`、`drawCards`、`cycleRole`、`utilities`、`damage`。

Then：

- 两张牌的 `targets` 都是 `self`。
- 两张牌的 `cardType` 都是 `draw`。
- 两张牌的 `cycleRole` 都是 `draw-fixer`。
- 两张牌的 `drawCards` 都是 `1`。
- 两张牌都不能是 `payoff`、`finisher`、`payoff-finisher`。
- 两张牌的 `damage` 都是 `0`，避免奖励池开放时被误当作攻击路线牌。

## 3. P0 合同二：rewardBranches 稳定性

测试文件：`prototype-web/src/tests/sim/reward-branching.test.ts`

### 修改既有常量

现有 `REPAIR_OR_RESOURCE` 至少应包含：

```text
wild_gap_key
wild_mana_stitch
blood_tithe
pulse_draw
```

但后续更推荐直接用 `rewardBranchesForCard(cards[id])` 判断分支，不再维护测试内的重复分类集合。

### 新增测试

测试名称：`classifies opened blood_tithe and pulse_draw as repair/resource instead of pure route cards`

Given：

- `blood_tithe` 与 `pulse_draw` 已经是正式奖励牌。
- 实现可以选择显式 `rewardBranches` 字段，也可以扩展 draw-fixer 推导规则。

When：

- 调用 `rewardBranchesForCard(cards.blood_tithe)`。
- 调用 `rewardBranchesForCard(cards.pulse_draw)`。

Then：

- `blood_tithe` 的分支必须包含 `repair-resource`。
- `pulse_draw` 的分支必须包含 `repair-resource`。
- 两者都不能只返回 `route-bridge`。
- `pulse_draw` 可以同时包含 `route-bridge`，但不能丢掉 `repair-resource`。
- 两者都不能包含 `payoff`。

测试失败要指向这个具体风险：只改 `availability` 后，`chainRole: starter/bridge` 把抽牌修补牌挤到纯路线分支。

## 4. P0 合同三：默认奖励三选一和卡池排序

测试文件：`prototype-web/src/tests/sim/reward-branching.test.ts`

### 新增测试

测试名称：`keeps default reward offers in repair payoff route order after rewardCardPool reorder`

Given：

- 本轮采用调整后的 `rewardCardPool`。
- 推荐首段顺序为：

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

When：

- 使用 `buildRewardChoices(rewardCardPool, 3, cards)`。

Then：

- `choices` 精确等于：

```text
wild_mana_stitch
red_ledger_burst
spark_tap
```

- 第一张命中 `repair-resource`。
- 第二张命中 `payoff`。
- 第三张命中 `route-bridge`。
- 第三张不能是 `paper_shatter` 或 `lantern_captain`，因为它们是 self draw 支援，不应该抢首轮最直观 route 槽。
- `choices` 不能等于 `rewardCardPool.slice(0, 3)` 的无分支解释；即使数值刚好一样，也要额外断言每个槽位的分支。

### 新增测试

测试名称：`keeps repair branch available after both wild repair cards are removed from the pool`

Given：

- 模拟玩家已经拿走 `wild_mana_stitch` 与 `wild_gap_key`。
- `candidateCardPool` 固定为：

```text
blood_tithe
pulse_draw
red_ledger_burst
spark_tap
paper_shatter
```

When：

- 调用 `buildRewardChoices(candidateCardPool, 3, cards)`。

Then：

- `choices[0]` 是 `blood_tithe`。
- `choices` 包含一个 payoff，例如 `red_ledger_burst`。
- `choices` 包含一个 route，例如 `spark_tap`。
- `choices` 不应因为 Wild 被拿走而只剩 payoff / route / route。

这个测试直接锁住 `blood_tithe` 的开放价值：它是 Wild 之后的 repair-resource 后备。

## 5. P0 合同四：选择开放奖励后的当前 run 可见性

测试文件：`prototype-web/src/tests/sim/progression-reward-regression.test.ts`

### 新增测试

测试名称：`adds opened draw repair reward %s to the next hand without permanent growth`

建议写成：

```ts
it.each(['blood_tithe', 'pulse_draw'] as const)(
  'adds opened draw repair reward %s to the next hand without permanent growth',
  ...
)
```

Given：

- 创建 `world = createInitialWorld()`。
- 发牌进入 `PlayerTurn`。
- `world.reward.xpThreshold = 1`，保证击杀一个低 HP 敌人后进入 Reward。
- 当前候选池按测试参数构造：

```text
rewardCardId
red_ledger_burst
spark_tap
```

- `world.enemies['enemy-1'].hp = cards.debt_hook.damage`。

When：

- 打出 `debt_hook` 击杀 `enemy-1`。
- 确认进入 `Reward`。
- 执行 `select-reward rewardCardId`。

Then：

- `RewardChoicesGenerated.choices` 包含测试参数 `rewardCardId`。
- `RewardChosen.cardId` 等于测试参数。
- `CardAddedToDeck.cardId` 等于测试参数。
- `world.player.deck` 包含测试参数一次。
- `world.player.hand` 包含测试参数，证明非终局奖励已进入下一手可操作资源。
- `world.player.drawPile` 不再包含测试参数，避免“只压到牌堆顶但没有发到下一手”的回归。
- `world.player.maxEnergy` 仍为 `3`。
- `world.reward.pending` 为 `false`，`world.reward.choices` 为 `[]`。
- `world.fsm.gameFlow` 回到 `PlayerTurn`。

### 修改既有测试

测试名称：`grants XP on kill, offers card rewards at the threshold, adds the selected card to the deck, and resumes the next round`

Given：

- 既有测试可保留 `heartbeat_spark / verdict_mark / blood_reclaim` 作为 route-only 对照。

When / Then 修改：

- 不要把该测试改成只覆盖新开放牌。
- 保留它作为“普通路线奖励仍可选”的回归，新增上面的 `it.each` 覆盖 draw repair。

## 6. P0 合同五：run/meta 边界

测试文件：`prototype-web/src/tests/sim/run-layer-boundary.test.ts`

### 修改既有测试

测试名称：`adds card rewards only to the current run, then restart-run returns to baseline`

建议改为：

```ts
it.each(['severance_burst', 'blood_tithe', 'pulse_draw'] as const)(
  'adds %s only to the current run, then restart-run returns to baseline',
  ...
)
```

Given：

- 使用既有 `putWorldInPendingRewardState`。
- `choices` 至少包含测试参数、一个 payoff、一个 route。若测试参数本身是 payoff，则包含一个 repair 和一个 route。

When：

- 执行 `select-reward selectedCardId`。
- 再执行 `restart-run`。

Then：

- 选择后当前 run 的 `deck` 包含 `selectedCardId`。
- 选择后当前 run 的 `hand` 包含 `selectedCardId`。
- 选择后 `maxEnergy` 仍为 `3`。
- restart 后 `player.deck` 精确等于 `startingHand`。
- restart 后 `player.deck` 不包含 `selectedCardId`。
- restart 后 `xp = 0`、`level = 1`、`reward.pending = false`、`tempAuthorizationMP = 0`。

这个测试防止开放抽牌修补牌时顺手把它们写进起手或局外成长。

## 7. P0 合同六：坏手修补运行时行为

测试文件：`prototype-web/src/tests/sim/redline-progression-card-system.test.ts`

### 新增测试

测试名称：`uses blood_tithe as a 0-cost draw opener that finds the missing 1 MP bridge`

Given：

- 创建初始 world，发牌进入 `PlayerTurn`。
- 强制手牌：

```text
blood_tithe
row_cleave
```

- 强制抽牌堆顶部：

```text
redline_cut
```

- 前排敌人 HP 提高到不会在 setup 中提前死亡。
- `energy = 3`，`maxEnergy = 3`。

When：

- 打出 `blood_tithe`。
- 打出刚抽到的 `redline_cut`。
- 打出 `row_cleave`。

Then：

- `blood_tithe` 产生 `HandDealt`，`cardIds` 包含 `redline_cut`。
- `blood_tithe` 的 `CardPlayed.effectMultiplier = 1`，`currentEnergyPaid = 0`。
- `redline_cut` 的 `CardPlayed.effectMultiplier = 2`。
- `row_cleave` 的 `CardPlayed.effectMultiplier = 3`。
- `row_cleave` 后产生 `AuthorizationGranted`。
- 过程中不出现 `ChainBroken`。
- `world.player.maxEnergy` 仍为 `3`。

这个测试证明 `blood_tithe` 开放后的职责是“0 费开链找桥”，不是纯抽牌噪声。

### 新增测试

测试名称：`uses pulse_draw as a 1-cost draw bridge that finds the 2 MP route and payoff`

Given：

- 创建初始 world，发牌进入 `PlayerTurn`。
- 强制手牌：

```text
debt_hook
pulse_draw
```

- 强制抽牌堆顶部：

```text
row_cleave
red_ledger_burst
```

- 前排敌人 HP 提高，确保 route 与 payoff 都能被观察。
- `energy = 3`，`maxEnergy = 3`。

When：

- 打出 `debt_hook`。
- 打出 `pulse_draw`。
- 打出抽到的 `row_cleave`。
- 打出抽到的 `red_ledger_burst`。

Then：

- `pulse_draw` 的 `CardPlayed.effectMultiplier = 2`。
- `pulse_draw` 的 `HandDealt.cardIds` 精确包含：

```text
row_cleave
red_ledger_burst
```

- `row_cleave` 的 `CardPlayed.effectMultiplier = 3`。
- `row_cleave` 后产生 `AuthorizationGranted`，`authorizationRestriction = payoff-only`。
- `red_ledger_burst` 的 `CardPlayed.authorizationPaid = 3`。
- `red_ledger_burst` 产生 `PayoffResolved`。
- `world.player.maxEnergy` 仍为 `3`。

如果产品后来决定 self draw 不吃链路倍率，这个测试必须同步改名和改 Then；不能让实现暗改而测试继续接受。

## 8. P1 合同：默认 5 回合切片中的奖励回应

测试文件：`prototype-web/src/tests/sim/redline-hyperturn-acceptance.test.ts`

### 修改既有测试

测试名称：`uses draw repair to bridge one missing chain segment and continue into the 2 MP route segment`

Given：

- 既有测试已经覆盖 `debt_hook -> pulse_draw -> row_cleave`。

When / Then 修改：

- 在开放 `pulse_draw` 后，补充断言 `cards.pulse_draw.availability` 为 `reward` 或 `starting-and-reward`。
- 补充断言 `world.player.maxEnergy` 不变。
- 保留 `HandDealt` 包含 `row_cleave` 与 `pulse_draw.effectMultiplier = 2` 的现有口径。

### 新增测试

测试名称：`reward response can offer an opened draw repair card after a bad hand`

Given：

- 固定坏手脚本中刚经历缺 1 或缺 2。
- `reward.candidateCardPool` 包含：

```text
blood_tithe
red_ledger_burst
spark_tap
pulse_draw
```

When：

- 触发首奖。

Then：

- `RewardChoicesGenerated.choices` 包含一个 draw repair 奖励，优先 `blood_tithe`。
- 同一组三选一仍包含 payoff 与 route。
- 选择 draw repair 后下一手包含该牌。
- 选择 draw repair 不改变 `maxEnergy`，不改变 `startingHand`。

这个测试是 P1，因为它比纯函数分支测试更接近验收脚本，容易和其它固定切片改动冲突。

## 9. 不建议写的测试

- 不要写“`rewardCardPool.slice(0, 3)` 必须等于某三张”的旧测试；本轮目标是分支选择，不是恢复顺序切片。
- 不要用随机洗牌证明 `blood_tithe` / `pulse_draw` 有效；本轮应该用固定 `hand` 与 `drawPile`。
- 不要把 `blood_tithe` / `pulse_draw` 写进 `startingHand` 来测试开放奖励；这会混淆起手教学和奖励池开放。
- 不要断言 `pulse_draw` 永远只抽 1；当前 runtime 会按链路倍率抽 `drawCards * multiplier`，本轮必须先明确是否接受。
- 不要把 `GainEnergy`、`maxEnergy`、局外 meta 成长塞进这两张牌的奖励测试；它们当前是 draw repair，不是永久资源成长。

## 10. 推荐执行命令

在 `prototype-web` 目录执行：

```bash
npm test -- card-taxonomy.test.ts reward-branching.test.ts progression-reward-regression.test.ts run-layer-boundary.test.ts redline-progression-card-system.test.ts redline-hyperturn-acceptance.test.ts
```

如果本轮只先落地分支和卡池，不碰固定切片，可先跑窄集：

```bash
npm test -- card-taxonomy.test.ts reward-branching.test.ts progression-reward-regression.test.ts run-layer-boundary.test.ts redline-progression-card-system.test.ts
```

## 11. 最小落地顺序

1. 先改 `card-taxonomy.test.ts`，锁住奖励池不能有 `reserve-test`。
2. 再改 `reward-branching.test.ts`，锁住 `blood_tithe` / `pulse_draw` 的 `repair-resource` 分支。
3. 调整 `rewardCardPool` 后，立刻补默认三选一和 repair 后备测试。
4. 最后补 runtime 层 `progression-reward-regression`、`run-layer-boundary`、`redline-progression-card-system`。
5. 所有测试通过后再考虑把 `redline-hyperturn-acceptance` 的固定切片纳入 P1。

STATUS: DONE
