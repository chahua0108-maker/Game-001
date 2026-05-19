# 2026-05-18 Round 07-02：Reorder runtime 最小合同

角色：第 7 轮专家 02，Reorder runtime 架构师  
工作目录：`/Users/roc/Game-001`  
边界：只新增本文档；不改源码、不提交 git、不回滚他人改动。  
目标：给 `SearchAndTopdeck` / `DrawPileReordered` / `DeckSearchMissed` 定义最小 runtime 合同，让 `paper_shatter / lantern_captain` 的 `reorder` 标签可以被实现为可观测、可测试、不会破坏现有抽牌和奖励流程的小切口。

## 0. 基线结论

当前牌顶语义已经足够支持最小 reorder：

- `drawPile[0]` 是下一抽，因为抽牌使用 `drawPile.shift()`。
- `AddCardToDeck` 已用 `drawPile.unshift(cardId)` 把奖励牌压到牌顶，所以“置顶”语义已存在。
- `paper_shatter / lantern_captain` 现在只有 `utilities: ['draw', 'reorder']` 与“整备/找牌”文案，没有 runtime 命令或事件。

本轮建议不要做手动牌库 UI，也不要做完整 scry/reorder。最小 runtime 是：在带 `reorder` 的 self draw 牌触发 `DrawCards` 之前，先按偏好从候选区找一张牌，移动到 `drawPile[0]`，然后继续走现有 `DrawCards`。成功必须发 `DrawPileReordered`，失败必须发 `DeckSearchMissed`，不能静默改数组。

## 1. 命令 / 事件草案

### 1.1 SearchAndTopdeck command

`SearchAndTopdeck` 是内部 command，不是玩家 intent。它只能由一次合法 `CardPlayed` 派生，不能被 UI 直接提交。

```ts
type SearchPreference = 'payoff' | 'route' | 'repair';

type SearchZone = 'drawPile' | 'discardPile';

type Command =
  | {
      type: 'SearchAndTopdeck';
      traceId: TraceId;
      sourceCardId: CardId;
      preference: SearchPreference;
      zones?: SearchZone[];          // 默认 ['drawPile', 'discardPile']
      lookCount?: number;            // 默认 undefined，表示检查该 zone 全量；若设置，只限制 drawPile 前 N 张
      excludeCardIds?: CardId[];     // 至少包含 sourceCardId
      reason: 'pre-draw-reorder';
    };
```

最小派发规则：

- `event.type === 'CardPlayed'`。
- `cards[event.cardId].targets === 'self'`。
- `cards[event.cardId].drawCards` 存在。
- `cards[event.cardId].utilities?.includes('reorder')`。
- command 顺序必须在同 trace 的 `DrawCards` 之前。

P0 不强制新增卡牌 schema。可以先用显式映射：

```ts
paper_shatter -> preference: 'payoff'
lantern_captain -> preference: 'route'
```

后续若要扩展，再把它提升为 `CardDefinition.searchPreference`，但不要在首版引入通用查询语言或效果解释器。

### 1.2 DrawPileReordered event

只要找到候选牌，就发 `DrawPileReordered`。如果候选本来就在 `drawPile[0]`，数组可以不变，但仍发事件，表示搜索命中且下一抽已被确认。

```ts
type GameEvent =
  | {
      type: 'DrawPileReordered';
      traceId: TraceId;
      tick: number;
      sourceCardId: CardId;
      movedCardId: CardId;
      preference: SearchPreference;
      fromZone: SearchZone;
      fromIndex: number;
      toIndex: 0;
      searchedCount: number;
      topCardBefore?: CardId;
      topCardAfter: CardId;
    };
```

语义：

- `movedCardId` 从 `fromZone` 的 `fromIndex` 移除。
- 然后 `drawPile.unshift(movedCardId)`。
- 如果 `fromZone === 'drawPile' && fromIndex === 0`，这是 no-op topdeck，不能制造重复牌。
- `topCardAfter` 必须等于 `drawPile[0]`。
- 事件不代表抽牌；真正入手仍由后续 `DrawCards -> HandDealt` 证明。

### 1.3 DeckSearchMissed event

找不到候选牌时发 `DeckSearchMissed`，然后保持原 draw flow。

```ts
type GameEvent =
  | {
      type: 'DeckSearchMissed';
      traceId: TraceId;
      tick: number;
      sourceCardId: CardId;
      preference: SearchPreference;
      zones: SearchZone[];
      searchedCount: number;
      reason: 'no-candidate';
    };
```

语义：

- miss 不能阻止 `DrawCards`。
- miss 不能改变 `drawPile / discardPile / hand / deck`。
- UI 若展示日志，只能写“整备未找到终结/路线”，不能伪装成玩家已经选择过牌。

## 2. 候选搜索范围

### 2.1 zone 范围

默认只搜索两个真实可抽区域：

1. `drawPile`
2. `discardPile`

禁止搜索：

- `deck`：它是当前 run 的拥有列表，不是实时牌区；从这里拿牌会制造复制。
- `hand`：手牌已经可见可打，不应被 topdeck。
- `reward.choices / reward.candidateCardPool`：奖励池不是本回合牌区。
- `startingHand`：它只是初始配置，不是运行时 zone。

### 2.2 搜索顺序

首版保持确定性：

```text
drawPile 按 index 0 -> n 搜索
找不到，再搜 discardPile 按 index 0 -> n 搜索
找到第一张就停止
```

`lookCount` 若启用，只限制 `drawPile` 前 N 张；不要用它裁剪 `discardPile`，否则弃牌堆搜索会变成难以解释的半随机规则。若强度担心，P0 可以把 zones 固定为 `['drawPile']`，但测试合同要明确；推荐 demo 使用 `drawPile + discardPile`，并用 `excludeCardIds` 控制自抽回环。

### 2.3 候选分类

先用显式、稳定、能被测试的 predicate。

`payoff`：

- `card.cardType === 'payoff'`，或
- `card.rewardBranches?.includes('payoff')`，或
- `card.cost === 3 && card.targets === 'all-enemies' && card.comboNode === 'burst'`。

`route`：

- `card.rewardBranches?.includes('route-bridge')`，或
- `card.chainRole` 是 `starter / bridge / expand`，且不是 `targets: 'self'` 的纯抽牌支援。

`repair`：

- `card.rewardBranches?.includes('repair-resource')`，或
- `card.utilities` 包含 `wild / draw / mana`。

首版不做评分，不做“更优路线”推断，不按当前敌人血量选牌。找到第一张合法候选即可。

### 2.4 排除规则

必须排除：

- `sourceCardId`，防止刚打出的 self draw 牌进入弃牌堆后被马上检索回来。
- 当前已经在 `hand` 的同名牌不需要特殊处理，因为不搜索 `hand`。
- 不存在于 `cards` 定义中的 card id，避免坏数据打断抽牌。

如果同名牌在 `discardPile` 有多份，首版按 `discardPile` 当前顺序移动第一份。当前系统没有 `CardInstanceId`，不要假装可以区分实例来源。

## 3. 不破坏第 3-6 轮合同的方式

### 3.1 第 3 轮：奖励进入下一手

第 3 轮锁住的是：非终局 `select-reward` 后先 `AddCardToDeck`，再发下一手，奖励牌应进入下一手。

本合同不改这条链：

- `SearchAndTopdeck` 只能由 `CardPlayed` 派生，不能在 `Reward / Deal` 阶段运行。
- 不改 `AddCardToDeck` 的 `deck.push + drawPile.unshift`。
- 不改 `select-reward -> ClearRewardChoices -> DiscardHand -> AddCardToDeck -> DealHand` 顺序。
- 不允许从 `deck` 搜索，因此不会把奖励拥有列表复制成额外牌。

验收口径：原有“选择奖励后下一手包含奖励牌”的测试必须继续通过。

### 3.2 第 4 轮：奖励分支合同

第 4 轮锁住的是 `rewardBranches` 显式合同和 reward pool 分支稳定性。

本合同只读 `rewardBranches` 作为候选分类的辅助 predicate，不写它、不重排 reward pool、不改变 `buildRewardChoices`。`SearchPreference` 不应复用 `RewardBranch` 类型本身，因为它描述的是“这次找什么”，不是“奖励三选一属于哪个槽”。

验收口径：`reward-branching` 相关测试不应因为实现 reorder 而改默认三选一。

### 3.3 第 5 轮：抽牌修补与倍率读数

第 5 轮锁住的是：self draw 的真实抽牌数为 `drawCards * CardPlayed.effectMultiplier`，并且 `blood_tithe / pulse_draw` 是正式 reward draw-fixer。

本合同不改抽牌数量：

```text
CardPlayed
-> SearchAndTopdeck
-> DrawCards(count = drawCards * effectMultiplier)
-> HandDealt(cardIds)
```

`SearchAndTopdeck` 只改变 `DrawCards` 即将抽到的顺序，不改变 `count`，也不直接把牌塞进 `hand`。`HandDealt.cardIds[0]` 应能证明 topdeck 生效。

同时必须继承 self draw 护栏：

- `DrawCards.excludeFromReshuffle` 继续包含 `sourceCardId`。
- `SearchAndTopdeck.excludeCardIds` 也至少包含 `sourceCardId`。
- 空牌堆时不能把刚打出的 `paper_shatter / lantern_captain` 立刻抽回。

### 3.4 第 6 轮：Wild 与临时资源合同

第 6 轮锁住的是：Wild 只有在“链已开始、未 broken、期望费用为 1 或 2”时才算真实修补；`wild_mana_stitch` 只有修补成功才返当前 MP。

本合同不碰链路与资源：

- `SearchAndTopdeck` 在 `advanceCostChain` 和 `CardPlayed` 之后发生，只消费已算好的 `effectMultiplier`。
- 不写 `chain.playedCosts / nextExpectedCost / repairedThisTurn / broken`。
- 不发 `GainEnergy`。
- 不改 `energy / maxEnergy / tempAuthorizationMP / payoffArmed`。
- 找到 3 MP payoff 只表示下一抽更可能拿到 payoff；能不能打出仍由现有 energy / authorization 校验决定。

验收口径：`wild_gap_key` 的 `effectiveCost / chainRepaired / repairedCost` 测试、`wild_mana_stitch` opener 不返 MP 与 broken chain 不修补测试必须继续通过。

## 4. 禁止事项

- 禁止新增 `confirm-reorder`、pending reorder state、拖拽排序 UI 或牌库浏览器；那是 P1/P2，不是本轮最小 runtime。
- 禁止从 `deck` 中移牌或复制牌；`deck` 只表示当前 run 拥有列表。
- 禁止直接把搜索命中的牌 push 进 `hand`；必须通过 `drawPile[0] -> DrawCards -> HandDealt`。
- 禁止改变 `DrawCards.count`、抽牌倍率、`HandDealt` 事件语义。
- 禁止改变 `AddCardToDeck` 的 `unshift` 奖励置顶语义。
- 禁止在 `Reward`、`Deal`、`EnemyAttack`、`EnemyRefill`、`Settlement` 阶段运行 `SearchAndTopdeck`。
- 禁止把 `reorder` 实现成随机洗牌、seed shuffle 或“从全 deck 生成一张牌”。
- 禁止把 reorder 绑定到 MP、Max MP、局外成长、永久解锁、升级、删牌、消耗、保留、状态牌或 CardInstance 迁移。
- 禁止让 miss 静默无事件；否则 HUD 和测试无法区分“没实现”和“没找到”。
- 禁止让 `paper_shatter / lantern_captain` 同时在首个 demo 承担完全相同的 payoff tutor；若两张都接入，建议 `paper_shatter = payoff`，`lantern_captain = route`。

## 5. 推荐事件顺序

以 `paper_shatter` 为例：

```text
play-card paper_shatter
-> SpendEnergy
-> DiscardPlayedCard
-> advanceCostChain
-> ChainAdvanced / ChainBroken
-> CardPlayed(effectMultiplier = 3 if 0 -> 1 -> 2)
-> SearchAndTopdeck(preference = payoff, excludeCardIds = [paper_shatter])
-> DrawPileReordered or DeckSearchMissed
-> DrawCards(count = 1 * effectMultiplier, excludeFromReshuffle = [paper_shatter])
-> HandDealt(cardIds)
```

这样事件链有两个清楚证据：

- `DrawPileReordered` 证明整备真的改变了下一抽。
- `HandDealt` 证明被置顶的牌是否实际进入手牌。

如果 `DeckSearchMissed` 发生，后续仍可有 `HandDealt`，只是按原牌堆顺序抽牌。

## 6. 测试清单

### 6.1 类型与静态合同

- `Command` 包含 `SearchAndTopdeck`。
- `GameEvent` 包含 `DrawPileReordered` 与 `DeckSearchMissed`。
- `SearchPreference` 只允许 `payoff / route / repair`。
- `paper_shatter` 的 P0 preference 是 `payoff`。
- `lantern_captain` 若启用，P0 preference 是 `route`。
- `CardUtility` 仍可保留 `reorder`，但只有 runtime 事件出现后 UI 才能承诺真实整备。

### 6.2 成功置顶

测试名建议：`topdecks a payoff before amplified draw resolves`

Given：

```text
hand = [debt_hook, redline_cut, paper_shatter]
drawPile = [spark_tap, severance_burst, heartbeat_spark]
discardPile = []
```

When：

```text
debt_hook -> redline_cut -> paper_shatter
```

Then：

- `paper_shatter.CardPlayed.effectMultiplier === 3`。
- 同 trace 先出现 `DrawPileReordered`，后出现 `HandDealt`。
- `DrawPileReordered.movedCardId === 'severance_burst'`。
- `DrawPileReordered.fromZone === 'drawPile'`，`fromIndex === 1`，`toIndex === 0`。
- `HandDealt.cardIds[0] === 'severance_burst'`。
- 最终 `hand` 包含 `severance_burst`，且没有重复复制。

### 6.3 命中已在牌顶

测试名建议：`records reorder hit when the candidate is already on top`

Given：

```text
drawPile = [severance_burst, spark_tap]
```

Then：

- 仍发 `DrawPileReordered`。
- `fromZone === 'drawPile'`，`fromIndex === 0`。
- `drawPile` 不产生第二张 `severance_burst`。
- 后续 `HandDealt.cardIds[0] === 'severance_burst'`。

### 6.4 弃牌堆检索

测试名建议：`moves a discard payoff to draw pile top without returning the source card`

Given：

```text
hand = [paper_shatter]
drawPile = [spark_tap]
discardPile = [paper_shatter, severance_burst]
```

When：

```text
play paper_shatter
```

Then：

- `SearchAndTopdeck.excludeCardIds` 至少包含 `paper_shatter`。
- 命中 `severance_burst`，不是 `paper_shatter`。
- `discardPile` 移除一份 `severance_burst`。
- 后续抽牌不能把刚打出的 `paper_shatter` 立即抽回。

### 6.5 搜索失败

测试名建议：`emits DeckSearchMissed and keeps normal draw order when no candidate exists`

Given：

```text
drawPile = [spark_tap, heartbeat_spark]
discardPile = [blood_tithe]
preference = payoff
```

Then：

- 发 `DeckSearchMissed`。
- 不发 `DrawPileReordered`。
- `drawPile / discardPile` 在 `DrawCards` 之前保持原顺序。
- 后续仍按原顺序 `HandDealt.cardIds[0] === 'spark_tap'`。

### 6.6 不搜索非法范围

- `hand` 中已有 `severance_burst` 时，不应被当成 topdeck 候选。
- `deck` 中有 `red_ledger_burst` 但 `drawPile/discardPile` 没有 payoff 时，必须 miss，不能复制 deck 拥有列表。
- `reward.candidateCardPool` 中的 payoff 不能被搜索到。

### 6.7 第 3-6 轮回归

实现后至少跑这些现有合同：

```bash
cd prototype-web
npm test -- src/tests/sim/runtime.test.ts src/tests/sim/redline-progression-card-system.test.ts src/tests/sim/progression-reward-regression.test.ts src/tests/sim/reward-branching.test.ts src/tests/sim/run-layer-boundary.test.ts src/tests/sim/card-taxonomy.test.ts
npm test -- --run
```

必须继续成立：

- 选择非终局奖励后，奖励牌进入下一手。
- 终局奖励进入 Settlement，不额外发下一手。
- restart 后回到 `startingHand`，奖励和 topdeck 操作不残留。
- `blood_tithe / pulse_draw` 仍是 reward draw-fixer。
- `pulse_draw` 接在 0 后仍按倍率抽 2。
- `paper_shatter / lantern_captain` 若实现 reorder，旧的“不出现 reorder 命令/事件”断言必须改成“出现明确 `DrawPileReordered` 或 `DeckSearchMissed`”，不能留下互相矛盾的测试。
- Wild opener 不返 MP，broken chain 后 Wild 不修补，`wild_gap_key` 支付牌面但按有效费用补链。

## 7. 最小落地裁决

P0 只做一条可解释路径：

```text
paper_shatter:
  CardPlayed 后 SearchAndTopdeck(payoff)
  成功发 DrawPileReordered
  失败发 DeckSearchMissed
  然后复用 DrawCards 抽牌
```

`lantern_captain` 可以同批只接测试，不作为首个可玩 demo 的主展示：

```text
lantern_captain:
  SearchAndTopdeck(route)
```

这条合同兑现的是“整备让下一抽更接近你要的 payoff / route”，不是完整手动重排。它足够小，能和现有 `drawPile[0]`、`AddCardToDeck.unshift`、抽牌倍率、Wild 修补合同自然拼上，也不会迫使项目现在进入 CardInstance、牌库 UI 或通用效果解释器的大迁移。

STATUS: DONE
