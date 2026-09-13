import type { PartDefinition } from '../../core/types';

/** Ordered catalog selectors; numeric and conditional fields are defined by part.ts. */
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [
  {
    key: 'bore',
    label: 'Shaft / bore diameter',
  },
  {
    key: 'outer',
    label: 'Outside diameter',
  },
  {
    key: 'width',
    label: 'Overall axial width',
  },
  {
    key: 'outerWidth',
    label: 'Outer ring width',
  },
];
