# 2026-05-18 Round 10-07：风险 / Backlog / 范围控制分诊

角色：第 10 轮专家 07，风险 / Backlog / 范围控制负责人  
工作目录：`/Users/roc/Game-001`  
输出边界：只写本文档；不改源码、不提交、不回滚、不覆盖其他 worker 文件。  

## 0. 总裁决

第 10 轮不应继续扩机制。当前工作区已经包含大量 `prototype-web` 变更、run/meta 草案、自动 QA 脚本和第 1-9 轮文档。剩余工作应转成收束：

```text
P0 只修验收阻断和文档口径冲突；
P1 才推进 run 内成长、路线整备、路线节点和更完整 QA；
冻结完整 reorder、lantern_captain、discard search、账号存档、永久成长、大美术动画和大地图系统。
```

P0 结论：**当前唯一必须现在守住的是可交付样片边界**：`paper_shatter` drawPile-only 顶终结、P0 战斗合同、三档 UI 自动 QA、run/meta 不暗改核心战斗。其他想法不得在第 10 轮继续实现。

## 1. 当前基线

- 第 7 轮已经裁决不做完整 `SearchAndTopdeck`，只允许后续极窄样片。
- 第 8 轮已经落地 `paper_shatter` 独占的 drawPile-only payoff 置顶样片。
- 第 9 轮已经把浏览器验收自动化为 `npm run qa:ui`，覆盖 `1366x768`、`390x844`、`360x640`。
- run/meta 文档明确：账号局外成长、永久 Max MP、存档和完整地图不进入当前实现主线。
- 当前 `git status` 显示已有大量未提交源码、测试、脚本和文档变更；第 10 轮继续加功能会显著增加合并和归因风险。

## 2. Backlog 分层

### 必须现在修：P0

| 项 | 处理 |
| --- | --- |
| 验收命令口径不一致 | 统一文档中第 9 轮之后的真实命令：`npm run check`、`npm run qa:ui`。旧的手工浏览器口径只保留为历史或 fallback。 |
| `paper_shatter` 样片边界 | 确认文档都写成 drawPile-only、payoff-only、`lantern_captain` 不触发、discard 不搜索。 |
| QA 证据可读性 | 保留 `outputs/browser-qa/round-09/qa-ui-result.json` 作为证据来源；文档里不能只写“看起来通过”。 |
| run/meta 术语边界 | 当前只允许“本次 run / 本次清算 / preview-only”；不得把奖励、Max MP 或修补包写成账号永久成长。 |
| 合并风险提示 | 第 10 轮文档必须提醒后续 worker：先 `git status`，只接管自己文件，不 revert 他人改动。 |

### 可进下一阶段：P1

| 项 | 处理 |
| --- | --- |
| `lantern_captain` route-only 置顶 | 下一阶段单独验证，目标是找路线牌，不找 payoff，不和 `paper_shatter` 同轮开启。 |
| run 内成长 / modifier 接入 | 可以从 preview-only 进入 runtime adapter，但必须证明 restart 后清空，不进入账号存档。 |
| 2-3 场固定遭遇脚本 | 可以作为 run 层最小证明；只串联已有卡和敌人，不做地图、商店、事件池。 |
| 有限 route 节点语义 | 可以定义 route / repair / payoff 三分支节点，但先做数据合同和 QA，不做完整路线图。 |
| 自动 QA 扩展 | 可以补 run/restart 边界、reward 面板移动端选择、失败证据 Markdown；不做平台化。 |

### 必须冻结：P2 或更晚

| 项 | 处理 |
| --- | --- |
| 完整 reorder / scry / tutor / redraw | 冻结。需要候选 UI、取消流程、牌区生命周期、移动端交互和新平衡模型。 |
| discard search | 冻结。会删除错过窗口的代价，并让整备接近完整 tutor。 |
| 账号局外成长 / 存档 / 永久 Max MP | 冻结。当前只写边界，不接 `AccountProfile`、存档迁移、永久货币或永久解锁。 |
| 完整路线节点 / 地图 / 商店 / 事件池 | 冻结。第 10 轮不打开 roguelite 大结构。 |
| 大规模美术、动画、VFX、音效 | 冻结。可写美术方向，不做资产生产和动画系统扩张。 |
| QA 平台 / 截图基线 / CI 矩阵 / 录像系统 | 冻结。当前只保留窄浏览器验收脚本。 |

## 3. 风险镜头

| # | 风险镜头 | 优先级 | 触发信号 | 冻结 / 推进建议 |
| ---: | --- | --- | --- | --- |
| 1 | 完整 reorder 被重新打开 | P0 | 开始设计 `SearchAndTopdeck` 通用命令、手动排序、牌库浏览或 top-N UI。 | **冻结。** 当前只承认 `paper_shatter` 的 drawPile-only 样片；完整 reorder 进入 P2。 |
| 2 | `lantern_captain` 变成第二张找终结牌 | P0 | `lantern_captain` 搜 payoff、repair+payoff 混合，或和 `paper_shatter` 同时启用真实 topdeck。 | **冻结本轮，P1 单独推进。** 下一阶段只能 route-only，且必须证明不抬高 payoff 率。 |
| 3 | discard search 删除错过窗口 | P0 | 搜索 `discardPile`、从弃牌堆捞刚错过的 payoff、日志出现 discard 来源。 | **冻结。** 只有 drawPile-only 可保留；discard search 至少等 CardMoved/CardDrawn 统一证据后再评估。 |
| 4 | 局外成长污染 P0 战斗 | P0 | 文案或代码把 run 奖励写成永久成长、默认 Max MP > 3、奖励跨 restart 保留。 | **必须现在修文档口径。** 实现冻结；只允许 preview-only 或 current-run 语义。 |
| 5 | 路线节点膨胀成地图系统 | P1 | 开始做节点图、商店、事件池、随机路线、boss 或完整 run map。 | **第 10 轮冻结。** 下一阶段只允许 2-3 场固定遭遇脚本和 route / repair / payoff 数据合同。 |
| 6 | 美术 / 动画抢占机制封板 | P1 | 开始做大 VFX、角色动画、生成新图、音效系统或 UI 皮肤大改。 | **冻结资产生产。** 可做一页 art direction backlog；不能影响 P0 QA 和手牌读数。 |
| 7 | 平衡参数被继续微调到不可归因 | P0 | 改费用、抽牌倍率、payoff 伤害、敌意图、奖励池权重，但没有新的失败证据。 | **冻结数值。** 只允许修阻断 bug；下一阶段先定义指标：payoff 率、硬坏手率、self draw 未解压率。 |
| 8 | 存档系统提前进入 | P0 | 新增 `AccountProfile`、localStorage、永久货币、解锁表、迁移版本。 | **冻结。** 当前只验 restart 清空和核心 sim 不隐式读取外部 meta。 |
| 9 | 移动端输入被截图通过掩盖 | P0 | 只验 overflow，不验 End Turn、奖励选择、卡牌点击中心点或移动端隐藏日志后的替代反馈。 | **P0 保持现有三档 QA。** 若发现按钮不可点，必须现在修；设备矩阵扩展进 P1。 |
| 10 | 自动 QA 平台化 | P1 | 开始引入截图基线、跨浏览器矩阵、CI、retry 框架、录像系统。 | **冻结平台化。** 只推进当前 `qa:ui` 的可读失败输出和清理纪律。 |
| 11 | `paper_shatter` 样片被悄悄扩大 | P0 | 从 drawPile-only 改成全牌堆、同时抽更多、命中多张、或未接链也触发。 | **必须现在阻断。** 文档和测试都应写清单卡、单目标、抽前置顶、miss 照常抽牌。 |
| 12 | reward / route / payoff 分类漂移 | P1 | 不同 worker 各自定义 `repair-resource`、`route-bridge`、`payoff`，导致奖励和整备目标不一致。 | **P1 推进合同。** 第 10 轮只标风险；下一阶段统一 taxonomy 后再实现。 |
| 13 | UI 短 token 被长规则句回侵 | P0 | 卡牌按钮、combat feed、Director 出现完整英文牌名、`drawPile/discardPile`、规则长句。 | **必须现在守住。** 可见层只用 `整备：顶终结`、`整备无牌`、`授权付`、`缺MP1` 等短 token。 |
| 14 | 浏览器 / dev server 清理不再作为通过条件 | P0 | QA 记录没有 page/context/browser/server cleanup，或端口仍由本次脚本占用。 | **必须现在保留为硬门槛。** QA 通过必须包含 cleanup 证据。 |

## 4. P0 必须现在修的清单

1. 将第 10 轮收束文档统一为“当前样片已封边，不再扩机制”。
2. 将 `paper_shatter` 的边界写成：只搜 `drawPile`、只找 payoff、只置顶一张、在 `DrawCards` 前、miss 不改牌区、`lantern_captain` 不触发。
3. 将 run/meta 的边界写成：P0/P1 不做账号存档、不做永久 Max MP、不做永久解锁。
4. 将 QA 口径写成：`npm run check` + `npm run qa:ui` 是当前收束命令；三档 viewport 和 cleanup 是硬门槛。
5. 将合并纪律写成：当前工作区有多方未提交改动，任何后续 worker 只接管自己负责文件。

## 5. 下一阶段可推进的 backlog

| Backlog | 推荐进入条件 | 第一刀 |
| --- | --- | --- |
| `lantern_captain` route-only | `paper_shatter` QA 连续稳定；有 payoff 率和 miss 率记录。 | drawPile-only 找当前 `nextExpectedCost` route，不找 payoff。 |
| RunState 最小字段 | P0 战斗、reward、restart 回归稳定。 | `runId`、`deck`、`rewardHistory`、`currentEncounterIndex`，不接账号。 |
| 2-3 场固定遭遇 | RunState 字段定稿。 | 三场脚本：教学链、坏手修补、payoff 爆点。 |
| run 内 modifier 接入 | preview-only 合同通过，HUD 文案能区分本回合授权和本次 run。 | 只接一个 `maxEnergyThisRunPlusOne`，上限 4，restart 清空。 |
| QA 失败报告 | 当前 `qa:ui` 继续稳定。 | 在 JSON 外补短 Markdown 摘要，不做截图基线平台。 |

## 6. 必须冻结的 backlog

以下条目不应在第 10 轮或下一小阶段误开：

- 完整 scry / reorder / tutor / redraw。
- `discardPile` search。
- `lantern_captain` 同轮启用真实 search。
- 账号存档、永久成长、永久 Max MP、永久货币。
- 完整路线地图、商店、事件池、boss 节点。
- 大规模卡池扩充、敌人扩充、数值重平衡。
- 美术资产生产、动画系统、音效系统、视觉 diff 平台。
- CI 化、跨浏览器矩阵、截图基线、录像系统。

## 7. 验收口径

第 10 轮结束前，文档层应能回答三件事：

1. 当前可交付样片是什么：`0 -> 1 -> 2` 授权链、`paper_shatter` drawPile-only 顶终结、短 HUD token、三档浏览器 QA。
2. 当前明确不做什么：完整 reorder、`lantern_captain`、discard search、局外成长、存档、地图、美术动画扩张。
3. 下一阶段从哪里开：先 run 生命周期和 route-only 小切片，再谈更完整坏手处理生态。

STATUS: DONE
