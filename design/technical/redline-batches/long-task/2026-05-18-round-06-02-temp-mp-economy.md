# 2026-05-18 Round 06-02 临时 MP 与资源经济平衡审查

角色：第 6 轮专家 02，临时 MP 与资源经济平衡师  
工作目录：`/Users/roc/Game-001`  
范围：只读当前源码与前轮 long-task 文档；本文只新增本 Markdown，不修改源码、不提交 git。

## 0. 裁决

`wild_mana_stitch` 的当前 `energyGain + draw` 组合在 3MP / 临时授权体系下过强，不建议保持当前。

推荐口径：

```text
P0：移除 wild_mana_stitch 的通用 energyGain，保留 0MP / Wild 修补 / 抽牌身份。
P1：若还需要“返 MP”手感，改成真实 ChainRepaired 后的下一段修补信用，而不是直接加当前 MP。
P2：做完整资源账本、支付优先级、reorder 运行时和卡牌效果解释器，再讨论更复杂的临时资源牌。
```

不要只做“条件触发 `energyGain`”就结束。条件触发能挡住 opener 白赚 MP，但挡不住成功修补时同时获得 Wild、倍率抽牌、当前 MP 回填和授权的叠加。

## 1. 当前源码事实

### 1.1 卡牌与奖励池

- `blood_tithe` 已是正式 reward：`0 MP / self / drawCards 1 / rewardBranches: ['repair-resource']`。
- `pulse_draw` 已是正式 reward：`1 MP / self / drawCards 1 / rewardBranches: ['repair-resource', 'route-bridge']`。
- 当前默认 reward 三选一由 `buildRewardChoices` 按 `repair-resource -> payoff -> route-bridge` 选择，测试锁定为 `blood_tithe / severance_burst / spark_tap`。
- `wild_mana_stitch` 当前是：

```text
cost 0
targets self
cardType repair
chainRole repair
rewardBranches ['repair-resource']
drawCards 1
energyGain 1
utilities ['wild', 'draw', 'mana']
rulesText: 修补缺口。抽1，当前MP+1。
```

这意味着第 5 轮开放 draw repair 后，正式 repair-resource 分支已经有 `blood_tithe`、`pulse_draw`、`wild_gap_key`、`wild_mana_stitch` 四类修补。`wild_mana_stitch` 不再需要同时承担“唯一坏手救命牌”和“资源补偿牌”两层职责。

### 1.2 当前 MP、最大 MP、临时授权 MP、局外成长

| 层级 | 当前源码事实 | 平衡含义 |
| --- | --- | --- |
| 当前 MP：`player.energy` | 初始 3；每次 `DealHand` 恢复到 `maxEnergy`；普通出牌优先消耗当前 MP。`GainEnergy` 当前直接 `+= amount`，没有钳制到 `maxEnergy`。 | 这是本回合真实行动资源。若被 0 费牌无条件增加，会绕开“3MP 内做取舍”的压力。 |
| 最大 MP：`player.maxEnergy` | `createInitialWorld` 为 3；reward 加卡不改变；restart 回到 3。 | 当前 P0 的清晰边界是 3MP 基线，不应被修补牌暗中突破。 |
| 临时授权 MP：`tempAuthorizationMP` | 未断裂 `0 -> 1 -> 2` 后 `+3`；限制 `payoff-only`；离开 `PlayerTurn` 时清空。 | 它是奖励玩家完成费用链的 payoff 支付权，不是通用 MP 池。 |
| 局外成长 | `runModifiers.ts` 是 preview-only；`restart-run` 重新 `createInitialWorld`；测试也锁住 foreign meta 不影响 `maxEnergy/deck`。 | 目前没有永久 Max MP、永久起手牌、遗物或账号成长。文案和数值都不应暗示有。 |

关键问题在当前支付顺序：payoff 可用授权时，仍先用当前 MP，再用授权补缺口。若 `wild_mana_stitch` 在授权前把当前 MP 回满，授权的存在感会被削弱。

### 1.3 抽牌、洗牌、重排

- self 牌的抽牌规则在 `redlineRules` 中按 `drawCards * effectMultiplier` 结算。
- 因此 `wild_mana_stitch` 卡表写 `drawCards: 1`，但接在 0 费后会按 x2 请求抽 2；接在 `0 -> 1` 后会按 x3 请求抽 3。
- `drawCardsFromDeck` 会在 drawPile 空时把 discardPile 回填，并通过 `excludeFromReshuffle` 避免刚打出的 self draw 立刻洗回。
- `paper_shatter / lantern_captain` 有 `utilities: ['draw', 'reorder']`，但当前没有真实 reorder 运行时；测试明确不应断言 reorder 生效。

所以本轮不能用“以后有重排会平衡”来给 `wild_mana_stitch` 当前强度背书。当前真实运行时只有抽牌、回填和当前 MP 增加。

## 2. 为什么当前 `wild_mana_stitch` 过强

当前组合不是单点偏强，而是四个压力释放叠在一张 0 费牌上：

1. **Wild 修补**：只要已有链路，它可按当前 `nextExpectedCost` 继续链，触发 `ChainRepaired`。
2. **倍率抽牌**：作为 self draw，抽牌数会吃 `effectMultiplier`，不是固定抽 1。
3. **当前 MP +1**：`GainEnergy` 无条件触发，且当前实现不钳制到 `maxEnergy`。
4. **授权链推进**：如果修补后形成 `0 -> 1 -> 2`，还会获得 `tempAuthorizationMP +3`。

最危险的不是单独 “+1 MP”，而是它把坏手修补从“找一条路”变成“免费补链、补手、补当前资源，并继续拿授权”。第 5 轮已经把 `blood_tithe / pulse_draw` 开放为 draw repair，若继续保留这张牌的当前强度，玩家会把普通抽牌修补视为低配答案。

当前测试还显式承认了一个强度信号：`debt_hook -> wild_mana_stitch` 后 `energy` 变成 4。这说明它不是“回到 3MP 基线”，而是实际突破当前 Max MP。

## 3. 四种方向评估

| 方向 | 结论 | 原因 |
| --- | --- | --- |
| 保持当前 | 不推荐 | 0 费 Wild + 倍率抽牌 + 当前 MP +1 + 授权链，压掉 `blood_tithe/pulse_draw/wild_gap_key`，并削弱 3MP 压力。 |
| 只做条件触发 | 不够 | `ChainRepaired` 成功时仍可能抽 2/3、返当前 MP、完成授权，强度核心还在。 |
| 延迟返还 | 可作为 P1 | 若返还变成“下一张非 payoff 链路牌信用”，能保留修补手感，但需要新增事件合同和 UI 解释。 |
| 只修补缺口 | 推荐原则 | Wild 的强点应是“补费用缺口”，不是生成通用资源。P0 先把 `energyGain` 从通用当前 MP 中拿掉。 |

## 4. P0/P1/P2 数值与规则方案

### P0：立刻收口，防止当前 MP 引擎化

目标：不扩大 runtime 合同，只把过强叠加拆开。

| 项 | 推荐 P0 |
| --- | --- |
| `wild_mana_stitch.cost` | 保持 `0`。 |
| `wild_mana_stitch.utilities` | 保留 `wild`、`draw`；移除或停止表达 `mana`。 |
| `wild_mana_stitch.drawCards` | 暂保留 `1`，继续吃当前倍率；这是本牌剩下的强点。 |
| `wild_mana_stitch.energyGain` | 改为 `0` 或移除字段。 |
| 当前 MP 上限 | 所有后续 `GainEnergy` 都应钳制为 `energy <= maxEnergy`；如果 P0 不改 runtime，至少本牌不要再触发 `GainEnergy`。 |
| 奖励池位置 | 继续排在 `blood_tithe / pulse_draw / wild_gap_key` 之后，不作为首奖或第二修补默认答案。 |
| 文案 | `修补缺口。抽牌。不会返还当前MP。` 或更短：`修补缺口。抽1。` |

P0 验收口径：

- 单独打出 `wild_mana_stitch` 不增加当前 MP。
- `debt_hook -> wild_mana_stitch` 后 `energy` 不应从 3 变 4。
- `0 -> wild_mana_stitch -> row_cleave` 仍可完成修补链与授权，但 payoff 应主要消耗临时授权，而不是靠被回填的当前 MP 支付。
- `maxEnergy` 始终为 3；restart 后没有任何该牌或 MP 改动残留。

这会让 `wild_mana_stitch` 仍强于普通 draw repair，因为它是 0 费 Wild 且可倍率抽牌；但它不再同时是当前 MP 引擎。

### P1：如果需要返 MP，改成“下一段修补信用”

目标：保留“缝合资源缺口”的手感，但不生成通用当前 MP。

建议新增一个窄资源概念，不叫 `energyGain`：

```text
StitchCredit +1
触发：本次出牌产生 ChainRepaired
限制：只能支付下一张 cost 0-2 的非 payoff 链路牌
上限：同一时刻最多 1
过期：下一张牌后、链断裂、end-turn、Reward/Settlement 立刻清空
禁止：不能支付 cost 3 payoff，不能提高 current MP，不能超过 maxEnergy
```

数值建议：

| 场景 | P1 结果 |
| --- | --- |
| opener 直接打 `wild_mana_stitch` | 不触发 credit。 |
| `0 -> wild_mana_stitch` 修补 1 段 | 获得 `StitchCredit +1`，只帮助下一张 2MP 段，不帮助 payoff。 |
| `0 -> 1 -> wild_mana_stitch` 修补 2 段并获得授权 | 不再给通用当前 MP；如给 credit，也必须在授权生成时清空，避免 payoff 后继续多动。 |
| broken chain 后打 Wild | 不触发 credit。 |

P1 还要处理抽牌强度二选一：

- 若保留 `StitchCredit`，`wild_mana_stitch` 的抽牌建议固定为抽 1，不吃倍率。
- 若继续让抽牌吃倍率，则不要再给任何资源信用。

我更推荐第一种：`Wild 修补 + 固定抽1 + 下一段信用`，因为它更接近“修补缺口”，而不是“抽牌爆发”。

### P2：完整资源经济与 1:1 卡牌机制复刻

目标：让资源、牌区和重排都成为可解释、可测试的卡牌系统。

P2 才做这些：

1. **资源账本**：把 `currentMP`、`maxMP`、`tempAuthorizationMP`、`repairCredit`、`runScopedMaxMP` 分开记录，所有支付都产出结构化 `PaymentRecorded`。
2. **payoff 支付策略**：获得授权的 payoff 默认优先消耗 `tempAuthorizationMP`，或至少 UI/事件必须解释当前 MP 与授权混合支付。
3. **效果解释器**：把 `drawCards / energyGain / utilities` 迁移为 `effects[]`，支持 `draw fixed`、`draw scaled`、`gain current MP capped`、`gain repair credit`。
4. **真实 reorder**：`reorder` 不再只是标签；实现查看牌堆顶 N、选择保留顺序或重排到牌堆顶/底，并有测试。
5. **指标回归**：用固定 hand/drawPile 脚本衡量每轮平均出牌数、payoff 使用授权比例、self draw 后剩余敌意图、当前 MP 是否越过 max。

P2 之前，不建议再做新的“当前 MP + 抽牌 + Wild”复合牌。

## 5. 对核心压力的影响

当前核心压力来自三件事：

1. 前排敌意图会在 end-turn 结算。
2. 玩家只有 3MP，需要在伤害、抽牌、修补之间做取舍。
3. 完成 `0 -> 1 -> 2` 后，临时授权让 3MP payoff 成为“链路完成奖励”。

保持当前 `wild_mana_stitch` 会削弱这三点：它不降敌意图，却用 0 费补链和抽多张来找答案；它返当前 MP 让 3MP 限制失真；它还能让授权变成附赠，而不是玩家主要追求的支付权。

P0 移除 `energyGain` 后的压力变化：

- 坏手仍可被修补，因为 Wild 和抽牌保留。
- self draw 仍不直接降低敌意图，玩家要承担“先找解、后清压”的风险。
- `blood_tithe` 是 0MP 低风险找牌，`pulse_draw` 是 1MP 接链找牌，`wild_gap_key` 是付费 Wild 修补，`wild_mana_stitch` 是后置高价值 Wild 抽牌；四者层级更清楚。
- payoff 授权重新成为核心链路奖励，而不是被当前 MP 回填稀释。

P1/P2 若做得好，会让修补牌更像卡牌机制复刻：资源不是泛泛加 MP，而是有使用范围、过期时机和 UI 解释的临时信用。

## 6. 最终建议

第 6 轮不应保持 `wild_mana_stitch` 当前形态。最稳的落地顺序是：

1. P0 先把 `energyGain` 从 `wild_mana_stitch` 拿掉，保留 Wild + draw。
2. 同时锁测试：当前 MP 不超过 3、该牌不改 `maxEnergy`、授权仍是 payoff-only。
3. P1 再评估是否需要“下一段修补信用”来补手感。
4. P2 再统一处理支付优先级、真实 reorder、效果解释器和完整资源账本。

一句话：`wild_mana_stitch` 应该是“修补缺口的牌”，不是“0 费临时 MP 发电机”。

STATUS: DONE
