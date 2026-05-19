# 2026-05-19 第 12 轮专家 04：运行时合同审查工程师

角色：运行时合同审查工程师  
工作目录：`/Users/roc/Game-001`  
文件所有权：`design/technical/redline-batches/long-task/2026-05-19-round-12-04-runtime-contract-audit.md`  
边界：只写本文档；不改源码、不改测试、不提交、不回滚或覆盖其他工作者修改。  
审查范围：只读审查 `prototype-web/src/sim/runtime.ts`、`types.ts`、`world.ts`、`snapshot.ts`、相关 `sim/ui` 测试，以及第 11 轮相似度/复测文档。  
验证说明：本轮没有运行测试；结论基于当前文件静态审查。

## 0. 总判断

第 12 轮如果同时推进 **3-5 回合竞品相似度脚本** 和 **牌区生命周期 v1**，最容易破坏的不是单个数值，而是这些已成型的 runtime 合同：

1. `tickWorld()` 当前是 **就地 mutation**，除了 `restart-run` 会直接返回新 `WorldState`。
2. `CardPlayed` 在 `SpendEnergy`、`DiscardPlayedCard`、`advanceCostChain()` 之后才入队，ECA 规则看到的是“已从手牌移走”的世界。
3. `HandDealt` 同时表示开局/回合发牌和卡牌效果抽牌，脚本若不看 trace/上下文会误读。
4. Wild 修补、Wild MP3 延链、payoff 续燃是三套不同合同，不能合并成一个“wild success”。
5. 生命周期 v1 一旦引入消耗、保留、状态/污染牌，必须先补 **牌区移动事件字段**，否则 QA 只能从数组差异猜原因。

本轮建议：第 12 轮先把 3-5 回合脚本做成“读事件的验收脚本”，同时只做生命周期 v1 的事件合同和一张最小牌；不要先大迁移 `CardId[]` 到完整 `CardInstance[]`。

## 1. 高风险合同镜头

| # | 合同镜头 | 当前锚点 | 3-5 回合脚本 / lifecycle v1 最容易破坏点 | 必须保留的合同 |
| ---: | --- | --- | --- | --- |
| 1 | `tickWorld()` 就地修改当前 world | `runtime.ts:967-979`，`restart-run` 例外在 `968-970` | 相似度脚本若把每步返回值当 immutable 分支，会污染对照样片；生命周期若保存旧 world 引用，会读到新状态。 | 脚本必须每个镜头用 `buildSnapshot()` 或显式 clone 记录证据；只有 `restart-run` 允许换对象。 |
| 2 | 同 tick 中 `end-turn` 关闭后续玩家输入 | `playerInputClosed` 与 `recordStaleIntentAfterTurnEnd()` 在 `runtime.ts:974-979`、`942-960` | 3-5 回合脚本为了省调用把 `end-turn` 后的 `play-card` 放同批，会得到 stale failure。 | 保留“同 tick end-turn 后玩家输入失败”合同，脚本每个玩家动作单独 tick。 |
| 3 | `advance-time` 只负责时钟和 Deal 自动发牌 | `runtime.ts:999-1004`，旧实时事件在类型中仍存在 | 相似度脚本如果用等待秒数触发敌人攻击，会误判；生命周期不应靠时间推进牌区。 | 敌人伤害只通过 `end-turn` 的 EnemyAttack 阶段结算；`advance-time` 不产生实时战斗副作用。 |
| 4 | 发牌时先锁定本回合攻击权，再刷新意图 | `DealHand` 调 `snapshotRoundAttackEnemies()` / `refreshEnemyIntents()`：`runtime.ts:551-566` | 生命周期保留/状态牌如果绕过 `DealHand`，本回合敌意图可能与攻击权不一致。 | 回合开始的攻击者集合以 `roundAttackEnemyIds` 为准，后续补位敌人本回合不能补刀。 |
| 5 | 失败 play 不可半提交 | `validatePlayCard()` 在 `runtime.ts:415-530`，实际 Spend/Discard 在通过后才执行 | 生命周期 v1 若先移动牌再验证消耗/目标，会出现死目标也弃牌、缺费也消耗。 | 目标、手牌、支付验证必须先于任何牌区移动和链路推进。 |
| 6 | 费用链权威是 `world.chain`，`player.lastPlayedCost/costChainMultiplier` 是镜像 | `types.ts:93-102`，`runtime.ts:207-220` | HUD/script 可能只读 player 镜像；lifecycle 若直接改 player 镜像会造成链路双写不一致。 | 所有链路更新必须走 `advanceCostChain()` / `resetCostChain()` 并同步镜像。 |
| 7 | 非 `PlayerTurn` 自动清链和清授权 | `SetGameFlowState` 在 `runtime.ts:833-837`，`DealHand` 也重置链：`553-557` | 保留牌、状态牌若跨回合存在，容易错误携带 `tempAuthorizationMP`、`payoffArmed`、`extendedThisTurn`。 | 牌可以跨回合，链路/授权不能跨回合，除非新增明确合同和测试。 |
| 8 | Wild 修补只覆盖 expected 1/2，且可能返 MP | `canRepairWithWild`：`runtime.ts:236-243`，`redlineRules.ts:170-204` | 脚本如果只统计 wild 成功，会把返 MP 修补和 MP3 延链混在一起。 | `ChainRepaired`/`chainRepaired` 只表示补缺口；`wild_mana_stitch` 返 MP 只看它。 |
| 9 | Wild MP3 延链只允许 `wild_gap_key` | `canExtendWithWildGap`：`runtime.ts:244-246`，`ChainExtended`：`317-328` | lifecycle 新增 wild/status 牌时可能把所有 `utilities: wild` 都接到 MP3。 | MP3 延链是 card-id 窄合同，不是通用 wild 合同。 |
| 10 | MP3 延链后的 3 费 payoff 有特殊“续燃”窗口 | `continuesAfterWildExtension`：`runtime.ts:247-253`，HUD 对应 `hud.ts:267-279` | 如果生命周期把 `extendedThisTurn` 当回合级长期 flag，后续任意 3 费牌可能错误续链。 | `extendedThisTurn` 只服务紧随其后的 3 费 payoff 续燃，并在命中后清除。 |
| 11 | 授权只由精确 `[0,1,2]` 触发 | `isAuthorizationChain()`：`runtime.ts:367-375` | 3-5 脚本可能把长链前缀也算授权；生命周期保留牌可能让授权重复发放。 | 授权不是前缀匹配，链长必须等于 3；MP3 延链不能新增第二份授权。 |
| 12 | printed cost 支付与 effective cost 链路分离 | 支付验证 `runtime.ts:452-467`，CardPlayed 字段 `types.ts:295-310` | 生命周期若按 effective cost 移动/扣费，会让 `wild_gap_key` 需要 3 MP 而不是 printed 1 MP。 | 支付永远先按 `card.cost`，链路显示再用 `effectiveCost`。 |
| 13 | `CardPaymentRecorded` 目前只在 authorization 支付时出现 | `runtime.ts:1021-1033` | 相似度脚本若把没有 `CardPaymentRecorded` 当“没支付”，会误判普通出牌。 | 脚本应读 `CardPlayed.currentEnergyPaid/authorizationPaid`；若要完整支付审计，先新增事件字段或事件。 |
| 14 | self draw 先弃牌，再由 ECA 抽牌，并排除刚打出的牌 | `DiscardPlayedCard`：`runtime.ts:582-588`，`processEventQueue` 排除 `event.cardId`：`931-936` | lifecycle v1 若调整牌区顺序，会重新引入“刚打出的 0 费抽牌马上洗回抽到自己”。 | 抽牌/洗牌必须保留 `excludeFromReshuffle` 或等价牌区锁。 |
| 15 | `paper_shatter` 只搜 drawPile，且 Topdeck 先于 Draw | `topdeckPayoffFromDrawPile()`：`runtime.ts:188-205`，规则 `redlineRules.ts:144-168` | 生命周期/相似度脚本若扩到弃牌堆，会把窄整备变成完整 tutor。 | P0 仍只搜 drawPile，不搜 discardPile，不启用 `lantern_captain`。 |
| 16 | `HandDealt` 被复用于回合发牌和卡牌抽牌 | `DealHand`：`runtime.ts:551-566`，`DrawCards`：`651-664` | 3-5 回合脚本统计“发牌次数”会把抽牌效果算成新回合。 | 新脚本必须用 `RoundStarted`/`TurnEnded` 或新增 `HandDealt.reason/source` 区分。 |
| 17 | Reward 选择会立即加进当前 run，并在非终端节点进入下一手 | `select-reward`：`runtime.ts:1067-1108`，`AddCardToDeck`：`632-644` | 生命周期 v1 如果把奖励牌放错 zone，3-5 回合“奖励响应上一手问题”会消失。 | 非终端奖励进入当前 run deck，并通过下一次 deal 进入可见手牌；终端节点不再发牌。 |
| 18 | Restart 清空当前 run 奖励，不读取伪 meta | `runtime.ts:968-970`，`run-layer-boundary.test.ts:113-157` | lifecycle/meta 预研若把外部 `metaProgression` 自动吃进 `createInitialWorld()`，会污染当前 demo。 | restart 是 fresh run；局外层仍是显式未开放，不得隐式加 maxEnergy 或起始牌。 |
| 19 | Snapshot 复制数组，但 debug 事件对象是浅拷贝 | `snapshot.ts:40-46` | 浏览器脚本若修改 `snapshot.debug.events[0]` 之类对象，可能污染证据理解；长期需要深拷贝或只读约定。 | QA 只读 snapshot；若要保存 JSON 证据，立即 `JSON.stringify/parse` 固化。 |
| 20 | debug trace 有 2000 上限 | `DEBUG_LIMIT`：`runtime.ts:10-21` | 3-5 回合脚本如果堆过多 viewport/长 run 事件，早期关键事件会被裁掉。 | 脚本要按 traceId/stepId 分段提取即时摘要，不依赖最终全量 debug。 |

## 2. 3-5 回合相似度脚本的合同边界

相似度脚本应该证明“玩家镜头像”，不是用强注入证明 runtime 可被摆拍。最小脚本建议按 5 个 beat 输出：

| Beat | 应读的权威事件/状态 | 不应做的事 |
| --- | --- | --- |
| 1. 开局读压 | `HandDealt`、`EnemyIntentDeclared`、`enemyIntentSummary.totalDamage`、`fsm.gameFlow=PlayerTurn` | 不通过 `advance-time` 等敌人自然攻击；攻击只由 `end-turn` 触发。 |
| 2. 升序链 | `CardPlayed.effectMultiplier` 序列、`ChainAdvanced`、`AuthorizationGranted` | 不只看 HUD 文案；HUD 是表现层，不是机制真相。 |
| 3. 坏手/修补 | `ChainBroken`、`ChainRepaired`、`failedConditions`、`HandDealt` 抽牌结果 | 不把 failed play 当 bug；失败样片必须是可解释游戏结果。 |
| 4. 奖励响应 | `RewardChoicesGenerated`、`RewardChosen`、`CardAddedToDeck`、`run.rewardHistory` | 不直接把 reward 牌塞进手牌绕过 `select-reward`，除非标成 fixture。 |
| 5. 爆点/反例 | `PayoffTriggered`、`PayoffResolved.preventedIntentDamage`、`EnemyIntentResolved` | 不只跑成功清场；至少保留一个缺授权、抽牌 miss、断链或未清意图反例。 |

脚本结果建议强制带：

```json
{
  "similarityScope": "mechanic-slice-only",
  "notAFullClone": true,
  "roundsObserved": 3,
  "beats": [],
  "unsupportedClaims": ["no full card lifecycle", "no full run/meta loop"]
}
```

## 3. lifecycle v1 的最小安全接入线

当前 runtime 只有 `deck / hand / drawPile / discardPile`，没有 `exhaustPile`、`retain`、`statusPile`、`cardInstanceId`。如果第 12 轮直接加入多类生命周期，最容易破坏抽牌和支付事务。

建议 lifecycle v1 只做三件事：

1. 先定义牌区移动事件合同，不先迁移所有牌为实例。
2. 只接一张最小 `exhaust` 或 `retain` 牌，且必须能用现有 `CardId[]` 表达。
3. 所有移动仍由 `applyCommand()` 统一执行，不允许 ECA action 直接改数组。

暂不建议做：

- 通用 `CardInstance` 大迁移。
- 同名不同升级、多复制体、临时降费同时落地。
- 从弃牌堆 tutor。
- 局外 meta 自动污染当前 run。
- 让状态/污染牌跳过 `validatePlayCard()` 或直接进入 `discardPile`。

## 4. 必须保留的回归测试

这些测试不只是“当前绿”，而是第 12 轮不能破坏的合同钉子。

| 测试文件 | 必须保留的用例 | 保护的合同 |
| --- | --- | --- |
| `runtime.test.ts` | `does not play a card before the hand is dealt` | `PlayerTurn` 之前不能出牌。 |
| `runtime.test.ts` | `resets the cost chain on cost jumps and between turns` | 断链与跨回合清链。 |
| `runtime.test.ts` | `exposes current chain state, next expected cost, and break reason` | `ChainState` 可观察，断链原因稳定。 |
| `runtime.test.ts` | `uses Wild Mana Stitch as a draw/mana wild repair that preserves a missing chain step` | Wild repair、返 MP、抽牌修补。 |
| `runtime.test.ts` | `does not refund MP when Wild Mana Stitch opens a chain instead of repairing one` | Wild 起手不是 repair。 |
| `runtime.test.ts` | `keeps Wild from repairing an already broken chain or refunding MP` | broken 后不能 repair/authorization。 |
| `runtime.test.ts` | `lets Wild Gap Key pay its printed cost while repairing the effective chain cost` | printed/effective cost 分离。 |
| `runtime.test.ts` | `amplifies payoff cards at the tail of a chain while unordered payoff remains low value` | payoff 继承倍率，乱序低价值。 |
| `runtime.test.ts` | `does not let failed plays mutate the current cost chain` | validation transactionality。 |
| `runtime.test.ts` | `does not spend the same hand card twice in one tick` | 同 tick 不重复消费同一手牌。 |
| `runtime.test.ts` | `does not spend energy or discard when the requested target is already dead` | 失败 play 不半提交。 |
| `runtime.test.ts` | `keeps advance-time as clock/deal input without realtime combat side effects` | `advance-time` 不产生实时战斗。 |
| `runtime.test.ts` | `does not let an enemy refilled into the front row during the player turn attack this turn` | 攻击权锁定在回合开始。 |
| `runtime.test.ts` | `draws four-card hands through draw pile and discard reshuffle without clearing discard early` | draw/discard reshuffle 合同。 |
| `runtime-audit.test.ts` | `does not immediately redraw played 0-cost self draw card ... from an empty draw pile` | 刚打出的自抽牌不能立刻洗回抽到自己。 |
| `runtime-audit.test.ts` | `rejects play-card intents that arrive after end-turn in the same tick batch` | 同 tick end-turn 后输入关闭。 |
| `redline-competitor-similarity.test.ts` | `lets Wild Gap Key extend 0->1->2 at effective cost 3 while paying its printed cost` | MP3 延链独立合同。 |
| `redline-competitor-similarity.test.ts` | `keeps Wild Mana Stitch from repairing expected cost 3` | `wild_mana_stitch` 不进 MP3 延链。 |
| `redline-competitor-similarity.test.ts` | `keeps payoff value from degrading on a 0->1->2->wild gap->3 path` | MP3 延链后 payoff 不退化。 |
| `redline-hyperturn-acceptance.test.ts` | `uses the 2 MP route segment to arm a 3 MP all-enemies payoff rescue within turns 3-5` | 3-5 回合救场样片核心。 |
| `redline-hyperturn-acceptance.test.ts` | `lets a broken chain still play cards, but at reduced chain multiplier` | 断链不是禁用，是降级。 |
| `redline-paper-shatter-topdeck.test.ts` | `topdecks the first drawPile payoff before paper_shatter draws` | 整备先置顶再抽。 |
| `redline-paper-shatter-topdeck.test.ts` | `misses cleanly when drawPile has no payoff and still draws normally` | miss 是可读失败，不搜弃牌。 |
| `redline-paper-shatter-topdeck.test.ts` | `keeps authorization and payoff payment contracts intact after topdecking a finisher` | 整备不破坏授权支付。 |
| `redline-attribute-authorization.test.ts` | `clears unused authorization at end turn and does not carry it into the next round` | 临时授权不跨回合。 |
| `run-layer-boundary.test.ts` | `does not consume foreign meta progression as implicit maxEnergy or deck changes` | 局外层不得隐式污染 combat。 |
| `run-progression.test.ts` | `restarts with a fresh run and does not retain run deck rewards as meta growth` | restart 清空当前 run 成长。 |
| `progression-reward-regression.test.ts` | `settles terminal reward ... without dealing another hand` | 终端节点进入 Settlement，不再自动发牌。 |
| `hud-target-selection.test.ts` | `shows wild gap key as a controlled MP3 extension instead of a broken chain` | HUD 与 runtime 的 MP3 延链一致。 |
| `hud-target-selection.test.ts` | `shows payoff as a continuation after a wild MP3 extension` | `extendedThisTurn` 的玩家可见续燃合同。 |

## 5. 建议新增事件字段

这些字段不是要求第 12 轮一次全做，而是为了让 3-5 回合脚本和 lifecycle v1 不继续靠“数组差异 + 文案猜测”审计。

### 5.1 所有 `GameEvent` 的通用字段

| 字段 | 建议类型 | 用途 |
| --- | --- | --- |
| `round` | `number` | 脚本不用回看 world 当前 round，避免事件回放时被后续回合覆盖。 |
| `gameFlow` | `GameFlowState` | 区分 Deal/PlayerTurn/Reward/Settlement 中同名事件。 |
| `runNumber` | `number` | restart 后对比前后 run，不靠对象引用。 |
| `runNode` | `number` | 3-5 回合脚本和奖励响应可直接绑定节点。 |
| `sequence` | `number` | 同 tick 内事件排序稳定化，避免只靠数组 index。 |
| `scenarioId` | `string | undefined` | QA/相似度脚本可把多个 trace 归为同一镜头。 |
| `scriptStepId` | `string | undefined` | 脚本报告按 beat 聚合，不需要从 traceId 字符串 parse。 |

### 5.2 牌区移动事件

建议新增独立事件，而不是把所有信息塞进 `HandDealt`：

```ts
type CardZone = 'deck' | 'hand' | 'drawPile' | 'discardPile' | 'exhaustPile' | 'retain' | 'statusQueue';

type CardMoved = {
  type: 'CardMoved';
  traceId: TraceId;
  tick: number;
  round: number;
  cardId: CardId;
  cardInstanceId?: string;
  fromZone: CardZone;
  toZone: CardZone;
  reason:
    | 'deal'
    | 'draw'
    | 'play'
    | 'discard-played'
    | 'discard-end-turn'
    | 'reshuffle'
    | 'topdeck'
    | 'reward-added'
    | 'retain'
    | 'exhaust'
    | 'status-added';
  sourceCardId?: CardId;
  sourceEventType?: GameEvent['type'];
};
```

为什么必须独立：

- lifecycle v1 的核心不是“牌有没有在数组里”，而是“为什么从哪个 zone 到哪个 zone”。
- `HandDealt` 现在既表示发牌又表示抽牌，无法表达 discard->drawPile reshuffle。
- 消耗/保留/污染牌未来都需要移动证据，否则 UI 和 QA 只能猜。

### 5.3 `HandDealt` 建议字段

| 字段 | 目的 |
| --- | --- |
| `source` = `'round-start' | 'card-draw' | 'reward-next-hand'` | 区分回合发牌、效果抽牌、奖励后新手。 |
| `reason` | 保留当前 command reason，不再只在 command 中可见。 |
| `drawnFromZones` | 记录是否来自 drawPile、reshuffle discard。 |
| `reshuffledCardIds` | 证明是否发生洗回。 |
| `excludedFromReshuffle` | 保护 self draw 不能立刻抽回自己。 |

### 5.4 `CardPlayed` / 链路事件建议字段

| 字段 | 目的 |
| --- | --- |
| `cardInstanceId` | lifecycle v1 支持同名多实例时避免只靠 `CardId`。 |
| `fromZone: 'hand'` | 证明出牌来源，防止脚本直接打不存在的牌。 |
| `destinationZone` | `'discardPile' | 'exhaustPile' | 'retain'`，让消耗/保留可观察。 |
| `lifecycleDisposition` | `'discard' | 'exhaust' | 'retain' | 'status'`。 |
| `previousExpectedCost` / `nextExpectedCost` | 脚本不需要拼 `ChainAdvanced` 才知道费用窗口。 |
| `previousMultiplier` / `effectMultiplier` | 直接形成倍率曲线。 |
| `chainLength` | 3-5 脚本判断 stack 不靠 `playedCosts.length` 当前值。 |
| `chainAction` | `'start' | 'continue' | 'repair' | 'extend' | 'break' | 'payoff-continuation'`。 |
| `paymentSource` | 普通 current-energy 支付也可审计，而不只 authorization 有 `CardPaymentRecorded`。 |

### 5.5 `TurnEnded` / `RoundStarted` 建议字段

| 字段 | 目的 |
| --- | --- |
| `discardedCardIds` | 结束回合弃掉哪些牌，lifecycle v1 可排除 retain。 |
| `retainedCardIds` | 保留牌跨回合必须有证据。 |
| `expiredAuthorizationMP` | 证明授权在回合结束清空。 |
| `enemyIntentDamageBefore` | 玩家看到的 End Turn 后果与实际伤害对齐。 |
| `roundAttackEnemyIds` | 回合开始攻击权快照，不靠当前补位后的 front row。 |

### 5.6 `RewardChosen` / `CardAddedToDeck` 建议字段

| 字段 | 目的 |
| --- | --- |
| `runNodeBefore` / `runNodeAfter` | 奖励响应脚本不再从 world 推断节点推进。 |
| `deckSizeBefore` / `deckSizeAfter` | 证明是 current-run deck 增长。 |
| `addedToZone` | 非终端节点可明确是进入 deck/drawPile/next hand。 |
| `nextHandSeedCardIds` | 若奖励保证入下一手，需要事件证据。 |

### 5.7 `PayoffResolved` 建议字段

| 字段 | 目的 |
| --- | --- |
| `intentEnemyIdsBefore` / `intentEnemyIdsAfter` | 证明清场前后威胁变化，而不只看数字。 |
| `playerHpBeforeEndTurn` / `playerHpAfterEndTurn` | 3-5 脚本可判断救场是否保住 HP。 |
| `chainActionSource` | 标明 payoff 是否来自普通 0->1->2、Wild 延链后续燃、或乱序低效。 |

## 6. 建议新增回归测试

第 12 轮若开始实现，应优先补这些测试，而不是先扩大系统：

1. `runtime lifecycle`: 消耗牌打出后进入 `exhaustPile` 或等价事件，不进入 discard，不会被当回合 reshuffle 抽回。
2. `runtime lifecycle`: 保留牌在 `end-turn` 后仍在下一回合手牌或 retain zone，但链路和授权已清空。
3. `runtime lifecycle`: 状态/污染牌进入 draw/discard 的移动有 `CardMoved.reason='status-added'`，不能绕过 hand validation 打出。
4. `runtime contract`: 普通 current-energy 支付也能通过 `CardPlayed.paymentSource` 或新增支付事件审计。
5. `similarity script`: 一个 3-5 回合脚本输出 `notAFullClone=true`，并记录至少一个失败 beat。
6. `similarity script`: 脚本统计回合数不把 `HandDealt` 抽牌效果误判为新回合。
7. `similarity script`: Wild repair 和 Wild MP3 extension 分开计分，不能共享一个 `wildSuccess` 指标。
8. `snapshot`: buildSnapshot 后修改 snapshot 的 `player.hand`、`chain.playedCosts`、`run.rewardHistory[].choices` 不影响 world；debug 事件若仍浅拷贝，需要文档化只读或补深拷贝测试。

## 7. 实施顺序建议

1. 先补事件字段/事件文档和测试，不先做大 lifecycle。
2. 3-5 回合脚本先用现有 runtime 事件跑成功 + 失败各一条，输出 JSON scorecard。
3. lifecycle v1 第一刀只加一个牌区移动证据事件和一张最小牌。
4. 跑 `test:sim`、`test:ui`、`qa:ui` 后，再判断是否进入 CardInstance 迁移。

STATUS: DONE
