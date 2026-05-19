# 2026-05-18 Round 02-08：Payoff 与压力数值复核

角色：第 2 轮专家 08，Payoff 与压力数值复核师  
范围：只读复核当前 3 费 payoff、2 费 front-row、临时授权、首奖阈值；不修改源码，不提交 git。  
产物目标：提出一套 P0 参数探针，让未授权 payoff 不抢走链路价值，同时 armed payoff 仍然爽。

## 1. 当前数值读数

| 项 | 当前值 | 复核结论 |
| --- | --- | --- |
| 基础资源 | `maxEnergy = 3`，每回合发牌回满当前 MP | P0 应继续保持，不用最大 MP 成长解释 3 费 payoff。 |
| 临时授权 | 完成未断裂 `0 -> 1 -> 2` 后 `tempAuthorizationMP += 3`，`payoff-only`，离开玩家回合清空 | 方向正确，但 P0 需要更硬的验收：armed payoff 必须实际消耗授权，不能只因授权存在而语义上变强。 |
| 2 费 front-row | `row_cleave = 5`，`clearance_order = 7`，正确链 x3 后为前排 15 / 21 | `row_cleave` 健康；`clearance_order` 已接近 mini-payoff，建议作为探针下调到 6 或限制其验收结果不能清空全部意图。 |
| 3 费 payoff | `severance_burst = 16 all-enemies`，`red_ledger_burst = 12 all-enemies` | 当前最大问题：未授权 x1 也很强。`severance_burst` 未 armed 可杀 10 HP 与 16 HP 敌型，等于抢走链路价值。 |
| 敌人前排压力 | 初始前排 `10/22/16/10/22 HP`，意图 `2+5+3+2+5 = 17` | 压力本身够用；真正错位的是未授权 payoff 太强、首奖太晚。 |
| 首奖阈值 | 初始 `xpThreshold = 45`，runtime 表为 `[0,18,42,78,125,185]` | 45 让 3-5 回合几乎看不到奖励，且首奖后可能回退到 42。P0 必须改为单调阈值。 |

一句话判断：当前链路段已经能救场，压力不是完全不足；P0 应先把 payoff 分成未授权低收益与 armed 高收益两档，再把首奖放进 3-5 回合。

## 2. P0 参数探针总表

| 探针 | 参数建议 | 目的 | 预期 |
| --- | --- | --- | --- |
| P0-A：payoff armed / unarmed 分档 | 保留 `severance_burst.baseDamage = 16`、`red_ledger_burst.baseDamage = 12`；新增或等价实现 `unarmedPayoffScalar = 0.4-0.5`，`armedPayoffScalar = 1.0` | 不砍 armed 爽感，只压低未授权收益 | 未授权全场约 6-8 / 5-6 伤害，不清前排；armed x4 仍为 64 / 48，全场终结感保留。 |
| P0-B：armed 判定硬化 | `armedPayoff = authorizationPaid > 0`；payoff 支付时优先消耗 `tempAuthorizationMP`；`tempAuthorizationMPCap = 3` | 避免当前 MP 足够时出现“没花授权但显示 armed”的灰区 | 只有完成本回合 `0 -> 1 -> 2` 并实际动用授权的 3 费 payoff 才进入高收益档。 |
| P0-C：2 费前排保持 mini-payoff | `row_cleave.damage = 5` 保持；`clearance_order.damage = 7 -> 6` 作为首选探针，若不改数值则验收要求它不能单独清空本回合意图 | 2 费段负责授权和减压，不负责最终清场 | 正确链后敌意图降一半以上，但仍留下 5-10 压力，让 3 费 payoff 有存在价值。 |
| P0-D：首奖阈值进入 3-5 回合 | `initialRewardXpThreshold = 10`；阈值表改为 `[0,10,24,45,72,110]`。若想把首奖推迟到第 3 回合，备选首阈值 12 | 让奖励参与压力修补闭环 | 两轮有效清前排后自然看到首奖；首奖后下一阈值一定大于当前 XP。 |
| P0-E：敌压先不加码 | 初始敌人伤害先保持 `2/5/3`；只有当 P0-A 后正确链仍过稳，再试 `pulse_collector.damage = 3 -> 4` | 避免同时改 payoff 与敌压，导致无法归因 | 初始意图仍为 17；正确链后 7-10，错误路线仍 12-17。 |

首选组合：P0-A + P0-B + P0-C 的 `clearance_order = 6` + P0-D 的首阈值 10。  
保守组合：只做 P0-A + P0-B + P0-D，`clearance_order` 先不动，但验收必须盯住 2 费段是否清空意图。

## 3. 预期回合结果

### 3.1 Turn 1：正确链应该减压但不终结

起始前排：

| 槽位 | 敌人 | HP | 意图 |
| --- | --- | ---: | ---: |
| 1 | Wisp | 10 | 2 |
| 2 | Brute | 22 | 5 |
| 3 | Collector | 16 | 3 |
| 4 | Wisp | 10 | 2 |
| 5 | Brute | 22 | 5 |

默认起手 `debt_hook -> redline_cut -> row_cleave`：

- `debt_hook` x1 = 4 单体。
- `redline_cut` x2 = 18 单体。
- `row_cleave` x3 = 前排 15。
- 预期杀 3 个左右，剩余意图约 8；玩家 End Turn 后 HP 从 60 到约 52。

如果用奖励牌 `clearance_order` 替代 `row_cleave`：

- 当前 7 伤害时 x3 = 21，容易杀 4 个、剩余意图约 5。
- 建议探针 6 伤害时 x3 = 18，仍明显强于 `row_cleave`，但不应稳定把本回合意图降到 0。

验收口径：2 费 front-row 是授权段和强减压段，不是 3 费 payoff 的替代品。

### 3.2 Turn 1 / Turn 2：未授权 payoff 应该是错误诱惑

玩家如果起手或断链后直接打 3 费 payoff：

| 牌 | 当前未授权结果 | 探针后未授权结果 |
| --- | --- | --- |
| `severance_burst` | x1 = 16 全场，直接杀 Wisp 和 Collector，当前阵型约杀 10/15 | x1 约 6-8 全场，不杀健康 Wisp，不显著降低本回合意图 |
| `red_ledger_burst` | x1 = 12 全场，杀 Wisp，压低 Collector | x1 约 5-6 全场，只做铺垫，不承担清场 |

预期结果：

- 未授权 payoff 可以打，但应该像“提前引爆失败”，不是正确答案。
- `preventedIntentDamage <= 3-5`。
- 当前回合仍会吃大部分前排意图，通常 HP 至少掉 12。
- 不产生 `AuthorizationGranted`，不进入 armed 高收益档。

### 3.3 Turn 2 / Turn 3：断链要能出牌，但不能拿授权

示例错误路线：`debt_hook -> row_cleave` 或 `row_cleave -> debt_hook -> redline_cut`。

预期结果：

- 卡牌仍成功打出，避免“禁牌感”。
- `effectMultiplier` 回到 1，`AuthorizationGranted` 不出现。
- 2 费前排 x1 只造成 5 或 6，不应清掉健康前排。
- End Turn 后剩余意图应在 12-17 区间，玩家能感到“我活着，但亏了”。

### 3.4 Turn 3 / Turn 4：armed payoff 仍然要爽

成功路线：`0 -> 1 -> 2 -> 3 payoff`。

推荐事件口径：

1. 第三张 2 费段后产生 `AuthorizationGranted`，`tempAuthorizationMP = 3`。
2. 3 费 payoff 支付时先扣授权，记录 `authorizationPaid >= 1`，最好为 3。
3. `payoffArmed = true`，使用 `armedPayoffScalar = 1.0`。
4. `severance_burst` x4 = 64 全场；`red_ledger_burst` x4 = 48 全场。

预期结果：

- 正常敌人阵型：当前前排全部清除，后排大幅残血或被清。
- 高压测试阵型：即使敌人 HP 被抬到 70，前置 `0/1/2` 伤害加 `severance_burst` 64 也应能清掉当前前排，形成救场。
- `preventedIntentDamage` 等于或接近出 payoff 前的当前意图，End Turn 后 HP 不下降。
- 视觉和日志都应能解释：爽点来自“链路成立 + 授权支付 + armed payoff”，不是抽到 3 费大牌。

### 3.5 Turn 3-5：首奖必须回应压力

用首阈值 10 的预期：

- Turn 1 正确链通常获得约 4 XP，不触发首奖。
- Turn 2 再处理一波前排后累计 XP 接近或超过 10，进入首奖。
- Turn 3-5 之间玩家至少看到一次三选一，分支覆盖：修补资源、payoff、路线桥接。
- 选择奖励后，下一回合或下一次 draw 必须能看到这张牌进入可操作资源；否则阈值提前了，反馈仍然晚。

阈值备选：

- `10`：更适合固定 5 回合 demo，能稳进奖励闭环。
- `12`：更克制，适合不想 Turn 2 过早进入奖励界面。
- 不建议 `18` 或 `45` 作为 P0 首奖；18 可能偏晚，45 基本把奖励排除在核心体验外。

## 4. 关键风险

1. 只改 3 费基础伤害会误伤 armed 爽感。  
   如果把 `severance_burst 16 -> 8` 作为纯数据改动，armed x4 会从 64 变成 32，高压测试和救场感都可能崩。更优先的是 armed / unarmed scalar 分档。

2. `clearance_order` 现在的 21 前排伤害太接近终局结算。  
   它作为奖励 2 费可以强，但不能稳定替代 3 费 payoff。若不下调到 6，验收必须明确它清的是“当前前排大部分压力”，不是“最终清场高潮”。

3. 授权支付顺序会影响玩家理解。  
   当前资源模型若保持 current MP 优先支付，可能出现有授权但实际没花授权的边界。P0 最好让 payoff 优先花授权，或者至少让 armed 判定绑定 `authorizationPaid > 0`。

4. 首奖阈值只改数字还不够。  
   当前奖励加入 deck / drawPile 后，如果发牌顺序让玩家下一手看不到新牌，奖励仍然不像压力回应。P0 QA 要同时检查“触发奖励”和“奖励进入可操作资源”。

5. 同时加敌压会污染调参结论。  
   在未授权 payoff 降档前，不要先提高敌人伤害。否则玩家死亡更快，但问题根因仍可能是 payoff / 奖励错位。

6. 事件字段可能互相矛盾。  
   `PayoffTriggered.enhanced`、`payoffArmed`、`authorizationPaid` 必须讲同一个故事。验收不应只看 `enhanced: true`，要看是否真的 armed 且付了授权。

## 5. 验收指标

### 5.1 Payoff 指标

- 未授权 `severance_burst` 首打：击杀数 `<= 1`，建议为 0；`preventedIntentDamage <= 5`。
- 未授权 `red_ledger_burst` 首打：击杀数 `= 0` 或只杀已残血目标；不能自然清 Wisp。
- armed `severance_burst`：当前前排击杀 `>= 5`，或 `preventedIntentDamage >= 12`，End Turn 后玩家 HP 不下降。
- armed 与 unarmed 的差异必须体现在实际伤害 / 击杀 / 避免意图上，不能只体现在事件字段上。

### 5.2 2 费 front-row 指标

- `row_cleave` 正确链 x3 后，初始意图 `17 -> 7-10`。
- `clearance_order` 正确链 x3 后，初始意图可降到 `5-10`，但不应稳定降到 0。
- 断链后的 2 费 front-row x1 不应杀健康 Wisp，剩余意图应 `>= 12`。

### 5.3 临时授权指标

- 只有未断裂 `0 -> 1 -> 2` 或 Wild 明确修补后的等价链，才产生 `AuthorizationGranted`。
- 授权数值固定为 `tempAuthorizationMP = 3`，本回合有效，不跨 End Turn。
- 授权限制为 `payoff-only`，不能支付 2 费 front-row、普通攻击或抽牌。
- armed payoff 支付事件必须记录 `authorizationPaid > 0`；若没有花授权，则按 unarmed 结算。
- 用完授权后 `tempAuthorizationMP = 0`，`payoffArmed = false`。

### 5.4 首奖阈值指标

- 默认固定 seed 下，3-5 回合内自然触发一次 Reward。
- 首奖后下一阈值必须大于当前 XP，不能出现 `45 -> 42` 的回退。
- Reward choices 至少覆盖三类：修补资源、payoff、路线桥接。
- 选择奖励后，下一回合或下一次 draw 能看到奖励牌成为可操作资源。

### 5.5 压力曲线指标

- 空过 3 次 End Turn 后，玩家 HP 应落在 6-15 或进入濒死；第 4 次应失败或接近失败。
- 正确链相对空过至少保存 7 HP。
- 断链路径能继续出牌，但总收益低于正确链 70%，且没有授权。
- armed payoff 相对未授权 payoff 至少多避免 10 点本回合意图，或多击杀 4 个当前前排 / active intent 目标。

## 6. 结论

P0 不需要把敌人整体加硬，也不需要引入最大 MP 成长。当前最该验证的是一组窄参数：

1. 保留 3 费 payoff 的 armed 高上限。
2. 给未授权 payoff 加 0.4-0.5 的低收益档。
3. 让 armed 判定绑定实际临时授权支付。
4. 让 2 费 front-row 停在 mini-payoff 位置。
5. 把首奖阈值改到 10 左右，并保持后续阈值单调。

这组探针能把玩家的正确学习路径固定为：先读前排压力，打出 `0 -> 1 -> 2` 减压并获得授权，再用 armed payoff 清掉高压局面。未授权 payoff 仍然是诱惑，但不再是绕过链路的正确答案。
