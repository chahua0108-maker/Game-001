# 2026-05-18 第 2 轮专家 10：工程制作人 / 收敛 PM

日期：2026-05-18  
范围：只读当前 `Game-001` 工作树、第 1 轮 `long-task` 产物、当前 `prototype-web` 文件结构和已有测试文件后形成的第 2 轮执行建议。本文不修改源码、不提交 git。

## 0. 当前状态判断

当前仓库不是空白状态，`git status --short --branch` 显示 `main...origin/main [ahead 2]`，并且 `prototype-web` 下已有多处源码、测试、HUD、样式和新增 sim 文件处于未提交状态。第 2 轮必须默认有其他 worker 正在并行推进，不能回滚、覆盖或重新解释他们的改动。

第 1 轮综合结论已经把方向收住：

- 有效目标是 `Redline Hyper-Turn Card Pressure Slice`，不是旧的实时心跳 / 自动攻击 / 60 秒 burst。
- P0 已经跑通或正在跑通：`0 -> 1 -> 2`、本回合临时授权、3 MP payoff、敌意图、奖励三选一、移动端 HUD 降噪。
- 第 1 轮制作人建议第 2 轮主题是“卡牌机制契约”，但这不能被理解成马上实现完整卡牌 roguelike 引擎。

当前代码侧已经能看到第 2 轮方向的雏形：`CardDefinition` 已有 `cardType`、`chainRole`、`cycleRole`、`buildRole`、`availability` 等结构化字段；`cards.ts` 已经给当前卡组补了分类；`card-taxonomy.test.ts` 和 `redline-progression-card-system.test.ts` 已经开始锁定 payoff、奖励、run/meta 边界。这说明第 2 轮更应做“冻结与验收”，不是继续开大系统。

## 1. 本轮目标

第 2 轮唯一主目标：

```text
把现有 16 张左右的 Redline 卡牌从“描述能懂”收敛为“结构化契约可测、UI 可读、runtime 不误解”的卡牌机制合同。
```

具体目标只包含三件事：

1. 固定现有卡牌分类词汇：`cardType`、`chainRole`、`cycleRole`、`buildRole`、`availability`。
2. 固定 P0 终结牌边界：只有 3 MP、`all-enemies`、`burst`、`payoff` 类卡能消费 `tempAuthorizationMP`。
3. 固定文案边界：所有卡牌、奖励、HUD 都必须表达“当前 run / 本回合修补 / 临时授权”，不能暗示永久 Max MP 或局外成长。

本轮成功标准不是“补齐消耗、保留、状态牌、升级、触发器、效果解释器”，而是让当前卡牌系统不再靠自然语言猜规则。

## 2. 停做项

第 2 轮坚决不做：

- 不做卡牌实例 ID、升级实例、同名卡多版本共存。
- 不做 `exhaust`、`retain`、`ethereal`、`temporary` 的真实生命周期区。
- 不做状态牌、诅咒牌、污染抽牌堆、净化、删牌。
- 不做防御 / 格挡 / 易伤 / 中毒 / 标记等实体状态层。
- 不做完整 `effects[]` 解释器、触发队列、`onDraw/onPlay/onDiscard/onKill` 通用系统。
- 不做 X 费、动态降费、多模式卡、弃牌成本、scry/reorder 实装。
- 不扩大量新卡牌、新敌人、新奖励池、新 run 节点、商店、地图、boss。
- 不恢复 realtime heartbeat、自动攻击、无输入扣血或固定 60 秒爆发。
- 不把 `rewardChoices.ts`、`runModifiers.ts` 扩成局外成长系统。
- 不把 `runtime.ts` 重切成新架构；除非已有 P0 合同测试被证明无法通过，才允许最小 bugfix。

这些内容可以进入第 4 轮以后或单独机制设计文档，但不能进入第 2 轮代码批次。

## 3. 代码改动上限

如果第 2 轮还要动代码，建议上限是一个窄批次，最多 5 个文件，其中最多 3 个源码文件。优先顺序如下：

| 优先级 | 文件 | 允许做什么 | 禁止做什么 |
| --- | --- | --- | --- |
| P0 | `prototype-web/src/sim/types.ts` | 只补齐或收窄卡牌分类类型命名 | 不新增生命周期区、实例系统、触发器大模型 |
| P0 | `prototype-web/src/data/cards.ts` | 只给现有卡补分类、短描述和 reward/starting 边界 | 不新增大卡池，不用卡牌描述承载新机制 |
| P0 | `prototype-web/src/tests/sim/card-taxonomy.test.ts` | 锁定所有现有卡都有分类，payoff 集合不漂移 | 不写需要新引擎系统才能通过的测试 |
| P0 | `prototype-web/src/tests/sim/redline-progression-card-system.test.ts` | 锁定临时授权、3 MP payoff、奖励只进当前 run、restart 清空 | 不把局外成长、永久 Max MP 写进验收 |
| P1 可选 | `prototype-web/src/ui/hud.ts` | 如果 HUD 仍读不出卡牌角色，只显示已有分类/用途标签 | 不做 UI 大改版，不改布局系统，不顺手扩 `style.css` |

原则：

- 当前已有 `cardType/chainRole/cycleRole/buildRole/availability` 时，优先不要再改类型，只补测试和文案一致性。
- `runtime.ts` 默认不列入第 2 轮；只有发现“授权支付错误、payoff 边界错误、restart 误保留奖励”这类 P0 合同 bug，才允许一处最小修补。
- `style.css` 默认不列入第 2 轮；移动端遮挡属于第 1 轮 / HUD QA 尾项，不应借第 2 轮继续扩视觉工程。
- 全轮代码 diff 超过约 300 行，或触碰超过 5 个文件，就应暂停并拆回更小批次。

## 4. 如何避免“完整机制复刻”变成大重构

把“完整机制复刻”拆成两层：

```text
第 2 轮：契约层
  现有卡牌如何分类、哪些是 P0、哪些只是未来预留、哪些测试必须稳定。

第 4 轮以后：机制层
  生命周期区、状态牌、升级、触发器、效果解释器、随机种子、奖励权重。
```

执行规则：

1. 新增字段只能描述现有行为，不能要求 runtime 立刻支持新行为。
2. 测试只能锁定当前已实现或本轮明确允许实现的 P0 规则。
3. 如果一个测试需要新增命令、事件、区域、状态层或解释器才能通过，它不属于第 2 轮。
4. 如果一个卡牌标签只是未来规划，必须标成 `reserve-test` 或在文档中注明“不可驱动玩法”。
5. 第 2 轮不追求机制覆盖率，追求歧义消除率：玩家、QA、后续 worker 看到同一张卡时，不再对它属于 starter、repair、payoff 还是 reward-chain 产生分歧。

## 5. 验收清单

第 2 轮结束前只验这些：

- `npm test -- --run` 通过。
- `npm run build` 通过。
- 当前所有卡牌都有合法的 `cardType`、`chainRole`、`cycleRole`、`buildRole`、`availability`。
- payoff 集合稳定：只有 `severance_burst` 与 `red_ledger_burst` 这类 3 MP `all-enemies` `burst` 终结牌可以被视为终局 payoff。
- `clearance_order` 这类 2 MP `burst` 前排路线牌不被误判为 terminal payoff。
- `0 -> 1 -> 2` 只授予本回合 `tempAuthorizationMP`，结束回合或 restart 后清零。
- `tempAuthorizationMP` 只能支付 payoff，不允许支付普通 2 MP 路线段。
- 奖励卡只进入当前 run 的 deck/drawPile，restart 后回到 `startingHand`。
- 卡牌文案和 HUD 不出现“永久 Max MP +1”“局外成长已生效”等误导。
- 没有新增完整机制系统：无实例区、无 exhaust/retain 实装、无状态牌/诅咒牌闭环、无通用效果解释器。
- 本轮实际改动文件数不超过上限；若超过，必须有主线程重新裁决。

## 6. 进入第 3 轮条件

只有满足以下条件，才建议进入第 3 轮“发牌与坏手修补”：

1. 第 2 轮 synthesis 明确接受“卡牌契约冻结”，不再把完整机制复刻作为当前代码目标。
2. P0 卡牌分类、payoff 边界、临时授权、reward/run 边界都有自动测试覆盖。
3. 自动测试和构建通过，且没有靠跳过 P0 测试过关。
4. 当前 dirty worktree 中与第 2 轮无关的 worker 改动没有被回滚或覆盖。
5. 主线程确认第 3 轮只处理“断链、坏手、Wild/draw/mana 修补、固定短脚本”，不引入完整 deckbuilder 长 run。

如果上述条件不满足，第 3 轮不要扩系统。先补第 2 轮契约或把失控内容移到后续 backlog。

## 工程制作人裁决

第 2 轮应当非常窄：只把当前卡牌机制语言固定下来，让后续 worker 不再围绕同一套卡牌重复造词、误改 runtime 或把奖励误写成局外成长。

本轮最多允许做“分类字段 + 当前卡牌标注 + 契约测试 + 必要 HUD 标签”的小闭环。任何试图同时补消耗、保留、状态、升级、触发器、效果解释器的方案，都应视为大重构苗头，直接停做。
