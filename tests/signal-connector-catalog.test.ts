import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { Box3, DoubleSide, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import part from '../src/parts/signal-connector/part';
import {
  models,
  colorEvidence,
  geometry,
  dimensions,
  python,
  selected,
} from '../src/parts/signal-connector/lib/model';
import type { Parameters } from '../src/core/types';

function contains(model: string, point: number[]): boolean {
  const group = geometry({ model }, 'assembled');
  const ray = new Raycaster(
    new Vector3(...(point as [number, number, number])),
    new Vector3(0.913, 0.327, 0.244).normalize(),
  );
  let inside = false;
  for (const child of group.children) {
    const mesh = child as Mesh;
    (mesh.material as MeshStandardMaterial).side = DoubleSide;
    const distances = ray.intersectObject(mesh, false).map((hit) => hit.distance);
    const unique = distances.filter((d, i) => i === 0 || Math.abs(d - distances[i - 1]) > 1e-5);
    if (unique.length % 2) inside = true;
    mesh.geometry.dispose();
    (mesh.material as MeshStandardMaterial).dispose();
  }
  return inside;
}

test('connector catalog selects 35 fixed models across distinct interfaces', () => {
  assert.equal(models.length, 35);
  assert.equal(part.presets!.length, models.length);
  assert.equal(part.catalogSelectionOnly, true);
  assert.equal(part.category, 'CONNECTORS & INTERFACES');
  assert.equal(part.subgroup, 'PCB CONNECTORS');
  assert.deepEqual(
    part.states!.map((s) => s.id),
    ['assembled'],
  );
  for (const preset of part.presets!) {
    assert.deepEqual(part.validate(preset.parameters, 'assembled'), []);
    assert.equal(preset.name, models.find((m) => m.id === preset.parameters.model)!.name);
    assert.equal(preset.catalog!.geometryEvidence!.kind, 'community-cad');
    assert.match(preset.catalog!.sourceName, /community/);
    assert.deepEqual(Object.keys(preset.parameters), ['model']);
  }
  for (const key of ['family', 'contactType', 'contacts', 'pitch', 'mounting'])
    assert.ok(part.catalogFilterFields!.some((field) => field.key === key));
  assert.ok(part.validate({ model: 'arbitrary-usb' }, 'assembled').length);
  for (const extra of [
    { pitch: 2.54 },
    { width: 20 },
    { contacts: 12 },
    { scale: 2 },
  ] as Parameters[])
    assert.ok(part.validate({ ...part.defaults, ...extra } as Parameters, 'assembled').length);
  assert.ok(part.validate(part.defaults, 'exploded').length);
  assert.throws(() => selected({ model: 'unknown' }));
});

test('every native source BRep retains its exact pinned identity and closed indexed preview', () => {
  for (const model of models) {
    const asset = model.native;
    assert.equal(asset.sourceSha256, model.sourceSha256);
    assert.match(asset.sourceSha256, /^[a-f0-9]{64}$/);
    assert.equal(asset.sourceSolids, asset.components.length);
    assert.ok(asset.sourceUrl.includes('/9.0.1/'));
    const group = geometry({ model: model.id }, 'assembled');
    assert.equal(group.children.length, asset.components.length);
    for (const [ci, item] of asset.components.entries()) {
      const raw = inflateSync(Buffer.from(item.brep, 'base64'));
      assert.match(raw.toString('utf8').slice(0, 100), /CASCADE Topology/);
      assert.equal(createHash('sha256').update(raw).digest('hex'), item.brepSha256);
      const mesh = group.children[ci] as Mesh,
        g = mesh.geometry;
      assert.equal(mesh.userData.sourceSolids, 1);
      assert.equal(mesh.userData.sourceVolume, item.volume);
      assert.equal(g.userData.nativeTopology, true);
      const vertices = g.getAttribute('position'),
        indices = g.index!;
      assert.equal(vertices.count, item.vertexCount);
      assert.equal(indices.count, item.triangleCount * 3);
      const edges = new Map<string, number>();
      let volume = 0;
      for (let i = 0; i < indices.count; i += 3) {
        const tri = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
        const [a, b, c] = tri.map(
          (v) => new Vector3(vertices.getX(v), vertices.getY(v), vertices.getZ(v)),
        );
        volume += a.dot(b.clone().cross(c)) / 6;
        for (let j = 0; j < 3; j++) {
          const edge = [tri[j], tri[(j + 1) % 3]].sort((a, b) => a - b).join('/');
          edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
      }
      assert.ok(
        [...edges.values()].every((n) => n === 2),
        `${model.id}/${ci} closure`,
      );
      assert.ok(volume > 0, `${model.id}/${ci} orientation`);
      assert.ok(
        Math.abs(volume - item.volume) < Math.max(0.001, item.volume * 0.015),
        `${model.id}/${ci} volume`,
      );
      const box = new Box3().setFromObject(mesh),
        b = [...box.min.toArray(), ...box.max.toArray()];
      b.forEach((v, i) =>
        assert.ok(Math.abs(v - item.bounds[i]) < 0.06, `${model.id}/${ci} bound ${i}`),
      );
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
    }
    const size = new Box3().setFromObject(group).getSize(new Vector3()).toArray();
    dimensions({ model: model.id }).forEach((v, i) => assert.ok(Math.abs(v - size[i]) < 0.06));
    assert.match(python({ model: model.id }, 'assembled'), /importBrepFromString/);
  }
});

test('JST XH 2.50 mm and PH 2.00 mm pin rows remain distinct and the shrouds have an open mouth', () => {
  for (const family of ['xh', 'ph']) {
    const pitch = family === 'xh' ? 2.5 : 2,
      z = family === 'xh' ? 5 : 4;
    for (let n = 2; n <= 6; n++) {
      const id = `jst-${family}-${n}`;
      assert.equal(models.find((m) => m.id === id)!.pitch, pitch);
      for (let i = 0; i < n; i++)
        assert.equal(contains(id, [i * pitch, 0, z]), true, `${id} pin ${i + 1}`);
      for (let i = 0; i < n - 1; i++)
        assert.equal(contains(id, [(i + 0.5) * pitch, 0, z]), false, `${id} open mouth ${i + 1}`);
      assert.ok(
        models.find((m) => m.id === id)!.native.bounds[2] < -3,
        'Original solder tails below PCB are retained',
      );
    }
  }
});

test('female pin strips retain open contact mouths while male strips retain projecting pins', () => {
  for (const n of [3, 4, 6]) {
    for (let i = 0; i < n; i++) {
      assert.equal(contains(`pin-socket-${n}`, [0, -i * 2.54, 8]), false);
      assert.equal(contains(`pin-socket-${n}`, [0.9, -i * 2.54, 8]), true);
      assert.equal(contains(`pin-header-${n}`, [0, -i * 2.54, 7]), true);
    }
    assert.equal(contains(`pin-header-${n}`, [0, -1.27, 7]), false);
  }
});

test('barrel jack references preserve a real cavity and explicitly distinguish 2.0 mm pin from 2.1 mm mating class', () => {
  for (const suffix of ['ah', 'bh']) {
    const id = 'dc-pj-063' + suffix;
    assert.equal(contains(id, [0, -11, 5]), true, 'Center pin');
    assert.equal(contains(id, [2, -11, 5]), false, 'Annular plug cavity');
    assert.equal(contains(id, [4, -11, 5]), true, 'Outer housing wall');
  }
  const ah = models.find((m) => m.id === 'dc-pj-063ah')!;
  assert.match(ah.name, /5.5\/2.1/);
  assert.match(ah.scope, /Ø2.0 mm/);
  assert.match(models.find((m) => m.id === 'dc-pj-063bh')!.scope, /Ø2.5 mm/);
});

test('DE-9 mounting flanges retain 25 mm spaced through holes and material around them', () => {
  for (const x of [-6.96, 18.04]) {
    assert.equal(contains('dsub9-pins', [x, -1.42, 4.5]), false);
    assert.equal(contains('dsub9-pins', [x + 2, -1.42, 4.5]), true);
  }
});

test('SMA catalog records keep the missing female contact bore limitation visible', () => {
  for (const model of models.filter((m) => m.family === 'SMA')) {
    assert.equal(model.contactType, 'socket');
    assert.match(model.scope, /socket bore is absent/);
    assert.match(
      part.presets!.find((p) => p.id === model.id)!.catalog!.geometryEvidence!.limitations,
      /socket bore is absent/,
    );
    assert.match(part.assessment!({ model: model.id }).join(' '), /RP-SMA/);
  }
});

test('source reference download excludes binary payload and declares community scope and PCB datum', () => {
  for (const model of models) {
    const file = part.fabricationFiles!({ model: model.id })[0],
      data = JSON.parse(file.content);
    assert.equal(data.sourceSha256, model.sourceSha256);
    assert.equal(data.components.length, model.native.sourceSolids);
    assert.match(file.content, /community/);
    assert.doesNotMatch(file.content, /"brep"|"triangles"|"vertices"/);
    assert.ok(part.assessment!({ model: model.id }).some((note) => note.includes('PCB')));
  }
});

test('source-color preservation retains geometry fingerprints and records every fallback', () => {
  let sourceColors = 0,
    illustrative = 0;
  for (const model of models) {
    const asset = model.native,
      evidence = colorEvidence.models[model.id];
    assert.equal(evidence.sourceSha256, model.sourceSha256);
    const payload = [
      asset.sourceSha256,
      asset.sourceFile,
      ...asset.components.flatMap((c) => [c.id, c.brep, c.vertices, c.triangles]),
    ].join('\n');
    assert.equal(
      createHash('sha256').update(payload).digest('hex'),
      evidence.geometryFingerprint,
      model.id + ' unchanged native and preview geometry',
    );
    assert.equal(evidence.components.length, asset.components.length);
    for (const [i, entry] of evidence.components.entries()) {
      if (entry.kind === 'source-step') {
        sourceColors++;
        assert.equal(entry.rgb!.length, 3);
        assert.ok(entry.faceCount! > 0);
        const packed = entry.rgb!.reduce(
          (sum, v, axis) => sum + (Math.round(v * 255) << (8 * (2 - axis))),
          0,
        );
        assert.equal(asset.components[i].color, packed);
      } else {
        illustrative++;
        assert.match(entry.reason!, /mixed|incomplete|order|count|shell/);
      }
    }
  }
  assert.equal(sourceColors, 87);
  assert.equal(illustrative, 32);
  const usb = models.find((m) => m.id === 'usb-c-amphenol-12401610')!;
  assert.deepEqual(
    usb.native.components.slice(0, 3).map((c) => c.color),
    [0x5f5f5f, 0x5f5f5f, 0x262525],
  );
  assert.ok(usb.native.components.slice(3).every((c) => c.color === 0xdbbc7e));
  assert.ok(usb.colors.every((c) => c.kind === 'source-step'));
});
