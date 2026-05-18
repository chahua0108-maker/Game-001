# Redline Expert Lens 09 - Product Competitive

Date: 2026-05-18
Baseline commit: `b24b262`
Worker role: 25-27 product / competitive / demo scope review
Scope: documentation only. No runtime, HUD, VFX, data, test, or QA artifact was changed.

## 25. 竞品系统分析师

### 当前判断

`Redline Hyper-Turn Card Pressure Slice` 的正确竞品参照不是实时自动战斗压力，而是 `Vampire Crawlers` 这类“超高速回合制卡牌压力”：玩家通过费用升序、手牌缺口、Wild/draw/mana 修补、敌人意图和 payoff 清场来承受压力。

当前方向已经从旧的 realtime heartbeat 纠偏，但差异化还没有真正成立。现在最容易落入两个错误：一是又回到自动攻击 / 压线 / 固定 burst；二是只复制 `0 -> 1 -> 2 -> 3`，但没有让 Redline 自己的卖点变成“我用链路清算敌意图”。

### 10 个镜头观察

| # | 镜头 | 观察 |
|---:|---|---|
| 1 | 竞品核心 | `Vampire Crawlers` 的压迫来自 turn 内卡牌顺序和构筑爆发，不来自不操作也会发生的自动输出。Redline 必须继续把自动攻击排除在核心验收外。 |
| 2 | 可复制项 | 可复制的是费用升序链、Wild 修补、draw/mana 延长、敌人意图和 payoff 变强，不是表层的敌群拥挤或 60 秒清场。 |
| 3 | 应避免项 | PC Gamer 负面口径暴露的风险是前期慢热和重复。Redline 第一局不能把真正的 synergy 藏到后面，必须在 3-5 回合内给出断链、修补、清场。 |
| 4 | 差异化主语 | Redline 可以把差异化放在“清算敌意图”：链路不是为了抽象倍率，而是为了取消可见伤害、清前排、避免崩盘。 |
| 5 | 角色标签 | H1 的 `START / BRIDGE / EXPAND / PAYOFF / WILD REPAIR` 是比竞品更适合 demo 的可读优势，应成为首屏语言，而不是藏在牌面长说明里。 |
| 6 | Payoff 规则 | 3 费 payoff 必须有 `armed/unarmed` 差异。否则玩家会认为大牌天生强，费用链只是装饰。 |
| 7 | 修补工具 | Wild/draw/mana 是系统竞争力的关键，不是补丁功能。没有一次“坏手牌被修好”，Redline 就只是普通按费用出牌。 |
| 8 | 敌人压力 | 敌阵可以保留空间感，但压力必须是回合后果：前排意图、后排补位、boss/精英倒计时，而不是实时推进扣血。 |
| 9 | 当前证据 | 浏览器 QA 已证明链、意图、payoff 的初步可读性，但 break、repair、reward response 仍是 `not run` 或 `partial`，还不能证明竞品级闭环成立。 |
| 10 | 不要扩表 | 现在不需要更多卡牌、更多敌人或更长随机 run。竞品压力能不能成立，取决于一条固定 3-5 回合体验是否清楚。 |

### 最大风险

最大风险是“看起来改回卡牌了，但玩家仍然不知道它为什么比普通卡牌 roguelike 更值得玩”。如果首轮只展示 `0 -> 1 -> 2` 和数值倍率，而没有展示敌意图被取消、坏手牌被修补、payoff 因链路成立而清场，Redline 会变成低辨识度的 `Vampire Crawlers` 弱化复刻。

### 下一轮最小改动

只围绕一个固定五回合种子补齐竞品闭环：

1. Turn 1：明显成功链 `0 -> 1 -> 2`，清掉或压低前排意图。
2. Turn 2：诱导玩家看到 3 费 payoff 未 armed 时很弱。
3. Turn 3：Wild/draw/mana 修补一次缺口。
4. Turn 4：payoff 因链长或 last cost 2 armed，清前排或取消大部分意图。
5. Turn 5：奖励三选一回应刚才的问题：修补、延长、贪 payoff。

不新增大系统；只补能让这条链成立的最低数据、规则输出、HUD 标签和 QA 证据。

### 验收方式

- 30 秒内，玩家能看懂至少一条 `0 -> 1 -> 2` 或 `0 -> 1 -> payoff` 路线。
- 90 秒内，trace 或 playtest 证明成功链、断链、修补、payoff 至少各出现一次。
- 3-5 回合内，payoff 的价值来自链路成立，不来自固定时间脚本或自动攻击。
- End Turn 前能看到未处理意图，End Turn 后 HP/敌人状态与预览一致。
- QA 证据不得用自动攻击、no-input damage、realtime pressure-line 或 60 秒 burst 作为通过理由。

## 26. Demo 制作人 / Scope Owner

### 当前判断

下一轮最小闭环已经足够明确，不能再进入“大改一轮再看”的状态。当前最重要的 scope 决策不是继续设计更多卡牌，而是先选择一个明确的资源规则，让 `0 + 1 + 2 + 3` 或等价 payoff 链在 demo 内合法成立。

H1 已经指出硬阻塞：当前 `maxEnergy = 3` 下，自然的 `0 + 1 + 2 + 3` 总成本为 6，不能靠现有 MP 直接打出。如果不先定下 `scripted higher MP`、`mana gain/refund` 或 `chain rebate` 的唯一方案，Runtime、HUD、QA 会各自假设一套规则，下一轮很容易再走两三天弯路。

### 10 个镜头观察

| # | 镜头 | 观察 |
|---:|---|---|
| 1 | 合同清晰度 | `redline-hyperturn-acceptance.md` 已经把 0-30 秒、30-90 秒、5-8 分钟压缩验收写得足够窄，可以直接作为下一批 pass/fail。 |
| 2 | 最大阻塞 | H1 的 MP 经济问题是实现前置条件，不是平衡细节。没有可解释的额外 MP / 返费 / rebate，Turn 4 payoff 清场无法自洽。 |
| 3 | 固定种子 | 3-5 回合固定 seed 是正确 scope；当前阶段不应追求完整随机 run、完整掉落池或长期构筑。 |
| 4 | Runtime 最小面 | 需要的是 `ChainState`、`EnemyIntent`、`PayoffTriggered`、`TurnResult` 等可观察输出，不是重写整个战斗系统。 |
| 5 | HUD 依赖 | H2 已经用现有 snapshot 推导 UI，但这是过渡方案。下一轮要减少 HUD 猜规则的比例，否则测试会绿、体验会漂。 |
| 6 | QA 缺口 | 当前浏览器 QA 只跑到 desktop 2 回合，mobile 主要是视觉检查；break、repair、reward response 还没有证据。 |
| 7 | 不要再扩卡 | 新卡牌数量不是短板。短板是现有卡牌角色、资源规则、首五回合脚本和证据链没有闭合。 |
| 8 | 失败方向隔离 | realtime heartbeat 旧方向已经有 deprecated 标记和失败 patch，后续测试必须防止旧指标复活。 |
| 9 | 移动端范围 | 移动端下一步只验关键交互：成本可读、单击不误触、End Turn 后果可见。不要提前做完整移动端 polish。 |
| 10 | 合并标准 | 下一批应该以一份 trace、几张截图、metrics JSON 和 sim test 同时证明同一条体验，而不是每个 worker 各自证明一小块。 |

### 最大风险

最大风险是“规则未定导致并行 worker 分叉”。尤其是 MP / payoff 合法性：如果 Runtime 用脚本加 MP，HUD 用倍率预估，QA 按返费理解，最后会出现每个局部看似合理、整体不可验收的 demo。

### 下一轮最小改动

先做一个 `H4 fixed-seed demo contract` 或等价实现说明，明确且只明确四件事：

1. 选择唯一的 payoff 能量方案：推荐 `visible mana gain/refund`，因为它最容易让玩家理解“我延长了这一回合”。
2. 固定 Turn 1-5 的起手、敌人意图、奖励选项和期望 trace。
3. Runtime 暴露最小字段：chain、intent、payoff armed state、turn result。
4. QA 只按这条 seed 跑桌面和 390x844，不新增额外模式。

### 验收方式

- sim test 能稳定复现 Turn 1-5 的核心事件：success chain、break、repair、armed payoff、reward response。
- 浏览器桌面手动跑满至少 4 回合，截图或 trace 覆盖每个关键事件。
- 390x844 至少完成一次真实点击链路和 End Turn，不只截图首屏。
- 所有证据指向同一套 MP / payoff 规则，没有文档、HUD、测试口径冲突。
- 旧 realtime 指标不参与通过判定。

## 27. Steam Demo Product Lead

### 当前判断

Steam demo 的第一问题不是“系统是否完整”，而是玩家在 30 秒内是否知道卖点，在 3 分钟内是否想继续。当前材料已经把系统方向改对，但产品表达还差一个“可截图、可录短视频、可复述”的瞬间：

> 我按费用把坏手牌修成链，取消了敌人的致命意图，然后 payoff 清场。

如果这个瞬间在前三分钟内没有出现，玩家只会看到普通卡牌手牌、普通敌人、普通倍率，愿意继续的概率不够。

### 10 个镜头观察

| # | 镜头 | 观察 |
|---:|---|---|
| 1 | 0-3 秒 | 玩家必须先看到手牌、MP 成本、链路提示和敌人意图。任何 debug、FSM、牌堆细节都不能抢首屏。 |
| 2 | 3-30 秒 | 第一手要给一条诱人的正确路线，最好是 `START 0 -> BRIDGE 1 -> EXPAND 2`，并立刻看到前排意图下降。 |
| 3 | 30 秒卖点 | 仅显示 `x3` 不够。Steam demo 的卖点要落到“我少吃了多少伤害 / 哪个前排被我清掉”。 |
| 4 | 反例教学 | Turn 2 的 3 费 payoff 诱惑很重要：玩家要明白大牌不等于免费胜利，setup 才是爽点。 |
| 5 | 3 分钟钩子 | Turn 3 的修补是最强产品钩子。坏手牌被 Wild/draw/mana 接回来，比单纯高伤害更能证明系统深度。 |
| 6 | 爆点镜头 | Turn 4 应该是可传播瞬间：敌人意图接近致命，玩家打成长链，payoff armed，前排清掉，伤害预览从危险变安全。 |
| 7 | 继续动机 | Turn 5 奖励必须让玩家想“下一把我要拿更多修补 / 延长 / payoff”。没有奖励回应，就不像 deckbuilder demo。 |
| 8 | 文案密度 | 首屏不要靠长说明。`START 0`、`BRIDGE 1`、`EXPAND 2`、`PAYOFF ARMED`、`Intent -12 HP` 这类短标签更适合 demo。 |
| 9 | 移动观感 | 390px 已有视觉通过，但还没证明单手点击和 3-5 回合阅读。Steam 页面视频可以偏桌面，但真实试玩不能忽视移动式窗口和小屏。 |
| 10 | 退出风险 | 如果前三分钟没出现 repair 和 reward response，玩家会把 Redline 归类为“又一个 roguelike deckbuilder 原型”，不会等后续系统展开。 |

### 最大风险

最大风险是首屏看不出独特性，前三分钟没有爆点。玩家可能理解“这是卡牌战斗”，但不理解“为什么我要继续玩这个卡牌战斗”。对 Steam demo 来说，理解品类不等于产生愿望单动机。

### 下一轮最小改动

把前 3 分钟压成一个产品脚本，而不是系统全貌：

1. 第 1 分钟：教会链路和意图取消。
2. 第 2 分钟：展示 payoff 先打很弱、接链后才强。
3. 第 3 分钟：展示一次坏手牌修补、一次 armed payoff 清前排、一次奖励回应。

UI 只服务这三个镜头：链路、敌意图、payoff armed、奖励回应。其他系统都可以折叠或延后。

### 验收方式

- 静默 30 秒测试：只看屏幕不解释，测试者能说出“我应该按费用顺序出牌，并避免敌人意图伤害”。
- 3 分钟手动测试：测试者能复述一次“坏手牌如何被修补”和一次“payoff 为什么变强”。
- 截图/视频可截出一个清晰卖点画面：`CHAIN`、`Intent`、`PAYOFF ARMED`、敌人清场或伤害取消同时可见。
- Reward 选择能让测试者说出下一步构筑方向：补链、续航、贪大招三者至少能区分。
- 若测试者只能记住“有卡牌、有敌人、有倍率”，则产品验收失败，即使 sim test 通过。

## 优先级建议

1. 先定唯一 MP / payoff 合法性方案；没有这个，H1 的五回合脚本无法稳定验收。
2. 下一批只做固定 3-5 回合 seed：成功链、断链、修补、armed payoff、奖励回应。
3. Runtime 暴露 `ChainState / EnemyIntent / PayoffTriggered / TurnResult`，减少 HUD 和 QA 猜规则。
4. QA 补齐 desktop 与 390x844 的真实 3-5 回合证据，尤其是 repair 和 reward response。
5. Product demo 截图/视频只围绕一个卖点画面：链路成立、敌意图被取消、payoff 清场。
