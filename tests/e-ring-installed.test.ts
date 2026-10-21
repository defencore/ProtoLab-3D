import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Mesh, Vector2, Vector3 } from 'three';
import eRing, { eRingOutline } from '../src/parts/e-ring/part';
import type { Parameters } from '../src/core/types';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

test('stock E-rings preserve the free profile, native recipe and source identity', () => {
  assert.equal(eRing.defaults.installedGrooveDiameter, 0);
  const field = eRing.parameters.find((p) => p.key === 'installedGrooveDiameter')!;
  assert.equal(field.filterable, false);
  assert.equal(field.visibleWhen!(eRing.defaults), false);
  assert.equal(
    sha256(JSON.stringify(eRingOutline(eRing.defaults).map((point) => point.toArray()))),
    '73c6a8c4095186bc1f7df6109772e37653e063e0f111d47e0004d5abf09e723a',
  );
  assert.equal(
    sha256(eRing.python(eRing.defaults, 'default')),
    'b687dd771680a14fc365b92c0d416e015997af31cc918565d86f70d556797f40',
  );
  for (const preset of eRing.presets) {
    assert.equal(preset.parameters.installedGrooveDiameter, 0);
    assert.ok(!preset.catalog?.verifiedParameters.includes('installedGrooveDiameter'));
    assert.deepEqual(validateParameters(eRing, preset.parameters, 'default'), []);
    assert.ok(!eRing.python(preset.parameters, 'default').includes('InstalledGrooveEnvelope'));
  }
});

function distanceToSegment(a: Vector2, b: Vector2, point = new Vector2()): number {
  const delta = b.clone().sub(a);
  const t = Math.max(0, Math.min(1, point.clone().sub(a).dot(delta) / delta.lengthSq()));
  return a.clone().addScaledVector(delta, t).distanceTo(point);
}

test('installed E-rings centre three tangent contact lands on the groove axis without penetrating it', () => {
  for (const preset of eRing.presets) {
    const p: Parameters = {
      ...preset.parameters,
      installedGrooveDiameter: Number(preset.parameters.grooveDiameter),
    };
    const source = JSON.stringify(preset.parameters);
    assert.deepEqual(validateParameters(eRing, p, 'default'), []);
    const points = eRingOutline(p),
      r = Number(p.grooveDiameter) / 2;
    for (const contact of [new Vector2(r, 0), new Vector2(0, -r), new Vector2(-r, 0)])
      assert.ok(
        points.some(
          (point, index) =>
            distanceToSegment(point, points[(index + 1) % points.length], contact) < 1e-9,
        ),
        preset.id,
      );
    for (let i = 0; i < points.length; i++)
      assert.ok(
        distanceToSegment(points[i], points[(i + 1) % points.length]) >= r - 1e-9,
        `${preset.id}: no contour edge may cross the nominal groove`,
      );
    for (const angle of [-45, -135]) {
      const relief = points.find(
        (point) => Math.abs((Math.atan2(point.y, point.x) * 180) / Math.PI - angle) < 1e-8,
      )!;
      assert.ok(relief.length() > r * 1.05, `${preset.id}: two relief pockets remain`);
    }
    const python = eRing.python(p, 'default');
    assert.match(python, /InstalledGrooveEnvelope/);
    assert.match(python, /No machining of the purchased DIN 6799 ring/);
    assert.equal(JSON.stringify(preset.parameters), source);
  }
});

test('installed E-ring previews remain closed single meshes with outward volume', () => {
  for (const preset of eRing.presets) {
    const p: Parameters = {
      ...preset.parameters,
      installedGrooveDiameter: Number(preset.parameters.grooveDiameter),
    };
    const model = eRing.buildGeometry(p, 'default');
    try {
      assert.equal(model.children.length, 1);
      model.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        const positions = child.geometry.getAttribute('position'),
          index = child.geometry.getIndex(),
          edges = new Map<string, number>();
        let volume = 0;
        for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
          const vertices = [i, i + 1, i + 2].map((j) =>
            new Vector3().fromBufferAttribute(positions, index ? index.getX(j) : j),
          );
          assert.ok(vertices.every((point) => point.toArray().every(Number.isFinite)));
          const [a, b, c] = vertices;
          assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).length() > 1e-10);
          volume += a.dot(b.clone().cross(c)) / 6;
          const keys = vertices.map((point) =>
            point
              .toArray()
              .map((value) => Math.round(value * 1e6))
              .join(','),
          );
          for (let side = 0; side < 3; side++) {
            const key = [keys[side], keys[(side + 1) % 3]].sort().join('|');
            edges.set(key, (edges.get(key) ?? 0) + 1);
          }
        }
        assert.ok(volume > 0, preset.id);
        assert.ok(
          [...edges.values()].every((count) => count === 2),
          preset.id,
        );
      });
    } finally {
      disposeModel(model);
    }
  }
});

test('installed E-ring validation rejects a changed stock groove and vanishing relief pockets', () => {
  for (const installed of [-1, Number.NaN, Number.POSITIVE_INFINITY, 4, 5.1])
    assert.ok(
      eRing.validate({ ...eRing.defaults, installedGrooveDiameter: installed }, 'default').length,
    );
  assert.ok(
    eRing
      .validate({ ...eRing.defaults, outerDiameter: 6.5, installedGrooveDiameter: 5 }, 'default')
      .some((error) => error.includes('relief pockets')),
  );
});
