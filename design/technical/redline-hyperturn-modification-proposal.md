# Redline Hyper-Turn 修改方案审核稿

日期：2026-05-18
状态：待用户审核
范围：只定义下一轮修改方案，不直接修改 `prototype-web` 代码。
背景：上一批 `Redline 90s realtime heartbeat` 把压迫做成自动攻击、实时推进、实时扣血和固定 60 秒爆发。用户反馈“核心体验当中的压迫不对，他还是卡牌游戏”，要求按照上一轮原本机制重新调研竞品，并从游戏设计、游戏体验两个专家视角给出成套修改方案。

## 当前裁决

上一批实时压迫模型判定为：

```text
pressure model failed
```

失败原因不是测试没过，而是模型偏离竞品：

- `Vampire Crawlers` 的快感不是实时自动输出。
- 它是超高速回合制卡牌压力：抽牌、费用、升序 combo、Wild/draw/mana 修补、敌人意图、回合后果、构筑爆发。
- 玩家可以慢慢想，也可以快速把整手牌打完；关键是每一张牌的顺序和链路收益。

下一轮目标改为：

```text
Redline Hyper-Turn Card Pressure Slice
```

## 两类专家镜头

### A. 游戏设计 10 镜头

| # | 镜头 | 设计问题 | 当前诊断 | 修改建议 | 判定 |
|---:|---|---|---|---|---|
| 1 | Vampire Crawlers: hyper turn-based card-driven | 快感来自实时压力，还是回合内高速出牌 | `runtime.ts` 仍有自动攻击、实时推进、60 秒脚本爆发 | 取消自动攻击底盘；`advance-time` 只服务动画/输入节奏，伤害主要来自出牌 | 必须改 |
| 2 | Slay the Spire: 意图可读性 | 玩家是否知道“不解决会付出什么代价” | 敌人攻击与实时推进混在一起，后果不结构化 | 每个前排敌人显示本回合意图；结束回合按意图结算 | 必须改 |
| 3 | Into the Breach: 公开后果 | 玩家做解题，不猜隐藏反应 | 实时进线扣血变成后台计时器 | 前置展示下回合伤害、危险列、boss 倒计时 | 必须改 |
| 4 | Magic 费用曲线 | 费用系统是否制造选择 | 已有 `0 -> 1 -> 2 -> 3` 逻辑，但未显性化 | HUD 显示当前链路；高费牌接在链后才爆发；乱打收益低 | 必须改 |
| 5 | Dominion / Deckbuilder | 牌库是否是引擎 | 有 draw/discard/reward，但起手和奖励像演示脚本 | 第一局压缩“小引擎”：0 启动、1 承接、2 展开、3 终结 | 必须改 |
| 6 | Balatro: 规则破坏件 | 爆发是否来自系统例外 | 60 秒 `REDLINE_BURST_DAMAGE=99` 是脚本胜利 | 删除固定 burst；用 Wild、复制、抽牌、返费、倍率推长一回合 | 必须改 |
| 7 | FTL / 短周期危机 | 压力是否分层递增 | 回合制和实时制混用，危机来源不聚焦 | 每场遭遇三层压力：前排本回合伤害、后排补位、boss/精英倒计时 | 必须改 |
| 8 | Sid Meier: 有趣选择 | 每张牌是否有可比代价 | 部分牌只是低伤害或抽 1 | 每回合至少两条路线：保命、贪链、用 Wild 修链 | 可选改 |
| 9 | MDA 反馈闭环 | 规则结果是否可见 | 视觉反馈还没打出“链成立” | 展示 chain multiplier、断链原因、payoff 增幅、敌人意图减少 | 必须改 |
| 10 | Vampire Survivors 构筑失控 | 爽感是否来自成长曲线 | 奖励池存在，但未形成“快崩盘 -> 修补 -> 长链清场” | 90 秒验证一次缺桥牌 -> 奖励拿 Wild/draw -> 3 费终结清场 | 必须改 |

### B. 游戏体验 10 镜头

| # | 镜头 | 玩家感受 | 当前诊断 | 修改建议 | 判定 |
|---:|---|---|---|---|---|
| 1 | Vampire Crawlers: Hyper turn-based | 我在高速打牌，不是在等系统打 | `Burst / Clear`、压线、连杀导演感像动作 demo | HUD 主语改成“本回合链路”：`0 -> 1 -> 2`、下一张期望、断链代价 | 必须改 |
| 2 | Slay the Spire: 意图先行 | 我知道不处理会受什么伤 | “5 前排压线”不够说明结束回合会掉多少 HP | 显示敌人意图总伤害、前排单体意图、End Turn 后果预览 | 必须改 |
| 3 | Balatro: 一眼看到最佳手 | 我看到一条诱人路线，不是慢慢算账 | 热键比 MP 成本更抢眼 | MP cost 放大；可接链卡发光；断链卡危险色；payoff 显示接链收益 | 必须改 |
| 4 | Into the Breach: 责任清晰 | 我能预测、能负责、能复盘 | 随机前排目标削弱责任感 | 首轮减少随机目标；默认目标预览伤害落点 | 必须改 |
| 5 | Monster Train: 空间压力 | 敌群在压，但压力是回合后果 | 空间威胁和卡牌选择未绑定 | 默认展示前排意图条；卡牌 hover/选中预览命中范围和击杀结果 | 必须改 |
| 6 | Marvel Snap: 3-5 回合节拍 | 每回合都是一个小赌局 | QA 只证明可点，没证明缺口/修补/救场 | 固定前 5 回合脚本：成功链、断链、Wild/draw 修补、payoff 清前排 | 必须改 |
| 7 | Hades 房间节奏 | 我刚赢，马上变强 | 奖励三选一没有说明如何修补下一轮链路 | 奖励卡加用途标签：补 0、桥接 1、抽牌续链、终结 payoff | 必须改 |
| 8 | Vampire Survivors: 构筑爆发 | 爽是我构筑出来的 | `0/3 热度`像外部清场槽 | 改成“链长奖励”：x1/x2/x3 后终结牌变全场、溢出、抽牌或回血 | 必须改 |
| 9 | 移动端首屏 | 我能用拇指快速判断和出牌 | 390px 顶部状态裁切，链路信息被挤 | 移动端只保留 HP、MP、CHAIN、敌意图；牌堆/FSM/debug 全折叠 | 必须改 |
| 10 | 濒临崩盘后被我救回 | 我差点死，但这手牌救了我 | “救回来”不是由卡牌选择产生 | 安排 HP 低/敌意图高 -> 抽到修补件 -> 长链 -> payoff 清场 -> 奖励回应 | 必须改 |

## 新核心体验合同

### 0-30 秒

玩家必须立刻知道这是卡牌战斗，不是自动战斗。

最低成立条件：

- 3 秒内进入战斗并拿到手牌。
- 第一手牌能看出一条 `0 -> 1 -> 2` 或 `0 -> 1 -> payoff` 路线。
- 打对顺序的反馈明显强于乱点。
- 敌人意图清楚：结束回合前知道不处理会受什么伤。

### 30-90 秒

玩家经历 3-5 个短回合，理解费用顺序就是压力核心。

最低成立条件：

- 至少一次成功链。
- 至少一次断链危险。
- 至少一次 Wild / draw / mana / reorder 修补成功。
- 至少一次 payoff 因为链路成立而明显增幅。
- 没有自动攻击替玩家解决核心敌人。

### 5-8 分钟压缩段

可以压缩到 2 分钟 demo seed，但逻辑必须来自构筑：

```text
前几回合小 combo
  -> 敌人意图和 HP 压力增大
  -> 奖励拿到 Wild / draw / mana / gem-like 修补件
  -> 一回合长 chain
  -> payoff card 清前排或清场
  -> 奖励/结算回应这次构筑
```

## 成套修改方案

### 1. Runtime / Sim

必须回调：

- 删除自动攻击作为核心底盘。
- 删除敌人实时推进到压力线后扣血。
- 删除 60 秒固定 `red_ledger_burst`。
- `advance-time` 只保留为动画/输入节奏/调试计时，不产生核心伤害。

新增或改造：

- `EnemyIntent`：前排敌人每回合意图，包括伤害、特殊效果、是否会补位。
- `ChainState`：记录当前回合已打费用、下一张期望费用、chain multiplier、断链状态。
- `PayoffRule`：高费牌在 chain 后段获得增强，例如全前排、溢出、抽牌、回血、碎片回收。
- `BridgeCards`：Wild / draw / mana / reorder / copy，用于修补断链。
- `TurnResult`：回合结束时按敌人意图结算，并明确输出 trace。

### 2. Card / Data

首批卡牌应从“伤害列表”改成“链路角色”：

| 角色 | 示例 | 功能 |
|---|---|---|
| 0 费启动 | Debt Hook / Blood Reclaim | 开链，低伤害，可能拉目标或标记 |
| 1 费桥接 | Redline Cut / Heartbeat Spark | 承接链，制造主要单体伤害 |
| 2 费展开 | Row Cleave / Clearance Order | 打前排或制造范围压力 |
| 3 费 payoff | Severance Burst / Red Ledger | 只有接在链后才强，负责清前排或清场 |
| Wild 修补 | Wild Mana Stitch / Wild Gap Key | 缺费用时续链，损失基础伤害换链路稳定 |
| Draw / Mana | Pulse Draw / Paper Route | 延长回合，制造长 chain |

### 3. HUD / UX

必须把主语从“压线 / 热度 / debug”改成“链路 / 意图 / payoff”：

- 主 HUD：当前链路 `0 -> 1 -> ?`。
- 下一张期望费用：例如 `Next: MP2`。
- 可接链卡发光，断链卡危险色。
- 高费 payoff 卡显示：`接在 x3 后：前排清算`。
- End Turn 按钮附近显示：`未处理意图：将受 8 伤害`。
- Debug Trace 默认折叠。
- 移动端顶部只保留 HP、MP、CHAIN、敌意图。

### 4. Presentation / VFX

保留上一批不冲突的表现：

- 切割线。
- 击杀闪。
- 清场冲击。
- Debug 降权。
- 移动端主操作保护。

但表现触发条件要改：

- 不由自动攻击触发。
- 不由 60 秒时间脚本触发。
- 由 `CardPlayed`、`ChainAdvanced`、`PayoffTriggered`、`EnemyIntentResolved` 触发。

### 5. Acceptance Tests

废弃或降级：

- `redline-90s-acceptance.test.ts` 中对实时推进、无操作伤害、自动攻击、60 秒 burst 的断言。

新增：

```text
prototype-web/src/tests/sim/redline-hyperturn-acceptance.test.ts
```

测试应覆盖：

- 第一手牌能打出 `0 -> 1 -> 2`。
- 顺序正确时伤害 / payoff 明显高于乱序。
- 结束回合前能读到敌人意图总伤害。
- 断链时收益下降，但不必完全禁止出牌。
- Wild / draw / mana 能修补一次断链。
- 3-5 回合内出现一次构筑救场。

## 下一轮执行建议

### Batch H0：保存失败证据

- 把当前 realtime heartbeat dirty worktree 保存为 patch 或分支。
- 不直接删除，保留为“为什么这个方向失败”的证据。

### Batch H1：重写合同与测试

- 新增 `design/technical/redline-hyperturn-acceptance.md`。
- 新增 `prototype-web/src/tests/sim/redline-hyperturn-acceptance.test.ts`。
- 标记旧 `redline-90s-acceptance.md` 为 deprecated。

### Batch H2：回调 Runtime

- 移除自动攻击、实时扣血、60 秒 burst。
- 实现 EnemyIntent / ChainState / PayoffRule。
- 保持现有基本回合、发牌、敌人攻击、补位结构。

### Batch H3：HUD 改主语

- 把 HUD 从“当前威胁 + burst 进度”改成“本回合链路 + 敌意图后果”。
- 修移动端顶部状态条。

### Batch H4：3-5 回合脚本

- 设计固定 seed：
  1. 第一回合成功链。
  2. 第二回合断链危险。
  3. 第三回合 Wild / draw 修补。
  4. 第四回合 payoff 清前排。
  5. 奖励回应这条构筑。

## 明确不要做

1. 不要再做 realtime heartbeat 自动战斗底盘。
2. 不要用固定 60 秒 burst 伪装 build 爆发。
3. 不要把 UI 做成慢速卡牌桌面：长说明、大面板、频繁确认会杀掉 hyper-turn 速度感。
4. 不要把 15 槽敌阵和 debug trace 放在玩家主体验中心。
5. 不要继续扩卡牌数量；先让第一手和前 5 回合成立。

## 待用户审核的问题

1. 是否同意把当前 realtime heartbeat worktree 保存为失败 patch，而不是直接丢弃？
2. 是否同意下一轮以 `Redline Hyper-Turn Card Pressure Slice` 替代 `Redline 90s realtime heartbeat`？
3. 是否同意第一轮只做 3-5 回合固定 seed，不追求完整随机 run？
4. 是否同意保留上一批 HUD/VFX 中不冲突的切割线、清场冲击、debug 降权和移动端布局？
