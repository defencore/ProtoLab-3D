import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import * as THREE from 'three';
import type { PartDefinition, Parameters } from '../../core/types';
import { ring, n, num, numberParameter } from '../../core/geometry';
const values = (p: Parameters) => ({
  d: n(p, 'bore'),
  od: n(p, 'outerDiameter'),
  t: n(p, 'thickness'),
});
const part: PartDefinition = {
  id: 'washer',
  name: 'Flat washer',
  category: 'FASTENERS',
  subgroup: 'WASHERS',
  icon: 'bolt',
  complexity: '3 parameters',
  description: 'A simple annular washer with a real through hole.',
  keywords: ['washer', 'shim', 'ring', 'fastener', 'spacer'],
  parameters: [
    numberParameter('bore', 'Bore diameter', 'd', 'Dimensions', 1, 200),
    numberParameter('outerDiameter', 'Outside diameter', 'D', 'Dimensions', 2, 400),
    numberParameter('thickness', 'Thickness', 't', 'Dimensions', 0.2, 20),
  ],
  presetMatchKeys: ['bore', 'outerDiameter', 'thickness'],
  defaults: { bore: 6.4, outerDiameter: 12, thickness: 1.6 },
  presets: modulePresets,
  validate(p) {
    const { d, od } = values(p);
    return od <= d ? ['Outside diameter must exceed the bore diameter.'] : [];
  },
  buildGeometry(p) {
    const { d, od, t } = values(p);
    const g = new THREE.Group();
    g.add(ring(od / 2, d / 2, t));
    return g;
  },
  python(p) {
    const { d, od, t } = values(p);
    return `outer = Part.makeCylinder(${num(od / 2)}, ${num(t)}, App.Vector(0, 0, ${num(-t / 2)}))\ninner = Part.makeCylinder(${num(d / 2)}, ${num(t + 2)}, App.Vector(0, 0, ${num(-t / 2 - 1)}))\nshape = outer.cut(inner)`;
  },
  dimensions(p) {
    const { od, t } = values(p);
    return [od, od, t];
  },
  notes:
    'Flat annular geometry without edge chamfers. Check fit and clearances for your application.',
};
export default { ...part, presets: modulePresets };
