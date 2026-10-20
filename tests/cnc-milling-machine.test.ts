import assert from 'node:assert/strict';
import test from 'node:test';
import machine, {
  millingComponents,
  millingComposition,
  millingPieces,
  millingLibraries,
  millingLayout,
} from '../src/parts/cnc-milling-machine/part';
import frame, { frameHoles, frameManufacturing } from '../src/parts/cnc-frame-part/part';
import { validateParameters } from '../src/core/validation';
import type { Parameters } from '../src/core/types';
import { Euler, Vector3 } from 'three';
import { spindleMountLayout, spindleMountDefaults } from '../src/parts/cnc-spindle-mount/part';

test('CNC has independent library configurations, fixed canonical BOM and explicit manufacturer versus DIY limits', () => {
  assert.deepEqual(validateParameters(machine, machine.defaults, 'assembled'), []);
  const canonical = millingComposition(machine.defaults),
    ids = canonical.components.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of canonical.components) {
    const part = millingLibraries.find((p) => p.id === c.libraryId)!;
    assert.ok(part, c.libraryId);
    assert.deepEqual(validateParameters(part, c.parameters, c.state), [], c.id);
    assert.equal(c.quantity, 1);
  }
  for (const state of machine.states!) {
    const q = { ...machine.defaults, xPosition: 12, yPosition: 92, zPosition: 0 };
    // An authored BOM is independent of inspection input, including rejected continuous poses.
    assert.deepEqual(millingComposition(q), canonical, state.id);
    assert.ok(millingPieces(q, state.id).length > 0);
  }
  for (const [library, count] of [
    ['cnc-guide-rail', 6],
    ['cnc-guide-carriage', 12],
    ['cnc-precision-axis', 3],
    ['cnc-feed-servo', 3],
    ['cnc-precision-coupling', 3],
    ['cnc-servo-drive', 3],
    ['cnc-linear-encoder', 6],
  ] as const)
    assert.equal(canonical.components.filter((c) => c.libraryId === library).length, count);
  assert.equal(
    canonical.components
      .find((c) => c.id === 'cutting-spindle')!
      .procurement?.designation.includes('220 V'),
    true,
  );
  assert.ok(canonical.issues.some((i) => i.includes('not reproduced')));
  const v = millingLayout(machine.defaults);
  assert.deepEqual([v.workX, v.workY, v.workZ], [800, 1500, 200]);
  assert.ok(v.tiebarTop < v.bedBottom);
  assert.ok(v.panFloor + 2 < v.tableBottom - 40);
  assert.equal(canonical.components.filter((c) => c.id.startsWith('stand-leg-')).length, 4);
  assert.equal(
    canonical.components.filter((c) => c.libraryId === 'cnc-process-accessory').length,
    2,
  );
});

test('CNC machining patterns retain edge stock, explicit thread pitch and manufacturable single blanks', () => {
  assert.ok(frame.validate({ ...frame.defaults, holes: '[]' }, 'default').length === 0);
  assert.ok(
    frame.validate(
      {
        ...frame.defaults,
        holes: JSON.stringify([{ axis: 'z', at: [0, 0, 0], diameter: NaN, depth: 10 }]),
      },
      'default',
    ).length > 0,
  );
  assert.ok(
    frame.validate(
      {
        ...frame.defaults,
        holes: JSON.stringify([{ axis: 'y', at: [79, -10, 0], diameter: 6, depth: 20 }]),
      },
      'default',
    ).length > 0,
  );
  for (const piece of millingComponents(machine.defaults).filter(
    (c) => c.component.libraryId === 'cnc-frame-part',
  )) {
    assert.deepEqual(frame.validate(piece.component.parameters, 'default'), [], piece.component.id);
    assert.ok(piece.component.manufacturing?.requirements.length);
    for (const h of frameHoles(piece.component.parameters))
      if (h.threadPitch) assert.match(h.threadDesignation!, /^M\d/);
  }
});

test('rail-pad billet dimensions contain the actual integral shoulder', () => {
  for (const shoulderHeight of [0, 6, 10]) {
    const p = {
      ...frame.defaults,
      role: 'rail-pad',
      sizeX: 160,
      sizeY: 120,
      sizeZ: 20,
      shoulderHeight,
      holes: '[]',
    };
    assert.deepEqual(frame.validate(p, 'default'), []);
    const manufacturedBlank = frameManufacturing(p)
        .blank.match(/\d+(?:\.\d+)?/g)!
        .map(Number),
      actualEnvelope = frame.dimensions(p, 'default');
    assert.equal(manufacturedBlank.length, 3);
    assert.equal(manufacturedBlank[2], actualEnvelope[2]);
  }
});

test('all sourced spindle alternatives retain compatible clamp fastener engagement and coherent controls', () => {
  for (const option of machine.parameters.find((p) => p.key === 'spindle')!.options!) {
    const q: Parameters = { ...machine.defaults, spindle: option.value };
    assert.deepEqual(validateParameters(machine, q, 'assembled'), [], option.value);
    const list = millingComponents(q),
      layout = millingLayout(q);
    const clamp = list.find((c) => c.component.id === 'spindle-clamp-bolt-0')!.component.parameters;
    assert.equal(
      clamp.length,
      ({ 65: 55, 80: 65, 100: 75 } as Record<number, number>)[layout.spindle.bodyDiameter],
    );
    const vfd = list.find((c) => c.component.id === 'spindle-variable-frequency-drive')!;
    assert.equal(
      vfd.component.parameters.model,
      layout.spindle.power > 2200 ? 'gpenny-huanyang-4kw-220v' : 'atv12hu22m2',
    );
  }
});

test('the lowered spindle clamp and its bolts use the actual saddle drilling and retain blind-thread engagement', () => {
  for (const option of machine.parameters.find((p) => p.key === 'spindle')!.options!) {
    const p = { ...machine.defaults, spindle: option.value },
      v = millingLayout(p),
      pieces = millingComponents(p),
      mount = spindleMountLayout({ ...spindleMountDefaults, bodyDiameter: v.spindle.bodyDiameter }),
      saddle = pieces.find((p) => p.component.id === 'moving-z-saddle')!.component,
      holes = frameHoles(saddle.parameters);
    for (const [i, hole] of mount.rearMountHoleCenters.entries()) {
      const bolt = pieces.find((p) => p.component.id === 'spindle-mount-back-bolt-' + i)!.component,
        rotation = new Euler(
          ...(bolt.placement.rotation.map((n) => (n * Math.PI) / 180) as [number, number, number]),
          'ZYX',
        ),
        headSeat = new Vector3(
          0,
          0,
          (Number(bolt.parameters.length) - Number(bolt.parameters.headHeight)) / 2,
        )
          .applyEuler(rotation)
          .add(new Vector3(...bolt.placement.translation)),
        expected = new Vector3(hole[0], v.zPlateBack, v.clampLow + 100 + hole[2]);
      assert.ok(headSeat.distanceTo(expected) < 1e-6, bolt.id);
      assert.ok(
        holes.some(
          (h) =>
            h.axis === 'y' &&
            Math.abs(h.at[0] - expected.x) < 1e-6 &&
            Math.abs(h.at[2] + saddle.placement.translation[2] - expected.z) < 1e-6,
        ),
        bolt.id,
      );
      assert.equal(Number(bolt.parameters.length) - v.movingPlateThickness, 10);
      assert.ok(Number(bolt.parameters.length) - v.movingPlateThickness < mount.mountThreadDepth);
    }
    for (let i = 0; i < 2; i++) {
      const bolt = pieces.find((p) => p.component.id === 'spindle-clamp-bolt-' + i)!.component,
        engagement =
          Number(bolt.parameters.length) -
          mount.capBoltGripLength -
          Number(spindleMountDefaults.splitGap);
      assert.ok(engagement >= 8 && engagement < mount.clampThreadDepth, bolt.id);
    }
    assert.equal(v.beamCenter - v.tableTop, 400);
  }
});

test('exportable CNC poses use finite axis endpoints and midpoints with no public continuous path control', () => {
  for (const field of machine.parameters.filter((p) =>
    ['xPosition', 'yPosition', 'zPosition'].includes(p.key),
  ))
    assert.equal(field.visibleWhen!(machine.defaults, 'assembled'), false);
  for (const xPosition of [0, 50, 100])
    assert.deepEqual(
      validateParameters(machine, { ...machine.defaults, xPosition }, 'assembled'),
      [],
    );
  for (const key of ['xPosition', 'yPosition', 'zPosition']) {
    const p = { ...machine.defaults, [key]: 12 };
    assert.ok(validateParameters(machine, p, 'assembled').some((e) => e.includes('named axis')));
  }
  for (const state of machine.states!)
    assert.deepEqual(validateParameters(machine, machine.defaults, state.id), []);
});
