你正在被 AIRoc 自动长循环 runner 以干净上下文启动。不要依赖任何旧聊天记录；只从磁盘读取必要状态。

目标：Redline 多局核心体验达到 95/100；保持自动长循环、每轮干净上下文、每轮提交，普通迭代降低完整 10 玩家评分频率，但关键里程碑必须评分。
目标分：95/100
工作区：/Users/roc/Game-001
循环状态目录：/Users/roc/Game-001/.codex/auto-loop
本轮编号：4
最大轮数：5

必须执行的协议：

1. 使用 AIRoc 的 core-experience-loop / $air-loop 规则，但本次 Codex exec 只执行一轮，不要在同一个会话里无限继续。
2. 先读取：
   - /Users/roc/Game-001/.codex/auto-loop/state.json
   - /Users/roc/Game-001/.codex/auto-loop/handoff.md
   - 当前 git status / 最近提交
   - 本轮真正需要的少量 spec、测试、代码片段
3. 本轮只选择一个核心体验切片。主线程保持 PM / 集成监督角色；重体力工作交给 worker 或用清晰的单轮任务完成。
4. 质量门禁不能省：聚焦测试、必要的 full check/build、必要的浏览器 QA 与清理、本轮文档/评分更新、本地提交。确实无法提交时要写明阻塞原因。
5. 不要把 QA、文档、自动化数量计入 coreScore。coreScore 只代表玩家核心体验。
6. 不要回滚用户或其他 agent 的无关修改。只 stage 本轮文件，排除 .codex、临时 QA 输出、build 输出和无关脏文件。

token / 输出硬约束：

- 禁止一次性读取大文件或长测试文件。不要使用 `cat <file>`、`sed -n '1,260p'`、`sed -n '1,400p'`、无约束 `git diff`、无约束 `rg`。
- 每次读取文件默认不超过 120 行；优先用 `rg -n <pattern>` 找到行号，再用 `sed -n '<start>,<end>p'` 读局部。
- 任何可能超过 8KB 的命令输出必须重定向到日志文件，再用 `wc -l`、`tail -n 80`、`rg -n` 摘要读取。
- 需要理解大模块时，先读测试名、导出符号、函数名和附近 60-100 行，不要把整文件塞进上下文。
- 如果因为上下文不足无法安全完成本轮，不要扩大读取范围；把 `state.json` 写成 `status="blocked"`，说明缺什么。
- 每轮结束前的最终回复不超过 20 行；细节写入 loop 目录或项目文档。

7. 本轮结束前必须更新这些文件：
   - /Users/roc/Game-001/.codex/auto-loop/state.json
   - /Users/roc/Game-001/.codex/auto-loop/handoff.md
   - /Users/roc/Game-001/.codex/auto-loop/next-prompt.md
8. state.json 必须保持合法 JSON，并至少包含：
   - version: 1
   - status: "continue" | "stopped" | "blocked"
   - workspace
   - goal
   - targetScore
   - round
   - maxRounds
   - coreScore
   - gateStatus
   - continue
   - stopReason
   - nextHypothesis
   - lastCommit
   - lastRunAt
   - openIssues
   - artifacts

停止/继续规则：

- 如果 coreScore >= targetScore 且必要门禁通过：status="stopped", continue=false。
- 如果遇到需要用户方向决策、测试无法通过、git 状态无法安全提交、或者无法更新状态文件：status="blocked", continue=false，并写 stopReason。
- 否则：status="continue", continue=true，并在 nextHypothesis 写下一轮唯一切片。

最终回复只给 runner 看的简短摘要，不要输出长日志。