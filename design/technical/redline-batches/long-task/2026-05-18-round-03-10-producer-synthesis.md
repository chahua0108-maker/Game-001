# 2026-05-18 第 3 轮专家 10：制作人收敛裁决

角色：第 3 轮制作人  
工作目录：`/Users/roc/Game-001`  
范围：只读当前工作树、第 1/2 轮 synthesis、相关第 2 轮专家文档和当前测试基线。本文不修改源码，不提交 git。

## 0. 当前事实基线

- 工作树仍处于并行 worker 脏状态，`main...origin/main [ahead 2]`，并且 `prototype-web` 有多处源码、测试、HUD、样式和新增 sim 文件未提交。第 3 轮不能回滚、覆盖或重解释这些改动。
- 第 1 轮已收敛到 P0 Hyper-Turn：读敌意图、打出 `0 -> 1 -> 2`、获得本回合临时授权、支付 3 MP payoff、奖励回应构筑但不伪装成局外成长。
- 第 2 轮已收敛到卡牌语言结构化：`CardDefinition` 已有类型、角色、可用性、短文案、关键词和 detail；验收口径明确不做实例、生命周期、状态牌和通用效果解释器。
- 当前代码已经有奖励三分支和修补雏形：`rewardChoices.ts` 会优先覆盖 `repair-resource / payoff / route-bridge`，`wild_mana_stitch` 与 `wild_gap_key` 已是 reward 池中的修补牌，`paper_shatter / lantern_captain` 已承担 draw-fixer 概念。
- 当前最大未收敛点不是“没有修补牌”，而是奖励节奏还没有进入自然 demo：初始 `reward.xpThreshold = 45`，而 `LEVEL_XP_THRESHOLDS = [0, 18, 42, 78, 125, 185]`，首奖与后续阈值不同步；奖励选择后当前顺序是先 `DealHand` 再 `AddCardToDeck`，玩家刚选的牌不会进入刚发出的下一手。
- 当前 `npm test -- --run` 已通过：13 个 test files passed、1 个 skipped；97 passed、2 skipped。测试绿不代表第 3 轮目标已完成，因为现有测试主要证明“奖励能触发、能选择、能进入当前 run”，还没有锁默认节奏和下一手反馈。

## 1. 三选一裁决

第 3 轮主裁决：

```text
应落地奖励节奏。
不开放新的修补牌池。
不做“只写测试”的空转轮。
```

理由：

1. “只写测试”不足以推进当前瓶颈。当前自动测试已经是绿的，继续只加合同测试会把第 3 轮变成第 2 轮尾巴，仍无法让玩家在 3-5 回合内自然看到奖励。
2. “开放修补牌”不是第一优先级。当前已有 `wild_mana_stitch`、`wild_gap_key` 两张真实 reward 修补牌，以及 `paper_shatter / lantern_captain` 这类抽牌支援；现在的问题是玩家很晚才看到奖励，且选完后反馈延迟，而不是修补牌数量不够。
3. 奖励节奏是第 1 轮 Hyper-Turn 和第 2 轮卡牌契约之间的缺口。只有把首奖、阈值单调和下一手可见做实，玩家才能从“我刚才缺修补 / 缺 payoff / 缺路线段”进入“我选择奖励并马上改变下一轮决策”。

## 2. 本轮目标

第 3 轮唯一主目标：

```text
让第一个 run 内奖励在 3-5 回合短切片中自然出现，并且玩家选择的奖励能立刻影响下一次手牌决策。
```

本轮只接受 4 个可验收结果：

1. 默认初始世界不靠测试手动把 `xpThreshold` 改成 1，也能在 3-5 回合窗口自然触发至少一次 Reward。
2. 首奖阈值与后续阈值表同步，第一次奖励后 `world.reward.xpThreshold > world.player.xp`，不能出现下一阈值回退导致一杀二次升级。
3. 非终局 reward 选择后，选中的牌必须在下一次发牌前进入可抽资源；P0 推荐 `drawPile.unshift(selectedCard)` 或等价的 next-hand guaranteed 机制。
4. 奖励三选一继续覆盖修补资源、payoff、路线桥接，且仍然只进入当前 run，restart 后清空，不变成永久 Max MP 或局外成长。

## 3. 本轮不做

- 不新增大量修补牌，不把 `blood_tithe / pulse_draw` 从 `reserve-test` 批量开放进正式 reward 池。
- 不做 `CardInstanceId`、升级实例、同名卡多版本。
- 不做 `retain / exhaust / destroy / purge` 生命周期牌区。
- 不做状态牌、诅咒牌、防御层、易伤、中毒、标记、净化闭环。
- 不做通用效果解释器、触发队列、`onDraw/onPlay/onDiscard/onKill` 系统。
- 不做敌人蓄力重击、打断窗口、Boss、地图节点、商店、删牌、reroll 或完整单局路线。
- 不改局外成长、账号存档、永久 Max MP、永久解锁。
- 不恢复 realtime heartbeat、自动攻击、无输入扣血或旧 60 秒 burst 验收。
- 不做浏览器 UI 大改版；除非奖励面板阻塞本轮核心路径，只允许最小文案或可见性修复。

## 4. 代码改动上限

本轮允许一个窄代码批次，最多 5 个文件，其中源码最多 3 个文件、测试最多 2 个文件。推荐范围：

| 优先级 | 文件 | 允许改动 | 禁止改动 |
| --- | --- | --- | --- |
| P0 | `prototype-web/src/sim/world.ts` | 初始 `reward.xpThreshold` 与第 3 轮节奏对齐，例如 10。 | 不引入 meta progression 或局外配置系统。 |
| P0 | `prototype-web/src/sim/runtime.ts` | 调整 XP 阈值表；保证下一阈值单调；非终局 reward 在 `DealHand` 前入牌且下一手可见。 | 不重切 runtime / ECA，不改完整回合架构。 |
| P0 | `prototype-web/src/tests/sim/reward-cadence-contract.test.ts` 或扩展现有 reward 测试 | 锁首奖默认阈值、阈值单调、Reward 阶段互斥输入、奖励下一手可见。 | 不写 30 张牌大模拟，不测随机权重。 |
| P1 | `prototype-web/src/data/cards.ts` | 仅在奖励三分支不稳定时微调现有 reward pool 顺序或可用性。 | 不新增大卡池，不开放 reserve-test 批量牌。 |
| P1 | `prototype-web/src/ui/hud.ts` | 只在奖励选择反馈不可读时补最小展示。 | 不做 HUD 重排或移动端大视觉工程。 |

硬上限：

- 总 diff 目标控制在约 250 行以内。
- 若触碰超过 5 个文件，暂停并回主线程裁决。
- 若必须修改 `style.css`，说明已经偏离本轮主题；默认不允许。
- 若需要改 `rewardChoices.ts`，必须证明当前三分支无法满足本轮奖励选择，否则不碰。

## 5. 实施顺序

建议第 3 轮执行顺序：

1. 先写或调整小型 Vitest：默认首奖阈值、首奖后下一阈值大于当前 XP、选择奖励后下一手可见、Reward 阶段拒绝 play-card/end-turn。
2. 再做最小 runtime/world 改动：首奖阈值从 45 收到 8-12 区间；阈值表改为绝对累计且单调，例如 `[0, 10, 24, 45, 72, 110]`；非终局选择奖励时先入牌再发手牌。
3. 保持 `pickCount = 3` 和三分支选择，不加 reroll，不加随机权重。
4. 跑 `npm test -- --run`。若有时间再跑构建；构建会写 `dist`，需由主线程决定是否纳入本轮验收。

## 6. 进入第 4 轮条件

只有满足以下条件，才建议进入第 4 轮“敌人意图与反制”：

1. 第 3 轮 synthesis 明确确认主目标是“奖励节奏”，不是修补牌扩池或测试空转。
2. 默认初始世界的首奖阈值进入 3-5 回合窗口，且下一阈值始终大于当前 XP。
3. 奖励三选一至少覆盖 `repair-resource / payoff / route-bridge`，并有自动测试证明不是简单取奖励池前三张。
4. 选择 reward 后，非终局下一手或下一次 draw 能稳定看到选中牌；如果选择“下一次 draw”而非“下一手必见”，必须在测试和文档中明确，不允许含混。
5. restart 后仍回到基础 deck、`maxEnergy = 3`、无奖励残留、无局外成长误保留。
6. `npm test -- --run` 通过，且没有跳过本轮新增的 P0 cadence 测试。
7. 本轮没有顺手引入实例系统、生命周期区、状态牌、敌人新意图、UI 大重排或局外成长。

## 7. 制作人最终裁决

第 3 轮不该继续讨论“完整牌组系统”，也不该只补测试证明旧系统仍然正确。当前需要把奖励从“代码里存在”变成“玩家在短切片中必然感知到的下一次决策”。

因此，本轮应该落地奖励节奏：低首奖阈值、单调阈值表、奖励入牌早于下一次发牌、三分支奖励保持。修补牌只使用当前已存在的正式 reward 修补牌，不开放新池；测试必须跟着实现锁住 cadence，而不是替代实现。

STATUS: DONE  
路径：`/Users/roc/Game-001/design/technical/redline-batches/long-task/2026-05-18-round-03-10-producer-synthesis.md`
