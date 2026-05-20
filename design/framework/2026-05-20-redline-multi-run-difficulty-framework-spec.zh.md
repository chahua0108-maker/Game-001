# Redline 多局难度阶梯基础框架 Spec

日期：2026-05-20

状态：框架程序专家已复核通过；已按本 spec 完成第 1 轮实现。

## 1. 背景

当前 Web 原型已经完成单局核心体验：战斗 -> 奖励 -> 路线 -> 下一战 -> 压力/污染/build plan 演变。第 18 轮单局核心体验评分为 `95 / 100`。

新的问题不是单局缺少压力，而是整体活动结构缺失：玩家至今未能稳定打通第一套闯关活动，前期难度曲线过硬。竞品中常见结构是新手活动先给较低门槛，初级约 3 轮怪物，中级约 6 轮，高级约 12 轮；第一套活动的第一关应该让玩家较容易升级并通关。

本 spec 将原型目标从“单局核心体验”升级为“多局核心体验”：第一套闯关活动包含 10 档难度概念，但首轮只落 D1-D3，先解决前期可通关和曲线分层。

## 2. 本阶段目标

本阶段只做基础框架，不扩内容库、不做局外永久成长、不重做战斗核心。

必须达成：

- 活动层存在：玩家能看到自己处于第一套闯关活动的 D1 / D2 / D3。
- 难度层存在：D1-D3 使用不同节点数、敌人压力、路线惩罚和奖励宽度。
- 多局推进存在：D1 胜利后进入 D2，D2 胜利后进入 D3；失败后重试当前难度。
- 新手关可通：D1 是 3 节点，压力明显低于当前默认高压路线，不应继续使用旧的 `6 HP + 污染` 入场惩罚。
- 原单局核心保留：战斗出牌、奖励、路线、build plan、污染压力仍然是核心玩法。

不做：

- 不做 D4-D10 的完整数值落地。
- 不做局外永久属性成长。
- 不做实时自动攻击压迫。
- 不复制竞品卡名、原文、美术、UI 构图。
- 不把 QA、截图、文档数量计入核心体验分。

## 3. 体验结构

### 3.1 活动层

新增一个轻量活动层，命名为“红线清算局 第一套闯关”。活动层只负责当前难度位置和已完成难度，不负责永久账号成长。

活动状态建议字段：

```ts
ActivityState {
  id: 'redline-core-activity-01'
  title: '红线清算局 第一套闯关'
  totalDifficultyTiers: 10
  playableLevelIds: ['d1', 'd2', 'd3']
  currentLevelId: 'd1' | 'd2' | 'd3'
  completedLevelIds: ActivityLevelId[]
}
```

本阶段 `ActivityState` 只随当前 prototype world/session 存活，不写入账号档案、localStorage 或永久存档。它禁止包含永久牌组、永久卡牌升级、永久玩家属性或任何账号 meta 成长字段。

### 3.2 难度定义层

每一档难度使用数据定义，而不是把数值散落在 runtime 分支里。

```ts
ActivityLevelDefinition {
  id: ActivityLevelId
  label: 'D1' | 'D2' | 'D3'
  difficultyTier: number
  band: 'beginner' | 'intermediate' | 'advanced'
  nodeCount: number
  playerMaxHp: number
  enemyHpMultiplier: number
  enemyDamageMultiplier: number
  rewardPickCount: number
  eliteRouteEntryDamage: number
  eliteRouteAddsPollution: boolean
}
```

难度应用必须经过统一函数，不允许在 `runtime.ts` 里散落倍率逻辑：

```ts
resolveActivityLevelDefinition(activity.currentLevelId)
createRunWorldForActivity(activity)
scaleEnemyForActivityLevel(enemy, levelDefinition)
```

所有敌人生成路径都必须走 `scaleEnemyForActivityLevel()`，包括初始 `createInitialWorld()` 敌人和后续 `FillEnemySlots` 补位敌人。整数规则固定为：

```ts
scaledValue = Math.max(1, Math.round(baseValue * multiplier))
```

玩家 HP、奖励候选数、节点数和路线入场惩罚也只能从当前 `ActivityLevelDefinition` 派生。

### 3.3 D1-D3 首轮数值

| 难度 | 定位 | 节点 | 玩家 HP | 敌人 HP | 敌人伤害 | 奖励候选 | 高压路线入场 | 污染 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| D1 | 新手可通关 | 3 | 72 | x0.8 | x0.45 | 4 | 2 HP | 无 |
| D2 | 初级轻压力 | 3 | 66 | x0.9 | x0.7 | 4 | 3 HP | 无 |
| D3 | 中级入口 | 6 | 60 | x1.0 | x1.0 | 3 | 6 HP | 有 |

解释：

- D1 目标是让玩家第一次完整跑通活动，不追求强压迫。
- D2 仍是 3 节点，但开始让路线选择有代价。
- D3 转为 6 节点，并接近当前第 18 轮的高压单局入口版；它不是平滑小台阶，而是“中级入口”。

## 4. 状态边界

必须保留四层边界：

- 活动层：当前难度、已完成难度。
- 当前 run 层：本局节点、奖励历史、压力记录、run 内牌组变化。
- 战斗层：敌人、HP、回合、奖励 pending、路线 pending。
- 发牌周期层：手牌、抽弃牌、授权 MP、chain。

活动动作必须拆开，不允许同一个 API 同时表达“重开当前难度”和“进入下一难度”。

- `restart-current-level`：失败后重试，或玩家主动重开；保留当前 `currentLevelId`。
- `continue-activity`：仅在 `Settlement` 且当前 run 为 `victory` 时可用；进入下一 playable 难度。
- 现有 `restart-run` 只作为非活动模式或旧测试的兼容别名，不作为活动 HUD 的主要按钮文案。

结算时机：

- run 胜利进入 `Settlement` 后，HUD 可以计算并展示 `nextLevelId`，例如“进入 D2”。
- `completedLevelIds` 的写入只发生在 `continue-activity` 创建下一 run 时，避免 Settlement 画面和下一局创建时机互相冲突。
- 无论重试或继续：当前 run 奖励牌、升级、污染、手牌区都重置；不能变成永久成长。

## 5. Runtime 接入点

建议新增 `prototype-web/src/sim/activity.ts`，集中放活动定义和活动推进函数。

需要修改的运行时边界：

- `activity.ts`
  - 新增活动定义、难度解析、敌人倍率、活动 world 创建、结算预览和活动推进函数。
- `world.ts`
  - 只接受可选 activity level config 或使用 activity helper 创建 world。
  - 根据当前 ActivityLevelDefinition 设置 `run.maxNodes`、玩家 HP、敌人倍率、奖励候选数。
  - 初始敌人和后续补位敌人都必须经过同一个敌人倍率函数。
- `runtime.ts`
  - 新增 `restart-current-level` 和 `continue-activity` 的 intent 分支。
  - `restart-run` 保持兼容，但在活动 HUD 中不再作为“进入下一难度”的动作。
  - `applyRoutePressureOnEntry` 从难度定义读取高压路线入场伤害和是否污染。
- `snapshot.ts`
  - 把 activity 和 settlement next-level preview 克隆进 snapshot，供 HUD 和 QA 读取。
- `main.ts`
  - Web 原型默认以活动模式启动，而不是裸单局模式。
- `hud.ts`
  - 在 run layer 显示活动难度，例如 `D1 试营业清算 · 节点 1/3`。
  - 在路线候选里显示代价，例如 `-2 HP / 无污染`、`-3 HP / 无污染`、`-6 HP / 污染`。
  - 结算按钮文案拆分为“重试 D1”和“进入 D2”，不能继续只显示 `Restart`。

## 6. 测试门禁

实现前必须先写 sim 测试，至少覆盖：

- 初始活动是 10 档体系中的 D1，且 playable 为 D1-D3。
- D1 是 3 节点，奖励候选为 4，玩家 HP 为 72。
- D1 选择高压路线只造成轻度伤害，不注入 `static_overload`。
- D1 胜利后 `continue-activity` 进入 D2；D2 胜利后 `continue-activity` 进入 D3。
- D3 的 `run.maxNodes` 是 6。
- 失败后 `restart-current-level` 仍停留在当前难度。
- 中途 `restart-current-level` 不推进难度。
- `restart-current-level` 和 `continue-activity` 后，当前 run 奖励牌不保留到下一局牌组。
- D1/D2/D3 的初始敌人和补位敌人都继承对应 HP/伤害倍率。
- 活动 HUD 的路线候选显示高压路线代价和是否污染。

验收命令：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test:sim -- redline-activity-difficulty.test.ts
npm run check
```

如涉及 HUD 展示，再运行：

```bash
QA_ROUND=multi-run-difficulty-d1 QA_PORT=5179 npm run qa:ui
```

## 7. 新阶段评分表

旧阶段单局核心体验仍记为 `95 / 100`，但不再代表新目标完成。

多局难度新阶段当前基线：

| 维度 | 权重 | 当前分 | D1-D3 框架完成后目标 |
| --- | ---: | ---: | ---: |
| 多局活动结构 | 20 | 0 | 12 |
| 新手通关曲线 | 20 | 4 | 14 |
| 难度分层清晰度 | 20 | 4 | 12 |
| 原单局核心保留 | 20 | 20 | 20 |
| UI 可读性 | 10 | 4 | 7 |
| 版权与边界安全 | 10 | 10 | 10 |
| **总分** | **100** | **42** | **75** |

本轮实现目标不是重新冲到 95，而是把多局基础框架从 `42 / 100` 推到约 `75 / 100`。后续再扩 D4-D10、真实玩家复测和高级难度内容。

## 8. 框架程序专家审核点

请重点审核：

- 活动层是否和 run 层边界清楚，是否会误变成永久 meta 成长。
- D1-D3 的数值是否足够表达“新手可通关 -> 初级轻压力 -> 中级入口”。
- 接入点是否过多，是否有更小的框架切入方式。
- `restart-run` 同时承担“重开”和“进入下一难度”是否需要改名或增加显式按钮。
- 是否需要先做“选择难度 UI”，还是先用胜利自动推进即可。

审核通过后，才能进入实现。
