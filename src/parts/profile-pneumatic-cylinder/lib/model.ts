import type { Parameters } from '../../../core/types';
import type { Piece } from '../../../core/assembly/boundary/assembly';
import { box, cylinder, subtract, type Shape } from '../../../core/assembly/boundary/shapes';
/** The exterior preserves the adopted saw shell; it is not the source extrusion or a pressure vessel model. */
export function pieces(p: Parameters): Piece[] {
  const extension = Number(p.extension);
  const fixing = [-27, 27].flatMap((x) => [-27, 27].map((y) => cylinder(4.2, 620, [x, y, 29])));
  const port = (z: number): Shape => ({
    kind: 'cylinder',
    radius: 7.55,
    height: 14,
    origin: [24, 0, z + 10],
    axis: 'x',
    thread: { pitch: 1.337, internal: true, designation: 'G3/8 nominal installation envelope' },
  });
  return [
    {
      label: 'Profile barrel shell · unresolved exterior',
      color: 0xb4bec8,
      shape: subtract(
        box([75, 75, 578], [-37.5, -37.5, 50]),
        cylinder(31.5, 580, [0, 0, 49]),
        ...fixing,
      ),
    },
    ...[30, 628].map((z): Piece => ({
      label: `End cap ${z === 30 ? 'rear' : 'front'} · fit reference`,
      color: 0x536675,
      shape: subtract(
        box([75, 75, 20], [-37.5, -37.5, z]),
        cylinder(z === 30 ? 0.1 : 10.2, 22, [0, 0, z - 1]),
        ...fixing,
        port(z),
      ),
    })),
    {
      label: 'Rod · inherited diameter and closed-position datum',
      color: 0xb4bec8,
      shape: cylinder(10, 607, [0, 0, 68 + extension]),
    },
    {
      label: 'M16×1.5 rod-end envelope',
      color: 0xb4bec8,
      shape: {
        kind: 'cylinder',
        radius: 8,
        height: 15,
        origin: [0, 0, 675 + extension],
        axis: 'z',
        thread: { pitch: 1.5 },
      },
    },
  ];
}
