# Redline Expert Lens 05 - Balance, Deck Economy, Progression

Date: 2026-05-18
Worker: balance/progression expert group
Baseline commit: `b24b262`
Scope: read-only expert redline. No runtime, data, test, HUD, or VFX code changed.

Reviewed sources:

- `prototype-web/src/data/cards.ts`
- `prototype-web/src/data/enemies.ts`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/sim/world.ts`
- `prototype-web/src/tests/sim/runtime.test.ts`
- `prototype-web/src/tests/sim/progression-reward-regression.test.ts`

## 13. 战斗数值平衡师

### 当前判断

当前数值已经能支撑一个短促的 `0 -> 1 -> 2` 爽感切片：3 MP、4 张手牌、前排 5 个敌人、总意图 17 点伤害，会让玩家在 3-5 回合内感到压力。真正的问题不是没有爆点，而是爆点层级还不干净：2 费前排牌在正确链上合理，3 费全场牌即使乱序也过强，且自然 `0 -> 1 -> 2 -> 3` 在 3 MP 下不可达。

### 10 个镜头观察

1. 起手手牌固定为 `debt_hook`、`heartbeat_spark`、`redline_cut`、`row_cleave`，天然给出 `0 -> 1 -> 2` 教学路线，但没有 draw/wild，第一回合是稳定教学，不是变化构筑。
2. 玩家初始 `maxEnergy = 3`，刚好能支付 `0 + 1 + 2`；这对 3-5 回合 demo 是好事，因为第一条正确路线不用额外经济解释。
3. 同样因为 `maxEnergy = 3`，自然 `0 + 1 + 2 + 3` 需要 6 MP，当前只能在测试里通过手动加到 6 MP 或通过后续 mana 规则接近，不能作为默认体验承诺。
4. 前排初始敌人总意图是 17 点：2 + 5 + 3 + 2 + 5。玩家 60 HP，不处理前排大约 4 次结束回合会死亡，压力窗口足够短。
5. 标准 `debt_hook -> redline_cut -> row_cleave` 会让 `row_cleave` 以 x3 对前排打 15 点：能杀 10 HP 小怪，能把 16 HP 敌人打到 1，能把 22 HP 敌人打到 7；它是近清场，不是全清，节奏健康。
6. `clearance_order` 在 x3 时打 21 点前排：对 10/16 HP 敌人是清除，对未被单点补过的 22 HP brute 留 1 HP；这是非常适合 demo 的“准清场”数值。
7. `redline_cut` 基础 9 点在 x2 时是 18 点，能单独压掉 collector 或配合 AOE 收掉 brute；1 费桥牌的爽感明确。
8. `severance_burst` 基础 16 点打全场，即使 x1 也会杀掉所有 10 HP wisp 和 16 HP collector，约等于对当前 15 槽阵型直接清掉 10 个敌人；乱序收益过高。
9. `red_ledger_burst` 基础 12 点打全场，x1 至少清所有 wisp，也会把 collector 压到 4；它比 `severance_burst` 更像合理的未武装 payoff。
10. 倍率是线性 x1/x2/x3/x4，对前排 AOE 和全场 AOE 都直接相乘；这很容易读，但任何多目标牌的基础值都必须按“目标数乘数”重新估算，而不是按单体伤害估算。

### 最大风险

3 费 payoff 的未武装强度会吞掉 chain 的存在感。玩家如果发现 `severance_burst` x1 已经能清掉大部分阵型，就不会相信“先构建回合，再释放 payoff”是核心乐趣。

### 下一轮最小改动

只做一组数值和门槛收束，不改大系统：

- 把 3 费全场牌分成“未武装”和“武装”两档结算，未武装只做低额压血或前排有限伤害，武装后再全场清算。
- 若暂时不加新字段，先把 `severance_burst.damage` 降到不会 x1 清 collector 的范围，例如 8-10；把真正清场留给 x3/x4。
- 把下一轮验收重点放在 `clearance_order` 作为 2 费救场 payoff，而不是强行让 3 费 payoff 在默认 3 MP 下成为第一个 demo 爆点。

### 验收方式

- 固定起手 `debt_hook -> redline_cut -> row_cleave`：应杀 2-3 个前排，显著降低下一次 end-turn 伤害，但不必全清。
- 固定起手 `debt_hook -> redline_cut -> clearance_order`：应形成准清场或清 4-5 个前排，是 3-5 回合 demo 的主要救场证据。
- 乱序单放 `severance_burst`：不能清掉大多数当前阵型；至少不能让玩家认为它比正确 chain 更划算。
- 3 次空过回合仍应接近失败，证明敌人意图有压力；一次正确 chain 后应明显延缓失败，证明数值有救场感。

## 14. Deck/抽牌经济设计师

### 当前判断

当前 deck 经济是“可测试的固定教学牌堆”，还不是“能稳定产生选择的抽牌系统”。它适合第一回合证明 `0 -> 1 -> 2`，但在第 2-5 回合会很快暴露：初始牌组只有 4 张，抽牌大多只是在循环已用牌；wild/repair 已有雏形，但角色标签、reorder 文案和实际规则还没有完全对齐。

### 10 个镜头观察

1. `HAND_SIZE = 4`，初始牌组也只有 4 张，第一手等于整副牌；这让 demo 首回合稳定，但没有“抽到什么”的悬念。
2. 起手 4 张里有两个 1 费桥牌和一个 2 费前排牌，玩家每回合至少有一个明显正确路线；这是教学优势，也是长期选择单薄的来源。
3. `drawCardsFromDeck` 从 draw pile 取完后会从 discard pile 续抽；没有随机洗牌，顺序由弃牌进入顺序决定，利于验收但变化较低。
4. 出过的牌会立即进入 discard pile；自抽牌通过 `excludeFromReshuffle` 避免刚打出的那张被同次抽回，这是正确的防循环保护。
5. 其他早先打出的牌可以在同一回合被后续 draw 抽回；这能制造长回合，但也可能让 0 费 starter 反复出现，需要后续测试锁住是否允许。
6. `pulse_draw` 在 x2 时抽 2 张，`paper_shatter`/`lantern_captain` 在 x3 时理论上抽 3 张；抽牌随 chain 倍率放大，会让支援牌从“找牌”变成“爆抽”。
7. `energyGain` 不随倍率放大，`wild_mana_stitch` 永远只返 1 MP；这比抽牌倍率保守，能避免 mana 膨胀，但需要 HUD 明确，不要让玩家以为 x2 会返 2 MP。
8. `wild_mana_stitch` 是 0 费 self、draw +1、gain +1，并且 chain 已开始后可以按 expected cost 补位；这是当前最完整的 repair 牌。
9. `wild_gap_key` 是 1 费低伤害 wild；当 expected cost 高于 1 时，它能以较低支付成本补更高费用段，这个“折扣补链”很强，但当前只有描述隐含。
10. `utilities: ['reorder']` 目前只是数据标签，`paper_shatter` 和 `lantern_captain` 的“重排路线”没有 runtime 行为；这会导致奖励和卡面承诺超过实际选择。

### 最大风险

第 2-5 回合的“选择”会退化为重复打同一组固定牌，draw/wild 只是把固定路线重新拿回来，而不是让玩家在修链、救场、贪 payoff 之间做判断。

### 下一轮最小改动

先不要扩大卡池，先给 demo 一个小型牌堆脚本：

- 第一回合继续固定 `0/1/1/2` 教学。
- 第二回合刻意给一个断链手牌，例如缺 0 或缺 2，让玩家看到乱序仍可打但收益低。
- 第三回合保证出现一个 repair：`wild_mana_stitch` 或 `pulse_draw`，并让它实际接回 expected cost。
- 奖励牌入牌后必须在下一回合或下一次 draw 中可见，避免“选完奖励但没有马上改变手牌”。

### 验收方式

- 连续 3-5 回合记录每回合手牌费用序列：至少出现一次完整链、一次断链、一次 repair 成功。
- 记录每次 draw 的来源：从 draw pile、discard reshuffle、奖励新牌进入 draw pile 都要能复盘。
- 选择 `wild_mana_stitch` 后，下一回合或下一次抽牌必须能实际打出一条比未选它更长的路线。
- `reorder` 在未实现前，不应作为验收承诺；如果保留文案，验收必须能看到它改变牌序或路线。

## 15. 奖励/成长设计师

### 当前判断

奖励系统的事件链已经具备：击杀给 XP，达到阈值进入 Reward，三选一，选牌加入 deck 并恢复下一回合。但当前默认阈值和 demo 节奏不匹配：`xpThreshold = 45` 对 3-5 回合切片太慢，而且第一次升级后阈值会被改成 `nextLevelXp(2) = 42`，低于 45，存在后续升级节奏反常的风险。

### 10 个镜头观察

1. 敌人 XP 是 1/2/2 循环，初始 15 槽总 XP 约 25；默认 45 XP 阈值意味着玩家要杀超过一整屏敌人才第一次奖励。
2. 3-5 回合 demo 如果每回合清 2-5 个前排，大致能拿 8-25 XP；默认 45 基本不会自然触发奖励。
3. `LEVEL_XP_THRESHOLDS = [0, 18, 42, 78, 125, 185]`，但初始世界没有用 18，而是写死 `xpThreshold: 45`。
4. 第一次达到 45 后，玩家 level +1 到 2，然后 `world.reward.xpThreshold = nextLevelXp(world.player.level)` 会设为 42；这低于当前累计 XP。
5. 因为 XP 是累计制，第一次奖励选完后，只要再获得一次 XP，就可能立刻触发下一次 level-up；这不像平滑成长，更像阈值错位。
6. `progression-reward-regression.test.ts` 把阈值手动改成 1，只覆盖“能触发奖励”这条管线，不覆盖默认 demo 节奏。
7. 初始 reward pool 前三张是 `wild_mana_stitch`、`lantern_captain`、`severance_burst`，从角色分布看是 repair / extension / payoff 三选一，结构本身适合 demo。
8. 选中卡牌后，runtime 先清奖励、弃手牌、补位、推进回合、发新手牌，再 `AddCardToDeck` 把卡加入 deck 和 draw pile；因此奖励不会进入刚发出的那手牌。
9. 奖励延迟到之后 draw 才体现，降低了 demo 中“我刚选的成长马上改变下一回合”的反馈。
10. 候选池移除已选牌，可以避免重复奖励污染；但没有按玩家刚才的失败原因生成选择，当前更像固定队列，不像回应 build。

### 最大风险

成长系统会同时“来得太晚”和“来后节奏错位”：玩家在 3-5 回合切片里看不到奖励，或者一旦看到奖励又因为阈值回退而出现连续升级，破坏 demo 的节奏可信度。

### 下一轮最小改动

把成长改成 demo 服务型，而不是完整 roguelite 成长：

- 将首个 demo 阈值调到 8-12 XP，确保一次成功 chain 或两回合前排处理后能进 Reward。
- 修正阈值来源：初始 `xpThreshold` 应与 `LEVEL_XP_THRESHOLDS` 或 demo 专用阈值表一致，不能 first threshold 45、next threshold 42。
- 奖励选牌应在下一次发牌前加入 draw pile，或选择后立即安排下一手包含该牌，保证反馈闭环。
- 保持三选一角色：repair / extension / payoff；不要在 demo 阶段塞入更多泛用卡。

### 验收方式

- 默认初始世界下，不改测试阈值，3-5 回合内至少自然触发一次 Reward。
- 第一次奖励后，下一次阈值必须大于当前 XP；不能出现选完奖励后一杀立刻二次升级的阈值回退。
- 选 `wild_mana_stitch`、`lantern_captain` 或 `severance_burst` 后，下一回合或下一次 draw 必须能看到它进入手牌/路线。
- 奖励三选一必须始终覆盖 repair、extension、payoff 三类，且每张卡的实际 runtime 行为与标签一致。

## 优先级建议

1. 先修 reward 阈值：把默认首奖调到 3-5 回合内可见，并保证后续阈值单调上升。
2. 降低或门控 3 费全场 payoff 的未武装收益，避免 `severance_burst` x1 抢走 chain 爽感。
3. 把下一轮主爆点定为 `0 -> 1 -> 2` 的 `clearance_order`/`row_cleave` 救场，不要默认承诺 3 MP 下的自然 `0 -> 1 -> 2 -> 3`。
4. 让奖励卡更快进入下一手或下一次 draw，确保成长是 demo 反馈而不是延迟库存变化。
5. 暂时冻结卡池规模，只补齐 wild/draw/reorder 的真实行为和验收脚本，避免用新卡掩盖经济问题。
