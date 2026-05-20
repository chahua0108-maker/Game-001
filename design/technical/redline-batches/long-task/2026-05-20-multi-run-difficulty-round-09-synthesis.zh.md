# 2026-05-20 多局难度阶梯第9轮汇总：D2 低压过渡长局

## 1. 本轮入口

第8轮 10 玩家均分 `94.5/100`，未达到 `95+`。QA 无 P0 / 阻塞型 P1。

共识问题：

- D1 简单和 D3 first-clear 已基本过关。
- 安全路线风险可读性已基本过关。
- D2 仍像 D1 的数值加强版，缺少第二局可玩记忆点。
- D1 3 节点到 D3 6 节点仍有跳变感。

## 2. 本轮目标

本轮先写 spec，不实现：

- `design/framework/2026-05-20-redline-d1-d3-core-loop-round-09-spec.zh.md`

目标是假设 D2 改为 4 节点低压过渡局，用更小范围解决 D2 身份，而不是新增 activity carryover token。

## 3. Spec 与审核

框架程序专家结论：`approve-with-changes`。

批准范围：

- D2 从 3 节点调整为 4 节点，属于 D1-D3 核心三局结构调整，不是扩 D4/D5-D10。
- 只改 `activity.ts` 的 D2 definition、`hud.ts` 的 D1-D3 展示文案、两份测试和本轮文档。
- 本轮不做 `activity carryover token`，避免牵涉 `ActivityState`、continue 边界和 reward/runtime 语义。
- 禁止改 `types.ts`、`runtime.ts`、`world.ts`、route/reward/pollution runtime、D4/D5-D10。

审核要求已落实：

- D2 自然通关断言 `HP > 35`、`HP < D1 clear HP`、后续 D3 `HP < D2 clear HP`。
- D2 精准定义断言覆盖节点数、HP、敌人 HP/伤害倍率、奖励数、elite HP 代价和污染状态。
- 范围保护继续断言没有 D5/D10、没有跨局牌组继承、没有 activity carryover 字段。

## 4. 已落地

生产改动：

- `prototype-web/src/sim/activity.ts`
  - D2 `nodeCount: 4`
  - D2 `playerMaxHp: 68`
  - D2 `enemyHpMultiplier: 0.86`
  - D2 `enemyDamageMultiplier: 0.58`
  - D2 仍是 `rewardPickCount: 4`、`eliteRouteEntryDamage: 3`、无污染。
- `prototype-web/src/ui/hud.ts`
  - D2 标题改为 `D2 低压过渡`。
  - D1 settlement 提示 `下一局进入4节点低压过渡，开始注意路线代价`。
  - D2 settlement 提示 `下一局进入6节点长局，D2 已完成路线代价练习`。

## 5. 验证

RED 证据：

- sim 测试先失败于 D2 仍是 3 节点。
- UI 测试先失败于 D2 旧标题和旧 settlement 文案。

GREEN 证据：

- `npm run test:sim -- redline-activity-difficulty.test.ts`
  - `190 passed / 2 skipped`。
- `npm run test:ui -- hud-target-selection.test.ts`
  - `34 passed`。
- `npm run check`
  - `224 passed / 2 skipped`，build 通过，仅保留既有 Vite chunk warning。
- `QA_ROUND=d1-d3-core-loop-round-09 QA_PORT=5189 npm run qa:ui`
  - `gateScore 20/20`，desktop / 390 / 360 通过，无 console error、无横向溢出、无文字溢出，清理通过。
- `QA_JOURNEY_NODES=3 npm run qa:similarity`
  - `gateScore 32/32`，reward route flow、journey gate、build plan visibility 通过，清理通过。

## 6. 第9轮复评

已派出：

- 10 名独立资深玩家评分。
- 2 名 QA 专家审查 P0/P1/P2。

玩家评分围绕 D1-D3 三局核心循环的难度递进，而不是泛化打分：

| 玩家 | 评分 | 关键判断 |
|---|---:|---|
| P01 | 96 | D1 3 节点、D2 4 节点、D3 6 节点的层次已经清晰，前两局能建立信心。 |
| P02 | 96 | D2 不再只是 D1 数值加强版，第二局开始有路线代价练习。 |
| P03 | 96 | D2 的 4 节点节奏解决了 D1 到 D3 的跳变问题。 |
| P04 | 95 | 三局循环已经达到第一套活动前段的可通关标准。 |
| P05 | 96 | D1 容易、D2 可控、D3 有压迫，符合低门槛到中级入口。 |
| P06 | 96 | D2 仍安全，但节点数和 HP 变化让玩家能感到升级。 |
| P07 | 96 | D1-D3 的学习顺序成立，D3 仍保留 first-clear 压力。 |
| P08 | 97 | 难度曲线从“能过”到“需要保守路线”的过渡最完整。 |
| P09 | 94 | 主循环已经达标，但未来如果做更强连续感，可考虑非永久 carryover。 |
| P10 | 96 | 作为第一组闯关前段，当前节奏可让普通玩家先打通再理解风险。 |

合计 `958 / 1000`，均分 `95.8 / 100`。第9轮核心体验分已超过 `95+` 目标。

QA 审查：

- QA01：无 P0 / P1。发现 P2：D2 源定义标题和 HUD 标题不一致；已用 RED 测试复现并修复为 `低压过渡`。
- QA02：无 gameplay 阻塞。提醒 `.codex/` 为未追踪本地状态，提交时必须显式 stage 本轮文件；本轮不做 broad staging。
- 最终 `npm run check` 和 `qa:ui` 已在标题修复后重跑通过。

## 7. 停止决策

按照核心体验循环规则，本轮已经满足：

- `coreScore = 95.8 >= 95`
- `npm run check` 通过。
- `qa:ui` 通过并完成清理。
- `qa:similarity` 在标题一致性修复前已通过；后续只改 D2 文案标题，并由 `test:ui`、`npm run check`、`qa:ui` 覆盖。

因此停止自动扩张，不继续加入 D4/D5-D10、跨局牌组成长或 activity carryover。下一步只适合进入真实玩家测试、小范围文案/可读性修正、bugfix 或按用户新目标另开切片。
