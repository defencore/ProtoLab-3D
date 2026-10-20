import type { Parameters } from '../../../core/types';
import type { ManufacturingDefinition } from '../../../core/product-types';
import {
  box,
  cylinder,
  prism,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { frameRoles, type FrameRole } from '../configurator';

export interface FrameHole {
  axis: 'x' | 'y' | 'z';
  at: Vec;
  diameter: number;
  depth: number;
  threadPitch?: number;
  threadDesignation?: string;
  counterboreDiameter?: number;
  counterboreDepth?: number;
  slotLength?: number;
  slotAxis?: 'x' | 'y' | 'z';
}
export interface FrameReadheadEar {
  origin: Vec;
  size: Vec;
}
/** Authored stock on a readhead angle, never a cut or modification of supplier hardware. */
export function frameReadheadEar(p: Parameters): FrameReadheadEar | undefined {
  const raw: unknown = JSON.parse(String(p.readheadEar));
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new Error('Readhead ear stock must be an explicit dimension object.');
  if (!Object.keys(raw).length) return undefined;
  const value = raw as Record<string, unknown>;
  if (
    !['limit-angle', 'encoder-offset-angle'].includes(String(p.role)) ||
    Object.keys(value).length !== 2 ||
    !Object.keys(value).every((key) => ['origin', 'size'].includes(key)) ||
    !['origin', 'size'].every(
      (key) =>
        Array.isArray(value[key]) &&
        (value[key] as unknown[]).length === 3 &&
        (value[key] as unknown[]).every((n) => typeof n === 'number' && Number.isFinite(n)),
    ) ||
    (value.size as number[]).some((n) => n <= 0)
  )
    throw new Error(
      'Only readhead angles accept integral ear stock with finite origin and positive size.',
    );
  const ear = raw as FrameReadheadEar,
    base = frameShape({ ...p, readheadEar: '{}', holes: '[]' }),
    delta = 1e-5;
  const joined = [0.05, 0.5, 0.95].some((x) =>
    [0.05, 0.5, 0.95].some((y) =>
      [0.05, 0.5, 0.95].some((z) => {
        const point = ear.origin.map((n, i) => n + ear.size[i] * [x, y, z][i]) as Vec;
        return [0, 1, 2].every((axis) =>
          [-1, 1].every((sign) => {
            const probe = [...point] as Vec;
            probe[axis] += sign * delta;
            return stockContains(base, probe);
          }),
        );
      }),
    ),
  );
  if (!joined)
    throw new Error(
      'Integral readhead ear stock must positively overlap the existing angle blank.',
    );
  return ear;
}
export const hollowRoles = new Set<FrameRole>([
  'bed-member',
  'table-rib-tube',
  'corner-leg',
  'gantry-beam',
  'portal-post',
  'y-tiebar',
]);
/** Rounded declared stock section. Its actual ordered radii remain a drawing acceptance item. */
function roundedStock(size: Vec, axis: number, radius: number): Shape {
  const cross = [0, 1, 2].filter((i) => i !== axis),
    a = cross[0],
    b = cross[1],
    origin = size.map((n) => -n / 2) as Vec;
  if (radius === 0) return box(size, origin);
  const first = [...size] as Vec,
    second = [...size] as Vec;
  first[a] -= 2 * radius;
  second[b] -= 2 * radius;
  const firstAt = [...origin] as Vec,
    secondAt = [...origin] as Vec;
  firstAt[a] += radius;
  secondAt[b] += radius;
  const shapes: Shape[] = [box(first, firstAt), box(second, secondAt)];
  for (const sa of [-1, 1])
    for (const sb of [-1, 1]) {
      const at = [0, 0, 0] as Vec;
      at[axis] = origin[axis];
      at[a] = sa * (size[a] / 2 - radius);
      at[b] = sb * (size[b] / 2 - radius);
      shapes.push(cylinder(radius, size[axis], at, ['x', 'y', 'z'][axis] as 'x' | 'y' | 'z'));
    }
  return union(...shapes);
}
const boxedRoles = new Set(['z-fixed-box', 'z-moving-box']);
export interface CentralDrivePocket {
  axisY: number;
  shaftDiameter: number;
  nutDiameter: number;
  nutBottomZ: number;
  nutHeight: number;
  flangeDiameter: number;
  flangeBottomZ: number;
  flangeHeight: number;
  rearWidth: number;
  rearDepth: number;
  rearHeight: number;
  rootRadius: number;
}
export function centralDrivePocket(p: Parameters): CentralDrivePocket | undefined {
  const raw: unknown = JSON.parse(String(p.centralDrivePocket));
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new Error('Central-drive machining must be a validated dimension object.');
  if (!Object.keys(raw).length) return undefined;
  const keys = [
    'axisY',
    'shaftDiameter',
    'nutDiameter',
    'nutBottomZ',
    'nutHeight',
    'flangeDiameter',
    'flangeBottomZ',
    'flangeHeight',
    'rearWidth',
    'rearDepth',
    'rearHeight',
    'rootRadius',
  ];
  const r = raw as Record<string, unknown>;
  if (
    Object.keys(r).length !== keys.length ||
    Object.keys(r).some((key) => !keys.includes(key)) ||
    keys.some((key) => typeof r[key] !== 'number' || !Number.isFinite(r[key]))
  )
    throw new Error(
      'Central-drive pocket dimensions must have all explicit finite fields and no unrecognized features.',
    );
  const v = raw as CentralDrivePocket;
  if (
    p.role !== 'z-moving-box' ||
    keys
      .filter((key) => !['axisY', 'nutBottomZ', 'flangeBottomZ'].includes(key))
      .some((key) => Number(r[key]) <= 0) ||
    v.shaftDiameter >= v.nutDiameter ||
    v.nutDiameter >= v.flangeDiameter ||
    v.rearWidth >= +p.sizeX - 2 * +p.ribThickness ||
    v.rearDepth >= +p.sizeY - 2 ||
    v.rearHeight >= +p.sizeZ ||
    v.rootRadius >= Math.min(v.rearWidth, v.rearHeight) / 2 ||
    v.flangeDiameter >= 2 * (+p.ribCenterX - +p.ribThickness / 2) ||
    v.nutDiameter / 2 >= +p.bossWidth / 2 - Math.abs(+p.bossCenterX) ||
    v.axisY - v.nutDiameter / 2 <= +p.bossCenterY - +p.bossDepth / 2 ||
    v.axisY + v.nutDiameter / 2 >= +p.bossCenterY + +p.bossDepth / 2 ||
    v.axisY + v.nutDiameter / 2 >= +p.sizeY / 2 - 2 ||
    v.nutBottomZ < +p.bossCenterZ - +p.bossThickness / 2 ||
    v.nutBottomZ >= +p.bossCenterZ + +p.bossThickness / 2 ||
    v.nutBottomZ < -+p.sizeZ / 2 ||
    v.nutBottomZ + v.nutHeight > +p.sizeZ / 2 ||
    v.flangeBottomZ < -+p.sizeZ / 2 ||
    v.flangeBottomZ + v.flangeHeight > +p.sizeZ / 2
  )
    throw new Error(
      'The central rear pockets must retain a front skin, rib stock, positive nut-boss ligaments, a finite open channel and actual nut/flange machining span.',
    );
  return v;
}
export function frameHoles(p: Parameters): FrameHole[] {
  const holes: unknown = JSON.parse(String(p.holes));
  if (!Array.isArray(holes) || holes.length > 300)
    throw new Error('Use at most 300 local machining features.');
  for (const raw of holes) {
    const h = raw as FrameHole;
    if (
      !h ||
      typeof h !== 'object' ||
      Array.isArray(h) ||
      Object.keys(h).some(
        (k) =>
          ![
            'axis',
            'at',
            'diameter',
            'depth',
            'threadPitch',
            'threadDesignation',
            'counterboreDiameter',
            'counterboreDepth',
            'slotLength',
            'slotAxis',
          ].includes(k),
      ) ||
      !['x', 'y', 'z'].includes(h.axis) ||
      !Array.isArray(h.at) ||
      h.at.length !== 3 ||
      !h.at.every((n) => typeof n === 'number' && Number.isFinite(n)) ||
      !Number.isFinite(h.diameter) ||
      h.diameter <= 0 ||
      !Number.isFinite(h.depth) ||
      h.depth <= 0
    )
      throw new Error('Every machining feature needs a finite axis, position, diameter and depth.');
    if (
      h.threadPitch !== undefined &&
      (!Number.isFinite(h.threadPitch) ||
        h.threadPitch <= 0 ||
        typeof h.threadDesignation !== 'string' ||
        !h.threadDesignation.trim())
    )
      throw new Error('Tapped features need an explicit positive pitch and designation.');
    if (
      h.counterboreDiameter !== undefined &&
      (!Number.isFinite(h.counterboreDiameter) ||
        h.counterboreDiameter <= h.diameter ||
        !Number.isFinite(h.counterboreDepth) ||
        !h.counterboreDepth ||
        h.counterboreDepth >= h.depth)
    )
      throw new Error(
        'Counterbores must exceed the clearance bore and leave a bore below their seat.',
      );
    if (
      h.slotLength !== undefined &&
      (!Number.isFinite(h.slotLength) ||
        h.slotLength < h.diameter ||
        !h.slotAxis ||
        h.slotAxis === h.axis ||
        h.threadPitch !== undefined)
    )
      throw new Error('Slots need a perpendicular axis, a valid overall length and no thread.');
  }
  return holes as FrameHole[];
}
function holeShape(h: FrameHole, radialClearance: number): Shape {
  const bore: Shape = {
    ...cylinder(h.diameter / 2, h.depth, h.at, h.axis),
    ...(h.threadPitch
      ? {
          thread: {
            pitch: h.threadPitch,
            internal: true,
            designation: h.threadDesignation,
            radialClearance,
          },
        }
      : {}),
  };
  const parts: Shape[] = [bore];
  if (h.slotLength && h.slotAxis) {
    const direction = ['x', 'y', 'z'].indexOf(h.slotAxis),
      span = h.slotLength - h.diameter;
    const a = [...h.at] as Vec,
      b = [...h.at] as Vec;
    a[direction] -= span / 2;
    b[direction] += span / 2;
    const size: [number, number, number] = [h.diameter, h.diameter, h.diameter];
    size[['x', 'y', 'z'].indexOf(h.axis)] = h.depth;
    size[direction] = Math.max(span, 1e-4);
    const origin = h.at.map(
      (n, i) => n - (i === ['x', 'y', 'z'].indexOf(h.axis) ? 0 : size[i] / 2),
    ) as Vec;
    parts.splice(
      0,
      1,
      cylinder(h.diameter / 2, h.depth, a, h.axis),
      cylinder(h.diameter / 2, h.depth, b, h.axis),
      box(size, origin),
    );
  }
  if (h.counterboreDiameter && h.counterboreDepth) {
    const at = [...h.at] as Vec;
    at[['x', 'y', 'z'].indexOf(h.axis)] += h.depth - h.counterboreDepth;
    parts.push(cylinder(h.counterboreDiameter / 2, h.counterboreDepth, at, h.axis));
  }
  return parts.length === 1 ? parts[0] : union(...parts);
}
export function frameShape(p: Parameters): Shape {
  const size: [number, number, number] = [+p.sizeX, +p.sizeY, +p.sizeZ],
    origin = size.map((n) => -n / 2) as Vec;
  const role = String(p.role) as FrameRole;
  let body: Shape = box(size, origin);
  if (role === 'gantry-drive-link') {
    const stem = +p.ribDepth,
      top = +p.rearWebHeight,
      r = +p.internalFillet,
      shoulderZ = size[2] / 2 - top;
    const features: Shape[] = [
      box([size[0], stem, size[2]], [origin[0], -stem / 2, origin[2]]),
      box([size[0], size[1], top], [origin[0], origin[1], shoulderZ]),
    ];
    for (const sign of [-1, 1]) {
      const y = sign > 0 ? stem / 2 : -stem / 2 - r;
      features.push(
        subtract(
          box([size[0], r, r], [origin[0], y, shoulderZ - r]),
          cylinder(r, size[0] + 2, [origin[0] - 1, sign * (stem / 2 + r), shoulderZ - r], 'x'),
        ),
      );
    }
    body = union(...features);
  } else if (role === 'motor-retainer') {
    body = union(
      box([size[0], 6, size[2]], [-size[0] / 2, size[1] / 2 - 6, -size[2] / 2]),
      box([4, size[1], size[2]], origin),
      box([4, size[1], size[2]], [size[0] / 2 - 4, -size[1] / 2, -size[2] / 2]),
    );
  } else if (role === 'gantry-gusset') {
    body = prism(
      [
        [-size[0] / 2, -size[2] / 2],
        [size[0] / 2, -size[2] / 2],
        [size[0] / 2, size[2] / 2],
      ],
      size[1],
      -size[1] / 2,
      'y',
    );
  } else if (boxedRoles.has(role)) {
    const ribs: Shape[] = [body],
      r = Number(p.internalFillet);
    for (const side of [-1, 1]) {
      const edge = side * Number(p.ribCenterX) - Number(p.ribThickness) / 2;
      ribs.push(box([+p.ribThickness, +p.ribDepth, size[2]], [edge, size[1] / 2, origin[2]]));
      if (r > 0) {
        const inner = side * (+p.ribCenterX - +p.ribThickness / 2),
          at: Vec = [side > 0 ? inner - r : inner, size[1] / 2, origin[2]],
          center: Vec = [inner - side * r, size[1] / 2 + r, origin[2] - 1];
        ribs.push(subtract(box([r, r, size[2]], at), cylinder(r, size[2] + 2, center)));
      }
    }
    if (role === 'z-moving-box')
      ribs.push(
        box(
          [+p.bossWidth, +p.bossDepth, +p.bossThickness],
          [
            +p.bossCenterX - +p.bossWidth / 2,
            +p.bossCenterY - +p.bossDepth / 2,
            +p.bossCenterZ - +p.bossThickness / 2,
          ],
        ),
      );
    body = union(...ribs);
  } else if (role === 'section-insert') {
    body = roundedStock(size, ['x', 'y', 'z'].indexOf(String(p.tubeAxis)), +p.cornerRadius);
  } else if (hollowRoles.has(role)) {
    const axis = ['x', 'y', 'z'].indexOf(String(p.tubeAxis)),
      inner = size.map((n, i) => (i === axis ? n + 2 : n - 2 * +p.wall)) as Vec;
    body = subtract(
      roundedStock(size, axis, +p.cornerRadius),
      roundedStock(inner, axis, Math.max(0, +p.cornerRadius - +p.wall)),
    );
    if (role === 'gantry-beam' && +p.frontDatumTrim > 0)
      body = subtract(
        body,
        box(
          [size[0] + 2, +p.frontDatumTrim + 1, size[2]],
          [-size[0] / 2 - 1, size[1] / 2 - +p.frontDatumTrim, -size[2] / 2],
        ),
      );
  } else if (role === 'crush-sleeve') {
    body = subtract(
      cylinder(+p.sleeveDiameter / 2, +p.sizeZ, [0, 0, -+p.sizeZ / 2]),
      cylinder(+p.sleeveBore / 2, +p.sizeZ + 2, [0, 0, -+p.sizeZ / 2 - 1]),
    );
  } else if (role === 'rail-pad' && +p.shoulderHeight > 0) {
    body = union(
      body,
      box(
        [+p.shoulderWidth, +p.sizeY, +p.shoulderHeight],
        [-+p.sizeX / 2, -+p.sizeY / 2, +p.sizeZ / 2],
      ),
    );
  } else if (role === 'limit-bridge') {
    const t = +p.wall;
    body = union(
      box([size[0], size[1], t], origin),
      box([size[0], t, +p.rearWebHeight], origin),
      box([size[0], t, size[2]], [origin[0], size[1] / 2 - t, origin[2]]),
    );
  } else if (role === 'limit-angle') {
    const t = +p.wall;
    body = union(
      box([size[0], t, size[2]], origin),
      box([t, size[1], size[2]], [size[0] / 2 - t, origin[1], origin[2]]),
    );
  } else if (role === 'encoder-offset-angle') {
    const t = +p.wall,
      lower = +p.rearWebHeight,
      offset = +p.shoulderWidth,
      bridgeStart = lower - 1;
    body = union(
      box([lower, t, size[2]], [origin[0], origin[1] + offset, origin[2]]),
      box([t, offset + t, size[2]], [origin[0] + bridgeStart, origin[1], origin[2]]),
      box([size[0] - bridgeStart, t, size[2]], [origin[0] + bridgeStart, origin[1], origin[2]]),
      box([t, size[1], size[2]], [size[0] / 2 - t, origin[1], origin[2]]),
    );
  }
  const ear = frameReadheadEar(p);
  if (ear) body = union(body, box(ear.size, ear.origin));
  const drivePocket = centralDrivePocket(p);
  if (drivePocket) {
    const q = drivePocket;
    const pocket: Shape = {
      kind: 'transform',
      translation: [0, -size[1] / 2 + (q.rearDepth - 1) / 2, -size[2] / 2 + (q.rearHeight - 1) / 2],
      rotation: [0, 0, 0],
      child: roundedStock([q.rearWidth, q.rearDepth + 1, q.rearHeight + 1], 1, q.rootRadius),
    };
    body = subtract(
      body,
      pocket,
      cylinder(q.shaftDiameter / 2, size[2] + 2, [0, q.axisY, -size[2] / 2 - 1]),
      cylinder(q.nutDiameter / 2, q.nutHeight, [0, q.axisY, q.nutBottomZ]),
      cylinder(q.flangeDiameter / 2, q.flangeHeight, [0, q.axisY, q.flangeBottomZ]),
    );
  }
  if (+p.cornerReliefRadius > 0)
    body = subtract(
      body,
      cylinder(
        +p.cornerReliefRadius,
        size[0] + 2,
        [-size[0] / 2 - 1, size[1] / 2, size[2] / 2],
        'x',
      ),
    );
  const holes = frameHoles(p);
  return holes.length
    ? subtract(body, ...holes.map((h) => holeShape(h, Number(p.threadFitAllowance))))
    : body;
}

export interface FrameBounds {
  min: Vec;
  max: Vec;
}
type BoundWitness = { point: Vec; interior: Vec };
class UnprovedFrameBounds extends Error {}
const boundTolerance = 1e-9;

/** Candidate support points belong to actual convex stock, never to an enclosing proxy. */
function stockWitnesses(shape: Shape): BoundWitness[] {
  if (shape.kind === 'union') return shape.children.flatMap(stockWitnesses);
  if (shape.kind === 'subtract') return stockWitnesses(shape.children[0]);
  if (shape.kind === 'transform') {
    if (shape.rotation.some((angle) => angle !== 0)) throw new UnprovedFrameBounds();
    return stockWitnesses(shape.child).map(({ point, interior }) => ({
      point: point.map((n, i) => n + shape.translation[i]) as Vec,
      interior: interior.map((n, i) => n + shape.translation[i]) as Vec,
    }));
  }
  if (shape.kind === 'box') {
    const center = shape.origin.map((n, i) => n + shape.size[i] / 2) as Vec;
    return [0, 0.5, 1].flatMap((x) =>
      [0, 0.5, 1].flatMap((y) =>
        [0, 0.5, 1].map((z) => ({
          point: shape.origin.map((n, i) => n + shape.size[i] * [x, y, z][i]) as Vec,
          interior: center,
        })),
      ),
    );
  }
  if (shape.kind === 'cylinder') {
    if (shape.thread) throw new UnprovedFrameBounds();
    const axis = ['x', 'y', 'z'].indexOf(shape.axis),
      radial = [0, 1, 2].filter((i) => i !== axis),
      center = [...shape.origin] as Vec;
    center[axis] += shape.height / 2;
    // Cardinal points give exact circular supports. Extra directions only add witnesses.
    const circle: [number, number][] = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [Math.SQRT1_2, Math.SQRT1_2],
      [-Math.SQRT1_2, Math.SQRT1_2],
      [-Math.SQRT1_2, -Math.SQRT1_2],
      [Math.SQRT1_2, -Math.SQRT1_2],
    ];
    return [0, 0.5, 1].flatMap((t) =>
      circle.map(([a, b]) => {
        const point = [...shape.origin] as Vec;
        point[axis] += shape.height * t;
        point[radial[0]] += shape.radius * a;
        point[radial[1]] += shape.radius * b;
        return { point, interior: center };
      }),
    );
  }
  if (shape.kind === 'prism') {
    const axis = shape.axis === 'y' ? 1 : 2,
      plane = axis === 1 ? [0, 2] : [0, 1],
      center: Vec = [0, 0, 0];
    center[axis] = shape.origin + shape.depth / 2;
    for (const [i, coordinate] of plane.entries())
      center[coordinate] = shape.points.reduce((n, p) => n + p[i], 0) / shape.points.length;
    return [0, 0.5, 1].flatMap((t) =>
      shape.points.map((p) => {
        const point: Vec = [0, 0, 0];
        point[axis] = shape.origin + shape.depth * t;
        point[plane[0]] = p[0];
        point[plane[1]] = p[1];
        return { point, interior: center };
      }),
    );
  }
  throw new UnprovedFrameBounds();
}

/** Closed cutter envelopes deliberately remove at least as much as Full helical tools. */
function stockContains(shape: Shape, point: Vec): boolean {
  switch (shape.kind) {
    case 'box':
      return shape.origin.every(
        (n, i) => point[i] >= n - boundTolerance && point[i] <= n + shape.size[i] + boundTolerance,
      );
    case 'cylinder': {
      const axis = ['x', 'y', 'z'].indexOf(shape.axis),
        radial = [0, 1, 2].filter((i) => i !== axis),
        radius = shape.radius + (shape.thread?.radialClearance ?? 0);
      if (shape.thread && !shape.thread.internal) throw new UnprovedFrameBounds();
      return (
        point[axis] >= shape.origin[axis] - boundTolerance &&
        point[axis] <= shape.origin[axis] + shape.height + boundTolerance &&
        Math.hypot(...radial.map((i) => point[i] - shape.origin[i])) <= radius + boundTolerance
      );
    }
    case 'prism': {
      const axis = shape.axis === 'y' ? 1 : 2,
        plane = axis === 1 ? [0, 2] : [0, 1];
      if (
        point[axis] < shape.origin - boundTolerance ||
        point[axis] > shape.origin + shape.depth + boundTolerance
      )
        return false;
      // frameShape uses a convex triangular prism; unsupported concavity stays on CSG.
      for (let i = 0; i < shape.points.length; i++) {
        const a = shape.points[i],
          b = shape.points[(i + 1) % shape.points.length],
          c = shape.points[(i + 2) % shape.points.length];
        if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < -boundTolerance)
          throw new UnprovedFrameBounds();
      }
      for (let i = 0; i < shape.points.length; i++) {
        const a = shape.points[i],
          b = shape.points[(i + 1) % shape.points.length];
        if (
          (b[0] - a[0]) * (point[plane[1]] - a[1]) - (b[1] - a[1]) * (point[plane[0]] - a[0]) <
          -boundTolerance
        )
          return false;
      }
      return true;
    }
    case 'union':
      return shape.children.some((child) => stockContains(child, point));
    case 'subtract':
      return (
        stockContains(shape.children[0], point) &&
        shape.children.slice(1).every((child) => !stockContains(child, point))
      );
    case 'transform': {
      if (shape.rotation.some((angle) => angle !== 0)) throw new UnprovedFrameBounds();
      return stockContains(shape.child, point.map((n, i) => n - shape.translation[i]) as Vec);
    }
    default:
      throw new UnprovedFrameBounds();
  }
}

/** Exact outer bounds when all six extrema retain actual material witnesses.
 * Unproved custom cuts use the same canonical CSG mesh bounds, not stock dimensions. */
export function frameBounds(p: Parameters): FrameBounds | undefined {
  try {
    const trim = p.role === 'gantry-beam' ? +p.frontDatumTrim : 0,
      stock = frameShape(trim ? { ...p, frontDatumTrim: 0 } : p),
      candidates = stockWitnesses(stock),
      bounds: FrameBounds = {
        min: [0, 1, 2].map((i) => Math.min(...candidates.map(({ point }) => point[i]))) as Vec,
        max: [0, 1, 2].map((i) => Math.max(...candidates.map(({ point }) => point[i]))) as Vec,
      };
    // This one authored planar operation has an exact surviving limiting plane.
    if (trim) bounds.max[1] -= trim;
    if (bounds.min.some((n, i) => !Number.isFinite(n) || bounds.max[i] <= n)) return undefined;
    const witnesses = candidates
      .map(({ point, interior }) => {
        const at = [...point] as Vec,
          toward = [...interior] as Vec;
        if (trim) {
          at[1] = Math.min(at[1], bounds.max[1]);
          toward[1] = Math.min(toward[1], (bounds.min[1] + bounds.max[1]) / 2);
        }
        const inner = at.map((n, i) => n + 1e-7 * (toward[i] - n)) as Vec;
        return stockContains(stock, at) && stockContains(stock, inner) ? at : undefined;
      })
      .filter((point): point is Vec => !!point);
    return [0, 1, 2].every(
      (axis) =>
        witnesses.some((point) => Math.abs(point[axis] - bounds.min[axis]) <= boundTolerance) &&
        witnesses.some((point) => Math.abs(point[axis] - bounds.max[axis]) <= boundTolerance),
    )
      ? bounds
      : undefined;
  } catch (error) {
    if (error instanceof UnprovedFrameBounds) return undefined;
    throw error;
  }
}
export function frameDimensions(p: Parameters): Vec | undefined {
  const bounds = frameBounds(p);
  return bounds?.max.map((n, i) => n - bounds.min[i]) as Vec | undefined;
}
export function validateFrame(p: Parameters): string[] {
  try {
    if (!frameRoles.includes(String(p.role) as FrameRole))
      throw new Error('Choose a supported fabricated role.');
    if (!['steel', 'aluminium'].includes(String(p.material)))
      throw new Error('Choose a design material.');
    if (
      typeof p.threadFitAllowance !== 'number' ||
      !Number.isFinite(p.threadFitAllowance) ||
      p.threadFitAllowance < 0 ||
      p.threadFitAllowance > 0.1
    )
      throw new Error('Choose a finite radial inspection thread allowance from 0 to0.1 mm.');
    const size = [+p.sizeX, +p.sizeY, +p.sizeZ];
    if (size.some((n) => !Number.isFinite(n) || n < 2))
      throw new Error('Part dimensions must be finite and positive.');
    if (typeof p.stockGrade !== 'string' || !p.stockGrade.trim())
      throw new Error('Declare the stock material and certification requirement.');
    if (
      ![p.cornerRadius, p.frontDatumTrim, p.internalFillet].every(
        (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0,
      )
    )
      throw new Error('Stock radii and datum machining must be finite and nonnegative.');
    if (hollowRoles.has(String(p.role) as FrameRole)) {
      const axis = ['x', 'y', 'z'].indexOf(String(p.tubeAxis));
      if (
        axis < 0 ||
        !Number.isFinite(+p.wall) ||
        +p.wall < 1 ||
        size.some((n, i) => i !== axis && 2 * +p.wall >= n)
      )
        throw new Error('The hollow section must retain walls and an open bore.');
      if (
        +p.cornerRadius >= Math.min(...size.filter((_, i) => i !== axis)) / 2 ||
        (+p.cornerRadius > 0 && +p.cornerRadius < +p.wall)
      )
        throw new Error(
          'The declared stock radius must fit the section and retain an inner radius.',
        );
    }
    if (
      typeof p.cornerReliefRadius !== 'number' ||
      !Number.isFinite(p.cornerReliefRadius) ||
      p.cornerReliefRadius < 0 ||
      (p.cornerReliefRadius > 0 &&
        (p.role !== 'nut-bracket' || p.cornerReliefRadius >= Math.min(size[1], size[2]) / 2))
    )
      throw new Error(
        'A positive corner relief is allowed only on a nut bracket and must remain within both Y/Z half extents.',
      );
    if (p.role === 'section-insert') {
      const axis = ['x', 'y', 'z'].indexOf(String(p.tubeAxis));
      if (axis < 0 || +p.cornerRadius >= Math.min(...size.filter((_, i) => i !== axis)) / 2)
        throw new Error('The solid insert radius must fit its declared stock section.');
    }
    if (boxedRoles.has(String(p.role))) {
      if (
        ![p.ribThickness, p.ribDepth, p.ribCenterX].every(
          (n) => typeof n === 'number' && Number.isFinite(n) && n > 0,
        ) ||
        +p.ribCenterX + +p.ribThickness / 2 > size[0] / 2 ||
        +p.ribThickness >= size[0] / 2 ||
        +p.internalFillet >= Math.min(+p.ribDepth, +p.ribCenterX - +p.ribThickness / 2)
      )
        throw new Error('Integral ribs need finite stock, an open channel and a machinable root.');
      if (
        p.role === 'z-moving-box' &&
        (![p.bossWidth, p.bossDepth, p.bossThickness].every(
          (n) => typeof n === 'number' && Number.isFinite(n) && n > 0,
        ) ||
          ![p.bossCenterX, p.bossCenterY, p.bossCenterZ].every(
            (n) => typeof n === 'number' && Number.isFinite(n),
          ) ||
          Math.abs(+p.bossCenterZ) + +p.bossThickness / 2 > size[2] / 2 ||
          !(
            (+p.bossCenterX - +p.bossWidth / 2 < size[0] / 2 &&
              +p.bossCenterX + +p.bossWidth / 2 > -size[0] / 2 &&
              +p.bossCenterY - +p.bossDepth / 2 < size[1] / 2 &&
              +p.bossCenterY + +p.bossDepth / 2 > -size[1] / 2) ||
            (+p.bossCenterX - +p.bossWidth / 2 < +p.ribCenterX + +p.ribThickness / 2 &&
              +p.bossCenterX + +p.bossWidth / 2 > +p.ribCenterX - +p.ribThickness / 2 &&
              +p.bossCenterY - +p.bossDepth / 2 < size[1] / 2 + +p.ribDepth &&
              +p.bossCenterY + +p.bossDepth / 2 > size[1] / 2)
          ))
      )
        throw new Error(
          'The integral nut platform must join the actual web or rib with positive overlap and stay within the machined billet height.',
        );
    }
    if (p.role === 'rail-pad' && (+p.shoulderWidth >= +p.sizeX || +p.shoulderHeight < 0))
      throw new Error('The datum shoulder must leave a rail seat.');
    if (['limit-bridge', 'limit-angle'].includes(String(p.role))) {
      if (
        !Number.isFinite(+p.wall) ||
        +p.wall < 3 ||
        (p.role === 'limit-angle'
          ? size[0] <= +p.wall || size[1] <= +p.wall || size[2] < +p.wall
          : size.some((n) => n <= 2 * +p.wall))
      )
        throw new Error(
          'A sensor bracket needs at least 3 mm webs and an open installation space.',
        );
      if (
        p.role === 'limit-bridge' &&
        (!Number.isFinite(+p.rearWebHeight) ||
          +p.rearWebHeight < +p.wall ||
          +p.rearWebHeight > size[2])
      )
        throw new Error('The rear sensor web must meet the base and stay within the blank.');
    }
    if (p.role === 'encoder-offset-angle') {
      const t = +p.wall,
        lower = +p.rearWebHeight,
        offset = +p.shoulderWidth;
      if (
        ![t, lower, offset].every(Number.isFinite) ||
        t < 3 ||
        lower <= t ||
        lower + t >= size[0] ||
        offset < t ||
        offset + 2 * t >= size[1] ||
        size[2] <= t
      )
        throw new Error(
          'The encoder offset angle must retain connected lower, bridge, spine and upper webs inside one machinable blank.',
        );
    }
    if (
      p.role === 'gantry-drive-link' &&
      (![p.ribDepth, p.rearWebHeight, p.internalFillet].every(
        (n) => typeof n === 'number' && Number.isFinite(n) && n > 0,
      ) ||
        +p.ribDepth >= size[1] ||
        +p.rearWebHeight >= size[2] ||
        +p.internalFillet >= Math.min((size[1] - +p.ribDepth) / 2, size[2] - +p.rearWebHeight))
    )
      throw new Error(
        'The one-piece T link needs a narrower continuous stem, a positive top bar and machinable internal roots.',
      );
    if (p.role === 'crush-sleeve' && (+p.sleeveBore >= +p.sleeveDiameter || +p.sleeveBore <= 0))
      throw new Error('A crush sleeve needs a positive bore and a remaining wall.');
    for (const h of frameHoles(p)) {
      const axis = ['x', 'y', 'z'].indexOf(h.axis),
        radius = (h.counterboreDiameter ?? h.diameter) / 2;
      for (let i = 0; i < 3; i++)
        if (i !== axis) {
          const slot =
            i === ['x', 'y', 'z'].indexOf(h.slotAxis ?? '')
              ? (h.slotLength ?? h.diameter) / 2
              : radius;
          const lo =
              i === 1 && p.role === 'z-moving-box'
                ? Math.min(-size[i] / 2, +p.bossCenterY - +p.bossDepth / 2)
                : -size[i] / 2,
            hi =
              i === 1 && boxedRoles.has(String(p.role))
                ? size[i] / 2 + +p.ribDepth
                : i === 0 && p.role === 'z-moving-box'
                  ? Math.max(size[i] / 2, +p.bossCenterX + +p.bossWidth / 2)
                  : size[i] / 2;
          if (h.at[i] - slot < lo + 0.25 || h.at[i] + slot > hi - 0.25)
            throw new Error('Machining features must retain edge material.');
        }
      const hi =
        axis === 1 && boxedRoles.has(String(p.role))
          ? size[axis] / 2 + +p.ribDepth
          : axis === 0 && p.role === 'z-moving-box'
            ? Math.max(size[axis] / 2, +p.bossCenterX + +p.bossWidth / 2)
            : size[axis] / 2;
      if (h.at[axis] > hi || h.at[axis] + h.depth < -size[axis] / 2)
        throw new Error('Machining features must intersect the blank.');
    }
    centralDrivePocket(p);
    frameShape(p);
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}
export function frameManufacturing(p: Parameters): ManufacturingDefinition {
  const drivePocket = centralDrivePocket(p),
    ear = frameReadheadEar(p),
    earBounds = ear ? frameBounds({ ...p, holes: '[]' }) : undefined;
  if (ear && !earBounds)
    throw new Error('The readhead ear blank needs proved canonical outer dimensions.');
  const role = String(p.role),
    hollow = hollowRoles.has(role as FrameRole);
  return {
    material: String(p.stockGrade),
    blank: earBounds
      ? `Single machined billet ${earBounds.max.map((n, i) => Number((n - earBounds.min[i]).toFixed(6))).join(' x ')} mm including integral front ear; the configured local origin is not the billet center`
      : role === 'crush-sleeve'
        ? `Round stock OD ${p.sleeveDiameter}, length ${p.sizeZ} mm`
        : boxedRoles.has(role)
          ? `Single machined billet ${role === 'z-moving-box' ? Math.max(+p.sizeX / 2, +p.bossCenterX + +p.bossWidth / 2) + +p.sizeX / 2 : p.sizeX} x ${Math.max(+p.sizeY / 2 + +p.ribDepth, role === 'z-moving-box' ? +p.bossCenterY + +p.bossDepth / 2 : +p.sizeY / 2) - Math.min(-+p.sizeY / 2, role === 'z-moving-box' ? +p.bossCenterY - +p.bossDepth / 2 : -+p.sizeY / 2)} x ${p.sizeZ} mm; web datum is the configured local origin, not billet center`
          : hollow
            ? `Rectangular hollow section ${p.sizeX} x ${p.sizeY} x ${p.sizeZ}, wall ${p.wall} mm`
            : `Plate / billet ${p.sizeX} x ${p.sizeY} x ${role === 'rail-pad' ? +p.sizeZ + +p.shoulderHeight : p.sizeZ} mm`,
    processes:
      role === 'crush-sleeve'
        ? ['turning', 'drilling']
        : hollow
          ? ['cutting', 'milling', 'drilling']
          : ['milling', 'drilling'],
    requirements: [
      'Specify material grade, blank standard, datum tolerances and drawing revision.',
      'Machine locating and rail seats in one referenced setup; deburr bores and provide cutter clearance.',
      hollow
        ? 'Use separate compression sleeves for structural through-bolts; do not crush unsupported hollow walls.'
        : 'Verify bolt engagement, counterbore remaining wall and tool access.',
      role === 'rail-pad'
        ? 'Check the selected guide shoulder height, fillet clearance, flatness and rail parallelism.'
        : 'Inspect every mating hole position against the selected component drawing.',
      ...(+p.cornerReliefRadius > 0
        ? [
            `Machine the explicit through-X circular corner relief R${p.cornerReliefRadius} at local positive-Y/positive-Z outer corner; inspect remaining nut-flange and rear-anchor ligaments.`,
          ]
        : []),
      ...(drivePocket
        ? [
            `Machine the open rear support channel with R${drivePocket.rootRadius} corners, retaining ${+p.sizeY - drivePocket.rearDepth} mm front skin; machine the separate shaft, barrel and below-platform flange clearances from their explicit local dimensions. Prove cutter access and the net loaded section after all pockets.`,
          ]
        : []),
      ...(boxedRoles.has(role)
        ? [
            'Machine web, integral ribs and nut platform from ONE billet; do not represent separately bolted fins as this monolithic part.',
            `Retain internal cutter radius ${p.internalFillet} mm and verify all tool paths, clamping setups and residual web thickness.`,
          ]
        : []),
      ...(role === 'encoder-offset-angle'
        ? [
            `Machine the connected encoder lower wall ${p.rearWebHeight} mm high, ${p.shoulderWidth} mm offset spine and ${p.wall} mm upper foot from one billet; the bridge overlaps the lower wall by 1 mm before cutter radii are qualified.`,
            'Qualify inside corner radii and tool access while retaining the real readhead datum and full swept rib-head clearance; do not split this blank into disconnected plates.',
          ]
        : []),
      ...(ear
        ? [
            `Machine the integral front ear ${ear.size.map((n) => Number(n.toFixed(6))).join(' x ')} mm at local origin ${ear.origin.map((n) => Number(n.toFixed(6))).join(', ')} from the SAME billet; retain its positive connection to the recessed main wall.`,
            'Release the depth-dependent tapped-hole edge stock, thin front band, corner radii and clamping preload from actual delivered encoder mounting data; this authored ear is not a supplier modification or a strength certificate.',
          ]
        : []),
      ...(hollow
        ? [
            `Declared outside corner radius ${p.cornerRadius} mm and inner radius ${Math.max(0, +p.cornerRadius - +p.wall)} mm are selected stock-model values; accept the delivered section drawing/radii and wall tolerances before machining.`,
            'Verify every tapped wall and rounded end insert against the delivered stock section; catalogue section inertia is not an as-machined certification.',
          ]
        : []),
      ...(role === 'portal-post'
        ? [
            'Machine both open ends square and parallel for the separate load-bearing caps. The long axial tie bolts run inside the section void and clamp its end faces, not unsupported side walls.',
            'Machine the declared transverse wrench-access ports before assembly; verify a real hex key can reach and tighten the short beam-seat fasteners without removing the column caps.',
            'Release the as-machined post section and cap bending, bolt preload and locating interfaces; the gross catalogue moments are not a qualified assembled stiffness.',
          ]
        : []),
      ...(role === 'gantry-drive-link'
        ? [
            `Machine both side pockets below the ${p.rearWebHeight} mm top bar from ONE plate, leaving a ${p.ribDepth} mm central stem and R${p.internalFillet} internal roots. The full top bar bears on the underside of the horizontal foot.`,
            'Retain the actual top-bar fastener edge stock and accessible underside tightening path; release shear, tension and bending at the stem roots and joint preload.',
          ]
        : []),
    ],
  };
}
