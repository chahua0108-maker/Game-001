# Game-001 Web Prototype 战场表现 / 可读性 / 5 槽阵列 QA

审计时间：2026-05-17 17:45 HKT

审计范围：

- `prototype-web/src/presentation/renderer/corridorRenderer.ts`
- `prototype-web/src/ui/hud.ts`
- `prototype-web/src/style.css`
- 本地页面：`http://127.0.0.1:5173/`

验证方式：

- 启动 `npm run dev -- --host 127.0.0.1`
- Chrome headless + SwiftShader 通过 CDP 截图
- 桌面视口：`1440x900`
- 移动视口：`390x844`

截图证据：

- [桌面初始 15 槽](screenshots/battlefield-readability-01-desktop-initial-15slots.png)
- [桌面第一次命中后](screenshots/battlefield-readability-02-after-first-hit.png)
- [桌面击杀后空槽](screenshots/battlefield-readability-03-kill-empty-slot.png)
- [桌面死亡淡出后](screenshots/battlefield-readability-04-post-death-fade.png)
- [桌面结束回合补位后](screenshots/battlefield-readability-05-after-refill.png)
- [移动端初始](screenshots/battlefield-readability-06-mobile-initial.png)

## 总体结论

当前实现已经不是“一排 3 个”，代码与 HUD 都按 `ENEMY_COLUMNS = 5`、`ENEMY_ROWS = 3` 渲染，初始与补位后能形成 15 个怪物槽。问题在于：玩家第一眼更容易读到左上角 HUD 表格，而不是战场中的 5 槽阵列；3D 场景里后排、血量、补位和新怪进场都不够清楚。若目标是更接近对标产品的完整复刻，当前版本还需要把“整齐堆满的怪物阵列”从调试式 HUD 信息提升为场景主体信息。

## 发现列表

### P0 - Headless 默认 WebGL 会直接空屏，QA 与回归不稳定

玩家视角：在默认 headless Chrome 截图时，页面只显示深色背景，HUD 不渲染。原因是 `THREE.WebGLRenderer` 创建 WebGL context 失败，主循环在构造 `CorridorRenderer` 时中断。

截图 / 复现：

- 复现命令：默认 headless Chrome 打开 `http://127.0.0.1:5173/`
- Console 报错：`THREE.WebGLRenderer: Error creating WebGL context.`
- 本次可用截图是加了 `--enable-unsafe-swiftshader --use-gl=swiftshader --ignore-gpu-blocklist` 后得到的。

最小修正：

- presentation 层加 WebGL 创建失败兜底：至少让 HUD 与错误提示继续渲染，不要因为 `new WebGLRenderer` 失败导致整个 demo 空屏。
- QA 脚本固定使用 SwiftShader 或可见浏览器，并把 WebGL context 检查作为 smoke test。

### P1 - 5 槽阵列在 HUD 中清楚，但在战场主体中不够“一眼可见”

玩家视角：左上 HUD 的 5x3 表格非常清楚；3D 场景里虽然有 5 个前排身体、5 条列线和圆形槽位，但怪物身体、血环、标签互相挤压，后排被前排遮挡，玩家更像是在看一团怪物，而不是整齐堆满的 5 槽阵列。

截图 / 复现：

- [桌面初始 15 槽](screenshots/battlefield-readability-01-desktop-initial-15slots.png)
- [桌面结束回合补位后](screenshots/battlefield-readability-05-after-refill.png)
- 复现：打开页面等待自动发牌，观察中央战场。HUD 显示 15 槽满员，但 3D 主画面只能稳定读出前排 5 个，后排关系需要靠 HUD 才能确认。

最小修正：

- 在 3D 场景中强化 5 列槽位：给每列加更明显的地面格框、列编号或前排底座高亮。
- 降低血环的横向重叠，或把血量 UI 改到每个怪物上方的小条，避免 5 个 ring 在同一水平面形成一片粉色噪声。
- 轻微拉开 `SLOT_STEP_X` 或调整相机 FOV / 视角，让 5 列和后排间距更可读。

### P1 - “完全堆满”不是持续状态，击杀后玩家回合内会出现空槽

玩家视角：击杀第一个怪后，左上 1-1 立刻变成“空槽 / 补位中”，中央场景也少一个前排目标。若用户期望当前 demo 始终是堆满阵列，这个状态会被读成“没有完全复刻”。

截图 / 复现：

- [桌面击杀后空槽](screenshots/battlefield-readability-03-kill-empty-slot.png)
- 复现：开局自动发牌后，点 `Debt Hook`，再点 `Redline Cut` 击杀 1-1。此时 HUD 显示 `1-1 空槽 补位中`，直到点 `结束回合` 才重新填满。

最小修正：

- 如果设计要求“始终满阵列”，需要运行时在击杀后立即 compact/fill；这会触碰 `sim/runtime`，本次不改。
- 如果设计允许回合内空槽，presentation/ui 至少要把空槽表现为“正在补入的新怪占位”，例如半透明 incoming silhouette、倒计时或箭头推进，而不是普通空槽。

### P1 - 前后排 / 队列关系主要靠 HUD 表格，不靠战场本体

玩家视角：HUD 用 `1-1` 到 `3-5` 表达了行列，但中央战场没有明确的“第 1 排 / 后排队列”语义。前排 label 只显示第一排，后排没有标签；后排怪物被身体和血环遮挡后，只能看出颜色块，不能确认队列顺序。

截图 / 复现：

- [桌面初始 15 槽](screenshots/battlefield-readability-01-desktop-initial-15slots.png)
- [移动端初始](screenshots/battlefield-readability-06-mobile-initial.png)

最小修正：

- 场景地面增加三条横向 row band：`Front`、`Queue 2`、`Queue 3`，或用不同亮度区分前排和后排。
- 后排怪物可以减少标签密度，但应保留排位提示，例如小型 row marker、地面投影或队列箭头。
- HUD 的 `.enemy-slot.front-row` 与 `.queue-row` 需要文字层级：加“前排”和“后备”分组标题，比只靠描边更直观。

### P2 - 怪物种类能区分，但移动端名称和战场形状仍然不够稳定

玩家视角：三类怪物有颜色、形状、HUD badge：`WSP`、`BRU`、`COL`。桌面可区分；移动端由于槽位变窄，名称被截成 `Redline...`、`Pulse C...`，玩家主要只能靠三字母 badge 和颜色判断。中央战场里红色小球与粉色大型多面体有区别，青色 collector 也明显，但后排被遮挡时类型识别下降。

截图 / 复现：

- [桌面初始 15 槽](screenshots/battlefield-readability-01-desktop-initial-15slots.png)
- [移动端初始](screenshots/battlefield-readability-06-mobile-initial.png)

最小修正：

- 移动端 HUD 槽位优先展示 `type badge + HP`，名称可以缩到第二层或 tooltip，不要把核心信息挤成省略号。
- 3D 怪物加更强的剪影差异：brute 更宽、更低，collector 更高，wisp 更小并加浮动/拖尾，减少只靠颜色。

### P1 - 血条不能直觉读懂，当前更像装饰 ring

玩家视角：HUD 槽内 `10/10`、`22/22` 是可读的；中央 3D 的血量用 torus 缩放，受透视和重叠影响，看起来像一排粉色/青色光环，不像“血条”。被打到 `6/10` 后，玩家仍需要看上方 label 或 HUD 才能确认血量变化。

截图 / 复现：

- [桌面第一次命中后](screenshots/battlefield-readability-02-after-first-hit.png)
- 复现：开局点击 `Debt Hook`，前排 Debt Wisp 从 `10/10` 变 `6/10`。3D 场景里 ring 缩放的反馈弱，数字 label 才是主要信息。

最小修正：

- 将 3D hp ring 改为面向摄像机的短横条：背景条 + 当前血量填充 + 受击闪白。
- 若继续保留 ring，至少改为弧形缺口而不是整体缩放，否则缩小后像位置/透视变化，不像扣血。

### P2 - 死亡 / 补位 / 新怪进场事件明确写在战斗信息里，但场景动画不够明确

玩家视角：右上战斗信息会显示“击杀”“敌群补位完成，后排压上”。但中央场景里死亡淡出很短，击杀后前排只是空了；点结束回合后怪物位置变了、血量重置了，但新怪是谁、从哪里进场、哪些怪补位不够明确。战斗信息还会连续出现两条“敌群补位完成，后排压上”，玩家可能以为发生了两次补位。

截图 / 复现：

- [桌面击杀后空槽](screenshots/battlefield-readability-03-kill-empty-slot.png)
- [桌面死亡淡出后](screenshots/battlefield-readability-04-post-death-fade.png)
- [桌面结束回合补位后](screenshots/battlefield-readability-05-after-refill.png)

最小修正：

- 死亡增加更明确的短爆点、残影或地面碎裂，而不只是 0.5 秒淡出。
- 补位时给移动路径加箭头/拖影；新怪进场从后排或远端滑入，并在 HUD 对应槽位短暂高亮。
- Combat feed 合并重复的 `EnemiesRepositioned` 文案，区分“压上”和“补新怪”。

### P1 - HUD 在桌面可用但抢战场主体，移动端明显遮挡

玩家视角：桌面左上 15 槽表格、右上战斗信息、底部 6 张卡占据大量屏幕；中央战场主体只剩中间带状区域。移动端更严重：状态条、回合面板、15 槽、target chip、卡牌几乎从上到下铺满，战场只露出中间一条，target chip 直接压在场景上方。

截图 / 复现：

- [桌面初始 15 槽](screenshots/battlefield-readability-01-desktop-initial-15slots.png)
- [移动端初始](screenshots/battlefield-readability-06-mobile-initial.png)
- DOM 记录：移动端 `.card-row` 从 `y=429.5` 到底部，`.target-chip` 位于 `y=306`，正好夹在槽位和战场主体之间。

最小修正：

- 桌面：把 15 槽 HUD 改成更薄的战场 overlay 或可折叠侧栏，让中央 3D 阵列成为第一信息源。
- 移动端：敌方槽位改为横向可扫视的 compact strip，卡牌降低高度或改为手牌抽屉；target chip 合并进前排目标槽，而不是悬浮压场景。
- Debug Trace 默认折叠是对的，但右侧 combat feed 也应在战斗主体压缩时自动降权。

## 逐项验收判断

| 检查项 | 当前判断 | 说明 |
| --- | --- | --- |
| 5 槽是否一眼可见 | 部分通过 | HUD 一眼可见，3D 战场不够清楚。 |
| 是否不是一排 3 个而是 5 个 | 通过 | `ENEMY_COLUMNS = 5`，前排 5 个、HUD 5 列。 |
| 是否完全堆满 | 部分通过 | 初始与补位后 15 槽满；击杀后玩家回合内会空槽。 |
| 前后排 / 队列关系是否清楚 | 未通过 | 主要靠 HUD 行列编号，战场主体不清楚。 |
| 怪物种类是否能区分 | 部分通过 | 桌面可区分；移动端与后排拥挤时下降。 |
| 血条是否能看懂 | 未通过 | 数字可读，3D hp ring 不像血条。 |
| 死亡 / 补位 / 新怪进场是否明确 | 未通过 | 文案有，场景反馈弱，补位文案重复。 |
| HUD 是否遮挡战场 | 未通过 | 桌面抢主体；移动端明显遮挡。 |

## 建议优先级

1. 先把战场主体改成真正可读的 5x3 阵列：槽位底座、行列分层、血条去重叠。
2. 再处理击杀后的“空槽”语义：要么运行时立即补满，要么 UI 明确这是 incoming 占位。
3. 最后压缩 HUD：让 HUD 服务战场，而不是替代战场。

## 本次是否改码

未改码。只新增 QA 报告与截图证据。
