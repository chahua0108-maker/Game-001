# 2026-05-18 Expert Lens 10 - Web Performance / Platform / Shipping

当前提交：`b24b262`

范围：只审阅本轮指定文件，不启动浏览器，不启动 dev server，不改运行时代码。主要证据来自：

- `prototype-web/src/presentation/renderer/corridorRenderer.ts`
- `prototype-web/src/style.css`
- `prototype-web/package.json`
- `prototype-web/vite.config.ts`
- `outputs/browser-qa/redline-hyperturn/2026-05-18/README.md`
- `.gitignore`

## 28. WebGL / Three.js 性能工程师

### 当前判断

当前 WebGL 画面在桌面和一次 390x844 移动截图上已经不是空白场景，且渲染内容量级偏小，短时 smoke 能支撑。但它还不能被视为低端机 / 移动浏览器稳定方案：最大问题不是单帧三角形数量，而是对象生命周期、纹理生成、DPR/抗锯齿策略和长期运行内存增长还没有性能预算。

### 10 个镜头观察

1. `WebGLRenderer({ canvas, antialias: true })` 固定开启抗锯齿，随后 `setPixelRatio(Math.min(window.devicePixelRatio, 2))` 把高 DPR 限到 2；这比无限 DPR 安全，但对低端 Android 来说，DPR 2 + MSAA 仍可能是明显成本。
2. `resize()` 使用 canvas client size 或 window size，并调用 `renderer.setSize(width, height, false)`；这能保持固定 canvas 外观，但没有移动端 DPR 降级、横屏短高场景降级或 visibility pause 逻辑。
3. corridor 静态场景有地面、双墙、多条横线、slot ring、lane line 和 rail line；数量不大，短期可以接受，但 ring 段数偏慷慨，例如 burst ring 80 段、slot ring 40 段。
4. 敌人 geometry/material 在 spawn 时按敌人创建；当前网格规模小还可控，但没有缓存共享 geometry，敌人类型越固定，越应该复用类型级 geometry/material baseline。
5. 死亡敌人只做 `visible = false` 和 opacity 归零，没有从 scene/map 删除，也没有 dispose body/hp/label material、geometry、texture；多轮战斗后会形成稳定增长的不可见对象池。
6. 每个敌人创建一个 256x96 canvas label texture，HP 改变时 dispose 旧 map 再创建新 texture；资源释放相对谨慎，但 HP 高频变化会把 Canvas2D 绘制和纹理上传推到主线程。
7. `seenPresentationEvents` 是不清理的 Set，key 包含 type/trace/tick/target；长局、debug events 增长或多轮重开后会持续占内存。
8. 每帧对每个 mesh 用 `snapshot.enemies.some(...)` 查 alive 状态，是 O(meshes * enemies)；当前敌人数少无碍，但和未清理死亡 mesh 叠加后会慢慢变差。
9. `spawnSlash()` 每次命中都创建 BufferGeometry、LineBasicMaterial 和 Line；它有按 duration 回收 dispose，短 VFX 可以接受，但 clear/all-enemies 会瞬间放大 draw/update 压力。
10. burst 背景每帧用 `this.baseBackground.clone().lerp(...)` 分配新 Color；这不是主瓶颈，但属于移动端可轻易避免的帧内分配。

### 最大风险

长期运行和多轮 playtest 后，死亡敌人、label texture、event Set、resize listener 等生命周期没有明确回收策略，会把“短时 smoke 通过”变成“低端机越玩越卡、越重开越不稳定”。如果下一轮只继续加 VFX/HUD，性能风险会被掩盖到后期才暴露。

### 下一轮最小改动

1. 给 `CorridorRenderer` 增加明确的对象生命周期：死亡动画结束后 remove + dispose + `enemies.delete(id)`。
2. 增加低端渲染 profile：移动端或低性能模式下关闭 antialias，DPR clamp 到 1 或 1.25，并保留桌面高质量路径。
3. 把敌人 geometry 和静态 ring/line geometry 做类型级复用；label texture 只在可见或 HP 变化需要时更新。
4. 给 `seenPresentationEvents` 设置随 tick 或事件窗口清理的上限。
5. 把 burst 背景 lerp 改成复用 Color，减少帧内分配。

### 验收方式

- 不用“是否能打开”作为性能验收，只接受 3-5 回合连续运行后的指标。
- 桌面和 390x844 移动各记录至少一次：renderer info、scene object 数、texture 数、heap 趋势、平均帧间隔和最长帧。
- 反复击杀/奖励/重开后，scene object、texture、event Set 不应单调增长。
- 低端 profile 和默认 profile 都要截图确认画面非空、UI可读、VFX 没有被降级到误读。
- QA README 里已有 smoke 证据只能证明首轮可见；下一轮需要补“长局 + 低端 profile”证据。

## 29. 输入 / 平台兼容工程师

### 当前判断

CSS 已经有明显移动端适配意识：HUD 默认 `pointer-events: none`，按钮启用 `touch-action: manipulation`，390x844 截图 smoke 标记为可读。但它还不是完整移动平台通过：当前证据里移动端只做了视觉截图，单 tap、一致命中、短高视口、safe-area、hover-only 状态和浏览器差异还没有被证明。

### 10 个镜头观察

1. `body` 设置 `overflow: hidden`，`#app/#game-canvas/#hud` 全部 fixed inset 0，适合游戏全屏，但没有使用 `100dvh` 或 safe-area inset，移动浏览器地址栏和底部手势区可能改变可用高度。
2. `button { touch-action: manipulation; user-select: none; }` 是正确的触摸基础设置，能降低双击缩放和误选文本风险。
3. HUD 统一 `pointer-events: none`，再对 status、deal、enemy target、reward、card、debug 等可交互元素打开 pointer-events；这能避免透明 HUD 大层吞掉 canvas 输入，是当前平台兼容的正向设计。
4. 多个关键反馈依赖 `:hover`，例如 enemy-slot、reward-card、card-button hover；触摸设备没有 hover，只能依赖选中态、文本态和 active 态。
5. 390px 宽下 status strip 会隐藏 xp、phase、pile 和 status button；如果 status button 承载 restart/debug，移动端会少一个恢复入口，需产品确认是不是刻意取舍。
6. 移动端 card row 从 6 列变 3 列再到 2 列，卡牌高度 82px，基础点击面积足够；但 enemy slot 在 640px 下最小高度降到 28px，如果这些 slot 是目标按钮，则低于常见触摸命中面积。
7. `card-row` 固定 bottom 10px，没有 `padding-bottom: env(safe-area-inset-bottom)`；iPhone/Android 手势导航底部可能压住最后一排卡牌或造成误触。
8. 移动端 QA 记录显示 390x844 视觉可读、卡费未裁剪、关键文本可读；但 M-08 单 tap 和 M-06 End Turn resolution 都是 `not run`，平台输入仍是未验收状态。
9. debug panel 在 980px 以下隐藏，是正确的优先级取舍；它降低了移动 HUD 遮挡和滚动容器抢焦点的风险。
10. 大量半透明面板使用 `backdrop-filter: blur(10px)`；Safari 支持较好，部分 Android/Firefox 表现和性能不同，低端机上可能导致掉帧或视觉退化。

### 最大风险

移动端现在只有“看起来能读”的证据，没有“手指操作能稳定完成一轮”的证据。最容易漏掉的是：一次 tap 触发两次/没有触发、底部安全区遮挡卡牌、短高视口上方面板和卡牌区域互相挤压、hover 态在触摸屏不可替代。

### 下一轮最小改动

1. 把移动端验收从截图补成真实 tap 路径：选目标、出牌、End Turn、奖励选择、重开或继续。
2. 为底部卡牌区和主要按钮加入 safe-area 预算，并确认 360x740、390x844、430x932、横屏短高至少不遮挡。
3. 给 targetable enemy slot 提供不依赖 hover 的 touch-visible selected/pressed 状态。
4. 如果移动端隐藏 status button，明确它承载的功能是否有替代入口。
5. 为 `backdrop-filter` 增加降级策略或低端模式样式开关。

### 验收方式

- 使用真实移动 viewport 做 3-5 turn 手动或自动 tap run，而不是只截首屏。
- 记录每次 tap 的目标元素、前后状态、是否单次触发、是否需要二次点击。
- 390x844 以外补两个边界：小安卓 360x740 和带手势区的 iPhone 尺寸。
- 验收必须覆盖 targetable enemy slot、card button、End Turn、reward card、game over/restart。
- 浏览器差异至少分 Chromium 与 WebKit；如果暂时没有 WebKit 自动化，文档要标注未覆盖。

## 30. 构建 / 交付工程师

### 当前判断

构建链足够简单：Vite + TypeScript + Vitest + Three，`package-lock.json` 存在，可复现性基础是好的。交付上的主要风险不是依赖复杂，而是 QA 证据目录被 `.gitignore` 忽略、Vite build 没有性能预算/产物检查、QA README 仍有未跑项，容易出现“代码能 build，但交付证据不随提交走”的断层。

### 10 个镜头观察

1. `package.json` 只有 `dev`、`build`、`test`、`test:watch` 四个脚本，入口清晰，worker 和主线程都容易复现。
2. `build` 是 `tsc && vite build`，能先拦 TypeScript 错误，再生成产物；这是当前交付底线。
3. `test` 是 `vitest run`，Vite config 的 test include 限定在 `src/tests/**/*.test.ts`，测试范围明确，但没有把 browser smoke 或 build smoke 串成一条 release command。
4. 运行时依赖只有 `three`，dev 依赖是 `@types/three`、`typescript`、`vite`、`vitest`；bundle 复杂度低，供应链面小。
5. `package-lock.json` 存在且 lockfileVersion 3，说明 npm install 路径可复现；这比只有 semver range 的 package.json 更可靠。
6. `vite.config.ts` 只配置 test environment/include，没有 build target、base、manualChunks、sourcemap、chunkSizeWarningLimit 或 bundle analyzer；目前没有产物体积和浏览器目标边界。
7. `.gitignore` 忽略 `dist/`、`coverage/`、`.vite/`、`node_modules/`，这符合源码交付；但也忽略 `outputs/browser-qa/`。
8. QA README 记录的 smoke 证据位于 `outputs/browser-qa/redline-hyperturn/2026-05-18/`，正好落在被忽略目录；主提交不会自动带上截图和 metrics。
9. QA README 自身显示桌面 smoke 有 chain/payoff/end-turn 证据，但 break、repair、reward response 未跑；移动端主要是视觉 pass，tap 和 end-turn resolution 未跑。
10. QA README 还记录旧 realtime 90s 标准不可作为当前 hyper-turn 验收，这对交付很重要：后续 release note/PR 描述必须避免混用旧指标。

### 最大风险

提交边界会把“代码/设计文档”和“QA 证据”分离：`outputs/browser-qa/` 被忽略导致证据不会进入提交，而当前 design 目录里又没有一个随提交稳定存在的 QA 摘要副本。后续看提交的人可能只看到 smoke 结论，看不到原始截图/metrics，也看不到未跑项。

### 下一轮最小改动

1. 保留 `outputs/browser-qa/` 作为本地原始证据，但在 `design/technical/redline-batches/` 增加提交内 QA 摘要，列出证据文件名、pass/partial/not run、未覆盖项和本地路径。
2. 增加一个不启动浏览器的交付脚本或文档命令顺序：`npm ci`、`npm run test`、`npm run build`。
3. 在 build 后记录 Vite 输出 bundle size，并给 Three 主 chunk 一个预算线。
4. 明确当前 browser support baseline：Chromium-first、Safari/WebKit 是否进入本轮、Firefox 是否只是 later。
5. 把 hyper-turn 的验收标准从 README 摘到可提交设计文档，避免旧 90s 标准回流。

### 验收方式

- 主线程或交付 worker 在最终提交前跑 `npm ci`、`npm run test`、`npm run build`，并把命令结果写入提交内 QA 摘要。
- QA 证据本体可以继续本地忽略，但提交内必须有可追踪摘要：日期、commit、viewport、pass/partial/not run、截图/metrics 文件名。
- Vite build 输出需要记录 JS/CSS 体积；如果 Three chunk 超过预算，必须标注原因或拆分计划。
- 每次验收都确认 `.gitignore` 没有误把应提交的 design/technical 文档忽略。
- 交付描述必须只引用 hyper-turn 标准，不再引用已废弃 realtime 90s pass 条件。

## 优先级建议

1. 先修对象生命周期：死亡敌人、label texture、scene object、event Set 必须可回收，否则低端机长局风险最大。
2. 把移动 QA 从截图升级到真实 tap run，优先覆盖 card、target、End Turn、reward、restart。
3. 增加低端渲染 profile：DPR/antialias/backdrop-filter 要有降级路径，而不是只靠默认桌面质量。
4. 建立提交内 QA 摘要，解决 `.gitignore` 忽略原始 browser QA 证据后的可审计性断层。
5. 给 `npm ci -> npm run test -> npm run build -> bundle size 摘要` 固化为下一轮交付门槛。
