# Redline 卡牌可读性与属性 HUD Spec

日期：2026-05-21

状态：框架程序专家复审 approve，93/100，允许进入 P0 实现。本文件只整理已有专家结论，不单独判断产品方向；低于本文件评分门槛时不作为直接实现授权。

审核记录：上一轮框架程序专家审核 approve-with-changes，88/100，作为历史记录保留，不再作为当前状态。

## 1. 目标

本 spec 解决的是“玩家看不懂手牌和属性状态”的首屏可读性问题。主线程只负责流程编排，不在本文件中新增业务判断；本 spec 需要先交给框架程序专家审核，确认数据边界、文件范围和测试门禁后，才允许进入实现。

玩家在默认战斗 HUD 中必须能快速判断：

- 这张卡叫什么、主要做什么，不需要先读英文名。
- 这张卡属于攻击、抽牌、修补、资源、状态、终结等哪类用途。
- 这张卡在费用链中是起手、承接、展开、修补还是 payoff。
- 当前 MP、临时授权 MP、链路倍率和下张期望费用是否已就绪。
- 当前手牌数与每回合基础手牌数，例如“手 3/4”，以及抽牌堆、弃牌堆、消耗、保留区的轻量信息。
- 授权段卡牌能看出“完成 0->1->2 后给授权 +3”，payoff 能看出“授权可付 / 未授权”。

第一轮最小切片只做 HUD/card data 显性化，不新增模拟规则，不改变 run、route、reward、战斗或生命周期语义。

## 2. 非目标

本轮明确不做：

- 不做完整卡牌实例系统，也不引入 `cardInstanceId` 作为本轮依赖。
- 不做永久 max MP 成长；当前授权仍是本回合临时授权，不转成跨回合属性成长。
- 不复制竞品布局，只吸收信息层级和可读性原则。
- 不做 AIRoc 插件，不改插件目录。
- 不改 `prototype-web` 运行时规则，除非后续框架审核另行批准。
- 不新增完整 faction / 属性海 / 大型关键词系统。
- 不把整张卡因为授权或链路状态做大面积动态变色；动态状态优先限制在右上 MP 小框、短标签或细边框。
- 不把 P1/P2 内容混进 P0 实现。

## 3. 现状证据摘要

读取依据：

- `/Users/roc/Game-001/prototype-web/src/data/cards.ts`
- `/Users/roc/Game-001/prototype-web/src/sim/types.ts`
- `/Users/roc/Game-001/prototype-web/src/sim/world.ts`
- `/Users/roc/Game-001/prototype-web/src/sim/buildPlan.ts`
- `/Users/roc/Game-001/prototype-web/src/ui/hud.ts`
- `/Users/roc/Game-001/design/technical/redline-batches/2026-05-18-current-card-mechanics-inventory-03.md`

当前数据层已经有大量可展示信息：

- `CardDefinition` 已包含 `cardType`、`chainRole`、`cycleRole`、`buildRole`、`rulesText`、`mobileEffect`、`keywords`、`mechanicTags`、`rewardRarity`、`rewardBranches`、`lifecycle`、`runUpgrade`。
- 世界状态已有 `player.tempAuthorizationMP`、`authorizationRestriction`、`payoffArmed`、`chain.multiplier`、`chain.nextExpectedCost`、`player.hand`、`drawPile`、`discardPile`、`exhaustPile`、`retainedCards`。
- `createInitialWorld` 中基础 `maxEnergy` 为 3，起始牌组来自 `startingHand`；现状里“每回合基础手牌 4”的语义存在于发牌/测试合同，但 HUD 首屏没有稳定显示成“手 x/4”。
- `hud.ts` 已消费部分授权、链路、意图、牌堆和 lifecycle 信息，例如授权 chip、CHAIN chip、牌堆 chip、卡牌 tooltip、payoff label、`mobileEffect` fallback。

主要问题：

- 手牌按钮主标题仍显示 `card.name`，例如英文名；中文动词、`rulesText`、`mobileEffect` 只在次级层级或 tooltip 中出现。
- 卡牌颜色主要受可打、断链、授权可付等状态影响，缺少稳定的“类型/角色色”作为长期识别锚点。
- 玩家难以区分攻击、魔法/技能、增益、buff、修补、终结、状态污染等用途；`cardType` 和 `chainRole` 有字段，但 UI 没有形成稳定标签系统。
- 授权和链路系数已在 HUD 出现，但不够显眼，且和单张卡的支付/收益关系还不够直接。
- 当前建议不使用“整张卡随授权/链路大面积变色”，因为这会覆盖稳定类型识别；可采用右上 MP 小框动态变色表达可付、授权可付、缺费、断链。
- 升级/宝石数据已有 `runUpgrade`、`CardUpgradeState`、`CardGemSlot` 等结构，但奖励/升级 UI 消费还不够清楚，不能空渲染或让玩家误以为未实现内容已经可用。

## 4. P0 / P1 / P2 范围

### P0：第一轮最小切片

目标：不新增规则，只把已有数据显性化。

必须包含：

- 手牌主标题使用中文短名或 `displayName`，英文名降到次级层或 tooltip。
- 卡牌按钮增加稳定的 class / data attribute，例如按 `cardType` 与 `chainRole` 输出 `data-card-type`、`data-chain-role` 或等价 class。
- 卡牌有稳定角色色：攻击、抽牌、修补、资源/技能、状态、终结至少可区分；状态色不能覆盖角色色。
- 右上 MP 小框承担动态状态：
  - 普通可支付。
  - 授权可支付。
  - 缺 MP。
  - 断链但仍可打。
  - 不可打。
- 授权段卡面直接显示“给授权 +3”或等价短文案。
- payoff 卡面直接显示“授权可付 / 未授权”，并保留倍率或全场目标信息。
- 牌堆/手牌区域显示“手 x/4”，其中基础值 4 必须来自共享只读 `BASE_HAND_SIZE` 或 `HAND_SIZE` 常量，并继续显示抽/弃/消/留的轻量计数；禁止 HUD 写死 `4`。
- 敌意图与 End Turn 后果继续在首屏可见，不能被卡牌标签挤掉。
- 奖励/升级 UI 对不可用数据不空渲染、不误导；只有现有 `reward.pending` 或 `cardUpgrades.pending` 真的存在 choices 时才展示对应区域，没有 choices 时隐藏而不是显示空壳。P0 不新增基于 `runUpgrade` 的升级入口。

P0 允许的最小数据增量见第 5 节。

### P1：第二轮可读性完善

P1 只在 P0 经 QA 通过后考虑：

- 更完整的颜色分类和图标体系，包括攻击、技能、资源、修补、状态、终结的稳定设计令牌。
- 奖励路线标签与构筑建议进一步对齐，例如 `route-bridge`、`repair-resource`、`payoff` 的稳定展示。
- 升级/宝石 UI 明确消费 `runUpgrade`、`CardUpgradeState`、`CardGemSlot`，展示等级、可插槽、颜色限制和预览收益。
- 中文名从最小 `displayName` 扩展成正式命名表，并处理 tooltip 中英文别名。

### P2：暂缓项

P2 暂缓，不能阻塞 P0：

- 完整 faction / 属性海 / 元素克制或大规模关键词系统。
- 完整 `CardInstance` / 单卡实例差异 / 同名牌不同升级来源。
- 跨 run 永久属性成长或永久 max MP 成长。
- 深层卡牌百科、完整牌库浏览器、全量构筑路线图。

## 5. 数据模型最小增量

优先复用 `CardDefinition` 现有字段，不引入大型 schema。

建议最小新增字段：

```ts
interface CardDefinition {
  displayName?: string;
  shortName?: string;
  hudRoleLabel?: string;
}
```

手牌基础值裁定：

- 允许抽出或导出一个只读 `BASE_HAND_SIZE` 或 `HAND_SIZE` 常量，供 HUD、snapshot 断言和 UI 测试复用。
- 常量可以放在新增的小型 sim 常量文件中，也可以通过窄改 runtime 只导出/引用常量；该改动只允许暴露现有发牌合同，不允许改变发牌逻辑、抽牌数量、回合流程或测试语义。
- HUD 显示“手 x/4”时，`x` 来自 `snapshot.player.hand.length`，基础值来自共享常量；禁止在 HUD、测试或快照断言中各自写死 `4`。

字段约束：

- `displayName`：中文主标题，手牌主标题优先使用；缺省时回退 `name`。
- `shortName`：移动端或窄卡面用短名，原则上 2-5 个中文字符；缺省时回退 `displayName` 或 `name`。
- `hudRoleLabel`：必要时覆盖自动角色文案；一般应从 `cardType`、`chainRole`、`cycleRole` 派生，不鼓励每张卡手写。

不建议新增：

- 不新增 `faction`、`element`、`rarityColorOverride`、`instanceState`。
- 不新增与规则有关的授权数值字段；P0 授权 +3 从现有授权合同和卡牌机制派生展示。
- 不把中文短效果写成第二套规则文本；优先复用 `mobileEffect`、`rulesText`、`keywords`。

派生展示建议：

- 类型标签从 `cardType` 派生：`attack`、`draw`、`repair`、`resource`、`skill`、`payoff`、`status`。
- 链路角色从 `chainRole` 派生：开链、接链、展开、修补、终结。
- 机制标签从 `keywords` 和 `mechanicTags` 取前 1-3 个，不做全量堆叠。
- 奖励路线从 `rewardBranches` 派生：路线、修补、终结。
- 生命周期从 `lifecycle` 派生：消耗、保留；没有 lifecycle 时不显示占位。

## 6. UI 信息层级

### 6.1 HUD 顶部状态

首屏固定层级：

1. HP / MP：保留资源读数。
2. 授权：显示“授权 +N / 待解锁”，active 时强调“本回合，只付 3 费终结”。
3. CHAIN：显示费用链、下张期望费用、当前/下一段倍率。
4. 敌意图：显示 End Turn 后果，例如 `-N HP` 或安全。
5. 手牌/牌堆：显示“手 x/4”，再显示抽/弃/消/留。

其中 `4` 必须来自共享只读 `BASE_HAND_SIZE` 或 `HAND_SIZE` 常量，不能在 HUD 文案中硬编码。

`FSM`、debug、内部 trace 不应挤占核心首屏；如果保留，继续降权为调试层。

### 6.2 手牌按钮

推荐结构：

1. 右上 MP 小框：`MP 0/1/2/3`，承担动态可支付状态。
2. 主标题：中文 `displayName` / `shortName`。
3. 类型与链路角色：例如 `攻击 · 开链`、`修补 · 接链`、`终结 · 授权`。
4. 短效果：优先 `mobileEffect`，必要时追加关键机制，例如 `给授权+3`、`授权可付`。
5. 目标/意图预览：单体、前排、全场、自身，以及能阻止多少敌意图。
6. 次级详情：英文原名、`rulesText`、完整 tooltip。

动态视觉规则：

- 稳定底色由类型/角色决定。
- 授权可付、缺费、断链、不可打只改变 MP 小框、边框或小标签。
- 不允许整张卡因为当前状态大面积改成另一套颜色，避免玩家失去稳定识别。

### 6.3 奖励 / 升级区域

奖励卡必须显示：

- 中文短名。
- 类型/链路角色。
- 机制短标签。
- 奖励路线标签：路线、修补、终结。
- `rulesText` 或 `mobileEffect` 的动作与数值。

升级/宝石必须遵守：

- 只有现有 `reward.pending` 或 `cardUpgrades.pending` 真的有 choices 时才展示奖励或升级选择。
- 没有可选奖励/升级时隐藏，不显示空卡片、空标题或“即将开放”式误导。
- P0 不新增基于 `runUpgrade` 的升级入口；`runUpgrade` 只可作为 P1 审核后的升级/宝石展示依据。

## 7. 文件范围

本 spec 文件路径：

- `/Users/roc/Game-001/design/framework/2026-05-21-redline-card-readability-attribute-hud-spec.zh.md`

未来实现如通过框架审核，优先允许触碰：

- `/Users/roc/Game-001/prototype-web/src/data/cards.ts`
- `/Users/roc/Game-001/prototype-web/src/sim/types.ts`
- `/Users/roc/Game-001/prototype-web/src/sim/constants.ts` 或等价小型 sim 常量文件，仅用于导出只读 `BASE_HAND_SIZE` / `HAND_SIZE`
- `/Users/roc/Game-001/prototype-web/src/ui/hud.ts`
- `/Users/roc/Game-001/prototype-web/src/style.css`
- `/Users/roc/Game-001/prototype-web/src/tests/ui/`
- `/Users/roc/Game-001/prototype-web/scripts/qa-ui.mjs`

默认不允许触碰：

- `/Users/roc/Game-001/prototype-web/src/sim/runtime.ts`，除非框架审核认定只能通过窄改导出/引用只读手牌常量，且不得改变发牌逻辑。
- `/Users/roc/Game-001/prototype-web/src/sim/rewardProgression.ts` 和路线生成相关文件，除非进入 P1 奖励路线标签审核。
- `/Users/roc/Game-001/plugins/`、AIRoc 插件目录或任何非 Game-001 prototype 范围。
- Git 提交、分支、远端推送。

实现范围判定：

- 如果只新增展示字段、中文短名、HUD class、CSS 和 UI test，可走轻审核。
- 如果修改发牌、支付、授权、倍率、奖励生成、升级选择、run carryover 或 route 语义，必须走正式框架审核。

## 8. 测试 / QA 门禁

P0 实现完成后，至少需要以下门禁。

静态与单元：

```bash
cd /Users/roc/Game-001/prototype-web
npm run check
```

UI / HUD：

```bash
cd /Users/roc/Game-001/prototype-web
npm run qa:ui
```

建议补充或扩展 UI 断言：

- 初始手牌主标题不只显示英文 `card.name`；至少有中文主标题或中文短名。
- 每张手牌按钮包含稳定 `cardType` / `chainRole` class 或 data attribute。
- `attack`、`repair`、`payoff`、`status` 至少有可区分的稳定视觉 token。
- MP 小框在普通可付、授权可付、缺费、断链但仍可打、不可打状态下有不同 class / 文案；断链但仍可打必须表现为 MP 小框/细标签状态，不得把整张卡改成不可读的大面积状态色。
- 360px 移动端分别覆盖中文长名和中文短名渲染，均无文字溢出、重叠、按钮高度抖动。
- 授权段显示“给授权 +3”或等价文案，并有测试断言覆盖。
- payoff 在授权 active 时显示“授权可付”，未 active 时显示“未授权”，并覆盖可付/未授权两种断言。
- HUD 显示“手 x/4”，且 x 与 `snapshot.player.hand.length` 对齐。
- “手 x/4”的基础值 4 来自共享只读 `BASE_HAND_SIZE` 或 `HAND_SIZE` 常量；HUD 和测试不得各自硬编码 `4`。
- 抽/弃/消/留仍可见，不因新增手牌基础值而消失。
- 奖励/升级区域没有空壳渲染；只有 `reward.pending` 或 `cardUpgrades.pending` 真的有 choices 时才展示。
- 桌面宽度无文字溢出、重叠、按钮高度抖动。

回归要求：

- 不改变 `redline-attribute-authorization` 的授权语义。
- 不改变 lifecycle / hand pile 测试语义。
- 不改变敌意图和 End Turn 后果显示。
- 不因为中文短名替换而破坏 hotkey、aria label、tooltip 或 `data-card-id`。

## 9. 5 专家评分标准

总分 100，低于 90 不通过，不能进入实现；低于 75 必须回炉。本轮后续 5 专家评分以 95 为目标，框架程序专家评分低于 90 时不能进入实现。

| 专家 | 权重 | 评分标准 |
| --- | ---: | --- |
| 框架程序专家 | 25 | 是否只做展示层和最小数据增量；是否不改变 runtime 合同；是否清楚划分 P0/P1/P2；是否能被现有 snapshot/HUD 消费。 |
| HUD / UX 专家 | 25 | 玩家 3 秒内能否读懂中文卡名、类型、链路角色、MP 状态、授权/payoff 状态；移动端是否不溢出。 |
| 卡牌机制专家 | 20 | `cardType`、`chainRole`、`keywords`、`mechanicTags` 的映射是否准确；授权段、修补、终结是否没有误导。 |
| QA 自动化专家 | 20 | 是否有可自动断言的 class/data/text；是否覆盖授权、手牌 x/4、奖励/升级不空渲染、桌面/移动端。 |
| 产品/体验审阅 | 10 | 是否回应用户原始困惑；是否保持 Redline 自己的信息层级，不盲目复制竞品布局。 |

硬性失败项：

- 用整张卡动态大面积变色替代稳定类型识别。
- 把临时授权解释成永久 MP 成长。
- P0 引入卡牌实例系统或运行时规则改动。
- HUD、测试或 snapshot 断言写死 `4`，而不是引用共享只读 `BASE_HAND_SIZE` / `HAND_SIZE` 常量。
- P0 新增基于 `runUpgrade` 的升级入口，或在没有 pending choices 时展示奖励/升级空壳。
- 卡面仍主要依赖英文名才能理解。
- HUD 看不到手牌基础数或授权/payoff 状态。

## 10. 实施前框架审核问题清单

进入实现前，框架程序专家需要回答：

1. `displayName` / `shortName` 是否作为 `CardDefinition` 可选字段加入，还是先在 HUD 建立本地映射表？
2. `hudRoleLabel` 是否需要字段，还是完全从 `cardType`、`chainRole`、`cycleRole` 派生？
3. 已裁定：“每回合基础手牌 4”的来源必须是共享只读 `BASE_HAND_SIZE` 或 `HAND_SIZE` 常量；实现前只需确认常量落点是新增小型 sim 常量文件，还是窄改 runtime 导出/引用。无论采用哪种落点，都不得改发牌逻辑。
4. 授权段“给授权 +3”应由哪些条件派生：`mechanicTags` 包含 `authorization`、`chainRole === 'expand'`、还是明确卡表字段？
5. payoff “授权可付 / 未授权”是否沿用 `hudCardPaymentRead` 和 `hudAuthorizationState`，避免再造支付判断？
6. 稳定角色色优先绑定 `cardType` 还是 `chainRole`？当二者冲突时哪一个拥有优先级？
7. P0 是否允许新增 CSS design tokens，还是复用现有 CSS class 命名？
8. 奖励/升级 UI 的“不空渲染”应只改 HUD 条件，还是需要测试覆盖 `reward.pending` 与 `CardUpgradeState.pending` 真实 choices？P0 不允许新增基于 `runUpgrade` 的升级入口。
9. 是否需要把英文 `card.name` 保留在 tooltip / aria label 中，保证调试和可访问性？
10. 移动端 360px 的最小信息组合是哪五项：MP、中文名、类型、短效果、授权/payoff，还是需要保留目标预览？

审核结论应明确写出：

- 是否 approve P0。
- 是否允许修改 `types.ts`。
- 是否允许改 CSS 文件。
- 必跑 QA 命令和必须新增的测试文件。

## 11. 风险

- 信息过载：把所有字段一次塞进卡面，会让手牌比现在更难读。P0 必须限制为中文名、类型/链路、MP 状态、短效果、授权/payoff。
- 颜色语义冲突：如果状态色覆盖角色色，玩家会失去稳定识别。动态状态只能落在 MP 小框或细边框。
- 误导授权：授权是本回合临时资源，不能写成最大 MP、永久 MP、成长 MP。
- 派生规则漂移：如果 HUD 自己重写支付、payoff、授权判断，容易和 runtime 不一致；必须复用现有 HUD helper 或 snapshot 状态。
- 移动端溢出：中文短名和标签增加后，360px 宽度可能出现重叠，需要 QA 门禁覆盖。
- P1 抢跑：升级/宝石、完整颜色分类、中文正式命名表都容易扩大范围；P0 只做不空渲染和最小可读性。
- 并行改动冲突：当前工作树可能有其他人修改 `prototype-web` 文件；实现阶段必须先重新读目标文件，不能回滚他人改动。
