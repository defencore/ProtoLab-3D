import type { Parameters } from '../../../core/types';
import { cylinder, subtract, type Shape } from '../../../core/assembly/boundary/shapes';
import {
  isDual,
  parallelHostOpening,
  parallelPanelInterface,
  roundedPlate,
} from './parallel-installation';
import type { DetailSpec } from './types';

/** Matching recesses are exactly the nominal gasket depth; no compression is simulated. */
export function parallelPanelGasketPocket(p: Parameters): Shape {
  const panel = parallelPanelInterface(p);
  return subtract(
    roundedPlate(
      Number(p.baseLength) - 1.6,
      Number(p.baseWidth) - 1.6,
      3.2,
      panel.flangeCentre,
      -0.1,
      0.9,
    ),
    parallelHostOpening(p, -0.2, 1.2, 0.2),
    ...panel.mountingHoles.map(([x, y]) => cylinder(5.5, 1.2, [x, y, -0.2])),
  );
}

export const parallelSwitchGasketPocket = () => roundedPlate(32.4, 24.4, 2.2, [0, 0], -0.1, 0.9);
export const parallelManualSwitchGasketPocket = () =>
  roundedPlate(32.4, 24.4, 2.2, [0, -90], -0.1, 0.9);

export function parallelGasketDetails(p: Parameters): DetailSpec[] {
  const panel = parallelPanelInterface(p),
    thickness = panel.gasketThickness;
  return [
    {
      id: 'parallel-switch-gasket',
      label: 'TPU switch case-seat gasket',
      shape: subtract(
        roundedPlate(32, 24, 2, [0, 0], 0, thickness),
        cylinder(10.6, thickness + 2, [0, 0, -1]),
      ),
      color: 0x3e565c,
      material: 'TPU; verify the printed sheet thickness and fit',
      blank: '32 × 24 × 0.8 mm frame, R2 outside corners, diameter 21.2 mm centre clearance',
      processes: ['printing'],
      requirements: [
        'Print flat at nominal 0.8 mm thickness. Fit into the matching 0.8 mm recess without forcing the rigid parts apart; no compressed shape or sealing rating is modeled.',
        'The frame cushions the switch case end regions outside the lower M12 nut relief. The rigid 3 mm nut-clamping web and keyed bushing remain unchanged; the PETG body pocket limits rotation.',
      ],
    },
    {
      id: 'parallel-panel-gasket',
      label: 'TPU mounting-panel gasket',
      shape: subtract(
        roundedPlate(
          Number(p.baseLength) - 2,
          Number(p.baseWidth) - 2,
          3,
          panel.flangeCentre,
          0,
          thickness,
        ),
        parallelHostOpening(p, -1, thickness + 2, 0.4),
        ...panel.mountingHoles.map(([x, y]) => cylinder(6, thickness + 2, [x, y, -1])),
      ),
      color: 0x3e565c,
      material: 'TPU; verify the printed sheet thickness and fit',
      blank: `${Number(p.baseLength) - 2} × ${Number(p.baseWidth) - 2} × 0.8 mm frame with terminal-access notch and M4 land clearances`,
      processes: ['printing'],
      requirements: [
        'Print flat at nominal 0.8 mm thickness. The recessed gasket finishes flush at the host mounting plane; its thickness is not an assumed compression or force model.',
        'Diameter 12 mm openings leave clearance around the rigid diameter 11 mm PETG M4 seats. Bolt loads seat on the rigid carrier so TPU creep does not define mechanism alignment.',
        isDual(p)
          ? 'Keep the enlarged centre opening and both left terminal notches clear. This wider panel frame remains one piece around both switches; no environmental sealing rating is assigned.'
          : 'Keep the enlarged centre opening and left terminal notch clear. The frame is open on the left for the minimum flange size and remains one piece; no environmental sealing rating is assigned.',
      ],
    },
    ...(isDual(p)
      ? [
          {
            id: 'parallel-manual-gasket',
            label: 'TPU manual-switch case-seat gasket',
            shape: subtract(
              roundedPlate(32, 24, 2, [0, -90], 0, thickness),
              cylinder(6.3, thickness + 2, [0, -90, -1]),
            ),
            color: 0x3e565c,
            material: 'TPU; verify the printed sheet thickness and fit',
            blank: '32 × 24 × 0.8 mm frame, R2 outside corners, diameter 12.6 mm centre clearance',
            processes: ['printing'] as DetailSpec['processes'],
            requirements: [
              'Print flat at nominal 0.8 mm thickness and fit the matching recess flush. The fixed source mounting stack is not translated or compressed in this model.',
              'The manual switch case face at Z0 reacts against the carrier up to the lower SAC-01 adjustment nut at Z6.8. Fit the actual bushing, guard height and printed stack; the guard installation height is illustrative.',
            ],
          },
        ]
      : []),
  ];
}
