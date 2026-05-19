# Redline Progression Card System Implementation Plan

日期：2026-05-18
状态：PM 追踪记录 / 从文档进入开发
范围：只记录下一轮开发执行方案，不在本文内修改 runtime、HUD、卡牌或测试。

## 0. 本轮目标

本轮目标是把 `2026-05-18-progression-card-system-synthesis.zh.md` 的结论推进到可派工、可验收的开发任务。

P0 主线不是局外成长，也不是完整 roguelike 牌池。P0 要证明：

```text
玩家读懂敌意图
  -> 按 0 -> 1 -> 2 接上清算链
  -> 用 Wild / 抽牌 / 当前 MP 修补坏手牌
  -> 获得本回合终局授权 +3
  -> 用授权支付 3 费 payoff
  -> armed payoff 清掉可见压力或降低敌意图
  -> 奖励三选一回应稳定性 / 资源 / 天花板
```

本记录生成时，工作区已有其他 worker 对 `prototype-web` 的未提交改动。后续 worker 必须先看 `git status --short --branch`，只接管自己文件边界内的改动，不 revert 其他人的工作。

## 1. P0 / P1 / P2 裁决

### P0 必做

| 模块 | P0 目标 | 不通过口径 |
| --- | --- | --- |
| 卡牌分类字段 | 现有 16 张卡必须有可追踪的分类语义：`cardType`、`chainRole`、`cycleRole`、`buildRole`，并能标出 `availability` 与 `rewardBranch`。 | HUD、奖励或 QA 继续靠 `cost/comboNode/targets` 临时猜测卡牌职责。 |
| 奖励三分支 | 三选一至少覆盖 `consistency`、`resource`、`ceiling` 三类：稳定性/修补、资源/授权、payoff 天花板。 | 仍然只用 `candidateCardPool.slice(0, 3)` 导致奖励全是同类牌。 |
| HUD 临时授权文案 | 当前 MP、最大 MP、临时授权必须视觉和文案分层。推荐文案：`终局授权 +3：本回合可支付清算牌`、`授权将在结束回合清空`、`已武装：授权支付`。 | 出现 `最大 MP +3`、`MP 成长`、`升级成功` 等误导成永久成长的文案。 |
| payoff 语义 | 真实 payoff 必须指 `cost = 3`、`comboNode = burst`、`targets = all-enemies` 的终局清算牌。`clearance_order` 是 2 费展开段，不是 3 费 payoff。 | `PayoffTriggered` 被当成唯一验收证据，导致 2 费 burst 也被玩家或 QA 认成 payoff。 |
| QA 验收 | Sim、HUD、browser smoke 都要能证明：`maxEnergy` 仍为 3，`0 -> 1 -> 2` 获得本回合授权，授权只付 3 费 payoff，奖励三分支可见。 | 只用击杀数或 debug trace 证明，玩家层 HUD 看不懂。 |

### P1 暂缓

- 一次性 `本次清算最大 MP +1`，只作为 run 内 extension 奖励，不能作为 P0 payoff 合法性的前置。
- `reorder` 的最小运行时效果，或把现有卡面文案降级为抽牌/支援。
- `unarmed payoff` 的显式降档或警告文案。
- 状态牌进入发牌循环，证明敌人或代价能污染下一轮手牌。
- `RewardState` 增加 `rewardId/source/offeredAtRound/rewardHistory` 等结构化记录。

### P2 以后再做

- 完整局外成长、永久 Max MP 曲线、账号等级、存档和解锁池。
- 单位牌、角色牌、事件牌、完整地图、商店、遗物池。
- 多角色授权、长期天赋树、失败后保留货币。

## 2. 推荐字段合同

P0 不要求一次性重构所有状态层，但卡牌定义或卡牌元数据必须有稳定字段供奖励、HUD、QA 共用。

```ts
cardType: 'attack' | 'skill' | 'resource' | 'draw' | 'repair' | 'payoff' | 'status';
chainRole: 'starter' | 'bridge' | 'expand' | 'repair' | 'payoff' | 'deadweight';
cycleRole: 'opener' | 'bridge-density' | 'draw-fixer' | 'resource-fixer' | 'late-payoff' | 'clog';
buildRole: 'damage' | 'consistency' | 'economy' | 'ceiling' | 'pressure';
availability: 'starting' | 'reward' | 'reserved';
rewardBranch?: 'consistency' | 'resource' | 'ceiling';
payoffKind?: 'none' | 'route-burst' | 'full-payoff';
```

执行裁决：

- `severance_burst`、`red_ledger_burst`：`chainRole = payoff`，`rewardBranch = ceiling`，`payoffKind = full-payoff`。
- `clearance_order`：`chainRole = expand`，`rewardBranch = consistency` 或 `ceiling` 需由设计裁决，但 `payoffKind = route-burst`，不得进入 `full-payoff`。
- `wild_mana_stitch`、`wild_gap_key`：优先视为 `repair` / `resource`，用于稳定性或资源分支。
- `blood_tithe`、`pulse_draw` 等暂未进入奖励池的牌必须通过 `availability = reserved` 说明状态。

## 3. Worker 分工与文件边界

### Worker A：Card Contract / Data

职责：

- 在卡牌定义或旁路 metadata 中落地分类字段。
- 补齐 16 张现有卡的分类表。
- 提供 `isFullPayoffCard(card)`、`isRouteBurstCard(card)` 或等价 helper，避免各处重复猜测。

文件边界：

- `prototype-web/src/data/cards.ts`
- `prototype-web/src/sim/types.ts`
- 新增或更新卡牌分类测试，例如 `prototype-web/src/tests/sim/card-taxonomy.test.ts`

不得改：

- HUD 布局。
- reward 生成策略以外的 runtime 流程。
- 数值平衡大改。

### Worker B：Reward / Progression

职责：

- 把奖励三选一从顺序 `slice(0, 3)` 改为三分支选择。
- 每次奖励至少提供一张稳定性、一张资源、一张天花板候选；候选不足时要有可测试 fallback。
- `RewardChoicesGenerated` 或快照中要能让 QA 读到每个奖励的 `rewardBranch`。

文件边界：

- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/sim/world.ts`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/tests/sim/progression-reward-regression.test.ts`

不得改：

- 永久成长、账号存档、商店或地图。
- 把 `Max MP +1` 塞进 P0 奖励。

### Worker C：Runtime / Payoff Semantics

职责：

- 统一真实 payoff 判定，确保 `clearance_order` 不被当成 3 费 payoff。
- 保持 P0 授权规则：完成未断裂的 `0 -> 1 -> 2` 后获得 `tempAuthorizationMP +3`；授权只支付 full payoff；结束回合清空。
- QA 证据必须记录授权来源、支付来源、`payoffArmed`、击杀数和 `preventedIntentDamage`。

文件边界：

- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/eca/redlineRules.ts`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/tests/sim/redline-attribute-authorization.test.ts`
- `prototype-web/src/tests/sim/runtime.test.ts`

不得改：

- 通过提高 `maxEnergy` 绕过授权。
- 用隐藏测试夹具给玩家 6 MP。

### Worker D：HUD / Player Copy

职责：

- HUD 明确展示当前 MP、最大 MP、临时授权、下一张期望 cost、结束回合伤害。
- payoff 卡在授权可支付时显示 `已武装：授权支付`；未授权时显示缺口，不要把它写成永久升级。
- 奖励卡文案必须显示生命周期或分支意图。

文件边界：

- `prototype-web/src/ui/hud.ts`
- `prototype-web/src/style.css`
- `prototype-web/src/tests/ui/hud-target-selection.test.ts`

不得改：

- runtime 支付规则。
- 奖励候选算法。

### Worker E：QA / Browser Evidence

职责：

- 在代码 worker 完成后跑 sim、HUD、build 和 browser smoke。
- 采集桌面与移动端证据，确认玩家层能看懂授权、payoff 和奖励分支。
- 失败必须分类为 implementation bug、acceptance conflict、hypothesis failed、evidence missing 或 scope drift。

文件边界：

- `prototype-web/src/tests/**`
- `outputs/browser-qa/redline-progression-card-system/2026-05-18/`
- QA 报告 Markdown 或 JSON。

不得改：

- runtime、HUD、卡牌数据。

## 4. 验收命令

后续实现 worker 完成后，由主线程或 QA worker 执行：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test -- src/tests/sim/redline-attribute-authorization.test.ts
npm run test -- src/tests/sim/progression-reward-regression.test.ts
npm run test -- src/tests/ui/hud-target-selection.test.ts
npm run test -- src/tests/sim/redline-hyperturn-acceptance.test.ts
npm run test
npm run build
```

浏览器验收：

```bash
cd /Users/roc/Game-001/prototype-web
npm run dev -- --host 127.0.0.1 --port 5174
```

必查视口：

- Desktop：`1440x1000` 或 `1280x720`
- Mobile：`390x844`

Browser evidence 至少记录：

- 首屏是否 3 秒内能读出推荐起手、当前 MP、下一张期望 cost、结束回合伤害。
- 完成 `0 -> 1 -> 2` 后是否看到 `终局授权 +3`，且和最大 MP 分开。
- 3 费 full payoff 是否显示可授权支付，并在 trace 中产生 `PayoffResolved`。
- `clearance_order` 是否没有被 HUD 或 QA 认成 full payoff。
- 奖励三选一是否能读出稳定性 / 资源 / 天花板三种方向。
- 移动端是否没有 HUD 遮挡手牌、目标、授权提示或 End Turn 后果。

## 5. 接手顺序

推荐顺序：

1. Worker A 先落卡牌字段和 payoff helper。
2. Worker B 与 Worker C 基于 helper 分别处理奖励三分支和 runtime payoff 语义。
3. Worker D 接入字段和 helper，统一 HUD 文案。
4. Worker E 最后做完整 QA，记录证据。

并行限制：

- Worker B、C、D 可以先读文档和现状，但不要在 Worker A 的字段合同未定时各自发明一套类型判断。
- 所有 worker 都必须保留 P0 裁决：不做局外成长，不靠永久 Max MP 解释 3 费 payoff。
