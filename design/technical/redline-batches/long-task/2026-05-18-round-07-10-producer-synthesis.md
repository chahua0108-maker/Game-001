# 2026-05-18 第 7 轮专家 10：制作人综合裁决

角色：第 7 轮专家 10，制作人综合裁决  
工作目录：`/Users/roc/Game-001`  
输出边界：本文只新增 Markdown；不修改源码、不提交 git、不回滚或覆盖其他 agent 改动。  
本轮主题：裁决现在实现真实 `reorder`，还是只做 HUD 信息架构压缩，把 `reorder` 留到第 8 轮。

## 0. 读取基线

已读取前 6 轮综合文档、关键第 6 轮专家文档和当前源码。未发现 `round-07` 其他专家文档，因此本裁决基于现有事实先收敛。

当前事实：

- 第 1-2 轮已经把目标选择、意图预览、卡牌文案四层结构和移动端可读性列为核心验收。
- 第 3-5 轮已经落地首奖节奏、奖励入下一手、奖励分支合同、`blood_tithe / pulse_draw` 开放、抽牌倍率 HUD 文案。
- 第 6 轮刚落地 Wild 修补合同：`CardPlayed.chainRepaired`、`repairedCost`、`energyGainCondition: 'chain-repaired'`、broken chain 后 Wild 不再假修补。
- 当前源码仍没有真实 `reorder` 运行时：没有 `SearchAndTopdeck`、`CardTopdecked`、`DeckSearchMissed`、`pendingReorder`、`confirm-reorder` 或牌堆选择 UI。
- 当前测试仍把 `paper_shatter / lantern_captain` 锁为 self draw support，并断言同 trace 下不出现 `reorder` 命令或事件。
- 当前 HUD 已经承载很多短信息：状态条、授权 chip、战斗导演、deal panel、目标面板、run-layer、enemy-peek、combat-feed、reward panel、card-row；移动端仍靠横向手牌 rail 和短 token 防止溢出。

## 1. 制作人裁决

第 7 轮不实现真实 `reorder`。

第 7 轮只做：

```text
HUD 信息架构压缩。
```

把真实 `reorder` 留到第 8 轮，并且第 8 轮必须先写清楚它到底是自动检索顶置、手动重排、还是抽后选择。第 7 轮不得用半隐式排序偷跑，也不得只改文案让玩家以为已经能重排牌堆。

| 候选项 | 裁决 | 理由 |
| --- | --- | --- |
| 现在实现真实 reorder | 不做 | 需要新增运行时命令/事件、搜索偏好、失败条件、测试合同，且会触碰 `types/runtime/redlineRules/tests/HUD` 多层；第 6 轮刚改 Wild 合同，不适合马上叠第二个运行时机制。 |
| HUD 信息架构压缩 | 本轮做 | 这是当前玩家可见瓶颈。第 5-6 轮持续增加授权、抽牌倍率、Wild 修补、奖励与日志信息，手机端和桌面短行已经接近预算上限。 |
| 继续只写文档不实现 | 不建议作为后续执行批次 | 本轮裁决后应进入一个小 HUD 执行批次，否则第 8 轮 reorder 会叠在已有信息噪声上，验收会失真。 |

一句话裁决：

```text
第 7 轮先把 HUD 变成“能稳定读核心行动”的低噪声战斗层；
第 8 轮再把 paper_shatter / lantern_captain 的 reorder 做成可测试运行时。
```

## 2. 最小实现批次

### 2.1 允许触碰

第 7 轮 HUD 压缩批次最多触碰：

| 文件 | 最小改动 |
| --- | --- |
| `prototype-web/src/ui/hud.ts` | 压缩手牌、状态条、日志、deal panel 的展示优先级；把长句改为短 token；保留 tooltip/detail 承载完整说明。 |
| `prototype-web/src/style.css` | 只修 HUD 布局预算：移动端隐藏/降权低优先级面板、限制日志/卡牌短行、避免 run-layer 与 card-row 争抢高度。 |
| `prototype-web/src/tests/ui/hud-target-selection.test.ts` | 锁住短 token：`抽N仍-X`、`修补MPx`、`授权付`、`整备/找牌` 不承诺 runtime reorder。 |
| 可选新 UI layout/e2e 测试 | 只在项目已有 Playwright/浏览器测试入口可复用时新增；不为本批次引入大测试框架。 |

### 2.2 不允许触碰

第 7 轮硬禁止：

- 不改 `prototype-web/src/sim/types.ts`。
- 不改 `prototype-web/src/sim/runtime.ts`。
- 不改 `prototype-web/src/eca/redlineRules.ts`。
- 不改 `prototype-web/src/sim/rewardChoices.ts`、`rewardProgression.ts`、`runModifiers.ts`。
- 不改 `prototype-web/src/data/cards.ts` 的牌面机制、奖励池顺序或 availability。
- 不新增 `SearchAndTopdeck`、`ReorderDrawPile`、`CardTopdecked`、`DeckSearchMissed`、`confirm-reorder`。
- 不改 `startingHand`、抽牌堆洗回、奖励入下一手、临时授权、Wild 修补、payoff 支付。

### 2.3 HUD 压缩优先级

本批次只压缩信息架构，不重做视觉风格。

1. 手牌按钮只保留五类主信息：费用、角色、目标、链路、当前后果。
2. 手机端主卡面继续隐藏 `.card-effect` 和 `.card-payoff`；抽牌数、修补、授权、意图仍必须出现在 `.card-intent-preview` 或支付短标里。
3. `authorization-cost` 从 `终局授权支付` 压到 `授权付`；`missing-cost` 从 `缺 MP N` 压到 `缺MPN`。
4. self draw 统一显示 `抽N仍-X`；如果带 reorder metadata，只能显示 `整备/找牌` 或 `抽N整备`，不能写“已重排”。
5. `combat-feed` 从机制解释层降为事件回放层，单条日志控制在短句，长解释不进入常驻 HUD。
6. 移动端 `run-layer-panel` 只保留当前 run 节点/最近奖励一行，meta 占位继续隐藏或更低优先级，不得压住手牌 rail。
7. reward panel 继续允许内部滚动，但每张奖励卡两行内必须读出动作和数值。

## 3. 验收标准

### 3.1 自动化验收

至少运行：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test -- src/tests/ui/hud-target-selection.test.ts src/tests/sim/redline-progression-card-system.test.ts src/tests/sim/runtime.test.ts
npm test -- --run
npm run build
```

通过标准：

- `paper_shatter / lantern_captain` 仍不产生 reorder 命令或事件。
- HUD 仍显示 `整备/找牌`，不出现“重排牌库”“选择牌库顶”“已置顶”等未实现承诺。
- self draw 预览保持 `抽1/抽2/抽3仍-X`，不暗示降低敌人意图。
- Wild 修补仍显示真实 `修补MPx`，broken chain 后不显示修补成功。
- 3 MP 全场 `burst` 终结牌才显示授权支付，非 payoff 牌不吃 `tempAuthorizationMP`。

### 3.2 浏览器/布局验收

HUD 批次完成后必须做桌面和移动端复核：

| Viewport | 验收 |
| --- | --- |
| `1366x768` | `status-strip / combat-director / deal-panel / target-panel / run-layer-panel / combat-feed / card-row` 均在 viewport 内；日志不覆盖 run-layer；6 张手牌单行稳定。 |
| `390x844` | `.card-row` 仍为横向 flex rail；手牌按钮不增高；`授权付 / 缺MPN / 抽N仍-X / 修补MPx` 不超出按钮。 |
| `360x640` | 页面无横向滚动；reward panel 可内部滚动；最后一张 reward 可点击；run-layer 不压住手牌。 |

关键 DOM 验收：

- `document.documentElement.scrollWidth <= window.innerWidth + 1`。
- `.card-button strong / .card-meta / .chain-preview / .card-intent-preview / .missing-cost / .authorization-cost` 都落在按钮内。
- `.reward-panel` 不超出 viewport，`.reward-card em` 前两行包含核心动作 token。
- 真实 tap 路径能完成：发牌 -> 打 0/1/2 -> 授权出现 -> 终结牌可授权支付 -> reward 选择 -> 下一手可见奖励牌。

## 4. 风险与回滚

### 4.1 风险

| 风险 | 表现 | 控制方式 |
| --- | --- | --- |
| 信息压缩过度 | 玩家看不懂 `授权付`、`抽N仍-X` 等短 token | 完整解释保留在 tooltip/detail/reward rules；首屏只显示决策词。 |
| HUD 改动误伤机制测试 | UI helper 断言变化导致 sim 合同被误改 | 本轮不改 runtime；sim 测试只作为回归，不为了 UI 文案迁就机制。 |
| 移动端布局被新 token 撑爆 | 360/390 下卡牌、run-layer 或 reward 溢出 | 先缩短文案，再微调 CSS；不通过增高卡牌扩大 HUD 占比。 |
| reorder 被顺手偷跑 | 新增隐式 drawPile 改写但无事件/验收 | 第 7 轮禁止触碰 runtime/types；任何 reorder 运行时都退回第 8 轮专门批次。 |
| 玩家继续误解整备 | `整备/找牌` 被理解成已经搜索牌堆 | 文案保持“整备/找牌”而不是“重排”；测试继续断言无 runtime reorder。 |

### 4.2 回滚

不得使用整仓回滚、整文件覆盖、`git reset --hard` 或 `git checkout --`。

如果 HUD 压缩失败，按小补丁回滚：

1. 只回退本批次改过的 `hud.ts` 文案函数或 CSS 规则。
2. 保留第 3-6 轮已经落地的奖励、Wild、授权、抽牌倍率和测试合同。
3. 若某个短 token 不可读，优先替换单个词，不恢复长句。
4. 若移动端 layout 失败，优先隐藏低优先级面板或缩短日志，不改 runtime。

如果第 8 轮要重启 reorder：

1. 先写 `SearchPreference`、命令、事件和失败条件。
2. 再改 `paper_shatter / lantern_captain` 的数据字段。
3. 最后改 HUD，从“整备/找牌”升级为能反映真实事件的短提示。

## 5. 第 8 轮入口条件

第 8 轮才允许实现真实 reorder，且必须满足：

- 第 7 轮 HUD 压缩已通过桌面和移动端布局验收。
- 仍能清楚区分“抽牌不降意图”和“伤害/payoff 才降意图”。
- 有明确的 reorder 方案：自动检索顶置、手动重排、或抽后选择三者选一。
- 有可观测事件，例如 `CardTopdecked` / `DeckSearchMissed` / `DrawPileReordered`。
- 旧测试中“不出现 reorder runtime”的断言被替换为新事件断言，而不是直接删除。

## 6. 最终裁决

第 7 轮执行：

```text
HUD 信息架构压缩。
```

第 7 轮不执行：

```text
真实 reorder / 检索 / 顶置 / 手动重排。
```

原因不是 reorder 不重要，而是它现在会叠加在已经拥挤的 HUD 和刚变动过的 Wild 运行时合同上。先把玩家首屏能读到的行动线压稳，再在第 8 轮把 `paper_shatter / lantern_captain` 的 `reorder` 兑现成真实、可观测、可测试的小机制。

STATUS: DONE
