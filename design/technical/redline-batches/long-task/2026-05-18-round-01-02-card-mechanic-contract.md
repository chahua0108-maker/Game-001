# 2026-05-18 Round 01 Expert 02：卡牌机制复刻契约

## 0. 审查边界

- 工作目录：`/Users/roc/Game-001`
- 本轮角色：卡牌机制复刻负责人
- 本文目标：建立“完整卡牌游戏机制复刻”的机制契约。这里的复刻只指机制结构、资源压力、发牌循环、目标/触发/状态/升级/负面牌等系统覆盖，不复制第三方卡名、原文文本、美术或具体商业表达。
- 只读审查文件：
  - `prototype-web/src/data/cards.ts`
  - `prototype-web/src/sim/types.ts`
  - `prototype-web/src/sim/runtime.ts`
  - `prototype-web/src/sim/rewardChoices.ts`
  - 辅助核对：`prototype-web/src/eca/redlineRules.ts`、`prototype-web/src/sim/world.ts`、相关 sim 测试与现有 redline 批次文档
- 本轮不改源码、不提交 git。本文只定义后续实现应遵守的契约。

一句话结论：当前 prototype 已经跑通“4 张手牌、当前 MP、抽牌堆/弃牌堆、费用升序链、Wild 修补、0->1->2 授权、3 费 payoff、奖励三选一”的 Redline P0 核心，但还不是完整卡牌 roguelike 机制底座。要向完整机制复刻靠拢，下一步必须先补“卡牌实例 + 生命周期区”与“数据驱动效果/触发/状态层”，否则消耗、保留、升级、诅咒、状态牌都会继续被硬编码或无法表达。

## 1. 已覆盖机制清单

| 机制 | 当前覆盖 | 证据与边界 |
| --- | --- | --- |
| 卡牌定义表 | 已有 16 张卡，字段包含 `id/name/cost/verb/damage/comboNode/description/targets/cardType/chainRole/cycleRole/buildRole/availability/drawCards/energyGain/utilities`。 | `cards.ts` 与 `CardDefinition` 已能表达基础费用、目标、伤害、抽牌、返费、Wild、reorder 标签。 |
| 初始牌组与奖励池 | `startingHand` 固定 4 张；`rewardCardPool` 包含 11 张奖励候选。 | 已支持起手牌、奖励牌、保留测试牌的基本分层，但牌组元素仍只是 `CardId`，没有单张卡实例。 |
| 回合发牌 | `HAND_SIZE = 4`；进入玩家回合时从 `drawPile` 抽入 `hand`；空抽牌堆时把 `discardPile` 洗回。 | 已有 draw/hand/discard 三堆循环；当前没有随机种子洗牌、手牌上限、保留手牌或消耗堆。 |
| 出牌验证 | 校验玩家回合、卡在手牌、支付资源足够、目标合法。 | `play-card` intent 可防止非玩家回合出牌、重复出同一张、死目标、后排目标等非法操作。 |
| 当前 MP 资源 | `energy/maxEnergy` 初始 3；发牌进入玩家回合时恢复到 `maxEnergy`；`GainEnergy` 只加当前 MP。 | 已避免把 P0 设计误写成永久 Max MP 成长。 |
| 临时授权资源 | 完成未断裂 `0 -> 1 -> 2` 后，获得 `tempAuthorizationMP += 3`，限制为 `payoff-only`，结束回合清空。 | 已覆盖“临时授权支付 3 费 payoff”的核心资源结构。 |
| 费用升序链 | `ChainState` 记录 `playedCosts/lastCost/nextExpectedCost/multiplier/broken/breakReason/repairedThisTurn`。 | 第一张期望 0，后续期望递增；断链后倍率回 1。 |
| Wild 修补 | `utilities` 含 `wild` 且链已开始时，按当前 `nextExpectedCost` 计入链，产生 `ChainRepaired`。 | 目前 Wild 修补的是链路记录，不是支付成本；这点需要在字段合同里显式化。 |
| 效果倍率 | `CardPlayed.effectMultiplier` 来自链路倍率，伤害与抽牌可乘倍率。 | 伤害和 `drawCards` 会被放大；`energyGain` 当前不乘倍率。 |
| 基础目标 | 支持 `front-enemy`、`front-row`、`all-enemies`、`self`。 | ECA 规则按目标类型分流：单体、前排、全体、自身资源。 |
| 基础攻击与 AOE | 前排单体、前排范围、全体敌人伤害均已实现。 | `DamageEnemy`、`DamageApplied`、`EnemyKilled` 事件完整。 |
| 自身资源牌 | self 牌可抽牌、返当前 MP。 | 已能支撑抽牌修补与当前 MP 延长，但没有弃牌过滤、检索、重排运行时。 |
| payoff 牌 | 当前 full payoff 是 `cost = 3`、`targets = all-enemies`、`comboNode = burst` 的全场终结牌。 | 会产生 `PayoffTriggered`、`ClearBurstRequested`、`PayoffResolved`，并记录击杀与 prevented intent damage。 |
| 敌人意图 | 发牌时快照当前前排攻击者；结束回合只结算这批意图；清掉有意图敌人可降低后续伤害。 | 已具备常见 card roguelike 的“先读意图再规划出牌”基础。 |
| 奖励三选一 | `buildRewardChoices` 按 `repair-resource`、`payoff`、`route-bridge` 优先抽取分支。 | 已不是简单取前三张；但分支字段还未正式纳入 `CardDefinition`。 |
| 当前 run 内成长 | 升级奖励选牌后加入当前 deck/drawPile；`restart-run` 重置到起始牌组。 | 已明确是 run 内牌组成长，不是局外永久成长。 |
| 事件/命令管线 | `Intent -> GameEvent -> Rule -> Command -> GameEvent` 已成形。 | 这是扩展触发、状态、生命周期的正确基础；下一步应扩展而不是绕开。 |
| 调试追踪 | `debug.events/commands/failedConditions/ruleHits/trace` 可追踪核心行为。 | 后续机制必须继续发结构化事件，避免 UI/QA 自己猜规则。 |

## 2. 缺失机制清单

| 缺失机制 | 当前问题 | 为什么影响“完整卡牌机制复刻” | 建议优先级 |
| --- | --- | --- | --- |
| 卡牌实例 ID | deck/hand/draw/discard 都是 `CardId[]`。 | 无法区分同名卡的升级、临时费用、复制、诅咒来源、一次性修改。 | P0 |
| 消耗 / exhaust | 所有已打出的牌都会进入 `discardPile`。 | 不能表达一次性强牌、战斗内移出循环、状态牌回合末消失等基础机制。 | P0 |
| 保留 / retain | 结束回合统一 `DiscardHand`，没有保留手牌。 | 不能表达“下回合准备 payoff / 修补牌”的手牌规划，也无法做保留资源压力。 | P0 |
| 状态牌 | `CardType` 有 `status`，但没有真实状态牌、注入源、抽到/回合末效果。 | 缺少“敌人/代价污染抽牌循环”的关键压力。 | P0 |
| 诅咒 / 长期负面牌 | 没有 `curse` 类型，没有跨战斗或 run 内长期负面牌。 | 高收益奖励、事件代价、构筑风险无法成立。 | P1 |
| 升级 | 没有 upgraded 实例、`upgradesTo`、数值 delta 或升级选择。 | 常见 roguelike 的卡牌成长无法表达，同名卡不同版本也无法共存。 | P0 |
| 防御 / 格挡 | 玩家只有 hp，没有 block/armor/ward 等回合防御资源。 | 目前防御敌意图只能靠杀敌，少了“承压但不击杀”的卡牌空间。 | P1 |
| 实体状态 / buff / debuff | 没有 strength、weak、vulnerable、poison、mark、shield 等可叠加状态层。 | `comboNode = mark` 只是标签，无法支持标记、减伤、持续伤害、易伤等常见机制。 | P0 |
| 数据驱动效果列表 | `CardDefinition` 只有 `damage/drawCards/energyGain`，复杂效果写在 ECA 规则里。 | 每加一种机制都要改规则分支，卡牌数据不能 1:1 表达机制。 | P0 |
| 触发器 | 没有 `onDraw/onPlay/onDiscard/onExhaust/onRetain/onTurnStart/onTurnEnd/onKill` 等触发。 | 状态牌、能力牌、诅咒牌、连锁奖励、击杀返费都缺基础挂点。 | P0 |
| 弃牌作为成本/效果 | 没有选择弃牌、随机弃牌、弃后抽、弃牌触发。 | 缺少手牌过滤、风险支付、状态牌处理等经典决策。 | P1 |
| 重排 / scry / 预视 | `utilities: ['reorder']` 只是标签，没有实际命令或事件。 | 玩家不能控制抽牌顶，也不能证明“重排”类卡的价值。 | P1 |
| 动态费用 | 没有本回合降费、下一张降费、X 费、按状态改费。 | 长回合、combo、payoff 支付和资源牌空间受限。 | P1 |
| 多模式卡牌 | 没有 mode/choice 字段，`play-card` intent 只带 cardId/targetId。 | 不能表达“二选一效果”“升级后选择分支”“目标和模式同时选择”。 | P1 |
| 更完整目标系统 | 目标只有四种硬编码目标。 | 缺少任意敌人、随机敌人、列/行、最弱/最强、多个目标、无目标全局效果。 | P1 |
| 召唤 / 单位 / 站场 | 没有 ally/summon/slot ownership。 | 这是 P2 生态，不该先做，但合同需要预留类型边界。 | P2 |
| 能力 / power | 没有打出后常驻规则改写。 | 长期 build 身份、被动连锁、每回合触发无法表达。 | P1 |
| 卡牌创建 / 复制 / 转化 / 移除 | 没有运行时创建临时卡、复制卡、变形卡、删牌命令。 | 很多 roguelike 的“临时牌”“牌库净化”“强奖励代价”无法实现。 | P1 |
| 奖励权重与稀有度 | 当前按分支优先找第一张候选，缺 rarity/weight/archetype/seen history。 | 长期构筑的选择质量、重复控制和路线支持不足。 | P1 |
| 随机与可复现 seed | 抽牌/奖励选择目前偏确定性，缺统一 RNG seed。 | QA 需要复现，玩法需要随机；两者应由 seeded RNG 同时满足。 | P1 |
| 牌文本本地化与规则文本分离 | `description` 同时承担展示与机制解释。 | 后续不能让 UI/QA 从自然语言里推断规则，必须由结构化字段驱动。 | P1 |

## 3. 建议的 CardDefinition 字段契约

### 3.1 核心原则

1. 卡牌定义只描述“这类卡的基础规则”，单张卡的运行时变化放到 `CardInstance`。
2. 效果必须结构化，UI/QA 不再从 `description`、`comboNode`、费用和目标组合猜机制。
3. 生命周期必须是一等字段：打出后去 discard、exhaust、destroy，回合末是否 retain，抽到后是否 ethereal，战斗结束是否 purge。
4. payoff、Wild、授权、状态、诅咒都应有显式标签，不能只靠 `cost/targets/comboNode` 推断。
5. 所有会影响体验或验收的机制都必须产生事件。

### 3.2 推荐类型草案

```ts
type CardType =
  | 'attack'
  | 'skill'
  | 'resource'
  | 'defense'
  | 'draw'
  | 'repair'
  | 'payoff'
  | 'power'
  | 'status'
  | 'curse';

type CardTag =
  | 'chain-starter'
  | 'chain-bridge'
  | 'chain-expand'
  | 'wild'
  | 'draw'
  | 'mana'
  | 'reorder'
  | 'exhaust'
  | 'retain'
  | 'ethereal'
  | 'temporary'
  | 'block'
  | 'debuff'
  | 'status-injector'
  | 'curse'
  | 'payoff'
  | 'unarmed-penalty'
  | 'upgrade-target';

interface CardDefinition {
  id: CardId;
  name: string;
  textKey?: string;
  description: string;

  type: CardType;
  tags: CardTag[];
  rarity?: 'basic' | 'common' | 'uncommon' | 'rare' | 'special';
  availability: 'starting' | 'reward' | 'event' | 'enemy-generated' | 'reserved';

  cost: {
    base: number;
    resource: 'mp' | 'authorization' | 'hp' | 'none';
    variable?: boolean;
    canUseAuthorization?: boolean;
    authorizationRestriction?: 'payoff-only' | 'repair-only' | 'expected-cost-only';
  };

  target: TargetSpec;
  lifecycle: CardLifecycleSpec;
  chain?: ChainSpec;
  reward?: RewardSpec;
  effects: EffectSpec[];
  triggers?: TriggerSpec[];
  upgrade?: UpgradeSpec;
}
```

### 3.3 推荐子结构

```ts
interface TargetSpec {
  kind:
    | 'none'
    | 'self'
    | 'front-enemy'
    | 'any-enemy'
    | 'front-row'
    | 'all-enemies'
    | 'random-enemy'
    | 'row'
    | 'column'
    | 'card-in-hand'
    | 'card-in-discard'
    | 'card-in-draw-pile';
  count?: number;
  required?: boolean;
  filters?: Array<'alive' | 'has-intent' | 'damaged' | 'status-bearing' | 'payoff-card' | 'status-card' | 'curse-card'>;
}

interface CardLifecycleSpec {
  onPlay: 'discard' | 'exhaust' | 'destroy' | 'stay-in-play';
  onTurnEnd: 'discard' | 'retain' | 'exhaust' | 'destroy';
  exhausts?: boolean;
  retain?: boolean;
  ethereal?: boolean;
  temporary?: boolean;
  purgeAtCombatEnd?: boolean;
}

interface ChainSpec {
  role: 'starter' | 'bridge' | 'expand' | 'repair' | 'payoff' | 'deadweight';
  printedNode?: number;
  countsAsExpectedCost?: boolean;
  wildMode?: 'none' | 'expected-cost' | 'previous-cost' | 'chosen-cost';
  grantsAuthorization?: {
    amount: number;
    when: 'completed-0-1-2' | 'chain-length-at-least';
    restriction: 'payoff-only' | 'repair-only' | 'expected-cost-only';
  };
  payoffRequirement?: {
    armedBy: 'authorization' | 'chain-length' | 'last-cost' | 'status';
    minChainLength?: number;
    requiredLastCost?: number;
  };
}

interface RewardSpec {
  branch: 'consistency' | 'resource' | 'ceiling' | 'defense' | 'risk' | 'cleanse';
  archetypes?: string[];
  weight?: number;
  maxCopies?: number;
}

interface UpgradeSpec {
  upgradesTo?: CardId;
  choices?: CardId[];
  deltas?: EffectDelta[];
}
```

### 3.4 效果契约

当前 `damage/drawCards/energyGain` 可以保留为迁移期快捷字段，但最终应收敛到 `effects`：

```ts
type EffectSpec =
  | { type: 'damage'; amount: number; scaling?: 'chain-multiplier' | 'none'; target: TargetSpec }
  | { type: 'gain-block'; amount: number; scaling?: 'chain-multiplier' | 'none' }
  | { type: 'draw'; count: number; scaling?: 'chain-multiplier' | 'none' }
  | { type: 'gain-resource'; resource: 'mp' | 'authorization' | 'repair-reserve'; amount: number }
  | { type: 'apply-status'; statusId: string; stacks: number; target: TargetSpec; duration?: number }
  | { type: 'add-card'; cardId: CardId; destination: 'hand' | 'draw-pile' | 'discard-pile'; temporary?: boolean }
  | { type: 'discard-cards'; count: number; selection: 'player-choice' | 'random' | 'all' }
  | { type: 'exhaust-cards'; count: number; selection: 'player-choice' | 'random' | 'self' }
  | { type: 'retain-card'; selection: 'self' | 'player-choice' }
  | { type: 'scry'; count: number }
  | { type: 'modify-cost'; amount: number; duration: 'this-turn' | 'next-play' | 'combat'; filter?: TargetSpec }
  | { type: 'upgrade-card'; selection: 'self' | 'player-choice' | 'random' }
  | { type: 'cleanse'; removes: 'status' | 'curse' | 'debuff'; count: number };
```

## 4. 事件与命令契约

### 4.1 状态结构补充

建议在现有 `WorldState.player` 基础上新增：

```ts
interface PlayerState {
  deck: CardInstanceId[];
  hand: CardInstanceId[];
  drawPile: CardInstanceId[];
  discardPile: CardInstanceId[];
  exhaustPile: CardInstanceId[];
  retained: CardInstanceId[];
  block: number;
  statuses: StatusInstance[];
}

interface CardInstance {
  instanceId: CardInstanceId;
  definitionId: CardId;
  upgraded: boolean;
  temporary: boolean;
  exhausted: boolean;
  costForTurn?: number;
  createdBy?: CardId | 'enemy' | 'reward' | 'event';
  modifiers: CardModifier[];
}
```

迁移策略：第一步可以保留 `CardId[]`，但新增 helper 层统一读写；进入升级/消耗/诅咒前必须切到 `CardInstanceId[]`。

### 4.2 推荐命令

| 命令 | 用途 |
| --- | --- |
| `MoveCard` | 统一处理 draw/hand/discard/exhaust/retained/destroyed 之间移动，替代分散 push/splice。 |
| `DrawCards` | 抽牌，产生逐张 `CardDrawn`，支持 seeded shuffle 与 exclude。 |
| `DiscardCards` | 弃手牌、弃指定牌、弃随机牌，支持作为成本和效果。 |
| `ExhaustCard` / `ExhaustCards` | 把牌移入消耗堆，并触发消耗事件。 |
| `RetainCard` / `RetainCards` | 将牌标记为回合末保留，或移入 retained 区。 |
| `CreateCard` | 临时牌、状态牌、诅咒牌、复制牌进入指定区域。 |
| `UpgradeCard` | 升级指定实例，不影响同名未升级实例。 |
| `ApplyStatus` | 给玩家或敌人施加可叠加、可过期状态。 |
| `RemoveStatus` | 清除 buff/debuff/status/curse 关联效果。 |
| `ModifyCardCost` | 本回合、下一次打出、整场战斗的费用修改。 |
| `ResolveTrigger` | 统一结算 onDraw/onDiscard/onExhaust/onTurnStart 等触发器。 |
| `GainBlock` / `LoseBlock` | 防御资源变化，不混入 hp。 |
| `ShufflePile` / `ScryCards` | 支持重排、预视、可复现随机。 |

### 4.3 推荐事件

| 事件 | 必带字段 | 用途 |
| --- | --- | --- |
| `CardDrawn` | `instanceId/cardId/fromPile/toHand` | 替代把普通抽牌伪装成 `HandDealt`。 |
| `CardMoved` | `instanceId/cardId/from/to/reason` | 所有生命周期移动的基础证据。 |
| `CardDiscarded` | `instanceId/cardId/source/reason` | 弃牌成本、回合末弃牌、状态牌污染都可追踪。 |
| `CardExhausted` | `instanceId/cardId/source/reason` | 消耗牌、一次性牌、ethereal 牌必须可见。 |
| `CardRetained` | `instanceId/cardId/reason` | 保留机制与 UI 提示依据。 |
| `CardCreated` | `instanceId/cardId/destination/createdBy/temporary` | 状态牌、诅咒牌、复制牌进入循环。 |
| `CardUpgraded` | `instanceId/fromCardId/toCardId/source` | 升级应绑定实例而不是全局定义。 |
| `TriggerQueued` / `TriggerResolved` | `triggerId/source/timing` | 能力牌、状态牌、诅咒牌的触发审计。 |
| `StatusApplied` | `targetId/statusId/stacks/duration/source` | buff/debuff/mark/poison 等统一入口。 |
| `StatusTicked` / `StatusExpired` | `targetId/statusId/stacksRemaining` | 回合开始/结束状态变化。 |
| `ResourceChanged` | `resource/before/after/delta/source/restriction` | MP、authorization、repair reserve、block 的统一证据。 |
| `BlockGained` / `BlockLost` | `amount/source/remainingBlock` | 防御结算不要混入普通 hp 伤害。 |
| `CurseAdded` | `cardId/instanceId/source/persistent` | 诅咒来源与是否跨战斗。 |
| `LifecycleResolved` | `instanceId/cardId/onPlay/onTurnEnd/result` | 确保消耗、弃牌、保留行为不靠 UI 猜。 |

### 4.4 触发时点

后续扩展必须先统一时点命名：

```text
combat-start
turn-start
hand-dealt
card-drawn
before-card-play
after-card-play
damage-requested
damage-applied
enemy-killed
card-discarded
card-exhausted
turn-end
combat-end
reward-offered
reward-selected
```

所有触发器要遵守同一队列，避免在 ECA action 里直接递归修改世界状态。

## 5. 至少 10 种卡牌类型或机制标签

| 类型 / 标签 | P0/P1/P2 | 契约定义 | 当前状态 |
| --- | --- | --- | --- |
| `attack` | P0 | 直接造成伤害，可参与费用链。 | 已有。 |
| `skill` | P0 | 非主要伤害行动，如防御、过滤、修补、减意图。 | 类型有，实际牌未充分使用。 |
| `resource` | P0 | 产生当前 MP、临时授权、修补储备或费用折扣。 | 类型有，实际多靠 `repair` + `energyGain`。 |
| `draw` | P0 | 抽牌、检索、过滤、重抽。 | 已有抽牌，缺检索/过滤/重排。 |
| `repair` / `wild` | P0 | 填补费用链缺口或视为 expected cost。 | 已有 Wild 修补。 |
| `payoff` | P0 | 需要前置条件才强的大结算牌。 | 已有 full payoff，但 unarmed 降档不足。 |
| `defense` / `block` | P1 | 获得格挡、护盾、减伤，处理意图但不必杀敌。 | 缺失。 |
| `status` | P0 | 战斗内临时污染牌或状态效果，通常来自敌人/代价。 | 类型有，实际缺失。 |
| `curse` | P1 | run 内或跨战斗长期负面牌，常作为高收益代价。 | 缺失。 |
| `exhaust` | P0 | 打出或回合末进入消耗堆，离开本场循环。 | 缺失。 |
| `retain` | P0 | 回合末保留在手牌，支持计划下回合。 | 缺失。 |
| `ethereal` | P1 | 回合末未打出则消耗。 | 缺失。 |
| `temporary` | P1 | 战斗结束或离开区域时移除，不进入长期 deck。 | 缺失。 |
| `power` | P1 | 打出后常驻，改写后续规则。 | 缺失。 |
| `debuff` | P0 | 施加给敌人的弱化、易伤、标记、持续伤害。 | 缺失，`mark` 目前只是语义。 |
| `discard-synergy` | P1 | 弃牌作为成本或触发收益。 | 缺失。 |
| `cost-modifier` | P1 | 临时降费、升费、X 费、下一张牌费用变化。 | 缺失。 |
| `upgrade-target` | P0 | 可被升级、可生成升级实例。 | 缺失。 |
| `status-injector` | P0 | 向抽牌堆/弃牌堆/手牌加入状态牌。 | 缺失。 |
| `cleanse` | P1 | 移除状态牌、诅咒牌或负面状态。 | 缺失。 |

## 6. 本轮最该先补的 3 个机制

### 1. 卡牌实例与生命周期区

优先级：P0，最高。

必须先做这个，因为消耗、保留、升级、诅咒、临时牌都依赖“单张卡实例”。如果继续用 `CardId[]`，后面任何升级或临时费用都会污染同名卡全局定义。

最小验收：

- 有 `CardInstance` 或等价结构。
- 至少有 `exhaustPile` 和 `retained` 状态。
- 打出一张带 `exhaust` 标签的牌后，事件链包含 `CardMoved -> CardExhausted`，该实例不进入 discard。
- 回合末一张带 `retain` 标签的牌仍在下回合手牌或 retained 区，事件链包含 `CardRetained`。
- 现有 16 张卡在未声明 lifecycle 时默认 `onPlay = discard`、`onTurnEnd = discard`，保持当前行为。

### 2. 数据驱动效果与触发队列

优先级：P0。

当前 `redlineRules.ts` 还能支撑 P0，但如果要覆盖状态、诅咒、升级、弃牌、保留、消耗，不能继续靠 `targets` 分四类硬编码。应把卡牌效果迁移为 `effects[]`，把触发迁移为统一 `triggers[]` 和 `ResolveTrigger`。

最小验收：

- 新卡不需要新增一条专属 ECA 规则即可表达：伤害、抽牌、返费、格挡、加状态、消耗自身。
- `CardPlayed` 后按 `effects[]` 产生结构化 commands。
- 至少支持 `onDraw`、`onPlay`、`onDiscard`、`onExhaust`、`turn-end` 五个触发时点。
- UI 和 QA 通过事件判断效果，不读取中文 description 推断规则。

### 3. 状态 / 诅咒 / 升级的最小闭环

优先级：P0 到 P1 之间；本轮应先定义并做最小可跑版本。

原因：完整卡牌 roguelike 的“抽牌循环压力”不只来自费用，还来自坏牌、负面状态和卡牌成长。Redline 现在已经有奖励与费用链，下一步需要让敌人或强牌代价能污染循环，同时让玩家有升级/净化/保留的长期选择。

最小验收：

- 状态牌：敌人或卡牌能向 discard/drawPile 加入一张状态牌；抽到时占手牌，回合末按 lifecycle 进入 discard 或 exhaust。
- 诅咒牌：奖励或事件能加入一张长期负面牌；run 内不会被普通战斗结束自动清除。
- 升级：至少一张现有卡能生成 upgraded 实例，升级后只影响该实例的 cost/effect/lifecycle 之一。
- 所有三者都有事件：`CardCreated`、`CurseAdded`、`CardUpgraded` 或等价事件。

## 7. 结论

当前代码已经有一个可扩展的 sim/event/debug 骨架，且 Redline 的 0->1->2 授权与 3 费 payoff 方向已经成立。下一步不要先扩更多普通攻击牌，也不要先做局外系统。正确顺序是：

1. 先把 `CardId[]` 升级为可承载单张状态的实例模型。
2. 再把卡牌效果、生命周期、触发器变成结构化数据。
3. 最后用状态牌、诅咒牌、升级牌证明抽牌循环与奖励成长真的成立。

做到这三点后，才有资格说 prototype 的机制结构开始覆盖常见卡牌 roguelike，而不是只覆盖了一个有牌面的费用链 demo。
