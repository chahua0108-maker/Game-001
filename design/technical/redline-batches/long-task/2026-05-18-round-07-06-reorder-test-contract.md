# 2026-05-18 Round 07-06：reorder Vitest 合同

角色：第 7 轮专家 06，reorder 测试合同工程师  
工作目录：`/Users/roc/Game-001`  
输出边界：本文只新增测试合同文档，不改源码、不提交 git。  

## 0. 结论

真实 reorder 的最小可实现合同不应做“打开牌库手动排序 UI”。本轮应把 `reorder` 兑现为一个可观测、可回归的自动 `SearchAndTopdeck`：打出 `paper_shatter / lantern_captain` 后，先按偏好从 `drawPile` 查找目标牌，必要时再从 `discardPile` 查找；找到后移动到 `drawPile[0]`，再复用现有 `DrawCards` 抽进手牌。

Vitest 必须锁住五件事：

1. `drawPile[0]` 是牌顶，`SearchAndTopdeck` 必须发生在 `DrawCards` 前。
2. `discardPile` 可以作为 fallback，但不能绕过刚打出的牌排除规则。
3. 刚打出的 `sourceCardId` 不能被搜索、顶置或同次抽回。
4. `AddCardToDeck -> DealHand` 的奖励进入下一手合同不被 reorder 破坏。
5. HUD/helper 文案保持短标签，不把“手动重排牌库”或长说明塞进卡牌按钮导致超框。

## 1. 最小运行时合同口径

本文只定义测试要锁的合同，不规定最终源码文件如何拆分。

### 1.1 命令与事件的可观测面

建议最小新增：

```ts
type SearchPreference = 'payoff' | 'route';

type Command =
  | {
      type: 'SearchAndTopdeck';
      traceId: TraceId;
      sourceCardId: CardId;
      preference: SearchPreference;
      excludeFromSearch: CardId[];
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
      searchedDrawCount: number;
      searchedDiscardCount: number;
    }
  | {
      type: 'DeckSearchMissed';
      traceId: TraceId;
      tick: number;
      sourceCardId: CardId;
      preference: SearchPreference;
      searchedDrawCount: number;
      searchedDiscardCount: number;
    };
```

测试不应只检查最终手牌。必须检查 `CardTopdecked` 或 `DeckSearchMissed`，否则未来有人在 `DrawCards` 里偷偷改顺序也会误通过。

### 1.2 触发顺序

目标顺序：

```text
SpendEnergy
-> DiscardPlayedCard
-> ChainAdvanced / CardPlayed
-> SearchAndTopdeck
-> DrawCards
-> HandDealt
```

测试断言：

- `CardTopdecked.traceId === CardPlayed.traceId === HandDealt.traceId`
- `CardTopdecked` 在 `debug.events` 中早于同 trace 的 `HandDealt`
- `HandDealt.cardIds[0]` 是刚被顶置的目标牌
- `drawPile` 最终不再包含那一张被抽走的目标牌

### 1.3 候选规则

首版只锁两张牌，避免测试变成通用查询语言：

| source card | preference | 合格候选 |
| --- | --- | --- |
| `paper_shatter` | `payoff` | `cardType === 'payoff'` 或 `rewardBranches` 包含 `payoff` |
| `lantern_captain` | `route` | `rewardBranches` 包含 `route-bridge`，且不是 3 费 payoff |

搜索顺序：

1. 先按当前数组顺序查 `drawPile`。
2. `drawPile` 找不到时再查 `discardPile`。
3. 同一 zone 找到第一张即可，不做评分排序。
4. 找到后从原 zone 删除一张，并 `unshift` 到 `drawPile` 顶部。
5. `excludeFromSearch` 至少包含刚打出的 `sourceCardId`。

## 2. 必须新增测试

### 2.1 新增 sim 文件：`prototype-web/src/tests/sim/reorder-search-topdeck.test.ts`

建议独立建文件，不塞进大而杂的 `runtime.test.ts`。公共 helper 只做可控 world setup：

```ts
function preparePlayerTurn(world, hand, drawPile, discardPile, energy = 3): void
function playCard(world, cardId, traceId): void
function eventsByTrace(world, traceId): GameEvent[]
function commandsByTrace(world, traceId): Command[]
```

#### Case 1：`paper_shatter` 从 `drawPile` 查 payoff 并顶置到下一抽

Given：

- hand: `['paper_shatter']`
- drawPile: `['spark_tap', 'severance_burst', 'wild_gap_key']`
- discardPile: `[]`
- energy: `3`

When：`play-card paper_shatter`

Then：

- `SearchAndTopdeck` command 存在，`sourceCardId === 'paper_shatter'`，`preference === 'payoff'`
- `CardTopdecked` 存在，`cardId === 'severance_burst'`，`fromZone === 'drawPile'`
- `CardTopdecked` 早于同 trace `HandDealt`
- `HandDealt.cardIds[0] === 'severance_burst'`
- `world.player.hand` 包含 `severance_burst`，不包含 `paper_shatter`
- `world.player.drawPile` 保留非目标牌的相对顺序：`['spark_tap', 'wild_gap_key']` 中未被抽走的部分仍按原顺序

#### Case 2：`paper_shatter` 从 `discardPile` fallback 查 payoff

Given：

- hand: `['paper_shatter']`
- drawPile: `['spark_tap', 'wild_gap_key']`
- discardPile: `['heartbeat_spark', 'severance_burst', 'redline_cut']`

When：`play-card paper_shatter`

Then：

- `CardTopdecked.fromZone === 'discardPile'`
- `CardTopdecked.cardId === 'severance_burst'`
- `discardPile` 不再包含本次被移动的 `severance_burst`
- `HandDealt.cardIds[0] === 'severance_burst'`
- `paper_shatter` 仍留在 `discardPile`，证明刚打出的牌没有被同次检索走

#### Case 3：`drawPile` 候选优先于 `discardPile` 候选

Given：

- drawPile: `['red_ledger_burst', 'spark_tap']`
- discardPile: `['severance_burst']`

When：`play-card paper_shatter`

Then：

- 顶置的是 `red_ledger_burst`
- `severance_burst` 仍在 `discardPile`
- `searchedDrawCount` 至少覆盖到 `red_ledger_burst` 的位置，`searchedDiscardCount === 0` 或不进入 discard fallback

这个测试防止实现者先扫 discard，导致弃牌堆 payoff 抢走 draw pile 顶部候选。

#### Case 4：刚打出的 reorder 牌不能被检索或同次抽回

Given：

- hand: `['paper_shatter']`
- drawPile: `[]`
- discardPile: `['paper_shatter', 'severance_burst']`

When：`play-card paper_shatter`

Then：

- `SearchAndTopdeck.excludeFromSearch` 包含 `paper_shatter`
- `CardTopdecked.cardId !== 'paper_shatter'`
- `HandDealt.cardIds` 不包含 `paper_shatter`
- `discardPile` 最终至少包含一张 `paper_shatter`

如果只剩 `discardPile: ['paper_shatter']`，则应走 Case 5 的 miss。

#### Case 5：没有候选时 miss，但仍正常抽牌

Given：

- hand: `['paper_shatter']`
- drawPile: `['spark_tap', 'wild_gap_key']`
- discardPile: `['redline_cut']`

When：`play-card paper_shatter`

Then：

- 没有 `CardTopdecked`
- 有 `DeckSearchMissed`，`preference === 'payoff'`
- 仍有 `DrawCards` command
- `HandDealt.cardIds` 按原抽牌顺序开始，例如第一张仍是 `spark_tap`
- 不产生 `failedConditions`

Miss 是合法运行时结果，不应阻止抽牌。

#### Case 6：`lantern_captain` 找 route，不抢 payoff

Given：

- hand: `['lantern_captain']`
- drawPile: `['severance_burst', 'spark_tap', 'red_ledger_burst']`
- discardPile: `['clearance_order']`

When：`play-card lantern_captain`

Then：

- `SearchAndTopdeck.preference === 'route'`
- 顶置 `spark_tap`，不顶置 `severance_burst`
- `HandDealt.cardIds[0] === 'spark_tap'`

这个测试让两张 reorder 牌有不同职责，避免 `lantern_captain` 变成第二张 `paper_shatter`。

### 2.2 更新旧 sim 用例：`redline-progression-card-system.test.ts`

当前用例：

```text
keeps paper_shatter / lantern_captain as self draw support without asserting reorder runtime
```

必须保留这个用例的保护意图，但改写冲突断言：

- 保留：两张牌仍是 `targets: 'self'`
- 保留：`utilities` 仍包含 `reorder`
- 保留：打出后仍会抽牌，且 `DrawCards.count === drawCards * effectMultiplier`
- 删除或改写：`commandOrEventMentions(..., 'reorder') === false`
- 新增：断言出现 `SearchAndTopdeck` 和 `CardTopdecked` 或 `DeckSearchMissed`

建议重命名为：

```text
keeps paper_shatter and lantern_captain as self draw support with observable search/topdeck runtime
```

### 2.3 新增 reward 回归：`progression-reward-regression.test.ts`

新增一条专门防止 reorder 破坏奖励下一手：

Given：

- Reward 非终局
- selectedCard: `severance_burst`
- reward 前 drawPile 非空：`['spark_tap', 'paper_shatter', 'wild_gap_key']`
- reward 前 discardPile 包含 reorder 相关牌也可以：`['lantern_captain']`

When：`select-reward severance_burst`

Then：

- 同 trace 有 `CardAddedToDeck`
- 同 trace 有 `HandDealt`
- `HandDealt.cardIds` 包含 `severance_burst`
- 没有 `SearchAndTopdeck`，没有 `CardTopdecked`
- `world.player.hand` 包含 `severance_burst`
- `world.player.drawPile` 不包含本次刚选的 `severance_burst`

原因：奖励入牌靠 `AddCardToDeck.unshift`，不是靠 reorder 搜索。reorder 只能由 `CardPlayed` 触发，不能污染 `select-reward` 流程。

### 2.4 新增 UI helper 测试：`prototype-web/src/tests/ui/hud-target-selection.test.ts`

在现有 HUD helper 测试里新增一组短文案合同：

```ts
it('keeps reorder helper copy short enough for card buttons', () => {
  expect(hudCardRoleLabel(cards.paper_shatter)).toBe('整备/找牌');
  expect(hudCardRoleLabel(cards.lantern_captain)).toBe('整备/找牌');

  const paperPreview = hudCardIntentPreview(cards.paper_shatter, intentSnapshot(), null, 3);
  const lanternPreview = hudCardIntentPreview(cards.lantern_captain, intentSnapshot(), null, 3);

  expect(paperPreview.label.length).toBeLessThanOrEqual(8);
  expect(lanternPreview.label.length).toBeLessThanOrEqual(8);
  expect(paperPreview.label).not.toContain('重排牌库');
  expect(lanternPreview.label).not.toContain('重排牌库');
});
```

若实现者新增公开 helper 生成 combat log 文案，也要测：

- 命中：`整备 Severance Burst`
- miss：`整备未找到终结`
- 单条日志不超过 18 个中文字符或 28 个等宽字符
- 不出现 `打开牌库`、`拖拽排序`、`手动重排`

Vitest 只能锁 helper 输出长度和禁词。真实 DOM 是否超框仍由浏览器验收触发条件决定。

## 3. 必须保留的旧测试

这些旧测试不能因为 reorder 落地而删除或放宽：

| 文件 | 必须保留的合同 |
| --- | --- |
| `prototype-web/src/tests/sim/runtime.test.ts` | `amplifies a 1-cost draw card...`，抽牌倍率仍由 `CardPlayed.effectMultiplier` 决定 |
| `prototype-web/src/tests/sim/runtime.test.ts` | `does not immediately reshuffle and redraw a just-played 0-cost self draw card...`，刚打出的 self draw 不能同次抽回 |
| `prototype-web/src/tests/sim/runtime.test.ts` | Wild 修补正负例，reorder 不能改变费用链、返 MP、授权边界 |
| `prototype-web/src/tests/sim/progression-reward-regression.test.ts` | 非终局奖励 `blood_tithe / pulse_draw` 进入下一手，终局奖励进入 Settlement 不发牌 |
| `prototype-web/src/tests/sim/reward-branching.test.ts` | 默认奖励池三分支顺序与显式 `rewardBranches` 优先级 |
| `prototype-web/src/tests/ui/hud-target-selection.test.ts` | `hudCardRoleLabel` 不把 reorder 说成真实“重排牌库”；self card 不承诺降低意图 |

唯一必须改写的是旧的“没有任何 reorder 字样”断言。真实 reorder 实现后，不能再要求 command/event 里没有 reorder/search/topdeck；应改成要求有明确的 `SearchAndTopdeck` 证据。

## 4. 边界负例

### 4.1 不能搜索 hand

Given：`severance_burst` 已经在 hand 里，draw/discard 没有 payoff。  
When：打出 `paper_shatter`。  
Then：必须 `DeckSearchMissed`，不能把手里的 `severance_burst` 移到 drawPile，也不能复制一张新的。

### 4.2 不能搜索 deck 原始全集

Given：`player.deck` 包含 `severance_burst`，但 `drawPile/discardPile` 都没有 payoff。  
Then：必须 miss。`deck` 是构筑全集，不是抽牌来源。

### 4.3 不能复制或销毁卡

在每个 topdeck 测试后统计：

```ts
const zones = [
  ...world.player.hand,
  ...world.player.drawPile,
  ...world.player.discardPile
];
```

同一张被移动的 cardId 如果在原局面只有一张，则总数仍应是一张。注意当前系统还没有 `CardInstanceId`，所以这条只适合用测试局面保证目标牌唯一。

### 4.4 discard fallback 不能跳过 drawPile 候选

如果 `drawPile` 有合格 route/payoff，`discardPile` 里的更强同类牌不能抢先。测试必须用两个不同 payoff 来钉住优先级。

### 4.5 刚打出的牌不能被 discard fallback 带走

因为 `DiscardPlayedCard` 先把 source 放进 `discardPile`，所以搜索 discard 时必须排除本 trace 的 `sourceCardId`。这条不能只依赖 `DrawCards.excludeFromReshuffle`，因为 topdeck 发生在 DrawCards 前。

### 4.6 Miss 不能阻断抽牌

`DeckSearchMissed` 是 search 的结果，不是 play-card 失败条件。miss 后仍按 `DrawCards.count` 抽牌；除非 draw/discard 都空，才没有 `HandDealt`。

### 4.7 reorder 不能改变 reward 结算

`select-reward` trace 下不能出现 `SearchAndTopdeck`。奖励牌进入下一手仍靠 `AddCardToDeck` 在 `DealHand` 前 `unshift`，不是靠 reorder 搜索。

### 4.8 UI helper 不能用长说明伪装规则

禁止 helper 输出：

- `打开牌库选择一张终结牌`
- `手动重排抽牌堆`
- `抽3并从弃牌堆和抽牌堆检索终结`

允许短标签：

- `整备/找牌`
- `抽3仍-7`
- `抽3 整备`
- `整备终结`

## 5. 浏览器验收触发条件

纯 runtime 类型和 sim 测试改动，不必默认开浏览器。但出现以下任一情况，必须跑浏览器验收：

1. 修改 `prototype-web/src/ui/hud.ts` 的可见文案、日志文案、卡牌按钮渲染或 helper 输出。
2. 修改 `prototype-web/src/style.css`，尤其是 `.card-*`、`.combat-feed`、`.hud-*`、移动端 media query。
3. 新增 `CardTopdecked / DeckSearchMissed` 到 combat log 或 debug panel。
4. 改 `paper_shatter / lantern_captain` 的 `rulesText`、`mobileEffect`、`detail`、`description`。
5. Vitest 只能证明 helper 字符串长度，但不能证明 DOM 没有 `scrollWidth > clientWidth`。

浏览器验收最小路径：

- 桌面宽度：`1280x720`
- 移动宽度：`390x844`
- 进入含 `paper_shatter` 或 `lantern_captain` 的可控手牌局面
- 打出 reorder 牌后看到短日志或 debug 事件
- 卡牌按钮 `.card-intent-preview`、`.card-meta`、`.card-effect` 没有文本互相覆盖
- 移动端卡牌行允许横向滚动，但单张卡内部文本不应超出自身边界

建议浏览器断言：

```js
for (const selector of ['.card-intent-preview', '.card-meta', '.card-effect', '.combat-feed li']) {
  for (const el of document.querySelectorAll(selector)) {
    if (el.offsetParent && el.scrollWidth > el.clientWidth + 1) {
      throw new Error(`${selector} overflow: ${el.textContent}`);
    }
  }
}
```

## 6. 推荐 Vitest 命令

实现 reorder 后，至少跑：

```bash
cd prototype-web
npm test -- \
  src/tests/sim/reorder-search-topdeck.test.ts \
  src/tests/sim/redline-progression-card-system.test.ts \
  src/tests/sim/runtime.test.ts \
  src/tests/sim/progression-reward-regression.test.ts \
  src/tests/sim/reward-branching.test.ts \
  src/tests/ui/hud-target-selection.test.ts
```

如果改动触及 `types.ts` 或 `redlineRules.ts`，建议跑完整：

```bash
cd prototype-web
npm test
```

## 7. 验收底线

本合同通过的最低标准：

- 新增 `reorder-search-topdeck.test.ts`，覆盖 drawPile 命中、discard fallback、draw 优先、刚打出牌排除、miss 仍抽牌、lantern route 不抢 payoff。
- 旧的 self draw/reward/倍率/刚打出牌不回洗测试继续存在。
- 与真实 reorder 冲突的旧断言被改写为 `SearchAndTopdeck / CardTopdecked / DeckSearchMissed` 断言。
- 奖励进入下一手仍由 `select-reward` trace 下的 `CardAddedToDeck + HandDealt` 证明，且没有 reorder 事件污染。
- HUD helper 文案测试锁住短标签和禁词；任何可见 UI 文案或 CSS 改动都触发桌面和移动浏览器复核。

STATUS: DONE
