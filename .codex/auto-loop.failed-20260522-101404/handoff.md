# AIRoc Auto Loop Handoff

- Workspace: /Users/roc/Game-001
- Goal: Redline 多局核心体验达到 95/100；保持自动长循环、每轮干净上下文、每轮提交，普通迭代降低完整 10 玩家评分频率，但关键里程碑必须评分。
- Target score: 95
- Current round: 0
- Current coreScore: unknown
- Gate status: unknown
- Next hypothesis: Read the current repo state and choose the smallest core-experience slice.
- Last commit: f1e123e

## Git Status

```text
## main...origin/main
?? .codex/auto-loop/
```

## Open Issues

- None recorded.

## Runner Contract

The next clean Codex exec session must run exactly one AIRoc core-experience loop round, write durable results to this loop directory, update `state.json`, and then exit. The outer runner decides whether another clean session should start.
