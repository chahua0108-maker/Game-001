# Redline D1-D3 核心三局 95+ 体验 Spec

日期：2026-05-20

状态：框架程序专家 `approve-with-changes`；已按审核意见收窄 runtime guard、D3 文案边界和测试范围保护。

## 1. 评分制度

第 7 轮不再由主线程随口打分。评分固定为：

- 10 名独立资深卡牌 / 肉鸽玩家评分。
- 每名玩家只评价核心三局循环：D1 简单入门、D2 轻压力、D3 中级入口 first-clear。
- 2 名 QA 专家只审查问题，不给核心体验加分。
- QA、测试、文档、自动化、提交数量不计入 `coreScore`。

评分维度总分 100：

| 维度 | 权重 |
| --- | ---: |
| D1 简单可理解 | 20 |
| D2 轻压但不劝退 | 20 |
| D3 明显变难但仍可 first-clear | 25 |
| 三局成长 / 奖励 / 路线连续性 | 20 |
| 失败 / 风险可读性 | 15 |

第 7 轮 10 名玩家分数：

| 评分员 | 分数 |
| --- | ---: |
| P01 | 82 |
| P02 | 82 |
| P03 | 87 |
| P04 | 78 |
| P05 | 83 |
| P06 | 88 |
| P07 | 94 |
| P08 | 88 |
| P09 | 81 |
| P10 | 84 |
| **平均** | **84.7** |

结论：当前没有达到 `95+`。

## 2. 共识问题

10 名玩家和 2 名 QA 的主要共识：

1. D1-D3 已经能自然通关，不是旧版断崖。
2. D1 足够低门槛，D3 作为中级入口基本成立。
3. D2 的身份偏薄，和 D1 的差异主要藏在 HP / 敌伤倍率里，玩家不一定感到第二局开始了新的取舍。
4. 三局之间更像“连续解锁难度”，而不是“玩家在一套闯关活动里逐步建立优势”。现有测试明确要求 D1 / D2 奖励不永久进入下一局牌组，这个边界正确，但玩家需要更清楚地看到活动进度和下一局压力承接。
5. `repair-cache` 语义仍可能被误解为即时回血；它实际是“下一战奖励更偏修补 / 资源”的后续收益。
6. HUD 禁用低血 elite route，但 runtime 直接收到 `select-route` intent 时没有同等防线。
7. D2 elite route、D2/D3 HUD 标题、D2/D3 补位敌人倍率缺精准回归。
8. 95+ 之前需要一次浏览器 / 移动端视角验收，确认 Reward -> RouteSelect -> Settlement 的玩家可读性。

## 3. 本轮目标

本轮目标不是继续扩 D4-D10，而是把 D1-D3 的前三局核心体验从 `84.7` 推近 `95+` 的前置门槛。

假设：

```text
如果 D2 的轻压力变成玩家可读的“第二局取舍”，D1-D3 的结算 / 进度 / 路线语义能清楚说明每一局为什么变难，并补上 runtime 防线和核心回归，那么核心三局会从“能通”提升到“像一段完整的前期闯关体验”。
```

## 4. 允许范围

本轮允许改：

- D1-D3 的 HUD 文案和可读性。
- RouteSelect 按钮 / 顶部摘要中 `repair-cache` 和 `elite-pressure` 的玩家向说明。
- D1/D2/D3 的 settlement 文案，让玩家清楚当前完成档位、下一档压力和是否仍是本活动内推进。
- runtime 对低血 elite route 的输入防线：当 route pressure entry damage 会致死时，直接 `select-route` intent 不应绕过 HUD 禁选。
- D2 elite route 精准测试。
- D2 / D3 HUD 标题精准测试。
- D2 / D3 补位敌人倍率精准测试。
- 浏览器 QA 脚本或验收命令只作为门禁，不提交 QA 输出。

本轮不改：

- 不扩 D4 / D5-D10。
- 不新增永久 meta 成长。
- 不把 D1/D2 奖励牌永久带进 D2/D3 牌组。
- 不重写奖励系统、路线系统、污染系统或 XP 阈值。
- 不改变 D1-D3 的基础难度数值，除非实现后 10 人评分仍卡在同一问题且另开 spec。
- 不引入教程弹窗或复杂新手引导系统。

## 5. 生产改动建议

### 5.1 D2 / D3 活动层可读性

HUD 中 D1-D3 标题保留中文档位，但下一战后果和结算文案需要更像玩家语言：

- D1 完成：`D1 完成 · 进入 D2 低压追账`
- D2 完成：`D2 完成 · 进入 D3 中级入口`
- D3 完成：`D3 完成 · 核心三局已打通`

下一战后果建议：

- D1：`下一局仍是低压清算，开始注意路线代价`
- D2：`下一局进入6节点长局，优先保守路线`
- D3：`核心三局完成，后续才进入污染首秀`

### 5.2 路线语义压缩

`repair-cache` 不能让玩家误以为立即回血。建议按钮 / 摘要文案中出现：

- `安全/后续补给`
- `下战奖励偏修补`
- `非即时回血`

`elite-pressure` 继续保持：

- `高风险/贪心`
- `-N HP`
- `无污染` 或 `+污染`
- 低血时：`HP不足，选择会阵亡`

### 5.3 runtime 低血路线防线

当前 HUD 会禁用致死 elite route，但 runtime 可直接处理 `select-route` intent。本轮应补极窄 runtime 级拒绝：

- 只拦截 `selectedRoute.kind === 'elite-pressure'` 且 `selectedRoute.routePressure.entryDamage >= world.player.hp` 的直接 `select-route` intent。
- 写入 `world.debug.failedConditions`，`ruleId: 'intent.select-route'`，`conditionId: 'route-pressure-lethal'`。
- 保持 `world.fsm.gameFlow === 'RouteSelect'`。
- 保持 `world.run.currentNode` 不变。
- 保持玩家 HP 不变。
- 不自动改选路线。
- 不扣血。
- 不推进节点。
- 不进入 Settlement。

这不是难度改动，是输入边界保护，和 HUD 禁选语义一致。

### 5.4 回归测试

必须补测试：

- D2 elite route preview 和应用后 HP `-3`，无 `static_overload`，`totalPollutionAdded === 0`。
- D1 / D2 / D3 低血时，直接 `select-route` elite intent 被 runtime 拒绝，不能绕过 HUD。
- D2 / D3 `hudRunLayerState` 标题。
- D2 / D3 补位敌人 stats 等于对应 level 初始 stats。
- 范围保护：D4 已有历史状态不能被本轮修改；本轮不得修改 D4 / D5-D10 定义，不得新增永久 meta 字段，不得让 D1 / D2 奖励牌跨局进入 D2 / D3 初始牌组。

建议补 UI 可读性测试：

- D1 / D2 / D3 settlement 文案，至少断言进入下一档或核心三局完成。
- route summary 或 route buttons 出现 `非即时回血` / `下战奖励偏修补`。

## 6. 验收门禁

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

浏览器验收：

```bash
cd /Users/roc/Game-001/prototype-web
QA_ROUND=d1-d3-core-loop-95 QA_PORT=5187 npm run qa:ui
```

浏览器验收必须确认：

- desktop / 390 / 360 三档 viewport 通过。
- 无 console error。
- 无横向溢出。
- 无文字溢出。
- RouteSelect 中两条路线、HP 代价和风险语义可见。
- Settlement 中 D1 -> D2、D2 -> D3、D3 完成状态不误导。
- 浏览器、context、服务清理通过，`pidAlive=false`，`portListening=false`。

## 7. 重新评分

实现和门禁通过后，必须再次派出 10 名独立资深玩家评分，仍按同一维度。

只有当：

```text
10 名玩家平均 coreScore >= 95
AND 2 名 QA 无 P0 / 阻塞 P1
AND full check / browser QA 通过
```

才允许声明核心三局循环达到 `95+`。

如果平均分仍低于 95，不得 final 停止，必须进入下一轮 spec。下一轮再考虑是否需要轻量活动内 carryover token；不能在本轮直接把牌组 / 奖励跨局继承做进去。

## 8. 框架审核问题

请框架程序专家重点审核：

1. runtime 低血 elite route 防线是否属于输入边界保护，而不是改玩法。
2. 本轮是否严格停留在 D1-D3 核心三局，不扩 D4-D10。
3. 是否避免了永久 meta / 牌组跨局继承。
4. HUD / settlement 文案是否能提升玩家可读性，而不引入教程系统。
5. 测试门禁是否覆盖 QA 提出的 P1/P2 缺口。

审核后实现范围：

- 允许：`prototype-web/src/sim/runtime.ts`，仅加 elite 致死输入 guard。
- 允许：`prototype-web/src/ui/hud.ts`，仅改 D1-D3 HUD、route summary/button、settlement 文案。
- 允许：`prototype-web/src/tests/sim/redline-activity-difficulty.test.ts`，补 D1-D3 runtime guard、D2 elite、D2/D3 补位倍率和范围保护测试。
- 允许：`prototype-web/src/tests/ui/hud-target-selection.test.ts`，补 D2/D3 标题、route/settlement 文案测试。
- 不允许：活动等级定义、D4/D5-D10、奖励系统、路线生成系统、污染系统、XP 阈值、永久存档/meta、跨局牌组继承逻辑。
