import type { PartDefinition } from '../../core/types';

/** Ordered catalog selectors; numeric and conditional fields are defined by part.ts. */
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [
  {
    key: 'module',
    label: 'Large-end module',
  },
  {
    key: 'pinionTeeth',
    label: 'Pinion teeth',
  },
  {
    key: 'wheelTeeth',
    label: 'Wheel teeth',
  },
  {
    key: 'pinionBore',
    label: 'Pinion stock bore',
  },
  {
    key: 'wheelBore',
    label: 'Wheel stock bore',
  },
];
