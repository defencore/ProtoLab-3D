import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { packModel, unpackModel } from '../src/core/mesh-transfer';

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
