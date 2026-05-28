import type { CollectionCategoryConfig } from '../schema/definitions';

export const collectionCategories = [
  {
    id: 'category.starter',
    name: 'Starter Kit',
    sortOrder: 10
  },
  {
    id: 'category.services',
    name: 'Services',
    sortOrder: 20
  },
  {
    id: 'category.relics',
    name: 'Relics',
    sortOrder: 30
  }
] as const satisfies readonly CollectionCategoryConfig[];
