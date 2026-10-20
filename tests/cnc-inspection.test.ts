import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { PartDefinition } from '../src/core/types';
import type { MillingPiece } from '../src/parts/cnc-milling-machine/lib/composition';
import frame from '../src/parts/cnc-frame-part/part';
import { componentGeometry } from '../src/core/assembly/detail-instances';
import { currentGeometryMode, withGeometryMode } from '../src/core/geometry-mode';
import { disposeModel } from '../src/core/mechanical';
import {
  inspectionGroupOffsets,
  millingInspectionBounds,
  placedInspectionBounds,
} from '../src/parts/cnc-milling-machine/lib/inspection';

function piece(
  id: string,
  motion: MillingPiece['motion'],
  parameters = { length: 10 },
  state = 'default',
): MillingPiece {
  return {
    component: {
      id,
      name: id,
      quantity: 1,
      libraryId: 'inspection-fixture',
      parameters,
      state,
      supply: 'manufactured',
      placement: { translation: [10, -20, 30], rotation: [23, -31, 57] },
    },
    label: id,
    color: 0xcccccc,
    motion,
    section: motion === 'fixed' ? 'bed' : 'mechanism',
    angle: 17,
    position: [5, 7, -9],
  };
}

test('inspection staging separates complete motion envelopes with a real gap and never splits fixed equipment from its bed', () => {
  const bounds = {
    fixed: { min: [-20, -200, -10], max: [1200, 1200, 500] },
    gantry: { min: [-700, -310, 500], max: [700, 270, 1400] },
    x: { min: [-500, -340, 900], max: [500, 400, 1700] },
    z: { min: [-130, -70, 950], max: [130, 380, 1600] },
  } as const;
  const offsets = inspectionGroupOffsets(JSON.parse(JSON.stringify(bounds)));
  assert.deepEqual(offsets.fixed, [0, 0, 0]);
  const groups = ['fixed', 'gantry', 'x', 'z'] as const;
  for (let i = 1; i < groups.length; i++) {
    const previous = groups[i - 1],
      current = groups[i];
    assert.equal(
      bounds[current].min[1] + offsets[current][1] - bounds[previous].max[1] - offsets[previous][1],
      100,
    );
    assert.equal(offsets[current][0], 0);
    assert.equal(offsets[current][2], 0);
  }
  assert.throws(() => inspectionGroupOffsets({}, 0), /positive/);
  assert.throws(() => inspectionGroupOffsets({ x: { min: [0, 3, 0], max: [1, 2, 1] } }), /ordered/);
});

test('inspection resolves actual off-center origins once per source configuration in Simple and applies the complete source pose', () => {
  const calls: string[] = [];
  const part: PartDefinition = {
    ...frame,
    id: 'inspection-fixture',
    validate: () => [],
    buildExportGeometry: (parameters, state) => {
      calls.push(`${parameters.length}/${state}/${currentGeometryMode()}`);
      const model = new Group();
      const mesh = new Mesh(
        new BoxGeometry(Number(parameters.length), 4, 6),
        new MeshStandardMaterial(),
      );
      mesh.position.set(40, -60, 80);
      model.add(mesh);
      return model;
    },
  };
  const pieces = [
    piece('bed', 'fixed'),
    piece('fixed equipment', 'fixed'),
    piece('gantry', 'gantry'),
    piece('head', 'x', { length: 20 }),
    piece('tool', 'z', { length: 10 }, 'other'),
  ];
  const before = JSON.stringify(pieces);
  const bounds = withGeometryMode('full', () => millingInspectionBounds([part], pieces));
  assert.deepEqual(calls, ['10/default/simple', '20/default/simple', '10/other/simple']);
  assert.equal(JSON.stringify(pieces), before);
  assert.ok(bounds.fixed);
  withGeometryMode('full', () => millingInspectionBounds([part], pieces));
  assert.equal(calls.length, 3, 'Repeated actual configuration bounds must be reused.');
  assert.equal(currentGeometryMode(), 'simple');
  const actual = placedInspectionBounds({ min: [35, -62, 77], max: [45, -58, 83] }, pieces[0]);
  const source = part.buildExportGeometry!(pieces[0].component.parameters, 'default');
  const reference = componentGeometry([{ ...part, buildGeometry: () => source }], [pieces[0]]);
  reference.updateMatrixWorld(true);
  try {
    const expected = new Box3().setFromObject(reference, true);
    assert.ok(new Vector3(...actual.min).distanceTo(expected.min) < 1e-10);
    assert.ok(new Vector3(...actual.max).distanceTo(expected.max) < 1e-10);
  } finally {
    disposeModel(reference);
  }
  const offsets = inspectionGroupOffsets(bounds);
  assert.deepEqual(offsets.fixed, [0, 0, 0]);
  assert.ok(
    offsets.gantry[1] > 0 && offsets.x[1] > offsets.gantry[1] && offsets.z[1] > offsets.x[1],
  );
});

test('inspection bounds restore the caller mode when a configured source throws', () => {
  const part: PartDefinition = {
    ...frame,
    id: 'inspection-fixture',
    validate: () => [],
    buildExportGeometry: () => {
      throw new Error('bad source geometry');
    },
  };
  withGeometryMode('full', () => {
    assert.throws(
      () => millingInspectionBounds([part], [piece('failed', 'x')]),
      /bad source geometry/,
    );
    assert.equal(currentGeometryMode(), 'full');
  });
});
