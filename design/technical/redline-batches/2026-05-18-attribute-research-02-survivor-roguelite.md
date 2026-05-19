# Redline 属性成长调研 02：Survivor Roguelite

日期：2026-05-18
范围：只调研竞品属性成长结构，不修改代码。
重点：最大资源、技能/武器槽、冷却、充能、拾取范围、升级选择如何改变 build 路线。

## 1. 调研对象和资料来源

本轮调研对象是 `Vampire Survivors`、`Halls of Torment`、`Death Must Die`、`Soulstone Survivors`、`20 Minutes Till Dawn`。优先使用官方页面、wiki.gg、Fandom wiki；其中部分 wiki.gg 页面有抓取限制，但搜索索引和可访问镜像能交叉验证大方向。

| 游戏 | 主要来源 | 本轮关注点 |
| --- | --- | --- |
| Vampire Survivors | [Weapons](https://vampire-survivors.fandom.com/wiki/Weapons), [PowerUps](https://vampire-survivors.fandom.com/wiki/PowerUps), [Evolution](https://vampire-survivors.fandom.com/wiki/Evolution), [official wiki: Limit Break](https://vampire.survivors.wiki/w/Limit_Break), [official wiki: Magnet](https://vampire.survivors.wiki/w/Magnet) | 6 武器槽、6 被动槽、被动作为进化钥匙、全局属性和局外 PowerUps |
| Halls of Torment | [Stats](https://hot.fandom.com/wiki/Stats), [Trait](https://hot.fandom.com/wiki/Trait), [Ability](https://hot.fandom.com/wiki/Ability), [Blessing](https://hot.fandom.com/wiki/Blessing), [Steam page](https://store.steampowered.com/app/2218750/Halls_of_Torment/) | Trait rank、Ability 槽、装备/祝福、同一属性按标签定向加成 |
| Death Must Die | [Stat](https://dmd.fandom.com/wiki/Stat), [Blessing](https://dmd.fandom.com/wiki/Blessing), [Blessing Mechanics](https://dmd.fandom.com/wiki/Blessing/Mechanics), [Talent](https://dmd.fandom.com/wiki/Talent) | 神明祝福池、祝福类型槽、稀有度、reroll / alteration / banish 作为选择控制资源 |
| Soulstone Survivors | [Attributes](https://soulstone-survivors.fandom.com/wiki/Attributes), [Active Skill](https://soulstone-survivors.fandom.com/wiki/Active_Skill), [Passive skills](https://soulstone-survivors.fandom.com/wiki/Passive_skills), [Runes](https://soulstone-survivors.fandom.com/wiki/Runes), [Game Mechanics](https://soulstone-survivors.fandom.com/wiki/Game_Mechanics) | 主动技能池、被动无限叠层、cast frequency、multicast、rune / skill tree 局外塑形 |
| 20 Minutes Till Dawn | [Upgrades](https://20minutestilldawn.wiki.gg/wiki/Upgrades), [Runes](https://20minutestilldawn.wiki.gg/wiki/Runes), [Weapons](https://20minutestilldawn.wiki.gg/wiki/Weapons), [Tomes](https://20minutestilldawn.wiki.gg/wiki/Tomes), [HP](https://20minutestilldawn.wiki.gg/wiki/HP), [Fire Rate](https://20minutestilldawn.wiki.gg/wiki/Fire_Rate) | 升级树、武器基础约束、弹匣/装填、boss Tome 的强代价选择、rune 局外方向 |

## 2. 属性维度：伤害、频率/冷却、范围、持续、投射物、拾取、生命/护甲、资源上限/充能

### 2.1 伤害不是一个数，而是 build 的主语

`Vampire Survivors` 把武器伤害拆成基础伤害、Might、暴击、武器自身等级、进化后规则。它的强点不是单次升级 `+10% damage`，而是“我拿 Spinach 是为了提高火杖伤害，同时也可能是 Hellfire 的进化钥匙”。伤害属性同时承担数值提升和配方承诺。

`Halls of Torment` 更强调标签定向：Damage 可以是全局，也可以是 Main Weapon / Summon / Physical / Ability 等标签。这样同样的伤害成长会把玩家推向“继续强化主武器”或“转向某个 Ability 族群”。

`Death Must Die` 把伤害分成 Attack Damage、Spell Damage、Summon Damage，并通过神明祝福类型限制槽位。玩家不是单纯堆伤害，而是在决定“攻击替换、dash 替换、cast 冷却法术、strike 触发法术、summon、passive”哪个类型成为核心。

`Soulstone Survivors` 的伤害成长依赖技能标签和被动技能池：同一局里可以通过 Damage Modifier、crit、multicast、cast frequency、debuff stack 把某一组技能放大。build 路线常常来自“技能标签 + 被动候选池”的组合，而不是一张牌单独变强。

`20 Minutes Till Dawn` 把伤害和枪械约束绑在一起：Bullet Damage、Fire Rate、Reload Rate、Max Ammo、Projectiles、Piercing、Bullet Size 都会改变同一把枪的手感。高伤低弹匣、低伤高射速、多弹丸、召唤、元素触发会形成很不同的路线。

### 2.2 频率 / 冷却是“规模膨胀”的核心杠杆

Survivor-like 的强 build 多数不是只靠伤害，而是靠“单位时间触发次数”变多：

- `Vampire Survivors` 的 Cooldown 直接缩短多数武器攻击间隔，Amount 又增加每次释放的投射数量。
- `Halls of Torment` 的 Attack Speed、Multistrike、Force 会按技能定义改变发射频率、弹数、持续、穿透或击退。
- `Death Must Die` 的 Spell Cast Speed 专门降低神明祝福、物品法术、召唤等非普攻能力冷却。
- `Soulstone Survivors` 的 Cast Frequency 用公式压缩 active skill cooldown，同时 Multicast 让一次冷却触发多次施放。
- `20 Minutes Till Dawn` 的 Fire Rate 和 Reload Rate 围绕弹匣循环工作，Max Ammo 会改变“持续输出 vs reload 触发”路线。

对 Redline 的关键启发：`冷却` 不一定要做实时 CD，可以转译成“每回合能触发几次清算动作”“每几张正确链给一次额外结算”“payoff 充能速度”。频率成长要服务链路，而不是把回合制又拉回自动攻击。

### 2.3 范围 / 持续 / 投射物负责把单体 build 变成清屏 build

这些游戏的中后期爽感通常来自三个维度叠加：

- 范围：Area / Range / Spell Area / Pickup Range 增大可触达敌人或资源的半径。
- 持续：Duration、Force、Lasting skill 让场面上同时存在更多效果。
- 投射物：Amount、Multistrike、Missile Count、Projectiles、Pierce / Bounce 让一次触发影响更多目标。

这三类属性的机制价值不同：

- 范围让玩家从“点杀”变成“覆盖一排/一圈”。
- 持续让玩家从“瞬间伤害”变成“占场控制”。
- 投射物让玩家从“打中一个目标”变成“触发更多 hit / crit / status / on-kill”。

Redline 目前的等价物不是屏幕半径，而是 `前排 / 全场 / 槽位列 / enemy intent`。所以范围成长应该优先写成：

- 单体 -> 本列；
- 本列 -> 前排；
- 前排 -> 当前攻击者；
- 当前攻击者 -> 全场；
- 击杀溢出 -> 下一个未清算目标。

这样比直接写 `Area +20%` 更适合卡牌链。

### 2.4 拾取范围是“成长速度”的隐形属性

`Vampire Survivors` 的 Magnet、`Halls of Torment` 的 Pickup Range、`Soulstone Survivors` 的 Pick Up Range、`20 Minutes Till Dawn` 的 Pickup Range 都在做同一件事：降低玩家为了经验/金币离开安全路线的成本，间接提升等级速度和选择频率。

拾取不是纯便利属性，它改变 build 路线：

- 高拾取让玩家更早升级，提前拿到核心配方或技能。
- 高拾取让玩家更少冒险捡经验，防守 build 更稳。
- 当拾取范围和伤害范围绑定时，玩家会感觉“我控制了更大区域”。

Redline 不需要照搬地面经验球，但可以把拾取范围转译成“案件/债务/红线素材的回收半径”或更抽象的 `reward tempo`：

- 杀前排敌人时，额外回收同列后排 XP；
- 清算链越长，回收越远的案件素材；
- payoff 击杀后，把下一次奖励进度提前。

### 2.5 生命 / 护甲是 build 容错，不是只加血条

`Vampire Survivors` 的 Max Health、Armor、Recovery、Revival 给玩家容错；`Halls of Torment` 有 Base Health、Defense、Block Strength、Regeneration；`Death Must Die` 有 Life、Armor、Evasion、Revivals；`Soulstone Survivors` 有 Maximum Health、Armor、Block、Death Protections；`20 Minutes Till Dawn` 用 Max HP、Dodge、Holy Shield、Tomes 的 Max HP 代价做风险交换。

最有价值的不是“血更多”，而是把防御做成路线：

- 低血高伤：例如 20 Minutes 的 Glass Cannon / Tome 代价。
- 护甲转伤害：Death Must Die 的部分 talent 会让 Armor 变成伤害来源。
- 复活/护盾：允许玩家赌更激进的成长路线。
- 击杀回血/升级回血：鼓励继续进攻而不是龟缩。

Redline 可以把防御成长写成“允许玩家承受一次未清算反噬”，而不是只加 HP：

- `清算保险`：每局一次把未清算反噬降到 0。
- `债务缓冲`：End Turn 伤害先扣 buffer，再扣 HP。
- `错误容忍`：第一次断链保留 x2，而不是直接回 x1。

### 2.6 资源上限 / 充能是 build 变线的硬开关

这几款里最值得 Redline 学的是：资源上限或槽位上限一旦改变，build 路线会立刻变。

- `Vampire Survivors` 的 6 武器 + 6 被动让玩家早早被迫决定配方；进化要求把被动槽变成“钥匙槽”。
- `Halls of Torment` 一局最多 6 个 Ability，且 Ability 有自己的 trait / upgrade；这是技能槽上限带来的方向锁定。
- `Death Must Die` 对 Blessing 类型有限槽，且每局最多选四个神明来源，限制让玩家不能什么都拿。
- `Soulstone Survivors` 主动技能是核心槽位，被动技能继续无限堆叠；它把“技能选择”和“属性堆叠”分开。
- `20 Minutes Till Dawn` 的武器基础弹匣、装填时间、项目数量和 level 20 武器进化，把资源循环和升级路线绑在一起。

Redline 当前 `maxEnergy = 3` 和 `0 -> 1 -> 2 -> 3` 的冲突，本质就是资源上限没有解释完整链。竞品的答案不是默认给无限资源，而是让玩家通过成长拿到“刚好能打出新路线”的硬开关。

## 3. 成长来源：升级、道具、进化、角色、局外 meta、临时 buff

### 3.1 升级：三选一不是奖励 UI，而是 build 分岔器

这些游戏的升级选择通常承担三件事：

- 补短板：缺伤害、缺范围、缺防御、缺拾取。
- 强化当前路线：已有技能的等级、同标签被动、已拿祝福的升级。
- 开新路线：新武器、新技能、新祝福、新树节点。

Redline 的升级三选一应避免“都只是加伤害”。首个奖励最好固定覆盖三种角色：

- 经济：`最大 MP +1` 或 `正确接链返 1 MP`。
- 修补：`一次 Wild 接链` 或 `断链保留倍率`。
- payoff：`终局清算更容易 armed` 或 `armed 后影响前排/全攻击者`。

### 3.2 道具：道具要么改属性，要么改规则，最好还能当钥匙

`Vampire Survivors` 的被动道具最清楚：它既是属性成长，也是进化配方的一半。玩家选择 Empty Tome，不只是要冷却，也是在承诺 Magic Wand 进 Holy Wand 的路线。

`Halls of Torment` 的装备和稀有变体更像“把一组属性绑定成职业倾向”。`Death Must Die` 的 items 会改祝福稀有度机会、角色属性和选择资源。`20 Minutes Till Dawn` 的 Tomes 是强力但带代价的临时大拐点。

Redline 的道具等价物可以是“清算文书 / 红线器械 / 审计印章”：

- `透支批文`：最大 MP +1，但未清算反噬 +2。
- `续链缝针`：每回合第一次跳过费用仍算接链，但 payoff 基础伤害 -20%。
- `清算印章`：armed payoff 影响全体攻击者，但需要链长 4。

### 3.3 进化：不是更大数字，而是配方完成后的规则变体

`Vampire Survivors` 的进化是最直接的启发：武器满级 + 对应被动 + 宝箱触发。它会让玩家从开局就思考“我现在拿这个被动，会不会锁定未来进化”。

Redline 不该早期做复杂配方表，但可以做一个小型进化：

- `Row Cleave` + `清算印章` + 链长 3 成功两次 -> `Clearance Order`。
- `Severance Burst` + `透支批文` + 最大 MP 4 -> `Final Audit`。
- `Wild Mana Stitch` + `断链修补 3 次` -> `Ledger Stitch`。

关键是进化后要改规则：目标范围、armed 条件、意图削减、返费、抽牌，而不是只把伤害从 12 改到 20。

### 3.4 角色：角色不是皮肤，是起手约束

竞品角色通常定义开局差异：

- Vampire Survivors：起手武器和角色属性。
- Halls of Torment：主武器、职业 trait、基础速度/血量。
- Death Must Die：攻击形态、祝福槽关系、talent 树。
- Soulstone Survivors：职业、武器、初始技能池、rune 可塑性。
- 20 Minutes Till Dawn：角色技能 + 武器组合形成起点。

Redline 后续角色可以从“起手链路偏好”开始，而不是先做职业大树：

- `审计员`：起手稳定 `0 -> 1 -> 2`，奖励更容易出修补。
- `处刑员`：起手 payoff 更强，但最大 MP 低或断链惩罚大。
- `调度员`：抽牌/重排多，直接伤害低。

### 3.5 局外 meta：应该扩大表达，不应该替代局内选择

这些游戏几乎都有局外成长：PowerUps、Blessings、Talents、Runes、Skill Tree。它们负责长期目标，但如果太强，会让早期关卡只是在数值碾压。

Redline 的局外 meta 应先只解锁“路线选项”，不要直接把第一局体验冲平：

- 解锁新奖励类型，而不是永久 `+50% damage`。
- 解锁一个额外 reroll / banish，而不是直接给高 MP。
- 解锁“首个奖励保底某类”，例如保底修补、经济或 payoff。

### 3.6 临时 buff：适合做高潮，不适合做常态核心

`20 Minutes Till Dawn` 的 Elemental Barrage、Ethereal、Tomes，`Death Must Die` 的临时祝福，`Soulstone Survivors` 的 stacking buff 都说明：临时 buff 很适合把 build 推向短时间爆发。

Redline 可以把临时 buff 做成“本回合清算授权”：

- 本回合最大 MP +2；
- 本回合第一次 payoff 必定 armed；
- 本回合每次击杀返 1 MP；
- 本回合链长上限 +1。

但它不能替代基础规则。玩家必须先理解普通 chain，再理解临时授权如何放大 chain。

## 4. 对 Redline 的启发：如何把 MP 上限、清算链长度、payoff armed 条件做成成长

### 4.1 三条成长路线

Redline 目前的核心矛盾是：3 MP 能自然打 `0 -> 1 -> 2`，但打不了 `0 -> 1 -> 2 -> 3`。不要简单把初始 MP 改成 6。应该把完整链变成成长目标。

建议把成长拆成三条路线：

| 路线 | 玩家感知 | 机制变量 | 典型奖励 |
| --- | --- | --- | --- |
| 资源路线 | 我能多打一步 | `maxMp`, `mpRebate`, `turnStartMp`, `killRefund` | 最大 MP +1；正确接链后返 1 MP；击杀后本回合 +1 MP |
| 链长路线 | 我能把程序推进更远 | `requiredChainLinks`, `chainTolerance`, `maxChainMultiplier`, `wildBridgeCount` | 清算链上限 +1；第一次断链仍保留倍率；Wild 可补任意费用 |
| payoff 路线 | 我能让终结更早或更大 | `payoffArmedAt`, `payoffCharge`, `armedTargetScope`, `armedBonus` | 链长 3 即 armed；每次正确接链 +1 charge，3 charge armed；armed 后打全攻击者 |

### 4.2 MP 上限成长：必须带代价或路线承诺

不要把 `+1 max MP` 做成必拿最优解。竞品常用做法是让强属性带配方、槽位或代价。Redline 可以这样设计：

- `透支额度`：最大 MP +1；End Turn 时未清算反噬 +2。适合贪长链，但需要玩家真的清场。
- `预算回收`：每回合第一次击杀返 1 MP；不提高上限。适合前排击杀路线。
- `审计预支`：如果上一张牌正确接链，下一张 3 费牌本回合费用 -1。只服务 payoff，不泛化成所有牌变便宜。
- `清算余款`：armed payoff 后返 1 MP。鼓励把 payoff 放在链末，而不是开局乱打。

### 4.3 清算链长度成长：从“排序题”变成“程序推进”

链长成长不要只是 x4、x5。它应该改变玩家如何处理坏手牌：

- `链长上限 +1`：允许 `0 -> 1 -> 2 -> 3` 才出现最终清算，不影响前期 `0 -> 1 -> 2` 教学。
- `跳费容忍`：一次 `0 -> 1 -> 3` 可以被视为“缺 2 但程序补录”，倍率少一级。
- `同费分支`：允许第二张 1 费作为“证据补强”，但不推进 expected cost，只给 charge。
- `断链缓冲`：每回合第一次断链不清空链，只冻结 multiplier。

这能把升级选择做成路线：稳定派拿容错，贪心派拿链长，爆发派拿 payoff charge。

### 4.4 Payoff armed 条件：从单一阈值变成可成长门槛

建议把 `armed` 定义为显性条件，而不是藏在倍率里：

```text
payoff armed = 满足以下任一条件：
1. 本回合正确接链次数 >= 3；
2. 当前 chain multiplier >= x3 且 lastPlayedCost >= 2；
3. payoffCharge >= 3；
4. 特定奖励把本张 payoff 的 armedAt 从 3 降到 2。
```

然后让成长改变条件或结果：

- 降低门槛：`armedAt -1`，但 armed 范围不扩。
- 扩大范围：armed 后从前排变当前攻击者。
- 增加副收益：armed 后抽 1、返 1 MP、清 1 层意图。
- 增加储能：没打 payoff 时，保留 1 点 charge 到下回合。

这样 payoff 不会变成“3 费大数字”，而是成为 build 的终点。

### 4.5 Redline 的属性命名建议

为了避免通用 RPG 属性汤，建议 Redline 只保留 8 个可读属性：

| Redline 属性 | 等价竞品属性 | 玩家话术 |
| --- | --- | --- |
| `最大 MP` | Max resource / ammo / slot budget | 这回合能多走一步程序 |
| `清算链上限` | weapon slot / chain capacity | 程序可以推进到更高阶 |
| `接链返费` | cooldown / reload / on-kill refund | 打对顺序就延长回合 |
| `修补次数` | reroll / wild / alteration | 坏手牌还有救 |
| `终局充能` | charge / tome / temporary buff | 终结技正在 armed |
| `清算范围` | area / range / projectiles | 从单案扩到前排/攻击者 |
| `反噬缓冲` | armor / shield / death protection | 失误不立刻崩盘 |
| `回收效率` | magnet / growth / XP gain | 更快拿到下一次选择 |

## 5. 不建议照搬的点

1. 不要照搬无限叠冷却、弹数、范围。Soulstone 和 Vampire Survivors 的后期失控适合清屏游戏，但 Redline 当前要证明的是链路决策，不是特效数量。
2. 不要一开始做 6 武器 + 6 被动 + 大量进化配方。Vampire Survivors 的配方很强，但早期 Redline 只需要 2-3 个可读“钥匙”。
3. 不要把拾取范围做成跑图捡经验球。Redline 的场地是槽位和意图，不是大地图走位；拾取应转译为奖励节奏或案件回收。
4. 不要把局外 meta 做成数值碾压。永久伤害、永久 MP 很容易让 3-5 回合 demo 失真。
5. 不要把 reroll / banish / alteration 全塞进首版。Death Must Die 的选择控制资源很有价值，但 Redline 首版只要一个 `reroll` 或“保底类型”就够。
6. 不要让 `+1 max MP` 成为无脑最优。它必须绑定代价、路线或 payoff 条件，否则所有 build 都先拿资源。
7. 不要让 unarmed payoff 太强。竞品清屏爽感建立在成长完成后；如果 Redline 的 3 费牌 x1 就能清场，链路就变装饰。
8. 不要用抽象英文属性堆 HUD。`CHAIN / Payoff / MP` 可以留作开发字段，但玩家侧应逐步转成“清算链 / 终局清算 / 预算”。

## 6. 下一轮最小原型建议

### 6.1 只做 3 个成长奖励

下一轮不要扩卡池。只加三张或三项 reward，分别代表资源、链长、payoff 三条路线：

| 奖励 | 类型 | 效果 | 验收点 |
| --- | --- | --- | --- |
| `透支批文` | 资源 | 最大 MP +1；若 End Turn 仍有未清算反噬，则反噬 +2 | 玩家能自然打出 `0 -> 1 -> 2 -> 1` 或更接近 3 费 payoff，但乱用会更危险 |
| `证据续链` | 链长/修补 | 每回合第一次跳过一个费用仍算接链，但 multiplier 少升一级 | 断链手牌能被救回，不再只是排序题 |
| `终局印章` | payoff | 每次正确接链 +1 charge；3 charge 后下一张 payoff armed，armed 后影响所有本回合攻击者 | payoff 从“高费牌”变成“我刚才 build 出来的终结” |

### 6.2 固定 5 回合脚本

用一个固定 seed 验证成长改变路线：

1. Turn 1：玩家打 `0 -> 1 -> 2`，看到正确链能把未清算反噬降到低值。
2. Turn 2：给断链手牌，展示没有修补时收益明显变差。
3. Turn 3：触发首个 reward，三选一出现 `透支批文 / 证据续链 / 终局印章`。
4. Turn 4：根据所选奖励给不同手牌结果：资源路线多打一张，修补路线救断链，payoff 路线积 charge。
5. Turn 5：出现一次 armed payoff，把高意图峰值压掉。

### 6.3 最小数据字段

建议下一轮先以文档/测试合同形式定义字段，不急着做完整 UI：

```ts
type RedlineGrowthStats = {
  maxMpBonus: number;
  chainLinkCapBonus: number;
  firstGapBridgePerTurn: number;
  correctChainMpRefundPerTurn: number;
  payoffCharge: number;
  payoffArmedAt: number;
  armedTargetScope: "single" | "column" | "frontRow" | "activeIntent" | "all";
  backlashBuffer: number;
  rewardTempoBonus: number;
};
```

### 6.4 最小验收标准

- 同一张 payoff 在 unarmed 与 armed 两种状态下必须有明显差异：目标范围、意图削减或返费至少一项变化。
- `+1 max MP` 不能在所有路径中都最优；至少有一个脚本证明 `证据续链` 或 `终局印章` 更适合当前坏手牌。
- 3-5 回合内必须自然出现一次奖励，并且选完后下一回合能看见它改变路线。
- QA 记录每回合 `costSequence`、`chainBreakReason`、`repairMethod`、`payoffCharge`、`payoffArmed`、`intentBeforeEndTurn`、`resolvedDamage`。

### 6.5 一句话落点

Redline 不需要学竞品的“无限属性海”。它最该学的是：成长不是让数字更大，而是让玩家获得新的路线权限。下一轮把 `最大 MP`、`清算链长度`、`payoff armed 条件` 做成三条互斥但都能成功的路线，就能把当前 `0 -> 1 -> 2` 从排序题推进成 build 选择。
