import { wingLayout } from './wing-layout';
import { wingDeck, wingPieces } from './wing-package';
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
  rotate,
  type Shape,
  type Point,
} from './shapes';
import { servoTiePosts, servoRetention } from './servo-retention';
import { springCartridges } from './cartridges';
import { named } from './names';
import { batteryPieces } from './recovery';
import { electronicsPieces } from './electronics';
import { noseSupport, noseWalls, noseRadialBolts } from './nose-support';
import { batteryPosts } from './balance';
import { screw, matingHole, radialScrew, flatSeat } from './hardware';
import { profile } from './gears';
import { gearCarrier, capPosts, gearCapZ, gearSeatZ } from './gear-carrier';
import { at, layout, springAngles } from './motion';
import { servoPieces, servoMounts } from './servo';

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
export function st3215Pieces(p: Parameters, state: string): Piece[] {
  const wing = p.drive === 'wing-mini-nose';
  const wd = wing ? wingDeck(p) : undefined;
  const m = layout(p),
    R = m.radius;
  const alloy = 0xc6cdd5,
    steel = 0x929eac,
    polymer = 0xe8e4d9,
    dark = 0x303a47;
  const result: Piece[] = [];
  const add = (label: string, shape: Shape, color = alloy) => result.push({ label, shape, color });
  const moving = (shape: Shape) => transform(shape, m.angle, [0, 0, m.lift]);
  const axes = [0, 90, 180, 270];
  const springs = springAngles.map((a) => at(m.lockRadius, a));
  const drives = axes.map((a) => at(m.driveRadius, a));
  const radialBolt = (z: number, a: number) =>
    transform(rotate(radialScrew(+p.tubeOD / 2, R).shape, 90, 'y'), a + 45, [
      ...at(radialScrew(+p.tubeOD / 2, R).tipRadius, a + 45),
      z,
    ]);
  const studs = studAngles.map((a) => {
    const [x, y] = at(m.lockRadius, a);
    return transform(
      screw(2.5, 7.1, { shoulder: 2.8, threadLength: 2, headDiameter: 5.4, headHeight: 1.6 }),
      0,
      [x, y, 44],
    );
  });
  const cut = box([R + 8, R + 8, 250], [0, 0, wing ? wingLayout(p).noseBottom - 1 : -25]);
  if (state !== 'mechanism') {
    const deckPlate = plate(
      circle(R),
      [
        circle(4.1),
        ...(wd
          ? wd.holes
          : [
              ...servoMounts.map(([x, y]) => circle(0.85, x, y)),
              ...servoTiePosts.map(([x, y]) => circle(1.1, x, y)),
            ]),
        ...(m.batteries ? batteryPosts(R).map(([x, y]) => circle(1.1, x, y)) : []),
      ],
      44,
      2,
    );
    if (deckPlate.kind !== 'plate') throw new Error('Expected disk section');
    const threadHoles = [
      ...springs.map(([x, y]) => ({
        x,
        y,
        z: 44,
        diameter: 8,
        pitch: 0.75,
        length: 3.5,
        clearance: 0.04,
        internal: true,
      })),
      ...studAngles.map((a) => {
        const [x, y] = at(m.lockRadius, a);
        return {
          x,
          y,
          z: 44,
          diameter: 2.5,
          pitch: 0.45,
          length: 2,
          clearance: 0.04,
          internal: true,
        };
      }),
    ];
    const threaded = (base: Shape, holes: typeof threadHoles): Shape => {
      if (base.kind !== 'plate') throw new Error('Expected layer');
      const layer: Shape = { kind: 'threadedPlate', plate: base, holes };
      return layer;
    };
    const deckLayers: Shape[] = [
      threaded({ ...deckPlate, height: 1 }, threadHoles),
      threaded(
        {
          ...deckPlate,
          z: 45,
          height: 1,
          holes: [...deckPlate.holes, ...drives.map(([x, y]) => circle(1.52, x, y))],
        },
        threadHoles,
      ),
      ...noseWalls(p),
      ...(wd?.bosses ?? []),
      ...drives.map(([x, y]) =>
        threaded(plate(circle(3.2, x, y), [circle(1.52, x, y)], 46, gearSeatZ - 46), []),
      ),
      ...springs.map(([x, y], i) =>
        threaded(plate(circle(5, x, y), [], 46, 1.5), [threadHoles[i]]),
      ),
      ...capPosts(p).flatMap(([x, y]) => [
        threaded(plate(circle(2.6, x, y), [], 46, 1.15), []),
        threaded(plate(circle(2.6, x, y), [], 47.15, gearCapZ - 47.15), [
          { x, y, z: 47.15, diameter: 2, pitch: 0.4, length: 4, clearance: 0.04, internal: true },
        ]),
      ]),
    ];
    const deck: Shape = {
      kind: 'fusedLayers',
      children: deckLayers,
      planes: [44, 45, 46, 47.15],
      solid: union(...deckLayers),
    };
    add(
      'Nose servo and gear mounting disk · Al6061 · web t2 · integral curved walls h10 wall3, axle seats and four cap posts · M8×0.75×3.5',
      deck,
    );
  }
  const bodyMountRows = [57, 75];
  const disk = plate(
    circle(R),
    [profile(m.module, m.ringTeeth, true), ...studAngles.map((a) => keyhole(p, a))],
    48,
    3,
  );
  const threadedRimBand = (z: number) =>
    subtract(
      plate(circle(R), [circle(R - 3)], z - 2, 4),
      ...axes.map((a) => matingHole(radialBolt(z, a))),
    );
  const carrierLayers: Shape[] = [
    disk,
    plate(circle(R), [circle(R - 3)], 51, 4),
    threadedRimBand(57),
    plate(circle(R), [circle(R - 3)], 59, 14),
    threadedRimBand(75),
    plate(circle(R), [circle(R - 3)], 77, 4),
  ];
  const bodySolid = subtract(
    union(disk, plate(circle(R), [circle(R - 3)], 51, 30)),
    ...bodyMountRows.flatMap((z) => axes.map((a) => matingHole(radialBolt(z, a)))),
  );
  const bodyCarrier: Shape = {
    kind: 'fusedLayers',
    planes: [51, 55, 59, 73, 77],
    solid: state === 'cutaway' ? subtract(bodySolid, cut) : bodySolid,
    children: state === 'cutaway' ? carrierLayers.map((s) => subtract(s, cut)) : carrierLayers,
  };
  add(
    `Body locking ring · integral machined rim h30 wall3 · Al6061 · z${m.ringTeeth} · m${m.module.toFixed(4)} · 20° · web t3`,
    moving(bodyCarrier),
  );

  studs.forEach((stud, i) =>
    add(
      `Retaining shoulder stud ${i + 1} · nose-side · M2.5×0.45 · shoulder Ø2.8×5.1`,
      stud,
      steel,
    ),
  );
  for (const [i, a] of axes.entries()) {
    const [x, y] = drives[i];
    const angle = m.pinionAngle + a * (1 - m.ringTeeth / m.pinionTeeth);
    add(
      `Idler pinion ${i + 1} · POM · 40 teeth · m${m.module.toFixed(4)} · 20° · t3 · plain bore Ø3.1`,
      transform(plate(profile(m.module, 40), [circle(1.55)], 48, 3), angle, [x, y, 0]),
      polymer,
    );
  }
  result.push(...gearCarrier(p));
  result.push(...springCartridges(p, state));
  if (state === 'assembled' || state === 'cutaway') {
    const nose = subtract(
      ring(
        +p.tubeOD / 2,
        +p.tubeID / 2,
        wing ? wingLayout(p).noseBottom : -2 - m.stackOffset - (m.batteries ? 25 : 0),
        wing
          ? 48 - +p.tubeSeam / 2 - wingLayout(p).noseBottom
          : 50 - +p.tubeSeam / 2 + m.stackOffset + (m.batteries ? 25 : 0),
      ),
      ...noseRadialBolts(p).map(flatSeat),
    );
    const body = subtract(
      ring(+p.tubeOD / 2, +p.tubeID / 2, 48 + +p.tubeSeam / 2, 36 - +p.tubeSeam / 2),
      ...bodyMountRows.flatMap((z) => axes.map((a) => flatSeat(radialBolt(z, a)))),
    );
    add(
      'Nose tube section · travels with servo',
      state === 'cutaway' ? subtract(nose, cut) : nose,
      dark,
    );
    add(
      'Main body tube section · retained',
      moving(state === 'cutaway' ? subtract(body, cut) : body),
      dark,
    );
    bodyMountRows.forEach((z, row) =>
      axes.forEach((a, i) =>
        add(
          `Main body tube screw ${row + 1}.${i + 1} · countersunk 90°`,
          moving(radialBolt(z, a)),
          steel,
        ),
      ),
    );
  }
  const shifted = result.map((piece) => ({
    ...piece,
    shape: transform(piece.shape, 0, [0, 0, m.stackOffset]),
  }));
  if (wing)
    shifted.push(
      ...wingPieces(p).map((piece) => ({
        ...piece,
        shape: transform(piece.shape, 0, [0, 0, m.stackOffset]),
      })),
      ...noseSupport(p),
    );
  else shifted.push(...servoPieces(p), ...servoRetention(p), ...noseSupport(p));
  if (m.batteries) shifted.push(...batteryPieces(p), ...electronicsPieces(p));
  // Change the reference frame: ring/body remain fixed; the inverted drive frame is the nose.
  // Its bayonet turn finishes before it translates towards the nose (+Z).
  return shifted.map((piece) =>
    named({
      ...piece,
      shape: transform(rotate(transform(piece.shape, -m.angle, [0, 0, -m.lift]), 180, 'x'), 0, [
        0,
        0,
        56 + m.stackOffset,
      ]),
    }),
  );
}
