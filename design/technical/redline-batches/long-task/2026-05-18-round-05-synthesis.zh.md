# 2026-05-18 第 5 轮汇总：开放抽牌修补奖励与 HUD 倍率读数

## 本轮目标

第 5 轮从 10 个专家视角收敛到一个小闭环：把 `blood_tithe / pulse_draw` 从测试储备牌推进到当前奖励池，并让玩家在 HUD 上看到真实的抽牌倍率反馈。范围刻意不扩展到 Wild 数值、reorder 运行时、删牌、升级或局外成长。

## 已执行修改

- `prototype-web/src/data/cards.ts`
  - `blood_tithe` 改为 `availability: 'reward'`，定位为 `draw-fixer`。
  - `pulse_draw` 改为 `availability: 'reward'`，定位为 `draw-fixer`。
  - `pulse_draw / paper_shatter / lantern_captain` 的短规则改为可读出接链后的 `抽2 / 抽3`。
  - `rewardCardPool` 重排，默认首奖锁定为 `blood_tithe / severance_burst / spark_tap`。

- `prototype-web/src/ui/hud.ts`
  - self 抽牌牌的意图预览从泛化的“抽牌找解”改为 `抽N找解`。
  - 手牌效果标签在接链倍率大于 1 时显示当前预计抽牌数，例如 `抽2`、`抽3 整备`。
  - 战斗日志的出牌事件补充 `抽N`，避免运行时实际抽牌数和可见反馈分离。
  - 奖励面板说明改为“选后进入下一手与后续抽牌。”
  - 奖励态发牌面板改用短牌堆读数，避免 Deck/Draw/Discard/Hand 文案溢出。

- `prototype-web/src/style.css`
  - 桌面和平板卡牌按钮高度从 `98px` 调整到 `102px`，修复桌面卡牌内容高 3px 的隐性溢出。
  - 移动端横滑卡牌保持原高度，因为移动端隐藏了次级效果行，复测无溢出。

- 测试文件
  - `card-taxonomy.test.ts` 锁住 `blood_tithe / pulse_draw` 已进入奖励池，并保持 draw repair 定位。
  - `reward-branching.test.ts` 锁住默认首奖、移除 Blood Tithe 后 Pulse Draw 接替 repair 分支、再移除 Pulse Draw 后才落到 Wild 修补。
  - `progression-reward-regression.test.ts` 覆盖非终局奖励进入下一手，以及终局奖励进入 Settlement 不再发牌。
  - `hud-target-selection.test.ts` 覆盖 `抽1/抽2/抽3找解` 不承诺降低敌人意图。

## 验收结果

- 目标测试：6 个文件，71 个测试通过。
- 全量测试：13 个测试文件通过，1 个跳过；109 passed，2 skipped。
- 构建：`npm run build` 通过；仍有既有 Vite 500KB chunk warning，不阻塞本轮。
- 浏览器验收：
  - 桌面 `1366x768`：到达奖励态，选择 Blood Tithe 后进入下一手；无 console/page error；文字溢出检测 0。
  - 移动 `390x844`：同上；文字溢出检测 0。
  - 小屏 `360x640`：同上；文字溢出检测 0。
  - 测试浏览器实例已关闭。
  - 复测截图保存在 `/tmp/game001-round05-qa-rerun/`。

## 下一轮建议

第 6 轮不要立刻扩大到局外成长。更应该先处理“修补牌 1:1 机制复刻”的运行时缺口：`wild_gap_key` 的费用缺口修补是否真的影响链路、`wild_mana_stitch` 的返 MP 是否过强、以及 `reorder` 目前只有文案没有运行时效果。这些会直接影响核心循环是否像真正卡牌游戏，而不是只像卡牌 UI。

STATUS: DONE
