import type { PartDefinition } from '../../core/types';

/** Ordered catalog selectors; numeric and conditional fields are defined by part.ts. */
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [
  {
    key: 'diameter',
    label: 'Thread diameter',
  },
  {
    key: 'length',
    label: 'Length',
  },
  {
    key: 'eyeBore',
    label: 'Eye bore',
  },
  {
    key: 'threadSpan',
    label: 'Thread coverage',
  },
];
