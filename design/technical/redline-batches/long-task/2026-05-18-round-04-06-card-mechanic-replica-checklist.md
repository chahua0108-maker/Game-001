# 2026-05-18 Round 04 Expert 06：完整卡牌机制复刻清单

## 0. 审查边界

- 工作目录：`/Users/roc/Game-001`
- 角色：第 4 轮专家 06，完整卡牌机制复刻清单负责人
- 任务：站在完整卡牌 roguelike 机制复刻角度，列出现有与缺失机制，并按 P0-P3 排序。
- 边界：只读源码与现有设计文档；不改源码、不提交 git。
- 输出文件：`design/technical/redline-batches/long-task/2026-05-18-round-04-06-card-mechanic-replica-checklist.md`

读取依据：

- `prototype-web/src/sim/types.ts`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/sim/world.ts`
- `prototype-web/src/sim/rewardChoices.ts`
- `prototype-web/src/sim/rewardProgression.ts`
- `prototype-web/src/sim/runModifiers.ts`
- `prototype-web/src/sim/snapshot.ts`
- `prototype-web/src/data/cards.ts`
- `prototype-web/src/eca/redlineRules.ts`
- `prototype-web/src/ui/hud.ts`
- `prototype-web/src/tests/sim/card-taxonomy.test.ts`
- `prototype-web/src/tests/sim/redline-progression-card-system.test.ts`
- `design/technical/redline-batches/long-task/2026-05-18-round-01-02-card-mechanic-contract.md`
- `design/technical/redline-batches/long-task/2026-05-18-round-02-01-card-lifecycle-designer.md`
- `design/technical/redline-batches/long-task/2026-05-18-round-02-02-card-instance-upgrade-architect.md`
- `design/technical/redline-batches/long-task/2026-05-18-round-03-synthesis.zh.md`

## 1. 一句话结论

当前 Redline 已经不是空白卡牌 demo：它有 4 张手牌、抽牌堆 / 手牌 / 弃牌堆、固定起始牌组、当前 MP、`0 -> 1 -> 2` 费用链、Wild 修补、临时 payoff 授权、敌人意图、击杀 XP、升级奖励三选一、当前 run 内加卡、基础目标系统和结构化事件管线。

但它还不是完整卡牌 roguelike 机制底座。最大缺口不在“多做几张牌”，而在几个基础表达能力还没有：消耗、保留、状态牌、诅咒、升级、实例化、状态 / buff / debuff、触发器、局外 / 遗物层。第 4 轮不要一次做完这些机制；应把它们排成复刻清单，后续一轮只拿一个窄切口。

## 2. 当前已存在机制

| 机制 | 当前存在内容 | 证据与边界 |
| --- | --- | --- |
| 抽牌 | `HAND_SIZE = 4`；`DealHand` 从 `drawPile` 抽到 `hand`；`DrawCards` 支持 self 牌额外抽牌。 | `runtime.ts` 中 `drawCardsFromDeck`、`DealHand`、`DrawCards` 已可运行。 |
| 弃牌 | 打出牌走 `DiscardPlayedCard`；结束回合和奖励选择走 `DiscardHand`。 | 所有打出牌和未打出手牌默认进入 `discardPile`。 |
| 洗牌 / 回填 | `drawPile` 为空时，把 `discardPile` 回填为新的 `drawPile`。 | 这是确定性回填，不是 seeded random shuffle；`excludeFromReshuffle` 可避免刚打出的抽牌牌立刻洗回。 |
| 费用 / 当前资源 | `energy/maxEnergy` 初始 3；发牌时恢复到 `maxEnergy`；`GainEnergy` 只加当前 MP。 | 当前没有永久 Max MP 成长。 |
| 临时授权 | 完成未断裂 `0 -> 1 -> 2` 后获得 `tempAuthorizationMP += 3`，限制 `payoff-only`。 | 授权只支付 3 费、全体敌人、`burst` 的 payoff；离开 `PlayerTurn` 清空。 |
| 卡牌 taxonomy | `CardDefinition` 已有 `cardType / chainRole / cycleRole / buildRole / availability / rulesText / mobileEffect / keywords / detail`。 | 字段能表达攻击、抽牌、修补、payoff、状态等分类；但分类不等于机制已实装。 |
| 修补 | `utilities: ['wild']` 的牌可按当前 `nextExpectedCost` 接链，并发 `ChainRepaired`。 | 当前 Wild 修补链路记录，不改变实际支付费用。 |
| payoff | `severance_burst`、`red_ledger_burst` 是 3 MP 全场终结；会发 `PayoffTriggered / ClearBurstRequested / PayoffResolved`。 | `clearance_order` 是 2 MP 前排展开段，不是 terminal payoff。 |
| 目标 | 已有 `front-enemy / front-row / all-enemies / self` 四类。 | 单体要求前排存活目标；前排和全场由 ECA 规则分流。 |
| 敌人意图 | 发牌时快照当前前排攻击意图；结束回合结算；payoff 可记录 prevented intent damage。 | 只有 attack 意图，没有 buff/debuff/spawn/shield/move。 |
| 奖励 / 当前 run 加卡 | 击杀给 XP；达到阈值进入 Reward；三选一覆盖 `repair-resource / payoff / route-bridge`；选择后加入当前 deck。 | 第 3 轮已裁决为 run 内成长，restart 清空。 |
| 局外占位 | HUD 有“局外档案：未开放”；`runModifiers.ts` 有 preview-only 的 run modifier draft。 | 这些不进入真实 runtime，不是遗物或永久成长系统。 |
| 事件管线 | `Intent -> Event -> Rule -> Command -> Event` 已成形，debug trace 可追踪。 | 当前规则主要挂在 `CardPlayed` 和 `EnemyKilled`，还不是通用触发系统。 |

## 3. 当前缺失机制总表

| 机制 | 当前状态 | 缺口判断 |
| --- | --- | --- |
| 抽 / 弃 / 洗 | 有最小循环。 | 缺随机洗牌、seed、手牌上限策略、选择弃牌、弃牌触发、预视 / 重排真实效果。 |
| 消耗 | 字段关键词中有“消耗”，但没有 `exhaustPile` 或生命周期解析。 | 缺 `onPlay: exhaust`、`CardExhausted`、消耗堆、消耗触发。 |
| 保留 | 字段关键词中有“保留”，但结束回合统一弃牌。 | 缺 `retainedCards`、保留下回合补抽、保留 UI / 事件。 |
| 状态牌 | `CardType` 有 `status`，但卡表没有真实状态牌。 | 缺敌人 / 代价注入状态牌、状态牌生命周期、状态牌清理。 |
| 实体状态 | `comboNode = mark` 只是标签。 | 缺 vulnerable/weak/poison/mark/shield/bleed 等 buff/debuff 容器和持续时间。 |
| 诅咒 | `CardType` 当前没有 `curse`，卡表和 runtime 均无诅咒。 | 缺长期负面牌、奖励代价、净化、run 内或跨战斗持久范围。 |
| 升级 | 没有 `CardInstanceId`、`upgraded`、`upgradesTo` 或升级 reward。 | 同名卡不同版本无法共存，升级不能作为构筑奖励成立。 |
| 临时属性 | 有 `tempAuthorizationMP`、当前 `energy`、链路倍率。 | 缺通用临时 modifier、临时降费、临时伤害增减、临时牌来源。 |
| 永久 / run 内属性 | 有 `maxEnergy = 3`、HP、当前 run deck 增加、level/xp。 | 缺 card instance 永久 run modifier、遗物、角色、商店、局外存档。 |
| 目标 | 有四种硬编码目标。 | 缺任意敌人、随机敌人、最弱/最强、多目标、列/行、卡牌区目标、状态目标。 |
| 触发 | 有 ECA 事件管线。 | 缺 `onDraw/onDiscard/onExhaust/onRetain/onTurnStart/onTurnEnd/onKill/onShuffle/onReward`。 |
| 遗物 / 局外 | 有 run state、reward history、preview-only run modifiers、HUD 占位。 | 缺 relic/artifact inventory、触发器、局外货币、永久解锁、保存与重启恢复。 |

## 4. P0：先补“牌区生命周期 + 物理状态牌”的最小底座

P0 不是完整复刻，也不应一次吃下升级、诅咒、遗物和通用触发。P0 只解决“完整卡牌游戏最基础的牌循环能否表达”的问题。

### P0-1：统一抽 / 弃 / 洗牌生命周期

现有：

- `deck / hand / drawPile / discardPile` 已存在。
- 打出牌与回合末牌都进 `discardPile`。
- 空抽牌堆时从弃牌堆回填。
- `excludeFromReshuffle` 是当前抽牌护栏。

缺失：

- 没有结构化 `CardMoved / CardDrawn / CardDiscarded` 事件。
- 没有 seeded shuffle，当前只是确定性回填。
- 没有统一 `MoveCard`，牌区移动分散在 `DiscardPlayedCard / DiscardHand / DrawCards`。

P0 清单：

1. 保留当前 `CardId[]`，不要立刻做 `CardInstanceId` 大迁移。
2. 增加统一牌区移动 helper 或命令语义，把 `DiscardPlayedCard`、`DiscardHand`、`DrawCards` 的移动口径收敛。
3. 给抽牌、弃牌、回填补事件证据，让后续状态 / 消耗 / 保留能复用。
4. seeded shuffle 可先定义合同，实际随机化放 P1；P0 仍可保持 deterministic，避免破坏当前验收。

### P0-2：消耗 / exhaust

现有：

- `CardKeyword` 包含“消耗”。
- 当前所有打出牌都进入 `discardPile`。

缺失：

- `PlayerState` 没有 `exhaustPile`。
- `CardDefinition` 没有真实 lifecycle。
- 没有 `CardExhausted` 事件，也没有消耗触发。

P0 清单：

1. 增加 `exhaustPile: CardId[]`。
2. 增加可选 `lifecycle.onPlay = 'discard' | 'exhaust' | 'remove'`，默认维持现有 16 张牌进弃牌。
3. 增加一张或两张测试状态 / 强力牌用于证明打出后不再洗回。
4. 只做定义级消耗，不做同名实例差异。

### P0-3：保留 / retain

现有：

- `CardKeyword` 包含“保留”。
- 回合末 `DiscardHand` 统一把手牌全部弃掉。

缺失：

- 没有 `retainedCards`。
- 没有保留牌下回合先回到手牌再补抽。
- 没有 `CardRetained` 事件。

P0 清单：

1. 增加 `retainedCards: CardId[]` 或等价暂存区。
2. `DealHand` 改成 retain-aware：保留牌先进入下回合 hand，再补抽到 4 张。
3. 默认卡仍不保留，只给 1 张测试牌或状态牌验证保留。
4. 不做保留后降费、保留次数、同名牌实例差异；那些进入 P1/P2。

### P0-4：状态牌，先做物理污染牌

现有：

- `CardType` 允许 `status`，关键词允许“状态 / 过载 / 净化”。
- 运行时没有任何 status card。

缺失：

- 没有状态牌注入源。
- 没有状态牌打出 / 回合末生命周期。
- 没有清理、净化或状态牌触发。

P0 清单：

1. 先做 1 种最小状态牌，例如“迟滞文件”：抽到占手牌，打出后消耗，回合末弃牌或自动消耗。
2. 增加 `CreateCardInZone` 或等价命令，把状态牌放进 `discardPile` 或 `drawPile`。
3. 状态牌先作为物理卡牌处理，不等同于实体 buff/debuff。
4. 状态牌只服务发牌污染，不先做复杂惩罚。

### P0-5：临时 / 永久属性边界

现有：

- 临时：`energy`、`tempAuthorizationMP`、`authorizationRestriction`、`payoffArmed`、`chain.multiplier`。
- 稳定：`maxEnergy = 3`、`maxHp`、当前 run deck、level/xp。

缺失：

- 临时授权之外没有通用 modifier。
- 当前 run 奖励只会加卡，不会升级牌或加 run modifier。
- `runModifiers.ts` 是 preview-only，不进入 runtime。

P0 清单：

1. 保持 `maxEnergy = 3` 与 `tempAuthorizationMP` 的当前边界，不把 P0 改成永久 MP 成长。
2. 为后续机制命名清楚：`turn-scoped`、`combat-scoped`、`run-scoped`、`meta-scoped`。
3. P0 只允许新增 turn-scoped 或 card lifecycle 级别的临时效果，不开放永久成长。

## 5. P1：补“效果表达、触发器、目标扩展、升级入口”

P1 的目标是让卡牌效果不再靠 `damage/drawCards/energyGain` 与硬编码目标勉强表达。P1 也不是完整内容生态。

### P1-1：数据驱动效果列表

现有：

- `CardDefinition` 有 `damage/drawCards/energyGain/utilities`。
- ECA 规则按 `targets` 分流。

缺失：

- 没有 `effects: EffectSpec[]`。
- 复杂效果必须改代码分支。

P1 清单：

1. 增加迁移期 `effects`，先由现有字段生成 legacy effects。
2. 支持最小效果：damage、draw、gain-energy、gain-authorization、add-card、apply-status、exhaust-self。
3. ECA 仍保留，但效果解析集中化，避免每张新牌开规则分支。

### P1-2：触发系统

现有：

- 有 `CardPlayed`、`EnemyKilled`、`RewardChosen`、`PayoffResolved` 等事件。
- 当前规则主要消费 `CardPlayed` 和 `EnemyKilled`。

缺失：

- 没有每张牌 / 状态 / relic 可声明的触发器。
- 没有抽到、弃掉、消耗、保留、洗牌、回合开始 / 结束触发。

P1 清单：

1. 定义 `TriggerSpec`：`onDraw/onPlay/onDiscard/onExhaust/onRetain/onTurnStart/onTurnEnd/onKill/onShuffle`。
2. 先让状态牌和 1 张技能牌使用触发，不接遗物。
3. 事件必须可 trace，不能只在 UI 中推断。

### P1-3：目标系统扩展

现有：

- `front-enemy / front-row / all-enemies / self` 已可用。

缺失：

- 没有任意敌人、随机敌人、最低 HP、最高意图、多目标、列、卡牌区目标。

P1 清单：

1. 将 `targets` 升级为 `TargetSpec`，仍兼容旧四类。
2. 先补 `any-enemy`、`random-enemy`、`enemy-with-intent`、`card-in-hand`、`card-in-discard`。
3. 不做 ally / summon / board ownership；那是 P3。

### P1-4：升级入口，先不做全量实例迁移

现有：

- 奖励只会加卡，不会升级。
- `deck/hand/drawPile/discardPile` 都是 `CardId[]`。

缺失：

- 没有 `upgraded`、`upgradeSpec`、升级选择、升级事件。

P1 清单：

1. 先定义 `UpgradeSpec` 与升级 reward 类型。
2. 如果只升级全局定义变体，可以用 `cardId_plus` 作为过渡，但必须标记这是临时方案。
3. 真正同名卡不同升级必须等 P2 `CardInstanceId`。
4. P1 不要把升级、消耗、临时复制全部混在一起做。

### P1-5：诅咒，先做 run 内长期负面牌

现有：

- 没有 curse 类型。

缺失：

- 没有高收益奖励代价，也没有净化 / 移除。

P1 清单：

1. 扩展 `CardType` 加 `curse`。
2. 做 1 种 run 内诅咒：进入 deck，默认不自动清除，restart 后清空。
3. 接入一个奖励代价或事件代价，但不要接局外永久诅咒。
4. 加最小净化入口，否则诅咒只会变成不可管理惩罚。

## 6. P2：CardInstance、同名差异、复制 / 临时牌、实体状态

P2 才进入真正完整 deckbuilder 需要的单卡实例层。过早做会拖垮当前可验收样片。

### P2-1：CardInstanceId

现有：

- 所有 pile 都存 `CardId[]`。
- 打出同名牌时只能移除第一张匹配 id。

缺失：

- 无法区分同名牌的升级、临时费用、来源、复制体、是否 temporary。

P2 清单：

1. 增加 `CardInstanceStore`。
2. 内部 pile 改为 `CardInstanceId[]`，snapshot 继续兼容导出 `CardId[]`。
3. 事件迁移期同时带 `instanceId` 与 `cardId`。
4. 旧 `play-card(cardId)` 兼容为“手牌中最左侧匹配实例”。

### P2-2：临时牌、复制、变形、单张 modifier

现有：

- 只有定义级 `CardId`。

缺失：

- 不能复制一张 `redline_cut` 并只让复制体临时。
- 不能让一张同名牌本回合 0 费，另一张仍原价。

P2 清单：

1. `CreateCard / CopyCard / TransformCard / ModifyCardCost` 都要以实例为目标。
2. 临时牌带 `temporary` 与 `purgePolicy`。
3. 复制默认复制定义，不复制全部临时 modifier，除非效果明确说明。

### P2-3：实体状态 / buff / debuff

现有：

- 敌人和玩家没有状态容器。
- `mark` 是卡牌路线标签，不是实体状态。

缺失：

- 不能做易伤、虚弱、中毒、护盾、流血、标记、蓄力、打断等。

P2 清单：

1. 为玩家和敌人增加 `statuses: StatusInstance[]`。
2. 第一批只做 2-3 个：`mark`、`shield/block`、`vulnerable` 或 `bleed`。
3. 状态需要持续时间、层数、来源和 tick/turn 结算。
4. 物理 status card 与实体 status 必须分开命名，避免混淆。

## 7. P3：遗物、局外、地图 / 商店、完整生态

P3 是完整卡牌 roguelike 的生态层，不应阻塞当前核心战斗机制。

### P3-1：遗物 / artifact

现有：

- 没有 relic inventory。
- `runModifiers.ts` 只有 preview-only 草案。

缺失：

- 没有“每次抽牌 / 每次消耗 / 每次击杀 / 每次洗牌”类被动规则。

P3 清单：

1. 增加当前 run 的 `relics: RelicInstance[]`。
2. Relic 使用同一触发系统，不写 UI 特例。
3. 第一批 relic 只做 3 个以内，例如：首次完成链抽 1、每次消耗给 1 MP、每次洗牌塞 1 状态牌。

### P3-2：局外 / meta progression

现有：

- HUD 显示局外档案未开放。
- restart 会回到基础 deck 和 `maxEnergy = 3`。

缺失：

- 没有账号成长、永久解锁、货币、收藏、保存。

P3 清单：

1. 明确 `meta-scoped` 与 `run-scoped` 的数据边界。
2. 先做只读解锁预览，不要直接影响 P0/P1 战斗验收。
3. 永久成长不能伪装成当前 run modifier；必须有存档和重启恢复合同。

### P3-3：地图、商店、删牌、事件

现有：

- `run.currentNode/maxNodes` 只是一条短 run 进度。

缺失：

- 没有地图节点、商店、删牌、升级营地、事件风险收益。

P3 清单：

1. 地图 / 商店依赖 P1 奖励与 P2 实例，不要提前做。
2. 删牌和升级必须能选择实例，否则同名牌会出错。
3. 事件可以产生诅咒、净化、遗物、升级，但不应该先于这些底层机制。

## 8. 推荐分阶段顺序

不要把本清单当成第 4 轮一次性实施包。按当前工程状态，推荐顺序是：

1. P0 第一刀：牌区生命周期骨架，包含 `exhaustPile`、`retainedCards`、统一移动事件；只配 1-2 张测试牌。
2. P0 第二刀：物理状态牌污染循环，证明状态牌能进入抽弃循环并被消耗 / 弃掉。
3. P1 第一刀：`EffectSpec` 和最小 `TriggerSpec`，只迁移少数现有卡。
4. P1 第二刀：诅咒和升级入口，仍不做完整实例化。
5. P2：只有当同名牌升级、复制、临时费用成为真实需求时，再做 `CardInstanceId`。
6. P3：遗物 / 局外 / 地图 / 商店最后做，不能倒灌进当前 P0 战斗闭环。

## 9. 第 4 轮不应做的事

- 不要一次性做完整 `CardInstanceId`、消耗、保留、状态、诅咒、升级、遗物、局外。
- 不要为了“完整复刻”直接改 `maxEnergy` 或加入永久 MP 成长。
- 不要把 `runModifiers.ts` 的 preview-only 草案直接接入 runtime。
- 不要把状态牌和实体 buff/debuff 混成一个 `status` 字段。
- 不要用自然语言 `description` 推断规则；后续新增机制必须结构化。
- 不要把 P3 的地图 / 商店 / 局外解锁提前做成当前战斗验收的前置条件。

## 10. 复刻完整度快照

| 领域 | 当前完整度 | 下一步判断 |
| --- | --- | --- |
| 抽 / 弃 / 洗 | 中 | 可玩但还不是完整生命周期；P0 补事件与消耗 / 保留区。 |
| 消耗 | 低 | 字段有词，runtime 无区；P0。 |
| 保留 | 低 | 字段有词，runtime 无区；P0。 |
| 状态牌 | 低 | 类型有占位，无内容和注入；P0。 |
| 诅咒 | 无 | P1，先 run 内长期负面牌。 |
| 升级 | 无 | P1 定义入口，P2 实例化落地。 |
| 临时属性 | 中 | 授权做得清楚，通用 modifier 缺；P0/P1。 |
| 永久属性 | 低 | 当前坚持无局外成长是正确边界；P3 前不做。 |
| 目标 | 中低 | 四类目标够 P0，P1 扩 TargetSpec。 |
| 触发 | 中低 | 事件管线好，触发声明缺；P1。 |
| 遗物 / 局外 | 低 | 有占位与 preview-only 草案，真实系统 P3。 |

STATUS: DONE
