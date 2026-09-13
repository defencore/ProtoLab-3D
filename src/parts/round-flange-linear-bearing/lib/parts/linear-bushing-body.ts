import { Group, Path, Shape, Vector2, Vector3 } from 'three';
import { booleans, primitives, solidUnionMesh } from '../../../../core/solid-union';
import { annulusPython, extrude, n, num, ring } from '../../../../core/geometry';
import { pythonWire } from '../../../../core/mechanical';
import type { Parameters } from '../../../../core/types';
import { ballMeshes, ballPython, circuitPoints } from './guide-circuits';

/** Loaded and return paths are representative; only the external supplier envelope is authoritative. */
export function bushingLayout(p: Parameters) {
  const r = n(p, 'bore') / 2,
    R = n(p, 'outer') / 2,
    length = n(p, 'width');
  const radius = Math.min(r * 0.12, (R - r) * 0.16, length * 0.025);
  const cageOuter = r + 5 * radius,
    sealWidth = radius * 1.2;
  const angles = Array.from(
    { length: n(p, 'circuits') },
    (_, i) => (i * 2 * Math.PI) / n(p, 'circuits'),
  );
  const balls = angles.flatMap((a) =>
    circuitPoints(length - 2 * sealWidth, r + radius, r + 3.5 * radius, radius).map(
      (v) => new Vector3(v.y * Math.cos(a), v.y * Math.sin(a), v.x),
    ),
  );
  return { r, R, length, radius, cageOuter, sealWidth, angles, balls };
}
function cageProfile(p: Parameters, cutaway: boolean) {
  const v = bushingLayout(p);
  const innerRadius = (a: number) => {
    let radius = v.r + v.radius * 0.12;
    for (const row of v.angles) {
      const delta = Math.atan2(Math.sin(a - row), Math.cos(a - row));
      if (Math.cos(delta) > 0)
        radius = Math.max(
          radius,
          Math.min(
            (v.r + v.radius * 4.62) / Math.cos(delta),
            (v.radius * 1.12) / Math.max(1e-12, Math.abs(Math.sin(delta))),
          ),
        );
    }
    return radius;
  };
  const arc = (radius: (a: number) => number, reverse = false) =>
    Array.from({ length: cutaway ? 193 : 384 }, (_, i) => {
      const a = cutaway
        ? Math.PI / 2 + (Math.PI * (reverse ? 192 - i : i)) / 192
        : (Math.PI * 2 * (reverse ? 383 - i : i)) / 384;
      return new Vector2(radius(a) * Math.cos(a), radius(a) * Math.sin(a));
    });
  const inside = arc(innerRadius, true);
  const cleaned = inside.filter((point, i) => {
    if (cutaway && (i === 0 || i === inside.length - 1)) return true;
    const a = point.clone().sub(inside[(i + inside.length - 1) % inside.length]);
    const b = inside[(i + 1) % inside.length].clone().sub(point);
    return Math.abs(a.x * b.y - a.y * b.x) > 1e-10;
  });
  return { outside: arc(() => v.cageOuter), inside: cleaned };
}
const cylinder = (radius: number, height: number, z = 0) =>
  primitives.cylinder({ radius, height, center: [0, 0, z], segments: 64 });
function steel(p: Parameters, flanged: boolean, cutaway: boolean) {
  const v = bushingLayout(p);
  let body = cylinder(v.R, v.length - 2 * v.sealWidth);
  if (flanged) {
    const t = n(p, 'flangeThickness'),
      z = -v.length / 2 + t / 2;
    const plate = booleans.intersect(
      primitives.cuboid({ size: [n(p, 'flangeWidth'), n(p, 'flangeWidth'), t], center: [0, 0, z] }),
      cylinder(n(p, 'flangeDiameter') / 2, t, z),
    );
    body = booleans.union(body, plate);
  }
  body = booleans.subtract(body, cylinder(v.cageOuter, v.length + 2));
  if (flanged) {
    body = booleans.subtract(body, cylinder(v.R, 2 * v.sealWidth, -v.length / 2));
    for (const a of [Math.PI / 4, (Math.PI * 3) / 4, (Math.PI * 5) / 4, (Math.PI * 7) / 4]) {
      const x = (n(p, 'boltCircle') / 2) * Math.cos(a),
        y = (n(p, 'boltCircle') / 2) * Math.sin(a),
        top = -v.length / 2 + n(p, 'flangeThickness');
      body = booleans.subtract(
        body,
        primitives.cylinder({
          radius: n(p, 'holeDiameter') / 2,
          height: n(p, 'flangeThickness') + 2,
          center: [x, y, -v.length / 2 + n(p, 'flangeThickness') / 2],
          segments: 48,
        }),
        primitives.cylinder({
          radius: n(p, 'counterbore') / 2,
          height: n(p, 'counterDepth') + 1,
          center: [x, y, top - n(p, 'counterDepth') / 2 + 0.5],
          segments: 48,
        }),
      );
    }
  } else {
    for (const sign of [-1, 1])
      body = booleans.subtract(
        body,
        booleans.subtract(
          cylinder(v.R + 1, v.length * 0.05, sign * v.length * 0.325),
          cylinder(v.R - (v.R - v.cageOuter) * 0.4, v.length * 0.05 + 2, sign * v.length * 0.325),
        ),
      );
  }
  if (cutaway)
    body = booleans.intersect(
      body,
      primitives.cuboid({
        size: [
          (flanged ? n(p, 'flangeWidth') : v.R * 2) * 2,
          (flanged ? n(p, 'flangeWidth') : v.R * 2) * 4,
          v.length * 4,
        ],
        center: [-(flanged ? n(p, 'flangeWidth') : v.R * 2), 0, 0],
      }),
    );
  const group = solidUnionMesh(body);
  // solidUnionMesh centers its result; restore the CAD origin and the cut-plane position.
  group.position.set(
    cutaway ? -(flanged ? n(p, 'flangeWidth') / 2 : v.R) / 2 : 0,
    0,
    flanged ? -v.sealWidth / 2 : 0,
  );
  group.name = 'Outer steel sleeve';
  return group;
}
export function bushingGeometry(p: Parameters, state: string, flanged = false): Group {
  const v = bushingLayout(p),
    cutaway = state === 'cutaway',
    group = new Group();
  group.add(steel(p, flanged, cutaway));
  const profile = cageProfile(p, cutaway),
    shape = new Shape(cutaway ? [...profile.outside, ...profile.inside] : profile.outside);
  if (!cutaway) shape.holes.push(new Path(profile.inside));
  const cage = extrude(shape, v.length - 2 * v.sealWidth, 0x4d5863);
  cage.name = 'Slotted return cage';
  group.add(cage);
  for (const side of [-1, 1]) {
    const wiper = ring(v.R, v.r, v.sealWidth, 0x222a32);
    wiper.position.z = side * (v.length / 2 - v.sealWidth / 2);
    wiper.name = 'End wiper';
    group.add(wiper);
  }
  group.add(...ballMeshes(v.balls, v.radius));
  return group;
}
export function bushingPython(p: Parameters, state: string, flanged = false): string {
  const v = bushingLayout(p),
    cutaway = state === 'cutaway',
    lines = [
      `sleeve = Part.makeCylinder(${num(v.R)},${num(v.length - 2 * v.sealWidth)},App.Vector(0,0,${num(-v.length / 2 + v.sealWidth)}))`,
    ];
  if (flanged) {
    const w = n(p, 'flangeWidth'),
      t = n(p, 'flangeThickness');
    lines.push(
      `flange = Part.makeBox(${num(w)},${num(w)},${num(t)},App.Vector(${num(-w / 2)},${num(-w / 2)},${num(-v.length / 2)})).common(Part.makeCylinder(${num(n(p, 'flangeDiameter') / 2)},${num(t)},App.Vector(0,0,${num(-v.length / 2)})))`,
      `sleeve = sleeve.fuse(flange)`,
    );
  }
  lines.push(
    `sleeve = sleeve.cut(Part.makeCylinder(${num(v.cageOuter)},${num(v.length + 2)},App.Vector(0,0,${num(-v.length / 2 - 1)})))`,
  );
  if (flanged) {
    lines.push(
      `sleeve = sleeve.cut(Part.makeCylinder(${num(v.R)},${num(2 * v.sealWidth)},App.Vector(0,0,${num(-v.length / 2 - v.sealWidth)})))`,
    );
    for (const a of [Math.PI / 4, (Math.PI * 3) / 4, (Math.PI * 5) / 4, (Math.PI * 7) / 4]) {
      const x = (n(p, 'boltCircle') / 2) * Math.cos(a),
        y = (n(p, 'boltCircle') / 2) * Math.sin(a),
        top = -v.length / 2 + n(p, 'flangeThickness');
      lines.push(
        `sleeve = sleeve.cut(Part.makeCylinder(${num(n(p, 'holeDiameter') / 2)},${num(n(p, 'flangeThickness') + 2)},App.Vector(${num(x)},${num(y)},${num(-v.length / 2 - 1)})))`,
        `sleeve = sleeve.cut(Part.makeCylinder(${num(n(p, 'counterbore') / 2)},${num(n(p, 'counterDepth') + 1)},App.Vector(${num(x)},${num(y)},${num(top - n(p, 'counterDepth'))})))`,
      );
    }
  } else
    for (const sign of [-1, 1])
      lines.push(
        `sleeve = sleeve.cut(${annulusPython(v.R + 1, v.R - (v.R - v.cageOuter) * 0.4, v.length * 0.05, sign * v.length * 0.325 - v.length * 0.025)})`,
      );
  if (cutaway) {
    const w = (flanged ? n(p, 'flangeWidth') : v.R * 2) * 2;
    lines.push(
      `sleeve = sleeve.common(Part.makeBox(${num(w)},${num(w * 2)},${num(v.length * 4)},App.Vector(${num(-w)},${num(-w)},${num(-v.length * 2)})))`,
    );
  }
  lines.push('components = [sleeve.removeSplitter()]');
  const profile = cageProfile(p, cutaway),
    z = -v.length / 2 + v.sealWidth;
  lines.push(
    cutaway
      ? `cage = Part.Face(${pythonWire([...profile.outside, ...profile.inside], z)})`
      : `cage = Part.Face(${pythonWire(profile.outside, z)}).cut(Part.Face(${pythonWire(profile.inside, z)}))`,
    `components.append(cage.extrude(App.Vector(0,0,${num(v.length - 2 * v.sealWidth)})))`,
  );
  for (const side of [-1, 1])
    lines.push(
      `components.append(${annulusPython(v.R, v.r, v.sealWidth, side * (v.length / 2 - v.sealWidth / 2) - v.sealWidth / 2)})`,
    );
  lines.push(
    `components.extend([${ballPython(v.balls, v.radius).join(',')}])`,
    'shape = Part.makeCompound(components)',
    `component_labels = ${JSON.stringify(['Bearing sleeve', 'Return cage', 'Rear wiper', 'Front wiper', ...v.balls.map((_, i) => `Recirculating ball ${i + 1}`)])}`,
  );
  return lines.join('\n');
}
