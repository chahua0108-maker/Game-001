# 2026-05-18 Round 08 Expert 04: Card Roguelike Competitor Mapper

## 0. Boundary

- Workdir: `/Users/roc/Game-001`
- Role: Round 08 Expert 04, card roguelike competitor mapper.
- Task: abstract `scry / tutor / topdeck / discover` structures from Slay the Spire, Monster Train, Wildfrost, Backpack Hero, and adjacent deckbuilding games, then map them to Redline's extremely narrow prep implementation.
- Output boundary: only add this Markdown file. Do not modify source, do not commit, do not roll back other workers' changes.
- Copyright boundary: this document only discusses generic mechanism structures: inspect, filter, choose, move, retain, redraw, and reward-choice constraints. It does not copy third-party card names, rules text, UI layout, card art, sound, narrative phrasing, or numeric templates.

Read baseline:

- `design/technical/redline-batches/long-task/2026-05-18-round-07-synthesis.zh.md`
- `design/technical/redline-batches/long-task/2026-05-18-round-07-02-reorder-runtime-contract.md`
- `design/technical/redline-batches/long-task/2026-05-18-round-07-07-pressure-preserving-reorder.md`
- `design/technical/redline-batches/long-task/2026-05-18-round-07-09-competitor-reorder-mapping.md`
- `design/technical/redline-batches/long-task/2026-05-18-round-07-10-producer-synthesis.md`

## 1. One-line verdict

Redline should not copy any competitor keyword. The safe Round 08 implementation is:

```text
Prep Topdeck:
after a legal 2 MP prep draw card resolves its play event,
inspect only the existing drawPile,
select at most one Redline-defined target,
move it to drawPile[0],
then let the already scheduled DrawCards action draw normally.
```

For the first playable slice, this should be even narrower:

```text
Only paper_shatter.
Only after a real 0 -> 1 -> 2 route has been maintained.
Only search drawPile.
Only target one payoff-shaped card.
Only topdeck before DrawCards.
No discard search, no hand search, no full deck browser, no generated options.
```

This takes the common structure of topdeck planning, but keeps the product behavior Redline-specific: `整备` prepares the next draw under enemy intent pressure; it does not solve the current intent by itself.

## 2. Competitor structures, abstracted

### 2.1 Slay the Spire family: inspect top cards, discard or reorder by rule

Generic structure:

```text
Inspect top N cards
-> keep, discard, bottom, or reorder a subset
-> future draw becomes less random
```

Design value:

- Gives players one more turn of planning without adding raw damage.
- Reduces bad-hand variance while preserving the need to pay and play the next card.
- Feels skillful because the player must choose what future problem matters.

Redline mapping:

- Good inspiration: top-of-draw-pile control.
- Bad inspiration for P0: full manual top-N UI, discard choices, repeated reorder chains.
- Safe extraction: `inspect/filter/move one card to drawPile[0]`.

Round 08 implication:

Redline can borrow the structural promise, not the surface keyword: "I can influence my next draw." Do not use external names in product UI. Use Redline terms like `整备`, `下抽`, `置顶`, `终结`.

### 2.2 Tutor / seek family: search by condition, then move

Generic structure:

```text
Define a condition
-> search one or more zones
-> move a matching card to hand, top, discard, or temporary area
```

Design value:

- Strong consistency tool.
- Lets builds rely on specific role cards.
- Converts deckbuilding from probability management into planned access.

Risk:

- If it searches too wide, it becomes an answer button.
- If it moves directly to hand, it bypasses draw tension.
- If it can search discard and full deck early, it compresses too much variance.

Redline mapping:

- P0 should not be a real tutor.
- P0 may use a tutor-like filter internally: "find a payoff-shaped card."
- The output must be topdeck, not direct hand insertion.

Round 08 implication:

Even if the implementation function is internally named `SearchAndTopdeck`, the player-facing feature should not behave like full tutor. It must stay bounded:

```text
source = drawPile only
destination = drawPile[0] only
visibility = short event feedback only
result = still must draw and pay
```

### 2.3 Monster Train family: recurrence, retain, and known future access

Generic structure:

```text
Some tools make a card reliably reappear
Some tools keep a card available across turns
Some setup cards trade current output for future availability
```

Design value:

- Reduces "my deck did not show up" frustration.
- Supports build identity: a key role can become reliable.
- Often balanced by opportunity cost, upgrade cost, or occupying hand/deck space.

Redline mapping:

- Do not bring in retain, repeat-every-turn, or guaranteed recurrence for P0.
- Do borrow the principle that access consistency needs a visible cost.
- Redline's cost should be local: 2 MP support card, low/no direct pressure reduction, and still needs a later draw/pay/play step.

Round 08 implication:

`paper_shatter` should not become "the payoff is now yours every time." It should become:

```text
I spent a support action to make the next draw more likely to matter.
```

The strongest Monster Train-like lessons are cost and recurrence control, not direct mechanical replication.

### 2.4 Wildfrost family: redraw as active bad-hand repair

Generic structure:

```text
Player may replace a bad hand or accelerate access
-> usually constrained by cooldown, turn tempo, or a visible counter
-> pressure remains on board while the player cycles
```

Design value:

- Gives agency during bad draws.
- Makes hand quality management a visible action, not only deck math.
- Keeps danger alive because redraw does not automatically answer enemy attacks.

Redline mapping:

- Redraw is not the Round 08 target.
- The useful lesson is feedback language: cycling/prep should explicitly say that threat remains.
- Redline's `抽N仍-X` pattern already fits this: draw/prep changes options, not enemy intent.

Round 08 implication:

Every successful prep feedback should keep the pressure suffix:

```text
整备：终结置顶 · 仍-17
下抽终结 · 未解意图
未见终结 · 仍-17
```

Do not write:

```text
找到答案
安全
已解决
```

### 2.5 Backpack Hero family: discovery under spatial or inventory constraints

Generic structure:

```text
Player sees candidate rewards/tools
-> chooses under limited space, adjacency, shape, or build constraints
-> value depends on fit, not only raw power
```

Design value:

- Selection is meaningful because capacity and compatibility are constrained.
- Discovery is not just "pick the strongest card"; it is "pick what fits the current build space."
- The candidate UI is a meta/building layer more than a live draw-pile reorder layer.

Redline mapping:

- Do not use discover as the first combat prep mechanic.
- Discover belongs later in reward, support, or run-modifier systems.
- If Redline eventually gets a discover-like feature, candidates should be Redline role categories: route, repair, payoff, pressure break, not copied external archetypes.

Round 08 implication:

`discover` is the wrong model for P0 because it implies generated choices and a selection panel. Redline's narrow prep should manipulate existing cards in the current draw pile, not create a new option pool.

## 3. Mechanism primitive map

| Primitive | Competitor-like use | Redline-safe extraction | P0 status |
| --- | --- | --- | --- |
| Inspect | View top cards or candidate choices. | Optional internal check of `drawPile`; no full UI browser. | Internal only. |
| Filter | Find cards by cost, role, type, or tag. | `payoff` predicate defined by Redline data, not by external categories. | Yes. |
| Select | Player or system chooses one target. | P0 system chooses first legal target deterministically. | Yes, automatic. |
| Move | Put card in hand, top, bottom, discard, retain, etc. | Only move one card to `drawPile[0]`. | Yes. |
| Draw | Convert topdeck into hand. | Existing `DrawCards` performs the draw. | Yes, unchanged. |
| Generate | Create candidate cards or temporary cards. | Not allowed. | No. |
| Redraw | Replace hand. | Not in Round 08. | No. |
| Retain | Keep card across turns. | Not in Round 08. | No. |
| Full tutor | Search broad zones and directly access key cards. | Forbidden for P0. | No. |

The smallest Redline mechanism is therefore:

```text
Filter -> Move to drawPile[0] -> Draw normally
```

Not:

```text
Browse deck -> choose any answer -> add to hand
```

## 4. Redline P0 contract

### 4.1 Trigger

Only one playable path should be accepted:

```text
sourceCardId = paper_shatter
source has self draw
source has reorder/prep utility
source was played after the route has reached the 2-cost prep step
same trace still has a pending DrawCards action
```

Reason:

- `paper_shatter` already reads as the payoff-finding support card.
- It gives one clean demonstration of prep without making all 2 MP support cards equivalent.
- It avoids turning `lantern_captain` into a duplicate payoff finder before its route role is clear.

### 4.2 Source zones

Allowed:

```text
drawPile
```

Forbidden:

```text
hand
discardPile
deck ownership list
reward choices
starting hand config
generated candidate pool
```

Reason:

- `drawPile` is the only zone that preserves the "next draw planning" feel.
- `discardPile` search pushes the feature toward tutor strength.
- `deck` is an ownership list, not a live card zone; moving from it risks duplication semantics.

### 4.3 Target predicate

P0 target should be Redline-specific:

```text
preference = payoff
candidate must be a current drawPile card
candidate should be a 3 MP / all-enemy / burst or payoff-role card under existing Redline data
choose the first legal candidate in drawPile order
```

Do not import external card taxonomy. The predicate exists only to answer Redline's question:

```text
Can this route prep make my next draw closer to an authorized payoff?
```

### 4.4 Movement

Required movement:

```text
remove target from its current drawPile index
unshift target to drawPile[0]
do not duplicate
do not draw directly
do not change draw count
do not change energy, authorization, enemy intent, or chain state
```

If target is already at `drawPile[0]`, emit the success event but perform a no-op move.

### 4.5 Miss

If no candidate exists:

```text
emit a miss event
leave drawPile unchanged until normal DrawCards
continue existing DrawCards
```

Miss must never feel like a bug. It should be visible as a failed prep:

```text
整备未见终结 · 仍-X
```

### 4.6 Events

Event names may follow the runtime contract from Round 07:

```text
DrawPileReordered
DeckSearchMissed
```

Minimum fields:

```text
traceId
sourceCardId
preference
fromZone
fromIndex
movedCardId when hit
searchedCount
topCardBefore
topCardAfter when hit
```

The event must prove that prep is real. HUD text alone is not enough.

## 5. Mechanism safety boundaries

### 5.1 Copyright and identity safety

Allowed:

- Use generic deckbuilding verbs internally: inspect, filter, topdeck, redraw, retain, discover.
- Analyze public mechanism structures at a high level.
- Build Redline-specific names, predicates, feedback, and cost logic.

Not allowed:

- Copy third-party card names, exact rules text, tutorial wording, UI panel layout, icons, animation style, or audio cues.
- Use competitor keywords as Redline product keywords.
- Recreate a specific card's full effect package with the same cost, timing, target, text, and role.
- Copy discover pools, retain/recurrence packages, or redraw UI as a recognizable external pattern.

Recommended product vocabulary:

```text
整备
下抽
置顶
终结
路线
补线
未见
仍-X
```

Avoid product vocabulary:

```text
scry
tutor
seek
discover
mulligan
retain
```

These can stay in internal design notes, not in player-facing text.

### 5.2 Balance safety

P0 must not stack with other consistency boosters into a solved route.

Hard limits:

- No `discardPile` search.
- No direct-to-hand movement.
- No generated candidate cards.
- No free MP.
- No authorization grant.
- No enemy intent reduction.
- No full deck search.
- No second prep card with the same payoff target in the same P0.
- No repeated prep loop that can topdeck, draw, replay, and topdeck again without cost.

Reason:

Redline's pressure is currently built around the player seeing `仍-X` after draw/support actions. If prep erases variance too hard, enemy intent stops being a tactical clock and becomes a background number.

### 5.3 Runtime safety

P0 must preserve existing contracts:

- `DrawCards.count` remains `drawCards * effectMultiplier`.
- Existing self-draw exclusion should still prevent the just-played card from being immediately returned.
- Reward cards entering next hand through `AddCardToDeck.unshift` must not be broken.
- Wild repair and payoff-only authorization must not be modified.
- Restart must clear any topdeck effect because it is just a drawPile movement, not run ownership.

### 5.4 UI safety

No new large card browser in P0.

Allowed UI:

- Combat feed line.
- Director short state.
- Card intent preview short token.
- Optional debug trace evidence.

Not allowed UI:

- Modal deck browser.
- Drag reorder panel.
- Three-card discover panel.
- Hand replacement interface.
- Persistent "pending reorder" state.

Reason:

Round 07 already identified mobile HUD pressure as a hard constraint. The first prep version should be readable through short feedback, not a new interaction surface.

## 6. Player feedback contract

### 6.1 Core sentence

Every prep feedback must answer two questions:

```text
What changed in my next draw?
What enemy pressure is still unresolved?
```

Good:

```text
整备：终结置顶 · 仍-17
下抽终结 · 未解意图
整备未见终结 · 仍-17
抽3整备 · 仍-17
```

Bad:

```text
找到答案
救场成功
压力解除
安全
终结到手
```

### 6.2 Card button

Before true runtime prep exists:

```text
抽3整备
抽3仍-17
```

After true P0 topdeck exists:

```text
抽3整备 · 仍-17
```

Do not put full rules text on the button. The button should remain a decision surface, not a rulebook.

### 6.3 Combat Director

Hit:

```text
下抽终结
意图仍-17
```

Miss:

```text
未见终结
意图仍-17
```

No-op hit because candidate was already on top:

```text
终结已在下抽
意图仍-17
```

### 6.4 Combat feed

Recommended feed lines:

```text
Paper Route x3 · 整备终结 · 仍-17
整备：终结置顶 · 仍需打出
整备未见终结 · 按原序抽3
```

If a following payoff actually resolves pressure, separate it:

```text
Severance Burst 兑现 · 意图17->0
```

That separation is important. Prep prepares; attack/payoff resolves.

### 6.5 Detail tooltip

P0 tooltip can be short:

```text
整备：把一张符合条件的牌放到下抽。它不造成伤害，不降低敌意图。
```

If implementation only searches payoff:

```text
终结整备：从抽牌堆中置顶一张终结牌。仍需抽到并支付。
```

Do not describe it as "search your deck" unless the implementation actually searches a live deck zone and the balance is priced as tutor strength.

## 7. Competitor-to-Redline decision table

| External structure | What it teaches | What Redline should take | What Redline should reject for P0 |
| --- | --- | --- | --- |
| Top-card planning | Future draw control creates skill without raw damage. | One-card topdeck into existing DrawCards. | Full manual reorder UI. |
| Conditional tutor | Consistency must be paid for and constrained. | Internal payoff predicate. | Full deck/discard search or direct-to-hand. |
| Recurrence/retain | Reliable access is powerful and needs cost. | Support-card opportunity cost. | Guaranteed repeated access. |
| Redraw | Bad-hand agency should keep pressure visible. | `仍-X` feedback after prep. | Global hand replacement. |
| Discover/reward choice | Choice matters when candidates are constrained by build fit. | Later reward/support design. | Generated combat option pool in P0. |
| Inventory fit | Constraint creates identity. | Redline role categories: route/repair/payoff. | Spatial inventory UI or external fit rules. |

## 8. Recommended Round 08 scope

### P0: ship only one real prep sample

```text
paper_shatter:
  on legal CardPlayed
  before DrawCards
  search drawPile for first payoff target
  move it to drawPile[0]
  emit DrawPileReordered or DeckSearchMissed
  continue DrawCards
```

HUD:

```text
hit:  整备：终结置顶 · 仍-X
miss: 整备未见终结 · 仍-X
```

Tests should prove:

- Hit moves one card, no duplicate.
- Already-on-top hit is observable but no-op.
- Miss leaves pre-draw order intact.
- Draw count is unchanged.
- No discard search.
- No deck ownership search.
- No direct hand insertion.
- Enemy intent is unchanged by prep.

### P1: split the second prep card

```text
lantern_captain:
  route prep, not payoff prep
  still drawPile only at first
```

This creates two identities:

- `paper_shatter`: terminal/payoff prep.
- `lantern_captain`: route/repair prep.

Do not enable both as identical payoff search cards.

### P2: add player choice only after HUD is stable

Candidate P2 features:

- look top 3, choose 1 topdeck;
- limited discard source with strict self-exclusion;
- route/repair/payoff preference shown in tooltip;
- later discover-like reward choices using Redline categories.

Do not jump directly from P0 topdeck to full card browser.

## 9. Final recommendation

Round 08 should treat competitor mechanisms as a vocabulary of structures, not a list of features to clone.

The safe Redline adaptation is:

```text
Narrow prep = a one-card, drawPile-only, Redline-role-filtered topdeck
that preserves the draw action and preserves enemy pressure.
```

The product promise should be:

```text
整备让你多掌握一步。
它不替你解决这一回合。
```

That line keeps Redline inside the card roguelike planning space while avoiding three risks at once: copyright similarity, tutor-strength balance collapse, and mobile UI overload.

STATUS: DONE
