import type { PartDefinition } from '../../core/types';

/** Ordered catalog selectors; numeric and conditional fields are defined by part.ts. */
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [
  {
    key: 'family',
    label: 'Nut construction',
  },
  {
    key: 'shaftDiameter',
    label: 'Screw nominal diameter',
  },
  {
    key: 'lead',
    label: 'Lead per revolution',
  },
  {
    key: 'length',
    label: 'Length',
  },
];
