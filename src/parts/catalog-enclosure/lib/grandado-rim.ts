import {
  box,
  cylinder,
  roundedRect,
  subtract,
  type Shape,
} from '../../../core/assembly/boundary/shapes';

type Point = [number, number];
export type GrandadoRimSegment =
  | { kind: 'line'; points: [Point, Point] }
  | { kind: 'arc'; points: [Point, Point, Point]; center: Point; radius: number };

/** Delivered-sample evidence, not a manufacturer drawing or batch-wide tolerance. */
export const grandadoBodyMeasurements = {
  bodyHardHeight: 22,
  bodyIncludingRimHeight: 23.8,
  sealingRimHeight: 1.8,
  earThickness: 6,
  reportedRimOuter: [78.7, 53.7],
  reportedRimInner: [76.8, 51.6],
  uniformRimWall: 1,
  source:
    'User measurements of the delivered enclosure, 2026-11-01. The rim is approximately uniform 1 mm; unequal inferred thicknesses from the reported spans reflect measurement uncertainty. No batch tolerance is established.',
  limitations:
    'Corner and post-turn profiles, precise common wall thickness, centring tolerance, deeper cavity and support ledge geometry remain unmeasured.',
} as const;

export const grandadoRimSpec = {
  outerLength: 78.7,
  outerWidth: 53.7,
  wall: 1,
  innerLength: 76.7,
  innerWidth: 51.7,
  railX: 38.85,
  railY: 26.35,
  postRadius: 3.9,
  supportLedgeHeight: 2,
  cornerScope:
    'Analytic doglegs preserve the observed topology around the existing screw axes; R3.9 is an installation estimate, not a measured molded corner.',
} as const;

export function grandadoRimPath(
  railX: number = grandadoRimSpec.railX,
  railY: number = grandadoRimSpec.railY,
  radius: number = grandadoRimSpec.postRadius,
): GrandadoRimSegment[] {
  const x = 36.5,
    y = 24;
  const line = (a: Point, b: Point): GrandadoRimSegment => ({ kind: 'line', points: [a, b] });
  const arc = (cx: number, cy: number, start: number): GrandadoRimSegment => {
    const point = (angle: number): Point => [
      cx + radius * Math.cos(angle),
      cy + radius * Math.sin(angle),
    ];
    return {
      kind: 'arc',
      center: [cx, cy],
      radius,
      points: [point(start), point(start + Math.PI / 4), point(start + Math.PI / 2)],
    };
  };
  return [
    line([-x + radius, railY], [x - radius, railY]),
    line([x - radius, railY], [x - radius, y]),
    arc(x, y, Math.PI),
    line([x, y - radius], [railX, y - radius]),
    line([railX, y - radius], [railX, -y + radius]),
    line([railX, -y + radius], [x, -y + radius]),
    arc(x, -y, Math.PI / 2),
    line([x - radius, -y], [x - radius, -railY]),
    line([x - radius, -railY], [-x + radius, -railY]),
    line([-x + radius, -railY], [-x + radius, -y]),
    arc(-x, -y, 0),
    line([-x, -y + radius], [-railX, -y + radius]),
    line([-railX, -y + radius], [-railX, y - radius]),
    line([-railX, y - radius], [-x, y - radius]),
    arc(-x, y, (3 * Math.PI) / 2),
    line([-x + radius, y], [-x + radius, railY]),
  ];
}

/** Constant-width native stroke; cylinders and clipped annuli retain true circles. */
export function grandadoRimBand(
  width: number,
  z: number,
  height: number,
  railX: number = grandadoRimSpec.railX,
  railY: number = grandadoRimSpec.railY,
  radius: number = grandadoRimSpec.postRadius,
): Shape {
  const half = width / 2,
    children: Shape[] = [];
  for (const segment of grandadoRimPath(railX, railY, radius)) {
    const a = segment.points[0],
      b = segment.points.at(-1)!;
    if (segment.kind === 'line') {
      if (Math.abs(a[1] - b[1]) < 1e-9)
        children.push(
          box([Math.abs(b[0] - a[0]), width, height], [Math.min(a[0], b[0]), a[1] - half, z]),
        );
      else
        children.push(
          box([width, Math.abs(b[1] - a[1]), height], [a[0] - half, Math.min(a[1], b[1]), z]),
        );
    } else {
      const [cx, cy] = segment.center,
        outer = radius + half;
      const sx = Math.sign(segment.points[1][0] - cx),
        sy = Math.sign(segment.points[1][1] - cy);
      children.push({
        kind: 'intersect',
        children: [
          subtract(
            cylinder(outer, height, [cx, cy, z]),
            cylinder(radius - half, height + 0.2, [cx, cy, z - 0.1]),
          ),
          box(
            [outer, outer, height + 0.2],
            [cx + (sx < 0 ? -outer : 0), cy + (sy < 0 ? -outer : 0), z - 0.1],
          ),
        ],
      });
    }
    // One shared cap per path vertex gives adjacent strokes a positive overlap.
    children.push(cylinder(half, height, [a[0], a[1], z]));
  }
  return { kind: 'union', nativeBatch: true, children };
}

/** Inboard region of the dogleg path, used only to construct an inferred support flange. */
export function grandadoRimOpening(
  inset: number,
  z: number,
  height: number,
  railX: number = grandadoRimSpec.railX,
  railY: number = grandadoRimSpec.railY,
  radius: number = grandadoRimSpec.postRadius,
): Shape {
  const x = 36.5,
    y = 24,
    r = radius + inset;
  const innerX = railX - inset,
    innerY = railY - inset;
  const children: Shape[] = [
    box([2 * (x - r), 2 * innerY, height], [-x + r, -innerY, z]),
    box([2 * innerX, 2 * (y - r), height], [-innerX, -y + r, z]),
  ];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      children.push(
        subtract(
          box([r, r, height], [sx < 0 ? -x : x - r, sy < 0 ? -y : y - r, z]),
          cylinder(r, height + 0.2, [sx * x, sy * y, z - 0.1]),
        ),
      );
  return { kind: 'union', nativeBatch: true, children };
}

/** Estimated flange backing, not a measured full-depth cavity reconstruction. */
export function grandadoRimFlange(
  z: number,
  height: number,
  inset: number,
  railX: number = grandadoRimSpec.railX,
  railY: number = grandadoRimSpec.railY,
  radius: number = grandadoRimSpec.postRadius,
): Shape {
  return subtract(
    roundedRect(83, 58, 5, z, height),
    grandadoRimOpening(inset, z - 0.1, height + 0.2, railX, railY, radius),
  );
}
