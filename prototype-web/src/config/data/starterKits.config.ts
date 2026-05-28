import type { StarterKitConfig } from '../schema/definitions';
import { CANONICAL_STARTER_KIT_IDS } from '../schema/ids';

export const starterKits = [
  {
    id: CANONICAL_STARTER_KIT_IDS.defaultChain,
    name: 'Default Chain',
    crawlerId: 'crawler.blood_runner',
    shopItemIds: ['blacksmith_raise_level_permit'],
    runStartDeckModifier: {
      id: 'starter.default_chain.deck',
      starterCardIds: ['debt_hook', 'redline_cut', 'wild_mana_stitch']
    }
  },
  {
    id: CANONICAL_STARTER_KIT_IDS.stableChain,
    name: 'Stable Chain',
    crawlerId: 'crawler.iron_monk',
    shopItemIds: ['starter_stable_chain', 'blacksmith_reroll_permit'],
    runStartDeckModifier: {
      id: 'starter.stable_chain.deck',
      starterCardIds: ['debt_hook', 'wild_gap_key', 'severance_burst']
    }
  }
] as const satisfies readonly StarterKitConfig[];
