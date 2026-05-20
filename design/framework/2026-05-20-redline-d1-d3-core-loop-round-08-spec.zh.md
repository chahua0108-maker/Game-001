# Redline D1-D3 核心三局第8轮 Spec

日期：2026-05-20

状态：待框架程序专家审核；审核通过前不得实现。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or equivalent task-by-task review discipline. Steps use checkbox syntax for tracking.

## Goal

把 D1-D3 核心三局从第7轮 `89.9/100` 推向 `95+`，只解决玩家复评和 QA 指出的当前阻塞：安全路线按钮本体可读、D2 settlement 验收缺口、D3 first-clear 容错偏窄、D2/D3 连续承接不够强。

## Architecture

本轮保持活动层 / run 层 / 战斗层 / HUD 层边界。优先改展示和测试；若需要 D3 容错调整，只允许在 `ActivityLevelDefinition` 的 D3 数值里做最小调整，不新增 runtime 特例。不得做永久 meta、不得跨局继承牌组、不得扩 D4-D10。

## Tech Stack

TypeScript、Vitest、Vite、现有 `prototype-web` runtime / HUD / QA 脚本。

---

## 1. 背景

第7轮后 10 名资深玩家复评分：

| P | 分数 |
| --- | ---: |
| P01 | 95 |
| P02 | 88 |
| P03 | 93 |
| P04 | 89 |
| P05 | 86 |
| P06 | 92 |
| P07 | 88 |
| P08 | 91 |
| P09 | 87 |
| P10 | 90 |
| **平均** | **89.9** |

没到 `95+` 的主因：

- D2 仍偏薄，主要靠数值而不是玩家可感知的新取舍。
- D3 保守路径可通，但真实玩家 first-clear 容错仍偏窄。
- 三局连续感主要靠结算说明，不够像活动内稳定变强。
- 安全路线顶部 summary 写了 `非即时回血`，但按钮本体没有，移动端可能被省略。

QA 阻塞：

- RouteSelect 安全路线按钮本体必须出现 `非即时回血` 或等价明确文案。
- D2 settlement 必须有精准测试。
- 提交时必须排除 `.codex/`、QA 输出和无关文件。

## 2. 本轮非目标

本轮不做：

- 不处理 AIRoc 插件。
- 不上传 GitHub。
- 不扩 D4/D5-D10。
- 不新增选关 UI。
- 不做永久 meta、账号成长、局外成长。
- 不让 D1/D2 奖励牌进入 D2/D3 初始牌组。
- 不重写奖励系统、路线生成系统、污染系统、XP 阈值或战斗核心。
- 不引入教程弹窗、复杂新手引导或二次确认弹窗。

## 3. 允许文件

允许修改：

- `prototype-web/src/ui/hud.ts`
  - RouteSelect 安全路线按钮本体文案。
  - D1-D3 settlement 的玩家向承接文案。
  - 只新增纯展示 helper，不改变 runtime state。
- `prototype-web/src/tests/ui/hud-target-selection.test.ts`
  - 补安全路线按钮本体断言。
  - 补 D2 settlement 精准断言。
- `prototype-web/src/tests/sim/redline-activity-difficulty.test.ts`
  - 如调整 D3 数值，补 first-clear 稳定性断言。
- `prototype-web/src/sim/activity.ts`
  - 只有在框架专家批准后，才允许最小调整 D3 `ActivityLevelDefinition` 数值。
- `design/technical/redline-batches/long-task/2026-05-20-multi-run-difficulty-round-08-synthesis.zh.md`
  - 记录本轮结果。

禁止修改：

- D4/D5-D10 定义或可玩列表。
- route generation runtime。
- reward generation runtime。
- pollution runtime。
- permanent storage / meta progression。
- build output、QA output、`.codex/`。

## 4. 方案

### 4.1 RouteSelect 安全路线按钮本体

问题：第7轮只在顶部 summary 写了 `安全下战修补/复核+1/非即时回血`，但按钮本体仍可能只显示 `复核+1 · 偏修补`，移动端 summary 被省略时会误读。

实现要求：

- `repair-cache` 按钮本体必须出现：
  - `下战修补`
  - `非即时回血`
- 按钮 title 也必须包含这两个短语。
- 不改变 route 实际效果。
- `elite-pressure` 按钮继续显示 HP 代价、污染状态和 disabled reason。

审核修正后的建议实现：

```ts
function routeButtonRewardDetail(choice: HudRouteChoiceRead): string {
  if (choice.tone === 'safe') {
    return `${choice.modifierToken} · 下战修补 · 非即时回血`;
  }

  return `${choice.modifierToken} · ${choice.rewardToken}`;
}
```

然后 `renderRouteChoices` 的第二个 `<small>` 和 `title` 使用该 helper。

### 4.2 D2 settlement 精准验收

问题：D2 settlement 文案已实现，但测试只覆盖 D1 和 D3。

实现要求：

- UI test 必须构造 D2 victory settlement。
- 断言包含：
  - `进入 D3`
  - `下一局进入6节点长局，优先保守路线`
- 该测试不得要求 D4/D5-D10 改动。

### 4.3 D3 first-clear 容错

问题：第7轮 P07/P10 明确反馈，熟练保守脚本能通，但真实 first-clear 容错仍偏窄，D3 后半段可能在 5/6 前后死亡。

优先顺序：

1. 先补测试，证明当前 D3 结算 HP 仍在低容错区间，且比 D2 明显更紧。
2. 如果测试已能表达 D3 first-clear 足够稳定，则不调数值，只改 UI 提示。
3. 如果测试显示 D3 容错不足，才允许最小数值调整。

允许的 D3 数值调整候选，必须由框架专家选一档或否决：

| 档位 | `playerMaxHp` | `enemyHpMultiplier` | `enemyDamageMultiplier` | `rewardPickCount` | 理由 |
| --- | ---: | ---: | ---: | ---: | --- |
| A 保守不调 | 60 | 0.88 | 0.85 | 3 | 只补文案与测试。 |
| B 轻微容错 | 62 | 0.88 | 0.85 | 3 | 增加 2 HP 缓冲，保留 6 节点和 3 选奖励。 |
| C 奖励容错 | 60 | 0.88 | 0.85 | 4 | 让 D3 first-clear 靠奖励选择宽度，不加 HP。 |

本 spec 建议 **B 轻微容错**，理由：

- P07/P10 的问题是后半段 HP 窄，不是奖励系统不可读。
- `+2 max HP` 是最小玩家容错杠杆，不改变 D3 的 6 节点身份。
- `rewardPickCount` 继续保持 3，保留 D2 -> D3 的奖励收紧。
- D3 通关 HP 仍必须低于 D2 自然通关 HP。

禁止调整：

- `nodeCount` 不得从 6 降回 3/4/5。
- `eliteRouteAddsPollution` 不得重新打开，污染仍留给 D4 首秀。
- 不得降低到 D2 强度。

### 4.4 三局连续感

本轮只允许做玩家可读承接，不做真正跨局成长。

允许：

- Settlement 文案更明确地说：
  - D1：`已完成 1/3`
  - D2：`已完成 2/3`
  - D3：`核心三局已打通`
- D2 -> D3 文案强调 `长局`、`保守路线`。

不允许：

- 活动内 carryover token。
- 跨局牌组继承。
- 局外成长或永久属性。

如第8轮后仍卡在连续成长，下一轮再单独写 `轻量活动内非永久承接 token` spec，并由框架专家审核。

## 5. TDD 任务

### Task 1: 安全路线按钮本体可读

**Files:**

- Modify: `prototype-web/src/tests/ui/hud-target-selection.test.ts`
- Modify: `prototype-web/src/ui/hud.ts`

- [ ] Step 1: 在 UI test 里补断言

断言 `run-1-node-1-to-2-repair-cache` 按钮 HTML 包含：

```ts
expect(repairButton?.[0] ?? '').toContain('下战修补');
expect(repairButton?.[0] ?? '').toContain('非即时回血');
```

- [ ] Step 2: 运行失败测试

```bash
cd /Users/roc/Game-001/prototype-web
npm run test:ui -- hud-target-selection.test.ts
```

预期：新增断言失败。

- [ ] Step 3: 在 `hud.ts` 增加纯展示 helper

```ts
function routeButtonRewardDetail(choice: HudRouteChoiceRead): string {
  if (routeChoiceKind(choice) === 'repair-cache') {
    return `${choice.modifierToken} · 下战修补 · 非即时回血`;
  }

  return `${choice.modifierToken} · ${choice.rewardToken}`;
}
```

并用于 route button title 与第二行 `<small>`。

- [ ] Step 4: 运行 UI 测试通过。

### Task 2: D2 settlement 精准断言

**Files:**

- Modify: `prototype-web/src/tests/ui/hud-target-selection.test.ts`

- [ ] Step 1: 在 D1-D3 settlement 测试里加入 D2 victory snapshot。

断言：

```ts
expect(root.innerHTML).toContain('进入 D3');
expect(root.innerHTML).toContain('下一局进入6节点长局，优先保守路线');
```

- [ ] Step 2: 运行 UI 测试通过。

### Task 3: D3 first-clear 容错最小调整

**Files:**

- Modify: `prototype-web/src/tests/sim/redline-activity-difficulty.test.ts`
- Optional Modify after expert approval: `prototype-web/src/sim/activity.ts`

- [ ] Step 1: 检查现有 D3 first-clear 回归是否已断言：
  - D3 仍为 6 节点。
  - D3 victory。
  - D3 结算 HP > 12。
  - D3 结算 HP < D2 结算 HP。

- [ ] Step 2: 如果现有测试已覆盖，先不新增重复测试。

- [ ] Step 3: 框架专家已批准 B 档，把 D3 `playerMaxHp` 从 `60` 改成 `62`。

- [ ] Step 4: 更新对应断言，确保 D3 仍明显低于 D2，不退回新手难度。

### Task 4: 门禁

**Files:**

- Modify: `design/technical/redline-batches/long-task/2026-05-20-multi-run-difficulty-round-08-synthesis.zh.md`

- [ ] Step 1: 运行聚焦测试

```bash
cd /Users/roc/Game-001/prototype-web
npm run test:sim -- redline-activity-difficulty.test.ts
npm run test:ui -- hud-target-selection.test.ts
```

- [ ] Step 2: 运行完整门禁

```bash
cd /Users/roc/Game-001/prototype-web
npm run check
```

- [ ] Step 3: 运行浏览器 QA

```bash
cd /Users/roc/Game-001/prototype-web
QA_ROUND=d1-d3-core-loop-round-08 QA_PORT=5188 npm run qa:ui
QA_JOURNEY_NODES=3 npm run qa:similarity
```

必须确认：

- desktop / 390 / 360 通过。
- 无 console error。
- 无横向溢出。
- 无文字溢出。
- RouteSelect 按钮本体可见 `下战修补 / 非即时回血`。
- D2 settlement 可见 `进入 D3 / 6节点长局`。
- 清理 `pidAlive=false`、`portListening=false`。

### Task 5: 复评

- [ ] 派 10 名独立资深玩家评分，仍按 D1 简单、D2 轻压、D3 first-clear、三局连续、风险可读五项。
- [ ] 派 2 名 QA 专家审查 P0/P1/P2。
- [ ] 只有 10 人均分 `>=95` 且 QA 无阻塞 P1，才允许声明达到 95+。
- [ ] 如果没到 95，继续下一轮 spec，不 final 停止。

## 6. 框架程序专家审核问题

请审核：

1. 本 spec 是否仍严格限定在 D1-D3 核心三局。
2. RouteSelect 按钮本体文案 helper 是否是纯展示，不改变 route runtime。
3. D2 settlement 测试是否足以关闭 QA P2。
4. D3 `playerMaxHp 60 -> 62` 是否可以作为最小 first-clear 容错杠杆；如果不批准，应选择 A 保守不调并说明原因。
5. 是否仍避免永久 meta、跨局牌组继承、D4/D5-D10 扩张。

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

## 7. 框架程序专家审核结论

decision: approve-with-changes

approved-scope:

- 限定在 D1-D3 核心三局，D4 只作为 D3 后续提示 / 防 D5-D10 泄漏验证出现。
- RouteSelect 安全路线按钮本体显示 `下战修补`、`非即时回血`，仅用于 HUD title 和按钮第二行 `<small>`。
- D2 settlement 精准测试，断言 `进入 D3` 与 `下一局进入6节点长局，优先保守路线`。
- D3 `playerMaxHp 60 -> 62`，不改 6 节点、不改奖励 3 选、不引入 runtime 特例。
- 继续避免永久 meta、跨局牌组继承、D4/D5-D10 扩张。

required-changes:

- helper 示例改为基于 `choice.tone === 'safe'` 的纯展示判断，不调用不存在签名的 `routeChoiceKind(choice)`。
- D3 调到 62 后，必须保留断言：D3 victory、仍 6 节点、`rewardPickCount` 仍 3、通关 HP `> 12` 且 `< D2 clear HP`。

implementation-notes:

- 不批准 C 档 `rewardPickCount 4`，因为会削弱 D2 -> D3 的奖励收紧感。
- D2 settlement 测试只补 D2 victory snapshot，不触碰 D4/D5-D10。
