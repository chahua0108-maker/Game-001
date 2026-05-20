# Redline D1-D3 核心三局第9轮 Spec

日期：2026-05-20

状态：待框架程序专家审核；审核通过前不得实现。

## 1. 第8轮结论

第8轮已通过工程门禁，但核心体验没有达到目标：

| 评分员 | 分数 |
| --- | ---: |
| P01 | 96 |
| P02 | 97 |
| P03 | 95 |
| P04 | 94 |
| P05 | 93 |
| P06 | 94 |
| P07 | 96 |
| P08 | 96 |
| P09 | 90 |
| P10 | 94 |
| **平均** | **94.5** |

QA：无 P0，无阻塞型 P1。

10 名玩家的共识：

- D1 简单门槛已成立。
- D3 `62 HP / 6 节点 / 3 选奖励` 已经不是旧版首通断崖。
- 安全路线按钮本体的 `下战修补 / 非即时回血` 已经关闭误读阻塞。
- 分数仍卡在 D2：D2 像“更紧一点的 D1”，缺少第二局的可玩记忆点。
- 三局连续感仍偏文案承接，缺少玩家能感知的活动进度和 D2 到 D3 的自然桥接。

## 2. 本轮目标

本轮只解决最后 0.5 分的体验缺口：

```text
让 D2 从“D1 的数值加强版”变成“低压过渡长局”，作为 D1 3 节点到 D3 6 节点之间的可玩桥。
```

目标体验：

- D1：仍是 3 节点试营业，玩家先建立“我能赢”。
- D2：仍是低压，但比 D1 多一小段路线 / 奖励循环，让玩家记住“第二局开始要管理路线代价”。
- D3：仍是 6 节点中级入口，first-clear 稳定，但不再从 3 节点突然跳到 6 节点。

## 3. 非目标

本轮不做：

- 不处理 AIRoc 插件。
- 不上传 GitHub。
- 不扩 D4/D5-D10。
- 不新增永久 meta、账号成长、局外成长。
- 不跨局继承牌组，不把 D1/D2 奖励牌放进 D2/D3 初始牌组。
- 不新增 activity carryover token 的 runtime 机制。
- 不改路线生成系统、奖励生成系统、污染系统、XP 阈值或战斗核心。

说明：第8轮玩家多次提到“非永久活动内承接 token”。这个方向有潜力，但会引入新的 ActivityState 字段、继续逻辑和 reward/runtime 边界。本轮先不用它，优先用更小的 D2 结构调整解决 D2 记忆点。如果第9轮仍卡在 95 以下，再单独写 `activity carryover token` spec。

## 4. 方案对比

### A. 只补 D2 文案

内容：继续加强 D2 settlement / route 文案。

优点：范围最小。

缺点：第7/8轮已经证明只靠文案会卡在 94 左右，玩家仍说 D2 机制身份薄。

结论：不推荐。

### B. D2 低压过渡长局（推荐）

内容：D2 从 3 节点改成 4 节点，但下调单战压力，确保它仍是 beginner 低压局。

优点：

- 给 D2 一个真实可感知的结构身份。
- 把 D1 3 节点到 D3 6 节点的跳变改成 3 -> 4 -> 6。
- 不新增状态字段，不引入永久成长，不继承牌组。
- 实现和测试都集中在 activity definition、HUD 文案和 D1-D3 回归。

缺点：

- D2 会变长，必须用更低单战伤害保证不劝退。

结论：推荐。

### C. 新增非永久 activity carryover token

内容：记录 D2 route 选择，在 D3 开局给一次活动内提示或 reward 宽度。

优点：最直接解决“我从上一局带来了一点准备”的体感。

缺点：需要新增 ActivityState 字段、snapshot、continueActivityWorld 边界、消费规则。容易把本轮从小切片扩大成新系统。

结论：保留为第10轮备选，不在本轮实现。

## 5. 推荐实现范围

只允许修改以下文件：

- `prototype-web/src/sim/activity.ts`
- `prototype-web/src/ui/hud.ts`
- `prototype-web/src/tests/sim/redline-activity-difficulty.test.ts`
- `prototype-web/src/tests/ui/hud-target-selection.test.ts`
- `design/technical/redline-batches/long-task/2026-05-20-multi-run-difficulty-round-09-synthesis.zh.md`

禁止修改：

- `prototype-web/src/sim/types.ts`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/sim/world.ts`
- route generation / reward generation / pollution runtime。
- D4/D5-D10 定义或可玩列表。
- `.codex/`、QA output、dist。

## 6. D2 数值调整

当前 D2：

```ts
nodeCount: 3
playerMaxHp: 66
enemyHpMultiplier: 0.9
enemyDamageMultiplier: 0.7
rewardPickCount: 4
eliteRouteEntryDamage: 3
eliteRouteAddsPollution: false
```

推荐 D2：

```ts
nodeCount: 4
playerMaxHp: 68
enemyHpMultiplier: 0.86
enemyDamageMultiplier: 0.58
rewardPickCount: 4
eliteRouteEntryDamage: 3
eliteRouteAddsPollution: false
```

理由：

- `nodeCount: 4` 是 D2 的真实身份：比 D1 多一段路线 / 奖励循环，但仍远短于 D3。
- `playerMaxHp: 68` 给第 4 节点留低压缓冲，不让 D2 变成新断崖。
- `enemyHpMultiplier: 0.86` 和 `enemyDamageMultiplier: 0.58` 降低单战压力，保证 D2 仍是 beginner。
- `rewardPickCount: 4` 保持新手宽选择，不提前收紧。
- elite 路线仍是 `-3 HP / 无污染`，继续作为轻取舍，不进入污染教学。

硬性验收：

- D2 保守自然通关必须 victory。
- D2 通关 HP 必须 `> 35`。
- D2 通关 HP 必须低于 D1 通关 HP。
- D2 通关 HP 必须高于 D3 通关 HP。
- D2 `nodeCount === 4`。
- D2 `playerMaxHp === 68`。
- D2 `enemyHpMultiplier === 0.86`。
- D2 `enemyDamageMultiplier === 0.58`。
- D2 `rewardPickCount === 4`。
- D2 elite route 仍 `-3 HP / 无污染`。
- D3 仍 `nodeCount === 6`、`playerMaxHp === 62`、`rewardPickCount === 3`。
- D3 保守自然通关仍 victory，HP `> 12` 且 `< D2 clear HP`。

## 7. HUD 文案调整

仅改 D1-D3 展示文案，不新增教程弹窗。

建议文案：

- D2 标题：`D2 低压过渡`
- D2 settlement：`下一局进入6节点长局，D2 已完成路线代价练习`
- D1 settlement：`下一局进入4节点低压过渡，开始注意路线代价`
- D3 settlement：保持 `核心三局已打通，后续才进入污染首秀`

要求：

- HUD 必须让玩家看到 D2 是 4 节点低压桥，而不是 D1 复制版。
- 不在按钮里塞长解释，不造成移动端溢出。

## 8. TDD 任务

### Task 1: D2 低压过渡长局 RED

先改测试，不改生产。

在 `prototype-web/src/tests/sim/redline-activity-difficulty.test.ts` 更新 / 新增断言：

```ts
expect(d2Level.nodeCount).toBe(4);
expect(d2Level.playerMaxHp).toBe(68);
expect(d2Level.enemyHpMultiplier).toBe(0.86);
expect(d2Level.enemyDamageMultiplier).toBe(0.58);
expect(d2Level.rewardPickCount).toBe(4);
```

并在自然通关测试中记录：

```ts
const d1ClearHp = world.player.hp;
...
expect(world.run.currentNode).toBe(4);
expect(world.player.hp).toBeGreaterThan(35);
expect(world.player.hp).toBeLessThan(d1ClearHp);
```

运行：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test:sim -- redline-activity-difficulty.test.ts
```

预期：D2 nodeCount / 数值断言失败。

### Task 2: D2 activity definition GREEN

在 `prototype-web/src/sim/activity.ts` 只改 D2 定义：

```ts
nodeCount: 4
playerMaxHp: 68
enemyHpMultiplier: 0.86
enemyDamageMultiplier: 0.58
rewardPickCount: 4
eliteRouteEntryDamage: 3
eliteRouteAddsPollution: false
```

运行 sim 测试，通过后再继续。

### Task 3: HUD 文案 RED/GREEN

先在 `prototype-web/src/tests/ui/hud-target-selection.test.ts` 断言：

```ts
expect(hudRunLayerState(d2Snapshot).title).toBe('D2 低压过渡');
expect(root.innerHTML).toContain('下一局进入6节点长局');
expect(root.innerHTML).toContain('D2 已完成路线代价练习');
```

再在 `prototype-web/src/ui/hud.ts` 调整 D2 标题和 settlement detail。

### Task 4: 门禁

聚焦测试：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test:sim -- redline-activity-difficulty.test.ts
npm run test:ui -- hud-target-selection.test.ts
```

完整门禁：

```bash
cd /Users/roc/Game-001/prototype-web
npm run check
```

浏览器 QA：

```bash
cd /Users/roc/Game-001/prototype-web
QA_ROUND=d1-d3-core-loop-round-09 QA_PORT=5189 npm run qa:ui
QA_JOURNEY_NODES=3 npm run qa:similarity
```

## 9. 复评协议

实现和门禁通过后，必须再次派：

- 10 名独立资深玩家评分，只看 D1-D3 核心三局。
- 2 名 QA 专家审查 P0/P1/P2。

只有：

```text
10 人均分 >= 95
AND QA 无 P0 / 阻塞型 P1
AND check / browser QA 通过
```

才能声明达到 95+。

如果仍不到 95，不得停止，下一轮才考虑 `activity carryover token`。

## 10. 框架程序专家审核问题

请审核：

1. D2 `3 -> 4` 节点是否是 D1-D3 核心三局内的结构调整，而不是扩 D4/D5-D10。
2. D2 单战压力降低是否足以保持 beginner 低压，不制造新的不通关。
3. 本轮禁用 `activity carryover token` 是否能避免类型 / runtime / snapshot 边界扩张。
4. 是否仍避免永久 meta、跨局牌组继承、奖励系统重写。
5. D2 文案是否提升玩家体验，而不变成教程弹窗。

审核结论格式：

```text
decision: approve | approve-with-changes | reject
approved-scope:
- ...
required-changes:
- ...
implementation-notes:
- ...
```

## 11. 框架程序专家审核结论

decision: approve-with-changes

approved-scope:

- 允许把 D2 从 `nodeCount: 3` 改为 `nodeCount: 4`，仍属于 D1-D3 核心三局结构调整，不是扩 D4/D5-D10。
- 允许只改 `prototype-web/src/sim/activity.ts` 的 D2 definition、`prototype-web/src/ui/hud.ts` 的 D1-D3 展示文案，以及两份对应测试。
- 批准本轮不做 `activity carryover token`，避免牵涉 `ActivityState`、continue 边界和 reward/runtime 语义。
- 禁止继续成立：不改 `types.ts`、`runtime.ts`、`world.ts`、route/reward/pollution runtime、D4/D5-D10、`.codex/`、QA output、`dist`。

required-changes:

- D2 自然通关断言使用更强区间：`hp > 35`、`hp < d1ClearHp`、`hp > d3ClearHp`。
- 更新旧断言：D2 `run.maxNodes === 4`，D2 奖励节点 `[1,2,3,4]`。
- 加 D2 definition 精准断言：`nodeCount/playerMaxHp/enemyHpMultiplier/enemyDamageMultiplier/rewardPickCount/eliteRouteEntryDamage/eliteRouteAddsPollution`。
- 保留范围保护：`playableLevelIds` 仍只包含 `['d1','d2','d3','d4']`，不出现 `d5/d10`，D4 definition 不变。
- 保留负向边界：D1/D2 奖励仍不进入下一局初始牌组，不新增 activity carryover 字段或 runtime token。

implementation-notes:

- 推荐数值整体合理。D2 低压主要来自 `enemyDamageMultiplier: 0.58` 和更高 HP，不是来自敌 HP 明显降低。
- `eliteRouteEntryDamage: 3` 且无污染合理，继续保持 D2 轻取舍，不提前教学污染。
- HUD 文案和测试必须同时改。
