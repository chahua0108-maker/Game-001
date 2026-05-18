import { cards } from '../data/cards';
import { enemies as enemyDefinitions } from '../data/enemies';
import { nextTraceId } from '../input/keyboard';
import { ENEMY_COLUMNS } from '../sim/world';
import type { CardDefinition, EnemySnapshot, GameEvent, GameSnapshot, Intent } from '../sim/types';

const enemyDamageByDefinition = new Map(enemyDefinitions.map((enemy) => [enemy.id, enemy.damage]));

export function validHudSelectedTargetId(
  targetId: string | null | undefined,
  enemies: EnemySnapshot[] | null | undefined
): string | null {
  if (!enemies || !targetId) {
    return null;
  }

  const target = enemies.find((enemy) => enemy.id === targetId);
  return target?.alive && target.slot >= 0 && target.slot < ENEMY_COLUMNS ? target.id : null;
}

export function canHudEndTurn(gameFlow: GameSnapshot['fsm']['gameFlow']): boolean {
  return gameFlow === 'PlayerTurn';
}

export class Hud {
  private snapshot: GameSnapshot | null = null;
  private lastMarkup = '';
  private suppressClickUntil = 0;
  private lastAttackKey: string | null = null;
  private playerHitFlashUntil = 0;
  private selectedTargetId: string | null = null;
  private enemyInfoVisible = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly onIntent: (intent: Intent) => void
  ) {
    this.root.addEventListener('pointerdown', (event) => this.handleActivation(event), { capture: true });
    this.root.addEventListener('click', (event) => this.handleActivation(event), { capture: true });
  }

  private handleActivation(event: Event): void {
    const now = performance.now();
    if (event.type === 'click' && now < this.suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLButtonElement>('button');
    if (!button || button.disabled) {
      return;
    }

    const targetEnemyId = button.dataset.targetEnemyId;
    if (targetEnemyId) {
      event.preventDefault();
      if (event.type === 'pointerdown') {
        this.suppressClickUntil = now + 500;
      }
      event.stopPropagation();
      this.selectedTargetId = this.selectedTargetId === targetEnemyId ? null : targetEnemyId;
      if (this.snapshot) {
        this.render(this.snapshot);
      }
      return;
    }

    if (button.matches('[data-enemy-toggle]')) {
      event.preventDefault();
      if (event.type === 'pointerdown') {
        this.suppressClickUntil = now + 500;
      }
      event.stopPropagation();
      this.enemyInfoVisible = !this.enemyInfoVisible;
      if (this.snapshot) {
        this.render(this.snapshot);
      }
      return;
    }

    const action = this.intentForButton(button);
    if (!action) {
      return;
    }

    event.preventDefault();
    if (event.type === 'pointerdown') {
      this.suppressClickUntil = now + 500;
    }
    event.stopPropagation();
    this.onIntent(action.intent);
  }

  private intentForButton(button: HTMLButtonElement): { key: string; intent: Intent } | null {
    const rewardCardId = button.dataset.rewardCardId;
    if (rewardCardId) {
      return {
        key: `select-reward:${rewardCardId}`,
        intent: { type: 'select-reward', cardId: rewardCardId, traceId: nextTraceId('reward') }
      };
    }

    const cardId = button.dataset.cardId;
    if (cardId) {
      const card = cards[cardId];
      const selectedTargetId =
        card?.targets === 'front-enemy'
          ? this.validSelectedTargetIdFor(button.dataset.selectedTargetId ?? this.selectedTargetId)
          : null;
      return {
        key: `play-card:${cardId}`,
        intent: {
          type: 'play-card',
          cardId,
          ...(selectedTargetId ? { targetId: selectedTargetId } : {}),
          traceId: nextTraceId('pointer')
        }
      };
    }

    if (button.matches('[data-restart]')) {
      return {
        key: 'restart-run',
        intent: { type: 'restart-run', traceId: nextTraceId('restart') }
      };
    }

    if (button.matches('[data-deal]')) {
      return {
        key: 'deal-hand',
        intent: { type: 'deal-hand', traceId: nextTraceId('deal') }
      };
    }

    if (button.matches('[data-end-turn]')) {
      return {
        key: 'end-turn',
        intent: { type: 'end-turn', traceId: nextTraceId('end-turn') }
      };
    }

    return null;
  }

  render(snapshot: GameSnapshot): void {
    this.snapshot = snapshot;
    const attackEvents = snapshot.debug.events.filter((event) => event.type === 'EnemyAttacked');
    const latestAttack = attackEvents[attackEvents.length - 1];
    if (latestAttack) {
      const attackKey = `${latestAttack.traceId}:${latestAttack.tick}:${latestAttack.enemyId}:${latestAttack.remainingHp}`;
      if (attackKey !== this.lastAttackKey) {
        this.lastAttackKey = attackKey;
        this.playerHitFlashUntil = performance.now() + 620;
      }
    }
    const playerHitClass = performance.now() < this.playerHitFlashUntil ? 'player-hit' : '';
    this.selectedTargetId = this.validSelectedTargetId(snapshot);
    const selectedTarget = this.selectedTargetId
      ? snapshot.enemies.find((enemy) => enemy.id === this.selectedTargetId) ?? null
      : null;
    const latestCombat = snapshot.debug.events
      .map((event) => this.combatEventLabel(event, snapshot))
      .filter((label): label is string => Boolean(label))
      .slice(-2)
      .reverse();
    const latestTrace = snapshot.debug.trace
      .filter((trace) => !trace.traceId.startsWith('tick-') && trace.label !== 'TimeAdvanced')
      .slice(-12)
      .reverse();
    const latestFailed = snapshot.debug.failedConditions.slice(-4).reverse();
    const latestRules = snapshot.debug.ruleHits.slice(-5).reverse();
    const latestCommands = snapshot.debug.commands.slice(-5).reverse();
    const isPlayerTurn = snapshot.fsm.gameFlow === 'PlayerTurn';
    const isDeal = snapshot.fsm.gameFlow === 'Deal';
    const isSettlement = snapshot.fsm.gameFlow === 'Settlement';
    const hpFill = Math.max(0, Math.min(100, (snapshot.player.hp / snapshot.player.maxHp) * 100));
    const energyFill = Math.max(0, Math.min(100, (snapshot.player.energy / snapshot.player.maxEnergy) * 100));
    const energyText = Number.isInteger(snapshot.player.energy) ? snapshot.player.energy.toFixed(0) : snapshot.player.energy.toFixed(1);
    const chainStarted = snapshot.player.lastPlayedCost !== null;
    const nextChainCost = chainStarted ? snapshot.player.lastPlayedCost! + 1 : 0;
    const nextChainMultiplier = chainStarted ? snapshot.player.costChainMultiplier + 1 : 1;
    const chainRouteLabel = this.chainRouteLabel(snapshot);
    const chainHint = chainStarted ? `Next MP${nextChainCost} -> x${nextChainMultiplier}` : 'Start MP0';
    const frontEnemySlots = Array.from({ length: ENEMY_COLUMNS }, (_, slot) =>
      snapshot.enemies.find((enemy) => enemy.alive && enemy.slot === slot)
    );
    const livingFrontEnemies = frontEnemySlots.filter(Boolean).length;
    const flowLabel =
      snapshot.fsm.gameFlow === 'Deal'
        ? '回合开始'
        : snapshot.fsm.gameFlow === 'PlayerTurn'
          ? '玩家出牌'
          : snapshot.fsm.gameFlow === 'EnemyAttack'
            ? '怪物攻击'
        : snapshot.fsm.gameFlow === 'EnemyRefill'
          ? '怪物补位'
          : snapshot.fsm.gameFlow === 'Reward'
            ? '升级奖励'
          : snapshot.fsm.gameFlow === 'Settlement'
            ? '游戏结束'
            : snapshot.fsm.gameFlow;
    const activeEnemies = snapshot.enemies.filter((enemy) => enemy.alive);
    const frontThreatEnemies = activeEnemies.filter((enemy) => enemy.slot >= 0 && enemy.slot < ENEMY_COLUMNS);
    const priorityThreat = [...frontThreatEnemies].sort((left, right) => left.hp - right.hp)[0];
    const enemyIntent = this.enemyIntentSummary(frontThreatEnemies);
    const unresolvedIntentLabel =
      enemyIntent.totalDamage > 0
        ? `未解决 ${enemyIntent.totalDamage} 伤害`
        : activeEnemies.length > 0
          ? '前排暂无伤害'
          : '清场无后果';
    const playableCount = snapshot.player.hand.filter((cardId) => {
      const card = cards[cardId];
      return isPlayerTurn && snapshot.player.energy >= card.cost;
    }).length;
    const playableVerbs = Array.from(
      new Set(
        snapshot.player.hand
          .filter((cardId) => isPlayerTurn && snapshot.player.energy >= cards[cardId].cost)
          .map((cardId) => cards[cardId].verb)
      )
    ).slice(0, 4);
    const burstCardsReady = snapshot.player.hand.some((cardId) => {
      const card = cards[cardId];
      return isPlayerTurn && card.targets === 'all-enemies' && snapshot.player.energy >= card.cost;
    });
    const burstRecentlyFired = snapshot.lastBurstTick !== null && snapshot.tick - snapshot.lastBurstTick <= 8;
    const nearClear = activeEnemies.length > 0 && activeEnemies.length <= 3;
    const directorState = burstRecentlyFired
      ? 'burst-fired'
      : burstCardsReady
        ? 'burst-ready'
        : nearClear
          ? 'near-clear'
          : '';
    const threatLabel =
      frontThreatEnemies.length > 0
        ? `${frontThreatEnemies.length} 前排压线`
        : activeEnemies.length > 0
          ? `${activeEnemies.length} 后排压上`
          : '清场窗口';
    const threatDetail = priorityThreat
      ? `${priorityThreat.name} HP ${priorityThreat.hp}/${priorityThreat.maxHp}`
      : activeEnemies.length > 0
        ? '下一波正在补位'
        : '回收节奏，准备下一轮';
    const actionLabel = isPlayerTurn
      ? playableCount > 0
        ? `${playableCount} 可打 · ${playableVerbs.join(' / ')}`
        : '无可打牌'
      : flowLabel;
    const payoffPreview = this.payoffPreviewLabel(snapshot);
    const deckLoopLabel = `Deck ${snapshot.player.deck.length} · Draw ${snapshot.player.drawPile.length} · Discard ${snapshot.player.discardPile.length} · Hand ${snapshot.player.hand.length}`;
    const canEndTurn = canHudEndTurn(snapshot.fsm.gameFlow);
    const endTurnTitle = isPlayerTurn ? `结束当前玩家回合；${unresolvedIntentLabel}` : '当前不是玩家出牌阶段';
    const emptyHandText = isDeal
        ? '回合开始，先发牌。'
      : isSettlement
        ? '你已阵亡，点击重新开始。'
        : snapshot.fsm.gameFlow === 'Reward'
        ? '升级奖励选择中。'
        : isPlayerTurn
        ? '手牌已空，点击结束回合。'
        : '等待回合阶段结算。';

    const markup = `
      <section class="status-strip" aria-label="status">
        <div class="resource-chip hp-chip ${playerHitClass}" style="--fill: ${hpFill}%">
          <span class="resource-head">
            <strong>HP</strong>
            <em>${snapshot.player.hp.toFixed(0)} / ${snapshot.player.maxHp}</em>
          </span>
          <span class="resource-meter" aria-hidden="true"><i></i></span>
        </div>
        <div class="resource-chip mp-chip" style="--fill: ${energyFill}%">
          <span class="resource-head">
            <strong>MP</strong>
            <em>${energyText} / ${snapshot.player.maxEnergy}</em>
          </span>
          <span class="resource-meter" aria-hidden="true"><i></i></span>
        </div>
        <div class="status-chip xp-chip">
          <strong>LV ${snapshot.player.level}</strong>
          <span>XP ${snapshot.player.xp} / ${snapshot.reward.xpThreshold}</span>
        </div>
        <div class="status-chip chain-chip ${chainStarted ? 'active' : ''}">
          <strong>CHAIN</strong>
          <span>${chainRouteLabel}</span>
          <em>${chainHint}</em>
        </div>
        <div class="status-chip intent-chip ${enemyIntent.totalDamage > 0 ? 'danger' : ''}">
          <strong>意图</strong>
          <span>${enemyIntent.totalDamage > 0 ? `-${enemyIntent.totalDamage} HP` : '安全'}</span>
          <em>${enemyIntent.detail}</em>
        </div>
        <div class="status-chip phase-chip">
          <strong>FSM</strong>
          <span>R${snapshot.round} ${flowLabel}</span>
        </div>
        <div class="status-chip pile-chip" title="${deckLoopLabel}">
          <strong>牌堆</strong>
          <span>${snapshot.player.deck.length}/${snapshot.player.drawPile.length}/${snapshot.player.discardPile.length}/${snapshot.player.hand.length}</span>
          <em>牌库/抽/弃/手</em>
        </div>
        <button type="button" data-restart>Restart</button>
      </section>

      <section class="combat-director chain-director ${directorState}" aria-label="hyper turn chain director">
        <div class="director-cell director-chain">
          <span>本回合链路</span>
          <strong>${chainRouteLabel}</strong>
          <em>${chainHint}</em>
        </div>
        <div class="director-cell director-action">
          <span>下一张期望</span>
          <strong>${chainStarted ? `MP ${nextChainCost}` : 'MP 0'}</strong>
          <em>${actionLabel}</em>
        </div>
        <div class="director-cell director-intent">
          <span>敌人意图</span>
          <strong>${enemyIntent.totalDamage > 0 ? `将受 ${enemyIntent.totalDamage} 伤害` : threatLabel}</strong>
          <em>${enemyIntent.detail || threatDetail}</em>
        </div>
        <div class="director-cell director-payoff">
          <span>Payoff 预览</span>
          <strong>${payoffPreview.title}</strong>
          <em>${payoffPreview.detail}</em>
        </div>
      </section>

      <section class="deal-panel" aria-label="deal cards">
        <div>
          <span>回合 ${snapshot.round}</span>
          <strong>${flowLabel}</strong>
          <small>${
            isDeal
              ? '按 D 或点击发牌'
                : isSettlement
                  ? '本局已结束'
              : snapshot.fsm.gameFlow === 'Reward'
                ? deckLoopLabel
              : isPlayerTurn
                ? `${unresolvedIntentLabel} · 可出牌 ${playableCount}`
                : '怪物正在结算'
          }</small>
        </div>
        ${
          isDeal
            ? '<button type="button" data-deal aria-label="发牌进入玩家出牌阶段">发牌</button>'
            : isSettlement
              ? '<button type="button" data-restart aria-label="重新开始本局">重新开始</button>'
            : `<button type="button" data-end-turn aria-label="${endTurnTitle}" title="${endTurnTitle}" ${canEndTurn ? '' : 'disabled'}>结束回合</button>`
        }
      </section>

      <section class="target-panel ${selectedTarget ? 'target-locked' : 'target-random'}" aria-label="target selection">
        <strong>目标</strong>
        <span>${selectedTarget ? selectedTarget.name : '未选择，单体牌随机前排'}</span>
      </section>

      <section class="enemy-peek ${this.enemyInfoVisible ? 'enemy-info-visible' : ''}" aria-label="front enemy target controls">
        <button
          type="button"
          class="enemy-peek-toggle"
          data-enemy-toggle
          aria-expanded="${this.enemyInfoVisible}"
          title="${this.enemyInfoVisible ? '隐藏前排怪物信息' : '显示第一排怪物信息与目标按钮'}"
        >
          ${this.enemyInfoVisible ? '隐藏前排' : `前排显影 ${livingFrontEnemies}`}
        </button>
        ${
          this.enemyInfoVisible
            ? `<div class="enemy-slot-strip" aria-label="front enemy slots">
                ${frontEnemySlots.map((enemy, index) => this.renderEnemySlot(enemy, index)).join('')}
              </div>`
            : ''
        }
      </section>

      <section class="combat-feed" aria-label="combat feed" aria-live="polite">
        <header>
          <strong>战斗信息</strong>
          <span>${isDeal ? '待发牌' : flowLabel}</span>
        </header>
        <ol>
          ${
            latestCombat.length > 0
              ? latestCombat.map((label) => `<li>${label}</li>`).join('')
              : '<li>回合开始，点击发牌。</li>'
          }
        </ol>
      </section>

      ${
        isSettlement
          ? `<section class="game-over-panel" aria-label="game over">
              <span>Game Over</span>
              <strong>你已阵亡</strong>
              <small>回合 ${snapshot.round} · 敌群突破防线</small>
              <button type="button" data-restart>重新开始</button>
            </section>`
          : ''
      }

      ${
        snapshot.fsm.gameFlow === 'Reward'
          ? `<section class="reward-panel" aria-label="level reward">
              <header>
                <span>Level ${snapshot.player.level}</span>
                <strong>选择一张新牌加入牌组</strong>
                <small>击杀获得经验，升级后奖励会进入后续抽牌循环。</small>
              </header>
              <div class="reward-choices">
                ${snapshot.reward.choices.map((cardId) => this.renderRewardChoice(cardId)).join('')}
              </div>
            </section>`
          : ''
      }

      <section class="card-row" aria-label="cards">
        ${
          isSettlement
            ? `<div class="empty-hand game-ended">${emptyHandText}</div>`
            : snapshot.player.hand.length === 0
            ? `<div class="empty-hand">${emptyHandText}</div>`
            : snapshot.player.hand
                .map((cardId, index) => {
                  const card = cards[cardId];
                  const missingEnergy = Math.max(0, card.cost - snapshot.player.energy);
                  const disabled = !isPlayerTurn || missingEnergy > 0;
                  const reason = disabled
                    ? !isPlayerTurn
                      ? '当前不是玩家出牌阶段，不能出牌'
                      : `MP 不足：还差 ${missingEnergy}`
                    : `出牌：${card.name}`;
                  const targetLabel = this.targetLabel(card.targets);
                  const effectLabel = this.cardEffectLabel(card);
                  const chainRead = this.cardChainRead(card, snapshot);
                  const costLabel = this.cardCostLabel(card);
                  const chainPreview = chainRead.label;
                  const payoffLabel = this.cardPayoffLabel(card, chainRead.multiplier);
                  const activeTargetLabel = card.targets === 'front-enemy' && selectedTarget ? `目标 ${selectedTarget.name}` : targetLabel;
                  const selectedTargetAttr =
                    card.targets === 'front-enemy' && selectedTarget ? `data-selected-target-id="${selectedTarget.id}"` : '';
                  const tooltip = `${reason}。${chainPreview} · ${costLabel} · ${effectLabel}${payoffLabel ? ` · ${payoffLabel}` : ''}。${this.visibleCardDescription(card.description)}`;
                  const missingText =
                    isPlayerTurn && missingEnergy > 0
                      ? `<em class="missing-cost">缺 MP ${missingEnergy}</em>`
                      : '';
                  return `
                    <button class="card-button ${card.targets === 'all-enemies' ? 'burst-card' : ''} ${chainRead.className} ${
                      disabled && isPlayerTurn ? 'locked-card' : ''
                    }" type="button" data-card-id="${card.id}" ${selectedTargetAttr} aria-label="${reason}" title="${tooltip}" ${
                      disabled ? 'disabled' : ''
                    }>
                      <span class="card-cost"><small>MP</small><b>${card.cost}</b></span>
                      <span class="hotkey">#${index + 1}</span>
                      <strong>${card.name}</strong>
                      <span class="card-meta">${card.verb} · ${activeTargetLabel}</span>
                      <span class="chain-preview ${chainRead.breaksChain ? 'breaks-chain' : ''}">${chainPreview}</span>
                      ${payoffLabel ? `<span class="card-payoff">${payoffLabel}</span>` : ''}
                      <small class="card-effect">${costLabel} · ${effectLabel}</small>
                      ${missingText}
                    </button>
                  `;
                })
                .join('')
        }
      </section>

      <details class="debug-panel" aria-label="debug trace">
        <summary>
          <strong>Debug Trace</strong>
          <span>round ${snapshot.round}</span>
        </summary>
        <dl>
          <dt>Rules</dt>
          <dd>${latestRules.map((rule) => `${rule.ruleId}:${rule.passed ? 'ok' : 'fail'}`).join('<br>') || 'none'}</dd>
          <dt>Failed Conditions</dt>
          <dd>${latestFailed.map((item) => `${item.conditionId}: ${item.reason}`).join('<br>') || 'none'}</dd>
          <dt>Commands</dt>
          <dd>${latestCommands.map((command) => command.type).join('<br>') || 'none'}</dd>
          <dt>Trace</dt>
          <dd>${latestTrace.map((trace) => `${trace.traceId} · ${trace.label}`).join('<br>') || 'none'}</dd>
        </dl>
      </details>
    `;
    if (markup !== this.lastMarkup) {
      this.root.innerHTML = markup;
      this.lastMarkup = markup;
    }
  }

  private renderEnemySlot(enemy: EnemySnapshot | undefined, index: number): string {
    const row = Math.floor(index / ENEMY_COLUMNS) + 1;
    const column = (index % ENEMY_COLUMNS) + 1;
    const rowClass = index < ENEMY_COLUMNS ? 'front-row' : 'queue-row';
    const slotLabel = `${row}-${column}`;
    const isFrontSlot = index < ENEMY_COLUMNS;

    if (!enemy) {
      return `<div class="enemy-slot empty ${rowClass}"><span class="slot-id">${slotLabel}</span><strong>空槽</strong><small>补位中</small></div>`;
    }

    const type = this.enemyTypeMeta(enemy.definitionId);
    const selectedClass = this.selectedTargetId === enemy.id ? 'target-selected' : '';
    const targetAttrs = isFrontSlot
      ? `type="button" data-target-enemy-id="${enemy.id}" aria-pressed="${this.selectedTargetId === enemy.id}" title="选择 ${enemy.name} 作为单体牌目标"`
      : '';
    const tag = isFrontSlot ? 'button' : 'div';
    return `
      <${tag} class="enemy-slot occupied ${rowClass} ${type.className} ${isFrontSlot ? 'targetable' : ''} ${selectedClass}" ${targetAttrs}>
        <span class="slot-id">${slotLabel}</span>
        <span class="type-badge">${type.label}</span>
        <strong>${enemy.name}</strong>
        <small>${enemy.hp}/${enemy.maxHp}</small>
      </${tag}>
    `;
  }

  private renderRewardChoice(cardId: string): string {
    const card = cards[cardId];
    if (!card) {
      return '';
    }

    const targetLabel = this.targetLabel(card.targets);
    const effectLabel = this.cardEffectLabel(card);
    const costLabel = this.cardCostLabel(card);
    return `
      <button class="reward-card ${card.targets === 'front-row' ? 'row-card' : ''}" type="button" data-reward-card-id="${card.id}" title="${costLabel} · ${effectLabel}。${this.visibleCardDescription(card.description)}">
        <span>${card.verb} · ${targetLabel}</span>
        <strong>${card.name}</strong>
        <small>${costLabel} · ${effectLabel}</small>
        <em>${this.visibleCardDescription(card.description)}</em>
      </button>
    `;
  }

  private cardCostLabel(card: CardDefinition): string {
    return `MP ${card.cost}`;
  }

  private cardChainRead(
    card: CardDefinition,
    snapshot: GameSnapshot
  ): { label: string; multiplier: number; breaksChain: boolean; className: string } {
    const hasEnergy = snapshot.player.energy >= card.cost;
    const isPlayerTurn = snapshot.fsm.gameFlow === 'PlayerTurn';

    if (snapshot.player.lastPlayedCost === null) {
      const startsChain = card.cost === 0;
      return {
        label: startsChain ? '起链 x1' : '非起手 x1',
        multiplier: 1,
        breaksChain: false,
        className: isPlayerTurn && hasEnergy && startsChain ? 'chain-match' : ''
      };
    }

    const continues = card.cost === snapshot.player.lastPlayedCost + 1;
    const multiplier = continues ? snapshot.player.costChainMultiplier + 1 : 1;
    return {
      label: continues ? `接链 x${multiplier}` : '断链 x1',
      multiplier,
      breaksChain: !continues,
      className: isPlayerTurn && hasEnergy ? (continues ? 'chain-match' : 'chain-break-risk') : ''
    };
  }

  private chainRouteLabel(snapshot: GameSnapshot): string {
    const lastCost = snapshot.player.lastPlayedCost;
    if (lastCost === null) {
      return 'MP0?';
    }

    const chainLength = Math.max(1, snapshot.player.costChainMultiplier);
    const firstCost = Math.max(0, lastCost - chainLength + 1);
    const costs = Array.from({ length: chainLength }, (_, index) => `MP${firstCost + index}`);
    return costs.join(' -> ');
  }

  private enemyIntentSummary(enemies: EnemySnapshot[]): { totalDamage: number; detail: string } {
    const intentEnemies = enemies.filter((enemy) => enemy.slot >= 0 && enemy.slot < ENEMY_COLUMNS);
    const totalDamage = intentEnemies.reduce((sum, enemy) => sum + this.enemyIntentDamage(enemy), 0);
    const detail =
      intentEnemies.length > 0
        ? intentEnemies
            .slice(0, 2)
            .map((enemy) => `${enemy.name} ${this.enemyIntentDamage(enemy)}`)
            .join(' / ') + (intentEnemies.length > 2 ? ` / +${intentEnemies.length - 2}` : '')
        : '无前排攻击';
    return { totalDamage, detail };
  }

  private enemyIntentDamage(enemy: EnemySnapshot): number {
    return enemyDamageByDefinition.get(enemy.definitionId) ?? 0;
  }

  private payoffPreviewLabel(snapshot: GameSnapshot): { title: string; detail: string } {
    const candidates = snapshot.player.hand
      .map((cardId) => cards[cardId])
      .filter((card): card is CardDefinition => Boolean(card))
      .filter((card) => this.isPayoffCard(card) && snapshot.player.energy >= card.cost)
      .map((card) => ({ card, chain: this.cardChainRead(card, snapshot) }))
      .sort((left, right) => right.chain.multiplier - left.chain.multiplier || right.card.damage - left.card.damage);

    const best = candidates[0];
    if (!best) {
      return { title: '等待终结牌', detail: '用 0->1->2 找 payoff' };
    }

    return {
      title: `${best.card.name} x${best.chain.multiplier}`,
      detail: this.cardPayoffLabel(best.card, best.chain.multiplier) || this.cardEffectLabel(best.card)
    };
  }

  private cardPayoffLabel(card: CardDefinition, multiplier: number): string {
    if (!this.isPayoffCard(card)) {
      return '';
    }

    if (card.damage <= 0 && !card.drawCards) {
      return '';
    }

    const damage = card.damage > 0 ? `${this.damageScopeLabel(card.targets)} ${card.damage * multiplier}` : '';
    const draw = card.drawCards ? `抽${card.drawCards}` : '';
    const parts = [damage, draw].filter(Boolean);
    return `Payoff x${multiplier}: ${parts.join(' · ')}`;
  }

  private isPayoffCard(card: CardDefinition): boolean {
    return card.comboNode === 'burst' || card.cost >= 2 || card.targets === 'all-enemies';
  }

  private cardEffectLabel(card: CardDefinition): string {
    const effects: string[] = [];

    if (card.damage > 0) {
      effects.push(`${this.damageScopeLabel(card.targets)} ${card.damage}伤害`);
    }

    if (card.drawCards) {
      effects.push(`抽${card.drawCards}`);
    }

    return effects.length > 0 ? effects.join(' · ') : this.targetLabel(card.targets);
  }

  private visibleCardDescription(description: string): string {
    const cleaned = description.trim();
    return cleaned || '按费用顺序出牌可提高连锁倍率。';
  }

  private damageScopeLabel(targets: CardDefinition['targets']): string {
    if (targets === 'front-row') {
      return '前排群攻';
    }

    if (targets === 'all-enemies') {
      return '全场';
    }

    return '单体';
  }

  private targetLabel(targets: string): string {
    if (targets === 'front-row') {
      return '第一排';
    }

    if (targets === 'all-enemies') {
      return '全场';
    }

    if (targets === 'self') {
      return '自身';
    }

    return '随机前排';
  }

  private validSelectedTargetId(snapshot = this.snapshot): string | null {
    return this.validSelectedTargetIdFor(this.selectedTargetId, snapshot);
  }

  private validSelectedTargetIdFor(targetId: string | null | undefined, snapshot = this.snapshot): string | null {
    return validHudSelectedTargetId(targetId, snapshot?.enemies);
  }

  private enemyTypeMeta(definitionId: string): { label: string; className: string } {
    if (definitionId === 'redline_brute') {
      return { label: 'BRU', className: 'enemy-type-brute' };
    }

    if (definitionId === 'pulse_collector') {
      return { label: 'COL', className: 'enemy-type-collector' };
    }

    return { label: 'WSP', className: 'enemy-type-wisp' };
  }

  private combatEventLabel(event: GameEvent, snapshot: GameSnapshot): string | null {
    if (event.type === 'HandDealt') {
      return `发牌 ${event.cardIds.length} 张，进入出牌`;
    }

    if (event.type === 'CardPlayed') {
      return `出牌 ${cards[event.cardId]?.name ?? event.cardId} · 倍率 x${event.effectMultiplier}`;
    }

    if (event.type === 'TurnEnded') {
      return `结束回合 ${event.round}，前排反击`;
    }

    if (event.type === 'EnemyAttacked') {
      const enemy = snapshot.enemies.find((item) => item.id === event.enemyId);
      return `${enemy?.name ?? event.enemyId} 攻击 -${event.amount} HP`;
    }

    if (event.type === 'DamageApplied') {
      const enemy = snapshot.enemies.find((item) => item.id === event.targetId);
      return `命中 ${enemy?.name ?? event.targetId} -${event.amount}，剩 ${event.remainingHp}`;
    }

    if (event.type === 'EnemyKilled') {
      const enemy = snapshot.enemies.find((item) => item.id === event.enemyId);
      return `击杀 ${enemy?.name ?? event.enemyId}，后排压上`;
    }

    if (event.type === 'XpGained') {
      return `经验 +${event.amount}，当前 ${event.totalXp}`;
    }

    if (event.type === 'LevelUpReached') {
      return `升级到 LV ${event.level}，选择奖励`;
    }

    if (event.type === 'RewardChosen') {
      return `获得新牌 ${cards[event.cardId]?.name ?? event.cardId}`;
    }

    if (event.type === 'EnemiesRepositioned') {
      return '敌群补位完成，后排压上';
    }

    if (event.type === 'RoundStarted') {
      return `回合 ${event.round} 开始`;
    }

    if (event.type === 'ClearBurstRequested') {
      return '全场处刑触发';
    }

    return null;
  }

  getSnapshot(): GameSnapshot | null {
    return this.snapshot;
  }
}
