# 2026-05-18 Round 06-01 Wild 费用缺口补链机制审查

角色：第 6 轮专家 01，Wild 费用缺口机制设计师  
工作目录：`/Users/roc/Game-001`  
边界：只新增本文档；不修改源码、不提交 git、不回滚或覆盖其他人的改动。  
审查重点：`wild_gap_key` 当前“修补费用缺口”的牌面，是否有真实运行时支撑。

## 0. 结论

`wild_gap_key` 不是空文案。当前 runtime 确实有一条 Wild 补链规则：带 `utilities: ['wild']` 的牌在链已经开始后，会用当前 `chain.nextExpectedCost` 记入链路，并发出 `ChainRepaired`。所以 `debt_hook -> wild_gap_key -> row_cleave` 这种 0 -> Wild -> 2 的授权路线，在机制方向上是成立的。

但它现在只实现了“链路账本替换”，还不是完整卡牌游戏里的 Wild / 万能费用 / 补链系统。主要缺口是：

- 支付仍按牌面 `cost = 1`，没有真实万能费用池或费用解析器。
- `CardPlayed` 事件没有记录 `chainRepaired` / `repairedCost`，后续效果不能安全依赖“修补成功”。
- `canRepairWithWild` 没排除 broken chain，可能出现“链已断但仍发 ChainRepaired”的假修补。
- HUD 的 `cardChainRead` 仍按牌面费用预判，无法在当前期望 MP2/MP3 时正确显示 `wild_gap_key` 会补上该费用。
- 测试没有直接打出 `wild_gap_key` 验证它的补链、授权、支付和 HUD 预览；现有 Wild runtime 覆盖主要在 `wild_mana_stitch`。

本轮最小建议不是新增更多 Wild 牌，而是把 `wild_gap_key` 的真实修补链路做成可见、可测、可被后续效果引用的合同。

## 1. 当前代码事实

### 1.1 卡牌定义

`prototype-web/src/data/cards.ts` 当前事实：

- `blood_tithe` 已是正式 reward，`cost 0 / self / drawCards 1 / rewardBranches ['repair-resource']`，位于 `rewardCardPool` 第一位。
- `pulse_draw` 已是正式 reward，`cost 1 / self / drawCards 1 / rewardBranches ['repair-resource', 'route-bridge']`。
- 默认奖励池前三张是 `blood_tithe / severance_burst / spark_tap`，与第 5 轮汇总一致。
- `wild_gap_key` 是 `cost 1 / damage 1 / front-enemy / cardType repair / chainRole repair / cycleRole wild-fixer / rewardBranches ['repair-resource'] / utilities ['wild']`。
- `wild_gap_key` 卡面写的是“造成1。修补费用缺口。”，细节写明“可按当前期望费用接链，但支付仍按牌面”。
- `wild_mana_stitch` 是另一张 Wild：`cost 0 / self / drawCards 1 / energyGain 1 / utilities ['wild', 'draw', 'mana']`，仍存在“免费补链、抽牌、返当前 MP”叠加问题。

### 1.2 运行时补链

`prototype-web/src/sim/runtime.ts` 的 `advanceCostChain` 是当前 Wild 支撑的核心：

- 只要 `card.utilities` 包含 `wild`，且 `world.chain.playedCosts.length > 0`，就把本次 `playedCost` 设为 `world.chain.nextExpectedCost`。
- 如果链未开始，`wild_gap_key` 仍按牌面 `cost 1` 处理；因为首张期望是 MP0，所以它不能作为正常开链牌。
- 如果链已开始，Wild 会按当前期望费用推进 `playedCosts`、`lastCost`、`nextExpectedCost` 和倍率，并发 `ChainAdvanced`。
- 同时会发 `ChainRepaired`，字段包含 `repairedCost`、`nextExpectedCost`、`multiplier`。
- 如果最终链路精确成为 `0 -> 1 -> 2` 且 `chain.broken === false`，会授予 `tempAuthorizationMP += 3`，限制为 `payoff-only`。

这说明 `wild_gap_key` 在链路层确实能补缺口。例子：

```text
debt_hook(cost 0) -> wild_gap_key(printed cost 1, effective cost 1) -> row_cleave(cost 2)
结果：0 -> 1 -> 2，获得终结授权。
```

更隐蔽的例子也会成立：

```text
debt_hook(cost 0) -> redline_cut(cost 1) -> wild_gap_key(printed cost 1, effective cost 2)
结果：玩家支付 1 MP，但链路账本记成 MP2，并获得终结授权。
```

第二个例子就是当前“费用缺口修补”最需要解释清楚的地方：它不是按实际费用支付 MP2，而是“按 MP2 接链，按牌面 MP1 支付”。

### 1.3 支付与效果结算

当前支付在 `advanceCostChain` 之前完成：

- `validatePlayCard` 用 `card.cost` 判断能否支付。
- `SpendEnergy` 只扣 `card.cost` 中由当前 MP 支付的部分。
- 终结授权只允许支付 3 费全体 `burst` payoff，不参与 `wild_gap_key` 支付。
- `CardPlayed` 事件记录 `printedCost / currentEnergyPaid / authorizationPaid / payoffArmed`，但不记录 `effectiveCost / chainRepaired / repairedCost`。
- 伤害在 `redlineRules.ts` 中按 `card.damage * event.effectMultiplier` 结算。因此 `wild_gap_key` 接在 0 费后实际造成 `1 * 2 = 2`，接在 `0 -> 1` 后实际造成 `1 * 3 = 3`。

这套逻辑能跑，但对后续机制不够安全：如果 `wild_mana_stitch` 想“修补成功才返 MP”，ECA 规则目前拿不到本次 `CardPlayed` 是否真的修补成功，只能无条件看 `energyGain`。

### 1.4 HUD 与可见反馈

第 5 轮已经让抽牌倍率可见：

- `hudCardIntentPreview` 会对 self draw 显示 `抽N找解`。
- `cardEffectLabel` 在倍率大于 1 时显示 `抽2 / 抽3 整备`。
- 战斗日志对 `CardPlayed` 显示倍率和抽牌数。

但 Wild 补链预览还没跟上：

- `cardChainRead` 只判断 `card.cost === lastPlayedCost + 1`。
- 当当前期望是 MP2，而 `wild_gap_key.cost = 1` 时，HUD 会把它读成 `断链 x1`，但 runtime 实际会把它当 MP2 修补并推进链路。
- 战斗日志没有展示 `ChainRepaired`，玩家只能从后续授权或 debug trace 间接推断修补成功。

所以当前 `wild_gap_key` 的 runtime 真实能力强于 HUD 表达。这个错位会让玩家误以为它不能补 MP2 缺口，或把实际授权当成 bug。

### 1.5 测试覆盖

当前测试事实：

- `runtime.test.ts` 覆盖了 `debt_hook -> pulse_draw` 后抽牌倍率为 2。
- `runtime.test.ts` 和 `redline-progression-card-system.test.ts` 覆盖了 `wild_mana_stitch` 能发 `ChainRepaired`，并让后续 payoff 使用授权。
- `redline-progression-card-system.test.ts` 只验证当前 Wild 卡集合是 `wild_gap_key / wild_mana_stitch`，没有直接打出 `wild_gap_key`。
- `reward-branching.test.ts` 锁住默认首奖是 `blood_tithe / severance_burst / spark_tap`；当移除 `blood_tithe / pulse_draw` 后，才 fallback 到 `wild_gap_key / severance_burst / spark_tap`。
- `paper_shatter / lantern_captain` 的 `reorder` 明确只有标签和找牌文案，没有 runtime reorder。

结论：`wild_gap_key` 目前有运行时代码路径，但缺少直连验收。它更像“被 Wild 通用规则顺带支持”，不是一个被独立锁住的核心修补牌。

## 2. 和真实卡牌游戏 Wild / 万能费用 / 补链机制的差距

真实卡牌游戏里的 Wild 通常至少拆成四层：

| 层级 | 真实机制常见含义 | 当前 Redline 状态 |
| --- | --- | --- |
| 支付层 | 可作为任意颜色 / 任意费用 / 临时费用支付。 | 没有万能费用池；`wild_gap_key` 始终按牌面 1 MP 支付。 |
| 链路层 | 可代替缺失节点，保持组合、套牌轴或序列不断。 | 已有最小实现：Wild 按 `nextExpectedCost` 记入链。 |
| 合法性层 | UI 能在出牌前显示它会补哪个缺口、是否成功、是否断链。 | 不足；HUD 仍按牌面费用预判。 |
| 结算层 | 后续效果可读到“本次修补成功 / 修补了哪个费用”。 | 不足；`ChainRepaired` 是单独事件，`CardPlayed` 不带修补结果。 |

### 2.1 `wild_gap_key` 不是万能费用

它当前不是“我有一枚 Wild MP，可以支付任意费用”。它更像：

```text
支付牌面 MP1；
如果本回合费用链已经开始，就把这张牌记成当前期望费用；
然后用该有效费用计算链路倍率和授权。
```

这个设计可以成立，但卡面和 HUD 必须说清楚。否则玩家会自然把“Wild/万能费用”理解成资源层，而源码实际做的是链路层。

### 2.2 缺口没有被显式建模

当前没有 `Gap`、`ExpectedCostSlot`、`RepairCandidate` 或类似对象。所谓“缺口”只是 `world.chain.nextExpectedCost`。

这导致三个限制：

- 不能表达“选择补 MP1 还是 MP2”。
- 不能表达“只在真的缺某个段时触发额外奖励”。
- 不能把修补结果稳定传给 ECA、HUD、日志和测试，只能靠事件顺序猜。

P0 不需要做完整 gap system，但至少要把本次出牌的 `effectiveCost / repairedCost / chainRepaired` 固化到 `CardPlayed`。

### 2.3 broken chain 下的假修补风险

当前 `canRepairWithWild = isWild && playedCosts.length > 0`，没有检查 `!world.chain.broken`。

这意味着链已经 broken 后，Wild 仍可能发 `ChainRepaired`。虽然 `isAuthorizationChain` 会因为 `chain.broken` 拒绝授权，但日志和未来条件效果会被误导。

对于真实补链机制，“修补成功”应该至少满足：

```text
链已经开始；
链尚未 broken；
Wild 按当前 nextExpectedCost 推进；
本次推进没有断链。
```

### 2.4 HUD 和 runtime 可能给出相反答案

当期望费用等于 `wild_gap_key.cost` 时，比如 `debt_hook -> wild_gap_key`，HUD 和 runtime 看起来一致。

当期望费用不等于牌面费用时，比如 `debt_hook -> redline_cut -> wild_gap_key`，runtime 会修补 MP2，但 HUD 会读成断链。这是当前最严重的 1:1 复刻差距：玩家无法在出牌前理解 Wild 的真实能力。

### 2.5 抽牌、临时资源、重排与 Wild 还没有统一效果合同

第 5 轮开放了 `blood_tithe / pulse_draw`，并让抽牌倍率可见；这解决了“抽牌修补”的一部分。

但四类机制仍是分散的：

- 抽牌：`drawCards * effectMultiplier`，已经运行。
- 临时资源：只有 `energyGain` 和 `tempAuthorizationMP`，没有通用条件资源合同。
- Wild：链路替换存在，但没有写入 `CardPlayed`。
- 重排：`utilities: ['reorder']` 仍只是文案 / 标签，没有预视、选择或排序。

因此第 6 轮不应宣称已经完成 1:1 复刻。正确说法是：当前已经有“抽牌倍率 + Wild 链路替换”的窄切片，下一步要把 Wild 修补做成可见合同。

## 3. P0 / P1 / P2 可执行方案

### P0：把 `wild_gap_key` 的补链能力做实、做可见、做可测

目标：不新增大系统，只修当前 Wild 语义错位。

1. 收紧 Wild 修补判定。
   - 把成功修补定义为：`isWild && chain.playedCosts.length > 0 && !chain.broken && continues`。
   - broken chain 后可以继续 `ChainAdvanced` 或 `ChainBroken`，但不能发 `ChainRepaired`。

2. 让 `advanceCostChain` 返回结构化结果。
   - 返回 `effectiveCost`、`chainRepaired`、`repairedCost`。
   - 不让调用方从 `events.find(type === 'ChainRepaired')` 反查状态。

3. 扩展 `CardPlayed` 事件。
   - 增加 `effectiveCost`。
   - 增加 `chainRepaired: boolean`。
   - 可选增加 `repairedCost?: number`。
   - 这样 ECA、HUD、日志和测试都能读同一个事实。

4. 修正 HUD chain preview。
   - 如果卡有 `utilities.includes('wild')`，链已开始且未 broken，预览应使用 `snapshot.chain.nextExpectedCost` 或 snapshot 中等价字段。
   - 显示口径建议：`修补 MP2 x3`，而不是 `断链 x1`。
   - cost 行仍显示 `MP 1`，避免把支付层和链路层混淆。

5. 增加 `wild_gap_key` 定向测试。
   - `debt_hook -> wild_gap_key -> row_cleave`：`ChainRepaired.repairedCost = 1`，后续 `AuthorizationGranted`。
   - `debt_hook -> redline_cut -> wild_gap_key`：支付仍为 1，`effectiveCost = 2`，`chainRepaired = true`，产生授权。
   - `debt_hook -> row_cleave -> wild_gap_key`：broken 后不产生 `ChainRepaired`，不触发任何“修补成功”条件。
   - HUD 单元测试：期望 MP2 时 `wild_gap_key` 不显示 `断链 x1`，而显示修补 MP2。

6. 战斗日志补一条可见反馈。
   - 当 `CardPlayed.chainRepaired` 为 true，日志显示 `修补 MP2` 或 `补链 MP2`。
   - 不需要新 UI 面板，只要让玩家在最近战斗信息中看到修补发生。

P0 不要求改 `wild_gap_key.damage`。`damage 1 -> 2` 是合理平衡项，但它不能替代机制合同。

### P1：接上条件临时资源，解决 `wild_mana_stitch` 过强

目标：让“临时资源”不再无条件混进所有 self 牌。

1. 给卡牌定义增加最小条件字段。
   - 示例：`energyGainCondition?: 'chain-repaired'`。
   - 只先服务 `wild_mana_stitch`，不做通用 EffectSpec。

2. `wild_mana_stitch` 保留 `energyGain: 1`，但改为修补成功才返。
   - opener 打出不返。
   - broken chain 后不返。
   - 真实补链时返 1 当前 MP。

3. 文案同步。
   - `rulesText`: `修补成功：当前MP+1。抽1。`
   - `detail`: 明确“只返当前 MP，不提高 maxEnergy”。

4. 增加三条测试。
   - opener 不返。
   - 成功补链返。
   - broken 后不返。

5. 再评估 `wild_gap_key.damage 1 -> 2`。
   - 当 `wild_mana_stitch` 不再免费无条件返 MP 后，`wild_gap_key` 提到 2 点基础伤害更容易读成“付费低伤害修补”，不会被 `wild_mana_stitch` 完全压住。

### P2：再做真实 1:1 卡牌机制扩展

目标：只有 P0/P1 稳定后，才扩到更完整的卡牌机制复刻。

1. 通用资源解析器。
   - 区分 `printedCost`、`effectiveChainCost`、`paymentCost`、`temporaryResource`。
   - 决定 Wild 是“按牌面支付、按缺口接链”，还是“真的能支付任意费用”。

2. 真实重排 / 预视。
   - `reorder` 不再只是 tag。
   - 最小实现可以是“查看牌库顶 N 张并选择顺序”，或“把一张牌置顶”。
   - 必须有 `CardsReordered` 事件和 HUD 反馈。

3. 牌区生命周期。
   - 消耗、保留、状态牌、临时牌、CardInstanceId 都应单独排期。
   - 不要为了 Wild 一次性迁移所有 pile。

4. 奖励原因和动态修补推荐。
   - 根据上一手断在哪个费用，给 `wild_gap_key / pulse_draw / blood_tithe` 不同推荐 reason。
   - P2 前不做动态推荐，避免 reward 系统和战斗系统耦合过早。

## 4. 本轮最小实现建议

如果第 6 轮只允许一个实现批次，建议做这个最小包：

```text
Wild chain repair truth slice
```

文件面预计只需要：

- `prototype-web/src/sim/types.ts`
  - 给 `CardPlayed` 增加 `effectiveCost / chainRepaired / repairedCost`。
- `prototype-web/src/sim/runtime.ts`
  - 收紧 `canRepairWithWild`。
  - 让 `advanceCostChain` 返回结构化修补结果。
  - 把修补结果写入 `CardPlayed`。
- `prototype-web/src/ui/hud.ts`
  - 让 `cardChainRead` 能识别 Wild effective cost。
  - 战斗日志显示补链。
- `prototype-web/src/tests/sim/runtime.test.ts` 或新增窄测试文件
  - 直接覆盖 `wild_gap_key` 的 MP1 / MP2 修补、支付和 broken 后不修补。
- `prototype-web/src/tests/ui/hud-target-selection.test.ts`
  - 覆盖期望 MP2 时 `wild_gap_key` 的 HUD 预览。

不建议把 `wild_mana_stitch` 条件返 MP 和 `wild_gap_key.damage 1 -> 2` 混进同一个最小包。它们都应该做，但最好作为 P1 小补丁，以免 P0 失败时无法判断是 Wild 合同、临时资源还是数值改动导致。

## 5. 本轮不做范围

- 不新增 Wild 牌。
- 不把 `wild_gap_key` 加到默认首奖前面；第 5 轮默认首奖 `blood_tithe / severance_burst / spark_tap` 先保持。
- 不重排 `rewardCardPool`。
- 不把 `blood_tithe / pulse_draw` 放进起始牌组。
- 不把 `wild_gap_key` 改成 0 费。
- 不把 `wild_gap_key` 做成真正支付 MP2/MP3 的万能资源牌，除非先完成 P2 资源解析器设计。
- 不实现 `reorder` runtime。
- 不做消耗、保留、状态牌、诅咒、升级、CardInstance、遗物、商店、删牌、reroll、地图节点或局外成长。
- 不把 `energyGain` 改成 maxEnergy 成长。
- 不用 UI 文案假装机制存在；凡是写“修补成功”“重排”“返 MP 条件”，必须有事件或测试支撑。

## 6. 验收口径

P0 完成后，应能明确回答这四个问题：

1. `wild_gap_key` 是否真的补链？
   - 是，测试能看到 `chainRepaired = true` 和 `repairedCost`。

2. 它补的是支付费用还是链路费用？
   - 链路费用。支付仍按牌面 `MP 1`，HUD 必须同时显示这两个事实。

3. broken chain 后是否还算修补成功？
   - 否。可以继续出牌，但不能发“修补成功”事件，也不能触发条件返 MP。

4. 玩家出牌前能否看懂？
   - 能。期望 MP2 时，HUD 应显示 `修补 MP2 x3` 或同等短文案，而不是 `断链 x1`。

STATUS: DONE
