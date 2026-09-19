import type { Parameters } from '../../../core/types';
import type { Piece } from './visual-assembly';
import { cylinder, ring, union, type Shape, type Vec } from './shapes';
import { motion, cassetteTop, springDimensions, clamp } from './motion';
const rad = Math.PI / 180,
  metal = 0xb6c2ce,
  polymer = 0xe8e1ce,
  blue = 0x397ac2,
  orange = 0xe89145;
const place = (child: Shape, translation: Vec = [0, 0, 0], rotation: Vec = [0, 0, 0]): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation,
});
const xy = (r: number, a: number): [number, number] => [
  r * Math.cos(a * rad),
  r * Math.sin(a * rad),
];
const disk = (r: number, z: number, t: number) => cylinder(r, t, [0, 0, z]);
function path(points: Vec[], radius: number): Shape {
  return union(
    ...points.slice(1).map((b, i) => {
      const a = points[i],
        d = b.map((v, j) => v - a[j]),
        L = Math.hypot(...d);
      return place(cylinder(radius, L, [0, 0, 0]), a, [
        0,
        Math.atan2(Math.hypot(d[0], d[1]), d[2]) / rad,
        Math.atan2(d[1], d[0]) / rad,
      ]);
    }),
  );
}

export function fabric(p: Parameters, state: string): Piece[] {
  const out: Piece[] = [],
    q = motion(p, state),
    s = springDimensions(p);
  const add = (label: string, shape: Shape, color = metal) => out.push({ label, shape, color });
  const clothTravel = clamp(q.inflation / 0.4) * (+p.packLength + 110);
  const bottom = cassetteTop(p) - 8 - +p.packLength + q.lift + clothTravel;
  const mainInflation = clamp((q.inflation - 0.8) / 0.2),
    drogueInflation = clamp((q.inflation - 0.4) / 0.25);
  const canopy = (name: string, r: number, z: number, color: number) => {
    const h = r * 0.45;
    const profile: [number, number][] = [
      [r, z],
      [r * 0.94, z + h * 0.45],
      [r * 0.7, z + h * 0.83],
      [r * 0.3, z + h],
      [r * 0.08, z + h * 1.05],
      [r * 0.08, z + h * 1.05 - 0.6],
      [r * 0.3, z + h - 0.6],
      [r * 0.7, z + h * 0.83 - 0.6],
      [r * 0.94, z + h * 0.45 - 0.6],
      [r, z - 0.6],
    ];
    add(name + ' · schematic fabric shell', { kind: 'revolve', profile }, color);
    for (let i = 0; i < 8; i++)
      add(
        name + ` line ${i + 1} · routing envelope`,
        path(
          [
            [0, 0, z - 55],
            [...xy(r, i * 45), z],
          ],
          0.4,
        ),
        polymer,
      );
  };
  const mainLength = +p.packLength * 0.75;
  if (mainInflation === 0) {
    add(
      'Bundled main parachute · fabric · held for external altitude release',
      ring(+p.packDiameter / 2 - 1, 10, bottom + 1, mainLength - 2),
      orange,
    );
    for (const z of [bottom + 5, bottom + mainLength - 7])
      add(
        'Main retention band ' + z.toFixed(2) + ' · fabric routing envelope',
        ring(+p.packDiameter / 2, +p.packDiameter / 2 - 0.6, z, 2),
        blue,
      );
  } else
    canopy(
      'Main parachute',
      (+p.packDiameter / 2) * (1 - mainInflation) + (+p.canopyDiameter / 2) * mainInflation,
      bottom,
      orange,
    );
  if (drogueInflation === 0)
    add(
      'Packed drogue · fabric',
      ring(+p.packDiameter / 2 - 1, 10, bottom + mainLength + 1, +p.packLength - mainLength - 2),
      0x668d76,
    );
  else
    canopy(
      'Drogue parachute',
      (+p.drogueDiameter / 2) * drogueInflation + 8 * (1 - drogueInflation),
      bottom + mainLength + 160,
      0x668d76,
    );
  if (q.inflation === 0)
    add(
      'Deployment bag · fabric sleeve',
      ring(+p.packDiameter / 2, +p.packDiameter / 2 - 0.5, bottom, +p.packLength),
      0x668d76,
    );
  add(
    'Body tether stopper knot · schematic · qualify knot and cord strength',
    ring(6, 2, s.seat - 10, 4),
    0xceae72,
  );
  const anchorZ = cassetteTop(p) - 19 + q.noseLift;
  const lower: Vec[] = [
    [0, 0, s.seat - 9],
    [0, 0, s.seat + 2],
  ];
  add(
    'Central body-to-nose paracord · D4 routing envelope · terminate around rounded eyes',
    path([...lower, [0, 0, cassetteTop(p) + q.lift - 21], [q.noseX, 0, anchorZ]], 2),
    0xceae72,
  );
  if (q.inflation > 0)
    add('Main riser · central routing envelope', path([...lower, [0, 0, bottom - 55]], 2), polymer);
  if (drogueInflation > 0)
    add(
      'Drogue-to-main bridle · routing envelope',
      path(
        [
          [0, 0, bottom + mainLength + 105],
          [0, 0, bottom + mainLength + 10],
        ],
        0.6,
      ),
      polymer,
    );
  return out;
}
