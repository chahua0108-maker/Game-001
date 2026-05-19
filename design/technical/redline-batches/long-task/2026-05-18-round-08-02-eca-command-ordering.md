# 2026-05-18 Round 08-02：ECA Command Ordering for paper_shatter Topdeck

角色：第 8 轮专家 02，ECA Queue Ordering Engineer  
工作目录：`/Users/roc/Game-001`  
边界：只新增本文档；不改源码、不提交 git、不回滚他人改动。  
目标：分析如果 `paper_shatter` 做 drawPile-only payoff 置顶，ECA 规则应如何保证 `SearchAndTopdeck` 在 `DrawCards` 前执行，同时不破坏 Wild 修补、授权、奖励进入下一手。

## 0. 结论

`paper_shatter` 的 P0 实现应采用“同一 `CardPlayed` 事件内，先派发 `SearchAndTopdeck`，后派发 `DrawCards`”的命令顺序。

不要把置顶做成 `DrawCards` 的后置规则，也不要做成监听 `HandDealt` 的补救规则。当前 `processEventQueue` 对同一事件按 `redlineRules` 数组顺序执行规则，并把每个规则返回的 command 立即 `applyCommand`，再把产生的事件追加到队列尾部。因此只要在 `card.self.resource` 之前放一条更窄的 `card.self.paper-shatter.topdeck-payoff` 规则，或把 `card.self.resource` 内部命令顺序改成 `SearchAndTopdeck -> DrawCards -> GainEnergy`，就可以稳定保证置顶发生在抽牌前。

推荐首版用独立规则，原因是它能把 `paper_shatter` 的受限样片和通用 self resource 规则隔离，便于负例测试和后续删除。

## 1. 当前执行事实

当前 `tickWorld(play-card)` 的关键顺序是：

```text
validatePlayCard
-> SpendEnergy
-> DiscardPlayedCard
-> set player Cast
-> advanceCostChain
-> ChainAdvanced / ChainBroken / ChainRepaired / AuthorizationGranted
-> CardPaymentRecorded, if authorization was spent
-> CardPlayed(effectMultiplier, chainRepaired, payoffArmed...)
-> PayoffTriggered, if card itself is payoff
-> processEventQueue
```

在 `processEventQueue` 内：

```text
push current event
-> evaluateRules(redlineRules, world, event) in array order
-> for each command returned by a passing rule:
   -> if command is DrawCards from CardPlayed, attach excludeFromReshuffle: [event.cardId]
   -> applyCommand immediately
   -> append resulting events to queue tail
```

这意味着 `CardPlayed` 的 ECA command ordering 是真实行为，不只是日志顺序。若同一个 `CardPlayed` 同时产出 `SearchAndTopdeck` 和 `DrawCards`，前一个 command 会先改 `world.player.drawPile`，后一个 command 再 `shift()` 抽牌。

## 2. P0 规则顺序

### 2.1 推荐 redlineRules 顺序

把 `paper_shatter` 的置顶规则放在 `card.self.resource` 之前：

```text
card.damage.front-enemy
card.clear-burst
card.damage.front-row
card.self.paper-shatter.topdeck-payoff
card.self.resource
enemy.death.reward
```

理由：

- damage/payoff/front-row 规则不处理 `paper_shatter`，前置无副作用。
- `card.self.paper-shatter.topdeck-payoff` 只对 `paper_shatter` 命中，先移动 `drawPile`。
- `card.self.resource` 继续负责既有 `DrawCards` 和 `GainEnergy`，不需要理解 payoff 搜索策略。
- `enemy.death.reward` 只由 `EnemyKilled` 触发，不参与 self draw 顺序。

### 2.2 新规则 filter

P0 不要使用“所有 reorder self draw 牌”作为 filter。只允许 `paper_shatter`：

```ts
event.type === 'CardPlayed'
&& event.cardId === 'paper_shatter'
&& cards[event.cardId].targets === 'self'
&& cards[event.cardId].drawCards
&& cards[event.cardId].utilities?.includes('reorder')
```

如果第 8 轮主线要求更保守，可以再加一条节奏门槛：

```ts
!world.chain.broken
&& world.chain.playedCosts.length >= 3
&& world.chain.playedCosts[0] === 0
&& world.chain.playedCosts[1] === 1
&& world.chain.playedCosts[2] === 2
```

但从 queue ordering 角度，是否加门槛不影响核心顺序。门槛属于平衡/体验裁决。

### 2.3 新规则 command

P0 command 固定为 drawPile-only payoff：

```ts
{
  type: 'SearchAndTopdeck',
  traceId: event.traceId,
  sourceCardId: 'paper_shatter',
  preference: 'payoff',
  zones: ['drawPile'],
  excludeCardIds: ['paper_shatter'],
  reason: 'pre-draw-reorder'
}
```

`SearchAndTopdeck` 不应读取 `discardPile`，不应读取 `deck`，不应直接改 `hand`。候选 predicate 首选以下任一稳定条件：

```text
card.cardType === 'payoff'
or card.rewardBranches includes 'payoff'
or card.cost === 3 && card.targets === 'all-enemies' && card.comboNode === 'burst'
```

P0 成功时移动 drawPile 内第一张 payoff 到 `drawPile[0]` 并发 `DrawPileReordered`。失败时不改任何 pile，发 `DeckSearchMissed`。

## 3. 必须保持的完整事件链

### 3.1 命中 payoff

```text
play-card paper_shatter
-> IntentReceived
-> SpendEnergy
-> DiscardPlayedCard
-> ChainAdvanced or ChainBroken
-> maybe AuthorizationGranted
-> CardPlayed(cardId=paper_shatter, effectMultiplier=N)
-> SearchAndTopdeck(preference=payoff, zones=[drawPile])
-> DrawPileReordered(movedCardId=3MP payoff, fromZone=drawPile, toIndex=0)
-> DrawCards(count=paper_shatter.drawCards * N, excludeFromReshuffle=[paper_shatter])
-> HandDealt(cardIds starts with movedCardId if count >= 1)
```

这里 `DrawPileReordered` 是“整备生效”的证据，`HandDealt` 是“被置顶牌进入手牌”的证据。两者不能合并。

### 3.2 未命中 payoff

```text
CardPlayed(paper_shatter)
-> SearchAndTopdeck
-> DeckSearchMissed(reason=no-candidate)
-> DrawCards(existing count)
-> HandDealt(original draw order)
```

miss 不能阻止抽牌。否则 `paper_shatter` 会从“抽牌整备”变成“有 payoff 才抽”，破坏卡面已有 draw 合同。

### 3.3 payoff 已在牌顶

```text
CardPlayed(paper_shatter)
-> SearchAndTopdeck
-> DrawPileReordered(fromIndex=0, toIndex=0, movedCardId=topCard)
-> DrawCards
-> HandDealt([topCard, ...])
```

这应是 no-op move，但仍发 `DrawPileReordered`，表示搜索命中且下一抽已确认。测试必须锁住没有复制牌。

## 4. 不破坏 Wild 修补

Wild 的修补事实在 `advanceCostChain` 内完成，并且发生在 `CardPlayed` 之前。`SearchAndTopdeck` 只能监听 `CardPlayed`，因此它不能参与以下字段的计算：

- `world.chain.playedCosts`
- `world.chain.nextExpectedCost`
- `world.chain.broken`
- `world.chain.repairedThisTurn`
- `event.effectMultiplier`
- `event.chainRepaired`
- `event.repairedCost`

实现规则：

1. `SearchAndTopdeck` 不写 chain。
2. `SearchAndTopdeck` 不发 `ChainAdvanced / ChainBroken / ChainRepaired`。
3. `SearchAndTopdeck` 不改变 `effectMultiplier`。
4. `SearchAndTopdeck` 不给 `wild_mana_stitch` 返 MP。
5. `card.self.resource` 中 `GainEnergy` 的既有条件继续只看 `card.energyGainCondition !== 'chain-repaired' || event.chainRepaired`。

负例：如果把 `SearchAndTopdeck` 做成 `CardPlayed` 前的 command，就会在 Wild 修补和倍率未结算时读错上下文。尤其是 `paper_shatter` 接在 `0 -> 1` 后作为 2 费展开段时，倍率必须先由 `advanceCostChain` 算成 3，再决定抽几张；置顶不能反过来决定倍率。

## 5. 不破坏授权和 payoff 支付

授权当前由完成 `0 -> 1 -> 2` 的 `advanceCostChain` 产生：

```text
ChainAdvanced(cardId=paper_shatter, playedCost=2, multiplier=3)
-> AuthorizationGranted(tempAuthorizationMP += 3, restriction=payoff-only)
-> CardPlayed(paper_shatter, effectMultiplier=3)
-> SearchAndTopdeck(payoff)
-> DrawCards(count=3)
```

这条顺序是正确的：`paper_shatter` 可以先完成链并授予本回合 payoff-only 授权，再把 3 MP payoff 置顶抽进手牌。随后玩家能否打出 payoff，仍由下一次 `validatePlayCard` 判断：

- 当前 MP + 可用授权是否足够。
- 授权限制是否为 `payoff-only`。
- 目标牌是否符合 `isPayoffFinisher`。

实现规则：

1. `SearchAndTopdeck` 不能写 `tempAuthorizationMP`。
2. `SearchAndTopdeck` 不能写 `authorizationRestriction`。
3. `SearchAndTopdeck` 不能写 `payoffArmed`。
4. `SearchAndTopdeck` 不能发 `AuthorizationGranted`。
5. `SearchAndTopdeck` 不能让非 payoff 牌绕过 `validatePlayCard` 使用授权。

负例：如果 `SearchAndTopdeck` 在 `DrawCards` 后执行，payoff 会留在牌堆顶，玩家本回合抽不到，授权在回合结束或 flow 切换时被清掉，形成“日志说找终结，但奖励没有进入这一手”的坏体验。

## 6. 不破坏奖励进入下一手

奖励进入下一手的合同在 `select-reward` 分支里：

```text
RewardChosen
-> ClearRewardChoices
-> DiscardHand
-> AddCardToDeck(deck.push + drawPile.unshift)
-> CompactEnemySlots
-> FillEnemySlots
-> AdvanceRound
-> DealHand
```

`paper_shatter` 置顶不能触碰这条链。硬规则：

1. `SearchAndTopdeck` 只能由 `CardPlayed` 派生。
2. `SearchAndTopdeck` 只能在 `PlayerTurn` 的出牌结算中出现。
3. `SearchAndTopdeck` P0 只搜 `drawPile`，不搜 `deck`。
4. `SearchAndTopdeck` 不改 `reward.choices`、`candidateCardPool`、`reward.pending`。
5. `AddCardToDeck` 的 `drawPile.unshift` 语义优先保留；奖励牌进入下一手由下一次 `DealHand` 的 `drawCardsFromDeck` 证明。

关键边界：奖励阶段也会用 `drawPile.unshift`，但那是回合/手牌之间的 setup；`paper_shatter` 的 topdeck 是同一张 `CardPlayed` 的 pre-draw 局内效果。两者都可以用 `drawPile[0]`，但不能在同一个 phase 互相覆盖。

## 7. 负例清单

### 7.1 后置置顶

错误顺序：

```text
CardPlayed
-> DrawCards
-> HandDealt
-> SearchAndTopdeck
```

问题：置顶只影响下一次抽牌，不能兑现 `paper_shatter` 的“抽前找终结”。如果本回合授权已生成，payoff 可能错过本回合支付窗口。

### 7.2 直接塞进手牌

错误行为：

```text
SearchAndTopdeck finds red_ledger_burst
-> hand.push(red_ledger_burst)
```

问题：绕过 `DrawCards`、`HandDealt`、倍率抽牌数和 `excludeFromReshuffle`，也会让测试无法区分“抽到了”还是“生成了”。

### 7.3 搜索 deck

错误行为：

```text
zones = ['deck']
```

问题：`deck` 是当前 run 拥有列表，不是实时牌区。从 deck 移动会破坏拥有列表；从 deck 复制会制造额外牌。P0 必须 drawPile-only。

### 7.4 搜索 discardPile

错误行为：

```text
zones = ['drawPile', 'discardPile']
```

问题：第 8 轮目标是 `paper_shatter` 的 drawPile-only payoff 置顶。搜弃牌堆会重新打开“刚打出的 self draw 是否能洗回/找回”的实例边界，并稀释 `excludeFromReshuffle` 护栏。

### 7.5 静默 miss

错误行为：

```text
no payoff found
-> no event
-> DrawCards
```

问题：QA 无法区分规则未运行、候选未命中、filter 未通过。必须发 `DeckSearchMissed`。

### 7.6 通用 reorder 同时打开 lantern_captain

错误行为：

```text
cards[event.cardId].utilities includes reorder
-> SearchAndTopdeck(payoff)
```

问题：`lantern_captain` 会和 `paper_shatter` 抢同一功能，导致两张 2 MP self draw 都变成 payoff tutor。P0 只允许 `paper_shatter`。

### 7.7 用 topdeck 修改授权

错误行为：

```text
SearchAndTopdeck finds payoff
-> tempAuthorizationMP += 3
```

问题：授权必须来自链路完成，不来自“找到了 payoff”。否则会破坏 payoff-only 授权来源和 Wild 修补合同。

### 7.8 置顶复制

错误行为：

```text
fromIndex = 0
-> drawPile.unshift(movedCardId)
```

问题：当候选已在牌顶时会复制一张。正确行为是 no-op reorder，并发 `DrawPileReordered(fromIndex=0, toIndex=0)`。

## 8. 测试建议

### 8.1 成功顺序测试

场景：

- hand: `['debt_hook', 'row_cleave', 'paper_shatter']`
- drawPile: `['some_non_payoff', 'red_ledger_burst', 'some_other']`
- energy 足够连续打出 0、1、2，或按现有测试 helper 直接准备。

断言：

- `ChainAdvanced(paper_shatter).multiplier === 3` 在 `CardPlayed(paper_shatter)` 前。
- `AuthorizationGranted` 在 `CardPlayed(paper_shatter)` 前。
- `DrawPileReordered.movedCardId === 'red_ledger_burst'`。
- debug command 顺序中 `SearchAndTopdeck` 早于同 trace 的 `DrawCards`。
- `HandDealt.cardIds[0] === 'red_ledger_burst'`。
- `DrawCards.count === paper_shatter.drawCards * CardPlayed.effectMultiplier`。

### 8.2 miss 不阻断抽牌

场景：

- drawPile 不含任何 `cardType: 'payoff'` / `rewardBranches: ['payoff']` / 3 MP all-enemies burst。

断言：

- 出现 `DeckSearchMissed`。
- 不出现 `DrawPileReordered`。
- `DrawCards` 仍出现。
- `HandDealt` 按原 drawPile 顶部抽牌。
- drawPile / hand / discardPile 总牌数守恒。

### 8.3 已在牌顶不复制

场景：

- drawPile: `['severance_burst', 'some_non_payoff']`

断言：

- 出现 `DrawPileReordered(fromIndex=0, toIndex=0, movedCardId='severance_burst')`。
- `HandDealt.cardIds[0] === 'severance_burst'`。
- `severance_burst` 总出现次数没有增加。

### 8.4 只搜 drawPile

场景：

- drawPile 无 payoff。
- discardPile 有 `red_ledger_burst`。

断言：

- 出现 `DeckSearchMissed`。
- discardPile 中的 `red_ledger_burst` 不移动。
- `HandDealt` 不包含 discardPile 的 payoff，除非后续既有 reshuffle 规则自然抽到；P0 测试应让 drawPile 非空，避免混入 reshuffle。

### 8.5 不捞刚打出的 paper_shatter

场景：

- paper_shatter 打出后进入 discardPile。
- drawPile 为空或无 payoff。

断言：

- `SearchAndTopdeck.excludeCardIds` 包含 `paper_shatter`。
- `DrawCards.excludeFromReshuffle` 仍包含 `paper_shatter`。
- 同次结算不会把 `paper_shatter` 抽回手牌。

### 8.6 Wild 修补回归

保留现有 Wild 测试，并新增一条交叉用例：

- 先打 `debt_hook`。
- 再打 `wild_mana_stitch` 修补到 1，产生 `ChainRepaired`，并按既有条件返 MP。
- 再打 `paper_shatter` 作为 2，完成授权。
- paper_shatter 触发 `SearchAndTopdeck` 和 `DrawCards`。

断言：

- `ChainRepaired` 只来自 `wild_mana_stitch`。
- `wild_mana_stitch` 的 `GainEnergy` 仍只在 `event.chainRepaired === true` 时发生。
- `paper_shatter` 不发 `ChainRepaired`。
- `paper_shatter` 的 topdeck 不改变 Wild 的 `effectiveCost / repairedCost`。

### 8.7 授权边界回归

场景：

- paper_shatter 完成 `0 -> 1 -> 2` 并抽到 3 MP payoff。
- 之后打出 `red_ledger_burst`。

断言：

- `red_ledger_burst` 可以使用 payoff-only 授权。
- `CardPaymentRecorded.source` 为 `authorization` 或 `mixed`，取决于当前 MP。
- 非 payoff 3 MP 牌不能使用该授权。
- `SearchAndTopdeck` 不增加 `tempAuthorizationMP`。

### 8.8 奖励进入下一手回归

沿用现有 reward/run progression 测试，并加一个污染防护：

- 在上一个 PlayerTurn 使用过 `paper_shatter`。
- 杀敌升级，进入 Reward。
- 选择 `severance_burst` 或任意 reward 牌。

断言：

- `RewardChosen -> ClearRewardChoices -> DiscardHand -> AddCardToDeck -> DealHand` 顺序不变。
- `CardAddedToDeck.cardId` 为所选 reward。
- 下一次 `HandDealt` 包含所选 reward。
- reward 阶段没有 `SearchAndTopdeck / DrawPileReordered / DeckSearchMissed`。

## 9. 实施口径

最小可执行改动应拆成三块，但仍保持行为闭环：

1. 类型层：新增 `SearchAndTopdeck` command，新增 `DrawPileReordered / DeckSearchMissed` event。
2. reducer 层：`applyCommand(SearchAndTopdeck)` 只操作 drawPile，发命中或 miss 事件。
3. ECA 层：新增 `card.self.paper-shatter.topdeck-payoff`，放在 `card.self.resource` 前。

不建议首版改成通用效果解释器，也不建议把所有 `reorder` utility 立刻绑定 runtime。第 8 轮真正要锁的是 queue ordering：同一 `CardPlayed` 的 `SearchAndTopdeck` 必须先于 `DrawCards`，并且不改变 Wild、授权、奖励三条已存在合同。

STATUS: DONE
