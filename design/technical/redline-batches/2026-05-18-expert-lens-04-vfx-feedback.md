# 2026-05-18 Expert Lens 04 - VFX Feedback

Base: local commit `b24b262`

Scope read:
- `prototype-web/src/presentation/renderer/corridorRenderer.ts`
- `prototype-web/src/sim/types.ts`
- `prototype-web/src/sim/runtime.ts`
- `prototype-web/src/ui/hud.ts`
- `design/technical/redline-batches/2026-05-18-batch-h2-combat-vfx.md`

本文件只做战斗表现、VFX、动效节奏、音频反馈接口审查，不提出本轮代码修改。

## 10. Combat VFX Director

### 当前判断

H2 方向是对的：当前 VFX 已经从旧的 `AutoAttack` / `EnemyAdvanced` / `EnemyPressure` / `EnemyAttacked` 心跳式活跃感，转到 `CardPlayed`、`DamageApplied`、`EnemyKilled`、`ClearBurstRequested` 这些玩家解析语义。现在的视觉层级大致成立：出牌给链路脉冲，命中给红线 slash，击杀给 payoff 发光和死亡爆开，清场给全局光、环形冲击波、背景压红和镜头压近。

但当前 payoff 的表现语言仍然偏“同一套发光和 slash 的强弱变化”，缺少能让玩家一眼区分“普通命中 / 接链命中 / 击杀 / 终结清场”的形态差异。下一轮不需要大改系统，最小目标应是把现有事件分成 4 个明确视觉等级。

### 10 个镜头观察

1. `CardPlayed` 会先在目标、前排、全体或自牌上触发链路反馈；这是正确的前摇/确认层，避免所有反馈都挤在伤害瞬间。
2. `DamageApplied` 只在能通过 `cardId` 或同 trace 的 `CardPlayed` 找到卡牌上下文时生成 slash；这让无卡牌来源伤害不会误读成玩家攻击。
3. `EnemyKilled` 会额外设置 `payoffStartedAt` 并生成更亮、更久的 slash；击杀和普通命中已有层级差，但主要差别是颜色、透明度和持续时间。
4. `ClearBurstRequested` 触发 `burstLight`、`burstWave`、背景 lerp、全敌 sweep；这是当前最强 payoff 资产，应继续作为终结牌/清场镜头核心。
5. `spawnSlash` 使用 `THREE.LineBasicMaterial` 单线段，普通命中和 payoff 都是一条斜线；在高 DPI 或移动屏幕上，线宽可能不足以承担主要 hit read。
6. chain 倍率目前只影响 slash reach 和 scale，最多只放大到约 2 档；倍率越高的 payoff 没有额外形态，如二段 slash、残影、屏幕裂纹或目标轮廓切开。
7. 敌人受击的 `hitPulse` 是 emissive + scale，击杀的 `payoffPulse` 是更强 emissive + 抬升；镜头上能读到“亮了/胀了”，但切割方向、受力方向和残留痕迹还不清晰。
8. 敌人死亡动画是 0.5s fade + scale + 上浮，具备消失节奏，但没有“命中定格后碎裂”的独立峰值；击杀 payoff 的最高点容易和普通 hit pulse 混在一起。
9. 敌人 slot interpolation 保留为位置可读性，不再当主 VFX beat；这符合 H2 结论，后排压上应该是状态变化，不应该抢玩家出牌镜头。
10. `ChainAdvanced`、`PayoffTriggered`、`EnemyIntentResolved` 在当前 `types.ts` / `runtime.ts` 已经存在并会被 runtime 发出；H2 把它们描述为未来 hook，实际更准确的问题是 payload 对目标级 VFX 还不够直接，renderer 只能做部分全局或目标缺省反馈。

### 最大风险

视觉层级现在靠“亮度、时间、同一条 slash 的颜色”撑住，短期能工作，但很容易在多目标、全场牌、连续击杀时糊成一团。特别是清场时，如果全局冲击波、每个敌人的 kill slash、死亡淡出、HUD 战斗信息同时发生，玩家可能只知道“屏幕闪了”，不知道哪张牌、哪个链路、哪个击杀带来了 payoff。

### 下一轮最小改动

- 把现有事件映射成 4 档视觉规格：`CardPlayed` 预脉冲、`DamageApplied` 命中 slash、`EnemyKilled` 处决 slash、`ClearBurstRequested` 全局终结。
- 不新增复杂粒子系统，先增强 `spawnSlash` 的表现参数：命中一条线，击杀双线或更粗 glow，清场横向 sweep 或延迟扫过所有槽位。
- 给 `PayoffTriggered` 和 `ChainAdvanced` 的视觉表现补目标策略：没有 `targetId` 时做全局链路节拍，有 `targetId` 时才做目标脉冲，避免未来事件一接入就乱闪。

### 验收方式

- 单体牌命中但不击杀：只应看到目标链路脉冲 + 普通红线 slash + 短 hit pulse。
- 单体牌击杀：同一目标应有普通命中之上的处决层，0.5s 内能明显比普通 hit 更强。
- 前排群攻：前排目标同时被读到，但不能比全场清场更强。
- 全场清场：必须同时读到全局冲击波、镜头压近、背景脉冲和清场 sweep，且不依赖旧 `EnemyAdvanced` / `EnemyAttacked` 事件。
- 连续 0->1->2 链路：倍率越高的视觉强度应该逐级上升，至少在 slash 长度、数量、余辉或目标轮廓中有一项可见差别。

## 11. 动效节奏 / Hit Stop 设计师

### 当前判断

当前系统的输入到反馈链路很快：HUD 在 `pointerdown` 就派发 intent，runtime 在同一个 tick 内完成出牌、链路、伤害、击杀、奖励和补位事件，renderer 下一帧扫描 debug events 并播放表现。这个延迟模型适合 Web 原型。

但目前没有真正的 hit stop。所有反馈都是基于 renderer elapsed time 的 pulse、scale、emissive、fade 和 camera z compression。换句话说，当前是“快速反馈 + 视觉脉冲”，不是“命中停顿 + 再释放”。如果目标是战斗爽感，下一轮需要在表现层补一个非常短、可控、不会影响 sim 的 hit-stop/camera-stop 语法。

### 10 个镜头观察

1. HUD 通过 `pointerdown` 直接发送出牌 intent，并用 500ms 抑制后续 click；输入响应路径足够短，不像传统 click-only 那样慢半拍。
2. `play-card` 在 runtime 内会先验证、消耗 MP、丢弃手牌、进入 Cast，再推进 chain 并派发 `CardPlayed`；玩家动作在同一 tick 内完成语义闭环。
3. `DamageApplied` 和 `EnemyKilled` 由后续命令进入事件队列；renderer 用 trace 反查 `CardPlayed` 是稳健做法，即使事件顺序调整也能保住卡牌上下文。
4. mesh 的 `hitPulse` 是 0.28s 线性衰减，命中第一帧强、随后快速退；这适合普通命中。
5. mesh 的 `chainPulse` 是 0.36s sine pulse，事件刚触发时数值接近 0，中段才最大；这会让链路脉冲更像“鼓起”，但第一帧确认感不如 hit pulse 直接。
6. `payoffPulse` 是 0.52s 线性衰减，持续时间比 hit 更长；这给击杀/终结留下了空间，但没有停顿点，峰值会立即滑走。
7. clear burst 的 ring wave 是 0.72s，背景和灯光也跟随 pulse；这是当前唯一具备“镜头级事件”节奏的反馈。
8. camera 只有常态横向微摆、chain 的 z 压近、burst 的 z 压近；普通命中和击杀没有独立 camera kick。
9. 敌人攻击玩家时，renderer 明确忽略 `EnemyAttacked`，HUD 用 `player-hit` 闪 620ms；玩家受击反馈和走廊镜头反馈被分开，当前会显得 UI 在痛、世界不痛。
10. end turn 中多个敌人攻击会在同一 tick 连续结算；HUD 最终是一次持续闪烁，不会形成“敌人 1、敌人 2、敌人 3”分拍打击。

### 最大风险

系统已经足够快，但没有“重量”。连续出牌时，玩家会感到按钮有效、数字在变、物体在亮，却不一定感到刀切进去、怪被打断、清场炸开。没有 hit stop 的情况下，越快结算越容易把 payoff 冲淡。

### 下一轮最小改动

- 只在 presentation 层加一个短暂停顿规格，不改 sim tick：普通命中 40-60ms，击杀 80-110ms，清场 120-160ms。
- 停顿对象优先控制 camera 和 mesh 动画，不要冻结 HUD 输入；玩家连续出牌的响应性应保留。
- 给 `EnemyKilled` 加一个“停一拍再死亡淡出”的两段节奏：命中定格 -> 爆亮/切线 -> 0.5s fade。
- 对敌人攻击玩家补一档世界反馈：即使继续忽略旧 VFX 触发，也应让 `EnemyIntentResolved` 或 `EnemyAttacked` 驱动一次轻微 camera recoil / HUD pulse。

### 验收方式

- 普通命中时，输入后第一帧能看到命中确认，不需要等到 0.18s 的 chain pulse 峰值。
- 击杀时，敌人消失前必须有一个清楚的定格峰值，而不是直接开始透明上浮。
- 清场时，玩家能感到比击杀更长一档的停顿，但不会像卡死或掉帧。
- 一回合连续打 3 张牌时，节奏应读成“确认、接链、payoff”，而不是三次同样的闪烁。
- 多敌人攻击玩家时，至少 HUD/相机/音频三者之一要能表达攻击数量或总伤害强度。

## 12. 音频反馈设计师

### 当前判断

当前没有实际音频实现，也没有 `AudioContext`、SFX manifest 或音频播放接口。好消息是，sim 事件已经足够语义化，能支撑一套轻量音频事件映射：`CardPlayed` 做出牌确认，`ChainAdvanced` 做音高阶梯，`DamageApplied` 做命中，`EnemyKilled` 做处决，`PayoffTriggered` 做终结预告，`ClearBurstRequested` 做全局爆发，`EnemyAttacked` / `EnemyIntentResolved` 做玩家受击。

下一轮音频不应该先追求素材完整度，而应该先建立“事件到 cue 的占位接口”和去重策略。否则后续很容易把声音直接绑在 HUD render 或 renderer render 上，导致重复播放、漏播、重开局残留或多目标噪声。

### 10 个镜头观察

1. `GameEvent` 大多带有 `traceId` 和 `tick`，再加 `targetId` / `enemyId` / `cardId`，足够生成稳定的 SFX 去重 key。
2. `CardDefinition` 已有 `verb`、`comboNode`、`damage`、`targets`、`cost`，可以在不扩展卡牌数据的情况下选择音色家族。
3. `ChainAdvanced`、`ChainBroken`、`ChainRepaired` 已经是很好的音频阶梯接口：接链升调，断链下坠，wild 修复给 glitch/repair 音。
4. `PayoffTriggered` 已有 `chainLength`、`multiplier`、`enhanced`，适合决定 riser、低频冲击和终结 stinger 强度。
5. `DamageApplied` 有 `amount` 和 `remainingHp`，适合决定命中音强度，但不应每个小伤害都播放完整重击。
6. `EnemyKilled` 只有 `enemyId` 和可选 `cardId`，音频可从 snapshot 查 enemy type/name，但最好未来让 cue 显式拿到 enemy definition 或 weight。
7. `ClearBurstRequested` 只有 `cardId`，适合作为唯一的全局清场 stinger；多敌人死亡不应该各自再播放同等级爆炸。
8. `EnemyAttacked` 和 `EnemyIntentResolved` 都能表达玩家受击链路；音频需要明确只选一个作为实际扣血音源，另一个用于 UI/意图解除提示，否则会双响。
9. HUD combat feed 只显示最新 2 条事件；音频不能依赖 feed 文案，否则多目标命中、连杀和奖励事件会被吞掉。
10. renderer 的 `seenPresentationEvents` 模式证明 presentation 侧必须去重；音频也需要自己的 `seenAudioEvents` 或统一 feedback dispatcher，不能靠 render 次数隐式保证。

### 最大风险

最大风险不是“没有音频素材”，而是未来音频被临时塞进 HUD 或 renderer 的 render loop。这样会让同一个 debug event 在重渲染时重复播放，也会让多目标牌在同一 tick 内制造过多声音。音频需要从第一天就按语义事件、优先级、声部预算和去重 key 来设计。

### 下一轮最小改动

- 先做无素材的 cue manifest：`card.play`、`chain.up`、`chain.break`、`hit.light`、`hit.heavy`、`kill.payoff`、`clear.burst`、`player.hit`、`reward.ready`。
- 新增一个 presentation-only 的 event-to-cue 映射层，输入 `GameEvent + GameSnapshot`，输出 cue id、priority、gain、pitch、pan、dedupeKey。
- 多目标伤害要分组：全场牌使用一个主 swish + 少量命中 tick，不要每个敌人播放完整 slash。
- 先用 oscillator/noise 或 console cue 占位验证事件接口，素材可以后置。

### 验收方式

- 出一张非伤害 self card：应只有出牌/链路声音，没有 hit 或 kill。
- 单体命中不击杀：应有出牌确认、链路音、一次命中音。
- 单体击杀：应有命中音上叠处决 stinger，但不能再被 XP/补位声音盖住。
- 全场清场：只能有一个主清场 stinger，多敌人死亡使用低优先级短 tick 或被合并。
- 结束回合被 3 个敌人打：玩家受击声音应体现总伤害或数量，但不能因为 `EnemyAttacked` + `EnemyIntentResolved` 双事件而重复 6 次。

## 优先级建议

1. 先定 4 档反馈层级：出牌确认、普通命中、击杀 payoff、清场终结。
2. 补 presentation-only hit stop，不改 sim：普通命中短、击杀中、清场长。
3. 扩展 `ChainAdvanced` / `PayoffTriggered` / `EnemyIntentResolved` 的使用策略，承认它们已经存在，先解决目标归属和强度归属。
4. 建一个无素材 SFX cue manifest 和 event-to-cue 去重层，避免未来音频绑死在 render loop。
5. 验收时用同一套 5 个镜头：self card、单体命中、单体击杀、前排群攻、全场清场。
