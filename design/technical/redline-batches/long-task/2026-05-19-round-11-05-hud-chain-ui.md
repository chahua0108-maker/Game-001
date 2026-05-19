# 2026-05-19 Round 11-05：HUD/UI 竞品相似度与防溢出审查

角色：第 11 轮专家 05，HUD/UI 竞品相似度与防溢出专家  
工作目录：`/Users/roc/Game-001`  
文件所有权：`design/technical/redline-batches/long-task/2026-05-19-round-11-05-hud-chain-ui.md`  
边界：只写本文档；不改源码、不提交、不打开浏览器。  
目标：如果 Redline 要更像 Vampire Crawlers 的快速升序连锁，HUD 应如何显示长 chain、Wild 修补到 3+、倍率、仍-X，同时不出现文字超框。

## 0. 结论

Redline 的 HUD 不应该用“完整规则句”去接近 Vampire Crawlers，而应该用“连续可扫的短 token”去接近它的快感：玩家一眼看到下一费用、当前倍率、是否能用 Wild 修到 3+、出牌后仍会吃多少伤害，然后连续点牌。

推荐 HUD 主线是：

```text
CHAIN 0>1>2>W3 · x4 · 下张3
Wild: 修3+ · 授权付
压力: 仍-12 / 17->0
结果: 整备：顶终结 / 修补MP3 / 终结x4
```

关键裁决：

1. 长 chain 只在状态条和 director 用压缩轨迹显示，禁止把完整 `0 -> 1 -> 2 -> Wild as 3 -> payoff` 写进卡牌按钮。
2. Wild 修补到 3+ 显示为 `修3+`、`补3`、`W3`、`修补MP3`，不要写“按当前期望费用接链到 3 费以上”。
3. 倍率显示用 `x2/x3/x4`，优先跟在 chain 后或卡牌结果后，不写“当前连锁倍率为四倍”。
4. `仍-X` 必须保留在卡牌按钮和 End Turn 附近，因为这是高速出牌时的风险读数；不要被 reward、debug 或 director 说明挤掉。
5. 桌面可以用 combat feed 补叙事，390/360 移动端必须只靠 status/director/card rail/reward panel 读懂，不依赖日志和 debug。

## 1. 竞品相似度目标

Vampire Crawlers 式的“快”不是 UI 动画快，而是决策读数短：玩家能快速判断“这张是否接链、是否修补、是否把 payoff 推到爆点、是否还会挨打”。Redline 当前已有升序费用链、倍率、Wild、抽牌、授权和敌意图，下一步 HUD 应把它们组织成一条可扫路径：

```text
先看链：0>1>2>W3
再看收益：x4 / 终结
再看风险：仍-12
最后看行动：可点 / 缺MP / 授权付
```

相似度不来自照搬布局，而来自这些体验指标：

| 指标 | Redline HUD 目标 | 防溢出要求 |
| --- | --- | --- |
| 快速升序 | 玩家在 1 秒内看到 `0>1>2` 和 `下张3` | chain 轨迹最多 11 字符，超长折叠为 `0>1>2>...` |
| 修补爽点 | Wild 能被读成“把缺口补到 3+” | 卡面只写 `修3+` 或 `补3` |
| 倍率升级 | 每次接链都能看到 `x2/x3/x4` | 倍率永远独立 token，不和句子拼接 |
| 压力保留 | 即使连锁很爽，也看到 `仍-X` | 卡面压力行不得被 reward/debug 挤掉 |
| 终结爆点 | payoff 读成 `终结x4`、`清前排` | 不在按钮里写完整牌名加完整效果 |

## 2. HUD 信息分层

| 信息 | 主显示位 | 备用显示位 | 禁止位置 |
| --- | --- | --- | --- |
| 长 chain | status chain chip：`0>1>2>W3` | director：`下张3` / `链x4` | 卡牌按钮完整句 |
| Wild 修补到 3+ | 卡牌 chain preview：`修3+ x4` | combat feed：`修补MP3` | reward 规则长句 |
| 倍率 | status：`x4`；卡牌结果：`终结x4` | feed：`出牌 Burst · x4` | debug raw token |
| `仍-X` | 卡牌 pressure：`抽3仍-12`；deal panel：`结束-12` | director：`回合损12` | reward 卡正文 |
| 授权支付 | 卡牌 cost 状态：`授权付` | status：`授权+3` | `需MP/终局授权` 这类 slash 长词 |
| 整备结果 | director：`下抽终结`；feed：`整备：顶终结` | reward 面板短摘要 | 手牌回写长结果 |
| raw token | debug 面板，默认不作为玩家读数 | QA trace | status/card/director/feed |

## 3. 推荐短 Token

| 场景 | 推荐 token | 最大长度 | 不推荐 |
| --- | --- | ---: | --- |
| chain 轨迹 | `0>1>2>W3` | 9-11 | `0 -> 1 -> 2 -> Wild as 3` |
| chain 超长 | `0>1>2>...` | 10 | `0>1>2>3>4>5>6` 常驻 |
| 下一费用 | `下张3` | 3 中文 | `下一张期望费用为3` |
| Wild 修补 | `修3+` / `补3` | 2-3 中文 | `修补费用缺口到3费以上` |
| 倍率 | `x4` | 2 | `四倍连锁倍率` |
| payoff | `终结x4` | 4 中文 | `Severance Burst 以四倍倍率清场` |
| 压力 | `仍-12` / `17->0` | 4-5 | `敌人意图仍然造成12点伤害` |
| 授权 | `授权付` / `授权+3` | 3-4 | `终局授权支付` |
| 整备命中 | `顶终结` | 3 | `已将终结牌置于抽牌堆顶部` |
| 整备失败 | `整备无牌` | 4 | `没有找到任何可重排的目标牌` |
| debug 泄漏替换 | `整备命中` | 4 | `CardTopdecked` / `DeckSearchMissed` |

## 4. UI 镜头矩阵

以下 12 个镜头是第 11 轮 HUD 目标态，不要求本轮实现，但应作为后续 QA 和设计验收的镜头清单。

| # | 镜头 | 视口 | 必须看到 | 防溢出断言 |
| ---: | --- | --- | --- | --- |
| 1 | 桌面长 chain 总览 | 1366x768 | status 显示 `CHAIN 0>1>2>W3 · x4`，director 显示 `下张3` / `回合损12` | status chip 不超过一行；页面无横向滚动 |
| 2 | 桌面 Wild 修补到 3+ | 1366x768 | `Wild Gap Key` 卡面显示 `修3+ x4`、支付行 `MP1`、压力 `仍-12` | 卡牌按钮内 `strong/meta/chain/pressure/cost` 均无横向裁切 |
| 3 | 桌面 payoff 倍率 | 1366x768 | payoff 卡显示 `终结x4` 或 `授权付 · x4`，director 显示 `清前排` | 不出现“终局授权支付造成四倍...”长句 |
| 4 | 桌面 combat feed | 1366x768 | 日志按顺序显示 `出牌 0 · x1`、`出牌 1 · x2`、`修补MP3`、`终结x4` | `.combat-feed li` 单行 ellipsis 不吞掉关键 token；每行主 token 在前 8 字内 |
| 5 | 桌面 director | 1366x768 | 四格为 `链x4`、`下张3`、`仍-12`、`终结` | `strong/em` 单行；不得显示完整英文牌名 |
| 6 | 桌面 debug raw token | 1366x768 | debug 可折叠显示 raw token；玩家区不显示 `ChainRepaired`、`PayoffTopdecked`、`drawPile` | raw token 只允许在 debug selector 内出现 |
| 7 | 390 移动主 HUD | 390x844 | 顶部仅保留 HP/MP/CHAIN/INTENT，chain 为 `0>1>2>W3` 或 `0>1>2>...` | status 不换两行；feed/debug 隐藏；页面宽度不超过 viewport |
| 8 | 390 卡牌按钮 rail | 390x844 | 横向 rail 中卡牌显示 `修3+`、`x4`、`仍-12`、`授权付` | rail 可横向滚动，但 body 不横向滚动；按钮文字不超框 |
| 9 | 390 奖励面板 | 390x844 | reward card 显示 `Wild修补`、`补3`、`抽1整` 这类短摘要 | 面板内部滚动；`em` 两行内先出现动作和数值 |
| 10 | 360 小屏主 HUD | 360x640 | director 至少可读 `链x4`、`下张3`、`仍-12`；End Turn 显示 `结束-12` | director 不遮挡手牌 rail；End Turn 文本不被挤出按钮 |
| 11 | 360 失败反馈 | 360x640 | 断链或缺费时显示 `断x1`、`缺MP1`、`仍-17`，不弹长解释 | 错误反馈不覆盖下一张卡；无 toast 横向撑宽 |
| 12 | 360 短 token 回归 | 360x640 | 同屏出现最长组合：`Severance Burst`、`修3+ x4`、`授权付`、`抽3仍-17` | 最长卡名可 ellipsis，但机制 token 必须完整可见 |

## 5. 桌面布局建议

桌面可以保留三层读数：

1. 顶部 status：`HP / MP / CHAIN / INTENT / AUTH`，只放短 token。
2. 中部 director：把“下一步”和“后果”做成四格，不承担完整规则。
3. 右侧 combat feed / debug：feed 讲玩家可读历史，debug 放 raw token。

桌面最像 Vampire Crawlers 的镜头不是“信息多”，而是“连锁升得快”：

```text
CHAIN 0>1>2>W3 · x4
Director: 下张3 / 链x4 / 仍-12 / 终结
Feed: 修补MP3 -> 终结x4 -> 清前排
```

桌面禁止事项：

- 不把 `Wild Gap Key repaired nextExpectedCost to 3 and granted payoff authorization` 放进 feed。
- 不让 director 显示 `Severance Burst x4 will hit all enemies`。
- 不在 status 新增第二行解释 chain。

## 6. 移动 390 / 360 布局建议

移动端只保留“能连续点牌”的读数。combat feed 和 debug 隐藏后，玩家必须从 status、director、卡牌 rail、deal panel 读懂局势。

390 推荐：

```text
HP 18 | MP 1 | 0>1>2>W3 | 仍-12
[director] 链x4 / 下张3 / 终结 / 回合损12
[rail] Wild Gap Key | 修3+ x4 | 仍-12 | 授权付
```

360 推荐：

```text
HP18 MP1 0>1>2>... 仍-12
链x4 下张3
卡牌：修3+ / x4 / 仍-12
结束-12
```

移动端必须牺牲的信息：

- 完整英文牌名可以被省略，但 `修3+`、`x4`、`仍-12`、`授权付` 不能被省略。
- feed 历史可以隐藏，但当前行动后果不能隐藏。
- debug raw token 必须隐藏，不能因为排查方便回到移动首屏。

## 7. 卡牌按钮合同

卡牌按钮是最高风险节点。它同时要承载费用、角色、chain、倍率、压力和支付状态，所以必须采用固定字段，不允许临时插长句。

推荐字段顺序：

```text
[卡名]                 Severance...
[费用/角色/目标]        MP3 · 终结 · 全场
[chain/倍率]            终结x4
[压力]                 17->0 或 仍-12
[支付状态]              授权付 / 缺MP1
```

Wild 修补牌：

```text
Wild Gap...
MP1 · 修补 · 前排
修3+ x4
仍-12
可出 / 缺MP1
```

抽牌整备牌：

```text
Paper...
MP2 · 整备 · 自身
抽3整
抽3仍-12
```

防溢出规则：

- 卡名允许 ellipsis。
- `修3+`、`x4`、`仍-X`、`授权付` 不允许被 ellipsis 吃掉。
- `card-effect` 在移动端如果隐藏，不能承载唯一关键信息。
- 任何按钮不得新增第 6 行；新增信息必须替换旧 token，而不是叠加。

## 8. Combat Feed 合同

Combat feed 是桌面叙事位，不是移动主读数。为了接近 Vampire Crawlers 的“连锁快速滚动”，日志应该像战斗节拍，而不是规则解释。

推荐 feed 序列：

```text
出牌 Debt · x1 · 仍-17
出牌 Cut · x2 · 12->7
修补MP3 · x4
整备：顶终结
终结x4 · 清前排
```

禁止 feed：

```text
Wild Gap Key 按当前 nextExpectedCost 修补到费用3并继续 chain multiplier x4
PayoffTopdecked: Severance Burst from drawPile
DeckSearchMissed: payoff target not found in candidateCardPool
```

feed QA 口径：

- 每条日志主语前置：`出牌` / `修补` / `整备` / `终结`。
- 结果 token 在前 10 个可见字符内。
- 英文完整牌名不是必须；短名优先。
- raw token 黑名单在 feed 中必须为 0。

## 9. Director 合同

Director 的职责是给下一步，不是复述日志。建议四格：

| 格子 | 正常态 | Wild 修补态 | payoff 态 | 失败态 |
| --- | --- | --- | --- | --- |
| 链 | `链x3` | `链x4` | `终结x4` | `断x1` |
| 下张 | `下张2` | `下张3` | `授权付` | `重开0` |
| 压力 | `仍-12` | `仍-12` | `17->0` | `仍-17` |
| 建议 | `接2` | `修3+` | `打终结` | `结束-17` |

Director 不显示：

- 完整卡牌规则。
- `ChainRepaired`、`CardTopdecked`、`PayoffTopdecked` 等内部事件。
- 超过 6 个中文字的 strong 文案。

## 10. 奖励面板合同

奖励面板负责解释“下一手会更像 Vampire Crawlers 的长链”，但不能变成长规则卡。

推荐三类奖励文案：

| 奖励类型 | 标题 | 摘要 | 规则正文 |
| --- | --- | --- | --- |
| Wild 修补 | `Wild修补` | `补3 · 接链` | `按下张费用接链。支付按牌面。` |
| 抽牌整备 | `抽牌整备` | `抽1/3整` | `抽1；接链抽3。整备牌顶。` |
| 终结授权 | `终结授权` | `授权+3` | `升序到2后，终结可授权付。` |

奖励面板防溢出：

- 手机单列，正文最多两行可读；超出靠面板内部滚动，不撑 body。
- 摘要行必须包含数值：`补3`、`抽3`、`授权+3`。
- 不写“这张牌可以在当前链路期望费用为 3 时修补费用缺口”。

## 11. 失败反馈

失败反馈要短、准、靠近行动，不做教程弹窗。

| 失败 | 卡牌按钮 | Director | Deal panel / feed |
| --- | --- | --- | --- |
| 缺 MP | `缺MP1` | `缺费` | `结束-12` |
| 缺授权 | `缺授权` | `未授权` | `先接链` |
| 断链 | `断x1` | `重开0` | `断链 · 仍-17` |
| Wild 不可修 | `不可修` | `链已断` | `修补失败` |
| 整备未中 | `抽3仍-12` | `无整备` | `整备无牌` |

失败态禁止长 toast。移动端尤其不能用横向 toast 覆盖 card rail；如果需要浮层，只能是短 token，并在 1 秒内消退。

## 12. Debug Raw Token 边界

debug 可以保留 raw token，但必须被明确隔离：

| raw token | 玩家可见替代 | 允许出现位置 |
| --- | --- | --- |
| `ChainRepaired` | `修补MP3` | debug trace |
| `PayoffTopdecked` | `整备：顶终结` | debug trace |
| `DeckSearchMissed` | `整备无牌` | debug trace |
| `drawPile` | `牌顶` | debug trace |
| `candidateCardPool` | `候选牌` | debug trace |
| `nextExpectedCost` | `下张3` | debug trace |
| `effectMultiplier` | `x4` | debug trace |

QA 黑名单应扫描玩家可见区域：status、director、card button、combat feed、reward panel、deal panel。debug 面板如果默认折叠，raw token 可存在；如果默认展开，则必须有明确 debug 标识，且移动端继续隐藏。

## 13. QA 断言

后续实现这套 HUD 时，至少需要以下断言：

1. 桌面 `1366x768`：页面级 `scrollWidth <= innerWidth + 1`。
2. 移动 `390x844`：body 无横向滚动；card rail 可横向滚动。
3. 移动 `360x640`：status、director、deal panel、card rail 不互相遮挡。
4. `.card-button strong` 可 ellipsis，但 `.chain-preview` 中 `修3+` / `x4` 不可被裁切。
5. `.card-intent-preview` 中 `仍-X` 或 `X->0` 必须完整可见。
6. `.authorization-cost` 中 `授权付` 必须完整可见。
7. `.combat-feed li` 每行主 token 在前 10 个可见字符内；raw token 黑名单为 0。
8. `.combat-director strong/em` 不显示完整英文长牌名。
9. `.reward-panel` 在 390/360 内部滚动，不造成页面横向滚动。
10. debug raw token 不出现在 status、director、card、feed、reward、deal panel。
11. 最长组合样本必须覆盖：`Severance Burst`、`Wild Mana Stitch`、`Wild Gap Key`、`Red Ledger Burst`、`抽3仍-17`、`修3+ x4`、`授权付`。
12. 失败态样本必须覆盖：`缺MP1`、`缺授权`、`断x1`、`修补失败`、`整备无牌`。

## 14. 最终建议

第 11 轮 HUD 方向应把“像 Vampire Crawlers”理解为“更快读懂并连续执行升序连锁”，不是把更多解释塞进界面。Redline 最应该强化的可见读数是：

```text
0>1>2>W3
x4
修3+
授权付
仍-12
终结x4
```

只要这六个 token 在桌面、390、360、卡牌按钮、director、combat feed、reward panel、失败反馈中都有明确落点，并且 raw token 被隔离，Redline 就能更接近快速升序连锁的竞品手感，同时维持“无文字超框”的发布底线。
