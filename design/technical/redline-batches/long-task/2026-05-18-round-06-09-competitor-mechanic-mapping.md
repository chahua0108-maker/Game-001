# 2026-05-18 Round 06 Expert 09：竞品机制映射研究员

## 0. 边界

- 工作目录：`/Users/roc/Game-001`
- 角色：第 6 轮专家 09，竞品机制映射研究员
- 任务：把当前 Redline demo 的修补、抽牌、临时资源、重排机制，映射到 Slay the Spire / Monster Train / Wildfrost 等卡牌 roguelike 的机制结构。
- 输出边界：只新增本文档；不改源码、不跑 commit。
- 复刻边界：只抽象机制结构，不复制第三方卡名、原文、美术或数值模板。

读取依据：

- `prototype-web/src/data/cards.ts`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/eca/redlineRules.ts`
- `design/technical/redline-batches/long-task/2026-05-18-round-04-06-card-mechanic-replica-checklist.md`
- `design/technical/redline-batches/long-task/2026-05-18-round-05-07-card-replica-scope-pm.md`
- `design/technical/redline-batches/long-task/2026-05-18-round-05-synthesis.zh.md`
- `design/technical/redline-batches/long-task/2026-05-18-round-03-04-repair-card-tuning.md`

## 1. 一句话结论

当前 Redline 已经具备卡牌 roguelike 的一条可复刻主轴：4 张手牌、抽牌堆 / 手牌 / 弃牌堆、回合资源、`0 -> 1 -> 2` 链路、完成链路后获得本回合 payoff-only 临时资源、奖励加卡进入当前 run，并已开放 `blood_tithe / pulse_draw` 作为抽牌修补奖励。

但它还没有完成“1:1 结构复刻”的关键闭环。最明显的缺口不是卡少，而是四类机制还不够像同类游戏的真实结构：

1. 抽牌循环缺少随机洗牌、牌区移动事件和手牌上限 / 抽牌失败反馈。
2. 修补牌有结构雏形，但 `wild_mana_stitch` 把修补、抽牌、返 MP 堆在一张 0 费牌上，缺少同类游戏常见的代价边界。
3. 临时资源已有 `tempAuthorizationMP`，但支付账本、清空时机和“只可支付 payoff”的玩家可读性仍需强化。
4. `reorder` 目前只是 metadata / 文案标签，没有任何牌库预视、置顶、弃到底或重抽动作；这是最不像真实卡牌 roguelike 的部分。

第 6 轮最值得 1:1 复刻的不是“更多遗物 / 升级 / 诅咒”，而是先把“坏手修补四件套”做实：抽牌、Wild 补缺口、临时授权、真实重排。

## 2. 机制抽象映射

### 2.1 牌区循环：Redline 已接近基础结构，但还偏确定性脚本

| 抽象结构 | 同类卡牌 roguelike 常见形态 | 当前 Redline 映射 | 复刻差距 |
| --- | --- | --- | --- |
| 抽牌堆 / 手牌 / 弃牌堆 | 每回合从抽牌堆抽固定手牌，回合末弃掉未用手牌；抽牌堆空时弃牌堆洗回。 | `deck / hand / drawPile / discardPile` 已存在；`DealHand` 发 4 张；`DiscardHand` 统一弃手牌。 | 回填是确定性顺序，不是 seeded shuffle；没有 `CardDrawn / CardDiscarded / CardMoved / Shuffled` 事件。 |
| 打出牌生命周期 | 打出后通常进弃牌堆；部分牌会消耗或保留。 | `DiscardPlayedCard` 把打出的牌放入 `discardPile`。 | 没有消耗堆、保留、临时牌清除、状态牌污染。 |
| 奖励加卡进入循环 | 当前 run 获得新牌，之后进入抽牌循环；有些游戏会让新牌很快出现。 | `AddCardToDeck` 同时 `deck.push` 和 `drawPile.unshift`；非终局奖励先加卡再发下一手。 | 这一点已达 P0 复刻要求；后续要补的是来源事件和实例身份。 |
| 坏手处理 | 通过抽牌、弃牌、保留、重抽、预视 / 重排解决坏手。 | 当前主要靠 self draw 和 Wild 修补。 | 缺选择弃牌、保留、真实重排、整手重抽等玩家主动坏手处理。 |

判断：Redline 的牌区循环已经可以承载 P0 卡牌复刻，但不是完整底座。第 6 轮不必立刻做 `CardInstanceId`，但至少要把重排和牌区事件做出真实动作，否则 `reorder` 牌会继续停在“看起来像卡牌游戏”的阶段。

### 2.2 抽牌：应复刻“cantrip / 过牌找解”的结构，而不是只写抽牌数字

| 抽象结构 | 同类结构 | 当前 Redline 映射 | 当前风险 |
| --- | --- | --- | --- |
| 0 费过牌 | 牺牲即时伤害，用低成本找下一段。 | `blood_tithe`：0 MP，self，抽 1，reward，`repair-resource`。 | 合理；不能再加伤害、返 MP 或 Wild，否则会抢过攻击牌职责。 |
| 1 费过牌承接 | 消耗资源维持路线，接上后抽更多或找关键牌。 | `pulse_draw`：1 MP，self，抽 1；按链路倍率实际可抽 2。 | 文案已提示 `抽1/2`，但运行时仍没有 `CardDrawn` 事件和抽牌不足反馈。 |
| 2 费找终结 | 在完成展开段时找高费 payoff 或下一段。 | `paper_shatter / lantern_captain`：2 MP，self，抽 1，`reorder` tag。 | 如果没有真实重排，它们只是“2 费抽牌”，不能承诺整备 / 排序。 |
| 抽牌倍率 | 顺链后效果被放大，形成“打对顺序就找到更多解”的正反馈。 | `drawCards * effectMultiplier` 已实现，HUD 已显示 `抽2 / 抽3`。 | 结构成立，但要防止所有 self draw 都因倍率变成无脑最优。 |
| 防止立即抽回自己 | 抽牌牌打出后通常不应在同次抽牌中马上回手，除非有明确规则。 | `excludeFromReshuffle` 已防止刚打出的抽牌牌立刻洗回。 | 这是好护栏，应保留；后续需要事件测试锁住。 |

1:1 结构复刻的重点：保留“低伤害 / 低压力处理换稳定性”的 tradeoff。抽牌牌不能同时承担修补、返费、伤害、找终结四个职责，否则会破坏卡牌 roguelike 最核心的取舍。

### 2.3 修补：Redline 的 Wild 已有独特价值，但需要拆清“支付成本”和“链路成本”

| 抽象结构 | 同类结构 | 当前 Redline 映射 | 当前风险 |
| --- | --- | --- | --- |
| 费用缺口修补 | 当手牌缺少某个费用段时，用一张灵活牌维持路线。 | `utilities: ['wild']` 的牌在链已开始且未断时，按 `nextExpectedCost` 参与链路。 | 结构方向正确。 |
| 支付成本不等于链路成本 | 某张牌可以支付自身费用，但在路线中承担另一个节点。 | `wild_gap_key` 支付牌面 1 MP；链路上可视为当前缺口。`wild_mana_stitch` 支付 0 MP，也可补缺口。 | UI 必须明确“支付牌面，修补缺口”；否则玩家会误解为资源免费改写。 |
| 修补成功事件 | 真实卡牌系统通常会让补链、触发、奖励或日志可追踪。 | 当前有 `ChainRepaired`，字段含 `repairedCost / nextExpectedCost / multiplier`。 | 事件可用，但没有更独立的 `repairSource / paidCost / virtualCost` 账本。 |
| 修补代价 | 灵活牌通常要损失伤害、消耗、限制目标、只触发一次或需要条件。 | `wild_gap_key` 低伤害；`wild_mana_stitch` 0 费、抽牌、返当前 MP。 | `wild_mana_stitch` 过于全能，最容易破坏 1:1 复刻的代价结构。 |

最值得复刻的是“Wild 作为路线保险，而不是万能牌”。`wild_gap_key` 更接近健康的同类结构：低伤害、要付费、解决缺口。`wild_mana_stitch` 应改成条件返费，或至少把返 MP 从无条件改为“修补成功后才给”。

### 2.4 临时资源：Redline 的 payoff-only 授权很有辨识度，应按 turn-scoped resource 复刻到底

| 抽象结构 | 同类结构 | 当前 Redline 映射 | 当前风险 |
| --- | --- | --- | --- |
| 回合资源 | 每回合刷新，用来支付卡牌，本回合未用通常失效。 | `energy / maxEnergy`，发牌时恢复到 3。 | 已成立；不要在本轮混入永久 Max MP 成长。 |
| 临时资源 | 卡牌或连锁给本回合额外支付能力，离开回合清空。 | 完成未断裂 `0 -> 1 -> 2` 后，`tempAuthorizationMP += 3`。 | 很适合 Redline，但需要更清楚的账本和 UI。 |
| 受限资源 | 临时资源只能支付特定牌或特定类型，避免变成泛用能量。 | `authorizationRestriction = 'payoff-only'`，只支付 3 MP 全场 `burst` payoff。 | 结构正确；混合支付时需要让玩家看到当前 MP 与授权 MP 分别付了多少。 |
| 清空时机 | 临时资源在回合结束、发新手牌或状态切换时消失。 | `resetCostChain` 会清空授权；离开 PlayerTurn 后重置。 | 需要显式事件 / 日志，不然玩家可能以为授权能跨回合。 |
| 资源与 payoff 绑定 | 完成前置路线后打出高收益终结。 | `severance_burst / red_ledger_burst` 可用授权支付。 | 当前 unarmed payoff 主要靠倍率低来降收益，没有明确 unarmed penalty；可以后置。 |

竞品结构给 Redline 的启发不是“加更多能量”，而是“临时资源必须有清楚生命周期、用途限制和支付反馈”。Redline 的 payoff-only 授权是本项目比普通能量系统更有辨识度的点，应该保留并做实。

### 2.5 重排：当前是最大缺口，应优先从“预视并重排牌库顶”做 P0

| 抽象结构 | 同类结构 | 当前 Redline 映射 | 当前风险 |
| --- | --- | --- | --- |
| 预视牌库顶 | 玩家看到接下来若干张牌，并决定保留、置底或重排顺序。 | `paper_shatter / lantern_captain` 有 `utilities: ['reorder']`。 | 没有运行时命令、事件或 UI；目前不能算真实机制。 |
| 重抽 / 换手 | 玩家主动把坏手换成新手，通常付出回合、冷却或资源代价。 | 无。 | Wildfrost 类结构最核心的“整手坏手修补”没有对应物。 |
| 保留 / 锁定下一手 | 让关键牌跨回合或下回合稳定出现。 | 无。 | Monster Train / Wildfrost 类“确保关键牌出现”的结构没有对应物。 |
| 置顶奖励牌 | 新牌或特定牌进入下次抽牌顶部。 | 奖励牌 `drawPile.unshift`，下一手可见。 | 这是局部置顶，不是玩家主动重排。 |

第 6 轮如果要修补“1:1 复刻”，最应该把 `reorder` 从标签变成动作。建议不要一上来做复杂 UI，P0 可以是：

```text
ReorderTopDeck(count = 3):
  1. 查看 drawPile 顶部至多 3 张。
  2. 玩家或测试脚本选择其中 1 张置顶，其余保持原顺序或置底。
  3. 发 ReorderPreviewed / DrawPileReordered 事件。
  4. HUD 写“整备：从牌库顶3张选1张置顶”，不再只是“找路线”。
```

如果 UI 成本过高，P0 也可以先做 deterministic 结构：`paper_shatter` 把抽牌堆中最近的 payoff 置顶，但必须有命令和事件；不能继续只留 tag。

## 3. 当前 demo 缺口

### 3.1 抽牌缺口

- 没有 seeded random shuffle；弃牌堆回填到抽牌堆是确定性顺序。
- 没有 `CardDrawn`、`CardDiscarded`、`CardMoved`、`DiscardPileShuffled` 等粒度事件。
- `DrawCards` 抽不到足够牌时没有专门反馈，只靠 `HandDealt.cardIds.length` 间接体现。
- 没有手牌上限、抽牌溢出、选择弃牌、抽后弃牌、下回合抽牌等同类常见结构。
- 抽牌牌的强度完全受链路倍率放大，缺少“抽牌牌不吃倍率 / 只部分吃倍率 / 有上限”的平衡阀门。

### 3.2 修补缺口

- Wild 的“支付牌面成本”和“链路视为缺口成本”还没有足够可视化。
- `wild_mana_stitch` 同时 0 费、Wild、抽牌、返当前 MP，结构上过度集中。
- 没有“修补次数限制”“本回合只能修补一次后降效”“修补失败不返费”等代价规则。
- `ChainRepaired` 有了，但缺少 `paidCost / virtualCost / repairSource` 这类复盘字段。

### 3.3 临时资源缺口

- `tempAuthorizationMP` 的清空对玩家不够显式；需要日志或 HUD 说明“本回合终结授权已失效”。
- 混合支付的可读性不够强：玩家需要知道一张 3 MP payoff 是用当前 MP、授权 MP，还是两者混合支付。
- `GainEnergy` 是当前 MP 增加，不乘倍率；这一点合理，但 UI 应避免被误读为永久成长。
- 没有更通用的 `turn-scoped resource ledger`，后续如果加入临时降费、临时抽牌、临时牌，会继续散落。

### 3.4 重排缺口

- `reorder` 目前没有任何 runtime 行为，这是本主题里最直接的“未复刻”。
- 没有牌库顶预视 UI。
- 没有选择置顶、置底、丢弃、保留或锁定下一手。
- 没有 `DrawPileReordered` 事件，测试只能断言“不产生 reorder 行为”。
- `paper_shatter / lantern_captain` 两张 2 MP self draw 在机制上重复，且都背着未兑现的整备承诺。

## 4. 最值得 1:1 结构复刻的机制

| 优先度 | 机制 | 为什么值得复刻 | Redline 适配方式 | 不应复刻成什么 |
| --- | --- | --- | --- | --- |
| 1 | 真实重排 / 预视牌库顶 | 这是同类游戏解决坏手和构筑计划感的核心工具；当前 Redline 只有标签。 | 先做 `看顶3，选1置顶` 或 `找 payoff 置顶` 的小闭环。 | 不做大 UI、不做全牌库搜索、不做随机“抽到就算”。 |
| 2 | Wild 修补的代价边界 | 修补是 Redline 的核心差异点；必须像真实卡牌机制一样有代价。 | `wild_gap_key` 做健康模板；`wild_mana_stitch` 改为修补成功才返 MP。 | 不让 0 费牌同时补链、抽多张、返 MP 且无条件。 |
| 3 | 临时授权资源账本 | payoff-only 授权是 Redline 的独特资源结构，值得强化。 | HUD / 事件分开显示当前 MP 与授权 MP 支付，离回合清空。 | 不改成永久 Max MP，不开放给所有卡支付。 |
| 4 | 抽牌牌的 cantrip 结构 | `blood_tithe / pulse_draw` 已开放，正好承担坏手修补。 | 保持低伤害或无伤害，做“找解”而不是“输出”。 | 不给所有抽牌牌加伤害、返费、Wild。 |
| 5 | 牌区移动事件 | 后续消耗、保留、状态、重排都依赖它。 | 不迁移实例也可先补事件：draw/discard/shuffle/reorder。 | 不在第 6 轮直接做完整 `CardInstance` 大迁移。 |

## 5. P0 / P1 / P2 建议

### P0：把四个当前主题做成真实闭环

1. **实现最小真实重排**
   - 给 `reorder` 增加命令和事件，例如 `PreviewDrawPile`、`ReorderDrawPile`、`DrawPileReordered`。
   - P0 推荐只支持“看抽牌堆顶 3 张，选 1 张置顶，其余保持原顺序”。
   - 如果暂时不能做交互 UI，先做测试可控的 deterministic 置顶逻辑，并在 HUD 明确写出当前规则。

2. **修正 `wild_mana_stitch` 的全能性**
   - 首选：`energyGain` 只在真实 `ChainRepaired` 时触发。
   - 数据兜底：先移除无条件 `energyGain`，保留修补 + 抽牌。
   - 保留 `wild_gap_key` 作为更健康的低伤害付费修补模板。

3. **强化临时授权账本**
   - 事件和 HUD 同时区分：当前 MP、授权 MP、payoff-only 限制。
   - payoff 支付后显示 `currentEnergyPaid / authorizationPaid`。
   - 回合结束或重新发牌时显式记录授权清空，不让玩家误读为跨回合资源。

4. **补抽牌与牌区事件**
   - 不需要上 `CardInstanceId`，但应补 `CardDrawn / CardDiscarded / DiscardPileRefilled` 或等价事件。
   - `DrawCards` 抽牌不足时记录实际抽到数量。
   - 继续保护 `excludeFromReshuffle`，确保抽牌牌不会同次立刻抽回自己。

5. **收敛 2 MP 重复支援牌**
   - `paper_shatter` 和 `lantern_captain` 不要在同一阶段都承担同构“2 MP 抽1 + reorder tag”。
   - P0 只选一张作为真实重排样板，另一张保留为后续角色 / 路线差异化素材。

### P1：扩展坏手处理，但仍不进入完整卡牌大迁移

1. **Seeded shuffle**
   - 抽牌堆空时把弃牌堆 seeded shuffle 回抽牌堆。
   - 保证测试可重复，避免当前确定性回填让玩家过早背脚本。

2. **选择弃牌 / 整手重抽**
   - 复刻 Wildfrost 类“玩家主动修坏手”的结构，但改成 Redline 语义。
   - 可选方案：消耗一次本回合行动 / 当前 MP / 重排冷却，弃掉若干手牌并补抽。

3. **保留或锁定下一手**
   - 先做一张牌或一个关键词：回合末不弃，下一手占手牌位置后补抽。
   - 用来复刻 Monster Train / Wildfrost 类“关键牌稳定出现”的结构。

4. **效果解释器最小化**
   - 把 `drawCards / energyGain / reorder / repair` 从散字段逐步收敛成可追踪的 effect command。
   - 不要求一次迁移所有卡，只要新机制不再写硬编码分支。

### P2：完整卡牌 roguelike 底座

1. **CardInstance**
   - 支持同名牌不同升级、临时降费、复制体、来源、一次性修补次数。

2. **消耗、状态、诅咒**
   - 增加 `exhaustPile`、物理状态牌、长期负面牌和净化入口。
   - 这会让抽牌 / 重排从“只找好牌”变成“管理污染和风险”。

3. **遗物 / 被动触发器**
   - 接 `onDraw / onDiscard / onShuffle / onRepair / onAuthorizationGranted / onPayoffResolved`。
   - Redline 的独特触发点应优先是 `onRepair` 和 `onAuthorizationGranted`，而不是照搬通用加伤害遗物。

4. **升级与构筑分层**
   - 让抽牌牌、修补牌、重排牌形成明确升级方向：更稳定、更便宜、更多预视、更强代价回收。
   - 不把所有升级都做成纯数值加伤害。

## 6. 第 6 轮落地裁决

本轮如果只允许挑一个机制做 1:1 复刻，选 **真实重排**。理由很直接：抽牌、修补、临时授权都已经有运行时雏形，只有重排目前仍完全停留在标签层。只要 `paper_shatter` 或 `lantern_captain` 能真的预视并改变抽牌堆，Redline 的坏手修补层就会从“抽牌找运气”前进到“计划下一张牌”。

如果允许做两个机制，第二个选 **`wild_mana_stitch` 条件返 MP**。这能立刻把修补牌从“全能福利”拉回同类卡牌 roguelike 的代价结构：修补成功才返资源，普通打出只承担抽牌或路线功能。

最终优先级：

```text
P0-1: reorder 从 tag 变成真实牌库顶操作
P0-2: wild_mana_stitch 返 MP 改成修补成功条件
P0-3: 临时授权支付 / 清空账本可视化
P0-4: CardDrawn / CardDiscarded / DiscardPileRefilled 事件
P1: seeded shuffle、选择弃牌 / 重抽、保留
P2: CardInstance、消耗 / 状态 / 诅咒、遗物触发器、升级
```

STATUS: DONE
