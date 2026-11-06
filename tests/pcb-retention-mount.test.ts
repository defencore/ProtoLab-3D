import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import part from '../src/parts/pcb-retention-mount/part';
import {
  carrierShape,
  components,
  layout,
  pieces,
} from '../src/parts/pcb-retention-mount/lib/model';
import { pcbBridgeLayout } from '../src/core/pcb-retention-bridge';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import {
  initializeManifoldGeometry,
  manifoldBoundaryComponent,
} from '../src/core/assembly/manifold-boundary';
import type { Parameters } from '../src/core/types';
import { box, subtract, type Shape } from '../src/core/assembly/boundary/shapes';

before(initializeManifoldGeometry);

function volume(shape: Shape): number {
  const model = manifoldBoundaryComponent(shape, 'Support geometry witness', 0xffffff);
  let sum = 0;
  try {
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const p = object.geometry.getAttribute('position');
      for (let i = 0; i < p.count; i += 3) {
        const a = new Vector3().fromBufferAttribute(p, i),
          b = new Vector3().fromBufferAttribute(p, i + 1),
          c = new Vector3().fromBufferAttribute(p, i + 2);
        sum += a.dot(b.cross(c)) / 6;
      }
    });
    return sum;
  } finally {
    disposeModel(model);
  }
}

test('mixed PCB presets retain physical compositions and valid implemented inspection states', () => {
  for (const preset of part.presets) {
    const p = preset.parameters,
      d = layout(p),
      physical = components(p);
    assert.equal(d.boards.length, Number(p.boardCount));
    assert.equal(physical.length, 1 + (p.lockEnabled ? Math.max(1, Number(p.boardCount) - 1) : 0));
    assert.equal(new Set(physical.map((c) => c.id)).size, physical.length);
    for (const state of part.states!.filter((s) => !s.availableWhen || s.availableWhen(p))) {
      assert.deepEqual(validateParameters(part, p, state.id), [], preset.id + '/' + state.id);
      assert.deepEqual(
        pieces(p, state.id, false).map((v) => v.component.parameters),
        physical.map((v) => v.parameters),
      );
    }
    assert.deepEqual(
      part.composition!({ ...p, showReferences: !p.showReferences }),
      part.composition!(p),
    );
  }
  const mixed = layout(part.presets.find((p) => p.id === 'daq-mixed-60-120')!.parameters);
  assert.deepEqual(
    mixed.boards.map((b) => [b.x - 94, b.length, b.width]),
    [
      [-94, 60, 80],
      [-24, 120, 80],
    ],
  );
  assert.equal(mixed.specs[0].centerX - 94, -29);
  assert.deepEqual(mixed.specs[0].stationCentres, [-22.5, 25.5]);
});

test('identical repeated bridges reuse a local physical definition and print separately on Z0', () => {
  const repeated = part.presets.find((p) => p.id === 'four-under-supported')!.parameters;
  const definitions = components(repeated).slice(1);
  assert.equal(definitions.length, 3);
  for (const definition of definitions)
    assert.deepEqual(definition.parameters, definitions[0].parameters);
  assert.equal(new Set(definitions.map((c) => c.placement.translation[0])).size, 3);
  for (const preset of part.presets) {
    const model = part.buildExportGeometry!(preset.parameters, 'print');
    try {
      model.updateMatrixWorld(true);
      const boxes = model.children.map((child) => new Box3().setFromObject(child, true));
      for (const box of boxes) assert.ok(Math.abs(box.min.z) < 0.002, preset.id + ' bed contact');
      for (let i = 1; i < boxes.length; i++)
        assert.ok(boxes[i].min.x - boxes[i - 1].max.x > 7.99, preset.id + ' bed gap');
    } finally {
      disposeModel(model);
    }
  }
});

test('side strips and underside rib parameters change actual support geometry', () => {
  const p = { ...part.defaults, showReferences: false };
  const volumes = Object.fromEntries(
    ['none', 'side', 'under', 'both'].map((mode) => [
      mode,
      volume(carrierShape({ ...p, antiFlexSupports: mode })),
    ]),
  );
  assert.ok(volumes.side > volumes.none + 1);
  assert.ok(volumes.under > volumes.none + 1);
  assert.ok(volumes.both > Math.max(volumes.side, volumes.under) + 1);
  assert.ok(
    volume(carrierShape({ ...p, antiFlexSupports: 'under', supportPitch: 15 })) >
      volume(carrierShape({ ...p, antiFlexSupports: 'under', supportPitch: 60 })) + 1,
  );
});

test('enabled locks have local lower contact lands independently of extra support modes', () => {
  const p = { ...part.defaults, antiFlexSupports: 'none', showReferences: false };
  const d = layout(p),
    spec = d.specs[0],
    carrier = carrierShape(p);
  const open = carrierShape({ ...p, lockEnabled: false });
  for (const cy of spec.stationCentres) {
    // Isolate the middle of the lock land from the enlarged corner-pocket floors.
    const witness = box(
      [3, 1, 0.3],
      [spec.centerX - spec.gap / 2 - 3, cy - 1.5 - 0.5, d.seatZ - 0.3],
    );
    assert.ok(volume(carrier) - volume(subtract(carrier, witness)) > 0.85);
    assert.ok(Math.abs(volume(open) - volume(subtract(open, witness))) < 0.01);
  }
});

test('hidden reference and inactive board controls do not redefine the physical carrier', () => {
  const p = { ...part.defaults, antiFlexSupports: 'none', mountingHoles: false };
  const edited = {
    ...p,
    showReferences: false,
    board4Length: 175,
    board4Width: 120,
    supportPitch: 20,
    mountingHoleDiameter: 5,
    mountingEdgeInset: 8,
  };
  assert.deepEqual(part.identityParameters!(edited), part.identityParameters!(p));
  assert.deepEqual(part.composition!(edited), part.composition!(p));
  const noLock = { ...p, lockEnabled: false };
  assert.deepEqual(
    part.identityParameters!({ ...noLock, boardGap: 20 }),
    part.identityParameters!(noLock),
  );
  assert.equal(part.states!.filter((s) => !s.availableWhen || s.availableWhen(noLock)).length, 2);
  assert.ok(validateParameters(part, noLock, 'service').length);
});

test('bridge public datums reject impossible mortise, station and seating geometry', () => {
  const valid = layout(part.defaults).specs[0];
  for (const patch of [
    { stationCentres: [] },
    { stationCentres: [0, 10] },
    { gap: 8 },
    { seatZ: valid.baseZ + 4.9 },
    { latchAnchor: 0 },
    { clearance: Number.NaN },
  ])
    assert.throws(() => pcbBridgeLayout({ ...valid, ...patch }));
  const patches: Parameters[] = [
    { boardCount: 2.5 },
    { seatHeight: 4 },
    { baseThickness: 5, seatHeight: 9 },
  ];
  for (const patch of patches)
    assert.ok(validateParameters(part, { ...part.defaults, ...patch }, 'assembled').length);
  assert.match(
    validateParameters(part, { ...part.defaults, seatHeight: 4 }, 'assembled').join(' '),
    /at least 5 mm/,
  );
  const enabled = part.updateParameters!(
    { ...part.defaults, lockEnabled: true, baseThickness: 5, seatHeight: 6 },
    'lockEnabled',
  );
  assert.equal(enabled.seatHeight, 10);
  assert.deepEqual(validateParameters(part, enabled, 'assembled'), []);
});
