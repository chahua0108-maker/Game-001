# 2026-05-19 Round 11-04：Wild 延长 3+ Stack 运行时合同评估

角色：第 11 轮专家 04，运行时合同工程师  
工作目录：`/Users/roc/Game-001`  
输出边界：只写本文档；不改源码、不提交、不回滚他人改动。  
验证基线：`npm run test:sim -- --run` 通过 104、跳过 2；`npm run test:ui -- --run` 通过 14。  

## 0. 总判断

可以接，但不要把“Wild 延长 3+ stack”塞进现有 `ChainRepaired` 语义里。当前 runtime 已经支持 Wild 修补 0->1->2 缺口：`advanceCostChain()` 用 `effectiveCost` 覆盖牌面费用，`CardPlayed` 暴露 `printedCost/effectiveCost/chainRepaired/repairedCost`，`redlineRules` 再按 `event.effectMultiplier` 结算伤害或抽牌。

最小安全接入应定义为：

```text
0 -> 1 -> 2 已经成立后，Wild 可以按 nextExpectedCost 延长 stack；
它增加 multiplier 和 effectiveCost，但不等同于“修补”，不触发 chain-repaired MP 返还；
它不新增支付渠道，不改变 printedCost 支付，不授予额外 authorization。
```

结论：

- **需要新增事件或至少新增事件字段。推荐新增事件 `ChainExtended`。**
- **需要改 UI helper。** 当前 `Hud.cardChainRead()` 会把 `nextExpectedCost >= 3` 的 Wild 预览成 `断x1`。
- **不建议复用 `ChainRepaired`。** 复用会误触发 `wild_mana_stitch` 的 `GainEnergy`，并让日志继续显示“修补MP3/4”，语义不干净。

## 1. 当前合同快照

| 合同点 | 当前事实 | 对 3+ 延长的影响 |
| --- | --- | --- |
| Wild 入口 | `advanceCostChain()` 只看 `card.utilities?.includes('wild')`。 | 入口足够窄，不需要新 `Intent`。 |
| 修补窗口 | `expectedCost > 0 && expectedCost < 3`。 | 3+ 被明确排除；这是本次最小修改点。 |
| 支付 | `validatePlayCard()` 按 `card.cost` 检查和扣费。 | 可继续保留，Wild 延长不应免费支付印刷费用之外的东西。 |
| 事件输出 | `ChainAdvanced`、`ChainRepaired`、`CardPlayed`。 | `ChainAdvanced` 可继续存在；3+ 需要和 repair 分开表达。 |
| 授权 | `isAuthorizationChain()` 只认 `[0,1,2]` 且长度为 3。 | 延长 3+ 不应再次授权，现有函数天然阻止。 |
| self resource | `redlineRules` 用 `event.chainRepaired` 决定返 MP。 | 这是不能复用 `chainRepaired` 的核心原因。 |
| UI 预览 | `cardChainRead()` 只把 `nextExpectedCost < 3` 的 Wild 标成修补。 | 3+ Wild 会被显示为断链，需要改。 |

## 2. 推荐最小接入方案

第一刀只动运行时合同，不扩卡池、不改奖励、不改结算层：

1. 在 `advanceCostChain()` 里把 Wild 的分支拆成两类：
   - `canRepairWithWild`: 仍然只覆盖 `expectedCost` 为 1 或 2 的缺口。
   - `canExtendWithWild`: `isWild && playedCosts.length >= 3 && !broken && expectedCost >= 3`。
2. `playedCost` 对 repair/extend 都使用 `expectedCost`，所以 stack 可以继续 x4、x5。
3. `chainRepaired` 只在 repair 为 true；extend 不设置 `repairedThisTurn`。
4. 新增 `chainExtended` 和 `extendedCost` 到 `CardPlayed`，或新增 `ChainExtended` 事件。推荐两者都加：事件给 trace/feed，字段给 rule/UI 快照。
5. `redlineRules.card.self.resource` 继续只看 `event.chainRepaired`，因此 `wild_mana_stitch` 在 3+ 延长时抽牌可吃 multiplier，但不返 MP。
6. `AuthorizationGranted` 仍只由 `[0,1,2]` 触发，3+ 延长不再给第二份授权。

## 3. 是否需要新增事件

建议新增：

```ts
{
  type: 'ChainExtended';
  traceId: TraceId;
  tick: number;
  cardId: CardId;
  extendedCost: number;
  nextExpectedCost: number;
  multiplier: number;
}
```

理由：

- `ChainRepaired` 当前含义是“补 1/2 缺口”，测试也按这个理解断言。
- `CardPlayed.chainRepaired` 已经被 `redlineRules` 当成资源返还条件。
- `combatEventLabel()` 现在把 repair 展示为 `修补MP${repairedCost}`；3+ 应该是 `延长MP3` 或 `续链MP3`。
- 调试时需要区分“坏手修补成功”和“已经成链后的 stack 延长”，否则平衡日志会混在一起。

如果为了极限少改，也可以不新增事件，只给 `CardPlayed` 增加 `chainExtended/extendedCost`。但这样 trace 里缺一条明确事件，不利于后续测试和 HUD feed。

## 4. 是否要改 UI Helper

要改，至少两个点：

1. `Hud.cardChainRead()`：当前 Wild 预览条件是 `nextExpectedCost > 0 && nextExpectedCost < 3`。当 chain 已经是 `[0,1,2]`、`nextExpectedCost === 3` 时，Wild 会落入普通 `continues` 检查，因为 Wild 的 `card.cost` 是 0 或 1，所以 UI 会显示 `断x1`。这会和 runtime 新行为冲突。
2. `combatEventLabel()`：当前只认 `event.chainRepaired && repairedCost`，需要把 3+ 延长展示成短 token，例如 `延长MP3`，避免继续写“修补MP3”。

不建议先改 `hudCardPaymentRead()`。支付仍按印刷费用和授权规则走，Wild 延长不是授权支付，也不是新 MP 槽。

## 5. 工程镜头

| # | 镜头 | 当前锚点 | 接入判断 |
| ---: | --- | --- | --- |
| 1 | Wild 判定入口 | `advanceCostChain()` 的 `isWild`。 | 最小接入点在这里，不需要新增 `Intent`。 |
| 2 | 修补窗口 | `canRepairWithWild` 限制 `expectedCost < 3`。 | 不要直接删上界；应拆 `repair` 和 `extend`。 |
| 3 | 有效费用 | `playedCost = canRepairWithWild ? expectedCost : card.cost`。 | extend 也应让 `effectiveCost = expectedCost`。 |
| 4 | 断链合同 | `!continues` 产生 `ChainBroken`，并写 `breakReason`。 | extend 生效后，3+ Wild 不应进入 `ChainBroken`。 |
| 5 | 倍率增长 | `multiplier = previous + 1`，`ChainAdvanced` 先发。 | 3+ 延长可复用增长逻辑，避免新倍率系统。 |
| 6 | 修补副作用 | `world.chain.repairedThisTurn = true` 只在 `chainRepaired`。 | extend 不应设置，否则会污染“本回合修补过”。 |
| 7 | 授权触发 | `isAuthorizationChain()` 只认 `[0,1,2]`。 | 保持不变；3+ 不追加授权。 |
| 8 | 支付记录 | `validatePlayCard()` 与 `CardPaymentRecorded` 按 printed cost。 | Wild 延长仍按 printed cost 支付，不改支付事件。 |
| 9 | 规则结算 | `redlineRules` 使用 `event.effectMultiplier` 结算伤害/抽牌。 | 延长后伤害/抽牌自然吃 x4+；这是目标收益。 |
| 10 | 返 MP 条件 | `card.self.resource` 检查 `event.chainRepaired`。 | 必须保证 extend 不设置 chainRepaired。 |
| 11 | 终结牌增强 | `PayoffTriggered.enhanced = multiplier >= 3`。 | 3+ 延长会让后续 payoff 继续 x5，不需要新 payoff 事件。 |
| 12 | HUD 预览 | `cardChainRead()` 的 Wild 条件排除 `nextExpectedCost >= 3`。 | 必改，否则玩家看到“断x1”但 runtime 实际续链。 |
| 13 | HUD 日志 | `combatEventLabel()` 输出 `修补MP...`。 | 需要新增 `延长MP...` 短 token。 |
| 14 | 类型合同 | `GameEvent.CardPlayed` 当前只有 `chainRepaired/repairedCost`。 | 加 `chainExtended/extendedCost` 比复用 repair 更稳。 |
| 15 | 测试护栏 | `runtime.test.ts` 已覆盖 opener、broken、Wild Gap printed/effective 分离。 | 新测试必须不破坏这些现有断言。 |

## 6. 测试点建议

必须新增或调整的测试点：

1. `runtime.test.ts`：`debt_hook -> redline_cut -> row_cleave -> wild_gap_key` 后，`wild_gap_key` 以 `printedCost: 1`、`effectiveCost: 3`、`effectMultiplier: 4` 续链。
2. `runtime.test.ts`：同路径应出现 `ChainExtended`，不出现 `ChainRepaired`。
3. `runtime.test.ts`：`wild_mana_stitch` 在 3+ 延长时不产生 `GainEnergy`，但可按 x4 抽牌。
4. `runtime.test.ts`：broken chain 后的 Wild 仍不 repair、不 extend，沿用现有 broken 行为。
5. `runtime.test.ts`：Wild opener 仍不是 repair/extend，沿用 `test-wild-opener` 断言。
6. `redline-attribute-authorization.test.ts`：0->1->2 授权仍只产生一次；3+ Wild 不新增第二个 `AuthorizationGranted`。
7. `redline-progression-card-system.test.ts`：Wild 仍是 repair-role 卡，不把 `description` 改成泛用终结或永久成长。
8. `hud-target-selection.test.ts`：chain 为 `[0,1,2]`、`nextExpectedCost: 3` 时，Wild helper 显示 `延长MP3x4` 或同等短 token。
9. `hud-target-selection.test.ts`：3+ Wild 的支付状态仍按 printed cost，不显示授权支付。
10. `combat feed` 相关测试或浏览器 QA：`CardPlayed.chainExtended` 显示 `延长MP3`，不显示 `修补MP3`。

现有必须继续通过的测试锚点：

- `runtime.test.ts` 中 `test-wild-repair`：0 后 Wild 修补为 1，`chainRepaired: true`，可返 MP。
- `runtime.test.ts` 中 `test-wild-opener`：Wild 起手不返 MP。
- `runtime.test.ts` 中 `test-wild-broken-repair`：断链后 Wild 不修。
- `runtime.test.ts` 中 `test-wild-gap-repair-2`：Wild Gap 牌面 1、有效 2、完成授权。
- `redline-attribute-authorization.test.ts`：Wild 修补后仍能打出授权 payoff。
- `hud-target-selection.test.ts`：授权只支付 3 费终结牌，不支付 `row_cleave`。

## 7. 风险

| 风险 | 级别 | 说明 | 规避 |
| --- | --- | --- | --- |
| 复用 `ChainRepaired` 导致免费返 MP | P0 | `wild_mana_stitch.energyGainCondition` 正是 `chain-repaired`。 | 新增 `ChainExtended`，extend 不设置 `chainRepaired`。 |
| 3+ stack 无上限导致倍率爆炸 | P1 | Wild self draw 在 x4/x5 后可继续找牌。 | 第一刀只允许 `expectedCost === 3`，或测试明确 x4 上限；不要一开始无限延长。 |
| UI 显示断链但 runtime 续链 | P0 | `cardChainRead()` 当前 `< 3`。 | 同步改 helper 和 UI 测试。 |
| 授权被重复发放 | P1 | 如果未来误改 `isAuthorizationChain()` 为前缀匹配，会重复授权。 | 保持长度精确等于 3，并新增“不重复授权”测试。 |
| 牌面费用和有效费用混淆 | P1 | `wild_gap_key` 牌面 1、有效 3 时容易误扣 3。 | 继续让 `validatePlayCard()` 只管 printed cost。 |
| 日志语义污染 | P2 | 玩家/调试日志把 3+ 写成修补，会误判坏手修复率。 | combat feed 使用 `延长MP3`。 |

## 8. 回滚策略

最小回滚应非常直接：

1. 删除或关闭 `canExtendWithWild` 分支，保留现有 `canRepairWithWild expectedCost < 3`。
2. 删除 `ChainExtended` 和 `CardPlayed.chainExtended/extendedCost` 字段。
3. 还原 `Hud.cardChainRead()` 对 `nextExpectedCost >= 3` Wild 的特殊预览。
4. 删除新增的 3+ 延长测试，保留现有 Wild 修补测试。
5. 重新跑 `npm run test:sim -- --run` 和 `npm run test:ui -- --run`，确认回到本文档记录的基线。

因为该方案不改卡牌数据、不改 reward pool、不改支付、不改 enemy/turn 结算，所以回滚不需要迁移存档或清理世界状态。

## 9. 最小实施顺序

1. 先补类型：`GameEvent` 增加 `ChainExtended`，`CardPlayed` 增加可选 `chainExtended/extendedCost`。
2. 改 `advanceCostChain()`，拆 `canRepairWithWild` 与 `canExtendWithWild`。
3. 改 `tickWorld()` 构造 `CardPlayed` 的字段映射。
4. 改 `Hud.cardChainRead()` 和 `combatEventLabel()` 的 3+ 展示。
5. 补 runtime 测试，再补 HUD helper 测试。
6. 跑 `test:sim`、`test:ui`，再视 UI 风险跑 `npm run qa:ui`。

STATUS: DONE
