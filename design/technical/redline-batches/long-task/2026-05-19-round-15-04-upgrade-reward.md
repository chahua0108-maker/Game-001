# 第15轮-04 局内强化接入奖励体验工程师

日期：2026-05-19
工作目录：`/Users/roc/Game-001`

## 目标

把第14轮 `cardUpgrades` 从独立 sim 能力推进到奖励选择之一：奖励生成时可以出现局内强化候选，玩家选择后不加新牌，而是强化当前 run 内的一张具体牌，并在下一战影响该牌结算。

## 实现

- `prototype-web/src/sim/cardUpgrades.ts`
  - 新增内部升级奖励 id 编解码：`card-upgrade-choice:*`。
  - 新增 `buildCardUpgradeRewardChoiceIds()`，从当前 deck 的可升级牌生成奖励候选。
  - 保留原 `buildCardUpgradeChoices()` 直接 sim 调用能力，同时抽出纯候选生成逻辑，避免只读候选时污染 enhancement。
  - 新增 `clearCardUpgradeChoices()`，让普通奖励清理 pending 升级候选。

- `prototype-web/src/sim/runtime.ts`
  - `GainXp` 生成奖励时，从 run 后续节点开始预留 1 个位置给升级奖励。
  - `select-reward` 识别升级奖励 id 后调用 `applyCardUpgradeChoice()`。
  - 选择升级奖励后仍推进 run、清手牌、进入下一战，但不会执行 `AddCardToDeck`。

- `prototype-web/src/tests/sim/card-upgrade-gems.test.ts`
  - 新增回归：后续节点奖励出现升级选择；选择后 `CardUpgradeApplied` 落地；下一战 `debt_hook` 伤害从 4 提升到 6。
  - 保留第14轮直接构造升级/开槽/镶嵌与 restart 清空测试。

## 行为边界

- QA 不计入分数，本轮只锁核心体验闭环。
- 首奖仍保留原三分支加卡奖励，避免直接破坏首奖构筑分支断言。
- 当前 reward UI 仍按 card id 渲染；升级奖励 id 属于 sim 合同，后续 UI 工程师需要把 `cardUpgrades.choices` 渲染成“强化/开槽/镶嵌”文案。
- 升级仍是 run-local；`restart-run` 会通过 `createInitialWorld()` 清空。

## 验证

通过：

```bash
cd /Users/roc/Game-001/prototype-web
npx vitest run src/tests/sim/card-upgrade-gems.test.ts
npm run build
```

结果：

- `card-upgrade-gems.test.ts`：3 passed。
- `npm run build`：`tsc && vite build` passed。

未通过：

```bash
cd /Users/roc/Game-001/prototype-web
npm run check
```

结果：全量测试阶段仍有 1 个既有失败：

- `src/tests/sim/redline-reward-response.test.ts`
- 用例：`promotes authorization and draw when the previous battle lacked resources`
- 差异：期望第三项为 `severance_burst`，当前实际为 `pulse_draw`。

该失败发生在奖励响应排序合同，不是本轮升级奖励 id 选择链路；本轮目标测试与 build 已单独通过。
