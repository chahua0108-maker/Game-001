#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.resolve(projectRoot, process.env.QA_LONG_LOOP_OUTPUT_DIR ?? 'outputs/long-loop/p0-latest');
const evidenceFile = path.join(outputDir, 'p0-long-loop-evidence.json');
const profileStorageFile = path.join(outputDir, 'profile-storage.json');
const profileDumpFile = path.join(outputDir, 'profile-dump.json');
const vitestEntrypoint = path.resolve(projectRoot, 'node_modules/vitest/vitest.mjs');
const vitestConfig = path.resolve(projectRoot, 'scripts/vitest.qa-long-loop.config.ts');
const evidenceSpec = path.resolve(projectRoot, 'scripts/qa-long-loop.evidence.test.ts');

await mkdir(outputDir, { recursive: true });
await Promise.all([
  rm(evidenceFile, { force: true }),
  rm(profileStorageFile, { force: true }),
  rm(profileDumpFile, { force: true })
]);

const startedAt = new Date().toISOString();
const child = spawn(process.execPath, [vitestEntrypoint, 'run', evidenceSpec, '--config', vitestConfig, '--run'], {
  cwd: projectRoot,
  env: {
    ...process.env,
    QA_LONG_LOOP_OUTPUT_DIR: outputDir,
    QA_LONG_LOOP_EVIDENCE_FILE: evidenceFile,
    QA_LONG_LOOP_PROFILE_STORAGE_FILE: profileStorageFile,
    QA_LONG_LOOP_PROFILE_DUMP_FILE: profileDumpFile
  },
  stdio: 'inherit'
});

const exitCode = await new Promise((resolve) => {
  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`qa:long-loop terminated by ${signal}`);
      resolve(1);
      return;
    }
    resolve(code ?? 1);
  });
});

const finishedAt = new Date().toISOString();
const summary = await readEvidenceSummary().catch((error) => ({
  status: 'failed',
  error: `Evidence file was not readable: ${error.message}`
}));

console.log(
  JSON.stringify(
    {
      name: 'qa-long-loop',
      status: exitCode === 0 && summary.status === 'pass' ? 'pass' : 'failed',
      startedAt,
      finishedAt,
      evidenceFile,
      profileStorageFile,
      profileDumpFile,
      evidenceSource: summary.evidenceSource,
      browserProof: summary.browserProof,
      steps: summary.steps?.map((step) => ({ name: step.name, status: step.status })) ?? [],
      gateScore: summary.gateScore,
      dumpCommand: 'node scripts/dump-profile.mjs'
    },
    null,
    2
  )
);

process.exitCode = exitCode;

async function readEvidenceSummary() {
  const raw = await readFile(evidenceFile, 'utf8');
  return JSON.parse(raw);
}
