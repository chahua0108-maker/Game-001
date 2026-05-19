# 2026-05-18 第 2 轮综合结论

## 轮次结果

第 2 轮新增 10 个全新专家视角，主题是完整卡牌机制复刻的工程边界：

1. 卡牌生命周期：`exhaust/retain/status/curse` 需要牌区生命周期，但本轮不做运行时迁移。
2. 卡牌实例与升级：`CardInstanceId` 是未来必需，但应等升级、复制、同名差异真正进入范围。
3. 最小效果解释器：后续可用 `legacyEffectsFromCard + resolveCardEffects` 迁移，不推倒当前 ECA。
4. 敌人意图扩展：下一步适合做一个 `Redline Brute` 蓄力重击，不扩 10 个意图。
5. 奖励节奏：首奖阈值和奖励入牌顺序会影响 3-5 回合闭环，建议后续单独做。
6. 移动端卡牌阅读：卡牌文本必须拆成 `mobileEffect/rulesText/keyword/detail` 四层。
7. 机制契约测试：下一批测试应小而稳定，优先锁默认目标、意图预览、奖励节奏和未来解释器兼容。
8. Payoff 数值复核：未武装 payoff 过强是后续压力曲线风险，但本轮不做数值大改。
9. 关键词文案：授权、修补、终结、意图等关键词必须短、可测、非竞品原文。
10. 工程 PM：第 2 轮只冻结卡牌语言与契约，不做实例、消耗、保留、状态、效果解释器。

## 本轮裁决

本轮只落地“卡牌语言结构化”：

- `CardDefinition` 增加 `rulesText`、`mobileEffect`、`keywords`、`detail`。
- 当前所有卡牌补齐四层文案。
- HUD 的卡牌效果读取 `mobileEffect`，奖励卡读取 `rulesText/detail`。
- `card-taxonomy.test.ts` 增加短文本和关键词预算测试。

## 本轮不做

- 不做 `CardInstanceId`。
- 不做 `exhaustPile`、`retainedCards`、状态牌、诅咒牌。
- 不做通用效果解释器。
- 不做 `Redline Brute` 蓄力重击。
- 不做 payoff 数值分档。
- 不改奖励阈值和入牌顺序。

这些全部进入第 3 轮以后的独立主题，不能混进卡牌语言冻结。

## 验收

- `npm test -- --run`：97 passed，2 skipped。
- `npm run build`：通过，仅保留 Vite 500 kB chunk warning。
- Headless Chrome 复核：1366x768、390x844、360x640 无 console error。
- UI 复核：卡牌关键文本没有 `scrollWidth > clientWidth`，主要 HUD 不出视口。

## 进入第 3 轮的建议

第 3 轮应只处理“发牌与坏手修补 / 奖励节奏”，优先选择一个最小实现：

- 把首奖阈值放进 3-5 回合窗口，并保证下一阈值单调。
- 或者让 `Blood Tithe / Pulse Draw / Wild Mana Stitch` 在固定短切片中自然出现，证明坏手能被修补。

不建议第 3 轮同时做敌人蓄力重击、CardInstance、效果解释器和状态牌。
