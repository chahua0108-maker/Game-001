# 2026-05-19 第11轮专家03：Wild 延长 stack 平衡审查

角色：第11轮专家03，Wild 延长 stack 平衡师  
工作目录：`/Users/roc/Game-001`  
文件所有权：`design/technical/redline-batches/long-task/2026-05-19-round-11-03-wild-stack-balance.md`  
边界：只写本文档；不改源码、不提交、不回滚其他改动。

## 0. 结论

当前 Redline 的 Wild 已经不是第6轮时的“半落地文案”。源码里已经具备三件关键事实：

1. `wild_gap_key` 可按 `nextExpectedCost` 记入链路，支付仍按 printed cost。
2. `CardPlayed` 已记录 `effectiveCost / chainRepaired / repairedCost`。
3. `wild_mana_stitch` 已改成 `energyGainCondition: 'chain-repaired'`，只有真实修补才返当前 MP。

但它仍只支持 `0 -> 1 -> 2` 的短链授权窗口。`advanceCostChain` 当前把 Wild 修补限制在 `expectedCost > 0 && expectedCost < 3`，所以 Wild 不能把 stack 延到 MP3、MP4 或更长。竞品公开描述里的 Wild 价值更接近“把 stack 继续延长到很长”，不是只补 `1/2` 缺口。

第11轮最小代码切片建议：**不要立刻做无限 Wild，也不要把 payoff 授权改成长链通用资源。只开放一张受控的 `wild_gap_key` 延链能力，让它可在 `nextExpectedCost = 3` 时继续接链，但不触发返 MP、不提高授权、不改变 printed cost，且必须有硬上限和移动端短文案。**

推荐 P0 目标：

```text
0 -> 1 -> 2 -> Wild Gap Key(effective MP3, printed MP1)
= stack 延长到 x4，payoff/后续效果倍率更高；
但没有额外 tempAuthorizationMP，没有 Max MP 成长，没有多次返 MP。
```

这会让 Wild 更像竞品的“延长 stack”工具，同时保留早期压力：玩家仍要先完成 `0 -> 1 -> 2`，仍要花 printed MP1，仍可能抽不到 payoff，仍会被敌意图惩罚。

## 1. 当前实现审查

### 1.1 卡牌与规则事实

`prototype-web/src/data/cards.ts`：

- `wild_gap_key`：`cost 1 / damage 1 / targets front-enemy / utilities ['wild'] / rewardBranches ['repair-resource']`。
- `wild_mana_stitch`：`cost 0 / self / draw 1 / energyGain 1 / energyGainCondition 'chain-repaired' / utilities ['wild', 'draw', 'mana']`。
- `severance_burst`、`red_ledger_burst` 是 3 MP payoff，消费 0->1->2 授权窗口。

`prototype-web/src/sim/runtime.ts`：

- `canRepairWithWild = isWild && playedCosts.length > 0 && !broken && expectedCost > 0 && expectedCost < 3`。
- Wild 成功时 `playedCost = expectedCost`，但支付仍由 `card.cost` 决定。
- `CardPlayed` 已记录 `printedCost / currentEnergyPaid / effectiveCost / effectMultiplier / chainRepaired / repairedCost`。
- `isAuthorizationChain` 只认精确 `[0, 1, 2]`，所以延长到 MP3+ 不应自动产生更多授权。

`prototype-web/src/ui/hud.ts`：

- `cardChainRead` 对 Wild 预览也有同样 `nextExpectedCost < 3` 限制。
- 成功修补时会显示 `修补MP${nextExpectedCost}x${multiplier}`。
- combat log 已能显示 `修补MPx`、抽牌倍率和条件返 MP。

`prototype-web/src/tests/sim/runtime.test.ts`：

- 已覆盖 `Wild Gap Key` 支付 printed cost 1、effective cost 2、倍率 x3、授权触发。
- 已覆盖 broken chain 后 Wild 不修补、不返 MP。
- 已覆盖 `wild_mana_stitch` 空链不返 MP、真实修补才返 MP。

因此，第11轮真正缺的是“MP3+ 延长 stack 的平衡切片”，不是补第6轮基础合同。

## 2. 10 个平衡镜头

| # | 镜头 | 当前状态 | 第11轮判断 | P0 最小切片 |
| --- | --- | --- | --- | --- |
| 1 | 期望费用 3+ | Wild 只允许 `expectedCost < 3`，无法补 MP3。 | 竞品感缺失的核心点在这里。 | 只让 `wild_gap_key` 支持 `expectedCost === 3`，暂不开放 MP4+。 |
| 2 | printed cost vs effective cost | 已有 `printedCost=1 / effectiveCost=2` 测试。 | 这个模型正确，不能改成免费万能 MP。 | 延链时继续 `printedCost=1 / effectiveCost=3`，支付层和链路层分离。 |
| 3 | 返 MP 条件 | `wild_mana_stitch` 已是修补成功才返。 | MP3+ 延链若允许 0费抽牌返MP，会立刻过强。 | P0 只开放 `wild_gap_key` 延 MP3；`wild_mana_stitch` 仍限制在 MP1/MP2 修补。 |
| 4 | draw 倍率 | 抽牌按 `drawCards * effectMultiplier`，`pulse_draw` 接链可抽 2。 | MP3+ 后 self draw 可能抽 4+，风险很高。 | P0 不让 self draw Wild 参与 MP3+ 延链；不新增 draw Wild。 |
| 5 | payoff 倍率 | payoff 接在完整链尾可 x4。 | 如果 Wild MP3 后接 payoff，会出现 x5 或更高，爽但危险。 | P0 允许“有代价地看到 x5”，但不增加授权，只能用现有 MP/授权支付。 |
| 6 | 坏手救回 | `blood_tithe / pulse_draw / Wild` 已能明显降低坏手。 | 再开放万能 Wild 会把坏手压没。 | 延链必须发生在已完成 0->1->2 后，不救起手缺 0/1/2 的坏手。 |
| 7 | 滥用风险 | 当前 `wild_gap_key` 是 1费低伤害修补，风险可控。 | 多张 Wild 或 0费 Wild 连续延链会绕过压力。 | P0 每回合最多 1 次 MP3 延链；只认第一张 `wild_gap_key`。 |
| 8 | 移动端显示 | HUD 已显示 `修补MPx`，但短屏信息密度高。 | MP3+ 文案不能变长。 | 移动端短 token：`延MP3x4`；卡面仍保留 `MP1`。 |
| 9 | 测试指标 | 已有 runtime 合同，但没有 MP3+ 用例。 | 必须先测数值边界再交给玩家。 | 新增 `0->1->2->wild_gap_key`、broken 后不延、`wild_mana_stitch` 不延 MP3、HUD 预览四类测试。 |
| 10 | 下一阶段 | 第10轮裁决不扩机制。 | 第11轮若扩，只能做一条受控体验。 | P1 再决定 MP4+、多 Wild、长链 payoff 衰减，不在 P0 混做。 |

## 3. 第11轮最小代码切片建议

### 3.1 只开放 `wild_gap_key` 的 MP3 延链

建议把当前通用 Wild 判定拆出一个受控函数，不要让所有 Wild 自动获得长链能力。

P0 语义：

```text
Wild Gap Key:
- 可在链未断、链已开始时补 nextExpectedCost。
- 对 MP1/MP2：保持当前行为。
- 对 MP3：新增“延长 stack”行为。
- 对 MP4+：P0 不开放。

Wild Mana Stitch:
- 仍只修补 MP1/MP2。
- 仍只有真实修补才当前 MP+1。
- 不参与 MP3 延链，避免 0费抽牌返MP成为长链引擎。
```

这样玩家能打出：

```text
debt_hook(0)
-> redline_cut(1)
-> row_cleave(2)
-> wild_gap_key(printed MP1, effective MP3, x4)
```

但不能打出：

```text
0 -> 1 -> 2 -> wild_mana_stitch(0费, 抽4, MP+1)
```

### 3.2 授权不扩容

不要把 MP3 延链解释成“获得更多临时 MP”。当前授权仍只由精确 `0 -> 1 -> 2` 产生一次 `tempAuthorizationMP += 3`，且限制 `payoff-only`。

P0 后的读法：

- `0 -> 1 -> 2`：打开 3 MP payoff 支付窗口。
- `0 -> 1 -> 2 -> wild_gap_key(effective 3)`：把 stack 倍率推到 x4，但不额外给 4 MP 或第二份授权。
- 后续 3 MP payoff 若能支付，吃到更高倍率；若不能支付，玩家仍要面对敌意图。

这能保留“贪长链”的风险：玩家为了 x4 多花 1 MP，可能反而没有资源接上 payoff。

### 3.3 倍率先不衰减，但设观察阈值

P0 不建议立刻加复杂衰减公式。当前倍率线性增长，代码和 HUD 都容易读。

观察阈值：

- x4 应该是“明显爽”的上限。
- x5 只允许通过 `0 -> 1 -> 2 -> wild_gap_key -> payoff` 这种已完成授权、又多花 printed MP 的路线出现。
- 早期如果 x5 payoff 清屏率超过 80%，下一轮再做长链 payoff 衰减，例如 `payoffMultiplier = min(chainMultiplier, 4)` 或 `after x4 damage gain -50%`。

P0 不要同时改伤害、改授权、改敌人 HP。先让一条长链路线可测，再用数据裁决。

## 4. 费用与资源边界

### 4.1 printed cost 不变

`wild_gap_key` 继续显示和支付 `MP 1`。这点必须稳定，因为它是早期压力的主要刹车。

如果改成“按 effective cost 3 支付”，玩家很难用它延链；如果改成“免费接 MP3”，又会让 Wild 变成无代价爆发。当前 `printed MP1 / effective MP3` 是最适合 P0 的中间态。

### 4.2 返 MP 不跟随延链放大

`wild_mana_stitch` 不进入 MP3 延链，是 P0 的核心护栏。

原因：

- 它是 0 MP。
- 它会抽牌，抽牌又吃倍率。
- 它会条件返当前 MP。
- 一旦允许 MP3+，它会同时承担“延链、抽4、返1、找 payoff”四件事。

这会直接摧毁早期压力，所以第11轮只让 `wild_gap_key` 延长 stack。

### 4.3 不提高 Max MP

所有文案、事件和测试继续强调：这是当前回合链路效果，不是永久 MP 成长。`maxEnergy` 必须保持 3，restart 后也不能带出任何 Wild 资源成长。

## 5. 坏手救回与早期压力

第11轮不能把 Wild 做成“坏手万能保险”。它应该从“救缺口”升级为“贪长链”，而不是从“贪长链”倒灌成“任何坏手都能救”。

保留的失败镜头：

1. 起手缺 0：Wild 不应凭空启动长链。
2. 先打错导致 broken：Wild 不应修复 broken chain。
3. 只有 `wild_gap_key` 没有 2 费段：不能获得授权。
4. 已授权但没有 payoff：延链只提高倍率，不保证兑现。
5. 贪 MP3 延链后资源不足：玩家可能吃敌意图。

这些失败镜头是“早期压力还在”的证据。

## 6. 移动端显示要求

移动端不能把 printed cost 和 effective cost 混成一行长解释。

推荐短 token：

| 场景 | 卡面/按钮成本 | 链路 token | 日志 token |
| --- | --- | --- | --- |
| 空链 | `MP1` | `非起x1` | 无修补 |
| 期望 MP1 | `MP1` | `修补MP1x2` | `修补MP1` |
| 期望 MP2 | `MP1` | `修补MP2x3` | `修补MP2` |
| 期望 MP3 | `MP1` | `延MP3x4` | `延链MP3` |
| broken | `MP1` | `断x1` | 无修补 |

在 360/390 宽度下，按钮最小必须仍能看到：

- `MP1`
- `延MP3x4`
- 目标或 self 标识
- 是否可支付

不要在卡面写“支付1但按3接链”这种长句。详细解释放 tooltip/detail，移动端只保留短 token。

## 7. 测试指标

P0 至少需要这些测试，不要求本专家文档执行代码：

1. `wild_gap_key` 可延 MP3：
   - hand: `debt_hook / redline_cut / row_cleave / wild_gap_key`
   - 期望：最后一张 `printedCost=1 / currentEnergyPaid=1 / effectiveCost=3 / effectMultiplier=4 / chainRepaired=true / repairedCost=3`。

2. MP3 延链不增加授权：
   - `AuthorizationGranted` 仍只在 `row_cleave` 或完成 `[0,1,2]` 时发生一次。
   - `wild_gap_key` 延 MP3 不追加 `tempAuthorizationMP`。

3. `wild_mana_stitch` 不延 MP3：
   - `0 -> 1 -> 2 -> wild_mana_stitch`
   - 期望：不 `chainRepaired`，不 `GainEnergy`，不抽 4 作为延链奖励；若按当前 cost 0 断链，则日志清楚。

4. broken 后不延链：
   - `0 -> 2 -> wild_gap_key`
   - 期望：`chain.broken=true`，`wild_gap_key` 不发 `ChainRepaired`。

5. HUD 预览：
   - 期望 MP3 且 hand 有 `wild_gap_key` 时，显示 `延MP3x4` 或等价短 token，不显示 `断x1`。

6. payoff 观察：
   - `0 -> 1 -> 2 -> wild_gap_key -> severance_burst`
   - 期望 payoff 可获得 x5 或被明确 cap；二选一必须由测试锁住，不能靠 UI 猜。

7. 资源边界：
   - 整条路线后 `maxEnergy` 仍为 3。
   - `wild_gap_key` 仍只扣 printed cost 1。

8. 移动端防溢出：
   - `延MP3x4` 在 360/390 宽按钮内不溢出。
   - combat log 的 `延链MP3` 不挤掉 HP/MP/意图核心信息。

建议统计的平衡指标：

| 指标 | P0 目标 |
| --- | ---: |
| 首奖前长链出现率 | 0%，因为 `wild_gap_key` 不是起始牌 |
| 第一次拿到 `wild_gap_key` 后 MP3 延链成功率 | 20%-45% |
| 早期 x5 payoff 出现率 | 不高于 20%-30% |
| 三回合内清屏率 | 不高于当前版本 +15% |
| 两张 repair 后硬坏手率 | 不低于 5% |
| broken 后被 Wild 救回率 | 0% |

## 8. 滥用风险与护栏

### 8.1 多 Wild 连续延链

P0 不开放 MP4+，所以多 Wild 连续延链自然被挡住。若后续要开放 MP4+，必须先加每回合延链次数、长链收益衰减或 Wild 消耗。

### 8.2 0费 Wild 变长链引擎

`wild_mana_stitch` 是最高风险。它不应该在第11轮获得 MP3 延链资格。

如果未来要给它延链，至少要同时满足：

- 每回合只返 MP 一次。
- MP3+ 时不按倍率抽牌，或抽牌倍率封顶 x2。
- 打出后 exhaust 或本回合移除。

这些都不是 P0。

### 8.3 payoff 过早稳定

`0 -> 1 -> 2` 已经打开 3 MP payoff；再加 MP3 延链会提高 payoff 爽感。如果玩家几乎每次都能 x5 清场，敌意图会失去意义。

P0 先不削，但必须用测试和复测观察：

- 是否经常“看见意图但不用怕”。
- 是否经常“无脑先延 MP3 再终结”。
- 是否 `wild_gap_key` 从选择题变成必选项。

### 8.4 UI 误导

最大 UI 风险是玩家看到 `MP1`，但链路显示 `MP3`，误以为系统乱扣费。

解决方式不是长文案，而是固定术语：

```text
MP1 = 支付费用
延MP3 = 接链位置
x4 = 当前倍率
```

## 9. 下一阶段

P0 只做一条受控路线：`wild_gap_key` 延 MP3。

P1 再根据实测决定：

1. 是否开放 MP4+。
2. 是否让长链 payoff 倍率封顶。
3. 是否让 `wild_gap_key` damage 从 1 调到 2。
4. 是否给 Wild 延链每回合次数上限。
5. 是否增加“延链但不修补”的单独事件名，区分 `ChainRepaired` 与 `ChainExtended`。
6. 是否用玩家复测验证“延链是贪爽选择”，不是“唯一正确选择”。

P2 才讨论完整竞品式长 stack：

- 多种 Wild。
- 长链奖励节点。
- 长链衰减/爆发曲线。
- 真正的 reorder / tutor / discard search。
- relic/run modifier 与长链协同。

## 10. 最终裁决

第11轮最小代码切片应该是：

```text
只让 wild_gap_key 支持 expectedCost === 3 的延链；
保持 printed cost 1；
保持授权只由 0->1->2 产生；
禁止 wild_mana_stitch 参与 MP3+ 延链；
HUD 显示“延MP3x4”；
测试锁住 effectiveCost、返MP、draw倍率、payoff倍率、移动端不溢出。
```

这是一条小而清楚的切片：它会让 Redline 的 Wild 从“只修 1/2 缺口”推进到“能把 stack 往后延一段”，但不会把早期压力、坏手、费用约束和敌意图全部抹掉。

STATUS: DONE
