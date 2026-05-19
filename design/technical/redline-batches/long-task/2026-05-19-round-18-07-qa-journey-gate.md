# Round 18-07 QA Journey Gate

负责人：浏览器 QA 自动化工程师

范围：

- 只改 `prototype-web/scripts/qa-similarity.mjs`。
- 不改 `prototype-web/src` runtime / HUD。
- QA 只作门禁，输出仍使用 `gateScore`，不改成核心体验分。

## Gate 目标

第 18 轮新增 3-5 节点 journey gate，用浏览器自动化覆盖：

1. `reward -> route -> next battle` 至少循环多次。
2. 每个循环采集 build plan token。
3. 采集 route history，并验证节点推进顺序。
4. 采集压力可读性：HP 变化、结束回合按钮压力数字、回合后仍可操作。
5. 采集 UI overflow：页面级横向溢出、文本横向溢出、build plan surface 溢出。
6. 保留 cleanup：关闭 page / context / browser / owned Vite server，并做 pid / port residual check。

## 实现

`qa:similarity` 新增配置：

```bash
QA_JOURNEY_NODES=3..5
```

默认值为 `3`。脚本会在每个 viewport 内运行 `nodeCount - 1` 次循环。默认 3 节点会执行两次完整循环：

- Cycle 1：选择 `pulse_draw`，路线 `repair-cache`，进入节点 2。
- Cycle 2：选择 `wild_gap_key`，路线 `elite-pressure`，进入节点 3。

新增 JSON 字段：

- `journey`
- `routeHistory`
- `buildPlanTokens`
- `uiOverflow`
- `pressure.readability`

新增 gate：

- `gates.journeyGate`

`gateScore` 仍为 QA gate 分数，现在为 `qa-similarity-gate-32`。

## 本地验证结果

命令：

```bash
cd /Users/roc/Game-001/prototype-web
node --check scripts/qa-similarity.mjs
QA_ROUND=round-18-07 QA_JOURNEY_NODES=3 npm run qa:similarity
```

结果：

- `status`: `pass`
- `gateScore`: `32 / 32`
- 三个 viewport 全部 pass：`desktop`、`mobile-390`、`mobile-360`
- `journeyGate`: `pass`
- `rewardRouteFlow`: `pass`
- `buildPlanVisibility`: `pass`
- `noHorizontalOverflow`: `pass`
- `noConsoleErrors`: `pass`
- `browserCleanup`: `pass`

Cleanup：

- page close：ok，3 pages
- context close：ok，3 contexts
- browser close：ok
- owned server stop：ok
- residual pid alive：false
- residual port listening：false

输出文件：

```text
/Users/roc/Game-001/prototype-web/outputs/browser-qa/round-18-07/qa-similarity-result.json
```

## 备注

压力 feed 在当前 HUD 中会被后续发牌信息覆盖，因此本门禁把压力可读性建立在 HP loss、结束按钮压力数字和回合后可操作性上；`attackFeedRounds` 仍采集到 JSON 中，但不作为 blocker。
