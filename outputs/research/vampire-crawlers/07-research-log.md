# 研究日志与当前状态

更新时间：2026-05-10 20:55 HKT

## 已完成

1. Steam 用户评测
   - 已从近期 partial dataset `5900` 条推进到分语言合并数据集 `14336` 条。
   - 时间范围：2026-04-21 到 2026-05-10。
   - 当前公开 endpoint 总量显示：`14348` 条，合并数据覆盖约 `99.9%`。
   - `recommendationid` 去重后重复数为 `0`。
   - 正负评：`13851` positive / `485` negative；公开 endpoint 当前总计为 `13862` positive / `486` negative。
   - 已并入 GPT-5.5 medium 救援子 agent 多抓到的 `17 + 131` 条。
   - 仍不能声称“绝对全量”，因为 endpoint 随新评论实时变化，目前还差约 `12` 条。

2. YouTube 动态材料
   - 已使用用户授权的 `chrome:Profile 3` cookies 采集公开视频材料。
   - 已生成 `youtube_collection_summary.json`。
   - 已下载 17 个短片段，覆盖官方预告、IGN 转发、GameSpot、Nintendo Life、SwitchUp、The Spiffing Brit。
   - 已为 17 个短片段生成 contact sheet。
   - 已获取多份英文字幕/自动字幕。
   - 部分视频的 `.info.json` 因字幕 429 导致 metadata 命令返回非零，但短片段和字幕文件仍然落盘。
   - 已新增前三小时长 VOD 证据地图：`13-first-3-hours-video-map.md`。
   - 已新增主 agent 中文体验分析：`14-first-3-hours-experience-analysis.md`。

3. 媒体评测
   - 已整理 16 条媒体/聚合来源。
   - 重点覆盖 PC Gamer、Windows Central、Shacknews、VGC、GameSpot、Destructoid、Nintendo Life、Push Square、Game Informer、Pocket Tactics、Game8、Forbes、The Outerhaven、4Gamer、Famitsu、Dengeki。

4. Excel
   - 已重新生成：`vampire_crawlers_research.xlsx`。
   - Steam Raw Reviews sheet 已从 `5900` 条升级到 `14336` 条。
   - Sheet：
     - `Summary`
     - `Steam Raw Reviews`
     - `Language Analysis`
     - `Theme Taxonomy`
     - `Media Reviews`
     - `Video Materials`
     - `Video Segments`
     - `Design Implications`

5. 方案文档
   - 已写可行性方案。
   - 已写实施方案。
   - 已写高阶分析框架。
   - 已写媒体证据表。
   - 已写 YouTube 证据采集方案。
   - 已写原创方向初稿。
   - 已写市场题材研究。
   - 已写前三小时视频理解边界。
   - 已写 gstack/subagent 并行调度方案。
   - 已写前三小时视频证据地图。
   - 已写前三小时核心体验分析。
   - 已写轻度成人向市场定位判断：`15-adult-content-market-positioning.md`。
   - 已写轻度擦边目标下的题材选择：`16-light-adult-theme-selection.md`。
   - 已写轻度擦边的视觉、声音与文案准则：`17-light-adult-sensory-writing-guidelines.md`。
   - 已写平台审核与发行风险报告：`18-risk-review-landscape.md`。
   - 已写竞品参考扫描：`19-comparable-games-scan.md`。
   - 已写三个可脱颖而出的轻度擦边题材方向：`20-three-breakout-theme-directions.md`。
   - 已根据用户反馈写斩杀爽感修正文档：`21-action-satisfaction-reframe.md`。
   - 已补充 Vampire Crawlers 主流核心体验 brief：`22-vampire-crawlers-core-experience-brief.md`。
   - 已写风险、竞品、核心体验整合后的方向决策：`23-integrated-risk-market-core-direction.md`。
   - 已并行启动 3 个题材 subagent，每个基于最新文档提出 2 个“百里挑一”候选：
     - `subagent-theme-pitches/agent-a-gothic-global.md`
     - `subagent-theme-pitches/agent-b-system-mechanics.md`
     - `subagent-theme-pitches/agent-c-adult-risk-market.md`
   - 已写主 agent 综合筛选：`24-subagent-theme-pitch-synthesis.md`。
   - 本轮综合结论：6 个原始提案不应平铺进入下一阶段；三个列车/车厢方案应合并为 `断轨夜车：丧钟零号车厢`。下一轮优先比较 `红线清算局：心跳回收`、`断轨夜车：丧钟零号车厢`、`黑潮灯塔：棱镜清场令`。
   - 已清理并标记废案：
     - 新增 `25-deprecated-ideas-register.md` 作为废案登记。
     - `06-design-direction-draft.md` 标记为已废弃，`Organ Fleet / 星舰胃袋` 不再作为主方向。
     - `08-prototype-gdd.md` 标记为已废弃，不进入原型开发。
     - `10-market-theme-research.md` 标记为历史市场扫描，推荐排序已过期。
     - `16-light-adult-theme-selection.md` 标记为主结论已废弃。
     - `20-three-breakout-theme-directions.md` 标记为旧三方向已废弃/降级。
     - `00-artifact-index.md` 已同步更新状态，避免后续 agent 误用旧方案。
   - 已新增 6 位独立游戏设计师公开语料驱动的评审镜头：`26-indie-designer-persona-panel-review.md`。
     - 选取 Lucas Pope、Derek Yu、Edmund McMillen、Daniel Mullins、Terry Cavanagh、Zach Barth。
     - 基于公开访谈、GDC 资料、开发复盘、书籍和行业认可资料抽象为“评审镜头”，不伪装成本人发言。
     - 结论：从纯设计评分看 `断轨夜车：丧钟零号车厢` 暂时第一；从市场和审核稳健看 `红线清算局：心跳回收` 仍是最稳主候选。
   - 已继续扩展为 20 位独立/小团队设计师镜头：`27-twenty-designer-lens-panel-review.md`。
     - 新增 Jonathan Blow、Maddy Thorson、Jan Willem Nijman、Justin Ma、Anthony Giovannetti、LocalThunk、Sam Barlow、Tom Francis、Tarn Adams、Ojiro Fumoto、Eric Barone、Toby Fox、Alex Beachum、Brendon Chung。
     - 20 镜头平均分：`断轨夜车` 87.95，`红线清算局` 84.25，`黑潮灯塔` 84.10，`夜班猎杀` 76.10。
     - 结论：设计验证优先级为 `断轨夜车` > `红线清算局` > `黑潮灯塔` > `夜班猎杀`；市场/审核/轻擦边优先级仍为 `红线清算局` > `断轨夜车` > `黑潮灯塔` > `夜班猎杀`。
   - 用户要求不再只找新题材，而是把 20 镜头的优化建议交给 3 个 subagent 迭代现有三案到 95+。
     - `subagent-optimization-95/opt-1-nightrail-95.md`：`断轨夜车：零号车票 / Nightrail Culling: Ticket Zero`。
     - `subagent-optimization-95/opt-2-redline-95.md`：`红线清算局：心跳处刑 / Redline Repossession: Heartbeat Execution`。
     - `subagent-optimization-95/opt-3-blacktide-95.md`：`黑潮灯塔：白棱清场令 / Blacktide Beacon: White Prism Culling`。
   - 已写主线程 20 镜头复评：`28-existing-candidates-95-iteration-review.md`。
     - 复评分：`断轨夜车：零号车票` 95.50，`红线清算局：心跳处刑` 95.20，`黑潮灯塔：白棱清场令` 94.55。
     - 当前进入 95+ GDD 竞争的是 `断轨夜车：零号车票` 与 `红线清算局：心跳处刑`。
     - `黑潮灯塔：白棱清场令` 保留为第三候选，系统强但市场角色吸引力仍略弱。
   - 已按用户要求将 20 个设计师/创作者镜头扩展为 50 个镜头，并对当前三个调整后提案重新打分：`29-fifty-designer-lens-panel-review.md`。
     - 50 镜头综合分：`红线清算局：心跳处刑` 95.06，`断轨夜车：零号车票` 94.84，`黑潮灯塔：白棱清场令` 94.14。
     - 排序变化：新增的叙事、角色、市场、轻度擦边、幸存者like 奖励节奏和直播传播镜头，使 `红线清算局：心跳处刑` 从 20 镜头第二升到综合第一。
     - 结论：下一步优先写 `红线清算局：心跳处刑` 的市场向一页 GDD；同时保留 `断轨夜车：零号车票` 作为系统深度和 Web 原型最强候选。

## 当前阻塞与残留风险

### Steam 全量抓取残留

公开 `appreviews` endpoint 可以访问，但全局 cursor 仍不稳定。已经改用分语言桶抓取，主语言桶补齐并合并救援数据后得到 `14336` 条。

残留问题：

- Steam `language=all` 当前显示 `14348` 条，主数据还差约 `12` 条。
- 已发现并合并的极小语种包括 `ukrainian/czech/hungarian/swedish/portuguese/dutch/vietnamese/finnish/danish/norwegian/greek`。
- 剩余 `12` 条可能来自 endpoint 实时新增评论、未列入的 Steam 语言码、或全局 `language=all` 与分语言桶之间的短期统计漂移。
- 文档和 Excel 均标注为“分语言合并数据集”，不伪装成绝对全量。

已完成的主要语言桶：

- `english` 6709
- `schinese` 4151
- `russian` 574
- `brazilian` 481
- `spanish` 424
- `german` 304
- `french` 300
- `tchinese` 289
- `japanese` 234
- `koreana` 231
- `italian` 156
- `polish` 119
- `latam` 114
- `turkish` 88
- `ukrainian` 32
- `thai` 31
- `czech` 22
- `hungarian` 20
- `swedish` 14
- `portuguese` 11
- `dutch` 11
- `vietnamese` 7
- `finnish` 6
- `danish` 5
- `norwegian` 2
- `greek` 1

### YouTube 评论/字幕

已授权 cookies 后，可以通过 `Profile 3` 访问公开视频并下载短片段。限制：

- 部分字幕请求触发 HTTP 429。
- 部分 metadata 命令因为字幕下载失败返回非零，导致 `.info.json` 没写出。
- 但短片段、contact sheet 和若干字幕文件已经足够做动态体验分析。

## 产物路径

- Excel：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/vampire_crawlers_research.xlsx`
- Steam CSV：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/steam_reviews_merged_flat.csv`
- Steam partial CSV：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/steam_reviews_flat.csv`
- Steam JSON：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/steam_reviews_raw.json`
- Steam 分语言 JSON：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/steam_reviews_by_language_raw.json`
- Steam 救援合并报告：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/rescue/steam_review_rescue_merge_report.md`
- Steam 极小语种探测报告：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/rescue/steam_review_remaining_language_probe.md`
- YouTube Summary：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/youtube/youtube_collection_summary.json`
- YouTube clips：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/youtube/`
- YouTube 前三小时证据地图：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/13-first-3-hours-video-map.md`
- 前三小时体验分析：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/14-first-3-hours-experience-analysis.md`
- 成人向市场定位判断：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/15-adult-content-market-positioning.md`
- 轻度擦边题材选择：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/16-light-adult-theme-selection.md`
- 轻度擦边感官与文案准则：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/17-light-adult-sensory-writing-guidelines.md`
- 平台审核风险报告：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/18-risk-review-landscape.md`
- 竞品参考扫描：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/19-comparable-games-scan.md`
- 三个突破题材方向：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/20-three-breakout-theme-directions.md`
- 斩杀爽感修正：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/21-action-satisfaction-reframe.md`
- Vampire Crawlers 核心体验 brief：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/22-vampire-crawlers-core-experience-brief.md`
- 整合方向决策：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/23-integrated-risk-market-core-direction.md`
- Subagent A 题材提案：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/subagent-theme-pitches/agent-a-gothic-global.md`
- Subagent B 题材提案：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/subagent-theme-pitches/agent-b-system-mechanics.md`
- Subagent C 题材提案：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/subagent-theme-pitches/agent-c-adult-risk-market.md`
- 题材综合筛选：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/24-subagent-theme-pitch-synthesis.md`
- 废案与历史方案登记：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/25-deprecated-ideas-register.md`
- 独立游戏设计师评审镜头：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/26-indie-designer-persona-panel-review.md`
- 20 位设计师镜头复评：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/27-twenty-designer-lens-panel-review.md`
- 95+ 新题材市场组保留结果：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/subagent-theme-pitches-95/agent-b-market-95.md`
- 断轨夜车 95+ 优化稿：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/subagent-optimization-95/opt-1-nightrail-95.md`
- 红线清算局 95+ 优化稿：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/subagent-optimization-95/opt-2-redline-95.md`
- 黑潮灯塔 95+ 优化稿：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/subagent-optimization-95/opt-3-blacktide-95.md`
- 现有候选 95+ 迭代复评：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/28-existing-candidates-95-iteration-review.md`
- 50 位设计师/创作者镜头复评：`/Users/roc/.codex/worktrees/2df8/Game-001/outputs/research/vampire-crawlers/29-fifty-designer-lens-panel-review.md`

## 后续建议

1. 如继续追求最后 `12` 条差额，可再扩展 Steam 语言码列表并重跑救援探测；当前数据已足够支撑设计分析。
2. 后续正式 GDD 应从 `24-subagent-theme-pitch-synthesis.md` 和 `25-deprecated-ideas-register.md` 进入，不要继续扩展 `Organ Fleet`、`夜班收容：体温档案`、温泉旅馆、直接魅魔或泛美少女角色池。
3. 后续写 GDD 时，文档顶部优先加入 `29-fifty-designer-lens-panel-review.md` 的 50 镜头结论；如果需要简化，再回退到 `27` 号 20 镜头或 `26` 号六镜头。
4. 主 agent 基于全量化评测、媒体评测、长视频证据，优先为 `红线清算局：心跳处刑` 写市场向一页 GDD，并并行保留 `断轨夜车：零号车票` 的系统向一页 GDD。
5. `黑潮灯塔：白棱清场令` 保留为第三候选，暂不优先进入 Web 原型，除非后续 capsule 草图测试显示点击率明显更好。
6. 后续如要更精细校准，补 Rarran 90-180 分钟和 Lord Aethelstan 的 contact sheet。
