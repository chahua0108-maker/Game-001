# 2026-05-18 Round 04-04 修补牌数值落地评估

角色：第 4 轮专家 04，修补牌数值落地工程师  
工作目录：`/Users/roc/Game-001`  
范围：只读当前源码，评估 `wild_mana_stitch` 与 `wild_gap_key` 的本轮最小实现和测试。  
源码边界：本文未修改运行时代码，未提交 git。

## 1. 本轮裁决

### 1.1 `wild_mana_stitch`

本轮优先做“修补成功才返 MP”，不把“直接移除 `energyGain`”作为首选。

理由：

- 当前 runtime 已经有 `ChainRepaired` 事件和 `GainEnergy` 命令，不需要新增一套效果系统。
- `wild_mana_stitch` 的问题不是“返 MP 这个身份完全不该存在”，而是当前 `energyGain` 在任意打出时都会返 MP，导致 0 费 self 抽牌、Wild 修补、返 MP 三件事无条件叠加。
- 条件返还能保留它和 `wild_gap_key` 的差异：`wild_gap_key` 是付费低伤害修补，`wild_mana_stitch` 是 0 费手牌修补，但只有真的补上链时才奖励当前 MP。
- 如果本轮只允许纯数据改动、不能补测试，则兜底方案才是删除 `energyGain`、`mana` utility、`返MP` keyword，并同步改文案。这个方案安全但表达力更低。

### 1.2 `wild_gap_key`

本轮应做 `damage 1 -> 2`。

理由：

- 当前 `wild_gap_key` 是最干净的 Wild 修补牌，但 `damage = 1` 的即时反馈太弱。
- 改成 2 后，接在 `debt_hook` 后按当前倍率只会造成 `2 * 2 = 4`，仍明显低于 `redline_cut` 的 `9 * 2 = 18`。
- 它仍是稳定性路线，不会替代正常 1 费攻击路线。

## 2. 当前源码事实

### 2.1 卡牌数据

`prototype-web/src/data/cards.ts` 当前状态：

- `wild_mana_stitch`：`cost 0`、`targets self`、`drawCards 1`、`energyGain 1`、`utilities ['wild', 'draw', 'mana']`、文案写“修补缺口。抽1，当前MP+1。”
- `wild_gap_key`：`cost 1`、`targets front-enemy`、`damage 1`、`utilities ['wild']`。
- `rewardCardPool` 以 `wild_mana_stitch` 开头，之后是 `severance_burst`、`wild_gap_key`。在当前奖励分支选择逻辑下，未调弱的 `wild_mana_stitch` 很容易成为首个 repair/resource 选择。

### 2.2 Runtime 命令与事件结构

`prototype-web/src/sim/runtime.ts` 当前 `play-card` 流程是：

1. `validatePlayCard` 产生命令：`SpendEnergy`、`DiscardPlayedCard`、`SetCharacterState`。
2. `advanceCostChain` 计算倍率，并返回 `ChainAdvanced`、可选 `ChainRepaired`、可选 `AuthorizationGranted`。
3. runtime 把 chain 事件推入队列，再推入 `CardPlayed`。
4. `processEventQueue` 处理 `CardPlayed` 时，`prototype-web/src/eca/redlineRules.ts` 的 `card.self.resource` 规则根据 `drawCards` 生成 `DrawCards`，根据 `energyGain` 生成 `GainEnergy`。

关键问题：

- `energyGain` 现在只受 `CardPlayed` 和卡牌数据控制，不看这次打出是否真的产生 `ChainRepaired`。
- `ChainRepaired` 已经在 `CardPlayed` 之前进入事件队列，所以运行时具备判断“本次打出是否修补”的基础。
- `GainEnergy` 命令已经存在，最小实现不需要新增命令类型。

### 2.3 一个需要顺手收紧的语义边界

`advanceCostChain` 当前的 `canRepairWithWild = isWild && world.chain.playedCosts.length > 0` 没有排除 `world.chain.broken`。这意味着链已经 broken 后再打 Wild，也可能产出 `ChainRepaired`，但 `isAuthorizationChain` 会因为 `chain.broken` 不给授权。

如果要让“修补成功才返 MP”语义准确，建议本轮把“成功修补”定义为：

```text
Wild card played after a non-broken chain has started, and it fills the current nextExpectedCost.
```

也就是条件至少包含：

```text
isWild
playedCosts.length > 0
!chain.broken before this card
continues
```

否则会出现“UI/日志说修补成功，但这条链已经不能授权”的歧义。

## 3. 最小实现方案

### 3.1 数据层

修改 `prototype-web/src/sim/types.ts`：

```ts
export interface CardDefinition {
  // existing fields...
  energyGain?: number;
  energyGainCondition?: 'chain-repaired';
}
```

修改 `prototype-web/src/data/cards.ts`：

```ts
wild_mana_stitch: {
  // keep energyGain as amount, but make it conditional
  energyGain: 1,
  energyGainCondition: 'chain-repaired',
  rulesText: '修补成功：当前MP+1。抽1。',
  detail: '修补当前费用缺口时返还本回合当前MP；不会提高最大MP。',
  description: 'Wild/修补。0 MP self 抽 1 张；只有修补费用缺口成功时返还 1 当前 MP，不是 Max MP +1。'
}
```

`utilities: ['wild', 'draw', 'mana']` 和 `keywords: ['修补', '抽牌', '返MP']` 可以保留，因为卡牌仍然具备条件返 MP 身份。若采用兜底删除方案，则需要同步删掉 `energyGain`、`mana`、`返MP` 和返 MP 文案。

修改 `wild_gap_key`：

```ts
damage: 2,
rulesText: '造成2。修补费用缺口。',
mobileEffect: '修补2'
```

### 3.2 事件层

修改 `prototype-web/src/sim/types.ts` 的 `CardPlayed` 事件，增加当前打出是否修补的信息：

```ts
type: 'CardPlayed';
// existing fields...
chainRepaired: boolean;
repairedCost?: number;
```

修改 `prototype-web/src/sim/runtime.ts`：

```ts
const chainWasBrokenBeforePlay = world.chain.broken;
const chainResult = advanceCostChain(world, card, intent.traceId);
const repairEvent = chainResult.events.find(
  (event) => event.type === 'ChainRepaired' && !chainWasBrokenBeforePlay
);

queue.push({
  type: 'CardPlayed',
  // existing fields...
  chainRepaired: Boolean(repairEvent),
  repairedCost: repairEvent?.type === 'ChainRepaired' ? repairEvent.repairedCost : undefined
});
```

更干净的版本是让 `advanceCostChain` 直接返回：

```ts
{ multiplier, events, chainRepaired, repairedCost }
```

这样 `CardPlayed` 不需要反查事件数组。

### 3.3 Chain repair 判定

修改 `advanceCostChain` 内部判定：

```ts
const canRepairWithWild = isWild && world.chain.playedCosts.length > 0 && !world.chain.broken;
```

这会让 `ChainRepaired` 更接近“成功修补”，避免 broken chain 后的 Wild 被误当作成功修补。若担心影响现有调试语义，可以保留 `ChainAdvanced`，但不要发 `ChainRepaired`，也不要触发条件返 MP。

### 3.4 效果规则

修改 `prototype-web/src/eca/redlineRules.ts` 的 `card.self.resource`：

```ts
const canGainEnergy =
  Boolean(card.energyGain) &&
  (card.energyGainCondition !== 'chain-repaired' ||
    (event.type === 'CardPlayed' && event.chainRepaired));

return [
  // existing DrawCards...
  ...(canGainEnergy
    ? [
        {
          type: 'GainEnergy' as const,
          traceId: event.traceId,
          amount: card.energyGain,
          reason: `played ${card.id}`
        }
      ]
    : [])
];
```

保持 `GainEnergy` 命令不封顶，避免本轮顺手改变资源系统。如果后续要封顶到 `maxEnergy`，应另开资源规则评估，因为当前 `wild_mana_stitch` 测试已经接受临时当前 MP 可超过 3。

## 4. 测试建议

建议新增或补进 `prototype-web/src/tests/sim/runtime.test.ts`，也可以独立建 `repair-card-balance.test.ts`。

### 4.1 `wild_mana_stitch` 修补成功才返 MP

用例 A：作为 opener 不返 MP。

```ts
prepare world hand = ['wild_mana_stitch'];
world.player.energy = 2;
play wild_mana_stitch;

expect(CardPlayed.chainRepaired).toBe(false);
expect(world.player.energy).toBe(2);
expect(debug.commands).not.toContainEqual(expect.objectContaining({
  type: 'GainEnergy',
  traceId
}));
```

用例 B：`debt_hook -> wild_mana_stitch` 成功修补并返 MP。

```ts
prepare hand = ['debt_hook', 'wild_mana_stitch', 'row_cleave'];
play debt_hook;
const energyBefore = world.player.energy;
play wild_mana_stitch;

expect(events).toContainEqual(expect.objectContaining({
  type: 'ChainRepaired',
  repairedCost: 1
}));
expect(CardPlayed.chainRepaired).toBe(true);
expect(world.player.energy).toBe(energyBefore + 1);
expect(debug.commands).toContainEqual(expect.objectContaining({
  type: 'GainEnergy',
  amount: 1,
  traceId
}));
```

用例 C：broken chain 后的 Wild 不返 MP。

```ts
prepare hand = ['debt_hook', 'row_cleave', 'wild_mana_stitch'];
play debt_hook;
play row_cleave; // breaks expected 1
const energyBefore = world.player.energy;
play wild_mana_stitch;

expect(CardPlayed.chainRepaired).toBe(false);
expect(world.player.energy).toBe(energyBefore);
expect(no GainEnergy command for this traceId).toBe(true);
```

### 4.2 `wild_gap_key damage 1 -> 2`

用例 D：数据静态断言。

```ts
expect(cards.wild_gap_key.damage).toBe(2);
```

用例 E：接在 0 后修补并造成 4 点，不替代正常 1 费攻击。

```ts
prepare hand = ['debt_hook', 'wild_gap_key', 'row_cleave'];
set target hp = 10;
play debt_hook;
play wild_gap_key on target;

expect(ChainRepaired.repairedCost).toBe(1);
expect(CardPlayed.effectMultiplier).toBe(2);
expect(DamageApplied.amount).toBe(4);
expect(target.alive).toBe(true);
expect(DamageApplied.amount).toBeLessThan(cards.redline_cut.damage * 2);
```

### 4.3 回归测试范围

建议跑：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- runtime.test.ts redline-attribute-authorization.test.ts redline-progression-card-system.test.ts reward-branching.test.ts hud-target-selection.test.ts
```

重点观察：

- `runtime.test.ts` 里现有 `uses Wild Mana Stitch as a draw/mana wild repair` 仍应通过，因为该路径是成功修补。
- `redline-attribute-authorization.test.ts` 和 `redline-progression-card-system.test.ts` 的 Wild 授权路径不应受影响。
- `reward-branching.test.ts` 不应因移除或条件化 `energyGain` 破坏 repair/resource 归类，因为 `wild_mana_stitch` 还有 `cardType: repair`、`chainRole: repair`、`utilities: wild`。
- `hud-target-selection.test.ts` 若文案更新，只需保持它仍标成 `修补/抽牌` 或更明确的 `修补/返MP`，不要把它显示成永久成长。

## 5. 不建议本轮顺手做的事

- 不把 `wild_gap_key` 改成 0 费。
- 不给 `wild_gap_key` 加抽牌或返 MP。
- 不给 `wild_mana_stitch` 加更高抽牌量。
- 不在本轮新增 `EnergyGained` 事件；现有 `GainEnergy` command 足够测试落地。若 UI 需要战斗日志，再另开事件。
- 不把 `GainEnergy` 改成全局封顶到 `maxEnergy`，这会改变当前“当前 MP 临时返还”的语义。
- 不把奖励池排序和本次数值修补混在同一个最小补丁里；如果要调首奖优先级，另按奖励分支任务处理。

## 6. 最小交付清单

1. `wild_gap_key.damage = 2`，同步 `rulesText/mobileEffect`。
2. `wild_mana_stitch.energyGain = 1` 保留为数值，新增 `energyGainCondition: 'chain-repaired'`。
3. `CardPlayed` 增加 `chainRepaired/repairedCost`，由 runtime 的本次 chain result 写入。
4. `redlineRules.card.self.resource` 只在条件满足时生成 `GainEnergy`。
5. 增加三条 `wild_mana_stitch` 条件返 MP 测试：opener 不返、成功修补返、broken 后不返。
6. 增加一条 `wild_gap_key` 倍率伤害测试：接在 0 后造成 4，仍弱于 `redline_cut`。

STATUS: DONE  
路径：`/Users/roc/Game-001/design/technical/redline-batches/long-task/2026-05-18-round-04-04-repair-card-balance-implementation.md`
