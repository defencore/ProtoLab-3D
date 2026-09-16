import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { Box3, DoubleSide, Mesh, Raycaster, Vector2, Vector3 } from 'three';
import { parts } from '../src/parts';
import { disposeModel, unionPolygons } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import type { Parameters } from '../src/core/types';
const get = (id: string) => parts.find((p) => p.id === id)!;
function meshSignature(id: string, p: Parameters) {
  const part = get(id),
    model = part.buildGeometry(p, part.states?.[0].id ?? 'default'),
    hash = createHash('sha256');
  model.updateMatrixWorld(true);
  try {
    model.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const attr = o.geometry.getAttribute('position');
      for (let i = 0; i < attr.count; i++) {
        const v = new Vector3().fromBufferAttribute(attr, i).applyMatrix4(o.matrixWorld);
        hash.update(
          v
            .toArray()
            .map((x) => Math.round(x * 1e5))
            .join(',') + ';',
        );
      }
    });
    return hash.digest('hex');
  } finally {
    disposeModel(model);
  }
}

test('shared collinear edges disappear from planar union without losing outer edges', () => {
  const polygon = (points: number[][]) => points.map(([x, y]) => new Vector2(x, y));
  const outline = unionPolygons([
    polygon([
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ]),
    polygon([
      [2, 0.5],
      [4, 0.5],
      [4, 1.5],
      [2, 1.5],
    ]),
  ]);
  const area =
    outline.reduce((a, p, i) => {
      const q = outline[(i + 1) % outline.length];
      return a + p.x * q.y - q.x * p.y;
    }, 0) / 2;
  assert.ok(Math.abs(area - 6) < 1e-8);
  assert.throws(
    () =>
      unionPolygons([
        polygon([
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ]),
        polygon([
          [3, 0],
          [4, 0],
          [4, 1],
          [3, 1],
        ]),
      ]),
    /connected|disconnected/,
  );
});

test('wider servo horn roots produce connected model outlines', () => {
  const part = get('servo-arm');
  for (const preset of part.presets)
    for (const width of [14.1, 16.8]) {
      const p = { ...part.defaults, ...preset.parameters, armWidth: width };
      if (validateParameters(part, p, part.states?.[0].id ?? 'default').length) continue;
      assert.doesNotThrow(() => part.python(p, part.states?.[0].id ?? 'default'), preset.id);
    }
});

for (const [id, forms] of [
  ['shaft', ['stepped', 'taper', 'spline']],
  ['threaded-insert', ['heat', 'press', 'rivnut', 'clinch']],
  ['robot-wheel', ['pneumatic', 'omni', 'mecanum']],
  ['shaft-coupling', ['rigid', 'oldham', 'bellows', 'beam', 'flange']],
  ['cable-carrier', ['duct', 'chain']],
  ['fluid-cylinder', ['round', 'tie', 'compact', 'hydraulic', 'rodless']],
] as [string, string[]][])
  test(`${id}: construction selector changes preview geometry even in envelope mode`, () => {
    const signatures = forms.map((form) =>
      meshSignature(id, { ...get(id).defaults, detail: 'envelope', form }),
    );
    assert.equal(new Set(signatures).size, forms.length);
  });

test('family controls apply complete valid preset dimensions', () => {
  for (const [id, key] of [
    ['belt-drive', 'form'],
    ['duct', 'form'],
    ['industrial-motor', 'form'],
    ['ball-screw', 'family'],
    ['ball-nut', 'family'],
  ]) {
    const part = get(id),
      field = part.parameters.find((f) => f.key === key)!;
    for (const option of field.options!) {
      const p = part.updateParameters!({ ...part.defaults, [key]: option.value }, key);
      const expected = part.presets.filter((x) => x.parameters[key] === option.value);
      if (!expected.length) continue;
      assert.ok(
        expected.some((x) =>
          Object.entries(x.parameters).every(([k, v]) => k === 'detail' || p[k] === v),
        ),
        `${id}/${option.value}`,
      );
      assert.deepEqual(
        validateParameters(part, p, part.states?.[0].id ?? 'default'),
        [],
        `${id}/${option.value}`,
      );
    }
  }
});

test('lead screw input revolutions and travel stay coupled when pitch changes', () => {
  const part = get('lead-screw-axis');
  const moved = part.updateParameters!({ ...part.defaults, turns: 12.5 }, 'turns');
  assert.equal(moved.position, 25);
  const repitched = part.updateParameters!({ ...moved, pitch: 4 }, 'pitch');
  assert.equal(repitched.position, 50);
  assert.notEqual(meshSignature(part.id, moved), meshSignature(part.id, repitched));
  assert.equal(part.updateParameters!({ ...repitched, position: 60 }, 'position').turns, 15);
});

test('controls for absent components and inactive deformations are hidden', () => {
  for (const [id, key, hidden, shown] of [
    ['compression-spring', 'compression', 'relaxed', 'compressed'],
    ['cotter-pin', 'bendAngle', 'straight', 'bent'],
    ['holding-electromagnet', 'airGap', 'magnet-only', 'assembled'],
    ['piston', 'explodedGap', 'assembled', 'exploded'],
    ['ball-screw', 'nutDiameter', 'screw', 'assembled'],
    ['multicopter-frame', 'wheelbase', 'body', 'assembled'],
    ['servo-motor', 'outputAngle', 'body', 'assembled'],
    ['gearbox', 'mountPitch', 'internals', 'assembled'],
    ['gearbox', 'mountHole', 'internals', 'assembled'],
  ]) {
    const part = get(id),
      field = part.parameters.find((f) => f.key === key)!;
    assert.equal(field.visibleWhen!(part.defaults, hidden), false, `${id}/${hidden}`);
    assert.equal(field.visibleWhen!(part.defaults, shown), true, `${id}/${shown}`);
    assert.equal(field.visibleWhen!(part.defaults), true, `${id}/catalog`);
  }
});

test('prototype examples retain prototype evidence instead of invented purchase SKUs', () => {
  for (const id of [
    'gearbox',
    'differential',
    'brake',
    'robot-wheel',
    'fluid-cylinder',
    'shaft-coupling',
    'belt-drive',
  ]) {
    const part = get(id);
    assert.equal(part.complexity, 'Parametric prototype');
    assert.ok(part.presets.every((p) => !p.catalog));
  }
});

test('multi-rib belt retains continuous backing across the complete belt width', () => {
  const part = get('belt-drive');
  const preset = part.presets.find((item) => item.parameters.form === 'poly')!;
  for (const ribs of [2, 6]) {
    const model = part.buildGeometry({ ...preset.parameters, ribs }, 'assembled');
    try {
      model.updateMatrixWorld(true);
      const belt = model.children[0];
      const bounds = new Box3().setFromObject(belt, true);
      belt.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          material.side = DoubleSide;
      });
      const ray = new Raycaster(
        new Vector3((bounds.min.x + bounds.max.x) / 2, bounds.max.y - 0.05, bounds.max.z + 1),
        new Vector3(0, 0, -1),
      );
      const distances = [
        ...new Set(
          ray.intersectObject(belt, true).map((hit) => Math.round(hit.distance * 1e4) / 1e4),
        ),
      ];
      assert.equal(
        distances.length,
        2,
        'backing must have only an entrance and exit, without gaps between ribs',
      );
      assert.ok(Math.abs(distances[0] - 1) < 0.001);
      assert.ok(Math.abs(distances[1] - 1 - Number(preset.parameters.width)) < 0.001);
    } finally {
      disposeModel(model);
    }
  }
});
