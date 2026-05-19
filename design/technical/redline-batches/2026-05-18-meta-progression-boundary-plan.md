# Redline 局外成长 / Meta Progression 边界方案

日期：2026-05-18  
角色：Redline 局外成长 / Meta Progression PM  
范围：只做设计边界文档；不改 `prototype-web`，不改 runtime / HUD / 测试 / 卡牌数据。

## 一句话裁决

当前不能把永久成长直接塞进战斗。

Redline 现在要守住四层生命周期：

```text
当前回合临时授权
  -> 当前战斗内状态
  -> 本次 run 的临时成长 / 清算奖励
  -> 账号局外永久解锁
```

P0 battle 只证明卡牌链路、敌意图、修补、终局授权和 payoff 兑现。  
P1 可以做“本次清算临时成长”，让奖励带到本 run 的下一回合或下一场。  
P2 才做账号存档、永久解锁、永久 Max MP、角色/卡池/天赋等 meta progression。

## 1. 局外成长、run 奖励、战斗临时授权的边界

### 1.1 局外成长属性

局外成长是跨 run 保存的账户层进度。它回答的是：

```text
我这次失败或通关后，账号层留下了什么？
下次重新开 run 时，我有哪些新选项？
```

它不应该回答：

```text
我当前这张牌为什么能打？
本回合为什么能支付 3 MP payoff？
当前战斗为什么突然多了最大 MP？
```

局外成长的正确作用是“扩大未来选择空间”，而不是在 P0 battle 里直接抬数值。永久成长如果过早进入，会污染当前验收：玩家会以为 Redline 的解法是把 MP、伤害、血量堆大，而不是理解 `0 -> 1 -> 2 -> 终局授权 -> payoff`。

### 1.2 本次清算 / run 奖励

本次清算奖励发生在一次战斗、一次阶段清算、或一次 run 内节点之后。它回答的是：

```text
我刚才这段打法暴露了什么问题？
接下来这一局，我要补修链、延长、还是强化终结？
```

P1 可以让它成为 `RunModifier`：只在本次 run 内有效，run 结束清空。它可以影响下一回合、下一场或后续奖励池，但不能写入账号档案。

推荐 P1 的清算奖励只做三类：

| 类型 | 玩家理解 | 生命周期 | P1 可做方式 |
| --- | --- | --- | --- |
| 修补 | 坏手牌还有救 | 本 run / 下一场 / 下一回合 | 首次断链可用 Wild 补一次、下场起手保底一张修补牌 |
| 延长 | 我能多走一步程序 | 本 run / 下一场 | 下场 Max MP +1、本 run 每场第一次正确接链返 1 MP |
| 终结 | payoff 更早或更大 | 本 run / 下一场 | payoff charge、下一张 payoff armed 条件降低 |

这里的“成长”仍是 run 内临时成长，不是账号永久成长。

### 1.3 当前回合临时授权

当前回合临时授权只服务 P0 battle。它回答的是：

```text
为什么基础 Max MP = 3 时，我完成 0 -> 1 -> 2 后还能支付 3 MP payoff？
```

推荐口径保持现有属性系统结论：

```text
完成有效 0 -> 1 -> 2
  -> 本回合获得终局授权 +3
  -> 授权只支付 3 MP payoff 或下一张指定 expected cost
  -> 回合结束清空
```

它不是最大 MP 成长，不是局外成长，不是 run 奖励。它是回合内支付许可。

## 2. P1 / P2 分期建议

### P1：本次清算临时成长

P1 目标不是做完整 meta progression，而是让玩家看到“刚才这段清算改变了本 run 的下一段选择”。

P1 可以先做：

1. 战后 / 清算后三选一：`repair / extension / payoff`。
2. Run 内 `Max MP +1`，但只作为 extension 奖励，固定上限 4，只在本 run 有效。
3. 下一场起手保底：例如保底 1 张 `MP0` 或 1 张修补牌。
4. 每场第一次正确接链返 1 MP，作为 run 内规则，不提高最大 MP。
5. 每场第一次断链不清空 chain，但倍率少升一级。
6. Payoff charge：正确接链累积，达到阈值后下一张 payoff armed。
7. 一次性 reroll / redraw，用来验证奖励控制，不进入账号系统。
8. 奖励偏向：如果上一战缺修补，下一次奖励更容易出现修补类。

P1 必须遵守：

- 只写入本次 run；
- run 结束清空；
- 不进入账号存档；
- 不让 P0 battle 的通过条件依赖这些奖励；
- 不把 `Max MP +1` 变成默认升级或唯一正确选项。

P1 不应该做：

- 永久天赋树；
- 账号等级；
- 永久 Max MP；
- 永久伤害 / 生命 / 费用减免；
- 卡牌永久强化；
- 商店、完整地图、事件池、角色熟练度。

### P2：账号存档 / 解锁系统

P2 才进入完整局外成长。进入条件应该是：

1. P0 已证明玩家能理解一回合链路和终局授权。
2. P1 已证明清算奖励能改变本 run 后续路线。
3. QA 能区分“当前回合临时授权”“本 run 临时 modifier”“账号永久解锁”。
4. 有明确的存档版本、解锁表、重置边界和 UI 入口。

P2 才能做：

- `AccountProfile` 本地存档；
- `MetaUnlock` 解锁表；
- 永久货币；
- 永久角色 / 起手套组 / 卡池入口；
- 永久 Max MP 或永久资源授权；
- 难度层、挑战规则、成就、图鉴；
- 存档迁移和重置。

P2 的设计原则：优先解锁“选项”，谨慎给予“裸数值”。例如解锁新的奖励类型、角色起手约束、reroll 权限，优先级高于永久 `+10% damage` 或永久 `+1 Max MP`。

## 3. 最大魔法值 / 最大 MP 的三种来源

最大 MP 是最容易混淆的字段，必须拆成三类。

### 3.1 局外永久 Max MP

定义：

```text
账号层永久保存的基础最大 MP 修正。
```

生命周期：

- 跨 run 保留；
- 写入 `AccountProfile` 或由 `MetaUnlock` 派生；
- 需要存档、解锁条件、上限、难度缩放和新手保护。

当前裁决：

- P0 禁止；
- P1 禁止；
- P2 才评估。

原因：永久 Max MP 会直接改变每次开局的资源底盘。如果现在放进 battle，会让 P0 的 3 MP 链路验证失真。

### 3.2 Run 内临时 Max MP

定义：

```text
本次 run 内通过清算奖励获得的最大 MP 修正。
```

生命周期：

- 只在当前 run 有效；
- run 失败 / 胜利结算后清空；
- 可以通过 `RunModifier.maxMpDelta` 表达；
- 可以影响下一回合或下一场，但不应该 retroactively 改写当前已完成的支付。

P1 允许的最小版本：

```text
奖励名：信用额度
效果：本 run 后续战斗 Max MP +1
上限：本 demo 最高 4
生效：下一次发牌前 / 下一场开始，二选一写死
代价：不解决当前 Turn 4 payoff；只是延长路线验证
```

它可以证明 extension 路线，但不能成为 P0 battle 的默认解法。

### 3.3 当前回合临时授权

定义：

```text
本回合临时支付许可，不改变最大 MP。
```

生命周期：

- 当前回合生成；
- 当前回合消费或过期；
- End Turn 清空；
- 由有效 chain、修补成功或特定当前战斗事件触发；
- 只能支付受限制的目标，例如 3 MP payoff。

推荐字段语义：

```text
currentMp = 普通 MP
baseMaxMp = 基础最大 MP
runMaxMpDelta = 本 run 临时最大 MP 修正
tempAuthorizationMp = 本回合临时授权
authorizationRestriction = payoff-only / next-expected-cost
```

玩家侧文案必须避免写成“最大 MP +3”。正确表达是：

```text
终局授权 +3：本回合仅可支付终结清算。
```

### 3.4 三者对照

| 名称 | 生效层 | 是否保存 | 是否改变每回合刷新上限 | P0 battle | P1 | P2 |
| --- | --- | --- | --- | --- | --- | --- |
| 局外永久 Max MP | AccountProfile | 跨 run 保存 | 是 | 禁止 | 禁止 | 可评估 |
| Run 内临时 Max MP | RunModifier | run 结束清空 | 是，但只在本 run | 禁止作为通过条件 | 可做一次性验证 | 可扩展 |
| 当前回合临时授权 | TurnState | 回合结束清空 | 否 | 推荐 | 继续保留 | 继续保留 |

## 4. 可未来实现的局外成长项

以下是未来 P2 可实现项。全部标注为“不影响当前 P0 battle”，不能作为当前战斗验收条件。

| 项 | 局外成长内容 | 玩家价值 | 当前 P0 battle 影响 |
| --- | --- | --- | --- |
| 1. 审计许可 | 解锁奖励 reroll 次数上限 | 玩家能更主动找修补 / 终结路线 | 不影响 |
| 2. 起手批文 | 解锁不同起手包，如稳定链、修补包、payoff 包 | 形成角色/路线差异 | 不影响 |
| 3. 案卷扩容 | 解锁更多卡进入奖励池 | 扩大构筑想象 | 不影响 |
| 4. 清算执照 | 解锁新的 payoff 类型或目标范围 | 长期追求更华丽终结 | 不影响 |
| 5. 证据保管 | 解锁一张保留牌 / retain 规则入口 | 提升中后期规划 | 不影响 |
| 6. 风险契约 | 解锁高难规则，换更多清算资源 | 给高手自选难度 | 不影响 |
| 7. 债务保险 | 失败后保留少量局外货币或图鉴进度 | 降低失败挫败感 | 不影响 |
| 8. 角色授权 | 解锁不同角色起手约束，如审计员、处刑员、调度员 | 提供复玩目标 | 不影响 |
| 9. 档案图鉴 | 记录见过的敌人、卡牌、清算结果 | 收藏和学习反馈 | 不影响 |
| 10. 初始情报 | 解锁开局预知第一场敌意图或奖励倾向 | 给策略玩家计划空间 | 不影响 |
| 11. 永久 Max MP 授权 | 少量提高账号基础 Max MP，带难度或代价 | 长期资源路线 | 不影响，P2 才评估 |
| 12. 清算声望 | 永久货币 / 声望，用于解锁上面的选项 | 提供跨 run 目标 | 不影响 |

优先级建议：

- 先做选项型局外成长：reroll、起手包、奖励池、角色授权。
- 后做数值型局外成长：永久 Max MP、永久伤害、永久 HP。
- 永久 Max MP 必须带上限、代价或难度补偿，否则会成为所有玩家的第一优先升级。

## 5. 后续代码实现的最小字段建议

这里只给字段边界，不要求当前改代码。

### 5.1 `AccountProfile`

用途：跨 run 永久保存。P2 前只作为设计占位。

建议最小字段：

```ts
type AccountProfile = {
  profileId: string;
  schemaVersion: number;
  createdAt: string;
  lastPlayedAt: string;

  metaCurrency: number;
  unlockedIds: string[];
  highestClearDepth: number;
  tutorialFlags: string[];

  // P2 才允许启用；P0/P1 不读取它改变 battle。
  permanentStatBonuses?: {
    maxMpDelta?: number;
    maxHpDelta?: number;
    rerollChargesDelta?: number;
  };
};
```

边界：

- 不放当前手牌、当前敌人、当前 chain；
- 不放本 run 的 deck 实例；
- 不被 P0 battle 读取；
- 不用 `accountLevel` 直接驱动战斗数值。

### 5.2 `MetaUnlock`

用途：定义账号层永久解锁项。它是 catalog，不是当前 run 状态。

建议最小字段：

```ts
type MetaUnlock = {
  id: string;
  name: string;
  category:
    | "reward-control"
    | "starting-kit"
    | "card-pool"
    | "payoff"
    | "character"
    | "difficulty"
    | "profile-stat";

  unlockCondition: {
    kind: "clear-depth" | "currency-cost" | "achievement" | "tutorial-complete";
    value: string | number;
  };

  effect: {
    kind:
      | "unlock-reward-type"
      | "unlock-starting-kit"
      | "unlock-card-pool-entry"
      | "unlock-character"
      | "add-permanent-stat";
    value: string | number;
  };

  p0BattleImpact: "none";
};
```

边界：

- `MetaUnlock` 只决定“未来可出现什么”；
- 不直接生成当前回合授权；
- 不直接改当前 battle 敌人、手牌、MP；
- 即使未来有永久 Max MP，也必须通过 `AccountProfile -> RunStartDerivedState` 进入 run，不能在战斗中途乱改。

### 5.3 `RunModifier`

用途：本次 run 内临时成长。P1 的主要承载对象。

建议最小字段：

```ts
type RunModifier = {
  id: string;
  source: "settlement-reward" | "event" | "battle-reward";
  acquiredAt: {
    runId: string;
    battleIndex?: number;
    round?: number;
  };

  duration: "next-turn" | "next-battle" | "current-run";

  effect: {
    kind:
      | "max-mp-delta"
      | "first-gap-bridge"
      | "first-chain-refund"
      | "payoff-charge"
      | "starting-hand-guarantee"
      | "reward-reroll";
    value: number | string;
  };

  maxStacks: number;
  expiresWhen: "turn-ended" | "battle-ended" | "run-ended";
};
```

边界：

- P1 的 `Max MP +1` 放这里，不放 `AccountProfile`；
- `duration` 必须清楚，不能默认永久；
- 当前回合临时授权不应该作为 `RunModifier`，它属于 `TurnState`；
- run 结束时统一清空。

### 5.4 当前回合授权字段

当前回合授权不属于上面三者，但需要和它们区分。后续如果整理 `TurnState`，建议保留：

```ts
type TurnAuthorization = {
  amount: number;
  remaining: number;
  reason: "chain-0-1-2" | "repair-completed" | "card-effect";
  restriction: "payoff-only" | "next-expected-cost";
  sourceCardId?: string;
  expiresAt: "turn-end";
};
```

边界：

- 它不是 `Max MP +1`；
- 它不保存到 run；
- 它不保存到账户；
- 它只解释当前回合 payoff 支付。

## 6. 验收口径

后续实现或评审时，先问这几个问题：

1. 这个成长是否跨 run 保存？如果是，必须等 P2 `AccountProfile`。
2. 这个成长是否只影响本次 run？如果是，放 `RunModifier`。
3. 这个成长是否只解释当前回合支付？如果是，放 `TurnAuthorization`。
4. `Max MP +1` 是永久、run 内、还是本回合授权？三者必须在字段名、文案和 trace 中分清。
5. P0 battle 是否不用任何永久成长也能通过？如果不能，说明设计已经越界。

## 最终建议

Redline 的成长路线应由内向外推进：

```text
P0：当前回合临时授权，让战斗链路成立
P1：本次清算临时成长，让 run 路线成立
P2：账号局外解锁，让长期留存成立
```

当前最重要的不是立刻做永久属性，而是防止字段和文案把三种成长混成一团。只要守住 `AccountProfile / MetaUnlock / RunModifier / TurnAuthorization` 的边界，后续 worker 才能安全推进局外成长，而不会把 P0 battle 改成永久数值堆叠验证。
