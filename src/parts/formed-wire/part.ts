import { Box3, Group, Vector3 } from 'three';
import { helix, num } from '../../core/geometry';
import { disposeModel } from '../../core/mechanical';
import type { Parameters, PartDefinition } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import {
  hasWireCollision,
  wireDimensions,
  wireGeometry,
  wireLoftPython,
} from '../../core/hardware/spring-geometry';
import { defaults, parameters } from './configurator';
import product from './product.json';

export function wirePath(p: Parameters): Vector3[] {
  const source = String(p.path);
  if (source.length > 1_000_000) throw new Error('Wire centreline exceeds the size limit.');
  const path: unknown = JSON.parse(source);
  if (
    !Array.isArray(path) ||
    path.length < 2 ||
    path.length > 5000 ||
    path.some(
      (point) =>
        !Array.isArray(point) ||
        point.length !== 3 ||
        point.some(
          (value) =>
            typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 100000,
        ),
    )
  )
    throw new Error('A wire centreline needs 2–5000 finite three-dimensional points.');
  const points = path.map((point) => new Vector3(...(point as [number, number, number])));
  if (points.some((point, index) => index > 0 && point.distanceTo(points[index - 1]) < 1e-7))
    throw new Error('Adjacent wire centreline points must differ.');
  return points;
}
function coil(p: Parameters) {
  const radius = +p.coilRadius,
    height = +p.coilHeight,
    turns = +p.turns,
    wire = +p.wireDiameter / 2;
  if (
    ![radius, height, turns, wire].every(Number.isFinite) ||
    radius <= wire ||
    height <= 0 ||
    turns < 0.25 ||
    turns > 128 ||
    wire <= 0 ||
    height / turns <= wire * 2
  )
    throw new Error(
      'A helical wire needs a positive clear bore and pitch greater than its wire diameter.',
    );
  return { radius, height, turns, wire };
}
const part: PartDefinition = {
  id: 'formed-wire',
  product: product as ProductProfile,
  name: 'Configured formed wire',
  category: 'SPRINGS',
  subgroup: 'HELICAL SPRINGS',
  icon: 'spring',
  complexity: 'Configured wire route',
  description: 'A reusable formed-wire or spring detail defined by a local round-wire centreline.',
  keywords: ['wire', 'spring', 'forming', 'winding', 'bend', 'custom'],
  defaults,
  parameters,
  presets: [],
  validate(p) {
    try {
      if (p.mode === 'helix') {
        coil(p);
        return [];
      }
      if (p.mode !== 'path') return ['Choose a wire definition.'];
      const points = wirePath(p);
      return hasWireCollision(points, +p.wireDiameter)
        ? ['The wire centreline intersects another wire section.']
        : [];
    } catch (error) {
      return [error instanceof Error ? error.message : String(error)];
    }
  },
  buildGeometry(p) {
    if (p.mode === 'path') return wireGeometry(wirePath(p), +p.wireDiameter);
    const { radius, wire, height, turns } = coil(p),
      mesh = helix(radius, wire, height, turns);
    mesh.position.z = height / 2;
    return new Group().add(mesh);
  },
  dimensions(p) {
    if (p.mode === 'path') return wireDimensions(wirePath(p), +p.wireDiameter);
    const model = part.buildGeometry(p, 'default');
    try {
      return new Box3().setFromObject(model, true).getSize(new Vector3()).toArray() as [
        number,
        number,
        number,
      ];
    } finally {
      disposeModel(model);
    }
  },
  python(p) {
    if (p.mode === 'path') return wireLoftPython(wirePath(p), +p.wireDiameter);
    const { radius, wire, height, turns } = coil(p);
    return `spine=Part.Wire(Part.makeHelix(${num(height)}/${num(turns)},${num(height)},${num(radius)}).Edges)\nsection=Part.Wire([Part.makeCircle(${num(wire)},App.Vector(${num(radius)},0,0),App.Vector(0,${num(radius)}*2*math.pi,${num(height)}/${num(turns)}))])\nshape=spine.makePipeShell([section],True,True)`;
  },
  notes:
    'One physical wire detail. The configuration defines its posed centreline, not spring stiffness, free length, preload or fatigue capability. Assign engineering requirements in the project before fabrication.',
};
export default part;
