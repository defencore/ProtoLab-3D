import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import part, { splineOutline } from '../src/parts/servo-gear/part';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { generateScript } from '../src/core/freecad';
import type { Parameters } from '../src/core/types';

test('servo gear catalog keeps external and spline teeth distinct and records partial evidence', () => {
  assert.equal(part.presets.filter((p) => p.catalog).length, 13);
  for (const preset of part.presets)
    assert.deepEqual(validateParameters(part, preset.parameters, 'default'), [], preset.id);
  for (const teeth of [20, 30]) {
    const preset = part.presets.find((p) => p.id === `2305-0024-00${teeth}`)!;
    assert.equal(preset.parameters.splineTeeth, 24);
    assert.equal(preset.parameters.teeth, teeth);
    assert.equal(preset.parameters.screwBore, 3);
    assert.ok(preset.catalog!.verifiedParameters.includes('faceWidth'));
    assert.ok(!preset.catalog!.verifiedParameters.includes('splineMajor'));
    assert.match(preset.catalog!.sourceUrl, /^https:\/\/www\.servocity\.com\/2305-series-/);
  }
});

test('every servo gear preset is a closed positive-volume shell with matching dimensions', () => {
  for (const preset of part.presets) {
    const model = part.buildGeometry(preset.parameters, 'default');
    try {
      const bounds = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
      part
        .dimensions(preset.parameters, 'default')
        .forEach((d, i) => assert.ok(Math.abs(d - bounds[i]) < 0.002));
      model.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        const positions = child.geometry.getAttribute('position'),
          edges = new Map<string, number>();
        let volume = 0;
        for (let i = 0; i < positions.count; i += 3) {
          const points = [0, 1, 2].map((j) => new Vector3().fromBufferAttribute(positions, i + j));
          assert.ok(points.every((p) => p.toArray().every(Number.isFinite)));
          assert.ok(
            points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).length() >
              1e-9,
          );
          volume += points[0].dot(points[1].clone().cross(points[2])) / 6;
          const keys = points.map((p) =>
            p
              .toArray()
              .map((v) => Math.round(v * 1e5))
              .join(','),
          );
          for (let j = 0; j < 3; j++) {
            const edge = [keys[j], keys[(j + 1) % 3]].sort().join('|');
            edges.set(edge, (edges.get(edge) ?? 0) + 1);
          }
        }
        assert.ok(volume > 0);
        for (const count of edges.values()) assert.equal(count, 2, preset.id);
      });
    } finally {
      disposeModel(model);
    }
  }
});

test('blind spline has a real retaining shoulder and through spline remains open', () => {
  for (const socket of ['blind', 'through']) {
    const model = part.buildGeometry({ ...part.defaults, socket }, 'default');
    model.updateMatrixWorld(true);
    try {
      assert.equal(
        new Raycaster(new Vector3(0, 0, -10), new Vector3(0, 0, 1)).intersectObject(model, true)
          .length,
        0,
        'Retaining screw opening',
      );
      const hits = new Raycaster(new Vector3(2, 0, -10), new Vector3(0, 0, 1)).intersectObject(
        model,
        true,
      );
      if (socket === 'blind') assert.ok(Math.abs(hits[0].point.z - 3) < 1e-6);
      else assert.equal(hits.length, 0);
    } finally {
      disposeModel(model);
    }
  }
  for (const count of [15, 23, 24, 25])
    assert.equal(splineOutline({ ...part.defaults, splineTeeth: count }).length, count * 2);
});

test('impossible servo sockets cannot be exported', () => {
  const patches: Parameters[] = [
    { splineMinor: 6 },
    { socketDepth: 5.5 },
    { splineTeeth: 24.5 },
    { hub: true, hubDiameter: 6 },
    { counterboreDiameter: 18 },
    { screwBore: 5.8 },
  ];
  for (const patch of patches) {
    const p = { ...part.defaults, ...patch };
    assert.ok(validateParameters(part, p, 'default').length);
    assert.throws(() => generateScript(part, p, 'default'));
  }
});
