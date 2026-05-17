# Game-001 Web Prototype PM 体验审查

日期：2026-05-17  
角色：Web prototype PM / 对标体验审查 worker  
范围：只审查和记录，不修改 `prototype-web` 运行时代码。  

## 审查依据

- `design/technical/web-prototype-handoff.md`
- `design/technical/core-experience-gap-audit.md`
- `design/framework/web-runtime-refactor-plan.md`
- `outputs/research/vampire-crawlers/22-vampire-crawlers-core-experience-brief.md`
- `outputs/research/vampire-crawlers/14-first-3-hours-experience-analysis.md`
- `prototype-web/src/**`

本次按当前主线程确认的目标循环审查：

```text
回合开始 -> 发牌 -> 玩家出牌
没有费用或手牌出完时可手动结束
怪物开始攻击
怪物有自己的血条，没死不会消失
怪物有 5 个前排槽位且应被填满
后排/队列怪物在发牌结束、怪物攻击结束后自动顶上来
下一轮自动发牌
```

补充状态：当前代码中未发现“能量随时间恢复”的实现；`advance-time` 只推进时间并在 `Deal` 阶段自动发牌，能量主要在 `DealHand` 时回满。

## 当前验证

- `npm run build`：通过。Vite 报一个 chunk size warning，不影响本次玩法审查。
- `npm test -- --run`：失败 2 项，均来自 `src/tests/sim/runtime-audit.test.ts`：
  - 同一 tick 批次中 `end-turn` 后到达的 `play-card` 仍被处理。
  - 击杀前排敌人后，前排没有立即保持 0-4 五槽紧凑。

## P0

### P0-1：结束回合和出牌可以在同一 tick 串在一起，阶段边界不可信

**玩家看到什么**

玩家点击“结束回合”后，如果同一帧/同一批 pending intents 里还残留一次卡牌点击或数字键输入，这张牌仍可能在结算完成后的新 `PlayerTurn` 中被打出。新增审计测试 `rejects play-card intents that arrive after end-turn in the same tick batch` 正在失败，说明 `audit-stale-card` 的 `CardPlayed` 事件实际出现了。

**为什么破坏核心体验**

目标循环要求“玩家出牌 -> 手动结束 -> 怪物攻击 -> 补位 -> 下一轮发牌”是清晰的相位切换。现在 `tickWorld` 顺序处理同一批 intent，`end-turn` 内部又会完成敌人攻击、补位、下一轮发牌并回到 `PlayerTurn`，导致后续旧输入被当成下一轮合法出牌。这会让玩家感觉结束回合按钮不是阶段锁，而像一次瞬间刷新手牌的宏，破坏回合决策和输入可信度。

**建议归属模块**

- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/input/keyboard.ts`
- `prototype-web/src/ui/hud.ts`
- `prototype-web/src/tests/sim/runtime-audit.test.ts`

**最小修复建议**

在 runtime 层给 `end-turn` 设置硬阶段栅栏：同一 tick 中一旦处理 `end-turn`，后续 `play-card` intent 必须拒绝或丢弃，并记录 `stale-intent-after-turn-end`。UI 层可同时在点击结束回合后短暂禁用卡牌按钮，但不能只靠 UI，最终应由 `tickWorld` 保证。

### P0-2：结束回合始终可点，不符合“没费用或手牌出完时手动结束”

**玩家看到什么**

只要处于 `PlayerTurn`，HUD 就显示可用的“结束回合”按钮；即使玩家还有能量、手里还有可用牌，也可以直接结束。现有测试也只覆盖“0 能量且空手牌时允许结束”，没有覆盖“还有可用行动时是否应该拦截或二次确认”。

**为什么破坏核心体验**

目标循环把手动结束定义为兜底：没有费用或手牌出完时推进怪物回合。现在玩家可以随时跳过出牌，这会削弱费用/手牌压力，也会让新玩家误以为核心玩法是反复点“结束回合”刷新手牌，而不是在资源耗尽前打出有效牌序。

**建议归属模块**

- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/ui/hud.ts`
- `prototype-web/src/input/keyboard.ts`
- `prototype-web/src/tests/sim/runtime.test.ts`

**最小修复建议**

定义 `canEndTurn(world)`：当 `hand.length === 0` 或没有任何可支付卡牌时允许结束。HUD 用同一规则禁用按钮并显示原因；runtime 在不满足条件时拒绝 `end-turn`，记录 `turn-end-condition` 失败。若设计想允许主动跳过，应至少改成长按/二次确认，不要和兜底结束混在一起。

### P0-3：前排有 5 个槽位，但玩家实际只能打最早 slot 的一个敌人

**玩家看到什么**

画面和 HUD 都展示 5 个前排槽位，前排 5 个怪也会在结束回合时一起攻击；但所有 `front-enemy` 卡牌只能攻击 `frontAliveEnemyId`，也就是按 slot 排序最靠前的单个敌人。玩家点不同卡牌时没有目标选择，默认永远打 slot 最小的怪；测试还明确拒绝攻击 `enemy-2`，即使它也处在前排。

**为什么破坏核心体验**

目标说“怪物一共有 5 个前排槽位且应被填满”。如果玩家只能处理第一个 slot，其余四个前排怪对玩家来说更像背景队列，却又能参与攻击。这样 5 前排的空间决策不存在，卡牌目标也不成立，玩家会感觉规则在“显示五个前排”和“只承认一个最前目标”之间打架。

**建议归属模块**

- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/data/cards.ts`
- `prototype-web/src/ui/hud.ts`
- `prototype-web/src/presentation/renderer/corridorRenderer.ts`
- `prototype-web/src/tests/sim/core-loop-regression.test.ts`

**最小修复建议**

先把目标规则收敛成一个明确版本：`front-enemy` 可以攻击 slots `0-4` 中任一存活敌人；无显式目标时默认选血量最低或中间 lane 的前排敌人。HUD/renderer 需要支持点选前排目标或高亮当前自动目标。保留“只能打最早 slot”的牌应改名为 `closest-enemy`，不要复用 `front-enemy`。

### P0-4：击杀前排后不会立即补满前排，五槽填满承诺会短暂破裂

**玩家看到什么**

当前卡牌击杀 `enemy-1` 后，它会死亡并留在 slot 0；活着的前五个敌人 slot 变成 `[1,2,3,4,5]`，审计测试期望 `[0,1,2,3,4]` 因此失败。HUD 会显示“击杀，槽位待补”，玩家需要等到结束回合后才看到补位。

**为什么破坏核心体验**

用户强调前排 5 个槽位应被填满，后排/队列怪物需要自动顶上来。如果前排击杀后空洞保留到结束回合，玩家会看到“怪死了，但队列没有立刻接上”，怪潮压力断掉；同时下一次自动目标会跳到 slot 1，形成“空 slot 仍在前面”的视觉和规则不一致。

**建议归属模块**

- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/sim/world.ts`
- `prototype-web/src/presentation/renderer/corridorRenderer.ts`
- `prototype-web/src/ui/hud.ts`
- `prototype-web/src/tests/sim/runtime-audit.test.ts`

**最小修复建议**

在 `EnemyKilled` 后触发轻量 `CompactFrontRow`，只把队列向前压到前排五槽满，不必立刻生成新敌人；新敌人生成仍可放在怪物攻击结束后的 `FillEnemySlots`。这样玩家出牌击杀后能马上看到后排顶上，结束回合后再补满总队列。

### P0-5：怪物攻击、补位、下一轮发牌在一个 tick 内瞬时完成，玩家几乎看不到“怪物开始攻击”

**玩家看到什么**

点击“结束回合”后，runtime 会在同一个 `tickWorld` 调用里完成 `EnemyAttack`、`EnemyRefill`、`AdvanceRound`、`DealHand`，最终 snapshot 回到 `PlayerTurn`。HUD 的战斗信息会出现“前排反击”“攻击 -HP”“补位完成”，但画面很难稳定展示 `EnemyAttack` 或 `EnemyRefill` 阶段；renderer 也没有怪物攻击前摇、冲刺或命中特效。

**为什么破坏核心体验**

目标循环不是只要求数值扣血，而是要求玩家理解“我结束了，现在怪物攻击了，然后下一轮发牌”。当前实现把阶段压缩成瞬时日志，玩家看到的是 HP 突然减少和手牌刷新，不像怪物真的开始攻击。这会削弱怪物威胁，也让失败/受伤缺少可解释性。

**建议归属模块**

- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/presentation/renderer/corridorRenderer.ts`
- `prototype-web/src/ui/hud.ts`
- `prototype-web/src/tests/sim/runtime.test.ts`

**最小修复建议**

把 `EnemyAttack` 和 `EnemyRefill` 拆成可观察阶段。最小实现可以是：`end-turn` 只进入 `EnemyAttack` 并排队攻击事件；接下来的若干 `advance-time` 或一个 presentation ack 再依次执行攻击、补位、下一轮发牌。即使不做真实异步，也应输出可被 renderer 消费的 attack presentation commands，让玩家至少看到五个前排攻击动作后再发下一手牌。

## P1

### P1-1：发牌仍是固定 6 张全卡组，抽牌循环无法形成构筑压力

**玩家看到什么**

每轮发牌都是 6 张，也就是当前全部 `startingHand`。下一轮如果抽牌堆不够，会重新从 `startingHand` 取牌，弃牌堆被清空。玩家每轮都看到同一组牌，差别主要是能量和碎片是否足够。

**为什么破坏核心体验**

对标体验中卡牌是战斗引擎，抽牌、费用、combo 和构筑路线共同制造短期压力。现在每轮全量发牌会让玩家没有“抽到/没抽到关键牌”的紧张感，也不会形成路线选择，只是在固定按钮组里挑能点的按钮。

**建议归属模块**

- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/data/cards.ts`
- `prototype-web/src/ui/hud.ts`
- `prototype-web/src/tests/sim/core-loop-regression.test.ts`

**最小修复建议**

先改成 3-4 张小手牌，保留 draw pile / discard pile 的基本循环；每轮或每次击杀抽 1 张。`Severance Burst` 不应稳定起手出现，可以通过碎片阈值、奖励或抽牌概率进入手牌。HUD 增加抽牌堆/弃牌堆的轻量提示。

### P1-2：怪物血条存在，但战斗反馈仍偏表格和标签

**玩家看到什么**

怪物有 HP ring 和标签，没死时不会消失；受击时会有脉冲，死亡会淡出。但 HUD 左侧仍显示 15 个 slot 表格，目标 chip 和战斗日志比 3D 怪物本身更明确。怪物攻击和掉落没有独立表现。

**为什么破坏核心体验**

对标产品依赖“怪物血量下降、死亡、奖励飞入、队列压上”的连续反馈。当前血条证明规则存在，但玩家主要在读 UI 表格和日志，不是在看怪潮变化；这会削弱快速清怪和空间压迫。

**建议归属模块**

- `prototype-web/src/presentation/renderer/corridorRenderer.ts`
- `prototype-web/src/ui/hud.ts`
- `prototype-web/src/style.css`
- `prototype-web/src/sim/snapshot.ts`

**最小修复建议**

把 15 槽表格默认收进 debug，只保留前排五个威胁提示。renderer 增加最小三件套：受击数字/闪光、死亡爆点、碎片飞向 HUD。攻击时让前排怪有冲刺或红色预警，避免只在日志里扣 HP。

### P1-3：后排/队列补位只在结束回合后发生，发牌结束后的顶上规则没有单独表达

**玩家看到什么**

初始世界直接创建 15 个敌人，第一轮发牌只是把手牌发给玩家，不会触发单独的队列顶上事件。下一轮则是在敌人攻击后 compact/fill，再 advance round，再 deal hand。玩家看到的是“结束回合后补位完成”，而不是“发牌结束后队列自动顶上”。

**为什么破坏核心体验**

目标循环把“发牌结束”和“怪物攻击结束”都列为队列推进节点。当前只有攻击结束后的补位路径清晰，发牌结束没有自己的队列推进语义。短期不一定出 bug，但后续如果发牌阶段会加入抽牌动画、奖励、洗牌或队列预告，就缺少稳定挂点。

**建议归属模块**

- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/sim/world.ts`
- `prototype-web/src/tests/sim/runtime.test.ts`

**最小修复建议**

把发牌流程拆成 `DealHand -> HandDealt -> EnsureFrontFilled/QueueAdvanceAfterDeal -> PlayerTurn`。如果队列已满，该 command 可以 no-op，但要留下事件和测试，保证“发牌结束后顶上来”成为显式规则。

### P1-4：Burst 清场是可用规则，但不在当前目标循环中形成清晰高潮

**玩家看到什么**

`Severance Burst` 每轮都会出现在手牌中，未满足 3 碎片或 3 能量时禁用；满足后可对全场造成 24 点伤害。它更像一张固定大招牌，而不是由牌序、击杀、补位压力共同推出来的构筑爆发。

**为什么破坏核心体验**

对标体验的关键是“快崩盘 -> 抽到/攒出关键组合 -> 清场翻盘”。当前回合循环更关注发牌和结束回合，Burst 的出现没有和五前排压力、后排顶上、手牌耗尽形成强绑定，因此难以验证 build 爽点。

**建议归属模块**

- `prototype-web/src/data/cards.ts`
- `prototype-web/src/eca/redlineRules.ts`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/presentation/renderer/corridorRenderer.ts`
- `prototype-web/src/ui/hud.ts`

**最小修复建议**

让 Burst 的触发条件和本轮循环强相关：例如本轮击杀 3 个前排、连续补位 2 次、或用 `Hook -> Cut -> Reclaim` 完成一条 combo 后才把 Burst 抽入手牌。表现上增加全场暂停、红线切断和击杀数提示。

## P2

### P2-1：HUD 仍有过多内部状态和英文标签

**玩家看到什么**

顶部显示 `HP / EN / Beat / FSM / Restart`，中间有 `Front target`，右侧有 `Debug Trace`。虽然 debug panel 默认是 details 折叠，但大量内部词仍在第一屏出现。

**为什么破坏核心体验**

当前目标是验证单局循环和对标清怪体验，玩家第一眼应读到“当前回合、可用能量、前排威胁、出牌/结束条件”。`FSM`、`Front target`、英文卡名和 slot 编号会让 demo 更像调试台，降低题材和战斗动词的直觉性。

**建议归属模块**

- `prototype-web/src/ui/hud.ts`
- `prototype-web/src/style.css`
- `prototype-web/src/data/cards.ts`

**最小修复建议**

把玩家态 HUD 文案中文化：`HP` 可保留，`EN` 改为 `能量`，`Beat` 改为 `心跳碎片`，`FSM` 改为 `回合` 或隐藏到 debug，`Front target` 改为 `当前目标`。Debug Trace 默认只留一个小按钮或热键提示。

### P2-2：测试分裂成“已通过的核心回归”和“失败的审计期望”，需要收敛成共同验收口径

**玩家看到什么**

玩家看不到测试，但测试会决定实现方向。目前 `runtime.test.ts` 和 `core-loop-regression.test.ts` 大多通过，`runtime-audit.test.ts` 两项失败。也就是说，代码同时存在“当前行为被回归测试认可”和“审计期望认为这是缺口”的两套口径。

**为什么破坏核心体验**

如果不先统一目标循环，后续 agent 可能修一个测试、破另一个测试，或者继续把“只打最早 slot”“击杀后等结束回合补位”当成合理设计。对多 agent 并行工作来说，这会放大返工。

**建议归属模块**

- `prototype-web/src/tests/sim/runtime.test.ts`
- `prototype-web/src/tests/sim/core-loop-regression.test.ts`
- `prototype-web/src/tests/sim/runtime-audit.test.ts`
- `design/technical/core-experience-gap-audit.md`

**最小修复建议**

把本文件的 P0 条目转成一组新的核心循环验收测试，并重命名/调整旧测试中与目标循环冲突的断言。先统一测试描述，再改 runtime；不要让审计测试长期作为“已知失败但无人认领”的旁路文件存在。

## 最高优先级建议

1. 先修 `end-turn` 阶段栅栏，确保旧输入不能跨到下一轮出牌。
2. 明确五前排目标规则，并让前排击杀后立即由后排顶上。
3. 把怪物攻击/补位/下一轮发牌拆成玩家可观察的阶段，不要只在同一 tick 里写日志。
