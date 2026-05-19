# 2026-05-18 Round 05-06 修补牌数值延后审查

角色：第 5 轮专家 06，修补牌数值延后审查员  
工作目录：`/Users/roc/Game-001`  
输出边界：只读源码与既有设计文档；本文只新增本审查文件，不修改源码、不提交 git。  
审查问题：本轮是否应同时改 `wild_mana_stitch` 的条件返 MP 和 `wild_gap_key.damage`。

## 0. 结论

本轮不建议把 `wild_mana_stitch` 条件返 MP、`wild_gap_key damage 1 -> 2` 和开放抽牌修补牌放进同一个落地补丁。

更稳的裁决是：

1. 第 5 轮主线先处理开放抽牌修补牌：`blood_tithe` / `pulse_draw` 从 `reserve-test` 进入奖励语义、奖励池、下一手可见性和 run/meta 边界。
2. `wild_mana_stitch` 条件返 MP 延后到抽牌修补牌合同通过之后再做。
3. `wild_gap_key damage 1 -> 2` 设计上成立，但也建议延后到同轮后置小补丁或下一轮，不和抽牌修补牌开放同时作为同一组验收变量。
4. 如果制作上强制本轮必须做一个 Wild 数值改动，优先只做 `wild_gap_key damage 1 -> 2`，不要同时动 `wild_mana_stitch` 的 runtime 条件返 MP。

原因不是这两个 Wild 调整不该做，而是它们会改变“修补牌为什么被选、怎么救坏手、奖励三选一是否可读”的判断基线。开放抽牌修补牌本身已经会改变 repair-resource 分支密度；同一轮再调 Wild 牌，会让测试失败或体验变化难以归因。

## 1. 当前事实基线

### 1.1 第 4 轮已明确留下的边界

第 4 轮综合结论已经把本轮建议指向“开放抽牌修补牌与奖励池排序”，并明确第 4 轮不做：

- 不开放 `blood_tithe` / `pulse_draw`。
- 不重排 `rewardCardPool`。
- 不改 `wild_mana_stitch` 条件返 MP。
- 不改 `wild_gap_key` 伤害。

这意味着第 5 轮的主要未决问题不是“Wild 数值是否正确”，而是先把抽牌修补牌开放这件事做成可测合同。

### 1.2 当前源码状态

`prototype-web/src/data/cards.ts` 当前显示：

- `blood_tithe`：`availability = 'reserve-test'`，已有 `rewardBranches: ['repair-resource']`，但还不是正式奖励牌。
- `pulse_draw`：`availability = 'reserve-test'`，已有 `rewardBranches: ['repair-resource', 'route-bridge']`，但还不是正式奖励牌。
- `rewardCardPool` 当前不包含 `blood_tithe` / `pulse_draw`。
- `wild_mana_stitch`：`cost 0`、`targets self`、`drawCards 1`、`energyGain 1`、`utilities ['wild', 'draw', 'mana']`，并且是当前 `rewardCardPool` 第一张。
- `wild_gap_key`：`cost 1`、`damage 1`、`utilities ['wild']`。

`prototype-web/src/eca/redlineRules.ts` 当前对 self resource 的处理是：只要卡牌有 `energyGain`，`CardPlayed` 后就生成 `GainEnergy`。它不检查这次出牌是否真的产生 `ChainRepaired`。

`prototype-web/src/sim/types.ts` 当前 `CardPlayed` 事件还没有 `chainRepaired` / `repairedCost` 字段。也就是说，`wild_mana_stitch` 条件返 MP 不是纯数据改动，会触碰事件合同、runtime、ECA 规则和测试。

## 2. 为什么这两个调整最终仍然应该做

### 2.1 `wild_mana_stitch` 的问题是真实的

当前 `wild_mana_stitch` 同时具备：

- 0 MP；
- Wild 修补缺口；
- self draw；
- 当前 MP +1；
- 作为 repair-resource 首位奖励候选。

这会让它在玩家眼里接近“免费补链、补手、补资源”的万能牌。它会压低 `blood_tithe`、`pulse_draw`、`wild_gap_key` 的存在感。第 3/4 轮对它的方向判断是合理的：返 MP 应该只在真实修补成功时发生，而不是任意打出都返。

### 2.2 `wild_gap_key damage 1 -> 2` 的方向也成立

`wild_gap_key` 是更干净的 Wild 修补牌：付 1 MP、低伤害、按当前缺口费用接链。`damage = 1` 的反馈太弱；调到 2 后，接在 0 费后按 x2 只造成 4，仍明显弱于 `redline_cut` 的 18。它增强的是“我花 1 MP 修补时确实做了点事”的触感，不会替代正常 1 MP 攻击。

所以延后不是否定这两个改动，而是把它们从“第 5 轮开放抽牌修补牌”的主验收里拆出来。

## 3. 为什么本轮不应同时改

### 3.1 会污染开放抽牌修补牌的验收

开放 `blood_tithe` / `pulse_draw` 要证明五件事：

1. 奖励池不再混入不可见 `reserve-test` 牌。
2. 两张牌开放后仍命中 `repair-resource`，不被 `chainRole: starter/bridge` 漂移成纯 route。
3. 选择后能进入当前 run 的下一手。
4. 不改变 `maxEnergy`，restart 后清空。
5. 固定坏手脚本里能真的用抽牌修补缺 1 或缺 2。

如果同时改 `wild_mana_stitch` 条件返 MP，失败可能来自：

- 抽牌修补牌开放错了；
- 奖励分支排序错了；
- `CardPlayed.chainRepaired` 事件没接好；
- `GainEnergy` 条件过滤错了；
- broken chain 后的 Wild 语义变化影响旧测试。

这会把“开放抽牌修补牌是否成立”变成一个混合系统问题，不利于第 5 轮快速收敛。

### 3.2 `wild_mana_stitch` 不是小数据改动

条件返 MP 至少需要以下改动面：

- `CardDefinition` 增加类似 `energyGainCondition: 'chain-repaired'` 的字段。
- `CardPlayed` 增加本次是否修补成功的信息。
- `advanceCostChain` 更严谨地区分 non-broken chain 的 Wild 修补。
- `redlineRules.card.self.resource` 只在条件满足时发 `GainEnergy`。
- 新增 opener 不返、成功修补返、broken 后不返三类测试。

这些改动和开放抽牌修补牌的 `availability`、`rewardCardPool`、`rewardBranches`、下一手发牌测试没有同一条最小风险线。

### 3.3 `wild_gap_key` 虽小，也会改变对 repair-resource 分支的读数

`wild_gap_key damage 1 -> 2` 是低风险数据改动，但它仍然改变玩家对 repair 分支的比较：

- `pulse_draw` 是无伤害、抽牌续链；
- `blood_tithe` 是 0 费、无伤害、找桥；
- `wild_gap_key` 是 1 MP、可修补、有即时伤害；
- `wild_mana_stitch` 是 0 MP、抽牌、返 MP。

开放抽牌修补牌那一轮，最需要看的是“抽牌修补是否能作为 Wild 之外的 repair-resource 后备”。同轮增强 `wild_gap_key`，会让 repair 分支里同时多出“新可见抽牌牌”和“更强 Wild 牌”，很难判断后续优先级到底应该给谁。

## 4. 推荐落地顺序

### 4.1 第 5 轮主补丁：只开放抽牌修补牌

本补丁只处理：

- `blood_tithe.availability: 'reserve-test' -> 'reward'`。
- `pulse_draw.availability: 'reserve-test' -> 'reward'`。
- 将两张牌按明确意图加入奖励候选池，优先作为 Wild 被拿走后的 repair-resource 后备。
- 保持 `rewardBranches` 显式合同。
- 锁住 reward pool 可见性、分支稳定性、下一手可见性、run/meta 边界。
- 不改变 `maxEnergy`。
- 不改 `wild_mana_stitch.energyGain`。
- 不改 `wild_gap_key.damage`。

如果担心 `wild_mana_stitch` 仍然作为首位奖励压住新开放牌，先用奖励池排序和测试场景解决可见性，不用在同补丁里改 runtime 数值。

### 4.2 第 5 轮后置小补丁或第 6 轮：Wild 数值修补

在抽牌修补牌开放测试全绿后，再进入 Wild 数值补丁：

1. `wild_gap_key damage 1 -> 2`，同步 `rulesText` / `mobileEffect`。
2. `wild_mana_stitch.energyGain` 保留数值，但新增条件：只有 `chainRepaired` 时返当前 MP。
3. 补 `CardPlayed.chainRepaired` / `repairedCost`。
4. 收紧 broken chain 后 Wild 不算成功修补的语义。
5. 增加 `wild_mana_stitch` 三条条件返 MP 测试和 `wild_gap_key` 倍率伤害测试。

这个顺序能保持每次验收只回答一个问题：先证明抽牌修补牌能开放，再证明 Wild 牌数值不压死它们。

## 5. 如果制作上要求同轮完成

同轮可以，但不要同补丁、不要同一组验收口径。

最低风险拆法：

1. 补丁 A：开放 `blood_tithe` / `pulse_draw`，跑奖励与 run 边界测试。
2. 补丁 B：只做 `wild_gap_key damage 1 -> 2`，跑静态数据、倍率伤害和奖励三选一回归。
3. 补丁 C：最后做 `wild_mana_stitch` 条件返 MP，跑 runtime / ECA / authorization / repair 回归。

如果只能做 A+B+C 之一，优先 A。  
如果只能在 B 和 C 里选一个，优先 B。  
`wild_mana_stitch` 条件返 MP 必须等到有时间补完整事件合同和测试时再做。

## 6. 冲突规避红线

- 不把 `wild_mana_stitch` 条件返 MP 作为开放 `blood_tithe` / `pulse_draw` 的前置条件。
- 不用 `wild_gap_key` 提伤害来证明抽牌修补牌有效。
- 不把 `blood_tithe` / `pulse_draw` 写进起始牌组来快速证明修补。
- 不把任何修补牌改成永久 `maxEnergy` 成长。
- 不在同一失败测试里同时断言抽牌修补开放、Wild 条件返 MP、Gap Key 新伤害。
- 不用随机 run 证明这组改动；全部使用固定 hand / drawPile / reward candidate pool。

## 7. 本审查裁决

| 项目 | 设计方向 | 本轮是否随开放抽牌修补牌一起改 | 理由 |
| --- | --- | --- | --- |
| `blood_tithe` / `pulse_draw` 开放 | 应做 | 是，第 5 轮主线 | 这是第 4 轮交给第 5 轮的主问题，且已有 `rewardBranches` 合同铺垫。 |
| `wild_mana_stitch` 条件返 MP | 应做 | 否，延后 | 需要 runtime / event / ECA / test 改动，会污染抽牌修补开放验收。 |
| `wild_gap_key damage 1 -> 2` | 应做 | 默认否，后置小补丁可做 | 数据风险低，但会改变 repair 分支比较基线；如强制本轮做，必须单独验收。 |

最终建议：第 5 轮先把开放抽牌修补牌做稳，再做 Wild 数值修补。不要用一次补丁同时回答“新 repair 牌能不能开放”和“旧 Wild 牌该不该削强/增强”两个问题。

STATUS: DONE
