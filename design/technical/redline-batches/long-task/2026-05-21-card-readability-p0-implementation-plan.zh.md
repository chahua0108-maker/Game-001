# Card Readability P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 本计划只授权 P0 展示层窄改；执行 worker 不提交 git，不回滚他人修改。

**Goal:** 在不改变发牌、支付、授权、倍率、奖励生成、升级选择、run carryover 或 route 语义的前提下，让默认战斗 HUD 中的手牌、奖励卡和属性状态首屏可读。

**Architecture:** P0 只新增或暴露只读展示数据：卡牌中文主标题/短名、稳定类型/链路 data attribute、共享 `BASE_HAND_SIZE` / `HAND_SIZE` 常量、HUD 派生展示 helper、CSS 视觉 token、UI 测试与 `qa:ui` 语义断言。动态状态限制在 MP 小框、细边框或短标签；整张卡的底色只表达稳定卡牌类型/角色，不随授权、缺费、断链大面积变色。

**Tech Stack:** TypeScript, Vite, Vitest, DOM-based HUD rendering, Playwright-backed `scripts/qa-ui.mjs`, CSS.

**Source Spec:** `/Users/roc/Game-001/design/framework/2026-05-21-redline-card-readability-attribute-hud-spec.zh.md`，框架复审口径为 approve 93/100。

---

## 0. 全局边界

### P0 允许

- 展示层：`prototype-web/src/ui/hud.ts`
- 最小卡牌展示字段：`prototype-web/src/data/cards.ts`、`prototype-web/src/sim/types.ts`
- 共享只读手牌常量：新增 `prototype-web/src/sim/constants.ts`，或对 `prototype-web/src/sim/runtime.ts` 做只读常量引用窄改
- HUD class / data attribute / CSS：`prototype-web/src/style.css`
- UI tests：`prototype-web/src/tests/ui/`
- QA 脚本语义断言：`prototype-web/scripts/qa-ui.mjs`

### P0 禁止

- 禁止改支付、授权、倍率、奖励生成、升级选择、run carryover、route 语义。
- 禁止改变发牌逻辑、抽牌数量、回合流程、牌堆转移、生命周期语义。
- 禁止整张卡随授权/断链/缺费大面积动态变色；动态状态只落在 MP 小框、细边框或短标签。
- 禁止做 `runUpgrade` 升级入口、卡牌实例系统、永久 MP 成长、P1/P2 内容抢跑。
- 禁止改 `prototype-web/src/sim/rewardProgression.ts`、`prototype-web/src/sim/rewardChoices.ts`、`prototype-web/src/sim/runRoute.ts`、`prototype-web/src/sim/activity.ts`，除非后续正式框架审核另行批准。
- 禁止改 `plugins/`、AIRoc 插件目录、提交 git、切分支、推送远端。

### 执行前检查

每个 worker 开始前先执行：

```bash
cd /Users/roc/Game-001
git status --short
git diff -- prototype-web/src/ui/hud.ts prototype-web/src/sim/runtime.ts prototype-web/src/data/cards.ts prototype-web/src/sim/types.ts prototype-web/src/style.css prototype-web/scripts/qa-ui.mjs prototype-web/src/tests/ui
```

验收：确认是否已有他人修改。若目标文件已有修改，worker 只能在当前内容上追加/窄改，不得回滚不属于本任务的 diff。

---

## 1. 文件结构与职责

### 允许新增

- `prototype-web/src/sim/constants.ts`
  - 只导出 `BASE_HAND_SIZE` 与 `HAND_SIZE`。
  - 不包含任何运行时逻辑，不读取 world，不改发牌。

- `prototype-web/src/tests/ui/hud-card-readability.test.ts`
  - 覆盖中文主标题、稳定 data attribute、MP 小框状态、授权/未授权 payoff、`手 x/4`、奖励空壳隐藏。

### 允许修改

- `prototype-web/src/sim/runtime.ts`
  - 删除或停止使用本地 `const HAND_SIZE = 4`。
  - 从 `./constants` 引入 `HAND_SIZE`，保持所有 deal/draw 调用行为不变。

- `prototype-web/src/sim/types.ts`
  - 在 `CardDefinition` 上新增可选展示字段：`displayName?: string`、`shortName?: string`、`hudRoleLabel?: string`。
  - 不新增规则字段，不新增授权数值字段。

- `prototype-web/src/data/cards.ts`
  - 为现有卡牌补最小中文 `displayName` / `shortName`。
  - 不调整 `cost`、`damage`、`cardType`、`chainRole`、`rewardBranches`、`runUpgrade` 或任何规则字段。

- `prototype-web/src/ui/hud.ts`
  - 增加展示 helper、data attribute、奖励/升级空壳防护、`BASE_HAND_SIZE` 显示引用。
  - 不改变 `hudCardPaymentRead` 的支付判定，不改变 `cardChainRead` 的倍率/断链判定。

- `prototype-web/src/style.css`
  - 增加稳定类型色 class 和 MP 小框状态样式。
  - 删除或弱化会让整张卡随动态状态大面积改色的 CSS。

- `prototype-web/scripts/qa-ui.mjs`
  - 增加 DOM 语义断言，不改变 QA server 启停、viewport、既有 topdeck/wild/activity gates。

### 不允许修改

- `prototype-web/src/sim/rewardProgression.ts`
- `prototype-web/src/sim/rewardChoices.ts`
- `prototype-web/src/sim/runRoute.ts`
- `prototype-web/src/sim/activity.ts`
- `prototype-web/src/sim/cardUpgrades.ts`
- `prototype-web/src/eca/`
- `prototype-web/src/fsm/`
- `prototype-web/src/render/`
- 任何 `plugins/` 或 Obsidian 目录

---

## 2. Worker Task A：共享手牌常量

**中文短名：** `手牌常量外提`

**目标：** `手 x/4` 的基础值来自共享只读常量，HUD 和测试不得各自硬编码 `4`。

**可写文件：**
- Create: `/Users/roc/Game-001/prototype-web/src/sim/constants.ts`
- Modify: `/Users/roc/Game-001/prototype-web/src/sim/runtime.ts`
- Modify: `/Users/roc/Game-001/prototype-web/src/ui/hud.ts`
- Test: `/Users/roc/Game-001/prototype-web/src/tests/ui/hud-card-readability.test.ts`

**不可写文件：**
- `/Users/roc/Game-001/prototype-web/src/sim/world.ts`
- `/Users/roc/Game-001/prototype-web/src/sim/rewardProgression.ts`
- `/Users/roc/Game-001/prototype-web/src/sim/rewardChoices.ts`
- `/Users/roc/Game-001/prototype-web/src/sim/runRoute.ts`

### Steps

- [ ] 新增 `prototype-web/src/sim/constants.ts`：

```ts
export const BASE_HAND_SIZE = 4;
export const HAND_SIZE = BASE_HAND_SIZE;
```

- [ ] 在 `prototype-web/src/sim/runtime.ts` 中把本地 `const HAND_SIZE = 4` 替换为：

```ts
import { HAND_SIZE } from './constants';
```

验收点：所有原先使用 `HAND_SIZE` 的发牌/补抽逻辑仍使用同名常量；不得改 `dealIntoPlayerTurn`、`drawCardsIntoHand`、保留牌回手、弃牌洗回的行为。

- [ ] 在 `prototype-web/src/ui/hud.ts` 中引入：

```ts
import { BASE_HAND_SIZE } from '../sim/constants';
```

- [ ] 将 HUD 牌堆 chip 从只显示 `手 ${snapshot.player.hand.length}` 改成显示：

```ts
`手 ${snapshot.player.hand.length}/${BASE_HAND_SIZE}`
```

并继续显示抽/弃/消/留计数。

- [ ] 在 UI test 中从 `../../sim/constants` 引入 `BASE_HAND_SIZE`，断言 HUD 文案使用该常量。例如构造 3 张手牌 snapshot 时断言存在 `手 3/${BASE_HAND_SIZE}`。

### 验收命令

```bash
cd /Users/roc/Game-001/prototype-web
npm run test:ui -- hud-card-readability.test.ts
npm run check
```

预期：测试通过；`runtime.ts` 没有任何发牌数量或流程 diff，只有常量来源改变。

---

## 3. Worker Task B：卡牌中文展示字段与派生规则

**中文短名：** `中文卡面字段`

**目标：** 手牌和奖励卡主标题优先显示中文 `displayName` / `shortName`；英文 `name` 降级到 tooltip、aria 或次级文本。

**可写文件：**
- Modify: `/Users/roc/Game-001/prototype-web/src/sim/types.ts`
- Modify: `/Users/roc/Game-001/prototype-web/src/data/cards.ts`
- Modify: `/Users/roc/Game-001/prototype-web/src/ui/hud.ts`
- Test: `/Users/roc/Game-001/prototype-web/src/tests/ui/hud-card-readability.test.ts`

**不可写文件：**
- 所有 sim 规则文件，特别是 `runtime.ts` 之外的支付/奖励/route 文件。

### Steps

- [ ] 在 `CardDefinition` 中新增可选字段：

```ts
displayName?: string;
shortName?: string;
hudRoleLabel?: string;
```

- [ ] 在 `cards.ts` 只补展示字段。建议最小表如下，worker 可按现有文案微调，但不得改规则字段：

| cardId | displayName | shortName |
| --- | --- | --- |
| `debt_hook` | 债钩 | 债钩 |
| `blood_reclaim` | 血债回收 | 回收 |
| `blood_tithe` | 血税 | 血税 |
| `spark_tap` | 点火 | 点火 |
| `redline_cut` | 红线切割 | 切割 |
| `heartbeat_spark` | 心跳火花 | 火花 |
| `verdict_mark` | 判决标记 | 判决 |
| `pulse_draw` | 脉冲抽牌 | 充能 |
| `row_cleave` | 横扫清列 | 横扫 |
| `clearance_order` | 清算令 | 清算 |
| `paper_shatter` | 纸路整备 | 整备 |
| `silt_purge` | 淤泥净化 | 净化 |
| `ash_filter` | 灰烬过滤 | 滤灰 |
| `toll_shunt` | 收费改道 | 改道 |
| `last_light_cache` | 余光缓存 | 藏光 |
| `fuse_needle` | 引线针 | 穿线 |
| `cinder_crossing` | 灰烬垫步 | 垫步 |
| `signal_relay` | 信号接驳 | 接驳 |
| `crimson_receipt` | 猩红收据 | 追账 |
| `severance_burst` | 断账爆发 | 处刑 |
| `red_ledger_burst` | 红账爆破 | 爆破 |
| `wild_mana_stitch` | 野性能量缝合 | 缝合 |
| `wild_gap_key` | 缺口钥匙 | 补位 |
| `lantern_captain` | 提灯队长 | 号令 |
| `static_overload` | 静电过载 | 过载 |
| `guard_reserve` | 守备保留 | 保留 |
| `shield_reserve` | 护盾保留 | 护盾 |
| `ledger_discount` | 账本折扣 | 降费 |
| `burn_after_reading` | 阅后焚档 | 焚档 |

- [ ] 在 `hud.ts` 增加展示 helper，规则为：

```ts
export function hudCardDisplayName(card: CardDefinition): string {
  return card.displayName ?? card.shortName ?? card.name;
}

export function hudCardShortName(card: CardDefinition): string {
  return card.shortName ?? card.displayName ?? card.name;
}
```

- [ ] 手牌按钮 `<strong>` 使用 `hudCardShortName(card)` 或 `hudCardDisplayName(card)`；奖励卡 `<strong>` 使用 `hudCardDisplayName(card)`。

- [ ] tooltip/title/aria 中保留英文 `card.name`，例如 `英文名 ${card.name}`，保证 debug 和识别不丢失。

- [ ] `readableRewardLabel()` 中对卡牌 id 的可见 label 使用 `hudCardDisplayName(cards[cardId])`，避免奖励历史继续只显示英文。

### 验收命令

```bash
cd /Users/roc/Game-001/prototype-web
npm run test:ui -- hud-card-readability.test.ts
npm run check
```

预期：
- 起手手牌主标题不再只显示 `Debt Hook` / `Redline Cut` 等英文。
- tooltip/title/aria 仍可搜索到英文原名。
- 未配置 `displayName` 的未来卡牌可自动 fallback 到 `name`，不会空渲染。

---

## 4. Worker Task C：HUD 语义 data attribute、默认信息显性化与奖励空壳防护

**中文短名：** `HUD语义骨架`

**目标：** 手牌/奖励卡直接暴露类型、链路角色、机制短标签、授权段收益、payoff 授权状态；奖励/升级无 choices 时不渲染空壳。

**可写文件：**
- Modify: `/Users/roc/Game-001/prototype-web/src/ui/hud.ts`
- Test: `/Users/roc/Game-001/prototype-web/src/tests/ui/hud-card-readability.test.ts`

**不可写文件：**
- `/Users/roc/Game-001/prototype-web/src/sim/rewardChoices.ts`
- `/Users/roc/Game-001/prototype-web/src/sim/cardUpgrades.ts`
- `/Users/roc/Game-001/prototype-web/src/sim/rewardProgression.ts`

### 派生规则

类型标签：

```ts
attack -> 攻击
draw -> 抽牌
repair -> 修补
resource -> 资源
skill -> 技能
payoff -> 终结
status -> 状态
```

链路标签：

```ts
starter -> 开链
bridge -> 接链
expand -> 展开
repair -> 修补
payoff -> 终结
```

奖励路线标签：

```ts
route-bridge -> 路线
repair-resource -> 修补
payoff -> 终结
```

### Steps

- [ ] 导出或新增 `hudCardTypeLabel(card)`、`hudCardChainRoleLabel(card)`、`hudRewardBranchLabel(card)` helper。

- [ ] 手牌按钮增加稳定语义：

```html
data-card-type="attack"
data-chain-role="starter"
data-payment-state="normal-payable"
class="card-button card-type-attack chain-role-starter ..."
```

- [ ] 奖励卡增加同等语义：

```html
data-card-type="payoff"
data-chain-role="payoff"
data-reward-branch="payoff"
class="reward-card card-type-payoff chain-role-payoff ..."
```

- [ ] 手牌卡面信息层级改为：
  - MP 小框
  - 中文主标题
  - `类型 · 链路角色`，例如 `攻击 · 开链`
  - `chain-preview`
  - `intent-preview`
  - 授权段或 payoff 短标签
  - `MP n · mobileEffect/rulesText`

- [ ] 奖励卡默认显性化：
  - 中文主标题
  - `类型 · 链路角色`
  - `路线/修补/终结` 奖励路线标签
  - 机制短标签取 `keywords` 或 `mechanicTags` 前 1-3 个
  - `rulesText` 或 `mobileEffect`

- [ ] 授权段短标签规则：

```ts
const isAuthorizationSegment =
  card.chainRole === 'expand' &&
  (card.keywords.includes('授权') || card.mechanicTags?.includes('authorization'));
```

满足时在卡面显示 `给授权 +3`。这是现有合同的展示文案，不新增授权数值字段，不改变授权结算。

- [ ] payoff 短标签规则：
  - `isHudAuthorizationPayoffCard(card)` 且 `hudAuthorizationState(snapshot).active`：显示 `授权可付`
  - `isHudAuthorizationPayoffCard(card)` 且未 active：显示 `未授权`
  - 保留倍率/目标信息，例如 `授权可付 · 全场16 · x3`

- [ ] Reward panel 只在真的有 choices 时渲染：

```ts
const hasRewardChoices = snapshot.reward.pending && snapshot.reward.choices.length > 0;
```

`snapshot.fsm.gameFlow === 'Reward' && hasRewardChoices` 才渲染 `.reward-panel`。没有 choices 时不显示空标题、空卡片或“即将开放”。

- [ ] P0 不新增 `runUpgrade` 升级入口。若 `cardUpgrades.pending` 且 `choices.length > 0` 已经被现有 reward choice id 流程映射，保持现状；若没有 choices，不渲染升级空壳。

### 验收命令

```bash
cd /Users/roc/Game-001/prototype-web
npm run test:ui -- hud-card-readability.test.ts
npm run check
```

预期：
- 每张手牌和奖励卡都有 `data-card-type` 与 `data-chain-role`。
- `row_cleave` / `clearance_order` / `signal_relay` 卡面显示 `给授权 +3`。
- `severance_burst` / `red_ledger_burst` 在授权 active 时显示 `授权可付`，未 active 时显示 `未授权`。
- Reward 阶段无 pending choices 时不出现 `.reward-panel` 空壳。

---

## 5. Worker Task D：MP 小框动态状态与稳定角色色 CSS

**中文短名：** `卡面视觉令牌`

**目标：** 稳定底色表达卡牌类型，动态状态只影响 MP 小框、细边框或短标签。

**可写文件：**
- Modify: `/Users/roc/Game-001/prototype-web/src/ui/hud.ts`
- Modify: `/Users/roc/Game-001/prototype-web/src/style.css`
- Test: `/Users/roc/Game-001/prototype-web/src/tests/ui/hud-card-readability.test.ts`

**不可写文件：**
- 所有 sim 规则文件。

### Payment state 约定

`hud.ts` 中派生一个只读展示状态，不能影响 `hudCardPaymentRead()` 结果：

```ts
type HudCardPaymentVisualState =
  | 'normal-payable'
  | 'authorization-payable'
  | 'missing-mp'
  | 'chain-break-playable'
  | 'not-playable';
```

派生优先级：

1. 非 `PlayerTurn`：`not-playable`
2. `payment.usesAuthorization`：`authorization-payable`
3. `!payment.playable`：`missing-mp`
4. `chainRead.breaksChain && payment.playable`：`chain-break-playable`
5. 其他可打：`normal-payable`

### Steps

- [ ] 手牌按钮输出 `data-payment-state` 和 MP 小框 class：

```html
<span class="card-cost payment-state-authorization-payable">
```

- [ ] 动态短标签文案：
  - `normal-payable`：不额外显示，或 MP 小框保持正常色
  - `authorization-payable`：短标签 `授权付`
  - `missing-mp`：短标签 `缺MPn` 或 payoff 的 `缺授权`
  - `chain-break-playable`：短标签 `断链可打`
  - `not-playable`：短标签 `不可打`

- [ ] CSS 增加稳定类型色，示例 token：

```css
.card-button.card-type-attack,
.reward-card.card-type-attack { --card-accent: #ff6b6b; }
.card-button.card-type-draw,
.reward-card.card-type-draw { --card-accent: #73ffe2; }
.card-button.card-type-repair,
.reward-card.card-type-repair { --card-accent: #8bd17c; }
.card-button.card-type-resource,
.reward-card.card-type-resource { --card-accent: #ffd166; }
.card-button.card-type-skill,
.reward-card.card-type-skill { --card-accent: #b9a7ff; }
.card-button.card-type-payoff,
.reward-card.card-type-payoff { --card-accent: #ff8fab; }
.card-button.card-type-status,
.reward-card.card-type-status { --card-accent: #a0a0a0; }
```

- [ ] 卡牌底色只基于 `--card-accent` 做稳定微弱 tint。禁止 `.authorization-payable`、`.chain-break-risk`、`.locked-card` 覆盖整张卡大面积背景。

- [ ] 动态状态样式只作用于：
  - `.card-cost.payment-state-normal-payable`
  - `.card-cost.payment-state-authorization-payable`
  - `.card-cost.payment-state-missing-mp`
  - `.card-cost.payment-state-chain-break-playable`
  - `.card-cost.payment-state-not-playable`
  - `.card-button[data-payment-state="..."]` 的 `border-color` 或 `box-shadow`

- [ ] 保持 360px 和 390px 移动端无文字溢出。若中文长名挤压，使用 `shortName`、`text-overflow: ellipsis`、固定卡高，不用 viewport-width 字体缩放。

### 验收命令

```bash
cd /Users/roc/Game-001/prototype-web
npm run test:ui -- hud-card-readability.test.ts
npm run qa:ui
npm run check
```

预期：
- `attack`、`repair`、`payoff`、`status` 至少有可区分的稳定视觉 token。
- 普通可付、授权可付、缺 MP、断链但仍可打、不可打五种状态均能在 DOM 上被断言。
- `.authorization-payable`、`.chain-break-risk`、`.locked-card` 不再大面积改写整张卡背景。

---

## 6. Worker Task E：UI Tests

**中文短名：** `可读性单测`

**目标：** 用 Vitest 锁住 P0 可读性合同，避免后续 HUD 改动退回英文主标题、硬编码手牌上限或动态整卡变色。

**可写文件：**
- Create/Modify: `/Users/roc/Game-001/prototype-web/src/tests/ui/hud-card-readability.test.ts`

**可读文件：**
- `/Users/roc/Game-001/prototype-web/src/ui/hud.ts`
- `/Users/roc/Game-001/prototype-web/src/sim/constants.ts`
- `/Users/roc/Game-001/prototype-web/src/data/cards.ts`
- `/Users/roc/Game-001/prototype-web/src/sim/world.ts`
- `/Users/roc/Game-001/prototype-web/src/sim/snapshot.ts`

### 必测用例

- [ ] `BASE_HAND_SIZE` contract：
  - 从 `../../sim/constants` import `BASE_HAND_SIZE`。
  - 渲染 3 张手牌 snapshot，断言 `.pile-chip` text 包含 `手 3/${BASE_HAND_SIZE}`。
  - 断言 `.pile-chip` 仍包含 `抽`、`弃`、`消`、`留`。

- [ ] 中文主标题：
  - 渲染 `debt_hook`、`redline_cut`、`row_cleave`。
  - 断言 `.card-button strong` 包含中文短名。
  - 断言按钮 `title` 或 `aria-label` 仍包含英文原名。

- [ ] 稳定 data attribute：
  - `debt_hook` button: `data-card-type="attack"`、`data-chain-role="starter"`。
  - `wild_gap_key` button: `data-card-type="repair"`、`data-chain-role="repair"`。
  - `static_overload` button: `data-card-type="status"`。

- [ ] MP 小框五态：
  - 普通可付：`debt_hook` in PlayerTurn energy 3 -> `data-payment-state="normal-payable"`。
  - 授权可付：`severance_burst` energy 0 tempAuthorizationMP 3 -> `authorization-payable`。
  - 缺 MP：`row_cleave` energy 0 -> `missing-mp`。
  - 断链但仍可打：构造 lastPlayedCost 0 / next expected 1，但卡为 `row_cleave` 且 energy 足够 -> `chain-break-playable`。
  - 不可打：Deal 阶段手牌 -> `not-playable`。

- [ ] 授权段：
  - `row_cleave` 或 `signal_relay` 卡面包含 `给授权 +3`。

- [ ] payoff：
  - 授权 active 时 `severance_burst` 卡面包含 `授权可付`。
  - 未授权时 `severance_burst` 卡面包含 `未授权` 或 `缺授权`。

- [ ] 奖励卡默认信息：
  - Reward pending choices 渲染时，`.reward-card` 有中文名、`data-card-type`、`data-chain-role`、奖励路线标签。

- [ ] 奖励空壳：
  - `fsm.gameFlow = 'Reward'` 但 `reward.pending = false` 或 `choices = []`，断言不存在 `.reward-panel`。

### 验收命令

```bash
cd /Users/roc/Game-001/prototype-web
npm run test:ui -- hud-card-readability.test.ts
npm run test:ui
npm run check
```

预期：新增测试和既有 UI 测试全部通过。

---

## 7. Worker Task F：`qa:ui` 语义断言

**中文短名：** `QA语义门禁`

**目标：** `npm run qa:ui` 除了查 overflow，还要在浏览器 DOM 中检查 P0 可读性语义。

**可写文件：**
- Modify: `/Users/roc/Game-001/prototype-web/scripts/qa-ui.mjs`

**不可写文件：**
- `prototype-web/src/sim/` 下除 Task A 常量外的规则文件。

### Steps

- [ ] 在 `inspectPage()` 或新 helper 中增加 `readabilityAssertions`，每个 viewport 都采集：
  - `.pile-chip` 是否包含 `/4`，并且文字含 `手`。
  - `.card-button` 是否至少 1 张有中文主标题。
  - 所有 `.card-button[data-card-id]` 是否都有 `data-card-type` 与 `data-chain-role`。
  - 是否至少覆盖 `card-type-attack`、`card-type-repair`、`card-type-payoff`、`card-type-status` 中的可见样本；若 live 初始手牌没有 status，可在 QA scenario 中注入 `static_overload`。
  - 是否存在 `data-payment-state`。
  - 是否能在 scenario 中看到 `给授权 +3`。
  - 是否能分别看到 `授权可付` 与 `未授权`。
  - `.reward-panel` 在无 choices 的 Reward snapshot 中不出现。

- [ ] 为 QA 新增两个轻量 scenario，尽量复用现有 `page.evaluate` 模式：
  - `buildCardReadabilityHud(page)`：构造手牌 `['debt_hook','row_cleave','wild_gap_key','static_overload','severance_burst']`，覆盖中文、状态、修补、payoff、断链。
  - `buildRewardEmptyHud(page)`：构造 `gameFlow='Reward'` 且 `reward.pending=false/choices=[]`，确认无 `.reward-panel`。

- [ ] `report.results[]` 增加字段：

```js
cardReadabilityScenarioReached
handBaseVisible
cardSemanticAttrsVisible
authorizationGrantVisible
payoffAuthorizationLabelsVisible
rewardEmptyShellHidden
```

- [ ] `classifyStatus()`、`buildGates()`、`buildGateScore()` 把上述字段纳入失败条件。不要移除既有 topdeck、wild、activity gates。

### 验收命令

```bash
cd /Users/roc/Game-001/prototype-web
npm run qa:ui
```

预期：
- 输出 JSON 中新增 readability 字段。
- 三个 viewport 都 pass。
- `outputs/browser-qa/<QA_ROUND>/qa-ui-result.json` 中没有 text overflow、horizontal overflow、console error。

---

## 8. Worker Task G：整体验收与回归检查

**中文短名：** `P0集成验收`

**目标：** 合并前确认 P0 仅做展示层，且没有触碰禁止语义。

**可写文件：**
- 无。此任务只读检查。

**命令：**

```bash
cd /Users/roc/Game-001
git diff --stat
git diff -- prototype-web/src/sim/runtime.ts prototype-web/src/sim/constants.ts prototype-web/src/sim/types.ts prototype-web/src/data/cards.ts prototype-web/src/ui/hud.ts prototype-web/src/style.css prototype-web/src/tests/ui prototype-web/scripts/qa-ui.mjs
git diff --name-only
```

```bash
cd /Users/roc/Game-001/prototype-web
npm run test:ui
npm run test:sim -- redline-attribute-authorization.test.ts redline-lifecycle-v1.test.ts runtime.test.ts
npm run qa:ui
npm run check
```

**验收清单：**

- [ ] `git diff --name-only` 不包含禁止文件。
- [ ] `runtime.ts` diff 仅是 `HAND_SIZE` 常量来源，不改变行为。
- [ ] `cards.ts` diff 仅是 `displayName` / `shortName` / `hudRoleLabel`。
- [ ] HUD 显示 `手 x/4`，基础值来自 `BASE_HAND_SIZE` 或 `HAND_SIZE`。
- [ ] 手牌/奖励卡主标题中文化，英文原名仍在 title/tooltip/aria 或次级详情。
- [ ] 稳定 `data-card-type` / `data-chain-role` 已覆盖手牌和奖励卡。
- [ ] 动态状态只落在 MP 小框、细边框或短标签。
- [ ] 授权段显示 `给授权 +3`。
- [ ] payoff 显示 `授权可付` / `未授权`。
- [ ] 奖励/升级无 choices 时无空壳。
- [ ] 敌意图与 End Turn 后果仍在首屏可见。
- [ ] 360px / 390px / 1366px viewport 无文字溢出、重叠、按钮高度抖动。

---

## 9. 最后 5 专家评分轮

这 5 轮在 Task G 命令全部通过后执行。每轮都要给 `0-100` 分、阻塞问题、非阻塞建议、是否 approve。任一轮低于 90 分或出现 P0 越界，返回对应 worker 修复。

### Round 1：框架程序专家

**评分重点：**
- 是否只做展示层和只读常量外提。
- 是否没有改变发牌、支付、授权、倍率、奖励生成、升级选择、run carryover、route 语义。
- `runtime.ts` 是否只有 `HAND_SIZE` 来源变化。

**通过线：** `>= 93/100` 且无语义越界。

### Round 2：HUD 信息架构专家

**评分重点：**
- 玩家能否在首屏看懂中文卡名、类型、链路角色、短效果、目标、授权/payoff 状态。
- 敌意图、End Turn 后果、授权、CHAIN、牌堆没有被卡牌标签挤掉。
- 奖励卡默认信息是否足够，不空渲染。

**通过线：** `>= 90/100`。

### Round 3：移动端可读性 QA 专家

**评分重点：**
- 360px 与 390px 下中文长名/短名无溢出。
- 卡牌按钮高度稳定，不因为标签出现/消失抖动。
- MP 小框、短标签、细边框状态清楚但不抢占阅读。

**通过线：** `>= 90/100`，且 `npm run qa:ui` 三 viewport pass。

### Round 4：规则边界与回归测试专家

**评分重点：**
- `redline-attribute-authorization` 语义未变。
- lifecycle / hand pile 测试语义未变。
- payoff 授权可付/未授权只是展示，不改变 `hudCardPaymentRead()` 以外的规则。
- Reward/upgrade 空壳防护没有阻断真实 pending choices。

**通过线：** `>= 92/100`。

### Round 5：执行制片与集成门禁专家

**评分重点：**
- P0 是否完整覆盖 spec 必须项。
- diff 是否小、清晰、可回滚。
- 命令证据是否齐全。
- 是否没有提交 git、没有触碰禁止文件、没有 P1/P2 抢跑。

**通过线：** `>= 93/100`。最终 approve 后再交主线程决定是否进入实现提交流程。

---

## 10. 最终交付格式

实现 worker 完成后只汇报：

- 改动文件列表。
- 每个验收命令及结果。
- `qa-ui-result.json` 路径。
- 5 专家评分轮分数与阻塞项。
- 明确说明：未提交 git。

不得把 P1/P2 扩展项混入 P0 汇报。
