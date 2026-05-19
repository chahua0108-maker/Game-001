# 2026-05-19 第13轮专家06：QA评分与自动化验收设计

角色：QA评分与自动化专家  
工作目录：`/Users/roc/Game-001`  
文件所有权：`design/technical/redline-batches/long-task/2026-05-19-round-13-06-qa-score-automation.md`  
边界：只写本文档；不改源码、不改测试、不提交、不回滚或覆盖其他工作者修改。  

## 0. 结论

第13轮验收不应再靠“测试都绿了”的口头判断，而应生成一份机器可读的 100 分 scorecard。

建议新增一个后续脚本入口：

```bash
cd /Users/roc/Game-001/prototype-web
QA_ROUND=round-13 npm run qa:round13
```

`qa:round13` 的职责不是替代现有命令，而是顺序运行并读取四类证据：

1. sim 合同测试：`npm run test:sim` 或指定 round-13 sim 文件。
2. `qa:similarity`：读取 3-5 回合相似度浏览器证据。
3. `qa:ui`：读取三视口 HUD / overflow / token 证据。
4. lifecycle tests：读取牌区生命周期 v1 的新增测试证据。

最终输出：

```text
prototype-web/outputs/qa-score/round-13/scorecard.json
prototype-web/outputs/qa-score/round-13/scorecard.md
```

通过规则：

- `score >= 90` 且所有 hard gate 通过，才算第13轮验收通过。
- 任一命令退出非 0，最终状态为 `fail`。
- 任一浏览器验收没有关闭 page / context / browser / 本轮启动的 dev server，最终状态不得为 `pass`。
- cleanup 失败时，即使功能证据全绿，也只能是 `functional-pass-cleanup-fail`，分数上限 79。
- 缺少任一证据文件时，分数上限 69。
- 使用外部 `QA_BASE_URL` 只能作为调试；正式第13轮验收必须由脚本启动并关闭自己的 Vite server。

## 1. 100分评分口径

| 模块 | 分值 | 自动证据来源 | 说明 |
| --- | ---: | --- | --- |
| sim 机制合同 | 35 | Vitest JSON / stdout 摘要 | 证明 runtime 合同没有被 lifecycle v1 破坏。 |
| `qa:similarity` | 25 | `qa-similarity-result.json` | 证明 3-5 回合玩家节奏、压力、Wild 延链、payoff、topdeck 仍成立。 |
| `qa:ui` | 20 | `qa-ui-result.json` | 证明真实 HUD 在三视口下可读、无超框、无 raw debug 泄漏。 |
| lifecycle tests | 20 | Vitest JSON / lifecycle suite 摘要 | 证明消耗、保留、状态污染、洗回、snapshot 和 restart 边界成立。 |

### 1.1 sim 机制合同 35分

| 子项 | 分值 | 自动判定 |
| --- | ---: | --- |
| 基础 sim suite 全通过 | 6 | `npm run test:sim` 退出码为 0，且失败测试数为 0。 |
| 0-1-2 链与授权合同 | 5 | `redline-competitor-similarity` / `redline-hyperturn` 中链路与授权相关用例通过。 |
| Wild MP3 延链合同 | 5 | `wild_gap_key` 仍为 printed cost 1、effective cost 3、`ChainExtended.extendedCost=3`。 |
| payoff 续燃与压力清算 | 5 | `severance_burst` 在延链后倍率不降级，且能减少或清除 intent damage。 |
| `paper_shatter` topdeck 合同 | 4 | 只搜 `drawPile`，`PayoffTopdecked` 先于 `HandDealt`，miss 仍正常抽牌。 |
| reward / run boundary | 4 | reward 进入 current run，restart 不吃 meta，不隐式加 Max MP。 |
| 失败 play 不半提交 | 3 | 死目标、缺费、同 tick end-turn 后输入不消耗能量、不移牌、不推进链。 |
| `advance-time` 不做实时战斗 | 3 | 敌方伤害只通过 `end-turn` / EnemyAttack 路径发生。 |

### 1.2 `qa:similarity` 25分

读取优先级：

```text
prototype-web/outputs/browser-qa/round-13/qa-similarity-result.json
outputs/browser-qa/round-13/qa-similarity-result.json
```

| 子项 | 分值 | 自动判定 |
| --- | ---: | --- |
| 三视口全部 pass | 4 | `results[].status === "pass"`，覆盖 desktop、mobile-390、mobile-360。 |
| 3-5 回合压力真实存在 | 4 | `pressureRoundCount` 在 3-5；`hpAfter < hpBefore`；run 未提前结束。 |
| 成功链 + Wild MP3 延链 | 4 | 每个 viewport 的 `assertions.wildMp3Extension === true`。 |
| payoff 续燃成立 | 3 | `assertions.payoffContinuationResolved === true` 且 HUD token 可见。 |
| topdeck 样片成立 | 3 | `assertions.paperTopdeckSample === true` 且 `paperTopdeckVisible === true`。 |
| 失败压力可读 | 3 | 有断链、未授权、未清意图或 HP 下降证据；不得显示“安全/已解决”。 |
| 相似度边界声明 | 2 | 报告必须写 `similarityScope="mechanic-slice-only"` 与 `notAFullClone=true`。 |
| 浏览器 cleanup | 2 | `cleanup.status === "pass"`，且 page/context/browser/server 证据完整。 |

### 1.3 `qa:ui` 20分

读取优先级：

```text
outputs/browser-qa/round-13/qa-ui-result.json
prototype-web/outputs/browser-qa/round-13/qa-ui-result.json
```

| 子项 | 分值 | 自动判定 |
| --- | ---: | --- |
| 三视口均有结果 | 3 | desktop、mobile-390、mobile-360 都存在结果。 |
| 无 console error | 3 | 每个 viewport `consoleErrorCount === 0`。 |
| 无页面横向 overflow | 4 | 每个 viewport `horizontalOverflowDetected === false`。 |
| 无文本超框 | 3 | 每个 viewport `textOverflowCount === 0`。 |
| 核心 token 可见 | 3 | topdeck、延链、续燃 token 仍可见；第13轮新增生命周期 token 也必须可见。 |
| End Turn / 手卡交互可用 | 2 | `endTurnStillUsable === true`，手牌按钮没有被遮挡或禁用误判。 |
| 浏览器 cleanup | 2 | `cleanup.status === "pass"`，server port 无残留。 |

### 1.4 lifecycle tests 20分

建议新增或读取的测试文件：

```text
prototype-web/src/tests/sim/card-lifecycle.test.ts
```

| 子项 | 分值 | 自动判定 |
| --- | ---: | --- |
| 牌区移动事件 | 3 | `CardMoved` 或等价事件包含 `cardId/from/to/reason/traceId/tick`。 |
| 消耗牌 | 3 | `onPlay=exhaust` 的牌进入 `exhaustPile`，不进 discard，不被洗回抽到。 |
| 保留牌 | 3 | `onTurnEnd=retain` 进入 retained zone，下回合先进 hand 且占手牌位。 |
| 状态/污染牌 | 3 | 状态牌占 draw/hand/discard 位置，可打出消耗或按 v1 规则清理。 |
| 洗回事件 | 3 | discard 回填 draw 时有洗回事件，且发生在 `CardDrawn/HandDealt` 前。 |
| reward / restart 边界 | 3 | reward 选择不保留旧手牌；restart 清空 `exhaustPile/retainedCards/status`。 |
| snapshot clone | 2 | 修改 snapshot 新区数组不污染原 world。 |

## 2. Hard Gates

这些不是加减分，而是通过门槛。

| Gate | 判定 | 失败后果 |
| --- | --- | --- |
| `GATE-COMMAND-EXIT` | 四类命令退出码均为 0。 | 总状态 `fail`。 |
| `GATE-EVIDENCE-FILES` | score runner 能读到 sim、similarity、ui、lifecycle 四类证据。 | 分数上限 69。 |
| `GATE-BROWSER-CLEANUP` | 两个浏览器验收都关闭 page/context/browser/server。 | 总状态不能是 `pass`，分数上限 79。 |
| `GATE-OWNED-SERVER` | 正式验收由脚本启动 own server，且停止 own server。 | 分数上限 79。 |
| `GATE-NO-RAW-TOKENS` | HUD 不泄漏内部事件名、reason enum、`undefined`、`NaN`、`[object Object]`。 | 对应 UI 分归零；严重时 fail。 |
| `GATE-NOT-FULL-CLONE` | similarity 报告声明不是完整复制竞品。 | `qa:similarity` 相似度边界分归零，分数上限 89。 |

## 3. 自动读取流程

建议 score runner 使用顺序执行，不并行抢端口：

```text
1. 清空或新建 prototype-web/outputs/qa-score/round-13/
2. 运行 sim tests，保存 vitest-sim.json 与 stdout。
3. 运行 lifecycle tests，保存 vitest-lifecycle.json 与 stdout。
4. 运行 QA_ROUND=round-13 npm run qa:similarity，读取 qa-similarity-result.json。
5. 运行 QA_ROUND=round-13 npm run qa:ui，读取 qa-ui-result.json。
6. 聚合 scorecard.json。
7. 输出 scorecard.md，列出失败镜头和下一步 owner。
8. 按最终状态设置 exit code。
```

正式验收不应复用外部 server：

```bash
unset QA_BASE_URL
QA_ROUND=round-13 npm run qa:similarity
QA_ROUND=round-13 npm run qa:ui
```

如果 preferred port 被占用，脚本可以使用下一个空闲端口，但必须记录：

```json
{
  "preferredPort": 5174,
  "actualPort": 5175,
  "preferredPortOccupied": true,
  "preferredPortOwnerAction": "left untouched"
}
```

严禁为了抢端口杀全局 `node`、`vite`、`Chrome`、`chromium`。只允许停止本轮脚本自己启动并记录 PID 的 server。

## 4. Scorecard Schema

建议最终 JSON：

```json
{
  "qaRound": "round-13",
  "status": "pass",
  "score": {
    "total": 100,
    "sim": 35,
    "similarity": 25,
    "ui": 20,
    "lifecycle": 20
  },
  "gates": {
    "commandExit": "pass",
    "evidenceFiles": "pass",
    "browserCleanup": "pass",
    "ownedServer": "pass",
    "noRawTokens": "pass",
    "notFullClone": "pass"
  },
  "commands": [
    {
      "name": "test:sim",
      "status": "pass",
      "exitCode": 0,
      "stdoutFile": "prototype-web/outputs/qa-score/round-13/test-sim.stdout.txt",
      "jsonFile": "prototype-web/outputs/qa-score/round-13/vitest-sim.json"
    }
  ],
  "browserEvidence": {
    "similarityResultFile": "prototype-web/outputs/browser-qa/round-13/qa-similarity-result.json",
    "uiResultFile": "outputs/browser-qa/round-13/qa-ui-result.json",
    "cleanup": {
      "similarity": "pass",
      "ui": "pass"
    }
  },
  "shots": [],
  "failures": [],
  "startedAt": "ISO-8601",
  "finishedAt": "ISO-8601",
  "durationMs": 0
}
```

`scorecard.md` 应给人读：

- 总分与状态。
- 四类模块分。
- hard gate 状态。
- 失败 QA 镜头，按 P0/P1 排序。
- 证据文件路径。
- cleanup 结果。

## 5. 新增断言清单

### 5.1 sim 新增断言

| ID | 断言 |
| --- | --- |
| `SIM-MOVE-EVENT-FIELDS` | 每次牌区移动都有 `cardId/from/to/reason/traceId/tick`。 |
| `SIM-FAILED-PLAY-NO-MOVE` | 失败出牌不产生 `CardMoved`、不扣 MP、不推进链。 |
| `SIM-PLAYED-DESTINATION` | `CardPlayed` 或等价事件能读到打出后 destination：discard/exhaust。 |
| `SIM-HANDDEALT-SOURCE` | `HandDealt` 能区分 round-start、card-draw、reward-next-hand。 |
| `SIM-RESHUFFLE-BEFORE-DRAW` | discard 洗回事件发生在 `CardDrawn/HandDealt` 前。 |
| `SIM-SELF-DRAW-GUARD` | 刚打出的自抽牌不能立刻从 discard 洗回抽到自己。 |
| `SIM-REWARD-NO-RETAIN` | reward 选择后旧手牌不因 retain 跨过节点切换。 |
| `SIM-RESTART-CLEARS-LIFECYCLE` | restart 后消耗、保留、状态污染区为空。 |

### 5.2 `qa:similarity` 新增断言

| ID | 断言 |
| --- | --- |
| `SIMILARITY-ROUND13-SCOPE` | 报告含 `similarityScope="mechanic-slice-only"`、`notAFullClone=true`。 |
| `SIMILARITY-BEATS-COVERED` | 至少覆盖开局读压、成功链、失败压力、topdeck、payoff、reward 或 lifecycle beat。 |
| `SIMILARITY-LIFECYCLE-TOKENS` | 第13轮新增生命周期短 token 在三视口可见：`耗`、`留`、`污`、`洗回` 至少命中本轮实现范围。 |
| `SIMILARITY-NO-SAFE-MISREAD` | 失败压力样片不得显示“安全”“已解决”“意图0”等误导文本。 |
| `SIMILARITY-SHOTS-RECORDED` | 报告中至少写入 10 个 shot 结果，每个有 `shotId/status/evidence`。 |

### 5.3 `qa:ui` 新增断言

| ID | 断言 |
| --- | --- |
| `UI-ZONE-COUNTER-FITS` | `抽/弃/耗/留` 计数在 desktop、390、360 下无超框。 |
| `UI-LIFECYCLE-CARD-TOKEN-FITS` | 卡牌按钮上的 `消耗/保留/污染` token 不挤出按钮。 |
| `UI-REWARD-PANEL-FITS` | reward 面板出现生命周期词时仍无横向 overflow。 |
| `UI-NO-RAW-LIFECYCLE-ENUM` | 不显示 `play-exhaust`、`turn-end-retain`、`status-node-purge` 等内部 enum。 |
| `UI-CLEANUP-STRICT` | page/context/browser/server close 均有 attempted/ok/count 或 pid/port 证据。 |

### 5.4 lifecycle 新增断言

| ID | 断言 |
| --- | --- |
| `LIFE-EXHAUST-NOT-RESHUFFLED` | 消耗牌不进入 discard，不参与洗回。 |
| `LIFE-RETAIN-OCCUPIES-HAND-SLOT` | 保留牌进入下一手并占手牌位，不额外扩手牌。 |
| `LIFE-STATUS-OCCUPIES-DRAW` | 状态/污染牌能占抽牌位和手牌位。 |
| `LIFE-STATUS-PURGE-NODE` | node-scoped 状态污染在节点结束或 restart 被清理。 |
| `LIFE-TOPDECK-STILL-DRAWPILE-ONLY` | 生命周期改动后 `paper_shatter` 仍不搜 discard/exhaust/retain。 |
| `LIFE-SNAPSHOT-CLONE-ZONES` | snapshot 的 `deck/exhaustPile/retainedCards/status` 修改不污染 world。 |

## 6. 浏览器关闭纪律

第13轮正式验收必须在 `finally` 中关闭资源，并把结果写入 JSON。关闭顺序：

1. `page.close()`：关闭每个 QA 创建的页面。
2. `context.close()`：关闭每个 QA 创建的 browser context。
3. `browser.close()`：关闭本轮启动的 Playwright browser。
4. `server.stop()`：停止本轮脚本启动的 Vite dev server。
5. residual check：确认 server PID 不存活、QA port 不再监听。

必须记录：

```json
{
  "cleanup": {
    "status": "pass",
    "pageClose": { "attempted": true, "ok": true, "count": 3 },
    "contextClose": { "attempted": true, "ok": true, "count": 3 },
    "browserClose": { "attempted": true, "ok": true },
    "serverStop": { "attempted": true, "ok": true, "owned": true, "pid": 12345, "port": 5174 },
    "residualCheck": { "pidAlive": false, "portListening": false }
  }
}
```

判定细则：

- cleanup 字段缺失：`GATE-BROWSER-CLEANUP=fail`。
- `pageClose.ok=false`：总状态不得 pass。
- `browserClose.ok=false`：总状态不得 pass。
- `serverStop.owned=true` 且 `serverStop.ok=false`：总状态不得 pass。
- `residualCheck.pidAlive=true` 或 `portListening=true`：总状态不得 pass。
- 如果 `server.owned=false`，正式第13轮只允许作为 debug 证据，不允许作为最终验收 pass。

## 7. 至少10个QA镜头

第13轮 scorecard 至少记录以下 14 个镜头；前 12 个建议作为 P0，后 2 个作为交付完整性。

| # | shotId | 来源 | 分值归属 | 必须断言 |
| ---: | --- | --- | --- | --- |
| 1 | `SHOT-BOOT-DESKTOP` | `qa:ui` | UI | desktop 打开后 `#hud .status-strip` 可见，console error 为 0。 |
| 2 | `SHOT-BOOT-MOBILE-390` | `qa:ui` | UI | 390 视口无横向 overflow，End Turn 可见且可用。 |
| 3 | `SHOT-BOOT-MOBILE-360` | `qa:ui` | UI | 360 视口无文本超框，手牌 rail 不压住关键按钮。 |
| 4 | `SHOT-PRESSURE-3-ROUNDS` | `qa:similarity` | Similarity | 3 回合不处理压力后 HP 明确下降，但 run 未提前结束。 |
| 5 | `SHOT-CHAIN-012` | sim | Sim | `0 -> 1 -> 2` 产生递增倍率并触发本回合授权。 |
| 6 | `SHOT-WILD-MP3-EXTEND` | sim + `qa:similarity` | Sim / Similarity | `wild_gap_key` printed cost 1、effective cost 3、`ChainExtended.extendedCost=3`。 |
| 7 | `SHOT-PAYOFF-CONTINUATION` | sim + `qa:ui` | Sim / UI | `severance_burst` 延链后续燃，HUD 显示短 token，不显示内部事件名。 |
| 8 | `SHOT-PAPER-TOPDECK` | sim + `qa:ui` | Sim / UI | `PayoffTopdecked` 先于 `HandDealt`，HUD 显示 `整备：顶终结`。 |
| 9 | `SHOT-FAILURE-READABLE` | `qa:similarity` | Similarity | 断链或缺授权样片可读，不显示“安全/已解决”。 |
| 10 | `SHOT-REWARD-CURRENT-RUN` | sim | Sim | reward 进入当前 run，select 后进入下一手或 deck/draw 顶，不污染 meta。 |
| 11 | `SHOT-EXHAUST-LIFECYCLE` | lifecycle | Lifecycle | 消耗牌进入 `exhaustPile`，不进 discard，不被洗回。 |
| 12 | `SHOT-RETAIN-LIFECYCLE` | lifecycle + `qa:ui` | Lifecycle / UI | 保留牌进入下一手并占位，HUD token `保留/留` 无超框。 |
| 13 | `SHOT-STATUS-POLLUTION` | lifecycle + `qa:ui` | Lifecycle / UI | 状态/污染牌占抽牌和手牌位，清理后不跨 restart。 |
| 14 | `SHOT-CLEANUP-CLOSED` | `qa:similarity` + `qa:ui` | Hard gate | page/context/browser/server 均关闭，PID 和端口无残留。 |

每个 shot 在 JSON 中建议长这样：

```json
{
  "shotId": "SHOT-WILD-MP3-EXTEND",
  "status": "pass",
  "source": ["vitest-sim", "qa-similarity"],
  "evidence": {
    "traceId": "qa-sim-wild-3",
    "eventType": "ChainExtended",
    "extendedCost": 3,
    "multiplier": 4
  },
  "scoreContribution": 4
}
```

## 8. 最小实现顺序建议

1. 先补 lifecycle sim 测试，让 `card-lifecycle.test.ts` 产出稳定证据。
2. 给 `qa:similarity` 补 `round-13` scope、shot list、lifecycle token 检查。
3. 给 `qa:ui` 补 zone counter / lifecycle token / raw enum 检查。
4. 新增 score runner，只做命令编排、证据读取、打分、写 JSON/MD。
5. 最后跑正式验收，确认 cleanup 后没有页面和 server 残留。

## 9. 本轮不做

- 不把 score runner 变成 CI 系统。
- 不新增截图像素比对。
- 不做 Playwright Test runner 迁移。
- 不以人工截图替代 JSON 证据。
- 不允许用外部常驻 server 作为最终通过证据。
- 不复制竞品卡名、文案、美术、UI 构图或完整数值模板。

STATUS: DONE
