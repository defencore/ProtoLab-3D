import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';

const threaded = (p: Parameters) =>
  p.variant === 'female-threaded' || p.variant === 'male-threaded';
const clamped = (p: Parameters) => !threaded(p);
const select = (
  key: string,
  label: string,
  group: string,
  options: [string, string][],
): ParameterDefinition => ({
  key,
  label,
  group,
  type: 'select',
  options: options.map(([value, label]) => ({ value, label })),
});
export const defaults: Parameters = {
  variant: 'pushrod',
  length: 25,
  bodyDiameter: 7,
  forkGap: 3,
  forkDepth: 10,
  pinDiameter: 2.5,
  pinOffset: 3.5,
  rodDiameter: 2,
  rodDepth: 15,
  threadPitch: 0.5,
  threadMode: 'modeled',
  handedness: 'right',
  maleLength: 12,
  setScrewDiameter: 3,
  setScrewCount: 2,
  setScrewSpacing: 5,
  setScrewOffset: 4,
  includeHardware: true,
  clearance: 0.15,
  finish: 'red',
};
export const parameters: ParameterDefinition[] = [
  select('variant', 'Clevis type', 'Construction', [
    ['pushrod', 'Pushrod · set screws'],
    ['female-threaded', 'Female threaded fork'],
    ['male-threaded', 'Male threaded fork'],
    ['cable', 'Cable fork terminal'],
  ]),
  select('finish', 'Finish', 'Construction', [
    ['red', 'Red anodized'],
    ['blue', 'Blue anodized'],
    ['steel', 'Steel'],
    ['black', 'Black'],
  ]),
  numberParameter('length', 'Fork body length', 'L', 'Body', 8, 200, 0.5),
  numberParameter('bodyDiameter', 'Body diameter', 'D', 'Body', 3, 60, 0.5),
  numberParameter('forkGap', 'Clear fork gap', 'g', 'Fork', 0.5, 40),
  numberParameter('forkDepth', 'Fork opening depth', 'f', 'Fork', 3, 100, 0.5),
  numberParameter('pinDiameter', 'Pin / screw diameter', 'dₚ', 'Fork', 1, 25, 0.5),
  numberParameter('pinOffset', 'Pin center from tip', 'e', 'Fork', 1, 40),
  {
    ...numberParameter(
      'rodDiameter',
      'Rod / cable bore or thread',
      'd',
      'Rod connection',
      1,
      30,
      0.5,
    ),
    description:
      'Nominal thread diameter for threaded variants; actual bore diameter for clamped rods and cables.',
  },
  {
    ...numberParameter('rodDepth', 'Rod bore / thread depth', 'h', 'Rod connection', 2, 150, 0.5),
    visibleWhen: (p) => p.variant !== 'male-threaded',
  },
  {
    ...numberParameter(
      'maleLength',
      'Male threaded shank length',
      'l',
      'Rod connection',
      2,
      100,
      0.5,
    ),
    visibleWhen: (p) => p.variant === 'male-threaded',
  },
  {
    ...select('threadMode', 'Rod thread geometry', 'Rod connection', [
      ['modeled', 'Modeled helical thread'],
      ['envelope', 'Smooth nominal envelope'],
    ]),
    visibleWhen: threaded,
  },
  {
    ...numberParameter('threadPitch', 'Rod thread pitch', 'P', 'Rod connection', 0.2, 4, 0.05),
    visibleWhen: threaded,
  },
  {
    ...select('handedness', 'Rod thread direction', 'Rod connection', [
      ['right', 'Right hand'],
      ['left', 'Left hand'],
    ]),
    visibleWhen: (p) => threaded(p) && p.threadMode === 'modeled',
  },
  {
    ...numberParameter(
      'setScrewDiameter',
      'Set screw nominal diameter',
      'M',
      'Set screws',
      1.5,
      12,
      0.5,
    ),
    visibleWhen: clamped,
  },
  {
    ...numberParameter('setScrewCount', 'Number of set screws', 'n', 'Set screws', 1, 3, 1),
    unit: '',
    visibleWhen: clamped,
  },
  {
    ...numberParameter('setScrewOffset', 'First screw from rear face', 'a', 'Set screws', 1, 60),
    visibleWhen: clamped,
  },
  {
    ...numberParameter('setScrewSpacing', 'Set screw center spacing', 's', 'Set screws', 2, 60),
    visibleWhen: (p) => clamped(p) && Number(p.setScrewCount) > 1,
  },
  {
    key: 'includeHardware',
    label: 'Include pin screw, locknut and set screws',
    type: 'boolean',
    group: 'Assembly',
  },
  {
    ...numberParameter('clearance', 'Hardware radial clearance', 'c', 'Assembly', 0.02, 0.5, 0.01),
    description: 'Preview and CAD assembly clearance; no tolerance class is implied.',
  },
];
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [
  { key: 'variant', label: 'Clevis type' },
  { key: 'rodDiameter', label: 'Rod / cable diameter' },
  { key: 'pinDiameter', label: 'Pin diameter' },
  { key: 'forkGap', label: 'Fork gap' },
];
