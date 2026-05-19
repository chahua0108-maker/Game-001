# 2026-05-18 Round 03 Expert 03：发牌 / 抽牌循环工程审查

角色：第 3 轮专家 03，发牌 / 抽牌循环工程师  
工作目录：`/Users/roc/Game-001`  
审查范围：`drawCardsFromDeck`、`DealHand`、`DiscardHand`、`select-reward` 的顺序。  
源码边界：本轮不改源码、不提交 git；本文只给不引入 `CardInstance` 的最小改动建议。

## 0. 一句话结论

当前奖励牌“进入当前 run deck”的边界是对的，但非终局 `select-reward` 的顺序仍然慢一拍：下一手已经 `DealHand` 完，才执行 `AddCardToDeck`。所以玩家刚选的奖励牌或修补牌不会进入“下一次决策”，只能等后续抽牌循环。

最小改动不需要 `CardInstance`。只要把非终局奖励路径改成：

```text
RewardChosen
ClearRewardChoices
DiscardHand
AddCardToDeck(selectedCard, placement = next-hand-top)
CompactEnemySlots
FillEnemySlots
AdvanceRound
DealHand
```

硬规则：`AddCardToDeck` 必须早于下一次 `DealHand`；并且这次入牌不能只是 `drawPile.push` 到尾部，应该放到 `drawPile` 顶部，或进入一个只服务下一手的 staging 槽。

## 1. 当前代码事实

### 1.1 `drawCardsFromDeck`

当前 `drawCardsFromDeck(world, count, excludeFromReshuffle)` 的行为是：

- 只从 `player.drawPile` 抽牌，不直接从 `player.deck` 抽。
- `drawPile` 空时，把 `discardPile` 回填为新的 `drawPile`。
- `excludeFromReshuffle` 会把指定 `cardId` 留在 `discardPile`，避免刚打出的抽牌牌被同次洗回。
- 抽牌使用 `shift()`，所以越靠近 `drawPile[0]` 越早进入手牌。
- 没有随机洗牌、没有实例身份、没有来源追踪。

这意味着：只把奖励牌加入 `deck` 没有抽牌效果；奖励牌必须进入 `drawPile` 或下一手 staging，才会被 `DealHand` 看见。

### 1.2 `DealHand`

当前 `DealHand` 的关键行为是：

```text
snapshotRoundAttackEnemies
refreshEnemyIntents
dealtCards = drawCardsFromDeck(count)
resetCostChain
hand = dealtCards
energy = maxEnergy
HandDealt(cardIds)
```

重点风险是 `hand = dealtCards`：它不是补牌，而是替换整手牌。因此在 `DealHand` 前必须先处理好旧手牌去向；否则旧 hand 会被覆盖掉。

### 1.3 `DiscardHand`

当前 `DiscardHand` 很简单：

```text
discardPile.push(...hand)
hand = []
```

这个默认行为可以保留。它正好给 reward 后的下一次发牌提供旧手牌回填来源。短期不需要为这个问题引入逐张生命周期、retain、exhaust 或 `CardInstance`。

### 1.4 `select-reward`

当前非终局路径的事实顺序是：

```text
recordRunReward
advanceRunAfterReward
RewardChosen
ClearRewardChoices
DiscardHand
CompactEnemySlots
FillEnemySlots
AdvanceRound
DealHand
AddCardToDeck
```

问题在最后两步。`DealHand` 已经从旧 `drawPile / discardPile` 发出了下一手，随后 `AddCardToDeck` 才把奖励牌加入 `deck` 和 `drawPile`。结果是：

- 选中的 `wild_mana_stitch`、`wild_gap_key`、`severance_burst` 等牌不会出现在奖励后的第一手。
- UI 可以显示“最近奖励”，但玩家的下一次出牌决策看不到这张牌。
- 如果当前 `drawPile` 仍有旧牌，即使把 `AddCardToDeck` 提前但仍用 `push`，奖励牌也可能排在旧牌后面，仍不稳定。

## 2. 推荐改动

### 2.1 P0：调整非终局 `select-reward` 顺序

推荐最小顺序：

```text
1. 校验 reward state 和 choice
2. recordRunReward
3. runCompleted = advanceRunAfterReward
4. RewardChosen
5. ClearRewardChoices
6. DiscardHand
7. AddCardToDeck(selectedCard, placement = next-hand-top)
8. 如果 runCompleted：进入 Settlement
9. 否则：CompactEnemySlots
10. FillEnemySlots
11. AdvanceRound
12. DealHand
```

工程理由：

- `DiscardHand` 必须早于 `DealHand`，避免旧手牌被替换丢失。
- `AddCardToDeck` 必须早于 `DealHand`，否则错过下一手。
- `AddCardToDeck` 放在 `DiscardHand` 之后更容易读：旧手牌先进入弃牌堆，奖励牌再以“新获得牌”进入下一手优先区。
- `Compact / Fill / AdvanceRound` 与奖励入牌没有强依赖，可以保留在发牌前。

### 2.2 P0：奖励牌进入下一手顶部

推荐两种等价做法，优先选更小的一刀。

| 方案 | 推荐度 | 行为 | 代价 |
| --- | --- | --- | --- |
| `AddCardToDeck` 对 reward 使用 `drawPile.unshift(cardId)` | P0 推荐 | 选中牌进入下一次 `DealHand` 的第一张或至少本手 | 改动最小，但会让所有 `AddCardToDeck` 默认偏向即时反馈 |
| 增加 `placement?: 'draw-top' | 'draw-bottom'` | P0 可接受 | `select-reward` 用 `draw-top`，其他来源仍可 `draw-bottom` | 多改一处 `Command` 类型 |
| 增加 `nextHandGuaranteedCardIds: CardId[]` | P1 | 发牌时先取 staged cards，再补抽 | 更清晰，但比本轮需要稍重 |

本轮最小建议：

```text
AddCardToDeck:
  deck.push(cardId)
  drawPile.unshift(cardId)   // 或 placement === draw-top 时 unshift
  candidateCardPool remove cardId
```

如果实现 worker 担心全局改变 `AddCardToDeck` 语义，就用可选 `placement`，默认仍 `draw-bottom`，只在 `select-reward` 非终局路径传 `draw-top`。

### 2.3 P0：修补牌与 payoff 都用同一入口

不要为 `wild_mana_stitch`、`wild_gap_key` 单独写特殊规则。奖励选牌的即时可见应服务所有奖励牌：

- 选修补牌：下一手能立刻判断“我能不能补断链”。
- 选 payoff：下一手能立刻判断“我是否要按 `0 -> 1 -> 2 -> 3` 消费授权”。
- 选桥接 / 抽牌牌：下一手能立刻判断“我是否能延长路线”。

这里的目标是奖励反馈闭环，不是修补牌特权。

## 3. 不可改动项

本轮不要做这些事：

1. 不引入 `CardInstance`、`instanceId`、单卡来源追踪、同名牌不同状态。
2. 不把 `deck` 改成真正抽牌队列；当前语义仍应是“当前 run 拥有牌列表”。
3. 不让 `drawCardsFromDeck` 直接从 `deck` 抽牌。抽牌来源仍是 `drawPile`，空了再回填 `discardPile`。
4. 不移除 `excludeFromReshuffle`。它是防止 self draw 立即抽回刚打出牌的关键护栏。
5. 不把 `DealHand` 改成无条件追加到现有 hand。retain / top-off hand 是另一个生命周期议题。
6. 不把 `DiscardHand` 扩成 exhaust / retain / temporary purge。那些可以以后按卡牌生命周期做，但不是本轮最小解。
7. 不把奖励牌写成局外永久成长、永久 Max MP、账号卡组解锁。
8. 不为了“更快看到奖励”扩大 hand size、提高基础 MP、加 reroll、改奖励池分支算法。
9. 不只做 HUD 文案。玩家必须在下一手实际 hand 中看到选中的牌，不能只显示“最近奖励”。

## 4. 测试建议

### 4.1 非终局奖励必须进入下一手

新增或更新 sim 测试：

```text
force pending reward:
  gameFlow = Reward
  run.currentNode < run.maxNodes
  hand = ['debt_hook', 'redline_cut']
  drawPile = ['heartbeat_spark', 'row_cleave']   // 故意保留旧抽牌堆，防止 push 误通过
  discardPile = []
  reward.choices = ['wild_mana_stitch', 'severance_burst', 'wild_gap_key']

selectReward('wild_mana_stitch')

expect(gameFlow).toBe('PlayerTurn')
expect(player.deck).toContain('wild_mana_stitch')
expect(player.hand).toContain('wild_mana_stitch')
expect(last HandDealt.cardIds).toContain('wild_mana_stitch')
```

关键点：`drawPile` 必须非空。这样才能证明不是“刚好空牌堆所以 push 也能抽到”，而是真的 next-hand top / staging 生效。

### 4.2 事件顺序测试

从 `world.debug.events` 抽事件顺序，建议断言：

```text
RewardChosen < CardAddedToDeck < HandDealt
```

如果实现选择 `CardAddedToDeck` 仍在 `HandDealt` 后，测试必须失败。

### 4.3 更新旧边界测试预期

现有边界测试有一类断言是：

```text
expect(world.player.drawPile).toContain(selectedCard)
```

如果选中奖励牌被立即发到 hand，这个断言不应再作为非终局成功标准。建议改为：

```text
expect(world.player.deck).toContain(selectedCard)
expect([...world.player.hand, ...world.player.drawPile, ...world.player.discardPile]).toContain(selectedCard)
expect(world.player.hand).toContain(selectedCard) // 非终局 next-hand-guaranteed 场景
```

终局 `Settlement` 场景不要求 hand 包含奖励牌。

### 4.4 `drawCardsFromDeck` 护栏测试

保留或补一条 self draw 回归：

```text
hand contains draw card
drawPile = []
discardPile = [playedDrawCard, anotherCard]
play draw card
expect drawn cards).not.toContain(playedDrawCard)
```

这条测试保护 `excludeFromReshuffle`，防止为了加速奖励可见而破坏抽牌循环。

### 4.5 浏览器验收

固定脚本验收一条玩家可见链路：

```text
Round 1-2 触发 Reward
点击 wild_mana_stitch 或 wild_gap_key
下一手 hand 直接出现刚选的修补牌
该牌可点击、能产生 ChainRepaired / draw / mana 相关反馈
```

再验一条 payoff：

```text
点击 severance_burst
下一手 hand 直接出现 payoff
玩家能围绕 0 -> 1 -> 2 -> 3 做决策
```

移动端用 `390x844` 至少跑一次，重点看奖励面板点击后下一手是否可见、手牌区是否被按钮遮挡。

## 5. 实现优先级

如果实现 worker 只做一刀，顺序如下：

1. 非终局 `select-reward`：把 `AddCardToDeck` 移到 `dealIntoPlayerTurn` 之前。
2. `AddCardToDeck`：奖励入 `drawPile` 顶部，而不是尾部；或加 `placement: 'draw-top'`。
3. 测试：用非空 `drawPile` 证明选中的奖励牌仍进入下一手。
4. 更新旧测试：非终局不再要求奖励牌还留在 `drawPile`，而是要求进入 hand；终局仍不要求下一手。

## 6. 本轮状态

- 已审查当前发牌 / 抽牌 / 弃牌 / 奖励选择顺序。
- 未修改任何源码。
- 未提交 git。

STATUS: DONE  
路径：`/Users/roc/Game-001/design/technical/redline-batches/long-task/2026-05-18-round-03-03-draw-loop-engineer.md`
