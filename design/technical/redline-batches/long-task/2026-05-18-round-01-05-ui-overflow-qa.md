# 第 1 轮专家 05：UI 溢出 QA

审查时间：2026-05-18  
审查范围：`prototype-web/src/ui/hud.ts`、`prototype-web/src/style.css`，只读参考 `prototype-web/src/tests/ui/hud-target-selection.test.ts` 与 `prototype-web/src/data/cards.ts`。  
限制记录：本轮未打开浏览器，未修改源码；`hud.ts` 与 `style.css` 当前已有并行 dirty 状态，视为他人改动。

## 结论

当前 HUD 的主要风险不是单个长词，而是固定定位层过多、移动端垂直预算不足、以及大量 `white-space: nowrap` + 固定高度组件组合后把关键信息裁掉。P0 级风险集中在移动端与小平板：状态条、director、deal/target/enemy-peek、run-layer、card-row 会在同一垂直区域争抢空间；一旦手牌超过 4 张，底部卡牌区高度会明显侵入中部 HUD。

## 可能超框的 DOM/CSS 位置

| 位置 | DOM 来源 | CSS 位置 | 风险 |
| --- | --- | --- | --- |
| 顶部状态条 `.status-strip` | `hud.ts:539-583` | `style.css:46-56`, `1275-1288`, `1401-1457` | 9 个子项在桌面中宽度过大；`<=980px` 改成 4 列但不隐藏项，641-980px 会变成 3 行并与 `.combat-director` 重叠。 |
| 状态条 chip 内文本 | `hud.ts:554-580` | `style.css:120-123`, `175-191`, `234-254`, `281-293` | 多处 `white-space: nowrap`；移动端单列 chip 宽度约 75px 时，`终局授权 +3`、`MP0 -> MP1 -> MP2`、敌人意图明细容易横向溢出或被裁。 |
| Chain director 四宫格 | `hud.ts:585-606` | `style.css:333-386`, `1311-1325` | 固定 top 与固定 2x2 网格；强制省略号会隐藏 `终结预览`、敌人意图等关键判断。641-980px 时会压到三行状态条。 |
| Deal panel | `hud.ts:608-631` | `style.css:470-520`, `1459-1474` | `small` 最大宽度 188/150px 并 nowrap；`结束回合 -N` 按钮 nowrap，伤害数值或文案变长会挤压说明。 |
| Target panel | `hud.ts:633-636` | `style.css:531-565`, `1476-1478` | 固定高度 28px，长敌人名只能省略；移动端 top 固定在 262px，正好靠近 enemy-peek 与底部多行手牌。 |
| Run layer panel | `hud.ts:638-649` | `style.css:572-630`, `1334-1341`, `1480-1507` | 移动端 `bottom: 178px` 假设底部手牌只有约 168px；6 张手牌时卡牌区约 256px，会覆盖 run-layer。 |
| Enemy peek / slot strip | `hud.ts:651-668`, `789-814` | `style.css:641-740`, `1343-1360`, `1508-1525` | 移动端 `top: 320px` 与多行 `.card-row` 起点冲突；5 列敌人槽在 320px 宽下可用宽度很小，名字和 type badge 依赖裁切。 |
| Combat feed | `hud.ts:670-682`, `1027-1079` | `style.css:783-818`, `1306-1309` | 桌面右上固定宽度 244px，`li` 不限行；战斗日志变长会向下增长，可能盖住 `run-layer-panel`。 |
| Reward panel / reward card | `hud.ts:695-707`, `816-833` | `style.css:839-931`, `1367-1384` | 面板无 `max-height`/滚动；卡牌描述 `em` 不限行，移动端 1 列时可能把弹层推高并被 `body overflow:hidden` 截断。 |
| Bottom card row | `hud.ts:710-764` | `style.css:962-1219`, `1362-1398`, `1527-1554` | 桌面固定 6 列；手牌超过 6 张会新增行。移动端 2 列，4 张已占两行，6 张占三行，与 run-layer/enemy-peek 重叠。 |
| Card button 内文 | `hud.ts:751-758` | `style.css:973-978`, `1086-1115`, `1137-1170` | 固定 86/82px 高度 + 父级 `overflow:hidden`；`card-payoff`、`card-effect`、`missing-cost`、`authorization-cost` 可能被裁掉，且这些包含支付/锁定信息。 |
| Debug panel | `hud.ts:766-781` | `style.css:1225-1273` | 桌面底部固定 `bottom:104px` 只适配单行卡牌；手牌多行后会被 card-row 压住。移动端直接隐藏，缺少小屏调试入口。 |
| 全局不可滚动 | N/A | `style.css:14-19` | `body { overflow: hidden; }` 让任何超出视口的 HUD 都不可恢复，尤其影响奖励弹层、三行手牌和短屏横屏。 |

## 桌面风险

1. `981-1280px` 宽度区间仍使用桌面状态条。按当前 chip 最小宽度估算，状态条加 Restart 接近或超过 1000px；`max-width: calc(100vw - 304px)` 还要给右侧 HUD 让位，容易横向挤压或裁掉。
2. 桌面右侧同时有 `.combat-feed`、`.run-layer-panel`、`.enemy-peek`、`.debug-panel`。它们各自固定定位，缺少统一 layout budget；日志换行、debug 展开、多行手牌都会造成遮挡。
3. `.card-row` 固定 6 列适合当前起手 4 张和常规 6 张以内。若抽牌或奖励让手牌超过 6 张，会生成第二行，直接进入 debug/run-layer 的预留区域。
4. `.reward-panel` 桌面宽度足够，但卡牌描述无限行。后续卡牌文案增长后，三张奖励卡可能高度不一致并增加弹层高度，中心弹层会遮住底部手牌和主要战场。

## 移动端风险

1. `641-980px` 是当前最高风险断点：状态条 9 个子项按 4 列排布会形成 3 行，而 `.combat-director` 从 `top:82px` 开始，极可能覆盖第三行状态项。
2. `<=640px` 仍保留 HP、MP、authorization、chain、intent 5 个状态项，4 列布局会形成 2 行。第二行 chip 很窄，`chain-chip span` 与 `authorization-chip strong` 继承 nowrap，仍可能横向溢出。
3. `<=640px` 的 `.card-row` 是 2 列固定卡牌。4 张牌约 169px 高，6 张牌约 256px 高；而 `.run-layer-panel bottom:178px`、`.enemy-peek top:320px` 都没有感知手牌高度，会产生堆叠。
4. 移动端 `.enemy-peek` 固定在 320px；短屏或三行手牌场景中，它会和卡牌按钮抢点击区域。
5. 卡牌按钮移动端隐藏 `.card-effect`，但仍保留 meta、chain、payoff、missing/authorization；固定 82px 高度不足以保证锁牌原因和授权支付提示可见。
6. 奖励面板移动端变成单列，但没有 `max-height: calc(100vh - safe-area)` 与内部滚动。`body overflow:hidden` 下，一旦描述增长，底部奖励卡或按钮不可访问。

## 可执行 CSS/文案策略

1. 在 `<=980px` 先定义 HUD 信息优先级，只保留 HP、MP、chain/intent 中的 2-3 个核心 chip；XP、FSM、牌堆、Restart 进入 debug/drawer 或暂停面板。
2. 把 `.status-strip` 改为允许显式两行上限：使用 `grid-template-areas` 固定核心项位置，并在 641-980px 隐藏低优先级项，避免自动排出第三行。
3. 用 CSS 变量统一垂直预算，例如 `--top-hud-height`、`--hand-height`，让 `.combat-director`、`.deal-panel`、`.target-panel`、`.enemy-peek` 根据预算定位，而不是独立写死 top/bottom。
4. 移动端手牌改为横向滚动 rail：`.card-row { display:flex; overflow-x:auto; }`，卡牌固定宽度，避免 2 列多行把中部 HUD 顶穿。
5. 若必须保留网格手牌，给 `.card-row` 设置 `max-height` 和内部滚动，并给其他浮层加 `bottom: calc(var(--hand-height) + 16px)`。
6. 卡牌按钮采用“紧凑态文案”：移动端只显示费用、牌名、链路结果、支付/锁定状态；目标与详细效果放到 `title`/长按详情/底部详情条。
7. 所有承载动态中文/英文混排的字段使用 `min-width: 0` + `overflow:hidden` + `text-overflow:ellipsis`，同时对关键状态避免只靠省略号；关键支付错误应独占一行或使用短 token。
8. 将长文案从按钮内移出：`card.description`、`authorization.detail`、reward 说明改为详情浮层或选择后侧栏，按钮内只保留 8-12 字的战斗决策文案。
9. `.reward-panel` 增加 `max-height: calc(100vh - 32px)`、`overflow:auto`，`.reward-card em` 加 `line-clamp: 2-3`，保证小屏可访问所有奖励。
10. `.combat-feed` 桌面加 `max-height` 和 `overflow:hidden/auto`，并限制每条日志一到两行，避免向下覆盖 run-layer。
11. 对移动端 chip 文案做缩写：`终局授权 +3` -> `授权+3`，`结束回合 -12 HP` -> `结束 -12`，`MP0 -> MP1 -> MP2` -> `0>1>2`。
12. 用 `@media (max-height: 700px)` 单独处理短屏：隐藏 enemy-peek 展开区、合并 deal/target、降低 director 行数，优先保住手牌和结束回合按钮。

## 自动化验收建议

1. 增加 Playwright/Chromium 视觉布局验收，覆盖 `1366x768`、`1280x720`、`980x720`、`768x1024`、`390x844`、`360x640`、`320x568`、`640x360`。
2. 为 HUD 构造极限快照：6-8 张手牌、最长卡名、最长 reward 描述、终局授权 active/inactive、敌人意图 3 个以上、debug open、reward flow、settlement flow。
3. 自动检查所有关键 HUD 节点的 `getBoundingClientRect()` 是否在 viewport 内，重点节点：`.status-strip`、`.combat-director`、`.deal-panel`、`.target-panel`、`.enemy-peek`、`.run-layer-panel`、`.card-row`、`.reward-panel`。
4. 自动检查关键浮层之间的矩形重叠：状态条 vs director、enemy-peek vs card-row、run-layer vs card-row、combat-feed vs run-layer、debug-panel vs card-row。
5. 对 `.card-button` 增加内容可见性断言：当存在 `.missing-cost` 或 `.authorization-cost` 时，它的 rect 必须完全落在对应按钮 rect 内，且 `offsetHeight` 不为 0。
6. 对 reward 弹层增加可滚动验收：面板高度不得超过 viewport，最后一张 `.reward-card` 必须可见或可滚动到可见。
7. 保留现有 Vitest helper 测试，但新增 DOM 快照生成测试，固定长文案场景，防止后续文案扩写绕过布局验收。
8. 在 CI 中输出失败截图和重叠矩形 JSON，避免只看到“视觉回归失败”而无法定位是哪一层遮挡。

## 本轮 P0 UI 修复建议

1. 先修 `641-980px` 状态条三行覆盖 director：在 `<=980px` 隐藏 XP/FSM/牌堆/Restart，或把 `.combat-director top` 改为随状态条高度计算。
2. 先修 `<=640px` 底部手牌多行覆盖 run-layer/enemy-peek：移动端手牌改横向滚动 rail，或者建立 `--hand-height` 并把中部浮层整体避让。
3. 先修卡牌按钮关键状态被裁：移动端把 `.card-payoff`、`.card-effect`、长 target 文案降级隐藏，只保留 `.missing-cost`/`.authorization-cost` 等支付状态，并保证不被 `overflow:hidden` 裁掉。
4. 先修奖励弹层不可滚动：给 `.reward-panel` 加 viewport max-height 与内部滚动，避免 `body overflow:hidden` 让奖励选择在短屏不可访问。
