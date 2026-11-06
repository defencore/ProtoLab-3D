import type { Parameters } from '../../../core/types';
import {
  box,
  cylinder,
  prism,
  union,
  subtract,
  type Shape,
} from '../../../core/assembly/boundary/shapes';
import {
  guidedDatums,
  piPackageClearances,
  guidedGpioReserve,
  worldPoint,
  at,
} from './guided-layout';
import { guidedPowerCoverClearance } from './guided-power';
import { guidedPcieReserve, guidedPciePlan } from './guided-routing';
import { upsInterface } from '../../waveshare-ups-3s/part';
import { pi5Interface } from '../../raspberry-pi/part';
import { adapterInterface } from '../../waveshare-pcie-m2-d/part';

const intersect = (...children: Shape[]): Shape => ({ kind: 'intersect', children });
function upsHoles() {
  return upsInterface.holes.map((h) => ({ y: h.y, z: h.x - 44 }));
}
export function powerCarrierShape(p: Parameters, extraCuts: Shape[] = []): Shape {
  const cable = guidedPciePlan(p);
  type Segment = Extract<Shape, { kind: 'curve-loft' }>['segments'][number];
  // End at the final bend: its horizontal terminal tail lies on the closing
  // edge and would otherwise be retraced into a zero-area wire extension.
  const boundary: Segment[] = cable.reserveSegments.slice(0, -1).map((segment) => {
    if (segment.kind === 'arc') {
      const direction = Math.sign(segment.end - segment.start);
      const radius = segment.radius + (direction * cable.reserveThickness) / 2;
      return {
        kind: 'arc',
        points: [segment.start, (segment.start + segment.end) / 2, segment.end].map(
          (angle) =>
            [
              segment.center[0] + radius * Math.cos(angle),
              segment.center[2] + radius * Math.sin(angle),
            ] as [number, number],
        ),
      };
    }
    const dx = segment.end[0] - segment.start[0],
      dz = segment.end[2] - segment.start[2];
    const length = Math.hypot(dx, dz);
    return {
      kind: 'line',
      points: [segment.start, segment.end].map(
        (point) =>
          [
            point[0] + ((dz / length) * cable.reserveThickness) / 2,
            point[2] - ((dx / length) * cable.reserveThickness) / 2,
          ] as [number, number],
      ),
    };
  });
  const first = boundary[0].points[0],
    last = boundary.at(-1)!.points.at(-1)!;
  const cableBackOpening = at(
    {
      kind: 'curve-loft',
      segments: [
        { kind: 'line', points: [[-15, first[1]], first] },
        ...boundary,
        { kind: 'line', points: [last, [-15, last[1]]] },
        {
          kind: 'line',
          points: [
            [-15, last[1]],
            [-15, first[1]],
          ],
        },
      ],
      layers: [
        { scale: 1, angle: 0, z: 0 },
        { scale: 1, angle: 0, z: cable.reserveWidth },
      ],
    },
    { translation: [0, cable.reserveWidth / 2, 0], rotation: [90, 0, 0] },
  );
  const parts: Shape[] = [
    box([4.2, 60, 99.5], [-9, -30, -94]),
    box([4.8, 3.0, 93.3], [-4.8, -33.2, -91]),
    box([4.8, 3.0, 93.3], [-4.8, 30.2, -91]),
    box([4.2, 16, 10.8], [-9, -20, 2.7]),
    box([4.2, 50, 9], [-9, -25, -94]),
    box([4.2, 1.25, 88], [-9, 30, -83]),
    box([4.8, 66.4, 2.3], [-4.8, -33.2, -92.8]),
    box([4.5, 66.4, 2.8], [-4.8, -33.2, 2.7]),
    // Grow the long side cheeks at 45 degrees from the same bed face as the divider.
    ...[-1, 1].map((sign) =>
      prism(
        [
          [-9, 29.8],
          [-9, 30],
          [-5.8, 33.2],
          [-4.8, 33.2],
          [-4.8, 29.8],
        ].map(([x, y]) => [x, sign * y] as [number, number]),
        99.5,
        -94,
      ),
    ),
  ];
  // Broad PCB seats carry compression; short pins in the actual holes locate in-plane.
  for (const h of upsHoles())
    parts.push(cylinder(5, 5.2, [-4.8, h.y, h.z], 'x'), cylinder(1.35, 1.2, [0.2, h.y, h.z], 'x'));
  return subtract(
    intersect(union(...parts), box([50, 80, 110], [-15, -40, -94])),
    guidedPcieReserve(p),
    // Open the cable-facing backing film; the UPS-side divider remains 2.9 mm thick.
    cableBackOpening,
    // Remove the nonfunctional connector-clearance feather at the front tab.
    box([0.5, 5.3, 0.2], [-0.6, -14.2, 2.65]),
    box([80, 100, 10], [-40, -50, -102.5]),
    box([20, 80, 6], [0, -40, 3]),
    ...extraCuts,
    // Clear the fixed lower Pi lands during normal entry, above the UPS PCB edge.
    ...pi5Interface.pcb.holes.slice(0, 2).map((h) => {
      const [, y, z] = worldPoint([h.x, h.y, h.z], guidedDatums.pi);
      const outer = y < 0 ? -30 : 27;
      return union(
        cylinder(4.3, 40, [-20, y, z], 'x'),
        box([40, Math.abs(outer - y) + 2.6, 8.6], [-20, Math.min(outer, y) - 0.3, z - 4.3]),
      );
    }),
    ...piPackageClearances(0.3),
    guidedGpioReserve(),
    ...[-1, 1].map((sign) => cylinder(2, 8, [0, sign > 0 ? 31.7 : -39.7, -92.5], 'y')),
    ...pi5Interface.pcb.holes.slice(0, 2).flatMap((h) => {
      const y = h.y - 2,
        z = h.x + guidedDatums.pi.translation[2];
      return [cylinder(4.8, 4.8, [-0.3, y, z], 'x'), cylinder(3.3, 2.8, [-6.2, y, z], 'x')];
    }),
  );
}
export function adapterCushionShape(extraCuts: Shape[] = []): Shape {
  // The support lands are outside the populated SSD/socket area; the board is clamped from both faces.
  return subtract(
    union(
      box([5.9, 5, 94.5], [-16.5, -25.25, -89]),
      box([5.9, 4.95, 94.5], [-16.5, 26.3, -89]),
      box([5.9, 56.5, 2.3], [-16.5, -25.25, -85]),
      // A broad rear tie remains below the source mounting boss and joins both entry-notched sides.
      box([5.9, 56.5, 2.8], [-16.5, -25.25, -89]),
      // Route the positive rail's connection inward behind the SSD, so the
      // corner clearance leaves a 3.8 mm web instead of its former 0.5 mm neck.
      box([5.9, 8.25, 6.2], [-16.5, 23, -89]),
      box([5.9, 56.5, 2.8], [-16.5, -25.25, 2.7]),
      // Short diagonal locating stubs enter the source D2.7 PCB holes; broad faces carry preload.
      ...[adapterInterface.holes[0], adapterInterface.holes[3]].map((hole) => {
        const [, y, z] = worldPoint([hole.x, hole.y, hole.z], guidedDatums.adapter);
        return cylinder(1.15, 1.1, [-10.8, y, z], 'x');
      }),
    ),
    // Clear the fixed lower Pi lands during normal entry, above the UPS PCB edge.
    ...pi5Interface.pcb.holes.slice(0, 2).map((h) => {
      const [, y, z] = worldPoint([h.x, h.y, h.z], guidedDatums.pi);
      const outer = y < 0 ? -30 : 27;
      return union(
        cylinder(4.3, 40, [-20, y, z], 'x'),
        box([40, Math.abs(outer - y) + 2.6, 8.6], [-20, Math.min(outer, y) - 0.3, z - 4.3]),
      );
    }),
    ...extraCuts,
    cylinder(3.5, 9, [-18, 12.95, -82.5], 'x'),
    box([12, 12, 10.4], [-18, 26.8, -94.2]),
  );
}
export function cellCoverShape(p: Parameters, extraCuts: Shape[] = []): Shape {
  const feet = upsHoles().map((h) => cylinder(4, 6, [2, h.y, h.z], 'x'));
  const outside = union(
    box([3, 66.4, 80], [23.5, -33.2, -84]),
    box([25, 3.2, 94], [0.2, -33.2, -91]),
    box([25, 3.2, 94], [0.2, 30, -91]),
  );
  return subtract(
    intersect(
      union(
        outside,
        ...feet,
        ...upsHoles().map((h) =>
          prism(
            [
              [2, h.y],
              [8, h.y],
              [23.5, h.y > 0 ? 30 : -30],
              [25.2, h.y > 0 ? 33.2 : -33.2],
              [2, h.y > 0 ? 33.2 : -33.2],
            ],
            8,
            h.z - 4,
          ),
        ),
        ...upsHoles().map((h) =>
          box([6, Math.max(1, 33.2 - Math.abs(h.y)), 8], [2, h.y > 0 ? h.y : -33.2, h.z - 4]),
        ),
      ),
      cylinder(40, 100, [0, 0, -94]),
    ),
    ...extraCuts,
    ...upsPlugReserves(),
    guidedPowerCoverClearance(p),
    ...pi5Interface.pcb.holes
      .slice(0, 2)
      .map((h) => cylinder(4.8, 4.5, [-0.3, h.y - 2, h.x + guidedDatums.pi.translation[2]], 'x')),
  );
}
/** Flat common bed and broad pressure cover captured by the two cage halves. */
export function shiftedAccessoryParts(_p: Parameters) {
  const bed = union(
    box([2.2, 26.4, 41.4], [13.3, -30.7, 27.8]),
    subtract(box([3, 26.4, 41.4], [15.5, -30.7, 27.8]), box([4, 20.4, 35.4], [15.4, -27.7, 30.8])),
    box([3, 23.4, 29.4], [8.5, -3.4, 27.8]),
    subtract(
      box([3, 23.4, 29.4], [11.5, -3.4, 27.8]),
      box([4, 17.4, 23.4], [11.4, -0.4, 30.8]),
      box([4, 13.5, 5], [11.4, 1.8, 53.8]),
      box([4, 4, 21], [11.4, 16.8, 32]),
    ),
    box([5.5, 4.6, 29.4], [10, -5, 27.8]),
  );
  const lid = intersect(
    union(
      box([2, 47.5, 8], [28.5, -27.5, 40]),
      box([10.5, 12, 8], [20, -23.5, 40]),
      // Contact the clear PCB edge, rather than leaving a gap to the SIM roof.
      // Preserve the bare-PCB edge contact while widening its root outside the source board.
      prism(
        [
          [16.8, -26.7],
          [16.8, -25.5],
          [20, -25.5],
          [20, -29],
          [18.5, -27.5],
        ],
        5,
        40,
      ),
      // This 45-degree continuation gives the haunch a broad, printable root.
      prism(
        [
          [20, -29],
          [22.3, -26.7],
          [20, -26.7],
        ],
        5,
        40,
      ),
      box([10.5, 3.3, 5], [20, -26.7, 40]),
      box([2, 13, 12], [28.5, 1.8, 36]),
    ),
    cylinder(39.9, 80, [0, 0, 20]),
  );
  return [
    { id: 'aux-bed', name: 'Common stepped TPU tracker and finder bed', shape: bed },
    { id: 'aux-clamp', name: 'Broad TPU auxiliary pressure cover captured by cage', shape: lid },
  ];
}

/** Authored mating/working allowances, separate from the source module geometry. */
export function upsPlugReserves(): Shape[] {
  return [
    ...[15, 5, -5, -15].map((y) => box([30, 9, 7], [9, y - 4.5, -4])),
    box([18, 15, 10], [2, -19.1, -91.7]),
    box([26, 9, 10], [2, -4, -91]),
  ];
}
