import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const projectRoot = resolve(new URL('..', import.meta.url).pathname);
const vitestEntrypoint = resolve(projectRoot, 'node_modules/vitest/vitest.mjs');

const child = spawn(
  process.execPath,
  [vitestEntrypoint, 'run', 'src/tests/long-loop/config-contract.test.ts', '--run'],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      LONG_LOOP_CONFIG_PRINT_COUNTS: '1'
    },
    stdio: 'inherit'
  }
);

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Long-loop config validation terminated by ${signal}`);
    process.exitCode = 1;
    return;
  }

  process.exitCode = code ?? 1;
});
