# 新窗口交接：Game-001 Vampire Crawlers 长循环与并行 worktree 研发

## 启动指令

请继续 Game-001 的 Vampire Crawlers 对标长循环设计。先读取本交接文件，优先遵守“关键决策”和“禁止事项”。当前阶段仍处于 `superpowers:brainstorming` 设计门禁内：在用户批准设计 spec 前，不要开始实现代码。

## 当前目标

- 用户要把 Game-001 从已打磨的局内战斗 HUD/核心卡牌循环，推进到严格对标 `Vampire Crawlers` 的完整长任务循环。
- 目标不是自由发明 Roguelike 系统，而是：竞品有的长循环结构先有；竞品没有的第一版先不加。
- 用户明确希望后续执行时按多个专业小组并行，每组用独立 worktree 隔离，并且每组必须有“专业程序架构师”职责。
- 用户新增硬要求：补充成就系统、每个模块内的功能开关、地图推进时解锁具体功能，以及一套专业配表系统，避免把战斗/商店/地图/成就数据硬写到各系统里。

## 当前状态

- 已完成：
  - 战斗 HUD 已按 Vampire Crawlers-like 玩家布局大幅调整，玩家版和调试版已统一在一套布局基础上叠信息。
  - 最新提交为 `1348cfc Refine debug HUD affix layout`。
  - `qa:ui` 前序结果为 `20/20`，debug overlap 为空；5174 游戏预览服务保留运行。
  - 本轮已启动 `air-handoff`，正在生成新窗口交接。
  - 本轮曾使用 `superpowers:brainstorming`；可视化伴侣 `52980` 已停止，`.superpowers/` 临时目录已删除。
  - 本轮派出 5 个只读调研 agent；已全部关闭。只有 Poincare 产出完整结果，其他 4 个在运行中 shutdown，未产出可用摘要。
- 正在做：
  - 长循环总体设计和 worktree 并行研发拆分，尚未进入实现。
- 未完成：
  - 还未写正式 spec。
  - 还未创建 worktree。
  - 还未派 worker 实现。
  - 还未建立配表系统、成就系统、feature gate、局外账号存档或商店/地图 UI。

## 关键决策

- 唯一竞品口径：严格对标 `Vampire Crawlers` / 用户口中的“地牢爬行者/吸血鬼爬行者”，不要混入其他竞品。
- 用户确认的方向：完整长循环骨架应对标竞品；它有什么，我们先做对应结构；竞品没有的系统，第一版先不加。
- 用户选择过的 meta 范围：倾向“轻量持久成长”，即本地存档、真实解锁、主要解锁选择空间，而不是直接堆攻击/HP。
- 用户后来修正：不要只在 A/B/C 三个 meta 功能里选一个，要整体复刻竞品长循环，然后再拆系统。
- 并行研发要求：每个小组必须带架构师职责；用 worktree 隔离；主线程做 PM、规格、集成、验收，不做所有重活。
- 配表要求：地图节点、功能开关、成就、商店、奖励池、起手包、局外 meta 应走专业 config/schema，不要散落硬编码。
- UI 原则：调试版应在玩家版基础上补信息，不允许两套完全不同布局；战斗内不要塞局外/商店信息。
- 禁止事项：
  - 不把自动攻击、固定 60 秒 burst、实时心跳扣血当作核心底盘。
  - 不一开始全开全部系统；地图推进/成就/遗物/功能 gate 应逐步解锁。
  - 不直接做 D5-D10 playable；当前 D5-D10 仍是 backlog。
  - 不复制竞品 IP、卡名、UI 构图或美术，只复刻长循环结构和体验职能。
  - 不在用户批准 spec 前实现代码。

## Poincare 调研要点

Poincare 只读调研结论：本地证据已经足够，未上公网补证。Vampire Crawlers 风格长循环应是：

```text
局外入口 / hub / shop / 地图
-> 选择角色/起始构筑
-> 进入地图/难度节点
-> 第一人称地牢遭遇
-> 高速回合内打牌：0->1->2->payoff、draw、mana、Wild、gem
-> 击杀/承伤/升级奖励
-> 路线推进 / elite / boss / Reaper 压力
-> run 结算
-> 永久成长 / 解锁 / 商店 / 下一局目标
```

Game-001 已覆盖：高速回合卡牌链、奖励、路线、D1-D4 activity 推进、activity 内继承、污染首秀。

Game-001 缺失：真正的局外 hub/shop、角色/Crawler 选择、永久账号 meta、牺牲/同色解锁、完整地图、boss/Reaper 节点。

## 外部参考

本轮主线程也做了少量公网确认，来源如下；新窗口如需继续调研，应优先回到本地研究包，再只补缺口：

- Steam 页面确认 `Vampire Crawlers` 的 Steam 标签和功能：Card Battler、Dungeon Crawler、Deckbuilding、Turn-Based Combat、Steam Achievements、Steam Cloud、161 achievements。  
  https://store.steampowered.com/app/3265700/Vampire_Crawlers/
- SteamDB 页面确认其公开描述为 turn-based roguelite deckbuilder，并列出 tags/categories。  
  https://steamdb.info/app/3265700/stats/
- PC Gamer 指出局外商店、永久升级、Arcana tent、relic 解锁功能、Blacksmith/Gem slot 等结构。  
  https://www.pcgamer.com/games/roguelike/vampire-crawlers-best-upgrades-unlock-order/
- Reddit 玩家回答提到 village 的 unlocks building 可查看 items/stages 的解锁条件。  
  https://www.reddit.com/r/VampireCrawlers/comments/1st7juj/question_about_stages/
- Reddit 成就讨论提到许多 in-game unlock 与 achievements 绑定。  
  https://www.reddit.com/r/steamachievements/comments/1sxqcce/31_vampire_crawlers/

## 工作区状态

- cwd: `/Users/roc/Game-001`
- branch: `main`
- latest commit: `1348cfc (HEAD -> main) Refine debug HUD affix layout`
- git status: `main...origin/main [ahead 6]`
- dirty / untracked:
  - `.codex/auto-loop.failed-20260522-101404/`
  - `.codex/auto-loop.failed-20260522-235606/`
  - `.codex/auto-loop/`
  - 本 handoff 目录自身：`.codex/handoffs/2026-05-27-2348-vampire-crawlers-loop-handoff/`
- `git diff --stat` 当前为空，除未跟踪目录外没有 tracked file 修改。

## 运行状态

- dev server: `npm run dev:qa` 仍在运行。
- URL: `http://127.0.0.1:5174/`
- 监听进程：`node` PID `54966` on `127.0.0.1:5174`
- brainstorming visual companion: `52980` 已停止。
- browser: 用户 in-app browser 可能仍停留在旧的 `http://localhost:52980/`，新窗口如要继续看游戏，应让用户打开/刷新 `http://127.0.0.1:5174/`。
- cleanup: 不要擅自关闭 5174；这是用户明确要求可靠开启的游戏预览服务。

## 重要路径

- 代码入口：
  - `/Users/roc/Game-001/prototype-web/src/sim/activity.ts`
  - `/Users/roc/Game-001/prototype-web/src/sim/types.ts`
  - `/Users/roc/Game-001/prototype-web/src/sim/world.ts`
  - `/Users/roc/Game-001/prototype-web/src/sim/runtime.ts`
  - `/Users/roc/Game-001/prototype-web/src/sim/rewardChoices.ts`
  - `/Users/roc/Game-001/prototype-web/src/ui/hud.ts`
  - `/Users/roc/Game-001/prototype-web/src/style.css`
- 现有测试：
  - `/Users/roc/Game-001/prototype-web/src/tests/sim/redline-activity-difficulty.test.ts`
  - `/Users/roc/Game-001/prototype-web/src/tests/sim/redline-hyperturn-acceptance.test.ts`
  - `/Users/roc/Game-001/prototype-web/src/tests/sim/redline-progression-card-system.test.ts`
  - `/Users/roc/Game-001/prototype-web/src/tests/ui/hud-card-readability.test.ts`
- 本地研究：
  - `/Users/roc/Game-001/outputs/research/vampire-crawlers/00-artifact-index.md`
  - `/Users/roc/Game-001/outputs/research/vampire-crawlers/13-first-3-hours-video-map.md`
  - `/Users/roc/Game-001/outputs/research/vampire-crawlers/14-first-3-hours-experience-analysis.md`
  - `/Users/roc/Game-001/outputs/research/vampire-crawlers/22-vampire-crawlers-core-experience-brief.md`
  - `/Users/roc/Game-001/outputs/research/vampire-crawlers/30-competition-pressure-redo.md`
- 设计文档：
  - `/Users/roc/Game-001/design/technical/redline-hyperturn-acceptance.md`
  - `/Users/roc/Game-001/design/technical/redline-batches/2026-05-18-meta-progression-boundary-plan.md`
  - `/Users/roc/Game-001/design/technical/redline-batches/2026-05-18-run-meta-implementation-handoff.md`
  - `/Users/roc/Game-001/design/framework/2026-05-20-redline-activity-inherited-small-runs-spec.zh.md`
  - `/Users/roc/Game-001/design/framework/2026-05-20-redline-d4-d10-difficulty-ladder-spec.zh.md`
- Skills：
  - `/Users/roc/.codex/plugins/cache/openai-curated/superpowers/11b5af68/skills/brainstorming/SKILL.md`
  - `/Users/roc/.codex/plugins/cache/openai-curated/superpowers/11b5af68/skills/using-git-worktrees/SKILL.md`
  - `/Users/roc/.codex/plugins/cache/openai-curated/superpowers/11b5af68/skills/dispatching-parallel-agents/SKILL.md`
  - `/Users/roc/plugins/airoc/skills/air-handoff/SKILL.md`

## 建议的并行小组草案

仍需在新窗口中正式整理成 spec，并让用户批准：

1. `Config Architect / 配表基础设施组`
   - 架构师职责：定义 data/config schema、加载器、校验、模块依赖方向。
   - 范围：features、achievements、mapNodes、shops、unlockRules、starterKits、activityLevels。
   - 禁止：不改战斗 runtime 规则，不直接实现 UI。

2. `Loop Shell & Profile / 局外入口与档案组`
   - 架构师职责：定义账号 Profile、save/load、局外主页状态流。
   - 范围：新档/继续、地图入口、资源摘要、解锁入口。
   - 禁止：不把战斗数值写死到 profile。

3. `Map & Feature Gates / 地图推进与功能开关组`
   - 架构师职责：定义 map node、stage unlock、feature gate、实验开关、调试强开边界。
   - 范围：地图节点推进、节点解锁功能、未解锁隐藏/灰态。
   - 禁止：不直接做商店经济细节。

4. `Shop Upgrade & Card Services / 商店强化组`
   - 架构师职责：定义 shop item、删牌、强化、gem slot、reroll 等服务接口。
   - 范围：商店/强化/卡牌服务，全部从 config 读取。
   - 禁止：不改局外存档 schema，除非通过 Profile 组接口。

5. `Achievements & Unlocks / 成就与解锁组`
   - 架构师职责：区分 achievement tracking、unlock rules、feature flags 三者。
   - 范围：成就进度、解锁条件、奖励发放、持久化。
   - 禁止：不让成就系统直接调用 HUD 或 runtime 细节。

6. `UI Information Architecture / UI 信息架构组`
   - 架构师职责：局外主页、地图、结算、商店、成就、解锁提示的一套玩家版布局；调试信息只叠加。
   - 范围：页面清单、默认可见/调试可见、未解锁/刚解锁/已启用状态。
   - 禁止：不把局外信息塞回战斗 HUD 顶部。

7. `Integration QA / 集成验收组`
   - 架构师职责：定义端到端验收矩阵和 worktree 合并门槛。
   - 范围：新档 -> 地图 -> 战斗 -> 奖励/商店 -> 成就解锁 -> 重启仍保留。
   - 禁止：不顺手改生产逻辑。

## 下一步

1. 新窗口先确认当前状态：`git status --short --branch`、`git log -1 --oneline --decorate`、`lsof -nP -iTCP:5174 -sTCP:LISTEN`。
2. 读取本地 Vampire Crawlers 研究包和 Poincare 结论中的关键文件，不要全仓库盲扫。
3. 基于用户最新要求，提出 2-3 个并行研发拆分方案：
   - 推荐方案应包含“先配表基础设施，再多组并行”的架构。
   - 必须说明每组 worktree、架构师职责、文件边界、禁止事项、验收证据。
4. 向用户确认方案后，写正式设计 spec 到合适路径，例如：
   - `/Users/roc/Game-001/design/framework/2026-05-27-vampire-crawlers-long-loop-worktree-spec.zh.md`
5. 按 `superpowers:brainstorming` 规则：spec 写完并 commit 后，请用户 review；用户批准后再进入 `writing-plans` 和实现。

## 风险和注意事项

- 当前 `main` ahead origin 6；不要轻易 push/merge，除非用户明确要求。
- `.codex/auto-loop*` 是早前自动循环记录，未确认前不要删。
- 若界面还显示旧 subagent 名字，那是 Codex 侧边栏历史残留；当前新调研 agents 已关闭。
- 由于 Russell/Laplace/Lagrange/Popper 被提前 shutdown，没有它们的完整调研产出；新窗口如果需要，可以重新派更聚焦的只读 agent。
- 配表组应先行，否则地图、商店、成就、feature gate 会散落硬编码。
- 不要把外部 QA/测试结果当成产品体验分；用户非常在意实际 UI 和玩家体验。
