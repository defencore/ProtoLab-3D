import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import axis, { ballScrewAxisLayout } from "../src/parts/ball-screw-axis/part";
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import { generateScript } from '../src/core/freecad';

test('axis presets preserve their screw lead and keep table travel clear of the supports', () => {
  for (const preset of axis.presets) {
    assert.equal(
      preset.catalog,
      undefined,
      'A prototype assembly must not claim catalog verification.',
    );
    for (const position of [0, 50, 100]) {
      const p = { ...preset.parameters, position };
      assert.deepEqual(validateParameters(axis, p, 'assembled'), [], preset.id);
      const v = ballScrewAxisLayout(p);
      assert.ok(v.travel > 10);
      assert.ok(v.center - v.tableLength / 2 > v.v.start);
      assert.ok(v.center + v.tableLength / 2 < v.v.end);
      const carriageCenter =
        (Number(v.rail.position) / 100 - 0.5) *
        (Number(v.rail.length) - Number(v.rail.blockLength));
      assert.ok(Math.abs(carriageCenter - v.v.center) < 1e-8);
    }
  }
});

test('axis preview exports closed components and matches configured assembly bounds', () => {
  for (const preset of [axis.presets[0], axis.presets[2]]) {
    const model = axis.buildGeometry(preset.parameters, 'assembled');
    try {
      const dimensions = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
      axis
        .dimensions(preset.parameters, 'assembled')
        .forEach((value, i) => assert.ok(Math.abs(value - dimensions[i]) < 0.01));
      model.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        const vertices = child.geometry.getAttribute('position'),
          index = child.geometry.index;
        const edges = new Map<string, number>();
        for (let i = 0; i < (index?.count ?? vertices.count); i += 3) {
          const keys = [0, 1, 2].map((offset) => {
            const j = index ? index.getX(i + offset) : i + offset;
            return [vertices.getX(j), vertices.getY(j), vertices.getZ(j)]
              .map((value) => Math.round(value * 1e4))
              .join(',');
          });
          for (let k = 0; k < 3; k++) {
            if (keys[k] === keys[(k + 1) % 3]) continue;
            const key = [keys[k], keys[(k + 1) % 3]].sort().join('|');
            edges.set(key, (edges.get(key) ?? 0) + 1);
          }
        }
        assert.equal(
          [...edges.values()].filter((count) => count !== 2).length,
          0,
          `${preset.id}: ${child.name || child.parent?.name}`,
        );
      });
      assert.ok(model.getObjectByName('Moving mounting table'));
      assert.ok(model.getObjectByName('Fixed support bearing'));
      assert.ok(model.getObjectByName('Nut flange bolt 1'));
    } finally {
      disposeModel(model);
    }
  }
});

test('axis macros isolate sub-generators and expose independently movable components', () => {
  const script = generateScript(axis, axis.defaults, 'assembled');
  assert.match(script, /def axis_screw\(\):/);
  assert.match(script, /def axis_guide_left\(\):/);
  assert.match(script, /def axis_guide_right\(\):/);
  assert.match(script, /component_labels = axis_labels/);
  assert.match(script, /doc.addObject\("App::Part"/);
});
