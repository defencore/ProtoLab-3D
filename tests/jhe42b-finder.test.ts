import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, MeshStandardMaterial } from 'three';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import part, { jhe42bInterface } from '../src/parts/jhe42b-finder/part';
import module from '../src/parts/jhe42b-finder';
import evidence from '../src/parts/jhe42b-finder/lib/evidence.json';

test('standard JHE42B is an independent purchased unit with primary envelope evidence', () => {
  assert.equal(module.part.id, 'jhe42b-finder');
  assert.equal(part.product.supply, 'purchased');
  assert.equal(part.presets.length, 2);
  const preset = part.presets[0];
  assert.deepEqual(validateParameters(part, preset.parameters, 'default'), []);
  assert.equal(preset.id, 'jhe42b');
  assert.match(preset.catalog?.sourceUrl ?? '', /^https:\/\/jhemcu\.com\//);
  assert.equal(preset.catalog?.geometryEvidence?.kind, 'envelope');
  assert.deepEqual(evidence.verifiedOverallDimensions, [23, 17, 17]);
  assert.deepEqual(preset.catalog?.verifiedParameters, ['model']);
  for (const model of ['jhe42b-s', 'jhe20b'])
    assert.ok(validateParameters(part, { model }, 'default').length > 0);
  assert.ok(validateParameters(part, { model: 'jhe42b', bodyHeight: 15 }, 'default').length > 0);
});

test('the photo exterior fits the nominal envelope and exposes recognizable details through its sleeve', () => {
  const geometry = part.buildGeometry(part.defaults, 'default');
  try {
    const bounds = new Box3().setFromObject(geometry, true);
    for (const [actual, expected] of [...bounds.min.toArray(), ...bounds.max.toArray()].map(
      (v, i) => [v, [-11.5, -8.5, 0, 11.5, 8.5, 17][i]],
    ))
      assert.ok(Math.abs(actual - expected) < 0.001);
    assert.deepEqual(part.dimensions(part.defaults, 'default'), [23, 17, 17]);
    const labels = geometry.children.map((child) => child.name).join(' ');
    for (const feature of [
      /pouch battery/,
      /Black PCB/,
      /side sound mouth/,
      /LED lens/,
      /positive-X mating mouth/,
      /positive-X actuator/,
    ])
      assert.match(labels, feature);
    const sleeve = geometry.children.find((child) => child.name.startsWith('Clear heat-shrink'));
    assert.ok(sleeve);
    let transparentMeshes = 0;
    sleeve.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        assert.ok(material instanceof MeshStandardMaterial);
        assert.equal(material.transparent, true);
        assert.ok(material.opacity > 0 && material.opacity < 0.5);
        assert.equal(material.depthWrite, false);
        transparentMeshes++;
      }
    });
    assert.ok(transparentMeshes > 0);
  } finally {
    disposeModel(geometry);
  }
  const recipe = part.python(part.defaults, 'default');
  assert.match(recipe, /makeCylinder\(6.6,8.65/);
  assert.match(recipe, /Part\.Arc/);
  assert.match(recipe, /Part\.makeLoft/);
  assert.match(recipe, /component_colors =/);
  assert.equal(part.composition, undefined, 'visible surfaces are not separately purchased units');
  assert.equal(part.states, undefined);
});

test('the source-project execution remains a separate unchanged reference box', () => {
  const parameters = { model: 'jhe42b-project-reference-26x17x15' };
  const geometry = part.buildGeometry(parameters, 'default');
  try {
    assert.equal(geometry.children.length, 1);
    const bounds = new Box3().setFromObject(geometry, true);
    assert.deepEqual(bounds.min.toArray(), [-13, -8.5, 0]);
    assert.deepEqual(bounds.max.toArray(), [13, 8.5, 15]);
    assert.deepEqual(part.dimensions(parameters, 'default'), [26, 17, 15]);
    assert.match(part.python(parameters, 'default'), /Part\.makeBox\(26,17,15,/);
  } finally {
    disposeModel(geometry);
  }
});

test('service faces remain qualitative and do not masquerade as verified mounting geometry', () => {
  assert.equal(jhe42bInterface.battery.included, true);
  assert.equal(jhe42bInterface.serviceGeometryVerified, false);
  assert.deepEqual(jhe42bInterface.mountingHoles, []);
  assert.deepEqual(
    jhe42bInterface.serviceFaces.map((feature) => feature.face),
    ['-X', '+X', '+Z', '-Z'],
  );
  assert.equal(evidence.serviceOrientation.featureDimensionsVerified, false);
  assert.match(part.notes ?? '', /not dimensioned/);
  assert.match(part.notes ?? '', /25 × 17 × 17/);
  assert.match(part.product.releaseRequirements.join(' '), /deployment acceleration/);
});
