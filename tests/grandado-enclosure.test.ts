import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { Box3, DoubleSide, Mesh, Raycaster, Vector3, type Group, type Object3D } from 'three';
import part from '../src/parts/catalog-enclosure/part';
import { grandadoPieces, grandadoSpec } from '../src/parts/catalog-enclosure/lib/grandado';
import { disposeModel } from '../src/core/mechanical';
import { addProduct, createProject } from '../src/core/design-project';
import { matchingPresetId } from '../src/core/part-selection';

const preset = part.presets.find((entry) => entry.id === 'grandado-83-58-35-clear')!;
let closed: Group;
let opened: Group;
let exported: Group | undefined;

before(async () => {
  assert.ok(preset);
  await part.initializeGeometry?.(preset.parameters, 'assembled');
  closed = part.buildGeometry(preset.parameters, 'assembled');
  opened = part.buildGeometry(preset.parameters, 'open');
  exported = part.buildExportGeometry?.(preset.parameters, 'open');
  for (const model of [closed, opened]) {
    model.updateMatrixWorld(true);
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        material.side = DoubleSide;
    });
  }
});

after(() => {
  if (closed) disposeModel(closed);
  if (opened) disposeModel(opened);
  if (exported) disposeModel(exported);
});

const bounds = (object: Object3D) => new Box3().setFromObject(object, true);
const size = (object: Object3D) => bounds(object).getSize(new Vector3()).toArray();
function near(actual: number, expected: number, message: string, tolerance = 0.02) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
}
function vertical(target: Object3D, x: number, y: number, from = 80, direction = -1) {
  return new Raycaster(new Vector3(x, y, from), new Vector3(0, 0, direction)).intersectObject(
    target,
    true,
  );
}

test('Grandado geometry retains the nominal body and includes both projecting mounting ears', () => {
  assert.deepEqual(
    [grandadoSpec.bodyLength, grandadoSpec.bodyWidth, grandadoSpec.height],
    [83, 58, 35],
  );
  assert.equal(closed.children.length, 10, 'body, opaque lid, four inserts and four screws');
  for (const [axis, expected] of [110, 58, 35].entries())
    near(size(closed)[axis], expected, `closed envelope axis ${axis}`);
  assert.deepEqual(part.dimensions(preset.parameters, 'assembled'), [110, 58, 35]);
  assert.deepEqual(part.exportDimensions?.(preset.parameters, 'open'), [110, 58, 35]);
  assert.ok(exported, 'physical geometry has its own export pose');
  for (const [axis, expected] of [110, 58, 35].entries())
    near(size(exported)[axis], expected, `physical export envelope axis ${axis}`);
  assert.equal(exported.children.length, 10);
  assert.equal(
    part.python(preset.parameters, 'open'),
    part.python(preset.parameters, 'assembled'),
    'native physical export remains closed while the preview is opened',
  );
  assert.deepEqual(part.dimensions(preset.parameters, 'open'), [110, 58, 61]);
  for (const [axis, expected] of [110, 58, 61].entries())
    near(size(opened)[axis], expected, `cover-lifted envelope axis ${axis}`);
});

test('body and lid retain rounded outside corners rather than square box envelopes', () => {
  for (const target of [closed.children[0], closed.children[1]]) {
    for (const x of [-41.3, 41.3])
      for (const y of [-28.8, 28.8])
        assert.equal(vertical(target, x, y).length, 0, `rounded corner clears ${x},${y}`);
    assert.ok(
      vertical(target, 41.3, 0).length > 0,
      'the straight long-side contour remains present',
    );
  }
});

test('the two mounting ears have real 4 mm holes through their full thickness', () => {
  assert.equal(grandadoSpec.earCenters.length, 2);
  const body = closed.children[0];
  for (const [x, y] of grandadoSpec.earCenters) {
    assert.ok(Math.abs(x) > 83 / 2, 'ear mounting axis projects beyond the nominal body');
    assert.equal(vertical(body, x, y).length, 0, `mounting hole at ${x},${y} is open`);
    for (const offset of [-1.8, 1.8])
      assert.equal(
        vertical(body, x, y + offset).length,
        0,
        `mounting clearance retains the 4 mm bore at ${x},${y + offset}`,
      );
    for (const offset of [-2.2, 2.2])
      assert.ok(
        vertical(body, x, y + offset).length > 0,
        `ear material surrounds the drilled opening at ${x},${y + offset}`,
      );
  }
});

test('the floor has six hollow PCB bosses whose blind bores preserve a closed floor', () => {
  assert.equal(grandadoSpec.pcbCenters.length, 6);
  const body = closed.children[0];
  const floor = vertical(body, 0, 0)[0];
  assert.ok(floor, 'the enclosure has a continuous floor at the center');
  for (const [x, y] of grandadoSpec.pcbCenters) {
    const bore = vertical(body, x, y)[0];
    const rim = vertical(body, x, y + 2.2)[0];
    const underside = vertical(body, x, y, -30, 1)[0];
    assert.ok(bore && rim && underside, `PCB boss at ${x},${y} is present`);
    assert.ok(rim.point.z - bore.point.z > 2, 'the PCB fixing hole is recessed into its boss');
    assert.ok(rim.point.z - floor.point.z > 2, 'the PCB boss projects above the floor');
    assert.ok(bore.point.z - underside.point.z > 1, 'blind PCB bore leaves floor stock beneath it');
    near(underside.point.z, -17.5, 'PCB bore does not pierce the external bottom');
  }
});

test('four tall body posts retain separate brass threaded inserts beneath matching lid holes', () => {
  assert.equal(grandadoSpec.screwCenters.length, 4);
  const body = closed.children[0];
  const lid = closed.children[1];
  for (const [index, [x, y]] of grandadoSpec.screwCenters.entries()) {
    const postRim = vertical(body, x - Math.sign(x) * 3.2, y)[0];
    const postBore = vertical(body, x, y)[0];
    assert.ok(postRim && postBore, `lid post ${index + 1} has stock and a receptacle`);
    assert.ok(postRim.point.z - postBore.point.z > 4, 'post receptacle is a real recessed bore');
    assert.equal(vertical(lid, x, y).length, 0, `lid hole ${index + 1} goes through the cover`);
    assert.equal(vertical(lid, x, y + 1.8).length, 0, 'lid clearance accepts the 4 mm axis');
    assert.ok(
      vertical(lid, x - Math.sign(x) * 3.2, y).length > 0,
      'cover retains stock around each screw opening',
    );
    const insert = closed.children[index + 2];
    assert.equal(vertical(insert, x, y).length, 0, 'brass insert has an axial threaded opening');
    assert.ok(vertical(insert, x - Math.sign(x) * 1.9, y).length > 0, 'insert has a metal sleeve');
  }
  const lidMaterials: { transparent: boolean; opacity: number }[] = [];
  lid.traverse((object) => {
    if (object instanceof Mesh)
      lidMaterials.push(...(Array.isArray(object.material) ? object.material : [object.material]));
  });
  assert.ok(lidMaterials.length > 0);
  assert.ok(
    lidMaterials.every((material) => !material.transparent && material.opacity === 1),
    'the photographed white cover is opaque despite the inconsistent listing title',
  );
});

test('opening the case lifts only its cover and four screws while all floor hardware stays fixed', () => {
  assert.equal(grandadoPieces('assembled').length, 10);
  assert.equal(grandadoPieces('open').length, 10);
  assert.equal(opened.children.length, closed.children.length);
  for (const index of [0, 2, 3, 4, 5]) {
    assert.deepEqual(bounds(opened.children[index]), bounds(closed.children[index]));
  }
  for (const index of [1, 6, 7, 8, 9]) {
    const a = bounds(closed.children[index]);
    const b = bounds(opened.children[index]);
    near(b.min.z - a.min.z, 26, `part ${index} lifts with the cover`);
    near(b.max.z - a.max.z, 26, `part ${index} retains its height`);
    for (const axis of ['x', 'y'] as const) {
      near(b.min[axis], a.min[axis], `part ${index} retains its ${axis} placement`);
      near(b.max[axis], a.max[axis], `part ${index} retains its ${axis} envelope`);
    }
  }
});

test('the detailed case remains one purchased product with the same catalog identity in either pose', () => {
  assert.equal(preset.id, 'grandado-83-58-35-clear');
  assert.equal(matchingPresetId(part, preset.parameters), preset.id);
  for (const state of ['assembled', 'open']) {
    const project: ReturnType<typeof createProject> = addProduct(
      createProject('Grandado installation'),
      [part],
      {
        part,
        parameters: preset.parameters,
        state,
        presetId: preset.id,
      },
    ).project;
    assert.equal(
      project.configurations.length,
      1,
      'supplied screws and inserts are not extra orders',
    );
    assert.equal(project.occurrences.length, 1, 'the whole case is a single purchased occurrence');
    assert.equal(project.configurations[0].supply, 'purchased');
    assert.equal(project.configurations[0].presetId, preset.id);
    assert.equal(project.configurations[0].state, 'assembled');
    assert.deepEqual(project.configurations[0].parameters, preset.parameters);
  }
});

test('installation poses omit the factory lid while retaining its original body and hardware', () => {
  for (const [state, count, height] of [
    ['body-only', 5, 23.8],
    ['body-with-screws', 9, 34.6],
  ] as const) {
    assert.deepEqual(part.validate(preset.parameters, state), []);
    assert.equal(grandadoPieces(state).length, count);
    const model = part.buildGeometry(preset.parameters, state);
    try {
      assert.equal(model.children.length, count);
      near(size(model)[2], height, state);
      assert.deepEqual(part.dimensions(preset.parameters, state), [110, 58, height]);
      assert.notEqual(
        part.python(preset.parameters, state),
        part.python(preset.parameters, 'assembled'),
      );
    } finally {
      disposeModel(model);
    }
  }
});

test('delivered body heights and six-millimetre ears replace their photograph estimates', () => {
  const body = closed.children[0];
  near(grandadoSpec.bodyTop - grandadoSpec.baseZ, 22, 'hard body height');
  near(grandadoSpec.sealingRimTop - grandadoSpec.baseZ, 23.8, 'body including raised rim');
  const hard = vertical(body, 0, 28.6)[0];
  const rim = vertical(body, 0, 26.35)[0];
  assert.ok(hard && rim);
  near(hard.point.z, 4.5, 'source hard seating face');
  near(rim.point.z - hard.point.z, 1.8, 'measured raised rim');
  for (const x of [-49.5, 49.5]) {
    const top = vertical(body, x, 3)[0];
    const bottom = vertical(body, x, 3, -30, 1)[0];
    assert.ok(top && bottom);
    near(top.point.z - bottom.point.z, 6, 'actual ear thickness');
    near(bottom.point.z, grandadoSpec.baseZ, 'ear bottom datum');
  }
});

test('the measured raised rim has supported stock and fits the reconstructed factory channel', () => {
  const body = closed.children[0],
    lid = closed.children[1];
  for (const [x, y] of [
    [0, 26.35],
    [0, -26.35],
    [38.85, 0],
    [-38.85, 0],
  ]) {
    const top = vertical(body, x, y)[0];
    const below = vertical(body, x, y, 1, 1)[0];
    const lidFloor = vertical(lid, x, y, grandadoSpec.sealingRimTop + 0.01, 1)[0];
    assert.ok(top && below && lidFloor);
    near(top.point.z, 6.3, 'raised rim top');
    near(below.point.z, 2.5, 'broad inferred ledge supports the inboard raised rim');
    assert.ok(
      lidFloor.point.z > top.point.z,
      'factory lid accepts the measured rim without solid intersection',
    );
    near(lidFloor.point.z, grandadoSpec.lidBottom + 2, 'factory channel measured nominal depth');
  }
  near(
    grandadoSpec.bodyTop - grandadoSpec.screwBlindBottomZ,
    11,
    'estimated bore depth remains referenced to hard face',
  );
  near(grandadoSpec.bodyTop - grandadoSpec.insertTopZ, 0.1, 'insert remains below hard face');
  near(
    grandadoSpec.insertTopZ - grandadoSpec.insertBottomZ,
    4.6,
    'estimated insert length retained',
  );
  near(
    grandadoSpec.screwUnderHeadZ - grandadoSpec.screwTipZ,
    14.3,
    'factory screw geometry retained',
  );
});

test('project saving preserves replacement-cover installation without adding a second purchased unit', () => {
  const saved = addProduct(createProject('Replacement cover'), [part], {
    part,
    parameters: preset.parameters,
    state: 'body-with-screws',
    presetId: preset.id,
  }).project;
  const complete = addProduct(createProject('Complete box'), [part], {
    part,
    parameters: preset.parameters,
    state: 'assembled',
    presetId: preset.id,
  }).project;
  assert.equal(saved.configurations.length, 1);
  assert.equal(saved.occurrences.length, 1);
  assert.equal(saved.configurations[0].state, 'body-with-screws');
  assert.equal(saved.configurations[0].presetId, preset.id);
  assert.deepEqual(saved.configurations[0].procurement, complete.configurations[0].procurement);
});
