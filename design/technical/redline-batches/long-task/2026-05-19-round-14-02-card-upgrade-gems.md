# 2026-05-19 第14轮-02：局内牌强化 / 宝石化系统设计实现记录

工作目录：`/Users/roc/Game-001`  
角色：局内牌强化 / 宝石化系统设计实现专家  
范围：优先数据结构与纯 sim；不碰 UI CSS；不回滚其他 agent 改动。  
实现状态：已落最小代码切片与聚焦测试。

## 0. 裁决

本轮不启动完整 `CardInstanceId` 迁移，也不做宝石 UI、商店、局外成长、遗物或营地。第 14 轮-02 只落一个可被 sim 观察的最小切片：

```text
CardDefinition.runUpgrade
+ WorldState.cardUpgrades
+ buildCardUpgradeChoices / applyCardUpgradeChoice
+ level 与红槽宝石改变本次冒险内的卡牌基础伤害
+ restart-run 清空局内强化
```

这样能先补上竞品感里的“本局把一张牌变强”的反馈，但不把当前 `CardId[]` 牌区强行升级成完整实例系统。

## 1. 竞品相似度映射

| 竞品感缺口 | 本轮最小替代 | 当前边界 |
| --- | --- | --- |
| 单次冒险内把常用牌养强 | `raise-level` 给目标牌基础伤害 +2 | 先按 `cardId` 生效，同名牌共享；后续同名不同强化再迁移实例。 |
| 宝石 / 附魔 / socket 感 | `add-gem-slot` 后 `socket-gem`，红槽 `crimson_chip` +3 伤害 | 只实现红色伤害宝石，不做多色生态和 UI。 |
| 升级选择 | `buildCardUpgradeChoices(world, cardId, traceId)` 生成可测试 choices | 尚未接入奖励面板 intent；先给 sim/QA 可调用合同。 |
| 局内成长而非局外成长 | `WorldState.cardUpgrades` 挂在 world，`restart-run` 走 `createInitialWorld` 清空 | 不写入账号/profile/meta。 |

## 2. 数据合同

新增类型：

- `CardGemColor = 'red' | 'blue' | 'gold'`
- `CardGemId = 'crimson_chip' | 'tempo_lens' | 'ledger_seal'`
- `CardUpgradeChoiceType = 'raise-level' | 'add-gem-slot' | 'socket-gem'`
- `CardEnhancement`
- `CardUpgradeChoice`
- `CardUpgradeState`

`WorldState` 新增：

```ts
cardUpgrades: {
  enhancements: Partial<Record<CardId, CardEnhancement>>;
  choices: CardUpgradeChoice[];
  pending: boolean;
  history: CardUpgradeHistoryEntry[];
}
```

`CardDefinition` 新增可选配置：

```ts
runUpgrade?: {
  maxLevel: number;
  damagePerLevel: number;
  maxGemSlots: number;
  allowedGemColors: CardGemColor[];
}
```

当前在 `debt_hook` 与 `redline_cut` 上显式标注了升级配置；未标注的伤害牌走默认值，状态牌和无伤害牌不会生成升级选项。

## 3. 运行时行为

新增纯 sim helper：

- `createInitialCardUpgradeState()`
- `buildCardUpgradeChoices(world, targetCardId, traceId)`
- `applyCardUpgradeChoice(world, choiceId, traceId)`
- `getCardDamageBonus(cardUpgradeState, cardId)`
- `getCardModifiedDamage(world, cardId)`

当前选择规则：

1. 目标牌必须存在、在当前 deck 中、且是有伤害的非 status 牌。
2. 未满级时提供 `raise-level`。
3. 未达到宝石槽上限时提供 `add-gem-slot`。
4. 存在空红槽时提供 `socket-gem / crimson_chip`。

伤害结算：

```text
modifiedBaseDamage = card.damage + level * damagePerLevel + socketedGemDamage
finalDamage = modifiedBaseDamage * effectMultiplier
```

也就是说，强化仍服务已有 `0 -> 1 -> 2` 和倍率链路，不新开一套独立伤害通道。

## 4. 事件与 QA 可观察面

新增事件：

- `CardUpgradeChoicesGenerated`
- `CardUpgradeApplied`

`CardUpgradeApplied` 记录：

- `cardId`
- `choiceId`
- `choiceType`
- `level`
- `gemSlots`
- `damageBonus`

这让 QA 能判断“为什么这张牌这次打得更痛”，不用从数组差异或 UI 文案猜。

## 5. 暂不做

- 不做完整 `CardInstanceId` 迁移。
- 不做同名牌一张升级、一张未升级。
- 不接 UI CSS，不新增宝石面板。
- 不做蓝 / 金宝石实际效果。
- 不做 socket 移除、替换、合成、稀有度、随机词缀。
- 不把强化写成永久成长或跨 run 解锁。
- 不改变 `maxEnergy`、授权支付、Wild MP3、paper topdeck、生命周期区规则。

## 6. 验收

新增聚焦测试：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run src/tests/sim/card-upgrade-gems.test.ts
```

测试覆盖：

1. `debt_hook` 生成升级 / 开槽 / 镶嵌选择。
2. `raise-level + add-gem-slot + crimson_chip` 后，`debt_hook` 伤害从 4 变成 9。
3. `CardUpgradeApplied` 可观察到 `socket-gem`。
4. `restart-run` 后 `cardUpgrades` 清空，不跨局保留。

## 7. 后续建议

下一刀如果继续做，应优先把 `buildCardUpgradeChoices` 接入 reward 层的可选奖励类型，而不是先做 UI 面板。真正需要同名不同强化时，再按既有文档迁移 `CardInstanceId`，不要在当前 `CardId[]` 层硬拧出复杂实例语义。

STATUS: DONE
