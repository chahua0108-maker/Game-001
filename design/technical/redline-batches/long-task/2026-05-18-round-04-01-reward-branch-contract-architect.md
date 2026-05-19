# 2026-05-18 Round 04-01 奖励分支合同架构审查

角色：第 4 轮专家 01，奖励分支合同架构师  
工作目录：`/Users/roc/Game-001`  
范围：只读审查 `prototype-web/src/sim/rewardChoices.ts`、`prototype-web/src/sim/types.ts`、`prototype-web/src/data/cards.ts`；本文不修改源码、不提交 git。  
备注：任务中提到的 `prototype-web/src/sim/data/cards.ts` 在当前工作树不存在，实际卡牌数据路径是 `prototype-web/src/data/cards.ts`。

## 0. 结论

当前奖励三选一的结构方向是对的：`buildRewardChoices` 会按 `repair-resource -> payoff -> route-bridge` 的优先级各找一张，然后再用剩余候选补满。

但当前合同还不是显式合同，而是“临时类型 + 多字段启发式 + fallback id 集合”的组合。这个组合在短期可跑，长期会让奖励分支跟着 `availability`、`chainRole`、`cycleRole`、`buildRole` 的策划调整发生漂移。第 4 轮如果要开放 `blood_tithe` / `pulse_draw` 或重排奖励池，必须先把 `rewardBranches` 提升到 `CardDefinition` 的一等字段。

建议本轮落地：**只落 P0 奖励分支合同，不同时开放新牌、不重排整个奖励池。**

## 1. 当前事实

### 1.1 `rewardChoices.ts`

- `RewardBranch` 目前定义在 `rewardChoices.ts` 内部：`repair-resource | payoff | route-bridge`。
- `CardWithRewardMetadata` 通过交叉类型临时声明了多个非正式字段：`rewardBranch`、`rewardBranches`、`rewardCategory`、`rewardRole`、`rewardTags`、`archetype`、`categories`、`role`、`tags`。
- `branchesFromMetadata(card)` 会先读这些非正式字段，再根据运行时卡牌字段推导分支。
- `payoff` 推导依赖 `cardType === payoff`、`chainRole === payoff`、`cycleRole === finisher`、`buildRole === payoff-finisher`。
- `repair-resource` 推导依赖 `cardType === repair/resource`、`chainRole === repair`、`cycleRole/buildRole === wild-fixer`、`utilities` 包含 `wild/mana` 或 `energyGain`。
- `route-bridge` 推导依赖 `availability !== reserve-test`，再看 `starter/bridge/expand`、`opener/connector/route-segment`、`basic-chain/reward-chain/draw-fixer`。
- `fallbackBranches(card.id)` 只有在前面的推导结果为空时才生效。

关键风险：`availability` 现在参与 `route-bridge` 推导。如果某张 reserve 测试牌只改成 `availability: reward`，它可能从原来的 fallback 分支漂移到 route 分支。

### 1.2 `types.ts`

- `CardDefinition` 目前只有卡牌机制、构筑角色和可见性字段：`cardType`、`chainRole`、`cycleRole`、`buildRole`、`availability` 等。
- `CardDefinition` 没有 `rewardBranches` 字段。
- 这导致 `rewardChoices.ts` 必须用 `CardDefinition & { rewardBranches?: ... }` 的临时交叉类型绕过正式合同。
- 结果是 TypeScript 不会要求卡牌数据显式声明奖励分支，也不会阻止策划把 `availability` / `chainRole` 改坏后分支悄悄变动。

### 1.3 `cards.ts`

- 当前实际卡牌数据在 `prototype-web/src/data/cards.ts`。
- `blood_tithe` 是 `availability: reserve-test`、`chainRole: starter`、`cycleRole: draw-fixer`、`buildRole: reserve-test`、`utilities: ['draw']`。
- `pulse_draw` 是 `availability: reserve-test`、`chainRole: bridge`、`cycleRole: draw-fixer`、`buildRole: reserve-test`、`utilities: ['draw']`。
- 两张牌现在都不在 `rewardCardPool`。
- 当前 `rewardCardPool` 包含 `wild_mana_stitch`、`severance_burst`、`wild_gap_key`、`paper_shatter`、`lantern_captain`、`red_ledger_burst`、`spark_tap`、`blood_reclaim`、`heartbeat_spark`、`verdict_mark`、`clearance_order`。
- 按现有算法，首轮三分支大概率是修补资源、payoff、路线桥接都能覆盖，但 route 槽会被卡池顺序和推导规则共同决定。

## 2. 漂移问题

### 2.1 `availability` 不应决定分支身份

`availability` 表达的是“这张牌当前能否出现在某个来源”，不是“它在奖励选择里承担什么职责”。把它用于 route 分支推导，会让“开放为 reward”这个动作同时改变分支身份。

最典型的危险序列：

1. `blood_tithe` 当前是 reserve，因此 route 推导被 `availability !== reserve-test` 拦住。
2. fallback id 集合把它归入 `repair-resource`。
3. 后续只要把 `availability` 改成 `reward`，它就会因为 `chainRole: starter` 命中 route 推导。
4. 因为 metadata 推导结果非空，fallback 不再生效。
5. 它从修补资源牌漂移成纯路线牌，测试如果只看“三选一有三类”，很可能不会立刻暴露。

### 2.2 `chainRole` / `cycleRole` 不应兼任奖励合同

`chainRole`、`cycleRole`、`buildRole` 是机制轴：描述牌如何参与 0 -> 1 -> 2、抽牌、修补、终结。奖励三选一的分支是产品体验轴：玩家这次选择是在解决“修补资源、终结收益、路线密度”哪一种问题。

同一张牌可以同时属于机制轴的 bridge 和奖励轴的 repair-resource。例如 `pulse_draw` 作为 1 费接链抽牌，机制上像 bridge，但奖励选择上更像“坏手修补 / 找 2 费或 payoff”。让机制字段直接推导奖励字段，会压扁这种双职责表达。

### 2.3 alias 字段会扩大污染面

当前读取 `archetype/categories/role/tags` 等泛字段，短期兼容性高，但长期会让美术、UI、卡牌标签、构筑分类都可能意外影响奖励三分支。奖励分支应该是窄合同，不应该从宽泛标签里猜。

## 3. 最小类型变更方案

### 3.1 P0 类型合同

把 `RewardBranch` 移到 `types.ts`，并加入 `CardDefinition`：

```ts
export type RewardBranch = 'repair-resource' | 'payoff' | 'route-bridge';

export interface CardDefinition {
  // existing fields...
  rewardBranches?: RewardBranch[];
}
```

说明：

- 用数组而不是单值，因为 `pulse_draw` 这类牌需要表达 `repair-resource + route-bridge` 的双职责。
- 字段先设为可选，降低对所有现有卡牌的改动面。
- 但测试合同应要求 `rewardCardPool` 内的牌必须显式声明，reserve 牌可以暂时不强制。

### 3.2 P0 选择器合同

`rewardChoices.ts` 应改成从 `types.ts` 导入 `RewardBranch`：

```ts
import type { CardDefinition, CardId, RewardBranch } from './types';
```

`rewardBranchesForCard(card)` 的优先级：

1. 如果 `card.rewardBranches` 非空，直接返回这些显式分支。
2. 如果没有显式分支，才走当前启发式推导，作为过渡兼容。
3. fallback id 集合只保留为迁移期防护，不再作为新增卡牌的主合同。

不建议继续把 `rewardCategory/rewardRole/rewardTags/archetype/categories/role/tags` 作为正式输入。迁移期可以暂留，但应标记为 legacy，并用测试保证 `rewardCardPool` 不依赖这些 alias 字段。

### 3.3 P0 数据标注范围

本轮如果允许改源码，最小数据变更只需要覆盖当前 `rewardCardPool` 和即将讨论的 reserve 候选：

```ts
wild_mana_stitch: ['repair-resource']
wild_gap_key: ['repair-resource']
severance_burst: ['payoff']
red_ledger_burst: ['payoff']
blood_reclaim: ['route-bridge']
spark_tap: ['route-bridge']
heartbeat_spark: ['route-bridge']
verdict_mark: ['route-bridge']
clearance_order: ['route-bridge']
paper_shatter: ['route-bridge']
lantern_captain: ['route-bridge']
blood_tithe: ['repair-resource']
pulse_draw: ['repair-resource', 'route-bridge']
```

这里不要求把 `blood_tithe` / `pulse_draw` 立刻放进 `rewardCardPool`，只先锁住它们未来从 `reserve-test` 开放时的分支身份。

### 3.4 不建议的方案

- 不建议只把 `availability` 从 `reserve-test` 改成 `reward`。
- 不建议继续扩展 `BRANCH_ALIASES` 来覆盖新语义。
- 不建议只改 fallback id 集合，因为只要启发式命中，fallback 就不会执行。
- 不建议把 `rewardBranches` 做成运行时外部映射表；卡牌定义已经是单一事实来源，分支合同应该跟卡牌内容同处。

## 4. 测试合同

### 4.1 类型与数据合同

建议在 `card-taxonomy.test.ts` 或新增 `reward-branch-contract.test.ts` 增加：

- 每个 `rewardCardPool` id 都存在于 `cards`。
- 每个 `rewardCardPool` card 都有非空 `rewardBranches`。
- 每个 `rewardBranches` 值都属于 `RewardBranch` 枚举。
- `rewardCardPool` 不允许包含 `availability: reserve-test`。
- `card.rewardBranches` 去重后长度应等于原长度，避免重复分支。

### 4.2 漂移回归合同

新增针对 `blood_tithe` 和 `pulse_draw` 的显式测试：

- `blood_tithe` 即使从 `reserve-test` 克隆为 `reward`，仍命中 `repair-resource`。
- `pulse_draw` 即使从 `reserve-test` 克隆为 `reward`，仍命中 `repair-resource`，并可按设计同时命中 `route-bridge`。
- 修改 `chainRole` 不应在已有显式 `rewardBranches` 时改变 `rewardBranchesForCard` 的返回结果。
- 修改 `availability` 不应在已有显式 `rewardBranches` 时改变 `rewardBranchesForCard` 的返回结果。

### 4.3 选择器行为合同

保留并强化 `reward-branching.test.ts`：

- 给定一个乱序候选池，`buildRewardChoices` 仍按 `repair-resource -> payoff -> route-bridge` 选。
- 如果某个分支有多张候选，选择候选池中第一张属于该显式分支的牌。
- 如果某个分支缺失，选择器用剩余候选补满，但测试名称要明确这是 fallback 行为。
- 默认奖励池三选一必须覆盖三类，但不能只用宽泛集合判断；应调用 `rewardBranchesForCard(cards[id])` 校验。

### 4.4 迁移期合同

如果启发式和 fallback 暂时保留，测试要明确：

- 显式 `rewardBranches` 优先级高于所有启发式。
- 没有显式字段的旧卡仍可被启发式识别，避免一次性大迁移。
- 新增进入 `rewardCardPool` 的卡如果缺少 `rewardBranches`，测试失败。

## 5. P0 / P1 取舍

### P0：本轮应做

- 把 `RewardBranch` 提升到 `types.ts`。
- 在 `CardDefinition` 上增加可选 `rewardBranches?: RewardBranch[]`。
- 让 `rewardBranchesForCard` 优先使用显式字段。
- 给当前 `rewardCardPool` 内所有卡牌补 `rewardBranches`。
- 给 `blood_tithe` / `pulse_draw` 也补 `rewardBranches`，但不必立刻开放进奖励池。
- 加测试锁住 `availability` 和 `chainRole` 不会改变显式分支。

这是小改动，但能防止后续所有卡池、可见性、修补牌开放工作踩同一个坑。

### P1：下一批再做

- 决定是否把 `blood_tithe` / `pulse_draw` 从 `reserve-test` 开放为 `reward`。
- 重排 `rewardCardPool`，让首轮 route 槽优先出现更直观的费用段，而不是偏支援的 2 费抽牌。
- 清理 `rewardChoices.ts` 里的 alias 字段和 id fallback 集合。
- 给 UI / HUD 的奖励 reason 复用同一个 `rewardBranches` 来源。
- 决定 `pulse_draw` 的抽牌是否应吃链倍率；这是效果合同，不应混进奖励分支合同。

## 6. 是否建议本轮落地

建议落地，但只落地 P0。

理由：

- 当前分支结构已经在用，合同缺口真实存在。
- `availability` 漂移风险已经可以从 `blood_tithe` / `pulse_draw` 的现状直接推导出来，不是抽象风险。
- 类型字段和测试合同的改动面小，收益高。
- 不先落合同就开放 reserve 牌，会把“牌是否可见”和“牌属于哪个奖励分支”绑在一起，后续问题更难定位。

不建议本轮同时落地 P1 的原因：

- 开放新牌、重排卡池、修正抽牌倍率文案都会改变玩家体验，应该由另一个实现批次独立验收。
- 当前第 4 轮的最小目标应是“分支不漂移”，不是一次性解决全部奖励池节奏。

## 7. 最终裁决

`rewardBranches` 应成为 `CardDefinition` 的显式合同。  
`availability` 只决定是否可出现在奖励池，不决定奖励分支。  
`chainRole/cycleRole/buildRole` 可以作为迁移期推导，但不应长期替代奖励合同。  
本轮建议落地 P0 合同与测试，不建议同时开放 `blood_tithe` / `pulse_draw` 或重排完整奖励池。

STATUS: DONE
