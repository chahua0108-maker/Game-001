import type { UnlockTargetTableKey } from '../../config/schema/definitions';

interface AcceptanceMatrixRow {
  readonly targetSystem: UnlockTargetTableKey;
  readonly configSource: string;
  readonly profileFields: readonly string[];
  readonly uiState: string;
  readonly unlockSource: string;
  readonly nextRunImpact: string;
  readonly reloadProof: string;
}

export const acceptanceMatrix = [
  matrixRow('achievements', 'achievements.config.ts', ['achievements.unlockedIds'], 'unlock_toast', 'settlementProjection', 'shop and matrix gates refresh', 'profileStorage saves unlockedIds'),
  matrixRow('arcana', 'arcana.config.ts', ['relicArcanaGem.unlockedArcanaIds'], 'collection_detail', 'unlockRules.config.ts', 'eligible future run socket choices', 'profileStorage saves relicArcanaGem'),
  matrixRow('blacksmithServices', 'blacksmithServices.config.ts', ['blacksmith.unlockedServiceIds'], 'blacksmith_available', 'unlockRules.config.ts', 'run-local enhancement menu expands', 'profileStorage saves permits but not run-local results'),
  matrixRow('collectionCategories', 'collectionCategories.config.ts', ['collection.seenCategoryIds'], 'collection_tab', 'unlockBuildingEntries.config.ts', 'codex and shop grouping persist', 'profileStorage saves collection fields'),
  matrixRow('crawlers', 'crawlers.config.ts', ['starter.unlockedCrawlerIds'], 'crawler_select', 'unlockRules.config.ts', 'next run crawler options expand', 'profileStorage saves starter crawler ids'),
  matrixRow('featureGates', 'featureGates.config.ts', ['featureGates.unlockedIds'], 'feature_unlocked', 'settlementProjection', 'hub systems become visible', 'profileStorage saves featureGates'),
  matrixRow('gems', 'gems.config.ts', ['relicArcanaGem.ownedGemIds', 'relicArcanaGem.gemInventory'], 'gem_inventory', 'unlockRules.config.ts', 'future socket choices expand', 'profileStorage saves gem inventory'),
  matrixRow('mapNodes', 'mapNodes.config.ts', ['map.unlockedNodeIds', 'map.completedNodeIds'], 'map_route', 'first3HoursUnlockMatrix.config.ts', 'next district route options expand', 'profileStorage saves map progress'),
  matrixRow('permanentUpgrades', 'permanentUpgrades.config.ts', ['permanentUpgrades.upgradeRanks'], 'upgrade_shop', 'unlockRules.config.ts', 'future shop/service choice space expands', 'profileStorage strips raw stat upgrades'),
  matrixRow('relics', 'relics.config.ts', ['relicArcanaGem.unlockedRelicIds'], 'relic_inventory', 'unlockRules.config.ts', 'future reward pools expand', 'profileStorage saves unlocked relic ids'),
  matrixRow('shopItems', 'shopItems.config.ts', ['shop.purchasedItemIds'], 'shop_inventory', 'settlementProjection and purchaseShopItem', 'starter kit preview changes after purchase', 'profileStorage saves purchased items'),
  matrixRow('starterKits', 'starterKits.config.ts', ['starter.unlockedStarterKitIds', 'starter.selectedStarterKitId'], 'starter_select', 'purchaseShopItem', 'nextRunSnapshot lists stable_chain', 'profileStorage saves selected starter'),
  matrixRow('unlockBuildingEntries', 'unlockBuildingEntries.config.ts', ['featureGates.unlockedIds'], 'hub.shop', 'unlockRules.config.ts', 'hub entries unlock before future runs', 'profileStorage saves feature gate prerequisites')
] as const satisfies readonly AcceptanceMatrixRow[];

function matrixRow(
  targetSystem: UnlockTargetTableKey,
  configSource: string,
  profileFields: readonly string[],
  uiState: string,
  unlockSource: string,
  nextRunImpact: string,
  reloadProof: string
): AcceptanceMatrixRow {
  return {
    targetSystem,
    configSource,
    profileFields,
    uiState,
    unlockSource,
    nextRunImpact,
    reloadProof
  };
}
