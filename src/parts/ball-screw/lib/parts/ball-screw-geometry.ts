import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  ShapeUtils,
  Vector2,
  Vector3,
} from 'three';
import { booleans, primitives, solidUnionMesh, transforms } from '../../../../core/solid-union';
import { BoundaryMesh, disposeModel } from '../../../../core/mechanical';
import { cylinder, material, n, num, ring, sphere } from '../../../../core/geometry';
import type { Parameters } from '../../../../core/types';

// A one-micron inspection offset avoids periodic face seams in OpenCascade half cuts.
const inspectionPlane = 0.001;

export const ballScrewDefaults: Parameters = {
  family: 'SFU',
  shaftDiameter: 16,
  lead: 5,
  ballDiameter: 3.175,
  nutDiameter: 28,
  flangeDiameter: 48,
  flangeThickness: 10,
  flangeOffset: 0,
  nutLength: 50,
  mountCircle: 38,
  flangeWidth: 40,
  mountHoleDiameter: 5.5,
  mountHoleCount: '6',
  mountCounterboreDiameter: 0,
  mountCounterboreDepth: 0,
  circuits: 4,
  circuitTurns: 1,
  starts: 1,
  oilHoleDiameter: 6,
  length: 200,
  endMachining: 'custom',
  fixedJournalDiameter: 12,
  fixedJournalLength: 15,
  driveJournalDiameter: 10,
  driveJournalLength: 15,
  supportJournalDiameter: 10,
  supportJournalLength: 12,
  nutPosition: 50,
  rotation: 0,
  hand: 'right',
  accuracy: 'C7',
  detail: 'raceway',
};

export function ballScrewLayout(p: Parameters) {
  const r = n(p, 'shaftDiameter') / 2,
    br = n(p, 'ballDiameter') / 2,
    lead = n(p, 'lead'),
    length = n(p, 'length'),
    nl = n(p, 'nutLength'),
    machined = p.endMachining === 'custom',
    left = machined ? n(p, 'fixedJournalLength') + n(p, 'driveJournalLength') : 0,
    right = machined ? n(p, 'supportJournalLength') : 0,
    start = -length / 2 + left,
    end = length / 2 - right,
    hand = p.hand === 'left' ? -1 : 1,
    rotation = n(p, 'rotation'),
    travel = end - start - nl - 2 * lead,
    base = (start + end) / 2 + (n(p, 'nutPosition') / 100 - 0.5) * Math.max(0, travel),
    center = base + (hand * lead * rotation) / 360,
    track = r + br * 0.35,
    cutter = br * 1.06,
    inner = track,
    core = track + cutter + br * 0.15,
    phase = (-rotation * Math.PI) / 180;
  return {
    r,
    br,
    lead,
    length,
    nl,
    start,
    end,
    hand,
    center,
    base,
    phase,
    track,
    cutter,
    inner,
    core,
    machined,
    double: p.family === 'DFU' || p.family === 'DFI',
    oblong: p.family === 'SFI' || p.family === 'DFI',
    endReturn: ['SFS', 'SFE', 'SFH', 'SFY'].includes(String(p.family)),
    detail: p.detail === 'raceway',
  };
}

function grooveRadius(p: Parameters, z: number, angle: number, nut: boolean) {
  const v = ballScrewLayout(p),
    starts = n(p, 'starts'),
    a = starts * (angle - v.phase - (v.hand * 2 * Math.PI * z) / v.lead),
    delta =
      (((Math.atan2(Math.sin(a), Math.cos(a)) * v.lead) / (2 * Math.PI * starts)) * v.track) /
      Math.hypot(v.track, v.lead / (2 * Math.PI)),
    h = Math.sqrt(Math.max(0, v.cutter * v.cutter - delta * delta));
  if (Math.abs(delta) >= v.cutter) return nut ? v.inner : v.r;
  return nut ? Math.max(v.inner, v.track + h) : Math.min(v.r, v.track - h);
}

/** The radial profile is swept with the same pitch and hand as the native helical cutter. */
function shaftMesh(p: Parameters) {
  const v = ballScrewLayout(p),
    turns = ((v.end - v.start) / v.lead) * n(p, 'starts'),
    around = turns > 100 ? 32 : 48,
    layers = Math.max(8, Math.ceil(turns * (turns > 100 ? 16 : 24))),
    points: number[] = [],
    indices: number[] = [];
  for (let j = 0; j <= layers; j++) {
    const z = v.start + ((v.end - v.start) * j) / layers;
    for (let i = 0; i < around; i++) {
      const angle = (i * 2 * Math.PI) / around,
        radius = grooveRadius(p, z, angle, false);
      points.push(radius * Math.cos(angle), radius * Math.sin(angle), z);
      if (j < layers) {
        const a = j * around + i,
          b = j * around + ((i + 1) % around);
        indices.push(a, b, a + around, b, b + around, a + around);
      }
    }
  }
  for (const [j, reverse] of [
    [0, true],
    [layers, false],
  ] as const) {
    const outline = Array.from(
      { length: around },
      (_, i) => new Vector2(points[(j * around + i) * 3], points[(j * around + i) * 3 + 1]),
    );
    for (const triangle of ShapeUtils.triangulateShape(outline, []))
      indices.push(...(reverse ? [...triangle].reverse() : triangle).map((i) => j * around + i));
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const result = new Mesh(geometry, material());
  result.name = 'Helical screw raceway';
  return result;
}

const cyl = (radius: number, height: number, z = 0) =>
  primitives.cylinder({ radius, height, center: [0, 0, z], segments: 64 });
function mountAngles(count: number, family: string): number[] {
  if (count === 4) return [60, 120, 240, 300].map((a) => (a * Math.PI) / 180);
  if (count === 6 && ['SFI', 'DFI'].includes(family))
    return [0, 60, 120, 180, 240, 300].map((a) => (a * Math.PI) / 180);
  if (count === 6) return [45, 90, 135, 225, 270, 315].map((a) => (a * Math.PI) / 180);
  if (count === 8) return [45, 75, 105, 135, 225, 255, 285, 315].map((a) => (a * Math.PI) / 180);
  return Array.from({ length: count }, (_, i) => ((45 + (i * 360) / count) * Math.PI) / 180);
}
function bodyRanges(p: Parameters): [number, number][] {
  const v = ballScrewLayout(p),
    gap = Math.min(v.nl * 0.06, v.br * 2);
  return v.double
    ? [
        [-v.nl / 2, -gap / 2],
        [gap / 2, v.nl / 2],
      ]
    : [[-v.nl / 2, v.nl / 2]];
}
function outerBody(p: Parameters, cutaway: boolean, low: number, high: number, flange: boolean) {
  const v = ballScrewLayout(p),
    R = n(p, 'nutDiameter') / 2,
    fR = n(p, 'flangeDiameter') / 2,
    t = n(p, 'flangeThickness'),
    width = n(p, 'flangeWidth'),
    offset = n(p, 'flangeOffset');
  let body = cyl(R, high - low, (high + low) / 2);
  if (flange)
    body = booleans.union(
      body,
      booleans.intersect(
        cyl(fR, t, low + offset + t / 2),
        primitives.cuboid({ size: [width, fR * 2 + 2, t], center: [0, 0, low + offset + t / 2] }),
      ),
    );
  body = booleans.subtract(
    body,
    cyl(v.detail ? v.core : v.inner, high - low + 2, (high + low) / 2),
  );
  if (flange)
    for (const a of mountAngles(n(p, 'mountHoleCount'), String(p.family)))
      body = booleans.subtract(
        body,
        transforms.translate(
          [(n(p, 'mountCircle') / 2) * Math.cos(a), (n(p, 'mountCircle') / 2) * Math.sin(a), 0],
          cyl(n(p, 'mountHoleDiameter') / 2, t + 2, low + offset + t / 2),
        ),
      );
  if (flange && n(p, 'mountCounterboreDiameter') > 0 && n(p, 'mountCounterboreDepth') > 0)
    for (const a of mountAngles(n(p, 'mountHoleCount'), String(p.family)))
      body = booleans.subtract(
        body,
        transforms.translate(
          [(n(p, 'mountCircle') / 2) * Math.cos(a), (n(p, 'mountCircle') / 2) * Math.sin(a), 0],
          cyl(
            n(p, 'mountCounterboreDiameter') / 2,
            n(p, 'mountCounterboreDepth') + 0.1,
            low + offset + n(p, 'mountCounterboreDepth') / 2 - 0.05,
          ),
        ),
      );
  const oil = n(p, 'oilHoleDiameter');
  if (oil > 0) {
    const depth = Math.max(0.1, (R - v.core) * 0.6),
      z = high - Math.min((high - low) * 0.28, oil);
    body = booleans.subtract(
      body,
      transforms.translate(
        [0, -R + depth / 2 - 0.1, z],
        transforms.rotateX(Math.PI / 2, cyl(oil / 2, depth + 0.2)),
      ),
    );
  }
  if (cutaway)
    body = booleans.intersect(
      body,
      primitives.cuboid({
        size: [4 * fR, 2 * fR, 2 * v.nl],
        center: [0, fR + inspectionPlane, 0],
      }),
    );
  const mesh = solidUnionMesh(body);
  // The solid conversion centers its mesh. Restore the original local CAD coordinates.
  const bounds = primitivesBounds(body);
  mesh.position.copy(bounds);
  mesh.name = 'Ball nut housing';
  return mesh;
}
function primitivesBounds(solid: ReturnType<typeof cyl>) {
  // JSCAD polygon coordinates preserve the CAD origin before solidUnionMesh centers them.
  const values = (solid as unknown as { polygons: { vertices: number[][] }[] }).polygons.flatMap(
    (polygon) => polygon.vertices,
  );
  const bounds = new Box3().setFromPoints(
    values.map((p) => new Vector3(...(p as [number, number, number]))),
  );
  return bounds.getCenter(new Vector3());
}
function liner(p: Parameters, low: number, high: number, cutaway: boolean, center: number) {
  const v = ballScrewLayout(p),
    mesh = new BoundaryMesh(),
    count = cutaway ? 49 : 96,
    steps = Math.max(8, Math.ceil(((high - low) / v.lead) * 24 * n(p, 'starts')));
  const section = (z: number, outside: boolean) => {
    const radius = (angle: number) => (outside ? v.core : grooveRadius(p, z + center, angle, true));
    let first = 0,
      last = Math.PI;
    if (cutaway)
      for (let iteration = 0; iteration < 4; iteration++) {
        first = Math.asin(inspectionPlane / radius(first));
        last = Math.PI - Math.asin(inspectionPlane / radius(last));
      }
    return Array.from({ length: count }, (_, i) => {
      const a = cutaway ? first + ((last - first) * i) / (count - 1) : (2 * Math.PI * i) / count,
        r = radius(a);
      if (cutaway && (i === 0 || i === count - 1))
        return new Vector3(
          (i === 0 ? 1 : -1) * Math.sqrt(r * r - inspectionPlane * inspectionPlane),
          inspectionPlane,
          z,
        );
      return new Vector3(r * Math.cos(a), r * Math.sin(a), z);
    });
  };
  const bridge = (a: Vector3[], b: Vector3[], inward: boolean) => {
    if (!cutaway) mesh.bridge(a, b, inward);
    else
      for (let i = 1; i < a.length; i++) {
        for (const triangle of [
          [a[i - 1], a[i], b[i - 1]],
          [a[i], b[i], b[i - 1]],
        ]) {
          const normal = triangle[1]
            .clone()
            .sub(triangle[0])
            .cross(triangle[2].clone().sub(triangle[0]))
            .normalize()
            .multiplyScalar(inward ? -1 : 1);
          mesh.face(triangle, [], normal);
        }
      }
  };
  const outerLow = section(low, true),
    outerHigh = section(high, true);
  if (!cutaway) bridge(outerLow, outerHigh, false);
  for (let j = 0; j < steps; j++) {
    const z0 = low + ((high - low) * j) / steps,
      z1 = low + ((high - low) * (j + 1)) / steps,
      a = section(z0, false),
      b = section(z1, false);
    bridge(a, b, true);
    if (cutaway) bridge(section(z0, true), section(z1, true), false);
    if (cutaway)
      for (const i of [0, count - 1])
        mesh.face(
          [
            new Vector3(outerLow[i].x, inspectionPlane, z0),
            a[i],
            b[i],
            new Vector3(outerLow[i].x, inspectionPlane, z1),
          ],
          [],
          new Vector3(0, -1, 0),
        );
  }
  for (const [z, outer, sign] of [
    [low, outerLow, -1],
    [high, outerHigh, 1],
  ] as const) {
    const inner = section(z, false);
    mesh.face(
      cutaway ? [...outer, ...inner.reverse()] : outer,
      cutaway ? [] : [inner],
      new Vector3(0, 0, sign),
    );
  }
  const result = mesh.build();
  result.name = 'Internal helical raceway';
  return result;
}

export function ballScrewBalls(p: Parameters, center: number): Vector3[] {
  const v = ballScrewLayout(p),
    result: Vector3[] = [];
  for (const [low, high] of bodyRanges(p)) {
    const active = Math.min(
        high - low - 3 * v.br,
        (n(p, 'circuits') * n(p, 'circuitTurns') * v.lead) / (v.double ? 2 : 1),
      ),
      turns = active / v.lead,
      count = Math.max(
        3,
        Math.min(
          400,
          Math.floor(Math.hypot(2 * Math.PI * v.track * turns, active) / (v.br * 2.15)),
        ),
      );
    for (let start = 0; start < n(p, 'starts'); start++)
      for (let i = 0; i < count; i++) {
        const z = (low + high) / 2 + active * (i / Math.max(1, count - 1) - 0.5),
          a =
            v.phase +
            (v.hand * 2 * Math.PI * (z + center)) / v.lead +
            (start * 2 * Math.PI) / n(p, 'starts');
        result.push(new Vector3(v.track * Math.cos(a), v.track * Math.sin(a), z));
      }
  }
  return result;
}
function returnRegion(p: Parameters, low: number, high: number) {
  const v = ballScrewLayout(p),
    first = Math.abs(low + v.nl / 2) < 1e-7;
  const start = first
    ? low + n(p, 'flangeOffset') + n(p, 'flangeThickness') + v.br * 0.8
    : low + v.br * 0.8;
  return { start, end: high - v.br * 0.8 };
}
function nutGeometry(p: Parameters, cutaway: boolean, center: number) {
  const v = ballScrewLayout(p),
    g = new Group();
  for (const [index, [low, high]] of bodyRanges(p).entries()) {
    g.add(outerBody(p, cutaway, low, high, index === 0));
    if (v.detail) g.add(liner(p, low + v.br * 0.3, high - v.br * 0.3, cutaway, center));
  }
  if (v.double) {
    const gap = bodyRanges(p)[1][0] * 2,
      spacer = ring(n(p, 'nutDiameter') / 2 - v.br * 0.1, v.core, gap * 0.9, 0x4d5560);
    spacer.name = 'Double nut preload spacer';
    g.add(spacer);
  }
  for (const [low, high] of bodyRanges(p)) {
    const region = returnRegion(p, low, high);
    for (const side of [-1, 1]) {
      const cap = ring(v.core - v.br * 0.02, v.inner, v.br * 0.25, 0x26333c);
      cap.position.z = (side < 0 ? low : high) - side * v.br * 0.13;
      cap.name = v.endReturn ? 'End return cover' : 'End wiper';
      // Cutaway leaves the loaded ball train unobstructed at the front.
      if (!cutaway && v.detail) g.add(cap);
    }
    if (v.oblong) {
      const depth = v.br * 0.18,
        radius = v.br * 0.48,
        run = (region.end - region.start) * 0.28,
        z = (region.start + region.end) / 2;
      let cover = booleans.union(
        primitives.cuboid({ size: [radius * 2, depth, run], center: [0, 0, z] }),
        transforms.translate(
          [0, 0, z - run / 2],
          transforms.rotateX(Math.PI / 2, cyl(radius, depth)),
        ),
        transforms.translate(
          [0, 0, z + run / 2],
          transforms.rotateX(Math.PI / 2, cyl(radius, depth)),
        ),
      );
      cover = transforms.translate(
        [0, n(p, 'nutDiameter') / 2 + depth / 2 + v.br * 0.01, 0],
        cover,
      );
      const mesh = solidUnionMesh(cover);
      mesh.position.copy(primitivesBounds(booleans.union(cover, cover)));
      mesh.name = 'Internal return channel cover';
      g.add(mesh);
    } else {
      const buttons = v.endReturn ? 2 : Math.min(4, n(p, 'circuits'));
      for (let i = 0; i < buttons; i++) {
        const cap = cylinder(v.br * 0.65, v.br * 0.18, v.endReturn ? 0x34424e : 0x5e6873);
        cap.rotation.x = Math.PI / 2;
        cap.position.set(
          0,
          n(p, 'nutDiameter') / 2 + v.br * 0.1,
          region.start + ((i + 1) * (region.end - region.start)) / (buttons + 1),
        );
        cap.name = v.endReturn ? 'Return bridge cover' : 'Internal deflector plug';
        g.add(cap);
      }
    }
  }
  if (v.detail)
    for (const point of ballScrewBalls(p, center)) {
      const ball = sphere(v.br, 0xb8c0c9);
      ball.position.copy(point);
      ball.name = 'Loaded raceway ball';
      g.add(ball);
    }
  g.position.z = center;
  return g;
}

const lastBounds = new WeakMap<
  Parameters,
  { signature: string; states: Map<string, [number, number, number]> }
>();

export function ballScrewGeometry(p: Parameters, state: string, nutOnly = false): Group {
  const v = ballScrewLayout(p),
    group = new Group(),
    showScrew = !nutOnly && state !== 'nut',
    center = nutOnly || state === 'nut' ? 0 : v.center;
  if (showScrew) {
    const shaft = v.detail ? shaftMesh(p) : cylinder(v.r, v.end - v.start);
    if (!v.detail) shaft.position.z = (v.start + v.end) / 2;
    group.add(shaft);
    if (v.machined)
      for (const [key, length, z] of [
        [
          'driveJournalDiameter',
          n(p, 'driveJournalLength'),
          -v.length / 2 + n(p, 'driveJournalLength') / 2,
        ],
        [
          'fixedJournalDiameter',
          n(p, 'fixedJournalLength'),
          v.start - n(p, 'fixedJournalLength') / 2,
        ],
        [
          'supportJournalDiameter',
          n(p, 'supportJournalLength'),
          v.end + n(p, 'supportJournalLength') / 2,
        ],
      ] as const) {
        const journal = cylinder(n(p, key) / 2, length);
        journal.position.z = z;
        journal.name = key === 'driveJournalDiameter' ? 'Drive journal' : 'Bearing journal';
        group.add(journal);
      }
  }
  if (nutOnly || state !== 'screw') group.add(nutGeometry(p, state === 'cutaway', center));
  const bounds = new Box3().setFromObject(group, true).getSize(new Vector3()).toArray() as [
    number,
    number,
    number,
  ];
  const signature = JSON.stringify(p),
    previous = lastBounds.get(p);
  const cached =
    previous?.signature === signature
      ? previous
      : { signature, states: new Map<string, [number, number, number]>() };
  cached.states.set(`${state}:${nutOnly}`, bounds);
  lastBounds.set(p, cached);
  return group;
}

export function ballScrewDimensions(
  p: Parameters,
  state: string,
  nutOnly = false,
): [number, number, number] {
  const previous = lastBounds.get(p),
    cached =
      previous?.signature === JSON.stringify(p)
        ? previous.states.get(`${state}:${nutOnly}`)
        : undefined;
  if (cached) return cached;
  const group = ballScrewGeometry(p, state, nutOnly);
  try {
    return new Box3().setFromObject(group, true).getSize(new Vector3()).toArray() as [
      number,
      number,
      number,
    ];
  } finally {
    disposeModel(group);
  }
}

export function validateBallScrew(p: Parameters, nutOnly = false): string[] {
  const v = ballScrewLayout(p),
    errors: string[] = [],
    R = n(p, 'nutDiameter') / 2;
  if (!Number.isInteger(n(p, 'starts')) || !Number.isInteger(n(p, 'circuits')))
    errors.push('Helix starts and circuit count must be whole numbers.');
  if (
    (v.br * 2.12 * Math.hypot(v.track, v.lead / (2 * Math.PI))) / v.track >=
    v.lead / n(p, 'starts')
  )
    errors.push(
      'Ball diameter must be less than 94% of the axial groove pitch (lead divided by starts) to separate adjacent raceways.',
    );
  if (v.r - v.br * 0.71 <= 0.15)
    errors.push('Increase the shaft diameter to retain a solid screw core.');
  if (R <= v.core + 0.15) errors.push('Nut diameter must leave a wall outside the ball raceway.');
  if (n(p, 'flangeDiameter') < n(p, 'nutDiameter') || n(p, 'flangeWidth') < n(p, 'nutDiameter'))
    errors.push('The flange must enclose the cylindrical nut body.');
  if (n(p, 'flangeOffset') + n(p, 'flangeThickness') >= v.nl * (v.double ? 0.45 : 0.95))
    errors.push('Nut length must exceed its flange thickness.');
  if (n(p, 'mountCircle') / 2 - n(p, 'mountHoleDiameter') / 2 <= R)
    errors.push('Mounting holes must clear the nut body.');
  const holeRadius = Math.max(n(p, 'mountHoleDiameter'), n(p, 'mountCounterboreDiameter')) / 2;
  if (n(p, 'mountCounterboreDiameter') > 0 !== n(p, 'mountCounterboreDepth') > 0)
    errors.push('Specify both counterbore diameter and depth, or set both to zero.');
  if (
    n(p, 'mountCounterboreDiameter') > 0 &&
    (n(p, 'mountCounterboreDiameter') < n(p, 'mountHoleDiameter') ||
      n(p, 'mountCounterboreDepth') > n(p, 'flangeThickness'))
  )
    errors.push(
      'Counterbores must be wider than the mounting holes and remain within the flange thickness.',
    );
  if (n(p, 'mountCircle') / 2 - holeRadius <= v.core)
    errors.push('Counterbores must leave material outside the nut raceway.');
  for (const a of mountAngles(n(p, 'mountHoleCount'), String(p.family))) {
    if (
      n(p, 'mountCircle') / 2 + holeRadius >= n(p, 'flangeDiameter') / 2 ||
      (Math.abs(Math.cos(a)) * n(p, 'mountCircle')) / 2 + holeRadius >= n(p, 'flangeWidth') / 2
    ) {
      errors.push('Mounting holes need clearance from the flange edge and flats.');
      break;
    }
  }
  if (n(p, 'oilHoleDiameter') > Math.min(R * 0.8, v.nl * 0.2))
    errors.push('Reduce the lubrication port diameter to fit the housing wall.');
  if (v.nl / (v.double ? 2 : 1) < v.br * 5)
    errors.push('Nut bodies must provide room for their ball train and end returns.');
  if (!nutOnly) {
    if (v.detail && ((v.end - v.start) / v.lead) * n(p, 'starts') > 1200)
      errors.push(
        'Detailed models support up to 1,200 groove turns. Shorten the shaft or select Envelope detail.',
      );
    if (v.end - v.start < v.nl + 2 * v.lead)
      errors.push('The threaded shaft must be longer than the nut plus two leads.');
    if (v.center - v.nl / 2 < v.start || v.center + v.nl / 2 > v.end)
      errors.push('The selected nut position and rotation move the nut beyond the raceway.');
    if (
      v.machined &&
      (n(p, 'fixedJournalDiameter') >= 2 * v.r ||
        n(p, 'supportJournalDiameter') >= 2 * v.r ||
        n(p, 'driveJournalDiameter') > n(p, 'fixedJournalDiameter'))
    )
      errors.push(
        'Machined journals must step down from the shaft; the drive journal cannot exceed the fixed journal.',
      );
  }
  return errors;
}

export function ballScrewPython(p: Parameters, state: string, nutOnly = false): string {
  const labels: string[] = [];
  const colors: number[][] = [];
  const label = (name: string, color = [0.62, 0.7, 0.78]) => {
    labels.push(name);
    colors.push(color);
  };
  const v = ballScrewLayout(p),
    center = nutOnly || state === 'nut' ? 0 : v.center,
    cutaway = state === 'cutaway',
    R = n(p, 'nutDiameter') / 2,
    fR = n(p, 'flangeDiameter') / 2,
    width = n(p, 'flangeWidth'),
    t = n(p, 'flangeThickness'),
    offset = n(p, 'flangeOffset'),
    lines = [
      'import math',
      '# Nominal raceway and return geometry for prototype layout; accuracy class is metadata.',
      'components = []',
      '# Move the periodic profile seam away from its intersection with the cylindrical bore.',
      `def groove_tool(low, high, phase):`,
      `    path = Part.Wire(Part.makeLongHelix(${num(v.lead)}, high-low+${num(2 * v.lead)}, ${num(v.track)}, 0, ${v.hand < 0 ? 'True' : 'False'}).Edges)`,
      `    profile = Part.Wire([Part.Ellipse(App.Vector(${num(v.track)},0,${num((v.cutter * Math.hypot(v.track, v.lead / (2 * Math.PI))) / v.track)}),App.Vector(${num(v.track + v.cutter)},0,0),App.Vector(${num(v.track)},0,0)).toShape(0.37,0.37+2*math.pi)])`,
      '    tool = path.makePipeShell([profile], True, True)',
      `    start = low-${num(v.lead)}`,
      `    tool.rotate(App.Vector(),App.Vector(0,0,1),phase+${num((v.hand * 360) / v.lead)}*start)`,
      '    tool.translate(App.Vector(0,0,start))',
      '    tools = []',
      `    for start_index in range(${n(p, 'starts')}):`,
      '        copy = tool.copy()',
      `        copy.rotate(App.Vector(),App.Vector(0,0,1),start_index*${num(360 / n(p, 'starts'))})`,
      '        tools.append(copy)',
      '    return Part.makeCompound(tools)',
      'def annulus(outer,inner,height,z):',
      '    return Part.makeCylinder(outer,height,App.Vector(0,0,z)).cut(Part.makeCylinder(inner,height+2,App.Vector(0,0,z-1)))',
    ];
  if (!nutOnly && state !== 'nut') {
    lines.push(
      `screw = Part.makeCylinder(${num(v.r)}, ${num(v.end - v.start)}, App.Vector(0,0,${num(v.start)}))`,
    );
    if (v.detail)
      lines.push(
        `screw = screw.cut(groove_tool(${num(v.start)},${num(v.end)},${num((v.phase * 180) / Math.PI)})).removeSplitter()`,
      );
    if (v.machined)
      for (const [key, length, z] of [
        ['driveJournalDiameter', n(p, 'driveJournalLength'), -v.length / 2],
        ['fixedJournalDiameter', n(p, 'fixedJournalLength'), v.start - n(p, 'fixedJournalLength')],
        ['supportJournalDiameter', n(p, 'supportJournalLength'), v.end],
      ] as const)
        lines.push(
          `screw = screw.fuse(Part.makeCylinder(${num(n(p, key) / 2)},${num(length)},App.Vector(0,0,${num(z)})))`,
        );
    lines.push('components.append(screw.removeSplitter())');
    label('Screw shaft');
  }
  if (nutOnly || state !== 'screw') {
    lines.push('nut_components = []');
    for (const [index, [low, high]] of bodyRanges(p).entries()) {
      const region = returnRegion(p, low, high);
      lines.push(
        `body = Part.makeCylinder(${num(R)},${num(high - low)},App.Vector(0,0,${num(low)}))`,
      );
      if (index === 0)
        lines.push(
          `flange = Part.makeCylinder(${num(fR)},${num(t)},App.Vector(0,0,${num(low + offset)})).common(Part.makeBox(${num(width)},${num(2 * fR + 2)},${num(t)},App.Vector(${num(-width / 2)},${num(-fR - 1)},${num(low + offset)})))`,
          'body = body.fuse(flange)',
        );
      lines.push(
        `body = body.cut(Part.makeCylinder(${num(v.inner)},${num(high - low + 2)},App.Vector(0,0,${num(low - 1)})))`,
      );
      if (v.detail)
        lines.push(
          `body = body.cut(groove_tool(${num(low)},${num(high)},${num(((v.phase + (v.hand * 2 * Math.PI * center) / v.lead) * 180) / Math.PI)}))`,
          `body = body.cut(Part.makeCylinder(${num(v.core)},${num(v.br * 0.3 + 0.1)},App.Vector(0,0,${num(low - 0.1)})))`,
          `body = body.cut(Part.makeCylinder(${num(v.core)},${num(v.br * 0.3 + 0.1)},App.Vector(0,0,${num(high - v.br * 0.3)})))`,
        );
      if (index === 0)
        for (const a of mountAngles(n(p, 'mountHoleCount'), String(p.family)))
          lines.push(
            `body = body.cut(Part.makeCylinder(${num(n(p, 'mountHoleDiameter') / 2)},${num(t + 2)},App.Vector(${num((n(p, 'mountCircle') / 2) * Math.cos(a))},${num((n(p, 'mountCircle') / 2) * Math.sin(a))},${num(low + offset - 1)})))`,
          );
      if (index === 0 && n(p, 'mountCounterboreDiameter') > 0 && n(p, 'mountCounterboreDepth') > 0)
        for (const a of mountAngles(n(p, 'mountHoleCount'), String(p.family)))
          lines.push(
            `body = body.cut(Part.makeCylinder(${num(n(p, 'mountCounterboreDiameter') / 2)},${num(n(p, 'mountCounterboreDepth') + 0.1)},App.Vector(${num((n(p, 'mountCircle') / 2) * Math.cos(a))},${num((n(p, 'mountCircle') / 2) * Math.sin(a))},${num(low + offset - 0.1)})))`,
          );
      const oil = n(p, 'oilHoleDiameter');
      if (oil > 0) {
        const depth = Math.max(0.1, (R - v.core) * 0.6),
          z = high - Math.min((high - low) * 0.28, oil);
        lines.push(
          `body = body.cut(Part.makeCylinder(${num(oil / 2)},${num(depth + 0.2)},App.Vector(0,${num(-R - 0.2)},${num(z)}),App.Vector(0,1,0)))`,
        );
      }
      if (cutaway)
        lines.push(
          '# Use a fixed one-micron inspection offset and Boolean tolerance at periodic faces.',
          `body = body.common(Part.makeBox(${num(4 * fR)},${num(2 * fR)},${num(2 * v.nl)},App.Vector(${num(-2 * fR)},${num(inspectionPlane)},${num(-v.nl)})),1e-5)`,
        );
      lines.push('nut_components.append(body.removeSplitter())');
      label(`Nut body ${index + 1}`);
      if (!cutaway && v.detail)
        for (const side of [-1, 1]) {
          lines.push(
            `nut_components.append(annulus(${num(v.core - v.br * 0.02)},${num(v.inner)},${num(v.br * 0.25)},${num((side < 0 ? low : high) - side * v.br * 0.13 - v.br * 0.125)}))`,
          );
          label(`Nut ${index + 1} ${side < 0 ? 'rear' : 'front'} seal`, [0.15, 0.18, 0.22]);
        }
      if (v.oblong) {
        const depth = v.br * 0.18,
          radius = v.br * 0.48,
          run = (region.end - region.start) * 0.28,
          z = (region.start + region.end) / 2,
          y = R + v.br * 0.01;
        lines.push(
          `cover = Part.makeBox(${num(radius * 2)},${num(depth)},${num(run)},App.Vector(${num(-radius)},${num(y)},${num(z - run / 2)}))`,
          `cover = cover.fuse(Part.makeCylinder(${num(radius)},${num(depth)},App.Vector(0,${num(y)},${num(z - run / 2)}),App.Vector(0,1,0)))`,
          `cover = cover.fuse(Part.makeCylinder(${num(radius)},${num(depth)},App.Vector(0,${num(y)},${num(z + run / 2)}),App.Vector(0,1,0)))`,
          'nut_components.append(cover.removeSplitter())',
        );
        label(`Nut ${index + 1} return cover`, [0.34, 0.39, 0.45]);
      } else {
        const count = v.endReturn ? 2 : Math.min(4, n(p, 'circuits'));
        for (let i = 0; i < count; i++) {
          lines.push(
            `nut_components.append(Part.makeCylinder(${num(v.br * 0.65)},${num(v.br * 0.18)},App.Vector(0,${num(R + v.br * 0.01)},${num(region.start + ((i + 1) * (region.end - region.start)) / (count + 1))}),App.Vector(0,1,0)))`,
          );
          label(`Nut ${index + 1} return cap ${i + 1}`, [0.34, 0.39, 0.45]);
        }
      }
    }
    if (v.double) {
      const gap = bodyRanges(p)[1][0] * 2;
      lines.push(
        `nut_components.append(annulus(${num(R - v.br * 0.1)},${num(v.core)},${num(gap * 0.9)},${num(-gap * 0.45)}))`,
      );
      label('Preload spacer');
    }
    if (v.detail)
      for (const [index, point] of ballScrewBalls(p, center).entries()) {
        lines.push(
          `nut_components.append(Part.makeSphere(${num(v.br)},App.Vector(${num(point.x)},${num(point.y)},${num(point.z)})))`,
        );
        label(`Raceway ball ${index + 1}`, [0.75, 0.78, 0.82]);
      }
    lines.push(
      'for component in nut_components:',
      `    component.translate(App.Vector(0,0,${num(center)}))`,
      'components.extend(nut_components)',
    );
  }
  lines.push(
    'for index, component in enumerate(components):',
    '    if len(component.Solids) != 1 or component.Volume <= 0 or not component.isValid() or not component.Solids[0].isClosed():',
    '        raise ValueError("Ball-screw component %d failed to produce one valid closed solid. Adjust the geometry parameters." % (index + 1))',
    'shape = Part.makeCompound(components)',
    `component_labels = ${JSON.stringify(labels)}`,
    `component_colors = ${JSON.stringify(colors)}`,
  );
  return lines.join('\n');
}
