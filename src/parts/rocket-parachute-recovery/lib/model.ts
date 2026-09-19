import type { Parameters } from '../../../core/types';
import type { Piece } from '../../rocket-release/lib/assembly';
import { pieces as libraryPieces } from '../../rocket-release/lib/model';
import { wingLayout } from '../../rocket-release/lib/wing-layout';
import {
  rotate,
  transform,
  cylinder,
  ring,
  box,
  union,
  subtract,
  type Shape,
} from '../../rocket-release/lib/shapes';
import { motion, releaseParameters, cassetteTop } from './motion';
import { springCartridges } from '../../rocket-release/lib/cartridges';
import { cassettePieces, cassetteMounts } from './cassette';
import { flatSeat, flatScrew, matingHole } from '../../rocket-release/lib/hardware';
import { supportMounts, packingMounts, packingBore, cordEye } from './interfaces';
import { at } from '../../rocket-release/lib/motion';
import { camPieces } from './cam';
import { bodyReceiver } from './latch';
import { fabric } from './fabric';
export { camPoint } from './motion';
const fixed = (label: string) => /^(Body locking ring|Main body tube)/.test(label);
const cartridge =
  /^(Threaded spring barrel|Spring barrel bottom plug|Enclosed compression spring|Captive spring piston|Piston contact button|Piston external retaining ring)/;
const geared =
  /^(Nose servo and gear mounting disk|Retaining shoulder stud|Idler pinion|Idler axle retaining disk|Fixed idler axle|Idler retaining disk screw|MG996R input pinion|MG996R output retaining screw)/;
export function pieces(p: Parameters, state: string) {
  const q = motion(p, state),
    radial = p.mechanism !== 'rotary-ring',
    rp = releaseParameters(p);
  const release = q.noseLift > 0 ? 60 + (40 * q.noseLift) / +p.separation : 60 * q.unlock;
  const inputs = {
    ...rp,
    springTravel: 8,
    springWire: 0.5,
    springPreload: 2,
    release: radial ? 0 : release,
  };
  const rigid: Piece[] = libraryPieces(
    inputs,
    state === 'cutaway' ? 'cutaway' : 'assembled',
  ).filter((x) => !cartridge.test(x.label) && !(radial && geared.test(x.label)));
  const move = (shape: Shape) => transform(shape, 0, [q.noseX, 0, q.noseLift]);
  const fromLocal = (shape: Shape) =>
    move(transform(rotate(transform(shape, radial ? 0 : -14 * q.unlock), 180, 'x'), 0, [0, 0, 56]));
  for (const piece of rigid) {
    if (!fixed(piece.label))
      piece.shape = radial ? move(piece.shape) : transform(piece.shape, 0, [q.noseX, 0, 0]);
    if (radial && piece.label.startsWith('BUY MG996R output')) {
      // A library output model in the inverted nose frame: shaft rotation is -cam angle.
      piece.shape = transform(
        transform(piece.shape, 0, [-q.noseX, 0, -q.noseLift]),
        -+p.camSweep * q.unlock,
        [q.noseX, 0, q.noseLift],
      );
    }
    if (radial && piece.label.startsWith('Body locking ring')) {
      piece.shape = bodyReceiver(piece.shape);
      piece.label =
        'Body hook locking ring · Al6061 · three integral eyes t3 between double nose cheeks · bore65.5';
      piece.color = 0x799dad;
      piece.metadata = {
        RecoveryInterface:
          'Three 8x4 steel blades through two 3 mm nose cheeks and an intermediate 3 mm body eye; 0.15 mm face clearance; 8 mm withdrawal; 1.60 mm released eye clearance; four spring reaction seats',
      };
    }
  }
  rigid.push(
    ...springCartridges(
      { ...inputs, release: q.noseLift > 0 ? 60 + (40 * q.noseLift) / +p.separation : 0 },
      'assembled',
    ).map((x) => ({ ...x, shape: fromLocal(x.shape) })),
  );
  if (radial) rigid.push(...camPieces(p, state).map((x) => ({ ...x, shape: fromLocal(x.shape) })));
  const add = (label: string, shape: Shape, color = 0xc6cdd5) =>
    rigid.push({ label, shape, color });
  const top = cassetteTop(p);
  const radius = radial ? 28 : 24.6;
  // A 180-degree clocking compensates the 1 mm tip shift (2.5 pitches)
  // against the original M2 post thread when replacing M2x6 with M2x8.
  const bolts = [45, 135, 225, 315].map((a) =>
    transform(rotate(flatScrew(8), 180, 'x'), radial ? 0 : 180, [...at(radius, a), top + 5]),
  );
  const arms = [45, 135, 225, 315].flatMap((a) => [
    transform(box([radius, 8, 3], [0, -4, top - 3]), a),
    cylinder(4, 3, [...at(radius, a), top - 3]),
  ]);
  const cross = union(subtract(union(...arms), ...bolts.map(flatSeat)), cordEye(top - 9));
  const noseMove = (shape: Shape) => move(transform(shape, radial ? 0 : 14 * q.unlock));
  const carrier = rigid.find((x) =>
    x.label.startsWith(radial ? 'Cam cassette thrust plate' : 'Idler axle retaining disk'),
  )!;
  if (radial) {
    const bosses = [45, 135, 225, 315].map((a) => cylinder(2.5, 3.1, [...at(radius, a), top + 2]));
    carrier.shape = subtract(
      union(carrier.shape, noseMove(union(...bosses))),
      ...bolts.map((b) => noseMove(matingHole(b))),
    );
    carrier.label += ' · integral four-point bridle bosses';
  } else {
    for (let i = rigid.length - 1; i >= 0; i--)
      if (rigid[i].label.startsWith('Idler retaining disk screw')) rigid.splice(i, 1);
  }
  add(
    'Nose bridle X-crossmember · Al6061 · four M2 mounts · t3 arms8 · rounded central D8 eye R2',
    noseMove(cross),
  );
  bolts.forEach((b, i) => add(`Nose X-crossmember screw ${i + 1} · ISO 10642 M2x8`, noseMove(b)));
  const noseTop = 56 - wingLayout(rp).noseBottom;
  const cut = (shape: Shape) =>
    state === 'cutaway' ? subtract(shape, box([50, 50, 600], [0, -50, -250])) : shape;
  const shell = rigid.find((x) => x.label.startsWith('Main body tube section'))!;
  shell.shape = cut(
    subtract(
      union(shell.shape, ring(45, 43, -+p.bayLength, +p.bayLength - 27.9)),
      ...cassetteMounts(p).map(flatSeat),
      ...supportMounts(p).map(flatSeat),
      ...packingMounts(p).map(flatSeat),
      packingBore(p),
    ),
  );
  shell.label = 'Main body tube section · continuous recovery bay · composite · OD90 ID86';
  shell.color = 0x697586;
  const lockingRing = rigid.find((x) =>
    x.label.startsWith(radial ? 'Body hook locking ring' : 'Body locking ring'),
  )!;
  lockingRing.shape = subtract(
    lockingRing.shape,
    ...supportMounts(p).map(flatSeat),
    ...(radial
      ? rigid
          .filter((x) => x.label.startsWith('Main body tube screw'))
          .map((x) => matingHole(x.shape))
      : []),
  );
  const nose = subtract(
    { kind: 'cone', bottom: 45, top: 0.8, height: +p.noseLength, z: noseTop },
    { kind: 'cone', bottom: 43, top: 0.1, height: +p.noseLength - 3, z: noseTop - 0.01 },
  );
  add('Hollow nose cone · composite · nominal 2 mm shell', move(cut(nose)), 0xd0d8e0);
  rigid.push(...cassettePieces(p, state));
  if (state === 'latch-section') {
    // Section both load-bearing members while leaving the sliding blades intact.
    if (radial) {
      const deck = rigid.find((x) => x.label.startsWith('Nose cam and servo'))!;
      deck.shape = subtract(deck.shape, box([50, 50, 80], [0, -50, -30]));
      deck.label += ' · INSPECTION SECTION ONLY';
    }
    lockingRing.shape = subtract(lockingRing.shape, box([50, 50, 80], [0, -50, -30]));
    lockingRing.label += ' · INSPECTION SECTION ONLY';
    return {
      rigid: rigid.filter((x) =>
        /^(Body (hook )?locking ring|Nose cam and servo|Retracting hook|Hook guide|Cam follower|MG996R (linear|eased|cam retaining)|Idler |Fixed idler|MG996R input|Nose servo and gear)/.test(
          x.label,
        ),
      ),
      flex: [],
    };
  }
  // Fabric components are intentionally separate from rigid mechanism metrology.
  const hideShells = ['no-shells', 'mechanisms', 'packing'].includes(state);
  return {
    rigid: hideShells
      ? rigid.filter(
          (x) => !/^(Main body tube section|Nose tube section|Hollow nose cone)/.test(x.label),
        )
      : rigid,
    flex: ['mechanisms', 'packing'].includes(state) ? [] : fabric(p, state),
  };
}
