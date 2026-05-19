# 2026-05-18 第 6 轮专家 10：制作人综合裁决

角色：第 6 轮专家 10，制作人综合裁决  
工作目录：`/Users/roc/Game-001`  
输出边界：本文只新增本 Markdown；不修改源码、不提交 git、不回滚或覆盖其他 agent 改动。  
本轮主题：修补牌、抽牌、临时资源、重排的 1:1 卡牌机制复刻。  
输出文件：`design/technical/redline-batches/long-task/2026-05-18-round-06-10-producer-synthesis.md`

## 0. 读取基线

未发现第 6 轮前 9 个专家文档，因此按备用规则读取了第 3-5 轮综合文档与当前 `prototype-web` 源码、测试。

关键事实：

- 第 3 轮已经落地奖励节奏：首奖阈值、奖励入牌顺序、下一手可见性是当前 run 内构筑的基础。
- 第 4 轮已经落地奖励分支显式合同：`repair-resource / payoff / route-bridge` 不应再漂移。
- 第 5 轮已经开放 `blood_tithe / pulse_draw`，并修正抽牌倍率文案；抽牌修补不是第 6 轮主问题。
- 当前源码里 Wild 已有 runtime：`utilities: ['wild']` 会按 `chain.nextExpectedCost` 接链，并发 `ChainRepaired`。
- 当前源码里临时授权已有 runtime：完成未断裂 `0 -> 1 -> 2` 后给 `tempAuthorizationMP += 3`，限制 `payoff-only`，离开 `PlayerTurn` 清空。
- 当前源码里 `reorder` 仍是 metadata / HUD 概念；现有测试明确不要求 runtime reorder。
- 当前 `wild_mana_stitch` 仍是 0 MP、抽牌、返当前 MP、Wild 修补的复合强牌；它的 `energyGain` 当前不区分是否真的修补成功。

## 1. 本轮三选一裁决

第 6 轮只改：

```text
Wild 修补。
```

更精确地说，本轮只做 Wild 修补的真实性与数值边界：

1. `wild_mana_stitch` 只有在本次出牌真的产生 `ChainRepaired` 时才返当前 MP。
2. 断链之后打 Wild 不再被记录为成功修补，不触发返 MP，也不能伪装成可验收的修补体验。
3. `wild_gap_key.damage` 从 1 调到 2，同步短文案，让它作为付费 Wild 修补有最小触感。

本轮不改：

- 不重构临时 MP / 授权支付系统。
- 不实现 `reorder` runtime。
- 不新增抽牌牌、不再改奖励池顺序。

制作判断：

| 候选项 | 裁决 | 理由 |
| --- | --- | --- |
| Wild 修补 | 本轮做 | 已有 runtime 和测试底座，能用小批次把“免费万能修补”收窄成真实修补。 |
| 临时 MP | 本轮不做 | `tempAuthorizationMP` 的支付、限制和回合清空已经是当前核心合同；现在改它会扩大到 payoff、HUD 和 run 边界。 |
| reorder | 本轮不做 | 没有选择 UI、没有重排 intent、没有牌堆预视合同；只做自动重排不算 1:1 复刻，真做会变成新交互系统。 |

## 2. 最小实现批次

### 2.1 必须触碰的文件

如果主线程进入实现，本批次最多触碰这些文件：

| 文件 | 必须改什么 |
| --- | --- |
| `prototype-web/src/data/cards.ts` | `wild_gap_key.damage: 1 -> 2`；同步 `rulesText / mobileEffect / detail`；给 `wild_mana_stitch` 文案写清“修补成功才返当前 MP”。如需要条件字段，只允许加最小可选字段。 |
| `prototype-web/src/sim/types.ts` | 给 `CardPlayed` 或等价事件补最小证据字段，例如 `chainRepaired`、`repairedCost`；如采用数据驱动条件，可补 `energyGainCondition?: 'chain-repaired'`。 |
| `prototype-web/src/sim/runtime.ts` | 收紧 Wild 修补判定：只有未断链且已有链路时，Wild 才能按 `nextExpectedCost` 修补；把本次是否修补成功传给 `CardPlayed`。 |
| `prototype-web/src/eca/redlineRules.ts` | `energyGain` 对 `wild_mana_stitch` 必须受“本次修补成功”约束；普通 self 抽牌和非条件返 MP 不受影响。 |
| `prototype-web/src/tests/sim/runtime.test.ts` | 覆盖 Wild opener 不返 MP、成功修补返 MP、断链后 Wild 不算修补。 |
| `prototype-web/src/tests/sim/redline-progression-card-system.test.ts` 或 `prototype-web/src/tests/sim/redline-attribute-authorization.test.ts` | 保持 `0 -> Wild -> 2 -> payoff` 的授权与清场证据。 |
| `prototype-web/src/tests/sim/card-taxonomy.test.ts` | 锁定 `wild_gap_key` 新伤害和 Wild 牌集合仍只限 repair 角色。 |

如果实现者能用 5 个文件完成，不要强行补第 6、第 7 个文件；但不能为了少触碰文件而把条件返 MP 写成不可追踪的隐式行为。

### 2.2 不许触碰的文件和行为

本批次硬禁止：

- 不碰 `prototype-web/src/sim/rewardChoices.ts`。
- 不碰 `prototype-web/src/sim/rewardProgression.ts`。
- 不碰 `prototype-web/src/sim/runModifiers.ts`。
- 不碰 `prototype-web/src/sim/world.ts`，除非类型编译要求无行为补丁。
- 不碰 `prototype-web/src/sim/snapshot.ts`，除非新增事件字段导致类型测试必须同步。
- 不碰 `prototype-web/src/ui/hud.ts`，除非新增事件字段造成现有 HUD 测试编译失败；即便触碰也只做类型透传，不改布局。
- 不碰 `prototype-web/src/style.css`。
- 不改 `startingHand`。
- 不改 `rewardCardPool` 顺序和 `availability`。
- 不改 `HAND_SIZE`、抽牌堆洗回策略、奖励入牌顺序。
- 不改 `tempAuthorizationMP` 的数值、限制、支付目标或清空时机。
- 不新增 `reorder` intent、牌堆预视 UI、拖拽排序、保留、消耗、状态牌、升级、CardInstance、遗物、商店、地图或局外成长。

## 3. 规则口径

### 3.1 Wild 修补口径

Wild 修补只在以下条件同时满足时成立：

1. 本回合链路已经开始。
2. 当前链路没有 `broken`。
3. 本张牌带 `utilities: ['wild']`。
4. 本张牌按当前 `chain.nextExpectedCost` 记入 `playedCosts`。

成立时：

- 发 `ChainRepaired`。
- `CardPlayed` 带出 `chainRepaired: true` 和 `repairedCost`。
- 参与倍率递增。
- 若因此形成未断裂 `0 -> 1 -> 2`，继续发 `AuthorizationGranted`。

不成立时：

- 不发 `ChainRepaired`。
- 不返 Wild 条件 MP。
- 不允许后续把这条 broken chain 伪装成授权链。

### 3.2 `wild_mana_stitch`

目标不是削成废牌，而是从“免费万能牌”改成“真正修补成功才赚资源”。

验收打法：

```text
debt_hook(0) -> wild_mana_stitch(修补 expected 1) -> row_cleave(2) -> severance_burst(授权支付)
```

预期：

- `wild_mana_stitch` 修补时仍抽牌。
- 修补成功时返当前 MP +1。
- `row_cleave` 完成 `0 -> 1 -> 2` 后给 `tempAuthorizationMP = 3`。
- 3 MP payoff 可用授权支付。
- `maxEnergy` 仍是 3。

反例：

```text
wild_mana_stitch 作为第一张牌
```

预期：

- 可以作为 0 MP self 牌开链并抽牌。
- 不发 `ChainRepaired`。
- 不返 MP。

反例：

```text
debt_hook(0) -> row_cleave(2，断链) -> wild_mana_stitch
```

预期：

- Wild 不修复已经 broken 的链。
- 不发 `ChainRepaired`。
- 不返 MP。
- 不产生授权。

### 3.3 `wild_gap_key`

本轮允许把 `damage` 从 1 调到 2。

理由：

- 它是付 1 MP 的低伤害 Wild，应该比 0 MP 抽牌修补更有即时触感。
- 接在 0 MP 后按 x2 也只是造成 4，仍低于正常 1 MP 攻击牌。
- 这是数据改动，不改变支付、目标、奖励池、链路或授权系统。

## 4. 验收标准

### 4.1 自动化验收

实现后至少跑：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test -- src/tests/sim/runtime.test.ts src/tests/sim/redline-progression-card-system.test.ts src/tests/sim/redline-attribute-authorization.test.ts src/tests/sim/card-taxonomy.test.ts
```

若新增或调整 `CardPlayed` 类型字段影响 HUD helper，再追加：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test -- src/tests/ui/hud-target-selection.test.ts
```

最后跑：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run
```

通过标准：

- Wild opener 不返 MP。
- Wild 成功修补时发 `ChainRepaired`，并且 `CardPlayed.chainRepaired === true`。
- 断链后 Wild 不发 `ChainRepaired`，不返 MP。
- `wild_mana_stitch` 成功修补后仍能接 `row_cleave` 形成授权。
- payoff 授权支付仍只适用于 3 MP、`all-enemies`、`burst` 终结牌。
- `tempAuthorizationMP` 结束回合清空，`maxEnergy` 保持 3。
- `wild_gap_key.damage === 2`，Wild 牌集合仍只有 `wild_gap_key / wild_mana_stitch`。
- `paper_shatter / lantern_captain` 的 `reorder` 相关测试继续证明不承诺 runtime reorder。

### 4.2 构建和浏览器验收

如果只改 runtime / tests / 非可见类型，浏览器不是本批次硬要求。

但如果同步改了 `rulesText / mobileEffect / detail` 的可见文案，补一次轻量浏览器复核：

- 桌面 `1366x768`：奖励卡与手牌中 Wild 文案不溢出。
- 移动 `390x844`：`修补2`、`修补成功返MP` 类文案不挤破手牌按钮。
- 不做视觉重排；发现溢出只修文字长度，不改 CSS。

## 5. 风险与回滚

### 5.1 主要风险

| 风险 | 表现 | 控制方式 |
| --- | --- | --- |
| 条件返 MP 破坏旧 self resource | `blood_tithe / pulse_draw` 抽牌或普通 `energyGain` 牌受影响 | 条件只挂在 Wild 修补牌或新增字段，不改通用抽牌路径。 |
| `CardPlayed` 加字段导致测试工厂编译失败 | TS 类型报错 | 字段设为必填时同步所有 `CardPlayed` 构造；如影响面过大，改为可选字段但测试必须断言 Wild 事件存在。 |
| broken chain 语义变化影响老测试 | 旧测试期待 Wild 在 broken 后仍 `ChainRepaired` | 以本裁决为准，更新测试；broken 后 Wild 不算成功修补。 |
| `wild_gap_key` 提伤害影响平衡 | repair 分支伤害略高 | 只从 1 到 2，不改倍率、cost、targets；若体验过强，单独回滚该数据行。 |
| 实现者顺手做 reorder | 新增 UI / intent / 重排命令扩大风险 | 明确本轮禁止；reorder 进入后续专门轮。 |
| 临时授权被误改 | payoff 可支付范围或清空时机漂移 | 本轮测试必须覆盖 `payoff-only`、3 MP payoff、回合结束清空。 |

### 5.2 回滚边界

不能使用整仓回滚、整文件覆盖、`git reset --hard` 或 `git checkout --`。

如果 Wild 条件返 MP失败，按语义小补丁回滚：

1. 移除本轮新增的 `energyGainCondition` 或 `CardPlayed.chainRepaired` 消费逻辑。
2. 把 `redlineRules.ts` 的 `GainEnergy` 判断恢复为原先只看 `card.energyGain` 的路径。
3. 保留不相关的测试和他人改动，不整文件替换。

如果只是 `wild_gap_key` 数值不合适：

1. 只把 `prototype-web/src/data/cards.ts` 中 `wild_gap_key.damage` 从 2 回 1。
2. 同步回退它的 `rulesText / mobileEffect / detail`。
3. 回退对应断言。

如果新增事件字段造成类型扩散过大：

1. 优先把字段改为 `CardPlayed` 可选字段。
2. 保持 runtime 真实事件仍写入 `chainRepaired / repairedCost`。
3. 不为了省类型改动删除 `ChainRepaired` 事件或改变授权规则。

## 6. 后续排队

第 6 轮完成后，下一批再评估：

1. `reorder` 是否要做成真实牌堆预视 / 选择重排系统。
2. 是否需要把临时资源从 `tempAuthorizationMP` 抽象为通用 turn-scoped resource。
3. 是否引入消耗、保留、状态牌或 CardInstance。

这些都不是第 6 轮最小批次。

## 7. 制作人最终裁决

第 6 轮不要重开抽牌奖励池，也不要把 reorder 强行做成半成品。当前最小、最有收益、最可验收的批次是 Wild 修补：

```text
修正 wild_mana_stitch：只有真实修补成功才返当前 MP；
收紧 broken chain 后 Wild 不算修补；
把 wild_gap_key 从 1 伤害调到 2，作为付费修补的最小手感补偿。
```

临时授权系统保持现状，只作为验收链路的一部分；reorder 留到具备交互合同后再做。

STATUS: DONE
