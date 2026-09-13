import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Vector2 } from 'three';
import type { Parameters, PartDefinition } from '../../core/types';
import {
  profileHeadDimensions,
  profileHeadGeometry,
  profileHeadPython,
  type ProfileHead,
} from './lib/core/special-fasteners';

const defaults: Parameters = {
  diameter: 6,
  length: 20,
  pitch: 1,
  baseDiameter: 12.1,
  wingSpan: 26.4,
  headHeight: 12.7,
  tipThickness: 3,
  form: 'standard',
};
function head(p: Parameters): ProfileHead {
  const base = Number(p.baseDiameter) / 2,
    span = Number(p.wingSpan) / 2,
    h = Number(p.headHeight);
  const german = p.form === 'german';
  const outline = [
    [-base, 0],
    [base, 0],
    [span * 0.9, h * 0.57],
    [span, h * 0.88],
    [span * 0.87, h],
    [span * 0.54, h * 0.91],
    [base * 0.45, h * (german ? 0.42 : 0.35)],
    [0, h * (german ? 0.3 : 0.25)],
    [-base * 0.45, h * (german ? 0.42 : 0.35)],
    [-span * 0.54, h * 0.91],
    [-span * 0.87, h],
    [-span, h * 0.88],
    [-span * 0.9, h * 0.57],
  ].map(([x, y]) => new Vector2(x, y));
  return {
    outline,
    holes: [],
    thickness: (y) =>
      Number(p.baseDiameter) + ((Number(p.tipThickness) - Number(p.baseDiameter)) * y) / h,
    shaftLength: Number(p.length),
    diameter: Number(p.diameter),
  };
}
const part: PartDefinition = {
  id: 'wing-screw',
  name: 'Wing screw',
  category: 'FASTENERS',
  subgroup: 'BOLTS & SCREWS',
  icon: 'bolt',
  complexity: 'Hand tightened',
  standard: 'DIN 316',
  description:
    'A two-wing screw for quick manual clamping, with adjustable span, tapered head and shank length.',
  keywords: ['wing bolt', 'thumb screw', 'butterfly', 'DIN 316', 'German form'],
  defaults,
  parameters: [
    {
      key: 'diameter',
      label: 'Thread diameter',
      symbol: 'd',
      type: 'number',
      unit: 'mm',
      min: 1,
      max: 100,
      step: 0.5,
      group: 'Shank',
    },
    {
      key: 'length',
      label: 'Under-head length',
      symbol: 'L',
      type: 'number',
      unit: 'mm',
      min: 2,
      max: 1000,
      step: 1,
      group: 'Shank',
    },
    {
      key: 'pitch',
      label: 'Nominal pitch',
      symbol: 'P',
      type: 'number',
      unit: 'mm',
      min: 0.1,
      max: 8,
      step: 0.05,
      group: 'Shank',
      description:
        'Stored for thread identification. The preview and CAD use a smooth nominal thread envelope.',
    },
    {
      key: 'form',
      label: 'Wing form',
      type: 'select',
      options: [
        { value: 'standard', label: 'Standard wings' },
        { value: 'german', label: 'German wings' },
      ],
      group: 'Head',
    },
    {
      key: 'baseDiameter',
      label: 'Head base width',
      symbol: 'D',
      type: 'number',
      unit: 'mm',
      min: 2,
      max: 200,
      step: 0.1,
      group: 'Head',
    },
    {
      key: 'wingSpan',
      label: 'Wing span',
      symbol: 'e',
      type: 'number',
      unit: 'mm',
      min: 4,
      max: 400,
      step: 0.1,
      group: 'Head',
    },
    {
      key: 'headHeight',
      label: 'Head height',
      symbol: 'h',
      type: 'number',
      unit: 'mm',
      min: 2,
      max: 200,
      step: 0.1,
      group: 'Head',
    },
    {
      key: 'tipThickness',
      label: 'Wing tip thickness',
      symbol: 't',
      type: 'number',
      unit: 'mm',
      min: 0.5,
      max: 80,
      step: 0.1,
      group: 'Head',
    },
  ],
  presetMatchKeys: ['diameter', 'length', 'form'],
  presets: modulePresets,
  validate: (p) => {
    const errors: string[] = [];
    if (Number(p.baseDiameter) <= Number(p.diameter))
      errors.push('The head base must be wider than the shank.');
    if (Number(p.wingSpan) <= Number(p.baseDiameter) * 1.3)
      errors.push('The wing span must exceed 1.3 times the base width.');
    if (Number(p.tipThickness) >= Number(p.baseDiameter))
      errors.push('Wing tips must be thinner than the head base.');
    return errors;
  },
  buildGeometry: (p) => profileHeadGeometry(head(p)),
  dimensions: (p) => profileHeadDimensions(head(p)),
  python: (p) => profileHeadPython(head(p)),
  notes:
    'Nominal supplier dimensions with a faceted forged-wing profile and smooth thread envelope. The head base is an editable square envelope. DIN 316 source h and overall-length rows disagree, so head height and wing taper are not marked verified. No load rating or manufacturing certification is implied.',
  sources: [
    {
      label: 'Gvyntok DIN 316 drawing',
      url: 'https://gvyntok.com/wp-content/uploads/2024/06/040-300-001.pdf',
    },
  ],
};
export default { ...part, presets: modulePresets };
