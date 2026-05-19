# 2026-05-18 Round 02-04 敌人意图系统扩展设计

身份：第 2 轮专家 04，敌人意图系统扩展设计师  
工作目录：`/Users/roc/Game-001`  
边界：不修改源码，不提交 git；本文只给下一步最小敌人意图扩展设计。  

## 0. 结论

第 1 轮已经把“卡牌打出后本回合意图会从多少变到多少”推进成主路径：默认目标锁定最高当前意图，卡牌按钮显示 intent delta，结束回合按钮显示总伤害。下一步不要扩 10 个敌人意图，也不要立刻补状态牌、诅咒、召唤、防御。

本轮只选一个 P0 意图：

> `Redline Brute` 的 **红线重击**：一个高伤害、可用现有攻击牌打断并降级的攻击变体。

它的价值是用最小改动证明：敌人意图不是只显示伤害，而是能改变玩家本回合的目标选择、费用链路线和卡牌预览。

## 1. P0 一个意图：红线重击

### 1.1 设计目标

`红线重击` 只解决一个问题：让玩家明确看到“我不处理这只 Brute，会多吃 5 点伤害；我这回合对它造成足够伤害，即使没杀，也能把重击降成普通攻击”。

P0 不引入新卡，不引入专门打断牌，不引入敌人 AI 调度器。反制方式只复用现有伤害牌：

- 单体攻击：`Debt Hook`、`Redline Cut`、`Heartbeat Spark`。
- 前排攻击：`Row Cleave`、`Clearance Order`。
- payoff：`Severance Burst`、`Red Ledger Burst`。

### 1.2 触发规则

P0 固定规则：

| 项 | 规则 |
| --- | --- |
| 适用敌人 | `definitionId === 'redline_brute'` |
| 出现数量 | 每个敌人意图声明窗口最多 1 个 `红线重击` |
| 选择目标 | 当前前排、仍属于本回合攻击快照的第一个 `Redline Brute` |
| 其他 Brute | 继续使用普通 `attack -5` |
| 教学节奏 | 推荐在固定短切片第 2 或第 3 回合开启；第 1 回合可保留普通攻击用于教学基础预览 |
| 结算窗口 | 玩家回合结束时结算；被击杀则取消，被打断则降级 |

这不是长期 AI，只是一个 deterministic encounter rule。P1 再做调度器。

### 1.3 数值

| 参数 | P0 值 | 理由 |
| --- | ---: | --- |
| 普通 Brute 攻击 | 5 | 保持当前 `redline_brute.damage`。 |
| 红线重击伤害 | 10 | 比普通攻击多 5，足够改变总意图，但不是秒杀。 |
| 打断阈值 | 本回合对该 Brute 造成 12+ 伤害 | `Debt Hook` 单独 4 不够；`Debt Hook -> Heartbeat Spark` 可触发；`Debt Hook -> Redline Cut` 可击杀。 |
| 打断结果 | 降级为普通攻击 5 | 非击杀也有收益，总意图降低 5。 |
| 击杀结果 | 取消该敌人意图 | 总意图降低 10。 |
| 每轮数量上限 | 1 | 避免两个 Brute 同时重击导致压力曲线过高。 |

首个重击出现时，若前排仍是当前默认阵型：

```text
Debt Wisp -2
Redline Brute 红线重击 -10
Pulse Collector -3
Debt Wisp -2
Redline Brute 普攻 -5
总意图 -22
```

打断后：

```text
总意图 -22 -> -17
```

击杀该 Brute 后：

```text
总意图 -22 -> -12
```

### 1.4 可实现字段

当前 `EnemyIntent` 只有 `kind: 'attack'`。P0 只需要把它扩成“普通攻击 + 可降级攻击”，不要上完整状态系统。

建议字段草案：

```ts
type EnemyIntentKind = 'attack' | 'charged-strike';
type EnemyIntentState = 'active' | 'downgraded';

interface EnemyIntent {
  enemyId: EntityId;
  kind: EnemyIntentKind;
  amount: number;
  slot: number;
  description: string;
  willRefill: boolean;

  baseAmount?: number;          // 普通攻击值，Brute 为 5
  declaredHp?: number;          // 意图声明时 HP，用来计算本回合已承受伤害
  counterThreshold?: number;    // P0 为 12
  counterProgress?: number;     // max(0, declaredHp - currentHp)
  counterResultAmount?: number; // P0 为 5
  state?: EnemyIntentState;
  uiLabel?: string;             // "红线重击"
  uiCounterLabel?: string;      // "打断 0/12"
}
```

最小运行时行为：

1. `DealHand` 声明本回合攻击者时，为最多一个前排 Brute 生成 `kind: 'charged-strike'`。
2. 该 intent 的 `amount = 10`、`baseAmount = 5`、`declaredHp = enemy.hp`、`counterThreshold = 12`、`counterProgress = 0`、`counterResultAmount = 5`。
3. `DamageApplied` 后，如果目标有 active `charged-strike`，用 `declaredHp - enemy.hp` 更新 `counterProgress`。
4. 若 `counterProgress >= 12` 且敌人未死，把 `amount` 改为 5、`state = 'downgraded'`，并发结构化事件。
5. 若敌人死亡，现有死亡刷新 intent 逻辑取消该 intent。
6. `EnemyAttack` 结算必须使用 `world.enemyIntents[enemy.id]?.amount`，不能继续只读 `enemy.damage`。

建议新增事件：

```ts
type GameEvent =
  | {
      type: 'EnemyIntentCountered';
      traceId: TraceId;
      tick: number;
      enemyId: EntityId;
      intentKind: 'charged-strike';
      fromAmount: 10;
      toAmount: 5;
      counterProgress: number;
      counterThreshold: number;
    };
```

这个事件用于 UI feed、测试和后续 VFX，不要求先做动画系统。

## 2. UI 表达

P0 UI 只复用第 1 轮已经落地的三块：前排 peek、卡牌按钮 intent preview、结束回合总伤害。

### 2.1 前排 peek

Brute 重击 active：

```text
BRU HP 22/22
重击 -10
打断 0/12
```

受伤但未打断：

```text
BRU HP 18/22
重击 -10
打断 4/12
```

被打断后：

```text
BRU HP 6/22
普攻 -5
已打断
```

被击杀后：

```text
BRU 已清除
意图取消
```

移动端不要依赖 hover/title。`重击 -10` 和 `打断 x/12` 必须是可见文本；如果空间不够，优先保留这两项，隐藏英文名细节。

### 2.2 卡牌按钮预览

当前 `.card-intent-preview` 已能显示 `意图 17->12`。P0 扩展后需要能区分三种结果：

| 结果 | 卡牌按钮短文案 |
| --- | --- |
| 击杀重击 Brute | `BRU 取消 22->12` |
| 非致命打断 | `BRU 打断 22->17` |
| 伤害不足 | `打断 4/12 · 意图仍 22` |
| 打错目标 | `BRU 重击仍在` |
| self / draw / mana 牌 | 保持 `抽牌找解`、`返MP找解`，不承诺直接降意图 |

关键点：预览必须使用和 runtime 相同的默认目标规则。未手动选目标时，单体牌仍默认锁定当前最高 active intent 的前排敌人；在重击存在时，通常就是该 Brute。

### 2.3 结束回合按钮与战斗信息

结束回合按钮：

```text
结束回合 -22
```

打断后：

```text
结束回合 -17
```

战斗信息新增一条即可：

```text
Redline Brute 重击被打断：-10 -> -5
```

不要在 P0 做复杂弹窗、时间轴、意图说明页。需要的是出牌前可读、出牌后可验证。

## 3. 测试设计

### 3.1 Sim 单元测试

1. `declares one charged strike for the scripted front-row brute`
   - Arrange：进入指定短切片回合，前排含至少一个 `redline_brute`。
   - Assert：只有一个 intent 为 `kind: 'charged-strike'`，`amount = 10`，`counterThreshold = 12`。
   - Assert：另一个 Brute 仍是 `kind: 'attack'`，`amount = 5`。

2. `resolves charged strike amount when ignored`
   - Arrange：声明重击后不攻击该 Brute，直接结束回合。
   - Assert：玩家 HP 减少等于 `enemyIntentSummary.totalDamage`。
   - Assert：`EnemyAttacked.amount` 对重击 Brute 是 10，不是 `enemy.damage` 的 5。
   - 这是最重要的防回归测试，避免 UI 预览 -10、runtime 实际只扣 -5。

3. `downgrades charged strike after nonlethal threshold damage`
   - Arrange：目标 Brute HP 22，手牌 `debt_hook`、`heartbeat_spark`。
   - Act：`Debt Hook` 打 4，再按链路打 `Heartbeat Spark`，本回合累计伤害达到 12+ 且 Brute 未死。
   - Assert：该 intent `amount = 5`、`state = 'downgraded'`。
   - Assert：产生 `EnemyIntentCountered`。
   - Assert：总意图从 22 降到 17。

4. `lethal damage cancels charged strike`
   - Arrange：目标 Brute HP 22，手牌 `debt_hook`、`redline_cut`。
   - Act：`Debt Hook` 打 4，`Redline Cut` 接链打 18。
   - Assert：Brute 死亡，重击 intent 不再存在。
   - Assert：总意图从 22 降到 12。

5. `wrong target does not counter charged strike`
   - Arrange：重击 Brute 存在，玩家把同等伤害打到 Wisp 或 Collector。
   - Assert：Brute intent 仍为 `charged-strike -10`。
   - Assert：卡牌有伤害收益，但没有 `EnemyIntentCountered`。

### 3.2 HUD helper 测试

1. `hudCardIntentPreview labels lethal charged strike cancellation`
   - 输入含 `charged-strike -10` 的 snapshot。
   - 单体卡足以击杀 Brute 时，返回 `BRU 取消 22->12`。

2. `hudCardIntentPreview labels nonlethal charged strike downgrade`
   - Brute 当前 `counterProgress = 4`，选中卡预计造成 8+。
   - 返回 `BRU 打断 22->17`。

3. `defaultHudFrontTargetId prefers charged strike over lower HP enemies`
   - 前排有低血 Wisp 和重击 Brute。
   - Assert：默认目标是重击 Brute，除非玩家手动选择其他目标。

4. `self cards keep repair framing`
   - `pulse_draw`、`wild_mana_stitch` 不显示虚假的 intent delta。
   - 继续显示 `抽牌找解`、`返MP找解`。

### 3.3 浏览器 smoke / 布局测试

只加一条小 smoke，不扩完整 E2E：

- 桌面和 390x844 移动视口进入重击回合。
- 展开前排 peek。
- 断言可见文本包含：
  - `重击 -10`
  - `打断 0/12` 或当前进度
  - 卡牌按钮中的 `BRU 打断` / `BRU 取消`
  - `结束回合 -22`
- 断言 `.enemy-peek`、`.card-row`、`.card-intent-preview` 没有关键文字溢出到 viewport 外。

## 4. 实现切面建议

这不是源码修改要求，只是给实现 worker 的切面顺序：

1. 扩 `EnemyIntent` 类型和 `EnemyIntentCountered` 事件。
2. 在 intent 声明处生成一个 scripted `charged-strike`。
3. 在伤害应用后更新该 intent 的 `counterProgress`，达到阈值就降级。
4. 修正敌人攻击结算，确保使用 intent amount。
5. 扩 HUD helper 的 intent preview，先支持 lethal cancel 与 nonlethal downgrade。
6. 扩前排 slot 文案和战斗信息。
7. 补 sim 与 HUD helper 测试，再跑一次移动端 smoke。

## 5. P1 生态

P1 才把敌人意图扩成生态，不进入本次 P0：

| 方向 | 作用 | 依赖 |
| --- | --- | --- |
| 护盾 / 护卫意图 | 让玩家选择先破盾、绕过或清护卫 | shield/status 字段、破盾牌或穿透牌 |
| 诅咒 / 状态污染 | 不处理敌人会污染下一轮抽牌 | 状态牌、弃牌堆/抽牌堆注入、cleanse |
| 召唤 / 封槽 | 把队列补位变成机制压力 | 召唤规则、槽位封锁、生成事件 |
| 反击姿态 | 让 attack / skill 类型分工更明确 | 反伤事件、技能绕过规则 |
| 后排仪式 | 让前排清理和全场 payoff 影响后排风险 | 后排可读 UI、穿透或全场打断 |
| 玩家防御牌 | 允许“不杀敌也承压” | block/ward 资源和回合末清空 |
| 敌人意图调度器 | 3-5 回合内安排普通攻击、重击、诅咒、召唤的节奏 | 至少 2-3 个已验证意图后再做 |

P1 的入口必须复用 P0 形成的统一结构：`telegraph -> card preview -> counter event -> settlement proof`。

## 6. 暂缓项

- 暂缓 10 个意图模板同时落地。
- 暂缓新增一批敌人。
- 暂缓新增专门打断牌、清除牌、防御牌。
- 暂缓完整 buff/debuff/status 系统。
- 暂缓诅咒、召唤、反击、后排仪式。
- 暂缓敌人 AI 调度器和多回合行为树。
- 暂缓把卡牌系统迁到完整效果解释器。
- 暂缓 realtime 自动扣血、实时倒计时和固定 60 秒 burst。

## 7. 验收口径

P0 完成时，只验下面四件事：

1. 玩家能在结束回合前看到一个 Brute 的 `重击 -10` 和总意图。
2. 卡牌按钮能在出牌前区分 `取消`、`打断`、`意图仍在`。
3. runtime 结算和 UI 预览一致：忽略扣 10，打断扣 5，击杀扣 0。
4. 目标选择有意义：打错目标不能误触发重击打断。

如果这四件事成立，敌人意图系统就从“显示伤害”跨到了“可反制动作”。后续再扩生态才有共同接口。
