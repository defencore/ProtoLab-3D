import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import camera from '../src/parts/camera/part';
import models from '../src/parts/camera/lib/models.json';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import {
  buildPresetIndex,
  emptyPresetFilters,
  filterPresets,
  fieldId,
} from '../src/core/preset-search';
function checkMesh(mesh: Mesh, label: string) {
  const positions = mesh.geometry.getAttribute('position');
  const indices = mesh.geometry.index;
  const edges = new Map<string, { count: number; winding: number }>();
  let volume = 0;
  for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
    const points = [0, 1, 2].map((j) =>
      new Vector3().fromBufferAttribute(positions, indices ? indices.getX(i + j) : i + j),
    );
    assert.ok(
      points.every((p) => p.toArray().every(Number.isFinite)),
      `${label}: finite vertices`,
    );
    assert.ok(
      points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).lengthSq() > 1e-18,
      `${label}: nondegenerate triangles`,
    );
    volume += points[0].dot(points[1].clone().cross(points[2])) / 6;
    const keys = points.map((p) =>
      p
        .toArray()
        .map((v) => Math.round(v * 1e5))
        .join(','),
    );
    for (let j = 0; j < 3; j++) {
      const a = keys[j],
        b = keys[(j + 1) % 3],
        key = [a, b].sort().join('|');
      const edge = edges.get(key) ?? { count: 0, winding: 0 };
      edge.count++;
      edge.winding += a < b ? 1 : -1;
      edges.set(key, edge);
    }
  }
  assert.ok(volume > 0, `${label}: positive outward volume`);
  for (const edge of edges.values())
    assert.deepEqual(edge, { count: 2, winding: 0 }, `${label}: closed oriented boundary`);
}

test('camera catalog has fixed models and source-aware filters', () => {
  assert.equal(camera.presets.length, 24);
  assert.equal(camera.catalogSelectionOnly, true);
  for (const preset of camera.presets) {
    assert.deepEqual(validateParameters(camera, preset.parameters, 'assembled'), []);
    assert.ok(camera.validate({ ...preset.parameters, width: 100 }, 'assembled').length);
    assert.ok(
      preset.catalog?.sourceUrl.startsWith('https://') ||
        (preset.catalog?.sourceKind === 'attachment' &&
          preset.catalog.sourceUrl === ''),
    );
  }
  assert.ok(camera.validate({ model: 'unknown' }, 'assembled').length);
  assert.ok(camera.validate(camera.defaults, 'invalid').length);
  const filters = emptyPresetFilters(camera);
  filters.parameters[fieldId(camera.catalogFilterFields!.find((f) => f.key === 'depth')!)] = {
    min: '0',
    max: '300',
  };
  const matches = filterPresets(buildPresetIndex([camera]), filters).items;
  assert.equal(matches.length, 16);
  assert.ok(
    !matches.some((i) => i.preset.id === 'ratel2'),
    'assumed depth excluded from filtering',
  );
  const attrs = (id: string) => camera.presets.find((p) => p.id === id)!.catalog!.attributes!;
  for (const id of ['dji-o4', 'dji-o4-pro', 'lepton35', 'lepton31r']) {
    assert.equal(attrs(id).weight, undefined);
    assert.equal(attrs(id).voltageMin, undefined);
  }
  for (const id of ['phoenix2-spv5', 'ratel2', 'baby-ratel2']) {
    assert.equal(attrs(id).pixelsX, undefined);
    assert.equal(attrs(id).tvl, 1200);
  }
  for (const id of ['mlx90640-55', 'mlx90640-110']) {
    assert.equal(attrs(id).pixelsX, 32);
    assert.equal(attrs(id).pixelsY, 24);
    assert.equal(attrs(id).fps, 16);
  }
});

for (const preset of camera.presets) {
  test(`${preset.id}: closed camera meshes and source envelope in both states`, () => {
    for (const state of camera.states!) {
      const group = camera.buildGeometry(preset.parameters, state.id);
      try {
        const bounds = new Box3().setFromObject(group, true);
        const size = bounds.getSize(new Vector3());
        camera
          .dimensions(preset.parameters, state.id)
          .forEach((v, i) =>
            assert.ok(Math.abs(size.getComponent(i) - v) < 0.01, 'reported dimensions'),
          );
        if (state.id === 'assembled') {
          const m = models.find((m) => m.id === preset.id)!;
          [m.width, m.height, m.depth].forEach((v, i) =>
            assert.ok(
              Math.abs(size.getComponent(i) - v) < 0.01,
              `${preset.id}: source envelope axis ${i}`,
            ),
          );
        }
        assert.ok(group.children.length >= 5);
        group.traverse((mesh) => {
          if (mesh instanceof Mesh) checkMesh(mesh, preset.id + '/' + mesh.name);
        });
      } finally {
        disposeModel(group);
      }
    }
  });
}

test('Pi mounting holes are open at the published drawing datums', () => {
  for (const id of ['pi3-standard', 'pi3-wide', 'pi-global-shutter']) {
    const m = models.find((m) => m.id === id)!;
    const g = camera.buildGeometry({ model: id }, 'assembled');
    g.updateMatrixWorld(true);
    try {
      const pcb = g.children.find((c) => c.name === 'Camera PCB')!;
      for (const h of m.geometry.mountHoles!) {
        const hits = new Raycaster(
          new Vector3(h.x, h.y, 10),
          new Vector3(0, 0, -1),
        ).intersectObject(pcb, true);
        assert.equal(hits.length, 0, `${id}: mounting hole must be through`);
      }
      if (id === 'pi-global-shutter') {
        const mount = g.children.find((c) => c.name === 'CS lens mount')!;
        assert.equal(
          new Raycaster(new Vector3(0, 0, 10), new Vector3(0, 0, -1)).intersectObject(mount, true)
            .length,
          0,
        );
      }
    } finally {
      disposeModel(g);
    }
  }
});

test('DM and UC references retain separate optics, power interfaces and rate semantics', () => {
  const attrs = (id: string) => camera.presets.find((p) => p.id === id)!.catalog!.attributes!;
  assert.equal(attrs('dm256-4mm').focalLength, 4);
  assert.equal(attrs('dm256-10mm').focalLength, 10);
  assert.equal(attrs('dm384-9-1mm').focalLength, 9.1);
  for (const id of ['uc256-9mm', 'uc384-9mm']) {
    assert.equal(attrs(id).interface, 'usb-uvc');
    assert.equal(attrs(id).voltageMin, 5);
    assert.equal(attrs(id).voltageMax, 5);
  }
  assert.equal(attrs('uc640-9mm').interface, 'cvbs');
  assert.equal(attrs('uc640-9mm').voltageMin, 4.5);
  assert.equal(attrs('uc640-9mm').voltageMax, 18);
  for (const p of camera.presets.filter((p) => /^(dm|uc)\d/.test(p.id))) {
    const a = p.catalog!.attributes!;
    assert.equal(
      a.depth,
      undefined,
      'conflicting or incomplete depth must not be a sourced filter',
    );
    assert.equal(a.fps, undefined, 'reported 50 Hz must not imply progressive CVBS/USB throughput');
    assert.equal(a.detectorRate, 50);
    assert.equal(a.radiometric, undefined);
    assert.equal(p.catalog!.sourceKind, 'attachment');
    assert.ok(p.catalog!.alternateSourceUrls!.some((u) => u.endsWith('-drawing.png')));
  }
  const filters = emptyPresetFilters(camera);
  filters.parameters[fieldId(camera.catalogFilterFields!.find((f) => f.key === 'focalLength')!)] = {
    min: '10',
    max: '10',
  };
  assert.deepEqual(
    filterPresets(buildPresetIndex([camera]), filters).items.map((i) => i.preset.id),
    ['dm256-10mm'],
  );
});

test('thermal stack mounting bores have twelve millimetre spacing and blind ends', () => {
  for (const [id, projection, blindDepth] of [
    ['dm256-4mm', 12.4, 2],
    ['uc256-9mm', 8.8, 2.5],
  ] as const) {
    const g = camera.buildGeometry({ model: id }, 'assembled');
    g.updateMatrixWorld(true);
    try {
      const plate = g.children.find((c) => c.name === 'Front mounting plate')!;
      for (const t of [-6, 6]) {
        for (const side of [-1, 1]) {
          const hx = new Raycaster(
            new Vector3(side * 12, t, -projection - 2),
            new Vector3(-side, 0, 0),
          ).intersectObject(plate, true);
          assert.ok(Math.abs(hx[0].point.x - side * (10.5 - blindDepth)) < 0.002);
          const hy = new Raycaster(
            new Vector3(t, side * 12, -projection - 2),
            new Vector3(0, -side, 0),
          ).intersectObject(plate, true);
          assert.ok(Math.abs(hy[0].point.y - side * (10.5 - blindDepth)) < 0.002);
        }
      }
      assert.equal(g.children.filter((c) => c.name.startsWith('Connector contact')).length, 5);
      assert.equal(
        g.children.some((c) => c.name === 'USB-C connector shield'),
        id.startsWith('uc'),
      );
    } finally {
      disposeModel(g);
    }
  }
});
