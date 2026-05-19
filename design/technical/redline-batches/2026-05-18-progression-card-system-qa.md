# Redline Progression / Card System QA 验收清单

日期：2026-05-18

角色：Redline QA / 验收

范围：基于 `2026-05-18-progression-card-system-synthesis.zh.md` 和当前 `prototype-web` 代码，只补验收清单与自动化测试。本文不要求改 runtime、cards、types、HUD 或 CSS。

## 0. 本轮验收结论口径

P0 验收目标不是证明局外成长成立，而是证明：

```text
一手牌内读懂敌意图 -> 通过 0 -> 1 -> 2 获得本回合终局授权
-> 用 Wild / 抽牌 / 当前 MP 修补坏手
-> 打出 armed 3费全场 burst payoff 清掉可见压力。
```

本轮新增自动化测试文件：

- `prototype-web/src/tests/sim/redline-progression-card-system.test.ts`

建议验收命令：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test -- src/tests/sim/redline-progression-card-system.test.ts
npm run test
```

## 1. 四层边界验收

| ID | 验收项 | 自动化证据 | 通过条件 |
| --- | --- | --- | --- |
| L-01 | P0 不出现永久 Max MP 成长 | `keeps P0 authorization as turn-scoped resource...` | 完成 `0 -> 1 -> 2` 后 `maxEnergy` 仍为 3，只增加 `tempAuthorizationMP`。 |
| L-02 | 临时授权回合结束清空 | 同上 | `end-turn` 后 `tempAuthorizationMP = 0`、`authorizationRestriction = null`、`payoffArmed = false`、chain 清空。 |
| L-03 | 奖励是 run 内，不是局外 | `keeps card rewards inside the current run...` | 选择奖励后只进入当前 `deck/drawPile`；`restart-run` 后回到基础起始牌组、XP/level 重置、`maxEnergy` 仍为 3。 |

明确失败口径：

- 任何测试、文案或 HUD 把 `tempAuthorizationMP` 写成“永久成长”或“最大 MP +3”，失败。
- 任何 P0 通过路径依赖 `maxEnergy > 3`，失败。
- 奖励选择后如果被解释成跨 run 保留，失败。

## 2. 当前卡牌类型验收

| ID | 验收项 | 自动化证据 | 通过条件 |
| --- | --- | --- | --- |
| C-01 | 只有 3 费 `all-enemies` + `burst` 是 payoff 终结 | `defines the current terminal payoff set...` | 终结 payoff 集合只包含 `severance_burst` 和 `red_ledger_burst`。 |
| C-02 | `clearance_order` 是 2 费路线段，不是终结 payoff | `lets authorization pay terminal payoff cards...` | 0 MP + 授权状态下不能用授权支付 `clearance_order`，且不产生 `PayoffResolved`。 |
| C-03 | 授权只支付 3 费终结 payoff | 同上 | `severance_burst` 在 0 MP + 授权状态下可用 `authorization` 支付并结算。 |
| C-04 | Wild 是 repair | `keeps the current Wild card set...` | 当前 Wild 集合只包含 `wild_mana_stitch`、`wild_gap_key`，描述和运行时都指向修补。 |
| C-05 | self draw 不承诺 reorder runtime | `keeps paper_shatter/lantern_captain as self draw...` | `paper_shatter`、`lantern_captain` 只按抽牌队列抽牌，不产生 `reorder` 命令或事件。 |

明确失败口径：

- 把 2 费 `clearance_order` 当成 3 费终结 payoff，失败。
- 因为 `comboNode = burst` 就默认认为是终结 payoff，失败。
- 将 `reorder` 标签当成已实现 runtime 重排，失败。

## 3. 核心体验路径验收

自动化固定路径：

```text
Debt Hook(0) -> Wild Mana Stitch(repair expected 1)
-> Row Cleave(2) -> Severance Burst(3)
```

对应测试：

- `treats Wild as repair, then lets an armed payoff clear visible enemy intent`

通过条件：

- `wild_mana_stitch` 产生 `ChainRepaired`，`repairedCost = 1`，`nextExpectedCost = 2`。
- `row_cleave` 完成授权，产生 `AuthorizationGranted`。
- `severance_burst` 产生 `CardPlayed`，`effectMultiplier = 4`，`payoffArmed = true`。
- payoff 支付记录里 `authorizationPaid > 0`。
- `PayoffResolved` 记录 `payoffArmed = true`，`intentDamageBefore > 0`，`intentDamageAfter = 0`。

失败口径：

- Wild 不能补上缺口，失败。
- 完成 `0 -> 1 -> 2` 后没有授权，失败。
- armed payoff 不能降低或清掉敌意图，失败。
- 只能靠提高 `maxEnergy` 打出 payoff，失败。

## 4. 浏览器人工验收步骤

### 4.1 启动与打开

1. 在终端启动本地网页：

```bash
cd /Users/roc/Game-001/prototype-web
npm run dev -- --host 127.0.0.1 --port 5174
```

2. 如果 5174 已被占用，换 5175 或下一个空端口，并在记录里写明实际端口。
3. 打开浏览器访问 `http://127.0.0.1:5174/`，等待进入可出牌状态。若没有自动发牌，点击 `发牌`。

### 4.2 默认首手边界验收

1. 观察首屏 HUD：
   - 顶部应有 `HP`、`MP 3 / 3`、`授权 +0`。
   - 授权块应显示 `待解锁`、`0->1->2`，不能显示 `Max MP +3` 或永久成长。
   - `CHAIN` 初始应接近 `MP0?` / `Start MP0`。
   - `意图` 应显示结束回合会承受的 HP 压力。
   - `Payoff 预览` 在未授权时应表达未授权或等待链路。
2. 可点击 `前排显影`，选择一个前排敌人作为单体牌目标。
3. 依次打出：
   - `Debt Hook`
   - 任意 1 费承接牌，例如 `Redline Cut` 或 `Heartbeat Spark`
   - `Row Cleave`
4. 观察 HUD：
   - 授权块应变为 `授权 +3`、`本回合`、`只付3费终结`。
   - 链路应表达 `MP0 -> MP1 -> MP2` 或下一张 `MP3`。
   - `MP` 仍应以 `3` 为最大值，不应变成 `6 / 6`。
   - 如果手里没有 3 费 payoff，`Payoff 预览` 应显示等待 3 费清算牌，而不是宣称永久升级。
5. 点击 `结束回合`。
6. 下一轮开始后再次检查：
   - `授权 +0`。
   - `MP 3 / 3`。
   - chain 回到起链状态。
   - 未使用授权没有跨回合保留。

### 4.3 奖励、Wild 与 payoff 人工验收

这部分受当前发牌和奖励时机影响，不要求一次手工必然复现完整固定路径；固定路径由 sim 测试兜底。人工验收只记录玩家可见证据。

1. 持续正常出牌和结束回合，直到出现 `升级奖励` 面板。
2. 奖励面板应显示 `选择一张新牌加入牌组`，副文案应表达奖励进入后续抽牌循环；不要把它理解成局外永久成长。
3. 若选择 `Wild Mana Stitch` 或 `Wild Gap Key`：
   - 后续抽到时，检查卡面/tooltip 是否表达 `Wild/修补`。
   - 在已有 0 费起链后打出 Wild，观察链路是否继续向下一段推进。
   - 观察 `MP` 最大值仍为 3；`Wild Mana Stitch` 的返费只应表现为当前 MP 变化。
4. 若选择 `Severance Burst` 或 `Red Ledger Burst`：
   - 等待本回合完成 `0 -> 1 -> 2` 授权后再打出。
   - 卡面若需要授权支付，应出现 `授权支付` 或 `终局授权 armed` 语义。
   - 打出后观察 `战斗信息` 中是否出现 `全场处刑触发`，并确认敌意图压力明显下降或清空。
5. 如果 6 个玩家回合内没有抽到所需组合，不把它记为 runtime 失败；记录为“人工路径不可稳定复现，需依赖 sim 固定手牌测试或后续 debug seed 控件”。

### 4.4 视口与记录

建议至少做两个视口：

- Desktop：`1440x1000` 或 `1280x720`
- Mobile：`390x844`

记录项：

- 实际 URL 和端口。
- 首手 HUD 文案截图或文字记录。
- `0 -> 1 -> 2` 后授权 HUD 文案。
- 结束回合后授权清空证据。
- 如触发奖励，记录奖励选择和说明文案。
- 如触发 payoff，记录 payoff 前后 `意图` 或 `战斗信息` 变化。

### 4.5 验收后关闭网页要求

人工验收结束后必须清理：

1. 关闭所有打开的 `localhost` / `127.0.0.1` 游戏网页标签页或窗口。
2. 在运行 dev server 的终端按 `Ctrl-C` 停止 `npm run dev`。
3. 确认没有继续占用本次验收端口的本地页面或长跑进程。
4. 在验收记录里写：`已关闭网页，已停止 dev server`。如果不是本验收启动的服务器，写明“未停止，属于既有进程”。

## 5. 本轮风险与关注点

- 浏览器手工路径目前没有固定 seed / 固定手牌控件，所以 Wild + armed payoff 的完整组合不保证在短时间内自然出现。自动化测试已经用固定状态覆盖核心路径。
- `reorder` 仍只是标签和描述，不是 runtime 行为。后续如果要让玩家看见“重排”，必须补独立实现和验收。
- `PayoffTriggered` 仍可能被 2 费 `comboNode = burst` 触发；验收时应以 `targets = all-enemies` 和 `PayoffResolved` 判断终结 payoff。
