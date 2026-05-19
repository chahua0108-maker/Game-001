# 2026-05-18 Round 06-05 运行时合同与测试工程审查

角色：第 6 轮专家 05，运行时合同与测试工程师  
工作目录：`/Users/roc/Game-001`  
输出边界：只审查当前 `runtime / redlineRules / tests` 与第 3-5 轮 long-task 合同；本文只新增 Markdown 文档，不改源码、不提交 git。  

## 0. 结论

当前 Redline 已有可测试的卡牌主循环：`play-card -> SpendEnergy -> DiscardPlayedCard -> advanceCostChain -> CardPlayed -> redlineRules -> DrawCards / GainEnergy / DamageEnemy`。抽牌、临时授权、奖励进入下一手、HUD 抽牌倍率都已有第 3-5 轮合同。

本轮如果实现更严格的 Wild 修补，必须先锁住两个缺口：

1. `ChainRepaired` 只能在“未断裂、已启动、期望费用仍是 setup 段”的链上发生，不能在 `chain.broken === true` 后继续伪装成修补。
2. `wild_mana_stitch` 的 `GainEnergy` 不能再无条件由 `card.energyGain` 触发；如果本轮按 1:1 修补语义落地，返还当前 MP 必须绑定一次真实 `ChainRepaired`。

本轮如果实现 `reorder`，必须把它做成显式运行时合同：有 pending state、确认 intent、命令、事件和失败条件。不能只在 `DrawCards` 里偷偷改 `drawPile`，也不能继续让 HUD 显示“整备/找牌”却没有可观测运行时证据。

## 1. 当前 runtime 事件/命令事实

### 1.1 Intent 与失败条件

当前 `Intent` 只有：

- `advance-time`
- `deal-hand`
- `play-card`
- `end-turn`
- `select-reward`
- `restart-run`

当前没有任何 reorder / confirm reorder intent。

`play-card` 的入口校验在 `validatePlayCard`，已存在失败条件：

- `card-exists`：未知卡。
- `player-turn`：不在 `PlayerTurn`。
- `card-in-hand`：牌不在手牌。
- `enough-energy`：当前 MP 加可用临时授权不足。
- `target-alive`：目标不存在或死亡。
- `front-target`：单体前排牌打到非前排。

`select-reward` 已有：

- `reward-state`：不在 Reward 或没有 pending reward。
- `reward-choice`：选择不在当前 choices 中。

同 tick 中 `end-turn` 后继续来的玩家输入会记录 `stale-intent-after-turn-end`。如果本轮新增 reorder intent，它也必须加入 player intent 范围，避免结束回合后还能确认重排。

### 1.2 费用链与 Wild 修补

当前 `ChainState` 有：

- `playedCosts`
- `lastCost`
- `nextExpectedCost`
- `multiplier`
- `broken`
- `breakReason`
- `repairedThisTurn`

当前 `advanceCostChain` 行为：

- 非 Wild 或未启动链时，用牌面 `card.cost` 推进。
- Wild 且 `playedCosts.length > 0` 时，用 `chain.nextExpectedCost` 当作本次 `playedCost`。
- 连续则发 `ChainAdvanced`。
- Wild 连续则额外发 `ChainRepaired`。
- 不连续则发 `ChainBroken`，倍率回到 1，`broken = true`。
- 完整未断裂 `0 -> 1 -> 2` 会发 `AuthorizationGranted`，设置 `tempAuthorizationMP += 3`、`authorizationRestriction = 'payoff-only'`、`payoffArmed = true`。

当前缺口：

- Wild 修补条件没有检查 `chain.broken`。
- Wild 修补条件没有限制 `nextExpectedCost`，所以理论上可能把 expected 3 也当成“修补”。
- `CardPlayed` 事件不携带 `chainRepaired` / `repairedCost` 这样的结果字段，导致后续规则无法可靠知道这张牌是否真的修补成功。
- `chain.repairedThisTurn` 是 turn state，不适合作为单张牌效果的门禁；它一旦为 true，后续同回合其他 self card 会读到脏状态。

### 1.3 抽牌与临时当前 MP

当前抽牌路径：

- `redlineRules` 的 `card.self.resource` 在 `CardPlayed` 上读取 `card.drawCards`。
- 抽牌数量是 `card.drawCards * event.effectMultiplier`。
- 发出 `DrawCards` command。
- `processEventQueue` 会给来自 `CardPlayed` 的 `DrawCards` 加 `excludeFromReshuffle: [event.cardId]`，防止刚打出的 self draw 牌在空牌堆时立刻洗回手牌。
- `DrawCards` command 实际调用 `drawCardsFromDeck`，成功抽到牌后复用 `HandDealt` event 记录 `cardIds`。

当前临时当前 MP 路径：

- `redlineRules` 对任何有 `energyGain` 的 self card 发 `GainEnergy` command。
- `GainEnergy` 当前只做 `world.player.energy += amount`，不发专门 event。
- `energy` 可在本回合超过 `maxEnergy`；下一次 `DealHand` 会把 `energy` 重置为 `maxEnergy`。
- `GainEnergy` 不会改变 `maxEnergy`，也不会改变 `tempAuthorizationMP`。

这个设计可以继续复用，但如果 `wild_mana_stitch` 要做 1:1 修补牌，它的返 MP 必须由“本张牌修补成功”驱动，而不是由静态 `energyGain` 无条件驱动。

### 1.4 奖励与 run 边界

当前非终局 `select-reward` 路径已经是：

```text
RewardChosen
ClearRewardChoices
DiscardHand
AddCardToDeck
CompactEnemySlots
FillEnemySlots
AdvanceRound
DealHand
PlayerTurn
```

`AddCardToDeck` 会把奖励牌加入 `player.deck`，并 `unshift` 到 `drawPile` 顶部，所以非终局奖励会进入下一手。终局节点则 `AddCardToDeck -> Settlement`，不会发下一手。

第 3-5 轮测试已经锁住：

- 奖励只属于当前 run，`restart-run` 后回到 `startingHand`。
- `maxEnergy` 不因奖励或授权增长。
- `blood_tithe / pulse_draw` 是正式 reward draw-fixer。
- 默认首奖仍按 `repair-resource / payoff / route-bridge` 展示。
- 非终局奖励进入下一手；终局奖励不发下一手。

### 1.5 reorder 当前只是 metadata / HUD 语义

当前事实：

- `CardUtility` 已包含 `reorder`。
- `paper_shatter` 与 `lantern_captain` 带 `utilities: ['draw', 'reorder']`。
- HUD 会把这类牌标为 `整备/找牌`，并在抽牌效果里显示 `抽N 整备`。
- runtime 没有 reorder state、intent、command 或 event。
- 现有测试明确断言 `paper_shatter / lantern_captain` 作为 self draw support 时，不应在 commands/events 中出现 reorder 字样。

因此本轮如果不实现 reorder，必须继续保留“reorder 只有标签，不承诺运行时”的测试。如果实现 reorder，则必须把这些测试改成断言新的显式 reorder 证据。

## 2. 最小新增或复用合同

### 2.1 Wild 修补合同

建议把 Wild 修补定义成非拒绝式合同：只要 printed cost、目标和手牌合法，牌仍可打出；但只有满足修补窗口时才发 `ChainRepaired`，才允许触发“修补成功附带效果”。

修补成功条件：

```text
world.chain.playedCosts.length > 0
world.chain.broken === false
world.chain.nextExpectedCost > 0
world.chain.nextExpectedCost < 3
card.utilities includes 'wild'
```

含义：

- Wild 不能作为第一张牌宣称“修补”；0 费 Wild 可以作为普通 0 费 self card 开链，但不是修补成功。
- Wild 不能修复已经断裂的链；断了就是断了，只能从后续回合重新开始。
- Wild 只修补 setup 段缺口，即 expected 1 或 expected 2；不能把 expected 3 伪装成 3 费 payoff 节点。
- `ChainRepaired` 必须和同 trace 的 `ChainAdvanced` / `CardPlayed` 对齐。

事件复用与最小新增：

- 继续复用 `ChainRepaired`，保留 `cardId / repairedCost / nextExpectedCost / multiplier`。
- 建议给 `CardPlayed` 增加 `chainRepaired: boolean`，可选 `repairedCost?: number`。这是为了让 `redlineRules.card.self.resource` 能精确判断本张牌是否修补成功。
- 若不想改 `CardPlayed` 类型，则可让 `advanceCostChain` 在修补成功时直接排入一个内部效果上下文；但不要用 `world.chain.repairedThisTurn` 当单张牌门禁。

失败条件合同：

这些失败条件是“修补失败证据”，不一定阻止出牌：

- `ruleId: 'chain.repair'`, `conditionId: 'repair-window'`：Wild 在没有已启动链时无法修补。
- `ruleId: 'chain.repair'`, `conditionId: 'chain-unbroken'`：链已经 broken，Wild 不再修补。
- `ruleId: 'chain.repair'`, `conditionId: 'repair-setup-cost'`：`nextExpectedCost >= 3`，Wild 不能修补 payoff 段。

### 2.2 临时资源合同

保留现有 `GainEnergy` command，但把 `wild_mana_stitch` 的返 MP 绑定到真实修补：

```text
if card.id === 'wild_mana_stitch':
  emit GainEnergy only when current CardPlayed.chainRepaired === true
else:
  keep existing energyGain semantics for future non-repair resource cards
```

必须锁住：

- `GainEnergy` 改的是 `player.energy`，不是 `player.maxEnergy`。
- 当前 MP 可本回合临时超过 `maxEnergy`，但下一次 `DealHand` 回到 `maxEnergy`。
- `GainEnergy` 不提供 `authorizationPaid`，也不设置 `payoffArmed`。
- `tempAuthorizationMP` 仍只由完整未断裂 `0 -> 1 -> 2` 授权链产生。

如果希望事件更可观测，可新增 `EnergyGained` event；但本轮最小合同可以只断言 `debug.commands` 中的 `GainEnergy` command 存在或不存在。

### 2.3 抽牌合同

继续复用当前抽牌合同，不建议本轮重命名事件：

- `DrawCards.count = card.drawCards * CardPlayed.effectMultiplier`。
- `DrawCards.excludeFromReshuffle` 必须包含刚打出的 self draw card。
- 抽到牌后继续发 `HandDealt` event，并用同一 `traceId`。
- 没有抽到牌时可以没有 `HandDealt` event，但不能把刚打出的牌立即抽回。
- `drawCardsFromDeck` 仍只从 `drawPile` 抽，空了再从 `discardPile` 回填；不能直接从 `deck` 抽。

### 2.4 reorder 合同

如果本轮实现 reorder，必须新增显式合同。推荐最小方案是“先按当前规则抽牌，再对剩余抽牌堆顶部进行重排”，这样不会破坏第 3-5 轮关于抽牌倍率和下一手奖励的既有测试。

新增 state：

```text
pendingReorder:
  sourceTraceId
  sourceCardId
  offeredCardIds
  maxCount
```

新增 intent：

```text
confirm-reorder:
  orderedCardIds
  traceId
```

新增 commands：

- `OfferDrawPileReorder`：锁定可重排的顶部牌集合。
- `ApplyDrawPileReorder`：按玩家确认顺序改写 `drawPile` 顶部。

新增 events：

- `DrawPileReorderOffered`：记录 `sourceCardId / offeredCardIds / maxCount`。
- `DrawPileReordered`：记录 `beforeTopCardIds / afterTopCardIds / sourceCardId`。
- 可选 `DrawPileReorderSkipped`：玩家跳过或没有足够牌可重排。

失败条件：

- `reorder-state`：没有 pending reorder 时确认。
- `reorder-card-set`：确认的牌集合不是 offered 集合。
- `reorder-duplicates`：确认列表有重复。
- `reorder-zone`：确认时 offered cards 已不在 drawPile 顶部，说明状态过期。
- `player-turn`：不在 `PlayerTurn` 或等价可输入态。
- `stale-intent-after-turn-end`：同 tick 结束回合后又确认 reorder。

reorder 不能做的事：

- 不能创建、销毁或复制 cardId。
- 不能改 hand / discardPile / deck，只能改 drawPile 顶部顺序。
- 不能降低敌人意图。
- 不能触发奖励选择、授权或 payoff。
- 不能只依赖 HUD 文案证明已经实现。

## 3. 必须新增/修改的测试清单

### 3.1 `prototype-web/src/tests/sim/runtime.test.ts`

新增 Wild 修补负例：

1. `wild_mana_stitch` 作为第一张牌时可以按 0 费 self draw 开链，但不发 `ChainRepaired`；如果本轮采用严格返 MP，不能发 `GainEnergy`。
2. `debt_hook -> row_cleave` 断链后再打 `wild_mana_stitch`：不发 `ChainRepaired`，不清除 `chain.broken`，不发 `AuthorizationGranted`，不允许后续 3 MP payoff 用授权支付。
3. `debt_hook -> redline_cut -> row_cleave -> wild_mana_stitch`：expected 3 时 Wild 不能修补 payoff 段，不能让 self card 拿到 x4 修补返 MP。

加强 Wild 成功例：

1. `debt_hook -> wild_mana_stitch -> row_cleave`：只产生一次 `ChainRepaired`，`repairedCost = 1`，`row_cleave.effectMultiplier = 3`。
2. 成功修补时 `DrawCards.count` 等于 `drawCards * multiplier`，例如 x2 时请求抽 2。
3. 成功修补时 `GainEnergy` 只出现一次；`player.maxEnergy` 仍为 3。
4. `wild_gap_key` 在 expected 1 或 expected 2 时可修补链，但支付仍按牌面 cost，不等于免费 2 费。

保留既有抽牌护栏：

- `blood_tithe` / `wild_mana_stitch` 在空 `drawPile` 和空 `discardPile` 时不会立刻抽回自己。
- `DrawCards` 仍通过 `excludeFromReshuffle` 防止自抽回流。

### 3.2 `prototype-web/src/tests/sim/redline-attribute-authorization.test.ts`

新增或加强：

1. 已 broken 的链即使后续 Wild 接上 expected cost，也不能产生 `AuthorizationGranted`。
2. expected 3 的 Wild 不算 3 MP payoff，不产生终局授权，也不触发 `PayoffTriggered`。
3. 只有未断裂 `0 -> 1 -> 2`，包括 `0 -> Wild(expected 1) -> 2`，才设置 `tempAuthorizationMP` 和 `payoffArmed`。
4. 授权仍只支付 3 费、`targets: all-enemies`、`comboNode: burst` 的 terminal payoff；`clearance_order` 仍只是 2 MP 展开段。

### 3.3 `prototype-web/src/tests/sim/redline-progression-card-system.test.ts`

修改现有 Wild 核心测试：

- 继续保留“Wild 修补后 armed payoff 清掉可见 enemy intent”的正例。
- 增加对 `GainEnergy` command 的精确断言：成功修补有，修补失败没有。
- 不要只断言最终 `energy`，因为最终数值容易被后续 `DealHand` 或测试夹具污染；要按 `traceId` 查 `debug.commands`。

修改 reorder 测试分支：

- 如果本轮不实现 reorder：保留现有 `paper_shatter / lantern_captain` 不出现 reorder runtime 证据的测试。
- 如果本轮实现 reorder：把该测试改成断言 `DrawPileReorderOffered` 和 `DrawPileReordered`，并删掉“不出现 reorder”的断言。

### 3.4 `prototype-web/src/tests/sim/runtime-audit.test.ts`

新增 stale reorder 测试，前提是本轮实现 reorder intent：

```text
tickWorld([
  end-turn,
  confirm-reorder
])
```

Then：

- 不改写 `drawPile`。
- 记录 `stale-intent-after-turn-end`。
- 不产生 `DrawPileReordered`。

继续保留：

- 同 tick 中 `end-turn` 后的 `play-card` 被拒绝。
- self draw 不立即抽回自己。
- front-row compact/refill 不被卡牌机制改动影响。

### 3.5 `prototype-web/src/tests/sim/reward-branching.test.ts`

本轮不应为了 Wild 或 reorder 改奖励池排序。必须继续通过：

- 默认 `buildRewardChoices(rewardCardPool, 3, cards)`。
- reward pool 没有 `reserve-test`。
- `blood_tithe / pulse_draw` 仍是 repair-resource 分支。
- `pulse_draw` 不能因为 route-bridge 身份抢掉默认 route 槽。

除非制作人明确批准调整奖励顺序，否则本轮不要修改这些期望。

### 3.6 `prototype-web/src/tests/sim/progression-reward-regression.test.ts` 与 `run-layer-boundary.test.ts`

这些测试不一定要新增，但必须作为回归套件运行：

- 非终局奖励选择后，选中的牌进入下一手。
- 终局奖励进入 `Settlement`，不发下一手。
- `restart-run` 回到 `startingHand`，不保留本 run reward。
- 任何 Wild / reorder 改动都不能改变 `maxEnergy = 3` 的基础边界。
- 奖励前遗留的 `tempAuthorizationMP`、`payoffArmed`、chain 状态在下一手被清干净。

### 3.7 `prototype-web/src/tests/ui/hud-target-selection.test.ts`

必须保护第 5 轮 HUD 合同：

- self draw 牌显示 `抽N找解`，不承诺降低敌人意图。
- `paper_shatter / lantern_captain` 如果还没有 reorder runtime，仍只显示 `整备/找牌` 作为角色标签，不宣称“已重排”。
- 如果实现 reorder，HUD 测试必须能看到 pending reorder 或确认结果，不能只看卡牌 role label。
- 授权支付 UI 仍只对 3 MP all-enemies burst payoff 显示“终局授权支付”。

## 4. 避免破坏第 3-5 轮奖励与 HUD 合同

本轮禁止顺手改这些边界：

1. 不改 `startingHand`，Wild、draw repair、reorder 支援牌都不进起手教学。
2. 不把任何奖励、Wild 返 MP、reorder 结果写成永久成长。
3. 不改 `player.maxEnergy = 3` 基线。
4. 不改 `AddCardToDeck -> drawPile.unshift -> DealHand` 的非终局奖励反馈闭环。
5. 不把终局奖励做成“还能发下一手”。
6. 不把 `HandDealt` 事件从 draw card 路径移除；第 3-5 轮测试已经用它验证抽牌结果。
7. 不让 self draw 或 reorder 降低 enemy intent；只有伤害和 payoff 结果能减少可见意图。
8. 不让 `clearance_order` 变成 payoff；它仍是 2 MP route segment。
9. 不让 `pulse_draw` 的 HUD 回到泛化“抽牌找解”；当前倍率下的 `抽2/抽3` 必须保留。
10. 不在 runtime 未实现 reorder 时让 HUD 或测试宣称“已重排”。

## 5. 推荐定向验证命令

若只实现 Wild 修补与返 MP 门禁：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test -- src/tests/sim/runtime.test.ts src/tests/sim/redline-attribute-authorization.test.ts src/tests/sim/redline-progression-card-system.test.ts src/tests/sim/runtime-audit.test.ts src/tests/sim/progression-reward-regression.test.ts src/tests/sim/run-layer-boundary.test.ts
```

若同时实现 reorder：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test -- src/tests/sim/runtime.test.ts src/tests/sim/redline-progression-card-system.test.ts src/tests/sim/runtime-audit.test.ts src/tests/ui/hud-target-selection.test.ts
```

若改到 HUD 文案或布局，再跑浏览器移动端验收，至少覆盖 `390x844` 与 `360x640`，检查卡牌按钮、奖励面板和日志不重叠、不溢出。

## 6. 本轮最小落地建议

优先级建议：

1. 先修 Wild 修补成功条件与 `wild_mana_stitch` 返 MP 门禁。
2. 只在测试锁稳后再考虑 reorder。
3. 如果 reorder 没有时间做完整 pending intent，不要做半隐式排序；继续保留当前“metadata + HUD role label，不承诺 runtime”的状态。

STATUS: DONE
