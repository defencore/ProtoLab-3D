import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Matrix4, Vector3 } from 'three';
import machine, {
  millingComponents,
  millingLibraries,
} from '../src/parts/cnc-milling-machine/part';
import { groupMillingPurchasedKits } from '../src/parts/cnc-milling-machine/lib/purchased-kits';
import {
  addProduct,
  createProject,
  supplyRows,
  parseProject,
  serializeProject,
} from '../src/core/design-project';
import type { ProductPlacement } from '../src/core/product-types';
import type { Vec } from '../src/core/assembly/boundary/shapes';

function matrix(p: ProductPlacement) {
  return new Matrix4()
    .makeRotationFromEuler(new Euler(...(p.rotation.map((n) => (n * Math.PI) / 180) as Vec), 'ZYX'))
    .setPosition(new Vector3(...p.translation));
}
test('purchased kit nesting preserves every exact installed shaft, nut, scale and head transform', () => {
  const physical = millingComponents(machine.defaults).map((piece) => piece.component),
    grouped = groupMillingPurchasedKits(physical);
  const members = grouped.flatMap((component) =>
    component.children?.length
      ? component.children.map((child) => ({
          child,
          world: matrix(component.placement).multiply(matrix(child.placement)),
        }))
      : [{ child: component, world: matrix(component.placement) }],
  );
  assert.equal(members.length, physical.length);
  assert.equal(new Set(members.map((member) => member.child.id)).size, physical.length);
  for (const expected of physical) {
    const found = members.find((member) => member.child.id === expected.id)!;
    assert.ok(found, expected.id);
    matrix(expected.placement).elements.forEach((value, i) =>
      assert.ok(Math.abs(value - found.world.elements[i]) < 1e-8, expected.id),
    );
    assert.deepEqual(found.child.parameters, expected.parameters);
  }
});
test('CNC procurement orders three complete screw sets and three encoder kits once, preserving separate spars and project round trip', () => {
  const definitions = [machine, ...millingLibraries],
    { project } = addProduct(createProject('Precision purchase check'), definitions, {
      part: machine,
      parameters: machine.defaults,
      state: 'assembled',
    });
  const restored = parseProject(serializeProject(project, definitions), definitions);
  assert.deepEqual(restored, JSON.parse(JSON.stringify(project))); // JSON normalizes signed zero in equivalent rotations.
  const rows = supplyRows(restored, definitions, 'purchased');
  const selected = (library: string) =>
    rows.filter(
      (row) =>
        restored.configurations.find((c) => c.id === row.configurationId)?.libraryId === library,
    );
  assert.deepEqual(
    selected('cnc-precision-axis').map((row) => row.quantity),
    [1, 1, 1],
  );
  assert.equal(selected('cnc-precision-screw').length, 0);
  assert.equal(selected('cnc-precision-nut').length, 0);
  const encoders = selected('cnc-linear-encoder');
  assert.equal(encoders.length, 6); // Three complete LS477 kits and three separate MSL41 spars.
  assert.ok(encoders.every((row) => row.quantity === 1));
  assert.equal(encoders.filter((row) => /LS\s*477/.test(row.designation)).length, 3);
  assert.equal(encoders.filter((row) => /MSL\s*41/.test(row.designation)).length, 3);
  assert.ok(!encoders.some((row) => row.designation.includes('included')));
});
