# 2026-05-18 Round 02-05 奖励与牌组循环节奏审查

角色：第 2 轮专家 05，奖励与牌组循环节奏设计师  
工作目录：`/Users/roc/Game-001`  
范围：只读审查 `XP threshold`、`rewardChoices`、`select-reward` 后发牌 / 入牌顺序、`run progression`。  
源码边界：未修改源码。本文只给最小参数、顺序和验收建议。

## 0. 一句话结论

当前奖励系统的结构方向是对的：击杀给 XP，升级触发三选一，奖励只进入当前 run，重开清空。但 3-5 回合 demo 的节奏现在被两个点拖住：

1. 初始 `xpThreshold = 45` 太高，奖励基本不会自然出现。
2. `select-reward` 当前先发下一手，再把奖励牌加入 `drawPile`，所以玩家刚选的牌不会进入下一次决策。

最小改动建议是：

```text
首奖阈值：45 -> 10
阈值表：保持绝对 XP 且单调，例如 [0, 10, 24, 45, 72, 110]
奖励分支：继续三选一覆盖 修补资源 / payoff / 路线桥接
入牌顺序：选牌后先把奖励牌放到 drawPile 顶部或 next-hand staged，再发下一手
run 边界：奖励只改变本次 run deck；不碰局外成长、永久 Max MP、账号存档
```

## 1. 当前事实基线

### 1.1 XP 与升级阈值

- 敌人死亡通过 `enemy.death.reward` 规则发 `GainXp`，XP 来自敌人定义里的 `xpReward`。
- 当前敌人 XP 是 `1 / 2 / 2` 循环：`debt_wisp = 1`，`redline_brute = 2`，`pulse_collector = 2`。
- runtime 里已有 `LEVEL_XP_THRESHOLDS = [0, 18, 42, 78, 125, 185]`。
- 但初始世界写死 `reward.xpThreshold = 45`。
- 第一次升级后会用 `nextLevelXp(world.player.level)` 设置下一阈值；如果首奖仍是 45，玩家升到 2 级后下一阈值会变成 42，低于当前累计 XP，存在下一次击杀立刻再次触发奖励的节奏反常。

结论：当前不是“阈值偏高一点”，而是首阈值和阈值表不同步。

### 1.2 rewardChoices

当前 `buildRewardChoices` 已经按分支优先挑选：

```text
repair-resource -> payoff -> route-bridge
```

这比旧的“奖励池前 3 张”更接近正确方向。P0 不需要重写奖励生成器，重点是把它接入 3-5 回合可见节奏。

### 1.3 select-reward 后的顺序

当前非终局节点的核心顺序是：

```text
recordRunReward
RewardChosen
ClearRewardChoices
DiscardHand
CompactEnemySlots
FillEnemySlots
AdvanceRound
DealHand
AddCardToDeck
```

问题在最后两步：`DealHand` 先发生，`AddCardToDeck` 后发生。即使奖励牌进入了 `drawPile`，它也错过了刚发出的下一手，玩家的“我选了这张牌”反馈至少延后一轮抽牌循环。

### 1.4 run progression

- 初始 `run.currentNode = 1`，`maxNodes = 3`，`status = in-progress`。
- 每次选择奖励后记录 `rewardHistory`，然后推进 node。
- 到达 `maxNodes` 时进入 `Settlement`。
- 重开 run 会回到起始牌组、1 级、0 XP、基础 `maxEnergy = 3`。

这条边界是健康的：奖励是当前 run 的临时卡组变化，不是局外成长。

## 2. 最小参数建议

### 2.1 首奖阈值

推荐：

```text
reward.xpThreshold = 10
```

可接受范围：

```text
8-12
```

不建议：

```text
18 或更高
```

理由：

- 3-5 回合 demo 需要自然看见至少一次奖励。
- 当前一个正确链路回合大约能杀 2-4 个有意图敌人，获得约 3-7 XP。`10` 通常会把首奖放在第 2-3 回合，不会打断第一回合教学。
- `8` 更稳，但可能在第一回合高击杀时过早弹奖励。
- `12` 更保守，但坏手或低击杀时可能拖到第 4-5 回合。

### 2.2 阈值表

推荐把阈值表改成绝对累计 XP，并让初始阈值与表同步：

```text
[0, 10, 24, 45, 72, 110]
```

节奏目标：

| 奖励 | 累计 XP | 目标出现窗口 | 作用 |
| --- | ---: | --- | --- |
| 首奖 | 10 | 第 2-3 回合 | 让玩家第一次修正牌组。 |
| 二奖 | 24 | 第 4-5 回合或固定脚本后段 | 让选中牌影响下一次构筑判断。 |
| 三奖 | 45 | demo 外或短 run 收束 | 避免 5 回合内奖励过密。 |

关键规则：下一阈值必须始终大于当前累计 XP。不能再出现首奖 45 后下一阈值回退到 42。

### 2.3 reward pick count

保持：

```text
pickCount = 3
```

不要在 P0 改成 4 选 1 或加 reroll。当前更重要的是让每个选择代表明确问题：

| 槽位 | 分支 | 玩家理解 |
| --- | --- | --- |
| A | 修补 / 资源 / 抽牌 | 我刚才断链或缺费用段，下一轮要更稳。 |
| B | payoff | 我已经能接链，下一轮要有终结牌消费授权。 |
| C | 路线桥接 | 我缺 0/1/2 某一段，下一轮要补牌序。 |

## 3. 入牌顺序建议

### 3.1 P0 推荐顺序

非终局节点建议改成：

```text
1. validate reward state and choice
2. recordRunReward
3. RewardChosen
4. ClearRewardChoices
5. DiscardHand
6. AddCardToDeck(selectedCard, placement = next-hand-guaranteed)
7. CompactEnemySlots
8. FillEnemySlots
9. AdvanceRound
10. DealHand
```

核心不是第 5-8 步的微顺序，而是一个硬规则：

```text
AddCardToDeck 必须发生在下一次 DealHand 之前。
```

并且 `AddCardToDeck` 不能只是 `drawPile.push(cardId)`。为了 demo 反馈，应使用以下两种之一：

| 方案 | 推荐度 | 行为 |
| --- | --- | --- |
| `drawPile.unshift(selectedCard)` | P0 推荐 | 选中的牌进入下一手，玩家立刻看到反馈。 |
| `nextHandGuaranteedRewardCardId` staged slot | P0/P1 都可 | 发牌时保留一个槽位给奖励牌，再从 draw pile 补齐剩余手牌。 |

如果只把牌 `push` 到抽牌堆尾部，旧抽牌堆还有牌时仍然会延迟反馈，不满足本轮目标。

### 3.2 终局节点顺序

如果选择奖励后 `runCompleted = true`：

```text
recordRunReward
RewardChosen
ClearRewardChoices
AddCardToDeck 可保留为 runHistory 证据
SetGameFlowState(Settlement)
```

终局不需要再保证下一手看到新牌，因为已经进入结算。测试应区分“非终局 reward 进入下一手”和“终局 reward 只进入历史 / 结算”。

### 3.3 为什么不要只依赖下次抽牌

P0 的设计目标不是模拟完整随机牌库，而是让玩家建立因果：

```text
刚才我缺修补 -> 我选 Wild -> 下一手我立刻能用 Wild 修补链路
刚才我拿 payoff -> 下一手我看见 payoff，开始考虑 0 -> 1 -> 2 后怎么消费授权
```

如果选牌后 1-2 回合都看不到它，奖励就会变成 UI 记录，而不是下一次决策的一部分。

## 4. run progression 节奏建议

### 4.1 当前 `maxNodes = 3` 可以保留

3-5 回合 demo 不需要扩地图或节点系统。保留 `maxNodes = 3`，把 node 理解成“本次清算中的奖励节点”，不要包装成完整地图。

推荐节奏：

```text
Round 1：教学 0 -> 1 -> 2，读懂敌意图，不强制奖励
Round 2-3：自然达到 10 XP，出现首奖
Reward 1：选修补 / payoff / 路线桥接，下一手立刻可见
Round 3-5：用选中牌改变下一次决策
Reward 2：可在固定脚本中出现，但不要强制所有自然局都出现
```

### 4.2 node 推进仍绑定奖励选择

短期不要把 `currentNode` 改成每回合推进。当前更合理的语义是：

```text
获得并选择一次清算奖励 -> run node 前进
```

这样 run progression 与牌组变化绑定，玩家能理解“我通过一次清算，拿到一个本 run 内改变”。

### 4.3 不要让奖励过密

把首奖降到 10 后，不要同时把二奖降到 18 或更低。否则 3-5 回合会不断打断战斗主线。

建议验收目标：

```text
默认自然局：3-5 回合至少 1 次奖励，最多 2 次奖励
固定高击杀脚本：可以触发 2 次奖励，但不应提前 settlement
```

## 5. 测试建议

### 5.1 XP threshold 回归

新增或扩展 sim 测试：

```text
createInitialWorld()
expect(world.reward.xpThreshold).toBe(10)
```

再用固定击杀脚本验证：

```text
第 1 回合正确链后不强制要求 Reward
第 2-3 回合累计 XP 到 10 时进入 Reward
RewardChoicesGenerated.choices.length === 3
```

### 5.2 阈值单调性

测试首奖后：

```text
select first reward
expect(world.reward.xpThreshold).toBeGreaterThan(world.player.xp)
```

如果当前 XP 已超过下一阈值，说明阈值表或升级逻辑仍有回退风险。

### 5.3 rewardChoices 分支

保留现有 `reward-branching` 方向，并补一条更具体的测试：

```text
给定 repair/payoff/route 都存在的 candidateCardPool
choices 必须各覆盖至少一类
不能因为池顺序连续给出两张 repair 而缺 payoff
```

如果后续某张牌同时命中多个 branch，测试应以“最终 3 个选项覆盖 3 类问题”为准，而不是只测函数内部标签。

### 5.4 select-reward 入牌顺序

这是本轮最关键测试。

非终局节点：

```text
force pending reward with ['wild_mana_stitch', 'severance_burst', 'blood_reclaim']
selectReward('wild_mana_stitch')
expect(world.fsm.gameFlow).toBe('PlayerTurn')
expect(world.player.deck).toContain('wild_mana_stitch')
expect(world.player.hand).toContain('wild_mana_stitch')
expect(HandDealt.cardIds).toContain('wild_mana_stitch')
```

事件顺序建议验收：

```text
RewardChosen before CardAddedToDeck
CardAddedToDeck before HandDealt
HandDealt includes selected reward
```

终局节点：

```text
run.maxNodes = run.currentNode
selectReward(...)
expect(world.fsm.gameFlow).toBe('Settlement')
expect(world.player.hand).not.toBeRequired()
expect(world.run.rewardHistory).toHaveLength(...)
```

### 5.5 run/meta 边界

保留并扩展现有边界测试：

```text
selectReward outside Reward state does not mutate deck or maxEnergy
restart-run resets deck to startingHand
restart-run clears XP, level, reward pending, tempAuthorizationMP
foreign metaProgression cannot alter player.maxEnergy or starting deck
```

### 5.6 浏览器 / HUD 验收

固定脚本验收一条玩家可见链路：

```text
Round 1-2 打到首奖
Reward 面板出现 3 个分支
点击 Wild 或 payoff
下一手手牌区能看到刚选的牌
run-layer 显示奖励记录 + node 推进
```

移动端至少用 `390x844` 看一次，重点不是美术，而是奖励面板可点、选后新牌可见、按钮不遮挡下一手牌。

## 6. 不要触碰的局外成长边界

本轮不要做：

- 永久 `Max MP +1`。
- 账号等级、账号 XP、局外货币、永久天赋。
- 永久卡牌强化或跨 run 保留选中的 reward card。
- 商店、事件池、地图路线、完整 run 节点树。
- 把 `energyGain`、`tempAuthorizationMP`、`run modifier` 文案写成“永久成长”。
- 让 `runModifiers.ts` 的 preview-only 草案改变真实 `player.maxEnergy`、起始牌组或支付规则。

可以保留的边界：

- 当前回合：`tempAuthorizationMP` 只支付 payoff，本回合结束清空。
- 当前 run：选中的奖励牌进入本次 run 的 deck / draw flow。
- 重开 run：回到 `startingHand`、`maxEnergy = 3`、`xp = 0`、`level = 1`。
- 未来 P1：run 内临时 modifier 可以讨论，但必须从奖励 / 结算来，且 run 结束清空。

## 7. 最小交付清单

实现 worker 如果只做一刀，优先级如下：

1. `reward.xpThreshold = 10`，阈值表同步为单调绝对 XP。
2. `select-reward` 非终局路径改为“奖励牌先进入下一手保证区，再 DealHand”。
3. 补一条测试：选择奖励后 `world.player.hand` 包含所选奖励。
4. 保留三分支奖励与 run/meta 边界测试，不扩局外成长。

## 8. 本轮只读验证

本轮没有修改源码。只运行了奖励 / run 相关现有测试：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test -- src/tests/sim/progression-reward-regression.test.ts src/tests/sim/reward-branching.test.ts src/tests/sim/run-progression.test.ts src/tests/sim/run-layer-boundary.test.ts
```

结果：4 个测试文件通过，11 个测试通过。
