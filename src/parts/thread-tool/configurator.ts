import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
export const families = [
  ['metric', 'Metric M · coarse / fine · 60°'],
  ['unc', 'UNC · 60°'],
  ['unf', 'UNF · 60°'],
  ['unef', 'UNEF · 60°'],
  ['tr', 'Trapezoidal Tr · basic 30°'],
  ['acme', 'ACME · basic 29°'],
  ['custom', 'Custom symmetric profile'],
];
export const defaults: Parameters = {
  manufacturing: 'printed',
  family: 'metric',
  diameter: 6,
  pitchUnit: 'mm',
  pitch: 1,
  tpi: 25.4,
  length: 10,
  handedness: 'right',
  starts: 1,
  clearance: 0,
  angle: 60,
  depth: 0.5,
  crest: 0.125,
  form: 'tool',
  boreEnabled: false,
  boreDiameter: 2,
  capSize: 10,
  capThickness: 3,
};
const number = (
  key: string,
  label: string,
  min: number,
  max: number,
  step: number,
  unit: string,
  group = 'Dimensions',
): ParameterDefinition => ({ key, label, type: 'number', min, max, step, unit, group });
export const parameters: ParameterDefinition[] = [
  {
    key: 'manufacturing',
    label: 'Manufacturing method',
    type: 'select',
    group: 'Thread',
    options: [
      { value: 'machined', label: 'Machined metal · smooth with callout' },
      { value: 'printed', label: '3D printed · modeled thread' },
    ],
    description:
      'Machined threads use nominal cylinders for drawings. Only printed threads retain helical faces and print fit allowance.',
  },
  {
    key: 'form',
    label: 'Body form',
    type: 'select',
    group: 'Body',
    options: [
      { value: 'tool', label: 'Threaded body / Boolean tool' },
      { value: 'round-cap', label: 'Round cap / plug' },
      { value: 'hex-cap', label: 'Hexagonal cap / plug' },
    ],
    description:
      'Caps are finished parts: external mode makes a headed plug; internal mode makes a female threaded cap.',
  },
  { key: 'boreEnabled', label: 'Central through hole', type: 'boolean', group: 'Body' },
  {
    ...number('boreDiameter', 'Through-hole diameter', 0.1, 190, 0.1, 'mm', 'Body'),
    visibleWhen: (p) => p.boreEnabled === true,
  },
  {
    ...number('capSize', 'Cap diameter / hex across flats', 1, 240, 0.1, 'mm', 'Body'),
    visibleWhen: (p) => p.form !== 'tool',
  },
  {
    ...number('capThickness', 'Cap end thickness', 0.2, 100, 0.1, 'mm', 'Body'),
    visibleWhen: (p) => p.form !== 'tool',
  },
  {
    key: 'family',
    label: 'Thread family',
    type: 'select',
    group: 'Thread',
    options: families.map(([value, label]) => ({ value, label })),
  },
  number('diameter', 'Nominal major diameter', 0.5, 200, 0.01, 'mm'),
  {
    key: 'pitchUnit',
    label: 'Pitch input',
    type: 'select',
    group: 'Dimensions',
    options: [
      { value: 'mm', label: 'Pitch in millimetres' },
      { value: 'tpi', label: 'Threads per inch (TPI)' },
    ],
  },
  { ...number('pitch', 'Pitch', 0.1, 12, 0.01, 'mm'), visibleWhen: (p) => p.pitchUnit === 'mm' },
  {
    ...number('tpi', 'Threads per inch', 2.2, 254, 0.1, 'TPI'),
    visibleWhen: (p) => p.pitchUnit === 'tpi',
    description: 'Pitch = 25.4 / TPI. Do not enter the multi-start lead here.',
  },
  {
    ...number('length', 'Threaded length / cap cavity depth', 0.1, 500, 0.1, 'mm'),
    description: 'Cap end thickness is additional to this length.',
  },
  {
    key: 'handedness',
    label: 'Thread direction',
    type: 'select',
    group: 'Helix',
    options: [
      { value: 'right', label: 'Right hand' },
      { value: 'left', label: 'Left hand' },
    ],
  },
  {
    ...number('starts', 'Number of starts', 1, 4, 1, '', 'Helix'),
    description: 'Lead per revolution = pitch × starts. Standard catalog entries have one start.',
  },
  {
    ...number('clearance', 'Radial fit adjustment', 0, 2, 0.01, 'mm', 'Fit'),
    visibleWhen: (p) => p.manufacturing === 'printed',
    description:
      'Per side: enlarges the Internal Cut tool, reduces the External Union tool. Applying it to both halves doubles the radial gap. This is not an ISO/ASME tolerance class.',
  },
  {
    ...number('angle', 'Included flank angle', 10, 100, 0.5, '°', 'Custom profile'),
    visibleWhen: (p) => p.family === 'custom',
  },
  {
    ...number('depth', 'Radial thread depth', 0.02, 10, 0.01, 'mm', 'Custom profile'),
    visibleWhen: (p) => p.family === 'custom',
  },
  {
    ...number('crest', 'Crest width / pitch', 0.03, 0.8, 0.005, '', 'Custom profile'),
    visibleWhen: (p) => p.family === 'custom',
    description: 'Flat crest width as a fraction of axial pitch. Roots are flat.',
  },
];
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [
  { key: 'family', label: 'Thread family' },
  { key: 'diameter', label: 'Major diameter' },
  { key: 'pitch', label: 'Pitch (mm)' },
];
export function updateParameters(p: Parameters, key: string): Parameters {
  if (key === 'pitchUnit')
    return p.pitchUnit === 'tpi'
      ? { ...p, tpi: 25.4 / Number(p.pitch) }
      : { ...p, pitch: 25.4 / Number(p.tpi) };
  if (key === 'pitch') return { ...p, tpi: 25.4 / Number(p.pitch) };
  if (key === 'tpi') return { ...p, pitch: 25.4 / Number(p.tpi) };
  return p;
}
