import assert from 'node:assert/strict';
import test from 'node:test';
import { Matrix3, Mesh, Vector3, type Group } from 'three';
import part, { pieces, libraries } from '../src/parts/tr8-geared-rocker-actuator/part';
import { componentGeometry } from '../src/core/assembly/detail-instances';
import { packModel, unpackModel } from '../src/core/mesh-transfer';
import { disposeModel } from '../src/core/mechanical';
import { parts } from '../src/parts';
import {
  addProduct,
  createProject,
  parseProject,
  serializeProject,
} from '../src/core/design-project';

function surface(model: Group) {
  model.updateMatrixWorld(true);
  const edges = new Map<string, { uses: number; balance: number }>();
  let capTriangles = 0;
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const position = object.geometry.getAttribute('position'),
      normal = object.geometry.getAttribute('normal'),
      index = object.geometry.index,
      frame = new Matrix3().getNormalMatrix(object.matrixWorld);
    assert.equal(normal.count, position.count);
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      const ids = [0, 1, 2].map((offset) => (index ? index.getX(i + offset) : i + offset));
      const vertices = ids.map((id) =>
        new Vector3().fromBufferAttribute(position, id).applyMatrix4(object.matrixWorld),
      );
      const face = vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0]));
      assert.ok(face.lengthSq() > 1e-20, 'repaired triangles have nonzero area');
      face.normalize();
      if (Math.abs(face.x) > 0.99999) {
        capTriangles++;
        for (const id of ids) {
          const shading = new Vector3()
            .fromBufferAttribute(normal, id)
            .applyMatrix3(frame)
            .normalize();
          assert.ok(
            shading.dot(face) > 1 - 1e-6,
            'a planar gear cap must shade with its own face normal',
          );
        }
      }
      const keys = vertices.map((vertex) =>
        vertex
          .toArray()
          .map((value) => Math.round(value * 1e5))
          .join(','),
      );
      for (let edge = 0; edge < 3; edge++) {
        const a = keys[edge],
          b = keys[(edge + 1) % 3],
          key = a < b ? `${a}/${b}` : `${b}/${a}`;
        const value = edges.get(key) ?? { uses: 0, balance: 0 };
        value.uses++;
        value.balance += a < b ? 1 : -1;
        edges.set(key, value);
      }
    }
  });
  assert.ok(capTriangles > 100, 'the audit includes the actual broad gear caps');
  assert.equal(
    [...edges.values()].filter(({ uses, balance }) => uses !== 2 || balance !== 0).length,
    0,
    'flat normals do not reopen the repaired surface',
  );
}

test('conformed hub gear caps retain flat normals through motion and worker transport', () => {
  for (const outputAngle of [-20, 0, 20])
    for (const id of ['driven-gear', 'motor-pinion']) {
      const piece = pieces({ ...part.defaults, outputAngle }).find(
        (piece) => piece.component.id === id,
      )!;
      const model = componentGeometry(libraries, [piece]);
      let restored: Group | undefined;
      try {
        surface(model);
        restored = unpackModel(packModel(model).model);
        surface(restored);
      } finally {
        disposeModel(model);
        if (restored) disposeModel(restored);
      }
    }
});

test('all four installed spring pins retain installed geometry after a project roundtrip', () => {
  const project = addProduct(createProject(), parts, {
    part,
    parameters: part.defaults,
    state: 'assembled',
  }).project;
  const restored = parseProject(serializeProject(project, parts), parts);
  const pins = restored.occurrences
    .map((occurrence) => ({
      occurrence,
      configuration: restored.configurations.find(
        (configuration) => configuration.id === occurrence.configurationId,
      )!,
    }))
    .filter(({ configuration }) => configuration.libraryId === 'spring-pin');
  assert.equal(pins.length, 4);
  for (const { configuration } of pins)
    assert.equal(
      configuration.state,
      'installed',
      'project resolution must not expand an installed pin to its free diameter',
    );
  const rows = pieces(part.defaults).filter((piece) => piece.component.libraryId === 'spring-pin');
  for (const { configuration } of pins) {
    const original = rows.find(
      (piece) =>
        piece.component.parameters.diameter === configuration.parameters.diameter &&
        piece.component.parameters.length === configuration.parameters.length,
    )!;
    const definition = libraries.find((definition) => definition.id === 'spring-pin')!;
    assert.equal(
      definition.python(configuration.parameters, configuration.state),
      definition.python(original.component.parameters, original.component.state),
    );
  }
});
