# 2026-05-18 第 8 轮专家 10：Producer Synthesis

角色：第 8 轮专家 10，Producer Synthesis  
工作目录：`/Users/roc/Game-001`  
输出边界：本文只新增 Markdown；不改源码、不提交 git、不回滚或覆盖其他工作者改动。  
主题：综合第 7 轮结论和第 8 轮目标，裁决本轮是否落 `paper_shatter` 极窄置顶样片，并给第 9 轮验收交接。

## 0. 读取基线

第 7 轮的共同结论已经很清楚：

- 第 7 轮不做完整 `reorder / SearchAndTopdeck`，只完成 HUD 短 token 压缩。
- 第 7 轮已把真实整备的下一步收敛到“极窄样片”，不是牌库浏览器、手动重排或通用 tutor。
- 数值侧明确警告：不能同时打开 `paper_shatter` 和 `lantern_captain`，不能搜弃牌堆，不能让 2 MP self draw 变成稳定清压按钮。
- 技术侧已经确认牌顶语义存在：`drawPile[0]` 是下一抽，`AddCardToDeck` 已用 `unshift` 表达置顶。
- 测试侧要求：若实现真实 reorder，必须从旧的“没有 reorder runtime”断言改成明确事件证据，不能只靠最终手牌猜测。

第 8 轮控制计划名义上是“平衡与数值”。所以本轮不是为了证明系统能扩展，而是为了回答一个制作问题：

```text
极窄整备是否能增强“完成授权后找终结”的爽点，同时不吃掉敌人压力。
```

## 1. 制作人裁决

第 8 轮可以做 `paper_shatter` 极窄置顶样片。

但这不是完整 reorder，不是 `lantern_captain` 同步上线，也不是搜索弃牌堆。它只允许作为一个受控的平衡样片进入实现：

```text
paper_shatter:
  仅在本次出牌完成或延续 0 -> 1 -> 2 授权链时触发
  仅搜索 drawPile
  仅找第一张 payoff
  在 DrawCards 前置顶
  然后继续按现有抽牌倍率抽牌
```

| 候选项 | 裁决 | 理由 |
| --- | --- | --- |
| 完整 SearchAndTopdeck | 不做 | 搜弃牌堆、通用偏好、两张整备牌和手动 UI 会同时放大数值、事件合同和移动端风险。 |
| `paper_shatter` drawPile-only payoff topdeck | 本轮可做 | 它正好验证“整备影响下一抽”，且能被 miss / hit / 抽牌顺序测试锁住。 |
| `lantern_captain` route topdeck | 不做 | 它的定位是下一手路线铺垫，不适合作为第一个平衡样片；同批启用会让两张 2 MP self draw 功能混淆。 |
| discardPile fallback | 不做 | 会显著降低错过窗口的代价，把授权后没终结的失败压得太薄。 |
| 手动重排 UI / 看 K 取 N | 不做 | 第 8 轮目标是平衡样片，不是新交互系统。 |

一句话裁决：

```text
第 8 轮做 paper_shatter 单卡、单区、单目标的自动置顶样片；
其它所有 reorder 能力都留到第 9 轮验收后再判断。
```

## 2. 范围锁定

### 2.1 本轮允许

- 只给 `paper_shatter` 增加真实 pre-draw search 行为。
- 只搜索 `drawPile`，按当前数组顺序找第一张 payoff。
- payoff 判定只用稳定字段：`cardType === 'payoff'` 或 `rewardBranches` 包含 `payoff`。
- 搜索命中时发可观测事件，例如 `CardTopdecked` 或 `DrawPileReordered`。
- 搜索失败时发 `DeckSearchMissed`，并继续原本 `DrawCards`。
- `DrawCards.count` 仍等于 `drawCards * effectMultiplier`。
- 刚打出的 `paper_shatter` 必须被排除，不能同次检索或抽回。
- HUD 可新增短日志，但卡牌按钮仍保持 `整备/找牌` 这类短 token。

### 2.2 本轮不允许

- 不启用 `lantern_captain` 的真实 route search。
- 不搜 `discardPile`、`hand`、`deck`、reward pool 或 starting hand。
- 不新增 `confirm-reorder`、pending state、拖拽、牌库浏览器或候选选择 UI。
- 不改起始牌组、奖励池顺序、奖励三分支、XP、run/meta、敌人意图或 MP 上限。
- 不改变 Wild 修补、临时授权、payoff 支付、奖励进入下一手的既有合同。
- 不把 miss 当失败条件；miss 后仍正常抽牌。
- 不把置顶实现成直接加进手牌、复制牌、随机洗牌或全 deck 生成。

## 3. 最小验收清单

### 3.1 运行时验收

最小通过线：

- 打出 `paper_shatter` 前，`drawPile` 中存在 payoff 且不在顶部。
- 打出后，同 trace 先出现置顶事件，再出现 `DrawCards / HandDealt`。
- 被命中的 payoff 成为 `HandDealt.cardIds[0]`。
- 原 `drawPile` 不复制 payoff，不丢失非目标牌的相对顺序。
- 如果 payoff 已在 `drawPile[0]`，仍发命中事件，但不能复制一张。
- 如果 `drawPile` 没有 payoff，必须发 `DeckSearchMissed`，并按原顺序抽牌。
- `sourceCardId === 'paper_shatter'` 永远不能被同次 search 抽回。

### 3.2 平衡验收

本轮不是只看测试绿灯，还要看压力是否仍成立：

- `paper_shatter` 只在完成或延续 `0 -> 1 -> 2` 时提供终结置顶价值。
- self draw 本身仍不降敌意图；只有后续真正打出 payoff 才能清压。
- miss 路径必须可见，不能让玩家以为整备永远成功。
- 早期授权 payoff 率目标不应超过约 75%-78%。
- 至少保留一条“完成授权但没有 payoff 命中，敌意图仍压着玩家”的回归切片。

### 3.3 回归验收

实现者至少需要覆盖：

- 新增窄测试：`paper_shatter` drawPile 命中、牌顶命中、miss、source 排除。
- 更新旧测试：不再断言没有任何 reorder runtime；改为断言有明确 hit/miss 事件。
- 保留奖励回归：`select-reward` 不能触发 search；奖励进入下一手仍靠 `AddCardToDeck -> DealHand`。
- 保留 Wild 回归：broken chain 不修补，`wild_mana_stitch` 只有真实修补才返当前 MP。
- 保留抽牌倍率回归：置顶不改抽牌数量。

建议命令：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run src/tests/sim/runtime.test.ts src/tests/sim/progression-reward-regression.test.ts src/tests/sim/redline-progression-card-system.test.ts src/tests/ui/hud-target-selection.test.ts
npm test -- --run
npm run build
```

如果可见 HUD 日志或 CSS 被改动，还必须做桌面与移动端浏览器复核。

## 4. 风险控制

| 风险 | 触发信号 | 控制方式 |
| --- | --- | --- |
| payoff 率过高 | `paper_shatter` 经常等于稳定终结按钮 | 只搜 `drawPile`，不搜 discard；只打开一张牌；保留 miss 统计。 |
| 事件合同不清 | 只能从最终手牌猜是否置顶 | hit/miss 必须有明确事件，且顺序早于 `HandDealt`。 |
| 牌区复制 | payoff 同时留在原 zone 和 hand | 每个命中测试都统计 hand/draw/discard 中目标牌数量。 |
| 破坏奖励下一手 | reward trace 出现 search/topdeck | 明确 search 只能由 `CardPlayed` 派生。 |
| 破坏 Wild / 授权 | search 改链路或资源 | Search 不写 energy、chain、authorization，只改 drawPile 顺序。 |
| UI 再次溢出 | 日志或卡牌按钮出现长规则句 | HUD 只用短 token；长解释留在 detail，不进按钮常驻层。 |
| 并行工作冲突 | 目标源码文件已有其他工作者改动 | 实现前重读 hunk，只做小 patch，不整文件覆盖。 |

最快停用策略：

```text
保留 engine 代码也可以；
只移除 paper_shatter 的触发开关或 preDrawSearch 字段，即可回到纯抽牌。
```

不要用整仓回滚，也不要回滚其他工作者的源码改动。

## 5. 第 9 轮交接

第 9 轮主题应进入自动化验收，优先接管以下问题：

1. 把 `paper_shatter` topdeck 样片纳入稳定 sim 测试文件，覆盖 hit、top already hit、miss、source 排除、非法 zone。
2. 增加 reward trace 负例：`select-reward` 下不能出现 search/topdeck。
3. 增加 UI helper 文案长度和禁词测试：不得出现“打开牌库”“手动重排”“重排牌库”等未实现承诺。
4. 如果第 8 轮改了 HUD 日志，补 360/390 移动端无横向溢出验收。
5. 记录至少一组平衡观察：`paper_shatter` 命中、miss、命中后仍无法支付 payoff 三条路径都要可复现。
6. 第 9 轮不得直接扩大到 `lantern_captain` 或 discard fallback；必须先证明第 8 轮样片没有把敌人压力清空。

第 9 轮的通过标准不是“reorder 已经完整”，而是：

```text
paper_shatter 极窄置顶可观测、可回归、可停用；
并且没有破坏第 3-7 轮已经锁住的核心循环合同。
```

## 6. 最终裁决

第 8 轮做：

```text
paper_shatter 极窄 drawPile-only payoff topdeck 样片。
```

第 8 轮不做：

```text
lantern_captain、discardPile search、手动重排 UI、通用 SearchAndTopdeck、牌库浏览器。
```

这个裁决的目的不是扩大系统，而是用最小可观测样片回答一个制作问题：`paper_shatter` 能不能在完成授权后制造“我找到了终结”的爽点，同时仍保留敌人意图和 miss 路径的压力。

STATUS: DONE
