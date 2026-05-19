# 2026-05-19 第14轮专家01：卡牌战斗总监 / Slay-the-Spire-like 核心循环

工作目录：`/Users/roc/Game-001`  
角色：第14轮-01，卡牌战斗总监 / Slay-the-Spire-like 核心循环专家  
目标：在 100 分相似度评分体系下，把当前 demo 向 `95/100` 推进。  
范围纪律：不回滚他人改动；本轮只做 sim/data/test 小护栏，不碰 UI 样式和 QA 脚本。

## 0. 当前评分

当前验收分：`88 / 100`。

依据：

- 第13轮 scorecard 的起始点是 `57/100`，生命周期 v1 正常成功预期到 `77-85`。
- 当前代码已经有 `drawPile / hand / discardPile / exhaustPile / retainedCards`，并有 `CardMoved / CardExhausted / CardRetained / DiscardPileShuffledIntoDrawPile` 事件。
- 当前代码已经有压力污染 `PressurePollutionAdded`、状态牌物理进入抽弃循环、Wild MP3 延链、payoff 授权、奖励入当前 run 后续循环、run node 推进、run-local card upgrade/gem 切片。
- 本轮实际跑过 `npm run check`：`19 passed | 1 skipped`，`142 passed | 2 skipped`，build 通过；Vite 仅有既有 chunk size warning。

扣分原因：

| 维度 | 当前问题 | 扣分 |
| --- | --- | ---: |
| 奖励选择 | reward 仍偏固定三分支，不会真正读取上一手“缺 0/缺 1/缺 payoff/被污染/缺防压”的上下文。 | -4 |
| 单局成长 | card upgrade/gem 已有 sim 切片，但还没接到 reward/journey 选择里，玩家 3-5 回合不一定看得到。 | -3 |
| 生命周期闭环 | 状态污染现在成立，但自然注入和节点清理还比较薄；它更像压力样片，不像完整构筑问题。 | -2 |
| 浏览器 journey | `npm run check` 通过，但本轮未重跑 `qa:similarity / qa:ui`，所以不把移动端玩家镜头打满。 | -2 |
| 版权/原创表达 | 当前仍安全，但“gem”语言需要继续保持 Redline 自有包装，不能向竞品遗物/宝石表达靠拢。 | -1 |

## 1. 最大缺口

最大缺口不是“还缺某个牌区数组”，而是：

```text
奖励选择和单局成长还没有真正回应上一手的抽牌/弃牌/洗回/污染问题。
```

现在 demo 已经能做到：

```text
费用链成立 -> 抽弃洗回存在 -> 消耗/保留/状态存在 -> 压力污染存在 -> 奖励牌进入后续循环
```

但竞品核心体验更关键的是：

```text
这一手为什么坏 -> 我拿哪张奖励修这个坏点 -> 下一手真的因为这个选择变好或变险
```

当前 reward 还是“修补 / payoff / 路线”静态覆盖，缺少从实际牌区和上一回合失败原因推导出的候选权重。玩家会看到机制像，但还没完全感到“我在构筑一套能解决自己问题的牌组”。

## 2. 最该改的 3 项

### 2.1 奖励选择改为问题响应

当前：`buildRewardChoices` 按 `repair-resource -> payoff -> route-bridge` 固定优先级取候选。  
应该改成：根据上一手记录生成 `runProblemSignals`，再给三张奖励贴短标签。

最低信号：

- `missingStarter`：本回合没有打出 0 段，优先给 0 费开链或 draw fixer。
- `missingBridge`：打出 0 后没接 1，优先给 1 费桥或 Wild。
- `missingPayoff`：已授权但没有 3 MP payoff，优先给 payoff 或 topdeck。
- `pollutedHand`：抽到/洗回状态牌，优先给抽牌、净化、保留计划。
- `pressureLeak`：End Turn 扣血且未清意图，优先给一次性救场或保留 2 段。

验收重点不是 reward 更聪明，而是玩家能解释“为什么给我这三张”。

### 2.2 状态/污染要成为构筑问题，不是测试牌

本轮已补小护栏：状态牌 `countsForChain=false`，`static_overload` 打出后不推进、不修补、不延链、不授权，也不打断已有费用链。压力污染只在“本回合没有打出任何牌却吃到意图伤害”的坏手镜头里加入，避免污染普通 runtime 回归。

下一步应该补：

- 节点结束清理污染，避免 v1 变永久诅咒系统。
- 至少一张 reward 能回应污染，例如 draw fixer 或一次性净化，但不要新增大净化生态。
- `qa:similarity` 里增加一个污染挤手牌镜头：4 手牌中 1 张状态，玩家实际少一个有效选择。

### 2.3 单局成长接入奖励闭环

当前 `cardUpgrades.ts` 已经证明本局升级和插槽会影响伤害，并且 restart 后清空。最大问题是它还像外部工具函数，不像一次 run 内奖励。

建议最小接入：

- 在 level-up reward 后增加一种“升级当前 deck 中一张伤害牌”的选择源，但每次只给 1 个升级候选，不开完整升级 UI。
- 升级只影响当前 run，restart 清空，不能改 starting deck。
- 只把升级接到 `DamageEnemy` 的基础伤害，不改变 cost、draw、retain、authorization。

这项是从 `88` 推到 `92-94` 的关键；要到 `95`，还需要浏览器 journey 证明玩家看得到。

## 3. 本轮已安全落地的小改动

我做了一个低风险 runtime 护栏，避免状态/污染牌破坏核心循环：

- `CardDefinition.countsForChain?: boolean`：显式标记某张牌是否参与费用链。
- `advanceCostChain`：`cardType === 'status'` 或 `countsForChain === false` 时，不推进、不修补、不延链、不断链，`CardPlayed` 仍正常发出。
- `static_overload`：标为 `countsForChain: false`。
- 生命周期测试新增断言：污染牌打出后不产生 `ChainAdvanced / ChainBroken`，后续 `debt_hook -> redline_cut -> row_cleave` 仍能授权。
- 压力污染触发被收窄：只有本回合没有打出牌、受到意图伤害、且抽牌堆空/弃牌堆接近可洗回时才加入 `static_overload`。

这不是扩内容，而是修正“状态牌不能变成免费 0 费链段”的相似度硬伤。

## 4. 可立即落地的改动清单

P0，下一位 runtime/reward agent 可直接做：

1. 给 `WorldState` 加 `lastTurnProblemSignals` 或等价短结构，只记录上一手问题，不做复杂 AI 评分。
2. 在 `end-turn`、`CardPlayed`、`RewardChoicesGenerated` 旁补问题信号事件，例如 `RunProblemSignalRecorded`。
3. 改 `buildRewardChoices` 输入，让它接收 problem signals；优先选择能回应问题的 branch。
4. reward 选择事件加 `reasonTag`：`缺开链 / 缺承接 / 缺终结 / 被污染 / 承压`，HUD 只显示短 token。
5. 把 `buildCardUpgradeChoices` 接到一个 run 内奖励入口，先只允许伤害牌 `raise-level`。
6. 加节点结束污染清理事件：`StatusPurgedAtNodeEnd`，只清 `availability=reserve-test` 或 `cardType=status` 的污染牌。
7. `qa:similarity` 增加 1 个污染手牌镜头和 1 个升级后伤害变化镜头。

P1，可排后：

- 加 1 张原创保留 2 段奖励牌，但必须占 4 手牌位。
- 加 1 张原创一次性开链消耗牌，但不抽牌、不返 MP、不 topdeck。
- reward pool 做轻权重，不要每次固定三张。

明确不做：

- 不做完整遗物、商店、删牌、地图分支。
- 不做完整 CardInstanceId 大迁移。
- 不做永久 Max MP。
- 不把状态牌做成能参与 `0 -> 1 -> 2` 的免费材料。

## 5. 验收指标

达到 `95/100` 的最短验收线：

| 指标 | 合格线 |
| --- | --- |
| 状态链路惰性 | 打出污染牌后 `playedCosts` 不变，无 `ChainAdvanced / ChainBroken / AuthorizationGranted`。 |
| 坏手可读 | 至少一个 3-5 回合 journey 中，状态牌占手牌位并导致有效选择减少。 |
| 奖励回应 | reward 三选一至少有一张明确回应上一手问题，事件或报告能看到 `reasonTag`。 |
| 单局成长 | 一次升级/插槽/强化影响后续 `DamageApplied`，restart 后清空。 |
| 旧合同不退化 | `0->1->2`、Wild MP3、payoff-only 授权、paper topdeck、reward next-hand 全部通过。 |
| 移动端 | `qa:ui` 与 `qa:similarity` 三视口无横向溢出、无关键文本超框。 |
| 自动化 | `npm run check`、targeted sim、`qa:similarity`、`qa:ui` 全通过。 |

本轮已验证：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run src/tests/sim/redline-lifecycle-v1.test.ts src/tests/sim/redline-pressure-balance.test.ts src/tests/sim/runtime-audit.test.ts src/tests/sim/runtime.test.ts src/tests/sim/card-taxonomy.test.ts src/tests/sim/redline-similarity-journey.test.ts src/tests/sim/redline-competitor-similarity.test.ts
npm run check
```

结果：

- targeted sim：`7 passed`，`66 passed`。
- `npm run check`：`19 passed | 1 skipped`，`142 passed | 2 skipped`，build 通过。
- 备注：Vite 仍有 `Some chunks are larger than 500 kB` 警告，不阻塞本轮 sim 结论。

## 6. 第14轮-01结论

当前 demo 已从“像一个费用链战斗切片”进入“有牌区生命周期和压力污染的卡牌 roguelike 切片”。最不像竞品的地方，已经从抽弃洗回本身，转移到奖励和单局成长的因果闭环。

下一步不要再优先堆新卡。最有效的 7 分应该来自：

```text
上一手问题信号 -> 奖励回应 -> 下一手实际变好或变险 -> 单局成长影响结算
```

做到这条，才有资格冲 `95/100`。

STATUS: DONE
