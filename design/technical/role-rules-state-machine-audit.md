# Game-001 Web Prototype 规则状态机/仿真 QA 审查

审查范围：

- `/Users/roc/Game-001/prototype-web/src/sim/runtime.ts`
- `/Users/roc/Game-001/prototype-web/src/tests/sim/runtime.test.ts`
- 新增复现测试：`/Users/roc/Game-001/prototype-web/src/tests/sim/runtime-audit.test.ts`

审查目标是单局 loop 的规则层，不修改生产代码。本次只新增审查测试和本文档。

## 测试结果

命令：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- src/tests/sim/runtime.test.ts
```

结果：原有基线测试通过，`17 passed`。

命令：

```bash
cd /Users/roc/Game-001/prototype-web
npm test
```

结果：全量测试失败，新增审查测试暴露 2 个规则缺口：

- `runtime rule audit gaps > rejects play-card intents that arrive after end-turn in the same tick batch`
- `runtime rule audit gaps > keeps the front formation compact immediately after a front enemy is killed`

## 已确认正常的规则

- 开局状态是 `Deal`，第一轮 `advance-time` 会自动发牌并进入 `PlayerTurn`。
- 未发牌前不能出牌，`play-card` 会被 `player-turn` 条件拒绝。
- 普通时间推进不会让敌人攻击，也不会让能量随时间恢复。
- 玩家手动 `end-turn` 后会触发敌人攻击、弃手牌、推进回合、自动发下一轮手牌。
- 非致命伤不会把敌人从槽位移除，现有测试已覆盖 `debt_hook` 打到敌人剩余 HP 后仍保持 `alive=true` 和原槽位。
- 玩家死亡会进入 `Settlement`，停止后续敌人攻击、补位和发牌。

## 发现的问题

### 1. 同 tick `end-turn` 后的滞后出牌会打到下一轮

复现测试：

```ts
tickWorld(world, [
  { type: 'end-turn', traceId: 'audit-end-turn' },
  { type: 'play-card', cardId: 'redline_cut', targetId: 'enemy-1', traceId: 'audit-stale-card' }
]);
```

当前实际结果：

- `audit-end-turn` 在同一个 `tickWorld` 调用里完整执行敌人攻击、补位、`AdvanceRound`、`DealHand`，并把 `gameFlow` 设置回 `PlayerTurn`。
- 后续同 batch 的 `audit-stale-card` 看到的已经是新一轮 `PlayerTurn` 和新发手牌，因此被当作合法出牌。
- 全量测试中该断言失败：期望没有 `CardPlayed(audit-stale-card)`，实际存在。

风险：

- UI 同一帧里如果把“结束回合”和一次旧点击/旧快捷键一起提交，旧操作会消费下一轮资源。
- 玩家还没看到下一轮开始，仿真已经允许下一轮出牌，破坏“回合开始 -> 发牌 -> 玩家出牌”的可感知顺序。

建议测试名：

- `rejectsPlayCardAfterEndTurnInSameTickBatch`
- `doesNotConsumeNextRoundHandFromStaleSameFrameIntent`

建议修复方向：

- `end-turn` 成功后停止处理本 tick 剩余 intent，或给本 tick 打上 `turnClosed` 标记。
- 另一种方案是把输入分为 player-intent phase 和 simulation phase：一旦进入敌方结算，本帧不再消费玩家输入。

### 2. 前排击杀后阵型不会立即补齐 5 槽

复现测试：

```ts
tickWorld(world, [
  { type: 'play-card', cardId: 'redline_cut', targetId: 'enemy-1', traceId: 'audit-kill-front' },
  { type: 'play-card', cardId: 'debt_hook', targetId: 'enemy-1', traceId: 'audit-finish-front' }
]);
```

当前实际结果：

- `enemy-1` HP 到 0 后 `alive=false`。
- 活敌前 5 个槽位是 `[1, 2, 3, 4, 5]`，不是 `[0, 1, 2, 3, 4]`。
- `EnemiesRepositioned` 只在 `end-turn` 后的 `CompactEnemySlots` / `FillEnemySlots` 发生。

风险：

- 用户要求“前排 5 槽位应整齐填满；怪物被清掉后后排顶上”。当前仿真会在玩家回合内留下前排缺口。
- 如果敌人攻击发生在补位之前，击杀前排会减少本轮攻击人数；现有测试实际锁定了“攻击先于补位”的行为。这一点可能和用户当前规则预期冲突，需要主线程确认。

建议测试名：

- `compactsFormationImmediatelyAfterFrontEnemyKilled`
- `refillsFrontFiveSlotsBeforeEnemyAttackAfterPlayerKill`

建议修复方向：

- 如果设计要求“清掉即补位”，应在 `EnemyKilled` 后触发补位，或至少在敌人攻击前执行一次 `CompactEnemySlots`。
- 如果设计要求“回合结束后才补位”，需要把这条写成显式规则，并修改用户侧预期/表现文案。

### 3. 抽牌、弃牌、牌库耗尽规则没有被完整定义

代码现状：

- `DealHand` 如果 `drawPile.length >= count`，直接取 `drawPile.slice(0, count)`。
- 如果 `drawPile.length < count`，直接用 `startingHand` 作为新来源。
- 每次发牌都会 `discardPile = []`，会丢弃上一轮弃牌信息。
- 没有“抽剩余牌 -> 洗弃牌 -> 继续抽”的过程，也没有牌库耗尽事件。

风险：

- 如果当前玩法需要真实牌库循环，现实现会凭空重置为 `startingHand`。
- 如果当前玩法只是“每轮固定 6 张模板手牌”，字段名 `drawPile` / `discardPile` 会误导测试和后续实现。

建议测试名：

- `dealsRemainingDrawPileBeforeReshufflingDiscard`
- `doesNotEraseDiscardPileWithoutExplicitReshuffle`
- `doesNotDuplicateCardsAcrossHandDrawAndDiscard`
- `documentsFixedTemplateHandWhenDeckLoopIsDisabled`

### 4. 胜利/清场状态不存在

代码现状：

- 只有玩家死亡会进入 `Settlement`。
- 敌人全部死亡后，`FillEnemySlots` 会继续生成新敌人。
- 没有 wave budget、spawn queue empty、victory event 或 victory settlement。

风险：

- “死亡/胜利状态”只覆盖了死亡，胜利路径没有规则层表达。
- 单局 loop 如果需要清场胜利，当前仿真会变成无限补怪。

建议测试名：

- `entersSettlementWhenAllEnemiesAreClearedAndNoSpawnQueueRemains`
- `doesNotRefillEnemiesAfterVictory`
- `blocksPlayerIntentsAfterVictorySettlement`

### 5. `Deal` / `PlayerTurn` / `EnemyTurn` 跳转对外不可观察

代码现状：

- 类型中没有 `EnemyTurn`，只有 `EnemyAttack` 和 `EnemyRefill`。
- `end-turn` 在一次 `tickWorld` 内同步完成：`PlayerTurn -> EnemyAttack -> EnemyRefill -> PlayerTurn`。
- 调用者拿到返回值时通常已经回到 `PlayerTurn`，中间状态只存在于 debug trace。

风险：

- 如果 UI/动画需要看到“敌人回合”阶段，当前状态机不会停留在敌方阶段。
- 这和“手动结束后怪物攻击；下一轮自动发牌”的动画节奏可能冲突。
- 同步跳回 `PlayerTurn` 也是问题 1 的根因之一。

建议测试名：

- `endTurnTransitionsToEnemyTurnBeforeResolvingNextDeal`
- `doesNotExposePlayerTurnUntilEnemyResolutionCompletes`
- `recordsOrderedFlowTransitionsForDealPlayerEnemyRefill`

## 缺失测试清单

- 同 tick 顺序：
  - `play-card` 后 `end-turn` 同 tick 应如何处理。
  - `end-turn` 后 `play-card` 同 tick 必须被拒绝或延后。
- 抽弃牌：
  - 牌库不足 6 张时是否先抽剩余牌。
  - 弃牌堆是否参与洗牌。
  - 下一轮发牌后 `hand`、`drawPile`、`discardPile` 是否互斥且总量守恒。
- 补位：
  - 玩家回合击杀前排后是否立即补位。
  - 敌人攻击前是否保证前排 5 槽都被活敌填满。
  - 多个前排/中排同时死亡时，补位顺序是否稳定。
- 结算：
  - 玩家死亡后是否拒绝后续同 tick 玩家 intent。
  - 敌人全灭后是否进入胜利或继续生成。
  - `restart-run` 是否清空旧 trace / 旧 entity 状态。
- 目标选择：
  - 前排目标死亡后，同 tick 第二张牌自动目标应选择谁。
  - all-enemies 牌清场后是否触发胜利、补位或延迟补位。

## 建议主线程优先决策

1. 明确“敌人被清掉后后排顶上”是立即发生，还是只在敌方结算后发生。当前用户描述更像立即补位。
2. 明确 `EnemyTurn` 是否需要成为可停留的状态。如果需要动画和 QA，可把 `end-turn` 拆成多 tick 阶段。
3. 明确牌库模型：固定模板手牌，还是真实 draw/discard 循环。当前代码混用了两者的名字和行为。
4. 明确单局胜利条件。否则死亡/胜利测试只能覆盖死亡。

