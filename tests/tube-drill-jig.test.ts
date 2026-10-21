import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import part from '../src/parts/tube-drill-jig/part';
import {
  layout,
  selectGuide,
  spacerStack,
  spacerSizes,
  socketWeb,
} from '../src/parts/tube-drill-jig/lib/selection';
import { jigPieces, configuredPieces, printLayout } from '../src/parts/tube-drill-jig/lib/model';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';

const component = (p: typeof part.defaults, id: string) => {
  const piece = jigPieces(p).find((item) => item.id === id);
  assert.ok(piece, id);
  return piece;
};

const assertClosedManifold = (object: Mesh) => {
  assert.ok(object.geometry.getAttribute('position').count > 0);
  assert.ok(Array.from(object.geometry.getAttribute('position').array).every(Number.isFinite));
  const geometry = object.geometry,
    positions = geometry.getAttribute('position');
  const index = geometry.index,
    edges = new Map<string, number>();
  const vertex = (i: number) =>
    [positions.getX(i), positions.getY(i), positions.getZ(i)]
      .map((v) => Math.round(v * 1e5))
      .join(',');
  for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
    const vertices = [0, 1, 2].map((offset) => vertex(index ? index.getX(i + offset) : i + offset));
    for (let edge = 0; edge < 3; edge++) {
      const a = vertices[edge],
        b = vertices[(edge + 1) % 3];
      if (a === b) continue;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  assert.ok(
    [...edges.values()].every((uses) => uses === 2),
    `${object.name}: closed manifold preview after 0.00001 mm vertex welding`,
  );
};

test('all tube jig presets and all three inspection and printing states are valid', () => {
  assert.ok(part.presets.length > 0);
  for (const [tubeOD, holeCount] of [
    [25, '4'],
    [60, '8'],
    [90, '12'],
  ] as const)
    assert.ok(
      part.presets.some(
        (preset) =>
          preset.parameters.tubeOD === tubeOD && preset.parameters.holeCount === holeCount,
      ),
    );
  for (const preset of part.presets) {
    for (const state of ['assembled', 'exploded', 'print-layout']) {
      assert.deepEqual(
        validateParameters(part, preset.parameters, state),
        [],
        `${preset.id}/${state}`,
      );
    }
  }
});

test('a 3 mm drill uses exactly matched 3 x 9 x 4 mm MR93ZZ bearings', () => {
  assert.deepEqual(selectGuide(part.defaults).bearing, {
    id: 'MR93ZZ',
    bore: 3,
    outer: 9,
    width: 4,
  });
  assert.equal(
    selectGuide({ ...part.defaults, holeMode: 'tap', thread: 'M3' }).bearing?.id,
    '692XZZ',
  );
  for (const [thread, drill] of [
    ['M4', 3.3],
    ['M5', 4.2],
    ['M8', 6.8],
  ] as const) {
    const p = { ...part.defaults, holeMode: 'tap', thread };
    assert.equal(selectGuide(p).kind, 'bushing');
    assert.equal(selectGuide(p).drill, drill);
    assert.equal(selectGuide(p).bearing, undefined);
    assert.match(
      validateParameters(part, { ...p, guide: 'bearing' }, 'assembled').join(' '),
      /No exact bearing bore/,
    );
  }
  assert.equal(
    selectGuide({ ...part.defaults, holeMode: 'tap', thread: 'M6' }).bearing?.id,
    'MR105ZZ',
  );
});

test('4, 8 and 12 indexed sockets share one movable cassette and two bearings total', () => {
  for (const count of [4, 8, 12]) {
    const p = { ...part.defaults, holeCount: String(count) },
      d = layout(p);
    assert.equal(d.stations.length, count);
    assert.equal(jigPieces(p).filter((piece) => piece.id.startsWith('cartridge-')).length, 1);
    assert.equal(jigPieces(p).filter((piece) => piece.id.startsWith('retainer-')).length, 1);
    const bearings = part.composition!(p).components.filter((c) =>
      c.procurement?.designation.startsWith('MR93ZZ'),
    );
    assert.equal(bearings.length, 2);
    assert.ok(
      bearings.every((c) => c.libraryId === 'purchased-component' && c.supply === 'purchased'),
    );
    for (const [index, station] of d.stations.entries()) {
      assert.equal(station.angle, (index * 360) / count);
      assert.equal(station.z, d.axisHeight);
      assert.ok(Math.abs(Math.hypot(...station.direction) - 1) < 1e-12);
    }
    assert.deepEqual(
      configuredPieces(p, 'assembled').map((c) => c.component),
      configuredPieces(p, 'exploded').map((c) => c.component),
    );
  }
  const bushing = part.composition!({ ...part.defaults, holeMode: 'tap', thread: 'M4' }).components;
  assert.equal(
    bushing.filter((c) => c.procurement?.designation.startsWith('Custom hardened')).length,
    1,
  );
  const plain = jigPieces({ ...part.defaults, guide: 'plain' });
  assert.equal(
    plain.filter((piece) => piece.id.startsWith('guide-') || piece.id.startsWith('retainer-'))
      .length,
    0,
  );
});

test('changing tube diameter, pattern or drill preserves the same reusable cup', () => {
  const cup = component(part.defaults, 'collar');
  for (const tubeOD of [25, 60, 90, 100]) {
    for (const holeCount of layout({ ...part.defaults, tubeOD }).availableCounts.map(String)) {
      for (const guide of ['auto', 'bushing', 'plain']) {
        const p = { ...part.defaults, tubeOD, holeCount, guide };
        assert.deepEqual(validateParameters(part, p, 'assembled'), []);
        assert.deepEqual(component(p, 'collar'), cup);
      }
    }
  }
  assert.notDeepEqual(component({ ...part.defaults, bodyCapacity: 120 }, 'collar'), cup);
});

test('changing end offset only changes measured stop rings and reference tube', () => {
  const fixed = (p: typeof part.defaults) =>
    jigPieces(p).filter((piece) => !piece.id.startsWith('spacer-') && piece.id !== 'workpiece');
  for (let endOffset = 3; endOffset <= 30; endOffset += 0.5) {
    const p = { ...part.defaults, endOffset };
    assert.deepEqual(validateParameters(part, p, 'assembled'), []);
    assert.deepEqual(fixed(p), fixed(part.defaults));
    const stack = spacerStack(p);
    assert.ok(stack.every((size) => (spacerSizes as readonly number[]).includes(size)));
    assert.equal(
      stack.reduce((sum, size) => sum + size, 0),
      30 - endOffset,
    );
  }
  assert.deepEqual(spacerStack({ ...part.defaults, endOffset: 10 }), [20]);
  assert.deepEqual(spacerStack({ ...part.defaults, endOffset: 20 }), [10]);
  assert.deepEqual(spacerStack({ ...part.defaults, endOffset: 30 }), []);
  for (const stopThickness of [5, 8, 12]) {
    const p = { ...part.defaults, stopThickness, endOffset: 14.5 },
      d = layout(p);
    assert.equal(d.axisHeight - d.spacerHeight, 14.5);
  }
});

test('the tube clamps and indexed head stay fixed while the complete cassette moves', () => {
  const p = { ...part.defaults, holeCount: '12' };
  const fixedIds = [
    'collar',
    'index-lower',
    'index-upper',
    'clamp-crown',
    'centering-liner',
    'clamp-pad-1',
    'clamp-pad-2',
    'clamp-pad-3',
    'clamp-nut-1',
    'clamp-screw-1',
  ];
  for (let station = 1; station <= 12; station++) {
    const moved = { ...p, station },
      d = layout(moved);
    for (const id of fixedIds) assert.deepEqual(component(moved, id), component(p, id));
    for (const id of ['cartridge-1', 'retainer-1', 'guide-1-1', 'guide-1-2', 'bearing-spacer']) {
      const shape = component(moved, id).shape;
      assert.equal(shape.kind, 'transform');
      if (shape.kind !== 'transform') throw new Error('Expected indexed cassette transform.');
      assert.deepEqual(shape.rotation, [0, 0, d.active.angle]);
      assert.deepEqual(shape.translation, [0, 0, d.axisHeight]);
    }
    assert.equal(d.active.index, station - 1);
  }
});

test('finite sockets retain at least 2.4 mm webs and reject dense patterns on small tubes', () => {
  for (const [tubeOD, counts] of [
    [25, [4]],
    [60, [4, 8]],
    [90, [4, 8, 12]],
  ] as const) {
    assert.deepEqual(layout({ ...part.defaults, tubeOD }).availableCounts, counts);
    for (const holeCount of [4, 8, 12]) {
      const p = { ...part.defaults, tubeOD, holeCount: String(holeCount) },
        d = layout(p);
      const errors = validateParameters(part, p, 'assembled');
      if ((counts as readonly number[]).includes(holeCount)) {
        assert.ok(d.minWeb >= 2.4);
        assert.deepEqual(errors, []);
      } else {
        assert.ok(d.minWeb < 2.4);
        assert.match(errors.join(' '), /web|socket|ligament/i);
      }
    }
  }
  for (const [validOD, invalidOD, count] of [
    [51, 50, '8'],
    [80, 79, '12'],
  ] as const) {
    assert.deepEqual(
      validateParameters(
        part,
        { ...part.defaults, tubeOD: validOD, holeCount: count },
        'assembled',
      ),
      [],
    );
    assert.match(
      validateParameters(
        part,
        { ...part.defaults, tubeOD: invalidOD, holeCount: count },
        'assembled',
      ).join(' '),
      /web|socket|ligament/i,
    );
  }
  assert.ok(socketWeb(45.2, 47.6, 20.3, 12) > 5);
  const small = { ...part.defaults, tubeOD: 25, holeCount: '4' };
  assert.equal(jigPieces(small).filter((piece) => piece.id.startsWith('guide-')).length, 2);
  assert.ok(layout(small).drillReach > layout(part.defaults).drillReach + 30);
  assert.match(part.assessment!(small).join(' '), /drill|reach|length/i);
  for (const invalid of [
    { ...part.defaults, tubeWall: 0.3, tubeClearance: 0.1, spacerClearance: 1 },
    { ...part.defaults, tubeOD: 110 },
    { ...part.defaults, station: 5, holeCount: '4' },
    { ...part.defaults, station: 1.5 },
    { ...part.defaults, tubeOD: 12, tubeWall: 6 },
    { ...part.defaults, holeCount: '5' },
    { ...part.defaults, tubeOD: NaN },
    { ...part.defaults, endOffset: 31 },
    { ...part.defaults, endOffset: 10.2 },
    { ...part.defaults, endOffset: 3, holeDiameter: 8 },
  ])
    assert.ok(validateParameters(part, invalid, 'assembled').length, JSON.stringify(invalid));
});

test('removing the bottom stop opens a through fixture without changing the collar or head', () => {
  const through = { ...part.defaults, stopMode: 'through' };
  assert.deepEqual(validateParameters(part, through, 'assembled'), []);
  assert.equal(layout(through).endStop, false);
  assert.deepEqual(spacerStack(through), []);
  const end = jigPieces(part.defaults),
    open = jigPieces(through);
  assert.ok(end.some((piece) => piece.id === 'stop-plate'));
  assert.equal(end.filter((piece) => piece.id.startsWith('stop-screw-')).length, 4);
  assert.ok(
    open.every(
      (piece) =>
        piece.id !== 'stop-plate' &&
        !piece.id.startsWith('stop-screw-') &&
        !piece.id.startsWith('spacer-'),
    ),
  );
  for (const piece of open.filter((item) => item.id !== 'workpiece'))
    assert.deepEqual(
      piece,
      end.find((item) => item.id === piece.id),
    );
  assert.deepEqual(jigPieces({ ...through, endOffset: 47.25, stopThickness: 12 }), open);
  assert.deepEqual(
    component({ ...part.defaults, stopThickness: 12 }, 'collar'),
    component(part.defaults, 'collar'),
  );
});

test('larger guide diameters retain adequate seats, lock walls and outer screw webs', () => {
  const base = layout(part.defaults);
  for (const [holeDiameter, tubeOD, bodyCapacity] of [
    [5, 90, 110],
    [6, 100, 120],
    [8, 100, 120],
  ]) {
    const p = { ...part.defaults, holeDiameter, tubeOD, bodyCapacity },
      d = layout(p);
    assert.deepEqual(validateParameters(part, p, 'assembled'), []);
    assert.ok(d.barrelOD >= base.barrelOD);
    assert.ok(d.flangeWidth >= base.flangeWidth);
    assert.ok(d.lockFloor >= base.lockFloor);
    assert.ok(d.minWeb >= 2.4);
    assert.ok(d.outerWeb >= 2.4);
    assert.ok(d.pilotWall >= 2);
    assert.ok(d.capWall >= 2);
    assert.equal(jigPieces(p).filter((piece) => piece.id.startsWith('guide-')).length, 2);
  }
});

test('the universal 24-flat cup supports every drill station without protruding radial hardware', () => {
  for (const count of [4, 8, 12]) {
    const p = { ...part.defaults, holeCount: String(count) },
      d = layout(p);
    assert.equal(d.flatCount, 24);
    for (const station of d.stations) {
      for (const sign of [-1, 1]) {
        const projections = d.outline.map(
          ([x, y]) => sign * (x * station.direction[0] + y * station.direction[1]),
        );
        assert.ok(Math.abs(Math.max(...projections) - d.radius) < 1e-9);
        assert.equal(projections.filter((value) => Math.abs(value - d.radius) < 1e-9).length, 2);
      }
    }
    assert.ok(d.capEnd + 1.5 < d.radius);
  }
});

test('reference tube is removable and preview dimensions agree for bearing, bushing and printed guides', () => {
  for (const parameters of [
    part.defaults,
    { ...part.defaults, holeMode: 'tap', thread: 'M4', showTube: false },
    { ...part.defaults, guide: 'plain', tubeOD: 25, holeCount: '4' },
    { ...part.defaults, tubeOD: 100, bodyCapacity: 120, holeDiameter: 8 },
  ]) {
    const model = part.buildGeometry(parameters, 'assembled');
    try {
      assert.equal(model.children.length, part.composition!(parameters).components.length);
      let count = 0;
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        count++;
        assertClosedManifold(object);
      });
      assert.ok(count > 0);
      model.updateMatrixWorld(true);
      const actual = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
      const expected = part.dimensions(parameters, 'assembled');
      assert.ok(actual.every((value, i) => Math.abs(value - expected[i]) < 0.001));
    } finally {
      disposeModel(model);
    }
  }
  assert.equal(
    jigPieces({ ...part.defaults, showTube: false }).some((piece) => piece.id === 'workpiece'),
    false,
  );
});

test('printing layout contains only manufactured pieces on a flat, separated bed', () => {
  for (const parameters of [
    part.defaults,
    { ...part.defaults, tubeOD: 25, holeCount: '4' },
    { ...part.defaults, stopMode: 'through' },
    { ...part.defaults, tubeOD: 100, bodyCapacity: 120, holeDiameter: 8 },
  ]) {
    const printable = printLayout(parameters);
    assert.deepEqual(
      printable.map((piece) => piece.id).sort(),
      jigPieces(parameters)
        .filter((piece) => piece.supply === 'manufactured')
        .map((piece) => piece.id)
        .sort(),
    );
    assert.ok(printable.every((piece) => piece.supply === 'manufactured'));
    const configured = configuredPieces(parameters, 'print-layout');
    assert.deepEqual(
      configured.map((piece) => piece.component.id).sort(),
      printable.map((piece) => piece.id).sort(),
    );
    assert.ok(configured.every((piece) => piece.component.supply === 'manufactured'));
    const model = part.buildGeometry(parameters, 'print-layout');
    try {
      model.updateMatrixWorld(true);
      assert.equal(model.children.length, printable.length);
      const bounds = model.children.map((child) => new Box3().setFromObject(child, true));
      for (const [i, box] of bounds.entries()) {
        assert.ok(Math.abs(box.min.z) < 0.001, `${printable[i].id}: flat print datum`);
        assert.ok(box.max.z > 0.1, `${printable[i].id}: positive printed thickness`);
        for (const [j, other] of bounds.slice(i + 1).entries()) {
          assert.ok(
            box.max.x <= other.min.x - 0.1 ||
              other.max.x <= box.min.x - 0.1 ||
              box.max.y <= other.min.y - 0.1 ||
              other.max.y <= box.min.y - 0.1,
            `${printable[i].id}/${printable[i + j + 1].id}: separate print footprints`,
          );
        }
      }
      model.traverse((object) => {
        if (object instanceof Mesh) assertClosedManifold(object);
      });
      const actual = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
      const expected = part.dimensions(parameters, 'print-layout');
      assert.ok(actual.every((value, i) => Math.abs(value - expected[i]) < 0.001));
    } finally {
      disposeModel(model);
    }
  }
});
