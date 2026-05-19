# 2026-05-18 第 10 轮专家 10：总制作人综合裁决

角色：第 10 轮专家 10，总制作人综合裁决  
工作目录：`/Users/roc/Game-001`  
文件所有权：本文只写 `design/technical/redline-batches/long-task/2026-05-18-round-10-10-producer-synthesis.md`  
输出边界：只写文档；不改源码、不改测试、不提交 git、不回滚或覆盖其他工作者改动。  
裁决主题：10 轮长任务最终收束，判断当前 redline prototype 是否进入下一阶段。

## 0. 最终结论

本轮最终裁决：

```text
该改：只改最终文档、验收口径、发布风险说明和下一阶段路线。
不该改：本轮不再改代码、不再扩机制、不再补 UI、不再追加 QA 平台。
```

当前 10 轮长任务已经从“核心循环不可读”推进到一个可验收的 P0 样片：

- 卡牌文案合同已结构化。
- 奖励进入下一手已落地。
- `rewardBranches` 已显式化。
- 奖励修补牌已开放。
- Wild 修补已从文案变成运行时合同。
- HUD 已压缩为短 token。
- `paper_shatter` 已有极窄 drawPile-only 顶终结样片。
- `qa:ui` 已把桌面、390、360 三档 UI 验收自动化。

所以第 10 轮不应该继续“趁热再改一点”。制作上最重要的动作是停手、验收、冻结样片边界，然后进入下一阶段玩家体验复测。

## 1. 总制作人 10 个镜头

### 镜头 01：目标选择

第 1 轮把目标从“大做卡牌游戏系统”压回 P0 Hyper-Turn 样片。这个决定是正确的。当前样片最有价值的不是系统完整度，而是玩家能不能在一手牌内看懂敌意图、费用链、授权、修补和终结。

最终裁决：保留 P0 样片定位，不在本轮升级成完整 roguelike 卡牌框架。

### 镜头 02：卡牌文案合同

第 2 轮把卡牌文案拆成 `rulesText / mobileEffect / keywords / detail`，解决了早期最大 UI 风险：固定尺寸按钮里塞长规则句。这个合同后续必须继续保留。

最终裁决：以后新增卡牌先过文案合同，再谈机制强度；不允许把长解释重新塞回手牌按钮。

### 镜头 03：奖励进下一手

第 3 轮把首奖提前，并让非终局奖励先入牌再发下一手。这个改变直接修复了“玩家选择奖励但反馈延后一手”的制作断点。

最终裁决：奖励选择后的即时反馈是当前样片核心体验之一，不能回退到奖励滞后一手。

### 镜头 04：`rewardBranches`

第 4 轮把奖励分支从启发式推导改成显式合同，避免 `availability`、`chainRole` 或文案变化导致奖励分类漂移。

最终裁决：奖励分支属于产品合同，不是 UI 临时推断；后续新牌必须显式声明分支。

### 镜头 05：奖励卡开放

第 5 轮开放 `blood_tithe / pulse_draw`，并让 HUD 显示真实抽牌倍率。这让坏手修补和奖励修补从设计愿望进入玩家可见循环。

最终裁决：当前奖励池可以作为下一阶段复测基线；本轮不再追加新奖励卡。

### 镜头 06：Wild 修补

第 6 轮修正了 Wild 的核心问题：`wild_mana_stitch` 只有真实修补成功才返当前 MP，broken chain 后不再伪装成成功修补。

最终裁决：这是 P0 样片里最重要的“卡牌游戏味”合同之一，后续平衡可以调数值，但不能让 Wild 回到无条件资源按钮。

### 镜头 07：HUD 短 token

第 7 轮暂缓完整 reorder，先把 HUD 压成 `授权+3`、`缺MP1`、`授权付`、`抽N仍-X`、`整备` 等短 token。这个选择保护了移动端 360 宽验收。

最终裁决：短 token 是当前 UI 的硬约束；下一阶段可以加 detail 层，但不能牺牲手牌主操作层。

### 镜头 08：`paper_shatter` 顶终结

第 8 轮只给 `paper_shatter` 做 drawPile-only payoff topdeck，没有打开 `lantern_captain`、discard fallback、手动重排或通用 tutor。这个范围非常关键。

最终裁决：`paper_shatter` 是验证“整备制造下一抽期待”的样片，不是完整找牌系统。本轮不扩展。

### 镜头 09：`qa:ui` 自动验收

第 9 轮把真实浏览器验收固化为 `qa:ui`，覆盖 `1366x768`、`390x844`、`360x640`，检查 console error、水平溢出、关键文本超框、`paper_shatter -> PayoffTopdecked -> HandDealt -> 整备：顶终结` 可见，以及清理 server/browser。

最终裁决：自动验收已经够用。第 10 轮不应把它升级成截图基线平台、跨浏览器矩阵或 CI 工程。

### 镜头 10：最终停手

10 轮长任务已经完成一次从制作目标、机制合同、奖励节奏、修补运行时、UI 压缩、极窄整备到自动验收的闭环。此时继续加功能，收益低于风险。

最终裁决：进入冻结与复测阶段。下一步不是“再做一张牌”，而是让真实玩家或主制作视角连续玩 3-5 局，判断当前爽点是否成立。

## 2. 本轮该改 / 不该改

### 2.1 该改

本轮只该改这些内容：

- 写最终裁决文档。
- 汇总前 9 轮制作取舍。
- 明确可发布样片边界。
- 明确最终验收命令。
- 明确发布风险和停用策略。
- 明确下一阶段最小路线。

### 2.2 不该改

本轮不该改这些内容：

- 不改 `prototype-web` 源码。
- 不改测试。
- 不改 `package.json`。
- 不改 `qa:ui` 脚本。
- 不新增卡牌。
- 不开放 `lantern_captain` 真实找牌。
- 不做 discard fallback。
- 不做手动 reorder UI。
- 不做 CardInstance、消耗、保留、状态、诅咒、升级或遗物。
- 不把 `qa:ui` 扩成平台。

如果此时发现必须通过改代码才能通过验收，应当单独开下一轮 bugfix，而不是把修复混进第 10 轮裁决。

## 3. 最终验收命令

最终发布前建议按以下顺序运行：

```bash
cd /Users/roc/Game-001/prototype-web
npm run check
npm run qa:ui
```

如果需要更细颗粒定位，可以拆开运行：

```bash
cd /Users/roc/Game-001/prototype-web
node --check scripts/qa-ui.mjs
npm run test:sim
npm run test:ui
npm test -- --run
npm run build
npm run qa:ui
```

最低通过线：

- `npm run check` 通过。
- `npm run qa:ui` 通过。
- 三档视口 `1366x768`、`390x844`、`360x640` 均无 console error。
- 三档视口均无页面水平溢出。
- 三档视口关键 UI 文本无真实超框。
- `paperScenarioReached: true`。
- `topdeckEvidenceVisible: true`。
- `endTurnStillUsable: true`。
- 脚本启动的页面、browser、server 都被清理。
- Vite 500KB chunk warning 可记录但不阻塞本轮。

## 4. 可发布边界

当前样片可发布为：

```text
Redline P0 Hyper-Turn prototype:
一手牌内读敌意图、接费用链、用授权支付终结、用修补牌修坏手、
通过奖励进入下一手形成短循环，并用 paper_shatter 展示一个极窄整备顶终结爽点。
```

当前样片不可宣传为：

```text
完整卡牌 roguelike、完整构筑系统、完整找牌系统、完整状态/遗物/升级系统、
完整移动端产品、完整 QA 平台、完整平衡版本。
```

## 5. 发布风险

| 风险 | 当前状态 | 发布裁决 |
| --- | --- | --- |
| 机制范围膨胀 | 已多轮压住，仍有 `lantern_captain`、discard fallback、通用 reorder 的诱惑 | 不阻塞发布，但必须冻结。 |
| 平衡过强 | `paper_shatter` 命中 payoff 会制造强爽点 | 不阻塞；因为只搜 drawPile 且只开一张牌。后续用复测观察命中率。 |
| 移动端 UI 回归 | 已有 360/390 自动验收 | 不阻塞；发布前必须跑 `npm run qa:ui`。 |
| QA 依赖外部 Playwright | 第 9 轮选择不改 lockfile，依赖外部 gstack Playwright | 可接受；但发布说明要记录本地验收环境依赖。 |
| 文档与代码漂移 | 长任务多轮并行，文档口径可能旧 | 本文作为最终口径；旧轮次文档保留历史，不再逐份修。 |
| 未提交并行改动 | 当前工作区存在大量未提交源码与文档 | 不阻塞本文；最终发布前需要由主线程统一看 git diff。 |
| Vite chunk warning | 构建仍可能提示 500KB chunk warning | 不阻塞 P0；等资源拆分或正式架构阶段处理。 |
| 玩家是否真的觉得爽 | 自动化只能证明不炸，不能证明好玩 | 阻塞下一阶段扩系统；必须安排实际复测。 |

## 6. 停用策略

如果下一阶段复测发现 `paper_shatter` 让早期终结过于稳定，最快停用方式不是回滚整轮代码，而是：

```text
关闭或移除 paper_shatter 的 preDrawTopdeckPayoff 开关，
保留现有事件、测试和 HUD 短 token 基础设施。
```

如果发现移动端读不懂，则优先调整 detail 层和日志节奏，不要把长规则塞回手牌按钮。

如果发现奖励节奏过快，则优先调首奖阈值和奖励池排序，不要破坏“奖励进入下一手”的合同。

## 7. 下一阶段最小路线

下一阶段不要立即开大系统。建议只走四步：

1. 冻结当前样片  
   跑 `npm run check && npm run qa:ui`，记录结果，不再混入新机制。

2. 做 3-5 局体验复测  
   重点观察玩家是否能读懂：敌意图、缺 MP、授权付、Wild 修补、奖励进入下一手、`paper_shatter` 顶终结。

3. 只修阻塞体验的问题  
   优先级是看不懂、点不到、溢出、反馈错误、机制和文案不一致。不是新增卡牌。

4. 再决定下一机制  
   只有当当前样片被证明好玩，才在 `lantern_captain` 路线整备、discard fallback、状态牌、升级、CardInstance 中选一个最小方向。

下一阶段最小候选优先级：

| 优先级 | 候选方向 | 裁决 |
| --- | --- | --- |
| P0 | 玩家体验复测与阻塞修复 | 应做。 |
| P1 | `paper_shatter` 命中率和平衡观察 | 应做，但只记录和小调。 |
| P2 | `lantern_captain` route topdeck 极窄样片 | 暂缓，等复测后再定。 |
| P3 | 状态、消耗、保留、升级、遗物 | 不进下一最小阶段。 |
| P4 | 通用牌库浏览器 / 手动重排 UI | 不做。 |

## 8. 最终裁决

第 10 轮最终裁决：

```text
本轮该改：最终文档与制作裁决。
本轮不该改：任何代码、测试、QA 脚本或新机制。

当前 P0 样片可以进入冻结验收与玩家复测；
不能直接进入大规模系统扩展。

发布前最低命令：
cd /Users/roc/Game-001/prototype-web
npm run check
npm run qa:ui

若两条命令通过，且 qa:ui 三档视口无 console error、无水平溢出、
无关键文本超框、paper_shatter 顶终结证据可见，则本 10 轮长任务可判定完成。
```

STATUS: DONE
