# 第5轮专家03：抽牌倍率 HUD 文案落地设计

## 结论

如果开放 `pulse_draw` / `paper_shatter` 的抽牌倍率，HUD 不应该新增大块说明，也不应该把“抽2/抽3”只放在 `.card-effect`。当前移动端 `<=640px` 会隐藏 `.card-effect` 和 `.card-payoff`，所以抽牌结果必须进入仍然可见的 `.card-intent-preview`，日志则用短句补上抽牌数。

最小落地口径：

- 卡牌按钮主可见行：`抽2找解` / `抽3找解`
- 桌面效果行：`MP 1 · 抽2`、`MP 2 · 抽3 整备`
- 战斗日志：`出牌 Pulse Draw · x2 · 抽2`
- Tooltip：保留完整信息，写成 `... · 抽2 · ...`

## 只读依据

只读了这三份源码上下文：

- `prototype-web/src/ui/hud.ts`
- `prototype-web/src/style.css`
- `prototype-web/src/data/cards.ts`

当前相关事实：

- `pulse_draw` 和 `paper_shatter` 现在都是 `drawCards: 1`，`mobileEffect` 分别是 `抽1` / `抽1 整备`。
- 卡牌按钮已有 `.card-intent-preview`，移动端仍显示；`.card-effect` 在 `<=640px` 被隐藏。
- `hudCardIntentPreview(card, snapshot, selectedTargetId, multiplier)` 已经拿得到 `multiplier`，但无伤害抽牌牌目前只显示泛化文案 `抽牌找解`。
- `combatEventLabel(CardPlayed)` 目前显示 `出牌 ... · 倍率 xN`，没有把抽牌结果转成 `抽2/抽3`。

## 文案规则

抽牌牌的可见文案只保留一个数字和一个短动词：

| 场景 | `pulse_draw` x2 | `paper_shatter` x3 | 备注 |
|---|---:|---:|---|
| 卡牌按钮 `.card-intent-preview` | `抽2找解` | `抽3找解` | 移动端核心可见行 |
| 卡牌按钮 `.card-effect` | `MP 1 · 抽2` | `MP 2 · 抽3 整备` | 桌面补充行，移动端可隐藏 |
| Tooltip | `... · 抽2 · ...` | `... · 抽3 整备 · ...` | 可长，但不要依赖它传达核心信息 |
| 战斗日志 | `出牌 Pulse Draw · x2 · 抽2` | `出牌 Paper Route · x3 · 抽3` | 244px 日志栏可读 |

不要在移动端按钮可见区写：

- `抽取2张牌`
- `抽3并整备寻找终结牌`
- `倍率 x3 后抽取 3 张`

这些都会让中文在 232px / 78vw 卡宽内挤占 `chain-preview` 和 `card-meta`。

## 最小 DOM 建议

优先不新增 DOM 节点，复用现有结构。

1. 在 `hudCardIntentPreview` 的无伤害分支中，用 `multiplier` 计算有效抽牌数。

```ts
const drawCount = (card.drawCards ?? 0) * multiplier;
if (card.damage <= 0) {
  const utilityLabel = drawCount > 0 ? `抽${drawCount}找解` : card.energyGain ? '返MP找解' : '不降意图';
  return { label: utilityLabel, before, after: before, prevented: 0, targetId: null };
}
```

2. 让 `cardEffectLabel` 支持倍率参数，渲染卡牌按钮时传入 `chainRead.multiplier`。

```ts
private cardEffectLabel(card: CardDefinition, multiplier = 1): string {
  const drawCount = (card.drawCards ?? 0) * multiplier;
  if (drawCount > 0) {
    return card.utilities?.includes('reorder') ? `抽${drawCount} 整备` : `抽${drawCount}`;
  }
  ...
}
```

3. 不把抽牌数塞进 `.card-meta`。

`.card-meta` 当前承担 `roleLabel · targetLabel`，例如 `整备/找牌 · 自身`。这里再加 `抽3` 会导致移动端中文更容易超框；抽牌数字只放到 `.card-intent-preview` 和 `.card-effect`。

4. `combatEventLabel(CardPlayed)` 增加短抽牌后缀。

```ts
const card = cards[event.cardId];
const drawCount = card?.drawCards ? card.drawCards * event.effectMultiplier : 0;
const drawSuffix = drawCount > 0 ? ` · 抽${drawCount}` : '';
return `出牌 ${card?.name ?? event.cardId} · x${event.effectMultiplier}${drawSuffix}`;
```

这里建议把 `倍率 xN` 缩短为 `xN`。日志栏只有 244px，`倍率 x3 · 抽3` 比 `x3 · 抽3` 更容易被截断。

## 最小 CSS 建议

当前卡牌按钮的文本行已经有 `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`，所以卡牌侧只需要补一个日志兜底。

```css
.combat-feed li {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

如果后续选择新增 `.draw-copy` 之类的小标签，也不要新增高度；只允许放进现有 `.card-intent-preview` 行，保持移动端卡牌高度 `98px` 不变。

## 测试建议

最小测试覆盖四类情况：

1. HUD 文案单元测试：手牌有 `pulse_draw`，上一张费用为 0、当前链倍率会让它显示 x2 时，`.card-intent-preview` 应包含 `抽2找解`，按钮 `title` 应包含 `抽2`。
2. HUD 文案单元测试：手牌有 `paper_shatter`，上一张费用为 1、当前链倍率会让它显示 x3 时，`.card-intent-preview` 应包含 `抽3找解`，桌面 `.card-effect` 应包含 `抽3 整备`。
3. 日志单元测试：`CardPlayed` 事件为 `paper_shatter` 且 `effectMultiplier: 3` 时，战斗日志应包含 `x3 · 抽3`，不只显示 `倍率 x3`。
4. 移动端溢出测试：在 360px 和 390px 宽度下渲染含 `pulse_draw` / `paper_shatter` 的手牌，断言 `.card-intent-preview`、`.card-meta`、`.chain-preview` 的 `scrollWidth <= clientWidth`。`card-row` 本身允许横向滚动，不应把它当成失败。

验收底线：移动端按钮上能直接看到 `抽2` 或 `抽3`，但没有任何一行中文因为完整说明而挤出卡牌边界。
