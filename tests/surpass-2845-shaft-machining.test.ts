import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { Raycaster, Vector3 } from 'three';
import motor, { shaftMachining } from '../src/parts/surpass-2845/part';
import { pieces } from '../src/parts/surpass-2845/lib/model';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { eskdIdentity } from '../src/core/eskd';
import {
  addProduct,
  configureProduct,
  createProject,
  parseProject,
  serializeProject,
} from '../src/core/design-project';
import type { ProductConfiguration } from '../src/core/product-types';

test('stock 2845 defaults, supplier parameters and native geometry remain unchanged', () => {
  assert.deepEqual(motor.defaults, { model: 'surpass-2845-3100kv' });
  assert.deepEqual(motor.presets[0].parameters, motor.defaults);
  assert.deepEqual(validateParameters(motor, motor.defaults, 'assembled'), []);
  assert.equal(
    createHash('sha256').update(motor.python(motor.defaults, 'assembled')).digest('hex'),
    '6d7213d72d340765880630441715bd9931103c1d219ef4eb868754fd8d12ee2d',
    'the original supplier installation geometry is preserved byte for byte',
  );
  assert.ok(motor.validate({ ...motor.defaults, shaftAngle: 0 }, 'assembled').length);
  assert.ok(motor.validate({ ...motor.defaults, shaftAngle: Number.NaN }, 'cross-drilled').length);
  assert.deepEqual(validateParameters(motor, motor.defaults, 'cross-drilled'), []);
});

test('custom motor state drills through only the projecting shaft and rotates its bore with the rotor', () => {
  assert.deepEqual(shaftMachining, { diameter: 1, centerZ: 13, axis: 'x' });
  for (const shaftAngle of [-97.5, -7.5, 82.5]) {
    const parameters = { ...motor.defaults, shaftAngle };
    assert.deepEqual(validateParameters(motor, parameters, 'cross-drilled'), []);
    assert.deepEqual(pieces(parameters, 'cross-drilled').slice(0, 3), pieces().slice(0, 3));
    const model = motor.buildGeometry(parameters, 'cross-drilled');
    try {
      model.updateMatrixWorld(true);
      const shaft = model.children.at(-1)!,
        radians = (shaftAngle * Math.PI) / 180,
        direction = new Vector3(Math.cos(radians), Math.sin(radians), 0);
      const throughHole = new Raycaster(
        direction.clone().multiplyScalar(-5).setZ(13),
        direction,
        0,
        10,
      );
      assert.equal(
        throughHole.intersectObject(shaft, true).length,
        0,
        `${shaftAngle}° bore is open`,
      );
      const throughStock = new Raycaster(
        direction.clone().multiplyScalar(-5).setZ(13.75),
        direction,
        0,
        10,
      );
      assert.ok(
        throughStock.intersectObject(shaft, true).length > 0,
        'shaft material remains beside the bore',
      );
    } finally {
      disposeModel(model);
    }
    const source = motor.python(parameters, 'cross-drilled');
    assert.match(source, /def _pl_transform\(/);
    assert.match(
      source,
      /Part\.makeCylinder\(0\.5,3\.575,App\.Vector\(-1\.7875,0,13\),App\.Vector\(1,0,0\)\)/,
    );
    const parsed = spawnSync('python3', ['-c', 'import ast,sys; ast.parse(sys.stdin.read())'], {
      input: source,
      encoding: 'utf8',
    });
    assert.equal(parsed.status, 0, parsed.stderr);
  }
});

test('the drilled motor is a distinct physical state and manufactured project roundtrips retain it', () => {
  const parameters = { ...motor.defaults, shaftAngle: -7.5 };
  const configured = configureProduct({ part: motor, parameters, state: 'cross-drilled' });
  const manufactured: ProductConfiguration = {
    ...configured,
    supply: 'manufactured',
    manufacturing: {
      material: 'Purchased motor with steel output shaft',
      blank: 'Surpass Hobby KK 2845-3100KV supplier motor',
      processes: ['drilling'],
      requirements: [
        'Cross-drill diameter 1 at local Z=13; support the shaft and exclude chips from the motor.',
      ],
    },
  };
  delete manufactured.procurement;
  const first = eskdIdentity(motor, parameters, 'cross-drilled', undefined, manufactured);
  const rotated = eskdIdentity(
    motor,
    { ...parameters, shaftAngle: 65 },
    'cross-drilled',
    undefined,
    manufactured,
  );
  assert.equal(first.configurationKey, rotated.configurationKey);
  assert.notEqual(
    first.configurationKey,
    eskdIdentity(motor, motor.defaults, 'assembled').configurationKey,
  );
  const project = addProduct(createProject(), [motor], {
    part: motor,
    parameters,
    state: 'cross-drilled',
  }).project;
  const stored = project.configurations[0];
  Object.assign(stored, manufactured, { id: stored.id });
  delete stored.procurement;
  const encoded = serializeProject(project, [motor]);
  const restored = parseProject(encoded, [motor]);
  assert.equal(restored.configurations[0].state, 'cross-drilled');
  assert.deepEqual(restored.configurations[0].parameters, parameters);
  assert.deepEqual(restored.configurations[0].manufacturing, manufactured.manufacturing);
  assert.equal(serializeProject(restored, [motor]), encoded);
});
