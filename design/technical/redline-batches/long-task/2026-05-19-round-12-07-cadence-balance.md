# 2026-05-19 第12轮专家07：数值/节奏平衡师

工作目录：`/Users/roc/Game-001`  
文件所有权：`design/technical/redline-batches/long-task/2026-05-19-round-12-07-cadence-balance.md`  
边界：只写本文档；不改源码、不提交、不回滚其他工作者修改。  
审查目标：当前卡牌费用、奖励、XP、敌人意图、Wild MP3 延链后 3-5 回合节奏。

## 0. 总裁决

当前 Redline 的 3-5 回合节奏已经有成立骨架：开局 4 手牌、3 MP、首排 5 个敌人共约 17 点回合伤害，玩家必须在高压下打出 `0 -> 1 -> 2`、拿到 3 点 payoff-only 授权，再用 3 MP 全场终结兑现。第 11 轮新增的 `wild_gap_key` MP3 延链让高光路线可以进一步变成 `0 -> 1 -> 2 -> Wild(effective MP3) -> payoff`，HUD 读作 `延MP3x4 / 续燃x5`。

主要风险不是“数值太低”，而是两类脚本化：

1. 如果把 Wild MP3 延链太早、太稳定地放进 3-5 回合，`x5` 全场终结会把默认 10/16/22 HP 敌群直接清掉，XP 与奖励会变成脚本奖励链。
2. 如果奖励始终按固定分支给 `修补 + 终结 + 路线`，玩家会学会“按固定答案走”，而不是根据敌人意图、坏手和奖励缺口做决策。

第 12 轮建议：**不要再扩 Wild，不要提高基础 Max MP，不要削掉 `0->1->2` 教学链。优先把数值调参集中在敌人血量/意图、XP 阈值、奖励出现顺序、x5 payoff 可达性和抽牌倍率上限。**

## 1. 当前数值基线

### 1.1 玩家与牌组

| 项 | 当前值 | 平衡判断 |
| --- | ---: | --- |
| 玩家 HP | 60 | 可调，但不优先。当前能承受 3 个无操作 End Turn 后进入濒死。 |
| 当前 MP / Max MP | 3 / 3 | 不要动。它是防止 Wild MP3 变成免费连击的核心护栏。 |
| 发牌数 | 4 | 不要直接升到 5。长链应靠抽牌、整备、奖励和修补，不靠起手塞满答案。 |
| 起始牌 | `debt_hook / heartbeat_spark / redline_cut / row_cleave` | 不要改掉 `0/1/1/2` 骨架；可微调两张 1 MP 的伤害差异。 |
| 初始奖励阈值 | XP 12 | 可调。它决定第一次奖励是否落在 3-5 回合。 |

起始牌费用与效果：

| 卡 | 费用 | 当前效果 | 角色 |
| --- | ---: | --- | --- |
| `debt_hook` | 0 | 单体 4 | 起链。 |
| `heartbeat_spark` | 1 | 单体 6 | 低伤害承接。 |
| `redline_cut` | 1 | 单体 9 | 高伤害承接。 |
| `row_cleave` | 2 | 前排 5 | 基础授权段。x3 时前排 15。 |

奖励与支援牌关键数值：

| 卡 | 费用 | 当前效果 | 调参态度 |
| --- | ---: | --- | --- |
| `blood_tithe` | 0 | 抽 1，开链 | 可调出现顺序；不要让它返 MP。 |
| `pulse_draw` | 1 | 抽 1，接链时按倍率抽 | 可调是否早于 Wild；不要让抽牌降低意图。 |
| `paper_shatter` | 2 | 抽 1，先从 drawPile 顶一张 payoff | 不要搜弃牌堆，不要变全牌库 tutor。 |
| `lantern_captain` | 2 | 抽 1，暂不启用 topdeck | 保持和 `paper_shatter` 分工，不要两张都做同样找 payoff。 |
| `clearance_order` | 2 | 前排 7 | 可作为更强 2 MP 段；不要当 3 MP 终结。 |
| `severance_burst` | 3 | 全场 16 | 可调 base damage 或 x5 cap；不要取消授权 payoff 身份。 |
| `red_ledger_burst` | 3 | 全场 12 | 可调为低伤害 payoff 分支。 |
| `wild_gap_key` | 1 | 单体 1；可修补/延 MP3 | 不要改 printed cost 1；不要让授权支付它。 |
| `wild_mana_stitch` | 0 | 抽 1；真实修补才当前 MP+1 | 不要让它延 MP3。 |

### 1.2 敌人、意图与 XP

敌人循环为 3 种：

| 敌人 | HP | 伤害/意图 | XP |
| --- | ---: | ---: | ---: |
| `debt_wisp` | 10 | 2 | 1 |
| `redline_brute` | 22 | 5 | 2 |
| `pulse_collector` | 16 | 3 | 2 |

初始首排 5 个敌人按序约为：

```text
Debt Wisp(2 dmg, 1 XP)
Redline Brute(5 dmg, 2 XP)
Pulse Collector(3 dmg, 2 XP)
Debt Wisp(2 dmg, 1 XP)
Redline Brute(5 dmg, 2 XP)
```

首排总意图为 17。玩家完全不行动时，HP 大致是：

```text
回合1后 43
回合2后 26
回合3后 9
回合4后死亡或进入失败
```

这条压力线是好的，不要把首排意图降到没有惩罚。要调也应在 15-19 之间微调，而不是把 End Turn 变成无害按钮。

XP 节奏：

- 第一次奖励阈值是 12。
- 初始首排全清给 8 XP。
- 默认 15 敌全清约给 25 XP。
- 普通 `0->1->2 row_cleave` 不一定全清首排，常见是杀 2-3 个，约 3-5 XP。
- `x4 / x5` 全场 payoff 会瞬间跨过首奖阈值，甚至压缩后续节点节奏。

## 2. Wild MP3 延链后的真实节奏

第 11 轮后的真实合同是：

```text
0 -> 1 -> 2
= x3，发放 tempAuthorizationMP +3，只能支付 3 MP payoff

0 -> 1 -> 2 -> wild_gap_key
= wild_gap_key printed MP1 / effective MP3 / x4
= ChainExtended，不是 ChainRepaired，不返 MP，不追加授权

0 -> 1 -> 2 -> wild_gap_key -> 3 MP payoff
= payoff 可读作续燃 x5
```

关键平衡事实：**基础 3 MP 回合中，正常 `0+1+2` 已经花完当前 MP，`wild_gap_key` 还需要 printed MP1，所以自然状态下不能无脑接出 MP3 延链。** 这非常重要，必须保留。

Wild MP3 延链真正可出现的情况应是高光局：

- 玩家本回合通过 `wild_mana_stitch` 真实修补获得当前 MP+1。
- 或本次 run 有受控的 Max MP +1，但当前 `runModifiers` 仍是 preview-only，不应默认进入 runtime。
- 或后续有明确代价的资源牌、降费牌、保留牌。

因此，`x5` 不应是 3-5 回合稳定样片；它应该是 3-5 回合里“看得到可能性，但需要抽牌/资源/奖励协同”的高光镜头。

## 3. 节奏镜头

| # | 镜头 | 当前节奏判断 | 可调数值 | 不要动 | 防脚本/防无脑点 |
| --- | --- | --- | --- | --- | --- |
| 1 | 无操作承压：玩家连续 End Turn。 | 17 意图让玩家 3 回合后只剩约 9 HP，压力够强。 | 首排总意图 15-19；玩家 HP 55-65。 | 不要让 End Turn 低于 12 伤害。 | 保留“我必须出牌”的压力，防止玩家等系统发答案。 |
| 2 | 开局 `0->1->2`：`debt_hook -> redline_cut -> row_cleave`。 | 花完 3 MP，倍率到 x3，拿授权，但手里没有 payoff 时只是铺垫。 | `debt_hook` 3-5；`redline_cut` 8-10；`row_cleave` 4-6。 | 不要改掉 0/1/2 费用结构。 | 起手必须表达路线，不要一手直接给完整爆点。 |
| 3 | 同一手改打 `0->2`。 | 仍能出牌，但倍率回 x1、无授权，玩家能感到断链代价。 | 断链日志/短 token 强度。 | 不要禁止错误出牌。 | 让错误可发生，避免玩家只按亮按钮走教程。 |
| 4 | `0 -> wild_mana_stitch -> 2`。 | Stitch 修补 MP1，x2 抽 2 并返当前 MP+1，能救坏手。 | Stitch 抽牌是否倍率封顶；返 MP 每回合次数。 | 不要让 Stitch 修 MP3。 | 只救 1/2 缺口，不允许变成长链引擎。 |
| 5 | `pulse_draw / paper_shatter` 在 x2/x3 抽牌。 | 抽牌给机会，但 `抽N仍-X` 保留敌意图。 | 抽牌倍率上限；`paper_shatter` 进入奖励的时间。 | 不要让抽牌直接减意图。 | 抽牌是找解，不是自动解局。 |
| 6 | 第一次奖励触发。 | XP 12 让优秀玩家约 3-4 回合看到奖励；x4 payoff 会瞬间跨过。 | 阈值 12->14/15；敌人 XP；首奖是否延后 1 回合。 | 不要把奖励移出 3-5 回合窗口太远。 | 奖励要回应缺口，但不能每次固定给完整答案。 |
| 7 | 默认首奖三选一：`blood_tithe / severance_burst / spark_tap`。 | 修补、payoff、路线分支清晰，但 deterministic。 | reward pool 顺序；分支内 seeded shuffle；首奖 payoff 权重。 | 不要破坏三分支合同。 | 避免玩家固定背板：“首奖必拿 Severance”。 |
| 8 | `paper_shatter` 顶终结。 | 只搜 drawPile 第一张 payoff，窄而可控。 | `paper_shatter` 是否首奖可见；抽牌数是否随倍率上限。 | 不要搜 discard/deck 全区，不要评分挑最优 payoff。 | 保留牌堆位置风险，防止 tutor 化。 |
| 9 | 普通 x4 payoff：`0->1->2->severance_burst`。 | `severance_burst` x4 = 全场 64，默认敌群会大面积清掉。 | Severance base 16->14/15；payoff multiplier cap；后排敌 HP。 | 不要取消授权支付和 x4 高光。 | x4 应爽，但不能每次都接奖励连锁必胜。 |
| 10 | Wild MP3 高光：`0->1->2->wild_gap_key->payoff`。 | 需要额外当前 MP；若成立，x5 Severance = 80，全场过量。 | x5 是否封顶为 x4；Wild MP3 每回合次数；Max MP+1 稀有度。 | 不要让授权支付 `wild_gap_key`；不要让 printed cost 变 0。 | 让 x5 是高光，不是常规路线。 |
| 11 | 默认 3 MP 下尝试 Wild MP3。 | 0+1+2 后当前 MP 为 0，`wild_gap_key` 不能出。这个失败是好护栏。 | UI 缺 MP 文案。 | 不要为了演示把 Max MP 默认改 4。 | 玩家必须先获得资源机会，不能凭授权打所有牌。 |
| 12 | Broken 后打 Wild。 | `0->2->wild_gap_key` 不修补、不延链，仍是断链。 | 断链惩罚反馈。 | 不要让 broken chain 被 Wild 救回。 | 防止 Wild 变成“打错也没关系”。 |
| 13 | 终结在手但缺授权。 | 3 MP payoff 可能有当前 MP也能打，但 unordered 是 x1/低价值；无授权时不应读成高光。 | payoff 未授权伤害；按钮 token。 | 不要把 payoff 直接禁成完全不可玩，除非缺 MP。 | 保留诱惑和代价，防止只有唯一正确按钮。 |
| 14 | 奖励进入下一手。 | 当前选牌会加入 deck 并置入下一手循环，反馈很快。 | 是否直接入手；是否只入 drawPile 顶。 | 不要让奖励变局外永久成长。 | 快反馈可以保留，但首奖答案不应固定。 |

## 4. 可调数值清单

优先调这些：

| 项 | 当前 | 建议调参方向 | 触发条件 |
| --- | ---: | --- | --- |
| 初始首排总意图 | 17 | 15-19 内微调。 | 玩家 3 回合内过早死或完全无压力。 |
| XP 首奖阈值 | 12 | 可试 14 或 15。 | 首奖稳定早于第 3 回合，或 x4 payoff 后奖励链过快。 |
| `severance_burst.damage` | 16 | 可试 14-15，或只 cap x5。 | x4/x5 默认全场清屏率过高。 |
| `red_ledger_burst.damage` | 12 | 可试 10-12，保持低伤 payoff 定位。 | 两张 payoff 体验差异不明显。 |
| `row_cleave.damage` | 5 | 可试 4-6。 | 起手路线杀敌过少或过多。 |
| `clearance_order.damage` | 7 | 可试 6-8。 | 奖励 2 MP 段与基础段差距太小/太大。 |
| 抽牌倍率 | 当前按 multiplier 线性放大 | 可对 self draw 设置实际抽牌上限 3。 | `pulse_draw / paper_shatter` 连续找解过稳。 |
| reward pool 顺序 | 固定 | 可做分支内 seeded shuffle。 | 玩家开始背固定首奖。 |
| Wild MP3 出现率 | 依赖 `wild_gap_key` 和额外当前 MP | 控制在高光低频。 | x5 在 3-5 回合出现率超过约 20%-30%。 |

## 5. 不要动清单

这些是当前体验成立的骨架，不应为短期数值问题先改：

- 不要把基础 `maxEnergy` 从 3 改到 4。
- 不要把基础发牌数从 4 改到 5。
- 不要让 `tempAuthorizationMP` 支付非 payoff 牌。
- 不要让 `wild_gap_key` 的 printed cost 从 1 变 0。
- 不要让 `wild_mana_stitch` 修补或延长 MP3。
- 不要把 `ChainExtended` 合并回 `ChainRepaired`。
- 不要让 MP3 延链再次发放授权。
- 不要把 `paper_shatter` 扩成 discard/deck 全区搜索。
- 不要把敌人意图从出牌决策区移走或弱化成装饰。
- 不要把所有失败路线都自动救回；缺 MP、缺授权、抽牌未命中、断链必须存在。

## 6. 3-5 回合推荐节奏

理想 3-5 回合不应是同一条成功脚本，而应是四种镜头轮换：

```text
回合 1：读 17 意图，打 0->1->2，杀一部分前排，剩余意图仍可能造成伤害。
回合 2：出现坏手或缺 payoff，用 draw / repair 找路线，但压力不消失。
回合 3：XP 接近或触发首奖，奖励回应上一手缺口，而不是直接宣布胜利。
回合 4：玩家通过授权 payoff 或整备顶终结打出一次爆点。
回合 5：安排一次反例：断链、抽牌未命中、授权有但无终结、终结在手但未铺垫。
```

Wild MP3 延链在这个窗口里的位置应该是：

- P0 体验：玩家看到 `wild_gap_key` 是强修补/延链潜力，但不是每局必打。
- 高光体验：当玩家通过 Stitch 返 MP、奖励、或未来受控 run modifier 获得额外当前 MP 时，打出 `延MP3x4`。
- 反例体验：没有额外当前 MP 时，`wild_gap_key` 显示缺 MP，证明授权不能支付一切。

## 7. 避免脚本必胜与无脑连击

### 7.1 防脚本必胜

脚本必胜的危险组合是：

```text
固定起手 0/1/2
+ 固定首奖 payoff
+ 固定抽/顶 payoff
+ 默认 Max MP4 或免费 Wild
+ x5 全场终结
= 玩家背流程，不再看敌人意图和手牌质量
```

护栏：

- 首奖可以有 payoff，但不要每次都让 payoff 是唯一显然最优。
- Wild MP3 不要在默认 3 MP 下无成本成立。
- x5 payoff 出现率应低于普通 x4 payoff；早期目标不超过 20%-30%。
- 首次奖励后的下一手要有强反馈，但不要同时给“路线、资源、终结、顶牌”全套答案。
- 至少保留一个失败镜头进入复测：断链、缺 MP、缺授权、抽牌未命中四选一。

### 7.2 防无脑连击

无脑连击的危险不是倍率数字，而是玩家不需要判断。要让每次长链都问一个问题：

- 我现在是在杀最高意图敌人，还是贪倍率？
- 我用抽牌找终结，还是先减少本回合伤害？
- 我现在用 `wild_gap_key` 延 MP3，会不会花掉最后 1 点当前 MP？
- 我拿 `severance_burst`，还是先拿 `blood_tithe / pulse_draw` 解决坏手？
- 我完成授权后，手里真的有 payoff 吗？

如果 UI 或奖励让这些问题消失，就是脚本化信号。

## 8. 下一轮验收指标

建议第 12 轮后续主线程或 QA 记录这些数值：

| 指标 | 建议目标 |
| --- | ---: |
| 无操作死亡时间 | 第 4 个 End Turn 左右。 |
| 普通 `0->1->2` 后剩余意图 | 仍有 0-10 点波动，不应每次归零。 |
| 首奖出现回合 | 通常第 3-4 回合。 |
| 普通 x4 payoff 出现率 | 3-5 回合内可见，但不每局固定。 |
| Wild MP3 x5 出现率 | 早期不高于 20%-30%。 |
| 抽牌未命中可理解率 | 玩家能说出“我赌了但没找到”。 |
| 断链后被 Wild 救回率 | 0%。 |
| `wild_mana_stitch` MP3 延链率 | 0%。 |
| 首奖固定背板率 | 越低越好；如果玩家总说“固定拿 Severance”，需要调 reward。 |

## 9. 结论

当前最值得保留的是：3 MP 基础经济、4 手牌、17 意图压力、`0->1->2` 授权、payoff-only 授权、`wild_gap_key` printed/effective 分离、`wild_mana_stitch` 不延 MP3、`paper_shatter` 窄 topdeck。

当前最值得调的是：XP 首奖节奏、payoff 过量伤害、奖励顺序的 deterministic 感、抽牌倍率上限、Wild MP3 的可达频率。

一句话裁决：**让 x4 成为 3-5 回合可期待的爆点，让 x5 成为玩家用资源和修补拼出来的高光；不要让 x5 变成默认教程脚本。**

STATUS: DONE
