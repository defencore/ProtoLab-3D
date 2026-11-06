import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Group, Path, Shape, Vector2 } from 'three';
import type { PartDefinition, Parameters } from '../../core/types';
import { DARK_STEEL, extrude, n, num, numberParameter } from '../../core/geometry';
import { annularSector, loftMesh } from '../../core/mechanical';
import { envelopeParameters, validateEnvelope } from '../../core/hardware/motion-bearing-utils';
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
/** The source outline is a sequence of concentric circular runs and straight notch transitions. */
function nutWire(p: Parameters, z: number): string {
  const points = nutOutline(p),
    radius = (point: Vector2) => point.length();
  const same = (a: Vector2, b: Vector2) => Math.abs(radius(a) - radius(b)) < 1e-9;
  const start = points.findIndex(
    (point, i) => !same(point, points[(i + points.length - 1) % points.length]),
  );
  const ordered = [...points.slice(start), ...points.slice(0, start)];
  const runs: Vector2[][] = [];
  for (const point of ordered) {
    if (!runs.length || !same(runs.at(-1)![0], point)) runs.push([]);
    runs.at(-1)!.push(point);
  }
  const vector = (point: Vector2) => `App.Vector(${num(point.x)},${num(point.y)},${num(z)})`;
  const edges: string[] = [];
  runs.forEach((run, i) => {
    if (run.length >= 3)
      edges.push(
        `Part.Arc(${vector(run[0])},${vector(run[Math.floor(run.length / 2)])},${vector(run.at(-1)!)}).toShape()`,
      );
    else if (run.length === 2) edges.push(`Part.makeLine(${vector(run[0])},${vector(run[1])})`);
    edges.push(`Part.makeLine(${vector(run.at(-1)!)},${vector(runs[(i + 1) % runs.length][0])})`);
  });
  return `Part.Wire([${edges.join(',')}])`;
}
const part: PartDefinition = {
  id: 'adapter-sleeve',
  product: productData as ProductProfile,
  name: 'Adapter sleeve with locknut',
  category: 'BEARINGS & SEALS',
  subgroup: 'BEARING MOUNTING',
  icon: 'bearing',
  complexity: 'Split tapered sleeve',
  description:
    'A split adapter sleeve with a 1:12 diameter taper and a notched locking-nut envelope.',
  keywords: ['adapter', 'sleeve', 'H206', 'H208', 'taper', 'locknut', 'bearing mount'],
  parameters: [
    ...envelopeParameters().map((field) =>
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
    return [
      `sleeve = Part.makeCone(${num(v.small)},${num(v.seat)},${num(v.width - v.nut)},App.Vector(0,0,${num(-v.width / 2)}))`,
      `sleeve = sleeve.fuse(Part.makeCylinder(${num(v.seat)},${num(v.nut)},App.Vector(0,0,${num(v.width / 2 - v.nut)})))`,
      `sleeve = sleeve.cut(Part.makeCylinder(${num(v.bore)},${num(v.width + 2)},App.Vector(0,0,${num(-v.width / 2 - 1)})))`,
      `slit = Part.makeCylinder(${num(v.seat + 1)},${num(v.width + 2)},App.Vector(0,0,${num(-v.width / 2 - 1)}),App.Vector(0,0,1),${num(v.gap)})`,
      `slit.rotate(App.Vector(0,0,0),App.Vector(0,0,1),${num(-v.gap / 2)})`,
      'sleeve = sleeve.cut(slit).removeSplitter()',
      `nut = Part.Face(${nutWire(p, v.width / 2 - v.nut)}).extrude(App.Vector(0,0,${num(v.nut)}))`,
      `nut = nut.cut(Part.makeCylinder(${num(v.seat + 0.02)},${num(v.nut + 2)},App.Vector(0,0,${num(v.width / 2 - v.nut - 1)}))).removeSplitter()`,
      'shape = Part.makeCompound([sleeve,nut])',
      'component_labels = ["Split tapered sleeve","Locknut"]',
      'component_colors = [(119/255,127/255,137/255),(76/255,81/255,88/255)]',
    ].join('\n');
  },
  dimensions: (p) => [n(p, 'outer'), n(p, 'outer'), n(p, 'width')],
  notes:
    'Supplier assembly envelope, nominal bearing seat and nut thickness. Taper, split and notch details are representative; thread pitch/profile are unspecified and remain nominal in both modes; the locking-tab washer is omitted. This is not a thread-fit or installation-force model.',
};
export default { ...part, presets: modulePresets };
