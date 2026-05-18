# 2026-05-18 Expert Lens 08 - Tech Architecture

角色：技术架构/可维护性专家组 worker

范围：

- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/sim/world.ts`
- `prototype-web/src/sim/snapshot.ts`
- `prototype-web/src/data/cards.ts`
- `prototype-web/src/data/enemies.ts`
- `prototype-web/src/tests/sim/redline-hyperturn-acceptance.test.ts`
- `prototype-web/src/tests/sim/runtime.test.ts`

约束：本文件只做审查记录，不修改 runtime、data 或 test，不跑测试。

## 22. Runtime 架构师

### 当前判断

当前 sim 已经具备清晰的名词雏形：`Intent`、`GameEvent`、`Command`、`WorldState`、`GameSnapshot` 都是显式类型，`tickWorld(world, intents)` 也是稳定公共入口。问题在于执行边界还没有真正分层：`tickWorld` 同时承担输入解释、校验、命令执行、事件入队、ECA 规则触发、回合流程推进、debug trace 记录和收尾状态恢复。它能支撑当前 Hyper-Turn 切片，但下一轮如果继续叠 chain、enemy intent、reward、UI replay，会越来越难判断一个行为到底属于 intent、command、event 还是 rule side effect。

### 10 个镜头观察

1. `tickWorld` 是单一大入口，从 restart、tick 递增、stale input、deal、advance-time、play-card、select-reward、end-turn 到 cast reset 都在一个函数里，当前更像脚本解释器而不是薄 runtime 调度层。
2. `const world = current; world.tick += 1` 直接原地修改传入对象；这让调用方必须理解 runtime 是 mutable reducer，而不是可回放的纯 reducer。
3. Intent/Event/Command 三层在类型上存在，但实际执行里经常交叉：intent 分支会直接调用 `applyCommand`，`applyCommand` 又返回 events，最后才交给 `processEventQueue` 触发规则。
4. `validatePlayCard` 不只是 validate；它会写入 `debug.failedConditions`，解析目标合法性，并生成 `SpendEnergy`、`DiscardPlayedCard`、`SetCharacterState` 命令，职责已经混合。
5. `applyCommand` 一进入就 `pushCommand`，即使后续命令因为目标不存在、敌人死亡等原因不产生状态变化，也会进入 command trace；这对调试有价值，但“命令被请求”和“命令实际生效”没有分开。
6. `play-card` 分支会修改传入 intent 的 `targetId`，这会把 runtime 内部 target resolution 反写到调用方对象上，破坏 replay/log 输入不可变性。
7. 敌人攻击权通过 `roundAttackEnemyIds` 快照实现，`DealHand` 时 snapshot，击杀、压缩、补位时又刷新 intent；这个设计能解决“本回合补进前排的敌人不应立刻攻击”，但语义分散在多处，不容易从单个状态机读懂。
8. `advance-time` 目前只承担 elapsedSeconds 和开局发牌；类型里还保留 `EnemyAdvanced`、`EnemyPressure`、`AutoAttack` 等旧 realtime heartbeat 语义，容易让后续 worker 误以为实时推进仍是当前合同。
9. ECA 规则执行在 `processEventQueue` 中统一发生，这是好的方向；但 runtime 仍然在规则前后直接拼装大量事件，下一轮应明确哪些事件是输入事实，哪些事件是命令结果，哪些事件是规则派生结果。
10. `resetCastState` 在每个 tick 末尾用首个 intent 的 traceId 收尾，UI 上能保持 Cast 短暂闪现，但 trace attribution 不够精确；同 tick 多个 intent 时，最后的 Idle 归属可能误导排查。

### 最大风险

最大风险是后续所有需求都继续补进 `tickWorld` 和 `applyCommand`，使 sim 表面上有 Intent/Event/Command，实际上却没有可维护的边界。到需要 replay、HUD 预览、AI 调参或多 worker 并行改 runtime 时，任何重排事件顺序、抽函数或调整数据都会引发不确定回归。

### 下一轮最小改动

先不做大重构，优先抽出两个窄边界：

- `resolvePlayCardIntent(world, intent)`：只负责目标解析、失败条件和初始 commands，不反写 intent。
- `runEndTurnSequence(world, traceId)`：把 TurnEnded、EnemyAttack、EnemyRefill、AdvanceRound、DealHand 的固定流程集中成一个命名序列。

这两个抽离完成后，再考虑把 `applyCommand` 拆成“命令请求记录”和“命令实际生效事件”两层。

### 验收方式

- 同一组显式 target 的 intents 连续 replay 两次，应得到相同关键 snapshot。
- play-card 输入对象在调用后不被 runtime 改写。
- end-turn 的事件顺序可通过一个集中测试表达，而不是散落在多个具体敌人 ID 断言里。
- failed play 只记录失败条件，不产生 CardPlayed、DamageApplied 或资源扣除。
- 当前 Hyper-Turn acceptance 行为不变：chain、断链、修补、payoff、enemy intent 仍可观察。

## 23. 数据建模工程师

### 当前判断

当前数据模型足够表达这一次 Hyper-Turn 卡牌压力切片：卡牌有费用、伤害、目标、combo 节点和少量 utility；敌人有 HP、伤害、槽位；snapshot 能把 chain、enemy intents、reward 和 debug 暴露出去。扩展风险在于数据还不是“效果模型”，而是“少量字段 + runtime/rules 约定”。下一轮如果要增加更多卡牌、敌人类型、状态、构筑、预览和 UI 表达，建议尽早把 catalog、effect、target、snapshot 分层。

### 10 个镜头观察

1. `CardDefinition` 只有 `damage`、`drawCards`、`energyGain` 和 `utilities` 这几个效果字段；一张牌如果以后要同时护盾、标记、位移、延迟触发、条件增伤，会逼迫类型继续加 optional 字段。
2. `comboNode` 是硬编码联合类型：`hook | cut | spark | mark | reclaim | burst`。这对当前风味清晰，但新路线会要求改全局类型，而不是只加数据。
3. `targets` 只有 `front-enemy | front-row | all-enemies | self`。当前够用，但不支持 lane、随机、最低血、最近、范围、可选目标、敌我双方状态条件等下一轮常见目标规则。
4. `utilities: ['reorder']` 已经出现在 `paper_shatter`、`lantern_captain`，但当前可读文件里没有对应的参数模型；这会让 UI 或测试只能知道“有 reorder 标签”，不知道具体能重排什么、几张、从哪里到哪里。
5. `startingHand` 和 `rewardCardPool` 是裸字符串数组，不是 `CardId[]`，也没有 catalog 校验；一旦改名或删除卡，错误可能要等运行时/测试才发现。
6. 奖励选择 `generateRewardChoices` 直接从候选池取前 N 张，当前可复现，但还没有 rarity、权重、去重策略、路线偏向或 seed；后续构筑感会被这个简化卡住。
7. `EnemyDefinition` 里有 `lane`、`z`，但 `createEnemy(serial, slot)` 会用 slot 重新计算 lane/z；这些字段现在是重复或失效数据，容易误导调参。
8. `PlayerState` 里保留 `lastPlayedCost`、`costChainMultiplier`，同时 `WorldState.chain` 也保存完整 chain 状态；镜像字段方便老 UI，但长期会产生双写一致性风险。
9. `EnemyIntent` 目前只有 `kind: 'attack'`，并把 `willRefill` 放在 intent 上；如果敌人未来有蓄力、护盾、召唤、换位、禁牌，intent 需要从敌人定义里数据化，而不是只由前排攻击快照推导。
10. `buildSnapshot` 深拷贝了 player、chain、reward、debug，但 enemies 用 `Object.values` 输出，缺少明确排序和 public/debug 分层；HUD 如果直接消费 snapshot，会同时拿到 deck/pile/debug internals。

### 最大风险

最大风险是卡牌和敌人继续靠 optional 字段、字符串标签和 runtime switch 扩展。短期会很快，长期会让“新增一张复杂牌”变成同时改 types、runtime、rules、snapshot、HUD 和多处测试断言，数据驱动能力不足。

### 下一轮最小改动

先做一层轻量 catalog 约束，不急着大改全部牌：

- 给 card/enemy catalog 增加验证函数，检查所有 pool id 都存在、id 与 key 一致、数值在合理范围内。
- 给 `CardDefinition` 增加可并存的 `effects` 草案字段，先让旧字段继续存在，新增复杂牌优先走 effects。
- 给 `EnemyDefinition` 明确是否保留 `lane/z`；如果 formation slot 才是权威，就移除或标注这些字段为展示默认值。
- 给 snapshot 划分 `public` 和 `debug` 语义，至少保证 enemies 按 slot/id 稳定排序。

### 验收方式

- catalog 校验能覆盖 `startingHand`、`rewardCardPool`、card key/id、enemy id、基础数值范围。
- 新增一张只含 draw/mana/repair 的牌，不需要修改 `CardDefinition` 主结构。
- 新增一个非 attack 敌人意图时，不需要破坏现有 attack intent summary。
- snapshot 中 enemies 排序稳定，且外部不能通过 snapshot 数组反向修改 world。
- UI 需要的 public snapshot 和调试面板需要的 debug trace 可以分开消费。

## 24. 测试可维护性工程师

### 当前判断

测试覆盖量很足，尤其是 chain、target、enemy attack rights、deck reshuffle、death settlement、enemy intent 和 Hyper-Turn acceptance 都有保护。问题是测试风格非常白盒：大量测试直接改 `world.player.hand`、`drawPile`、enemy hp/damage/slot 相关状态，并断言具体敌人 ID、具体 HP、具体事件数量和具体牌堆顺序。它现在是有效安全网，但对架构重构、数据 rebalance、formation 调整会很脆。

### 10 个镜头观察

1. `runtime.test.ts` 是 1000 行级单文件，覆盖很多领域；失败时定位需要读完整上下文，不利于后续 worker 并行维护。
2. 测试直接写 `world.player.hand = [...]`、`world.player.drawPile = [...]`、`enemy.hp = ...`、`enemy.damage = ...`，等于把测试绑定到内部 WorldState 结构。
3. acceptance test 也有大量场景缝合，例如把前排敌人 HP 改成 100 或 21、手牌改成指定组合；这保证合同可测，但读起来不像玩家路径，更像内部状态脚本。
4. `dealHand` helper 使用 `deal-hand` intent，Hyper-Turn acceptance 的 `dealOpeningHand` 使用 `advance-time` 自动发牌；两条入口都合理，但 trace 和状态路径可能分叉。
5. 多个断言依赖具体 enemy id 和 slot，如 `enemy-6` 补进前排、`enemy-16/17` 生成到后排；formation 规则一变，会牵动大量测试。
6. 伤害和 HP 断言直接依赖当前 cards/enemies 数值，比如 enemy intent 总伤害 17、低血 rescue 前玩家 HP 小于等于 15；这些更像 balance regression，不一定是 runtime contract。
7. 事件流断言很细，既断言 `CardPlayed.effectMultiplier`，也断言 `DamageApplied` 数量、`EnemyIntentResolved` 数量、`HandDealt.cardIds`；这些对行为透明度有帮助，但应区分 public contract 和 debug trace contract。
8. 测试已经有很好的负例保护：未发牌不能出牌、死目标不扣资源、后排不能被 front-enemy 打、同 tick 不能重复花同一张牌。这些应该保留为核心 regression。
9. `buildSnapshot` 只在 enemy intent 测试里被顺带验证，没有专门覆盖 snapshot 排序、深拷贝、防别名、debug/public 边界。
10. acceptance 文件表达了用户合同，但 runtime regression 文件仍然承担过多产品合同职责；后续应让 acceptance 保持体验语言，runtime tests 保护底层不变量。

### 最大风险

最大风险不是测试不够，而是测试太容易把实现细节冻结成“事实标准”。当下一轮需要整理 runtime 边界、调整敌人数据或优化 snapshot 时，维护者可能被迫机械更新几十处白盒断言，而不是判断体验合同是否仍成立。

### 下一轮最小改动

先建 test fixture 层，不急着删测试：

- 增加 `startPlayerTurn()`、`withHand()`、`withDrawPile()`、`withFrontRowHp()`、`playSequence()`、`eventsOfType()` 这类测试 helper。
- 把直接写 world 的操作集中到 helper 内，测试正文只表达场景意图。
- 按领域拆分 runtime 测试：`card-chain`、`targeting`、`enemy-turn`、`deck-reward`、`snapshot-debug`。
- 给测试分层命名：`acceptance` 只断用户合同，`regression` 才断具体内部事件和边界。

### 验收方式

- 新增或迁移测试时，测试正文不再直接改嵌套 world 字段；必须通过 fixture helper 表达 setup。
- 调整一个卡牌数值或敌人伤害时，acceptance 合同不应大量失败；只有 balance regression 需要更新。
- snapshot 有独立测试覆盖排序、深拷贝和 debug 字段。
- Hyper-Turn acceptance 仍覆盖六个合同点：起手路线、正序收益、敌人意图、断链低收益、修补、3-5 回合 payoff rescue。
- runtime regression 保留核心负例：非法出牌不扣资源、不弃牌、不推进 chain。

## 优先级建议

1. 先收窄 runtime 大入口：优先抽 `resolvePlayCardIntent` 和 `runEndTurnSequence`，不要继续把新需求直接塞进 `tickWorld`。
2. 建 catalog 校验和稳定 snapshot 排序；这是下一轮扩 cards/enemies 前最便宜的防线。
3. 建 test fixture 层，把直接 world surgery 收口，避免测试继续冻结内部结构。
4. 区分 public contract 和 debug trace contract：acceptance 断体验，runtime regression 断内部不变量。
5. 在引入更多随机或自动目标前，先补 seed/replay 约束；否则 UI 回放、AI 调参和 QA 复现都会变难。
