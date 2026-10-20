import type { Parameters } from '../../../core/types';
import { box, cylinder, subtract, union, type Shape } from '../../../core/assembly/boundary/shapes';
import type { Piece } from '../../../core/assembly/boundary/assembly';
import { encoderSpec } from './specs';

export function encoderPieces(p: Parameters): Piece[] {
  const s = encoderSpec(p),
    role = String(p.component),
    shift = Number(p.headPosition);
  if (s.kind === 'spar') {
    const holes = s.sparMounts.flatMap((hole) => [
      cylinder(
        hole.diameter / 2,
        s.sparDepth + 2,
        [hole.position[0], s.sparBackY - 1, hole.position[2]],
        'y',
      ),
      cylinder(
        hole.counterboreDiameter! / 2,
        hole.counterboreDepth! + 1,
        [hole.position[0], hole.seatY!, hole.position[2]],
        'y',
      ),
    ]);
    return [
      {
        label: s.designation + ' / nominal spar profile and illustrative clamp envelopes',
        color: 0xb9c5cb,
        shape: subtract(
          union(
            box(
              [s.sparLength, s.sparDepth, s.sparHeight],
              [-s.sparLength / 2, s.sparBackY, s.sparBottomZ],
            ),
            ...s.sparClampCenters.map((x) => box([12, 2.55, 3], [x - 6, -2.55, 0])),
          ),
          ...holes,
        ),
      },
    ];
  }
  const pieces: Piece[] = [];
  if (role !== 'readhead') {
    const holes: Shape[] = s.scaleMounts.flatMap((hole) => [
      cylinder(hole.diameter / 2, s.bodyDepth + 2, [hole.position[0], -1, hole.position[2]], 'y'),
      cylinder(
        hole.counterboreDiameter! / 2,
        6,
        [hole.position[0], s.bodyDepth - 5, hole.position[2]],
        'y',
      ),
    ]);
    pieces.push({
      label: s.designation + ' / supplied housing; nominal external section',
      color: 0xbcc5cb,
      shape: subtract(
        box([s.scaleLength, s.bodyDepth, s.bodyHeight], [-s.scaleLength / 2, 0, 0]),
        ...holes,
      ),
    });
  }
  if (role !== 'scale') {
    const left = s.readheadLeftX + shift;
    const holes: Shape[] = s.readheadMounts.flatMap((hole) => [
      cylinder(hole.diameter / 2, 20, [hole.position[0] + shift, -1.25, hole.position[2]], 'y'),
      cylinder(
        hole.counterboreDiameter! / 2,
        4,
        [hole.position[0] + shift, 15.25, hole.position[2]],
        'y',
      ),
    ]);
    // The published mounting centers and envelopes are retained. Local flange contours,
    // sealing lips and socket details are explicitly nominal, not supplier internal CAD.
    const body = union(
      box([s.readheadBodyLength, s.readheadDepth, 12], [left, s.readheadRearY, -13]),
      ...s.readheadMounts.map((hole) =>
        box([10, s.readheadDepth, 1], [hole.position[0] + shift - 5, s.readheadRearY, -1]),
      ),
    );
    pieces.push({
      label: s.designation + ' / supplied readhead; source mounting centers',
      color: 0x3e454b,
      shape: subtract(body, ...holes),
    });
    pieces.push({
      label: s.designation + ' / supplied 14-pin socket; nominal external envelope',
      color: 0x9ca8b1,
      shape: subtract(
        cylinder(6, 17.5, [left + s.readheadBodyLength, 9.25, -6.5], 'x'),
        ...Array.from({ length: 14 }, (_, i) => {
          const angle = (i * Math.PI * 2) / 14;
          return cylinder(
            0.45,
            2,
            [
              left + s.readheadOverallLength - 1,
              9.25 + 3.8 * Math.cos(angle),
              -6.5 + 3.8 * Math.sin(angle),
            ],
            'x',
          );
        }),
      ),
    });
  }
  return pieces;
}
