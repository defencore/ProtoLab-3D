import type { Parameters } from '../../../core/types';
import type { Piece } from '../../rocket-release/lib/assembly';
import {
  box,
  cylinder,
  plate,
  circle,
  union,
  subtract,
  transform,
  rotate,
  type Shape,
  type Point,
} from '../../rocket-release/lib/shapes';
import { wingDeck } from '../../rocket-release/lib/wing-package';
import { noseWalls } from '../../rocket-release/lib/nose-support';
import {
  flatScrew,
  flatSeat,
  matingHole,
  outputScrew,
  screw,
} from '../../rocket-release/lib/hardware';
import { at } from '../../rocket-release/lib/motion';
import { ribbon } from '../../rocket-airbrakes/lib/kinematics';
import { camPoint, camLift, motion, releaseParameters } from './motion';
import { latchPhases as phases, seamAngles, noseCheeks, latch, bladePrism } from './latch';
const metal = 0xc6cdd5;
const welded = (solid: Shape): Shape => ({
  kind: 'fusedLayers',
  children: [solid],
  solid,
  planes: [],
});
export function camPieces(p: Parameters, state: string): Piece[] {
  const rp = releaseParameters(p),
    q = motion(p, state),
    wd = wingDeck(rp),
    out: Piece[] = [];
  const add = (label: string, shape: Shape, color = metal) => out.push({ label, shape, color });
  const springs = seamAngles.map((a) => at(36.25, a));
  const guideBolts = phases.flatMap((a) =>
    [16, 27].flatMap((x) =>
      [-6, 6].map((y) => transform(transform(flatScrew(6), 0, [x, y, 43.5]), a)),
    ),
  );
  const plateBase = plate(circle(42.75), [circle(4.1), ...wd.holes], 44, 2);
  const threadHoles = springs.map(([x, y]) => ({
    x,
    y,
    z: 44,
    diameter: 8,
    pitch: 0.75,
    length: 3.5,
    clearance: 0.04,
    internal: true,
  }));
  if (plateBase.kind !== 'plate') throw new Error('Expected disk');
  const deck: Shape = union(
    { kind: 'threadedPlate', plate: plateBase, holes: threadHoles },
    ...noseWalls(rp),
    noseCheeks(),
    ...wd.bosses,
    ...springs.map(
      ([x, y], i) =>
        ({
          kind: 'threadedPlate',
          plate: plate(circle(5, x, y), [], 46, 1.5) as Extract<Shape, { kind: 'plate' }>,
          holes: [threadHoles[i]],
        }) as Shape,
    ),
    ...phases.flatMap((a) =>
      [-7.5, 4.15].map((y) => transform(box([18.5, 3.35, 1.8], [12.5, y, 46]), a)),
    ),
  );
  add(
    'Nose cam and servo mounting disk · Al6061 · integral double-shear cheeks t3 and tube walls · M8x0.75 cartridges',
    welded(
      subtract(
        deck,
        ...guideBolts.map(matingHole),
        ...springs.map(([x, y]) =>
          transform(
            {
              kind: 'thread',
              diameter: 8,
              pitch: 0.75,
              length: 3.5,
              clearance: 0.04,
              internal: true,
            },
            0,
            [x, y, 44],
          ),
        ),
      ),
    ),
  );
  let boltIndex = 0;
  for (const [i, a] of phases.entries()) {
    const travel = 8 * camLift(p, q.unlock),
      x = 23 - travel;
    const guide = transform(
      subtract(box([18.5, 15, 1.7], [12.5, -7.5, 47.8]), box([18.75, 5.1, 2], [11.5, -2.55, 47.7])),
      a,
    );
    const bolts = guideBolts.slice(boltIndex, boltIndex + 4);
    boltIndex += 4;
    add(
      `Hook guide cover ${i + 1} · Al6061 t1.7 · 0.15 axial clearance`,
      subtract(guide, ...bolts.map(flatSeat)),
    );
    bolts.forEach((s, j) =>
      add(`Hook guide screw ${i + 1}.${j + 1} · ISO 10642 M2x6`, s, 0x929eac),
    );
    const followerBolt = transform(rotate(flatScrew(10), 180, 'x'), 0, [x, 0, 56.15]);
    const arm = union(
      box([9, 8, 1.5], [x - 2, -4, 46.15]),
      box([2, 4, 7.65], [x + 5, -2, 46.15]),
      bladePrism(latch.outerEnd - 28, latch.width, latch.thickness, x + 5, 49.8),
    );
    add(
      `Retracting hook ${i + 1} · steel · 8 mm stroke · 8x4 R1 double-shear blade · grade and heat treatment to specify`,
      transform(welded(subtract(arm, flatSeat(followerBolt))), a),
      0xe5ad46,
    );
    add(`Cam follower screw ${i + 1} · ISO 10642 M2x10`, transform(followerBolt, a), 0x929eac);
    add(
      `Cam follower sleeve ${i + 1} · steel · D3/2.1 x6.5`,
      transform(subtract(cylinder(1.5, 6.5, [x, 0, 47.65]), cylinder(1.05, 6.7, [x, 0, 47.55])), a),
      0x929eac,
    );
    add(
      `Cam follower washer ${i + 1} · ISO 7089 M2 · 5/2.2 x0.3`,
      transform(plate(circle(2.5, x, 0), [circle(1.1, x, 0)], 54.15, 0.3), a),
      0x929eac,
    );
    add(
      `Cam follower nut ${i + 1} · ISO 4032 M2x0.4 · AF4 t1.6 · threadlock`,
      transform(
        subtract(
          plate(circle(4 / Math.sqrt(3), x, 0, 6), [], 54.45, 1.6),
          matingHole(followerBolt),
        ),
        a,
      ),
      0x929eac,
    );
  }
  // Each outside edge follows the slot so the retracting hook stems never enter
  // the cam disk. Three identical 120-degree sectors leave a central drive hub.
  const outer: Point[] = Array.from({ length: 720 }, (_, i) => {
    const a = -i / 2,
      d = (i / 2) % 120;
    const f =
      d <= +p.camSweep ? camLift(p, d / +p.camSweep) : 1 - (d - +p.camSweep) / (120 - +p.camSweep);
    return at(25.4 - 8 * f, a);
  }).reverse();
  const slots = phases.map((a) =>
    ribbon(
      Array.from({ length: 121 }, (_, i) => camPoint(p, i / 120, a)),
      3.4,
    ),
  );
  const spline: Point[] = Array.from({ length: 100 }, (_, i) =>
    at(
      ((i % 4 === 0 || i % 4 === 3 ? +rp.pwmSplineRoot : +rp.pwmSplineDiameter) * 1.015) / 2,
      i * 3.6,
    ),
  );
  const cam = subtract(
    union(plate(outer, slots, 51, 3), cylinder(4, 8, [0, 0, 43])),
    plate(spline, [], 42.9, 5.2),
    cylinder(1.65, 6.2, [0, 0, 48]),
    cylinder(3.05, 1.1, [0, 0, 53]),
  );
  add(
    `MG996R ${p.mechanism === 'spiral' ? 'linear spiral' : 'eased spiral'} cam · Al7075 t3 · 3 slots width3.4 · 25T fit reference`,
    transform(welded(cam), +p.camSweep * q.unlock),
    0xc36d4c,
  );
  const retaining = outputScrew();
  if (retaining.kind === 'fastener') retaining.parameters.length = 12;
  add(
    'MG996R cam retaining screw · ISO 7380-1 M3x12 · verify OEM thread',
    transform(transform(retaining, 0, [0, 0, 41]), +p.camSweep * q.unlock),
    0x929eac,
  );
  const thrustAxes = [60, 180, 300].map((a) => at(29, a));
  const thrustScrew = screw(3, 8, { head: 'countersunk', headDiameter: 6, headHeight: 1.7 });
  if (thrustScrew.kind === 'fastener')
    Object.assign(thrustScrew.parameters, { driveWidth: 2, driveDepth: 1.2 });
  const thrustBolts = thrustAxes.map(([x, y]) => transform(thrustScrew, 0, [x, y, 50.4]));
  const counterbores = thrustAxes.map(([x, y]) =>
    transform(
      union(
        cylinder(1.6, 2.2, [0, 0, 56.3]),
        { kind: 'cone', bottom: 1.6, top: 3.1, height: 1.5, z: 56.7 },
        cylinder(3.1, 0.3, [0, 0, 58.2]),
      ),
      0,
      [x, y, 0],
    ),
  );
  add(
    'Cam cassette thrust plate · Al6061 · D64.6 t2 · three countersunk M3 screws',
    subtract(ringShape(), ...counterbores),
  );
  function ringShape(): Shape {
    return plate(circle(32.3), [circle(6)], 56.4, 2);
  }
  const carrier = out.find((x) => x.label.startsWith('Nose cam and servo'))!;
  carrier.shape = welded(
    union(
      carrier.shape,
      ...thrustAxes.map(([x, y], i) =>
        subtract(cylinder(3, 10.4, [x, y, 46]), matingHole(thrustBolts[i])),
      ),
    ),
  );
  thrustBolts.forEach((shape, i) =>
    add(`Cam thrust plate screw ${i + 1} · DIN 7991 M3x8`, shape, 0x929eac),
  );
  return out;
}
