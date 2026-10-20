import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { Box3, DoubleSide, Mesh, Raycaster, Vector3 } from 'three';
import type { Group, Material } from 'three';
import part from '../src/parts/li-ion-battery-holder/part';
import tray from '../src/parts/battery-holder/part';
import { groupBrowseFamilies } from '../src/core/browse-families';
import { configureProduct } from '../src/core/design-project';
import { matchingPresetId } from '../src/core/part-selection';
import { matchesCatalogFilters, presetMatchesConfiguration } from '../src/core/catalog-models';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';
import {
  buildPresetIndex,
  compilePresetQuery,
  matchesPresetQuery,
} from '../src/core/preset-search';
import type { Parameters } from '../src/core/types';
import { nativeModels } from '../src/parts/li-ion-battery-holder/lib/native';
import modelData from '../src/parts/li-ion-battery-holder/lib/models.json';

const models = [
  { id: 'beilamoo-2s', cells: 2, length: 77.7, width: 40.21, wired: true },
  { id: 'beilamoo-3s', cells: 3, length: 77.7, width: 59.69, wired: true },
  { id: 'beilamoo-4s', cells: 4, length: 77.98, width: 78.84, wired: true },
  { id: 'mpd-bk-18650-pc4', cells: 2, length: 77.7, width: 40.21, wired: false },
  { id: 'mpd-bk-18650-pc6', cells: 3, length: 77.7, width: 59.69, wired: false },
  { id: 'mpd-bk-18650-pc8', cells: 4, length: 77.98, width: 78.84, wired: false },
];
const parameters = (model: string, extra: Parameters = {}): Parameters => ({
  ...part.defaults,
  model,
  ...extra,
});

function meshes(group: Group): Mesh[] {
  const result: Mesh[] = [];
  group.traverse((object) => {
    if (object instanceof Mesh) result.push(object);
  });
  return result;
}

function dispose(group: Group) {
  for (const mesh of meshes(group)) {
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material: Material) => material.dispose());
  }
}

function assertClosedPositive(mesh: Mesh, context: string) {
  const geometry = mesh.geometry,
    position = geometry.getAttribute('position'),
    indices = geometry.index,
    count = indices?.count ?? position.count,
    edges = new Map<string, number>();
  assert.ok(position.count > 0, context + ': vertices');
  assert.equal(count % 3, 0, context + ': triangles');
  const keys = Array.from({ length: position.count }, (_, i) => {
    const point = [position.getX(i), position.getY(i), position.getZ(i)];
    assert.ok(point.every(Number.isFinite), context + ': finite coordinates');
    return point.map((value) => Math.round(value * 1e5)).join(',');
  });
  let volume = 0;
  for (let i = 0; i < count; i += 3) {
    const ids = [0, 1, 2].map((offset) => (indices ? indices.getX(i + offset) : i + offset));
    const points = ids.map(
      (id) => new Vector3(position.getX(id), position.getY(id), position.getZ(id)),
    );
    volume += points[0].dot(points[1].clone().cross(points[2])) / 6;
    if (new Set(ids.map((id) => keys[id])).size < 3) continue;
    for (let side = 0; side < 3; side++) {
      const edge = [keys[ids[side]], keys[ids[(side + 1) % 3]]].sort().join('/');
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  assert.ok(edges.size > 0, context + ': non-degenerate boundary');
  assert.ok(
    [...edges.values()].every((count) => count === 2),
    context + ': closed boundary',
  );
  assert.ok(volume > 0, context + ': positive orientation');
  return volume;
}

function contains(mesh: Mesh, point: [number, number, number]): boolean {
  mesh.updateMatrixWorld(true);
  for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
    material.side = DoubleSide;
  const hits = new Raycaster(new Vector3(...point), new Vector3(0.913, 0.327, 0.244).normalize())
    .intersectObject(mesh, false)
    .map((hit) => hit.distance);
  return (
    hits.filter((distance, i) => i === 0 || Math.abs(distance - hits[i - 1]) > 1e-5).length % 2 ===
    1
  );
}

test('six fixed 18650 holders keep series size and mounting construction distinct', () => {
  assert.equal(part.id, 'li-ion-battery-holder');
  assert.equal(part.category, 'POWER & MOTOR CONTROL');
  assert.equal(part.subgroup, 'BATTERIES & HOLDERS');
  assert.equal(part.catalogSelectionOnly, true);
  assert.equal(part.product.supply, 'purchased');
  assert.deepEqual(part.defaults, { model: 'beilamoo-4s' });
  assert.deepEqual(part.presetMatchKeys, ['model']);
  assert.deepEqual(
    part.presets.map((preset) => preset.id).sort(),
    models.map((model) => model.id).sort(),
  );
  assert.deepEqual(
    part.parameters.map((field) => field.key).sort(),
    ['model'],
    'Published product dimensions are selected through a model rather than stretched',
  );
  for (const model of models) {
    const preset = part.presets.find((preset) => preset.id === model.id)!;
    assert.deepEqual(preset.parameters, { model: model.id });
    assert.deepEqual(part.validate(preset.parameters, 'assembled'), [], model.id);
    assert.deepEqual(preset.catalog!.verifiedParameters, ['model']);
    assert.ok(preset.catalog!.designation.trim(), model.id + ': orderable designation');
    assert.ok(preset.catalog!.manufacturer?.trim(), model.id + ': supplier identity');
    assert.ok(preset.catalog!.sourceUrl.startsWith('https://'), model.id + ': linked source');
    assert.equal(
      preset.catalog!.geometryEvidence!.kind,
      model.wired ? 'source-dimensions' : 'manufacturer-cad',
      'Derived wire holders must not inherit MPD manufacturer CAD status',
    );
    if (model.wired)
      assert.match(
        preset.catalog!.geometryEvidence!.limitations,
        /reconstruct|derived|not.*manufacturer|not.*factory/i,
      );
    if (model.wired) {
      assert.match(
        preset.catalog!.geometryEvidence!.limitations,
        /mounting.*not manufacturer-verified/i,
      );
      assert.match(preset.catalog!.geometryEvidence!.limitations, /internal busbars.*omitted/i);
    }
  }
  for (const extra of [
    { model: 'unknown-holder' },
    { leadPose: 'coiled' },
    { cells: 5 },
    { length: 80 },
    { scale: 2 },
  ] as Parameters[])
    assert.ok(part.validate({ ...part.defaults, ...extra }, 'assembled').length);
  assert.ok(part.validate(part.defaults, 'cutaway').length);
});

test('inspection states retain the fixed purchased model identity without wire controls', () => {
  for (const model of models) {
    const preset = part.presets.find((preset) => preset.id === model.id)!;
    for (const state of ['assembled', 'exploded']) {
      const configured = parameters(model.id);
      assert.deepEqual(part.validate(configured, state), [], model.id + '/' + state);
      assert.equal(matchingPresetId(part, configured), preset.id);
      assert.equal(presetMatchesConfiguration(part, preset, configured), true);
      const product = configureProduct({
        part,
        parameters: configured,
        state,
        presetId: preset.id,
      });
      assert.equal(product.supply, 'purchased');
      assert.equal(product.state, 'assembled', 'Inspection does not create another supplier unit');
      assert.equal(product.procurement!.designation, preset.catalog!.designation);
      assert.equal(product.procurement!.manufacturer, preset.catalog!.manufacturer);
      assert.equal(product.procurement!.source, preset.catalog!.sourceUrl);
    }
  }
});

test('published series and termination filters do not mislabel independent PCB contacts as wired packs', () => {
  const fields = part.catalogFilterFields!;
  assert.deepEqual(fields.map((field) => field.key).sort(), [
    'bodyHeight',
    'cells',
    'connection',
    'format',
    'length',
    'manufacturer',
    'mountDiameter',
    'pinExtension',
    'termination',
    'width',
  ]);
  for (const cells of [2, 3, 4]) {
    const matches = part.presets.filter((preset) =>
      matchesCatalogFilters(preset, fields, {
        cells: { min: String(cells), max: String(cells) },
        connection: { value: `${cells}S1P` },
        termination: { value: 'Wire leads' },
      }),
    );
    assert.deepEqual(
      matches.map((preset) => preset.id),
      [`beilamoo-${cells}s`],
    );
  }
  assert.deepEqual(
    part.presets
      .filter((preset) =>
        matchesCatalogFilters(preset, fields, {
          connection: { value: 'Independent' },
          termination: { value: 'PC pins' },
        }),
      )
      .map((preset) => preset.id)
      .sort(),
    ['mpd-bk-18650-pc4', 'mpd-bk-18650-pc6', 'mpd-bk-18650-pc8'],
  );
  assert.ok(
    part.presets.every((preset) =>
      matchesCatalogFilters(preset, fields, {
        format: { value: '18650' },
        bodyHeight: { min: '21.54', max: '21.54' },
      }),
    ),
  );
  assert.deepEqual(
    part.presets
      .filter((preset) =>
        matchesCatalogFilters(preset, fields, {
          mountDiameter: { min: '3.2', max: '3.2' },
          pinExtension: { min: '3.2', max: '3.2' },
        }),
      )
      .map((preset) => preset.id)
      .sort(),
    ['mpd-bk-18650-pc4', 'mpd-bk-18650-pc6', 'mpd-bk-18650-pc8'],
    'Unverified mounting dimensions are not published as wired-holder filter facts',
  );
});

test('body and contacts remain closed native solids at the fixed source dimensions', () => {
  for (const model of models) {
    const configured = parameters(model.id);
    const group = part.buildGeometry(configured, 'assembled');
    const components = meshes(group);
    assert.equal(
      components.length,
      1 + 2 * model.cells,
      model.id + ': case and two contacts per slot',
    );
    for (const [i, mesh] of components.entries()) {
      const native = nativeModels[model.id].components[i];
      assert.equal(
        mesh.geometry.userData.nativeTopology,
        true,
        `${model.id}/${i}: native topology`,
      );
      const volume = assertClosedPositive(mesh, `${model.id}/${i}`);
      assert.ok(
        Math.abs(volume - native.volume) < Math.max(0.001, native.volume * 0.015),
        `${model.id}/${i}: native and displayed volume`,
      );
      const bounds = new Box3().setFromObject(mesh),
        coordinates = [...bounds.min.toArray(), ...bounds.max.toArray()];
      coordinates.forEach((value, axis) =>
        assert.ok(
          Math.abs(value - native.bounds[axis]) < 0.06,
          `${model.id}/${i}: native axis ${axis}`,
        ),
      );
    }
    const bounds = new Box3().setFromObject(group),
      size = bounds.getSize(new Vector3());
    assert.ok(Math.abs(size.x - model.length) < 0.06, model.id + ': fixed length');
    assert.ok(Math.abs(size.y - model.width) < 0.06, model.id + ': fixed width');
    assert.ok(Math.abs(bounds.max.z - 21.54) < 0.06, model.id + ': height above mounting datum');
    if (model.wired)
      assert.ok(Math.abs(bounds.min.z) < 0.06, model.id + ': original PCB tails are removed');
    else assert.ok(Math.abs(bounds.min.z + 3.2) < 0.06, model.id + ': retained original PCB tails');
    assert.ok(
      part
        .dimensions(configured, 'assembled')
        .every((value, i) => Math.abs(value - size.getComponent(i)) < 0.06),
      model.id + ': reported and rendered extents agree',
    );
    assert.match(part.python(configured, 'assembled'), /importBrepFromString/);
    dispose(group);
  }
});

test('original STEP identities are pinned independently and every stored native solid retains its checksum', () => {
  const sourceHashes: Record<number, string> = {
    2: '05981dfcd16010cf7f94161a07a1ce0ff2a1dfa389d460bcbf7a5fdf44fcfc7e',
    3: 'd5d1ba3bdac990db31d7fac8107b9d2fc293f567080af6f3b552be542da0bdc2',
    4: 'dc6b4071d9c72596b681e996058252a077ca6fe7ca437b39a936020d43664d93',
  };
  for (const model of models) {
    const asset = nativeModels[model.id];
    assert.equal(
      asset.sourceSha256,
      sourceHashes[model.cells],
      model.id + ': source STEP identity',
    );
    assert.equal(asset.components.length, 1 + 2 * model.cells);
    for (const solid of asset.components) {
      const raw = inflateSync(Buffer.from(solid.brep, 'base64'));
      assert.match(raw.toString('utf8').slice(0, 100), /CASCADE Topology/);
      assert.equal(
        createHash('sha256').update(raw).digest('hex'),
        (solid as typeof solid & { brepSha256: string }).brepSha256,
        model.id + ': exact serialized native solid',
      );
    }
    const metadata = asset as typeof asset & {
      factoryGeometryUnmodified: boolean;
      modifications: string[];
    };
    assert.equal(metadata.factoryGeometryUnmodified, !model.wired);
    assert.equal(metadata.modifications.length > 0, model.wired);
    const evidence = part.presets.find((preset) => preset.id === model.id)!.catalog!
      .geometryEvidence!;
    if (!model.wired) assert.equal(evidence.sourceSha256, asset.sourceSha256);
  }
});

test('case mounting holes remain open and their supplier verification scope is explicit', () => {
  for (const model of modelData) {
    const group = part.buildGeometry(parameters(model.id), 'assembled'),
      body = meshes(group)[0];
    assert.equal(model.mountDiameter, 3.2);
    assert.equal(model.mountPatternVerified, !model.wired);
    assert.equal(model.mountHoles.length, 2 * model.cells);
    for (const [x, y] of model.mountHoles) {
      assert.equal(contains(body, [x, y, 0.5]), false, model.id + ': through mounting hole');
      assert.equal(
        contains(body, [x + 2.3, y, 0.5]),
        true,
        model.id + ': surrounding mounting floor',
      );
    }
    dispose(group);
  }
});

test('component inspection separates the same housing and contacts without adding wires', () => {
  for (const model of models) {
    const configured = parameters(model.id),
      assembled = part.buildGeometry(configured, 'assembled'),
      exploded = part.buildGeometry(configured, 'exploded'),
      original = meshes(assembled),
      separated = meshes(exploded);
    assert.equal(original.length, 1 + 2 * model.cells);
    assert.equal(separated.length, original.length);
    for (let i = 0; i < original.length; i++) {
      assert.deepEqual(
        separated[i].geometry.getAttribute('position').array,
        original[i].geometry.getAttribute('position').array,
        model.id + ': unchanged native component',
      );
      const before = new Box3().setFromObject(original[i]),
        after = new Box3().setFromObject(separated[i]);
      assert.ok(Math.abs(after.min.x - before.min.x) < 1e-6);
      assert.ok(Math.abs(after.min.y - before.min.y) < 1e-6);
      assert.ok(Math.abs(after.min.z - before.min.z - (i === 0 ? 0 : 15)) < 1e-6);
      assert.doesNotMatch(separated[i].name, /lead|wire/i);
    }
    assert.equal(
      part.python(configured, 'assembled').includes('makeLoft'),
      false,
      'Export contains native holder solids only',
    );
    dispose(assembled);
    dispose(exploded);
  }
});

test('purchased holders and the existing printable tray share one discoverable battery-holder family', () => {
  const family = groupBrowseFamilies([tray, part]);
  assert.equal(family.length, 1);
  assert.equal(family[0].id, 'battery-holders');
  assert.equal(family[0].label, 'Battery holders');
  assert.equal(family[0].primary, part);
  assert.ok(family[0].members.includes(tray));
  assert.equal(tray.product.supply, 'manufactured');
  assert.deepEqual(tray.defaults, {
    diameter: 18.6,
    length: 65.5,
    count: 2,
    wall: 2,
    clearance: 0.4,
  });
  const index = buildLibrarySearchIndex(family),
    articles = buildPresetIndex([part]);
  for (const series of ['2S', '3S', '4S']) {
    assert.ok(
      searchLibrary(index, `18650 ${series}`).some(
        (match) => match.family.id === 'battery-holders',
      ),
    );
    const selected = articles.filter((entry) =>
      matchesPresetQuery(entry, compilePresetQuery(series)),
    );
    assert.ok(selected.some((entry) => entry.preset.id === `beilamoo-${series.toLowerCase()}`));
  }
  assert.ok(
    searchLibrary(index, 'BK-18650-PC8').some((match) => match.family.id === 'battery-holders'),
  );
});
