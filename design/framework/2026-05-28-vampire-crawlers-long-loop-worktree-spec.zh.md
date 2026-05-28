# Redline Vampire Crawlers-like 长循环与并行 Worktree 研发 Spec

日期：2026-05-28
状态：三轮专家评审和两轮 PM 审核后修订，等待用户 review 后进入 implementation plan
范围：定义完整局外系统目标态、分期合同、长循环产品结构、模块边界、配表合同、并行 worktree 迭代方式和验收门槛；本 spec 不代表实现已完成。

## 1. 背景

Game-001 当前 Web prototype 已经证明了局内核心：第一人称走廊压迫、超高速回合制卡牌链、`0 -> 1 -> 2 -> payoff`、敌人意图、奖励、路线和 D1-D4 activity 推进。最新方向不是继续扩局内战斗底盘，而是补齐严格对标 `Vampire Crawlers` 的完整长循环骨架。

本轮设计遵守以下已确认约束：

- 竞品口径只对标 `Vampire Crawlers` 的长循环结构，不混入其他 roguelike 的自由扩展。
- 竞品有的局外结构都必须进入目标态合同：hub/village、地图、Crawler/起手构筑、商店、Blacksmith、成就/解锁、Unlock Building、永久升级、relic/arcana/gem、局外档案、下一局目标。
- P0 可以只实装首个可玩切片，但未实装的竞品局外系统也必须进入 schema、profile 预留、feature gate、UI locked preview 或 backlog contract，不能从架构中消失。
- 战斗底盘保持 `hyper turn-based card-driven dungeon crawler`，不得回到自动攻击、固定 60 秒 burst 或实时心跳扣血。
- 后续执行时主线程做 PM、规格、集成和验收；具体实现用多个独立 worktree 并行，每组必须包含架构师职责。

## 2. 专家评审结论

本 spec 经过三轮只读专家评审：

- 策划专家 1：竞品长循环结构。
- 策划专家 2：玩家旅程、地图推进与功能解锁。
- 策划专家 3：局外经济、商店、起手构筑与轻量 meta。
- 游戏程序专家 1：架构、配表 schema 与模块边界。
- 游戏程序专家 2：集成、测试、验收与并行 worktree。

第一轮评分区间为 `72-84/100`，主要问题是原拆分更像模块清单，缺少长循环状态 owner、前三小时解锁矩阵、商店边界拆分和跨组 E2E 契约。

第二轮评分提升到 `88-90/100`，专家认可新增 `Run Loop Orchestrator`、`first_3_hours_unlock_matrix`、Shop/Blacksmith 拆分和测试先行顺序。

第三轮最终签核分数为 `90/92/92/93/94`，没有发现会导致方案失败的硬问题。所有专家共同要求写入三条硬约束：

1. `Run Loop Orchestrator` 独占局外状态推进，combat runtime 不读写 profile、shop、achievement、map gate 或 hub 状态。
2. `first_3_hours_unlock_matrix` 是 config/test fixture，不是说明文档；每行必须包含 `trigger / mapNode / featureGate / achievement / uiState / nextGoal / visibility`。
3. P0 只验证一条窄闭环：`新档 -> D1 -> 回 Hub -> Shop 一次轻量购买 -> 下一局变化 -> reload 后 profile 保留 -> run 内强化不保留`。

PM 复审后新增裁决：

- 当前 spec 原版可作为 P0 架构合同，但不能作为“全面完成所有局外系统”的最终执行方案。
- P0 窄闭环必须改写为“完整局外架构的首个可玩切片”，不是最终目标。
- 每个子 worktree 必须交付自己的长循环迭代证据，证明该模块能推动下一局，而不是只通过模块单测。
- Unlock Building、relic/arcana/gem、permanent upgrades、collection/seen index 必须成为目标态一等系统；P0 可以 locked preview，但 schema/profile/UI 合同必须存在。

## 3. 总目标与阶段边界

最终目标是全面对齐 `Vampire Crawlers` 的局外长循环，完成所有局外系统的产品闭环，而不是只做一条 D1 后购买的演示路径。

### 3.1 最终目标

最终目标态必须让玩家自然经历：

```text
Hub / Village
-> 查看地图、Crawler、起手构筑、Shop、Unlock Building、Achievements、Profile Summary
-> 选择 Crawler / Starter Build
-> 推进 D1-D10 地图节点
-> 遭遇 boss / elite / Reaper-like 压力
-> 战斗结算
-> 获得货币、成就、unlock、seen collection
-> 在 Shop / Blacksmith / Arcana / Relic / Permanent Upgrade 中做局外决策
-> 下一局拥有新的选择空间
-> reload 后账号层目标、解锁和购买保留
```

### 3.2 阶段定义

| 阶段 | 目标 | 交付边界 | 不是 |
| --- | --- | --- | --- |
| P0 | 完整局外架构的首个可玩切片 | Config、Profile、Orchestrator、D1->Hub、Shop 一次购买、下一局变化、reload 边界；所有目标态系统至少进入独立配置表、profile 预留、feature gate、UI preview 或 backlog contract | 不是最终目标，不代表完整局外系统完成 |
| P1 | 完整局外可见骨架 | Hub/Village、Map、Crawler/Starter、Shop、Blacksmith、Achievements、Unlock Building、Profile Summary、Settlement 全部有玩家可见或 condition-visible 入口；核心路径系统至少一个 locked->unlocked->影响下一局闭环 | 不是所有目标态系统都完成闭环 |
| P2 | 全目标系统首轮闭环补齐 | D1-D4 多局推进；Unlock Building、Permanent Upgrades、Relic/Arcana/Gem、Collection、Crawler/Starter、Shop/Blacksmith、Achievements/Unlocks 都必须至少有一个可玩闭环、独立配置、profile 字段和 reload 证据 | 不是 D5-D10 和内容量完成 |
| P3 | D5-D10 与后段压力落地 | D5-D10 playable progression、boss/elite/reaper-like pressure、后段 unlock 链、更多 starter/relic/arcana/gem/shop/achievement 内容接入同一矩阵 | 不是只做规划或 locked preview |
| P4 | 平衡、留存和 QA 打磨 | 首 3 小时目标链、失败保底、移动端、reload、多局评分、browser QA、全目标系统最终闭环证据 | 不是新增大系统阶段 |

### 3.3 P0 表述修正

P0 只允许实现一条窄闭环，但文档、schema、profile、feature gate 和 UI preview 必须覆盖完整目标态。任何 worktree 小组或 agent 都不得把 P0 窄闭环理解为最终产品目标。

## 4. Vampire Crawlers-like 完整局外系统目标态

| 系统 | 目标态 | P0 合同 | P1 可见骨架 | P2 首轮闭环 | P3/P4 完成方向 | Owning Worktree |
| --- | --- | --- | --- | --- | --- | --- |
| Hub / Village | 所有局外入口主页 | Hub shell、下一目标、locked preview | 全入口可点或 condition-visible | 全目标系统入口都能承接实际解锁状态 | 内容密度、状态摘要、推荐目标、首 3 小时节奏 | UI IA / Orchestrator |
| Unlock Building | stages/items/cards/relics/crawlers/services 的解锁条件查看 | schema、profile seen fields、locked preview | 条件可见、基础筛选 | 至少一条 stage/item/service 解锁条件从矩阵驱动到 UI | 完整条件索引和图鉴式查看 | Achievements / UI |
| Crawler Selection | 角色选择、锁定预览、构筑身份 | 默认 Crawler + locked preview | 第二 Crawler 或 starter 差异可见 | 第二 Crawler 或 starter 选择影响下一局起手 | 多 Crawler 被动/起始武器/构筑身份 | Crawler & Starter Build |
| Starter Build | 起始牌组、starter kit、起手路线预览 | 默认 kit + Stable Chain | 多 starter kit 可见 | 多 starter kit 可选并写入 run start snapshot | 构筑身份、风险/收益 starter | Crawler & Starter Build |
| Map Stages | D1-D10 节点、stage reward、stage goal | D1 可玩、D2-D10 preview | D1-D4 多局推进骨架 | D1-D4 连续解锁和 stage reward 闭环 | D5-D10 playable、boss/reaper 节奏 | Map & Gates |
| Boss / Elite / Reaper Pressure | 阶段压力、倒计时或节点威胁 | D1 stage marker，D4 污染预告 | elite/boss marker 可见 | D4 压力首秀影响下一局准备 | P3 落地 Reaper-like 压力和后段 boss/elite 链 | Map & Gates / QA |
| Shop | 商品、价格、锁定原因、购买记录、推荐购买 | 4 个 P0 商品合同，少量可买 | 多货架、推荐购买、余额不足边界 | service permit、starter、relic/arcana/gem 至少各有一条上架/购买/下局影响链 | 更多服务、价格平衡、失败保底 | Shop Facade |
| Permanent Upgrades | 轻量永久成长，优先解锁选择空间 | schema/profile/locked preview，禁止裸数值实装 | 解锁 reroll、starter、service permits 可见 | 至少一个永久升级改变选择空间并通过 reload 保留 | 更多永久选择空间，谨慎数值成长 | Profile / Unlocks |
| Blacksmith | 强化、gem slot、socket、reroll、删牌/献祭预览 | run-local raise-level / gem permit / reroll permit | gem/socket/reroll 基础可见 | 购买许可后下一局 run-local 强化机会可用，结束后不永久保留卡牌改造 | delete/sacrifice/多 gem 深度 | Blacksmith |
| Relic / Arcana / Gem | relic/arcana/gem 作为局外和局内构筑桥 | schema + locked preview，不实装完整池 | 少量可见、少量可用 | relic、arcana、gem 至少各一条解锁/获得/下局 modifier 或 slot 影响闭环 | 完整池、解锁、shop/achievement 链路 | Config / Shop / Blacksmith |
| Achievements / Unlocks | 成就追踪、奖励发放、功能解锁 | 首批成就 + unlock rule | 成就页可用、解锁原因可见 | 成就奖励能驱动 Unlock Building、Shop、Permanent Upgrade 等目标系统 | 成就体系扩展，接近竞品规模方向 | Achievements |
| Profile / Cloud-like Save | 本地 profile、版本迁移、reload、未来云存档形态 | local profile + migration + reload | 多系统字段持久化 | 每个目标系统都有 profile 字段或明确无持久化理由 | cloud-like adapter 预留 | Profile |
| Settlement / Hub Review | 每局结束收益、解锁、下一目标 | D1 后强制回 Hub Review | 每局复盘和推荐目标 | 结算能解释本局触发的目标系统变化和下一局目标 | 多局统计、失败保底、留存目标 | Orchestrator / UI |
| Collection / Seen Index | 已见卡、敌人、relic、stage、锁定预览记录 | profile fields + locked preview | seen collection 可查看 | 至少卡牌/stage/relic 三类 seen 记录从事件进入图鉴 | 完整图鉴和条件导航 | Profile / Unlock Building |
| Feature Gates | 所有功能显隐、灰态、解锁来源 | matrix 驱动，不硬编码 | 所有入口统一 gate | 每个目标系统 gate 都有矩阵行、测试 fixture 和 UI 状态 | 更复杂条件和调试覆盖 | Config / Feature Gates |

## 5. Vampire Crawlers-like 系统对齐表

| 竞品职能 | Game-001 目标态 | P0 | P1 | P2 | P3/P4 |
| --- | --- | --- | --- | --- | --- |
| Village / Hub | Redline Hub / Village，承载所有局外入口 | Hub shell + 下一目标 | 全入口可见可点 | 全目标系统入口承接真实状态 | 状态摘要和推荐目标打磨 |
| Unlocks Building | 解锁条件建筑，查看 stage/item/card/relic/crawler/service 条件 | schema + locked preview | 条件可见、基础筛选 | 至少一条真实解锁条件闭环 | 完整索引和图鉴导航 |
| Crawler Selection | Crawler 选择和构筑身份 | 默认 Crawler + locked preview | 第二入口或 starter 差异可见 | 第二 Crawler 或 starter 选择影响下一局 | 多 Crawler 技能/被动 |
| Starter Builds | 起手包和下一局构筑入口 | 默认 kit + Stable Chain | 多 kit 可见 | 多 kit 可选并写入 run snapshot | 风险/收益 starter 深化 |
| Map Stages | D1-D10 地图推进和 stage rewards | D1 playable，D2-D10 preview | D1-D4 骨架 | D1-D4 连续推进 | D5-D10 playable 和内容推进 |
| Boss / Elite / Reaper | 阶段压力和后期威胁 | D1 marker、D4 污染预告 | elite/boss 可见 | D4 压力首秀影响准备 | Reaper-like 压力完整化 |
| Shop | 购买服务、权限、下一局变化 | 一次轻量购买 | 多货架基础可用 | service/starter/relic/gem 至少一条购买闭环 | 价格/推荐/失败保底打磨 |
| Blacksmith | 强化、开槽、镶嵌、reroll、删牌/献祭 | run-local 强化/红槽/重掷许可 | gem/socket/reroll 可见 | 许可影响下一局 run-local 强化机会 | delete/sacrifice 深化 |
| Relic / Arcana | 局外解锁与局内 modifier 桥 | schema + locked preview | 少量可见/可用 | relic/arcana/gem 首轮闭环 | 完整池和 unlock 链 |
| Permanent Upgrades | 永久成长，优先选择空间 | profile/schema 预留，禁止裸数值 | 解锁服务/起手/卡池可见 | 至少一个升级改变选择空间且 reload 保留 | 谨慎数值成长和更深选择空间 |
| Achievements | 成就追踪与 unlock reward | 矩阵首批 achievement id | 成就页和更多行为目标 | 奖励驱动目标系统解锁 | 接近竞品规模方向 |
| Cloud-like Save | 存档持久化和未来云存档形态 | localStorage profile + migration | 多系统字段保留 | 全目标系统 profile 边界可测 | cloud adapter 预留 |

## 6. 局外系统验收矩阵字段

后续计划和测试必须以统一验收矩阵描述所有局外系统。矩阵字段固定为：

```text
system
targetState
p0Contract
p0Playable
p1Playable
p2Complete
p3Complete
profileFields
configSource
uiState
unlockSource
nextRunImpact
reloadProof
e2eProof
browserProof
owningWorktree
phaseExit
blockerIfMissing
```

每个目标态系统都必须有一行。即使 P0 不可玩，也必须说明其 schema、profile 预留、feature gate、UI preview 或 backlog contract。

验收只认可四类证据：

1. 配置证据：独立 config 表、ID 引用校验、matrix 行或明确无 matrix 理由。
2. 状态证据：profile 字段、run-local 字段、migration/reload 边界。
3. 玩家证据：UI 入口、locked/condition-visible/unlocked 状态、下一目标文案、下一局影响。
4. 自动化证据：sim/ui/E2E/browser QA 命令结果和失败时的最小复现。

任何系统缺少 `configSource / profileFields / uiState / unlockSource / nextRunImpact / reloadProof` 中任意一项，不能标为 P2 complete。若某项按设计不需要，例如纯 run-local Blacksmith 强化不写入 profile，必须在矩阵中写明“不持久化，reload 后应消失”的负向验收。

### 6.1 阶段出门口径

| 阶段 | 出门条件 | 必须证据 | 失败线 |
| --- | --- | --- | --- |
| P0 | 首个可玩纵切跑通，且完整目标态进入合同 | D1->Hub->Shop purchase->D2/reload E2E；全目标系统 config/profile/UI preview 合同清单 | 只完成 D1 购买演示，但目标态系统没有合同 |
| P1 | 完整局外入口可见骨架 | Hub 上能看到或 condition-visible 进入所有局外入口；核心路径系统至少一条下一局影响闭环 | 某个目标系统没有入口或只能靠 debug 触发 |
| P2 | 全目标系统首轮闭环 | 每个目标系统一行验收矩阵，均有独立 config、profile 边界、unlock source、UI 状态、reload/E2E/browser 证据 | Permanent Upgrade、Relic/Arcana/Gem、Collection、Unlock Building 任一仍停留在 preview |
| P3 | D5-D10 和后段压力可玩 | D5-D10 progression、boss/elite/reaper-like pressure、后段 unlock 链接入 matrix 和 QA | D5-D10 仍只是 locked preview 或文案规划 |
| P4 | 全局打磨可交付 | 首 3 小时目标链、失败保底、移动端、reload、多局评分、最终 QA 报告 | 只能证明单局，不可证明连续多局成长 |

## 7. P0 可玩切片

P0 是完整局外系统蓝图上的第一条可玩纵切，不是最终目标。

P0 的实现目标是验证 Vampire Crawlers-like 长循环的最小可玩闭环：

```text
新档
-> Hub
-> 默认 Crawler / 默认起手包
-> D1 地图节点
-> D1 战斗，含 stage goal pressure
-> 结算后强制回 Hub
-> 获得货币和成就进度
-> Shop 解锁一次轻量购买
-> 购买 starter kit 或 Blacksmith 服务
-> 下一局起手或强化机会可见变化
-> reload 后 profile 保留
-> run 内卡牌强化不保留
```

P0 成功标准：

- 玩家第一局后能看懂“我获得了什么、解锁了什么、下一局为什么不同”。
- 局外系统只扩大下一局选择空间，不直接堆永久攻击、HP 或 Max MP。
- 战斗 runtime 仍只负责局内引擎，局外系统通过 run start snapshot 和 settlement summary 连接。
- 所有地图、商店、成就、功能 gate 和起手包来自 config，不在各模块硬编码一份解锁顺序。
- 所有 P1-P3 目标态系统至少已经进入 schema、profile 预留、feature gate、UI locked preview 或 backlog contract。

## 8. P0 非目标与目标态保留

P0 明确不做：

- 不做 D5-D10 playable，但 D5-D10 必须进入 map stage schema、locked preview 和 backlog contract。
- 不做完整 Reaper，但 Reaper-like pressure 必须进入 map pressure 目标态和 locked preview。
- 不做完整 Crawler 技能差异，但 Crawler selection 必须是一等系统，P0 至少有默认 Crawler 和锁定预览。
- 不做完整 relic 池，但 relic/arcana/gem 必须进入 config schema、shop/achievement unlock target 和 UI locked preview。
- 不做删牌服务实装。Delete card 只能显示锁定预览。
- 不做多货币、商店随机刷新、折扣、日刷新、利息或复杂经济。
- 不做永久卡牌等级、永久 gem、永久 socket、永久攻击、永久 HP、永久 Max MP。
- 不把 Shop、Map、Achievements、Profile 信息塞进战斗 HUD。
- 不复制 `Vampire Crawlers` 的 IP、卡名、UI 构图或美术。

## 9. 总体架构

长循环拆成十个边界清晰的模块。

### 9.1 Data Contracts & Config Pipeline

这是第一合并点。职责是建立可被所有组依赖的最小稳定合同，不做巨型框架。

本模块必须满足“每个系统有独立配置表逻辑”的要求。Map、Shop、Blacksmith、Achievements、Unlock Building、Crawler、Starter Kit、Relic、Arcana、Gem、Permanent Upgrade、Feature Gate 都不得共享一张杂糅的大表；每个系统必须有自己的表、引用校验和只读 query service。

#### 9.1.1 Luban 配表候选

`focus-creative-games/luban` 是候选配表工具。官方资料显示它支持 Excel/CSV/JSON/XML/YAML/Lua 等源数据，支持 TypeScript/JavaScript 代码生成，支持 JSON/binary 等数据导出，并且有 `code_typescript_json,data_json` 生成组合。它适合作为 Game-001 的专业配表生成层。

P0 不直接把 Luban 当成既定实现，而是要求 Config Architect 先做一次 Luban spike：

```text
输入：最小 map node + feature gate + shop item + achievement + starter kit + unlock matrix 表
生成：TypeScript 类型/读取代码 + JSON 数据
验证：Vite/Vitest 能 import 或加载生成产物；引用校验能挡住错误 ID
输出：是否正式采用 Luban，以及 fallback 方案
```

采用 Luban 的前提：

- 能在 macOS 本地用可复现命令生成 TypeScript + JSON。
- 生成物能被 `prototype-web` 的 Vite/TypeScript 流水线消费。
- 每个系统保持独立表，不被工具结构反向合并成巨型表。
- 生成命令能进入 npm script 或 tools script，并在 CI 与各 worktree 中重复运行。
- 生成产物目录、手写 adapter、schema 源文件边界清楚。

如果 Luban spike 失败，fallback 是保留手写 TypeScript config + Vitest validator，但字段和表边界必须保持与 Luban 方案兼容，避免后续迁移重写系统逻辑。

建议文件边界：

```text
prototype-web/config/luban/Defines/**
prototype-web/config/luban/Datas/**
prototype-web/config/luban/luban.conf
prototype-web/src/generated/config/**
prototype-web/src/config/schema/ids.ts
prototype-web/src/config/schema/definitions.ts
prototype-web/src/config/data/cards.config.ts
prototype-web/src/config/data/enemies.config.ts
prototype-web/src/config/data/activityLevels.config.ts
prototype-web/src/config/data/crawlers.config.ts
prototype-web/src/config/data/starterKits.config.ts
prototype-web/src/config/data/rewardPools.config.ts
prototype-web/src/config/data/mapNodes.config.ts
prototype-web/src/config/data/featureGates.config.ts
prototype-web/src/config/data/shops.config.ts
prototype-web/src/config/data/blacksmithServices.config.ts
prototype-web/src/config/data/achievements.config.ts
prototype-web/src/config/data/unlockRules.config.ts
prototype-web/src/config/data/first3HoursUnlockMatrix.config.ts
prototype-web/src/config/data/relics.config.ts
prototype-web/src/config/data/arcana.config.ts
prototype-web/src/config/data/gems.config.ts
prototype-web/src/config/data/permanentUpgrades.config.ts
prototype-web/src/config/data/collectionEntries.config.ts
prototype-web/src/config/data/pressureSchedules.config.ts
prototype-web/src/config/data/bosses.config.ts
prototype-web/src/config/data/elites.config.ts
prototype-web/src/config/data/reaperPressure.config.ts
prototype-web/src/config/loader/gameConfig.ts
prototype-web/src/config/validation/validateGameConfig.ts
prototype-web/src/config/validation/references.ts
prototype-web/src/config/validation/invariants.ts
prototype-web/src/config/services/*.ts
```

P0 需要迁移或镜像到 config 的内容：

- D1-D4 activity level 数据。
- starting hand、reward card pool、starter kits。
- 卡牌定义、奖励分支、升级槽位、稀有度、文案、标签。
- 敌人基础表。
- map nodes、feature gates、shop items、achievements、unlock rules。
- boss、elite、reaper-like pressure schedule。
- 路线候选、路线文案、路线 modifier、奖励倾向。
- Blacksmith 的 run-local 服务规则和 gem 默认数值。

每个系统的独立配置表至少包括：

| 系统 | 配置表 | 关键字段 |
| --- | --- | --- |
| Feature Gates | `feature_gates` | `featureId`、`defaultState`、`unlockRuleId`、`visibility`、`debugOverride` |
| Unlock Rules | `unlock_rules` | `unlockRuleId`、`trigger`、`conditions`、`rewardPatch`、`targetFeatureIds` |
| First 3 Hours Matrix | `first3_hours_unlock_matrix` | `trigger`、`mapNodeId`、`featureGateId`、`achievementIdOrSentinel`、`uiState`、`nextGoal`、`visibility` |
| Map Stages | `map_nodes` | `mapNodeId`、`stageId`、`difficultyTier`、`pressureType`、`unlockRuleId`、`nextNodeIds` |
| Boss / Elite / Reaper Pressure | `pressure_schedules`、`bosses`、`elites`、`reaper_pressure` | `pressureId`、`stageRange`、`triggerRuleId`、`enemyPoolId`、`timerOrThreatBudget`、`unlockRuleId` |
| Crawler | `crawlers` | `crawlerId`、`starterKitIds`、`passivePreview`、`unlockRuleId`、`visibility` |
| Starter Kit | `starter_kits` | `starterKitId`、`deckEntries`、`openingHandBias`、`unlockRuleId` |
| Shop | `shop_items` | `shopItemId`、`category`、`price`、`currencyId`、`servicePermitId`、`unlockRuleId` |
| Blacksmith | `blacksmith_services` | `serviceId`、`effectType`、`runLocal`、`targetCardTags`、`requiresPermitId` |
| Achievements | `achievements` | `achievementId`、`trackedEvent`、`threshold`、`rewardPatch`、`visibility` |
| Relic / Arcana | `relics`、`arcana` | `id`、`effectPreview`、`runModifierId`、`unlockRuleId`、`visibility` |
| Gem | `gems` | `gemId`、`color`、`effectType`、`value`、`unlockRuleId` |
| Permanent Upgrades | `permanent_upgrades` | `upgradeId`、`upgradeType`、`choiceSpaceEffect`、`unlockRuleId`、`maxRank` |
| Collection | `collection_entries` | `entryId`、`kind`、`sourceId`、`seenTrigger`、`conditionText` |

暂时保留在代码里的内容：

- 抽牌、弃牌、保留、消耗区移动。
- FSM、事件队列、伤害结算、敌人格位几何。
- `0 -> 1 -> 2` 授权链算法本体。
- `WorldState / Intent / GameEvent` 局内状态模型。
- Debug trace、QA 辅助状态。

### 9.2 Run Loop Orchestrator

这是新增的一等模块，也是 P0 最关键的 owner。它独占局外状态推进。

状态流：

```text
NewProfile
-> Hub
-> MapNodeSelected
-> RunStarting
-> RunActive
-> Settlement
-> HubReview
-> ShopAction
-> NextRunReady
```

Orchestrator 可以调用：

- `ProfileService`
- `FeatureGateService`
- `MapService`
- `ShopCatalogService`
- `BlacksmithDeckService`
- `AchievementService`
- `createInitialWorld(runNumber, runStartSnapshot)`
- `tickWorld(world, intents)`

Orchestrator 不允许：

- 不把 profile 挂进 `WorldState`。
- 不在 combat runtime 里直接推进 hub/map/shop/achievement。
- 不让 Map、Shop、Achievement、UI 自行触发下一节点。
- 不直接改卡牌数值或战斗算法。

combat runtime 输入输出边界：

```text
输入：RunStartSnapshot
  deck
  rewardPool
  maxHp
  maxEnergy
  mapNodeId
  activityLevelId
  pressureProfile
  enabledRunStartModifiers

运行：tickWorld(world, intents)

输出：RunSettlementSummary / GameEvent projection / CombatStatsSummary
```

### 9.3 Profile Save & Meta

保存账号层永久状态。

Profile 可以保存：

- profile version。
- 货币。
- 最高地图节点或已完成节点。
- feature unlocks。
- achievement progress / completed achievements。
- shop purchases。
- selected starter kit。
- unlocked starter kits。
- unlocked service permits。
- seen cards / seen enemies / seen locked previews。

Profile 不允许保存：

- run 内卡牌等级。
- run 内 gem/socket。
- run 内 reward choices。
- activity 临时 carryover。
- 当前手牌、抽牌堆、弃牌堆、敌人状态。
- 永久攻击、HP、Max MP 裸数值。

### 9.4 Crawler & Starter Build

这是新增的一等产品模块。竞品中的 Crawler 是下一局构筑入口，不能只藏在 Shop 或 Config 里。

P0 只做：

- 一个默认 Crawler。
- 两个锁定 Crawler 预览。
- 默认 starter kit。
- `Stable Chain` starter kit。
- starter kit 影响下一局起手或 deck entry，不提供永久伤害。

P0 不做完整 Crawler 技能差异。角色技能、被动、武器差异进入 P2/P3。

### 9.5 Map, Stage Gates & Pressure Schedule

职责：

- 地图节点可见性。
- D1-D4 节点推进。
- D2/D3/D4 解锁。
- D1 stage goal pressure。
- D4 污染首秀。
- locked D5-D10 preview。
- feature gate 的地图来源。

P0 地图最小结构：

```text
D1 可选
D2 locked preview
D3 locked preview
D4 locked preview，标记污染首秀
D5-D10 backlog preview，不可进入
```

D1 必须有 stage goal pressure。可接受实现：

- mini-boss marker。
- elite marker。
- boss marker。
- stage clear countdown。
- clear target indicator。

P0 不要求完整 Reaper。

### 9.6 Shop Catalog & Economy Facade

职责：

- 商品来自 config。
- 商品可见性和锁定原因。
- 价格。
- 货币扣减。
- 购买记录。
- transaction result。

Shop Facade 不懂 deck mutation，不直接改 combat runtime。

P0 只允许一种货币，例如 `清算声望`。货币来源：

- D1 completion 固定基础值。
- 首次成就一次性奖励。
- 失败少量保底可以后置，P0 可不做。

P0 商品锁死：

1. `Starter Kit: Stable Chain`
2. `Blacksmith Voucher: Raise Level`
3. `Gem Slot Permit`
4. `Reward Reroll Permit`

### 9.7 Blacksmith & Deck Services

职责：

- starter kit 对下一局起手或 deck entry 的影响。
- `raise-level` 服务。
- `add-gem-slot` 服务。
- `socket-gem` 服务。
- `reward reroll` 权限。
- delete card 的 locked preview。

Blacksmith 不扣货币，不判断商品价格。它只消费 Orchestrator 或 Shop 输出的 service permit。

所有 Blacksmith 效果默认 run-local：

- 卡牌等级不写入 profile。
- gem slot 不写入 profile。
- socket-gem 不写入 profile。
- profile 只能保存服务解锁、购买权限或下局入口。

### 9.8 Achievements & Unlocks

职责：

- 消费 `GameEvent projection`、`RunSettlementSummary`、shop transaction、map progression。
- 更新 achievement progress。
- 幂等发放奖励。
- 输出 unlock/profile patch。

Achievement 不允许：

- 不直接调用 HUD。
- 不直接调用 combat runtime。
- 不直接改 WorldState。
- 不直接给永久攻击、HP、Max MP。

`first_3_hours_unlock_matrix` 是 achievement id 的唯一真相源。成就表、UI、测试和 settlement projection 不得另起 `first_clearance`、`first_forging` 之类同义 ID。

首批 achievement id：

| Achievement | Trigger | Reward / Unlock | Phase |
| --- | --- | --- | --- |
| `first_run_completed` | 完成第一局结算 | Shop 解锁 + 少量清算声望 | P0 |
| `clear_d1` | D1 胜利 | D2 解锁，starter/basic blacksmith 入口 condition-visible | P0 |
| `chain_certified` | 一局内完成若干次 `0 -> 1 -> 2` 授权 | `Stable Chain` 上架 | P0/P1 |
| `first_purchase` | 完成第一次局外购买 | 下一局 loadout preview 解锁 | P0 |
| `clear_d2` | D2 结算或胜利 | D3 hinted/unlocked，成就页完整入口 | P1 |
| `build_survived_d3` | 使用已购买服务或 starter 通过 D3 | D4 污染准备目标，第二个服务上架 | P2 |
| `reach_pollution` | 首次到达 D4 污染节点 | 污染/净化说明与 D5-D10 hinted | P2/P3 |

### 9.9 UI Information Architecture

局外 UI 至少包含：

- Hub。
- Map。
- Crawler / Starter Kit。
- Shop。
- Blacksmith。
- Achievements / Unlocks。
- Settlement / Hub Review。
- Profile Summary。

战斗 HUD 继续只服务局内：

- 手牌。
- 费用链。
- 敌人意图。
- route/reward/settlement 的局内信息。

战斗 HUD 不承载局外商店、成就、profile、map unlock 的主信息。

P0 UI 的关键不是页面数量，而是第一局后只突出一个主目标：

```text
去商店完成一次轻量购买，让下一局发生可见变化。
```

### 9.10 Integration QA

职责：

- 跨组 contract tests。
- long-loop browser QA。
- reload 验收。
- desktop/mobile 截图。
- 端口和浏览器 cleanup。
- 合并门槛仲裁。

## 10. First 3 Hours Unlock Matrix

`first_3_hours_unlock_matrix` 是唯一解锁真相源。它必须作为 config/test fixture 被 validator、E2E 和 UI state test 共用。

字段：

```text
trigger
mapNode
featureGate
achievement
uiState
nextGoal
visibility
```

`achievement` 列必须是已存在的 achievement id，或明确 sentinel：`none` 表示该 trigger 不触发成就，`unchanged` 表示只校验已完成成就保持不变。禁止写说明性文本。

`visibility` 取值建议：

```text
hidden
hinted
condition_visible
unlocked
```

P0-P2 矩阵骨架：

| Trigger | Map Node | Feature Gate | Achievement | UI State | Next Goal | Visibility |
| --- | --- | --- | --- | --- | --- | --- |
| 新建档案 | 仅 D1 可选，D2+ 锁定 | `hub`、`map`、`runStart`、`basicBattle` 开 | `none` | Hub 显示进入 D1 主按钮 | 完成第一局 | D1 unlocked，D2 hinted |
| D1 结算 | D1 完成标记，D2 预览 | `settlement`、`currency`、`achievementSummary`、`shopFacade` 开 | `first_run_completed` | 强制回 Hub，显示货币和成就进度 | 去 Shop 做第一次购买 | Shop condition_visible |
| D1 胜利 | D2 解锁 | `starterKitShop` 或 `basicBlacksmith` 开 | `clear_d1` | Shop 出现推荐购买 | 购买让下一局变化的选项 | D2 unlocked |
| 首次购买完成 | D2 可进入 | `nextRunLoadoutPreview` 开 | `first_purchase` | Hub/Map 显示下一局变化 | 进入 D2 验证变化 | Purchased item unlocked |
| D2 结算 | D3 解锁或预览 | `achievementPage` 完整入口开 | `clear_d2` | 成就页显示 2-3 个短目标 | 选择一个目标打下一局 | D3 hinted/unlocked |
| 行为型目标达成 | 地图节点不直接变化 | 目标对应 feature gate 开 | `chain_certified` | 成就页显示构筑行为奖励 | 购买或选择 `Stable Chain` 相关入口 | Reward condition_visible |
| D3 结算 | D4 污染节点预告 | `blacksmithDeckService` 扩展项开 | `build_survived_d3` | Shop 解锁第二个服务 | 为 D4 污染准备 | D4 condition_visible |
| D4 首次到达 | D4 污染首秀 | `pollutionInfo`、`cleansePreview` 开 | `reach_pollution` | 地图和结算解释污染 | 理解污染/净化取舍 | D5-D10 hinted only |
| Reload profile | 保留最高节点和已解锁功能 | `profilePersistence` 验证 | `unchanged` | Hub 显示继续状态 | 确认账号成长真实存在 | Profile unlocked |

## 11. P0 端到端流程

### 11.1 新档

初始状态：

- Profile 创建。
- 默认 Crawler 可选。
- 默认 starter kit 可用。
- D1 可选。
- D2-D4 锁定预览。
- 成就后台 tracking 开启。
- Shop 灰态或 hidden，由 matrix 决定。

### 11.2 D1 战斗

D1 继续使用当前超高速回合制卡牌压力。必须保持：

- 首手可读的 `0 -> 1 -> 2` 或 `0 -> 1 -> payoff` 路线。
- 敌人意图清晰。
- reward / route / settlement 不退化。
- 无自动攻击作为核心底盘。

D1 新增 stage goal pressure 的玩家可见表达。

### 11.3 D1 后回 Hub

D1 结算后不自动进入 D2。Orchestrator 必须推进到 `HubReview`。

HubReview 显示：

- 本局结果。
- 货币变化。
- 成就进度。
- Shop 解锁或购买提示。
- 下一目标：去 Shop 做一次轻量购买。

### 11.4 第一次购买

P0 推荐购买路径：

- `Stable Chain` starter kit，或
- `Blacksmith Voucher: Raise Level`。

UI 只能强推一个主推荐，另一个可以灰态预告或次级可见。

购买结果：

- profile 保存 purchase/unlock。
- 下一局 loadout preview 变化。
- 不直接改当前 `WorldState`。

### 11.5 下一局变化

进入 D2 前，玩家必须看到：

- 已选择 starter kit，或
- 已获得 Blacksmith service opportunity。

变化必须能在 sim test 和 browser QA 中被验证。

### 11.6 Reload 边界

刷新后必须保留：

- profile。
- 货币。
- achievement progress/completion。
- shop purchase。
- selected starter kit。
- unlocked feature gates。

刷新后不得保留：

- run 内卡牌等级。
- run 内 gem slot。
- run 内 socket。
- run 内 reward temporary choices。
- activity 临时状态。

## 12. Worktree 分组与长循环迭代合同

每个 worktree 小组都必须交付自己的长循环 slice。禁止只交付孤立模块单测。进入主线合并前，小组层面必须完成一轮；单个 agent 提交职责内证据，group owner 负责汇总为可验收的 loop slice：

```text
设计更新
-> 红灯测试
-> 最小实现
-> 本组 sim/ui 测试
-> 浏览器或 QA 证据
-> 自评缺口和下一轮 loop item
```

每个 worktree 小组默认不是单 agent 串行开发，而是一个并行 agent 编队。默认分配 3 个 agent，复杂组视情况扩到 4-6 个，硬上限为 6 个。主线程负责 PM、规格、合并顺序、交叉验收和风险仲裁，不承担每组的重体力实现。

### 12.0 并行 Agent 编队规则

每个 worktree 的推荐编队：

| 角色 | 默认职责 | 推荐模型级别 | 产出 |
| --- | --- | --- | --- |
| System Architect | 模块边界、接口、数据流、与 Orchestrator/Profile/Config 的依赖关系 | 高推理/最高级模型 | 架构草案、风险清单、禁止跨界点 |
| Gameplay / Product Owner | 确保本组功能推动下一局目标，而不是只完成技术模块 | 高推理模型 | 玩家闭环、验收场景、P0-P4 切片 |
| Implementation Agent | 按测试实现最小代码，遵守写入范围 | Coding-optimized 模型 | 代码变更和本组测试 |
| Test / Contract Agent | 先写红灯测试，维护本组 sim/ui/integration 合同 | Coding-optimized 或中高推理模型 | 测试文件、失败/通过证据 |
| Browser QA / UX Agent | 跑真实页面、移动端、reload、截图和 DOM 摘要 | 快速模型或中档模型 | 浏览器证据、可见问题清单 |
| Integration Reviewer | 复杂组启用；审查与其他 worktree 的冲突、合并风险和回归范围 | 高推理模型 | 合并建议、冲突报告、返工清单 |

模型分配原则：

- 架构、跨系统边界、长期路线和疑难失败使用最高级/高推理模型。
- 明确实现、局部测试、机械迁移使用 coding-optimized 模型。
- 浏览器巡检、截图整理、文案溢出检查和重复 QA 可以使用更快、更低成本模型。
- 同一组内默认 3 个 agent 并行；超过 3 个必须说明复杂度理由，超过 6 个必须拆成两个 worktree 或两个阶段，避免主线程无法审查。
- agent 不共享隐式上下文；每个 agent 的 prompt 必须包含写入范围、禁止事项、验收证据和当前阶段目标。
- 每组必须有一个架构师职责，不允许只有实现 agent。
- 每组至少有一个测试/QA 职责，不允许只交代码。

不同类型小组的推荐编队：

| Worktree 类型 | Agent 数 | 必备角色 | 可选角色 |
| --- | ---: | --- | --- |
| Config / Luban | 3-6 | System Architect、Implementation Agent、Test Agent | Integration Reviewer、Gameplay/Product、工具链 spike、QA |
| Profile / Save | 3-5 | System Architect、Implementation Agent、Test Agent | QA、Integration Reviewer、Migration 专家 |
| Orchestrator | 4-6 | System Architect、Gameplay/Product、Implementation Agent、Contract Test | Integration Reviewer、QA、状态机审查专家 |
| Map / Feature Gates | 3-5 | System Architect、Gameplay/Product、Implementation Agent | Test Agent、QA、D4/D10 平衡审查 |
| Shop / Economy | 3-5 | System Architect、Gameplay/Product、Implementation Agent | Test Agent、QA、经济平衡审查 |
| Blacksmith / Deck Services | 3-5 | System Architect、Implementation Agent、Test Agent | Gameplay/Product、Integration Reviewer、卡牌平衡审查 |
| Achievements / Unlocks | 3-5 | System Architect、Gameplay/Product、Implementation Agent | Test Agent、QA、数据完整性审查 |
| UI IA | 4-6 | UX/Product、Implementation、Browser QA | Mobile QA、Integration Reviewer、System Architect、文案/可读性审查 |
| Integration QA | 3-5 | QA Lead、Browser QA、Sim Test | Regression Reviewer、PM Reporter、性能/cleanup 审查 |

每个小组的最终回报必须包含：

```text
本轮目标
参与 agent 和职责
每个 agent 的主要发现或变更
本组 loop slice 是否可玩
测试命令和结果
浏览器/截图/reload 证据
与其他 worktree 的接口或冲突
下一轮必须继续迭代的事项
```

### 12.1 Loop Slice 总表

| Worktree | 输入 | 输出 | 玩家可见闭环 | 最少迭代 | 证据 |
| --- | --- | --- | --- | ---: | --- |
| Config | 现有 cards/enemies/activity/reward、目标态系统、unlock matrix、Luban spike | schema、loader、validator、services、fixture、生成链路裁决 | 所有 UI/系统状态来自同一 config | 3 | 引用完整性、matrix 行为、Luban PoC 或 fallback、无硬编码解锁 diff |
| Contract Tests | P0-P4 目标态和验收矩阵 | 跨组红灯测试和共享 fixture | 先定义玩家两局旅程，再让模块接入 | 2 | `long-loop-e2e`、orchestrator、unlock matrix tests |
| Profile | settlement、shop transaction、achievement patch | profile version、currency、unlocks、purchase、seen records | reload 后 Hub 恢复“我解锁了什么、下一步是什么” | 3 | profile dump、reload browser QA、run-local 不保留 |
| Orchestrator | profile、map、shop、achievement、run summary | 局外状态机和 run start/settlement adapter | D1 后回 Hub，下一目标和下一局入口清楚 | 3 | 状态机测试、非法跳转拒绝、两局 E2E |
| Map | map nodes、feature gates、activity D1-D10 规则 | P0-P2 D1-D4 解锁/预告、D5-D10 locked preview；P3 后接 D5-D10 playable progression | 打完一局后地图显示新目标和新节点状态 | 3 | map gate sim、UI state、D4 污染首秀对齐 |
| Crawler & Starter Build | crawlers、starter kits、unlock rules、run start snapshot | Crawler selector、starter kit selector、locked reason、snapshot adapter | 选择 Crawler 或 starter kit 后，下一局起手、预览或构筑身份发生可解释变化 | 3 | selector UI test、snapshot diff、browser 选择证据 |
| Shop | currency、shop config、profile purchase | catalog visibility、locked reason、transaction | 第一次购买让下一局 loadout preview 变化 | 3 | shop tests、浏览器购买、profile purchase dump |
| Blacksmith | shop permit、starter kit、run start snapshot | run-local raise-level/gem/socket/reroll opportunity | 买服务后下一局可见强化机会，结束后不永久保留 | 3 | boundary test、snapshot diff、reload 清空 |
| Achievements | event projection、settlement、shop、map progression | progress、completed、reward patch、unlock reason | 玩家看到“因为我做了 X，所以 Y 解锁” | 3 | idempotency、重复 settlement 不发奖、UI state |
| Unlock Building / Collection | unlock rules、seen events、profile、UI entry | 条件查看、seen index、locked preview、source link | 玩家能查到某个 stage/item/relic/crawler/service 为什么锁、如何解锁、见过什么 | 3 | config reference、profile seen dump、browser 条件查看 |
| Permanent Upgrades | achievement reward、shop permit、profile currency | upgrade catalog、purchase/apply、reload boundary | 至少一个永久升级改变下一局选择空间，并在 reload 后保留 | 3 | upgrade tests、profile migration、E2E reload |
| Relic / Arcana / Gem | relic/arcana/gem config、shop/blacksmith permit、run start snapshot | 首批池、解锁来源、modifier/slot 接入 | 玩家解锁或购买后，下一局出现可解释的 modifier、arcana 或 gem slot 变化 | 3 | config validation、run snapshot diff、browser item proof |
| D5-D10 / Pressure | map nodes、feature gates、settlement progression、pressure config | D5-D10 playable chain、boss/elite/reaper-like pressure | 玩家从 D4 后继续推进，并看到后段压力改变准备策略 | 3 | map progression E2E、pressure sim、browser D5-D10 path |
| UI IA | orchestrator state、profile summary、selectors | Hub/Village、Map、Crawler、Shop、Blacksmith、Achievements、Settlement、Profile Summary | 第一局后只突出一个下一目标，P1 后全部局外入口可浏览 | 4 | desktop/mobile 截图、真实点击、无溢出 |
| Integration QA | contract tests、browser path、profile dump、合并候选 | qa-long-loop、截图、DOM 摘要、端口清理、合并判定 | 新档连续走到 D1/D2、购买、reload、下一局变化 | 每阶段 2 | `check`、`qa:ui`、`qa-long-loop`、浏览器证据 |

### 12.2 Config Architect

职责：

- 定义 config schema。
- 评估并验证 Luban TypeScript + JSON 生成链路。
- 建立 loader、validator、readonly services。
- 提供旧数据兼容导出。
- 建立 `first3HoursUnlockMatrix.config.ts`。

写入范围：

```text
prototype-web/config/luban/**
prototype-web/src/generated/config/**
prototype-web/src/config/**
prototype-web/src/tests/config/**
prototype-web/scripts/generate-config*
prototype-web/src/data/* 兼容导出，必要时
```

禁止：

- 不改 combat runtime。
- 不一次性迁移所有逻辑。
- 不引入完整框架。
- 不把所有系统合并到一张配置表。
- Luban spike 未通过前，不强迫下游依赖不可复现的生成产物。

### 12.3 Contract Tests

职责：

- 先写 P0 跨组红灯测试。
- 让后续组共享同一验收语言。

写入范围：

```text
prototype-web/src/tests/integration/long-loop-e2e-acceptance.test.ts
prototype-web/src/tests/sim/long-loop-orchestrator-state-machine.test.ts
prototype-web/src/tests/sim/first-3-hours-unlock-matrix.test.ts
```

### 12.4 Profile Save & Meta

写入范围：

```text
prototype-web/src/profile/**
prototype-web/src/save/**
prototype-web/src/tests/sim/profile-persistence-boundary.test.ts
```

### 12.5 Run Loop Orchestrator

写入范围：

```text
prototype-web/src/loop/**
prototype-web/src/tests/sim/long-loop-orchestrator-state-machine.test.ts
```

只允许通过 adapter 调用 combat runtime。

### 12.6 Map & Feature Gates

写入范围：

```text
prototype-web/src/map/**
prototype-web/src/featureGates/**
prototype-web/src/tests/sim/feature-gate-map.test.ts
```

### 12.7 Crawler & Starter Build

写入范围：

```text
prototype-web/src/crawlers/**
prototype-web/src/starterKits/**
prototype-web/src/tests/sim/crawler-starter-selection.test.ts
prototype-web/src/tests/ui/crawler-starter-selector.test.ts
```

验收要求：

- Crawler 和 starter kit 都来自独立配置表。
- locked reason 来自 unlock rule 或 feature gate，不在 selector 中硬编码。
- 选择结果写入 `RunStartSnapshot`，不直接改 combat runtime 内部状态。
- 至少一个 P2 starter 或 Crawler 选择能改变下一局起手、预览或构筑身份。

### 12.8 Shop Catalog & Economy Facade

写入范围：

```text
prototype-web/src/shop/**
prototype-web/src/tests/sim/shop-catalog-economy-facade.test.ts
```

### 12.9 Blacksmith & Deck Services

写入范围：

```text
prototype-web/src/cardServices/**
prototype-web/src/tests/sim/blacksmith-deck-services-boundary.test.ts
```

### 12.10 Achievements & Unlocks

写入范围：

```text
prototype-web/src/achievements/**
prototype-web/src/unlocks/**
prototype-web/src/tests/sim/achievement-idempotency.test.ts
```

### 12.11 UI IA

写入范围：

```text
prototype-web/src/ui/**
prototype-web/src/style.css
prototype-web/src/tests/ui/long-loop-ui-state.test.ts
```

UI 组可以拆分局外 shell，但不得让战斗 HUD 承担局外信息。

### 12.12 Integration QA

写入范围：

```text
prototype-web/src/tests/integration/**
prototype-web/scripts/qa-long-loop.mjs
outputs/browser-qa/long-loop/**
design/technical/redline-batches/**
```

## 13. 阶段门与合并顺序

合并不再理解为一次性线性模块队列，而是阶段门。每个阶段都要有可玩的长循环 slice 和 QA 证据。

### 13.1 P0 架构合同阶段

必须先合：

1. Config schema / loader / validator / services / compatibility exports。
2. Contract tests stub。
3. Profile save / persistence boundary。
4. Run Loop Orchestrator。

P0 门槛：

- `RunStartSnapshot`、`RunSettlementSummary`、profile patch、shop transaction、achievement patch 合同稳定。
- `long-loop-e2e` 能表达至少两局合同：`new profile -> D1 -> hub -> purchase -> D2 -> settlement -> unlock preview -> reload`。
- 所有目标态局外系统至少有 config/profile/feature gate/UI preview/backlog contract。

### 13.2 P1 完整局外骨架阶段

P1 可以并行推进：

- Map / feature gates / unlock matrix wiring。
- Shop Catalog & Economy Facade。
- Blacksmith & Deck Services。
- Achievements & Unlocks。
- UI IA。
- Integration QA shadow reviewer。

P1 门槛：

- Hub 上所有目标态局外入口都可见、condition-visible 或有明确 locked reason。
- 核心路径系统完成 locked/condition_visible/unlocked 到“影响下一局”的闭环：Map、Shop、Blacksmith、Achievements、Profile、Settlement。
- 非核心目标系统至少不能缺入口、缺配置表或缺 profile 预留：Unlock Building、Permanent Upgrades、Relic/Arcana/Gem、Collection、Crawler/Starter。
- 每个 worktree 完成自己的 loop iteration contract。
- Integration QA 从 P1 开始持续维护 `qa-long-loop`，不是最后才介入。

### 13.3 P2 内容深度与竞品补齐阶段

P2 必须补齐所有目标态系统的首轮可玩闭环：

- D2-D4 更完整解锁节奏。
- Unlock Building 条件查看，至少覆盖 stage/item/service/relic/crawler 中三类。
- 更多 starter kit、shop item、achievement target。
- Blacksmith gem/socket/reroll 链。
- relic/arcana/gem 目标态的首批可用内容。
- Permanent Upgrades 至少一个改变选择空间的永久升级，reload 后保留。
- Collection / Seen Index 至少三类 seen entry 从事件写入 profile 并在 UI 可查。
- D5-D10 locked preview 和 backlog 数据完善，不能被误标为 playable。

P2 门槛：

- 每个目标态系统都有验收矩阵行，且 `configSource / profileFields / uiState / unlockSource / nextRunImpact / reloadProof / e2eProof / browserProof` 均已填写。
- 每个目标态系统都有独立配置表或明确的 no-config 理由；本 spec 默认所有局外目标系统都必须有独立配置表。
- P2 不允许把 Permanent Upgrades、Relic/Arcana/Gem、Collection、Unlock Building 继续留在 purely locked preview。

### 13.4 P3 D5-D10 与后段压力阶段

P3 聚焦：

- D5-D10 playable progression。
- boss/elite/reaper-like pressure。
- 后段 unlock 链接入 `first_3_hours_unlock_matrix` 或后续矩阵扩展。
- 后段内容不会绕过 P2 已建立的 config/profile/UI/reload 合同。

P3 门槛：

- 玩家能从 D4 后继续进入 D5+，并通过 QA 证明不是只显示 locked preview。
- 至少一个后段压力机制影响玩家下一局准备，例如路线选择、service 购买、starter/relic/arcana/gem 取舍。
- D5-D10 progression 有 sim/E2E/browser 证据。

### 13.5 P4 平衡、留存和最终收口阶段

P4 聚焦：

- 首 3 小时目标链。
- D1-D4 连续跑。
- D1-D10 连续推进抽样。
- reload、失败保底、移动端、浏览器 QA。
- 玩家评分和停线。

P4 门槛：

- 最终验收表中所有硬阻塞为 0。
- 每个目标系统的验收矩阵 verdict 为 `pass`。
- Browser QA 覆盖 desktop 和 mobile，包含真实点击、reload 和 profile dump。
- 多专家严格评估通过；未通过则回到对应 worktree 下一轮长循环。

任何组不得绕过 Config、Orchestrator 和 `first_3_hours_unlock_matrix` 自证通过。

## 14. 测试计划

必须先写或补齐以下测试。

### 14.0 Config / Luban Spike

```text
prototype-web/src/tests/config/config-schema.test.ts
prototype-web/src/tests/config/config-generation-boundary.test.ts
```

验证：

- 每个系统有独立配置表和独立 query service。
- Luban spike 能生成 TypeScript + JSON，或明确记录 fallback 原因。
- 生成物或 fallback config 能被 Vite/Vitest 消费。
- 引用错误的 map node、feature gate、shop item、achievement、starter kit、relic、arcana、gem 会失败。
- P0 未实装系统也有 locked preview/backlog contract。
- 任何模块不得绕过 config 硬写解锁顺序。

### 14.1 Contract

```text
prototype-web/src/tests/integration/long-loop-e2e-acceptance.test.ts
```

验证：

- 新档创建。
- D1 可进入。
- D1 结算后回 Hub。
- profile 获得货币和成就进度。
- Shop 解锁。
- 一次轻量购买成功。
- 下一局起手或强化机会变化。
- D2 可进入，并能读取 D1 后购买带来的 run start 差异。
- D2 结算后至少出现一个新的 unlock preview、achievement target 或 map next goal。
- reload 后 profile 保留。
- run 内强化不保留。
- P0-P2：D5-D10 仍为 locked preview，不可进入 playable。
- P3/P4 扩展：D5-D10 必须有 playable E2E 路径，证明后段 progression 已从 preview 变成可玩。

### 14.2 Orchestrator

```text
prototype-web/src/tests/sim/long-loop-orchestrator-state-machine.test.ts
```

验证：

- 合法状态跳转。
- 非法跳转被拒。
- 战斗中不能打开 Shop 改 profile。
- settlement 后只能由 Orchestrator 回 Hub。
- 重复提交幂等。

### 14.3 Unlock Matrix

```text
prototype-web/src/tests/sim/first-3-hours-unlock-matrix.test.ts
```

验证：

- 每一行 matrix 引用的 map node、feature gate、UI state 都存在；achievement 列必须是已存在 achievement id、`none` 或 `unchanged`。
- trigger 发生后，map node、feature gate、achievement、UI state、next goal、visibility 同步变化。
- P0-P2：D5-D10 不会进入 playable。
- P0-P2：D4 污染首秀和 D5-D10 locked preview 不会被 P0 Shop 闭环覆盖或绕过。
- P3/P4：D5-D10 progression、后段 pressure 和 unlock 链必须有独立 matrix 或矩阵扩展行，不能复用 P0-P2 的 locked preview 断言。

### 14.4 Profile Persistence

```text
prototype-web/src/tests/sim/profile-persistence-boundary.test.ts
```

验证：

- 新档 roundtrip。
- migration。
- reload persistence。
- 永久解锁保留。
- activity/run 临时字段不保留。
- 账号 Profile 不得吞入 activity carryover；D1-D4 activity 内继承仍按旧 spec 边界运作。

### 14.5 Crawler & Starter Build

```text
prototype-web/src/tests/sim/crawler-starter-selection.test.ts
prototype-web/src/tests/ui/crawler-starter-selector.test.ts
```

验证：

- Crawler 和 starter kit 来自独立 config。
- locked reason 与 unlock rule 一致。
- 选择 Crawler 或 starter kit 后，`RunStartSnapshot` 变化。
- reload 后已解锁的选择空间保留，但单局临时改造不保留。

### 14.6 Shop Facade

```text
prototype-web/src/tests/sim/shop-catalog-economy-facade.test.ts
```

验证：

- 商品来自 config。
- locked/unlocked/condition_visible 状态。
- 购买扣货币。
- 非法购买拒绝。
- shop 不直接改 deck。

### 14.7 Blacksmith Boundary

```text
prototype-web/src/tests/sim/blacksmith-deck-services-boundary.test.ts
```

验证：

- service permit 可生成下一局变化。
- `raise-level`、`add-gem-slot`、`socket-gem` 默认 run-local。
- reload 不保留 run 内强化。
- Blacksmith 不直接扣货币。

### 14.8 Achievements

```text
prototype-web/src/tests/sim/achievement-idempotency.test.ts
```

验证：

- 事件计数。
- 条件达成。
- 奖励发放。
- 重复触发幂等。
- 只写 profile patch，不改 runtime。

### 14.9 UI

```text
prototype-web/src/tests/ui/long-loop-ui-state.test.ts
```

验证：

- Hub/Map/Shop/Blacksmith/Achievements/Settlement 页面状态。
- locked/condition_visible/unlocked 文案。
- 下一目标清晰。
- 移动端不溢出。
- 战斗 HUD 不混入局外商店/成就信息。

## 15. Browser QA

新增 long-loop browser QA。最低覆盖：

- Desktop：`1440x1000` 或 `1280x720`。
- Mobile：`390x844` 或 `360x640`。
- 新档进入 Hub。
- 选择 D1。
- 完成或模拟 D1 结算。
- 回 Hub。
- Shop 解锁前后状态。
- 完成一次购买。
- 下一局 loadout preview 变化。
- 进入 D2，并确认 D1 后购买产生的下一局差异仍可见。
- D2 结算后出现新的 unlock preview、achievement target 或 map next goal。
- P0-P2：Unlock Building / Collection / Relic / Arcana / D5-D10 等目标态系统至少显示 locked preview、condition-visible 或 empty state，且不能被标为完成。
- P3/P4：D5-D10 必须覆盖 playable browser path；玩家能从 D4 后进入 D5+，并看到后段压力、奖励或解锁变化。
- reload 后 profile 保留。
- run 内强化不保留。

QA 结束必须记录：

- 命令结果。
- 浏览器截图或 DOM 摘要。
- localStorage/profile dump 摘要。
- 端口清理或保留原因。
- 真实点击证据。

## 16. 最终收口与严格专家评估

最终收口不是“提交一份报告就算完成”。P4 完成后必须派出严格评估组做独立审查；如果审查未通过，不能交付，必须把失败项拆回对应 worktree，继续下一轮长循环。

### 16.1 最终评估组

最终评估组默认 5 个专家，最多 6 个，任何人不得同时充当实现 owner 和最终 pass 决策者。

| 专家角色 | 审查重点 | 必须输出 |
| --- | --- | --- |
| PM / Competitive Parity Reviewer | 是否全面对齐 Vampire Crawlers-like 局外系统，是否有竞品关键职能缺失 | 缺口清单、目标系统 pass/fail |
| Progression & Economy Designer | 首 3 小时目标链、货币、失败保底、永久成长是否健康 | 进度/经济风险、返工建议 |
| Systems UX Reviewer | Hub、Map、Shop、Blacksmith、Unlock Building、Collection 等入口是否清晰 | UI 状态、信息架构、移动端问题 |
| Game Programmer Architecture Reviewer | Config/Profile/Orchestrator/Runtime 边界是否被破坏 | 架构阻塞、硬编码/耦合问题 |
| QA Automation Reviewer | sim/ui/E2E/browser/reload 证据是否真实覆盖验收矩阵 | 命令结果、缺失测试、复现路径 |
| Config/Luban Reviewer | 复杂阶段启用；检查独立配置表、Luban spike 或 fallback、引用校验 | 配表风险、生成链路判定 |

### 16.2 最终验收评分

每个专家必须给出 `pass / fail`，并按 100 分制评分。最终状态只允许三种：

| 状态 | 条件 | 动作 |
| --- | --- | --- |
| `pass` | 全部专家 pass；总分平均不低于 90；无硬阻塞；所有目标系统矩阵 verdict 为 pass | 可以进入交付总结 |
| `conditional_fail` | 平均分不低于 90，但存在低风险缺口或非阻塞 polish | 建立短 loop，修完后由相关专家复核 |
| `fail` | 任一硬阻塞、任一目标系统未闭环、任一专家明确 fail、平均分低于 90 | 不交付，拆回 worktree 长循环 |

硬阻塞包括：

- 任一目标态局外系统没有独立配置表逻辑。
- 任一目标态局外系统没有 UI entry、unlock source、next-run impact 或 reload 边界。
- Permanent Upgrades、Relic/Arcana/Gem、Collection、Unlock Building 任一仍只是 preview，没有 P2 首轮闭环。
- D5-D10 在 P3/P4 仍只是 locked preview。
- Browser QA 只有脚本结果，没有真实页面点击、截图或 DOM/profile 证据。
- run-local 强化、gem、socket、reroll 被错误写成永久成长。
- 任一 worktree 没有完成小组级 loop slice 证据。

### 16.3 未通过后的继续机制

未通过时，Integration QA 不能把状态写成 done，只能写成 `needs_next_loop`。PM 主线程必须把每个失败项映射到：

```text
blockerId
owningWorktree
failedAcceptanceField
expertWhoRejected
requiredEvidence
nextLoopScope
rerunCommands
browserPathToVerify
```

下一轮 worktree 只处理这些 blocker，不得顺手扩大范围。修完后重新跑对应阶段门；如果触碰共享合同，还要重跑最终集成门槛和相关专家复核。

## 17. 风险与缓解

| 风险 | 表现 | 缓解 |
| --- | --- | --- |
| Orchestrator 变成第二个 runtime | 局外层开始处理战斗细节 | Orchestrator 只接 RunStartSnapshot 和 SettlementSummary |
| Config 变巨型框架 | 第一阶段迟迟无法合并 | 第一阶段只做 schema、loader、validator、services、兼容导出 |
| 各组硬写解锁顺序 | Map/UI/Shop/Achievement 互相不一致 | `first_3_hours_unlock_matrix` 是唯一真相源 |
| Shop 直接改 deck | 经济和卡牌服务耦合 | Shop 输出 transaction/result，Blacksmith 消费 permit |
| Blacksmith 变永久成长 | reload 后保留卡牌等级或 gem | 测试强制 run-local，profile 只存服务权限 |
| D1 后旅程断裂 | 玩家打完直接进 D2 或不知道下一步 | D1 后强制回 Hub，主目标是一次轻量购买 |
| P0 被误当成最终目标 | worktree 小组只做 D1 购买演示，不补完整局外系统 | P0 只是首个切片；所有目标态系统必须进入 schema/profile/UI preview |
| Unlock Building 缺位 | 玩家不知道 stage/item/relic/crawler/service 如何解锁 | Unlock Building 是一等系统，P0 至少有 locked preview 和条件数据 |
| 各 worktree 只交模块单测 | 模块通过但没有推动下一局 | 每组必须交 loop slice contract 和玩家可见闭环证据 |
| 没达标就交付 | 报告写成完成，但目标系统缺闭环或 QA 证据不足 | 最终专家组有 fail veto；任何硬阻塞直接回到 worktree 下一轮 |
| UI 自证但总流程失败 | 页面可看但完整循环不可玩 | 先写 long-loop E2E 和 browser reload QA |
| D4 信息过载 | 同时打开商店、成就、污染、角色、地图分支 | P0 只做 D1 后轻量购买，D4 仅做污染预告/首秀 |

## 18. 验收命令

每组最低本地门槛：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test:sim
npm run test:ui
npm run check
```

最终集成门槛：

```bash
cd /Users/roc/Game-001/prototype-web
npm run check
npm run qa:ui
node scripts/qa-long-loop.mjs
```

如果 `qa-long-loop.mjs` 尚未存在，Integration QA 组必须先实现并让它成为最终门槛的一部分。

最终验收报告必须附：

```text
git commit / branch
phase verdict
target-system matrix verdict
expert-review verdict
hard blockers count
commands run
browser evidence path
profile dump summary
remaining next_loop blockers
```

`hard blockers count` 必须为 `0`，`remaining next_loop blockers` 必须为空，才能写成完成。

## 19. Spec 批准后的下一步

用户 review 本 spec 后，下一步只允许进入 `superpowers:writing-plans`，为上述阶段门和 worktree loop slice 写 implementation plan。

implementation plan 必须：

- 每个 worktree 小组有明确 owner、写入范围、禁止事项、长循环迭代轮次和验收证据。
- 每个任务先写失败测试，再实现最小代码。
- 每轮合并前跑对应测试。
- 主线程保持 PM/规格/集成/验收，不承担所有实现重活。
