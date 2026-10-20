import type { Parameters } from '../../../core/types';
import { cylinder, subtract } from '../../../core/assembly/boundary/shapes';
import {
  isDual,
  parallelHostOpening,
  parallelPanelInterface,
  roundedPlate,
} from './parallel-installation';
import type { DetailSpec } from './types';

/** Separate flat sheets sit below a flat carrier; no recessed seats or compression. */
export function parallelGasketDetails(p: Parameters): DetailSpec[] {
  const panel = parallelPanelInterface(p),
    thickness = panel.gasketThickness;
  return [
    {
      id: 'parallel-switch-gasket',
      label: 'TPU switch case-seat gasket',
      shape: subtract(
        roundedPlate(28, 16, 1, [0, 0], 0, thickness),
        cylinder(6.3, thickness + 2, [0, 0, -1]),
      ),
      color: 0x3e565c,
      material: 'TPU; verify the printed sheet thickness and fit',
      blank: '28 × 16 × 0.8 mm frame, R1 outside corners, diameter 12.6 mm centre clearance',
      processes: ['printing'],
      requirements: [
        'Print flat at nominal 0.8 mm thickness and place against the flat carrier underside at Z0.8. No pocket, compressed shape or sealing rating is modeled.',
        'The switch case remains at Z0. Remove its lower washer and nut; the upper nut meets the flat 6 mm carrier at Z6.8. The PETG body pocket limits rotation.',
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
        ...panel.mountingHoles.map(([x, y]) => cylinder(2.5, thickness + 2, [x, y, -1])),
      ),
      color: 0x3e565c,
      material: 'TPU; verify the printed sheet thickness and fit',
      blank: `${Number(p.baseLength) - 2} × ${Number(p.baseWidth) - 2} × 0.8 mm frame with terminal-access notch and diameter 5 mm M4 clearances`,
      processes: ['printing'],
      requirements: [
        'Print flat at nominal 0.8 mm thickness. Place between the host top at Z0 and the flat PETG underside at Z0.8; no recess or compressed shape is modeled.',
        'Diameter 5 mm openings clear the separate M4 fasteners. TPU is present beneath the mounting areas; fit the actual sheet thickness and account for creep when tightening enclosure hardware.',
        isDual(p)
          ? 'Keep the enlarged centre opening and both right terminal notches clear. This wider panel frame remains one piece around both switches; no environmental sealing rating is assigned.'
          : 'Keep the enlarged centre opening and right terminal notch clear. The frame is open on the right for the minimum flange size and remains one piece; no environmental sealing rating is assigned.',
      ],
    },
    ...(isDual(p)
      ? [
          {
            id: 'parallel-manual-gasket',
            label: 'TPU manual-switch case-seat gasket',
            shape: subtract(
              roundedPlate(28, 16, 1, [0, -90], 0, thickness),
              cylinder(6.3, thickness + 2, [0, -90, -1]),
            ),
            color: 0x3e565c,
            material: 'TPU; verify the printed sheet thickness and fit',
            blank: '28 × 16 × 0.8 mm frame, R1 outside corners, diameter 12.6 mm centre clearance',
            processes: ['printing'] as DetailSpec['processes'],
            requirements: [
              'Print flat at nominal 0.8 mm thickness and place against the flat carrier underside at Z0.8. The fixed source mounting stack is not translated or compressed.',
              'The manual switch case face at Z0 reacts through the TPU sheet and 6 mm carrier up to the lower SAC-01 adjustment nut at Z6.8. Fit the actual bushing, guard height and printed stack; the guard installation height is illustrative.',
            ],
          },
        ]
      : []),
  ];
}
