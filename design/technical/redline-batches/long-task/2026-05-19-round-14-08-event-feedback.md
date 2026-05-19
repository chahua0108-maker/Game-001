# 2026-05-19 Round 14-08：事件日志 / 可读反馈体验审查

角色：第 14 轮-08《事件日志/可读反馈体验专家》  
工作目录：`/Users/roc/Game-001`  
目标：玩家能看懂每张牌从手牌到弃牌 / 消耗 / 保留 / 抽牌的迁移和原因。  
边界：并行 agent 工作树，不回滚他人改动；本轮只补 HUD 文案映射、短 token、局部 UI 测试。

## 0. 结论

当前 runtime 已经有正确的物理牌区事件：

- `CardMoved`
- `CardDrawn`
- `CardExhausted`
- `CardRetained`
- `DiscardPileShuffledIntoDrawPile`
- `DiscardShuffledIntoDraw`

问题不在事件缺失，而在玩家层没有稳定翻译这些事件。玩家看到 `combat feed` 时，不能可靠知道“这张牌为什么离开手牌、去了哪里、是否会回到抽牌循环”。

本轮已补一层 HUD 映射，原则是只用短文案：

```text
抽到 X
弃 X · 打出
消耗 X · 打出
保留 X · 回合末
保留回手 X
留1下手 · X
弃->抽 2张
洗回 2张
```

卡牌按钮只显示短 token，不塞说明句：

```text
开链 · 污
承接 · 留
终结
```

## 1. 已改动

### 1.1 HUD 事件映射

文件：`prototype-web/src/ui/hud.ts`

新增可测试函数：

- `hudCardLifecycleToken(card)`
- `hudCardVisibleRoleLabel(card)`
- `hudCardPlayDestinationLabel(card)`
- `hudCardTurnEndDestinationLabel(card)`
- `hudEventFeedbackLabel(event)`

映射合同：

| Runtime 事件 | 玩家可读文案 | 玩家能理解的问题 |
|---|---|---|
| `CardMoved drawPile -> hand` | `抽到 X` | 这张牌从抽牌堆进手牌 |
| `CardMoved hand -> discardPile` | `弃 X · 打出/回合末` | 它去了弃牌堆，会进入后续洗回 |
| `CardMoved hand -> exhaustPile` | `消耗 X · 打出` | 它离开抽弃循环 |
| `CardMoved hand -> retainedCards` | `保留 X · 回合末` | 回合末没有被普通弃置 |
| `CardMoved retainedCards -> hand` | `保留回手 X` | 保留牌先回到下一手 |
| `CardExhausted` | `消耗区 N · X` | 消耗区数量变化 |
| `CardRetained` | `留N下手 · X` | 下手保留数量变化 |
| `DiscardPileShuffledIntoDrawPile` | `弃->抽 N张` | 弃牌堆洗回抽牌堆 |
| `DiscardShuffledIntoDraw` | `洗回 N张` | 洗回发生了 |

### 1.2 Combat feed 接入

文件：`prototype-web/src/ui/hud.ts`

`combatEventLabel()` 现在优先走 `hudEventFeedbackLabel()`，再处理战斗伤害、击杀、升级等旧事件。

`CardPlayed` 文案也补了目的地：

```text
出牌 Static Overload -> 消耗 · x1
出牌 Debt Hook -> 弃牌 · x1
```

这样即使后续伤害事件把 `CardMoved` 挤出最近两条 feed，玩家仍能从 `CardPlayed` 本身看懂去向。

### 1.3 卡牌按钮生命周期 token

文件：`prototype-web/src/ui/hud.ts`

卡牌按钮和奖励牌面使用 `hudCardVisibleRoleLabel()`：

| 卡牌 | 当前 token |
|---|---|
| `Static Overload` | `开链 · 污` |
| `Guard Reserve` | `承接 · 留` |
| 普通终结牌 | `终结` |

说明：

- `污` 优先于 `消`，因为玩家第一眼更需要知道它是污染 / 状态牌。
- `消耗` 的去向由打出后的 feed 显示，避免按钮上堆 `污 · 消` 造成移动端拥挤。
- 普通弃牌不显示 token，避免所有按钮都变成噪音。

### 1.4 牌区 chip 补全

文件：`prototype-web/src/ui/hud.ts`、`prototype-web/src/style.css`

桌面 `pile-chip` 从旧的四数字口径改为：

```text
抽N 弃N 消N 留N
```

tooltip 保留全量：

```text
总 N · 抽 N · 弃 N · 手 N · 消 N · 留 N
```

CSS 对 `.pile-chip span` 加了 ellipsis 保护，避免桌面窄宽度时文字撑开 status strip。移动端原本隐藏 `.pile-chip`，本轮没有恢复常驻牌区，避免挤压 HP / MP / CHAIN / 意图。

## 2. 红线审查

### 2.1 已满足

- 事件日志不再暴露 raw zone 名称给玩家层。
- 消耗、保留、抽牌、洗回都有短映射。
- 卡牌按钮生命周期信息不超过一个短 token。
- `combat-feed li` 现有 CSS 已做 ellipsis，本轮新增的 feed 文案都控制在短句。
- 桌面牌区 chip 新增 `消/留`，不会再只看到 `deck/draw/discard/hand` 的四数字误导。

### 2.2 仍有风险

1. `combat-feed` 只显示最近 2 条。高连锁打出后，`CardMoved` 仍可能被后续伤害、击杀、XP 挤掉。已用 `CardPlayed -> 目的地` 缓解，但如果要完整追溯每张牌，后续应增加一个可折叠的“牌区流转”小抽屉。
2. `CardDrawn` 与 `CardMoved drawPile -> hand` 都会产生“抽到”类反馈。当前文案不同，但在最近两条 feed 内可能略重复。后续可按 traceId 聚合为一条：`抽到 X · 抽堆N`。
3. 状态 / 污染目前只有测试牌 `static_overload`。如果后续加入真实污染生成事件，需要补 `污+N` / `清污N` 的专用事件映射。
4. `Reward` 选择后会 `DiscardHand(reason: reward selected)`，当前映射为 `弃 X · 奖励后`。这能读懂，但“奖励后为何弃手牌”仍偏系统化，后续可改为 `换手弃 X`。

## 3. 测试

已通过：

```text
npm run test:ui -- --run
```

结果：

```text
1 test file passed
20 tests passed
```

新增断言覆盖：

- `Static Overload` 显示 `污`
- `Guard Reserve` 显示 `留`
- 打出后目的地：`消耗` / `弃牌`
- 回合末目的地：`保留` / `弃牌`
- `CardMoved` / `CardRetained` / `DiscardPileShuffledIntoDrawPile` 的玩家短文案

## 4. Build 阻塞

执行：

```text
npm run build
```

失败，但失败点不是本轮 HUD 映射新增代码：

```text
src/sim/types.ts(99,3): error TS2300: Duplicate identifier 'countsForChain'.
src/sim/types.ts(102,3): error TS2300: Duplicate identifier 'countsForChain'.
src/tests/sim/card-upgrade-gems.test.ts(7,8): error TS2307: Cannot find module '../../sim/cardUpgrades'
src/tests/sim/card-upgrade-gems.test.ts: cardUpgrades 字段不存在于 WorldState
```

判断：这是当前并行工作树中其他 agent 的未完成类型面，不应由本轮事件反馈任务擅自回滚或修复。

## 5. 下一步建议

优先级 P1：

- 增加 `hudEventFeedbackLabel()` 的 trace 聚合：同一 trace 下 `CardMoved drawPile->hand` + `CardDrawn` 合并成 `抽到 X · 抽堆N`。
- 给 combat feed 增加“牌区流转”筛选，不与伤害 / 击杀争最近两条。

优先级 P2：

- 真实污染生成事件接入后，补 `污+N`、`污手N`、`清污N`。
- 对 `Reward` 后弃牌原因改更玩家化：`换手弃 X`。

优先级 P3：

- 用 browser QA 在 `1366x768`、`390x844`、`360x640` 复核新增短文案没有挤压。当前 UI 单测能证明映射，不等价于视觉验收。
