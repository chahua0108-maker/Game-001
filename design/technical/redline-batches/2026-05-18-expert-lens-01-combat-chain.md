# Redline Expert Lens 01 - Core Combat Chain

日期：2026-05-18
状态：worker 专家审查文档。只写文档，不改 runtime / data / test / HUD。
基线提交：`b24b262 Refocus Redline on hyper-turn card pressure`

## 阅读范围

- `design/technical/redline-hyperturn-acceptance.md`
- `design/technical/redline-hyperturn-modification-proposal.md`
- `outputs/research/vampire-crawlers/30-competition-pressure-redo.md`
- `prototype-web/src/data/cards.ts`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/tests/sim/redline-hyperturn-acceptance.test.ts`

## 1. 卡牌链路系统设计师

### 当前判断

当前系统已经有一个能跑通的 `0 -> 1 -> 2` 骨架：起手牌给了 `0, 1, 1, 2`，runtime 用 `nextExpectedCost` 推进 chain，断链不会禁牌，Wild 可以按期望费用补链，测试也能证明正序收益明显高于乱序。

但如果问题严格问 `0 -> 1 -> 2 -> 3` 是否有策略张力，答案是：还没有。当前 `maxEnergy = 3`，自然打出 `0 + 1 + 2 + 3` 需要 6 MP，除非有显式返费、临时加能量或链路折扣。现有验收合同实际允许 `0 -> 1 -> 2` 或 `0 -> 1 -> payoff`，测试中的救场也使用 2 费 `clearance_order`，不是完整 3 费终结链。

现在的张力主要来自“是否按费用排序”，还不够来自“同一费用段的路线选择”。如果不补这个层次，玩家很快会把系统理解成自动排序题。

### 10 个镜头观察

1. 合同写的是 `0 -> 1 -> 2` 或 `0 -> 1 -> payoff`，不是强制完整 `0 -> 1 -> 2 -> 3`。这降低了首轮可行性门槛，但也让 3 费 payoff 的定位变模糊。
2. 起手 `debt_hook / heartbeat_spark / redline_cut / row_cleave` 能清楚表达费用升序，第一手教学成立。
3. 起手里有两张 1 费牌，看似有选择；但当前只是“选哪张 1 费继续”，还没有形成保命、贪链、找 payoff 的分岔。
4. `advanceCostChain` 只看费用是否等于 `nextExpectedCost`，不看 `comboNode` 或路线类型。好处是规则干净，问题是所有 0/1/2 角色容易被费用同质化。
5. 断链后 runtime 会把链路重置到当前牌费用，后续仍可继续。这符合“断链不是禁牌”，但可能让乱序路线的惩罚不够可感知。
6. Wild 的底层语义已经有力：只要 chain 已开始，Wild 会按期望费用记入 `playedCosts`。这是正确方向，应该被玩家明确读到。
7. Draw 牌按 `effectMultiplier` 放大抽牌数，例如 `pulse_draw` 接在 0 费后会抽 2，而卡牌文案仍写抽 1。这个差异如果不前台化，会让玩家觉得系统在暗箱加成。
8. 3 费 payoff 已在数据里存在，但 3 MP 经济让它更像“起手直接打”或“被测试外部塞能量后打”，不是自然长链终点。
9. 奖励池包含 Wild、draw、payoff，方向正确；但前 3-5 回合的固定体验还没有证明“奖励回应上一轮链路问题”。
10. 现在缺少显式 `chainRole` / `payoffRequires` / `wildCostMode` 这类数据，导致系统意义藏在费用、描述和 `comboNode` 里，后续 HUD、QA、平衡都会反复猜。

### 最大风险

最大风险是把“升序费用链”做成单一路径的数学排序题：玩家只要看到 0、1、2 就顺手打完，看到 3 费就等资源或乱放。这样能通过测试，但没有 Vampire Crawlers 那种“这手牌看起来快断了，我用 Wild / draw / mana 把它救回来”的策略张力。

### 下一轮最小改动

不建议扩卡池。下一轮只要把现有牌的角色和一条 3-5 回合脚本收紧：

- 明确当前 slice 到底验 `0 -> 1 -> 2`，还是必须验自然 `0 -> 1 -> 2 -> 3`。如果要验 3 费 payoff，必须给可见的 mana gain / cost refund / chain rebate。
- 给现有牌补一层设计标签：`START 0`、`BRIDGE 1`、`EXPAND 2`、`REPAIR WILD`、`EXTEND DRAW`、`PAYOFF 3`。
- 每个关键费用段保留至少一个真实取舍：1 费伤害 vs 1 费抽牌；2 费前排伤害 vs 2 费找终结；Wild 现在用 vs 留给下一个缺口。
- 让 `clearance_order` 和 3 费 payoff 分工清楚：它可以是 2 费 mini-payoff，但不能同时抢走 3 费终结的高潮位置。

### 验收方式

- 同一固定手牌里至少存在两条升序路线，且结果不同：例如 `0 -> 1 damage -> 2 cleave` 偏清前排，`0 -> 1 draw -> 2 support` 偏找终结。
- 测试或 trace 明确证明 3 费 payoff 的资源来源：不是手动把 `energy` 改到足够，而是由 Wild / mana / rebate 产生。
- 乱序路线仍能出牌，但在 `effectMultiplier`、击杀数、剩余敌意图或后续手牌质量上明显落后。
- Wild 修补必须出现 `ChainRepaired`，并且玩家可读出它补的是哪一段费用。

## 2. 回合内节奏设计师

### 当前判断

runtime 已经从失败的 realtime heartbeat 方向回到回合制：`advance-time` 只负责 Deal 阶段自动发牌，核心伤害来自 `play-card`，敌人伤害在 `end-turn` 结算。这符合“高速回合制卡牌”而不是自动战斗。

但“hyper-turn”不是只有逻辑快。它需要玩家在一眼内读出路线，并能连续输入 2-4 张牌，看到连锁反馈快速升级。当前代码层面可以快速处理连续出牌，体验层面仍有慢速卡牌桌风险：需要选目标、读长文案、等 end-turn、看 refill、看 debug，这些都会把高速回合拖慢。

### 10 个镜头观察

1. 首个 `advance-time` tick 会从 `Deal` 进入 `PlayerTurn` 并发手牌，3 秒内可操作的底层条件成立。
2. `tickWorld` 对 `play-card` 没有冷却或长流程，理论上可以连续接收快速输入。
3. 4 张手牌和 3 MP 让首回合自然压缩成 `0 -> 1 -> 2` 三次行动，节奏比慢速大牌桌更短。
4. `front-enemy` 牌需要目标；缺目标时 runtime 会随机前排目标。随机 fallback 让测试更顺，但玩家体验上可能削弱“我负责这一刀”的节奏感。
5. 2 费前排牌不需要逐个点目标，适合高速回合，这是当前最接近 hyper-turn 的部分。
6. Draw 修补的节奏潜力很强：`pulse_draw` 在 x2 时会抽 2，能把“断了”变成“继续打”。但如果 HUD 没把抽牌结果和下一张可接链牌立即亮出来，会变成慢读手牌。
7. End Turn 当前一次性做完敌人攻击、压缩、补位、进回合、发牌。这对速度有利，但如果表现层逐条慢播，会把一个短回合拖成结算动画。
8. 敌人意图已经在发牌时声明，回合内不需要实时读秒，这是正确的卡牌压迫；但需要在 End Turn 旁边持续可见，否则玩家每回合都要重新算。
9. 奖励阈值当前不容易在前几回合打断节奏，这是好事；正式引入奖励时也应保持 1 屏内完成选择。
10. 现有测试验结果，不验操作节奏。它证明链能成立，但不能证明玩家会觉得快。

### 最大风险

最大风险是系统名义上叫 hyper-turn，实际玩起来像低行动点的慢速卡牌桌：玩家拿 4 张牌，读描述，点目标，点 End Turn，看一串结算，再重复。这样不会回到 realtime 错误方向，但也不会形成用户想要的“回合内高速打牌”。

### 下一轮最小改动

下一轮不需要新增复杂实时系统，只需要保护高速输入路径：

- 第一手 `0 -> 1 -> 2` 路线必须一眼可见，卡面只显示费用、角色、继续/断链、目标影响。
- 对单体前排牌给一个稳定默认目标和命中预览，减少第一回合的选目标摩擦。
- 出牌后立即更新 `Next MP`、倍率和可接链高亮，不让玩家停下来读日志。
- End Turn 结算要合并成“受到/避免多少意图伤害 + 新手牌”，不要逐条把 15 槽 debug 当主体验。
- 固定 3-5 回合脚本里，每回合都应在 2-4 张牌内完成一个明确小目标：成功链、断链、修补、payoff。

### 验收方式

- sim trace 中，一个正常成功回合应表现为连续的 `CardPlayed -> ChainAdvanced`，第三张触发 `front-row` 或 `PayoffTriggered`，中间没有非必要状态阻塞。
- 固定 5 回合脚本中，每回合玩家有效出牌数控制在 2-4 张；超过这个范围的回合必须是“修补长链”高潮，而不是普通回合。
- 单体牌如果没有显式目标，默认目标必须可预测；如果有显式目标，HUD 需要先预览击杀或意图减少。
- QA 可以用事件数量验节奏：5 回合内至少 1 次成功链、1 次断链、1 次修补、1 次 payoff，且没有依赖 `advance-time` 造成核心伤害。

## 3. 爽感核心机制设计师

### 当前判断

payoff 的方向是对的：合同要求 chain 成立后清前排或救场，runtime 会在 `comboNode === 'burst'` 时发出 `PayoffTriggered`，测试也证明第 4 回合能用 `debt_hook -> redline_cut -> clearance_order` 清掉前排并避免伤害。

但目前 payoff 还没有真正成为“救场/清算”的爆点。它更像一个乘了倍率的范围伤害。尤其是 3 费 `severance_burst` / `red_ledger_burst` 对全场生效，未武装时也可能直接杀弱怪；而测试中的救场依赖手动把前排 HP 设为 21，让 `clearance_order` 的 7 x 3 正好击杀 5 个目标。这能证明方向，但还不能证明自然体验已经爽。

### 10 个镜头观察

1. 合同已明确不要固定 60 秒 burst，要的是 chain 后 payoff 清前排或救场。这个裁决正确。
2. runtime 的 `PayoffTriggered` 有 `enhanced: multiplier >= 3`，但伤害规则没有根据 `enhanced` 分支，增强状态目前更多是事件标签。
3. `clearance_order` 是 2 费、`comboNode: burst`、目标 `front-row`，它在测试里承担了 payoff 救场职责。
4. `severance_burst` 是 3 费全场 16 伤害，未接链 x1 也会杀掉 10 HP 和 16 HP 的敌人，容易破坏“先 build 再爆”的因果。
5. `red_ledger_burst` 是 3 费全场 12 伤害，未武装也会清掉 10 HP 弱怪，同样有普通 AoE 过强风险。
6. `clearance_order` 在 x3 时造成 21 点前排伤害；测试把前排 HP 设为 21，所以救场非常整齐。真实敌人里 22 HP brute 会剩 1 HP，这可能制造险胜，也可能让玩家觉得 payoff 差一口气。
7. 击杀前排确实会减少 end-turn 伤害，因为死掉的 `roundAttackEnemyIds` 不再攻击。这是救场底层成立的关键。
8. 当前没有显式 `preventedIntentDamage` 或 `PayoffResolved`，所以“我避免了 10 点伤害”只能从 HP 没掉推断，不够爽。
9. 多目标伤害会产生多条 `DamageApplied` / `EnemyKilled`，但缺少一个统一的“清算完成”事件给 HUD/VFX 做爆点层级。
10. payoff 没有溢出、回血、抽牌、资源回收等二阶收益，救场后还缺“我靠这手牌扭转局面”的尾音。

### 最大风险

最大风险是 payoff 被玩家理解成普通 AOE：接链只是数字更大，不接链也能打很多目标。这样不会形成“差点崩盘 -> 修补 -> 长链 -> 清算救回来”的心理爆点。

### 下一轮最小改动

下一轮应该先把 payoff 的武装和未武装差异做硬，而不是继续加特效：

- 定义 `armed payoff`：例如 `multiplier >= 3` 且上一段费用为 2，或 chain length >= 3。
- 未武装 payoff 仍可出牌，但只给低收益：低倍率、有限目标、无清场升级、无救场标记。
- 武装 payoff 触发统一结算事件，包含 `affectedEnemyIds`、`killCount`、`preventedIntentDamage`、`enhanced`。
- 明确 `clearance_order` 是 2 费 mini-payoff 还是 2 费展开牌。如果它继续负责救场，就把 3 费牌定位成更高层的全场终结，不要互相抢戏。
- 救场回合最好附带一个轻量尾奖：例如避免伤害数字、短回血、抽 1、或 reward 文案回应，不必先做完整成长系统。

### 验收方式

- 同一敌阵下，`severance_burst` 或 `red_ledger_burst` 直接打出不能清场；接在合法 chain 后必须显著清场。
- `clearance_order` 如果作为 2 费 payoff，测试要验它是 mini-payoff：清前排或准清前排，但不抢 3 费全场爆点。
- payoff 救场验收不能只看 HP 没掉；需要验 `preventedIntentDamage > 0` 或等价事件。
- VFX/HUD 消费一个统一 payoff 结算事件，而不是从多条 `EnemyKilled` 自己拼爆点。

## 优先级建议

1. 先裁清 `0 -> 1 -> 2` 与 `0 -> 1 -> 2 -> 3` 的验收边界；若要 3 费终结，必须补可见资源规则。
2. 给现有卡补显式链路角色和 payoff 条件，避免继续靠描述、费用和 `comboNode` 猜系统意图。
3. 把 payoff 的武装/未武装差异做成规则差异，不只是事件上的 `enhanced` 标签。
4. 写死前 5 回合脚本时，每回合保留一个真实选择：伤害、抽牌、修补、贪 payoff，而不是只让玩家按费用排序。
5. 任何新增表现都先服务“快速读链、快速出牌、快速看见避免了多少伤害”，不要扩大成慢速教程或大面板。
