# 竞品压迫机制重调研：Vampire Crawlers 不是实时压迫，而是超高速卡牌压迫

日期：2026-05-18
触发原因：`Redline 90s` 上一批把“压迫”实现成实时心跳、自动攻击、敌人推进和 60 秒脚本爆发。实际体验仍像卡牌游戏，而且偏离竞品。用户指出“核心体验当中的压迫不对，他还是卡牌游戏”，要求按上一轮原本机制重新调研竞品。

## 结论

上一批方向需要判定为 **pressure model failed**，不是单纯 implementation bug。

`Vampire Crawlers` 的核心不是把 `Vampire Survivors` 的自动攻击实时压力搬进第一人称卡牌界面，而是：

```text
第一人称地牢路线压力
  -> 进入遭遇
  -> 回合内抽牌 / 费用 / 升序 combo / Wild / gem / draw / mana 压力
  -> 高速出牌执行
  -> 敌群清空或承受伤害
  -> 升级 / 宝箱 / 遗物 / boss / 永久成长继续推高下一轮压力
```

它“还是卡牌游戏”，但不是慢速桌面卡牌。更准确的定义是：

**hyper turn-based card-driven dungeon crawler**：玩家可以慢慢计划，也可以高速打完整手牌；系统保证逻辑顺序准确，爽感来自卡牌链条越来越顺、越打越爆，而不是敌人实时自动压上来。

因此我们的原型应回调到上一轮原机制的基本姿态：

- 保留回合 / 手牌 / 费用 / 出牌顺序作为核心压力。
- 不把自动攻击设为底盘。
- 不用固定 60 秒脚本爆发代替构筑成立。
- 压迫来自敌群数量、敌人意图、HP 消耗、手牌缺口、费用缺口、combo 断链、路线选择和 boss/精英节点。

## 公开资料重新核对

### 1. 官方 / 平台口径：它是卡牌驱动的超回合制

Xbox Wire 的官方口径把它称为把 `Vampire Survivors` 的核心机械和审美转译成第一人称地牢 roguelite deckbuilder，并明确强调 `hyper turn-based, card-driven`，核心规则是升序 mana 出牌、Wild 延长 stack、combo 可以到 10/20/30 甚至无限。

这说明它的“快”不是实时动作，而是 **turn 内执行速度**。玩家可以战术性慢慢想，也可以极快出牌，但伤害结算仍然是卡牌逻辑。

关键机制：

- 卡牌有 mana cost。
- 升序出牌放大后续牌效果。
- Wild 卡允许延长 chain。
- leveling / chests / gems / power-ups 让 deck 和 card 继续变强。

### 2. 媒体正面口径：主动操作来自“每回合打牌”，不是自动攻击

VGC 的评价核心是：`Vampire Crawlers` 把 `Vampire Survivors` 原来“强了以后可以不碰手柄”的体验，改成需要玩家不断按按钮、不断做决定。它不是说玩家在实时闪避，而是每回合尝试把手牌按 mana cost 串起来。

GameSpot 同样把它描述成 first-person dungeon-crawling + turn-based battle：慢速 grid movement 只是抵达战斗的方式，真正战斗是用 deck 卡牌进行夸张攻击。重要的是：

- Crawler 决定初始武器和 passive。
- 卡牌获取有随机性，banish/skip/reroll 是后续调优手段。
- combo system 能让错配手牌也通过好执行过关。
- mana cost 升序 combo 不只放大伤害，也放大 buff/stat。

这进一步说明：压迫的主轴是“这手牌如何在费用顺序里打出最大收益”，不是“我不操作也会自动输出”。

### 3. 媒体负面口径：前期问题也证明它是卡牌压力，不是动作压力

PC Gamer 的负面评测很有参考价值：它认为游戏在前期容易陷入重复，真正有趣的 synergy 要解锁很久后才展开；同时它指出这款游戏仍然能做到“像 Vampire Survivors 的 deckbuilder”，但缺了 `Vampire Survivors` 中一些关键压力来源，比如失败战斗中逃离、auto-attack timing 等。

这对我们很关键：

- 竞品不是因为实时压迫做得好才成立。
- 竞品的风险恰好是：如果卡牌链条太单一，就会慢热、重复。
- 我们不应该用“自动攻击底盘”补它，而应该把第一局的 card-chain / build-breakthrough 提前。

### 4. 指南 / 玩家口径：压力核心集中在升序 combo、Wild、draw、mana、gem

多个公开攻略和玩家讨论都把核心指向同一处：

- 0 -> 1 -> 2 -> 3 的升序 mana chain。
- Wild / Reverse / Easy Combo gem 打破或修补顺序缺口。
- draw / mana generation 让一回合继续延长。
- payoff card 要放在 chain 后段。
- 高阶构筑会变成巨大 mana、巨大 hand、很长 combo，甚至接近无限。

这不是“实时 DPS”压力，而是“手牌是否能接起来”的压力。

## 对我们上一批实现的判定

上一批实现：

- `advance-time` 敌人推进。
- 每秒自动攻击。
- 前排进线实时轻伤玩家。
- 60 秒确定性 burst。
- XP 阈值调高，避免 reward 打断 90 秒。

这些能让测试变绿，也能制造浏览器画面动起来，但它们把核心拉向了另一种游戏：

```text
自动战斗 / 实时压力 / 脚本化大招
```

而竞品更像：

```text
遭遇制卡牌战斗 / 回合内高速出牌 / combo-chain 压力 / build 逐步失控
```

所以这不是“调参不够”，而是模型错了。

## 应回调到的上一轮原机制

“上一轮原机制”不应理解为全部保留旧缺点，而是保留这些正确骨架：

1. **回合制遭遇仍是主结构**
   - 敌人攻击、补位、下一轮发牌可以仍围绕战斗阶段组织。
   - 不操作时不应该自动帮玩家杀怪。

2. **卡牌是唯一主动战斗动词**
   - 玩家打牌才造成主要伤害。
   - 快感来自手牌被正确排序后连续爆开，而不是系统自动打。

3. **费用升序链是第一优先**
   - `0 -> 1 -> 2 -> 3` 应成为主教学与主策略。
   - 断链、缺 0、缺 1、payoff 过早出现，才是回合内压力。

4. **Wild / redraw / mana / draw 是救场工具**
   - 不要先做自动攻击。
   - 先做能修补手牌缺口的卡：Wild、抽牌、返还 mana、保留 mana、复制下一张。

5. **敌群压迫应表现为“回合后果”**
   - 前排敌人意图清楚。
   - 敌人数量、攻击总额、护甲需求、boss 倒计时构成压力。
   - 玩家如果本回合 combo 断了，下回合就承受明显代价。

6. **爆发必须来自 build，不是时间脚本**
   - 60 秒固定 burst 应取消或仅作为 debug demo。
   - 清场应来自：长 chain、payoff card、Wild/gem/reward 修补出的完整回合。

## 新的原型验收合同

下一轮不应再验“90 秒实时压迫”，应改为：

```text
Redline Hyper-Turn Card Pressure Slice
```

### 30 秒验收

- 玩家进入战斗后 3 秒内拿到手牌。
- 首手至少存在一条可读的 `0 -> 1 -> 2` 或 `0 -> 1 -> payoff` 路线。
- 第一轮能通过正确排序打出明显高于乱点的伤害。
- 敌人攻击意图清楚：如果本轮没清掉前排，下一轮会受伤。

### 90 秒验收

- 至少经历 3-5 个战斗回合。
- 至少一次出现“手牌缺口”：例如有 payoff 但缺 bridge。
- 至少一次出现“修补”：Wild / draw / mana / reorder 让 chain 接上。
- 至少一次出现“构筑救场”：长 chain 后 payoff 清掉前排或全场。
- 没有自动攻击替玩家解决核心敌人。

### 5-8 分钟压缩验收

可以用 debug seed 压缩到 2 分钟内，但逻辑应是：

```text
前几回合小 combo
  -> 奖励拿到 Wild / draw / mana / gem-like 修补件
  -> 敌群或 boss 压力加大
  -> 一回合长 chain
  -> payoff card 清场
```

## 设计建议：Redline 应该怎么改

### 保留

- 5x3 或类似前排/后排敌阵可以保留，但不要做成实时推进。
- 伪 3D 走廊可以保留，但作用是表达遭遇和敌群压力。
- HUD 中的 `当前威胁 / 可用动作 / burst 进度` 可以保留，但要改成 card-chain 语义。

### 删除 / 降级

- 删除自动攻击作为核心底盘。
- 删除不操作也持续打怪。
- 删除 60 秒固定 burst。
- 删除“实时推进到压力线就扣血”的主循环。

### 新增

- Card Chain Preview：显示当前能打出的 `0 -> 1 -> 2`。
- Chain Break Warning：如果乱点会断链，给明确提示。
- Payoff Highlight：高费攻击牌在 chain 后段高亮。
- Wild / Reorder / Draw / Mana 工具牌。
- Enemy Intent：前排敌人下一轮将造成多少伤害。
- Turn Result Burst：不是时间 burst，而是本回合 combo 结果爆发。

## 下一步执行顺序

1. 暂停当前 `Redline 90s realtime heartbeat` 方向。
2. 将当前 dirty worktree 保存为一个失败分支或 patch，不直接丢弃，作为失败证据。
3. 回调 runtime 到上一轮回合机制。
4. 保留 HUD/VFX 中不冲突的表现层：切割线、清场冲击、debug 降权、移动端布局。
5. 新建 `redline-hyperturn-acceptance.test.ts`，验证卡牌链而非实时心跳。
6. 重新设计第一手牌和 3-5 回合脚本：缺口、修补、payoff、救场。

## 来源

- Steam 商店页：`https://store.steampowered.com/app/3265700/Vampire_Crawlers/`
- Xbox Wire：`https://news.xbox.com/en-us/2026/04/21/vampire-crawlers-genre/`
- Windows Central review：`https://www.windowscentral.com/gaming/xbox/vampire-crawlers-review`
- GameSpot review：`https://www.gamespot.com/reviews/vampire-crawlers-review-pixel-perfect-pandemonium/1900-6418483/`
- PC Gamer review：`https://www.pcgamer.com/games/roguelike/vampire-crawlers-review/`
- VGC review：`https://www.videogameschronicle.com/review/vampire-crawlers-review/`
- PC Gamer preview：`https://www.pcgamer.com/games/roguelike/vampire-survivors-is-getting-a-deckbuilding-dungeon-crawler-spin-off-that-looks-purpose-built-to-annihilate-your-free-time/`
- PC Gamer hands-on：`https://www.pcgamer.com/games/card-games/if-youve-ever-had-a-crippling-vampire-survivors-or-slay-the-spire-habit-avoid-vampire-crawlers-at-all-costs/`
- Destructoid combo guide：`https://www.destructoid.com/how-does-the-combo-system-works-in-vampire-crawlers/`
- Pro Game Guides beginner guide：`https://progameguides.com/vampire-crawlers/vampire-crawlers-beginners-guide/`
