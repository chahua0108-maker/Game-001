# Game-001 第 1 轮专家 04：效果引擎工程师审查

日期：2026-05-18  
范围：`prototype-web/src/sim/{runtime,types,world,snapshot,rewardChoices,runModifiers}.ts` 与 `prototype-web/src/eca/{ruleSet,redlineRules}.ts`  
结论：当前已经有可保留的事件队列、Command reducer、ECA 调试轨迹，但卡牌效果本身仍是“少量字段 + runtime/ECA 分支”的硬编码模型。若要复刻完整卡牌机制，建议先做一个小型、类型安全、数据驱动的效果解释器，不要推倒现有 tick/event/command 架构。

## 1. 当前实现结构判断

### 1.1 已经有可扩展骨架

- `tickWorld` 将输入 Intent 转成事件队列，`processEventQueue` 再把事件交给 `evaluateRules(redlineRules, world, event)`，规则产出的 Command 统一交回 `applyCommand` 执行。这个 `Intent -> Event -> Rule -> Command -> Event` 形状可以继续保留。
- `applyCommand` 是目前最重要的状态变更边界，抽牌、弃牌、能量、伤害、敌人补位、回合推进、FSM 切换都在这里集中处理。
- `DebugState` 已记录 `events/commands/failedConditions/ruleHits/trace`，对解释器上线后的差异回放很有价值。
- `snapshot.ts` 只做浅层可序列化快照复制；后续新增状态只要挂在 `WorldState` 下，就能按同一模式扩展。

### 1.2 卡牌效果仍偏硬编码

- `CardDefinition` 当前只有 `damage`、`targets`、`drawCards?`、`energyGain?`、`utilities?` 等固定字段。它能覆盖“伤害 / 抽牌 / 回能 / wild 修补”这类小集合，但不能表达保留、消耗、弃指定牌、状态叠层、回合触发、敌我双目标等机制。
- 支付、目标验证、默认目标选择、打出后弃牌、chain 推进都写在 `runtime.ts` 的 `validatePlayCard` 与 `tickWorld` 分支中。新增“保留牌不弃”“消耗牌进 exhaust”“临时资源只能本回合用”等效果时，会继续扩大这些分支。
- `redlineRules.ts` 的 ECA 规则按 `cards[event.cardId].targets` 分成 `front-enemy/front-row/self`，动作函数直接读取 `cards` 和 `world`，并手写 `DamageEnemy/DrawCards/GainEnergy/SetCombo`。这是函数式规则，不是内容数据可配置的效果解释。
- Payoff 与授权链高度写死：`isAuthorizationChain` 只识别 `0 -> 1 -> 2`，授权固定给 `tempAuthorizationMP += 3` 且限制为 `payoff-only`；`isPayoffFinisher` 用 `cost === 3 && targets === 'all-enemies' && comboNode === 'burst'` 判断，且 runtime 与 ECA 各有一份判断。
- 抽牌已有基础命令 `DrawCards`，并在处理 `CardPlayed` 时通过 `excludeFromReshuffle: [event.cardId]` 避免刚打出的牌被同次洗回。这是好细节，但它也说明“牌移动策略”已经开始和效果结算互相耦合。
- 弃牌目前只有 `DiscardPlayedCard` 和 `DiscardHand`。没有 `exhaustPile`、`retain` 标记、指定弃牌、从弃牌堆取回、洗牌区过滤策略。
- `runModifiers.ts` 明确是 `preview-only`，并带有 `not-runtime-applied` 排除项。它现在只是结算成长预览，不是运行时效果来源。

### 1.3 ECA 规则的位置

现有 ECA 适合继续当“事件订阅层”，但不适合把每种卡牌效果都写成一条 TypeScript 规则。更合理的边界是：

- ECA 负责监听 `CardPlayed`、`TurnEnded`、`EnemyKilled`、`StatusTicked` 等事件。
- 卡牌/状态/遗物/本局 modifier 的具体效果用数据结构描述。
- 解释器把效果数据解析为现有 Command。
- `applyCommand` 仍是唯一实际改 `WorldState` 的地方。

## 2. 主要扩展风险

1. **目标体系太窄。** 当前只有 `front-enemy/front-row/all-enemies/self`。完整卡牌机制需要 chosen enemy、random enemy、all allies、self plus enemy、dead enemy、lowest HP enemy、has status target、previous target 等查询；如果继续靠 `if card.targets === ...` 扩展，会在 runtime 和 ECA 中重复。

2. **牌区模型不完整。** 现有 `deck/hand/drawPile/discardPile` 可以跑基础循环，但缺少 `exhaustPile`、`retained`、`limbo/resolving`、`createdThisCombat`、`temporaryCard` 等概念。现在 `DiscardPlayedCard` 在效果事件前执行，未来“打出后消耗”“打出后保留副本”“从手牌弃一张再抽两张”会很容易和自动弃牌冲突。

3. **临时资源被特例化。** `tempAuthorizationMP` 只能服务 payoff 授权链，生命周期由 `resetCostChain` 和 `SpendEnergy` 的分支隐式控制。后续若有“本回合临时 MP”“下张攻击免费”“只可用于 skill”“消耗状态层数支付”等，会出现多个互相不兼容的资源分支。

4. **状态叠层没有容器。** 目前只有 `combo`、`chain`、`lastBurstTick` 这类专用字段，没有统一的 `statuses`。无法表达易伤、护盾、流血、力量、下回合抽牌、每回合开始触发等机制，也无法统一做层数衰减、回合清理和 UI 展示。

5. **回合触发不是一等事件。** 现有 `TurnEnded` 有事件，但敌人攻击、弃手牌、补位、发牌主要由 `end-turn` 分支直接串行执行。缺少 `TurnStarted`、`BeforeDiscardHand`、`AfterDrawHand`、`EnemyTurnStarted`、`RoundAdvanced` 等稳定 trigger 点，会限制遗物、状态、保留、回合开始抽牌等机制。

6. **内容配置会持续污染代码。** `rewardChoices.ts` 已经出现 fallback card id 集合，`redlineRules.ts` 也按卡牌字段写规则。继续扩展会让“卡牌内容”和“运行时引擎”纠缠，不利于复刻大量卡牌。

7. **重复卡与单卡实例风险。** 当前牌堆是 `CardId[]`，允许重复 id，但无法给单张实例记录升级、临时创建、费用变化、已保留次数等。短期可以继续用 `CardId[]`，但需要知道这是后续迁移点。

## 3. 建议的数据结构和事件流

### 3.1 最小效果描述

先不要引入脚本语言。用 TypeScript discriminated union 定义一组 JSON-compatible 的效果操作，让卡牌、状态、run modifier 都能复用。

```ts
type EffectTrigger =
  | 'on-play'
  | 'on-draw'
  | 'on-discard'
  | 'on-exhaust'
  | 'on-retain'
  | 'turn-start'
  | 'turn-end'
  | 'enemy-killed'
  | 'damage-applied';

type TargetQuery =
  | { kind: 'self' }
  | { kind: 'chosen-enemy'; required?: boolean }
  | { kind: 'front-enemy' }
  | { kind: 'front-row-enemies' }
  | { kind: 'all-enemies' }
  | { kind: 'all-allies' }
  | { kind: 'event-target' }
  | { kind: 'source' };

type AmountSpec =
  | { flat: number }
  | { cardDamage: true; scaleBy?: 'effectMultiplier' }
  | { resource: 'energy' | 'tempAuthorization'; multiplier?: number }
  | { statusStacks: string; target: TargetQuery; multiplier?: number };

type EffectOp =
  | { op: 'damage'; target: TargetQuery; amount: AmountSpec }
  | { op: 'draw'; count: AmountSpec }
  | { op: 'discard'; target: 'self' | 'chosen-hand-card' | 'random-hand-card'; count?: AmountSpec }
  | { op: 'retain'; target: 'self' | 'chosen-hand-card'; until: 'next-turn' | 'combat' }
  | { op: 'exhaust'; target: 'self' | 'chosen-hand-card' | 'discard-pile-card' }
  | { op: 'gain-resource'; resource: 'energy' | 'tempAuthorization'; amount: AmountSpec; lifetime: 'turn' | 'combat' | 'run'; restriction?: 'payoff-only' | 'attack-only' | 'skill-only' }
  | { op: 'apply-status'; target: TargetQuery; statusId: string; stacks: AmountSpec; duration?: 'turn' | 'combat' | 'run' }
  | { op: 'remove-status'; target: TargetQuery; statusId: string; stacks?: AmountSpec }
  | { op: 'emit'; eventType: string; payload?: Record<string, unknown> };

interface EffectSpec {
  id: string;
  trigger: EffectTrigger;
  conditions?: EffectCondition[];
  ops: EffectOp[];
  tags?: string[];
}
```

### 3.2 WorldState 最小扩展方向

短期继续保留 `CardId[]`，只补关键容器：

```ts
interface PlayerState {
  hand: CardId[];
  drawPile: CardId[];
  discardPile: CardId[];
  exhaustPile?: CardId[];
  retainedCards?: CardId[];
}

interface EntityRuntimeState {
  statuses: Record<string, { stacks: number; duration?: 'turn' | 'combat' | 'run'; sourceCardId?: CardId }>;
}

interface ResourcePool {
  energy: number;
  temp: Record<string, { amount: number; lifetime: 'turn' | 'combat' | 'run'; restriction?: string }>;
}
```

中期再从 `CardId[]` 迁移到 `CardInstanceId[]`。只有当出现“同名牌一张升级、一张未升级”“本回合费用变化只影响某一张”“复制牌战斗后消失”时，才值得做实例化。

### 3.3 推荐事件流

保留现有队列，只把卡牌效果结算抽出来：

1. `Intent(play-card)`：只做输入合法性、支付能力、目标合法性。
2. `Command(SpendEnergy)`：仍由 `applyCommand` 执行。
3. `Command(MoveCard)`：把“打出牌进入弃牌/消耗/保留/limbo”统一成可解释的移动命令，逐步替代 `DiscardPlayedCard`。
4. `Event(CardPlayed)`：携带 `cardId`、`sourceId`、`chosenTargetId`、`effectMultiplier`、支付来源。
5. ECA 的 `card.effects.on-play` 规则调用 `resolveEffects(card.effects, context)`。
6. 解释器将 `EffectOp` 解析为现有 Command：`DamageEnemy`、`DrawCards`、`GainEnergy`、`SetCombo`，以及新增的 `MoveCard`、`ApplyStatus`、`GainTempResource`。
7. `applyCommand` 执行 Command 并继续产生事件，例如 `DamageApplied`、`EnemyKilled`、`CardMoved`、`StatusApplied`。
8. ECA 继续消费二级事件，支持 `enemy-killed`、`turn-end`、`status-tick` 等触发。

### 3.4 关键机制怎么支持

- **抽牌**：保留 `DrawCards`，但让 `draw` 成为 `EffectOp`。`excludeFromReshuffle` 应从“CardPlayed 特例”升级为 `DrawPolicy`，例如 `excludeResolvingCard`、`allowReshuffle`。
- **弃牌**：新增 `MoveCard` 或 `DiscardCards`，支持 `self/chosen/random/all-hand`。不要把所有打出牌固定塞进弃牌堆。
- **保留**：在 `TurnEnded` 时先触发 `BeforeDiscardHand`，解释器标记 `retainedCards`，`DiscardHand` 只移动未保留牌。下回合 `DealHand` 前后清理保留标记。
- **消耗**：新增 `exhaustPile` 和 `ExhaustCard/MoveCard(to: 'exhaust')`。默认打出目的地可以由卡牌字段 `playDestination: 'discard' | 'exhaust' | 'retain'` 决定，也可以由效果覆盖。
- **临时资源**：把 `tempAuthorizationMP` 抽象为 `tempResources.authorization`，保留旧字段作为 UI mirror 一段时间。资源带 `lifetime` 和 `restriction`，支付时统一检查。
- **状态叠层**：给 player/enemy 都挂 `statuses` map。`ApplyStatus`、`RemoveStatus`、`TickStatusDuration` 统一处理；伤害、抽牌、资源等可通过 `AmountSpec.statusStacks` 读取层数。
- **敌我目标**：用 `TargetQuery` 统一目标解析。验证阶段和效果阶段必须使用同一个 resolver，避免 runtime 验证一套、ECA 执行另一套。
- **回合触发**：在现有 `end-turn` 串行流程中补稳定事件点：`TurnStarted`、`BeforeHandDiscarded`、`AfterHandDiscarded`、`EnemyTurnStarted`、`EnemyTurnEnded`、`RoundStarted`。不要一开始重排所有流程，只要先插入事件点。

## 4. 分阶段迁移方案

### Phase 0：冻结现有行为，补测试锚点

- 用现有 redline progression 测试覆盖：普通前排攻击、前排横扫、self 抽牌/回能、0-1-2 授权、payoff burst、end turn 敌人攻击与补位。
- 目标不是增加机制，而是给解释器替换前后的行为差异提供基线。

### Phase 1：引入 effect spec 类型和 legacy adapter

- 在类型层增加 `EffectSpec/EffectOp/TargetQuery/AmountSpec`。
- 不要求立刻改卡牌数据；先写 `legacyEffectsFromCard(card)`，把当前字段映射成效果：
  - `targets + damage` -> `damage`
  - `drawCards` -> `draw`
  - `energyGain` -> `gain-resource`
  - 当前 payoff 判断 -> 临时 adapter 规则
- `redlineRules.ts` 中先保留规则入口，但让 `CardPlayed` 的动作调用 `resolveCardEffects`，输出仍是当前 Command。这样最大限度不碰 UI、FSM、世界初始化。

### Phase 2：抽出 target resolver 和 payment/resource resolver

- 把 `front-enemy/front-row/all-enemies/self` 的选择与验证移到 `resolveTargets(world, query, event)`。
- 把 `tempAuthorizationMP` 的支付判断封装成 `canPayCost` / `spendCost`，先继续写回旧字段。
- 删除 runtime/ECA 双份 `isPayoffFinisher` 判断，改成卡牌效果或 `tags: ['payoff-finisher']`。

### Phase 3：牌区迁移，但仍用 CardId[]

- 新增 `exhaustPile`、`retainedCards`，新增 `MoveCard` 命令。
- `DiscardPlayedCard` 暂时降级成 `MoveCard(hand -> discard)` 的兼容包装。
- `DiscardHand` 改成只弃未保留牌。
- 消耗、保留、弃指定牌都先在 CardId 层支持；实例化延后。

### Phase 4：状态与回合触发

- 新增 entity statuses 容器与 `ApplyStatus/RemoveStatus/TickStatusDuration` 命令。
- 在当前 `end-turn` 和 `dealIntoPlayerTurn` 周围插入 trigger 事件，不重写流程。
- 让状态和卡牌共用解释器：状态定义也有 `effects: EffectSpec[]`，触发点为 `turn-start/turn-end/damage-applied/enemy-killed`。

### Phase 5：run modifier 接入运行时

- 把 `runModifiers.ts` 从 `preview-only` 拆成两层：
  - preview：仍用于结算界面展示。
  - runtime effect：可选地在 `run-start/combat-start/reward-generated` 触发。
- `maxEnergyThisRunPlusOne` 映射为 run lifetime resource/stat modifier；`startingRepairCard` 映射为 run start deck mutation；`rewardRerollPlusOne` 映射为 reward state modifier。

## 5. 本轮可落地的最小工程改动

本轮按任务要求不改源码。下一轮如果要落地，建议只做以下最小切口：

1. **新增效果类型，不改行为。** 增加 `EffectSpec/EffectOp/TargetQuery/AmountSpec` 类型，并给 `CardDefinition` 加可选 `effects?: EffectSpec[]`。所有旧卡仍走旧字段。

2. **新增 `legacyEffectsFromCard(card)`。** 把当前 `damage/drawCards/energyGain/targets` 映射成解释器输入。先不要要求内容表重写。

3. **新增 `resolveCardEffects(world, event, card)`。** 返回现有 Command，不直接改 `WorldState`。第一版只覆盖当前四类效果：单体伤害、前排伤害、全体 payoff 伤害、self 抽牌/回能。

4. **让 `redlineRules.ts` 的 `CardPlayed` 规则调用解释器。** 保留 ECA 入口和 `applyCommand`。先不要改 `tickWorld` 的整体流程，避免影响 end-turn、reward、enemy refill。

5. **补一个 target resolver。** 先只支持 `self/front-enemy/front-row/all-enemies`，但 validation 和 effect execution 共用它。这样后续加敌我目标不会继续复制条件。

6. **加 trace 字段。** 解释器产出的 Command 最好带 `effectId` 或在 debug trace 里记录 `effect:<cardId>/<effectId>/<op>`，方便排查“某张牌为什么触发两次”。

7. **暂不引入 CardInstanceId。** 先以 `CardId[]` 完成保留/消耗的最小牌区扩展设计；等升级、复制、临时卡真正进入范围，再迁移实例模型。

最低可验收标准：同一套现有卡牌测试通过；debug trace 能看出 `CardPlayed -> effect resolver -> Command -> Event`；新增一张“抽 1、获得 1 临时 MP、下回合开始失效”的测试卡时，不需要再改 `tickWorld` 主分支。

