# 2026-05-18 Round 07-03：HUD 短 Token 体系与信息架构压缩

角色：第 7 轮专家 03，HUD 信息架构压缩专家  
工作目录：`/Users/roc/Game-001`  
主题：真实整备 / reorder 与 UI 信息架构  
边界：只新增本文档；不改源码、不提交 git。

## 0. 结论

第 7 轮如果新增真实 `reorder`，不要再给手牌按钮、状态条或 Director 增加新长句。当前 HUD 已经把关键文本塞进固定高度和单行省略节点：手牌按钮 `98-102px` 高、手机横向 rail、奖励卡移动端 2 行 clamp、Director 单行 ellipsis、战斗日志 244px 宽。

P0 口径是：玩家可见层统一使用短 token；完整规则继续放 `title`、`detail`、debug 或未来详情层。`reorder` 对玩家统一叫 `整备`，只有运行时 / 测试 / debug 可以叫 `reorder` 或 `DrawPileReordered`。

## 1. 当前 Token 问题

### 1.1 同一概念有多套词

当前源码里同一概念混用了自然语言、机制词和 debug 词：

| 概念 | 当前可见词 | 问题 |
| --- | --- | --- |
| 临时授权 | `终局授权 +3`、`终局授权支付`、`需MP/终局授权`、`可用授权支付` | 状态、按钮、奖励规则各写一套；手机 chip 和卡牌按钮上偏长。 |
| 整备 / reorder | `整备/找牌`、`抽N 整备`、`整备找牌`、`重排` | 玩家可能把“整备”读成已经能手动重排，但 runtime 当前还只是标签；若新增真实 reorder，更需要区分状态。 |
| 修补 | `修补/抽牌`、`修补MPx xN`、`修补成功当前MP+1` | 角色、链路、收益混在一行；`修补/抽牌` 在 `.card-meta` 里占宽。 |
| 抽牌 | `抽1/3`、`抽N仍-X`、`抽N 整备` | 手机上 `card-effect` 会隐藏，不能把真实抽牌 / 整备只写在那里。 |
| 意图压力 | `结束回合 -X HP`、`仍-X`、`意图 X->Y`、`无当前意图` | Director、deal panel、卡牌预览长度差异大。 |

源码依据：

- `hudAuthorizationState` 生成 `终局授权 +N` 和较长 detail，渲染进 `.authorization-chip`。
- `hudCardRoleLabel` 对 reorder 返回 `整备/找牌`，对 repair draw 返回 `修补/抽牌`。
- `hudCardIntentPreview` 对无伤害牌返回 `抽N仍-X`，但不表达 reorder 结果。
- `cardEffectLabel` 在倍率大于 1 且带 reorder 时返回 `抽N 整备`，但手机端 `.card-effect` 被隐藏。
- `combatEventLabel(CardPlayed)` 已经压缩到 `出牌 X · xN · 抽N · MP+1`，但还没有 reorder 结果 token。

### 1.2 最脆弱的 UI 节点不是弹层，而是短行

CSS 已经决定了这些位置不能承载完整句：

| 节点 | 当前约束 | 新增 reorder 风险 |
| --- | --- | --- |
| `.status-strip` | 桌面左上 `max-width: calc(100vw - 304px)`；手机 4 列并隐藏 XP/FSM/牌堆/Restart。 | 不应新增 `reorder` chip；否则会挤压 HP/MP/授权/链路/意图。 |
| `.authorization-chip` | `strong/span` nowrap，`em` 手机隐藏。 | `终局授权 +3` 已接近上限，不能再追加“只支付3费终结牌”。 |
| `.combat-director` | 四格，`strong/em` 单行 ellipsis。 | 适合 `下抽终结`，不适合 `整备后把终结牌放到牌库顶`。 |
| `.deal-panel small` | 桌面 188px，手机 150px，单行省略。 | 只能写回合后果，不要写 reorder 状态。 |
| `.card-button` | 桌面 102px，手机 98px；所有主要文字单行省略。 | 不能新增一行，也不能把 `整备并寻找终结牌` 塞进现有行。 |
| `.reward-card` | 桌面三列，手机单列；`em` 手机 2 行 clamp。 | 奖励规则第一句必须先给动作和数值。 |
| `.combat-feed` | 桌面 244px 宽；移动端隐藏。 | 可以补 reorder 结果，但必须是单条短句，不列出完整牌名列表。 |

### 1.3 真实 reorder 的新增信息不应全部显示在手牌上

新增真实 reorder 至少会带来三个事实：

1. 这张牌会触发整备。
2. 现在整备了几张 / 是否等待确认。
3. 结果是什么：置顶终结、置顶路线、未命中、跳过。

这三件事不能全部进入 `.card-button`。手牌按钮只负责“打之前是否值得打”：费用、角色、链路、压力、抽几张。整备结果应由战斗日志 / Director / reorder pending 面板承载。

## 2. 统一词表

### 2.1 玩家可见机制词

| 内部概念 | 玩家短 token | 禁用或限制词 | 使用位置 |
| --- | --- | --- | --- |
| `reorder` | `整备` | `重排牌库`、`手动控顶`，除非真的进入确认 UI | 卡牌角色、奖励卡、Director、日志 |
| reorder pending | `整备中` | `正在重排抽牌堆顶部若干张牌` | pending 面板 / Director |
| reorder offered count | `整备3张` | `选择牌库顶部3张的顺序` | 日志 / pending 标题 |
| reorder success payoff | `顶终结` 或 `下抽终结` | `已将终结牌置于抽牌堆顶部` | 日志 / Director |
| reorder success route | `顶路线` 或 `下抽路线` | `已将路线牌置于抽牌堆顶部` | 日志 / Director |
| reorder miss | `整备无牌` | `没有找到可重排的目标牌` | 日志 / Director |
| reorder skip | `跳过整备` | `玩家跳过本次牌库重排选择` | 日志 / pending 面板 |
| draw | `抽N` | `抽取N张牌` | 卡牌、奖励、日志 |
| draw plus pressure unchanged | `抽N仍-X` | `抽N但不会降低敌人意图` | 手牌 `.card-intent-preview` |
| repair | `修补` | `修补/抽牌/返MP` 这种三段串 | 角色标签 |
| repaired chain | `修补MPx` | `修补费用缺口` | 链路预览 / 日志 |
| temporary MP | `MP+1` | `当前MP+1且不会提高最大MP` | 卡牌短反馈 / 日志 |
| authorization gained | `授权+3` | `终局授权 +3` 用于手机可见位时偏长 | 状态条 / 日志 |
| authorization payment | `授权付` | `终局授权支付` | 手牌支付状态 |
| missing authorization | `缺授权` | `需MP/终局授权` | 手牌缺费状态 |
| payoff | `终结` | `payoff` | 玩家可见层 |
| enemy intent | `意图`、`仍-X`、`X->Y` | `敌人当前攻击意图仍为` | 卡牌 / Director / 日志 |

### 2.2 卡牌角色词表

`roleLabel` 只保留主角色，不再把机制列表全塞进去。

| 当前角色 | P0 角色 token | 说明 |
| --- | --- | --- |
| `开链/抽牌` | `开链` | 抽牌数放 `card-intent-preview` / `effect`。 |
| `承接/抽牌` | `承接` | 同上。 |
| `展开/清前排` | `展开` | 目标 `前排` 已能表达范围。 |
| `整备/找牌` | `整备` | 找什么由奖励规则或结果日志表达。 |
| `修补/抽牌` | `修补` | 抽牌 / MP+1 是效果，不是角色。 |
| `终结` | `终结` | 保持。 |
| `战术` | `战术` | 保持兜底。 |

### 2.3 目标词表

| 当前词 | P0 token |
| --- | --- |
| `第一排` | `前排` |
| `默认前排` | `默认` 或 `默认BRU/COL/WSP` |
| `默认最高意图 BRU` | `默认BRU` |
| `自身` | `自身` |
| `全场` | `全场` |

### 2.4 新增 reorder 事件可见句

如果第 7 轮实现真实 reorder，战斗日志和 Director 只允许以下短句级别：

| 事件 / 状态 | 日志 token | Director strong | Director em |
| --- | --- | --- | --- |
| offer 顶部 3 张 | `整备3张` | `整备中` | `选牌顶` |
| 确认后顶置终结 | `整备：顶终结` | `下抽终结` | `整备成功` |
| 确认后顶置路线 | `整备：顶路线` | `下抽路线` | `整备成功` |
| 无可整备目标 | `整备无牌` | `无整备` | `照常抽牌` |
| 玩家跳过 | `跳过整备` | `整备跳过` | `照常抽牌` |

不要在日志里写：

- `整备：已将 Severance Burst 放到 drawPile 顶部`
- `查看牌库顶3张并选择顺序`
- `Paper Route 抽3并整备寻找终结牌`

## 3. 字段长度预算

以 `360x640` 为硬准入，`390x844` 不作为放宽依据。所有“可见短 token”必须在系统字体、浏览器 100% 缩放下通过；如果未来要支持 125% 缩放，应再降一档。

| UI 字段 | 手机上限 | 桌面上限 | 推荐格式 | 超出处理 |
| --- | ---: | ---: | --- | --- |
| 卡名 `.card-button strong` | 英文 14 字符 / 中文 8 字 | 英文 22 字符 / 中文 12 字 | `Paper Route`、`Wild Mana` | 增加 `shortName`，不要缩小字体。 |
| 角色 `.card-meta b` | 2-4 字 | 2-4 字 | `整备`、`修补`、`终结` | 禁止 slash 串。 |
| 目标 `.card-meta` 后半 | 2-6 字 | 2-8 字 | `自身`、`前排`、`默认BRU` | 去掉“最高意图”。 |
| 链路 `.chain-preview` | 4-9 字 | 4-12 字 | `接x2`、`修补MP1`、`断x1` | `修补MP1 x2` 可在桌面，手机用 `修补MP1`。 |
| 压力 `.card-intent-preview` | 5-9 字 | 6-12 字 | `抽3仍-12`、`14->0`、`不降压` | 不写完整机制解释。 |
| 支付状态 `.missing-cost` | 3-6 字 | 4-8 字 | `缺MP1`、`缺授权` | 禁止 `需MP/终局授权`。 |
| 授权支付 `.authorization-cost` | 3-5 字 | 3-6 字 | `授权付` | 禁止 `终局授权支付`。 |
| 桌面效果 `.card-effect` | 手机隐藏 | 10-18 字 | `MP2 · 抽3整` | 手机不可依赖它。 |
| 奖励角色 `.reward-card span` | 6-10 字 | 8-14 字 | `整备 · 自身` | 不写 `整备/找牌 · 自身`。 |
| 奖励摘要 `.reward-card small` | 10-16 字 | 12-22 字 | `MP2 · 抽1/3整` | 核心收益还要在 `em` 前半句出现。 |
| 奖励规则 `.reward-card em` | 24-28 字，两行内 | 36 字内 | `抽1；接链抽3。整备牌顶。` | 第一行必须含动作和数值。 |
| Director header | 3-6 字 | 3-8 字 | `下张`、`意图`、`终结`、`整备` | 不写完整问题句。 |
| Director strong | 4-8 字 | 4-12 字 | `下抽终结`、`回合损12` | 长牌名改分类名。 |
| Director em | 6-12 字 | 8-16 字 | `整备成功`、`先0>1>2` | 只补状态，不写规则。 |
| 状态条 auth strong | 4-6 字 | 5-8 字 | `授权+3` | 手机禁止 `终局授权 +3`。 |
| 状态条 chain span | 3-7 字 | 4-10 字 | `0>1>2`、`0?` | `MP0 -> MP1` 只放 tooltip。 |
| 状态条 intent span | 2-6 字 | 2-8 字 | `-12HP`、`安全` | 不写“结束回合”。 |
| 战斗日志 `.combat-feed li` | 移动端隐藏 | 18-28 字 | `出牌 Paper · x3 · 抽3 · 整备` | 使用短牌名，不列牌组。 |
| reorder pending 标题 | 6-10 字 | 6-12 字 | `整备3张` | 不写“查看牌库顶部”。 |
| reorder CTA | 2-4 字 | 2-4 字 | `确认`、`跳过` | 不写“确认重排顺序”。 |

## 4. P0 改动建议

### P0-1：先把现有 HUD 词表压短，再加 reorder

建议在新增 reorder UI 之前先替换这些当前长 token：

| 当前 | P0 替换 | 原因 |
| --- | --- | --- |
| `终局授权 +${amount}` | `授权+${amount}` | 状态条手机列宽有限。 |
| `终局授权支付` | `授权付` | 手牌按钮独立状态行太短。 |
| `需MP/终局授权` | `缺授权` | slash 串不可读且宽。 |
| `整备/找牌` | `整备` | 角色标签只表达主角色。 |
| `修补/抽牌` | `修补` | 抽牌是效果，不是角色。 |
| `展开/清前排` | `展开` | 目标已有 `前排`。 |
| `下一张期望费用` | `下张费用` | Director header 无需完整句。 |
| `结束回合 -X HP` | `回合损X` 或 `受X` | Director strong / deal 小字更稳。 |
| `默认最高意图 BRU` | `默认BRU` | target panel 和卡牌目标都更短。 |

### P0-2：新增一个集中式 HUD token 层

不要继续在 `hud.ts` 的模板字符串里散落自然语言。建议新增或集中这些 helper：

```text
roleToken(card) -> 开链 / 承接 / 展开 / 修补 / 整备 / 终结
targetToken(targets, selectedEnemy?) -> 自身 / 前排 / 全场 / 默认BRU
chainToken(snapshot, card) -> 接x2 / 修补MP1 / 断x1
pressureToken(card, multiplier, intent) -> 抽3仍-12 / 14->0 / 不降压
paymentToken(payment) -> 缺MP1 / 缺授权 / 授权付
reorderToken(state) -> 整备3张 / 顶终结 / 顶路线 / 整备无牌
shortCardName(cardId) -> Paper / Lantern / Wild / Burst
```

这样第 7 轮实现真实 reorder 时，只改 token helper 和少量渲染点，不把新机制文案散进状态条、卡牌、日志、奖励四套系统。

### P0-3：reorder 不进入状态条，不新增手牌行

P0 信息分配：

| 信息 | 放置位置 | 不放置位置 |
| --- | --- | --- |
| 这张牌是整备牌 | `.card-meta b`：`整备` | 不写 `整备/找牌`。 |
| 打出前抽几张、压力是否未解 | `.card-intent-preview`：`抽3仍-12` | 不写 `抽3并整备寻找终结牌`。 |
| 桌面补充整备属性 | `.card-effect`：`MP2 · 抽3整` | 手机不可依赖。 |
| 整备等待确认 | 独立小 pending 面板或 Director：`整备3张` | 不塞进状态条。 |
| 整备结果 | 战斗日志：`整备：顶终结`；Director：`下抽终结` | 不回写到手牌按钮。 |
| 完整规则 | tooltip / detail / debug | 不进入卡面短行。 |

### P0-4：如果做真实 reorder，只显示三态

真实 reorder 的 UI 不要把牌堆操作细节全展示出来。P0 只需要三态：

1. `整备3张`：表示进入 pending，玩家知道现在要处理整备。
2. `顶终结` / `顶路线`：表示确认结果。
3. `整备无牌` / `跳过整备`：表示没有收益或玩家跳过。

如果运行时选择的是“自动检索并置顶”，也沿用同一套结果 token；不要因为没有 pending UI 就写成长日志解释。

### P0-5：战斗日志必须补单行保护

当前 `.combat-feed li` 没有显式 ellipsis。若加入 reorder 结果，日志很容易向下增长。P0 建议后续 CSS 加单行保护：

```css
.combat-feed li {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

同时日志文本必须先短化，不能只靠 ellipsis 裁切。推荐格式：

```text
出牌 Paper · x3 · 抽3 · 整备
整备：顶终结
授权+3 本回合
获得 Wild Mana
```

### P0-6：奖励卡规则第一句必须可独立成立

奖励卡移动端 `em` 只有 2 行。新增整备牌的 `rulesText` 推荐：

| 卡 | P0 rulesText |
| --- | --- |
| `paper_shatter` | `抽1；接链抽3。整备牌顶。` |
| `lantern_captain` | `抽1；接链抽3。找路线。` |

如果 reorder 已真实实现，`整备牌顶` 可以保留；如果还没实现，只能写 `找终结` / `找路线`，不要写 `牌顶`、`重排`、`控顶`。

### P0-7：QA 验收按字段测，不只看整屏截图

第 7 轮新增 reorder 后，至少检查：

- `360x640`、`390x844`、`1366x768`。
- `.card-button strong`、`.card-meta`、`.chain-preview`、`.card-intent-preview`、`.missing-cost`、`.authorization-cost` 的 `scrollWidth <= clientWidth + 1`。
- `.reward-card small` 不横向溢出；`.reward-card em` 两行内可读出动作和数值。
- `.combat-director strong/em` 不出现整句被省略到只剩前 2 字。
- `.combat-feed li` 不增长到覆盖 run layer 或 debug panel。
- 手机 `.card-row` 仍是横向 rail，新增 reorder 不改变卡牌高度。

## 5. P0 最小落地样例

### 5.1 手牌按钮

```text
MP 2
Paper Route
整备 · 自身
接x3
抽3仍-12
```

不要写：

```text
整备/找牌 · 自身
接链 x3
抽3并整备寻找终结牌
```

### 5.2 奖励卡

```text
整备 · 自身
Paper Route
MP2 · 抽1/3整
抽1；接链抽3。整备牌顶。
```

### 5.3 Director

```text
整备
下抽终结
整备成功
```

### 5.4 战斗日志

```text
出牌 Paper · x3 · 抽3 · 整备
整备：顶终结
```

## 6. 红线

- 玩家可见层不要再出现 `重排牌库`，除非有真实确认 UI。
- 不把完整规则塞进 `.card-button`、`.status-strip`、`.combat-director`。
- 不新增状态条 chip 来表达 reorder。
- 不依赖 `.card-effect` 或 `.card-payoff` 传递手机端必须知道的信息，因为它们在 `<=640px` 隐藏。
- 不用英文长 ID 当日志或短卡名。
- 不通过缩小字体解决超框；要先压 token 和信息分层。

STATUS: DONE
