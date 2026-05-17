# Game-001 Web Prototype 输入 / HUD / 可操作性 QA

日期：2026-05-17
角色：浏览器输入 / 按钮 / 可操作性 QA worker
范围：`/Users/roc/Game-001/prototype-web/src`
目标 URL：`http://127.0.0.1:5174/`

## 启动状态

- 5174 初始没有服务响应，使用项目方式启动：`npm run dev -- --host 127.0.0.1 --port 5174`。
- Vite 启动成功，页面可访问：`http://127.0.0.1:5174/`。
- 进入页面后的稳定首屏不是 `Deal / 发牌`，而是已自动进入 `R1 玩家出牌`，手牌 6 张，`结束回合` 可点击。
- 构建验证：`npm run build` 通过。
- 测试验证：`npm run test` 未通过，但失败点在已有 `runtime-audit.test.ts` 两个规则/阵型审计用例，不是本次 HUD 输入修复引入的 TypeScript 或构建错误。

## 最高优先级发现

### P1 已修复：一次鼠标点击可能打出两张牌

现象：
- 桌面端点击第一张 `Debt Hook` 后，HUD 立即重绘，原位置下方的新按钮收到同一次物理点击后续的 `click` 事件。
- 修复前实测结果：一次点击 `Debt Hook` 后，`Debt Hook` 与 `Redline Cut` 都被打出，首个敌人直接死亡，手牌从 6 张变成 4 张。

原因：
- `Hud` 同时在 capture 阶段监听 `pointerdown` 和 `click`。
- 原去重逻辑只在后续 `click` 的 action key 与 `pointerdown` 相同时拦截。
- 但 `pointerdown` 已经改变了 DOM，后续 `click` 的目标可能变成重绘后的另一张卡，action key 不同，导致穿透触发第二个 intent。

处理：
- 已只修改 `/Users/roc/Game-001/prototype-web/src/ui/hud.ts`。
- 保留 `pointerdown` 即时响应。
- 一旦 `pointerdown` 已处理按钮 intent，就在短时间窗口内无条件拦截紧随其后的 `click`，并 `preventDefault()` / `stopPropagation()`。

复测：
- 点击 `Debt Hook` 后只打出 1 张牌：目标从 `Debt Wisp 10/10` 变为 `Debt Wisp 6/10`，手牌从 6 张变为 5 张。
- 随后键盘 `2` 可继续打出当前第二张牌。

## 按钮 / 键盘 / 卡牌点击

桌面端 1280x720：
- `Restart`：可点击，未被 overlay 挡住。
- `结束回合`：可点击，按键 `E` 也可触发结束回合。
- 卡牌按钮：可点击；修复后单次 pointer 点击只触发一个卡牌 intent。
- 数字键：`2` 可触发当前手牌第二张牌，状态与点击一致。
- `Severance Burst`：在心跳碎片不足或能量不足时保持 disabled，点击不会触发出牌。

窄屏 / 移动端 390x844：
- 卡牌按钮可点击，中心点能命中按钮或按钮子元素。
- `结束回合` 可点击，能结算并进入下一回合。
- 数字键在 headless mobile viewport 中仍可触发；真实手机软键盘场景未覆盖。
- `Restart` 在窄屏下不可可靠点击，见下方 P1 未修复问题。

## Overlay / Pointer Events

桌面端检查：
- `#hud`：`pointer-events:auto`，覆盖整屏。
- `.status-strip`、`.deal-panel`、`.card-row`、`.debug-panel`：`pointer-events:auto`。
- `.enemy-slot-strip`、`.target-chip`、`.combat-feed`：`pointer-events:none`，不会阻挡卡牌和主操作按钮。
- 所有桌面可用按钮中心点均命中自身或子元素，没有发现 overlay 阻挡。

窄屏检查：
- `.combat-feed` 与 `.debug-panel` 在 390px 下 `display:none`，不会挡操作。
- `.target-chip` 与 `.enemy-slot-strip` 仍为 `pointer-events:none`。
- `Restart` 的中心点被 `.deal-panel` 覆盖，Playwright 点击 `Restart` 超时，属于实际可操作性问题。

## 阶段 enabled / disabled

稳定 `PlayerTurn`：
- `结束回合` enabled。
- 可支付的 5 张牌 enabled。
- `Severance Burst` 在 `Beat 0/3` 时 disabled，aria/title 显示 `心跳碎片不足：需要 3`。
- 打出消耗牌后，如果能量不足，`Severance Burst` 的 disabled reason 更新为 `能量不足：需要 3`。

结束回合：
- 实测点击 `结束回合` 后，运行时在同一帧/极短时间内自动完成敌方攻击、补位、发牌，并回到下一轮 `PlayerTurn`。
- 未观察到稳定停留的 `EnemyAttack` / `EnemyRefill` 可交互窗口，因此 disabled 态主要由模拟层瞬时处理，不是玩家可长期操作阶段。

Deal / 发牌：
- 页面稳定首屏已经是 `R1 玩家出牌`，未观察到可手动点击的 `发牌` 按钮。
- 源码存在 `data-deal` 与键盘 `D` 绑定，但当前主循环会自动推进到发牌后的玩家回合；如果设计上需要玩家手动发牌，应单独审主循环阶段推进。

## P1 未修复：窄屏 Restart 被 deal-panel 覆盖

复现：
1. 用 390x844 viewport 打开 `http://127.0.0.1:5174/`。
2. 页面进入 `R1 玩家出牌`。
3. 观察顶部状态栏换行，`Restart` 位于 `deal-panel` 后方。
4. 点击 `Restart`。

结果：
- Playwright 对 `Restart` 的常规点击超时。
- DOM 计算显示 `Restart` rect 为约 `x=147 y=64 w=78 h=40`，中心点命中 `.deal-panel`，不是按钮自身。

影响：
- 窄屏玩家基本无法可靠重开。
- 这是 CSS/HUD 布局问题；本 worker 的改码范围只允许 `hud.ts` / `input.ts` 等输入模块，因此未改 CSS。

建议归属：
- HUD responsive CSS。
- 优先调整 `.status-strip` 与 `.deal-panel` 在 `max-width: 980px` 下的垂直布局，避免重叠；或把 `Restart` 移到不与 `deal-panel` 共享垂直区域的位置。

## 复现步骤

桌面 click-through 修复前：
1. 打开 `http://127.0.0.1:5174/`。
2. 点击 `Debt Hook`。
3. 修复前可见 `Debt Hook` 和 `Redline Cut` 连续生效，目标死亡，手牌减少 2 张。

桌面修复后：
1. 打开同一 URL。
2. 点击 `Debt Hook`。
3. 只生效 `Debt Hook`，目标从 `10/10` 变为 `6/10`。
4. 按 `2`，当前第二张牌继续生效。
5. 按 `E` 或点击 `结束回合`，进入下一回合。

移动端 Restart 阻挡：
1. 390x844 viewport 打开同一 URL。
2. 检查 `Restart` 中心点。
3. `document.elementFromPoint()` 返回 `.deal-panel`；常规点击超时。

## 截图路径

- `/Users/roc/Game-001/outputs/browser-qa/input-qa-desktop-initial.png`
- `/Users/roc/Game-001/outputs/browser-qa/input-qa-desktop-after-actions.png`
- `/Users/roc/Game-001/outputs/browser-qa/input-qa-desktop-after-fix.png`
- `/Users/roc/Game-001/outputs/browser-qa/input-qa-mobile-initial.png`
- `/Users/roc/Game-001/outputs/browser-qa/input-qa-mobile-before-actions.png`
- `/Users/roc/Game-001/outputs/browser-qa/input-qa-mobile-after-actions.png`

## 改码记录

- 已改：`/Users/roc/Game-001/prototype-web/src/ui/hud.ts`
- 未改：运行时模拟、CSS、渲染器、主循环。
- 改动目的：阻止 `pointerdown` 后 HUD 重绘造成的 click-through 二次触发。
