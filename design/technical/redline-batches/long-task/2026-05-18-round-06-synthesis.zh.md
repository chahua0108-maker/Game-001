# 2026-05-18 第 6 轮汇总：Wild 修补合同与条件返 MP

## 本轮目标

第 6 轮新增 10 个专家视角，围绕修补牌、抽牌、临时资源、重排和卡牌生命周期做收敛。主线程裁决后没有打开完整 `reorder` runtime，也没有启动 CardInstance / 消耗 / 保留 / 状态牌大迁移，而是先把当前已经存在的 Wild 修补做实。

## 专家共识

- `reorder` 目前确实只是 `utilities` 标签和“整备/找牌”文案，适合后续单独做真实牌堆预视或检索，不应混入本轮。
- `wild_mana_stitch` 当前如果无条件返当前 MP，会把 0 费 Wild、抽牌、返 MP、授权链叠在一张牌上，削弱 3MP 压力。
- `wild_gap_key` 的补链有 runtime 支撑，但之前 `CardPlayed` 事件没有记录本次是否真实修补，后续效果无法安全依赖。
- UI 需要继续保持短 token：`抽N仍-X`、`修补MPx`、`MP+1`，不能把完整规则塞进卡牌按钮。

## 已执行修改

- `prototype-web/src/sim/types.ts`
  - 增加 `EnergyGainCondition = 'chain-repaired'`。
  - `CardDefinition` 增加 `energyGainCondition?`。
  - `CardPlayed` 增加 `effectiveCost`、`chainRepaired`、`repairedCost?`。

- `prototype-web/src/sim/runtime.ts`
  - Wild 只有在“链已开始、未断链、期望费用为 1 或 2”时才算真实修补。
  - `advanceCostChain` 返回结构化修补结果。
  - `CardPlayed` 写入本次有效链路费用与修补结果。
  - broken chain 后 Wild 不再伪装成成功修补。

- `prototype-web/src/eca/redlineRules.ts`
  - `energyGainCondition: 'chain-repaired'` 的牌只有在本次 `CardPlayed.chainRepaired` 为真时才触发 `GainEnergy`。

- `prototype-web/src/data/cards.ts`
  - `wild_mana_stitch` 增加 `energyGainCondition: 'chain-repaired'`。
  - 文案改为“抽1。修补成功当前MP+1。”，明确不会提高最大 MP。

- `prototype-web/src/ui/hud.ts`
  - self 抽牌意图预览从 `抽N找解` 改为 `抽N仍-X`，避免玩家误读为已经解压。
  - Wild 在可修补时显示 `修补MPx xN`，不再用牌面 cost 错误显示断链。
  - 战斗日志显示 `修补MPx` 与条件 `MP+1`。

- 测试
  - `runtime.test.ts` 增加 Wild opener 不返 MP、broken chain 后不修补、`wild_gap_key` 支付牌面但修补有效费用等测试。
  - `redline-progression-card-system.test.ts` 锁住 Wild 成功修补时的事件字段与 `GainEnergy`。
  - `card-taxonomy.test.ts` 锁住 `wild_mana_stitch.energyGainCondition`。
  - `hud-target-selection.test.ts` 更新为 `抽1/2/3仍-X` 的压力反馈口径。

## 验收结果

- 目标测试：7 个文件，86 个测试通过。
- 全量测试：13 个测试文件通过，1 个跳过；113 passed，2 skipped。
- 构建：`npm run build` 通过；仍只有既有 Vite 500KB chunk warning。
- 浏览器验收：
  - 桌面 `1366x768`、移动 `390x844`、小屏 `360x640` 均通过。
  - 奖励态三选一正常，选择 Blood Tithe 后下一手可见 `抽1仍-14`。
  - 页面横向滚动、文字超框、控制台错误均为 0。
  - 测试浏览器已关闭。
  - 复测截图在 `/tmp/game001-round06-qa/`。

## 后续建议

第 7 轮建议不要继续堆 Wild 数值。更合理的方向是“真实整备 / 重排最小切片”或“HUD 信息架构压缩”。如果要做机制复刻，优先把 `paper_shatter / lantern_captain` 的 `reorder` 从标签变成一个可测试的小动作；如果要做体验收敛，优先把手机端卡牌按钮和战斗日志的短读数统一为同一套 token。

STATUS: DONE
