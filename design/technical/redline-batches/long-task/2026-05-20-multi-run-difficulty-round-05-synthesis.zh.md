# 2026-05-20 多局难度阶梯第5轮汇总：致死高压路线保护

## 1. 本轮目标

第 4 轮已经让路线按钮能读出“安全推荐路”和“高风险贪心路”。本轮继续处理玩家视角 P0：低血时误点 `elite-pressure` 会立即扣血进入失败结算。

本轮假设：

```text
高风险路线可以保留，但不应该允许一次误点把玩家从可通关 run 直接送进失败结算。
```

## 2. Spec 与审核

新增 spec：

- `design/framework/2026-05-20-redline-fatal-route-protection-spec.zh.md`

框架程序专家结论：`approve`。

允许范围：

- 只改 HUD interaction。
- 只拦截 `elite-pressure` 且 `currentHp <= entryDamage` 的立即致死场景。
- 非致死 `elite-pressure` 仍可选。
- `repair-cache` 不受影响。

明确未做：

- 不改 `runtime.ts` 的 `select-route` 结算语义。
- 不改路线生成、route kind、entryDamage 数值、reward / pressure 语义。
- 不改 activity / run API。
- 不扩 D4-D10。

## 3. 已落地

HUD route choice 新增保护状态：

- 致死 `elite-pressure` 显示 `HP不足，选择会阵亡 · 不可选`。
- 致死 `elite-pressure` 不 emit `select-route` intent。
- 非致死 `elite-pressure` 仍 emit `select-route`。
- `repair-cache` 仍 emit `select-route`。

保护只在 HUD 层生效；后续如果要防脚本或非 HUD 调用绕过，需要另开 runtime guard spec。

## 4. 测试

RED：

- 新增 UI interaction 测试先失败于：
  - elite 按钮缺少 `HP不足 / 会阵亡 / 不可选` 文案。
  - 点击致死 elite 仍 emit `select-route`。

GREEN：

- `npm run test:ui -- hud-target-selection.test.ts` 通过。
- 结果：`31 passed`。

完整门禁和浏览器 QA 在提交前运行。

## 5. 新阶段评分

QA、文档和专家数量不计入核心体验分。本轮直接减少误点导致的失败结算，因此可以加分。

| 维度 | 权重 | 第4轮后 | 第5轮后 | 依据 |
| --- | ---: | ---: | ---: | --- |
| 多局活动结构 | 20 | 12 | 12 | 活动结构未扩。 |
| 新手通关曲线 | 20 | 16 | 17 | 低血误点高压不再直接毁掉 D1-D3 first-clear。 |
| 难度分层清晰度 | 20 | 16 | 17 | 高风险路线仍可选，但致死风险被明确隔离。 |
| 原单局核心保留 | 20 | 20 | 20 | 战斗、奖励、路线收益未改。 |
| UI 可读性 | 10 | 9 | 10 | 致死不可选原因可见，安全/风险/cost 仍可见。 |
| 版权与边界安全 | 10 | 10 | 10 | 无新增版权风险。 |
| **总分** | **100** | **83** | **86** | 误点保护改善明显，但 D4-D10 活动层仍未展开。 |

## 6. 下一轮建议

下一轮应转回多局层次，而不是继续打磨 D1-D3：

- 写 D4-D10 难度曲线 spec。
- 只把 D4 作为下一个可玩切片，D5-D10 作为数据 backlog。
- D4 应作为污染首秀，不要一次性开放 10 档。
