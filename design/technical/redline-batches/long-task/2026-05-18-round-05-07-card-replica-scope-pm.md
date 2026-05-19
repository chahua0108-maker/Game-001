# 2026-05-18 Round 05 Expert 07：卡牌复刻机制边界 PM

## 0. 审查边界

- 工作目录：`/Users/roc/Game-001`
- 角色：第 5 轮专家 07，卡牌复刻机制边界 PM
- 任务：第 5 轮开放抽牌修补牌时，划清“真实卡牌复刻进展”和“不应混入机制”的边界。
- 写入边界：只新增本文档；不修改源码、不回滚或覆盖他人改动。

读取依据：

- `design/technical/redline-batches/long-task/2026-05-18-round-04-06-card-mechanic-replica-checklist.md`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/sim/world.ts`
- `prototype-web/src/sim/rewardChoices.ts`
- `prototype-web/src/sim/runModifiers.ts`
- `prototype-web/src/data/cards.ts`
- `prototype-web/src/eca/redlineRules.ts`
- `prototype-web/src/tests/sim/card-taxonomy.test.ts`
- `prototype-web/src/tests/sim/reward-branching.test.ts`
- `prototype-web/src/tests/sim/run-layer-boundary.test.ts`

## 1. PM 结论

第 5 轮如果要开放抽牌修补牌，应把它定义为“把已有抽牌 / 奖励 / 当前 run 加卡系统推向更像卡牌 roguelike 的构筑一致性工具”，而不是启动完整卡牌生命周期系统。

可以算真实复刻进展的是：

1. `blood_tithe` / `pulse_draw` 从 `reserve-test` 进入正式奖励候选的边界决策。
2. 抽牌修补牌稳定归入 `repair-resource`，`pulse_draw` 可同时保留 `route-bridge` 身份，但不能漂移成 payoff。
3. 奖励池仍按 `repair-resource -> payoff -> route-bridge` 给玩家三类选择，而不是只把更多牌塞进池子。
4. 抽牌倍率文案和验收承认当前规则：self draw 牌的实际抽牌数是 `drawCards * effectMultiplier`。
5. 选择奖励后只加入当前 run 的 `deck/drawPile`，restart 回到基础牌组，不伪装成局外成长。

不应混入的是：

- `exhaust` / 消耗堆
- `retain` / 保留到下回合
- 物理 `status` card
- 敌我实体 buff / debuff `status`
- `CardInstanceId` / 单卡实例迁移
- 升级、复制、临时牌、诅咒、遗物、局外成长、通用触发器

这些不是“开放抽牌修补牌”的必要条件。它们是第 4 轮清单里的 P0/P1/P2/P3 后续机制，不能借第 5 轮的 reward 小切口倒灌进 runtime。

## 2. 什么算真实卡牌复刻进展

### 2.1 正式开放抽牌修补牌

`blood_tithe` 和 `pulse_draw` 不是空概念。源码里它们已经有完整 `CardDefinition`，包括 `cardType: 'draw'`、`targets: 'self'`、`drawCards: 1`、`utilities: ['draw']` 和明确的 `rewardBranches`。

第 5 轮可以把开放它们视为真实卡牌复刻进展，原因是卡牌 roguelike 的构筑不是只有伤害牌和终结牌，还需要“找关键段 / 修坏手 / 稳定路线”的过牌工具。当前系统已经有抽牌堆、手牌、弃牌堆、回填、奖励三选一和当前 run 加卡；开放抽牌修补牌是在这些已存在机制上补一个真实构筑功能。

PM 边界：

| 项 | 第 5 轮允许 | 不允许顺手扩大 |
| --- | --- | --- |
| `blood_tithe` | 作为 0 MP self draw，定位为开链找牌 / 坏手修补。 | 不进起始牌组；不加生命代价；不做诅咒或净化联动。 |
| `pulse_draw` | 作为 1 MP self draw，定位为接链找 2 MP 或 payoff。 | 不把它做成新资源系统；不改成永久抽牌倍率成长。 |
| `rewardBranches` | 保持显式合同，`blood_tithe = repair-resource`，`pulse_draw = repair-resource + route-bridge`。 | 不靠 `availability`、`chainRole`、`buildRole` 临时推导奖励身份。 |
| `rewardCardPool` | 可以把它们加入正式奖励池，并调整排序让三选一更清楚。 | 不把 reserve 牌直接塞入池中又保留 `availability: reserve-test`。 |

### 2.2 抽牌倍率属于本轮必须讲清的真实规则

`redlineRules.ts` 里 self card 的 `DrawCards` 数量来自 `card.drawCards * event.effectMultiplier`。因此：

- `blood_tithe` 第一张打出通常抽 1。
- `pulse_draw` 接在 0 MP 后，`effectMultiplier = 2`，真实请求抽 2。
- `paper_shatter`、`lantern_captain` 这类 2 MP 抽牌牌，如果在完整链路后打出，也可能出现抽牌数和卡面“抽1”不一致的读法。

这算卡牌复刻进展，因为它把“费用链倍率影响效果”变成玩家能理解的卡牌规则。但第 5 轮只需要修文案和验收，不需要重做效果解释器。

PM 边界：

- 可以改短文案 / HUD 展示，让玩家知道“抽1”会被链路倍率放大。
- 可以加测试确认 `pulse_draw` 在 0 后真实抽 2。
- 不要把倍率抽牌改成一个新的 keyword 系统。
- 不要为了文案一致性取消当前倍率规则，除非另开平衡裁决。

### 2.3 奖励分支稳定性属于真实复刻进展

当前 `buildRewardChoices` 已经按 `repair-resource -> payoff -> route-bridge` 取牌。第 5 轮开放抽牌修补牌时，真正要保护的是“玩家每次奖励都看到不同构筑功能”，而不是单纯增加牌池数量。

允许范围：

- 继续要求 `rewardCardPool` 内每张牌都有显式 `rewardBranches`。
- 继续要求 `rewardCardPool` 不包含 `availability: reserve-test` 的牌。
- 确保 `blood_tithe` / `pulse_draw` 开放后不会把 repair 槽挤成 route 槽。
- 如果两张都开放，确保 repair 后备不会在拿走 `wild_mana_stitch` / `wild_gap_key` 后过早断档。

不允许范围：

- 不把奖励系统改成动态推荐系统。
- 不根据上一手缺什么自动生成 reward reason。
- 不做 reroll、商店、删牌、地图节点。
- 不接 `runModifiers.ts` 的 preview-only 草案。

### 2.4 当前 run 加卡是边界，不是局外成长

源码中 `AddCardToDeck` 会把选择的奖励加入 `player.deck` 并放到 `drawPile` 顶部；`restart-run` 会重新 `createInitialWorld`，回到基础 `startingHand` 和 `maxEnergy = 3`。

第 5 轮可以继续强化“当前 run 构筑”：

- 选到 `blood_tithe` / `pulse_draw` 后，本 run 后续手牌能看到它们。
- 奖励历史可以记录它们。
- 下一轮抽牌能证明它们参与当前 run 的 deck loop。

但不能把它们写成：

- 默认起始牌组变化
- 永久解锁
- Max MP 成长
- settlement-growth runtime 生效
- meta progression 存档

## 3. 什么不应混入第 5 轮

### 3.1 `exhaust`：不做

第 4 轮清单把消耗列为 P0 后续机制，但当前源码没有：

- `exhaustPile`
- `lifecycle.onPlay`
- `CardExhausted`
- 消耗触发
- 打出后不回洗的通用规则

第 5 轮开放抽牌修补牌不需要它。`blood_tithe`、`pulse_draw`、`wild_mana_stitch` 当前都应继续沿用“打出后进弃牌堆”的规则。不要因为想让抽牌更像完整卡牌游戏，就顺手加 `exhaustPile`。

允许留下的只有文字边界：如果某些 keywords 里已有“消耗”，那只是未来词汇表，不代表本轮机制已实装。

### 3.2 `retain`：不做

当前回合末 `DiscardHand` 会把手牌全部进入 `discardPile`，没有：

- `retainedCards`
- 保留牌优先回到下一手
- `CardRetained`
- 保留 UI
- 保留次数或保留后降费

第 5 轮不应为了“抽牌修补坏手”引入保留。坏手修补在本轮只通过“奖励池多给 self draw / draw-fixer”完成，不通过跨回合保牌完成。

### 3.3 物理 `status` card：不做

`CardType` 已允许 `status`，`CardKeyword` 也有“状态 / 过载 / 净化”，但当前卡表没有真实 status card，runtime 也没有状态牌注入、状态牌生命周期或清理规则。

第 5 轮不应新增“迟滞文件”之类污染牌，不应做敌人塞牌，不应做抽到状态牌的惩罚。那是 P0 第二刀的物理污染牌循环，不是开放抽牌修补牌的依赖。

### 3.4 实体 `status` / buff / debuff：不做

当前 `EnemyState` 和 `PlayerState` 没有 `statuses` 容器。`comboNode: 'mark'` 只是卡牌路线标签，不是易伤、虚弱、护盾、标记、流血等实体状态。

第 5 轮不应把 `pulse_draw`、`paper_shatter` 或 `verdict_mark` 接到实体 status 系统。抽牌修补牌只解决手牌流动，不解决 buff/debuff 生态。

### 3.5 `CardInstanceId`：不做

当前所有 pile 都是 `CardId[]`：

- `deck: CardId[]`
- `hand: CardId[]`
- `drawPile: CardId[]`
- `discardPile: CardId[]`

打牌时也是按 `cardId` 从手牌里移除第一张匹配牌。第 5 轮不应做 `CardInstanceStore`、`CardInstanceId[]` pile、实例事件兼容、临时费用、复制体来源或同名差异。

这条边界很关键：开放 `blood_tithe` / `pulse_draw` 只需要定义级 card id 和 reward pool，不需要实例层。`CardInstance` 是升级、复制、临时牌、单张 modifier 的前置，属于 P2，不属于本轮。

### 3.6 升级、诅咒、遗物、触发器：不做

这些都是真实卡牌 roguelike 机制，但不是本轮目标：

| 机制 | 为什么不混入 |
| --- | --- |
| 升级 | 没有 `upgraded`、`upgradesTo`、实例层；会牵动 reward 类型和同名牌差异。 |
| 诅咒 | 需要 `curse` 类型、负面牌生命周期和净化入口；不是抽牌修补牌开放条件。 |
| 遗物 | 依赖触发器系统和 relic inventory；不能用 HUD 或 run modifier 草案假装。 |
| 通用触发器 | `onDraw/onDiscard/onExhaust/onRetain/onShuffle` 都未建立；本轮只用现有 `CardPlayed -> DrawCards`。 |
| 目标扩展 | 抽牌修补牌是 `self`，不需要 `TargetSpec` 迁移。 |
| 真实 reorder | `utilities: ['reorder']` 当前是标签 / 文案，不要在本轮做牌堆预视或重排。 |

## 4. 第 5 轮允许改动的最窄产品包

如果后续实现 agent 需要动源码，PM 建议只允许以下改动类型：

1. 卡牌数据：把 `blood_tithe`、可选 `pulse_draw` 从 `reserve-test` 改成正式 reward 身份。
2. 奖励池：把开放的牌加入 `rewardCardPool`，排序服务三分支可读性。
3. 分支合同：保留并验证 `rewardBranches` 显式声明。
4. 文案：更新 `rulesText`、`mobileEffect`、`detail` 或 HUD 标签，说明抽牌倍率。
5. 测试：覆盖 reward pool 合法性、分支稳定性、倍率抽牌、奖励后进入当前 run、restart 清空。

不允许的源码改动类型：

1. 修改 `PlayerState` 增加 `exhaustPile`、`retainedCards`、`statuses`。
2. 修改 pile 类型从 `CardId[]` 到 `CardInstanceId[]`。
3. 新增 status card、curse card、upgrade reward、relic inventory。
4. 接入 `runModifiers.ts` 到 runtime。
5. 新增通用 `EffectSpec` / `TriggerSpec` 解释器。
6. 把 `maxEnergy`、局外成长或永久解锁混进奖励选择。

## 5. 本轮验收边界

第 5 轮如果开放抽牌修补牌，验收应证明这些事：

- `rewardCardPool` 中不存在 `availability: reserve-test` 的牌。
- 新开放的抽牌修补牌有显式 `rewardBranches`。
- 默认三选一仍覆盖 `repair-resource / payoff / route-bridge`。
- `blood_tithe` 作为 0 MP 抽牌修补，不提高 Max MP，不进起始牌组。
- `pulse_draw` 如果开放，必须有 `effectMultiplier = 2` 时抽 2 的测试和玩家可读文案。
- 选中奖励后只进入当前 run；`restart-run` 回到基础 `startingHand`、空弃牌堆和 `maxEnergy = 3`。
- self draw 牌打出后仍进入 `discardPile`，不产生 `exhaustPile` 或 retain 行为。

验收不应要求这些事：

- 消耗牌存在。
- 保留牌存在。
- 状态牌污染存在。
- 任意实体 status 存在。
- CardInstance 迁移完成。
- 升级、诅咒、遗物、商店、地图、局外存档存在。

## 6. PM 裁决

第 5 轮的正确表述是：

> 开放抽牌修补牌，是把当前 reward deck loop 从“只给伤害 / payoff / wild”推进到“有过牌一致性工具”的真实卡牌复刻进展。

第 5 轮的错误表述是：

> 既然要复刻卡牌 roguelike，就顺手补 exhaust、retain、status、CardInstance、升级和遗物。

本轮应守住小切口。抽牌修补牌只需要现有 `CardId[]` 牌区、`DrawCards`、`rewardBranches`、`rewardCardPool`、HUD 文案和定向测试。完整生命周期和实例系统留给后续专门轮次。

STATUS: DONE
