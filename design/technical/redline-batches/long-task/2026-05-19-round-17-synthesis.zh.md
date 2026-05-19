# 2026-05-19 第17轮汇总：Build Plan 合流

## 1. 本轮目标

第 17 轮只做一个核心切片：把奖励、路线、升级合成玩家能读懂的 build plan，让玩家知道当前是在补桥、补终结、清污染、补资源，还是强化关键牌。

官方核心体验分从 `80 / 100` 提升到 `86 / 100`。QA 只作门禁，不计分。

## 2. 已落地

- 新增 `createBuildPlan(world)`，从牌组、污染、奖励候选、路线候选和局内强化中推导当前构筑问题。
- `GameSnapshot` 增加 `buildPlan`，HUD 显示 `构筑` chip，并在窄屏下做截断和防溢出。
- 奖励生成把 build plan 合入 `RewardResponseProfile`，把缺桥、缺终结、清污染、补资源映射到奖励角色和分支倾向。
- 升级奖励增加 preview、reason、buildPlanReason，让局内强化能解释“强化哪张关键牌、为什么”。
- `qa:similarity` 增加 build plan 可见性门禁，覆盖奖励前、路线后、下一战三个阶段。
- 新增 build plan、reward ordering、升级可见性、HUD target、平衡护栏测试。

## 3. 验收结果

- 聚焦测试：`39 passed`，覆盖 build plan、reward build plan、HUD target、round 17 balance。
- `npm run check`：`185 passed / 2 skipped`，build 通过；仅保留 Vite chunk size warning。
- `QA_ROUND=round-17-main npm run qa:lifecycle`：通过，`gateScore 20 / 20`。
- `QA_ROUND=round-17-main npm run qa:similarity`：通过，`gateScore 28 / 28`，`buildPlanVisibility=pass`。
- `QA_ROUND=round-17-main npm run qa:ui`：通过，`gateScore 20 / 20`。
- 三个浏览器 QA 都完成 page/context/browser/server 清理，`pidAlive=false`、`portListening=false`。

## 4. 核心体验裁决

第 17 轮的加分来自玩家决策链变清楚：

```text
上一战问题 -> 奖励候选理由 -> 路线选择理由 -> 升级/牌组变化 -> 下一战验证
```

本轮不是单纯补 HUD 文案。build plan 已经进入 snapshot、HUD、奖励排序和升级理由，能实际影响下一次奖励候选的优先级，因此按官方口径记 `86 / 100`。

不能停止的原因：连续 3-5 节点 run 仍偏“可证明链路”，污染、失败压力、路线风险和 build plan 演变还没有形成足够厚的复玩曲线。

## 5. 下一轮缺口

第 18 轮继续向 `95 / 100` 推进，只做一个主切片：

```text
连续 3-5 节点 run 复测 + 污染/失败压力升级 + build plan 演变
```

不要在第 18 轮开启局外成长。当前最大缺口仍在单次冒险内部：玩家连续跑多个节点时，是否会因为污染、掉血、路线风险和牌组短板而被迫改变计划。
