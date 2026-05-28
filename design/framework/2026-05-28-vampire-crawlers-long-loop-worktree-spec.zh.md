# Redline Vampire Crawlers-like 长循环与并行 Worktree 研发 Spec

日期：2026-05-28
状态：三轮只读专家评审已收敛，等待用户 review 后进入 implementation plan
范围：只定义长循环产品结构、模块边界、配表合同、并行 worktree 顺序和验收门槛；本 spec 不代表实现已完成。

## 1. 背景

Game-001 当前 Web prototype 已经证明了局内核心：第一人称走廊压迫、超高速回合制卡牌链、`0 -> 1 -> 2 -> payoff`、敌人意图、奖励、路线和 D1-D4 activity 推进。最新方向不是继续扩局内战斗底盘，而是补齐严格对标 `Vampire Crawlers` 的完整长循环骨架。

本轮设计遵守以下已确认约束：

- 竞品口径只对标 `Vampire Crawlers` 的长循环结构，不混入其他 roguelike 的自由扩展。
- 竞品有的长循环结构先有：hub、地图、Crawler/起手构筑、商店、Blacksmith、成就/解锁、局外档案、下一局目标。
- 竞品没有或第一版不需要的系统先不加：完整遗物池、多货币、删牌服务实装、完整角色技能、D5-D10 playable、完整 Reaper。
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

## 3. P0 目标

P0 的目标不是一次性做完整 meta progression 平台，而是验证 Vampire Crawlers-like 长循环的最小可玩闭环：

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

## 4. 非目标

P0 明确不做：

- 不做 D5-D10 playable。D5-D10 只能作为 locked preview 或 backlog 数据计划。
- 不做完整 Reaper，只允许 stage clear、elite、mini-boss 或 boss marker 级别的压力预告。
- 不做完整 Crawler 技能差异。P0 只做默认 Crawler 和锁定预览，真正变化由 starter kit 承担。
- 不做完整 relic 池。
- 不做删牌服务实装。Delete card 只能显示锁定预览。
- 不做多货币、商店随机刷新、折扣、日刷新、利息或复杂经济。
- 不做永久卡牌等级、永久 gem、永久 socket、永久攻击、永久 HP、永久 Max MP。
- 不把 Shop、Map、Achievements、Profile 信息塞进战斗 HUD。
- 不复制 `Vampire Crawlers` 的 IP、卡名、UI 构图或美术。

## 5. 总体架构

长循环拆成十个边界清晰的模块。

### 5.1 Data Contracts & Config Pipeline

这是第一合并点。职责是建立可被所有组依赖的最小稳定合同，不做巨型框架。

建议文件边界：

```text
prototype-web/src/config/schema/ids.ts
prototype-web/src/config/schema/definitions.ts
prototype-web/src/config/data/cards.config.ts
prototype-web/src/config/data/enemies.config.ts
prototype-web/src/config/data/activityLevels.config.ts
prototype-web/src/config/data/starterKits.config.ts
prototype-web/src/config/data/rewardPools.config.ts
prototype-web/src/config/data/mapNodes.config.ts
prototype-web/src/config/data/featureGates.config.ts
prototype-web/src/config/data/shops.config.ts
prototype-web/src/config/data/achievements.config.ts
prototype-web/src/config/data/unlockRules.config.ts
prototype-web/src/config/data/first3HoursUnlockMatrix.config.ts
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
- 路线候选、路线文案、路线 modifier、奖励倾向。
- Blacksmith 的 run-local 服务规则和 gem 默认数值。

暂时保留在代码里的内容：

- 抽牌、弃牌、保留、消耗区移动。
- FSM、事件队列、伤害结算、敌人格位几何。
- `0 -> 1 -> 2` 授权链算法本体。
- `WorldState / Intent / GameEvent` 局内状态模型。
- Debug trace、QA 辅助状态。

### 5.2 Run Loop Orchestrator

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

### 5.3 Profile Save & Meta

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

### 5.4 Crawler & Starter Build

这是新增的一等产品模块。竞品中的 Crawler 是下一局构筑入口，不能只藏在 Shop 或 Config 里。

P0 只做：

- 一个默认 Crawler。
- 两个锁定 Crawler 预览。
- 默认 starter kit。
- `Stable Chain` starter kit。
- starter kit 影响下一局起手或 deck entry，不提供永久伤害。

P0 不做完整 Crawler 技能差异。角色技能、被动、武器差异进入 P1/P2。

### 5.5 Map, Stage Gates & Pressure Schedule

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

### 5.6 Shop Catalog & Economy Facade

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

### 5.7 Blacksmith & Deck Services

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

### 5.8 Achievements & Unlocks

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

P0 建议三个成就：

| Achievement | Trigger | Reward |
| --- | --- | --- |
| `first_clearance` | 完成 D1 | Shop 解锁 + 少量清算声望 |
| `chain_certified` | 一局内完成若干次 `0 -> 1 -> 2` 授权 | `Stable Chain` 上架 |
| `first_forging` | 完成一次 run-local 卡牌强化 | `Gem Slot Permit` 上架 |

### 5.9 UI Information Architecture

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

### 5.10 Integration QA

职责：

- 跨组 contract tests。
- long-loop browser QA。
- reload 验收。
- desktop/mobile 截图。
- 端口和浏览器 cleanup。
- 合并门槛仲裁。

## 6. First 3 Hours Unlock Matrix

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

`visibility` 取值建议：

```text
hidden
hinted
condition_visible
unlocked
```

P0/P1 矩阵骨架：

| Trigger | Map Node | Feature Gate | Achievement | UI State | Next Goal | Visibility |
| --- | --- | --- | --- | --- | --- | --- |
| 新建档案 | 仅 D1 可选，D2+ 锁定 | `hub`、`map`、`runStart`、`basicBattle` 开 | 后台 tracking 开，成就页灰态 | Hub 显示进入 D1 主按钮 | 完成第一局 | D1 unlocked，D2 hinted |
| D1 结算 | D1 完成标记，D2 预览 | `settlement`、`currency`、`achievementSummary`、`shopFacade` 开 | `first_run_completed` | 强制回 Hub，显示货币和成就进度 | 去 Shop 做第一次购买 | Shop condition_visible |
| D1 胜利 | D2 解锁 | `starterKitShop` 或 `basicBlacksmith` 开 | `clear_d1` | Shop 出现推荐购买 | 购买让下一局变化的选项 | D2 unlocked |
| 首次购买完成 | D2 可进入 | `nextRunLoadoutPreview` 开 | `first_purchase` | Hub/Map 显示下一局变化 | 进入 D2 验证变化 | Purchased item unlocked |
| D2 结算 | D3 解锁或预览 | `achievementPage` 完整入口开 | `clear_d2` 或行为型成就 | 成就页显示 2-3 个短目标 | 选择一个目标打下一局 | D3 hinted/unlocked |
| D3 结算 | D4 污染节点预告 | `blacksmithDeckService` 扩展项开 | `build_survived_d3` | Shop 解锁第二个服务 | 为 D4 污染准备 | D4 condition_visible |
| D4 首次到达 | D4 污染首秀 | `pollutionInfo`、`cleansePreview` 开 | `reach_pollution` | 地图和结算解释污染 | 理解污染/净化取舍 | D5-D10 hinted only |
| Reload profile | 保留最高节点和已解锁功能 | `profilePersistence` 验证 | 已完成成就保留 | Hub 显示继续状态 | 确认账号成长真实存在 | Profile unlocked |

## 7. P0 端到端流程

### 7.1 新档

初始状态：

- Profile 创建。
- 默认 Crawler 可选。
- 默认 starter kit 可用。
- D1 可选。
- D2-D4 锁定预览。
- 成就后台 tracking 开启。
- Shop 灰态或 hidden，由 matrix 决定。

### 7.2 D1 战斗

D1 继续使用当前超高速回合制卡牌压力。必须保持：

- 首手可读的 `0 -> 1 -> 2` 或 `0 -> 1 -> payoff` 路线。
- 敌人意图清晰。
- reward / route / settlement 不退化。
- 无自动攻击作为核心底盘。

D1 新增 stage goal pressure 的玩家可见表达。

### 7.3 D1 后回 Hub

D1 结算后不自动进入 D2。Orchestrator 必须推进到 `HubReview`。

HubReview 显示：

- 本局结果。
- 货币变化。
- 成就进度。
- Shop 解锁或购买提示。
- 下一目标：去 Shop 做一次轻量购买。

### 7.4 第一次购买

P0 推荐购买路径：

- `Stable Chain` starter kit，或
- `Blacksmith Voucher: Raise Level`。

UI 只能强推一个主推荐，另一个可以灰态预告或次级可见。

购买结果：

- profile 保存 purchase/unlock。
- 下一局 loadout preview 变化。
- 不直接改当前 `WorldState`。

### 7.5 下一局变化

进入 D2 前，玩家必须看到：

- 已选择 starter kit，或
- 已获得 Blacksmith service opportunity。

变化必须能在 sim test 和 browser QA 中被验证。

### 7.6 Reload 边界

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

## 8. Worktree 分组

### 8.1 Config Architect

职责：

- 定义 config schema。
- 建立 loader、validator、readonly services。
- 提供旧数据兼容导出。
- 建立 `first3HoursUnlockMatrix.config.ts`。

写入范围：

```text
prototype-web/src/config/**
prototype-web/src/tests/config/**
prototype-web/src/data/* 兼容导出，必要时
```

禁止：

- 不改 combat runtime。
- 不一次性迁移所有逻辑。
- 不引入完整框架。

### 8.2 Contract Tests

职责：

- 先写 P0 跨组红灯测试。
- 让后续组共享同一验收语言。

写入范围：

```text
prototype-web/src/tests/integration/long-loop-e2e-acceptance.test.ts
prototype-web/src/tests/sim/long-loop-orchestrator-state-machine.test.ts
prototype-web/src/tests/sim/first-3-hours-unlock-matrix.test.ts
```

### 8.3 Profile Save & Meta

写入范围：

```text
prototype-web/src/profile/**
prototype-web/src/save/**
prototype-web/src/tests/sim/profile-persistence-boundary.test.ts
```

### 8.4 Run Loop Orchestrator

写入范围：

```text
prototype-web/src/loop/**
prototype-web/src/tests/sim/long-loop-orchestrator-state-machine.test.ts
```

只允许通过 adapter 调用 combat runtime。

### 8.5 Map & Feature Gates

写入范围：

```text
prototype-web/src/map/**
prototype-web/src/featureGates/**
prototype-web/src/tests/sim/feature-gate-map.test.ts
```

### 8.6 Shop Catalog & Economy Facade

写入范围：

```text
prototype-web/src/shop/**
prototype-web/src/tests/sim/shop-catalog-economy-facade.test.ts
```

### 8.7 Blacksmith & Deck Services

写入范围：

```text
prototype-web/src/cardServices/**
prototype-web/src/tests/sim/blacksmith-deck-services-boundary.test.ts
```

### 8.8 Achievements & Unlocks

写入范围：

```text
prototype-web/src/achievements/**
prototype-web/src/unlocks/**
prototype-web/src/tests/sim/achievement-idempotency.test.ts
```

### 8.9 UI IA

写入范围：

```text
prototype-web/src/ui/**
prototype-web/src/style.css
prototype-web/src/tests/ui/long-loop-ui-state.test.ts
```

UI 组可以拆分局外 shell，但不得让战斗 HUD 承担局外信息。

### 8.10 Integration QA

写入范围：

```text
prototype-web/src/tests/integration/**
prototype-web/scripts/qa-long-loop.mjs
outputs/browser-qa/long-loop/**
design/technical/redline-batches/**
```

## 9. 合并顺序

必须按顺序推进：

1. Config schema / loader / validator / services / compatibility exports。
2. Contract tests stub。
3. Profile save / persistence boundary。
4. Run Loop Orchestrator。
5. Map / feature gates / unlock matrix wiring。
6. Shop Catalog & Economy Facade。
7. Blacksmith & Deck Services。
8. Achievements & Unlocks。
9. UI IA。
10. Integration QA hardening。

任何组不得绕过 Config 和 Orchestrator 自证通过。

## 10. 测试计划

必须先写或补齐以下测试。

### 10.1 Contract

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
- reload 后 profile 保留。
- run 内强化不保留。

### 10.2 Orchestrator

```text
prototype-web/src/tests/sim/long-loop-orchestrator-state-machine.test.ts
```

验证：

- 合法状态跳转。
- 非法跳转被拒。
- 战斗中不能打开 Shop 改 profile。
- settlement 后只能由 Orchestrator 回 Hub。
- 重复提交幂等。

### 10.3 Unlock Matrix

```text
prototype-web/src/tests/sim/first-3-hours-unlock-matrix.test.ts
```

验证：

- 每一行 matrix 引用的 map node、feature gate、achievement、UI state 都存在。
- trigger 发生后，map node、feature gate、achievement、UI state、next goal、visibility 同步变化。
- D5-D10 不会进入 playable。

### 10.4 Profile Persistence

```text
prototype-web/src/tests/sim/profile-persistence-boundary.test.ts
```

验证：

- 新档 roundtrip。
- migration。
- reload persistence。
- 永久解锁保留。
- activity/run 临时字段不保留。

### 10.5 Shop Facade

```text
prototype-web/src/tests/sim/shop-catalog-economy-facade.test.ts
```

验证：

- 商品来自 config。
- locked/unlocked/condition_visible 状态。
- 购买扣货币。
- 非法购买拒绝。
- shop 不直接改 deck。

### 10.6 Blacksmith Boundary

```text
prototype-web/src/tests/sim/blacksmith-deck-services-boundary.test.ts
```

验证：

- service permit 可生成下一局变化。
- `raise-level`、`add-gem-slot`、`socket-gem` 默认 run-local。
- reload 不保留 run 内强化。
- Blacksmith 不直接扣货币。

### 10.7 Achievements

```text
prototype-web/src/tests/sim/achievement-idempotency.test.ts
```

验证：

- 事件计数。
- 条件达成。
- 奖励发放。
- 重复触发幂等。
- 只写 profile patch，不改 runtime。

### 10.8 UI

```text
prototype-web/src/tests/ui/long-loop-ui-state.test.ts
```

验证：

- Hub/Map/Shop/Blacksmith/Achievements/Settlement 页面状态。
- locked/condition_visible/unlocked 文案。
- 下一目标清晰。
- 移动端不溢出。
- 战斗 HUD 不混入局外商店/成就信息。

## 11. Browser QA

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
- reload 后 profile 保留。
- run 内强化不保留。

QA 结束必须记录：

- 命令结果。
- 浏览器截图或 DOM 摘要。
- localStorage/profile dump 摘要。
- 端口清理或保留原因。
- 真实点击证据。

## 12. 风险与缓解

| 风险 | 表现 | 缓解 |
| --- | --- | --- |
| Orchestrator 变成第二个 runtime | 局外层开始处理战斗细节 | Orchestrator 只接 RunStartSnapshot 和 SettlementSummary |
| Config 变巨型框架 | 第一阶段迟迟无法合并 | 第一阶段只做 schema、loader、validator、services、兼容导出 |
| 各组硬写解锁顺序 | Map/UI/Shop/Achievement 互相不一致 | `first_3_hours_unlock_matrix` 是唯一真相源 |
| Shop 直接改 deck | 经济和卡牌服务耦合 | Shop 输出 transaction/result，Blacksmith 消费 permit |
| Blacksmith 变永久成长 | reload 后保留卡牌等级或 gem | 测试强制 run-local，profile 只存服务权限 |
| D1 后旅程断裂 | 玩家打完直接进 D2 或不知道下一步 | D1 后强制回 Hub，主目标是一次轻量购买 |
| UI 自证但总流程失败 | 页面可看但完整循环不可玩 | 先写 long-loop E2E 和 browser reload QA |
| D4 信息过载 | 同时打开商店、成就、污染、角色、地图分支 | P0 只做 D1 后轻量购买，D4 仅做污染预告/首秀 |

## 13. 验收命令

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

## 14. Spec 批准后的下一步

用户 review 本 spec 后，下一步只允许进入 `superpowers:writing-plans`，为上述合并顺序写 implementation plan。

implementation plan 必须：

- 每个 worktree 小组有明确 owner、写入范围、禁止事项和验收证据。
- 每个任务先写失败测试，再实现最小代码。
- 每轮合并前跑对应测试。
- 主线程保持 PM/规格/集成/验收，不承担所有实现重活。
