# Redline 大局内小局继承框架 Spec

日期：2026-05-20

状态：第 10 轮大局继承实现后，10 名玩家平均分 `84.9/100`，2 名 QA 均 `gate fail`。框架程序专家复审结论为 `approve-with-changes`；6 个 P1 必须项已写入本 spec，可进入下一轮 TDD 实现。

## 1. 用户纠偏

用户指出：当前 D1-D2-D3 的“三局体验”模型不成立。一个完整大局体验中包含多个小局，小局之间的牌池和基础属性应当继承；当前实现把每个小局当成独立短局重开，所以核心体验完全跑偏。

本 spec 修正第 9 轮以前的错误假设：此前“避免跨局牌组继承”只适用于账号永久 meta 或裸 `restart-run`，不适用于同一个 activity 大局内的 D1-D2-D3 小局。新的边界是：

- 允许并要求：同一个 activity 大局内，小局胜利推进时继承构筑和基础属性。
- 仍然禁止：写入账号永久成长、localStorage、全局 `startingHand`、全局 `rewardCardPool`。
- 仍然保留：失败或手动重开当前小局时回到该小局开始前的大局快照，不吃失败中途收益。

## 2. 本轮目标

本轮只做 activity 内继承框架，不扩 D5-D10，不做新 UI 大改，不做 AIRoc 插件或 GitHub 上传。

必须达成：

- D1 胜利进入 D2 时，D2 的 `player.deck` 继承 D1 结束时的奖励牌。
- D1 胜利进入 D2 时，D2 的 `reward.candidateCardPool` 继承 D1 消耗后的候选池，不重新回满。
- D1 胜利进入 D2 时，D2 的基础属性继承 D1 结束状态：`maxHp`、`maxEnergy`、`xp`、`level`、`reward.xpThreshold`。
- 新小局有效 `maxHp` 使用 `Math.max(carryover.maxHp, activityLevel.playerMaxHp)`，既继承已有基础属性，也允许 D3 作为 6 节点小局提供有限生命预算；但 D3 不得再使用 `180 HP` 这类保送式巨大血量。
- 新小局当前 HP 默认刷新到有效 `maxHp`。当前 HP 损伤不作为“基础属性”暗中继承，除非未来另有可见的大局伤势 modifier。
- D1 胜利进入 D2 时，D2 的 `cardUpgrades` 继承 D1 结束状态。
- D2 胜利进入 D3 时，同样继承 D2 结束状态。
- D3 必须是“可首通但明显更紧”的中级入口：不允许出现 D2 濒死、D3 靠巨额 HP 和超低敌压被动兜底的难度断层。
- 新小局仍然重建战斗层：敌人、手牌、抽牌堆、弃牌堆、消耗区、保留区、临时授权、chain、route pending、当前 run pressure 都重置。
- `restart-current-level` 不推进难度，也不继承失败/中途奖励；它应回到当前小局开始前的 activity carryover 快照。
- 非 activity 的 `restart-run` 继续保持旧语义：清空当前 run 奖励和升级，回到 `startingHand`。

## 3. 正确体验定义

玩家看到的三局循环应当是：

```text
D1 小局
  战斗 -> 奖励 -> 路线 -> 胜利结算
  产物：新牌、升级、XP/等级、HP/MP 基础属性、候选牌池消耗

进入 D2
  继承 D1 产物
  重置战斗现场
  应感到“我上一局的选择让我这一局更强/更成型”

进入 D3
  继承 D1+D2 产物
  难度上升，但不是裸牌组硬打 6 节点
```

核心体验评分必须重新评估。第 9 轮 `95.8` 作废为“独立三短局模型下的分数”，不能再作为大局核心分。

### 3.1 第 10 轮复盘修正

第 10 轮 runtime 继承链路基本成立，但评分失败：

- 10 名独立资深玩家评分：`92, 91, 88, 84, 82, 84, 84, 82, 84, 78`，平均 `84.9/100`。
- 2 名 QA 专家均 `gate fail`。
- 共同 P1/P0 原因：D3 被设置为 `playerMaxHp=180`、`enemyHpMultiplier=0.5`、`enemyDamageMultiplier=0.2`，导致第三小局不是中级入口，而是“大血包护航局”。
- 共同 P1 原因：HUD 仍显示 `仅本run`，与 activity 内牌池和基础属性继承的真实状态冲突。
- QA 补充：`buildSnapshot()` 必须深拷贝 `player.deck`；`maxEnergyThisRunPlusOne` 这类“本小局”路线 modifier 不得被误捕获为 activity 基础属性继承。
- 框架专家补充：`carryover.maxHp / maxEnergy` 是基础属性，不等同于 live `world.player.maxHp / maxEnergy`；D3 HP floor 只能是当前小局 floor，不得流入 D4 carryover。

因此本轮修正不推翻 carryover 架构，只补齐四个红线：

1. D3 数值改为“有限缓冲 + 更长节点 + 更高总压力”，不能靠 180 HP 和超低敌压过关。
2. 红线测试必须验证 D1-D2-D3 压力区间，而不是只断言 `hp > 0`。
3. UI 必须把 activity 内继承说清楚，D2/D3 不得再显示 `仅本run` 作为主语义。
4. snapshot / route temporary modifier 边界必须闭合，避免调试层或“本小局”modifier 污染 activity carryover。

## 4. 状态边界

新增 activity 内继承状态，建议放在 `prototype-web/src/sim/types.ts`：

```ts
export interface ActivityCarryoverState {
  deck: CardId[];
  rewardCandidateCardPool: CardId[];
  maxHp: number;
  nextRunStartHp: number;
  maxEnergy: number;
  xp: number;
  level: number;
  xpThreshold: number;
  cardUpgrades: CardUpgradeState;
  activityRewardHistory: RunRewardHistoryEntry[];
}

export interface ActivityState {
  id: 'redline-core-activity-01';
  title: string;
  totalDifficultyTiers: 10;
  playableLevelIds: ActivityLevelId[];
  currentLevelId: ActivityLevelId;
  completedLevelIds: ActivityLevelId[];
  carryover: ActivityCarryoverState;
}
```

`ActivityCarryoverState` 是 activity-session 内状态，不是账号状态。它只随当前 prototype world 存活。

重要不变量：`activity.carryover` 表示“当前小局入口快照”，不是 live carryover。D2 / D3 中途获得奖励、升级、XP、maxEnergy 调整或候选池消耗时，不得直接写入 `activity.carryover`。只有合法的 `continue-activity` 在 victory settlement 捕获当前 world，才会生成下一小局入口快照并写回下一关 `ActivityState.carryover`。

### 4.1 继承

进入下一小局时继承：

- `player.deck`
- `reward.candidateCardPool`
- `player.maxHp` 的基础属性部分；capture 时只能来自 prior carryover 或明确永久来源
- `nextRunStartHp`，默认等于继承后的 `maxHp`
- `player.maxEnergy` 的基础属性部分；capture 时只能来自 prior carryover 或明确永久来源
- `player.xp`
- `player.level`
- `reward.xpThreshold`
- `cardUpgrades.enhancements`
- `cardUpgrades.history`
- 历史奖励记录的 activity 汇总副本，字段名固定为 `activityRewardHistory`

基础属性继承只允许来自 prior carryover 或明确的永久来源，不得盲拷贝 live `world.player.maxHp / maxEnergy`。`activityLevel.playerMaxHp` 是当前小局 floor，不是永久成长来源。D3 使用 96-120 HP floor 通关后，进入 D4 时不得把 D3 floor 变成永久 `carryover.maxHp`。

注意：`maxEnergyThisRunPlusOne` 的名字和 UI 文案表示“本小局/本 run 临时加成”。它可以影响当前小局战斗，但不得在 `captureActivityCarryoverFromWorld()` 中成为下一小局的 `carryover.maxEnergy`。如果未来要做永久能量上限成长，必须新增明确的永久来源或重命名该 modifier。测试示例不得再通过手写 `world.player.maxEnergy = 4` 来证明 activity 继承；应分为“明确永久来源继承”和“真实临时路线不继承”两类。

### 4.2 重置

进入下一小局时重置：

- `run.currentNode`
- `run.rewardHistory`
- `run.pressure`
- `route.pendingNodeChoices`
- `route.nextBattleContext`
- `route.history`
- `player.hand`
- `player.drawPile`，但新抽牌堆应从继承后的 `deck` 重建
- `player.discardPile`
- `player.exhaustPile`
- `player.retainedCards`
- `player.energy`，回到继承后的 `maxEnergy`
- `player.tempAuthorizationMP`
- `player.authorizationRestriction`
- `player.payoffArmed`
- `player.combo`
- `chain`
- `enemies`
- `enemyIntents`
- `reward.choices`
- `reward.pending`

## 5. Runtime 方案

### 5.1 activity helper

在 `prototype-web/src/sim/activity.ts` 增加 helper：

```ts
createInitialActivityCarryover(): ActivityCarryoverState
cloneActivityCarryover(carryover: ActivityCarryoverState): ActivityCarryoverState
captureActivityCarryoverFromWorld(world: WorldState): ActivityCarryoverState
continueActivityAfterVictory(activity: ActivityState, carryover: ActivityCarryoverState): ActivityState
```

要求：

- `createInitialActivityState()` 必须初始化 `carryover`。
- `cloneActivityState()` 必须深拷贝 carryover、card upgrade state、reward history 和所有数组。
- `captureActivityCarryoverFromWorld()` 只在 victory settlement 的 `continue-activity` 路径调用。
- `continueActivityAfterVictory()` 必须先写入当前 level completed，再切到下一 level，并把传入 carryover 写入 activity。
- `captureActivityCarryoverFromWorld()` 必须显式过滤 transient 区域：hand / drawPile / discardPile / exhaustPile / retainedCards / route / chain / enemies / enemy intents / debug / current run pressure 都不得进入 carryover。
- `captureActivityCarryoverFromWorld()` 必须显式过滤 `maxEnergyThisRunPlusOne` 造成的当前小局临时 `maxEnergy`，下一小局只能继承 prior carryover 的 `maxEnergy` 或明确永久来源。
- `captureActivityCarryoverFromWorld()` 捕获 `maxHp / maxEnergy` 时，必须从 prior carryover 出发，只叠加明确永久来源；不得直接把 live `world.player.maxHp / maxEnergy` 当成基础属性。

### 5.2 world 初始化

修改 `prototype-web/src/sim/world.ts` 的 `createInitialWorld()`：

- 如果没有 activity，保持旧裸 run 语义。
- 如果有 activity，读取 `activity.carryover` 作为玩家起点。
- `player.maxHp` 使用 `Math.max(carryover.maxHp, activityLevel.playerMaxHp)`，不得因为 D2/D3 的 `playerMaxHp` 较低而降低。
- `player.hp` 在 `carryover.nextRunStartHp >= carryover.maxHp` 时按新的有效 `maxHp` 回满；如果未来引入显式伤势 modifier，再允许 `nextRunStartHp` 低于 `maxHp`。
- `player.maxEnergy` 使用继承的 `carryover.maxEnergy`。
- `player.energy` 开局填满到 `player.maxEnergy`。
- `player.deck` 和 `player.drawPile` 从继承后的 `carryover.deck` 重建。
- `reward.candidateCardPool` 从继承后的 `carryover.rewardCandidateCardPool` 重建。
- `reward.xpThreshold` 从继承后的 `carryover.xpThreshold` 重建。
- `cardUpgrades` 从继承后的 `carryover.cardUpgrades` 深拷贝。

D1 首次进入时，carryover 由 `startingHand`、`rewardCardPool`、D1 `playerMaxHp`、`nextRunStartHp=playerMaxHp`、`maxEnergy=3`、`xp=0`、`level=1`、`INITIAL_REWARD_XP_THRESHOLD` 初始化。

第 10 轮 D3 的 `playerMaxHp=180`、`enemyHpMultiplier=0.5`、`enemyDamageMultiplier=0.2` 已被玩家评分和 QA 判定为失败配置，必须废弃。

下一轮 D3 实现目标：

- 初始专家建议为 `playerMaxHp=108`、`enemyHpMultiplier=0.82`、`enemyDamageMultiplier=0.60`；TDD 实测该组合第一节点即失败，不能服务首通目标。
- 采用实现起点：`playerMaxHp=108`、`enemyHpMultiplier=0.48`、`enemyDamageMultiplier=0.35`、`eliteRouteEntryDamage=6`。
- 该组合仍显著低于第 10 轮失败配置 `180 HP`，并通过自然 D1-D2-D3 测试验证 D3 剩余 HP 比例低于 D2 至少 `0.15`。
- D3 仍保持 `nodeCount=6`、`rewardPickCount=3`。
- D3 进入 D4 时，D3 的关卡 HP floor 仍不得写成 activity carryover 的永久高水位。

D2 同步要保持“低压过渡”身份：实现起点为 `enemyHpMultiplier=0.65`、`enemyDamageMultiplier=0.20`。保守玩家自然 D2 清关不能贴死，建议清关 HP 区间至少高于 `18/72`；否则 D2 会抢走 D3 的中级压力角色。

### 5.3 runtime 推进

修改 `prototype-web/src/sim/runtime.ts`：

```ts
function continueActivityWorld(current: WorldState): WorldState {
  if (!current.activity || current.run.status !== 'victory' || current.fsm.gameFlow !== 'Settlement') {
    return current;
  }
  if (!current.activitySettlementPreview?.canContinue) {
    return current;
  }
  const carryover = captureActivityCarryoverFromWorld(current);
  const nextActivity = continueActivityAfterVictory(current.activity, carryover);
  return createInitialWorld(current.run.runNumber + 1, nextActivity);
}
```

`restartCurrentLevelWorld()` 仍然使用 `current.activity` 中已经保存的小局起点 carryover，所以失败/中途奖励不会写入下一次重试。

activity 模式下，旧 `restart-run` 为兼容入口，语义等同 `restart-current-level`；非 activity 模式下 `restart-run` 保持旧边界，回到裸 run 的 `startingHand`、完整 reward pool 和空升级。

## 6. 测试计划

先写 RED 测试，再实现。

### 6.1 activity 继承测试

修改 `prototype-web/src/tests/sim/redline-activity-difficulty.test.ts`。

新增或替换旧测试：

```ts
it('inherits deck, reward pool, base attributes, xp, and upgrades from D1 into D2 inside one activity', () => {
  let world = createInitialWorld(1, createInitialActivityState());
  world.player.hp = 17;
  // 测试明确永久来源，而不是 maxEnergyThisRunPlusOne 这类本小局临时路线 modifier。
  world.activity!.carryover.maxEnergy = 4;
  world.player.maxEnergy = 4;
  world.player.energy = 4;
  world.player.xp = 13;
  world.player.level = 2;
  world.reward.xpThreshold = 24;

  forceFinalRewardReady(world, ['severance_burst', 'wild_gap_key', 'blood_reclaim']);
  selectReward(world, 'severance_burst', 'activity-carryover-d1-reward');
  expect(world.player.deck).toContain('severance_burst');
  expect(world.reward.candidateCardPool).not.toContain('severance_burst');

  world.cardUpgrades.enhancements.debt_hook = {
    cardId: 'debt_hook',
    level: 1,
    gemSlots: [{ color: 'red', gemId: null }]
  };

  world = continueActivity(world, 'activity-carryover-continue-d2');

  expect(currentActivityLevel(world.activity!).id).toBe('d2');
  expect(world.player.deck).toEqual([...startingHand, 'severance_burst']);
  expect(world.player.drawPile).toEqual([...startingHand, 'severance_burst']);
  expect(world.reward.candidateCardPool).not.toContain('severance_burst');
  expect(world.player.hp).toBe(72);
  expect(world.player.maxHp).toBe(72);
  expect(world.player.maxEnergy).toBe(4);
  expect(world.player.energy).toBe(4);
  expect(world.player.xp).toBe(13);
  expect(world.player.level).toBe(2);
  expect(world.reward.xpThreshold).toBe(24);
  expect(world.cardUpgrades.enhancements.debt_hook?.level).toBe(1);
});
```

该测试必须证明“带伤通关 D1，D2 仍按继承 `maxHp` 满血开局”。
如果测试覆盖临时能量路线，必须另起测试并断言下一小局回到 prior carryover `maxEnergy`。

### 6.2 D2 到 D3 继续继承

新增：

```ts
it('keeps inherited D1 and D2 deck growth when continuing into D3', () => {
  let world = createInitialWorld(1, createInitialActivityState());

  forceFinalRewardReady(world, ['severance_burst', 'wild_gap_key', 'blood_reclaim']);
  selectReward(world, 'severance_burst', 'activity-carryover-d1');
  world = continueActivity(world, 'activity-carryover-d2');

  forceFinalRewardReady(world, ['wild_gap_key', 'blood_reclaim', 'pulse_draw']);
  selectReward(world, 'wild_gap_key', 'activity-carryover-d2-reward');
  world = continueActivity(world, 'activity-carryover-d3');

  expect(currentActivityLevel(world.activity!).id).toBe('d3');
  expect(world.player.deck).toEqual([...startingHand, 'severance_burst', 'wild_gap_key']);
  expect(world.reward.candidateCardPool).not.toContain('severance_burst');
  expect(world.reward.candidateCardPool).not.toContain('wild_gap_key');
});
```

### 6.3 重试边界

新增：

```ts
it('restarts current activity level from the saved level-start carryover instead of failed mid-run rewards', () => {
  let world = createInitialWorld(1, createInitialActivityState());
  forceFinalRewardReady(world, ['severance_burst', 'wild_gap_key', 'blood_reclaim']);
  selectReward(world, 'severance_burst', 'activity-restart-boundary-d1');
  world = continueActivity(world, 'activity-restart-boundary-d2');

  forceRewardReady(world, ['wild_gap_key', 'blood_reclaim', 'pulse_draw']);
  selectReward(world, 'wild_gap_key', 'activity-restart-boundary-midrun-reward');
  expect(world.player.deck).toContain('wild_gap_key');
  world.player.xp = 99;
  world.player.level = 7;
  world.player.maxEnergy = 5;
  world.reward.candidateCardPool = ['pulse_draw'];
  world.cardUpgrades.enhancements.redline_cut = {
    cardId: 'redline_cut',
    level: 2,
    gemSlots: []
  };

  world = restartCurrentLevel(world, 'activity-restart-boundary-restart-d2');

  expect(currentActivityLevel(world.activity!).id).toBe('d2');
  expect(world.player.deck).toEqual([...startingHand, 'severance_burst']);
  expect(world.player.deck).not.toContain('wild_gap_key');
  expect(world.reward.candidateCardPool).not.toContain('severance_burst');
  expect(world.reward.candidateCardPool).toContain('wild_gap_key');
  expect(world.player.xp).toBe(0);
  expect(world.player.level).toBe(1);
  expect(world.player.maxEnergy).toBe(3);
  expect(world.cardUpgrades.enhancements.redline_cut).toBeUndefined();
});
```

该测试同时覆盖深拷贝污染：D2 中途写入的 XP / 等级 / maxEnergy / candidate pool / cardUpgrades 都不能污染 D2 入口 carryover。

### 6.4 continue-activity 负向边界

新增：

```ts
it('does not capture carryover when continue-activity is not a legal victory settlement action', () => {
  const world = createInitialWorld(1, createInitialActivityState());
  const entryDeck = [...world.activity!.carryover.deck];
  world.player.deck.push('severance_burst');

  const continued = continueActivity(world, 'activity-carryover-illegal-continue');

  expect(continued).toBe(world);
  expect(world.activity!.currentLevelId).toBe('d1');
  expect(world.activity!.carryover.deck).toEqual(entryDeck);
});
```

该测试必须覆盖至少一种非法状态：非 `Settlement`、非 `victory` 或 `canContinue === false`。实现不得在这些状态捕获 carryover。

### 6.5 旧断言更新

必须更新这些旧断言：

- `continues victory from D1 to D2 and then D3 while keeping run rewards non-permanent`
  - 旧名和旧断言错误；activity 内奖励应继承。
  - 保留“不是永久 meta”语义，改为只验证非 activity `restart-run` 仍重置。
- `keeps activity progression scoped without adding carryover deck growth or new playable tiers`
  - 旧名和旧断言错误；activity 内必须有 deck growth。
  - 保留 D5/D10 不泄漏断言。

不得删除裸 `restart-run` 的边界测试：

- `prototype-web/src/tests/sim/redline-short-run-completion.test.ts`
  - `restart-run clears current-run route, upgrades, rewards, and reward-added deck cards`
  - 该测试继续保护非 activity 或整局重开语义。

### 6.6 压力曲线红线测试

新增或更新自然 D1-D2-D3 测试，至少记录并断言：

- D1 自然清关应稳定剩余较高 HP。
- D2 自然清关必须是低压过渡，不能贴死；建议 `hp >= 18`。
- D3 自然清关必须可首通，但剩余 HP 比例应体现中级压力；建议 `hp >= 12` 且 `D3 hp/maxHp <= D2 hp/maxHp - 0.15`。
- D3 的 `playerMaxHp` 不得超过 `120`。
- D3 的敌压不得低于 D1 的教学级别，且应通过 6 节点形成高于 D2 的总压力。

这些断言的目标不是追求精确平衡，而是防止再次把“能过”误判为“从简单到难好玩”。

### 6.7 snapshot 与临时能量边界

新增测试：

- `buildSnapshot()` 返回的 `snapshot.player.deck` 必须是深拷贝，修改 snapshot deck 不得污染 world deck。
- 真实选择 `maxEnergyThisRunPlusOne` 路线后，当前小局可以 `maxEnergy=4`；胜利进入下一小局时，如果没有明确永久能量来源，下一小局 `maxEnergy` 必须回到 activity 入口 carryover 值。
- `activityRewardHistory` 必须累计 D1+D2 的 reward history，供后续活动回顾/UI 使用。
- D3 使用 `96-120 HP` floor 通关后进入 D4，D4 的 `activity.carryover.maxHp` 不能变成 D3 floor；D4 runtime 的 `player.maxHp` 只能来自 prior carryover 与 D4 floor 的 `Math.max`。
- `continue-activity` 负向边界建议 table test 覆盖非 `Settlement`、非 `victory`、`canContinue=false` 三类非法状态。

## 7. UI / QA 最小验收

本轮 UI 只做最小必要展示，不开大改：

- HUD run layer 或 settlement 文案需要能看到当前 deck size / 继承提示之一。
- D2/D3 开局不能看起来像完全裸牌组重开。
- activity 模式下不得再把下一战/下一局主语义显示成 `仅本run`。非 activity 裸 run 仍可保留 `仅本run`，但 activity D2/D3 必须显示继承语义。

可接受最小文案：

- D2 settlement/entry：`继承 D1 牌组与基础属性`
- D3 settlement/entry：`继承 D1-D2 构筑`
- run layer：`牌组N · 大局继承`
- settlement detail：`保留牌组/XP/升级，重置手牌/战场/路线`

UI 单测必须硬断言：activity 模式 D2/D3 的 `hudRunLayerState.nextDetail` 不包含 `仅本run`，并包含 `大局继承` 或同等继承语义。非 activity 裸 run 才允许继续显示 `仅本run`。

QA 需要验证没有页面崩溃、文本溢出、活动按钮断裂，并覆盖一次 activity settlement/continue/restart 的浏览器路径。本轮核心分主要由 10 名独立资深玩家在实现后重新打分。

## 8. 验收命令

```bash
cd /Users/roc/Game-001/prototype-web
npm run test:sim -- redline-activity-difficulty.test.ts
npm run test:sim -- redline-short-run-completion.test.ts progression-reward-regression.test.ts run-layer-boundary.test.ts
npm run check
QA_ROUND=activity-inherited-small-runs QA_PORT=5190 npm run qa:ui
```

实现后必须再派：

- 10 名独立资深玩家：只围绕 activity 大局内 D1-D2-D3 继承体验评分。
- 2 名 QA 专家：审查 P0/P1/P2，尤其是重试边界、非 activity restart、`.codex/` staging。

目标分重新设为 `95+`。如果继承实现后仍低于 95，不得 final 停止，继续下一轮 spec。

## 9. 框架专家审核问题

请框架程序专家重点审核：

1. `ActivityCarryoverState` 是否应该放在 `ActivityState` 内，还是单独挂在 `WorldState`。
2. `nextRunStartHp` 默认回满到继承 `maxHp` 是否正确；如未来要继承伤势，是否必须做成显式大局 modifier。
3. `rewardHistory` 是否应作为 activity 汇总保留，还是只靠 deck / candidate pool / card upgrades 推导。
4. `restart-current-level` 用现有 `current.activity.carryover` 作为小局起点快照是否足够。
5. 这套方案是否保持非 activity `restart-run` 的旧边界。
6. 本修正的 D3 `108 HP / 0.48 enemy HP / 0.35 enemy damage / 6 elite route entry damage` 是否足够表达“可首通但更紧”的中级入口。
7. `maxEnergyThisRunPlusOne` 不进入 activity carryover 是否与当前路线 modifier 命名和玩家预期一致。
