#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.resolve(projectRoot, process.env.QA_LONG_LOOP_OUTPUT_DIR ?? 'outputs/long-loop/browser-p0-latest');
const evidenceFile = path.join(outputDir, 'p0-long-loop-evidence.json');
const profileStorageFile = path.join(outputDir, 'profile-storage.json');
const profileDumpFile = path.join(outputDir, 'profile-dump.json');
const browserProofScript = path.resolve(projectRoot, 'scripts/qa-long-loop-browser.mjs');
const browserProofFile = path.join(outputDir, 'browser-proof.json');
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
const browserExitCode = existsSync(browserProofScript)
  ? await runChild(process.execPath, [browserProofScript], {
      ...process.env,
      QA_LONG_LOOP_BROWSER_OUTPUT_DIR: outputDir
    })
  : 1;
if (!existsSync(browserProofScript)) {
  console.error(`qa:long-loop browser proof script is missing: ${browserProofScript}`);
}

const nodeExitCode = await runChild(
  process.execPath,
  [vitestEntrypoint, 'run', evidenceSpec, '--config', vitestConfig, '--run'],
  {
    ...process.env,
    QA_LONG_LOOP_OUTPUT_DIR: outputDir,
    QA_LONG_LOOP_EVIDENCE_FILE: evidenceFile,
    QA_LONG_LOOP_PROFILE_STORAGE_FILE: profileStorageFile,
    QA_LONG_LOOP_PROFILE_DUMP_FILE: profileDumpFile
  }
);

const finishedAt = new Date().toISOString();
const browserSummary = await readJson(browserProofFile).catch((error) => ({
  status: 'missing',
  browserProof: {
    status: 'missing',
    reason: `Browser proof file was not readable: ${error.message}`
  }
}));
const summary = await readEvidenceSummary().catch((error) => ({
  status: 'failed',
  error: `Evidence file was not readable: ${error.message}`
}));
const browserProof = normalizeBrowserProof(browserSummary);
const browserProofPassed = browserExitCode === 0 && browserProof.status === 'pass';
const nodeEvidencePassed = nodeExitCode === 0 && summary.status === 'pass';
const finalStatus = browserProofPassed && nodeEvidencePassed ? 'pass' : 'failed';

console.log(
  JSON.stringify(
    {
      name: 'qa-long-loop',
      status: finalStatus,
      startedAt,
      finishedAt,
      evidenceFile,
      profileStorageFile,
      profileDumpFile,
      browserProofFile,
      evidenceSource: summary.evidenceSource,
      browserProof,
      supportingNodeEvidence: {
        status: summary.status,
        exitCode: nodeExitCode,
        browserProofClaimInNodeHarness: summary.browserProof,
        note:
          'Vitest/Node evidence is supporting proof only. qa:long-loop passes only when the real browser proof passes first.'
      },
      steps: summary.steps?.map((step) => ({ name: step.name, status: step.status })) ?? [],
      gateScore: summary.gateScore,
      childExitCodes: {
        browser: browserExitCode,
        nodeEvidence: nodeExitCode
      },
      dumpCommand: 'node scripts/dump-profile.mjs'
    },
    null,
    2
  )
);

process.exitCode = finalStatus === 'pass' ? 0 : 1;

async function readEvidenceSummary() {
  return await readJson(evidenceFile);
}

async function readJson(file) {
  const raw = await readFile(file, 'utf8');
  return JSON.parse(raw);
}

function normalizeBrowserProof(browserSummary) {
  const proof = browserSummary.browserProof ?? { status: browserSummary.status ?? 'missing' };
  if (!proof.status || proof.status === 'not-run') {
    return {
      ...proof,
      status: proof.status ?? 'missing',
      reason: proof.reason ?? 'Browser proof did not report a runnable status.'
    };
  }
  return {
    ...proof,
    status: browserSummary.status === 'pass' && proof.status === 'pass' ? 'pass' : proof.status
  };
}

function runChild(command, args, env) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env,
    stdio: 'inherit'
  });

  return new Promise((resolve) => {
    child.on('exit', (code, signal) => {
      if (signal) {
        console.error(`qa:long-loop child terminated by ${signal}: ${command} ${args.join(' ')}`);
        resolve(1);
        return;
      }
      resolve(code ?? 1);
    });
  });
}
