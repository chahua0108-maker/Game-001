import { createDefaultProfile } from './createProfile';
import { migrateProfile, sanitizeProfileForSave } from './profileMigrations';
import type { LongLoopProfile, ProfileStorageOptions } from './profileTypes';

export const PROFILE_STORAGE_KEY = 'vampire-crawlers.profile.v1';

export function loadProfile(options: ProfileStorageOptions = {}): LongLoopProfile {
  const storage = resolveStorage(options.storage);

  if (!storage) {
    return createDefaultProfile({ profileId: options.profileId });
  }

  const rawProfile = storage.getItem(options.storageKey ?? PROFILE_STORAGE_KEY);
  if (!rawProfile) {
    return createDefaultProfile({ profileId: options.profileId });
  }

  try {
    return migrateProfile(JSON.parse(rawProfile), options.profileId);
  } catch {
    return createDefaultProfile({ profileId: options.profileId });
  }
}

export function saveProfile(profile: LongLoopProfile, options: ProfileStorageOptions = {}): LongLoopProfile {
  const storage = resolveStorage(options.storage);
  const snapshot = sanitizeProfileForSave(profile);

  storage?.setItem(options.storageKey ?? PROFILE_STORAGE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export function clearProfile(options: ProfileStorageOptions = {}): void {
  resolveStorage(options.storage)?.removeItem(options.storageKey ?? PROFILE_STORAGE_KEY);
}

function resolveStorage(storage?: Storage): Storage | undefined {
  if (storage) {
    return storage;
  }

  return typeof globalThis.localStorage === 'undefined' ? undefined : globalThis.localStorage;
}
