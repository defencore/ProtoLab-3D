import type { PartDefinition } from '../../core/types';

/** Ordered catalog selectors; numeric and conditional fields are defined by part.ts. */
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [
  {
    key: 'bore',
    label: 'Bore diameter',
  },
  {
    key: 'outer',
    label: 'Head diameter',
  },
  {
    key: 'width',
    label: 'Inner-member width',
  },
  {
    key: 'headWidth',
    label: 'Head width',
  },
];
