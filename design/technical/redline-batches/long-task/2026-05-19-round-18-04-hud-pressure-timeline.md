# Round 18-04 HUD Pressure Timeline

负责人：HUD/手感 UI 设计工程师 / 防溢出负责人

范围：

- `prototype-web/src/ui/hud.ts`
- `prototype-web/src/style.css`
- `prototype-web/src/tests/ui/hud-target-selection.test.ts`

## 目标

把第 18 轮的“连续节点压力 / build plan 演变”压成玩家能快速扫读的 HUD 表达。QA 只作门禁，不计分；本轮不改 sim/runtime/reward。

玩家在常驻 HUD 里需要同时看到：

- 当前节点。
- 上一节点压力。
- 当前构筑问题。
- 下一战路线后果。

## 实现

### Pressure Timeline Adapter

新增 `hudPressureTimelineState(snapshot)`，只做防御式 HUD 读取：

- 优先读取 `run.previousNodePressure`、`run.lastNodePressure`、`run.pressureTimeline`、`route.pressureTimeline` 等未来字段。
- 如果 runtime 还没有连续节点压力字段，则根据当前节点、reward history、HP 缺口给出紧凑 fallback，例如 `上压 首战`、`上压 已清算`、`上压 损9`。
- 当前构筑问题复用 `hudBuildPlanState`，显示为 `构筑 缺桥`、`构筑 缺终结`、`构筑 稳定` 等短 token。
- 下一战后果复用现有 route choice token，例如 `复核+1/偏修补`、`MP+1/偏终结`；已选路线时读取 `route.nextBattleContext`。

### Run Layer 表达

复用现有 `.run-layer-panel`，不新增大面板：

- 主层：`当前节点 / 上压 / 构筑问题`。
- Meta 层：`下一战后果 / 选路线或带入 / 路线后果 token`。

这样保留右侧小面板的信息密度，不覆盖战斗中心区域。

### 防溢出

- `hudPressureTimelineState` 对上一节点压力和构筑问题做短 token 压缩。
- `.run-layer-main`、`.run-layer-meta` 改成稳定 grid，所有文本仍保留单行省略。
- 移动端不再隐藏下一战 meta；改成两条紧凑信息条，确保“下一战后果”在窄屏仍可读。
- Route choice 继续使用已有两行 clamp 和短 token，不把长 preview 放进单行关键状态。

## 测试

新增长文案/多状态断言：

- 构造超长上一节点压力、超长 build plan reason、两条超长路线 preview。
- 断言 HUD adapter 输出被压成短 token。
- 断言 route button 仍只用 `复核+1 · 偏修补`、`MP+1 · 偏终结` 这类短后果 token。

## 边界

- 未改 sim/runtime/reward。
- 现有 runtime 还没有精确的上一节点压力对象时，HUD fallback 是“可读估算”，不是新的平衡规则。
- QA 仍作为门禁：是否横向溢出、是否隐藏关键 token，应由现有浏览器 QA 继续兜底。
