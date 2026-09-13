import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import * as THREE from 'three';
import type { Parameters, PartDefinition } from '../../core/types';
import { extrude, n, num, numberParameter } from '../../core/geometry';
import { gearSources } from './lib/core/gears';

export function rackProfile(p: Parameters): THREE.Vector2[] {
  const m = n(p, 'module');
  const count = n(p, 'teeth');
  const pitch = Math.PI * m;
  const length = pitch * count;
  const base = n(p, 'baseHeight');
  const height = base + 2.25 * m;
  const slope = Math.tan((n(p, 'pressureAngle') * Math.PI) / 180);
  const halfThickness = pitch / 4 - n(p, 'backlash') / 4;
  const rootHalf = halfThickness + 1.25 * m * slope;
  const tipHalf = halfThickness - m * slope;
  const points = [
    new THREE.Vector2(-length / 2, -height / 2),
    new THREE.Vector2(length / 2, -height / 2),
    new THREE.Vector2(length / 2, base - height / 2),
  ];
  for (let tooth = count - 1; tooth >= 0; tooth--) {
    const x = -length / 2 + (tooth + 0.5) * pitch;
    points.push(
      new THREE.Vector2(x + rootHalf, base - height / 2),
      new THREE.Vector2(x + tipHalf, height / 2),
      new THREE.Vector2(x - tipHalf, height / 2),
      new THREE.Vector2(x - rootHalf, base - height / 2),
    );
  }
  points.push(new THREE.Vector2(-length / 2, base - height / 2));
  return points;
}

const defaults = {
  module: 1,
  teeth: 20,
  pressureAngle: 20,
  backlash: 0.1,
  faceWidth: 8,
  baseHeight: 5,
};
const part: PartDefinition = {
  id: 'gear-rack',
  name: 'Straight gear rack',
  category: 'MOTION',
  subgroup: 'GEARS & RACKS',
  icon: 'gear',
  complexity: 'Linear motion',
  description: 'A rack with straight pressure-angle tooth flanks for an involute spur pinion.',
  keywords: ['gear', 'rack', 'pinion', 'linear', 'transmission', 'teeth'],
  parameters: [
    numberParameter('module', 'Module', 'm', 'Teeth', 0.2, 8),
    { ...numberParameter('teeth', 'Number of teeth', 'z', 'Teeth', 2, 120, 1), unit: '' },
    {
      ...numberParameter('pressureAngle', 'Pressure angle', 'α', 'Teeth', 14.5, 30, 0.5),
      unit: '°',
    },
    {
      ...numberParameter('backlash', 'Pair backlash allowance', 'j', 'Teeth', 0, 2, 0.01),
      description:
        'Each rack tooth is thinned by half this allowance. Use the same pair allowance on the pinion.',
    },
    numberParameter('faceWidth', 'Face width', 'b', 'Body', 1, 80, 0.5),
    {
      ...numberParameter('baseHeight', 'Backing height', 'h', 'Body', 0.5, 100),
      description: 'Solid backing below the tooth roots. Total height adds 2.25 × module.',
    },
  ],
  defaults,
  presets: modulePresets,
  validate(p) {
    const errors: string[] = [];
    if (!Number.isInteger(n(p, 'teeth'))) errors.push('Number of teeth must be an integer.');
    const m = n(p, 'module');
    if (n(p, 'backlash') >= (Math.PI * m) / 3)
      errors.push('Backlash allowance must be less than one third of the circular pitch.');
    if (
      (Math.PI * m) / 4 -
        n(p, 'backlash') / 4 -
        m * Math.tan((n(p, 'pressureAngle') * Math.PI) / 180) <=
      m * 0.03
    )
      errors.push('The tooth tips are too narrow. Reduce pressure angle or backlash.');
    return errors;
  },
  buildGeometry(p) {
    const group = new THREE.Group();
    group.add(extrude(new THREE.Shape(rackProfile(p)), n(p, 'faceWidth')));
    return group;
  },
  python(p) {
    const points = rackProfile(p).map(({ x, y }) => [Number(num(x)), Number(num(y))]);
    return `points = [App.Vector(x, y, ${num(-n(p, 'faceWidth') / 2)}) for x, y in ${JSON.stringify(points)}]
outline = Part.makePolygon(points + [points[0]])
shape = Part.Face(outline).extrude(App.Vector(0, 0, ${num(n(p, 'faceWidth'))}))`;
  },
  dimensions(p) {
    return [
      Math.PI * n(p, 'module') * n(p, 'teeth'),
      n(p, 'baseHeight') + 2.25 * n(p, 'module'),
      n(p, 'faceWidth'),
    ];
  },
  notes:
    'Straight flanks, 1-module addendum and 1.25-module dedendum; sharp tooth roots without cutter fillets. Match pinion module and pressure angle. Pitch line is 1 module below the tips. No mounting holes or strength rating.',
  sources: gearSources,
};
export default { ...part, presets: modulePresets };
