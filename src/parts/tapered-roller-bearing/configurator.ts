import type { PartDefinition } from '../../core/types';

/** Ordered catalog selectors; numeric and conditional fields are defined by part.ts. */
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [
  {
    key: 'bore',
    label: 'Bore diameter',
  },
  {
    key: 'outer',
    label: 'Outer diameter',
  },
  {
    key: 'width',
    label: 'Overall assembly width',
  },
];
