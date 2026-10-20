import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import part from '../src/parts/boat-hull-frame/part';
import {
  area,
  cuttingDxf,
  flatPanels,
  frameStations,
  occurrence,
  panels,
} from '../src/parts/boat-hull-frame/lib/model';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';

function meshVolume(mesh: Mesh): number {
  const vertices = mesh.geometry.getAttribute('position'),
    indices = mesh.geometry.index;
  let volume = 0;
  const edges = new Map<string, { count: number; winding: number }>();
  for (let i = 0; i < (indices?.count ?? vertices.count); i += 3) {
    const ps = [0, 1, 2].map((j) =>
      new Vector3().fromBufferAttribute(vertices, indices ? indices.getX(i + j) : i + j),
    );
    assert.ok(ps.every((p) => p.toArray().every(Number.isFinite)));
    assert.ok(ps[1].clone().sub(ps[0]).cross(ps[2].clone().sub(ps[0])).lengthSq() > 1e-18);
    volume += ps[0].dot(ps[1].clone().cross(ps[2])) / 6;
    const keys = ps.map((p) =>
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
  for (const edge of edges.values()) assert.deepEqual(edge, { count: 2, winding: 0 });
  assert.ok(volume > 0);
  return volume;
}
for (const preset of part.presets) {
  test(`${preset.id}: complementary lap datums and invariant fabrication recipes`, () => {
    const p = preset.parameters,
      stations = frameStations(p),
      all = panels(p),
      flat = flatPanels(p);
    assert.equal(all.length, Number(p.frameCount) + 1);
    assert.equal(Math.max(...stations.map((s) => s.width)), Number(p.beam));
    stations.forEach((s, i) => {
      const joint = s.bottom + Number(p.keelHeight) / 2,
        half = (Number(p.thickness) + Number(p.fitClearance)) / 2;
      for (const sign of [-1, 1]) {
        assert.ok(
          all[0].outline.some(
            ([x, y]) => Math.abs(x - s.x - sign * half) < 1e-8 && Math.abs(y - joint) < 1e-8,
          ),
        );
        assert.ok(
          all[i + 1].outline.some(
            ([x, y]) => Math.abs(x - sign * half) < 1e-8 && Math.abs(y - joint) < 1e-8,
          ),
        );
      }
    });
    all.forEach((panel, i) => {
      const canonical = occurrence(p, panel),
        laid = occurrence(p, flat[i]);
      assert.equal(canonical.libraryId, 'manufactured-detail');
      assert.equal(canonical.supply, 'manufactured');
      assert.deepEqual(canonical.parameters, laid.parameters);
      assert.deepEqual(flat[i].rotation, [0, 0, 0]);
      assert.equal(flat[i].translation[2], 0);
      assert.ok(area(panel.outline) > panel.holes.reduce((n, h) => n + area(h), 0));
    });
    const dxf = cuttingDxf(p);
    assert.match(dxf, /\$INSUNITS\n70\n4\n/);
    assert.equal(
      (dxf.match(/\nLWPOLYLINE\n/g) ?? []).length,
      all.reduce((n, a) => n + 1 + a.holes.length, 0),
    );
    assert.equal(
      (dxf.match(/\nAcDbPolyline\n/g) ?? []).length,
      (dxf.match(/\nLWPOLYLINE\n/g) ?? []).length,
    );
    assert.equal((dxf.match(/\nTEXT\n/g) ?? []).length, all.length);
  });
  for (const state of part.states!)
    test(`${preset.id}/${state.id}: closed panels with analytic stock volume`, () => {
      const p = preset.parameters;
      assert.deepEqual(validateParameters(part, p, state.id), []);
      const model = part.buildGeometry(p, state.id);
      try {
        const selected =
          state.id === 'keel'
            ? panels(p).slice(0, 1)
            : state.id === 'frame'
              ? [panels(p)[1 + Math.floor(Number(p.frameCount) / 2)]]
              : panels(p);
        let measured = 0,
          meshes = 0;
        model.traverse((o) => {
          if (o instanceof Mesh) {
            measured += meshVolume(o);
            meshes++;
          }
        });
        assert.equal(meshes, selected.length);
        const expected =
          selected.reduce(
            (sum, panel) =>
              sum + area(panel.outline) - panel.holes.reduce((n, h) => n + area(h), 0),
            0,
          ) * Number(p.thickness);
        assert.ok(Math.abs(measured - expected) / expected < 1e-4);
        const bounds = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
        part.dimensions(p, state.id).forEach((v, i) => assert.ok(Math.abs(v - bounds[i]) < 0.02));
        if (state.id === 'cut') assert.ok(Math.abs(bounds[2] - Number(p.thickness)) < 0.001);
        if (state.id === 'assembled') assert.ok(Math.abs(bounds[1] - Number(p.beam)) < 0.002);
      } finally {
        disposeModel(model);
      }
    });
}
test('flat-bottom frames remain closed and impossible half-laps/webs are rejected', () => {
  const p = { ...part.defaults, deadrise: 0 };
  assert.deepEqual(validateParameters(part, p, 'assembled'), []);
  const model = part.buildGeometry(p, 'assembled');
  try {
    model.traverse((o) => {
      if (o instanceof Mesh) meshVolume(o);
    });
  } finally {
    disposeModel(model);
  }
  const invalids: Parameters[] = [
    { keelHeight: 30, web: 20 },
    { depth: 70 },
    { frameCount: 4.5 },
    { thickness: 10, web: 8 },
    { beam: 600, deadrise: 30 },
  ];
  for (const patch of invalids)
    assert.ok(validateParameters(part, { ...part.defaults, ...patch }, 'assembled').length);
});
