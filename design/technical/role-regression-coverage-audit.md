# Game-001 Web Prototype 回归覆盖审计

日期：2026-05-17  
范围：`/Users/roc/Game-001/prototype-web/package.json`、`src/tests`、`src/sim`、`src/ui`。  
写入范围：本报告与 `prototype-web/src/tests`。

## 测试基线

初始基线：

```text
cd /Users/roc/Game-001/prototype-web
npm test
```

结果：通过。`src/tests/sim/runtime.test.ts` 1 个文件，17 个测试全部通过。

新增测试后：

```text
cd /Users/roc/Game-001/prototype-web
npm test -- src/tests/sim/runtime.test.ts src/tests/sim/core-loop-regression.test.ts
```

结果：通过。2 个文件，21 个测试全部通过。

全量测试：

```text
cd /Users/roc/Game-001/prototype-web
npm test
```

结果：失败。`src/tests/sim/runtime-audit.test.ts` 在初始基线之后出现在工作区，当前 2 个测试失败；我没有覆盖或删除这个并发新增文件。

## 已有覆盖

| 用户关键体验 | 现有覆盖 | 文件 |
|---|---:|---|
| 初始世界进入 `Deal`，15 个敌人占满 5x3 队列 | 已覆盖 | `src/tests/sim/runtime.test.ts` |
| 手动发牌进入玩家回合，能量回满，手牌出现 | 已覆盖 | `src/tests/sim/runtime.test.ts` |
| 第一轮 `advance-time` 自动发牌 | 已覆盖 | `src/tests/sim/runtime.test.ts` |
| 发牌前不能出牌 | 已覆盖 | `src/tests/sim/runtime.test.ts` |
| 普通时间推进不攻击、不回能、不推进回合 | 已覆盖 | `src/tests/sim/runtime.test.ts` |
| 死目标不能消耗能量或弃牌 | 已覆盖 | `src/tests/sim/runtime.test.ts` |
| 后排目标不能被 `front-enemy` 牌直接指定 | 已覆盖 | `src/tests/sim/runtime.test.ts` |
| 心跳碎片不足时 burst 不弃牌 | 已覆盖 | `src/tests/sim/runtime.test.ts` |
| 击杀只奖励一次，敌人进入 Dead | 已覆盖 | `src/tests/sim/runtime.test.ts` |
| 手动结束回合触发前排怪物攻击、补位、下一轮发牌 | 已覆盖 | `src/tests/sim/runtime.test.ts` |
| 无能量/无手牌仍可手动结束回合 | 已覆盖 | `src/tests/sim/runtime.test.ts` |
| 只有前排 5 个敌人攻击，后排不攻击 | 已覆盖 | `src/tests/sim/runtime.test.ts` |
| 玩家死亡时停止后续攻击/补位/发牌 | 已覆盖 | `src/tests/sim/runtime.test.ts` |
| 1-2 个空槽 compact/refill | 已覆盖 | `src/tests/sim/runtime.test.ts` |
| 非玩家回合不能结束回合 | 已覆盖 | `src/tests/sim/runtime.test.ts` |

## 新增覆盖

新增文件：`/Users/roc/Game-001/prototype-web/src/tests/sim/core-loop-regression.test.ts`

新增 4 个不依赖真实浏览器的 sim 回归测试：

1. `refills a fully cleared five-slot front row from the queue before spawning replacements`
   - 覆盖整排 5 槽前排清空后的补位。
   - 断言 `enemy-6` 到 `enemy-10` 压到 slots `0..4`，`enemy-16` 到 `enemy-20` 生成到后排 slots `10..14`。
   - 断言前排全空时结束回合不会凭空产生怪物攻击。

2. `auto-deals the next round from the fallback deck and clears stale discards`
   - 覆盖下一轮自动发牌不是只检查手牌数量。
   - 断言 draw pile 耗尽时使用起始牌组 fallback，旧 discard 被清空，能量回满，并记录第二次 `HandDealt`。

3. `rejects targeting a later front-row enemy while an earlier front enemy is alive`
   - 补上“同在前排但不是最前目标”的拒绝规则。
   - 这和既有“后排 enemy-6 不能直接指定”不同，能防止只按 row 判断而忽略 slot 顺序。

4. `auto-targets the current front alive enemy after the first slot is cleared`
   - 覆盖未传 `targetId` 时，系统会选择当前最前 alive 敌人。
   - 防止 slot 0 敌人死亡后仍错误打到死敌或后排。

## 仍缺的覆盖

1. `src/ui/hud.ts` 缺少 node 环境下的单元测试。
   - 当前 Vitest 配置是 `environment: 'node'`，项目未安装 `jsdom` / `happy-dom`。
   - HUD 的按钮 intent、pointerdown/click 去重、禁用态、卡牌 aria 文案仍未被自动化覆盖。

2. Renderer 和真实浏览器交互未覆盖。
   - 本轮按要求优先补了不依赖真实浏览器的 sim 测试。
   - 走廊敌人显示、HUD 文字溢出、按钮实际可点性仍需要浏览器层 smoke/visual 回归。

3. “击杀后是否立即 compact”存在规则冲突，不能只靠测试文件决定。
   - 既有 `runtime.test.ts` 明确期望击杀后敌人 slot 暂留，到结束回合再 compact/refill。
   - 并发出现的 `runtime-audit.test.ts` 期望击杀瞬间 compact。
   - 这会改变战斗节奏和目标选择规则，不属于“小且确定”的生产 bug。

4. “同 tick 中 end-turn 后的 stale play-card 是否必须拒绝”仍未裁决。
   - 并发出现的 `runtime-audit.test.ts` 期望拒绝。
   - 当前 runtime 会在 `end-turn` 完成下一轮自动发牌后继续处理同批后续 intent，因此该测试失败。
   - 如果产品规则确认“结束回合后同批输入一律过期”，这是一个可小范围修复的 runtime 输入门禁问题。

## 当前结论

核心循环的稳定回归防线已经比基线更完整：整排 5 槽补位、下一轮自动发牌的 pile/discard 状态、前排内目标顺序、以及缺口后的自动目标选择现在都有测试。

当前全量 `npm test` 不绿的原因不是新增测试失败，而是初始基线之后出现的 `runtime-audit.test.ts` 与当前已存在规则发生冲突。需要先裁决即时 compact 和同 tick stale intent 的设计，再决定是否改生产代码。
