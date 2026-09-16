import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import type { Parameters, PartDefinition, Preset } from '../src/core/types';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import linear from '../src/parts/linear-bearing/part';
import thrust from '../src/parts/thrust-bearing/part';
import rod from '../src/parts/rod-end-bearing/part';
import pillow from '../src/parts/pillow-block-bearing/part';
import insert from '../src/parts/insert-bearing/part';
import clutch from '../src/parts/one-way-clutch/part';
import thrustRoller from '../src/parts/thrust-roller-bearing/part';
import combined from '../src/parts/combined-bearing/part';
import plain from '../src/parts/plain-bearing/part';
import adapter from '../src/parts/adapter-sleeve/part';
import seal from '../src/parts/radial-oil-seal/part';
import { motionBearingCatalog } from '../src/catalog/motion-bearings';
import importedSupplierPresets from '../src/catalog/generated/promtehimport-presets.json';

const families = [
  linear,
  thrust,
  rod,
  pillow,
  insert,
  clutch,
  thrustRoller,
  combined,
  plain,
  adapter,
  seal,
];
for (const part of families) {
  test(`${part.id}: all preset states preserve their envelope and closed outward component meshes`, () => {
    const customKP =
      part.id === 'pillow-block-bearing'
        ? [
            { ...part.defaults, insertOffset: 0 },
            { ...part.defaults, slotLength: 9 },
          ]
        : [];
    for (const parameters of [
      part.defaults,
      ...part.presets.map((preset) => preset.parameters),
      ...customKP,
    ]) {
      for (const state of part.states?.map((state) => state.id) ?? ['default']) {
        const label = `${part.id}/${state}/${JSON.stringify(parameters)}`;
        assert.deepEqual(validateParameters(part, parameters, state), [], label);
        const model = part.buildGeometry(parameters, state);
        try {
          const bounds = new Box3().setFromObject(model).getSize(new Vector3()).toArray();
          part
            .dimensions(parameters, state)
            .forEach((dimension, axis) =>
              assert.ok(Math.abs(dimension - bounds[axis]) < 0.03, `${label}: axis ${axis}`),
            );
          model.traverse((child) => {
            if (!(child instanceof Mesh)) return;
            const positions = child.geometry.getAttribute('position'),
              index = child.geometry.getIndex(),
              edges = new Map<string, number>();
            let volume = 0;
            for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
              const vertices = [i, i + 1, i + 2].map((j) =>
                new Vector3().fromBufferAttribute(positions, index ? index.getX(j) : j),
              );
              assert.ok(
                vertices.every((vertex) => vertex.toArray().every(Number.isFinite)),
                label,
              );
              assert.ok(
                vertices[1]
                  .clone()
                  .sub(vertices[0])
                  .cross(vertices[2].clone().sub(vertices[0]))
                  .length() > 1e-9,
                `${label}: collapsed triangle`,
              );
              volume += vertices[0].dot(vertices[1].clone().cross(vertices[2])) / 6;
              const keys = vertices.map((vertex) =>
                vertex
                  .toArray()
                  .map((value) => Math.round(value * 1e5))
                  .join(','),
              );
              for (let side = 0; side < 3; side++) {
                const edge = [keys[side], keys[(side + 1) % 3]].sort().join('|');
                edges.set(edge, (edges.get(edge) ?? 0) + 1);
              }
            }
            assert.ok(volume > 0, `${label}: component winding`);
            for (const count of edges.values())
              assert.equal(count, 2, `${label}: open or nonmanifold component`);
          });
        } finally {
          disposeModel(model);
        }
      }
    }
  });
}

test('curated motion product identities retain audited supplier data across eleven families', () => {
  assert.equal(Object.keys(motionBearingCatalog).length, 11);
  const auditedCatalog = importedSupplierPresets as Record<string, Preset[]>;
  for (const part of families) {
    const presets = motionBearingCatalog[part.id];
    assert.equal(presets.length, 2, part.id);
    for (const preset of presets) {
      assert.ok(preset.catalog!.sourceUrl.includes('/offer/'));
      const audited = auditedCatalog[part.id].find(
        (entry) => entry.catalog?.sourceUrl === preset.catalog!.sourceUrl,
      );
      assert.ok(audited, `${part.id}/${preset.id}: missing audited supplier record`);
      const registered = part.presets.find((entry) => entry.id === preset.id);
      assert.ok(registered, `${part.id}/${preset.id}: missing supplier preset`);
      // Retain local IDs while using the complete dimensions and metadata from the source audit.
      assert.deepEqual(registered, {
        ...audited,
        id: preset.id,
        catalog:
          part.id === 'pillow-block-bearing'
            ? {
                ...audited.catalog,
                verifiedParameters: [...audited.catalog!.verifiedParameters, 'housingStyle'],
              }
            : audited.catalog,
        parameters:
          part.id === 'pillow-block-bearing'
            ? { ...audited.parameters, housingStyle: 'ucp', insertOffset: 0 }
            : audited.parameters,
      });
      for (const key of part.presetMatchKeys ?? [])
        assert.ok(
          registered.catalog!.verifiedParameters.includes(key),
          `${part.id}/${preset.id}: unsourced matching dimension ${key}`,
        );
    }
  }
});

test('rod ends preserve inner-member width and allow a wider threaded shank', () => {
  const p = motionBearingCatalog['rod-end-bearing'][0].parameters;
  assert.equal(p.width, 12);
  assert.equal(p.headWidth, 9);
  assert.equal(rod.dimensions(p, 'default')[2], 12);
  const largerShank = {
    ...rod.defaults,
    bore: 20,
    outer: 54,
    width: 16,
    headWidth: 13.5,
    stemDiameter: 20,
    stemLength: 51,
  };
  assert.deepEqual(validateParameters(rod, largerShank, 'default'), []);
  const model = rod.buildGeometry(largerShank, 'default');
  try {
    const bounds = new Box3().setFromObject(model).getSize(new Vector3());
    assert.equal(rod.dimensions(largerShank, 'default')[2], 20);
    assert.ok(Math.abs(bounds.z - 20) < 0.03);
  } finally {
    disposeModel(model);
  }
});

test('UCP205 retains the sourced shaft height, mounting slots and housing envelope', () => {
  const p = motionBearingCatalog['pillow-block-bearing'][1].parameters;
  assert.deepEqual(pillow.dimensions(p, 'default'), [140, 38, 71]);
  assert.equal(p.centerHeight, 36.5);
  assert.equal(p.mountPitch, 105);
  assert.equal(p.hole, 13);
  assert.equal(p.slotLength, 19);
});

test('family constraints reject intersecting rollers, broken seats and unsafe mounting slots', () => {
  const invalid: [PartDefinition, Parameters][] = [
    [rod, { width: 3 }],
    [pillow, { mountPitch: 35 }],
    [pillow, { totalHeight: 35 }],
    [pillow, { slotLength: 3 }],
    [insert, { outerWidth: 40 }],
    [insert, { hubDiameter: 45 }],
    [clutch, { rollers: 50 }],
    [clutch, { rollers: 10.5 }],
    [thrustRoller, { washer: 6 }],
    [thrustRoller, { rollers: 50 }],
    [combined, { raceDiameter: 29.9 }],
    [plain, { width: 60 }],
    [adapter, { bore: 29.9 }],
    [seal, { bore: 28 }],
  ];
  for (const [part, patch] of invalid)
    assert.ok(
      validateParameters(part, { ...part.defaults, ...patch }, part.states?.[0].id ?? 'default')
        .length > 0,
      `${part.id}/${JSON.stringify(patch)}`,
    );
});
