import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { Box3, Mesh, Vector3 } from 'three';
import { disposeModel } from '../src/core/mechanical';
import { generateScript } from '../src/core/freecad';
import lch7 from '../src/parts/lch7-controller/part';
import tracker from '../src/parts/gps-tracker/part';
import buzzer from '../src/parts/recovery-buzzer/part';
import pwm from '../src/parts/pwm-switch/part';
const modules = [
  { part: lch7, size: [50.97594, 44, 7.48268] },
  { part: tracker, size: [35, 20, 4.5] },
  { part: buzzer, size: [20, 10, 8] },
  { part: pwm, size: [17, 13, 10] },
];
test('LCH7 dimensions and repeated exports preserve the assembled and exploded source geometry', () => {
  const states = ['assembled', 'exploded'];
  const recipes = states.map((state) => lch7.python(lch7.defaults, state));
  for (const selected of ['exploded', 'assembled', 'exploded', 'assembled']) {
    const size = lch7.dimensions(lch7.defaults, selected);
    assert.ok(Math.abs(size[2] - (selected === 'exploded' ? 25.48268 : 7.48268)) < 1e-6);
    const script = generateScript(lch7, lch7.defaults, selected);
    assert.ok(
      script.includes(
        recipes[states.indexOf(selected)]
          .split('\n')
          .map((line) => `        ${line}`)
          .join('\n'),
      ),
      'Export must contain the original component recipe after measuring bounds.',
    );
    states.forEach((state, i) => assert.equal(lch7.python(lch7.defaults, state), recipes[i]));
  }
});
for (const { part, size } of modules)
  test(`${part.id}: library body dimensions, detailed bounded meshes and export`, () => {
    assert.deepEqual(part.validate(part.defaults, 'assembled'), []);
    assert.deepEqual(part.validate(part.defaults, 'exploded'), []);
    assert.ok(part.validate({ ...part.defaults, model: 'unknown' }, 'assembled').length);
    const g = part.buildGeometry(part.defaults, 'assembled');
    try {
      const measured = new Box3().setFromObject(g, true).getSize(new Vector3()).toArray();
      measured.forEach((n, i) =>
        assert.ok(Math.abs(n - size[i]) < 1e-4, `${part.id} axis ${i}: ${n} vs ${size[i]}`),
      );
      let triangles = 0,
        meshes = 0;
      g.traverse((o) => {
        if (o instanceof Mesh) {
          meshes++;
          const pos = o.geometry.getAttribute('position');
          for (const n of pos.array) assert.ok(Number.isFinite(n));
          triangles += (o.geometry.index?.count ?? pos.count) / 3;
        }
      });
      assert.ok(meshes >= 6);
      assert.ok(triangles < 25000, `${part.id}: ${triangles}`);
      assert.ok(part.python(part.defaults, 'assembled').length < 200000);
    } finally {
      disposeModel(g);
    }
  });
test(
  'recovery electronics native shapes and measured LCH7 mounting access',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const code =
      'import FreeCAD as App, Part, math, json\n' +
      modules
        .map(
          ({ part }) =>
            `${part.python(part.defaults, 'assembled')}\nfor i,s in enumerate(components):\n assert not s.isNull() and s.isValid() and s.isClosed() and s.Volume>0,component_labels[i]\n`,
        )
        .join('\n') +
      `\n${lch7.python(lch7.defaults, 'assembled')}\nfor x in [-15.3,15.3]:\n for y in [-15.3,15.3]:\n  assert shape.common(Part.makeCylinder(1.99,9,App.Vector(x,y,-.1))).Volume<.005\nprint('Electronics native solids and mounting access pass')\n`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 4 * 1024 * 1024,
    });
    assert.equal(result.status, 0, result.stdout + '\n' + result.stderr);
  },
);
