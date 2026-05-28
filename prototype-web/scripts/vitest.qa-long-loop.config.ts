import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/qa-long-loop.evidence.test.ts']
  }
});
