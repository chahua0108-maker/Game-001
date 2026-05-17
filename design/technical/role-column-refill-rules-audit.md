# Role Column Refill Rules Audit

审查时间：2026-05-17

审查范围：
- `/Users/roc/Game-001/prototype-web/src/sim/runtime.ts`
- `/Users/roc/Game-001/prototype-web/src/sim/world.ts`
- `/Users/roc/Game-001/prototype-web/src/tests/sim`

结论：当前代码仍然存在线性补位，而且目标校验仍然把 `front-enemy` 牌限制为全局最小 slot 的单个敌人，不符合“卡牌面对第一排怪物”和“按列补位”的规则。

## 当前代码判断

### 1. `world.ts` 的 slot 坐标是 5 列 x 3 行，本身不是问题

`world.ts` 定义：

```ts
export const ENEMY_COLUMNS = 5;
export const ENEMY_ROWS = 3;
export const MAX_ENEMY_FORMATION_SLOTS = ENEMY_COLUMNS * ENEMY_ROWS;
```

坐标换算也是 row-major：

```ts
const row = Math.floor(slot / ENEMY_COLUMNS);
const column = slot % ENEMY_COLUMNS;
```

因此初始 slot 可以解释为：

| 行 | slots | 初始敌人 |
| --- | --- | --- |
| 第 1 排 | `0,1,2,3,4` | `enemy-1..enemy-5` |
| 第 2 排 | `5,6,7,8,9` | `enemy-6..enemy-10` |
| 第 3 排 | `10,11,12,13,14` | `enemy-11..enemy-15` |

列补位规则应以 `slot % 5` 为列，不应把全部活敌按 slot 排序后整体压缩。

### 2. `runtime.ts` 的补位仍是线性数组压缩

当前 `CompactEnemySlots`：

```ts
const active = activeAliveEnemies(world);
active.forEach((enemy, slot) => setEnemySlot(enemy, slot));
```

`activeAliveEnemies` 先把全部活敌按 `slot` 排序，然后 `forEach((enemy, slot) => ...)` 从 `0` 开始重新编号。这会产生线性补位：

- `enemy-2` 死在 slot `1` 后，`enemy-3` 会被压到 slot `1`。
- 正确规则应该是同列后排向前顶：`enemy-7` 从 slot `6` 到 slot `1`，`enemy-12` 从 slot `11` 到 slot `6`，新怪 `enemy-16` 到 slot `11`。

当前 `FillEnemySlots` 也按全局活敌数量从尾部补：

```ts
for (let slot = active.length; slot < world.maxEnemySlots; slot += 1) {
  const enemy = createEnemy(world.nextEnemySerial, slot);
}
```

这同样是线性尾部补怪，而不是“哪个列缺口，就补哪个列的最后一排”。

### 3. `front-enemy` 目标校验仍只允许全局最前一个敌人

当前 `frontAliveEnemyId`：

```ts
return Object.values(world.enemies)
  .filter((enemy) => enemy.alive)
  .sort((a, b) => a.slot - b.slot)[0]?.id;
```

当前 `validatePlayCard`：

```ts
if (target.id !== frontAliveEnemyId(world)) {
  conditionId: 'front-target'
}
```

这意味着初始第一排的 `enemy-2..enemy-5` 虽然在 slots `1..4`，但仍不能被 `front-enemy` 牌指定。用户规则是“技能/卡牌面对的是第一排怪物”，因此应允许显式指定任意 `alive && slot < ENEMY_COLUMNS` 的敌人。无显式目标时可以保留一个 deterministic default，但测试需要把“显式第一排目标合法”和“后排目标非法”分开验证。

## 现有测试状态

运行命令：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run
```

结果：失败，`2 failed | 23 passed`。

失败项：

1. `src/tests/sim/core-loop-regression.test.ts`
   - `allows targeting any living first-row enemy without shifting other columns`
   - 当前失败在 `enemy-2` 仍然存活，因为 `front-enemy` 校验拒绝了目标 `enemy-2`。

2. `src/tests/sim/runtime-audit.test.ts`
   - `refills the killed first-row slot from the same column instead of shifting the row sideways`
   - 当前同样失败在 `enemy-2` 仍然存活，说明测试还没走到列补位断言，先被目标规则挡住。

现有测试中还有旧线性规则断言，需要修：

- `runtime.test.ts` 的 `ends turn, resolves one attack per living enemy, refills slots, and auto-deals next round`
  - 当前断言 `enemy-2.slot === 0`、`enemy-6.slot === 4`、`enemy-16.slot === 14`。
  - 这些是线性补位期望，应改成列补位期望。

- `runtime.test.ts` 的 `compacts gaps from front and second row before spawning new back-row enemies`
  - 当前断言 `enemy-2.slot === 0`、`enemy-6.slot === 4`、`enemy-8.slot === 5`、`enemy-16.slot === 13`、`enemy-17.slot === 14`。
  - 这些会鼓励横向平移，也应改成列补位期望。

- `runtime-audit.test.ts` 的 `keeps the front formation compact immediately after a front enemy is killed`
  - 当前断言 `enemy-2.slot === 0`。
  - 若采用列补位，杀死 slot `0` 的 `enemy-1` 后应由同列 `enemy-6` 顶到 slot `0`。

`core-loop-regression.test.ts` 的“清空完整前排”用例仍可保留，但它不能单独证明列补位正确，因为整排死亡时线性补位和列补位的结果刚好一致：`enemy-6..enemy-10` 都会进入 slots `0..4`。

## 应补或应改的测试

### A. 显式目标：任意第一排敌人可被 `front-enemy` 牌指定

场景：初始阵型，发牌后把 `enemy-2.hp = 4`，使用 `debt_hook` 指定 `enemy-2`。

修复后应满足：

```ts
expect(world.enemies['enemy-2'].alive).toBe(false);
expect(world.debug.failedConditions.some((condition) => condition.conditionId === 'front-target')).toBe(false);
expect(world.debug.events.some((event) => event.type === 'CardPlayed' && event.targetId === 'enemy-2')).toBe(true);
```

并验证同列补位：

```ts
expect(aliveSlots(world)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
expect(world.enemies['enemy-3'].slot).toBe(2);
expect(world.enemies['enemy-6'].slot).toBe(5);
expect(world.enemies['enemy-7'].slot).toBe(1);
expect(world.enemies['enemy-12'].slot).toBe(6);
expect(world.enemies['enemy-16'].slot).toBe(11);
expect(world.nextEnemySerial).toBe(17);
```

关键点：`enemy-3` 不得横向移动到 slot `1`，slot `1` 必须由同列后排 `enemy-7` 顶上来。

### B. 杀死第一列前排时，只推进第一列

场景：击杀 `enemy-1`，触发死亡后的 refill。

修复后应满足：

```ts
expect(world.enemies['enemy-1'].alive).toBe(false);
expect(aliveSlots(world)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
expect(world.enemies['enemy-6'].slot).toBe(0);
expect(world.enemies['enemy-11'].slot).toBe(5);
expect(world.enemies['enemy-16'].slot).toBe(10);
expect(world.enemies['enemy-2'].slot).toBe(1);
expect(world.enemies['enemy-7'].slot).toBe(6);
expect(world.enemies['enemy-12'].slot).toBe(11);
expect(world.nextEnemySerial).toBe(17);
```

旧断言 `enemy-2.slot === 0` 应删除。

### C. 只清第二排同列时，第三排补第二排，新怪补第三排

场景：直接设置 `enemy-7.alive = false` 后触发结束回合 refill，或通过测试 helper 触发对应列 refill。

修复后应满足：

```ts
expect(world.enemies['enemy-2'].slot).toBe(1);
expect(world.enemies['enemy-7'].alive).toBe(false);
expect(world.enemies['enemy-12'].slot).toBe(6);
expect(world.enemies['enemy-16'].slot).toBe(11);
expect(world.enemies['enemy-3'].slot).toBe(2);
expect(world.enemies['enemy-8'].slot).toBe(7);
expect(world.nextEnemySerial).toBe(17);
```

关键点：第二排缺口也必须按列处理，不能把后续 slot 全体向前压缩。

### D. 同时有两个不同列缺口时，各列独立补位

场景：`enemy-1.alive = false` 且 `enemy-7.alive = false`，然后结束回合。

修复后应满足：

```ts
expect(aliveSlots(world)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);

// column 0: slots 0,5,10
expect(world.enemies['enemy-6'].slot).toBe(0);
expect(world.enemies['enemy-11'].slot).toBe(5);
expect(world.enemies['enemy-16'].slot).toBe(10);

// column 1: slots 1,6,11
expect(world.enemies['enemy-2'].slot).toBe(1);
expect(world.enemies['enemy-12'].slot).toBe(6);
expect(world.enemies['enemy-17'].slot).toBe(11);

// unaffected neighboring columns
expect(world.enemies['enemy-3'].slot).toBe(2);
expect(world.enemies['enemy-8'].slot).toBe(7);
expect(world.enemies['enemy-13'].slot).toBe(12);
expect(world.nextEnemySerial).toBe(18);
```

这条能直接替换当前 `compacts gaps from front and second row before spawning new back-row enemies` 的线性断言。

### E. 后排目标仍不可直接指定，但补到第一排后可以指定

建议拆成两段：

1. 初始状态直接指定 `enemy-7` 应失败，因为 `enemy-7.slot === 6`。

```ts
expect(world.enemies['enemy-7'].slot).toBe(6);
expect(world.debug.failedConditions.some((condition) => condition.conditionId === 'front-target')).toBe(true);
```

2. 杀死 `enemy-2` 后，`enemy-7.slot === 1`，再指定 `enemy-7` 应成功。

```ts
expect(world.enemies['enemy-7'].slot).toBe(1);
expect(world.debug.failedConditions.some((condition) => condition.conditionId === 'front-target')).toBe(false);
```

这能验证“卡牌面对第一排怪物”，而不是面对“出生时的前排怪物”或“全局最小 slot 怪物”。

## 最高风险点

最高风险是先只修补位、不修目标校验。当前 `front-enemy` 仍要求 `target.id === frontAliveEnemyId(world)`，会导致任意第一排非最小 slot 的显式目标都被拒绝；列补位测试会在击杀前就失败，玩家也无法操作第一排 5 个怪，只能打全局最小 slot 的一个怪。

第二风险是保留旧测试断言。`runtime.test.ts` 仍有多处 `enemy-2` 横向移到 slot `0`、`enemy-6` 横向移到 slot `4` 的断言；如果这些不改，后续修复会被旧测试拉回线性数组模型。
