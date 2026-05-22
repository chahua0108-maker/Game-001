# Redline D4-D10 难度曲线 Spec

日期：2026-05-20

状态：框架程序专家 `approve-with-changes`；已按审核意见补 D4 title 与 D4 终点安全门禁后进入实现。

## 1. 背景

D1-D3 多局难度框架已经落地，并经过 first-clear 调整、路线风险可读性和致死高压保护修正。当前 D1-D3 的目标不是制造硬核挑战，而是证明玩家能自然理解并通关第一段活动曲线。

用户最初目标是 10 档难度体系，竞品参考节奏为初级约 3 波、中级约 6 波、高级约 12 波。但当前代码和体验还不适合一次性把 D4-D10 全部推进 playable。框架守门要求：D4-D10 进入 playable 之前，必须先有 spec 审核。

本 spec 的目标是把 D1-D10 总曲线先定成可审查的数据方向，同时只允许 D4 作为下一轮可玩切片。D5-D10 暂时只作为 backlog 和数据计划，不进入类型、运行时或 playable 列表。

## 2. 总曲线

| 难度 | 定位 | 节点数 | 玩家 HP | 敌 HP 倍率 | 敌伤倍率 | 奖励选择 | elite 路线代价 | 污染开启 | 实现状态 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| D1 | 新手可通关 | 3 | 72 | x0.80 | x0.45 | 4 | -2 HP | 否 | 已可玩 |
| D2 | 初级轻压力 | 3 | 66 | x0.90 | x0.70 | 4 | -3 HP | 否 | 已可玩 |
| D3 | 中级入口 first-clear | 6 | 60 | x0.88 | x0.85 | 3 | -4 HP | 否 | 已可玩 |
| D4 | 中级污染首秀 | 6 | 58-60 | x0.45 | x0.25 | 3 | -5 HP | 是 | 本轮候选可玩 |
| D5 | 中级压力巩固 | 6 | 56 | x1.00 | x0.95 | 3 | -5 HP + 污染 | 是 | backlog |
| D6 | 中级末段检查 | 6 | 54 | x1.05 | x1.00 | 3 | -6 HP + 污染 | 是 | backlog |
| D7 | 高级入口预热 | 9 | 58 | x1.05 | x1.05 | 3 | -6 HP + 污染 | 是 | backlog |
| D8 | 高级路线压力 | 9 | 56 | x1.10 | x1.10 | 3 | -7 HP + 污染 | 是 | backlog |
| D9 | 高级长局准备 | 12 | 60 | x1.10 | x1.15 | 3 | -7 HP + 污染 | 是 | backlog |
| D10 | 第一套活动终局 | 12 | 58 | x1.15 | x1.20 | 3 | -8 HP + 污染 | 是 | backlog |

说明：

- D1-D3 采用当前已落地数值，尤其 D3 已从原始 `x1.0 / x1.0 / -6 HP + 污染` 调整为 first-clear 友好版本。
- D4 只比 D3 小幅上升，核心变化是重新开启污染，而不是同时大幅提高敌人厚度、敌伤和路线扣血。
- D5-D6 仍保持 6 节点，用来验证污染、奖励回应和 build plan 演变是否能承受中级压力。
- D7-D8 才开始从 6 节点转向 9 节点，不直接跳到 12 节点，避免又形成 D3 曾经出现过的断崖。
- D9-D10 才进入 12 节点高级长局。它们需要更多敌人、奖励、净化和路线数据支撑，不应在当前轮次直接实现。

## 3. 本轮实现范围

本轮只允许把 D4 加入活动难度框架的最小可玩切片：

- `ActivityLevelId` 增加 `'d4'`。
- `REDLINE_ACTIVITY_LEVELS` 增加 D4 定义。
- `playableLevelIds` 从 `['d1', 'd2', 'd3']` 扩为 `['d1', 'd2', 'd3', 'd4']`。
- `continue-activity` 在 D3 胜利后进入 D4。
- settlement / snapshot / HUD 只需要能正确显示和推进到 D4；不新增选关 UI。

D5-D10 本轮只保留在本文档表格中：

- 不加入 `ActivityLevelId`。
- 不加入 `REDLINE_ACTIVITY_LEVELS`。
- 不加入 `playableLevelIds`。
- 不允许 `continue-activity` 推进到 D5 或更高。
- 不新增任何 runtime 分支、敌人特例、奖励特例或路线特例来服务 D5-D10。

## 4. D4 推荐定位

D4 是污染首秀可玩切片，而不是高级难度入口。它的任务是让玩家第一次在活动推进中看见“高压路线会把污染带进后续节点”，并理解清污染 / 补资源 / 补桥之间的取舍。

推荐 D4 定义：

```ts
{
  id: 'd4',
  label: 'D4',
  title: '污染首秀清算',
  difficultyTier: 4,
  band: 'intermediate',
  nodeCount: 6,
  playerMaxHp: 60,
  enemyHpMultiplier: 0.45,
  enemyDamageMultiplier: 0.25,
  rewardPickCount: 3,
  eliteRouteEntryDamage: 5,
  eliteRouteAddsPollution: true
}
```

可接受调整范围：

- `playerMaxHp` 可在 `58-60` 之间由框架审核决定；建议先用 `60`，如果 D4 过宽松再降到 `58`。
- `enemyHpMultiplier` 不应高于 `0.95`，当前 first-clear 回归采用 `0.45`，让 D4 的新增压力来自污染而不是血量墙。
- `enemyDamageMultiplier` 不应高于 `0.9`，当前 first-clear 回归采用 `0.25`，避免和污染叠成复合断崖。
- `eliteRouteEntryDamage` 不应高于 `5`，D4 的 elite 路线重点是“污染首秀”，不是单次扣血惩罚。
- `rewardPickCount` 保持 `3`，不回退到 D1-D2 的 4 选。

## 5. 非目标

本轮明确不做：

- 不做 D5-D10 可玩。
- 不做永久进度、永久属性、永久牌组、永久升级或账号 meta 成长。
- 不改奖励系统，不新增奖励类型，不重写奖励回应逻辑。
- 不改路线系统，不新增路线类型，不重写 route pressure 框架。
- 不改 XP 全局阈值或任何全局 progression 规则。
- 不重做污染生命周期、状态牌系统、敌人库或 HUD 大结构。
- 不把 D4 调成 D3 复刻；D4 必须至少验证一次污染开启。

## 6. 测试门禁

生产实现前必须先补测试。最低门禁：

- `ActivityLevelId` / `REDLINE_ACTIVITY_LEVELS` / `playableLevelIds` 包含 D4，且不包含 D5-D10。
- 初始活动仍从 D1 开始，D1-D3 现有回归不退化。
- D3 胜利后 `continue-activity` 进入 D4。
- D4 的 `run.maxNodes` 为 6。
- D4 使用审核批准后的数值：`playerMaxHp`、`enemyHpMultiplier`、`enemyDamageMultiplier`、`rewardPickCount`、`eliteRouteEntryDamage`、`eliteRouteAddsPollution` 都有断言。
- D4 的初始敌人和补位敌人都继承 D4 敌 HP / 敌伤倍率。
- D4 选择 elite route 时，入场代价会造成 HP 扣减，并注入或携带污染证据。
- D4 路线展示能读出 `-5 HP / 污染`，不能沿用 D3 的无污染文案。
- D4 胜利后 `continue-activity` 没有可推进的 D5；应停在活动完成、无下一关或受当前 settlement 规则安全处理。
- D4 胜利后直接收到 `continue-activity` intent 时，不得误重开 D4 新局；如果没有 D5，应返回当前 Settlement world 或等价 no-op。

关于 D4 first-clear 的建议：

- D4 既然进入 playable，就不建议把“保守 first-clear 能通过”降级为完全非必需。否则 D1-D3 已建立的自然通关曲线会在 D4 再次断裂。
- 建议设置为合并门禁：保守路线、正常奖励选择、正常出牌策略下，至少一条确定性 D4 first-clear 回归必须通过。
- 但不要求 D4 elite route first-clear 必过。elite route 在 D4 的职责是展示污染代价，允许它让玩家明显低血或失败，只要失败原因可读且不绕过致死保护。
- 如果首版 D4 first-clear RED，只允许在 D4 数值层微调；不得通过新增奖励系统、路线系统或污染特例来救测试。

建议验收命令：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test:sim -- redline-activity-difficulty.test.ts
npm run check
```

如新增独立 D4 first-clear 回归文件，再追加：

```bash
npm run test:sim -- <d4-first-clear-test-file>
```

## 7. 数据计划

D4 实现后需要记录的最小证据：

- D1-D4 连续自然通关时，每档结算 HP。
- D4 保守路线和至少一次 elite route 的 HP 曲线差异。
- D4 elite route 是否真实带入污染，污染是否影响后续手牌或 build plan。
- D4 奖励候选是否至少一次回应污染或资源压力。
- D4 失败样本的主要原因：敌伤过高、敌人太厚、污染卡手、路线代价误读、奖励回应不足。

D5-D10 进入 playable 前，必须至少用 D4 数据回答：

- 污染开启后，玩家是否能读懂失败原因。
- 当前奖励池是否足够支撑 6 节点污染压力。
- 9 节点和 12 节点是否需要更多敌人、净化、路线或奖励内容，而不是只靠倍率拉高。

## 8. 框架审核点

请框架程序专家重点审核：

- D4 是否仍是 D3 之后的小幅上升，而不是再次制造断崖。
- D4 是否只通过 `ActivityLevelDefinition` 数据接入，不新增 runtime 特例。
- D5-D10 是否被严格限制为 spec backlog，没有进入类型、常量、运行时和 playable flow。
- D4 first-clear 门禁是否应该作为合并必需项；本 spec 建议“保守 first-clear 必过，elite first-clear 不必过”。
- D4 作为污染首秀是否足够独立，不需要同时改奖励、路线、XP 或永久进度系统。

审核通过后，才能进入 D4 生产实现。审核未通过前，任何代码实现都应保持在待办状态。
