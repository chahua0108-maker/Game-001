# 2026-05-19 第12轮专家06：`qa:similarity` 最小自动验收方案

角色：自动化 QA 架构师  
工作目录：`/Users/roc/Game-001`  
文件所有权：`design/technical/redline-batches/long-task/2026-05-19-round-12-06-qa-similarity-automation.md`  
边界：只写本文档；不改源码、不提交、不回滚。  
审查对象：`prototype-web/scripts/qa-ui.mjs`、`prototype-web/package.json`、`prototype-web/src/tests/sim/**`、`prototype-web/src/tests/ui/hud-target-selection.test.ts`

## 0. 结论

建议新增 `qa:similarity` 作为“机制合同 + 真实 HUD 验收”的最小总入口，而不是把所有断言塞进现有 `qa:ui`。

最小方案：

```json
{
  "qa:similarity": "vitest run src/tests/sim/redline-competitor-similarity.test.ts src/tests/sim/redline-paper-shatter-topdeck.test.ts src/tests/sim/reward-branching.test.ts src/tests/sim/redline-progression-card-system.test.ts src/tests/ui/hud-target-selection.test.ts && QA_SCENARIO=similarity QA_ROUND=round-12 node scripts/qa-ui.mjs"
}
```

后半段复用 `qa-ui.mjs` 现有能力：自动找端口、启动 Vite、加载 Playwright、三视口检查、输出 `outputs/browser-qa/<QA_ROUND>/qa-ui-result.json`、最后关闭 page/context/browser/server 并检查残留。首版只需要给 `qa-ui.mjs` 加一个 `similarity` 场景分支，不需要引入 Playwright Test runner。

## 1. 当前基础

### `qa-ui.mjs` 已有能力

- 默认三视口：`1366x768`、`390x844`、`360x640`。
- 支持 `QA_PORT`、`QA_BASE_URL`、`QA_ROUND`。
- 自动启动 Vite，或连接外部 base URL。
- 在浏览器内 `import('/src/sim/world.ts')`、`runtime.ts`、`snapshot.ts`、`hud.ts`，可直接构造确定性世界并渲染 HUD。
- 已有 `paper_shatter` 顶终结样片和 `wild_gap_key` 延链样片。
- 已有 DOM probe：页面横向溢出、元素出框、文本 overflow、raw debug token 泄漏、End Turn 可用性。
- 已有 cleanup report：page/context/browser/server 关闭、PID 和端口残留检查。

### sim/ui 测试已覆盖的合同

- `redline-competitor-similarity.test.ts`：`wild_gap_key` 能在 `0 -> 1 -> 2` 后按 printed cost 1 支付，但以 effective cost 3 延链到 x4；`wild_mana_stitch` 不得修补 MP3；断链后 Wild 不得伪修补；payoff 在 Wild 延链后不降级。
- `redline-paper-shatter-topdeck.test.ts`：`paper_shatter` 只搜 drawPile、先 topdeck 再 draw、miss 也照常抽、不搜 discardPile、授权 payoff 不回归。
- `reward-branching.test.ts`：奖励选择按 repair/resource、payoff、route/bridge 分支分配，而不是直接取池子前三张。
- `redline-progression-card-system.test.ts`：奖励只进入当前 run，不变成 meta；授权只支付 payoff；Wild 修补与 payoff 清意图合同存在。
- `hud-target-selection.test.ts`：HUD helper 已有 `延MP3x4`、`续燃x5`、奖励/局外层文案边界。

## 2. `qa:similarity` 的职责边界

`qa:similarity` 不证明“完整复刻竞品”，只证明当前切片的相似度关键结构没有坏：

- 升序链路能形成可见倍率曲线。
- Wild 能作为受控延链，而不是任意万能修补。
- payoff 继承延链价值，且能响应敌人压力。
- 奖励回应战斗结果，并只作用于当前 run。
- 失败压力可读：断链、未武装、miss 不应显示成安全或成功。
- 真实 HUD 在三视口下不超框、不泄漏 raw token、不残留浏览器/server。

最终报告必须固定写：

```json
{
  "similarityScope": "mechanic-slice-only",
  "notAFullClone": true
}
```

只要 `notAFullClone !== true`，最终状态不得为 `pass`。

## 3. 3-5 回合确定性世界

首版建议用 4 个确定性回合/阶段。全部在浏览器 `page.evaluate()` 内构造，使用现有 `createInitialWorld()`、`tickWorld()`、`buildSnapshot()`、`new Hud(root, ...)`。

### 回合 0：启动与发牌基线

目的：证明真实 app 可加载，HUD 初始状态可读。

设置：

- `createInitialWorld()`。
- `tickWorld([{ type: 'advance-time', deltaSeconds: 0.016, traceId: 'similarity-deal' }])`。
- 敌人全部保活，避免 setup 中被误杀。
- 渲染 `buildSnapshot(world)`。

验收：

- `#hud .status-strip` 可见。
- `combat-director`、`deal-panel`、`card-row`、`combat-feed` 可被 DOM probe 扫到。
- 无 console error、无 raw token、无横向页面溢出。

### 回合 1：Wild 延链成功 + payoff 响应压力

目的：覆盖 Wild 延链、payoff 不降级、敌人压力被回应。

设置：

```text
energy/maxEnergy = 4
hand = debt_hook, redline_cut, row_cleave, wild_gap_key, severance_burst
drawPile = []
discardPile = []
enemies hp/maxHp = 200
enemyIntentSummary 保持默认有伤害压力
```

动作：

```text
debt_hook      traceId similarity-success-0 target enemy-1
redline_cut    traceId similarity-success-1 target enemy-2
row_cleave     traceId similarity-success-2
wild_gap_key   traceId similarity-success-wild target enemy-3
severance_burst traceId similarity-success-payoff
```

机制验收：

- `wild_gap_key` 的 `CardPlayed` 包含 `printedCost=1`、`currentEnergyPaid=1`、`effectiveCost=3`、`effectMultiplier=4`、`chainExtended=true`、`extendedCost=3`。
- `similarity-success-wild` 出现 `ChainExtended`，且不出现 `ChainRepaired`。
- `severance_burst` 的 `effectMultiplier >= 4`。
- `PayoffTriggered` 或 `PayoffResolved` 标记 enhanced/payoff armed。
- `PayoffResolved.preventedIntentDamage > 0`，或 `intentDamageAfter < intentDamageBefore`。

HUD 验收：

- 可见 `延链MP3` 或 `延MP3x4`。
- 可见 `续燃x5` 或等价 payoff continuation token。
- 可见授权/终结/意图响应的短文案，不允许显示内部事件名。

### 回合 2：奖励响应

目的：证明战斗结果能生成奖励，奖励有分支，选择后只影响当前 run。

设置：

```text
reward.xpThreshold = 1
reward.candidateCardPool = wild_gap_key, wild_mana_stitch, blood_tithe, severance_burst, paper_shatter, spark_tap
reward.pickCount = 3
enemy-1.hp = cards.debt_hook.damage
hand = debt_hook
```

动作：

```text
debt_hook traceId similarity-reward-kill target enemy-1
select-reward traceId similarity-reward-select cardId first visible reward choice
```

机制验收：

- 出现 `RewardChoicesGenerated`。
- `reward.choices.length === 3`。
- 三个选择至少覆盖 repair/resource、payoff、route/bridge 中的两个；如果复用 `reward-branching` 的严格合同，则覆盖三个。
- `fsm.gameFlow === 'Reward'` 时 reward panel 可见。
- `select-reward` 后回到 `PlayerTurn`。
- 被选卡进入当前 run 的 `deck` 或 `hand`，但 `maxEnergy` 不变，且报告写明不是永久 meta。

HUD 验收：

- `.reward-panel` 可见。
- `.reward-card` 文案无超框。
- `run-layer-panel` 显示最近奖励或奖励记录，不出现“永久升级”“最大 MP +3”。

### 回合 3：失败压力样片

目的：失败不是脚本失败，而是证明断链/未武装/压力残留可读。

设置：

```text
energy/maxEnergy = 3
hand = debt_hook, row_cleave, wild_gap_key, severance_burst
drawPile = spark_tap
discardPile = []
enemies hp/maxHp = 200
```

动作：

```text
debt_hook traceId similarity-fail-0 target enemy-1
row_cleave traceId similarity-fail-break
wild_gap_key traceId similarity-fail-wild target enemy-2
severance_burst traceId similarity-fail-payoff
end-turn traceId similarity-fail-end
```

机制验收：

- `row_cleave` 可出牌但 `effectMultiplier=1`，并导致 `world.chain.broken === true`。
- `wild_gap_key` 不出现 `ChainExtended`，也不出现 `ChainRepaired`。
- `severance_burst` 不得显示为 armed payoff；若资源不足，应在 `failedConditions` 中记录 `enough-energy` 或等价失败条件。
- end turn 后敌人压力必须有结果：玩家 HP 下降，或 HUD 的 intent/pressure token 仍显示未解决。

HUD 验收：

- 可见 `断x1`、`会断链`、`未武装`、`仍-X`、`缺授权` 中至少一种失败解释。
- 不允许出现 `安全`、`已解决`、`意图 0` 这类误导文案。
- 不允许 raw `failedConditions`、`ChainExtended`、`PayoffResolved` 泄漏。

## 4. 至少 10 个断言镜头

首版 P0 建议 14 个镜头，前 12 个必须全绿，后 2 个用于报告完整性。

| # | 镜头 | 类型 | 必须断言 |
| ---: | --- | --- | --- |
| 1 | 启动基线 | browser | `status-strip` 可见；`consoleErrorCount=0`；页面无横向 overflow。 |
| 2 | 初始发牌 | browser + sim | `deal` 后手牌/牌堆非空且 HUD card rail 可读；End Turn 按钮可用。 |
| 3 | 升序链前 3 段 | sim | `debt_hook/redline_cut/row_cleave` 的 `effectMultiplier` 至少形成 `1,2,3`。 |
| 4 | Wild 延链事件 | sim | `similarity-success-wild` 出现 `ChainExtended`，`extendedCost=3`、`multiplier=4`。 |
| 5 | Wild 支付边界 | sim | `wild_gap_key` 为 `printedCost=1/currentEnergyPaid=1/effectiveCost=3`，不是免费 MP3。 |
| 6 | Wild 不是普通修补 | sim | 成功延链样片中不出现 `ChainRepaired`；失败样片中也不得伪修补。 |
| 7 | payoff 不降级 | sim | `severance_burst.effectMultiplier >= 4`，且 payoff enhanced/armed。 |
| 8 | 压力被回应 | sim + HUD | `preventedIntentDamage > 0` 或 `intentDamageAfter < intentDamageBefore`；HUD 有短 token 表达。 |
| 9 | 奖励生成 | sim | `RewardChoicesGenerated.choices.length === 3`，奖励池不是直接前三张。 |
| 10 | 奖励选择只进当前 run | sim + HUD | 选卡后回到 `PlayerTurn`；`maxEnergy` 不变；不显示永久 meta。 |
| 11 | 断链失败弱化 | sim | 跳过 MP1 后 `row_cleave.effectMultiplier=1`，无 `AuthorizationGranted`。 |
| 12 | 失败压力可读 | browser | 失败样片显示断链/缺授权/仍有压力，不显示安全或已解决。 |
| 13 | UI 无超框 | browser | 三视口所有阶段 `horizontalOverflowDetected=false`、`textOverflowCount=0`。 |
| 14 | cleanup | process | `cleanup.status=pass`，owned server 的 `pidAlive=false`、`portListening=false`。 |

通过门槛：

- 镜头 1-14 全部 pass，最终 `status=pass`。
- 机制镜头 pass 但 UI overflow 或 cleanup fail，最终不得 pass。
- UI pass 但任一机制镜头 fail，最终不得 pass。
- 失败样片没有失败解释，也算 fail；失败样片不是 optional。

## 5. 失败报告字段

建议 `qa-ui-result.json` 在 `QA_SCENARIO=similarity` 时新增 `similarity` 节点。失败报告字段至少包含以下内容：

```json
{
  "status": "pass|fail|failed-before-cleanup|functional-pass-cleanup-fail|functional-fail-cleanup-fail",
  "qaScenario": "similarity",
  "qaRound": "round-12",
  "similarityScope": "mechanic-slice-only",
  "notAFullClone": true,
  "startedAt": "ISO-8601",
  "finishedAt": "ISO-8601",
  "durationMs": 0,
  "command": "npm run qa:similarity",
  "server": {
    "url": "http://127.0.0.1:5174",
    "owned": true,
    "pid": 0,
    "port": 5174,
    "preferredPort": 5174
  },
  "viewports": [
    {
      "name": "mobile-360",
      "width": 360,
      "height": 640,
      "phaseResults": []
    }
  ],
  "assertions": [
    {
      "assertionId": "SIM-WILD-EXTENDS-MP3",
      "phase": "success-wild-extension",
      "status": "pass|fail",
      "severity": "blocker|major|minor|info",
      "ruleId": "WILD_GAP_EXTENDS_COST_3",
      "traceIds": ["similarity-success-wild"],
      "expected": {
        "eventType": "ChainExtended",
        "extendedCost": 3,
        "multiplier": 4
      },
      "actual": {},
      "message": "human-readable failure summary"
    }
  ],
  "mechanicEvidence": {
    "events": [],
    "commands": [],
    "failedConditions": [],
    "snapshots": []
  },
  "rewardEvidence": {
    "choices": [],
    "selectedCardId": null,
    "deckAfterSelect": [],
    "handAfterSelect": [],
    "maxEnergyAfterSelect": 3
  },
  "pressureEvidence": {
    "intentDamageBefore": 0,
    "intentDamageAfter": 0,
    "preventedIntentDamage": 0,
    "playerHpBeforeEndTurn": 0,
    "playerHpAfterEndTurn": 0
  },
  "uiEvidence": {
    "visibleTokens": [],
    "forbiddenTokens": [],
    "rawTokenMatches": [],
    "consoleErrors": [],
    "overflowFailures": [],
    "samples": []
  },
  "failureScreenshots": [
    {
      "phase": "failure-pressure",
      "viewport": "mobile-360",
      "path": "outputs/browser-qa/round-12/failure-pressure-mobile-360.png"
    }
  ],
  "cleanup": {
    "status": "pass|fail",
    "pageClose": {},
    "contextClose": {},
    "browserClose": {},
    "serverStop": {},
    "residualCheck": {
      "pidAlive": false,
      "portListening": false
    }
  },
  "reproduction": {
    "cwd": "/Users/roc/Game-001/prototype-web",
    "command": "QA_SCENARIO=similarity QA_ROUND=round-12 npm run qa:ui"
  }
}
```

字段要求：

- `assertionId` 必须稳定，便于后续趋势对比。
- `phase` 必须来自固定枚举：`boot`、`success-wild-extension`、`reward-response`、`failure-pressure`、`cleanup`。
- `expected` 和 `actual` 必须保留结构化值，不能只写自然语言。
- `traceIds` 必须能回到 `world.debug.events/commands/failedConditions`。
- DOM 失败必须带 `selector/index/text/metrics`，复用当前 `inspectPage()` 的 metrics 结构。
- cleanup 失败必须独立记录；不能被机制 pass 覆盖。

## 6. UI 无超框规则

`qa:similarity` 复用现有 selector 列表，并新增相似度重点 selector：

```text
.chain-preview
.card-intent-preview
.card-payoff
.reward-panel
.reward-card
.run-layer-panel
.combat-feed
.director-cell
```

硬门槛：

- `document.scrollWidth <= document.clientWidth + 1`。
- 非 `.card-row` 元素不得横向出 viewport。
- `.card-row` 允许横向 rail，但必须 `overflow-x: auto|scroll` 且自身在 viewport 内。
- `.reward-panel` 允许内部纵向 scroll，但不得横向超框。
- 文本横向 overflow 只有在 `overflow:hidden + text-overflow:ellipsis` 时可 accepted。
- raw token 黑名单继续启用：`ChainExtended`、`PayoffTopdecked`、`drawPile`、`failedConditions`、`undefined`、`NaN`、`[object Object]` 等不得出现在玩家可见文本里。

建议新增相似度可见 token 白名单：

```text
延链MP3
延MP3x4
续燃x5
终结
授权付
断x1
会断链
未武装
仍-
最近奖励
```

## 7. cleanup 纪律

现有 `qa-ui.mjs` 的 cleanup 结构应继续作为硬门槛：

- 逐个关闭 page。
- 逐个关闭 context。
- 关闭 browser。
- 如果 server 为脚本启动，则先 `SIGTERM` 进程组，超时再 `SIGKILL`。
- 检查 `pidAlive` 和 `portListening`。

状态分类建议保持现有语义：

| 机制/UI | cleanup | 最终状态 |
| --- | --- | --- |
| pass | pass | `pass` |
| pass | fail | `functional-pass-cleanup-fail` |
| fail | pass | `fail` |
| fail | fail | `functional-fail-cleanup-fail` |
| setup throw | cleanup attempted | `failed-before-cleanup` 后再按 cleanup 改最终分类 |

这条是阻断项：cleanup fail 不能作为 warning。

## 8. 最小实施切片

后续实现时建议只做 5 个小改动：

1. 在 `package.json` 新增 `qa:similarity`，先串联现有 sim/ui 合同和浏览器验收。
2. 给 `qa-ui.mjs` 增加 `QA_SCENARIO=similarity` 分支，默认 `qa:ui` 行为不变。
3. 提取 4 个浏览器内 scenario builder：`buildSimilarityBootHud`、`buildSimilarityWildPayoffHud`、`buildSimilarityRewardHud`、`buildSimilarityFailureHud`。
4. 把每个 scenario 的机制断言写入统一 `assertions[]`，而不是只写布尔字段。
5. 失败时为每个 viewport/phase 保存截图，并在 JSON 中写 `failureScreenshots[]`。

不要在首版做：

- 不要上 Playwright Test runner。
- 不要并行多 worker。
- 不要引入 CI 平台依赖。
- 不要生成主观“相似度分数”。
- 不要把失败样片当测试失败跳过；失败样片本身必须被正向验收。

## 9. 最小验收命令

本地预期入口：

```bash
cd /Users/roc/Game-001/prototype-web
npm run qa:similarity
```

预期产物：

```text
outputs/browser-qa/round-12/qa-ui-result.json
outputs/browser-qa/round-12/*.png
```

首版通过定义：

- sim 合同文件全部通过。
- 三视口 browser 场景全部通过。
- 14 个断言镜头全部通过。
- `similarityScope=mechanic-slice-only`。
- `notAFullClone=true`。
- `cleanup.status=pass`。
