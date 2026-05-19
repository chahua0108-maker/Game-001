# 2026-05-18 Round 03-08 工程风险控制审查

角色：第 3 轮专家 08，风险控制工程审查  
范围：审查第 3 轮如果调整奖励阈值、发牌顺序、奖励牌入牌顶，会影响哪些测试和既有机制；给出最小安全改动范围。  
限制：本文件只做审查，不改源码、不提交 git。

## 结论

第 3 轮可以改，但只能把它当成一个窄的“奖励节奏合同”补丁，不要扩成完整 deckbuilder 重构。

最小安全范围是：

1. 把首奖阈值从当前 `45` 调到 `10` 左右，并同步累计 XP 阈值表，保证下一阈值永远大于当前 XP。
2. 只改 `select-reward` 的非终局路径：选牌后先把奖励牌加入当前 run 的 deck / draw pile 顶部，再进入下一回合 `DealHand`。
3. 只补奖励节奏与入牌顺序测试；不改 `startingHand` 内容、不改 `HAND_SIZE`、不改奖励分支生成器、不改敌人 XP、不改 run/meta 边界。

当前基线已跑过以下现有测试，作为审查时的安全网：8 个测试文件、34 个用例通过。

```bash
cd /Users/roc/Game-001/prototype-web
npm run test -- src/tests/sim/progression-reward-regression.test.ts src/tests/sim/reward-branching.test.ts src/tests/sim/run-progression.test.ts src/tests/sim/run-layer-boundary.test.ts src/tests/sim/core-loop-regression.test.ts src/tests/sim/redline-progression-card-system.test.ts src/tests/sim/redline-hyperturn-acceptance.test.ts src/tests/sim/runtime-audit.test.ts
```

## 当前机制观察

- 初始世界在 `prototype-web/src/sim/world.ts` 写死 `reward.xpThreshold = 45`，而 `prototype-web/src/sim/runtime.ts` 的 `LEVEL_XP_THRESHOLDS` 是 `[0, 18, 42, 78, 125, 185]`。如果只把首奖改小而不检查下一阈值，未来可能出现阈值回退或过密奖励。
- `GainXp` 达阈值后会立刻把 `fsm.gameFlow` 切到 `Reward`，并生成 `RewardChoicesGenerated`。降低阈值后，更多击杀测试会更早被 Reward 阶段打断。
- 当前 `select-reward` 非终局路径的顺序是：`ClearRewardChoices -> DiscardHand -> CompactEnemySlots -> FillEnemySlots -> AdvanceRound -> DealHand -> AddCardToDeck`。这意味着奖励牌进了 `drawPile`，但错过刚发出的下一手。
- `AddCardToDeck` 当前是 `deck.push(cardId)` 和 `drawPile.push(cardId)`。由于 `drawCardsFromDeck` 使用 `shift()` 抽牌，`push()` 等于放到底，不是牌顶。
- `restart-run` 会重新 `createInitialWorld`，当前 run 内奖励不会变成局外成长；这个边界必须保留。

## 风险表

| 改动点 | 受影响机制 | 可能破坏的测试 / 合同 | 风险级别 | 最小控制策略 |
|---|---|---|---|---|
| 首奖阈值 `45 -> 10` | `GainXp`、`LevelUpReached`、`RewardChoicesGenerated`、`Reward` 阶段切换 | 任何默认阈值下的击杀测试；尤其一回合内多击杀后可能提前进入 Reward，后续 `play-card` 因非 `PlayerTurn` 被拒绝 | 高 | 只改初始阈值与阈值表；新增 `reward-cadence-contract.test.ts` 验证首奖默认值、下一阈值单调、一次 pending 不连锁 |
| 阈值表调整 | `nextLevelXp(level)`、XP 累计节奏 | 现有测试多用 `xpThreshold = 1`，对默认表保护不足 | 中 | 阈值表使用绝对累计 XP，如 `[0, 10, 24, 45, 72, 110]`；测试断言 `world.reward.xpThreshold > world.player.xp` |
| `AddCardToDeck` 从 `drawPile.push` 改成 `unshift` | 牌堆顶部语义、下一次 `DealHand` | `run-layer-boundary.test.ts` 当前断言奖励在 `drawPile`；`progression-reward-regression.test.ts` 当前只断言 `drawPile` 包含奖励 | 高 | 同步改断言为“非终局奖励选后下一手包含所选牌”；保留 deck 包含与 restart 清空断言 |
| `select-reward` 中 `AddCardToDeck` 移到 `DealHand` 前 | 事件顺序、debug trace、HUD run layer 最近奖励 | 依赖 `HandDealt` / `CardAddedToDeck` 顺序的测试会变 | 高 | 明确事件合同：非终局路径必须 `CardAddedToDeck` 早于下一次 `HandDealt`，并让 `HandDealt.cardIds` 包含奖励 |
| 调整 `startingHand` 顺序或内容 | 开局手牌、0->1->2 合同、restart baseline | `runtime.test.ts`、`redline-hyperturn-acceptance.test.ts`、`run-layer-boundary.test.ts`、`redline-progression-card-system.test.ts` | 高 | 第 3 轮不要改 `startingHand` 内容；如只改顺序，也必须保留 0/1/2、无起手 payoff、restart 回到 `startingHand` |
| 奖励牌进入下一手后改变手牌组成 | 费用链、坏手修补、payoff 可见性 | `redline-hyperturn-acceptance.test.ts` 的固定救场脚本、draw repair 用例 | 中 | 新测试只锁“选中的奖励可见”，不锁完整手牌顺序；避免把全局发牌器改成专用脚本 |
| Reward 阶段提前打断玩家回合 | 同 tick / 连续输入、`playerInputClosed` 只处理 end-turn 后输入 | `runtime-audit.test.ts` 只覆盖 end-turn 后 stale input，不覆盖 kill 触发 Reward 后的同批输入 | 中 | 补小测试：Reward pending 后同 tick 后续 `play-card` 不应被执行，且失败原因可解释为非 `PlayerTurn` |
| 多敌同次 payoff 大量 XP | 单次事件队列内多次 `GainXp`、pending gating | 现有 `world.reward.pending` 防连发，但没有覆盖 XP 跳过多个阈值后的行为 | 中 | P0 合同定为“一次 pending 奖励，不做 catch-up 多升级”；测试只要求下一阈值单调，不要求一次清算补发多奖 |
| 终局 reward 选择 | `runCompleted` 后 Settlement，不再发下一手 | `run-progression.test.ts` 的 final node settlement | 中 | 分支测试区分：非终局 reward 保证下一手可见；终局 reward 只记录历史 / deck 证据并进入 Settlement |
| UI 奖励面板与下一手可见 | HUD 卡牌区、移动端高度、reward 面板关闭后手牌变化 | UI 测试目前主要是 HUD helper，没有浏览器端 reward 点击回归 | 中 | 如果 UI 被改，至少补一次 `390x844` 手动或浏览器 QA；工程测试先保证 snapshot / runtime 状态正确 |
| 奖励池或 reward branching 同步改动 | 三选一覆盖修补资源 / payoff / 路线桥接 | `reward-branching.test.ts`、`card-taxonomy.test.ts` | 中 | 不在本轮改 `rewardChoices.ts`；如果必须改池顺序，保留三分支测试和 catalog 校验 |

## 最小安全改动范围

### 允许改

| 文件 | 最小改动 |
|---|---|
| `prototype-web/src/sim/world.ts` | 只把初始 `reward.xpThreshold` 改到首奖目标值，例如 `10`。 |
| `prototype-web/src/sim/runtime.ts` | 同步 `LEVEL_XP_THRESHOLDS`；调整 `select-reward` 非终局路径，使 `AddCardToDeck` 发生在下一次 `DealHand` 前；把奖励牌放到 draw pile 顶部。 |
| `prototype-web/src/tests/sim/reward-cadence-contract.test.ts` | 新增小型合同测试：默认首奖阈值、下一阈值单调、非法选择不变更状态、非终局选牌后下一手可见、终局不发下一手。 |
| `prototype-web/src/tests/sim/progression-reward-regression.test.ts` | 把旧的 `drawPile contains selected` 改为“下一手 hand 包含 selected”，保留 deck / round / PlayerTurn 断言。 |
| `prototype-web/src/tests/sim/run-layer-boundary.test.ts` | 非终局 reward 的断言从 drawPile 可见改为 hand 可见；restart baseline 断言不变。 |

### 不应改

- 不改 `startingHand` 内容，避免同时触发开局手牌、restart baseline、0->1->2 验收变化。
- 不改 `HAND_SIZE`，否则会牵动 runtime、HUD、移动端布局和多个手牌长度断言。
- 不改 `rewardChoices.ts` 的三分支选择策略。
- 不改敌人 `xpReward`，否则阈值变化和压力曲线变化会混在一起，难以回滚。
- 不改 `run.maxNodes`、Settlement 规则或局外 meta 结构。
- 不引入随机洗牌或 seed；当前测试依赖确定性 `drawPile.shift()`，本轮只需要“牌顶可见”。

## 推荐实现顺序

非终局 `select-reward` 的安全事件顺序应固定为：

```text
validate reward state and choice
recordRunReward
advanceRunAfterReward
RewardChosen
ClearRewardChoices
DiscardHand
AddCardToDeck(selectedCard, draw-pile-top)
CompactEnemySlots
FillEnemySlots
AdvanceRound
DealHand
```

这里 `AddCardToDeck` 仍然只代表当前 run 内牌组变化，不代表局外成长。若 `runCompleted = true`，则不要强行保证下一手可见，因为已经进入 Settlement。

## 回滚点

| 回滚点 | 回滚内容 | 预期恢复 |
|---|---|---|
| R1：奖励阈值 | 恢复 `world.ts` 初始 `xpThreshold` 和 `runtime.ts` 阈值表 | 奖励回到旧节奏，默认短局不自然触发首奖 |
| R2：入牌位置 | 恢复 `AddCardToDeck` 的 `drawPile.push(cardId)` | 奖励牌回到底部 / 后续抽牌循环，不保证下一手可见 |
| R3：发牌顺序 | 恢复 `select-reward` 非终局路径中 `DealHand` 早于 `AddCardToDeck` | 事件顺序回到旧合同，旧 drawPile 断言恢复 |
| R4：测试合同 | 回滚新增 `reward-cadence-contract.test.ts` 和两处入牌断言更新 | 测试回到“奖励存在但不保证下一手可见”的旧安全网 |

并行 worker 注意：当前工作树已有多处 `prototype-web` 和 `long-task` 文档变更。真正落地前应先看目标文件局部 diff，只提交上述窄范围，不要用重置类命令清理他人改动。

## 验收命令

最小验收：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test -- src/tests/sim/reward-cadence-contract.test.ts src/tests/sim/progression-reward-regression.test.ts src/tests/sim/run-layer-boundary.test.ts src/tests/sim/reward-branching.test.ts src/tests/sim/run-progression.test.ts
```

回归验收：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test -- src/tests/sim/core-loop-regression.test.ts src/tests/sim/runtime-audit.test.ts src/tests/sim/redline-progression-card-system.test.ts src/tests/sim/redline-hyperturn-acceptance.test.ts src/tests/sim/card-taxonomy.test.ts src/tests/ui/hud-target-selection.test.ts
```

完整验收：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test
npm run build
```

如果 UI 也被改动，再补移动端人工或浏览器验收：

```bash
cd /Users/roc/Game-001/prototype-web
npm run dev -- --host 127.0.0.1
```

检查重点：`390x844` 下选择奖励后面板关闭、下一手能看到奖励牌、手牌按钮不被 reward / run layer 遮挡。

## 最终裁决

第 3 轮最小安全补丁不是“重做发牌系统”，而是锁一个可回滚的奖励节奏合同：

- 首奖默认可在 3-5 回合窗口出现；
- 阈值表单调，不回退；
- 非终局奖励选中后进入下一手；
- 奖励仍只属于当前 run；
- 起手、手牌大小、三分支奖励、局外成长边界全部不动。

STATUS: DONE

路径：`/Users/roc/Game-001/design/technical/redline-batches/long-task/2026-05-18-round-03-08-engineering-risk-review.md`
