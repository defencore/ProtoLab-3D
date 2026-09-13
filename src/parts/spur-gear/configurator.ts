import type { PartDefinition } from '../../core/types';

/** Ordered catalog selectors; numeric and conditional fields are defined by part.ts. */
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [
  {
    key: 'module',
    label: 'Module',
  },
  {
    key: 'teeth',
    label: 'Number of teeth',
  },
  {
    key: 'bore',
    label: 'Shaft bore',
  },
];
