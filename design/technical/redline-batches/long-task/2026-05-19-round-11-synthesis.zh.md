# 2026-05-19 第 11 轮汇总：竞品相似度继续迭代

## 0. 新成功标准

用户目标已经从“第 10 轮收敛成可验收 demo”升级为：

```text
越像竞品越成功；10 轮不够就继续迭代。
```

因此第 10 轮“先冻结 demo”的结论不再是终点。后续轮次以竞品相似度为主指标，但边界保持不变：复刻公开可观察的机制结构、反馈节奏、资源压力、卡组成长和战斗决策；不复制第三方受版权保护的卡名、原文描述、美术、UI 构图或素材。

本轮参考主标杆仍为 Vampire Crawlers / The Turbo Wildcard 方向的公开页面与前序竞品文档。当前 Redline 的目标不是做“像卡牌的脚本 demo”，而是逐步变成可信的卡牌 roguelike 核心循环。

## 1. 第 11 轮专家结论

| 专家 | 角色 | 关键判断 | 主线程取舍 |
| --- | --- | --- | --- |
| 01 | 竞品相似度 PM | 第 11 轮应该继续写代码，成功指标改为相似度镜头。 | 采纳。 |
| 02 | TurboTurn 升序连锁设计 | 0>1>2 不应是终点，应出现更长 stack 的爽点。 | 采纳最小延链切片。 |
| 03 | Wild stack 平衡 | 不要无限 Wild，只开放 `wild_gap_key` 在 `expectedCost === 3` 时延链。 | 完全采纳。 |
| 04 | 运行时合同工程 | MP3+ 延链不能复用 `ChainRepaired`，否则会误触返 MP。 | 完全采纳，新增 `ChainExtended`。 |
| 05 | HUD 链路 UI | 长链必须短 token 表达，移动端不允许文字超框。 | 采纳。 |
| 06 | 竞品 QA | 新增 Wild 延链真实 HUD 验收，不只看 sim 合同。 | 采纳并扩展 `qa:ui`。 |
| 07 | 卡池竞品感 | 不要继续堆新卡，先让现有卡形成稳定爆发镜头。 | 采纳。 |
| 08 | 复测导演 | 需要 3-5 回合脚本验证玩家是否感到快速升序、修补、奖励响应。 | 记录为下一轮验收脚本方向。 |
| 09 | 代码实现 | 落地 Wild MP3 延链与测试。 | 已整合并主线程复核。 |
| 10 | 制作人综合 | 下一大底座应是牌区生命周期 v1。 | 作为第 12 轮候选，不抢本轮最小目标。 |

## 2. 本轮主线程裁决

第 11 轮没有选择“完整牌区生命周期 v1”，而是先做 **Wild MP3 延链切片**。

理由：

- 用户当前强调“越像竞品越成功”，本轮最直接的差距是 Wild 不像 stack 延长器。
- 完整生命周期会碰到抽、弃、洗、保留、消耗、状态牌和 UI 多处合同，风险更大。
- Wild MP3 延链可以用现有 `0 -> 1 -> 2 -> payoff` 样片验证，不需要新增大系统。
- 该切片能直接提升核心体验里的压迫和爆发：玩家先完成升序，再用 Wild 把 stack 推到 x4，然后接终结。

本轮明确不做：

- 不做无限 Wild。
- 不让所有 Wild 都修 MP3+。
- 不把 `wild_mana_stitch` 变成 0 费 MP3+ 延链牌。
- 不把 MP3+ 延链记作 `ChainRepaired`。
- 不增加永久 Max MP 或局外属性成长。
- 不复制竞品卡名、关键词原文或 UI 版式。

## 3. 已落地机制

### 3.1 运行时

文件：

- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/sim/world.ts`

变化：

- `wild_gap_key` 在链已开始、未断链、`nextExpectedCost === 3` 时，可以用 printed cost 1 支付，但按 effective cost 3 接入费用链。
- MP3 延链事件独立为 `ChainExtended`，不复用 `ChainRepaired`。
- `CardPlayed` 新增 `chainExtended / extendedCost`，用于 HUD 与 QA 读取。
- `ChainState` 新增 `extendedThisTurn`，让 Wild MP3 后的 3 费 payoff 可以继续读作续燃，而不是立刻断链或降级。
- `wild_mana_stitch` 仍然只在 MP1/MP2 真实修补时返 MP，不参与 MP3+ 延链。
- broken chain 下不允许 Wild 延链。

### 3.2 HUD

文件：

- `prototype-web/src/ui/hud.ts`

变化：

- 新增可导出的 `hudCardChainRead`，让 UI 单测可以直接断言链路短 token。
- `wild_gap_key` 在 MP3 延链窗口显示为 `延MP3x4`。
- MP3 延链后的 payoff 显示为 `续燃x5`。
- 战斗日志新增 `延链MP3 x4` 与 `出牌 ... 延MP3` 读数。
- 继续保持移动端短 token 原则，不把完整机制句塞进卡牌按钮。

### 3.3 自动化测试

新增或扩展：

- `prototype-web/src/tests/sim/redline-competitor-similarity.test.ts`
- `prototype-web/src/tests/ui/hud-target-selection.test.ts`
- `prototype-web/scripts/qa-ui.mjs`

覆盖点：

- `wild_gap_key` 能在 `0 -> 1 -> 2` 后延到 effective MP3，支付仍按 printed cost 1。
- `wild_mana_stitch` 不能修 MP3，也不会误返 MP。
- broken chain 不能被 Wild MP3 延链修复。
- 不要求当前 MP 等于 effective cost，只验证 printed cost 支付与链路层分离。
- Wild MP3 延链后的 payoff 不退化。
- HUD 能看到 `延MP3x4`、`延链MP3`、`续燃x5`。
- 浏览器 QA 在桌面、390、360 三档视口都验证 Wild 延链样片。

## 4. 验收证据

本轮已运行：

```bash
cd /Users/roc/Game-001/prototype-web
node --check scripts/qa-ui.mjs
npm test -- --run src/tests/ui/hud-target-selection.test.ts src/tests/sim/redline-competitor-similarity.test.ts
npm run check
npm run qa:ui
```

结果：

- targeted test：22 个用例通过。
- `npm run check`：15 个测试文件通过，1 个 skipped；126 个用例通过，2 个 skipped；build 通过。
- Vite 仍提示主 JS chunk 大于 500KB，这是已有体积警告，不阻塞本轮机制验收。
- `npm run qa:ui`：`status=pass`。
- QA 输出：`outputs/browser-qa/round-11/qa-ui-result.json`。

浏览器验收清理：

- `pageClose.ok=true`
- `contextClose.ok=true`
- `browserClose.ok=true`
- `serverStop.ok=true`
- `residualCheck.pidAlive=false`
- `residualCheck.portListening=false`

三档视口均满足：

- `consoleErrorCount=0`
- `horizontalOverflowDetected=false`
- `textOverflowCount=0`
- `paperScenarioReached=true`
- `topdeckEvidenceVisible=true`
- `wildScenarioReached=true`
- `extensionTokenVisible=true`
- `continuationTokenVisible=true`
- `endTurnStillUsable=true`

另运行：

```bash
git diff --check
```

结果：无 whitespace error 输出。

## 5. 第 11 轮相似度评分

评分口径：0=缺失，1=有工程合同但玩家感知弱，2=可在玩家镜头中稳定看到。

| 项 | 当前分 | 依据 |
| --- | ---: | --- |
| 升序连锁 | 2 | 0>1>2 与倍率、授权、payoff 合同已稳定。 |
| Wild 延长 stack | 2 | 本轮新增 MP3 延链与 HUD/QA 读数。 |
| 快速出牌压力 | 1 | 有短 token 与敌意图，但仍缺真实 3-5 回合玩家复测。 |
| XP/升级拿卡 | 1 | 已有奖励进入下一手，但节奏仍偏样片。 |
| 局内强化/宝石感 | 0 | 尚无牌实例强化或 gem-like modifier。 |
| 地牢/run 推进 | 1 | 有 run node，但玩家感知仍弱。 |
| 局外成长目标 | 0 | 仍未做真实 meta loop。 |

总分：7 / 14。

结论：第 11 轮让核心战斗更像竞品，但还不能宣称完整复刻。按用户目标，必须继续迭代。

## 6. 下一轮建议

第 12 轮不应再扩 Wild。建议从下面二选一：

1. **牌区生命周期 v1**：消耗、保留、状态/污染牌、弃牌原因、洗回事件。  
   优点是最像成熟卡牌 roguelike 的底座；缺点是改动面更大。

2. **3-5 回合竞品相似度复测脚本**：把成功链、坏手修补、奖励响应、失败压力做成可重复浏览器剧本。  
   优点是直接回答“玩家是否觉得像竞品”；缺点是系统深度提升有限。

主线程建议：第 12 轮先做 **3-5 回合复测脚本 + 最小牌区生命周期调研**，第 13 轮再正式写生命周期代码。这样可以避免再次在没有玩家镜头证据的情况下扩系统。

