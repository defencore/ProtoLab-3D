import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';
const split = (p: Parameters) => p.bigEnd === 'split-cap';
const select = (
  key: string,
  label: string,
  group: string,
  choices: [string, string][],
): ParameterDefinition => ({
  key,
  label,
  group,
  type: 'select',
  options: choices.map(([value, label]) => ({ value, label })),
});
export const defaults: Parameters = {
  centerDistance: 110,
  smallBore: 16,
  bigBore: 32,
  smallWall: 4,
  bigWall: 6,
  smallWidth: 18,
  bigWidth: 22,
  shankWidth: 16,
  smallShankWidth: 12,
  shankThickness: 10,
  section: 'i-beam',
  webThickness: 3,
  flangeThickness: 2,
  bigEnd: 'split-cap',
  smallBushing: true,
  bushingThickness: 1.2,
  bigBearing: 'shells',
  shellThickness: 1.5,
  fitClearance: 0.05,
  boltDiameter: 6,
  boltSpacing: 50,
  boltGrip: 20,
  splitGap: 0.05,
  includeHardware: true,
  finish: 'steel',
};
export const parameters: ParameterDefinition[] = [
  select('bigEnd', 'Big-end construction', 'Construction', [
    ['split-cap', 'Split bearing cap'],
    ['one-piece', 'One-piece eye'],
  ]),
  select('section', 'Shank section', 'Construction', [
    ['solid', 'Solid tapered beam'],
    ['i-beam', 'I-beam · face pockets'],
    ['h-beam', 'H-beam · side pockets'],
  ]),
  select('finish', 'Rod finish', 'Construction', [
    ['steel', 'Steel'],
    ['aluminum', 'Aluminum'],
    ['black', 'Black'],
  ]),
  numberParameter('centerDistance', 'Eye center distance', 'C', 'Eye sizes', 20, 500, 1),
  {
    ...numberParameter('smallBore', 'Working pin bore', 'd', 'Eye sizes', 3, 80, 0.5),
    description:
      'Finished small-end bore. Enabling a bushing enlarges the rod housing to preserve this pin diameter.',
  },
  {
    ...numberParameter('bigBore', 'Working journal bore', 'D', 'Eye sizes', 5, 150, 0.5),
    description:
      'Finished journal bore. Bearing shell thickness and fitting clearance enlarge the rod housing.',
  },
  numberParameter('smallWidth', 'Small-eye axial width', 'bₛ', 'Eye sizes', 4, 80, 0.5),
  numberParameter('bigWidth', 'Big-eye axial width', 'bᵦ', 'Eye sizes', 5, 100, 0.5),
  numberParameter('smallWall', 'Small-eye housing wall', 'wₛ', 'Eye sizes', 1.5, 20, 0.5),
  numberParameter('bigWall', 'Big-eye housing wall', 'wᵦ', 'Eye sizes', 2, 30, 0.5),
  {
    key: 'smallBushing',
    label: 'Include small-end bushing',
    group: 'Bearing inserts',
    type: 'boolean',
  },
  {
    ...numberParameter(
      'bushingThickness',
      'Bushing radial thickness',
      'tᵦ',
      'Bearing inserts',
      0.3,
      6,
      0.1,
    ),
    visibleWhen: (p) => Boolean(p.smallBushing),
  },
  select('bigBearing', 'Big-end bearing', 'Bearing inserts', [
    ['shells', 'Two bearing shells'],
    ['none', 'Plain housing bore'],
  ]),
  {
    ...numberParameter(
      'shellThickness',
      'Shell radial thickness',
      'tₛ',
      'Bearing inserts',
      0.3,
      8,
      0.1,
    ),
    visibleWhen: (p) => p.bigBearing === 'shells',
  },
  {
    ...numberParameter(
      'fitClearance',
      'Insert and hardware clearance',
      'c',
      'Bearing inserts',
      0.02,
      0.3,
      0.01,
    ),
    description:
      'Editable geometric assembly clearance; no tolerance or press-fit class is implied.',
  },
  numberParameter('shankWidth', 'Shank width at big eye', 'w₁', 'Shank', 4, 60, 0.5),
  numberParameter('smallShankWidth', 'Shank width at small eye', 'w₂', 'Shank', 3, 50, 0.5),
  numberParameter('shankThickness', 'Shank axial thickness', 't', 'Shank', 3, 40, 0.5),
  {
    ...numberParameter('webThickness', 'Web thickness', 't𝑤', 'Shank', 1, 20, 0.5),
    visibleWhen: (p) => p.section !== 'solid',
  },
  {
    ...numberParameter('flangeThickness', 'Flange thickness', 't𝑓', 'Shank', 1, 15, 0.5),
    visibleWhen: (p) => p.section !== 'solid',
  },
  {
    ...numberParameter('boltDiameter', 'Cap bolt diameter', 'M', 'Bearing cap', 2, 20, 0.5),
    visibleWhen: split,
  },
  {
    ...numberParameter('boltSpacing', 'Cap bolt center spacing', 's', 'Bearing cap', 15, 220, 0.5),
    visibleWhen: split,
  },
  {
    ...numberParameter('boltGrip', 'Distance between bolt seats', 'g', 'Bearing cap', 6, 70, 0.5),
    visibleWhen: split,
  },
  {
    ...numberParameter('splitGap', 'Cap split clearance', 'δ', 'Bearing cap', 0, 0.5, 0.01),
    visibleWhen: split,
  },
  {
    key: 'includeHardware',
    label: 'Include cap bolts and nuts',
    group: 'Bearing cap',
    type: 'boolean',
    visibleWhen: split,
  },
];
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [];
