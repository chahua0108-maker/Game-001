# 2026-05-18 Round 04-09 工程风险与回滚边界审查

角色：第 4 轮专家 09，工程风险与回滚边界审查员  
工作目录：`/Users/roc/Game-001`  
范围：只读审查当前工作树；评估如果本轮继续修改 `data/cards.ts`、`types.ts`、`rewardChoices.ts`、`tests`，会触碰哪些已有未提交改动、哪些行为不能改、最小可落地范围是什么。  
限制：本文只新增审查记录，不修改源码、不提交 git、不回滚或覆盖其他 agent 改动。

## 当前结论

本轮不能把 `cards.ts`、`types.ts`、`rewardChoices.ts` 和测试当成空白工作区继续重写。当前工作树已经有一组互相耦合的未提交改动：

- `prototype-web/src/data/cards.ts` 已新增完整卡牌 taxonomy、移动端短文案、detail 文案，并调整了 `rewardCardPool` 顺序。
- `prototype-web/src/sim/types.ts` 已新增 run state、临时授权、payoff 证据事件、支付记录和 snapshot 字段。
- `prototype-web/src/sim/rewardChoices.ts` 是未跟踪新文件，已经承载奖励三分支选择。
- 多个测试文件既有修改又有未跟踪新增，正在锁定 P0 授权、奖励三分支、run/meta 边界、HUD 文案与 deterministic targeting。

所以第 4 轮最小安全策略是：**只做窄合同修正，不再扩系统**。如果必须继续改上述文件，只允许围绕“卡牌分类字段与奖励三分支合同一致性”做局部补丁；不要顺手改 runtime、HUD、发牌、敌人、XP、最大 MP 或 run/meta 生命周期。

## 当前工作树触碰面

### 已修改且与本轮目标直接冲突的文件

| 文件 | 当前状态 | 已有未提交内容 | 本轮风险 |
| --- | --- | --- | --- |
| `prototype-web/src/data/cards.ts` | modified | 每张卡新增 `cardType / chainRole / cycleRole / buildRole / availability / rulesText / mobileEffect / keywords / detail`；文案从 mana 改为 MP；`rewardCardPool` 顺序已调整。 | 再改会直接影响 card taxonomy、HUD 标签、reward branching、P0 文案边界。 |
| `prototype-web/src/sim/types.ts` | modified | 新增 `RunState`、`RunStatus`、卡牌 taxonomy 类型、`tempAuthorizationMP`、`AuthorizationGranted`、`CardPaymentRecorded`、`PayoffResolved`、`ResolvePayoff`、snapshot.run。 | 任何字段重命名都会级联破坏 runtime、snapshot、HUD、测试。 |
| `prototype-web/src/tests/sim/core-loop-regression.test.ts` | modified | 默认单体目标从随机前排改为最高当前意图目标，移除了 `Math.random` mock。 | 不要恢复随机目标；这已成为可复现核心循环合同。 |
| `prototype-web/src/tests/sim/progression-reward-regression.test.ts` | modified | 首奖阈值锁为 `12`；奖励选择后进入下一手 `hand`，不再留在 `drawPile`。 | 不要把奖励牌回退到 draw pile 底部语义。 |
| `prototype-web/src/tests/sim/redline-hyperturn-acceptance.test.ts` | modified | 明确 2 MP route segment 只武装 3 MP payoff；`severance_burst` 才产生 armed payoff 证据。 | 不要把 `clearance_order` 重新当成 payoff。 |
| `prototype-web/src/tests/ui/hud-target-selection.test.ts` | modified | 新增授权支付、HUD 角色标签、意图预览、run/meta copy guard 测试。 | 不要改 HUD helper 合同来迁就数据层漂移。 |

### 未跟踪且本轮会踩到的新增文件

| 文件 | 当前状态 | 作用 | 风险 |
| --- | --- | --- | --- |
| `prototype-web/src/sim/rewardChoices.ts` | untracked | 奖励三分支生成器：`repair-resource`、`payoff`、`route-bridge`。 | 这是别的 worker 的新模块，不应删除或重建；若要改，只能局部修正分类映射。 |
| `prototype-web/src/tests/sim/card-taxonomy.test.ts` | untracked | 锁定 16 张卡 taxonomy 字段和 payoff 角色边界。 | 改 `cards.ts/types.ts` 必须同步保持通过。 |
| `prototype-web/src/tests/sim/reward-branching.test.ts` | untracked | 锁定奖励三分支不是 `slice(0, 3)`。 | 改 `rewardChoices.ts` 必须保留三分支覆盖。 |
| `prototype-web/src/tests/sim/redline-attribute-authorization.test.ts` | untracked | 锁定 temp MP 授权、支付来源、armed payoff、回合结束清空。 | 不得用 `maxEnergy > 3` 绕过授权。 |
| `prototype-web/src/tests/sim/redline-progression-card-system.test.ts` | untracked | 锁定 P0 授权、run 内奖励、payoff 集合、Wild 修补、reorder 未实现。 | 不得把文案标签当 runtime 行为。 |
| `prototype-web/src/tests/sim/run-layer-boundary.test.ts` | untracked | 锁定 run/meta 边界和 restart baseline。 | 不得让奖励跨 run 保留为局外成长。 |
| `prototype-web/src/tests/sim/run-progression.test.ts` | untracked | 锁定 `run` snapshot、reward history、run victory / restart。 | 不要改 `RunState` 字段名，除非同步所有消费者。 |
| `prototype-web/src/tests/sim/run-modifiers.test.ts` | untracked | 锁定 run modifier 只是 preview-only settlement growth。 | 不要把 run modifier 接入 P0 runtime。 |

### 目标外但强耦合的脏文件

| 文件 | 当前状态 | 为什么相关 |
| --- | --- | --- |
| `prototype-web/src/sim/runtime.ts` | modified | 已接入 `buildRewardChoices`、`nextLevelXp`、临时授权支付、run reward history、reward 入手顺序、deterministic target。 |
| `prototype-web/src/sim/world.ts` | modified | 已初始化 `RunState`、授权字段和 12 XP 首奖阈值。 |
| `prototype-web/src/sim/snapshot.ts` | modified | 已把 `run` 深拷贝进 snapshot。 |
| `prototype-web/src/eca/redlineRules.ts` | modified | 已把 `PayoffResolved` 限定为 3 MP all-enemies burst payoff。 |
| `prototype-web/src/ui/hud.ts` / `style.css` | modified | 已消费新 taxonomy、授权与 run/meta copy。 |

这些文件不在本次指定修改范围内，但目标文件一改很容易让它们断。第 4 轮后续实现者应先读局部 diff，再决定是否真的需要碰它们。

## 不能改的行为合同

1. P0 授权是本回合资源，不是永久成长：`maxEnergy` 必须保持 3；`tempAuthorizationMP` 结束回合清空；`authorizationRestriction` 只允许 `payoff-only`。
2. 只有 `cost = 3`、`targets = all-enemies`、`comboNode = burst` 的牌是终局 payoff。当前只有 `severance_burst` 和 `red_ledger_burst`。
3. `clearance_order` 是 2 MP 展开 / route segment，不是 3 MP payoff；它可以完成 `0 -> 1 -> 2` 授权，但不能被授权支付，也不能产生 `PayoffResolved`。
4. Wild 是 repair，不是永久 MP 成长。`wild_mana_stitch` 的 `energyGain` 只返还当前回合 MP；`wild_gap_key` 只修补费用缺口。
5. `paper_shatter`、`lantern_captain` 的 `reorder` 目前只是标签 / 文案，不是已实现 runtime 重排。
6. 奖励选择属于当前 run：选中卡进入当前 deck / 下一手；`restart-run` 后回到 `startingHand`，不保留为局外成长。
7. 奖励三选一必须覆盖 repair/resource、payoff、route/bridge 三类，不要退回 `candidateCardPool.slice(0, 3)`。
8. 开局 `startingHand` 不应在本轮变动；它承担教学 0 -> 1 -> 2 的基线。
9. 默认前排单体目标已改成“最高当前意图优先”，不要回到随机目标，否则测试和玩家可解释性都会回退。
10. HUD 和测试中不得出现 `最大 MP +3`、`永久升级`、`局外成长已生效` 之类把 P0 授权误解成 meta growth 的文案。

## 推荐最小可落地范围

### 允许的最小补丁

| 文件 | 允许做什么 |
| --- | --- |
| `prototype-web/src/data/cards.ts` | 只修 taxonomy / 文案错配，例如 `availability`、短文案长度、`clearance_order` 不被称为 payoff、reserve 牌状态。不要改 cost、damage、targets、comboNode、startingHand。 |
| `prototype-web/src/sim/types.ts` | 只做向后兼容的 additive 类型补充，例如补一个缺失 union literal。不要重命名 `RunState`、`CardDefinition` 字段、GameEvent 或 Command 字段。 |
| `prototype-web/src/sim/rewardChoices.ts` | 只修三分支分类映射、alias 或 fallback。保留 `repair-resource / payoff / route-bridge` 三类和按优先级各取一张的行为。 |
| `prototype-web/src/tests/**` | 优先新增窄合同测试；如必须改现有测试，只改与当前合同一致的断言，不做大范围重排。 |

### 不建议本轮做

- 不新增 CardInstance、卡牌升级、消耗、保留、状态牌 runtime。
- 不开放完整 meta progression、账号存档、永久解锁池。
- 不改 `runtime.ts` 的支付流程、reward 选择流程或 run 结算流程，除非先证明目标文件改动无法独立通过。
- 不改 HUD 布局和 CSS；HUD 当前已有大量未提交改动，风险高。
- 不改敌人 XP、敌人意图数值、HAND_SIZE、发牌策略或随机性。
- 不把 `blood_tithe` / `pulse_draw` 从 `reserve-test` 放入正式奖励池，除非另起小批次并补 reward branching 与坏手体验验收。

## 回滚边界

因为工作树已有他人未提交改动，回滚不能用 `git reset --hard`、`git checkout --` 或整文件覆盖。只能按文件和语义做小补丁回退。

| 回滚点 | 可回滚内容 | 不应回滚内容 |
| --- | --- | --- |
| R1：卡牌 taxonomy | 本轮新增或改错的单张卡字段、短文案、`keywords`。 | 不要删除整套现有 taxonomy 字段；HUD 和 rewardChoices 已依赖它。 |
| R2：类型扩展 | 本轮新增的 union literal 或可选字段。 | 不要移除现有 `RunState`、授权字段、`PayoffResolved`、`CardPaymentRecorded`。 |
| R3：reward branching | 本轮新增 alias、fallback 卡组映射。 | 不要删除 `rewardChoices.ts`；它是当前 runtime import 的新模块。 |
| R4：测试补丁 | 本轮新增测试文件或局部断言。 | 不要回滚已存在的 P0 授权、run/meta、HUD helper 测试，除非明确知道是自己改坏的。 |

实际回滚建议：

```bash
cd /Users/roc/Game-001
git diff -- prototype-web/src/data/cards.ts prototype-web/src/sim/types.ts prototype-web/src/sim/rewardChoices.ts prototype-web/src/tests
```

先人工定位本轮新增 hunk，再用小 patch 撤掉；不要整文件替换，因为这些文件当前包含多个 agent 的工作。

## 验收建议

本次只读基线已执行：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test -- --reporter=dot
```

结果：

- 13 个测试文件通过，1 个测试文件跳过。
- 98 个用例通过，2 个用例跳过。

后续如果只动本轮目标文件，最小验收应跑：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test -- src/tests/sim/card-taxonomy.test.ts src/tests/sim/reward-branching.test.ts src/tests/sim/redline-attribute-authorization.test.ts src/tests/sim/redline-progression-card-system.test.ts src/tests/sim/run-layer-boundary.test.ts src/tests/sim/run-progression.test.ts src/tests/ui/hud-target-selection.test.ts
```

若测试文件或类型定义发生任何跨模块变化，再跑完整：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test -- --reporter=dot
```

不要在本审查范围内跑 `npm run build` 作为默认动作，因为 build 会生成输出目录，不属于只读测试命令。

## 最终裁决

第 4 轮如果继续触碰 `data/cards.ts`、`types.ts`、`rewardChoices.ts`、`tests`，应被视为在已有实现栈上做收口，而不是新开系统。

推荐最小落点：

1. 保留当前卡牌 taxonomy 和 reward branching 框架。
2. 只修分类、文案、fallback 或测试合同中的错配。
3. 不触碰 P0 授权、payoff、run/meta、HUD 布局和 reward 入手顺序。
4. 用 targeted sim / HUD helper 测试证明没有回归。
5. 如发现需要大改 runtime 或 HUD，应停止本轮，把它拆成下一批明确 ownership 的任务。

STATUS: DONE

路径：`/Users/roc/Game-001/design/technical/redline-batches/long-task/2026-05-18-round-04-09-engineering-risk-review.md`
