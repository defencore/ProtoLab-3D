import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Group, Vector2, Vector3 } from 'three';
import { BoundaryMesh, circleSection, pythonWire } from '../../core/mechanical';
import { annulusPython } from '../../core/geometry';

import type { PartDefinition, Parameters } from '../../core/types';
import { compoundPython, cylinder, DARK_STEEL, n, num, numberParameter } from '../../core/geometry';
import {
  envelopeParameters,
  validateEnvelope,
  type TurnedProfile,
} from './lib/parts/motion-bearing-utils';
import { motionSources } from './lib/catalog/motion-bearings';

function values(p: Parameters) {
  const R = n(p, 'outer') / 2,
    r = n(p, 'bore') / 2,
    width = n(p, 'width'),
    band = R - r;
  const roller = band * 0.24,
    pitch = r + roller,
    inner = R - band * 0.25;
  const profile: TurnedProfile = [
    [r, -width / 2],
    [R, -width / 2],
    [R, width / 2],
    [r, width / 2],
    [r, width * 0.4],
    [inner, width * 0.4],
    [inner, -width * 0.4],
    [r, -width * 0.4],
    [r, -width / 2],
  ];
  return { R, r, width, band, roller, pitch, profile };
}
function camOutline(p: Parameters): Vector2[] {
  const v = values(p),
    count = n(p, 'rollers');
  return Array.from({ length: count * 12 }, (_, i) => {
    const sector = (i % 12) / 12,
      a = (i * Math.PI * 2) / (count * 12),
      radius = v.r + v.band * (0.51 + 0.23 * sector);
    return new Vector2(radius * Math.cos(a), radius * Math.sin(a));
  });
}
function camCup(p: Parameters) {
  const v = values(p),
    mesh = new BoundaryMesh(),
    circle = (radius: number, z: number) => circleSection(radius, new Vector3(0, 0, z));
  const outer0 = circle(v.R, -v.width / 2),
    outer1 = circle(v.R, v.width / 2),
    bore0 = circle(v.r, -v.width / 2),
    bore1 = circle(v.r, v.width / 2),
    lip0 = circle(v.r, -v.width * 0.4),
    lip1 = circle(v.r, v.width * 0.4),
    cam0 = camOutline(p).map((point) => new Vector3(point.x, point.y, -v.width * 0.4)),
    cam1 = camOutline(p).map((point) => new Vector3(point.x, point.y, v.width * 0.4));
  mesh.face(outer0, [bore0], new Vector3(0, 0, -1));
  mesh.face(outer1, [bore1], new Vector3(0, 0, 1));
  mesh.bridge(outer0, outer1);
  mesh.bridge(bore0, lip0, true);
  mesh.bridge(lip1, bore1, true);
  mesh.face(cam0, [lip0], new Vector3(0, 0, 1));
  mesh.face(cam1, [lip1], new Vector3(0, 0, -1));
  mesh.bridge(cam0, cam1, true);
  return mesh.build();
}
const part: PartDefinition = {
  id: 'one-way-clutch',
  name: 'Drawn-cup one-way clutch',
  category: 'BEARINGS',
  subgroup: 'ONE-WAY CLUTCHES',
  icon: 'bearing',
  complexity: 'Cup + locking rollers',
  description: 'An HF-style drawn cup with repeated locking-ramp cavities and an axial roller set.',
  keywords: ['one way', 'overrunning', 'clutch', 'freewheel', 'HF1012', 'HF1216', 'drawn cup'],
  parameters: [
    ...envelopeParameters,
    {
      ...numberParameter('rollers', 'Illustrative roller count', 'n', 'Internal layout', 4, 40, 1),
      unit: '',
    },
  ],
  defaults: { bore: 10, outer: 14, width: 12, rollers: 10 },
  presets: modulePresets,
  presetMatchKeys: ['bore', 'outer', 'width'],
  sources: motionSources('one-way-clutch'),
  validate(p) {
    const errors = validateEnvelope(p),
      v = values(p),
      count = n(p, 'rollers');
    if (!Number.isInteger(count)) errors.push('Roller count must be an integer.');
    if (2 * v.pitch * Math.sin(Math.PI / count) <= v.roller * 2.05)
      errors.push('Too many rollers for the shaft envelope.');
    return errors;
  },
  buildGeometry(p) {
    const group = new Group(),
      v = values(p);
    group.add(camCup(p));
    for (let i = 0; i < n(p, 'rollers'); i++) {
      const a = (i * 2 * Math.PI) / n(p, 'rollers'),
        roller = cylinder(v.roller, v.width * 0.75, DARK_STEEL);
      roller.position.set(v.pitch * Math.cos(a), v.pitch * Math.sin(a), 0);
      group.add(roller);
    }
    return group;
  },
  python(p) {
    const v = values(p),
      shapes = [
        `${annulusPython(v.R, v.r, v.width)}.cut(Part.Face(${pythonWire(camOutline(p), -v.width * 0.4)}).extrude(App.Vector(0,0,${num(v.width * 0.8)})))`,
      ];
    for (let i = 0; i < n(p, 'rollers'); i++) {
      const a = (i * Math.PI * 2) / n(p, 'rollers');
      shapes.push(
        `Part.makeCylinder(${num(v.roller)}, ${num(v.width * 0.75)}, App.Vector(${num(v.pitch * Math.cos(a))}, ${num(v.pitch * Math.sin(a))}, ${num(-v.width * 0.375)}))`,
      );
    }
    return compoundPython(shapes);
  },
  dimensions: (p) => [n(p, 'outer'), n(p, 'outer'), n(p, 'width')],
  notes:
    'HF-style envelope without an inner ring. Rollers touch the nominal shaft envelope; cup wall, count and spacing are representative. The cup includes a repeated cam-ramp cavity. Ramp angles, springs and cage details are not manufacturer specifications, and the model does not simulate locking operation.',
};
export default { ...part, presets: modulePresets };
