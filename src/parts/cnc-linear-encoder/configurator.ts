import type { ParameterDefinition, Parameters } from '../../core/types';
import { encoderExecutions } from './lib/specs';
export const defaults: Parameters = {
  model: 'ls477-605365-86',
  component: 'assembly',
  headPosition: 0,
};
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Purchased execution',
    type: 'select',
    group: 'Supplier component',
    options: encoderExecutions.map((row) => ({ value: row.id, label: row.designation })),
  },
  {
    key: 'component',
    label: 'Inspection component',
    type: 'select',
    group: 'Inspection',
    options: [
      { value: 'assembly', label: 'Complete purchased unit' },
      { value: 'scale', label: 'Supplied scale housing' },
      { value: 'readhead', label: 'Supplied readhead' },
    ],
    description:
      'Physical children of one LS 477 procurement unit. The MSL 41 spar is a separate purchased model.',
  },
  {
    key: 'headPosition',
    label: 'Head displacement from mid stroke',
    type: 'number',
    group: 'Inspection',
    unit: 'mm',
    min: -820,
    max: 820,
    step: 0.1,
    description:
      'Inspection pose only; constrained by the selected measuring length. This does not change the purchased execution.',
  },
];
export const catalogFilterFields: ParameterDefinition[] = [
  {
    key: 'endBlock',
    label: 'Source end block',
    type: 'select',
    group: 'Source dimensions',
    options: [
      { value: '09A', label: '09A normal' },
      { value: '10A', label: '10A short, mounting spar required' },
    ],
  },
  {
    key: 'overallLength',
    label: 'Housing / spar overall length',
    type: 'number',
    group: 'Source dimensions',
    unit: 'mm',
  },
  {
    key: 'kind',
    label: 'Purchased item',
    type: 'select',
    group: 'Catalog',
    catalogSummary: true,
    options: [
      { value: 'encoder', label: 'LS 477 housing and readhead kit' },
      { value: 'spar', label: 'Separately ordered MSL 41 mounting spar' },
    ],
  },
  {
    key: 'measuringLength',
    label: 'Measuring length',
    type: 'number',
    group: 'Source dimensions',
    unit: 'mm',
    catalogSummary: true,
  },
  {
    key: 'accuracyMicrons',
    label: 'Specified accuracy grade',
    type: 'number',
    group: 'Source ratings',
    unit: 'um',
    catalogSummary: true,
  },
  {
    key: 'evaluatedStepMicrons',
    label: 'Evaluated measuring step',
    type: 'number',
    group: 'Source ratings',
    unit: 'um',
    catalogSummary: true,
  },
];
