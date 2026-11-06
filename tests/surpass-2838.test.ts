import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { Box3, Raycaster, Vector3 } from 'three';
import motor, { motorDimensions, mountHoles, shaftMachining } from '../src/parts/surpass-2838/part';
import { pieces } from '../src/parts/surpass-2838/lib/model';
import { validateParameters } from '../src/core/validation';
import { eskdIdentity } from '../src/core/eskd';
import { disposeModel } from '../src/core/mechanical';

test('KK2838 keeps all seven manufacturer-catalog windings as distinct purchased models', () => {
  assert.deepEqual(motor.defaults, { model: 'surpass-2838-3700kv' });
  assert.deepEqual(
    motor.presets.map((preset) => preset.parameters.model),
    [3200, 3500, 3700, 4400, 4700, 5100, 5700].map((kv) => `surpass-2838-${kv}kv`),
  );
  const identities = motor.presets.map((preset) => {
    assert.deepEqual(validateParameters(motor, preset.parameters, 'assembled'), []);
    assert.deepEqual(validateParameters(motor, preset.parameters, 'cross-drilled'), []);
    assert.equal(preset.catalog!.attributes!.shaftProjection, 15);
    assert.equal(preset.catalog!.attributes!.shaftDiameter, 3.175);
    assert.match(preset.catalog!.geometryEvidence!.limitations, /16\/19.*confirmation/);
    return eskdIdentity(motor, preset.parameters, 'assembled', preset.id).configurationKey;
  });
  assert.equal(new Set(identities).size, 7);
  assert.ok(motor.validate({ model: 'surpass-2838-3600kv' }, 'assembled').length);
});

test('KK2838 shares the gear interface but has a shorter body than KK2845', () => {
  assert.deepEqual(motorDimensions, {
    diameter: 28,
    length: 40,
    shaft: 3.175,
    projection: 15,
    mountX: 16,
    mountY: 19,
  });
  assert.deepEqual(mountHoles, [
    [-8, 0],
    [8, 0],
    [0, -9.5],
    [0, 9.5],
  ]);
  const model = motor.buildGeometry(motor.defaults, 'assembled');
  try {
    const bounds = new Box3().setFromObject(model, true);
    assert.ok(Math.abs(bounds.min.z + 40) < 0.00001);
    assert.ok(Math.abs(bounds.max.z - 15) < 0.00001);
    bounds
      .getSize(new Vector3())
      .toArray()
      .forEach((value, i) => assert.ok(Math.abs(value - [28, 28, 55][i]) < 0.001));
    assert.equal(model.children.length, 4);
  } finally {
    disposeModel(model);
  }
});

test('the KK2838 prepared shaft has an open hub pin bore at 13 mm and fixed housing pieces', () => {
  assert.deepEqual(shaftMachining, { diameter: 1, centerZ: 13, axis: 'x' });
  const parameters = { ...motor.defaults, shaftAngle: -7.5 };
  assert.deepEqual(pieces(parameters, 'cross-drilled').slice(0, 3), pieces().slice(0, 3));
  const model = motor.buildGeometry(parameters, 'cross-drilled');
  try {
    model.updateMatrixWorld(true);
    const radians = (parameters.shaftAngle * Math.PI) / 180,
      direction = new Vector3(Math.cos(radians), Math.sin(radians), 0);
    const shaft = model.children.at(-1)!;
    assert.equal(
      new Raycaster(
        direction.clone().multiplyScalar(-5).setZ(13),
        direction,
        0,
        10,
      ).intersectObject(shaft, true).length,
      0,
    );
    assert.ok(
      new Raycaster(
        direction.clone().multiplyScalar(-5).setZ(13.75),
        direction,
        0,
        10,
      ).intersectObject(shaft, true).length > 0,
    );
  } finally {
    disposeModel(model);
  }
  const source = motor.python(parameters, 'cross-drilled');
  assert.match(
    source,
    /Part\.makeCylinder\(0\.5,3\.575,App\.Vector\(-1\.7875,0,13\),App\.Vector\(1,0,0\)\)/,
  );
  const parsed = spawnSync('python3', ['-c', 'import ast,sys; ast.parse(sys.stdin.read())'], {
    input: source,
    encoding: 'utf8',
  });
  assert.equal(parsed.status, 0, parsed.stderr);
});
