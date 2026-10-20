import type { Parameters } from '../../../core/types';
import { defaults } from '../configurator';
import {
  box,
  cylinder,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';

const roleDefaults: Record<string, Parameters> = {
  't-track': {
    width: 32,
    thickness: 12,
    slotSpacing: 80,
    slotDepth: 8,
    slotHeight: 4,
    edgeMount: 5,
    mountBoltDiameter: 4,
  },
  spoilboard: { width: 1004.5 },
  'hybrid-board': { width: 1004.5, slotSpacing: 80 },
  'vacuum-plate': { length: 300, width: 300, thickness: 20, mountPitch: 200, drainDiameter: 8 },
  'pan-floor': { width: 1060, length: 1840, thickness: 3 },
  'pan-side': { length: 1840, width: 85, thickness: 3 },
  'pan-end': { length: 1060, width: 85, thickness: 3 },
  'filter-basket': {
    width: 120,
    length: 180,
    thickness: 2,
    mountPitch: 100,
    mountBoltDiameter: 4,
    edgeMount: 8,
  },
  'tank-body': { width: 250, length: 350, thickness: 5 },
  'tank-lid': { width: 250, length: 350, thickness: 5 },
};
export const worktableParameters = (component: string, overrides: Parameters = {}): Parameters => ({
  ...defaults,
  ...roleDefaults[component],
  component,
  ...overrides,
});
export interface TableHole {
  center: Vec;
  axis: 'z';
  diameter: number;
  depth: number;
  threaded: boolean;
}
export interface RibPassage {
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
  bottomZ: number;
}
/** Explicit fabrication ports around stationary RHS ribs, never an inferred mesh cut. */
export function worktableRibPassages(p: Parameters): RibPassage[] {
  const raw: unknown = JSON.parse(String(p.ribPassages));
  if (!Array.isArray(raw) || raw.length > 20)
    throw new Error('Use at most twenty explicit fixed-rib passages.');
  const keys = ['y', 'width', 'height', 'cornerRadius', 'bottomZ'];
  for (const value of raw) {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).length !== keys.length ||
      Object.keys(value).some((key) => !keys.includes(key)) ||
      keys.some((key) => typeof value[key] !== 'number' || !Number.isFinite(value[key]))
    )
      throw new Error(
        'Rib passages require all explicit finite dimensions and no unrecognized cuts.',
      );
    const r = value as RibPassage;
    if (
      p.component !== 'pan-side' ||
      r.width <= 0 ||
      r.height <= 0 ||
      r.cornerRadius <= 0 ||
      2 * r.cornerRadius >= Math.min(r.width, r.height) ||
      r.bottomZ <= Number(p.bendRadius) + Number(p.thickness) + 2 ||
      r.bottomZ + r.height >= Number(p.width) - 2 ||
      Math.abs(r.y) + r.width / 2 >= Number(p.length) / 2 - 20
    )
      throw new Error(
        'Fixed-rib passages must retain the formed corner, upper wall and both end ligaments.',
      );
  }
  const passages = raw as RibPassage[];
  for (let i = 0; i < passages.length; i++)
    for (let j = i + 1; j < passages.length; j++)
      if (
        Math.abs(passages[i].y - passages[j].y) <=
        (passages[i].width + passages[j].width) / 2 + 5
      )
        throw new Error('Separate rib passages need at least five millimetres of continuous wall.');
  return passages;
}
export function worktableLayout(p: Parameters) {
  const length = Number(p.length),
    width = Number(p.width),
    thickness = Number(p.thickness),
    edge = Number(p.edgeMount),
    pitch = Number(p.mountPitch),
    bolt = Number(p.mountBoltDiameter),
    role = String(p.component),
    rows = Math.max(1, Math.floor((length - 2 * edge) / pitch) + 1),
    yRows = Array.from({ length: rows }, (_, i) => (i - (rows - 1) / 2) * pitch);
  const threaded = role === 'slat' || role === 'vacuum-plate' || role === 't-track';
  const holes: TableHole[] = yRows.flatMap((y) =>
    [-width / 2 + edge, width / 2 - edge].map((x) => ({
      center: [x, y, 0] as Vec,
      axis: 'z' as const,
      diameter: threaded ? bolt : bolt + 0.6,
      depth: threaded ? Math.min(role === 't-track' ? 6 : 8, thickness - 3) : thickness,
      threaded,
    })),
  );
  const supportRowCount = Math.max(1, Math.floor((length - 90) / pitch) + 1);
  const supportRows = Array.from(
    { length: supportRowCount },
    (_, i) => (i - (supportRowCount - 1) / 2) * pitch,
  );
  if (role === 'pan-floor') {
    const endRows = Math.max(1, Math.floor((width - 2 * thickness - 2 * edge) / pitch) + 1);
    for (let i = 0; i < endRows; i++)
      for (const side of [-1, 1])
        holes.push({
          center: [(i - (endRows - 1) / 2) * pitch, side * (length / 2 - edge), 0],
          axis: 'z',
          diameter: bolt + 0.6,
          depth: thickness,
          threaded: false,
        });
    for (const y of supportRows)
      for (const side of [-1, 1])
        holes.push({
          center: [(side * Number(p.supportSpacing)) / 2, y, 0],
          axis: 'z',
          diameter: 6.6,
          depth: thickness,
          threaded: false,
        });
  }
  return {
    role,
    length,
    width,
    thickness,
    holes,
    yRows,
    supportRows,
    slots:
      role === 't-track'
        ? [0]
        : role === 'hybrid-board'
          ? Array.from(
              { length: Math.max(1, Math.floor((width - 64) / Number(p.slotSpacing)) + 1) },
              (_, i) =>
                (i - Math.floor((width - 64) / Number(p.slotSpacing)) / 2) * Number(p.slotSpacing),
            )
          : [-Number(p.slotSpacing) / 2, Number(p.slotSpacing) / 2],
    drain: [width / 2 - 30, -length / 2 + 30, 0] as Vec,
  };
}
export function worktableShape(p: Parameters): Shape {
  const v = worktableLayout(p),
    { length: l, width: w, thickness: t, role } = v;
  let base: Shape = box([w, l, t], [-w / 2, -l / 2, 0]);
  const cuts: Shape[] = [];
  if (role === 'slat' || role === 't-track') {
    for (const x of v.slots) {
      cuts.push(
        box(
          [Number(p.slotOpening), l + 2, Number(p.slotDepth) + 1],
          [x - Number(p.slotOpening) / 2, -l / 2 - 1, t - Number(p.slotDepth)],
        ),
      );
      cuts.push(
        box(
          [Number(p.slotWidth), l + 2, Number(p.slotHeight)],
          [x - Number(p.slotWidth) / 2, -l / 2 - 1, t - Number(p.slotDepth)],
        ),
      );
    }
  }
  if (role === 'hybrid-board')
    for (const x of v.slots) cuts.push(box([32.2, l + 2, 12.1], [x - 16.1, -l / 2 - 1, t - 12]));
  if (role === 'vacuum-plate') {
    for (let x = -w / 2 + 40; x <= w / 2 - 40; x += 50)
      cuts.push(box([3, l - 60, 2.1], [x - 1.5, -l / 2 + 30, t - 2]));
    for (let y = -l / 2 + 40; y <= l / 2 - 40; y += 50)
      cuts.push(box([w - 60, 3, 2.1], [-w / 2 + 30, y - 1.5, t - 2]));
    // A connected distribution cross reaches the centre port; outer closed groove accepts a seal.
    cuts.push(box([3, l - 60, 2.1], [-1.5, -l / 2 + 30, t - 2]));
    cuts.push(box([w - 60, 3, 2.1], [-w / 2 + 30, -1.5, t - 2]));
    for (const x of [-w / 2 + 25, w / 2 - 25])
      cuts.push(box([3, l - 47, 2.1], [x - 1.5, -l / 2 + 23.5, t - 2]));
    for (const y of [-l / 2 + 25, l / 2 - 25])
      cuts.push(box([w - 47, 3, 2.1], [-w / 2 + 23.5, y - 1.5, t - 2]));
    cuts.push(cylinder(Number(p.drainDiameter) / 2, t + 2, [0, 0, -1]));
  }
  if (role === 'pan-side' || role === 'pan-end') {
    const r = Number(p.bendRadius),
      outer = r + t;
    const bend: Shape = {
      kind: 'intersect',
      children: [
        subtract(
          cylinder(outer, l, [outer, -l / 2, outer], 'y'),
          cylinder(r, l + 2, [outer, -l / 2 - 1, outer], 'y'),
        ),
        box([outer, l, outer], [0, -l / 2, 0]),
      ],
    };
    base = union(
      box([t, l, w - outer], [0, -l / 2, outer]),
      box([20 - outer, l, t], [outer, -l / 2, 0]),
      bend,
    );
    if (role === 'pan-side')
      for (const side of [-1, 1])
        cuts.push(box([21 - t, 20, outer + 2], [t, side < 0 ? -l / 2 : l / 2 - 20, -1]));
    for (const passage of worktableRibPassages(p)) {
      const { y, width, height, cornerRadius: r, bottomZ } = passage;
      const profile: Shape[] = [
        box([t + 2, width - 2 * r, height], [-1, y - width / 2 + r, bottomZ]),
        box([t + 2, width, height - 2 * r], [-1, y - width / 2, bottomZ + r]),
      ];
      for (const sy of [-1, 1])
        for (const sz of [-1, 1])
          profile.push(
            cylinder(
              r,
              t + 2,
              [-1, y + sy * (width / 2 - r), bottomZ + height / 2 + sz * (height / 2 - r)],
              'x',
            ),
          );
      cuts.push(union(...profile));
    }
    for (const y of v.yRows)
      cuts.push(cylinder(Number(p.mountBoltDiameter) / 2 + 0.3, t + 2, [12, y, -1]));
    return subtract(base, ...cuts);
  }
  if (role === 'tank-body') {
    const height = 150;
    return subtract(
      box([w, l, height], [-w / 2, -l / 2, 0]),
      box([w - 2 * t, l - 2 * t, height], [-w / 2 + t, -l / 2 + t, t]),
    );
  }
  if (role === 'filter-basket') {
    for (let x = -w / 2 + 10; x < w / 2 - 10; x += 15)
      for (let y = -l / 2 + 10; y < l / 2 - 10; y += 15)
        cuts.push(cylinder(2.5, t + 2, [x, y, -1]));
  }
  if (role === 'pan-floor' || role === 'tank-lid')
    cuts.push(
      cylinder(
        Number(p.drainDiameter) / 2,
        t + 2,
        v.drain.map((n, i) => (i === 2 ? -1 : n)) as Vec,
      ),
    );
  for (const h of v.holes)
    cuts.push({
      kind: 'cylinder',
      radius: h.diameter / 2,
      height: h.depth + (h.threaded ? 0 : 2),
      origin: [h.center[0], h.center[1], h.threaded ? 0 : -1],
      axis: 'z',
      ...(h.threaded
        ? {
            thread: {
              pitch: (
                { 4: 0.7, 5: 0.8, 6: 1, 8: 1.25, 10: 1.5, 12: 1.75 } as Record<number, number>
              )[h.diameter],
              internal: true,
              designation: `M${h.diameter}`,
              ...(Number(p.threadFitAllowance) > 0
                ? { radialClearance: Number(p.threadFitAllowance) }
                : {}),
            },
          }
        : {}),
    });
  return subtract(base, ...cuts);
}
