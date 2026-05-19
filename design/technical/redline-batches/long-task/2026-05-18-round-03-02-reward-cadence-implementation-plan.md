# 2026-05-18 Round 03-02 奖励节奏最小实现计划

角色：第 3 轮专家 02，奖励节奏实现规划师  
工作目录：`/Users/roc/Game-001`  
依据：`design/technical/redline-batches/long-task/2026-05-18-round-02-05-reward-deck-loop-pacing.md`、第 2 轮 synthesis、当前 `prototype-web` 代码基线。  
源码边界：本文只做实现计划，不改源码，不提交 git。  

## 0. 一句话裁决

本轮建议落地，但只落一个窄批次：

```text
首奖阈值 10
阈值表 [0, 10, 24, 45, 72, 110]
select-reward 非终局路径：AddCardToDeck 必须在下一次 DealHand 前执行
奖励牌进入 drawPile 顶部，下一手立刻成为可操作资源
run/meta 边界不变：奖励只进本次 run，restart 后清空，不写账号成长
```

不建议把本轮扩成地图、商店、账号存档、永久 Max MP、完整 deckbuilder 随机牌库。

## 1. 当前代码事实

当前代码与 round-02-05 的问题描述一致：

- `prototype-web/src/sim/world.ts` 初始化 `reward.xpThreshold = 45`，首奖不在 3-5 回合窗口。
- `prototype-web/src/sim/runtime.ts` 仍有旧阈值表 `LEVEL_XP_THRESHOLDS = [0, 18, 42, 78, 125, 185]`。
- `drawCardsFromDeck` 用 `drawPile.shift()` 抽牌，所以 `drawPile[0]` 才是下一张牌。
- `AddCardToDeck` 当前把奖励牌 `push` 到 `player.deck` 和 `player.drawPile` 末尾。
- 非终局 `select-reward` 当前顺序是先 `DealHand`，再 `AddCardToDeck`，所以选中的奖励牌不会进入刚发出的下一手。
- `run-layer-boundary` 已经测试了奖励只进当前 run、`restart-run` 回到 `startingHand`、外来 `metaProgression` 不改变 `maxEnergy` 或起始牌组。

因此本轮不是重建奖励系统，而是修正三个接缝：首奖时机、阈值单调、选牌后下一手反馈。

## 2. 最小实现范围

### 2.1 可动源码文件

| 文件 | 允许改动 | 不允许改动 |
| --- | --- | --- |
| `prototype-web/src/sim/world.ts` | 把初始奖励阈值接到同一张阈值表，首奖为 `10`。可放一个共享 `RUN_LEVEL_XP_THRESHOLDS` / `nextRunLevelXp`。 | 不新增账号档案、meta 存档、永久解锁字段。 |
| `prototype-web/src/sim/runtime.ts` | 使用同一张阈值表；升级后设置下一阈值时保证大于当前累计 XP；调整 `select-reward` 非终局顺序；让奖励牌进 `drawPile` 顶部。 | 不重写 runtime，不做 CardInstance，不做 exhaust/retain/status，不扩地图或商店。 |

建议不要新增文件。若实现者认为 `world.ts` 放阈值 helper 不舒服，可以新增 `prototype-web/src/sim/rewardProgression.ts`，但这不是首选，因为本轮越少文件越好。

### 2.2 可动测试文件

| 文件 | 需要覆盖 |
| --- | --- |
| `prototype-web/src/tests/sim/progression-reward-regression.test.ts` | 默认首奖阈值为 `10`；触发奖励后下一阈值单调；选择奖励后下一手包含所选奖励。 |
| `prototype-web/src/tests/sim/reward-branching.test.ts` | 保持三选一覆盖修补/资源、payoff、路线桥接。只需回归，不需要大改。 |
| `prototype-web/src/tests/sim/run-layer-boundary.test.ts` | 奖励牌进入当前 run 的 deck 和下一手，但 `maxEnergy` 不变；restart 后奖励不残留。 |
| `prototype-web/src/tests/sim/run-progression.test.ts` | 终局节点进入 `Settlement`，不要求下一手包含奖励。 |

可选回归：

- `prototype-web/src/tests/sim/redline-attribute-authorization.test.ts`：确认 `DealHand` 仍会清空本回合临时授权。
- `prototype-web/src/tests/ui/hud-target-selection.test.ts`：只在 HUD 文案被误触时跑，不把 HUD 列为本轮改动范围。

## 3. 首奖阈值计划

### 3.1 参数

采用 round-02-05 的推荐值：

```ts
const RUN_LEVEL_XP_THRESHOLDS = [0, 10, 24, 45, 72, 110];
```

语义保持为绝对累计 XP：

| 奖励 | 累计 XP | 目标窗口 | 目的 |
| --- | ---: | --- | --- |
| 首奖 | 10 | 第 2-3 回合 | 让玩家自然看到第一次奖励。 |
| 二奖 | 24 | 第 4-5 回合或高击杀脚本后段 | 让第一张奖励影响后续决策。 |
| 三奖 | 45 | demo 外或短 run 收束 | 防止 3-5 回合内奖励过密。 |

### 3.2 实现口径

不要让 `world.ts` 和 `runtime.ts` 各自维护一张表。最小可接受方式：

```text
world.ts 导出 RUN_LEVEL_XP_THRESHOLDS 和 nextRunLevelXp(level, currentXp?)
createInitialWorld().reward.xpThreshold = nextRunLevelXp(1)
runtime.ts 删除本地旧表，复用 nextRunLevelXp
GainXp 升级后：world.reward.xpThreshold = nextRunLevelXp(world.player.level, world.player.xp)
```

`nextRunLevelXp(level, currentXp)` 必须返回大于 `currentXp` 的下一阈值。这样即使一次击杀或测试夹具让 XP 跳过 24，也不会出现下一次击杀立刻再触发奖励的阈值回退。

## 4. select-reward 后奖励牌何时可操作

### 4.1 非终局节点

非终局选择奖励后的目标顺序：

```text
1. recordRunReward
2. RewardChosen event
3. ClearRewardChoices
4. DiscardHand
5. AddCardToDeck(selectedCard)
6. CompactEnemySlots
7. FillEnemySlots
8. AdvanceRound
9. DealHand
10. SetGameFlowState(PlayerTurn)
```

硬规则：

```text
CardAddedToDeck 必须早于下一次 HandDealt。
HandDealt.cardIds 必须包含 selectedCard。
world.player.hand 必须包含 selectedCard。
```

由于当前抽牌逻辑是 `drawPile.shift()`，P0 最小实现应把奖励牌放到抽牌堆顶部：

```text
player.deck.push(selectedCard)
player.drawPile.unshift(selectedCard)
```

这里的设计含义是：玩家选完奖励后，下一手立刻能用它。它不是永久解锁，也不是账号成长，只是本 run 的 deck 变化在下一次发牌中立即可见。

### 4.2 终局节点

如果 `advanceRunAfterReward` 返回 `runCompleted = true`：

```text
recordRunReward
RewardChosen
ClearRewardChoices
DiscardHand
AddCardToDeck(selectedCard)
SetGameFlowState(Settlement)
```

终局节点不发下一手，所以测试不能要求 `world.player.hand` 包含奖励牌。保留 `AddCardToDeck` 是为了让 `run.rewardHistory` 和当前 run deck 有完整证据，但它不会跨 `restart-run` 保留。

### 4.3 为什么不用随机抽牌

本轮目标是 3-5 回合 demo 的因果反馈，不是完整 roguelike 牌库随机性。奖励牌进入 `drawPile` 顶部会牺牲一点随机性，但换来更清楚的学习闭环：

```text
我缺修补 -> 选 Wild -> 下一手看到 Wild -> 立刻修补断链
我缺终结 -> 选 payoff -> 下一手看到 payoff -> 立刻围绕 0 -> 1 -> 2 决策
```

P1 如果要恢复随机性，应使用 `nextHandGuaranteedRewardCardId` staged slot，而不是退回 `drawPile.push()`。

## 5. run/meta 边界

本轮必须保持四层边界：

| 层级 | 本轮行为 |
| --- | --- |
| 当前回合 | `tempAuthorizationMP` 仍由 `0 -> 1 -> 2` 生成，发下一手或结束回合后清空。 |
| 当前战斗 / 下一手 | 选中的奖励牌在非终局路径进入下一手，成为可操作资源。 |
| 本次 run | 奖励牌加入 `player.deck` / `drawPile`，`run.rewardHistory` 记录选择。 |
| 局外 meta | 不读取外来 `metaProgression`，不改变基础 `maxEnergy`，不跨 `restart-run` 保留奖励。 |

禁止项：

- 不做永久 `Max MP +1`。
- 不做账号 XP、账号等级、局外货币。
- 不让奖励牌进入 `startingHand`。
- 不让 `restart-run` 保留本 run 选中的奖励。
- 不把 `runModifiers.ts` 的 preview-only 方案接入真实 runtime。

## 6. 测试范围

### 6.1 必补测试

1. 首奖阈值：

```text
const world = createInitialWorld()
expect(world.reward.xpThreshold).toBe(10)
```

2. 阈值单调：

```text
触发首奖后 player.level === 2
expect(world.reward.xpThreshold).toBe(24)
expect(world.reward.xpThreshold).toBeGreaterThan(world.player.xp)
```

如果测试用大额 XP 越过 24，则断言只保留：

```text
expect(world.reward.xpThreshold).toBeGreaterThan(world.player.xp)
```

3. 非终局奖励进入下一手：

```text
force pending reward with ['wild_mana_stitch', 'severance_burst', 'blood_reclaim']
selectReward('wild_mana_stitch')
expect(world.fsm.gameFlow).toBe('PlayerTurn')
expect(world.player.deck).toContain('wild_mana_stitch')
expect(world.player.hand).toContain('wild_mana_stitch')
expect(last HandDealt.cardIds).toContain('wild_mana_stitch')
```

4. 事件顺序：

```text
RewardChosen < CardAddedToDeck < HandDealt
```

5. 终局奖励：

```text
run.maxNodes = run.currentNode
selectReward(...)
expect(world.fsm.gameFlow).toBe('Settlement')
expect(world.run.status).toBe('victory')
不要求 hand 包含 selectedCard
```

6. run/meta 边界：

```text
select-reward outside Reward state does not mutate deck or maxEnergy
restart-run resets deck to startingHand
restart-run clears XP, level, reward pending, tempAuthorizationMP
foreign metaProgression cannot alter maxEnergy, deck, drawPile, hand
```

### 6.2 建议验收命令

窄范围先跑：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test -- src/tests/sim/progression-reward-regression.test.ts src/tests/sim/reward-branching.test.ts src/tests/sim/run-progression.test.ts src/tests/sim/run-layer-boundary.test.ts
```

通过后跑：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run
npm run build
```

浏览器 smoke 只做验收，不作为本轮源码范围：

```text
桌面 1366x768：打到首奖，选择 Wild/payoff，下一手可见。
移动 390x844：奖励面板可点，选后下一手牌可见，run/meta 文案不误导为永久成长。
```

## 7. 风险与处理

| 风险 | 表现 | 处理 |
| --- | --- | --- |
| 并行 worker 改动冲突 | `runtime.ts`、`world.ts` 已被其他人修改 | 实现前先看 `git status` 和目标文件 diff，只改奖励节奏相关行，不回滚别人的改动。 |
| 阈值表漂移 | `world.ts` 初始值与 `runtime.ts` 下一阈值不同步 | 使用同一个导出的表或 helper，不保留两个数字来源。 |
| XP 越级 | 一次测试或未来敌人奖励跨过多个阈值 | `nextRunLevelXp` 返回大于当前 XP 的阈值。 |
| 奖励过早打断 | 首回合极高击杀直接进入 Reward | 接受高击杀脚本可提前首奖；默认自然局目标仍是第 2-3 回合。必要时后续用遭遇脚本调敌人 XP，不在本轮扩系统。 |
| 抽牌确定性过强 | 奖励牌总在下一手第一张 | P0 接受；P1 再考虑 staged slot 或随机插入加保底。 |
| 卡牌 ID 非实例 | deck 中同名卡只是重复 `CardId`，无法区分实例 | 本轮不做 CardInstance；只测试包含关系和计数，避免写实例级断言。 |
| meta 边界被误破 | 奖励被写进 `startingHand` 或 `metaProgression` | `run-layer-boundary` 必须保留 restart 和 foreign meta 测试。 |

## 8. 是否建议本轮落地

建议本轮落地。

理由：

- 这是 round-02-05 明确指出的 P0 断点，且第 2 轮 synthesis 已把它列为第 3 轮优先主题。
- 改动面很小：理想状态只动 `world.ts`、`runtime.ts` 和 2-4 个 sim 测试。
- 它直接提升 3-5 回合 demo 可读性，让奖励不再只是日志或面板记录，而是下一次决策资源。
- 它不要求 CardInstance、通用效果解释器、生命周期区、地图、商店或 meta 存档。

落地条件：

```text
源文件改动不超过 2 个 sim 文件。
测试改动只围绕 reward progression / branching / run boundary。
全程不碰 startingHand、AccountProfile、永久 Max MP、runModifiers preview 接入。
窄测试通过后再跑全量 test 和 build。
```

如果实现时发现必须改 HUD、卡牌 taxonomy、enemy intent 或 run modifier 才能通过，应暂停并回主线程裁决，不要把本轮扩大。

STATUS: DONE  
路径：`/Users/roc/Game-001/design/technical/redline-batches/long-task/2026-05-18-round-03-02-reward-cadence-implementation-plan.md`
