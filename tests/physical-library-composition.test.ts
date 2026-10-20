import assert from 'node:assert/strict';
import test from 'node:test';
import { parts } from '../src/parts';
import { validateParameters } from '../src/core/validation';
import {
  parseRecoveryRecipe,
  recoveryDetailComponent,
} from '../src/core/recovery-component-recipes';
import release from '../src/parts/rocket-release/part';
import parachute from '../src/parts/rocket-parachute-recovery/part';
import { pieces } from '../src/parts/rocket-release/lib/model';
import { markSupplierUnit, supplierPlacement } from '../src/core/supplier-components';
import { transform, rotate, box } from '../src/core/assembly/recovery/shapes';
import type { AssemblyDefinition, AssemblyComponent } from '../src/core/product-types';
import type { PartDefinition } from '../src/core/types';
import { manufactured } from '../src/parts/rocket-release/lib/names';
import { python as releasePython } from '../src/parts/rocket-release/lib/assembly';
import { spawnSync } from 'node:child_process';

test('every authored manufactured assembly resolves valid physical library products for every preset', () => {
  const assemblies = parts.filter(
    (part) =>
      part.product.supply === 'manufactured' &&
      ['assembly', 'complex', 'kit'].includes(part.product.kind),
  );
  assert.ok(assemblies.length >= 40);
  for (const part of assemblies) {
    assert.ok(part.composition, part.id + ' must declare its physical library composition');
    for (const configuration of [{ id: 'defaults', parameters: part.defaults }, ...part.presets]) {
      const definition: AssemblyDefinition = part.composition!(configuration.parameters);
      assert.ok(definition.components.length, part.id + '/' + configuration.id);
      const ids = new Set<string>();
      for (const component of definition.components as AssemblyComponent[]) {
        assert.ok(!ids.has(component.id), part.id + ' duplicate occurrence ' + component.id);
        ids.add(component.id);
        const target: PartDefinition | undefined = parts.find(
          (candidate) => candidate.id === component.libraryId,
        );
        assert.ok(target, component.libraryId);
        assert.notEqual(target.product.supply, 'reference', part.id + ' physical reference');
        assert.deepEqual(
          validateParameters(target, component.parameters, component.state),
          [],
          part.id + '/' + configuration.id + '/' + component.name,
        );
        assert.ok(component.quantity > 0 && Number.isFinite(component.quantity));
        assert.ok(
          [...component.placement.translation, ...component.placement.rotation].every(
            Number.isFinite,
          ),
        );
      }
    }
  }
});

test('supplier servo, cell and board internals remain complete single purchase units', () => {
  const configuration = release.presets.find(
    (preset) => preset.id === 'nose-90-86-st3215',
  )!.parameters;
  const authored = pieces(configuration, 'assembled');
  const physical = release.composition!(configuration);
  assert.ok(authored.filter((piece) => piece.label.startsWith('ST3215')).length >= 6);
  assert.equal(
    physical.components.filter((component) => component.libraryId === 'bus-servo').length,
    1,
  );
  assert.equal(
    physical.components.filter((component) => component.libraryId === 'bus-servo-driver').length,
    1,
  );
  assert.equal(
    physical.components.filter((component) => component.name === '18650 Li-ion cell').length,
    3,
  );
  const wing = parachute.composition!(parachute.defaults);
  assert.equal(
    wing.components.filter((component) => component.procurement?.manufacturer === 'SpeedyBee')
      .length,
    1,
  );
  for (const name of [
    'Rated main parachute with suspension lines and packing bands',
    'Rated drogue parachute with suspension lines',
    'Rated deployment bag',
    'Rated body-to-nose tether with qualified termination',
  ])
    assert.equal(wing.components.filter((component) => component.name === name).length, 1, name);
  assert.deepEqual(parachute.composition!({ ...parachute.defaults, sequence: 100 }), wing);
  assert.deepEqual(release.composition!({ ...configuration, release: 100 }), physical);
});

test('recovery library recipes retain local threads and reject supplier internals and source code', () => {
  const feature = box([4, 5, 6], [0, 0, 0]);
  const a = recoveryDetailComponent(
    'a',
    'First',
    transform(rotate(feature, 90, 'x'), 25, [100, 20, 30]),
  );
  const b = recoveryDetailComponent(
    'b',
    'Second',
    transform(rotate(feature, 90, 'x'), -35, [40, 50, 60]),
  );
  assert.deepEqual(a.parameters, b.parameters);
  assert.notDeepEqual(a.placement, b.placement);
  const thread = {
    kind: 'thread',
    diameter: 6,
    pitch: 1,
    length: 8,
    clearance: 0.15,
    internal: true,
    process: 'printed',
  };
  assert.deepEqual(parseRecoveryRecipe(JSON.stringify(thread)), thread);
  for (const feature of [
    { kind: 'native', index: 0 },
    { kind: 'hat' },
    { kind: 'python', source: 'exec()' },
    { ...thread, source: 'exec()' },
  ])
    assert.throws(() => parseRecoveryRecipe(JSON.stringify(feature)));
  const unit = { name: 'Supplier' };
  markSupplierUnit([feature], unit);
  const placed = supplierPlacement(transform(rotate(feature, 90, 'x'), 0, [10, 20, 30]), unit);
  assert.deepEqual(placed.translation, [10, 20, 30]);
  assert.ok(placed.rotation.every((angle, index) => Math.abs(angle - [90, 0, 0][index]) < 1e-12));
});

test('authored supplier identity determines manufacture policy independently of descriptive names', () => {
  const shape = box([4, 5, 6], [0, 0, 0]);
  assert.equal(manufactured({ shape, label: 'BUY unqualified placeholder', color: 0 }), true);
  markSupplierUnit([shape], { name: 'Actual supplier unit' });
  assert.equal(manufactured({ shape, label: 'PRINT misleading name', color: 0 }), false);
  const custom = box([4, 5, 6], [0, 0, 0]);
  assert.equal(manufactured({ shape: custom, label: 'Machined plate', color: 0 }), true);
  assert.equal(
    manufactured({
      shape: custom,
      label: 'Supplier internals',
      color: 0,
      metadata: { SupplierUnitId: 'actual-kit' },
    }),
    false,
  );
});

test(
  'native supplier CAD helpers follow authored features when installation labels change',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const configuration = release.presets.find(
      (preset) => preset.id === 'nose-90-86-st3215',
    )!.parameters;
    const authored = pieces(configuration, 'assembled').filter(
      (piece) =>
        piece.label.startsWith('ST3215 ·') || piece.label.startsWith('BUY Waveshare Bus Servo'),
    );
    assert.ok(authored.length >= 7);
    const selected = authored.map((piece, index) => ({
      ...piece,
      label: 'Supplier occurrence ' + index,
    }));
    const code =
      'import FreeCAD as App, Part, math\n' +
      releasePython(selected) +
      '\nassert len(components)==' +
      selected.length +
      '\nfor item in components:\n assert item.isValid() and item.isClosed() and item.Volume>0\nprint("SUPPLIER_CAD_OK")\n';
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 60000,
      maxBuffer: 4 * 1024 * 1024,
    });
    assert.equal(
      result.status,
      0,
      String(result.error ?? '') + '\n' + result.stdout + '\n' + result.stderr,
    );
    assert.match(result.stdout, /SUPPLIER_CAD_OK/);
  },
);
