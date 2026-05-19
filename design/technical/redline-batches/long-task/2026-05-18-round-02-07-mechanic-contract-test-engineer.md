# Game-001 第 2 轮专家 07：机制契约测试工程师

日期：2026-05-18  
工作目录：`/Users/roc/Game-001`  
输出边界：只读当前 `prototype-web/src/tests`、第 1 轮长任务文档与第 2 轮控制目标；不修改源码，不提交 git。  

## 0. 审查结论

当前 Vitest 已经覆盖大量 runtime 主干：发牌、出牌、费用链、临时终局授权、奖励三选一、run/meta 隔离、默认最高意图目标、HUD 纯函数意图预览。下一批测试不应该再堆大而全的验收脚本，而应该补 5 个小型契约面：

1. 生命周期字段与牌区移动的最小合同。
2. runtime 默认目标与 HUD 默认目标保持同一排序规则。
3. 意图预览只读 `snapshot.enemyIntents / enemyIntentSummary`，不重新猜当前前排伤害。
4. 奖励节奏从“能选奖励”推进到“奖励阈值、下一阈值、奖励可见性”。
5. 效果解释器上线前后，legacy 卡牌行为完全兼容。

本轮建议全部继续使用 Vitest node 环境，不引入 Playwright、jsdom、happy-dom 或浏览器依赖。

## 1. 读取到的当前测试现状

| 范围 | 当前文件 | 现状判断 |
| --- | --- | --- |
| runtime 主干 | `prototype-web/src/tests/sim/runtime.test.ts` | 已覆盖基础发牌、出牌、抽牌、伤害、链路、payoff、敌人攻击。 |
| 回归漏洞 | `prototype-web/src/tests/sim/runtime-audit.test.ts` | 已覆盖同 tick 结束回合后输入、空抽牌堆自抽、补位。 |
| 默认目标 | `prototype-web/src/tests/sim/core-loop-regression.test.ts` | 已有“未给目标时自动打最高当前前排意图”的 runtime 测试。 |
| HUD 纯函数 | `prototype-web/src/tests/ui/hud-target-selection.test.ts` | 已有 `defaultHudFrontTargetId` 与 `hudCardIntentPreview` 纯函数测试。 |
| 奖励分支 | `prototype-web/src/tests/sim/reward-branching.test.ts` | 已测三选一覆盖 `repair-resource / payoff / route-bridge`。 |
| run/reward 边界 | `run-layer-boundary.test.ts`、`run-progression.test.ts` | 已测奖励只进当前 run、restart 清空、snapshot 深拷贝。 |
| 效果解释器 | 无独立测试 | 当前仍是 legacy 字段 + ECA 规则，没有 `legacyEffectsFromCard` / `resolveCardEffects` 合同。 |
| 生命周期牌区 | 无独立测试 | 只有默认弃牌、弃手牌、restart 边界；没有 `retain / exhaust / destroy / purge` 合同。 |

第 1 轮结论要求：默认目标可预测、卡牌显示 intent delta、不做完整效果解释器、不做永久 Max MP、不恢复 realtime 压力。第 2 轮控制目标是“卡牌机制契约”，即完整卡牌类型、资源、目标、状态、触发机制矩阵。本文件按这两个目标设计下一批测试。

## 2. 测试设计原则

- 只测 `sim/`、`data/`、`eca/`、`ui/hud.ts` 导出的纯 helper；不测真实 DOM、CSS、canvas。
- 每个测试只锁一个合同，不用 5 回合大脚本证明所有机制。
- fixture 可以直接调整 `world.player.hand`、敌人 HP、`reward` 状态，但不要靠随机或真实时间。
- 断言事件、命令、world 状态三者之一即可；不要同时断言过多内部细节。
- 对未来解释器测试，先以 legacy 行为兼容为目标，不把 P1/P2 新机制一次塞进测试。

## 3. 建议新增 / 调整的测试文件

### P0-1：默认目标一致性

建议文件：`prototype-web/src/tests/sim/default-target-contract.test.ts`

目的：把第 1 轮已经落地的“默认最高意图目标”从单点测试升级为 runtime + HUD 一致性合同，避免未来 target resolver 或 HUD helper 分叉。

#### 用例 1：runtime 与 HUD 在无手动目标时选同一敌人

Given：
- 创建初始 world 并发牌。
- 构造前排 3 个敌人：A 意图 2、B 意图 5、C 意图 3。
- 手牌只有 `debt_hook`。

When：
- 使用 `buildSnapshot(world)` 调用 `defaultHudFrontTargetId(snapshot)`。
- 不传 `targetId` 执行 `play-card debt_hook`。

Then：
- HUD 默认目标为 B。
- `CardPlayed.targetId` 为同一个 B。
- 只有 B 扣血。
- 没有 `front-target` / `target-alive` failedCondition。

#### 用例 2：意图相同时按低 HP，再按 slot 稳定排序

Given：
- 前排两个敌人都有 5 点 intent。
- 左侧敌人 HP 12，右侧敌人 HP 4。

When：
- HUD helper 与 runtime 默认目标分别运行。

Then：
- 两者都选择 HP 更低的右侧敌人。
- 如果 HP 也相同，则选择 slot 更小的敌人。

#### 用例 3：手动合法目标覆盖默认目标

Given：
- 最高 intent 是 enemy-2。
- 玩家手动传入合法前排目标 enemy-1。

When：
- 执行 `play-card redline_cut targetId=enemy-1`。

Then：
- `CardPlayed.targetId` 为 enemy-1。
- 默认目标排序不会覆盖玩家选择。

### P0-2：意图预览契约

建议文件：`prototype-web/src/tests/ui/hud-intent-preview-contract.test.ts`，或继续扩展 `hud-target-selection.test.ts`。

目的：锁住纯函数级意图预览，不引入 DOM。重点不是文案样式，而是 before/after/prevented/targetId 是否来自 snapshot 真相源。

#### 用例 1：预览只减少被击杀的 active intent

Given：
- snapshot 中 `enemyIntentSummary.totalDamage = 10`。
- enemy-1 有 intent 5，HP 4。
- enemy-2 有 intent 5，HP 20。
- 使用 `row_cleave`，倍率 1，伤害 5。

When：
- 调用 `hudCardIntentPreview(row_cleave, snapshot, null, 1)`。

Then：
- `before = 10`。
- `prevented = 5`，只计算会被击杀的 enemy-1。
- `after = 5`。
- 不因为 enemy-2 受到伤害但未死亡而减少 intent。

#### 用例 2：补位到前排但无本回合 intent 的敌人不参与预览收益

Given：
- snapshot 前排有 enemy-9，alive，slot 在前排，但 `enemyIntents` 中没有 enemy-9。
- `enemyIntentSummary.totalDamage` 只包含 enemy-1。

When：
- 单体牌或前排牌会击杀 enemy-9。

Then：
- `prevented` 不包含 enemy-9。
- 预览不会把“下轮敌人”误读成本回合威胁。

#### 用例 3：self / draw / mana 牌不承诺 intent 下降

Given：
- snapshot 有 active intent。
- 卡牌为 `pulse_draw` 或 `wild_mana_stitch`。

When：
- 调用 `hudCardIntentPreview`。

Then：
- `before === after`。
- `prevented = 0`。
- label 只表达“抽牌找解 / 返MP找解”，不写 `意图 X->Y`。

### P0-3：奖励节奏合同

建议文件：`prototype-web/src/tests/sim/reward-cadence-contract.test.ts`

目的：当前测试证明“奖励能产生、能选择”，但没有锁首奖节奏、阈值单调和奖励进入可操作资源的时机。这个文件要小，不做全局平衡模拟。

#### 用例 1：首奖后下一阈值必须大于当前 XP

Given：
- 创建 world。
- 把 `reward.xpThreshold` 设置到一个低值以稳定触发首奖。
- 击杀敌人触发 `LevelUpReached`。

When：
- reward pending 后检查 `world.player.xp` 与 `world.reward.xpThreshold`。

Then：
- `world.reward.pending = true`。
- `world.reward.xpThreshold > world.player.xp`。
- 防止出现“第一次阈值 45，下一阈值回退到 42”这类节奏错误。

#### 用例 2：Reward 阶段互斥输入不污染战斗

Given：
- world 处于 `Reward`，有 3 个 pending choices。
- 记录 hand、energy、deck、reward choices。

When：
- 发送 `play-card`。
- 发送 `end-turn`。
- 发送不在 choices 内的 `select-reward`。

Then：
- 不产生 `CardPlayed` 或 `TurnEnded`。
- energy、hand、deck、choices 不变。
- 分别记录 `player-turn` 或 `reward-choice` failedCondition。

#### 用例 3：选择奖励后的可见性合同明确

Given：
- world 处于 Reward，choices 包含 `severance_burst`。

When：
- 执行 `select-reward severance_burst`。

Then：
- `RewardChosen` 与 `CardAddedToDeck` 都存在。
- 选中的牌进入 `player.deck`。
- 选中的牌进入 `player.drawPile`，并且测试明确当前合同是“进入后续抽牌循环”，不是“必定进入刚发出的下一手”。
- 如果产品裁决改成“下一手可见”，本用例应同步改为断言发牌顺序，而不是额外写一份相反测试。

### P1-1：生命周期最小合同

建议文件：`prototype-web/src/tests/sim/card-lifecycle-contract.test.ts`

目的：为第 2 轮卡牌机制契约准备红线。当前代码还没有 `lifecycle` 字段、`exhaustPile`、`retainedCards`，所以此文件应在生命周期字段落地时再写；不建议现在用 `as any` 硬造不存在的字段。

#### 用例 1：legacy 卡默认 onPlay 进入 discard

Given：
- 发牌后手牌只有 `debt_hook`。
- `debt_hook` 没有显式 lifecycle 字段。

When：
- 打出 `debt_hook`。

Then：
- 手牌不再包含该牌。
- `discardPile` 包含该牌。
- 不进入 `exhaustPile` 或 `retainedCards`。
- 若未来引入 `CardMoved`，则事件为 `from=hand / to=discard / reason=played-default`。

#### 用例 2：retain 牌在结束回合时不被 DiscardHand 清掉

Given：
- 增加一张测试用或真实 retain 牌，生命周期为 `onTurnEnd=retain`。
- 玩家回合中该牌留在手牌。

When：
- 执行 `end-turn` 并进入下一回合发牌。

Then：
- retain 牌仍在下一回合手牌或保留区恢复到手牌。
- 非 retain 牌进入 discard。
- chain 与临时授权仍按 turn 生命周期清空。

#### 用例 3：exhaust 牌打出后离开循环

Given：
- 增加一张测试用或真实 exhaust 牌，生命周期为 `onPlay=exhaust`。

When：
- 打出该牌，然后多次结束回合并让 discard 洗回 drawPile。

Then：
- 该牌不出现在 drawPile / discardPile / hand。
- `exhaustPile` 包含该牌。
- 如有 `CardMoved`，事件必须可追踪。

### P1-2：效果解释器兼容合同

建议文件：`prototype-web/src/tests/sim/effect-interpreter-compat.test.ts`

目的：第 1 轮效果引擎建议引入 `legacyEffectsFromCard` 和 `resolveCardEffects`。这批测试只证明“解释器替换 ECA 分支后，现有卡牌行为不变”，不要提前测试完整状态/触发器生态。

#### 用例 1：legacy 单体伤害映射为同等 DamageEnemy command

Given：
- `debt_hook`、目标 enemy-1、倍率 1。
- 使用解释器解析 legacy card effect。

When：
- 执行或直接检查解释器输出 command。

Then：
- 输出一个 `DamageEnemy`。
- targetId 为 enemy-1。
- amount 为 `cards.debt_hook.damage * effectMultiplier`。
- 不额外输出 DrawCards / GainEnergy。

#### 用例 2：legacy 前排伤害命中当前前排所有活敌

Given：
- `row_cleave`，倍率 3。
- 前排 5 个活敌，后排若干活敌。

When：
- 解释器解析 `CardPlayed(row_cleave)`。

Then：
- 输出 5 个 `DamageEnemy`。
- 每个 amount 为 `cards.row_cleave.damage * 3`。
- 不命中后排。

#### 用例 3：legacy self 资源牌保持抽牌倍率与回能不倍率

Given：
- `wild_mana_stitch`，倍率 2。

When：
- 解释器解析该卡。

Then：
- 输出 `DrawCards.count = drawCards * 2`。
- 输出 `GainEnergy.amount = energyGain`，不乘倍率。
- 仍带有避免同次洗回当前牌的策略，或由 runtime 在 command 上补 `excludeFromReshuffle`。

#### 用例 4：legacy payoff 仍记录 prevented intent evidence

Given：
- `severance_burst`，armed，倍率 4。
- world 有 active enemy intents。

When：
- 通过解释器路径打出 payoff。

Then：
- 仍产生 `PayoffTriggered`、`ClearBurstRequested`、`PayoffResolved`。
- `PayoffResolved.intentDamageBefore / intentDamageAfter / preventedIntentDamage` 与旧路径一致。
- 这条测试用于保证解释器迁移没有吃掉第 1 轮 intent 反馈合同。

## 4. 本轮优先级

| 优先级 | 测试 | 原因 |
| --- | --- | --- |
| P0 | `default-target-contract.test.ts` | 当前已有功能，但 runtime 与 HUD 各自实现排序；最容易在后续 target resolver 拆分时分叉。 |
| P0 | `hud-intent-preview-contract.test.ts` | 第 1 轮核心体验依赖 intent delta；纯 helper 可测，不需要浏览器。 |
| P0 | `reward-cadence-contract.test.ts` | 奖励系统已存在但节奏合同不足，尤其首奖阈值单调和 Reward 阶段互斥需要先锁。 |
| P1 | `effect-interpreter-compat.test.ts` | 等解释器 adapter 出现后立刻写，目标是保护 legacy 行为，不扩大机制。 |
| P1 | `card-lifecycle-contract.test.ts` | 等生命周期字段和牌区容器落地后写；现在先作为红线规格，不建议用假字段强测。 |

## 5. 不建议本轮写的测试

- 不写 Playwright / 浏览器 layout 测试；本角色目标是机制契约，不处理 CSS 超框。
- 不复活 `redline-90s-acceptance.test.ts` 的 realtime 口径；当前方向是回合制敌意图压力。
- 不写大规模 30 张牌 taxonomy 测试；第 2 轮先锁字段和兼容，不用一次扩全牌池。
- 不测随机奖励权重；当前 reward 仍是确定性分支选择，随机 seed 不是本批最小合同。
- 不用测试通过“偷偷把 MP 改到 6”证明 payoff，仍以临时授权作为 3 费终结牌解释。

## 6. 建议执行顺序

1. 先补 `default-target-contract.test.ts`：最快发现 HUD/runtime 目标规则是否分叉。
2. 再补 `hud-intent-preview-contract.test.ts`：把 intent delta 的纯函数合同锁死。
3. 再补 `reward-cadence-contract.test.ts`：Reward 阶段互斥与阈值单调优先于数值平衡。
4. 解释器 adapter 出现后补 `effect-interpreter-compat.test.ts`，先只覆盖 legacy 四类效果。
5. 生命周期字段出现后补 `card-lifecycle-contract.test.ts`，先测 discard/retain/exhaust 三种，不碰升级实例化。

最终判断：下一批 Vitest 应该服务“第 2 轮机制契约可迁移”，而不是继续证明当前 demo 已能跑。默认目标、意图预览、奖励节奏是立即 P0；生命周期和效果解释器是下一步重构前必须准备的 P1 红线。
