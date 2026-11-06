import assert from 'node:assert/strict';
import test from 'node:test';
import { DoubleSide, Group, Mesh, Raycaster, Vector3 } from 'three';
import { component, type Shape } from '../src/core/assembly/boundary/shapes';
import { disposeModel } from '../src/core/mechanical';
import { defaults, parameters } from '../src/parts/grandado-tube-mount/configurator';
import {
  endRetainerHardware,
  endRetainerSpec,
} from '../src/parts/grandado-tube-mount/lib/end-retainer';
import { printedPieces, tubeReference } from '../src/parts/grandado-tube-mount/lib/model';
import { layout } from '../src/parts/grandado-tube-mount/lib/spec';

type Point = [number, number, number];
const close = (a: number, b: number, label: string) =>
  assert.ok(Math.abs(a - b) < 0.0001, `${label}: ${a} versus ${b}`);

function inspect(shape: Shape): Group {
  const group = component(shape, 'Uncovered antenna entry', 0x999999);
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      material.side = DoubleSide;
  });
  group.updateMatrixWorld(true);
  return group;
}
function inside(group: Group, point: Point): boolean {
  const hits = new Raycaster(
    new Vector3(...point),
    new Vector3(1, 0.173, 0.119).normalize(),
  ).intersectObject(group, true);
  return (
    hits.filter((hit, i) => !i || hit.distance - hits[i - 1].distance > 0.0001).length % 2 === 1
  );
}

test('the cancelled fairing contributes no manufactured parts or mounting controls', () => {
  for (const antenna of [false, true]) {
    const ids = printedPieces({ ...defaults, antenna }).map((piece) => piece.id);
    assert.ok(!ids.includes('jcg108-antenna-shroud'));
    assert.ok(!ids.includes('jcg108-antenna-backing'));
  }
  const keys = parameters.map((parameter) => parameter.key);
  for (const removed of ['antennaModel', 'antennaDepth', 'antennaBondline', 'airflowDirection'])
    assert.ok(!keys.includes(removed), `${removed} is a cancelled fairing control`);
  for (const retained of ['antenna', 'antennaX', 'antennaY', 'antennaHole'])
    assert.ok(keys.includes(retained), `${retained} controls the retained cable entry`);
});

test('all eight disc anchors use the original twelve-millimetre screws and nut seats', () => {
  const enabled = endRetainerHardware({ ...defaults, antenna: true });
  assert.deepEqual(enabled, endRetainerHardware({ ...defaults, antenna: false }));
  const s = endRetainerSpec(defaults),
    screws = enabled.filter((item) => item.kind === 'screw'),
    nuts = enabled.filter((item) => item.kind === 'nut');
  assert.equal(screws.length, 8);
  assert.equal(nuts.length, 8);
  close(s.nutInnerRadius, 34, 'nut inner seat');
  close(s.nutOuterRadius, 36.4, 'nut outer seat');
  for (const screw of screws) {
    assert.equal(screw.length, 12);
    assert.equal(screw.head, 'countersunk');
    const radius = Math.hypot(screw.translation[1], screw.translation[2]);
    close(radius + screw.length / 2, s.screwHeadTopRadius, 'original pipe head plane');
    close(radius - screw.length / 2, s.screwTipRadius, 'uniform disc tip plane');
  }
  for (const nut of nuts)
    close(Math.hypot(nut.translation[1], nut.translation[2]), 34, 'captured nut location');
});

test('the optional side cable entry remains usable without an antenna cover', () => {
  const p = { ...defaults, antenna: true },
    d = layout(p);
  const cut = inspect(tubeReference(p, 'default')),
    uncut = inspect(tubeReference({ ...p, antenna: false }, 'default'));
  const middleRadius = (d.radius + d.innerRadius) / 2;
  const point: Point = [d.antennaX, d.antennaY, -Math.sqrt(middleRadius ** 2 - d.antennaY ** 2)];
  try {
    assert.ok(inside(uncut, point), 'baseline pipe wall is missing at the entry');
    assert.ok(!inside(cut, point), 'the retained entry is blocked');
  } finally {
    disposeModel(cut);
    disposeModel(uncut);
  }
});
