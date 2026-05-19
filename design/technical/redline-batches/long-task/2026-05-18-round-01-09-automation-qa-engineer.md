# 第 1 轮专家 09：自动化验收工程师

## 结论摘要

当前 `prototype-web/src/tests` 已经把多数核心战斗机制放进 Vitest：回合、发牌、出牌、连锁倍率、临时终局授权、敌人补位、敌人意图、奖励、单局/局外边界都有覆盖。2026-05-18 当前执行 `npm test` 结果为：14 个测试文件，13 个通过、1 个跳过；96 个用例，94 个通过、2 个跳过。

主要缺口不在“有没有测机制”，而在两点：

- UI 只有 `src/tests/ui/hud-target-selection.test.ts` 测 HUD 纯函数，没有真实 DOM/CSS/layout 验收。
- 已跳过的 `redline-90s-acceptance.test.ts` 说明旧实时 90 秒验收已废弃，但目前还没有替代的短时体验节奏验收。

## 1. 已有测试覆盖

| 范围 | 文件 | 已覆盖内容 | 当前判断 |
| --- | --- | --- | --- |
| 基础 runtime | `src/tests/sim/runtime.test.ts` | 初始世界、发牌、出牌、能量、弃牌、抽牌、连锁、payoff、敌人攻击、死亡、重启、敌人意图 | 覆盖最厚，是机制回归主干 |
| runtime 审计补丁 | `src/tests/sim/runtime-audit.test.ts` | 空抽牌堆自抽、同 tick 结束回合后 stale input、前排击杀补位 | 对高风险 bug 有专门回归 |
| 核心循环 | `src/tests/sim/core-loop-regression.test.ts` | 五槽前排补位、下一回合自动发牌、任意前排目标、随机目标 | 保证基础战斗闭环不塌 |
| Hyper-Turn 验收 | `src/tests/sim/redline-hyperturn-acceptance.test.ts` | 0->1->2 路线、顺序收益大于乱序、敌人意图、断链降倍率、draw repair、3 MP 清场救援 | 对当前核心爽点有较强契约 |
| P0 临时授权 | `src/tests/sim/redline-attribute-authorization.test.ts` | 0->1->2 后临时授权、非完整链不授权、2 MP 不是 payoff、断链不授权、wild repair 授权、回合结束清空、事件证据 | 很适合继续作为机制复刻红线 |
| 进阶卡牌系统 | `src/tests/sim/redline-progression-card-system.test.ts` | P0 授权不是永久 Max MP、奖励进当前 run、终局 payoff 范围、授权只能付 3 费终结牌、Wild 是 repair | 锁住了局内成长和卡牌类型边界 |
| 单局/局外边界 | `src/tests/sim/run-layer-boundary.test.ts` | fresh run 基线、非法奖励不变更、奖励只进当前 run、重启清空、外部 meta 不隐式生效 | 对未来 meta 层很关键 |
| run progression | `src/tests/sim/run-progression.test.ts` | run 状态、snapshot 暴露、奖励历史、节点推进、结算、重启 | 覆盖 run shell |
| 奖励与分支 | `src/tests/sim/progression-reward-regression.test.ts`、`src/tests/sim/reward-branching.test.ts` | 击杀 XP、升级奖励、选择入牌、奖励横跨 repair/resource、payoff、route/bridge | 当前只有小样本，适合补矩阵 |
| run modifier | `src/tests/sim/run-modifiers.test.ts` | preview-only、默认不改 maxEnergy、draft modifier 不等于 meta 或授权 | 锁住“预览层不污染 runtime” |
| 卡牌 taxonomy | `src/tests/sim/card-taxonomy.test.ts` | 奖励池真实卡、每张卡有 taxonomy、payoff 只保留 3 MP all-enemies burst | 数据契约清晰 |
| UI 纯函数 | `src/tests/ui/hud-target-selection.test.ts` | 目标选择、结束回合按钮可用性、授权支付提示、卡牌角色文案、run/meta 文案 | 只测 helper，不测真实 DOM |
| 已废弃验收 | `src/tests/sim/redline-90s-acceptance.test.ts` | 旧 90 秒实时 heartbeat 验收，当前 `describe.skip` | 需要替代，不应直接复活旧实时口径 |

补充事实：

- `vite.config.ts` 的 Vitest 环境是 `node`，`include` 为 `src/tests/**/*.test.ts`。
- `package.json` 只有 `test` 和 `test:watch`，当前没有 Playwright、jsdom、happy-dom 或浏览器测试脚本。
- `style.css` 中大量关键 UI 使用 fixed/absolute、固定高度、`overflow: hidden`、移动端 media query，这类问题无法靠 Node Vitest 判断。

## 2. 缺失测试清单

### P0：必须补

- 真实 DOM/CSS 布局验收：状态条、战斗导演、发牌面板、目标面板、run/meta 面板、前排显影、奖励面板、手牌按钮在桌面和移动端不超出 viewport。
- 真实 HUD 交互验收：点击发牌、选择前排目标、出牌、结束回合、奖励选择、重新开始，按钮必须可见、可点、不会被浮层遮挡。
- 旧 90 秒体验验收替代：不再测 realtime heartbeat，但要有“前 5 回合/固定脚本”的 deterministic slice，锁住早期可操作、敌人意图压力、一次 payoff 清场窗口。
- Snapshot/UI 契约：HUD render 所需字段必须由 `buildSnapshot` 全量提供，不能依赖 `as unknown as GameSnapshot` 这种测试假对象长期兜底。
- 机制数据矩阵：所有 `rewardCardPool` 卡必须至少命中一个奖励分支，且 payoff、repair、route/bridge 不互相误标。

### P1：应补

- 同 tick 多 intent 顺序矩阵：`play-card + end-turn`、`select-reward + restart-run`、`end-turn + restart-run` 的优先级和失败条件。
- Reward 状态互斥：处于 `Reward` 时不能出牌、不能结束战斗回合、选择非候选卡必须只记录 failedCondition。
- 敌人意图一致性：`EnemyIntentDeclared`、HUD 汇总、`EnemyIntentResolved` 的 totalDamage 与实际扣血一致。
- 手牌 UI 极限：6 张牌、空手牌、全锁牌、全授权牌、长中文卡名/描述、奖励三选长描述。
- 移动端最小宽度：320x568、360x640、390x844 下 status-strip、card-row、run-layer-panel、reward-panel 不互相覆盖核心操作。

### P2：后续补

- Trace/replay 最小契约：关键事件序列可从 debug trace 重放或至少稳定断言。
- 可访问性烟测：关键按钮有可读 aria-label，disabled 状态与机制一致。
- 视觉回归截图：奖励面板、死亡面板、授权支付、断链风险、前排显影展开状态做 screenshot baseline。

## 3. UI 溢出测试策略

UI 溢出不要放在普通 Vitest 里判断。原因是当前 Vitest 是 Node 环境，看不到 CSS 计算、真实字体、媒体查询、fixed/absolute 面板叠放，也看不到按钮是否被别的层遮挡。

建议新增 Playwright layout spec，至少覆盖这些 viewport：

| Viewport | 目的 |
| --- | --- |
| 1366x768 | 主桌面验收，锁固定 HUD 不遮挡手牌和奖励 |
| 1024x768 | 命中 `max-width: 980px` 附近风险 |
| 390x844 | 常见移动端竖屏 |
| 360x640 | 小屏竖屏压力 |
| 320x568 | 当前 `body min-width: 320px` 的硬边界 |

建议的 DOM layout 检查：

- `#hud`、`.status-strip`、`.deal-panel`、`.target-panel`、`.run-layer-panel`、`.enemy-peek`、`.card-row`、`.reward-panel`、`.game-over-panel` 的 bounding box 必须在 viewport 内。
- 所有可点击按钮的中心点必须可命中自身：用 `document.elementFromPoint(centerX, centerY)` 验证没有被浮层挡住。
- 对非预期横向滚动做全局断言：`document.documentElement.scrollWidth <= window.innerWidth` 且 `document.body.scrollWidth <= window.innerWidth`。
- 对核心文本容器做溢出断言：`scrollWidth <= clientWidth + 1`，重点是 `.card-button strong`、`.card-meta`、`.chain-preview`、`.card-payoff`、`.card-effect`、`.reward-card strong/small/em`、`.run-layer-main strong/em`、`.target-panel span`。
- 对“允许裁切”的元素只允许 ellipsis，不允许撑破布局：检查 computed style 是 `overflow: hidden` 且 `text-overflow: ellipsis`，而不是实际推开父级。
- 奖励面板打开时，`.reward-panel` 不能遮挡底部手牌的关键可点区域；如果设计上奖励阶段本来接管输入，则断言 Reward 阶段底部手牌为空态或不可点，避免两个操作层同时争抢。

推荐 Playwright 场景：

1. boot 后 Deal 状态：状态条、发牌面板、空手牌。
2. 点击发牌进入 PlayerTurn：6 张以内手牌、状态条、战斗导演、目标面板。
3. 展开前排显影：5 个 targetable slot 在小屏不出 viewport。
4. 构造或脚本推进到 Reward：三选奖励卡不超框。
5. 构造授权/payoff 状态：卡牌上出现“终局授权支付/需MP/终局授权”时不撑破卡片。
6. 构造 GameOver：死亡面板居中且按钮可点。

## 4. 机制契约测试策略

继续用 Vitest 锁机制，原则是只测 `sim/`、`data/`、`eca/`、纯 helper，不引入 DOM。该层要测的是“复刻机制结构”，不是视觉表现。

### 应继续由 Vitest 锁住的机制

- 费用链路：0->1->2->3 的 multiplier、断链降级、回合结束重置、失败出牌不污染 chain。
- 临时终局授权：只由完整 0->1->2 或 wild repair 后的合法链授予；只能支付 3 MP all-enemies burst payoff；回合结束清空；不改变 `maxEnergy`。
- payoff 终结：只有 `cardType/payoff`、3 cost、`comboNode: burst`、`targets: all-enemies` 的终结牌能吃终局授权；2 MP `clearance_order` 永远是 route segment。
- 敌人意图：声明、HUD 可读摘要、结束回合结算、payoff 预防/减少 intent damage 的事件证据必须一致。
- Command Buffer 边界：所有输入先变 Intent；失败条件只进 debug，不扣能量、不弃牌、不改世界。
- 敌人槽位：前排击杀后同列补位，不横向乱移；新补位敌人本回合是否有攻击权必须明确。
- 奖励与单局成长：奖励只影响当前 run；重启清空；非法奖励选择不变更 deck/energy。
- run/meta 隔离：未来外部 meta 字段不能隐式进入当前 runtime，除非通过显式机制接入。
- 卡牌 taxonomy：新卡必须声明 `cardType`、`chainRole`、`cycleRole`、`buildRole`、`availability`，并通过奖励分支矩阵。
- Snapshot 契约：`buildSnapshot` 必须深拷贝数组、暴露 HUD 需要的 run/reward/intent/chain 字段，UI 不直接读 mutable world。

### 不建议用 Vitest 锁的内容

- 元素是否超框、按钮是否被遮挡、移动端是否挤压。
- canvas/Three.js 画面是否可见、战斗场景是否被 HUD 盖住。
- hover/focus/active 视觉状态。
- 字体渲染后的真实行高、ellipsis、media query 生效情况。

这些应进入 Playwright/浏览器验收，必要时加截图基线。

## 5. 本轮最小新增测试建议

本轮最小集不要铺太大，建议只加 5 个测试入口：

1. `src/tests/sim/redline-deterministic-slice.test.ts`
   - 用固定脚本替代已跳过的 90 秒 realtime 验收。
   - 验收：发牌后 1 回合内可操作；3-5 回合内出现敌人意图压力；完成 0->1->2 后能用 3 MP payoff 阻止或清掉一波前排压力。

2. `src/tests/sim/reward-state-guard.test.ts`
   - 验收 Reward 状态互斥。
   - 覆盖：Reward 中出牌失败不扣能量、不弃牌；Reward 中 end-turn 失败；选择非候选奖励只写 failedCondition。

3. `src/tests/sim/snapshot-contract.test.ts`
   - 验收 `buildSnapshot(createInitialWorld())` 和若干关键状态下 HUD 必需字段齐全。
   - 覆盖：`run`、`reward`、`enemyIntentSummary`、`enemyIntents`、`chain`、`debug` 数组均为可读副本。

4. `src/tests/e2e/hud-layout.spec.ts` 或 `tests/e2e/hud-layout.spec.ts`
   - 需要先引入 Playwright。
   - 第一版只测 boot、PlayerTurn、enemy peek、Reward 四个状态和 5 个 viewport。
   - 核心断言：无横向 overflow、关键面板在 viewport 内、可点击元素中心点未被遮挡、核心文本容器不撑破父级。

5. `src/tests/e2e/hud-interaction.spec.ts`
   - 需要先引入 Playwright。
   - 只做真实交互 smoke：发牌、选前排目标、打单体牌、结束回合、奖励选择或重启。
   - 目标不是测机制数值，而是保证 DOM 按钮、dataset、事件绑定和 runtime intent 串起来。

最小落地顺序：

1. 先补 3 个 Vitest：`redline-deterministic-slice`、`reward-state-guard`、`snapshot-contract`。
2. 再加 Playwright 依赖和配置，写 `hud-layout.spec.ts`。
3. UI layout 稳定后，再加 `hud-interaction.spec.ts` 和 screenshot baseline。

## 验收命令建议

当前可用：

```bash
cd /Users/roc/Game-001/prototype-web
npm test
```

引入 Playwright 后建议脚本：

```json
{
  "scripts": {
    "test": "vitest run",
    "test:e2e": "playwright test",
    "test:all": "npm run test && npm run test:e2e"
  }
}
```

本轮报告生成时已执行 `npm test`，结果通过：94 passed，2 skipped。
