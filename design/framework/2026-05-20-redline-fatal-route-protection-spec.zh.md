# Redline 致死路线保护 Spec

日期：2026-05-20

状态：框架程序专家已 approve；本轮只定义低血致死路线保护，不进入完整路线系统。

## 1. 背景

第 4 轮已经让 route HUD 能区分安全 / 推荐路线与高风险 / 贪心路线，并明确展示 `elite-pressure` 的入场 HP 伤害。玩家视角复核指出：当玩家当前 HP 小于或等于 `elite-pressure` 的 `entryDamage` 时，点击高压路线会立即扣血并可能直接进入 Settlement 失败。

这类失败不能只靠文案解决。玩家可以理解“高风险”，但不应该因为一次误点把 run 立即送入失败结算。本轮因此只补一层“致死路线保护”，不扩大路线系统。

## 2. 本轮目标

当高压路线的入场伤害会立即致死时，玩家不能误点导致直接失败。

必须达成：

- 如果当前 HP `<= elite-pressure.entryDamage`，该高压路线不应通过一次普通点击发出有效选择。
- HUD 必须给出明确原因，例如：`HP不足，选择会阵亡`。
- 非致死高压路线仍可选择；玩家在 HP 足够时仍能主动承担高风险 / 贪心路线。
- `repair-cache` 等非致死路线仍保持现有交互，不被本保护误伤。

## 3. 非目标

本轮明确不做：

- 不新增 route kind。
- 不改路线生成。
- 不改 activity API。
- 不改 run API。
- 不扩 D4-D10。
- 不改实际路线收益 / 惩罚。
- 不做完整路线图系统、二级确认系统、节点预览树或长期路线规划。
- 不改变 `elite-pressure` 的入场伤害数值，也不改变它在非致死情况下的选择语义。

## 4. 推荐实现

优先只在 HUD 交互层处理致死保护。

推荐方式：

- 在 route button 渲染时判断当前 HP 与该路线 `entryDamage`。
- 如果 route 为 `elite-pressure` 且 `currentHp <= entryDamage`：
  - 禁用该按钮；或
  - 保持按钮可聚焦但阻止 emit `select-route` intent。
- 同时在按钮或邻近 warning 区显示：`HP不足，选择会阵亡`。
- 保留原有风险 / 贪心 / 入场伤害展示，避免玩家只看到禁用态却不知道原因。

不推荐在本轮直接修改 runtime selection semantics。HUD 层可以阻止误点和误触；runtime 层的 route selection 语义应保持不变。

如果框架专家判断必须增加 runtime guard，例如为了防止脚本、测试夹具或未来非 HUD 调用绕过保护，需要单独提出审核项，明确 guard 属于 sim/runtime 行为变更，并补相应 sim 测试。

## 5. 测试门禁

本轮必须有 UI test 覆盖交互保护，而不是只断言文案存在。

测试至少断言：

- 致死 `elite-pressure` 不 emit `select-route`。
- 非致死 `elite-pressure` 仍 emit `select-route`。
- `repair-cache` 仍 emit `select-route`。
- 致死高压按钮或 warning 显示 `HP不足，选择会阵亡`。

建议验收命令：

```bash
cd /Users/roc/Game-001/prototype-web
npm run qa:ui
npm run check
```

如项目已有更窄的 HUD / route UI 测试入口，应优先运行对应测试文件，并在实现记录中写明。

## 6. 审核点

框架审核重点：

- 是否只改 HUD interaction，没有改 route kind、路线生成、activity/run API 或实际路线收益 / 惩罚。
- 致死保护是否只拦截 `currentHp <= elite-pressure.entryDamage` 的立即阵亡场景。
- 非致死 `elite-pressure` 是否仍能选择，保留高风险路线张力。
- `repair-cache` 是否不受影响，仍能正常 emit。
- 是否需要 sim runtime guard；如果需要，是否已作为单独审核项处理，而不是混在本轮 HUD 改动中直接落地。

## 7. 本轮交付边界

本轮交付应是一个很小的保护切片：

- 一个 HUD 层致死高压路线保护。
- 一个明确的低血不可选原因。
- 一组 UI test 证明致死 elite 不 emit、非致死 elite 仍 emit、repair-cache 仍 emit。

不以“路线系统完成”作为验收标准。
