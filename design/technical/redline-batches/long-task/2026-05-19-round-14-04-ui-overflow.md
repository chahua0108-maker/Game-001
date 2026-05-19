# 2026-05-19 Round 14-04 UI/HUD Overflow Redline

角色：UI/HUD 专家 - 禁止文字超框

范围：`prototype-web` HUD、卡牌、奖励、战斗日志、移动端断点。目标是保持现有组件/CSS 模式，不做大视觉重构。

## 实际检查结论

已检查并修复以下风险：

1. 卡牌按钮在桌面终结/授权状态下存在垂直裁字风险。
   - 证据：`qa:ui` 样本里 `Severance Burst` 授权终结卡牌在 102px 高度下 `scrollHeight` 曾高于可视高度。
   - 修复：桌面卡牌高度提升到 118px，中等断点为 108px；移动端仍保留 98px，并隐藏低优先级 `card-effect/card-payoff`。

2. 移动端 `phase-chip` 隐藏规则被 `.status-strip > div` 的 `display:flex` 覆盖。
   - 证据：360x640 下 `FSM` 小标题横向溢出，`qa:ui` 报 `TEXT_HORIZONTAL_OVERFLOW`。
   - 修复：将隐藏规则改为 `.status-strip > .phase-chip` 等高特异性选择器。

3. 奖励/发牌/状态文本缺少统一收缩防线。
   - 修复：给 HUD 状态文本、发牌面板、奖励卡、卡牌内部文本补 `min-width: 0`、`text-overflow: ellipsis` 或 `overflow-wrap: anywhere`。

4. 战斗日志中的整备顶终结提示会被后续抽牌/发牌日志挤出。
   - 证据：`qa:ui` 中 `PayoffTopdecked` 事件存在，但 `feedText` 曾只显示抽牌/发牌。
   - 修复：HUD 日志保留最近的 `PayoffTopdecked/PayoffTopdeckMissed` 关键提示，防止核心反馈不可见。

5. 调试面板长 trace/token 有横向撑开风险。
   - 修复：`debug-panel dd` 增加 `overflow-wrap: anywhere`，避免打开调试面板时长 trace 撑宽。

## 修改文件

- `prototype-web/src/style.css`
  - 卡牌按钮高度与断点高度微调。
  - 状态条、发牌、奖励、卡牌、调试文本增加收缩/省略/换行保护。
  - 移动端隐藏状态芯片规则提高特异性。

- `prototype-web/src/ui/hud.ts`
  - 战斗日志保留最近整备顶终结/整备无牌关键反馈。

## 验证

命令验证：

```bash
cd /Users/roc/Game-001/prototype-web
npm run qa:ui
npm run build
```

结果：

- `npm run qa:ui`: pass
  - desktop 1366x768、mobile 390x844、mobile 360x640 均通过。
  - `noHorizontalOverflow`: pass
  - `noTextOverflow`: pass
  - `coreTokensVisible`: pass
  - score: 20 / 20

- `npm run build`: pass
  - `tsc && vite build` 成功。
  - 仅保留 Vite chunk size warning，和本次 UI 溢出修复无关。

浏览器验证：

- 使用 Codex in-app Browser 打开 `http://127.0.0.1:5174/`。
- 桌面 1366x768：HUD、director、deal panel、run layer、combat feed、card row、card button 无越界/溢出失败。
- 移动 360x640：页面无横向溢出；手牌 rail 存在内部横向滚动，这是移动端卡牌滑轨的预期模式，不是页面级超框。
- 截图证据：
  - `/tmp/game001-round14-04-desktop.png`
  - `/tmp/game001-round14-04-mobile-360.png`

## 剩余风险

- 移动端手牌仍依赖横向滑轨承载多张卡牌；这是现有交互模式，不在本轮改为堆叠卡。
- `qa:ui` 当前输出目录仍是 `outputs/browser-qa/round-11/qa-ui-result.json`，本轮复用了现有脚本配置，没有改 QA 轮次命名。
