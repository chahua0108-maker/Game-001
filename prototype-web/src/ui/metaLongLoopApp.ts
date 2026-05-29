import { CANONICAL_DISTRICT_IDS, CANONICAL_MAP_NODE_IDS, CANONICAL_STARTER_KIT_IDS, type ShopItemId } from '../config/schema/ids';
import { cards } from '../data/cards';
import { createLongLoopOrchestrator, type LongLoopOrchestrator } from '../meta/orchestrator';
import type { NextRunSnapshot, RunLoopRunState, SettlementSummary, ShopPurchaseResult } from '../meta/orchestrator/orchestratorTypes';
import { createProfileStore, type ProfileStore } from '../meta/profile/profileStore';
import { loadProfile, PROFILE_STORAGE_KEY, saveProfile } from '../meta/profile/profileStorage';
import type { LongLoopProfile, ProfileStorageOptions } from '../meta/profile/profileTypes';
import { crawlerReads, type CrawlerRead } from '../meta/systems/crawler/crawlerSelectors';
import { mapNodeReads, type MapNodeRead } from '../meta/systems/map/mapSelectors';
import { selectShopItemReads, type ShopItemRead } from '../meta/systems/shop/shopSelectors';
import { starterReads, type StarterRead } from '../meta/systems/starter/starterSelectors';

export interface MetaLongLoopAppOptions extends Pick<ProfileStorageOptions, 'storage' | 'storageKey' | 'profileId'> {
  readonly onCombatVisibilityChange?: (isVisible: boolean) => void;
}

type MetaView = 'hub' | 'brief' | 'run' | 'settlement' | 'shop';

const STABLE_CHAIN_ITEM_ID = 'starter_stable_chain' as ShopItemId;
const D1_DISTRICT_ID = CANONICAL_DISTRICT_IDS.d1;
const DEFAULT_STARTER_ID = CANONICAL_STARTER_KIT_IDS.defaultChain;
const PLAYER_CARD_NAMES: Record<string, string> = {
  debt_hook: '债钩',
  redline_cut: '红线斩',
  wild_mana_stitch: '野性法力缝合',
  wild_gap_key: '野隙钥',
  severance_burst: '断离爆发'
};
const DISTRICT_DISPLAY_NAMES: Record<string, string> = {
  [CANONICAL_MAP_NODE_IDS.d1]: 'D1 红线闸门',
  [CANONICAL_MAP_NODE_IDS.d2]: 'D2 分岔大厅',
  [CANONICAL_MAP_NODE_IDS.d3]: 'D3 铁圣龛试炼',
  [CANONICAL_MAP_NODE_IDS.d4]: 'D4 灰烬污染门',
  [CANONICAL_MAP_NODE_IDS.d5]: 'D5 灰烬通行路',
  [CANONICAL_MAP_NODE_IDS.d6]: 'D6 余烬接力站',
  [CANONICAL_MAP_NODE_IDS.d7]: 'D7 精英灯叉',
  [CANONICAL_MAP_NODE_IDS.d8]: 'D8 月下裂口',
  [CANONICAL_MAP_NODE_IDS.d9]: 'D9 死神收费站',
  [CANONICAL_MAP_NODE_IDS.d10]: 'D10 绯红王冠'
};
const CRAWLER_NAMES: Record<string, string> = {
  'Blood Runner': '血奔者',
  'Iron Monk': '铁僧'
};
const STARTER_NAMES: Record<string, string> = {
  'Default Chain': '默认链',
  'Stable Chain': '稳定链'
};
const SHOP_ITEM_NAMES: Record<string, string> = {
  starter_stable_chain: '稳定链',
  blacksmith_raise_level_permit: '升阶许可',
  blacksmith_red_socket_permit: '赤槽许可',
  blacksmith_reroll_permit: '重铸许可'
};

export class MetaLongLoopApp {
  private profileStore: ProfileStore;
  private orchestrator: LongLoopOrchestrator;
  private view: MetaView = 'hub';
  private activeRun?: RunLoopRunState;
  private settlement?: SettlementSummary;
  private shopNotice = '';
  private readonly storage?: Storage;
  private readonly storageKey: string;
  private readonly profileId?: string;
  private readonly onCombatVisibilityChange?: (isVisible: boolean) => void;

  constructor(
    private readonly root: HTMLElement,
    options: MetaLongLoopAppOptions = {}
  ) {
    this.storage = options.storage;
    this.storageKey = options.storageKey ?? PROFILE_STORAGE_KEY;
    this.profileId = options.profileId;
    this.onCombatVisibilityChange = options.onCombatVisibilityChange;
    this.profileStore = createProfileStore({ snapshot: this.loadProfile() });
    this.orchestrator = createLongLoopOrchestrator({ profileStore: this.profileStore });
    this.root.addEventListener('click', (event) => this.handleClick(event));
  }

  render(): void {
    const profile = this.profileStore.getSnapshot();
    const nextRun = this.orchestrator.previewNextRun({ districtId: D1_DISTRICT_ID });
    const stableStarter = starterReads(profile).find((starter) => starter.name === 'Stable Chain');

    this.root.innerHTML = `
      <main class="meta-long-loop-app view-${this.view}" aria-label="远征中枢">
        ${this.renderHeader(profile)}
        ${this.view === 'hub' ? this.renderHub(profile, nextRun, stableStarter) : ''}
        ${this.view === 'brief' ? this.renderBrief(profile, nextRun) : ''}
        ${this.view === 'run' ? this.renderRun(profile, nextRun) : ''}
        ${this.view === 'settlement' ? this.renderSettlement(profile, nextRun) : ''}
        ${this.view === 'shop' ? this.renderShop(profile, nextRun) : ''}
      </main>
    `;

    this.onCombatVisibilityChange?.(this.view === 'run');
  }

  startD1Brief(): void {
    this.view = 'brief';
    this.render();
  }

  startD1Run(): void {
    const nextRun = this.orchestrator.previewNextRun({ districtId: D1_DISTRICT_ID });
    this.activeRun = this.orchestrator.startRun({
      districtId: D1_DISTRICT_ID,
      starterKitId: nextRun.selectedStarterKitId || DEFAULT_STARTER_ID
    });
    this.view = 'run';
    this.persistProfile();
    this.render();
  }

  completeD1(): void {
    const run = this.activeRun ?? this.orchestrator.getCurrentRunState();
    if (!run) {
      this.view = 'brief';
      this.render();
      return;
    }

    this.settlement = this.orchestrator.settleRun({
      runId: run.id,
      districtId: D1_DISTRICT_ID,
      outcome: 'district_cleared'
    });
    this.activeRun = undefined;
    this.view = 'settlement';
    this.persistProfile();
    this.render();
  }

  goHub(): void {
    this.view = 'hub';
    this.render();
  }

  goShop(): void {
    this.view = 'shop';
    this.render();
  }

  buyStableChain(): void {
    const result = this.orchestrator.purchaseShopItem({ itemId: STABLE_CHAIN_ITEM_ID });
    this.shopNotice = this.purchaseNotice(result);
    if (result.ok) {
      this.persistProfile();
    }
    this.render();
  }

  private renderHeader(profile: LongLoopProfile): string {
    const selectedCrawler = selectedCrawlerName(profile);
    const selectedStarter = selectedStarterName(profile);

    return `
      <header class="meta-shell-header">
        <div>
          <span class="meta-shell-kicker">红线清算局</span>
          <h1>${escapeHtml(this.screenTitle())}</h1>
        </div>
        <dl class="meta-wallet" aria-label="钱包与配装" data-testid="wallet-summary">
          <div><dt>声望</dt><dd>${profile.wallet.softCurrency}</dd></div>
          <div><dt>宝石</dt><dd>${profile.wallet.metaGems}</dd></div>
          <div><dt>爬行者</dt><dd>${escapeHtml(selectedCrawler)}</dd></div>
          <div><dt>起手链</dt><dd>${escapeHtml(selectedStarter)}</dd></div>
        </dl>
      </header>
    `;
  }

  private screenTitle(): string {
    switch (this.view) {
      case 'brief':
        return 'D1 作战简报';
      case 'settlement':
        return '结算';
      case 'shop':
        return '远征商店';
      default:
        return '远征中枢';
    }
  }

  private renderHub(profile: LongLoopProfile, nextRun: NextRunSnapshot, stableStarter?: StarterRead): string {
    const purchasedStable = profile.shop.purchasedItemIds.includes(STABLE_CHAIN_ITEM_ID);

    return `
      <section class="meta-shell-grid" data-testid="long-loop-hub">
        <article class="meta-primary">
          <div class="meta-section-heading">
            <span>区域板</span>
            <strong>D1 已就绪</strong>
          </div>
          <div class="district-board">
            ${mapNodeReads(profile, 'P0').map((node) => this.renderDistrictCard(node)).join('')}
          </div>
        </article>

        <aside class="meta-side-stack">
          <section class="meta-panel d1-panel" data-testid="district-d1-card">
            <span class="meta-shell-kicker">下一次远征</span>
            <h2>D1 红线闸门</h2>
            <p>${purchasedStable ? '稳定链已为下一局装备。开局牌组会带上野隙钥和断离爆发。' : '清理闸门，获得声望、宝石、商店入口，以及第一条起手升级路线。'}</p>
            <button type="button" class="primary-action" data-meta-action="open-d1-brief" data-testid="start-d1">
              准备 D1
            </button>
          </section>

          ${purchasedStable ? this.renderProgressRibbon(profile) : ''}
          ${this.renderNextRunPreview(profile, nextRun, stableStarter)}
          ${this.renderLoadout(profile)}

          <button type="button" class="secondary-action" data-meta-action="shop" data-testid="nav-shop">
            打开商店
          </button>
        </aside>
      </section>
    `;
  }

  private renderBrief(profile: LongLoopProfile, nextRun: NextRunSnapshot): string {
    return `
      <section class="meta-focus brief-screen" data-testid="district-d1-card">
        <div class="meta-section-heading">
          <span>D1 简报</span>
          <strong>红线闸门</strong>
        </div>
        <div class="brief-command">
          <div>
            <span class="meta-shell-kicker">闸门契约</span>
            <h2>清理 D1，入账奖励，打开第一条起手升级。</h2>
            <p>穿过闸门后，先把结算奖励花出去，再进入下一次远征。</p>
          </div>
          <button type="button" class="primary-action" data-meta-action="start-d1-run" data-testid="start-d1">开始 D1</button>
        </div>
        <div class="brief-layout">
          <article>
            <h2>远征条件</h2>
            <p>预计通关奖励：+100 声望，+1 宝石。</p>
            <p>清理 D1 会开放商店，并揭示稳定链起手路线。</p>
          </article>
          <article>
            <h2>起始牌组</h2>
            <div class="card-chip-row">
              ${nextRun.starterPayload.starterCardIds.map((cardId) => cardChip(cardId)).join('')}
            </div>
          </article>
          <article>
            <h2>当前配装</h2>
            <p>${escapeHtml(selectedCrawlerName(profile))} 携带 ${escapeHtml(selectedStarterName(profile))}。</p>
          </article>
        </div>
        <div class="meta-action-row">
          <button type="button" class="ghost-action" data-meta-action="hub">返回中枢</button>
        </div>
      </section>
    `;
  }

  private renderRun(profile: LongLoopProfile, nextRun: NextRunSnapshot): string {
    const activeRun = this.activeRun ?? this.orchestrator.getCurrentRunState();
    const starterPayload = activeRun?.starterPayload ?? nextRun.starterPayload;
    const deckCards = starterPayload.starterCardIds.map(playerCardName);
    const stableRun = starterPayload.selectedStarterKitId === CANONICAL_STARTER_KIT_IDS.stableChain;
    const runId = activeRun?.id ?? 'preview';
    const starterKitId = activeRun?.starterKitId ?? nextRun.selectedStarterKitId;
    const title = stableRun ? '稳定链测试已开始' : 'D1 交战中';
    const body = stableRun
      ? `${selectedCrawlerName(profile)} 正在使用存档里的稳定链：${deckCards.join(' / ')}。完成闸门，证明升级已生效。`
      : `${selectedCrawlerName(profile)} 携带 ${selectedStarterName(profile)}：${deckCards.join(' / ')}。完成闸门，锁定结算奖励。`;
    const deckLabel = stableRun ? '新牌组' : '牌组';
    const deckValue = stableRun ? '野隙钥 + 断离爆发' : deckCards.slice(1).join(' + ') || deckCards[0];

    return `
      <section
        class="meta-run-panel"
        data-testid="district-d1-run"
        data-run-id="${escapeHtml(runId)}"
        data-starter-kit-id="${escapeHtml(starterKitId)}"
        data-deck-modifier-id="${escapeHtml(starterPayload.deckModifierId)}"
        data-starter-card-ids="${escapeHtml(starterPayload.starterCardIds.join(','))}"
      >
        <div>
          <span class="meta-shell-kicker">D1 红线闸门</span>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(body)}</p>
          <div class="run-beat-strip" aria-label="本局证明">
            <span><b>闸门</b>D1 红线</span>
            <span><b>${escapeHtml(deckLabel)}</b>${escapeHtml(deckValue)}</span>
            <span><b>奖励</b>+100 声望 / +1 宝石</span>
          </div>
        </div>
        <button type="button" class="primary-action" data-meta-action="complete-d1" data-testid="complete-d1">
          完成 D1
        </button>
      </section>
    `;
  }

  private renderSettlement(profile: LongLoopProfile, nextRun: NextRunSnapshot): string {
    const summary = this.settlement;
    const completedD1 = profile.map.clearedDistrictIds.includes(D1_DISTRICT_ID);

    return `
      <section class="meta-focus settlement-screen" data-testid="settlement-summary">
        <div class="meta-section-heading">
          <span>结算</span>
          <strong>${completedD1 ? 'D1 已清理' : '远征完成'}</strong>
        </div>
        <div class="settlement-rewards">
          <div><span>获得声望</span><strong>+${summary?.softCurrencyDelta ?? 100}</strong></div>
          <div><span>回收宝石</span><strong>+${summary?.metaGemDelta ?? 1}</strong></div>
          <div><span>商店入口</span><strong>已开放</strong></div>
          <div><span>地图推进</span><strong>D2 已侦察</strong></div>
        </div>
        <div class="meta-action-row settlement-actions">
          <button type="button" class="primary-action" data-meta-action="shop" data-testid="nav-shop">花费声望</button>
          <button type="button" class="ghost-action" data-meta-action="hub" data-testid="return-to-hub">返回中枢</button>
        </div>
        <div class="unlock-list">
          <p>商店现在上架稳定链，给后续 D1 尝试提供更稳的起手方案。</p>
          <p>铁匠服务已露出；等你攒够声望，就能购买许可。</p>
        </div>
        ${this.renderNextRunPreview(profile, nextRun)}
      </section>
    `;
  }

  private renderShop(profile: LongLoopProfile, nextRun: NextRunSnapshot): string {
    const stableStarter = starterReads(profile).find((starter) => starter.name === 'Stable Chain');
    const shopItems = selectShopItemReads(profile);
    const purchasedStable = profile.shop.purchasedItemIds.includes(STABLE_CHAIN_ITEM_ID);
    const stableItem = shopItems.find((item) => item.id === STABLE_CHAIN_ITEM_ID);
    const gridItems = purchasedStable ? shopItems : shopItems.filter((item) => item.id !== STABLE_CHAIN_ITEM_ID);

    return `
      <section class="meta-focus shop-screen" data-testid="shop-screen">
        <div class="meta-section-heading">
          <span>远征商店</span>
          <strong>可用声望：${profile.wallet.softCurrency}</strong>
        </div>
        ${this.shopNotice ? `<div class="shop-notice"><strong>升级已锁定</strong><span>${escapeHtml(this.shopNotice)}</span></div>` : ''}
        ${!purchasedStable && stableItem ? `<div class="shop-featured">${this.renderShopItem(stableItem, profile)}</div>` : ''}
        ${purchasedStable ? this.renderNextRunAction(profile, nextRun) : ''}
        ${this.renderNextRunPreview(profile, nextRun, stableStarter)}
        <div class="shop-grid">
          ${gridItems.map((item) => this.renderShopItem(item, profile)).join('')}
        </div>
        <div class="meta-action-row">
          <button type="button" class="ghost-action" data-meta-action="hub" data-testid="return-to-hub">返回中枢</button>
        </div>
      </section>
    `;
  }

  private renderNextRunAction(profile: LongLoopProfile, nextRun: NextRunSnapshot): string {
    const deckCards = nextRun.starterPayload.starterCardIds.map(playerCardName);

    return `
      <div class="next-run-action-card" data-testid="next-run-action-card">
        <div>
          <span class="meta-shell-kicker">下一局已准备</span>
          <strong>稳定链已拥有。</strong>
          <p>花费 80 声望。铁僧已装上稳定牌组。</p>
          <button type="button" class="primary-action" data-meta-action="open-d1-brief" data-testid="start-next-d1">开始下一次 D1</button>
          <div class="next-run-ready-grid payoff-delta-grid">
            <span><b>声望</b>100 -> ${profile.wallet.softCurrency}</span>
            <span data-testid="next-run-action-deck"><b>牌组</b>${escapeHtml(deckCards.slice(1).join(' + ') || deckCards[0])}</span>
            <span><b>爬行者</b>血奔者 -> ${escapeHtml(selectedCrawlerName(profile))}</span>
            <span><b>起手链</b>默认链 -> ${escapeHtml(selectedStarterName(profile))}</span>
          </div>
        </div>
      </div>
    `;
  }

  private renderProgressRibbon(profile: LongLoopProfile): string {
    return `
      <section class="progress-ribbon" data-testid="next-goal-ribbon" aria-label="已保存进度和下一目标">
        <span><b>D2</b>已侦察</span>
        <span><b>商店</b>开放</span>
        <span><b>存款</b>${profile.wallet.softCurrency} 声望 / ${profile.wallet.metaGems} 宝石</span>
        <span><b>下一步</b>测试稳定链，然后分岔</span>
      </section>
    `;
  }

  private renderDistrictCard(node: MapNodeRead): string {
    const districtLabel = `D${node.tier}`;
    const stateLabel = districtStateLabel(node);
    const unlockCopy = districtUnlockCopy(node);
    const displayName = districtDisplayName(node);
    const testId = node.tier === 1 ? ' data-testid="district-d1-card"' : '';

    return `
      <article class="district-card state-${node.state}"${testId}>
        <span>${escapeHtml(districtLabel)}</span>
        <strong>${escapeHtml(displayName)}</strong>
        <em>${escapeHtml(stateLabel)}</em>
        <p>${escapeHtml(unlockCopy)}</p>
      </article>
    `;
  }

  private renderLoadout(profile: LongLoopProfile): string {
    return `
      <section class="meta-panel">
        <div class="meta-section-heading compact">
          <span>爬行者与起手链</span>
          <strong>当前配装</strong>
        </div>
        <div class="loadout-grid">
          ${crawlerReads(profile).map((crawler) => loadoutRow(crawler)).join('')}
          ${starterReads(profile).map((starter) => loadoutRow(starter)).join('')}
        </div>
      </section>
    `;
  }

  private renderNextRunPreview(profile: LongLoopProfile, nextRun: NextRunSnapshot, stableStarter?: StarterRead): string {
    const purchasedStable = profile.shop.purchasedItemIds.includes(STABLE_CHAIN_ITEM_ID);
    const stableAvailable = purchasedStable || stableStarter?.state === 'unlocked' || stableStarter?.state === 'selected';
    const deckCards = nextRun.starterPayload.starterCardIds.map(playerCardName).join(' / ');
    const crawlerCopy = purchasedStable ? `${selectedCrawlerName(profile)} 搭配稳定链` : selectedCrawlerName(profile);
    const stableCopy = purchasedStable
      ? '已装备。下一局从稳定起始牌组开始'
      : stableAvailable
        ? '下一局可用'
        : '清理 D1 后可购买';

    return `
      <section class="meta-panel next-run-panel" data-testid="next-run-preview">
        <div class="meta-section-heading compact">
          <span>下一局预览</span>
          <strong>D1 红线闸门</strong>
        </div>
        <dl class="preview-list">
          <div><dt>爬行者</dt><dd>${escapeHtml(crawlerCopy)}</dd></div>
          <div><dt>起手链</dt><dd>${escapeHtml(selectedStarterName(profile))}</dd></div>
          <div><dt>起始牌组</dt><dd>${escapeHtml(deckCards)}</dd></div>
          <div><dt>稳定链</dt><dd${purchasedStable ? ' data-testid="stable-chain-owned"' : ''}>${stableCopy}</dd></div>
        </dl>
      </section>
    `;
  }

  private renderShopItem(item: ShopItemRead, profile: LongLoopProfile): string {
    const isStableChain = item.id === STABLE_CHAIN_ITEM_ID;
    const isAffordable = profile.wallet.softCurrency >= item.price;
    const canBuy = item.state === 'available' && isAffordable;
    const testId = isStableChain ? ' data-testid="shop-item-stable-chain"' : '';
    const buyTestId = isStableChain ? ' data-testid="buy-stable-chain"' : '';
    const buttonText = item.state === 'purchased' ? '已装备' : isAffordable ? '购买' : '声望不足';
    const impact = isStableChain
      ? '让铁僧带上更稳定的起手方案，直接影响下一次远征。'
      : '购买对应许可后，后续远征可使用这项铁匠服务。';

    return `
      <article class="shop-item state-${item.state}"${testId}>
        <div>
          <span>${escapeHtml(shopCategoryLabel(item))}</span>
          <strong>${escapeHtml(shopDisplayName(item))}</strong>
          <p>${escapeHtml(impact)}</p>
        </div>
        <div class="shop-buy-row">
          <em>${item.price} 声望</em>
          <button
            type="button"
            class="${canBuy ? 'primary-action' : 'secondary-action'}"
            data-meta-action="${isStableChain ? 'buy-stable-chain' : 'noop'}"
            ${buyTestId}
            ${canBuy ? '' : 'disabled'}
          >${escapeHtml(buttonText)}</button>
        </div>
        <small>${escapeHtml(shopStateCopy(item, isAffordable))}</small>
      </article>
    `;
  }

  private purchaseNotice(result: ShopPurchaseResult): string {
    if (result.ok) {
      return '稳定链已装备。铁僧已分配到稳定牌组；下一局会以野隙钥和断离爆发开局。';
    }

    switch (result.reason) {
      case 'already_purchased':
        return '稳定链已经拥有。';
      case 'insufficient_currency':
        return '购买稳定链前还需要更多声望。';
      case 'not_settlement_review':
        return '先清理 D1，再从结算商店购买。';
      case 'not_visible':
        return '清理 D1 后才会显示稳定链。';
      default:
        return '稳定链暂不可用。';
    }
  }

  private handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLButtonElement>('[data-meta-action]');
    if (!button || button.disabled) {
      return;
    }

    switch (button.dataset.metaAction) {
      case 'open-d1-brief':
        this.startD1Brief();
        break;
      case 'start-d1-run':
        this.startD1Run();
        break;
      case 'complete-d1':
        this.completeD1();
        break;
      case 'hub':
        this.goHub();
        break;
      case 'shop':
        this.goShop();
        break;
      case 'buy-stable-chain':
        this.buyStableChain();
        break;
    }
  }

  private loadProfile(): LongLoopProfile {
    return loadProfile({
      storage: this.storage,
      storageKey: this.storageKey,
      profileId: this.profileId
    });
  }

  private persistProfile(): void {
    const savedProfile = saveProfile(this.profileStore.exportSnapshot(), {
      storage: this.storage,
      storageKey: this.storageKey,
      profileId: this.profileId
    });
    this.profileStore.setSnapshot(savedProfile);
  }
}

function selectedCrawlerName(profile: LongLoopProfile): string {
  return crawlerName(crawlerReads(profile).find((crawler) => crawler.state === 'selected')?.name ?? 'Blood Runner');
}

function selectedStarterName(profile: LongLoopProfile): string {
  return starterName(starterReads(profile).find((starter) => starter.state === 'selected')?.name ?? 'Default Chain');
}

function cardChip(cardId: string): string {
  return `<span class="card-chip">${escapeHtml(playerCardName(cardId))}</span>`;
}

function playerCardName(cardId: string): string {
  return PLAYER_CARD_NAMES[cardId] ?? cards[cardId]?.name ?? cards[cardId]?.displayName ?? '未知卡';
}

function districtStateLabel(node: MapNodeRead): string {
  if (node.state === 'playable') {
    return node.tier === 1 ? '就绪' : '开放';
  }

  if (node.state === 'condition-visible') {
    return '已侦察';
  }

  return '锁定';
}

function districtUnlockCopy(node: MapNodeRead): string {
  if (node.tier === 1) {
    return '第一道闸门。清理后开放结算奖励。';
  }

  if (node.tier === 2) {
    return '清理 D1 后选择分岔路线。';
  }

  if (node.tier >= 3 && node.tier <= 4) {
    return '分岔开放后侦察这条路线。';
  }

  return '后续远征预览。穿过前面的闸门后解锁。';
}

function districtDisplayName(node: MapNodeRead): string {
  return DISTRICT_DISPLAY_NAMES[String(node.id)] ?? node.name;
}

function loadoutRow(read: StarterRead | CrawlerRead): string {
  const status = read.state === 'locked_preview' ? '锁定' : read.state === 'selected' ? '已选择' : '可用';
  return `
    <div class="loadout-row state-${read.state}">
      <strong>${escapeHtml(loadoutName(read.name))}</strong>
      <span>${escapeHtml(status)}</span>
    </div>
  `;
}

function shopDisplayName(item: ShopItemRead): string {
  return SHOP_ITEM_NAMES[item.id] ?? item.name.replace(/^Blacksmith /, '');
}

function shopCategoryLabel(item: ShopItemRead): string {
  if (item.id === STABLE_CHAIN_ITEM_ID) {
    return '起手链';
  }

  return '铁匠服务';
}

function shopStateCopy(item: ShopItemRead, isAffordable: boolean): string {
  if (item.state === 'purchased') {
    return item.id === STABLE_CHAIN_ITEM_ID
      ? '已为下一次远征装备。'
      : '已拥有，会保留到后续远征。';
  }

  if (item.state === 'locked') {
    return '完成更多远征目标后显示。';
  }

  return isAffordable ? '可以购买。' : '购买前需要更多声望。';
}

function crawlerName(name: string): string {
  return CRAWLER_NAMES[name] ?? name;
}

function starterName(name: string): string {
  return STARTER_NAMES[name] ?? name;
}

function loadoutName(name: string): string {
  return crawlerName(starterName(name));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}
