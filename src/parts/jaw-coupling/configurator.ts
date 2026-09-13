import type { PartDefinition } from '../../core/types';

/** Ordered catalog selectors; numeric and conditional fields are defined by part.ts. */
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [
  {
    key: 'outerDiameter',
    label: 'Outside diameter',
  },
  {
    key: 'length',
    label: 'Length',
  },
  {
    key: 'boreA',
    label: 'Shaft bore A',
  },
  {
    key: 'boreB',
    label: 'Shaft bore B',
  },
];
