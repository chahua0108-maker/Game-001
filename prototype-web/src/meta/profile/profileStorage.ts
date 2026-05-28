import { createDefaultProfile } from './createProfile';
import { migrateProfile, sanitizeProfileForSave } from './profileMigrations';
import type { LongLoopProfile, ProfileStorageOptions } from './profileTypes';

export const PROFILE_STORAGE_KEY = 'vampire-crawlers.profile.v1';

export function loadProfile(options: ProfileStorageOptions = {}): LongLoopProfile {
  const storage = resolveStorage(options.storage);

  if (!storage) {
    return createDefaultProfile({ profileId: options.profileId });
  }

  const rawProfile = readStorageItem(storage, options.storageKey ?? PROFILE_STORAGE_KEY);
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

  writeStorageItem(storage, options.storageKey ?? PROFILE_STORAGE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export function clearProfile(options: ProfileStorageOptions = {}): void {
  try {
    resolveStorage(options.storage)?.removeItem(options.storageKey ?? PROFILE_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function resolveStorage(storage?: Storage): Storage | undefined {
  if (storage) {
    return storage;
  }

  try {
    return typeof globalThis.localStorage === 'undefined' ? undefined : globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function readStorageItem(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageItem(storage: Storage | undefined, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // Save should not crash gameplay when storage quota or access fails.
  }
}
