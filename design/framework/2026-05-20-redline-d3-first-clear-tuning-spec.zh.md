# Redline D3 First-Clear 调整 Spec

日期：2026-05-20

状态：框架程序专家二次 `approve-with-changes`；第一版未通过自然通关 RED 后，第二版只允许再扩一个敌人 HP 杠杆。

## 1. 背景

D1-D3 多局难度框架已经落地，D1 / D2 自然通关回归也已提交。当前问题集中在 D3：它从 3 节点直接跳到 6 节点，同时使用敌人 HP / 敌人伤害满倍率、奖励候选从 4 降到 3、高压路线 `-6 HP + 污染`。

专家一致判断：D3 作为“中级入口”成立，但 first-clear 曲线过陡。它现在更像断崖，而不是 D2 后的第一段中级压力。

## 2. 本轮目标

本轮只修 D3 first-clear 的最小切片，让保守玩家能自然通关，但结算 HP 明显低于 D1 / D2。

期望体验：

- D3 仍然是中级入口，保留 6 节点带来的长局压力。
- 玩家需要更谨慎选择路线和奖励，不能像 D1 / D2 一样宽松通关。
- 保守路线、合理出牌、正常奖励选择下，应能自然 first-clear。
- 通关时 HP 应明显低于 D1 / D2，体现 D3 已进入中级压力带。

## 3. 非目标

本轮明确不做：

- 不扩 D4-D10。
- 不加永久进度、永久属性、永久牌组或账号 meta 成长。
- 不改活动层 / run 层边界。
- 不批量调整路线节点结构。
- 不重做战斗核心、敌人库、奖励库或 HUD。
- 不把 D3 调成新手难度；D3 仍应比 D2 明显更紧。

## 4. 允许调整范围

优先只改 `ActivityLevelDefinition` 里的 D3 数值，不新增 runtime 特例，不改框架 API。

当前 D3：

| 字段 | 当前值 |
| --- | ---: |
| `nodeCount` | 6 |
| `playerMaxHp` | 60 |
| `enemyHpMultiplier` | 1.0 |
| `enemyDamageMultiplier` | 1.0 |
| `rewardPickCount` | 3 |
| `eliteRouteEntryDamage` | 6 |
| `eliteRouteAddsPollution` | true |

审核后的第一版只允许调整以下三个字段：

| 字段 | 第一版值 | 作用 |
| --- | ---: | --- |
| `enemyDamageMultiplier` | `1.0 -> 0.85` | 降低 6 节点累计失血，是最直接的 first-clear 缓冲 |
| `eliteRouteEntryDamage` | `6 -> 4` | 降低高压路线一次性断崖损失 |
| `eliteRouteAddsPollution` | `true -> false` | 移除 D3 first-clear 的复合惩罚，保留 HP 代价 |

第一版必须保留以下字段不变：

| 字段 | 保留值 | 理由 |
| --- | ---: | --- |
| `nodeCount` | 6 | D3 仍要表达从 3 节点进入 6 节点长局。 |
| `playerMaxHp` | 60 | D3 不回到 D1 / D2 的生命容错。 |
| `enemyHpMultiplier` | 1.0 | 第一版先保留中级入口的敌人厚度。 |
| `rewardPickCount` | 3 | 保留 D2 -> D3 的奖励选择收紧。 |

第一版实现组合：

```ts
enemyDamageMultiplier: 0.85
eliteRouteEntryDamage: 4
eliteRouteAddsPollution: false
```

第一版验证结果：

- D3 高压路线规则可以变绿。
- D1 -> D2 -> D3 自然通关仍失败，失败点仍是 `failure != victory`。

第二版允许在第一版基础上新增唯一字段：

| 字段 | 第二版值 | 作用 |
| --- | ---: | --- |
| `enemyHpMultiplier` | `1.0 -> 0.88` | 降低 D3 6 节点的战斗时长和击杀压力。 |

第二版最终允许组合：

```ts
enemyHpMultiplier: 0.88
enemyDamageMultiplier: 0.85
eliteRouteEntryDamage: 4
eliteRouteAddsPollution: false
```

第二版仍必须保留：

- `nodeCount: 6`
- `playerMaxHp: 60`
- `rewardPickCount: 3`

权衡说明：

- 保留 `nodeCount: 6`，因为 D3 的核心身份来自“从 3 节点进入 6 节点长局”。
- 保留 `enemyHpMultiplier: 1.0`，让击杀节奏和中级入口的敌人厚度仍然成立。
- 优先降低敌伤和高压路线复合惩罚，因为当前失败更可能来自 6 节点累计失血叠加路线入场惩罚。
- `rewardPickCount: 4` 不是第二版批准项；当前先降低 D3 战斗时长，不把奖励选择宽度退回 D1 / D2。
- `eliteRouteAddsPollution: false` 的意义是避免 D3 first-clear 同时承受 HP 断崖和污染压力。污染可以留给 D4+ 或 D3 后续复测再引入。

## 5. 测试门禁

生产实现前必须新增 D3 自然通关回归，覆盖：

- 从 D1 / D2 通关推进到 D3 后，D3 使用调整后的 `ActivityLevelDefinition`。
- D3 保守路线、正常奖励选择、正常战斗策略下可以自然通关。
- D3 通关时剩余 HP 明显低于 D1 / D2 的自然通关回归结果。
- D3 仍为 6 节点，不因 first-clear 调整退回 3 节点。
- D3 高压路线入场惩罚使用调整后的 HP / 污染规则。

验收命令：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test:sim -- redline-activity-difficulty.test.ts
npm run check
```

如实现新增了独立 D3 回归文件，则同时运行该文件对应的 `npm run test:sim -- <test-file>`。

## 6. 审核要求

本 spec 已经过框架程序专家两轮审核，结论均为 `approve-with-changes`。生产实现只能进入第 4 节的第二版允许范围。

审核重点：

- D3 调整是否仍只属于 `ActivityLevelDefinition` 数值层，不破坏活动层 / run 层边界。
- 是否严格保持第二版允许范围，不提前采用 `rewardPickCount: 4`、`nodeCount: 4`、`nodeCount: 5` 或回滚第一版路线惩罚等未审核方案。
- D3 first-clear 是否保留“中级入口”身份，而不是被调回 D2 强度。
- 新增自然通关回归是否足以防止 D3 再次变成断崖。
