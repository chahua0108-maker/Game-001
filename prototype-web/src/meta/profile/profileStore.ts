import { migrateProfile } from './profileMigrations';
import type { CreateProfileOptions, LongLoopProfile } from './profileTypes';

export interface ProfileStoreOptions extends CreateProfileOptions {
  readonly snapshot?: LongLoopProfile;
}

export interface ProfileStore {
  getSnapshot(): LongLoopProfile;
  setSnapshot(profile: LongLoopProfile): void;
  exportSnapshot(): LongLoopProfile;
}

export function createProfileStore(options: ProfileStoreOptions = {}): ProfileStore {
  let profile = migrateProfile(options.snapshot ?? { profileId: options.profileId });

  return {
    getSnapshot() {
      return cloneProfile(profile);
    },
    setSnapshot(nextProfile) {
      profile = normalizePersistedProfile(nextProfile);
    },
    exportSnapshot() {
      return cloneProfile(normalizePersistedProfile(profile));
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
