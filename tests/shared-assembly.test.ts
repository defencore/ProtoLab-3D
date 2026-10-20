import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import {
  dimensions as electronicDimensions,
  python as electronicPython,
} from '../src/core/assembly/electronics/assembly';
import {
  component,
  subtract,
  box,
  cylinder,
  type Shape,
} from '../src/core/assembly/mechanical/shapes';
import { geometry, python } from '../src/core/assembly/mechanical/assembly';
import { disposeModel } from '../src/core/mechanical';
import detailLibrary from '../src/parts/manufactured-detail/part';
import purchasedLibrary from '../src/parts/purchased-component/part';
import {
  componentGeometry,
  detailGeometry,
  detailPython,
} from '../src/core/assembly/detail-instances';
import { detailComponent } from '../src/core/component-recipes';
import { geometry as fabricGeometry } from '../src/parts/rocket-parachute-recovery/lib/visual-assembly';
import { machineGeometry, type MachinePiece } from '../src/core/assembly/machine-instances';
import { machineComposition } from '../src/core/machine-composition';

test('shared electronic metrology preserves authored component origins through repeated exploded measurements', () => {
  const pieces = [
    {
      label: 'Board',
      color: 0x246840,
      z: 20,
      shape: {
        kind: 'box' as const,
        size: [40, 30, 2] as [number, number, number],
        origin: [-20, -15, 3] as [number, number, number],
      },
    },
  ];
  const source = JSON.stringify(pieces);
  const recipe = electronicPython(pieces);
  for (let i = 0; i < 4; i++) {
    assert.deepEqual(electronicDimensions(pieces), [40, 30, 2]);
    assert.equal(JSON.stringify(pieces), source);
    assert.equal(electronicPython(pieces), recipe);
  }
});

test('shared geometry instances retain independent mesh buffers, materials and names', () => {
  const shape = subtract(box([20, 15, 6], [-10, -7.5, 0]), cylinder(2, 8, [0, 0, -1]));
  const source = JSON.stringify(shape);
  const first = component(shape, 'First', 0xff0000);
  const second = component(shape, 'Second', 0x00ff00);
  let firstMesh!: Mesh;
  let secondMesh!: Mesh;
  first.traverse((o) => {
    if (o instanceof Mesh) firstMesh = o;
  });
  second.traverse((o) => {
    if (o instanceof Mesh) secondMesh = o;
  });
  assert.notEqual(firstMesh.geometry, secondMesh.geometry);
  assert.notEqual(firstMesh.material, secondMesh.material);
  const secondX = secondMesh.geometry.getAttribute('position').getX(0);
  firstMesh.geometry.getAttribute('position').setX(0, 12345);
  (firstMesh.material as MeshStandardMaterial).color.setHex(0x0000ff);
  assert.equal(secondMesh.geometry.getAttribute('position').getX(0), secondX);
  assert.equal((secondMesh.material as MeshStandardMaterial).color.getHex(), 0x00ff00);
  assert.equal(secondMesh.name, 'Second');
  assert.equal(JSON.stringify(shape), source);
  disposeModel(first);
  disposeModel(second);
});

test('shared mechanical placement retains local feature dimensions and matching CAD component boundaries', () => {
  const shape: Shape = {
    kind: 'transform',
    child: box([10, 20, 5], [0, 0, 0]),
    translation: [30, 40, 50],
    rotation: [0, 0, 90],
  };
  const pieces = [{ shape, label: 'Bracket', color: 0x87919c, z: 7 }];
  const model = geometry(pieces);
  model.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(model, true);
  assert.ok(bounds.min.distanceTo(new Vector3(10, 40, 57)) < 1e-6);
  assert.ok(bounds.max.distanceTo(new Vector3(30, 50, 62)) < 1e-6);
  assert.match(python(pieces), /component_labels = \["Bracket"\]/);
  assert.match(python(pieces), /Part\.makeCompound\(components\)/);
  assert.equal(model.children.length, 1);
  disposeModel(model);
});

test('custom assembly preview and CAD instantiate the same local library definition while retaining inspection offsets', () => {
  const pieces = [
    {
      shape: box([10, 20, 5], [30, 40, 50]),
      label: 'Mounting plate',
      color: 0x345678,
      z: 25,
      angle: 90,
    },
  ];
  const source = JSON.stringify(pieces);
  const model = detailGeometry(detailLibrary, pieces);
  model.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(model, true);
  assert.ok(bounds.min.distanceTo(new Vector3(-60, 30, 75)) < 1e-6);
  assert.ok(bounds.max.distanceTo(new Vector3(-40, 40, 80)) < 1e-6);
  assert.equal(model.children[0].userData.libraryId, 'manufactured-detail');
  const parameters = model.children[0].userData.configuration;
  assert.deepEqual(JSON.parse(parameters.recipe), {
    kind: 'box',
    size: [10, 20, 5],
    origin: [0, 0, 0],
  });
  const script = detailPython(detailLibrary, pieces);
  assert.match(script, /component\.translate\(App\.Vector\(30,40,50\)\)/);
  assert.match(script, /component\.rotate\(App\.Vector\(0,0,0\),App\.Vector\(0,0,1\),90\)/);
  assert.match(script, /component\.translate\(App\.Vector\(0,0,25\)\)/);
  assert.match(script, /"LibraryId":"manufactured-detail"/);
  assert.equal(JSON.stringify(pieces), source);
  disposeModel(model);
});

test('authored machine procurement selects the same actual library configuration in preview and composition', () => {
  const pieces: (MachinePiece & { procurement: 'BUY' | 'MAKE' })[] = [
    {
      shape: box([10, 12, 8], [30, 40, 50]),
      label: 'Component A',
      color: 0x345678,
      procurement: 'BUY',
    },
    {
      shape: box([20, 15, 5], [5, 10, 20]),
      label: 'Motor mounting plate',
      color: 0x87919c,
      procurement: 'MAKE',
    },
  ];
  const source = JSON.stringify(pieces);
  const composition = machineComposition(pieces, []).components;
  const model = machineGeometry([detailLibrary, purchasedLibrary], pieces);
  try {
    assert.deepEqual(
      composition.map((component) => [component.libraryId, component.supply]),
      [
        ['purchased-component', 'purchased'],
        ['manufactured-detail', 'manufactured'],
      ],
    );
    model.children.forEach((occurrence, index) => {
      assert.equal(occurrence.userData.libraryId, composition[index].libraryId);
      assert.deepEqual(occurrence.userData.configuration, composition[index].parameters);
      assert.equal(occurrence.name, pieces[index].label);
    });
    assert.equal(JSON.stringify(pieces), source);
  } finally {
    disposeModel(model);
  }
});

test('intentionally absent fabric yields a silent empty group while real library instances retain validation and geometry', (context) => {
  const error = context.mock.method(console, 'error', () => {});
  const empty = fabricGeometry([]);
  assert.equal(empty.children.length, 0);
  assert.ok(new Box3().setFromObject(empty, true).isEmpty());
  const piece = {
    component: detailComponent('proof', 'Mounting block', {
      kind: 'box',
      size: [4, 5, 6],
      origin: [0, 0, 0],
    }),
    label: 'Mounting block',
    color: 0x345678,
  };
  const group = componentGeometry([detailLibrary], [piece]);
  try {
    assert.equal(group.children.length, 1);
    assert.equal(group.children[0].userData.libraryId, detailLibrary.id);
    assert.deepEqual(
      new Box3().setFromObject(group, true).getSize(new Vector3()).toArray(),
      [4, 5, 6],
    );
    assert.throws(() => componentGeometry([], [piece]), /Missing concrete library definition/);
    assert.throws(
      () =>
        componentGeometry(
          [detailLibrary],
          [
            {
              ...piece,
              component: {
                ...piece.component,
                parameters: { ...piece.component.parameters, recipe: '{"kind":"unsupported"}' },
              },
            },
          ],
        ),
      /Unsupported|unsupported/,
    );
    assert.equal(error.mock.callCount(), 0, 'empty groups must not be passed as add(undefined)');
  } finally {
    disposeModel(group);
  }
});
