# 2026-05-18 第10轮专家02：卡牌机制 1:1 复刻审计

角色：第10轮专家02，卡牌机制合同审计  
工作目录：`/Users/roc/Game-001`  
输出边界：只写本文档；不改源码、不提交、不回滚、不覆盖其他工作者修改。  
审计目标：从机制合同视角判断当前卡牌类型、触发、资源、目标、发牌、抽牌、弃牌、奖励是否足够支持“完整卡牌机制结构复刻”。这里的“复刻”只指机制结构，不复制受版权保护的卡名、文案、美术。

## 0. 一句话结论

当前原型已经具备“Redline 样片级卡牌循环”：4张手牌、抽牌堆、弃牌堆、0->1->2 费用链、Wild 修补、临时 payoff 授权、3费全场终结、击杀 XP、升级三选一、run 内加卡、paper_shatter 顶终结样片、浏览器 UI 验收。

但它还不够支撑“1:1机制结构复刻”。缺口不是卡牌数量，而是卡牌游戏底座表达能力仍偏窄：没有统一牌区移动事件，没有消耗/保留/状态牌物理生命周期，没有通用触发器，没有效果列表解释器，没有卡实例/升级，没有扩展目标系统，没有选择弃牌/检索/重排的通用合同，也没有真正进入 runtime 的 run modifier / relic 层。

第10轮不应继续堆新样片或新卡名；如果本轮还要写代码，应只写 P0 机制合同补齐代码。当前专家02任务本身只写文档。

## 1. 审计依据

- `prototype-web/src/data/cards.ts`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/sim/world.ts`
- `prototype-web/src/sim/rewardChoices.ts`
- `prototype-web/src/sim/runModifiers.ts`
- `prototype-web/src/eca/redlineRules.ts`
- `prototype-web/src/tests/sim/card-taxonomy.test.ts`
- `prototype-web/src/tests/sim/redline-progression-card-system.test.ts`
- `prototype-web/src/tests/sim/redline-attribute-authorization.test.ts`
- `prototype-web/src/tests/sim/redline-paper-shatter-topdeck.test.ts`
- `prototype-web/src/tests/sim/reward-branching.test.ts`
- `prototype-web/src/tests/sim/run-progression.test.ts`
- `prototype-web/src/tests/sim/run-layer-boundary.test.ts`
- `design/technical/redline-batches/long-task/2026-05-18-round-04-06-card-mechanic-replica-checklist.md`
- `design/technical/redline-batches/long-task/2026-05-18-round-09-synthesis.zh.md`

## 2. 机制视角审计镜头

| # | 机制视角 | 已满足 | 缺口 | 最小补齐建议 | 优先级 |
| --- | --- | --- | --- | --- | --- |
| 1 | 卡牌类型 taxonomy | `CardType` 已有 attack / skill / resource / draw / repair / payoff / status；每张卡有 `cardType / chainRole / cycleRole / buildRole / availability / keywords`；测试约束 payoff 只允许 3费全场 burst。 | 类型字段大于真实能力：`skill/resource/status` 还不是完整机制；status 没有真实卡，resource 主要靠 `energyGain` 特例，skill 没有独立效果解释器。 | 保留现有 taxonomy，但新增 `implementedMechanics` 或 `effects` 合同，区分“分类标签”和“已运行机制”。先让 1 张 status、1 张 skill 通过真实 runtime 验证。 | P0 |
| 2 | 费用链与临时授权 | 0->1->2 未断链后发 `AuthorizationGranted`；授权只限 payoff-only；结束回合清空；Wild 可修补期望费用；测试覆盖授权支付、断链、Wild 修补。 | 授权是硬编码单路线，只能表达当前 Redline 样片；不能表达多种连锁条件、替代费用、X费、降费、费用返还上限、按牌/按回合的资源状态。 | 把链路条件抽成 `ChainContract`：触发成本序列、成功奖励、适用卡类型、过期时机。不要先开放复杂数值，只让现有 0->1->2 用合同驱动。 | P0 |
| 3 | 当前资源与永久资源边界 | `energy/maxEnergy=3`；发牌恢复当前 MP；`tempAuthorizationMP` 不是永久成长；`wild_mana_stitch` 只在真实修补时返当前 MP；测试防止 Max MP 被误改。 | 缺通用 turn/combat/run/meta 作用域模型；`GainEnergy` 可无上限增长当前能量；run modifier 只是 preview-only，没有 runtime 接入。 | 定义 `ResourceScope = turn | combat | run | meta`，先把 current MP、authorization MP、preview-only run modifier 的边界写入类型和事件。`GainEnergy` 是否允许超 `maxEnergy` 要有合同。 | P0 |
| 4 | 发牌/抽牌/洗牌 | `DealHand` 固定抽 4；`DrawCards` 支持额外抽；抽牌堆空时从弃牌堆回填；`excludeFromReshuffle` 防止抽牌牌立刻洗回。 | 没有 `CardMoved/CardDrawn/CardDiscarded/DeckReshuffled` 事件；回填不是 seeded shuffle；没有手牌上限策略、满手弃牌、预抽、检索、选择抽。 | 新增统一牌区移动命令或 helper，并发结构化移动事件。P0 仍可 deterministic 回填，但必须把 shuffle seed 合同留出来。 | P0 |
| 5 | 弃牌与回合末牌区 | 打出牌进弃牌堆；结束回合和奖励选择会 `DiscardHand`；奖励选择后新卡加入 deck 并放到 drawPile 顶部再发牌。 | 没有选择弃牌、弃牌触发、弃牌代价、弃牌后抽牌、弃牌堆目标；`DiscardHand` 静默移动，缺事件证据。 | 先补 `CardDiscarded` 事件和弃牌原因：played / end-turn / reward-selected / effect-cost。后续再加选择弃牌 intent。 | P0 |
| 6 | 消耗与移除 | 关键词里已有“消耗”，但当前所有打出牌默认进弃牌堆。 | 没有 `exhaustPile`、`removedPile`、`onPlay: exhaust`、消耗触发、消耗 UI；强力一次性牌与状态牌无法表达。 | 增加 `exhaustPile` 和 `lifecycle.onPlay = discard | exhaust | remove`，默认旧牌 discard。只用 1 张测试牌证明不洗回。 | P0 |
| 7 | 保留与下回合手牌 | 关键词里已有“保留”，但结束回合统一弃掉手牌。 | 没有 retained zone、下回合先带入再补抽、保留次数、保留降费、保留触发。 | 增加 `retainPile` 或 `retainedCardIds`，`DealHand` 先带入保留牌再补到手牌上限。先不做降费和实例差异。 | P0 |
| 8 | 状态牌与污染牌 | `CardType` 支持 status，关键词支持状态/过载/净化。 | 没有真实 status 卡；敌人不能塞污染牌；状态牌抽到后的行为、回合末生命周期、净化都不存在。 | 先做 1 张物理状态牌：可被加入 discard/draw，抽到占手，打出或回合末按合同消耗/弃置。不要先做复杂 debuff。 | P0 |
| 9 | 触发系统 | 已有 ECA 管线，事件包括 `CardPlayed`、`EnemyKilled`、`RewardChosen`、`PayoffResolved`、`PayoffTopdecked` 等；规则可产生 command。 | 触发仍是全局规则硬编码；卡牌不能声明 `onDraw/onDiscard/onExhaust/onRetain/onTurnStart/onTurnEnd/onKill/onShuffle`；遗物和状态无法挂触发。 | 定义 `TriggerSpec`，先支持 onDraw / onDiscard / onExhaust / onTurnStart / onTurnEnd 五个最小触发点，所有触发必须进 debug trace。 | P1 |
| 10 | 效果表达与解释器 | 现有字段能表达 damage、drawCards、energyGain、preDrawTopdeckPayoff、utilities；ECA 分流可运行。 | 每加复杂效果都要改 runtime/ECA；缺 `EffectSpec[]`；无法组合“伤害+抽+加状态+创建牌+消耗自身”等通用效果。 | 增加迁移期 `effects`：damage、draw、gain-energy、topdeck-payoff、add-card-to-zone、exhaust-self。旧字段可先转译成 legacy effects。 | P1 |
| 11 | 目标系统 | 支持 `front-enemy / front-row / all-enemies / self`；前排目标有合法性检查；默认单体会选前排高威胁/低血目标。 | 缺任意敌人、随机敌人、最低 HP、最高意图、列、行、多目标、友方/召唤物、手牌/弃牌/抽牌堆目标。 | 把 `targets` 迁移为兼容旧枚举的 `TargetSpec`。P1 先补 `any-enemy`、`enemy-with-highest-intent`、`card-in-hand`、`card-in-discard`。 | P1 |
| 12 | 奖励三选一与牌池分支 | 奖励候选按 repair-resource / payoff / route-bridge 分支挑选；选择后 run 内加卡；restart 清空；测试覆盖分支顺序和边界。 | 奖励只有加卡；没有跳过、移除、升级、替换、稀有度、权重、路线锁、reroll、奖励代价、boss/商店节点。 | 先给 RewardChoice 增加 `kind = add-card | upgrade-card | remove-card | skip` 合同，但 P0/P1 只实现 add-card 和 skip。reroll 可留到 run modifier runtime 化之后。 | P1 |
| 13 | 卡实例、升级与同名差异 | 当前 `deck/hand/drawPile/discardPile` 都是 `CardId[]`，足够样片快速推进；测试固定 reward 加的是 CardId。 | 无 `CardInstanceId`，无法表达升级、临时降费、复制牌、生成牌、同名不同状态、战斗内修改、永久修改。 | 不要立刻全量迁移。先增加可选实例层适配：`CardRef = CardId | CardInstanceRef` 的设计文档与测试夹具；等消耗/保留/状态牌稳定后再迁移。 | P2 |
| 14 | paper_shatter 顶终结样片 | 已有 `preDrawTopdeckPayoff`；只搜 drawPile；命中发 `PayoffTopdecked`，miss 发 `PayoffTopdeckMissed`；命中早于抽牌；浏览器 QA 验证 HUD 可见。 | 这是窄样片，不是通用重排/检索/顶牌系统；`lantern_captain` 明确不触发；不能选择目标牌、不能查 discard、不能多张排序。 | 保持样片冻结。下一步若要扩展，先抽象 `SearchSpec + MoveCardToTop` 合同，而不是直接给更多卡复制 paper_shatter 特例。 | P1 |
| 15 | 敌人意图与卡牌交互 | 发牌时快照前排 attack 意图；payoff 记录 prevented intent damage；结束回合按快照攻击；UI/测试可观察压迫。 | 意图种类只有 attack；没有 block/buff/debuff/spawn/move/status-injection；卡牌不能打断、眩晕、篡改意图或按意图选目标。 | 在 EnemyIntent 加 `kind` 扩展合同，先补 `attack | status-inject | guard` 的类型和事件，不急着做完整 AI。卡牌目标系统要能选 highest-intent。 | P1 |
| 16 | Run 层与局外/遗物 | 有 `run.currentNode/maxNodes/status/rewardHistory`；短 run 可胜利/失败；restart 清空；run modifier draft 明确 preview-only。 | 没有 relic inventory、run modifier runtime 应用、商店、节点地图、局外货币、永久解锁、存档恢复；当前不能支持类卡牌 roguelike 的长期结构复刻。 | 第10轮不要直接做 meta。先把 current-run modifier 从 preview-only 变成可选 runtime 输入，并保持 `not-meta-progression` 边界。遗物触发等 TriggerSpec 稳定后再接。 | P2 |

## 3. 当前“足够”的范围

当前足够支撑以下交付：

- Redline 风格 0->1->2->3 费用链样片。
- 当前 MP 与临时授权边界演示。
- Wild 修补费用链演示。
- 3费全场终结与敌人意图防止伤害演示。
- 击杀 XP、升级奖励三选一、run 内加卡演示。
- `paper_shatter` 顶终结窄样片。
- 浏览器 HUD 可读性和小屏不超框验收。

这些足以证明“卡牌战斗最小闭环成立”，但不足以证明“完整卡牌机制结构已经可 1:1 承载”。

## 4. 当前“不足”的范围

若目标是完整机制结构复刻，以下能力仍不能跳过：

- 统一牌区移动合同。
- 抽、弃、洗、消耗、保留、状态牌的真实生命周期。
- 卡牌声明式效果列表。
- 卡牌/状态/遗物通用触发点。
- 扩展目标选择。
- 卡实例与升级路径。
- 奖励类型扩展，不只是加卡。
- run modifier / relic runtime 化，但不混入 meta 成长。

这批能力是结构性底座，不是“多加几张牌”可以绕过的。

## 5. 第10轮是否应继续写代码

结论：第10轮可以继续写代码，但不应继续写“新样片代码”。

推荐裁决：

1. 当前专家02只交付本文档，不写代码。
2. 第10轮后续实现者若继续写代码，只允许进入 P0 机制合同补齐：
   - `CardMoved/CardDrawn/CardDiscarded/DeckReshuffled` 事件。
   - `exhaustPile` 与 `lifecycle.onPlay`。
   - `retain` 下回合带入。
   - 1 张物理 status 测试牌。
   - 对现有 0->1->2、Wild、paper_shatter、reward 的回归测试。
3. 第10轮不应继续做：
   - 新 payoff 花样。
   - 新通用 reorder 样片。
   - 新卡名/新文案堆量。
   - UI 大改。
   - relic/meta/商店大系统。

如果团队只想收束 demo，第10轮应停止机制代码，只做最终说明、验收报告和边界文档。  
如果团队坚持“1:1机制结构复刻”，第10轮必须继续写代码，但应从 P0 生命周期底座写起，而不是扩展内容。

## 6. 最小执行顺序

建议后续以四个小切片推进：

| 顺序 | 切片 | 验收 |
| --- | --- | --- |
| 1 | 统一牌区移动事件 | 打出、回合末弃牌、抽牌、回填都有结构化事件；旧测试不退。 |
| 2 | 消耗 + 保留 | 1 张消耗牌不洗回；1 张保留牌下回合留在手牌并补抽到上限。 |
| 3 | 物理状态牌 | 状态牌可被创建到牌区、抽到占手、按生命周期清理。 |
| 4 | 触发/效果合同草案 | 不全量迁移旧牌，只让 1-2 张测试牌走 `EffectSpec` / `TriggerSpec`。 |

## 7. 最终裁决

当前机制合同评分：`样片闭环 8/10；完整卡牌机制结构 4/10；可继续扩展性 5/10`。

判定：

```text
当前不够支撑“完整 1:1 机制结构复刻”。
它已经支撑一个可演示的 Redline 卡牌闭环，但还缺卡牌游戏通用生命周期、触发、效果、目标、实例和奖励扩展底座。
第10轮不应继续堆内容；若写代码，只写 P0 机制合同补齐。
```

STATUS: DONE
