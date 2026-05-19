# 2026-05-19 Round 12-02：3-5 回合玩家体验复测导演

角色：第 12 轮专家 02，3-5 回合玩家体验复测导演  
工作目录：`/Users/roc/Game-001`  
文件所有权：`design/technical/redline-batches/long-task/2026-05-19-round-12-02-journey-playtest-director.md`  
边界：只写本文档；不改源码、不提交、不回滚、不覆盖其他工作者文件。  
目标：基于现有 Redline 核心循环，设计一套可自动化/半自动化的 3-5 回合复测脚本，验证成功链、坏手修补、Wild MP3 延链、奖励响应、失败压力、UI 不超框、浏览器关闭。

## 0. 复测裁决口径

这轮复测不再只问“事件是否触发”，而是问玩家是否在 3-5 回合里自然经历这条旅程：

```text
读到本回合压力
  -> 用 0 -> 1 -> 2 打出成功链
  -> 遇到坏手或缺口
  -> 用 draw / mana / Wild 修补
  -> 用 wild_gap_key 把 MP3 窗口延长成更高 stack
  -> payoff 或奖励回应前面的真实问题
  -> 至少一次失败后果与预览一致
```

通过标准不是“玩家把正确按钮点完”，而是玩家能说出：

- 我现在会被打多少。
- 我为什么先打低费牌。
- 我缺的是 MP、链段、授权还是终结。
- Wild MP3 延链为什么不是普通修补。
- 奖励解决了上一手哪个问题。
- 失败扣血为什么公平。

如果玩家描述变成“系统给我答案，我照亮点按钮”，则判定体验失败，即使 sim、HUD 和浏览器 QA 全绿。

## 1. 自动化/半自动化分层

建议把复测拆成三层，不要求一次脚本同时完成所有判断：

| 层 | 作用 | 推荐证据 |
| --- | --- | --- |
| `sim` 层 | 锁定机制事实：事件顺序、倍率、授权、修补、失败结算。 | `CardPlayed`、`ChainRepaired`、`ChainExtended`、`AuthorizationGranted`、`PayoffTriggered`、`PayoffResolved`、`HandDealt`、`RewardChosen`。 |
| `browser` 层 | 锁定玩家看得到：HUD token、奖励面板、移动端不超框、无 raw debug token。 | 三视口 DOM 断言、可见文本、截图、console error、overflow metrics。 |
| `human` 层 | 锁定玩家真的理解：每回合一句口述。 | 录屏、玩家口述、观察者标记：`像卡牌解局` / `像教程脚本` / `看不懂`。 |

半自动执行时，允许脚本用现有 `createInitialWorld()`、`tickWorld()`、`buildSnapshot()`、`Hud` 在浏览器 evaluate 中注入确定性世界；不要求依赖真实随机发牌自然撞出所有镜头。人工测试时，不向玩家解释正确路线，只要求每回合先说“最大危险”和“为什么这样出牌”。

## 2. 3-5 回合复测脚本

### 回合 1：成功链与压力读取

场景：开局发牌后，玩家看到 HP、当前 MP、敌意图、End Turn 伤害和 `0/1/2` 路线。  
推荐牌组：`debt_hook`、`redline_cut` 或 `heartbeat_spark`、`row_cleave` 或 `clearance_order`。  
预期旅程：玩家先读压力，再按 `0 -> 1 -> 2` 出牌，看到 `x1 -> x2 -> x3`、`授权+3`，并知道 payoff 窗口是被自己铺出来的。

自动化核心断言：

- `HandDealt` 出现，`fsm.gameFlow === "PlayerTurn"`。
- 开局 `enemyIntentSummary.totalDamage > 0` 或等价 intent preview 可读。
- `CardPlayed.effectMultiplier` 序列至少为 `1,2,3`。
- 2 MP 路线段触发 `AuthorizationGranted`，但不直接触发 payoff。

### 回合 2：坏手修补

场景：玩家手里缺关键段，或当前 MP/链路无法自然接到 2 MP。  
推荐牌组：`debt_hook`、`pulse_draw`，抽牌堆放 `row_cleave`；或用 `wild_mana_stitch` / `wild_gap_key` 修补 MP1/MP2 缺口。  
预期旅程：玩家理解修补是在找解，不是直接防御。打出 draw / Wild 后，敌意图仍然可见，`仍-X` 不消失。

自动化核心断言：

- `pulse_draw` 在 `x2+` 时产生对应抽牌收益，`HandDealt.cardIds` 包含关键段。
- self/draw 牌的 intent preview 保持 `before === after`，可见 token 形如 `抽2仍-X`。
- 真实 Wild 修补时出现 `ChainRepaired`；不满足条件时不得假显示修补成功。

### 回合 3：Wild MP3 延链

场景：玩家已经打完 `0 -> 1 -> 2`，手里有 `wild_gap_key`，当前链路期望 MP3。  
推荐牌组：`debt_hook`、`redline_cut`、`row_cleave`、`wild_gap_key`、`severance_burst`。  
预期旅程：玩家看到 `wild_gap_key` 不是普通 MP1 修补，而是把 MP3 窗口延成 `延MP3x4`，随后 payoff 继续读作 `续燃x5` 或等价高倍率爆点。

自动化核心断言：

- `wild_gap_key` 在 `nextExpectedCost === 3` 时触发 `ChainExtended`。
- 该次 `CardPlayed` 为 `printedCost: 1`、`currentEnergyPaid: 1`、`effectiveCost: 3`、`effectMultiplier: 4`。
- 不出现 `ChainRepaired`，不触发 `wild_mana_stitch` 的返 MP 逻辑。
- HUD 可见 `延MP3x4`、`延链MP3` 或等价短 token。

### 回合 4：payoff 与奖励响应

场景：玩家在成功链或 Wild 延链后打出 3 MP payoff，清掉高意图；随后进入奖励选择。  
推荐 payoff：`severance_burst` 或 `red_ledger_burst`。  
推荐奖励分支：修补资源 `wild_gap_key` / `wild_mana_stitch` / `pulse_draw`，路线桥 `paper_shatter` / `clearance_order`，终结 `severance_burst` / `red_ledger_burst`。  
预期旅程：玩家知道清场来自前面链路和授权；奖励不是随机变强，而是回应上一手暴露的问题。

自动化核心断言：

- payoff `authorizationPaid > 0`，`effectMultiplier >= 4`，并触发 `PayoffTriggered` / `PayoffResolved`。
- `PayoffResolved.preventedIntentDamage > 0` 或结束回合 HP 损失低于 payoff 前预览。
- `RewardChosen` 后，所选牌进入当前 run 的 deck / drawPile / 下一手可观察区域。
- 奖励面板三张牌可读，至少区分修补、路线、终结两类功能。

### 回合 5：失败压力与公平结算

场景：安排一次断链、抽牌未命中、`paper_shatter` miss、授权就绪但无终结，或有终结但缺授权。  
预期旅程：玩家失败但不迷惑，知道为什么没有爽起来，也知道下一手要补什么。

自动化核心断言：

- 断链后 `CardPlayed` 仍成功，但 `effectMultiplier === 1`，不发 `AuthorizationGranted`。
- `paper_shatter` miss 时出现 miss 事件或等价失败信号，不搜不该搜的区域，不假装找到 payoff。
- End Turn 前预览伤害与结算后 HP 损失一致。
- UI 不显示 `安全`、`已解决`、raw debug token 或隐藏内部字段。

## 3. 观察镜头矩阵

每个镜头都可以自动化记录基础事实，再由观察者补玩家口述。P0 建议至少跑镜头 1-12；镜头 13-14 是浏览器验收硬门槛。

| # | 镜头 | 玩家看到什么 | 预期选择 | 失败信号 | 自动化断言 |
| ---: | --- | --- | --- | --- | --- |
| 1 | 首屏读压 | 开局手牌、HP、当前 MP、敌意图总伤害、End Turn 后果同屏可见。 | 先停 3-5 秒说出“本回合最大危险”和预计受伤。 | 玩家只看亮起的牌，不知道结束回合会掉多少 HP。 | `HandDealt` 存在；`gameFlow=PlayerTurn`；intent preview `>0`；`.status-strip`、End Turn 后果可见；无 console error。 |
| 2 | 0 费起链 | `debt_hook` 或等价 0 MP 起手显示开链身份，链路从空变为 `x1`。 | 先打 0 MP 起手牌，并说明“先开链”。 | 玩家只说“因为免费”，没读出链路开端。 | `CardPlayed.cardId=debt_hook`；`printedCost=0`；`effectMultiplier=1`；chain `playedCosts` 包含 `0`；HUD 有 `开链` / `x1`。 |
| 3 | 1 费承接 | 0 MP 后，1 MP 牌显示 `接x2` 或等价承接反馈，敌意图可能下降但未必归零。 | 打 `redline_cut` / `heartbeat_spark` 继续升序。 | 玩家觉得所有可点牌一样，不知道为什么 1 MP 比乱序更好。 | 第二张 `CardPlayed.effectMultiplier=2`；`chain.broken=false`；没有 `breakReason`；HUD 可见 `接x2`。 |
| 4 | 2 费授权段 | 2 MP 牌显示展开/授权，打出后出现 `授权+3`。 | 打 `row_cleave` / `clearance_order` 完成 `0 -> 1 -> 2`。 | 玩家以为 2 MP 自己就是大招，不知道授权是给 payoff 的临时窗口。 | 第三张 `CardPlayed.effectMultiplier=3`；出现 `AuthorizationGranted`；`tempAuthorizationMP=3`；HUD 有 `授权+3`。 |
| 5 | 坏手缺口 | 手牌缺 1 段或缺当前 MP，关键牌显示 `缺MP1`、`缺授权` 或等价缺口。 | 不直接 End Turn，先寻找 draw / Wild / 改路线。 | 玩家把灰按钮理解成 bug，或不知道缺的是哪种资源。 | 不可支付牌的 HUD token 为 `缺MPx` / `缺授权`；对应 `failedConditions` 是资源或授权，不是隐藏异常。 |
| 6 | 抽牌修补 | `pulse_draw` / `blood_tithe` 显示 `抽N仍-X`，打出后多出关键牌但敌意图仍在。 | 打抽牌牌找 2 MP 段或 payoff，并重新评估 End Turn 伤害。 | 玩家以为抽牌等于防御成功，忽略仍会受伤。 | draw 牌 `effectMultiplier>=2` 时 `HandDealt.cardIds.length>=2` 或包含关键牌；intent preview `before===after`；可见 `抽2仍-X` / `抽3仍-X`。 |
| 7 | MP1/MP2 Wild 修补 | `wild_mana_stitch` 或 `wild_gap_key` 在真实缺口上显示修补，修补成功后链不中断。 | 用 Wild 补缺的费用段，而不是乱序硬打。 | Wild 在错误条件下也显示成功，或修补后压力被错误清空。 | 符合 MP1/MP2 缺口时出现 `ChainRepaired` 和 `repairedCost`；修补牌不直接降低 intent；`energyGainCondition` 只在真实修补时生效。 |
| 8 | Wild MP3 延链 | `0 -> 1 -> 2` 后，`wild_gap_key` 显示 `延MP3x4` / `延链MP3`，不是普通修补。 | 支付牌面 1 MP 打出 `wild_gap_key`，把 effective cost 接到 MP3。 | 事件误记为 `ChainRepaired`，返 MP 错触发，或玩家看不出它和普通修补不同。 | `ChainExtended` 出现；`CardPlayed.printedCost=1`、`currentEnergyPaid=1`、`effectiveCost=3`、`effectMultiplier=4`、`chainExtended=true`；`ChainRepaired` 不出现。 |
| 9 | 延链后 payoff | 延链后 3 MP payoff 显示 `续燃x5`、`授权付` 或高倍率终结读数。 | 打 `severance_burst` / `red_ledger_burst` 清高意图。 | payoff 像系统突然播放演出，玩家不知道为何可打或为何变强。 | payoff `CardPlayed.effectMultiplier>=4`；`authorizationPaid>0`；出现 `PayoffTriggered`；HUD 有 `授权付` 和 `续燃x5` 或等价 token。 |
| 10 | 清场/减压反馈 | payoff 后，敌人 HP、死亡数、意图总伤害明显下降，End Turn 后果变轻。 | 玩家说出“这下清掉/压低了本回合伤害”。 | 动画或日志热闹，但意图变化不可读；玩家不确定自己做对什么。 | `PayoffResolved.preventedIntentDamage>0` 或敌意图 `before>after`；`EnemyKilled` 与 payoff trace 绑定；结束回合 HP 损失不包含已阻止意图。 |
| 11 | 奖励三选一 | 奖励面板出现三张牌，短 token 能读出修补、路线、终结等功能。 | 根据上一手问题选择：缺修补拿 Wild/draw，缺路线拿 bridge，缺爆点拿 payoff。 | 玩家只按最大数字或最亮按钮点，不知道奖励回应哪个问题。 | `.reward-panel` 可见；`.reward-card` 数量为 3；可见文本不含 raw token；选择后出现 `RewardChosen`，`cardId` 进入 run deck / drawPile。 |
| 12 | 奖励进入下一手 | 下一回合或下一次抽牌能看到刚选奖励参与手牌/牌库循环。 | 玩家指出“这是我刚选来补问题的牌”。 | 奖励像消失了，或被误读为局外永久成长。 | 下一手 `player.hand` / `drawPile` / snapshot run history 包含所选 `cardId`；HUD 显示最近奖励；文本不出现 `永久MP`、`最大MP+3` 等错误暗示。 |
| 13 | 断链失败 | 玩家故意或自然打出 `debt_hook -> row_cleave` 之类跳段路线，牌仍能出但倍率回 `x1`。 | 继续打错路线并承认“我断链了”，然后 End Turn 承担后果。 | 系统直接禁牌，或断链没有代价，或玩家不知道为什么掉血。 | 断链牌 `CardPlayed.effectMultiplier=1`；不出现 `AuthorizationGranted`；HUD 有 `断x1` / `会断链`；End Turn 预览伤害等于结算 HP 损失。 |
| 14 | 支援未命中 | `paper_shatter` 或抽牌支援没有找到 payoff，只照常抽牌并保留压力。 | 接受未命中，改为保命或结束回合。 | UI 假装找到终结，或玩家以为脚本坏了。 | miss 场景不出现 `PayoffTopdecked`；可出现 `PayoffTopdeckMissed` 或等价结果；不搜 discardPile；HUD 显示 `整备无牌` / `未见终结` 或至少不显示成功 token。 |
| 15 | UI 不超框 | 桌面、390、360 三档下，成功链、Wild 延链、奖励、失败日志都不挤出屏幕。 | 移动端可横向滚手牌，可纵向滚奖励面板，最后一张奖励可点。 | 文本截断掉核心动作，页面横向溢出，奖励底部被手牌 rail 挡住。 | 每视口 `consoleErrorCount=0`；`horizontalOverflowDetected=false`；`textOverflowCount=0`；关键 selector 在 viewport 内；`.reward-panel` 内部滚动后最后 `.reward-card` 可达。 |
| 16 | 浏览器关闭 | 自动验收结束后，玩家/观察者不再看到 QA 打开的页面、上下文、浏览器或 dev server 残留。 | 无玩家选择；脚本完成后自动 teardown。 | 游戏体验 pass 但页面、Chrome、server 或端口残留。 | metrics `cleanup.status=pass`；`pageClose.ok=true`；`contextClose.ok=true`；`browserClose.ok=true`；`serverStop.ok=true`；`residualCheck.pidAlive=false`；`residualCheck.portListening=false`。 |

## 4. 结果记录格式

建议每次复测输出一份 JSON 和一份人工摘要。JSON 用于自动比较，人工摘要只写玩家是否理解。

```json
{
  "script": "round-12-journey-playtest",
  "scope": "3-5-turn-redline-core-loop",
  "device": "desktop | mobile-390 | mobile-360",
  "roundsPlayed": 4,
  "playerSaidPressureBeforePlaying": true,
  "successChainObserved": true,
  "badHandRepairObserved": true,
  "wildMp3ExtensionObserved": true,
  "rewardRespondedToPreviousProblem": true,
  "failurePressurePreviewMatchedResolution": true,
  "uiOverflowPass": true,
  "browserCleanupPass": true,
  "observerVerdict": "像卡牌解局 | 像教程脚本 | 看不懂",
  "topFailureSignal": "玩家不知道 Wild MP3 延链和普通修补的区别",
  "shots": [
    { "id": 1, "status": "pass", "note": "玩家 4 秒内说出结束会掉 17" },
    { "id": 8, "status": "pass", "note": "看到延MP3x4 后选择 wild_gap_key" },
    { "id": 16, "status": "pass", "note": "cleanup.status=pass" }
  ]
}
```

## 5. 一票否决项

出现以下任一项，不应把本轮复测标记为通过：

- 没有失败镜头，只记录成功清场。
- `wild_gap_key` 的 MP3 延链被误算为普通 `ChainRepaired`。
- 玩家不知道修补后敌意图仍然存在。
- 奖励选择无法解释为回应上一手问题。
- End Turn 预览伤害与实际扣血不一致。
- 三视口任一出现页面横向溢出、关键 token 超框、raw debug token 泄漏。
- 浏览器、context、page、server 或端口残留，但报告仍写 `PASS`。

## 6. 最小通过标准

本复测脚本最小通过需要同时满足：

1. 镜头 1-4 证明成功链成立，并且玩家能口述压力与升序原因。
2. 镜头 5-7 至少一个坏手修补成立，并且修补不抹掉敌意图。
3. 镜头 8-10 证明 `wild_gap_key` MP3 延链与 payoff 爆点在 HUD 和事件层都可读。
4. 镜头 11-12 证明奖励回应上一手问题，并进入下一手或牌库循环。
5. 镜头 13 或 14 至少一个失败压力成立，且失败不是 UI 或规则迷惑。
6. 镜头 15 三视口全部无超框。
7. 镜头 16 浏览器 cleanup 全绿。

STATUS: DONE
