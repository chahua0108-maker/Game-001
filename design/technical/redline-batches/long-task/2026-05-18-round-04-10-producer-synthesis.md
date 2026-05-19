# 2026-05-18 第 4 轮专家 10：制作人综合与落地裁决

角色：第 4 轮制作人综合与落地裁决  
工作目录：`/Users/roc/Game-001`  
范围：只读前三轮综合文档、第 4 轮已落盘专家文档和当前 `prototype-web` 源码后形成的主线程裁决。本文只新增文档，不修改源码，不提交 git。

## 0. 读取范围

前三轮综合与制作人文档：

- `2026-05-18-round-01-synthesis.zh.md`
- `2026-05-18-round-02-synthesis.zh.md`
- `2026-05-18-round-03-synthesis.zh.md`
- `2026-05-18-round-01-10-producer-synthesis.md`
- `2026-05-18-round-02-10-engineering-producer-synthesis.md`
- `2026-05-18-round-03-10-producer-synthesis.md`

第 4 轮已落盘专家文档：

- `2026-05-18-round-04-01-reward-branch-contract-architect.md`
- `2026-05-18-round-04-04-repair-card-balance-implementation.md`
- `2026-05-18-round-04-06-card-mechanic-replica-checklist.md`
- `2026-05-18-round-04-07-ui-overflow-card-reading-qa.md`
- `2026-05-18-round-04-08-reward-repair-test-contract.md`

当前源码重点读取：

- `prototype-web/src/data/cards.ts`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/sim/rewardChoices.ts`
- `prototype-web/src/sim/rewardProgression.ts`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/sim/world.ts`
- `prototype-web/src/ui/hud.ts`
- reward / run / card taxonomy 相关测试文件

## 1. 当前事实基线

前三轮已经完成的收敛：

- 第 1 轮：P0 Hyper-Turn 已收敛到 `0 -> 1 -> 2 -> 临时授权 -> 3 MP payoff -> 敌意图减压`。
- 第 2 轮：卡牌语言已结构化，`CardDefinition` 具备 `cardType / chainRole / cycleRole / buildRole / availability / rulesText / mobileEffect / keywords / detail`。
- 第 3 轮：奖励节奏已落到首奖阈值 `12`、单调阈值表、奖励选择后进入下一手、restart 不保留 run 奖励。

当前源码侧事实：

- `buildRewardChoices` 已按 `repair-resource -> payoff -> route-bridge` 三分支取牌，不再是旧的简单前三张。
- `RewardBranch` 目前只定义在 `rewardChoices.ts` 内部，`CardDefinition` 没有正式 `rewardBranches` 字段。
- `rewardBranchesForCard` 现在依赖启发式字段和 fallback id 集合。只要某张牌因 `availability / chainRole / cycleRole / buildRole` 改动命中启发式，fallback 就不再执行。
- `blood_tithe` 与 `pulse_draw` 已有卡定义，但仍是 `availability: reserve-test`，不在 `rewardCardPool`。如果只把它们改成 `reward`，很可能从 repair 语义漂移成纯 route。
- `wild_mana_stitch` 过强、`wild_gap_key` 反馈偏弱、`paper_shatter / lantern_captain` 的 `reorder` 未实现，这些都是真问题，但它们不是同一个最小代码批次。

## 2. 第 4 轮专家分歧

本轮专家材料给出四条方向：

- 奖励分支合同架构：建议先把 `rewardBranches` 提升为 `CardDefinition` 正式字段，本轮不要同时开放新牌或重排完整奖励池。
- 修补牌数值落地：建议 `wild_mana_stitch` 改为修补成功才返 MP，`wild_gap_key damage 1 -> 2`。
- 完整卡牌机制复刻清单：列出消耗、保留、状态牌、实例、触发器等缺口，但明确不要一轮做完。
- UI / 测试合同：提醒移动端文本、奖励面板、真实 tap 与 reward repair 测试必须跟上。

制作人判断：这些方向都合理，但不能塞进同一个主线程代码批次。第 4 轮只允许落一个最小可验收改动，优先级应是 **先锁合同，再改内容**。

## 3. 本轮唯一最小代码改动

主线程第 4 轮应该只落地：

```text
奖励分支显式合同：把 rewardBranches 变成 CardDefinition 的正式字段，并用测试锁住不漂移。
```

这不是“开放新牌”的批次，也不是“修补数值”的批次。它是后续开放 `blood_tithe / pulse_draw`、重排奖励池和修补 `wild_mana_stitch` 前必须先打下的合同层。

推荐代码边界：

1. `prototype-web/src/sim/types.ts`
   - 新增：
     ```ts
     export type RewardBranch = 'repair-resource' | 'payoff' | 'route-bridge';
     ```
   - 在 `CardDefinition` 增加：
     ```ts
     rewardBranches?: RewardBranch[];
     ```

2. `prototype-web/src/sim/rewardChoices.ts`
   - 从 `types.ts` 导入 `RewardBranch`。
   - `rewardBranchesForCard(card)` 优先读取非空 `card.rewardBranches`。
   - 启发式推导和 fallback id 集合只作为迁移期兼容。
   - 不再把新增卡牌长期依赖 `availability / chainRole` 推导当作正式合同。

3. `prototype-web/src/data/cards.ts`
   - 给当前 `rewardCardPool` 内所有卡补 `rewardBranches`。
   - 给 `blood_tithe`、`pulse_draw` 也补 `rewardBranches`，但本轮不改它们的 `availability`，不把它们加入 `rewardCardPool`。
   - 推荐标注：
     - `blood_tithe`: `['repair-resource']`
     - `pulse_draw`: `['repair-resource', 'route-bridge']`
     - `wild_mana_stitch / wild_gap_key`: `['repair-resource']`
     - `severance_burst / red_ledger_burst`: `['payoff']`
     - 0/1/2 路线攻击与 2 费自抽支援：`['route-bridge']`

4. 测试
   - `rewardCardPool` 内每张牌都必须有非空 `rewardBranches`。
   - `rewardCardPool` 不允许包含 `availability: reserve-test`。
   - 显式 `rewardBranches` 优先级高于启发式和 fallback。
   - 克隆 `blood_tithe / pulse_draw` 并把 `availability` 改成 `reward` 后，`rewardBranchesForCard` 仍不丢 `repair-resource`。
   - 修改 `chainRole` 不应影响已有显式 `rewardBranches` 的返回结果。
   - 现有 `buildRewardChoices` 仍按 `repair-resource -> payoff -> route-bridge` 工作。

允许文件上限：

- 源码最多 3 个文件：`types.ts`、`rewardChoices.ts`、`cards.ts`。
- 测试最多 2 个文件：优先 `reward-branching.test.ts` 和 `card-taxonomy.test.ts`。
- 不碰 `runtime.ts`、`redlineRules.ts`、`hud.ts`、`style.css`。

## 4. 本轮明确不做

- 不把 `blood_tithe / pulse_draw` 改成正式 reward，不加入 `rewardCardPool`。
- 不重排 `rewardCardPool`，不把首轮 route 槽从 `paper_shatter` 改到 `spark_tap`。
- 不改 `wild_mana_stitch` 的 `energyGain` 或新增 `energyGainCondition`。
- 不改 `wild_gap_key` 伤害。
- 不实现 `reorder` runtime。
- 不做 `exhaust / retain / status / curse / CardInstance / upgrade / trigger`。
- 不改敌人意图、不加蓄力重击、不做 Boss、地图、商店、局外成长或永久 Max MP。
- 不做 HUD / CSS 大改；UI 文本问题只保留为下一批 QA 约束。

理由：这些都是有效问题，但每一个都会改变玩家体验或 runtime 语义。它们必须等 `rewardBranches` 合同稳定后分批做，不能和合同迁移混在一起。

## 5. 验收标准

第 4 轮代码批次完成后，只验这些：

- `npm test -- --run` 通过。
- `npm run build` 通过；Vite 500 kB chunk warning 不阻塞本轮。
- `RewardBranch` 从 `types.ts` 导出，`CardDefinition.rewardBranches` 存在。
- `rewardBranchesForCard` 对显式 `rewardBranches` 的返回不受 `availability / chainRole / cycleRole / buildRole` 漂移影响。
- 当前 `rewardCardPool` 中每张牌都有合法、非空、去重后的 `rewardBranches`。
- 当前 `rewardCardPool` 不包含 `availability: reserve-test` 的牌。
- `blood_tithe` 与 `pulse_draw` 即使仍是 reserve，也已经声明未来奖励分支；克隆为 reward 后不会变成纯 route。
- 现有奖励三选一仍能覆盖 `repair-resource / payoff / route-bridge`。
- 起始牌组、奖励阈值、奖励入下一手、restart 清空 run 奖励等前三轮合同不回归。

## 6. 下一轮主题

第 5 轮建议主题：

```text
开放抽牌修补牌与奖励池排序。
```

第 5 轮才处理玩家可见内容变化：

- 决定 `blood_tithe / pulse_draw` 是否从 `reserve-test` 开放为 `reward`。
- 决定默认 `rewardCardPool` 排序，让首轮三选一更像“修补 / payoff / 路线”。
- 决定 `pulse_draw` 抽牌吃倍率是否作为正式规则展示。
- 按第 4 轮 UI QA 合同做移动端奖励面板和卡牌短文案复核。

第 5 轮仍不应同时改 `wild_mana_stitch` 条件返 MP、`wild_gap_key` 伤害、reorder runtime 和完整卡牌生命周期。那些应排到第 6 轮以后，或拆成单独数值/生命周期批次。

## 制作人最终裁决

第 4 轮主线程只落地 `rewardBranches` 显式合同。它是最小、最稳、对后续所有修补牌池改动收益最高的代码改动。

不要在同一个批次里开放 `blood_tithe / pulse_draw`、重排奖励池、削弱 `wild_mana_stitch` 或补完整卡牌生命周期。先把奖励分支身份变成正式、可测、不会漂移的合同，再进入玩家可见内容变化。

STATUS: DONE  
路径：`/Users/roc/Game-001/design/technical/redline-batches/long-task/2026-05-18-round-04-10-producer-synthesis.md`
