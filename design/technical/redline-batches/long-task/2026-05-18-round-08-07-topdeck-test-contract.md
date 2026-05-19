# 2026-05-18 Round 08-07：paper_shatter drawPile-only topdeck Vitest 合同

角色：第 8 轮专家 07，Runtime Test Contract Engineer  
工作目录：`/Users/roc/Game-001`  
边界：只新增本文档；不改源码、不提交 git、不回滚他人改动。  

## 0. 裁决

第 8 轮 P0 只锁 `paper_shatter` 的 drawPile-only payoff 置顶，不扩展 `lantern_captain`，不搜索 `discardPile`，不做手动 reorder UI。

核心合同：

```text
CardPlayed(paper_shatter)
-> CardTopdecked / TopdeckMissed
-> DrawCards
-> HandDealt
```

`paper_shatter` 打出后，在本次 `DrawCards` 前，从 `world.player.drawPile` 当前顺序里找到第一张 3 MP 全场 payoff，移动到 `drawPile[0]`。随后仍由现有 `DrawCards` 把它抽进手牌。找不到候选时必须 miss，但原本抽牌照常执行。

首选事件名可以是 `CardTopdecked` / `TopdeckMissed`；若实现最终采用 `DrawPilePrepared` / `DrawPilePrepareMissed`，测试名和断言语义保持一致即可。本文以下使用 `CardTopdecked` / `TopdeckMissed` 作为合同名。

## 1. 候选规则

### 1.1 source

只触发：

- `cardId === 'paper_shatter'`
- `targets === 'self'`
- `drawCards > 0`
- `utilities` 包含 `draw` 和 `reorder`

明确不触发：

- `lantern_captain`
- `pulse_draw`
- `blood_tithe`
- `wild_mana_stitch`
- 任意攻击牌或 payoff 牌

### 1.2 zone

只搜索：

- `world.player.drawPile`

禁止搜索：

- `discardPile`
- `deck`
- `hand`
- `reward.choices`
- `reward.candidateCardPool`

### 1.3 payoff predicate

首版测试只要求命中这些稳定条件之一：

- `cards[cardId].cardType === 'payoff'`
- 或 `cards[cardId].rewardBranches?.includes('payoff')`
- 或 `cards[cardId].cost === 3 && cards[cardId].targets === 'all-enemies' && cards[cardId].comboNode === 'burst'`

`severance_burst` 与 `red_ledger_burst` 都应被视为合法 payoff。`clearance_order` 是 2 MP route segment，不是 payoff。

### 1.4 排除规则

`sourceCardId` 必须排除。即使某次 setup 把 `paper_shatter` 放进 `drawPile` 或抽牌重洗来源，它也不能被本次 topdeck 选为目标。

由于当前系统没有 `CardInstanceId`，测试只断言 card id 层面的行为：`CardTopdecked.targetCardId !== 'paper_shatter'`，并且本次 `HandDealt.cardIds` 不包含 `paper_shatter`。

## 2. 建议新增测试文件

新增文件：

```text
prototype-web/src/tests/sim/paper-shatter-topdeck-contract.test.ts
```

建议 helper：

```ts
function prepareHand(world: WorldState, hand: CardId[]): void
function playCard(world: WorldState, cardId: CardId, traceId: string): void
function eventIndex(world: WorldState, traceId: string, type: GameEvent['type']): number
function commandIndex(world: WorldState, traceId: string, type: Command['type']): number
```

如果实现暂时不新增 `SearchAndTopdeck` command，只新增事件，测试可以只查 `CardTopdecked` / `TopdeckMissed` 与 `DrawCards` 的顺序。若新增 command，则必须补查 `SearchAndTopdeck` 早于 `DrawCards`。

旧测试 `redline-progression-card-system.test.ts` 里 `keeps %s as self draw support without asserting reorder runtime` 当前要求 command/event 不出现 `reorder`，实现 P0 后会与新合同冲突。建议改为只覆盖 `lantern_captain`，或把 `paper_shatter` 从 `it.each` 中移出。

## 3. 必须测试

### 3.1 命中：drawPile 非顶部 payoff 被置顶并抽入手

测试名：

```ts
it('topdecks the first drawPile payoff before paper_shatter draws')
```

Given：

```ts
world.player.hand = ['paper_shatter'];
world.player.drawPile = ['spark_tap', 'severance_burst', 'wild_gap_key'];
world.player.discardPile = [];
world.player.energy = 3;
```

When：

```ts
playCard(world, 'paper_shatter', 'paper-topdeck-hit');
```

断言：

- `CardPlayed` 存在，`cardId === 'paper_shatter'`。
- `CardTopdecked` 存在，字段至少匹配：

```ts
expect(topdeck).toMatchObject({
  type: 'CardTopdecked',
  traceId: 'paper-topdeck-hit',
  sourceCardId: 'paper_shatter',
  targetCardId: 'severance_burst',
  fromZone: 'drawPile',
  fromIndex: 1,
  toIndex: 0,
  preference: 'payoff'
});
```

- `CardTopdecked` 的事件顺序早于同 trace 的 `HandDealt`。
- 如果有 `SearchAndTopdeck` command，则它早于同 trace 的 `DrawCards` command。
- `DrawCards` command 仍存在，`count === (cards.paper_shatter.drawCards ?? 0) * CardPlayed.effectMultiplier`。
- `HandDealt.cardIds[0] === 'severance_burst'`。
- `world.player.hand` 包含 `severance_burst`，不包含 `paper_shatter`。
- `world.player.drawPile` 不包含 `severance_burst`。
- 非目标牌相对顺序不被打乱：剩余 draw pile 中 `spark_tap` 仍早于 `wild_gap_key`。

### 3.2 命中：第一张合法 payoff 优先，不按强度重排

测试名：

```ts
it('uses drawPile order instead of scoring payoff candidates')
```

Given：

```ts
world.player.hand = ['paper_shatter'];
world.player.drawPile = ['red_ledger_burst', 'spark_tap', 'severance_burst'];
world.player.discardPile = [];
world.player.energy = 3;
```

断言：

- `CardTopdecked.targetCardId === 'red_ledger_burst'`。
- `CardTopdecked.fromIndex === 0`。
- `HandDealt.cardIds[0] === 'red_ledger_burst'`。
- `severance_burst` 仍在 `world.player.drawPile` 中。
- 不出现第二个 `CardTopdecked`。

这个测试防止实现者做“最高伤害 payoff”或“固定 severance_burst”硬编码。

### 3.3 未命中：没有 payoff 时 miss，原本 DrawCards 照常

测试名：

```ts
it('misses cleanly when drawPile has no payoff and still draws normally')
```

Given：

```ts
world.player.hand = ['paper_shatter'];
world.player.drawPile = ['spark_tap', 'wild_gap_key', 'heartbeat_spark'];
world.player.discardPile = [];
world.player.energy = 3;
```

断言：

- 没有 `CardTopdecked`。
- 有 `TopdeckMissed`，字段至少匹配：

```ts
expect(miss).toMatchObject({
  type: 'TopdeckMissed',
  traceId: 'paper-topdeck-miss',
  sourceCardId: 'paper_shatter',
  preference: 'payoff',
  searchedZone: 'drawPile',
  searchedCount: 3,
  reason: 'no-candidate'
});
```

- `DrawCards` command 仍存在。
- `HandDealt.cardIds[0] === 'spark_tap'`，证明 miss 后按原 drawPile 顶部抽牌。
- `world.player.drawPile` 剩余顺序仍是 `['wild_gap_key', 'heartbeat_spark']`，没有因为 miss 改牌堆。
- `world.debug.failedConditions` 不包含本 trace 的失败条件。

### 3.4 drawPile-only：discardPile 有 payoff 也不能被搜

测试名：

```ts
it('does not search discardPile even when discard has a payoff')
```

Given：

```ts
world.player.hand = ['paper_shatter'];
world.player.drawPile = ['spark_tap', 'wild_gap_key'];
world.player.discardPile = ['severance_burst', 'red_ledger_burst'];
world.player.energy = 3;
```

断言：

- 没有 `CardTopdecked`。
- 有 `TopdeckMissed`。
- `TopdeckMissed.searchedZone === 'drawPile'`，或 `TopdeckMissed.searchedZones === ['drawPile']`。
- 若事件提供 `searchedDiscardCount`，必须是 `0`。
- `HandDealt.cardIds[0] === 'spark_tap'`。
- `world.player.discardPile` 仍包含 `severance_burst` 和 `red_ledger_burst`，且顺序不变。
- `world.player.hand` 不包含 `severance_burst` / `red_ledger_burst`。

这是第 8 轮最重要的强度护栏：P0 是 drawPile-only topdeck，不是 discard tutor。

### 3.5 sourceCardId 排除：不能顶置或抽回刚打出的 paper_shatter

测试名：

```ts
it('excludes sourceCardId from topdeck search and same-trace draw')
```

Given：

```ts
world.player.hand = ['paper_shatter'];
world.player.drawPile = ['paper_shatter', 'severance_burst'];
world.player.discardPile = [];
world.player.energy = 3;
```

断言：

- 若有 `SearchAndTopdeck` command，必须匹配：

```ts
expect(search).toMatchObject({
  sourceCardId: 'paper_shatter',
  preference: 'payoff'
});
expect(search.excludeCardIds ?? search.excludeFromSearch).toContain('paper_shatter');
```

- `CardTopdecked.targetCardId === 'severance_burst'`。
- `CardTopdecked.targetCardId !== 'paper_shatter'`。
- `HandDealt.cardIds` 不包含 `paper_shatter`。
- `world.player.discardPile` 包含打出的 `paper_shatter`。

如果实现选择对所有同名 `sourceCardId` 直接跳过，`fromIndex` 应为 `1`；如果实现先过滤候选再记录原始索引，`fromIndex` 仍应表达原 drawPile 索引，不能写成过滤后索引 `0`。

### 3.6 DrawCards 前置：topdeck 必须先于抽牌命令生效

测试名：

```ts
it('orders topdeck before DrawCards for the same trace')
```

Given 同 3.1。

断言：

- `eventIndex('CardPlayed') < eventIndex('CardTopdecked') < eventIndex('HandDealt')`。
- 若 command trace 可见：`commandIndex('SearchAndTopdeck') < commandIndex('DrawCards')`。
- `HandDealt.cardIds[0] === CardTopdecked.targetCardId`。
- `CardTopdecked.topCardAfter === CardTopdecked.targetCardId`，若事件提供该字段。
- 不允许出现 “DrawCards 先抽到原顶牌，再 retroactively 改 HandDealt” 的假实现；具体表现为 `HandDealt.cardIds[0]` 不能是 Given 中的原 `drawPile[0]`，除非原顶牌本身就是合法 payoff。

### 3.7 Wild 不回归：wild_mana_stitch 不触发 payoff topdeck

测试名：

```ts
it('does not give Wild Mana Stitch paper_shatter topdeck behavior')
```

Given：

```ts
world.player.hand = ['debt_hook', 'wild_mana_stitch'];
world.player.drawPile = ['spark_tap', 'severance_burst'];
world.player.discardPile = [];
world.player.energy = 3;
```

When：

```ts
playCard(world, 'debt_hook', 'wild-setup-0');
playCard(world, 'wild_mana_stitch', 'wild-no-topdeck');
```

断言：

- `wild_mana_stitch` 仍按 Wild 合同结算：`CardPlayed.chainRepaired === true`，`effectiveCost === 1`，`repairedCost === 1`。
- 同 trace 没有 `CardTopdecked`，也没有 `TopdeckMissed`，除非事件名明确绑定 `paper_shatter` 且 `sourceCardId !== 'wild_mana_stitch'`。
- `GainEnergy` command 仍存在，`reason === 'chain-repaired'` 或等价修补原因。
- `HandDealt.cardIds[0] === 'spark_tap'`，不能跳过 `spark_tap` 去抽 `severance_burst`。
- `world.player.maxEnergy === 3`，避免把 Wild 修补回归成永久 MP 成长。

### 3.8 authorization 不回归：置顶 payoff 后仍必须走授权支付合同

测试名：

```ts
it('keeps payoff authorization semantics after paper_shatter topdecks a finisher')
```

Given：

```ts
world.player.hand = ['debt_hook', 'redline_cut', 'paper_shatter'];
world.player.drawPile = ['spark_tap', 'severance_burst'];
world.player.discardPile = [];
world.player.energy = 3;
```

When：

```ts
playCard(world, 'debt_hook', 'auth-0');
playCard(world, 'redline_cut', 'auth-1');
playCard(world, 'paper_shatter', 'auth-paper-topdeck');
playCard(world, 'severance_burst', 'auth-payoff');
```

断言：

- `auth-paper-topdeck` 的 `CardTopdecked.targetCardId === 'severance_burst'`。
- `auth-paper-topdeck` 的 `HandDealt.cardIds` 包含 `severance_burst`。
- `auth-paper-topdeck` 的 `CardPlayed.effectMultiplier === 3`，证明 0 -> 1 -> 2 链正常推进。
- `AuthorizationGranted` 存在，`authorizationRestriction === 'payoff-only'`，`payoffArmed === true`。
- `auth-payoff` 的 `CardPaymentRecorded.authorizationPaid > 0`，`source === 'authorization'` 或 `mixed`。
- `auth-payoff` 的 `CardPlayed.payoffArmed === true`。
- `world.player.maxEnergy === 3`。
- `authorizationRestriction` 在 payoff 支付后按现有合同清理或归零，不因 topdeck 残留到下一回合。

这个测试不是为了重新证明授权全链路，而是防止 topdeck 实现把 payoff 直接塞进手牌时绕过现有 `DrawCards -> play-card -> SpendEnergy` 结算路径。

## 4. 推荐最小断言工具

事件顺序不要只靠最终手牌。建议在测试文件里放两个小工具：

```ts
function findEvent<T extends GameEvent['type']>(
  world: WorldState,
  traceId: string,
  type: T
): Extract<GameEvent, { type: T }> {
  const event = world.debug.events.find((candidate) => candidate.traceId === traceId && candidate.type === type);
  expect(event).toBeDefined();
  return event as Extract<GameEvent, { type: T }>;
}

function expectEventBefore(world: WorldState, traceId: string, left: GameEvent['type'], right: GameEvent['type']): void {
  const leftIndex = world.debug.events.findIndex((event) => event.traceId === traceId && event.type === left);
  const rightIndex = world.debug.events.findIndex((event) => event.traceId === traceId && event.type === right);
  expect(leftIndex).toBeGreaterThanOrEqual(0);
  expect(rightIndex).toBeGreaterThanOrEqual(0);
  expect(leftIndex).toBeLessThan(rightIndex);
}
```

如果 `CardTopdecked` / `TopdeckMissed` 还没有加入 `GameEvent` union，测试应先以类型驱动迫使实现补齐事件，而不是用 `as any` 绕开合同。

## 5. 非目标

这些不属于第 8 轮 P0：

- `lantern_captain` route topdeck。
- discardPile fallback。
- top-N 预视或手动排序。
- 从 `deck` 拿牌。
- 生成临时 payoff。
- CardInstanceId 生命周期。
- UI 选择目标牌。
- 重写 reward pool。

## 6. 验收清单

- 新增 `paper_shatter` 命中测试。
- 新增 `paper_shatter` 未命中测试。
- 新增 drawPile-only / 不搜 discard 测试。
- 新增 sourceCardId 排除测试。
- 新增 DrawCards 前置顺序测试。
- 新增 Wild 不回归测试。
- 新增 authorization 不回归测试。
- 旧的 `paper_shatter` self-draw “不出现 reorder”断言被替换或移除。
- 全量 `npm test` 或 `npm run test` 在 `prototype-web` 下通过。

STATUS: DONE
