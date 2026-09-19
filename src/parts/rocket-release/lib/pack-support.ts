import type { Parameters } from '../../../core/types';
import { batteryLayout, batteryPosts } from './balance';
import { at, layout, springAngles } from './motion';
import { servoTiePosts } from './servo-retention';
import { box, circle, cylinder, plate, ring, subtract, union, type Shape } from './shapes';

/** Dedicated harness passages, separated from cell terminals and structural fasteners. */
export const packWirePorts: [number, number][] = [
  [-13, 24],
  [-13, -24],
];
export const seatRadius = 9.5;
export const seatOuterRadius = 11.2;
export const packFlatEdge = (radius: number) => (radius - 3) * Math.cos(Math.PI / 12) - 0.5;

/** Conservative through-pockets outside cell seats, tie bosses and lined ports.
 * These retain >=3 mm webs to the load interfaces; no strength rating is implied.
 */
export function packLightening(p: Parameters, frame = false): [number, number, number][] {
  const m = layout(p),
    cells = batteryLayout(p);
  const candidates: [number, number, number][] = frame
    ? [
        [16, -7, 3],
        [16, 7, 3],
        [34, -6, 3],
        [34, 6, 3],
      ]
    : [
        [27, 0, 8],
        [-28, -20, 3],
        [-28, 20, 3],
      ];
  return candidates.filter(
    ([x, y, r]) =>
      Math.hypot(x, y) + r + 3 <= m.radius - 1.5 &&
      Math.hypot(x, y) - r >= 13 &&
      cells.every(([a, b]) => Math.hypot(x - a, y - b) - r >= seatOuterRadius + 3) &&
      batteryPosts(m.radius).every(([a, b]) => Math.hypot(x - a, y - b) - r >= 5.5) &&
      packWirePorts.every(([a, b]) => Math.hypot(x - a, y - b) - r >= 8),
  );
}

/** Common insulating plates: closed lateral seats and terminal access on both ends. */
export function packSeatPlate(p: Parameters, upper: boolean, backing = false): Shape {
  const m = layout(p),
    cells = batteryLayout(p);
  const z = backing ? 79.7 : upper ? 76.7 : 8,
    t = backing ? 2 : upper ? 3 : 2.5;
  const holes = [
    ...cells.map(([x, y]) => circle(6, x, y)),
    ...packWirePorts.map(([x, y]) => circle(4, x, y)),
    ...batteryPosts(m.radius).map(([x, y]) => circle(upper ? 1.6 : 1.1, x, y)),
    ...(upper ? [] : [circle(10), ...packLightening(p).map(([x, y, r]) => circle(r, x, y))]),
  ];
  const base = plate(circle(m.radius - 1.5), holes, z, t);
  const collars = backing
    ? []
    : cells.map(([x, y]) =>
        plate(circle(seatOuterRadius, x, y), [circle(seatRadius, x, y)], upper ? 70.7 : 10.5, 6),
      );
  const cuts = [
    // Four machined flats clear the complete integral wall arcs by at least 0.5 mm.
    // Keep the diagonal mounting shoulders and the full circular cell seats.
    ...[0, 90, 180, 270].map((a) => {
      const edge = packFlatEdge(m.radius);
      const pts = [
        [edge, -m.radius - 1],
        [m.radius + 1, -m.radius - 1],
        [m.radius + 1, m.radius + 1],
        [edge, m.radius + 1],
      ] as [number, number][];
      const angle = (a * Math.PI) / 180;
      return plate(
        pts.map(([x, y]) => [
          x * Math.cos(angle) - y * Math.sin(angle),
          x * Math.sin(angle) + y * Math.cos(angle),
        ]),
        [],
        70,
        14,
      );
    }),
    // Actual servo and its independent tie posts remain clear of the common plate.
    box([46.6, 26.2, 14], [-10.8, -13.1, 70]),
    ...servoTiePosts.map(([x, y]) => cylinder(2.6, 14, [x, y, 70])),
    ...springAngles.map((a) => {
      const [x, y] = at(m.lockRadius, a);
      return cylinder(5.5, 14, [x, y, 70]);
    }),
  ];
  const layers = [base, ...collars].map((s) => (upper ? subtract(s, ...cuts) : s));
  return {
    kind: 'fusedLayers',
    children: layers,
    planes: [upper ? 76.7 : 10.5],
    solid: union(...layers),
  };
}

/** Flexible flanged liner captures the complete thickness of each wiring passage. */
export function wireLiner(x: number, y: number, z: number, thickness: number): Shape {
  return union(
    ring(4, 3, z, thickness, x, y),
    ring(5, 3, z - 0.7, 0.7, x, y),
    ring(5, 3, z + thickness, 0.7, x, y),
  );
}
