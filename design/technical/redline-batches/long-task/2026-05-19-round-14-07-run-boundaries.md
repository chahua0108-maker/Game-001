# 第14轮-07 单局/单次冒险边界报告

日期：2026-05-19  
角色：单局 / 单次冒险边界专家  
工作目录：`/Users/roc/Game-001`

## 结论

当前 Redline P0 应按四层体验边界表达和验收：

| 层级 | 生命周期 | 当前代码锚点 | 允许回答的问题 | 本轮裁决 |
| --- | --- | --- | --- | --- |
| 局外成长 | 跨 run / 跨冒险保留 | P0 不进 `WorldState` | 下次开局永久多了什么 | 只能作为未来边界，不能隐式读取 |
| 单次冒险 | 本 run 开始到胜败结算 | `run`、`player.deck`、`player.xp/level`、`reward` | 这次 build 如何变化 | 奖励加牌只属于当前 run，`restart-run` 回基线 |
| 单场战斗 | 当前遭遇内 | `tick/round/fsm/enemies/player.hp/debug` | 这场敌人和战况如何推进 | 敌人、HP、回合推进不写成局外成长 |
| 单轮循环发牌 | 一次发牌到结束回合 | `hand/drawPile/discardPile/energy/tempAuthorizationMP/chain/enemyIntents` | 这一手如何支付、修补、终结 | 临时授权结束回合清空，不改变 run 或 meta |

已有文档 `2026-05-18-system-model-boundary-05.md` 使用了五层模型，把静态 `CardDefinition` 单独列出；本轮面向玩家体验和 runtime 生命周期时，将静态卡牌定义视为 catalog 前置层，不并入上述四层体验。

## 发现的混淆点

1. `PlayerState` 是实现容器，不是生命周期容器。  
   当前 `hp/maxHp`、`energy/maxEnergy`、`tempAuthorizationMP`、`xp/level`、`deck/hand/piles` 都挂在 `player` 下。它们分别属于战斗、发牌循环、run，而不是同一种“玩家成长属性”。

2. `maxEnergy` 容易被误读成局外成长。  
   P0 里 `maxEnergy = 3` 是每轮发牌刷新上限；完成 `0 -> 1 -> 2` 获得的是 `tempAuthorizationMP`，不是永久或 run 内 `Max MP +1`。

3. `reward` 同时靠近战斗结算和 run 构筑。  
   奖励选择可以立刻影响下一手牌，但它的归属仍是当前 run 的构筑变化，不能被解释为账号解锁。

4. `round` 容易被混成“冒险进度”。  
   当前 `round` 是单场战斗 / 发牌循环计数；`run.currentNode` 才是本次冒险节点。

5. 测试名称过窄。  
   原 `run/meta layer boundary` 只强调 run/meta，未把战斗和发牌循环一起钉住，容易漏掉临时授权外溢。

## 本轮实际修正

- 在 `prototype-web/src/sim/types.ts` 为 `PlayerState`、`RunState`、`WorldState` 增加生命周期注释，明确哪些字段只是当前发牌循环、哪些是当前战斗、哪些是当前 run，以及 P0 没有局外成长状态。
- 将 `prototype-web/src/tests/sim/run-layer-boundary.test.ts` 的测试组改为 `four-layer run boundary`。
- 新增边界测试：完成 `0 -> 1 -> 2` 后只获得本轮 `tempAuthorizationMP`；结束回合进入下一轮后授权清空，同时 `run.currentNode`、`run.rewardHistory`、`maxEnergy` 不变。

## 改动文件

- `prototype-web/src/sim/types.ts`
- `prototype-web/src/tests/sim/run-layer-boundary.test.ts`
- `design/technical/redline-batches/long-task/2026-05-19-round-14-07-run-boundaries.md`

## 验证

```bash
npm test -- --run src/tests/sim/run-layer-boundary.test.ts
```

结果：5 个测试通过。

## 后续建议

1. 后续如果引入局外成长，不要把字段直接塞进 `WorldState.player`；应先定义 `AccountProfile` 或 `MetaProgression`，再显式派生开局状态。
2. 如果要做 P1 的本次冒险 `Max MP +1`，应命名为 run modifier，并写清生效点是下一手牌还是下一场战斗。
3. HUD 和测试里继续禁用裸词“成长 / 升级 MP”；必须标注 `局外 / 本次清算 / 当前遭遇 / 本回合`。
