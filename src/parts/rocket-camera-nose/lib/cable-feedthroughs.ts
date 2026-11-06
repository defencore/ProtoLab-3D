import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import { box, cylinder, union, subtract, type Shape } from '../../../core/assembly/boundary/shapes';

export const rearCableCenters: [number, number][] = [
  [-29, -8],
  [-29, 8],
];

export function rearCableCapBosses(p: Parameters): Shape[] {
  const rear = -n(p, 'shoulderLength');
  return rearCableCenters.map(([x, y]) => cylinder(7, 4.2, [x, y, rear + 2.4]));
}

export function rearCableCapCuts(p: Parameters): Shape[] {
  const rear = -n(p, 'shoulderLength');
  return rearCableCenters.map(([x, y]): Shape => ({
    kind: 'transform',
    translation: [x, y, 0],
    rotation: [0, 0, 0],
    child: {
      kind: 'revolve',
      segments: 64,
      profile: [
        [0, rear - 0.1],
        [6.2, rear - 0.1],
        [6.2, rear + 1.4],
        [4.5, rear + 4.8],
        [4.5, rear + 6.8],
        [0, rear + 6.8],
      ],
    },
  }));
}

/** One retained TPU insert joins both rounded cable mouths, with a flush outside face. */
export function rearCableGrommetShape(p: Parameters): Shape {
  const rear = -n(p, 'shoulderLength'),
    front = rear + 6.6;
  const profile: [number, number][] = [
    [6, rear],
    [6, rear + 1.2],
    [4.3, rear + 4.6],
    [4.3, front],
    [6.2, front],
    [6.2, front + 2.4],
    [3.6, front + 2.4],
    [3, front + 1.2],
    [3, rear + 1.2],
    [3.6, rear],
  ];
  const rings = rearCableCenters.map(([x, y]): Shape => ({
    kind: 'transform',
    translation: [x, y, 0],
    rotation: [0, 0, 0],
    child: { kind: 'revolve', segments: 64, profile },
  }));
  return subtract(
    union(...rings, box([12.4, 16, 2.4], [-35.2, -8, front])),
    ...rearCableCenters.map(([x, y]) => cylinder(3, 9.2, [x, y, rear - 0.1])),
  );
}

/** Broad integral tie-slot anchors transfer future cable pull to the fixed frame. */
export function rearCableFrameAnchors(p: Parameters): Shape[] {
  const outer = (n(p, 'tubeID') - n(p, 'shoulderClearance')) / 2;
  return rearCableCenters.map(([, y]): Shape => ({
    kind: 'intersect',
    children: [
      subtract(
        union(box([9.2, 12, 10], [-41.4, y - 6, -75]), {
          kind: 'intersect',
          children: [
            box([9.2, 12, 8], [-41.4, y - 6, -82.8]),
            {
              kind: 'revolve',
              segments: 96,
              profile: [
                [outer, -82.8],
                [outer, -74.8],
                [outer - 11, -74.8],
                [outer - 3, -82.8],
              ],
            },
          ],
        }),
        union(
          cylinder(1.1, 12.4, [-35.3, y - 6.2, -70.9], 'y'),
          cylinder(1.1, 12.4, [-35.3, y - 6.2, -69.1], 'y'),
          box([2.2, 12.4, 1.8], [-36.4, y - 6.2, -70.9]),
        ),
      ),
      cylinder(outer, 17.8, [0, 0, -82.8]),
    ],
  }));
}

export function rearCableRoutingKeepouts(p: Parameters): Shape[] {
  const rear = -n(p, 'shoulderLength');
  return rearCableCenters.map(([x, y]) => cylinder(3, 114, [x, y, rear]));
}

export const rearCableRequirements = [
  'Two D6 clear cable passages have rounded TPU mouths and a flush rear face; they are not parachute hardpoints.',
  'Fit the selected bundle and connector, secure it through the fixed frame tie slots, and retain the service loop and accessible disconnect clear of the recovery harness.',
  'The parachute shackle belongs farther down the body tube. Route its load through that structure, not this removable cap, grommet or electronic carrier.',
  'Cable ties, cable diameters, connector lengths, bend radii, strain-relief force and pressure sealing remain installation inputs. No opening-shock rating is implied.',
];
