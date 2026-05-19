# 2026-05-19 第18轮汇总：连续节点压力闭环

## 1. 本轮目标

第 18 轮只做一个核心切片：连续 `3-5` 节点 run 复测，让污染、失败压力、路线风险和 build plan 演变进入真实可玩链路。

官方核心体验分从 `86 / 100` 提升到 `95 / 100`。QA 只作门禁，不计分。

## 2. 已落地

- `RunState` 增加 `pressure` 局内记录，记录节点压力、路线压力、HP 损失和污染注入，不进入局外成长。
- 高压路线进入下一节点时造成可测 HP 压力，并尝试加入 `static_overload`，重复高压不无限叠 Max MP。
- build plan 增加最近奖励、路线、强化和污染分布证据，能从补桥转向补资源或清污染。
- 奖励回应新增 pressure signal/order，在污染、终结、桥、资源组合压力下轮转候选，避免同类提示双重加权。
- HUD 增加压力时间线：上一节点压力、当前构筑问题、下一战路线后果保持短 token，移动端不隐藏关键 meta。
- 新增 `ash_filter`、`toll_shunt`、`last_light_cache` 三张原创奖励牌，服务清污染、补桥和坏手救场。
- `qa:similarity` 增加 `QA_JOURNEY_NODES` 和 journey gate，默认复测两次 `reward -> route -> next battle`，覆盖 3 个节点。

## 3. 验收结果

- 聚焦测试：第 18 轮 6 个测试文件全部通过，`20 passed`。
- `npm run check`：`199 passed / 2 skipped`，build 通过；仅保留 Vite chunk size warning。
- `QA_ROUND=round-18-main QA_PORT=5176 npm run qa:lifecycle`：通过，`gateScore 20 / 20`。
- `QA_ROUND=round-18-main QA_PORT=5177 QA_JOURNEY_NODES=3 npm run qa:similarity`：通过，`gateScore 32 / 32`，`journeyGate=pass`。
- `QA_ROUND=round-18-main QA_PORT=5178 npm run qa:ui`：通过，`gateScore 20 / 20`。
- 三个浏览器 QA 都完成 page/context/browser/server 清理，`pidAlive=false`、`portListening=false`。

## 4. 核心体验裁决

第 18 轮的加分来自核心体验本身，而不是 QA：

```text
节点1暴露问题 -> 奖励/路线形成计划 -> 节点2验证并施压 -> 节点3因污染/路线风险调整计划
```

现在玩家可以在同一次冒险内看到路线风险造成 HP/污染代价，build plan 会随奖励、路线和污染证据变化，奖励也会针对组合压力给出修正方向。短 run 不再只是“可点击路线”，而是有可复测的压力闭环。

本阶段达到停止线 `95 / 100`。后续不继续自动追加第 19 轮，除非真实玩家复测证明核心体验回落。

## 5. 后续处理

下一步不再堆系统，建议只做：

- 真实玩家试玩记录：验证 3 节点压力是否读得懂、是否过早显得拥挤。
- 小修 UI 文案：减少 debug 信息密度，把失败原因更像玩家复盘语言。
- 若要扩到 5 节点，再开新阶段，不混入本轮停止条件。
