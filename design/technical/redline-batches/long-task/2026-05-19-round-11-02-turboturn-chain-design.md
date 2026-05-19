# 2026-05-19 Round 11-02：TurboTurn 升序连锁系统设计

角色：第 11 轮专家 02，TurboTurn 升序连锁系统设计师  
工作目录：`/Users/roc/Game-001`  
边界：只写本文档；不修改 `runtime.ts`、`types.ts`、`cards.ts`、测试或 UI 代码。  
目标：让 Redline 的出牌体验从“0->1->2 授权样片”推进到更像升序 MP combo 的连续回合爆发，但不复制外部游戏的命名、关键词或表层表达。

## 0. 总裁决

当前 Redline 已经有一个可测的核心样片：`0 -> 1 -> 2` 让倍率走到 x3，并发放本回合 3 点临时授权；随后 3 MP 全场终结可以用授权支付，并以 x4 结算。这证明“升序费用链 + payoff 爆点”成立。

但它还不像真正的升序 MP combo 系统。原因不是数值不够大，而是链路语义停在“完成 0/1/2 后开门”。玩家现在主要在做：

```text
0 费起手 -> 1 费承接 -> 2 费授权 -> 3 费终结
```

下一阶段应该让玩家感到：

```text
我在一回合内把费用阶梯、抽牌、修补、支援和终结串成一条持续升温的路线；
每多接一段，伤害、抽牌、护盾/减压、支援都变强；
断链不是不能玩，而是失去升温、授权和后续转接机会。
```

因此建议把下一阶段命名为 **TurboTurn 升序连锁**，内部只使用 Redline 自己的词表：`升序`、`接链`、`修补`、`授权`、`续燃`、`断链`、`终结`。不要把外部作品的关键词、专名或卡面结构直接搬进文案。

## 1. 当前实现基线

审查文件：

- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/data/cards.ts`
- `prototype-web/src/eca/redlineRules.ts`
- `prototype-web/src/tests/sim/redline-hyperturn-acceptance.test.ts`
- `prototype-web/src/tests/sim/redline-attribute-authorization.test.ts`
- `prototype-web/src/tests/sim/redline-paper-shatter-topdeck.test.ts`
- `prototype-web/src/tests/ui/hud-target-selection.test.ts`
- `design/technical/redline-batches/long-task/2026-05-18-round-06-synthesis.zh.md`
- `design/technical/redline-batches/long-task/2026-05-18-round-07-synthesis.zh.md`
- `design/technical/redline-batches/long-task/2026-05-18-round-10-synthesis.zh.md`
- `design/technical/redline-batches/long-task/2026-05-18-round-10-03-core-loop-feel-review.md`

当前已成立：

- `advanceCostChain` 用 `playedCosts / nextExpectedCost / multiplier / broken` 驱动升序费用链。
- 第一张必须是 0 MP，否则 UI 读作 `非起x1`，运行时也不会进入完整授权链。
- 正确接链时倍率递增：0 为 x1，1 为 x2，2 为 x3，3 MP payoff 可继续成为 x4。
- `isAuthorizationChain` 只认 `0,1,2` 三段，给 `tempAuthorizationMP += 3`，限制为 `payoff-only`。
- Wild 修补只在链已开始、未断、期望费用为 1 或 2 时生效；broken 后不修补。
- self draw 也吃 `effectMultiplier`，例如 `pulse_draw` 接在 0 后实际请求抽 2，`paper_shatter` 接到 x3 时请求抽 3。
- damage 与 payoff 都按倍率结算，`ClearBurst / ResolvePayoff` 能记录防止的敌意图。
- `paper_shatter` 是极窄整备：只从 `drawPile` 找第一张 3 MP payoff 置顶，不搜弃牌堆，不启用 `lantern_captain` 真找牌。
- HUD 已有短 token：`起链x1 / 接x2 / 修补MP1x2 / 断x1 / 授权+3 / 授权付 / 缺MP1 / 缺授权 / 抽N仍-X / 整备：顶终结`。

当前未成立：

- 授权链只在 `0->1->2` 触发一次，不支持 `3 费 payoff 后继续接 4` 或同回合继续升序转接。
- Wild 不能修补到 3+，也不能把 3 MP payoff 视作后续链路的一段来延长。
- 没有防御、护盾、支援类效果的倍率合同；目前“draw 吃倍率”已成立，但 defense/support 只是设计空位。
- 手牌上限未显式成为系统参数；`HAND_SIZE = 4` 是发牌数，不是可增长/可压缩的 combo 约束。
- MP 上限仍固定为 `maxEnergy = 3`，临时授权只服务 3 MP payoff；还没有“当前 MP、授权 MP、返 MP、手牌流动”共同支撑长链的规则边界。
- 断链代价主要是倍率归 1 和授权失败，缺少玩家可见的“续燃丢失”“支援断档”“下一段关闭”反馈。

## 2. 设计目标

TurboTurn 的目标不是把 Redline 做成无限循环，也不是把 3 MP payoff 变成免费连击按钮。目标是保留当前 0/1/2 教学切片，同时让后续奖励牌能把同一套规则自然推到更长链：

- `0->1->2` 仍是基础门槛。
- 3 MP payoff 不是终点，而是第一个高峰；如果玩家手牌、MP 和修补资源足够，可以继续接下一段。
- 抽牌、防御、支援都使用同一个倍率读数，玩家不需要学习三套算法。
- Wild 从“补 1/2 缺口”升级为“在受控条件下延长 3+”，但不能无成本抹掉所有错误。
- MP 与手牌大小共同限制长链，不能只靠授权无限铺开。
- 断链仍允许出牌，但必须让玩家立刻感到这回合的升温被切断。

## 3. 系统镜头

### 镜头 01：基础 0-1-2 仍然是教学入口

手牌：`debt_hook / redline_cut / row_cleave / severance_burst`。  
玩家按 `0 -> 1 -> 2` 出牌，HUD 依次读 `起链x1 / 接x2 / 接x3`，2 MP 段结算后显示 `授权+3`。  
这是现有样片，不应删除。它承担“升序规则入门”，不是最终深度。

验收点：

- `row_cleave` 或 `clearance_order` 在 x3 时发放授权。
- `AuthorizationGranted.reason` 仍能明确来自 `0->1->2`。
- `maxEnergy` 不变化，不能误读成永久 MP 成长。

### 镜头 02：3 费 payoff 继续接链，而不是只消费授权

在镜头 01 后，玩家用授权打出 `severance_burst`。当前实现已经会让它以 x4 作为 `CardPlayed.effectMultiplier` 结算，但设计上要把它正式读成“第 3 段终结兼续燃点”。

建议新增设计语义：

- 3 MP payoff 仍是 `payoff`，但如果它接在 `0->1->2` 后，链路读数进入 `0>1>2>3`。
- 3 MP payoff 结算后可以短暂打开“续燃窗口”，允许下一张 0/1/4 类特定牌继续行动，但不默认免费。
- UI 不写长句，只显示 `终结x4` 和 `续燃` 类短 token。

验收点：

- `PayoffTriggered.enhanced === true` 不等于链路结束。
- 若没有后续手牌或 MP，链自然停，不自动补牌。
- 3 MP payoff 不能反复触发新的 `AuthorizationGranted +3`，否则会变成无限授权。

### 镜头 03：3 费 payoff 后继续接 4 费 payoff 或支援段

下一阶段可以引入一张内部测试牌，不一定立即进入奖励池：

```text
4 MP / support 或 payoff / 只在续燃窗口中可读成接链
```

这张牌不需要第一版真正做复杂内容。它的职责是证明系统不是只停在 `0->1->2->3`，而是能把 `nextExpectedCost` 推到 4 并继续给倍率。

建议合同：

- 3 MP payoff 后，`nextExpectedCost` 应读为 4。
- 4 MP 牌若可支付，显示 `接x5`。
- 如果 MP 不足，显示 `缺MP4` 或 `缺授权`，但不虚构可打。
- 如果打 2 MP 或 0 MP 非续燃牌，显示 `断x1`。

验收点：

- 测试要看到 `playedCosts` 包含 `[0,1,2,3,4]` 的正例，和 3 后打错费用的负例。
- 4 MP 不应进入 P0 起手，只用于最小合同验证。

### 镜头 04：Wild 延长到 3+，但必须带条件

当前 Wild 只允许修补期望 MP1/MP2，这是正确的 P0 护栏。下一阶段如果要让 Wild 支持 3+，不能简单把 `expectedCost < 3` 改成无限。建议改成两层：

- `修补`：补 1/2 缺口，用于完成授权。
- `续燃修补`：只在已经完成 `0->1->2` 且链未断时，允许 Wild 补 3 或 4。

镜头：玩家打 `0 -> 1 -> 2` 后，没有 3 MP payoff，但手里有 Wild。Wild 可以在“续燃窗口”中按期望 3 接上，显示 `续燃MP3x4`，但支付仍按牌面，并且不会当作真正 3 MP payoff 自动清场。

验收点：

- Wild 补 3 只能延长链，不能伪装为 payoff。
- Wild 补 3 不应再次发放 `tempAuthorizationMP +3`。
- broken chain 后 Wild 仍不能修补 3+。
- Wild 补 3 后是否返 MP 必须单独定义，不能沿用 `chain-repaired` 无脑返。

### 镜头 05：draw 吃倍率继续保留，并成为长链的主要燃料

当前 `redlineRules.card.self.resource` 已经让 `drawCards * effectMultiplier` 成立。这个方向应该保留，因为它让抽牌从“找答案”变成升序链的一部分。

镜头：`debt_hook -> pulse_draw -> paper_shatter`。`pulse_draw` 在 x2 请求抽 2，`paper_shatter` 在 x3 请求抽 3，并且 HUD 读 `抽2仍-X / 抽3仍-X`。敌意图不因抽牌消失。

下一阶段建议：

- 抽牌倍率仍用当前 `effectMultiplier`。
- 抽到的牌如果费用刚好接上，玩家才获得更长链。
- 如果牌堆不足，实际抽到数量可以少于请求数量；日志必须区分“请求抽 N”和“实际抽到 M”。

验收点：

- `DrawCards.count` 等于基础抽牌数乘倍率。
- `HandDealt.cardIds.length <= DrawCards.count`。
- self draw 的意图预览仍是 `抽N仍-X`，不能暗示已经防住伤害。

### 镜头 06：defense 也吃倍率，但不直接复制伤害公式

当前没有真实 defense 牌。建议先设计合同，不急着实现卡池。防御类效果应吃倍率，但用途不同：

```text
基础护盾 4，在 x3 时给 12 护盾；
或者基础减伤 3，在 x3 时把本回合结束伤害减少 9。
```

镜头：敌意图 17，玩家打到 x3 后出一张 2 MP 防御支援，HUD 显示 `护12仍-5` 或 `减9仍-8`。这比纯攻击更像卡牌选择：玩家可以选择清怪、抽牌找终结，或用防御活过本回合。

验收点：

- 防御倍率使用同一个 `effectMultiplier`。
- 防御不能杀敌，不能触发 `EnemyKilled / GainXp`。
- `ResolveDefense` 或等价事件要记录 `intentDamageBefore / preventedDamage / intentDamageAfter`。
- 如果没有敌意图，防御可以给护盾但不能制造虚假收益文案。

### 镜头 07：support 也吃倍率，但服务路线而非直接胜利

支援类可以包括“置顶一张指定角色牌”“降低下一张非 payoff 的费用”“临时手牌上限 +1”“本回合下一次 Wild 可修补到 3”。这些都应该吃倍率，但不能直接变成伤害。

镜头：`paper_shatter` 在 x3 时不是简单“抽 3”，而是 `抽3 整备`。后续可以让支援牌在 x4 时提供更强路线控制，例如只看 drawPile 前 4 张而不是全牌堆。

验收点：

- support 的倍率收益必须能被事件记录，而不是只在 UI 文案里写。
- support 不能搜索弃牌堆，除非另开完整牌区生命周期切片。
- `lantern_captain` 若启用真实支援，应与 `paper_shatter` 分开验收，不要同时打开完整找牌。

### 镜头 08：手牌大小是长链的硬限制

当前 `HAND_SIZE = 4` 让起手天然适配 `0/1/2/3`。如果要做 3+ 长链，必须把手牌大小纳入规则，而不是只靠抽牌无限补。

建议：

- 基础手牌仍为 4，保证教学手稳定。
- 长链必须依赖抽牌、整备或奖励构筑来获得第五张、第六张。
- 不建议直接把基础手牌改到 5；那会削弱 `pulse_draw / paper_shatter / support` 的价值。

镜头：玩家完成 `0->1->2->3` 后没有第五张，链自然停。另一局中，`pulse_draw` 抽到 2 MP，`paper_shatter` 抽到 3 MP payoff，才形成第五段机会。

验收点：

- 新增任何长链测试都要显式设置 `hand / drawPile`，不能依赖随机。
- 发牌数、当前手牌数、抽到数要在测试里分开断言。
- UI 的牌区读数继续显示 `牌库/抽/弃/手`，但不要为了长链塞长说明。

### 镜头 09：MP 限制必须比授权更硬

TurboTurn 的核心风险是授权过多导致“反正都能打”。因此 MP 限制要保持硬：

- `maxEnergy` 默认仍是 3。
- `tempAuthorizationMP` 只支付 payoff，不能支付普通支援、普通防御或 Wild。
- `GainEnergy` 只返当前 MP，不提高最大 MP。
- 3+ 延长链必须依赖“当前 MP、授权、返 MP、降费、抽牌”的组合，而不是单一免费资源。

镜头：玩家有 `0->1->2` 授权和一张 4 MP 支援牌，但没有对应授权类型或当前 MP，按钮显示 `缺MP4`，不能因为已授权就可打。另一局中，Wild 修补成功返 1 当前 MP，刚好让玩家打出 2 MP 支援。

验收点：

- `CardPaymentRecorded.source` 继续区分 `current-energy / authorization / mixed`。
- 授权支付只对 payoff 生效。
- 普通 4 MP 支援不应被 3 点 payoff 授权支付。

### 镜头 10：断链代价要从“倍率归 1”升级为“路线关闭”

当前断链仍可出牌，这是正确的。下一阶段要让断链代价更明确：

- 倍率回到 x1。
- `payoffArmed` 不新增。
- 续燃窗口关闭。
- Wild 不能再用本轮前缀修补。
- UI 在一两秒内显示 `断x1` 与 `续燃断` 类短日志。

镜头：玩家 `0 -> 2` 断链，`row_cleave` 仍造成伤害，但不会授权；随后打 3 MP payoff 如果有当前 MP，只是 `未授权x1`，不能防住原本需要清掉的敌意图。

验收点：

- `ChainBroken.breakReason` 仍记录期望费用和实际费用。
- broken 后再打 1/2/3 不能补发授权。
- broken 后 Wild 不触发 `ChainRepaired`。
- End Turn 扣血要和断链后未解决的意图一致。

### 镜头 11：UI 读数必须表达“现在、下一段、爆点”

TurboTurn 不需要长教程文本。HUD 只需要稳定表达三件事：

- 现在：`0>1>2`、当前倍率、当前 MP/授权。
- 下一段：`下MP3 x4`、`缺MP1`、`修补MP2x3`。
- 爆点：`授权就绪`、`终结未授权`、`授权终结x4`、`续燃`。

镜头：玩家完成 0/1 后，Director 显示 `下MP2 x3`；打出 2 后显示 `授权+3 · 等终结`；打出 3 后如果有后续窗口，显示 `下MP4 x5`，否则显示 `链结束` 或回到普通回合状态。

验收点：

- 360 宽移动端不能出现长句。
- 卡牌按钮只放短 token，解释留给 tooltip/detail。
- 所有新增 token 要进入 UI helper 测试，避免回到超框问题。

### 镜头 12：测试合同要同时覆盖成功、失败、资源和 UI

下一阶段不能只加一个成功连击测试。最低测试合同应覆盖：

- `0->1->2->3` 正例：3 MP payoff 以 x4 结算，且不再次发放授权。
- `0->1->2->3->4` 设计正例：如果引入测试 4 MP 牌，应看到 x5。
- Wild 3+ 正例：只有授权后、未断链、续燃窗口内可修补。
- Wild 3+ 负例：broken 后、首张、未完成 0/1/2 时都不能修补 3+。
- draw 倍率：x2/x3 抽牌请求和实际抽到数量分开断言。
- defense/support 倍率：先做事件合同，再做卡牌池开放。
- MP 限制：授权不能支付非 payoff，普通牌缺 MP 必须失败。
- 断链代价：断链后仍可出牌，但倍率、授权、续燃全部关闭。
- UI token：`续燃`、`下MP4 x5`、`缺MP4`、`断x1` 不超框。
- 文案边界：卡名、关键词和规则文本使用 Redline 自己的词表，不复制外部关键词。

## 4. 数据与类型建议

只作为下一阶段设计，不在本文档中改代码。

建议在 `ChainState` 旁边增加少量状态，而不是重写整套 runtime：

```ts
interface ChainState {
  playedCosts: number[];
  lastCost: number | null;
  nextExpectedCost: number;
  multiplier: number;
  broken: boolean;
  breakReason: string | null;
  repairedThisTurn: boolean;
  turboWindow?: 'none' | 'authorized' | 'spent-payoff' | 'extended';
  highestCostReached?: number;
}
```

建议新增或扩展事件：

- `TurboWindowOpened`：完成 `0->1->2` 后打开。
- `TurboWindowExtended`：3 MP payoff 或 Wild 3+ 成功延长。
- `TurboWindowClosed`：断链、回合结束、资源不足自然结束。
- `DefenseResolved`：记录防御倍率和阻止伤害。
- `SupportResolved`：记录支援倍率、候选范围或手牌上限变化。

不要第一版就做：

- 通用触发器。
- 完整牌区移动系统。
- 弃牌堆搜索。
- 手动重排 UI。
- 永久 Max MP。
- 局外成长。
- 大量新卡。

## 5. 数值护栏

TurboTurn 容易失控，建议先用硬护栏而不是微调数值：

| 风险 | 护栏 |
| --- | --- |
| 3 MP payoff 后无限授权 | 只有 `0->1->2` 发放一次 `tempAuthorizationMP +3`；3 MP payoff 不再发授权。 |
| Wild 万能化 | 3+ Wild 只在续燃窗口内修补，且不自动等于 payoff。 |
| 抽牌无限找解 | 抽牌吃倍率，但受手牌、牌堆、当前 MP 限制；不搜弃牌堆。 |
| 防御变成无脑最优 | 防御吃倍率但不杀敌、不拿 XP、不触发清场反馈。 |
| 支援替玩家找答案 | 支援只看有限 drawPile 范围，失败要有 miss 事件。 |
| UI 解释爆炸 | 所有新增读数先用 8 字以内 token，再进移动端测试。 |

## 6. 最小切片建议

建议下一阶段只做一个最小切片：**3 MP payoff 续燃读数 + Wild 3 修补合同，不开放正式新卡池**。

范围：

1. 保持现有 `0->1->2` 授权合同不变。
2. 明确 3 MP payoff 接在授权链后是 `0>1>2>3 / x4`，并打开一个 `turboWindow`。
3. 只允许 Wild 在该窗口补期望 MP3，显示 `续燃MP3x4`。
4. Wild 补 3 只延长链，不触发 payoff，不再次授权。
5. 新增一个测试专用 4 MP support stub 或用测试内 fixture 验证 `nextExpectedCost = 4`，不要进入 reward pool。
6. UI 只增加短 token：`续燃`、`续燃MP3x4`、`下MP4 x5`。
7. 测试覆盖正例、broken 负例、MP 不足、授权不能支付非 payoff。

不做：

- 不改基础 `HAND_SIZE = 4`。
- 不开放 `lantern_captain` 完整找牌。
- 不搜弃牌堆。
- 不新增真实 defense 卡池。
- 不做永久 MP、升级、遗物、删牌。

这个切片的价值是验证“Redline 能从授权样片进入长链语法”，而不是追求内容量。通过后，再分别开 defense/support 倍率和手牌上限切片。

## 7. 结论

Redline 当前已经有一个稳的 `0->1->2->3` 样片，但玩家感受到的仍是“完成授权后打终结”。要更像升序 MP combo，下一步应该把 3 MP payoff 正式纳入链路，把 Wild 的修补能力从 1/2 受控扩到 3+，并让 draw/defense/support 全部共享同一套倍率读数。

最重要的边界是：长链必须被手牌和 MP 限制约束，断链必须关闭续燃，外部关键词和表层卡牌文案不能复制。先做最小续燃合同，再开真实内容。

STATUS: DONE
