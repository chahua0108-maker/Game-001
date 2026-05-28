import { CANONICAL_DISTRICT_IDS, CANONICAL_STARTER_KIT_IDS, type ShopItemId } from '../config/schema/ids';
import { createLongLoopOrchestrator, type LongLoopOrchestrator } from '../meta/orchestrator';
import { createProfileStore, type ProfileStore } from '../meta/profile/profileStore';
import { loadProfile, PROFILE_STORAGE_KEY, saveProfile } from '../meta/profile/profileStorage';
import type { LongLoopProfile, ProfileStorageOptions } from '../meta/profile/profileTypes';
import { crawlerReads } from '../meta/systems/crawler/crawlerSelectors';
import { mapNodeReads } from '../meta/systems/map/mapSelectors';
import { selectShopItemReads } from '../meta/systems/shop/shopSelectors';
import { starterReads } from '../meta/systems/starter/starterSelectors';

export interface LongLoopPanelOptions extends Pick<ProfileStorageOptions, 'storage' | 'storageKey' | 'profileId'> {}

type UiPhase = 'hub_review' | 'running' | 'settlement_review';

export class LongLoopPanel {
  private profileStore: ProfileStore;
  private orchestrator: LongLoopOrchestrator;
  private phase: UiPhase = 'hub_review';
  private message = 'QA profile loaded from profileStorage';
  private readonly storage?: Storage;
  private readonly storageKey: string;
  private readonly profileId?: string;

  constructor(
    private readonly root: HTMLElement,
    options: LongLoopPanelOptions = {}
  ) {
    this.storage = options.storage;
    this.storageKey = options.storageKey ?? PROFILE_STORAGE_KEY;
    this.profileId = options.profileId;
    this.profileStore = createProfileStore({ snapshot: this.loadProfile() });
    this.orchestrator = createLongLoopOrchestrator({ profileStore: this.profileStore });
    this.root.addEventListener('click', (event) => this.handleClick(event));
  }

  render(): void {
    const profile = this.profileStore.getSnapshot();
    const meta = this.orchestrator.getProfileMeta();
    const nextRun = this.orchestrator.previewNextRun({ districtId: CANONICAL_DISTRICT_IDS.d1 });
    const shopState = this.orchestrator.getShopState();
    const phaseEvents = this.orchestrator.getPhaseEvents();

    this.root.innerHTML = `
      <aside class="long-loop-panel" aria-label="Long-loop P0 meta layer">
        <header class="long-loop-header">
          <div>
            <strong>Long-loop P0</strong>
            <span>QA profile · orchestrator-backed</span>
          </div>
          <button type="button" data-long-loop-action="reload">Reload Profile</button>
        </header>

        <section class="long-loop-section long-loop-summary">
          ${summaryRow('Currency', `${profile.wallet.softCurrency} rep / ${profile.wallet.metaGems} gems`)}
          ${summaryRow('Phase', this.phase)}
          ${summaryRow('Selected', `${meta.selectedCrawlerId} · ${meta.selectedStarterKitId}`)}
          ${summaryRow('Achievements', meta.achievementIds.length > 0 ? meta.achievementIds.join(', ') : 'none')}
          ${summaryRow('Purchased', meta.purchasedShopItemIds.length > 0 ? meta.purchasedShopItemIds.join(', ') : 'none')}
          ${summaryRow('Next run preview', `${nextRun.districtId} · ${nextRun.selectedStarterKitId} · deck ${nextRun.starterPayload.starterCardIds.join(' / ')}`)}
        </section>

        <section class="long-loop-section">
          <div class="long-loop-section-head">
            <strong>Hub / Progression</strong>
            <button type="button" data-long-loop-action="settle-d1">Settle D1</button>
          </div>
          <p>${escapeHtml(this.message)}</p>
          <p>Events: ${phaseEvents.length > 0 ? escapeHtml(phaseEvents.map((event) => event.type).join(' → ')) : 'none'}</p>
          <p>Visible shop ids: ${shopState.visibleItemIds.length > 0 ? escapeHtml(shopState.visibleItemIds.join(', ')) : 'none'}</p>
        </section>

        <section class="long-loop-section">
          <div class="long-loop-section-head"><strong>Map</strong><span>D1-D4 state · D5-D10 locked preview</span></div>
          <div class="long-loop-grid long-loop-map">
            ${mapNodeReads(profile, 'P0')
              .map(
                (node) => `
                  <article class="long-loop-card state-${node.state}">
                    <span>${escapeHtml(node.id.replace('map.', '').toUpperCase())}</span>
                    <strong>${escapeHtml(node.name)}</strong>
                    <em>${escapeHtml(node.state)}</em>
                    <small>${escapeHtml(node.nodeType)}${node.stageGoalPressure ? ` · ${escapeHtml(node.stageGoalPressure)}` : ''}</small>
                  </article>
                `
              )
              .join('')}
          </div>
        </section>

        <section class="long-loop-section">
          <div class="long-loop-section-head"><strong>Crawler / Starter</strong><span>default selected · previews locked until public unlocks</span></div>
          <div class="long-loop-two-col">
            <div>${starterReads(profile).map((starter) => readRow(starter.name, starter.id, starter.state)).join('')}</div>
            <div>${crawlerReads(profile).map((crawler) => readRow(crawler.name, crawler.id, crawler.state)).join('')}</div>
          </div>
        </section>

        <section class="long-loop-section">
          <div class="long-loop-section-head"><strong>Shop</strong><span>P0 items · facade/orchestrator purchases</span></div>
          <div class="long-loop-shop">
            ${selectShopItemReads(profile)
              .map(
                (item) => `
                  <article class="long-loop-shop-item state-${item.state}">
                    <div>
                      <strong>${escapeHtml(item.name)}</strong>
                      <span>${escapeHtml(item.id)}</span>
                    </div>
                    <em>${escapeHtml(item.state)} · ${item.price} rep</em>
                    ${
                      item.id === 'starter_stable_chain'
                        ? `<button type="button" data-long-loop-action="buy" data-shop-item-id="${escapeHtml(item.id)}">Buy Stable Chain</button>`
                        : `<button type="button" data-long-loop-action="buy" data-shop-item-id="${escapeHtml(item.id)}">Buy</button>`
                    }
                  </article>
                `
              )
              .join('')}
          </div>
        </section>
      </aside>
    `;
  }

  settleD1(): void {
    const run = this.orchestrator.startRun({
      districtId: CANONICAL_DISTRICT_IDS.d1,
      starterKitId: CANONICAL_STARTER_KIT_IDS.defaultChain
    });
    this.phase = 'running';
    const summary = this.orchestrator.settleRun({
      runId: run.id,
      districtId: CANONICAL_DISTRICT_IDS.d1,
      outcome: 'district_cleared'
    });
    this.phase = 'settlement_review';
    this.message = `Settled D1: +${summary.softCurrencyDelta} rep, +${summary.metaGemDelta} gem`;
    this.persistProfile();
    this.render();
  }

  buyShopItem(itemId: ShopItemId): void {
    const result = this.orchestrator.purchaseShopItem({ itemId });
    if (result.ok) {
      this.message = `Purchased ${result.itemId} for ${result.purchase.price} rep`;
      this.persistProfile();
    } else {
      this.message = `Purchase blocked: ${result.itemId} · ${result.reason}`;
    }
    this.render();
  }

  reloadProfile(): void {
    this.profileStore = createProfileStore({ snapshot: this.loadProfile() });
    this.orchestrator = createLongLoopOrchestrator({ profileStore: this.profileStore });
    this.phase = 'hub_review';
    this.message = 'Reloaded from profileStorage';
    this.render();
  }

  private handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLButtonElement>('[data-long-loop-action]');
    if (!button) {
      return;
    }

    const action = button.dataset.longLoopAction;
    if (action === 'settle-d1') {
      this.settleD1();
      return;
    }

    if (action === 'reload') {
      this.reloadProfile();
      return;
    }

    if (action === 'buy') {
      const itemId = button.dataset.shopItemId;
      if (itemId) {
        this.buyShopItem(itemId);
      }
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

function summaryRow(label: string, value: string): string {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function readRow(name: string, id: string, state: string): string {
  return `
    <article class="long-loop-read-row state-${escapeHtml(state)}">
      <strong>${escapeHtml(name)}</strong>
      <span>${escapeHtml(id)}</span>
      <em>${escapeHtml(state)}</em>
    </article>
  `;
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
