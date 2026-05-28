import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { build } from 'esbuild';

const projectRoot = resolve(new URL('..', import.meta.url).pathname);
const outdir = await mkdtemp(join(tmpdir(), 'long-loop-config-'));
const outfile = join(outdir, 'validate-long-loop-config.mjs');

try {
  await build({
    stdin: {
      contents: `
        import { longLoopConfig } from './src/config/data/longLoopConfig';
        import { validateLongLoopConfig } from './src/config/validation/validateLongLoopConfig';

        const result = validateLongLoopConfig(longLoopConfig);

        if (result.errors.length > 0) {
          console.error('Long-loop config validation failed:');
          for (const error of result.errors) {
            console.error('- ' + error);
          }
          process.exitCode = 1;
        } else {
          console.log('Long-loop config validation passed.');
          console.log(JSON.stringify({ tableCounts: result.tableCounts }, null, 2));
        }
      `,
      loader: 'ts',
      resolveDir: projectRoot
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'silent'
  });

  await import(pathToFileURL(outfile).href);
} finally {
  await rm(outdir, { recursive: true, force: true });
}
