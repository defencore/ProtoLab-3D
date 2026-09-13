import type { PartDefinition } from '../../core/types';

/** Ordered catalog selectors; numeric and conditional fields are defined by part.ts. */
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [
  {
    key: 'bore',
    label: 'Shaft bore',
  },
  {
    key: 'flangeLength',
    label: 'Flange length',
  },
  {
    key: 'flangeWidth',
    label: 'Flange width',
  },
  {
    key: 'width',
    label: 'Overall axial depth',
  },
];
