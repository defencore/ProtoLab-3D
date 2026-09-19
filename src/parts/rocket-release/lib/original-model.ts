import type { Parameters } from '../../../core/types';
import modeling from '@jscad/modeling';
import type { Piece } from './assembly';
import {
  box,
  cylinder,
  ring,
  plate,
  circle,
  union,
  subtract,
  transform,
  type Shape,
  type Point,
} from './shapes';
import { profile } from './gears';
import { at, layout, rad } from './motion';
import { servoPieces, servoMounts, spindle, spindleScrew, dBore } from './micro-servo';

export function sector(inner: number, outer: number, start: number, end: number): Point[] {
  const steps = Math.max(8, Math.ceil(Math.abs(end - start) * 2));
  return [
    ...Array.from({ length: steps + 1 }, (_, i) => at(outer, start + ((end - start) * i) / steps)),
    ...Array.from({ length: steps + 1 }, (_, i) => at(inner, end - ((end - start) * i) / steps)),
  ];
}
/** Eight fixed studs enter the large holes only when the ring finishes turning. */
export const studAngles = Array.from({ length: 8 }, (_, i) => 22.5 + i * 45);
export function keyhole(p: Parameters, angle: number): Point[] {
  const r = layout(p).lockRadius,
    start = angle - +p.unlockAngle;
  const [x, y] = at(r, start),
    [sx, sy] = at(r, angle);
  const { primitives: primitive, booleans, geometries } = modeling;
  const shape = booleans.union(
    primitive.polygon({ points: sector(r - 1.6, r + 1.6, start, angle) }),
    primitive.circle({ radius: 3.05, center: [x, y], segments: 120 }),
    primitive.circle({ radius: 1.6, center: [sx, sy], segments: 64 }),
  );
  return geometries.geom2.toOutlines(shape)[0] as Point[];
}
export function originalPieces(p: Parameters, state: string): Piece[] {
  const m = layout(p),
    R = m.radius;
  const alloy = 0xc6cdd5,
    steel = 0x929eac,
    polymer = 0xe8e4d9,
    dark = 0x303a47,
    brass = 0xb99450;
  const result: Piece[] = [];
  const add = (label: string, shape: Shape, color = alloy) => result.push({ label, shape, color });
  const moving = (shape: Shape) => transform(shape, m.angle, [0, 0, m.lift]);
  const axes = [0, 90, 180, 270];
  const springs = axes.map((a) => at(m.lockRadius, a));
  const drives = axes.map((a) => at(m.driveRadius, a));
  const motorMounts = (m.centralServo ? [] : axes).flatMap((a) =>
    [-3, 3].map((t) => {
      const [x, y] = at(m.driveRadius, a);
      return [x - t * Math.sin(a * rad), y + t * Math.cos(a * rad)] as Point;
    }),
  );
  const radialHoles = (z: number) =>
    axes.map((a) => transform(cylinder(1.1, 10, [R - 4, 0, z], 'x'), a + 45));
  const cut = box([R + 8, R + 8, 150], [0, 0, -25]);
  if (state !== 'mechanism') {
    const carrier: [string, Shape][] = [
      [
        'Fixed windowed carrier',
        subtract(
          ring(R, R - 2.5, 8, 36),
          ...axes.map((a) => transform(box([2 * R, R * 1.12, 27], [0, -R * 0.56, 12]), a)),
        ),
      ],
      [
        m.centralServo ? 'Lower carrier deck' : 'Lower motor mounting deck',
        subtract(
          plate(
            circle(R),
            [circle(10), ...motorMounts.map(([x, y]) => circle(1.05, x, y, 32))],
            5,
            3,
          ),
          ...radialHoles(7),
        ),
      ],
      [
        'Spring seat deck',
        plate(
          circle(R - 2.5),
          [circle(m.lockRadius - 4), ...springs.map(([x, y]) => circle(1.1, x, y, 32))],
          36,
          2,
        ),
      ],
      [
        'Upper shaft and retaining-stud deck',
        plate(
          circle(R),
          [
            circle(m.centralServo ? 3.1 : Math.max(10, m.driveRadius - 5)),
            ...(m.centralServo ? servoMounts.map(([x, y]) => circle(1.05, x, y, 32)) : []),
            ...drives.map(([x, y]) => circle(3.1, x, y, 48)),
            ...springs.map(([x, y]) => circle(3.2, x, y, 48)),
            ...studAngles.map((a) => {
              const [x, y] = at(m.lockRadius, a);
              return circle(1.45, x, y, 32);
            }),
          ],
          44,
          2,
        ),
      ],
    ];
    for (const [label, shape] of carrier)
      add(label, state === 'cutaway' ? subtract(shape, cut) : shape);
  }

  // The upper sleeve is bolted to the rotating disk; all its parts share one rigid motion.
  const sleeveMounts = axes.map((a) => at(R - 1.5, a + 45));
  const sleeveHoles = sleeveMounts.map(([x, y]) => circle(0.85, x, y, 32));
  const disk = plate(
    circle(R),
    [profile(m.module, m.ringTeeth, true), ...studAngles.map((a) => keyhole(p, a)), ...sleeveHoles],
    48,
    3,
  );
  add('Rotating release disk', moving(state === 'cutaway' ? subtract(disk, cut) : disk));
  const sleeve = subtract(
    plate(circle(R), [circle(R - 3), ...sleeveHoles], 51, 13),
    ...radialHoles(60),
  );
  add('Upper tube sleeve', moving(state === 'cutaway' ? subtract(sleeve, cut) : sleeve));
  for (const [i, [x, y]] of sleeveMounts.entries())
    add(
      `Sleeve mounting screw ${i + 1}`,
      moving(union(cylinder(0.8, 7.4, [x, y, 47.6]), cylinder(1.35, 1.2, [x, y, 46.4]))),
      steel,
    );

  for (const [i, a] of studAngles.entries()) {
    const [x, y] = at(m.lockRadius, a);
    const head = subtract(
      cylinder(2.7, 1.6, [x, y, 51.1]),
      plate(circle(1.15, x, y, 6), [], 51.6, 2),
    );
    add(
      `Retaining shoulder stud ${i + 1} · fixed`,
      union(cylinder(1.4, 7.1, [x, y, 44]), head),
      steel,
    );
  }
  if (m.centralServo) result.push(...servoPieces(p));
  for (const [i, a] of axes.entries()) {
    const [x, y] = drives[i];
    const angle = m.pinionAngle + a * (1 - m.ringTeeth / m.pinionTeeth);
    if (m.centralServo) {
      add(`Idler spindle ${i + 1}`, transform(spindle(true), angle, [x, y, 0]), steel);
      add(
        `Idler pinion ${i + 1} · 40 teeth`,
        transform(subtract(plate(profile(m.module, 40), [], 48, 3), dBore(47, 5)), angle, [
          x,
          y,
          0,
        ]),
        polymer,
      );
      add(
        `Idler pinion retaining screw ${i + 1}`,
        transform(spindleScrew(), angle, [x, y, 0]),
        steel,
      );
    } else {
      const mounting = motorMounts
        .slice(i * 2, i * 2 + 2)
        .map(([bx, by]) => cylinder(1.05, 3, [bx, by, 7]));
      add(
        `Gearmotor ${i + 1} · cylindrical body`,
        subtract(cylinder(m.motorRadius, 24, [x, y, 8]), ...mounting),
        dark,
      );
      add(`Gearmotor ${i + 1} · reduction housing`, cylinder(m.motorRadius, 11, [x, y, 32]), alloy);
      const shaft = subtract(cylinder(1.5, 9, [0, 0, 43]), box([3, 4, 11], [1.1, -2, 42]));
      add(`Gearmotor ${i + 1} · D output shaft`, transform(shaft, angle, [x, y, 0]), steel);
      const gear = subtract(plate(profile(m.module, 20), [], 48, 3), dBore(47, 5));
      add(`Drive pinion ${i + 1} · 20 teeth`, transform(gear, angle, [x, y, 0]), polymer);
      add(`Pinion retaining cap ${i + 1}`, ring(2.2, 1.55, 51.15, 0.8, x, y), steel);
      for (const [j, [bx, by]] of motorMounts.slice(i * 2, i * 2 + 2).entries()) {
        add(
          `Gearmotor ${i + 1} mounting screw ${j + 1}`,
          union(cylinder(1, 6, [bx, by, 4]), cylinder(1.8, 1.4, [bx, by, 2.6])),
          steel,
        );
        add(`Gearmotor ${i + 1} mounting washer ${j + 1}`, ring(2, 1.05, 4, 1, bx, by), steel);
      }
    }
    add(
      `Output shaft bushing ${i + 1}`,
      union(ring(3, 1.55, 44, 2, x, y), ring(3.6, 1.55, 46, 1.8, x, y)),
      brass,
    );
    const [sx, sy] = springs[i],
      expansion = m.springExpansion;
    add(`Spring guide sleeve ${i + 1}`, ring(1.8, 1.05, 38, 7.5, sx, sy), brass);
    add(
      `Compression spring ${i + 1}`,
      {
        kind: 'spring',
        radius: 2.5,
        wire: 0.6,
        height: 8.6 + expansion,
        turns: 6,
        origin: [sx, sy, 38.3],
      },
      steel,
    );
    // The integral lower head stops below the spring-seat deck at full extension.
    const stop = 35.2 - +p.springTravel + expansion;
    add(
      `Captive spring pusher ${i + 1}`,
      union(
        cylinder(1, 47.3 + expansion - stop, [sx, sy, stop]),
        cylinder(3, 0.8, [sx, sy, 47.2 + expansion]),
        cylinder(1.7, 0.8, [sx, sy, stop]),
      ),
      steel,
    );
  }
  if (state === 'assembled' || state === 'cutaway') {
    const lower = subtract(ring(+p.tubeOD / 2, +p.tubeID / 2, -15, 25), ...radialHoles(7));
    const upper = subtract(ring(+p.tubeOD / 2, +p.tubeID / 2, 54, 32), ...radialHoles(60));
    add('Lower tube section', state === 'cutaway' ? subtract(lower, cut) : lower, dark);
    add(
      'Released upper tube section',
      moving(state === 'cutaway' ? subtract(upper, cut) : upper),
      dark,
    );
    for (const [i, a] of axes.entries())
      for (const z of [7, 60]) {
        const bolt = transform(
          union(
            cylinder(1, +p.tubeOD / 2 - R + 3, [R - 3, 0, z], 'x'),
            cylinder(1.8, 1.5, [+p.tubeOD / 2, 0, z], 'x'),
          ),
          a + 45,
        );
        add(
          `${z === 7 ? 'Lower' : 'Upper'} tube screw ${i + 1}`,
          z === 7 ? bolt : moving(bolt),
          steel,
        );
      }
  }
  return result;
}
