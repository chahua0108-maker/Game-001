# 第5轮专家05：移动端奖励面板 UI QA

## 范围

- 工作目录：`/Users/roc/Game-001`
- 只读依据：
  - `prototype-web/src/style.css`
  - `prototype-web/src/ui/hud.ts`
- 本轮不改源码、不打开浏览器，只给奖励牌与奖励文案变更后的移动端超框验收标准和可执行检查清单。

## 当前结构判断

奖励态由 `snapshot.fsm.gameFlow === 'Reward'` 触发，DOM 结构为：

- `.reward-panel`
  - `header`
    - `Level ${snapshot.player.level}`
    - `选择一张新牌加入牌组`
    - `击杀获得经验，升级后奖励会进入后续抽牌循环。`
  - `.reward-choices`
    - 多个 `.reward-card`

每张奖励牌的可见文案为：

- 顶部标签：`${roleLabel} · ${targetLabel}`
- 主标题：`${card.name}`
- 摘要行：`MP ${card.cost} · ${effectLabel}`
- 规则行：`card.rulesText || effectLabel`

移动端规则来自 `@media (max-width: 980px)`：奖励面板单列展示，面板 `top: 54%`、`max-height: calc(100dvh - 24px)`、`padding: 10px`，奖励牌 `min-height: 86px`，规则行 `em` 被限制为 2 行。

## 本轮红线

1. 任何新增奖励牌、奖励名、`mobileEffect`、`rulesText`、角色标签或目标标签，都必须先过 360 / 390 / 430 三个移动宽度。
2. 奖励面板允许内部纵向滚动，但不允许把页面本体撑出横向滚动。
3. 奖励牌可截断次要说明，但不能截断到无法判断牌的核心收益。
4. `.reward-card small` 当前是单行省略；如果把核心差异只写在这一行，移动端可能不可读。
5. 英文 ID、长数字、长英文词、连续符号最容易造成超框；新增文案应优先用可换行中文短语。

## 视口验收标准

### 360 宽

建议验收视口：`360 x 780`，另加一次压力检查 `360 x 640`。

必须通过：

- `document.documentElement.scrollWidth <= 360`
- `.reward-panel` 左右边界在视口内，建议左右安全边距不小于 `12px`
- `.reward-card` 左右边界不得超出 `.reward-panel`
- 每张 `.reward-card` 的可点击高度不小于 `44px`
- 3 张奖励牌时，首屏至少能看到完整标题区和第一张奖励牌；其余奖励牌必须能通过 `.reward-panel` 内部滚动触达
- `card.name` 不得把卡牌撑宽；长标题允许换行到 2 行，但不能压住摘要行
- `rulesText` 在 2 行截断后仍要保留核心动词与数值，例如“抽2”“全场8伤害”“本回合授权”

建议文案上限：

- `card.name`：中文 8 字以内优先，最多 12 字
- `mobileEffect`：中文 12 字以内优先，最多 16 字
- `rulesText`：中文 24 字以内优先，最多 32 字；超过则必须确认 2 行截断后的内容仍可理解

### 390 宽

建议验收视口：`390 x 844`。

必须通过：

- `document.documentElement.scrollWidth <= 390`
- `.reward-panel` 不碰左右屏幕边缘，左右安全边距不小于 `12px`
- 奖励标题、摘要行、规则行之间没有重叠
- 3 张奖励牌完整渲染；如果面板内部出现纵向滚动，滚到底后最后一张牌底部必须完整可见
- 摘要行被省略时，核心收益必须已在标题或规则行补足

建议文案上限：

- `card.name`：中文 10 字以内优先，最多 14 字
- `mobileEffect`：中文 14 字以内优先，最多 18 字
- `rulesText`：中文 28 字以内优先，最多 36 字

### 430 宽

建议验收视口：`430 x 932`。

必须通过：

- `document.documentElement.scrollWidth <= 430`
- `.reward-panel` 不超出视口上下左右边界
- 3 张奖励牌在常规高度下应基本不用滚动；如因长文案出现滚动，滚动只发生在 `.reward-panel` 内部
- hover / active 造成的位移不能导致卡牌右边界越界
- 文案看起来不能只在 430 正常，而在 360 退化到不可读

建议文案上限：

- `card.name`：中文 12 字以内优先，最多 16 字
- `mobileEffect`：中文 16 字以内优先，最多 20 字
- `rulesText`：中文 32 字以内优先，最多 40 字

## 可执行 DOM 检查

进入 Reward 态后，在目标视口分别执行下面脚本。返回 `ok: true` 才算通过；有 `failures` 时按失败项处理。

```js
(() => {
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
    docScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth
  };
  const panel = document.querySelector('.reward-panel');
  const cards = [...document.querySelectorAll('.reward-card')];
  const failures = [];

  if (!panel) {
    return { ok: false, viewport, failures: ['missing .reward-panel'] };
  }

  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return {
      left: Math.round(r.left),
      right: Math.round(r.right),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      width: Math.round(r.width),
      height: Math.round(r.height)
    };
  };

  const panelRect = rect(panel);
  const horizontalLimit = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  if (horizontalLimit > window.innerWidth + 1) {
    failures.push(`page horizontal overflow: ${horizontalLimit} > ${window.innerWidth}`);
  }
  if (panelRect.left < 0 || panelRect.right > window.innerWidth) {
    failures.push(`reward panel x overflow: ${JSON.stringify(panelRect)}`);
  }
  if (panelRect.top < 0 || panelRect.bottom > window.innerHeight) {
    failures.push(`reward panel y overflow: ${JSON.stringify(panelRect)}`);
  }
  if (cards.length === 0) {
    failures.push('no reward cards rendered');
  }

  cards.forEach((card, index) => {
    const cardRect = rect(card);
    if (cardRect.left < panelRect.left || cardRect.right > panelRect.right) {
      failures.push(`card ${index} x overflow: ${JSON.stringify(cardRect)}`);
    }
    if (cardRect.height < 44) {
      failures.push(`card ${index} touch target too small: ${cardRect.height}`);
    }

    ['span', 'strong', 'small', 'em'].forEach((selector) => {
      const node = card.querySelector(selector);
      if (!node) return;
      if (node.scrollWidth > node.clientWidth + 1) {
        failures.push(`card ${index} ${selector} text overflow: ${node.scrollWidth} > ${node.clientWidth}`);
      }
    });
  });

  const originalScrollTop = panel.scrollTop;
  panel.scrollTop = panel.scrollHeight;
  const lastCard = cards[cards.length - 1];
  if (lastCard) {
    const lastRect = rect(lastCard);
    const scrolledPanelRect = rect(panel);
    if (lastRect.bottom > scrolledPanelRect.bottom + 1) {
      failures.push(`last card unreachable after panel scroll: ${JSON.stringify(lastRect)}`);
    }
  }
  panel.scrollTop = originalScrollTop;

  return {
    ok: failures.length === 0,
    viewport,
    panel: panelRect,
    cards: cards.map(rect),
    panelScroll: {
      clientHeight: panel.clientHeight,
      scrollHeight: panel.scrollHeight
    },
    failures
  };
})();
```

## 手动检查清单

- [ ] 分别设置 `360 x 780`、`390 x 844`、`430 x 932`。
- [ ] 每个宽度都进入 Reward 态，确认奖励面板出现且只展示奖励选择，不需要理解底层战斗画面才能完成选择。
- [ ] 检查面板左右是否留边，不能贴边、裁边、横向滚动。
- [ ] 检查标题区三行是否仍然完整：等级、主标题、升级说明。
- [ ] 检查每张奖励牌四段信息是否层级明确：标签、牌名、MP/效果、规则说明。
- [ ] 检查长牌名是否换行后仍不压住摘要行。
- [ ] 检查摘要行省略号是否没有吞掉唯一的核心收益。
- [ ] 检查规则行 2 行截断后，仍能读出动作、对象、数值。
- [ ] 检查滚动：如果出现纵向滚动，只能滚 `.reward-panel`，页面本体不能被撑开。
- [ ] 滚到底后，最后一张奖励牌必须完整可点击。
- [ ] 连续点击奖励牌时，触控区域不能小于 44px，不能点到背后的手牌区或结束回合按钮。
- [ ] 对包含英文、数字、斜杠、箭头、加号的文案做一次压力检查，例如 `MP 0->1->2`、`Authorization +3`、`All-enemy Burst`。

## 文案改动建议

- 优先把核心收益写进 `mobileEffect`，让 `.reward-card small` 即使单行省略也能先看到数值。
- `rulesText` 用短句，不写解释型长句；解释放进 `detail`/`description` 这种 tooltip 或详情文本。
- 避免把多个机制堆到一张奖励牌的可见文案里；移动端最多承载“费用 + 一个核心动作 + 一个关键限制”。
- 如果必须使用英文术语，拆成空格分隔的短词，避免一个超长 token 撑破卡牌。
- 新增奖励牌时，先用 360 宽作为准入门槛；390 和 430 只能作为确认，不应作为设计基准。

## 失败处理优先级

1. 页面出现横向滚动：必须阻断合入。
2. `.reward-panel` 超出视口且无法滚到完整内容：必须阻断合入。
3. 奖励牌可点击区域低于 44px：必须阻断合入。
4. 核心收益只出现在被省略或被 2 行截断的文案中：必须改文案。
5. 只有 360 宽失败：仍然算失败，因为本轮验收明确覆盖 360。
