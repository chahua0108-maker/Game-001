# 新窗口交接：Game-001 Redline 核心体验

## 启动指令

请只接手 `/Users/roc/Game-001` 的游戏原型工作，不要接手 AIRoc 插件制作或 GitHub 上传。先读取本交接文件，然后按“下一步”执行。当前 Redline 原型核心体验已达到 `95 / 100`，不要继续自动追加第 19 轮；后续只做真实玩家复测、小修、UI 可读性修正和缺陷修复，除非用户明确给出新的游戏目标。

## 当前目标

- Game-001 当前目标是把 Web 原型 `Redline / 红线清算局` 做成更像竞品的卡牌 roguelike 核心体验。
- 用户最终成功标准是“越像竞品越成功”，但必须遵守版权边界：复刻机制结构、体验节奏、资源压力、卡组成长和决策反馈，不复制竞品卡名、原文、美术、素材或 UI 构图。
- 当前阶段官方核心体验分已达到 `95 / 100`，自动多轮迭代应停止。
- 插件制作、AIRoc Skill 集合、GitHub 仓库上传继续留在原会话，不要在新游戏窗口处理。

## 当前状态

- 已完成：
  - `prototype-web/` 已经是 Vite + TypeScript + Three.js Web 原型。
  - 第 18 轮提交已完成：`10aff7d Advance Redline pressure journey to round 18`。
  - 本地 `main` 领先 `origin/main` 5 个提交。
  - 第 18 轮把官方核心体验从 `86 / 100` 推到 `95 / 100`。
  - 连续 3 节点 run 压力闭环已成立：战斗 -> 奖励 -> 路线 -> 下一战 -> 压力/污染/build plan 演变。
  - `npm run check`、`qa:lifecycle`、`qa:similarity`、`qa:ui` 在第 18 轮文档中记录为通过；QA 只作门禁，不计分。
- 正在做：
  - 当前主会话转去继续制作 AIRoc 插件集合和 GitHub 上传。
  - 游戏侧没有要求继续重体力迭代。
- 未完成：
  - 真实玩家试玩记录还没有做。
  - UI 仍可做小修：减少 debug 信息密度，把失败原因改成玩家复盘语言。
  - 如果未来要扩到 5 节点，需要开新阶段，不混入第 18 轮停止条件。

## 关键决策

- 用户明确纠正过：核心体验中的压迫不能做成实时自动攻击；它仍然是卡牌游戏。不要回到旧的实时心跳压迫方案。
- 官方评分采用 100 分制，核心体验达到 `95 / 100` 才停；第 18 轮已经达到停止线。
- QA、测试、文档、截图、cleanup、gateScore 只作为门禁，不能给核心体验加分。
- UI 体验不允许文字超框、按钮挤压、浮层遮挡核心操作区。
- 每轮如果重新进入多轮迭代，必须使用新的专家视角，主线程只做流程监督、集成和评分。
- 如果打开浏览器验收，结束后必须关闭 page/context/browser/server；不要留下 QA 临时端口。
- 从第 16 轮起每轮验收后本地 git 提交一次；当前最后游戏提交是第 18 轮。
- 新窗口不要处理 AIRoc 插件仓库；插件仓库名用户指定为 `airoc-plugin`，仍留在原会话。

## 工作区状态

- cwd: `/Users/roc/Game-001`
- branch: `main`
- latest commit: `10aff7d Advance Redline pressure journey to round 18`
- remote state: `main...origin/main [ahead 5]`
- dirty / untracked: 只有 `.codex/` 未跟踪；本交接包也写在 `.codex/handoffs/` 下，默认不提交。

近期提交：

```text
10aff7d Advance Redline pressure journey to round 18
cd2d0ea Advance Redline build plan to round 17
dc35f97 Advance Redline core loop to round 16
331a53a Add Redline expert lens review set
b24b262 Refocus Redline on hyper-turn card pressure
482edfe Add Redline web prototype combat loop
710e33a Add Vampire Crawlers research and art direction archive
```

## 运行状态

- 当前可访问页面：`http://127.0.0.1:5173/`
- 端口状态：当前 5173 上有两个 Vite node 监听：
  - `PID 39765`: `vite --host 0.0.0.0`
  - `PID 93943`: `vite --host 127.0.0.1 --port 5173`
- 这两个看起来是用户预览服务；不要擅自关闭，除非用户要求清理。
- 如果新窗口启动 QA，优先用 `prototype-web` 自带 QA 脚本的 `QA_PORT`，结束后验证 `pidAlive=false`、`portListening=false`。

## 重要路径

- Web 原型根目录：`/Users/roc/Game-001/prototype-web`
- 运行入口：`/Users/roc/Game-001/prototype-web/src/main.ts`
- HUD：`/Users/roc/Game-001/prototype-web/src/ui/hud.ts`
- 样式：`/Users/roc/Game-001/prototype-web/src/style.css`
- 核心 runtime：`/Users/roc/Game-001/prototype-web/src/sim/runtime.ts`
- 卡牌数据：`/Users/roc/Game-001/prototype-web/src/data/cards.ts`
- 奖励选择：`/Users/roc/Game-001/prototype-web/src/sim/rewardChoices.ts`
- 奖励进程：`/Users/roc/Game-001/prototype-web/src/sim/rewardProgression.ts`
- Build plan：`/Users/roc/Game-001/prototype-web/src/sim/buildPlan.ts`
- 类型定义：`/Users/roc/Game-001/prototype-web/src/sim/types.ts`
- 第 18 轮汇总：`/Users/roc/Game-001/design/technical/redline-batches/long-task/2026-05-19-round-18-synthesis.zh.md`
- 100 分控制表：`/Users/roc/Game-001/design/technical/redline-batches/long-task/2026-05-19-100-point-similarity-control.zh.md`
- 长任务控制计划：`/Users/roc/Game-001/design/technical/redline-batches/long-task/2026-05-18-10-round-core-loop-control-plan.md`
- 早期 Web 交接：`/Users/roc/Game-001/design/technical/web-prototype-handoff.md`

## 当前核心体验摘要

第 18 轮只做了一个核心切片：连续 `3-5` 节点 run 复测，让污染、失败压力、路线风险和 build plan 演变进入真实可玩链路。

已落地的关键体验：

- `RunState.pressure` 记录节点压力、路线压力、HP 损失和污染注入，仍限定在单次冒险内。
- 高压路线进入下一节点时造成可测 HP 压力，并尝试加入 `static_overload`。
- build plan 会根据最近奖励、路线、强化和污染分布，从补桥转向补资源或清污染。
- 奖励回应新增 pressure signal/order，能在污染、终结、桥、资源组合压力下轮转候选。
- HUD 增加压力时间线：上一节点压力、当前构筑问题、下一战路线后果。
- 新增原创奖励牌 `ash_filter`、`toll_shunt`、`last_light_cache`，服务清污染、补桥和坏手救场。
- `qa:similarity` 支持 `QA_JOURNEY_NODES`，默认复测两次 `reward -> route -> next battle`，覆盖 3 个节点。

官方裁决：`95 / 100`。本阶段不继续第 19 轮，除非真实玩家复测证明核心体验回落。

## 可用命令

在 `/Users/roc/Game-001/prototype-web` 下：

```bash
npm run dev
npm run check
npm run test:sim
npm run test:ui
QA_ROUND=round-18-main QA_PORT=5176 npm run qa:lifecycle
QA_ROUND=round-18-main QA_PORT=5177 QA_JOURNEY_NODES=3 npm run qa:similarity
QA_ROUND=round-18-main QA_PORT=5178 npm run qa:ui
```

注意：如果 5173 已有用户预览服务，不要为了 QA 杀掉它；QA 用独立端口。

## 下一步

1. 如果用户只是要继续看游戏进度，直接给本地页面：`http://127.0.0.1:5173/`，并说明当前是第 18 轮 95 分版本。
2. 如果用户要求继续游戏工作，先做真实玩家复测记录，不要自动加第 19 轮。复测重点：3 节点压力是否读得懂、build plan 是否像玩家计划、污染/路线风险是否迫使改选择。
3. 如果用户指出 UI 问题，只做小修：文字不超框、减少 debug 密度、把系统语言改成玩家复盘语言。
4. 如果真实玩家复测发现核心体验回落，再重新开启 `$air-loop` 或核心体验循环，按最低缺口开新轮，不扩无关系统。
5. 如果用户要求归档游戏成果到 Obsidian，再用 `$air-archive`，但不要和插件上传混在一起。

## 风险和注意事项

- 不要把第 18 轮后的工作继续包装成“自动第 19 轮”，这会违背 95 分停止线。
- 不要用 QA 通过、截图数量、测试数量给核心体验继续加分。
- 不要回到实时自动攻击压迫；用户已经明确否定。
- 不要擅自关闭用户保留的 5173 预览服务。
- 不要在新游戏窗口继续 AIRoc 插件制作；插件制作仍在原会话处理。
- 如果本地状态和本交接不一致，先汇报差异，再继续。
