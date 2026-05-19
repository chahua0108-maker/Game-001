# 2026-05-19 Round 12-03：牌区生命周期系统架构审查

角色：第 12 轮专家 03，牌区生命周期系统架构师  
工作目录：`/Users/roc/Game-001`  
文件所有权：本文只写 `design/technical/redline-batches/long-task/2026-05-19-round-12-03-card-lifecycle-architecture.md`  
输出边界：只写文档；不改源码、不改测试、不提交、不回滚或覆盖其他工作者修改。

## 0. 总判断

第 12 轮可以进入牌区生命周期 v1，但第一刀仍不应迁移到 `CardInstanceId`。当前 `prototype-web/src/sim` 的核心牌区仍是 `CardId[]`：`deck / hand / drawPile / discardPile`，且 reward/run 边界已经有测试保护。最小 v1 应该只补一层“牌区移动事实”和两个新运行时区：

```text
exhaustPile      打出后或回合末移出抽弃循环
retainedCards    回合末保留，下次 DealHand 先回 hand 再补抽
```

状态/污染牌也先用 `CardId[]` 表达：它们是物理卡，能进入 `drawPile/hand/discardPile`，占抽牌和手牌；但 v1 不追踪同名实例来源、不做永久诅咒、不做升级/复制/单张费用变化。

最小架构目标：

```text
保留现有 0->1->2、Wild MP3 延链、topdeck、reward 入下一手不退化；
把打出、回合末、奖励切换、抽牌回填从“数组 push/splice”升级为有 reason 的牌区事件；
让消耗、保留、状态污染都有测试能看见的区域和事件。
```

## 1. 当前代码事实

### 1.1 类型层

- `CardType` 已有 `status`，`CardKeyword` 已有 `消耗/保留/状态/过载/净化`，但 `CardDefinition` 没有 `lifecycle/onPlay/onTurnEnd/statusKind` 等结构字段：`prototype-web/src/sim/types.ts:8-58`。
- `PlayerState` 只有 `deck/hand/drawPile/discardPile` 四个牌区，没有 `exhaustPile/retainedCards/removed/status source`：`prototype-web/src/sim/types.ts:71-90`。
- `Command` 已有 `DiscardPlayedCard` 和 `DiscardHand(reason)`，但没有 `MoveCard/ResolveLifecycle/CreateCardInZone`：`prototype-web/src/sim/types.ts:487-550`。
- `GameEvent` 已有链路、奖励、topdeck 和 `CardAddedToDeck`，没有 `CardMoved/CardDiscarded/CardExhausted/CardRetained/PileShuffledBack`：`prototype-web/src/sim/types.ts:224-485`。

### 1.2 世界初始化与快照

- `createInitialWorld()` 把 `deck` 和 `drawPile` 都设为 `startingHand`，`hand/discardPile` 为空：`prototype-web/src/sim/world.ts:69-96`。
- `buildSnapshot()` 显式 clone 了 `hand/drawPile/discardPile`，但新牌区加入时必须同步 clone；当前 `deck` 依赖 `...world.player`，不是显式 clone：`prototype-web/src/sim/snapshot.ts:3-13`。

### 1.3 抽牌与洗回

- `drawCardsFromDeck()` 在 `drawPile` 空时把 `discardPile` 回填到 `drawPile`，并支持 `excludeFromReshuffle`；这个回填没有事件：`prototype-web/src/sim/runtime.ts:148-185`。
- `DrawCards` 把抽到的牌追加到 `hand`，继续复用 `HandDealt` 事件，没有逐张 `CardDrawn` 或洗回事件：`prototype-web/src/sim/runtime.ts:651-663`。
- `paper_shatter` 的 topdeck 只搜 `drawPile`，不搜 `discardPile`，这点必须保留：`prototype-web/src/sim/runtime.ts:188-205`。

### 1.4 打出与弃牌

- `validatePlayCard()` 校验通过后固定产出 `SpendEnergy` 和 `DiscardPlayedCard`：`prototype-web/src/sim/runtime.ts:520-527`。
- `DiscardPlayedCard` 当前只做 `hand.splice` 后 `discardPile.push`，没有 reason 和事件：`prototype-web/src/sim/runtime.ts:582-589`。
- `CardPlayed` 是在支付、弃牌、链路推进之后入队；ECA 继续以 `CardPlayed` 驱动伤害/抽牌/返 MP：`prototype-web/src/sim/runtime.ts:1020-1052`。

### 1.5 回合末、奖励和 run 边界

- `DiscardHand` 当前把全部 `hand` 推进 `discardPile`，没有逐张分流：`prototype-web/src/sim/runtime.ts:568-571`。
- `end-turn` 进入 `EnemyAttack` 后执行 `DiscardHand(reason: 'turn ended')`，再结算敌人、补位、进下一轮并发牌：`prototype-web/src/sim/runtime.ts:1112-1167`。
- `select-reward` 成功后会 `ClearRewardChoices`、`DiscardHand(reason: 'reward selected')`、`AddCardToDeck`，然后非终局节点立刻 `DealHand`：`prototype-web/src/sim/runtime.ts:1067-1108`。
- `AddCardToDeck` 同时 `deck.push(cardId)` 和 `drawPile.unshift(cardId)`，确保奖励进入下一手节奏：`prototype-web/src/sim/runtime.ts:632-644`。
- `restart-run` 直接返回新的 `createInitialWorld(runNumber + 1)`，所以 v1 新牌区默认会被清空，只要初始化补全即可：`prototype-web/src/sim/runtime.ts:964-966`。

## 2. 最小生命周期 v1 合同

### 2.1 只新增必要类型

建议类型口径：

```ts
type CardZone = 'deck' | 'drawPile' | 'hand' | 'discardPile' | 'exhaustPile' | 'retainedCards' | 'removed';
type CardLifecycleDestination = 'discard' | 'exhaust' | 'retain' | 'remove' | 'stay';

type CardMoveReason =
  | 'draw'
  | 'reshuffle-discard'
  | 'play-default'
  | 'play-exhaust'
  | 'turn-end-discard'
  | 'turn-end-retain'
  | 'reward-selected-discard'
  | 'reward-add-to-draw-top'
  | 'status-created'
  | 'status-play-exhaust'
  | 'status-node-purge';

interface CardLifecycleSpec {
  onPlay?: CardLifecycleDestination;     // 默认 discard
  onTurnEnd?: CardLifecycleDestination;  // 默认 discard
  statusKind?: 'pollution';
  purgeAt?: 'node-end' | 'run-end';
}
```

`PlayerState` 最小新增：

```ts
exhaustPile: CardId[];
retainedCards: CardId[];
```

不建议 v1 新增 `removedPile`。`removed` 可以只作为事件目的地，除非 UI/QA 必须展示永久移除计数。

### 2.2 新命令和事件

最小命令：

| 命令 | 用途 |
| --- | --- |
| `MoveCard` | 单张从一个牌区移动到另一个牌区，带 `reason`。 |
| `ResolvePlayedCardLifecycle` | 替代 `DiscardPlayedCard` 的语义位置，按 `lifecycle.onPlay` 分流。 |
| `ResolveEndTurnHandLifecycle` | 替代 `DiscardHand` 的内部实现，逐张处理弃牌/保留/消耗。 |
| `CreateCardInZone` | 内部命令，用于未来敌人/卡牌/节点把污染牌放进 draw/discard/hand。v1 可以先只服务测试和 reserve-test 状态牌。 |
| `PurgeStatusCards` | 节点结束、终局、重启前清理 `cardType: 'status'` 的 node-scoped 污染牌。 |

最小事件：

| 事件 | 必带字段 | 用途 |
| --- | --- | --- |
| `CardMoved` | `cardId/from/to/reason/traceId/tick` | 所有牌区移动的基础事实。 |
| `CardDiscarded` | `cardId/from/reason` | UI/feed 可读，不强制替代 `CardMoved`。 |
| `CardExhausted` | `cardId/from/reason` | 消耗证据。 |
| `CardRetained` | `cardId/from/reason` | 保留证据。 |
| `CardCreated` | `cardId/to/source/reason/temporary?` | 污染牌进入物理牌区。 |
| `DiscardPileShuffledIntoDrawPile` | `movedCardIds/keptCardIds/excludeFromReshuffle/reason` | 当前 deterministic 回填也要有事件；先不要暗示随机。 |
| `CardDrawn` | `cardId/from/to/reason` | 逐张抽牌证据；`HandDealt` 可继续作为批量兼容事件。 |
| `StatusCardsPurged` | `cardIds/fromZones/reason` | node-scoped 污染清理证据。 |

## 3. 各机制如何接入

### 3.1 消耗

接入点：把 `validatePlayCard()` 里固定的 `DiscardPlayedCard` 改为 `ResolvePlayedCardLifecycle`。

合同：

- 默认卡无 `lifecycle` 时仍等价于 `onPlay: 'discard'`。
- `onPlay: 'exhaust'` 时从 `hand` 移到 `exhaustPile`，不进入 `discardPile`，不参与 `drawPile` 空时的回填。
- 事件顺序建议保持现有大顺序：`SpendEnergy` -> lifecycle move event -> chain events -> `CardPlayed` -> ECA effects。这样不重排现有 ECA，同时让抽牌效果继续用 `excludeFromReshuffle` 保护当前源牌。
- `exhaustPile` 必须进入 `WorldState`、初始化、snapshot、restart baseline。

v1 不做：

- 不做“战斗结束把消耗牌还原到 deck”的实例系统；当前 `deck` 是 run 拥有列表，`exhaustPile` 只表示本节点/当前抽弃循环外。
- 不做同名两张牌中只消耗某一张的来源差异；`CardId[]` 只能表达数量，不能表达单张身份。

### 3.2 保留

接入点：把 `DiscardHand` 的内部实现换成 `ResolveEndTurnHandLifecycle`；把 `DealHand` 改成 retain-aware deal。

合同：

```text
end-turn:
  hand 中 onTurnEnd === retain 的牌 -> retainedCards
  其余普通牌 -> discardPile
  onTurnEnd === exhaust 的牌 -> exhaustPile
  hand 清空

next DealHand:
  kept = retainedCards
  drawCount = max(0, HAND_SIZE - kept.length)
  hand = kept + drawCardsFromDeck(drawCount)
  retainedCards = []
```

关键裁决：

- `reward selected` 是节点切换，不应让 retain 跨过奖励界面。`DiscardHand(reason: 'reward selected')` 应使用强制弃牌/清理路径，不触发 `turn-end-retain`。
- 保留牌占下一手手牌位，不额外扩手牌上限。
- 如果 retainedCards 超过 `HAND_SIZE`，v1 不做选择 UI；测试应先约束不会超过 4，或者按先入顺序截断并记录风险。

### 3.3 状态/污染牌

接入点：复用现有 `CardType: 'status'`，新增 reserve-test 污染牌定义，不进 reward pool；通过 `CreateCardInZone` 或测试布置进入 `drawPile/discardPile/hand`。

推荐 v1 污染牌合同：

```text
cardType: 'status'
lifecycle: {
  onPlay: 'exhaust',
  onTurnEnd: 'discard',
  statusKind: 'pollution',
  purgeAt: 'node-end'
}
```

解释：

- 污染牌是物理卡，占 draw、hand 和 discard 的位置。
- 抽到后可以让玩家用 0 MP 打出并消耗，作为“花一次出牌/占一次节奏”的最小惩罚；暂不做不可打出卡，避免新增不可用按钮状态。
- 未打出则回合末进 `discardPile`，之后可被洗回，形成真实污染循环。
- 节点结束时 `PurgeStatusCards(reason: 'status-node-purge')` 从 `hand/drawPile/discardPile/exhaustPile/retainedCards` 清掉 `cardType: 'status'`，避免普通状态牌变成 run/meta 诅咒。
- 长期负面牌另开 `curse` 或 `persistent pollution`，不要混入 v1。

### 3.4 弃牌原因

接入点：保留 `DiscardHand.reason`，但内部变成逐张移动事件；`DiscardPlayedCard` 也必须带 reason。

最小 reason 映射：

| 场景 | reason |
| --- | --- |
| 普通牌打出后进弃牌 | `play-default` |
| 消耗牌打出后进消耗 | `play-exhaust` |
| 回合末普通手牌弃置 | `turn-end-discard` |
| 回合末保留 | `turn-end-retain` |
| 奖励选择/节点切换丢弃手牌 | `reward-selected-discard` |
| 奖励牌放到 draw 顶 | `reward-add-to-draw-top` |
| 状态牌创建 | `status-created` |
| 状态牌打出消耗 | `status-play-exhaust` |
| 节点结束清污染 | `status-node-purge` |

弃牌原因的价值不是 UI 长文案，而是 QA 和调试能知道“为什么这张牌离开手牌”。

### 3.5 洗回事件

接入点：`drawCardsFromDeck()` 中 `drawPile.length === 0` 且 `discardPile.length > 0` 的分支。

合同：

- 当 `discardPile` 被回填到 `drawPile` 时，发 `DiscardPileShuffledIntoDrawPile`。
- 事件必须记录被移动的 `movedCardIds`、因 `excludeFromReshuffle` 留在 discard 的 `keptCardIds`、以及 `excludeFromReshuffle` 原始参数。
- 当前实现不是随机 shuffle，而是 deterministic recycle；事件名可以用 `Shuffled` 贴近玩家语言，但文档和测试要写清“不验证随机顺序”。
- `CardDrawn` 应在洗回事件之后产生；`HandDealt` 可以继续保留给旧 UI/测试。

## 4. 系统镜头

| # | 镜头 | 当前锚点 | v1 接入判断 |
| ---: | --- | --- | --- |
| 1 | 类型镜头 | `CardType` 有 `status`，关键词有生命周期词，但 `CardDefinition` 无结构字段。 | 加可选 `lifecycle`，不改现有卡默认行为。 |
| 2 | 牌区镜头 | `PlayerState` 只有四区。 | 新增 `exhaustPile/retainedCards`，不要立刻加实例表。 |
| 3 | 初始化镜头 | `deck/drawPile` 从 `startingHand` 复制。 | 新区初始为空，restart 自动清空。 |
| 4 | 打出镜头 | `validatePlayCard()` 固定产出 `DiscardPlayedCard`。 | 替换为 `ResolvePlayedCardLifecycle`，默认仍弃牌。 |
| 5 | ECA 镜头 | `CardPlayed` 仍是伤害/抽牌/返 MP 入口。 | 生命周期事件放在 `CardPlayed` 前，不重写 ECA。 |
| 6 | 自抽护栏镜头 | `DrawCards` 对 `CardPlayed` 源牌加 `excludeFromReshuffle`。 | 保留；消耗牌天然不在 discard，普通抽牌牌仍受保护。 |
| 7 | 回合末镜头 | `DiscardHand` 一次性弃掉全部手牌。 | 改成逐张分流：discard/retain/exhaust/remove。 |
| 8 | 发牌镜头 | `DealHand` 直接 `hand = dealtCards`。 | 改成 `retainedCards + drawn`，并清空 retained。 |
| 9 | reward 镜头 | `AddCardToDeck` 入 deck 且置顶 drawPile。 | 保持，补 `CardMoved/CardAddedToDeck` reason，不让 retain 跨 reward。 |
| 10 | run 边界镜头 | `restart-run` 新建世界，run modifier 仍 preview-only。 | 生命周期 v1 不接 meta，不改变 run modifier。 |
| 11 | 状态污染镜头 | 类型支持 `status`，卡表没有真实状态牌。 | 先加 reserve-test 污染牌和 `CreateCardInZone`，不进 reward pool。 |
| 12 | 洗回镜头 | discard 回填 draw 没事件。 | 增加 `DiscardPileShuffledIntoDrawPile`，保护排查和 UI feed。 |
| 13 | snapshot 镜头 | snapshot 只显式 clone hand/draw/discard。 | deck、新区都要显式 clone，避免调试快照引用污染。 |
| 14 | topdeck 镜头 | `paper_shatter` 只搜 drawPile。 | 生命周期不得让 topdeck 搜 discard/exhaust/retained。 |
| 15 | UI 镜头 | 第 11 轮已确认短 token 原则。 | 新增生命周期反馈也只用短 token，不塞长规则。 |
| 16 | 测试镜头 | 现有 sim 覆盖 reward、topdeck、Wild、run boundary。 | 新增生命周期测试必须先保护这些合同，再测新区。 |

## 5. 风险

| 风险 | 级别 | 说明 | 规避 |
| --- | --- | --- | --- |
| `CardId[]` 无法表达同名实例差异 | P0 | 同名牌一张保留、一张不保留，或一张临时一张永久时会混。 | v1 只做定义级 lifecycle；出现单张差异就停，转 `CardInstanceId`。 |
| reward 选择后错误保留手牌 | P0 | 当前 reward 是节点切换，如果 retain 跨 reward，会破坏奖励入下一手节奏。 | `reward-selected-discard` 强制弃置/清理，不走 turn-end retain。 |
| 洗回事件重排旧测试 | P1 | 旧测试只看 `HandDealt`，新事件可能影响事件顺序断言。 | 保留 `HandDealt`；新事件只插在 draw helper 内，测试按相对顺序。 |
| 状态牌污染跨 run | P1 | 如果状态牌加入 `deck`，restart 外可能被误解成诅咒。 | v1 状态只进 draw/discard/hand，`purgeAt: node-end`；不进 reward pool。 |
| 消耗牌破坏 draw self guard | P1 | 当前源牌先入 discard，再 `DrawCards` 排除源牌。 | 保留 `excludeFromReshuffle`；消耗牌不进入 discard，但普通牌仍受保护。 |
| snapshot 新区引用泄漏 | P1 | `deck` 当前不是显式 clone，新区若靠 spread 可能被 debug 修改污染。 | snapshot 显式 clone `deck/exhaustPile/retainedCards`。 |
| UI 文案超框 | P1 | `CardMoved reason` 直接展示会太长。 | feed/detail 可长；按钮和 HUD 只用短 token。 |
| 事件过多淹没 debug | P2 | 每张牌 draw/move 都发事件，长局可能增长快。 | 保留 `DEBUG_LIMIT`；批量 `HandDealt` 兼容，逐张事件只存必要字段。 |
| 状态牌不可打出会引入新交互 | P2 | 如果 v1 做 unplayable，需要禁用按钮、原因、详情。 | v1 状态先可打出消耗，后续再做不可打出污染。 |
| 随机洗牌误承诺 | P2 | 名字叫 shuffle，但实现是按 discard 顺序回填。 | 测试和 UI 用“洗回/回填”，不承诺随机。 |

## 6. 测试合同

新增测试建议放在 `prototype-web/src/tests/sim/card-lifecycle.test.ts` 或并入现有 lifecycle 文件。必须覆盖：

1. **普通打出不变**：`debt_hook` 打出后从 `hand` 移到 `discardPile`，出现 `CardMoved(reason: 'play-default')`，`CardPlayed` 仍结算伤害。
2. **消耗牌打出**：带 `lifecycle.onPlay = 'exhaust'` 的 reserve-test 牌打出后进入 `exhaustPile`，不在 `discardPile/drawPile/hand`，下一次洗回不出现。
3. **回合末普通弃牌**：未打出的普通手牌进入 `discardPile`，每张有 `CardDiscarded(reason: 'turn-end-discard')`。
4. **保留到下一手**：带 `onTurnEnd = 'retain'` 的牌 end-turn 后进入 `retainedCards`，下一次 `DealHand` 先进入 `hand`，只补抽到 4 张。
5. **reward 不保留**：Reward 状态下 `select-reward` 后，旧手牌即使有 retain 也按 `reward-selected-discard` 处理；奖励牌仍进入下一手。
6. **状态牌占手牌**：把 reserve-test 状态牌放入 `drawPile`，发牌后进入 `hand` 并占一个手牌位。
7. **状态牌打出消耗**：状态牌打出后进入 `exhaustPile`，事件 reason 为 `status-play-exhaust`，不触发伤害/授权误判。
8. **状态牌未打出洗回**：状态牌未打出时 end-turn 进 `discardPile`；后续 drawPile 空时可随 discard 洗回，并出现洗回事件。
9. **节点结束清污染**：Reward 选择或 Settlement 时清理 node-scoped `status`，普通牌和奖励牌不被误删。
10. **洗回事件顺序**：`DiscardPileShuffledIntoDrawPile` 发生在 `CardDrawn/HandDealt` 前，且 `excludeFromReshuffle` 的源牌留在 discard。
11. **topdeck 不搜弃牌**：`paper_shatter` 仍只从 `drawPile` 顶 payoff，不因为洗回事件搜索 `discardPile`。
12. **Wild/授权不退化**：第 11 轮 `ChainExtended`、`wild_gap_key` MP3 延链、`wild_mana_stitch` 不返 MP3 的测试继续通过。
13. **run restart 清空新区**：`restart-run` 后 `exhaustPile/retainedCards` 为空，`drawPile === startingHand`，状态污染不存在。
14. **snapshot clone**：修改 snapshot 里的 `deck/exhaustPile/retainedCards` 不影响原 world。

建议验证命令仍沿用现有门槛：

```bash
cd /Users/roc/Game-001/prototype-web
npm run check
npm run qa:ui
```

## 7. UI 短 token 建议

按钮/牌面只放短 token，详细 reason 放 tooltip/feed/debug。

| 状态 | 短 token | 用途 |
| --- | --- | --- |
| 打出后弃牌 | `弃` | 默认普通牌可省略，只有详情层展示。 |
| 打出后消耗 | `耗` / `消耗` | 卡牌角标和战斗日志。 |
| 回合末保留 | `留` / `保留` | 卡牌角标，end-turn 反馈。 |
| 污染牌 | `污` / `污染` | 状态牌角标。 |
| 洗回 | `洗回` | 牌堆 feed，不进按钮。 |
| 奖励置顶 | `入抽顶` | reward feed。 |
| 回合末弃置 | `弃:回合` | debug/feed。 |
| 出牌弃置 | `弃:出牌` | debug/feed。 |
| 状态清理 | `净` / `清污` | 节点结束 feed。 |
| 牌区计数 | `抽4 弃2 耗1 留1` | HUD 紧凑计数。 |

不建议显示：

- `reward-selected-discard`
- `DiscardPileShuffledIntoDrawPile`
- `status-node-purge`

这些应只在 debug/detail 中出现，玩家层用 `奖励后弃手`、`洗回`、`清污`。

## 8. 最小实施顺序建议

1. 类型补 `CardZone/CardMoveReason/CardLifecycleSpec`，`PlayerState` 补 `exhaustPile/retainedCards`。
2. 初始化和 snapshot 补新区，并显式 clone `deck`。
3. 写 `moveCardBetweenZones()` 小 helper，先服务 `DiscardPlayedCard/DiscardHand`，保证默认行为不变。
4. 替换 `DiscardPlayedCard` 为 `ResolvePlayedCardLifecycle`，普通牌测试先过。
5. 替换 `DiscardHand` 内部为逐张 reason 分流，先不加 retain 内容牌。
6. 改 `DealHand` 支持 retainedCards。
7. 在 `drawCardsFromDeck()` 的 discard 回填处分发洗回事件，或让 helper 返回 `events + drawn`。
8. 加 reserve-test 消耗牌、保留牌、污染牌，不进 reward pool。
9. 补生命周期 sim 测试，再跑现有 reward/topdeck/Wild/run boundary 测试。
10. 最后加 UI 短 token 和 `qa:ui` 检查，避免移动端溢出。

## 9. P2 明确后置

以下不属于生命周期 v1：

- `CardInstanceId` 全迁移。
- 升级、复制、变形、单张临时费用。
- 真实诅咒/永久污染/跨 run 负面成长。
- 商店删牌、净化入口、遗物触发器。
- 完整 `EffectSpec[]/TriggerSpec[]` 解释器。
- 随机洗牌 seed、牌库预视、手动排序 UI。
- 新大批内容牌或新 reward 分支。

STATUS: DONE
