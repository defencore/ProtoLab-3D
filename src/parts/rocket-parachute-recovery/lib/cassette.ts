import type { Parameters } from '../../../core/types';
import type { Piece } from '../../rocket-release/lib/assembly';
import {
  box,
  cylinder,
  plate,
  circle,
  ring,
  union,
  subtract,
  transform,
  rotate,
  type Shape,
} from '../../rocket-release/lib/shapes';
import { at } from '../../rocket-release/lib/motion';
import { radialScrew, matingHole } from '../../rocket-release/lib/hardware';
import { motion, springDimensions, assessment, cassetteTop } from './motion';
import {
  guideStop,
  supportMounts,
  packingMounts,
  packingPinZ,
  packingBore,
  fairlead,
} from './interfaces';
export function cassetteMounts(p: Parameters): Shape[] {
  const { seat } = springDimensions(p),
    h = radialScrew(45, 42.75);
  return [45, 135, 225, 315].map((a) =>
    transform(rotate(h.shape, 90, 'y'), a, [...at(h.tipRadius, a), seat - 8]),
  );
}
export function cassettePieces(p: Parameters, state: string): Piece[] {
  const q = motion(p, state),
    s = springDimensions(p),
    a = assessment(p),
    out: Piece[] = [];
  const add = (label: string, shape: Shape, color = 0xc6cdd5) => out.push({ label, shape, color });
  const guides = [0, 120, 240].map((angle) => at(31.5, angle));
  const mounts = cassetteMounts(p);
  const thread = (d: number, length: number, z: number, internal: boolean): Shape =>
    transform(
      {
        kind: 'thread',
        diameter: d,
        pitch: d === 3 ? 0.5 : 0.4,
        length,
        clearance: internal ? 0.04 : 0,
        internal,
      },
      0,
      [0, 0, z],
    );
  const guideMates = guides.map(([x, y]) =>
    transform(thread(3, 4, s.seat - 4, true), 0, [x, y, 0]),
  );
  const floor = subtract(
    union(
      cylinder(42.75, 4, [0, 0, s.seat - 4]),
      ring(42.75, 39.75, s.seat - 12, 8),
      ...guides.map(([x, y]) => ring(6 - +p.springWire / 2 - 0.3, 2.05, s.seat, 1.5, x, y)),
    ),
    ...guideMates,
    ...mounts.map(matingHole),
    cylinder(6, 4.2, [0, 0, s.seat - 4.1]),
  );
  add(
    'Body ejector bulkhead · Al6061 · web4 integral rim8 wall3 · central D12 lined tether port',
    floor,
  );
  add(
    'Body tether load washer · steel · D24 D8 t2 · stopper knot below',
    ring(12, 4, s.seat - 6, 2),
  );
  add('Bulkhead central fairlead · PTFE · D8 bore · R1 lips', fairlead(s.seat - 4, 4), 0xe8e4d9);
  mounts.forEach((shape, i) =>
    add(`Ejector bulkhead tube screw ${i + 1} · countersunk M2`, shape, 0x929eac),
  );
  const upper = s.seat + s.closed + q.springTravel;
  const piston = plate(
    circle(34),
    [...guides.map(([x, y]) => circle(2.05, x, y)), circle(6)],
    upper,
    3,
  );
  add('Pusher central fairlead · PTFE · D8 bore · R1 lips', fairlead(upper, 3), 0xe8e4d9);
  const boss = box([8, 8, 8], [-4, 26, upper - 5]);
  const movingPinBore = transform(packingBore(p), 0, [0, 0, q.springTravel]);
  add(
    'Captive cassette pusher · Al6061 · D68 t3 · three D4.1 guides · integral packing-pin boss',
    subtract(
      union(
        piston,
        boss,
        ...guides.map(([x, y]) => cylinder(7.5, 3, [x, y, upper])),
        ...guides.map(([x, y]) => ring(6 - +p.springWire / 2 - 0.3, 2.05, upper - 1.5, 1.5, x, y)),
      ),
      movingPinBore,
      ...guides.map(([x, y]) => cylinder(2.05, 3.2, [x, y, upper - 0.1])),
    ),
  );
  const pinZ = packingPinZ(p),
    latchBolts = packingMounts(p);
  add(
    'Packing pin support · Al6061 · body mounted · D4.2 guide bore',
    subtract(
      subtract(box([10, 8.25, 18], [-5, 34.5, pinZ - 9]), ring(60, 42.75, pinZ - 10, 20)),
      packingBore(p),
      ...latchBolts.map(matingHole),
    ),
  );
  latchBolts.forEach((shape, i) =>
    add(`Packing support tube screw ${i + 1} · countersunk M2`, shape),
  );
  if (state === 'packing') {
    add(
      'Removable packing safety pin · steel · D4x20 shoulder D9 head · REMOVE BEFORE FLIGHT',
      transform(
        rotate(union(cylinder(2, 20, [0, 0, 0]), cylinder(4.5, 2, [0, 0, 20])), 90, 'y'),
        90,
        [0, 27, pinZ],
      ),
      0xe15c45,
    );
  }
  // The integral PTFE floor distributes pusher load across the packed parachutes.
  const outer = +p.packDiameter / 2 + 3,
    inner = +p.packDiameter / 2 + 0.5;
  const bottom = s.cassetteBottom + q.lift,
    top = cassetteTop(p) - 3 + q.lift;
  const shell = union(
    ring(outer, 6, bottom, 4),
    ring(outer, inner, bottom + 4, top - bottom - 4.5),
    ring(outer - 0.5, inner + 0.5, top - 0.5, 0.5),
    transform({ kind: 'torus', radius: outer - 0.5, wireRadius: 0.5, arc: 360 }, 0, [
      0,
      0,
      top - 0.5,
    ]),
    transform({ kind: 'torus', radius: inner + 0.5, wireRadius: 0.5, arc: 360 }, 0, [
      0,
      0,
      top - 0.5,
    ]),
  );
  add('Cassette central fairlead · PTFE · D8 bore · R1 lips', fairlead(bottom, 4), 0xe8e4d9);
  add(
    'Ejected parachute cassette · PTFE · open mouth · integral floor4 wall2.5 · rounded rim R0.5 · central D8 fairlead',
    subtract(
      shell,

      ...(state === 'cutaway' ? [box([50, 50, top - bottom + 2], [0, -50, bottom - 1])] : []),
    ),
    0xe8e4d9,
  );
  guides.forEach(([x, y], i) =>
    add(
      `Guide ejector spring ${i + 1} · spring steel · D12 mean / wire${p.springWire} / Na${p.springCoils} · L0${a.free.toFixed(1)} · k${a.rate.toFixed(3)} N/mm · matched set of 3; supplier rating pending`,
      {
        kind: 'spring',
        radius: 6,
        wire: +p.springWire,
        height: s.closed - +p.springWire + q.springTravel,
        turns: +p.springCoils + 2,
        origin: [x, y, s.seat + +p.springWire / 2],
      },
      0xb5a477,
    ),
  );
  const stop = guideStop(p) + 4;
  const supportBolts = supportMounts(p);
  add(
    'Upper ejector guide support disk · Al6061 · D79.3 bore57 t4 · three D4.05 seats',
    subtract(
      plate(
        circle(39.65),
        [...guides.map(([x, y]) => circle(2.025, x, y)), circle(28.5)],
        stop - 4,
        4,
      ),
      ...supportBolts.map(matingHole),
    ),
  );
  supportBolts.forEach((shape, i) =>
    add(`Upper guide support tube screw ${i + 1} · countersunk M2`, shape),
  );
  guides.forEach(([x, y], i) => {
    add(
      `Ejector guide rod ${i + 1} · steel · D4 polished shoulder · M3x0.5 ends · captive stop`,
      transform(
        union(
          cylinder(2, stop - s.seat, [0, 0, s.seat]),
          thread(3, 4, s.seat - 4, false),
          thread(3, 4, stop, false),
        ),
        0,
        [x, y, 0],
      ),
      0x929eac,
    );
    add(
      `Ejector stop washer ${i + 1} · ISO 7092 M3 · 6/3.2 t0.5`,
      plate(circle(3, x, y), [circle(1.6, x, y)], stop, 0.5),
      0x929eac,
    );
    add(
      `Ejector stop nut ${i + 1} · ISO 4032 M3x0.5 · AF5.5 t2.4 · threadlock`,
      transform(
        subtract(
          plate(circle(5.5 / Math.sqrt(3), 0, 0, 6), [], stop + 0.5, 2.4),
          thread(3, 3.2, stop, true),
        ),
        0,
        [x, y, 0],
      ),
      0x929eac,
    );
  });
  return out;
}
