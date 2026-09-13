import { Group, Vector2, Vector3 } from 'three';
import type { Parameters } from '../../../../core/types';
import { annulusPython, n, num, numberParameter, ring } from '../../../../core/geometry';
import { BoundaryMesh, circleSection, pythonWire } from '../../../../core/mechanical';
import {
  sphericalMeridian,
  turnedMesh,
  turnedPython,
  type TurnedProfile,
} from './motion-bearing-utils';

export const flangeDefaults = {
  bore: 20,
  flangeWidth: 86,
  flangeLength: 86,
  width: 33.3,
  housingDepth: 25.5,
  flangeThickness: 12,
  mountPitch: 64,
  hole: 12,
  insertWidth: 31,
  insertOuter: 47,
  outerWidth: 17,
  innerShoulder: 27.56,
  seatCenter: 15,
};
export const flangeParameters = [
  numberParameter('bore', 'Shaft bore', 'd', 'Insert', 3, 180),
  numberParameter('flangeLength', 'Flange length', 'L', 'Housing', 25, 500),
  numberParameter('flangeWidth', 'Flange width', 'H', 'Housing', 20, 500),
  numberParameter('width', 'Overall axial depth', 'U', 'Housing', 10, 200),
  numberParameter('housingDepth', 'Housing depth', 'A', 'Housing', 5, 180),
  numberParameter('flangeThickness', 'Mounting flange thickness', 'A1', 'Housing', 2, 80),
  numberParameter('mountPitch', 'Mounting center spacing', 'J', 'Mounting', 12, 450),
  numberParameter('hole', 'Mounting hole diameter', 'N', 'Mounting', 3, 50),
  numberParameter('insertWidth', 'Inner ring width', 'B', 'Insert', 5, 160),
  numberParameter('insertOuter', 'Insert outside diameter', 'D', 'Insert', 10, 300),
  numberParameter('outerWidth', 'Outer ring width', 'C', 'Insert', 3, 100),
  numberParameter('innerShoulder', 'Inner shoulder diameter', 'd1', 'Insert', 5, 220),
  numberParameter('seatCenter', 'Race center from mounting face', 'A2', 'Insert', 3, 150),
];
function hull(points: Vector2[]) {
  const sorted = points.sort((a, b) => a.x - b.x || a.y - b.y),
    cross = (o: Vector2, a: Vector2, b: Vector2) =>
      (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: Vector2[]) => {
    const out: Vector2[] = [];
    for (const point of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], point) <= 1e-9)
        out.pop();
      out.push(point);
    }
    return out;
  };
  const a = half(sorted),
    b = half([...sorted].reverse());
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}
function outline(p: Parameters, bolts: 2 | 4): Vector2[] {
  const length = n(p, 'flangeLength'),
    width = n(p, 'flangeWidth');
  if (bolts === 2) {
    const end = (length - n(p, 'mountPitch')) / 2;
    return hull([
      ...Array.from(
        { length: 96 },
        (_, i) =>
          new Vector2(
            (Math.cos((i * Math.PI) / 48) * width) / 2,
            (Math.sin((i * Math.PI) / 48) * width) / 2,
          ),
      ),
      ...[-1, 1].flatMap((side) =>
        Array.from(
          { length: 48 },
          (_, i) =>
            new Vector2(
              (side * n(p, 'mountPitch')) / 2 + Math.cos((i * Math.PI) / 24) * end,
              Math.sin((i * Math.PI) / 24) * end,
            ),
        ),
      ),
    ]);
  }
  const r = Math.min(n(p, 'hole') * 0.8, Math.min(length, width) * 0.15);
  return [0, 1, 2, 3].flatMap((corner) =>
    Array.from({ length: 17 }, (_, i) => {
      const a = ((corner + i / 16) * Math.PI) / 2;
      return new Vector2(
        (corner === 0 || corner === 3 ? 1 : -1) * (length / 2 - r) + r * Math.cos(a),
        (corner < 2 ? 1 : -1) * (width / 2 - r) + r * Math.sin(a),
      );
    }),
  );
}
function values(p: Parameters) {
  const R = n(p, 'insertOuter') / 2,
    hub = n(p, 'innerShoulder') / 2,
    base = Math.min(n(p, 'flangeWidth') * 0.49, R + Math.max(4, n(p, 'flangeWidth') * 0.1)),
    top = R + (base - R) * 0.62;
  return {
    R,
    hub,
    base,
    top,
    seat: n(p, 'seatCenter'),
    C: n(p, 'outerWidth'),
    t: n(p, 'flangeThickness'),
    A: n(p, 'housingDepth'),
    width: n(p, 'width'),
    B: n(p, 'insertWidth'),
    r: n(p, 'bore') / 2,
  };
}
function holes(p: Parameters, bolts: 2 | 4) {
  const j = n(p, 'mountPitch') / 2;
  return bolts === 2
    ? [new Vector2(-j, 0), new Vector2(j, 0)]
    : [-1, 1].flatMap((x) => [-1, 1].map((y) => new Vector2(x * j, y * j)));
}
function insertProfile(p: Parameters): TurnedProfile {
  const v = values(p),
    inside = v.hub + (v.R - v.hub) * 0.42;
  return [
    [inside, v.seat - v.C / 2],
    ...sphericalMeridian(v.R, v.C).map(([r, z]) => [r, z + v.seat] as [number, number]),
    [inside, v.seat + v.C / 2],
    [inside, v.seat - v.C / 2],
  ];
}
export function validateFlange(p: Parameters, bolts: 2 | 4): string[] {
  const v = values(p),
    errors: string[] = [];
  if (v.hub <= v.r + 0.3 || v.R <= v.hub + 1)
    errors.push('The insert needs material around the shaft and room for its outer ring.');
  if (v.A <= v.t + 0.5 || v.width < v.A || v.B > v.width)
    errors.push(
      'Overall depth must contain the housing and inner ring; housing depth must exceed flange thickness.',
    );
  if (v.seat - v.C / 2 < 0 || v.seat + v.C / 2 > v.A || v.C >= v.B)
    errors.push(
      'Position the outer ring fully inside the housing and within the inner ring width.',
    );
  if (v.width - v.B > v.seat - v.C / 2 || v.width < v.seat + v.C / 2)
    errors.push('The inner ring must span both outer-ring faces.');
  if (
    v.base <= v.R + 0.5 ||
    v.C / 2 >= v.R ||
    Math.sqrt(v.R * v.R - (v.C * v.C) / 4) <= v.hub + (v.R - v.hub) * 0.45
  )
    errors.push('The spherical insert seat must retain positive wall thickness.');
  if (
    n(p, 'mountPitch') + n(p, 'hole') + 2 >= n(p, 'flangeLength') ||
    (bolts === 4 && n(p, 'mountPitch') + n(p, 'hole') + 2 >= n(p, 'flangeWidth'))
  )
    errors.push('Mounting holes need material inside the flange boundary.');
  if (holes(p, bolts).some((point) => point.length() - n(p, 'hole') / 2 <= v.base + 0.5))
    errors.push('Mounting holes must clear the raised bearing housing.');
  if (
    bolts === 2 &&
    (n(p, 'flangeLength') <= n(p, 'flangeWidth') ||
      (n(p, 'flangeLength') - n(p, 'mountPitch')) / 2 >= n(p, 'flangeWidth') / 2)
  )
    errors.push('The two-bolt flange needs a longer mounting axis and narrower end ears.');
  return errors;
}
export function flangeGeometry(p: Parameters, bolts: 2 | 4): Group {
  const v = values(p),
    group = new Group(),
    mesh = new BoundaryMesh(),
    outer = outline(p, bolts),
    bottom = outer.map((point) => new Vector3(point.x, point.y, 0)),
    top = outer.map((point) => new Vector3(point.x, point.y, v.t)),
    seatR = v.R + 0.04;
  const bore0 = circleSection(seatR, new Vector3()),
    boreA = circleSection(seatR, new Vector3(0, 0, v.A)),
    crown0 = circleSection(v.base, new Vector3(0, 0, v.t)),
    crownA = circleSection(v.top, new Vector3(0, 0, v.A));
  const hole0 = holes(p, bolts).map((point) =>
      circleSection(n(p, 'hole') / 2, new Vector3(point.x, point.y, 0)),
    ),
    holeT = holes(p, bolts).map((point) =>
      circleSection(n(p, 'hole') / 2, new Vector3(point.x, point.y, v.t)),
    );
  mesh.face(bottom, [bore0, ...hole0], new Vector3(0, 0, -1));
  mesh.face(top, [crown0, ...holeT], new Vector3(0, 0, 1));
  mesh.bridge(bottom, top);
  mesh.bridge(crown0, crownA);
  mesh.face(crownA, [boreA], new Vector3(0, 0, 1));
  mesh.bridge(bore0, boreA, true);
  hole0.forEach((hole, i) => mesh.bridge(hole, holeT[i], true));
  const housing = mesh.build(0x284477);
  housing.name = 'Cast flange housing';
  group.add(housing);
  group.add(turnedMesh(insertProfile(p)));
  const hub = ring(v.hub, v.r, v.B);
  hub.position.z = v.width - v.B / 2;
  hub.name = 'Extended locking inner ring';
  group.add(hub);
  for (const side of [-1, 1]) {
    const seal = ring(v.hub + (v.R - v.hub) * 0.42, v.hub + 0.02, v.C * 0.08, 0x252d35);
    seal.position.z = v.seat + side * v.C * 0.44;
    seal.name = 'Insert seal';
    group.add(seal);
  }
  return group;
}
export function flangePython(p: Parameters, bolts: 2 | 4): string {
  const v = values(p);
  return `housing = Part.Face(${pythonWire(outline(p, bolts), 0)}).extrude(App.Vector(0,0,${num(v.t)}))\nhousing = housing.fuse(Part.makeCone(${num(v.base)},${num(v.top)},${num(v.A - v.t)},App.Vector(0,0,${num(v.t)})))\nhousing = housing.cut(Part.makeCylinder(${num(v.R + 0.04)},${num(v.A + 2)},App.Vector(0,0,-1)))\n${holes(
    p,
    bolts,
  )
    .map(
      (point) =>
        `housing = housing.cut(Part.makeCylinder(${num(n(p, 'hole') / 2)},${num(v.t + 2)},App.Vector(${num(point.x)},${num(point.y)},-1)))`,
    )
    .join(
      '\n',
    )}\nouter_ring = ${turnedPython(insertProfile(p))}\ninner_ring = ${annulusPython(v.hub, v.r, v.B, v.width - v.B)}\nshape = Part.makeCompound([housing.removeSplitter(),outer_ring,inner_ring,${[-1, 1].map((side) => annulusPython(v.hub + (v.R - v.hub) * 0.42, v.hub + 0.02, v.C * 0.08, v.seat + side * v.C * 0.44 - v.C * 0.04)).join(',')}])`;
}
export const flangeDimensions = (p: Parameters): [number, number, number] => [
  n(p, 'flangeLength'),
  n(p, 'flangeWidth'),
  n(p, 'width'),
];
export const flangeNotes =
  'Mounting face is Z = 0; the shaft follows Z. The model includes the mounting-hole pattern, tapered raised housing, crowned insert, offset inner ring and two seals. Marked supplier dimensions are preserved; casting fillets, reinforcement ribs, locking-screw holes and grease fittings remain representative or omitted. Not a rated bearing or detailed casting drawing.';
