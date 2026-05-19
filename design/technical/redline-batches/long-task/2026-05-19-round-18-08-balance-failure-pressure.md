# 2026-05-19 第18轮专家08：数值平衡与失败压力审查

角色：数值平衡与失败压力审查员  
写集：`prototype-web/src/tests/sim/redline-round-18-balance.test.ts`、本文  
口径：第18轮关注核心体验分，QA 只作门禁，不计入核心分。

## 1. 本轮新增测试护栏

新增 `redline-round-18-balance.test.ts`，锁住 5 个可断言合同：

1. 连续选择 `repair-cache` 安全/补给路线不会移除下一战压力，也不会给 Max MP。
2. 不解敌方意图时，第一节点内就出现 HP 扣减、`PressurePollutionAdded` 和 `clear-pollution` build plan 问题。
3. 路线候选不能把资源修补、奖励宽度、Max MP 打包成一个滚雪球方案。
4. `qa-ui / qa-similarity / qa-lifecycle` 的 `gateScore` 只能存在于 QA 脚本语境，不能进入核心体验分词汇。
5. 补给路线扩宽后的奖励仍需覆盖 `repair-resource / payoff / route-bridge`，避免安全路线把奖励答案压成单一最优。

## 2. 当前源码已经满足的部分

### 2.1 安全路线仍保留战斗压力

`repair-cache` 当前只提供：

- `modifierId = rewardRerollPlusOne`
- `rewardBranchHint = repair-resource`
- `rewardPickBonus = 1`

选择该路线后 runtime 会进入下一战并重新发牌，`enemyIntentSummary.totalDamage > 0`。测试连续两次选择 `repair-cache` 后确认：

- `run.status` 仍是 `in-progress`
- `player.maxEnergy` 仍是 `3`
- 敌方意图仍存在
- 路线历史记录保留两次选择

这说明当前“安全路线”不是免战、回血或 Max MP 路线。

### 2.2 HP / 污染压力有可见后果

在不出牌直接 End Turn 的场景里，当前 runtime 已经能在第一节点内产生：

- 敌方意图预览伤害
- `EnemyAttacked`
- HP 实际下降，且 delta 等于预览意图总伤害
- `PressurePollutionAdded`
- `static_overload` 进入玩家牌区
- `createBuildPlan` 优先提出 `clear-pollution`

这满足“3-5 节点内有可见后果”的最低合同；实际现在比 3 节点更早。

### 2.3 资源、奖励宽度、Max MP 未合包

当前两条路线分别是：

| 路线 | 资源/修补倾向 | 奖励宽度 | Max MP |
| --- | --- | --- | --- |
| `repair-cache` | 有 | +1 pick | 无 |
| `elite-pressure` | 无 | +0 | +1 current-run Max MP cap |

测试还确认把两条路线 modifier 同时喂给 `deriveRunModifierPlan` 时，最多只有 `maxEnergyDeltaThisRun = 1`、`rewardRerollDelta = 1`，且不附带 starting repair card。当前 route 层没有“三件套同时滚雪球”的单选项。

### 2.4 QA gateScore 不给核心分

本轮测试用文件扫描约束 QA 脚本：可以输出 `gateScore`，但不能出现 `coreScore / coreExperienceScore / coreExperience / 核心体验分` 这类核心分词汇。  
测试里单独构造了核心分计算示例：`previousCoreScore + routeExperienceDelta`，明确不加 `qaGateScore`。

## 3. 仍无法由当前源码完全证明的缺口

### 3.1 “只选安全路线不能无脑赢”还不是完整规则

当前 short-run 结构只有 `currentNode / maxNodes / rewardHistory / status`，路线选择本身不包含：

- 节点风险预算
- 安全路线惩罚
- 分支敌群强度差异
- 路线疲劳或重复选择惩罚
- 胜利判定所需的真实战斗完成证据

因此测试只能约束“安全路线不直接给 Max MP、不移除敌方意图、不自动胜利”。它还不能证明玩家实际连续选择安全路线会输，或一定不能靠低风险路径完成 run。

建议后续补一个 `routePressureBudget` 或等价字段，至少记录：

- 本节点路线风险等级
- 下一战敌方压力修正
- 重复选择低风险路线的奖励衰减或污染/HP 代价
- final victory 必须来自真实战斗/奖励完成，而不是手动 force reward

### 3.2 污染后果还偏“build plan 可见”，不是完整失败曲线

当前污染压力能进入牌区，并触发 `clear-pollution` 计划。但还缺少更完整的失败压力曲线：

- 污染牌在 3-5 节点 journey 中实际挤掉关键手牌的统计断言
- 连续污染导致失败或明显战损的边界
- 清污染奖励选择前后的 HP / hand quality 对比

建议后续把 `qa:similarity` 或 sim journey 的失败样片从“单次 End Turn”扩展到 3-5 节点。

### 3.3 Max MP 仍有 runtime 特例

`elite-pressure` 现在会在 runtime 里把 `player.maxEnergy` 提到 `4`，并由 round 16/17/18 测试约束重复选择不超过 4。  
这是当前可接受的 current-run 特例，但文档口径应继续避免把它描述成永久成长或 QA 加分项。

## 4. 验证命令

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run src/tests/sim/redline-round-18-balance.test.ts
```
