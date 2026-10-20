import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConfiguredPiece } from '../src/core/assembly/detail-instances';
import type { Parameters } from '../src/core/types';
import bolt from '../src/parts/bolt-screw/part';
import nut from '../src/parts/hex-nut/part';
import control from '../src/parts/machine-control/part';
import rod from '../src/parts/threaded-rod/part';
import frame from '../src/parts/cnc-frame-part/part';
import {
  alignMatingFasteners,
  matingThreads,
} from '../src/parts/cnc-milling-machine/lib/thread-mating';

function installed(id: string, libraryId: string, parameters: Parameters, z = 0): ConfiguredPiece {
  return {
    label: id,
    color: 0x999999,
    component: {
      id,
      name: id,
      libraryId,
      parameters,
      state: 'default',
      quantity: 1,
      supply: 'standard',
      placement: { translation: [0, 0, z], rotation: [0, 0, 37] },
    },
  };
}
const female = () => {
  const p = installed('female', 'hex-nut', { ...nut.defaults, bore: 5, pitch: 0.8, height: 4 });
  p.component.placement!.rotation = [0, 0, 0];
  return p;
};
const male = (parameters: Parameters, z: number) =>
  installed(
    'male',
    'bolt-screw',
    { ...bolt.defaults, diameter: 5, shankDiameter: 5, pitch: 0.8, headHeight: 5, ...parameters },
    z,
  );
const phase = (p: ConfiguredPiece) =>
  alignMatingFasteners([female(), p])[1].component.placement!.rotation;
const samePhase = (a: number[], b: number[]) =>
  a.forEach((n, i) => assert.ok(Math.abs(n - b[i]) < 1e-8, `${a} differs from ${b}`));

test('full-thread mating uses the actual shaft band, ignoring inactive stored partial length', () => {
  const p = male({ length: 50, threadSpan: 'full', threadLength: 1 }, -12.5);
  const reference = male({ length: 50, threadSpan: 'full', threadLength: 50 }, -12.5);
  samePhase(phase(p), phase(reference));
  assert.ok(
    Math.abs(Number(phase(p)[2])) < 1e-8,
    'Full band reaches the nut and cancels the initial 37-degree roll.',
  );
});

test('partial-thread start determines both the occupied interval and native helix origin', () => {
  const offsetBand = male(
    { length: 50, threadSpan: 'partial', threadStart: 10, threadLength: 10 },
    17.7,
  );
  const samePhysicalBand = male({ length: 10, threadSpan: 'full', threadLength: 1 }, 7.7);
  samePhase(phase(offsetBand), phase(samePhysicalBand));
  const notEngaged = male(
    { length: 50, threadSpan: 'partial', threadStart: 30, threadLength: 10 },
    17.7,
  );
  assert.strictEqual(
    alignMatingFasteners([female(), notEngaged])[1],
    notEngaged,
    'Smooth shank in the nut cannot be mistaken for thread engagement.',
  );
});

test('countersunk overall length and plain screws retain their actual native datum', () => {
  const countersunk = male(
    { length: 20, head: 'countersunk', headHeight: 4, threadSpan: 'full', threadLength: 1 },
    8.2,
  );
  const underHeadLength = male(
    { length: 16, head: 'socket-cap', headHeight: 4, threadSpan: 'full', threadLength: 16 },
    8.2,
  );
  samePhase(phase(countersunk), phase(underHeadLength));
  const plain = male({ length: 50, threadMode: 'none' }, -12.5);
  assert.strictEqual(alignMatingFasteners([female(), plain])[1], plain);
});

test('published PSU rear taps feed canonical phase interfaces without model-specific bolt overrides', () => {
  const p = installed('source-psu', 'machine-control', { ...control.defaults, model: 'lrs15024' });
  p.component.placement = { translation: [20, 30, 40], rotation: [0, 0, 0] };
  const taps = matingThreads([p]);
  assert.equal(taps.length, 2);
  assert.deepEqual(
    taps.map((q) => q.origin),
    [
      [-35.5, 30, 72],
      [42.5, 30, 72],
    ],
  );
  assert.ok(taps.every((q) => q.diameter === 3 && q.pitch === 0.5 && q.length === 3));
  taps.forEach((q) => q.axis.forEach((n, i) => assert.ok(Math.abs(n - [0, 1, 0][i]) < 1e-10)));
});

test('a cut stud seats in fixed tapped stock while its free nut independently matches the same helix', () => {
  const foot = installed('fixed-foot', frame.id, {
    ...frame.defaults,
    role: 'foot-plate',
    sizeX: 60,
    sizeY: 60,
    sizeZ: 30,
    holes: JSON.stringify([
      {
        axis: 'z',
        at: [0, 0, -15],
        diameter: 8,
        depth: 26,
        threadPitch: 1.25,
        threadDesignation: 'M8',
      },
    ]),
  });
  foot.component.placement.rotation = [0, 0, 0];
  const stud = installed(
    'cut-stud',
    rod.id,
    { ...rod.defaults, diameter: 8, pitch: 1.25, length: 250 },
    110,
  );
  const freeNut = installed(
    'free-nut',
    nut.id,
    { ...nut.defaults, bore: 8, pitch: 1.25, height: 6.5 },
    220,
  );
  freeNut.component.placement.rotation = [0, 0, 23];
  const result = alignMatingFasteners([foot, stud, freeNut]);
  assert.strictEqual(result[0], foot, 'A fixed host must not turn to satisfy a second thread.');
  samePhase(result[1].component.placement.rotation, [0, 0, 0]);
  samePhase(result[2].component.placement.rotation, [0, 0, 0]);
  assert.deepEqual(
    result.map((piece) => piece.component.placement.translation),
    [foot, stud, freeNut].map((piece) => piece.component.placement.translation),
  );
  assert.deepEqual(
    result.map((piece) => piece.component.parameters),
    [foot, stud, freeNut].map((piece) => piece.component.parameters),
  );
});
