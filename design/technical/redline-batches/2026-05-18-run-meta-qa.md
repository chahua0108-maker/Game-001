# Redline Run / Meta Layer QA 验收口径

日期：2026-05-18

角色：Redline 后续层级 QA

范围：本文件只定义 run/meta 层验收，不再把测试重点放在“单手牌压迫是否足够强”。单局战斗体验到当前版本为止，后续重点转为：run 生命周期、局内奖励边界、restart 清理、局外成长入口是否明确。

当前 runtime 状态：`prototype-web` 已有 `restart-run` intent，但 `WorldState` 尚无显式 `run`、`profile` 或 `meta` 字段。因此自动化验收以当前边界为主：核心 sim 不隐式吃局外成长；局内奖励只影响当前 run；restart 返回干净新 run。后续若新增正式 run/meta 字段，需要同步扩展本文件和测试，而不是让实现暗改现有字段。

## 1. 验收目标

Run/meta 层通过不等于“玩家第一手能否打出最强链”。通过标准是：

| ID | 验收项 | 通过条件 |
| --- | --- | --- |
| RM-01 | 新 run 基线稳定 | `createInitialWorld()` 仍以第 1 局、第 1 回合、`Deal` 状态、`maxEnergy = 3`、起始牌组、空手牌、15 个活敌人为基线。 |
| RM-02 | 局内奖励不伪装成局外成长 | 选择奖励只加入当前 run 的 `deck/drawPile`，不提高 `maxEnergy`，不声明跨 run 保留。 |
| RM-03 | 非奖励状态不能改 deck | 在非 `Reward` 或无 pending reward 时触发 `select-reward`，必须失败并保持 `deck/maxEnergy` 不变。 |
| RM-04 | restart 清理 run 状态 | `restart-run` 后 XP、level、deck、hand、draw/discard、reward pending、chain、临时授权、敌人队列都回到新 run 基线。 |
| RM-05 | 局外成长入口必须显式 | 在 runtime 没有正式 adapter 前，任何 profile/meta 数据不得被核心 sim 隐式读取并改变 `maxEnergy` 或起始牌组。 |
| RM-06 | 浏览器 QA 后清理 | 人工验收打开的网页标签页/窗口必须关闭；本次启动的 dev server 必须停止，并在记录里写清楚。 |

## 2. 自动化测试

新增测试文件：

- `prototype-web/src/tests/sim/run-layer-boundary.test.ts`

建议命令：

```bash
cd /Users/roc/Game-001/prototype-web
npm run test -- src/tests/sim/run-layer-boundary.test.ts
npm run test
```

测试覆盖：

| 测试 | 保护边界 |
| --- | --- |
| `keeps fresh-run combat state independent from future run/meta layer changes` | 新 run 的单局关键状态不能被 run/meta 改动破坏。 |
| `does not let out-of-reward selection mutate current run deck or max energy` | 非奖励态不能暗改 deck 或 `maxEnergy`。 |
| `adds card rewards only to the current run, then restart-run returns to baseline` | 当前 run 奖励可进本局 deck；restart 后完全重置。 |
| `does not consume foreign meta progression as implicit maxEnergy or deck changes` | 没有正式 adapter 前，外部 meta/profile 注解不能被核心 sim 隐式消费。 |

## 3. 失败分类

每个失败只选一个主分类，必要时加次要说明。

| 分类 | 含义 | 示例 |
| --- | --- | --- |
| implementation bug | 已明确的 run/meta 边界没有被实现或被破坏。 | `restart-run` 后还保留奖励卡；非奖励态 `select-reward` 仍改了 deck。 |
| acceptance conflict | 验收文档、设计文档或测试之间定义冲突。 | 设计说局外成长可加 Max MP，但当前 Redline P0 仍要求 `maxEnergy = 3`。 |
| hidden meta coupling | 局外数据通过未声明路径影响核心 sim。 | 给 world 挂 profile 字段后，runtime 自动把 `maxEnergy` 改成 9。 |
| evidence missing | 结论缺少测试、截图、日志或人工记录。 | “restart 看起来正常”，但没有记录 deck/maxEnergy/reward pending。 |
| scope drift | Worker 为了通过 run/meta 验收改了不属于本任务的单局规则或 UI。 | QA worker 改 runtime、cards、HUD 或 CSS。 |
| cleanup failure | 浏览器验收后没有关闭页面或停止本次启动的 dev server。 | 本地 `127.0.0.1` 页面仍开着，或 5174 端口仍由本次 QA 占用。 |

## 4. 人工浏览器检查步骤

人工检查只验证 run/meta 边界的玩家可见证据，不再要求短时间内复现完整 0->1->2->3 压迫链。

### 4.1 启动

```bash
cd /Users/roc/Game-001/prototype-web
npm run dev -- --host 127.0.0.1 --port 5174
```

如果 5174 被占用，改用 5175 或下一个空端口，并记录实际 URL。

打开：

```text
http://127.0.0.1:5174/
```

### 4.2 新 run 基线

记录以下可见状态：

- 页面进入可操作战斗状态，非空白、非报错。
- HP/MP 显示正常，MP 上限仍是 3。
- 初始没有“永久 Max MP 增长”“局外加成已生效”之类文案。
- 如 HUD 显示 deck、reward、authorization 或 chain，语义应为当前 run / 当前回合，不应表达跨 run 保留。

失败口径：

- 初始可见状态把局外成长当成已生效，但没有明确 run/meta adapter，记为 `hidden meta coupling` 或 `acceptance conflict`。
- 初始 MP 上限不是 3，且没有明确设计/测试迁移，记为 `implementation bug`。

### 4.3 奖励边界

正常游玩直到出现奖励面板；若短时间没有出现，可记录为“自然手牌未触发奖励”，不作为失败。

出现奖励时检查：

- 奖励文案应表达“加入本 run 后续抽牌循环”。
- 不应表达“永久加入账号/档案/局外收藏”，除非正式 meta 层已经落地并有单独验收。
- 选择奖励后，继续本 run 时可抽到或看到该卡进入当前牌组。
- 选择奖励后 MP 上限仍为 3。

失败口径：

- 奖励选择直接提高 `maxEnergy`，记为 `implementation bug`。
- 奖励文案宣称跨 run 永久保留，但 restart 后不保留，记为 `acceptance conflict`。
- 奖励没有任何可见记录，无法判断是否进入当前 run，记为 `evidence missing`。

### 4.4 Restart 边界

在至少出现过以下任一状态后点击 Restart：

- 已打出过牌；
- 已获得 XP 或奖励；
- 已选择过奖励；
- 已进入第 2 回合或更后回合。

Restart 后检查：

- 回到新 run 起点。
- MP 上限仍为 3。
- 授权、chain、reward pending、当前手牌和弃牌状态清空。
- 之前选择的奖励卡不再作为起始牌组的一部分出现。
- 如果 UI 有 run 计数或 meta 入口，必须清楚地区分“新 run”与“局外档案”。

失败口径：

- 旧 run 奖励卡跨 restart 留在基础 deck，记为 `implementation bug`。
- 临时授权或 chain 跨 restart 保留，记为 `implementation bug`。
- Restart 后页面看似刷新但无法确认 deck/reward 状态，记为 `evidence missing`。

### 4.5 视口

至少检查：

- Desktop：`1280x720` 或 `1440x1000`
- Mobile：`390x844`

Run/meta QA 不把 HUD 美术作为主验收，但以下会影响结论：

- Restart 按钮被遮挡，记为 `implementation bug`。
- 奖励面板在移动端无法选择或关闭，记为 `implementation bug`。
- 关键 run/meta 文案在移动端截断到不可理解，记为 `evidence missing` 或 `implementation bug`。

## 5. 验收后关闭网页要求

这条是硬性要求。

人工验收结束后必须执行：

1. 关闭所有本次打开的 `localhost` / `127.0.0.1` 游戏网页标签页或窗口。
2. 如果本次启动了 `npm run dev`，在终端按 `Ctrl-C` 停止。
3. 确认没有本次 QA 遗留的长跑浏览器页面或 dev server。
4. 在验收记录中写明：

```text
已关闭网页，已停止本次 dev server。
```

如果 dev server 不是本次 QA 启动的，不要误停他人进程；记录：

```text
已关闭网页；dev server 属于既有进程，本次未停止。
```

未完成上述清理时，不得把人工浏览器验收标为通过。

## 6. 当前结论

当前 run/meta QA 的自动化重点是“边界不被暗改”，不是“后续成长系统已经完成”。在正式 run/profile/meta 字段落地前，任何跨 run 成长都必须保持设计态或显式 adapter 态，不能偷偷通过核心 `WorldState.player.maxEnergy` 或 `player.deck` 改写来实现。
