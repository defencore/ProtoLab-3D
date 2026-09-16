import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Group, Path, Shape, Vector2 } from 'three';
import type { PartDefinition, Parameters } from '../../core/types';
import { DARK_STEEL, extrude, n, num, numberParameter } from '../../core/geometry';
import { annularSector, loftMesh, pythonWire } from '../../core/mechanical';
import { envelopeParameters, validateEnvelope } from './lib/parts/motion-bearing-utils';
import { motionSources } from './lib/catalog/motion-bearings';

function values(p: Parameters) {
  const width = n(p, 'width'),
    nut = n(p, 'nutThickness'),
    seat = n(p, 'seatDiameter') / 2;
  return {
    width,
    nut,
    seat,
    small: seat - (width - nut) / 24,
    bore: n(p, 'bore') / 2,
    outer: n(p, 'outer') / 2,
    gap: n(p, 'slitAngle'),
  };
}
function sections(p: Parameters) {
  const v = values(p);
  return [
    { points: annularSector(v.small, v.bore, v.gap), z: -v.width / 2 },
    { points: annularSector(v.seat, v.bore, v.gap), z: v.width / 2 - v.nut },
    { points: annularSector(v.seat, v.bore, v.gap), z: v.width / 2 },
  ];
}
function nutOutline(p: Parameters): Vector2[] {
  const v = values(p),
    depth = (v.outer - v.seat) * 0.25;
  return Array.from({ length: 96 }, (_, i) => {
    const angle = (i * Math.PI * 2) / 96,
      notch =
        Math.abs(((angle + Math.PI / 4) % (Math.PI / 2)) - Math.PI / 4) >
        Math.PI / 4 - Math.PI / 24,
      radius = v.outer - (notch ? depth : 0);
    return new Vector2(radius * Math.cos(angle), radius * Math.sin(angle));
  });
}
const part: PartDefinition = {
  id: 'adapter-sleeve',
  name: 'Adapter sleeve with locknut',
  category: 'BEARINGS & SEALS',
  subgroup: 'BEARING MOUNTING',
  icon: 'bearing',
  complexity: 'Split tapered sleeve',
  description:
    'A split adapter sleeve with a 1:12 diameter taper and a notched locking-nut envelope.',
  keywords: ['adapter', 'sleeve', 'H206', 'H208', 'taper', 'locknut', 'bearing mount'],
  parameters: [
    ...envelopeParameters.map((field) =>
      field.key === 'outer' ? { ...field, label: 'Locknut outside diameter', symbol: 'd3' } : field,
    ),
    numberParameter('seatDiameter', 'Large bearing-seat diameter', 'd', 'Sleeve', 2, 250),
    numberParameter('nutThickness', 'Locknut thickness', 'B', 'Locknut', 1, 40),
    {
      ...numberParameter('slitAngle', 'Illustrative split angle', 'α', 'Sleeve', 1, 12, 1),
      unit: '°',
    },
  ],
  defaults: { bore: 25, outer: 45, width: 27, seatDiameter: 30, nutThickness: 7, slitAngle: 4 },
  presets: modulePresets,
  presetMatchKeys: ['bore', 'outer', 'width', 'seatDiameter', 'nutThickness'],
  sources: motionSources('adapter-sleeve'),
  validate(p) {
    const errors = validateEnvelope(p),
      v = values(p);
    if (v.nut >= v.width - 1)
      errors.push('The locknut must leave at least 1 mm of tapered sleeve length.');
    if (v.small <= v.bore + 0.1)
      errors.push('The tapered small end must retain a positive wall around the shaft.');
    if (v.outer <= v.seat + 1)
      errors.push('The locknut must extend beyond the sleeve with at least 1 mm of radial wall.');
    return errors;
  },
  buildGeometry(p) {
    const group = new Group(),
      v = values(p);
    group.add(loftMesh(sections(p)));
    const shape = new Shape(nutOutline(p)),
      hole = new Path();
    hole.absarc(0, 0, v.seat + 0.02, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const nut = extrude(shape, v.nut, DARK_STEEL);
    nut.position.z = (v.width - v.nut) / 2;
    group.add(nut);
    return group;
  },
  python(p) {
    const v = values(p);
    return `sections = [${sections(p)
      .map((section) => pythonWire(section.points, section.z))
      .join(
        ', ',
      )}]\nsleeve = Part.makeLoft(sections, True, True)\nnut = Part.Face(${pythonWire(nutOutline(p), v.width / 2 - v.nut)}).extrude(App.Vector(0, 0, ${num(v.nut)}))\nnut = nut.cut(Part.makeCylinder(${num(v.seat + 0.02)}, ${num(v.nut + 2)}, App.Vector(0, 0, ${num(v.width / 2 - v.nut - 1)})))\nshape = Part.makeCompound([sleeve, nut])`;
  },
  dimensions: (p) => [n(p, 'outer'), n(p, 'outer'), n(p, 'width')],
  notes:
    'Supplier assembly envelope, nominal bearing seat and nut thickness. Taper, split and notch details are representative; threads are smooth and the locking-tab washer is omitted. This is not a thread-fit or installation-force model.',
};
export default { ...part, presets: modulePresets };
