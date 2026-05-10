# Vampire Crawlers 研究与原型的并行工作流

生成时间：2026-05-10  
目的：把当前研究、策划、原型验证拆成可以并行推进的 lanes，减少主 agent 被低价值采集任务占用。

## 当前调度结论

可以并行，但必须分层：

| Lane | 适合的 agent/技能 | 是否可并行 | 输出文件 | 主 agent 是否必须介入 |
|---|---|---:|---|---:|
| Steam 评测补齐与质量复核 | 低档/中档 worker，必要时 GPT-5.5 medium | 是 | `steam_reviews_merged_flat.csv`、`rescue/*.md` | 只审核数字和异常 |
| YouTube 长视频前三小时切片 | 低档/中档 worker | 是 | `youtube/` 片段、字幕、评论、`13-first-3-hours-video-map.md` | 必须做最终体验归纳 |
| 媒体评测补充 | 低档 worker | 是 | `04-media-review-evidence.md` 增补或独立证据表 | 只做证据权重判断 |
| 市场题材资料刷新 | 低档 worker | 是 | `10-market-theme-research.md` 证据补充 | 必须做题材方向取舍 |
| 策划案批判审稿 | `/plan-ceo-review`、`/plan-eng-review`、`/plan-design-review` | 可并行但应分轮 | `14-plan-review-notes.md` | 必须决定采纳/不采纳 |
| Web 原型工程 | `game-studio`、`web-game-foundations`、后续 `phaser`/`three` | 半并行 | 原型代码与 `15-prototype-build-plan.md` | 必须把控核心循环 |
| 前端游玩 QA | `/qa-only`、`game-playtest`、`/benchmark` | 原型可运行后并行 | QA 报告、截图、性能记录 | 只处理高优问题 |
| 上下文交接 | `/context-save` | 随时 | gstack context snapshot | 主 agent 发起 |

## 现在已经启动的并行项

1. 主进程继续跑 `tools/collect_steam_reviews_by_language.py`，目标是把 Steam 公开用户评测从 5900 条 partial 样本推进到按语言补齐后的合并表。
2. 已启动一个 GPT-5.5 medium worker 作为数据救援子 agent，写入范围限定为 `outputs/research/vampire-crawlers/rescue/`，只做 Steam 评测补齐和质量复核，不做策划判断。

## 最值得立刻并行的三个任务

### 1. 长视频前三小时体验拆解

优先级最高。当前我还不能说已经“深刻感受”前三小时体验，原因是现有 YouTube 证据主要覆盖宣传片、评测片段、短 gameplay 和约 20 分钟战斗段落。下一步应让低档 agent 把 3 小时级别 VOD 切成可分析结构：

| 时间段 | 需要记录 |
|---|---|
| 0-15 分钟 | 新手引导、首次战斗、第一轮卡牌/升级选择、移动与命中反馈 |
| 15-45 分钟 | 第一套 build 是否成形、失败点、爽感是否开始出现 |
| 45-90 分钟 | 解锁节奏、商店/永久成长、重复游玩的驱动力 |
| 90-180 分钟 | 内容密度是否维持、是否出现疲劳、玩家如何评价变化 |

低档 agent 只负责：视频链接、时间码、字幕摘录、评论摘录、contact sheet。主 agent 负责把这些材料转成“前三小时核心体验曲线”。

### 2. Steam 评测全量化

优先级很高。当前 partial 数据已经够做初步判断，但不够支撑“所有 Steam 评测全部扒下来”的要求。现在的方向是分语言桶抓取，比全局 cursor 更稳定。需要关注：

| 检查项 | 判定标准 |
|---|---|
| 合并去重 | `recommendationid` 不重复 |
| 语言覆盖 | 英文、简中、俄语、巴葡、西语、德语、法语、繁中、日语、韩语优先 |
| 正负评比例 | 与 Steam `query_summary` 的 positive/negative 接近 |
| 时间范围 | 覆盖首发以来至当前抓取时间 |
| 阻塞记录 | 失败语言、HTTP 错误、cursor 循环都要写入 MD |

### 3. 策划方向审稿

优先级中高。当前 `10-market-theme-research.md` 已经把纯 `Organ Fleet / 星舰胃袋` 调整为更市场友好的“都市怪谈/异常收容 + 黑暗炼金/器官链”方向。下一步可以用 gstack 的审稿技能并行挑战这个方向：

| 审稿角度 | 适合技能 | 问题 |
|---|---|---|
| 商业与差异化 | `/plan-ceo-review` | 这个题材是否足够好卖，是否只是安全但普通 |
| 工程与迁移 | `/plan-eng-review` | Web 原型的数据结构是否能迁移到 Unity/UE |
| 视觉与 UI | `/plan-design-review` 或 `/design-consultation` | 伪 3D、卡牌、走廊、怪潮是否能形成清晰卖相 |

这些审稿可以并行收集意见，但最终只由主 agent 做取舍，避免多个 agent 把方向越改越散。

## 暂时不建议现在并行的任务

| 任务 | 原因 |
|---|---|
| 直接写完整原型 | 体验曲线和题材方向还没完全定，过早实现会把错误假设固化 |
| 做大量美术资产 | 现在还没有确定最终题材和角色/怪物语言 |
| 做性能专项 | 用户已说明性能不是当前瓶颈，现阶段只需保留基本验证 |
| 跑 `/ship` 或部署链路 | 现在是研究与原型前置阶段，还没到交付发布 |

## 推荐下一轮调度

1. 让一个低档 agent 专门处理长 VOD 的时间码、字幕、评论和画面切片。
2. 让 GPT-5.5 medium worker 兜底 Steam 全量评测和质量复核。
3. 主 agent 更新 Excel、研究日志和前三小时体验曲线。
4. 主 agent 基于证据重写一版“市场向原创题材 + 核心循环”的正式 GDD。
5. 再开 `/plan-ceo-review`、`/plan-eng-review`、`/plan-design-review` 分别挑战策划、工程、视觉。

## 分工边界

低档 agent 可以做：

- 抓网页、视频元数据、评论、字幕。
- 列表化媒体评测和 Steam 评论。
- 生成 CSV、JSON、contact sheet、时间码表。
- 检查重复、缺失、HTTP 错误。

高档主 agent 必须做：

- 判断哪些评论代表核心体验，哪些只是噪声。
- 从视频体验转译出节奏曲线、爽感来源和疲劳点。
- 把市场题材与玩法结构合并成原创策划方向。
- 决定 Web 原型要验证什么，不验证什么。
