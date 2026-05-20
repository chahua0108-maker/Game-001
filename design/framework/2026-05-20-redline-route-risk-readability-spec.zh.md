# Redline 路线风险可读性 Spec

日期：2026-05-20

状态：框架守门轻审核已 approve；本轮只定义路线可读性 / 误选保护，不进入路线图系统。

## 1. 背景

D1 / D2 / D3 first-clear 当前已经都能自然通关，`coreScore` 约为 `80`。下一块主要风险不再是基础数值不可通，而是玩家在路线选择阶段误读代价：

- `repair-cache` 不是即时回血，但“repair / 维修”语义容易让玩家误以为选择后会立刻恢复 HP。
- `elite-pressure` 在低血时仍可能被误选，尤其 D3 长局里一次高压路线选择可能把本来可通的 run 推向失败。
- HUD 顶部“下一战后果”目前容易只隐式呈现第一个候选，不能帮助玩家比较安全推荐路和高风险贪心路。

本轮目标是让路线选择变得可读，而不是扩展路线系统本身。

## 2. 本轮目标

玩家在路线阶段必须能清楚区分：

- 哪条是安全 / 推荐路线。
- 哪条是高风险贪心路线。
- 每条路线的明确代价、风险标签和收益预期。

必须达成的体验：

- D1 / D2 的路线学习更清楚，玩家能理解“维修缓存”不是即时回血，以及高压路线有入场代价。
- D3 不应该因为玩家误读路线文案而失败；失败应来自有意识的风险选择，而不是 HUD 表达误导。
- 顶部 route summary 应帮助比较当前候选集合，不能只暗示或展示第一个候选的后果。
- 安全推荐路和高风险贪心路在按钮文案、风险标记、代价展示上有稳定、可测试的差异。

## 3. 非目标

本轮明确不做：

- 不新增 route kind。
- 不改路线生成器结构。
- 不改活动 API 或 run API。
- 不做 D4-D10。
- 不做永久进度、永久属性、永久牌组或账号 meta 成长。
- 不做完整路线图系统、分支地图、节点预览树或长期路径规划 UI。
- 不改变路线运行时语义；已有 route 的实际效果保持不变。

## 4. 允许改动范围

优先只改 `ui/hud.ts` 的展示层：

- 路线按钮文案：
  - 显示 route 的安全性 / 推荐性 / 风险性。
  - 显示 HP cost、污染 cost、延迟收益或非即时收益。
  - 对 `repair-cache` 明确表达为“后续维修缓存 / 非即时回血”一类含义。
- 路线风险标记：
  - 安全路线：例如 `safe` / `recommended`。
  - 高风险路线：例如 `risk` / `greedy` / `elite pressure`。
  - 有代价路线：明确显示 `cost`，例如 `-4 HP`、`污染 +1`、`无即时治疗`。
- 顶部 route summary：
  - 汇总所有当前候选的安全 / 推荐 / 风险分布。
  - 显示推荐路线和高风险路线的对比。
  - 不能只隐式展示第一个候选。

必要时允许新增纯展示字段或 helper，例如：

```ts
RouteDisplayInfo {
  routeId: string
  safetyTag: 'safe' | 'recommended' | 'risk'
  costText: string
  benefitText: string
  warningText?: string
}
```

这些字段或 helper 只能从现有 route state / activity level / player HP 派生，不能改变 runtime route semantics。

## 5. 不建议做

本轮不建议直接禁用路线或加二次确认。

原因：

- 禁用路线会把“玩家学习风险”变成系统代选，削弱路线选择的核心张力。
- 二次确认容易打断节奏，且会把展示问题伪装成交互保护问题。
- D1 / D2 更需要清楚教学，而不是强阻止。

唯一例外：如果出现低血选择 `elite-pressure` 会立即致死、且 HUD 展示仍无法足够阻止误选，可以提出低血致死保护。但该保护必须先单独审核，不能混在本轮 HUD 文案调整里直接实现。

## 6. 测试门禁

实现前后都必须有 UI test 覆盖路线可读性。测试至少断言：

- route buttons 展示 `safe` / `recommended` / `risk` 中的稳定标记。
- route buttons 展示 cost，例如 HP cost、污染 cost、或“无即时治疗”这类非即时收益提示。
- `repair-cache` 不被展示成即时回血。
- `elite-pressure` 在低血或 D3 场景下显示高风险 / 贪心路线提示和明确代价。
- 顶部 route summary 基于候选集合生成，不能只隐式展示第一个候选。
- 当候选中同时存在安全路线和高风险路线时，summary 能同时反映两者差异。

建议验收命令：

```bash
cd /Users/roc/Game-001/prototype-web
npm run qa:ui
npm run check
```

如项目已有更窄的 HUD / route UI 测试入口，应优先运行对应测试文件，并在最终实现记录中写明。

## 7. 框架审核要求

如果实现只改 `ui/hud.ts` 的展示文案、风险标签、顶部 route summary，且最多新增纯展示 helper，可走轻审核。

轻审核重点：

- 是否只影响 HUD 表达。
- 是否没有新增 route kind。
- 是否没有改变 route selection runtime。
- 是否让 D1 / D2 学习更清楚，并降低 D3 误选失败概率。

如果实现修改 route selection runtime、路线生成器、活动/run API、路线禁用规则、自动改选规则或致死保护，必须走正式框架审核。

正式审核重点：

- 运行时改动是否破坏既有 route semantics。
- 是否把 HUD 可读性问题扩大成路线系统重构。
- 是否引入新的边界：活动层、run 层、战斗层、HUD 层是否仍清楚。
- 是否需要新增 sim 测试覆盖 runtime 行为，而不仅是 UI test。

## 8. 本轮交付边界

本轮交付应是一个小切片：

- 一个更清楚的 route button 表达。
- 一个能比较候选集合的顶部 route summary。
- 一组 UI test 证明 safe / recommended / risk / cost 都可见。

不以“路线图系统完成”作为验收标准。
