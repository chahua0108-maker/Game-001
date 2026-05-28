export const requiredTargetSystems = [
  'achievements',
  'arcana',
  'blacksmithServices',
  'collectionCategories',
  'crawlers',
  'featureGates',
  'gems',
  'mapNodes',
  'permanentUpgrades',
  'relics',
  'shopItems',
  'starterKits',
  'unlockBuildingEntries'
] as const;

export const requiredMatrixEvidenceFields = [
  'configSource',
  'profileFields',
  'uiState',
  'unlockSource',
  'nextRunImpact',
  'reloadProof'
] as const;

export const p0CanonicalIds = {
  achievementClearD1: 'clear_d1',
  achievementFirstPurchase: 'first_purchase',
  districtD1: 'D1',
  featureBlacksmith: 'feature.blacksmith',
  mapStart: 'map.start',
  p0ShopItem: 'starter_stable_chain',
  runLocalBlacksmithEnhancement: 'blacksmith_raise_level',
  starterKitDefaultChain: 'default_chain',
  starterKitStableChain: 'stable_chain',
  uiBlacksmithAvailable: 'blacksmith_available',
  uiSettlement: 'settlement',
  uiShopInventory: 'shop_inventory',
  uiUnlockToast: 'unlock_toast'
} as const;

export const expectedP0PhaseEvents = [
  'p0.d1.started',
  'p0.d1.settled',
  'p0.settlement.shown',
  'p0.shop.item-purchased',
  'p0.next-run-preview.changed',
  'p0.profile-meta.reloaded'
] as const;

export type RequiredTargetSystem = (typeof requiredTargetSystems)[number];
export type RequiredMatrixEvidenceField = (typeof requiredMatrixEvidenceFields)[number];
export type ExpectedP0PhaseEvent = (typeof expectedP0PhaseEvents)[number];

export type AcceptanceMatrixEvidence = Record<RequiredMatrixEvidenceField, unknown>;

export interface AcceptanceMatrixRow extends Partial<AcceptanceMatrixEvidence> {
  readonly targetSystem: string;
}

export interface PhaseEventFixture {
  readonly type: string;
}

export function missingRequiredMatrixEvidenceFields(row: Partial<AcceptanceMatrixRow>): readonly RequiredMatrixEvidenceField[] {
  return requiredMatrixEvidenceFields.filter((field) => !hasMatrixEvidence(row[field]));
}

export function phaseEventTypes(events: readonly PhaseEventFixture[]): readonly string[] {
  return events.map((event) => event.type);
}

function hasMatrixEvidence(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return value !== undefined && value !== null;
}
