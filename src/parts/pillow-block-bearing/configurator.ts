import type { PartDefinition } from '../../core/types';

/** Ordered catalog selectors; numeric and conditional fields are defined by part.ts. */
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [
  {
    key: 'bore',
    label: 'Shaft diameter',
  },
  {
    key: 'totalHeight',
    label: 'Overall height',
  },
  {
    key: 'baseWidth',
    label: 'Base width',
  },
  {
    key: 'baseDepth',
    label: 'Base depth',
  },
];
