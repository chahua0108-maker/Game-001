# 2026-05-19 第 13 轮专家 02：生命周期 v1 制作人裁决

角色：第 13 轮专家 02，生命周期 v1 制作人  
工作目录：`/Users/roc/Game-001`  
文件所有权：本文只写 `design/technical/redline-batches/long-task/2026-05-19-round-13-02-lifecycle-producer.md`  
输出边界：只写文档；不改源码、不改测试、不提交 git、不回滚或覆盖其他工作者修改。  
依据：第 12 轮汇总、生命周期架构、运行时合同审查、HUD 可读性、QA 相似度、节奏平衡和制作人综合裁决。

## 0. 总裁决

第 13 轮 P0 正式进入 **牌区生命周期 v1**，但不能扩成完整卡牌实体系统。

制作人裁决：

```text
P0 必须同时交付：
CardMoved / 洗回事件
+ exhaustPile
+ retainedCards
+ 1 张状态/污染物理牌
+ HUD 短 token

P0 不做：
CardInstanceId 大迁移
+ 完整诅咒/净化生态
+ 升级/复制/删牌/商店/遗物/宝石
+ 新大 UI 面板
+ 默认 Max MP 或发牌数调整
```

理由：

- 第 12 轮已经通过 `qa:similarity` 证明 3 回合承压、Wild MP3 延链、payoff 续燃、paper topdeck 和移动端 HUD 没有退化。
- 第 12 轮明确把生命周期 v1 放进第 13 轮入口；现在不能继续只调研。
- 生命周期 v1 的价值不是“多几张新牌”，而是让玩家和 QA 能看懂牌为什么离开手牌、为什么不洗回、为什么跨回合保留、为什么污染牌真的占手牌位。
- 所有新增反馈必须继续遵守第 12 轮 HUD 边界：移动端只放短 token，完整 reason/event/debug 留给 tooltip、feed 或 debug。

本轮成功定义：

```text
玩家在 3-5 回合里能看见：
普通牌会弃牌并洗回；
消耗牌离开循环；
保留牌占下一手手牌位；
污染牌是物理牌、会占抽牌和手牌；
洗回发生时有短 token 和事件证据；
第 12 轮 Wild / reward / topdeck / payoff / qa:similarity 全部不退化。
```

## 1. P0 范围裁决

| 模块 | 裁决 | 必须做 | 不能做 |
| --- | --- | --- | --- |
| `CardMoved` | P0 第一刀 | 所有关键牌区移动有 `cardId/from/to/reason/traceId/tick` 或等价字段。 | 不能继续让 QA 从数组差异猜原因；不能把事件只写在 UI 文案里。 |
| 洗回事件 | P0 第一刀 | discard 回填 draw 时产生 `DiscardPileShuffledIntoDrawPile` 或等价事件，记录 moved/kept/excluded。 | 不能把 `exhaustPile`、retained、状态清理牌洗回；不能承诺随机洗牌。 |
| `exhaustPile` | P0 | 至少 1 张消耗牌打出后进入消耗区，不进 discard，不洗回。 | 不能做完整消耗触发器、消耗后永久删牌、消耗返还 UI。 |
| `retainedCards` | P0 | 至少 1 张保留牌回合末进入 retained，下回合先入手牌，再补抽到手牌上限。 | 不能让保留跨 reward 节点；不能突破手牌上限；不能做保留选择 UI。 |
| 状态/污染牌 | P0 | 至少 1 张 `cardType: status` 的物理污染牌可进入 draw/hand/discard，占手牌位；v1 可打出后消耗。 | 不能做长期诅咒、完整净化、不可打出禁用态、大量污染生态。 |
| HUD 短 token | P0 | 玩家首屏只显示 `消耗`、`保留`、`状态`、`洗回N`、`弃牌` 等短 token。 | 不能把 `CardMoved`、`DiscardPileShuffledIntoDrawPile`、长 reason、raw id 泄漏到移动 HUD。 |

优先级不等于可砍顺序。第 13 轮的 P0 是一个闭环：没有事件，生命周期不可验收；没有 HUD token，玩家不可读；没有三种最小牌，生命周期只是内部重构。

## 2. 必须做

1. 新增或等价实现 `CardMoved` 事件，覆盖打出、回合末、发牌、抽牌、奖励加牌、消耗、保留、状态创建和洗回相关移动。
2. 新增或等价实现 discard 洗回事件，至少记录 `movedCardIds`、`keptCardIds`、`excludeFromReshuffle`、`reason`。
3. 新增 `exhaustPile` 到世界初始化、snapshot、restart baseline 和测试观察面。
4. 让 1 张消耗牌走真实生命周期：打出后进入 `exhaustPile`，不进入 `discardPile`，不参与下一次洗回。
5. 新增 `retainedCards` 到世界初始化、snapshot、restart baseline 和测试观察面。
6. 让 1 张保留牌在 `end-turn` 时进入 `retainedCards`，下一次 `DealHand` 先带入，再从 draw/discard 补抽。
7. reward 选择或节点切换时，手牌清理必须走强制弃置/清理，不触发 `turn-end-retain`。
8. 新增 1 张状态/污染测试牌，必须是物理卡，能被抽到、占手牌、未打出时进 discard、洗回后还会再次出现。
9. 状态/污染牌 v1 推荐规则：可 0 MP 打出并消耗；节点结束清理，不进入长期 run/meta 诅咒。
10. HUD 新增生命周期短 token，移动端可见但不膨胀：`消耗`、`保留`、`状态`、`洗回N`、`弃牌`。
11. 保留第 12 轮所有关键回归：Wild MP3 printed/effective 分离、`ChainExtended` 不等于 `ChainRepaired`、payoff-only 授权、paper topdeck 只搜 drawPile、reward 加卡只进当前 run。
12. 新增生命周期 sim 测试，并把 `qa:similarity` 与 `qa:ui` 继续作为最终门槛。

## 3. 不能做

本轮明确不能做：

- 不能启动 `CardInstanceId` 全量迁移。
- 不能为了状态/污染牌引入完整诅咒、净化、删牌、商店或长期负面牌系统。
- 不能让 `exhaustPile` 参与 discard 洗回。
- 不能让保留牌跨过 reward 选择、节点切换或 restart。
- 不能让保留牌额外扩手牌上限。
- 不能让状态/污染牌只存在于 debug 或测试夹具，玩家牌区必须能看见它占位。
- 不能把状态/污染牌加入普通 reward pool，除非明确标成未来 P2。
- 不能让 `paper_shatter` 因生命周期改造而搜索 discard/exhaust/retained。
- 不能让 `wild_gap_key` 的 MP3 延链变成通用 Wild 规则。
- 不能让 `tempAuthorizationMP` 支付非 payoff 牌。
- 不能提高默认 Max MP 或起手发牌数来演示生命周期。
- 不能新增大批卡牌掩盖生命周期合同不清。
- 不能把 raw runtime event、reason 枚举、英文长事件名塞进移动端 HUD。
- 不能把自动化通过写成“完整复刻竞品”；报告仍必须保留 `notAFullClone=true`。

## 4. 制作镜头

| # | 镜头 | 玩家/QA 应看到什么 | P0 验收信号 |
| ---: | --- | --- | --- |
| 1 | 普通打出弃牌 | 普通牌打出后离开手牌，进入 discard。 | `CardMoved hand -> discardPile reason=play-default`；`CardPlayed` 不退化。 |
| 2 | 回合末弃牌 | 未保留的手牌在 End Turn 后进 discard。 | 每张普通手牌有 `turn-end-discard` 或等价 reason；End Turn 扣血仍与预览一致。 |
| 3 | 洗回发生 | drawPile 空时，discard 回填 draw，HUD 读作 `洗回N`。 | 洗回事件出现；`movedCardIds.length=N`；不承诺随机顺序。 |
| 4 | 自抽护栏 | 刚打出的抽牌牌不会立刻从 discard 洗回抽到自己。 | `excludeFromReshuffle` 仍生效；第 12 轮 self draw 回归不退化。 |
| 5 | 消耗牌打出 | 消耗牌打出后显示 `消耗`，离开抽弃循环。 | `CardMoved hand -> exhaustPile reason=play-exhaust`；后续洗回不包含该牌。 |
| 6 | 消耗区快照 | QA 和 debug 能看到消耗牌确实在 `exhaustPile`。 | snapshot clone 包含 `exhaustPile`；修改 snapshot 不污染 world。 |
| 7 | 保留回合末 | 保留牌在 End Turn 时不进 discard，短 token 显示 `保留`。 | `CardMoved hand -> retainedCards reason=turn-end-retain`；链路/授权同时清空。 |
| 8 | 保留下回合 | 下一次发牌先带入 retained，再补抽到手牌上限。 | `hand = retained + drawn`；`retainedCards=[]`；手牌总量不超过上限。 |
| 9 | 保留不跨 reward | reward 选择/节点切换时，保留规则不触发。 | `reward-selected-discard` 或等价强制清理；奖励牌仍能进入下一手循环。 |
| 10 | 污染牌进入牌区 | 污染牌不是状态图标，而是一张占位物理牌。 | `CardCreated` / `CardMoved ... reason=status-created`；draw/hand/discard 中能观察到该 `cardId`。 |
| 11 | 污染牌占手牌位 | 抽到污染牌后，本回合可用手牌位减少。 | `hand` 包含 status；发牌数量按真实手牌上限计算，不额外补偿。 |
| 12 | 污染牌清理路径 | 污染牌可打出并消耗，未打出则回合末进 discard。 | 打出：`status-play-exhaust`；未打出：`turn-end-discard`；节点结束可 `status-node-purge`。 |
| 13 | Wild 回归 | 生命周期新增后，Wild MP3 仍是延链，不是普通修补。 | `ChainExtended.extendedCost=3`；不出现 `ChainRepaired`；printed cost 仍为 1。 |
| 14 | payoff 回归 | 消耗/保留/污染不破坏授权终结。 | `severance_burst` 或等价 payoff 可用授权支付并触发 `PayoffResolved`。 |
| 15 | 移动端 HUD | 360/390 下生命周期反馈可读，不超框。 | 可见短 token：`消耗`、`保留`、`状态`、`洗回N`；无 raw token；无水平溢出。 |
| 16 | 失败镜头 | 断链、缺 MP、污染占位或抽牌 miss 仍是可理解失败。 | HUD 有 `断x1`、`缺MPN`、`仍-X` 或等价短 token；失败不是 UI/事件异常。 |

前 12 个是生命周期 P0 必须镜头；13-16 是第 12 轮回归和玩家体验门槛。缺任一类，本轮最多算 partial。

## 5. HUD 短 token 裁决

生命周期 v1 的玩家可见文本只允许短 token 进入战斗首屏：

| 语义 | 推荐 token | 可出现位置 | 不应出现 |
| --- | --- | --- | --- |
| 打出后弃牌 | `弃牌` | feed、debug 摘要、卡牌 tooltip | `play-default`、`discardPile` |
| 消耗 | `消耗` | 卡牌按钮、feed、director 小提示 | `exhaustPile`、`CardExhausted` |
| 保留 | `保留` | 卡牌按钮、End Turn 预览、下一手提示 | `retainedCards`、`turn-end-retain` |
| 状态/污染 | `状态` 或 `污染` | 卡牌按钮、feed、reward 禁止区说明 | `statusKind=pollution` |
| 洗回 | `洗回N` | director、feed、debug 摘要 | `DiscardPileShuffledIntoDrawPile` |
| 清污染 | `清状态` | feed、节点切换摘要 | `status-node-purge` |

移动端硬边界：

- `360x640` 是准入线，`390x844` 不能作为放宽依据。
- `.card-button` 上最多新增 1 个生命周期短 token，不加长句。
- 关键生命周期读数不能只存在于桌面 feed 或 debug。
- raw event/reason/id 只允许出现在 `.debug-panel[open]` 或测试输出 JSON。

## 6. 验收命令

最低验收命令：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test:sim -- src/tests/sim/redline-lifecycle-v1.test.ts
npm run test:sim -- src/tests/sim/redline-competitor-similarity.test.ts src/tests/sim/redline-paper-shatter-topdeck.test.ts
npm run test:ui -- src/tests/ui/hud-target-selection.test.ts
npm run check
npm run qa:similarity
npm run qa:ui
```

如果新增或修改浏览器 QA 脚本，必须额外跑：

```bash
cd /Users/roc/Game-001/prototype-web
node --check scripts/qa-similarity.mjs
node --check scripts/qa-ui.mjs
```

如果 `redline-lifecycle-v1.test.ts` 尚未落地，执行者必须新增等价生命周期测试文件；不能只靠现有 `runtime.test.ts` 间接覆盖。

通过线：

- lifecycle sim 覆盖普通弃牌、消耗、保留、状态/污染、洗回事件。
- `exhaustPile` 不参与洗回。
- `retainedCards` 不跨 reward，不突破手牌上限。
- 状态/污染牌是物理牌，占 draw/hand/discard 位。
- `CardMoved` 或等价事件能解释关键移动 reason。
- `qa:similarity` 保持第 12 轮 pass：Wild MP3、payoff 续燃、paper topdeck、失败压力、cleanup 全部成立。
- `qa:ui` 三视口无 console error、无水平溢出、无关键文本超框、无 raw token 泄漏。

## 7. 95 分路径

95 分不是“把生命周期做大”，而是在最小 v1 内做到玩家可读、QA 可追、旧合同不坏。

建议路径：

1. 先补类型和事件合同：`CardZone`、`CardMoveReason`、`CardMoved`、洗回事件；旧行为默认仍等价。
2. 再把现有 `DiscardPlayedCard` / `DiscardHand` 内部改为统一移动 helper；不要让 ECA 规则直接改牌区数组。
3. 接 `exhaustPile`，只给 1 张 reserve-test 消耗牌；先证明不进 discard、不洗回。
4. 接 `retainedCards`，只给 1 张 reserve-test 保留牌；证明下一手先带入并占手牌位。
5. 接 1 张 reserve-test 状态/污染牌；证明它能被创建、抽到、弃置、洗回、打出消耗、节点结束清理。
6. 给 HUD 加短 token helper，不把 reason 枚举直接渲染到玩家 HUD。
7. 补 lifecycle sim 测试后，再跑 Wild、topdeck、reward、HUD 回归；发现回归失败时先修合同，不继续加卡。
8. 最后跑 `qa:similarity` 和 `qa:ui`，把三视口、cleanup 和 `notAFullClone=true` 作为最终门槛。

95 分验收报告应能回答五个问题：

- 这张牌为什么从 `hand` 去了某个 zone？
- 哪些牌被洗回，哪些牌被排除？
- 哪张牌消耗后为什么不再出现？
- 哪张牌保留后为什么占下一手手牌位？
- 哪张污染牌如何影响玩家节奏，并在节点边界如何清理？

只要这五个问题还需要读源码猜，本轮就没有到 95 分。

## 8. 第 14 轮入口

第 13 轮完成后，第 14 轮按验收结果分流：

```text
如果 lifecycle v1 和 qa:similarity 全绿：
  第 14 轮可以考虑状态牌第二规则、短牌堆摘要、或小规模 reward 池接入。

如果 lifecycle v1 绿但 qa:similarity 退化：
  第 14 轮先修玩家镜头和 HUD，不扩生命周期。

如果 qa:similarity 绿但 lifecycle v1 partial：
  第 14 轮只补缺失项：通常是 retained/reward 边界、状态清理或洗回事件。

如果两者都退化：
  回退到 CardMoved + exhaustPile 两件事，其余保留/状态全部暂停。
```

STATUS: DONE
