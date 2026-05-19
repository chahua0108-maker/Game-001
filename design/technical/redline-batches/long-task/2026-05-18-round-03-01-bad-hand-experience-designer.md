# 2026-05-18 Round 03-01：坏手体验设计师

角色：第 3 轮专家 01，坏手体验设计师  
工作目录：`/Users/roc/Game-001`  
范围：只读当前 `prototype-web` 代码与 long-task 前两轮文档；不修改源码、不提交 git。  
产物边界：诊断当前 4 张起手与后续抽牌能否制造“坏手 -> 修补”的卡牌体验，并提出一个 P0 固定短切片。

## 0. 一句话结论

当前默认起手不能制造真正的“坏手 -> 修补”体验。

原因不是修补机制不存在，而是当前发牌和卡池让玩家很少自然遇到需要修补的手牌：

- 默认 4 张起手是 `debt_hook / heartbeat_spark / redline_cut / row_cleave`，费用为 `0 / 1 / 1 / 2`，稳定包含 `0 -> 1 -> 2`。
- `HAND_SIZE = 4`，初始 `deck` 和 `drawPile` 都等于这 4 张；没有奖励时，后续抽牌基本还是同一组牌。
- `blood_tithe`、`pulse_draw` 这两张抽牌修补目前是 `reserve-test`，不在奖励池里。
- `wild_mana_stitch`、`wild_gap_key` 在奖励池里，但首奖阈值当前是 `45`，3-5 回合内很难自然出现。
- 即使选到奖励，当前非终局奖励流程是先 `DealHand`，再 `AddCardToDeck`，所以刚选的修补牌不会立刻进入下一手。

P0 不应新增随机洗牌、状态牌、CardInstance、完整效果解释器。最小短切片建议只做一个固定体验：**缺 2 费用段的坏手，用 Wild 修补成 `0 -> 1 -> 2`，再消费本回合授权打出 3 费终结。**

## 1. 当前事实基线

### 1.1 当前默认起手是稳定链，不是坏手

当前 `startingHand`：

```text
debt_hook        0 费 开链
heartbeat_spark 1 费 承接
redline_cut     1 费 承接
row_cleave      2 费 授权段
```

这手牌的设计价值是教学：玩家至少能找到一条 `0 -> 1 -> 2`。但它的问题是：

- 有两个 1 费，玩家会面对“选哪张 1 费”的小选择，而不是“缺一个关键段怎么办”的坏手。
- 没有 3 费 payoff，玩家完成授权后不能立刻消费授权。
- 没有 Wild 或 draw fixer，玩家看不到“修补”带来的逆转。
- 如果玩家按正确顺序打出 `0 -> 1 -> 2`，系统会奖励正确牌序；如果乱打，则只是断链惩罚，不是“坏手修补”。

### 1.2 后续抽牌也很难自然变坏

当前 `HAND_SIZE = 4`，初始 `deck/drawPile` 都是同一组 4 张起手牌。发完第一手后 `drawPile` 为空，回合末靠 `discardPile` 回填。

结果是：

```text
没有奖励牌进入时：
  每回合基本重新拿回同一组 0/1/1/2。

有奖励牌进入时：
  牌库变成 5 张以上，才可能出现缺段手。
  但当前奖励牌在非终局节点是先发下一手，再加入 drawPile。
```

所以当前系统不会稳定制造“我这一手缺 2，但可以用修补牌补上”的体验。

### 1.3 修补机制已经有雏形

当前 runtime 里已经有可用的修补基础：

- Wild 牌在链已经开始后，会按当前 `nextExpectedCost` 记为缺口费用。
- Wild 修补成功会发 `ChainRepaired`。
- 如果修补后形成 `0 -> 1 -> 2`，会发 `AuthorizationGranted`。
- 3 费全场 payoff 可以使用 `tempAuthorizationMP` 支付，并记录 `authorizationPaid` / `payoffArmed`。

也就是说，P0 不缺机制底座，缺的是一个稳定把玩家送进“缺口 -> 修补 -> 终结”的发牌切片。

## 2. 坏手类型诊断

| 坏手类型 | 当前能否自然出现 | 当前问题 | 推荐修补方式 | P0 取舍 |
| --- | --- | --- | --- | --- |
| 缺 1 费桥接：`0 / 2 / payoff / filler` | 基本不能 | 默认起手有两个 1 费；奖励后也不保证 payoff 和修补同手 | `wild_mana_stitch` 在 0 后视为 1，接 2 | 可读，但 `wild_mana_stitch` 有抽牌和返 MP，变量偏多 |
| 缺 2 费授权段：`0 / 1 / repair / payoff` | 当前不能稳定自然出现 | 默认起手有 `row_cleave`；`wild_gap_key` 不在默认手 | `wild_gap_key` 在 `0 -> 1` 后视为 2，授予 payoff 授权 | **P0 首选**，最干净 |
| 有授权段但无 payoff：`0 / 1 / 2 / filler` | 当前第一手就是这个问题 | 它更像“缺终结”，不是坏手修补；玩家只能等后续奖励 | 通过奖励或过牌找 payoff | 作为奖励节奏问题，不做本切片主目标 |
| 有 payoff 但无链路：`payoff / 1 / 1 / 2` | 当前默认没有 payoff | 未授权 payoff 当前数值偏强，容易绕过链路教学 | 降低未授权收益，或用 Wild 补链后再 payoff | 与 payoff tuning 相关，不混进本 P0 |
| 只有抽牌找解：`0 / draw / 2 / payoff` | 当前 `blood_tithe/pulse_draw` 不可见 | 抽牌修补需要稳定 staged drawPile，否则可能只抽回旧牌 | `pulse_draw` 找 2 或 payoff | P1，再做 draw-fixer slice |

P0 应先选“缺 2 费授权段”这一种，因为它只依赖现有 Wild 修补和授权/payoff，不依赖随机、不依赖奖励三选一、不依赖新牌区。

## 3. P0 固定短切片

### 3.1 切片名称

```text
缺 2 修补 -> 授权终结
```

### 3.2 固定 4 张手牌

```text
debt_hook          0 费，开链
redline_cut       1 费，承接
wild_gap_key      1 费，Wild 修补，作为缺失的 2 费段
severance_burst   3 费，payoff 终结
```

这手牌故意没有自然 2 费牌。

玩家看到的是：

```text
我有 0 和 1，也有终结牌，但没有 2 费授权段。
wild_gap_key 看起来只有 1 费，但它写着“修补”。
正确打法是 0 -> 1 -> Wild 修补为 2 -> 终结。
```

### 3.3 正确路线

```text
1. debt_hook
   - playedCost = 0
   - nextExpectedCost = 1

2. redline_cut
   - playedCost = 1
   - nextExpectedCost = 2

3. wild_gap_key
   - printed cost = 1
   - repairedCost = 2
   - 产生 ChainRepaired
   - 形成 0 -> 1 -> 2
   - 产生 AuthorizationGranted，tempAuthorizationMP = 3

4. severance_burst
   - 使用 current MP + tempAuthorizationMP 混合支付也可接受
   - authorizationPaid > 0
   - payoffArmed = true
   - 结算 PayoffResolved，明显降低本回合敌意图
```

### 3.4 错误路线

同一手牌如果没有理解修补：

```text
debt_hook -> redline_cut -> severance_burst
```

在当前费用下，玩家通常没有足够 MP 支付 3 费 payoff；即使未来允许某种未授权提前引爆，也应该按第 2 轮数值建议降低未授权收益，不能让它绕过修补链路。

另一条错误路线：

```text
severance_burst 先打
```

它可以作为诱惑，但不应成为最优解。第 2 轮已经指出未授权 payoff 偏强；本切片验收只要求修补路线显著优于未修补路线，不在本批次扩 payoff 数值系统。

## 4. 最小卡池 / 发牌调整

### 4.1 P0 最小卡池

P0 只需要 4 张现有牌：

| 牌 | 来源 | 用途 |
| --- | --- | --- |
| `debt_hook` | 当前 starting | 0 费开链 |
| `redline_cut` | 当前 starting | 1 费承接 |
| `wild_gap_key` | 当前 reward | 缺 2 修补 |
| `severance_burst` | 当前 reward | 授权终结 |

不需要新增牌。

不建议把 `blood_tithe`、`pulse_draw` 同时拉进 P0。它们适合下一步做“抽牌找解”切片，但会把本轮问题从“Wild 修补费用缺口”扩成“抽牌堆顺序、重洗、抽牌倍率、奖励入牌”的复合问题。

### 4.2 P0 发牌方式

推荐把它作为固定短切片或验收 fixture，而不是立刻替换正常第一手教学。

最小发牌口径：

```text
hand = [
  debt_hook,
  redline_cut,
  wild_gap_key,
  severance_burst
]

drawPile = []
discardPile = []
energy = 3
gameFlow = PlayerTurn
front row = 当前默认前排
```

如果必须接入真实 run，而不是测试 fixture，则只做很小的产品化处理：

```text
Round 1：保留当前默认教学手 0/1/1/2
Round 2 或首奖后：强制发一次 bad-hand slice
```

不要为了这一个切片上随机种子、复杂洗牌、保留牌、状态牌或动态发牌器。

### 4.3 为什么不直接依赖当前 reward loop

用当前 reward loop 做“自然坏手修补”会同时踩到三个未收敛点：

1. 首奖阈值当前太高，玩家很难在 3-5 回合自然拿到修补牌。
2. 奖励选择后当前流程先发下一手，再把奖励牌放入 `drawPile`，反馈至少延后一手。
3. 即使奖励立刻进手，也不保证这手牌缺 2；如果手里同时有 `row_cleave`，修补牌就变成锦上添花，不是救场。

所以第 3 轮 P0 应先用固定短切片证明体验，再把奖励节奏和入牌顺序作为后续实现问题。

## 5. 修补方式文案

P0 卡面和 HUD 需要让玩家读到三件事：

```text
坏在哪里：缺 2 费授权段。
怎么补：Wild 可按当前缺口费用接链。
补完得到什么：完成 0 -> 1 -> 2，获得本回合 payoff 授权。
```

建议 `wild_gap_key` 的战斗内短文案保持非常短：

```text
修补缺口。造成1。
```

详情或 tooltip：

```text
修补：若本回合正在接链，按当前缺口费用计算链路；支付仍按牌面费用。
```

HUD 状态可以显示：

```text
缺口：2
Wild 可修补
修补后：授权+3，仅本回合 payoff 可用
```

不要写成“获得最大 MP”或“永久成长”。

## 6. 测试验收

### 6.1 核心 sim 验收

固定 hand：

```text
debt_hook -> redline_cut -> wild_gap_key -> severance_burst
```

必须满足：

- `wild_gap_key` 产生 `ChainRepaired`。
- `ChainRepaired.repairedCost === 2`。
- `wild_gap_key` 后产生 `AuthorizationGranted`。
- `AuthorizationGranted.tempAuthorizationMP === 3`。
- `severance_burst` 的 `CardPlayed.payoffArmed === true`。
- `severance_burst` 的 `authorizationPaid > 0`。
- `PayoffResolved.preventedIntentDamage > 0`。
- 结束回合后，玩家没有因为本回合已被 payoff 清掉的 active intent 掉血。

### 6.2 负例验收

固定 hand 但把 `wild_gap_key` 换成普通 1 费或跳过修补：

```text
debt_hook -> redline_cut -> heartbeat_spark
```

必须满足：

- 第三张普通 1 费不能被当成 2 费。
- 产生 `ChainBroken` 或至少不产生 `AuthorizationGranted`。
- `severance_burst` 不能以 armed payoff 结算。
- 修补路线比未修补路线至少多避免 8-10 点本回合意图，或至少多清掉 3 个当前有意图目标。

### 6.3 UI / 读牌验收

- 390x844 和 360x640 下，`wild_gap_key` 卡面能看到“修补”。
- 玩家不打开 debug，也能从 HUD 看到当前缺口是 2。
- 打出 `wild_gap_key` 后，HUD 能看到授权已打开，且授权是本回合 / payoff-only。
- `severance_burst` 付款提示必须显示可用授权，不暗示永久 MP。

### 6.4 不做项验收

本 P0 完成时仍然不应出现：

- 新随机洗牌系统。
- `CardInstanceId`。
- `exhaustPile / retainedCards`。
- 状态牌、诅咒牌、净化。
- 通用效果解释器。
- 大量新卡。
- 新敌人意图系统。
- 局外成长或永久 Max MP。

## 7. 后续但非 P0

这个固定切片通过后，下一步才适合拆两个独立主题：

1. 奖励节奏：首奖阈值、下一阈值单调、奖励牌是否进入下一手。
2. 抽牌修补：开放 `blood_tithe / pulse_draw`，并用 staged drawPile 验证“抽牌找 2 费或 payoff”。

不要把这两件事混进本 P0。否则第 3 轮会同时调发牌、奖励、抽牌、payoff 数值和 UI，无法判断“坏手修补”到底是否成立。

## STATUS: DONE

路径：`/Users/roc/Game-001/design/technical/redline-batches/long-task/2026-05-18-round-03-01-bad-hand-experience-designer.md`
