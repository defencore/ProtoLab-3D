import { LatheGeometry, Mesh, Vector2, Vector3 } from 'three';
import { BoundaryMesh } from '../../../../core/mechanical';
import { material, n, num } from '../../../../core/geometry';
import type { Parameters } from '../../../../core/types';

export type ThrustProfile = [number, number][];
export function thrustRevolve(profile: ThrustProfile, color = 0x85898e): Mesh {
  const geometry = new LatheGeometry(
    [...profile, profile[0]].map(([r, z]) => new Vector2(r, z)),
    96,
  );
  const p = geometry.getAttribute('position'),
    index = geometry.getIndex()!,
    indices: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    const [a, b, c] = ids.map((id) => new Vector3().fromBufferAttribute(p, id));
    if (b.sub(a).cross(c.sub(a)).lengthSq() > 1e-18) indices.push(...ids);
  }
  geometry.setIndex(indices);
  geometry.rotateX(Math.PI / 2);
  return new Mesh(geometry, material(color));
}
export function thrustRevolvePython(profile: ThrustProfile): string {
  return `Part.Face(Part.makePolygon([${[...profile, profile[0]].map(([r, z]) => `App.Vector(${num(r)},0,${num(z)})`).join(',')}])).revolve(App.Vector(0,0,0),App.Vector(0,0,1),360)`;
}

export function sphericalThrustValues(p: Parameters) {
  const r = n(p, 'bore') / 2,
    R = n(p, 'outer') / 2,
    w = n(p, 'width'),
    gap = R - r;
  const angle = ((90 - n(p, 'contactAngle')) * Math.PI) / 180,
    pitch = (r + R) / 2;
  const radius = Math.min(gap * 0.19, w * Math.cos(angle) * 0.19),
    length = (gap * 0.48) / Math.cos(angle);
  const seatRadius = pitch / Math.sin(angle),
    seat = (u: number) =>
      w / 2 + Math.sqrt(seatRadius ** 2 - pitch ** 2) - Math.sqrt(seatRadius ** 2 - u ** 2);
  const radialReach = (length / 2) * Math.cos(angle) + radius * Math.sin(angle);
  const windowReach = radialReach + gap * 0.014,
    band = gap * 0.035;
  const radii = [
    pitch - windowReach - band,
    pitch - windowReach,
    pitch + windowReach,
    pitch + windowReach + band,
  ];
  const deviation = Math.max(
    ...[radii[0], radii[3]].map((u) => seat(u) - (w / 2 + (u - pitch) * Math.tan(angle))),
  );
  const halfGap = (radius * 1.12) / Math.cos(angle) + deviation;
  const cageThickness = Math.min(radius * 0.14, w * 0.018);
  const count = n(p, 'elements'),
    beta = Math.asin((radius * 1.08) / radii[1]);
  return {
    r,
    R,
    w,
    gap,
    angle,
    pitch,
    radius,
    length,
    seatRadius,
    seat,
    radii,
    halfGap,
    cageThickness,
    count,
    beta,
  };
}
export function sphericalThrustProfiles(p: Parameters) {
  const v = sphericalThrustValues(p),
    housingInner = v.r + v.gap * 0.16,
    shaftOuter = v.R - v.gap * 0.14;
  const lower: ThrustProfile = [],
    upper: ThrustProfile = [];
  for (let i = 0; i <= 64; i++) {
    const a = housingInner + ((v.R - housingInner) * i) / 64,
      b = v.r + ((shaftOuter - v.r) * i) / 64;
    lower.push([a, Math.min(v.w * 0.76, Math.max(v.w * 0.04, v.seat(a) - v.halfGap))]);
    upper.push([b, Math.max(v.w * 0.24, Math.min(v.w * 0.96, v.seat(b) + v.halfGap))]);
  }
  const housing: ThrustProfile = [[housingInner, 0], [v.R, 0], ...lower.reverse()];
  const shaft: ThrustProfile = [[v.r, v.w], ...upper, [shaftOuter, v.w]];
  const roller: ThrustProfile = [[0, -v.length / 2]];
  for (let i = 0; i <= 24; i++) {
    const t = i / 12 - 1;
    roller.push([v.radius * (1 - 0.15 * t * t) * (0.9 + 0.1 * t), (t * v.length) / 2]);
  }
  roller.push([0, v.length / 2]);
  return { housing, shaft, roller };
}

/** Conical retainer bands and bridges form one closed cage around the inclined roller row. */
export function sphericalThrustCage(p: Parameters): Mesh {
  const v = sphericalThrustValues(p),
    angles: number[] = [];
  for (let i = 0; i < v.count; i++) {
    const a = (i * Math.PI * 2) / v.count;
    for (let j = 0; j < 8; j++) angles.push(a - v.beta + (2 * v.beta * j) / 8);
    for (let j = 0; j < 4; j++)
      angles.push(a + v.beta + (((Math.PI * 2) / v.count - 2 * v.beta) * j) / 4);
  }
  const occupied = (radial: number, cell: number) =>
    radial >= 0 &&
    radial < 3 &&
    (radial !== 1 || (((cell % angles.length) + angles.length) % angles.length) % 12 >= 8);
  const point = (r: number, a: number, side: number) =>
    new Vector3(r * Math.cos(a), r * Math.sin(a), v.seat(r) + (side * v.cageThickness) / 2);
  const mesh = new BoundaryMesh();
  for (let radial = 0; radial < 3; radial++)
    for (let cell = 0; cell < angles.length; cell++) {
      if (!occupied(radial, cell)) continue;
      const r0 = v.radii[radial],
        r1 = v.radii[radial + 1],
        a = angles[cell],
        b = cell + 1 === angles.length ? angles[0] + 2 * Math.PI : angles[cell + 1];
      for (const side of [-1, 1])
        mesh.face(
          [point(r0, a, side), point(r1, a, side), point(r1, b, side), point(r0, b, side)],
          [],
          new Vector3(0, 0, side),
        );
      for (const [adj, radius, side] of [
        [radial - 1, r0, -1],
        [radial + 1, r1, 1],
      ])
        if (!occupied(adj, cell))
          mesh.face(
            [point(radius, a, -1), point(radius, b, -1), point(radius, b, 1), point(radius, a, 1)],
            [],
            new Vector3(side * Math.cos((a + b) / 2), side * Math.sin((a + b) / 2), 0),
          );
      for (const [adj, angle, side] of [
        [cell - 1, a, -1],
        [cell + 1, b, 1],
      ])
        if (!occupied(radial, adj))
          mesh.face(
            [point(r0, angle, -1), point(r1, angle, -1), point(r1, angle, 1), point(r0, angle, 1)],
            [],
            new Vector3(-side * Math.sin(angle), side * Math.cos(angle), 0),
          );
    }
  const result = mesh.build(0xb09a63);
  result.name = 'Inclined windowed cage';
  return result;
}
export function sphericalThrustCagePython(p: Parameters): string {
  const v = sphericalThrustValues(p),
    profile: ThrustProfile = [
      ...v.radii.map((r) => [r, v.seat(r) - v.cageThickness / 2] as [number, number]),
      ...[...v.radii]
        .reverse()
        .map((r) => [r, v.seat(r) + v.cageThickness / 2] as [number, number]),
    ];
  return `cage=${thrustRevolvePython(profile)}\nfor i in range(${v.count}):\n    sector=Part.makeCylinder(${num(v.radii[2])},${num(v.w * 3)},App.Vector(0,0,-${num(v.w)}),App.Vector(0,0,1),${num((v.beta * 360) / Math.PI)})\n    sector=sector.cut(Part.makeCylinder(${num(v.radii[1])},${num(v.w * 3 + 2)},App.Vector(0,0,-${num(v.w + 1)})))\n    sector.rotate(App.Vector(0,0,0),App.Vector(0,0,1),i*${num(360 / v.count)}-${num((v.beta * 180) / Math.PI)})\n    cage=cage.cut(sector)\ncage=cage.removeSplitter()`;
}
