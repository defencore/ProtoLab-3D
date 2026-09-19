import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { material, n, num } from '../../../../core/geometry';
import type { Parameters } from '../../../../core/types';
type RadialRing = { z: number; radius: number | ((angle: number) => number) };
const TAU = 2 * Math.PI;
const THREAD_DEPTH = (17 * Math.sqrt(3)) / 48;
const THREAD_HALF_BASE = 5 / 12;
const THREAD_HALF_CREST = 1 / 16;
export function fastenerValues(p: Parameters, headless = false) {
  const h = headless ? 0 : n(p, 'headHeight');
  const countersunk = !headless && ['countersunk', 'countersunk-square'].includes(String(p.head));
  const shaftLength = n(p, 'length') - (countersunk ? h : 0);
  const squareNeck =
    !headless && ['carriage', 'countersunk-square', 'elevator'].includes(String(p.head));
  const neckHeight = squareNeck ? n(p, 'neckHeight') : 0;
  const r = n(p, 'diameter') / 2;
  const smoothR = n(p, 'shankDiameter') / 2;
  const pitch = n(p, 'pitch');
  const modeled = p.threadMode === 'modeled';
  const threaded = p.threadMode !== 'none';
  const start = p.threadSpan === 'full' ? 0 : n(p, 'threadStart');
  const threadLength = p.threadSpan === 'full' ? shaftLength - neckHeight : n(p, 'threadLength');
  const end = start + threadLength;
  const rootR = modeled ? r - THREAD_DEPTH * pitch : r;
  const total = shaftLength + h;
  const bodyR = threaded && p.threadSpan === 'full' ? r : smoothR;
  return {
    h,
    countersunk,
    squareNeck,
    neckHeight,
    shaftLength,
    r,
    smoothR,
    pitch,
    modeled,
    threaded,
    start,
    end,
    threadLength,
    rootR,
    total,
    bodyR,
  };
}

function polygonRadius(apothem: number, sides: number, a: number): number {
  const local =
    ((((a + Math.PI / sides) % (TAU / sides)) + TAU / sides) % (TAU / sides)) - Math.PI / sides;
  return apothem / Math.cos(local);
}

function drivePolygon(p: Parameters): THREE.Vector2[] | undefined {
  const w = n(p, 'driveWidth') / 2;
  const t = n(p, 'driveThickness') / 2;
  if (p.drive === 'slot')
    return [
      [w, t],
      [-w, t],
      [-w, -t],
      [w, -t],
    ].map(([x, y]) => new THREE.Vector2(x, y));
  if (p.drive === 'cross')
    return [
      [w, t],
      [t, t],
      [t, w],
      [-t, w],
      [-t, t],
      [-w, t],
      [-w, -t],
      [-t, -t],
      [-t, -w],
      [t, -w],
      [t, -t],
      [w, -t],
    ].map(([x, y]) => new THREE.Vector2(x, y));
  if (['hex', 'square', 'polygon'].includes(String(p.drive))) {
    const sides = p.drive === 'hex' ? 6 : p.drive === 'square' ? 4 : n(p, 'driveSides');
    return Array.from({ length: sides }, (_, i) => {
      const a = ((2 * i + 1) * Math.PI) / sides;
      return new THREE.Vector2(Math.cos(a), Math.sin(a)).multiplyScalar(
        w / Math.cos(Math.PI / sides),
      );
    });
  }
  return undefined;
}

export function driveRadius(p: Parameters, angle: number): number {
  const w = n(p, 'driveWidth') / 2;
  if (p.drive === 'star') return w * (0.82 + 0.18 * Math.cos(6 * angle));
  const polygon = drivePolygon(p);
  if (!polygon) return 0;
  const dx = Math.cos(angle),
    dy = Math.sin(angle);
  let distance = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length];
    const ex = b.x - a.x,
      ey = b.y - a.y;
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-12) continue;
    const alongRay = (a.x * ey - a.y * ex) / denom;
    const alongEdge = (a.x * dy - a.y * dx) / denom;
    if (alongRay >= 0 && alongEdge >= -1e-9 && alongEdge <= 1 + 1e-9)
      distance = Math.min(distance, alongRay);
  }
  return distance;
}

function headRings(p: Parameters, shaftLength: number): RadialRing[] {
  const size = n(p, 'headSize') / 2;
  const h = n(p, 'headHeight');
  const flanged = ['hex-flange', 'button-flange', 'pan-flange'].includes(String(p.head));
  const flangeHeight = flanged ? n(p, 'flangeThickness') : 0;
  const base = shaftLength + flangeHeight;
  const height = h - flangeHeight;
  const rings: RadialRing[] = flanged
    ? [
        { z: shaftLength, radius: n(p, 'flangeDiameter') / 2 },
        { z: base, radius: n(p, 'flangeDiameter') / 2 },
      ]
    : [];
  if (['hex', 'hex-flange', 'polygon'].includes(String(p.head))) {
    const sides = p.head === 'polygon' ? n(p, 'headSides') : 6;
    const radius = (a: number) => polygonRadius(size, sides, a);
    return [
      ...rings,
      { z: base, radius },
      ...Array.from({ length: 13 }, (_, index) => {
        const t = index / 12;
        const limit = (size / Math.cos(Math.PI / sides)) * (1 - t) + size * 0.98 * t;
        return {
          z: base + height * (0.8 + 0.2 * t),
          radius: (a: number) => Math.min(radius(a), limit),
        };
      }),
    ];
  }
  if (['countersunk', 'countersunk-square'].includes(String(p.head))) {
    const body = fastenerValues(p).bodyR;
    const coneHeight = Math.min(
      h,
      (size - body) / Math.tan((n(p, 'countersinkAngle') * Math.PI) / 360),
    );
    return [
      {
        z: shaftLength,
        radius: size - coneHeight * Math.tan((n(p, 'countersinkAngle') * Math.PI) / 360),
      },
      { z: shaftLength + coneHeight, radius: size },
      { z: shaftLength + h, radius: size },
    ];
  }
  if (p.head === 'socket-cap' || p.head === 'cheese' || p.head === 'elevator')
    return [
      { z: shaftLength, radius: size },
      { z: shaftLength + h, radius: size },
    ];
  const shoulder = p.head === 'pan' || p.head === 'pan-flange' ? 0.4 : 0.08;
  rings.push({ z: base, radius: size });
  for (let i = 0; i <= 24; i++) {
    const a = ((i / 24) * Math.PI) / 2;
    rings.push({
      z: base + height * (shoulder + (1 - shoulder) * Math.sin(a)),
      radius: size * (0.5 + 0.5 * Math.cos(a)),
    });
  }
  return rings;
}

function ringMesh(rings: RadialRing[], angles: number[]): THREE.BufferGeometry {
  const positions: number[] = [],
    indices: number[] = [];
  const ids: number[][] = [];
  for (const ring of rings) {
    const ringIds: number[] = [];
    if (typeof ring.radius === 'number' && ring.radius === 0) {
      ringIds.push(positions.length / 3);
      positions.push(0, 0, ring.z);
    } else {
      for (const a of angles) {
        const r = typeof ring.radius === 'number' ? ring.radius : ring.radius(a);
        ringIds.push(positions.length / 3);
        positions.push(r * Math.cos(a), r * Math.sin(a), ring.z);
      }
    }
    ids.push(ringIds);
  }
  const triangle = (a: number, b: number, c: number) => {
    const ax = positions[b * 3] - positions[a * 3],
      ay = positions[b * 3 + 1] - positions[a * 3 + 1],
      az = positions[b * 3 + 2] - positions[a * 3 + 2];
    const bx = positions[c * 3] - positions[a * 3],
      by = positions[c * 3 + 1] - positions[a * 3 + 1],
      bz = positions[c * 3 + 2] - positions[a * 3 + 2];
    if ((ay * bz - az * by) ** 2 + (az * bx - ax * bz) ** 2 + (ax * by - ay * bx) ** 2 > 1e-20)
      indices.push(a, b, c);
  };
  for (let j = 0; j < ids.length - 1; j++) {
    const lower = ids[j],
      upper = ids[j + 1];
    for (let i = 0; i < angles.length; i++) {
      const ni = (i + 1) % angles.length;
      if (lower.length === 1) triangle(lower[0], upper[ni], upper[i]);
      else if (upper.length === 1) triangle(lower[i], lower[ni], upper[0]);
      else {
        triangle(lower[i], lower[ni], upper[i]);
        triangle(lower[ni], upper[ni], upper[i]);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const smooth = toCreasedNormals(geometry, Math.PI / 5);
  geometry.dispose();
  return smooth;
}

export function buildFastenerGeometry(p: Parameters, headless = false): THREE.Group {
  const v = fastenerValues(p, headless);
  const tipLength = p.tip === 'flat' || p.tip === 'cup' ? 0 : n(p, 'tipLength');
  const tipR = n(p, 'tipDiameter') / 2;
  const angles = Array.from({ length: 48 }, (_, i) => (i * TAU) / 48);
  const drivePoints = drivePolygon(p);
  if (drivePoints) angles.push(...drivePoints.map((a) => (Math.atan2(a.y, a.x) + TAU) % TAU));
  if (!headless && ['hex', 'hex-flange', 'polygon'].includes(String(p.head))) {
    const sides = p.head === 'polygon' ? n(p, 'headSides') : 6;
    for (let i = 0; i < sides; i++) angles.push(((2 * i + 1) * Math.PI) / sides);
  }
  if (v.squareNeck) for (let i = 0; i < 4; i++) angles.push(((2 * i + 1) * Math.PI) / 4);
  angles.sort((a, b) => a - b);
  const uniqueAngles = angles.filter((angle, i) => i === 0 || angle - angles[i - 1] > 1e-8);
  const rawRadius = (z: number, a: number, region: 'thread' | 'smooth') => {
    if (region === 'smooth') return v.smoothR;
    if (!v.modeled) return v.r;
    const phase = (z - v.start) / v.pitch - ((p.handedness === 'left' ? -1 : 1) * a) / TAU;
    const distance = Math.abs(phase - Math.round(phase));
    const ridge = Math.max(
      0,
      Math.min(1, (THREAD_HALF_BASE - distance) / (THREAD_HALF_BASE - THREAD_HALF_CREST)),
    );
    return v.rootR + (v.r - v.rootR) * ridge;
  };
  const firstRegion = v.threaded && v.start === 0 ? 'thread' : 'smooth';
  const tipOuter = firstRegion === 'thread' ? v.r : v.smoothR;
  const clippedRadius = (
    z: number,
    a: number,
    region: 'thread' | 'smooth',
    dogShoulder = false,
  ) => {
    let result = rawRadius(z, a, region);
    if (tipLength > 0 && z <= tipLength && !dogShoulder) {
      const envelope = p.tip === 'dog' ? tipR : tipR + ((tipOuter - tipR) * z) / tipLength;
      result = Math.min(result, envelope);
    }
    return result;
  };
  const rings: RadialRing[] = [{ z: p.tip === 'cup' ? n(p, 'tipLength') : 0, radius: 0 }];
  if (p.tip === 'cup') rings.push({ z: 0, radius: tipR });
  const regions: { start: number; end: number; kind: 'thread' | 'smooth' }[] = [];
  if (!v.threaded) regions.push({ start: 0, end: v.shaftLength, kind: 'smooth' });
  else {
    if (v.start > 0) regions.push({ start: 0, end: v.start, kind: 'smooth' });
    regions.push({ start: v.start, end: v.end, kind: 'thread' });
    if (v.end < v.shaftLength) regions.push({ start: v.end, end: v.shaftLength, kind: 'smooth' });
  }
  for (const region of regions) {
    const count =
      v.modeled && region.kind === 'thread'
        ? Math.max(2, Math.ceil(((region.end - region.start) / v.pitch) * 8))
        : 1;
    const heights = Array.from(
      { length: count + 1 },
      (_, i) => region.start + ((region.end - region.start) * i) / count,
    );
    if (tipLength > region.start && tipLength < region.end) heights.push(tipLength);
    heights.sort((a, b) => a - b);
    for (const z of heights.filter((z, i) => i === 0 || z - heights[i - 1] > 1e-8)) {
      if (z === 0 && tipLength > 0 && tipR === 0) continue;
      rings.push({ z, radius: (a) => clippedRadius(z, a, region.kind) });
      if (p.tip === 'dog' && Math.abs(z - tipLength) < 1e-8)
        rings.push({ z, radius: (a) => clippedRadius(z, a, region.kind, true) });
    }
  }
  if (v.squareNeck) {
    const neckStart = v.shaftLength - v.neckHeight;
    while (rings.at(-1)!.z > neckStart + 1e-8) rings.pop();
    const radius = (a: number) => polygonRadius(n(p, 'neckSize') / 2, 4, a);
    rings.push(
      { z: neckStart, radius: v.smoothR },
      { z: neckStart, radius },
      { z: v.shaftLength, radius },
    );
  }
  if (!headless) rings.push(...headRings(p, v.shaftLength));
  if (p.drive !== 'none') {
    const radius = (a: number) => driveRadius(p, a);
    rings.push({ z: v.total, radius }, { z: v.total - n(p, 'driveDepth'), radius });
    rings.push({ z: v.total - n(p, 'driveDepth'), radius: 0 });
  } else rings.push({ z: v.total, radius: 0 });
  // Remove coincident rings so tangent head/body boundaries do not add zero-area faces.
  const noncoincident = rings.filter(
    (ring, i) =>
      i === 0 ||
      ring.z !== rings[i - 1].z ||
      uniqueAngles.some((a) => {
        const previous = rings[i - 1].radius;
        return (
          Math.abs(
            (typeof ring.radius === 'number' ? ring.radius : ring.radius(a)) -
              (typeof previous === 'number' ? previous : previous(a)),
          ) > 1e-8
        );
      }),
  );
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(ringMesh(noncoincident, uniqueAngles), material());
  mesh.position.z = -v.total / 2;
  group.add(mesh);
  return group;
}

export function fastenerPython(p: Parameters, headless = false): string {
  const v = fastenerValues(p, headless);
  const lines = [
    `# Length is measured from the point; the result is centered on its total height.`,
    `radius = ${num(v.r)}`,
    `root_radius = ${v.modeled ? `radius - (17 * math.sqrt(3) / 48) * ${num(v.pitch)}` : 'radius'}`,
    `body_length = ${num(v.shaftLength)}`,
  ];
  if (!v.threaded) lines.push(`shape = Part.makeCylinder(${num(v.smoothR)}, body_length)`);
  else {
    lines.push('shape = Part.makeCylinder(radius, body_length)');
    if (v.start > 0)
      lines.push(`shape = shape.fuse(Part.makeCylinder(${num(v.smoothR)}, ${num(v.start)}))`);
    if (v.end < v.shaftLength)
      lines.push(
        `shape = shape.fuse(Part.makeCylinder(${num(v.smoothR)}, ${num(v.shaftLength - v.end)}, App.Vector(0, 0, ${num(v.end)})))`,
      );
  }
  if (p.tip !== 'flat' && p.tip !== 'cup') {
    const c = n(p, 'tipLength'),
      rt = n(p, 'tipDiameter') / 2;
    const outer = v.threaded && v.start === 0 ? v.r : v.smoothR;
    lines.push(
      p.tip === 'dog'
        ? `point_envelope = Part.makeCylinder(${num(rt)}, ${num(c)})`
        : `point_envelope = Part.makeCone(${num(rt)}, ${num(outer)}, ${num(c)})`,
    );
    lines.push(
      `point_envelope = point_envelope.fuse(Part.makeCylinder(${num(Math.max(v.r, v.smoothR) + 0.1)}, ${num(v.shaftLength - c)}, App.Vector(0, 0, ${num(c)})))`,
      'shape = shape.common(point_envelope)',
    );
  }
  if (p.tip === 'cup')
    lines.push(
      `shape = shape.cut(Part.makeCone(${num(n(p, 'tipDiameter') / 2)}, 0, ${num(n(p, 'tipLength'))}))`,
    );
  if (v.modeled) {
    lines.push(
      `pitch = ${num(v.pitch)}`,
      `# Cut a helical groove from a solid blank. The blank already includes its point.`,
      `blank = shape`,
      `# Separate helix edges keep long thread sweeps numerically stable.`,
      `path = Part.Wire(Part.makeLongHelix(pitch, ${num(v.threadLength + 2 * v.pitch)}, root_radius, 0, ${p.handedness === 'left' ? 'True' : 'False'}).Edges)`,
      `groove_half_width = (7 / 16 + 0.08 / math.sqrt(3)) * pitch`,
      `groove_points = [App.Vector(root_radius, 0, -pitch / 12), App.Vector(radius + 0.08 * pitch, 0, -groove_half_width), App.Vector(radius + 0.08 * pitch, 0, groove_half_width), App.Vector(root_radius, 0, pitch / 12)]`,
      `groove = path.makePipeShell([Part.makePolygon(groove_points + [groove_points[0]])], True, True)`,
      `groove.translate(App.Vector(0, 0, ${num(v.start - v.pitch / 2)}))`,
      `shape = shape.cut(groove)`,
    );
    if (v.start > 0)
      lines.push(
        `lower_shoulder = blank.common(Part.makeCylinder(${num(v.bodyR + 0.1)}, ${num(v.start)}))`,
        `shape = shape.fuse(lower_shoulder)`,
      );
    if (v.end < v.shaftLength)
      lines.push(
        `upper_shoulder = blank.common(Part.makeCylinder(${num(v.bodyR + 0.1)}, ${num(v.shaftLength - v.end)}, App.Vector(0, 0, ${num(v.end)})))`,
        `shape = shape.fuse(upper_shoulder)`,
      );
  }
  if (v.squareNeck) {
    const neck = n(p, 'neckSize');
    lines.push(
      `shape = shape.fuse(Part.makeBox(${num(neck)}, ${num(neck)}, ${num(v.neckHeight)}, App.Vector(${num(-neck / 2)}, ${num(-neck / 2)}, ${num(v.shaftLength - v.neckHeight)})))`,
    );
  }
  if (!headless) {
    const rings = headRings(p, v.shaftLength);
    if (['hex', 'hex-flange', 'polygon'].includes(String(p.head))) {
      const sides = p.head === 'polygon' ? n(p, 'headSides') : 6;
      const size = n(p, 'headSize') / 2;
      const flange = p.head === 'hex-flange' ? n(p, 'flangeThickness') : 0;
      const base = v.shaftLength + flange;
      const height = v.h - flange;
      lines.push(
        `head_points = [App.Vector(${num(size / Math.cos(Math.PI / sides))} * math.cos((2 * i + 1) * math.pi / ${sides}), ${num(size / Math.cos(Math.PI / sides))} * math.sin((2 * i + 1) * math.pi / ${sides}), ${num(base)}) for i in range(${sides})]`,
        `head = Part.Face(Part.makePolygon(head_points + [head_points[0]])).extrude(App.Vector(0, 0, ${num(height)}))`,
        `head_cap = Part.makeCylinder(${num(size / Math.cos(Math.PI / sides))}, ${num(height * 0.8)}, App.Vector(0, 0, ${num(base)})).fuse(Part.makeCone(${num(size / Math.cos(Math.PI / sides))}, ${num(size * 0.98)}, ${num(height * 0.2)}, App.Vector(0, 0, ${num(base + height * 0.8)})))`,
        `head = head.common(head_cap)`,
      );
      if (flange)
        lines.push(
          `head = head.fuse(Part.makeCylinder(${num(n(p, 'flangeDiameter') / 2)}, ${num(flange)}, App.Vector(0, 0, body_length)))`,
        );
    } else {
      const points = [
        [0, v.shaftLength],
        ...rings.map((ring) => [ring.radius as number, ring.z]),
        [0, v.total],
      ];
      lines.push(
        `head_profile = [${points.map(([r, z]) => `App.Vector(${num(r)}, 0, ${num(z)})`).join(', ')}]`,
        `head = Part.Face(Part.makePolygon(head_profile + [head_profile[0]])).revolve(App.Vector(0, 0, 0), App.Vector(0, 0, 1), 360)`,
      );
    }
    lines.push('shape = shape.fuse(head)');
  }
  if (p.drive !== 'none') {
    const polygon =
      drivePolygon(p) ??
      Array.from({ length: 120 }, (_, i) => {
        const a = (i * TAU) / 120;
        return new THREE.Vector2(Math.cos(a), Math.sin(a)).multiplyScalar(driveRadius(p, a));
      });
    lines.push(
      `drive_points = [${polygon.map((a) => `App.Vector(${num(a.x)}, ${num(a.y)}, ${num(v.total - n(p, 'driveDepth'))})`).join(', ')}]`,
      `drive_tool = Part.Face(Part.makePolygon(drive_points + [drive_points[0]])).extrude(App.Vector(0, 0, ${num(n(p, 'driveDepth') + 0.1)}))`,
      'shape = shape.cut(drive_tool)',
    );
  }
  lines.push(
    'shape = shape.removeSplitter()',
    'if len(shape.Solids) != 1:',
    '    raise ValueError("The fastener must be one connected solid.")',
    `shape.translate(App.Vector(0, 0, ${num(-v.total / 2)}))`,
  );
  return lines.join('\n');
}
