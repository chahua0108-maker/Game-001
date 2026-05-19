# 2026-05-18 第 5 轮专家 10：制作人综合裁决

角色：第 5 轮制作人综合裁决  
工作目录：`/Users/roc/Game-001`  
范围：只读第 3/4 轮综合文档、当前 `prototype-web` 源码和本轮主题。本文只新增文档，不修改源码，不提交 git。

## 0. 本轮主题

第 5 轮主题只处理：

```text
开放抽牌修补牌与奖励池排序。
```

它不是修补数值轮，也不是 HUD 重排轮，更不是完整卡牌生命周期轮。

## 1. 当前事实基线

第 3 轮已经落地奖励节奏：

- 首奖阈值已收敛到 `12`。
- 奖励选择后会先 `AddCardToDeck`，再进入后续发牌流程。
- 第 3 轮明确不开放 `blood_tithe / pulse_draw`，不重排 `rewardCardPool`。

第 4 轮已经落地奖励分支合同：

- `RewardBranch` 已进入 `types.ts`。
- `CardDefinition.rewardBranches` 已存在。
- `rewardBranchesForCard` 已优先读取显式 `rewardBranches`。
- `blood_tithe` 与 `pulse_draw` 已声明未来奖励分支，但仍是 `availability: 'reserve-test'`，不在 `rewardCardPool`。

当前源码侧关键事实：

- `blood_tithe` 是 0 费 self 抽牌，显式分支为 `repair-resource`。
- `pulse_draw` 是 1 费 self 抽牌，显式分支为 `repair-resource / route-bridge`。
- `rewardCardPool` 当前首轮默认三选一会倾向 `wild_mana_stitch / severance_burst / paper_shatter`。
- `paper_shatter / lantern_captain` 带 `reorder` 概念，但 runtime 未实现真正 reorder。
- self 抽牌实际会按 `drawCards * effectMultiplier` 结算；也就是说 `pulse_draw` 接在 0 费后会实际抽 2，2 费抽牌段接链后会实际抽 3。
- 当前 HUD 和卡牌短文案仍主要显示静态 `抽1`，会和实际倍率抽牌产生可见偏差。

## 2. 制作人总裁决

第 5 轮唯一最小落地方案：

```text
开放 blood_tithe / pulse_draw，并用 rewardCardPool 顺序控制首奖质量；
同步做最小抽牌倍率文案修正；
因为触碰可见 HUD/卡面文案，完成后必须跑浏览器复核。
```

四个点的明确裁决：

| 问题 | 裁决 | 边界 |
| --- | --- | --- |
| 是否开放 `blood_tithe / pulse_draw` | 开放两张 | 从 `reserve-test` 进入当前 run 的 reward 池；不引入消耗、保留、献血扣血或新资源系统。 |
| 是否重排 `rewardCardPool` | 重排 | 只改顺序和加入这两张牌；不改 `buildRewardChoices` 算法。 |
| 是否改 HUD 文案 | 改 | 只改抽牌倍率和奖励进入下一手的短文案；不做 HUD 布局、CSS 重排或移动端大改。 |
| 是否跑浏览器 | 跑 | 实现批次完成后跑桌面和移动端奖励面板/手牌复核；本文档任务本身不启动浏览器。 |

## 3. 最小代码批次建议

### 3.1 卡牌开放

`prototype-web/src/data/cards.ts`：

- `blood_tithe`
  - `availability: 'reward'`
  - `buildRole: 'draw-fixer'`
  - 保持 `rewardBranches: ['repair-resource']`
  - 保持 0 费、self、抽 1，不加扣血，不加局外成长。

- `pulse_draw`
  - `availability: 'reward'`
  - `buildRole: 'draw-fixer'`
  - 保持 `rewardBranches: ['repair-resource', 'route-bridge']`
  - 保持 1 费、self、抽 1，不加额外伤害或状态。

这两张牌本轮只承担“坏手找牌”和“路线续接”的轻量职责，不承担完整 Slay the Spire 式 draw engine。

### 3.2 奖励池顺序

推荐把默认奖励池改成这个顺序：

```ts
export const rewardCardPool: string[] = [
  'blood_tithe',
  'severance_burst',
  'spark_tap',
  'pulse_draw',
  'wild_gap_key',
  'paper_shatter',
  'red_ledger_burst',
  'blood_reclaim',
  'heartbeat_spark',
  'verdict_mark',
  'clearance_order',
  'lantern_captain',
  'wild_mana_stitch'
];
```

理由：

- 首奖三选一应稳定呈现 `blood_tithe / severance_burst / spark_tap`。
- `blood_tithe` 是最干净的修补入口，比 `wild_mana_stitch` 更适合第一个教学奖励。
- `spark_tap` 是真实已实现的路线补牌，比带未实现 `reorder` 语义的 `paper_shatter` 更适合首轮 route 槽。
- `pulse_draw` 放在第一张 route 之后，避免首奖同时出现两张 self 抽牌；但在后续奖励中能接替 repair/route 槽。
- `wild_mana_stitch` 暂时后置，因为它当前同时抽牌和返 MP，强度与解释成本都高；本轮不改数值。

测试应锁住默认首奖：

```text
buildRewardChoices(rewardCardPool, 3, cards)
=> ['blood_tithe', 'severance_burst', 'spark_tap']
```

并额外锁住：

- `rewardCardPool` 包含 `blood_tithe / pulse_draw`。
- `rewardCardPool` 不包含任何 `availability: 'reserve-test'` 的牌。
- 移除 `blood_tithe` 后，`pulse_draw` 能作为后续 repair/route 候选被选出。
- 三分支仍覆盖 `repair-resource / payoff / route-bridge`。

### 3.3 HUD 与卡面文案

必须改，但只做文案级修正。

最低限度：

- 奖励面板说明从“进入后续抽牌循环”改为“选后会进入下一手/后续抽牌”，避免弱化第 3 轮已经落地的即时反馈。
- `pulse_draw` 的短文案要表达接链后会抽 2，而不是只写死 `抽1`。
- `paper_shatter / lantern_captain` 的短文案要表达接链后会抽 3，但不能承诺未实现的真实 reorder 操作。
- 手牌 hover/title 或短规则中如继续使用 `抽1`，必须加“随连锁放大”或显示当前预估抽牌数。

推荐文案方向：

| 卡 | `rulesText` 方向 | `mobileEffect` 方向 |
| --- | --- | --- |
| `blood_tithe` | `抽1。开链找牌。` | `抽1` |
| `pulse_draw` | `抽1，接链抽2。` | `抽1/2` |
| `paper_shatter` | `抽1，接链抽3。找终结。` | `抽1/3` |
| `lantern_captain` | `抽1，接链抽3。找路线。` | `抽1/3` |
| `wild_mana_stitch` | `修补缺口。抽1，当前MP+1。` | `修补 抽1` |

注意：本轮不实现动态规则解释器。若实现者能用现有 `cardChainRead` 在 HUD 中显示当前预计抽牌数，可以做；如果会牵动布局，则退回静态 `抽1/2`、`抽1/3` 文案。

## 4. 本轮不做

- 不改奖励阈值、升级节奏或 `AddCardToDeck` 顺序。
- 不改 `buildRewardChoices` 的三分支算法。
- 不改 `RewardBranch` 类型和第 4 轮合同结构。
- 不削弱 `wild_mana_stitch`，不把返 MP 改成条件触发。
- 不增强 `wild_gap_key` 伤害。
- 不实现 `reorder` runtime。
- 不新增消耗、保留、状态、诅咒、CardInstance、升级、触发器或遗物层。
- 不做敌人新意图、Boss、地图、商店、删牌、reroll 或局外成长。
- 不改 CSS 和 HUD 布局，除非浏览器复核发现新增文案溢出；即使修，也只修溢出。

## 5. 文件边界

建议实现批次最多触碰：

- `prototype-web/src/data/cards.ts`
- `prototype-web/src/ui/hud.ts`
- `prototype-web/src/tests/sim/reward-branching.test.ts`
- `prototype-web/src/tests/sim/card-taxonomy.test.ts`
- `prototype-web/src/tests/ui/hud-target-selection.test.ts` 或新增一个小型 HUD 文案测试

硬边界：

- 不碰 `runtime.ts`。
- 不碰 `rewardChoices.ts`，除非现有测试证明排序无法满足首奖合同。
- 不碰 `style.css`，除非浏览器复核发现实际文本溢出。

## 6. 验收标准

自动化验收：

- `npm test -- --run` 通过。
- `npm run build` 通过；Vite chunk warning 不阻塞本轮。
- `rewardCardPool` 中没有 reserve 牌。
- 默认首奖三选一稳定为 `blood_tithe / severance_burst / spark_tap`。
- `pulse_draw` 在后续奖励中可见，且分支不漂移。
- 抽牌倍率文案不再让玩家以为接链后仍只抽 1。

浏览器验收：

- 必须打开浏览器，因为本轮有可见 HUD/卡面文案变化。
- 桌面宽屏检查：奖励面板三张卡不溢出，手牌短文案不重叠。
- 移动端检查：奖励三选一横向/纵向呈现不遮挡，`抽1/2`、`抽1/3` 不挤破按钮。
- 浏览器复核只用于 UI 可读性，不扩展成视觉重做。

## 7. 制作人最终裁决

第 5 轮应该真正把 `blood_tithe / pulse_draw` 从“已设计但未开放”推进到玩家可抽到的 reward 内容。为了避免首奖变成两个 self 抽牌或未实现 reorder 承诺，本轮必须同时重排 `rewardCardPool`，并把首奖锁成：

```text
blood_tithe / severance_burst / spark_tap
```

HUD 文案必须跟着改，因为当前抽牌实际会吃连锁倍率，而可见文案仍容易读成固定 `抽1`。这属于玩家可见改动，所以实现后必须跑浏览器做桌面和移动端复核。

STATUS: DONE  
路径：`/Users/roc/Game-001/design/technical/redline-batches/long-task/2026-05-18-round-05-10-producer-synthesis.md`
