import assert from 'node:assert/strict';
import test from 'node:test';
import { Mesh } from 'three';
import { spawnSync } from 'node:child_process';
import part from '../src/parts/retaining-ring/part';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';

test('internal plier lugs remain inside every sourced free outside envelope', () => {
  const internal = part.presets.filter((p) => p.parameters.mounting === 'internal');
  assert.ok(internal.length >= 70);
  for (const preset of internal) {
    assert.deepEqual(validateParameters(part, preset.parameters, 'default'), [], preset.id);
    const group = part.buildGeometry(preset.parameters, 'default');
    try {
      group.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const vertices = object.geometry.getAttribute('position');
        for (let i = 0; i < vertices.count; i++)
          assert.ok(
            Math.hypot(vertices.getX(i), vertices.getY(i)) <=
              Number(preset.parameters.outerDiameter) / 2 + 0.00002,
            preset.id,
          );
      });
    } finally {
      disposeModel(group);
    }
  }
});

test(
  'native internal-ring bounds retain both plier holes and one solid',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const rows = part.presets.filter((p) =>
      ['gvyntok-92741af243c4', 'gvyntok-6d810c8da0aa'].includes(p.id),
    );
    const script =
      'import FreeCAD as App,Part,math\n' +
      rows
        .map(
          (row) =>
            part.python(row.parameters, 'default') +
            `\nassert shape.isValid() and shape.isClosed() and len(shape.Solids)==1\n` +
            `assert max(math.hypot(v.x,v.y) for v in shape.tessellate(.01)[0])<=${Number(row.parameters.outerDiameter) / 2}+1e-6\n`,
        )
        .join('\n');
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: script,
      encoding: 'utf8',
      timeout: 30000,
    });
    assert.equal(result.status, 0, result.stdout + '\n' + result.stderr);
  },
);
