# 2026-05-19 第14轮-05 自动化QA/浏览器验收专家

角色：自动化 QA / 浏览器验收专家  
工作目录：`/Users/roc/Game-001`  
范围：强化 `prototype-web/scripts` 下 `qa:lifecycle`、`qa:similarity`、`qa:ui` 的机器可读输出。  
边界：不改 sim runtime 逻辑，不回滚其他 agent 改动。

## 0. 结论

本轮已把三个浏览器 QA 入口的输出统一补强为可被 100 分制读取的结构：

- `cleanup.pageClose`
- `cleanup.contextClose`
- `cleanup.browserClose`
- `cleanup.serverStop`
- `cleanup.pidAlive`
- `cleanup.portListening`
- `gates`
- `score`

关键变化是：`pidAlive` 和 `portListening` 不再只藏在 `cleanup.residualCheck` 里，而是作为 `cleanup` 顶层字段稳定输出。旧字段 `cleanup.residualCheck` 保留，避免破坏前几轮已经生成的读取方式。

## 1. 修改文件

### `prototype-web/scripts/qa-lifecycle.mjs`

新增：

- `report.gates`
- `report.score`
- `cleanup.pidAlive`
- `cleanup.portListening`
- `buildGates(report)`
- `buildScore(report)`

当前评分口径为 `qa-lifecycle-20`，用于第13轮生命周期 v1 的 20 分模块：

| 子项 | 分值 |
| --- | ---: |
| 三视口存在 | 2 |
| lifecycle supported | 4 |
| `CardMoved` 可读 | 3 |
| lifecycle zone count 变化 | 3 |
| lifecycle HUD token 可读 | 3 |
| 无 UI 回归 | 3 |
| browser cleanup | 2 |

### `prototype-web/scripts/qa-similarity.mjs`

新增：

- `similarityScope: "mechanic-slice-only"`
- `notAFullClone: true`
- `report.gates`
- `report.score`
- `cleanup.pidAlive`
- `cleanup.portListening`

当前评分口径为 `qa-similarity-25`：

| 子项 | 分值 |
| --- | ---: |
| 三视口全部 pass | 4 |
| 3 回合压力 journey | 4 |
| Wild MP3 extension | 4 |
| payoff continuation | 3 |
| paper topdeck | 3 |
| failure pressure readable | 3 |
| scope boundary | 2 |
| browser cleanup | 2 |

`failurePressureReadable` 使用现有 QA 证据：`failurePressureVisible === true`、`hpLost > 0`、每轮 End Turn 按钮出现 `结束-N` 标签。没有改动 sim 逻辑。

### `prototype-web/scripts/qa-ui.mjs`

新增：

- `name: "qa-ui"`
- `qaRound`
- `config`
- `report.gates`
- `report.score`
- `cleanup.pidAlive`
- `cleanup.portListening`

当前评分口径为 `qa-ui-20`：

| 子项 | 分值 |
| --- | ---: |
| 三视口存在 | 3 |
| 无 console error | 3 |
| 无水平 overflow | 4 |
| 无文本 overflow | 3 |
| 核心 token 可见 | 3 |
| End Turn 交互可用 | 2 |
| browser cleanup | 2 |

## 2. 最新验收

语法检查执行目录：`/Users/roc/Game-001`

```bash
node --check prototype-web/scripts/qa-lifecycle.mjs
node --check prototype-web/scripts/qa-similarity.mjs
node --check prototype-web/scripts/qa-ui.mjs
```

QA 执行目录：`/Users/roc/Game-001/prototype-web`

```bash
QA_ROUND=round-14 npm run qa:lifecycle
QA_ROUND=round-14 npm run qa:similarity
QA_ROUND=round-14 npm run qa:ui
```

结果：

| 入口 | JSON | status | score | cleanup |
| --- | --- | --- | ---: | --- |
| `qa:lifecycle` | `prototype-web/outputs/browser-qa/round-14/qa-lifecycle-result.json` | `pass` | `20 / 20` | `pass` |
| `qa:similarity` | `prototype-web/outputs/browser-qa/round-14/qa-similarity-result.json` | `pass` | `25 / 25` | `pass` |
| `qa:ui` | `outputs/browser-qa/round-14/qa-ui-result.json` | `pass` | `20 / 20` | `pass` |

三个 JSON 的 cleanup 均包含：

```json
{
  "pageClose": { "ok": true },
  "contextClose": { "ok": true },
  "browserClose": { "ok": true },
  "serverStop": { "ok": true, "owned": true },
  "pidAlive": false,
  "portListening": false,
  "status": "pass"
}
```

额外执行：

```bash
lsof -nP -iTCP:5174 -sTCP:LISTEN || true
```

输出为空，说明本轮 QA 自己启动的 Vite server 已关闭，没有 5174 监听残留。

## 3. 对 100 分制的支撑方式

后续总分聚合器可以直接读取：

```text
qa-lifecycle-result.json.score.total / score.max
qa-similarity-result.json.score.total / score.max
qa-ui-result.json.score.total / score.max
```

也可以只读 hard gate：

```text
gates.commandExit
gates.browserCleanup
gates.ownedServer
cleanup.status
cleanup.pidAlive
cleanup.portListening
```

建议总分聚合规则：

- 只要任一浏览器 QA 的 `cleanup.status !== "pass"`，总状态不得为 `pass`。
- 只要任一正式 QA 的 `cleanup.pidAlive === true` 或 `cleanup.portListening === true`，总状态不得为 `pass`。
- 使用 `QA_BASE_URL` 的调试输出不得作为正式验收满分证据，因为脚本不会停止外部 server。

## 4. 风险与后续

1. `qa-ui` 仍输出到 repo 根目录 `outputs/browser-qa/...`，而 `qa:lifecycle` / `qa:similarity` 输出到 `prototype-web/outputs/browser-qa/...`。本轮没有改路径，避免破坏前几轮文档引用；聚合器需要兼容两处路径。
2. `prototype-web/scripts` 当前在 git 状态里是未跟踪目录，本轮只在现有脚本基础上增强输出，没有清理或重写目录结构。
3. 如后续要做 `qa:score` 总入口，应只负责顺序运行和聚合三个 JSON，不应把浏览器生命周期逻辑再复制一遍。

STATUS: DONE
