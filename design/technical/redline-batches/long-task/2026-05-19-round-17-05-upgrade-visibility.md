# 2026-05-19 第17轮-05：局内升级可见性工程师

工作目录：`/Users/roc/Game-001`  
角色：局内升级可见性工程师  
负责范围：`prototype-web/src/sim/cardUpgrades.ts`、`prototype-web/src/tests/sim/card-upgrade-gems.test.ts`；不改 HUD/runtime。

## 1. 目标

本轮只增强升级选择自身的可解释字段，让后续 build plan 能直接回答：

- 为什么强化这张牌；
- 这次选择会让当前 run 内的伤害或后续 socket 计划发生什么变化；
- 这是本局成长，不是永久成长。

## 2. 合同变化

`CardUpgradeChoice` 的原有 reward 合同保持不变：

- `id`
- `type`
- `targetCardId`
- `label`
- `description`
- `gemColor`
- `gemId`
- `damageBonusPreview`

新增可见性字段随 choice 一起发布到 `world.cardUpgrades.choices` 与 `CardUpgradeChoicesGenerated` 的 `choices` 快照中：

| 字段 | 用途 |
| --- | --- |
| `preview` | 短预览，给 build plan 或奖励列表说明数值变化。 |
| `reason` | 机器/调试可读理由，说明为什么这张牌适合被强化。 |
| `buildPlanReason` | 玩家计划层理由，说明这次选择在本局构筑中的角色。 |

这三个字段是向后兼容扩展：不改变 reward id 编码，不改变 `select-reward` / `applyCardUpgradeChoice` 流程，不新增 HUD/runtime 接入。

## 3. 当前选择文案

| 类型 | preview | reason 方向 |
| --- | --- | --- |
| `raise-level` | `当前伤害 -> 升级后伤害 damage this run` | 牌已在 deck 中，拿到可重复的本局伤害增益。 |
| `add-gem-slot` | `opens red gem slot; damage unchanged until socketed` | 先为目标牌准备红槽，不立即增加伤害。 |
| `socket-gem` | `当前伤害 -> 镶嵌后伤害 damage this run` | 空红槽可用，镶嵌 `crimson_chip` 获得本局伤害增益。 |

## 4. 验收覆盖

`prototype-web/src/tests/sim/card-upgrade-gems.test.ts` 新增断言：

1. reward 生成的 pending upgrade choice 带 `preview/reason/buildPlanReason`。
2. 直接调用 `buildCardUpgradeChoices` 时，`raise-level` 与 `add-gem-slot` 都带可解释字段。
3. 已开槽后生成的 `socket-gem` 带可解释字段，并继续按原有伤害合同生效。

## 5. 验证

已执行：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run src/tests/sim/card-upgrade-gems.test.ts
```

结果：通过，`3 tests`。

额外执行：

```bash
cd /Users/roc/Game-001/prototype-web
npm run build
```

结果：未通过；`tsc` 阶段被本轮范围外的 UI 导出错误阻塞：

```text
src/tests/ui/hud-target-selection.test.ts(16,3): error TS2305: Module '"../../ui/hud"' has no exported member 'hudBuildPlanState'.
```

本轮不修改 HUD/runtime，因此没有在本轮处理该 UI 导出问题。

## 6. 边界

- 不改 HUD/runtime。
- 不改变 reward pick 数、reward id 编码、升级应用时机。
- 不把 `cardUpgrades` 写入账号、profile 或局外成长。
- 不解决同名牌不同强化；当前仍沿用按 `CardId` 生效的最小切片。

STATUS: DONE
