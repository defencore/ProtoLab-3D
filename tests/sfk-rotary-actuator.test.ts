import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Euler, Mesh, Vector3 } from 'three';
import part, { actuatorPieces, actuatorLayout } from '../src/parts/sfk-rotary-actuator/part';
import {
  axisRotation,
  libraries,
  purchasedPieces,
} from '../src/parts/sfk-rotary-actuator/lib/components';
import { ballScrewLayout } from '../src/parts/ball-screw/lib/parts/ball-screw-geometry';
import { validateParameters } from '../src/core/validation';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';

test('cardinal actuator attachment frames preserve the exact target axis', () => {
  for (const axis of [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ] as [number, number, number][]) {
    const rotation = axisRotation(axis);
    assert.ok(
      rotation.every((angle) => Number.isInteger(angle / 90)),
      'Cardinal attachments need exact quarter turns rather than a near-gimbal quaternion conversion.',
    );
    const frame = new Euler(
      ...(rotation.map((value) => (value * Math.PI) / 180) as [number, number, number]),
      'ZYX',
    );
    assert.ok(new Vector3(0, 0, 1).applyEuler(frame).distanceTo(new Vector3(...axis)) < 1e-14);
  }
});

test('SFK0825 quarter-turned stock nut closes the closed radial forks throughout forty degrees', () => {
  const neutralPurchased = purchasedPieces(part.defaults, 'assembled');
  const wrap = (value: number) => ((((value + 180) % 360) + 360) % 360) - 180;
  for (let angle = -20; angle <= 20; angle += 0.25) {
    const p = { ...part.defaults, outputAngle: angle };
    const v = actuatorLayout(p);
    const pieces = purchasedPieces(p, 'assembled');
    const drive = pieces.find((piece) => piece.component.id === 'ball-screw')!.component;
    const screw = ballScrewLayout(drive.parameters);
    assert.ok(Math.abs(screw.center - v.center) < 1e-8);
    const linearPin = new Vector3(v.center + 5, v.pin[1], 28);
    const localPin = linearPin
      .clone()
      .sub(new Vector3(...v.pivot))
      .applyAxisAngle(new Vector3(0, 1, 0), (-angle * Math.PI) / 180);
    assert.ok(
      Math.abs(localPin.x) < 1e-10,
      'The linear cover pins must remain on the rotating radial fork centerlines.',
    );
    assert.ok(linearPin.distanceTo(new Vector3(...v.pin)) < 1e-10);
    assert.ok(Math.abs(localPin.z - 13 / Math.cos((angle * Math.PI) / 180)) < 1e-10);
    assert.ok(localPin.z >= 13 - 1e-10 && localPin.z < 13.835);
    assert.ok(Math.abs(v.displacement - 13 * Math.tan((angle * Math.PI) / 180)) < 1e-10);
    assert.ok(screw.center - screw.nl / 2 - screw.start >= screw.lead - 1e-8);
    assert.ok(screw.end - screw.center - screw.nl / 2 >= screw.lead - 1e-8);
    assert.ok(v.nutPosition >= 0 && v.nutPosition <= 100);
    assert.equal(v.crankRadius, 13);
    assert.ok(Math.abs(v.rotation) <= 180);
    const sourceFrame = new Euler(
      ...(drive.placement.rotation.map((value) => (value * Math.PI) / 180) as [
        number,
        number,
        number,
      ]),
      'ZYX',
    );
    assert.ok(
      new Vector3(1, 0, 0).applyEuler(sourceFrame).distanceTo(new Vector3(0, 1, 0)) < 1e-9,
      'The complete stock screw/nut occurrence must receive the rigid quarter turn.',
    );
    assert.ok(new Vector3(0, 1, 0).applyEuler(sourceFrame).distanceTo(new Vector3(0, 0, 1)) < 1e-9);
    assert.ok(new Vector3(0, 0, 1).applyEuler(sourceFrame).distanceTo(new Vector3(1, 0, 0)) < 1e-9);
    for (const piece of pieces.filter((piece) => piece.component.id.startsWith('screw-bearing-')))
      assert.deepEqual(
        piece.component.placement,
        neutralPurchased.find((candidate) => candidate.component.id === piece.component.id)!
          .component.placement,
        'Screw bearing supports stay fixed at every output angle.',
      );
    const motor = pieces.find((piece) => piece.component.id === 'gearmotor')!;
    assert.ok(
      Math.abs(
        Number(motor.component.parameters.outputAngle) -
          wrap(90 - Number(drive.parameters.rotation)),
      ) < 1e-9,
    );
    assert.deepEqual(
      motor.component.placement,
      neutralPurchased.find((piece) => piece.component.id === 'gearmotor')!.component.placement,
    );
  }
  assert.ok(Math.abs(actuatorLayout(part.defaults).stroke - 26 * Math.tan(Math.PI / 9)) < 1e-10);
  assert.deepEqual(actuatorLayout(part.defaults).pivot, [19.5, 0, 15]);
  assert.equal(actuatorLayout({ ...part.defaults, outputAngle: 7 }, 'negative-limit').angle, -20);
  assert.equal(actuatorLayout({ ...part.defaults, outputAngle: 7 }, 'positive-limit').angle, 20);
  assert.ok(validateParameters(part, { ...part.defaults, outputAngle: 21 }, 'assembled').length);
});

test('the actuator retains exact source products and separately reusable custom details', () => {
  const catalogIds = ['gmp16-gearmotor', 'ball-screw', 'jaw-coupling'];
  for (const preset of part.presets) {
    assert.equal(
      preset.catalog,
      undefined,
      'A new authored mechanism must not claim supplier verification.',
    );
    assert.deepEqual(validateParameters(part, preset.parameters, 'assembled'), [], preset.id);
    const definition = part.composition!(preset.parameters);
    const ids = definition.components.map((component) => component.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of catalogIds)
      assert.equal(
        definition.components.filter((component) => component.libraryId === id).length,
        1,
      );
    const bearings = definition.components.filter(
      (component) => component.libraryId === 'flanged-ball-bearing',
    );
    assert.equal(bearings.length, 4);
    for (const bearing of bearings) {
      assert.equal(bearing.parameters.bore, 6);
      assert.equal(bearing.parameters.outer, 13);
      assert.equal(bearing.parameters.width, 5);
      assert.equal(bearing.parameters.flangeOuter, 15);
      assert.equal(bearing.parameters.flangeWidth, 1.1);
      assert.equal(bearing.parameters.seals, 'rubber');
      assert.equal(bearing.presetId, 'f686-2rs');
    }
    assert.equal(bearings.filter((bearing) => bearing.id.startsWith('screw-bearing-')).length, 2);
    assert.equal(bearings.filter((bearing) => bearing.id.startsWith('output-bearing-')).length, 2);
    assert.ok(
      definition.components.every((component) => !component.id.startsWith('guide-')),
      'The compact dual-crank mechanism has no guide-rod assembly.',
    );
    assert.ok(
      definition.components.every(
        (component) => !component.id.startsWith('drive-hinge-') && component.id !== 'drive-rocker',
      ),
      'The simplified drive has no rocking platform or hinge assembly.',
    );
    assert.ok(
      definition.components.every(
        (component) => !component.id.endsWith('-roller') && !component.id.endsWith('-pin-nut'),
      ),
      'Integral cover pins replace the separate follower assemblies.',
    );
    assert.ok(
      definition.components.every(
        (component) => !component.id.startsWith('nut-flange-fastener-nut-'),
      ),
      'The stock-flange bolts must thread directly into the cover.',
    );
    assert.equal(
      definition.components.filter((component) => component.id === 'output-end-cap').length,
      1,
    );
    const flangeBolts = definition.components.filter((component) =>
      /^nut-flange-\d+$/.test(component.id),
    );
    assert.equal(flangeBolts.length, 4);
    assert.ok(flangeBolts.every((component) => component.parameters.length === 8));
    assert.deepEqual(
      bearings
        .filter((component) => component.id.startsWith('output-bearing-'))
        .map((component) => component.placement.translation[1]),
      [-19, 19],
    );
    assert.ok(definition.components.every((component) => component.libraryId !== 'ball-bearing'));
    assert.ok(
      definition.components.every(
        (component) =>
          component.libraryId !== 'bolt-screw' || !component.id.includes('bearing-cover'),
      ),
      'Flanged bearings and retaining rings replace the separate screw-fastened bearing covers.',
    );
    const screw = definition.components.find((component) => component.libraryId === 'ball-screw')!;
    assert.equal(screw.parameters.shaftDiameter, 8);
    assert.equal(screw.parameters.lead, 2.5);
    assert.equal(screw.parameters.length, 100);
    const coupling = definition.components.find(
      (component) => component.libraryId === 'jaw-coupling',
    )!;
    assert.equal(coupling.parameters.boreA, 3);
    assert.equal(coupling.parameters.boreB, 4);
    const ring = definition.components.find(
      (component) => component.libraryId === 'retaining-ring',
    )!;
    assert.equal(ring.parameters.thickness, 0.7);
    assert.equal(ring.parameters.boreEnvelope, 5.7);
    for (const component of definition.components) {
      const source = libraries.find((library) => library.id === component.libraryId)!;
      assert.ok(source, component.libraryId);
      assert.deepEqual(
        validateParameters(source, component.parameters, component.state),
        [],
        component.name,
      );
      assert.equal(component.quantity, 1);
    }
    assert.deepEqual(
      part.composition!({ ...preset.parameters, outputAngle: 20 }),
      definition,
      'A motion pose must not change the physical bill of materials.',
    );
  }
});

test('the complete preview stays finite and the native recipe retains source materials and identities', () => {
  for (const state of ['assembled', 'negative-limit', 'positive-limit']) {
    const group = part.buildGeometry(part.defaults, state);
    try {
      const bounds = new Box3().setFromObject(group, true).getSize(new Vector3()).toArray();
      part
        .dimensions(part.defaults, state)
        .forEach((value, axis) => assert.ok(Math.abs(value - bounds[axis]) < 0.01));
      assert.ok(bounds.every((value) => value > 0 && Number.isFinite(value)));
      group.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        assert.ok(
          Array.from(object.geometry.getAttribute('position').array).every(Number.isFinite),
        );
      });
    } finally {
      disposeModel(group);
    }
    const recipe = part.python(part.defaults, state);
    assert.ok(recipe.includes('AssemblyOccurrenceId'));
    assert.ok(recipe.includes('colors = scope.get("component_colors")'));
    assert.ok(recipe.includes('child.isValid()'));
  }
  const macro = generateScript(part, part.defaults, 'assembled');
  assert.ok(macro.includes('App.Material()'));
  assert.ok(/view\.DisplayMode\s*=\s*"Shaded"/.test(macro));
  assert.ok(macro.includes('doc.addObject("App::Part"'));
});
