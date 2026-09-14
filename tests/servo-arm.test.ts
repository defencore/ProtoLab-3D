import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import part from '../src/parts/servo-arm/part';
import type { Parameters } from '../src/core/types';
import { holeCenters, hornOutline, splinePoints } from '../src/parts/servo-arm/lib/geometry';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';

test('servo horn references retain printed dimensions and separate prototype fit from source evidence', () => {
  assert.equal(part.presets.length, 28);
  for (const preset of part.presets) {
    for (const state of part.states!)
      assert.deepEqual(validateParameters(part, preset.parameters, state.id), [], preset.id);
    assert.equal(preset.catalog!.sourceKind, 'attachment');
    assert.ok(!preset.catalog!.verifiedParameters.includes('splineMinorDiameter'));
  }
  const pdrs = part.presets.find((p) => p.id === 'pdrs60-15t')!;
  assert.equal(pdrs.parameters.firstHoleRadius, 25.4);
  assert.equal(pdrs.parameters.holeCount, 8);
  const cross = part.presets.find((p) => p.id === 'q-xa15-cross')!;
  assert.deepEqual(
    holeCenters(cross.parameters)
      .slice(0, 4)
      .map((p) => p[0]),
    [9.5, 14.5, 19.5, 24.5],
  );
  assert.ok(cross.catalog!.verifiedParameters.includes('perpendicularFirstHole'));
});

test('all horn shapes and clamp use finite, centered geometry with matching reported dimensions', () => {
  const ids = [
    'aluminium-25t-single-28',
    'aluminium-25t-double-47',
    'q-xa15-cross',
    '6mm-six-31-7',
    '5mm-disc-18-7',
    '25t-clamping-52',
  ];
  for (const id of ids) {
    const p = part.presets.find((p) => p.id === id)!.parameters;
    for (const state of part.states!) {
      const model = part.buildGeometry(p, state.id);
      try {
        model.updateMatrixWorld(true);
        const bounds = new Box3().setFromObject(model, true);
        assert.ok(bounds.getCenter(new Vector3()).length() < 1e-4, id);
        const size = bounds.getSize(new Vector3()).toArray();
        part
          .dimensions(p, state.id)
          .forEach((v, i) => assert.ok(Math.abs(v - size[i]) < 1e-4, `${id}: ${v} vs ${size[i]}`));
        let meshes = 0;
        model.traverse((child) => {
          if (!(child instanceof Mesh)) return;
          meshes++;
          const position = child.geometry.getAttribute('position');
          for (const value of position.array) assert.ok(Number.isFinite(value));
        });
        assert.equal(meshes, p.clamp ? 2 : 1);
      } finally {
        disposeModel(model);
      }
    }
  }
});

test('every reference horn produces closed outward component meshes', () => {
  for (const preset of part.presets) {
    const model = part.buildGeometry(preset.parameters, 'assembled');
    try {
      model.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        const positions = child.geometry.getAttribute('position'),
          edges = new Map<string, number>();
        let volume = 0;
        for (let i = 0; i < positions.count; i += 3) {
          const vertices = [0, 1, 2].map((j) =>
            new Vector3().fromBufferAttribute(positions, i + j),
          );
          assert.ok(
            vertices[1]
              .clone()
              .sub(vertices[0])
              .cross(vertices[2].clone().sub(vertices[0]))
              .lengthSq() > 1e-18,
            preset.id,
          );
          volume += vertices[0].dot(vertices[1].clone().cross(vertices[2])) / 6;
          const keys = vertices.map((v) =>
            v
              .toArray()
              .map((x) => Math.round(x * 1e5))
              .join(','),
          );
          for (let j = 0; j < 3; j++) {
            const key = [keys[j], keys[(j + 1) % 3]].sort().join('|');
            edges.set(key, (edges.get(key) ?? 0) + 1);
          }
        }
        assert.ok(volume > 0, preset.id);
        for (const [edge, uses] of edges) assert.equal(uses, 2, `${preset.id}: ${edge}`);
      });
    } finally {
      disposeModel(model);
    }
  }
});

test('spline socket has the selected tooth count and linkage bores remain physically open', () => {
  const p = part.defaults,
    points = splinePoints(p);
  assert.equal(points.length, 100);
  const radii = [...new Set(points.map(([x, y]) => Math.hypot(x, y).toFixed(4)))].sort();
  assert.deepEqual(radii, ['2.7000', '2.9500']);
  const model = part.buildGeometry(p, 'assembled');
  try {
    model.updateMatrixWorld(true);
    const outline = hornOutline(p),
      centerX = (Math.min(...outline.map((p) => p[0])) + Math.max(...outline.map((p) => p[0]))) / 2;
    for (const [x, y] of [[0, 0], ...holeCenters(p)]) {
      const ray = new Raycaster(new Vector3(x - centerX, y, -20), new Vector3(0, 0, 1));
      assert.equal(
        ray.intersectObject(model, true).length,
        0,
        `Blocked through bore at ${x}, ${y}`,
      );
    }
    const socketRay = new Raycaster(new Vector3(2.6 - centerX, 0, -20), new Vector3(0, 0, 1));
    const hits = socketRay.intersectObject(model, true);
    assert.ok(hits.length > 0, 'Socket must have a retaining screw seat');
    assert.ok(
      Math.abs(hits[0].point.z - (Number(p.socketDepth) - Number(p.hubHeight) / 2)) < 1e-4,
      'Socket depth must reach the modelled seat',
    );
  } finally {
    disposeModel(model);
  }
});

test('clamp export preserves an independent screw and invalid horn fits are rejected', () => {
  const p = part.presets.find((p) => p.id === '25t-clamping-52')!.parameters;
  const macro = part.python(p, 'socket-up');
  assert.match(macro, /component_labels.append\("Clamp screw"\)/);
  assert.match(macro, /Part.makeCompound\(components\)/);
  assert.match(macro, /socket serrations|Socket serrations/);
  for (const change of [
    { splineMinorDiameter: 6 },
    { socketDepth: 7.4 },
    { holeCount: 10 },
    { firstHoleRadius: 2 },
    { splineTeeth: 24.5 },
  ] as Parameters[])
    assert.ok(validateParameters(part, { ...part.defaults, ...change }, 'assembled').length > 0);
});
