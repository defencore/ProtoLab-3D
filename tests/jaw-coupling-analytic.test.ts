import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import coupling, { jawCouplingValues } from '../src/parts/jaw-coupling/part';
import { validateParameters } from '../src/core/validation';

test(
  'native coupling spiders retain their exact annular-sector area with analytic cylindrical walls',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const hltnc = coupling.presets.find((preset) => preset.parameters.design === 'hltnc-d25-l30')!;
    const lf = coupling.presets.find((preset) => preset.parameters.design === 'lf-d14-l22')!;
    const configurations = [
      ...coupling.presets,
      ...(
        [
          [hltnc, 15],
          [hltnc, 56],
          [lf, 15],
          [lf, 80],
        ] as const
      ).map(([preset, angle]) => ({
        ...preset,
        id: preset.id + '-custom-arc-' + angle,
        parameters: { ...preset.parameters, jawAngle: angle },
      })),
    ];
    const cases = configurations.map((preset) => {
      assert.deepEqual(validateParameters(coupling, preset.parameters, 'spider'), []);
      const p = preset.parameters,
        v = jawCouplingValues(p),
        lobes = v.jaws * 2,
        halfJaw = Number(p.jawAngle) / 2 + 1,
        angle = ((360 / lobes - 2 * halfJaw) * Math.PI) / 180;
      const area =
        Math.PI * (v.spiderRoot ** 2 - v.spiderBore ** 2) +
        (lobes * angle * ((v.R - v.clear) ** 2 - v.spiderRoot ** 2)) / 2;
      return {
        name: preset.id,
        source: coupling.python(p, 'spider'),
        volume: area * v.t,
        dimensions: coupling.dimensions(p, 'spider'),
        faces: lobes * 4 + 3,
        cylinders: lobes * 2 + 1,
      };
    });
    const code = `import json, math, os, sys
sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App, Part
cases = json.loads(${JSON.stringify(JSON.stringify(cases))})
for case in cases:
    scope = {'App':App, 'Part':Part, 'math':math}
    exec(case['source'], scope)
    shape = scope['shape']
    assert shape.isValid() and shape.isClosed() and len(shape.Solids) == 1, case['name']
    assert abs(shape.Volume - case['volume']) < max(1e-7, case['volume'] * 1e-10), (case['name'], shape.Volume, case['volume'])
    assert len(shape.Faces) == case['faces'], (case['name'], len(shape.Faces))
    assert sum(isinstance(face.Surface, Part.Cylinder) for face in shape.Faces) == case['cylinders'], case['name']
    bounds = shape.optimalBoundingBox(False, False)
    assert max(abs(a-b) for a,b in zip([bounds.XLength,bounds.YLength,bounds.ZLength],case['dimensions'])) < 1e-5, case['name']
print(json.dumps({'passed':len(cases)}))
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 60_000,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.deepEqual(JSON.parse(result.stdout.trim()), { passed: configurations.length });
  },
);
