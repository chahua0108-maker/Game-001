# 2026-05-19 第18轮-03 Build Plan 演变系统设计师 / 牌组诊断工程师

## 范围

本轮只改 build plan 派生层和对应测试，不改 runtime、types、HUD。目标是让连续 run 的计划更像玩家复盘：同一个标签要能说明“刚才选了什么、路线把计划带向哪里、下一次诊断为什么变了”。

## 实现要点

1. `createBuildPlan(world)` 仍保持纯派生，不新增状态字段。
2. `BuildPlanIssue.evidence` 现在会读取现有历史：
   - 最近一次 `run.rewardHistory`，输出最近奖励选择。
   - 最近一次 `world.route.history`，输出上次路线和奖励分支倾向。
   - 最近一次 `cardUpgrades.history`，输出最近强化目标。
3. 清污染诊断区分两类牌：
   - 真正污染负担：`cardType === 'status'` 且带 `pollution` tag。
   - 清污工具：例如 `silt_purge`，不再被误算成污染负担。
4. 清污染 priority 会演变：
   - 没有清污工具时，污染仍是高优先问题。
   - 已经拿到清污工具且只剩少量污染时，清污染降级，让未解决的补桥问题能成为下一优先级。
5. 补桥诊断在最近奖励已经补过桥牌但链仍未闭合时，会改写 reason/nextStep，提示“刚补过但还差哪一段”。

## 新增验证

新增 `prototype-web/src/tests/sim/redline-round-18-build-plan-evolution.test.ts`，覆盖两个连续 run 复盘场景：

- 选择 `clearance_order` 补上 2 费段后，首要问题从 `missing-bridge` 转为 `need-resource`，且 evidence 记录最近奖励和路线。
- 选择 `silt_purge` 后污染仍在弃牌堆，但清污染被降级，首要问题转为 `missing-bridge`，并断言污染 issue 的 priority 高于补桥 issue。

这两个测试都不只断言字符串存在，而是同时检查首要 issue、priority 相对顺序和 evidence 数组变化。

## 验证命令

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run src/tests/sim/redline-round-18-build-plan-evolution.test.ts
npm test -- --run src/tests/sim/redline-build-plan.test.ts src/tests/sim/redline-reward-build-plan.test.ts src/tests/sim/redline-round-17-balance.test.ts
```

当前结果：两组命令均通过。

补充校验：

```bash
cd /Users/roc/Game-001/prototype-web
npm run build
```

当前结果：未通过，但失败点来自并行范围内的其他 round-18 测试文件：

- `src/tests/sim/redline-round-18-balance.test.ts` 缺少 Node 类型声明，并使用当前 TS lib 不支持的 `.at()`。
- `src/tests/sim/redline-round-18-pressure-runtime.test.ts` 使用当前 TS lib 不支持的 `.at()`。

本轮写集内的 `buildPlan.ts` 和新增演变测试已移除 `.at()`，不再出现在 build 错误中。
