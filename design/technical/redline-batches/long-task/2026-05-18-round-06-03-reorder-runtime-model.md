# 2026-05-18 Round 06-03：重排 / 检索运行时模型审查

角色：第 6 轮专家 03，重排 / 检索运行时机制架构师  
工作目录：`/Users/roc/Game-001`  
范围：只审查 `draw`、`discard`、`hand`、临时资源、`reorder` 相关运行时事实，并给出最小可实现模型。  
边界：本文只新增文档，不改源码，不提交 git。

## 1. 一句话结论

`paper_shatter` 和 `lantern_captain` 现在确实只有 `utilities: ['draw', 'reorder']`、`keywords: ['抽牌', '整备']` 和 HUD 文案层含义；运行时没有任何 `ReorderDrawPile`、`SearchDeck`、`TopdeckCard`、`CardReordered` 或玩家选择牌库顶的命令 / 事件。

如果第 6 轮要补一个能支撑 demo 的 1:1 卡牌机制切口，最小实现不应是“大牌库浏览 UI”，而应是：在 `CardPlayed` 后、`DrawCards` 前，按卡牌声明的检索偏好从 `drawPile` 优先、`discardPile` 其次找到一张 payoff 或 route 牌，移动到 `drawPile` 顶部，然后复用现有 `DrawCards` 抽进手牌。这样玩家看到的是“整备找终结 / 找路线”真的改变了下一次抽牌结果，但 UI 只需要日志和短提示。

## 2. 当前 draw pile / discard / hand 代码事实

### 2.1 牌区模型是定义级 `CardId[]`

`PlayerState` 当前只有四个牌区数组：

```text
deck: CardId[]
hand: CardId[]
drawPile: CardId[]
discardPile: CardId[]
```

没有 `CardInstanceId`、`exhaustPile`、`retainedCards`、`limbo`、临时费用实例、复制体来源或单张 modifier。打出同名牌时，运行时用 `hand.indexOf(cardId)` 移除第一张匹配牌。

初始世界中：

```text
deck = startingHand
hand = []
drawPile = startingHand
discardPile = []
```

`startingHand` 当前是 `debt_hook / heartbeat_spark / redline_cut / row_cleave`，用于教学 0 -> 1 -> 2。

### 2.2 抽牌是 `shift()`，牌顶就是数组头

`drawCardsFromDeck(world, count)` 每次从 `world.player.drawPile.shift()` 抽牌。也就是说：

- `drawPile[0]` 是下一张会被抽到的牌。
- `AddCardToDeck` 用 `drawPile.unshift(cardId)` 把奖励牌放到牌顶。
- `DrawCards` 会把抽到的牌 `push(...drawn)` 到当前手牌尾部。
- `DealHand` 会把抽到的 4 张直接覆盖为新手牌，并恢复 `energy = maxEnergy`。

这给最小 topdeck 模型提供了直接落点：只要在 `DrawCards` 前把目标牌移动到 `drawPile[0]`，现有抽牌逻辑就能自然抽到它。

### 2.3 弃牌和回填是确定性循环，不是随机洗牌

当前弃牌路径：

- 打出牌：`DiscardPlayedCard` 从 `hand` 移除该 `cardId`，加入 `discardPile`。
- 结束回合：`DiscardHand` 把剩余 `hand` 全部加入 `discardPile`，然后清空手牌。
- 选择奖励：先 `DiscardHand`，再 `AddCardToDeck`，再进入下一轮发牌。

当前回填路径：

- 抽牌时如果 `drawPile` 空，且 `discardPile` 非空，就把 `discardPile` 原顺序回填为新的 `drawPile`。
- 这不是 seeded shuffle，也没有随机化。
- `excludeFromReshuffle` 可以让刚打出的 self draw 卡不立刻从弃牌堆回洗再抽回来。`processEventQueue` 在 `CardPlayed -> DrawCards` 时会自动把 `event.cardId` 塞进 `excludeFromReshuffle`。

这个护栏对 `paper_shatter / lantern_captain` 很重要：如果后续检索允许从 `discardPile` 找牌，也必须继承“不要检索刚打出的自己”这条规则。

### 2.4 抽牌倍率已经是真运行时

`redlineRules.ts` 的 `card.self.resource` 规则对所有 `targets: 'self'` 的牌生效：

```text
DrawCards.count = card.drawCards * event.effectMultiplier
GainEnergy.amount = card.energyGain
```

因此：

- `blood_tithe` 第一张打出通常抽 1。
- `pulse_draw` 接在 0 MP 后，`effectMultiplier = 2`，真实抽 2。
- `paper_shatter / lantern_captain` 如果在 0 -> 1 -> 2 链路的 2 MP 位置打出，`effectMultiplier = 3`，真实抽 3。
- `energyGain` 不吃倍率，`wild_mana_stitch` 当前只给当前 MP +1，不提高 `maxEnergy`。

### 2.5 临时资源边界已经清楚

当前临时资源主要有：

- `energy`：当前回合 MP，发牌时恢复到 `maxEnergy`。
- `maxEnergy = 3`：当前没有永久 MP 成长。
- `tempAuthorizationMP`：完成未断裂 0 -> 1 -> 2 后给本回合 payoff-only 授权。
- `authorizationRestriction = 'payoff-only'`：只允许支付 3 MP、全场、`burst` payoff。
- `payoffArmed`：本回合终结是否已被授权。

离开 `PlayerTurn` 时会 `resetCostChain`，临时授权清空。本文建议的 reorder / 检索模型不应改变这些资源边界；它只改变“下一次抽到什么”，不提供 MP、Max MP、局外成长或永久检索权。

## 3. `paper_shatter / lantern_captain` 当前是否只有文案

结论：是。它们当前的 `reorder` 只存在于卡牌 metadata、关键词、HUD 文案和测试说明中。

### 3.1 卡牌数据

`paper_shatter`：

```text
cost: 2
targets: self
cardType: draw
chainRole: expand
drawCards: 1
utilities: ['draw', 'reorder']
rulesText: 抽1。接链抽3找终结。
mobileEffect: 抽1/3
keywords: ['抽牌', '整备']
```

`lantern_captain`：

```text
cost: 2
targets: self
cardType: draw
chainRole: expand
drawCards: 1
utilities: ['draw', 'reorder']
rulesText: 抽1。接链抽3找路线。
mobileEffect: 抽1/3
keywords: ['抽牌', '整备']
```

两张牌在运行时都只会进入 `card.self.resource`：按倍率发 `DrawCards`，没有第二个 `reorder` action。

### 3.2 命令 / 事件层没有 reorder

`Command` 联合类型里与牌区相关的命令只有：

- `DealHand`
- `DiscardPlayedCard`
- `DiscardHand`
- `AddCardToDeck`
- `DrawCards`

`GameEvent` 中有 `HandDealt`、`CardPlayed`、`RewardChosen`、`CardAddedToDeck` 等，但没有 `CardDrawn`、`CardMoved`、`DeckSearched`、`CardTopdecked`、`DrawPileReordered`。

### 3.3 测试已经锁定“不承诺 reorder”

现有测试有两类证据：

- sim 测试对 `paper_shatter / lantern_captain` 断言：它们抽到 `drawPile` 顶部的牌，并且 `commandOrEventMentions(..., 'reorder') === false`。
- UI 测试断言：当 reorder 只存在于 metadata 时，HUD 只显示 `整备/找牌`，不写“重排牌库”。

所以第 6 轮不能继续把 `utilities: ['reorder']` 当作已实现机制。要么文案继续降级为“整备找牌”，要么给它补一个明确、可测试、可回滚的最小运行时。

## 4. reorder / 检索的三个可选实现

### 4.1 方案 A：抽前看 N，再手动排序

语义：

```text
查看 drawPile 顶部 N 张 -> 玩家手动调整顺序 -> 继续抽牌
```

优点：

- 最像传统 `scry / reorder`。
- 玩家能明确感知“我改了牌序”。

问题：

- 需要一个临时 UI 状态：展示 N 张牌、支持拖拽或按钮排序、确认 / 取消。
- 需要新 intent：`confirm-reorder`。
- 需要处理移动端触控、遮挡、回合中输入锁、debug 回放。
- 若只是 demo，成本太高，且会把焦点从“战斗爽 + 找终结”转移到小型牌库管理界面。

结论：适合作为 P1/P2 真正重排，不适合当前 demo 首刀。

### 4.2 方案 B：抽后筛选，保留一张或多张

语义：

```text
抽 N 张临时候选 -> 玩家选择保留 K 张 -> 其余放回顶部 / 底部 / 弃牌堆
```

优点：

- 更像“检索 / 发现”而不是纯重排。
- 玩家能感知选择价值。
- 可以用现有卡牌按钮样式做一个小候选条。

问题：

- 仍需要 pending choice 状态和确认 intent。
- 要定义未选牌去哪：回牌顶会变强，回牌底需要底部语义，弃牌堆会改变牌区生命周期。
- 会和当前 `DrawCards` 直接进手牌的路径冲突，需要临时候选区。

结论：比方案 A 更适合后续“找一张牌”的技能，但仍不是第 6 轮最小实现。

### 4.3 方案 C：自动检索并把 payoff / route 顶置，再复用现有抽牌

语义：

```text
CardPlayed(paper_shatter / lantern_captain)
-> SearchAndTopdeck(payoff 或 route)
-> DrawCards(count = drawCards * multiplier)
```

最小规则：

- 只在 `utilities` 包含 `reorder` 且卡牌有 `drawCards` 时触发。
- 优先搜索 `drawPile`，找不到再搜索 `discardPile`。
- 不搜索 `hand`，不搜索刚打出的自己。
- 找到后，把目标牌从原位置移除并 `unshift` 到 `drawPile` 顶部。
- 随后沿用已有 `DrawCards`，让目标牌被抽进手牌。
- 如果没有找到候选牌，只发一个 `DeckSearchMissed` 或不发移动事件，仍正常抽牌。

优点：

- 不需要新增玩家选择 UI。
- 与现有 `drawPile.shift()`、`AddCardToDeck.unshift()` 的牌顶语义完全一致。
- 能让“抽3找终结 / 找路线”从文案变成可测试运行时。
- 可直接用 debug trace / combat log 显示“整备：已把 Severance Burst 置于牌顶”。

问题：

- 它更像自动 tutor / topdeck，不是玩家手动 reorder。
- 如果搜索全 `discardPile`，强度可能偏高。
- 两张 2 MP 牌都启用同一强力检索，会让奖励路线重复且过稳。

结论：这是最适合当前 demo 的实现。它不是完整 reorder，但它把 `reorder` 标签兑现成“检索并控制下一抽”的真实机制，成本和 UI 风险最低。

## 5. 推荐 demo 切口

### 5.1 只做 `SearchAndTopdeck`，不做大 UI

新增最小命令 / 事件建议：

```ts
type SearchPreference = 'payoff' | 'route' | 'repair';

type Command =
  | {
      type: 'SearchAndTopdeck';
      traceId: TraceId;
      sourceCardId: CardId;
      preference: SearchPreference;
      lookCount?: number;
      excludeFromSearch?: CardId[];
    };

type GameEvent =
  | {
      type: 'CardTopdecked';
      traceId: TraceId;
      tick: number;
      sourceCardId: CardId;
      cardId: CardId;
      fromZone: 'drawPile' | 'discardPile';
      preference: SearchPreference;
      searchedCount: number;
    }
  | {
      type: 'DeckSearchMissed';
      traceId: TraceId;
      tick: number;
      sourceCardId: CardId;
      preference: SearchPreference;
      searchedCount: number;
    };
```

这不是最终 API，只是说明最小边界：一个命令、两个事件、无新 UI state。

### 5.2 候选牌选择规则

建议先用显式规则，避免引入通用查询语言：

```text
payoff:
  card.cardType === 'payoff'
  或 card.rewardBranches 包含 'payoff'
  或 cost === 3 && targets === 'all-enemies' && comboNode === 'burst'

route:
  card.rewardBranches 包含 'route-bridge'
  或 card.chainRole 是 starter / bridge / expand 且 cost 匹配当前链路需要

repair:
  card.rewardBranches 包含 'repair-resource'
  或 utilities 包含 wild / draw / mana
```

搜索顺序：

1. 先看 `drawPile`，保持当前确定性顺序。
2. 若没找到，再看 `discardPile`，但排除 `sourceCardId`。
3. 找到第一张即可，不做排序评分。
4. 从原 zone 移除一张并顶置到 `drawPile`。

`lookCount` 建议首版先不开放，或只限制 `drawPile` 顶部 5 张；如果同时搜索整个 `discardPile`，强度更像 tutor。demo 若要稳定展示，建议用固定测试局面保证目标在 `drawPile` 前 3-5 张，不靠全牌库作弊。

### 5.3 单卡建议

`paper_shatter` 更适合 demo 首刀：

- 当前卡名是 `Paper Route`，规则写“接链抽3找终结”。
- 在 0 -> 1 -> 2 后打出时，`effectMultiplier = 3`，它的身份就是“完成授权但缺 3 MP payoff 时找终结”。
- 推荐 `preDrawSearch.preference = 'payoff'`。
- 固定脚本：`debt_hook -> redline_cut -> paper_shatter`，让 `severance_burst` 被顶置并被抽进手牌，再用授权打出。

`lantern_captain` 不建议和 `paper_shatter` 同时作为默认 demo 首批：

- 两张牌都是 `2 MP / self / draw 1 / reorder tag`，同构太强。
- 若保留它，建议定位成 `route`：找下一段 route / repair，而不是同样找 payoff。
- 可以作为第二张证明同一命令支持不同 `SearchPreference` 的测试牌，但不在首个可玩 demo 里同屏教学。

### 5.4 与现有事件顺序的插入点

当前顺序是：

```text
validatePlayCard
-> SpendEnergy
-> DiscardPlayedCard
-> advanceCostChain
-> CardPlayed
-> redlineRules(card.self.resource)
-> DrawCards
```

推荐变成：

```text
CardPlayed
-> SearchAndTopdeck if card.utilities includes reorder
-> DrawCards
```

原因：

- `advanceCostChain` 已经算出 `effectMultiplier`，可以决定是“找路线”还是“找终结”。
- `DiscardPlayedCard` 已经把当前牌放入弃牌堆，所以 `SearchAndTopdeck` 必须排除 `sourceCardId`。
- `DrawCards` 仍负责真实抽牌、回填和 `HandDealt` 事件，避免复制抽牌逻辑。

### 5.5 不应混入的内容

第 6 轮 demo 不应顺手做这些：

- 不做拖拽排序 UI。
- 不做牌库浏览器。
- 不做 `CardInstanceId` 迁移。
- 不做 `exhaustPile` / retain / status card。
- 不做随机洗牌或 seed。
- 不做通用 `EffectSpec` / `TriggerSpec` 解释器。
- 不让 `reorder` 提供 MP、Max MP、永久成长或局外解锁。

## 6. 测试建议

### 6.1 保留当前事实测试

在实现前，当前测试继续成立：

- `paper_shatter / lantern_captain` 只是 self draw support。
- HUD 不承诺“重排牌库”。
- `DrawCards` 按 `effectMultiplier` 放大。
- self draw 不会立刻洗回刚打出的自己。

实现 `SearchAndTopdeck` 后，必须同步更新“不会出现 reorder”的旧断言，让它变成“出现明确的 topdeck / search 事件”，不能让旧测试和新机制互相打架。

### 6.2 新增 sim 验收

建议新增 5 个窄测试：

1. `paper_shatter` 在 0 -> 1 后打出，`severance_burst` 位于 `drawPile` 第 2 或第 3 张时，先产生 `CardTopdecked`，再 `HandDealt.cardIds` 包含 `severance_burst`。
2. `paper_shatter` 找不到 payoff 时，产生 `DeckSearchMissed`，仍按原顺序抽牌。
3. `paper_shatter` 不会从 `discardPile` 检索刚打出的 `paper_shatter` 自己。
4. `lantern_captain` 若启用 `route`，只找 route / repair，不抢 payoff 槽。
5. 选择奖励后 `AddCardToDeck` 的 `unshift` 语义不变；`SearchAndTopdeck` 不能破坏“奖励牌下一手可见”的测试。

### 6.3 UI 验收

UI 只做最小提示：

- 卡牌标签仍写 `整备/找牌`，不要写“打开牌库”“手动重排”。
- combat log 可新增一句：`整备：Severance Burst 置于牌顶`。
- pile chip 继续显示 `牌库/抽/弃/手` 数量；如果发生顶置，抽牌后数量变化要和事件一致。
- 移动端卡面仍保持短文案：`抽1/3 找终结` 或 `抽1/3 找路线`。
- 若没找到目标，日志写 `整备未找到终结`，不要静默失败到玩家以为 bug。

## 7. demo 裁决

第 6 轮最适合 demo 的实现是方案 C：

```text
paper_shatter:
  CardPlayed 后自动 SearchAndTopdeck(payoff)
  然后 DrawCards(count = 1 * effectMultiplier)

lantern_captain:
  首版不强行同屏开放；
  若要接入，同一命令但 preference = route。
```

这能用最小改动补上 `reorder` 的运行时真相：不是复杂 UI 重排，而是“整备让下一抽更像你想找的路线 / payoff”。它也贴合当前 Redline demo 的核心：坏手修补、抽牌、临时授权、找终结，而不是完整 deckbuilder 管理界面。

## 8. 证据路径

- `prototype-web/src/sim/types.ts`：`CardUtility` 含 `reorder`；`PlayerState` 为 `deck/hand/drawPile/discardPile: CardId[]`；`Command` 只有 `DrawCards / DiscardHand / AddCardToDeck` 等，没有 reorder 命令。
- `prototype-web/src/data/cards.ts`：`paper_shatter` 与 `lantern_captain` 都是 `2 MP / self / drawCards: 1 / utilities: ['draw', 'reorder']`。
- `prototype-web/src/sim/runtime.ts`：`drawCardsFromDeck` 用 `shift()`；`AddCardToDeck` 用 `unshift()`；`DrawCards` 把抽牌加入手牌；`processEventQueue` 为 self draw 排除刚打出的牌。
- `prototype-web/src/eca/redlineRules.ts`：self card 的抽牌数量是 `card.drawCards * event.effectMultiplier`，没有读取 `reorder`。
- `prototype-web/src/ui/hud.ts`：HUD 将 reorder 显示为 `整备/找牌`，并替换“重排”为“整备”，不承诺真实牌库操作。
- `prototype-web/src/tests/sim/redline-progression-card-system.test.ts`：当前测试明确断言 `paper_shatter / lantern_captain` 不产生 reorder 命令 / 事件。
- `prototype-web/src/tests/ui/hud-target-selection.test.ts`：当前 UI 测试明确断言 reorder 只作为 metadata 时不承诺真实重排。

STATUS: DONE  
路径：`/Users/roc/Game-001/design/technical/redline-batches/long-task/2026-05-18-round-06-03-reorder-runtime-model.md`
