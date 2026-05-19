export type RunModifierId = 'maxEnergyThisRunPlusOne' | 'rewardRerollPlusOne' | 'startingRepairCard';
export type RunModifierLifecycle = 'current-run';
export type RunModifierBoundary = 'settlement-growth';
export type RunModifierRuntimeIntegration = 'preview-only';
export type RunModifierExclusion = 'not-meta-progression' | 'not-turn-payoff-authorization' | 'not-runtime-applied';

export interface RunModifierEffect {
  maxEnergyThisRunDelta?: number;
  rewardRerollDelta?: number;
  startingDeckAdditions?: readonly string[];
}

export interface RunModifierDraft {
  id: RunModifierId;
  label: string;
  summary: string;
  lifecycle: RunModifierLifecycle;
  boundary: RunModifierBoundary;
  runtimeIntegration: RunModifierRuntimeIntegration;
  exclusions: readonly RunModifierExclusion[];
  effect: RunModifierEffect;
}

export interface RunModifierPreviewInput {
  baseMaxEnergy: number;
  baseRewardRerolls?: number;
  startingDeck?: readonly string[];
  selectedModifierIds?: readonly RunModifierId[];
}

export interface RunModifierDerivedPlan {
  baseMaxEnergy: number;
  maxEnergyThisRun: number;
  maxEnergyDeltaThisRun: number;
  baseRewardRerolls: number;
  rewardRerolls: number;
  rewardRerollDelta: number;
  startingDeck: readonly string[];
  startingDeckAdditions: readonly string[];
}

export interface RunModifierPlan {
  lifecycle: RunModifierLifecycle;
  boundary: RunModifierBoundary;
  runtimeIntegration: RunModifierRuntimeIntegration;
  exclusions: readonly RunModifierExclusion[];
  selectedModifiers: readonly RunModifierDraft[];
  derived: RunModifierDerivedPlan;
  explanations: readonly string[];
}

const RUN_ONLY_EXCLUSIONS: readonly RunModifierExclusion[] = [
  'not-meta-progression',
  'not-turn-payoff-authorization',
  'not-runtime-applied'
];

export const RUN_MODIFIER_DRAFTS: readonly RunModifierDraft[] = [
  {
    id: 'maxEnergyThisRunPlusOne',
    label: '信用额度',
    summary: 'Max MP +1 for the current run preview. This is a settlement-growth option, not a default runtime rule.',
    lifecycle: 'current-run',
    boundary: 'settlement-growth',
    runtimeIntegration: 'preview-only',
    exclusions: RUN_ONLY_EXCLUSIONS,
    effect: {
      maxEnergyThisRunDelta: 1
    }
  },
  {
    id: 'rewardRerollPlusOne',
    label: '复核机会',
    summary: 'Reward reroll +1 for the current run preview. It changes reward control, not combat payment rules.',
    lifecycle: 'current-run',
    boundary: 'settlement-growth',
    runtimeIntegration: 'preview-only',
    exclusions: RUN_ONLY_EXCLUSIONS,
    effect: {
      rewardRerollDelta: 1
    }
  },
  {
    id: 'startingRepairCard',
    label: '备用修补包',
    summary: 'Add one repair card to the current run starting deck preview. It is not a permanent unlock.',
    lifecycle: 'current-run',
    boundary: 'settlement-growth',
    runtimeIntegration: 'preview-only',
    exclusions: RUN_ONLY_EXCLUSIONS,
    effect: {
      startingDeckAdditions: ['wild_mana_stitch']
    }
  }
];

const RUN_MODIFIER_BY_ID = new Map(RUN_MODIFIER_DRAFTS.map((modifier) => [modifier.id, modifier]));

function uniqueModifierIds(modifierIds: readonly RunModifierId[] = []): RunModifierId[] {
  return [...new Set(modifierIds)];
}

function explainModifier(modifier: RunModifierDraft, derived: RunModifierDerivedPlan): string {
  if (modifier.effect.maxEnergyThisRunDelta) {
    return `Max MP preview becomes ${derived.maxEnergyThisRun} for this run only.`;
  }

  if (modifier.effect.rewardRerollDelta) {
    return `Reward reroll preview gains ${modifier.effect.rewardRerollDelta} reroll for this run only.`;
  }

  const [repairCard] = modifier.effect.startingDeckAdditions ?? [];
  if (repairCard) {
    return `Starting repair card preview adds ${repairCard} for this run only.`;
  }

  return `${modifier.label} has no runtime effect in preview-only mode.`;
}

export function deriveRunModifierPlan(input: RunModifierPreviewInput): RunModifierPlan {
  const selectedModifiers = uniqueModifierIds(input.selectedModifierIds)
    .map((modifierId) => RUN_MODIFIER_BY_ID.get(modifierId))
    .filter((modifier): modifier is RunModifierDraft => Boolean(modifier));

  const maxEnergyDeltaThisRun = selectedModifiers.reduce(
    (sum, modifier) => sum + (modifier.effect.maxEnergyThisRunDelta ?? 0),
    0
  );
  const rewardRerollDelta = selectedModifiers.reduce(
    (sum, modifier) => sum + (modifier.effect.rewardRerollDelta ?? 0),
    0
  );
  const startingDeckAdditions = selectedModifiers.flatMap((modifier) => [...(modifier.effect.startingDeckAdditions ?? [])]);
  const baseRewardRerolls = input.baseRewardRerolls ?? 0;

  const derived: RunModifierDerivedPlan = {
    baseMaxEnergy: input.baseMaxEnergy,
    maxEnergyThisRun: input.baseMaxEnergy + maxEnergyDeltaThisRun,
    maxEnergyDeltaThisRun,
    baseRewardRerolls,
    rewardRerolls: baseRewardRerolls + rewardRerollDelta,
    rewardRerollDelta,
    startingDeck: [...(input.startingDeck ?? [])],
    startingDeckAdditions
  };

  return {
    lifecycle: 'current-run',
    boundary: 'settlement-growth',
    runtimeIntegration: 'preview-only',
    exclusions: RUN_ONLY_EXCLUSIONS,
    selectedModifiers,
    derived,
    explanations:
      selectedModifiers.length > 0
        ? selectedModifiers.map((modifier) => explainModifier(modifier, derived))
        : ['No run modifier selected; base maxEnergy remains unchanged.']
  };
}
