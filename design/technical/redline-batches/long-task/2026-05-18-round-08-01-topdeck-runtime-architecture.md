# 2026-05-18 Round 08-01：Topdeck Runtime Architecture

角色：第 8 轮专家 01，Topdeck Runtime Architect  
工作目录：`/Users/roc/Game-001`  
边界：只新增本文档；不改源码、不提交 git、不回滚他人改动。  
评估目标：第 7 轮已裁决不做完整 reorder。本轮只评估是否值得做极窄 `paper_shatter` / `drawPile-only` / `payoff` 置顶 payoff。

## 0. 当前源码事实

本轮审查了 `prototype-web/src/sim/types.ts`、`prototype-web/src/sim/runtime.ts`、`prototype-web/src/eca/redlineRules.ts`、`prototype-web/src/data/cards.ts` 的相关结构。

- `CardUtility` 已包含 `'reorder'`，但 `Command` 没有 `SearchAndTopdeck`，`GameEvent` 也没有 topdeck / miss 事件。
- `paper_shatter` 当前是 `2 MP / targets: 'self' / cardType: 'draw' / chainRole: 'expand' / drawCards: 1 / utilities: ['draw', 'reorder']`。
- `lantern_captain` 也带 `utilities: ['draw', 'reorder']`，但第 8 轮不应一起打开；否则会回到“双 2MP self draw 都能真找牌”的强度风险。
- `redlineRules.ts` 的 `card.self.resource` 只会基于 `drawCards` 派发 `DrawCards`，并按条件派发 `GainEnergy`；它现在完全不读取 `reorder`。
- `runtime.ts` 的 `drawCardsFromDeck()` 使用 `drawPile.shift()`，所以 `drawPile[0]` 已经是下一抽。
- `AddCardToDeck` 使用 `drawPile.unshift(cardId)`，说明当前运行时已经接受“把某张牌放到牌顶”的语义。
- `processEventQueue()` 会在 `CardPlayed -> DrawCards` 时自动加 `excludeFromReshuffle: [event.cardId]`，这是防止刚打出的 self draw 牌被同次洗回并抽回的关键护栏。
- 当前工作树里上述源码已有修改痕迹；后续实现者必须重新读 diff 后做小 hunk patch，不能整文件覆盖。

## 1. 架构裁决

建议做，但只做极窄样片：

```text
paper_shatter only
CardPlayed 后、DrawCards 前
只搜索 drawPile
只找 payoff
命中后把第一张 payoff 移到 drawPile[0]
随后复用现有 DrawCards
```

这不是完整 reorder，不是牌库浏览器，不是从弃牌堆找牌，也不是玩家手动选择排序。它只是把 `paper_shatter` 的“整备找终结”兑现成一个可观测、可测试、风险较低的运行时动作。

## 2. 最小运行时合同

### 2.1 类型合同

最小类型可以比第 7 轮 `SearchAndTopdeck` 草案更窄：

```ts
type TopdeckPreference = 'payoff';

type Command =
  | {
      type: 'TopdeckFromDrawPile';
      traceId: TraceId;
      sourceCardId: CardId;      // P0 只允许 paper_shatter
      preference: TopdeckPreference;
      excludeCardIds: CardId[];  // 至少包含 sourceCardId
      reason: 'paper-shatter-pre-draw-payoff';
    };
```

事件也保持窄：

```ts
type GameEvent =
  | {
      type: 'DrawPileTopdecked';
      traceId: TraceId;
      tick: number;
      sourceCardId: CardId;
      movedCardId: CardId;
      preference: 'payoff';
      fromIndex: number;
      toIndex: 0;
      searchedCount: number;
      topCardBefore?: CardId;
      topCardAfter: CardId;
    }
  | {
      type: 'DrawPileTopdeckMissed';
      traceId: TraceId;
      tick: number;
      sourceCardId: CardId;
      preference: 'payoff';
      searchedCount: number;
      reason: 'no-payoff-in-draw-pile';
    };
```

如果实现者为了兼容第 7 轮草案沿用 `SearchAndTopdeck / DrawPileReordered / DeckSearchMissed` 命名，也可以接受；但第 8 轮合同必须把字段约束到：

- `sourceCardId === 'paper_shatter'`
- `preference === 'payoff'`
- `zones === ['drawPile']`
- 不允许 `discardPile`
- 不允许 `deck`
- 不允许 `hand`
- 不允许 `reward.choices / reward.candidateCardPool`

### 2.2 候选定义

`payoff` 的 P0 predicate 必须稳定、可测试，不做动态评分：

```text
cards[cardId] exists
AND cardId not in excludeCardIds
AND (
  card.cardType === 'payoff'
  OR card.rewardBranches includes 'payoff'
  OR (card.cost === 3 AND card.targets === 'all-enemies' AND card.comboNode === 'burst')
)
```

命中规则：

- 只从 `world.player.drawPile` 按 index `0 -> n` 搜索。
- 找到第一张合法 payoff 就停止。
- 如果目标本来就在 `drawPile[0]`，仍应发命中事件，但不能复制该牌。
- `searchedCount` 记录实际检查过的 drawPile 项数。

### 2.3 状态变更

命中时只允许这一种状态变更：

```text
const [cardId] = drawPile.splice(fromIndex, 1)
drawPile.unshift(cardId)
```

未命中时：

- 不改 `drawPile`
- 不改 `discardPile`
- 不改 `hand`
- 不改 `deck`
- 不阻止后续 `DrawCards`

## 3. 事件 / 命令顺序

`paper_shatter` 的唯一推荐顺序：

```text
play-card paper_shatter
-> SpendEnergy
-> DiscardPlayedCard
-> advanceCostChain
-> ChainAdvanced / ChainBroken / ChainRepaired / AuthorizationGranted（按现有链路自然产生）
-> CardPlayed(effectMultiplier = 当前链路倍率)
-> TopdeckFromDrawPile(sourceCardId = paper_shatter, preference = payoff)
-> DrawPileTopdecked 或 DrawPileTopdeckMissed
-> DrawCards(count = paper_shatter.drawCards * CardPlayed.effectMultiplier,
             excludeFromReshuffle = [paper_shatter])
-> HandDealt(cardIds)
```

放置点必须满足两个条件：

- `TopdeckFromDrawPile` 必须在同一 `CardPlayed` 派生的 `DrawCards` 之前。
- `TopdeckFromDrawPile` 不能直接把牌放进 `hand`；玩家拿到牌的唯一证据仍是后续 `HandDealt`。

在当前 `evaluateRules(redlineRules, world, event)` 模型下，最小接入方式是在 `card.self.resource` 前新增一个更窄的规则，例如 `card.self.paper-shatter-topdeck`。因为规则数组按顺序评估并立即应用命令，前置规则可以自然保证 topdeck 命令早于 `DrawCards`。

## 4. 和现有合同的关系

### 4.1 不改变抽牌倍率

`paper_shatter.drawCards` 仍是 `1`，真实抽牌数仍由：

```text
drawCards * CardPlayed.effectMultiplier
```

决定。topdeck 只改变第一张将要抽到的牌，不改变抽几张。

### 4.2 不改变费用链

topdeck 发生在 `advanceCostChain()` 和 `CardPlayed` 之后，不写：

- `chain.playedCosts`
- `chain.nextExpectedCost`
- `chain.multiplier`
- `chain.broken`
- `chain.repairedThisTurn`
- `player.tempAuthorizationMP`
- `player.payoffArmed`

因此它不能补链、不能返 MP、不能授予授权。

### 4.3 不改变奖励与 run 边界

topdeck 只能由 `CardPlayed(paper_shatter)` 派生，不能在 `Reward`、`Deal`、`EnemyAttack`、`EnemyRefill`、`Settlement` 阶段运行。

必须保持：

- `AddCardToDeck` 的 `deck.push + drawPile.unshift` 奖励置顶语义。
- `select-reward -> ClearRewardChoices -> DiscardHand -> AddCardToDeck -> DealHand` 顺序。
- `restart-run` 后不残留任何 topdeck 状态。

### 4.4 不打开 lantern_captain

`lantern_captain` 当前也有 `utilities: ['draw', 'reorder']`，但第 8 轮不建议接入 runtime。原因：

- 它会让两张 2 MP self draw 同时获得真找牌能力。
- 它的文案是“找路线”，不是本轮 payoff-only 目标。
- 一旦做 route predicate，就会引入 starter / bridge / expand 的分类争议，扩大测试面。

本轮可以保留它的 UI “整备”标签，但不能让它发 topdeck 命令。

## 5. 禁止事项

- 禁止完整 reorder、手动重排、拖拽 UI、牌库浏览器、确认弹窗或 pending topdeck state。
- 禁止搜索 `discardPile`；第 8 轮只评估 drawPile-only payoff 置顶。
- 禁止搜索或复制 `deck`；`deck` 是拥有列表，不是实时牌区。
- 禁止搜索 `hand`；手牌已可见可打，不属于下一抽规划。
- 禁止搜索 `reward.choices`、`reward.candidateCardPool` 或任何奖励池。
- 禁止直接把命中牌 push 到 `hand`。
- 禁止改变 `DrawCards.count`、`HandDealt` 语义、`excludeFromReshuffle` 护栏。
- 禁止让 miss 静默无事件；必须能区分“没找到”和“机制没运行”。
- 禁止把 topdeck 和 MP、Max MP、授权、Wild 修补、局外成长、删牌、消耗、保留、状态牌、CardInstance 迁移绑定。
- 禁止把 `paper_shatter` 加进起手或调整 `rewardCardPool` 顺序来掩盖机制强度。

## 6. 风险

### P0 风险：payoff 率过高

即使只搜 `drawPile`，`paper_shatter` 在 `0 -> 1 -> 2` 链路里可能以倍率抽 3。若命中 payoff，玩家很容易在同回合拿到 3 MP 终结牌并用授权支付。后续平衡必须观察“完成授权链后 payoff 到手率”，而不是只看抽牌张数。

缓解：首版只打开 `paper_shatter`，不打开 `lantern_captain`，且只搜 `drawPile`。

### P1 风险：事件顺序错误

如果 topdeck 命令排在 `DrawCards` 后面，机制会变成“为下次抽牌置顶”，与 `paper_shatter` 当前“接链抽3找终结”的读感冲突。

缓解：topdeck 规则必须放在 `card.self.resource` 前，并加测试断言同 trace 下 topdeck event 早于 `HandDealt`。

### P1 风险：复制牌

`drawPile[0]` 命中时如果实现成单纯 `unshift(cardId)`，会复制 payoff。

缓解：无论 `fromIndex` 是否为 0，都走“先 splice 再 unshift”或对 `fromIndex === 0` 做 no-op，但事件仍记录命中。

### P1 风险：与 reshuffle 护栏冲突

`paper_shatter` 打出后会进入 `discardPile`。当前 `DrawCards` 的 `excludeFromReshuffle: [event.cardId]` 是必要护栏。虽然本轮不搜弃牌堆，但抽牌时仍必须保留该排除规则。

缓解：不要改 `processEventQueue()` 里对 `DrawCards` 自动补 `excludeFromReshuffle` 的逻辑。

### P2 风险：HUD 承诺过大

如果 UI 文案写成“选择一张终结牌”或“打开牌库整备”，玩家会以为有交互选择。

缓解：日志只写短事实，例如“整备置顶终结”或“整备未命中”，不要出现“选择/浏览/重排”。

## 7. 最小验收用例

建议新增或调整的测试只覆盖窄合同：

1. `paper_shatter topdecks first payoff from drawPile before draw resolves`
   - Given `drawPile = [spark_tap, severance_burst, red_ledger_burst]`
   - When 打出 `paper_shatter`
   - Then 命中 `severance_burst`，事件早于 `HandDealt`，`HandDealt.cardIds[0] === 'severance_burst'`

2. `paper_shatter records hit when payoff already on top`
   - Given `drawPile = [severance_burst, spark_tap]`
   - Then 发命中事件，`fromIndex === 0`，不复制 `severance_burst`

3. `paper_shatter misses when payoff only exists outside drawPile`
   - Given `drawPile` 无 payoff，`discardPile / deck / reward.candidateCardPool` 有 payoff
   - Then 必须 miss，且不能把这些区域的 payoff 复制到 `drawPile`

4. `lantern_captain does not trigger round-08 topdeck`
   - Given 打出 `lantern_captain`
   - Then 不出现本轮 topdeck 命令或事件，仍按普通 `DrawCards` 处理

5. 回归测试
   - 奖励牌仍在选择后进入下一手
   - `blood_tithe / pulse_draw` 抽牌倍率不变
   - Wild opener 不返 MP，broken chain 后 Wild 不修补
   - payoff 是否可打仍由现有 energy / authorization 校验决定

## 8. 结论

第 8 轮可以实现 `paper_shatter` 的极窄 topdeck payoff 样片，但必须把它视为“drawPile-only 自动置顶”而不是完整 reorder。最小运行时合同是：`CardPlayed(paper_shatter)` 派生一个前置 topdeck command，只扫描 `drawPile` 的第一张合法 payoff，命中则移到 `drawPile[0]` 并发事件，未命中也发 miss 事件，然后完全复用现有 `DrawCards -> HandDealt`。

不建议本轮实现 `lantern_captain`、弃牌堆搜索、手动选择、通用 search preference、CardInstance 或任何 UI 面板。这样第 8 轮能验证 payoff 置顶是否真的改善“抽到终结”的体验，同时把强度、状态和移动端 UI 风险控制在最小范围内。

STATUS: DONE
