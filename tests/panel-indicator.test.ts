import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import module from '../src/parts/panel-indicator';
import { indicatorColours } from '../src/parts/panel-indicator/lib/model';
import { registerPartModules } from '../src/core/part-modules';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';

const part = module.part;

function checkClosedMesh(mesh: Mesh) {
  const positions = mesh.geometry.getAttribute('position');
  const index = mesh.geometry.index;
  const edges = new Map<string, { count: number; winding: number }>();
  let volume = 0;
  for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
    const vertices = [0, 1, 2].map((offset) =>
      new Vector3().fromBufferAttribute(positions, index ? index.getX(i + offset) : i + offset),
    );
    assert.ok(vertices.every((point) => point.toArray().every(Number.isFinite)));
    assert.ok(
      vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).lengthSq() >
        1e-18,
      `${mesh.name}: nondegenerate triangle`,
    );
    volume += vertices[0].dot(vertices[1].clone().cross(vertices[2])) / 6;
    const keys = vertices.map((point) =>
      point
        .toArray()
        .map((value) => Math.round(value * 1e5))
        .join(','),
    );
    for (let side = 0; side < 3; side++) {
      const a = keys[side],
        b = keys[(side + 1) % 3];
      const key = [a, b].sort().join('|');
      const edge = edges.get(key) ?? { count: 0, winding: 0 };
      edge.count++;
      edge.winding += a < b ? 1 : -1;
      edges.set(key, edge);
    }
  }
  assert.ok(volume > 0, `${mesh.name}: outward positive volume`);
  for (const edge of edges.values())
    assert.deepEqual(edge, { count: 2, winding: 0 }, `${mesh.name}: closed oriented boundary`);
}

test('panel indicator: fixed model identity and honest envelope evidence', () => {
  assert.deepEqual(registerPartModules([module]), [part]);
  assert.equal(part.catalogSelectionOnly, true);
  assert.equal(part.presets.length, 1, 'colours do not invent sourced supplier models');
  const preset = part.presets[0];
  assert.deepEqual(preset.catalog?.verifiedParameters, ['model']);
  assert.equal(preset.catalog?.geometryEvidence?.kind, 'envelope');
  assert.deepEqual(Object.keys(preset.catalog?.attributes ?? {}).sort(), [
    'manufacturer',
    'series',
  ]);
  assert.match(part.validationNotice!, /Lehao dimension drawing/);
  assert.equal(indicatorColours.length, 5);
  assert.deepEqual(validateParameters(part, part.defaults, 'assembled'), []);
  assert.ok(part.validate({ ...part.defaults, diameter: 20 }, 'assembled').length);
  assert.ok(part.validate({ ...part.defaults, model: 'apt-ad16-16c' }, 'assembled').length);
  assert.ok(part.validate({ ...part.defaults, lensColour: 'orange' }, 'assembled').length);
  assert.ok(part.validate({ ...part.defaults, lensColour: false }, 'assembled').length);
  assert.ok(part.validate(part.defaults, 'missing').length);
});

for (const colour of indicatorColours)
  test(`panel indicator: ${colour.id} preview surfaces, bounds and native components`, () => {
    const parameters = { ...part.defaults, lensColour: colour.id };
    for (const state of part.states!) {
      assert.deepEqual(validateParameters(part, parameters, state.id), []);
      const group = part.buildGeometry(parameters, state.id);
      try {
        assert.equal(group.children.length, 5);
        assert.equal(new Set(group.children.map((child) => child.name)).size, 5);
        group.updateMatrixWorld(true);
        group.traverse((child) => {
          if (child instanceof Mesh) checkClosedMesh(child);
        });
        const actual = new Box3().setFromObject(group, true).getSize(new Vector3()).toArray();
        const expected = part.dimensions(parameters, state.id);
        expected.forEach((value, axis) => assert.ok(Math.abs(value - actual[axis]) < 0.002));
        assert.deepEqual(expected, state.id === 'assembled' ? [19, 19, 45] : [19, 19, 69]);
        let lensColour: number | undefined;
        group.children[1].traverse((child) => {
          if (child instanceof Mesh && child.material instanceof MeshStandardMaterial)
            lensColour = child.material.color.getHex();
        });
        assert.equal(lensColour, colour.color);
        const code = part.python(parameters, state.id);
        assert.match(code, /shape = Part.makeCompound\(components\)/);
        assert.match(code, /component_labels = /);
        assert.match(code, new RegExp(`Lens — ${colour.id}`));
        assert.equal((code.match(/components\.append\(component\)/g) ?? []).length, 5);
      } finally {
        disposeModel(group);
      }
    }
  });
