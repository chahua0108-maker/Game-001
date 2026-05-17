# Game-001 Web 原型重构交接文档

## 当前目标

继续基于 `/Users/roc/Game-001` 开发 Web 原型，不切 Godot。

目标不是立刻做完整游戏，而是用 Web 垂直切片验证：

- 伪 3D 走廊压迫
- 卡牌出牌与连锁
- 快速清怪爽感
- 第 5-8 分钟 build 爆发
- 规则层未来可迁移到 Godot / Unreal / Unity

## 当前仓库状态

工作目录：

```text
/Users/roc/Game-001
```

当前仓库主要是研究和策划材料，不是 runtime 工程。

已有关键目录：

```text
outputs/research/vampire-crawlers/
design/
tools/
assets/
```

当前没有：

```text
package.json
project.godot
prototype runtime
```

所以后续应新建独立 Web 原型目录：

```text
prototype-web/
```

不要直接把 runtime 混进 `outputs/` 或 `tools/`。

## 必读材料

下一会话开始后先读这些文件：

```text
/Users/roc/Game-001/outputs/research/vampire-crawlers/22-vampire-crawlers-core-experience-brief.md
/Users/roc/Game-001/outputs/research/vampire-crawlers/29-fifty-designer-lens-panel-review.md
/Users/roc/Game-001/outputs/research/vampire-crawlers/09-data-schema.md
/Users/roc/.codex/worktrees/e1f9/Game-001/design/framework/web-fsm-eca-3c-framework.md
```

注意：

```text
/Users/roc/Game-001/outputs/research/vampire-crawlers/08-prototype-gdd.md
```

已经是废案，不要继续作为主方向。

## 当前工程决策

推荐方向：

```text
红线清算局：心跳处刑
```

原因：

- 红线拉怪、签章爆裂、心跳碎片 HUD 很容易用少量资产验证爽感。
- 比 `断轨夜车` 的票据系统更容易先做最小可玩。
- 比 `黑潮灯塔` 的光色/棱镜系统更不容易滑向解谜。

技术路线：

```text
Vite + TypeScript + Three.js 或 Canvas
```

第一版推荐 Three.js 做伪 3D 走廊，DOM/React 或轻量 UI 做卡牌和调试面板。

## 架构原则

严格按照旧技术设计的核心管线推进：

```text
Input
  -> Control Intent
  -> Character Driver
  -> FSM Transition
  -> Event
  -> Condition
  -> Action
  -> Command Buffer
  -> World State
  -> Snapshot
  -> Camera / Renderer / UI
```

核心边界：

- `sim/` 不允许 import DOM、React、Three.js。
- 所有玩家输入都先转成 Intent。
- 所有规则副作用都通过 Command Buffer。
- Renderer 只消费 Snapshot 和 Presentation Command。
- UI 不直接改 World State。
- 每个 Event / Rule / Command 都要能 trace。

## 建议目录

```text
prototype-web/
  package.json
  src/
    sim/
      world/
      command/
      snapshot/
      rng/
    fsm/
      gameFlow/
      encounter/
      character/
      card/
    eca/
      eventBus/
      conditions/
      actions/
      rules/
      trace/
    data/
      cards/
      enemies/
      encounters/
      tuning/
    presentation/
      renderer/
      camera/
      vfx/
      audio/
    ui/
      hud/
      cards/
      rewards/
      debug/
    input/
      keyboard/
      pointer/
      gamepad/
    tests/
      sim/
      replay/
```

## 第一阶段范围

不要做完整框架。只做最小闭环。

第一阶段只需要：

- 1 个玩家
- 3 种敌人
- 5-8 张卡
- 1 条走廊
- 1 个 Game Flow FSM
- 1 个 Character FSM
- 1 个 EventBus
- 1 个 ECA RuleSet
- 1 个 CommandBuffer
- 1 个 Debug Trace 面板
- 1 次 build 爆发清场

## 第一阶段验收标准

```text
0-30 秒：玩家进入走廊，第一波怪压上来，能出牌杀怪
2 分钟：玩家理解一条小 combo
5-8 分钟：出现一次 build 爆发清场
10 分钟：死亡/胜利后知道下一局追什么
```

技术验收：

```text
npm test 能跑 sim 单元测试
规则层不依赖 renderer
一次出牌能导出 trace
一次清场爆发能 replay
```

## 推荐实施顺序

### Step 1：把旧设计同步到当前仓库

新建或扩展：

```text
/Users/roc/Game-001/design/framework/web-runtime-refactor-plan.md
```

内容基于旧文档，但收敛到当前原型，不要保留过度抽象。

### Step 2：创建 Web 工程骨架

新建：

```text
/Users/roc/Game-001/prototype-web/
```

推荐工具：

```text
Vite
TypeScript
Vitest
Three.js
```

### Step 3：先写 sim 测试闭环

先实现：

```text
WorldState
Intent
Event
Command
CommandBuffer
RuleTrace
```

先写测试，不急着画画面。

### Step 4：实现最小战斗规则

最小规则：

```text
PlayCardIntent
CardPlayed event
DamageRequested event
DamageApplied command
EnemyKilled event
HeartbeatShardDropped command
ClearBurst command
```

### Step 5：接伪 3D 走廊

只做：

```text
玩家视角
怪物从前方压近
卡牌 UI 在底部
击杀反馈
爆发反馈
```

### Step 6：加 Debug Inspector

必须能看：

```text
当前 tick
最近 events
触发 rules
失败 conditions
commands
FSM 状态
```

## 给下一个 Agent 的主提示词

```text
你现在接手 /Users/roc/Game-001 的 Web 原型重构。

当前目标：按照旧技术设计，把 Game-001 从研究/策划仓库推进到可运行 Web 原型。不要切 Godot，不要做完整游戏，只做第一阶段 Web 垂直切片。

先读：
- /Users/roc/Game-001/outputs/research/vampire-crawlers/22-vampire-crawlers-core-experience-brief.md
- /Users/roc/Game-001/outputs/research/vampire-crawlers/29-fifty-designer-lens-panel-review.md
- /Users/roc/Game-001/outputs/research/vampire-crawlers/09-data-schema.md
- /Users/roc/.codex/worktrees/e1f9/Game-001/design/framework/web-fsm-eca-3c-framework.md

不要使用已废弃的 08-prototype-gdd.md 作为主方向。

工程决策：
- 继续 Web 开发。
- 新建 prototype-web/。
- 技术栈优先 Vite + TypeScript + Vitest + Three.js。
- 第一方向选“红线清算局：心跳处刑”。
- sim/ 必须保持纯规则层，不 import DOM/React/Three.js。
- 所有副作用通过 CommandBuffer。
- 每个 Event / Rule / Command 都要带 traceId。

第一阶段交付：
1. design/framework/web-runtime-refactor-plan.md
2. prototype-web/ 工程骨架
3. sim 最小闭环
4. Vitest 单元测试
5. 一个能运行的极简走廊/出牌/杀怪 demo
6. Debug trace 面板的最小版本

验收：
- npm test 通过
- npm run dev 能启动
- 玩家能出牌杀怪
- 敌人死亡能产生 trace
- 规则层不依赖表现层
```

## 分 Agent 工作流提示词

### Agent A：规则层

```text
你只负责 prototype-web/src/sim、src/eca、src/fsm。

不要改 UI。
不要改 renderer。
不要 import DOM/React/Three.js。

目标：
实现可测试的规则最小闭环。

必须包含：
- WorldState
- Intent
- Event
- Command
- CommandBuffer
- RuleTrace
- GameFlowFSM
- CharacterFSM
- CardPlayed -> Damage -> EnemyKilled 的链路

测试要求：
- happy path
- condition failed
- enemy death
- clear burst
- traceId 串联

交付：
- 修改文件列表
- 测试命令
- 未覆盖边界
```

### Agent B：数据与卡牌

```text
你只负责 prototype-web/src/data 和卡牌/敌人定义。

目标：
为“红线清算局：心跳处刑”做第一批可测试数据。

需要：
- 5-8 张卡
- 3 种敌人
- 1 个 encounter
- 1 个 clear burst 组合

卡牌动词优先：
拉、切、爆、回收、处刑、点燃。

不要写长合同文本。
不要写 adult-only 内容。
```

### Agent C：表现层

```text
你只负责 prototype-web/src/presentation 和最小 renderer。

不要改 sim 规则。
只消费 Snapshot 和 PresentationCommand。

目标：
做一个极简伪 3D 走廊：
- 怪物从前方压近
- 出牌后有击中反馈
- 敌人死亡有爆裂/碎片反馈
- 清场爆发有明显屏幕反馈

美术可以是占位图形。
不要做复杂模型。
```

### Agent D：UI 与 Debug

```text
你只负责 prototype-web/src/ui 和 debug 面板。

目标：
实现最小 HUD：
- 手牌
- 血量/资源
- 心跳碎片
- 当前 combo
- 最近 trace

Debug 面板必须显示：
- tick
- event list
- triggered rules
- failed conditions
- commands
- FSM state
```

## 风险提醒

不要犯这些错误：

- 一开始做完整 ECS。
- 一开始做编辑器。
- 一开始做复杂资产。
- 一开始做 Godot 迁移。
- 把红线清算局写成合同文本游戏。
- 把轻度擦边写成 adult-only。
- 让 UI 或 Renderer 直接改血量。
- 让卡牌效果写成散落的 if/else。
- 没测试就接画面。

## 当前最重要的一句话

先做一个小但完整的 Web 原型，让玩家在 30 秒内杀怪，在 5-8 分钟看到一次 build 爆发；其余所有架构都只为这个目标服务。
