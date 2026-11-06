import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import detail from '../src/parts/manufactured-detail/part';
import supplier from '../src/parts/purchased-component/part';
import {
  detailRecipe,
  detailIdentityParameters,
} from '../src/parts/manufactured-detail/lib/configuration';
import { detailComponent } from '../src/core/component-recipes';
import { validateParameters } from '../src/core/validation';
import { pythonShape } from '../src/core/assembly/boundary/shapes';
import type { Shape } from '../src/core/assembly/boundary/shapes';
import { eskdIdentity, physicalProductState } from '../src/core/eskd';
import { availableModelState } from '../src/core/part-selection';
import { addProduct, createProject, parseProject } from '../src/core/design-project';
import { parseConfiguration } from '../src/core/configuration';
import type { Parameters } from '../src/core/types';

// An equal-volume state fixture exercises the contract, not elastic mechanics.
const freeForm: Shape = { kind: 'box', size: [20, 4, 2], origin: [0, 0, 0] };
const installedForm: Shape = {
  kind: 'union',
  children: [
    { kind: 'box', size: [10, 4, 2], origin: [0, 0, 0] },
    { kind: 'box', size: [2, 4, 10], origin: [8, 0, 2] },
  ],
};
const dualForm = () => ({
  ...detailComponent('flexible-detail', 'Authored flexible detail', installedForm).parameters,
  manufacturingRecipe: JSON.stringify(freeForm),
});

test('fabricated size families validate, change geometry and expose their active dimensions', () => {
  const expected: Record<string, number[]> = {
    plate: [80, 60, 8],
    sleeve: [20, 20, 30],
    shaft: [12, 12, 60],
    bracket: [40, 40, 40],
  };
  for (const preset of detail.presets) {
    const p = preset.parameters;
    assert.deepEqual(validateParameters(detail, p, 'default'), [], preset.id);
    detail
      .dimensions(p, 'default')
      .forEach((value, axis) =>
        assert.ok(Math.abs(value - expected[String(p.mode)][axis]) < 0.01, preset.id),
      );
    const changed = { ...p, length: Number(p.length) + 7 };
    assert.notDeepEqual(detailRecipe(changed), detailRecipe(p));
    assert.notEqual(detail.python(changed, 'default'), detail.python(p, 'default'));
    assert.ok(detail.parameters.some((field) => field.key === 'length' && field.visibleWhen?.(p)));
  }
});

test('fabrication constraints reject intersecting holes, missing dimensions and empty walls', () => {
  const variant = (mode: string) =>
    detail.presets.find((preset) => preset.parameters.mode === mode)!.parameters;
  const invalid = [
    { ...variant('plate'), holeMargin: 2 },
    { ...variant('plate'), holePattern: 'center', holeDiameter: 60 },
    { ...variant('plate'), holePattern: 'other' },
    { ...variant('sleeve'), boreDiameter: 20 },
    { ...variant('shaft'), crossHolePosition: 1 },
    { ...variant('shaft'), crossHoleDiameter: 12 },
    { ...variant('bracket'), thickness: 20 },
    { ...variant('bracket'), bracketHoleDiameter: 40 },
    { ...variant('plate'), length: NaN },
    { ...detail.defaults, mode: 'unknown' },
  ];
  for (const p of invalid) {
    assert.ok(validateParameters(detail, p, 'default').length > 0);
    assert.throws(() => detailRecipe(p));
  }
  const missing = { ...variant('sleeve') };
  delete missing.boreDiameter;
  assert.ok(validateParameters(detail, missing, 'default').length > 0);
  assert.throws(() => detailRecipe(missing));
});

test('existing authored assembly components retain their exact local recipe without new fields', () => {
  const component = detailComponent('plate', 'Authored plate', {
    kind: 'box',
    size: [23, 17, 4],
    origin: [100, 20, -5],
  });
  assert.equal(component.parameters.mode, undefined);
  assert.deepEqual(validateParameters(detail, component.parameters, 'default'), []);
  assert.deepEqual(
    detailRecipe(component.parameters),
    JSON.parse(String(component.parameters.recipe)),
  );
  assert.deepEqual(detail.dimensions(component.parameters, 'default'), [23, 17, 4]);
  assert.deepEqual(detail.dimensions(detail.defaults, 'default'), [80, 60, 8]);
  assert.deepEqual(
    detailRecipe({ ...detail.defaults, recipe: component.parameters.recipe }),
    detailRecipe(component.parameters),
  );
});

test('existing detail configurations retain exact physical keys and only their default state', () => {
  const authored = detailComponent('plate', 'Authored plate', {
    kind: 'box',
    size: [23, 17, 4],
    origin: [100, 20, -5],
  });
  const baseline = [
    [detail.defaults, 'B2259B4D50D63711'],
    [authored.parameters, '6A2EACF396B1EE7F'],
    [detail.presets[0].parameters, '1F7215F3AE85A917'],
    [detail.presets[1].parameters, '3550A1898AAB369D'],
    [detail.presets[2].parameters, '484B324942CEB6D5'],
    [detail.presets[3].parameters, 'B560582E3C4F1872'],
  ] as const;
  for (const [p, configurationKey] of baseline) {
    assert.equal(Object.hasOwn(p, 'manufacturingRecipe'), false);
    assert.equal(eskdIdentity(detail, p, 'default').configurationKey, configurationKey);
    assert.deepEqual(
      detail
        .states!.filter((state) => !state.availableWhen || state.availableWhen(p))
        .map((s) => s.id),
      ['default'],
    );
    assert.equal(availableModelState(detail, p, 'manufacturing'), 'default');
    assert.ok(validateParameters(detail, p, 'manufacturing').length);
    assert.throws(() => detail.python(p, 'manufacturing'));
  }
});

test('explicit manufacturing geometry changes the shown body without splitting physical identity', () => {
  const p = dualForm();
  for (const state of ['default', 'manufacturing']) {
    assert.deepEqual(validateParameters(detail, p, state), []);
    assert.equal(availableModelState(detail, p, state), state);
    assert.equal(physicalProductState(detail, state, p), 'default');
  }
  assert.deepEqual(detailRecipe(p), installedForm);
  assert.deepEqual(detailRecipe(p, 'manufacturing'), freeForm);
  for (const [state, expected] of [
    ['default', [10, 4, 12]],
    ['manufacturing', [20, 4, 2]],
  ] as const)
    detail.dimensions(p, state).forEach((value, axis) => {
      assert.ok(Math.abs(value - expected[axis]) < 0.001);
    });
  assert.notEqual(detail.python(p, 'default'), detail.python(p, 'manufacturing'));
  assert.deepEqual(detailIdentityParameters(p), { recipe: JSON.stringify(freeForm) });
  assert.deepEqual(eskdIdentity(detail, p, 'default'), eskdIdentity(detail, p, 'manufacturing'));
  const manufacturingOnly = detailComponent('free-detail', 'Authored flexible detail', freeForm);
  assert.equal(
    eskdIdentity(detail, p, 'default').configurationKey,
    eskdIdentity(detail, manufacturingOnly.parameters, 'default').configurationKey,
    'Adding an installed form does not allocate another physical execution of the same free part.',
  );
  const alternativeInstallation = { ...p, recipe: JSON.stringify(freeForm) };
  assert.equal(
    eskdIdentity(detail, alternativeInstallation, 'default').configurationKey,
    eskdIdentity(detail, p, 'default').configurationKey,
  );
  assert.notEqual(
    eskdIdentity(
      detail,
      { ...p, manufacturingRecipe: JSON.stringify({ ...freeForm, size: [21, 4, 2] }) },
      'default',
    ).configurationKey,
    eskdIdentity(detail, p, 'default').configurationKey,
  );
});

test('configured supplier recipes keep their installed shape and reject a manufacturing form', () => {
  const p = { ...supplier.defaults, recipe: JSON.stringify(installedForm) };
  assert.deepEqual(validateParameters(supplier, p, 'default'), []);
  const expected = [10, 4, 12];
  supplier
    .dimensions(p, 'default')
    .forEach((value, axis) => assert.ok(Math.abs(value - expected[axis]) < 0.001));
  const manufacturedParameters = { ...p, manufacturingRecipe: JSON.stringify(freeForm) };
  assert.equal(availableModelState(supplier, manufacturedParameters, 'manufacturing'), 'default');
  assert.ok(validateParameters(supplier, manufacturedParameters, 'default').length);
  assert.ok(validateParameters(supplier, manufacturedParameters, 'manufacturing').length);
  assert.equal(
    eskdIdentity(supplier, p, 'default').configurationKey,
    eskdIdentity(supplier, { ...p, meshEdgeTolerance: 0.02 }, 'default').configurationKey,
  );
});

test('manufacturing forms import and project-roundtrip as one installed physical product', () => {
  const p = dualForm();
  const imported = parseConfiguration(
    JSON.stringify({
      version: 1,
      units: 'mm',
      part: detail.id,
      parameters: p,
      state: 'manufacturing',
    }),
    [detail],
  );
  assert.deepEqual(imported.parameters, p);
  assert.equal(imported.state, 'manufacturing');
  const project = addProduct(createProject('Free and installed detail'), [detail], {
    part: detail,
    parameters: p,
    state: 'manufacturing',
  }).project;
  assert.equal(project.configurations.length, 1);
  assert.equal(project.occurrences.length, 1);
  assert.equal(project.configurations[0].state, 'default');
  assert.deepEqual(project.configurations[0].parameters, p);
  assert.deepEqual(parseProject(JSON.stringify(project), [detail]), project);
});

test('malformed or incompatible manufacturing forms fail rather than falling back', () => {
  const p = dualForm();
  for (const candidate of [
    { ...p, manufacturingRecipe: undefined },
    { ...p, manufacturingRecipe: '' },
    { ...p, manufacturingRecipe: 'not JSON' },
    { ...p, manufacturingRecipe: '{}' },
    { ...p, manufacturingRecipe: JSON.stringify({ kind: 'script', source: 'code' }) },
    { ...p, recipe: 'invalid installed form' },
    { ...detail.presets[0].parameters, manufacturingRecipe: p.manufacturingRecipe },
  ]) {
    const invalid = candidate as unknown as Parameters;
    for (const state of ['default', 'manufacturing']) {
      assert.ok(validateParameters(detail, invalid, state).length);
      assert.throws(() => detailRecipe(invalid, state));
      assert.throws(() => detail.python(invalid, state));
    }
    assert.throws(() => detailIdentityParameters(invalid));
  }
  const changed = detail.updateParameters!({ ...detail.defaults, ...p, mode: 'plate' }, 'mode');
  assert.equal(Object.hasOwn(changed, 'manufacturingRecipe'), false);
  assert.equal(availableModelState(detail, changed, 'manufacturing'), 'default');
  assert.deepEqual(validateParameters(detail, changed, 'default'), []);
});

test('dimensional configurations reject a missing or invalid family instead of using an authored recipe', () => {
  const missing = { ...detail.defaults };
  delete missing.mode;
  for (const candidate of [
    missing,
    ...[NaN, Infinity, -Infinity, '12', false, null].map((mode) => ({ ...detail.defaults, mode })),
  ]) {
    const p = candidate as unknown as Parameters;
    assert.ok(validateParameters(detail, p, 'default').length > 0);
    assert.throws(() => detailRecipe(p));
  }
});

test('inactive recipe fields do not control a parametric detail', () => {
  const plate = detail.presets.find((preset) => preset.parameters.mode === 'plate')!.parameters;
  assert.deepEqual(
    detailRecipe({ ...plate, recipe: 'invalid authored JSON' }),
    detailRecipe(plate),
  );
  const solid = { ...plate, holePattern: 'none' };
  assert.equal(detailRecipe(solid).kind, 'box');
  assert.equal(detailRecipe({ ...detail.defaults, mode: 'shaft' }).kind, 'cylinder');
});

test('family execution identity excludes inactive dimensions and authored recipes', () => {
  const inactive: Record<string, Record<string, number | string | boolean>> = {
    plate: {
      recipe: 'not used',
      diameter: 99,
      boreDiameter: 88,
      height: 150,
      crossHoleDiameter: 9,
      bracketHoleDiameter: 7,
    },
    sleeve: {
      recipe: 'not used',
      width: 110,
      height: 130,
      thickness: 7,
      holePattern: 'none',
      crossHoleDiameter: 4,
      bracketHoleDiameter: 11,
    },
    shaft: {
      recipe: 'not used',
      width: 70,
      height: 180,
      thickness: 12,
      boreDiameter: 3,
      holePattern: 'center',
      bracketHoleDiameter: 8,
    },
    bracket: {
      recipe: 'not used',
      diameter: 37,
      boreDiameter: 17,
      holePattern: 'none',
      holeMargin: 15,
      crossHoleDiameter: 2,
    },
  };
  for (const preset of detail.presets) {
    const p = preset.parameters;
    const changed = {
      ...p,
      ...inactive[String(p.mode)],
      meshBackend: 'manifold',
      nativeRefine: false,
    };
    assert.deepEqual(detailRecipe(changed), detailRecipe(p));
    assert.deepEqual(detailIdentityParameters(changed), detailIdentityParameters(p));
    assert.notDeepEqual(
      detailIdentityParameters({ ...p, length: Number(p.length) + 1 }),
      detailIdentityParameters(p),
    );
  }
  const recipe = detailRecipe(detail.defaults);
  assert.deepEqual(
    detailIdentityParameters({
      ...detail.defaults,
      mode: 'recipe',
      width: 400,
      length: 500,
      holeDiameter: 33,
    }),
    { recipe: JSON.stringify(recipe) },
  );
  const plate = detail.presets.find((preset) => preset.parameters.mode === 'plate')!.parameters;
  const noHoles = { ...plate, holePattern: 'none' };
  assert.deepEqual(
    detailIdentityParameters({ ...noHoles, holeDiameter: 100, holeMargin: 100 }),
    detailIdentityParameters(noHoles),
  );
  const noCrossHole = { ...plate, mode: 'shaft', crossHoleDiameter: 0 };
  assert.deepEqual(
    detailIdentityParameters({ ...noCrossHole, crossHolePosition: 200 }),
    detailIdentityParameters(noCrossHole),
  );
  const authoredPlate = { ...detail.defaults, recipe: JSON.stringify(detailRecipe(plate)) };
  assert.deepEqual(detailIdentityParameters(authoredPlate), detailIdentityParameters(plate));
});

test(
  'parametric families form one native FreeCAD solid with expected volumes and through holes',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const recipes = detail.presets.map((preset) => pythonShape(detailRecipe(preset.parameters)));
    const code = `import FreeCAD as App, Part, math
shapes = [${recipes.join(',\n')}]
for shape in shapes:
 assert shape.isValid() and shape.isClosed() and len(shape.Solids) == 1
plate, sleeve, shaft, bracket = shapes
assert abs(plate.Volume - (80*60*8 - 4*math.pi*2.5**2*8)) < 1e-5
assert abs(sleeve.Volume - math.pi*(10**2-5**2)*30) < 1e-5
assert not shaft.isInside(App.Vector(0,0,10), 1e-7, True)
assert shaft.isInside(App.Vector(0,0,30), 1e-7, True)
assert abs(bracket.Volume - (40*(40+40-4)*4 - 2*math.pi*2.5**2*4)) < 1e-5
print('PARAMETRIC_DETAIL_OK')
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 60000,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PARAMETRIC_DETAIL_OK/);
  },
);

test(
  'both declared forms retain native connected solids and equal fixture volume',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const p = dualForm();
    const code = `import FreeCAD as App, Part, math
${detail.python(p, 'default')}
installed = shape
${detail.python(p, 'manufacturing')}
free = shape
for body in [installed,free]:
 assert body.isValid() and body.isClosed() and len(body.Solids)==1
 assert abs(body.Volume-160)<1e-7
assert installed.isInside(App.Vector(9,2,8),1e-7,True)
assert not free.isInside(App.Vector(9,2,8),1e-7,True)
assert free.isInside(App.Vector(19,2,1),1e-7,True)
assert not installed.isInside(App.Vector(19,2,1),1e-7,True)
print('DETAIL_FORMS_NATIVE_OK')
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 60000,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /DETAIL_FORMS_NATIVE_OK/);
  },
);
