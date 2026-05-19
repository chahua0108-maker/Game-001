# 2026-05-18 Round 07 Expert 09：竞品整备机制映射研究员

## 0. 边界

- 工作目录：`/Users/roc/Game-001`
- 角色：第 7 轮专家 09，竞品整备机制映射研究员
- 任务：把 `scry / seek / tutor / topdeck / discover / redraw` 这一组同类卡牌机制抽象映射到当前 Redline demo，判断哪一种最适合作为第 7 轮最小 1:1 结构复刻。
- 输出边界：只新增本文档；不改源码、不提交 git。
- 版权边界：只抽象机制输入、选择、牌区移动、输出和代价，不复制第三方卡名、规则原文、美术、UI 形状、音效或数值模板。

读取依据：

- `prototype-web/src/data/cards.ts`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/eca/redlineRules.ts`
- `design/technical/redline-batches/long-task/2026-05-18-round-06-03-reorder-runtime-model.md`
- `design/technical/redline-batches/long-task/2026-05-18-round-06-09-competitor-mechanic-mapping.md`
- `design/technical/redline-batches/long-task/2026-05-18-round-06-synthesis.zh.md`
- `design/technical/redline-batches/2026-05-18-current-card-mechanics-inventory-03.md`

## 1. 一句话结论

第 7 轮最适合作为最小 1:1 结构复刻的是 **受限 topdeck，也就是 Redline 语境里的“整备置顶”**。

理由很直接：当前 Redline 已经有 `drawPile[0]` 等于下一抽、`DrawCards` 用 `shift()` 抽牌、`AddCardToDeck` 用 `unshift()` 置顶、`paper_shatter / lantern_captain` 带 `utilities: ['draw', 'reorder']` 的数据基础。缺的是一个真实动作：把某张符合条件的牌移动到抽牌堆顶部，再让现有抽牌逻辑抽进手牌。

不建议第 7 轮首刀做完整 `scry`、`discover` 或 `redraw`：

- 完整 `scry` 需要牌库顶预视、排序 / 置底选择、确认 UI 和移动端交互状态，结构最正统但 UI 成本高。
- `discover` 更像候选生成 / 临时选择，不是牌区重排，容易把第 7 轮带向新奖励池或临时牌系统。
- `redraw` 是坏手处理，但作用面是整手和回合节奏，不是兑现当前 `reorder` 标签的最小闭环。
- `tutor / seek` 可以作为受限 topdeck 的上层来源规则，但如果直接搜索全牌库进手，会过强且需要更多 UI 和测试边界。

因此推荐的第 7 轮最小复刻口径是：

```text
整备置顶：
当一张 2 MP 支援牌触发整备时，从现有牌区中找一张符合 Redline 角色的牌，
把它移动到 drawPile 顶部，然后复用当前 DrawCards 抽进手牌。
```

这不是照搬第三方关键词，而是复刻同类机制的结构：玩家用一张低输出支援牌换取下一抽可控性。

## 2. 机制抽象

| 机制标签 | 中性结构抽象 | 玩家获得什么 | 牌区变化 | UI / runtime 成本 | Redline 适配判断 |
| --- | --- | --- | --- | --- | --- |
| `scry` | 查看牌库顶 N 张，决定保留顺序、置底或丢弃到非顶部位置。 | 提前规划下一抽，降低坏手风险。 | 主要改变 `drawPile` 顶部顺序。 | 需要预视面板、排序或置底选择、确认状态。 | 结构最接近“重排”，但不适合第 7 轮最小实现；应放 P1。 |
| `seek` | 按条件从牌库中抽取或拉取一张牌，通常由系统按规则挑选，玩家不浏览全牌库。 | 获得某类需要的牌，但选择权较弱。 | 可从 `drawPile` 移到 `hand`，也可先置顶再抽。 | 不一定需要 UI，但要定义条件、随机性、失败反馈。 | 可作为 Redline 的“找路线 / 找终结”来源规则，但不能直接命名或照搬。 |
| `tutor` | 搜索牌库或弃牌堆中一张符合要求的牌，并加入手牌、置顶或放入指定区域。 | 强确定性找关键牌。 | 从牌库 / 弃牌堆移动到手牌或牌顶。 | 如果允许玩家浏览全牌库，UI 和强度成本都高。 | 作为 P0 过强；可以只取“受限检索 + 置顶”这一小段。 |
| `topdeck` | 把一张已确定或按规则选出的牌放到抽牌堆顶部。 | 控制下一抽，和抽牌牌形成直接联动。 | 目标牌移动到 `drawPile[0]`。 | 最低；当前 Redline 已有 `shift / unshift` 语义。 | 最适合第 7 轮 P0。 |
| `discover` | 从一组候选中展示若干选项，玩家选择一张加入手牌、牌库或临时区。 | 获得不完全可预测的选择奖励。 | 通常不是重排现有牌库，而是生成或调入新牌。 | 需要候选池、选择 UI、临时牌 / 生成牌边界。 | 不适合兑现当前 `reorder`；更适合作为 P2 奖励 / 支援系统。 |
| `redraw` | 替换当前手牌或若干手牌，通常有次数、资源、冷却或回合代价。 | 主动修坏手。 | 手牌进入弃牌堆 / 牌底 / 临时区，再补抽。 | 需要手牌选择、补抽、代价和回合节奏规则。 | 适合坏手体验，但不是第 7 轮最小 1:1 重排复刻。 |

抽象成更底层的五个原语：

1. **Inspect**：看见牌库或候选区的一部分。
2. **Filter**：按费用、角色、标签、是否 payoff、是否修补等条件筛牌。
3. **Select**：玩家选择或系统按优先级选择。
4. **Move**：把牌移动到手牌、牌顶、牌底、弃牌堆或临时候选区。
5. **Pay Cost**：支付 MP、牺牲伤害、占用卡位、消耗一次回合机会或接受随机性。

Redline 第 7 轮不需要一次做完五个原语。最小闭环只需要 `Filter -> Move to drawPile[0] -> DrawCards`。

## 3. Redline 适配

### 3.1 当前 demo 的可用基础

当前 Redline 已经有这些事实：

- `PlayerState` 使用 `deck / hand / drawPile / discardPile` 四个 `CardId[]` 牌区。
- `drawCardsFromDeck` 从 `drawPile.shift()` 抽牌，所以 `drawPile[0]` 就是下一张。
- `AddCardToDeck` 会把奖励牌 `unshift` 到 `drawPile` 顶部，说明运行时已经接受“置顶”语义。
- `paper_shatter` 和 `lantern_captain` 都是 2 MP、`targets: 'self'`、`drawCards: 1`、`utilities: ['draw', 'reorder']`。
- self draw 会被费用链倍率放大；2 MP 支援牌接在 `0 -> 1` 后实际可抽 3。
- 当前没有 `ReorderDrawPile`、`SearchDeck`、`CardTopdecked`、`DrawPileReordered` 或玩家确认整备的命令 / 事件。
- 第 6 轮已经把 `wild_mana_stitch` 改成“修补成功才返当前 MP”，所以第 7 轮不应再把重点放在 Wild 数值堆叠上。

这意味着 Redline 的最小缺口不是“没有牌”，而是 `reorder` 仍然只是标签。第 7 轮应该把它变成牌区动作。

### 3.2 推荐适配：受限 topdeck / 整备置顶

建议 P0 只选一张牌做样板，优先选 `paper_shatter`：

```text
Paper Route / paper_shatter：
2 MP 支援段。
整备目标：找 3 MP payoff。
动作：在 DrawCards 前，把 drawPile 中第一张 3 MP 全场 payoff 置顶。
结果：随后抽牌会把 payoff 抽进手牌，形成“接链抽3找终结”的真实行为。
```

这样做的好处：

- 直接兑现 `paper_shatter` 当前“找终结”的文案方向。
- 不需要新建全牌库浏览 UI。
- 不需要临时牌、发现池、候选弹窗或整手重抽。
- 能和现有 `0 -> 1 -> 2` 授权链形成清楚目标：先完成授权，再通过整备把 payoff 找到。
- 玩家看到的不是“系统随机给牌”，而是“我用一张 2 MP 支援牌整理下一抽”。

`lantern_captain` 不建议在同一个 P0 中做完全同构效果。它可以留给 P1：

```text
Lantern Captain / lantern_captain：
整备目标：找路线牌，而不是找终结。
动作：优先找当前 nextExpectedCost 对应的 route-bridge / repair-resource。
用途：当缺 1 MP 或 2 MP 节点时修路线，而不是直接找 3 MP payoff。
```

这样两张 2 MP 支援牌不会重复：

- `paper_shatter` = 找终结，服务 payoff 爆点。
- `lantern_captain` = 找路线，服务断链修复和继续铺垫。

### 3.3 P0 行为合同

P0 不需要玩家手动排序牌库。建议合同如下：

```text
触发条件：
- 打出的牌包含 utilities: ['reorder']。
- 该牌本身有 drawCards。
- 当前仍处于 CardPlayed -> DrawCards 的结算窗口。

候选来源：
- P0 只搜索 drawPile。
- 不搜索 hand。
- 不生成新牌。
- 不复制牌。
- 不把弃牌堆纳入 P0，避免强度接近完整 tutor。

候选规则：
- paper_shatter：优先 cost = 3、targets = all-enemies、comboNode = burst 的 payoff。
- 如果没有候选，整备失败，但原本 DrawCards 照常执行。

牌区动作：
- 从 drawPile 原位置移除目标牌。
- unshift 到 drawPile[0]。
- 随后执行现有 DrawCards。

可观察事件：
- 成功时记录 CardTopdecked / DrawPilePrepared 一类事件。
- 失败时记录 TopdeckMissed / DrawPilePrepareMissed 一类事件。
- 事件至少包含 sourceCardId、targetCardId、fromIndex、preference。
```

这里的 1:1 复刻重点不是名称，而是结构：

- 原本不可控的下一抽变成可控。
- 控制发生在现有牌堆里，不是凭空生成。
- 玩家为可控性支付一张低输出支援牌和 2 MP 节奏成本。
- 最终仍由抽牌动作把牌拿进手牌，保持 Redline 当前 draw loop。

### 3.4 为什么不是完整 scry 首刀

完整 `scry` 的结构更“纯重排”，但它要解决四个 P0 不该承担的问题：

1. 牌库顶 N 张如何展示，移动端是否遮挡战斗区。
2. 玩家如何排序、置底、取消、确认。
3. 确认前是否锁输入，debug trace 如何回放。
4. 如果预视不到 payoff，玩家是否会觉得这张 2 MP 支援牌浪费。

Redline 当前最需要的不是让玩家管理一个小牌库 UI，而是在 3-5 回合 demo 中证明“坏手可以被整备成 payoff 爆点”。受限 topdeck 更适合这个产品目标。

### 3.5 为什么不是 discover / redraw 首刀

`discover` 会把问题从“整理现有牌堆”变成“生成或调用候选池”。这更像奖励、临时牌或角色技能，不适合兑现 `utilities: ['reorder']`。

`redraw` 解决坏手很有效，但它改变的是整手质量和回合节奏。Redline 当前已经有 4 张手牌、固定链路、授权 payoff 和抽牌倍率，首刀做 redraw 很容易让玩家绕过费用链规划，变成“手不好就换”。

第 7 轮的目标应该是让现有 2 MP 整备牌承担真实职责，而不是新增一个全局换手机制。

## 4. 版权安全边界

### 4.1 可以复刻的部分

可以复刻的是抽象结构：

- 查看、筛选、移动、置顶、抽牌这些通用牌区操作。
- “支援牌降低下一抽不确定性”的设计目的。
- “支付资源或输出机会换取手牌稳定性”的代价结构。
- “从现有牌堆中找特定角色牌”的功能需求。

这些属于通用机制层，不依赖第三方卡名、叙事、插画、文案或具体数值。

### 4.2 不应复制的部分

不要复制：

- 第三方卡牌名称、关键词文案、规则原文或教程句式。
- 第三方 UI 面板形状、图标、动效、音效和美术构图。
- 固定候选数量、原样排序规则、原样稀有度和原样数值节奏。
- 第三方“发现 / 预视 / 搜索”等关键词在游戏内的可见命名。

内部研究文档可以用 `scry / seek / tutor / topdeck / discover / redraw` 作为对照标签，但 Redline 产品内建议使用自己的词：

- `整备`
- `置顶`
- `预置终结`
- `调度路线`
- `补线`

### 4.3 Redline 必须保留的差异化

Redline 的结构适配必须绑定自己的系统，而不是照搬竞品表层：

- 绑定 `0 -> 1 -> 2` 费用链，而不是泛用找任意强牌。
- 绑定 `tempAuthorizationMP` 和 `payoff-only` 授权，而不是永久资源成长。
- 绑定敌人意图取消和前排压力，而不是只追求抽到大牌。
- 绑定 `paper_shatter / lantern_captain` 的不同职责，而不是把所有整备牌做成同一个功能。

版权安全的最佳做法是让玩家说出：“这是 Redline 的整备置顶，服务授权 payoff 和路线修补”，而不是让玩家联想到某个外部游戏的同名关键词。

## 5. P0 / P1 / P2

### P0：受限 topdeck，兑现一张整备牌

1. **只做 `paper_shatter` 的终结置顶**
   - 打出后，在 `DrawCards` 前寻找 `drawPile` 中第一张 3 MP 全场 payoff。
   - 找到后移动到 `drawPile[0]`。
   - 随后复用现有抽牌，接链时自然抽进手牌。

2. **只搜索 `drawPile`**
   - 不搜索 `hand`。
   - 不搜索 `deck` 的抽象全集。
   - 不搜索 `discardPile`。
   - 不生成外部候选牌。

3. **补最小事件证据**
   - 成功事件：`CardTopdecked` 或 `DrawPilePrepared`。
   - 失败事件：`TopdeckMissed` 或 `DrawPilePrepareMissed`。
   - 事件字段要能说明来源牌、目标牌、来源位置和偏好类型。

4. **HUD 只用 Redline 词**
   - 推荐短文案：`整备：终结置顶`、`整备失败`、`抽3找终结`。
   - 不在 UI 中写 `scry / seek / tutor / discover`。

5. **测试锁住边界**
   - 打出 `paper_shatter` 前，payoff 在 `drawPile` 非顶部；结算后先被置顶，再被抽进手牌。
   - 没有 payoff 时，不改变抽牌堆结构，原本抽牌照常执行。
   - 不从弃牌堆捞牌，防止 P0 强度变成完整 tutor。
   - 刚打出的支援牌不能在同一次抽牌中被回洗抽回。

P0 的通过标准：`reorder` 不再只是 metadata，而是有一次可观察、可测试、可解释的牌区移动。

### P1：扩展到路线整备和轻量预视

1. **`lantern_captain` 做路线置顶**
   - 优先找当前 `nextExpectedCost` 对应的 route-bridge 或 repair-resource。
   - 和 `paper_shatter` 的 payoff 置顶区分职责。

2. **允许有限弃牌堆来源**
   - 可以只允许搜索 `discardPile` 的前若干张，或只允许当前回合之前已弃掉的牌。
   - 必须保留“刚打出的自己不被立刻捞回”的护栏。

3. **轻量 top-N 预视**
   - 看 `drawPile` 顶 3 张，选择 1 张置顶。
   - 未选牌保持原顺序或放回牌底，二选一即可，不要同时开放复杂排序。
   - 这是 `scry` 结构的 Redline 化版本，但不使用第三方命名。

4. **CardMoved / CardDrawn 事件补齐**
   - 把抽牌、弃牌、置顶、回填都纳入统一牌区移动证据。
   - 后续消耗、保留、状态牌才能复用。

### P2：完整坏手处理生态

1. **完整预视 / 重排**
   - 支持玩家对牌库顶 N 张排序、置底或保留顺序。
   - 适合移动端确认 UI 成熟后再做。

2. **受限 tutor**
   - 允许搜索更大范围的牌区，但必须有成本、范围、目标类型和失败反馈。
   - 例如只找 payoff、只找修补、只找当前期望费用，而不是任意找全牌库最强牌。

3. **Redline 版 discover**
   - 用于奖励、角色支援或一次性战斗选择。
   - 候选必须来自 Redline 自己的 route / repair / payoff 分类，而不是照搬第三方候选池语义。

4. **redraw / mulligan**
   - 可做回合内一次性换手、弃 1 抽 1、或支付 MP 重抽若干张。
   - 需要和 4 张手牌、敌意图、费用链、授权 payoff 的节奏重新平衡。

5. **CardInstance 与生命周期**
   - 支持同名牌多实例、临时降费、复制体、消耗、保留、状态牌、诅咒。
   - 这是完整卡牌 roguelike 底座，不属于第 7 轮最小复刻。

## 6. 第 7 轮裁决

第 7 轮如果只选一个机制做最小 1:1 结构复刻，选 **受限 topdeck / 整备置顶**。

裁决理由：

1. 它最贴合当前 runtime：`drawPile[0]`、`shift()`、`unshift()` 已经具备置顶语义。
2. 它能直接兑现当前最空的 `reorder` 标签。
3. 它不需要大 UI、不需要候选生成、不需要整手重抽、不需要 CardInstance。
4. 它和 Redline 的 `0 -> 1 -> 2` 授权 payoff 形成明确卖点：整备不是泛用找牌，而是把终结牌拉到下一抽。
5. 它的版权风险低，因为产品表达可以完全使用 Redline 自己的“整备 / 置顶 / 授权 / 终结”语言。

最终优先级：

```text
P0-1: paper_shatter 受限 topdeck，找 3 MP payoff 置顶
P0-2: CardTopdecked / TopdeckMissed 或等价事件
P0-3: HUD 用“整备：终结置顶”，不使用第三方关键词
P0-4: 测试锁住只搜索 drawPile、不生成新牌、不捞刚打出的自己
P1: lantern_captain 路线置顶、top-N 预视、CardMoved/CardDrawn
P2: 完整 scry、受限 tutor、Redline 版 discover、redraw、CardInstance 生命周期
```

STATUS: DONE
