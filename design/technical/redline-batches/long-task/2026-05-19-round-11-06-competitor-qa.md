# 2026-05-19 第11轮专家06：竞品相似度 QA / 自动验收指标

角色：第 11 轮专家 06，竞品相似度 QA / 自动验收专家  
工作目录：`/Users/roc/Game-001`  
文件所有权：`design/technical/redline-batches/long-task/2026-05-19-round-11-06-competitor-qa.md`  
边界：只写本文档；不改源码、不提交、不回滚。  
目标：审查现有 `qa:ui` 与 `sim/ui` 测试，为第 11 轮“更像 Vampire Crawlers”的改动定义可自动验证的相似度指标。

## 0. 总结裁决

当前自动化已经能证明一件事：Redline 样片具备“0 -> 1 -> 2 -> 3 payoff”的窄闭环，并且在三档浏览器视口中没有明显 UI 溢出、raw token 泄漏或浏览器残留。

但它还不能自动证明“更像 Vampire Crawlers”。原因不是机制缺失，而是验收口径缺了一层“相似度指标”：现有测试多在验证内部合同是否正确，例如 `paper_shatter` 是否先置顶再抽、Wild 是否修补、payoff 授权是否可支付；它们没有把玩家感知层的竞品结构拆成可量化门槛，例如倍率是否连续升序、断链是否明显弱化、抽牌支援是否也吃倍率、失败样片是否仍能展示“差一点就爆”的结构。

第 11 轮建议新增一个“竞品相似度 QA”验收层，定位在现有 `npm run test:sim` 与 `npm run qa:ui` 之间：

```text
sim 合同：机制事实正确
competitor-sim 合同：结构像目标竞品的爽点曲线
qa:ui 合同：玩家在真实 HUD 中看得到、读得懂、没有溢出、清理干净
```

这层不能宣称完整复刻 Vampire Crawlers。它只能声明：当前切片自动覆盖了“升序倍率、支援抽牌、Wild 延长、断链弱化、payoff 爆点、UI 可读、失败可解释”这些相似度信号。

## 1. 现有测试审查

### 1.1 `qa:ui`

现有入口：

```bash
cd /Users/roc/Game-001/prototype-web
npm run qa:ui
```

当前脚本能力：

| 能力 | 当前状态 | 对第 11 轮的价值 |
| --- | --- | --- |
| 三档视口 | `1366x768`、`390x844`、`360x640` | 可以继续作为“像竞品的密集 HUD 也不能溢出”的硬门槛。 |
| DOM 溢出 | 检查页面横向溢出、关键 selector 文本 overflow | 可复用，但要扩展到第 11 轮新增倍率/失败 token。 |
| raw token 黑名单 | 阻止 `PayoffTopdecked`、`drawPile`、`undefined` 等泄漏 | 可复用，避免把内部机制当玩家反馈。 |
| `paper_shatter` 样片 | 注入确定性世界，验证 `整备：顶终结` 可见 | 可作为“抽牌支援 + payoff 准备”的 UI 镜头基线。 |
| End Turn 可用 | 检查结束回合按钮仍可用 | 可保留为基础可玩性门槛。 |
| cleanup | 关闭 page/context/browser/server，并检查 PID/port | 必须继续作为硬门槛。 |

当前缺口：

- 没有保存失败截图或失败样片摘要。
- 没有断链/弱化样片。
- 没有 Wild 延长到 `x3+` 的玩家可见样片。
- 没有抽牌支援吃倍率后的 `抽2/抽3` UI 断言。
- 没有 payoff 倍率从链路继承到 `x4` 的玩家可见断言。
- 没有“不能宣称完整竞品复刻”的报告字段。

### 1.2 `sim` 测试

当前关键覆盖：

| 文件 | 已覆盖 | 第 11 轮复用方式 |
| --- | --- | --- |
| `redline-hyperturn-acceptance.test.ts` | 有序链比乱序强；断链仍可出牌但倍率降为 `x1`；抽牌修补可接到 2 MP；turn 3-5 payoff 救场 | 适合作为相似度核心合同来源。 |
| `redline-progression-card-system.test.ts` | 授权只限 payoff；Wild 修补；payoff 清除意图；奖励进入 run 内而非 meta | 适合作为 Wild/payoff/资源边界合同来源。 |
| `redline-paper-shatter-topdeck.test.ts` | `paper_shatter` 只搜 drawPile，先置顶再抽，miss 照常抽，授权支付不破坏 | 适合作为“支援抽牌找终结”的合同来源。 |
| `hud-target-selection.test.ts` | HUD helper 层短 token、授权付、意图预览 | 可用来补 UI 文案语义，但不能替代真实 DOM。 |

当前缺口：

- 没有统一的“相似度评分”或 `SimilarityAcceptance` 分组。
- 没有把 `effectMultiplier` 序列作为一条可读曲线断言，例如 `1,2,3,4`。
- 没有明确断言“支援抽牌也吃倍率”，只能从个别 `pulse_draw` / `paper_shatter` 测试间接看到。
- 没有对失败样片做正向验收：失败不是 bug，失败应展示断链、弱化、未解意图和下一次修补空间。
- 没有把“不能宣称完整竞品复刻”变成最终报告的固定字段。

## 2. 相似度指标定义

第 11 轮不要用“像不像”做主观评语。建议定义 6 个自动指标。

| 指标 | 自动判定 | 通过门槛 | 失败说明 |
| --- | --- | --- | --- |
| `ascendingMultiplierScore` | 同一条成功路线中 `CardPlayed.effectMultiplier` 是否连续升序 | 至少出现 `x1 -> x2 -> x3 -> x4` 或当前切片等价链路 | 缺少升序曲线时，玩家感知不到逐步滚大的 Vampire Crawlers-like 爽点。 |
| `supportScaledScore` | `drawCards` / self support 是否按倍率放大实际抽牌数 | 至少一张抽牌支援在 `x2+` 时实际 `HandDealt.cardIds.length >= 2`，或 `x3` 时 `>= 3` | 抽牌支援不吃倍率会让“打对顺序找更多解”的结构断掉。 |
| `wildExtensionScore` | Wild 是否能把链延长到 `x3+`，且记录 `ChainRepaired` | Wild 样片必须出现 `chainRepaired: true`、`repairedCost`、后续 `x3` 或更高倍率 | Wild 只补资源不延长链，就不像“续命维持 combo”。 |
| `brokenChainPenaltyScore` | 断链后是否仍可打牌但倍率明显降级 | 同类牌断链倍率必须为 `x1`，且伤害/效果低于有序链至少 35% | 断链没有弱化会让顺序规划无意义；断链直接禁用又太硬。 |
| `payoffAmplificationScore` | payoff 是否继承链路到高倍率，并清除/阻止可见意图 | payoff 样片必须出现 `effectMultiplier >= 4`、`authorizationPaid > 0`、`PayoffResolved.preventedIntentDamage > 0` | payoff 不像爆点，玩家不会形成“铺垫到清场”的目标。 |
| `uiReadableScore` | 浏览器 HUD 是否显示短 token，且无溢出/cleanup pass | 三档视口 `textOverflowCount=0`、`horizontalOverflowDetected=false`、`cleanup.status=pass` | 相似度不能牺牲可读性；浏览器残留也不能算 pass。 |

建议最终报告给出机器字段：

```json
{
  "similarityStatus": "pass|partial|fail",
  "similarityScope": "mechanic-slice-only",
  "notAFullClone": true,
  "metrics": {
    "ascendingMultiplierScore": "pass",
    "supportScaledScore": "pass",
    "wildExtensionScore": "pass",
    "brokenChainPenaltyScore": "pass",
    "payoffAmplificationScore": "pass",
    "uiReadableScore": "pass"
  }
}
```

硬规则：只要 `notAFullClone !== true`，报告不得标记为 `pass`。

## 3. QA 镜头矩阵

以下 14 个镜头是第 11 轮建议的自动验收最小集。前 10 个为 P0，后 4 个为 P1。

| # | 镜头 | 类型 | 场景设置 | 自动断言 | 覆盖要求 |
| ---: | --- | --- | --- | --- | --- |
| 1 | 成功升序链 `0 -> 1 -> 2 -> payoff` | `sim` | 手牌 `debt_hook, redline_cut, clearance_order, severance_burst`，敌人保活 | `CardPlayed.effectMultiplier` 序列为 `1,2,3,4`；payoff `authorizationPaid=3` | 升序倍率、payoff 倍率 |
| 2 | 乱序对照弱化 | `sim` | 同一组牌乱序，先打 2 MP 或跳过 1 MP | 乱序 2 MP 的 `effectMultiplier=1`；总伤害小于有序链 65% | 断链弱化 |
| 3 | 断链仍可出牌但不是爆点 | `sim` | `debt_hook -> row_cleave`，缺 1 MP | `row_cleave` 成功出牌；`effectMultiplier=1`；不发 `AuthorizationGranted` | 断链弱化、失败样片 |
| 4 | Wild 延长到 `x3+` | `sim` | `debt_hook -> wild_mana_stitch -> row_cleave` | 出现 `ChainRepaired`；Wild `effectiveCost=1`；后续 2 MP 为 `effectMultiplier=3` | Wild 延长 3+ |
| 5 | Wild 不得免费伪修补 | `sim` | 未起链或链已断后打 Wild | 不出现 `ChainRepaired`；不得发 `AuthorizationGranted`；返 MP 只允许按当前合同触发 | Wild 边界、断链弱化 |
| 6 | 抽牌支援吃倍率 `x2` | `sim` | `debt_hook -> pulse_draw`，drawPile 至少 2 张 | `pulse_draw.effectMultiplier=2`；同 trace `HandDealt.cardIds.length >= 2` | 抽牌支持也吃倍率 |
| 7 | `paper_shatter` 吃倍率并找 payoff | `sim` | `debt_hook -> redline_cut -> paper_shatter`，drawPile 中第 2 张是 payoff | `paper_shatter.effectMultiplier=3`；`PayoffTopdecked` 早于 `HandDealt`；抽到 payoff | 抽牌支持也吃倍率、payoff 准备 |
| 8 | `paper_shatter` miss 不是 bug | `sim` | drawPile 无 payoff，discardPile 有 payoff | 发 `PayoffTopdeckMissed`；照常抽牌；不搜 discardPile | 失败样片、不能伪 tutor |
| 9 | payoff 清除意图 | `sim` | 敌人前排高意图，完成授权后打 `severance_burst` | `effectMultiplier>=4`；`PayoffResolved.preventedIntentDamage > 0`；回合末玩家 HP 不掉对应意图 | payoff 倍率、Vampire Crawlers-like 清场 |
| 10 | 浏览器成功样片 HUD | `qa:ui` | 现有 `paper_shatter` 注入样片 | 三视口可见 `整备：顶终结` 或等价短 token；无 console/overflow；End Turn 可用；cleanup pass | UI 无溢出、浏览器 cleanup |
| 11 | 浏览器 Wild 样片 HUD | `qa:ui` P1 | 注入 Wild 修补到 `x3` 的世界 | 三视口可见 `修补MP1` / `接x3` / 等价短 token；无溢出 | Wild 延长 3+、UI 无溢出 |
| 12 | 浏览器断链失败样片 HUD | `qa:ui` P1 | 注入断链后仍可打牌场景 | 可见 `断链 x1` 或等价短 token；不显示“已解决/安全”；无溢出 | 断链弱化、失败样片 |
| 13 | 浏览器 payoff 爆点 HUD | `qa:ui` P1 | 注入完整链路到 payoff 后 | 可见 `Severance Burst x4` / `授权付` / `意图 17->0` 等短 token；无溢出 | payoff 倍率、UI 无溢出 |
| 14 | 报告边界样片 | JSON/文档 | 自动输出最终报告 | `similarityScope=mechanic-slice-only`、`notAFullClone=true`、`unsupportedClaims` 不为空 | 不能宣称完整竞品复刻、下一轮指标 |

P0 通过门槛：镜头 1-10 全绿。  
P1 通过门槛：镜头 11-14 至少落入 `partial-pass`，允许先作为下一轮指标，但不能缺失文档字段。

## 4. 推荐测试入口

不建议把竞品相似度全部塞进 `qa:ui`。浏览器测试慢且脆，机制相似度应主要由 `sim` 锁住。

建议后续新增：

```json
{
  "scripts": {
    "test:sim:similarity": "vitest run src/tests/sim/redline-competitor-similarity.test.ts",
    "qa:ui:similarity": "node scripts/qa-ui.mjs --scenario similarity"
  }
}
```

如果第 11 轮不想改脚本，也可以先用现有命令组合：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test:sim -- src/tests/sim/redline-hyperturn-acceptance.test.ts src/tests/sim/redline-progression-card-system.test.ts src/tests/sim/redline-paper-shatter-topdeck.test.ts
npm run test:ui
npm run qa:ui
```

但最终验收口径必须承认：这只是复用现有合同，不等于已经拥有专门的相似度测试文件。

## 5. 失败样片规范

第 11 轮必须把失败样片纳入自动验收。失败样片不是“测试失败”，而是游戏内的负面状态是否可读。

建议至少记录 4 类失败样片：

| 失败样片 | 自动期望 | 玩家可见 token | 不允许出现 |
| --- | --- | --- | --- |
| 断链失败 | 出牌仍成功，倍率降到 `x1`，不发授权 | `断链 x1`、`会断链`、`仍-17` | `安全`、`已解决`、`授权+3` |
| Wild 失败 | 不符合修补条件时不发 `ChainRepaired` | `链已断`、`不能修补` 或保持普通牌面 | 假显示 `修补MPx` |
| topdeck miss | `PayoffTopdeckMissed`，照常抽牌，不搜 discardPile | `整备无牌`、`未见终结`、`仍-17` | `找到终结`、raw `drawPile` |
| payoff 未武装 | payoff 可被资源规则拦截或低效打出，但不清意图 | `未武装`、`缺授权` | `意图 17->0` |

失败样片的价值是证明“像 Vampire Crawlers 的地方不是无条件爽，而是玩家知道为什么没爽起来”。如果失败只表现为按钮没反应、文本溢出、raw token 或隐藏状态，那就是 QA fail。

## 6. UI 无溢出与浏览器 cleanup 门槛

第 11 轮任何“更像竞品”的 UI 文案都必须遵守第 10 轮短 token 纪律：

- 倍率：`x1`、`x2`、`x3`、`x4`。
- 断链：`断链 x1`、`会断链`。
- Wild：`修补MP1`、`修补MP2`、`接x3`。
- 抽牌：`抽2`、`抽3`、`抽3找终结`。
- payoff：`授权付`、`终结 x4`、`意图17->0`。
- miss：`整备无牌`、`未见终结`。

浏览器验收硬门槛：

| 字段 | 必须值 |
| --- | --- |
| `status` | `pass` |
| `results[].consoleErrorCount` | `0` |
| `results[].horizontalOverflowDetected` | `false` |
| `results[].textOverflowCount` | `0` |
| `results[].endTurnStillUsable` | `true` |
| `cleanup.status` | `pass` |
| `cleanup.residualCheck.pidAlive` | `false` |
| `cleanup.residualCheck.portListening` | `false` |

如果机制相似度全绿但 cleanup 失败，最终状态只能是：

```text
functional-pass-cleanup-fail
```

不能写成完整通过。

## 7. 不能宣称完整竞品复刻

第 11 轮相似度验收只能覆盖“战斗切片更像 Vampire Crawlers 的部分结构”，不能宣称完整竞品复刻。

允许的表述：

```text
当前切片自动验证了升序倍率、断链弱化、Wild 续链、抽牌支援倍率、payoff 爆点和三视口 HUD 可读性。
```

不允许的表述：

```text
已经完整复刻 Vampire Crawlers。
已经达到 Vampire Crawlers 级别。
已经验证完整移动端产品。
已经验证完整卡牌 roguelike 机制底座。
```

原因：

- 当前没有完整牌区生命周期：消耗、保留、状态牌、升级、实例化仍缺。
- 当前没有完整 run/meta loop：商店、遗物、局外成长、角色差异仍缺。
- 当前 `qa:ui` 是三视口窄样片，不是完整移动设备矩阵。
- 当前没有真实玩家路径证明所有样片都能自然出现。
- 当前没有竞品美术、音效、动效、内容量或长期构筑节奏验收。

最终报告必须包含：

```text
验收边界：这是相似度指标切片，不是完整 Vampire Crawlers 复刻。
```

## 8. 下一轮指标

如果第 11 轮 P0 指标通过，下一轮不要继续只堆倍率。建议进入 5 个更高质量指标：

| 下一轮指标 | 目标 | 自动化方向 |
| --- | --- | --- |
| `naturalPathSimilarity` | 不靠 browser harness 注入，玩家从自然发牌/奖励路径也能到达 Wild、topdeck、payoff 爆点 | `sim` 跑 20-50 个 seeded run，统计可达率 |
| `badHandRecoveryRate` | 坏手不是死局，至少能通过抽牌/Wild/整备找到下一步 | 固定坏手矩阵，统计修复成功率 |
| `payoffTimeToImpact` | payoff 不应太早也不应太晚，3-5 回合内能形成一次清场/救场 | seeded sim 统计首次 `PayoffResolved` 回合 |
| `failureReadabilityUi` | 失败也有可读样片和截图/JSON，不只是机制事件 | `qa:ui` 增加 failure scenario 与截图路径 |
| `claimSafetyGate` | 所有自动报告都强制带边界声明 | JSON schema 检查 `notAFullClone=true` |

建议下一轮新增输出文件：

```text
outputs/browser-qa/round-11/similarity-result.json
outputs/browser-qa/round-11/failure-samples.json
outputs/browser-qa/round-11/screenshots/
```

## 9. 最终验收口径

第 11 轮可交付口径建议如下：

```text
当前版本通过“竞品相似度切片 QA”：
1. 有序路线能形成 x1 -> x2 -> x3 -> x4 的升序倍率。
2. Wild 可以把链路延长到 x3+，但不在失败条件下伪修补。
3. 断链仍可出牌，但倍率和伤害明显弱化。
4. 抽牌支援也吃倍率，能把打对顺序转化为更多抽牌。
5. paper_shatter 能在抽牌前置顶 payoff，miss 时照常抽牌且不伪搜弃牌堆。
6. payoff 能继承倍率并清除/阻止可见敌人意图。
7. 三档浏览器视口无文字溢出、无横向页面溢出、无 raw token，且 cleanup pass。
8. 报告明确声明这不是完整 Vampire Crawlers 复刻。
```

STATUS: DONE
