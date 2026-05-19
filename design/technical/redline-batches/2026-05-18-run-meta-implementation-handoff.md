# Redline Run / Meta Implementation Handoff

日期：2026-05-18
角色：技术写作 / 交接整理
范围：只整理本轮 run/meta 执行过程和下一轮接手合同；本文件不修改 `prototype-web`。

## 0. 本轮目标总结

本轮目标不是继续扩单局战斗手感，而是把 Redline 从“单局体验封板”推进到 **单次冒险 / run** 与 **局外成长 / meta** 的边界定义。

当前结论：

```text
P0 已经应该围绕单手牌和单局战斗封板：
读懂敌意图 -> 0 -> 1 -> 2 清算链 -> 本回合终局授权 -> 3 费 armed payoff。

下一轮要转向：
本次 run 如何承接战斗奖励、卡组变化和轻量 build 路线；
局外成长只定义边界，不进入实现主线。
```

核心裁决：

- **单次循环发牌 / 单局战斗**：当前 demo 的 P0 主体验，继续以 `0 -> 1 -> 2 -> payoff` 作为验收合同。
- **单次冒险 / run**：下一轮主要接手对象，负责 run 内卡组、奖励三分支、轻量战斗串联和 run 内状态记录。
- **局外成长 / meta**：只保留字段和文案边界，暂不实现账号存档、永久属性、永久 Max MP 或解锁池。

## 1. 本轮已有产物和事实基线

已形成的关键文档：

- `design/technical/redline-batches/2026-05-18-expert-lens-synthesis.zh.md`
- `design/technical/redline-batches/2026-05-18-progression-card-system-synthesis.zh.md`
- `design/technical/redline-batches/2026-05-18-progression-card-system-implementation-plan.md`
- `design/technical/redline-batches/2026-05-18-progression-card-system-qa.md`
- `design/technical/redline-batches/2026-05-18-experience-boundary-review-04.md`
- `design/technical/redline-batches/2026-05-18-system-model-boundary-05.md`
- `design/technical/redline-batches/2026-05-18-attribute-system-synthesis.zh.md`

当前工作区已经有其他 worker 的 `prototype-web` 改动和多个未跟踪文档。下一轮 agent 必须先执行 `git status --short --branch`，只接管自己负责的文件，不 revert 其他人的改动。

## 2. 层级边界

| 层级 | 推荐中文名 | 生命周期 | 当前处置 |
| --- | --- | --- | --- |
| 单次循环发牌 | 本回合 / 本手牌 | 发牌到结束回合 | P0 已封板，后续只修验收缺口 |
| 单局战斗 | 当前遭遇 | 一场战斗内 | P0 已封板，保持 3-5 回合样片 |
| 单次冒险 | 本次清算 / run | 从开始 run 到失败或通关 | 下一轮主战场 |
| 局外成长 | 局外授权 / meta | 跨 run 保留 | 只定义边界，暂不实现 |

### Run 应该负责

- 本次 run 的 `deck`、奖励记录、奖励候选池。
- 多场遭遇之间保留的卡组变化。
- 轻量 build 路线，例如 `consistency`、`resource`、`ceiling`。
- 3 场以内的最小 encounter 串联或固定脚本。
- run 内 XP / level / reward 语义，但不得叫账号等级。

### Meta 暂时只负责边界

- 字段名和文案不得把 run 内奖励误写成永久成长。
- 未来可放 `AccountProfile`、永久解锁、局外货币、存档版本。
- 当前不进入 runtime、HUD 或奖励实现。

## 3. 下一轮推荐分工

### Worker A：Run State / Model Boundary

职责：

- 明确 `RunState` 的最小字段：`runId`、`deck`、`rewardHistory`、`currentEncounterIndex`、`candidateCardPool`。
- 把当前 `player.deck/xp/level/reward` 的语义标注为 run 内状态，不解释成账号成长。
- 如果暂不拆代码文件，也要提供类型或 adapter 层，避免 HUD 和 QA 直接猜字段生命周期。

文件边界：

- `prototype-web/src/sim/types.ts`
- `prototype-web/src/sim/world.ts`
- 可新增 run state 测试，例如 `prototype-web/src/tests/sim/run-state-boundary.test.ts`

不得改：

- 不做账号存档。
- 不做永久解锁池。
- 不重写整个 battle runtime。

### Worker B：Run Reward / Encounter Transition

职责：

- 把奖励从“当前战斗后临时面板”整理为 run 内事件。
- 奖励三选一保持 `consistency`、`resource`、`ceiling` 三分支。
- 奖励加入 run deck 后，下一场或下一轮发牌能看到明确证据。
- 记录 `RewardOffered`、`RewardPicked`、`rewardBranch` 和来源。

文件边界：

- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/sim/world.ts`
- `prototype-web/src/sim/rewardChoices.ts`
- `prototype-web/src/tests/sim/reward-branching.test.ts`

不得改：

- 不做商店。
- 不做事件池。
- 不做地图节点。
- 不把 `Max MP +1` 塞进 P0 默认奖励。

### Worker C：Minimal Run Script / 3-Encounter Contract

职责：

- 写一个最小 run 合同：2-3 场固定遭遇或固定脚本，证明奖励能跨遭遇影响后续战斗。
- 只使用当前卡牌和敌人，不扩内容池。
- 明确每场遭遇的目标：教学链、坏手修补、armed payoff、奖励回应。

文件边界：

- `design/technical/redline-batches/` 下新增合同文档。
- 如需要实现，限定在 `prototype-web/src/sim/world.ts`、`runtime.ts` 和对应 sim 测试。

不得改：

- 不做完整地图。
- 不做随机路线。
- 不引入 boss、商店或事件系统。

### Worker D：Meta Boundary / Copy Guard

职责：

- 审查 HUD、卡牌描述、奖励文案是否误用“成长、升级、永久、Max MP”。
- 给局外成长预留术语表，但不实现 UI。
- 输出文案 guardrail，确保 run 内奖励和局外成长不会混淆。

文件边界：

- `prototype-web/src/data/cards.ts`
- `prototype-web/src/ui/hud.ts`
- `design/technical/redline-batches/` 下的文案审查文档。

不得改：

- 不做账号面板。
- 不做存档设置。
- 不新增永久属性展示。

### Worker E：QA / Evidence

职责：

- 验证 P0 单局合同没有被 run/meta 改动破坏。
- 验证奖励跨 run 内遭遇生效，但 run 重开后回到基础 deck。
- 验证没有任何路径依赖永久 `maxEnergy > 3`。
- 采集桌面和移动端证据。

文件边界：

- `prototype-web/src/tests/**`
- `outputs/browser-qa/redline-run-meta/2026-05-18/`
- `design/technical/redline-batches/` 下的 QA 摘要。

不得改：

- 不改 runtime 逻辑。
- 不改 HUD 布局。

## 4. 文件边界总表

| 方向 | 可动文件 | 禁止跨界 |
| --- | --- | --- |
| Run state | `prototype-web/src/sim/types.ts`、`world.ts` | 不引入账号存档 |
| Reward transition | `runtime.ts`、`world.ts`、`rewardChoices.ts` | 不做商店 / 地图 / 事件池 |
| Card metadata | `cards.ts`、相关 taxonomy 测试 | 不扩大量新卡 |
| HUD copy | `hud.ts`、`style.css`、UI 测试 | 不改变支付规则 |
| QA | `prototype-web/src/tests/**`、`outputs/browser-qa/**` | 不顺手修 runtime |
| 文档 | `design/technical/redline-batches/**` | 不把设计文档当实现完成 |

## 5. 明确不做

下一轮 agent 必须显式避免以下事项：

- 不做完整地图。
- 不做商店。
- 不做事件池。
- 不做永久 `Max MP` 成长。
- 不做账号存档。
- 不继续扩单局战斗手感。
- 不继续扩大量新卡、新敌人、新 VFX。
- 不把 `tempAuthorizationMP`、`energyGain` 或 run 内奖励写成局外永久成长。
- 不用隐藏测试夹具把 MP 改到 6 来证明 payoff 合法。

## 6. 主要风险

| 风险 | 表现 | 处理方式 |
| --- | --- | --- |
| 生命周期混淆 | run 奖励被写成账号成长 | 文案、字段、测试都使用 `run` / `本次清算` |
| P0 回归 | run 改动破坏 `0 -> 1 -> 2 -> payoff` | 每次 run 变更后先跑 P0 sim 和 HUD 测试 |
| Worker 分叉 | 不同 worker 各自定义 payoff / reward 分支 | 先共享 card taxonomy 和 rewardBranch 合同 |
| Scope 膨胀 | 一做 run 就开始地图、商店、事件池 | 下一轮只允许固定 2-3 遭遇脚本 |
| QA 不可复现 | 浏览器自然发牌无法稳定看到关键路径 | sim 固定状态兜底，browser 只验证玩家可见证据 |
| 文案误导 | `授权 +3` 被玩家理解成永久 MP | HUD 必须写“本回合”“结束清空”“只付清算牌” |

## 7. 验收命令

接手前检查：

```bash
cd /Users/roc/Game-001
git status --short --branch
```

P0 回归验收：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test -- src/tests/sim/redline-attribute-authorization.test.ts
npm run test -- src/tests/sim/redline-progression-card-system.test.ts
npm run test -- src/tests/sim/reward-branching.test.ts
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

浏览器验收至少覆盖：

- Desktop：`1440x1000` 或 `1280x720`
- Mobile：`390x844`
- 完成 `0 -> 1 -> 2` 后仍是 `MP 3 / 3`，只出现本回合终局授权。
- 选择奖励后进入本次 run 的 deck / draw flow。
- 重开 run 后基础状态恢复，不保留账号级成长。

## 8. 下一轮 agent 接手清单

1. 先读本文件，再读 `2026-05-18-progression-card-system-implementation-plan.md` 和 `2026-05-18-system-model-boundary-05.md`。
2. 执行 `git status --short --branch`，确认已有 `prototype-web` 改动归属。
3. 不要 revert 任何未授权改动。
4. 先定 `RunState` 最小字段和 reward 生命周期，再动 runtime。
5. 如果需要并行，先让 Card / Reward / Runtime / HUD / QA 五组共享同一个 payoff 和 rewardBranch 合同。
6. 任何实现完成后，先跑 P0 回归，再跑 run/meta 新测试。
7. 最终交付必须写清楚：哪些是本次 run 内有效，哪些未来才属于局外成长。

## 9. 交接结论

本轮已经把“继续做单局手感”切换为“开始定义 run/meta 边界”。下一轮的正确重点不是做大系统，而是用最小 run state 和固定 2-3 遭遇证明：

```text
战斗奖励能进入本次清算；
本次清算能影响后续遭遇；
重开后不会误保留成局外成长；
P0 的 0 -> 1 -> 2 -> armed payoff 不回归。
```
