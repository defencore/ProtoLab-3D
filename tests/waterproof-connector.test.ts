import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import module from '../src/parts/waterproof-connector';
import { contactPositions, findModel, models } from '../src/parts/waterproof-connector/lib/catalog';
import { disposeModel } from '../src/core/mechanical';

const part = module.part;
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 0.0002, `${actual} ~= ${expected}`);

test('SP catalog includes sourced SP16-5 and SP20-2/3/4/6 independent connector halves', () => {
  assert.equal(part.catalogSelectionOnly, true);
  assert.equal(models.length, 10);
  assert.equal(part.presets.length, 10);
  assert.equal(part.product.supply, 'purchased');
  for (const model of models) {
    const preset = part.presets.find((preset) => preset.parameters.model === model.id)!;
    assert.ok(preset);
    assert.deepEqual(part.validate(preset.parameters, 'assembled'), []);
    assert.equal(preset.catalog?.attributes?.contactCount, model.contacts);
    assert.equal(preset.catalog?.attributes?.housing, model.housing);
    assert.equal(preset.catalog?.attributes?.contactSex, model.contactSex);
    assert.equal(model.contactSex, model.housing === 'cable-plug' ? 'male' : 'female');
    assert.equal(
      model.contactDiameter,
      model.series === 'SP16' ? 1 : model.contacts === 6 ? 1.8 : 2.8,
    );
    assert.equal(preset.catalog?.attributes?.series, model.series);
    assert.deepEqual(preset.catalog?.verifiedParameters, ['model']);
    assert.equal(preset.catalog?.geometryEvidence?.kind, 'source-dimensions');
    assert.ok(!('current' in (preset.catalog?.attributes ?? {})));
    assert.ok(!('voltage' in (preset.catalog?.attributes ?? {})));
    assert.equal(contactPositions(model.contacts, model.series).length, model.contacts);
  }
  assert.equal(findModel('sp21-4-panel-socket'), undefined);
  assert.ok(part.validate({ ...part.defaults, model: 'sp21-4-panel-socket' }, 'assembled').length);
  assert.ok(part.validate({ ...part.defaults, diameter: 21 }, 'assembled').length);
  assert.ok(part.validate({ ...part.defaults, panelThickness: Number.NaN }, 'assembled').length);
  assert.ok(part.validate(part.defaults, 'mated').length);
});

test('SP16 and SP20 envelopes and nominal contacts agree across states and source drawings', () => {
  for (const model of models) {
    for (const state of ['assembled', 'exploded']) {
      const parameters = { ...part.defaults, model: model.id };
      const group = part.buildGeometry(parameters, state);
      try {
        group.updateMatrixWorld(true);
        const bounds = new Box3().setFromObject(group, true);
        const dimensions = bounds.getSize(new Vector3()).toArray();
        part
          .dimensions(parameters, state)
          .forEach((dimension, index) => close(dimension, dimensions[index]));
        assert.equal(
          group.children.filter((piece) => /^(Male pin|Female socket)/.test(piece.name)).length,
          model.contacts,
        );
        if (state === 'assembled') {
          close(dimensions[0], model.series === 'SP16' ? 25 : 29);
          close(dimensions[1], model.series === 'SP16' ? 25 : 29);
          close(
            dimensions[2],
            model.housing === 'cable-plug' ? (model.series === 'SP16' ? 60 : 66) : 29,
          );
          close(bounds.max.z, model.housing === 'cable-plug' ? 0 : 14);
          close(
            bounds.min.z,
            model.housing === 'cable-plug' ? (model.series === 'SP16' ? -60 : -66) : -15,
          );
        }
        group.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          const positions = object.geometry.getAttribute('position');
          for (let index = 0; index < positions.count; index++) {
            assert.ok(Number.isFinite(positions.getX(index)));
            assert.ok(Number.isFinite(positions.getY(index)));
            assert.ok(Number.isFinite(positions.getZ(index)));
          }
        });
        const python = part.python(parameters, state);
        assert.match(python, /shape = Part.makeCompound\(components\)/);
        assert.match(python, /component_labels = /);
        assert.match(python, /component_colors = /);
        assert.ok(!/NaN|Infinity|undefined/.test(python));
      } finally {
        disposeModel(group);
      }
    }
  }
});

test('SP20 panel hardware follows the host rear face while its flange datum stays fixed', () => {
  for (const thickness of [0.8, 2, 4]) {
    const parameters = { ...part.defaults, panelThickness: thickness };
    const group = part.buildGeometry(parameters, 'assembled');
    try {
      group.updateMatrixWorld(true);
      const nut = new Box3().setFromObject(
        group.children.find((piece) => /Inner retaining nut/.test(piece.name))!,
        true,
      );
      close(nut.max.z, -thickness);
      close(nut.min.z, -thickness - 3.5);
      const seal = new Box3().setFromObject(
        group.children.find((piece) => /Recessed panel seal/.test(piece.name))!,
        true,
      );
      close(seal.min.z, 0);
      close(seal.max.z, 0.5);
      const body = new Box3().setFromObject(group.children[0], true);
      close(body.min.z, -8);
      close(body.max.z, 14);
    } finally {
      disposeModel(group);
    }
  }
});

test('new contact patterns and opposing barrel flats follow the selected supplier execution', () => {
  const triangle = contactPositions(3, 'SP20');
  close(triangle[0][0], 0);
  assert.ok(triangle[0][1] > 0 && triangle[1][0] > 0 && triangle[2][0] < 0);
  const five = contactPositions(5, 'SP16');
  assert.equal(five.length, 5);
  for (const [x, y] of five) close(Math.hypot(x, y), 3.4);
  assert.ok(five[0][0] < 0 && five[0][1] > 0);
  assert.ok(five[1][0] > 0 && five[1][1] > 0);
  close(five[4][0], 0);
  assert.ok(five[4][1] < 0);
  for (const [id, halfFlat] of [
    ['sp16-5-panel-socket', 7.4],
    ['sp20-3-panel-socket', 9.5],
  ] as const) {
    const group = part.buildGeometry({ ...part.defaults, model: id }, 'assembled');
    try {
      group.updateMatrixWorld(true);
      for (const sign of [-1, 1]) {
        const ray = new Raycaster(new Vector3(0, sign * 20, -4), new Vector3(0, -sign, 0));
        const hits = ray.intersectObject(group.children[0], true);
        assert.ok(hits.length, `${id} has a rear barrel face`);
        close(hits[0].point.y, sign * halfFlat);
      }
    } finally {
      disposeModel(group);
    }
  }
});
