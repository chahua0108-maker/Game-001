# 2026-05-18 Round 02 Expert 01：卡牌生命周期设计师

## 0. 审查边界

- 工作目录：`/Users/roc/Game-001`
- 本轮角色：卡牌生命周期设计师
- 任务边界：只读当前代码与 `design/technical/redline-batches/long-task/` 第 1 轮文档；不改源码、不提交 git。
- 输出文件：`design/technical/redline-batches/long-task/2026-05-18-round-02-01-card-lifecycle-designer.md`

一句话结论：本轮不要直接上完整 `CardInstance` 大迁移。先在现有 `CardId[]` 上补一层统一牌区生命周期：`drawPile / hand / discardPile / exhaustPile / retainedCards`，并把 `DiscardPlayedCard`、`DiscardHand` 收敛到同一个 `MoveCard / ResolveLifecycle` 概念。这样能最小支持 draw、hand、discard、exhaust、retain 和定义级 status；但 upgraded 单卡、临时复制、同名牌不同来源、curse 来源追踪必须等 `CardInstance`。

## 1. 当前代码事实

### 1.1 现有牌区

当前 `PlayerState` 只有：

```ts
deck: CardId[];
hand: CardId[];
drawPile: CardId[];
discardPile: CardId[];
```

其中：

- `deck` 是当前 run 的拥有牌列表，不是真正发牌队列。
- `drawPile` 是抽牌来源。
- `hand` 是当前可出牌区域。
- `discardPile` 是打出牌和回合末手牌的统一去处。
- 没有 `exhaustPile`、`retainedCards`、`temporaryCards`、`status/curse` 运行时容器。

### 1.2 现有生命周期流

当前发牌、出牌、弃牌逻辑的关键顺序是：

1. `DealHand`：从 `drawPile` 抽固定 `HAND_SIZE = 4`，必要时把 `discardPile` 回填进 `drawPile`。
2. `play-card` 校验通过后，先 `SpendEnergy`，再 `DiscardPlayedCard`。
3. `DiscardPlayedCard` 会把手牌中的一个 `cardId` 移到 `discardPile`。
4. 随后才推入 `CardPlayed` 事件，ECA 再根据 `CardPlayed` 结算伤害、抽牌、返费。
5. `DrawCards` 在处理 `CardPlayed` 时会 `excludeFromReshuffle: [event.cardId]`，避免刚打出的牌被同次抽牌洗回。
6. `end-turn` 会 `DiscardHand`，把剩余 `hand` 全部推入 `discardPile`。

这个顺序已经能跑通当前 16 张卡，但未来有两个问题：

- 打出后的去向现在被硬编码为 discard，无法表达 exhaust / destroy / stay / retain。
- 回合末手牌全部丢弃，无法表达 retain / ethereal / temporary purge。

## 2. 设计原则

1. `CardId[]` 不是错误，当前阶段应继续利用它完成最小生命周期扩展。
2. 牌区移动必须集中到 helper / command，不再分散 `push/splice`。
3. 所有默认行为必须保持现有 16 张卡不变：打出进弃牌，回合末未打出进弃牌。
4. status 与 curse 先当“物理卡牌”处理，和实体 buff/debuff 的 `statuses` 容器分开。
5. temporary 先只支持“定义级临时卡 / 状态牌”，不要假装能追踪同名普通卡的临时复制。
6. 进入升级、复制、变形、单张降费、同名牌不同来源之前，必须迁移到 `CardInstance`。

## 3. 牌区生命周期定义

| 牌区 / 生命周期 | CardId[] 可否先做 | 推荐优先级 | 设计定义 | 必须等 CardInstance 的部分 |
| --- | --- | --- | --- | --- |
| `drawPile` | 可以 | P0 | 抽牌来源；空时从 `discardPile` 回填。 | seeded shuffle、牌库顶多张预视、同名牌不同 modifier。 |
| `hand` | 可以 | P0 | 当前可出牌区；`play-card` 仍用 `cardId` 输入。 | 同名牌中选择某一张 upgraded / temporary / cost modified 实例。 |
| `discardPile` | 可以 | P0 | 默认打出与回合末去处；可被回填进 draw。 | 指定弃掉某一张同名实例、弃牌来源追踪。 |
| `exhaustPile` | 可以 | P0 | 本场/本段循环内移出抽弃循环；不参与 reshuffle。 | 战斗结束自动复原到 deck、某一张同名牌被消耗。 |
| `retainedCards` | 可以 | P0 | 回合末保留的手牌；下回合先放回 hand，再补抽到手牌上限。 | 保留同名牌中的某一张、保留次数、保留后降费。 |
| `temporary` | 部分可以 | P1 | 定义级临时牌：通常来自状态/风险，离开指定区或 combat/run 结束时移除。 | 复制一张普通牌且只有复制体临时、临时费用/来源/createdBy。 |
| `status` card | 可以 | P0 | 战斗内污染牌，占抽牌和手牌；可打出消耗或回合末弃牌/惩罚。 | 同名状态牌不同来源/不同惩罚/不同持续时间。 |
| `curse` card | 部分可以 | P1 | run 内长期负面牌，可进入 deck/draw/discard，普通战斗不会自动清除。 | 跨 run 持久诅咒、来源追踪、单张净化、事件代价身份。 |

## 4. 推荐字段

### 4.1 最小字段，仍兼容当前 `CardDefinition`

当前 `CardDefinition` 不应立刻替换，先加可选字段：

```ts
type CardZone = 'drawPile' | 'hand' | 'discardPile' | 'exhaustPile' | 'retainedCards' | 'removed';

type CardLifecycleDestination = 'discard' | 'exhaust' | 'retain' | 'remove' | 'stay';

interface CardLifecycleSpec {
  onPlay?: CardLifecycleDestination;      // 默认 discard
  onTurnEnd?: CardLifecycleDestination;   // 默认 discard
  onDraw?: 'none' | 'trigger';            // 默认 none
  temporary?: boolean;                    // CardId[] 阶段只适合定义级临时牌
  purgeAt?: 'turn-end' | 'combat-end' | 'run-end' | 'zone-exit';
  retain?: boolean;                       // UI/规则提示字段
  ethereal?: boolean;                     // 未打出回合末 exhaust
}

interface CardDefinition {
  lifecycle?: CardLifecycleSpec;
}
```

迁移期默认值：

```ts
const defaultLifecycle: Required<Pick<CardLifecycleSpec, 'onPlay' | 'onTurnEnd' | 'onDraw'>> = {
  onPlay: 'discard',
  onTurnEnd: 'discard',
  onDraw: 'none'
};
```

### 4.2 PlayerState 最小扩展

```ts
interface PlayerState {
  deck: CardId[];
  hand: CardId[];
  drawPile: CardId[];
  discardPile: CardId[];
  exhaustPile: CardId[];
  retainedCards: CardId[];
}
```

说明：

- `retainedCards` 可以是独立区，也可以是“下回合发牌前暂存区”。从 UI 角度，保留牌下回合仍显示在 hand。
- CardId 阶段不建议做 `limbo` 区；如果需要避免打出牌在效果中被洗回，继续沿用 `excludeFromReshuffle`，但把它升级成 `DrawPolicy`。
- `exhaustPile` 应进入 snapshot，方便 UI 与测试确认“这张牌离开循环了”。

### 4.3 中期 CardInstance 字段

以下结构不要作为本轮最小切口，但应作为 P2 迁移目标：

```ts
type CardInstanceId = string;

interface CardInstance {
  instanceId: CardInstanceId;
  definitionId: CardId;
  zone: CardZone;
  upgraded?: boolean;
  temporary?: boolean;
  createdBy?: CardId | 'enemy' | 'reward' | 'event' | 'system';
  costForTurn?: number;
  retainCount?: number;
  modifiers: CardModifier[];
}
```

触发条件：只要出现“同一 `cardId` 的两张牌状态不同”，就必须用 `CardInstance`，不能再用 sidecar 数组硬撑。

## 5. 推荐命令与事件

### 5.1 命令

| 命令 | P0/P1/P2 | 用途 |
| --- | --- | --- |
| `MoveCard` | P0 | 从一个牌区移动一个 `cardId` 到另一个牌区；替代 `DiscardPlayedCard` 的内部实现。 |
| `ResolvePlayedCardLifecycle` | P0 | 根据 `card.lifecycle.onPlay` 决定打出后去 discard/exhaust/remove/stay。 |
| `ResolveEndTurnHandLifecycle` | P0 | 回合末按每张牌 `onTurnEnd` 分流：discard/retain/exhaust/remove。 |
| `DrawCards` with `DrawPolicy` | P0 | 保留当前抽牌命令，但支持排除 resolving / exhausted / retained。 |
| `CreateCardInZone` | P1 | 生成 status/curse/temporary 卡到 hand/draw/discard。 |
| `PurgeTemporaryCards` | P1 | 按 `purgeAt` 清理临时牌。CardId 阶段只适合清理定义级临时牌。 |
| `CleanseCard` | P1 | 从 hand/discard/draw 中移除 status/curse。指定同名实例前只能按 `cardId` 移除一张。 |
| `UpgradeCardInstance` | P2 | 升级单张实例。必须等 `CardInstance`。 |
| `ModifyCardCost` | P2 | 修改单张牌费用。必须等 `CardInstance`。 |

### 5.2 事件

| 事件 | 必带字段 | 用途 |
| --- | --- | --- |
| `CardMoved` | `cardId/from/to/reason/traceId/tick` | 所有牌区移动的基础证据。 |
| `CardDrawn` | `cardId/from/toHand/reshuffled` | 不再只用 `HandDealt` 表达所有抽牌。 |
| `CardDiscarded` | `cardId/from/reason` | 回合末弃牌、打出后进弃牌、效果弃牌都可追踪。 |
| `CardExhausted` | `cardId/from/reason` | 消耗牌、ethereal、状态牌打出后消耗。 |
| `CardRetained` | `cardId/from/reason` | 保留手牌的 UI 与 QA 依据。 |
| `CardCreated` | `cardId/destination/createdBy/temporary` | 状态牌、临时牌、诅咒牌进入循环。 |
| `StatusCardAdded` | `cardId/destination/source` | 物理状态牌污染证据，不等同于实体 buff/debuff。 |
| `CurseAdded` | `cardId/destination/source/persistentScope` | 诅咒来源与持久范围。 |
| `TemporaryCardPurged` | `cardId/from/reason` | 临时牌被清理，不参与 deck/reward。 |
| `CardLifecycleResolved` | `cardId/timing/result/reason` | 调试总事件，证明生命周期不是 UI 猜出来的。 |

字段建议：

```ts
type CardMoveReason =
  | 'draw'
  | 'play-default'
  | 'play-exhaust'
  | 'turn-end-discard'
  | 'turn-end-retain'
  | 'ethereal-expired'
  | 'status-created'
  | 'curse-created'
  | 'temporary-purged'
  | 'cleanse';
```

## 6. 关键流程建议

### 6.1 发牌：retain-aware deal

当前 `DealHand` 直接 `world.player.hand = dealtCards`。P0 后应改为：

```text
kept = retainedCards
drawCount = max(0, HAND_SIZE - kept.length)
drawn = drawCardsFromDeck(drawCount)
hand = kept + drawn
retainedCards = []
```

验收点：

- 保留 1 张时，下回合只补抽 3 张。
- 保留牌不会进入 discard。
- `HandDealt` 可继续保留，但应增加逐张 `CardDrawn` 和 `CardRetained` 事件。

### 6.2 打出：先支付，再生命周期移动，再 `CardPlayed`

当前顺序已经是支付与弃牌在 `CardPlayed` 前。为最小改动，可以保留这个大顺序，但把 `DiscardPlayedCard` 换成生命周期解析：

```text
validate play-card
SpendEnergy
ResolvePlayedCardLifecycle(cardId)
advanceCostChain
CardPlayed
resolve effects
```

原因：

- 不需要重排现有 ECA。
- `CardPlayed` 仍可作为效果入口。
- `DrawCards` 的 `excludeFromReshuffle` 仍能避免 resolving card 立刻洗回。

风险：

- 如果未来有“打出时从自身区域读取 instance modifier”的效果，CardId 阶段无法表达，必须迁移到 `CardInstance` 或增加 `resolving` 区。

### 6.3 回合末：从全量 `DiscardHand` 改成逐张生命周期

当前 `DiscardHand` 是：

```text
discardPile.push(...hand)
hand = []
```

P0 后应变成：

```text
for each card in hand:
  lifecycle = card.lifecycle ?? defaultLifecycle
  if lifecycle.ethereal or onTurnEnd === 'exhaust': move hand -> exhaustPile
  else if lifecycle.retain or onTurnEnd === 'retain': move hand -> retainedCards
  else if onTurnEnd === 'remove': move hand -> removed
  else move hand -> discardPile
hand = []
```

这个切口可以一次性覆盖 retain、ethereal、status 未打出惩罚的第一步。

### 6.4 状态牌

P0 可以先做两类定义级 status：

| 类型 | 生命周期 | 用途 |
| --- | --- | --- |
| 轻状态 | `onPlay: exhaust`, `onTurnEnd: discard` | 抽到占手牌；玩家可花行动打出消耗。 |
| 易逝状态 | `onPlay: exhaust`, `onTurnEnd: exhaust` | 抽到后若不处理，回合末自动离开循环。 |

P0 不建议状态牌直接造成复杂惩罚。先证明它能被创建、抽到、占手、弃牌或消耗。

### 6.5 诅咒牌

P1 再做 curse，原因是 curse 的核心价值是长期代价，需要 run / combat 边界更明确。

最小 curse 定义：

```ts
cardType: 'curse';
lifecycle: {
  onPlay: 'discard',
  onTurnEnd: 'discard',
  temporary: false,
  purgeAt: 'run-end'
}
```

CardId 阶段可以支持“一张 curse id 进入 deck/draw/discard 并随 run 循环”。但以下必须等 `CardInstance`：

- 记录这张 curse 来自哪个事件或奖励。
- 只净化其中一张同名 curse。
- 同名 curse 有不同惩罚或不同持久范围。
- 跨 run 永久 curse。

### 6.6 Temporary

CardId 阶段只允许两种临时：

1. 专用临时卡定义，例如 `delay_file`、`burnout_notice`，所有该 `cardId` 都是 temporary。
2. 专用状态牌定义，离开指定区或 run/combat 结束时统一清理。

不要在 CardId 阶段做：

- “复制一张 `redline_cut`，只有复制体是临时”。
- “同名一张 temporary、一张永久”。
- “临时牌本回合费用为 0”。

这些必须等 `CardInstance`。

## 7. P0 / P1 / P2

### P0：生命周期骨架，保留 CardId[]

目标：不做大重构，先让当前牌区能表达 draw/hand/discard/exhaust/retain/status 的基础行为。

- 给 `CardDefinition` 增加可选 `lifecycle`。
- 给 `PlayerState` 增加 `exhaustPile: CardId[]` 与 `retainedCards: CardId[]`。
- 新增统一 `moveOneCard(player, cardId, from, to)` helper；所有牌区移动走它。
- `DiscardPlayedCard` 内部改为 `ResolvePlayedCardLifecycle` 或兼容包装。
- `DiscardHand` 改为逐张处理 `onTurnEnd`。
- `DealHand` 兼容 retained：先拿 retained，再补抽。
- 增加 `CardMoved / CardDiscarded / CardExhausted / CardRetained / CardDrawn / CardLifecycleResolved` 事件。
- 支持至少 1 张测试用 status card：抽到占手牌，打出后 exhaust。
- 现有 16 张卡在未声明 lifecycle 时行为完全不变。

本阶段不做：

- `CardInstanceId`
- 升级
- 普通牌临时复制
- 单张牌费用修改
- 跨 run curse
- 完整状态 buff/debuff 系统

### P1：状态 / 临时 / 诅咒进入 run 循环

目标：让敌人或风险牌能污染抽牌循环，让玩家有净化/处理坏牌的压力。

- 新增 `cardType: 'curse'`。
- 新增 `CreateCardInZone`，支持把 status/curse 加入 `hand/drawPile/discardPile`。
- 支持定义级 temporary purge。
- 支持 run-local curse：restart 清空，普通回合不会自动消失。
- 支持 `CleanseCard`，先按 `cardId` 移除一张，不承诺实例级选择。
- 增加 `StatusCardAdded / CurseAdded / TemporaryCardPurged` 事件。
- 给 HUD/snapshot 暴露 `exhaustPile`、`retainedCards`、状态/诅咒计数。

### P2：CardInstance 迁移

目标：让“完整卡牌机制复刻”具备单张卡身份。

- `deck/hand/drawPile/discardPile/exhaustPile/retainedCards` 从 `CardId[]` 迁移为 `CardInstanceId[]`。
- 增加 `cardInstances: Record<CardInstanceId, CardInstance>`。
- `play-card` intent 进入 `cardInstanceId`，兼容层可从 UI 的 `cardId` 推断第一张可用实例。
- 支持升级、复制、变形、单张费用修改、临时普通牌、来源追踪、同名 curse 净化。
- 支持 replay 中准确复原每张牌移动轨迹。

## 8. 本轮可落地最小切口

如果下一批要动代码，建议只做一个窄切口：

1. 类型层新增 `CardLifecycleSpec`、`CardZone`、`CardMoveReason`，并给 `CardDefinition` 加 `lifecycle?: CardLifecycleSpec`。
2. `PlayerState` 新增 `exhaustPile`、`retainedCards`；`createInitialWorld` 与 `buildSnapshot` 补齐浅拷贝。
3. 新增牌区移动 helper：

```ts
function moveOneCard(player: PlayerState, cardId: CardId, from: CardZone, to: CardZone): boolean
```

4. `DiscardPlayedCard` 保留命令名，但内部调用 `resolveOnPlayDestination(card)`，默认仍到 discard。
5. `DiscardHand` 保留命令名，但内部逐张按 `onTurnEnd` 分流。
6. `DealHand` 先合并 `retainedCards`，再补抽到 `HAND_SIZE`。
7. 加 3 个隐藏/测试卡定义或 fixture：一张 `onPlay: exhaust`，一张 `onTurnEnd: retain`，一张 `status`。
8. 补 Vitest，确保现有核心测试仍过。

这个切口的价值是：只碰生命周期，不碰 ECA 效果解释器，不碰 UI 大结构，不碰 CardInstance。

## 9. 验收测试建议

### P0 Vitest

1. 默认生命周期不变：现有攻击牌打出后从 `hand` 移到 `discardPile`，事件包含 `CardMoved` 与 `CardDiscarded`。
2. `exhaust` 打出：带 `onPlay: 'exhaust'` 的牌打出后进入 `exhaustPile`，不进入 `discardPile`，抽牌堆空时不会被 reshuffle 抽回。
3. `retain` 回合末：带 `onTurnEnd: 'retain'` 的牌在 `end-turn` 后进入 `retainedCards`，下一次 `DealHand` 出现在 `hand`，补抽数量为 `HAND_SIZE - retainedCount`。
4. `ethereal` 回合末：带 `ethereal: true` 或 `onTurnEnd: 'exhaust'` 的牌未打出时进入 `exhaustPile`。
5. 状态牌最小闭环：`CreateCardInZone(statusCard, discardPile)` 后，后续抽到占手牌；打出后 exhaust；不打出则按 lifecycle 进入 discard 或 exhaust。
6. 事件证据完整：每次移动都有 `CardMoved`，最终去向事件与实际 pile 一致。
7. 旧行为回归：`redline-hyperturn-acceptance`、`redline-attribute-authorization`、`run-layer-boundary` 不因新增 pile 改变结果。

### P1 Vitest

1. 临时状态牌 purge：定义级 temporary card 在指定 `purgeAt` 时从 hand/draw/discard/exhaust 中移除。
2. run-local curse：curse 加入 deck 后会进入抽弃循环；`restart-run` 后消失；普通 `end-turn` 不会清掉。
3. cleanse：按 `cardId` 从指定区移除一张 status/curse，事件包含 `CardMoved` 或 `TemporaryCardPurged`。
4. Reward/Run 边界：奖励牌加入当前 run 仍按旧规则；curse/status 不伪装成局外成长。

### P2 Vitest / Replay

1. 同名两张牌，一张 upgraded 一张未升级，出牌只影响选中的实例。
2. 复制普通牌为 temporary，原牌不被 purge，复制体会 purge。
3. 同名两张 curse 来源不同，净化只移除被选中的实例。
4. 单张降费只持续到对应实例被打出或回合结束。
5. replay 能按 `instanceId` 还原每次 draw/retain/exhaust/discard。

### 浏览器 / UI 验收

生命周期本身先用 Vitest 锁；UI 只需要在进入 P1 后补显示：

- 手牌上能显示 `保留`、`消耗`、`状态`、`诅咒` 标签。
- 移动端标签不撑破卡牌按钮。
- reward / hand / status strip 不把 `retained`、`exhaust` 计数误读成当前 MP 或永久成长。

## 10. 必须等待 CardInstance 的清单

以下需求不要在 `CardId[]` 上继续加 sidecar 硬做：

- 同名卡一张升级、一张未升级。
- 同名卡一张 temporary、一张永久。
- 复制一张普通卡并让复制体战斗后消失。
- 单张卡本回合降费或下一次打出免费。
- 同名 status/curse 有不同来源、持续时间、惩罚。
- 只净化手里的某一张同名 curse。
- 保留某一张同名牌，并记录保留次数。
- 卡牌 transform 后仍追踪前身。
- 完整 replay / debug 需要逐张身份。

判断标准很简单：如果机制要回答“是哪一张牌”，就必须上 `CardInstance`；如果只需要回答“是哪种牌”，`CardId[]` 仍可支撑。

## 11. 结论

第 2 轮不应把卡牌生命周期和完整效果解释器、升级系统、局外成长混在一起。最小正确顺序是：

1. 先用 `CardId[]` 补齐牌区：draw / hand / discard / exhaust / retained。
2. 再用定义级 lifecycle 支持 retain、exhaust、status 的基础闭环。
3. 再进入 P1 的 temporary / curse / cleanse。
4. 最后在真正需要单张身份时迁移 `CardInstance`。

这样既能承接第 1 轮的完整机制契约，又不会在当前 P0 Hyper-Turn 样片上引入过大的重构风险。
