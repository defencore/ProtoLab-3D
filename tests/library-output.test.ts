import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLibraryOutput, type LibraryOutputRequest } from '../src/core/library-output';
import { currentGeometryMode } from '../src/core/geometry-mode';
import bolt from '../src/parts/bolt-screw/part';
import tool from '../src/parts/thread-tool/part';
import { unpackModel } from '../src/core/mesh-transfer';
import { disposeModel } from '../src/core/mechanical';
import type { PartDefinition } from '../src/core/types';

const request = (
  kind: LibraryOutputRequest['kind'],
  geometryMode: LibraryOutputRequest['geometryMode'],
): LibraryOutputRequest => ({
  kind,
  geometryMode,
  partId: bolt.id,
  parameters: { ...bolt.defaults },
  state: 'default',
});

test('preview creates a transportable model without generating unused CAD source, dimensions or STL', () => {
  const part = {
    ...bolt,
    python: () => {
      throw new Error('CAD source should be on demand.');
    },
    dimensions: () => {
      throw new Error('Measure the built preview once.');
    },
    exportDimensions: () => {
      throw new Error('CAD bounds should be on demand.');
    },
    buildExportGeometry: () => {
      throw new Error('STL should be on demand.');
    },
  };
  for (const mode of ['simple', 'full'] as const) {
    const output = buildLibraryOutput(part, request('preview', mode));
    assert.equal(output.kind, 'preview');
    assert.ok(output.model && output.dimensions && output.buffers.length);
    assert.equal(output.script, undefined);
    assert.equal(output.stl, undefined);
    const model = unpackModel(output.model);
    let threadFields = 0;
    model.traverse((mesh) => {
      if ('material' in mesh) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials)
          threadFields += material.userData.visualThreads?.length ?? 0;
      }
    });
    assert.equal(threadFields, mode === 'full' ? 1 : 0);
    disposeModel(model);
  }
  assert.equal(currentGeometryMode(), 'simple');
});

test('requested FreeCAD modes retain the same physical configuration and produce distinct thread representations', () => {
  const parameters = JSON.stringify(bolt.defaults);
  const simple = buildLibraryOutput(bolt, request('script', 'simple'));
  const full = buildLibraryOutput(bolt, request('script', 'full'));
  assert.match(simple.script!, /Geometry mode: simple/);
  assert.doesNotMatch(simple.script!, /Part\.makeLongHelix/);
  assert.match(full.script!, /Geometry mode: full/);
  assert.match(full.script!, /Part\.makeLongHelix/);
  assert.match(simple.script!, /ThreadCallouts/);
  assert.match(full.script!, /ThreadCallouts/);
  assert.equal(JSON.stringify(bolt.defaults), parameters);
  assert.equal('model' in simple, false);
  assert.equal(full.stl, undefined);
});

test('native export validates physical dimensions when the inspection view includes references', () => {
  const expected = bolt.dimensions(bolt.defaults, 'default');
  const part: PartDefinition = {
    ...bolt,
    dimensions: () => [100, 100, 100],
    exportDimensions(parameters, state) {
      assert.equal(this.id, bolt.id);
      assert.deepEqual(parameters, bolt.defaults);
      assert.equal(state, 'default');
      return expected;
    },
  };
  for (const mode of ['simple', 'full'] as const) {
    const output = buildLibraryOutput(part, request('script', mode));
    assert.ok(output.script!.includes(`expected_dimensions = ${JSON.stringify(expected)}`));
    assert.ok(!output.script!.includes('expected_dimensions = [100,100,100]'));
    const ordinary = buildLibraryOutput(bolt, request('script', mode));
    assert.ok(ordinary.script!.includes(`expected_dimensions = ${JSON.stringify(expected)}`));
  }
});

test('STL retains simple manufacturing geometry even when Full preview is selected', () => {
  const base = {
    partId: tool.id,
    parameters: { ...tool.defaults, manufacturing: 'printed' },
    state: 'external',
    kind: 'stl' as const,
  };
  const simple = buildLibraryOutput(tool, { ...base, geometryMode: 'simple' });
  const full = buildLibraryOutput(tool, { ...base, geometryMode: 'full' });
  assert.ok(simple.stl && full.stl);
  assert.deepEqual(new Uint8Array(simple.stl), new Uint8Array(full.stl));
  const data = new DataView(simple.stl);
  assert.ok(data.getUint32(80, true) > 0);
  assert.equal(simple.stl.byteLength, 84 + data.getUint32(80, true) * 50);
});

test('invalid output requests fail before building any geometry and restore the mode', () => {
  assert.throws(
    () => buildLibraryOutput(bolt, { ...request('preview', 'full'), partId: 'hex-nut' }),
    /does not match/,
  );
  assert.throws(() =>
    buildLibraryOutput(bolt, {
      ...request('script', 'full'),
      parameters: { ...bolt.defaults, diameter: -1 },
    }),
  );
  assert.equal(currentGeometryMode(), 'simple');
});
