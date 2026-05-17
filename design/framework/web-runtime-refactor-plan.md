# Game-001 Web Runtime Refactor Plan

状态：v0.1  
日期：2026-05-17  
范围：`/Users/roc/Game-001` 当前主工作树的 Web 垂直切片落地计划。

## 结论

当前仓库仍以研究、策划和美术方向材料为主，不应把运行时混进 `outputs/`、`tools/` 或研究目录。下一步应新增独立目录：

```text
prototype-web/
```

第一版只验证 `红线清算局：心跳处刑` 的最小战斗闭环：

```text
怪潮压近 -> 打出卡牌 -> 触发规则 -> 造成伤害 -> 敌人死亡 -> 掉落心跳碎片 -> 累积后清场爆发
```

不要在第一版做完整 ECS、编辑器、复杂资产、Godot 迁移或长文本合同玩法。

## 设计来源

本计划收敛自这些材料：

- `outputs/research/vampire-crawlers/22-vampire-crawlers-core-experience-brief.md`
- `outputs/research/vampire-crawlers/29-fifty-designer-lens-panel-review.md`
- `outputs/research/vampire-crawlers/09-data-schema.md`
- 旧工作树的 `design/framework/web-fsm-eca-3c-framework.md`
- `design/technical/web-prototype-handoff.md`

已废弃的 `outputs/research/vampire-crawlers/08-prototype-gdd.md` 不作为主方向。

## 第一阶段目标

第一阶段不是完整游戏，而是一个可运行、可测试、可复盘的 Web 垂直切片。

玩家需要在浏览器中看到：

- 狭窄伪 3D 走廊。
- 怪物从前方压近。
- 底部卡牌能点击或用数字键打出。
- 卡牌触发伤害、击杀、掉落。
- 心跳碎片足够后触发一次明显清场爆发。
- Debug 面板能解释这次操作为什么成功或失败。

## 非目标

- 不做完整 roguelite 局外成长。
- 不做复杂卡牌编辑器。
- 不接真实 3D 角色资产。
- 不做 adult-only 内容。
- 不把 UI 或 renderer 变成规则源头。
- 不把卡牌效果写成散落在 UI click handler 里的逻辑。

## 运行时边界

第一版管线固定为：

```text
Input
  -> Intent
  -> FSM
  -> Event
  -> Condition
  -> Action
  -> Command Buffer
  -> World State
  -> Snapshot
  -> Three.js Renderer / DOM UI
```

边界要求：

- `prototype-web/src/sim/` 不 import DOM、Three.js、CSS 或浏览器对象。
- `prototype-web/src/eca/` 只做 Event / Condition / Action，不直接画画面。
- `prototype-web/src/fsm/` 只管阶段和互斥状态，不承载卡牌效果。
- `prototype-web/src/presentation/` 只消费 Snapshot 和表现命令。
- `prototype-web/src/ui/` 只发 Intent 和展示状态，不直接改 World State。
- 所有玩家操作必须带 `traceId`，串起 Intent、Event、Rule、Condition、Command。

## 第一版模块

```text
prototype-web/
  src/
    sim/
      types.ts
      world.ts
      runtime.ts
      snapshot.ts
    fsm/
      stateMachine.ts
    eca/
      ruleSet.ts
      redlineRules.ts
    data/
      cards.ts
      enemies.ts
    input/
      keyboard.ts
    presentation/
      renderer/
        corridorRenderer.ts
    ui/
      hud.ts
    tests/
      sim/
        runtime.test.ts
```

## 最小数据

卡牌先做 6 张：

| 卡牌 | 作用 |
|---|---|
| Debt Hook | 0 费，拉近并轻伤前排敌人 |
| Redline Cut | 1 费，单体中伤 |
| Heartbeat Spark | 1 费，伤害并推进碎片收益 |
| Verdict Mark | 1 费，标记式轻伤并推进 combo |
| Blood Reclaim | 0 费，击杀后回收碎片 |
| Severance Burst | 3 费，消耗心跳碎片清场 |

敌人先做 3 类：

| 敌人 | 作用 |
|---|---|
| Debt Wisp | 低血量、快速压近 |
| Redline Brute | 中血量、慢速压近 |
| Pulse Collector | 中血量、奖励更多碎片 |

## Debug 验收

Debug 面板必须至少显示：

- 当前 tick。
- 当前 Game Flow FSM。
- 玩家 Character FSM。
- 最近 events。
- 最近触发 rules。
- 最近失败 conditions。
- 最近 commands。
- 最近 traceId。

条件失败必须可见，例如：

- 费用不足。
- 没有有效目标。
- 心跳碎片不足，不能清场。
- 目标已死亡。

## 技术验收

第一阶段完成后应满足：

```text
npm test
npm run build
npm run dev
```

并在浏览器中确认：

- 首屏直接进入可玩画面。
- 玩家能用鼠标或数字键出牌。
- 敌人死亡能产生 trace。
- 清场爆发有明显屏幕反馈。
- 改 renderer 不需要改 `sim/`。

## 后续扩展顺序

1. 增加抽牌、弃牌和临时手牌循环。
2. 增加 2-3 条 build 路线，而不是只堆伤害。
3. 加入奖励选择和下一波。
4. 增加轻量局外成长入口。
5. 再评估是否迁移到 Godot / Unreal / Unity。

## 最高优先级

30 秒内杀怪，5-8 分钟内看到一次 build 爆发。所有架构只服务这个目标。
