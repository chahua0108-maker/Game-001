# 2026-05-18 第 9 轮专家 10：Producer Synthesis

角色：第 9 轮专家 10，Producer Synthesis  
工作目录：`/Users/roc/Game-001`  
输出边界：本文只新增 Markdown；不改源码、不提交 git、不回滚或覆盖其他工作者改动。  
主题：裁决第 9 轮自动化验收最小落地范围，避免把 QA 脚本做成大工程，并给第 10 轮交接。

## 0. 读取基线

第 8 轮已经完成 `paper_shatter` 极窄置顶样片，并留下清晰交接：

- 机制范围已经锁死：只做 `paper_shatter`、只搜 `drawPile`、只找 payoff、只移动一张到 `drawPile[0]`。
- 已通过 sim、全量测试、build 和三档浏览器验收。
- 浏览器验收覆盖 `1366x768`、`390x844`、`360x640`，并确认 `整备：顶终结` 不超框。
- 第 9 轮交接不是继续扩 `reorder`，而是把手工 QA 流程自动化。

所以第 9 轮的制作问题不是“能不能建立完整 QA 框架”，而是：

```text
能不能用最少脚本，把第 8 轮已经证明过的关键路径变成可重复、可读、可失败定位的验收证据。
```

## 1. 制作人裁决

第 9 轮要落地自动化验收，但只落最小范围。

本轮做：

```text
一个可重复运行的浏览器验收脚本，固定 desktop / 390 / 360 三档视口，
验证 paper_shatter 顶终结可见、无 console error、无真实文字超框，并输出一份短 JSON/Markdown 证据。
```

本轮不做：

```text
不做 QA 平台、不做截图基线系统、不做视觉 diff 服务、不做通用 bot runner、
不做跨浏览器矩阵、不做完整录像系统、不做 CI 接入、不做 flaky retry 框架。
```

裁决理由：

第 8 轮真正需要被保护的是一个窄路径：`paper_shatter -> PayoffTopdecked -> HandDealt -> HUD 短反馈 -> 小屏不炸`。如果第 9 轮把目标升级成通用 QA 工程，会消耗实现窗口，并把测试本身变成新的维护对象。现在更需要的是一个可以每天跑、失败时能看懂的验收钉子。

## 2. 本轮允许范围

### 2.1 自动化脚本允许

- 新增一个专用浏览器验收脚本，优先放在现有 `prototype-web` 测试或脚本目录的本地习惯位置。
- 脚本可以启动本地 dev server，也可以复用已启动 server；但必须记录端口和清理状态。
- 脚本覆盖三档视口：
  - `1366x768`
  - `390x844`
  - `360x640`
- 脚本必须能进入一个确定性 `paper_shatter` 场景；可使用现有测试入口、fixture、URL 参数或测试专用状态注入。
- 脚本必须验证真实 UI 结果，而不是只读 sim 单测：
  - 页面无 console error。
  - `paper_shatter` 可见或对应玩家文案可见。
  - 顶终结成功或 miss 结果以短 token 可见。
  - 页面没有水平溢出。
  - 关键文本没有跑出自己的容器。
- 脚本输出一份机器可读结果，至少包含 pass/fail、viewport、console error count、overflow count、topdeck token、cleanup 状态。
- 脚本失败时保留最小证据：失败 viewport、失败 selector 或元素文本、截图路径。

### 2.2 文档和记录允许

- 新增或更新一份验收记录模板，说明如何运行脚本、输出在哪里、失败怎么读。
- 第 9 轮 synthesis 可以引用脚本输出结果。
- 可以保留少量截图作为失败证据；通过时不要求保存全量截图矩阵。

### 2.3 测试补丁允许

如果当前浏览器层没有稳定进入 `paper_shatter` 场景的办法，可以做一个很窄的测试入口：

- 只对 test/dev 环境生效。
- 只注入固定 world snapshot 或固定 run 状态。
- 不改变正式玩家流程。
- 不引入长期调试面板。

这个入口的目标是“让验收可重复”，不是做游戏内作弊菜单。

## 3. 本轮禁止范围

以下内容第 9 轮一律不做：

- 不新增 `lantern_captain` 顶牌、discard fallback、手动 reorder、牌库浏览器。
- 不改 `paper_shatter` 数值、抽牌倍率、费用、奖励池或敌人意图。
- 不把 mobile playtest 扩成所有移动设备矩阵。
- 不引入 Percy、Chromatic、Playwright screenshot baseline 服务或任何外部 SaaS。
- 不做“截图像素级一致”判定；本轮只判功能、溢出、可读短 token。
- 不把所有旧手工 QA 文档迁移成自动化体系。
- 不为了脚本好写而绕过真实 UI 点击和 DOM 可见性。
- 不让脚本长期占用端口、浏览器进程或后台 server。

如果实现者发现必须改大量 runtime 或 UI 才能跑脚本，应停止并回报：这说明第 9 轮在修产品问题，不是在做验收自动化。

## 4. 最小验收清单

### 4.1 命令验收

第 9 轮最少要能跑通以下命令组合：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run
npm run build
```

以及一个新增或既有的浏览器验收命令，例如：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test:browser:redline
```

命令名可以不同，但第 9 轮结束文档必须写清楚真实命令。

### 4.2 浏览器自动化验收

三档视口都必须输出以下字段：

| 字段 | 通过条件 |
| --- | --- |
| `viewport` | 明确是 `1366x768`、`390x844` 或 `360x640`。 |
| `consoleErrorCount` | 必须为 `0`。 |
| `horizontalOverflowDetected` | 必须为 `false`，但允许手牌 rail 的设计内横向滚动被 allowlist 排除。 |
| `textOverflowCount` | 必须为 `0`；只统计关键按钮、奖励卡、Director、日志、End Turn，不扫全站噪音。 |
| `paperScenarioReached` | 必须为 `true`。 |
| `topdeckEvidenceVisible` | 必须为 `true`；可接受 `整备：顶终结`、`顶终结`、`下抽终结` 或实现中已批准的短 token。 |
| `endTurnStillUsable` | 必须为 `true`。 |
| `cleanupClosedPages` | 必须为 `true`。 |
| `cleanupStoppedServer` | 如果脚本启动了 server，必须为 `true`；如果复用外部 server，必须写 `not-started-by-script`。 |

### 4.3 paper_shatter 场景验收

脚本不需要跑完整 roguelite 流程，但必须证明以下链路：

1. 页面进入包含 `paper_shatter` 或其玩家名 `Paper Route` 的可操作状态。
2. 触发一次出牌或等价测试动作。
3. UI 中出现可见的整备结果 token。
4. 如果走命中路径，证据中能看到 `PayoffTopdecked`、`顶终结` 或下一抽终结类结果。
5. 如果走 miss 路径，必须明确标为 miss，不得把 miss 当成功。
6. 触发后 End Turn 仍可见、可点击、无覆盖。

本轮首选只固定一条命中路径。miss 路径可以继续由 sim 单测保护；除非实现成本很低，否则不要把浏览器脚本扩成两套场景。

### 4.4 输出验收

脚本输出不要做成大报告。最小可接受格式：

```json
{
  "status": "pass",
  "startedServer": true,
  "serverUrl": "http://127.0.0.1:5173",
  "results": [
    {
      "viewport": "1366x768",
      "consoleErrorCount": 0,
      "horizontalOverflowDetected": false,
      "textOverflowCount": 0,
      "paperScenarioReached": true,
      "topdeckEvidenceVisible": true,
      "endTurnStillUsable": true
    }
  ],
  "cleanup": {
    "closedPages": true,
    "stoppedServer": true
  }
}
```

可以同时生成 Markdown 摘要，但 JSON 是优先项，因为后续第 10 轮可以直接读。

## 5. 风险控制

| 风险 | 触发信号 | 裁决 |
| --- | --- | --- |
| QA 工程膨胀 | 开始设计 runner、插件、截图基线、CI 矩阵 | 立即停。第 9 轮只要一个专用验收脚本。 |
| 只测 sim 不测 UI | 脚本不打开浏览器，只跑 Vitest | 不通过。第 8 轮交接明确要自动化手工浏览器验收。 |
| 只截图不断言 | 有截图但没有 pass/fail 字段 | 不通过。必须有机器可读结论。 |
| 伪造状态过深 | 直接在 DevTools 改 DOM 文案再验收 | 不通过。可以注入 world，但不能伪造 UI 结果。 |
| overflow 误报 | 扫到手牌 rail 横向滚动就 fail | 加 allowlist。只判真实页面溢出和关键文本超框。 |
| 清理失败 | 验收后本次启动的 server 或页面还在 | 不通过。清理是验收项，不是礼貌项。 |
| 牵连产品改动 | 为脚本改费用、牌池、奖励、敌人 | 不通过。验收脚本不能改制作平衡。 |

## 6. 第 10 轮交接

第 10 轮不应继续堆 QA 工程。它应该基于第 9 轮输出做最终收束：

1. 读取第 9 轮自动化验收 JSON/Markdown。
2. 确认 `npm test -- --run`、`npm run build`、浏览器验收三者都通过。
3. 检查是否有第 9 轮为了验收新增的测试入口；如果有，确认它只在 test/dev 生效。
4. 检查自动化脚本是否留下后台 server、浏览器页面或临时文件垃圾。
5. 汇总 `paper_shatter` 样片的最终状态：可观测、可回归、可停用。
6. 明确下一阶段是否进入新机制，还是先做一次玩家体验复测。

第 10 轮允许裁决进入下一机制的条件：

```text
第 9 轮自动化验收稳定通过；
失败输出可读；
没有因为验收脚本引入新的产品规则；
没有把 QA 维护成本扩大成独立工程。
```

如果第 9 轮没有完成浏览器自动化，只完成 sim 测试，第 10 轮必须判定为“验收自动化未完成”，不能直接进入 `lantern_captain`、discard fallback 或通用 reorder。

## 7. 最终裁决

第 9 轮做：

```text
专用、窄、可重复的 paper_shatter 浏览器验收脚本；
三档视口；
短 JSON/Markdown 结果；
失败截图或失败元素证据；
完整清理记录。
```

第 9 轮不做：

```text
QA 平台、截图基线系统、跨浏览器矩阵、CI 工程化、录像系统、通用场景 runner、
新卡牌机制、新数值、新 reward/reorder 扩展。
```

制作人结论：第 9 轮的价值在于把第 8 轮样片钉住，不在于证明团队有一套完整 QA 基建。验收脚本越小，越能服务当前制作目标。

STATUS: DONE
