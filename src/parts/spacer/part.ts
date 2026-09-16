import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import * as THREE from 'three';
import type { PartDefinition, Parameters } from '../../core/types';
import { ring, n, num, numberParameter } from '../../core/geometry';
const values = (p: Parameters) => ({
  od: n(p, 'outerDiameter'),
  d: n(p, 'bore'),
  l: n(p, 'length'),
});
const part: PartDefinition = {
  id: 'spacer',
  name: 'Round spacer',
  category: 'FASTENERS & THREADS',
  subgroup: 'SPACERS & STANDOFFS',
  icon: 'bolt',
  complexity: '3 parameters',
  description: 'An unthreaded cylindrical standoff with an open through bore.',
  keywords: ['spacer', 'standoff', 'sleeve', 'bushing', 'tube', 'pcb'],
  parameters: [
    numberParameter('outerDiameter', 'Outside diameter', 'D', 'Dimensions', 3, 100),
    numberParameter('bore', 'Bore diameter', 'd', 'Dimensions', 1, 80),
    numberParameter('length', 'Length', 'L', 'Dimensions', 1, 200),
  ],
  defaults: { outerDiameter: 8, bore: 3.4, length: 15 },
  presets: modulePresets,
  validate(p) {
    const { od, d } = values(p);
    return od <= d ? ['Outside diameter must exceed the bore diameter.'] : [];
  },
  buildGeometry(p) {
    const { od, d, l } = values(p);
    const g = new THREE.Group();
    g.add(ring(od / 2, d / 2, l));
    return g;
  },
  python(p) {
    const { od, d, l } = values(p);
    return `outer = Part.makeCylinder(${num(od / 2)}, ${num(l)}, App.Vector(0, 0, ${num(-l / 2)}))\ninner = Part.makeCylinder(${num(d / 2)}, ${num(l + 2)}, App.Vector(0, 0, ${num(-l / 2 - 1)}))\nshape = outer.cut(inner)`;
  },
  dimensions(p) {
    const { od, l } = values(p);
    return [od, od, l];
  },
  notes:
    'Unthreaded through bore with square ends. Dimensions are nominal and do not include manufacturing tolerances.',
};
export default { ...part, presets: modulePresets };
