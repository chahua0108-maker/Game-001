import type { GemConfig } from '../schema/definitions';

export const gems = [
  {
    id: 'gem.ember_shard',
    name: 'Ember Shard',
    gemType: 'run',
    value: 1
  },
  {
    id: 'gem.blood_ruby',
    name: 'Blood Ruby',
    gemType: 'meta',
    value: 5
  }
] as const satisfies readonly GemConfig[];
