# 2026-05-18 Round 06-04 卡牌生命周期机制 PM

角色：第 6 轮专家 04，卡牌生命周期机制 PM  
工作目录：`/Users/roc/Game-001`  
任务边界：本文只新增 Markdown 文档；不改源码，不回滚或覆盖其他人的改动，不提交 git。  
本轮主题：修补牌 / 抽牌 / 临时资源 / 重排的 1:1 卡牌机制复刻范围裁剪。

## 0. PM 结论

第 6 轮不应启动完整卡牌生命周期大迁移。当前 Redline 已经有可运行的抽牌、弃牌、回填、修补、当前 MP、临时授权和奖励入当前 run；但消耗、保留、状态牌、升级、复制、删牌、诅咒、临时物理牌都还只是类型、关键词、文案或设计文档，没有运行时。

本轮应只把四件和核心循环直接相关的事说清楚：

1. 抽牌：继续承认 `drawCards * effectMultiplier` 是真实运行时规则，并保护“刚打出的抽牌牌不立刻洗回”。
2. 修补：继续承认 Wild 修补只影响费用链记录，支付仍按印刷 cost；不要把它扩成万能实例系统。
3. 临时资源：`energyGain`、`tempAuthorizationMP`、`payoffArmed` 都是本回合资源，不是最大 MP 成长。
4. 重排：当前只有 `utilities: ['reorder']`、`整备`标签和 HUD 文案，没有重排命令、事件或 UI。第 6 轮如果不做最小运行时，就必须继续把它写成“找牌 / 整备”，不能承诺玩家可操作重排。

其他完整卡牌机制全部推迟。

## 1. 当前 `CardDefinition` 字段事实

当前 `prototype-web/src/sim/types.ts` 的 `CardDefinition` 字段如下：

| 字段 | 当前事实 | 运行时用途 |
| --- | --- | --- |
| `id` | `CardId`，静态定义 id。 | 同时作为 catalog key、deck/hand/draw/discard/reward 中的元素。不是实例 id。 |
| `name` | 展示名。 | UI 展示。 |
| `cost` | 数字费用。 | 支付当前 `energy` 或 `tempAuthorizationMP`；同时作为费用链节点。 |
| `verb` | 中文动作词。 | 主要用于展示语义。 |
| `damage` | 基础伤害。 | ECA 中按 `damage * effectMultiplier` 结算。 |
| `comboNode` | `hook/cut/spark/mark/reclaim/burst`。 | 费用链、主题、payoff 判定的一部分。 |
| `description` | 长说明。 | UI / 文案；不是结构化规则。 |
| `targets` | `front-enemy/front-row/all-enemies/self`。 | 决定 ECA 规则分流。 |
| `cardType` | `attack/skill/resource/draw/repair/payoff/status`。 | taxonomy、HUD 和测试合同；`status` 目前没有真实卡。 |
| `chainRole` | `starter/bridge/expand/repair/payoff`。 | 费用链角色、HUD 和测试合同。 |
| `cycleRole` | `opener/connector/route-segment/draw-fixer/wild-fixer/finisher`。 | 发牌循环角色、奖励分类语义。 |
| `buildRole` | `basic-chain/reward-chain/draw-fixer/wild-fixer/payoff-finisher/reserve-test`。 | 构筑角色、奖励分类语义。 |
| `availability` | `starting/reward/starting-and-reward/reserve-test`。 | 起手 / 奖励池边界；不是运行时生命周期。 |
| `rulesText` | 短规则文本。 | 卡面 / 测试可读性。 |
| `mobileEffect` | 移动端短效果。 | HUD 展示。 |
| `keywords` | 包含 `开链/接链/修补/终结/授权/意图/护栏/抽牌/返MP/消耗/保留/状态/过载/净化/打断/整备`。 | 当前主要是文本合同；`消耗/保留/状态/净化/整备`不等于运行时已实现。 |
| `detail` | 细节说明。 | UI tooltip / 文档边界。 |
| `rewardBranches?` | `repair-resource/payoff/route-bridge`。 | 奖励三分支显式合同。 |
| `drawCards?` | 数字。 | `self` 牌通过 ECA 触发 `DrawCards`，数量乘 `effectMultiplier`。 |
| `energyGain?` | 数字。 | `self` 牌通过 ECA 触发当前 MP 增加；不乘倍率，不改 `maxEnergy`。 |
| `utilities?` | `wild/draw/mana/reorder`。 | `wild` 参与费用链修补；`draw/mana` 辅助语义；`reorder` 当前无运行时。 |

当前没有这些字段：

- `lifecycle` / `onPlay` / `onTurnEnd`
- `exhaust` / `retain` / `ethereal`
- `CardInstanceId` / `instanceId` / `upgraded`
- `temporary` / `createdBy` / `purgeAt`
- `copySource` / `removeFromDeck` / `curse`
- `effects[]` / `triggers[]` / `onDraw/onDiscard/onShuffle`
- `rarity` / `shopPrice` / `upgradeSpec` / `deleteCost`

因此，现在的卡牌系统仍是“静态定义 + `CardId[]` 牌区 + 少量硬编码效果字段”，不是完整实体化卡牌生命周期系统。

## 2. 当前运行时牌区事实

当前 `PlayerState` 只有四个牌区：

```text
deck: CardId[]
hand: CardId[]
drawPile: CardId[]
discardPile: CardId[]
```

关键运行时行为：

| 行为 | 当前事实 | 边界 |
| --- | --- | --- |
| 发牌 | `DealHand` 固定抽 4 张；抽完后重置费用链和当前 MP。 | 没有 retain-aware deal。 |
| 抽牌 | `drawCardsFromDeck` 从 `drawPile.shift()` 抽；空时用 `discardPile` 回填。 | 不是随机洗牌，没有 seed，也没有 `onShuffle`。 |
| 自抽护栏 | `DrawCards` 在 `CardPlayed` 触发时会带 `excludeFromReshuffle: [event.cardId]`。 | 只保护当前同名 `CardId`，不是实例级 resolving 区。 |
| 打出牌 | 校验通过后先 `SpendEnergy`，再 `DiscardPlayedCard`。 | 所有打出牌默认进 `discardPile`。 |
| 回合末 | `DiscardHand` 把剩余 `hand` 全部推进 `discardPile`。 | 没有保留、消耗、临时牌清理。 |
| 奖励加卡 | `AddCardToDeck` 把奖励 `cardId` 加入 `deck` 并放到 `drawPile` 顶部。 | 只影响当前 run；restart 回到起始牌组。 |
| 临时授权 | 完成 `0 -> 1 -> 2` 后获得 `tempAuthorizationMP += 3`，限制 `payoff-only`。 | 离开 `PlayerTurn` 清空；不提高 `maxEnergy`。 |

## 3. 生命周期机制缺口矩阵

| 机制 | 已有文本 / 类型 | 已有运行时 | 当前行为 | 是否影响第 6 轮核心循环 | 第 6 轮裁剪 |
| --- | --- | --- | --- | --- | --- |
| 抽牌 | `drawCards`、`CardUtility: draw`、关键词“抽牌”。 | 有。`self` 牌触发 `DrawCards`。 | 抽牌数为 `drawCards * effectMultiplier`；空抽牌堆时从弃牌堆回填。 | 直接影响。 | 保留并写清合同；不扩成检索、选择抽、弃牌触发。 |
| 弃牌 | 有 `discardPile` 状态。 | 有。打出和回合末都进弃牌堆。 | 所有普通牌默认进弃牌。 | 直接影响。 | 保持默认；不做逐张生命周期分流。 |
| 洗牌 / 重洗 | 有 `drawPile/discardPile`。 | 有最小回填。 | `drawPile` 空时用 `discardPile` 回填；不是随机 shuffle。 | 直接影响抽牌修补可靠性。 | 保留 `excludeFromReshuffle` 护栏；不做 seed 随机和洗牌触发。 |
| 修补 | `cardType: repair`、`chainRole: repair`、`utilities: wild`、关键词“修补”。 | 有。`wild` 在链未断且已有链路时按 `nextExpectedCost` 记录。 | 修补只影响费用链 `playedCost`；支付仍按印刷 cost。 | 直接影响。 | 写死“链路修补”和“支付成本”分离；不做 repair reserve 或实例级修补。 |
| 当前 MP 返还 | `energyGain`、关键词“返MP”、`utilities: mana`。 | 有。`GainEnergy` 增加当前 `energy`。 | 不乘倍率；不改 `maxEnergy`。 | 直接影响 `wild_mana_stitch` 强度。 | 可作为后续数值小补丁讨论；本生命周期轮不改成永久资源。 |
| 临时授权 MP | `tempAuthorizationMP`、`authorizationRestriction`、`payoffArmed`。 | 有。完成 `0 -> 1 -> 2` 后发授权。 | 只支付 3 MP 全场 burst payoff；离开玩家回合清空。 | 核心循环。 | 必须继续定义为 turn-scoped；禁止叫成长或 Max MP。 |
| 重排 / 整备 | `utilities: reorder`、关键词“整备”、`paper_shatter/lantern_captain` 文案。 | 没有。测试还明确不产生 reorder 命令或事件。 | 实际只抽牌；HUD 只应写“整备/找牌”。 | 中等影响：它影响卡牌承诺，但当前不是玩法必要条件。 | 第 6 轮只允许二选一：继续降级为文案标签，或另开最小 reorder 合同；不做完整牌库操作 UI。 |
| 消耗 / Exhaust | 关键词“消耗”。 | 没有。 | 没有 `exhaustPile`、`CardExhausted`、`lifecycle.onPlay`。 | 不影响当前四件主线。 | 推迟。不要为抽牌修补牌新增消耗。 |
| 保留 / Retain | 关键词“保留”。 | 没有。 | 回合末统一弃牌；没有 `retainedCards`。 | 不影响当前四件主线。 | 推迟。不要用保留来修坏手。 |
| 状态牌 | `CardType` 有 `status`，关键词有“状态/过载/净化”。 | 没有。当前卡表无 `cardType: 'status'` 卡。 | 没有状态牌注入、抽到惩罚、净化或清理。 | 不影响第 6 轮主线。 | 推迟。不要新增污染牌来证明抽牌循环。 |
| 实体状态 / Buff Debuff | `comboNode: mark`、关键词“意图/打断/净化”等文本。 | 没有通用状态容器。 | `mark` 只是路线标签，不是易伤/流血/护盾。 | 不影响本轮生命周期。 | 推迟。 |
| 升级 | 文档中有方向；源码无字段。 | 没有。 | 不能表达同名不同升级。 | 不影响当前核心手牌循环。 | 推迟到 `CardInstanceId` 后。 |
| 复制 | 文档中有方向；源码无字段。 | 没有。 | 不能区分复制体和原牌。 | 不影响本轮。 | 推迟到实例系统后。 |
| 删牌 / 移除 | 没有正式字段；只有设计讨论。 | 没有。 | 无 `RemoveCard`、商店、净化、删牌奖励。 | 不影响本轮。 | 推迟。 |
| 诅咒 | `CardType` 没有 `curse`；关键词有“净化”但不是诅咒系统。 | 没有。 | 无长期负面牌、代价奖励、净化入口。 | 不影响本轮。 | 推迟。 |
| 临时物理牌 | 没有 `temporary` 字段。 | 没有。 | 当前只有临时资源，没有 temporary card。 | 不影响本轮主线。 | 推迟。 |
| 触发器 | 事件管线存在。 | 只有硬编码 ECA 规则。 | 没有 `onDraw/onDiscard/onExhaust/onRetain/onShuffle`。 | 不应成为本轮主线。 | 推迟。 |
| `CardInstanceId` | 设计文档有草案。 | 没有。 | 所有牌区仍是 `CardId[]`；同名牌不可区分。 | 不应进入本轮。 | 推迟。 |

## 4. 哪些会影响本轮核心循环

### 4.1 必须纳入第 6 轮合同

| 项 | 原因 | 最小处理 |
| --- | --- | --- |
| `DrawCards` 倍率 | `blood_tithe/pulse_draw/paper_shatter/lantern_captain/wild_mana_stitch` 都会受链路倍率影响。 | 继续用 HUD/测试展示实际 `抽N`，不要让卡面只读成固定抽 1。 |
| 自抽重洗护栏 | 抽牌修补牌若能立刻洗回自己，会破坏坏手修补边界。 | 保留 `excludeFromReshuffle`，并承认它只是 CardId 级护栏。 |
| Wild 修补语义 | `wild_mana_stitch/wild_gap_key` 是当前最像“修补牌”的真实运行时。 | 文档和测试要写明：链路按 expected cost，支付按 printed cost。 |
| 当前 MP 返还 | `wild_mana_stitch` 同时 wild/draw/mana，强度高。 | 本轮只定义为当前回合资源；条件返 MP可作为单独数值补丁，不和生命周期混做。 |
| 临时授权 | 是 `0 -> 1 -> 2 -> payoff` 的核心兑现。 | 继续锁定 turn-scoped、payoff-only、不跨回合。 |
| `reorder` 承诺 | 牌上已有 `整备`/`reorder`，但没有运行时。 | 第 6 轮必须裁决“继续不承诺”或“另开最小 runtime”，不能保持含混。 |

### 4.2 应推迟的完整生命周期机制

这些机制是真实卡牌 roguelike 所需，但不是第 6 轮“修补 / 抽牌 / 临时资源 / 重排”闭环的必要条件：

- `exhaustPile`、消耗牌、消耗触发。
- `retainedCards`、保留到下回合、保留后降费。
- 物理 `status` card、污染牌、净化牌。
- 实体 buff/debuff 状态容器。
- `CardInstanceId`、同名卡单张状态。
- 升级、复制、临时牌、临时费用、变形。
- 删牌、商店、净化、诅咒、遗物、地图事件。
- 通用 `EffectSpec[]` / `TriggerSpec[]` 解释器。
- 随机洗牌、牌库顶预视、完整牌堆重排 UI。

## 5. 第 6 轮 P0 最小合同

第 6 轮 P0 只需要锁住以下合同，不能把完整生命周期倒灌进来。

### 5.1 抽牌合同

1. `drawCards` 是基础抽牌数。
2. `CardPlayed.effectMultiplier` 会放大 `drawCards`。
3. 实际抽牌请求为 `card.drawCards * effectMultiplier`。
4. 牌堆不足时只抽到可用牌，不补生成。
5. 当前正在结算的抽牌牌不应在同次 `DrawCards` 中从弃牌堆洗回手牌。
6. 抽牌牌本身打出后仍默认进入 `discardPile`，不消耗、不保留。

### 5.2 修补合同

1. `utilities.includes('wild')` 是当前唯一真实修补运行时入口。
2. Wild 只有在本回合已有费用链且链未断时，才按 `chain.nextExpectedCost` 作为 `playedCost` 接链。
3. Wild 的支付成本仍按 `card.cost`，不能把“补缺口”误写成免费支付 expected cost。
4. 成功修补应能产生 `ChainRepaired` 事件证据。
5. `repairedThisTurn` 只是布尔证据，不是 repair 次数、储备或资源池。
6. 不新增 `repairReserve`、`RepairPoint`、实例级缺口牌。

### 5.3 临时资源合同

1. `energy` 是当前回合 MP。
2. `energyGain` 只增加当前 `energy`，不增加 `maxEnergy`。
3. `tempAuthorizationMP` 是本回合终局授权，只支付 `payoff-only`。
4. `payoffArmed` 只是授权状态的可读派生，不是永久强化。
5. 离开 `PlayerTurn` 时清空费用链、临时授权和 payoff armed。
6. 奖励加卡只进入当前 run，restart 后回到 `startingHand`。

### 5.4 重排合同

当前推荐 P0 裁剪为“先不实现重排运行时”，理由是本轮已有抽牌、修补和临时资源三条主线，真正重排会引入牌库顶预视、选择 UI、事件、测试和移动端阅读问题。

最低合同：

1. `utilities: ['reorder']` 只能作为 `整备/找牌` 标签。
2. `paper_shatter`、`lantern_captain` 的真实效果仍是抽牌。
3. HUD / 卡面不能写“重排牌库”“选择牌库顶”“排序牌堆”等未实现承诺。
4. 测试继续允许 `utilities` 含 `reorder`，但不应期待 `Reorder` command/event。

如果制作上坚持第 6 轮必须做“1:1 重排”，则必须另开单独小合同，最小也要包括：

- `ReorderCards` 命令和 `CardsReordered` 事件。
- 明确作用区域：只允许 `drawPile` 顶 N 张。
- 明确是否需要 UI 选择；若没有 UI，只能做 deterministic top N rotate，不能叫玩家重排。
- 明确移动端验收。

这不应和消耗、保留、状态、升级、复制一起做。

## 6. 第 6 轮不应做的范围

本轮禁止把以下内容混进同一批：

| 不做项 | 原因 |
| --- | --- |
| 消耗堆 | 会改所有打出牌生命周期，需要 `lifecycle.onPlay` 和新事件。 |
| 保留 | 会改 `DealHand` 与 `DiscardHand` 基本流程。 |
| 状态牌 | 需要创建卡、污染来源、清理 / 净化规则。 |
| 诅咒 | 需要 run 内长期负面牌、代价奖励和删除 / 净化。 |
| 升级 | 需要同名牌差异，当前 `CardId[]` 不够。 |
| 复制 | 需要 `CardInstanceId` 或会混淆复制体来源。 |
| 删牌 | 需要商店 / 净化 / deck 管理入口，不是战斗手牌主循环。 |
| 临时物理牌 | 需要 `temporary`、`purgeAt`、`createdBy` 和实例生命周期。 |
| 通用效果解释器 | 会扩大 `damage/drawCards/energyGain` 之外的整体架构。 |
| 遗物 / 局外成长 | 会把当前 P0 从单手牌压力拉到 run/meta 系统。 |

## 7. PM 裁决

第 6 轮应该把“卡牌复刻”压成一个可验收的小口径：

```text
现有 CardId[] 牌区不迁移；
抽牌、弃牌、回填和自抽护栏继续作为真实运行时；
Wild 修补、当前 MP 返还、临时授权继续作为本回合机制；
reorder 先作为整备/找牌标签，不承诺真实牌库重排；
完整生命周期机制全部后置。
```

这能让修补牌 / 抽牌牌 / 临时资源牌先变得诚实、可测、可读，而不是为了“像完整卡牌游戏”过早打开消耗、保留、状态、升级、复制和诅咒的系统债。

STATUS: DONE
