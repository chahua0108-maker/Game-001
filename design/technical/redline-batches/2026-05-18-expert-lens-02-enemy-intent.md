# Redline Hyper-Turn Expert Lens 02 - Enemy Pressure and Intent

Date: 2026-05-18
Baseline commit: `b24b262`
Worker: enemy pressure and intent expert group
Scope: lenses 4-6 only. This document reviews current design/runtime/readability evidence and does not modify code.

Reviewed sources:

- `design/technical/redline-hyperturn-acceptance.md`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/sim/world.ts`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/presentation/renderer/corridorRenderer.ts`
- `prototype-web/src/ui/hud.ts`

Additional context read for concrete enemy/card values:

- `prototype-web/src/data/enemies.ts`
- `prototype-web/src/data/cards.ts`
- `prototype-web/src/sim/snapshot.ts`
- `prototype-web/src/eca/redlineRules.ts`

## 4. 遭遇设计师：前排/后排、补位、敌人差异是否构成局面

### 当前判断

当前实现已经有可用的遭遇骨架：`5 x 3` 槽位、前排可攻击、后排按列补位、单体只能打前排、前排群攻和全场 payoff 能改变局面。它比旧 realtime heartbeat 更接近 Redline Hyper-Turn 合同，因为压力来自“本回合结束后果”，而不是敌人实时贴脸。

但它现在还没有形成足够清楚的“局面”。前排和后排在 runtime 上有差异，玩家看到的差异却不稳定：发牌时会快照本回合攻击者，击杀后又立刻按列压缩并补满新敌人。于是画面上的当前前排、HUD 估算的前排伤害、runtime 真正会在结束回合结算的攻击者，可能不是同一组敌人。敌人之间也主要只是 HP/伤害/颜色/几何形状不同，还没有形成“先处理谁”的明确遭遇意图。

### 10 个镜头观察

1. 开局直接生成 15 个敌人，占满 5 列 3 行；槽位 `0-4` 是前排，`5-14` 是后排队列。这个结构天然支持“当前威胁 / 下一轮预告”的读法。

2. 敌人按序循环生成 `Debt Wisp -> Redline Brute -> Pulse Collector`。开局前排是 Wisp、Brute、Collector、Wisp、Brute，总伤害为 `2 + 5 + 3 + 2 + 5 = 17`，已经具备“高威胁 Brute、低血 Wisp、中间 Collector”的数值差。

3. `EnemyDefinition.speed` 目前没有参与 hyper-turn 压力，`lane` 和 `z` 也会由 slot 派生覆盖。敌人差异实际只剩 HP、damage、xpReward、颜色/模型，因此“快怪/慢怪/远近压力”的概念还没有进入局面决策。

4. 单体牌只允许打前排；如果玩家没有选择目标，runtime 会随机选一个前排敌人。这让系统能运转，但遭遇设计上削弱了“我选择先杀 Brute 来少吃 5 点伤害”的可控性。

5. 发牌时 `snapshotRoundAttackEnemies` 会记录当回合攻击者，`refreshEnemyIntents` 只给这些仍活着且仍在前排的敌人生成 intent。这是很好的回合制压力基础：本回合谁要打你，在回合开始就固定。

6. 击杀敌人后，`enemy.death.reward` 规则会立即触发 `CompactEnemySlots` 和 `FillEnemySlots`。这能避免空槽，但也会让后排敌人当场顶到前排，新刷敌人补到后排，画面上几乎没有“我刚清出了窗口”的停顿。

7. 按列压缩保留了列队关系：同一列后排会向该列前排补上，不会横向重排。这是一个有价值的局面规则，但 HUD 和渲染没有明确告诉玩家“这一列后面是谁会顶上来”。

8. renderer 只给前排显示 name/HP 标签，后排只显示几何体。玩家可以看见后排存在，但很难判断后排敌人的类型、HP、下轮是否危险。

9. HUD 的 `enemy-peek` 默认只展开前排槽位，且显示的是类型、名字、HP，不显示本回合是否有 intent，也不显示伤害。它更像目标选择器，还没有成为遭遇读盘器。

10. Payoff 或前排群攻击杀前排后，runtime 立即补位；如果 HUD 按当前前排重新估算伤害，玩家会看到“我清了前排，但前排伤害好像还在”。这会削弱清前排/救场的成就感。

### 最大风险

最大风险是“前排”这个词同时承担了三个不同含义：

- 当前画面最前面的敌人。
- 本回合会在结束回合攻击的敌人。
- 单体/前排卡牌可以命中的敌人。

这三者在开局是一致的；一旦击杀、补位、清前排发生，就可能分叉。玩家会以为清场没有降低压力，或者反过来以为新补上来的敌人马上会打自己。遭遇设计会从“处理局面”退化成“看不懂的伤害账单”。

### 下一轮最小改动

下一轮不要先扩更多敌人类型。先把现有 3 类敌人和 5 列 3 行结构读清：

1. 把“本回合攻击者”作为显式遭遇层，和“当前前排可打目标”分开显示。

2. 击杀后补上来的敌人可以继续进入前排供玩家攻击，但必须标成“下轮攻击”或“补位中”，不要混入本回合未解决伤害。

3. 前排槽位显示每个敌人的伤害和 intent 状态，例如 `BRU 5 本回合`、`COL 3 下轮`。

4. 首个遭遇保留固定可读阵型：至少 1 个高伤 Brute、1-2 个低血 Wisp、1 个中血 Collector，让玩家能做“先杀高伤 / 先扫低血 / 留 payoff”的选择。

### 验收方式

验收不需要浏览器先行，可以先用固定脚本和可视检查口径定义：

- 开局发牌后，文案或 HUD 必须能读出 5 个本回合攻击者，总伤害 `17`。
- 击杀一个 `Redline Brute` 后，本回合未解决伤害必须下降 `5`，即使同列后排补位到前排。
- 击杀一个 `Debt Wisp` 后，本回合未解决伤害必须下降 `2`，新补位敌人不得加入本回合伤害。
- 一次 `row_cleave` 或 payoff 清掉所有本回合攻击者后，结束回合前必须读到“本回合安全 / 0 伤害”，即使画面上已经有新前排。
- 3 回合内至少出现一次“当前前排可打，但不是本回合攻击者”的状态，并且 UI 能区分它。

## 5. 压力曲线设计师：敌人意图伤害是否产生紧迫而非实时压迫

### 当前判断

当前方向基本站在正确的一边：压力来自敌人 intent 和结束回合后果，不再依赖 realtime 推进、自动攻击、固定 60 秒 burst。这符合 Hyper-Turn 合同。

问题在于压力曲线现在太二元：开局前排总伤害很高，正确链路可能瞬间大幅削掉压力；如果玩家不处理，就吃一整段 `17` 点伤害。后续每轮又通过补满阵型回到类似压力形状，缺少“第 1 回合教你读，第 2-3 回合加压，第 4-5 回合 payoff 救场”的递进。它是回合制压力，但还不是压力曲线。

### 10 个镜头观察

1. 验收合同明确废弃实时推进、自动攻击和固定 60 秒 burst；runtime 当前主路径也确实以 `Deal -> PlayerTurn -> EnemyAttack -> EnemyRefill` 为核心。

2. `advance-time` 只在 `Deal` 状态自动发牌，没有持续推进敌人或持续扣血。旧的 `EnemyAdvanced`、`EnemyPressure`、`AutoAttack` 事件类型仍存在，但不是当前压力主轴。

3. 每次发牌会先声明敌人 intent，再发手牌并重置 chain。这让玩家在出牌前有机会看到“结束回合会发生什么”，方向正确。

4. 开局总 intent 为 `17/60 HP`，约等于玩家最大 HP 的 28%。这个数字足够紧迫，但对第一回合也偏硬；如果读不懂，很容易从“紧张”变成“莫名其妙被扣一大段”。

5. 起手 `Debt Hook -> Redline Cut/Heartbeat Spark -> Row Cleave` 能快速降低前排威胁。按升序打出 `Row Cleave` 时倍率可到 `x3`，对前排全体造成 15 点基础清压，是很强的第一回合救场工具。

6. 由于击杀会即时补位，视觉压力会很快回满；由于本回合攻击者快照不会吸纳新 enemyId，实际结束回合压力又可能已经降低。视觉曲线和结算曲线存在错位。

7. 敌人伤害没有按 round、队列深度、击杀数或奖励阶段递增。每轮补满后，压力主要取决于循环生成的敌人类型顺序，而不是设计过的曲线节点。

8. `speed` 未使用让敌人没有“快但轻 / 慢但重”的时间压力差。当前 Brute 的威胁来自 `5` 点伤害和 `22` HP，但它不会以更慢、更可预告的方式形成压力峰。

9. 结束回合会一次性结算所有 eligible enemies，然后立刻补位、AdvanceRound、deal 下一手。节奏很快，适合 hyper-turn；但也让受伤、补位、下一手之间缺少一个可感知的压力回顾点。

10. renderer 明确忽略 `EnemyAttacked` 的 3D 反馈，主要通过 HUD 的 player hit flash 和 combat feed 告诉玩家受伤。压力结果有数值反馈，但敌人“即将造成压力”的前摇还弱。

### 最大风险

最大风险是压力曲线只剩两种体验：

- 会打的人：第一套升序链直接把 intent 打掉，压力突然消失。
- 不会打的人：按下结束回合后一次吃大额伤害，觉得系统在惩罚读不懂的人。

这两种都不够理想。Hyper-Turn 需要的是“我看见会吃 17，于是用当前 3 MP 尽量把它压到 5；下一轮它又涨到 12；第 3-5 回合我用 payoff 把高峰压掉”。当前系统有这个潜力，但缺少稳定递进和明确读数。

### 下一轮最小改动

下一轮先建立一个 3-5 回合压力样本，不要扩大成完整平衡系统：

1. 用 `enemyIntentSummary` 作为单一压力真相，所有 HUD/渲染/测试都围绕它读。

2. 固定首轮压力目标：开局 `17` 可以保留，但必须保证正确第一链能把结束回合伤害压到 `0-5`，半正确路线压到 `6-10`，乱序或不处理吃到 `12-17`。

3. 第二、第三轮让压力回升，但不要靠实时推进；可以靠更高比例 Brute、更多本回合 intent、或 reward 后更大的 payoff 目标来制造峰值。

4. 保留“补位敌人下轮才攻击”的规则，并让 UI 明确显示。这会把压力从实时追赶转为回合内解题。

### 验收方式

压力曲线验收应以三条固定路径对比：

- 不出牌直接结束回合：HP 从 `60` 降到 `43`，且扣血等于发牌前声明的 `17`。
- 正确起手链 `0 -> 1 -> 2`：结束回合前未解决伤害至少下降 60%，最好降到 `0-5`。
- 断链或只打低收益牌：仍可出牌，但结束回合伤害应明显高于正确链，保留 `6-12` 的后果。
- 第 3-5 回合至少出现一次 intent 峰值，且 payoff 能把它压掉，而不是实时攻击把玩家压死。
- 每次 `EnemyIntentResolved` 的总和必须等于玩家结束回合前看到的 unresolved intent，不允许 UI 数字和实际扣血不一致。

## 6. 可读性 / Telegraph 设计师：玩家是否能在出牌前读懂后果

### 当前判断

HUD 已经有一套很好的可读性框架：顶部资源条、chain chip、intent chip、combat director、卡牌 chain preview、payoff preview、结束回合 title、前排显影面板。这些都朝着“出牌前读懂后果”在走。

但当前 telegraph 还不够可信。最严重的是 HUD 没有直接使用 snapshot 里的 `enemyIntents` / `enemyIntentSummary`，而是根据当前前排和 enemy definition 重新计算 intent。只要击杀后发生补位，HUD 可能展示“当前前排会打你”，但 runtime 真正结算的是“发牌时快照且仍存活的攻击者”。另外，3D 场景不处理 `EnemyIntentDeclared`，只在 `EnemyIntentResolved` 后做轻微 intent pulse；玩家在出牌前主要靠 HUD 文字，而不是敌人本体 telegraph。

### 10 个镜头观察

1. `EnemyIntentDeclared` 事件已经存在，并且在发牌时为每个 eligible enemy 发出。系统有 telegraph 数据源，不是从零开始。

2. `GameSnapshot` 已经包含 `enemyIntents` 和 `enemyIntentSummary`。这本应是 HUD 和 renderer 的权威输入。

3. HUD 当前 `enemyIntentSummary(frontThreatEnemies)` 会从当前前排敌人重新累加伤害。这个实现容易和 runtime 的本回合 intent 快照脱节。

4. 顶部 intent chip 会显示 `-17 HP` 这类强读数，方向正确；但 detail 只列前两个敌人并加 `+N`，没有标明哪些槽位/敌人是本回合攻击者。

5. combat director 的敌人意图主文案写成 `将受 X 伤害`，主语容易误读成敌人将受伤，而不是玩家将承受伤害。这里的中文 telegraph 需要更硬、更少歧义，例如 `结束回合扣 X HP`。

6. 结束回合按钮 title 会写入 unresolved intent，这是一个好兜底；但 title 对移动端和快速点击不可靠，不应该作为唯一确认层。

7. 每张牌显示 `起链/接链/断链`、倍率、payoff 预览，这是当前最强的出牌前反馈。但它没有告诉玩家“打出这张后，未解决伤害会从 17 变成多少”。

8. 单体牌默认随机前排；在未选择目标时，玩家最多知道“会打某个前排”，无法预读具体击杀、剩余 HP、剩余 intent。这对 early slice 的学习成本偏高。

9. 前排显影面板可手动展开并选择目标，能支持精确读盘；但默认收起，且槽位卡不显示 damage/intent 状态，玩家仍需要在多个 HUD 区域之间拼信息。

10. 3D renderer 的敌人标签显示类型、名字、HP，不显示伤害或 intent；`EnemyIntentDeclared` 没有对应视觉标记。出牌前的威胁主要停留在 HUD 文本层。

### 最大风险

最大风险是验收合同里“结束回合前能读到敌人将造成的伤害”被浅层满足，但玩家仍然无法在出牌前读懂“我的这张牌会怎样改变后果”。

可读 telegraph 不只是总伤害数字。它应该回答：

- 谁会打我？
- 每个敌人会打多少？
- 我这张牌打谁？
- 会不会杀死它？
- 杀死后本回合伤害会降多少？
- 新补上来的前排是现在打我，还是下轮再打？

当前系统能回答部分问题，但答案分散且可能矛盾。

### 下一轮最小改动

下一轮的最小 telegraph 改动应优先修“真相来源”和“出牌前后果”：

1. HUD 的 intent chip、director intent、结束回合标题、前排槽位全部改用 `snapshot.enemyIntents` / `snapshot.enemyIntentSummary`，不要从当前前排重新算。

2. 给每个有本回合 intent 的敌人加统一标记：HUD 槽位、3D 标签、目标按钮都显示 `本回合 -5` 这类短读数。

3. 给补位到前排但本回合不攻击的敌人加 `下轮` 标记，避免和 active intent 混淆。

4. 单体牌在未选择目标时，至少显示将采用的默认目标规则；更好的最小方案是默认锁定最高 intent 前排或最左前排，而不是随机。

5. 卡牌按钮在可打时显示一条简短后果预览：`杀 BRU: 意图 17 -> 12`、`横扫: 意图 17 -> 5`、`断链: 伤害不足`。移动端不能依赖 hover title。

### 验收方式

可读性验收应围绕“出牌前玩家是否能预测扣血”：

- 发牌后，不展开 debug trace，也能看到总 intent、每个 active intent 敌人的伤害、结束回合扣血。
- 选择一个有 intent 的 Brute 后，单体牌预览必须显示命中/击杀后会减少的 intent；如果无法击杀，也要显示仍会攻击。
- 打出一张牌后，HUD 显示的 unresolved intent 变化必须和 runtime `enemyIntentSummary.totalDamage` 一致。
- 击杀导致补位后，新前排必须显示为 `下轮` 或等价状态，不得让玩家以为它会在本回合立刻扣血。
- 在 390x844 这类移动视口上，关键 telegraph 必须是常显文本或 badge，不能只放在 title/hover/debug trace。

## 优先级建议

1. 先把 `snapshot.enemyIntents` / `snapshot.enemyIntentSummary` 立为唯一 intent 真相源，HUD 不再按当前前排自行重算伤害。

2. 明确区分“本回合攻击者”和“补位/下轮前排”，否则前排、补位、清场救场都会读错。

3. 做一个固定 3-5 回合压力脚本：无操作、半正确、正确链、payoff 救场四条路径都要有明确 intent 前后数值。

4. 让敌人槽位承载局面信息：类型、HP、伤害、intent 状态同时出现，Brute 必须成为玩家自然想优先处理的高价值目标。

5. 给卡牌增加出牌前后果预览，至少覆盖 selected target、是否击杀、未解决 intent 将从多少降到多少。
