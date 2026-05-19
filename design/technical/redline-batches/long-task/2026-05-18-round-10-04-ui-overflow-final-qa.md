# 2026-05-18 Round 10-04：UI 文字溢出最终 QA

角色：第 10 轮专家 04，UI 文字溢出最终 QA  
工作目录：`/Users/roc/Game-001`  
边界：只写本文档；不改源码、不提交、不回滚。  
用户硬约束：UI 体验不允许有文字超框；如果打开浏览器，验收后必须关闭网页。  

## 0. 发布裁决

当前结论：**不因 UI 文字超框阻塞发布**。

依据是 `prototype-web/scripts/qa-ui.mjs` 在桌面、390 移动、360 小屏三档视口均通过：页面级横向溢出为 `false`，文本 overflow finding 为 `0`，console error 为 `0`，`paper_shatter` 整备短 token `整备：顶终结` 可见，End Turn 仍可用，且脚本清理了页面、context、browser 和本次启动的 Vite server。

但这不是“以后可以放长文案”的豁免。当前通过依赖短 token 和固定白名单：手牌 rail 可横向滚动、奖励面板可内部滚动、combat feed 可 ellipsis。后续新增长中文/英文牌名、奖励规则、director 文案或 debug/raw token 时，仍必须跑同类 QA。

## 1. 本轮实际运行命令

```bash
cd /Users/roc/Game-001/prototype-web
npm run qa:ui
```

结果摘要：

| 项 | 结果 |
| --- | --- |
| QA 状态 | `pass` |
| Dev server | `http://127.0.0.1:5174`，脚本启动并拥有 |
| 桌面 `1366x768` | 横向溢出 `false`；文字 overflow `0`；console error `0` |
| 移动 `390x844` | 横向溢出 `false`；文字 overflow `0`；console error `0` |
| 小屏 `360x640` | 横向溢出 `false`；文字 overflow `0`；console error `0` |
| 整备场景 | `PayoffTopdecked` 先于 `HandDealt`；可见短 token `整备：顶终结` |
| 原始输出 | `outputs/browser-qa/round-09/qa-ui-result.json` |

浏览器/网页清理状态：

| 清理项 | 状态 |
| --- | --- |
| Page close | `ok: true`，关闭 3 个 page |
| Context close | `ok: true`，关闭 3 个 context |
| Browser close | `ok: true` |
| Server stop | `ok: true`，pid `90383` 已停止 |
| 残留检查 | `pidAlive: false`；`portListening: false` |

## 2. 静态审查要点

### 2.1 已守住的合同

- `body` 使用 `overflow: hidden`，因此页面不能靠 body 滚动兜底；当前 QA 未发现页面级横向滚动。
- 移动端 `<=640px` 下 `.card-row` 是横向 rail，允许卡牌在 rail 内横向滚动，不把页面撑宽。
- `.reward-panel` 有 `max-height` 和 `overflow: auto`，奖励态靠面板内部滚动兜底。
- `.combat-feed li`、`.director-cell strong/em`、`.deal-panel small`、手牌多数字段都有 ellipsis 保护。
- 移动端隐藏 `.combat-feed` 与 `.debug-panel`，玩家主读数由 status、director、deal panel、card button 承担。
- `combatEventLabel()` 对 `PayoffTopdecked` / `PayoffTopdeckMissed` 输出玩家可读短 token：`整备：顶终结` / `整备无牌`，未泄漏 `PayoffTopdecked`、`drawPile` 等 raw token。

### 2.2 仍需盯住的风险

- `.card-button` 容器自身在桌面样本中有 `scrollHeight 115 > clientHeight 100`，但容器 `overflow:hidden`，脚本未判为失败；当前子字段未超框。后续如果再加一行卡面信息，可能把低位支付状态挤掉。
- `Severance Burst`、`Red Ledger Burst`、`Wild Mana Stitch`、`Lantern Captain` 是当前最长英文卡名族群。本轮样本覆盖了 `Severance Burst`、`Wild Gap Key`、`Spark Tap`，未强制构造所有最长英文卡名同屏。
- `Debug Trace` 在桌面可见，但 raw token 黑名单只按 QA 选定 selector 做玩家可见文本扫描；后续如果 debug 面板默认展开或被移动端显示，必须重新判定。
- 奖励面板通过内部滚动兜底，但本轮脚本主要验证 reward panel 规则本身和 paper-topdeck 场景，未截图人工逐张审读全部 reward pool 的长 `rulesText`。

## 3. UI 验收镜头矩阵

以下 12 个镜头覆盖本轮要求的桌面、390 移动、360 小屏、卡牌按钮、战斗日志、奖励面板、director、deal panel、长中文/英文、debug/raw token 泄漏。

| # | 镜头 | 覆盖面 | 本轮结果 | 裁决 |
| ---: | --- | --- | --- | --- |
| 1 | 桌面初始/发牌后 HUD，`1366x768` | status、director、deal panel、combat feed、card row | QA：页面横向溢出 `false`，文本 overflow `0`，console error `0` | 通过 |
| 2 | 桌面 `paper_shatter` 整备后 | 战斗日志、整备结果、raw token | feed 可见 `整备：顶终结`；未显示 `PayoffTopdecked` / `drawPile` | 通过 |
| 3 | 桌面卡牌按钮：`Severance Burst` | 长英文、授权支付、终结 payoff | 样本文本含 `Severance Burst`、`授权付`、`意图 17->0`；子字段未报 overflow | 通过 |
| 4 | 桌面卡牌按钮：`Wild Gap Key` | 修补牌、缺 MP、短 token | 样本文本含 `修补`、`仍-17`、`缺MP1`；未报 overflow | 通过 |
| 5 | 桌面 deal panel | End Turn 后果、按钮文本 | 样本文本 `回合损17 · 可出牌 2`、按钮 `结束-17`；未报 overflow | 通过 |
| 6 | 桌面 director | director 四格、链路/意图/终结 | 样本 rect `420x133` 在 viewport 内；短句包含 `0>1>2`、`回合损17`、`Severance Burst x4` | 通过，但继续要求短 token |
| 7 | 移动 `390x844` HUD | 390 移动、card rail、隐藏日志/debug | QA：横向溢出 `false`，文本 overflow `0`，accepted rail/ellipsis 计数 `6` | 通过 |
| 8 | 移动 `390x844` 卡牌 rail | 卡牌按钮、横向 rail | 3 张卡 rect 超出 viewport 是 rail 内横向滚动，页面级横向溢出仍为 `false` | 通过 |
| 9 | 小屏 `360x640` HUD | 360 小屏、deal panel、director、card rail | QA：横向溢出 `false`，文本 overflow `0`，End Turn usable `true` | 通过 |
| 10 | 小屏 `360x640` 终结牌 | 长英文、授权付、压力读数 | `Severance Burst` 卡在 232px rail 卡宽内未触发子字段 overflow；`授权付` 可见 | 通过 |
| 11 | 奖励面板静态合同 | reward panel、reward card | CSS：`.reward-panel` `overflow:auto`，移动端单列；`.reward-card em` 小屏 2 行 clamp | 通过静态合同；建议补全 reward pool 全量镜头 |
| 12 | Debug/raw token 泄漏 | debug/raw token 黑名单 | QA 黑名单覆盖 `CardTopdecked`、`DeckSearchMissed`、`PayoffTopdecked`、`drawPile`、`candidateCardPool`、`undefined`、`NaN` 等；运行结果 0 泄漏 | 通过当前 selector 集 |

## 4. 阻塞项与建议

阻塞项：**无**。以当前 `qa-ui.mjs` 覆盖范围，UI 文字溢出不阻塞发布。

建议按优先级处理：

1. 把 `qa-ui.mjs` 的输出目录从 `round-09` 升级为可传参或当前轮次目录，避免后续 round 10/11 的证据继续写旧路径。
2. 增加“全 reward pool 长文案”构造态：至少强制出现 `Wild Mana Stitch`、`Lantern Captain`、`Red Ledger Burst`、`Paper Route` 三选一组合，并检查 `.reward-card strong/small/em`。
3. 增加 debug 面板展开态扫描：桌面允许 debug，但玩家可见区域不应泄漏 raw runtime token；移动端继续保持隐藏。
4. 对 `.card-button` 容器增加“关键支付状态未被裁掉”的语义断言。当前容器垂直内容被 `overflow:hidden` 接管时，子字段未溢出不等于信息一定完整。
5. 后续任何新增 UI 文案继续使用短 token：`授权付`、`缺MP1`、`整备：顶终结`、`整备无牌`、`抽3仍-17`，不要把完整规则句放进手牌、director、deal panel 或 combat feed。

## 5. 最终结论

本轮执行了现有浏览器 QA，并做了静态/脚本层复核。浏览器由脚本打开，已在结束时关闭；本次启动的网页和 dev server 也已停止。当前版本在已覆盖的桌面、390 移动和 360 小屏路径上，未发现 UI 文字超框、页面横向滚动、raw token 泄漏或浏览器残留。
