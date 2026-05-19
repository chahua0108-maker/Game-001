# 2026-05-18 Round 07-08：reorder 最小实现切片

角色：第 7 轮专家 08，实现切片工程师  
工作目录：`/Users/roc/Game-001`  
边界：本文只新增文档，不改源码，不提交 git。若主线程决定实现 reorder，按本文做最小代码切片。

## 0. 当前源码事实

当前工作树已有并行改动，且 `prototype-web/src/sim/types.ts`、`runtime.ts`、`redlineRules.ts`、`cards.ts`、`hud.ts`、多份测试文件都处于已修改或未跟踪状态。后续实现者不能整文件覆盖这些文件，只能在重新读取当前 diff 后做小 hunk patch。

当前 `reorder` 的真实状态：

- `CardUtility` 已包含 `'reorder'`。
- `paper_shatter` 和 `lantern_captain` 都是 `2 MP / self / drawCards: 1 / utilities: ['draw', 'reorder']`。
- `redlineRules.ts` 的 `card.self.resource` 只会发 `DrawCards` 和条件 `GainEnergy`，不会读取 `reorder`。
- `Command` 里没有 `SearchAndTopdeck` / `ReorderDrawPile`。
- `GameEvent` 里没有 `CardTopdecked` / `DeckSearchMissed`。
- `drawCardsFromDeck()` 用 `drawPile.shift()` 抽牌，所以 `drawPile[0]` 就是牌顶。
- `AddCardToDeck` 已用 `drawPile.unshift(cardId)`，牌顶语义已经存在。
- `processEventQueue()` 已在 `CardPlayed -> DrawCards` 时给刚打出的牌加 `excludeFromReshuffle: [event.cardId]`，这条护栏必须保留。

因此最小实现不应做拖拽重排 UI，而是把 `reorder` 兑现为：`CardPlayed` 后、`DrawCards` 前，按卡牌声明的偏好从 `drawPile` 优先、`discardPile` 其次找一张目标牌，顶置到 `drawPile[0]`，随后复用现有 `DrawCards`。

## 1. 必须触碰文件

### 1.1 `prototype-web/src/sim/types.ts`

新增类型字段，放在现有卡牌/命令/事件类型附近：

```ts
export type SearchPreference = 'payoff' | 'route' | 'repair';
export type CardSearchZone = 'drawPile' | 'discardPile';

export interface CardDefinition {
  // existing fields...
  preDrawSearch?: {
    preference: SearchPreference;
    lookCount?: number;
  };
}
```

扩展 `Command`：

```ts
| {
    type: 'SearchAndTopdeck';
    traceId: TraceId;
    sourceCardId: CardId;
    preference: SearchPreference;
    lookCount?: number;
    excludeFromSearch?: CardId[];
  }
```

扩展 `GameEvent`：

```ts
| {
    type: 'CardTopdecked';
    traceId: TraceId;
    tick: number;
    sourceCardId: CardId;
    cardId: CardId;
    fromZone: CardSearchZone;
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
  }
```

不要新增 `WorldState` 字段；牌区仍保持 `CardId[]`，避免把本切片扩大成 CardInstance 迁移。

### 1.2 `prototype-web/src/data/cards.ts`

只给已经有 `utilities: ['draw', 'reorder']` 的牌加声明字段，不改数值、不改奖励池顺序。

首刀建议只打开 `paper_shatter`：

```ts
preDrawSearch: { preference: 'payoff' }
```

如果主线程明确要求同时兑现 `lantern_captain`，同一机制可加：

```ts
preDrawSearch: { preference: 'route' }
```

不要改 `startingHand`、`rewardCardPool`、`cost`、`drawCards`、`availability`、`rewardBranches`。当前奖励池已经被其它并行工作调整过，本切片不要顺手重排。

### 1.3 `prototype-web/src/sim/runtime.ts`

必须新增纯 helper 和一个 `applyCommand` 分支。

建议函数顺序：

1. 在 `isPayoffFinisher()` 附近补候选判断：
   - `matchesSearchPreference(cardId, preference, world)`
   - `payoff` 复用 `isPayoffFinisher(card)` 或 `rewardBranches.includes('payoff')`
   - `route` 只认 `rewardBranches.includes('route-bridge')`，并排除 payoff
   - `repair` 只认 `rewardBranches.includes('repair-resource')` 或 `utilities` 含 `wild/mana/draw`
2. 在 `drawCardsFromDeck()` 附近补牌区搜索：
   - `findTopdeckCandidate(world, command)`
   - 搜索顺序固定为 `drawPile` 再 `discardPile`
   - 不搜索 `hand`
   - 默认排除 `sourceCardId`
   - `lookCount` 只限制 `drawPile`，不要限制 `discardPile`，除非主线程另有强度裁决
3. 在 `applyCommand()` 的 switch 中加入 `SearchAndTopdeck`：
   - 找到目标：从原 zone `splice(index, 1)`，再 `drawPile.unshift(cardId)`
   - 返回 `CardTopdecked`
   - 找不到：不改牌区，返回 `DeckSearchMissed`
4. 不改 `drawCardsFromDeck()` 的 reshuffle 逻辑。
5. 不改 `processEventQueue()` 的 `DrawCards + excludeFromReshuffle` 护栏。

关键点：如果目标本来就在 `drawPile[0]`，仍可以发 `CardTopdecked`，因为这证明搜索命中；状态上等价于移除再放回牌顶。

### 1.4 `prototype-web/src/eca/redlineRules.ts`

在 `card.self.resource` 规则前新增一个窄规则，例如 `card.self.pre-draw-search`。

触发条件：

- `event.type === 'CardPlayed'`
- `cards[event.cardId].targets === 'self'`
- `cards[event.cardId].utilities?.includes('reorder')`
- `cards[event.cardId].drawCards` 存在
- `cards[event.cardId].preDrawSearch` 存在

动作只发一个命令：

```ts
{
  type: 'SearchAndTopdeck',
  traceId: event.traceId,
  sourceCardId: event.cardId,
  preference: card.preDrawSearch.preference,
  lookCount: card.preDrawSearch.lookCount,
  excludeFromSearch: [event.cardId]
}
```

必须放在 `card.self.resource` 前面。`evaluateRules()` 会先算出结果，再按规则顺序应用命令；这样 `SearchAndTopdeck` 会排在 `DrawCards` 前，且不用在 runtime 里特殊插队。

### 1.5 `prototype-web/src/ui/hud.ts`

只补 combat log 文案，不改布局：

- `CardTopdecked`：`整备：{CardName} 置于牌顶`
- `DeckSearchMissed`：`整备未找到{终结/路线/修补}`

现有卡牌标签继续显示 `整备/找牌`，不要改成“手动重排”“打开牌库”。

### 1.6 测试文件

优先新增一个窄文件，减少和既有大测试冲突：

- `prototype-web/src/tests/sim/redline-reorder-topdeck.test.ts`

同时修改已有旧断言：

- `prototype-web/src/tests/sim/redline-progression-card-system.test.ts`
  - 当前 `paper_shatter / lantern_captain` 的“没有 reorder runtime”语义需要拆开。
  - 保留 HUD 不承诺手动重排的事实，但 sim 层要改成断言 `CardTopdecked` 或 `DeckSearchMissed`。
- `prototype-web/src/tests/ui/hud-target-selection.test.ts`
  - 保留 `hudCardRoleLabel(cards.paper_shatter) === '整备/找牌'`。
  - 若加了 combat log 可见性测试，再补对应 snapshot/DOM 断言；不要扩大成移动端布局重做。

## 2. 不许触碰文件

本切片不应触碰：

- `prototype-web/src/sim/world.ts`：初始牌组、初始牌区、敌人、run 初态都不变。
- `prototype-web/src/sim/snapshot.ts`：debug events 已整体复制，新事件不需要额外 adapter。
- `prototype-web/src/sim/rewardChoices.ts`：奖励分支和排序不是本切片。
- `prototype-web/src/sim/rewardProgression.ts`：XP 阈值不是本切片。
- `prototype-web/src/sim/runModifiers.ts`、`rewardProgression.ts`、`rewardChoices.ts` 以外的 run/meta 文件。
- `prototype-web/src/presentation/renderer/corridorRenderer.ts`：新事件可先由 HUD 日志表达，3D 表现不是首刀。
- `prototype-web/src/style.css`：不做新面板、不做牌库浏览器。
- `prototype-web/index.html`、`package.json`、`vite/tsconfig` 配置。
- `design/technical/redline-batches/long-task/` 下其它专家文档。

也不许触碰这些设计边界：

- 不做拖拽排序 UI。
- 不做牌库浏览器。
- 不做 `CardInstanceId`、保留、消耗、状态牌、临时牌生命周期。
- 不做随机洗牌或 seeded shuffle。
- 不让 reorder 返 MP、改 `maxEnergy`、改局外成长。
- 不把 `paper_shatter` / `lantern_captain` 加进起手。
- 不重排当前 `rewardCardPool`。

## 3. 实现顺序

### 3.1 并行保护预检

实现前先跑：

```bash
cd /Users/roc/Game-001
git status --short
git diff -- prototype-web/src/sim/types.ts prototype-web/src/sim/runtime.ts prototype-web/src/eca/redlineRules.ts prototype-web/src/data/cards.ts prototype-web/src/ui/hud.ts
```

如果这些文件在你读取后又被别人改过，先重新读目标 hunk。不要用整文件写入、格式化全文件、`git checkout --` 或 `git reset --hard`。

### 3.2 类型先行

先改 `types.ts`。只加：

1. `SearchPreference`
2. `CardSearchZone`
3. `CardDefinition.preDrawSearch?`
4. `Command.SearchAndTopdeck`
5. `GameEvent.CardTopdecked`
6. `GameEvent.DeckSearchMissed`

这一层通过 TypeScript 后，后续文件才有清晰合同。

### 3.3 Runtime 纯逻辑

再改 `runtime.ts`，先写纯 helper，再加 `applyCommand` case。不要先碰规则层。

建议行为锁定：

- `drawPile` 命中时：从原位置移到 `drawPile[0]`。
- `discardPile` 命中时：从弃牌堆移到 `drawPile[0]`。
- 命中目标如果是 `sourceCardId`：跳过。
- 没命中：牌区不变。
- `searchedCount` 记录实际检查过的候选数量，便于测试。

### 3.4 ECA 插入点

再改 `redlineRules.ts`，把 `card.self.pre-draw-search` 放到 `card.self.resource` 前。这个顺序是整个切片的核心：先顶牌，再让现有 `DrawCards` 抽牌。

不要把搜索逻辑写在 `card.self.resource` 里；那会把抽牌、返 MP、找牌揉成一个大规则，后续不好回滚。

### 3.5 数据开关

最后改 `cards.ts`。`preDrawSearch` 是本切片天然 feature gate：

- 只打开 `paper_shatter` 时，最小 demo 是“找终结”。
- 同时打开 `lantern_captain` 时，必须加 route 偏好测试，证明它不抢 payoff。

如果实现后要快速停用 reorder，第一回滚点就是删这个字段，engine 可暂时留着不触发。

### 3.6 HUD 日志

最后补 `hud.ts` 的 `combatEventLabel()` 两个事件分支。不要改 `hudCardRoleLabel()` 的 `整备/找牌` 口径，也不要新增 UI 状态。

## 4. 测试顺序

### 4.1 新增窄 sim 测试

新增 `prototype-web/src/tests/sim/redline-reorder-topdeck.test.ts`，至少覆盖：

1. `paper_shatter` 在 `0 -> 1 -> 2` 后触发 `SearchAndTopdeck(payoff)`，当 `severance_burst` 在 `drawPile` 第 2 或第 3 张时，先产生 `CardTopdecked`，再由 `HandDealt.cardIds[0]` 抽到 `severance_burst`。
2. 找不到 payoff 时产生 `DeckSearchMissed`，并保持原顺序抽牌。
3. `discardPile` 中有 payoff 时可以移到牌顶，但不会检索刚打出的 `paper_shatter` 自己。
4. 如果启用 `lantern_captain.preDrawSearch = { preference: 'route' }`，它应找 `route-bridge`，不能优先找 `severance_burst` / `red_ledger_burst`。
5. `SearchAndTopdeck` command 在同一 trace 下早于 `DrawCards` command。

### 4.2 修改旧测试

`redline-progression-card-system.test.ts` 里旧的 `commandOrEventMentions(..., 'reorder') === false` 不能继续代表 sim 真相。建议改为：

- `paper_shatter`：断言产生 `CardTopdecked` 或 `DeckSearchMissed`。
- `lantern_captain`：如果数据未打开，保留“只有 metadata 不触发”；如果数据打开，改成 route topdeck 测试。

`hud-target-selection.test.ts` 继续锁：

- `paper_shatter` / `lantern_captain` 角色标签仍是 `整备/找牌`。
- self draw 预览仍是 `抽N仍-X`，不暗示立即减压。

### 4.3 推荐命令

定向顺序：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test -- src/tests/sim/redline-reorder-topdeck.test.ts
npm run test -- src/tests/sim/redline-progression-card-system.test.ts src/tests/sim/runtime.test.ts src/tests/sim/runtime-audit.test.ts
npm run test -- src/tests/ui/hud-target-selection.test.ts
npm run test -- src/tests/sim/reward-branching.test.ts src/tests/sim/progression-reward-regression.test.ts src/tests/sim/run-layer-boundary.test.ts
```

全量收口：

```bash
cd /Users/roc/Game-001/prototype-web
npm test
npm run build
```

若 `hud.ts` 有可见日志改动，再用当前项目的浏览器 smoke 流程看桌面和移动尺寸，重点检查战斗日志不超框、按钮文案仍短。

## 5. 风险与回滚

| 风险 | 影响 | 控制点 |
| --- | --- | --- |
| 把 reorder 做成手动 UI | 切片膨胀到输入锁、移动端拖拽、临时选择状态 | 本轮只做 `SearchAndTopdeck`，无新 intent |
| 搜索顺序破坏抽牌确定性 | 旧测试对 `drawPile` 顺序的断言失败 | 只移动一张目标牌到 `drawPile[0]`，其余顺序保持 |
| 检索刚打出的自己 | 空牌堆 self draw 重新抽回自己，破坏既有护栏 | `excludeFromSearch` 和 `DrawCards.excludeFromReshuffle` 都保留 `event.cardId` |
| `discardPile` 检索过强 | 变成全牌库 tutor，奖励牌稳定性过高 | 首刀可只给 `paper_shatter` 开 `payoff`；是否给 `lookCount` 由主线程裁决 |
| `CardId[]` 无法区分同名复制 | 多张同名牌时排除会按定义级别排除 | 文档标注这是 CardInstance 之前的限制，不在本切片解决 |
| 旧测试语义陈旧 | 测试仍写“没有 reorder runtime”，但机制已存在 | 同步改 `redline-progression-card-system.test.ts` 的断言标题和内容 |
| HUD 过度承诺 | 玩家以为可以手动重排牌库 | UI 只写“整备/找牌”和“置于牌顶”，不写“手动重排” |
| 覆盖并行改动 | 破坏其它专家已经写入的合同 | 每个文件先读 diff，小 hunk patch，不做格式化全文件 |

回滚点按从小到大执行，禁止用 destructive git 命令：

| 回滚点 | 回滚内容 | 保留内容 |
| --- | --- | --- |
| R1：数据开关 | 删除 `paper_shatter` / `lantern_captain` 的 `preDrawSearch` 字段 | 类型、runtime helper 可暂留，机制不触发 |
| R2：规则插入 | 删除 `redlineRules.ts` 的 `card.self.pre-draw-search` 规则 | 数据字段可保留但无效果 |
| R3：HUD 日志 | 删除 `CardTopdecked` / `DeckSearchMissed` 的 combat log 分支 | sim 机制不受影响 |
| R4：runtime 命令 | 删除 `SearchAndTopdeck` helper 和 `applyCommand` case | 同步删对应测试和类型 union |
| R5：类型合同 | 删除 `SearchPreference`、`CardSearchZone`、`preDrawSearch`、新 Command/Event | 回到纯 metadata reorder |

首选回滚是 R1，因为它最不影响并行代码：删掉数据字段后，新增 engine 能力处于休眠状态，旧 draw 行为恢复。

## 6. 最小验收标准

- `paper_shatter` 可在打出后、抽牌前把 payoff 顶置，并被同次 `DrawCards` 抽进手牌。
- 找不到目标时有 `DeckSearchMissed`，仍正常抽牌。
- 刚打出的 self draw/reorder 牌不会被同次抽回。
- `DrawCards` 倍率仍由 `effectMultiplier` 决定。
- `AddCardToDeck.unshift()` 的奖励下一手可见语义不变。
- `maxEnergy`、临时授权、run/meta 边界不变。
- HUD 仍不承诺手动重排。
- 定向测试、全量测试、build 通过后再交给主线程决定是否进入浏览器验收。

STATUS: DONE
