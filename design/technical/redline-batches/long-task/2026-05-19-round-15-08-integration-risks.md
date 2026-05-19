# 2026-05-19 第15轮-08 系统边界 / 代码整合审查

角色：第15轮-08《系统边界 / 代码整合审查专家》  
工作目录：`/Users/roc/Game-001`  
审查范围：`run`、`reward`、`cardUpgrades`、`runtime`、`hud`  
口径：QA 不计入分数；本文只审查边界与整合风险，不评价 QA 覆盖分。  
源码处理：未改源码。未回滚他人改动。本文为本轮新增报告。

## 0. 总结裁决

第15轮的方向总体是在强化四层边界：单轮链路、单战状态、单次冒险构筑、局外成长占位。当前代码里也有多处正向护栏：

- `restart-run` 会重新创建 `WorldState`，清空奖励牌、临时授权和 `cardUpgrades`。
- `runModifiers` 明确是 `preview-only`，并写了 `not-meta-progression`、`not-turn-payoff-authorization`、`not-runtime-applied` 排除项。
- HUD 已把 `授权+N` 写成“本回合临时授权”，局外档案显示“未开放 / 不影响当前战斗”。
- 奖励加牌目前只进入当前 run 的 `player.deck` 和后续抽牌循环，不写入独立账号档案。

但第15轮最容易破坏边界的不是 QA，也不是 `runModifiers`，而是 `cardUpgrades` 与 `reward` 的接入方式：

1. `cardUpgrades` 现在是 `WorldState` 根级状态，效果由战斗伤害规则实时读取，但生成 / 应用升级没有 runtime 阶段门禁。后续一旦 UI 或奖励系统直接调用，就可能把“本次冒险成长”变成“当前战斗中任意时刻即时改数值”。
2. `reward` 仍把“击杀 XP -> 升级奖励 -> advanceRunAfterReward”混在一起，容易把单战内等级奖励误当成单次冒险节点推进。
3. HUD 的展示还没有读取 `cardUpgrades` 后的修改伤害，玩家看到的是基础伤害，实际 runtime 用的是升级后伤害；这会让“本次冒险内升级”在体验上不可见，后续很容易被误补成局外升级文案。

建议：第15轮不要再扩玩法面，先补 `cardUpgrades` 的生命周期门禁与命名；否则第16轮继续接 UI / 奖励时很容易越界。

## 1. 四层边界基线

本轮沿用第14轮-07 的四层边界：

| 层级 | 生命周期 | 当前主要锚点 | 本轮审查判断 |
| --- | --- | --- | --- |
| 单轮 / 单次发牌循环 | `DealHand` 到离开 `PlayerTurn` | `player.energy`、`tempAuthorizationMP`、`chain`、`hand/draw/discard/exhaust/retain` | 授权与链路基本守住，HUD 文案也在强调“本回合”。 |
| 单战 / 当前遭遇 | 当前敌阵、HP、回合推进 | `round`、`enemies`、`enemyIntents`、`player.hp`、`fsm` | 基本守住；但 reward 选择会立即补敌、推进 round、发下一手，容易被误读成战斗节点推进。 |
| 单次冒险 / 当前 run | 本次构筑与清算 | `run`、`player.deck`、`player.xp/level`、`reward`、`cardUpgrades` | 奖励加牌和卡牌升级应属于这里；当前实现还缺显式阶段约束。 |
| 局外成长 | 跨 run 保留 | P0 没有正式状态；HUD 仅占位 | 当前未接入，但 `WorldState.cardUpgrades` 根级命名和 HUD `LV` 文案容易被后续误扩。 |

## 2. 阻断 / 高风险项

### R15-08-P0-01：`cardUpgrades` 没有阶段门禁，容易从 run 成长外溢到当前战斗即时改数值

证据：

- `WorldState` 根级持有 `cardUpgrades`，与 `run/reward/debug` 并列：`prototype-web/src/sim/types.ts:275`、`prototype-web/src/sim/types.ts:288`、`prototype-web/src/sim/types.ts:291`。
- 初始 world 创建时直接初始化：`prototype-web/src/sim/world.ts:120`。
- `buildCardUpgradeChoices()` 只检查卡存在、可升级、在当前 deck 中，没有检查 `fsm.gameFlow`、`run.status`、reward / settlement 阶段：`prototype-web/src/sim/cardUpgrades.ts:90`、`prototype-web/src/sim/cardUpgrades.ts:94`。
- `applyCardUpgradeChoice()` 只检查 pending choice id，然后直接写 `enhancements`：`prototype-web/src/sim/cardUpgrades.ts:154`、`prototype-web/src/sim/cardUpgrades.ts:167`、`prototype-web/src/sim/cardUpgrades.ts:185`。
- 战斗伤害规则实时读取升级伤害：`prototype-web/src/eca/redlineRules.ts:34`、`prototype-web/src/eca/redlineRules.ts:65`、`prototype-web/src/eca/redlineRules.ts:122`。

风险：

- 如果后续 HUD 在 `PlayerTurn` 里提供“升级当前手牌”入口，升级会立刻影响同一场战斗、同一手牌甚至同一 tick 后续出牌。
- 这会破坏“卡牌升级属于本次冒险清算 / 构筑层”的口径，把它变成战斗内 buff。
- 因为 `cardUpgrades` 不在 `run` 下，后续也容易被误接成局外 profile 存档。

建议红线：

- `cardUpgrades` 可以继续存在于 `WorldState`，但必须写清生命周期注释：current-run only，restart clears，not account/meta。
- 新增命令 / intent 时必须只允许在 `Reward`、`Settlement` 或明确的 `RunUpgrade` 阶段生成和应用升级；禁止 `PlayerTurn`、`EnemyAttack`、`EnemyRefill` 调用。
- `buildCardUpgradeChoices()` 不应由 UI 直接任意调用，最好收进 runtime 命令流，由阶段状态统一门禁。

### R15-08-P0-02：`reward` 选择会推进 `run.currentNode`，但奖励来源是击杀 XP / level-up，单战等级奖励和冒险节点被混用了

证据：

- 击杀敌人触发 `GainXp`：`prototype-web/src/eca/redlineRules.ts:211`、`prototype-web/src/eca/redlineRules.ts:222`。
- XP 达阈值后立刻进入 `Reward`，奖励来源是 `level-up`：`prototype-web/src/sim/runtime.ts:775`、`prototype-web/src/sim/runtime.ts:777`、`prototype-web/src/sim/runtime.ts:797`。
- 选择奖励时无论它来自哪种 reward source，都会先 `recordRunReward()`，再 `advanceRunAfterReward()`：`prototype-web/src/sim/runtime.ts:1283`、`prototype-web/src/sim/runtime.ts:1284`。
- `advanceRunAfterReward()` 直接推进 `run.currentNode`，到上限则胜利：`prototype-web/src/sim/runtime.ts:571`、`prototype-web/src/sim/runtime.ts:572`、`prototype-web/src/sim/runtime.ts:577`。

风险：

- 玩家在单场战斗内击杀若干敌人拿到 level-up reward，会被 runtime 当成冒险节点推进。
- `run.currentNode` 语义会从“冒险节点”退化成“拿过几次升级奖励”，和单战内 XP 循环混在一起。
- 后续如果再接“节点奖励 / 战后奖励 / 冒险地图”，当前 `reward.source: 'level-up'` 无法区分节点清算奖励和等级奖励。

建议红线：

- 把 `RewardState.source` 扩展为至少 `level-up` 与 `node-clear`，只有 `node-clear` 或明确的 run settlement reward 才能推进 `run.currentNode`。
- `level-up` 奖励可以加牌 / 升级牌，但不应自动等价于冒险节点完成。
- 如果 P0 暂时把“每次升级奖励”临时当作节点推进，文档和字段命名应改成 `rewardPickCount` / `milestoneIndex`，不要叫 `currentNode`。

## 3. 中风险项

### R15-08-P1-01：卡牌升级实际伤害与 HUD 展示伤害不一致，容易诱发错误的成长文案补丁

证据：

- runtime 伤害用 `getCardModifiedDamage()`：`prototype-web/src/eca/redlineRules.ts:34`、`prototype-web/src/eca/redlineRules.ts:65`、`prototype-web/src/eca/redlineRules.ts:122`。
- HUD 的意图预览仍用 `card.damage * multiplier`：`prototype-web/src/ui/hud.ts:559`。
- HUD 的卡牌效果展示优先使用 `card.mobileEffect` 或基础字段，没有读取 `snapshot.cardUpgrades`：`prototype-web/src/ui/hud.ts:1041`、`prototype-web/src/ui/hud.ts:1072`。
- `GameSnapshot` 已暴露 `cardUpgrades`：`prototype-web/src/sim/snapshot.ts:42`、`prototype-web/src/sim/snapshot.ts:54`、`prototype-web/src/sim/snapshot.ts:56`。

风险：

- 本次冒险内升级已经影响战斗，但玩家看不到升级后的数字。
- 后续 worker 可能为了“看得见成长”在 HUD 上写“永久强化 / 局外档案强化”，从而破坏 run-only 边界。

建议红线：

- HUD 应显示“本次冒险 +N”或“本 run 强化”，并用 `snapshot.cardUpgrades` 计算预览伤害。
- 禁止在卡面升级处使用“永久”“档案”“账号”“局外”等词，除非未来真的接入 `MetaProgression`。

### R15-08-P1-02：`cardUpgrades` 事件直接 push 到 debug events，绕过统一 event queue

证据：

- `buildCardUpgradeChoices()` 直接 `world.debug.events.push(...)`：`prototype-web/src/sim/cardUpgrades.ts:141`、`prototype-web/src/sim/cardUpgrades.ts:143`。
- `applyCardUpgradeChoice()` 也直接 push event：`prototype-web/src/sim/cardUpgrades.ts:197`、`prototype-web/src/sim/cardUpgrades.ts:208`。
- runtime 主路径的事件一般通过 `processEventQueue()` 和 `pushEvent()` 进入 trace / rule evaluation：`prototype-web/src/sim/runtime.ts:1090`、`prototype-web/src/sim/runtime.ts:1097`。

风险：

- 升级事件不会走统一 trace limit、rule evaluation、FSM 时序。
- 后续如果有“升级后触发奖励 / HUD toast / 存档”的规则，直接 push 会绕过规则系统，造成边界审查漏判。

建议红线：

- `CardUpgradeChoicesGenerated` 和 `CardUpgradeApplied` 应由 runtime command 返回事件，进入 `processEventQueue()`。
- 如果暂时保留 helper 直接调用，只能作为 sim helper，不应作为正式 UI / runtime 入口。

### R15-08-P1-03：`runModifiers` 目前安全，但字段名已经准备了 `maxEnergyThisRun`，一旦直接接 `player.maxEnergy` 会撞上单轮 MP 边界

证据：

- `runModifiers` 定义 `maxEnergyThisRunPlusOne`，但标记为 `preview-only`：`prototype-web/src/sim/runModifiers.ts:1`、`prototype-web/src/sim/runModifiers.ts:4`、`prototype-web/src/sim/runModifiers.ts:60`、`prototype-web/src/sim/runModifiers.ts:65`。
- 排除项明确包含 `not-meta-progression`、`not-turn-payoff-authorization`、`not-runtime-applied`：`prototype-web/src/sim/runModifiers.ts:52`。
- 推导结果包含 `maxEnergyThisRun` 和 `maxEnergyDeltaThisRun`：`prototype-web/src/sim/runModifiers.ts:31`、`prototype-web/src/sim/runModifiers.ts:33`、`prototype-web/src/sim/runModifiers.ts:138`。
- 当前 `player.maxEnergy` 注释是 deal-cycle resource，不是 meta progression：`prototype-web/src/sim/types.ts:169`、`prototype-web/src/sim/types.ts:171`。

风险：

- 目前没有 runtime 应用，所以不算现有 bug。
- 但下一步如果把 `maxEnergyThisRun` 直接写进 `player.maxEnergy`，需要回答生效点：当前手牌、下一手牌、下一场战斗、还是 run start。
- 如果不回答，会再次混淆“本回合授权 +3 MP”和“本次冒险 Max MP +1”。

建议红线：

- runtime 接入前必须新增 `RunStartConfig` 或 `RunDerivedStats`，由 run modifier 派生初始 `player.maxEnergy`。
- 禁止在当前 `PlayerTurn` 中途应用 `maxEnergyThisRunPlusOne`。
- HUD 文案必须写“本次冒险 Max MP”，不要写“授权”或“永久 MP”。

## 4. 低风险 / 观察项

### R15-08-P2-01：HUD `hudAuthorizationState()` 过度兼容未来字段名，可能误读非单轮授权字段

证据：

- HUD 会从 `player.tempAuthorizationMP`、`player.authorizationMP`、`player.authorization.tempAuthorizationMP`、顶层 `tempAuthorizationMP`、顶层 `authorization.tempAuthorizationMP` 多处读取：`prototype-web/src/ui/hud.ts:81`、`prototype-web/src/ui/hud.ts:83`、`prototype-web/src/ui/hud.ts:88`。

风险：

- 当前 snapshot 只有 `player.tempAuthorizationMP`，所以没出问题。
- 未来如果 `run` 或 `meta` 上出现同名 `authorization` 字段，HUD 可能把非单轮资源显示成“本回合授权”。

建议：

- 收窄为只读 `snapshot.player.tempAuthorizationMP`。
- 如果要支持兼容旧 snapshot，必须限定字段来源，不要读顶层任意 `authorization`。

### R15-08-P2-02：HUD 的 `LV / XP` 放在状态条，缺少“本 run”标识

证据：

- 状态条显示 `LV ${snapshot.player.level}` 和 `XP ${snapshot.player.xp} / ${snapshot.reward.xpThreshold}`：`prototype-web/src/ui/hud.ts:871`、`prototype-web/src/ui/hud.ts:873`。
- 类型注释明确 `xp/level` 是 current-run progression，不是 account/profile level：`prototype-web/src/sim/types.ts:180`、`prototype-web/src/sim/types.ts:182`。

风险：

- 单看 UI，`LV` 很容易被理解成局外等级。

建议：

- 改成 `Run LV` 或 `本次 LV`。
- Reward 面板里的 `Level ${snapshot.player.level}` 也建议统一成“本次等级”。

## 5. 当前安全点

- `restart-run` 返回 `createInitialWorld(current.run.runNumber + 1)`，会清掉 `player.deck` 的奖励牌和 `cardUpgrades`：`prototype-web/src/sim/runtime.ts:1157`、`prototype-web/src/sim/runtime.ts:1158`。
- `card-upgrade-gems` 已验证升级 restart 后清空：`prototype-web/src/tests/sim/card-upgrade-gems.test.ts:72`、`prototype-web/src/tests/sim/card-upgrade-gems.test.ts:80`、`prototype-web/src/tests/sim/card-upgrade-gems.test.ts:82`。
- `run-layer-boundary` 已验证临时授权结束回合清空、奖励牌 restart 后回 baseline、外来 meta 字段不会隐式生效：`prototype-web/src/tests/sim/run-layer-boundary.test.ts:108`、`prototype-web/src/tests/sim/run-layer-boundary.test.ts:135`、`prototype-web/src/tests/sim/run-layer-boundary.test.ts:160`、`prototype-web/src/tests/sim/run-layer-boundary.test.ts:184`。
- HUD 局外档案当前只是占位，写明不影响当前战斗：`prototype-web/src/ui/hud.ts:141`、`prototype-web/src/ui/hud.ts:143`。

## 6. 建议第15轮收口顺序

1. 先定 `cardUpgrades` 生命周期：命名为 current-run card enhancement，并加阶段门禁。
2. 再拆 `reward.source`：区分 `level-up` 与 `node-clear`，不要让所有 reward 都推进 `run.currentNode`。
3. 然后修 HUD 数字读法：卡牌伤害 / 意图预览读取 `snapshot.cardUpgrades`，并标注“本次冒险”。
4. 最后再考虑 `runModifiers` runtime 接入；接入前保持 `preview-only` 是正确的。

## 7. 红线清单

- 不允许 `cardUpgrades` 在 `PlayerTurn` 任意生成 / 应用，除非玩法明确把它改成战斗内 buff，并重新命名。
- 不允许 `level-up` reward 默认推进冒险节点，除非字段名不再叫 `currentNode`。
- 不允许把 `tempAuthorizationMP`、`maxEnergyThisRun`、`player.maxEnergy` 写成同一种“MP 成长”。
- 不允许 HUD 使用“永久强化 / 局外强化 / 档案强化”描述当前 `cardUpgrades`。
- 不允许把 `runModifiers.preview-only` 的推导值静默写入 runtime。

## 8. 本轮结论

第15轮当前不是“代码已破坏边界”，而是“下一步接 UI / 奖励 / run modifier 时非常容易破坏边界”。最优先的技术债是给 `cardUpgrades` 加正式 runtime 入口和阶段门禁；最优先的设计债是拆开 level-up reward 与 run node reward。

在这两个点处理前，不建议继续扩展局外成长或卡牌强化 UI。
