# 2026-05-19 第14轮-10 最终整合/风险审查

角色：第14轮-10《最终整合/风险审查专家》  
工作目录：`/Users/roc/Game-001`  
审查对象：当前工作树中的第13轮生命周期 v1 变更，重点阅读 `git diff`、`prototype-web/src/sim`、`prototype-web/src/tests`、`prototype-web/scripts`。  
边界：未回滚他人改动；未改源码/测试。本文是本轮唯一新增文件。

## 0. 结论

第13轮生命周期 v1 的 runtime、类型、sim 测试和浏览器功能 QA 当前没有发现阻断级功能回归。`CardMoved`、`exhaustPile`、`retainedCards`、洗回事件、状态牌物理占位、Wild MP3 延链、payoff-only 授权、`paper_shatter` drawPile 顶终结、reward next-hand 都有可复跑证据。

但第14轮整合不能直接宣布“完全停止”。当前主要风险在 QA 编排层，而不是机制本体：

1. `qa:ui`、`qa:similarity`、`qa:lifecycle` 默认都抢 `5174`，并行运行会互相踩 server，导致假失败。
2. browser QA 输出目录不统一，`qa:ui` 写 repo 根 `outputs/`，`qa:similarity` 和 `qa:lifecycle` 写 `prototype-web/outputs/`，后续聚合容易漏证据。
3. 尚未看到第13轮文档建议的总分聚合入口，例如 `qa:round13` / `scorecard.json`。现在只能人工合并 `npm run check` 与三个 QA 结果。
4. `qa:lifecycle` 的浏览器脚本验证了消耗、保留和短 token，但对“状态污染牌”是通过 sim 测试覆盖，浏览器结果里没有独立 status 场景。

建议第14轮判定：功能可进入“候选冻结”，但先补 QA 编排与 scorecard，再由制作人做最终停止裁决。

## 1. 已执行验证

在 `/Users/roc/Game-001/prototype-web` 执行：

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `npm run build` | pass | `tsc && vite build` 通过；仅有 Vite chunk >500KB 警告。 |
| `npm test -- --run src/tests/sim/redline-lifecycle-v1.test.ts src/tests/sim/redline-similarity-journey.test.ts src/tests/sim/redline-competitor-similarity.test.ts src/tests/sim/redline-paper-shatter-topdeck.test.ts src/tests/sim/runtime.test.ts` | pass | 5 files / 56 tests passed。 |
| `node --check scripts/qa-lifecycle.mjs && node --check scripts/qa-similarity.mjs && node --check scripts/qa-ui.mjs` | pass | 三个脚本语法检查通过。 |
| `npm run check` | pass | 17 files passed, 1 skipped；132 passed, 2 skipped；build 通过。 |
| `QA_ROUND=round-14-review npm run qa:lifecycle` | pass | 三视口通过；输出 `prototype-web/outputs/browser-qa/round-14-review/qa-lifecycle-result.json`。 |
| `QA_ROUND=round-14-review npm run qa:similarity` | fail | 并行抢端口导致 `ERR_CONNECTION_REFUSED`，cleanup pass；不是机制断言失败。 |
| `QA_ROUND=round-14-review npm run qa:ui` | `functional-pass-cleanup-fail` | 功能断言全绿，但并行抢端口导致 residual port 检查失败。 |
| `QA_ROUND=round-14-review-serial QA_PORT=5184 npm run qa:similarity` | pass | 三视口通过；输出 `prototype-web/outputs/browser-qa/round-14-review-serial/qa-similarity-result.json`。 |
| `QA_ROUND=round-14-review-serial QA_PORT=5194 npm run qa:ui` | pass | 三视口通过；输出 `outputs/browser-qa/round-14-review-serial/qa-ui-result.json`。 |
| `QA_ROUND=round-14-review-serial QA_PORT=5204 npm run qa:lifecycle` | pass | 三视口通过；输出 `prototype-web/outputs/browser-qa/round-14-review-serial/qa-lifecycle-result.json`。 |

说明：最后三条是不同端口并行复跑，等价验证“功能能通过，默认同端口并行会失败”。

## 2. 机制审查

通过项：

- `prototype-web/src/sim/runtime.ts` 已建立 `CardMoved` 事件，含 `cardId/from/to/fromZone/toZone/reason`，并在抽牌、出牌、回合末弃牌/保留、保留牌回手时记录。
- 消耗路径通过 `playedCardDestination()` 和 `moveHandCardToZone()` 进入 `exhaustPile`，不会进 discard。
- 保留路径在 `DiscardHand` 的 `turn ended` reason 下进入 `retainedCards`，下一次 `DealHand` 先释放保留牌，再补抽到手牌上限。
- 洗回路径有 `DiscardPileShuffledIntoDrawPile` 和兼容事件 `DiscardShuffledIntoDraw`，并发生在 `HandDealt` 前。
- 状态污染牌在 sim 测试中作为物理牌进入 `drawPile/hand/discardPile` 循环，并新增 `countsForChain: false` 覆盖“不推进/不打断费用链”的合同。
- `paper_shatter` 仍只通过 `TopdeckPayoffFromDrawPile` 搜 `drawPile`，没有扩成全牌库 tutor。
- Wild MP3 延链、payoff 授权支付、reward selected 后新牌进入下一手，在关键 sim 和 browser QA 中都保住了。

保留风险：

- `CardPlayed` 本身没有 zone 字段，zone 事实依赖 `CardMoved`。这是可接受设计，但后续 score runner 不应把 `CardPlayed.fromZone/toZone` 当硬条件。
- `qa:lifecycle` 浏览器报告里 `selectedCards.status` 为 `null`，说明浏览器生命周期脚本没有单独打出 status-only 场景；当前状态污染主要由 `redline-lifecycle-v1.test.ts` 覆盖。

## 3. 风险清单

### P1：默认 QA 脚本不能并行跑

证据：

- 三个脚本默认 `QA_PORT ?? 5174`。
- 同时跑 `qa:lifecycle/qa:similarity/qa:ui` 时，`qa:similarity` 报 `page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5174/`。
- 同时跑时，`qa:ui` 功能全绿但 `cleanup.residualCheck.portListening=true`，最终为 `functional-pass-cleanup-fail`。
- 指定不同端口 `5184/5194/5204` 后三者全部 pass。

影响：

- 第14轮多个 worker 或聚合脚本如果并行跑默认 QA，会得到假红。
- “cleanup 失败分数上限 79”的第13轮规则会被误触发。

建议：

- 第14轮新增总控 runner 时按顺序运行三个 browser QA；或为每个 QA 自动分配并记录唯一端口。
- 若保持可并行，端口选择必须是原子占用，不要先 `isPortFree()` 再异步启动 Vite。

### P1：QA 输出目录不统一

证据：

- `qa:similarity` 输出到 `prototype-web/outputs/browser-qa/<round>/qa-similarity-result.json`。
- `qa:lifecycle` 输出到 `prototype-web/outputs/browser-qa/<round>/qa-lifecycle-result.json`。
- `qa:ui` 输出到仓库根 `outputs/browser-qa/<round>/qa-ui-result.json`。

影响：

- 后续 scorecard 聚合器容易只扫一个目录，误判缺证据。
- 文档验收时不容易知道“正式证据”在哪。

建议：

- 第14轮统一 browser QA 输出根目录，或让 score runner 显式读取两处并在报告里写绝对证据路径。

### P2：缺总分聚合入口

证据：

- `package.json` 当前有 `check`、`test:sim`、`test:ui`、`qa:ui`、`qa:similarity`、`qa:lifecycle`，但没有第13轮文档建议的 `qa:round13` 或总分 scorecard。

影响：

- 当前只能人工判断“达到 95/100 停止线”，不利于多 agent 整合。

建议：

- 第14轮优先补一个 `qa:round13` 或 `qa:score`，输出 `scorecard.json` 和 `scorecard.md`，把 `npm run check`、lifecycle、similarity、ui 四类证据聚合。

### P2：浏览器 lifecycle 对 status-only 覆盖不足

证据：

- `redline-lifecycle-v1.test.ts` 已覆盖物理 status 卡和 `countsForChain: false`。
- 但 `qa:lifecycle` 的浏览器结果里 `selectedCards.status` 为 `null`，实际演练以 `static_overload` 作为 exhaust/status 混合牌，以 `guard_reserve` 作为 retain 牌。

影响：

- 如果后续只看 browser QA，不看 sim 测试，可能误以为状态污染牌已在浏览器层完整验收。

建议：

- 第14轮可以给 `qa:lifecycle` 增加一个独立 `static_overload` 或 status-only 场景：验证 visible token、物理占位、打出不推进链、节点清理边界。

## 4. 第14轮整合建议

建议第14轮不再新增机制，按以下顺序收口：

1. 先补 QA 编排：新增总控命令，顺序或唯一端口运行 `check`、`qa:lifecycle`、`qa:similarity`、`qa:ui`。
2. 统一证据路径：至少在总控报告中记录 `prototype-web/outputs/...` 与 `outputs/...` 的实际文件。
3. 补 scorecard：按第13轮 100 分制生成机器可读 JSON，避免人工口头打分。
4. 可选补强：让 `qa:lifecycle` 单独覆盖 status-only 浏览器镜头。
5. 然后再由制作人裁决是否冻结生命周期 v1。

当前建议分流：

| 工作流 | 建议 |
| --- | --- |
| Runtime lifecycle | 暂不改，除非后续 scorecard 发现边界缺口。 |
| Contract regression | 保持现有 sim 合同，重点防止 score runner 误改 `CardPlayed` zone 期望。 |
| Journey QA | 保留 `qa:similarity`，但总控不要并行抢端口。 |
| Mobile HUD | 当前三视口通过；后续只做短 token 微调。 |
| Producer synthesis | 不应只写“全绿”，必须记录并行 QA 端口风险和证据路径差异。 |

## 5. 文件审查范围

重点阅读/验证过：

- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/sim/world.ts`
- `prototype-web/src/sim/snapshot.ts`
- `prototype-web/src/sim/rewardChoices.ts`
- `prototype-web/src/sim/rewardProgression.ts`
- `prototype-web/src/sim/runModifiers.ts`
- `prototype-web/src/tests/sim/redline-lifecycle-v1.test.ts`
- `prototype-web/src/tests/sim/redline-similarity-journey.test.ts`
- `prototype-web/src/tests/sim/redline-competitor-similarity.test.ts`
- `prototype-web/src/tests/sim/redline-paper-shatter-topdeck.test.ts`
- `prototype-web/src/tests/sim/runtime.test.ts`
- `prototype-web/src/tests/ui/hud-target-selection.test.ts`
- `prototype-web/scripts/qa-lifecycle.mjs`
- `prototype-web/scripts/qa-similarity.mjs`
- `prototype-web/scripts/qa-ui.mjs`
- `prototype-web/package.json`
- `design/technical/redline-batches/long-task/2026-05-19-round-13-10-producer-synthesis.md`
- `design/technical/redline-batches/long-task/2026-05-19-round-13-06-qa-score-automation.md`

本文新增：

- `design/technical/redline-batches/long-task/2026-05-19-round-14-10-integration-review.md`
