import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import airbrakes from '../src/parts/rocket-airbrakes/part';
import clamp from '../src/parts/clamp-band-release/part';
import detail from '../src/parts/manufactured-detail/part';
import purchased from '../src/parts/purchased-component/part';
import wire from '../src/parts/formed-wire/part';
import { disposeModel } from '../src/core/mechanical';
import { detailComponent, parseDetailRecipe } from '../src/core/component-recipes';
import { componentGeometry, componentPython } from '../src/core/assembly/detail-instances';

const libraries = [detail, purchased, wire];

test('airbrake composition restores the complete neutral mechanism and purchases each servo as one supplier unit', () => {
  for (const preset of airbrakes.presets) {
    const neutral = airbrakes.composition!({ ...preset.parameters, deployment: 0 });
    assert.deepEqual(airbrakes.composition!({ ...preset.parameters, deployment: 100 }), neutral);
    const servos = neutral.components.filter(
      (item) => item.procurement?.manufacturer === 'Tower Pro',
    );
    assert.equal(servos.length, 1, preset.id);
    assert.equal(servos[0].supply, 'purchased');
    assert.equal(servos[0].libraryId, 'purchased-component');
    assert.ok(servos[0].procurement!.source.startsWith('https://towerpro.com.tw/'));
    assert.ok(neutral.issues.length > 0);
    for (const item of neutral.components) {
      const library = libraries.find((part) => part.id === item.libraryId);
      assert.ok(library, item.libraryId);
      assert.deepEqual(
        library.validate(item.parameters, item.state),
        [],
        preset.id + '/' + item.name,
      );
    }
  }
});

test('clamp composition keeps six actual wire definitions at their seat locations independent of release animation', () => {
  for (const preset of clamp.presets) {
    const complete = clamp.composition!({ ...preset.parameters, release: 0 });
    assert.deepEqual(clamp.composition!({ ...preset.parameters, release: 100 }), complete);
    assert.equal(
      new Set(complete.components.map((item) => item.id)).size,
      complete.components.length,
    );
    const springs = complete.components.filter((item) => item.libraryId === 'formed-wire');
    assert.equal(springs.length, preset.parameters.springs ? 6 : 0);
    for (const item of springs) {
      assert.equal(item.parameters.mode, 'helix');
      assert.deepEqual(wire.validate(item.parameters, item.state), []);
      assert.ok(
        Math.hypot(...item.placement.translation.slice(0, 2)) > +preset.parameters.diameter / 2,
      );
      assert.ok(
        item.manufacturing!.requirements.some((requirement) => requirement.includes('preload')),
      );
    }
  }
});

test('local profile contours preserve an open hole and native circular machining geometry after placement', () => {
  const circle = (radius: number, x: number, y: number) =>
    Array.from({ length: 120 }, (_, i): [number, number] => [
      x + radius * Math.cos((i * Math.PI) / 60),
      y + radius * Math.sin((i * Math.PI) / 60),
    ]);
  const component = detailComponent('plate', 'Circular plate', {
    kind: 'plate',
    outline: circle(10, 20, 30),
    holes: [circle(3, 20, 30)],
    z: 40,
    height: 4,
  });
  parseDetailRecipe(String(component.parameters.recipe));
  const pieces = [{ component, label: 'Circular plate', color: 0x789abc }];
  const model = componentGeometry([detail], pieces);
  try {
    model.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(model, true);
    assert.ok(bounds.min.distanceTo(new Vector3(10, 20, 40)) < 1e-4);
    assert.ok(bounds.max.distanceTo(new Vector3(30, 40, 44)) < 1e-4);
    assert.equal(
      new Raycaster(new Vector3(20, 30, 0), new Vector3(0, 0, 1), 0, 100).intersectObject(
        model,
        true,
      ).length,
      0,
    );
    const source = componentPython([detail], pieces);
    assert.match(source, /Part\.makeCircle\(3,/);
    assert.match(source, /component\.translate\(App\.Vector\(30,30,40\)\)/);
  } finally {
    disposeModel(model);
  }
  assert.throws(
    () =>
      parseDetailRecipe(
        JSON.stringify({
          kind: 'revolve',
          profile: [
            [1, 0],
            [2, 0],
            [2, 5],
            [1, 5],
          ],
          sweep: 361,
        }),
      ),
    /Invalid revolve/,
  );
});

test('formed-wire helix is one closed posed wire with explicit pitch constraints and native helix geometry', () => {
  const parameters = {
    ...wire.defaults,
    mode: 'helix',
    coilRadius: 2.2,
    coilHeight: 22.1,
    turns: 7,
    wireDiameter: 0.9,
  };
  assert.deepEqual(wire.validate(parameters, 'default'), []);
  const model = wire.buildGeometry(parameters, 'default');
  try {
    const bounds = new Box3().setFromObject(model, true);
    const circumferential = 2 * Math.PI * parameters.coilRadius,
      pitch = parameters.coilHeight / parameters.turns,
      axialWireRadius =
        ((parameters.wireDiameter / 2) * circumferential) / Math.hypot(circumferential, pitch);
    assert.ok(Math.abs(bounds.min.z + axialWireRadius) < 0.005);
    assert.ok(Math.abs(bounds.max.z - parameters.coilHeight - axialWireRadius) < 0.005);
    assert.equal(model.children.length, 1);
    assert.match(wire.python(parameters, 'default'), /Part\.makeHelix/);
    assert.match(wire.python(parameters, 'default'), /makePipeShell\(\[section\],True,True\)/);
  } finally {
    disposeModel(model);
  }
  for (const patch of [
    { coilRadius: 0.4 },
    { coilHeight: 6 },
    { turns: 129 },
    { wireDiameter: -1 },
  ])
    assert.ok(wire.validate({ ...parameters, ...patch }, 'default').length > 0);
});

test('six translated clamp sleeves reuse one local definition and preserve the expected annular-section volume', () => {
  const parameters = { ...clamp.defaults, layout: 'band', release: 0, springs: true };
  const sleeves = clamp.composition!(parameters).components.filter((item) =>
    item.name.startsWith('CB-22'),
  );
  assert.equal(sleeves.length, 6);
  for (const sleeve of sleeves) assert.deepEqual(sleeve.parameters, sleeves[0].parameters);
  const model = clamp.buildGeometry(parameters, 'assembled');
  try {
    model.updateMatrixWorld(true);
    const expected =
      (Math.PI *
        ((4 ** 2 - 3.1 ** 2) * 13.5 + (5.5 ** 2 - 1.4 ** 2) * 1.5 + (5.5 ** 2 - 4 ** 2) * 0.5) *
        24 *
        Math.sin((2 * Math.PI) / 24)) /
      (2 * Math.PI);
    const volumes = model.children
      .filter((piece) => piece.name.startsWith('CB-22'))
      .map((piece) => {
        let volume = 0;
        piece.traverse((mesh) => {
          if (!(mesh instanceof Mesh)) return;
          const points = mesh.geometry.getAttribute('position'),
            index = mesh.geometry.index;
          for (let i = 0; i < (index?.count ?? points.count); i += 3) {
            const [a, b, c] = [0, 1, 2].map((j) =>
              new Vector3()
                .fromBufferAttribute(points, index ? index.getX(i + j) : i + j)
                .applyMatrix4(mesh.matrixWorld),
            );
            volume += a.dot(b.cross(c)) / 6;
          }
        });
        return Math.abs(volume);
      });
    assert.equal(volumes.length, 6);
    for (const volume of volumes) assert.ok(Math.abs(volume - expected) / expected < 0.0001);
    assert.ok(Math.max(...volumes) - Math.min(...volumes) < 1e-7);
  } finally {
    disposeModel(model);
  }
});
