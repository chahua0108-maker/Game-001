# Game-001 第 2 轮专家 02：CardInstanceId 与升级迁移架构

日期：2026-05-18  
工作目录：`/Users/roc/Game-001`  
角色：卡牌实例与升级架构师  
范围：只读当前代码、第 1 轮长任务文档与当前 redline-batches 机制文档。本文只做架构设计，不要求改源码。

## 一句话结论

Redline 需要 `CardInstanceId`，但不应该把它做成一次性大重构。当前 `CardId[]` 已经能支撑 P0 Hyper-Turn 的发牌、出牌、奖励和测试；下一步应先在内部加一层“实例 store + 兼容 adapter”，让旧 UI、旧测试和旧 `play-card(cardId)` 继续工作，然后只在升级、临时牌、复制牌、消耗/保留等确实需要单张状态的地方逐步切换到实例。

核心迁移原则：

```text
CardDefinition 仍是静态 catalog
CardInstance 才表示这一次 run / battle 里的那一张物理牌
所有 pile 最终只存 CardInstanceId
所有事件迁移期同时带 instanceId 和 cardId
旧 CardId intent 先兼容为“手牌中最左侧匹配实例”
```

## 当前事实基线

当前代码里的关键事实：

- `CardDefinition.id` 是 `CardId`，同时被用作 catalog key、手牌元素、牌库元素、奖励元素。
- `PlayerState.deck/hand/drawPile/discardPile` 仍是 `CardId[]`。
- `Intent(play-card)` 只带 `cardId/targetId/traceId`。
- `validatePlayCard` 通过 `world.player.hand.includes(card.id)` 判断卡在手里。
- `DiscardPlayedCard` 用 `hand.indexOf(command.cardId)` 移除第一张同名牌并放入 `discardPile`。
- `AddCardToDeck` 直接把奖励 `cardId` push 到 `deck` 和 `drawPile`。
- `drawCardsFromDeck`、`DiscardHand`、`DrawCards` 都在 `CardId[]` 层移动。
- 第 1 轮专家 02 已明确指出：升级、临时费用、复制、诅咒、消耗、保留都依赖“单张卡实例”。
- 第 1 轮专家 04 也提醒：不要马上推翻 `Intent -> Event -> Rule -> Command -> Event`，应优先保留现有 event/command 骨架。

因此，本轮判断不是“要不要实例化”，而是“怎样实例化而不毁掉当前可验收样片”。

## 需要实例化解决的问题

| 问题 | 继续用 `CardId[]` 的坏结果 | 实例化后的表达 |
| --- | --- | --- |
| 同名不同升级 | 升级 `heartbeat_spark` 会污染所有同名牌，或只能新建全局升级 id。 | 两张牌共享 `definitionId = heartbeat_spark`，只有一个实例带 `upgrade.level = 1`。 |
| 临时牌 | 无法知道这张牌战斗结束是否要 purge，是否能进入 run deck。 | 实例带 `temporary = true` 和 `purgePolicy`。 |
| 复制牌 | 无法区分复制出来的是新物理牌还是同一张牌引用。 | `CopyCard` 创建新 `instanceId`，记录 `createdBy/sourceInstanceId`。 |
| 临时费用/本回合 modifier | 改全局 `CardDefinition.cost` 会影响所有同名牌。 | modifier 挂在实例上，生命周期为 turn/combat/run。 |
| 消耗/保留 | 同名牌在 hand/discard/exhaust 中无法可靠追踪。 | pile 存实例 id，移动一张就是移动一个 id。 |
| 回放/调试 | `CardPlayed(cardId)` 无法证明是哪张同名牌被打出。 | 事件同时带 `instanceId/cardId`，debug 可追踪生命周期。 |

## 迁移阶段

### Phase 0：冻结当前行为与术语

目标：不改行为，只确定命名与边界。

- `CardId` 保持静态定义 id。
- `CardInstanceId` 表示一张进入 run/battle 的物理卡。
- `definitionId` 指向原始 `CardDefinition`。
- `effectiveCard` 是定义 + 实例 modifiers 的运行时读模型，不写回 `cards.ts`。
- `deck/hand/drawPile/discardPile` 当前代码可暂时保持 `CardId[]`，但新设计文档和测试名称应避免把 `CardId` 叫作“实例”。

本阶段不做升级、不做临时牌、不做复制牌，只补合同。

### Phase 1：增加只读 adapter，不改 pile 类型

目标：把卡牌读取从“到处直接查 `cards[cardId]`”收口到 helper。

建议新增的概念：

- `getCardDefinition(cardId)`：读取静态卡。
- `getEffectiveCard(ref)`：迁移期可以接收 `CardId | CardInstanceId`。
- `cardIdOf(ref)`：迁移期把实例或旧 id 映射为 `CardId`。
- `findPlayableCardRef(world, intent)`：旧 `cardId` intent 先解析为手牌中最左侧匹配项。

这样下一阶段把内部从 `CardId[]` 换成 `CardInstanceId[]` 时，`validatePlayCard`、HUD、ECA 规则不需要同时大改。

### Phase 2：加入实例 store，但 snapshot 继续兼容旧 UI

目标：在 `WorldState` 中引入实例容器，但对外仍能导出旧 `cardIds`。

最小状态形状：

```ts
type CardInstanceId = string & { readonly __brand: 'CardInstanceId' };

interface CardInstanceStore {
  byId: Record<CardInstanceId, CardInstance>;
  nextSerial: number;
}

interface CardInstance {
  id: CardInstanceId;
  definitionId: CardId;
  owner: 'player';
  createdAtRun: number;
  createdAtTick: number;
  createdBy: CardInstanceSource;
  upgrade?: CardUpgradeState;
  modifiers: CardInstanceModifier[];
  flags: CardInstanceFlags;
  lifecycle: CardLifecycleState;
}

type CardInstanceSource =
  | { type: 'starting-deck' }
  | { type: 'reward'; rewardTraceId: TraceId }
  | { type: 'card-effect'; sourceInstanceId: CardInstanceId; sourceCardId: CardId }
  | { type: 'enemy-effect'; enemyId: EntityId }
  | { type: 'event'; eventId: string };
```

实例 id 生成建议：

```text
ci:<runNumber>:<serial>
```

例如 `ci:1:0007`。不要把 `CardId` 拼进 id 作为唯一性来源；同名卡越多，越需要 id 与定义解耦。

兼容要求：

- `buildSnapshot` 迁移期保留 `player.hand: CardId[]`，同时可新增 `player.handInstances`。
- 事件迁移期同时带 `instanceId` 和 `cardId`。
- 旧测试仍可断言 `hand` 里有哪些 `CardId`。
- 新测试开始断言实例唯一性和单实例状态。

### Phase 3：内部 pile 改为 `CardInstanceId[]`

目标：只改 simulation 内部真实牌区，UI 和老测试通过 snapshot adapter 继续读 `CardId[]`。

建议最终牌区：

```ts
type CardZone =
  | 'run-deck'
  | 'draw-pile'
  | 'hand'
  | 'discard-pile'
  | 'exhaust-pile'
  | 'retained'
  | 'limbo'
  | 'destroyed';

interface CardZones {
  runDeck: CardInstanceId[];
  drawPile: CardInstanceId[];
  hand: CardInstanceId[];
  discardPile: CardInstanceId[];
  exhaustPile: CardInstanceId[];
  retained: CardInstanceId[];
  limbo: CardInstanceId[];
  destroyed: CardInstanceId[];
}
```

迁移细节：

- `createInitialWorld` 不再把 `startingHand` 直接复制到 pile，而是为每个 `CardId` 创建实例。
- `AddCardToDeck(cardId)` 兼容包装为 `CreateCard(definitionId: cardId, destination: runDeck/drawPile)`。
- `DiscardPlayedCard(cardId)` 兼容包装为 `MoveCard(instanceId, hand -> discardPile)`。
- `drawCardsFromDeck` 返回 `CardInstanceId[]`，`HandDealt` 事件新增 `cards: Array<{ instanceId; cardId }>`，旧 `cardIds` 保留一段时间。
- `excludeFromReshuffle` 从 `CardId[]` 改为 `CardInstanceId[]`。这很关键，否则同名牌会被错误排除。

### Phase 4：统一生命周期移动

目标：先把“移动一张牌”变成唯一入口，再做消耗、保留、临时 purge。

推荐命令：

```ts
type CardMoveReason =
  | 'deal'
  | 'play-default'
  | 'turn-end'
  | 'draw-effect'
  | 'reward-selected'
  | 'created'
  | 'copied'
  | 'upgraded'
  | 'exhaust'
  | 'temporary-purge'
  | 'combat-end-cleanup';

interface MoveCardCommand {
  type: 'MoveCard';
  traceId: TraceId;
  instanceId: CardInstanceId;
  from: CardZone;
  to: CardZone;
  reason: CardMoveReason;
}
```

推荐事件：

```ts
interface CardMovedEvent {
  type: 'CardMoved';
  traceId: TraceId;
  tick: number;
  instanceId: CardInstanceId;
  cardId: CardId;
  from: CardZone;
  to: CardZone;
  reason: CardMoveReason;
}
```

默认生命周期：

- 未声明 lifecycle 的现有 16 张牌：`onPlay = discard`，`onTurnEnd = discard`。
- 消耗牌：`onPlay = exhaust` 或 `onTurnEnd = exhaust`。
- 保留牌：`onTurnEnd = retain`，下次发牌前或发牌后合并回 hand。
- 临时牌：根据 `purgePolicy` 在打出、弃牌、战斗结束或离开区域时进入 `destroyed`。

### Phase 5：实例升级

目标：升级绑定实例，不改全局定义。

最小类型草案：

```ts
interface CardUpgradeState {
  level: number;
  branchId?: 'stable' | 'ceiling' | string;
  upgradedFromDefinitionId: CardId;
  upgradedAtTick: number;
  source: 'reward' | 'event' | 'card-effect' | 'debug';
}

type CardInstanceModifier =
  | { type: 'cost-delta'; amount: number; duration: 'turn' | 'combat' | 'run' | 'permanent-in-run' }
  | { type: 'damage-delta'; amount: number; duration: 'combat' | 'run' | 'permanent-in-run' }
  | { type: 'tag-add'; tag: string; duration: 'combat' | 'run' | 'permanent-in-run' }
  | { type: 'lifecycle-override'; lifecycle: Partial<CardLifecycleSpec>; duration: 'combat' | 'run' | 'permanent-in-run' };

interface UpgradeCardCommand {
  type: 'UpgradeCard';
  traceId: TraceId;
  instanceId: CardInstanceId;
  branchId?: string;
  source: 'reward' | 'event' | 'card-effect' | 'debug';
}
```

升级策略建议：

- P1 不要急着新增 `redline_cut_plus` 这类全局升级定义。先用实例 overlay 表达 `costDelta/damageDelta/lifecycleDelta`。
- 如果后续内容团队需要完全不同文本和图标，再增加 `currentDefinitionId` 或 `variantDefinitionId`，但仍保留 `baseDefinitionId`。
- 奖励升级必须选择 `instanceId`，不是选择 `cardId`。如果 UI 还没支持，迁移期可在 deck 中选第一张匹配 `cardId`，但事件必须记录实际 `instanceId`。
- 升级不应默认影响临时牌，除非效果明确允许 `allowTemporary: true`。

升级事件：

```ts
interface CardUpgradedEvent {
  type: 'CardUpgraded';
  traceId: TraceId;
  tick: number;
  instanceId: CardInstanceId;
  cardId: CardId;
  levelBefore: number;
  levelAfter: number;
  branchId?: string;
  source: string;
}
```

### Phase 6：临时牌与复制牌

目标：用同一套 `CreateCard/CopyCard/MoveCard` 表达状态牌、风险代价、复制效果。

临时牌：

```ts
interface CardInstanceFlags {
  temporary: boolean;
  copy: boolean;
  status: boolean;
  curse: boolean;
  token: boolean;
}

interface CardLifecycleState {
  currentZone: CardZone;
  purgePolicy?: 'on-play' | 'on-discard' | 'on-zone-exit' | 'combat-end' | 'run-end';
  retainUntilTurn?: number;
}
```

临时牌规则：

- 临时牌默认不进入 `runDeck`，除非命令显式 `destination = run-deck` 且 `temporary = false`。
- 战斗内生成的状态牌通常 `temporary = true`，`purgePolicy = combat-end` 或 `on-play`。
- 风险牌生成的负面牌如果要跨战斗保留，应 `temporary = false`，但 `source.type` 必须记录来源。
- `restart-run` 应直接丢弃整个实例 store，重新从基础 deck 创建实例。

复制牌：

```ts
type CopyMode =
  | 'definition-only'
  | 'effective-state'
  | 'full-instance-debug';

interface CopyCardCommand {
  type: 'CopyCard';
  traceId: TraceId;
  sourceInstanceId: CardInstanceId;
  destination: CardZone;
  mode: CopyMode;
  temporary: boolean;
}
```

复制规则建议：

- 默认 `definition-only`：只复制基础定义，不复制本回合费用变化和临时 modifier。
- 对玩家直觉更强的复制效果可用 `effective-state`：复制升级分支和永久 run modifier，但不复制 `currentZone`、已打出状态、一次性触发状态。
- `full-instance-debug` 只给测试/调试，不建议做成正式卡牌效果。
- 任何复制都必须创建新 `instanceId`，不能把同一个 id 放进两个 zone。

## 同名不同状态牌的迁移规则

同名牌迁移的核心是“不破坏旧操作，同时给新系统明确选择权”。

### 旧 intent 兼容

迁移期 `play-card` 仍允许：

```ts
{ type: 'play-card', cardId: 'heartbeat_spark', targetId, traceId }
```

解析规则：

1. 如果 intent 带 `instanceId`，优先使用该实例。
2. 如果只带 `cardId`，在 `hand` 中从左到右找第一张 `definitionId === cardId` 的实例。
3. 如果同名多张但状态不同，旧 intent 仍然可工作，但 debug trace 记录 `legacy-cardId-resolved-to-instance`。
4. UI 完成迁移后，玩家点击卡牌必须发送 `instanceId`，`cardId` 只作为展示和兼容字段。

### Snapshot 兼容

迁移期 snapshot 建议同时输出：

```ts
interface CardSnapshot {
  instanceId: CardInstanceId;
  cardId: CardId;
  name: string;
  cost: number;
  upgraded: boolean;
  temporary: boolean;
  copy: boolean;
  zone: CardZone;
}

interface PlayerSnapshot {
  hand: CardId[]; // legacy
  handCards: CardSnapshot[];
}
```

旧 HUD 可继续读 `hand`；新 HUD 读 `handCards`，显示升级、临时、复制、费用变化等 badge。

### 事件兼容

所有新事件都同时带：

- `instanceId`：生命周期追踪主键。
- `cardId`：卡牌定义和旧 UI/测试兼容。
- `sourceInstanceId`：复制、生成、升级来源可选字段。

旧事件如 `CardPlayed(cardId)` 不应立刻删除，应先加字段：

```ts
{
  type: 'CardPlayed',
  instanceId,
  cardId,
  printedCost,
  effectiveCost,
  ...
}
```

## 何时不该实例化

不要为了“架构完整”把所有概念都实例化。以下对象继续用 `CardId` 或静态数据更好：

- `cards` 静态 catalog。
- `rewardCardPool` 候选池。奖励还没被选中前只是定义候选，不是物理牌。
- `startingHand` / 初始牌表配置。开始 run 时才展开为实例。
- 卡牌 taxonomy、`cardType/chainRole/cycleRole/buildRole`、reward branch 分类。
- 图鉴、tooltip、卡牌详情页、构筑预览里的静态卡面。
- 奖励三选一 UI 中的未选择卡，除非该奖励卡本身会被临时修改、锁定、腐化或价格变化。
- 测试里的“当前 catalog 是否包含某些类型”断言。
- 账号永久解锁列表。账号拥有的是可用定义，不是 run 中的物理实例。

简单判断：

```text
如果这个对象还没有进入本次 run / battle 的某个牌区，不要实例化。
如果它不会被单独升级、移动、复制、删除、临时改费或追踪来源，不要实例化。
```

## 风险与缓解

| 风险 | 表现 | 缓解 |
| --- | --- | --- |
| 大面积测试 churn | 旧测试全都按 `CardId[]` 断言，直接改 pile 会炸。 | Phase 2/3 通过 snapshot adapter 保留 `hand: CardId[]`，新增实例测试逐步覆盖。 |
| UI 点击歧义 | 同名一张升级一张未升级，旧 UI 只传 `cardId`。 | 迁移期左到右解析；新 HUD 改传 `instanceId` 并显示 badge。 |
| 全局定义被污染 | 升级时顺手改 `cards[cardId].damage`。 | `CardDefinition` 视为 immutable；升级只写 `CardInstance.modifiers`。 |
| 临时牌泄漏到 run deck | 战斗结束后临时状态牌还在抽牌堆或 deck。 | `purgePolicy` + `combat-end-cleanup` 事件；测试断言无 temporary orphan。 |
| 同名排除错误 | `excludeFromReshuffle` 排除 `cardId` 会把同名另一张也排除。 | 切到 `CardInstanceId[]` 后所有移动/排除按实例 id。 |
| replay 不稳定 | id 用随机 uuid，测试和回放难复现。 | 使用 `runNumber + nextSerial` 生成确定性 id。 |
| 事件 payload 过渡期冗余 | 同时带 `cardIds` 和 `cards`，类型变厚。 | 标注 legacy 字段；等 HUD/测试迁移完成再删。 |
| 复制语义混乱 | 玩家不知道复制升级状态还是基础状态。 | `CopyMode` 显式化；卡牌文本只暴露一种模式。 |
| 架构过度 | 还没做升级/临时牌就把全部系统拆成多层。 | 只先加 store/adapter/MoveCard，不急着拆完整 RunState/BattleState/TurnState 文件。 |

## 测试建议

### 单元测试

- `createInitialWorld` 为起始牌创建唯一 `CardInstanceId`，每个实例 `definitionId` 对应原 `startingHand`。
- 两张同名牌在手牌中时，旧 `play-card(cardId)` 只移动最左侧匹配实例。
- `play-card(instanceId)` 只移动指定实例，同名另一张仍留在手牌。
- 打出默认生命周期牌后，实例从 `hand` 到 `discardPile`，事件包含 `CardMoved` 和 `CardPlayed(instanceId/cardId)`。
- `DrawCards` 从 `drawPile` 抽实例，discard reshuffle 时不复制、不丢失 id。
- `excludeFromReshuffle` 按实例 id 工作，同名未打出的牌仍可被洗回。

### 升级测试

- deck 中两张 `heartbeat_spark`，升级其中一个实例后，只有该实例的 effective cost/damage/text badge 改变。
- `CardUpgraded` 事件带 `instanceId/cardId/levelBefore/levelAfter/source`。
- 升级不修改 `cards.heartbeat_spark` 的静态 definition。
- `restart-run` 后升级实例消失，基础 deck 恢复。
- 如果奖励 UI 迁移期只传 `cardId`，升级命令必须记录实际选择的 instance id。

### 临时牌测试

- `CreateCard(temporary: true, destination: hand)` 创建新实例，`runDeck` 不增加。
- 临时牌打出后按 `purgePolicy` 进入 `destroyed` 或 `exhaustPile`，不会进入长期 deck。
- 战斗结束 cleanup 后，所有 `temporary && purgePolicy = combat-end` 的实例不在 active zones。
- 状态牌占手牌格，回合末按 lifecycle 移动，事件可追踪。

### 复制牌测试

- `CopyCard(definition-only)` 创建新 id，复制基础 `definitionId`，不复制本回合临时降费。
- `CopyCard(effective-state)` 创建新 id，复制升级状态，但不复制 `currentZone` 和一次性触发标记。
- 复制出的临时牌在 cleanup 后消失；非临时复制明确进入 run deck 时才跨战斗保留。

### 不变量测试

每个 tick 后都可以跑一个低成本 invariant：

```text
每个 active instanceId 最多出现在一个 zone
每个 zone 中的 instanceId 必须存在于 store.byId
store.byId[instanceId].lifecycle.currentZone 与实际 zone 一致
destroyed 中的实例不能在 hand/draw/discard/exhaust/runDeck
临时牌不能出现在 runDeck，除非 explicit promote
事件中 instanceId 对应的 definitionId 必须等于 event.cardId
```

## 推荐的第一刀

下一轮如果要开始实现，第一刀不要做升级 UI，也不要直接把所有 pile 类型改掉。建议只做：

1. 增加 `CardInstanceId/CardInstance/CardInstanceStore` 类型。
2. `createInitialWorld` 内部创建 starting instances，但通过 adapter 继续输出旧 `CardId[]`。
3. 增加 `MoveCard` 命令和 `CardMoved` 事件。
4. `DiscardPlayedCard` 内部改为兼容包装，先按旧 `cardId` 找到左侧实例。
5. 给 `CardPlayed` 事件加可选 `instanceId`。
6. 补“不变量测试”和“两张同名牌只移动一张”的测试。

这能先证明实例化的价值，又不会迫使 HUD、奖励、ECA、所有测试在同一批里同时迁移。

## 本轮结论

CardInstanceId 是 Redline 从“有卡面的费用链 demo”走向“真正卡牌 roguelike 底座”的必要条件，但它应该作为兼容层进入，而不是作为大重构进入。

最稳路线是：

```text
CardId[] helper 收口
-> instance store 旁路上线
-> snapshot 双轨输出
-> pile 内部切 CardInstanceId[]
-> MoveCard 统一生命周期
-> 升级 / 临时牌 / 复制牌逐个接入
```

这条路线能同时满足第 1 轮的机制合同和制作人约束：支持升级、临时牌、复制牌、同名不同状态牌，但不打断当前 P0 Hyper-Turn 样片。
