# 2026-05-19 第 13 轮专家 10：最终综合裁决模板

角色：第 13 轮专家 10，制作人最终综合裁决  
工作目录：`/Users/roc/Game-001`  
文件所有权：本文只写 `design/technical/redline-batches/long-task/2026-05-19-round-13-10-producer-synthesis.md`  
输出边界：只写文档；不改源码、不改测试、不提交 git、不回滚或覆盖其他工作者修改。  
裁决依据：第 12 轮汇总与第 12 轮专家 10 制作人裁决。  
裁决说明：本文不等待第 13 轮源码结果；因此它是最终综合裁决模板和验收口径，不是源码已通过报告。

## 0. 总裁决

第 13 轮主题锁定为：

```text
牌区生命周期 v1。
```

第 13 轮不是继续扩 Wild、不是做宝石、不是做局外成长、不是做新卡堆量，而是把第 12 轮已经证明的 3-5 回合相似度脚本下面的牌区物理规则补成可验收底座。

本轮最终裁决采用 100 分制：

```text
95 分及以上，并且所有硬停止条件通过，才允许停止本轮继续迭代。
未看到源码验收结果前，默认裁决为：不停止，等待源码证据回填。
```

第 13 轮的制作目标不是“生命周期系统越完整越好”，而是：

```text
玩家能在 3-5 回合里看到消耗、保留、状态污染、洗回和牌区移动的真实后果；
同时第 11-12 轮已经成立的 Wild MP3 延链、payoff 授权、paper topdeck、奖励进入下一手和移动端短 token 不退化。
```

## 1. 100 分制评分表

源码 worker 回填前，本文不填最终分。评分必须基于测试、浏览器 QA、报告 JSON 或等价证据，不允许只凭代码阅读打满分。

| 评分项 | 分值 | 通过口径 |
| --- | ---: | --- |
| 生命周期 v1 核心机制 | 30 | `CardMoved` 或等价事件、`exhaustPile`、`retainedCards`、物理状态/污染牌、洗回/抽牌事件全部可被测试观察。 |
| 第 11-12 轮合同回归 | 20 | Wild MP3 延链、payoff-only 授权、`paper_shatter` drawPile 顶终结、奖励进入后续循环、失败 play 不半提交全部不退化。 |
| 3-5 回合相似度保留 | 15 | 仍能覆盖成功升序、坏手修补、奖励响应、爆发清场、失败压力，且生命周期变化进入玩家镜头。 |
| HUD 与移动端可读性 | 10 | 360/390/desktop 无横向溢出、无关键文本超框；新增 token 只用短词：`消耗`、`保留`、`状态`、`洗回N`。 |
| QA 与自动化证据 | 15 | lifecycle sim、相似度 journey、`npm run check`、`qa:similarity`、`qa:ui` 或等价门槛均通过并有输出证据。 |
| 范围纪律 | 5 | 不做宝石、遗物、完整 meta、完整 CardInstance 大迁移、大卡池扩张或竞品受保护表达复制。 |
| 文档与交接 | 5 | 记录最终分、失败项、下一轮分流和可复跑命令；不把未验收内容写成已完成。 |
| 合计 | 100 | 95 分才允许停止；低于 95 必须分流下一轮。 |

建议细分：

| 生命周期 v1 子项 | 分值 | 最低证据 |
| --- | ---: | --- |
| `CardMoved` / reason / zone 字段 | 6 | 至少含 `cardId/from/to/reason/tick or sequence`，能覆盖 play、draw、discard、reshuffle。 |
| 消耗牌 | 6 | 打出后进入 `exhaustPile`，不进入 `discardPile`，不参与洗回。 |
| 保留牌 | 6 | 回合末进入保留区，下回合先进手牌并占手牌上限；奖励选择不允许跨节点保留。 |
| 状态/污染牌 | 6 | 作为物理牌进入牌区、占手牌位，可打出或弃置，并按节点规则清理。 |
| 洗回/抽牌证据 | 6 | discard 回填 drawPile 有事件；抽牌能区分普通发牌、效果抽牌、奖励后发牌。 |

## 2. 95 分停止条件

只有同时满足以下条件，才允许第 13 轮停止：

| 条件 | 必须状态 |
| --- | --- |
| 总分 | `>= 95 / 100`。 |
| P0 blocker | 0 个。任何 runtime 合同退化、移动端溢出、测试不可复跑都算 P0。 |
| 生命周期 v1 | 消耗、保留、状态、洗回、牌区移动事件均有可复跑证据。 |
| 第 12 轮相似度 | `qa:similarity` 或等价 journey 仍证明 3-5 回合压力、Wild MP3 延链、payoff 续燃和失败反例。 |
| 第 11 轮 UI | `qa:ui` 或等价三视口验收仍无 console error、无横向溢出、无关键文本超框。 |
| 授权与链路 | `0 -> 1 -> 2` 授权、Wild MP3 延链、x5 payoff 续燃各自事件语义不混用。 |
| 牌区物理规则 | 消耗不洗回，保留不突破手牌上限，状态牌不是 debug-only，奖励牌仍进入当前 run 后续循环。 |
| 范围边界 | 不引入完整宝石、遗物、地图、局外成长、大规模卡实例迁移或大卡池。 |
| 表达边界 | 不复制竞品卡名、原文文案、美术、UI 构图或素材。 |
| 文档边界 | 最终报告必须说明实际得分、失败项和下一轮处理，而不是只写“通过”。 |

停止后的表述只能是：

```text
第 13 轮生命周期 v1 切片达到停止线，可以冻结为下一阶段玩家复测底座。
```

不能写成：

```text
已经完整复刻竞品。
已经完成完整卡牌 roguelike 生命周期。
已经完成局内强化、宝石、地图和局外成长。
```

## 3. 生命周期 v1 验收口径

第 13 轮最低验收对象：

| 对象 | 验收口径 | 失败判定 |
| --- | --- | --- |
| 牌区状态 | `PlayerState` 或等价状态能表达 `drawPile/hand/discardPile/exhaustPile/retainedCards`。 | 只能靠 UI 文案或 debug 备注表达消耗/保留，失败。 |
| 移动事件 | 所有关键移动能落 `CardMoved` 或等价事件，含 reason。 | QA 只能靠数组差异猜牌为什么移动，失败。 |
| 消耗 | 一张消耗牌打出后进入消耗区，后续洗回不出现。 | 消耗牌进入弃牌或被洗回，失败。 |
| 保留 | 一张保留牌回合末保留，下回合先进手并占手牌位。 | 保留牌额外扩手牌上限，或奖励界面后仍跨节点保留，失败。 |
| 状态污染 | 一张状态牌作为物理牌进入 draw/hand/discard 循环，并能被节点清理。 | 状态牌只存在于 debug 或只做 UI 标记，失败。 |
| 洗回 | discard 回填 drawPile 有事件，且不包含本应排除的消耗牌。 | 抽牌脚本无法判断是否洗回，失败。 |
| `paper_shatter` | 继续只搜 `drawPile` 第一张 payoff，不搜弃牌或全牌库。 | 被生命周期重构扩大成通用 tutor，失败。 |
| reward | 非终端奖励仍进入当前 run 并能影响下一手。 | 奖励变成局外永久成长，或不再进入后续循环，失败。 |
| restart | 当前 run 的生命周期区清空，不能吃隐式 meta。 | 重开 run 继承上局消耗/保留/污染或外部 meta，失败。 |
| HUD | 新机制只出短 token，不新增大解释面板。 | 移动端按钮塞长句、超框或横向滚动，失败。 |

第 13 轮允许的 v1 切片：

```text
CardMoved/reason + exhaustPile + retainedCards + 1 张状态污染牌 + 洗回/抽牌事件。
```

第 13 轮不允许的扩张：

```text
完整 CardInstanceId 迁移、同名多实例升级、宝石插槽、遗物、删牌、商店、地图、局外成长、完整诅咒生态、大批新卡。
```

## 4. 裁决镜头

| # | 裁决镜头 | 本轮裁决 | 必须验收的信号 |
| ---: | --- | --- | --- |
| 1 | 评分纪律 | 未看到源码证据前不得宣称停止。 | 报告里有 `score=__/100`、证据路径、失败项；空口满分无效。 |
| 2 | 牌区移动事实 | 生命周期 v1 的核心是移动事实，不是 UI 堆字。 | `CardMoved` 或等价事件能说明 `cardId/from/to/reason`。 |
| 3 | 普通出牌 | 默认牌仍从 hand 到 discard，链路照常结算。 | `play-default` 或等价 reason 可见，`CardPlayed` 语义不退化。 |
| 4 | 消耗牌 | 消耗只做一张也可以，但必须真实离开抽弃循环。 | 打出后进入 `exhaustPile`，后续 reshuffle 不出现。 |
| 5 | 保留牌 | 保留是跨回合手牌物理规则，不是免费多抽。 | 回合末保留，下回合先进手；手牌总量不突破上限。 |
| 6 | 奖励边界 | reward selected 是节点切换，不是普通 end turn。 | 奖励选择时手牌强制清理，保留牌不跨奖励界面。 |
| 7 | 状态污染 | 状态牌必须是物理牌，占抽牌和手牌位。 | 能进入 draw/hand/discard，未打出可洗回，节点结束可清理。 |
| 8 | 洗回事件 | 洗回必须可审计。 | discard 回填 drawPile 产生事件，列出 moved 或 reshuffled card ids。 |
| 9 | 失败 play 事务 | 验证失败不能先移动牌。 | 缺费、死目标、非手牌出牌不会扣 MP、不会丢牌、不会推进链。 |
| 10 | Wild MP3 延链 | 第 13 轮不能把 Wild 合同改乱。 | `wild_gap_key` 才能 MP3 延链；`wild_mana_stitch` 不修 MP3；`ChainExtended` 不等于 `ChainRepaired`。 |
| 11 | 授权支付 | 授权仍只服务 payoff。 | `0->1->2` 精确链发放授权；授权不支付 `wild_gap_key`，不跨回合。 |
| 12 | payoff 续燃 | x5 高光保留，但不是默认必胜脚本。 | Wild MP3 后紧随 3 MP payoff 可续燃；后续任意 3 MP 不能滥用该窗口。 |
| 13 | `paper_shatter` | 继续做窄整备，不扩成全区 tutor。 | 只搜 drawPile，miss 时正常抽牌，不搜 discard/deck。 |
| 14 | 3-5 回合承压 | 生命周期落地不能牺牲第 12 轮 journey。 | 仍能看到 HP 压力、坏手、奖励响应、爆发和失败反例。 |
| 15 | 移动端短 token | 新机制必须被读到，但不能用长文案解释。 | `消耗/保留/状态/洗回N` 等短 token 三视口不溢出。 |
| 16 | 范围纪律 | 本轮只补底座，不借机开大系统。 | 没有宝石、遗物、局外成长、完整地图、大卡池和竞品表达复制。 |

## 5. 验收命令模板

源码 worker 完成后，最低验收命令建议如下。本文不运行这些命令，只定义停止线。

```bash
cd /Users/roc/Game-001/prototype-web
node --check scripts/qa-similarity.mjs
node --check scripts/qa-ui.mjs
npm test -- --run src/tests/sim/redline-lifecycle-v1.test.ts src/tests/sim/redline-similarity-journey.test.ts src/tests/sim/redline-competitor-similarity.test.ts
npm run check
npm run qa:similarity
npm run qa:ui
```

如果第 13 轮新增独立生命周期浏览器脚本，必须额外验收：

```bash
cd /Users/roc/Game-001/prototype-web
node --check scripts/qa-lifecycle-v1.mjs
npm run qa:lifecycle
```

最低报告字段：

```json
{
  "round": 13,
  "score": "__/100",
  "stopAllowed": false,
  "lifecycleV1": {
    "cardMovedEvents": false,
    "exhaustDoesNotReshuffle": false,
    "retainOccupiesNextHandSlot": false,
    "statusCardsArePhysical": false,
    "reshuffleEventsObservable": false
  },
  "regression": {
    "wildMp3Extension": false,
    "payoffAuthorization": false,
    "paperTopdeckDrawPileOnly": false,
    "rewardNextHand": false,
    "mobileOverflowFree": false
  },
  "unsupportedClaims": [
    "not a full clone",
    "not a complete roguelike lifecycle",
    "no full gem/relic/meta layer"
  ]
}
```

## 6. 下一轮分流

第 14 轮不按“做了多少代码”分流，而按第 13 轮评分与硬门槛分流。

| 第 13 轮结果 | 第 14 轮分流 |
| --- | --- |
| `95-100` 且硬门槛全过 | 停止生命周期 v1 迭代，进入玩家复测/小修阶段；第 14 轮只允许复测反馈、文案短 token 和低风险 QA 加固。 |
| `90-94` | 不开新机制；第 14 轮只修缺的 5 分，通常是浏览器 QA、移动端 token、事件字段或单个生命周期边界。 |
| `80-89` | 分三路修：runtime 生命周期、相似度 journey 回归、HUD/QA 溢出；制作人只合并 P0，不收 P1 扩张。 |
| `70-79` | 收缩范围到 `CardMoved + exhaustPile + 第 12 轮回归`；保留、状态、洗回增强进入 backlog。 |
| `<70` | 停止新增；先恢复第 12 轮合同可复跑，再重新开生命周期最小切片。不得继续堆卡或开宝石/meta。 |
| 生命周期通过但相似度失败 | 第 14 轮优先 journey 修复：压力读法、奖励响应、失败反馈、爆发因果；不继续扩底座。 |
| 相似度通过但生命周期失败 | 第 14 轮只修生命周期 v1：消耗、保留、状态、洗回、事件原因；不新增玩家内容。 |
| UI 失败 | 第 14 轮只修移动端短 token 与布局，不改数值和机制。 |
| QA cleanup 失败 | 第 14 轮先修脚本资源释放、端口残留和报告路径，再谈机制通过。 |

建议第 14 轮 worker 分配：

| worker | 任务 |
| --- | --- |
| Runtime lifecycle | 修 `CardMoved/exhaust/retain/status/reshuffle` 的失败项。 |
| Contract regression | 专门守 Wild MP3、payoff 授权、paper topdeck、reward next-hand。 |
| Journey QA | 重跑 3-5 回合相似度，检查生命周期是否进入玩家镜头。 |
| Mobile HUD | 检查 360/390/desktop 的 token、按钮、日志和文本溢出。 |
| Producer synthesis | 只合并评分、硬门槛、下一轮分流，不代替源码证据。 |

## 7. 裁决记录模板

源码结果出来后，第 13 轮最终综合应回填：

```text
最终分：__/100
是否达到 95 分停止条件：是 / 否
P0 blocker 数：__
P1 风险数：__
本轮实际停止结论：停止 / 不停止
下一轮分流：__
证据路径：
- lifecycle sim: __
- qa:similarity: __
- qa:ui: __
- npm run check: __
```

若最终得分低于 95，必须写清楚：

```text
不停止原因：
1. __
2. __
3. __
```

若最终得分达到 95 以上，也必须写清楚：

```text
仍未覆盖的范围：
1. 完整宝石/遗物/局外成长未做。
2. 完整 CardInstance 升级/复制/单张变体未做。
3. 完整玩家长期留存与商业化包装未做。
```

## 8. 给执行者的一句话

第 13 轮的胜负不在“生命周期 v1 名字有没有写进代码”，而在玩家和 QA 能不能看到牌真的从一个区移动到另一个区，并且这些移动没有破坏第 12 轮已经成立的 3-5 回合竞品相似度。

本轮默认裁决：

```text
等待源码证据回填前，不允许停止。
95 分及以上才停止。
低于 95，按失败项分流下一轮。
```

STATUS: TEMPLATE_READY
