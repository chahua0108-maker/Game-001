# 2026-05-20 多局难度阶梯第8轮汇总：D1-D3 按钮可读与 D3 容错

## 1. 本轮目标

第7轮 10 名资深玩家复评均分 `89.9/100`，未达到 `95+`。本轮不扩 D4-D10，不做永久成长，不处理 AIRoc 插件或 GitHub 上传，只解决第7轮阻塞点：

- 安全路线按钮本体缺 `下战修补 / 非即时回血`。
- D2 settlement 缺精准断言。
- D3 first-clear 容错偏窄。

## 2. Spec 与审核

新增 spec：

- `design/framework/2026-05-20-redline-d1-d3-core-loop-round-08-spec.zh.md`

框架程序专家结论：`approve-with-changes`。

批准范围：

- RouteSelect 安全路线按钮本体显示 `下战修补`、`非即时回血`，仅作为 HUD 展示，不改 route runtime。
- D2 settlement 精准测试，断言 `进入 D3` 与 `下一局进入6节点长局，优先保守路线`。
- D3 `playerMaxHp 60 -> 62`，不改 6 节点、不改 3 选奖励、不引入 runtime 特例。
- 不扩 D4/D5-D10，不做永久 meta，不跨局继承牌组。

审核要求已落实：

- helper 使用 `choice.tone === 'safe'`，不调用不存在签名的 `routeChoiceKind(choice)`。
- D3 回归保留：victory、6 节点、`rewardPickCount: 3`、通关 HP `> 12` 且 `< D2 clear HP`。

## 3. 已落地

生产改动：

- `prototype-web/src/sim/activity.ts`
  - D3 `playerMaxHp` 从 `60` 调为 `62`。
- `prototype-web/src/ui/hud.ts`
  - 安全路线按钮第二行和 title 保留 `复核+1 · 偏修补`，并补 `下战修补 · 非即时回血`。
  - 不改 route runtime、不改 route kind、不改选择逻辑。

测试改动：

- `prototype-web/src/tests/sim/redline-activity-difficulty.test.ts`
  - D3 first-clear 回归断言 `playerMaxHp === 62`。
  - 保留 D3 6 节点、3 选奖励、通关 HP 区间断言。
- `prototype-web/src/tests/ui/hud-target-selection.test.ts`
  - 安全路线按钮本体断言 `下战修补` 与 `非即时回血`。
  - D2 settlement 断言 `进入 D3` 与 `下一局进入6节点长局，优先保守路线`。

## 4. 验证

RED 证据：

- UI 测试先失败于安全路线按钮本体缺 `下战修补 / 非即时回血`。
- sim 测试先失败于 D3 `playerMaxHp` 仍为 `60`。

GREEN 证据：

- `npm run test:sim -- redline-activity-difficulty.test.ts`
  - `189 passed / 2 skipped`。
- `npm run test:ui -- hud-target-selection.test.ts`
  - `34 passed`。
- `npm run check`
  - `223 passed / 2 skipped`，build 通过；仅保留既有 Vite chunk size warning。
- `QA_ROUND=d1-d3-core-loop-round-08 QA_PORT=5188 npm run qa:ui`
  - `gateScore 20/20`。
  - desktop / 390 / 360 通过。
  - 无 console error、无横向溢出、无文字溢出。
  - 清理通过：`pidAlive=false`、`portListening=false`。
- `QA_JOURNEY_NODES=3 npm run qa:similarity`
  - `gateScore 32/32`。
  - reward route flow、journey gate、build plan visibility 通过。
  - 清理通过：`pidAlive=false`、`portListening=false`。

## 5. 第8轮复评协议

已按用户要求派出：

- 10 名独立资深玩家评分，只评价 D1-D3 核心三局。
- 2 名 QA 专家审查 P0/P1/P2，不给核心体验加分。

评分维度仍为：

| 维度 | 权重 |
| --- | ---: |
| D1 简单可理解 | 20 |
| D2 轻压但不劝退 | 20 |
| D3 明显变难但仍可 first-clear | 25 |
| 三局成长 / 奖励 / 路线连续性 | 20 |
| 失败 / 风险可读性 | 15 |

## 6. 第8轮 10 玩家复评

| 评分员 | 分数 | 主要扣分 |
| --- | ---: | --- |
| P01 | 96 | D3 难度主要来自节点长度和伤害；连续成长不是构筑延续。 |
| P02 | 97 | D2 体感节点不够强；D3 仍主要由保守路径证明。 |
| P03 | 95 | D2 偏数值轻压；连续感主要靠结算文案。 |
| P04 | 94 | D2 仍像更紧一点的 D1；按钮信息密度偏高。 |
| P05 | 93 | D2 缺第二局记忆点；D3 从 3 节点到 6 节点仍有台阶感。 |
| P06 | 94 | D2 独立难度台阶不足；三局连续感偏说明型。 |
| P07 | 96 | D2 还是数值轻压关；缺活动内势能。 |
| P08 | 96 | D2 仍偏 3 节点 + 文案 / 数值差异。 |
| P09 | 90 | 三局连续感靠文案解释，不是可感知承接。 |
| P10 | 94 | D2 缺机制型身份；连续感不够强。 |
| **平均** | **94.5** | 未达到 `95+`。 |

结论：

```text
第8轮没有达到 95+。
10 人均分 94.5，距离目标只差 0.5，但不能宣称完成。
```

## 7. 第8轮 QA

QA 无 P0，无阻塞型 P1。

已关闭上一轮阻塞：

- 安全路线按钮本体包含 `下战修补 / 非即时回血`。
- D2 settlement 有 `进入 D3 / 下一局进入6节点长局，优先保守路线` 精准断言。
- D3 `playerMaxHp: 62` 不破坏中级身份，仍为 intermediate、6 节点、3 选奖励。

P2 / 残余风险：

- `elite-pressure` 致死路线 runtime guard 是全局安全不变量，并未按 D1-D3 限定；这与 HUD 禁选一致，不作为 D4 扩张，但后续如 D4 需要特殊风险策略，应另开 spec。
- 本轮提交必须显式 stage，排除 `.codex/`、QA output、build output 和本地工具状态。

## 8. 第9轮入口

第9轮不再优先调 D3 数值。10 名玩家共识已经收敛到：

- D1 简单和 D3 first-clear 基本过关。
- 风险可读性基本过关。
- 核心分卡在 D2 身份和三局非永久承接。

下一轮目标：

- 给 D2 一个低复杂度、可感知的“第二局开始有取舍”的体验记忆点。
- 给 D1/D2 到 D3 一个不违反边界的活动内承接反馈。
- 仍然不得做永久 meta，不得跨局继承牌组，不得扩 D4-D10。
