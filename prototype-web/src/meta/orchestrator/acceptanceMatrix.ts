type AcceptanceEvidenceValue = string | readonly string[];

export interface AcceptanceMatrixRow {
  readonly system: string;
  readonly targetSystem: string;
  readonly configSource: AcceptanceEvidenceValue;
  readonly profileFields: readonly string[];
  readonly uiState: AcceptanceEvidenceValue;
  readonly unlockSource: AcceptanceEvidenceValue;
  readonly nextRunImpact: AcceptanceEvidenceValue;
  readonly reloadProof: AcceptanceEvidenceValue;
}

export const acceptanceMatrix = [
  matrixRow(
    'Hub / Village',
    ['featureGates.config.ts', 'unlockBuildingEntries.config.ts'],
    ['featureGates.unlockedIds', 'collection.seenIds'],
    ['hub.village', 'hub.shop', 'hub.blacksmith'],
    ['settlementProjection', 'unlockBuildingEntries.config.ts'],
    'newly visible hub entries become selectable before the next run',
    'profileStorage reloads feature gates and hub entry visibility'
  ),
  matrixRow(
    'Unlock Building',
    'unlockBuildingEntries.config.ts',
    ['featureGates.unlockedIds', 'collection.seenCategoryIds'],
    'hub.unlock_building',
    'unlockRules.config.ts',
    'unlocked building entries add services to the next hub visit',
    'profileStorage reloads unlocked building prerequisites'
  ),
  matrixRow(
    'Crawler Selection',
    'crawlers.config.ts',
    ['starter.unlockedCrawlerIds', 'starter.selectedCrawlerId'],
    'crawler_select',
    'unlockRules.config.ts',
    'next run crawler options expand after unlock',
    'profileStorage reloads crawler unlocks and current selection'
  ),
  matrixRow(
    'Starter Build',
    'starterKits.config.ts',
    ['starter.unlockedStarterKitIds', 'starter.selectedStarterKitId'],
    'starter_select',
    ['purchaseShopItem', 'unlockRules.config.ts'],
    'nextRunSnapshot includes purchased or unlocked starter kits',
    'profileStorage reloads selected starter without run-local modifiers'
  ),
  matrixRow(
    'Map Stages',
    ['mapNodes.config.ts', 'first3HoursUnlockMatrix.config.ts'],
    ['map.unlockedNodeIds', 'map.completedNodeIds', 'map.clearedDistrictIds'],
    'map_route',
    ['first3HoursUnlockMatrix.config.ts', 'settlementProjection'],
    'next district route options expand after map progress',
    'profileStorage reloads completed and available map nodes'
  ),
  matrixRow(
    'Boss / Elite / Reaper Pressure',
    ['mapNodes.config.ts', 'achievements.config.ts', 'first3HoursUnlockMatrix.config.ts'],
    ['map.completedNodeIds', 'map.clearedDistrictIds', 'achievements.unlockedIds'],
    ['boss_warning', 'elite_reward', 'reaper_pressure'],
    ['settlementProjection', 'unlockRules.config.ts'],
    'pressure milestones alter future route pressure and reward pools',
    'profileStorage reloads pressure milestones while current combat pressure stays run-local'
  ),
  matrixRow(
    'Shop',
    'shopItems.config.ts',
    ['shop.purchasedItemIds', 'starter.unlockedStarterKitIds'],
    'shop_inventory',
    ['settlementProjection', 'purchaseShopItem'],
    'starter kit and upgrade previews change after purchase',
    'profileStorage reloads purchased shop items'
  ),
  matrixRow(
    'Permanent Upgrades',
    'permanentUpgrades.config.ts',
    ['permanentUpgrades.upgradeRanks'],
    'upgrade_shop',
    'unlockRules.config.ts',
    'future shop and service choices expand without persisting raw run stats',
    'profileStorage reloads upgrade ranks and strips transient combat modifiers'
  ),
  matrixRow(
    'Blacksmith',
    'blacksmithServices.config.ts',
    ['blacksmith.unlockedServiceIds', 'blacksmith.purchasedPermitIds'],
    'blacksmith_available',
    'unlockRules.config.ts',
    'run-local enhancement menu expands for the next run start',
    'profileStorage reloads blacksmith permits but not applied run-local enhancements'
  ),
  matrixRow(
    'Relic / Arcana / Gem',
    ['relics.config.ts', 'arcana.config.ts', 'gems.config.ts'],
    ['relicArcanaGem.unlockedRelicIds', 'relicArcanaGem.unlockedArcanaIds', 'relicArcanaGem.gemInventory'],
    ['relic_inventory', 'arcana_detail', 'gem_inventory'],
    'unlockRules.config.ts',
    'future relic, arcana, and socket reward pools expand',
    'profileStorage reloads relic, arcana, and gem inventory fields'
  ),
  matrixRow(
    'Achievements / Unlocks',
    ['achievements.config.ts', 'unlockRules.config.ts'],
    ['achievements.unlockedIds', 'featureGates.unlockedIds'],
    'unlock_toast',
    'settlementProjection',
    'achievement rewards unlock downstream hub, shop, and map systems',
    'profileStorage reloads achievement ids and claimed rewards'
  ),
  matrixRow(
    'Profile / Cloud-like Save',
    ['profileStore', 'profileStorage'],
    ['profileId', 'version', 'orchestrator.nextRunSequence'],
    'profile_sync_status',
    ['profileStore.importSnapshot', 'profileStore.exportSnapshot'],
    'persisted meta progress survives process reload and changes next-run preview',
    'exported profile snapshot can hydrate a new profile store with no current run state'
  ),
  matrixRow(
    'Settlement / Hub Review',
    ['longLoopOrchestrator', 'settlementProjection'],
    ['orchestrator.settledRunIds', 'orchestrator.phaseEvents', 'wallet.softCurrency'],
    ['settlement', 'hub.review'],
    'settleRun',
    'settlement rewards update shop, hub, achievements, and next-run preview',
    'profileStorage reloads settlement-derived profile fields while run summary remains reconstructable'
  ),
  matrixRow(
    'Collection / Seen Index',
    'collectionCategories.config.ts',
    ['collection.seenCategoryIds', 'collection.seenIds'],
    'collection_tab',
    ['unlockBuildingEntries.config.ts', 'settlementProjection'],
    'seen codex categories persist for future hub review and shop grouping',
    'profileStorage reloads collection seen index fields'
  ),
  matrixRow(
    'Feature Gates',
    'featureGates.config.ts',
    ['featureGates.unlockedIds'],
    'feature_unlocked',
    ['settlementProjection', 'unlockRules.config.ts'],
    'gated hub systems become visible and remain available on later runs',
    'profileStorage reloads feature gate ids before orchestrator computes visibility'
  )
] as const satisfies readonly AcceptanceMatrixRow[];

function matrixRow(
  system: string,
  configSource: AcceptanceEvidenceValue,
  profileFields: readonly string[],
  uiState: AcceptanceEvidenceValue,
  unlockSource: AcceptanceEvidenceValue,
  nextRunImpact: AcceptanceEvidenceValue,
  reloadProof: AcceptanceEvidenceValue
): AcceptanceMatrixRow {
  return {
    system,
    targetSystem: system,
    configSource,
    profileFields,
    uiState,
    unlockSource,
    nextRunImpact,
    reloadProof
  };
}
