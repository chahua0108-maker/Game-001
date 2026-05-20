# 2026-05-20 多局难度阶梯第7轮汇总：D1-D3 核心三局复评

## 1. 本轮目标

本轮只看 D1-D3 核心三局循环，不处理 AIRoc 插件、不处理 GitHub 上传、不扩 D4-D10。

本轮假设：

```text
如果 D2 的轻压力、D3 的 first-clear 可通性、路线代价和结算承接都足够可读，
前三局应该从“能通”提升为“像一套活动里的前期闯关体验”。
```

## 2. 评分协议

本轮按用户要求改为固定协议：

- 10 名独立资深卡牌 / 肉鸽玩家评分。
- 每位评分员只围绕 D1 -> D2 -> D3 核心三局，从简单到难打分。
- 2 名 QA 专家只审查 P0/P1/P2，不给核心体验加分。
- QA、测试、文档和自动化只作为门禁，不计入 `coreScore`。

评分维度：

| 维度 | 权重 |
| --- | ---: |
| D1 简单可理解 | 20 |
| D2 轻压但不劝退 | 20 |
| D3 明显变难但仍可 first-clear | 25 |
| 三局成长 / 奖励 / 路线连续性 | 20 |
| 失败 / 风险可读性 | 15 |

## 3. 第7轮前评分

第7轮实现前，10 名玩家均分：

| 评分员 | 分数 |
| --- | ---: |
| P01 | 82 |
| P02 | 82 |
| P03 | 87 |
| P04 | 78 |
| P05 | 83 |
| P06 | 88 |
| P07 | 94 |
| P08 | 88 |
| P09 | 81 |
| P10 | 84 |
| **平均** | **84.7** |

共识问题：

- D2 身份偏薄，玩家不明显感到第二局开始有新取舍。
- D1-D3 更像连续难度解锁，不像活动内逐步成长。
- `repair-cache` 容易被误读为即时回血。
- HUD 禁用低血 elite route，但 runtime 直接 `select-route` 缺同等防线。
- D2 elite、D2/D3 标题、D2/D3 refill 倍率、D1-D3 settlement 文案需要精准回归。

## 4. Spec 与审核

新增并执行 spec：

- `design/framework/2026-05-20-redline-d1-d3-core-loop-95-spec.zh.md`

框架程序专家结论：`approve-with-changes`。

已按审核意见收窄：

- runtime guard 只允许拦截 `elite-pressure` 且 `entryDamage >= hp` 的直接 intent。
- guard 不扣血、不推进节点、不自动改选、不进入 Settlement。
- D3 结算文案只说明核心三局完成，不改 D4 定义或流程。
- 不允许 D4/D5-D10、永久 meta、跨局牌组继承、奖励系统或路线系统改动。

## 5. 已落地

核心改动：

- `prototype-web/src/sim/runtime.ts`
  - 直接 `select-route` 选择致死 elite route 时拒绝 intent。
  - 写入 `failedConditions`，`conditionId: route-pressure-lethal`。
  - 保持 RouteSelect、当前节点、HP 和 run 状态不变。
- `prototype-web/src/ui/hud.ts`
  - D1/D2/D3 settlement 增加下一局承接说明。
  - route summary 明确 `下战修补`、`非即时回血`、高风险路线 HP/污染代价。
- `prototype-web/src/tests/sim/redline-activity-difficulty.test.ts`
  - 覆盖 D2 elite 轻压力、D1-D3 直接致死 route guard、D2/D3 refill 倍率、范围保护。
- `prototype-web/src/tests/ui/hud-target-selection.test.ts`
  - 覆盖 D2/D3 活动标题、route summary、D1/D3 settlement 文案。

## 6. 验证

已通过：

- `npm run test:sim -- redline-activity-difficulty.test.ts`
  - `33 passed / 1 skipped` 文件内，整体 `189 passed / 2 skipped`。
- `npm run test:ui -- hud-target-selection.test.ts`
  - `34 passed`。
- `npm run check`
  - `223 passed / 2 skipped`，build 通过，仅保留既有 Vite chunk warning。
- `QA_ROUND=d1-d3-core-loop-95 QA_PORT=5187 npm run qa:ui`
  - `gateScore 20/20`，desktop / 390 / 360 通过，无 console error、无横向溢出、无文字溢出，清理 `pidAlive=false`、`portListening=false`。
- `QA_JOURNEY_NODES=3 npm run qa:similarity`
  - `gateScore 32/32`，三节点 journey gate / reward route flow / build plan visibility 通过，清理通过。

## 7. 第7轮后10玩家复评

完整复评结果：

| 评分员 | 分数 | 主要扣分 |
| --- | ---: | --- |
| P01 | 95 | D2 体验差异仍主要靠数值；三局没有卡牌肉鸽式 build 延续。 |
| P02 | 88 | D2 身份薄；D1-D3 更像难度关卡而非连续成长。 |
| P03 | 93 | D2 identity 不够；连续感主要靠说明。 |
| P04 | 89 | 结算连续感不够强；D3 从 3 节点到 6 节点仍偏陡。 |
| P05 | 86 | D2 玩法身份不足；缺少真正成长感。 |
| P06 | 92 | D2 偏薄；路线文案可读但略硬。 |
| P07 | 88 | D3 first-clear 容错偏窄；D2 记忆点不足。 |
| P08 | 91 | 三局更像难度解锁，成长感还不够强。 |
| P09 | 87 | 缺少活动内 carryover 感，但不能做永久成长。 |
| P10 | 90 | D3 后半段容错不足；HUD 信息偏满。 |
| **平均** | **89.9** | 未达到 `95+`。 |

结论：

```text
第7轮没有达到 95+。
10 人均分 89.9，且 QA 仍有阻塞型 P1。
必须继续第8轮。
```

## 8. QA 结论

QA 无 P0。

阻塞型 P1：

- 安全路线按钮本体没有显示 `非即时回血` / `下战修补`，移动端如果顶部 summary 被省略，玩家仍可能误读为即时回血。
- 第7轮提交必须明确排除 `.codex/` 和 QA 输出，避免范围污染。

P2：

- D2 settlement 虽然实现了 `进入 D3 / 6节点长局`，但缺精准 UI 断言。
- route button 本体与顶部 summary 的可读性不一致。

## 9. 第8轮入口

第8轮不扩 D4-D10，不做永久成长，不跨局继承牌组。

下一轮目标：

- 安全路线按钮本体也必须写出 `下战修补 / 非即时回血`。
- D2 settlement 必须精准断言 `进入 D3` 与 `下一局进入6节点长局，优先保守路线`。
- D3 first-clear 容错要从测试脚本可通，推进到资深玩家认为更稳定的 first-clear。
- 三局连续感优先用活动内结果回顾 / 下一局提示 / 玩家可读承接解决；如需新轻量 carryover token，必须另开 spec 并由框架专家审核。
