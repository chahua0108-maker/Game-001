# 2026-05-18 Round 02 Expert 03：最小效果解释器工程师

## 0. 结论

当前不需要推倒 `runtime.ts` / ECA / Command reducer。最小方案是保留现有 `Intent -> Event -> Rule -> Command -> Event`，只把 `redlineRules.ts` 里围绕 `CardPlayed` 的卡牌效果分支收敛成：

1. `EffectSpec`：卡牌效果的结构化描述。
2. `TargetQuery`：目标选择与目标验证的同一套查询语言。
3. `resolveCardEffects(world, event, card)`：只把卡牌效果翻译成现有 `Command[]`，不直接改 `WorldState`。

第一版不要求把 `cards.ts` 全部改成 `effects` 字段。应先加 `legacyEffectsFromCard(card)`，把当前 `damage / targets / drawCards / energyGain / utilities` 映射成解释器输入，确保现有 16 张牌行为不变。

## 1. 当前行为盘点

审查范围：

- `prototype-web/src/data/cards.ts`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/eca/redlineRules.ts`
- 相关 sim 测试与第 1 轮长任务文档

当前卡牌效果来源分散在三处：

| 位置 | 现在负责什么 | 最小迁移建议 |
| --- | --- | --- |
| `cards.ts` | 定义 `damage`、`targets`、`drawCards`、`energyGain`、`utilities` | 保留旧字段，加可选 `effects?: EffectSpec[]`，由 adapter 兜底 |
| `runtime.ts` | 出牌验证、默认目标、支付、弃出牌、费用链、`CardPlayed` 事件 | 暂时保留；只在后续 Phase 2 抽出 target/payment helper |
| `redlineRules.ts` | `CardPlayed` 后按目标类型手写伤害/抽牌/回能/payoff 命令 | 改成一个 `card.effects.on-play` 规则调用 `resolveCardEffects` |
| `types.ts` | 定义 `CardDefinition`、`GameEvent`、`Command` | 先追加效果类型；牌区/状态命令留扩展口 |

现有 16 张牌可归成 5 类行为：

| 行为类 | 覆盖卡牌 | 当前效果 |
| --- | --- | --- |
| 前排单体伤害 | `debt_hook`、`blood_reclaim`、`spark_tap`、`redline_cut`、`heartbeat_spark`、`verdict_mark`、`wild_gap_key` | 对 `targetId` 造成 `damage * effectMultiplier`，`SetCombo +1` |
| 前排横扫 | `row_cleave`、`clearance_order` | 对第一排存活敌人各造成 `damage * effectMultiplier`，`SetCombo +1` |
| 全体 payoff | `severance_burst`、`red_ledger_burst` | `ClearBurst`，对所有存活敌人造成 `damage * effectMultiplier`，`ResolvePayoff`，`SetCombo 0` |
| 自身抽牌 | `blood_tithe`、`pulse_draw`、`paper_shatter`、`lantern_captain` | `DrawCards(count = drawCards * effectMultiplier)` |
| 自身抽牌加回能 | `wild_mana_stitch` | `DrawCards(drawCards * effectMultiplier)`，`GainEnergy(energyGain)`；当前回能不吃倍率 |

必须保留的细节：

- 单体牌没有传 `targetId` 时，`runtime.ts` 现在会默认选择前排中本回合意图最高、同意图时低 HP、再同则低 slot 的敌人。
- `validatePlayCard` 先验证玩家回合、手牌、支付能力、目标存活和前排合法性，成功后才支付和弃牌。
- `advanceCostChain` 在 `CardPlayed` 之前运行，`effectMultiplier` 已经写入事件。
- `DrawCards` 在 `CardPlayed` 事件内触发时会排除本次打出的牌，避免空抽牌堆时立刻洗回再抽到自己。
- payoff 的 `ResolvePayoff` 需要在伤害命令之后执行，才能用伤害后的状态统计 kill count 和 prevented intent damage。

## 2. 最小架构边界

本轮建议的边界是：

```text
Intent(play-card)
  -> runtime.validatePlayCard
  -> SpendEnergy / DiscardPlayedCard / SetCharacterState
  -> advanceCostChain
  -> Event(CardPlayed with effectMultiplier)
  -> redlineRules: card.effects.on-play
  -> resolveCardEffects(...)
  -> Command[]
  -> applyCommand(...)
```

关键原则：

- 解释器只生成 `Command[]`，不直接改 `world`。
- 第一版只解释 `CardPlayed` 的 on-play 效果，不改敌人死亡奖励、回合推进、奖励选择。
- `applyCommand` 继续是唯一状态变更边界。
- `redlineRules.ts` 继续是事件订阅层，但不再为每个目标类型写一条卡牌规则。
- 旧字段和新 `effects` 可以共存；旧字段通过 `legacyEffectsFromCard` 自动映射。

## 3. 建议文件拆分

### 3.1 第一批最小文件

| 文件 | 类型 | 内容 |
| --- | --- | --- |
| `prototype-web/src/sim/effectTypes.ts` | 新增 | `EffectSpec`、`EffectOp`、`TargetQuery`、`AmountSpec`、`ResolvedTarget` 类型 |
| `prototype-web/src/sim/targeting.ts` | 新增 | `resolveTargetQuery`、`validateTargetQuery`、`defaultFrontEnemyId`；先支持当前 4 类目标 |
| `prototype-web/src/sim/cardEffects.ts` | 新增 | `legacyEffectsFromCard`、`effectsForCard`、`resolveCardEffects` |
| `prototype-web/src/sim/types.ts` | 小改 | `CardDefinition.effects?: EffectSpec[]`；后续追加牌区/状态命令 |
| `prototype-web/src/eca/redlineRules.ts` | 小改 | 三条卡牌规则合并为一条 `card.effects.on-play`；`enemy.death.reward` 保留 |

### 3.2 暂不拆的东西

第一版不要新建大目录、不要引入脚本语言、不要把 `runtime.ts` 全部切开。以下内容只留接口口子：

- `cardZones.ts`：等真正实现 `discard/exhaust/retain` 时再抽。
- `statuses.ts`：等第一批 status 牌进入运行时再抽。
- `resources.ts`：等 `tempAuthorizationMP` 之外出现第二种临时资源时再抽。
- `CardInstance`：等升级、复制、临时卡、同名不同状态真正进入范围时再做。

## 4. 类型草案

### 4.1 TargetQuery

第一版只覆盖当前目标，同时给后续敌我目标留口。

```ts
export type TargetQuery =
  | { kind: 'self' }
  | { kind: 'chosen-enemy'; required?: boolean; mustBeFrontRow?: boolean }
  | { kind: 'front-enemy'; fallback?: 'highest-intent-lowest-hp' }
  | { kind: 'front-row-enemies' }
  | { kind: 'all-enemies' }
  | { kind: 'none' };

export type ResolvedTarget =
  | { kind: 'self'; entityId: 'player' }
  | { kind: 'enemy'; entityId: EntityId }
  | { kind: 'enemy-list'; entityIds: EntityId[] }
  | { kind: 'none' };

export interface TargetResolution {
  ok: boolean;
  targets: ResolvedTarget;
  failedCondition?: {
    id: 'target-alive' | 'front-target' | 'target-required' | 'no-targets';
    reason: string;
  };
}
```

映射关系：

| 旧 `card.targets` | 新 `TargetQuery` | 备注 |
| --- | --- | --- |
| `front-enemy` | `{ kind: 'chosen-enemy', mustBeFrontRow: true }`，缺目标时先由 runtime 填默认目标 | 短期保持现状；Phase 2 再把默认目标移进 resolver |
| `front-row` | `{ kind: 'front-row-enemies' }` | 必须至少有一个第一排存活敌人 |
| `all-enemies` | `{ kind: 'all-enemies' }` | 必须至少有一个存活敌人 |
| `self` | `{ kind: 'self' }` | 不需要敌人目标 |

### 4.2 AmountSpec

```ts
export type AmountSpec =
  | { kind: 'flat'; value: number }
  | { kind: 'card-damage'; scale: 'effect-multiplier' | 'none' }
  | { kind: 'card-draw'; scale: 'effect-multiplier' | 'none' }
  | { kind: 'card-energy-gain'; scale: 'effect-multiplier' | 'none' }
  | { kind: 'status-stacks'; statusId: string; target: TargetQuery; multiplier?: number };
```

当前映射：

- 伤害：`{ kind: 'card-damage', scale: 'effect-multiplier' }`
- 抽牌：`{ kind: 'card-draw', scale: 'effect-multiplier' }`
- 回能：`{ kind: 'card-energy-gain', scale: 'none' }`

### 4.3 EffectSpec / EffectOp

```ts
export type EffectTrigger =
  | 'on-play'
  | 'on-draw'
  | 'on-discard'
  | 'on-exhaust'
  | 'on-retain'
  | 'turn-start'
  | 'turn-end'
  | 'enemy-killed'
  | 'damage-applied';

export interface EffectSpec {
  id: string;
  trigger: EffectTrigger;
  ops: EffectOp[];
  tags?: EffectTag[];
}

export type EffectTag =
  | 'attack'
  | 'draw'
  | 'resource'
  | 'payoff'
  | 'wild'
  | 'status'
  | 'card-move';

export type EffectOp =
  | {
      op: 'damage';
      target: TargetQuery;
      amount: AmountSpec;
      sourceId?: EntityId;
    }
  | {
      op: 'draw';
      count: AmountSpec;
      policy?: DrawPolicy;
    }
  | {
      op: 'gain-energy';
      amount: AmountSpec;
    }
  | {
      op: 'set-combo';
      mode: 'increment' | 'set';
      value: number;
      reason: string;
    }
  | {
      op: 'clear-burst';
    }
  | {
      op: 'resolve-payoff';
      target: TargetQuery;
      intentDamageBefore: 'from-targets';
    }
  | FutureCardMoveOp
  | FutureStatusOp;

export interface DrawPolicy {
  excludeResolvingCard?: boolean;
  allowReshuffle?: boolean;
}

export type FutureCardMoveOp =
  | {
      op: 'discard-card';
      selection: 'self' | 'chosen-hand-card' | 'random-hand-card' | 'all-hand';
      count?: AmountSpec;
    }
  | {
      op: 'exhaust-card';
      selection: 'self' | 'chosen-hand-card' | 'discard-pile-card';
      count?: AmountSpec;
    }
  | {
      op: 'retain-card';
      selection: 'self' | 'chosen-hand-card';
      until: 'next-turn' | 'combat';
    };

export type FutureStatusOp =
  | {
      op: 'apply-status';
      target: TargetQuery;
      statusId: string;
      stacks: AmountSpec;
      duration?: 'turn' | 'combat' | 'run';
    }
  | {
      op: 'remove-status';
      target: TargetQuery;
      statusId: string;
      stacks?: AmountSpec;
    };
```

### 4.4 resolveCardEffects 签名

```ts
export interface CardEffectContext {
  world: WorldState;
  event: Extract<GameEvent, { type: 'CardPlayed' }>;
  card: CardDefinition;
}

export interface CardEffectResolution {
  commands: Command[];
  failedConditions: Array<{
    conditionId: string;
    reason: string;
  }>;
}

export function resolveCardEffects(context: CardEffectContext): CardEffectResolution {
  const specs = effectsForCard(context.card);
  // 只执行 trigger === 'on-play' 的 spec。
  // 每个 op 解析为现有 Command。
  // 不直接修改 world。
}
```

第一版 `failedConditions` 可以先很少用，因为 `validatePlayCard` 已经挡住主要非法出牌。保留这个返回值是为了后续 `on-discard / on-retain / status` 触发时也能进入 debug 轨迹。

## 5. legacyEffectsFromCard 映射

第一版 adapter 应保证“不改 `cards.ts` 也能覆盖当前所有卡”。

```ts
export function legacyEffectsFromCard(card: CardDefinition): EffectSpec[] {
  if (card.targets === 'self') {
    return [
      {
        id: `${card.id}.self-resource`,
        trigger: 'on-play',
        tags: ['draw', 'resource'],
        ops: [
          ...(card.drawCards
            ? [{ op: 'draw', count: { kind: 'card-draw', scale: 'effect-multiplier' }, policy: { excludeResolvingCard: true } }]
            : []),
          ...(card.energyGain
            ? [{ op: 'gain-energy', amount: { kind: 'card-energy-gain', scale: 'none' } }]
            : [])
        ]
      }
    ];
  }

  if (card.cost === 3 && card.targets === 'all-enemies' && card.comboNode === 'burst') {
    return [
      {
        id: `${card.id}.payoff-burst`,
        trigger: 'on-play',
        tags: ['attack', 'payoff'],
        ops: [
          { op: 'clear-burst' },
          { op: 'damage', target: { kind: 'all-enemies' }, amount: { kind: 'card-damage', scale: 'effect-multiplier' } },
          { op: 'resolve-payoff', target: { kind: 'all-enemies' }, intentDamageBefore: 'from-targets' },
          { op: 'set-combo', mode: 'set', value: 0, reason: 'clear burst spent combo' }
        ]
      }
    ];
  }

  if (card.targets === 'front-row') {
    return [
      {
        id: `${card.id}.front-row-damage`,
        trigger: 'on-play',
        tags: ['attack'],
        ops: [
          { op: 'damage', target: { kind: 'front-row-enemies' }, amount: { kind: 'card-damage', scale: 'effect-multiplier' } },
          { op: 'set-combo', mode: 'increment', value: 1, reason: `played ${card.comboNode}` }
        ]
      }
    ];
  }

  if (card.targets === 'front-enemy') {
    return [
      {
        id: `${card.id}.front-enemy-damage`,
        trigger: 'on-play',
        tags: ['attack'],
        ops: [
          {
            op: 'damage',
            target: { kind: 'chosen-enemy', required: true, mustBeFrontRow: true },
            amount: { kind: 'card-damage', scale: 'effect-multiplier' }
          },
          { op: 'set-combo', mode: 'increment', value: 1, reason: `played ${card.comboNode}` }
        ]
      }
    ];
  }

  return [];
}
```

注意：

- `payoff` 仍可先复用旧判断，但要集中在 `cardEffects.ts` 内，避免 `runtime.ts` 和 `redlineRules.ts` 各有一份。
- 当前 `energyGain` 不乘倍率，adapter 必须保持这一点。
- 当前 self 牌不 `SetCombo`，adapter 也不要擅自加。
- 当前 `wild` 修补属于费用链逻辑，不属于 on-play 效果；第一版不要把 `utilities: ['wild']` 迁到解释器里改变行为。

## 6. resolveCardEffects 命令生成规则

第一版只输出已有命令：

| EffectOp | 输出 Command | 关键细节 |
| --- | --- | --- |
| `damage` 单体 | `DamageEnemy` | 使用 `event.targetId`，保持前排合法性由 validate 阶段保证 |
| `damage` 多目标 | 多个 `DamageEnemy` | `front-row` 按 slot 前 5；`all-enemies` 包括所有存活敌人 |
| `draw` | `DrawCards` | 保持 `excludeResolvingCard`，可继续由 `processEventQueue` 或命令字段处理 |
| `gain-energy` | `GainEnergy` | 不吃当前倍率 |
| `set-combo` | `SetCombo` | `increment` 时用 `world.player.combo + value` |
| `clear-burst` | `ClearBurst` | 必须在 payoff 伤害前 |
| `resolve-payoff` | `ResolvePayoff` | 必须在 payoff 伤害后；`affectedEnemyIds` 用伤害前解析出的目标列表 |

payoff 解析要注意顺序：

```ts
const affectedEnemyIds = resolveTargetQuery(...all-enemies...).entityIds;
const intentDamageBefore = affectedEnemyIds.reduce(
  (total, enemyId) => total + (world.enemyIntents[enemyId]?.amount ?? 0),
  0
);

return [
  { type: 'ClearBurst', ... },
  ...affectedEnemyIds.map((enemyId) => ({ type: 'DamageEnemy', targetId: enemyId, ... })),
  { type: 'ResolvePayoff', affectedEnemyIds, intentDamageBefore, ... },
  { type: 'SetCombo', value: 0, ... }
];
```

这样可以保持现有 `PayoffResolved.killCount` 和 `preventedIntentDamage` 语义。

## 7. 给 draw / discard / exhaust / retain / status 留口

### 7.1 draw

当前已具备 `DrawCards` 和 `drawPile/discardPile` 循环。需要留的口：

- `DrawPolicy.excludeResolvingCard`
- `DrawPolicy.allowReshuffle`
- 未来 `DrawPolicy.sourcePile?: 'draw' | 'discard' | 'any'`

第一版不要改抽牌算法，只把“抽几张”从 `redlineRules.ts` 移到 `EffectOp`。

### 7.2 discard

当前只有 `DiscardPlayedCard` 和 `DiscardHand`。未来最小新增：

```ts
type Command =
  | { type: 'DiscardCards'; traceId: TraceId; selection: HandSelection; count: number; reason: string }
  | existing;
```

但推荐中期直接做更通用的：

```ts
type CardZone = 'hand' | 'drawPile' | 'discardPile' | 'exhaustPile' | 'retained';

type MoveCardCommand = {
  type: 'MoveCards';
  traceId: TraceId;
  cardIds: CardId[];
  from: CardZone;
  to: CardZone;
  reason: string;
};
```

第一版只保留 `FutureCardMoveOp` 类型，不实现命令。

### 7.3 exhaust

`PlayerState` 后续最小扩展：

```ts
interface PlayerState {
  exhaustPile?: CardId[];
}
```

不要一上来实例化卡牌。用 `CardId[]` 可以先验证“打出后消耗”和“消耗指定手牌”。

### 7.4 retain

`retain` 不应该靠 `DiscardHand` 里写死一堆卡名。最小模型：

```ts
interface PlayerState {
  retainedCards?: CardId[];
}
```

回合末流程后续应插入：

```text
TurnEnded
  -> BeforeHandDiscarded
  -> on-retain / retain effects
  -> DiscardHand(only non-retained)
  -> EnemyAttack...
```

第一版只把 `on-retain` 放入 `EffectTrigger`，不调整回合流程。

### 7.5 status

状态要挂在实体上，不要散落成 `player.combo` 那样的专用字段。后续最小扩展：

```ts
interface EntityStatusState {
  stacks: number;
  duration?: 'turn' | 'combat' | 'run';
  sourceCardId?: CardId;
}

interface PlayerState {
  statuses?: Record<string, EntityStatusState>;
}

interface EnemyState {
  statuses?: Record<string, EntityStatusState>;
}
```

新增命令可以是：

```ts
| { type: 'ApplyStatus'; traceId: TraceId; targetId: EntityId; statusId: string; stacks: number; duration?: StatusDuration; sourceCardId?: CardId }
| { type: 'RemoveStatus'; traceId: TraceId; targetId: EntityId; statusId: string; stacks?: number }
```

第一版 `EffectOp` 先包含 `apply-status/remove-status` 类型，但 resolver 可以对未实现 op 返回 failed condition，避免静默吞效果。

## 8. 迁移顺序

### Phase 0：测试冻结

先不改行为，只确认现有测试覆盖这些基线：

- 单体牌造成 `damage * effectMultiplier`
- 前排横扫命中 5 个第一排敌人
- 全体 payoff 命中所有存活敌人并产生 `ClearBurstRequested / PayoffResolved`
- self 抽牌按 multiplier 放大
- `wild_mana_stitch` 抽牌放大但回能不放大
- 空抽牌堆 self draw 不会立刻抽回刚打出的牌
- 非法目标不支付、不弃牌、不推进链

### Phase 1：只加类型与 adapter，不切规则

- 新增 `effectTypes.ts`。
- 新增 `legacyEffectsFromCard(card)`。
- 给 `CardDefinition` 加可选 `effects?: EffectSpec[]`。
- 不改 `redlineRules.ts` 行为。
- 测试只做类型/adapter 单测，确认 16 张卡都能生成至少一个 on-play effect。

### Phase 2：新增 resolver，与旧规则并跑对照

- 新增 `resolveCardEffects`。
- 用单测直接调用 resolver，对比旧规则期望输出的 Command 形状。
- 暂不接入 `redlineRules.ts`，避免一次性影响 runtime。

### Phase 3：接入 ECA 的 `CardPlayed`

- 把 `redlineRules.ts` 的三条卡牌规则替换成一条：

```ts
{
  id: 'card.effects.on-play',
  event: 'CardPlayed',
  filter: ({ event }) => event.type === 'CardPlayed',
  conditions: [],
  actions: [({ world, event }) => resolveCardEffects({ world, event, card: cards[event.cardId] }).commands]
}
```

- 保留 `enemy.death.reward`。
- 保留 `processEventQueue` 对 `DrawCards + CardPlayed` 的 `excludeFromReshuffle` 特例，直到 `DrawPolicy` 真正落地。

### Phase 4：统一 target resolver

- 把 `front-enemy/front-row/all-enemies/self` 的验证和解析迁到 `targeting.ts`。
- `validatePlayCard` 和 `resolveCardEffects` 共用 resolver。
- 默认目标选择也移入 resolver，保持与 UI 预览一致。

### Phase 5：牌区与状态逐个接入

顺序建议：

1. `MoveCards` + `exhaustPile`
2. `retainedCards` + `BeforeHandDiscarded`
3. `ApplyStatus/RemoveStatus`
4. `on-draw/on-discard/on-exhaust/on-retain`
5. 再考虑 `CardInstanceId`

不要先做 `CardInstanceId`，否则会把 P0 行为验证拖成一次全牌区重构。

## 9. 第一批测试建议

### 9.1 adapter 覆盖测试

文件建议：`prototype-web/src/tests/sim/card-effects-adapter.test.ts`

测试点：

- `Object.values(cards)` 全部能通过 `effectsForCard(card)` 得到至少一个 `on-play` spec。
- `debt_hook` 映射成 `damage -> chosen-enemy(front-row required) + set-combo increment`。
- `row_cleave` 映射成 `damage -> front-row-enemies + set-combo increment`。
- `severance_burst` 映射成 `clear-burst -> all-enemies damage -> resolve-payoff -> set-combo 0`。
- `wild_mana_stitch` 映射成 `draw(scale effect-multiplier)` 和 `gain-energy(scale none)`。

### 9.2 resolver 命令测试

文件建议：`prototype-web/src/tests/sim/card-effects-resolver.test.ts`

测试点：

- 给定 `CardPlayed(effectMultiplier: 2, cardId: 'redline_cut', targetId: 'enemy-1')`，resolver 输出一个 `DamageEnemy(amount: 18)` 和一个 `SetCombo`。
- 给定 `row_cleave`，resolver 输出 5 个 `DamageEnemy`，目标只包含 slot `0..4` 的存活敌人。
- 给定 `pulse_draw(effectMultiplier: 2)`，resolver 输出 `DrawCards(count: 2)`。
- 给定 `wild_mana_stitch(effectMultiplier: 2)`，resolver 输出 `DrawCards(count: 2)` 与 `GainEnergy(amount: 1)`。
- 给定 `severance_burst(effectMultiplier: 4)`，resolver 输出顺序必须是 `ClearBurst`、15 个 `DamageEnemy`、`ResolvePayoff`、`SetCombo`。

### 9.3 接入后回归测试

继续沿用现有测试文件，不新增大批场景，重点跑：

- `prototype-web/src/tests/sim/runtime.test.ts`
- `prototype-web/src/tests/sim/runtime-audit.test.ts`
- `prototype-web/src/tests/sim/redline-hyperturn-acceptance.test.ts`

必须特别确认：

- `test-empty-self-draw` 和 audit self draw 仍不把刚打出的牌洗回抽到。
- `test-payoff-3` 的 `PayoffResolved.preventedIntentDamage` 不变。
- `test-failed-chain-invalid` 仍不推进链。
- `test-back-target` 仍不支付、不弃牌。

### 9.4 留口测试

在源码真正支持之前，可以先写 pending 或 type-only 测试，不要让 CI 红：

- `EffectOp` union 能表达 `discard-card / exhaust-card / retain-card`。
- `EffectOp` union 能表达 `apply-status / remove-status`。
- 未实现 op 在 resolver 中必须显式失败或抛受控错误，不能静默忽略。

## 10. 关键风险与取舍

1. **不要把出牌支付放进第一版解释器。** 支付和费用链现在在 `runtime.ts` 稳定工作，先迁卡牌效果即可。

2. **不要先重写 `cards.ts`。** 让 adapter 覆盖旧字段，可以减少同批改动量，也能让其他 worker 的卡牌字段改动不被打断。

3. **payoff 判断要集中。** 当前 runtime 和 ECA 各有 `isPayoffFinisher`。第一版最少也应把判断集中到 `cardEffects.ts` 或 `cardPredicates.ts`，避免以后某张 payoff 的字段稍变导致两边不一致。

4. **resolver 必须保持命令顺序。** 特别是 payoff 的 `ResolvePayoff` 必须在伤害命令之后，`intentDamageBefore` 必须在伤害前取样。

5. **target validation 和 target execution 最终必须共用。** Phase 1 可以先保持 runtime 验证；Phase 4 必须收口，否则 UI 预览、runtime 默认目标、效果命中目标会继续分叉。

6. **CardId[] 可以先撑住。** `discard/exhaust/retain/status` 的第一版不需要立刻 CardInstance 化。等升级、复制、临时费用或同名不同状态进入范围，再迁实例。

## 11. 最小验收定义

下一轮真正实现时，最小验收应是：

- `redlineRules.ts` 不再有按 `cards[event.cardId].targets` 分叉的三条卡牌效果规则。
- 现有 16 张牌全部由 `legacyEffectsFromCard` 或显式 `effects` 解析。
- 现有 runtime / hyper-turn 测试全部通过。
- 新增 adapter/resolver 测试能证明当前所有卡牌行为被覆盖。
- 类型层已经能表达 draw、discard、exhaust、retain、status，但未实现的 op 不会被静默吞掉。

