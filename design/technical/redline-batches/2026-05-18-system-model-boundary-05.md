# Redline 最小数据模型边界审查 05

日期：2026-05-18
角色：系统落地 / 数据模型审查专家
范围：基于当前 `prototype-web` TypeScript demo，只提出字段归属边界，不要求改代码。

## 一句话结论

Redline 下一步最小模型边界应拆成五层：`card definition`、`account/meta profile`、`run state`、`battle state`、`turn/deal-loop state`。当前 demo 的最大风险不是字段不够，而是把局外成长、单次冒险、单局战斗和本回合发牌循环都塞进 `PlayerState` / `WorldState`，后续会让奖励、存档、回放、HUD 和平衡调参互相污染。

P0 不做完整存档和局外成长。P0 只要先把字段语义写清楚：卡牌定义是静态 catalog；run state 是本次冒险的长期构筑；battle state 是当前战斗的实体和战况；turn/deal-loop state 是当前回合、手牌、费用、chain 和授权；account/meta profile 暂时只作为 P2 占位，不进入 demo 主状态。

## 当前 demo 观察

当前字段来源主要是：

- `CardDefinition`：`id/name/cost/verb/damage/comboNode/description/targets/drawCards/energyGain/utilities`
- `PlayerState`：`hp/maxHp/energy/maxEnergy/tempAuthorizationMP/authorizationRestriction/payoffArmed/combo/xp/level/deck/hand/drawPile/discardPile`
- `ChainState`：`playedCosts/lastCost/nextExpectedCost/multiplier/broken/repairedThisTurn`
- `WorldState`：`tick/round/elapsedSeconds/player/chain/enemies/enemyIntents/reward/debug/roundAttackEnemyIds/lastBurstTick`
- `RewardState`：`xpThreshold/candidateCardPool/choices/pickCount/pending/source`

这些字段现在能跑通 Hyper-Turn demo，但边界混合明显：

- `player.deck` 同时像 run deck、battle draw source、reward 结果容器。
- `player.energy/tempAuthorizationMP/payoffArmed` 是本回合字段，却挂在长期 player 上。
- `player.xp/level` 像 run progression，但 reward 立即驱动下一回合发牌。
- `reward.candidateCardPool` 像 run card pool，但也承担 demo 发奖脚本。
- `round/elapsedSeconds/enemyIntents/roundAttackEnemyIds` 是 battle/turn 字段，但都在 `WorldState` 顶层，没有明确生命周期。
- `debug` 和 public snapshot 混在同一个状态出口，后续 UI 容易直接依赖内部字段。

## P0 最小边界

### 1. Card Definition：静态卡牌定义

归属原则：只放“这张卡天生是什么”。不能放玩家本次冒险里对这张卡的强化、是否已解锁、是否在牌堆里、是否本回合被授权支付。

P0 应归属字段：

| 字段 | 归属 | 说明 |
| --- | --- | --- |
| `id` | card definition | 稳定 catalog id，不应随 run 改变 |
| `name` | card definition | 展示名；后续可换成 `nameKey` |
| `cost` | card definition | 印刷费用 / printed cost |
| `verb` | card definition | 当前动作文案 / 演出短标签 |
| `damage` | card definition | 当前 demo 的基础伤害；P1 可被 effects 替代 |
| `comboNode` | card definition | 这张卡属于 hook/cut/spark/mark/reclaim/burst 哪个节点 |
| `targets` | card definition | 静态目标模式：front-enemy/front-row/all-enemies/self |
| `drawCards` | card definition | 简化效果参数；只表示这张卡基础抽牌 |
| `energyGain` | card definition | 简化效果参数；只表示本回合返费，不是 max MP 成长 |
| `utilities` | card definition | 静态标签：wild/draw/mana/reorder |
| `description` | card definition | 当前 demo 可保留，长期应转 localization + generated rules text |

P0 不应归属 card definition：

- `currentEnergyPaid`、`authorizationPaid`：这是一次出牌支付结果，属于 turn event。
- `payoffArmed`：这是当前回合授权状态，属于 turn/deal-loop state。
- `deck/hand/drawPile/discardPile`：卡牌实例所在区域，属于 run 或 turn。
- `unlocked/owned/mastery/skin/favorite`：局外账号，P2。
- `upgradedDamage/runModifier`：本次冒险内强化，P1 run state，不进静态 definition。

### 2. Turn / Deal-Loop State：当前回合和发牌循环

归属原则：回合开始创建或刷新，回合结束清空。所有“这回合能不能打、怎么支付、chain 是否成立、这次发了什么牌”的字段都在这里。

P0 应归属字段：

| 字段 | 归属 | 说明 |
| --- | --- | --- |
| `hand` | turn/deal-loop state | 当前手牌，回合结束丢弃或保留规则另算 |
| `drawPile` | turn/deal-loop state | P0 可仍放在 player 上，但语义是当前 battle/run deck 的发牌队列 |
| `discardPile` | turn/deal-loop state | 当前战斗 / 本次冒险的弃牌队列，不能当账号收藏 |
| `energy` | turn/deal-loop state | 当前回合可用 MP |
| `maxEnergy` | turn/deal-loop state in P0 | P0 默认 3；若 P1 做 run 内成长，再迁到 run modifier + turn derived max |
| `tempAuthorizationMP` | turn/deal-loop state | 本回合临时授权，回合切换必须清空 |
| `authorizationRestriction` | turn/deal-loop state | 例如 `payoff-only`，限制临时授权用途 |
| `lastAuthorizationReason` | turn/deal-loop state | 给 HUD/debug 解释授权来源 |
| `lastAuthorizationSourceCardId` | turn/deal-loop state | 记录触发授权的卡 |
| `payoffArmed` | turn/deal-loop state | 当前回合 payoff 是否被授权武装 |
| `chain.playedCosts` | turn/deal-loop state | 当前回合费用链 |
| `chain.lastCost` | turn/deal-loop state | 当前回合链路最后费用 |
| `chain.nextExpectedCost` | turn/deal-loop state | 下一张期望费用 |
| `chain.multiplier` | turn/deal-loop state | 当前链路倍率 |
| `chain.broken` | turn/deal-loop state | 当前链是否断 |
| `chain.breakReason` | turn/deal-loop state | 当前链断裂原因 |
| `chain.repairedThisTurn` | turn/deal-loop state | 本回合是否靠 wild 修补 |
| `roundAttackEnemyIds` | turn/deal-loop state | 本回合发牌时锁定的攻击者快照 |
| `enemyIntents` | turn/deal-loop state | 当前玩家回合可见敌人意图 |
| `enemyIntentSummary` | turn/deal-loop state | 当前玩家回合意图汇总 |

P0 建议：即使代码暂时不拆文件，也要在文档和命名中承认这些是 `TurnState` / `DealLoopState`。不要继续把 `tempAuthorizationMP` 解释成 player 的长期属性。

### 3. Battle State：当前战斗 / 当前局面

归属原则：进入一次战斗后存在，战斗结束丢弃或结算到 run state。它描述场上实体、战斗流程和战斗结果，不描述账号永久成长。

P0 应归属字段：

| 字段 | 归属 | 说明 |
| --- | --- | --- |
| `battleId` | battle state | P0 可没有，但建议作为后续 replay 锚点 |
| `tick` | battle state | 当前战斗仿真 tick |
| `round` | battle state | 当前战斗第几轮 / 第几手 |
| `elapsedSeconds` | battle state | demo 时间轴；如果完全 turn-based，P1 可降级为 presentation/debug |
| `fsm.gameFlow` | battle state | Boot/Deal/PlayerTurn/EnemyAttack/EnemyRefill/Reward/Settlement |
| `fsm.characters` | battle state | 战斗内角色演出状态 |
| `player.hp` | battle state | 当前战斗 HP；若有跨战斗继承，run state 只保存进入战斗前/战后结算值 |
| `player.maxHp` | battle state derived from run | 当前战斗最大 HP，可由 run/profile 修正推导 |
| `enemies` | battle state | 当前战斗实体实例，不是 enemy definition |
| `enemy.hp/maxHp/alive/slot/lane/z` | battle state | 实体运行时字段 |
| `enemy.damage/speed/xpReward` | battle state copied from definition | 战斗实例快照，允许被 buff/debuff 修改 |
| `nextEnemySerial` | battle state | 当前战斗生成敌人的实例序号 |
| `maxEnemySlots` | battle state | 当前战斗阵型容量 |
| `lastBurstTick` | battle state / presentation bridge | P0 可保留，用于清场演出触发 |
| `debug.events/commands/ruleHits/trace/failedConditions` | battle debug state | 只给测试和调试，不应成为 UI 稳定合同 |

P0 不应归属 battle state：

- `ownedCards/unlocks/metaCurrency`：账号永久数据。
- `allRunRewardsSeen`、`mapNodeHistory`：本次冒险数据。
- `card.description` 和卡牌印刷数值：definition。
- 当前 `hand/energy/chain` 虽然战斗内存在，但生命周期更短，应属于 turn/deal-loop。

### 4. Run State：单次冒险 / 本次 run 构筑

归属原则：从点击“开始本次冒险”到 run 成功/失败之间存在。它记录本次冒险中跨战斗或跨回合保留的构筑、奖励和路线，不记录账号永久解锁，也不记录单回合 chain。

P0 当前 demo 已经隐含的 run 字段：

| 字段 | 归属 | 说明 |
| --- | --- | --- |
| `runId` | run state | P0 可没有；建议 P1 加，方便回放和存档 |
| `deck` | run state | 本次冒险牌组清单；战斗发牌从它派生 |
| `reward.pending` | run/battle transition | 当前是否正在处理本次 run 的升级奖励 |
| `reward.source` | run/battle transition | 奖励来源，例如 level-up |
| `reward.choices` | run/battle transition | 当前奖励选择，仅在奖励界面存在 |
| `reward.pickCount` | run rule | 本次 run 奖励可选数量 |
| `reward.candidateCardPool` | run rule / reward pool | 本次 run 可进入奖励池的卡 |
| `xp` | run state in P0 | 当前 demo 是击杀累积升级，语义更像本次冒险经验 |
| `level` | run state in P0 | 本次冒险等级，不应默认等于账号等级 |
| `xpThreshold` | run rule | 下次本 run 升级阈值 |

P1 可扩展 run 字段：

- `runSeed`
- `currentNodeId`
- `visitedNodes`
- `battleIndex`
- `deckInstances`，如果要支持同名卡不同升级或临时污染
- `runRelics`
- `runModifiers`
- `maxEnergyBonusThisRun`
- `rewardHistory`
- `removedCardIds`
- `temporaryCards`

P0 禁止混入 run state 的字段：

- `metaLevel`、`accountXp`、`permanentUnlocks`。
- 当前回合的 `playedCosts/tempAuthorizationMP/payoffArmed`。
- 当前敌人的 `hp/slot/z`。
- 静态 card/enemy catalog。

### 5. Account / Meta Profile：局外账号档案

归属原则：跨 run 永久保存。P0 不实现，只保留边界，避免把账号成长误写进 run 或 battle。

P2 才应考虑字段：

| 字段 | 归属 | 说明 |
| --- | --- | --- |
| `profileId` | account/meta profile | 本地或平台账号档案 |
| `createdAt/lastPlayedAt` | account/meta profile | 存档元信息 |
| `permanentUnlocks` | account/meta profile | 永久解锁的卡、角色、难度、图鉴 |
| `metaCurrency` | account/meta profile | 局外货币 |
| `highestClearDepth` | account/meta profile | 历史成绩 |
| `seenTutorialFlags` | account/meta profile | 教程/新手引导记录 |
| `settings` | account/meta profile | 音量、语言、输入偏好 |
| `collectionStats` | account/meta profile | 卡牌使用次数、击杀统计、成就进度 |

P0 明确不做：

- 不做 `accountLevel`。
- 不做永久 `maxEnergy` 成长。
- 不做卡牌永久强化。
- 不做全局收藏影响 demo 起始牌组。
- 不把 `player.level` 解释成账号等级。

## P0 / P1 / P2 分期

### P0：只立最小边界，不大改系统

目标：让后续 worker 不再把所有字段塞进一个 player/world 大表。

P0 建议字段边界：

- `CardDefinition` 保留静态印刷字段。
- `RunState` 语义上拥有 `deck/xp/level/reward pool/reward choices`。
- `BattleState` 语义上拥有 `tick/round/fsm/enemies/player hp/debug`。
- `TurnState` 语义上拥有 `hand/drawPile/discardPile/energy/tempAuthorizationMP/payoffArmed/chain/enemy intents`。
- `AccountProfile` 只写边界，不进入 demo。

P0 可接受的技术债：

- 字段暂时还在 `PlayerState` / `WorldState` 里，不立刻拆文件。
- `drawPile/discardPile` 暂时放在 player 上，但文档标注它们不是 account/profile。
- `maxEnergy` 暂时是 turn reset 的基础值，不做成长系统。
- `xp/level` 暂时是 run 内经验，不做账号等级。

### P1：轻量结构化，不引入局外成长

目标：支持更多卡、奖励、战斗和 QA，不让状态继续膨胀。

P1 建议：

- 新增显式 `RunState`、`BattleState`、`TurnState` 类型，哪怕先由旧 `WorldState` 组装。
- 把 `deck` 和 `reward` 从 `PlayerState` 语义中拔出来，归到 run。
- 把 `energy/tempAuthorizationMP/payoffArmed/chain/hand/piles` 收口到 turn/deal-loop。
- 给 `CardDefinition` 增加 `effects` 草案，旧 `damage/drawCards/energyGain` 兼容保留。
- 给 reward 选择加 `rewardId/source/offeredAtRound`，避免奖励字段像长期属性。
- 如果验证 `Max MP +1`，只做 run 内 `maxEnergyBonusThisRun`，不碰 account profile。

### P2：完整 meta/profile 和存档

目标：当 demo 证明核心循环后，再把长期成长接入。

P2 建议：

- 引入 `AccountProfile` 和 `SaveData`。
- 区分 `baseDeckUnlockedByProfile` 和 `run.deck`。
- 区分 `profilePermanentUnlocks` 和 `runRewardHistory`。
- 区分 `profileSettings` 和 `battleDebug`.
- 引入 migration/version 字段。
- 只有到 P2 才考虑永久卡牌升级、账号货币、角色解锁、难度推进。

## 最小字段分界表

| 当前字段 / 概念 | 推荐归属 | 优先级 | 备注 |
| --- | --- | --- | --- |
| `cards[id].id/name/cost/verb/damage/comboNode/targets` | card definition | P0 | 静态 catalog |
| `drawCards/energyGain/utilities` | card definition | P0 | P1 可迁到 `effects` |
| `description` | card definition | P0 | 长期应 localization 化 |
| `enemyDefinitions` | enemy definition | P0 | 静态敌人模板 |
| `player.deck` | run state | P0 | 当前放 player 只是实现细节 |
| `player.xp/player.level` | run state | P0 | 本次 run 等级，不是账号等级 |
| `reward.candidateCardPool` | run state | P0 | 本次 run 奖励池 |
| `reward.choices/pending/source` | run/battle transition | P0 | 奖励界面临时状态 |
| `player.hp/maxHp` | battle state | P0 | 当前战斗生命；max 可由 run 派生 |
| `enemies` | battle state | P0 | 战斗实例 |
| `fsm` | battle state | P0 | 战斗流程和演出状态 |
| `tick/round/elapsedSeconds` | battle state | P0 | 当前战斗进程 |
| `debug` | battle debug state | P0 | 不应成为 UI 长期 public contract |
| `player.hand/drawPile/discardPile` | turn/deal-loop state | P0 | 发牌循环区域 |
| `player.energy/maxEnergy` | turn/deal-loop state | P0 | P0 每回合刷新；P1 可由 run bonus 派生 |
| `tempAuthorizationMP/authorizationRestriction` | turn/deal-loop state | P0 | 本回合临时授权 |
| `lastAuthorizationReason/sourceCardId` | turn/deal-loop state | P0 | HUD/debug 解释字段 |
| `payoffArmed` | turn/deal-loop state | P0 | 不能落入 run 或 card |
| `chain.*` | turn/deal-loop state | P0 | 回合结束清空 |
| `enemyIntents/enemyIntentSummary` | turn/deal-loop state | P0 | 发牌时声明，玩家回合可见 |
| `roundAttackEnemyIds` | turn/deal-loop state | P0 | 当前回合攻击快照 |
| `runSeed/runId/rewardHistory/runRelics` | run state | P1 | P0 可不做 |
| `maxEnergyBonusThisRun` | run state | P1 | 若验证 Max MP +1，只能是 run 内成长 |
| `profileId/permanentUnlocks/metaCurrency/settings` | account/meta profile | P2 | P0 不进入 demo 主状态 |

## 最大风险

最大风险是把 `player` 当成万能容器继续扩：把 `maxEnergy` 成长、奖励选择、牌组、手牌、chain、授权、账号等级、永久解锁都挂在同一个对象上。短期看起来开发最快，长期会出现四类问题：

1. 存档风险：无法判断一个字段应该战斗结束清空、run 结束清空，还是永久保存。
2. 平衡风险：`Max MP +1`、返费、临时授权和账号成长混成同一类“资源增加”，玩家和测试都会误读。
3. UI 风险：HUD 直接消费 debug/player 大对象，后续拆状态会大面积回归。
4. QA 风险：测试会把当前实现细节当合同，例如直接断言 player 上所有字段，而不是断言 run/battle/turn 的生命周期。

## 建议落地口径

下一轮不要先重构全部代码。先在技术合同里固定这条边界：

```text
CardDefinition = 静态印刷数据
AccountProfile = 跨 run 永久数据，P2 前不进 demo
RunState = 本次冒险构筑和奖励
BattleState = 当前战斗实体、流程、HP、debug
TurnState = 当前发牌循环、手牌、费用、chain、临时授权、敌人意图
```

只要守住这个边界，P0 的终局授权、Wild 修补、3 MP payoff 和奖励三选一都能继续做；如果不守，下一轮很容易把局外成长、单次冒险、单局战斗和一手牌全部揉成不可维护的大属性表。
