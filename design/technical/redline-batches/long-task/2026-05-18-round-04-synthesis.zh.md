# 2026-05-18 第 4 轮综合结论

## 轮次结果

第 4 轮新增 10 个全新专家视角，主题是修补牌池、奖励分支合同和完整卡牌复刻边界：

1. 奖励分支合同架构师：`rewardBranches` 必须成为 `CardDefinition` 的显式合同，避免 `availability`、`chainRole` 改动导致分支漂移。
2. Reserve 牌迁移设计师：`blood_tithe`、`pulse_draw` 可以后续开放为奖励，但必须先锁分支合同。
3. 奖励池排序制作人：若只重排当前 11 张，可让首奖更清楚，但这应放在合同之后。
4. 修补牌数值工程师：`wild_mana_stitch` 适合后续改成修补成功才返 MP，`wild_gap_key` 可后续从 1 伤害调到 2。
5. 抽牌倍率 UX：抽牌牌的真实请求抽牌数等于 `drawCards * effectMultiplier`，后续 HUD 必须把 `抽2/抽3` 讲清楚。
6. 完整机制复刻清单：消耗、保留、状态、诅咒、实例、升级、触发器和遗物层都缺，但不能一轮做完。
7. UI 超框 QA：手牌只承载短决策，奖励卡只承载选择理由和短规则，移动端继续用横向 hand rail。
8. 测试合同工程师：开放修补牌或重排奖励池时，必须同步锁 reward pool 可见性、分支稳定性、下一手可见性和 run/meta 边界。
9. 工程风险审查员：当前工作树已有大量未提交改动，本轮只能做窄合同修正，不碰 runtime/HUD/CSS。
10. 制作人综合：本轮只落地 `rewardBranches` 显式合同。

## 本轮裁决

本轮只落地奖励分支显式合同：

- `RewardBranch` 从选择器内部类型上升到 `types.ts`。
- `CardDefinition` 增加可选 `rewardBranches`。
- `rewardBranchesForCard` 优先读取显式 `rewardBranches`，启发式和 fallback 只作为迁移期兼容。
- 当前 `rewardCardPool` 内所有牌补齐显式分支。
- `blood_tithe` / `pulse_draw` 虽然仍是 `reserve-test`，也先声明未来奖励分支，防止开放时漂移。
- 测试新增 reward pool 不含 reserve、reward pool 每张牌有显式合法分支、显式分支优先于 `availability/chainRole` 推导。

## 本轮不做

- 不开放 `blood_tithe` / `pulse_draw`。
- 不重排 `rewardCardPool`。
- 不改 `wild_mana_stitch` 条件返 MP。
- 不改 `wild_gap_key` 伤害。
- 不实现 `reorder`。
- 不做消耗、保留、状态、诅咒、CardInstance、升级或触发器。
- 不碰 HUD/CSS。

## 验收

- 定向测试：`card-taxonomy`、`reward-branching`、`progression-reward-regression`、`run-layer-boundary` 通过，14 个用例通过。
- 全量测试：`npm test -- --run` 通过，101 passed，2 skipped。
- 构建：`npm run build` 通过，仅保留 Vite 500 kB chunk warning。
- 本轮未打开浏览器，因为没有修改可见 UI。

## 进入第 5 轮的建议

第 5 轮应处理“开放抽牌修补牌与奖励池排序”：

- 决定是否把 `blood_tithe` / `pulse_draw` 从 `reserve-test` 开放为 `reward`。
- 决定是否只重排当前 11 张，还是同时把抽牌修补牌作为后备加入奖励池。
- 明确 `pulse_draw`、`paper_shatter` 的倍率抽牌文案，避免玩家看到“抽1”却实际抽2/3。
- 所有 UI 改动都必须跑移动端和桌面超框复核，打开浏览器后必须关闭测试页面。
