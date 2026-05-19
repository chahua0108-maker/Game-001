# 2026-05-19 第15轮-06：卡牌池 / 内容密度专家

工作目录：`/Users/roc/Game-001`  
角色：卡牌池 / 内容密度专家  
负责文件：`prototype-web/src/data/cards.ts`、`prototype-web/src/tests/sim/card-taxonomy.test.ts`  
重要口径：QA 不计入分数。

## 1. 本轮目标

只补能服务短 run 体验的原创正式奖励牌，不复制竞品卡名、文案或美术方向。补强方向限定为：

- 清污染：降低污染挤手导致的坏手感。
- 低费桥：增加 0/1 MP 接链密度。
- 路线奖励牌：补 2 MP 授权段和路线选择价值。
- 强化受益牌：让局内强化 / 宝石系统有更多值得点的目标。

## 2. 新增正式奖励牌

| 卡牌 | 定位 | 关键字段 | 进入奖励池 |
| --- | --- | --- | --- |
| `silt_purge` | 清污染 / 修补抽牌 | 0 MP、抽 1、`净化`、`pollution`、打出后消耗 | 是 |
| `fuse_needle` | 低费桥 / 强化目标 | 1 MP 单体 7、接链、显式 `runUpgrade` | 是 |
| `cinder_crossing` | 低费桥 / 起手 | 0 MP 单体 2、开链、路线桥 | 是 |
| `signal_relay` | 路线奖励牌 | 2 MP 前排 6、授权段、显式 `runUpgrade` | 是 |
| `crimson_receipt` | 强化受益牌 | 1 MP 单体 8、`maxLevel: 3`、每级 +3 | 是 |

## 3. 边界

- 没有新增运行时逻辑；本轮只使用现有 `damage`、`drawCards`、`lifecycle.onPlay: exhaust`、`rewardBranches`、`runUpgrade` 等数据合同。
- `silt_purge` 表达的是短 run 的清污染定位和手牌解堵，不引入新的“从牌库移除污染”运行时承诺。
- 新卡均为原创命名和文案，没有沿用竞品卡名、说明或美术概念。
- 新卡不使用 `payoff` 角色，避免破坏当前“3 MP 全场爆发终结牌”边界。

## 4. 测试合同

`prototype-web/src/tests/sim/card-taxonomy.test.ts` 新增短 run 内容密度测试：

- 正式奖励池必须有清污染牌：`净化` 关键词 + `pollution` 标签。
- 正式奖励池必须有低费路线桥：`cost <= 1` + `route-bridge`。
- 正式奖励池必须有 2 MP 路线奖励段：`route-bridge` + `chainRole: expand`。
- 正式奖励池必须有显式强化受益牌：有伤害、正式奖励、带 `runUpgrade`。

## 5. 验证

已执行红灯验证：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run src/tests/sim/card-taxonomy.test.ts
```

结果：新增测试先失败，失败点为 `silt_purge` 尚不存在。

已执行绿灯验证：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run src/tests/sim/card-taxonomy.test.ts
npm test -- --run src/tests/sim/card-taxonomy.test.ts src/tests/sim/reward-branching.test.ts
npm run build
```

结果：

- `card-taxonomy.test.ts`：9 个测试通过。
- `card-taxonomy.test.ts` + `reward-branching.test.ts`：14 个测试通过。
- `npm run build`：通过；Vite 保留既有 chunk size warning。

额外探针：

```bash
cd /Users/roc/Game-001/prototype-web
npm test -- --run src/tests/sim/card-upgrade-gems.test.ts
```

结果：该测试当前 1 个断言失败，失败点是 `debt_hook` 升级后实际敌人 HP 为 24，测试期望 23。该失败发生在 `card-upgrade-gems.test.ts` / `cardUpgrades.ts` 相关并行改动上，不属于本轮负责文件；本轮没有改动该测试或升级运行时。

## 6. 改动文件

- `prototype-web/src/data/cards.ts`
- `prototype-web/src/tests/sim/card-taxonomy.test.ts`
- `design/technical/redline-batches/long-task/2026-05-19-round-15-06-card-density.md`
