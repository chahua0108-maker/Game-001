import { migrateProfile } from './profileMigrations';
import type { CreateProfileOptions, LongLoopProfile } from './profileTypes';

interface StoredPhaseEvent {
  readonly type: string;
  readonly runId?: string;
  readonly itemId?: string;
}

export interface ProfileStoreSnapshot extends LongLoopProfile {
  readonly __longLoopPhaseEvents?: readonly StoredPhaseEvent[];
}

export interface ProfileStoreOptions extends CreateProfileOptions {
  readonly snapshot?: ProfileStoreSnapshot;
}

export interface ProfileStore {
  getSnapshot(): LongLoopProfile;
  setSnapshot(profile: LongLoopProfile): void;
  getPhaseEvents(): readonly StoredPhaseEvent[];
  setPhaseEvents(events: readonly StoredPhaseEvent[]): void;
  exportSnapshot(): ProfileStoreSnapshot;
}

export function createProfileStore(options: ProfileStoreOptions = {}): ProfileStore {
  let profile = migrateProfile(options.snapshot ?? { profileId: options.profileId });
  let phaseEvents = clonePhaseEvents(options.snapshot?.__longLoopPhaseEvents ?? []);

  return {
    getSnapshot() {
      return cloneProfile(profile);
    },
    setSnapshot(nextProfile) {
      profile = normalizePersistedProfile(nextProfile);
    },
    getPhaseEvents() {
      return clonePhaseEvents(phaseEvents);
    },
    setPhaseEvents(events) {
      phaseEvents = clonePhaseEvents(events);
    },
    exportSnapshot() {
      return {
        ...cloneProfile(normalizePersistedProfile(profile)),
        __longLoopPhaseEvents: clonePhaseEvents(phaseEvents)
      };
    }
  };
}

function normalizePersistedProfile(profile: LongLoopProfile): LongLoopProfile {
  const persistedProfile = migrateProfile(profile);
  persistedProfile.runLocalPreview.cardEnhancements = [];

  return persistedProfile;
}

function cloneProfile(profile: LongLoopProfile): LongLoopProfile {
  return structuredClone(profile) as LongLoopProfile;
}

function clonePhaseEvents(events: readonly StoredPhaseEvent[]): readonly StoredPhaseEvent[] {
  return events.map((event) => ({ ...event }));
}
