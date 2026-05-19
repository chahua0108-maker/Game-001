# 2026-05-19 第 12 轮专家 01：竞品相似度产品总监

角色：第 12 轮专家 01，竞品相似度产品总监  
工作目录：`/Users/roc/Game-001`  
文件所有权：本文只写 `design/technical/redline-batches/long-task/2026-05-19-round-12-01-similarity-pm.md`  
输出边界：只写文档；不改源码、不改测试、不提交 git、不回滚或覆盖其他工作者修改。  
上轮基线：第 11 轮已落地 `wild_gap_key` MP3 延链、独立 `ChainExtended`、HUD `延MP3/续燃` 和三视口 QA。  
用户目标：越像竞品越成功；10 轮不够就继续迭代。  
版权边界：只对齐公开可观察的机制结构、节奏和反馈；不复制受版权保护的卡名、文案、美术、UI 构图、数值表、图标或素材。

## 0. 一句话裁决

第 12 轮应该进入：

```text
P0：3-5 回合竞品相似度复测脚本
P1：最小牌区生命周期调研
P2：冻结完整生命周期实现和所有大系统扩张
```

本轮不应继续扩 Wild，也不应直接开完整牌区生命周期代码。第 11 轮已经把“Wild 像延长 stack 的牌”这件事补上了；第 12 轮的最大风险是团队继续凭工程直觉加系统，却没有证据证明玩家在 3-5 回合内觉得更像竞品。

产品裁决：先把相似度镜头变成可重复脚本和可执行验收指标，再让生命周期调研决定下一轮代码怎么开。

## 1. P0/P1/P2 裁决

| 优先级 | 裁决 | 第 12 轮该做什么 | 验收口径 | 不做什么 |
| --- | --- | --- | --- | --- |
| P0 | 必做 | 3-5 回合竞品相似度复测脚本：覆盖成功链、Wild 延链、坏手修补、奖励响应、失败反例、爆炸清场。 | 产出可重复的 `sim` 或 `qa:ui` 场景记录；每个镜头有事件、HUD、数值、失败原因；最终给相似度分数。 | 不新增玩法系统来掩盖复测缺口。 |
| P0 | 必做 | 相似度 scorecard 固化：升序、延链、速度、奖励、失败、清场、UI 可读、版权安全。 | 总分和每项证据必须能追到 trace/DOM/截图/JSON；低于门槛不得宣称“已经像竞品”。 | 不用“测试全绿”替代“玩家镜头成立”。 |
| P1 | 只调研 | 最小牌区生命周期调研：梳理当前抽、弃、洗、奖励入牌、消耗/保留/状态缺口，给下一轮最小代码切片。 | 只输出合同和风险，不改 runtime；明确哪些字段只是文案标签，哪些已有真实运行时。 | 不在第 12 轮直接做 `exhaustPile`、retain、status 卡代码。 |
| P1 | 可准备 | 给生命周期 v1 写验收草案：普通弃牌、消耗、保留、状态牌、回填、奖励不退化。 | 下一轮执行者可直接按草案切代码，但本轮不迁移。 | 不做通用 `CardInstanceId`、升级、遗物、触发器。 |
| P2 | 冻结 | 完整 roguelite 层、地图、商店、局外成长、宝石 socket、通用重排、discard search、完整卡实例。 | 只进 backlog，不进入第 12 轮。 | 不用“大系统更像竞品”作为抢跑理由。 |

## 2. 第 12 轮 P0 成功标准

P0 不是写一段“成功清场演示”。它必须证明 3-5 回合里同时存在：

1. 玩家能看到敌人压力，而不是只看亮起的牌。
2. `0 -> 1 -> 2` 或等价升序链能自然出现。
3. `wild_gap_key` MP3 延链能进入玩家可见 HUD。
4. 延链后的 payoff 能读成“续燃后的爆点”，不是系统白送。
5. 坏手、断链、未命中或缺授权至少出现一个反例。
6. 奖励选择能回应上一手问题，并影响下一手。
7. 失败结算与预览一致，玩家能理解为什么掉血。
8. 三视口 UI 不溢出、不泄漏 raw token、不残留浏览器或 dev server。
9. 玩家可见文本不包含竞品专有卡名、原文描述、图标复刻或第三方素材。

建议通过门槛：

```text
P0 pass = 至少 10 个相似度镜头全部有可执行验收证据；
partial = 机制 trace 成立但 HUD/失败/奖励证据缺一类；
fail = 只有单回合成功链，或没有失败反例，或有版权/膨胀越界。
```

## 3. 相似度镜头与可执行验收指标

| # | 相似度镜头 | 目标玩家感知 | 可执行验收指标 | 优先级 |
| ---: | --- | --- | --- | --- |
| 1 | 开局读压 | 玩家先看到本回合会被打多少，再决定出牌。 | 复测脚本起始状态必须记录 `player.hp`、当前 MP、敌人 intent、End Turn 预览伤害；桌面、390、360 三视口中 End Turn 后果可见；`textOverflowCount=0`。 | P0 |
| 2 | 快速升序起链 | 玩家在第一回合 20 秒内理解并完成低费起链。 | trace 中出现连续 `CardPlayed`：printed/effective cost 序列至少为 `0,1,2`；对应 `effectMultiplier` 至少为 `1,2,3`；HUD 显示短 token，不出现 raw `nextExpectedCost`。 | P0 |
| 3 | 断链反例 | 打错顺序仍能继续，但爆点明显变弱。 | 同一手牌提供乱序路线；乱序 `CardPlayed.effectMultiplier=1`；不得发 `AuthorizationGranted`；总输出低于有序链至少 35%；HUD 或日志出现 `断链`/`x1` 等短反馈。 | P0 |
| 4 | 缺 MP 坏手 | 玩家知道自己差的是资源，不是按钮坏。 | 至少一个镜头中关键牌不可高效打出时显示具体缺口：`缺MP1` 或等价字段；脚本记录当前 MP、牌 cost、可替代行动；无长规则句塞进卡牌按钮。 | P0 |
| 5 | Wild MP3 延链 | `wild_gap_key` 像把 stack 接到下一段的牌。 | 复测中出现 `0 -> 1 -> 2 -> wild_gap_key`；trace 有 `ChainExtended`，`extendedCost=3`，`CardPlayed.chainExtended=true`；HUD 可见 `延MP3` 或等价短 token。 | P0 |
| 6 | 续燃 payoff | 延链后终结像铺垫出来的爆点。 | Wild 延链后打 payoff；trace 中 payoff `effectMultiplier >= 5` 或等价续燃倍率；HUD 可见 `续燃`/`终结 xN`；`PayoffResolved.preventedIntentDamage > 0`。 | P0 |
| 7 | 修补不是自动胜利 | 修补提供机会，但敌人压力仍可读。 | 修补/抽牌后脚本记录敌意图仍大于 0 或 End Turn 仍有伤害预览；HUD 同时表达收益和剩余压力，例如 `抽N仍-X`、`修补仍-X` 或等价短 token。 | P0 |
| 8 | 整备顶终结命中 | 玩家看到自己把爆点安排到了下一步。 | `paper_shatter` 命中时 trace 顺序必须是 `PayoffTopdecked` 早于 `HandDealt`；只搜 `drawPile`；HUD 可见 `整备：顶终结` 或等价短 token。 | P0 |
| 9 | 整备未命中 | 未找到终结不是 bug，而是可理解的风险。 | drawPile 无 payoff 时发 `PayoffTopdeckMissed`；不得搜索 discardPile；仍按抽牌规则结算；HUD 可见 `整备无牌`、`未见终结` 或等价短 token。 | P0 |
| 10 | 奖励回应上一手问题 | 奖励不是随机变强，而是在补刚才的缺口。 | 3-5 回合脚本中至少出现 1 次奖励选择；记录上一手失败/缺口标签：`缺MP`、`缺终结`、`断链`、`压力未解`；奖励选项有路线标签：`延长`、`终结`、`整备`、`保命` 中至少两类。 | P0 |
| 11 | 奖励进入下一手 | 玩家立刻看到自己的选择改变后续手牌。 | `RewardChosen` 后出现 `AddCardToDeck` 或等价事件；下一次 `HandDealt`、drawPile 顶部或 HUD 证据能追到被选奖励；restart 后该奖励不保留。 | P0 |
| 12 | 爆炸清场 | 清场来自前面铺垫，而不是突然播放演示。 | 清场前记录敌人数量、HP、intent；payoff 后记录意图大幅下降或归零；玩家受到的 End Turn 伤害低于清场前预览；trace 中有授权支付或延链因果。 | P0 |
| 13 | 失败结算公平 | 失败也要像卡牌解局，而不是 UI 莫名失效。 | 至少一个失败镜头执行 End Turn；结算后 HP delta 等于预览伤害；日志可追到失败原因：断链、未命中、缺授权、缺 MP 中至少一种。 | P0 |
| 14 | 3-5 回合连续性 | 相似感来自连续 run，不是单镜头。 | 同一次复测至少跨 3 回合，推荐 5 回合；每回合保留 `turnIndex`、手牌、MP、敌意图、玩家动作、奖励或失败字段；不能只提交单回合成功截图。 | P0 |
| 15 | 小屏可读 | 类竞品的密集信息不能牺牲移动端。 | `qa:ui` 或等价浏览器脚本跑 `1366x768`、`390x844`、`360x640`；每档 `consoleErrorCount=0`、`horizontalOverflowDetected=false`、`textOverflowCount=0`、End Turn 可点、cleanup pass。 | P0 |
| 16 | 版权安全镜头 | 相似度只来自结构，不来自复制表达。 | DOM 文本、卡面、奖励、日志不得出现竞品专有卡名、第三方原文描述、素材路径、图标复刻说明；自动报告固定包含 `notAFullClone=true`。 | P0 |
| 17 | 生命周期证据采样 | 为下一轮生命周期调研收集最小事实。 | 复测报告附带每个镜头前后的 `hand/drawPile/discardPile/deck` 摘要；只读采样，不改牌区实现；列出哪些移动缺少结构化事件。 | P1 |
| 18 | 最小生命周期候选排序 | 下一轮知道先补什么，不把系统一次摊开。 | 调研结论必须给出 `CardMoved/Discard reason`、`exhaust`、`retain`、`status` 的排序和阻塞关系；明确 `CardInstanceId` 仍是 P2。 | P1 |

## 4. 建议的 P0 复测报告字段

第 12 轮执行者可用现有测试/QA 命令扩展，也可以新增一个专门入口。产品层不指定实现方式，但最终报告至少应有这些字段：

```json
{
  "round": 12,
  "scenario": "3-5-turn-competitor-similarity",
  "similarityScope": "mechanic-and-hud-slice-only",
  "notAFullClone": true,
  "turnsPlayed": 5,
  "shotsPassed": 0,
  "shotsTotal": 16,
  "requiredCounterexampleCaptured": true,
  "wildMp3ExtensionObserved": true,
  "chainExtendedEventObserved": true,
  "continuationPayoffObserved": true,
  "rewardRespondedToPreviousProblem": true,
  "failureResolutionReadable": true,
  "mobileReadable": true,
  "copyrightSafetyPassed": true,
  "unsupportedClaims": [
    "完整竞品复刻",
    "完整牌区生命周期",
    "完整移动端产品"
  ]
}
```

硬门槛：

- `notAFullClone` 必须为 `true`。
- 没有失败反例时，最多只能是 `partial`。
- 没有三视口 HUD 证据时，最多只能是 `mechanic-pass-ui-missing`。
- 有 raw token 泄漏、版权文本风险或浏览器 cleanup 失败时，不得标记为完整通过。

## 5. P1：最小牌区生命周期调研范围

P1 调研的目的不是立刻写代码，而是回答下一轮生命周期 v1 的最小刀应该切在哪里。

必须调研：

| 调研项 | 当前事实 | 调研输出 |
| --- | --- | --- |
| 普通牌移动 | 打出牌和回合末手牌都会进 discard，但结构化移动原因不足。 | 下一轮是否先补 `CardMoved`/`CardDiscarded` 事件，原因枚举包含 played/end-turn/reward-selected。 |
| 抽牌和回填 | drawPile 空时从 discardPile 回填；抽牌牌有自抽护栏。 | 复测中列出哪些镜头依赖回填，哪些缺少 `DeckReshuffled` 证据。 |
| 消耗 | 关键词有“消耗”，但没有真实 `exhaustPile`。 | 下一轮只允许 1 张测试消耗牌，不做完整消耗生态。 |
| 保留 | 关键词有“保留”，但回合末统一弃牌。 | 下一轮只允许 1 张保留牌，下回合先带入再补抽。 |
| 状态牌 | `CardType` 有 status，但没有真实物理状态牌。 | 下一轮只允许 1 张状态/污染测试牌，抽到占手，按单一规则清理。 |
| 卡实例 | 当前牌区仍是 `CardId[]`。 | 继续判为 P2；不为 v1 消耗/保留/状态强行迁移实例系统。 |

P1 交付应是调研文档和下一轮验收草案，不应产生 runtime 变更。

## 6. 明确不能做的事

### 6.1 避免系统膨胀

第 12 轮不能做：

- 不继续扩 Wild：不做无限 Wild，不让所有 Wild 都能 MP3+ 延链，不把 `wild_mana_stitch` 改成 MP3+ 延链牌。
- 不把 `ChainExtended` 合回 `ChainRepaired`，避免误触返 MP 和语义倒退。
- 不开完整牌区生命周期实现：不新增全量 `exhaustPile`、retain、status 生态、净化、诅咒。
- 不做 `CardInstanceId` 全迁移、同名不同升级、临时费用、复制牌、永久修改。
- 不做通用 `EffectSpec[]`、`TriggerSpec[]`、遗物、通用 onDraw/onDiscard/onExhaust 触发系统。
- 不做完整 reorder/scry/tutor/redraw UI，不做 discardPile search。
- 不做路线地图、商店、营地、Boss、事件池、局外货币、账号存档、永久 Max MP。
- 不做宝石 socket、稀有度、reroll、删牌、净化入口。
- 不新增大批内容牌、敌人、美术、动画、音效来制造“更完整”的错觉。
- 不把 QA 平台化成截图基线、跨浏览器矩阵、录像系统；本轮只需要复测脚本和证据。

### 6.2 避免版权风险

第 12 轮不能做：

- 不复制竞品卡名、敌人名、关键词原文、规则描述、任务描述、UI 标签或提示文案。
- 不复刻竞品 UI 构图、按钮排布、图标形状、稀有度样式、颜色编码或动效节奏到可识别程度。
- 不导入、截取、临摹或生成近似第三方美术、音效、字体、Logo、宣传图。
- 不把 `Vampire Crawlers` 或其他竞品名称放进玩家可见 UI；只允许出现在内部评审文档。
- 不把自动报告写成“完整复刻”“达到竞品级别”“1:1 还原”；只能写“当前切片验证了若干机制结构相似信号”。
- 不照搬竞品具体数值曲线、卡牌组合、关卡结构或奖励表。

安全表达方式：

```text
允许：升序连锁、延链、坏手修补、奖励响应、失败可读、短 run 复测。
禁止：复制第三方表达、素材和可识别内容。
```

## 7. 第 12 轮最终 PM 判断

第 11 轮把相似度从 `7/14` 的核心战斗切片继续往前推了一步，但第 12 轮不能继续凭“新增机制”来证明更像竞品。现在最重要的是把玩家在 3-5 回合内看到的镜头证据固定下来：

```text
读压 -> 升序 -> Wild 延链 -> 续燃 payoff -> 坏手/失败反例 -> 奖励回应 -> 下一手变化。
```

如果这条链能被复测脚本稳定记录，下一轮再开最小牌区生命周期 v1 是合理的。  
如果这条链还不稳定，直接做消耗、保留、状态牌只会增加系统面积，并不一定让玩家觉得更像竞品。

第 12 轮裁决：

```text
先 P0 复测脚本。
同步 P1 生命周期调研。
冻结 P2 大系统和版权高风险表达。
```

STATUS: DONE
