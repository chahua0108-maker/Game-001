# 2026-05-19 Round 14-06：经济/压力曲线平衡切片

角色：第14轮-06《经济/压力曲线平衡专家》  
工作目录：`/Users/roc/Game-001`  
实现边界：优先数据/纯 sim；不回滚其他 agent 改动；本轮只做一刀压力循环切片。  
输出文件：`design/technical/redline-batches/long-task/2026-05-19-round-14-06-pressure-balance.md`

## 0. 结论

本轮最小可交付切片不是继续加高伤害牌，而是把“没处理敌意图”变成下一手牌库质量损失：

```text
有限 MP / 4 手牌
  -> 前排敌人声明 End Turn 伤害
  -> 玩家没把压力兑现成击杀、授权或 payoff
  -> 结束回合实际掉 HP
  -> 严重坏手洗回时塞入 1 张污染状态牌
  -> 下一手少一个有效行动位
```

这比单纯调怪物伤害更接近竞品压力循环：压力不是背景扣血，而会进入牌库，挤压抽牌质量，迫使玩家在后续奖励中考虑修补、抽牌、路线和终结。

## 1. 当前基线

已确认的系统基础：

| 维度 | 当前事实 | 平衡含义 |
| --- | --- | --- |
| 费用 | `maxEnergy = 3` | `0 -> 1 -> 2` 正好用完，3 MP payoff 需要授权。 |
| 手牌 | `HAND_SIZE = 4` | 坏手和污染能真实挤压选择。 |
| 敌意图 | Deal 时快照前排攻击者，End Turn 结算 | 玩家能预判本回合会掉多少 HP。 |
| HP | 玩家 60 HP，默认前排约 17 伤害 | 不处理压力 3 回合左右会进入危险区。 |
| 奖励阈值 | 首奖 `12 XP` | 应在短 demo 内触发，让奖励回应上一手问题。 |
| 状态牌 | `static_overload` 已存在 | 原先可作为物理牌区测试，但压力源和链路惰性不足。 |

## 2. 本轮实现

### 2.1 状态牌链路惰性

`static_overload` 仍然是可打出的物理状态牌，打出后进入 `exhaustPile`，但它不再推进费用链：

- 不触发 `ChainAdvanced`。
- 不触发 `AuthorizationGranted`。
- 不改变 `nextExpectedCost`。
- `CardPlayed` 仍记录 `effectiveCost = 0` 和 `effectMultiplier = 1`，方便 UI/日志看到这张牌被处理过。

平衡原因：污染牌可以占手牌、占抽牌、占点击，但不能变成免费的 `0 MP` 开链材料。

### 2.2 HP 压力转化为抽牌污染

新增纯 sim 命令与事件：

- `AddPressurePollution`
- `PressurePollutionAdded`

触发条件被刻意收窄：

```text
damageTaken > 0
and drawPile.length === 0
and discardPile.length >= HAND_SIZE - 1
and hand/draw/discard/retained 中没有 active static_overload
```

也就是说，只有在玩家吃到了敌意图伤害，并且下一手即将通过弃牌堆洗回组成完整手牌时，系统才向 `discardPile` 注入 1 张 `static_overload`。这样它会在下一次 Deal 进入手牌，形成“下一手少一个有效行动”的压力后果。

没有选择“每次受伤都塞污染”，因为那会破坏既有抽弃合同，也会让首奖前污染过量。当前切片更像一个红线样片：严重坏手/严重未解压力时污染一次。

## 3. 体验效果

这刀把压力循环从：

```text
看见意图 -> 掉血 -> 下一回合照常抽牌
```

推进到：

```text
看见意图 -> 掉血 -> 下一手被污染挤压 -> 奖励/抽牌/修补开始有回应对象
```

它覆盖了用户指定的几个点：

| 目标 | 本轮对应 |
| --- | --- |
| 有限费用 | 不改 `3 MP`，状态牌不提供免费链段。 |
| 怪物意图 | 仍以当前 `enemyIntentSummary.totalDamage` 作为压力来源。 |
| 血量损失 | 只有实际 `damageTaken > 0` 才可能污染。 |
| 奖励阈值 | 不改首奖 12 XP，污染作为奖励回应的前置问题。 |
| 抽牌质量 | 污染进入弃牌堆并洗回，挤压 4 手牌。 |
| 污染/状态牌 | `static_overload` 成为压力后果，且链路惰性。 |

## 4. Redline

后续不能越过这些边界：

- 不要把污染塞进 `startingHand`。
- 不要让 `status` 牌推进 `0 -> 1 -> 2` 或 payoff 倍率。
- 不要每次受伤都无条件塞污染，首奖前自然污染应保持 0-1 张。
- 不要用永久 Max MP 或免费抽牌抵消污染，否则压力循环会被抹平。
- 不要把这刀解释为完整诅咒系统；它只是“压力可进入牌库”的最小证明。

## 5. 验证

新增测试：

```text
prototype-web/src/tests/sim/redline-pressure-balance.test.ts
```

覆盖：

1. 污染状态牌打出后进 `exhaustPile`，但不推进链、不授权。
2. 未处理敌意图造成 HP 损失后，在严重洗回场景注入 `static_overload`，下一手只剩 3 张非污染有效牌。

已执行：

```bash
npm test -- --run src/tests/sim/redline-pressure-balance.test.ts
npm test -- --run src/tests/sim/redline-pressure-balance.test.ts src/tests/sim/runtime.test.ts src/tests/sim/runtime-audit.test.ts
npm run test:sim -- --exclude src/tests/sim/card-upgrade-gems.test.ts
```

结果：

- 新增单测：2/2 pass。
- 受影响 runtime 子集：46/46 pass。
- 排除缺失模块 `card-upgrade-gems.test.ts` 后，sim 套件：119 pass / 2 skipped。

全量 `npm run test:sim` 仍会被既有缺失模块阻塞：

```text
src/tests/sim/card-upgrade-gems.test.ts
Failed to load url ../../sim/cardUpgrades
```

这个失败不是本轮污染切片引入的，但会继续影响全量 sim 命令。

STATUS: DONE
