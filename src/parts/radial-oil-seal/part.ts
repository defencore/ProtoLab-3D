import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Group } from 'three';
import type { PartDefinition, Parameters } from '../../core/types';
import { annulusPython, compoundPython, DARK_STEEL, n, ring } from '../../core/geometry';
import {
  envelopeParameters,
  turnedMesh,
  turnedPython,
  validateEnvelope,
  type TurnedProfile,
} from './lib/parts/motion-bearing-utils';
import { motionSources } from './lib/catalog/motion-bearings';

function values(p: Parameters) {
  const R = n(p, 'outer') / 2,
    r = n(p, 'bore') / 2,
    width = n(p, 'width'),
    band = R - r,
    casing = R - band * 0.18,
    rubber = casing - 0.02;
  const profile: TurnedProfile = [
    [r, -width * 0.15],
    [r + band * 0.1, -width * 0.45],
    [rubber, -width * 0.45],
    [rubber, width * 0.4],
    [rubber - band * 0.15, width * 0.4],
    [rubber - band * 0.15, -width * 0.32],
    [r + band * 0.22, -width * 0.32],
    [r, -width * 0.15],
  ];
  return { R, r, width, casing, profile };
}
const part: PartDefinition = {
  id: 'radial-oil-seal',
  name: 'Radial shaft oil seal',
  category: 'BEARINGS & SEALS',
  subgroup: 'SHAFT SEALS',
  icon: 'bearing',
  complexity: 'Case + sealing lip',
  description:
    'A radial shaft-seal envelope with a metal case and a recessed flexible sealing lip.',
  keywords: ['oil seal', 'radial seal', 'shaft seal', 'lip seal', 'rotary', 'rubber', 'seal'],
  parameters: envelopeParameters,
  defaults: { bore: 14, outer: 28, width: 7 },
  presets: modulePresets,
  presetMatchKeys: ['bore', 'outer', 'width'],
  sources: motionSources('radial-oil-seal'),
  validate: validateEnvelope,
  buildGeometry(p) {
    const group = new Group(),
      v = values(p);
    group.add(ring(v.R, v.casing, v.width), turnedMesh(v.profile, DARK_STEEL));
    return group;
  },
  python(p) {
    const v = values(p);
    return compoundPython([annulusPython(v.R, v.casing, v.width), turnedPython(v.profile)]);
  },
  dimensions: (p) => [n(p, 'outer'), n(p, 'outer'), n(p, 'width')],
  notes:
    'Only nominal shaft diameter, housing diameter and width are supplier-verified. Case thickness and lip cross-section are representative. No garter spring, interference, elastomer deformation, pressure rating or exact seal-type claim is included.',
};
export default { ...part, presets: modulePresets };
