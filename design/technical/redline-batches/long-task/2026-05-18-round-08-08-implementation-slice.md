# 2026-05-18 Round 08-08：paper_shatter drawPile-only payoff 置顶最小实现切片

角色：第 8 轮专家 08，Implementation Slice Engineer  
工作目录：`/Users/roc/Game-001`  
边界：本文只新增文档，不改源码，不提交 git，不回滚他人改动。本文不是完整 reorder 方案，只给主线程一份可落地的最小实现切片。

## 0. 范围裁决

本轮只做一个极窄样片：

- 只打开 `paper_shatter`。
- 只在 `paper_shatter` 自身的抽牌结算前触发。
- 只搜索 `player.drawPile`。
- 只找 payoff 牌。
- 只把命中的 1 张 payoff 移到 `drawPile[0]`，然后复用现有 `DrawCards`。
- 找不到时不改任何牌区，只记一个 miss 事件。

不做：

- 不打开 `lantern_captain`。
- 不搜索 `discardPile`。
- 不搜索 `hand`。
- 不做手动重排 UI。
- 不做牌库浏览器、候选弹窗、拖拽排序。
- 不改奖励池、初始牌组、敌人、费用、伤害、XP、run/meta。

一句话实现目标：`paper_shatter` 从“抽 1/接链抽 3 的整备概念牌”变成“抽牌前先把 drawPile 中第一张 payoff 顶到牌顶，再按原倍率抽牌”的可测样片。

## 1. 当前源码事实

当前工作树已有大量并行改动，后续实现者不能整文件覆盖，只能读当前 diff 后小 hunk patch。

已确认事实：

- `CardUtility` 已包含 `'reorder'`。
- `paper_shatter` 是 `2 MP / self / drawCards: 1 / utilities: ['draw', 'reorder']`，文案已经写了“接链抽3找终结”。
- `lantern_captain` 也是 `utilities: ['draw', 'reorder']`，但本轮不启用它。
- `drawCardsFromDeck()` 用 `drawPile.shift()` 抽牌，所以 `drawPile[0]` 是牌顶。
- `AddCardToDeck` 已用 `drawPile.unshift(cardId)`，牌顶语义已经存在。
- `redlineRules.ts` 的 `card.self.resource` 会在 `CardPlayed` 后发 `DrawCards`，但当前不会读取 `reorder`。
- `processEventQueue()` 已在 `CardPlayed -> DrawCards` 时传 `excludeFromReshuffle: [event.cardId]`，这个护栏必须保留。
- `PayoffTriggered` 和 `PayoffResolved` 已存在；payoff 识别应复用现有 `isPayoffFinisher` 语义或同等窄判断。

## 2. 必须触碰文件

### 2.1 `prototype-web/src/sim/types.ts`

只加最小类型，不引入完整 SearchPreference / CardSearchZone 泛化模型。

建议新增在 `CardDefinition` 附近：

```ts
export interface CardDefinition {
  // existing fields...
  preDrawTopdeckPayoff?: boolean;
}
```

扩展 `Command`：

```ts
| {
    type: 'TopdeckPayoffFromDrawPile';
    traceId: TraceId;
    sourceCardId: CardId;
  }
```

扩展 `GameEvent`：

```ts
| {
    type: 'PayoffTopdecked';
    traceId: TraceId;
    tick: number;
    sourceCardId: CardId;
    cardId: CardId;
    searchedCount: number;
  }
| {
    type: 'PayoffTopdeckMissed';
    traceId: TraceId;
    tick: number;
    sourceCardId: CardId;
    searchedCount: number;
  }
```

不要新增 `WorldState` 字段，不要引入 `discardPile` zone 类型，不要做可配置 preference。第 8 轮只需要“drawPile payoff topdeck”。

### 2.2 `prototype-web/src/data/cards.ts`

只给 `paper_shatter` 加：

```ts
preDrawTopdeckPayoff: true
```

可选文案微调只限 `paper_shatter`，例如把 `detail` 明确为“只从抽牌堆找终结”。但首选不改文案，避免和 HUD 压缩轮冲突。

不许给 `lantern_captain` 加字段。

### 2.3 `prototype-web/src/sim/runtime.ts`

新增一个窄 helper 和一个 `applyCommand` 分支。

推荐 helper 放在 `drawCardsFromDeck()` 附近：

```ts
function topdeckPayoffFromDrawPile(world: WorldState, sourceCardId: CardId): { cardId: CardId; searchedCount: number } | null {
  const index = world.player.drawPile.findIndex((cardId) => cardId !== sourceCardId && isPayoffFinisher(cards[cardId]));
  if (index < 0) {
    return null;
  }
  const [cardId] = world.player.drawPile.splice(index, 1);
  world.player.drawPile.unshift(cardId);
  return { cardId, searchedCount: index + 1 };
}
```

`applyCommand()` 新增分支：

- 找到目标：发 `PayoffTopdecked`。
- 找不到：发 `PayoffTopdeckMissed`。
- `searchedCount` 对 miss 用 `world.player.drawPile.length`。
- 如果 payoff 本来就在 `drawPile[0]`，仍允许命中并发 `PayoffTopdecked`，状态等价但证据清楚。

不能改：

- `drawCardsFromDeck()` 的洗牌逻辑。
- `DrawCards` 分支。
- `processEventQueue()` 的 `excludeFromReshuffle`。
- `validatePlayCard()`、支付、授权、payoff 伤害。

### 2.4 `prototype-web/src/eca/redlineRules.ts`

在 `card.self.resource` 前新增一条窄规则，例如 `card.self.paper-shatter-topdeck-payoff`。

触发条件必须同时满足：

- `event.type === 'CardPlayed'`
- `event.cardId === 'paper_shatter'`
- `cards[event.cardId].preDrawTopdeckPayoff === true`
- `cards[event.cardId].targets === 'self'`
- `cards[event.cardId].drawCards` 存在

动作只发：

```ts
{
  type: 'TopdeckPayoffFromDrawPile',
  traceId: event.traceId,
  sourceCardId: event.cardId
}
```

必须放在 `card.self.resource` 前面，让 `TopdeckPayoffFromDrawPile` 先于 `DrawCards` 入队并执行。

### 2.5 `prototype-web/src/ui/hud.ts`

只补 combat log / recent event 文案，不改布局、不改 CSS。

建议：

- `PayoffTopdecked`：`整备：终结置顶`
- `PayoffTopdeckMissed`：`整备未找到终结`

保持 `hudCardRoleLabel(cards.paper_shatter) === '整备'`。不要把卡牌按钮改成长句，不要新增面板。

### 2.6 测试文件

首选新增窄测试：

- `prototype-web/src/tests/sim/redline-paper-shatter-topdeck.test.ts`

必须覆盖：

1. `paper_shatter` 打出后，在 `DrawCards` 前把 `drawPile` 中第一张 payoff 置到顶并抽入手。
2. 只搜索 `drawPile`：当 payoff 在 `discardPile` 时不命中，不从弃牌堆移动。
3. 不启用 `lantern_captain`：同样牌区下打 `lantern_captain` 不产生 `PayoffTopdecked`。
4. miss 不改 `drawPile` 顺序。
5. `paper_shatter` 自身不能通过 reshuffle 被本次抽回，保留 `excludeFromReshuffle` 护栏。

视现有测试状态再小改：

- `prototype-web/src/tests/ui/hud-target-selection.test.ts`：若新增 HUD event 文案 helper，需要补一条事件文案断言。
- `prototype-web/src/tests/sim/redline-progression-card-system.test.ts`：如果已有断言说 reorder 完全未实现，只把 `paper_shatter` 的说法改成“极窄 drawPile payoff topdeck 已实现”，保留 `lantern_captain` 未启用。

推荐定向命令：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run src/tests/sim/redline-paper-shatter-topdeck.test.ts src/tests/ui/hud-target-selection.test.ts src/tests/sim/redline-progression-card-system.test.ts
```

若触碰了 `types.ts` / `runtime.ts` 的共享合同，再跑：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run
npm run build
```

## 3. 不许触碰文件

源码文件层面不许触碰：

- `prototype-web/src/sim/world.ts`
- `prototype-web/src/sim/snapshot.ts`
- `prototype-web/src/sim/rewardChoices.ts`
- `prototype-web/src/sim/rewardProgression.ts`
- `prototype-web/src/sim/runModifiers.ts`
- `prototype-web/src/presentation/renderer/corridorRenderer.ts`
- `prototype-web/src/style.css`
- `prototype-web/index.html`
- `package.json`
- `vite.config.*`
- `tsconfig*.json`

设计文档层面不许触碰：

- 不修改其它 `design/technical/redline-batches/long-task/` 专家文档。
- 不重写第 7 轮实现切片。
- 不把本轮切片升级成完整 reorder 设计。

机制边界不许触碰：

- 不改 `lantern_captain`。
- 不改 `discardPile`。
- 不改 `rewardCardPool`。
- 不改 `startingHand`。
- 不改 `CardInstanceId` / 保留 / 消耗 / 状态牌生命周期。
- 不改随机洗牌或 seeded shuffle。
- 不改 `maxEnergy`、`tempAuthorizationMP`、`payoffArmed`。
- 不改 payoff 数值、敌人 HP、敌人意图。

## 4. 推荐 patch 顺序

### 4.1 并行保护预检

先跑：

```bash
cd /Users/roc/Game-001
git status --short
git diff -- prototype-web/src/sim/types.ts prototype-web/src/sim/runtime.ts prototype-web/src/eca/redlineRules.ts prototype-web/src/data/cards.ts prototype-web/src/ui/hud.ts
```

如果目标文件在读取后又被别人改过，重新读目标 hunk。禁止整文件替换，禁止格式化全文件，禁止 `git checkout --` 或 `git reset --hard`。

### 4.2 类型最小化

先改 `types.ts`：

1. `CardDefinition.preDrawTopdeckPayoff?`
2. `Command.TopdeckPayoffFromDrawPile`
3. `GameEvent.PayoffTopdecked`
4. `GameEvent.PayoffTopdeckMissed`

这一步不应引入泛化搜索类型。

### 4.3 卡牌声明

再改 `cards.ts`：

- 只给 `paper_shatter` 加 `preDrawTopdeckPayoff: true`。
- 不碰 `lantern_captain`。
- 不碰 reward pool。

### 4.4 runtime 命令

再改 `runtime.ts`：

1. 加 `topdeckPayoffFromDrawPile()`。
2. 在 `applyCommand()` 加 `TopdeckPayoffFromDrawPile` 分支。
3. 确认命中后 `drawPile[0]` 是 payoff。
4. 确认 miss 时牌区引用顺序不变。

### 4.5 ECA 顺序

再改 `redlineRules.ts`：

- 新规则放在 `card.self.resource` 前。
- filter 写死 `paper_shatter`，不要用 `utilities.includes('reorder')` 泛化到 `lantern_captain`。

### 4.6 HUD 最小文案

最后改 `hud.ts`：

- 只加两个事件的日志短文案。
- 不加 CSS。
- 不改移动端布局。

### 4.7 测试

先新增 `redline-paper-shatter-topdeck.test.ts`，再按失败结果小改旧测试。不要为通过测试放宽本轮边界。

## 5. 冲突点

| 冲突点 | 为什么容易冲突 | 处理方式 |
| --- | --- | --- |
| `types.ts` union | 多轮都在加 `Command` / `GameEvent` | 只追加小 union，不移动已有块，不重新排序。 |
| `runtime.ts applyCommand()` | 奖励、授权、抽牌、payoff 都在这里汇合 | 只加一个新 case，不碰 `DrawCards`、`SpendEnergy`、`AddCardToDeck`。 |
| `redlineRules.ts` 规则顺序 | `card.self.resource` 已负责抽牌 | 新规则必须在它前面；不要改已有规则内容。 |
| `cards.ts paper_shatter` | 第 7 轮 HUD 压缩已经改过文案 | 首选只加字段，不碰文案。 |
| `hud.ts` | 移动端 UI 正在被压缩保护 | 只加事件文案，不碰布局和 CSS。 |
| 旧测试语义 | 之前可能断言 reorder 未实现 | 只把 `paper_shatter` 改成已实现极窄样片，保留 `lantern_captain` 未实现。 |
| `discardPile` 诱惑 | 第 7 轮完整方案曾建议 drawPile + discardPile | 第 8 轮明确不搜 discard，测试必须锁死。 |

## 6. 回滚点

不能使用 `git reset --hard`、`git checkout --` 或整文件覆盖。只能按本轮 hunk 小补丁回退。

| 回滚点 | 回滚内容 | 不应回滚内容 |
| --- | --- | --- |
| R1：卡牌开关 | 删除 `paper_shatter.preDrawTopdeckPayoff`。 | 不改 `paper_shatter` 其它现有字段，不碰 `lantern_captain`。 |
| R2：ECA 触发 | 删除 `card.self.paper-shatter-topdeck-payoff` 规则。 | 不改 `card.self.resource` 抽牌规则。 |
| R3：runtime 命令 | 删除 `TopdeckPayoffFromDrawPile` case 和 helper。 | 不改 `drawCardsFromDeck()`、`DrawCards`、reshuffle 护栏。 |
| R4：类型 | 删除本轮新增 `Command` / `GameEvent` / `CardDefinition` 字段。 | 不改既有 payoff、authorization、reward 类型。 |
| R5：HUD 文案 | 删除 `PayoffTopdecked` / `PayoffTopdeckMissed` 文案分支。 | 不改 HUD 压缩 token、CSS、移动端布局。 |
| R6：测试 | 删除或改回 `redline-paper-shatter-topdeck.test.ts` 及旧测试的本轮断言。 | 不回滚其它奖励、授权、run/meta 测试。 |

优先回滚顺序：先关卡牌开关 R1，再删 ECA R2。这样即使 runtime 类型暂时存在，也不会影响实战行为，便于主线程继续排查。

## 7. 验收口径

实现完成后必须能证明：

- `paper_shatter` 命中 drawPile 中第一张 payoff，并在本次抽牌中把它抽入手。
- payoff 在 `discardPile` 时不会被找出。
- `lantern_captain` 不产生置顶事件。
- miss 不改变 `drawPile` 顺序。
- 本轮没有新增手动 UI、没有新 CSS、没有牌库浏览器。
- 奖励池、起手、费用、敌压、payoff 数值都未变。
- `paper_shatter` 仍是压力下的受限找 payoff 样片，不是全牌堆 tutor。

STATUS: DONE
