# 具体实施方案

## 阶段 0：证据采集稳定化

目标：把公开数据采下来，形成可复核材料。

任务：

1. Steam 用户评测
   - 使用 Steam `appreviews` 公开 endpoint 分页抓取。
   - 输出 `steam_reviews_raw.json` 和 `steam_reviews_flat.csv`。
   - 字段包含推荐/不推荐、语言、文本、发布时间、游玩时长、投票、购买状态。

2. 媒体评测
   - 整理 PC Gamer、Windows Central、Shacknews、VGC、GameSpot、Destructoid、Nintendo Life、Push Square、Game Informer、Pocket Tactics、Forbes、TheGamer、Game8、Polygon、Metacritic/OpenCritic 等来源。
   - 每条只保存短摘要、评分、正负面、可验证链接。

3. YouTube 证据
   - 使用已授权的 Chrome/YouTube cookies 读取公开视频元数据、评论、字幕。
   - 对关键视频抽 8-30 秒短片段。
   - 对短片段生成 contact sheet，看战斗反馈的密度变化。

验收：

- Excel 能打开并看到原始评测表。
- YouTube 目录里有 `.info.json`、`.vtt`、短片段、contact sheet。
- MD 索引记录每个产物的位置。

## 阶段 1：证据归一化

目标：把多源材料变成可分析数据。

任务：

1. Steam 评测打标签
   - `addictive`
   - `boring_or_repetitive`
   - `too_slow_or_grindy`
   - `deckbuilding_depth`
   - `ui_readability`
   - `performance_bug`
   - `vampire_survivors_identity`
   - `price_value`
   - `handheld_or_controller`
   - `late_game_build_break`

2. 媒体评测拆成证据块
   - 赞成者到底在赞什么。
   - 反对者到底在骂什么。
   - 哪些问题是可修的设计问题。
   - 哪些优势来自 IP 和前作口碑，不能直接复用。

3. 视频材料拆成体验事件
   - 开场 10 秒的世界观/卖点。
   - 第一场战斗的理解成本。
   - 连击形成时的反馈节奏。
   - 奖励选择是否让人理解下一步。
   - 后期 build 是否真的形成“失控爽感”。

验收：

- Excel 有 `Theme Taxonomy` 和 `Design Implications` 两张表。
- 每个设计结论都能追到来源类型：Steam、媒体、视频、评论或字幕。

## 阶段 2：高阶分析

目标：不做流水账，总结出策划约束。

核心问题：

1. Vampire Crawlers 的核心体验到底是什么？
2. 玩家喜欢的是 IP、数值膨胀、卡牌顺序、探索、还是解锁？
3. 差评主要来自机制问题、节奏问题、UI 问题、还是期望错配？
4. 如果换成全新故事背景，哪些体验必须保留？
5. 我们能做哪些突破，让它不是“没有 IP 的弱化版”？

输出：

- `06-design-direction-draft.md`
- 3 个原创方向，每个方向包含世界观、玩家身份、核心循环、卡牌系统、成长系统、差异化突破、风险。

## 阶段 3：原型策划冻结

目标：选择一个方向进入可执行设计。

输出：

- `07-prototype-gdd.md`
- `08-data-schema.md`
- `09-web-prototype-build-plan.md`

必须冻结的内容：

- 10 分钟 demo 目标体验。
- 第一局教学流程。
- 3 个角色/职业。
- 30 张卡牌。
- 12 个敌人。
- 3 个地牢区域。
- 1 套永久升级。
- 1 套失败/结算/再开局循环。

## 阶段 4：Web 原型

建议技术：

- Vite + TypeScript。
- Three.js 做地牢和动态战斗表现。
- DOM/React 或轻 DOM 做卡牌和菜单。
- JSON 数据驱动卡牌、敌人、掉落、房间、文本。

验收标准：

- 玩家能从主菜单进入一局。
- 能在伪 3D 地牢移动。
- 能遭遇战斗、出牌、连击、升级、拿奖励、继续探索。
- 至少有一次中后期 build 爆发。
- 原型素材全部是原创或占位，不使用竞品资产。

## 阶段 5：复盘

目标：判断 Codex 流程是否跑通。

评估维度：

1. 是否成功从竞品证据提炼核心体验。
2. 是否能生成原创世界观，而不是换名复刻。
3. 是否能把评论和视频反馈转成可执行策划。
4. 是否能生成可迁移的数据结构。
5. 是否能做出足够接近核心流程的原型。
