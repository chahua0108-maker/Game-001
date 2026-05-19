# 2026-05-19 第 12 轮汇总：3-5 回合竞品相似度复测

## 0. 本轮裁决

第 12 轮继续执行“越像竞品越成功”的标准，但不直接把牌区生命周期 v1 写进核心 runtime。

本轮实际裁决：

```text
P0：先落 3-5 回合竞品相似度复测脚本。
P1：把牌区生命周期 v1 的边界写清楚，作为第 13 轮代码入口。
P2：局内强化、宝石、地牢路线和局外成长继续排队，不抢本轮。
```

理由：

- 第 11 轮已经补了 Wild MP3 延链，下一步需要证明它在连续回合体验里成立。
- 生命周期 v1 会触碰抽、弃、洗、消耗、保留、状态牌和 HUD 读数，不适合在没有 journey 验收前硬改。
- 用户的目标是更像竞品，而不是工程系统越多越好；所以先把“玩家能否在 3-5 回合看到像竞品的节奏”自动化。

## 1. 第 12 轮专家结果

| 专家 | 角色 | 产物 | 关键结论 |
| --- | --- | --- | --- |
| 01 | 竞品相似度 PM | `2026-05-19-round-12-01-similarity-pm.md` | 本轮 P0 是 journey 验收，不是继续堆系统。 |
| 02 | 玩家体验复测导演 | `2026-05-19-round-12-02-journey-playtest-director.md` | 3-5 回合脚本必须覆盖成功链、坏手修补、奖励响应和失败压力。 |
| 03 | 牌区生命周期架构 | `2026-05-19-round-12-03-card-lifecycle-architecture.md` | 生命周期 v1 是第 13 轮底座，不应抢第 12 轮主线。 |
| 04 | 运行时合同审查 | `2026-05-19-round-12-04-runtime-contract-audit.md` | 不能破坏授权、Wild 延链、奖励和 run state 的现有合同。 |
| 05 | HUD 可读性 | `2026-05-19-round-12-05-hud-journey-readability.md` | 移动端仍以短 token 为硬边界，禁止长句塞进卡牌按钮。 |
| 06 | QA 自动化架构 | `2026-05-19-round-12-06-qa-similarity-automation.md` | `qa:similarity` 应成为第 12 轮核心交付。 |
| 07 | 节奏平衡 | `2026-05-19-round-12-07-cadence-balance.md` | 不调永久资源，不做脚本必胜；用承压镜头证明失败不是 UI 错误。 |
| 08 | sim 测试实现 | `src/tests/sim/redline-similarity-journey.test.ts` | 已新增确定性 journey 测试。 |
| 09 | 浏览器 QA 实现 | `scripts/qa-similarity.mjs` | 已新增浏览器 journey QA；主线程补了脚本入口和报告落盘。 |
| 10 | 制作人综合 | `2026-05-19-round-12-10-producer-synthesis.md` | 如果只能做一件，优先复测脚本；生命周期进入下一轮。 |

## 2. 已落地代码

### 2.1 sim journey 测试

新增：

- `prototype-web/src/tests/sim/redline-similarity-journey.test.ts`

覆盖：

- 第 1 段：玩家不处理敌方意图直接结束回合，HP 从 60 掉到 43，证明压力真实存在。
- 第 2 段：确定性手牌完成 `0 -> 1 -> 2`，触发本回合 payoff-only 授权。
- 第 3 段：`wild_gap_key` 以 printed cost 1 支付，但按 effective MP3 延链，产生 `ChainExtended`。
- 第 4 段：`severance_burst` 用授权支付并以 x5 续燃，`PayoffResolved` 把意图伤害清到 0。
- 第 5 段：奖励选择 `wild_gap_key` 后进入下一轮，奖励卡进入后续循环，并可作为 MP1 修补牌参与下一段链。

### 2.2 浏览器相似度 QA

新增/修改：

- `prototype-web/scripts/qa-similarity.mjs`
- `prototype-web/package.json`

`qa:similarity` 覆盖：

- 三档视口：desktop、390、360。
- 3 回合压力样片：连续结束回合会从 60 HP 掉到 9 HP，但不直接结束 run。
- Wild MP3 延链样片：`ChainExtended.extendedCost=3`、倍率 x4。
- payoff 续燃样片：`severance_burst` 以 x5 触发，使用授权支付。
- `paper_shatter` 顶终结样片：仍可见 `整备：顶终结`。
- UI 硬约束：无 console error、无横向溢出、无文字超框。
- cleanup：关闭 page/context/browser/server，并检查端口无残留。

输出文件：

- `prototype-web/outputs/browser-qa/round-12/qa-similarity-result.json`

说明：`qa:similarity` 的报告默认放在 `prototype-web/outputs` 下，原因是当前沙箱下 `npm run` 写仓库根 `outputs/` 会触发 EPERM；实际浏览器验收在提升权限下通过，且 cleanup 正常。

## 3. 验收结果

已运行：

```bash
cd /Users/roc/Game-001/prototype-web
node --check scripts/qa-similarity.mjs
npm test -- --run src/tests/sim/redline-similarity-journey.test.ts src/tests/sim/redline-competitor-similarity.test.ts
npm run check
npm run qa:similarity
npm run qa:ui
```

结果：

- `node --check scripts/qa-similarity.mjs`：通过。
- targeted sim：2 个测试文件、6 个测试通过。
- `npm run check`：16 个测试文件通过，1 个 skipped；127 个测试通过，2 个 skipped；build 通过。
- `npm run qa:similarity`：三档视口全部 pass。
- `npm run qa:ui`：三档视口全部 pass。
- Vite 仍提示主 JS chunk 大于 500KB，这是已有体积警告，不阻塞本轮。

`qa:similarity` 关键证据：

- desktop / mobile-390 / mobile-360 全部 `status=pass`。
- `failurePressureVisible=true`，HP 从 60 降到 9。
- `wildMp3Extension=true`。
- `payoffContinuationResolved=true`。
- `paperTopdeckSample=true`。
- `noHorizontalOverflow=true`。
- `noTextOverflow=true`。
- `noConsoleErrors=true`。
- cleanup `status=pass`，`pidAlive=false`，`portListening=false`。

`qa:ui` 关键证据：

- desktop / mobile-390 / mobile-360 均 `consoleErrorCount=0`。
- `horizontalOverflowDetected=false`。
- `textOverflowCount=0`。
- `wildScenarioReached=true`。
- `extensionTokenVisible=true`。
- `continuationTokenVisible=true`。
- cleanup `status=pass`，`pidAlive=false`，`portListening=false`。

## 4. 当前相似度评分

第 11 轮评分为 7 / 14。第 12 轮没有新增大机制，但新增了连续体验验收，因此评分调整如下：

| 项 | 第 11 轮 | 第 12 轮 | 依据 |
| --- | ---: | ---: | --- |
| 升序连锁 | 2 | 2 | sim journey 继续覆盖 0>1>2。 |
| Wild 延长 stack | 2 | 2 | sim 与浏览器 QA 都覆盖 MP3 延链。 |
| 快速出牌压力 | 1 | 2 | `qa:similarity` 证明 3 回合承压、End Turn 可用、HP 明确下降。 |
| XP/升级拿卡 | 1 | 1 | sim journey 覆盖奖励进入后续循环，但浏览器仍未覆盖完整奖励选择。 |
| 局内强化/宝石感 | 0 | 0 | 未做。 |
| 地牢/run 推进 | 1 | 1 | run node 存在，但还不是玩家可选路线。 |
| 局外成长目标 | 0 | 0 | 未做。 |

当前总分：8 / 14。

结论：第 12 轮把“像竞品的连续体验是否成立”从主观描述推进到了自动验收，但仍不能宣称完整复刻。下一轮应正式进入牌区生命周期 v1。

## 5. 第 13 轮建议

第 13 轮建议主题：**牌区生命周期 v1**。

P0 范围：

- 增加最小 `exhaustPile` 或等价事件化消耗区。
- 只做 1 张消耗牌、1 张保留牌、1 张状态/污染牌。
- 增加弃牌原因、洗回事件、牌区移动事件。
- HUD 只显示短 token：`消耗`、`保留`、`状态`、`洗回N`。
- 必须保留第 12 轮 `qa:similarity` 和第 11 轮 `qa:ui`。

不做：

- 不做完整宝石/插槽。
- 不做永久 Max MP。
- 不做局外成长。
- 不做大卡池。
- 不复制竞品卡名、文案、美术或 UI 构图。

