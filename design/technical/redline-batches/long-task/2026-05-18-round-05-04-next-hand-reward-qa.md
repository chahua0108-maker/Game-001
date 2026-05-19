# 第5轮专家04：奖励选择后下一手体验 QA 设计

## 范围

本文件只设计测试与验收路径，不改 runtime、UI 或测试源码。目标是覆盖玩家在奖励面板选择 `blood_tithe` / `pulse_draw` 后，系统是否正确进入下一手，并且下一手是否真的可操作。

这里必须区分两类奖励：

- 非终局奖励：当前 run 还没有完成，选择奖励后应进入下一节点、发下一手，并允许玩家继续出牌或结束回合。
- 终局奖励：当前 run 已到最后节点，选择奖励后应进入 `Settlement`，不应发下一手，也不应允许继续战斗输入。

注意：`blood_tithe` / `pulse_draw` 不是“终局 payoff”。这里的“终局奖励”指 run 节点已经完成后的奖励选择结果，而不是卡牌类型。

## 现有 runtime 事实

- `select-reward` 只有在 `fsm.gameFlow === 'Reward'` 且 `reward.pending === true` 时有效；否则记录 `reward-state` 失败条件。
- 有效选择会先记录 `RewardChosen`，清空 `reward.choices` / `reward.pending`，并把当前手牌丢弃。
- 非终局路径：`AddCardToDeck -> CompactEnemySlots -> FillEnemySlots -> AdvanceRound -> DealHand -> PlayerTurn`。
- 终局路径：`AddCardToDeck -> Settlement`，不会 `AdvanceRound`，不会 `DealHand`，也不会回到 `PlayerTurn`。
- `AddCardToDeck` 会把选中的奖励卡加入本局 deck，并 `unshift` 到 draw pile；非终局随后发牌，因此被选中的奖励卡应该进入下一手。
- 现有边界测试已经覆盖了“奖励只属于当前 run，restart-run 回到 startingHand”，但还需要把 `blood_tithe` / `pulse_draw` 选择后的下一手可操作性单独钉住。

## Sim 测试设计

建议新增一个聚焦文件，例如 `prototype-web/src/tests/sim/reward-next-hand-operability.test.ts`。测试不要依赖完整战斗随机过程，应直接构造 Reward 状态，这样可以稳定覆盖 `blood_tithe` / `pulse_draw`。

### 公共 helper 设计

需要的 helper：

- `forceRewardReady(world, choices, terminal = false)`：把 world 放入 `Reward`，设置 `reward.pending = true`、`source = 'level-up'`、`choices`，并设置可控的 draw/discard/hand。
- `selectReward(world, cardId, traceId)`：发 `select-reward` intent。
- `playSelectedReward(world, cardId, traceId)`：在下一手里尝试打出选中的 self card。
- `eventsByTrace(world, traceId)` / `failedByTrace(world, traceId)`：只看本次 trace，避免被历史事件污染。

推荐基础场景：

```ts
world.fsm.gameFlow = 'Reward';
world.run.currentNode = terminal ? 1 : 1;
world.run.maxNodes = terminal ? 1 : 3;
world.round = 4;
world.reward = {
  ...world.reward,
  pending: true,
  source: 'level-up',
  choices: ['blood_tithe', 'pulse_draw', 'severance_burst'],
  candidateCardPool: ['blood_tithe', 'pulse_draw', 'severance_burst'],
  pickCount: 3
};
world.player.hand = ['debt_hook', 'redline_cut'];
world.player.drawPile = ['row_cleave', 'heartbeat_spark', 'verdict_mark', 'blood_reclaim'];
world.player.discardPile = [];
world.player.energy = 0;
world.player.tempAuthorizationMP = 3;
world.player.authorizationRestriction = 'payoff-only';
world.player.payoffArmed = true;
```

这个 setup 故意把奖励前的战斗状态弄脏：手牌、能量、授权、chain 都不干净。非终局选择后应由 `DealHand` 重置成下一手可操作状态；终局选择后不应伪造下一手。

### Case 1：非终局选择 `blood_tithe` 后进入下一手并可操作

Given：

- `run.currentNode < run.maxNodes`
- `Reward` 状态中包含 `blood_tithe`

When：

- `select-reward blood_tithe`

Then：

- `RewardChosen` 存在，`cardId === 'blood_tithe'`
- `run.status === 'in-progress'`
- `run.currentNode` 从 1 变为 2
- `round` 从 4 变为 5
- `fsm.gameFlow === 'PlayerTurn'`
- `reward.pending === false`
- `reward.choices === []`
- `player.deck` 包含 `blood_tithe`
- `player.hand` 包含 `blood_tithe`
- `player.drawPile` 不再包含 `blood_tithe`
- `player.hand.length === 4`
- `player.energy === player.maxEnergy`
- `player.tempAuthorizationMP === 0`
- `player.authorizationRestriction === null`
- `player.payoffArmed === false`
- `HandDealt` 事件使用同一个选择 trace，证明这是奖励选择驱动的下一手，而不是后续手动 deal。

继续 When：

- 在同一 world 上 `play-card blood_tithe`

Then：

- `CardPlayed` 存在，`cardId === 'blood_tithe'`
- 没有 `player-turn`、`card-in-hand`、`enough-energy`、`reward-state` 失败条件
- 如果 draw pile 有牌，允许出现 `HandDealt` 抽牌事件；如果没有牌，不要求立即抽回自己。

### Case 2：非终局选择 `pulse_draw` 后进入下一手并可操作

与 Case 1 同构，使用 `it.each(['blood_tithe', 'pulse_draw'])` 可以减少重复，但断言需要保留卡名。`pulse_draw` 额外关注：

- `player.energy === player.maxEnergy`，否则 1 费 self card 可能因为奖励前能量为 0 而误判不可操作。
- 打出 `pulse_draw` 后 `CardPlayed.effectMultiplier` 至少存在；不要把这个 case 绑定到特定 chain 倍率，除非 setup 明确先打 0 费牌。
- 不要求它降低敌人意图；UI helper 已经把 `pulse_draw` 归为“抽牌找解”，sim 验收重点是可打出、可抽牌、不卡 Reward。

### Case 3：非终局奖励结算后旧奖励不能继续点击

Given：

- 已经成功选择 `blood_tithe` 或 `pulse_draw` 并进入 `PlayerTurn`

When：

- 再次发送 `select-reward`，选择同一批旧 choices 中另一个卡

Then：

- 不新增第二张奖励卡
- `failedConditions` 包含 `conditionId: 'reward-state'`
- `fsm.gameFlow` 仍为 `PlayerTurn`
- 下一手仍可 `end-turn` 或继续出牌

这个 case 防止浏览器 reward overlay 没关干净、重复点击导致 deck 污染。

### Case 4：终局选择 `blood_tithe` 不发下一手，进入 Settlement

Given：

- `run.currentNode === run.maxNodes`
- `Reward` 状态中包含 `blood_tithe`

When：

- `select-reward blood_tithe`

Then：

- `RewardChosen` 存在，`cardId === 'blood_tithe'`
- `run.status === 'victory'`
- `run.currentNode` 不前进
- `round` 不前进
- `fsm.gameFlow === 'Settlement'`
- `reward.pending === false`
- `reward.choices === []`
- `player.deck` 包含 `blood_tithe`
- `player.hand` 不包含 `blood_tithe`
- 本次选择 trace 下没有 `HandDealt`
- 后续 `play-card blood_tithe` 被拒绝，失败条件为 `player-turn`
- 后续 `end-turn` 被拒绝，失败条件为 `player-turn`

### Case 5：终局选择 `pulse_draw` 不发下一手，进入 Settlement

与 Case 4 同构。重点是证明 `pulse_draw` 即使是 draw/repair 类型，也不会在终局奖励后触发“下一手可操作”的断言。

### 推荐测试矩阵

| 场景 | selectedCardId | run 节点 | 期望 flow | 期望手牌 | 后续输入 |
| --- | --- | --- | --- | --- | --- |
| 非终局奖励 | `blood_tithe` | `1 / 3` | `PlayerTurn` | 包含 `blood_tithe`，共 4 张 | `play-card blood_tithe` 成功 |
| 非终局奖励 | `pulse_draw` | `1 / 3` | `PlayerTurn` | 包含 `pulse_draw`，共 4 张 | `play-card pulse_draw` 成功 |
| 终局奖励 | `blood_tithe` | `1 / 1` | `Settlement` | 不发下一手 | `play-card` / `end-turn` 拒绝 |
| 终局奖励 | `pulse_draw` | `1 / 1` | `Settlement` | 不发下一手 | `play-card` / `end-turn` 拒绝 |

## 浏览器验收路径设计

浏览器验收不要靠自然战斗刷出奖励，因为 `blood_tithe` / `pulse_draw` 是否出现在 reward choices 会受候选池和当前状态影响。建议使用 QA preset 或测试注入，让页面启动时进入指定 Reward 状态：

- `reward-next-hand=non-terminal&choice=blood_tithe`
- `reward-next-hand=non-terminal&choice=pulse_draw`
- `reward-next-hand=terminal&choice=blood_tithe`
- `reward-next-hand=terminal&choice=pulse_draw`

如果当前浏览器层还没有 QA preset，验收脚本应先通过测试专用入口注入 snapshot/world，而不是通过 UI 源码临时硬编码。这里的设计目标是固定验收路径，不要求本轮实现入口。

### Browser Path A：非终局 `blood_tithe`

1. 启动页面到非终局 Reward preset，截图 `reward-before-blood_tithe.png`。
2. 断言 Reward 面板可见，`Blood Tithe` 奖励按钮可见且可点。
3. 点击 `Blood Tithe`。
4. 等待 UI 从 Reward 切到 PlayerTurn。
5. 断言 Reward 面板消失，Settlement 不可见。
6. 断言 run/node 文案从 `1 / 3` 变为 `2 / 3` 或等价状态。
7. 断言下一手区域出现 4 张牌，并包含 `Blood Tithe`。
8. 断言 End Turn 按钮可用。
9. 点击手牌中的 `Blood Tithe`。
10. 断言它被成功打出：卡牌离开手牌，或 debug/event 面板出现 `CardPlayed blood_tithe`，且没有失败条件提示。
11. 截图 `next-hand-blood_tithe-played.png`。

### Browser Path B：非终局 `pulse_draw`

与 Path A 相同，但选择和点击 `Pulse Draw`。额外断言：

- 点击奖励后玩家 MP 显示回到满值，而不是沿用奖励前的 0 MP。
- 点击 `Pulse Draw` 后，UI 不应跳回 Reward，也不应显示“能量不足”。
- 若抽牌可见，手牌数量变化应符合 draw 效果；若抽牌动画异步，至少要有 `CardPlayed pulse_draw` 或等价成功反馈。

### Browser Path C：终局 `blood_tithe`

1. 启动页面到终局 Reward preset，截图 `terminal-reward-before-blood_tithe.png`。
2. 断言 Reward 面板可见，`Blood Tithe` 奖励按钮可见且可点。
3. 点击 `Blood Tithe`。
4. 等待页面进入 Settlement / Victory 状态。
5. 断言 Reward 面板消失。
6. 断言没有发下一手：手牌区域为空、隐藏，或卡牌按钮全部不可用。
7. 断言 End Turn 不可用。
8. 断言没有 `HandDealt` 事件跟随本次 reward selection。
9. 尝试点击战斗卡牌或 End Turn 时，不应产生 `CardPlayed` / `TurnEnded`。
10. 截图 `terminal-settlement-blood_tithe.png`。

### Browser Path D：终局 `pulse_draw`

与 Path C 相同，但选择 `Pulse Draw`。重点是防止 draw card 在终局奖励后触发“自动下一手”错觉。

## 验收通过标准

非终局通过标准：

- 奖励点击后 1 个交互周期内进入 `PlayerTurn`。
- 下一手 4 张牌可见，选中的 `blood_tithe` / `pulse_draw` 在手牌中。
- 选中的卡可以被玩家作为下一步输入打出。
- `reward.pending` 清空，旧 reward choices 不可重复选择。
- 能量、授权和 chain 状态按下一手重置。

终局通过标准：

- 奖励点击后进入 `Settlement` / victory。
- 不发下一手，不回到 `PlayerTurn`。
- `play-card` / `end-turn` 不能继续推动战斗。
- 奖励仍可被记录到 run history，但不被浏览器表现成“马上可以打出的下一手卡”。

## 风险与观察点

- 最容易误测的点是把“选择的是 `blood_tithe` / `pulse_draw`”误当作非终局条件。真正的分支条件是 `run.currentNode >= run.maxNodes`。
- 浏览器层若只看 DOM 文案，可能漏掉 runtime 已经处于 Settlement 但手牌 UI 残留的问题；验收必须同时看 phase/run 状态和按钮可用性。
- 非终局路径要验证“下一手可操作”，不能只验证“卡进入 deck”。最低可操作证据是 `CardPlayed` 或 `TurnEnded` 成功。
- 终局路径要验证“没有下一手”，不能把手牌为空当作失败；终局手牌为空是正确结果。
