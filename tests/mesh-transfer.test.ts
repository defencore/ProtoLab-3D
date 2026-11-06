import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { modelComponentMetadata, packModel, unpackModel } from '../src/core/mesh-transfer';

test('Worker transport preserves indexed surfaces, material groups and nested world transforms', () => {
  const geometry = new BoxGeometry(2, 3, 4);
  const materials = [
    new MeshStandardMaterial({ color: 0xaabbcc, metalness: 0.8 }),
    new MeshStandardMaterial({ color: 0x223344, transparent: true, opacity: 0.4 }),
  ];
  // Use both material groups and a shared geometry instance.
  geometry.groups.forEach((g, i) => (g.materialIndex = i % 2));
  const root = new Group();
  root.position.set(10, -4, 8);
  const nested = new Group();
  nested.rotation.set(0.3, 0.1, 1.2);
  const a = new Mesh(geometry, materials),
    b = new Mesh(geometry, materials[0]);
  a.name = 'Machined plate';
  b.position.set(5, 8, -2);
  nested.add(a, b);
  root.add(nested);
  root.updateMatrixWorld(true);
  const expected = new Box3().setFromObject(root, true);
  const matrices = [a.matrixWorld.clone(), b.matrixWorld.clone()];
  const originalIndex = Array.from(geometry.index!.array);
  const { model, buffers } = packModel(root);
  assert.equal(model.geometries.length, 1);
  assert.equal(model.materials.length, 2);
  const restored = unpackModel(structuredClone(model, { transfer: buffers }));
  assert.ok(buffers.every((buffer) => buffer.byteLength === 0));
  restored.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(restored, true);
  assert.ok(expected.min.distanceTo(bounds.min) < 1e-9);
  assert.ok(expected.max.distanceTo(bounds.max) < 1e-9);
  restored.children.forEach((child, i) =>
    assert.deepEqual(child.matrixWorld.elements, matrices[i].elements),
  );
  const [first, second] = restored.children as Mesh[];
  assert.equal(first.geometry, second.geometry);
  assert.equal(first.name, a.name);
  assert.deepEqual(Array.from(first.geometry.index!.array), originalIndex);
  assert.deepEqual(first.geometry.groups, geometry.groups);
  const restoredMaterials = first.material as MeshStandardMaterial[];
  assert.equal(restoredMaterials[0].color.getHex(), 0xaabbcc);
  assert.equal(restoredMaterials[0].metalness, 0.8);
  assert.equal(restoredMaterials[1].opacity, 0.4);
});

test('Worker transport keeps separate occurrences and their nearest library configuration', () => {
  const root = new Group();
  root.userData.occurrenceId = 'rov';
  root.userData.libraryId = 'rov-project';
  root.userData.configuration = { variant: 'cps5' };
  const geometry = new BoxGeometry();
  const material = new MeshStandardMaterial();
  const configurations = [
    { direction: 'cw', voltage: 12 },
    { direction: 'ccw', voltage: 12 },
  ];
  configurations.forEach((configuration, i) => {
    const component = new Group();
    component.userData.occurrenceId = `thruster-${i + 1}`;
    component.userData.libraryId = 'underwater-thruster';
    component.userData.configuration = configuration;
    component.userData.unrelated = () => 'Must not cross worker transport';
    const housing = new Mesh(geometry, material);
    const motor = new Mesh(geometry, material);
    component.add(new Group().add(housing, motor));
    root.add(component);
  });
  const { model, buffers } = packModel(root);
  const restored = unpackModel(structuredClone(model, { transfer: buffers }));
  assert.equal(restored.children.length, 4);
  restored.children.forEach((mesh, i) => {
    const occurrence = Math.floor(i / 2);
    assert.deepEqual(mesh.userData, {
      occurrenceId: `thruster-${occurrence + 1}`,
      libraryId: 'underwater-thruster',
      configuration: configurations[occurrence],
    });
  });
  assert.equal((restored.children[0] as Mesh).geometry, (restored.children[2] as Mesh).geometry);
  assert.equal((restored.children[0] as Mesh).material, (restored.children[2] as Mesh).material);
});

test('Component metadata resolves the nearest owner and leaves unlabelled imports unchanged', () => {
  const assembly = new Group();
  assembly.userData.occurrenceId = 'outer';
  assembly.userData.libraryId = 'assembly';
  const component = new Group();
  component.userData.libraryId = 'standalone-servo';
  component.userData.configuration = { model: 'qfs2025', sealed: true };
  const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  assembly.add(component.add(mesh));
  assert.deepEqual(modelComponentMetadata(mesh), {
    libraryId: 'standalone-servo',
    configuration: { model: 'qfs2025', sealed: true },
  });
  assert.notEqual(modelComponentMetadata(mesh).configuration, component.userData.configuration);
  mesh.userData.occurrenceId = 'surface-owner';
  mesh.userData.libraryId = 'mesh-part';
  assert.deepEqual(modelComponentMetadata(mesh), {
    occurrenceId: 'surface-owner',
    libraryId: 'mesh-part',
  });
  const imported = new Group().add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
  const restored = unpackModel(structuredClone(packModel(imported).model));
  assert.deepEqual(restored.children[0].userData, {});
});
