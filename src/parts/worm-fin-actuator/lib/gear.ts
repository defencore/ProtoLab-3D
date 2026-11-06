import type { Parameters } from '../../../core/types';
import type { Shape } from '../../../core/assembly/boundary/shapes';
import { layout, tr8, type Layout } from './layout';
import { ShapeUtils, Vector2, Vector3 } from 'three';
export type Point = [number, number];
export interface GearProfiles {
  layers: { z: number; points: Point[] }[];
  blank: Point[];
  square: Point[];
}
const cache = new Map<string, GearProfiles>();
const tau = 2 * Math.PI;

/** Nominal Tr30 cutter surface, in the same +X/right-hand frame as the screw solid. */
export function screwRadius(v: Layout, x: number, y: number, z: number, wormAngle: number) {
  const theta = Math.atan2(y - v.centerDistance, -z);
  const phase = wormAngle + (tau * x) / tr8.lead;
  const periodic =
    Math.atan2(Math.sin(tr8.starts * (theta - phase)), Math.cos(tr8.starts * (theta - phase))) /
    tr8.starts;
  const axial = Math.max(0, (Math.abs(periodic) * tr8.lead) / tau - v.backlash / 2);
  return (
    Math.max(v.rootDiameter / 2, Math.min(4, 3.5 + (0.5 - axial) / Math.tan(Math.PI / 12))) +
    v.meshClearance
  );
}

/** Sweep the actual four-start cutter in conjugate motion; solve the first radial contact.
 * This is a numerical fabrication reference, not a strength or contact-pattern qualification.
 */
function envelope(v: Layout, beta: number, z: number): number {
  let limit = v.gearTipRadius;
  const contact = 0.65;
  const samples = Math.max(
    480,
    Math.ceil((2 * contact * v.ratio * tr8.lead) / (tau * (v.backlash / 4))),
  );
  const reach = Math.sqrt((4 + v.meshClearance) ** 2 - z * z);
  for (let i = 0; i <= samples; i++) {
    const gamma = Math.PI / 2 - contact + (2 * contact * i) / samples;
    const c = Math.cos(gamma),
      s = Math.sin(gamma);
    const entry = (v.centerDistance - reach) / s;
    if (entry >= limit) continue;
    const spin = (gamma - beta) * v.ratio;
    const inside = (r: number) => {
      const x = r * c,
        y = r * s;
      return (
        Math.abs(x) <= v.threadHalf &&
        Math.hypot(y - v.centerDistance, z) <= screwRadius(v, x, y, z, spin)
      );
    };
    let previous = entry - 0.00001;
    const top = limit;
    for (let j = 1; j <= 12; j++) {
      const r = entry + ((top - entry) * j) / 12;
      if (!inside(r)) {
        previous = r;
        continue;
      }
      let lo = previous,
        hi = r;
      for (let k = 0; k < 12; k++) {
        const mid = (lo + hi) / 2;
        if (inside(mid)) hi = mid;
        else lo = mid;
      }
      limit = Math.min(limit, lo);
      break;
    }
  }
  return limit;
}

export function gearProfiles(p: Parameters): GearProfiles {
  const v = layout(p);
  const key = [
    v.teeth,
    v.travel,
    v.plateThickness,
    v.rootDiameter,
    v.meshClearance,
    v.backlash,
    v.wormLength,
  ].join('/');
  const known = cache.get(key);
  if (known) return known;
  const perTooth = 40,
    pitch = tau / v.teeth;
  const samples = Array.from({ length: 11 }, (_, layer) => {
    const z = v.plateThickness * (layer / 10 - 0.5);
    const radii = Array.from({ length: perTooth + 1 }, (_, i) =>
      envelope(v, Math.PI / 2 + pitch * (i / perTooth - 0.5), z),
    );
    return { z, radii };
  });
  const half = (v.halfSector * Math.PI) / 180;
  const start = Math.PI / 2 - half,
    end = Math.PI / 2 + half;
  const count = Math.max(32, Math.ceil(((end - start) / pitch) * perTooth));
  const angles = Array.from({ length: count + 1 }, (_, i) => start + ((end - start) * i) / count);
  const radial = (radii: number[], beta: number) => {
    const coordinate = (((((beta - Math.PI / 2) / pitch + 0.5) % 1) + 1) % 1) * perTooth;
    const index = Math.floor(coordinate),
      fraction = coordinate - index;
    return radii[index] * (1 - fraction) + radii[index + 1] * fraction;
  };
  const tail: Point[] = Array.from({ length: 65 }, (_, i) => {
    const a = end + ((tau - (end - start)) * i) / 64;
    return [v.hubRadius * Math.cos(a), v.hubRadius * Math.sin(a)];
  });
  const layers = samples.map(({ z, radii }) => ({
    z,
    points: [
      ...angles.map((a): Point => {
        const r = radial(radii, a);
        return [r * Math.cos(a), r * Math.sin(a)];
      }),
      ...tail,
    ],
  }));
  // Laser stock retains material for the swept flanks: it is not the finished gear contour.
  const blank: Point[] = [
    ...angles.map((a): Point => {
      const r = Math.max(...samples.map(({ radii }) => radial(radii, a))) + 0.15;
      return [r * Math.cos(a), r * Math.sin(a)];
    }),
    ...tail,
  ];
  const h = (v.squareAF + 0.08) / 2;
  const square: Point[] = [
    [-h, -h],
    [h, -h],
    [h, h],
    [-h, h],
  ];
  const profiles = { layers, blank, square };
  if (cache.size >= 12) cache.delete(cache.keys().next().value!);
  cache.set(key, profiles);
  return profiles;
}
export function finishedSector(p: Parameters): Shape {
  const profile = gearProfiles(p),
    hole = [...profile.square].reverse();
  const n = profile.layers[0].points.length,
    stride = n + hole.length;
  const points: [number, number, number][] = profile.layers.flatMap((layer) =>
    [...layer.points, ...hole].map(([x, y]): [number, number, number] => [x, y, layer.z]),
  );
  const faces: number[][] = [];
  for (let k = 0; k < profile.layers.length - 1; k++)
    for (const [start, count] of [
      [0, n],
      [n, hole.length],
    ])
      for (let i = 0; i < count; i++) {
        const a = k * stride + start + i,
          b = k * stride + start + ((i + 1) % count);
        faces.push([a, b, b + stride], [a, b + stride, a + stride]);
      }
  for (const k of [0, profile.layers.length - 1]) {
    const cap = ShapeUtils.triangulateShape(
      profile.layers[k].points.map((p) => new Vector2(...p)),
      [hole.map((p) => new Vector2(...p))],
    );
    faces.push(...cap.map((f) => (k === 0 ? [...f].reverse() : f).map((i) => k * stride + i)));
  }
  const volume = faces.reduce(
    (sum, f) =>
      sum +
      new Vector3(...points[f[0]]).dot(
        new Vector3(...points[f[1]]).cross(new Vector3(...points[f[2]])),
      ),
    0,
  );
  return {
    kind: 'boundary',
    points,
    faces: volume < 0 ? faces.map((f) => [...f].reverse()) : faces,
  };
}
