import { achievements } from './achievements.config';
import { arcana } from './arcana.config';
import { blacksmithServices } from './blacksmithServices.config';
import { collectionCategories } from './collectionCategories.config';
import { crawlers } from './crawlers.config';
import { featureGates } from './featureGates.config';
import { first3HoursUnlockMatrix } from './first3HoursUnlockMatrix.config';
import { gems } from './gems.config';
import { mapNodes } from './mapNodes.config';
import { permanentUpgrades } from './permanentUpgrades.config';
import { relics } from './relics.config';
import { shopItems } from './shopItems.config';
import { starterKits } from './starterKits.config';
import { unlockBuildingEntries } from './unlockBuildingEntries.config';
import { unlockRules } from './unlockRules.config';
import type { LongLoopConfig } from '../schema/definitions';

export const longLoopConfig = {
  achievements,
  arcana,
  blacksmithServices,
  collectionCategories,
  crawlers,
  featureGates,
  first3HoursUnlockMatrix,
  gems,
  mapNodes,
  permanentUpgrades,
  relics,
  shopItems,
  starterKits,
  unlockBuildingEntries,
  unlockRules
} as const satisfies LongLoopConfig;
