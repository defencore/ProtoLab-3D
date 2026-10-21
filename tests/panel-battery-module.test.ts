import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import part from '../src/parts/panel-battery-module/part';
import { configuredPieces, pieces } from '../src/parts/panel-battery-module/lib/model';
import { latch } from '../src/parts/panel-battery-module/lib/closure';
import { layout } from '../src/parts/panel-battery-module/lib/layout';
import { ribbonRoute } from '../src/parts/panel-battery-module/lib/ribbon';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import type { Parameters } from '../src/core/types';

const packs = ['3S', '4S'] as const;
const states = ['assembled', 'unlocked', 'open', 'exploded', 'print-layout', 'panel-template'];
const printIds = (p: Parameters) =>
  pieces(p)
    .filter((piece) => piece.supply === 'manufactured' && piece.process !== 'drilling')
    .map((piece) => piece.id)
    .sort();
const parameters = (pack: string, extra: Parameters = {}): Parameters => ({
  ...part.defaults,
  pack,
  ...extra,
});

function assertClosedPositive(mesh: Mesh, label: string) {
  const position = mesh.geometry.getAttribute('position'),
    index = mesh.geometry.index,
    count = index?.count ?? position.count,
    edges = new Map<string, number>();
  assert.ok(position.count > 0, label);
  assert.ok(Array.from(position.array).every(Number.isFinite), label);
  assert.equal(count % 3, 0, label);
  const keys = Array.from({ length: position.count }, (_, i) =>
    [position.getX(i), position.getY(i), position.getZ(i)]
      .map((value) => Math.round(value * 1e5))
      .join(','),
  );
  let volume = 0;
  for (let i = 0; i < count; i += 3) {
    const ids = [0, 1, 2].map((offset) => (index ? index.getX(i + offset) : i + offset));
    const [a, b, c] = ids.map((id) => new Vector3().fromBufferAttribute(position, id));
    volume += a.dot(b.clone().cross(c)) / 6;
    if (new Set(ids.map((id) => keys[id])).size < 3) continue;
    for (let side = 0; side < 3; side++) {
      const edge = [keys[ids[side]], keys[ids[(side + 1) % 3]]].sort().join('/');
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  assert.ok(
    edges.size > 0 && [...edges.values()].every((uses) => uses === 2),
    label + ': closed manifold',
  );
  assert.ok(volume > 0, label + ': positive material');
  return volume;
}

test('both battery-module sizes support installation, cell service and manufacturing states', () => {
  assert.equal(part.id, 'panel-battery-module');
  assert.deepEqual(part.states?.map((state) => state.id).sort(), [...states].sort());
  for (const pack of packs) {
    assert.ok(
      part.presets.some((preset) => preset.parameters.pack === pack),
      pack,
    );
    for (const panelThickness of [1, 2, 6])
      for (const state of states)
        assert.deepEqual(
          validateParameters(part, parameters(pack, { panelThickness }), state),
          [],
          `${pack}/${panelThickness}/${state}`,
        );
  }
  for (const preset of part.presets)
    for (const state of states)
      assert.deepEqual(
        validateParameters(part, preset.parameters, state),
        [],
        preset.id + '/' + state,
      );
  for (const extra of [
    { pack: '2S' },
    { panelThickness: 0.5 },
    { panelThickness: 6.5 },
    { panelThickness: NaN },
    { showCells: 'yes' },
    { showPanel: 1 },
  ] as Parameters[])
    assert.ok(
      validateParameters(part, parameters('4S', extra), 'assembled').length,
      JSON.stringify(extra),
    );
  assert.ok(validateParameters(part, part.defaults, 'unknown-state').length);
});

test('the selected holder, power connector and balance socket remain source-library occurrences', () => {
  for (const pack of packs) {
    const p = parameters(pack),
      d = layout(p);
    const components = configuredPieces(p, 'assembled').map((piece) => piece.component);
    const holder = components.find((component) => component.id === 'holder')!;
    assert.equal(holder.libraryId, 'li-ion-battery-holder');
    assert.equal(holder.parameters.model, `mpd-bk-18650-pc${d.cells * 2}`);
    assert.equal(holder.supply, 'purchased');
    const power = components.find((component) => component.id === 'power-connector')!;
    assert.equal(power.libraryId, 'electrical-connector');
    assert.equal(power.parameters.model, 'xt60e-f');
    const balance = components.find((component) => component.id === 'balance-socket')!;
    assert.equal(balance.supply, 'purchased');
    assert.equal(balance.libraryId, 'signal-connector');
    assert.equal(balance.parameters.model, `xh254-balance-header-ra-${d.cells + 1}`);
    assert.match(balance.notes!, /authored/i);
    assert.match(balance.notes!, /not.*manufacturer CAD/i);
    assert.equal(d.headerPins, d.cells + 1);
    assert.equal(d.balancePins.length, d.cells + 1);
    assert.equal(d.boardLength, 100);
    assert.deepEqual(d.boardCentre, [-5, 0]);
    assert.equal(d.boardLeft, -55);
    assert.equal(d.boardReliefs.length, 2);
    assert.ok(
      d.boardReliefs.every(([x]) => x < 0),
      'Only the two left clamp posts need open edge reliefs',
    );
    assert.deepEqual(d.balanceSupportAxes, [
      [-52.5, -11],
      [-52.5, 11],
    ]);
    assert.ok(d.balancePins.every(([x]) => x === -50.5));
    for (let i = 1; i < d.balancePins.length; i++)
      assert.ok(Math.abs(Math.abs(d.balancePins[i][1] - d.balancePins[i - 1][1]) - 2.54) < 1e-9);
    assert.equal(
      components.filter((component) => component.id.startsWith('cell-')).length,
      d.cells,
    );
    assert.ok(components.some((component) => component.id === 'prepared-board'));
    assert.ok(
      components.every((component) => !/^header-(?:board|carrier|insert)/.test(component.id)),
    );
    assert.equal(balance.placement.translation[0], -50.5);
    assert.equal(balance.placement.translation[2], d.boardTop);
    assert.equal(components.filter((component) => component.id.includes('-insert-')).length, 2);
    const fasteners = components.filter((component) =>
      /(?:^|-)(?:screw|nut|insert|washer|stop)(?:-|$)/.test(component.id),
    );
    assert.ok(fasteners.length > 0);
    for (const fastener of fasteners) {
      const designation = fastener.name + ' ' + (fastener.procurement?.designation ?? '');
      assert.match(designation, fastener.id.startsWith('panel-') ? /\bM4\b/ : /\bM3\b/);
      assert.doesNotMatch(designation, /2-56|M2\.184/);
    }
    assert.ok(components.every((component) => !component.id.startsWith('lid-screw-')));
    const physicalIds = (state: string) =>
      configuredPieces(p, state)
        .map((piece) => piece.component.id)
        .sort();
    assert.deepEqual(physicalIds('open'), physicalIds('assembled'));
    assert.deepEqual(physicalIds('unlocked'), physicalIds('assembled'));
    assert.deepEqual(physicalIds('exploded'), physicalIds('assembled'));
  }
});

test('printing excludes purchased parts, the fabric sling, cells, panel and prepared main FR4 board', () => {
  for (const pack of packs) {
    const p = parameters(pack);
    const printed = configuredPieces(p, 'print-layout');
    assert.deepEqual(printed.map((piece) => piece.component.id).sort(), printIds(p));
    assert.ok(printed.every((piece) => piece.component.supply === 'manufactured'));
    const hidden = configuredPieces(
      parameters(pack, { showPanel: false, showCells: false }),
      'assembled',
    );
    assert.ok(hidden.every((piece) => !piece.component.id.startsWith('cell-')));
    assert.ok(hidden.some((piece) => piece.component.id === 'holder'));
    assert.ok(hidden.some((piece) => piece.component.id === 'power-connector'));
    assert.equal(hidden.filter((piece) => piece.component.id === 'prepared-board').length, 1);
    const ribbon = hidden.find((piece) => piece.component.id === 'extraction-ribbon')!.component;
    assert.equal(ribbon.supply, 'purchased');
    assert.match(ribbon.procurement!.designation, /ribbon|fabric/i);
  }
});

test('panel thickness selects a usable fastener without stretching the holder or module', () => {
  for (const pack of packs) {
    const base = layout(parameters(pack));
    for (const panelThickness of [1, 2, 6]) {
      const d = layout(parameters(pack, { panelThickness }));
      assert.deepEqual(d.holder, base.holder);
      assert.deepEqual(d.caseHoles, base.caseHoles);
      assert.equal(d.bodyLength, base.bodyLength);
      assert.equal(d.bodyWidth, base.bodyWidth);
      assert.ok(d.panelBoltLength >= panelThickness + 9.7);
      assert.equal(d.panelHoles.length, 4);
      assert.equal(d.caseHoles.length, 4);
      assert.equal(latch.coverAxes.length, 2);
    }
  }
});

test('both print kits are closed positive meshes, lie flat and stay separated', () => {
  for (const pack of packs) {
    const p = parameters(pack),
      definitions = configuredPieces(p, 'print-layout');
    const group = part.buildGeometry(p, 'print-layout');
    try {
      group.updateMatrixWorld(true);
      assert.equal(group.children.length, definitions.length);
      const boxes = group.children.map((child, i) => {
        let count = 0;
        child.traverse((mesh) => {
          if (!(mesh instanceof Mesh)) return;
          count++;
          assertClosedPositive(mesh, `${pack}/${definitions[i].component.id}`);
        });
        assert.ok(count > 0);
        const box = new Box3().setFromObject(child, true);
        assert.ok(
          Math.abs(box.min.z) < 0.001,
          `${pack}/${definitions[i].component.id}: flat on bed`,
        );
        assert.ok(box.max.z > 0);
        return box;
      });
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++)
          assert.ok(!boxes[i].intersectsBox(boxes[j]), `${pack}: print parts overlap`);
      const actual = new Box3().setFromObject(group, true).getSize(new Vector3()).toArray();
      assert.ok(
        actual.every((value, i) => Math.abs(value - part.dimensions(p, 'print-layout')[i]) < 0.01),
      );
    } finally {
      disposeModel(group);
    }
  }
});

test('recessed sliding closure uses hook release, a nominal coil and an independent soft cell sling', () => {
  for (const pack of packs) {
    const p = parameters(pack),
      d = layout(p);
    assert.equal(latch.stroke, 4);
    const assembled = configuredPieces(p, 'assembled'),
      unlocked = configuredPieces(p, 'unlocked');
    assert.ok(
      assembled.every(
        (piece) => !/^latch-(?:left|right|bushing|washer|stop)/.test(piece.component.id),
      ),
    );
    for (const id of ['latch-slider', 'latch-cover'])
      assert.ok(printIds(p).includes(id), id + ': separately printable');
    const closedBolt = assembled.find((piece) => piece.component.id === 'latch-slider')!.component;
    const releasedBolt = unlocked.find((piece) => piece.component.id === 'latch-slider')!.component;
    assert.deepEqual(
      closedBolt.parameters,
      releasedBolt.parameters,
      'Sliding preserves the same printed part',
    );
    assert.deepEqual(releasedBolt.placement.rotation, closedBolt.placement.rotation);
    assert.ok(
      Math.abs(
        releasedBolt.placement.translation[0] - closedBolt.placement.translation[0] - latch.stroke,
      ) < 1e-8,
    );
    assert.deepEqual(
      assembled.find((piece) => piece.component.id === 'lid'),
      unlocked.find((piece) => piece.component.id === 'lid'),
      'Retracting the bolt keeps the hooked lid seated',
    );
    for (const [state, compression, length] of [
      ['assembled', 1, 9],
      ['unlocked', 5, 5],
    ] as const) {
      const spring = configuredPieces(p, state).find(
        (piece) => piece.component.id === 'latch-spring',
      )!.component;
      assert.equal(spring.libraryId, 'compression-spring');
      assert.equal(spring.presetId, undefined, 'A parametric spring has no fabricated preset ID');
      assert.equal(spring.state, 'compressed');
      assert.equal(spring.supply, 'purchased');
      assert.equal(spring.parameters.outerDiameter, 8);
      assert.equal(spring.parameters.wireDiameter, 0.4);
      assert.equal(spring.parameters.freeLength, 10);
      assert.equal(spring.parameters.turns, 6);
      assert.equal(spring.parameters.ends, 'closed');
      assert.equal(spring.parameters.compression, compression);
      assert.equal(10 - compression, length);
      assert.ok(length - 2.8 >= 2.2 - 1e-9, 'Declared unground coil-bind margin');
      assert.match(spring.notes!, /assumptions/);
      assert.match(spring.notes!, /no rated return force/);
    }
    assert.equal(d.strapWidth, 12);
    assert.equal(d.strapThickness, 0.4);
    const route = ribbonRoute(p);
    for (const row of d.pinRows)
      assert.ok(route.some(([y, z]) => y === row - 5 && z < d.cellZ - d.cellDiameter / 2));
    const open = configuredPieces(p, 'open');
    assert.deepEqual(
      open.find((piece) => piece.component.id === 'extraction-ribbon'),
      assembled.find((piece) => piece.component.id === 'extraction-ribbon'),
      'The loose sling remains with the cells when the lid is removed',
    );
  }
});

test('standalone FreeCAD macros contain the complete selected production assembly', () => {
  for (const pack of packs)
    for (const state of ['assembled', 'unlocked', 'open', 'print-layout', 'panel-template']) {
      const p = parameters(pack),
        script = generateScript(part, p, state);
      assert.ok(
        script.includes(
          part
            .python(p, state)
            .split('\n')
            .map((line) => '        ' + line)
            .join('\n'),
        ),
      );
      assert.match(script, /shape\.isValid\(\)/);
      assert.match(script, /doc\.abortTransaction\(\)/);
    }
});
