import type { Parameters } from '../../../core/types';
import { box, cylinder, subtract } from './shapes';
import type { Piece } from './assembly';
export function cylinderSpec(p: Parameters) {
  const large = Number(p.bore) === 50,
    stroke = Number(p.stroke);
  return {
    bore: large ? 50 : 32,
    rod: large ? 16 : 12,
    width: large ? 65.5 : 49.5,
    body: (large ? 45.5 : 44) + stroke,
    projection: large ? 8 : 7,
    stroke,
    extension: Number(p.extension),
    mountPitch: large ? 46.5 : 32.5,
    mountHole: large ? 5.5 : 4.5,
    thread: large ? 'M10x1.5' : 'M8x1.25',
    tapRadius: large ? 4.25 : 3.4,
    tapDepth: large ? 20 : 16,
  };
}
export function cylinderPieces(p: Parameters): Piece[] {
  const s = cylinderSpec(p),
    b = s.width / 2,
    q = s.mountPitch / 2;
  const holes = [-q, q].flatMap((x) =>
    [-q, q].map((y) => cylinder(s.mountHole / 2, s.body + 2, [x, y, -1])),
  );
  const body = subtract(
    box([s.width, s.width, s.body - 20], [-b, -b, 10]),
    cylinder(s.rod / 2 + 0.05, s.body + 2, [0, 0, -1]),
    ...holes,
    ...[7.5, s.body - 7.5].map((z) =>
      cylinder(4.25, 9, [b - 8, -3, z], 'x', { pitch: 0.907, internal: true }),
    ),
    ...[-1, 1].map((sign) => box([3, 5, s.body - 22], [sign < 0 ? -b - 1 : b - 2, -2.5, 11])),
  );
  return [
    ...[0, s.body - 10].map((z) => ({
      label: `ACE${s.bore} machined end cap ${z}`,
      color: 0x748694,
      shape: subtract(
        box([s.width, s.width, 10], [-b, -b, z]),
        cylinder(s.rod / 2 + 0.05, 12, [0, 0, z - 1]),
        ...holes,
        ...[7.5, s.body - 7.5].map((zz) =>
          cylinder(4.25, 9, [b - 8, -3, zz], 'x', { pitch: 0.907, internal: true }),
        ),
      ),
    })),
    {
      label: 'Front rod wiper and guide gland',
      color: 0x28313a,
      shape: subtract(
        cylinder(s.rod / 2 + 2, 1, [0, 0, s.body - 1]),
        cylinder(s.rod / 2 + 0.02, 3, [0, 0, s.body - 2]),
      ),
    },
    {
      label: `BUY AirTAC ACE${s.bore}X${s.stroke}SG · magnetic · body · four D${s.mountHole} through bores P${s.mountPitch} · G1/8 ports`,
      color: 0xaebcc9,
      shape: body,
    },
    {
      label: `ACE${s.bore} rod · D${s.rod} · female ${s.thread} depth${s.tapDepth} nominal bore`,
      color: 0xdce0e3,
      shape: subtract(
        cylinder(s.rod / 2, s.body + s.projection + s.extension, [0, 0, 0]),
        cylinder(
          s.tapRadius,
          s.tapDepth,
          [0, 0, s.body + s.projection + s.extension - s.tapDepth],
          'z',
          { pitch: s.bore === 50 ? 1.5 : 1.25, internal: true },
        ),
      ),
    },
  ];
}
