# 第10轮专家08：Git / 工作树 / 发布准备审计

审计时间：2026-05-19 01:16 HKT  
审计范围：`/Users/roc/Game-001` 当前工作树、未跟踪文件、变更范围、提交切分与发布准备风险。  
执行边界：只读检查为主；未提交、未回滚、未修改代码；本文件是唯一新增审计输出。

## 当前结论

当前不建议直接提交整棵工作树。原因不是测试失败，而是变更同时包含文档批次、原型运行时、HUD/UI、测试、QA 脚本和生成输出策略，适合先做提交切分和人工确认。

已验证命令：

- `git status --short --branch`：`main...origin/main [ahead 2]`，工作树 dirty。
- `git diff --stat`：15 个已跟踪文件变更，约 `2004 insertions(+), 183 deletions(-)`。
- `git ls-files --others --exclude-standard`：存在大量未跟踪文档、脚本、新 sim 模块和新测试。
- `npm run check`：通过。Vitest `14 passed | 1 skipped`，`118 passed | 2 skipped`；`tsc && vite build` 成功。
- Build 警告：Vite 输出 `dist/assets/index-*.js` 约 `545.15 kB`，超过 500KB chunk warning。

## 发布准备镜头

### P0-01 Dirty Worktree 阻断发布

现状：`main` 分支相对 `origin/main` 已 `ahead 2`，并且仍有已跟踪修改与未跟踪文件。  
风险：如果现在直接发布或打包，很难区分已提交的前两次本地提交、当前未提交代码、以及未跟踪文档/测试分别贡献了哪些行为。  
建议：不要用“全量 add + commit”一次性收口；先完成提交切分和变更归属确认。

### P0-02 未跟踪文件数量过大

现状：未跟踪文件包括 `design/technical/redline-batches/` 顶层 20+ 文档、`long-task/` 约 100 个专家轮次文档、`prototype-web/scripts/qa-ui.mjs`、3 个新 sim 模块、8 个新测试文件。  
风险：未跟踪文件不会进入普通 diff 审查，最容易在提交时漏掉关键源文件或误带文档批量输出。  
建议：先按目录和功能分组 staging，不要依赖 IDE 的单次全选。

### P0-03 代码变更不是单点补丁

现状：核心代码改动覆盖 `runtime.ts`、`types.ts`、`world.ts`、`snapshot.ts`、`cards.ts`、`redlineRules.ts`、`hud.ts`、`style.css`。  
风险：这是系统级原型推进，包含卡牌元数据、授权 MP、payoff、run progression、reward choices、HUD 读取与移动端样式，不应当按“文档补充”提交。  
建议：代码至少拆成“模拟运行时与数据模型”和“HUD/UI 呈现”两个可审查单元。

### P0-04 新模块必须和调用方一起提交

现状：`runtime.ts` 引入了未跟踪的 `rewardChoices.ts`、`rewardProgression.ts`；工作树还存在未跟踪 `runModifiers.ts`。  
风险：如果只提交已跟踪修改而漏掉新模块，构建会在其他机器上失败。  
建议：提交代码切片时显式包含所有新增 sim 模块，并在提交前重新跑 `npm run check`。

### P1-05 测试证据可用但不完整

现状：`npm run check` 已通过：118 个测试通过、2 个跳过，生产构建成功。  
风险：UI 浏览器 QA 脚本未在本次审计中运行；Vite chunk size warning 未处理。当前证据能支撑本地原型检查，不足以支撑“视觉/移动端无回归”的发布结论。  
建议：提交前补一条 `npm run qa:ui` 结果，或者在提交说明中明确 UI QA 未跑。

### P1-06 生成输出策略基本正确

现状：`prototype-web/dist/`、`prototype-web/test-results/` 在本地存在，但被 `.gitignore` 覆盖；`outputs/browser-qa/` 也被根 `.gitignore` 忽略。  
风险：当前生成输出没有污染 git 状态；但 QA JSON 默认写入 `outputs/browser-qa/round-09/qa-ui-result.json`，后续如果改路径需要重新确认 ignore。  
建议：目前不需要提交生成输出。

### P1-07 暂不需要修改 `.gitignore`

现状：根 `.gitignore` 已覆盖 `node_modules/`、`dist/`、`coverage/`、`.vite/`、日志、临时文件、`test-results/`、`outputs/browser-qa/`；`prototype-web/.gitignore` 也覆盖常见 Vite 输出。  
风险：没有发现应忽略但仍暴露在 `git status` 的生成产物。  
建议：本轮不建议改 `.gitignore`。未跟踪的 Markdown、源码、测试、脚本看起来是应审查内容，不应靠 ignore 隐藏。

### P1-08 文档批次应独立提交

现状：`design/technical/redline-batches/` 包含研究、范围评审、QA、实现交接、专家综合和 long-task 批量文档。  
风险：把 100+ 文档和 runtime/HUD 代码混在一个提交里，会让回滚、review、后续归档都变困难。  
建议：文档按“顶层 redline 研究/综合文档”和“long-task 专家轮次文档”拆分，或者至少和代码提交分开。

### P1-09 提交切分建议

建议提交顺序：

1. 文档基线：`design/technical/redline-batches/*.md`，不含 `long-task/`。
2. long-task 专家批次：`design/technical/redline-batches/long-task/*.md`，包含本审计文件。
3. 核心 sim/runtime：`prototype-web/src/sim/*`、`world.ts`、`snapshot.ts`、`types.ts`、`runtime.ts`、相关 sim tests。
4. 卡牌数据和规则：`prototype-web/src/data/cards.ts`、`prototype-web/src/eca/redlineRules.ts`、卡牌分类/授权/纸牌破碎/topdeck/progression tests。
5. HUD/UI/样式：`prototype-web/src/ui/hud.ts`、`prototype-web/src/style.css`、`index.html`、UI tests。
6. QA 脚本与 npm scripts：`prototype-web/package.json`、`prototype-web/scripts/qa-ui.mjs`，确认不需要改 `package-lock.json` 后再提交。

### P1-10 `package.json` 改动需要说明

现状：新增 `dev:qa`、`check`、`test:sim`、`test:ui`、`qa:ui` scripts；`package-lock.json` 未变化。  
风险：如果评审者只看 lockfile，会误以为没有工具链变化；实际上发布/QA 命令入口已经改变。  
建议：把 npm scripts 单独放入 QA/工具提交，提交说明写清楚没有新增依赖，所以 lockfile 不变。

### P2-11 回滚风险集中在共享类型

现状：`CardDefinition`、`PlayerState`、`WorldState`、`GameEvent`、`Command`、`GameSnapshot` 都扩展了字段。  
风险：这些类型是 runtime、HUD、测试共享边界；如果只回滚 UI 或只回滚 runtime，容易出现类型和行为不匹配。  
建议：回滚时按提交切分回滚，不要单文件回滚 `types.ts` 或 `hud.ts`。

### P2-12 分支状态需要用户决策

现状：当前仍在 `main`，且 `main` 已领先远端 2 个提交。  
风险：继续在 `main` 上积累大批未提交改动，会让“本地主干可发布状态”和“实验切片状态”混在一起。  
建议：如果要继续多人/多 agent 并行，应先从当前状态创建工作分支或完成本地切分提交；但本轮用户没有要求提交，所以只给建议不执行。

### P2-13 最终用户提示

建议在提交前让用户确认三件事：

- 这些 `redline-batches` 和 `long-task` 文档是否全部要进入仓库，还是部分只做本地过程记录。
- `prototype-web/scripts/qa-ui.mjs` 是否作为正式本地 QA 入口保留。
- 当前 `main` ahead 2 的两次本地提交是否已经准备好后续 push，还是先只做本地归档。

## 是否建议提交

不建议现在“一次性提交全部”。  
建议在用户明确要求提交后，按上面的 5-6 个提交切片分批提交，并在代码相关提交前后各跑一次 `npm run check`；若要把 UI QA 也纳入发布证据，再跑 `npm run qa:ui` 并记录结果。
