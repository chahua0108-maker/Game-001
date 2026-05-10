# 媒体评测证据表

说明：本表是公开媒体评测的证据层，不是最终策划结论。低档 subagent 负责收集线索；最终分析会在 `06-design-direction-draft.md` 中重新归因。

## 聚合口径

| 来源 | 当前观察 |
|---|---|
| Metacritic | PC、Switch、Xbox 分平台评分均为正向，PC 页面显示大量 80-90 分媒体条目，同时存在 PC Gamer 50/100 的显著负面异见 |
| OpenCritic / Wikipedia 聚合 | 公开聚合显示整体推荐率很高，说明媒体总体认可，但分歧点集中在节奏、重复和可读性 |
| Steam | 公开接口当前显示 `Overwhelmingly Positive`，后续以全量评测 Excel 为准 |

## 媒体条目

| 媒体 | 日期 | 类型 | 分数/结论 | 正面证据 | 负面证据 | 设计上需要验证的问题 |
|---|---:|---|---|---|---|---|
| PC Gamer | 2026-04-20 | Review | 偏负面，50/100 量级 | 承认经验宝石和升级的即时刺激仍然成立 | 前期出牌路线单一、重复、永久升级门槛让重玩像工作 | 如果没有 IP 红利，第一局必须更快给出多路线决策 |
| Windows Central | 2026-04-20 | Review | 强正面 | 认为它是 Xbox/Game Pass 上值得玩的 roguelite | 提到早期更 methodical，掌机上有物件可读性问题 | 便携设备和手柄输入必须早期纳入 UI 验证 |
| Shacknews | 2026-02-25 | Preview | 偏正面 | 认为它把 blobber 地牢和 bullet heaven 人群连接起来 | 地牢本身可能偏工具化，后续复杂化有风险 | 地牢不能只是战斗菜单皮肤，至少要有路线风险 |
| VGC | 2026-04-25 | Review | 4/5 | 认为它把 Survivors 的进程感转成了主动操作 | 内容量和成熟度仍需后续扩展 | 原创版本要证明主动操作感，而不是只换镜头 |
| GameSpot | 2026-04-20 | Review | 8/10 | 熟悉与新鲜结合得好，卡牌连锁上头 | 真正完整爽点可能要 15-20 小时后才打开 | Demo 不能慢热，10 分钟内必须出现 build 爆发 |
| Destructoid | 2026-04-20 | Review | 9/10 | 简单、上头、满足，解锁和自定义量足 | 核心战斗深度有限，早期金币偏慢 | 经济曲线要服务实验，而不是强迫刷 |
| Nintendo Life | 2026-04-20 | Review | 8/10 | 掌机模式、组合、进化、解锁都成立 | 有 bug，升级信息不完整，选项有受限感 | 奖励选择需要解释未来收益，不只是给三张卡 |
| Push Square | 2026-04-20 | Review | 8/10 | 核心循环、快节奏战斗、进度感都强 | 地牢移动僵硬，手柄菜单偏繁琐 | 伪 3D 移动和菜单手柄操作不能当次要问题 |
| Game Informer | 2026-05 附近 | Review | 正面 | 强调灯光、声音、按钮和反馈构成感官系统 | 这种刺激可能接近赌场式注意力轰炸 | 爽感不是数值本身，而是反馈系统的编排 |
| Pocket Tactics | 2026-04-20 | Review | 9/10 | 认为它 hypnotic，Village hub 把成就融入体验 | 提到性能小问题 | Hub 要成为长线目标板，不只是菜单 |
| Game8 | 2026-04 | Review | 84 | 强调 first-person、turn-based strategy deck-building 的混合感 | 需要核对全文细节 | 可作为“非欧美传统媒体”口径补充 |
| Forbes | 2026-04-27 | Review | 正面 | 认为它保留 frantic gameplay，又有新转法 | 需要核对全文细节 | 原创版本需要自己的 frantic 来源，不是借品牌 |
| The Outerhaven | 2026-04-20 | Review | 90 | 认可 build 实验和 one more run | 不是所有玩家都会 click | 需要清楚定义目标玩家，不追求全人群 |
| 4Gamer | 2026-04-23 | Feature | 正面前瞻 | 认为它把爽快感压缩进 deckbuilding | 后期平衡和长期节奏未被完全验证 | 日本玩家口径可作为“组合爆炸”的证据 |
| Famitsu | 2026-03-20 | News | 发售信息 | 强调破坏性构筑和抽牌过载 | 信息负荷可能偏高 | 卡牌过载必须有整理和自动化工具 |
| 電撃オンライン | 2026-04-20 | Feature | 推荐向 | 强调混乱回合制卡牌和音乐卖点 | 更像推荐文，不拆缺点 | 音乐和主题包装会放大机制记忆点 |

## 初步矛盾

同一款游戏被同时描述为“极其上头”和“重复、磨、慢热”。这不是简单的媒体分歧，而是提示核心体验有门槛：

- 对能进入 build 破局的玩家，它是高频奖励机器。
- 对只看到前期单一路径和永久升级门槛的玩家，它像半自动重复劳动。

原创版本的策划重点不是“复制所有系统”，而是把进入破局体验的时间提前，并让玩家在第一局就理解未来有什么可期待。

## 关键公开来源

- Steam 商店页：`https://store.steampowered.com/app/3265700/Vampire_Crawlers_The_Turbo_Wildcard_from_Vampire_Survivors/`
- Steam reviews endpoint：`https://store.steampowered.com/appreviews/3265700`
- Metacritic PC critic reviews：`https://www.metacritic.com/game/vampire-crawlers-the-turbo-wildcard-from-vampire/critic-reviews/`
- PC Gamer：`https://www.pcgamer.com/games/roguelike/vampire-crawlers-review/`
- Windows Central：`https://www.windowscentral.com/gaming/xbox/vampire-crawlers-review`
- Shacknews：`https://www.shacknews.com/article/147996/vampire-crawlers-steam-next-fest-preview`
- VGC：`https://www.videogameschronicle.com/review/vampire-crawlers-review/`
- GameSpot：`https://www.gamespot.com/reviews/vampire-crawlers-review-pixel-perfect-pandemonium/1900-6418483/`
- Destructoid：`https://www.destructoid.com/reviews/vampire-crawlers-review/`
- Nintendo Life：`https://www.nintendolife.com/reviews/switch-eshop/vampire-crawlers-the-turbo-wildcard-from-vampire-survivors`
- Push Square：`https://www.pushsquare.com/reviews/ps5/vampire-crawlers`
- Game Informer：`https://gameinformer.com/review/vampire-crawlers/dazzling-dungeons`
- Pocket Tactics：`https://www.pockettactics.com/vampire-crawlers/review`
- Game8：`https://game8.co/articles/reviews/vampire-crawlers-the-turbo-wildcard-review`
