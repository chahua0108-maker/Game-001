# Web Prototype 核心体验差距审计

日期：2026-05-17  
范围：`/Users/roc/Game-001/prototype-web` 当前 demo 对比 `Vampire Crawlers` 核心体验。  
写入限制：本报告只审计，不修改 `prototype-web` 代码。

## 审计依据

- 本地设计交接：`design/technical/web-prototype-handoff.md`
- 对标体验 brief：`outputs/research/vampire-crawlers/22-vampire-crawlers-core-experience-brief.md`
- 前三小时体验分析：`outputs/research/vampire-crawlers/14-first-3-hours-experience-analysis.md`
- 运行时重构计划：`design/framework/web-runtime-refactor-plan.md`
- 当前实现：`prototype-web/src/**`
- 当前验证：
  - `npm run build`：通过。
  - `npm test -- --run`：失败 1 项，`src/tests/sim/runtime.test.ts:210` 期望普通时间推进后能量仍为 `2`，但实现把能量回到 `3`。
  - 浏览器首屏观察：玩家先看到 `回合开始，先发牌`、15 个敌人槽位、Debug Trace、大量 HUD；点击发牌后才能出牌。

## 对标体验基准

`Vampire Crawlers` 的核心不是“有卡牌”和“有地牢”，而是：

1. 怪物持续压近，玩家在压力下不断清怪。
2. 卡牌是局内战斗引擎：抽牌、费用、combo、升级、socket/gem 等持续改变战斗。
3. 高频击杀和高频微奖励不断喂反馈。
4. 中期出现“快崩盘 -> 抽到关键牌/升级 -> build 救场 -> 清场翻盘”。
5. HUD 必须服务动作清怪，不能把第一屏做成调试后台。

当前 demo 已经有伪 3D 走廊、手牌、能量、敌人队列、心跳碎片、清场牌和 trace，但核心体验仍更接近“回合制卡牌测试台”，还没有形成 Vampire Survivors 式的清怪流。

## P0

### P0-1：能量/抽牌/回合节奏把体验锁成回合制测试台

**玩家会看到什么**

- 首屏不是立即战斗，而是 `回合开始，先发牌`。
- 发牌后一次性获得 6 张固定手牌，打完或想推进时点击 `结束回合`。
- 敌人攻击、补位、下一轮发牌都绑定在 `end-turn`，普通时间推进不会带来敌人攻击。
- 代码里又存在实时能量回复：`advance-time` 每秒回复 `0.7` 能量；测试却期望普通时间推进后能量不回复，导致当前测试失败。

**为什么不符合对标产品体验**

`Vampire Crawlers` 的压力来自“时间在走、怪在逼近、卡牌/费用在抢注意力”。当前 demo 的危险主要发生在点击 `结束回合` 后，玩家可以在 `PlayerTurn` 阶段停住局势思考。这样会把“幸存者 + 卡牌”的混合体验降级成“手动结算的卡牌回合”。

**应该改成什么**

- 取消首屏发牌门槛：进入 demo 后自动进入第一波战斗，首 3 秒内能出牌或自动攻击命中。
- 明确采用一种节奏模型：
  - 若要模拟对标体验，保留实时能量/抽牌，但敌人也必须实时推进和攻击。
  - `end-turn` 不应是核心战斗推进按钮，可以改为 `弃牌/重抽`、`短暂停顿选择` 或 debug 专用。
- 抽牌应从“一回合固定 6 张”改为局内循环：
  - 起手 3-4 张。
  - 每隔短时间或击杀/拾取后抽牌。
  - 费用随时间、击杀、卡牌或奖励产生，而不是只在回合开始满格。
- 测试要重新定义节奏：普通时间推进时能量是否回复、敌人是否推进、是否会造成伤害，必须一致。

**涉及文件**

- `prototype-web/src/main.ts`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/sim/world.ts`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/ui/hud.ts`
- `prototype-web/src/input/keyboard.ts`
- `prototype-web/src/tests/sim/runtime.test.ts`

### P0-2：怪潮队列是静态 15 槽编队，不是压迫玩家的怪潮

**玩家会看到什么**

- 首屏左上出现 15 个敌人槽位，像表格一样列出 `1-1` 到 `3-5`。
- 3D 画面里敌人已经排成三行，但不会随时间向玩家推进。
- 敌人只在玩家结束回合后攻击，死亡后空槽也要等结束回合才 compact/refill。
- 队列信息比“怪物正在逼近我”更抢眼。

**为什么不符合对标产品体验**

对标产品的走廊压迫来自怪物从空间中涌来、逼近、造成时间边界。当前队列的主要反馈是“我在管理一个固定棋盘”，不是“我被怪潮推挤”。这会削弱清怪爽感，也让伪 3D 走廊变成背景装饰。

**应该改成什么**

- 把 15 槽 debug 队列表现从主 HUD 移到 debug 面板或折叠层。
- 战斗层只显示当前威胁：
  - 近身威胁 3-5 个。
  - 后方预告 3-6 个。
  - 新怪按时间或击杀节奏从远处进入。
- 敌人应在 `advance-time` 中按 speed 推进，抵达近身线后攻击或持续扣血。
- 走廊 renderer 应表现“推进”而不是只表现 slot：
  - 远处生成。
  - 逼近放大。
  - 近身闪烁/冲击。
  - 击杀后从队列中自然补上。

**涉及文件**

- `prototype-web/src/sim/world.ts`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/data/enemies.ts`
- `prototype-web/src/presentation/renderer/corridorRenderer.ts`
- `prototype-web/src/ui/hud.ts`
- `prototype-web/src/tests/sim/runtime.test.ts`

### P0-3：没有自动攻击底盘，手动出牌承担了全部战斗动词

**玩家会看到什么**

- 不点击卡牌就不会杀怪。
- 普通时间推进测试明确覆盖“不攻击”：当前测试名为 `does not attack during ordinary time advancement`。
- 牌打完后主要操作是结束回合，而不是边自动输出边决定何时插入关键牌。

**为什么不符合对标产品体验**

`Vampire Crawlers` 的核心是 Survivors 式清怪和 deckbuilder 决策叠加。即使玩家在看牌、等资源、移动，战斗也应该持续发生。当前 demo 把所有伤害都放在手动卡牌上，会让玩家感觉每次击杀都是“点按钮结算”，而不是站在怪潮里不断输出。

**应该改成什么**

- 增加最小自动攻击循环：
  - 玩家每 `0.7-1.0` 秒自动攻击最近/最前敌人。
  - 自动攻击伤害低，但足以持续削血和制造击杀节奏。
  - 卡牌用于改变攻击方式、爆发、标记、拉怪、回收、清场。
- 手动卡牌应成为“节奏加速器”和“救场按钮”，不是唯一攻击方式。
- Debug Trace 需要区分 `AutoAttackTick`、`CardPlayed`、`EnemyKilled`，方便之后复盘。

**涉及文件**

- `prototype-web/src/sim/types.ts`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/eca/redlineRules.ts`
- `prototype-web/src/data/cards.ts`
- `prototype-web/src/presentation/renderer/corridorRenderer.ts`
- `prototype-web/src/tests/sim/runtime.test.ts`

### P0-4：击杀频率太低，第一分钟无法形成“快速斩杀怪物”的核心反馈

**玩家会看到什么**

- 起手第一只 `Debt Wisp` 有 10 HP；`Redline Cut` 打 9 后还剩 1，需要第二张牌补刀。
- `Redline Brute` 有 22 HP，在没有 burst 时需要多张牌处理。
- 一轮初始 15 个敌人，但击杀通常是逐个前排目标处理。
- 击杀后空槽留在表格里，清怪视觉反馈弱于表格状态变化。

**为什么不符合对标产品体验**

对标体验的一号约束是高频斩杀、持续掉落、数字/音效/光效反馈。当前 demo 的前几次交互不是“连续切碎怪潮”，而是“对一个前排目标扣血”。这会让玩家在 0-30 秒内感到慢，无法验证清怪爽感。

**应该改成什么**

- 第一波弱怪应支持 1 次自动攻击 + 1 张 0 费/1 费牌击杀，或 1 张关键牌直接击杀。
- 前 30 秒目标：至少 6-10 次击杀反馈，而不是只处理 1-3 个敌人。
- 增加溢出/连锁规则：
  - 击杀溢出伤害传给下一个前排敌人。
  - `mark` 后击杀触发小范围伤害。
  - `reclaim` 击杀后立即抽牌或给能量。
- 视觉上需要死亡爆点、碎片飞向 HUD、队列快速补位，而不只是 mesh 隐藏。

**涉及文件**

- `prototype-web/src/data/enemies.ts`
- `prototype-web/src/data/cards.ts`
- `prototype-web/src/eca/redlineRules.ts`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/presentation/renderer/corridorRenderer.ts`
- `prototype-web/src/ui/hud.ts`

### P0-5：爆发清场存在规则，但没有形成“濒临崩盘 -> build 救场”的体验曲线

**玩家会看到什么**

- `Severance Burst` 起手就在手牌里，但因为心跳碎片/能量不足被禁用。
- 累积 3 心跳碎片后，它会变成可用清场牌。
- 当前清场主要是“消耗资源，对全场造成 24 点伤害”，renderer 只有短暂 point light；没有明确的濒死压力、build 成立、全屏处刑反馈。

**为什么不符合对标产品体验**

对标产品的关键爽点不是“有一张 AOE 牌”，而是玩家在快崩盘时因抽牌、升级、combo 或资源回收突然翻盘。当前 demo 的 burst 更像预置大招，不像 build 的结果；同时敌人不会实时压迫，玩家也很难感到“必须现在清场”。

**应该改成什么**

- 设计一个 5-8 分钟前可压缩演示的 burst 曲线，demo 可在 90-150 秒内出现：
  - 怪潮接近、HP 下滑、手牌短缺。
  - 玩家通过击杀、combo 或奖励拿到关键条件。
  - `Severance Burst` 或同类牌触发全屏清场。
- burst 触发后要有强反馈：
  - 短暂停顿或冲击波。
  - 全场敌人被红线切断。
  - 碎片/经验飞入 HUD。
  - 明确显示“处刑连锁 xN”。
- 测试要覆盖 burst 前置条件、全场击杀、奖励结算、replay trace。

**涉及文件**

- `prototype-web/src/data/cards.ts`
- `prototype-web/src/eca/redlineRules.ts`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/presentation/renderer/corridorRenderer.ts`
- `prototype-web/src/ui/hud.ts`
- `prototype-web/src/tests/sim/runtime.test.ts`

## P1

### P1-1：奖励/升级缺口会让 demo 没有“下一步追求”

**玩家会看到什么**

- 击杀只给 `Heartbeat Shards`。
- 没有 XP、升级三选一、新卡、卡牌升级、socket/gem、商店或局外成长预览。
- 一轮结束只是补怪、发牌、进入下一回合。

**为什么不符合对标产品体验**

对标产品前三小时的核心循环包括经验、升级、卡牌升级、gem slot、sacrifice、reroll、商店和永久成长。Web 垂直切片不需要完整 meta，但必须让玩家在第一局内看到“我下一次会更强/我的 build 正在成形”。

**应该改成什么**

- 第一阶段至少加入一个轻量奖励层：
  - 每 5-8 次击杀弹出 2-3 选 1。
  - 奖励可以是升级卡牌、加自动攻击、加抽牌、改变碎片收益。
  - demo 结算页显示下一局可解锁的一条路线。
- 奖励不要长文本化，必须直接服务战斗。

**涉及文件**

- `prototype-web/src/sim/types.ts`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/data/cards.ts`
- `prototype-web/src/ui/hud.ts`
- 新增时可能需要 `prototype-web/src/data/rewards.ts`、`prototype-web/src/ui/rewards.ts`

### P1-2：卡牌引擎只有“固定起手 6 张”，没有抽牌压力和构筑路线

**玩家会看到什么**

- 6 张牌全部起手出现。
- 没有 draw/discard 循环的可感知压力：`DealHand` 会从 `startingHand` 重新取牌，弃牌堆对玩家不可见。
- 没有颜色、升级、socket/gem、牺牲或 reroll。
- Combo 只是计数到 3 给 1 个心跳碎片，玩家不容易理解路线。

**为什么不符合对标产品体验**

对标产品的卡牌不是奖励菜单，而是战斗引擎。当前卡牌虽然能造成伤害，但还不是构筑系统：玩家没有“这局我在走哪条 build”的判断，也没有抽不到关键牌的紧张感。

**应该改成什么**

- 第一版构筑路线可以很小，但要清楚：
  - `Hook/Cut`：拉近 + 溢出斩杀路线。
  - `Spark/Reclaim`：碎片回收 + burst 路线。
  - `Mark`：标记连锁 + 自动攻击增伤路线。
- HUD 只显示当前 combo 路线和下一步，而不是只显示抽象 `combo` 或 debug rules。
- 抽牌从固定 6 张改为小手牌循环，奖励能改牌或改抽牌。

**涉及文件**

- `prototype-web/src/data/cards.ts`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/eca/redlineRules.ts`
- `prototype-web/src/ui/hud.ts`

### P1-3：HUD 可读性偏 debug，不像玩家战斗 HUD

**玩家会看到什么**

- 顶部有 HP/Energy/Heartbeat/FSM/Restart。
- 左上 15 个敌人槽位占据大面积。
- 右上 Debug Trace 长期开启。
- 底部 6 张卡铺满宽度。
- 多数标签是英文：`Energy`、`Heartbeat`、`FSM`、`Front target`、`Debug Trace`。

**为什么不符合对标产品体验**

对标产品的 HUD 必须让玩家一眼读懂“我快死了、怪快贴脸、现在能打什么、杀了有什么奖励”。当前 HUD 把内部状态暴露得太多，尤其是槽位表格和 Debug Trace 抢走了走廊中心的注意力，会弱化怪潮压迫和击杀反馈。

**应该改成什么**

- 普通玩家 HUD：
  - HP、能量、碎片、当前目标/危险距离、当前 combo。
  - 卡牌只保留费用、关键词、伤害、可用/不可用原因。
  - Debug Trace 默认折叠，按热键打开。
- 敌人队列主视图改成空间表现；表格只留给 debug。
- 中文化战斗标签：`能量`、`心跳碎片`、`当前目标`、`处刑准备`。
- 清场、升级、击杀连锁要有居中或近 HUD 的强提示，不能藏在 debug 里。

**涉及文件**

- `prototype-web/src/ui/hud.ts`
- `prototype-web/src/style.css`
- `prototype-web/src/presentation/renderer/corridorRenderer.ts`

### P1-4：走廊视觉已经有雏形，但敌人缺少攻击、死亡和奖励表现

**玩家会看到什么**

- 敌人是几何体，死亡后 mesh 隐藏。
- HP ring 会缩放，但没有明显受击、击杀、掉落、吸附、攻击预警。
- burst 只有亮光变化，没有足够的清场仪式感。

**为什么不符合对标产品体验**

对标产品的高频反馈来自死亡、掉落、数字、音效、光效和 UI 连续响应。当前 renderer 能证明 Three.js 跑通，但还没有把战斗结果转成爽感。

**应该改成什么**

- 增加最小反馈包：
  - 受击闪白/红。
  - 击杀爆点。
  - 心跳碎片从敌人飞向 HUD。
  - 近身攻击前摇。
  - burst 冲击波。
- Presentation command 不应从 UI 猜测，应由 runtime 输出 `EnemyHitPresented`、`ShardDroppedPresented`、`BurstPresented` 类事件或 snapshot 标记。

**涉及文件**

- `prototype-web/src/presentation/renderer/corridorRenderer.ts`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/sim/snapshot.ts`
- `prototype-web/src/ui/hud.ts`

## P2

### P2-1：命名和题材包装还没有把“红线清算局：心跳处刑”变成可感知动词

**玩家会看到什么**

- 卡牌名有 `Debt Hook`、`Redline Cut`、`Heartbeat Spark` 等。
- 但敌人仍是抽象几何体，HUD 和反馈没有表现“清算局/红线/处刑”的世界观。

**为什么不符合对标产品体验**

对标产品可以借 IP 和角色吸引力降低理解成本；原创项目必须更早用视觉和动词证明差异化。当前题材词在卡牌描述里存在，但战斗反馈还没有把它打出来。

**应该改成什么**

- 每条机制都绑定一个可见动作：
  - `Hook` 拉红线。
  - `Cut` 斩断。
  - `Mark` 盖印。
  - `Reclaim` 碎片回收。
  - `Burst` 红线处刑。
- 敌人、奖励、HUD 也使用同一套词汇，避免英文系统名和中文题材混杂。

**涉及文件**

- `prototype-web/src/data/cards.ts`
- `prototype-web/src/data/enemies.ts`
- `prototype-web/src/ui/hud.ts`
- `prototype-web/src/presentation/renderer/corridorRenderer.ts`

### P2-2：测试覆盖偏规则正确性，缺少体验验收用例

**玩家会看到什么**

玩家看不到测试，但当前测试会塑造实现方向：它主要验证发牌、目标、费用、回合攻击、补位、失败条件。缺少“30 秒内杀怪”“怪物随时间压近”“burst 清场可 replay”这类体验验收。

**为什么不符合对标产品体验**

当前测试会把工程拉向回合制正确性，而不是核心体验正确性。对这个原型来说，体验节奏比单次扣血边界更关键。

**应该改成什么**

- 增加体验型 sim 测试：
  - 30 秒自动运行能产生至少 N 次击杀。
  - 不出牌时敌人会推进并造成压力。
  - 玩家出关键牌能打断崩盘。
  - burst 能清场并留下 trace。
  - 奖励选择能改变下一波输出。
- 保留现有规则测试，但把它们放在新节奏模型下重写。

**涉及文件**

- `prototype-web/src/tests/sim/runtime.test.ts`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/eca/redlineRules.ts`

## 建议修复顺序

1. 先统一节奏模型：实时推进、实时能量、实时敌人压力，去掉首屏手动发牌门槛。
2. 加自动攻击底盘和时间推进敌人，先让 30 秒内出现高频击杀。
3. 把 15 槽队列表格从主 HUD 收进 debug，让走廊承担怪潮表达。
4. 加最小奖励/升级层，让第一局出现一条 build 路线。
5. 强化 burst 的濒死救场曲线和表现反馈。
6. 最后再细化 HUD 文案、题材动词和测试覆盖。

## 最关键结论

当前 demo 的最大差距不是“还不够完整”，而是核心节奏方向偏了：它已经实现了卡牌、敌人、能量、队列和清场牌，但这些系统被组织成了回合制调试台；对标体验需要的是持续怪潮压力中的自动输出、手动出牌、快速击杀、频繁奖励和 build 爆发。下一轮不要先扩卡牌数量，应先把 `advance-time` 变成真正的战斗心跳。
