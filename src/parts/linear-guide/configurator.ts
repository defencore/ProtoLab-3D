import type { PartDefinition } from '../../core/types';

/** Ordered catalog selectors; numeric and conditional fields are defined by part.ts. */
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [
  {
    key: 'railWidth',
    label: 'Rail width',
  },
  {
    key: 'blockWidth',
    label: 'Carriage width',
  },
  {
    key: 'blockLength',
    label: 'Carriage length',
  },
  {
    key: 'totalHeight',
    label: 'Assembly height',
  },
];
