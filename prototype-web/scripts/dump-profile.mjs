#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const storageKey = 'vampire-crawlers.profile.v1';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const defaultProfileStorageFile = path.resolve(projectRoot, 'outputs/long-loop/p0-latest/profile-storage.json');
const profileStorageFile = path.resolve(projectRoot, process.env.QA_PROFILE_STORAGE_FILE ?? defaultProfileStorageFile);

if (!existsSync(profileStorageFile)) {
  console.error(
    JSON.stringify(
      {
        name: 'dump-profile',
        status: 'failed',
        storageKey,
        profileStorageFile,
        error: 'No QA profile storage artifact found. Run npm run qa:long-loop first, or set QA_PROFILE_STORAGE_FILE.'
      },
      null,
      2
    )
  );
  process.exitCode = 1;
} else {
  const artifact = JSON.parse(await readFile(profileStorageFile, 'utf8'));
  const rawValue = artifact.rawValue ?? artifact.storageDump?.[storageKey];
  const profile = artifact.parsedProfile ?? (typeof rawValue === 'string' ? JSON.parse(rawValue) : null);

  if (!profile) {
    console.error(
      JSON.stringify(
        {
          name: 'dump-profile',
          status: 'failed',
          storageKey,
          profileStorageFile,
          error: 'QA profile storage artifact did not include a parsed profile or raw storage value.'
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  } else {
    console.log(
      JSON.stringify(
        {
          name: 'dump-profile',
          status: 'pass',
          source: 'qa-long-loop profile storage artifact',
          storageKey: artifact.storageKey ?? storageKey,
          profileStorageFile,
          generatedAt: new Date().toISOString(),
          evidenceSource: artifact.source ?? null,
          summary: {
            profileId: profile.profileId,
            version: profile.version,
            softCurrency: profile.wallet?.softCurrency,
            metaGems: profile.wallet?.metaGems,
            achievementIds: profile.achievements?.unlockedIds ?? [],
            purchasedShopItemIds: profile.shop?.purchasedItemIds ?? [],
            purchasedBlacksmithPermitIds: profile.blacksmith?.purchasedPermitIds ?? [],
            unlockedStarterKitIds: profile.starter?.unlockedStarterKitIds ?? [],
            selectedStarterKitId: profile.starter?.selectedStarterKitId,
            featureGateIds: profile.featureGates?.unlockedIds ?? [],
            completedMapNodeIds: profile.map?.completedNodeIds ?? [],
            clearedDistrictIds: profile.map?.clearedDistrictIds ?? [],
            phaseEventTypes: profile.orchestrator?.phaseEvents?.map((event) => event.type) ?? [],
            nextRunSequence: profile.orchestrator?.nextRunSequence
          },
          profile
        },
        null,
        2
      )
    );
  }
}
