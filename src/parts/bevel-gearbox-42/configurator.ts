import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = {
  layout: 'three',
  bore: '8',
  socket: 'd',
  inputAngle: 0,
  sweep: 8,
};
export const parameters: ParameterDefinition[] = [
  {
    key: 'layout',
    label: 'Port configuration',
    type: 'select',
    visibleWhen: (_, s) => s !== 'housing',
    group: 'Product',
    options: [
      { value: 'two', label: 'Two gears · 90° transmission' },
      { value: 'three', label: 'Three gears · opposed outputs' },
    ],
  },
  {
    key: 'bore',
    label: 'Shaft size',
    type: 'select',
    visibleWhen: (_, s) => s !== 'housing',
    group: 'Product',
    options: [
      { value: '8', label: '8 mm' },
      { value: '10', label: '10 mm' },
    ],
  },
  {
    key: 'socket',
    label: 'Shaft interface',
    type: 'select',
    visibleWhen: (_, s) => s !== 'housing',
    group: 'Product',
    options: [
      { value: 'd', label: 'D bore · 1 mm flat' },
      { value: 'hex', label: 'Hex bore · across flats' },
      { value: 'keyway', label: 'Keyway · outward slot' },
      { value: 'tongue', label: 'Internal key · inward tongue' },
    ],
  },
  {
    key: 'inputAngle',
    label: 'Input rotation',
    type: 'number',
    group: 'Assembly',
    min: 0,
    max: 360,
    step: 1,
    unit: '°',
    visibleWhen: (_, s) => s !== 'housing',
    description: 'Coupled 1:1 rotations about the three port axes; not a differential.',
  },
  {
    key: 'sweep',
    label: 'Tooth sweep (reconstruction)',
    type: 'number',
    group: 'Tooth reconstruction',
    min: 0,
    max: 8,
    step: 0.5,
    unit: '°',
    visibleWhen: (_, s) => s !== 'housing',
    description:
      'Editable heel-to-toe twist in the 0–8° assembly range. The seller does not specify spiral angle or tooth flank generation; this is a visual reconstruction, not a cutting profile.',
  },
];
