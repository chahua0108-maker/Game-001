# Redline Run Modifier Design Draft

日期：2026-05-18
状态：P1 数据层草案 / preview-only
范围：为下一阶段“单次冒险内成长”准备可测试合同，不接入 runtime，不改变当前战斗手感。

## 1. 设计边界

Run modifier 指“本次清算内成长”：玩家在本次 run 的结算、奖励或路线选择中获得一个只影响当前 run 后续体验的增益。

它不是三类东西：

- 不是局外永久成长：失败、重开或下一次冒险不应保留。
- 不是本回合终局授权：不参与 `0 -> 1 -> 2` 后的 `tempAuthorizationMP +3` 支付规则。
- 不是 runtime 默认规则：当前草案只返回 preview / derived plan，不修改 `WorldState`、HUD、卡牌定义或战斗流程。

当前实现文件：

- `prototype-web/src/sim/runModifiers.ts`
- `prototype-web/src/tests/sim/run-modifiers.test.ts`

## 2. 初始 modifier 草案

| id | 玩家文案方向 | 数据层效果 | 生命周期 | 备注 |
| --- | --- | --- | --- | --- |
| `maxEnergyThisRunPlusOne` | 信用额度 | `maxEnergyThisRun +1` | 本次清算 | 只在 preview 中推导为 `baseMaxEnergy + 1`，默认不改 `player.maxEnergy`。 |
| `rewardRerollPlusOne` | 复核机会 | `rewardReroll +1` | 本次清算 | 影响奖励选择控制权，不改变战斗支付、抽牌或敌人节奏。 |
| `startingRepairCard` | 备用修补包 | `startingDeckAdditions: ['wild_mana_stitch']` | 本次清算 | 表示后续遭遇的起始修补资源预览，不是永久解锁。 |

所有 draft 都带同一组排除标记：

```ts
[
  'not-meta-progression',
  'not-turn-payoff-authorization',
  'not-runtime-applied'
]
```

这组标记是给后续 worker 的防漂移合同：看到这些 modifier 时，不能把它们解释成账号成长、不能拿来支付本回合 3 MP payoff，也不能假设已经接入 runtime。

## 3. 纯函数合同

当前唯一入口是：

```ts
deriveRunModifierPlan(input: RunModifierPreviewInput): RunModifierPlan
```

输入只包含 preview 所需的基础数值：

```ts
{
  baseMaxEnergy: 3,
  baseRewardRerolls: 0,
  startingDeck: ['debt_hook'],
  selectedModifierIds: [
    'maxEnergyThisRunPlusOne',
    'rewardRerollPlusOne',
    'startingRepairCard'
  ]
}
```

输出只描述推导结果：

```ts
{
  lifecycle: 'current-run',
  boundary: 'settlement-growth',
  runtimeIntegration: 'preview-only',
  derived: {
    baseMaxEnergy: 3,
    maxEnergyThisRun: 4,
    maxEnergyDeltaThisRun: 1,
    rewardRerolls: 1,
    startingDeckAdditions: ['wild_mana_stitch']
  },
  explanations: [
    'Max MP preview becomes 4 for this run only.',
    'Reward reroll preview gains 1 reroll for this run only.',
    'Starting repair card preview adds wild_mana_stitch for this run only.'
  ]
}
```

默认没有选择 modifier 时，`maxEnergyThisRun` 必须等于 `baseMaxEnergy`。这条是为了防止 `Max MP +1` 被悄悄变成 P0 默认资源规则。

## 4. 后续接入前置条件

在接入 runtime 之前，至少需要先做三件事：

1. 明确 run state 的真实归属：它不能混入当前 `PlayerState` 的回合字段，也不能混成局外存档。
2. 明确奖励来源事件：modifier 应来自结算 / 路线 / 奖励，而不是自动随战斗开始发放。
3. 明确 HUD 表示：`Max MP 4/4 本次清算`、`终局授权 +3 本回合`、`局外永久成长` 三者必须视觉和文案分层。

## 5. 当前验收

已覆盖的单测合同：

- `deriveRunModifierPlan` 不修改输入对象。
- 无 selected modifier 时不改变 `maxEnergy`。
- 所有 draft modifier 都声明 `current-run`、`settlement-growth`、`preview-only`。
- 所有 draft modifier 都显式排除局外成长、本回合 payoff 授权和 runtime 默认接入。

当前不验收：

- 不验收 runtime 中 `maxEnergy` 是否真的变为 4。
- 不验收奖励界面是否出现 reroll 按钮。
- 不验收开局是否真的塞入 `wild_mana_stitch`。
- 不验收任何战斗手感变化。
