import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const defaults: Parameters = {
  variant: 'compressor',
  nominalBore: 65,
  diametralClearance: 0.1,
  height: 50,
  crown: 'flat',
  crownThickness: 5,
  dishDiameter: 32,
  dishDepth: 1.5,
  skirtWall: 3.5,
  grooveCount: 3,
  topLand: 6,
  grooveWidth: 2.5,
  groovePitch: 5.5,
  grooveDepth: 1.6,
  showRings: true,
  ringSideClearance: 0.15,
  ringRadialClearance: 0.15,
  ringProtrusion: 0.05,
  ringGap: 8,
  compressionHeight: 32,
  pinDiameter: 18,
  pinBoreClearance: 0.1,
  pinInnerDiameter: 10,
  pinLength: 51,
  bossDiameter: 26,
  bossDepth: 13,
  clipThickness: 1,
  clipRadialWidth: 1,
  clipGap: 40,
  pinEndClearance: 0.15,
  clipGrooveClearance: 0.1,
  showPin: true,
  showClips: true,
  rodBore: 12,
  sealSection: 2.5,
  explodedGap: 10,
};
const n = (
  key: string,
  label: string,
  group: string,
  min: number,
  max: number,
  step = 0.1,
): ParameterDefinition => numberParameter(key, label, '', group, min, max, step);
const engine = (p: Parameters) => p.variant !== 'pneumatic';
const pneumatic = (p: Parameters) => p.variant === 'pneumatic';
export const parameters: ParameterDefinition[] = [
  {
    key: 'variant',
    label: 'Piston type',
    type: 'select',
    group: 'Envelope',
    options: [
      { value: 'compressor', label: 'Compressor · hollow skirt' },
      { value: 'engine', label: 'Engine · hollow skirt' },
      { value: 'pneumatic', label: 'Pneumatic disk' },
    ],
  },
  {
    ...n('nominalBore', 'Nominal piston / cylinder size', 'Envelope', 20, 300),
    description:
      'Listing nominal size used as an editable cylinder-layout dimension. The source does not measure a cylinder bore or establish running fit.',
  },
  n('diametralClearance', 'Diametral running clearance', 'Envelope', 0.01, 2, 0.01),
  n('height', 'Overall body height', 'Envelope', 5, 200),
  {
    key: 'crown',
    label: 'Crown shape',
    type: 'select',
    group: 'Crown and skirt',
    visibleWhen: engine,
    options: [
      { value: 'flat', label: 'Flat' },
      { value: 'dished', label: 'Recessed dish' },
    ],
  },
  {
    ...n('crownThickness', 'Crown thickness before dish', 'Crown and skirt', 1, 30),
    visibleWhen: engine,
  },
  {
    ...n('dishDiameter', 'Dish diameter', 'Crown and skirt', 3, 240),
    visibleWhen: (p) => engine(p) && p.crown === 'dished',
  },
  {
    ...n('dishDepth', 'Dish depth', 'Crown and skirt', 0.2, 15),
    visibleWhen: (p) => engine(p) && p.crown === 'dished',
  },
  { ...n('skirtWall', 'Skirt radial wall', 'Crown and skirt', 1, 20), visibleWhen: engine },
  { ...n('grooveCount', 'Ring / seal count', 'Ring grooves', 1, 4, 1), unit: '' },
  n('topLand', 'Top face to first groove', 'Ring grooves', 1, 40),
  n('grooveWidth', 'Groove axial width', 'Ring grooves', 0.8, 12),
  n('groovePitch', 'Groove center spacing', 'Ring grooves', 1.5, 50),
  n('grooveDepth', 'Groove radial depth', 'Ring grooves', 0.4, 10),
  { key: 'showRings', label: 'Include rings / seals', type: 'boolean', group: 'Ring grooves' },
  {
    ...n('ringSideClearance', 'Ring side clearance per face', 'Split piston rings', 0.02, 1, 0.01),
    visibleWhen: engine,
  },
  n('ringRadialClearance', 'Ring / seal back clearance', 'Ring grooves', 0.02, 1, 0.01),
  {
    ...n('ringProtrusion', 'Ring protrusion above body', 'Split piston rings', 0, 1, 0.01),
    visibleWhen: engine,
  },
  {
    ...n('ringGap', 'Ring opening angle', 'Split piston rings', 2, 35, 1),
    unit: '°',
    visibleWhen: engine,
  },
  {
    ...n(
      'compressionHeight',
      'Compression height · crown to pin axis',
      'Wrist pin and bosses',
      5,
      140,
    ),
    visibleWhen: engine,
  },
  {
    ...n('pinDiameter', 'Wrist pin outside diameter', 'Wrist pin and bosses', 3, 60),
    visibleWhen: engine,
  },
  {
    ...n('pinBoreClearance', 'Pin bore diametral clearance', 'Wrist pin and bosses', 0.02, 1, 0.01),
    visibleWhen: engine,
  },
  {
    ...n('pinInnerDiameter', 'Hollow pin inside diameter', 'Wrist pin and bosses', 1, 50),
    visibleWhen: engine,
  },
  { ...n('pinLength', 'Wrist pin length', 'Wrist pin and bosses', 8, 240), visibleWhen: engine },
  {
    ...n('bossDiameter', 'Pin boss outside diameter', 'Wrist pin and bosses', 5, 100),
    visibleWhen: engine,
  },
  {
    ...n('bossDepth', 'Boss extension into hollow skirt', 'Wrist pin and bosses', 2, 70),
    visibleWhen: engine,
  },
  {
    key: 'showPin',
    label: 'Include wrist pin',
    type: 'boolean',
    group: 'Wrist pin and bosses',
    visibleWhen: engine,
  },
  {
    ...n('clipThickness', 'Clip axial thickness', 'Pin retaining clips', 0.3, 3),
    visibleWhen: engine,
  },
  {
    ...n('clipRadialWidth', 'Clip radial band width', 'Pin retaining clips', 0.4, 3),
    visibleWhen: engine,
  },
  {
    ...n('clipGap', 'Clip opening angle', 'Pin retaining clips', 15, 100, 1),
    unit: '°',
    visibleWhen: engine,
  },
  {
    ...n('pinEndClearance', 'Pin-to-clip axial clearance', 'Pin retaining clips', 0.03, 1, 0.01),
    visibleWhen: engine,
  },
  {
    ...n(
      'clipGrooveClearance',
      'Clip groove clearance per side',
      'Pin retaining clips',
      0.03,
      0.5,
      0.01,
    ),
    visibleWhen: engine,
  },
  {
    key: 'showClips',
    label: 'Include pin clips',
    type: 'boolean',
    group: 'Pin retaining clips',
    visibleWhen: engine,
  },
  {
    ...n('rodBore', 'Axial piston-rod through bore', 'Pneumatic mounting', 2, 120),
    visibleWhen: pneumatic,
  },
  {
    ...n('sealSection', 'Uncompressed O-ring section diameter', 'Pneumatic mounting', 1, 10),
    visibleWhen: pneumatic,
    description:
      'Circular prototype seal section. This model does not simulate squeeze, a pressure lip or seal selection.',
  },
  { ...n('explodedGap', 'Exploded component spacing', 'Display', 3, 80), filterable: false },
];
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [
  { key: 'variant', label: 'Piston type' },
  { key: 'nominalBore', label: 'Nominal bore' },
];
