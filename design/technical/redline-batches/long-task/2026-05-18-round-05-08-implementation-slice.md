# 2026-05-18 Round 05-08 工程实现切片：开放抽牌修补牌与奖励池排序

角色：第 5 轮专家 08，工程实现切片负责人  
工作目录：`/Users/roc/Game-001`  
边界：只读当前源码和 tests；本文只新增实现切片文档，不修改源码、不提交 git、不回滚他人改动。

## 0. 当前源码事实

当前工作树已有多名 agent 的未提交改动。本切片不能把目标文件当成空白重写。

已落地的事实：

- `prototype-web/src/data/cards.ts` 中 `blood_tithe` 仍是 `availability: 'reserve-test'`，但已带 `rewardBranches: ['repair-resource']`。
- `prototype-web/src/data/cards.ts` 中 `pulse_draw` 仍是 `availability: 'reserve-test'`，但已带 `rewardBranches: ['repair-resource', 'route-bridge']`。
- `prototype-web/src/sim/types.ts` 已有 `RewardBranch` 和 `CardDefinition.rewardBranches`。
- `prototype-web/src/sim/rewardChoices.ts` 已按 `repair-resource -> payoff -> route-bridge` 生成三选一，且显式 `rewardBranches` 优先。
- `prototype-web/src/sim/runtime.ts` 已在 `AddCardToDeck` 使用 `drawPile.unshift(cardId)`，非终局 `select-reward` 已先入牌再发下一手。
- 当前 `rewardCardPool` 仍是 11 张，不包含 `blood_tithe` / `pulse_draw`。

结论：如果本轮主线程要落地“开放 `blood_tithe` / `pulse_draw` + reward pool 排序”，源码最小面应主要落在 `cards.ts`。不要重写 `runtime.ts`、`rewardChoices.ts`、`types.ts`、HUD 或 CSS，除非实现者先证明当前合同缺失。

## 1. 最小源码改动

### 1.1 必改：`prototype-web/src/data/cards.ts`

只改三处。

第一，开放 `blood_tithe`：

- `buildRole: 'reserve-test' -> 'draw-fixer'`
- `availability: 'reserve-test' -> 'reward'`
- 保持 `cost = 0`、`damage = 0`、`targets = 'self'`、`drawCards = 1`
- 保持 `rewardBranches: ['repair-resource']`
- 不加入 `startingHand`

第二，开放 `pulse_draw`：

- `buildRole: 'reserve-test' -> 'draw-fixer'`
- `availability: 'reserve-test' -> 'reward'`
- 保持 `cost = 1`、`damage = 0`、`targets = 'self'`、`drawCards = 1`
- 保持 `rewardBranches: ['repair-resource', 'route-bridge']`
- 建议把短规则改成 `抽1。续链抽牌+。`，移动端短文案改成 `抽1续链+`，避免接在 0 MP 后实际抽 2 时像 bug

第三，重排并扩展 `rewardCardPool`。若本轮同时接受“开放 + 排序”，推荐数组为：

```ts
export const rewardCardPool: string[] = [
  'wild_mana_stitch',
  'red_ledger_burst',
  'spark_tap',
  'wild_gap_key',
  'severance_burst',
  'verdict_mark',
  'blood_tithe',
  'pulse_draw',
  'blood_reclaim',
  'clearance_order',
  'paper_shatter',
  'lantern_captain',
  'heartbeat_spark'
];
```

这个顺序的意图：

- 首奖仍是 `repair-resource / payoff / route-bridge`。
- route 首槽从 2 MP self draw 支援转为 `spark_tap`，更像“补路线入口”。
- `blood_tithe` / `pulse_draw` 不抢首奖，作为 Wild 被选走后的修补后备。
- `paper_shatter` / `lantern_captain` 后置，避免首奖 route 被未实现 reorder 的 2 MP 自抽牌抢走。

如果制作人最终想让首奖修补更教学化，可以只把前两个 repair 的相对位置改成 `wild_gap_key` 早于 `wild_mana_stitch`，但必须同步改默认三选一测试期望。

### 1.2 不改源码

本切片不应触碰：

- `prototype-web/src/sim/runtime.ts`：奖励下一手可见已经存在。
- `prototype-web/src/sim/rewardChoices.ts`：显式分支合同已经存在。
- `prototype-web/src/sim/types.ts`：类型已经足够表达本切片。
- `prototype-web/src/ui/hud.ts` / `style.css`：本轮只改卡牌短文案，不做 UI 布局。
- `startingHand`：两张抽牌修补牌不能进起手教学。
- `cost`、`damage`、`energyGain`、`maxEnergy`、XP 阈值、run/meta 生命周期。

## 2. 最小测试改动

### 2.1 必改：`prototype-web/src/tests/sim/card-taxonomy.test.ts`

扩展现有 reward pool 合同：

- `rewardCardPool` 包含 `blood_tithe` 与 `pulse_draw`。
- `rewardCardPool` 仍不存在缺失定义。
- `rewardCardPool` 中没有任何 `availability === 'reserve-test'` 的牌。
- `cards.blood_tithe.availability === 'reward'`。
- `cards.pulse_draw.availability === 'reward'`。
- 两张牌都是 `targets: 'self'`、`cardType: 'draw'`、`cycleRole: 'draw-fixer'`、`buildRole: 'draw-fixer'`、`drawCards: 1`、`damage: 0`。
- 两张牌都不是 payoff / finisher。

### 2.2 必改：`prototype-web/src/tests/sim/reward-branching.test.ts`

锁住排序和分支语义：

- `rewardBranchesForCard(cards.blood_tithe)` 包含且至少保留 `repair-resource`。
- `rewardBranchesForCard(cards.pulse_draw)` 包含 `repair-resource`，可同时包含 `route-bridge`，但不能包含 `payoff`。
- `buildRewardChoices(rewardCardPool, 3, cards)` 精确等于：

```text
wild_mana_stitch
red_ledger_burst
spark_tap
```

- 三个槽分别命中 `repair-resource`、`payoff`、`route-bridge`。
- route 首槽不能是 `paper_shatter` 或 `lantern_captain`。
- 模拟移除 `wild_mana_stitch` 与 `wild_gap_key` 后，下一次 choices 仍有 repair，优先由 `blood_tithe` 或 `pulse_draw` 补上。

### 2.3 视主线程改动而定

如果主线程只改 `cards.ts`，现有 runtime 测试已经覆盖两个关键事实：

- `runtime.test.ts` 已覆盖 `debt_hook -> pulse_draw` 后 `effectMultiplier = 2` 且抽牌数放大。
- `runtime.test.ts` / `runtime-audit.test.ts` 已覆盖空抽牌堆时 `blood_tithe` 不会立刻把自己洗回手牌。

如果主线程还调整 reward 选择验收，建议只加窄测试：

- `progression-reward-regression.test.ts`：强制 reward choices 包含 `blood_tithe` / `pulse_draw`，选择后下一手包含所选牌。
- `run-layer-boundary.test.ts`：参数化选择 `blood_tithe` / `pulse_draw`，断言只进入当前 run，`restart-run` 后不留在基础 deck，`maxEnergy` 仍为 3。
- `hud-target-selection.test.ts`：若改了 HUD copy，则给 `blood_tithe` 补一条 self draw 不降低敌意图的 preview 断言。

推荐定向命令：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test -- src/tests/sim/card-taxonomy.test.ts src/tests/sim/reward-branching.test.ts src/tests/sim/progression-reward-regression.test.ts src/tests/sim/run-layer-boundary.test.ts src/tests/sim/runtime.test.ts src/tests/ui/hud-target-selection.test.ts
```

若这些文件外还有改动，再跑：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run
```

## 3. 风险

| 风险 | 影响 | 控制点 |
| --- | --- | --- |
| 只改 `availability` 不改 `buildRole` | 正式奖励牌仍带 `reserve-test` 身份，后续 UI / 测试读法混乱。 | 两张牌同步改为 `buildRole: 'draw-fixer'`。 |
| 分支漂移 | `blood_tithe` / `pulse_draw` 被当成纯 route，repair 后备仍枯竭。 | 保留显式 `rewardBranches`，测试锁 `repair-resource`。 |
| `pulse_draw` 文案与真实抽牌不一致 | 接 0 MP 后抽 2，玩家以为抽牌随机或 bug。 | `rulesText/mobileEffect/detail` 明示续链抽牌增强。 |
| `wild_mana_stitch` 继续压过其它修补 | 首奖 repair 仍可能变成自动选项。 | 本切片只做排序和开放，不改数值；若制作人要教学优先，改为 `wild_gap_key` 前置。 |
| reward 精确顺序测试过脆 | 后续制作人换排序会引发测试失败。 | 只在本轮明确接受该排序时写精确断言；否则改为分支 + 禁止 paper/lantern 抢首槽。 |
| self draw 不能直接减压 | 奖励后下一手可能更稳定，但当前回合敌意图压力没有下降。 | HUD preview 继续显示抽牌找解，不显示虚假减伤。 |
| 多 agent 脏文件被覆盖 | 破坏他人已落地合同。 | 只做小 hunk patch；禁止整文件替换和 git 回滚。 |

## 4. 回滚点

不能使用 `git reset --hard`、`git checkout --` 或整文件覆盖。只能按本轮 hunk 小补丁回退。

| 回滚点 | 回滚内容 | 不应回滚内容 |
| --- | --- | --- |
| R1：开放状态 | 把 `blood_tithe` / `pulse_draw` 的 `availability` 回到 `reserve-test`，`buildRole` 回到 `reserve-test`。 | 不删除既有 `rewardBranches` 字段；它是第 4 轮合同。 |
| R2：奖励池 | 从 `rewardCardPool` 移除 `blood_tithe` / `pulse_draw`，或只恢复本轮排序数组。 | 不改 `startingHand`、不改 reward progression。 |
| R3：文案 | 只恢复两张牌本轮改过的 `rulesText/mobileEffect/detail`。 | 不碰 HUD/CSS。 |
| R4：测试 | 删除或调整本轮新增的精确排序 / 开放断言。 | 不回滚已有 P0 授权、run/meta、reward next-hand、HUD preview 测试。 |

若 `pulse_draw` 单独出问题，优先只回滚 `pulse_draw` 的开放与池内条目，保留 `blood_tithe`；它是低风险 0 MP 抽 1 修补后备。

## 5. 验收清单

- `rewardCardPool` 包含 13 张，且没有 `reserve-test`。
- 首奖三选一稳定覆盖 repair / payoff / route。
- `blood_tithe` / `pulse_draw` 不进入 `startingHand`。
- 选择任一新增 reward 后，非终局下一手能看到该牌。
- restart 后两张 reward 不保留到基础 deck。
- `maxEnergy` 仍为 3，开放抽牌修补不等于永久 MP 成长。
- `pulse_draw` 的倍率抽牌有测试和短文案解释。

STATUS: DONE
