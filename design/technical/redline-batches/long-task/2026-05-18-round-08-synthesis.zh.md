# 2026-05-18 Round 08 汇总：`paper_shatter` 极窄整备置顶样片

## 本轮目标

第 8 轮承接第 7 轮裁决：不做完整 `reorder / tutor / scry` 系统，只验证一个最小可玩的整备样片。最终落地范围是 `paper_shatter` 独占的 drawPile-only payoff 置顶。

## 10 个专家视角

| 序号 | 文件 | 关键结论 |
| --- | --- | --- |
| 01 | `2026-05-18-round-08-01-topdeck-runtime-architecture.md` | 建议做极窄样片：`paper_shatter` 打出后、抽牌前，只从 `drawPile` 找 payoff 置顶。 |
| 02 | `2026-05-18-round-08-02-eca-command-ordering.md` | 新规则必须放在 `card.self.resource` 前，保证置顶命令先于 `DrawCards`。 |
| 03 | `2026-05-18-round-08-03-topdeck-balance-guardrails.md` | 不启用 `lantern_captain` 和弃牌堆搜索，保留坏手和敌意图压力。 |
| 04 | `2026-05-18-round-08-04-competitor-topdeck-mapping.md` | 竞品抽象支持“受限顶牌”而不是全牌库 tutor；不复制任何第三方文本或卡名。 |
| 05 | `2026-05-18-round-08-05-topdeck-copy-feedback.md` | 玩家可见文案用 `整备：顶终结 / 整备无牌`，完整规则留在 detail。 |
| 06 | `2026-05-18-round-08-06-hud-overflow-qa.md` | 新日志最易影响 combat feed 和卡牌按钮，必须继续跑 360 宽验收。 |
| 07 | `2026-05-18-round-08-07-topdeck-test-contract.md` | 必测命中、未命中、不搜弃牌堆、排除自身、命令顺序、授权不回归。 |
| 08 | `2026-05-18-round-08-08-implementation-slice.md` | 只触碰类型、卡牌声明、ECA、runtime、HUD 短日志、窄测试。 |
| 09 | `2026-05-18-round-08-09-mobile-playtest-scenarios.md` | 浏览器验收覆盖桌面、390x844、360x640；验收后关闭浏览器。 |
| 10 | `2026-05-18-round-08-10-producer-synthesis.md` | 制作人裁决：第 8 轮落地 `paper_shatter` 极窄样片，不扩范围。 |

## 已落地机制

- `CardDefinition` 增加 `preDrawTopdeckPayoff?: boolean`。
- 只有 `paper_shatter` 设置 `preDrawTopdeckPayoff: true`。
- 新增命令 `TopdeckPayoffFromDrawPile`。
- 新增事件 `PayoffTopdecked` 和 `PayoffTopdeckMissed`。
- 新增 ECA 规则 `card.self.paper-shatter-topdeck-payoff`，放在 `card.self.resource` 前。
- Runtime 只从 `world.player.drawPile` 顺序搜索第一张 payoff，移动到 `drawPile[0]`。
- 未命中时不改任何牌区，后续 `DrawCards` 照常执行。
- `lantern_captain` 保持只有 `reorder` 标签，不触发真实置顶。
- HUD 战斗日志新增短反馈：`整备：顶终结` / `整备无牌`。
- 授权可支付卡隐藏重复 `.card-effect`，避免 `授权付` 被挤出卡牌按钮。

## 验收结果

- `npm test -- --run src/tests/sim/redline-paper-shatter-topdeck.test.ts src/tests/sim/redline-progression-card-system.test.ts`：13 passed。
- `npm test -- --run`：14 passed、1 skipped；118 passed、2 skipped。
- `npm run build`：通过；保留 Vite 500KB chunk warning。
- 浏览器验收：
  - `1366x768`：0 console error，0 页面水平溢出，0 未保护文字超框。
  - `390x844`：0 console error，0 页面水平溢出，0 未保护文字超框。
  - `360x640`：0 console error，0 页面水平溢出，0 未保护文字超框。
  - 专门构造 `paper_shatter -> PayoffTopdecked -> HandDealt` 的 HUD 快照，确认 `整备：顶终结` 不超框。
- 浏览器验收结束后已关闭脚本打开的 Chrome。

## 第 9 轮交接

第 9 轮应把现在的手工 QA 流程自动化：

- 固化 360/390/desktop 的 DOM overflow probe。
- 把 `paper_shatter` 顶终结场景做成可重复浏览器验收。
- 区分允许横向滚动的手牌 rail 与真正文字超框。
- 将测试失败输出保留为可读 JSON 或 Markdown，便于后续回归。

STATUS: DONE
